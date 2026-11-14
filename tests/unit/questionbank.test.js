// The generated question bank (questions.js) and the Pub Quiz chance that uses it.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const { load, ROOT } = require("../harness.js");
const J = (g, code) => JSON.parse(g.run("JSON.stringify(" + code + ")"));

test("bank: every question is well formed, unique, short enough for a phone, and has two sources", () => {
  const g = load();
  const r = J(g, `(() => { const bad = []; const ids = new Set();
    QB.all.forEach(x => {
      if (ids.has(x.id)) bad.push("dup id " + x.id); ids.add(x.id);
      if (!(x.d >= 1 && x.d <= 4)) bad.push("difficulty " + x.id);
      if (!x.q || x.q.length > 70 || (x.sub || "").length > 40) bad.push("length " + x.id);
      const opts = [x.a, ...x.o]; if (opts.length < 3 || opts.length > 4 || new Set(opts).size !== opts.length || opts.some(o => !o || o.length > 22)) bad.push("options " + x.id);
      if (!Array.isArray(x.src) || x.src.length < 2) bad.push("sources " + x.id);
    });
    return { n: QB.all.length, bad: bad.slice(0, 10), v: QB.v }; })()`);
  assert.ok(r.n > 3000, "a few thousand questions, got " + r.n);
  assert.deepStrictEqual(r.bad, []);
  assert.match(r.v, /^\d{8}$/);
});

test("bank: no time-sensitive wording, no branding, no made-up 'current' facts", () => {
  const txt = fs.readFileSync(path.join(ROOT, "questions.js"), "utf8");
  assert.ok(!/\b(currently|most ever|all-time|Panini)\b/i.test(txt));
  const g = load();
  const cur = J(g, `QB.all.filter(x => x.t === "current-club").map(x => x.q)`);
  cur.forEach(q => assert.match(q, /in [A-Z][a-z]+ \d{4}\?$/, "current-club questions carry a month and year: " + q));
});

test("Pub Quiz: same seed, same questions; difficulty follows the division", () => {
  const g = load();
  const r = J(g, `(() => { const a = makeQuiz(rngOf(hash("x1")), 0, null), b = makeQuiz(rngOf(hash("x1")), 0, null), top = makeQuiz(rngOf(hash("x2")), 3, null);
    return { same: JSON.stringify(a) === JSON.stringify(b), easy: a.qs.every(q => QB.by[q.id].d <= 2), n: a.qs.length, templates: new Set(a.qs.map(q => QB.by[q.id].t)).size, topOk: top.qs.length === 3 }; })()`);
  assert.deepStrictEqual(r, { same: true, easy: true, n: 3, templates: 3, topOk: true });
});

test("Pub Quiz in Club Cup only asks about the club; every PL club has enough questions", () => {
  const g = load();
  const r = J(g, `(() => { const c = CLUB.indexOf("Arsenal"), out = [];
    for (let k = 0; k < 20; k++) { const x = makeQuiz(rngOf(hash("cup" + k)), k % 4, { club: c }); out.push(x && x.qs.every(q => QB.by[q.id].k.includes("Arsenal"))); }
    const thin = ["Arsenal", "Liverpool", "Brentford", "Swindon Town", "Barnsley FC", "Wimbledon"].filter(n => QB.all.filter(x => x.k.includes(n)).length < 12);
    return { allArsenal: out.every(Boolean), thin, arsenal: QB.all.filter(x => x.k.includes("Arsenal")).length }; })()`);
  assert.ok(r.allArsenal);
  assert.deepStrictEqual(r.thin, [], "clubs with too few questions for a cup round");
  assert.ok(r.arsenal >= 300, "Arsenal deep dive: " + r.arsenal);
});

test("Pub Quiz round plays through: right answer scores, review has a Report button per question", () => {
  const g = load();
  const r = J(g, `(() => { const spec = makeQuiz(rngOf(hash("play")), 2, null); ctx = { paint() { }, done() { } };
    const R = RUN.quiz(spec); const realST = setTimeout; let ok = 0;
    spec.qs.forEach((q, k) => { R.lock = false; R.shown = null; R.k = k; R.onTap(q.o.indexOf(0)); });
    const end = R.end(); return { goal: end.goal, ok: R.ok, reports: (end.after.match(/data-act="qreport"/g) || []).length, key: specKey(spec).slice(0, 1) }; })()`);
  assert.deepStrictEqual(r, { goal: true, ok: 3, reports: 3, key: "z" });
});

test("report hook stores the question id, bank version and sources (on the device, offline)", () => {
  const g = load();
  g.run(`Net.report({ id: QB.all[0].id, bank: QB.v, src: QB.all[0].src, d: 3 })`);
  const saved = JSON.parse(g.storage["boffin-qreports"] || "[]");
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].q, J(g, "QB.all[0].id"));
  assert.ok(saved[0].src.length >= 2);
});

test("ghosts: the question version carries the bank version, and fits the question log's 12 characters", () => {
  const g = load();
  const qv = g.run("QV");
  assert.match(qv, /^v5\.\d{8}\|$/);
  assert.ok(qv.replace("|", "").length <= 12);
});

test("themes see Pub Quiz questions (derbies, Title Race)", () => {
  const g = load();
  const r = J(g, `(() => { const t = QB.all.find(x => x.t === "champion"), d = QB.all.find(x => x.k.includes("Arsenal") && x.k.includes("Tottenham"));
    const sp = x => ({ type: "quiz", qs: [{ id: x.id, o: [0, 1, 2, 3] }] });
    return { title: THEMES.title.m(sp(t)), derby: involves(sp(d), CLUB.indexOf("Tottenham")) }; })()`);
  assert.deepStrictEqual(r, { title: true, derby: true });
});
