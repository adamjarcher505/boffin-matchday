// 18/11/2026: Daily Grid fixes (real obscurity, why a guess missed).
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");
const SAVE = { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) };

test("obscurity follows fame, not where a player sits in the list", () => {
  const g = load();
  // three real players of very different fame, listed least famous first: the famous one added last must still be the obvious answer
  const r = JSON.parse(g.run(`(() => {
    const byFame = ALLIDX.slice().sort((a, b) => PL[a][4] - PL[b][4]), lo = byFame[Math.floor(byFame.length * 0.5)], mid = byFame[Math.floor(byFame.length * 0.9)], hi = byFame[byFame.length - 1];
    const v = [lo, mid, hi];
    return JSON.stringify([rarity(v, hi), rarity(v, mid), rarity(v, lo), rarity([hi], hi), rarity(v, -5)]);
  })()`));
  assert.strictEqual(r[0], 0, "most famous = most obvious");
  assert.ok(r[1] > 0 && r[1] < 1);
  assert.strictEqual(r[2], 1, "least famous = deepest cut");
  assert.strictEqual(r[3], 0);
  assert.strictEqual(r[4], 0);
});

test("a wrong grid guess says which half failed", () => {
  const g = load({ localStorage: SAVE });
  const out = JSON.parse(g.run(`(() => {
    const day = dayKey(); renderGrid();
    // row = Arsenal, column = Chelsea: someone who played for Arsenal only
    const A = CLUB.indexOf("Arsenal"), C = CLUB.indexOf("Chelsea");
    GRID.rows[0] = { t: "c", v: A }; GRID.cols[0] = { t: "c", v: C }; gridCell = 0;
    const only = ALLIDX.find(i => hasClub(i, A) && !hasClub(i, C) && !validSetX(GRID.rows[0], GRID.cols[0]).includes(i));
    const neither = ALLIDX.find(i => !hasClub(i, A) && !hasClub(i, C));
    const res = [];
    gridPick(only); res.push($("msg") ? $("msg").textContent : "");
    gridPick(neither); res.push($("msg") ? $("msg").textContent : "");
    return JSON.stringify([res, PL[only][0], PL[neither][0]]);
  })()`));
  assert.ok(/never played for Chelsea/.test(out[0][0]), "names the half that failed: " + out[0][0]);
  assert.ok(out[0][0].includes(out[1]));
  assert.ok(!/never played for Arsenal/.test(out[0][0]));
  assert.ok(out[0][1].includes(out[2]) && !/never played for/.test(out[0][1]), "fits neither: the old line: " + out[0][1]);
});
