// 14/11/2026: the eight extra question types, the Grid cover fix and Chain Reaction.
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");
const SAVE = { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) };

test("Grid, Link and Squad Sheet covers don't show the clubs or players before the clock starts", () => {
  const g = load({ localStorage: SAVE });
  for (let k = 0; k < 15; k++) {
    g.run(`startTraining("cell")`);
    const sp = JSON.parse(g.run("JSON.stringify(curSpec())")), cover = g.els.main.innerHTML;
    for (const c of [sp.a, sp.b]) if (c.t === "c") assert.ok(!cover.includes(g.run(`esc(CLUB[${c.v}])`)), "cover gives away " + g.run(`CLUB[${c.v}]`));
    g.run("takeChance()");
    const live = g.els.main.innerHTML;
    assert.ok(live.includes(g.run("esc(M.run.rule)")), "clubs shown once the clock runs");
    g.run("M.live = false");
  }
  g.run(`startTraining("mates")`);
  const ab = JSON.parse(g.run("JSON.stringify(curSpec().ab || BD.pairs[curSpec().i])"));
  for (const i of ab) assert.ok(!g.els.main.innerHTML.includes(g.run(`esc(PL[${i}][0])`)));
});

test("every new type builds at every tier, scoped and not, and plays to an end", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (const t of MORE_TYPES) for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 6; k++) for (const sc of [null, { pl: 1 }]) { const x = makeRound(t, rngOf(hash(t + tier + k)), tier, sc, true); if (!x) { bad.push(t + " null"); continue; } try { const R = RUN[x.type](x); R.body(false); const e = R.end(); if (typeof e.goal !== "boolean" || typeof e.xp !== "number") bad.push(t + " end"); } catch (e) { bad.push(t + ": " + e.message); } } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("new types: right answers score, through the real tap and pick handlers", () => {
  const g = load({ localStorage: SAVE });
  // Ever Team-mates?: answer every pair truthfully
  g.run(`startTraining("pals"); takeChance(); curSpec().pairs.forEach((p, k) => { M.run.k = k; M.run.onTap(String(p[2])); M.run.lock = false; })`);
  assert.strictEqual(g.run("M.run.ok"), 5);
  // Who Bought Him?
  g.run(`M.live = false; startTraining("buy"); takeChance(); curSpec().qs.forEach((q, k) => { M.run.k = k; M.run.onTap(String(q.o.indexOf(BD.hl[q.h][2]))); M.run.lock = false; })`);
  assert.strictEqual(g.run("M.run.ok"), 3);
  // Spot the Fake
  g.run(`M.live = false; startTraining("fake"); takeChance(); curSpec().sets.forEach((s, k) => { M.run.k = k; M.run.onTap(String(s.at)); M.run.lock = false; })`);
  assert.strictEqual(g.run("M.run.ok"), 3);
  // Six Degrees: name the target directly once a linked player is in the chain
  g.run(`M.live = false; startTraining("six"); takeChance()`);
  const sp = JSON.parse(g.run("JSON.stringify(curSpec())"));
  if (sp.need === 1) {
    g.run(`(() => { const nb = new Set(tmOf(${sp.b})); const mid = tmOf(${sp.a}).find(i => nb.has(i)); M.run.onPick(mid); })()`);
    assert.strictEqual(g.run("M.run.goal"), true);
    assert.ok(g.run("M.run.end().xp") >= 60, "shortest route earns the bonus");
  }
  // Exact Score: set the real score and lock
  g.run(`M.live = false; startTraining("exact"); takeChance(); (() => { const x = SCORE_BY[curSpec().qs[0]]; M.run.h = x.hg; M.run.a = x.ag; M.run.onTap("lock"); })()`);
  assert.strictEqual(g.run("M.run.pts"), 2);
  // In Order: tap in the right order
  g.run(`M.live = false; startTraining("order"); takeChance()`);
  g.run(`(() => { const st = curSpec().sets[0]; let vals; if (st.v === "fee") vals = st.h.map(h => BD.hl[h][4]); else if (st.v === "tab") vals = st.o.map(k => 4 - k); else vals = st.o.map(k => BD.lists[st.li][3][k][1]); vals.map((v, j) => j).sort((x, y) => vals[y] - vals[x]).forEach(j => M.run.onTap(String(j))); })()`);
  assert.strictEqual(g.run("M.run.ok"), 1);
});

test("Ever Team-mates?: every 'never' is a safe never and every 'yes' really overlapped", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let k = 0; k < 30; k++) { const x = makeMore("pals", rngOf(hash("p" + k)), k % 4, k % 2 ? { pl: 1 } : {}); if (!x) continue; x.pairs.forEach(([a, b, y]) => { if (!!y !== overlaps(a, b)) bad.push(PL[a][0] + "/" + PL[b][0]); }); } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("Spot the Fake: the fake is never a club the player has any record at", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let k = 0; k < 40; k++) { const x = makeMore("fake", rngOf(hash("f" + k)), k % 4, {}); if (!x) continue; x.sets.forEach(s => { if (clubsOf(s.p).includes(s.f) || spellClubs(s.p).includes(s.f)) bad.push(PL[s.p][0]); }); } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});

test("Club Cup ties can use the new types and stay deterministic", () => {
  const a = load(), b = load();
  const call = `JSON.stringify(makeCupMatch("Club-1-0-99", clubIdx("Arsenal"), 1))`;
  assert.strictEqual(a.run(call), b.run(call));
  const types = new Set();
  for (let k = 0; k < 30; k++) JSON.parse(a.run(`JSON.stringify(makeCupMatch("Arsenal-${k}-0-1", clubIdx("Arsenal"), 1))`)).forEach(x => types.add(x.type));
  for (const t of ["six", "pals", "fake", "buy", "exact"]) assert.ok(types.has(t), t + " never turned up in an Arsenal cup tie");
});

test("Chain Reaction: same start for everyone, valid links count, the clock ends it and pays XP once", () => {
  const g = load({ localStorage: SAVE }), h = load();
  assert.strictEqual(g.run("chainStart(dayKey())"), h.run("chainStart(dayKey())"));
  g.run(`view = "chain"; render()`);
  assert.ok(g.els.main.innerHTML.includes("Start the clock"));
  g.run("chainGo()");
  const start = g.run("chainStart(dayKey())");
  g.run(`chainPick(tmOf(${start})[0])`);
  assert.strictEqual(g.run("chainState().c.length"), 1);
  g.run(`chainPick(tmOf(${start})[0])`); // same man twice: no
  assert.strictEqual(g.run("chainState().c.length"), 1);
  const notMate = g.run(`(() => { const cur = KEY2IDX[chainState().c[0]]; return SSP.find(i => i !== cur && !overlaps(cur, i)); })()`);
  g.run(`chainPick(${notMate})`);
  assert.strictEqual(g.run("chainState().c.length"), 1);
  const xp0 = g.run("S.xp");
  g.run("chainState().t0 = Date.now() - 31000; renderChain()");
  assert.strictEqual(g.run("chainState().done"), true);
  assert.strictEqual(g.run("S.xp") - xp0, 5);
  g.run("chainFinish()");
  assert.strictEqual(g.run("S.xp") - xp0, 5, "no double pay");
  assert.ok(g.run("shareChain()").includes("1 link in 30 seconds"));
  assert.ok(g.els.main.innerHTML.includes("Your chain"));
});

test("Chain Reaction: merging two devices keeps the further-on go", () => {
  const g = load();
  const m = JSON.parse(g.run(`JSON.stringify(mergeSaves({ made: true, t: 2, cup: freshCup(), chain: { "2026-11-14": { t0: 1, c: ["a"], done: true } } }, { made: true, t: 1, cup: freshCup(), chain: { "2026-11-14": { t0: 1, c: ["a", "b", "c"], done: true } } }).chain)`));
  assert.strictEqual(m["2026-11-14"].c.length, 3);
});

test("club knowledge: counts per club, ranks scale for small clubs, a new rank with your own club pays once", () => {
  const g = load({ localStorage: SAVE });
  const ars = g.run(`clubIdx("Arsenal")`);
  assert.strictEqual(g.run(`knowRank(${ars}).r`), 0);
  const xp0 = g.run("S.xp");
  g.run(`clubPl[${ars}].slice(0, 10).forEach(i => addAlbum(i))`);
  assert.strictEqual(g.run(`knowRank(${ars}).r`), 1);
  assert.strictEqual(g.run("S.xp") - xp0, 50, "Regular pays 50");
  g.run(`addAlbum(clubPl[${ars}][0])`); // naming him again doesn't count twice
  assert.strictEqual(g.run(`knowRank(${ars}).n`), 10);
  // a small club's top rank is reachable
  const small = g.run(`(() => { let c = 0; clubPl.forEach((p, k) => { if (p.length >= 8 && p.length < 30) c = k; }); return c; })()`);
  assert.ok(g.run(`knowNeed(${small}, 5)`) <= g.run(`clubPl[${small}].length`));
  g.run(`view = "album"; albumTab = "names"; render()`);
  assert.ok(g.els.main.innerHTML.includes("Your Arsenal knowledge"));
  assert.ok(g.els.main.innerHTML.includes("Regular"));
});
