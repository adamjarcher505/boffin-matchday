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
  assert.ok(g.run("shareXI()").startsWith("MY 1X2 XI (4-3-3)"));
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

test("swaps: offer, cancel, collect and take move stickers through the swap ledger (recv/gone), never by editing got", async () => {
  const g = load({ localStorage: SAVE });
  const [a, b] = JSON.parse(g.run(`JSON.stringify(STK.by["Arsenal"].slice(0, 2).map(s => s.key))`));
  const n = k => g.run(`stkN(${JSON.stringify(k)})`);
  g.run(`S.stk.got[${JSON.stringify(a)}] = 2; S.stk.got[${JSON.stringify(b)}] = 3`);
  g.run(`Net.canSwap = () => true; Net.push = async () => {}; Net.swap = async (fn, args) => { if (fn === "swap_offer") return true; if (fn === "swap_cancel") return true; if (fn === "swap_collect") return window.COLLECT || []; if (fn === "swap_peek") return [{ give: ${JSON.stringify(a)}, open: true, mine: false }]; if (fn === "swap_take") return ${JSON.stringify(a)}; return null; }`);
  await g.run(`swapOffer(${JSON.stringify(a)})`);
  assert.strictEqual(n(a), 1, "double held back");
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(a)}]`), 2, "earned count untouched");
  assert.ok(g.run("SHARE").includes("?swap="));
  await g.run(`swapCancel(S.stk.out[0].c)`);
  assert.strictEqual(n(a), 2, "back on cancel");
  await g.run(`swapOffer(${JSON.stringify(a)})`);
  g.run(`window.COLLECT = [{ code: S.stk.out[0].c, back: ${JSON.stringify(b)} }]`);
  await g.run("swapCollect()");
  assert.strictEqual(n(b), 4);
  assert.strictEqual(g.run("S.stk.out.length"), 0);
  // the mate's side
  g.run(`SWAPIN = "abcdefgh23"`);
  await g.run("swapBoot()");
  assert.ok(g.els.over.innerHTML.includes("A mate's offering you"));
  await g.run(`swapTake(${JSON.stringify(b)})`);
  assert.strictEqual(n(b), 3);
  assert.strictEqual(n(a), 2);
  // an offer the server refuses (it doesn't see a double in your saved album) changes nothing
  g.run(`Net.swap = async () => false`);
  await g.run(`swapOffer(${JSON.stringify(b)})`);
  assert.strictEqual(n(b), 3);
});

test("swap ledger survives a device merge: a phone that never saw the swap can't undo it", () => {
  const g = load();
  const m = JSON.parse(g.run(`(() => { const phone = { made: true, t: 1, cup: freshCup(), stk: Object.assign(freshStk(), { got: { x: 2 } }) }, server = { made: true, t: 2, cup: freshCup(), stk: Object.assign(freshStk(), { got: { x: 2 }, gone: { x: 1 } }) }; const m = mergeSaves(phone, server); S = m; return JSON.stringify({ n: stkN("x") }); })()`));
  assert.strictEqual(m.n, 1);
});

test("merging two devices keeps Legend editions from both", () => {
  const g = load();
  const m = JSON.parse(g.run(`JSON.stringify(mergeSaves({ made: true, t: 2, cup: freshCup(), stk: Object.assign(freshStk(), { leg: { a: 1 } }) }, { made: true, t: 1, cup: freshCup(), stk: Object.assign(freshStk(), { leg: { b: 1 } }) }).stk.leg)`));
  assert.deepStrictEqual(Object.keys(m).sort(), ["a", "b"]);
});

test("rebuilt pages: 79 clubs, 18 different eligible players each, legends as Gold Icons", () => {
  const g = load();
  const r = JSON.parse(g.run(`JSON.stringify({ n: STK.clubs.length, bad: STK.clubs.filter(c => { const s = STK.by[c]; return s.length !== 18 || new Set(s.map(x => x.key)).size !== 18 || s.some(x => x.i === undefined || !stkEligible(x.i)); }), ars: STK.by["Arsenal"].slice(0, 3).map(s => PL[s.i][0]), che: STK.by["Chelsea"].slice(0, 3).map(s => PL[s.i][0]), liv: STK.by["Liverpool"].slice(0, 3).map(s => PL[s.i][0]), henryTier: STK.by["Arsenal"].find(s => PL[s.i][0] === "Thierry Henry").tier, lacaTier: STK.by["Arsenal"].find(s => PL[s.i][0] === "Alexandre Lacazette").tier })`));
  assert.strictEqual(r.n, 79);
  assert.deepStrictEqual(r.bad, []);
  assert.deepStrictEqual(r.ars, ["Thierry Henry", "Dennis Bergkamp", "Patrick Vieira"]);
  assert.deepStrictEqual(r.che, ["Frank Lampard", "John Terry", "Didier Drogba"]);
  assert.deepStrictEqual(r.liv, ["Steven Gerrard", "Mohamed Salah", "Jamie Carragher"]);
  assert.strictEqual(r.henryTier, "gold");
  assert.strictEqual(r.lacaTier, "paper");
});

test("page rebuild migration: stickers of players who left a page become tokens, once, and survive a device merge", () => {
  const old = JSON.stringify({ v: 3, made: true, name: "T", club: "Arsenal", salt: 1, stk: { got: { "Arsenal~Kolo Touré|81": 1, "Arsenal~Tomas Rosicky|80": 2, "Arsenal~Thierry Henry|77": 1, "Nott'm Forest~Dougie Freedman|74": 1 }, tok: 1, chase: ["Arsenal~Tomas Rosicky|80"], pages: { Arsenal: "2026-11-13" } } });
  const g = load({ localStorage: { "boffin-matchday-v1": old } });
  assert.strictEqual(g.run("S.stk.tok"), 3, "Rosicky and Freedman left their pages: a token each, on top of the one already held");
  assert.strictEqual(g.run(`stkN("Arsenal~Kolo Touré|81")`), 1, "Kolo Touré is still on the Arsenal page");
  assert.strictEqual(g.run("S.stk.pv"), 2);
  assert.strictEqual(g.run(`stkN("Arsenal~Thierry Henry|77")`), 1, "Henry stays (now a Gold Icon)");
  assert.deepStrictEqual(JSON.parse(g.run("JSON.stringify(S.stk.chase)")), []);
  assert.strictEqual(g.run("S.stk.pages.Arsenal"), undefined, "page no longer complete");
  assert.strictEqual(g.run("stkMigratePages()"), 0, "runs once");
  // the other device still on the old save syncs in: no second payout
  g.run(`S = mergeSaves(S, hydrate(${JSON.stringify(old)})); stkMigratePages()`);
  assert.strictEqual(g.run("S.stk.tok"), 3);
  g.run(`view = "album"; albumTab = "stk"; render()`);
  assert.ok(g.els.main.innerHTML.includes("The album's been redone"));
});
