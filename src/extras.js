/* ============ extras.js: share cards, season stakes, Club Wars, question log, theme of the day, haptics ============
   Loaded after app.js. Everything here is called from app.js at run time; nothing here changes which questions a
   seed produces. */

/* ---------- haptics (optional; toggle sits next to Sound in the profile) ---------- */
const buzz = p => {
  if (S.hap === false || !navigator.vibrate) return;
  try {
    navigator.vibrate(p);
  } catch (e) {}
};

/* ---------- B. share cards: never an answer, a question title or a club from a question. Plain text for WhatsApp. ---------- */
const shareTail = () => `Level ${levelOf(S.xp)} · ${S.club} fan` + (SHARE_URL ? "\n" + SHARE_URL : "");
function shareLeague(o) {
  const mv = o.after < o.before ? `, up ${o.before - o.after}` : o.after > o.before ? `, down ${o.after - o.before}` : "";
  return `1X2 · ${o.div}\n${S.name || "Me"} ${o.a}–${o.b} ${o.opp} ${o.res === "W" ? "✅" : o.res === "D" ? "🤝" : "❌"}\n${pips(o.my)}\n${ord(o.after)} of 20${mv} · ${o.pts} pts from ${o.pl}\n${shareTail()}`;
}
function shareCup(o) {
  const line =
    o.out === "won"
      ? "🏆 Cup winners"
      : o.out === "through"
        ? "Through to the " + o.next.toLowerCase()
        : "Knocked out in the " + o.round.toLowerCase();
  return `1X2 CLUB CUP · ${S.club} · ${o.round}\n${S.name || "Me"} ${o.a}–${o.b} ${o.opp} ${o.win ? "✅" : "❌"}${o.pens ? " (pens)" : ""}\n${pips(o.my)}\n${line}\n${shareTail()}`;
}
function shareGrid() {
  const g = gridState(),
    got = g.c.filter(x => x).length,
    obs = got ? Math.round(g.r.reduce((s, x) => s + x, 0) / got) : 0;
  const nh = gridHints(g); // green: clean, yellow: needed a hint, black: missed
  return `1X2 GRID No. ${gridNo()}\n${[0, 1, 2]
    .map(r =>
      [0, 1, 2]
        .map(c => {
          const k = r * 3 + c;
          return g.c[k] ? (g.h && g.h[k] ? "🟨" : "🟩") : "⬛";
        })
        .join("")
    )
    .join("\n")}\nScore ${gridScore(g)}% · ${got}/9${nh ? " · " + nh + (nh === 1 ? " hint" : " hints") : ""} · Obscurity ${obs}%\n${shareTail()}`;
}
function shareSeason(n) {
  const out = n.to > n.from ? "PROMOTED to " + DIVS[n.to] + " ⬆️" : n.to < n.from ? "Relegated to " + DIVS[n.to] + " ⬇️" : "Staying in " + DIVS[n.to];
  return `1X2 · Season ${n.s || ""} done\n${S.name || "Me"}: ${ord(n.pos)} in ${DIVS[n.from]}, ${n.pts} pts\n${out}\n${shareTail()}`;
}
function shareSticker(tier, club) {
  return `1X2 STICKERS · ${club}\n${tier === "gold" ? "🟨 Gold Icon" : tier === "foil" ? "✨ Foil" : "📄 Paper"} sticker stuck in. Named him from the clues.\n${stkCount()} in the album\n${shareTail()}`;
}

/* ---------- C. season stakes ---------- */
const runIn = () => S.week.pl < SEASON && SEASON - S.week.pl <= TUNING.finalDay;
const runInLabel = () => {
  const left = SEASON - S.week.pl;
  return left === 1 ? "Final Day" : "The run-in · " + left + " to play";
};
/* where the lines are: 4th is the last promotion place, 16th the last safe one */
function stakes(rows) {
  const up = S.div < DIVS.length - 1,
    down = S.div > 0,
    pos = myPos(rows),
    me = rows[pos - 1],
    left = SEASON - S.week.pl,
    o = { up, down, pos, left, lines: [] };
  if (up) {
    if (pos <= 4) {
      const c = me.pts - rows[4].pts;
      o.promo = c > 0 ? `<b>${c}</b> ${c === 1 ? "pt" : "pts"} clear of 5th` : "Ahead of 5th on goal difference only";
      o.promoOk = true;
    } else {
      const g = rows[3].pts - me.pts;
      o.promo =
        g > left * 3
          ? "Promotion is out of reach this season"
          : g > 0
            ? `<b>${g}</b> ${g === 1 ? "pt" : "pts"} off 4th (${rows[3].pts} pts)`
            : "Level with 4th, behind on goal difference";
      o.promoOut = g > left * 3;
    }
  }
  if (down) {
    if (pos >= 17) {
      const g = rows[15].pts - me.pts;
      o.safe =
        g > left * 3
          ? "Safety is out of reach"
          : g > 0
            ? `<b>${g}</b> ${g === 1 ? "pt" : "pts"} from safety (16th has ${rows[15].pts})`
            : "Level with 16th, behind on goal difference";
      o.inDrop = true;
    } else {
      const c = me.pts - rows[16].pts;
      o.safe = c > 0 ? `<b>${c}</b> ${c === 1 ? "pt" : "pts"} clear of the drop` : "Above the drop on goal difference only";
    }
  }
  return o;
}
function stakesHTML(rows) {
  const st = stakes(rows);
  if (!st.up && !st.down) return "";
  return `<div class="panel stakes${runIn() ? " fday" : ""}">${runIn() ? `<div class="fdtag">${runInLabel()}</div>` : ""}<div class="sk">${st.up ? `<div class="${st.promoOk ? "ok" : ""}"><span>Promotion line</span><p>${st.promo}</p></div>` : ""}${st.down ? `<div class="${st.inDrop ? "bad" : ""}"><span>Safety line</span><p>${st.safe}</p></div>` : ""}</div></div>`;
}
/* vidiprinter lines after a match, every one read off the real table before and after. No invented scorelines. */
function aroundYou(before, after) {
  const L = [],
    pb = myPos(before),
    pa = myPos(after),
    up = S.div < DIVS.length - 1,
    down = S.div > 0,
    me = after[pa - 1],
    was = {};
  before.forEach((r, i) => {
    was[r.id] = { i, pts: r.pts };
  });
  const passedMe = after.slice(0, pa - 1).filter(r => was[r.id].i > pb - 1),
    iPassed = after.slice(pa).filter(r => was[r.id].i < pb - 1);
  const names = a =>
    a
      .slice(0, 2)
      .map(r => r.name)
      .join(" AND ") + (a.length > 2 ? " +" + (a.length - 2) : "");
  if (up && pb > 4 && pa <= 4) L.push("INTO THE PROMOTION PLACES");
  else if (up && pb <= 4 && pa > 4) L.push("OUT OF THE PROMOTION PLACES");
  if (down && pb >= 17 && pa <= 16) L.push("OUT OF THE DROP ZONE");
  else if (down && pb <= 16 && pa >= 17) L.push("INTO THE DROP ZONE");
  if (iPassed.length) L.push("UP TO " + ord(pa) + ", ABOVE " + names(iPassed));
  else if (passedMe.length) L.push("OVERTAKEN BY " + names(passedMe) + ", DOWN TO " + ord(pa));
  if (up && pa > 4) {
    const g = after[3].pts - me.pts;
    L.push(g > 0 ? "GAP TO FOURTH: " + g + (g === 1 ? " PT" : " PTS") : "LEVEL ON POINTS WITH FOURTH");
  } else if (up && pa <= 4) {
    const c = me.pts - after[4].pts;
    if (c > 0) L.push(c + (c === 1 ? " PT" : " PTS") + " CLEAR OF FIFTH");
  } else if (down) {
    const c = me.pts - after[16].pts;
    if (pa <= 16 && c > 0) L.push(c + (c === 1 ? " PT" : " PTS") + " CLEAR OF THE DROP");
  }
  // the side directly above or below: what their own result did (read from their points)
  const near = pa > 1 ? after[pa - 2] : after[pa],
    d = near && !near.real && was[near.id] ? near.pts - was[near.id].pts : -1;
  if (near && d >= 0 && L.length < 3) L.push(near.name + (d === 3 ? " WIN" : d === 1 ? " DRAW" : " LOSE"));
  return L.slice(0, 3);
}
const SEASON_SAY = {
  champ: ["Champions. Open-top bus round the estate.", "Top of the pile. Nobody had an answer for you."],
  up: ["Promoted. The questions get nastier from here.", "Going up. Enjoy it before the next lot humble you."],
  stay: ["Neither up nor down. A season of quiet competence.", "Mid-table. The neutral's nightmare."],
  down: ["Relegated. It happens to the best of them, and also to you.", "Down. A summer of hard reading ahead."],
  survive: ["Stayed up. That's all anyone asked.", "Survival. Scrappy, but it counts."]
};
function seasonEndHTML(n) {
  if (!n) return "";
  const up = n.to > n.from,
    dn = n.to < n.from,
    kind = up ? (n.pos === 1 ? "champ" : "up") : dn ? "down" : n.pos >= 13 && n.from > 0 ? "survive" : "stay";
  const say = pickR(SEASON_SAY[kind], rngOf(hash("ss" + (n.s || 0) + S.salt)));
  return `<div class="panel send ${up ? "up" : dn ? "dn" : ""}"><span class="eyebrow">Season ${n.s || ""} · Full time</span>
  <div class="mv"><span>${esc(DIVS[n.from])}</span><i>${up ? "▲" : dn ? "▼" : "="}</i><span>${esc(DIVS[n.to])}</span></div>
  <div class="big">${up ? (n.pos === 1 ? "Champions" : "Promoted") : dn ? "Relegated" : "Staying put"}</div>
  <div class="statline"><span>Finished <b>${ord(n.pos)}</b></span><span><b>${n.pts}</b> pts</span>${n.w !== undefined ? `<span><b>${n.w}</b>W <b>${n.d}</b>D <b>${n.l}</b>L</span>` : ""}</div>
  <p class="note">${esc(say)}</p>${seasonAwards(n)}
  <div class="row"><button class="btn line sm" data-act="shareseason">Copy season result</button><a class="btn line sm" href="https://wa.me/?text=${encodeURIComponent(shareSeason(n))}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
}
/* training XP: full rate for the first TUNING.trainSoftCap chances of the day, then a reduced rate (never zero) */
function trainXp(base) {
  const d = dayKey();
  if (S.tr.d !== d) S.tr = { d, n: 0 };
  S.tr.n++;
  const soft = S.tr.n > TUNING.trainSoftCap;
  if (S.tr.n === TUNING.trainSoftCap + 1) toast("Training legs gone. Half XP till tomorrow.");
  return Math.max(1, Math.round(base * (soft ? TUNING.trainSoftFactor : 1)));
}

/* ---------- E. Club Wars: a club's score is its top ten fans' goals this week, divided by ten ---------- */
function warsTable() {
  const N = TUNING.warsTop,
    mineG = cwNow().gf;
  let rows;
  if (Net.wars) {
    rows = Net.wars.map(r => ({ c: String(r.c).slice(0, 30), total: r.gf | 0, fans: r.fans | 0, filled: Math.min(N, r.filled | 0), cut: r.cut | 0 }));
    if (!Net.uid && S.made) {
      // not signed in: my goals aren't on the server, so count them here
      let m = rows.find(r => r.c === S.club);
      if (!m) {
        m = { c: S.club, total: 0, fans: 0, filled: 0, cut: 0 };
        rows.push(m);
      }
      if (m.filled < N) {
        m.total += mineG;
        m.filled++;
      } else if (mineG > m.cut) m.total += mineG - m.cut;
      m.fans++;
    }
  } else {
    const by = {};
    Net.rows
      .filter(r => r && r.w === weekNo() && r.id !== Net.uid && r.c && r.n)
      .forEach(r => {
        const k = String(r.c).slice(0, 30);
        (by[k] = by[k] || []).push(r.cg | 0);
      });
    (by[S.club] = by[S.club] || []).push(mineG);
    rows = Object.keys(by).map(c => {
      const a = by[c].sort((x, y) => y - x);
      return { c, total: a.slice(0, N).reduce((s, x) => s + x, 0), fans: a.length, filled: Math.min(N, a.length), cut: a.length >= N ? a[N - 1] : 0 };
    });
  }
  rows.forEach(r => {
    r.score = r.total / N;
    r.me = r.c === S.club;
  });
  rows.sort((a, b) => b.score - a.score || b.fans - a.fans || (a.me ? -1 : b.me ? 1 : 0));
  return rows;
}
function warsHTML() {
  const N = TUNING.warsTop,
    rows = warsTable(),
    i = rows.findIndex(r => r.me),
    me = rows[i],
    g = cwNow().gf,
    sc = x => x.toFixed(1);
  const counts = !me || me.filled < N || g >= me.cut,
    above = i > 0 ? rows[i - 1] : null;
  return `<div class="panel"><table><tr><th>#</th><th>Club Wars · this week</th><th>FANS</th><th>PLACES</th><th>SCORE</th></tr>${rows.map((r, k) => `<tr class="${r.me ? "me" : ""}"><td>${k + 1}</td><td>${esc(r.c)}${r.me ? '<span class="tag me">YOURS</span>' : ""}</td><td>${r.fans}</td><td>${r.filled}/${N}</td><td>${sc(r.score)}</td></tr>`).join("")}</table></div>
  <div class="panel pad"><div class="statline"><span>${esc(S.club)}: <b>${me ? me.filled : 0} of ${N}</b> places filled</span><span>Your contribution <b>${g}</b> ${g === 1 ? "goal" : "goals"}</span></div>
  <p class="note" style="margin-top:8px">${counts ? "Your goals count towards the club score." : `The tenth ${esc(S.club)} fan has <b>${me.cut}</b>. Score ${me.cut - g + 1} more to break into the ten.`} ${above ? `<b>${sc(above.score - me.score)}</b> behind ${esc(above.c)}.` : rows.length > 1 ? "Top of the pile. Keep it there." : ""}</p></div>
  <p class="note">A club's score is its <b>top ${N} fans' goals</b> this week, divided by ${N}. Empty places count as nil, so ten decent fans beat one hero. Real fans only, no house sides. Resets in ${countdown()}.${Net.kind === "local" ? " You're playing locally, so only your own club shows here." : Net.kind === "claude" ? " This version can only see the 500 most recent players." : ""}</p>`;
}

/* ---------- G. question log: one small anonymous record per match, for fair-difficulty work later ----------
   [question key, tier, type, scored 0/1, seconds taken] per chance. No user id, no name, nothing that identifies anyone.
   Kept on the device too (last 400 chances) so boffinStats() has something to show offline. */
const QLOG_KEY = "boffin-qlog";
function logMatch() {
  if (!M || !M.rounds || M.mode === "train") return;
  const q = M.my
    .map((ok, k) => [specKey(M.rounds[k]).slice(0, 80), M.tier | 0, M.rounds[k].type, ok ? 1 : 0, Math.min(600, Math.max(0, (M.tt || [])[k] || 0))])
    .slice(0, 10);
  if (!q.length) return;
  const rec = { v: QV.replace("|", ""), d: S.div, q };
  try {
    const a = JSON.parse(localStorage.getItem(QLOG_KEY) || "[]")
      .concat(q.map(x => x.concat(S.div)))
      .slice(-400);
    localStorage.setItem(QLOG_KEY, JSON.stringify(a));
  } catch (e) {}
  Net.log(rec);
}
/* Hidden: type boffinStats() in the browser console. Shared numbers when the server has enough samples, otherwise this device's. */
window.boffinStats = async function (minN) {
  minN = minN || TUNING.logMinSample;
  const shared = await Net.stats(minN);
  if (shared && shared.length) {
    const types = shared
      .filter(r => r.kind === "type")
      .map(r => ({ type: (TYPES[r.key] || {}).n || r.key, division: DIVS[r.d] || r.d, answers: r.n, "correct %": Math.round((r.ok / r.n) * 100) }));
    const qs = shared
      .filter(r => r.kind === "q")
      .map(r => ({ question: r.key, tier: r.d, answers: r.n, "correct %": Math.round((r.ok / r.n) * 100) }))
      .sort((a, b) => a["correct %"] - b["correct %"]);
    console.log("Shared question log (questions with " + minN + "+ answers)");
    console.table(types);
    console.log("Hardest");
    console.table(qs.slice(0, 15));
    console.log("Easiest");
    console.table(qs.slice(-15).reverse());
    return { types, questions: qs };
  }
  let a = [];
  try {
    a = JSON.parse(localStorage.getItem(QLOG_KEY) || "[]");
  } catch (e) {}
  const by = {};
  a.forEach(x => {
    const k = x[2] + "|" + x[5],
      o = (by[k] = by[k] || { type: (TYPES[x[2]] || {}).n || x[2], division: DIVS[x[5]], answers: 0, ok: 0, secs: 0 });
    o.answers++;
    o.ok += x[3];
    o.secs += x[4];
  });
  const types = Object.keys(by)
    .map(k => ({
      type: by[k].type,
      division: by[k].division,
      answers: by[k].answers,
      "correct %": Math.round((by[k].ok / by[k].answers) * 100),
      "avg secs": +(by[k].secs / by[k].answers).toFixed(1)
    }))
    .sort((x, y) => x["correct %"] - y["correct %"]);
  console.log(
    shared
      ? "Not enough shared samples yet. This device only:"
      : "Shared log not available (not connected, or supabase/002_additions.sql not run yet). This device only:"
  );
  console.table(types);
  return { types, questions: [] };
};

/* ---------- H. theme of the day: +50% XP on chances that match. Never changes which questions are generated. ---------- */
const involves = (sp, c) => {
  const t = sp.type,
    nm = CLUB[c];
  if (t === "cell") return (sp.a.t === "c" && sp.a.v === c) || (sp.b.t === "c" && sp.b.v === c);
  if (t === "squad") return sp.c === c;
  if (t === "top") return BD.lists[sp.i][0].indexOf(nm) === 0;
  if (t === "xi") return BD.xi[sp.i][0] === nm || BD.xi[sp.i][1] === nm;
  if (t === "hl") return sp.pairs.some(p => p.some(h => BD.hl[h][1] === c || BD.hl[h][2] === c));
  if (t === "race") return sp.pairs.some(p => BD.lists[p[0]][0].indexOf(nm) === 0);
  if (t === "career") return hasClub(sp.p, c);
  if (t === "mates") {
    const ab = sp.ab || BD.pairs[sp.i];
    return hasClub(ab[0], c) && hasClub(ab[1], c);
  }
  if (t === "odd") return sp.q.indexOf(" " + nm + ".") >= 0;
  if (t === "champ") return sp.qs.some(q => q.c === c || BD.tables[q.t][3].some(r => r[0] === nm));
  if (t === "season") return BD.tables[sp.i][3].some(r => r[0] === nm);
  if (t === "quiz") return quizQs(sp).some(x => x.k.includes(nm));
  return false;
};
const listUnit = i => BD.lists[i][1];
const quizQs = sp => (sp.qs || []).map(q => QB.by[q.id]).filter(Boolean),
  quizTag = (sp, t) => quizQs(sp).some(x => x.tags & QB.tag(t));
/* Derby names and pairings checked against each derby's Wikipedia article on 12/11/2026 (see DATA_SOURCES.md). */
const DERBIES = [
  ["North London derby", "Arsenal", "Tottenham"],
  ["Merseyside derby", "Liverpool", "Everton"],
  ["Manchester derby", "Manchester United", "Manchester City"],
  ["Tyne–Wear derby", "Newcastle", "Sunderland"],
  ["Northwest derby", "Liverpool", "Manchester United"],
  ["Second City derby", "Aston Villa", "Birmingham"],
  ["M23 derby", "Brighton", "Crystal Palace"],
  ["El Clásico", "Real Madrid", "Barcelona"],
  ["Derby della Madonnina", "AC Milan", "Inter"],
  ["Der Klassiker", "Bayern Munich", "Dortmund"]
];
const THEMES = {
  boot: {
    n: "Golden Boot",
    d: "Goals, goals, goals. Scorer lists and 15-goal seasons pay extra.",
    m: sp =>
      (sp.type === "top" && listUnit(sp.i) === "goals") ||
      (sp.type === "race" && sp.pairs.some(p => listUnit(p[0]) === "goals")) ||
      (sp.type === "cell" && (sp.a.t === "g" || sp.b.t === "g"))
  },
  deadline: {
    n: "Deadline Day",
    d: "Transfer fees pay extra. Sky Sports yellow not included.",
    m: sp =>
      sp.type === "hl" ||
      (sp.type === "quiz" && quizTag(sp, "transfer")) ||
      (sp.type === "top" && listUnit(sp.i) === "€m") ||
      (sp.type === "race" && sp.pairs.some(p => listUnit(p[0]) === "€m"))
  },
  invincibles: {
    n: "Invincibles",
    d: "Arsenal, 2003–04. Anything from that season pays extra.",
    m: sp =>
      (sp.type === "quiz" && quizQs(sp).some(x => x.y === 2003 && x.k.includes("Arsenal"))) ||
      (sp.type === "season" && BD.tables[sp.i][0] === "Premier League" && BD.tables[sp.i][1] === 2003) ||
      (sp.type === "champ" && sp.qs.some(q => BD.tables[q.t][0] === "Premier League" && BD.tables[q.t][1] === 2003)) ||
      (sp.type === "xi" &&
        (BD.xi[sp.i][0] === "Arsenal" || BD.xi[sp.i][1] === "Arsenal") &&
        BD.xi[sp.i][3] >= "2003-08-01" &&
        BD.xi[sp.i][3] <= "2004-05-31")
  },
  cult: { n: "Cult Heroes", d: "Score with a deep cut and the chance pays extra.", m: (sp, res) => !!(res && res.deep), late: true },
  title: {
    n: "Title Race",
    d: "Final tables pay extra: who finished where, and when.",
    m: sp => sp.type === "champ" || sp.type === "season" || (sp.type === "quiz" && quizTag(sp, "title"))
  },
  sheet: { n: "Teamsheet Day", d: "Line-ups and squad sheets pay extra.", m: sp => sp.type === "xi" || sp.type === "squad" },
  caps: {
    n: "International Break",
    d: "Any Grid square with a nationality pays extra.",
    m: sp => sp.type === "cell" && (sp.a.t === "n" || sp.b.t === "n")
  },
  road: { n: "Journeymen", d: "Career paths and shared dressing rooms pay extra.", m: sp => sp.type === "career" || sp.type === "mates" }
};
DERBIES.forEach((d, k) => {
  const a = CLUB.indexOf(d[1]),
    b = CLUB.indexOf(d[2]);
  if (a >= 0 && b >= 0)
    THEMES["derby" + k] = {
      n: d[0],
      d: `${d[1]} v ${d[2]}. Any chance involving either club pays extra.`,
      m: sp => involves(sp, a) || involves(sp, b),
      derby: [d[1], d[2]]
    };
});
/* Themes the data can back up, from `node tools/theme-support.js` (share of league chances that match; see tests/out/theme-support.txt).
   Dropped for too few matching questions: listed in DECISIONS.md. */
const THEME_ROTA = ["boot", "deadline", "cult", "title", "sheet", "road", "derby0", "derby1", "derby2", "derby3", "derby4", "derby5", "derby7"];
function themeOfDay(day) {
  const ids = THEME_ROTA.filter(id => THEMES[id]);
  if (!ids.length) return null;
  const id = ids[Math.floor(rngOf(hash("theme" + (day || dayKey())))() * ids.length)];
  return Object.assign({ id }, THEMES[id]);
}
function themeHit(spec, res) {
  const t = themeOfDay();
  if (!t || !spec) return false;
  try {
    return !!t.m(spec, res);
  } catch (e) {
    return false;
  }
}
function themeBanner() {
  const t = themeOfDay();
  return t
    ? `<div class="panel theme"><span class="eyebrow">Theme of the day · +${Math.round(TUNING.themeBonus * 100)}% XP</span><b>${esc(t.n)}</b><p class="note">${esc(t.d)}</p></div>`
    : "";
}
