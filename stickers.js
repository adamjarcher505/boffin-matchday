/* ============ stickers.js: the sticker album ============
   Nothing is handed out. A match can earn one shot at a mystery sticker; you get him by naming him from clues.
   Stickers live in S.stk (the "Names" log, S.album, is separate and untouched). All numbers are STICKER_RULES in app.js.
   Pages are frozen in sticker-pages.js so a page never reshuffles. */
const SR = STICKER_RULES;
const TIER_N = { paper: "Paper", foil: "Foil", gold: "Gold Icon" }, TIER_RANK = { paper: 0, foil: 1, gold: 2 };
/* A sourced list of club colours can go here later ({ "Arsenal": "#hex" }); until then the band takes the sticker tier's colour.
   Real club colours are facts and this project doesn't write those from memory. */
const CLUB_COLOURS = {};

/* a player can only be offered if every clue has data behind it: nationality, birth year and at least one club with a year */
const stkEligible = i => PL[i][1] >= 0 && PL[i][3] > 0 && PL[i][5].length >= 2;   // a one-club man still has a club trail to show
function stkSpells(i) { const a = PL[i][5], sp = []; for (let k = 0; k < a.length; k += 2) sp.push([a[k], 1990 + a[k + 1], k]); return sp.sort((x, y) => x[1] - y[1] || x[2] - y[2]); }
function stkYears(i, c) { const sp = stkSpells(i); let first = -1, last = -1; sp.forEach((x, k) => { if (x[0] === c) { if (first < 0) first = k; last = k; } }); if (first < 0) return null; const nxt = sp[last + 1]; return { from: sp[first][1], to: nxt ? nxt[1] : null, n: sp.filter(x => x[0] === c).length }; }
/* years at a club (used for page ranking only, never shown: the data's club trails miss some moves, so a departure year can be wrong).
   First arrival to the next recorded club. Still "at" their last club with no end date: count to 2026, or to age 36 for anyone that old (retired). */
const stkTenure = (i, c) => { const y = stkYears(i, c); if (!y) return 0; const end = y.to !== null ? y.to : Math.min(2026, PL[i][3] > 0 ? 1900 + PL[i][3] + 36 : 2026); return Math.max(0, Math.min(8, end - y.from)); };
/* page order: fame, plus a quarter point per year at the club (capped at 8), so club legends beat one-season stars */
const stkRank = (i, c) => fame(i) + .25 * stkTenure(i, c);
const stkShortStay = (i, c) => { const y = stkYears(i, c); return !!y && y.n === 1 && y.to !== null && y.to - y.from <= 1; };   // one stay of a year or less: a loan, not a club legend

const STK = { by: {}, all: {}, clubs: [] };
(window.BOFFIN_PAGES || []).forEach(p => {
  const c = CLUB.indexOf(p.c); if (c < 0) return;
  const slots = p.s.map((k, n) => ({ key: p.c + "~" + k, club: p.c, c, i: KEY2IDX[k], n, tier: n < SR.pageIcons ? "gold" : n < SR.pageIcons + SR.pageFoils ? "foil" : "paper" }));
  STK.by[p.c] = slots; STK.clubs.push(p.c); slots.forEach(s => { STK.all[s.key] = s; });
});
const stkCount = () => Object.keys(S.stk.got).filter(k => STK.all[k]).length;
const stkPageGot = club => (STK.by[club] || []).filter(s => S.stk.got[s.key]).length;
const stkTitles = () => Object.keys(S.stk.pages || {}).filter(c => STK.by[c]).map(c => c + " Completist");

/* ---------- earning a shot (one offer per match at most) ---------- */
function stkOfferTier(info) {
  if (info.promoted || info.final) return "gold";
  if (info.perfect || (info.cupWin && (info.round | 0) >= SR.foilCupRound)) return "foil";
  if ((info.deep | 0) >= SR.paperDeep || (info.goals | 0) >= SR.paperGoals) return "paper";
  return null;
}
function stkWhy(info, free) {
  if (free) return "First win. Have one shot on the house.";
  if (info.promoted) return "Promotion earns a shot at a Gold Icon.";
  if (info.final) return "Cup winners get a shot at a Gold Icon.";
  if (info.perfect) return "Five from five earns a Foil.";
  if (info.cupWin) return "A cup tie won earns a Foil.";
  if ((info.deep | 0) >= SR.paperDeep) return (info.deep | 0) > 1 ? info.deep + " deep cuts in one match earns a shot." : "A deep cut earns a shot.";
  return info.goals + " from five earns a shot.";
}
function stkAfterMatch(info) {
  if (!STK.clubs.length) return "";
  let tier = stkOfferTier(info), free = false; const cur = S.stk.offer;
  if (!tier && !S.stk.free && info.won && !cur) { tier = "paper"; free = true; }
  if (!tier || (cur && TIER_RANK[cur.tier] >= TIER_RANK[tier])) return cur ? stkOfferHTML(cur, true) : "";
  if (free) S.stk.free = true;
  S.stk.offer = { tier, free, why: stkWhy(info, free), at: Date.now() }; S.stk.n.off++;
  return stkOfferHTML(S.stk.offer, false);
}
function stkOfferHTML(o, waiting) {
  return `<div class="panel stkoffer ${o.tier}"><span class="eyebrow">${waiting ? "Sticker chance still waiting" : "Sticker chance"}</span><b>${TIER_N[o.tier]}${o.free ? " · on the house" : ""}</b><p class="note">${esc(o.why || "")} Name the man on the sticker and he's yours. Miss and he's gone.</p><button class="btn" data-act="stkgo">Take the shot</button></div>`;
}
function stkHomeCard() {
  const o = S.stk.offer; if (!o || !STK.clubs.length) return "";
  if (o.started) { stkLose(true); return ""; }      // closed the app mid-attempt: that counts as a miss
  return `<button class="panel li stkwait ${o.tier}" data-act="stkgo" style="border-radius:6px"><span class="k">★</span><span class="tx"><b>Sticker chance · ${TIER_N[o.tier]}</b><span>One shot waiting. Name him and he sticks.</span></span><span class="go">›</span></button>`;
}

/* ---------- which sticker ---------- */
function stkPool() { const tier = tierOf(S.div), n = [16, 26, 38, 999][tier]; return (tier === 3 ? STK.clubs : BD.gridClubs.slice(0, n).map(c => CLUB[c]).filter(c => STK.by[c])); }
function stkTarget(o, r) {
  r = r || Math.random; const ok = s => s.i !== undefined;
  const pick = S.stk.pick && STK.all[S.stk.pick];      // a token-picked slot, used when the offer is good enough for it
  if (pick && ok(pick) && S.stk.tok > 0 && !o.free && TIER_RANK[pick.tier] <= TIER_RANK[o.tier]) { S.stk.tok--; S.stk.pick = ""; return pick; }
  if (o.free) { const club = STK.by[S.club] ? S.club : stkPool()[0] || STK.clubs[0]; return pickR(STK.by[club].filter(s => s.tier === "gold" && ok(s)), r); }   // a household name from your own club
  // every candidate at this tier gets a weight: your own club shares SR.ownClub of the total, the rest of your division's clubs share the remainder; chased stickers count SR.chaseWeight times
  const own = STK.by[S.club] ? STK.by[S.club].filter(s => s.tier === o.tier && ok(s)) : [], others = [].concat(...stkPool().filter(c => c !== S.club).map(c => STK.by[c].filter(s => s.tier === o.tier && ok(s))));
  const cands = own.map(s => [s, (others.length ? SR.ownClub : 1) / own.length]).concat(others.map(s => [s, (own.length ? 1 - SR.ownClub : 1) / others.length]));
  if (!cands.length) return null;
  const w = cands.map(([s, x]) => x * (S.stk.chase.includes(s.key) ? SR.chaseWeight : 1)), tot = w.reduce((x, y) => x + y, 0); let x = r() * tot;
  for (let n = 0; n < cands.length; n++) { x -= w[n]; if (x <= 0) return cands[n][0]; }
  return cands[cands.length - 1][0];
}

/* ---------- the attempt ---------- */
let STKA = null, stkRaf = 0;
const stkRules = (o, slot) => o.free ? "paper" : slot.tier;
function stkBar(label) { return `<div class="board"><div class="score"><button class="x" data-act="stkleave" aria-label="Leave">×</button><span class="nm">Sticker chance</span><span class="sc">${label}</span><span class="nm">${esc(S.club)}</span><span class="min">★</span></div><div class="clock"><i id="clk"></i></div></div>`; }
function stkScreen(html, q) { const app = document.getElementById("app"); view = "stk"; app.classList.add("focus"); app.classList.toggle("q", !!q); $("over").innerHTML = ""; $("main").innerHTML = html; window.scrollTo(0, 0); }
function stkGo() {
  const o = S.stk.offer; if (!o) { toast("No sticker chance waiting. Earn one in a match."); return; }
  if (o.started) { stkLose(true); render(); return; }
  if (!o.key) {
    if (o.tier === "gold" && !o.free && !(S.stk.pick && S.stk.tok > 0)) {
      if (!o.opts) { const club = STK.by[S.club] ? S.club : pickR(stkPool().length ? stkPool() : STK.clubs); o.opts = STK.by[club].filter(s => s.tier === "gold" && s.i !== undefined).slice(0, SR.goldChoices).map(s => s.key); save(); }
      const club = STK.all[o.opts[0]].club;
      stkScreen(`${stkBar("GOLD")}<div class="chance"><h3>Pick your Icon</h3><span class="eyebrow">${esc(club)} · one shot</span></div><p class="rule qq">Three ${esc(club)} Icons. Pick one to go for. One clue to start, one more every ${SR.goldClueEvery} seconds, one guess.</p>
      <div class="stkpick">${o.opts.map((k, n) => { const s = STK.all[k], have = S.stk.got[k]; return `<button class="stkr gold need" data-act="stkchoose" data-v="${esc(k)}"><i class="sil"></i><span class="needt">${have ? "Got · swap" : "Need"}</span><span class="meta">${POSN[PL[s.i][2]]}</span><i class="no">${s.n + 1}</i></button>`; }).join("")}</div>
      <button class="btn line" data-act="stkleave">Later</button>`);
      return;
    }
    const t = stkTarget(o); if (!t) { S.stk.offer = null; save(); toast("No sticker to offer just now."); render(); return; }
    o.key = t.key; save();
  }
  stkCover();
}
function stkCover() {
  const o = S.stk.offer, slot = STK.all[o.key], rt = stkRules(o, slot), n = SR.clues[rt], tr = SR.tries[rt];
  stkScreen(`${stkBar(TIER_N[slot.tier].toUpperCase().split(" ")[0])}<div class="chance"><h3>Name the man on the sticker</h3><span class="eyebrow">${TIER_N[slot.tier]} · ${esc(slot.club)}</span></div>
  <div class="stkmys"><div class="stkr ${slot.tier} need big"><span class="band">${esc(slot.club)}</span><i class="sil"></i><span class="needt">?</span><i class="no">${slot.n + 1}</i></div></div>
  <p class="rule qq">${n === 3 ? "All three clues showing" : n === 2 ? "Two clues showing" : "One clue to start, another every " + SR.goldClueEvery + " seconds"}. ${tr === 1 ? "One guess." : tr + " guesses."}<span>30 seconds on the clock once you start. Miss and he's gone.</span></p>
  <button class="btn" data-act="stkstart">Name him</button><button class="btn line" data-act="stkleave">Later</button>`);
}
function stkCluesHTML() {
  const A = STKA, p = PL[A.slot.i], a = p[5], path = []; for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
  const shown = A.gold ? Math.min(3, 1 + Math.floor((Date.now() - A.t0) / (SR.goldClueEvery * 1000))) : A.shown, lock = k => `<div class="clue lock"><span>Clue ${k}</span><b>${A.gold ? "Unlocking…" : "Not on this one"}</b></div>`;
  A.lastShown = shown;
  return `<div class="clues"><div class="clue"><span>Plays</span><b>${POSN[p[2]]} · ${esc(NAT[p[1]])}</b></div>${shown >= 2 ? `<div class="clue"><span>Born</span><b>${1900 + p[3]}</b></div>` : lock(2)}${shown >= 3 ? `<div class="clue trail"><span>Clubs on record</span><div class="path">${path.map((c, k) => `${k ? "<i>›</i>" : ""}<span>${esc(CLUB[c[0]])}<em>${c[1] >= 2025 ? "now" : "'" + String(c[1]).slice(2)}</em></span>`).join("")}</div></div>` : lock(3)}</div>
  <div class="tries">${Array.from({ length: A.max }, (_, k) => `<i class="${k >= A.tries ? "x" : ""}"></i>`).join("")}<span>${A.tries} ${A.tries === 1 ? "guess" : "guesses"} left</span></div>`;
}
function stkStart() {
  const o = S.stk.offer; if (!o || !o.key) return; const slot = STK.all[o.key], rt = stkRules(o, slot);
  o.started = true; save();
  STKA = { slot, rt, gold: rt === "gold", shown: SR.clues[rt], tries: SR.tries[rt], max: SR.tries[rt], t0: Date.now(), limit: 30000, lastShown: 0 };
  M = { mode: "stk", live: true, run: { onPick: stkPick } };
  stkScreen(`${stkBar(TIER_N[slot.tier].toUpperCase().split(" ")[0])}<div class="chance"><h3>Name the man on the sticker</h3><span class="eyebrow">${TIER_N[slot.tier]} · ${esc(slot.club)}</span></div>
  <div class="entry"><input id="q" type="text" placeholder="Type a player's name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><div class="sug" id="sug" hidden></div></div>
  <p class="msg" id="msg"></p><div id="rbody">${stkCluesHTML()}</div>`, true);
  const q = $("q"); if (q) { try { q.focus({ preventScroll: true }); } catch (e) { try { q.focus(); } catch (e2) { } } }
  cancelAnimationFrame(stkRaf); stkRaf = requestAnimationFrame(stkTick);
}
function stkTick() {
  const A = STKA; if (!A || !M || !M.live) return; const left = Math.max(0, A.limit - (Date.now() - A.t0)), c = $("clk");
  if (c) { c.style.transform = "scaleX(" + left / A.limit + ")"; c.parentNode.classList.toggle("low", left < 5000); }
  if (A.gold && Math.min(3, 1 + Math.floor((Date.now() - A.t0) / (SR.goldClueEvery * 1000))) !== A.lastShown) { const b = $("rbody"); if (b) b.innerHTML = stkCluesHTML(); sfx.tick(); }
  if (left <= 0) { stkLose(false, true); return; }
  stkRaf = requestAnimationFrame(stkTick);
}
function stkPick(i) {
  const A = STKA; if (!A || i < 0) return;
  if (i === A.slot.i || pkey(i) === pkey(A.slot.i)) { stkWin(); return; }
  A.tries--; sfx.no(); buzz(70);
  if (A.tries <= 0) { stkLose(false, false); return; }
  msg(PL[i][0] + "? " + pickR(["Not him.", "Wrong sticker.", "Have another look at the clues.", "Nope. One more go."]), "bad"); const b = $("rbody"); if (b) b.innerHTML = stkCluesHTML();
}
function stkStop() { cancelAnimationFrame(stkRaf); if (M && M.mode === "stk") M = null; STKA = null; document.getElementById("app").classList.remove("q"); const q = $("q"); if (q) q.blur(); }
function stkCard(slot, n, cls) {
  const p = PL[slot.i], nm = p[0].split(" "), sn = nm[nm.length - 1], fn = nm.slice(0, -1).join(" "), y = stkYears(slot.i, slot.c), col = CLUB_COLOURS[slot.club];
  return `<div class="stkr ${slot.tier} got ${cls || ""}"><span class="band"${col ? ` style="background:${col}"` : ""}>${esc(slot.club)}</span><span class="fn">${esc(fn)}</span><b class="sn">${esc(sn)}</b><span class="meta">${POSN[p[2]]} · ${esc(NAT[p[1]])}</span><span class="yrs">${y ? "Joined " + y.from : ""}</span><i class="no">${slot.n + 1}</i>${n > 1 ? `<em class="x">×${n}</em>` : ""}</div>`;
}
const STK_LOST = ["He's gone. Back in the packet he goes.", "Gone. Somebody's little brother has him now.", "Missed. He's off to the bottom of a school bag.", "Gone. You'll see him again, and you'd better know him."];
function stkLose(silent, timeUp) {
  const o = S.stk.offer; S.stk.offer = null; S.stk.n.lost++; stkStop(); save(true);
  if (silent) { toast("You walked away from a sticker. He's gone."); return; }
  sfx.no(); buzz([60, 40, 60]);
  stkScreen(`${stkBar("GONE")}<div class="verdict nogoal"><div class="big">${timeUp ? "Time's up" : "Not him"}</div><p>${esc(pickR(STK_LOST))}</p><p>We're not telling you who it was. He stays a mystery till you name him.</p></div>
  <div class="stkmys"><div class="stkr ${o && STK.all[o.key] ? STK.all[o.key].tier : "paper"} need big gone"><i class="sil"></i><span class="needt">Gone</span></div></div>
  <button class="btn" data-act="stkalbum">To the album</button><button class="btn line" data-act="go" data-v="home">Home</button>`);
}
function stkWin() {
  const A = STKA, slot = A.slot, k = slot.key, dup = !!S.stk.got[k], lines = [];
  S.stk.got[k] = (S.stk.got[k] || 0) + 1; S.stk.n.won++; S.stk.chase = S.stk.chase.filter(x => x !== k); S.stk.offer = null;
  let xp = dup ? SR.dupXp : SR.winXp[slot.tier], token = false, page = false;
  lines.push([dup ? "Swap" : TIER_N[slot.tier] + " sticker", xp]);
  if (dup) { S.stk.dups++; if (S.stk.dups % SR.dupsPerToken === 0) { S.stk.tok++; token = true; } }
  const slots = STK.by[slot.club];
  if (!dup && slots.every(s => S.stk.got[s.key]) && !S.stk.pages[slot.club]) { page = true; S.stk.pages[slot.club] = dayKey(); const px = slot.club === S.club ? SR.ownPageXp : SR.pageXp; lines.push(["Page complete", px]); xp += px; }
  addAlbum(slot.i); addXp(xp); stkStop(); save(true); sfx.goal(); buzz([20, 30, 20, 30, 90]);
  SHARE = shareSticker(slot.tier, slot.club);
  stkScreen(`${stkBar("IN")}<div class="verdict goal"><div class="big">${dup ? "Got, got, got" : "Stuck in"}</div><p>${dup ? "You've already got him. One for the swaps pile." : esc(pickR(["Straight in the album. No bubbles.", "Pressed down with the thumb. Lovely.", "He's yours. Earned, not bought."]))}</p></div>
  <div class="stkmys">${stkCard(slot, S.stk.got[k], "big stick")}</div>
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${xp}</b></div></div><div class="statline" style="margin-top:10px"><span>${esc(slot.club)} page</span><span><b>${stkPageGot(slot.club)}</b> of ${SR.pageSize}</span></div>${token ? `<p class="note" style="margin-top:8px"><b>Three swaps make a token.</b> Spend it in the album to choose which missing sticker your next shot is for.</p>` : dup ? `<p class="note" style="margin-top:8px">${SR.dupsPerToken - S.stk.dups % SR.dupsPerToken} more ${SR.dupsPerToken - S.stk.dups % SR.dupsPerToken === 1 ? "swap" : "swaps"} for a pick-your-player token.</p>` : ""}</div>
  ${page ? `<div class="panel send up"><span class="eyebrow">Page complete</span><div class="big">${esc(slot.club)}</div><p class="note">${slot.club === S.club ? "Your own club, every last one of them named. That's the whole point of all this." : "All eighteen. Not a gap on the page."} New title: <b>${esc(slot.club)} Completist</b>.</p></div>` : ""}
  <button class="btn" data-act="stkalbum">To the album</button>${slot.tier !== "paper" ? shareBtns() : ""}<button class="btn line" data-act="go" data-v="home">Home</button>`);
}

/* ---------- the album ---------- */
let stkClub = "", albumTab = "stk";
const albumSeg = () => `<div class="seg"><button class="${albumTab === "stk" ? "on" : ""}" data-act="atab" data-v="stk">Stickers</button><button class="${albumTab === "names" ? "on" : ""}" data-act="atab" data-v="names">Names</button></div>`;
function renderStickers() {
  if (!STK.clubs.length) { $("main").innerHTML = albumSeg() + `<div class="panel pad"><p class="note">The sticker album isn't available in this build.</p></div>`; return; }
  const club = STK.by[stkClub] ? stkClub : STK.by[S.club] ? S.club : STK.clubs[0]; stkClub = club;
  const slots = STK.by[club], got = stkPageGot(club), total = stkCount(), all = STK.clubs.length * SR.pageSize, swaps = slots.filter(s => S.stk.got[s.key] > 1), titles = stkTitles(), o = S.stk.offer;
  const order = STK.clubs.slice().sort((a, b) => (b === S.club) - (a === S.club) || a.localeCompare(b));
  $("main").innerHTML = `${albumSeg()}${o && !o.started ? stkOfferHTML(o, true) : ""}
  <div class="counts"><div class="panel ct"><b>${fmt(total)}</b><span>Stuck in</span></div><div class="panel ct"><b>${fmt(all)}</b><span>In the album</span></div><div class="panel ct"><b>${S.stk.tok}</b><span>${S.stk.tok === 1 ? "Token" : "Tokens"}</span></div></div>
  <label class="field" for="sc">Page<select id="sc">${order.map(c => `<option value="${esc(c)}" ${c === club ? "selected" : ""}>${esc(c)}${c === S.club ? " (yours)" : ""} · ${stkPageGot(c)}/${SR.pageSize}${S.stk.pages[c] ? " ✓" : ""}</option>`).join("")}</select></label>
  <div class="hd"><h2>${esc(club)}</h2><span class="eyebrow">${S.stk.pages[club] ? "★ Complete" : `Got ${got} · Need ${SR.pageSize - got}`}</span></div>
  <div class="stkpage">${slots.map(s => S.stk.got[s.key] && s.i !== undefined ? stkCard(s, S.stk.got[s.key]) : `<button class="stkr need ${s.tier}${S.stk.chase.includes(s.key) ? " chase" : ""}${S.stk.pick === s.key ? " picked" : ""}" data-act="stkslot" data-v="${esc(s.key)}" aria-label="Missing sticker ${s.n + 1}, ${TIER_N[s.tier]}"><i class="sil"></i><span class="needt">${S.stk.pick === s.key ? "Next shot" : S.stk.chase.includes(s.key) ? "Chasing" : "Need"}</span><i class="no">${s.n + 1}</i></button>`).join("")}</div>
  <div class="key stkkey"><span><i class="k gold"></i>1–${SR.pageIcons} Gold Icons</span><span><i class="k foil"></i>${SR.pageIcons + 1}–${SR.pageIcons + SR.pageFoils} Foils</span><span><i class="k paper"></i>${SR.pageIcons + SR.pageFoils + 1}–${SR.pageSize} Paper</span></div>
  ${swaps.length ? `<div class="hd"><h2>Swaps</h2><span class="eyebrow">${SR.dupsPerToken - S.stk.dups % SR.dupsPerToken} more for a token</span></div><div class="panel pad"><div class="chips">${swaps.map(s => `<span class="hit">${esc(PL[s.i][0])} ×${S.stk.got[s.key] - 1}</span>`).join("")}</div></div>` : ""}
  ${titles.length ? `<div class="panel pad"><div class="statline"><span>Titles</span><span><b>${titles.map(esc).join(" · ")}</b></span></div></div>` : ""}
  <div class="panel pad"><p class="note"><b>How you get them.</b> Nothing is handed out. A match with ${SR.paperDeep > 1 ? SR.paperDeep + " deep cuts" : "a deep cut"} or ${SR.paperGoals} goals earns a Paper shot; five from five${SR.foilCupRound <= 3 ? ` or winning a cup ${["tie", "quarter-final", "semi-final", "final"][SR.foilCupRound]}${SR.foilCupRound ? " or better" : ""}` : ""} earns a Foil; promotion or lifting the cup earns a Gold Icon. Then you have to <b>name the man on the sticker</b> from the clues. Miss and he's gone.</p><p class="note" style="margin-top:8px">Tap a missing sticker to <b>chase</b> it (up to ${SR.chaseMax}, ${SR.chaseWeight} times likelier to come up). ${SR.dupsPerToken} swaps make a token, which lets you choose which missing sticker your next shot is for. You still have to name him.</p></div>`;
}
function stkSlotSheet(key) {
  const s = STK.all[key]; if (!s) return; const chasing = S.stk.chase.includes(key), full = S.stk.chase.length >= SR.chaseMax, picked = S.stk.pick === key;
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">${esc(s.club)} · No. ${s.n + 1} · ${TIER_N[s.tier]}</span><h1>Still a mystery</h1>
  <p class="note">You'll find out who he is when you name him. ${s.i === undefined ? "This one can't be offered at the moment." : ""}</p>
  <button class="btn line" data-act="stkchase" data-v="${esc(key)}" ${!chasing && full ? "disabled" : ""}>${chasing ? "Stop chasing" : full ? "Chase list full (" + SR.chaseMax + ")" : "Chase him"}</button>
  ${S.stk.tok > 0 || picked ? `<button class="btn" data-act="stktoken" data-v="${esc(key)}">${picked ? "Cancel: keep my token" : "Spend a token on him"}</button><p class="note">${picked ? "Your next good-enough shot is for this sticker." : `Your next shot ${s.tier === "paper" ? "" : "of " + TIER_N[s.tier] + " grade or better "}will be for this sticker. The token goes when you take the shot. You still have to name him.`}</p>` : `<p class="note">No tokens yet. Three swaps make one.</p>`}
  <button class="btn line" data-act="closeover">Close</button></div></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act, v = b.dataset.v;
  if (act === "stkgo") stkGo();
  else if (act === "stkchoose") { const o = S.stk.offer; if (o && o.opts && o.opts.includes(v)) { o.key = v; save(); stkCover(); } }
  else if (act === "stkstart") stkStart();
  else if (act === "stkleave") { if (STKA) confirmSheet("Walk away?", "Leave now and the sticker's gone.", "Walk away", () => { stkLose(true); view = "home"; render(); }); else { stkStop(); view = "home"; render(); } }
  else if (act === "stkalbum") { M = null; view = "album"; albumTab = "stk"; render(); }
  else if (act === "atab") { albumTab = v; render(); }
  else if (act === "stkslot") stkSlotSheet(v);
  else if (act === "stkchase") { const i = S.stk.chase.indexOf(v); if (i >= 0) S.stk.chase.splice(i, 1); else if (S.stk.chase.length < SR.chaseMax) S.stk.chase.push(v); save(); $("over").innerHTML = ""; render(); }
  else if (act === "stktoken") { S.stk.pick = S.stk.pick === v ? "" : v; save(); $("over").innerHTML = ""; render(); toast(S.stk.pick ? "Token lined up. Now earn the shot." : "Token kept."); }
});
document.addEventListener("change", e => { if (e.target.id === "sc") { stkClub = e.target.value; renderStickers(); } });
