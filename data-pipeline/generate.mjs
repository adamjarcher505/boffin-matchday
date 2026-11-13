// Step 3: build questions from the db, check every one against a second source, write the shipped bank and the reports.
// Usage: node --no-warnings generate.mjs
// Output: ../questions.js (shipped), reports/validation.md, reports/review.json, reports/sample.md
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { OUT, REPO, REPORTS, fold, ord, seasonLabel, today, rng, shuffle, hashId, writeJSON } from "./lib/util.mjs";
import { CLUBS } from "./config/clubs.mjs";
import { LIMITS } from "./config/limits.mjs";

const db = new DatabaseSync(path.join(OUT, "football.db"), { readOnly: true });
const all = (sql, ...a) => db.prepare(sql).all(...a), one = (sql, ...a) => db.prepare(sql).get(...a);
const ASOF = today(), R = rng("boffin-q-" + ASOF.slice(0, 7));   // stable within a month so weekly diffs stay small
const CL = Object.fromEntries(CLUBS.map(c => [c.id, c])), cname = id => CL[id].name, cbd = id => CL[id].bd || CL[id].name;
const out = [], review = [], rejects = {}, seen = new Set();
const reject = (why, detail) => { (rejects[why] = rejects[why] || []).push(detail); };
const toReview = (t, key, reason, detail) => review.push({ template: t, key, reason, detail });

/* every question goes through here: shape and length checks, de-duplication, stable id */
function Q({ t, cat, clubs = [], season = null, d, q, sub = "", a, o, src, tags = [], key }) {
  key = key || t + "|" + q + "|" + sub;
  if (seen.has(key)) return; seen.add(key);
  a = String(a); o = o.map(String);
  const opts = [a, ...o];
  if (o.length < 2) return reject("not enough distractors", key);
  if (new Set(opts.map(x => x.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim())).size !== opts.length) return reject("duplicate options", key);
  if (q.length > LIMITS.q) return reject("question too long", key + " (" + q.length + ")");
  if (sub.length > LIMITS.sub) return reject("subtitle too long", key);
  if (opts.some(x => x.length > LIMITS.opt)) return reject("answer option too long", key + " " + opts.find(x => x.length > LIMITS.opt));
  if (!src || src.length < 2) return reject("fewer than two sources", key);
  if (/\b(current(ly)?|most ever|record|all-time|ever)\b/i.test(q + " " + sub)) return reject("time-sensitive wording", key);
  out.push({ id: hashId(key), t, cat, comp: "PL", k: [...new Set(clubs.map(cbd))], season: season === null ? null : seasonLabel(season), y: season, d: Math.max(1, Math.min(4, d)), q, sub, a, o: o.slice(0, 3), src, tags });
}

/* ---------- data shared by templates ---------- */
const seasons = all("SELECT * FROM seasons WHERE complete = 1 ORDER BY start");
const ST = {}, WK = {};
for (const s of seasons) { ST[s.id] = all("SELECT * FROM standings WHERE season_id=? ORDER BY pos", s.id); WK[s.id] = Object.fromEntries(all("SELECT * FROM verify_wiki WHERE season_id=?", s.id).map(r => [r.club_id, r])); }
const champ = Object.fromEntries(all("SELECT season_id, club_id, src FROM honours WHERE honour='champion'").map(r => [r.season_id, r]));
// a club's row is confirmed when the Wikipedia table has the same position, W/D/L and goals (and no unresolved tie)
const rowOk = (sid, r) => { const w = WK[sid] && WK[sid][r.club_id]; return !!w && w.pos === r.pos && w.w === r.w && w.d === r.d && w.l === r.l && w.gf === r.gf && w.ga === r.ga && !r.tie; };
const tableChecks = [];
for (const s of seasons) {
  const bad = ST[s.id].filter(r => !rowOk(s.id, r));
  tableChecks.push({ season: seasonLabel(s.start), rows: ST[s.id].length, mismatches: bad.map(r => `${cname(r.club_id)} (ours ${ord(r.pos)} ${r.w}-${r.d}-${r.l} ${r.gf}:${r.ga}${WK[s.id][r.club_id] ? `; Wikipedia ${ord(WK[s.id][r.club_id].pos)} ${WK[s.id][r.club_id].w}-${WK[s.id][r.club_id].d}-${WK[s.id][r.club_id].l} ${WK[s.id][r.club_id].gf}:${WK[s.id][r.club_id].ga}` : "; not in Wikipedia table"})`),
    champion: ST[s.id][0] ? cname(ST[s.id][0].club_id) : "?", wikidataChampion: champ[s.id] ? cname(champ[s.id].club_id) : "none", deductions: all("SELECT club_id, points FROM deductions WHERE season_id=?", s.id).map(r => `${cname(r.club_id)} −${r.points}`) });
  if (bad.length) toReview("table", s.id, "rebuilt table disagrees with Wikipedia", tableChecks.at(-1).mismatches);
  if (champ[s.id] && ST[s.id][0] && champ[s.id].club_id !== ST[s.id][0].club_id) toReview("champion", s.id, "rebuilt champion disagrees with Wikidata", [cname(ST[s.id][0].club_id), cname(champ[s.id].club_id)]);
}
const srcTable = (s) => [`openfootball:england/${s.start}-${String(s.start + 1).slice(2)}`, `wikipedia-table:${s.start} (verified)`];
const near = (rows, pos, n, r) => shuffle(rows.filter(x => x.pos !== pos).sort((a, b) => Math.abs(a.pos - pos) - Math.abs(b.pos - pos)).slice(0, 6), r).slice(0, n);
const era = y => y >= 2015 ? 0 : y >= 2005 ? 1 : y >= 1998 ? 2 : 3;   // how long ago, for difficulty

/* ---------- competition: champions, finishing positions, relegation, points ---------- */
for (const s of seasons) {
  const rows = ST[s.id], y = s.start, label = seasonLabel(y), top = rows[0], r = rng("t" + s.id);
  if (!rows.length) continue;
  // champions: our table, Wikipedia's table and Wikidata's winner must all agree
  if (rowOk(s.id, top) && champ[s.id] && champ[s.id].club_id === top.club_id)
    Q({ t: "champion", cat: "competition", clubs: [top.club_id], season: y, d: y >= 2010 ? 1 : 2, q: "Who won the Premier League?", sub: label, a: cname(top.club_id), o: rows.slice(1, 4).map(x => cname(x.club_id)), src: [...srcTable(s), champ[s.id].src], tags: ["title", "champion"] });
  for (const row of rows) {
    if (!rowOk(s.id, row)) continue;
    const pos = row.pos, dpos = pos <= 4 ? 2 : pos >= rows.length - 2 ? 3 : 4;
    if (pos > 1) { const dis = near(rows, pos, 3, r).filter(x => rowOk(s.id, x)); if (dis.length === 3) Q({ t: "finished", cat: "competition", clubs: [row.club_id], season: y, d: dpos + (era(y) > 1 ? 1 : 0), q: `Who finished ${ord(pos)} in the Premier League?`, sub: label, a: cname(row.club_id), o: dis.map(x => cname(x.club_id)), src: srcTable(s), tags: ["title"] }); }
    // where did a club finish: options are nearby positions
    { const ps = shuffle([-3, -2, -1, 1, 2, 3].map(k => pos + k).filter(p => p >= 1 && p <= rows.length), r).slice(0, 3);
      Q({ t: "club-finish", cat: "club", clubs: [row.club_id], season: y, d: (pos === 1 ? 2 : dpos) + (era(y) > 1 ? 1 : 0), q: `Where did ${cname(row.club_id)} finish in the Premier League?`, sub: label, a: ord(pos), o: ps.map(ord), src: srcTable(s), tags: ["title"] }); }
    // points: only when Wikipedia's W/D and deduction give the same total
    { const w = WK[s.id][row.club_id], wpts = 3 * w.w + w.d + (w.adj || 0);
      if (wpts === row.pts) { const ps = shuffle([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6].map(k => row.pts + k).filter(p => p >= 0), r).slice(0, 3);
        Q({ t: "points", cat: "club", clubs: [row.club_id], season: y, d: pos === 1 ? 3 : 4, q: `How many points did ${cname(row.club_id)} finish on?`, sub: row.ded ? `PL ${label}, after a points deduction` : `Premier League ${label}`, a: row.pts, o: ps, src: [...srcTable(s), ...(row.ded ? ["wikipedia-table:" + y + " (deduction)"] : [])], tags: ["title"] }); } }
    // losses / unbeaten
    if (pos <= 4) { const ls = shuffle([1, 2, 3, 4, 5, 6].map(k => row.l + k).concat(row.l >= 2 ? [row.l - 1, row.l - 2] : []), r).slice(0, 3);
      Q({ t: "losses", cat: "club", clubs: [row.club_id], season: y, d: row.l === 0 ? 2 : 4, q: `How many league games did ${cname(row.club_id)} lose?`, sub: `Premier League ${label}`, a: row.l, o: ls, src: srcTable(s), tags: ["title"] }); }
  }
  // relegation: one of the bottom three (bottom four in 1994/95), against clubs that survived just above
  const nDown = rows.length === 22 ? (y === 1994 ? 4 : 3) : 3, down = rows.slice(-nDown).filter(x => rowOk(s.id, x)), safe = rows.slice(-nDown - 5, -nDown).filter(x => rowOk(s.id, x));
  if (y >= 1992 && safe.length >= 3) for (const dn of down) Q({ t: "relegated", cat: "competition", clubs: [dn.club_id], season: y, d: 3 + (era(y) > 1 ? 1 : 0), q: "Which of these clubs went down?", sub: `Premier League ${label}`, a: cname(dn.club_id), o: shuffle(safe, r).slice(0, 3).map(x => cname(x.club_id)), src: srcTable(s), tags: ["title"], key: "relegated|" + s.id + "|" + dn.club_id });
}
// titles by span of seasons (explicit ranges, never "so far")
{ const spans = [[1992, 1999, "the 1990s"], [2000, 2009, "the 2000s"], [2010, 2019, "the 2010s"]];
  for (const [a, b, name] of spans) {
    const ss = seasons.filter(s => s.start >= a && s.start <= b), n = {}; let ok = true;
    for (const s of ss) { const c = ST[s.id][0] && ST[s.id][0].club_id; if (!c || !champ[s.id] || champ[s.id].club_id !== c || !rowOk(s.id, ST[s.id][0])) ok = false; n[c] = (n[c] || 0) + 1; }
    if (!ok) { toReview("titles-span", name, "a season in the span isn't confirmed by both sources", null); continue; }
    const rank = Object.entries(n).sort((x, y) => y[1] - x[1]); if (rank.length < 2 || rank[0][1] === rank[1][1]) continue;
    const others = rank.slice(1).map(x => x[0]); const extra = ["arsenal", "chelsea", "liverpool", "man-utd", "man-city", "tottenham", "newcastle", "blackburn"].filter(c => c !== rank[0][0] && !others.includes(c));
    Q({ t: "titles-span", cat: "competition", clubs: [rank[0][0]], d: 2, q: `Who won the most Premier League titles in ${name}?`, sub: `${seasonLabel(a)} to ${seasonLabel(b)}`, a: cname(rank[0][0]), o: others.concat(extra).slice(0, 3).map(cname), src: ["openfootball:england (tables)", "wikidata:P1346 (season winners)"], tags: ["title", "champion"] });
  }
  // how many titles each champion club won between two named seasons
  const first = seasons[0].start, last = seasons.at(-1).start, n = {};
  let ok = seasons.every(s => champ[s.id] && ST[s.id][0] && champ[s.id].club_id === ST[s.id][0].club_id);
  if (ok) { seasons.forEach(s => { const c = ST[s.id][0].club_id; n[c] = (n[c] || 0) + 1; });
    for (const [c, k] of Object.entries(n)) { const ps = shuffle([-3, -2, -1, 1, 2, 3].map(x => k + x).filter(x => x >= 0), R).slice(0, 3);
      Q({ t: "title-count", cat: "club", clubs: [c], d: k >= 5 ? 2 : 3, q: `How many Premier League titles did ${cname(c)} win?`, sub: `${seasonLabel(first)} to ${seasonLabel(last)}`, a: k, o: ps, src: ["openfootball:england (tables)", "wikidata:P1346 (season winners)"], tags: ["title", "champion"] }); } }
  // the unbeaten season(s)
  const unbeaten = seasons.flatMap(s => ST[s.id].filter(r => r.l === 0 && rowOk(s.id, r)).map(r => ({ s, r })));
  for (const { s, r } of unbeaten) { const others = shuffle(seasons.filter(x => Math.abs(x.start - s.start) <= 6 && x.start !== s.start), R).slice(0, 3).map(x => seasonLabel(x.start));
    Q({ t: "unbeaten", cat: "club", clubs: [r.club_id], season: s.start, d: 2, q: `In which season did ${cname(r.club_id)} go the whole league season unbeaten?`, sub: "Premier League", a: seasonLabel(s.start), o: others, src: srcTable(s), tags: ["title"] }); }
}

/* ---------- matches: scores, big wins, head-to-heads (openfootball checked against engsoccerdata) ---------- */
const esMatch = db.prepare("SELECT hg, ag FROM verify_es WHERE season_id=? AND home_id=? AND away_id=?");
const matchOk = m => { const e = esMatch.all(m.season_id, m.home_id, m.away_id); return e.length === 1 && e[0].hg === m.hg && e[0].ag === m.ag; };
const fmtDate = d => d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
const RIVAL = [["arsenal", "tottenham"], ["liverpool", "everton"], ["man-utd", "man-city"], ["newcastle", "sunderland"], ["liverpool", "man-utd"], ["aston-villa", "birmingham"], ["brighton", "crystal-palace"], ["arsenal", "chelsea"], ["arsenal", "man-utd"], ["chelsea", "tottenham"], ["west-ham", "tottenham"], ["sheff-utd", "sheff-wed"], ["west-brom", "wolves"], ["portsmouth", "southampton"]];
const scoreOpts = (h, a, r) => { const c = new Set([`${h}-${a}`]), out = []; for (const [x, y] of shuffle([[a, h], [h + 1, a], [h, a + 1], [Math.max(0, h - 1), a], [h, Math.max(0, a - 1)], [h + 1, a + 1], [h + 2, a], [h, a + 2]], r)) { const s = `${x}-${y}`; if (!c.has(s)) { c.add(s); out.push(s); } } return out.slice(0, 3); };
let mUnverified = 0;
{
  const ms = all("SELECT m.*, s.start FROM matches m JOIN seasons s ON s.id = m.season_id WHERE s.complete = 1 AND m.status = 'ok' ORDER BY m.date");
  const isRival = m => RIVAL.some(([a, b]) => (m.home_id === a && m.away_id === b) || (m.home_id === b && m.away_id === a));
  for (const m of ms) {
    const margin = Math.abs(m.hg - m.ag), big = margin >= 5 || m.hg + m.ag >= 9, rival = isRival(m);
    if (!big && !rival) continue;
    const r = rng("m" + m.id);
    if (!matchOk(m)) { mUnverified++; if (big) toReview("score", m.id, m.start >= 2025 ? "only one source has this season (engsoccerdata stops at 2024/25)" : "openfootball and engsoccerdata disagree", { openfootball: `${m.hg}-${m.ag}`, engsoccerdata: esMatch.all(m.season_id, m.home_id, m.away_id).map(e => `${e.hg}-${e.ag}`) }); continue; }
    const src = [m.src, "engsoccerdata (verified)"];
    Q({ t: "score", cat: rival ? "club" : "competition", clubs: [m.home_id, m.away_id], season: m.start, d: rival ? (era(m.start) <= 1 ? 3 : 4) : 3, q: `${cname(m.home_id)} v ${cname(m.away_id)}: what was the score?`, sub: `Premier League, ${fmtDate(m.date)}`, a: `${m.hg}-${m.ag}`, o: scoreOpts(m.hg, m.ag, r), src, tags: rival ? ["derby", "score"] : ["score"], key: "score|" + m.id });
    if (margin >= 5) {   // who did the hammering
      const win = m.hg > m.ag ? m.home_id : m.away_id, lose = win === m.home_id ? m.away_id : m.home_id, hi = Math.max(m.hg, m.ag), lo = Math.min(m.hg, m.ag);
      const others = ST[m.season_id].filter(x => x.club_id !== win && x.club_id !== lose).sort((a, b) => Math.abs(a.pos - ST[m.season_id].find(z => z.club_id === win).pos) - Math.abs(b.pos - ST[m.season_id].find(z => z.club_id === win).pos)).slice(0, 6);
      Q({ t: "big-win", cat: "competition", clubs: [win, lose], season: m.start, d: era(m.start) <= 1 ? 3 : 4, q: `Who beat ${cname(lose)} ${hi}-${lo}?`, sub: `Premier League, ${fmtDate(m.date)}`, a: cname(win), o: shuffle(others, r).slice(0, 3).map(x => cname(x.club_id)), src, tags: ["score"], key: "bigwin|" + m.id });
    }
  }
  // head-to-heads over the seasons both sources cover
  // last season of an unbroken run in engsoccerdata (it has no 2022/23), so every meeting has two sources
  const esHas = new Set(all("SELECT DISTINCT season_id s FROM verify_es").map(r => r.s)); let esLast = seasons[0].start; while (esHas.has("pl-" + (esLast + 1))) esLast++;
  for (const [a, b] of RIVAL) {
    const games = ms.filter(m => m.start <= esLast && ((m.home_id === a && m.away_id === b) || (m.home_id === b && m.away_id === a)));
    if (games.length < 6) continue; if (!games.every(matchOk)) { toReview("h2h", a + "-" + b, "a meeting isn't confirmed by both sources", null); continue; }
    let wa = 0, wb = 0, dr = 0; games.forEach(m => { const ga = m.home_id === a ? m.hg : m.ag, gb = m.home_id === a ? m.ag : m.hg; if (ga > gb) wa++; else if (gb > ga) wb++; else dr++; });
    const ans = wa > wb ? cname(a) : wb > wa ? cname(b) : "Level";
    Q({ t: "h2h", cat: "club", clubs: [a, b], d: 3, q: `${cname(a)} v ${cname(b)}: who won more league meetings?`, sub: `Premier League, ${seasonLabel(seasons[0].start)} to ${seasonLabel(esLast)}`, a: ans, o: [cname(a), cname(b), "Level"].filter(x => x !== ans), src: ["openfootball:england (results)", "engsoccerdata (verified)"], tags: ["derby"], key: "h2h|" + a + "|" + b });
    const ps = shuffle([-4, -3, -2, -1, 1, 2, 3, 4].map(k => dr + k).filter(x => x >= 0), rng(a + b)).slice(0, 3);
    Q({ t: "h2h-draws", cat: "club", clubs: [a, b], d: 4, q: `${cname(a)} v ${cname(b)}: how many league meetings were draws?`, sub: `Premier League, ${seasonLabel(seasons[0].start)} to ${seasonLabel(esLast)}`, a: dr, o: ps, src: ["openfootball:england (results)", "engsoccerdata (verified)"], tags: ["derby"], key: "h2hd|" + a + "|" + b });
  }
}

/* ---------- players: Wikidata checked against the game's data.js (and FPL for current squads) ---------- */
const BDN = all("SELECT * FROM bd_players"), bdById = Object.fromEntries(BDN.map(p => [p.idx, p]));
const NAT_ALIAS = { "ireland": "rep of ireland", "republic of ireland": "rep of ireland", "united states": "usa", "united states of america": "usa", "cote divoire": "ivory coast", "democratic republic of the congo": "dr congo", "republic of the congo": "congo", "bosnia and herzegovina": "bosnia", "turkiye": "turkey", "czechia": "czech republic", "korea republic": "south korea", "people s republic of china": "china" };
const natKey = s => { const k = fold(s); return NAT_ALIAS[k] || k; };
const POSNAME = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
const players = all(`SELECT p.*, b.fame, b.nat AS bd_nat, b.pos AS bd_pos, b.spells AS bd_spells FROM players p JOIN bd_players b ON b.idx = p.bd_idx`);
const spellsOf = db.prepare("SELECT * FROM spells WHERE player_q = ? AND kind = 'club' ORDER BY start");
const plSpells = db.prepare("SELECT DISTINCT club_id FROM spells WHERE player_q = ? AND club_id IS NOT NULL AND kind = 'club'");
const active = q => !!one("SELECT 1 x FROM spells WHERE player_q=? AND end_date IS NULL AND kind='club' AND start >= '2018'", q);   // still playing, as far as Wikidata knows
const fameD = f => f >= 5.6 ? 1 : f >= 4.8 ? 2 : f >= 4 ? 3 : 4;
const clubKey = s => fold(s).replace(/\b(f ?c|a ?f ?c|c ?f|s ?c|a ?c|s ?s|s ?v|club|football|calcio|de|futbol|cf|fk|sk|the)\b/g, " ").replace(/\s+/g, " ").trim();
const sameClub = (a, b) => { const x = clubKey(a), y = clubKey(b); return !!x && !!y && (x === y || x.startsWith(y + " ") || y.startsWith(x + " ")); };
const nameOfClub = (label, cid) => cid ? cname(cid) : label.replace(/\s+(F\.C\.|A\.F\.C\.|FC|AFC|C\.F\.|CF)$/, "").replace(/^(FC|AFC|AC|AS|SS|SV|RC|CF|SC|SL|FK|SK)\s+/, "").trim();
const BIG_CLUBS = ["Real Madrid", "Barcelona", "Bayern Munich", "Juventus", "AC Milan", "Inter", "PSG", "Atlético Madrid", "Dortmund", "Ajax", "Porto", "Benfica", "Lyon", "Marseille", "Roma", "Napoli", "Valencia", "Sevilla", "Celtic", "Rangers"];
const plPlayers = players.filter(p => plSpells.all(p.q).length);
const natPool = {};   // nationality -> how many PL players, for realistic distractors
for (const p of plPlayers) if (p.bd_nat) natPool[p.bd_nat] = (natPool[p.bd_nat] || 0) + 1;
const natList = Object.entries(natPool).sort((a, b) => b[1] - a[1]).map(x => x[0]);
let natDis = 0, posDis = 0;
for (const p of plPlayers) {
  const clubs = plSpells.all(p.q).map(x => x.club_id), r = rng("p" + p.q), d = fameD(p.fame);
  if (p.fame < 3.6) continue;   // too obscure to be fair
  const src = ["wikidata:" + p.q, "data.js:" + p.bd_idx];
  // nationality: Wikidata (country for sport) must match data.js
  if (p.nat && p.bd_nat) {
    if (natKey(p.nat) !== natKey(p.bd_nat)) { natDis++; toReview("nationality", p.q, "Wikidata and data.js disagree", { player: p.name, wikidata: p.nat, datajs: p.bd_nat }); }
    else { const pool = natList.filter(n => natKey(n) !== natKey(p.bd_nat)); const top = pool.slice(0, 30); Q({ t: "nationality", cat: "club", clubs, d: d + (["England", "France", "Spain", "Brazil"].includes(p.bd_nat) ? 0 : 1), q: `What nationality is ${p.name}?`, sub: p.pos && p.pos === p.bd_pos ? `${POSNAME[p.pos]}, born ${p.birth_year}` : `Born ${p.birth_year}`, a: p.bd_nat, o: shuffle(top, r).slice(0, 3), src, tags: ["player"], key: "nat|" + p.q }); }
  }
  // position: Wikidata must match data.js
  if (p.pos && p.bd_pos) {
    if (p.pos !== p.bd_pos) posDis++;
    else Q({ t: "position", cat: "club", clubs, d: Math.min(4, d + 1), q: `What position ${active(p.q) ? "does" : "did"} ${p.name} play?`, sub: `Born ${p.birth_year}`, a: POSNAME[p.pos], o: Object.values(POSNAME).filter(x => x !== POSNAME[p.pos]), src, tags: ["player"], key: "pos|" + p.q });
  }
  // transfers: consecutive club spells in Wikidata that data.js also has, same year
  const ws = spellsOf.all(p.q).filter(s => s.start), bs = JSON.parse(p.bd_spells);
  for (let k = 1; k < ws.length; k++) {
    const from = ws[k - 1], to = ws[k], yr = +to.start.slice(0, 4);
    if (from.club_q === to.club_q || yr < 1992) continue;
    const bi = bs.findIndex((x, j) => j > 0 && x[1] === yr && sameClub(x[0], to.club_id ? cbd(to.club_id) : to.club_label) && sameClub(bs[j - 1][0], from.club_id ? cbd(from.club_id) : from.club_label));
    if (bi < 0) continue;
    if (!from.club_id && !to.club_id) continue;   // keep it about the Premier League
    const ans = to.club_id ? cname(to.club_id) : bs[bi][0], fromN = from.club_id ? cname(from.club_id) : bs[bi - 1][0];   // data.js names are the short ones the game already uses
    const career = new Set([...ws.map(s => clubKey(nameOfClub(s.club_label, s.club_id))), ...bs.map(s => clubKey(s[0]))]);
    const pool = to.club_id ? ST["pl-" + yr] ? ST["pl-" + yr].map(x => cname(x.club_id)) : CLUBS.filter(c => c.of.length).map(c => c.name) : BIG_CLUBS;
    const dis = shuffle(pool.filter(c => !career.has(clubKey(c)) && clubKey(c) !== clubKey(ans)), r).slice(0, 3);
    if (dis.length < 3) continue;
    Q({ t: "transfer", cat: "club", clubs: [from.club_id, to.club_id].filter(Boolean), season: yr, d: Math.min(4, d + 1), q: `Which club did ${p.name} join from ${fromN}?`, sub: `In ${yr}`, a: ans, o: dis, src: ["wikidata:" + p.q + "#P54", "data.js:" + p.bd_idx], tags: ["player", "transfer"], key: "tr|" + p.q + "|" + yr });
  }
}
// never played for: three who did (both sources), one who didn't (neither source), same era and position
for (const c of CLUBS.filter(c => c.of.length)) {
  const did = plPlayers.filter(p => p.fame >= 3.8 && plSpells.all(p.q).some(x => x.club_id === c.id) && JSON.parse(p.bd_spells).some(s => sameClub(s[0], c.bd)));
  const didnt = plPlayers.filter(p => p.fame >= 4.2 && !plSpells.all(p.q).some(x => x.club_id === c.id) && !spellsOf.all(p.q).some(s => s.club_q === c.q) && !JSON.parse(p.bd_spells).some(s => sameClub(s[0], c.bd)));
  if (did.length < 9 || didnt.length < 3) continue;
  const n = c.id === "arsenal" ? 60 : Math.min(18, Math.floor(did.length / 3)), r = rng("np" + c.id), used = new Set();
  for (let g = 0, made = 0; made < n && g < n * 6; g++) {
    const three = shuffle(did.filter(p => !used.has(p.q)), r).slice(0, 3); if (three.length < 3) break;
    const by = three.reduce((s, p) => s + p.birth_year, 0) / 3, pos = three[0].bd_pos;
    const cand = didnt.filter(p => Math.abs(p.birth_year - by) <= 4 && (p.bd_pos === pos || r() < .3));
    const o = cand[Math.floor(r() * cand.length)]; if (!o) continue;
    three.forEach(p => used.add(p.q));
    const d = Math.round((fameD(three[0].fame) + fameD(three[1].fame) + fameD(three[2].fame) + fameD(o.fame)) / 4);
    Q({ t: "never-played", cat: "club", clubs: [c.id], d, q: `Which of these never played for ${c.name}?`, sub: "", a: o.name, o: three.map(p => p.name), src: ["wikidata:P54 " + [o, ...three].map(p => p.q).join(","), "data.js (careers)"], tags: ["player"], key: "np|" + c.id + "|" + [o, ...three].map(p => p.q).sort().join(",") });
    made++;
  }
}
// current squads: FPL and Wikidata must agree on the club (FPL has no birth dates, so the link is name + club)
const gw = +((one("SELECT v FROM meta WHERE k='fpl_gw'") || {}).v || 0);
const monthYear = new Date(ASOF).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const fplClubs = [...new Set(all("SELECT club_id FROM fpl_players").map(r => r.club_id))];
for (const f of all("SELECT f.*, p.name, p.birth_year, b.fame FROM fpl_players f JOIN players p ON p.q = f.player_q LEFT JOIN bd_players b ON b.idx = p.bd_idx WHERE f.minutes >= 270")) {
  const open = all("SELECT DISTINCT club_id, club_q FROM spells WHERE player_q=? AND end_date IS NULL AND kind='club'", f.player_q);
  if (open.length !== 1 || open[0].club_id !== f.club_id) { toReview("current-club", f.player_q, "FPL and Wikidata disagree or Wikidata has more than one open spell", { player: f.name, fpl: cname(f.club_id), wikidata: open.map(o => o.club_id || o.club_q) }); continue; }
  const r = rng("cc" + f.id), d = f.fame ? fameD(f.fame) : f.minutes >= 900 ? 3 : 4;
  Q({ t: "current-club", cat: "club", clubs: [f.club_id], d, q: `Which club was ${f.name} playing for in ${monthYear}?`, sub: "Premier League", a: cname(f.club_id), o: shuffle(fplClubs.filter(c => c !== f.club_id), r).slice(0, 3).map(cname), src: ["fpl:element " + f.id + " (gameweek " + gw + ")", "wikidata:" + f.player_q + "#P54"], tags: ["player"], key: "cc|" + f.player_q });
  if (f.pos && (one("SELECT pos FROM players WHERE q=?", f.player_q) || {}).pos === f.pos)
    Q({ t: "position", cat: "club", clubs: [f.club_id], d: Math.min(4, d), q: `What position does ${f.name} play?`, sub: `${cname(f.club_id)}, ${monthYear}`, a: POSNAME[f.pos], o: Object.values(POSNAME).filter(x => x !== POSNAME[f.pos]), src: ["fpl:element " + f.id, "wikidata:" + f.player_q + "#P413"], tags: ["player"], key: "pos|" + f.player_q });
}

/* ---------- write everything ---------- */
out.sort((a, b) => a.t.localeCompare(b.t) || (a.y || 0) - (b.y || 0) || a.id.localeCompare(b.id));
const BANK_V = ASOF.replace(/-/g, "");
/* Shipped format (compact; one question per line so weekly diffs are readable):
   [id, template#, category (0 competition, 1 club), difficulty 1-4, season start year or 0, [club#...], question, subtitle, answer, [wrong answers], [sources], tag bits]
   Source ids are shortened: of = openfootball file#line, wd = Wikidata, wp = Wikipedia table (check only), es = engsoccerdata (check only), bd = data.js row, fpl = FPL element. */
const TPL = [...new Set(out.map(q => q.t))].sort(), KL = [...new Set(out.flatMap(q => q.k))].sort();
const TAGS = ["title", "champion", "derby", "score", "player", "transfer"];
const shortSrc = x => x.replace("openfootball:england/", "of:").replace("openfootball:england", "of").replace(/^wikipedia-table:/, "wp:").replace(" (verified)", "").replace(/^wikidata:/, "wd:").replace(/^engsoccerdata/, "es").replace(/^data\.js:?/, "bd:").replace(/^fpl:element /, "fpl:").replace(" (gameweek ", "/gw").replace(/\)$/, "");
const rows = out.map(q => JSON.stringify([q.id, TPL.indexOf(q.t), q.cat === "club" ? 1 : 0, q.d, q.y || 0, q.k.map(c => KL.indexOf(c)), q.q, q.sub, q.a, q.o, q.src.map(shortSrc), q.tags.reduce((b, t) => b | (TAGS.indexOf(t) >= 0 ? 1 << TAGS.indexOf(t) : 0), 0)]));
fs.writeFileSync(path.join(REPO, "questions.js"), `// Boffin Matchday question bank. GENERATED by data-pipeline/generate.mjs on ${ASOF}; don't edit by hand.
// Every question was checked against two independent sources (see the sources column). Credits and licences: SOURCES.md.
// Row: [id, template, category 0=competition 1=club, difficulty 1-4, season, [clubs], question, subtitle, answer, [wrong answers], [sources], tags]
window.BOFFIN_Q = { v: "${BANK_V}", asOf: "${ASOF}", n: ${out.length},
t: ${JSON.stringify(TPL)},
k: ${JSON.stringify(KL)},
tags: ${JSON.stringify(TAGS)},
q: [
${rows.join(",\n")}
] };
`);
writeJSON(path.join(REPORTS, "review.json"), { asOf: ASOF, note: "Facts the pipeline would not publish: sources disagree, or only one source has them. Nothing here ships.", count: review.length, items: review });
writeReport();
console.log("[generate] questions", out.length, "review items", review.length, "rejects", Object.values(rejects).reduce((s, x) => s + x.length, 0));

function writeReport() {
  const by = (f) => { const o = {}; out.forEach(q => { const k = f(q); o[k] = (o[k] || 0) + 1; }); return o; };
  const tbl = (o, h) => `| ${h} | Questions |\n|---|---:|\n` + Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  const byTD = {}; out.forEach(q => { (byTD[q.t] = byTD[q.t] || [0, 0, 0, 0])[q.d - 1]++; });
  const revBy = {}; review.forEach(x => { const k = x.template + ": " + x.reason; revBy[k] = (revBy[k] || 0) + 1; });
  const md = `# Question bank validation report

Generated ${ASOF} by \`data-pipeline/generate.mjs\`. Bank version \`${BANK_V}\`.

**${out.length} questions published.** Each one is backed by two independent sources (listed in its \`src\`).
${review.length} facts held back for review (\`reports/review.json\`); ${Object.values(rejects).reduce((s, x) => s + x.length, 0)} rejected on shape (below).

## By template and difficulty (1 easiest, 4 hardest)

| Template | d1 | d2 | d3 | d4 | Total |
|---|---:|---:|---:|---:|---:|
${Object.entries(byTD).sort((a, b) => a[0].localeCompare(b[0])).map(([t, d]) => `| ${t} | ${d.join(" | ")} | ${d.reduce((s, x) => s + x, 0)} |`).join("\n")}

${tbl(by(q => q.cat), "Category")}

## Club coverage (questions tagged with each club, used by Club Cup)

${tbl(by(q => q.k.length ? q.k.join(" / ").length < 40 && q.k.length === 1 ? q.k[0] : "(several clubs)" : "(none)"), "Club")}

## League tables rebuilt from results vs Wikipedia's final tables

Every finished season's table is rebuilt from openfootball's results (3 points a win, deductions applied; order by points, goal difference, goals scored) and compared row by row with the Wikipedia season article. Champions are also compared with Wikidata.

| Season | Rows | Mismatches | Our champion | Wikidata champion | Deductions |
|---|---:|---:|---|---|---|
${tableChecks.map(c => `| ${c.season} | ${c.rows} | ${c.mismatches.length} | ${c.champion} | ${c.wikidataChampion} | ${c.deductions.join(", ")} |`).join("\n")}

${tableChecks.some(c => c.mismatches.length) ? "Mismatched rows (not used for questions):\n\n" + tableChecks.filter(c => c.mismatches.length).map(c => `- ${c.season}: ${c.mismatches.join("; ")}`).join("\n") : "No mismatches."}

## Held back for review

${Object.keys(revBy).length ? tbl(revBy, "Reason") : "Nothing."}

Matches not confirmed by engsoccerdata (big wins and derbies only): ${mUnverified}. Nationality disagreements: ${natDis}. Position disagreements (skipped silently, usually winger vs forward): ${posDis}.

## Rejected on shape

${Object.keys(rejects).length ? Object.entries(rejects).map(([k, v]) => `- **${k}**: ${v.length}${v.length <= 5 ? " (" + v.join("; ") + ")" : " (e.g. " + v.slice(0, 3).join("; ") + ")"}`).join("\n") : "None."}

## Limits used (so questions fit a phone without scrolling)

Question ${LIMITS.q} characters, subtitle ${LIMITS.sub}, each answer ${LIMITS.opt}.
`;
  fs.writeFileSync(path.join(REPORTS, "validation.md"), md);
}
