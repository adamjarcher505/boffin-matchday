"use strict";
/* ============ chain.js (14/11/2026): Chain Reaction, the daily 30-second team-mate chain ============
   Everyone gets the same starting player each day. Name someone who played with him, then someone who played with
   that player, and so on. 30 seconds, one go a day, nobody twice. Uses the season squad records (2010 on) via tmOf()
   and overlaps(), so "team-mates" means the same as in The Link and Six Degrees. */
const CHAIN_SECS = 30;
const chainNo = () => Math.max(1, Math.round((new Date(dayKey() + "T12:00:00") - new Date("2026-11-14T12:00:00")) / 864e5) + 1);
function chainStart(day) {
  const pool = SSP.filter(i => fame(i) >= 5.4 && isPLp(i));
  for (let t = 0; t < 30; t++) {
    const i = pickR(pool, rngOf(hash("chain" + day + "-" + t)));
    if (tmOf(i).length >= 40) return i;
  }
  return pool[0];
}
const chainState = () => {
  const k = dayKey();
  if (!S.chain || !S.chain[k]) S.chain = { [k]: { t0: 0, c: [], done: false, xp: 0 } };
  return S.chain[k];
};
let CHAINRAF = 0;
const chainLeft = c => Math.max(0, CHAIN_SECS * 1000 - (Date.now() - c.t0));
const chainIdx = c => c.c.map(k => KEY2IDX[k]).filter(i => i !== undefined);
function chainFinish() {
  const c = chainState();
  if (c.done) return;
  cancelAnimationFrame(CHAINRAF);
  c.done = true;
  const n = c.c.length;
  c.xp = Math.min(TUNING.chainXpCap, n * TUNING.chainXp);
  if (c.xp) addXp(c.xp);
  S.st.chain = Math.max(S.st.chain || 0, n);
  sfx.whistle();
  save(true);
  if (view === "chain") renderChain();
}
function chainPick(i) {
  const c = chainState();
  if (!c.t0 || c.done || i < 0) return;
  if (!chainLeft(c)) return chainFinish();
  const day = dayKey(),
    trail = [chainStart(day)].concat(chainIdx(c)),
    cur = trail[trail.length - 1];
  if (trail.includes(i)) {
    msg(PL[i][0] + "'s already in the chain.", "");
    return;
  }
  if (!PL[i][6].length) {
    msg("No squad records for " + PL[i][0] + " from 2010 on.", "");
    return;
  }
  if (!overlaps(cur, i)) {
    msg(PL[i][0] + " never played with " + PL[cur][0] + ".", "bad");
    sfx.no();
    buzz(60);
    return;
  }
  c.c.push(pkey(i));
  addAlbum(i);
  sfx.tick();
  buzz(25);
  save();
  chainPaint();
  msg(PL[i][0] + ". Keep it going.", "good");
}
function chainTick() {
  const c = chainState();
  if (view !== "chain" || !c.t0 || c.done) return;
  const left = chainLeft(c),
    el = $("chclk");
  if (el) {
    el.textContent = Math.ceil(left / 1000);
    el.classList.toggle("low", left < 5000);
  }
  if (left <= 0) return chainFinish();
  CHAINRAF = requestAnimationFrame(chainTick);
}
/* the live part only (current man, count, trail), so typing isn't interrupted */
function chainPaint() {
  const c = chainState(),
    b = $("chbody");
  if (!b) return;
  const trail = [chainStart(dayKey())].concat(chainIdx(c)),
    cur = trail[trail.length - 1];
  b.innerHTML = `<div class="chcur"><span>Name a team-mate of</span><b>${esc(PL[cur][0])}</b></div><div class="chlow"><div class="chn"><span>Links</span><b>${c.c.length}</b><span>Best ${S.st.chain || 0}</span></div><div class="chtrail">${trail
    .slice(-4)
    .map((i, k) => (k ? "<i>›</i>" : "") + esc(PL[i][0]))
    .join("")}</div></div>`;
}
function renderChain() {
  const c = chainState(),
    app = document.getElementById("app"),
    start = chainStart(dayKey());
  if (c.t0 && !c.done && !chainLeft(c)) {
    chainFinish();
    return;
  }
  const live = c.t0 && !c.done;
  app.classList.toggle("focus", !!live);
  app.classList.toggle("q", !!live);
  cancelAnimationFrame(CHAINRAF);
  if (live) {
    $("main").innerHTML = `<div class="chb chlive"><div class="chhd"><div><h3>Chain Reaction</h3><span class="eyebrow">No. ${chainNo()} · same start for everyone</span></div><div class="chclock" id="chclk">${Math.ceil(chainLeft(c) / 1000)}</div></div>
    <div id="chbody" class="chb"></div>
    <div class="entry"><input id="q" type="text" placeholder="Type a team-mate's name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><button type="button" class="clr" id="clr" data-act="clrq" aria-label="Clear" hidden>×</button><div class="sug" id="sug" hidden></div></div>
    <p class="msg" id="msg"></p></div>`;
    chainPaint();
    const q = $("q");
    if (q)
      try {
        q.focus({ preventScroll: true });
      } catch (e) {}
    CHAINRAF = requestAnimationFrame(chainTick);
    window.scrollTo(0, 0);
    return;
  }
  if (!c.done) {
    $("main").innerHTML = `<div class="hd"><h2>Chain Reaction No. ${chainNo()}</h2><span class="eyebrow">One go a day</span></div>
    <div class="panel pad chb"><div class="chcur"><span>Today's start</span><b>${esc(PL[start][0])}</b></div>
    <p class="note">Name someone who played with him. Then someone who played with <i>that</i> player. Keep the chain going for <b>${CHAIN_SECS} seconds</b>. Nobody twice. Wrong names cost you nothing but time.</p>
    <p class="note">Team-mates means same club, same season, 2010 onwards, top-five leagues.</p>
    <button class="btn" data-act="chaingo">Start the clock</button></div>`;
    window.scrollTo(0, 0);
    return;
  }
  const trail = [start].concat(chainIdx(c)),
    n = c.c.length;
  $("main").innerHTML = `<div class="hd"><h2>Chain Reaction No. ${chainNo()}</h2><span class="eyebrow">Finished</span></div>
  <div class="panel pad gscore"><div class="gsc"><span class="eyebrow">Links in ${CHAIN_SECS} seconds</span><b class="led">${n}</b><span class="note">${n >= 12 ? "Absolute anorak. Frightening." : n >= 8 ? "Proper effort. Knows ball." : n >= 4 ? "Decent. Room to grow." : n ? "Slow start. Tomorrow's another day." : "Not one. The keyboard's still warm."}</span></div><div class="statline"><span>Best <b>${S.st.chain || n}</b></span><span><b>+${c.xp}</b> XP</span></div></div>
  <div class="panel pad"><span class="eyebrow">Your chain</span><div class="chtrail">${trail.map((i, k) => (k ? "<i>›</i>" : "") + esc(PL[i][0])).join("")}</div></div>
  <div class="row"><button class="btn line" data-act="sharechain">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(shareChain())}" target="_blank" rel="noopener">WhatsApp</a></div><p class="note">A new starting player lands at midnight.</p>`;
  window.scrollTo(0, 0);
}
function chainGo() {
  const c = chainState();
  if (c.t0) return renderChain();
  c.t0 = Date.now(); // the go counts from here, even if they leave
  save();
  sfx.whistle();
  renderChain();
}
function shareChain() {
  const c = chainState();
  return `1X2 CHAIN No. ${chainNo()}\n🔗 ${c.c.length} ${c.c.length === 1 ? "link" : "links"} in ${CHAIN_SECS} seconds\nStarted from ${PL[chainStart(dayKey())][0]}\n${shareTail()}`;
}
function chainTile() {
  const c = S.chain && S.chain[dayKey()],
    done = c && c.done;
  return `<button class="panel tile2 chaint" data-act="go" data-v="chain"><span class="eyebrow">Chain Reaction · No. ${chainNo()}</span><span class="sub">${
    done ? "Done for today. New start at midnight." : "Team-mate chain against a 30-second clock."
  }</span><span class="more">${done ? "See it ›" : "Play ›"}</span><b class="big">${done ? c.c.length : "30"}</b></button>`;
}
