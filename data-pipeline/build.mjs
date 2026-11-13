// Step 2: load the cached sources into a local SQLite db (data-pipeline/out/football.db, gitignored).
// Usage: node --no-warnings build.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { CACHE, OUT, REPO, nfc, fold, qid, readJSON } from "./lib/util.mjs";
import { parseSeason } from "./lib/fbtxt.mjs";
import { CLUBS } from "./config/clubs.mjs";
import { PL_FIRST, plCurrentStart, plLastComplete } from "./config/scope.mjs";
import { parseWikiTable } from "./lib/wikitable.mjs";

const DB = path.join(OUT, "football.db");
if (fs.existsSync(DB)) fs.unlinkSync(DB);
const db = new DatabaseSync(DB);
const log = (...a) => console.log("[build]", ...a);
db.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
const ins = (t, row) => { const k = Object.keys(row); db.prepare(`INSERT INTO ${t} (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).run(...k.map(x => row[x] === undefined ? null : row[x])); };
db.exec("BEGIN");

/* ---------- clubs, aliases, eras ---------- */
const aliasMap = new Map();   // folded alias -> club id
for (const c of CLUBS) {
  ins("clubs", { id: c.id, name: c.name, q: c.q, bd: c.bd || null, note: c.note || null });
  const add = (alias, source) => { if (!alias) return; const k = fold(alias); if (aliasMap.has(k) && aliasMap.get(k) !== c.id) throw new Error("alias clash: " + alias); aliasMap.set(k, c.id); ins("club_aliases", { alias: nfc(alias), key: k, source, club_id: c.id }); };
  add(c.name, "display"); if (c.bd && fold(c.bd) !== fold(c.name)) add(c.bd, "data.js");
  for (const a of c.of) if (fold(a) !== fold(c.name)) add(a, "openfootball");
  if (c.es && !c.of.some(a => fold(a) === fold(c.es)) && fold(c.es) !== fold(c.name)) add(c.es, "engsoccerdata");
  if (c.fpl && ![c.name, c.bd, ...c.of, c.es].some(a => a && fold(a) === fold(c.fpl))) add(c.fpl, "fpl");
  (c.eras || []).forEach((e, k, all) => ins("club_eras", { club_id: c.id, name: e.name, from_date: e.from, to_date: all[k + 1] ? all[k + 1].from : null, ok: e.ok ? 1 : 0, src: e.src || "wikipedia (needs a second source)" }));
}
const clubOf = name => { const id = aliasMap.get(fold(name)); if (!id) throw new Error("unknown club name: " + name); return id; };
const clubByQ = Object.fromEntries(CLUBS.filter(c => c.q).map(c => [c.q, c.id]));

/* ---------- seasons and matches (openfootball) ---------- */
const wdSeasons = readJSON(path.join(CACHE, "wikidata/pl-seasons.json")).results.bindings;
let nM = 0, nG = 0;
for (let y = PL_FIRST; y <= plCurrentStart(); y++) {
  const f = path.join(CACHE, "openfootball/england", `${y}-${String(y + 1).slice(2)}.txt`); if (!fs.existsSync(f)) continue;
  const wd = wdSeasons.find(b => b.sLabel && b.sLabel.value.startsWith(y + "–"));
  const sid = "pl-" + y, ms = parseSeason(fs.readFileSync(f, "utf8"), y), teams = new Set();
  ms.forEach(m => { teams.add(clubOf(m.t1)); teams.add(clubOf(m.t2)); });
  const complete = y <= plLastComplete() && ms.length === teams.size * (teams.size - 1) ? 1 : 0;
  ins("seasons", { id: sid, comp: "PL", start: y, label: wd ? wd.sLabel.value : null, official_name: y <= 2006 ? "FA Premier League" : "Premier League", teams: teams.size, complete, q: wd ? qid(wd.s.value) : null, played: ms.length });
  for (const m of ms) {
    const id = `${sid}-${m.date}-${clubOf(m.t1)}-${clubOf(m.t2)}`;
    ins("matches", { id, season_id: sid, date: m.date, round: m.round, home_id: clubOf(m.t1), away_id: clubOf(m.t2), hg: m.g1, ag: m.g2, ht_h: m.ht ? m.ht[0] : null, ht_a: m.ht ? m.ht[1] : null, status: m.status, src: `openfootball:england/${y}-${String(y + 1).slice(2)}#L${m.line}` });
    nM++;
    for (const g of m.goals || []) { ins("goals", { match_id: id, club_id: g.side ? clubOf(m.t2) : clubOf(m.t1), player_name: nfc(g.name), player_key: fold(g.name), minute: g.min, extra: g.extra, pen: g.pen ? 1 : 0, og: g.og ? 1 : 0, mismatch: g.mismatch ? 1 : 0 }); nG++; }
  }
  // champions (Wikidata P1346), a second source for the table we rebuild
  if (wd && wd.winner) { const c = clubByQ[qid(wd.winner.value)]; if (c) ins("honours", { season_id: sid, club_id: c, honour: "champion", src: "wikidata:" + qid(wd.s.value) + "#P1346" }); }
}
log("matches", nM, "goals", nG);

/* ---------- verification sources (never shipped) ---------- */
// Wikipedia final tables: order, W/D/L/GF/GA, points deductions.
const wikiName = new Map(readJSON(path.join(CACHE, "wikidata/pl-seasons.json")).results.bindings.filter(b => b.team).map(b => [fold(b.teamLabel.value), clubByQ[qid(b.team.value)]]));
let wikiN = 0, wikiMiss = [];
for (let y = PL_FIRST; y <= plLastComplete(); y++) {
  const f = path.join(CACHE, "verify/wikipedia", y + ".txt"); if (!fs.existsSync(f)) { wikiMiss.push(y); continue; }
  const rows = parseWikiTable(fs.readFileSync(f, "utf8"));
  if (!rows) { wikiMiss.push(y); continue; }
  for (const r of rows) {
    let c = wikiName.get(fold(r.article)) || aliasMap.get(fold(r.display)) || aliasMap.get(fold(r.article.replace(/ (A\.)?F\.C\.$/, "")));
    if (!c) throw new Error(`wikipedia ${y}: unknown club ${r.article} / ${r.display}`);
    ins("verify_wiki", { season_id: "pl-" + y, club_id: c, pos: r.pos, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, adj: r.adj, src: "wikipedia:" + y });
    if (r.adj) ins("deductions", { season_id: "pl-" + y, club_id: c, points: -r.adj, src: "wikipedia:" + y + " (adjust_points)" });
    wikiN++;
  }
}
log("wikipedia table rows", wikiN, wikiMiss.length ? "no table parsed for " + wikiMiss.join(",") : "");
// engsoccerdata results (top flight, 1992 on)
let esN = 0;
{
  const lines = fs.readFileSync(path.join(CACHE, "verify/engsoccerdata-england.csv"), "utf8").split("\n"), hdr = lines[0].split(",").map(s => s.replace(/"/g, ""));
  const ix = k => hdr.indexOf(k);
  for (const l of lines.slice(1)) {
    if (!l) continue; const c = l.match(/("([^"]*)"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, "").replace(/^"|"$/g, ""));
    if (c[ix("tier")] !== "1" || +c[ix("Season")] < PL_FIRST) continue;
    ins("verify_es", { season_id: "pl-" + c[ix("Season")], date: c[ix("Date")], home_id: clubOf(c[ix("home")]), away_id: clubOf(c[ix("visitor")]), hg: +c[ix("hgoal")], ag: +c[ix("vgoal")] }); esN++;
  }
}
log("engsoccerdata matches", esN);

/* ---------- rebuilt standings: from openfootball results, with deductions; PL order is points, goal difference, goals scored ---------- */
for (const s of db.prepare("SELECT * FROM seasons").all()) {
  const t = {};
  for (const m of db.prepare("SELECT * FROM matches WHERE season_id=? AND status='ok'").all(s.id)) {
    for (const [c, f, a] of [[m.home_id, m.hg, m.ag], [m.away_id, m.ag, m.hg]]) { const r = t[c] = t[c] || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; r.p++; r.gf += f; r.ga += a; if (f > a) r.w++; else if (f === a) r.d++; else r.l++; }
  }
  const ded = Object.fromEntries(db.prepare("SELECT club_id, points FROM deductions WHERE season_id=?").all(s.id).map(r => [r.club_id, r.points]));
  const rows = Object.entries(t).map(([c, r]) => Object.assign(r, { c, ded: ded[c] || 0, pts: 3 * r.w + r.d - (ded[c] || 0) }));
  rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.c.localeCompare(b.c));
  rows.forEach((r, k) => { const tie = rows.some((o, j) => j !== k && o.pts === r.pts && o.gf - o.ga === r.gf - r.ga && o.gf === r.gf); ins("standings", { season_id: s.id, club_id: r.c, pos: k + 1, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, ded: r.ded, pts: r.pts, tie: tie ? 1 : 0 }); });
}

/* ---------- clubs: venues with dates (Wikidata P115) ---------- */
for (const b of readJSON(path.join(CACHE, "wikidata/pl-clubs.json")).results.bindings) {
  const c = clubByQ[qid(b.c.value)]; if (!c || !b.venue) continue;
  ins("venues", { club_id: c, venue_q: qid(b.venue.value), name: nfc(b.venueLabel.value), from_date: b.vstart ? b.vstart.value.slice(0, 10) : null, to_date: b.vend ? b.vend.value.slice(0, 10) : null, src: "wikidata:" + qid(b.c.value) + "#P115" });
}

/* ---------- players (Wikidata), keyed on Q-ID ---------- */
const POS = p => /goalkeep|goaltender/.test(p) ? "GK" : /back|defend|stopper|sweeper|half-back line/.test(p) ? "DEF" : /midfield|wing half|playmaker|half$/.test(p) ? "MID" : /forward|striker|winger|wing$|attacker|centre$/.test(p) ? "FWD" : null;
const P = new Map();
for (const f of fs.readdirSync(path.join(CACHE, "wikidata/bios")).sort()) for (const b of readJSON(path.join(CACHE, "wikidata/bios", f)).results.bindings) {
  const q = qid(b.p.value), p = P.get(q) || { q, names: new Set(), dobs: new Set(), natS: new Map(), cit: new Map(), pos: new Set() };
  if (b.pLabel) p.names.add(nfc(b.pLabel.value)); if (b.dob) p.dobs.add(b.dob.value.slice(0, 10));
  if (b.natSport) p.natS.set(qid(b.natSport.value), b.natSportLabel ? b.natSportLabel.value : null);
  if (b.cit) p.cit.set(qid(b.cit.value), b.citLabel ? b.citLabel.value : null);
  if (b.posLabel) { const x = POS(b.posLabel.value); if (x) p.pos.add(x); }
  P.set(q, p);
}
let nP = 0;
for (const p of P.values()) {
  const name = [...p.names][0]; if (!name || /^Q\d+$/.test(name)) continue;
  const dob = p.dobs.size === 1 ? [...p.dobs][0] : null;   // conflicting birth dates: keep none rather than guess
  const nat = p.natS.size === 1 ? [...p.natS] [0] : p.natS.size === 0 && p.cit.size === 1 ? [...p.cit][0] : null;   // country for sport first, else one citizenship
  ins("players", { q: p.q, name, key: fold(name), dob, birth_year: dob ? +dob.slice(0, 4) : null, nat_q: nat ? nat[0] : null, nat: nat ? nat[1] : null, pos: p.pos.size === 1 ? [...p.pos][0] : null, src: "wikidata:" + p.q });
  nP++;
}
log("players", nP);
const NATTEAM = /national|under-\d\d|\bU-?\d\d\b|olympic|amateur team|XI$|\bB team/i, YOUTH = /reserve|academy|youth|under-\d\d|\bU-?\d\d\b|\bII$| B$/i;
let nS = 0;
for (const f of fs.readdirSync(path.join(CACHE, "wikidata/careers")).sort()) for (const b of readJSON(path.join(CACHE, "wikidata/careers", f)).results.bindings) {
  const label = b.clubLabel ? b.clubLabel.value : "", cq = qid(b.club.value);
  const kind = b.nt || NATTEAM.test(label) ? "national" : YOUTH.test(label) ? "youth" : "club";
  ins("spells", { player_q: qid(b.p.value), club_q: cq, club_id: clubByQ[cq] || null, club_label: nfc(label), start: b.start ? b.start.value.slice(0, 10) : null, end_date: b.end ? b.end.value.slice(0, 10) : null, kind, src: "wikidata:" + qid(b.p.value) + "#P54" });
  nS++;
}
log("spells", nS);

/* ---------- FPL: current squads (derived facts only: name, club, position, minutes) ---------- */
const fpl = readJSON(path.join(CACHE, "fpl/bootstrap-static.json")), fteam = Object.fromEntries(fpl.teams.map(t => [t.id, clubOf(t.name)]));
const FPOS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
for (const e of fpl.elements) ins("fpl_players", { id: e.id, first: nfc(e.first_name), second: nfc(e.second_name), web: nfc(e.web_name), key: fold(e.first_name + " " + e.second_name), club_id: fteam[e.team], pos: FPOS[e.element_type] || null, minutes: e.minutes, goals: e.goals_scored, status: e.status });
log("fpl players", fpl.elements.length, "as of", fpl.events.find(e => e.is_current) ? "gameweek " + fpl.events.find(e => e.is_current).id : "pre-season");
ins("meta", { k: "fpl_gw", v: String(fpl.events.find(e => e.is_current) ? fpl.events.find(e => e.is_current).id : 0) });

/* ---------- the game's own data.js: a second source for bios and careers (it already ships, so nothing new is exposed) ---------- */
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(REPO, "data.js"), "utf8"), ctx);
const BD = ctx.window.BD;
BD.players.forEach((p, i) => {
  const spells = []; for (let k = 0; k < p[5].length; k += 2) spells.push([BD.clubs[p[5][k]], 1990 + p[5][k + 1]]);
  ins("bd_players", { idx: i, name: nfc(p[0]), key: fold(p[0]), birth_year: p[3] > 0 ? 1900 + p[3] : null, nat: p[1] >= 0 ? BD.nats[p[1]] : null, pos: ["GK", "DEF", "MID", "FWD"][p[2]], fame: p[4] / 10, spells: JSON.stringify(spells) });
});
BD.tables.forEach(t => { if (t[0] !== "Premier League") return; t[3].forEach((r, k) => ins("verify_bd_table", { season_id: "pl-" + t[1], pos: k + 1, club: r[0], pts: r[1], gf: r[2], ga: r[3] })); t[4].forEach(c => ins("verify_bd_table", { season_id: "pl-" + t[1], pos: -1, club: c })); });
log("data.js players", BD.players.length);

/* link Wikidata players to data.js (name + birth year) and to FPL (name + current club; FPL has no birth dates) */
db.exec(`UPDATE players SET bd_idx = (SELECT idx FROM bd_players b WHERE b.key = players.key AND b.birth_year = players.birth_year) WHERE birth_year IS NOT NULL AND (SELECT COUNT(*) FROM bd_players b WHERE b.key = players.key AND b.birth_year = players.birth_year) = 1`);
const openSpell = db.prepare(`SELECT p.q FROM players p JOIN spells s ON s.player_q = p.q WHERE s.club_id = ? AND s.end_date IS NULL AND s.kind = 'club' AND (p.key = ? OR p.key LIKE ? ) GROUP BY p.q`);
let fplLinked = 0;
for (const f of db.prepare("SELECT * FROM fpl_players").all()) {
  const sn = fold(f.second).split(" ").pop(), hits = openSpell.all(f.club_id, f.key, "% " + sn);
  const exact = hits.filter(h => db.prepare("SELECT key FROM players WHERE q=?").get(h.q).key === f.key);
  const pick = exact.length === 1 ? exact[0] : hits.length === 1 ? hits[0] : null;
  if (pick) { db.prepare("UPDATE fpl_players SET player_q=? WHERE id=?").run(pick.q, f.id); fplLinked++; }
}
log("FPL players linked to Wikidata (name + club):", fplLinked);
db.exec("COMMIT");
log("db:", path.relative(process.cwd(), DB), (fs.statSync(DB).size / 1e6).toFixed(1) + " MB");
