// Headless browser checks. Starts its own dev server, then drives the real game in Chromium:
//   1. no page errors on load, at three phone sizes
//   2. the no-scroll pass (tests/browser/qa.js) on every question type, the grid sheet, sticker attempts and sheets
//   3. a whole league match and a whole cup tie, kick-off to full time, scoring some and missing some
//   4. every main screen renders without an error
// Run from the project root:   node tests/browser/run.js            (add --shots <dir> to save screenshots)
// Needs Playwright (pre-installed in Claude cloud sessions; elsewhere: npm i playwright && npx playwright install chromium).
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const shotsAt = process.argv.indexOf("--shots"), SHOTS = shotsAt > 0 ? path.resolve(process.argv[shotsAt + 1]) : "";
const SIZES = [[390, 844], [375, 667], [375, 400]];
const SAVE = { v: 2, made: true, name: "Big Dave", club: "Arsenal", xp: 2200, div: 3, season: 2, salt: 77, form: ["W", "D", "W", "L", "W"], week: { pl: 16, w: 9, d: 3, l: 4, gf: 40, ga: 30, pts: 30 } };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});

// Answer the live chance from inside the page: score when `score` is true (using the game's own data), otherwise run the clock out.
const PLAY = `async (score) => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const spec = curSpec(), run = M.run, t = spec.type;
  if (!score) { M.timeout = true; endChance(); return "timed out"; }
  if (t === "cell") run.onPick(validSetX(spec.a, spec.b)[0]);
  else if (t === "mates") { const [a, b] = spec.ab || BD.pairs[spec.i]; run.onPick(ALLIDX.find(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b))); }
  else if (t === "top") BD.lists[spec.i][3].slice(0, spec.target).forEach(it => run.onPick(it[0]));
  else if (t === "squad") squadOf(spec.c, spec.y).slice(0, spec.target).forEach(i => run.onPick(i));
  else if (t === "career") run.onPick(spec.p);
  else if (t === "xi") spec.blanks.slice(0, spec.target).forEach(k => run.onPick(-1, BD.xi[spec.i][6][k][0]));
  else if (t === "season") { run.onInput(BD.tables[spec.i][1]); run.onTap("lock"); }
  else if (t === "six" && spec.x) { if (spec.need === 1) run.onPick(spec.v[0]); else { run.onPick(spec.v[0][0]); run.onPick(spec.v[0][1][0]); } }
  else if (t === "six") { const nb = new Set(tmOf(spec.b)), mid = tmOf(spec.a).find(i => nb.has(i)); if (mid !== undefined) run.onPick(mid); else { M.timeout = true; endChance(); } }
  else if (t === "exact") { for (let g = 0; g < 4 && M.live; g++) { const x = SCORE_BY[spec.qs[run.k]]; run.h = x.hg; run.a = x.ag; run.onTap("lock"); await wait(1650); } }
  else if (t === "gboot") spec.top.slice(0, spec.target).forEach(t => run.onPick(t[1]));
  else if (t === "pin") { for (let g = 0; g < 3 && M.live; g++) { const gd = GROUNDS[spec.qs[run.k]]; run.pin = [gd.la, gd.ln]; run.onTap("lock"); await wait(2700); } }   // drop the pin exactly on each ground
  else if (t === "order") { for (let g = 0; g < 4 && M.live; g++) { const st = spec.sets[run.k]; const vals = st.v === "dtab" ? st.it.map(x => 100 - x.pos) : st.v === "fee" ? st.h.map(h => BD.hl[h][4]) : st.v === "tab" ? st.o.map(k => 4 - k) : st.o.map(k => BD.lists[st.li][3][k][1]); vals.map((v, j) => j).sort((x, y) => vals[y] - vals[x]).forEach(j => run.onTap(String(j))); await wait(1750); } }
  else {   // tap rounds: find the right button each time from the round's own data
    for (let g = 0; g < 8 && M.live; g++) {
      let v = 0;
      if (t === "hl") { const [a, b] = spec.pairs[run.k]; v = BD.hl[a][4] >= BD.hl[b][4] ? 0 : 1; }
      else if (t === "race") { const [li, a, b] = spec.pairs[run.k], it = BD.lists[li][3]; v = it[a][1] > it[b][1] ? 0 : 1; }
      else if (t === "odd") v = spec.sets[run.k].x;
      else if (t === "champ") { const q = spec.qs[run.k]; v = q.c !== undefined ? BD.tables[q.t][3].findIndex(x => x[0] === CLUB[q.c]) : q.o.indexOf(q.p); }
      else if (t === "quiz") v = spec.qs[run.k].o.indexOf(0);
      else if (t === "pals") v = spec.pairs[run.k][2];
      else if (t === "fake") v = spec.sets[run.k].at;
      else if (t === "buy") { const q = spec.qs[run.k]; v = spec.x ? q.o.indexOf(q.a) : q.o.indexOf(BD.hl[q.h][2]); }
      else if (t === "row") { const q = spec.qs[run.k]; v = q.o.indexOf(rowT(q)[3][q.k][0]); }
      else if (t === "flags") { const q = spec.qs[run.k]; v = q.o.indexOf(spec.x ? q.c : BD.xi[q.i][0]); }
      run.onTap(String(v)); await wait(1400);
    }
  }
  return t;
}`;

// a level-up or sticker reward from the match before can sit over the next kick-off button: clear it, as a player would by tapping it away
const clearOver = page => page.evaluate("document.getElementById('over').innerHTML = ''");
async function playMatch(page, start, plan) {
  await clearOver(page);
  await page.evaluate(start);
  const log = [];
  for (let k = 0; k < 12; k++) {
    if (!(await page.evaluate("!!M && view === 'match'"))) break;
    await page.click("[data-act=take]");
    await page.waitForTimeout(80);
    log.push(await page.evaluate(`(${PLAY})(${plan[k % plan.length] ? "true" : "false"})`));
    try { await page.waitForSelector("[data-act=cont]", { timeout: 5000 }); }
    catch (e) { throw new Error("no verdict after " + (await page.evaluate("curSpec() && curSpec().type")) + " (chance " + (k + 1) + ")"); }
    await page.click("[data-act=cont]");
    await page.waitForTimeout(60);
  }
  return log;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = "http://localhost:" + server.address().port + "/?offline" + (process.env.OLDDB ? "&olddb" : ""); // OLDDB=1 runs the whole suite on the old question bank (the rollback path)
  const browser = await chromium.launch();
  const fails = [], note = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails.push(what); };
  for (const [w, h] of SIZES) {
    console.log(`\n${w}x${h}`);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true });
    const errs = [];
    page.on("pageerror", e => errs.push(String(e)));
    await page.goto(base);
    await page.evaluate(s => localStorage.setItem("boffin-matchday-v1", JSON.stringify(s)), SAVE);
    await page.reload();
    await page.waitForFunction("typeof render === 'function' && !!document.getElementById('tabs').innerHTML");
    const shot = async name => { if (SHOTS && h === 844) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); } };
    note(!errs.length, "loads with no errors" + (errs.length ? ": " + errs[0] : ""));

    for (const v of ["home", "league", "grid", "album"]) {
      await page.evaluate(`M = null; view = ${JSON.stringify(v)}; render();`);
      await page.waitForTimeout(350);
      await shot("screen-" + v);
    }
    note(!errs.length, "main screens render" + (errs.length ? ": " + errs[errs.length - 1] : ""));

    await page.evaluate("import('/tests/browser/qa.js')");
    await page.waitForFunction("!!window.QA");
    const qa = await page.evaluate("QA.run()");
    note(!qa.bad.length, `no-scroll pass, ${qa.results.length} screens` + (qa.bad.length ? ": " + qa.bad.map(b => b.name + " " + (b.error || "+" + b.overflow + "px")).join("; ") : ""));

    // the database layouts again, harder: 25 random questions of each kind (longest names, most clubs, biggest tables turn up eventually)
    const stress = await page.evaluate(`(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)), bad = [];
      await DBX.warm(tierOf(S.div)); DBX.on = true;
      for (const t of ["exact", "row", "order", "pals", "six", "buy", "fake", "flags", "cell", "gboot"]) for (let k = 0; k < 25; k++) {
        M = null; view = "home"; render(); startTraining(t); document.querySelector("[data-act=take]").click(); await wait(40);
        const q = document.getElementById("q"); if (q) { q.value = "ha"; q.dispatchEvent(new Event("input", { bubbles: true })); await wait(30); }
        const o = Math.max(0, document.scrollingElement.scrollHeight - innerHeight); if (o > 2) bad.push(t + " +" + o);
        cancelAnimationFrame(raf); if (M) M.live = false; }
      return bad; })()`);
    note(!stress.length, "database layouts: 250 random questions, no scrolling" + (stress.length ? ": " + [...new Set(stress)].slice(0, 6).join(", ") : ""));

    if (h === 844) {
      // a few question screens for the gallery
      for (const t of ["cell", "top", "xi", "hl", "quiz"]) {
        await page.evaluate(`M = null; view = "home"; render(); startTraining(${JSON.stringify(t)});`);
        await page.waitForTimeout(250); if (t === "cell") await shot("chance-cover");
        await page.click("[data-act=take]"); await page.waitForTimeout(300); await shot("question-" + t);
        await page.evaluate("cancelAnimationFrame(raf); if (M) M.live = false; M = null; view = 'home'; render();");
      }
    }

    // league match: score three, miss two
    await page.evaluate(s => { S = hydrate(s); save(); view = "home"; render(); }, SAVE);
    const before = await page.evaluate("S.week.pl");
    let log = await playMatch(page, "startLeagueMatch()", [1, 0, 1, 1, 0]);
    await page.waitForTimeout(400);
    const after = await page.evaluate("({ pl: S.week.pl, view, pts: S.week.pts })");
    note(after.view === "ft" && after.pl === before + 1 && log.length === 5, `league match plays to full time (${log.join(", ")})`);
    await page.waitForTimeout(2500); await shot("full-time");
    note(!errs.length, "no errors during the league match" + (errs.length ? ": " + errs[errs.length - 1] : ""));

    // a goal and a miss verdict for the gallery (screenshots only: it adds nothing to the checks and was the flaky part)
    if (SHOTS && h === 844) {
      await clearOver(page); await page.evaluate("startLeagueMatch()"); await page.click("[data-act=take]"); await page.evaluate(`(${PLAY})(true)`); await page.waitForTimeout(2600); await shot("verdict-goal");
      await page.click("[data-act=cont]"); await page.click("[data-act=take]"); await page.evaluate(`(${PLAY})(false)`); await page.waitForTimeout(2600); await shot("verdict-miss");
      await page.evaluate("quitMatch()");
    }

    // cup tie: score the lot (penalties can stretch it, so allow up to ten chances)
    log = await playMatch(page, "startCupMatch()", [1]);
    await page.waitForTimeout(300);
    note((await page.evaluate("view")) === "ft", `cup tie plays to full time (${log.length} chances)`);
    note(!errs.length, "no errors during the cup tie" + (errs.length ? ": " + errs[errs.length - 1] : ""));

    // first run: a brand-new player gets the sign-on sheet
    await page.evaluate("localStorage.clear()"); await page.reload();
    await page.waitForFunction("typeof render === 'function'"); await page.waitForTimeout(300);
    note(await page.evaluate("!!document.querySelector('#over .sheet')"), "new player sees the sign-on sheet");
    await shot("first-run");
    await page.close();
  }
  await browser.close(); server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll browser checks passed");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
