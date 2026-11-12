// Saves: old formats load without losing anything, and two devices merge instead of overwriting each other.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const { load } = require("../harness.js");
const KEY = "boffin-matchday-v1", v1 = fs.readFileSync(path.join(__dirname, "../fixtures/save-v1.json"), "utf8");

test("a v1 save migrates to the current version and keeps all progress", () => {
  const old = JSON.parse(v1), g = load({ localStorage: { [KEY]: v1 } }), S = JSON.parse(g.run("JSON.stringify(S)"));
  assert.strictEqual(S.v, g.run("SAVE_V"));
  for (const k of ["made", "name", "club", "xp", "div", "season", "salt", "week", "form", "cw", "cup", "album", "recent", "seen", "played", "g", "grid", "st", "ts", "hist", "lb", "owner", "sound", "kit"])
    assert.deepStrictEqual(S[k], old[k], "field kept: " + k);
  assert.deepStrictEqual(S.stk.got, {}); assert.strictEqual(S.stk.tok, 0); assert.ok(S.tr && S.hap === true);
  // the game still renders and the league table still builds from the migrated save
  assert.ok(g.els.main.innerHTML.includes("Kick off"));
  assert.strictEqual(g.run("leagueTable().length"), 20);
});

test("the original import format (before stats, history and owner existed) also loads", () => {
  const o = JSON.parse(v1); ["ts", "hist", "lb", "kit", "owner"].forEach(k => delete o[k]);
  const g = load({ localStorage: { [KEY]: JSON.stringify(o) } }), S = JSON.parse(g.run("JSON.stringify(S)"));
  assert.strictEqual(S.xp, o.xp); assert.strictEqual(S.div, o.div); assert.deepStrictEqual(S.album, o.album);
  assert.deepStrictEqual(S.ts, {}); assert.deepStrictEqual(S.hist, []); assert.strictEqual(S.owner, "");
});

test("a damaged save falls back to a fresh one instead of crashing", () => {
  const g = load({ localStorage: { [KEY]: "{not json" } });
  assert.strictEqual(g.run("S.made"), false); assert.strictEqual(g.run("S.v"), g.run("SAVE_V"));
});

test("a save written by this version still reads in the old client's loader", () => {
  const g = load({ localStorage: { [KEY]: v1 } }), now = JSON.parse(g.run("JSON.stringify(S)")), old = JSON.parse(v1);
  const asOldClient = Object.assign({}, old, now);     // what the v1 loader does: defaults, then the stored object
  for (const k of Object.keys(old)) if (k !== "v") assert.deepStrictEqual(asOldClient[k], old[k], k);
});

test("mergeSaves: league state comes whole from the newer save, collections are unioned, records take the higher value", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const out = JSON.parse(g.run(`(() => {
    const a = hydrate(JSON.parse(JSON.stringify(S))), b = hydrate(JSON.parse(JSON.stringify(S)));
    a.t = 1000; a.week.pl = 8; a.week.pts = 16; a.xp = 4500; a.album["Only A|80"] = 2; a.seen.push("onlyA"); a.stk.got["a1"] = 1; a.st.m = 64; a.hist.push({ s: 2, d: 1, to: 2, pos: 3, pts: 39, w: 12, dr: 3, l: 4, gf: 50, ga: 30 });
    b.t = 2000; b.week.pl = 9; b.week.pts = 19; b.div = 2; b.xp = 4400; b.album["Only B|90"] = 1; b.seen.push("onlyB"); b.stk.got["b1"] = 2; b.stk.got["a1"] = 3; b.st.m = 65; b.cup.won = 2;
    return JSON.stringify({ ab: mergeSaves(a, b), ba: mergeSaves(b, a), unmade: mergeSaves(fresh(), b).xp });
  })()`));
  for (const m of [out.ab, out.ba]) {
    assert.strictEqual(m.week.pl, 9); assert.strictEqual(m.week.pts, 19);            // newer device's season, untouched
    assert.strictEqual(m.xp, 4500);                                                   // higher XP
    assert.strictEqual(m.album["Only A|80"], 2); assert.strictEqual(m.album["Only B|90"], 1);
    assert.ok(m.seen.includes("onlyA") && m.seen.includes("onlyB"));
    assert.strictEqual(m.stk.got.a1, 3); assert.strictEqual(m.stk.got.b1, 2);
    assert.strictEqual(m.st.m, 65); assert.strictEqual(m.cup.won, 2);
    assert.deepStrictEqual(m.hist.map(h => h.s), [1, 2]);
    assert.strictEqual(m.t, 2000);
  }
  assert.deepStrictEqual(Object.assign({}, out.ab, { seen: 0 }), Object.assign({}, out.ba, { seen: 0 }), "merge gives the same answer whichever device goes first");
  assert.strictEqual(out.unmade, 4400, "a blank device just takes the account's save");
});

const fakeBackend = (cloud, uid) => ({
  name: "fake", uid, async start() { return true; }, async players() { return []; }, async pushPlayer(r) { cloud.player = r; },
  async stampSave() { return cloud.save ? cloud.save.t : null; }, async loadSave() { return cloud.save || null; }, async writeSave(json, t) { cloud.save = { json, t }; },
  async clubWars() { return null; }, async logMatch() { }, async questionStats() { return null; }, async deleteAccount() { }
});

test("two devices both play offline, then sync: neither loses progress and the cloud ends up with both", async () => {
  const cloud = {};
  const device = () => { const g = load({ localStorage: { [KEY]: v1 }, globals: { FAKE: fakeBackend(cloud, "u1") } }); g.run('Net.kind = "fake"; Net.b = FAKE; Net.uid = "u1"; Net.ready = true; S.owner = "u1"; S.t = 500;'); return g; };
  const A = device(), B = device();
  await A.run("Net.push()"); await B.run("Net.push()");                                 // both start from the same synced save
  A.run('S.album["Offline A|77"] = 1; S.xp += 300; S.stk.got["sa"] = 1; S.t = 5000;');   // A plays offline
  B.run('S.album["Offline B|88"] = 1; S.week.pl += 1; S.week.pts += 3; S.stk.got["sb"] = 1; S.t = 9000;');   // B plays offline, later
  await A.run("Net.push()"); await B.run("Net.push()"); await A.run("Net.push()");     // A reconnects, then B, then A again
  const a = JSON.parse(A.run("JSON.stringify(S)")), b = JSON.parse(B.run("JSON.stringify(S)")), c = JSON.parse(cloud.save.json);
  for (const s of [a, b, c]) {
    assert.strictEqual(s.album["Offline A|77"], 1); assert.strictEqual(s.album["Offline B|88"], 1);
    assert.strictEqual(s.stk.got.sa, 1); assert.strictEqual(s.stk.got.sb, 1);
    assert.strictEqual(s.xp, 4610); assert.strictEqual(s.week.pl, 8); assert.strictEqual(s.week.pts, 16);
    assert.strictEqual(s.owner, "u1");
  }
  assert.strictEqual(cloud.player.xp, 4610);
});

test("signing in as a different account on the same device never inherits the previous account's progress", async () => {
  const cloud = {};
  const g = load({ localStorage: { [KEY]: v1 }, globals: { FAKE: fakeBackend(cloud, "someone-else") } });
  g.run('Net.kind = "fake"; Net.b = FAKE;');
  await g.run('Net.signedIn({ id: "someone-else", email: "x@example.com" }, false)');
  assert.strictEqual(g.run("S.xp"), 0); assert.strictEqual(g.run("S.made"), false); assert.strictEqual(g.run("S.owner"), "someone-else");
  assert.strictEqual(cloud.save, undefined, "nothing of the first account was written to the second");
});
