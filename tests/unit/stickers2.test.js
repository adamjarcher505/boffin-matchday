// 14/11/2026 afternoon: sticker redesign, Legends, Sticker of the Day, peel-and-stick, Best XI, team photo, swaps.
const test = require("node:test"), assert = require("node:assert");
const { load } = require("../harness.js");
const SAVE = { "boffin-matchday-v1": JSON.stringify({ v: 3, made: true, name: "T", club: "Arsenal", salt: 1 }) };

test("sticker front: back of the shirt with his surname, era class, tier still shown", () => {
  const g = load({ localStorage: SAVE });
  const html = g.run(`(() => { const s = STK.by["Arsenal"][0]; S.stk.got[s.key] = 1; return stkCard(s, 1); })()`);
  const sn = g.run(`PL[STK.by["Arsenal"][0].i][0].split(" ").slice(-1)[0].toUpperCase()`);
  assert.ok(html.includes("shirt kit back"), "back-of-shirt svg");
  assert.ok(html.includes(">" + sn + "</textPath>"), "surname on the shirt");
  assert.match(html, /class="stkr gold got e(90|00|10)/);
  // every sticker in the album draws without throwing
  assert.strictEqual(g.run(`Object.values(STK.all).filter(s => s.i !== undefined).map(s => stkCard(s, 1)).length`) > 1000, true);
});

test("Legends: three per club, Arsenal's are the ones Adam named, a title earns the shot, winning it upgrades", () => {
  const g = load({ localStorage: SAVE });
  g.run("window.PEEL_OFF = true");
  assert.deepStrictEqual(JSON.parse(g.run(`JSON.stringify(legOf("Arsenal").map(k => PL[STK.all[k].i][0]))`)), ["Thierry Henry", "Dennis Bergkamp", "Patrick Vieira"]);
  assert.ok(g.run(`STK.clubs.every(c => legOf(c).length >= 1 && legOf(c).length <= 3)`));
  g.run(`S.stk.offer = null; stkAfterMatch({ mode: "league", goals: 3, won: true, promoted: true, title: true })`);
  assert.strictEqual(g.run("S.stk.offer.tier"), "legend");
  g.run("stkGo()");
  assert.ok(g.run(`legOf("Arsenal").includes(S.stk.offer.key)`), "own club's Legend first");
  g.run("stkStart()");
  assert.strictEqual(g.run("STKA.gold"), true, "Gold rules");
  const xp0 = g.run("S.xp");
  g.run("stkPick(STKA.slot.i)");
  const k = g.run(`legOf("Arsenal").find(k => stkIsLeg(k))`);
  assert.ok(k);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(k)}]`), 1);
  assert.ok(g.run("S.xp") - xp0 >= 300);
  assert.ok(g.run(`stkCard(STK.all[${JSON.stringify(k)}], 1)`).includes(" leg"), "Legend design");
});

test("Sticker of the Day: same for everyone, a waiting offer is put aside and handed back, one go a day", () => {
  const g = load({ localStorage: SAVE }), h = load();
  g.run("window.PEEL_OFF = true");
  assert.strictEqual(g.run("sotdSlot(dayKey()).key"), h.run("sotdSlot(dayKey()).key"));
  g.run(`S.stk.offer = { tier: "paper", why: "x" }`);
  g.run("sotdGo()");
  assert.strictEqual(g.run("S.stk.offer.daily"), g.run("dayKey()"));
  assert.ok(g.els.main.innerHTML.includes("Sticker of the Day"));
  g.run("stkStart()");
  assert.strictEqual(g.run("STKA.rt"), "foil");
  g.run("stkPick(STKA.slot.i)");
  assert.strictEqual(g.run("S.stk.dd.r"), 1);
  assert.strictEqual(g.run("S.stk.offer.tier"), "paper", "the paper offer came back");
  assert.ok(g.run("shareSotd()").includes("Named in 1 guess"));
  g.run("sotdGo()");
  assert.ok(g.els.over.innerHTML.includes("Got him"), "second go just shows the result");
});

test("peel and stick: a new sticker waits to be stuck in, a tap does it", () => {
  const g = load({ localStorage: SAVE });
  g.run(`S.stk.offer = { tier: "paper", why: "x" }; stkGo(); stkStart(); stkPick(STKA.slot.i)`);
  assert.ok(g.els.main.innerHTML.includes('id="pslot"'), "peel stage first");
  g.run("stkStuck(true)");
  assert.ok(g.els.main.innerHTML.includes("Stuck in"));
});

test("Best XI: only your stickers, right position, shared as text", () => {
  const g = load({ localStorage: SAVE });
  g.run(`Object.values(STK.all).filter(s => s.i !== undefined).slice(0, 200).forEach(s => S.stk.got[s.key] = 1)`);
  g.run(`view = "album"; albumTab = "xi"; render()`);
  assert.strictEqual((g.els.main.innerHTML.match(/class="xis empty"/g) || []).length, 11);
  g.run("xiPicker(0)");
  const gk = g.run(`(document.getElementById("over").innerHTML.match(/data-v="0\\|([^"]+)"/) || [])[1]`);
  assert.ok(gk, "a keeper to pick");
  assert.strictEqual(g.run(`POSN[PL[STK.all[${JSON.stringify(gk)}].i][2]]`), "GK");
  g.run(`xiState().s[0] = ${JSON.stringify(gk)}; render()`);
  assert.ok(g.run("shareXI()").startsWith("MY BOFFIN XI (4-3-3)"));
  assert.ok(g.run("shareXI()").includes("GK: "));
});

test("team photo only for a finished page", () => {
  const g = load({ localStorage: SAVE });
  g.run(`teamPhoto("Arsenal")`);
  assert.strictEqual(g.run('$("over").innerHTML'), "");
  g.run(`STK.by["Arsenal"].forEach(s => S.stk.got[s.key] = 1); S.stk.pages["Arsenal"] = "2026-11-14"; teamPhoto("Arsenal")`);
  assert.strictEqual((g.run('$("over").innerHTML').match(/stkr [a-z]+ got/g) || []).length, 18);
  assert.ok(g.run('$("over").innerHTML').includes("14/11/2026"));
});

test("swaps: offering puts the double in escrow, cancelling returns it, collecting adds what came back, taking swaps", async () => {
  const g = load({ localStorage: SAVE });
  const [a, b] = JSON.parse(g.run(`JSON.stringify(STK.by["Arsenal"].slice(0, 2).map(s => s.key))`));
  g.run(`S.stk.got[${JSON.stringify(a)}] = 2; S.stk.got[${JSON.stringify(b)}] = 3`);
  // fake server
  g.run(`Net.canSwap = () => true; window.CALLS = []; Net.swap = async (fn, args) => { CALLS.push(fn); if (fn === "swap_offer") return true; if (fn === "swap_cancel") return true; if (fn === "swap_collect") return window.COLLECT || []; if (fn === "swap_peek") return [{ give: ${JSON.stringify(a)}, open: true, mine: false }]; if (fn === "swap_take") return ${JSON.stringify(a)}; return null; }`);
  await g.run(`swapOffer(${JSON.stringify(a)})`);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(a)}]`), 1, "double held back");
  assert.strictEqual(g.run("S.stk.out.length"), 1);
  assert.ok(g.run("SHARE").includes("?swap="));
  await g.run(`swapCancel(S.stk.out[0].c)`);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(a)}]`), 2, "back on cancel");
  await g.run(`swapOffer(${JSON.stringify(a)})`);
  g.run(`window.COLLECT = [{ code: S.stk.out[0].c, back: ${JSON.stringify(b)} }]`);
  await g.run("swapCollect()");
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(b)}]`), 4);
  assert.strictEqual(g.run("S.stk.out.length"), 0);
  // the mate's side
  g.run(`SWAPIN = "abcdefgh23"`);
  await g.run("swapBoot()");
  assert.ok(g.els.over.innerHTML.includes("A mate's offering you"));
  await g.run(`swapTake(${JSON.stringify(b)})`);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(b)}]`), 3);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(a)}]`), 2);
});

test("merging two devices keeps Legend editions from both", () => {
  const g = load();
  const m = JSON.parse(g.run(`JSON.stringify(mergeSaves({ made: true, t: 2, cup: freshCup(), stk: Object.assign(freshStk(), { leg: { a: 1 } }) }, { made: true, t: 1, cup: freshCup(), stk: Object.assign(freshStk(), { leg: { b: 1 } }) }).stk.leg)`));
  assert.deepStrictEqual(Object.keys(m).sort(), ["a", "b"]);
});
