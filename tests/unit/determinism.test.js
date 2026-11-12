// Matches must rebuild identically from a seed: ghosts replay the same five chances on another device.
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");

test("league: the same seed gives identical questions, twice in one session and in a separate session", () => {
  const a = load(), b = load();
  for (const tier of [0, 1, 2, 3]) for (let k = 0; k < 25; k++) {
    const call = `JSON.stringify(makeMatch(QV + "3-${tier}-${k}-424242", ${tier}))`;
    const x = a.run(call), y = a.run(call), z = b.run(call);
    assert.strictEqual(x, y); assert.strictEqual(x, z);
    assert.strictEqual(JSON.parse(x).length, 5); assert.ok(JSON.parse(x).every(q => q && q.type));
  }
});

test("league: what a player has already seen never changes what a seed produces", () => {
  const a = load(), b = load();
  b.run('S.seen = makeMatch(QV + "1-0-0-1", 0).map(specKey)');
  for (let k = 0; k < 10; k++) { const call = `JSON.stringify(makeMatch(QV + "1-0-${k}-1", 0))`; assert.strictEqual(a.run(call), b.run(call)); }
});

test("cup: the same seed gives identical ties for every club in the picker", () => {
  const a = load(), b = load(), clubs = JSON.parse(a.run("JSON.stringify(CLUBS_PICK)"));
  assert.ok(clubs.length >= 60);
  for (const c of clubs) for (const tier of [0, 2]) {
    const call = `JSON.stringify(makeCupMatch("Club-1-0-99", ${c}, ${tier}))`;
    const x = a.run(call), y = a.run(call), z = b.run(call);
    assert.strictEqual(x, y); assert.strictEqual(x, z); assert.strictEqual(JSON.parse(x).length, 5);
  }
});

test("every question a seed produces can actually be run (no broken specs)", () => {
  const g = load();
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let t = 0; t < 4; t++) for (let k = 0; k < 40; k++) { const m = makeMatch(QV + "9-" + t + "-" + k + "-7", t); m.forEach(sp => { try { const r = RUN[sp.type](sp); if (!r || typeof r.end !== "function" || typeof r.body !== "function") bad.push(sp.type); r.body(false); r.end(); } catch (e) { bad.push(sp.type + ": " + e.message); } }); } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
});
