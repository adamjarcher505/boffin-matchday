// Shared helpers for the build-time question pipeline. Nothing here ships in the game.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(ROOT, "..");
export const CACHE = path.join(ROOT, "cache");      // gitignored: raw downloads
export const OUT = path.join(ROOT, "out");          // gitignored: the SQLite db
export const REPORTS = path.join(ROOT, "reports");  // committed: validation report + review file
export const UA = "boffin-question-pipeline/0.1 (build-time data tool for a football quiz game; contact via the GitHub repo adamjarcher505/boffin-matchday)";

for (const d of [CACHE, OUT, REPORTS]) fs.mkdirSync(d, { recursive: true });

/* Download with curl (it honours HTTPS_PROXY everywhere, unlike Node's fetch), cached on disk.
   maxAgeH: re-download only when the cached copy is older than this. Returns the body as text, or null on 404. */
export function get(url, { file, maxAgeH = 24 * 6, headers = {}, method = "GET", data } = {}) {
  const f = path.join(CACHE, file || crypto.createHash("sha1").update(url + (data || "")).digest("hex").slice(0, 16));
  if (fs.existsSync(f) && (Date.now() - fs.statSync(f).mtimeMs) / 36e5 < maxAgeH) { const t = fs.readFileSync(f, "utf8"); return t === "\u0000404" ? null : t; }
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const args = ["-sS", "-L", "--fail-with-body", "-m", "180", "-A", UA, "-w", "\n%{http_code}"];
  for (const [k, v] of Object.entries(headers)) args.push("-H", k + ": " + v);
  if (method === "POST") args.push("-X", "POST", "--data-binary", "@-");
  args.push(url);
  let out;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { out = execFileSync("curl", args, { input: data, maxBuffer: 1 << 28, encoding: "utf8" }); break; }
    catch (e) {
      const body = String(e.stdout || ""), code = +body.slice(body.lastIndexOf("\n") + 1);
      if (code === 404) { fs.writeFileSync(f, "\u0000404"); return null; }
      if (attempt === 3 || (code >= 400 && code < 500 && code !== 429)) throw new Error("GET " + url + " failed: " + code + " " + body.slice(0, 300));
      sleep(2000 * (attempt + 1));
    }
  }
  const body = out.slice(0, out.lastIndexOf("\n"));
  fs.writeFileSync(f, body);
  return body;
}
export const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Wikidata SPARQL, cached. Polite: one request at a time, a pause between, a descriptive User-Agent. */
export function sparql(name, query, maxAgeH = 24 * 6) {
  const cached = path.join(CACHE, "wikidata", name + ".json");
  const fresh = fs.existsSync(cached) && (Date.now() - fs.statSync(cached).mtimeMs) / 36e5 < maxAgeH;
  const txt = get("https://query.wikidata.org/sparql", { file: "wikidata/" + name + ".json", maxAgeH, method: "POST", data: "query=" + encodeURIComponent(query) + "&format=json", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" } });
  if (!fresh) sleep(1200);
  let parsed;
  try { parsed = JSON.parse(txt); }
  catch (e) {   // Wikidata cuts a response off when it hits its timeout: drop the bad copy and try once more
    fs.unlinkSync(cached); sleep(5000);
    const again = get("https://query.wikidata.org/sparql", { file: "wikidata/" + name + ".json", maxAgeH: 0, method: "POST", data: "query=" + encodeURIComponent(query) + "&format=json", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" } });
    try { parsed = JSON.parse(again); } catch (e2) { fs.unlinkSync(cached); throw new Error("Wikidata query " + name + " came back incomplete twice; make the batch smaller"); }
  }
  return parsed.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
export const qid = uri => uri ? uri.replace(/^.*\/entity\//, "") : null;

/* Names: stored in Unicode NFC; matched on an ASCII-folded key so Ødegaard and Odegaard are the same answer.
   (Same folding as the game's own norm() in app.js, so the pipeline and the app agree on what matches.) */
export const nfc = s => String(s || "").normalize("NFC").trim();
export const fold = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ı/g, "i").replace(/['’]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export const seasonLabel = y => y + "/" + String(y + 1).slice(2);           // 2003 -> "2003/04"
export const seasonPath = y => y + "-" + String(y + 1).slice(2);            // 2003 -> "2003-04"
export const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
export const today = () => new Date().toISOString().slice(0, 10);
export const readJSON = f => JSON.parse(fs.readFileSync(f, "utf8"));
export const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1) + "\n");

/* seeded random so a rebuild with the same data gives the same questions (stable ids, readable diffs) */
export function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
export const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const hashId = s => crypto.createHash("sha1").update(s).digest("base64url").slice(0, 10);
