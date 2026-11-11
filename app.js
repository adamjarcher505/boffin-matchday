"use strict";
/* ============ data ============ */
const BD = window.BD, PL = BD.players, CLUB = BD.clubs, NAT = BD.nats;
const norm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ı/g, "i").replace(/['’]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const NTOK = PL.map(p => norm(p[0]).split(" "));
const fame = i => PL[i][4] / 10;
const pkey = i => PL[i][0] + "|" + PL[i][3];
const KEY2IDX = {}; PL.forEach((p, i) => { KEY2IDX[pkey(i)] = i; });
const clubPl = CLUB.map(() => []), natPl = NAT.map(() => []), ALLIDX = PL.map((p, i) => i);
PL.forEach((p, i) => { const c = p[5], seen = {}; for (let k = 0; k < c.length; k += 2) if (!seen[c[k]]) { seen[c[k]] = 1; clubPl[c[k]].push(i); } if (p[1] >= 0) natPl[p[1]].push(i); });
const POSN = ["GK", "DEF", "MID", "FWD"];
const DIVS = ["Sunday League", "Non-League", "League Two", "League One", "Championship", "Top Flight", "European Nights", "Knows Ball"];
const HOUSE = ["Dog & Duck Reserves", "Expected Goals FC", "Athletic Mince", "Two Banks of Four", "Lokomotiv Layby", "Dynamo Kebab", "Inter Row Z", "Park the Bus Rovers", "Second Ball Albion", "Corner Flag Wanderers", "Late Fitness Test", "Hoof & Hope", "Channel Runners", "Early Doors United", "Clearly Offside", "Pints & Assists", "The Wrong Studs", "Low Block Athletic", "False Nines", "Six-Yard Scramble", "Agricultural Challenge", "Back Stick FC", "Keeper's Coming Up", "Cup Tied", "Magic Sponge", "Deadline Day Loanees", "Trialist XI", "Stoppage Time Town", "Half-Time Oranges", "Fourth Officials", "The Technical Area", "Proper Number Nines", "Mid-Table Obscurity", "Needs a Result", "One of Those Days", "Row Z Rovers", "Unused Substitutes", "The Walking Wounded", "Bobbly Pitch Borough", "Game Management FC"];
const SB = { 1: [50, 7], 2: [87, 25], 3: [67, 21], 4: [50, 20], 5: [33, 21], 6: [13, 25], 7: [90, 42], 8: [10, 42], 9: [65, 37], 10: [50, 36], 11: [35, 37], 12: [88, 56], 13: [67, 53], 14: [50, 52], 15: [33, 53], 16: [12, 56], 17: [86, 76], 18: [68, 69], 19: [50, 68], 20: [32, 69], 21: [14, 76], 22: [65, 87], 23: [50, 90], 24: [35, 87], 25: [50, 78] };
const MINS = [11, 27, 44, 63, 82];
const mnS = k => k < 5 ? MINS[k] + "'" : "PEN", mnO = k => k < 5 ? (MINS[k] + 3) + "'" : "PEN";
const CUPR = ["Round of 16", "Quarter-final", "Semi-final", "Final"];
const FANS = ["Season Ticket Steve", "Away Day Dave", "Row Z Ron", "Programme Pete", "Half-and-Half Hayley", "Megastore Mick", "Big Screen Barry", "Gate 7 Gaz", "Pie Queue Paula", "Bovril Bev", "Phone-in Phil", "Coach Trip Kev", "Banner Bill", "Lucky Scarf Lou", "Three Generations Tom", "Fantasy Fiona", "Tactics Board Terry", "Pre-Match Pint Pat", "Retro Shirt Rich", "Ex-Ballboy Ben", "Podcast Pod", "Stadium Tour Tina", "Wembley Way Wes", "Kit Launch Karl"];
const TYPES = {
  cell: { n: "The Grid", rule: "Name one player who fits both.", t: 20, typed: 1 },
  top: { n: "Top Ten", rule: "", t: 30, typed: 1 },
  xi: { n: "Missing XI", rule: "", t: 30, typed: 1 },
  mates: { n: "The Link", rule: "Name someone who shared a dressing room with both. Top-five-league squads, 2010–2023.", t: 22, typed: 1 },
  career: { n: "Career Path", rule: "Clubs in order of arrival. Who is it?", t: 20, typed: 1 },
  hl: { n: "The Fee", rule: "", t: 20, typed: 0 },
  season: { n: "Name the Season", rule: "", t: 16, typed: 0 },
  squad: { n: "Squad Sheet", rule: "", t: 30, typed: 1 },
  odd: { n: "Odd One Out", rule: "", t: 22, typed: 0 },
  race: { n: "Higher or Lower", rule: "", t: 20, typed: 0 },
  champ: { n: "Final Standings", rule: "", t: 20, typed: 0 }
};
const WORDS = ["NIL", "ONE", "TWO", "THREE", "FOUR", "FIVE"];
const SAY = {
  ok: ["Tidy.", "That'll do.", "No fuss.", "Never in doubt.", "Bread and butter.", "Passed it into the net."],
  deep: ["Deep cut. Respect.", "Nobody's getting him in a pub quiz.", "You've watched a lot of football.", "That one's for the anoraks."],
  no: ["He never played there. Not even on loan.", "Not on the books, that one.", "Have a word with yourself.", "Wrong man.", "The linesman's flag is up."],
  slow: ["Dallied on it.", "Too long on the ball.", "The chance went begging."],
  W: ["Three points. On the coach early.", "Job done. Nothing flashy.", "Professional. The gaffer nods."],
  D: ["A point's a point.", "Honours even. Nobody's thrilled.", "One apiece in spirit."],
  L: ["The less said, the better.", "One to forget. Go again.", "Bad day at the office."]
};

/* ============ helpers ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shuffle = (a, r = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickR = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-GB");
const pad = n => String(n).padStart(2, "0");
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || "th");
const dayKey = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const weekNo = () => Math.floor((Date.now() / 864e5 + 3) / 7);
const daysIn = () => (Date.now() / 864e5 + 3) % 7;
const seasonLabel = y => y + "–" + String(y + 1).slice(2);
function search(q) { q = norm(q); if (q.length < 2) return []; const qt = q.split(" "), out = []; for (let i = 0; i < PL.length && out.length < 4; i++) { const t = NTOK[i]; let ok = true; for (const a of qt) { let f = false; for (const b of t) if (b.startsWith(a)) { f = true; break; } if (!f) { ok = false; break; } } if (ok) out.push(i); } return out; }
const hasClub = (i, c) => { const a = PL[i][5]; for (let k = 0; k < a.length; k += 2) if (a[k] === c) return true; return false; };
const clubsOf = i => { const a = PL[i][5], out = []; for (let k = 0; k < a.length; k += 2) if (!out.includes(a[k])) out.push(a[k]); return out; };
const fits = (i, c) => c.t === "c" ? hasClub(i, c.v) : c.t === "n" ? PL[i][1] === c.v : c.t === "l" ? !!(PL[i][7] & (1 << c.v)) : !!(PL[i][7] & 32);
const poolOf = c => c.t === "c" ? clubPl[c.v] : c.t === "n" ? natPl[c.v] : ALLIDX;
const catLabel = c => c.t === "c" ? CLUB[c.v] : c.t === "n" ? NAT[c.v] : c.t === "l" ? BD.leagues[c.v] : "15+ league goals";
const catPhrase = c => c.t === "c" ? "played for " + CLUB[c.v] : c.t === "n" ? "is from " + NAT[c.v] : c.t === "l" ? "played in " + BD.leagues[c.v] : "scored 15+ league goals in a season";
const catSub = c => c.t === "c" ? "Played for" : c.t === "n" ? "Nationality" : c.t === "l" ? "Played in" : "In one season, 2009–22";
function validSet(a, b) { const [x, y] = poolOf(a).length <= poolOf(b).length ? [a, b] : [b, a]; return poolOf(x).filter(i => fits(i, y)); }
const sameCat = (a, b) => a.t === b.t && a.v === b.v;
function overlaps(i, j) { const a = PL[i][6], b = PL[j][6]; for (let x = 0; x < a.length; x += 3) for (let y = 0; y < b.length; y += 3) if (a[x] === b[y] && a[x + 1] <= b[y + 2] && b[y + 1] <= a[x + 2]) return true; return false; }
const tierOf = div => div <= 1 ? 0 : div <= 3 ? 1 : div <= 5 ? 2 : 3;
/* Premier League clubs: anyone who appears in a PL table, relegation list or PL line-up */
const PLNAMES = new Set(); BD.tables.forEach(t => { if (t[0] === "Premier League") { t[3].forEach(r => PLNAMES.add(r[0])); t[4].forEach(n => PLNAMES.add(n)); } }); BD.xi.forEach(x => { if (x[4].indexOf("Premier League") === 0) { PLNAMES.add(x[0]); PLNAMES.add(x[1]); } });
const PLC = new Set(CLUB.map((n, i) => PLNAMES.has(n) ? i : -1).filter(i => i >= 0));
const isPLp = i => !!(PL[i][7] & 1);
const PLGRID = BD.gridClubs.filter(c => PLC.has(c));
const SQ0 = 2010, SQN = 17;   // squad records: seasons 2010–11 to 2026–27 (2022–23 on from Fantasy Premier League data)
const sqLabel = y => seasonLabel(SQ0 + y) + (y === SQN - 1 ? " (this season)" : "");
const squadOf = (c, y) => clubPl[c].filter(i => { const a = PL[i][6]; for (let k = 0; k < a.length; k += 3) if (a[k] === c && a[k + 1] <= y && y <= a[k + 2]) return true; return false; });
const sqClubs = BD.gridClubs.filter(c => squadOf(c, 5).length >= 15);
const clubIdx = name => CLUB.indexOf(name);
const listsOf = c => BD.lists.map((l, i) => i).filter(i => BD.lists[i][0].indexOf(CLUB[c] + ":") === 0 || BD.lists[i][0].indexOf(CLUB[c] + "'s ") === 0);
const PLLISTS = BD.lists.map((l, i) => i).filter(i => BD.lists[i][0].indexOf("Premier League") === 0 || PLGRID.some(c => BD.lists[i][0].indexOf(CLUB[c] + ":") === 0 || BD.lists[i][0].indexOf(CLUB[c] + "'s ") === 0));

/* ============ state ============ */
const KEY = "boffin-matchday-v1";
const freshCup = () => ({ club: "", rd: 0, runs: 0, won: 0, best: -1, w: 0, l: 0 });
const fresh = () => ({ cup: freshCup(), v: 1, made: false, name: "", club: "Arsenal", xp: 0, div: 0, season: 1, cw: { wk: weekNo(), gf: 0, pts: 0 }, week: { pl: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }, form: [], g: {}, played: [], album: {}, recent: [], grid: {}, st: { m: 0, w: 0, goals: 0, deep: 0, bestDiv: 0, grids: 0 }, sound: true, salt: Math.floor(Math.random() * 1e9), note: null });
let S = fresh();
try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); S = Object.assign(fresh(), o); S.week = Object.assign(fresh().week, o.week || {}); S.st = Object.assign(fresh().st, o.st || {}); S.cw = Object.assign(fresh().cw, o.cw || {}); S.cup = Object.assign(freshCup(), o.cup || {}); } } catch (e) { }
let saveT = 0;
function save(push) { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }, 50); if (push) Net.push(); }
const cwNow = () => { if (S.cw.wk !== weekNo()) S.cw = { wk: weekNo(), gf: 0, pts: 0 }; return S.cw; };
const levelAt = n => Math.round(120 * Math.pow(n, 1.6) / 10) * 10;
const levelOf = xp => { let n = 0; while (xp >= levelAt(n + 1)) n++; return n + 1; };
function addXp(n) { const a = levelOf(S.xp); S.xp += Math.round(n); const b = levelOf(S.xp); if (b > a) toast("Level " + b + ". The knowledge grows."); }
function addAlbum(i) { const k = pkey(i); const isNew = !S.album[k]; S.album[k] = (S.album[k] || 0) + 1; S.recent = [k].concat(S.recent.filter(x => x !== k)).slice(0, 40); return isNew; }

/* ============ shared backend (works for signed-in members; everyone else plays locally) ============ */
const Net = {
  db: null, uid: null, ready: false, readonly: false, rows: [], last: 0, busy: false, again: false,
  checked: false,
  async init() { try { await Net._init(); } catch (e) { } Net.checked = true; if (view === "home") render(); },
  async _init() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) return; const uid = await user.id(); if (!uid) return;
      Net.db = db; Net.uid = uid; Net.ready = true;
      try { const snap = await db.doc("data/users/" + uid + "/save").get(); if (snap.exists) { const d = snap.data(); if (d && d.json) { const r = JSON.parse(d.json); if ((r.xp || 0) > (S.xp || 0)) { S = Object.assign(fresh(), r); save(); } } } } catch (e) { }
      await Net.pull(true); if (view !== "match") render();
    } catch (e) { }
  },
  async pull(force) {
    if (!Net.ready || (!force && Date.now() - Net.last < 20000)) return; Net.last = Date.now();
    try { const q = await Net.db.collection("players").limit(500).get(); Net.rows = q.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) { }
  },
  async push() {
    if (!Net.ready || Net.readonly || !S.made) return; if (Net.busy) { Net.again = true; return; } Net.busy = true;
    try {
      await Net.db.doc("players/" + Net.uid).set({ n: S.name.slice(0, 18), c: S.club, d: S.div, w: weekNo(), cg: cwNow().gf, cp: cwNow().pts, s: S.season, p: S.week.pts, pl: S.week.pl, wn: S.week.w, dr: S.week.d, ls: S.week.l, gf: S.week.gf, ga: S.week.ga, xp: S.xp, g: S.g, cu: S.cup.won, t: Date.now() });
      await Net.db.doc("data/users/" + Net.uid + "/save").set({ json: JSON.stringify(S), t: Date.now() });
    } catch (e) { if (e && e.code === "invalid_argument") Net.readonly = true; }
    Net.busy = false; if (Net.again) { Net.again = false; Net.push(); }
  }
};

/* ============ league ============ */
function houseRow(sid, div, name, slot, played) {
  const r0 = rngOf(hash("hs" + sid + "-" + div + "-" + slot)), s = r0(), r = rngOf(hash("hr" + sid + "-" + div + "-" + slot));
  const row = { id: "h" + slot, name, house: true, s, pl: played, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (let m = 0; m < played; m++) { const x = r(), pw = .2 + .38 * s; if (x < pw) { row.w++; row.pts += 3; row.gf += 2 + Math.floor(r() * 3); row.ga += Math.floor(r() * 2); } else if (x < pw + .24) { row.d++; row.pts++; const g = 1 + Math.floor(r() * 2); row.gf += g; row.ga += g; } else { row.l++; row.ga += 2 + Math.floor(r() * 3); row.gf += Math.floor(r() * 2); } }
  return row;
}
const SEASON = 19;
function leagueTable() {
  const div = S.div, sid = S.season + "." + S.salt;
  const real = Net.rows.filter(r => r && r.d === div && r.id !== Net.uid && r.n && (r.pl | 0) <= SEASON).sort((a, b) => (b.t | 0) - (a.t | 0)).slice(0, 19).map(r => ({ id: r.id, name: String(r.n).slice(0, 18), real: true, club: r.c, pl: r.pl | 0, w: r.wn | 0, d: r.dr | 0, l: r.ls | 0, gf: r.gf | 0, ga: r.ga | 0, pts: r.p | 0, g: r.g || {} }));
  const names = shuffle(HOUSE, rngOf(hash("hn" + sid + "-" + div))), rows = real.slice();
  for (let k = 0; rows.length < 19; k++) rows.push(houseRow(sid, div, names[k], k, S.week.pl));
  const w = S.week; rows.push({ id: "me", me: true, name: S.name || "You", pl: w.pl, w: w.w, d: w.d, l: w.l, gf: w.gf, ga: w.ga, pts: w.pts });
  rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || (a.me ? -1 : b.me ? 1 : 0));
  return rows;
}
const myPos = rows => rows.findIndex(r => r.me) + 1;
function settleSeason() {
  if (S.week.pl < SEASON) return false;
  const pos = myPos(leagueTable()), from = S.div;
  if (pos <= 4 && S.div < DIVS.length - 1) S.div++; else if (pos >= 17 && S.div > 0) S.div--;
  S.st.bestDiv = Math.max(S.st.bestDiv, S.div);
  S.note = { pos, from, to: S.div, pts: S.week.pts };
  S.season++; S.week = fresh().week; S.g = {}; save(true); return true;
}
function nextOpponent() {
  const rows = leagueTable().filter(r => !r.me), order = shuffle(rows, rngOf(hash("fx" + S.season + "-" + S.div + "-" + S.salt)));
  return order[S.week.pl % order.length];
}

/* ============ round makers (pure, seeded) ============ */
const CAREERS = ALLIDX.filter(i => (PL[i][7] & 64) && clubsOf(i).length >= 3);
function makeCell(r, tier, sc) {
  sc = sc || {};
  const nC = [16, 26, 38, 99][tier], nN = [8, 12, 18, 26][tier], minV = sc.club !== undefined ? [5, 4, 3, 2][tier] : [8, 6, 4, 3][tier], minF = sc.club !== undefined ? [2, 1, 1, 0][tier] : [3, 2, 1, 0][tier];
  const gc = (sc.pl ? PLGRID.slice(0, [11, 16, 22, 99][tier]) : BD.gridClubs.slice(0, nC)), gn = BD.gridNats.slice(0, nN);
  for (let k = 0; k < 120; k++) {
    const a = { t: "c", v: sc.club !== undefined ? sc.club : pickR(gc, r) }; let b; const x = r();
    if (sc.pl || sc.club !== undefined) { const pool = sc.club !== undefined && PLC.has(sc.club) ? PLGRID.slice(0, [11, 16, 22, 99][tier]) : gc; if (x < .5) b = { t: "c", v: pickR(pool, r) }; else if (x < .9 || tier === 0) b = { t: "n", v: pickR(gn, r) }; else b = { t: "g", v: 0 }; if (sameCat(a, b)) continue; const v = validSet(a, b); if (v.length >= minV && v.filter(i => fame(i) >= 5).length >= minF) return { type: "cell", a, b }; continue; }
    if (x < .5) b = { t: "c", v: pickR(gc, r) }; else if (x < .86 || tier === 0) b = { t: "n", v: pickR(gn, r) }; else if (x < .94) b = { t: "l", v: Math.floor(r() * 5) }; else b = { t: "g", v: 0 };
    if (sameCat(a, b)) continue; const v = validSet(a, b);
    if (v.length >= minV && v.filter(i => fame(i) >= 5).length >= minF) return { type: "cell", a, b };
  }
  return { type: "cell", a: { t: "c", v: BD.gridClubs[0] }, b: { t: "c", v: BD.gridClubs[1] } };
}
function specKey(x) {
  if (!x) return ""; const t = x.type;
  if (t === "cell") return "c" + x.a.t + x.a.v + x.b.t + x.b.v; if (t === "top") return "t" + x.i; if (t === "xi") return "x" + x.i; if (t === "season") return "s" + x.i;
  if (t === "mates") return "m" + (x.ab ? x.ab.join(".") : x.i); if (t === "career") return "p" + x.p; if (t === "squad") return "q" + x.c + "." + x.y;
  if (t === "hl" || t === "race") return t[0] + x.pairs.map(q => q.join(".")).join("_"); if (t === "odd") return "o" + x.sets.map(z => z.o[z.x]).join(".");
  if (t === "champ") return "k" + x.qs.map(q => q.t + "." + (q.p !== undefined ? q.p : q.c)).join("_"); return t;
}
const isSeen = x => !!x && (S.seen || []).includes(specKey(x));
function markSeen(x) { const k = specKey(x); if (!k) return; S.seen = (S.seen || []).filter(y => y !== k).concat(k).slice(-400); }
function makeRound(type, r, tier, sc, any) { let x = null; for (let k = 0; k < 6; k++) { x = makeRound0(type, r, tier, sc); if (any || !x || !isSeen(x)) return x; } return x; }
function makeRound0(type, r, tier, sc) {
  if (sc && (sc.pl || sc.club !== undefined)) { const x = makeScoped(type, r, tier, sc); if (x) return x; if (sc.club !== undefined) return null; }
  if (type === "squad" || type === "odd" || type === "race" || type === "champ") return makeScoped(type, r, tier, {});
  if (type === "cell") return makeCell(r, tier);
  if (type === "top") { const pool = BD.lists.map((l, i) => i).filter(i => BD.lists[i][2] <= tier + 1); return { type, i: pickR(pool, r), target: [3, 4, 4, 5][tier] }; }
  if (type === "xi") { const pool = BD.xi.map((l, i) => i).filter(i => BD.xi[i][5] <= tier + 1), i = pickR(pool, r); const order = BD.xi[i][6].map((p, k) => k).sort((a, b) => BD.xi[i][6][b][2] - BD.xi[i][6][a][2]), idx = shuffle(order.slice(0, [5, 7, 9, 11][tier]), r).slice(0, 3); return { type, i, blanks: idx, target: 2 }; }
  if (type === "mates") { const n = [150, 300, 500, 700][tier]; return { type, i: Math.floor(r() * Math.min(n, BD.pairs.length)) }; }
  if (type === "career") { const thr = [5.4, 4.9, 4.4, 3.9][tier], pool = CAREERS.filter(i => fame(i) >= thr); return { type, p: pickR(pool, r) }; }
  if (type === "hl") { const n = [250, 450, 700, 900][tier], ratio = [1.5, 1.35, 1.25, 1.15][tier], pairs = []; let guard = 0; while (pairs.length < 5 && guard++ < 400) { const a = Math.floor(r() * n), b = Math.floor(r() * n), fa = BD.hl[a][4], fb = BD.hl[b][4]; if (a !== b && BD.hl[a][0] !== BD.hl[b][0] && Math.max(fa, fb) / Math.min(fa, fb) >= ratio) pairs.push([a, b]); } return { type, pairs, target: tier ? 4 : 3 }; }
  const pool = BD.tables.map((t, i) => i).filter(i => BD.tables[i][2] <= tier + 1 && (tier > 1 || BD.tables[i][0] === "Premier League")); return { type: "season", i: pickR(pool, r), tol: tier === 3 ? 0 : 1 };
}
/* League matches must rebuild identically from their seed (so ghosts replay the same five chances), so they never skip seen questions inside a seed.
   Instead we try a few seed variants and keep the freshest. */
function makeMatch(seed, tier) { const r = rngOf(hash("m" + seed)); let types = shuffle(Object.keys(TYPES), r).slice(0, 5); if (!types.includes("cell")) types[0] = "cell"; return types.map(t => makeRound(t, r, tier, r() < .7 ? { pl: 1 } : null, true)); }
function freshSeed(seed, tier) { let best = seed, bestN = 9; for (let k = 0; k < 6; k++) { const sd = k ? seed + "~" + k : seed, n = makeMatch(sd, tier).filter(isSeen).length; if (n < bestN) { best = sd; bestN = n; } if (!n) break; } return best; }
/* Scoped rounds: sc.pl = Premier League only, sc.club = one club only. Returns null if the data can't support it. */
function makeScoped(type, r, tier, sc) {
  const C = sc.club, club = C !== undefined, pl = !!sc.pl;
  if (type === "cell") return makeCell(r, tier, sc);
  if (type === "top") {
    let pool = club ? listsOf(C) : pl ? PLLISTS.filter(i => BD.lists[i][2] <= tier + 1) : BD.lists.map((l, i) => i);
    if (!pool.length) return null; return { type, i: pickR(pool, r), target: club ? [3, 3, 4, 5][tier] : [3, 4, 4, 5][tier] };
  }
  if (type === "xi") {
    const pool = BD.xi.map((l, i) => i).filter(i => club ? BD.xi[i][0] === CLUB[C] : BD.xi[i][4].indexOf("Premier League") === 0 && BD.xi[i][5] <= tier + 1);
    if (!pool.length) return null; const i = pickR(pool, r), order = BD.xi[i][6].map((p, k) => k).sort((a, b) => BD.xi[i][6][b][2] - BD.xi[i][6][a][2]), idx = shuffle(order.slice(0, [5, 7, 9, 11][tier]), r).slice(0, 3); return { type, i, blanks: idx, target: 2 };
  }
  if (type === "mates") {
    if (club) { const thr = [5, 4.5, 4, 3.5][tier], base = clubPl[C].filter(i => PL[i][6].length && fame(i) >= thr); if (base.length < 6) return null;
      for (let g = 0; g < 14; g++) { const a = pickR(base, r), b = pickR(base, r); if (a === b) continue; let n = 0; for (let i = 0; i < PL.length && n < 3; i++) if (i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b)) n++; if (n >= 3) return { type, ab: [a, b] }; } return null; }
    const n = [150, 300, 500, 700][tier], pool = BD.pairs.map((p, i) => i).slice(0, n).filter(i => isPLp(BD.pairs[i][0]) && isPLp(BD.pairs[i][1])); if (!pool.length) return null; return { type, i: pickR(pool, r) };
  }
  if (type === "career") { const thr = club ? [4.6, 4.2, 3.8, 3.4][tier] : [5.4, 4.9, 4.4, 3.9][tier], pool = CAREERS.filter(i => fame(i) >= thr && (club ? hasClub(i, C) : isPLp(i))); if (!pool.length) return null; return { type, p: pickR(pool, r) }; }
  if (type === "hl") {
    const pool = BD.hl.map((h, i) => i).filter(i => club ? (BD.hl[i][1] === C || BD.hl[i][2] === C) : PLC.has(BD.hl[i][2])); if (pool.length < 8) return null;
    const ratio = club ? 1.12 : [1.5, 1.35, 1.25, 1.15][tier], pairs = []; let guard = 0;
    while (pairs.length < 5 && guard++ < 600) { const a = pickR(pool, r), b = pickR(pool, r), fa = BD.hl[a][4], fb = BD.hl[b][4]; if (a !== b && BD.hl[a][0] !== BD.hl[b][0] && Math.max(fa, fb) / Math.min(fa, fb) >= ratio && !pairs.some(q => q.includes(a) && q.includes(b))) pairs.push([a, b]); }
    return pairs.length === 5 ? { type, pairs, target: tier ? 4 : 3 } : null;
  }
  if (type === "season") { const pool = BD.tables.map((t, i) => i).filter(i => club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : BD.tables[i][0] === "Premier League"); if (pool.length < 2) return null; return { type, i: pickR(pool, r), tol: tier === 3 ? 0 : 1 }; }
  if (type === "squad") {
    const c = club ? C : pickR(pl ? sqClubs.filter(x => PLC.has(x)) : sqClubs, r); if (c === undefined) return null;
    const ys = []; for (let y = 0; y < SQN; y++) if (squadOf(c, y).length >= 15) ys.push(y); if (!ys.length) return null;
    return { type, c, y: pickR(ys, r), target: [3, 3, 4, 5][tier] };
  }
  if (type === "odd") {
    const thr = club ? [5, 4.6, 4.2, 3.8][tier] : [5.6, 5.2, 4.8, 4.4][tier], sets = [];
    let ins, outs, q;
    if (club) {
      ins = clubPl[C].filter(i => fame(i) >= thr); const lg = PLC.has(C) ? 1 : (PL[clubPl[C][0]][7] & 31) || 1;
      outs = ALLIDX.filter(i => fame(i) >= thr && !hasClub(i, C) && (PL[i][7] & lg)); q = `Three played for ${CLUB[C]}. Who never did?`;
    } else { ins = ALLIDX.filter(i => fame(i) >= thr && isPLp(i)); outs = ALLIDX.filter(i => fame(i) >= thr + .2 && !isPLp(i) && (PL[i][7] & 30) && !clubsOf(i).some(c => PLC.has(c))); q = "Three played in the Premier League. Who never did?"; }
    if (ins.length < 9 || outs.length < 3) return null;
    const used = new Set();
    for (let g = 0; sets.length < 3 && g < 60; g++) {
      const three = shuffle(ins.filter(i => !used.has(i)), r).slice(0, 3), mid = three.reduce((a, i) => a + PL[i][3], 0) / 3;
      const near = outs.filter(i => !used.has(i) && Math.abs(PL[i][3] - mid) <= 8), o = pickR(near.length ? near : outs, r); if (o === undefined || three.length < 3) continue;
      three.concat(o).forEach(i => used.add(i)); const opts = shuffle(three.concat(o), r); sets.push({ o: opts, x: opts.indexOf(o) });
    }
    return sets.length === 3 ? { type, q, sets, target: 2 } : null;
  }
  if (type === "race") {
    const pool = club ? listsOf(C) : pl ? PLLISTS : BD.lists.map((l, i) => i); if (!pool.length) return null;
    const gap = [4, 3, 2, 1][tier], pairs = []; let guard = 0;
    while (pairs.length < 5 && guard++ < 300) { const li = pickR(pool, r), it = BD.lists[li][3], a = Math.floor(r() * it.length), b = Math.floor(r() * it.length); if (Math.abs(a - b) >= gap && it[a][1] !== it[b][1] && !pairs.some(q => q[0] === li && q.includes(a) && q.includes(b))) pairs.push([li, a, b]); }
    return pairs.length === 5 ? { type, pairs, target: [3, 3, 4, 4][tier] } : null;
  }
  if (type === "champ") {
    const pool = BD.tables.map((t, i) => i).filter(i => club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : (pl ? BD.tables[i][0] === "Premier League" : true) && BD.tables[i][2] <= tier + 1);
    if (pool.length < 2) return null; const pick = shuffle(pool, r).slice(0, 3);
    const qs = pick.map(ti => club ? { t: ti, c: C } : { t: ti, p: tier === 0 ? 0 : tier === 1 ? Math.floor(r() * 2) : Math.floor(r() * 4), o: shuffle([0, 1, 2, 3], r) });
    return { type, qs, target: qs.length >= 3 ? 2 : qs.length };
  }
  return null;
}

/* ============ round runtimes ============ */
function rarity(valid, i) { const k = valid.indexOf(i); return valid.length > 1 && k >= 0 ? k / (valid.length - 1) : 0; }
const rarText = x => x >= .7 ? pickR(SAY.deep) : x >= .35 ? "A decent pull." : "The obvious one. Still counts.";
function nameOne(spec, valid, intro) {      // shared by The Grid and The Link
  const R = { tries: 3, goal: false, pick: -1, over: false, rar: 0, picks: [] };
  R.body = intro;
  R.onPick = i => {
    if (R.over || i < 0) return;
    if (spec.type === "cell" && PL[i][1] < 0 && (spec.a.t === "n" || spec.b.t === "n") && fits(i, spec.a.t === "n" ? spec.b : spec.a)) { msg("No nationality on file for " + PL[i][0] + ". Try someone else.", ""); return; }
    if (valid.includes(i)) { R.goal = true; R.pick = i; R.rar = rarity(valid, i); R.picks = [i]; R.over = true; ctx.done(); }
    else { R.tries--; msg(PL[i][0] + "? " + pickR(SAY.no), "bad"); sfx.no(); if (R.tries <= 0) { R.over = true; ctx.done(); } else ctx.paint(); }
  };
  R.tries$ = () => `<div class="tries">${[0, 1, 2].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${R.tries} ${R.tries === 1 ? "try" : "tries"} left</span></div>`;
  R.end = () => R.goal ? { goal: true, xp: 30 + Math.round(30 * R.rar), deep: R.rar >= .7, html: `<p><b>${esc(PL[R.pick][0])}</b> fits. ${esc(rarText(R.rar))}</p><p>${valid.length} players would have done.</p>` }
    : { goal: false, xp: 0, html: `<p>Would have done: <b>${valid.slice(0, 3).map(i => esc(PL[i][0])).join("</b>, <b>")}</b>${valid.length > 3 ? " and " + (valid.length - 3) + " more" : ""}.</p>` };
  return R;
}
const RUN = {
  cell(spec) { const v = validSet(spec.a, spec.b); const R = nameOne(spec, v, () => `<div class="cats"><div class="cat"><span>${catSub(spec.a)}</span><b>${esc(catLabel(spec.a))}</b></div><div class="amp">+</div><div class="cat"><span>${catSub(spec.b)}</span><b>${esc(catLabel(spec.b))}</b></div></div>${R.tries$()}`); R.rule = spec.a.t === "c" && spec.b.t === "c" ? `Name a player who played for both ${CLUB[spec.a.v]} and ${CLUB[spec.b.v]}.` : `Name a player who ${catPhrase(spec.a)} and ${catPhrase(spec.b)}.`; return R; },
  mates(spec) { const [a, b] = spec.ab || BD.pairs[spec.i], v = ALLIDX.filter(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b)); const R = nameOne(spec, v, () => `<div class="cats"><div class="cat"><span>Team-mate of</span><b>${esc(PL[a][0])}</b></div><div class="amp">+</div><div class="cat"><span>Team-mate of</span><b>${esc(PL[b][0])}</b></div></div>${R.tries$()}`); R.rule = `Name a player who was team-mates with both ${PL[a][0]} and ${PL[b][0]}.`; R.hint = "Same club, same season, 2010 onwards"; return R; },
  top(spec) {
    const L = BD.lists[spec.i], items = L[3], R = { found: {}, n: 0, over: false, picks: [], rule: `Name ${spec.target} players from this top ten.` };
    R.title = L[0];
    R.body = (rev) => `<p class="rule" style="color:var(--text);font-weight:600">${esc(L[0])}</p><div class="slots">${items.map((it, k) => `<div class="slot ${R.found[k] ? "hit" : rev ? "rev" : ""}"><span class="n">${k + 1}</span><span class="p">${R.found[k] || rev ? esc(PL[it[0]][0]) : "—"}</span><span class="v">${it[1]}${L[1] === "€m" ? "m" : ""}</span></div>`).join("")}</div><div class="tries"><span>${R.n} of ${spec.target} needed · ${L[1] === "€m" ? "fees in €m" : L[1]}</span></div>`;
    R.onPick = i => { if (R.over || i < 0) return; const k = items.findIndex(it => it[0] === i); if (k < 0) { msg(PL[i][0] + " isn't in the ten.", "bad"); sfx.no(); return; } if (R.found[k]) { msg("Already got him.", ""); return; } R.found[k] = 1; R.n++; R.picks.push(i); msg(PL[i][0] + ", number " + (k + 1) + ".", "good"); sfx.tick(); if (R.n >= spec.target) { R.over = true; ctx.done(); } else ctx.paint(); };
    R.end = () => ({ goal: R.n >= spec.target, xp: R.n >= spec.target ? 30 + 4 * R.n : 4 * R.n, html: `<p>You named <b>${R.n}</b> of the ten.</p>`, after: R.body(true) });
    return R;
  },
  xi(spec) {
    const X = BD.xi[spec.i], pl = X[6], R = { hit: {}, n: 0, over: false, picks: [], raw: true, rule: `Three players are hidden in this line-up. Name ${spec.target} of them.` };
    const tok = pl.map(p => norm(p[0]).split(" "));
    R.body = (rev) => `<p class="rule" style="color:var(--text);font-weight:600">${esc(X[0])} ${esc(X[2])} ${esc(X[1])}<span class="eyebrow" style="display:block;font-weight:500;margin-top:3px">${esc(X[4])} · ${esc(X[0])}'s starting XI</span></p><div class="pitchwrap">${pl.map((p, k) => { const xy = SB[p[1]] || [50, 50], b = spec.blanks.indexOf(k), sn = p[0].split(" ").slice(-1)[0]; const show = b < 0 || R.hit[k] || rev; return `<span class="pp ${b >= 0 ? (R.hit[k] ? "hit" : rev ? "miss" : "q") : ""}" style="left:${xy[0]}%;top:${100 - xy[1]}%">${show ? esc(b >= 0 ? p[0] : sn) : "?"}</span>`; }).join("")}</div><div class="tries"><span>${R.n} of ${spec.target} needed · surnames are fine</span></div>`;
    R.onPick = (i, raw) => {
      if (R.over) return; const at = norm(i >= 0 ? PL[i][0] : raw).split(" ").filter(Boolean); if (!at.length) return; const al = at[at.length - 1];
      const k = spec.blanks.find(k => { if (R.hit[k]) return false; const t = tok[k], tl = t[t.length - 1]; return tl === al || (at.length === t.length && at.every(x => t.includes(x))) || (at.length === 1 && al.length >= 4 && t.includes(al)); });
      if (k === undefined) { msg((i >= 0 ? PL[i][0] : raw) + " isn't one of the three.", "bad"); sfx.no(); return; }
      R.hit[k] = 1; R.n++; if (i >= 0) R.picks.push(i); msg(pl[k][0] + ". Correct.", "good"); sfx.tick(); if (R.n >= spec.target) { R.over = true; ctx.done(); } else ctx.paint();
    };
    R.end = () => ({ goal: R.n >= spec.target, xp: R.n >= spec.target ? 30 + 5 * R.n : 5 * R.n, html: `<p>You found <b>${R.n}</b> of the three.</p>`, after: R.body(true) });
    return R;
  },
  career(spec) {
    const p = spec.p, a = PL[p][5], path = []; for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
    const sig = i => clubsOf(i).join(","), R = { tries: 2, goal: false, over: false, picks: [], rule: "Whose career is this? Clubs in the order he joined them." };
    R.body = () => `<div class="path">${path.map((c, k) => `${k ? "<i>›</i>" : ""}<span>${esc(CLUB[c[0]])}<em>${c[1] >= 2025 ? "now" : "'" + String(c[1]).slice(2)}</em></span>`).join("")}</div><div class="tries">${[0, 1].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${POSN[PL[p][2]]} · top-league moves since 1992</span></div>`;
    R.onPick = i => { if (R.over || i < 0) return; if (i === p || sig(i) === sig(p)) { R.goal = true; R.picks = [i]; R.over = true; ctx.done(); } else { R.tries--; msg(PL[i][0] + "? " + pickR(SAY.no), "bad"); sfx.no(); if (R.tries <= 0) { R.over = true; ctx.done(); } else ctx.paint(); } };
    R.end = () => ({ goal: R.goal, xp: R.goal ? 30 + (R.tries === 2 ? 10 : 0) : 0, html: `<p>${R.goal ? "Correct:" : "It was"} <b>${esc(PL[p][0])}</b>${PL[p][1] >= 0 ? ", " + esc(NAT[PL[p][1]]) : ""}.</p>` });
    return R;
  },
  hl(spec) {
    const R = { k: 0, ok: 0, res: [], over: false, lock: false, shown: null, picks: [], rule: `Tap the transfer that cost more. Get ${spec.target} of 5 right.` };
    const card = (h, side, rev) => { const t = BD.hl[h]; return `<button class="tc ${rev ? rev : ""}" data-act="tap" data-v="${side}"><b>${esc(PL[t[0]][0])}</b><span>${esc(CLUB[t[1]])} to ${esc(CLUB[t[2]])}, ${t[3]}</span><em>${R.shown !== null ? "€" + t[4] + "m" : ""}</em></button>`; };
    R.body = () => { if (R.k >= 5) return `<div class="pips">${R.res.map(x => `<i class="${x ? "ok" : "no"}"></i>`).join("")}</div>`; const [a, b] = spec.pairs[R.k], fa = BD.hl[a][4], fb = BD.hl[b][4], s = R.shown; return `<div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div><div class="duo">${card(a, 0, s === null ? "" : fa >= fb ? "right" : s === 0 ? "wrong" : "")}${card(b, 1, s === null ? "" : fb >= fa ? "right" : s === 1 ? "wrong" : "")}</div>`; };
    R.onTap = v => { if (R.over || R.lock) return; const [a, b] = spec.pairs[R.k], fa = BD.hl[a][4], fb = BD.hl[b][4], good = (+v === 0) === (fa >= fb); R.res.push(good ? 1 : 0); if (good) { R.ok++; sfx.tick(); } else sfx.no(); R.shown = +v; R.lock = true; ctx.paint(); setTimeout(() => { R.shown = null; R.lock = false; R.k++; if (R.k >= 5) { R.over = true; ctx.done(); } else ctx.paint(); }, 850); };
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 2 * R.ok : 3 * R.ok, html: `<p><b>${R.ok}</b> of ${Math.max(R.res.length, 1)} right.</p>` });
    return R;
  },
  squad(spec) {
    const c = spec.c, v = squadOf(c, spec.y).sort((a, b) => PL[b][4] - PL[a][4]), lab = sqLabel(spec.y), R = { found: [], over: false, picks: [], rule: `Name ${spec.target} players who were in the ${CLUB[c]} squad in ${lab}.` };
    R.title = CLUB[c] + " " + lab;
    R.body = (rev) => `<p class="rule" style="color:var(--text);font-weight:600">${esc(CLUB[c])} squad · ${lab}</p><div class="chips">${R.found.map(i => `<span class="hit">${esc(PL[i][0])}</span>`).join("")}${rev ? "" : Array.from({ length: Math.max(0, spec.target - R.found.length) }, () => "<span>?</span>").join("")}</div>${rev ? `<p class="note">Also in it: <b>${v.filter(i => !R.found.includes(i)).slice(0, 6).map(i => esc(PL[i][0])).join("</b>, <b>")}</b> and ${Math.max(0, v.length - R.found.length - 6)} more.</p>` : ""}<div class="tries"><span>${R.found.length} of ${spec.target} · anyone on the books that season</span></div>`;
    R.onPick = i => { if (R.over || i < 0) return; if (R.found.includes(i)) { msg("Already got him.", ""); return; } if (!v.includes(i)) { msg(PL[i][0] + " wasn't in that squad.", "bad"); sfx.no(); return; } R.found.push(i); R.picks.push(i); msg(PL[i][0] + ". " + (rarity(v, i) >= .7 ? pickR(SAY.deep) : "In."), "good"); sfx.tick(); if (R.found.length >= spec.target) { R.over = true; ctx.done(); } else ctx.paint(); };
    R.end = () => { const n = R.found.length, deep = R.found.some(i => rarity(v, i) >= .7); return { goal: n >= spec.target, deep, xp: n >= spec.target ? 30 + 5 * n + (deep ? 15 : 0) : 5 * n, html: `<p>You named <b>${n}</b> of ${spec.target}.${deep ? " One proper deep cut in there." : ""}</p>`, after: R.body(true) }; };
    return R;
  },
  odd(spec) {
    const N = spec.sets.length, R = { k: 0, ok: 0, res: [], over: false, lock: false, shown: null, picks: [], rule: spec.q.replace(/^Three played for (.*)\. Who never did\?$/, "Tap the one who never played for $1.").replace(/^Three played in the Premier League\. Who never did\?$/, "Tap the one who never played in the Premier League.") + ` Get ${spec.target} of ${N} right.` };
    const pips = () => `<div class="pips">${spec.sets.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    R.body = () => { if (R.k >= N) return pips(); const st = spec.sets[R.k], s = R.shown; return pips() + `<div class="quad">${st.o.map((i, j) => `<button class="tc ${s === null ? "" : j === st.x ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(PL[i][0])}</b><span>${POSN[PL[i][2]]}${PL[i][3] > 0 ? " · b. " + (1900 + PL[i][3]) : ""}</span><em>${s !== null && j === st.x ? "Odd one" : ""}</em></button>`).join("")}</div>`; };
    R.onTap = v => { if (R.over || R.lock) return; const st = spec.sets[R.k], good = +v === st.x; R.res.push(good ? 1 : 0); if (good) { R.ok++; sfx.tick(); } else sfx.no(); R.shown = +v; R.lock = true; ctx.paint(); setTimeout(() => { R.shown = null; R.lock = false; R.k++; if (R.k >= N) { R.over = true; ctx.done(); } else ctx.paint(); }, 1100); };
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 5 * R.ok : 5 * R.ok, html: `<p><b>${R.ok}</b> of ${N} right.</p>`, after: `<div class="panel pad"><p class="note">${spec.sets.map(st => "<b>" + esc(PL[st.o[st.x]][0]) + "</b>").join(", ")} were the odd ones out.</p></div>` });
    return R;
  },
  race(spec) {
    const verb = L => L[1] === "goals" ? "scored more" : L[1] === "assists" ? "had more assists" : L[1] === "apps" ? "made more appearances" : "cost more";
    const R = { k: 0, ok: 0, res: [], over: false, lock: false, shown: null, picks: [], rule: `Tap the player with the bigger number. Get ${spec.target} of 5 right.` };
    const pips = () => `<div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    R.body = () => { if (R.k >= 5) return pips(); const [li, a, b] = spec.pairs[R.k], L = BD.lists[li], it = L[3], s = R.shown, win = it[a][1] > it[b][1] ? 0 : 1, u = L[1] === "€m" ? "m" : " " + L[1];
      const card = (k, side) => `<button class="tc ${s === null ? "" : side === win ? "right" : s === side ? "wrong" : ""}" data-act="tap" data-v="${side}"><b>${esc(PL[it[k][0]][0])}</b><em>${s !== null ? (L[1] === "€m" ? "€" : "") + it[k][1] + u : ""}</em></button>`;
      return pips() + `<p class="ask">Who ${verb(L)}?<span>${esc(L[0])}</span></p><div class="duo">${card(a, 0)}${card(b, 1)}</div>`; };
    R.onTap = v => { if (R.over || R.lock) return; const [li, a, b] = spec.pairs[R.k], it = BD.lists[li][3], good = (+v === 0) === (it[a][1] > it[b][1]); R.res.push(good ? 1 : 0); if (good) { R.ok++; sfx.tick(); } else sfx.no(); R.shown = +v; R.lock = true; ctx.paint(); setTimeout(() => { R.shown = null; R.lock = false; R.k++; if (R.k >= 5) { R.over = true; ctx.done(); } else ctx.paint(); }, 950); };
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 2 * R.ok : 3 * R.ok, html: `<p><b>${R.ok}</b> of 5 right.</p>` });
    return R;
  },
  champ(spec) {
    const N = spec.qs.length, R = { k: 0, ok: 0, res: [], over: false, lock: false, shown: null, picks: [], rule: `Tap the right answer. Get ${spec.target} of ${N} right.` };
    const pips = () => `<div class="pips">${spec.qs.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    const ans = q => q.c !== undefined ? BD.tables[q.t][3].findIndex(x => x[0] === CLUB[q.c]) : q.o.indexOf(q.p);
    R.body = () => { if (R.k >= N) return pips(); const q = spec.qs[R.k], T = BD.tables[q.t], s = R.shown, a = ans(q);
      const head = q.c !== undefined ? `Where did ${esc(CLUB[q.c])} finish?` : `Who finished ${ord(q.p + 1)}?`;
      const opts = q.c !== undefined ? [0, 1, 2, 3].map(k => ({ b: ord(k + 1), e: T[3][k][1] + " pts" })) : q.o.map(k => ({ b: T[3][k][0], e: ord(k + 1) + " · " + T[3][k][1] + " pts" }));
      return pips() + `<p class="ask">${head}<span>${esc(T[0])} ${seasonLabel(T[1])}</span></p><div class="quad">${opts.map((o, j) => `<button class="tc ${s === null ? "" : j === a ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(o.b)}</b><em>${s !== null ? esc(o.e) : ""}</em></button>`).join("")}</div>`; };
    R.onTap = v => { if (R.over || R.lock) return; const good = +v === ans(spec.qs[R.k]); R.res.push(good ? 1 : 0); if (good) { R.ok++; sfx.tick(); } else sfx.no(); R.shown = +v; R.lock = true; ctx.paint(); setTimeout(() => { R.shown = null; R.lock = false; R.k++; if (R.k >= N) { R.over = true; ctx.done(); } else ctx.paint(); }, 1100); };
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 6 * R.ok : 6 * R.ok, html: `<p><b>${R.ok}</b> of ${N} right.</p>` });
    return R;
  },
  season(spec) {
    const T = BD.tables[spec.i], ys = BD.tables.filter(t => t[0] === T[0]).map(t => t[1]), lo = Math.min(...ys), hi = Math.max(...ys), R = { val: Math.round((lo + hi) / 2), over: false, locked: false, picks: [], rule: "Which season ended with this top four? Slide to the year, then lock it in.", hint: T[0] + (spec.tol ? " · one year either side still scores" : " · exact year only") };
    R.body = (rev) => `<div class="panel"><table class="tbl"><tr><th></th><th>Club</th><th>GF</th><th>GA</th><th>PTS</th></tr>${T[3].map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r[0])}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[1]}</td></tr>`).join("")}</table><div class="key">Relegated: ${T[4].map(esc).join(", ")}</div></div>${rev ? "" : `<div class="season"><output id="slo">${seasonLabel(R.val)}</output><input type="range" id="sl" min="${lo}" max="${hi}" value="${R.val}" aria-label="Season"><button class="btn" data-act="tap" data-v="lock">Lock it in</button></div>`}`;
    R.onInput = v => { R.val = +v; const o = $("slo"); if (o) o.textContent = seasonLabel(R.val); };
    R.onTap = () => { if (R.over) return; R.locked = true; R.over = true; ctx.done(); };
    R.end = () => { const d = R.locked ? Math.abs(R.val - T[1]) : 99; return { goal: d <= spec.tol, xp: d === 0 ? 50 : d <= spec.tol ? 30 : 0, html: `<p>It was <b>${seasonLabel(T[1])}</b>. ${R.locked ? "You said " + seasonLabel(R.val) + "." : "You never locked one in."}</p>` }; };
    return R;
  }
};

/* ============ match engine ============ */
let M = null, ctx = null, raf = 0, view = "home", leagueTab = "table";
const sfx = (() => { let ac = null; const tone = (f, d, v = .04, type = "triangle", w = 0) => { if (!S.sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime + w); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + w + d); o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + w); o.stop(ac.currentTime + w + d); } catch (e) { } }; return { tick: () => tone(740, .07), no: () => tone(150, .18, .05, "sawtooth"), goal: () => { tone(523, .12, .06); tone(784, .22, .06, "triangle", .1); }, whistle: () => { tone(2100, .5, .02, "sine"); tone(2140, .5, .02, "sine"); } }; })();
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; $("toasts").appendChild(d); setTimeout(() => d.remove(), 3300); }
function msg(t, cls) { const m = $("msg"); if (m) { m.textContent = t; m.className = "msg " + (cls || ""); } }
const QV = "v2|";   // question-generator version: ghosts only replay matches built by this version
function startLeagueMatch() {
  settleSeason(); const opp = nextOpponent(), tier = tierOf(S.div);
  let seed = QV + S.season + "-" + S.div + "-" + S.week.pl + "-" + S.salt, ghost = null;
  if (opp.real && opp.g) { const k = Object.keys(opp.g).find(k => k.indexOf(QV) === 0 && !S.played.includes(k) && Array.isArray(opp.g[k]) && opp.g[k].length === 5 && k.split("-")[1] === String(S.div)); if (k) { seed = k; ghost = opp.g[k]; } }
  if (!ghost) seed = freshSeed(seed, tier);
  const r = rngOf(hash("o" + seed + opp.id)), p = Math.max(.2, Math.min(.85, .3 + .05 * S.div + ((opp.s === undefined ? .5 : opp.s) - .5) * .26));
  const oppRes = ghost ? ghost.map(x => x ? 1 : 0) : [0, 1, 2, 3, 4].map(() => r() < p ? 1 : 0);
  M = { mode: "league", seed, tier, opp, oppRes, ghost: !!ghost, rounds: makeMatch(seed, tier), i: 0, my: [], out: [], xp: 0, picks: [], deep: 0 };
  view = "match"; chanceCover();
}
/* ============ club cup: your club's questions, against fellow fans of the same club ============ */
function cupFans() {
  const real = Net.rows.filter(r => r && r.c === S.club && r.id !== Net.uid && r.n).map(r => ({ id: r.id, name: String(r.n).slice(0, 18), real: true, s: Math.min(1, (r.xp | 0) / 4000) }));
  const sid = S.club + "-" + S.cup.runs + "-" + S.salt, house = shuffle(FANS, rngOf(hash("cf" + sid))).slice(0, 4).map((n, k) => ({ id: "f" + k, name: n, s: [.3, .45, .6, .75][k] }));
  const rr = shuffle(real, rngOf(hash("cr" + sid)));
  return [0, 1, 2, 3].map(k => rr[k] ? Object.assign({}, rr[k], { s: Math.max(rr[k].s, house[k].s) }) : house[k]);
}
function cupSync() { if (S.cup.club !== S.club) { S.cup.club = S.club; S.cup.rd = 0; } }
function makeCupMatch(seed, c, tier) {
  const r = rngOf(hash("cup" + seed)), out = [], used = new Set();
  const order = shuffle(["cell", "squad", "odd", "career", "mates", "top", "race", "xi", "hl", "champ", "season"], r);
  for (const t of order) { if (out.length >= 5) break; if (t === "season" && used.has("champ") || t === "champ" && used.has("season")) continue; const x = makeRound(t, r, tier, { club: c }); if (x) { out.push(x); used.add(t); } }
  while (out.length < 5) out.push(makeRound("cell", r, tier, { club: c }) || makeCell(r, tier));
  return out;
}
function startCupMatch() {
  cupSync(); const c = clubIdx(S.club); if (c < 0) { toast("Pick a club in your profile first"); return; }
  const rd = S.cup.rd, opp = cupFans()[rd], tier = Math.min(3, tierOf(S.div) + (rd >= 2 ? 1 : 0)), seed = S.club + "-" + S.cup.runs + "-" + rd + "-" + S.salt;
  const r = rngOf(hash("co" + seed)), p = Math.max(.25, Math.min(.8, .3 + .08 * rd + (opp.s - .5) * .3)), oppRes = [0, 1, 2, 3, 4].map(() => r() < p ? 1 : 0);
  M = { mode: "cup", seed, tier, opp, oppRes, rounds: makeCupMatch(seed, c, tier), i: 0, my: [], out: [], xp: 0, picks: [], deep: 0, pr: r, club: c };
  view = "match"; chanceCover();
}
function cupContinue() {
  const a = M.my.reduce((s, x) => s + x, 0), b = M.oppRes.reduce((s, x) => s + x, 0);
  if (a === b && M.rounds.length < 10) { const t = pickR(["odd", "race", "champ", "cell"], M.pr); M.rounds.push(makeRound(t, M.pr, M.tier, { club: M.club }) || makeRound("cell", M.pr, M.tier, { club: M.club }) || makeCell(M.pr, M.tier)); M.oppRes.push(M.pr() < .6 ? 1 : 0); chanceCover(); }
  else cupFullTime();
}
function cupFullTime() {
  const a = M.my.reduce((s, x) => s + x, 0), b0 = M.oppRes.reduce((s, x) => s + x, 0), coin = a === b0, win = coin ? M.pr() < .5 : a > b0, b = b0, rdName = CUPR[S.cup.rd], pens = M.rounds.length > 5;
  const lines = [["Chances", M.xp]]; let head, sub;
  if (win) { S.cup.w++; if (S.cup.rd === 3) { S.cup.won++; S.cup.best = 4; S.cup.rd = 0; S.cup.runs++; lines.push(["Cup winners", 200]); head = "Cup winners"; sub = "Lift it. Nobody at your club knows more."; } else { S.cup.rd++; S.cup.best = Math.max(S.cup.best, S.cup.rd); lines.push(["Through to the " + CUPR[S.cup.rd].toLowerCase(), 40 + 20 * S.cup.rd]); head = "Through"; sub = "Next up: the " + CUPR[S.cup.rd].toLowerCase() + "."; } }
  else { S.cup.l++; S.cup.best = Math.max(S.cup.best, S.cup.rd); S.cup.rd = 0; S.cup.runs++; lines.push(["Cup run", 10]); head = "Knocked out"; sub = "Out in the " + rdName.toLowerCase() + ". A new run starts from the round of 16."; }
  const tot = lines.reduce((s, l) => s + l[1], 0); addXp(tot); S.st.goals += a; S.st.deep += M.deep; M.picks.forEach(() => { }); save(true); sfx.whistle();
  const lv = levelOf(S.xp), l0 = levelAt(lv - 1), l1 = levelAt(lv); view = "ft";
  SHARE = `BOFFIN CLUB CUP · ${S.club} · ${rdName}\n${S.name || "Me"} ${a}–${b} ${M.opp.name}${pens ? " (pens)" : ""}\n${pips(M.my)}\n${head === "Cup winners" ? "🏆 CUP WINNERS. Biggest " + S.club + " brain going." : head === "Through" ? "Through to the " + CUPR[S.cup.rd].toLowerCase() + " ✅" : "Knocked out ❌"}\nThink you know ${S.club} better? ${"https://claude.ai/artifact/CMDWQKJMC8Cj6GzL9AUvM4"}`;
  $("main").innerHTML = `<div class="panel ft"><span class="eyebrow">Club Cup · ${esc(S.club)} · ${esc(rdName)}</span><div class="res ${win ? "W" : "L"}">${esc(head)}</div><p class="note">${a}–${b}${pens ? " after penalties" : ""}${coin ? ", settled on a coin toss" : ""}. ${esc(sub)}</p></div>
  <div class="vidi" id="vidi"></div>
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${tot}</b></div></div><div style="margin-top:10px"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(l1 - S.xp)}</b> XP to level ${lv + 1}</span></div><div class="bar" style="margin-top:6px"><i id="xpb"></i></div></div></div>
  <div class="panel pad"><div class="statline"><span>Cups won <b>${S.cup.won}</b></span><span>Cup ties <b>${S.cup.w}W ${S.cup.l}L</b></span><span>Best <b>${S.cup.best >= 4 ? "Winners" : S.cup.best >= 0 ? CUPR[S.cup.best] : "—"}</b></span></div></div>
  <button class="btn" data-act="cup">${win && head !== "Cup winners" ? "Play the " + CUPR[S.cup.rd].toLowerCase() : "Start a new cup run"}</button>${shareBtns()}<button class="btn line" data-act="go" data-v="home">Home</button>
  <div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out.map((o, k) => `<div><span class="m">${mnS(k)}</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`).join("")}</div></div>`;
  vidi($("vidi"), `FT  ${(S.name || "YOU")} ${a}  ${M.opp.name} ${b}${pens ? "  (PENS)" : ""}`);
  requestAnimationFrame(() => { const x = $("xpb"); if (x) x.style.width = Math.max(2, Math.min(100, (S.xp - l0) / (l1 - l0) * 100)) + "%"; });
  window.scrollTo(0, 0);
}
function cupCard() {
  cupSync(); const rd = S.cup.rd, opp = cupFans()[rd];
  return `<div class="panel fix"><div class="statline"><span>Club Cup · ${esc(S.club)} fans only</span><span>Cups won <b>${S.cup.won}</b></span></div>
   <div class="vs"><div class="t">${esc(S.name || "You")}<small>${esc(S.club)} fan</small></div><div class="v">v</div><div class="t">${esc(opp.name)}<small>${opp.real ? "REAL FAN" : esc(S.club).toUpperCase() + " FAN" + (Net.ready ? "" : " · HOUSE")}</small></div></div>
   <div class="cupsteps">${CUPR.map((n, k) => `<i class="${k < rd ? "done" : k === rd ? "on" : ""}">${["R16", "QF", "SF", "Final"][k]}</i>`).join("")}</div>
   <button class="btn line" data-act="cup">Play the ${esc(CUPR[rd].toLowerCase())}<small>Five ${esc(S.club)} questions. Lose and you're out.</small></button></div>`;
}
function startTraining(type) { M = { mode: "train", type, tier: tierOf(S.div), i: 0, my: [], out: [], xp: 0, picks: [], rounds: [], seedR: rngOf(Math.floor(Math.random() * 4e9)) }; view = "match"; chanceCover(); }
function curSpec() { if (M.mode === "train") { if (!M.rounds[M.i]) M.rounds[M.i] = makeRound(M.type, M.seedR, M.tier, M.seedR() < .7 ? { pl: 1 } : null); } return M.rounds[M.i]; }
function scoreHTML() {
  if (M.mode === "train") return `<div class="score"><button class="x" data-act="quit" aria-label="Leave">×</button><span class="nm">Training</span><span class="sc">${M.my.filter(x => x).length}/${M.my.length}</span><span class="nm">${esc(TYPES[M.type].n)}</span><span class="min">#${M.i + 1}</span></div>`;
  const a = M.my.reduce((s, x) => s + x, 0), b = M.oppRes.slice(0, M.my.length).reduce((s, x) => s + x, 0);
  return `<div class="score"><button class="x" data-act="quit" aria-label="Leave">×</button><span class="nm">${esc(S.name || "You")}</span><span class="sc">${a}–${b}</span><span class="nm">${esc(M.opp.name)}</span><span class="min">${M.i < M.rounds.length ? mnS(M.i) : "FT"}</span></div>`;
}
function chLbl(min) { if (M.mode === "train") return "Training"; if (M.i >= 5) return "Penalty " + (M.i - 4) + " · sudden death"; return (M.mode === "cup" ? esc(CUPR[S.cup.rd]) + " · " : "") + "Chance " + (M.i + 1) + " of 5" + (min ? " · " + MINS[M.i] + "'" : ""); }
function chanceCover() {
  document.getElementById("app").classList.remove("q"); document.getElementById("app").classList.add("focus"); cancelAnimationFrame(raf);
  const spec = curSpec(), T = TYPES[spec.type], run = RUN[spec.type](spec); M.run = run;
  $("main").innerHTML = `<div class="board">${scoreHTML()}<div class="clock"><i id="clk"></i></div></div>
  <div class="chance"><h3>${esc(T.n)}</h3><span class="eyebrow">${chLbl(true)}</span></div>
  <p class="rule qq">${esc(run.rule || T.rule)}${run.hint ? `<span>${esc(run.hint)}</span>` : ""}</p>
  <div class="panel pad"><p class="note">${M.i >= 5 ? "<b>Penalties.</b> Sudden death. Score and hope they miss. " : ""}${T.t * (M.mode === "train" ? 1.5 : 1)} seconds on the clock once you start.${M.i === 0 && M.mode === "league" ? " <b>" + esc(M.opp.name) + "</b> " + (M.ghost ? "took these same five chances earlier." : "get five chances of their own.") : ""}${M.i === 0 && M.mode === "cup" ? " <b>" + esc(M.opp.name) + "</b> is a " + esc(S.club) + " fan too, so it's all " + esc(S.club) + " questions. Lose and you're out." : ""}</p></div>
  <button class="btn" data-act="take">${M.i === 0 ? "Kick off" : "Take it"}</button>`;
  window.scrollTo(0, 0);
}
function takeChance() {
  const spec = curSpec(), T = TYPES[spec.type], run = M.run; markSeen(spec);
  $("main").innerHTML = `<div class="board">${scoreHTML()}<div class="clock"><i id="clk"></i></div></div>
  <div class="chance"><h3>${esc(T.n)}</h3><span class="eyebrow">${chLbl(false)}</span></div>
  <p class="rule qq">${esc(run.rule || T.rule)}${run.hint ? `<span>${esc(run.hint)}</span>` : ""}</p>
  ${T.typed ? `<div class="entry"><input id="q" type="text" placeholder="${spec.type === "xi" ? "Type a surname" : "Type a player's name"}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><div class="sug" id="sug" hidden></div></div>` : ""}
  <p class="msg" id="msg"></p><div id="rbody"></div>`;
  document.getElementById("app").classList.add("q");
  ctx = { paint: () => { const b = $("rbody"); if (b) b.innerHTML = run.body(false); }, done: () => endChance() };
  ctx.paint(); M.t0 = Date.now(); M.limit = T.t * 1000 * (M.mode === "train" ? 1.5 : 1); M.live = true;
  const q = $("q"); if (q) { try { q.focus({ preventScroll: true }); } catch (e) { try { q.focus(); } catch (e2) { } } }
  cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
}
function tick() { if (!M || !M.live) return; const left = Math.max(0, M.limit - (Date.now() - M.t0)), c = $("clk"); if (c) { c.style.transform = "scaleX(" + left / M.limit + ")"; c.parentNode.classList.toggle("low", left < 5000); } if (left <= 0) { M.timeout = true; endChance(); return; } raf = requestAnimationFrame(tick); }
function vidi(el, text) { let k = 0; el.innerHTML = '<span class="cur"></span>'; (function step() { if (!el.isConnected) return; k += 2; el.innerHTML = esc(text.slice(0, k)) + '<span class="cur"></span>'; if (k < text.length) setTimeout(step, 22); })(); }
function endChance() {
  if (!M || !M.live) return; M.live = false; cancelAnimationFrame(raf); document.getElementById("app").classList.remove("q");
  const run = M.run, res = run.end(), spec = curSpec(), T = TYPES[spec.type], q = $("q"); if (q) q.blur();
  M.my.push(res.goal ? 1 : 0); M.xp += res.xp; if (res.deep) M.deep++;
  let newN = 0; (run.picks || []).forEach(i => { M.picks.push(i); if (addAlbum(i)) newN++; });
  M.out.push({ n: T.n, goal: res.goal, title: run.title || "" });
  if (res.goal) sfx.goal(); else sfx.no();
  const train = M.mode === "train", og = train ? 0 : M.oppRes[M.i], a = M.my.reduce((s, x) => s + x, 0), b = train ? 0 : M.oppRes.slice(0, M.i + 1).reduce((s, x) => s + x, 0);
  if (train) addXp(res.goal ? 12 : 2);
  const last = !train && M.i === M.rounds.length - 1;
  $("main").innerHTML = `<div class="board">${scoreHTML()}</div>
  <div class="verdict ${res.goal ? "goal" : "nogoal"}"><div class="big">${res.goal ? "Goal" : M.timeout && !res.goal ? "Time's up" : "No goal"}</div>${res.html}${M.timeout && !res.goal ? `<p>${esc(pickR(SAY.slow))}</p>` : ""}${newN ? `<p>${newN} new ${newN === 1 ? "name" : "names"} for the album.</p>` : ""}</div>
  ${res.after ? `<div>${res.after}</div>` : ""}
  ${train ? "" : `<div class="vidi" id="vidi"></div>`}
  <button class="btn" data-act="cont">${last ? "Full time" : train ? "Next one" : "Next chance"}</button>${train ? `<button class="btn line" data-act="quit">Finish training</button>` : ""}`;
  M.timeout = false; M.i++;
  if (!train) vidi($("vidi"), `${mnS(M.i - 1)} ${res.goal ? "GOAL " + (S.name || "YOU") : "CHANCE MISSED " + (S.name || "YOU")}\n${mnO(M.i - 1)} ${og ? "GOAL " + M.opp.name : M.opp.name + " WASTE THEIRS"}\n${(S.name || "YOU")} ${a} ${M.opp.name} ${b}`);
  save(); window.scrollTo(0, 0);
}
let SHARE = "";
const pips = arr => arr.map(x => x ? "🟩" : "⬛").join("");
function shareBtns() { return `<div class="row"><button class="btn line" data-act="share">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(SHARE)}" target="_blank" rel="noopener">WhatsApp</a></div>`; }
function doShare() {
  const fail = () => { $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Your result</span><textarea class="sharebox" readonly>${esc(SHARE)}</textarea><p class="note">Press and hold to copy it.</p><button class="btn line" data-act="closeover">Close</button></div></div>`; };
  try { navigator.clipboard.writeText(SHARE).then(() => toast("Result copied. Paste it in the group chat."), fail); } catch (e) { fail(); }
}
function fullTime() {
  const a = M.my.reduce((s, x) => s + x, 0), b = M.oppRes.reduce((s, x) => s + x, 0), res = a > b ? "W" : a < b ? "L" : "D";
  const before = myPos(leagueTable());
  const w = S.week; w.pl++; w.gf += a; w.ga += b; if (res === "W") { w.w++; w.pts += 3; } else if (res === "D") { w.d++; w.pts++; } else w.l++;
  const cw = cwNow(); cw.gf += a; cw.pts += res === "W" ? 3 : res === "D" ? 1 : 0;
  S.form = S.form.concat(res).slice(-5); S.g[M.seed] = M.my.slice(); const gk = Object.keys(S.g); while (gk.length > 8) delete S.g[gk.shift()]; S.played = S.played.concat(M.seed).slice(-60);
  S.st.m++; if (res === "W") S.st.w++; S.st.goals += a; S.st.deep += M.deep;
  const lines = [["Chances", M.xp], [res === "W" ? "Win" : res === "D" ? "Draw" : "Turning up", res === "W" ? 60 : res === "D" ? 25 : 10]]; if (res === "W" && b === 0) lines.push(["Clean sheet", 20]); if (a === 5) lines.push(["Five from five", 40]);
  const tot = lines.reduce((s, l) => s + l[1], 0); addXp(tot);
  const after = myPos(leagueTable()), divName = DIVS[S.div], pl = w.pl, pts = w.pts, ended = settleSeason(); save(true); sfx.whistle();
  const sp = n => n >= 4 ? ` (${WORDS[n]})` : "", lv = levelOf(S.xp), l0 = levelAt(lv - 1), l1 = levelAt(lv);
  view = "ft";
  SHARE = `BOFFIN MATCHDAY · ${divName}\n${S.name || "Me"} ${a}–${b} ${M.opp.name} ${res === "W" ? "✅" : res === "D" ? "🤝" : "❌"}\n${pips(M.my)}\nLevel ${levelOf(S.xp)} · ${S.club} fan\nDo you know ball? ${"https://claude.ai/artifact/CMDWQKJMC8Cj6GzL9AUvM4"}`;
  $("main").innerHTML = `<div class="panel ft"><span class="eyebrow">Full time · ${esc(divName)}</span><div class="res ${res}">${res === "W" ? "Won" : res === "D" ? "Drew" : "Lost"} ${a}–${b}</div><p class="note">${esc(pickR(SAY[res]))}</p></div>
  <div class="vidi" id="vidi"></div>
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${tot}</b></div></div><div style="margin-top:10px"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(l1 - S.xp)}</b> XP to level ${lv + 1}</span></div><div class="bar" style="margin-top:6px"><i id="xpb"></i></div></div></div>
  <div class="panel pad"><div class="statline"><span>${esc(divName)} · ${pl} of ${SEASON} played</span><span><b>${ord(after)}</b> of 20${after < before ? " · up " + (before - after) : after > before ? " · down " + (after - before) : ""}</span><span><b>${pts}</b> pts</span></div></div>
  ${ended ? `<div class="panel pad" style="border-color:var(--amber)"><span class="eyebrow" style="color:var(--amber)">Season over</span><p class="note" style="margin-top:6px">${noteText()}</p></div>` : ""}
  <button class="btn" data-act="kick">${ended ? "Start the new season" : "Next fixture"}</button>${shareBtns()}<div class="row"><button class="btn line" data-act="go" data-v="league">Table</button><button class="btn line" data-act="go" data-v="home">Home</button></div>
  <div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out.map((o, k) => `<div><span class="m">${MINS[k]}'</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`).join("")}</div></div>`;
  vidi($("vidi"), `FT  ${(S.name || "YOU")} ${a}${sp(a)}  ${M.opp.name} ${b}${sp(b)}`);
  requestAnimationFrame(() => { const x = $("xpb"); if (x) x.style.width = Math.max(2, Math.min(100, (S.xp - l0) / (l1 - l0) * 100)) + "%"; });
  window.scrollTo(0, 0);
}

/* ============ daily grid ============ */
const gridNo = () => Math.max(1, Math.round((new Date(dayKey() + "T12:00:00") - new Date("2026-11-11T12:00:00")) / 864e5) + 1);
function dailyGrid() {
  const gc = BD.gridClubs.slice(0, 30), gn = BD.gridNats.slice(0, 14);
  for (let t = 0; t < 400; t++) {
    const r = rngOf(hash("grid" + dayKey() + "-" + t)), rows = shuffle(gc, r).slice(0, 3).map(v => ({ t: "c", v })), cols = [];
    const c1 = shuffle(gc.filter(v => !rows.some(x => x.v === v)), r); cols.push({ t: "c", v: c1[0] }); cols.push(r() < .5 ? { t: "c", v: c1[1] } : { t: "n", v: pickR(gn, r) });
    const x = r(); cols.push(x < .6 ? { t: "n", v: pickR(gn, r) } : x < .85 ? { t: "l", v: Math.floor(r() * 5) } : { t: "g", v: 0 });
    if (sameCat(cols[1], cols[2])) continue;
    if (rows.every(a => cols.every(b => validSet(a, b).length >= 4))) return { rows, cols };
  }
  return { rows: [0, 1, 2].map(k => ({ t: "c", v: BD.gridClubs[k] })), cols: [3, 4, 5].map(k => ({ t: "c", v: BD.gridClubs[k] })) };
}
let GRID = null, gridCell = -1;
const gridState = () => { const k = dayKey(); if (!S.grid[k]) { S.grid = { [k]: { c: [null, null, null, null, null, null, null, null, null], left: 9, r: [0, 0, 0, 0, 0, 0, 0, 0, 0], xp: 0 } }; } return S.grid[k]; };
function gridPick(i) {
  const g = gridState(), a = GRID.rows[Math.floor(gridCell / 3)], b = GRID.cols[gridCell % 3], v = validSet(a, b);
  if (g.c.includes(pkey(i))) { msg("Already used him today.", ""); return; }
  if (PL[i][1] < 0 && (b.t === "n") && fits(i, a)) { msg("No nationality on file for " + PL[i][0] + ". Try someone else.", ""); return; }
  g.left--;
  if (v.includes(i)) { g.c[gridCell] = pkey(i); g.r[gridCell] = Math.round(rarity(v, i) * 100); addAlbum(i); const x = 20 + Math.round(g.r[gridCell] * .3); g.xp += x; addXp(x); sfx.goal(); $("over").innerHTML = ""; if (g.c.every(x => x) || g.left <= 0) { S.st.grids++; } save(true); render(); toast(PL[i][0] + (g.r[gridCell] >= 70 ? ". Deep cut." : ". In.")); }
  else { sfx.no(); save(); if (g.left <= 0) { S.st.grids++; $("over").innerHTML = ""; render(); } else { msg(PL[i][0] + "? " + pickR(SAY.no) + " " + g.left + " guesses left.", "bad"); const q = $("q"); if (q) { q.value = ""; $("sug").hidden = true; } } }
}
function renderGrid() {
  GRID = GRID && GRID.day === dayKey() ? GRID : Object.assign(dailyGrid(), { day: dayKey() });
  const g = gridState(), done = g.left <= 0 || g.c.every(x => x), got = g.c.filter(x => x).length, obs = got ? Math.round(g.r.reduce((s, x) => s + x, 0) / got) : 0;
  let h = `<div class="hd"><h2>Daily Grid No. ${gridNo()}</h2><span class="eyebrow">${done ? "Finished" : g.left + " guesses left"}</span></div><div class="grid"><div></div>${GRID.cols.map(c => `<div class="gh">${esc(catLabel(c))}</div>`).join("")}`;
  GRID.rows.forEach((a, ri) => { h += `<div class="gh">${esc(catLabel(a))}</div>`; GRID.cols.forEach((b, ci) => { const k = ri * 3 + ci, v = g.c[k]; h += v ? `<div class="gc done"><b>${esc(v.split("|")[0])}</b><span>${g.r[k]}% obscure</span></div>` : done ? `<div class="gc"><span style="color:var(--mute)">${esc((x => x.length ? PL[x[0]][0] : "")(validSet(a, b)))}</span></div>` : `<button class="gc open" data-act="cell" data-v="${k}" aria-label="${esc(catLabel(a))} and ${esc(catLabel(b))}"><span class="plus">+</span></button>`; }); });
  h += `</div><p class="note">One player per square, nine guesses, nobody twice. Clubs count from 1992 where the records reach; the more obscure the answer, the better the score.</p>`;
  if (done) h += `<div class="panel pad"><div class="statline"><span><b>${got}</b> of 9</span><span>Obscurity <b>${obs}%</b></span><span><b>+${g.xp}</b> XP</span></div></div><button class="btn" data-act="sharegrid">Copy result</button><p class="note">Greyed squares show the answer most people would have given. A new grid lands at midnight.</p>`;
  $("main").innerHTML = h;
}

/* ============ screens ============ */
function chrome() {
  $("who").innerHTML = `<b>${esc(S.name || "Sign on")}</b><span class="lv">LV ${levelOf(S.xp)}</span>`;
  const g = S.grid[dayKey()], gridOpen = !g || (g.left > 0 && !g.c.every(x => x));
  $("tabs").innerHTML = [["home", "Matchday"], ["league", "League"], ["grid", "Grid"], ["album", "Album"]].map(t => `<button class="tab ${view === t[0] ? "on" : ""}" data-act="go" data-v="${t[0]}">${t[1]}${t[0] === "grid" && gridOpen ? "<em></em>" : ""}</button>`).join("");
  document.getElementById("app").classList.toggle("focus", view === "match" || view === "ft");
  if (view !== "match") document.getElementById("app").classList.remove("q");
}
const noteText = () => S.note ? `You finished <b>${ord(S.note.pos)}</b> with ${S.note.pts} points. ${S.note.to > S.note.from ? "Promoted to <b>" + esc(DIVS[S.note.to]) + "</b>. Onwards." : S.note.to < S.note.from ? "Relegated to <b>" + esc(DIVS[S.note.to]) + "</b>. It happens to the best of them." : "You stay in <b>" + esc(DIVS[S.note.to]) + "</b>."}` : "";
function countdown() { const left = (7 - daysIn()) * 24; return left >= 24 ? Math.floor(left / 24) + "d " + Math.floor(left % 24) + "h" : Math.floor(left) + "h " + pad(Math.floor(left * 60 % 60)) + "m"; }
function renderHome() {
  const rows = leagueTable(), pos = myPos(rows), opp = nextOpponent(), lv = levelOf(S.xp), l0 = levelAt(lv - 1), l1 = levelAt(lv);
  const fourth = rows[3], gap = pos <= 4 ? 0 : fourth.pts - S.week.pts, g = S.grid[dayKey()], gdone = g && (g.left <= 0 || g.c.every(x => x));
  const zone = S.div < DIVS.length - 1 && pos <= 4 ? "In the promotion places" : S.div > 0 && pos >= 17 ? "In the drop zone" : S.div < DIVS.length - 1 ? gap + " pts off promotion" : "Top division";
  $("main").innerHTML = `${S.note ? `<div class="panel pad" style="border-color:var(--amber)"><span class="eyebrow" style="color:var(--amber)">Last season</span><p class="note" style="margin-top:6px">${noteText()}</p><button class="linkb" data-act="clearnote">Dismiss</button></div>` : ""}
  <div class="panel fix"><div class="statline"><span>${esc(DIVS[S.div])} · Season ${S.season}</span><span>Match <b>${S.week.pl + 1}</b> of ${SEASON}</span></div>
   <div class="vs"><div class="t">${esc(S.name || "You")}<small>${esc(S.club)} · ${ord(pos)}</small></div><div class="v">v</div><div class="t">${esc(opp.name)}<small>${opp.real ? "REAL PLAYER" : "HOUSE SIDE"} · ${ord(rows.findIndex(r => r.id === opp.id) + 1)}</small></div></div>
   <button class="btn" data-act="kick">Kick off<small>Five chances each. About 90 seconds.</small></button>
   <div class="statline"><span class="form">${S.form.length ? S.form.map(f => `<i class="${f}">${f}</i>`).join("") : "<span>No form yet</span>"}</span><span><b>${zone}</b></span></div></div>
  ${cupCard()}
  ${Net.checked && !Net.ready ? `<div class="panel pad"><p class="note"><b>Playing offline.</b> Your progress saves on this phone, but your results won't show in your mates' tables and your opponents are house sides. Share your result after a match to show off.</p></div>` : ""}
  <button class="panel li" data-act="go" data-v="grid" style="border-radius:6px"><span class="k">${gridNo()}</span><span class="tx"><b>Daily Grid</b><span>${gdone ? "Done for today. " + g.c.filter(x => x).length + " of 9." : g ? g.left + " guesses left. Finish the job." : "Nine squares, nine guesses. Same grid for everyone."}</span></span><span class="go">›</span></button>
  <div class="hd"><h2>Training ground</h2><span class="eyebrow">No table, small XP</span></div>
  <div class="panel list">${Object.keys(TYPES).map((k, i) => `<button class="li" data-act="train" data-v="${k}"><span class="k">${pad(i + 1)}</span><span class="tx"><b>${TYPES[k].n}</b><span>${({ cell: "Two categories, one player.", top: "Top scorers, record signings, most appearances.", xi: "Real line-ups with names blanked out.", mates: "Find the team-mate two players share.", career: "A list of clubs. Name the player.", hl: "Which transfer cost more?", season: "A final table. Which year?", squad: "One club, one season. Name the squad.", odd: "Three played there. One never did.", race: "Goals, appearances, fees. Who had more?", champ: "Who finished where, season by season." })[k]}</span></span><span class="go">›</span></button>`).join("")}</div>
  <div class="panel pad"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(S.xp)}</b> XP · ${fmt(l1 - S.xp)} to level ${lv + 1}</span></div><div class="bar" style="margin-top:8px"><i style="width:${Math.max(2, (S.xp - l0) / (l1 - l0) * 100).toFixed(1)}%"></i></div></div>
  <p class="foot">${fmt(PL.length)} PLAYERS · ${fmt(BD.xi.length)} LINE-UPS · ${fmt(BD.lists.length)} TOP TENS · ${fmt(BD.tables.length)} FINAL TABLES<br>${Net.ready && !Net.readonly ? "CONNECTED · YOUR RESULTS COUNT IN THE SHARED TABLES" : "PLAYING LOCALLY ON THIS DEVICE"}</p>`;
}
function renderLeague() {
  const rows = leagueTable(), up = S.div < DIVS.length - 1, down = S.div > 0;
  let body;
  if (leagueTab === "table") {
    body = `<div class="panel"><table><tr><th>#</th><th>${esc(DIVS[S.div])}</th><th>P</th><th>GD</th><th>PTS</th></tr>${rows.map((r, i) => `<tr class="${r.me ? "me" : ""} ${up && i < 4 ? "up" : down && i >= 16 ? "down" : ""} ${(up && i === 3) || (down && i === 15) ? "cut" : ""}"><td>${i + 1}</td><td>${esc(r.name)}${r.me ? '<span class="tag me">YOU</span>' : r.house ? '<span class="tag">HOUSE</span>' : ""}</td><td>${r.pl}</td><td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td>${r.pts}</td></tr>`).join("")}</table>
    <div class="key">${up ? '<span><i style="background:var(--good)"></i>Top four go up</span>' : ""}${down ? '<span><i style="background:var(--bad)"></i>Bottom four go down</span>' : ""}<span>${SEASON - S.week.pl} of ${SEASON} matches left</span></div></div>
    <p class="note">A season is ${SEASON} matches: you play everyone once. <b>House sides</b> fill the places real players haven't taken yet, and play a match every time you do.</p>`;
  } else {
    const by = {}; Net.rows.filter(r => r && r.w === weekNo() && r.id !== Net.uid && r.c).map(r => ({ c: r.c, gf: r.cg, p: r.cp })).concat([{ c: S.club, gf: cwNow().gf, p: cwNow().pts, me: true }]).forEach(r => { const k = String(r.c).slice(0, 30); by[k] = by[k] || { c: k, fans: 0, gf: 0, pts: 0, me: false }; by[k].fans++; by[k].gf += r.gf | 0; by[k].pts += r.p | 0; if (r.me) by[k].me = true; });
    const cw = Object.values(by).sort((a, b) => b.gf - a.gf || b.pts - a.pts);
    body = `<div class="panel"><table><tr><th>#</th><th>Club Wars · this week</th><th>FANS</th><th>PTS</th><th>GOALS</th></tr>${cw.map((r, i) => `<tr class="${r.me ? "me" : ""}"><td>${i + 1}</td><td>${esc(r.c)}${r.me ? '<span class="tag me">YOURS</span>' : ""}</td><td>${r.fans}</td><td>${r.pts}</td><td>${r.gf}</td></tr>`).join("")}</table></div>
    <p class="note">Every goal you score counts for <b>${esc(S.club)}</b>. ${cw.length < 2 ? "You're the only fan on the board so far. It fills up as others sign on." : "Real fans only on this one. No house sides."} Resets in ${countdown()}.${Net.ready ? "" : " You're playing locally, so only your own club shows here."}</p>`;
  }
  $("main").innerHTML = `<div class="seg"><button class="${leagueTab === "table" ? "on" : ""}" data-act="ltab" data-v="table">League table</button><button class="${leagueTab === "wars" ? "on" : ""}" data-act="ltab" data-v="wars">Club Wars</button></div>${body}
  <div class="hd"><h2>The pyramid</h2></div><div class="panel list">${DIVS.map((d, i) => i).reverse().map(i => `<div class="li"><span class="k">${pad(i + 1)}</span><span class="tx"><b style="${i === S.div ? "color:var(--amber)" : i > S.div ? "color:var(--mute)" : ""}">${esc(DIVS[i])}</b><span>${i === S.div ? "You are here" : i === 7 ? "The summit" : ["Kind questions, famous names", "Still the household names", "The big clubs, fewer gimmes", "Sterner tests begin", "Cult heroes start appearing", "Deep squads, tighter margins", "Obscure and proud of it"][i]}</span></span></div>`).join("")}</div>`;
  Net.pull().then(() => { });
}
const rarOf = i => fame(i) >= 5 ? 0 : fame(i) >= 3.5 ? 1 : 2;
const RARN = ["Household name", "Squad regular", "Cult hero"];
function cardHTML(i, n) { const p = PL[i]; return `<div class="panel card r${rarOf(i)}"><div class="nm">${esc(p[0])}</div><div class="mt">${POSN[p[2]]}${p[1] >= 0 ? " · " + esc(NAT[p[1]]) : ""}${p[3] > 0 ? " · '" + pad(p[3] % 100) : ""}</div><div class="cl">${clubsOf(i).slice(0, 5).map(c => esc(CLUB[c])).join(", ")}</div><div class="rr">${RARN[rarOf(i)]}${n > 1 ? " ×" + n : ""}</div></div>`; }
let albumClub = "";
function renderAlbum() {
  const keys = Object.keys(S.album), idx = keys.map(k => KEY2IDX[k]).filter(i => i !== undefined), cult = idx.filter(i => rarOf(i) === 2).length;
  let list, head;
  if (albumClub !== "") { const c = +albumClub; list = idx.filter(i => hasClub(i, c)).sort((a, b) => a - b); head = `${esc(CLUB[c])}: ${list.length} of ${fmt(clubPl[c].length)}`; }
  else { list = S.recent.map(k => KEY2IDX[k]).filter(i => i !== undefined); head = "Latest names"; }
  $("main").innerHTML = `<div class="counts"><div class="panel ct"><b>${fmt(idx.length)}</b><span>Collected</span></div><div class="panel ct"><b>${fmt(PL.length)}</b><span>In the book</span></div><div class="panel ct"><b>${cult}</b><span>Cult heroes</span></div></div>
  <label class="field" for="ac">Show<select id="ac"><option value="">Latest names</option>${BD.gridClubs.map(c => `<option value="${c}" ${String(c) === albumClub ? "selected" : ""}>${esc(CLUB[c])}</option>`).join("")}</select></label>
  <div class="hd"><h2>${head}</h2></div>
  ${list.length ? `<div class="stk">${list.slice(0, 80).map(i => cardHTML(i, S.album[pkey(i)])).join("")}</div>` : `<div class="panel pad"><p class="note">${idx.length ? "None from here yet." : "Empty for now. Every player you name correctly, in a match, the grid or training, goes in the album. The obscure ones are worth the most."}</p></div>`}`;
}
function render() { settleSeason(); chrome(); if (view === "home") renderHome(); else if (view === "league") renderLeague(); else if (view === "grid") renderGrid(); else if (view === "album") renderAlbum(); window.scrollTo(0, 0); }
function profileSheet(first) {
  const clubs = BD.gridClubs.map(c => CLUB[c]).sort();
  $("over").innerHTML = `<div class="sheet"><form class="box" id="pf"><span class="eyebrow">${first ? "Welcome to matchday" : "Profile"}</span><h1>${first ? "Sign on" : esc(S.name)}</h1>
  ${first ? `<ol class="steps"><li><i>01</i><span><b>Play fixtures, not quizzes.</b> Five chances each. Out-score the other lot.</span></li><li><i>02</i><span><b>Type names, don't pick them.</b> Real squads, line-ups and transfers. No multiple choice.</span></li><li><i>03</i><span><b>Win points, go up.</b> Nineteen-match seasons. Four up, four down.</span></li></ol>` : `<div class="panel pad"><div class="statline"><span>Matches <b>${S.st.m}</b></span><span>Wins <b>${S.st.w}</b></span><span>Goals <b>${S.st.goals}</b></span><span>Deep cuts <b>${S.st.deep}</b></span></div></div>`}
  <label class="field" for="nm">Name on the teamsheet<input id="nm" maxlength="16" autocomplete="off" value="${esc(S.name)}" placeholder="e.g. Big Dave"></label>
  <label class="field" for="cl">Your club<select id="cl">${clubs.map(c => `<option ${c === S.club ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
  <button class="btn" type="submit">${first ? "Sign the forms" : "Save"}</button>
  ${first ? "" : `<div class="row"><button type="button" class="btn line sm" data-act="sound">Sound ${S.sound ? "on" : "off"}</button><button type="button" class="btn line sm" data-act="closeover">Close</button></div><button type="button" class="linkb" data-act="reset">Reset everything</button>`}</form></div>`;
  $("pf").addEventListener("submit", e => { e.preventDefault(); const n = $("nm").value.trim().slice(0, 16); S.name = n || "Unnamed Trialist"; S.club = $("cl").value; S.made = true; $("over").innerHTML = ""; save(true); render(); });
}
function cellSheet(k) {
  gridCell = k; const a = GRID.rows[Math.floor(k / 3)], b = GRID.cols[k % 3], g = gridState();
  $("over").innerHTML = `<div class="sheet topdock"><div class="box"><div class="hd"><span class="eyebrow">${g.left} guesses left</span><button class="linkb" data-act="closeover">Close</button></div><div class="cats"><div class="cat"><span>${catSub(a)}</span><b>${esc(catLabel(a))}</b></div><div class="amp">+</div><div class="cat"><span>${catSub(b)}</span><b>${esc(catLabel(b))}</b></div></div>
  <div class="entry"><input id="q" type="text" placeholder="Type a player's name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><div class="sug" id="sug" hidden></div></div><p class="msg" id="msg"></p></div></div>`;
  const q = $("q"); try { q.focus(); } catch (e) { }
}
function confirmSheet(title, text, yes, fn) { $("over").innerHTML = `<div class="sheet"><div class="box"><h1>${esc(title)}</h1><p class="note">${esc(text)}</p><div class="row"><button class="btn line" data-act="closeover">Cancel</button><button class="btn" id="yes">${esc(yes)}</button></div></div></div>`; $("yes").addEventListener("click", () => { $("over").innerHTML = ""; fn(); }); }
function quitMatch() { cancelAnimationFrame(raf); if (M) M.live = false; M = null; view = "home"; save(true); render(); }

/* ============ events ============ */
function submitPick(i, raw) { const q = $("q"); if (q) { q.value = ""; } const s = $("sug"); if (s) s.hidden = true; if (view === "grid") { if (i >= 0) gridPick(i); } else if (M && M.live && M.run && M.run.onPick) M.run.onPick(i, raw || ""); if (q && q.isConnected) { try { q.focus(); } catch (e) { } } }
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "q") { const r = search(t.value), s = $("sug"); if (!s) return; s.hidden = !r.length; s.innerHTML = r.map(i => `<button type="button" data-act="sugg" data-v="${i}">${esc(PL[i][0])}<span>${PL[i][3] > 0 ? "b. " + (1900 + PL[i][3]) : ""}</span></button>`).join(""); }
  else if (t.id === "sl" && M && M.run && M.run.onInput) M.run.onInput(t.value);
});
document.addEventListener("change", e => { if (e.target.id === "ac") { albumClub = e.target.value; renderAlbum(); } });
document.addEventListener("keydown", e => { if (e.key !== "Enter" || e.target.id !== "q") return; e.preventDefault(); const s = $("sug"), first = s && !s.hidden && s.querySelector("button"); if (first) submitPick(+first.dataset.v); else if (M && M.run && M.run.raw && e.target.value.trim()) submitPick(-1, e.target.value); });
document.addEventListener("mousedown", e => { if (e.target.closest && e.target.closest(".sug")) e.preventDefault(); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act, v = b.dataset.v;
  if (act === "go") { M = null; view = v; render(); }
  else if (act === "kick") { if (!S.made) { profileSheet(true); return; } startLeagueMatch(); }
  else if (act === "train") startTraining(v);
  else if (act === "share") doShare();
  else if (act === "cup") { if (!S.made) { profileSheet(true); return; } startCupMatch(); }
  else if (act === "take") takeChance();
  else if (act === "sugg") submitPick(+v);
  else if (act === "tap") { if (M && M.live && M.run && M.run.onTap) M.run.onTap(v); }
  else if (act === "cont") { if (!M) return; if (M.mode === "league" && M.i >= 5) fullTime(); else if (M.mode === "cup" && M.i >= M.rounds.length) cupContinue(); else chanceCover(); }
  else if (act === "quit") { if (!M) return; if (M.mode === "cup" && !(M.i === 0 && !M.live)) { confirmSheet("Walk off?", "Walk off a cup tie and you're knocked out.", "Walk off", () => { S.cup.l++; S.cup.best = Math.max(S.cup.best, S.cup.rd); S.cup.rd = 0; S.cup.runs++; save(true); quitMatch(); }); return; } if (M.mode === "train" || M.i === 0 && !M.live) quitMatch(); else confirmSheet("Walk off?", "An abandoned match doesn't count in the table. You keep nothing from it.", "Abandon", quitMatch); }
  else if (act === "ltab") { leagueTab = v; renderLeague(); }
  else if (act === "cell") cellSheet(+v);
  else if (act === "sharegrid") { const g = gridState(), got = g.c.filter(x => x).length, obs = got ? Math.round(g.r.reduce((s, x) => s + x, 0) / got) : 0; const t = `BOFFIN GRID No. ${gridNo()}\n${[0, 1, 2].map(r => [0, 1, 2].map(c => g.c[r * 3 + c] ? "🟩" : "⬛").join("")).join("\n")}\n${got}/9 · Obscurity ${obs}%`; try { navigator.clipboard.writeText(t).then(() => toast("Result copied"), () => toast("Couldn't copy on this device")); } catch (err) { toast("Couldn't copy on this device"); } }
  else if (act === "profile") profileSheet(!S.made);
  else if (act === "sound") { S.sound = !S.sound; save(); profileSheet(false); }
  else if (act === "clearnote") { S.note = null; save(); render(); }
  else if (act === "reset") confirmSheet("Reset everything?", "Level, division, album and form all go back to nothing. This can't be undone.", "Reset", () => { const salt = S.salt; S = fresh(); S.salt = salt; try { localStorage.removeItem(KEY); } catch (err) { } view = "home"; render(); profileSheet(true); })
  else if (act === "closeover") $("over").innerHTML = "";
});
render(); if (!S.made) profileSheet(true);
Net.init();
