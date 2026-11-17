// Hidden Row and In Order: complete Premier League final tables, 1992-93 on, with points deductions applied.
import { EXTRA_DEDUCTIONS } from "../config.mjs";

export function build(ctx) {
  const { q, clubs, SOURCES, stats, notes, FIRST_PL } = ctx;
  const ded = new Map(q("select season, club_id c, points p from points_deductions where tier=1").map(r => [r.season + "|" + r.c, r.p]));
  for (const x of EXTRA_DEDUCTIONS) { const c = [...clubs.values()].find(k => k.name === x.club); if (c) ded.set(x.season + "|" + c.id, (ded.get(x.season + "|" + c.id) || 0) + (ded.has(x.season + "|" + c.id) ? 0 : x.points)); }
  const seasons = q("select distinct season s from standings where competition_id=1 and season>=? order by season", FIRST_PL).map(r => r.s);
  const T = [], names = new Set();
  let fixed = 0, partial = [], blocked = [];
  for (const s of seasons) {
    const rows = q("select club_id c, played p, won w, drawn d, lost l, goals_for gf, goals_against ga, points pts, points_deducted pd from standings where competition_id=1 and season=?", s);
    const n = rows.length;
    // a finished season: every club has played 2(n-1) matches
    if (!n || rows.some(r => r.p !== 2 * (n - 1))) { partial.push(s); continue; }
    // where did its matches come from? a source that is switched off takes the whole season with it
    const src = new Set(q("select distinct source x from matches where competition_id=1 and season=?", s).map(r => r.x));
    if ((src.has("engsoccerdata") && !SOURCES.engsoccerdata) || (src.has("fpl") && !SOURCES.fpl)) { blocked.push(s); continue; }
    const out = rows.map(r => {
      const d = ded.get(s + "|" + r.c) || 0, pts = 3 * r.w + r.d - d;
      if (pts !== r.pts) fixed++;
      return { ...r, d, pts };
    });
    out.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
    if (out.some(r => !clubs.get(r.c)?.name)) continue;
    out.forEach(r => names.add(clubs.get(r.c).name));
    T.push({ s, y: +s.slice(0, 4), rows: out });
  }
  if (fixed) notes.push(`Final tables: ${fixed} club-seasons had points that didn't match 3×wins+draws−deductions (the 2023-24 deductions for Everton, −8, and Nottingham Forest, −4, were missing): recomputed and re-ranked.`);
  if (partial.length) notes.push(`Tables skipped as unfinished: ${partial.join(", ")}.`);
  if (blocked.length) notes.push(`Tables dropped because their data source is switched off: ${blocked.join(", ")}.`);
  const list = [...names].sort(), idx = new Map(list.map((n, i) => [n, i]));
  stats.tableSeasons = T.length;
  return { tables: { clubs: list, t: T.map(t => [t.y, t.rows.map(r => [idx.get(clubs.get(r.c).name), r.p, r.w, r.d, r.l, r.gf, r.ga, r.pts, r.d])]), _n: T.length } };
}
