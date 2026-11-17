// Ever Team-mates (pals) and Six Degrees (six): from who actually played in the same Premier League match since 2016-17 (FPL appearances).
// Everything is worked out here, on the build machine: the phone only looks puzzles up.
import { APP_FROM } from "../config.mjs";

const key = (a, b) => (a < b ? a * 32768 + b : b * 32768 + a);
const split = k => [Math.floor(k / 32768), k % 32768];

export function build(ctx) {
  const { app, people, game, stats, notes, spells, clubs, SOURCES } = ctx;
  if (!SOURCES.fpl || !app.has) { notes.push("Ever Team-mates and Six Degrees skipped: FPL source is switched off."); return {}; }
  const { PL } = game;

  /* who shared a pitch, per club and overall */
  const together = new Map(), togetherClub = new Map();
  for (const [mid, byClub] of app.byMatch) {
    for (const [cid, ids] of byClub) {
      const u = [...new Set(ids)];
      for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
        const k = key(u[i], u[j]);
        together.set(k, (together.get(k) || 0) + 1);
        const kc = k * 1000 + cid;
        togetherClub.set(kc, (togetherClub.get(kc) || 0) + 1);
      }
    }
  }
  stats.teammatePairs = together.size;

  const name = id => people.get(id)?.name;
  const GK = id => people.get(id)?.pos === "Goalkeeper";
  const posCode = id => ({ Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4 })[people.get(id)?.pos] || 0;
  const joinedYear = (id, cname) => { const s = (spells.get(id) || []).filter(x => x.club === cname && x.s).map(x => +x.s.slice(0, 4)); return s.length ? Math.min(...s) : null; };

  /* ---------------- Ever Team-mates ---------------- */
  // both well enough known to be asked about: the game's fame score (or the estimate) at least 3.4
  const fameOK = id => (people.get(id)?.fame ?? 0) >= 3.4 && people.get(id)?.name;
  const yes = [], no = [];
  for (const [kc, n] of togetherClub) {
    if (n < 8) continue;
    const cid = kc % 1000, [a, b] = split(Math.floor(kc / 1000));
    if (!fameOK(a) || !fameOK(b) || !clubs.get(cid)?.name) continue;
    yes.push({ a, b, cid, n });
  }
  // "never": two players who both arrived at a club in 2017 or later (so nothing before the data starts can have put them together),
  // each with 8+ games for it, who never shared a match. Two goalkeepers is a giveaway, so those are out.
  const byClub = new Map();
  for (const [id, a] of app.byPerson) for (const cid of a.clubs) { if (!byClub.has(cid)) byClub.set(cid, []); byClub.get(cid).push(id); }
  const gamesAt = new Map();
  for (const [sk, m] of app.clubSeason) { const cid = +sk.split("|")[1]; for (const [id, v] of m) { const k = id * 1000 + cid; gamesAt.set(k, (gamesAt.get(k) || 0) + v.games); } }
  for (const [cid, ids] of byClub) {
    const cn = clubs.get(cid)?.name; if (!cn) continue;
    const cand = ids.filter(id => fameOK(id) && (gamesAt.get(id * 1000 + cid) || 0) >= 8 && (joinedYear(id, cn) ?? 0) >= 2017);
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      const a = cand[i], b = cand[j];
      if (GK(a) && GK(b)) continue;
      if (!together.has(key(a, b))) no.push({ a, b, cid, n: 0 });
    }
  }
  const dOf = (a, b) => Math.max(people.get(a).d, people.get(b).d); // as hard as the less famous of the two
  const pick = (list, want, per) => {
    const used = new Map(), out = [];
    // deterministic spread: sort by (tier, id) after a seeded shuffle, cap how often one person turns up
    const sorted = list.slice().sort((x, y) => (x.a * 7919 + x.b * 104729 + x.cid) % 1013 - (y.a * 7919 + y.b * 104729 + y.cid) % 1013 || x.a - y.a || x.b - y.b);
    for (const p of sorted) {
      if (out.length >= want) break;
      if ((used.get(p.a) || 0) >= per || (used.get(p.b) || 0) >= per) continue;
      used.set(p.a, (used.get(p.a) || 0) + 1); used.set(p.b, (used.get(p.b) || 0) + 1); out.push(p);
    }
    return out;
  };
  const pals = [...pick(yes, 900, 3), ...pick(no, 700, 3)];
  const pn = [], pidx = new Map();
  const pid = id => { if (!pidx.has(id)) { pidx.set(id, pn.length); pn.push([name(id), posCode(id)]); } return pidx.get(id); };
  const cl = [], cli = new Map(); const cix = cid => { const n = clubs.get(cid).name; if (!cli.has(n)) { cli.set(n, cl.length); cl.push(n); } return cli.get(n); };
  const palRows = pals.map(p => [pid(p.a), pid(p.b), p.n > 0 ? 1 : 0, cix(p.cid), p.n, dOf(p.a, p.b)]);
  stats.palsYes = yes.length; stats.palsNo = no.length; stats.palsShipped = palRows.length;

  /* ---------------- Six Degrees ----------------
     Graph of people the game's search can find (linked to data.js) who played in the same match. Puzzles are pairs of well-known players with
     no direct link: one common team-mate (need 1) or a two-name route (need 2). The valid answers are stored with each puzzle. */
  const node = id => people.get(id)?.i >= 0 && people.get(id).name;
  const adj = new Map();
  for (const k of together.keys()) {
    const [a, b] = split(k);
    if (!node(a) || !node(b)) continue;
    if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  }
  const famous = [...adj.keys()].filter(id => people.get(id).fame >= 3.8 && adj.get(id).size >= 40).sort((x, y) => x - y);
  stats.sixNodes = adj.size; stats.sixCandidates = famous.length;
  const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const pg = id => people.get(id).i;
  const puzzles = [], seen = new Set();
  const want = { 1: 70, 2: 80, 3: 90, 4: 90 };
  const have = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let tries = 0; tries < 400000 && (have[1] < want[1] || have[2] < want[2] || have[3] < want[3] || have[4] < want[4]); tries++) {
    const a = famous[Math.floor(rnd() * famous.length)], b = famous[Math.floor(rnd() * famous.length)];
    if (a === b || adj.get(a).has(b)) continue;
    const kk = key(a, b); if (seen.has(kk)) continue;
    const d = Math.max(people.get(a).d, people.get(b).d), mind = Math.min(people.get(a).fame, people.get(b).fame);
    if (have[d] >= want[d]) continue;
    const common = [...adj.get(a)].filter(x => adj.get(b).has(x));
    let rec = null;
    if (common.length) {
      const fam = common.filter(x => people.get(x).fame >= 4.2).length;
      // easy tiers need plenty of well-known answers
      if ((d === 1 && (common.length < 8 || fam < 3)) || (d === 2 && (common.length < 4 || fam < 2)) || (d === 3 && common.length < 2)) continue;
      rec = [pg(a), pg(b), 1, d, common.map(pg).sort((x, y) => x - y)];
    } else if (d >= 3) {
      // two-name route: x played with a, y played with x and b
      const xs = [];
      for (const x of adj.get(a)) { const ys = [...adj.get(x)].filter(y => adj.get(b).has(y) && y !== a); if (ys.length) xs.push([pg(x), ys.map(pg).sort((p, q) => p - q)]); }
      if (xs.length < 4) continue;
      xs.sort((p, q) => p[0] - q[0]);
      rec = [pg(a), pg(b), 2, d, xs];
    }
    if (!rec) continue;
    seen.add(kk); puzzles.push(rec); have[d]++;
  }
  stats.sixShipped = have;
  return {
    pals: { names: pn, clubs: cl, p: palRows, _n: palRows.length },
    six: { p: puzzles, _n: puzzles.length }
  };
}
