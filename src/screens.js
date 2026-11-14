"use strict";
/* ============ screens.js: header and tabs, home, league, album, stats, profile and other sheets ============ */
/* ============ screens ============ */
const wide = () => window.matchMedia("(min-width: 1024px)").matches;
function chrome() {
  const me = meB();
  $("who").innerHTML = `<b>${esc(S.name || "Sign on")}</b>${badgeHTML(me, wide() ? "" : "xs")}<span class="lv">LV ${levelOf(S.xp)}</span>`;
  document.body.classList.toggle("kit-gold", badgeOf(me) === "fd" && S.kit !== false);
  const g = S.grid[dayKey()],
    gridOpen = !g || (g.left > 0 && !g.c.every(x => x));
  $("tabs").innerHTML = [
    ["home", "Matchday"],
    ["league", "League"],
    ["grid", "Grid"],
    ["album", "Album"]
  ]
    .concat(wide() ? [["stats", "Stats"]] : [])
    .map(
      t =>
        `<button class="tab ${view === t[0] ? "on" : ""}" data-act="go" data-v="${t[0]}">${t[1]}${t[0] === "grid" && gridOpen ? "<em></em>" : ""}</button>`
    )
    .join("");
  document.getElementById("app").classList.toggle("focus", view === "match" || view === "ft" || view === "stk");
  if (view !== "match" && view !== "stk") document.getElementById("app").classList.remove("q");
}
const noteText = () =>
  S.note
    ? `You finished <b>${ord(S.note.pos)}</b> with ${S.note.pts} points. ${S.note.to > S.note.from ? "Promoted to <b>" + esc(DIVS[S.note.to]) + "</b>. Onwards." : S.note.to < S.note.from ? "Relegated to <b>" + esc(DIVS[S.note.to]) + "</b>. It happens to the best of them." : "You stay in <b>" + esc(DIVS[S.note.to]) + "</b>."}`
    : "";
function countdown() {
  const left = (7 - daysIn()) * 24;
  return left >= 24 ? Math.floor(left / 24) + "d " + Math.floor(left % 24) + "h" : Math.floor(left) + "h " + pad(Math.floor((left * 60) % 60)) + "m";
}
function renderHome() {
  const rows = leagueTable(),
    pos = myPos(rows),
    opp = nextOpponent(),
    lv = levelOf(S.xp),
    l0 = levelAt(lv - 1),
    l1 = levelAt(lv);
  const fourth = rows[3],
    gap = pos <= 4 ? 0 : fourth.pts - S.week.pts,
    g = S.grid[dayKey()],
    gdone = g && (g.left <= 0 || g.c.every(x => x));
  const zone =
    S.div < DIVS.length - 1 && pos <= 4
      ? "In the promotion places"
      : S.div > 0 && pos >= 17
        ? "In the drop zone"
        : S.div < DIVS.length - 1
          ? gap > 0
            ? gap + (gap === 1 ? " pt" : " pts") + " off promotion"
            : "Level on points with 4th"
          : "Top division";
  const pNote = `${S.note ? `<div class="panel pad" style="border-color:var(--amber)"><span class="eyebrow" style="color:var(--amber)">Last season</span><p class="note" style="margin-top:6px">${noteText()}</p><button class="linkb" data-act="clearnote">Dismiss</button></div>` : ""}`;
  const pFix = `<div class="panel fix${runIn() ? " fday" : ""}">${runIn() ? `<div class="fdtag">${runInLabel()}</div>` : ""}<div class="statline"><span>${esc(DIVS[S.div])} · Season ${S.season}</span><span>Match <b>${S.week.pl + 1}</b> of ${SEASON}</span></div>
   <div class="vs"><div class="t">${esc(S.name || "You")}<small>${esc(S.club)} · ${ord(pos)}</small></div><div class="v">v</div><div class="t">${esc(opp.name)}<small>${opp.real ? "REAL PLAYER" : "HOUSE SIDE"} · ${ord(rows.findIndex(r => r.id === opp.id) + 1)}</small></div></div>
   <button class="btn" data-act="kick">Kick off<small>Five chances each. About 90 seconds.</small></button>
   <div class="statline"><span class="form">${S.form.length ? S.form.map(f => `<i class="${f}">${f}</i>`).join("") : "<span>No form yet</span>"}</span><span><b>${zone}</b></span></div></div>`;
  const pOff =
    Net.checked && Net.canSignIn() && !Net.uid
      ? `<div class="panel pad"><p class="note"><b>Not signed in.</b> Your progress only lives on this device. Sign in to keep it safe, play on any device and count in the shared tables.</p><button class="btn line sm" style="margin-top:10px" data-act="profile">Sign in</button></div>`
      : Net.checked && !Net.ready
        ? `<div class="panel pad"><p class="note"><b>Playing offline.</b> Your progress saves on this device, but your results won't show in your mates' tables and your opponents are house sides. Share your result after a match to show off.</p></div>`
        : "";
  const pGrid = `<button class="panel li" data-act="go" data-v="grid" style="border-radius:6px"><span class="k">${gridNo()}</span><span class="tx"><b>Daily Grid</b><span>${gdone ? "Done for today. " + g.c.filter(x => x).length + " of 9, scored " + gridScore(g) + "%." : g ? g.left + " guesses left. Finish the job." : "Nine squares, nine guesses. Same grid for everyone."}</span></span><span class="go">›</span></button>`;
  const pTrain = `<div class="hd"><h2>Training ground</h2><span class="eyebrow">No table, small XP</span></div>
  <div class="panel list">${Object.keys(TYPES)
    .map(
      (k, i) =>
        `<button class="li" data-act="train" data-v="${k}"><span class="k">${pad(i + 1)}</span><span class="tx"><b>${TYPES[k].n}</b><span>${QDESC[k]}</span></span><span class="go">›</span></button>`
    )
    .join("")}</div>`;
  const pLevel = `<div class="panel pad"><div class="statline"><span>Level <b>${lv}</b></span><span><b>${fmt(S.xp)}</b> XP · ${fmt(l1 - S.xp)} to level ${lv + 1}</span></div><div class="bar" style="margin-top:8px"><i style="width:${Math.max(2, ((S.xp - l0) / (l1 - l0)) * 100).toFixed(1)}%"></i></div></div>`;
  const pFoot = `<p class="foot">${fmt(PL.length)} PLAYERS · ${fmt(BD.xi.length)} LINE-UPS · ${fmt(BD.lists.length)} TOP TENS · ${fmt(BD.tables.length)} FINAL TABLES<br>${Net.ready && !Net.readonly ? "CONNECTED · YOUR RESULTS COUNT IN THE SHARED TABLES" : "PLAYING LOCALLY ON THIS DEVICE"}</p>`;
  const pTheme = themeBanner(),
    pStk = stkHomeCard();
  if (!wide()) {
    $("main").innerHTML = pNote + pFix + pStk + pTheme + cupCard() + pOff + pGrid + pTrain + pLevel + pFoot;
    return;
  }
  const pLong = `<div class="hd"><h2>Extra time</h2><span class="eyebrow">Long-form · PC only</span></div><div class="panel list">${Object.keys(LONG)
    .map(
      (k, i) =>
        `<button class="li" data-act="long" data-v="${k}"><span class="k">ET${i + 1}</span><span class="tx"><b>${LONG[k].n}</b><span>${LONG[k].d}${S.lb[k] ? " Best: " + S.lb[k] + "." : ""}</span></span><span class="go">›</span></button>`
    )
    .join("")}</div>`;
  const pTable = `<div class="hd"><h2>${esc(DIVS[S.div])}</h2><button class="linkb" data-act="go" data-v="league">Full table</button></div>${stakesHTML(rows)}${tableHTML(rows, true)}`;
  $("main").innerHTML =
    `${pNote}<div class="dash"><div class="col">${pFix}${pStk}${pTheme}${cupCard()}${pGrid}${pOff}${pLevel}</div><div class="col">${pTable}</div><div class="col">${pLong}${pTrain}</div></div>${pFoot}`;
}
function tableHTML(rows, mini) {
  const up = S.div < DIVS.length - 1,
    down = S.div > 0,
    full = !mini && wide();
  return `<div class="panel${mini ? " mini" : ""}"><table><tr><th>#</th><th>${esc(DIVS[S.div])}</th><th>P</th>${full ? "<th>W</th><th>D</th><th>L</th>" : ""}<th>GD</th><th>PTS</th></tr>${rows.map((r, i) => `<tr class="${r.me ? "me" : ""} ${up && i < 4 ? "up" : down && i >= 16 ? "down" : ""} ${(up && i === 3) || (down && i === 15) ? "cut" : ""}"><td>${i + 1}</td><td><span class="${r.f ? "fdn" : ""}">${esc(r.name)}</span>${r.me ? '<span class="tag me">YOU</span>' : r.house ? '<span class="tag">HOUSE</span>' : ""}${badgeHTML(r, full ? "" : "xs")}</td><td>${r.pl}</td>${full ? `<td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>` : ""}<td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td>${r.pts}</td></tr>`).join("")}</table>
    <div class="key">${up ? '<span><i style="background:var(--good)"></i>Top four go up</span>' : ""}${down ? '<span><i style="background:var(--bad)"></i>Bottom four go down</span>' : ""}<span>${SEASON - S.week.pl} of ${SEASON} matches left</span></div></div>`;
}
function renderLeague() {
  const rows = leagueTable(),
    up = S.div < DIVS.length - 1,
    down = S.div > 0;
  let body;
  if (leagueTab === "table") {
    body = `${stakesHTML(rows)}${tableHTML(rows)}
    <p class="note">A season is ${SEASON} matches: you play everyone once. <b>House sides</b> fill the places real players haven't taken yet, and play a match every time you do.</p>`;
  } else {
    body = warsHTML();
  }
  $("main").innerHTML =
    `<div class="seg"><button class="${leagueTab === "table" ? "on" : ""}" data-act="ltab" data-v="table">League table</button><button class="${leagueTab === "wars" ? "on" : ""}" data-act="ltab" data-v="wars">Club Wars</button></div>${body}
  <div class="hd"><h2>The pyramid</h2></div><div class="panel list">${DIVS.map((d, i) => i)
    .reverse()
    .map(
      i =>
        `<div class="li"><span class="k">${pad(i + 1)}</span><span class="tx"><b style="${i === S.div ? "color:var(--amber)" : i > S.div ? "color:var(--mute)" : ""}">${esc(DIVS[i])}</b><span>${i === S.div ? "You are here" : i === 7 ? "The summit" : ["Kind questions, famous names", "Still the household names", "The big clubs, fewer gimmes", "Sterner tests begin", "Cult heroes start appearing", "Deep squads, tighter margins", "Obscure and proud of it"][i]}</span></span></div>`
    )
    .join("")}</div>`;
  Net.pull().then(() => {});
}
const rarOf = i => (fame(i) >= 5 ? 0 : fame(i) >= 3.5 ? 1 : 2);
const RARN = ["Household name", "Squad regular", "Cult hero"];
function cardHTML(i, n) {
  const p = PL[i];
  return `<div class="panel card r${rarOf(i)}"><div class="nm">${esc(p[0])}</div><div class="mt">${POSN[p[2]]}${p[1] >= 0 ? " · " + esc(NAT[p[1]]) : ""}${p[3] > 0 ? " · '" + pad(p[3] % 100) : ""}</div><div class="cl">${clubsOf(
    i
  )
    .slice(0, 5)
    .map(c => esc(CLUB[c]))
    .join(", ")}</div><div class="rr">${RARN[rarOf(i)]}${n > 1 ? " ×" + n : ""}</div></div>`;
}
let albumClub = "";
function renderAlbum() {
  if (albumTab === "stats" && wide()) albumTab = "stk"; // on a wide screen Stats has its own tab
  if (albumTab === "stk") {
    renderStickers();
    return;
  }
  if (albumTab === "medals") {
    medalCheck(true);
    $("main").innerHTML = albumSeg() + medalsHTML();
    return;
  }
  if (albumTab === "stats") {
    renderStats();
    $("main").insertAdjacentHTML("afterbegin", albumSeg());
    return;
  }
  const keys = Object.keys(S.album),
    idx = keys.map(k => KEY2IDX[k]).filter(i => i !== undefined),
    cult = idx.filter(i => rarOf(i) === 2).length;
  let list, head;
  if (albumClub !== "") {
    const c = +albumClub;
    list = idx.filter(i => hasClub(i, c)).sort((a, b) => a - b);
    head = `${esc(CLUB[c])}: ${list.length} of ${fmt(clubPl[c].length)}`;
  } else {
    list = S.recent.map(k => KEY2IDX[k]).filter(i => i !== undefined);
    head = "Latest names";
  }
  $("main").innerHTML =
    `${albumSeg()}${founderCard()}<div class="counts"><div class="panel ct"><b>${fmt(idx.length)}</b><span>Collected</span></div><div class="panel ct"><b>${fmt(PL.length)}</b><span>In the book</span></div><div class="panel ct"><b>${cult}</b><span>Cult heroes</span></div></div>
  <label class="field" for="ac">Show<select id="ac"><option value="">Latest names</option>${BD.gridClubs.map(c => `<option value="${c}" ${String(c) === albumClub ? "selected" : ""}>${esc(CLUB[c])}</option>`).join("")}</select></label>
  <div class="hd"><h2>${head}</h2></div>
  ${
    list.length
      ? `<div class="stk">${list
          .slice(0, 80)
          .map(i => cardHTML(i, S.album[pkey(i)]))
          .join("")}</div>`
      : `<div class="panel pad"><p class="note">${idx.length ? "None from here yet." : "Empty for now. Every player you name correctly, in a match, the grid or training, goes in this log. The obscure ones are worth the most."}</p></div>`
  }`;
}
function renderStats() {
  const st = S.st,
    ts = S.ts || {},
    hist = S.hist || [],
    got = Object.keys(S.album).length;
  const tiles = [
    ["Matches", fmt(st.m)],
    ["Win rate", st.m ? Math.round((st.w / st.m) * 100) + "%" : "–"],
    ["Goals", fmt(st.goals)],
    ["Deep cuts", fmt(st.deep)],
    ["Best division", DIVS[st.bestDiv]],
    ["Cups won", S.cup.won],
    ["Level", levelOf(S.xp)],
    ["Album", fmt(got)]
  ];
  const types = Object.keys(TYPES)
    .map(k => {
      const t = ts[k] || [0, 0];
      return { k, n: TYPES[k].n, a: t[0], g: t[1], pc: t[0] ? Math.round((t[1] / t[0]) * 100) : -1 };
    })
    .sort((x, y) => y.pc - x.pc || y.a - x.a);
  const ranked = types.filter(t => t.a >= 3),
    best = ranked[0],
    worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const pts = hist.map(h => h.d).concat(S.div),
    W = 640,
    H = 220,
    L = 132,
    X = i => L + (pts.length > 1 ? (i * (W - L - 20)) / (pts.length - 1) : (W - L) / 2),
    Y = d => H - 24 - (d * (H - 48)) / (DIVS.length - 1);
  const path = pts.map((d, i) => (i ? "H" + X(i).toFixed(1) + "V" : "M" + X(i).toFixed(1) + " ") + Y(d).toFixed(1)).join("");
  const chart = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Division by season">${DIVS.map((n, d) => `<line x1="${L - 6}" x2="${W - 10}" y1="${Y(d)}" y2="${Y(d)}" class="gl"/><text x="${L - 12}" y="${Y(d) + 4}" text-anchor="end">${esc(n)}</text>`).join("")}<path d="${path}" class="ln"/>${pts.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="${i === pts.length - 1 ? "now" : "pt"}"><title>Season ${i + 1}: ${esc(DIVS[d])}</title></circle>`).join("")}</svg>`;
  $("main").innerHTML = `<div class="hd"><h2>Career stats</h2><span class="eyebrow">${esc(S.name || "You")} · ${esc(S.club)} fan</span></div>
  <div class="tiles">${tiles.map(t => `<div class="panel tile"><b>${esc(String(t[1]))}</b><span>${t[0]}</span></div>`).join("")}</div>
  <div class="dash two"><div class="col">
    <div class="hd"><h2>By question type</h2><span class="eyebrow">Scoring rate</span></div>
    <div class="panel pad"><div class="types">${types.map(t => `<div class="trow"><span>${esc(t.n)}</span><div class="bar"><i style="width:${Math.max(0, t.pc)}%"></i></div><b>${t.a ? t.pc + "%" : "–"}</b><em>${t.g}/${t.a}</em></div>`).join("")}</div>
    <p class="note" style="margin-top:12px">${best ? `Strongest: <b>${esc(best.n)}</b>. ${worst && worst.k !== best.k ? `Needs work: <b>${esc(worst.n)}</b>. Have a go on the training ground.` : ""}` : "Play a few more chances and your strengths show up here."}</p></div>
    <div class="hd"><h2>Extra time bests</h2></div>
    <div class="panel list">${Object.keys(LONG)
      .map(
        (k, i) =>
          `<button class="li" data-act="long" data-v="${k}"><span class="k">ET${i + 1}</span><span class="tx"><b>${LONG[k].n}</b><span>${S.lb[k] ? "Best: " + S.lb[k] + " named" : "Not played yet"}</span></span><span class="go">›</span></button>`
      )
      .join("")}</div>
  </div><div class="col">
    <div class="hd"><h2>The journey</h2><span class="eyebrow">Division by season</span></div>
    <div class="panel pad">${chart}</div>
    <div class="hd"><h2>Season history</h2></div>
    <div class="panel">${
      hist.length
        ? `<table class="hist"><tr><th>S</th><th>Division</th><th>POS</th><th>W-D-L</th><th>GD</th><th>PTS</th></tr>${hist
            .slice()
            .reverse()
            .map(
              h =>
                `<tr class="${h.to > h.d ? "up" : h.to < h.d ? "down" : ""}"><td>${h.s}</td><td>${esc(DIVS[h.d])}${h.to > h.d ? '<span class="tag up">UP</span>' : h.to < h.d ? '<span class="tag dn">DOWN</span>' : ""}</td><td>${ord(h.pos)}</td><td>${h.w}-${h.dr}-${h.l}</td><td>${h.gf - h.ga > 0 ? "+" : ""}${h.gf - h.ga}</td><td>${h.pts}</td></tr>`
            )
            .join("")}</table>`
        : `<p class="note pad">No finished seasons yet. Season ${S.season} is ${S.week.pl} of ${SEASON} matches in.</p>`
    }</div>
  </div></div>
  <p class="foot">Per-type stats and season history started recording on 11 November 2026.</p>`;
}
function render() {
  settleSeason();
  chrome();
  if (view === "stats" && !wide()) view = "home";
  if (view === "home") renderHome();
  else if (view === "stats") renderStats();
  else if (view === "league") renderLeague();
  else if (view === "grid") renderGrid();
  else if (view === "album") renderAlbum();
  window.scrollTo(0, 0);
}
const IOS_APP = navigator.standalone === true; // installed to an iPhone home screen: Google's redirect lands in Safari, so offer the email code only
function accountHTML() {
  if (!Net.canSignIn()) return "";
  if (Net.uid)
    return `<div class="panel pad acct"><span class="eyebrow">Account</span><p class="note">Signed in as <b>${esc(Net.email)}</b>. Your progress saves to your account and follows you to any device.</p><div class="row"><button type="button" class="btn line sm" data-act="signout">Sign out</button><button type="button" class="btn line sm" data-act="delacct">Delete account</button></div><p class="msg" id="amsg"></p></div>`;
  return `<div class="panel pad acct"><span class="eyebrow">${S.made ? "Save your progress" : "Already signed up?"}</span><p class="note">${S.made ? "Sign in to keep your level, division and album safe, and carry on from any device." : "Sign in and your progress comes with you."}</p>
  ${CFG.google && !IOS_APP ? '<button type="button" class="btn line sm gbtn" data-act="google">Continue with Google</button>' : ""}
  <label class="field" for="em">Email<input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="${esc(Net.pending)}"></label>
  <button type="button" class="btn line sm" data-act="sendcode">Email me a sign-in link</button>
  <div id="codebox" ${Net.pending ? "" : "hidden"}><label class="field" for="otp">Got a 6-digit code instead? Type it here<input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label><button type="button" class="btn sm" data-act="verify" style="margin-top:8px">Sign in</button></div>
  <p class="msg" id="amsg"></p><p class="note priv">We keep your email only so you can sign in. No marketing, no mailing lists, never sold. Delete your account any time from here.</p></div>`;
}
function profileSheet(first) {
  const clubs = CLUBS_PICK.map(c => CLUB[c]).sort();
  $("over").innerHTML =
    `<div class="sheet"><form class="box" id="pf"><span class="eyebrow">${first ? "Welcome to matchday" : "Profile"}</span><h1>${first ? "Sign on" : esc(S.name)}</h1>
  ${first ? `<ol class="steps"><li><i>01</i><span><b>Play fixtures, not quizzes.</b> Five chances each. Out-score the other lot.</span></li><li><i>02</i><span><b>Type names, don't pick them.</b> Real squads, line-ups and transfers. No multiple choice.</span></li><li><i>03</i><span><b>Win points, go up.</b> Nineteen-match seasons. Four up, four down.</span></li></ol>` : `<div class="panel pad"><div class="statline"><span>Matches <b>${S.st.m}</b></span><span>Wins <b>${S.st.w}</b></span><span>Goals <b>${S.st.goals}</b></span><span>Deep cuts <b>${S.st.deep}</b></span></div></div>`}
  ${first ? "" : founderCard()}<label class="field" for="nm">Name on the teamsheet<input id="nm" maxlength="16" autocomplete="off" value="${esc(S.name)}" placeholder="e.g. Big Dave"></label>
  <label class="field" for="cl">Your club<select id="cl">${clubs.map(c => `<option ${c === S.club ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
  <button class="btn" type="submit">${first ? "Sign the forms" : "Save"}</button>
  ${accountHTML()}
  ${first ? "" : `<div class="row"><button type="button" class="btn line sm" data-act="sound">Sound ${S.sound ? "on" : "off"}</button>${navigator.vibrate ? `<button type="button" class="btn line sm" data-act="hap">Buzz ${S.hap !== false ? "on" : "off"}</button>` : ""}${badgeOf(meB()) === "fd" ? `<button type="button" class="btn line sm" data-act="kit">Founder's kit ${S.kit !== false ? "on" : "off"}</button>` : ""}<button type="button" class="btn line sm" data-act="closeover">Close</button></div><button type="button" class="linkb" data-act="reset">Reset everything</button>`}</form></div>`;
  $("pf").addEventListener("submit", e => {
    e.preventDefault();
    const ae = document.activeElement && document.activeElement.id;
    if (ae === "em") {
      acctAct("sendcode");
      return;
    }
    if (ae === "otp") {
      acctAct("verify");
      return;
    }
    const n = $("nm").value.trim().slice(0, 16);
    S.name = n || "Unnamed Trialist";
    S.club = $("cl").value;
    const isNew = first && !S.made;
    S.made = true;
    $("over").innerHTML = "";
    save(true);
    render();
    if (isNew) startLeagueMatch(); // a new player goes straight to their first fixture
  });
}
const hintBtn = k => {
  const n = gridState().h[k];
  return n >= TUNING.gridHint.length
    ? ""
    : `<button class="linkb hintb" data-act="ghint">${n ? "Another hint" : "Hint"} <i>−${TUNING.gridHint[n]}%</i></button>`;
};
function cellSheet(k) {
  gridCell = k;
  const a = GRID.rows[Math.floor(k / 3)],
    b = GRID.cols[k % 3],
    g = gridState();
  $("over").innerHTML =
    `<div class="sheet topdock"><div class="box"><div class="hd"><span class="eyebrow">${g.left} guesses left</span><span class="hdb" id="hintb">${hintBtn(k)}</span><button class="linkb" data-act="closeover">Close</button></div><div class="cats"><div class="cat"><span>${catSub(a)}</span><b>${esc(catLabel(a))}</b></div><div class="amp">+</div><div class="cat"><span>${catSub(b)}</span><b>${esc(catLabel(b))}</b></div></div>
  ${g.h[k] ? `<p class="hintln" id="hintln">${gridHintText(k)}</p>` : `<p class="hintln" id="hintln" hidden></p>`}
  <div class="entry"><input id="q" type="text" placeholder="Type a player's name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Player name"><button type="button" class="clr" id="clr" data-act="clrq" aria-label="Clear" hidden>×</button><div class="sug" id="sug" hidden></div></div><p class="msg" id="msg"></p></div></div>`;
  const q = $("q");
  try {
    q.focus();
  } catch (e) {}
}
/* Safari, after passing a sign-in back to the game on the home screen (Net.giveHandoff) */
function handedSheet() {
  $("over").innerHTML =
    `<div class="sheet"><div class="box"><span class="eyebrow">Signed in</span><h1>Back to the app</h1><p class="note">You're in. Go back to Boffin on your home screen and it'll sign you in by itself in a few seconds. You can close this Safari tab.</p><div class="row"><button class="btn line" data-act="closeover">Close</button></div></div></div>`;
}
function confirmSheet(title, text, yes, fn) {
  $("over").innerHTML =
    `<div class="sheet"><div class="box"><h1>${esc(title)}</h1><p class="note">${esc(text)}</p><div class="row"><button class="btn line" data-act="closeover">Cancel</button><button class="btn" id="yes">${esc(yes)}</button></div></div></div>`;
  $("yes").addEventListener("click", () => {
    $("over").innerHTML = "";
    fn();
  });
}
function abandonMatch() {
  if (M && M.mode === "league") {
    if (M.ghost) S.played = S.played.concat(M.seed).slice(-60);
    S.ab = { f: M.fx, n: ((S.ab && S.ab.f === M.fx ? S.ab.n : 0) | 0) + 1 };
  }
  quitMatch();
}
function quitMatch() {
  cancelAnimationFrame(raf);
  if (M) M.live = false;
  M = null;
  view = "home";
  save(true);
  render();
}
