// Step 1: download every source into data-pipeline/cache/ (gitignored). Safe to re-run: cached files are reused
// until they're older than the max age below. Usage: node fetch.mjs [--fresh]
import fs from "node:fs";
import path from "node:path";
import { get, sparql, CACHE, seasonPath } from "./lib/util.mjs";
import { PL_FIRST, plCurrentStart } from "./config/scope.mjs";

const fresh = process.argv.includes("--fresh"), age = h => fresh ? 0 : h;
const log = (...a) => console.log("[fetch]", ...a);

// --- openfootball (CC0): Premier League results, one Football.TXT file per season ---
const OF = "https://raw.githubusercontent.com/openfootball/england/master/";
const ofPath = y => (y < 2000 ? "archive/1990s/" : "") + seasonPath(y) + "/1-premierleague.txt";
let ofN = 0;
for (let y = PL_FIRST; y <= plCurrentStart(); y++) {
  const t = get(OF + ofPath(y), { file: "openfootball/england/" + seasonPath(y) + ".txt", maxAgeH: age(y >= plCurrentStart() - 1 ? 20 : 24 * 30) });
  if (t) ofN++; else log("no openfootball file for", seasonPath(y));
}
log("openfootball PL seasons:", ofN);

// --- engsoccerdata (GPL >= 2): England results 1888-2024/25. VERIFICATION ONLY: never shipped, never committed ---
get("https://raw.githubusercontent.com/jalapic/engsoccerdata/master/data-raw/england.csv", { file: "verify/engsoccerdata-england.csv", maxAgeH: age(24 * 30) });
log("engsoccerdata cached (verification only)");

// --- Fantasy Premier League (unofficial, keyless): current squads and positions. Fetched once per run at most,
//     cached for 20h, never committed; only derived facts (name, club, position) are used. Photos are never touched. ---
get("https://fantasy.premierleague.com/api/bootstrap-static/", { file: "fpl/bootstrap-static.json", maxAgeH: age(20) });
log("FPL bootstrap cached");

// --- Wikipedia season articles (CC BY-SA): VERIFICATION ONLY. The final table (W/D/L/GF/GA, order, points deductions)
//     is used to check the table rebuilt from openfootball results. Nothing from it is shipped or committed. ---

// --- Wikidata (CC0) ---
// Premier League seasons: winner and participating clubs (gives each club's Q-ID).
sparql("pl-seasons", `SELECT ?s ?sLabel ?start ?winner ?team ?teamLabel WHERE {
  ?s wdt:P3450 wd:Q9448 . OPTIONAL { ?s wdt:P580 ?start } OPTIONAL { ?s wdt:P1346 ?winner } OPTIONAL { ?s wdt:P1923 ?team }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`, age(24 * 6));
log("wikidata: PL seasons");
const clubQs = new Set(sparql("pl-seasons", "").map(r => r.team).filter(Boolean).map(u => u.replace(/^.*\//, "")));
// clubs that only appear in seasons Wikidata lists no teams for: looked up by the alias table in config/clubs.mjs
const { CLUBS } = await import("./config/clubs.mjs");
for (const c of CLUBS) if (c.q && c.of.length) clubQs.add(c.q);
log("wikidata: clubs to query", clubQs.size);

// Club facts: names, founding, home venues with dates.
const V = [...clubQs].map(q => "wd:" + q).join(" ");
sparql("pl-clubs", `SELECT ?c ?cLabel ?inception ?venue ?venueLabel ?vstart ?vend WHERE {
  VALUES ?c { ${V} } OPTIONAL { ?c wdt:P571 ?inception }
  OPTIONAL { ?c p:P115 ?vs . ?vs ps:P115 ?venue . OPTIONAL { ?vs pq:P580 ?vstart } OPTIONAL { ?vs pq:P582 ?vend } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`, age(24 * 13));
log("wikidata: club facts");

// Players: everyone with a P54 spell at a PL club. One query per club keeps each under the timeout.
// Deliberately NOT filtered by "youth team" classes (that drops real first-team spells, e.g. Messi at Barcelona).
let pN = 0;
for (const q of clubQs) {
  const rows = sparql("players/" + q, `SELECT DISTINCT ?p WHERE { ?p p:P54 ?st . ?st ps:P54 wd:${q} . ?p wdt:P106 wd:Q937857 .
    OPTIONAL { ?st pq:P582 ?end } FILTER(!BOUND(?end) || YEAR(?end) >= 1992) }`, age(24 * 6));
  pN += rows.length;
}
log("wikidata: player-club links", pN);
const players = new Set();
for (const q of clubQs) for (const r of sparql("players/" + q, "")) players.add(r.p.replace(/^.*\//, ""));
log("wikidata: distinct players", players.size);

// Bios and full careers for those players, in batches.
const all = [...players].sort(), B = 150;
for (let i = 0; i < all.length; i += B) {
  const vals = all.slice(i, i + B).map(q => "wd:" + q).join(" "), n = String(i / B).padStart(3, "0");
  sparql("bios/" + n, `SELECT ?p ?pLabel ?dob ?natSport ?natSportLabel ?cit ?citLabel ?pos ?posLabel WHERE { VALUES ?p { ${vals} }
    OPTIONAL { ?p wdt:P569 ?dob } OPTIONAL { ?p wdt:P1532 ?natSport } OPTIONAL { ?p wdt:P27 ?cit } OPTIONAL { ?p wdt:P413 ?pos }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`, age(24 * 13));
  sparql("careers/" + n, `SELECT ?p ?club ?clubLabel ?start ?end ?nt WHERE { VALUES ?p { ${vals} }
    ?p p:P54 ?st . ?st ps:P54 ?club . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
    OPTIONAL { ?club wdt:P31 ?nt . FILTER(?nt IN (wd:Q6979593, wd:Q1194951)) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`, age(24 * 6));
}
log("wikidata: bios and careers in", Math.ceil(all.length / B), "batches");

const titles = [...new Set(sparql("pl-seasons", "").map(r => r.sLabel).filter(t => /^\d{4}\u2013\d{2,4} (FA )?Premier League$/.test(t)))];
for (const t of titles) {
  const y = +t.slice(0, 4); if (y > plCurrentStart()) continue;
  get("https://en.wikipedia.org/w/index.php?action=raw&title=" + encodeURIComponent(t.replace(/ /g, "_")), { file: "verify/wikipedia/" + y + ".txt", maxAgeH: age(y >= plCurrentStart() - 1 ? 20 : 24 * 60) });
}
log("wikipedia season tables cached (verification only):", titles.length);
log("done. cache:", path.relative(process.cwd(), CACHE), fs.readdirSync(CACHE).join(", "));
