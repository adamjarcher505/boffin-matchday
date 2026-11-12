// Share cards, season stakes, Club Wars, themes, training XP, abandoned matches, stickers, service worker.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { load, ROOT } = require("../harness.js");
const KEY = "boffin-matchday-v1", v1 = fs.readFileSync(path.join(__dirname, "../fixtures/save-v1.json"), "utf8");

/* play a league match to full time with chosen results, through the real code */
const playLeague = (g, my, deep) => g.run(`(() => { startLeagueMatch(); M.my = ${JSON.stringify(my)}; M.deep = ${deep | 0}; M.out = []; M.rev = []; M.xp = 0; M.tt = [1, 2, 3, 4, 5]; fullTime(); return SHARE; })()`);

test("share cards never include answers, question titles or question clubs", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const share = playLeague(g, [1, 0, 1, 1, 0], 0), rounds = JSON.parse(g.run("JSON.stringify(M.rounds)"));
  const secrets = JSON.parse(g.run(`JSON.stringify([].concat(...M.rounds.map(sp => { const r = RUN[sp.type](sp), out = []; if (r.title) out.push(r.title); (r.picks || []).forEach(i => out.push(PL[i][0])); if (sp.type === "career") out.push(PL[sp.p][0]); if (sp.type === "squad") out.push(CLUB[sp.c]); if (sp.type === "top") out.push(BD.lists[sp.i][0]); if (sp.type === "xi") out.push(BD.xi[sp.i][0] + " " + BD.xi[sp.i][2]); return out; })).filter(x => x && x !== S.club))`));
  for (const s of secrets) assert.ok(!share.includes(s), "share card leaks: " + s);
  assert.match(share, /^BOFFIN MATCHDAY · /); assert.match(share, /🟩⬛🟩🟩⬛/); assert.match(share, /of 20/); assert.match(share, /Level \d+ · Arsenal fan/);
  assert.ok(share.includes(g.run("SHARE_URL")));
  assert.ok(!/claude\.ai\/artifact/.test(fs.readFileSync(path.join(ROOT, "app.js"), "utf8") + fs.readFileSync(path.join(ROOT, "extras.js"), "utf8")), "no hard-coded share links");
  const grid = g.run("shareGrid()"); assert.match(grid, /BOFFIN GRID No\. \d+/); assert.ok(!/[A-Z][a-z]+ [A-Z][a-z]+/.test(grid.split("\n").slice(1, 4).join(" ")), "grid card shows squares only");
});

test("season stakes: points to the promotion line and to safety, read straight off the table", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const o = JSON.parse(g.run(`(() => { const rows = leagueTable(), st = stakes(rows), pos = myPos(rows); return JSON.stringify({ st, pos, me: rows[pos - 1].pts, fourth: rows[3].pts, sixteenth: rows[15].pts, seventeenth: rows[16].pts }); })()`));
  assert.ok(o.st.up && o.st.down);
  if (o.pos > 4) assert.ok(o.st.promo.includes(String(o.fourth - o.me)) || /out of reach|Level with/.test(o.st.promo), o.st.promo);
  if (o.pos <= 16) assert.ok(o.st.safe.includes(String(o.me - o.seventeenth)) || /goal difference/.test(o.st.safe), o.st.safe);
  assert.ok(g.run("stakesHTML(leagueTable())").includes("Promotion line"));
});

test("Final Day: the last three fixtures get the run-in treatment", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  g.run("S.week.pl = 15; render()"); assert.ok(!g.els.main.innerHTML.includes("fdtag"));
  g.run("S.week.pl = 16; render()"); assert.ok(g.els.main.innerHTML.includes("The run-in · 3 to play"));
  g.run("S.week.pl = 18; render()"); assert.ok(g.els.main.innerHTML.includes("Final Day"));
});

test("'around you' lines only state what the before/after tables show", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  for (let k = 0; k < 6; k++) {
    const r = JSON.parse(g.run(`(() => { const b = leagueTable(); startLeagueMatch(); M.my = [1,1,1,1,${k % 2}]; M.out = []; M.rev = []; M.xp = 0; M.tt = []; const w = S.week; const pre = JSON.parse(JSON.stringify(w)); fullTime(); const a = leagueTable(); return JSON.stringify({ lines: aroundYou(b, a), pa: myPos(a), pb: myPos(b), a: a.map(x => ({ n: x.name, p: x.pts })) }); })()`));
    for (const l of r.lines) { const m = l.match(/UP TO (\d+)|DOWN TO (\d+)/); if (m) assert.strictEqual(parseInt(m[1] || m[2]), r.pa, l); const gap = l.match(/GAP TO FOURTH: (\d+)/); if (gap) assert.strictEqual(+gap[1], r.a[3].p - r.a[r.pa - 1].p); }
    if (g.run("S.week.pl") === 0) break;   // season rolled over
  }
});

test("season end: promotion is a proper moment, with a share line", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  g.run("S.div = 2; S.week = { pl: 18, w: 18, d: 0, l: 0, gf: 70, ga: 5, pts: 54 }");
  playLeague(g, [1, 1, 1, 1, 1], 0);
  assert.strictEqual(g.run("S.div"), 3); assert.strictEqual(g.run("S.season"), 5);
  const html = g.els.main.innerHTML; assert.ok(html.includes("class=\"panel send up\"")); assert.ok(/Champions|Promoted/.test(html));
  const sh = g.run("shareSeason(S.note)"); assert.match(sh, /PROMOTED to League One/); assert.match(sh, /1st in League Two, 57 pts/);
  assert.strictEqual(g.run("S.stk.offer && S.stk.offer.tier"), "gold", "promotion earns a Gold Icon shot");
});

test("training XP halves after 20 chances a day, never reaches zero", () => {
  const g = load();
  const xs = JSON.parse(g.run("JSON.stringify(Array.from({ length: 30 }, () => trainXp(12)))"));
  assert.ok(xs.slice(0, 20).every(x => x === 12)); assert.ok(xs.slice(20).every(x => x === 6));
  assert.strictEqual(g.run("S.tr = { d: dayKey(), n: 50 }; trainXp(2)"), 1);
  assert.strictEqual(g.run("S.tr = { d: '2000-01-01', n: 50 }; trainXp(12)"), 12, "resets the next day");
});

test("abandoning a league match means the rematch is five new questions (no free look at the answers)", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const a = g.run("startLeagueMatch(); JSON.stringify(M.rounds)"); g.run("M.i = 1; abandonMatch()");
  const b = g.run("startLeagueMatch(); JSON.stringify(M.rounds)"); g.run("M.i = 1; abandonMatch()");
  const c = g.run("startLeagueMatch(); JSON.stringify(M.rounds)");
  assert.notStrictEqual(a, b); assert.notStrictEqual(b, c);
  g.run("M.my = [1,1,0,0,0]; M.out = []; M.rev = []; M.xp = 0; M.tt = []; fullTime()");
  assert.strictEqual(g.run("S.ab"), null, "cleared once the fixture is played");
});

test("Club Wars: top ten fans divided by ten, empty places count as nil", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  g.run(`Net.kind = "claude"; Net.uid = "me"; Net.rows = [].concat(
    Array.from({ length: 12 }, (_, k) => ({ id: "c" + k, n: "C" + k, c: "Chelsea", w: weekNo(), cg: 10 + k })),
    [{ id: "t1", n: "T1", c: "Tottenham", w: weekNo(), cg: 90 }],
    [{ id: "old", n: "Old", c: "Tottenham", w: weekNo() - 1, cg: 500 }]); S.cw = { wk: weekNo(), gf: 7, pts: 0 };`);
  const t = JSON.parse(g.run("JSON.stringify(warsTable())")), ch = t.find(r => r.c === "Chelsea"), sp = t.find(r => r.c === "Tottenham"), ar = t.find(r => r.c === "Arsenal");
  assert.strictEqual(ch.total, 21 + 20 + 19 + 18 + 17 + 16 + 15 + 14 + 13 + 12); assert.strictEqual(ch.filled, 10); assert.strictEqual(ch.fans, 12); assert.strictEqual(ch.score, 16.5);
  assert.strictEqual(sp.score, 9, "one hero alone scores 90/10, last week's goals don't count");
  assert.strictEqual(ar.score, .7); assert.ok(ar.me);
  assert.deepStrictEqual(t.map(r => r.c), ["Chelsea", "Tottenham", "Arsenal"]);
  const html = g.run("warsHTML()"); assert.ok(html.includes("1 of 10")); assert.ok(html.includes("500 most recent"));
});

test("themes add XP only, never change which questions a seed produces", () => {
  const a = load(), b = load();
  b.run("THEME_ROTA.length = 0; THEME_ROTA.push('boot')");
  for (let k = 0; k < 8; k++) { const call = `JSON.stringify(makeMatch(QV + "th-${k}", 1))`; assert.strictEqual(a.run(call), b.run(call)); }
  const days = JSON.parse(a.run("JSON.stringify(Array.from({ length: 60 }, (_, k) => themeOfDay('2026-12-' + String(1 + k % 28).padStart(2, '0') + k).id))"));
  assert.ok(new Set(days).size >= 6, "themes rotate"); assert.ok(days.every(id => a.run("THEME_ROTA").includes(id)));
  assert.strictEqual(a.run("themeOfDay('2026-12-25').id"), a.run("themeOfDay('2026-12-25').id"), "same day, same theme");
  const hit = a.run(`(() => { const sp = { type: "hl", pairs: [[0, 1]] }; THEME_ROTA.length = 0; THEME_ROTA.push("deadline"); return themeHit(sp) && !themeHit({ type: "season", i: 0, tol: 1 }); })()`);
  assert.strictEqual(hit, true);
});

test("question log: one anonymous record per match, nothing that identifies the player", async () => {
  const sent = []; const g = load({ localStorage: { [KEY]: v1 }, globals: { SENT: sent } });
  g.run('Net.kind = "fake"; Net.b = Object.assign({}, Net.b, { logMatch: async r => { SENT.push(JSON.parse(JSON.stringify(r))); } });');
  playLeague(g, [1, 0, 1, 1, 0], 0); await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(sent.length, 1); const r = sent[0];
  assert.deepStrictEqual(Object.keys(r).sort(), ["d", "q", "v"]); assert.strictEqual(r.q.length, 5);
  r.q.forEach(x => { assert.strictEqual(x.length, 5); assert.ok(typeof x[0] === "string" && x[0].length <= 80); assert.ok([0, 1].includes(x[3])); });
  const blob = JSON.stringify(r); for (const s of ["Big Dave", "11111111", "Arsenal fan"]) assert.ok(!blob.includes(s));
  assert.strictEqual(g.run("JSON.parse(localStorage.getItem('boffin-qlog')).length"), 5);
});

test("stickers: offers, the attempt, winning, losing and duplicates", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  assert.ok(g.run("STK.clubs.length") >= 60); assert.strictEqual(g.run("STK.by['Arsenal'].length"), 18);
  // every page slot is a real player with full clue data
  assert.strictEqual(g.run("Object.values(STK.all).filter(s => s.i === undefined || !stkEligible(s.i)).length"), 0);
  // nothing earned: no offer. One deep cut or four goals: paper. Five from five: foil.
  assert.strictEqual(g.run("S.stk.free = true; stkAfterMatch({ mode: 'league', goals: 2, deep: 0, won: false }); S.stk.offer"), null);
  assert.strictEqual(g.run("stkAfterMatch({ mode: 'league', goals: 3, deep: 1, won: true }); S.stk.offer.tier"), "paper");
  assert.strictEqual(g.run("stkAfterMatch({ mode: 'league', goals: 5, perfect: true, won: true }); S.stk.offer.tier"), "foil", "a better offer replaces a waiting one");
  assert.strictEqual(g.run("stkAfterMatch({ mode: 'league', goals: 4, won: true }); S.stk.offer.tier"), "foil", "a worse one never does");
  // onboarding freebie: first win only, a household name from your club
  assert.strictEqual(g.run("S.stk.offer = null; S.stk.free = false; stkAfterMatch({ mode: 'league', goals: 2, won: true }); S.stk.offer.free"), true);
  g.run("stkGo()"); assert.strictEqual(g.run("STK.all[S.stk.offer.key].club"), "Arsenal"); assert.strictEqual(g.run("STK.all[S.stk.offer.key].tier"), "gold");
  // win it: free shot plays by paper rules (3 clues, 2 tries)
  g.run("stkStart()"); assert.strictEqual(g.run("STKA.shown"), 3); assert.strictEqual(g.run("STKA.tries"), 2);
  const key = g.run("S.stk.offer.key"), xp0 = g.run("S.xp");
  g.run("stkPick(STKA.slot.i === 0 ? 1 : 0)"); assert.strictEqual(g.run("STKA.tries"), 1, "a wrong guess costs a try");
  g.run("stkPick(STKA.slot.i)"); assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(key)}]`), 1); assert.strictEqual(g.run("S.stk.offer"), null);
  assert.ok(g.run("S.xp") > xp0); assert.ok(g.els.main.innerHTML.includes("Stuck in"));
  // lose one: gone, and the answer is not revealed
  g.run("S.stk.offer = { tier: 'foil', why: 'x' }; stkGo(); stkStart();"); assert.strictEqual(g.run("STKA.tries"), 1); assert.strictEqual(g.run("STKA.shown"), 2);
  const who = g.run("PL[STKA.slot.i][0]"); g.run("stkPick(STKA.slot.i === 0 ? 1 : 0)");
  assert.strictEqual(g.run("S.stk.offer"), null); assert.ok(g.els.main.innerHTML.includes("Not him")); assert.ok(!g.els.main.innerHTML.includes(who), "never shows who it was");
  // duplicates: three make a token, and a token picks the next shot's player
  g.run(`for (let k = 0; k < 3; k++) { S.stk.offer = { tier: 'gold', free: true }; S.stk.offer.key = ${JSON.stringify(key)}; stkStart(); stkPick(STKA.slot.i); }`);
  assert.strictEqual(g.run(`S.stk.got[${JSON.stringify(key)}]`), 4); assert.strictEqual(g.run("S.stk.tok"), 1);
  const want = g.run("STK.by['Chelsea'].find(s => s.tier === 'paper').key");
  g.run(`S.stk.pick = ${JSON.stringify(want)}; S.stk.offer = { tier: 'paper' }; stkGo();`);
  assert.strictEqual(g.run("S.stk.offer.key"), want); assert.strictEqual(g.run("S.stk.tok"), 0);
  // walking away mid-attempt (or closing the app) counts as a miss
  g.run("stkStart(); M = null; STKA = null; view = 'home'; render()"); assert.strictEqual(g.run("S.stk.offer"), null);
  // Names log untouched by sticker data; sticker screen renders
  g.run("albumTab = 'stk'; view = 'album'; render()"); assert.ok(g.els.main.innerHTML.includes("stkpage")); assert.ok(g.els.main.innerHTML.includes("Got "));
});

test("sticker choice: about half from your own club, chase list triples the odds", () => {
  const g = load({ localStorage: { [KEY]: v1 } });
  const r = JSON.parse(g.run(`(() => { const rnd = rngOf(99); let own = 0, chased = 0, n = 3000; const ch = STK.by["Chelsea"].filter(s => s.tier === "paper")[0].key; S.stk.chase = [ch]; S.div = 7;
    for (let k = 0; k < n; k++) { const t = stkTarget({ tier: "paper" }, rnd); if (t.club === S.club) own++; if (t.key === ch) chased++; }
    return JSON.stringify({ own: own / n, chased, perSlot: n * .5 / STK.clubs.length / 10 }); })()`));
  assert.ok(r.own > .45 && r.own < .6, "own club share " + r.own);
  assert.ok(r.chased > r.perSlot * 1.8, "chased " + r.chased + " vs ~" + r.perSlot.toFixed(1) + " for an unchased slot");
});

test("service worker: precache list complete and VERSION matches the files", () => {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "bump-sw.js"), "--check"], { stdio: "pipe" });
});

test("sticker facts come from the data: titles, top tens, fees, line-ups", () => {
  const g = load();
  const f = JSON.parse(g.run(`(() => { const i = PL.findIndex(p => p[0] === "Cristiano Ronaldo"); const f = stkFacts(i); return JSON.stringify({ titles: f.titles.map(t => t.lg + " " + t.y + " " + t.club), top1: f.tops.filter(t => t.r === 1).length, fee: f.fee, bigN: f.bigN, hi: stkHighlight(i, clubIdx("Manchester United")) }); })()`));
  // every title listed must be a season where that club topped that league table, with him on the books
  const ok = JSON.parse(g.run(`(() => { const i = PL.findIndex(p => p[0] === "Cristiano Ronaldo"), f = stkFacts(i), ss = PL[i][6]; return JSON.stringify(f.titles.every(t => { const T = BD.tables.find(x => x[0] === t.lg && x[1] === t.y); let on = false; for (let k = 0; k < ss.length; k += 3) if (CLUB[ss[k]] === t.club && ss[k + 1] <= t.y - SQ0 && t.y - SQ0 <= ss[k + 2]) on = true; return T && T[3][0][0] === t.club && on; })); })()`));
  assert.strictEqual(ok, true);
  assert.ok(f.titles.length >= 2); assert.ok(f.top1 >= 1); assert.strictEqual(f.fee.to, "Juventus"); assert.ok(f.bigN > 0);
  assert.match(f.hi, /top scorer/);
});

test("sticker front only claims a title won with that page's club", () => {
  const g = load();
  const r = JSON.parse(g.run(`(() => { const out = []; Object.values(STK.all).forEach(s => { if (s.i === undefined) return; const h = stkHighlight(s.i, s.c), m = h.match(/title squad ([0-9][0-9])[/]([0-9][0-9])$/); if (m) { const y = 2000 + +m[1]; if (!stkFacts(s.i).titles.some(t => t.y === y && t.club === s.club)) out.push(s.key + " " + h); } }); return JSON.stringify(out); })()`));
  assert.deepStrictEqual(r, []);
});

test("sticker collector details: condition, shiny, and merging two devices", () => {
  const g = load({ localStorage: { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) } });
  const key = g.run("STK.by['Arsenal'][0].key");
  g.run(`Math.random = () => 0.01; S.stk.offer = { tier: 'gold', free: true }; S.stk.offer.key = ${JSON.stringify(key)}; stkStart(); stkPick(STKA.slot.i);`);
  const m = JSON.parse(g.run(`JSON.stringify(S.stk.meta[${JSON.stringify(key)}])`));
  assert.strictEqual(m.c, 3, "named first go on the starting clues = Mint"); assert.strictEqual(m.sh, 1, "shiny roll"); assert.ok(m.d);
  assert.ok(g.els.main.innerHTML.includes("It's a shiny"));
  const merged = JSON.parse(g.run(`JSON.stringify(mergeMeta({ a: { d: "2026-11-10", c: 1 }, b: { d: "2026-11-12", c: 2 } }, { a: { d: "2026-11-11", c: 3, sh: 1 } }))`));
  assert.deepStrictEqual(merged.a, { d: "2026-11-10", c: 3, sh: 1 }); assert.strictEqual(merged.b.c, 2);
});

test("question screens: title card and backdrop drawing for every type, chance strip in matches", () => {
  const g = load({ localStorage: { "boffin-matchday-v1": JSON.stringify({ v: 2, made: true, name: "T", club: "Arsenal", salt: 1 }) } });
  for (const t of JSON.parse(g.run("JSON.stringify(Object.keys(TYPES))"))) {
    g.run(`startTraining("${t}")`); assert.ok(g.els.main.innerHTML.includes('class="qhero"'), t); assert.ok(g.run("!!QART." + t), "art for " + t);
    g.run("takeChance()"); assert.ok(g.els.main.innerHTML.includes('class="qart"'), t); g.run("M.live = false");
  }
  g.run("startLeagueMatch()"); assert.ok(g.els.main.innerHTML.includes('class="cstrip"'));
});
