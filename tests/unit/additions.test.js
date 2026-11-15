// Sticker shirts (kits.js), the player search, and grid hints with the grid score.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const { load } = require("../harness.js");
const KEY = "boffin-matchday-v1", v1 = fs.readFileSync(path.join(__dirname, "../fixtures/save-v1.json"), "utf8");
const J = (g, code) => JSON.parse(g.run("JSON.stringify(" + code + ")"));

test("every sticker club has a shirt, and every colour is a real hex", () => {
  const g = load();
  const missing = J(g, "STK.clubs.filter(c => !KITS[c])");
  assert.deepStrictEqual(missing, [], "clubs with stickers but no shirt");
  const bad = J(g, `[].concat(...Object.keys(KITS).map(c => { const k = KITS[c], ks = [k].concat((k.e || []).map(e => e[2])); return [].concat(...ks.map(x => ["b", "s", "c", "c2", "t"].filter(f => x[f] !== undefined && !/^#[0-9a-f]{6}$/.test(x[f])).map(f => c + "." + f))); }))`);
  assert.deepStrictEqual(bad, []);
  assert.ok(g.run("kitSVG(KITS['Newcastle'])").includes("<rect"), "stripes are drawn");
});

test("shirts follow the player's era: Henry gets the redcurrant, Fabregas the red and white", () => {
  const g = load();
  const kit = n => J(g, `(() => { const s = STK.by['Arsenal'].find(x => PL[x.i][0] === ${JSON.stringify(n)}); return s ? kitFor('Arsenal', s.i, s.c) : null; })()`);
  assert.strictEqual(kit("Thierry Henry").b, "#7b1f32");
  assert.strictEqual(kit("Thierry Henry").s, undefined, "redcurrant has no white sleeves");
  assert.strictEqual(kit("Cesc Fàbregas").b, "#e3101c");
  assert.strictEqual(kit("Bukayo Saka").s, "#f4f4f1");
  const cardiff = J(g, "(() => { const c = CLUB.indexOf('Cardiff'); const i = clubPl[c].find(i => { const s = stkSeasons(i, c); return s && s.from === 2013 && s.to <= 2014; }); return i === undefined ? null : kitFor('Cardiff', i, c).b; })()");
  if (cardiff) assert.strictEqual(cardiff, "#d6001c", "a Cardiff player from 2013-14 is in red");
});

test("search puts the best-known match first and forgives typos and spaces", () => {
  const g = load();
  const first = q => J(g, `(() => { const r = search(${JSON.stringify(q)}); return r.length ? PL[+r[0]][0] : null; })()`);
  assert.strictEqual(first("henry"), "Thierry Henry");
  assert.strictEqual(first("thi hen"), "Thierry Henry");
  assert.strictEqual(first("vanpersie"), "Robin van Persie");
  assert.strictEqual(first("aguro"), "Sergio Agüero");
  assert.strictEqual(first("ibrahimovich"), "Zlatan Ibrahimovic");
  assert.strictEqual(first("ronaldiho"), "Ronaldinho Gaúcho");
  assert.strictEqual(first("x"), null, "one letter isn't a search");
  assert.ok(J(g, "search('aguro')[0].fz") === 1, "a near miss is flagged");
  assert.ok(!J(g, "search('kane').some(i => i.fz)"), "no near misses when there are proper matches");
  assert.ok(g.run("sugName(search('ozil')[0], 'ozil')").includes("<mark>Özil</mark>"), "typed part is lit up, accents and all");
});

test("grid score: full grid 100%, one hint 98%, and a hint on a square you miss costs nothing extra", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const r = J(g, `(() => {
    const base = { c: Array(9).fill("x|1"), h: Array(9).fill(0), r: Array(9).fill(0) };
    const one = Object.assign({}, base, { h: [1, 0, 0, 0, 0, 0, 0, 0, 0] });
    const two = Object.assign({}, base, { h: [2, 0, 0, 0, 0, 0, 0, 0, 0] });
    const miss = { c: ["x|1", "x|1", "x|1", "x|1", "x|1", "x|1", "x|1", "x|1", null], h: [0, 0, 0, 0, 0, 0, 0, 0, 2], r: Array(9).fill(0) };
    return [gridScore(base), gridScore(one), gridScore(two), gridScore(miss), gridHints(miss)];
  })()`);
  assert.deepStrictEqual(r, [100, 98, 95, 89, 0]);
});

test("grid hints point at a real answer and stay the same once given", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const r = J(g, `(() => {
    view = "grid"; render(); const st = gridState(); gridCell = 0; st.h[0] = 2;
    const i = gridHintTarget(0), a = GRID.rows[0], b = GRID.cols[0], ok = validSet(a, b).includes(i);
    const t1 = gridHintText(0), t2 = gridHintText(0), sn = PL[i][0].split(" ").pop();
    return { ok, same: t1 === t2, noName: !t1.includes(sn), letters: t1.includes("(" + sn.length + " letters)"), saved: st.ht[0] === pkey(i) };
  })()`);
  assert.deepStrictEqual(r, { ok: true, same: true, noName: true, letters: true, saved: true });
  const share = g.run(`(() => { const st = gridState(); st.c = st.c.map(() => "x|1"); st.h[0] = 1; return shareGrid(); })()`);
  assert.match(share, /🟨🟩🟩/); assert.match(share, /Score 98%/); assert.match(share, /1 hint/);
});

/* ---- 14/11/2026: fair-for-the-division limits, save v3, career layer ---- */
test("The Link in the lower divisions always has enough right answers, some of them famous", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let tier = 0; tier < 2; tier++) for (let k = 0; k < 120; k++) makeMatch(QV + "f-" + tier + "-" + k + "-31", tier).forEach(sp => { if (sp.type !== "mates") return; const [a, b] = BD.pairs[sp.i], v = ALLIDX.filter(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b)); if (v.length < EASE.linkValid[tier] || v.filter(i => fame(i) >= 5).length < EASE.linkFamous[tier]) bad.push([tier, PL[a][0], PL[b][0], v.length]); }); return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("Missing XI never hides a player the records don't know (line-up score 0)", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { let bad = 0, n = 0; for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 120; k++) makeMatch(QV + "x-" + tier + "-" + k + "-31", tier).forEach(sp => { if (sp.type !== "xi") return; n++; if (sp.blanks.some(b => BD.xi[sp.i][6][b][2] <= 0)) bad++; }); return JSON.stringify([bad, n]); })()`));
  assert.ok(bad[1] > 50); assert.ok(bad[0] / bad[1] < 0.02, "at most a stray one after ten tries: " + bad);
});

test("save v3: a v2 save gains the career fields and loses nothing", () => {
  const g = load();
  const s = JSON.parse(g.run(`JSON.stringify(hydrate({ v: 2, made: true, name: "Old Hand", club: "Arsenal", xp: 999, div: 2, season: 3, salt: 5, week: { pl: 4, w: 2, d: 1, l: 1, gf: 9, ga: 6, pts: 7 }, st: { m: 40, w: 22, goals: 120, deep: 12, bestDiv: 2, grids: 3 }, album: { "A|1": 1 } }))`));
  assert.strictEqual(s.v, g.run("SAVE_V")); assert.strictEqual(s.xp, 999); assert.strictEqual(s.week.pts, 7); assert.strictEqual(s.st.w, 22);
  assert.deepStrictEqual(s.sk, { d: "", n: 0, best: 0 }); assert.deepStrictEqual(s.md, {}); assert.deepStrictEqual(s.ct, {}); assert.ok(s.ob && s.sn);
});

test("merge: medals keep the earliest date, counters and best streak take the higher value", () => {
  const g = load();
  const m = JSON.parse(g.run(`JSON.stringify(mergeSaves(hydrate({ v: 3, made: true, t: 2, md: { first: "2026-11-14", w10: "2026-11-20" }, ct: { five: 2 }, sk: { d: "2026-11-20", n: 2, best: 4 } }), hydrate({ v: 3, made: true, t: 1, md: { first: "2026-11-12", cs: "2026-11-13" }, ct: { five: 5, cs: 1 }, sk: { d: "2026-11-13", n: 9, best: 9 } })))`));
  assert.deepStrictEqual(m.md, { first: "2026-11-12", cs: "2026-11-13", w10: "2026-11-20" });
  assert.deepStrictEqual(m.ct, { five: 5, cs: 1 }); assert.strictEqual(m.sk.best, 9); assert.strictEqual(m.sk.n, 2);
});

test("streak: one tick a day, a missed day resets it", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const out = []; S = hydrate({ made: true }); out.push(streakTick()); out.push(streakTick()); S.sk.d = dayBefore(dayKey()); out.push(streakTick()); S.sk.d = dayBefore(dayBefore(dayKey())); out.push(streakTick()); out.push(S.sk.best); return JSON.stringify(out); })()`));
  assert.deepStrictEqual(r, [1, 0, 2, 1, 2]);
});

test("objectives: three a day from different groups, the same for everyone, and each pays once", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const days = []; for (let d = 1; d <= 28; d++) { const ids = objToday("2026-12-" + String(d).padStart(2, "0")); days.push(ids.length === 3 && new Set(ids.map(i => OBJ[i].g)).size === 3); } S = hydrate({ made: true }); const ids = objToday(); let xp = 0; for (let k = 0; k < 6; k++) [{ k: "match", mode: "league", res: "W", a: 5, b: 0, my: [1,1,1,1,1], types: ["cell","top","xi","hl","odd"], deep: 1, newN: 5 }, { k: "match", mode: "cup", res: "W", a: 5, b: 0, my: [1,1,1,1,1], types: ["race","champ","quiz","season","squad"], deep: 1, newN: 5 }, { k: "grid" }, { k: "train", goal: true }].forEach(e => objEvent(e).forEach(l => xp += l[1])); return JSON.stringify({ days, xp, want: ids.reduce((s, i) => s + OBJ[i].xp, 0) + CAREER.fullSetXp, all: S.ob.all }); })()`));
  assert.ok(r.days.every(Boolean)); assert.strictEqual(r.xp, r.want); assert.strictEqual(r.all, true);
});

test("medals: every medal has a unique id and a working test; a fresh save has none; start-up check is silent", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { S = hydrate({ made: true }); const ids = MEDALS.map(m => m.id), fresh = medalCheck().length; S.st.w = 12; S.st.bestDiv = 2; const silent = medalCheck(true).length, got = Object.keys(S.md).sort(); return JSON.stringify({ uniq: new Set(ids).size === ids.length, n: ids.length, fresh, silent, got }); })()`));
  assert.ok(r.uniq); assert.ok(r.n >= 30); assert.strictEqual(r.fresh, 0); assert.strictEqual(r.silent, 0); assert.deepStrictEqual(r.got, ["first", "fl", "w10"]);
});

test("league table: house form is recorded from the same results, and the table one match back needs a snapshot", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { S = hydrate({ made: true, salt: 9, week: { pl: 6, w: 3, d: 1, l: 2, gf: 12, ga: 9, pts: 10 } }); const rows = leagueTable(), h = rows.find(x => x.house), none = leagueTable(true); S.wp = { pl: 5, w: 2, d: 1, l: 2, gf: 9, ga: 9, pts: 7 }; const back = leagueTable(true); return JSON.stringify({ form: h.form, wdl: h.w + h.d + h.l, none, backPl: back.find(x => x.house).pl, mePts: back.find(x => x.me).pts }); })()`));
  assert.strictEqual(r.form.length, 5); assert.ok(r.form.every(f => "WDL".includes(f))); assert.strictEqual(r.wdl, 6); assert.strictEqual(r.none, null); assert.strictEqual(r.backPl, 5); assert.strictEqual(r.mePts, 7);
});

// 14/11/2026: the five-chance mix and the Pub Quiz spread
test("league: every match has The Grid, 2-3 tap rounds, and one per family", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let t = 0; t < 4; t++) for (let k = 0; k < 150; k++) { const ts = makeMatch(QV + "mix-" + t + "-" + k, t).map(x => x.type), tap = ts.filter(x => !TYPES[x].typed).length, fam = ts.map(x => FAMILY[x]).filter(Boolean);
    if (!ts.includes("cell") || tap < 2 || tap > 3 || new Set(fam).size < fam.length || new Set(ts).size < 5) bad.push(ts.join(",")); } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("cup: never two from the same family, for any club in the picker", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; CLUBS_PICK.forEach(c => { for (let k = 0; k < 6; k++) { const fam = makeCupMatch("fam-" + k, c, k % 4).map(x => FAMILY[x.type]).filter(Boolean); if (new Set(fam).size < fam.length) bad.push(CLUB[c]); } }); return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("The Fee: five pairs, and no transfer or player shown twice in a league round", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let t = 0; t < 4; t++) for (let k = 0; k < 200; k++) { const x = makeRaw("hl", rngOf(hash("fee" + t + k)), t, k % 2 ? { pl: 1 } : null); const ids = x.pairs.flat(), who = ids.map(h => BD.hl[h][0]);
    if (x.pairs.length !== 5 || new Set(ids).size < 10 || new Set(who).size < 10) bad.push([t, k]); } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("Pub Quiz: no template takes over, and position guesses stay rare", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const out = []; for (let t = 0; t < 4; t++) { const c = {}; let n = 0; for (let k = 0; k < 600; k++) { const z = makeQuiz(rngOf(hash("spread" + t + k)), t, null); z.qs.forEach(q => { const tt = QB.by[q.id].t; c[tt] = (c[tt] || 0) + 1; n++; }); } out.push([Math.max(...Object.values(c)) / n, (c.position || 0) / n]); } return JSON.stringify(out); })()`));
  r.forEach(([top, pos]) => { assert.ok(top < 0.2, "biggest template share " + top); assert.ok(pos < 0.05, "position share " + pos); });
});
