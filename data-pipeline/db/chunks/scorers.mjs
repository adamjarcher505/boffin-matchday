// Top scorers by Premier League season, 2016-17 on (FPL appearances). Players the game's search can't find are never in the answer set.
export function build(ctx) {
  const { q, people, P, stats, notes, SOURCES, app } = ctx;
  if (!SOURCES.fpl || !app.has) { notes.push("Top scorers skipped: FPL source is switched off."); return {}; }
  const complete = new Set(q("select season s from standings where competition_id=1 and season>='2016-17' group by season having min(played)=max(played) and max(played)>=38").map(r => r.s));
  const by = new Map();
  for (const r of q("select m.season s, a.player_id pid, sum(a.goals) g from appearances a join matches m using(match_id) where m.competition_id=1 and a.goals>0 group by 1,2")) {
    if (!complete.has(r.s)) continue;
    const id = P.cid(r.pid); if (!people.has(id)) continue;
    if (!by.has(r.s)) by.set(r.s, new Map());
    by.get(r.s).set(id, (by.get(r.s).get(id) || 0) + r.g);
  }
  const out = []; let skipped = [];
  for (const [s, m] of [...by].sort()) {
    const rank = [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (rank.length < 6) continue;
    const third = rank[2][1], top = rank.filter((x, k) => k < 3 || x[1] === third); // ties at third place count too
    if (top.some(([id]) => !(people.get(id).i >= 0 && people.get(id).name))) { skipped.push(s); continue; }
    out.push([+s.slice(0, 4), top.map(([id]) => [people.get(id).name, people.get(id).i]), rank.slice(top.length, top.length + 4).map(([id]) => people.get(id).name)]);
  }
  if (skipped.length) notes.push(`Top scorers skipped for ${skipped.join(", ")}: someone in the top three isn't in the game's player search (typed answers need them to be).`);
  notes.push("Top scorers ship names only, not goal counts: FPL's tally differs from the official one in places (Kane 2017-18: FPL 29, official 30).");
  stats.scorerSeasons = out.length;
  return { scorers: { s: out, _n: out.length } };
}
