// Who is who: merge the database's duplicate people, drop women's-football rows, link to the game's own player list, score how well-known.
import { norm, isWomen, nicePlayerName } from "./lib.mjs";
import { PLAYER_TIERS } from "./config.mjs";

const toks = s => norm(s).split(" ").filter(Boolean);
const lastTok = s => { const t = toks(s); return t[t.length - 1] || ""; };

export function resolvePeople({ q, game, stats }) {
  const { PL, NAT } = game;
  const rows = q("select player_id id, name, display_name, name_norm, dob, nationality, position, fpl_code, wikidata_qid qid from players");
  const byId = new Map(rows.map(r => [r.id, r]));

  /* 1. women's football: any spell at a women's side (or a women's national team) and the person is out of a men's quiz entirely */
  const women = new Set(q("select distinct player_id id, club_name n from player_clubs").filter(r => isWomen(r.n)).map(r => r.id));
  stats.womenPeople = women.size;

  /* 2. merge FPL-only rows into the Wikidata row for the same person */
  const apClubs = new Map(); // fpl-only person → clubs he appeared for
  for (const r of q("select distinct player_id id, club_id c from appearances")) { if (!apClubs.has(r.id)) apClubs.set(r.id, new Set()); apClubs.get(r.id).add(r.c); }
  const spellsBy = new Map();
  for (const r of q("select player_id id, club_id c, start_date s, end_date e from player_clubs where club_id is not null")) { if (!spellsBy.has(r.id)) spellsBy.set(r.id, []); spellsBy.get(r.id).push(r); }
  const W = rows.filter(r => r.qid), F = rows.filter(r => r.fpl_code && !r.qid);
  const wByName = new Map(), wByLast = new Map();
  const add = (m, k, r) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); };
  for (const r of W) { add(wByName, norm(r.name), r); add(wByName, norm(r.display_name), r); add(wByLast, lastTok(r.name), r); add(wByLast, lastTok(r.display_name), r); }
  const canon = new Map(), merged = [], ambiguous = [];
  const recent = s => s.e === null || s.e >= "2015" || (s.s && s.s >= "2014");
  for (const f of F) {
    const clubs = apClubs.get(f.id) || new Set();
    let cands = new Set([...(wByName.get(norm(f.name)) || []), ...(wByName.get(norm(f.display_name)) || [])]);
    if (!cands.size) {
      const ft = toks(f.name)[0];
      cands = new Set([...(wByLast.get(lastTok(f.name)) || []), ...(wByLast.get(lastTok(f.display_name)) || [])].filter(w => toks(w.name)[0] === ft));
    }
    cands = [...cands].filter(w => (spellsBy.get(w.id) || []).some(s => clubs.has(s.c)));
    if (cands.length > 1) cands = cands.filter(w => (spellsBy.get(w.id) || []).some(s => clubs.has(s.c) && recent(s)));
    if (cands.length === 1) { canon.set(f.id, cands[0].id); merged.push([f.display_name, cands[0].display_name]); }
    else if (cands.length > 1) ambiguous.push(f.display_name);
  }
  stats.fplOnly = F.length;
  stats.merged = merged.length;
  stats.mergeAmbiguous = ambiguous.length;
  const cid = id => canon.get(id) ?? id;

  /* 3. one record per person */
  const people = new Map();
  for (const r of rows) {
    const id = cid(r.id);
    if (women.has(r.id) || women.has(id)) continue;
    let p = people.get(id);
    if (!p) {
      const base = byId.get(id);
      p = { id, ids: [], base, nameRaw: base.name, qid: base.qid, dob: base.dob, nat: base.nationality, pos: base.position, fpl: false, i: -1 };
      people.set(id, p);
    }
    p.ids.push(r.id);
    if (r.fpl_code) p.fpl = true;
    if (!p.dob && r.dob) p.dob = r.dob;
    if (!p.nat && r.nationality) p.nat = r.nationality;
    if (!p.pos && r.position) p.pos = r.position;
  }
  for (const p of people.values()) {
    const w = p.base;
    p.name = nicePlayerName(w);
    if (!p.name) {
      // a merged FPL row's web name may be the only readable one
      for (const x of p.ids) { const alt = nicePlayerName(byId.get(x)); if (alt) { p.name = alt; break; } }
    }
    p.year = p.dob ? +p.dob.slice(0, 4) : null;
  }
  stats.people = people.size;
  stats.unreadableNames = [...people.values()].filter(p => !p.name).length;

  /* 4. link to the game's own player list (data.js) so a typed answer can be found by the game's search */
  const gByLast = new Map();
  // every game row is indexed under every word of its name, so "Alisson Becker" finds the game's "Alisson" and "Rúben Diogo da Silva Neves" finds "Rúben Neves"
  PL.forEach((g, i) => { for (const k of new Set(toks(g[0]))) { if (k.length < 3) continue; if (!gByLast.has(k)) gByLast.set(k, []); gByLast.get(k).push(i); } });
  const taken = new Map();
  let linked = 0, linkedNoDob = 0;
  for (const p of people.values()) {
    if (!p.name) continue;
    const pt = new Set([...toks(p.name), ...toks(p.nameRaw)]), keys = [...pt].filter(t => t.length >= 3);
    const cands = [], seenI = new Set();
    for (const k of keys) for (const i of gByLast.get(k) || []) {
      if (seenI.has(i)) continue;
      seenI.add(i);
      const g = PL[i], gt = toks(g[0]), gy = g[3] + 1900;
      if (!p.year && g[3] <= 0) continue; // no date of birth either side: can't tell two Adam Davieses apart
      const sub = gt.every(t => pt.has(t)); // all of the game's name tokens are in his full name (Rúben Neves ⊂ Rúben Diogo da Silva Neves)
      const first = gt[0] === toks(p.name)[0] || (gt.length === 1 && pt.has(gt[0]));
      if (!sub) continue; // every word of the game's name must be in his full name; a shared first name alone is nothing
      let sc = 2 + (first ? 1 : 0) + gt.length; // more matching words = more specific (Kyle Walker-Peters beats Kyle Walker for Kyle Walker-Peters)
      if (p.year) { const dy = Math.abs(gy - p.year); if (dy === 0) sc += 3; else if (dy === 1) sc += 1; else continue; }
      cands.push([sc, i]);
    }
    if (!cands.length) continue;
    cands.sort((a, b) => b[0] - a[0]);
    const [best, second] = cands;
    if (second && second[0] === best[0]) continue; // two equally good: don't guess
    if (p.year ? best[0] < 5 : best[0] < 4 || cands.length > 1) continue; // no date of birth: only an unambiguous full-name hit
    if (taken.has(best[1])) { // two database people on one game row: keep the one with a date of birth, else neither
      const o = taken.get(best[1]);
      if (o.year && !p.year) continue;
      if (!o.year && p.year) o.i = -1; else { o.i = -1; continue; }
    }
    p.i = best[1];
    taken.set(best[1], p);
    linked++;
    if (!p.year) linkedNoDob++;
  }
  stats.linkedToGame = linked;
  stats.linkedNoDob = linkedNoDob;

  /* 5. nationality as the game's index into NAT (or -1) */
  const natAlias = { Ireland: "Rep. of Ireland", "Republic of Ireland": "Rep. of Ireland", "United States": "USA", "United States of America": "USA", "Côte d'Ivoire": "Ivory Coast", "Czechia": "Czech Republic", "Bosnia and Herzegovina": "Bosnia", "Korea Republic": "South Korea", "South Korea": "South Korea", "Türkiye": "Turkey", "Cabo Verde": "Cape Verde", "Democratic Republic of the Congo": "DR Congo" };
  const natIdx = new Map(NAT.map((n, i) => [norm(n), i]));
  for (const p of people.values()) {
    p.natI = p.i >= 0 && PL[p.i][1] >= 0 ? PL[p.i][1] : p.nat ? natIdx.get(norm(natAlias[p.nat] || p.nat)) ?? -1 : -1;
  }

  return { people, cid, women, rows, byId };
}

/* how well-known: the game's fame score (0-6.5) for linked players; for the rest, estimated from Premier League games since 2016
   (calibrated against the linked players: 100-200 games ≈ 3.9, 200-300 ≈ 4.6, 300+ ≈ 5.1) or, for older players, Wikidata appearances at PL clubs. */
export function fameOf(p, PL, fpl, wdApps) {
  if (p.i >= 0) return PL[p.i][4] / 10;
  const g = fpl?.games || 0;
  if (g >= 300) return 5.0;
  if (g >= 200) return 4.5;
  if (g >= 100) return 3.9;
  if (g >= 40) return 3.3;
  if (g >= 10) return 2.9;
  if (g >= 1) return 2.2;
  const a = wdApps || 0;
  return a >= 300 ? 3.8 : a >= 150 ? 3.5 : a >= 20 ? 3.0 : 2.0;
}
export const tierOfFame = f => (f >= PLAYER_TIERS[0] ? 1 : f >= PLAYER_TIERS[1] ? 2 : f >= PLAYER_TIERS[2] ? 3 : 4);
