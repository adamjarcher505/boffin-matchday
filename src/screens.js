"use strict";
/* ============ screens.js: header and tabs, home, league, album, stats, profile and other sheets ============ */
/* ============ screens ============ */
const wide = () => window.matchMedia("(min-width: 1024px)").matches;
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
    oppPos = rows.findIndex(r => r.id === opp.id) + 1;
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
  const zc = S.div < DIVS.length - 1 && pos <= 4 ? "ok" : S.div > 0 && pos >= 17 ? "bad" : "";
  // what a win would do, as the table stands (everyone else plays too, so it's a guide, not a promise)
  const ifWin = rows.map(r => (r.me ? Object.assign({}, r, { pts: r.pts + 3, gf: r.gf + 1 }) : r)).sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf),
    winPos = myPos(ifWin),
    winLine = winPos < pos ? `A win takes you ${winPos <= 4 && pos > 4 && S.div < DIVS.length - 1 ? "into the promotion places" : S.div > 0 && pos >= 17 && winPos <= 16 ? "out of the drop zone" : "up to " + ord(winPos)}, as it stands` : pos === 1 ? "Top of the table. Stay there" : "Three points to close the gap";
  const pNote = `${
    S.note
      ? `<div class="panel pad" style="border-color:var(--amber)"><span class="eyebrow" style="color:var(--amber)">Last season</span><p class="note" style="margin-top:6px">${noteText()}</p><button class="linkb" data-act="clearnote">Dismiss</button></div>`
      : ""
  }`;
  const pFix = `<div class="panel fix hero${runIn() ? " fday" : ""}">${runIn() ? `<div class="fdtag">${runInLabel()}</div>` : ""}
   <div class="statline"><span>${esc(DIVS[S.div])} · Season ${S.season}</span><span>Match <b>${S.week.pl + 1}</b> of ${SEASON}</span></div>
   <div class="tie"><div class="side">${myCrest()}<b>${esc(S.name || "You")}</b><small>${ord(pos)} · ${S.week.pts} pts</small></div><span class="v">v</span><div class="side">${crest(opp.name)}<b>${esc(opp.name)}</b><small>${ord(oppPos)} · ${opp.pts} pts${opp.real ? " · real player" : ""}</small></div></div>
   <button class="btn kick" data-act="kick">Kick off<small>Five chances each. About 90 seconds.</small></button>
   <div class="statline"><span class="form">${S.form.length ? S.form.map(f => `<i class="${f}">${f}</i>`).join("") : "<span>No form yet</span>"}</span><span class="zone ${zc}"><b>${zone}</b></span></div>
   <p class="ifwin">${winLine}</p>
   <div class="prog" aria-hidden="true">${Array.from({ length: SEASON }, (_, k) => `<i class="${k < S.week.pl ? "on" : k === S.week.pl ? "cur" : ""}"></i>`).join("")}</div></div>`;
  const pYou = `<div class="you">${streakChip() || `<div class="streak">${FLAME}<b>0</b><span>days · play a match to start a streak</span></div>`}<span class="lvl">Level <b>${lv}</b> · ${fmt(l1 - S.xp)} XP to ${lv + 1}</span></div>`;
  const pOff =
    Net.checked && Net.canSignIn() && !Net.uid
      ? `<div class="panel pad"><p class="note"><b>Not signed in.</b> Your progress only lives on this device. Sign in to keep it safe, play on any device and count in the shared tables.</p><button class="btn line sm" style="margin-top:10px" data-act="profile">Sign in</button></div>`
      : Net.checked && !Net.ready
        ? `<div class="panel pad"><p class="note"><b>Playing offline.</b> Your progress saves on this device, but your results won't show in your mates' tables and your opponents are house sides. Share your result after a match to show off.</p></div>`
        : "";
  const pTiles = `<div class="tiles2">${cupTile()}${gridTile()}${chainTile()}</div>`;
  const pTrain = `<div class="hd"><h2>Training ground</h2><span class="eyebrow">No table, small XP</span></div>
  <div class="trgrid">${Object.keys(TYPES)
    .map(k => `<button class="panel tr2" data-act="train" data-v="${k}"><i>${qart(k)}</i><b>${TYPES[k].n}</b></button>`)
    .join("")}</div>`;
  const pFoot = `<p class="foot">${fmt(PL.length)} PLAYERS · ${fmt(QB.all.length)} QUIZ QUESTIONS · ${fmt(BD.xi.length)} LINE-UPS · ${fmt(BD.lists.length)} TOP TENS<br>${
    Net.ready && !Net.readonly ? "CONNECTED · YOUR RESULTS COUNT IN THE SHARED TABLES" : "PLAYING LOCALLY ON THIS DEVICE"
  }</p>`;
  const pTheme = themeBanner(),
    pStk = stkHomeCard(),
    pObj = S.made ? objCard() : "";
  if (!wide()) {
    $("main").innerHTML = pNote + pFix + pYou + pStk + pObj + pTiles + pTheme + pTrain + pOff + pFoot;
    return;
  }
  const pLong = `<div class="hd"><h2>Extra time</h2><span class="eyebrow">Long-form · PC only</span></div><div class="panel list">${Object.keys(LONG)
    .map(
      (k, i) =>
        `<button class="li" data-act="long" data-v="${k}"><span class="k">ET${i + 1}</span><span class="tx"><b>${LONG[k].n}</b><span>${LONG[k].d}${S.lb[k] ? " Best: " + S.lb[k] + "." : ""}</span></span><span class="go">›</span></button>`
    )
    .join("")}</div>`;
  const pTable = `<div class="hd"><h2>${esc(DIVS[S.div])}</h2><button class="linkb" data-act="go" data-v="league">Full table</button></div>${stakesHTML(rows)}${tableHTML(rows, true)}`;
  $("main").innerHTML = `${pNote}<div class="dash"><div class="col">${pFix}${pYou}${pStk}${pObj}${pTiles}${pTheme}${pOff}</div><div class="col">${pTable}</div><div class="col">${pLong}${pTrain}</div></div>${pFoot}`;
}
function tableHTML(rows, mini) {
  const up = S.div < DIVS.length - 1,
    down = S.div > 0,
    full = !mini && wide(),
    prev = leagueTable(true),
    was = {},
    anyReal = rows.some(r => r.real);
  if (prev) prev.forEach((r, i) => (was[r.id] = i));
  const move = (r, i) => {
    if (!prev || r.real || was[r.id] === undefined || was[r.id] === i) return "";
    return was[r.id] > i ? '<i class="mv u">▲</i>' : '<i class="mv d">▼</i>';
  };
  const form = r => (r.form && r.form.length ? `<span class="fdots">${r.form.map(f => `<i class="${f}"></i>`).join("")}</span>` : "");
  return `<div class="panel lt${mini ? " mini" : ""}"><table><tr><th>#</th><th>${esc(DIVS[S.div])}</th><th class="fc">FORM</th><th>P</th>${full ? "<th>W</th><th>D</th><th>L</th>" : ""}<th>GD</th><th>PTS</th></tr>${rows
    .map(
      (r, i) =>
        `<tr class="${r.me ? "me" : ""} ${up && i < 4 ? "up" : down && i >= 16 ? "down" : ""} ${(up && i === 3) || (down && i === 15) ? "cut" : ""}"><td>${i + 1}${move(r, i)}</td><td><span class="tn">${r.me ? myCrest() : crest(r.name)}<span class="${r.f ? "fdn" : ""}">${esc(r.name)}</span>${
          r.me ? '<span class="tag me">YOU</span>' : r.real ? '<span class="tag real">REAL</span>' : ""
        }${badgeHTML(r, full ? "" : "xs")}</span></td><td class="fc">${form(r)}</td><td>${r.pl}</td>${full ? `<td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>` : ""}<td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td>${r.pts}</td></tr>`
    )
    .join("")}</table>
    <div class="key">${up ? '<span><i style="background:var(--good)"></i>Top four go up</span>' : ""}${down ? '<span><i style="background:var(--bad)"></i>Bottom four go down</span>' : ""}${
      anyReal ? '<span><b class="tag real">REAL</b> another player</span>' : ""
    }<span>${SEASON - S.week.pl} of ${SEASON} matches left</span></div></div>`;
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
  // Knowledge: the Names log, counted per club
  const keys = Object.keys(S.album),
    idx = keys.map(k => KEY2IDX[k]).filter(i => i !== undefined),
    counts = knowCounts(),
    mine = clubIdx(S.club),
    K = mine >= 0 ? knowRank(mine, counts) : null,
    best = Object.keys(counts)
      .map(Number)
      .filter(c => c !== mine)
      .sort((a, b) => counts[b] - counts[a] || a - b)
      .slice(0, 6);
  const row = c => {
    const R = knowRank(c, counts);
    return `<div class="kr"><span class="kn">${esc(CLUB[c])}</span><span class="krk r${R.r}">${KNOW_RANKS[R.r]}</span><b>${R.n}</b><div class="bar"><i style="width:${Math.round(R.pc * 100)}%"></i></div></div>`;
  };
  let list, head;
  if (albumClub !== "") {
    const c = +albumClub;
    list = idx.filter(i => hasClub(i, c)).sort((a, b) => a - b);
    head = `${esc(CLUB[c])}: ${list.length} named`;
  } else {
    list = S.recent.map(k => KEY2IDX[k]).filter(i => i !== undefined);
    head = "Latest names";
  }
  $("main").innerHTML =
    `${albumSeg()}${founderCard()}${
      K
        ? `<div class="panel pad know"><span class="eyebrow">Your ${esc(S.club)} knowledge</span><div class="kbig"><b class="krk r${K.r}">${KNOW_RANKS[K.r]}</b><span><b>${K.n}</b> ${esc(S.club)} players named</span></div><div class="bar"><i style="width:${Math.round(K.pc * 100)}%"></i></div><p class="note">${
            K.next ? `<b>${K.next - K.n}</b> more for <b>${KNOW_RANKS[K.r + 1]}</b> (+${KNOW_XP[K.r + 1]} XP).` : "Top rank. Nobody knows them like you."
          } Anyone you name correctly, anywhere in the game, counts if he ever played for them.</p></div>`
        : ""
    }
  <div class="panel pad"><div class="statline"><span>Players named</span><span><b>${fmt(idx.length)}</b></span></div><div class="statline"><span>Cult heroes among them</span><span><b>${idx.filter(i => rarOf(i) === 2).length}</b></span></div></div>
  ${best.length ? `<div class="hd"><h2>Clubs you know best</h2></div><div class="panel pad kl">${best.map(row).join("")}</div>` : ""}
  <div class="hd"><h2>${head}</h2></div>
  <label class="field" for="ac">Show<select id="ac"><option value="">Latest names</option>${BD.gridClubs.map(c => `<option value="${c}" ${String(c) === albumClub ? "selected" : ""}>${esc(CLUB[c])}</option>`).join("")}</select></label>
  ${
    list.length
      ? `<div class="stk">${list
          .slice(0, 80)
          .map(i => cardHTML(i, S.album[pkey(i)]))
          .join("")}</div>`
      : `<div class="panel pad"><p class="note">${idx.length ? "None from here yet." : "Empty for now. Every player you name correctly, in a match, the grid or training, counts towards every club he played for."}</p></div>`
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
  else if (view === "chain") renderChain();
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
const TABICON = {
  home: '<path d="M3 5h18v14H3zM12 5v14M3 9h3v6H3M21 9h-3v6h3"/><circle cx="12" cy="12" r="2.6"/>',
  league: '<path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h10"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
  album: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17c.8-2.4 2.2-3.4 4-3.4s3.2 1 4 3.4"/>',
  stats: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>'
};
function chrome() {
  const me = meB(),
    lv = levelOf(S.xp),
    l0 = levelAt(lv - 1),
    l1 = levelAt(lv);
  $("who").innerHTML = `<b>${esc(S.name || "Sign on")}</b>${badgeHTML(me, wide() ? "" : "xs")}<span class="lv">LV ${lv}</span>`;
  const xb = $("xpbar");
  if (xb) xb.style.width = Math.max(1, Math.min(100, ((S.xp - l0) / (l1 - l0)) * 100)).toFixed(1) + "%";
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
        `<button class="tab ${view === t[0] ? "on" : ""}" data-act="go" data-v="${t[0]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TABICON[t[0]]}</svg><span>${t[1]}</span>${t[0] === "grid" && gridOpen ? "<em></em>" : ""}</button>`
    )
    .join("");
  document.getElementById("app").classList.toggle("focus", view === "match" || view === "ft" || view === "stk");
  if (view !== "match" && view !== "stk") document.getElementById("app").classList.remove("q");
}
/* small tiles on the home screen: the Club Cup and the Daily Grid */
function cupTile() {
  cupSync();
  const rd = S.cup.rd,
    opp = cupFans()[rd];
  return `<button class="panel tile2 cup" data-act="cup"><span class="eyebrow">Club Cup · ${esc(S.club)}</span><b>${esc(CUPR[rd])}</b><span class="sub">v ${esc(opp.name)}${opp.real ? " · real fan" : ""}</span>
  <div class="cupsteps">${CUPR.map((n, k) => `<i class="${k < rd ? "done" : k === rd ? "on" : ""}">${["R16", "QF", "SF", "F"][k]}</i>`).join("")}</div><span class="more">${S.cup.won ? "Cups won " + S.cup.won + " · " : ""}Lose and you're out ›</span></button>`;
}
function gridTile() {
  const g = S.grid[dayKey()],
    done = g && (g.left <= 0 || g.c.every(x => x)),
    got = g ? g.c.filter(x => x).length : 0;
  return `<button class="panel tile2 gridt" data-act="go" data-v="grid"><span class="eyebrow">Daily Grid · No. ${gridNo()}</span><b>${done ? gridScore(g) + "%" : g ? g.left + " left" : "Nine squares"}</b><span class="sub">${
    done ? got + " of 9. New grid at midnight." : g ? got + " in. Finish the job." : "Same grid for everyone."
  }</span><div class="minig">${Array.from({ length: 9 }, (_, k) => `<i class="${g && g.c[k] ? "on" : ""}"></i>`).join("")}</div><span class="more">${done ? "See it ›" : "Play ›"}</span></button>`;
}
