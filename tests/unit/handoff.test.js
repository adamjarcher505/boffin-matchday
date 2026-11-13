// iPhone sign-in hand-off (net.js + supabase/003_handoff.sql): the link opens Safari, Safari passes the session to the installed game.
const test = require("node:test"), assert = require("node:assert"), { webcrypto } = require("crypto");
const { load } = require("../harness.js");

// a stand-in for supabase-js that records what the game asks of it; handoffs live in `table`, like the real SQL
const fakeSb = `globalThis.CALLS = []; globalThis.TABLE = {};
  Net.kind = "supabase"; Net.b = Backends.supabase; Net.b.sb = {
    auth: {
      signInWithOtp: async o => { CALLS.push(["otp", o]); return { error: null }; },
      setSession: async s => { CALLS.push(["setSession", s]); return { error: null }; },
      stopAutoRefresh: () => CALLS.push(["stop"])
    },
    rpc: async (f, a) => {
      CALLS.push([f, a]);
      if (f === "handoff_put") { TABLE[a.p_id] = { a: a.p_access, r: a.p_refresh }; return { data: null, error: null }; }
      if (f === "handoff_take") { const row = TABLE[a.p_id]; delete TABLE[a.p_id]; return { data: row ? [row] : [], error: null }; }
      return { data: null, error: null };
    }
  };`;
const iphoneApp = { navigator: { onLine: true, userAgent: "node-test", standalone: true }, crypto: webcrypto };

test("the installed iPhone game puts a 64-character id in the link and remembers it", async () => {
  const g = load({ globals: iphoneApp }); g.run(fakeSb);
  assert.strictEqual(await g.run(`Net.sendCode("a@b.co")`), null);
  const to = g.run(`CALLS[0][1].options.emailRedirectTo`);
  assert.match(to, /^http:\/\/localhost:8080\/\?h=[0-9a-f]{64}$/);
  assert.strictEqual(JSON.parse(g.storage["boffin-handoff"]).id, to.split("=")[1]);
});

test("a normal browser tab asks for a plain link, as before", async () => {
  const g = load({ globals: { crypto: webcrypto } }); g.run(fakeSb);
  await g.run(`Net.sendCode("a@b.co")`);
  assert.strictEqual(g.run(`CALLS[0][1].options.emailRedirectTo`), "http://localhost:8080/");
  assert.strictEqual(g.storage["boffin-handoff"], undefined);
});

test("Safari files the session and forgets it without signing out; the app picks it up once", async () => {
  const id = "ab".repeat(32);
  const safari = load({ search: "?h=" + id, globals: { crypto: webcrypto }, localStorage: { "sb-xyz-auth-token": "{}" } });
  safari.run(fakeSb);
  safari.run(`globalThis.WENT = ""; location.replace = u => { WENT = u; }; Object.defineProperty(localStorage, "sb-xyz-auth-token", { value: 1, enumerable: true, configurable: true });`);
  assert.strictEqual(safari.run(`Net.hid`), id);
  assert.strictEqual(await safari.run(`Net.giveHandoff(Net.hid, { access_token: "AT", refresh_token: "RT" })`), true);
  assert.strictEqual(safari.run(`WENT`), "http://localhost:8080/?handed=1");
  assert.ok(safari.run(`CALLS.some(c => c[0] === "stop")`), "Safari stops refreshing the session");
  assert.ok(!safari.run(`CALLS.some(c => /signOut/.test(c[0]))`), "never signs out (that would end the app's session too)");

  const app = load({ globals: iphoneApp, localStorage: { "boffin-handoff": JSON.stringify({ id, t: Date.now() }) } });
  app.run(fakeSb); app.run(`TABLE = ${safari.run("JSON.stringify(TABLE)")}`);
  await app.run(`Net.takeHandoff(${JSON.stringify(id)})`);
  assert.deepStrictEqual(app.run(`JSON.stringify(CALLS.find(c => c[0] === "setSession")[1])`), JSON.stringify({ access_token: "AT", refresh_token: "RT" }));
  assert.strictEqual(app.storage["boffin-handoff"], undefined, "the pending link is cleared");
  await app.run(`Net.takeHandoff(${JSON.stringify(id)})`);
  assert.strictEqual(app.run(`CALLS.filter(c => c[0] === "setSession").length`), 1, "taken once only");
});

test("if Safari can't file it (SQL not run yet), it signs in Safari as before", async () => {
  const g = load({ search: "?h=" + "cd".repeat(32), globals: { crypto: webcrypto } }); g.run(fakeSb);
  g.run(`Net.b.sb.rpc = async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })`);
  assert.strictEqual(await g.run(`Net.giveHandoff(Net.hid, { access_token: "AT", refresh_token: "RT" })`), false);
});

test("an old pending link (over 15 minutes) is dropped, not polled", () => {
  const g = load({ globals: iphoneApp, localStorage: { "boffin-handoff": JSON.stringify({ id: "ef".repeat(32), t: Date.now() - 16 * 60 * 1000 }) } });
  g.run(fakeSb); g.run(`Net.pollHandoff()`);
  assert.ok(!g.run(`CALLS.length`)); assert.strictEqual(g.storage["boffin-handoff"], undefined);
});
