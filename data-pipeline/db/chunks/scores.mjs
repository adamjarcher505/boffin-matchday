// Exact Score: Premier League results from 1992-93, in four difficulty chunks (d1 = a big, recent, famous match, d4 = a deep cut).
import { FIRST_PL } from "../config.mjs";

const DERBIES = [["Arsenal", "Tottenham"], ["Liverpool", "Everton"], ["Manchester United", "Manchester City"], ["Newcastle United", "Sunderland"], ["Liverpool", "Manchester United"],
  ["Arsenal", "Chelsea"], ["Arsenal", "Manchester United"], ["Chelsea", "Tottenham"], ["West Ham", "Tottenham"], ["Aston Villa", "Birmingham City"], ["Crystal Palace", "Brighton & Hove Albion"],
  ["Chelsea", "Liverpool"], ["Chelsea", "Manchester United"], ["Leeds United", "Manchester United"], ["Sheffield United", "Sheffield Wednesday"], ["West Ham", "Chelsea"], ["Everton", "Manchester United"]];
const isDerby = (a, b) => DERBIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/* how big a club is in the Premier League era: seasons played and how high it finished, 0-1 */
export function bigness(ctx) {
  const { q, clubs, FIRST_PL } = ctx, acc = new Map();
  for (const r of q("select club_id c, position p, season s from standings where competition_id=1 and season>=? and season<'2026-27'", FIRST_PL)) {
    const n = clubs.get(r.c)?.name; if (!n) continue;
    const a = acc.get(n) || { seasons: 0, sum: 0 }; a.seasons++; a.sum += (21 - Math.min(20, r.p)) / 20; acc.set(n, a);
  }
  const out = new Map();
  for (const [n, a] of acc) out.set(n, (a.sum / a.seasons) * Math.sqrt(a.seasons / 34));
  const max = Math.max(...out.values());
  for (const [n, v] of out) out.set(n, v / max);
  return out;
}

export function build(ctx) {
  const { q, clubs, SOURCES, stats, notes } = ctx;
  const big = ctx.bigness = bigness(ctx);
  const rows = q(`select m.match_id id, m.season s, m.date d, m.home_club_id h, m.away_club_id a, m.home_goals hg, m.away_goals ag, m.source src
    from matches m where m.competition_id=1 and m.season>=? and m.home_goals is not null and m.away_goals is not null order by m.date, m.match_id`, FIRST_PL);
  const ok = r => (r.src !== "fpl" || SOURCES.fpl) && (r.src !== "engsoccerdata" || SOURCES.engsoccerdata);
  const list = [];
  let skipped = 0;
  for (const r of rows) {
    const h = clubs.get(r.h)?.name, a = clubs.get(r.a)?.name;
    if (!h || !a || !ok(r)) { skipped++; continue; }
    const y = +r.s.slice(0, 4), tot = r.hg + r.ag;
    let sc = 0.6 * (big.get(h) + big.get(a)) / 2 + 0.4 * Math.min(big.get(h) ?? 0, big.get(a) ?? 0);
    sc += y >= 2016 ? 0.14 : y >= 2005 ? 0.05 : y < 2000 ? -0.08 : 0;
    if (isDerby(h, a)) sc += 0.12;
    if (tot >= 7 || Math.abs(r.hg - r.ag) >= 5) sc += 0.1; // the thrashings people remember
    if (r.src === "fpl") sc -= 0; // current season: same rules
    list.push({ id: r.id, y, md: +r.d.slice(5, 7) * 100 + +r.d.slice(8, 10), h, a, hg: r.hg, ag: r.ag, sc, season: r.s });
  }
  // quartile-ish tiers from the score itself, so every tier has plenty
  const sorted = list.map(x => x.sc).sort((x, y) => y - x), cut = [0.12, 0.35, 0.65].map(f => sorted[Math.floor(sorted.length * f)]);
  const tierOf = sc => (sc >= cut[0] ? 1 : sc >= cut[1] ? 2 : sc >= cut[2] ? 3 : 4);
  const out = {}, counts = [0, 0, 0, 0];
  for (let d = 1; d <= 4; d++) {
    const mine = list.filter(x => tierOf(x.sc) === d), names = [...new Set(mine.flatMap(x => [x.h, x.a]))].sort(), idx = new Map(names.map((n, i) => [n, i]));
    out["scores-d" + d] = { clubs: names, m: mine.map(x => [x.id, x.y, x.md, idx.get(x.h), idx.get(x.a), x.hg, x.ag]), _n: mine.length };
    counts[d - 1] = mine.length;
  }
  stats.scoresByTier = counts;
  stats.scoresSkipped = skipped;
  return out;
}
