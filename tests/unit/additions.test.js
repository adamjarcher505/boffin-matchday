// Sticker shirts (kits.js), the player search, and grid hints with the grid score.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const { load } = require("../harness.js");
const KEY = "boffin-matchday-v1", v1 = fs.readFileSync(path.join(__dirname, "../fixtures/save-v1.json"), "utf8");
const J = (g, code) => JSON.parse(g.run("JSON.stringify(" + code + ")"));

test("every sticker club has a shirt, and every colour is a real hex", () => {
  const g = load();
  const missing = J(g, "STK.clubs.filter(c => !KITS[c])");
  assert.deepStrictEqual(missing, [], "clubs with stickers but no shirt");
  const bad = J(g, `[].concat(...Object.keys(KITS).map(c => { const k = KITS[c], ks = [k].concat((k.e || []).map(e => e[2])); return [].concat(...ks.map(x => ["b", "s", "c", "c2", "t"].filter(f => x[f] !== undefined && !/^#[0-9a-f]{6}$/.test(x[f])).map(f => c + "." + f))); }))`);
  assert.deepStrictEqual(bad, []);
  assert.ok(g.run("kitSVG(KITS['Newcastle'])").includes("<rect"), "stripes are drawn");
});

test("shirts follow the player's era: Henry gets the redcurrant, Fabregas the red and white", () => {
  const g = load();
  const kit = n => J(g, `(() => { const s = STK.by['Arsenal'].find(x => PL[x.i][0] === ${JSON.stringify(n)}); return s ? kitFor('Arsenal', s.i, s.c) : null; })()`);
  assert.strictEqual(kit("Thierry Henry").b, "#7b1f32");
  assert.strictEqual(kit("Thierry Henry").s, undefined, "redcurrant has no white sleeves");
  assert.strictEqual(kit("Cesc Fàbregas").b, "#e3101c");
  assert.strictEqual(kit("Bukayo Saka").s, "#f4f4f1");
  const cardiff = J(g, "(() => { const c = CLUB.indexOf('Cardiff'); const i = clubPl[c].find(i => { const s = stkSeasons(i, c); return s && s.from === 2013 && s.to <= 2014; }); return i === undefined ? null : kitFor('Cardiff', i, c).b; })()");
  if (cardiff) assert.strictEqual(cardiff, "#d6001c", "a Cardiff player from 2013-14 is in red");
});

test("search puts the best-known match first and forgives typos and spaces", () => {
  const g = load();
  const first = q => J(g, `(() => { const r = search(${JSON.stringify(q)}); return r.length ? PL[+r[0]][0] : null; })()`);
  assert.strictEqual(first("henry"), "Thierry Henry");
  assert.strictEqual(first("thi hen"), "Thierry Henry");
  assert.strictEqual(first("vanpersie"), "Robin van Persie");
  assert.strictEqual(first("aguro"), "Sergio Agüero");
  assert.strictEqual(first("ibrahimovich"), "Zlatan Ibrahimovic");
  assert.strictEqual(first("ronaldiho"), "Ronaldinho Gaúcho");
  assert.strictEqual(first("x"), null, "one letter isn't a search");
  assert.ok(J(g, "search('aguro')[0].fz") === 1, "a near miss is flagged");
  assert.ok(!J(g, "search('kane').some(i => i.fz)"), "no near misses when there are proper matches");
  assert.ok(g.run("sugName(search('ozil')[0], 'ozil')").includes("<mark>Özil</mark>"), "typed part is lit up, accents and all");
});

test("grid score: full grid 100%, one hint 98%, and a hint on a square you miss costs nothing extra", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const r = J(g, `(() => {
    const base = { c: Array(9).fill("x|1"), h: Array(9).fill(0), r: Array(9).fill(0) };
    const one = Object.assign({}, base, { h: [1, 0, 0, 0, 0, 0, 0, 0, 0] });
    const two = Object.assign({}, base, { h: [2, 0, 0, 0, 0, 0, 0, 0, 0] });
    const miss = { c: ["x|1", "x|1", "x|1", "x|1", "x|1", "x|1", "x|1", "x|1", null], h: [0, 0, 0, 0, 0, 0, 0, 0, 2], r: Array(9).fill(0) };
    return [gridScore(base), gridScore(one), gridScore(two), gridScore(miss), gridHints(miss)];
  })()`);
  assert.deepStrictEqual(r, [100, 98, 95, 89, 0]);
});

test("grid hints point at a real answer and stay the same once given", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const r = J(g, `(() => {
    view = "grid"; render(); const st = gridState(); gridCell = 0; st.h[0] = 2;
    const i = gridHintTarget(0), a = GRID.rows[0], b = GRID.cols[0], ok = validSet(a, b).includes(i);
    const t1 = gridHintText(0), t2 = gridHintText(0), sn = PL[i][0].split(" ").pop();
    return { ok, same: t1 === t2, noName: !t1.includes(sn), letters: t1.includes("(" + sn.length + " letters)"), saved: st.ht[0] === pkey(i) };
  })()`);
  assert.deepStrictEqual(r, { ok: true, same: true, noName: true, letters: true, saved: true });
  const share = g.run(`(() => { const st = gridState(); st.c = st.c.map(() => "x|1"); st.h[0] = 1; return shareGrid(); })()`);
  assert.match(share, /🟨🟩🟩/); assert.match(share, /Score 98%/); assert.match(share, /1 hint/);
});
