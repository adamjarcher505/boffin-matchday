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

test("grid history: a finished grid is recorded once, streak counts days running, and today not being done yet doesn't break it", () => {
  const g = load({ localStorage: SAVE });
  const r = JSON.parse(g.run(`(() => {
    S.gh = {}; const out = [];
    out.push(gridStreak());
    [1, 2, 3].forEach(n => { S.gh[daysAgo(n)] = [60, 5, 0]; });
    out.push(gridStreak());                         // yesterday back three days, today not done: 3
    S.gh[daysAgo(0)] = [80, 7, 1];
    out.push(gridStreak());                         // today done too: 4
    delete S.gh[daysAgo(2)];
    out.push(gridStreak());                         // gap: today + yesterday = 2
    out.push(gridAvg7());                           // (80 + 60 + 60) / 3 = 67
    for (let n = 10; n < 90; n++) S.gh[daysAgo(n)] = [10, 1, 0];
    renderGrid(); const g1 = gridState(); g1.c = g1.c.map((x, i) => i < 3 ? "x|" + i : null); recordGrid(g1);
    out.push(Object.keys(S.gh).length <= 60);
    return JSON.stringify(out);
  })()`));
  assert.deepStrictEqual(r, [0, 3, 4, 2, 67, true]);
});

test("grid history merges by day, keeping the better score, and survives hydrate", () => {
  const g = load({ localStorage: SAVE });
  const r = JSON.parse(g.run(`(() => {
    const a = hydrate({ v: 4, made: true, name: "A", club: "Arsenal", xp: 10, t: 2, gh: { "2026-11-01": [50, 5, 0], "2026-11-02": [90, 9, 0] } }),
      b = hydrate({ v: 4, made: true, name: "A", club: "Arsenal", xp: 10, t: 1, gh: { "2026-11-01": [70, 7, 0], "2026-11-03": [30, 3, 0] } });
    const m = mergeSaves(a, b);
    return JSON.stringify([m.gh, hydrate({ v: 2, made: true, name: "x", club: "Arsenal" }).gh]);
  })()`));
  assert.deepStrictEqual(r[0], { "2026-11-01": [70, 7, 0], "2026-11-02": [90, 9, 0], "2026-11-03": [30, 3, 0] });
  assert.deepStrictEqual(r[1], {});
});

test("Seven-Day Grid medal needs seven days running", () => {
  const g = load({ localStorage: SAVE });
  const r = JSON.parse(g.run(`(() => { const m = MEDALS.find(x => x.id === "grid7"); S.gh = {}; const a = m.ok();
    for (let n = 0; n < 7; n++) S.gh[daysAgo(n)] = [50, 5, 0]; return JSON.stringify([a, m.ok()]); })()`));
  assert.deepStrictEqual(r, [false, true]);
});
