// Level curve, titles, frames, level rewards, wins on the bounce, the full-time XP bar, profiles, rankings, head to head.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const { load } = require("../harness.js");
const KEY = "boffin-matchday-v1", v1 = fs.readFileSync(path.join(__dirname, "../fixtures/save-v1.json"), "utf8");
const playLeague = (g, my) => g.run(`(() => { startLeagueMatch(); M.my = ${JSON.stringify(my)}; M.deep = 0; M.out = []; M.rev = []; M.xp = 0; M.tt = [1, 2, 3, 4, 5]; fullTime(); return S.xp; })()`);

test("a v3 save moves to v4 without paying out rewards for levels already reached", () => {
  const old = JSON.parse(v1); old.v = 3; old.stk = { got: {}, tok: 2 };
  const g = load({ localStorage: { [KEY]: JSON.stringify(old) } }), S = JSON.parse(g.run("JSON.stringify(S)"));
  assert.strictEqual(S.v, 4); assert.strictEqual(S.xp, old.xp);
  assert.strictEqual(S.lvr, g.run(`levelOf(${old.xp})`)); assert.strictEqual(S.stk.tok, 2); assert.strictEqual(S.wsk, 0);
  assert.ok(g.els.main.innerHTML.length > 0, "the game still renders");
});

test("level curve: quick early levels, then never more than ~8 matches a level", () => {
  const g = load(), PER = 200; // rough XP a match
  assert.strictEqual(g.run("levelAt(0)"), 0); assert.strictEqual(g.run("levelOf(0)"), 1);
  assert.strictEqual(g.run("levelOf(levelAt(1))"), 2); assert.strictEqual(g.run("levelOf(levelAt(1) - 1)"), 1);
  assert.ok(g.run("levelAt(4)") <= 4 * PER, "level 5 in a first session");
  assert.ok(g.run("levelAt(9)") <= 13 * PER, "level 10 in a couple of days");
  for (let n = 1; n < 100; n++) {
    const gap = g.run(`levelAt(${n + 1}) - levelAt(${n})`), prev = g.run(`levelAt(${n}) - levelAt(${n - 1})`);
    assert.ok(gap >= prev, "levels never get cheaper: " + n); assert.ok(gap <= 8.5 * PER, "no wall at level " + n);
  }
  assert.strictEqual(g.run("levelOf(1e12)"), g.run("LV_MAX"), "huge XP doesn't loop forever");
});

test("titles every 5 levels, frames by band, stars past the top title, no clash with medal or knowledge names", () => {
  const g = load();
  assert.strictEqual(g.run("rankOf(1)"), "Trialist"); assert.strictEqual(g.run("rankOf(4)"), "Trialist"); assert.strictEqual(g.run("rankOf(5)"), "Pub Expert");
  assert.strictEqual(g.run("rankOf(80)"), "The GOAT"); assert.strictEqual(g.run("rankOf(90)"), "The GOAT ★"); assert.strictEqual(g.run("rankOf(100)"), "The GOAT ★★");
  assert.strictEqual(g.run("frameOf(9).k"), "pl"); assert.strictEqual(g.run("frameOf(10).k"), "brz"); assert.strictEqual(g.run("frameOf(45).k"), "lit"); assert.strictEqual(g.run("frameOf(60).k"), "leg");
  for (let L = 1; L < 100; L++) assert.ok(g.run(`nextReward(${L}).L`) - L <= 5, "gap after level " + L);
  assert.deepStrictEqual(JSON.parse(g.run("JSON.stringify(levelRewards(10).map(r => r.k))")), ["title", "frame", "tok"]);
  const taken = JSON.parse(g.run("JSON.stringify(MEDALS.map(m => m.n).concat(KNOW_RANKS, DIVS))")), titles = JSON.parse(g.run("JSON.stringify(RANKS.map(r => r[1]))"));
  for (const t of titles) assert.ok(!taken.includes(t), "title clashes: " + t);
});

test("a sticker token every 5 levels, paid once even if the level is reached again after a merge", () => {
  const g = load();
  const o = JSON.parse(g.run(`(() => { S = fresh(); S.made = true; const t0 = S.stk.tok; addXp(levelAt(10) - 1, true); const t1 = S.stk.tok; addXp(20000, true); const lv = levelOf(S.xp), t2 = S.stk.tok;
    const again = hydrate(JSON.parse(JSON.stringify(S))); again.xp = levelAt(4); again.lvr = 1; const m = mergeSaves(S, again); S = m; lvGrant(4, 10); return JSON.stringify({ t0, t1, t2, lv, lvr: m.lvr, t3: S.stk.tok }); })()`));
  assert.strictEqual(o.t0, 0); assert.strictEqual(o.t1, 2, "levels 5 and 10"); assert.strictEqual(o.t2, Math.floor(o.lv / 5));
  assert.strictEqual(o.lvr, o.lv); assert.strictEqual(o.t3, o.t2, "nothing paid twice");
});

test("wins on the bounce: +10 a win after the first, capped, reset by anything else", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const o = JSON.parse(g.run(`(() => { S.wsk = 0; const a = winRunLines(true), b = winRunLines(true); S.wsk = 20; const c = winRunLines(true), best = S.st.bws; const d = winRunLines(false); return JSON.stringify({ a, b, c, d, wsk: S.wsk, best }); })()`));
  assert.deepStrictEqual(o.a, []); assert.deepStrictEqual(o.b, [["2 wins on the bounce", 10]]); assert.deepStrictEqual(o.c, [["21 wins on the bounce", 50]]);
  assert.deepStrictEqual(o.d, []); assert.strictEqual(o.wsk, 0); assert.strictEqual(o.best, 21);
});

test("full time: the XP bar starts from the old XP, shows the title and next reward, and the level-up sheet waits for the bar", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  g.run("S.wsk = 1");
  const before = g.run("S.xp"), after = playLeague(g, [1, 1, 1, 1, 1]), html = g.els.main.innerHTML;
  assert.ok(after > before); assert.ok(html.includes('id="xpb"')); assert.ok(html.includes("Next reward")); assert.ok(html.includes("2 wins on the bounce"));
  assert.ok(html.includes(`id="xplv">${g.run(`levelOf(${before})`)}<`), "bar starts at the old level");
  assert.ok(!g.run('$("over").innerHTML').includes("lvup"), "no sheet until the bar has filled (timers don't run in tests)");
});

test("public profile: numbers only, nothing private, small, sent with the league row", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const pr = JSON.parse(g.run("JSON.stringify(profPub())")), raw = JSON.stringify(pr);
  assert.ok(raw.length < 1500, "pr is " + raw.length + " bytes");
  assert.ok(!/@|owner|salt|album|seen/.test(raw)); assert.strictEqual(pr.v, 1);
  for (const [k, x] of Object.entries(pr)) if (k !== "ts") assert.strictEqual(typeof x, "number", k);
  assert.ok(g.run("Net.row()").pr);
});

test("rankings, another player's card and head to head", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const xp = g.run("S.xp");
  g.run(`Net.rows = [
    { id: "a", n: "Big Dave", c: "Arsenal", d: 1, xp: ${xp + 500}, cu: 3, pr: { v: 1, m: 40, w: 30, g: 150, dc: 20, ts: { career: [20, 18], hl: [10, 2] }, al: 300, sk: 5, md: 9, bd: 3, ws: 7, ds: 4 } },
    { id: "b", n: "Row Z Ron", c: "Chelsea", d: 0, xp: 10, cu: 0 },
    { id: "c", n: "", c: "Arsenal", xp: 99999 }]`);
  const ri = JSON.parse(g.run("JSON.stringify(rankInfo(false))")), club = JSON.parse(g.run("JSON.stringify(rankInfo(true))"));
  assert.strictEqual(ri.n, 3, "rows without a name are skipped"); assert.strictEqual(ri.pos, 2); assert.strictEqual(ri.above.name, "Big Dave");
  assert.strictEqual(club.n, 2);
  g.run(`leagueTab = "rank"; view = "league"; renderLeague()`);
  assert.ok(g.els.main.innerHTML.includes("XP to overtake Big Dave"));
  g.run(`profId = "a"; profBack = "league"; view = "pl"; render()`);
  const h = g.els.main.innerHTML;
  assert.ok(h.includes("Head to head")); assert.ok(h.includes("Career Path specialist")); assert.ok(h.includes("Big Dave"));
  g.run(`profId = "b"; render()`);
  assert.ok(g.els.main.innerHTML.includes("hasn't shared their full stats"), "old rows without pr still show a card");
  g.run(`view = "stats"; render()`);
  assert.strictEqual(g.run("view"), "me", "the old Stats view opens your profile");
  assert.ok(g.els.main.innerHTML.includes("The road")); assert.ok(g.els.main.innerHTML.includes("Share my card"));
  assert.match(g.run("shareCard()"), /^1X2 · .+\nLevel \d+ · /);
});
