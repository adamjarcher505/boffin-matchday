"use strict";
/* ============ grid.js: the Daily Grid ============ */
/* ============ daily grid ============ */
const gridNo = (day = dayKey()) => Math.max(1, Math.round((new Date(day + "T12:00:00") - new Date("2026-11-11T12:00:00")) / 864e5) + 1);
/* Grids from this number on use dailyGridV2 (position headers, weekday difficulty). Earlier ones are rebuilt exactly as they were, so nobody's past grid changes. No. 10 = 20/11/2026. */
const GRID_V2_FROM = 10;
function dailyGridV1(day = dayKey()) {
  const gc = BD.gridClubs.slice(0, 30),
    gn = BD.gridNats.slice(0, 14);
  for (let t = 0; t < 400; t++) {
    const r = rngOf(hash("grid" + day + "-" + t)),
      rows = shuffle(gc, r)
        .slice(0, 3)
        .map(v => ({ t: "c", v })),
      cols = [];
    const c1 = shuffle(
      gc.filter(v => !rows.some(x => x.v === v)),
      r
    );
    cols.push({ t: "c", v: c1[0] });
    cols.push(r() < 0.5 ? { t: "c", v: c1[1] } : { t: "n", v: pickR(gn, r) });
    const x = r();
    cols.push(x < 0.6 ? { t: "n", v: pickR(gn, r) } : x < 0.85 ? { t: "l", v: Math.floor(r() * 5) } : { t: "g", v: 0 });
    if (sameCat(cols[1], cols[2])) continue;
    if (rows.every(a => cols.every(b => validSet(a, b).length >= 4))) return { rows, cols };
  }
  return { rows: [0, 1, 2].map(k => ({ t: "c", v: BD.gridClubs[k] })), cols: [3, 4, 5].map(k => ({ t: "c", v: BD.gridClubs[k] })) };
}
/* the weekday's setting: [club pool, fewest answers a square may have, two nationality columns allowed, label] */
const gridDay = (day = dayKey()) => TUNING.gridDays[new Date(day + "T12:00:00").getDay()];
function dailyGridV2(day = dayKey()) {
  const [nc, minV0, twoNats] = gridDay(day),
    gc = BD.gridClubs.slice(0, nc),
    gn = BD.gridNats.slice(0, 14);
  for (let minV = minV0; minV >= 3; minV--)
    for (let t = 0; t < 400; t++) {
      const r = rngOf(hash("grid2" + day + "-" + minV + "-" + t)),
        rows = shuffle(gc, r)
          .slice(0, 3)
          .map(v => ({ t: "c", v })),
        cols = [],
        c1 = shuffle(
          gc.filter(v => !rows.some(x => x.v === v)),
          r
        );
      cols.push({ t: "c", v: c1[0] });
      cols.push(r() < 0.5 ? { t: "c", v: c1[1] } : { t: "n", v: pickR(gn, r) });
      const x = r();
      // third column: nationality, position (never more than one), a league or 15+ goals
      cols.push(x < 0.4 ? { t: "n", v: pickR(gn, r) } : x < 0.6 ? { t: "p", v: Math.floor(r() * 4) } : x < 0.85 ? { t: "l", v: Math.floor(r() * 5) } : { t: "g", v: 0 });
      if (sameCat(cols[1], cols[2])) continue;
      if (!twoNats && cols[1].t === "n" && cols[2].t === "n") continue;
      if (rows.every(a => cols.every(b => validSet(a, b).length >= minV))) return { rows, cols };
    }
  return dailyGridV1(day);
}
const dailyGrid = (day = dayKey()) => (gridNo(day) < GRID_V2_FROM ? dailyGridV1(day) : dailyGridV2(day));
let GRID = null,
  gridCell = -1;
const gridState = () => {
  const k = dayKey();
  if (!S.grid[k]) {
    S.grid = { [k]: { c: [null, null, null, null, null, null, null, null, null], left: 9, r: [0, 0, 0, 0, 0, 0, 0, 0, 0], xp: 0 } };
  }
  const g = S.grid[k];
  if (!g.h) g.h = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!g.ht) g.ht = [null, null, null, null, null, null, null, null, null];
  return g;
};
/* grid score: each filled square is worth a ninth of 100%, less what its hints cost. Hints on a square you never fill cost nothing (it's already 0). */
/* grid history and streak (18/11/2026). S.gh keeps the last 60 finished days. */
const daysAgo = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};
function recordGrid(g) {
  S.gh = S.gh || {};
  S.gh[dayKey()] = [gridScore(g), g.c.filter(x => x).length, gridHints(g)];
  Object.keys(S.gh).sort().slice(0, -60).forEach(k => delete S.gh[k]);
}
/* consecutive finished days, counting back from today (or from yesterday if today isn't done yet) */
function gridStreak() {
  const gh = S.gh || {};
  let n = 0,
    k = gh[daysAgo(0)] ? 0 : 1;
  while (gh[daysAgo(k)]) {
    n++;
    k++;
  }
  return n;
}
/* average score over the finished days of the last 7, or null */
function gridAvg7() {
  const v = [0, 1, 2, 3, 4, 5, 6].map(k => (S.gh || {})[daysAgo(k)]).filter(x => x);
  return v.length ? Math.round(v.reduce((t, x) => t + x[0], 0) / v.length) : null;
}
function gridFinished(g) {
  recordGrid(g);
  S.st.grids++;
  careerGrid(gridScore(g));
}
const hintCost = n => TUNING.gridHint.slice(0, n).reduce((a, b) => a + b, 0);
const gridScore = g => Math.max(0, Math.round(g.c.reduce((t, v, k) => t + (v ? 100 / 9 - hintCost((g.h || [])[k] || 0) : 0), 0)));
const gridHints = g => (g.h || []).reduce((t, n, k) => t + (g.c[k] ? n : 0), 0);
/* the hint is about one real answer: the best-known player who fits and isn't already on today's grid. Fixed once given. */
function gridHintTarget(k) {
  const g = gridState();
  if (g.ht[k] && KEY2IDX[g.ht[k]] !== undefined) return KEY2IDX[g.ht[k]];
  const a = GRID.rows[Math.floor(k / 3)],
    b = GRID.cols[k % 3],
    v = validSet(a, b)
      .filter(i => !g.c.includes(pkey(i)) && PL[i][3] > 0)
      .sort((x, y) => fame(y) - fame(x));
  if (!v.length) return -1;
  g.ht[k] = pkey(v[0]);
  return v[0];
}
function gridHintText(k) {
  const g = gridState(),
    n = g.h[k],
    i = n ? gridHintTarget(k) : -1;
  if (i < 0) return "";
  const a = GRID.rows[Math.floor(k / 3)],
    b = GRID.cols[k % 3],
    p = PL[i],
    bits = [a.t === "p" || b.t === "p" ? "" : POSN[p[2]], "born in the " + (Math.floor(p[3] / 10) * 10 + 1900) + "s"];
  if (p[1] >= 0 && a.t !== "n" && b.t !== "n") bits.push(NAT[p[1]]);
  else {
    const other = clubsOf(i).find(c => !(a.t === "c" && a.v === c) && !(b.t === "c" && b.v === c));
    if (other !== undefined) bits.push("also played for " + CLUB[other]);
  }
  let h = bits.filter(x => x).join(" · ");
  if (n >= 2) {
    const w = p[0].split(" "),
      sn = w[w.length - 1];
    h += `<br><b>${esc(w.length > 1 ? w[0][0] + ". " : "")}${esc([sn[0]].concat(Array(Math.max(0, sn.length - 1)).fill("_")).join(" "))}</b> (${sn.length} letters)`;
  }
  return h;
}
function gridPick(i) {
  const g = gridState(),
    a = GRID.rows[Math.floor(gridCell / 3)],
    b = GRID.cols[gridCell % 3],
    v = validSetX(a, b);
  if (g.c.includes(pkey(i))) {
    msg("Already used him today.", "");
    return;
  }
  if (PL[i][1] < 0 && b.t === "n" && fits(i, a)) {
    msg("No nationality on file for " + PL[i][0] + ". Try someone else.", "");
    return;
  }
  g.left--;
  if (v.includes(i)) {
    g.c[gridCell] = pkey(i);
    g.r[gridCell] = Math.round(rarity(v, i) * 100);
    addAlbum(i);
    const x = Math.max(10, 20 + Math.round(g.r[gridCell] * 0.3) - TUNING.gridHintXp * g.h[gridCell]);
    g.xp += x;
    addXp(x);
    sfx.goal();
    $("over").innerHTML = "";
    if (g.c.every(x => x) || g.left <= 0) {
      gridFinished(g);
    }
    save(true);
    render();
    toast(PL[i][0] + (g.r[gridCell] >= 70 ? ". Deep cut." : ". In."));
  } else {
    sfx.no();
    save();
    if (g.left <= 0) {
      gridFinished(g);
      save(true);
      $("over").innerHTML = "";
      render();
    } else {
      // say which half failed: he fits one header but not the other
      const fa = fits(i, a),
        fb = fits(i, b),
        miss = fa ? b : a,
        why = fa === fb ? "" : miss.t === "n" || miss.t === "p" ? " isn't " + catPhrase(miss).replace(/^is /, "") + "." : " never " + catPhrase(miss) + ".";
      msg(PL[i][0] + (why ? "?" + why : "? " + pickR(SAY.no)) + " " + g.left + " guesses left.", "bad");
      const q = $("q");
      if (q) {
        q.value = "";
        $("sug").hidden = true;
      }
    }
  }
}
function renderGrid() {
  GRID = GRID && GRID.day === dayKey() ? GRID : Object.assign(dailyGrid(), { day: dayKey() });
  const g = gridState(),
    done = g.left <= 0 || g.c.every(x => x),
    got = g.c.filter(x => x).length,
    obs = got ? Math.round(g.r.reduce((s, x) => s + x, 0) / got) : 0;
  if (done && !(S.gh || {})[dayKey()]) recordGrid(g); // a grid finished before history existed
  let h = `<div class="hd"><h2>Daily Grid No. ${gridNo()}</h2><span class="eyebrow">${done ? "Finished" : g.left + " guesses left"}${gridStreak() >= 2 ? " · 🔥 " + gridStreak() + " days" : ""}</span></div>${gridNo() >= GRID_V2_FROM ? `<p class="gday">${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(dayKey() + "T12:00:00").getDay()]} · ${gridDay()[3]}</p>` : ""}<div class="grid"><div></div>${GRID.cols.map(c => `<div class="gh">${esc(catLabel(c))}</div>`).join("")}`;
  GRID.rows.forEach((a, ri) => {
    h += `<div class="gh">${esc(catLabel(a))}</div>`;
    GRID.cols.forEach((b, ci) => {
      const k = ri * 3 + ci,
        v = g.c[k];
      h += v
        ? `<div class="gc done${g.h[k] ? " hinted" : ""}"><b>${esc(v.split("|")[0])}</b><span>${g.r[k]}% obscure</span>${g.h[k] ? `<i class="hintdot" title="${g.h[k]} hint${g.h[k] > 1 ? "s" : ""}">${g.h[k] > 1 ? "2 hints" : "hint"}</i>` : ""}</div>`
        : done
          ? `<div class="gc"><span style="color:var(--mute)">${esc((x => (x.length ? PL[x[0]][0] : ""))(validSet(a, b).slice().sort((p, q) => fame(q) - fame(p))))}</span></div>`
          : `<button class="gc open" data-act="cell" data-v="${k}" aria-label="${esc(catLabel(a))} and ${esc(catLabel(b))}"><span class="plus">+</span></button>`;
    });
  });
  h += `</div><p class="note">One player per square, nine guesses, nobody twice. Clubs count from 1992 where the records reach; the more obscure the answer, the better.${done ? "" : ` Stuck on a square? Tap it and take a hint, but it costs you: a full grid with no hints is <b>100%</b>, one hint knocks off ${TUNING.gridHint[0]}%.`}</p>`;
  if (done) {
    const sc = gridScore(g),
      nh = gridHints(g);
    h += `<div class="panel pad gscore"><div class="gsc"><span class="eyebrow">Grid score</span><b class="led">${sc}%</b><span class="note">${sc === 100 ? "Perfect. Nine from nine, no help." : got === 9 ? `All nine, with ${nh} hint${nh === 1 ? "" : "s"}.` : nh ? `${got} of 9, ${nh} hint${nh === 1 ? "" : "s"} used.` : `${got} of 9, no hints.`}</span></div><div class="statline"><span><b>${got}</b> of 9</span><span>Hints <b>${nh}</b></span><span>Obscurity <b>${obs}%</b></span><span><b>+${g.xp}</b> XP</span>${gridAvg7() !== null && Object.keys(S.gh).length > 1 ? `<span>Avg 7 days <b>${gridAvg7()}%</b></span>` : ""}</div></div>`;
    h += `<div class="row"><button class="btn line" data-act="sharegrid">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(shareGrid())}" target="_blank" rel="noopener">WhatsApp</a></div><p class="note">Greyed squares show the best-known answer. A new grid lands at midnight.</p>`;
  }
  $("main").innerHTML = h;
}
