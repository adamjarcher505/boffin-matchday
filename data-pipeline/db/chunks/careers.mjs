// Spot the Fake and Who Bought Him (from career order), plus the per-club player lists the Grid uses for extra valid answers.
import { norm } from "../lib.mjs";
import { PL_BY_Q } from "../lib.mjs";

const MIN_FAME = 3.2; // below this a player is "thin": never asked about

export function cleanPath(id, ctx) {
  const { spells, incomplete } = ctx;
  if (incomplete.has(id)) return null;
  const sp = (spells.get(id) || []).slice();
  if (sp.length < 3 || sp.some(s => !s.s)) return null; // any undated spell and the order isn't known
  sp.sort((a, b) => a.s.localeCompare(b.s) || (a.e || "9").localeCompare(b.e || "9"));
  // the order he arrived at each club. A loan back to a club he already had, or a return, isn't a new arrival: first arrival only.
  const path = [];
  for (const s of sp) if (!path.some(c => c.club === s.club)) path.push({ club: s.club, y: +s.s.slice(0, 4) });
  if (path.length < 3 || path.length > 7) return null;
  // the same club under two names, side by side (Troyes then ESTAC Troyes), would make a fake out of a real move
  const nm = path.map(c => norm(c.club));
  if (nm.some((a, j) => j && (a.includes(nm[j - 1]) || nm[j - 1].includes(a)))) return null;
  return path;
}

export function build(ctx) {
  const { people, spells, clubs, knownClub, clubPeople, rawClubs, stats, game, notes } = ctx;
  const { CLUB } = game;

  /* ---------- careers ---------- */
  const elig = [];
  for (const [id, p] of people) {
    if (!p.name || p.fame < MIN_FAME) continue;
    const path = cleanPath(id, ctx);
    if (!path || path.filter(c => knownClub(c.club)).length < 2) continue;
    elig.push({ id, p, path });
  }
  stats.careerEligible = elig.length;

  // decoys: where his old team-mates went next, never anywhere he has any record at
  const decoyCache = new Map();
  const decoysFor = ({ id, path }) => {
    const mine = new Set(path.map(c => c.club)), raw = [...(rawClubs.get(id) || [])], cnt = new Map();
    for (const c of path) {
      let n = 0;
      for (const o of clubPeople.get(c.club) || []) {
        if (o === id) continue;
        if (n++ > 250) break;
        for (const s of spells.get(o) || []) if (!mine.has(s.club) && knownClub(s.club)) cnt.set(s.club, (cnt.get(s.club) || 0) + 1);
      }
    }
    const clear = n => { const k = norm(n); return !raw.some(r => r.includes(k) || (k.includes(r) && r.length > 4)); };
    return [...cnt].filter(([n]) => clear(n)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(x => x[0]);
  };

  const names = [], nidx = new Map(), ni = n => { if (!nidx.has(n)) { nidx.set(n, names.length); names.push(n); } return nidx.get(n); };
  const rows = { a: [], b: [] }; let shipped = 0, noDecoy = 0;
  elig.sort((x, y) => x.id - y.id);
  for (const e of elig) {
    const dec = decoysFor(e);
    if (dec.length < 4) { noDecoy++; continue; }
    const pos = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4 }[e.p.pos] || 0;
    (e.p.d <= 2 ? rows.a : rows.b).push([e.p.name, pos, e.p.d, e.path.map(c => [ni(c.club), c.y]), dec.slice(0, 6).map(ni)]);
    shipped++;
  }
  stats.careerShipped = shipped;
  stats.careerNoDecoy = noDecoy;
  // the club list is shared: each chunk carries only the names it uses, so build it per chunk
  const pack = list => {
    const used = new Map(), cl = [], ix = n => { const nm = names[n]; if (!used.has(nm)) { used.set(nm, cl.length); cl.push(nm); } return used.get(nm); };
    return { clubs: cl, p: list.map(r => [r[0], r[1], r[2], r[3].map(([c, y]) => [ix(c), y]), r[4].map(ix)]), _n: list.length };
  };

  /* ---------- Grid: who has played for each club, among players the game's search can find ---------- */
  const byName = new Map(CLUB.map((n, i) => [n.toLowerCase(), i]));
  const gameClub = name => {
    const pl = Object.values(PL_BY_Q).find(c => c.name === name);
    if (pl && pl.bd && byName.has(pl.bd.toLowerCase())) return byName.get(pl.bd.toLowerCase());
    return byName.get(name.toLowerCase()) ?? null;
  };
  const gridc = [];
  let unmapped = 0;
  for (const [cn, set] of clubPeople) {
    const ci = gameClub(cn);
    const linked = [...set].filter(id => people.get(id)?.i >= 0).map(id => people.get(id).i);
    if (linked.length < 20) continue;
    if (ci === null) { unmapped++; continue; }
    gridc.push([ci, [...new Set(linked)].sort((a, b) => a - b)]);
  }
  gridc.sort((a, b) => a[0] - b[0]);
  stats.gridClubs = gridc.length;
  stats.gridClubsNotInGame = unmapped;
  return { "careers-a": pack(rows.a), "careers-b": pack(rows.b), gridv: { c: gridc, _n: gridc.length } };
}
