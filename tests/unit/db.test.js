// The 1X2 database build (data-pipeline/db/) and the game's use of it (src/dbx.js).
// The build is checked against football.db through plain SQL (a different route from the one the build takes), against facts that are
// known to be true, and for the traps found in the data: Wimbledon, missing deductions, women's players, mid-season tables.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const { load, ROOT } = require("../harness.js");
const DBDIR = path.join(ROOT, "data-pipeline", "db"), URLB = "file://" + path.join(DBDIR, "build.mjs");

let built; // one real build shared by the tests that only read
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "x1-"));
async function theBuild() {
  if (!built) {
    const { build } = await import(URLB), outDir = tmp();
    built = Object.assign(build({ outDir, quiet: true }), { outDir });
    built.chunk = n => JSON.parse(fs.readFileSync(path.join(outDir, built.manifest.chunks[n].file), "utf8"));
  }
  return built;
}
const sql = async () => { const { openDb } = await import("file://" + path.join(DBDIR, "lib.mjs")); return openDb(); };

test("build: signed against data.js, every chunk file named by its content, deterministic", async () => {
  const b = await theBuild(), { build } = await import(URLB), again = build({ outDir: tmp(), quiet: true });
  const { dataSig, loadGame } = await import("file://" + path.join(DBDIR, "lib.mjs"));
  assert.strictEqual(b.manifest.sig, dataSig(loadGame().PL));
  assert.strictEqual(b.manifest.v, again.manifest.v, "same database in, same files out");
  for (const [n, c] of Object.entries(b.manifest.chunks)) {
    assert.ok(fs.existsSync(path.join(b.outDir, c.file)), n);
    assert.strictEqual(b.chunk(n).sig, b.manifest.sig);
  }
  const total = Object.values(b.manifest.chunks).reduce((a, c) => a + c.bytes, 0);
  assert.ok(total < 1.4e6, "all chunks together stay under 1.4 MB raw, got " + total);
  assert.ok(Object.values(b.manifest.chunks).every(c => c.bytes < 3e5), "no single chunk over 300 KB");
});

test("tables: known finishes, the 2023-24 deductions, Wimbledon, nothing mid-season", async () => {
  const b = await theBuild(), T = b.chunk("tables"), by = y => T.t.find(t => t[0] === y)[1], nm = r => T.clubs[r[0]];
  assert.strictEqual(T.t.length, 34, "1992-93 to 2025-26, all finished");
  assert.ok(!T.t.some(t => t[0] === 2026), "2026-27 is only ten games old: never a final table");
  const leic = by(2015)[0]; assert.deepStrictEqual([nm(leic), leic[7]], ["Leicester City", 81]);
  const arse = by(2003)[0]; assert.deepStrictEqual([nm(arse), arse[7], arse[4]], ["Arsenal", 90, 0], "the Invincibles: 90 points, no defeats");
  const derby = by(2007).find(r => nm(r) === "Derby County"); assert.strictEqual(derby[7], 11);
  const ev = by(2023).findIndex(r => nm(r) === "Everton"), fo = by(2023).findIndex(r => nm(r) === "Nottingham Forest");
  assert.strictEqual(by(2023)[ev][7], 40, "Everton lost 8 points in 2023-24"); assert.strictEqual(by(2023)[fo][7], 32, "Nottingham Forest lost 4");
  assert.strictEqual(ev + 1, 15); assert.strictEqual(fo + 1, 17);
  assert.ok(by(1992).some(r => nm(r) === "Wimbledon") && !T.clubs.includes("AFC Wimbledon"), "Wimbledon FC, not AFC Wimbledon");
  assert.strictEqual(by(1992).length, 22); assert.strictEqual(by(2025).length, 20);
  for (const t of T.t) { const pts = t[1].map(r => r[7]); assert.ok(pts.every((p, k) => !k || pts[k - 1] >= p), t[0] + " is in points order"); }
});

test("scores: known matches are in, with the right score, and the whole set matches the database", async () => {
  const b = await theBuild(), all = [];
  for (let d = 1; d <= 4; d++) { const S = b.chunk("scores-d" + d); S.m.forEach(([id, y, md, hi, ai, hg, ag]) => all.push({ id, y, md, h: S.clubs[hi], a: S.clubs[ai], hg, ag })); }
  assert.ok(all.length > 13000, "13,000+ Premier League matches, got " + all.length);
  const find = (y, md, h, a) => all.find(x => x.y === y && x.md === md && x.h === h && x.a === a);
  assert.strictEqual(find(2019, 1025, "Southampton", "Leicester City").hg + "-" + find(2019, 1025, "Southampton", "Leicester City").ag, "0-9");
  const mu = find(1994, 304, "Manchester United", "Ipswich Town"); assert.strictEqual(mu.hg + "-" + mu.ag, "9-0");
  const derby = find(2011, 1023, "Manchester United", "Manchester City"); assert.strictEqual(derby.hg + "-" + derby.ag, "1-6");
  assert.ok(!all.some(x => x.h === "AFC Wimbledon" || x.a === "AFC Wimbledon"));
  // every shipped score equals the database's own, read back by match id through SQL
  const { q } = await sql(), rows = new Map(q("select match_id id, home_goals hg, away_goals ag from matches where competition_id=1").map(r => [r.id, r]));
  assert.ok(all.every(x => rows.has(x.id) && rows.get(x.id).hg === x.hg && rows.get(x.id).ag === x.ag));
  assert.strictEqual(new Set(all.map(x => x.id)).size, all.length, "no match twice");
});

test("people: no women's players, no web names like 'Silva', club names tidy", async () => {
  const b = await theBuild(), names = new Set();
  for (const n of ["pals", "careers-a", "careers-b", "scorers", "flags"]) { const C = b.chunk(n); (C.names || []).forEach(x => names.add(x[0])); (C.p || []).forEach(x => typeof x[0] === "string" && names.add(x[0])); }
  for (const w of ["Anita Asante", "Dunia Susi", "Turid Knaak", "Jessica King"]) assert.ok(!names.has(w), w + " played women's football and must not be asked about");
  for (const n of ["Silva", "Cissé", "Neves", "Gabriel"]) if (n !== "Gabriel") assert.ok(!names.has(n), "a bare web name: " + n);
  const clubs = new Set(); for (const n of ["careers-a", "careers-b", "pals", "flags", "tables"]) (b.chunk(n).clubs || []).forEach(c => clubs.add(c));
  const bad = [...clubs].filter(c => /F\.C\.|\bFC$|national|under-|women|W\.F\.C|Club de F|\b(II|B)$/i.test(c) || c.length > 22);
  assert.deepStrictEqual(bad, [], "untidy club names");
  const { tidyClub } = await import("file://" + path.join(DBDIR, "lib.mjs"));
  const eq = (raw, want) => assert.strictEqual(tidyClub(raw), want, raw);
  eq("Real Madrid Club de Fútbol", "Real Madrid"); eq("Juventus FC", "Juventus"); eq("Lille OSC", "Lille"); eq("Bologna F.C. 1909", "Bologna"); eq("Northampton Town F.C.", "Northampton Town");
  eq("England national under-21 association football team", null); eq("Arsenal W.F.C.", null); eq("Chelsea F.C. Women", null); eq("Barcelona B", null); eq("India national football team", null);
});

test("Ever Team-mates: 'yes' pairs have exactly the games stated, 'never' pairs never shared a match (checked in SQL)", async () => {
  const b = await theBuild(), C = b.chunk("pals"), { q } = await sql();
  // a person can be two database rows (a Wikidata one and an FPL one, merged by the build): look up by the merged person, so every row's appearances count
  const ids = new Map(), who = new Map();
  for (const p of b.ctx.people.values()) if (p.name) { if (!who.has(p.name)) who.set(p.name, []); who.get(p.name).push(p); }
  for (const [n, ps] of who) if (ps.length === 1) ids.set(n, ps[0].ids);
  const clubId = new Map(q("select name, club_id id from clubs").map(r => [r.name, r.id]));
  let checked = { yes: 0, never: 0 };
  const together = (a, b, club) => q(`select count(*) n from appearances x join appearances y on x.match_id=y.match_id and x.club_id=y.club_id join matches m on m.match_id=x.match_id
     where x.player_id in (${a.join(",")}) and y.player_id in (${b.join(",")}) and x.minutes>0 and y.minutes>0 and m.competition_id=1 ${club ? "and x.club_id in (" + club.join(",") + ")" : ""}`)[0].n;
  const { PL_BY_Q } = await import("file://" + path.join(DBDIR, "lib.mjs"));
  const clubIds = name => { const pl = Object.values(PL_BY_Q).find(c => c.name === name); return q("select club_id id from clubs where wikidata_qid=? or name=? or short_name=?", pl ? pl.q : "-", name, name).map(r => r.id); };
  for (const [a, bb, yes, c, n] of C.p.filter((_, k) => k % 9 === 0)) {
    const A = ids.get(C.names[a][0]), B = ids.get(C.names[bb][0]), cid = clubIds(C.clubs[c]);
    if (!A || !B || A.length !== 1 || B.length !== 1 || !cid.length) continue; // an ambiguous name: skip rather than guess
    const got = together(A, B, cid);
    if (yes) { assert.strictEqual(got, n, `${C.names[a][0]} + ${C.names[bb][0]} at ${C.clubs[c]}`); checked.yes++; }
    else { assert.strictEqual(together(A, B, null), 0, `${C.names[a][0]} + ${C.names[bb][0]} must never have shared a match for anyone`); checked.never++; }
  }
  assert.ok(checked.yes >= 40 && checked.never >= 30, JSON.stringify(checked));
  assert.ok(C.p.filter(p => !p[2]).every(p => !(C.names[p[0]][1] === 1 && C.names[p[1]][1] === 1)), "two goalkeepers is a giveaway");
});

test("Six Degrees: every stored link is a real pair of team-mates, and the two ends never played together", async () => {
  const b = await theBuild(), S = b.chunk("six"), { q } = await sql(), { people } = b.ctx, PL = b.ctx.game.PL;
  const byIdx = new Map(); for (const p of people.values()) if (p.i >= 0) byIdx.set(p.i, p);
  const idsOf = i => byIdx.get(i).ids;
  const shared = (i, j) => q(`select count(*) n from appearances x join appearances y on x.match_id=y.match_id and x.club_id=y.club_id join matches m on m.match_id=x.match_id
     where x.player_id in (${idsOf(i).join(",")}) and y.player_id in (${idsOf(j).join(",")}) and x.minutes>0 and y.minutes>0 and m.competition_id=1`)[0].n;
  let n = 0;
  for (const [a, bb, need, d, v] of S.p.filter((_, k) => k % 6 === 0)) {
    assert.strictEqual(shared(a, bb), 0, `${PL[a][0]} and ${PL[bb][0]} must not be direct team-mates`);
    if (need === 1) v.slice(0, 5).forEach(x => { assert.ok(shared(a, x) > 0 && shared(x, bb) > 0, `${PL[x][0]} links ${PL[a][0]} and ${PL[bb][0]}`); });
    else v.slice(0, 3).forEach(([x, ys]) => { assert.ok(shared(a, x) > 0, "first link"); ys.slice(0, 3).forEach(y => assert.ok(shared(x, y) > 0 && shared(y, bb) > 0, "second link")); });
    n++;
  }
  assert.ok(n >= 30 && S.p.some(p => p[3] === 1) && S.p.some(p => p[2] === 2), "easy puzzles and two-name puzzles both exist");
  assert.ok(S.p.every(p => p[0] !== p[1] && (p[2] === 1 ? p[4].length >= 2 : p[4].length >= 4)));
});

test("careers: a fake or decoy club never appears anywhere in the player's record, even in youth or B teams", async () => {
  const b = await theBuild(), { rawClubs, people } = b.ctx, { norm } = await import("file://" + path.join(DBDIR, "lib.mjs"));
  const byName = new Map(); for (const [id, p] of people) if (p.name) { if (!byName.has(p.name)) byName.set(p.name, []); byName.get(p.name).push(id); }
  let n = 0;
  for (const part of ["careers-a", "careers-b"]) {
    const C = b.chunk(part);
    for (const [name, pos, d, path_, dec] of C.p.filter((_, k) => k % 7 === 0)) {
      const ids = byName.get(name); if (!ids || ids.length !== 1) continue;
      const raw = [...rawClubs.get(ids[0])];
      dec.map(c => norm(C.clubs[c])).forEach(k => assert.ok(!raw.some(r => r.includes(k)), `${name}: decoy ${k} is somewhere in his record`));
      const years = path_.map(x => x[1]); assert.ok(years.every((y, k) => !k || years[k - 1] <= y), name + " career in date order");
      assert.ok(path_.length >= 3 && path_.length <= 7 && dec.length >= 4); n++;
    }
  }
  assert.ok(n >= 150, "checked " + n);
});

test("top scorers: the real Golden Boot tables, ties included, no goal counts shipped", async () => {
  const b = await theBuild(), S = b.chunk("scorers"), by = y => S.s.find(s => s[0] === y)[1].map(t => t[0]);
  assert.deepStrictEqual(by(2015 + 1).slice(0, 3), ["Harry Kane", "Romelu Lukaku", "Alexis Sánchez"]);
  assert.deepStrictEqual(by(2018).slice().sort(), ["Mohamed Salah", "Pierre-Emerick Aubameyang", "Sadio Mané"].sort(), "2018-19: three-way tie");
  assert.strictEqual(by(2022)[0], "Erling Haaland"); assert.deepStrictEqual(by(2021).slice().sort(), ["Cristiano Ronaldo", "Mohamed Salah", "Son Heung-min"]);
  assert.ok(by(2019).length >= 3, "2019-20: level with third counts");
  assert.ok(S.s.every(s => s[1].every(t => typeof t[0] === "string" && Number.isInteger(t[1]) && t.length === 2)), "name and game index only");
});

test("flags: every XI has eleven players and at most one unknown nationality; the club is the right one", async () => {
  const b = await theBuild(), F = b.chunk("flags");
  assert.ok(F.x.length >= 100);
  for (const [y, c, xi, d] of F.x) { assert.strictEqual(xi.length, 11); assert.ok(xi.filter(p => p[0] < 0).length <= 1); assert.strictEqual(xi.filter(p => p[2] === 1).length, 1, "one goalkeeper"); assert.ok(d >= 1 && d <= 4); }
  const city = F.x.find(x => x[0] === 2016 && F.clubs[x[1]] === "Manchester City"), sur = city[2].map(p => p[1]);
  assert.ok(sur.includes("De Bruyne") && sur.includes("Agüero") && sur.includes("Bravo"), "Manchester City 2016-17: " + sur.join(", "));
});

test("source switches: FPL off drops the appearance modes, engsoccerdata off keeps only seasons without it", async () => {
  const cfg = await import("file://" + path.join(DBDIR, "config.mjs")), { build } = await import(URLB);
  try {
    cfg.SOURCES.fpl = false;
    const noFpl = build({ outDir: tmp(), quiet: true });
    for (const n of ["pals", "six", "flags", "scorers"]) assert.ok(!noFpl.manifest.chunks[n], n + " needs FPL");
    for (const n of ["tables", "careers-a", "gridv", "scores-d1"]) assert.ok(noFpl.manifest.chunks[n], n + " does not");
    cfg.SOURCES.fpl = true; cfg.SOURCES.engsoccerdata = false;
    const noEs = build({ outDir: tmp(), quiet: true });
    assert.ok(noEs.files.tables.t.map(t => t[0]).every(y => y === 2022 || y === 2025), "only openfootball-only seasons remain: " + noEs.files.tables.t.map(t => t[0]));
    const ys = new Set(); for (let d = 1; d <= 4; d++) (noEs.files["scores-d" + d]?.m || []).forEach(m => ys.add(m[1]));
    assert.ok([...ys].every(y => y === 2022 || y === 2025 || y === 2026), "scores follow: " + [...ys]);
  } finally { cfg.SOURCES.fpl = true; cfg.SOURCES.engsoccerdata = true; }
});

/* ---------------- the game side ---------------- */
async function gameWithDb(opts = {}) {
  const b = await theBuild(), g = load(opts.load);
  const chunks = {}; for (const n of Object.keys(b.manifest.chunks)) chunks[n] = b.chunk(n);
  g.ctx.__M = b.manifest; g.ctx.__C = chunks;
  if (!opts.cold) g.run("DBX.loadFrom(__M, __C)");
  return g;
}
const J = (g, code) => JSON.parse(g.run(`JSON.stringify(${code})`));

test("game: with no data loaded every mode builds from the old bank; with it, the DB modes switch on and seeds say so", async () => {
  const cold = await gameWithDb({ cold: true }), warm = await gameWithDb();
  assert.strictEqual(cold.run("DBX.ready(2)"), false); assert.strictEqual(warm.run("DBX.ready(2)"), true);
  assert.ok(!cold.run("qvx(2)").includes("x|") && warm.run("qvx(2)").includes("x|"));
  const types = g => J(g, `(() => { const c = {}; for (let k = 0; k < 120; k++) makeMatch("sw" + k, 2).forEach(s => c[s.type] = (c[s.type] || 0) + 1); return c; })()`);
  assert.ok(!types(cold).gboot, "Golden Boot only exists with the data");
  assert.ok(types(warm).gboot > 20);
  // old path exactly as before: the cold game's matches contain no database specs
  assert.strictEqual(J(cold, `(() => { let n = 0; for (let k = 0; k < 60; k++) makeMatch("c" + k, 1).forEach(s => { if (s.x || s.dx || (s.type === "exact" && String(s.qs[0])[0] === "x")) n++; }); return n; })()`), 0);
});

test("game: database questions rebuild identically from a seed, in a separate session too", async () => {
  const a = await gameWithDb(), b2 = await gameWithDb();
  for (const tier of [0, 1, 2, 3]) for (let k = 0; k < 20; k++) {
    const call = `JSON.stringify(makeMatch(qvx(${tier}) + "d-${tier}-${k}", ${tier}))`;
    assert.strictEqual(a.run(call), a.run(call)); assert.strictEqual(a.run(call), b2.run(call));
  }
});

test("game: a chunk built against a different data.js is refused, and the game quietly stays on the old bank", async () => {
  const g = await gameWithDb({ cold: true });
  g.run("DBX.m = __M; var bad = Object.assign({}, __C.tables, { sig: 'nope' }); DBX.put('tables', bad); ");
  assert.strictEqual(g.run("!!DBX.bad.tables"), true); assert.strictEqual(g.run("DBX.has('tables')"), false); assert.strictEqual(g.run("DBX.ready(0)"), false);
  assert.ok(J(g, `makeMatch("x", 0)`).length === 5);
});

test("game: the rollback switch (useDb: false) and ?olddb both keep the database out entirely", async () => {
  const off = await gameWithDb({ load: { config: { useDb: false } }, cold: false });
  assert.strictEqual(off.run("DBX.ready(3)"), false, "useDb: false");
  const q = await gameWithDb({ load: { search: "?olddb" } });
  assert.strictEqual(q.run("DBX.ready(3)"), false, "?olddb");
});

test("game: Grid answers only ever widen, never shrink, and a daily Grid doesn't depend on what's downloaded", async () => {
  const warm = await gameWithDb(), cold = await gameWithDb({ cold: true });
  assert.strictEqual(J(warm, `(() => { let bad = 0, more = 0; for (let k = 0; k < 400; k++) { const c = makeCell(rngOf(hash("w" + k)), k % 4, {}), a = validSet(c.a, c.b), x = validSetX(c.a, c.b); if (!a.every(i => x.includes(i))) bad++; if (x.length > a.length) more++; } return [bad, more > 5]; })()`)[0], 0);
  assert.strictEqual(J(warm, `JSON.stringify(dailyGrid())`), J(cold, `JSON.stringify(dailyGrid())`), "same daily grid for everyone");
  assert.ok(J(warm, `(() => { let n = 0; for (let k = 0; k < 300; k++) { const c = makeCell(rngOf(hash("g" + k)), 1, {}); if (c.dx) { n++; if (validSetX(c.a, c.b).length < 6) return -1; } } return n; })()`) > 40, "database cells appear, each with enough answers");
});

test("game: no database question repeats a player or club within itself, and every one runs", async () => {
  const g = await gameWithDb();
  const out = J(g, `(() => { const bad = []; for (let t = 0; t < 4; t++) for (let k = 0; k < 150; k++) makeMatch(qvx(t) + "q" + t + "-" + k, t).forEach(sp => {
    try { const R = RUN[sp.type](sp); R.body(false); if (R.review) R.review(); R.end(); } catch (e) { bad.push(sp.type + ": " + e.message); }
    if (sp.type === "pals") { const u = sp.pairs.flatMap(p => [p[0], p[1]]); if (new Set(u).size < u.length) bad.push("pals repeats a player"); }
    if (sp.type === "exact" && new Set(sp.qs).size < sp.qs.length) bad.push("exact repeats a match");
    if (sp.type === "six" && sp.x && sp.a === sp.b) bad.push("six a=b");
    if (sp.type === "buy" && sp.x) sp.qs.forEach(q => { if (new Set(q.o).size < 4 || !q.o.includes(q.a)) bad.push("buy options"); });
    if (sp.type === "fake" && sp.x) sp.sets.forEach(s => { if (s.path.some(c => c[0] === s.f)) bad.push("fake is real"); });
    if (sp.type === "flags" && sp.x) sp.qs.forEach(q => { if (new Set(q.o).size < 4 || !q.o.includes(q.c)) bad.push("flags options"); });
    if (sp.type === "row" && sp.qs[0].T) sp.qs.forEach(q => { const ans = q.T[3][q.k][0]; if (new Set(q.o).size < 4 || !q.o.includes(ans) || q.T[3].some((r, i) => i !== q.k && q.o.includes(r[0]))) bad.push("row options"); });
  }); return bad.slice(0, 5); })()`);
  assert.deepStrictEqual(out, []);
});

test("game: Golden Boot and Six Degrees accept every valid answer (all the tied scorers, every link)", async () => {
  const g = await gameWithDb();
  // two of three tied scorers (2018-19: Salah, Mane, Aubameyang all on 22): any two score
  const r = J(g, `(() => { const C = DBX.c.scorers.s.find(s => s[0] === 2018), spec = { type: "gboot", x: 1, y: 2018, top: C[1], more: C[2], target: 2 }; const out = [];
    for (const pair of [[0, 1], [1, 2], [0, 2]]) { const R = RUNX.gboot(spec); ctx = { paint() {}, done() {} }; pair.forEach(k => R.onPick(spec.top[k][1])); out.push(R.end().goal); } return out; })()`);
  assert.deepStrictEqual(r, [true, true, true]);
  const six = J(g, `(() => { const p = DBX.c.six.p.find(x => x[2] === 1 && x[4].length >= 4), spec = { type: "six", x: 1, a: p[0], b: p[1], need: 1, v: p[4] }; ctx = { paint() {}, done() {} }; const res = [];
    for (const v of p[4].slice(0, 4)) { const R = RUNX.six(spec); R.onPick(v); res.push(R.end().goal); } return res; })()`);
  assert.deepStrictEqual(six, [true, true, true, true], "any of the common team-mates solves a one-name puzzle");
});
