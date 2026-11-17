// Shared helpers for the 1X2 database build: opening the db, the game's own data (data.js), name tidying, people.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { OVERRIDES, MONONYMS } from "./config.mjs";
import { CLUBS as PLCONF } from "../config/clubs.mjs";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(HERE, "..", "..");

/* ---------- the database ----------
   football.db is 58 MB, so the repo keeps a gzipped copy (football.db.gz, 17 MB) and unpacks it on first run.
   Drop a fresher football.db next to it and the script uses that instead (and you should re-gzip it before committing). */
export function openDb() {
  const db = path.join(HERE, "football.db"), gz = db + ".gz";
  if (!fs.existsSync(db)) {
    if (!fs.existsSync(gz)) throw new Error("No football.db or football.db.gz in " + HERE);
    fs.writeFileSync(db, zlib.gunzipSync(fs.readFileSync(gz)));
  }
  const d = new DatabaseSync(db, { readOnly: true });
  return { d, q: (s, ...a) => d.prepare(s).all(...a), one: (s, ...a) => d.prepare(s).get(...a) };
}

/* ---------- the game's data (data.js) ---------- */
export function loadGame() {
  const sb = { window: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"), sb);
  const BD = sb.window.BD, sb2 = { window: {} };
  vm.createContext(sb2);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "grounds.js"), "utf8"), sb2);
  return { BD, PL: BD.players, CLUB: BD.clubs, NAT: BD.nats, GROUNDS: sb2.window.GROUNDS };
}
// same FNV hash as src/core.js: the game recomputes this from its own data.js and refuses chunks built against a different one
export const hash = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const dataSig = PL => hash(PL.map(p => p[0]).join("|")).toString(36);
// same folding as src/core.js norm()
export const norm = s =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/ı/g, "i")
    .replace(/['’]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- clubs ---------- */
// Premier League clubs: the names the rest of the game uses, keyed by Wikidata id
export const PL_BY_Q = Object.fromEntries(PLCONF.filter(c => c.q).map(c => [c.q, c]));
const BAD_CLUB = /regional|\bXI$|league xi|selection|select team|\b[BC]$|women|ladies|\bW\.?F\.?C\b|\bL\.?F\.?C\b|national|olympic|under-?\s?\d|\bU-?\d\d\b|reserves?|academy|youth|\bII\b|\bIII\b|castilla|next gen|\bjong\b|\bB team\b|\bsecond team\b|rugby|\bfutsal\b|\bbeach\b|college|university|bulls|pirates|paladins|\bfc dallas\b.*\bu\d/i;
export const isPro = n => !!n && !BAD_CLUB.test(n) && OVERRIDES[n] !== null; // an override of null = a reserve side: not a club we show, and not a hole in anyone's career
const WOMEN = /women|ladies|\bW\.?F\.?C\b|\bL\.?F\.?C\b|women's/i;
export const isWomen = n => WOMEN.test(n || "");
const LEAD = /^(?:(?:FC|AFC|SC|CF|AS|AC|SV|SK|FK|NK|RC|RCD|US|SS|UD|CD|CA|SD|SSC|KV|KRC|KAA|RSC|RS|ACF|AEK|GNK|HNK|JK|KF|MSV|OGC|SCO|TSG|TSV|VfL|VfB|PFC|ŠK|1\.|(?:[A-Z]\.){2,4})\s+)+/;
const TRAIL = /\s+(?:(?:A\.?F\.?C|F\.?C|C\.?F|S\.?C|A\.?C)\.?|Football Club|Calcio|Fotboll|Fotbal|BK|IF|FF|OSC|CFC|FCO|SCO|FCS|SFC|(?:[A-Z]\.){2,4})$/;
/* a club's display name, or null if it can't be made clean enough to show */
export function tidyClub(raw, plName) {
  if (plName) return plName;
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, raw)) return OVERRIDES[raw];
  if (!isPro(raw)) return null;
  let s = raw.trim().replace(/\s*\((?:19|20)\d\d\)$/, "").replace(/\s+(?:18|19|20)\d\d$/, ""), prev;
  do {
    prev = s;
    s = s.replace(TRAIL, "").replace(/\s+Club de F[uú]tbol$/i, "").replace(/\s+F\.C\.\s+/g, " ");
  } while (s !== prev);
  const lead = s.replace(LEAD, "");
  if (lead.length >= 3) s = lead;
  s = s.replace(/\s{2,}/g, " ").trim();
  if (/[^\u0000-\u024f’'.&()\- ]/.test(s)) return null; // not Latin script: skip rather than show it
  if (s.length < 3 || s.length > 22 || /(?:18|19|20)\d\d/.test(s)) return null;
  return Object.prototype.hasOwnProperty.call(OVERRIDES, s) ? OVERRIDES[s] : s;
}

/* ---------- people ----------
   The database has the same person twice: a Wikidata row (full name, date of birth, career) and an FPL row (web name like "Silva" or "Neves",
   no date of birth, all the appearances). People are merged by name + a club they both have, only when exactly one candidate fits. */
export function nicePlayerName(p) {
  const d = (p.display_name || "").trim(), full = (p.name || "").trim();
  if (!d) return null;
  if (d.includes(" ") || MONONYMS.has(d)) return d;
  const ft = full.split(/\s+/);
  if (ft.length >= 2 && norm(ft[ft.length - 1]) === norm(d)) return ft[0] + " " + d; // "Neves" → "Rúben Neves"
  if (ft.length >= 2 && ft.slice(1).some(t => norm(t) === norm(d))) return ft[0] + " " + d;
  return null; // a bare web name we can't make into a real name ("Silva", "Cissé")
}
