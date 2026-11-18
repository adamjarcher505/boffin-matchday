// 18/11/2026: Pin the Ground generator, scoring and distance maths (the round had no unit tests before).
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");

test("every ground has coordinates inside the UK and Ireland", () => {
  const g = load();
  const bad = JSON.parse(g.run(`JSON.stringify(GROUNDS.map((x, i) => [i, x]).filter(([i, x]) => !(typeof x.la === "number" && typeof x.ln === "number" && x.la > 49 && x.la < 61 && x.ln > -11 && x.ln < 2)).map(([i, x]) => x.c))`));
  assert.deepStrictEqual(bad, []);
});

test("Pin the Ground builds three distinct grounds at every tier and is stable for a seed", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const bad = []; for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 200; k++) {
    const x = makeRound("pin", rngOf(hash("pin" + tier + k)), tier, null, true), y = makeRound("pin", rngOf(hash("pin" + tier + k)), tier, null, true);
    if (!x || x.type !== "pin") { bad.push("not pin " + tier + k); continue; }
    if (x.qs.length !== 3 || new Set(x.qs).size !== 3) bad.push("distinct " + tier + k);
    if (x.qs.some(i => !GROUNDS[i])) bad.push("index " + tier + k);
    if (JSON.stringify(x) !== JSON.stringify(y)) bad.push("unstable " + tier + k);
  } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(r, []);
});

test("distance maths and scoring thresholds", () => {
  const g = load();
  assert.ok(g.run("gKm([51.5, -0.1], [51.5, -0.1])") < 0.001);
  const gi = n => g.run(`GROUNDS.findIndex(x => x.c === ${JSON.stringify(n)})`);
  const a = gi("Arsenal"), t = gi("Tottenham Hotspur");
  assert.ok(a >= 0 && t >= 0, "both grounds exist");
  const km = g.run(`gKm([GROUNDS[${a}].la, GROUNDS[${a}].ln], [GROUNDS[${t}].la, GROUNDS[${t}].ln])`);
  assert.ok(km > 5 && km < 7, "Emirates to Spurs is about 6 km, got " + km);
  assert.strictEqual(g.run("pinPoints(1.4)"), 2);
  assert.strictEqual(g.run("pinPoints(1.5)"), 2);
  assert.strictEqual(g.run("pinPoints(7.9)"), 1);
  assert.strictEqual(g.run("pinPoints(8.1)"), 0);
});

test("a perfect pin and a miles-off pin score through the real lock handler", () => {
  const g = load({ localStorage: { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) } });
  g.run(`startTraining("pin"); takeChance(); M.run.mc = false`); // headless has no map library, so force the map path
  assert.strictEqual(g.run("M.run.pts"), 0);
  g.run(`(() => { const gd = GROUNDS[curSpec().qs[0]]; M.run.pin = [gd.la, gd.ln]; M.run.onTap("lock"); })()`);
  assert.strictEqual(g.run("M.run.pts"), 2);
  assert.strictEqual(g.run("M.run.res[0]"), 2);
  g.run(`M.run.lock = false; M.run.shown = false; M.run.k = 1; (() => { M.run.pin = [58.9, -3.0]; M.run.onTap("lock"); })()`);
  assert.strictEqual(g.run("M.run.res[1]"), 0);
  assert.strictEqual(g.run("M.run.pts"), 2);
});

test("no map: the round plays as pick-the-name, always offers the right ground, and scores", () => {
  const g = load({ localStorage: { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) } });
  // options are always four different names, include the right one and are stable for a spec
  const bad = JSON.parse(g.run(`(() => { const bad = []; for (let k = 0; k < 150; k++) {
    const x = makeRound("pin", rngOf(hash("mc" + k)), k % 4, null, true);
    for (let j = 0; j < 3; j++) { const o = pinOptions(x, j), o2 = pinOptions(x, j);
      if (o.length !== 4) bad.push("len " + k);
      if (new Set(o.map(i => GROUNDS[i].s)).size !== 4) bad.push("names " + k);
      if (!o.includes(x.qs[j])) bad.push("right " + k);
      if (o.join() !== o2.join()) bad.push("stable " + k); } } return JSON.stringify(bad); })()`));
  assert.deepStrictEqual(bad, []);
  // headless has no Leaflet, so this is the no-map path: right answer 2, wrong 0
  g.run(`startTraining("pin"); takeChance()`);
  assert.strictEqual(g.run("M.run.mc"), true);
  assert.ok(g.els.rbody.innerHTML.includes("names today"));
  g.run(`(() => { const o = pinOptions(curSpec(), 0); M.run.onTap(String(o.indexOf(curSpec().qs[0]))); })()`);
  assert.strictEqual(g.run("M.run.pts"), 2);
  g.run(`M.run.advance(); (() => { const o = pinOptions(curSpec(), 1); M.run.onTap(String(o.findIndex(i => i !== curSpec().qs[1]))); })()`);
  assert.strictEqual(g.run("M.run.res[1]"), 0);
  g.run(`M.run.advance(); (() => { const o = pinOptions(curSpec(), 2); M.run.onTap(String(o.indexOf(curSpec().qs[2]))); })()`);
  assert.strictEqual(g.run("M.run.pts"), 4);
});

test("pools follow the division, easy tiers never pair near neighbours, and a club's own ground is always in its round", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const bad = [], allow = [["PL"], ["PL", "CH"], ["PL", "CH", "L1"], null];
    for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 150; k++) {
      const x = makeRound("pin", rngOf(hash("div" + tier + k)), tier, null, true);
      if (allow[tier] && x.qs.some(i => !allow[tier].includes(GROUNDS[i].d))) bad.push("division " + tier + " " + k);
      if (tier < 2) for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (gKm([GROUNDS[x.qs[a]].la, GROUNDS[x.qs[a]].ln], [GROUNDS[x.qs[b]].la, GROUNDS[x.qs[b]].ln]) < 3) bad.push("near " + tier + " " + k);
    }
    let withOwn = 0, tried = 0;
    for (let c = 0; c < CLUB.length; c++) {
      const own = GROUNDS.findIndex(x => x.c === CLUB[c]); if (own < 0) continue;
      for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 6; k++) {
        const x = makeMore("pin", rngOf(hash("own" + c + tier + k)), tier, { club: c });
        tried++; if (!x || x.qs.length !== 3 || new Set(x.qs).size !== 3) { bad.push("shape " + CLUB[c]); continue; }
        if (x.qs.includes(own)) withOwn++; else bad.push("no own ground " + CLUB[c] + " " + tier);
      }
    }
    return JSON.stringify({ bad, withOwn, tried }); })()`));
  assert.deepStrictEqual(r.bad, []);
  assert.ok(r.tried > 100 && r.withOwn === r.tried, JSON.stringify(r));
});

test("the generator version moved on when the pin pool changed", () => {
  const g = load();
  assert.ok(/^v7\./.test(g.run("QV")), g.run("QV"));
});

test("the pin can't be locked at country zoom until 20 s have passed, banter follows the distance, and the clock is 60 s", () => {
  const g = load({ localStorage: { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) } });
  assert.strictEqual(g.run("TYPES.pin.t"), 60);
  g.run(`startTraining("pin"); takeChance(); M.run.mc = false; M.run.map = { getZoom: () => 6, remove() {} }; M.t0 = Date.now()`);
  assert.strictEqual(g.run("M.run.canLock()"), false, "country zoom, just started");
  g.run(`M.run.map.getZoom = () => 11`);
  assert.strictEqual(g.run("M.run.canLock()"), true, "street zoom");
  g.run(`M.run.map.getZoom = () => 6; M.t0 = Date.now() - 21000`);
  assert.strictEqual(g.run("M.run.canLock()"), true, "20 s gone: never stuck");
  // banter: every band has lines, and the right band is picked
  assert.deepStrictEqual(JSON.parse(g.run(`JSON.stringify([0.1, 1, 5, 20, 400].map(d => TALK.pin.find(x => d <= x[0])[1].length > 0))`)), [true, true, true, true, true]);
  g.run(`M.t0 = Date.now(); M.run.map = null; M.run.shown = false; M.run.lock = false; (() => { const gd = GROUNDS[curSpec().qs[0]]; M.run.pin = [gd.la, gd.ln]; M.run.onTap("lock"); })()`);
  assert.ok(["On the centre spot.", "Dead centre. Groundsman's work."].includes(g.run("M.run.say[0]")), g.run("M.run.say[0]"));
});
