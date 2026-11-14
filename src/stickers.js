/* ============ stickers.js: the sticker album ============
   Nothing is handed out. A match can earn one shot at a mystery sticker; you get him by naming him from clues.
   Stickers live in S.stk (the "Names" log, S.album, is separate and untouched). All numbers are STICKER_RULES in app.js.
   Pages are frozen in sticker-pages.js so a page never reshuffles. */
const SR = STICKER_RULES;
const TIER_N = { paper: "Paper", foil: "Foil", gold: "Gold Icon", legend: "Legend" },
  TIER_RANK = { paper: 0, foil: 1, gold: 2, legend: 3 };
/* Band colour override per club ({ "Arsenal": "#hex" }). Empty on purpose: the band keeps the tier's colour and the
   shirt (kits.js, sourced) carries the club colours. */
const CLUB_COLOURS = {};

/* a player can only be offered if every clue has data behind it: nationality, birth year and at least one club with a year */
const stkEligible = i => PL[i][1] >= 0 && PL[i][3] > 0 && PL[i][5].length >= 2; // a one-club man still has a club trail to show
function stkSpells(i) {
  const a = PL[i][5],
    sp = [];
  for (let k = 0; k < a.length; k += 2) sp.push([a[k], 1990 + a[k + 1], k]);
  return sp.sort((x, y) => x[1] - y[1] || x[2] - y[2]);
}
function stkYears(i, c) {
  const sp = stkSpells(i);
  let first = -1,
    last = -1;
  sp.forEach((x, k) => {
    if (x[0] === c) {
      if (first < 0) first = k;
      last = k;
    }
  });
  if (first < 0) return null;
  const nxt = sp[last + 1];
  return { from: sp[first][1], to: nxt ? nxt[1] : null, n: sp.filter(x => x[0] === c).length };
}
/* years at a club (used for page ranking only, never shown: the data's club trails miss some moves, so a departure year can be wrong).
   First arrival to the next recorded club. Still "at" their last club with no end date: count to 2026, or to age 36 for anyone that old (retired). */
const stkTenure = (i, c) => {
  const y = stkYears(i, c);
  if (!y) return 0;
  const end = y.to !== null ? y.to : Math.min(2026, PL[i][3] > 0 ? 1900 + PL[i][3] + 36 : 2026);
  return Math.max(0, Math.min(8, end - y.from));
};
/* page order: fame, plus a quarter point per year at the club (capped at 8), so club legends beat one-season stars */
const stkRank = (i, c) => fame(i) + 0.25 * stkTenure(i, c);
const stkShortStay = (i, c) => {
  const y = stkYears(i, c);
  return !!y && y.n === 1 && y.to !== null && y.to - y.from <= 1;
}; // one stay of a year or less: a loan, not a club legend

const STK = { by: {}, all: {}, clubs: [] };
(window.BOFFIN_PAGES || []).forEach(p => {
  const c = CLUB.indexOf(p.c);
  if (c < 0) return;
  const slots = p.s.map((k, n) => ({
    key: p.c + "~" + k,
    club: p.c,
    c,
    i: KEY2IDX[k],
    n,
    tier: n < SR.pageIcons ? "gold" : n < SR.pageIcons + SR.pageFoils ? "foil" : "paper"
  }));
  STK.by[p.c] = slots;
  STK.clubs.push(p.c);
  slots.forEach(s => {
    STK.all[s.key] = s;
  });
});
const stkCount = () => Object.keys(S.stk.got).filter(k => STK.all[k]).length;
const stkPageGot = club => (STK.by[club] || []).filter(s => S.stk.got[s.key]).length;
const stkTitles = () =>
  Object.keys(S.stk.pages || {})
    .filter(c => STK.by[c])
    .map(c => c + " Completist");

/* ---------- earning a shot (one offer per match at most) ---------- */
function stkOfferTier(info) {
  if (info.title) return "legend"; // 14/11: winning the division
  if (info.promoted || info.final) return "gold";
  if (info.perfect || (info.cupWin && (info.round | 0) >= SR.foilCupRound)) return "foil";
  if ((info.deep | 0) >= SR.paperDeep || (info.goals | 0) >= SR.paperGoals) return "paper";
  return null;
}
function stkWhy(info, free) {
  if (free) return "First win. Have one shot on the house.";
  if (info.title) return "Champions. Winning the division earns a shot at a Legend.";
  if (info.promoted) return "Promotion earns a shot at a Gold Icon.";
  if (info.final) return "Cup winners get a shot at a Gold Icon.";
  if (info.perfect) return "Five from five earns a Foil.";
  if (info.cupWin) return "A cup tie won earns a Foil.";
  if ((info.deep | 0) >= SR.paperDeep) return (info.deep | 0) > 1 ? info.deep + " deep cuts in one match earns a shot." : "A deep cut earns a shot.";
  return info.goals + " from five earns a shot.";
}
function stkAfterMatch(info) {
  if (!STK.clubs.length) return "";
  let tier = stkOfferTier(info),
    free = false;
  const cur = S.stk.offer;
  if (!tier && !S.stk.free && info.won && !cur) {
    tier = "paper";
    free = true;
  }
  if (!tier || (cur && TIER_RANK[cur.tier] >= TIER_RANK[tier])) return cur ? stkOfferHTML(cur, true) : "";
  if (free) S.stk.free = true;
  S.stk.offer = { tier, free, why: stkWhy(info, free), at: Date.now() };
  S.stk.n.off++;
  return stkOfferHTML(S.stk.offer, false);
}
function stkOfferHTML(o, waiting) {
  return `<div class="panel stkoffer ${o.tier}"><span class="eyebrow">${waiting ? "Sticker chance still waiting" : "Sticker chance"}</span><b>${TIER_N[o.tier]}${o.free ? " · on the house" : ""}</b><p class="note">${esc(o.why || "")} Name the man on the sticker and he's yours. Miss and he's gone.</p><button class="btn" data-act="stkgo">Take the shot</button></div>`;
}
function stkHomeCard() {
  const o = S.stk.offer;
  if (!o || !STK.clubs.length) return "";
  if (o.started) {
    stkLose(true);
    return "";
  } // closed the app mid-attempt: that counts as a miss
  return `<button class="panel li stkwait ${o.tier}" data-act="stkgo" style="border-radius:6px"><span class="k">★</span><span class="tx"><b>Sticker chance · ${TIER_N[o.tier]}</b><span>One shot waiting. Name him and he sticks.</span></span><span class="go">›</span></button>`;
}

/* ---------- which sticker ---------- */
function stkPool() {
  const tier = tierOf(S.div),
    n = [16, 26, 38, 999][tier];
  return tier === 3
    ? STK.clubs
    : BD.gridClubs
        .slice(0, n)
        .map(c => CLUB[c])
        .filter(c => STK.by[c]);
}
function stkTarget(o, r) {
  r = r || Math.random;
  const ok = s => s.i !== undefined;
  if (o.tier === "legend") return legTarget(r);
  const pick = S.stk.pick && STK.all[S.stk.pick]; // a token-picked slot, used when the offer is good enough for it
  if (pick && ok(pick) && S.stk.tok > 0 && !o.free && TIER_RANK[pick.tier] <= TIER_RANK[o.tier]) {
    S.stk.tok--;
    S.stk.pick = "";
    return pick;
  }
  if (o.free) {
    const club = STK.by[S.club] ? S.club : stkPool()[0] || STK.clubs[0];
    return pickR(
      STK.by[club].filter(s => s.tier === "gold" && ok(s)),
      r
    );
  } // a household name from your own club
  // every candidate at this tier gets a weight: your own club shares SR.ownClub of the total, the rest of your division's clubs share the remainder; chased stickers count SR.chaseWeight times
  const own = STK.by[S.club] ? STK.by[S.club].filter(s => s.tier === o.tier && ok(s)) : [],
    others = [].concat(
      ...stkPool()
        .filter(c => c !== S.club)
        .map(c => STK.by[c].filter(s => s.tier === o.tier && ok(s)))
    );
  const cands = own
    .map(s => [s, (others.length ? SR.ownClub : 1) / own.length])
    .concat(others.map(s => [s, (own.length ? 1 - SR.ownClub : 1) / others.length]));
  if (!cands.length) return null;
  const w = cands.map(([s, x]) => x * (S.stk.chase.includes(s.key) ? SR.chaseWeight : 1)),
    tot = w.reduce((x, y) => x + y, 0);
  let x = r() * tot;
  for (let n = 0; n < cands.length; n++) {
    x -= w[n];
    if (x <= 0) return cands[n][0];
  }
  return cands[cands.length - 1][0];
}

/* ---------- the attempt ---------- */
let STKA = null,
  stkRaf = 0;
const stkRules = (o, slot) => (o.free ? "paper" : o.daily ? "foil" : o.tier === "legend" ? "gold" : slot.tier);
const stkLabel = (o, slot) => (o && o.tier === "legend" ? "Legend" : TIER_N[slot.tier]); // what the attempt is for
function stkBar(label) {
  return `<div class="board"><div class="score"><button class="x" data-act="stkleave" aria-label="Leave">×</button><span class="nm">Sticker chance</span><span class="sc">${label}</span><span class="nm">${esc(S.club)}</span><span class="min">★</span></div><div class="clock"><i id="clk"></i></div></div>`;
}
function stkScreen(html, q) {
  const app = document.getElementById("app");
  view = "stk";
  app.classList.add("focus");
  app.classList.toggle("q", !!q);
  $("over").innerHTML = "";
  $("main").innerHTML = html;
  window.scrollTo(0, 0);
}
function stkGo() {
  const o = S.stk.offer;
  if (!o) {
    toast("No sticker chance waiting. Earn one in a match.");
    return;
  }
  if (o.started) {
    stkLose(true);
    render();
    return;
  }
  if (!o.key) {
    if (o.tier === "gold" && !o.free && !(S.stk.pick && S.stk.tok > 0)) {
      if (!o.opts) {
        const club = STK.by[S.club] ? S.club : pickR(stkPool().length ? stkPool() : STK.clubs);
        o.opts = STK.by[club]
          .filter(s => s.tier === "gold" && s.i !== undefined)
          .slice(0, SR.goldChoices)
          .map(s => s.key);
        save();
      }
      const club = STK.all[o.opts[0]].club;
      stkScreen(`${stkBar("GOLD")}<div class="chance"><h3>Pick your Icon</h3><span class="eyebrow">${esc(club)} · one shot</span></div><p class="rule qq">Three ${esc(club)} Icons. Pick one to go for. One clue to start, one more every ${SR.goldClueEvery} seconds, one guess.</p>
      <div class="stkpick">${o.opts
        .map((k, n) => {
          const s = STK.all[k],
            have = S.stk.got[k];
          return `<button class="stkr gold need" data-act="stkchoose" data-v="${esc(k)}"><i class="sil"></i><span class="needt">${have ? "Got · swap" : "Need"}</span><span class="meta">${POSN[PL[s.i][2]]}</span><i class="no">${s.n + 1}</i></button>`;
        })
        .join("")}</div>
      <button class="btn line" data-act="stkleave">Later</button>`);
      return;
    }
    const t = stkTarget(o);
    if (!t) {
      S.stk.offer = null;
      save();
      toast("No sticker to offer just now.");
      render();
      return;
    }
    o.key = t.key;
    save();
  }
  stkCover();
}
function stkCover() {
  const o = S.stk.offer,
    slot = STK.all[o.key],
    rt = stkRules(o, slot),
    n = SR.clues[rt],
    tr = SR.tries[rt];
  const said = ["", "His clubs showing", "His clubs, position and country showing", "His clubs, position, country and age showing"][n];
  stkScreen(`${stkBar(stkLabel(o, slot).toUpperCase().split(" ")[0])}<div class="chance"><h3>${o.daily ? "Sticker of the Day" : "Name the man on the sticker"}</h3><span class="eyebrow">${stkLabel(o, slot)} · ${esc(slot.club)}</span></div>
  <div class="stkmys"><div class="stkr ${o.tier === "legend" ? "legend" : slot.tier} need big"><span class="band">${esc(slot.club)}</span><i class="sil"></i><span class="needt">?</span><i class="no">${slot.n + 1}</i></div></div>
  <p class="rule qq">${said}${n === 1 ? ", another clue every " + SR.goldClueEvery + " seconds" : ""}. ${tr === 1 ? "One guess." : tr + " guesses."}<span>${SR.secs} seconds once you start. Every wrong guess unlocks another clue. Miss and he's gone, but you'll find out who he was.</span></p>
  <button class="btn" data-act="stkstart">Name him</button><button class="btn line" data-act="stkleave">Later</button>`);
}
function stkCluesHTML() {
  const A = STKA,
    p = PL[A.slot.i],
    a = p[5],
    path = [];
  for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
  // clues in order of how much they give away: clubs, position + nation, born, initials. Wrong guesses and (Gold) the clock unlock more.
  const timed = A.gold ? 1 + Math.floor((Date.now() - A.t0) / (SR.goldClueEvery * 1000)) : 0,
    shown = Math.min(4, Math.max(A.shown + (A.max - A.tries), timed)),
    inits = p[0]
      .split(" ")
      .map(w => w[0] + ".")
      .join(" "),
    cell = (on, h, v, what) => `<div class="clue c3${on ? "" : " lock"}"><span>${h}</span><b>${on ? v : A.gold ? "…" : what}</b></div>`;
  A.lastShown = shown;
  return `<div class="clues"><div class="clue trail"><span>Clubs on record</span><div class="path">${path.map((c, k) => `${k ? "<i>›</i>" : ""}<span>${esc(CLUB[c[0]])}<em>${c[1] >= 2025 ? "now" : "'" + String(c[1]).slice(2)}</em></span>`).join("")}</div></div><div class="cl3">${cell(
    shown >= 2,
    "Plays",
    POSN[p[2]] + " · " + esc(NAT[p[1]]),
    "?"
  )}${cell(shown >= 3, "Born", 1900 + p[3], "?")}${cell(shown >= 4, "Initials", esc(inits), "?")}</div></div>
  <div class="tries">${Array.from({ length: A.max }, (_, k) => `<i class="${k >= A.tries ? "x" : ""}"></i>`).join("")}<span>${A.tries} ${A.tries === 1 ? "guess" : "guesses"} left</span></div>`;
}
function stkStart() {
  const o = S.stk.offer;
  if (!o || !o.key) return;
  const slot = STK.all[o.key],
    rt = stkRules(o, slot);
  o.started = true;
  save();
  STKA = { slot, rt, leg: o.tier === "legend", daily: o.daily || "", gold: rt === "gold", shown: SR.clues[rt], tries: SR.tries[rt], max: SR.tries[rt], t0: Date.now(), limit: SR.secs * 1000, lastShown: 0 };
  M = { mode: "stk", live: true, run: { onPick: stkPick } };
  stkScreen(
    `${stkBar(stkLabel(o, slot).toUpperCase().split(" ")[0])}<div class="chance"><h3>${o.daily ? "Sticker of the Day" : "Name the man on the sticker"}</h3><span class="eyebrow">${stkLabel(o, slot)} · ${esc(slot.club)}</span></div>
  <div class="entry"><input id="q" type="text" placeholder="Type a player's name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><button type="button" class="clr" id="clr" data-act="clrq" aria-label="Clear" hidden>×</button><div class="sug" id="sug" hidden></div></div>
  <p class="msg" id="msg"></p><div id="rbody">${stkCluesHTML()}</div>`,
    true
  );
  const q = $("q");
  if (q) {
    try {
      q.focus({ preventScroll: true });
    } catch (e) {
      try {
        q.focus();
      } catch (e2) {}
    }
  }
  cancelAnimationFrame(stkRaf);
  stkRaf = requestAnimationFrame(stkTick);
}
function stkTick() {
  const A = STKA;
  if (!A || !M || !M.live) return;
  const left = Math.max(0, A.limit - (Date.now() - A.t0)),
    c = $("clk");
  if (c) {
    c.style.transform = "scaleX(" + left / A.limit + ")";
    c.parentNode.classList.toggle("low", left < 5000);
  }
  if (A.gold && Math.min(4, Math.max(A.shown + (A.max - A.tries), 1 + Math.floor((Date.now() - A.t0) / (SR.goldClueEvery * 1000)))) !== A.lastShown) {
    const b = $("rbody");
    if (b) b.innerHTML = stkCluesHTML();
    sfx.tick();
  }
  if (left <= 0) {
    stkLose(false, true);
    return;
  }
  stkRaf = requestAnimationFrame(stkTick);
}
function stkPick(i) {
  const A = STKA;
  if (!A || i < 0) return;
  if (i === A.slot.i || pkey(i) === pkey(A.slot.i)) {
    stkWin();
    return;
  }
  A.tries--;
  sfx.no();
  buzz(70);
  if (A.tries <= 0) {
    stkLose(false, false);
    return;
  }
  msg(PL[i][0] + "? " + pickR(["Not him. Another clue's in.", "Wrong sticker. Have another clue.", "Nope. New clue below."]), "bad");
  const b = $("rbody");
  if (b) b.innerHTML = stkCluesHTML();
}
function stkStop() {
  cancelAnimationFrame(stkRaf);
  if (M && M.mode === "stk") M = null;
  STKA = null;
  document.getElementById("app").classList.remove("q");
  const q = $("q");
  if (q) q.blur();
}
/* ---------- what's on a sticker: real facts from the data only, never written from memory ----------
   Title squads: on a club's books (squad records, 2010–11 on) in a season that club topped one of the five league tables.
   Top-ten finishes: the top-ten lists. Fees: the transfer records. Big matches: the historic line-ups (only for names that
   are unique in the data, so nobody gets someone else's caps). */
const LG_SHORT = { "Premier League": "PL", "La Liga": "La Liga", "Serie A": "Serie A", Bundesliga: "Bundesliga", "Ligue 1": "Ligue 1" };
const ssn = y => String(y).slice(2) + "/" + String(y + 1).slice(2);
const NAME_N = {};
PL.forEach(p => {
  NAME_N[p[0]] = (NAME_N[p[0]] || 0) + 1;
});
const FACTS = {};
function stkFacts(i) {
  if (FACTS[i]) return FACTS[i];
  const p = PL[i],
    f = { titles: [], tops: [], fee: null, big: [], bigN: 0, leagues: [] };
  const ss = p[6];
  for (let k = 0; k < ss.length; k += 3)
    for (let y = ss[k + 1]; y <= ss[k + 2]; y++) {
      const T = BD.tables.find(t => t[1] === SQ0 + y && t[3][0] && t[3][0][0] === CLUB[ss[k]]);
      if (T && !f.titles.some(x => x.lg === T[0] && x.y === T[1])) f.titles.push({ lg: T[0], y: T[1], club: CLUB[ss[k]] });
    }
  f.titles.sort((a, b) => a.y - b.y);
  BD.lists.forEach(l =>
    l[3].forEach((it, k) => {
      if (it[0] === i) f.tops.push({ r: k + 1, v: it[1], u: l[1], t: l[0] });
    })
  );
  f.tops.sort((a, b) => a.r - b.r || b.v - a.v);
  BD.hl.forEach(h => {
    if (h[0] === i && (!f.fee || h[4] > f.fee.fee)) f.fee = { fee: h[4], from: CLUB[h[1]], to: CLUB[h[2]], y: h[3] };
  });
  if (NAME_N[p[0]] === 1) {
    const big = BD.xi.filter(x => x[6].some(q => q[0] === p[0]));
    const w = x =>
      /final(?!s)/i.test(x[4]) && !/quarter|semi/i.test(x[4])
        ? 3
        : /semi/i.test(x[4])
          ? 2
          : /World Cup|Euro|Copa|Champions League/.test(x[4])
            ? 1
            : 0;
    f.bigN = big.length;
    f.big = big
      .sort((a, b) => w(b) - w(a) || (b[3] > a[3] ? 1 : -1))
      .slice(0, 2)
      .map(x => ({ comp: x[4], a: x[0], b: x[1], sc: x[2], d: x[3], w: w(x) }));
  }
  for (let b = 0; b < 5; b++) if (p[7] & (1 << b)) f.leagues.push(BD.leagues[b]);
  return (FACTS[i] = f);
}
const topLabel = t => {
  const m = t.t.match(/^(.*?) top scorers, (\d{4})/),
    a = t.t.match(/^(.*?): most assists, (\d{4})/);
  if (m && t.r === 1) return (LG_SHORT[m[1]] || m[1]) + " top scorer " + ssn(+m[2]);
  if (a && t.r === 1) return "Most " + (LG_SHORT[a[1]] || a[1]) + " assists " + ssn(+a[2]);
  return "";
};
/* one short line for the front, the most impressive thing the data says */
function stkHighlight(i, c) {
  const f = stkFacts(i),
    top = f.tops.map(topLabel).find(x => x),
    ti = f.titles.filter(t => t.club === CLUB[c]).reverse()[0]; // only a title won with this page's club; others go on the back
  if (top) return top;
  if (ti) return (LG_SHORT[ti.lg] || ti.lg) + " title squad " + ssn(ti.y);
  if (f.fee && f.fee.fee >= 25) return "€" + f.fee.fee + "m move";
  if (f.big[0] && f.big[0].w === 3) return "Started a final";
  if (f.leagues.length > 1) return f.leagues.map(l => LG_SHORT[l] || l).join(" · ");
  const y = stkYears(i, c);
  return y ? "Joined " + y.from : "";
}
const STARS = { paper: "★", foil: "★★", gold: "★★★" };
const CONDN = ["", "Good", "Near mint", "Mint"];
const stkMeta = k => (S.stk.meta || {})[k] || {};
/* ---------- the shirt: the club's home kit from his time there (kits.js) ---------- */
const KITS = window.BOFFIN_KITS || {};
/* the seasons he was on the books: first arrival to the next recorded club (or, with none, to the season he turned 36: a guess, used only to pick a shirt) */
function stkSeasons(i, c) {
  const y = stkYears(i, c);
  if (!y) return null;
  const end = y.to !== null ? Math.max(y.from, y.to - 1) : Math.max(y.from, Math.min(2025, PL[i][3] > 0 ? 1900 + PL[i][3] + 36 : 2025));
  return { from: y.from, to: end };
}
/* which shirt: a famous one-off ("sig") if his time at the club ended in it (Henry, Pires and Bergkamp in the redcurrant), otherwise whatever was worn in the middle of his spell */
function kitFor(club, i, c) {
  const k = KITS[club];
  if (!k) return null;
  const ss = stkSeasons(i, c);
  if (!ss) return k;
  const eras = k.e || [],
    sig = eras.find(e => e[3] && ss.from <= e[0] && ss.to >= e[0] && ss.to <= e[1] + 1); // he signed off in it: his spell ended in that season or the next
  if (sig) return Object.assign({}, k, { s: undefined, p: undefined }, sig[2], { yr: sig[0] });
  const mid = Math.floor((ss.from + ss.to) / 2),
    era = eras.find(e => !e[3] && e[0] <= mid && e[1] >= mid);
  return era ? Object.assign({}, k, { s: undefined, p: undefined }, era[2], { yr: mid }) : k;
}
/* darken a #hex for shading and default trim */
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16),
    ch = s => Math.round(((n >> s) & 255) * f);
  return "#" + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
};
let kitN = 0;
const W_ = "#f4f4f1";
const SH_BODY = "M34 14 L43 11 Q50 19 57 11 L66 14 L68 40 L70 90 Q50 94 30 90 L32 40 Z";
const SH_LS = "M34 14 L20 21 L10 38 L22 45 L32 34 Z",
  SH_RS = "M66 14 L80 21 L90 38 L78 45 L68 34 Z";
/* luminance of a #hex (0 dark .. 1 light): picks a readable colour for the name on the back */
const lumHex = hex => {
  const n = parseInt((hex || "#888").slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
/* the shirt. back = seen from behind with his surname across the shoulders (14/11/2026: the sticker front) */
function kitSVG(k, back, name) {
  if (!k) return '<svg class="shirt plain" viewBox="0 0 100 100" aria-hidden="true"><path d="' + SH_BODY + " " + SH_LS + " " + SH_RS + '"/></svg>';
  const id = "kt" + ++kitN,
    b = k.b,
    c = k.c || W_,
    t = k.t || shade(b, 0.72),
    sl = k.s,
    pats = [];
  if (k.p === "stripes") for (let x = 6; x < 100; x += 14) pats.push(`<rect x="${x}" y="0" width="7" height="100" fill="${c}"/>`);
  else if (k.p === "hoops") for (let y = 22; y < 100; y += 14) pats.push(`<rect x="0" y="${y}" width="100" height="7" fill="${c}"/>`);
  else if (k.p === "halves") pats.push(`<rect x="0" y="0" width="50" height="100" fill="${c}"/>`);
  else if (k.p === "band") pats.push(`<rect x="38" y="0" width="24" height="100" fill="${c}"/>`);
  else if (k.p === "hechter")
    pats.push(`<rect x="38" y="0" width="24" height="100" fill="${W_}"/><rect x="41.5" y="0" width="17" height="100" fill="${c}"/>`);
  else if (k.p === "pin2")
    pats.push(`<rect x="44" y="0" width="4" height="100" fill="${c}"/><rect x="52" y="0" width="4" height="100" fill="${k.c2 || c}"/>`);
  else if (k.p === "diag") pats.push(`<path d="M0 100 L100 0 L100 100 Z" fill="${c}"/>`);
  const all = SH_BODY + " " + SH_LS + " " + SH_RS;
  let nameSVG = "";
  if (back && name) {
    // the name sits on whatever is behind the shoulders; patterned shirts get a plate in the base colour so it reads, like the real thing
    const plain = !k.p || k.p === "diag",
      ground = b,
      ink = lumHex(ground) > 0.62 ? "#16181b" : "#f6f4ee",
      nm = name.toUpperCase(),
      len = Math.min(34, 6 + nm.length * 3.4);
    nameSVG = `${plain ? "" : `<path d="M30 25 Q50 21 70 25 L70 36 Q50 32 30 36 Z" fill="${ground}"/>`}<path id="${id}n" d="M28 33 Q50 27 72 33" fill="none"/><text font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="800" font-size="9" fill="${ink}" letter-spacing=".4" text-anchor="middle"><textPath href="#${id}n" startOffset="50%" textLength="${len}" lengthAdjust="spacingAndGlyphs">${esc(nm)}</textPath></text>`;
  }
  return `<svg class="shirt kit${back ? " back" : ""}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${all}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${b}"/>${pats.join("")}${sl ? `<path d="${SH_LS} ${SH_RS}" fill="${sl}"/>` : ""}
<path d="M22 45 L10 38" stroke="${t}" stroke-width="4"/><path d="M78 45 L90 38" stroke="${t}" stroke-width="4"/>
<path d="M32 34 L32 40 M68 34 L68 40" stroke="#000" stroke-opacity=".18" stroke-width="1"/><path d="M40 60 Q44 75 41 88 M60 58 Q57 72 60 88" stroke="#000" stroke-opacity=".07" stroke-width="2" fill="none"/>
${nameSVG}<rect width="100" height="100" fill="url(#${id}g)"/></g>
${back ? `<path d="M43 11.5 Q50 15 57 11.5" stroke="${t}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : `<path d="M43 11 Q50 19 57 11" stroke="${t}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`}
<path d="${all}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1" stroke-linejoin="round"/></svg>`;
}
const stkShirt = slot => kitSVG(kitFor(slot.club, slot.i, slot.c));
/* 14/11/2026: the card's style follows the era of his time at the club: 90s cream Panini, 00s colour blocks, modern gloss */
function stkEra(slot) {
  const ss = stkSeasons(slot.i, slot.c);
  const mid = ss ? Math.floor((ss.from + ss.to) / 2) : 2015;
  return mid < 2000 ? "e90" : mid < 2010 ? "e00" : "e10";
}
const ERA_N = { e90: "90s", e00: "00s", e10: "Modern" };
function stkCard(slot, n, cls) {
  const p = PL[slot.i],
    nm = p[0].split(" "),
    sn = nm[nm.length - 1],
    fn = nm.slice(0, -1).join(" "),
    k = kitFor(slot.club, slot.i, slot.c),
    kb = (k && k.b) || "#3a4048",
    kc = (k && k.c) || W_,
    mt = stkMeta(slot.key),
    leg = stkIsLeg(slot.key),
    era = leg ? "leg" : stkEra(slot),
    hi = stkHighlight(slot.i, slot.c);
  return `<div class="stkr ${slot.tier} got ${era}${mt.sh ? " shiny" : ""} ${cls || ""}" style="--k:${kb};--k2:${shade(kb, 0.5)};--kc:${kc};--ki:${lumHex(kb) > 0.62 ? "#16181b" : "#fff"}"><i class="ph"></i><span class="band">${esc(slot.club)}</span>${kitSVG(k, true, sn)}<i class="holo"></i><span class="stars">${leg ? "LEGEND" : STARS[slot.tier]}</span><div class="nmb"><span class="fn">${esc(fn)}</span><b class="sn">${esc(sn)}</b></div><span class="meta">${POSN[p[2]]} · ${esc(NAT[p[1]])}</span>${hi ? `<span class="hi">${esc(hi)}</span>` : ""}<i class="no">${slot.n + 1}</i>${n > 1 ? `<em class="x">×${n}</em>` : ""}${mt.sh ? '<em class="shtag">✦ Shiny</em>' : mt.c === 3 ? '<em class="mint">Mint</em>' : ""}</div>`;
}
/* the back: everything the data knows about him */
function stkBack(slot) {
  const p = PL[slot.i],
    f = stkFacts(slot.i),
    mt = stkMeta(slot.key),
    a = p[5],
    path = [];
  for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
  const byLg = {};
  f.titles.forEach(t => {
    (byLg[t.lg] = byLg[t.lg] || []).push(ssn(t.y) + (t.club !== slot.club ? " (" + t.club + ")" : ""));
  });
  const unit = t => (t.u === "€m" ? "€" + t.v + "m" : t.v + " " + t.u);
  const sec = (h, body) => `<div class="bks"><span>${h}</span>${body}</div>`;
  return `<div class="bk">
  <div class="bkh"><b>${esc(p[0])}</b><span>${POSN[p[2]]} · ${esc(NAT[p[1]])} · b. ${1900 + p[3]}</span></div>
  ${sec("Clubs on record", `<p>${path.map(c => esc(CLUB[c[0]]) + " <i>'" + String(c[1]).slice(2) + "</i>").join(" › ")}</p>`)}
  ${
    Object.keys(byLg).length
      ? sec(
          "Title-winning squads",
          Object.keys(byLg)
            .map(l => `<p><b>${esc(l)}</b> ${byLg[l].map(esc).join(", ")}</p>`)
            .join("")
        )
      : ""
  }
  ${
    f.tops.length
      ? sec(
          "Top-ten finishes",
          `<ul>${f.tops
            .slice(0, 4)
            .map(t => `<li><b>${ord(t.r)}</b> ${esc(t.t)} · ${esc(unit(t))}</li>`)
            .join("")}${f.tops.length > 4 ? `<li class="more">and ${f.tops.length - 4} more</li>` : ""}</ul>`
        )
      : ""
  }
  ${f.fee ? sec("Biggest fee on record", `<p><b>€${f.fee.fee}m</b> · ${esc(f.fee.from)} → ${esc(f.fee.to)}, ${f.fee.y}</p>`) : ""}
  ${f.big.length ? sec(f.big[0].w ? "Big-match line-ups" : "Line-ups on record", f.big.map(x => `<p>${esc(x.comp)}: ${esc(x.a)} ${esc(x.sc)} ${esc(x.b)}</p>`).join("") + (f.bigN > f.big.length ? `<p class="more">${f.bigN} line-ups on record in all</p>` : "")) : ""}
  <div class="bkf"><span>No. ${slot.n + 1} of ${SR.pageSize} · ${TIER_N[slot.tier]}${mt.sh ? " · ✦ Shiny" : ""}</span><span>${mt.d ? "Stuck in " + mt.d.split("-").reverse().join("/") : ""}${mt.c ? " · " + CONDN[mt.c] : ""}</span></div>
  </div>`;
}
/* front and back in one card that turns over */
function stkFlip(slot, n, cls) {
  return `<div class="flip" data-act="stkturn" role="button" tabindex="0" aria-label="Turn the sticker over"><div class="flipin"><div class="face front">${stkCard(slot, n, cls)}</div><div class="face back"><div class="stkr ${slot.tier} got${stkMeta(slot.key).sh ? " shiny" : ""} rev">${stkBack(slot)}</div></div></div></div><p class="fliphint">Tap the sticker to turn it over</p>`;
}
function stkView(key) {
  const sl = STK.all[key];
  if (!sl || !S.stk.got[key]) return;
  $("over").innerHTML =
    `<div class="sheet"><div class="box stkbox"><div class="hd"><span class="eyebrow">${esc(sl.club)} · No. ${sl.n + 1}</span><button class="linkb" data-act="closeover">Close</button></div><div class="stkmys">${stkFlip(sl, S.stk.got[key], "big")}</div></div></div>`;
}
const STK_LOST = [
  "He's gone. Back in the packet he goes.",
  "Gone. Somebody's little brother has him now.",
  "Missed. He's off to the bottom of a school bag.",
  "Gone. You'll see him again, and you'd better know him."
];
function stkLose(silent, timeUp) {
  const o = S.stk.offer,
    was = o && STK.all[o.key] && STK.all[o.key].i !== undefined && o.started ? PL[STK.all[o.key].i][0] : ""; // 14/11: a miss tells you who it was, so you know him next time
  S.stk.offer = null;
  S.stk.n.lost++;
  if (o && o.daily) sotdEnd(o.daily, false, 0);
  stkUnhold();
  stkStop();
  save(true);
  if (silent) {
    toast(was ? "You walked away. It was " + was + "." : "You walked away from a sticker. He's gone.");
    return;
  }
  sfx.no();
  buzz([60, 40, 60]);
  stkScreen(`${stkBar("GONE")}<div class="verdict nogoal"><div class="big">${timeUp ? "Time's up" : "Not him"}</div><p>${esc(pickR(STK_LOST))}</p>${was ? `<p>It was <b>${esc(was)}</b>. Remember the name: he can come round again.</p>` : ""}</div>
  <div class="stkmys"><div class="stkr ${o && STK.all[o.key] ? STK.all[o.key].tier : "paper"} need big gone"><i class="sil"></i><span class="needt">Gone</span></div></div>
  <button class="btn" data-act="stkalbum">To the album</button><button class="btn line" data-act="go" data-v="home">Home</button>`);
}
function stkWin() {
  const A = STKA,
    slot = A.slot,
    k = slot.key,
    leg = A.leg,
    dup = leg ? stkIsLeg(k) : !!S.stk.got[k],
    lines = [];
  if (!leg || !S.stk.got[k]) S.stk.got[k] = (S.stk.got[k] || 0) + 1; // a Legend edition is an upgrade: it doesn't add a swap
  if (leg) S.stk.leg = Object.assign({}, S.stk.leg, { [k]: 1 });
  S.stk.n.won++;
  S.stk.chase = S.stk.chase.filter(x => x !== k);
  S.stk.offer = null;
  let xp = dup ? SR.dupXp : SR.winXp[leg ? "legend" : slot.tier],
    token = false,
    page = false;
  lines.push([dup ? "Swap" : (leg ? "Legend" : TIER_N[slot.tier]) + " sticker", xp]);
  if (A.daily) sotdEnd(A.daily, true, A.max - A.tries + 1);
  stkUnhold();
  if (dup && !leg) {
    S.stk.dups++;
    if (S.stk.dups % SR.dupsPerToken === 0) {
      S.stk.tok++;
      token = true;
    }
  }
  const slots = STK.by[slot.club];
  if (!dup && slots.every(s => S.stk.got[s.key]) && !S.stk.pages[slot.club]) {
    page = true;
    S.stk.pages[slot.club] = dayKey();
    const px = slot.club === S.club ? SR.ownPageXp : SR.pageXp;
    lines.push(["Page complete", px]);
    xp += px;
  }
  // collector details: date, how cleanly he was named (condition), and the shiny roll
  const used = A.max - A.tries + 1,
    clues = A.gold ? A.lastShown || 1 : A.shown,
    cond = used === 1 && clues <= SR.clues[A.rt] ? 3 : used === 1 ? 2 : 1;
  S.stk.meta = S.stk.meta || {};
  const mt = (S.stk.meta[k] = Object.assign({}, S.stk.meta[k] || {}));
  if (!mt.d) mt.d = dayKey();
  const better = cond > (mt.c || 0);
  if (better) mt.c = cond;
  const shiny = !mt.sh && Math.random() < SR.shinyChance;
  if (shiny) {
    mt.sh = 1;
    lines.push(["✦ Shiny!", SR.shinyXp]);
    xp += SR.shinyXp;
  }
  addAlbum(slot.i);
  addXp(xp);
  stkStop();
  save(true);
  sfx.goal();
  buzz([20, 30, 20, 30, 90]);
  SHARE = shareSticker(slot.tier, slot.club);
  const fin = () => stkScreen(`${stkBar("IN")}<div class="verdict goal"><div class="big">${dup ? "Got, got, got" : "Stuck in"}</div><p>${dup ? (shiny ? "Already had him, but this one's shiny. Swapped straight in." : "You've already got him. One for the swaps pile.") : esc(pickR(["Straight in the album. No bubbles.", "Pressed down with the thumb. Lovely.", "He's yours. Earned, not bought."]))}</p></div>
  ${shiny ? `<div class="panel pad shinyban"><b>✦ It's a shiny</b><p class="note">A holographic one. Roughly one sticker in ${Math.round(1 / SR.shinyChance)} comes out like this.</p></div>` : dup && better ? `<div class="panel pad"><p class="note">Upgraded to <b>${CONDN[mt.c]}</b> condition.</p></div>` : ""}<div class="stkmys">${stkFlip(slot, S.stk.got[k], "big stick")}</div>
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${xp}</b></div></div><div class="statline" style="margin-top:10px"><span>${esc(slot.club)} page</span><span><b>${stkPageGot(slot.club)}</b> of ${SR.pageSize}</span></div>${token ? `<p class="note" style="margin-top:8px"><b>Three swaps make a token.</b> Spend it in the album to choose which missing sticker your next shot is for.</p>` : dup ? `<p class="note" style="margin-top:8px">${SR.dupsPerToken - (S.stk.dups % SR.dupsPerToken)} more ${SR.dupsPerToken - (S.stk.dups % SR.dupsPerToken) === 1 ? "swap" : "swaps"} for a pick-your-player token.</p>` : ""}</div>
  ${page ? `<div class="panel send up"><span class="eyebrow">Page complete</span><div class="big">${esc(slot.club)}</div><p class="note">${slot.club === S.club ? "Your own club, every last one of them named. That's the whole point of all this." : "All eighteen. Not a gap on the page."} New title: <b>${esc(slot.club)} Completist</b>.</p></div>` : ""}
  <button class="btn" data-act="stkalbum">To the album</button>${slot.tier !== "paper" || leg ? shareBtns() : ""}<button class="btn line" data-act="go" data-v="home">Home</button>`);
  if (dup || window.PEEL_OFF) fin(); // PEEL_OFF: tests that only care about the result
  else stkPeel(slot, fin); // a new one gets peeled and stuck in by hand first
}

/* ---------- the album ---------- */
let stkClub = "",
  albumTab = "stk";
const albumSeg = () =>
  `<div class="seg">${[
    ["stk", "Stickers"],
    ["names", "Knowledge"],
    ["xi", "XI"],
    ["medals", "Medals"],
    ["stats", "Stats"]
  ]
    .filter(t => t[0] !== "stats" || !wide())
    .map(t => `<button class="${albumTab === t[0] ? "on" : ""}" data-act="atab" data-v="${t[0]}">${t[1]}</button>`)
    .join("")}</div>`;
function renderStickers() {
  if (!STK.clubs.length) {
    $("main").innerHTML = albumSeg() + `<div class="panel pad"><p class="note">The sticker album isn't available in this build.</p></div>`;
    return;
  }
  const club = STK.by[stkClub] ? stkClub : STK.by[S.club] ? S.club : STK.clubs[0];
  stkClub = club;
  const slots = STK.by[club],
    got = stkPageGot(club),
    total = stkCount(),
    all = STK.clubs.length * SR.pageSize,
    swaps = slots.filter(s => S.stk.got[s.key] > 1),
    titles = stkTitles(),
    o = S.stk.offer;
  const order = STK.clubs.slice().sort((a, b) => (b === S.club) - (a === S.club) || a.localeCompare(b));
  $("main").innerHTML = `${albumSeg()}${o && !o.started && !o.daily ? stkOfferHTML(o, true) : ""}${sotdPanel()}
  <div class="counts"><div class="panel ct"><b>${fmt(total)}</b><span>Stuck in</span></div><div class="panel ct"><b>${fmt(all)}</b><span>In the album</span></div><div class="panel ct"><b>${S.stk.tok}</b><span>${S.stk.tok === 1 ? "Token" : "Tokens"}</span></div></div>
  <label class="field" for="sc">Page<select id="sc">${order.map(c => `<option value="${esc(c)}" ${c === club ? "selected" : ""}>${esc(c)}${c === S.club ? " (yours)" : ""} · ${stkPageGot(c)}/${SR.pageSize}${S.stk.pages[c] ? " ✓" : ""}</option>`).join("")}</select></label>
  <div class="hd"><h2>${esc(club)}</h2><span class="eyebrow">${S.stk.pages[club] ? "★ Complete" : `Got ${got} · Need ${SR.pageSize - got}`}${slots.filter(x => stkMeta(x.key).sh && S.stk.got[x.key]).length ? " · ✦ " + slots.filter(x => stkMeta(x.key).sh && S.stk.got[x.key]).length + " shiny" : ""}</span></div>
  <div class="stkpage">${slots.map(s => (S.stk.got[s.key] && s.i !== undefined ? `<button class="stkb" data-act="stkview" data-v="${esc(s.key)}" aria-label="${esc(PL[s.i][0])}, look at the sticker">${stkCard(s, S.stk.got[s.key])}</button>` : `<button class="stkr need ${s.tier}${S.stk.chase.includes(s.key) ? " chase" : ""}${S.stk.pick === s.key ? " picked" : ""}" data-act="stkslot" data-v="${esc(s.key)}" aria-label="Missing sticker ${s.n + 1}, ${TIER_N[s.tier]}"><i class="sil"></i><span class="needt">${S.stk.pick === s.key ? "Next shot" : S.stk.chase.includes(s.key) ? "Chasing" : "Need"}</span><i class="no">${s.n + 1}</i></button>`)).join("")}</div>
  ${albumExtras(club)}
  <div class="key stkkey"><span><i class="k gold"></i>1–${SR.pageIcons} Gold Icons</span><span><i class="k foil"></i>${SR.pageIcons + 1}–${SR.pageIcons + SR.pageFoils} Foils</span><span><i class="k paper"></i>${SR.pageIcons + SR.pageFoils + 1}–${SR.pageSize} Paper</span></div>
  ${swaps.length ? `<div class="hd"><h2>Swaps</h2><span class="eyebrow">${SR.dupsPerToken - (S.stk.dups % SR.dupsPerToken)} more for a token</span></div><div class="panel pad"><div class="chips">${swaps.map(s => `<button class="hit" data-act="swapoffer" data-v="${esc(s.key)}">${esc(PL[s.i][0])} ×${S.stk.got[s.key] - 1} · swap</button>`).join("")}</div><p class="note" style="margin-top:8px">Tap a double to swap it with a mate by link.</p></div>` : ""}${swapOutHTML()}
  ${titles.length ? `<div class="panel pad"><div class="statline"><span>Titles</span><span><b>${titles.map(esc).join(" · ")}</b></span></div></div>` : ""}
  <div class="panel pad"><p class="note"><b>How you get them.</b> Nothing is handed out. A match with ${SR.paperDeep > 1 ? SR.paperDeep + " deep cuts" : "a deep cut"} or ${SR.paperGoals} goals earns a Paper shot; five from five${SR.foilCupRound <= 3 ? ` or winning a cup ${["tie", "quarter-final", "semi-final", "final"][SR.foilCupRound]}${SR.foilCupRound ? " or better" : ""}` : ""} earns a Foil; promotion or lifting the cup earns a Gold Icon. Then you have to <b>name the man on the sticker</b> from the clues. Miss and he's gone.</p><p class="note" style="margin-top:8px">Tap one you've got to turn it over: his record is on the back. Name him first go on the fewest clues and he's <b>Mint</b>; about one in ${Math.round(1 / SR.shinyChance)} comes out <b>✦ Shiny</b>, and a swap can still turn up shiny. Tap a missing sticker to <b>chase</b> it (up to ${SR.chaseMax}, ${SR.chaseWeight} times likelier to come up). ${SR.dupsPerToken} swaps make a token, which lets you choose which missing sticker your next shot is for. You still have to name him.</p></div>`;
  if ((S.stk.out || []).length && Date.now() - (window.SWAPAT || 0) > 20000) {
    window.SWAPAT = Date.now();
    swapCollect(); // has a mate taken one of your swaps?
  }
}

function stkSlotSheet(key) {
  const s = STK.all[key];
  if (!s) return;
  const chasing = S.stk.chase.includes(key),
    full = S.stk.chase.length >= SR.chaseMax,
    picked = S.stk.pick === key;
  $("over").innerHTML =
    `<div class="sheet"><div class="box"><span class="eyebrow">${esc(s.club)} · No. ${s.n + 1} · ${TIER_N[s.tier]}</span><h1>Still a mystery</h1>
  <p class="note">You'll find out who he is when you name him. ${s.i === undefined ? "This one can't be offered at the moment." : ""}</p>
  <button class="btn line" data-act="stkchase" data-v="${esc(key)}" ${!chasing && full ? "disabled" : ""}>${chasing ? "Stop chasing" : full ? "Chase list full (" + SR.chaseMax + ")" : "Chase him"}</button>
  ${S.stk.tok > 0 || picked ? `<button class="btn" data-act="stktoken" data-v="${esc(key)}">${picked ? "Cancel: keep my token" : "Spend a token on him"}</button><p class="note">${picked ? "Your next good-enough shot is for this sticker." : `Your next shot ${s.tier === "paper" ? "" : "of " + TIER_N[s.tier] + " grade or better "}will be for this sticker. The token goes when you take the shot. You still have to name him.`}</p>` : `<p class="note">No tokens yet. Three swaps make one.</p>`}
  <button class="btn line" data-act="closeover">Close</button></div></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act,
    v = b.dataset.v;
  if (act === "stkgo") stkGo();
  else if (act === "stkchoose") {
    const o = S.stk.offer;
    if (o && o.opts && o.opts.includes(v)) {
      o.key = v;
      save();
      stkCover();
    }
  } else if (act === "stkstart") stkStart();
  else if (act === "stkleave") {
    if (STKA)
      confirmSheet("Walk away?", "Leave now and the sticker's gone.", "Walk away", () => {
        stkLose(true);
        view = "home";
        render();
      });
    else {
      stkStop();
      view = "home";
      render();
    }
  } else if (act === "stkalbum") {
    M = null;
    view = "album";
    albumTab = "stk";
    render();
  } else if (act === "atab") {
    albumTab = v;
    render();
  } else if (act === "stkslot") stkSlotSheet(v);
  else if (act === "stkview") stkView(v);
  else if (act === "stkturn") {
    b.classList.toggle("over");
    sfx.tick();
  } else if (act === "stkchase") {
    const i = S.stk.chase.indexOf(v);
    if (i >= 0) S.stk.chase.splice(i, 1);
    else if (S.stk.chase.length < SR.chaseMax) S.stk.chase.push(v);
    save();
    $("over").innerHTML = "";
    render();
  } else if (act === "stktoken") {
    S.stk.pick = S.stk.pick === v ? "" : v;
    save();
    $("over").innerHTML = "";
    render();
    toast(S.stk.pick ? "Token lined up. Now earn the shot." : "Token kept.");
  }
});
document.addEventListener("change", e => {
  if (e.target.id === "sc") {
    stkClub = e.target.value;
    renderStickers();
  }
});
