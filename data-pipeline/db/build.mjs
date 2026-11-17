// football.db → small JSON chunks the game loads on demand.
//   node --no-warnings data-pipeline/db/build.mjs            (or: npm run chunks, from data-pipeline/)
// Reads data-pipeline/db/football.db (unpacked from football.db.gz on first run), data.js (to link players), and writes data/x/*.json
// plus data/x/manifest.json and data-pipeline/db/report.md (what was fixed, dropped and why). Deterministic: same db in, same files out.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SOURCES, FIRST_PL, OUT_DIR, KNOWN_CLUB_MIN_PLAYERS } from "./config.mjs";
import { ROOT, HERE, openDb, loadGame, dataSig, tidyClub, isPro, norm, PL_BY_Q } from "./lib.mjs";
import { resolvePeople, fameOf, tierOfFame } from "./people.mjs";
import * as scores from "./chunks/scores.mjs";
import * as tables from "./chunks/tables.mjs";
import * as mates from "./chunks/mates.mjs";
import * as careers from "./chunks/careers.mjs";
import * as flags from "./chunks/flags.mjs";
import * as scorers from "./chunks/scorers.mjs";

export function build({ outDir = path.join(ROOT, OUT_DIR), quiet = false } = {}) {
  const { q, one } = openDb(), game = loadGame(), stats = {}, notes = [];
  const log = (...a) => quiet || console.log(...a);

  /* ---- clubs: fix, name, flag ---- */
  const clubs = new Map();
  for (const c of q("select club_id id, name, short_name, wikidata_qid qid, played_premier_league pl, lat, lon from clubs")) {
    let name, pl = !!c.pl, qid = c.qid;
    if (c.id === 99) { // labelled "AFC Wimbledon" but it is the old Wimbledon FC (354 spells 1921-2004, all the 1992-2000 Premier League seasons)
      name = "Wimbledon"; qid = "Q19482"; pl = true;
      notes.push("Club 99 is labelled “AFC Wimbledon” but holds Wimbledon FC (1921-2004): renamed to Wimbledon. The real AFC Wimbledon is not in the club table.");
    } else {
      const conf = PL_BY_Q[qid];
      name = tidyClub(c.name, conf ? conf.name : null);
    }
    clubs.set(c.id, { id: c.id, name, pl, qid, raw: c.name });
  }
  // a spell's club: its club row, or the raw name tidied
  // Wikidata has the odd country filed as a club ("India"): never a club
  const nations = new Set(game.NAT.map(n => norm(n)));
  const spellClub = s => {
    const n = (s.club_id !== null && s.club_id !== undefined ? clubs.get(s.club_id)?.name : tidyClub(s.club_name)) || null;
    return n && nations.has(norm(n)) ? null : n;
  };

  /* ---- people ---- */
  const P = resolvePeople({ q, game, stats });
  const people = P.people;

  /* ---- appearances (FPL): per person games/minutes, per club-season ---- */
  const app = { byPerson: new Map(), byMatch: new Map(), clubSeason: new Map(), has: false };
  if (SOURCES.fpl) {
    app.has = true;
    for (const r of q("select a.match_id mid, a.player_id pid, a.club_id cid, a.minutes mins, a.goals g, m.season s, m.date d from appearances a join matches m using(match_id) where m.competition_id=1 and a.minutes>0")) {
      const id = P.cid(r.pid);
      if (!people.has(id)) continue;
      let a = app.byPerson.get(id);
      if (!a) app.byPerson.set(id, (a = { games: 0, mins: 0, goals: 0, seasons: new Set(), clubs: new Set() }));
      a.games++; a.mins += r.mins; a.goals += r.g; a.seasons.add(r.s); a.clubs.add(r.cid);
      let m = app.byMatch.get(r.mid);
      if (!m) app.byMatch.set(r.mid, (m = new Map()));
      if (!m.has(r.cid)) m.set(r.cid, []);
      m.get(r.cid).push(id);
      const k = r.s + "|" + r.cid + "|" + id;
      let cs = app.clubSeason.get(r.s + "|" + r.cid);
      if (!cs) app.clubSeason.set(r.s + "|" + r.cid, (cs = new Map()));
      const x = cs.get(id) || { mins: 0, games: 0 };
      x.mins += r.mins; x.games++;
      cs.set(id, x);
    }
  }

  /* ---- careers: men's club spells only ---- */
  const wdApps = new Map(), spells = new Map(), clubPeople = new Map(), incomplete = new Set(), rawClubs = new Map();
  for (const s of q("select player_id pid, club_id, club_name, start_date s, end_date e, apps, goals from player_clubs")) {
    const id = P.cid(s.pid);
    if (!people.has(id)) continue;
    if (!rawClubs.has(id)) rawClubs.set(id, new Set());
    rawClubs.get(id).add(norm(s.club_name || clubs.get(s.club_id)?.raw || "")); // every club he has any record at, youth and B teams too: a "never played for" decoy must clear all of them
    const name = spellClub(s);
    if (!name) { if (isPro(s.club_name) && !nations.has(norm(s.club_name))) incomplete.add(id); continue; } // a real club we can't name cleanly: his career list would have a hole in it
    if (s.club_id === null && !s.s) incomplete.add(id);
    if (s.club_id !== null && clubs.get(s.club_id)?.pl) wdApps.set(id, (wdApps.get(id) || 0) + (s.apps || 0));
    if (!spells.has(id)) spells.set(id, []);
    spells.get(id).push({ club: name, cid: s.club_id, s: s.s, e: s.e, apps: s.apps });
    if (!clubPeople.has(name)) clubPeople.set(name, new Set());
    clubPeople.get(name).add(id);
  }
  for (const [id, p] of people) {
    p.fame = fameOf(p, game.PL, app.byPerson.get(id), wdApps.get(id));
    p.d = tierOfFame(p.fame);
  }
  const knownClub = n => (clubPeople.get(n)?.size || 0) >= KNOWN_CLUB_MIN_PLAYERS;

  const ctx = { q, one, game, stats, notes, SOURCES, clubs, spellClub, P, people, app, spells, wdApps, clubPeople, incomplete, rawClubs, knownClub, log, FIRST_PL };

  /* ---- Pin the Ground: the database's grounds as a cross-check on the 91 the game already has (nothing shipped from it) ---- */
  {
    const km = (a, b, c, d) => { const t = x => (x * Math.PI) / 180, h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
    const V = q("select v.name, v.lat, v.lon from venues v"), off = [];
    let same = 0;
    for (const g of game.GROUNDS) { const v = V.find(x => x.name === g.s); if (!v) continue; const d = km(g.la, g.ln, v.lat, v.lon); if (d > 0.3) off.push(`${g.c} (${g.s}) ${d.toFixed(1)} km`); else same++; }
    stats.pinGroundsCompared = same + off.length; stats.pinGroundsAgree = same;
    notes.push(`Pin the Ground: the database's 51 grounds are older and fewer than the game's 91 (e.g. it still has Brentford at Griffin Park, Stoke's old Britannia name, one ground with no name). Used only as a cross-check: ${same} of ${same + off.length} shared grounds agree within 300 m; the rest are the database being out of date: ${off.join("; ") || "none"}. The game's own list stays.`);
  }

  /* ---- chunks ---- */
  const files = {};
  const put = (name, obj) => { files[name] = obj; };
  for (const mod of [scores, tables, mates, careers, flags, scorers]) {
    const out = mod.build(ctx);
    for (const [k, v] of Object.entries(out)) put(k, v);
  }

  /* ---- write ---- */
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const sig = dataSig(game.PL), manifest = { v: "", built: new Date().toISOString().slice(0, 10), sig, sources: { ...SOURCES }, chunks: {} };
  const hashAll = crypto.createHash("sha256");
  for (const [name, obj] of Object.entries(files).sort()) {
    const body = JSON.stringify({ sig, ...obj });
    const h = crypto.createHash("sha256").update(body).digest("hex").slice(0, 8), file = `${name}.${h}.json`;
    fs.writeFileSync(path.join(outDir, file), body);
    hashAll.update(name + h);
    manifest.chunks[name] = { file, bytes: Buffer.byteLength(body), n: obj._n ?? null };
  }
  manifest.v = hashAll.digest("hex").slice(0, 8);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest));

  /* ---- report ---- */
  const kb = n => (n / 1024).toFixed(0) + " KB";
  const total = Object.values(manifest.chunks).reduce((a, c) => a + c.bytes, 0);
  const rep = [
    `# 1X2 database build report`, ``, `Built ${manifest.built} by \`node --no-warnings data-pipeline/db/build.mjs\`. Data signature \`${sig}\` (the game refuses chunks built against a different data.js).`,
    `Sources on: ${Object.entries(SOURCES).map(([k, v]) => k + "=" + v).join(", ")}.`, ``,
    `## Chunks (${kb(total)} raw, loaded only when a mode needs them)`, ``, `| Chunk | Size | Items |`, `|---|---:|---:|`,
    ...Object.entries(manifest.chunks).map(([k, c]) => `| ${k} | ${kb(c.bytes)} | ${c.n ?? ""} |`), ``,
    `## What the script fixed or dropped`, ``, ...notes.map(n => "- " + n), ``,
    `## Counts`, ``, ...Object.entries(stats).map(([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`), ``
  ].join("\n");
  fs.writeFileSync(path.join(HERE, "report.md"), rep);
  log(rep);
  return { manifest, files, ctx };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) build();
