"use strict";
/* ============ match.js: the match engine. League, Club Cup and training; chance cover, live chance, verdict, full time ============ */
/* ============ match engine ============ */
let M = null,
  ctx = null,
  raf = 0,
  view = "home",
  leagueTab = "table";
const sum = a => a.reduce((s, x) => s + x, 0);
function toast(t) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = t;
  $("toasts").appendChild(d);
  setTimeout(() => d.remove(), 3300);
}
function msg(t, cls) {
  const m = $("msg");
  if (m) {
    m.textContent = t;
    m.className = "msg " + (cls || "");
  }
}
const QV = "v6." + QB.v + "|"; // question-generator version + question-bank version: ghosts only replay matches built by both
function startLeagueMatch() {
  settleSeason();
  const opp = nextOpponent(),
    tier = tierOf(S.div);
  const fx = QV + S.season + "-" + S.div + "-" + S.week.pl + "-" + S.salt;
  let seed = fx + (S.ab && S.ab.f === fx && S.ab.n ? "~a" + S.ab.n : ""),
    ghost = null;
  if (opp.real && opp.g) {
    const k = Object.keys(opp.g).find(
      k => k.indexOf(QV) === 0 && !S.played.includes(k) && Array.isArray(opp.g[k]) && opp.g[k].length === 5 && k.split("-")[1] === String(S.div)
    );
    if (k) {
      seed = k;
      ghost = opp.g[k];
    }
  }
  if (!ghost) seed = freshSeed(seed, tier);
  const r = rngOf(hash("o" + seed + opp.id)),
    p = Math.max(0.2, Math.min(0.85, 0.3 + 0.05 * S.div + ((opp.s === undefined ? 0.5 : opp.s) - 0.5) * 0.26));
  const oppRes = ghost ? ghost.map(x => (x ? 1 : 0)) : [0, 1, 2, 3, 4].map(() => (r() < p ? 1 : 0));
  M = {
    mode: "league",
    fx,
    seed,
    tier,
    opp,
    oppRes,
    ghost: !!ghost,
    rounds: makeMatch(seed, tier),
    i: 0,
    my: [],
    out: [],
    xp: 0,
    picks: [],
    deep: 0
  };
  view = "match";
  chanceCover();
}
/* ============ club cup: your club's questions, against fellow fans of the same club ============ */
function cupFans() {
  const real = Net.rows
    .filter(r => r && r.c === S.club && r.id !== Net.uid && r.n)
    .map(r => ({ id: r.id, name: String(r.n).slice(0, 18), real: true, s: Math.min(1, (r.xp | 0) / 4000) }));
  const sid = S.club + "-" + S.cup.runs + "-" + S.salt,
    house = shuffle(FANS, rngOf(hash("cf" + sid)))
      .slice(0, 4)
      .map((n, k) => ({ id: "f" + k, name: n, s: [0.3, 0.45, 0.6, 0.75][k] }));
  const rr = shuffle(real, rngOf(hash("cr" + sid)));
  return [0, 1, 2, 3].map(k => (rr[k] ? Object.assign({}, rr[k], { s: Math.max(rr[k].s, house[k].s) }) : house[k]));
}
function cupSync() {
  if (S.cup.club !== S.club) {
    S.cup.club = S.club;
    S.cup.rd = 0;
  }
}
function makeCupMatch(seed, c, tier) {
  const r = rngOf(hash("cup" + seed)),
    out = [],
    used = new Set();
  const order = shuffle(["cell", "squad", "odd", "career", "mates", "top", "race", "xi", "hl", "champ", "season", "quiz", "six", "pals", "fake", "buy", "row", "order", "exact", "pin"], r),
    fam = new Set(),
    failed = new Set();
  // same rules as league matches (pickTypes): one per family, and 2-3 typed / 2-3 tap. Small clubs can't always
  // build enough of one kind, so a second pass drops the typed/tap rule rather than padding with repeat Grids.
  for (const strict of [true, false])
    for (const t of order) {
      if (out.length >= 5) break;
      if (used.has(t) || failed.has(t) || (FAMILY[t] && fam.has(FAMILY[t]))) continue;
      const typed = out.filter(x => isTyped(x.type)).length;
      if (strict && (isTyped(t) ? typed >= 3 : out.length - typed >= 3)) continue;
      const x = makeRound(t, r, tier, { club: c });
      if (x) {
        out.push(x);
        used.add(t);
        if (FAMILY[t]) fam.add(FAMILY[t]);
      } else failed.add(t);
    }
  while (out.length < 5) out.push(makeRound("cell", r, tier, { club: c }) || makeCell(r, tier));
  return out;
}
function startCupMatch() {
  cupSync();
  const c = clubIdx(S.club);
  if (c < 0) {
    toast("Pick a club in your profile first");
    return;
  }
  const rd = S.cup.rd,
    opp = cupFans()[rd],
    tier = Math.min(3, tierOf(S.div) + (rd >= 2 ? 1 : 0)),
    seed = S.club + "-" + S.cup.runs + "-" + rd + "-" + S.salt;
  const r = rngOf(hash("co" + seed)),
    p = Math.max(0.25, Math.min(0.8, 0.3 + 0.08 * rd + (opp.s - 0.5) * 0.3)),
    oppRes = [0, 1, 2, 3, 4].map(() => (r() < p ? 1 : 0));
  M = { mode: "cup", seed, tier, opp, oppRes, rounds: makeCupMatch(seed, c, tier), i: 0, my: [], out: [], xp: 0, picks: [], deep: 0, pr: r, club: c };
  view = "match";
  chanceCover();
}
function cupContinue() {
  const a = M.my.reduce((s, x) => s + x, 0),
    b = M.oppRes.reduce((s, x) => s + x, 0);
  if (a === b && M.rounds.length < 10) {
    const t = pickR(["odd", "race", "champ", "cell"], M.pr);
    M.rounds.push(makeRound(t, M.pr, M.tier, { club: M.club }) || makeRound("cell", M.pr, M.tier, { club: M.club }) || makeCell(M.pr, M.tier));
    M.oppRes.push(M.pr() < 0.6 ? 1 : 0);
    chanceCover();
  } else cupFullTime();
}
function cupFullTime() {
  const a = sum(M.my),
    b = sum(M.oppRes),
    coin = a === b,
    win = coin ? M.pr() < 0.5 : a > b,
    rdName = CUPR[S.cup.rd],
    pens = M.rounds.length > 5;
  const lines = [["Chances", M.xp - (M.tb || 0)]].concat(M.tb ? [["Theme of the day", M.tb]] : []);
  let head, sub;
  if (win) {
    S.cup.w++;
    if (S.cup.rd === 3) {
      S.cup.won++;
      S.cup.best = 4;
      S.cup.rd = 0;
      S.cup.runs++;
      lines.push(["Cup winners", 200]);
      head = "Cup winners";
      sub = "Lift it. Nobody at your club knows more.";
    } else {
      S.cup.rd++;
      S.cup.best = Math.max(S.cup.best, S.cup.rd);
      lines.push(["Through to the " + CUPR[S.cup.rd].toLowerCase(), 40 + 20 * S.cup.rd]);
      head = "Through";
      sub = "Next up: the " + CUPR[S.cup.rd].toLowerCase() + ".";
    }
  } else {
    S.cup.l++;
    S.cup.best = Math.max(S.cup.best, S.cup.rd);
    S.cup.rd = 0;
    S.cup.runs++;
    lines.push(["Cup run", 10]);
    head = "Knocked out";
    sub = "Out in the " + rdName.toLowerCase() + ". A new run starts from the round of 16.";
  }
  const final = head === "Cup winners";
  const career = careerAfter({ mode: "cup", a, b, res: win ? "W" : "L", my: M.my.slice(), types: M.rounds.map(r => r.type), deep: M.deep, newN: M.newN || 0, behind: !!M.behind, cupWin: win, final, pens, opp: M.opp.name }, lines);
  winRunLines(win).forEach(l => lines.push(l));
  const tot = lines.reduce((s, l) => s + l[1], 0),
    xp0 = S.xp;
  addXp(tot, true);
  S.st.goals += a;
  S.st.deep += M.deep;
  logMatch();
  const offer = stkAfterMatch({ mode: "cup", goals: sum(M.my.slice(0, 5)), round: CUPR.indexOf(rdName), deep: M.deep, perfect: M.my.slice(0, 5).every(x => x), won: win, cupWin: win, final });
  save(true);
  sfx.fullTime();
  if (win) setTimeout(() => sfx.cheer(), 900);
  view = "ft";
  SHARE = shareCup({ a, b, opp: M.opp.name, round: rdName, my: M.my, pens, win, out: final ? "won" : win ? "through" : "out", next: win && !final ? CUPR[S.cup.rd] : "" });
  $("main").innerHTML = `${ftHero({ eyebrow: "Club Cup · " + esc(S.club) + " · " + esc(rdName), a, b, opp: M.opp.name, cls: win ? "W" : "L", word: head, note: `${pens ? "After penalties" : "Full time"}${coin ? ", settled on a coin toss" : ""}. ${esc(sub)}` })}
  <div class="vidi" id="vidi"></div>
  ${xpPanel(lines, tot, xp0)}${career}${offer}
  <div class="panel pad"><div class="statline"><span>Cups won <b>${S.cup.won}</b></span><span>Cup ties <b>${S.cup.w}W ${S.cup.l}L</b></span><span>Best <b>${S.cup.best >= 4 ? "Winners" : S.cup.best >= 0 ? CUPR[S.cup.best] : "—"}</b></span></div></div>
  <button class="btn" data-act="cup">${win && !final ? "Play the " + CUPR[S.cup.rd].toLowerCase() : "Start a new cup run"}</button>${shareBtns()}<button class="btn line" data-act="go" data-v="home">Home</button>
  ${reviewHTML()}<div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out
    .map(
      (o, k) =>
        `<div><span class="m">${mnS(k)}</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`
    )
    .join("")}</div></div>`;
  vidi($("vidi"), `FT  ${S.name || "YOU"} ${a}  ${M.opp.name} ${b}${pens ? "  (PENS)" : ""}`);
  ftAnimate(xp0);
  window.scrollTo(0, 0);
}
function startTraining(type) {
  M = {
    mode: "train",
    type,
    tier: tierOf(S.div),
    i: 0,
    my: [],
    out: [],
    xp: 0,
    picks: [],
    rounds: [],
    seedR: rngOf(Math.floor(Math.random() * 4e9))
  };
  view = "match";
  chanceCover();
}
function curSpec() {
  if (M.mode === "train") {
    if (!M.rounds[M.i]) M.rounds[M.i] = M.long ? longSpec() : makeRound(M.type, M.seedR, M.tier, M.seedR() < 0.7 ? { pl: 1 } : null);
  }
  return M.rounds[M.i];
}
function scoreHTML(bShow) {
  const x = `<button class="x" data-act="quit" aria-label="Leave">×</button>`;
  if (M.mode === "train")
    return `<div class="score">${x}<span class="nm">${M.long ? "Extra time" : "Training"}</span><span class="sc">${M.my.filter(v => v).length}/${M.my.length}</span><span class="nm">${esc(M.long ? LONG[M.long].n : TYPES[M.type].n)}</span><span class="min">#${M.i + 1}</span></div>`;
  const a = sum(M.my),
    b = bShow !== undefined ? bShow : sum(M.oppRes.slice(0, M.my.length));
  return `<div class="score${runOf(M.my) >= 3 ? " fire" : ""}">${x}<span class="nm">${esc(S.name || "You")}</span><span class="sc"><b id="sca">${a}</b><i>–</i><b id="scb">${b}</b></span><span class="nm">${esc(M.opp.name)}</span><span class="min">${M.i < M.rounds.length ? mnS(M.i) : "FT"}</span></div>`;
}
function chLbl(min) {
  if (M.mode === "train")
    return M.long ? "Extra time · " + (M.long === "fullsq" ? "3 minutes" : M.long === "fullxi" ? "2½ minutes" : "2 minutes") : "Training";
  if (M.i >= 5) return "Penalty " + (M.i - 4) + " · sudden death";
  return (M.mode === "cup" ? esc(CUPR[S.cup.rd]) + " · " : "") + "Chance " + (M.i + 1) + " of 5" + (min ? " · " + MINS[M.i] + "'" : "");
}
function chanceCover() {
  const app = document.getElementById("app");
  app.classList.remove("q");
  app.classList.add("focus");
  cancelAnimationFrame(raf);
  const spec = curSpec(),
    T = TYPES[spec.type],
    run = RUN[spec.type](spec);
  M.run = run;
  if (M.long) run.rule = LONG[M.long].rule(spec);
  app.dataset.qt = spec.type;
  const first = M.i === 0 && M.mode !== "train",
    intro = first
      ? `<div class="tie"><div class="side">${myCrest()}<b>${esc(S.name || "You")}</b></div><span class="v">v</span><div class="side">${crest(M.opp.name)}<b>${esc(M.opp.name)}</b></div></div>`
      : "";
  const note = `${M.i >= 5 ? "<b>Penalties.</b> Sudden death. Score and hope they miss. " : ""}${limitS(T)} seconds on the clock once you start.${
    M.i === 0 && M.mode === "league" ? " <b>" + esc(M.opp.name) + "</b> " + (M.ghost ? "took these same five chances earlier." : "get five chances of their own.") : ""
  }${M.i === 0 && M.mode === "cup" ? " <b>" + esc(M.opp.name) + "</b> is a " + esc(S.club) + " fan too, so it's all " + esc(S.club) + " questions. Lose and you're out." : ""}`;
  $("main").innerHTML = `<div class="board">${scoreHTML()}<div class="clock"><i id="clk"></i></div>${chanceStrip()}</div>
  <div class="cvwrap">${intro}${situation()}<div class="qhero"><i class="qic">${qart(spec.type)}</i><div class="qht"><span class="eyebrow">${chLbl(true)}</span><b>${esc(M.long ? LONG[M.long].n : T.n)}</b><span>${esc(M.long ? LONG[M.long].d : QDESC[spec.type] || "")}</span></div></div>
  <p class="rule qq">${esc(run.cover || run.rule || T.rule)}${run.hint && !run.cover ? `<span>${esc(run.hint)}</span>` : ""}</p>
  <p class="note cvnote">${note}</p>
  <button class="btn" data-act="take">${M.i === 0 ? "Kick off" : M.i >= 5 ? "Step up" : "Take it"}</button></div>`;
  window.scrollTo(0, 0);
}
function takeChance() {
  const spec = curSpec(),
    T = TYPES[spec.type],
    run = M.run;
  markSeen(spec);
  document.getElementById("app").dataset.qt = spec.type;
  $("main").innerHTML = `<div class="board">${scoreHTML()}<div class="clock"><i id="clk"></i></div>${chanceStrip()}</div>
  <div class="chance"><h3>${esc(T.n)}</h3><span class="eyebrow">${chLbl(false)}</span></div>
  <p class="rule qq">${esc(run.rule || T.rule)}${run.hint ? `<span>${esc(run.hint)}</span>` : ""}</p>
  ${
    T.typed
      ? `<div class="entry"><input id="q" type="text" placeholder="${spec.type === "xi" ? "Type a surname" : "Type a player's name"}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><button type="button" class="clr" id="clr" data-act="clrq" aria-label="Clear" hidden>×</button><div class="sug" id="sug" hidden></div></div>`
      : ""
  }
  <p class="msg" id="msg"></p><div id="rbody"></div><div class="qart">${qart(spec.type)}</div>`;
  document.getElementById("app").classList.add("q");
  ctx = {
    paint: () => {
      const b = $("rbody");
      if (b) b.innerHTML = run.body(false);
      if (run.mount) run.mount();
    },
    done: () => endChance()
  };
  ctx.paint();
  M.t0 = Date.now();
  M.limit = limitS(T) * 1000;
  M.live = true;
  M.sec = 99;
  if (M.i === 0 && M.mode !== "train") sfx.whistle();
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
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}
function tick() {
  if (!M || !M.live) return;
  const left = Math.max(0, M.limit - (Date.now() - M.t0)),
    c = $("clk");
  if (c) {
    c.style.transform = "scaleX(" + left / M.limit + ")";
    c.parentNode.classList.toggle("low", left < 5000);
  }
  // the last five seconds tick
  const sec = Math.ceil(left / 1000);
  if (sec !== M.sec) {
    if (M.sec !== 99 && sec <= 5 && sec > 0) sfx.clock(sec === 1);
    M.sec = sec;
  }
  if (left <= 0) {
    M.timeout = true;
    endChance();
    return;
  }
  raf = requestAnimationFrame(tick);
}
function vidi(el, text) {
  let k = 0;
  el.innerHTML = '<span class="cur"></span>';
  (function step() {
    if (!el.isConnected) return;
    k += 2;
    el.innerHTML = esc(text.slice(0, k)) + '<span class="cur"></span>';
    if (k < text.length) setTimeout(step, 22);
  })();
}
function endChance() {
  if (!M || !M.live) return;
  M.live = false;
  cancelAnimationFrame(raf);
  document.getElementById("app").classList.remove("q");
  const run = M.run,
    res = run.end(),
    spec = curSpec(),
    T = TYPES[spec.type],
    q = $("q"),
    k = M.i,
    train = M.mode === "train";
  if (q) q.blur();
  const bonus = themeHit(spec, res) ? Math.round(res.xp * TUNING.themeBonus) : 0;
  (M.tt = M.tt || []).push(Math.round((Date.now() - (M.t0 || Date.now())) / 100) / 10);
  const a0 = sum(M.my),
    b0 = train ? 0 : sum(M.oppRes.slice(0, k));
  M.my.push(res.goal ? 1 : 0);
  M.xp += res.xp + bonus;
  M.tb = (M.tb || 0) + bonus;
  if (res.deep) M.deep++;
  buzz(res.goal ? [30, 40, 60] : 70);
  let newN = 0;
  (run.picks || []).forEach(i => {
    M.picks.push(i);
    if (addAlbum(i)) newN++;
  });
  M.newN = (M.newN || 0) + newN;
  M.out.push({ n: T.n, goal: res.goal, title: run.title || "" });
  M.rev = (M.rev || []).concat({ n: T.n, rule: run.rule || T.rule, goal: res.goal, html: res.html, after: res.after || (run.review ? run.review() : "") });
  if (!M.long) {
    const t = (S.ts[spec.type] = S.ts[spec.type] || [0, 0]);
    t[0]++;
    if (res.goal) t[1]++;
  }
  let pb = false;
  if (M.long) {
    const n = longCount(run);
    if (n > (S.lb[M.long] || 0)) {
      S.lb[M.long] = n;
      pb = n > 0;
    }
  }
  if (res.goal) sfx.goal();
  else sfx.miss();
  const og = train ? 0 : M.oppRes[k],
    a = a0 + (res.goal ? 1 : 0),
    b = b0 + og;
  if (!train && b > a) M.behind = true;
  if (train) {
    addXp(trainXp((M.long ? 10 + Math.round(res.xp * 0.6) : res.goal ? TUNING.trainGoalXp : TUNING.trainMissXp) + bonus));
    careerTrain(res.goal);
  }
  const last = !train && k === M.rounds.length - 1,
    timedOut = M.timeout && !res.goal,
    streak = runOf(M.my);
  const word = M.long ? (res.goal ? "Full house" : "Final whistle") : res.goal ? "Goal!" : timedOut ? "Time's up" : "No goal";
  const say = M.long ? "" : train ? (res.goal ? pickR(SAY.ok) : timedOut ? pickR(TALK.slow) : "") : commentary({ goal: res.goal, a0, b0, a, run: streak, timedOut });
  const info = `${res.html}${pb ? "<p><b>New personal best.</b></p>" : ""}${bonus ? `<p class="tb">Theme of the day: +${bonus} XP</p>` : ""}${
    newN ? `<p>${newN} new ${newN === 1 ? "name" : "names"} for the album.</p>` : ""
  }`;
  $("main").innerHTML = `<div class="board">${scoreHTML(train ? undefined : b0)}${chanceStrip()}</div>
  <div class="vd ${res.goal ? "goal" : "nogoal"}"><div class="vdnet"></div>${res.goal ? `<div class="sparks">${sparks(14)}</div>` : ""}
    <span class="eyebrow">${train ? "" : mnS(k) + " · "}${esc(T.n)}${!train && streak >= 3 ? " · " + streak + " in a row" : ""}</span>
    <div class="big">${word}</div>${say ? `<p class="vdsay">${esc(say)}</p>` : ""}</div>
  ${train ? "" : `<div class="oppc wait" id="oppc" data-k="${k}"><span class="m">${mnO(k)}</span><b>${esc(M.opp.name)}</b><span class="t">Their turn<em>...</em></span></div>`}
  <div class="vdinfo">${info}</div>
  ${res.after ? `<div class="vdafter">${res.after}</div>` : ""}
  <button class="btn" data-act="cont">${last ? "Full time" : train ? "Next one" : M.mode === "cup" && k >= 4 ? "Carry on" : "Next chance"}</button>${
    train ? `<button class="btn line" data-act="quit">Finish training</button>` : ""
  }`;
  M.timeout = false;
  M.i++;
  if (!train) setTimeout(() => oppReveal(k, og, a, b), still() ? 0 : 1150);
  save();
  window.scrollTo(0, 0);
}
let SHARE = "";
const pips = arr => arr.map(x => (x ? "🟩" : "⬛")).join("");
function shareBtns() {
  return `<div class="row"><button class="btn line" data-act="share">Copy result</button><a class="btn line" href="https://wa.me/?text=${encodeURIComponent(SHARE)}" target="_blank" rel="noopener">WhatsApp</a></div>`;
}
function doShare() {
  const fail = () => {
    $("over").innerHTML =
      `<div class="sheet"><div class="box"><span class="eyebrow">Your result</span><textarea class="sharebox" readonly>${esc(SHARE)}</textarea><p class="note">Press and hold to copy it.</p><button class="btn line" data-act="closeover">Close</button></div></div>`;
  };
  try {
    navigator.clipboard.writeText(SHARE).then(() => toast("Result copied. Paste it in the group chat."), fail);
  } catch (e) {
    fail();
  }
}
function reviewHTML() {
  if (!wide() || !M || !M.rev) return "";
  return `<div class="rvwrap"><div class="hd"><h2>Match review</h2><span class="eyebrow">Every chance in full</span></div><div class="review">${M.rev.map((r, k) => `<div class="panel pad rvc ${r.goal ? "g" : "n"}"><div class="statline"><span>${mnS(k)} · <b>${esc(r.n)}</b></span><span class="o">YOU ${r.goal ? "SCORED" : "MISSED"}${M.oppRes && M.oppRes[k] !== undefined ? " · THEY " + (M.oppRes[k] ? "SCORED" : "MISSED") : ""}</span></div><p class="rule">${esc(r.rule)}</p>${r.html}${r.after}</div>`).join("")}</div></div>`;
}
function fullTime() {
  const a = sum(M.my),
    b = sum(M.oppRes),
    res = a > b ? "W" : a < b ? "L" : "D";
  const rowsB = leagueTable(),
    before = myPos(rowsB),
    oppPos = rowsB.findIndex(r => r.id === M.opp.id) + 1;
  const w = S.week;
  S.wp = { pl: w.pl, w: w.w, d: w.d, l: w.l, gf: w.gf, ga: w.ga, pts: w.pts }; // the table before this match, for the movement arrows
  w.pl++;
  w.gf += a;
  w.ga += b;
  if (res === "W") {
    w.w++;
    w.pts += 3;
  } else if (res === "D") {
    w.d++;
    w.pts++;
  } else w.l++;
  const cw = cwNow();
  cw.gf += a;
  cw.pts += res === "W" ? 3 : res === "D" ? 1 : 0;
  S.form = S.form.concat(res).slice(-5);
  S.g[M.seed] = M.my.slice();
  const gk = Object.keys(S.g);
  while (gk.length > 8) delete S.g[gk.shift()];
  S.played = S.played.concat(M.seed).slice(-60);
  S.st.m++;
  if (res === "W") S.st.w++;
  S.st.goals += a;
  S.st.deep += M.deep;
  const lines = [["Chances", M.xp - (M.tb || 0)]]
    .concat(M.tb ? [["Theme of the day", M.tb]] : [])
    .concat([[res === "W" ? "Win" : res === "D" ? "Draw" : "Turning up", res === "W" ? 60 : res === "D" ? 25 : 10]]);
  if (res === "W" && b === 0) lines.push(["Clean sheet", 20]);
  if (a === 5) lines.push(["Five from five", 40]);
  const rowsA = leagueTable(),
    after = myPos(rowsA),
    around = aroundYou(rowsB, rowsA),
    divName = DIVS[S.div],
    pl = w.pl,
    pts = w.pts,
    table = miniTable(rowsB, rowsA);
  const career = careerAfter({ mode: "league", a, b, res, my: M.my.slice(), types: M.rounds.map(r => r.type), deep: M.deep, newN: M.newN || 0, behind: !!M.behind, oppPos, before, after, opp: M.opp.name }, lines);
  winRunLines(res === "W").forEach(l => lines.push(l));
  const tot = lines.reduce((s, l) => s + l[1], 0),
    xp0 = S.xp;
  addXp(tot, true);
  const ended = settleSeason();
  S.ab = null;
  logMatch();
  const offer = stkAfterMatch({ mode: "league", goals: a, deep: M.deep, perfect: a === 5 && M.my.length === 5, won: res === "W", promoted: ended && S.note.to > S.note.from, title: ended && S.note.pos === 1 });
  if (ended) careerSeason(S.note);
  save(true);
  sfx.fullTime();
  if (res === "W") setTimeout(() => sfx.cheer(), 900);
  const sp = n => (n >= 4 ? ` (${WORDS[n]})` : "");
  view = "ft";
  SHARE = shareLeague({ a, b, res, opp: M.opp.name, div: divName, my: M.my, before, after, pl, pts });
  $("main").innerHTML = `${ftHero({ eyebrow: "Full time · " + esc(divName) + " · Match " + pl + " of " + SEASON, a, b, opp: M.opp.name, cls: res, word: res === "W" ? "Won" : res === "D" ? "Drew" : "Lost", note: esc(pickR(SAY[res])) })}
  <div class="vidi" id="vidi"></div>
  ${ended ? seasonEndHTML(S.note) : table}
  ${xpPanel(lines, tot, xp0)}${career}${offer}
  <button class="btn" data-act="kick">${ended ? "Start the new season" : "Next fixture"}</button>${shareBtns()}<div class="row"><button class="btn line" data-act="go" data-v="league">Table</button><button class="btn line" data-act="go" data-v="home">Home</button></div>
  ${reviewHTML()}<div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out
    .map(
      (o, k) =>
        `<div><span class="m">${MINS[k]}'</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`
    )
    .join("")}</div></div>`;
  vidi($("vidi"), `FT  ${S.name || "YOU"} ${a}${sp(a)}  ${M.opp.name} ${b}${sp(b)}` + (around.length ? "\n" + around.join("\n") : ""));
  ftAnimate(xp0);
  window.scrollTo(0, 0);
}
/* the state of play, shown on the card before each chance (league and cup) */
function situation() {
  if (!M || M.mode === "train" || M.i === 0) return "";
  const a = sum(M.my),
    b = sum(M.oppRes.slice(0, M.my.length)),
    bits = [a > b ? `You lead ${a}–${b}` : a < b ? `${a}–${b} down` : `Level at ${a}–${b}`];
  if (M.i >= 5) bits.push("Penalties");
  else if (M.i === 4) bits.push(a === b ? "Last chance. Win it" : a < b ? "Last chance. Must score" : "Last chance. See it out");
  else if (M.i === 3) bits.push("Second half");
  if (runOf(M.my) >= 3) bits.push("On fire");
  return `<div class="sit">${bits.map(esc).join("<i>·</i>")}</div>`;
}
/* their reply to the chance you just had: revealed a beat later, and the scoreboard catches up */
function oppReveal(k, og, a, b) {
  const el = $("oppc");
  if (!el || !M || +el.dataset.k !== k) return;
  el.className = "oppc in " + (og ? "g" : "n");
  el.innerHTML = `<span class="m">${mnO(k)}</span><b>${og ? "They score" : "They miss"}</b><span class="t">${esc(oppLine(og, a, b, M.opp.name))}</span>`;
  const sb = $("scb");
  if (sb && og) {
    sb.textContent = b;
    sb.classList.add("pop");
  }
  if (og) {
    sfx.oppGoal();
    buzz(90);
  } else sfx.oppMiss();
}
/* ---------- full time: shared by league and cup ---------- */
function ftHero(o) {
  return `<div class="panel ft ${o.cls}"><span class="eyebrow">${o.eyebrow}</span>
  <div class="ftsc"><div class="side">${myCrest()}<span>${esc(S.name || "You")}</span></div><div class="led"><b>${o.a}</b><i>–</i><b>${o.b}</b></div><div class="side">${crest(o.opp)}<span>${esc(o.opp)}</span></div></div>
  <div class="res ${o.cls}">${esc(o.word)}</div><p class="note">${o.note}</p>
  <div class="ftpips">${M.my.map((x, k) => `<i class="${x ? "g" : "n"}${k >= 5 ? " pen" : ""}"></i>`).join("")}</div></div>`;
}
/* the XP lines, then the level bar starting from where you were before this match (from = XP before) */
function xpPanel(lines, tot, from) {
  const f = from === undefined ? S.xp : from,
    lv = levelOf(f);
  return `<div class="panel pad xpp"><div class="lines">${lines
    .map((l, k) => `<div style="--k:${k}"><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`)
    .join("")}<div class="tot" style="--k:${lines.length}"><span>XP</span><b id="xpt" data-to="${tot}">+0</b></div></div>
  <div class="xpl"><div class="statline"><span>Level <b id="xplv">${lv}</b> · <span id="xptl">${esc(rankOf(lv))}</span></span><span id="xpn">${xpToGo(f)}</span></div><div class="bar"><i id="xpb"></i></div><p class="xpnext">${nextRewardLine(levelOf(S.xp))}</p></div></div>`;
}
/* five rows of the table around you, sliding from where they were before the match to where they are now */
function miniTable(before, after) {
  const pa = myPos(after) - 1,
    pb = myPos(before) - 1,
    from = Math.max(0, Math.min(after.length - 5, pa - 2)),
    was = {},
    up = S.div < DIVS.length - 1,
    down = S.div > 0;
  before.forEach((r, i) => (was[r.id] = i));
  const mv = pb - pa;
  return `<div class="panel mt"><div class="mth"><span>${esc(DIVS[S.div])}</span><b class="${mv > 0 ? "up" : mv < 0 ? "dn" : ""}">${
    mv > 0 ? "▲ Up " + mv + " to " + ord(pa + 1) : mv < 0 ? "▼ Down " + -mv + " to " + ord(pa + 1) : "Still " + ord(pa + 1)
  }</b></div><div class="mtr">${after
    .slice(from, from + 5)
    .map((r, j) => {
      const i = from + j,
        d = Math.max(-3, Math.min(3, (was[r.id] === undefined ? i : was[r.id]) - i));
      return `<div class="${r.me ? "me" : ""} ${up && i < 4 ? "up" : down && i >= 16 ? "down" : ""}" style="--d:${d}"><span>${i + 1}</span><span>${esc(r.name)}</span><span>${r.pl}</span><span>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</span><b>${r.pts}</b></div>`;
    })
    .join("")}</div></div>`;
}
/* run the full-time sequence: XP counts up, the bar fills, the table rows settle */
function ftAnimate(from) {
  const t = $("xpt");
  if (t) setTimeout(() => countUp(t, +t.dataset.to, 900, "+"), still() ? 0 : 500);
  animXp(from === undefined ? S.xp : from, S.xp); // fills, rolls over at each level, then the level-up sheet
  requestAnimationFrame(() => {
    const m = document.querySelector(".mtr");
    if (m) setTimeout(() => m.classList.add("go"), still() ? 0 : 700);
  });
}
