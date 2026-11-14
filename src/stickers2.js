"use strict";
/* ============ stickers2.js (14/11/2026): more to do with stickers ============
   Legends, Sticker of the Day, tilt-to-shine, peel-and-stick, Best XI, team photo, swaps with mates.
   Loaded after stickers.js and uses its globals (STK, SR, S.stk, stkCard...). Earning a sticker stays as hard as before. */

/* ---------- Legends: a special edition of three stickers on each page ----------
   The data can't tell an all-time great from a long stay (club trails miss moves; big-match line-ups lean to the 2010s),
   so by default a club's Legends are its page's three Gold Icons. LEGEND_PICKS overrides that by hand, players on that
   club's page only. Arsenal's three are the ones Adam named. Change picks before anyone has won a Legend of that club.
   Only winning your division (finishing 1st) earns a shot at one. */
const LEGEND_PICKS = {
  Arsenal: ["Thierry Henry", "Dennis Bergkamp", "Patrick Vieira"]
};
const LEG = {};
STK.clubs.forEach(club => {
  const slots = STK.by[club].filter(s => s.i !== undefined),
    pick = (LEGEND_PICKS[club] || []).map(n => slots.find(s => PL[s.i][0] === n)).filter(Boolean);
  LEG[club] = (pick.length ? pick : slots.filter(s => s.tier === "gold")).slice(0, 3).map(s => s.key);
});
const stkIsLeg = key => !!(S.stk && S.stk.leg && S.stk.leg[key]);
const legOf = club => LEG[club] || [];

/* ---------- tilt-to-shine: the holo on Foil, Gold, Legend and Shiny follows the phone (or the mouse) ---------- */
const Tilt = {
  on: false,
  asked: false,
  raf: 0,
  x: 0,
  y: 0,
  set(x, y) {
    Tilt.x = Math.max(-1, Math.min(1, x));
    Tilt.y = Math.max(-1, Math.min(1, y));
    if (Tilt.raf) return;
    Tilt.raf = requestAnimationFrame(() => {
      Tilt.raf = 0;
      const r = document.documentElement.style;
      r.setProperty("--tx", Tilt.x.toFixed(3));
      r.setProperty("--ty", Tilt.y.toFixed(3));
    });
  },
  start() {
    if (Tilt.on) return;
    Tilt.on = true;
    window.addEventListener("deviceorientation", e => {
      if (e.gamma === null || e.gamma === undefined) return;
      document.documentElement.classList.add("tilt");
      Tilt.set(e.gamma / 30, (e.beta - 45) / 30);
    });
  },
  // iPhones only allow motion after a tap, and only if asked. Asked once, the first time a sticker is touched.
  ask() {
    if (Tilt.asked) return;
    Tilt.asked = true;
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function")
      D.requestPermission()
        .then(r => r === "granted" && Tilt.start())
        .catch(() => {});
    else Tilt.start();
  }
};
document.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || document.documentElement.classList.contains("tilt-dev")) return;
  const t = e.target.closest && e.target.closest(".stkr.got");
  if (!t) return;
  const r = t.getBoundingClientRect();
  document.documentElement.classList.add("tilt");
  Tilt.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
});
document.addEventListener("pointerdown", e => {
  if (e.target.closest && e.target.closest(".stkr")) Tilt.ask();
});
if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== "function") Tilt.start(); // Android: no permission needed

/* the Legend shot: one of your own club's Legends you haven't got yet, then your division's clubs, then anyone's */
function legTarget(r) {
  r = r || Math.random;
  const want = clubs => [].concat(...clubs.map(c => legOf(c))).filter(k => !stkIsLeg(k) && STK.all[k] && STK.all[k].i !== undefined);
  const own = want(STK.by[S.club] ? [S.club] : []),
    div = want(stkPool()),
    any = want(STK.clubs),
    pool = own.length ? own : div.length ? div : any.length ? any : [].concat(...STK.clubs.map(legOf));
  return pool.length ? STK.all[pickR(pool, r)] : null;
}
/* Sticker of the Day borrows the offer slot; a normal offer that was waiting is put aside and handed back afterwards */
function stkUnhold() {
  if (S.stk.held && !S.stk.offer) {
    S.stk.offer = S.stk.held;
    S.stk.held = null;
  }
}

/* ---------- Sticker of the Day: same sticker for everyone, one go, Foil rules (two clues, two guesses) ---------- */
const sotdNo = () => Math.max(1, Math.round((new Date(dayKey() + "T12:00:00") - new Date("2026-11-14T12:00:00")) / 864e5) + 1);
function sotdSlot(day) {
  const pool = [].concat(...STK.clubs.map(c => STK.by[c])).filter(s => s.i !== undefined && s.tier !== "gold" && fame(s.i) >= 5);
  return pool.length ? pickR(pool, rngOf(hash("sotd" + day))) : null;
}
const sotdDone = () => S.stk.dd && S.stk.dd.d === dayKey() && S.stk.dd;
function sotdEnd(day, won, guesses) {
  S.stk.dd = { d: day, r: won ? 1 : 0, g: guesses };
}
function sotdGo() {
  const day = dayKey(),
    sl = sotdSlot(day);
  if (!sl) return;
  if (sotdDone()) return sotdSheet();
  const o = S.stk.offer;
  if (o && o.started) {
    stkLose(true);
    return;
  }
  if (o && !o.daily) S.stk.held = o;
  S.stk.offer = { tier: sl.tier, key: sl.key, daily: day, why: "Sticker of the Day", at: Date.now() };
  save();
  stkCover();
}
function sotdSheet() {
  const d = sotdDone(),
    sl = sotdSlot(dayKey());
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Sticker of the Day · No. ${sotdNo()}</span><h1>${d.r ? "Got him" : "Got away"}</h1>
  <p class="note">${d.r ? `Named in ${d.g} ${d.g === 1 ? "guess" : "guesses"}. He's in your album.` : `It was ${esc(PL[sl.i][0])}.`} A new one lands at midnight.</p>
  <div class="row"><button class="btn line" data-act="sharesotd">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(shareSotd())}" target="_blank" rel="noopener">WhatsApp</a></div>
  <button class="btn line" data-act="closeover">Close</button></div></div>`;
}
function shareSotd() {
  const d = sotdDone();
  return `BOFFIN STICKER OF THE DAY No. ${sotdNo()}\n${!d ? "Not tried yet" : d.r ? "✅ Named in " + d.g + (d.g === 1 ? " guess" : " guesses") : "❌ Got away"}\n${shareTail()}`;
}
function sotdTile() {
  const sl = sotdSlot(dayKey());
  if (!sl) return "";
  const d = sotdDone();
  return `<button class="panel tile2 sotdt" data-act="sotd"><span class="eyebrow">Sticker of the Day · No. ${sotdNo()}</span><span class="sub">${d ? (d.r ? "Got him. New one at midnight." : "Got away. New one at midnight.") : "Same sticker for everyone. One go."}</span><span class="more">${d ? "Result ›" : "Name him ›"}</span><b class="big">${d ? (d.r ? "✓" : "✗") : "?"}</b></button>`;
}

/* ---------- peel and stick: a new sticker goes in by hand ---------- */
let PEEL = null;
function stkPeel(slot, done) {
  PEEL = done;
  stkScreen(`${stkBar("IN")}<div class="peel"><p class="rule qq">Got him. Now stick him in.<span>Drag him into his slot. Or just tap him.</span></p>
  <div class="pstk" id="pstk">${stkCard(slot, 1, "big")}<i class="backing"></i></div>
  <div class="pslot" id="pslot"><span>No. ${slot.n + 1}</span><b>${esc(slot.club)}</b></div></div>`);
  const el = $("pstk");
  if (!el || !el.addEventListener) return;
  let x0 = 0,
    y0 = 0,
    dx = 0,
    dy = 0,
    down = false;
  el.addEventListener("pointerdown", e => {
    down = true;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = dy = 0;
    el.classList.add("lift");
    try {
      el.setPointerCapture(e.pointerId);
    } catch (er) {}
    Tilt.ask();
  });
  el.addEventListener("pointermove", e => {
    if (!down) return;
    dx = e.clientX - x0;
    dy = e.clientY - y0;
    el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 30}deg)`;
  });
  const up = () => {
    if (!down) return;
    down = false;
    const s = $("pslot").getBoundingClientRect(),
      r = el.getBoundingClientRect(),
      over = Math.abs(r.top + r.height / 2 - (s.top + s.height / 2)) < s.height * 0.6 && Math.abs(r.left + r.width / 2 - (s.left + s.width / 2)) < s.width * 0.7;
    if (over || Math.hypot(dx, dy) < 8) stkStuck();
    else {
      el.classList.remove("lift");
      el.style.transform = "";
    }
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
function stkStuck(now) {
  const done = PEEL;
  if (!done) return;
  PEEL = null;
  const el = $("pstk"),
    s = $("pslot");
  try {
    const r = el.getBoundingClientRect(),
      t = s.getBoundingClientRect(),
      cur = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
    el.style.transition = "transform .28s cubic-bezier(.2,.9,.3,1.2)";
    el.style.transform = `translate(${cur.m41 + t.left - r.left + (t.width - r.width) / 2}px,${cur.m42 + t.top - r.top + (t.height - r.height) / 2}px)`;
    el.classList.remove("lift");
    el.classList.add("stuck");
    s.classList.add("filled");
  } catch (e) {}
  sfx.tick();
  setTimeout(() => sfx.goal && sfx.tick(), 120);
  buzz([10, 40, 90]);
  if (now) done();
  else setTimeout(done, 700);
}

document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "sotd") sotdGo();
  else if (act === "sharesotd") {
    SHARE = shareSotd();
    doShare();
  }
});

/* ---------- Best XI: your stickers on a pitch, any club, by position ---------- */
const FORMS = {
  "4-3-3": [["GK", 50, 90], ["DEF", 15, 70], ["DEF", 38, 74], ["DEF", 62, 74], ["DEF", 85, 70], ["MID", 25, 48], ["MID", 50, 52], ["MID", 75, 48], ["FWD", 18, 22], ["FWD", 50, 16], ["FWD", 82, 22]],
  "4-4-2": [["GK", 50, 90], ["DEF", 15, 70], ["DEF", 38, 74], ["DEF", 62, 74], ["DEF", 85, 70], ["MID", 12, 46], ["MID", 37, 50], ["MID", 63, 50], ["MID", 88, 46], ["FWD", 35, 18], ["FWD", 65, 18]],
  "3-5-2": [["GK", 50, 90], ["DEF", 25, 72], ["DEF", 50, 75], ["DEF", 75, 72], ["MID", 10, 46], ["MID", 30, 52], ["MID", 50, 44], ["MID", 70, 52], ["MID", 90, 46], ["FWD", 35, 18], ["FWD", 65, 18]]
};
const xiState = () => {
  if (!S.stk.xi || !FORMS[S.stk.xi.f]) S.stk.xi = { f: "4-3-3", s: [] };
  return S.stk.xi;
};
const xiOK = k => STK.all[k] && STK.all[k].i !== undefined && S.stk.got[k]; // still in your album (a swap can take one away)
function xiChip(key, j, role) {
  const sl = key && xiOK(key) ? STK.all[key] : null;
  if (!sl) return `<button class="xis empty" data-act="xislot" data-v="${j}"><b>+</b><span>${role}</span></button>`;
  const p = PL[sl.i],
    sn = p[0].split(" ").slice(-1)[0],
    k = kitFor(sl.club, sl.i, sl.c);
  return `<button class="xis ${stkIsLeg(key) ? "leg" : sl.tier}" data-act="xislot" data-v="${j}">${kitSVG(k, true, sn)}<b>${esc(sn)}</b><span>${esc(sl.club)}</span></button>`;
}
function renderXI() {
  const X = xiState(),
    F = FORMS[X.f],
    n = F.filter((f, j) => X.s[j] && xiOK(X.s[j])).length;
  $("main").innerHTML = `${albumSeg()}<div class="hd"><h2>Best XI</h2><span class="eyebrow">${n} of 11 · every one earned</span></div>
  <div class="seg sm">${Object.keys(FORMS)
    .map(f => `<button class="${f === X.f ? "on" : ""}" data-act="xiform" data-v="${f}">${f}</button>`)
    .join("")}</div>
  <div class="xip">${F.map((f, j) => `<div class="xipos" style="left:${f[1]}%;top:${f[2]}%">${xiChip(X.s[j], j, f[0])}</div>`).join("")}</div>
  ${n ? `<div class="row"><button class="btn line" data-act="sharexi">Copy my XI</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(shareXI())}" target="_blank" rel="noopener">WhatsApp</a></div>` : ""}
  <p class="note">Tap a spot to pick from your stickers in that position. Any club. Only stickers you've got.</p>`;
}
function xiPicker(j) {
  const X = xiState(),
    role = FORMS[X.f][j][0],
    used = new Set(X.s.filter((k, m) => m !== +j)),
    mine = Object.keys(S.stk.got)
      .filter(k => xiOK(k) && POSN[PL[STK.all[k].i][2]] === role && !used.has(k))
      .sort((a, b) => (stkIsLeg(b) - stkIsLeg(a)) || TIER_RANK[STK.all[b].tier] - TIER_RANK[STK.all[a].tier] || PL[STK.all[a].i][0].localeCompare(PL[STK.all[b].i][0]));
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Best XI · ${role}</span><h1>Pick your ${{ GK: "keeper", DEF: "defender", MID: "midfielder", FWD: "forward" }[role]}</h1>
  ${
    mine.length
      ? `<div class="xil">${mine.map(k => `<button class="li" data-act="xipick" data-v="${j}|${esc(k)}"><span class="tx"><b>${esc(PL[STK.all[k].i][0])}${stkIsLeg(k) ? " · Legend" : ""}</b><span>${esc(STK.all[k].club)} · ${TIER_N[STK.all[k].tier]}</span></span><span class="go">›</span></button>`).join("")}</div>`
      : `<p class="note">No ${role === "GK" ? "keepers" : role === "DEF" ? "defenders" : role === "MID" ? "midfielders" : "forwards"} in your album yet${used.size ? " that aren't already in the side" : ""}. Earn some.</p>`
  }
  ${X.s[j] ? `<button class="btn line" data-act="xipick" data-v="${j}|">Take him out</button>` : ""}<button class="btn line" data-act="closeover">Close</button></div></div>`;
}
function shareXI() {
  const X = xiState(),
    F = FORMS[X.f],
    by = { GK: [], DEF: [], MID: [], FWD: [] };
  F.forEach((f, j) => {
    if (X.s[j] && xiOK(X.s[j])) by[f[0]].push(PL[STK.all[X.s[j]].i][0].split(" ").slice(-1)[0]);
  });
  return `MY BOFFIN XI (${X.f}), every sticker earned\n${["GK", "DEF", "MID", "FWD"].filter(r => by[r].length).map(r => r + ": " + by[r].join(", ")).join("\n")}\n${shareTail()}`;
}

/* ---------- team photo: a finished page, laid out like a squad photo ---------- */
function teamPhoto(club) {
  const slots = STK.by[club];
  if (!slots || !S.stk.pages[club]) return;
  const rows = [slots.slice(12), slots.slice(6, 12), slots.slice(0, 6)]; // paper at the back, Icons front and centre
  $("over").innerHTML = `<div class="sheet"><div class="box tphoto"><div class="tpb"><span class="eyebrow">The complete set</span><b>${esc(club)}</b><span>All ${SR.pageSize} named · finished ${S.stk.pages[club].split("-").reverse().join("/")}</span></div>
  ${rows.map((r, n) => `<div class="tpr r${n}">${r.map(s => stkCard(s, 1, "tp")).join("")}</div>`).join("")}
  <div class="row"><button class="btn line" data-act="shareteam" data-v="${esc(club)}">Copy</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(shareTeam(club))}" target="_blank" rel="noopener">WhatsApp</a></div>
  <button class="btn line" data-act="closeover">Close</button></div></div>`;
}
const shareTeam = club => `Finished the ${club} page on BOFFIN MATCHDAY. All ${SR.pageSize} stickers, every one named.\n${shareTail()}`;

/* ---------- the extra bits on an album page: Legends row, team photo, Sticker of the Day, swaps ---------- */
function albumExtras(club) {
  const L = legOf(club),
    legRow = L.length
      ? `<div class="hd"><h2>Legends</h2><span class="eyebrow">Win your division for a shot</span></div><div class="stkpage legs">${L.map(k => {
          const s = STK.all[k];
          return stkIsLeg(k) ? `<button class="stkb" data-act="stkview" data-v="${esc(k)}">${stkCard(s, 1)}</button>` : `<div class="stkr need legend"><i class="sil"></i><span class="needt">Legend</span><i class="no">L</i></div>`;
        }).join("")}</div>`
      : "",
    photo = S.stk.pages[club] ? `<button class="btn" data-act="teamphoto" data-v="${esc(club)}">Team photo</button>` : "";
  return photo + legRow;
}
function sotdPanel() {
  const sl = sotdSlot(dayKey());
  if (!sl) return "";
  const d = sotdDone();
  return `<button class="panel li sotdp" data-act="sotd"><span class="k">★</span><span class="tx"><b>Sticker of the Day · No. ${sotdNo()}</b><span>${d ? (d.r ? "Got him. New one at midnight." : "Got away. New one at midnight.") : "Same one for everyone. One go. Name him and he's yours."}</span></span><span class="go">›</span></button>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act,
    v = b.dataset.v;
  if (act === "xiform") {
    xiState().f = v;
    xiState().s = [];
    save();
    render();
  } else if (act === "xislot") xiPicker(v);
  else if (act === "xipick") {
    const [j, k] = v.split("|");
    const X = xiState();
    X.s[+j] = k || null;
    save();
    $("over").innerHTML = "";
    render();
  } else if (act === "sharexi") {
    SHARE = shareXI();
    doShare();
  } else if (act === "teamphoto") teamPhoto(v);
  else if (act === "shareteam") {
    SHARE = shareTeam(v);
    doShare();
  }
});

/* ---------- swaps with mates: offer a double by link, your mate takes it and gives one of theirs back ----------
   Needs both of you signed in and supabase/004_swaps.sql run. Your double leaves your album when you make the offer
   (so it can't be swapped twice) and comes back if you cancel. */
let SWAPIN = (location.search.match(/[?&]swap=([a-z0-9]{10})(?:&|$)/) || [])[1] || "";
if (SWAPIN)
  try {
    history.replaceState(null, "", location.pathname);
  } catch (e) {}
const swapCode = () => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789",
    r = new Uint8Array(10);
  (window.crypto || { getRandomValues: x => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(r);
  return Array.from(r, x => a[x % a.length]).join("");
};
const swapLink = code => (SHARE_URL || location.origin + location.pathname) + "?swap=" + code;
const swapName = k => (STK.all[k] && STK.all[k].i !== undefined ? PL[STK.all[k].i][0] : "a sticker");
function swapNeedSignIn(why) {
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Swaps</span><h1>Sign in to swap</h1><p class="note">${esc(why)} Swaps go through your account so nobody loses a sticker.</p>${
    Net.canSignIn() ? `<button class="btn" data-act="profile">Sign in</button>` : `<p class="note">Online accounts aren't available here.</p>`
  }<button class="btn line" data-act="closeover">Close</button></div></div>`;
}
async function swapOffer(k) {
  if ((S.stk.got[k] || 0) < 2) return toast("You need a double of him to swap.");
  if (!Net.canSwap()) return swapNeedSignIn("You and your mate both need to be signed in.");
  if ((S.stk.out || []).length >= 5) return toast("Five swaps on the go already. Cancel one first.");
  const code = swapCode(),
    ok = await Net.swap("swap_offer", { p_code: code, p_give: k });
  if (ok !== true) return toast("Couldn't set up the swap just now. Try again in a bit.");
  S.stk.got[k]--;
  S.stk.out = (S.stk.out || []).concat({ c: code, k, t: Date.now() });
  save(true);
  render();
  swapShareSheet(code, k);
}
function swapShareSheet(code, k) {
  const sl = STK.all[k],
    txt = `Got, got, need? I'll swap you my ${sl.club} ${TIER_N[sl.tier]} sticker (${swapName(k)}) for one of your doubles on BOFFIN MATCHDAY: ${swapLink(code)}`;
  SHARE = txt;
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Swap offered</span><h1>Send it to a mate</h1>
  <div class="stkmys">${stkCard(sl, 1, "big")}</div>
  <p class="note">Whoever opens the link first and gives you one of their doubles gets him. Lasts 14 days. You can cancel it in the album until someone takes it.</p>
  <div class="row"><button class="btn line" data-act="share">Copy link</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">WhatsApp</a></div>
  <button class="btn line" data-act="closeover">Done</button></div></div>`;
}
function swapOutHTML() {
  const out = S.stk.out || [];
  if (!out.length) return "";
  return `<div class="hd"><h2>Your swap offers</h2><span class="eyebrow">${out.length} waiting</span></div><div class="panel pad swo">${out
    .map(
      o =>
        `<div class="statline"><span>${esc(swapName(o.k))} <em class="note">${esc(STK.all[o.k] ? STK.all[o.k].club : "")}</em></span><span><button class="linkb" data-act="swapresend" data-v="${o.c}">Send again</button> · <button class="linkb" data-act="swapcancel" data-v="${o.c}">Cancel</button></span></div>`
    )
    .join("")}</div>`;
}
async function swapCancel(code) {
  const o = (S.stk.out || []).find(x => x.c === code);
  if (!o) return;
  const ok = await Net.swap("swap_cancel", { p_code: code });
  if (ok === true) {
    S.stk.got[o.k] = (S.stk.got[o.k] || 0) + 1;
    S.stk.out = S.stk.out.filter(x => x.c !== code);
    save(true);
    toast(swapName(o.k) + " is back in your swaps.");
    render();
  } else if (ok === false) {
    await swapCollect(); // somebody took it in the meantime
  } else toast("Couldn't reach the server. Try again in a bit.");
}
async function swapCollect() {
  if (!Net.canSwap() || !(S.stk.out || []).length) return;
  const rows = await Net.swap("swap_collect");
  if (!rows || !rows.length) return;
  rows.forEach(r => {
    const o = S.stk.out.find(x => x.c === r.code);
    S.stk.out = S.stk.out.filter(x => x.c !== r.code);
    if (r.back && STK.all[r.back]) {
      const fresh = !S.stk.got[r.back];
      S.stk.got[r.back] = (S.stk.got[r.back] || 0) + 1;
      S.stk.meta = S.stk.meta || {};
      if (fresh) S.stk.meta[r.back] = Object.assign({}, S.stk.meta[r.back] || {}, { d: dayKey() });
      toast(`Swap done: ${o ? swapName(o.k) + " went, " : ""}${swapName(r.back)} came back.`);
    }
  });
  save(true);
  if (view === "album") render();
}
async function swapBoot() {
  if (Net.canSwap()) await swapCollect();
  if (!SWAPIN) return;
  if (!Net.canSwap()) return swapNeedSignIn("A mate's sent you a sticker swap.");
  const rows = await Net.swap("swap_peek", { p_code: SWAPIN }),
    row = rows && rows[0];
  if (rows === null) return toast("Swaps aren't switched on yet.");
  if (!row || !STK.all[row.give]) {
    SWAPIN = "";
    return toast("That swap link doesn't exist.");
  }
  if (row.mine) {
    SWAPIN = "";
    return toast("That's your own swap. Send it to a mate.");
  }
  if (!row.open) {
    SWAPIN = "";
    return toast("Too late: someone's already taken that swap, or it's over 14 days old.");
  }
  const mine = Object.keys(S.stk.got).filter(k => S.stk.got[k] > 1 && STK.all[k] && STK.all[k].i !== undefined);
  $("over").innerHTML = `<div class="sheet"><div class="box"><span class="eyebrow">Sticker swap</span><h1>A mate's offering you</h1>
  <div class="stkmys">${stkCard(STK.all[row.give], 1, "big")}</div>
  ${
    mine.length
      ? `<p class="note">Give one of your doubles back and he's yours${S.stk.got[row.give] ? " (you've got him already, so he'd be a double)" : ""}.</p><div class="xil">${mine
          .map(k => `<button class="li" data-act="swaptake" data-v="${esc(k)}"><span class="tx"><b>${esc(swapName(k))}</b><span>${esc(STK.all[k].club)} · ${TIER_N[STK.all[k].tier]} · ×${S.stk.got[k] - 1} spare</span></span><span class="go">Give ›</span></button>`)
          .join("")}</div>`
      : `<p class="note">You need a double to give back, and you haven't got any yet. Earn some, then open the link again (it lasts 14 days).</p>`
  }
  <button class="btn line" data-act="closeover">Not now</button></div></div>`;
}
async function swapTake(back) {
  if (!SWAPIN || (S.stk.got[back] || 0) < 2) return;
  const g = await Net.swap("swap_take", { p_code: SWAPIN, p_back: back });
  SWAPIN = "";
  $("over").innerHTML = "";
  if (!g || !STK.all[g]) return toast("Too late: that swap's gone.");
  S.stk.got[back]--;
  const fresh = !S.stk.got[g];
  S.stk.got[g] = (S.stk.got[g] || 0) + 1;
  S.stk.meta = S.stk.meta || {};
  if (fresh) S.stk.meta[g] = Object.assign({}, S.stk.meta[g] || {}, { d: dayKey() });
  save(true);
  sfx.goal();
  toast(`Swapped. ${swapName(g)} is in your album.`);
  M = null;
  view = "album";
  albumTab = "stk";
  stkClub = STK.all[g].club;
  render();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act,
    v = b.dataset.v;
  if (act === "swapoffer") swapOffer(v);
  else if (act === "swapcancel") swapCancel(v);
  else if (act === "swaptake") swapTake(v);
  else if (act === "swapresend") {
    const o = (S.stk.out || []).find(x => x.c === v);
    if (o) swapShareSheet(o.c, o.k);
  }
});
