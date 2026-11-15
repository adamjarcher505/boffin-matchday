"use strict";
/* ============ career.js: matchday streak, daily objectives, medals and season awards ============
   A layer on top of the game. It never changes a result, the table, promotion, or which questions a seed builds;
   it only watches what happened and pays XP. All numbers are in CAREER below.
   Save fields (added in save v3): S.sk streak, S.ob today's objectives, S.md medals, S.ct lifetime counters,
   S.sn this season's running stats. */
const CAREER = {
  streakXp: 10, // XP per day of streak on the first match of the day...
  streakCap: 7, // ...capped at this many days (so 70 XP a day at most)
  fullSetXp: 75, // all three daily objectives done
  medalXp: { b: 25, s: 60, g: 150 } // bronze, silver, gold
};

/* ---------- matchday streak: days in a row with at least one league or cup match ---------- */
const dayBefore = k => {
  const d = new Date(k + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return dayKey(d);
};
/* the streak as it stands today: it's only alive if you played today or yesterday */
const streakNow = () => (S.sk && (S.sk.d === dayKey() || S.sk.d === dayBefore(dayKey())) ? S.sk.n : 0);
const playedToday = () => !!S.sk && S.sk.d === dayKey();
/* call once per finished match; returns the streak length if this was the first match of the day, else 0 */
function streakTick() {
  const t = dayKey();
  if (S.sk.d === t) return 0;
  S.sk.n = S.sk.d === dayBefore(t) ? S.sk.n + 1 : 1;
  S.sk.d = t;
  S.sk.best = Math.max(S.sk.best || 0, S.sk.n);
  return S.sk.n;
}
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-1.6.6-2.8 1.5-3.8C9 10 10.5 10.5 11 9c.6-2-.5-4.5 1-7z" fill="currentColor"/></svg>';
function streakChip() {
  const n = streakNow();
  if (!n && !(S.sk && S.sk.best)) return "";
  return `<div class="streak${n ? (playedToday() ? " on" : " due") : ""}">${FLAME}<b>${n}</b><span>${n === 1 ? "day" : "days"}${n && !playedToday() ? " · play today to keep it" : n ? " · matchday streak" : " · streak gone. Start again"}</span></div>`;
}

/* ---------- daily objectives: the same three for everyone each day ---------- */
const OBJ = {
  win1: { t: "Win a league match", n: 1, xp: 40, g: "win", on: e => (e.k === "match" && e.mode === "league" && e.res === "W" ? 1 : 0) },
  win2: { t: "Win two matches", n: 2, xp: 60, g: "win", on: e => (e.k === "match" && e.res === "W" ? 1 : 0) },
  play3: { t: "Play three matches", n: 3, xp: 40, g: "play", on: e => (e.k === "match" ? 1 : 0) },
  goals8: { t: "Score eight goals in matches", n: 8, xp: 50, g: "goals", on: e => (e.k === "match" ? e.a : 0) },
  four: { t: "Score four or more in one match", n: 1, xp: 50, g: "goals", on: e => (e.k === "match" && sum(e.my.slice(0, 5)) >= 4 ? 1 : 0) },
  deep: { t: "Score with a deep cut", n: 1, xp: 50, g: "deep", on: e => (e.k === "match" && e.deep > 0 ? 1 : 0) },
  names: { t: "Add five new names to the album", n: 5, xp: 40, g: "names", on: e => (e.k === "match" ? e.newN : 0) },
  cup: { t: "Win a Club Cup tie", n: 1, xp: 50, g: "cup", on: e => (e.k === "match" && e.mode === "cup" && e.res === "W" ? 1 : 0) },
  grid: { t: "Finish today's Daily Grid", n: 1, xp: 40, g: "grid", on: e => (e.k === "grid" ? 1 : 0) },
  train: { t: "Score three times in training", n: 3, xp: 30, g: "train", on: e => (e.k === "train" && e.goal ? 1 : 0) },
  types: { t: "Score from four different question types", n: 4, xp: 50, g: "types", on: (e, ob) => {
    if (e.k !== "match") return 0;
    let add = 0;
    ob.ty = ob.ty || {};
    e.types.forEach((t, k) => { if (e.my[k] && !ob.ty[t]) { ob.ty[t] = 1; add++; } });
    return add;
  } }
};
function objToday(day) {
  const r = rngOf(hash("obj" + (day || dayKey()))),
    out = [];
  for (const id of shuffle(Object.keys(OBJ), r)) {
    if (out.length >= 3) break;
    if (!out.some(x => OBJ[x].g === OBJ[id].g)) out.push(id);
  }
  return out;
}
const objState = () => {
  const d = dayKey();
  if (!S.ob || S.ob.d !== d) S.ob = { d, p: {}, done: {}, all: false };
  return S.ob;
};
/* feed an event to today's objectives; returns the XP lines it earned: [[label, xp], ...] */
function objEvent(e) {
  const ob = objState(),
    ids = objToday(),
    lines = [];
  ids.forEach(id => {
    if (ob.done[id]) return;
    const O = OBJ[id],
      add = O.on(e, ob) || 0;
    if (!add) return;
    ob.p[id] = Math.min(O.n, (ob.p[id] || 0) + add);
    if (ob.p[id] >= O.n) {
      ob.done[id] = 1;
      S.ct.objs = (S.ct.objs || 0) + 1;
      lines.push(["Objective: " + O.t, O.xp]);
    }
  });
  if (!ob.all && ids.every(id => ob.done[id])) {
    ob.all = true;
    S.ct.sets = (S.ct.sets || 0) + 1;
    lines.push(["All three objectives", CAREER.fullSetXp]);
  }
  return lines;
}
function objCard() {
  const ob = objState(),
    ids = objToday(),
    n = ids.filter(id => ob.done[id]).length;
  return `<div class="panel objs"><div class="objh"><span class="eyebrow">Today's objectives</span><span class="eyebrow ${n === 3 ? "ok" : ""}">${n === 3 ? "All done · +" + CAREER.fullSetXp + " XP banked" : n + " of 3 · full set +" + CAREER.fullSetXp + " XP"}</span></div>${ids
    .map(id => {
      const O = OBJ[id],
        p = ob.p[id] || 0,
        done = !!ob.done[id];
      return `<div class="obj${done ? " done" : ""}"><i class="tick">${done ? "✓" : ""}</i><span class="t">${esc(O.t)}${O.n > 1 && !done ? `<em>${p}/${O.n}</em>` : ""}</span><b>+${O.xp}</b><div class="bar"><i style="width:${Math.round((p / O.n) * 100)}%"></i></div></div>`;
    })
    .join("")}</div>`;
}

/* ---------- medals ---------- */
const histSome = f => (S.hist || []).some(f);
const MEDALS = [
  // getting started and wins
  { id: "first", n: "Off the Mark", d: "Win your first league match", t: "b", i: "1", ok: () => S.st.w >= 1 },
  { id: "w10", n: "Ten Up", d: "Win 10 league matches", t: "b", i: "10", ok: () => S.st.w >= 10 },
  { id: "w50", n: "Half Century", d: "Win 50 league matches", t: "s", i: "50", ok: () => S.st.w >= 50 },
  { id: "w100", n: "Centurion", d: "Win 100 league matches", t: "g", i: "100", ok: () => S.st.w >= 100 },
  { id: "m100", n: "Ever Present", d: "Play 100 league matches", t: "s", i: "EP", ok: () => S.st.m >= 100 },
  // in a match
  { id: "five", n: "Five From Five", d: "Score every chance in a match", t: "b", i: "5/5", ok: () => S.ct.five >= 1 },
  { id: "five5", n: "Clinical", d: "Five from five, five times", t: "s", i: "5×5", ok: () => S.ct.five >= 5 },
  { id: "cs", n: "Shut Out", d: "Win a league match to nil", t: "b", i: "0", ok: () => S.ct.cs >= 1 },
  { id: "cs10", n: "Brick Wall", d: "Ten wins to nil", t: "s", i: "0×10", ok: () => S.ct.cs >= 10 },
  { id: "come", n: "Never Say Die", d: "Win a match after going behind", t: "b", i: "↺", ok: () => S.ct.come >= 1 },
  { id: "giant", n: "Giant Killer", d: "Beat the league leaders", t: "s", i: "GK", ok: () => S.ct.giant >= 1 },
  // league
  { id: "promo", n: "Going Up", d: "Win promotion", t: "b", i: "▲", ok: () => histSome(h => h.to > h.d) },
  { id: "promo3", n: "Through the Divisions", d: "Win promotion three times", t: "s", i: "▲3", ok: () => (S.hist || []).filter(h => h.to > h.d).length >= 3 },
  { id: "champ", n: "Champions", d: "Finish top of the table", t: "g", i: "1st", ok: () => histSome(h => h.pos === 1) },
  { id: "inv", n: "Invincible", d: "Go a whole season unbeaten", t: "g", i: "W∞", ok: () => histSome(h => h.l === 0 && h.w + h.dr >= SEASON) },
  { id: "escape", n: "Great Escape", d: "Stay up by finishing 16th", t: "b", i: "16", ok: () => histSome(h => h.pos === 16 && h.d > 0) },
  { id: "fl", n: "Football League", d: "Reach League Two", t: "b", i: "L2", ok: () => S.st.bestDiv >= 2 },
  { id: "top", n: "The Big Time", d: "Reach the Top Flight", t: "s", i: "TF", ok: () => S.st.bestDiv >= 5 },
  { id: "kb", n: "Knows Ball", d: "Reach the summit of the pyramid", t: "g", i: "KB", ok: () => S.st.bestDiv >= 7 },
  // cup
  { id: "cup1", n: "Silverware", d: "Win the Club Cup", t: "s", i: "CUP", ok: () => S.cup.won >= 1 },
  { id: "cup3", n: "Cup Specialist", d: "Win the Club Cup three times", t: "g", i: "CUP3", ok: () => S.cup.won >= 3 },
  { id: "pens", n: "Nerves of Steel", d: "Win a cup tie on penalties", t: "b", i: "PEN", ok: () => S.ct.pens >= 1 },
  // knowledge
  { id: "deep10", n: "Anorak", d: "Score with 10 deep cuts", t: "b", i: "DC", ok: () => S.st.deep >= 10 },
  { id: "deep50", n: "Proper Boffin", d: "Score with 50 deep cuts", t: "g", i: "DC50", ok: () => S.st.deep >= 50 },
  { id: "alb100", n: "Scout", d: "100 names in the album", t: "b", i: "100", ok: () => Object.keys(S.album).length >= 100 },
  { id: "alb500", n: "Chief Scout", d: "500 names in the album", t: "s", i: "500", ok: () => Object.keys(S.album).length >= 500 },
  { id: "alb1k", n: "Encyclopaedia", d: "1,000 names in the album", t: "g", i: "1K", ok: () => Object.keys(S.album).length >= 1000 },
  { id: "grid9", n: "Nine From Nine", d: "A perfect Daily Grid, no hints", t: "s", i: "9/9", ok: () => S.ct.gridp >= 1 },
  { id: "grid10", n: "Grid Regular", d: "Finish 10 Daily Grids", t: "b", i: "▦", ok: () => S.st.grids >= 10 },
  { id: "stk10", n: "Collector", d: "Stick in 10 stickers", t: "b", i: "S10", ok: () => stkCount() >= 10 },
  { id: "stk50", n: "Got, Got, Need", d: "Stick in 50 stickers", t: "s", i: "S50", ok: () => stkCount() >= 50 },
  // habit
  { id: "sk3", n: "Regular", d: "A three-day matchday streak", t: "b", i: "3d", ok: () => (S.sk.best || 0) >= 3 },
  { id: "sk7", n: "Season Ticket", d: "A seven-day matchday streak", t: "s", i: "7d", ok: () => (S.sk.best || 0) >= 7 },
  { id: "sk30", n: "Part of the Furniture", d: "A thirty-day matchday streak", t: "g", i: "30d", ok: () => (S.sk.best || 0) >= 30 },
  { id: "obj10", n: "Box Ticker", d: "Complete 10 daily objectives", t: "b", i: "✓10", ok: () => (S.ct.objs || 0) >= 10 },
  { id: "set5", n: "Full Set", d: "All three objectives in a day, five times", t: "s", i: "3/3", ok: () => (S.ct.sets || 0) >= 5 },
  { id: "lv10", n: "Double Figures", d: "Reach level 10", t: "b", i: "L10", ok: () => levelOf(S.xp) >= 10 },
  { id: "lv25", n: "Old Hand", d: "Reach level 25", t: "s", i: "L25", ok: () => levelOf(S.xp) >= 25 }
];
const TIERN = { b: "Bronze", s: "Silver", g: "Gold" };
/* award anything newly earned; returns the new medals. silent = no XP and no fanfare (used at start-up, so an
   existing player's cabinet fills with what they'd already done without a burst of toasts). */
function medalCheck(silent) {
  const out = [];
  MEDALS.forEach(m => {
    if (S.md[m.id]) return;
    let ok = false;
    try {
      ok = !!m.ok();
    } catch (e) {}
    if (ok) {
      S.md[m.id] = dayKey();
      out.push(m);
    }
  });
  return silent ? [] : out;
}
const medalDisc = (m, got) => `<i class="disc ${got ? m.t : "lock"}"><b>${m.i}</b></i>`;
function medalsHTML() {
  const got = MEDALS.filter(m => S.md[m.id]).length;
  return `<div class="counts"><div class="panel ct"><b>${got}</b><span>Medals</span></div><div class="panel ct"><b>${MEDALS.length}</b><span>To win</span></div><div class="panel ct"><b>${S.sk.best || 0}</b><span>Best streak</span></div></div>
  <div class="medals">${MEDALS.slice()
    .sort((a, b) => !!S.md[b.id] - !!S.md[a.id])
    .map(m => {
      const g = S.md[m.id];
      return `<div class="panel medal${g ? " got" : ""}">${medalDisc(m, g)}<b>${esc(m.n)}</b><span>${esc(m.d)}</span><em>${g ? TIERN[m.t] + " · " + g.split("-").reverse().join("/") : TIERN[m.t]}</em></div>`;
    })
    .join("")}</div>`;
}

/* ---------- hooks ---------- */
/* after a league or cup match. Adds XP lines to `lines` and returns the HTML for the full-time screen. */
function careerAfter(e, lines) {
  e.k = "match";
  const bits = [];
  if (e.mode === "league") {
    if (e.res === "W" && e.b === 0) S.ct.cs = (S.ct.cs || 0) + 1;
    if (e.res === "W" && e.behind) S.ct.come = (S.ct.come || 0) + 1;
    if (e.res === "W" && e.oppPos === 1) S.ct.giant = (S.ct.giant || 0) + 1;
    // this season's running numbers, for the awards at the end
    const sn = (S.sn = S.sn || { ty: {} });
    sn.ty = sn.ty || {};
    e.types.forEach((t, k) => {
      const x = (sn.ty[t] = sn.ty[t] || [0, 0]);
      x[0]++;
      if (e.my[k]) x[1]++;
    });
    if (e.res === "W" && (!sn.best || e.a - e.b > sn.best[0] - sn.best[1] || (e.a - e.b === sn.best[0] - sn.best[1] && e.a > sn.best[0]))) sn.best = [e.a, e.b, e.opp];
    sn.cs = (sn.cs || 0) + (e.res === "W" && e.b === 0 ? 1 : 0);
    sn.deep = (sn.deep || 0) + e.deep;
  }
  if (e.mode === "cup" && e.cupWin && e.pens) S.ct.pens = (S.ct.pens || 0) + 1;
  if (sum(e.my.slice(0, 5)) === 5) S.ct.five = (S.ct.five || 0) + 1;
  if (e.res === "W" && e.behind) bits.push(`<div class="cline"><i>↺</i><span><b>Comeback.</b> Behind, then won it.</span></div>`);
  const n = streakTick();
  if (n > 1) lines.push(["Matchday streak, day " + n, CAREER.streakXp * Math.min(n, CAREER.streakCap)]);
  objEvent(e).forEach(l => lines.push(l));
  const got = medalCheck();
  got.forEach(m => lines.push(["Medal: " + m.n, CAREER.medalXp[m.t]]));
  if (got.length) setTimeout(() => sfx.medal(), 1600);
  const ob = objState(),
    ids = objToday();
  return `${got.length ? `<div class="panel newmedals"><span class="eyebrow">${got.length === 1 ? "New medal" : got.length + " new medals"}</span>${got.map(m => `<div class="nm">${medalDisc(m, true)}<div><b>${esc(m.n)}</b><span>${esc(m.d)}</span></div></div>`).join("")}</div>` : ""}
  <div class="panel pad ftcareer">${bits.join("")}<div class="cline${n ? " hot" : ""}"><i class="fl">${FLAME}</i><span><b>${streakNow()} day${streakNow() === 1 ? "" : "s"}</b> matchday streak${n > 1 ? ". Kept alive." : n === 1 ? ". Started today." : ""}</span></div>
  <div class="cline"><i>${ids.filter(id => ob.done[id]).length}/3</i><span>${ids.map(id => `<em class="${ob.done[id] ? "done" : ""}">${esc(OBJ[id].t)}${ob.done[id] || OBJ[id].n < 2 ? "" : " " + (ob.p[id] || 0) + "/" + OBJ[id].n}</em>`).join("")}</span></div></div>`;
}
function careerTrain(goal) {
  const lines = objEvent({ k: "train", goal });
  lines.forEach(l => {
    addXp(l[1]);
    toast(l[0] + " +" + l[1] + " XP");
  });
}
/* the Daily Grid has just finished (score = 0-100) */
function careerGrid(score) {
  if (score >= 100) S.ct.gridp = (S.ct.gridp || 0) + 1;
  const lines = objEvent({ k: "grid", score });
  medalCheck().forEach(m => lines.push(["Medal: " + m.n, CAREER.medalXp[m.t]]));
  lines.forEach(l => {
    addXp(l[1]);
    toast(l[0] + " +" + l[1] + " XP");
  });
}
/* a season has just been settled: hang this season's numbers on the note for the season card, and start afresh */
function careerSeason(note) {
  if (note && S.sn) note.sn = S.sn;
  S.sn = { ty: {} };
}
/* extra lines for the season card: read straight off what was recorded during the season */
function seasonAwards(n) {
  const sn = n && n.sn;
  if (!sn) return "";
  const rows = [];
  if (sn.best) rows.push(["Biggest win", `${sn.best[0]}–${sn.best[1]} v ${esc(sn.best[2])}`]);
  const ty = Object.keys(sn.ty || {})
    .map(k => ({ k, a: sn.ty[k][0], g: sn.ty[k][1] }))
    .filter(x => x.a >= 3 && TYPES[x.k])
    .sort((x, y) => y.g / y.a - x.g / x.a || y.a - x.a);
  if (ty.length) rows.push(["Banker", `${TYPES[ty[0].k].n}, ${ty[0].g} of ${ty[0].a}`]);
  if (ty.length > 1) rows.push(["Bogey round", `${TYPES[ty[ty.length - 1].k].n}, ${ty[ty.length - 1].g} of ${ty[ty.length - 1].a}`]);
  if (sn.cs) rows.push(["Wins to nil", String(sn.cs)]);
  if (sn.deep) rows.push(["Deep cuts", String(sn.deep)]);
  return rows.length ? `<div class="awards">${rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>` : "";
}
