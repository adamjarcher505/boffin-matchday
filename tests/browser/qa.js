// In-page QA: load with  await import("/tests/browser/qa.js")  then  await QA.run()  from the browser console
// (or the in-app browser's JS tool). Drives the real game at the current viewport size and reports any screen
// that scrolls. Dev-only: not precached, not linked from the game.
const wait = ms => new Promise(r => setTimeout(r, ms));
const scrolls = () => { const el = document.scrollingElement; return Math.max(0, el.scrollHeight - innerHeight); };
// sheets: does the focused field or its suggestions go off screen, or does the sheet need scrolling to reach its fields?
const sheetScrolls = () => { const b = document.querySelector("#over .box"); if (!b) return 0; let o = getComputedStyle(b).overflowY === "visible" ? 0 : Math.max(0, b.scrollHeight - b.clientHeight); const f = b.querySelector("input, select"), s = b.querySelector(".sug:not([hidden])"); [f, s].forEach(el => { if (el) { const r = el.getBoundingClientRect(); o = Math.max(o, r.bottom - innerHeight); } }); return Math.max(0, Math.round(o)); };
async function screen(name, fn, sheet) {
  try { await fn(); await wait(120); return { name, overflow: sheet ? sheetScrolls() : scrolls(), ok: true }; }
  catch (e) { return { name, error: String(e && e.message || e), ok: false }; }
}
window.QA = {
  async run(opts = {}) {
    const out = { size: innerWidth + "x" + innerHeight, results: [] };
    localStorage.setItem("boffin-matchday-v1", JSON.stringify({ v: 2, made: true, name: "Big Dave", club: "Arsenal", xp: 2200, div: 3, season: 2, salt: 77, week: { pl: 16, w: 9, d: 3, l: 4, gf: 40, ga: 30, pts: 30 } }));
    S = hydrate(JSON.parse(localStorage.getItem("boffin-matchday-v1")));
    const R = out.results;
    // every question type, typed and tapped, on the live question screen
    for (const t of Object.keys(TYPES)) {
      R.push(await screen("question: " + TYPES[t].n, async () => { M = null; view = "home"; render(); startTraining(t); document.querySelector("[data-act=take]").click(); await wait(80); const q = document.getElementById("q"); if (q) { q.value = "ha"; q.dispatchEvent(new Event("input", { bubbles: true })); } }));
      cancelAnimationFrame(raf); if (M) M.live = false;
    }
    if (innerWidth >= 1024) for (const k of Object.keys(LONG)) { R.push(await screen("extra time: " + LONG[k].n, async () => { M = null; startLong(k); document.querySelector("[data-act=take]").click(); })); cancelAnimationFrame(raf); if (M) M.live = false; }
    // grid sheet
    R.push(await screen("grid sheet", async () => { M = null; view = "grid"; render(); const c = document.querySelector("[data-act=cell]"); if (c) c.click(); await wait(60); const q = document.getElementById("q"); if (q) { q.value = "sa"; q.dispatchEvent(new Event("input", { bubbles: true })); } }, true));
    document.getElementById("over").innerHTML = "";
    // sticker attempt: every tier
    for (const tier of ["paper", "foil", "gold"]) {
      R.push(await screen("sticker attempt: " + tier, async () => { M = null; S.stk.offer = { tier, why: "QA" }; S.stk.offer.key = STK.by[S.club].find(s => s.tier === tier).key; stkGo(); stkStart(); await wait(60); const q = document.getElementById("q"); if (q) { q.value = "he"; q.dispatchEvent(new Event("input", { bubbles: true })); } }));
      stkStop(); S.stk.offer = null;
    }
    // sheets
    R.push(await screen("profile sheet", async () => { M = null; view = "home"; render(); profileSheet(false); }, true));
    R.push(await screen("sign-on sheet (first time)", async () => { profileSheet(true); }, true));
    document.getElementById("over").innerHTML = "";
    // whole-page screens may scroll (they're lists); report their height for the record
    if (opts.pages) for (const v of ["home", "league", "album", "grid"]) R.push(Object.assign(await screen("page: " + v, async () => { M = null; view = v; render(); }), { pageOk: true }));
    M = null; view = "home"; render(); window.scrollTo(0, 0);
    out.bad = R.filter(r => !r.ok || (!r.pageOk && r.overflow > 2));
    return out;
  }
};
