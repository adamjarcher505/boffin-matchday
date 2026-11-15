"use strict";
/* ============ progress.js: titles, card frames, level rewards, the full-time XP bar, player profiles, rankings ============
   Levels come from levelAt/levelOf in state.js (curve numbers in TUNING.lv*: quick early levels, capped late).
   On top of the number:
   - a title every 5 levels (RANKS) and a card frame per band (FRAMES), shown on the profile card, the rankings and the
     top bar, so other players can see how far you've come
   - one sticker token every TUNING.lvTokenEvery levels, granted once (S.lvr = highest level already paid out)
   - wins on the bounce (S.wsk) pay a little extra; the matchday streak, objectives and medals live in career.js
   - the full-time XP bar fills, rolls over and celebrates each level
   Profiles: your own (everything), and anyone else's from their public row. The extra numbers other players see live
   in `pr` on the players row (supabase/005_profile.sql); without it you still see their level, title, club, division
   and cups. (15/11/2026) */

/* titles avoid the names already used by medals (Scout, Anorak, Encyclopaedia...) and club knowledge ranks */
const RANKS = [
  [1, "Trialist"],
  [5, "Pub Expert"],
  [10, "Programme Collector"],
  [15, "Terrace Tactician"],
  [20, "Phone-in Caller"],
  [25, "Fanzine Editor"],
  [30, "Spreadsheet Merchant"],
  [35, "Transfer Guru"],
  [40, "Pundit"],
  [45, "Co-Commentator"],
  [50, "Question Master"],
  [55, "Quiz Machine"],
  [60, "Ceefax Page 302"],
  [65, "Oracle"],
  [70, "Living Legend"],
  [75, "Hall of Famer"],
  [80, "The GOAT"]
];
const FRAMES = [
  [1, "pl", "Graphite"],
  [10, "brz", "Bronze"],
  [20, "slv", "Silver"],
  [30, "gld", "Gold"],
  [40, "lit", "Floodlit"],
  [60, "leg", "Legend"]
];
const STAR_EVERY = 10; // past the last title, a star per this many levels: "The GOAT ★★"
const rankOf = lv => {
  let t = RANKS[0][1];
  for (const r of RANKS) if (lv >= r[0]) t = r[1];
  const top = RANKS[RANKS.length - 1][0],
    st = lv >= top + STAR_EVERY ? Math.floor((lv - top) / STAR_EVERY) : 0;
  return t + (st ? " " + "★".repeat(Math.min(st, 5)) : "");
};
const frameOf = lv => {
  let f = FRAMES[0];
  for (const x of FRAMES) if (lv >= x[0]) f = x;
  return { k: f[1], n: f[2] };
};
const lvChip = xp => {
  const lv = levelOf(xp | 0);
  return `<span class="lv f-${frameOf(lv).k}">LV ${lv}</span>`;
};

/* what reaching level L gives you */
function levelRewards(L) {
  const out = [],
    r = RANKS.find(x => x[0] === L),
    f = FRAMES.find(x => x[0] === L),
    top = RANKS[RANKS.length - 1][0];
  if (r && L > 1) out.push({ k: "title", t: "New title: " + r[1] });
  else if (L > top && (L - top) % STAR_EVERY === 0) out.push({ k: "title", t: "New title: " + rankOf(L) });
  if (f && L > 1) out.push({ k: "frame", t: f[2] + " card" });
  if (L % TUNING.lvTokenEvery === 0) out.push({ k: "tok", t: "+1 sticker token" });
  return out;
}
function nextReward(lv) {
  for (let L = lv + 1; L < lv + 50; L++) {
    const r = levelRewards(L);
    if (r.length) return { L, r };
  }
  return null;
}
const rewardText = r => r.map(x => x.t.replace(/^New title: /, "")).join(" · ");

/* called by addXp whenever the level goes up: pay out tokens for levels not paid before (two devices can't both pay) */
function lvGrant(a, b) {
  const done = S.lvr | 0;
  for (let L = a + 1; L <= b; L++) if (L > done && L % TUNING.lvTokenEvery === 0) S.stk.tok++;
  S.lvr = Math.max(done, b);
}
function lvToast(a, b) {
  const r = [];
  for (let L = a + 1; L <= b; L++) levelRewards(L).forEach(x => r.push(x.t));
  return "Level " + b + ". " + (r.length ? r.join(". ") + "." : "The knowledge grows.");
}

/* wins on the bounce, league and cup together: XP lines for full time. Never touches questions or results. */
function winRunLines(won) {
  if (!won) {
    S.wsk = 0;
    return [];
  }
  S.wsk = (S.wsk | 0) + 1;
  S.st.bws = Math.max(S.st.bws | 0, S.wsk);
  return S.wsk > 1 ? [[S.wsk + " wins on the bounce", Math.min(TUNING.winRunCap, TUNING.winRunXp * (S.wsk - 1))]] : [];
}

/* ---------- the XP bar on full-time screens (xpPanel in match.js draws it) ---------- */
const xpToGo = xp => {
  const lv = levelOf(xp);
  return `<b>${fmt(levelAt(lv) - xp)}</b> XP to level ${lv + 1}`;
};
function nextRewardLine(lv) {
  const n = nextReward(lv);
  return n ? `Next reward · level ${n.L}: <b>${esc(rewardText(n.r))}</b>` : "";
}
const lvPct = (x, l) => Math.max(2, Math.min(100, ((x - levelAt(l - 1)) / (levelAt(l) - levelAt(l - 1))) * 100));
/* fill the bar from the old XP to the new, rolling over at each level, then celebrate */
function animXp(from, to) {
  const b = $("xpb");
  if (!b) return;
  let lv = levelOf(from);
  const end = levelOf(to),
    start = lv,
    fast = still();
  const set = (w, anim) => {
    b.style.transition = anim ? "width .8s cubic-bezier(.3,.7,.3,1)" : "none";
    b.style.width = w + "%";
    if (!anim) void b.offsetWidth;
  };
  set(lvPct(from, lv), false);
  const step = () => {
    if (!b.isConnected) return;
    if (lv < end && lv - start < 6 && !fast) {
      set(100, true);
      setTimeout(() => {
        if (!b.isConnected) return;
        lv++;
        sfx.level();
        buzz([25, 30, 25, 30, 90]);
        const l = $("xplv"),
          t = $("xptl");
        if (l) {
          l.textContent = lv;
          l.classList.remove("pop");
          void l.offsetWidth;
          l.classList.add("pop");
        }
        if (t) t.textContent = rankOf(lv);
        b.parentNode.classList.add("flash");
        set(0, false);
        setTimeout(() => {
          b.parentNode.classList.remove("flash");
          step();
        }, 300);
      }, 800);
    } else {
      lv = end;
      const l = $("xplv"),
        t = $("xptl"),
        n = $("xpn");
      if (l) l.textContent = lv;
      if (t) t.textContent = rankOf(lv);
      if (n) n.innerHTML = xpToGo(to);
      set(lvPct(to, lv), true);
      if (end > start) setTimeout(() => b.isConnected && view === "ft" && !$("over").innerHTML && levelSheet(start, end), 900);
    }
  };
  setTimeout(step, fast ? 0 : 900);
}
const LV_SAY = ["The knowledge grows.", "Your mates are getting nervous.", "Somewhere a pub quiz team just felt a chill.", "That's going on the CV.", "Big game player."];
function levelSheet(a, b) {
  const r = [];
  for (let L = a + 1; L <= b; L++) levelRewards(L).forEach(x => r.push(x));
  const f = frameOf(b),
    n = nextReward(b),
    newTitle = r.some(x => x.k === "title");
  chrome();
  $("over").innerHTML = `<div class="sheet lvup"><div class="box"><span class="eyebrow">${b - a > 1 ? b - a + " levels up" : "Level up"}</span>
  <div class="lvbig f-${f.k}"><span class="fx"></span><small>Level</small><b>${b}</b></div>
  <div class="lvt${newTitle ? " new" : ""}">${newTitle ? "<small>New title</small>" : ""}${esc(rankOf(b))}</div>
  ${r.length ? `<div class="lvrw">${r.map(x => `<span>${esc(x.k === "title" ? "Title unlocked" : x.t)}</span>`).join("")}</div>` : `<p class="note">${esc(pickR(LV_SAY))}</p>`}
  ${n ? `<p class="note">Next reward at <b>level ${n.L}</b>: ${esc(rewardText(n.r))}. ${fmt(levelAt(n.L - 1) - S.xp)} XP away.</p>` : ""}
  <button class="btn" data-act="closeover">Get in</button></div></div>`;
}

/* ---------- what other players can see about you (sent with your league row as `pr`) ---------- */
function profPub() {
  const ts = {};
  Object.keys(TYPES).forEach(k => {
    const t = S.ts[k];
    if (t && t[0]) ts[k] = [t[0] | 0, t[1] | 0];
  });
  const hist = S.hist || [];
  return {
    v: 1,
    m: S.st.m | 0,
    w: S.st.w | 0,
    g: S.st.goals | 0,
    dc: S.st.deep | 0,
    ts,
    al: Object.keys(S.album).length,
    sk: stkCount(), // earned + swapped in - swapped out
    md: Object.keys(S.md || {}).length,
    bd: S.st.bestDiv | 0,
    ws: S.st.bws | 0,
    ds: (S.sk && S.sk.best) | 0,
    gr: S.st.grids | 0,
    ss: hist.length,
    up: hist.filter(h => h.to > h.d).length
  };
}
function profOf(id) {
  if (!id || id === "me" || id === Net.uid) {
    const r = meB();
    return { me: true, id: "me", name: S.name || "You", club: S.club, xp: S.xp, div: S.div, season: S.season, cups: S.cup.won, f: !!r.f, m: r.m | 0, pr: profPub() };
  }
  const r = Net.rows.find(x => x && x.id === id);
  if (!r) return null;
  const pr = r.pr && typeof r.pr === "object" && r.pr.v ? r.pr : null;
  return { me: false, id, name: String(r.n || "Unnamed").slice(0, 18), club: r.c || "", xp: r.xp | 0, div: r.d | 0, season: r.s | 0, cups: r.cu | 0, f: !!r.f, m: r.m | 0, pr, rec: { p: r.p | 0, pl: r.pl | 0 } };
}
const SPEC_MIN = 5; // chances of a type before it can be your specialist subject
function typeRates(ts) {
  return Object.keys(TYPES)
    .map(k => {
      const t = (ts || {})[k] || [0, 0];
      return { k, n: TYPES[k].n, a: t[0] | 0, g: t[1] | 0, pc: t[0] ? Math.round((t[1] / t[0]) * 100) : -1 };
    })
    .sort((x, y) => y.pc - x.pc || y.a - x.a);
}
function specialist(ts) {
  const r = typeRates(ts).filter(t => t.a >= SPEC_MIN);
  return r.length ? { best: r[0], worst: r.length > 1 ? r[r.length - 1] : null } : null;
}
function scoring(pr) {
  if (!pr || !pr.ts) return null;
  let a = 0,
    g = 0;
  Object.keys(pr.ts).forEach(k => {
    a += pr.ts[k][0] | 0;
    g += pr.ts[k][1] | 0;
  });
  return a >= 10 ? Math.round((g / a) * 100) : null;
}
const winRate = pr => (pr && pr.m >= 3 ? Math.round((pr.w / pr.m) * 100) : null);

/* ---------- the card ---------- */
function proCardHTML(p) {
  const lv = levelOf(p.xp),
    f = frameOf(lv),
    pr = p.pr,
    sc = scoring(pr),
    sp = pr && specialist(pr.ts),
    b = badgeOf(p);
  const top = [
    ["Scoring", sc != null ? sc + "%" : "–"],
    ["Matches", pr ? fmt(pr.m) : "–"],
    ["Medals", pr && pr.md != null ? fmt(pr.md) : "–"],
    ["Cups", fmt(p.cups)]
  ];
  return `<div class="pcard f-${f.k}"><span class="fx"></span>
  <div class="pch"><span>${esc(f.n)} card</span><span>${b ? (b === "fd" ? "★ Founder" : "Founding no. " + memNo(p)) : esc(DIVS[p.div])}</span></div>
  <div class="pcm"><div class="pclv"><b>${lv}</b><span>Level</span></div><div class="pcn"><div class="nm">${esc(p.name)}</div><div class="ttl">${esc(rankOf(lv))}</div><div class="mt">${esc(p.club)} fan · ${esc(DIVS[p.div])}${sp ? " · " + esc(sp.best.n) + " specialist" : ""}</div></div></div>
  <div class="pcs">${top.map(t => `<div><b>${t[1]}</b><span>${t[0]}</span></div>`).join("")}</div>
  ${p.me ? `<div class="pcx"><div class="statline"><span><b>${fmt(p.xp)}</b> XP</span><span>${xpToGo(p.xp)}</span></div><div class="bar"><i style="width:${lvPct(p.xp, lv).toFixed(1)}%"></i></div></div>` : ""}</div>`;
}

/* ---------- rankings: every real player we can see, by XP ---------- */
let rankClub = false,
  profId = "",
  profBack = "league";
function rankRows(club) {
  const rows = Net.rows.filter(r => r && r.n && r.id !== Net.uid).map(r => ({ id: r.id, name: String(r.n).slice(0, 18), club: r.c || "", xp: r.xp | 0, f: !!r.f, m: r.m | 0 }));
  const me = meB();
  rows.push({ id: "me", me: true, name: S.name || "You", club: S.club, xp: S.xp, f: !!me.f, m: me.m | 0 });
  return rows.filter(r => !club || r.club === S.club).sort((a, b) => b.xp - a.xp || (a.me ? 1 : b.me ? -1 : 0));
}
function rankInfo(club) {
  const rows = rankRows(club),
    i = rows.findIndex(r => r.me);
  return { rows, pos: i + 1, n: rows.length, above: i > 0 ? rows[i - 1] : null };
}
function rankingsHTML() {
  const ri = rankInfo(rankClub),
    rows = ri.rows,
    i = ri.pos - 1,
    show = rows.slice(0, 50);
  const row = (r, k) =>
    `<tr class="${r.me ? "me" : ""}" data-act="prof" data-v="${esc(r.id)}"><td>${k + 1}</td><td><span class="${r.f ? "fdn" : ""}">${esc(r.name)}</span>${r.me ? '<span class="tag me">YOU</span>' : ""}${badgeHTML(r, "xs")}<small class="rt">${esc(rankOf(levelOf(r.xp)))}${rankClub ? "" : " · " + esc(r.club)}</small></td><td>${fmt(r.xp)}</td><td>${lvChip(r.xp)}</td></tr>`;
  const head =
    ri.n < 2
      ? `<p class="note">${Net.kind === "local" || !Net.ready ? "Sign in and play online to see where you rank against everyone else." : "Nobody else here yet. Send the link round."}</p>`
      : `<div class="statline"><span>You're <b>${ord(ri.pos)}</b> of ${fmt(ri.n)}${rankClub ? " " + esc(S.club) + " fans" : ""}</span><span>${ri.above ? `<b>${fmt(ri.above.xp - S.xp + 1)}</b> XP to overtake ${esc(ri.above.name)}` : "Top of the pile"}</span></div>`;
  return `<div class="seg sub"><button class="${rankClub ? "" : "on"}" data-act="rclub" data-v="0">Everyone</button><button class="${rankClub ? "on" : ""}" data-act="rclub" data-v="1">${esc(S.club)} fans</button></div>
  <div class="panel pad">${head}</div>
  <div class="panel"><table class="rk"><tr><th>#</th><th>Player</th><th>XP</th><th>LV</th></tr>${show.map(row).join("")}${i >= show.length ? `<tr class="gap"><td colspan="4">…</td></tr>` + row(rows[i], i) : ""}</table></div>
  <p class="note">Ranked by XP: everything you've ever earned. Tap anyone to see their card and how you compare.${Net.kind === "claude" ? " This version can only see the 500 most recent players." : ""}</p>`;
}

/* ---------- head to head ---------- */
const H2H = {
  me: ["You know more ball. Tell them.", "Comfortable. Screenshot it for the group chat.", "Not even close. Be gracious. Or don't.", "You've got their number."],
  them: ["They know more ball. Training ground's that way.", "Outclassed. Go again.", "Hard to take, that.", "Schooled. No other word for it."],
  level: ["Nothing in it. Settle it in the league.", "Honours even. For now.", "Too close to call."]
};
function compareHTML(me, them) {
  const a = me.pr,
    b = them.pr,
    cats = [
      ["Level", levelOf(me.xp), levelOf(them.xp)],
      ["Cups won", me.cups, them.cups]
    ];
  if (b)
    cats.push(
      ["Scoring rate", scoring(a), scoring(b), "%"],
      ["Win rate", winRate(a), winRate(b), "%"],
      ["Deep cuts", a.dc, b.dc],
      ["Names known", a.al, b.al],
      ["Medals", a.md, b.md],
      ["Stickers", a.sk, b.sk],
      ["Best division", a.bd, b.bd, "div"],
      ["Best win run", a.ws, b.ws],
      ["Best day streak", a.ds, b.ds]
    );
  const ok = cats.filter(c => c[1] != null && c[2] != null),
    mine = ok.filter(c => c[1] > c[2]).length,
    theirs = ok.filter(c => c[2] > c[1]).length;
  const show = (c, x) => (x == null ? "–" : c[3] === "%" ? x + "%" : c[3] === "div" ? esc(DIVS[x]) : fmt(x));
  const r = rngOf(hash(String(them.id) + dayKey())),
    say = mine > theirs ? pickR(H2H.me, r) : theirs > mine ? pickR(H2H.them, r) : pickR(H2H.level, r);
  const sa = a && specialist(a.ts),
    sb = b && specialist(b.ts);
  return `<div class="hd"><h2>Head to head</h2><span class="eyebrow">You v ${esc(them.name)}</span></div>
  <div class="panel pad h2h"><div class="h2hs"><b class="${mine > theirs ? "w" : ""}">${mine}</b><span>${esc(say)}</span><b class="${theirs > mine ? "w" : ""}">${theirs}</b></div>
  ${ok.map(c => `<div class="h2r"><b class="${c[1] > c[2] ? "w" : ""}">${show(c, c[1])}</b><span>${esc(c[0])}</span><b class="${c[2] > c[1] ? "w" : ""}">${show(c, c[2])}</b></div>`).join("")}
  ${sa || sb ? `<div class="h2r sub"><b>${sa ? esc(sa.best.n) : "–"}</b><span>Specialist subject</span><b>${sb ? esc(sb.best.n) : "–"}</b></div>` : ""}
  ${b ? "" : `<p class="note" style="margin-top:8px">${esc(them.name)} hasn't shared their full stats yet. They'll show once they've played on the latest version.</p>`}</div>`;
}

/* ---------- the profile screen (yours, or another player's) ---------- */
function typesHTML(p, pr) {
  const sp = specialist(pr.ts);
  return `<div class="hd"><h2>By question type</h2><span class="eyebrow">Scoring rate</span></div>
    <div class="panel pad"><div class="types">${typeRates(pr.ts)
      .map(t => `<div class="trow"><span>${esc(t.n)}</span><div class="bar"><i style="width:${Math.max(0, t.pc)}%"></i></div><b>${t.a ? t.pc + "%" : "–"}</b><em>${t.g}/${t.a}</em></div>`)
      .join("")}</div>
    <p class="note" style="margin-top:12px">${
      sp
        ? `${p.me ? "Strongest" : "Their strongest"}: <b>${esc(sp.best.n)}</b>.${sp.worst && sp.worst.k !== sp.best.k ? ` ${p.me ? "Needs work" : "Weak spot"}: <b>${esc(sp.worst.n)}</b>.${p.me ? " Have a go on the training ground." : ""}` : ""}`
        : `A specialist subject shows after ${SPEC_MIN} chances of one type.`
    }</p></div>`;
}
const tilesHTML = pr =>
  `<div class="tiles">${[
    ["Matches", fmt(pr.m)],
    ["Win rate", winRate(pr) != null ? winRate(pr) + "%" : "–"],
    ["Scoring", scoring(pr) != null ? scoring(pr) + "%" : "–"],
    ["Goals", fmt(pr.g)],
    ["Deep cuts", fmt(pr.dc)],
    ["Names", fmt(pr.al)],
    ["Stickers", fmt(pr.sk)],
    ["Best win run", fmt(pr.ws)]
  ]
    .map(t => `<div class="panel tile"><b>${esc(String(t[1]))}</b><span>${t[0]}</span></div>`)
    .join("")}</div>`;
function renderProfile(id) {
  const p = profOf(id);
  if (!p) {
    $("main").innerHTML = `<div class="panel pad"><p class="note">Couldn't find that player. They may have left.</p></div><button class="btn line" data-act="go" data-v="${profBack}">Back</button>`;
    return;
  }
  const pr = p.pr;
  if (!p.me) {
    $("main").innerHTML = `<button class="linkb back" data-act="go" data-v="${profBack}">‹ Back</button>${proCardHTML(p)}
    ${compareHTML(profOf("me"), p)}
    ${pr ? tilesHTML(pr) : ""}
    <div class="panel pad"><div class="statline"><span>${p.season ? "Season " + p.season + " · " : ""}<b>${esc(DIVS[p.div])}</b></span><span>This season <b>${p.rec.p}</b> pts from ${p.rec.pl}</span>${pr ? `<span>Best <b>${esc(DIVS[pr.bd])}</b></span>` : ""}</div></div>
    ${pr ? typesHTML(p, pr) : ""}`;
    return;
  }
  const lv = levelOf(S.xp),
    ri = rankInfo(false);
  const hist = S.hist || [],
    pts = hist.map(h => h.d).concat(S.div),
    W = 640,
    H = 220,
    L = 132,
    X = i => L + (pts.length > 1 ? (i * (W - L - 20)) / (pts.length - 1) : (W - L) / 2),
    Y = d => H - 24 - (d * (H - 48)) / (DIVS.length - 1);
  const path = pts.map((d, i) => (i ? "H" + X(i).toFixed(1) + "V" : "M" + X(i).toFixed(1) + " ") + Y(d).toFixed(1)).join("");
  const chart = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Division by season">${DIVS.map((n, d) => `<line x1="${L - 6}" x2="${W - 10}" y1="${Y(d)}" y2="${Y(d)}" class="gl"/><text x="${L - 12}" y="${Y(d) + 4}" text-anchor="end">${esc(n)}</text>`).join("")}<path d="${path}" class="ln"/>${pts.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="${i === pts.length - 1 ? "now" : "pt"}"><title>Season ${i + 1}: ${esc(DIVS[d])}</title></circle>`).join("")}</svg>`;
  $("main").innerHTML = `${proCardHTML(p)}
  <div class="row"><button class="btn line sm" data-act="sharecard">Share my card</button><button class="btn line sm" data-act="settings">Edit profile</button></div>
  <div class="panel pad streaks"><div><b>${streakNow()}</b><span>Day streak</span></div><div><b>${S.wsk | 0}</b><span>Wins in a row</span></div><div><b>${ri.n > 1 ? ord(ri.pos) : "–"}</b><span>XP ranking</span></div></div>
  ${tilesHTML(pr)}
  <div class="dash two"><div class="col">
    <div class="hd"><h2>The road</h2><span class="eyebrow">Rewards ahead</span></div>${roadHTML(lv)}
    ${typesHTML(p, pr)}
    ${wide() ? `<div class="hd"><h2>Extra time bests</h2></div><div class="panel list">${Object.keys(LONG).map((k, i) => `<button class="li" data-act="long" data-v="${k}"><span class="k">ET${i + 1}</span><span class="tx"><b>${LONG[k].n}</b><span>${S.lb[k] ? "Best: " + S.lb[k] + " named" : "Not played yet"}</span></span><span class="go">›</span></button>`).join("")}</div>` : ""}
  </div><div class="col">
    <div class="hd"><h2>The journey</h2><span class="eyebrow">Division by season</span></div>
    <div class="panel pad">${chart}</div>
    <div class="hd"><h2>Season history</h2></div>
    <div class="panel">${
      hist.length
        ? `<table class="hist"><tr><th>S</th><th>Division</th><th>POS</th><th>W-D-L</th><th>GD</th><th>PTS</th></tr>${hist
            .slice()
            .reverse()
            .map(h => `<tr class="${h.to > h.d ? "up" : h.to < h.d ? "down" : ""}"><td>${h.s}</td><td>${esc(DIVS[h.d])}${h.to > h.d ? '<span class="tag up">UP</span>' : h.to < h.d ? '<span class="tag dn">DOWN</span>' : ""}</td><td>${ord(h.pos)}</td><td>${h.w}-${h.dr}-${h.l}</td><td>${h.gf - h.ga > 0 ? "+" : ""}${h.gf - h.ga}</td><td>${h.pts}</td></tr>`)
            .join("")}</table>`
        : `<p class="note pad">No finished seasons yet. Season ${S.season} is ${S.week.pl} of ${SEASON} matches in.</p>`
    }</div>
  </div></div>
  <p class="foot">Per-type stats and season history started recording on 11 November 2026; titles, frames and wins in a row on 15 November 2026.</p>`;
}
/* the next few levels that give you something */
function roadHTML(lv) {
  const out = [];
  for (let L = lv + 1; out.length < 4 && L < lv + 60; L++) {
    const r = levelRewards(L);
    if (r.length) out.push({ L, r });
  }
  return `<div class="panel list road">${out.map((x, k) => `<div class="li"><span class="k">${x.L}</span><span class="tx"><b>${esc(rewardText(x.r))}</b><span>${fmt(levelAt(x.L - 1) - S.xp)} XP away</span></span>${k === 0 ? '<span class="go nx">NEXT</span>' : ""}</div>`).join("")}</div>
  <p class="note">Wins on the bounce pay up to +${TUNING.winRunCap} XP a match, on top of your matchday streak, objectives and medals.</p>`;
}

/* ---------- home screen level panel (under the streak chip) ---------- */
function levelPanel() {
  const lv = levelOf(S.xp),
    n = nextReward(lv),
    ri = rankInfo(false);
  const nudge = ri.above && ri.n > 1 ? `<b>${fmt(ri.above.xp - S.xp + 1)}</b> XP to overtake ${esc(ri.above.name)} in the rankings` : n ? `Next reward at level ${n.L}: <b>${esc(rewardText(n.r))}</b>` : "";
  return `<button class="panel pad lvp" data-act="go" data-v="me"><div class="statline"><span>${lvChip(S.xp)} <b>${esc(rankOf(lv))}</b></span><span>${xpToGo(S.xp)}</span></div><div class="bar"><i style="width:${lvPct(S.xp, lv).toFixed(1)}%"></i></div>${nudge ? `<p class="xpnext">${nudge}</p>` : ""}</button>`;
}

function shareCard() {
  const p = profOf("me"),
    lv = levelOf(p.xp),
    pr = p.pr,
    sc = scoring(pr),
    sp = specialist(pr.ts);
  return (
    `1X2 · ${p.name}\nLevel ${lv} · ${rankOf(lv)} · ${frameOf(lv).n} card\n${p.club} fan · ${DIVS[p.div]}\n` +
    (sc != null ? `Scoring ${sc}% · ` : "") +
    `${fmt(pr.g)} goals · ${fmt(pr.dc)} deep cuts · ${fmt(pr.md)} medals\n` +
    (sp ? `Specialist subject: ${sp.best.n} (${sp.best.pc}%)\n` : "") +
    "Think you know more ball?" +
    (SHARE_URL ? "\n" + SHARE_URL : "")
  );
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act,
    v = b.dataset.v;
  if (act === "prof") {
    if (v === "me") view = "me";
    else {
      if (view !== "pl") profBack = view;
      profId = v;
      view = "pl";
    }
    M = null;
    render();
  } else if (act === "rclub") {
    rankClub = v === "1";
    renderLeague();
  } else if (act === "settings") profileSheet(false);
  else if (act === "sharecard") {
    SHARE = shareCard();
    doShare();
  }
});
