"use strict";
/* ============ match.js: the match engine. League, Club Cup and training; chance cover, live chance, verdict, full time ============ */
/* ============ match engine ============ */
let M = null,
  ctx = null,
  raf = 0,
  view = "home",
  leagueTab = "table";
const sfx = (() => {
  let ac = null;
  const tone = (f, d, v = 0.04, type = "triangle", w = 0) => {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(v, ac.currentTime + w);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + w + d);
      o.connect(g);
      g.connect(ac.destination);
      o.start(ac.currentTime + w);
      o.stop(ac.currentTime + w + d);
    } catch (e) {}
  };
  return {
    tick: () => tone(740, 0.07),
    no: () => tone(150, 0.18, 0.05, "sawtooth"),
    goal: () => {
      tone(523, 0.12, 0.06);
      tone(784, 0.22, 0.06, "triangle", 0.1);
    },
    whistle: () => {
      tone(2100, 0.5, 0.02, "sine");
      tone(2140, 0.5, 0.02, "sine");
    }
  };
})();
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
const QV = "v4." + QB.v + "|"; // question-generator version + question-bank version: ghosts only replay matches built by both
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
  const order = shuffle(["cell", "squad", "odd", "career", "mates", "top", "race", "xi", "hl", "champ", "season", "quiz"], r);
  for (const t of order) {
    if (out.length >= 5) break;
    if ((t === "season" && used.has("champ")) || (t === "champ" && used.has("season"))) continue;
    const x = makeRound(t, r, tier, { club: c });
    if (x) {
      out.push(x);
      used.add(t);
    }
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
  const a = M.my.reduce((s, x) => s + x, 0),
    b0 = M.oppRes.reduce((s, x) => s + x, 0),
    coin = a === b0,
    win = coin ? M.pr() < 0.5 : a > b0,
    b = b0,
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
  const tot = lines.reduce((s, l) => s + l[1], 0);
  addXp(tot);
  S.st.goals += a;
  S.st.deep += M.deep;
  logMatch();
  const offer = stkAfterMatch({
    mode: "cup",
    goals: M.my.slice(0, 5).reduce((x, y) => x + y, 0),
    round: CUPR.indexOf(rdName),
    deep: M.deep,
    perfect: M.my.slice(0, 5).every(x => x),
    won: win,
    cupWin: win,
    final: head === "Cup winners"
  });
  save(true);
  sfx.whistle();
  const lv = levelOf(S.xp),
    l0 = levelAt(lv - 1),
    l1 = levelAt(lv);
  view = "ft";
  SHARE = shareCup({
    a,
    b,
    opp: M.opp.name,
    round: rdName,
    my: M.my,
    pens,
    win,
    out: head === "Cup winners" ? "won" : win ? "through" : "out",
    next: win && head !== "Cup winners" ? CUPR[S.cup.rd] : ""
  });
  $("main").innerHTML =
    `<div class="panel ft"><span class="eyebrow">Club Cup · ${esc(S.club)} · ${esc(rdName)}</span><div class="res ${win ? "W" : "L"}">${esc(head)}</div><p class="note">${a}–${b}${pens ? " after penalties" : ""}${coin ? ", settled on a coin toss" : ""}. ${esc(sub)}</p></div>
  <div class="vidi" id="vidi"></div>${offer}
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${tot}</b></div></div><div style="margin-top:10px"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(l1 - S.xp)}</b> XP to level ${lv + 1}</span></div><div class="bar" style="margin-top:6px"><i id="xpb"></i></div></div></div>
  <div class="panel pad"><div class="statline"><span>Cups won <b>${S.cup.won}</b></span><span>Cup ties <b>${S.cup.w}W ${S.cup.l}L</b></span><span>Best <b>${S.cup.best >= 4 ? "Winners" : S.cup.best >= 0 ? CUPR[S.cup.best] : "—"}</b></span></div></div>
  <button class="btn" data-act="cup">${win && head !== "Cup winners" ? "Play the " + CUPR[S.cup.rd].toLowerCase() : "Start a new cup run"}</button>${shareBtns()}<button class="btn line" data-act="go" data-v="home">Home</button>
  ${reviewHTML()}<div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out.map((o, k) => `<div><span class="m">${mnS(k)}</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`).join("")}</div></div>`;
  vidi($("vidi"), `FT  ${S.name || "YOU"} ${a}  ${M.opp.name} ${b}${pens ? "  (PENS)" : ""}`);
  requestAnimationFrame(() => {
    const x = $("xpb");
    if (x) x.style.width = Math.max(2, Math.min(100, ((S.xp - l0) / (l1 - l0)) * 100)) + "%";
  });
  window.scrollTo(0, 0);
}
function cupCard() {
  cupSync();
  const rd = S.cup.rd,
    opp = cupFans()[rd];
  return `<div class="panel fix"><div class="statline"><span>Club Cup · ${esc(S.club)} fans only</span><span>Cups won <b>${S.cup.won}</b></span></div>
   <div class="vs"><div class="t">${esc(S.name || "You")}<small>${esc(S.club)} fan</small></div><div class="v">v</div><div class="t">${esc(opp.name)}<small>${opp.real ? "REAL FAN" : esc(S.club).toUpperCase() + " FAN" + (Net.ready ? "" : " · HOUSE")}</small></div></div>
   <div class="cupsteps">${CUPR.map((n, k) => `<i class="${k < rd ? "done" : k === rd ? "on" : ""}">${["R16", "QF", "SF", "Final"][k]}</i>`).join("")}</div>
   <button class="btn line" data-act="cup">Play the ${esc(CUPR[rd].toLowerCase())}<small>Five ${esc(S.club)} questions. Lose and you're out.</small></button></div>`;
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
function scoreHTML() {
  if (M.mode === "train")
    return `<div class="score"><button class="x" data-act="quit" aria-label="Leave">×</button><span class="nm">${M.long ? "Extra time" : "Training"}</span><span class="sc">${M.my.filter(x => x).length}/${M.my.length}</span><span class="nm">${esc(M.long ? LONG[M.long].n : TYPES[M.type].n)}</span><span class="min">#${M.i + 1}</span></div>`;
  const a = M.my.reduce((s, x) => s + x, 0),
    b = M.oppRes.slice(0, M.my.length).reduce((s, x) => s + x, 0);
  return `<div class="score"><button class="x" data-act="quit" aria-label="Leave">×</button><span class="nm">${esc(S.name || "You")}</span><span class="sc">${a}–${b}</span><span class="nm">${esc(M.opp.name)}</span><span class="min">${M.i < M.rounds.length ? mnS(M.i) : "FT"}</span></div>`;
}
function chLbl(min) {
  if (M.mode === "train")
    return M.long ? "Extra time · " + (M.long === "fullsq" ? "3 minutes" : M.long === "fullxi" ? "2½ minutes" : "2 minutes") : "Training";
  if (M.i >= 5) return "Penalty " + (M.i - 4) + " · sudden death";
  return (M.mode === "cup" ? esc(CUPR[S.cup.rd]) + " · " : "") + "Chance " + (M.i + 1) + " of 5" + (min ? " · " + MINS[M.i] + "'" : "");
}
function chanceCover() {
  document.getElementById("app").classList.remove("q");
  document.getElementById("app").classList.add("focus");
  cancelAnimationFrame(raf);
  const spec = curSpec(),
    T = TYPES[spec.type],
    run = RUN[spec.type](spec);
  M.run = run;
  if (M.long) run.rule = LONG[M.long].rule(spec);
  document.getElementById("app").dataset.qt = spec.type;
  $("main").innerHTML = `<div class="board">${scoreHTML()}<div class="clock"><i id="clk"></i></div>${chanceStrip()}</div>
  <div class="cvwrap"><div class="qhero"><i class="qic">${qart(spec.type)}</i><div class="qht"><span class="eyebrow">${chLbl(true)}</span><b>${esc(M.long ? LONG[M.long].n : T.n)}</b><span>${esc(M.long ? LONG[M.long].d : QDESC[spec.type] || "")}</span></div></div>
  <p class="rule qq">${esc(run.rule || T.rule)}${run.hint ? `<span>${esc(run.hint)}</span>` : ""}</p>
  <div class="panel pad"><p class="note">${M.i >= 5 ? "<b>Penalties.</b> Sudden death. Score and hope they miss. " : ""}${limitS(T)} seconds on the clock once you start.${M.i === 0 && M.mode === "league" ? " <b>" + esc(M.opp.name) + "</b> " + (M.ghost ? "took these same five chances earlier." : "get five chances of their own.") : ""}${M.i === 0 && M.mode === "cup" ? " <b>" + esc(M.opp.name) + "</b> is a " + esc(S.club) + " fan too, so it's all " + esc(S.club) + " questions. Lose and you're out." : ""}</p></div>
  <button class="btn" data-act="take">${M.i === 0 ? "Kick off" : "Take it"}</button></div>`;
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
  ${T.typed ? `<div class="entry"><input id="q" type="text" placeholder="${spec.type === "xi" ? "Type a surname" : "Type a player's name"}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><button type="button" class="clr" id="clr" data-act="clrq" aria-label="Clear" hidden>×</button><div class="sug" id="sug" hidden></div></div>` : ""}
  <p class="msg" id="msg"></p><div id="rbody"></div><div class="qart">${qart(spec.type)}</div>`;
  document.getElementById("app").classList.add("q");
  ctx = {
    paint: () => {
      const b = $("rbody");
      if (b) b.innerHTML = run.body(false);
    },
    done: () => endChance()
  };
  ctx.paint();
  M.t0 = Date.now();
  M.limit = limitS(T) * 1000;
  M.live = true;
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
    q = $("q");
  if (q) q.blur();
  const bonus = themeHit(spec, res) ? Math.round(res.xp * TUNING.themeBonus) : 0;
  (M.tt = M.tt || []).push(Math.round((Date.now() - (M.t0 || Date.now())) / 100) / 10);
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
  M.out.push({ n: T.n, goal: res.goal, title: run.title || "" });
  M.rev = (M.rev || []).concat({
    n: T.n,
    rule: run.rule || T.rule,
    goal: res.goal,
    html: res.html,
    after: res.after || (run.review ? run.review() : "")
  });
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
  else sfx.no();
  const train = M.mode === "train",
    og = train ? 0 : M.oppRes[M.i],
    a = M.my.reduce((s, x) => s + x, 0),
    b = train ? 0 : M.oppRes.slice(0, M.i + 1).reduce((s, x) => s + x, 0);
  if (train) addXp(trainXp((M.long ? 10 + Math.round(res.xp * 0.6) : res.goal ? TUNING.trainGoalXp : TUNING.trainMissXp) + bonus));
  const last = !train && M.i === M.rounds.length - 1;
  $("main").innerHTML = `<div class="board">${scoreHTML()}</div>
  <div class="verdict ${res.goal ? "goal" : "nogoal"}"><div class="big">${M.long ? (res.goal ? "Full house" : "Final whistle") : res.goal ? "Goal" : M.timeout && !res.goal ? "Time's up" : "No goal"}</div>${res.html}${pb ? "<p><b>New personal best.</b></p>" : ""}${bonus ? `<p class="tb">Theme of the day: +${bonus} XP</p>` : ""}${M.timeout && !res.goal && !M.long ? `<p>${esc(pickR(SAY.slow))}</p>` : ""}${newN ? `<p>${newN} new ${newN === 1 ? "name" : "names"} for the album.</p>` : ""}</div>
  ${res.after ? `<div>${res.after}</div>` : ""}
  ${train ? "" : `<div class="vidi" id="vidi"></div>`}
  <button class="btn" data-act="cont">${last ? "Full time" : train ? "Next one" : "Next chance"}</button>${train ? `<button class="btn line" data-act="quit">Finish training</button>` : ""}`;
  M.timeout = false;
  M.i++;
  if (!train)
    vidi(
      $("vidi"),
      `${mnS(M.i - 1)} ${res.goal ? "GOAL " + (S.name || "YOU") : "CHANCE MISSED " + (S.name || "YOU")}\n${mnO(M.i - 1)} ${og ? "GOAL " + M.opp.name : M.opp.name + " WASTE THEIRS"}\n${S.name || "YOU"} ${a} ${M.opp.name} ${b}`
    );
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
  const a = M.my.reduce((s, x) => s + x, 0),
    b = M.oppRes.reduce((s, x) => s + x, 0),
    res = a > b ? "W" : a < b ? "L" : "D";
  const rowsB = leagueTable(),
    before = myPos(rowsB);
  const w = S.week;
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
  const tot = lines.reduce((s, l) => s + l[1], 0);
  addXp(tot);
  const rowsA = leagueTable(),
    after = myPos(rowsA),
    around = aroundYou(rowsB, rowsA),
    divName = DIVS[S.div],
    pl = w.pl,
    pts = w.pts,
    ended = settleSeason();
  S.ab = null;
  logMatch();
  const offer = stkAfterMatch({
    mode: "league",
    goals: a,
    deep: M.deep,
    perfect: a === 5 && M.my.length === 5,
    won: res === "W",
    promoted: ended && S.note.to > S.note.from
  });
  save(true);
  sfx.whistle();
  const sp = n => (n >= 4 ? ` (${WORDS[n]})` : ""),
    lv = levelOf(S.xp),
    l0 = levelAt(lv - 1),
    l1 = levelAt(lv);
  view = "ft";
  SHARE = shareLeague({ a, b, res, opp: M.opp.name, div: divName, my: M.my, before, after, pl, pts });
  $("main").innerHTML =
    `<div class="panel ft"><span class="eyebrow">Full time · ${esc(divName)}</span><div class="res ${res}">${res === "W" ? "Won" : res === "D" ? "Drew" : "Lost"} ${a}–${b}</div><p class="note">${esc(pickR(SAY[res]))}</p></div>
  <div class="vidi" id="vidi"></div>${offer}
  <div class="panel pad"><div class="lines">${lines.map(l => `<div><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join("")}<div class="tot"><span>XP</span><b>+${tot}</b></div></div><div style="margin-top:10px"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(l1 - S.xp)}</b> XP to level ${lv + 1}</span></div><div class="bar" style="margin-top:6px"><i id="xpb"></i></div></div></div>
  <div class="panel pad"><div class="statline"><span>${esc(divName)} · ${pl} of ${SEASON} played</span><span><b>${ord(after)}</b> of 20${after < before ? " · up " + (before - after) : after > before ? " · down " + (after - before) : ""}</span><span><b>${pts}</b> pts</span></div></div>
  ${ended ? seasonEndHTML(S.note) : ""}
  <button class="btn" data-act="kick">${ended ? "Start the new season" : "Next fixture"}</button>${shareBtns()}<div class="row"><button class="btn line" data-act="go" data-v="league">Table</button><button class="btn line" data-act="go" data-v="home">Home</button></div>
  ${reviewHTML()}<div class="hd"><h2>How it went</h2></div><div class="panel pad"><div class="recap">${M.out.map((o, k) => `<div><span class="m">${MINS[k]}'</span><span>${esc(o.n)}${o.title ? " · " + esc(o.title) : ""}</span><span class="o ${o.goal ? "g" : "n"}">YOU ${o.goal ? "SCORED" : "MISSED"} · THEY ${M.oppRes[k] ? "SCORED" : "MISSED"}</span></div>`).join("")}</div></div>`;
  vidi($("vidi"), `FT  ${S.name || "YOU"} ${a}${sp(a)}  ${M.opp.name} ${b}${sp(b)}` + (around.length ? "\n" + around.join("\n") : ""));
  requestAnimationFrame(() => {
    const x = $("xpb");
    if (x) x.style.width = Math.max(2, Math.min(100, ((S.xp - l0) / (l1 - l0)) * 100)) + "%";
  });
  window.scrollTo(0, 0);
}
