// 18/11/2026: Pin of the Day (src/pinday.js).
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");
const SAVE = { "boffin-matchday-v1": JSON.stringify({ v: 4, made: true, name: "T", club: "Arsenal", salt: 1 }) };

test("same five grounds for everyone on a day, five different grounds, no ground back within 18 days", () => {
  const a = load({ localStorage: SAVE }), b = load({ localStorage: SAVE });
  const day = n => `dayKey(new Date(2026, 10, 18 + ${n}, 12))`;
  const r = JSON.parse(a.run(`(() => { const bad = [], days = []; for (let n = 0; n < 120; n++) days.push(pinDayGrounds(${day("n")}));
    days.forEach((d, n) => { if (d.length !== 5 || new Set(d).size !== 5) bad.push("five " + n); if (d.some(i => !GROUNDS[i] || typeof GROUNDS[i].la !== "number")) bad.push("ground " + n); });
    const win = Math.floor(GROUNDS.length / 5);
    for (let n = 0; n + win <= days.length; n++) { const all = days.slice(n, n + win).flat(); if (new Set(all).size !== all.length) bad.push("repeat in window from " + n); }
    return JSON.stringify({ bad, win, days: days.slice(0, 5) }); })()`));
  assert.deepStrictEqual(r.bad, []);
  assert.ok(r.win >= 18, "window " + r.win);
  const other = JSON.parse(b.run(`JSON.stringify([0, 1, 2, 3, 4].map(n => pinDayGrounds(dayKey(new Date(2026, 10, 18 + n, 12)))))`));
  assert.deepStrictEqual(other, r.days, "a second session gets the same days");
  assert.notDeepStrictEqual(r.days[0], r.days[1]);
});

test("playing all five (names mode, as headless has no map) scores, pays once, saves and shares without spoilers", () => {
  const g = load({ localStorage: SAVE });
  g.run(`view = "pinday"; renderPinDay()`);
  assert.ok(g.els.main.innerHTML.includes("Kick off"));
  const xp0 = g.run("S.xp");
  g.run(`pdGo()`);
  assert.ok(g.els.main.innerHTML.includes("names today"));
  for (let k = 0; k < 5; k++) {
    g.run(`(() => { const gs = pinDayGrounds(), o = pinOptions({ qs: gs }, ${k}); pdOption(o.indexOf(gs[${k}])); pdNext(); })()`);
  }
  assert.strictEqual(g.run("pdState().done"), true);
  assert.strictEqual(g.run("pdPts(pdState())"), 10);
  const gain = g.run("S.xp") - xp0;
  assert.ok(gain >= 10 + 4 * 10, "XP paid: " + gain);
  g.run(`pdFinish()`); // a second finish must not pay again
  assert.strictEqual(g.run("S.xp") - xp0, gain);
  const share = g.run("sharePinDay()");
  assert.ok(/^1X2 PIN No\. \d+\n🟩🟩🟩🟩🟩\n10\/10/.test(share), share);
  for (const i of JSON.parse(g.run("JSON.stringify(pinDayGrounds())"))) {
    assert.ok(!share.includes(g.run(`GROUNDS[${i}].c`)) && !share.includes(g.run(`GROUNDS[${i}].s`)), "share gives a ground away");
  }
  assert.ok(g.run("pinDayTile()").includes("10/10"));
  assert.ok(g.run("S.st.pins") === 1);
});

test("a wrong answer scores 0, a reload mid-way picks up where you were, and finishing counts for the Play Pin of the Day objective", () => {
  const g = load({ localStorage: SAVE });
  g.run(`view = "pinday"; pdGo(); (() => { const gs = pinDayGrounds(), o = pinOptions({ qs: gs }, 0); pdOption(o.findIndex(i => GROUNDS[i].s !== GROUNDS[gs[0]].s)); })()`);
  assert.strictEqual(g.run("pdState().res[0]"), 0);
  g.run(`pdNext()`);
  // a fresh page: PD is reset but the save says one ground is done, so we are on the second
  const g2 = load({ localStorage: { "boffin-matchday-v1": JSON.stringify(JSON.parse(g.run("JSON.stringify(S)"))) } });
  g2.run(`view = "pinday"; renderPinDay()`);
  assert.strictEqual(g2.run("pdState().res.length"), 1);
  assert.ok(!g2.els.main.innerHTML.includes("Kick off"), "doesn't make you start again");
  assert.ok(g2.els.main.innerHTML.includes("2 of 5"));
  // the objective counts a finished Pin of the Day, and nothing else
  assert.strictEqual(g2.run(`OBJ.pinday.on({ k: "pinday" })`), 1);
  assert.strictEqual(g2.run(`OBJ.pinday.on({ k: "grid" })`), 0);
});

test("two devices: the one that got further with today's Pin of the Day wins the merge", () => {
  const g = load({ localStorage: SAVE });
  const r = JSON.parse(g.run(`(() => { const k = dayKey();
    const a = hydrate({ v: 4, made: true, name: "A", club: "Arsenal", xp: 5, t: 2, pd: { [k]: { res: [2, 1], km: [0.4, 5], done: false, xp: 0 } } }),
      b = hydrate({ v: 4, made: true, name: "A", club: "Arsenal", xp: 5, t: 1, pd: { [k]: { res: [2, 1, 0, 2, 2], km: [0.4, 5, 30, 0.1, 0.2], done: true, xp: 40 } } });
    const m = mergeSaves(a, b);
    return JSON.stringify([m.pd[k].done, m.pd[k].res.length, hydrate({ v: 2, made: true, name: "x", club: "Arsenal" }).pd]); })()`));
  assert.deepStrictEqual(r, [true, 5, {}]);
});
