"use strict";
/* ============ dbx.js (17/11/2026): the 1X2 football database ============
   football.db is built into small JSON chunks (data/x/, see data-pipeline/db/) that load when the player's division needs them.
   Each mode that has DB data gets a maker here; makeMore (rounds-more.js) asks makeDB first and falls back to the older
   makers when the data isn't loaded, so nothing breaks if a chunk fails, the phone is offline on first play, or the
   switch below is off.

   ROLLBACK: in config.js set  useDb: false  (or open the game with ?olddb to test it). The game then never fetches data/x/ and
   every mode runs on data.js + questions.js exactly as before.

   Determinism: a league match must rebuild identically from its seed on every device. Whether the DB is in play changes what a
   seed builds, so match seeds carry an "x" when the DB is ready for the player's tier (qvx() in match.js). */
const DBX = (() => {
  const cfg = window.BOFFIN_CONFIG || {},
    D = { on: cfg.useDb !== false && !/[?&]olddb\b/.test((typeof location !== "undefined" && location.search) || ""), m: null, c: {}, bad: {}, loading: {}, sigV: null, pairs: null };
  // the chunks were built against this data.js: if it ever changes, they are refused (the game falls back) until rebuilt
  D.sig = () => D.sigV || (D.sigV = hash(PL.map(p => p[0]).join("|")).toString(36));
  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  D.init = () => {
    if (!D.on || typeof fetch !== "function") return Promise.resolve(null);
    if (!D.mp) D.mp = getJSON("data/x/manifest.json").then(m => (D.m = m)).catch(() => null);
    return D.mp;
  };
  /* what a division needs: difficulty 1-2 for the bottom, up to 4 at the top. Chunks the manifest doesn't list (a source switched off) are simply not needed. */
  D.need = tier => {
    if (!D.m) return [];
    const want = ["tables", "pals", "six", "gridv", "flags", "scorers", "careers-a"];
    for (let d = 1; d <= Math.min(4, tier + 2); d++) want.push("scores-d" + d);
    if (tier >= 1) want.push("careers-b");
    return want.filter(n => D.m.chunks[n]);
  };
  D.ready = tier => !!(D.on && D.m && D.need(tier).every(n => D.c[n]));
  D.has = n => !!D.c[n];
  D.put = (name, j) => {
    if (!j || j.sig !== D.sig()) { D.bad[name] = 1; return false; }
    D.c[name] = j;
    if (/^scores-d/.test(name)) indexScores(name, j);
    return true;
  };
  D.load = name => {
    if (D.c[name] || D.bad[name]) return Promise.resolve(!!D.c[name]);
    if (!D.loading[name]) D.loading[name] = getJSON("data/x/" + D.m.chunks[name].file).then(j => D.put(name, j)).catch(() => { D.bad[name] = 1; return false; });
    return D.loading[name];
  };
  D.warm = tier => D.init().then(m => (m ? Promise.all(D.need(tier).map(D.load)) : null));
  /* tests and tools: hand over a built manifest and its chunks without a network */
  D.loadFrom = (m, chunks) => {
    D.m = m;
    Object.keys(chunks).forEach(n => D.put(n, chunks[n]));
  };
  return D;
})();

/* ---------- Exact Score: scores go into the shape the existing runtime already plays ---------- */
const XSCORES = []; // {id, d, ...} across the loaded chunks
function indexScores(name, j) {
  const d = +name.slice(-1);
  j.m.forEach(([id, y, md, hi, ai, hg, ag]) => {
    const mo = Math.floor(md / 100),
      dd = md % 100,
      yr = mo >= 7 ? y : y + 1,
      h = j.clubs[hi],
      a = j.clubs[ai],
      x = { id: "x" + id, d, y, home: h, away: a, hg, ag, sub: `Premier League, ${pad(dd)}/${pad(mo)}/${yr}`, k: [h, a] };
    SCORE_BY[x.id] = x;
    XSCORES.push(x);
  });
}

/* ---------- shared bits ---------- */
const XPOS = ["", "GK", "DEF", "MID", "FWD"];
const xMaxD = tier => Math.min(4, tier + 2);
// within the allowed difficulties, lean towards the division's own: weight 3 on it, 2 one away, 1 further
const xW = (d, tier) => Math.max(1, 3 - Math.abs(d - (tier + 1)));
function xPick(list, dOf, tier, r, used) {
  const pool = list.filter(x => !used || !used.has(x));
  if (!pool.length) return null;
  const x = pickW(pool, pool.map(p => xW(dOf(p), tier)), r);
  if (used) used.add(x);
  return x;
}

/* ---------- makers ---------- */
function makeDB(type, r, tier, sc) {
  if (!DBX.ready(tier) || (sc && sc.club !== undefined)) return null; // Club Cup keeps its own club-specific questions
  const maxD = xMaxD(tier);
  if (type === "exact") {
    const pool = XSCORES.filter(x => x.d <= maxD);
    if (pool.length < 30) return null;
    const used = new Set(), qs = [];
    for (let g = 0; qs.length < 3 && g < 40; g++) {
      const x = xPick(pool, p => p.d, tier, r, null);
      if (x && !qs.includes(x.id) && !qs.some(i => SCORE_BY[i].home === x.home || SCORE_BY[i].away === x.away)) qs.push(x.id);
    }
    return qs.length === 3 ? { type, qs, target: [2, 3, 3, 4][tier] } : null;
  }
  if (type === "row" || type === "order") {
    const T = DBX.c.tables && DBX.c.tables.t;
    if (!T) return null;
    const minY = [2012, 2004, 1992, 1992][tier],
      seasons = T.filter(t => t[0] >= minY),
      names = DBX.c.tables.clubs;
    if (seasons.length < 6) return null;
    if (type === "row") {
      const qs = [];
      for (const t of shuffle(seasons, r)) {
        if (qs.length >= 3) break;
        const rows = t[1],
          k = Math.floor(r() * (tier === 0 ? 4 : 6)),
          o = rows.slice(6, 10).map(x => names[x[0]]);
        if (o.length < 3) continue;
        const ans = names[rows[k][0]];
        qs.push({
          t: -t[0],
          k,
          o: shuffle(shuffle(o, r).slice(0, 3).concat(ans), r),
          T: ["Premier League", t[0], 1, rows.slice(0, 6).map(x => [names[x[0]], x[7], x[5], x[6]]), []]
        });
      }
      return qs.length >= 2 ? { type, qs, target: 2 } : null;
    }
    const sets = [];
    for (const t of shuffle(seasons, r)) {
      if (sets.length >= 3) break;
      const rows = t[1],
        top = tier === 0 ? 8 : rows.length,
        pos = [];
      for (let g = 0; g < 40 && pos.length < 4; g++) {
        const p = Math.floor(r() * top);
        if (pos.every(q => Math.abs(q - p) >= 2 && rows[q][7] !== rows[p][7])) pos.push(p);
      }
      if (pos.length < 4) continue;
      pos.sort((a, b) => a - b);
      sets.push({ v: "dtab", t: -t[0], y: t[0], o: pos, it: shuffle(pos.map(p => ({ n: names[rows[p][0]], pos: p + 1, pts: rows[p][7] })), r) });
    }
    return sets.length === 3 ? { type, sets, target: [1, 2, 2, 2][tier] } : null;
  }
  if (type === "pals") {
    const C = DBX.c.pals;
    if (!C) return null;
    const pool = C.p.filter(p => p[5] <= maxD),
      yes = pool.filter(p => p[2]),
      no = pool.filter(p => !p[2]);
    if (yes.length < 20 || no.length < 20) return null;
    const pairs = [],
      used = new Set();
    for (let g = 0; pairs.length < 5 && g < 200; g++) {
      const want = pairs.filter(p => p[2]).length < 2 ? 1 : pairs.filter(p => !p[2]).length < 2 ? 0 : r() < 0.5 ? 1 : 0,
        p = xPick(want ? yes : no, q => q[5], tier, r, null);
      if (!p || used.has(p[0]) || used.has(p[1])) continue;
      used.add(p[0]);
      used.add(p[1]);
      pairs.push([p[0], p[1], p[2], p[3], p[4]]);
    }
    if (pairs.length < 5) return null;
    return { type, x: 1, xk: "xp" + pairs.map(p => p[0] + "." + p[1]).join("_"), pairs: shuffle(pairs, r), target: [3, 4, 4, 4][tier] };
  }
  if (type === "six") {
    const C = DBX.c.six;
    if (!C) return null;
    const pool = C.p.filter(p => p[3] <= maxD);
    if (pool.length < 10) return null;
    const p = xPick(pool, q => q[3], tier, r, null);
    return { type, x: 1, xk: "x6" + p[0] + "." + p[1], a: p[0], b: p[1], need: p[2], v: p[4] }; // v: the valid links (need 1) or [first link, [second links]] pairs (need 2)
  }
  if (type === "buy" || type === "fake") {
    const lists = [DBX.c["careers-a"], tier >= 1 ? DBX.c["careers-b"] : null].filter(Boolean);
    if (!lists.length) return null;
    const people = [];
    lists.forEach(C => C.p.forEach(p => { if (p[2] <= maxD) people.push({ n: p[0], pos: p[1], d: p[2], path: p[3].map(([c, y]) => [C.clubs[c], y]), dec: p[4].map(c => C.clubs[c]) }); }));
    if (people.length < 30) return null;
    const qs = [],
      used = new Set();
    for (let g = 0; qs.length < 3 && g < 80; g++) {
      const p = xPick(people, q => q.d, tier, r, null);
      if (!p || used.has(p.n)) continue;
      if (type === "buy") {
        const k = 1 + Math.floor(r() * (p.path.length - 1)),
          to = p.path[k][0],
          dec = shuffle(p.dec, r).slice(0, 3);
        if (dec.length < 3) continue;
        used.add(p.n);
        qs.push({ n: p.n, f: p.path[k - 1][0], y: p.path[k][1], a: to, o: shuffle(dec.concat(to), r) });
      } else {
        if (p.path.length > 6) continue; // room for the fake on a phone
        const at = 1 + Math.floor(r() * p.path.length), // never first: the first club is where it started
          f = pickR(p.dec, r),
          y0 = p.path[at - 1][1],
          y = at < p.path.length ? y0 + Math.floor(r() * (p.path[at][1] - y0 + 1)) : y0 + 1 + Math.floor(r() * 2);
        used.add(p.n);
        qs.push({ n: p.n, pos: p.pos, path: p.path, at, f, y });
      }
    }
    if (qs.length < 3) return null;
    return type === "buy"
      ? { type, x: 1, xk: "xb" + qs.map(q => q.n).join("."), qs, target: 2 }
      : { type, x: 1, xk: "xf" + qs.map(q => q.n).join("."), sets: qs, target: 2 };
  }
  if (type === "gboot") {
    const C = DBX.c.scorers;
    if (!C || C.s.length < 4) return null;
    const recent = C.s.filter(s => s[0] >= [2016, 2016, 2016, 2016][tier]), pick = pickR(recent, r);
    return { type, x: 1, xk: "xs" + pick[0], y: pick[0], top: pick[1], more: pick[2], target: 2 }; // top: [name, game player] for the top three and anyone level with third
  }
  if (type === "flags") {
    const C = DBX.c.flags;
    if (!C) return null;
    const pool = C.x.filter(x => x[3] <= maxD);
    if (pool.length < 12) return null;
    const qs = [],
      used = new Set();
    for (let g = 0; qs.length < 3 && g < 80; g++) {
      const x = xPick(pool, q => q[3], tier, r, null);
      if (!x || used.has(C.clubs[x[1]]) || qs.some(q => q.y === x[0])) continue;
      const others = [...new Set(C.x.filter(z => z[0] === x[0] && z[1] !== x[1]).map(z => C.clubs[z[1]]))].sort();
      if (others.length < 3) continue;
      used.add(C.clubs[x[1]]);
      qs.push({ y: x[0], c: C.clubs[x[1]], xi: x[2], o: shuffle(shuffle(others, r).slice(0, 3).concat(C.clubs[x[1]]), r) });
    }
    return qs.length === 3 ? { type, x: 1, xk: "xg" + qs.map(q => q.y + q.c).join("."), qs, target: 2 } : null;
  }
  return null;
}

/* ---------- The Grid: players the database knows for each club, so a correct answer isn't marked wrong ---------- */
function dbClubSet(c) {
  const G = DBX.c.gridv;
  if (!G) return null;
  if (!G.by) {
    G.by = {};
    G.c.forEach(([ci, list]) => (G.by[ci] = list));
  }
  return G.by[c] || null;
}
/* validSet widened with what the database adds. Only ever adds. Used to accept answers and count them; picking a cell still uses the plain validSet,
   so the daily Grid is the same for everyone whatever they have downloaded. */
function validSetX(a, b) {
  const base = validSet(a, b);
  if (!DBX.has("gridv")) return base;
  const A = a.t === "c" ? dbClubSet(a.v) : null,
    B = b.t === "c" ? dbClubSet(b.v) : null;
  if (!A && !B) return base;
  const have = new Set(base);
  let extra;
  if (A && B) {
    const sb = new Set(B);
    extra = A.filter(i => sb.has(i));
  } else extra = (A || B).filter(i => fits(i, A ? b : a));
  const add = extra.filter(i => !have.has(i));
  return add.length ? base.concat(add) : base;
}
/* a Grid cell from club pairs the database can fill. Used by makeCell, ~1 in 3 league cells when the data is there. */
function dbCell(r, tier, pl) {
  const G = DBX.c.gridv;
  if (!G) return null;
  if (!DBX.pairs) {
    const sets = G.c.map(([ci, l]) => [ci, new Set(l)]),
      out = [];
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) {
        const [ca, A] = sets[i],
          [cb, B] = sets[j],
          both = [...A].filter(x => B.has(x));
        if (both.length < 3) continue;
        out.push([ca, cb, both.length, both.filter(x => fame(x) >= 5).length, both.filter(x => fame(x) >= 4.5).length]);
      }
    DBX.pairs = out;
  }
  const minV = [8, 6, 4, 3][tier],
    minF = [3, 2, 1, 0][tier],
    ok = DBX.pairs.filter(p => p[2] >= minV && p[3] >= minF && (!pl || (PLC.has(p[0]) && PLC.has(p[1]))));
  if (ok.length < 20) return null;
  const p = pickR(ok, r);
  return { type: "cell", dx: 1, a: { t: "c", v: p[0] }, b: { t: "c", v: p[1] } };
}

/* ---------- runtimes for the specs above (spec.x set) ---------- */
const RUNX = {
  pals(spec) {
    const C = DBX.c.pals,
      N = spec.pairs.length,
      R = tapRun({ rule: `Did they ever play in the same Premier League match for that club? Get ${spec.target} of ${N} right.`, hint: "Premier League, 2016/17 onwards · both on the pitch" }, N, 1000);
    const nm = i => esc(C.names[i][0]),
      ps = i => XPOS[C.names[i][1]] || "";
    R.body = () => {
      if (R.k >= N) return R.pips();
      const [a, b, yes, c] = spec.pairs[R.k],
        s = R.shown,
        cls = v => (s === null ? "" : v === yes ? "right" : s === v ? "wrong" : "");
      return (
        R.pips() +
        `<p class="ask">Ever on the pitch together for ${esc(C.clubs[c])}?<span>Same Premier League match, 2016/17 on</span></p><div class="cats"><div class="cat"><span>${ps(a)}</span><b>${nm(a)}</b></div><div class="amp">+</div><div class="cat"><span>${ps(b)}</span><b>${nm(b)}</b></div></div><div class="yn"><button class="tc ${cls(1)}" data-act="tap" data-v="1"><b>Yes</b></button><button class="tc ${cls(0)}" data-act="tap" data-v="0"><b>Never</b></button></div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      R.answer(+v === spec.pairs[R.k][2], +v);
    };
    R.review = () =>
      `<div class="rv">${spec.pairs.map(([a, b, y, c, n], k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${nm(a)}</span><i>${y ? n + " games" : "never"}</i><span>${nm(b)}</span><small>${esc(C.clubs[c])}</small></div>`).join("")}</div>`;
    R.end = tapEnd(R, N, spec.target, 3);
    return R;
  },
  six(spec) {
    const a = spec.a,
      b = spec.b,
      need = spec.need,
      R = {
        chain: [a],
        tries: 3,
        goal: false,
        over: false,
        picks: [],
        rule: "Link them through team-mates. Each name has to have played in a Premier League match with the last.",
        cover: "Two players. Link them through team-mates, one name at a time. Each has to have been on the pitch with the last one in the Premier League.",
        hint: "Same Premier League match, 2016/17 on · " + (need === 1 ? "one name can do it" : "two names can do it")
      };
    const links = need === 1 ? spec.v : spec.v.map(x => x[0]),
      second = x => (spec.v.find(z => z[0] === x) || [0, []])[1];
    const fail = m => {
      R.tries--;
      msg(m, "bad");
      sfx.no();
      if (R.tries <= 0) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    };
    R.body = () =>
      `<div class="sixw"><div class="sixe"><span>From</span><b>${esc(PL[a][0])}</b></div>${R.chain.slice(1).map(i => `<div class="sixl"><i>↓</i><b>${esc(PL[i][0])}</b></div>`).join("")}${R.goal ? "" : `<div class="sixl q"><i>↓</i><b>?</b></div>`}<div class="sixe to"><span>To</span><b>${esc(PL[b][0])}</b></div></div><div class="tries">${[0, 1, 2].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${R.chain.length - 1} ${R.chain.length === 2 ? "link" : "links"} so far · ${need === 1 ? "one name does it" : "two names do it"}</span></div>`;
    R.onPick = i => {
      if (R.over || i < 0) return;
      if (R.chain.includes(i) || i === b) return msg(i === b ? "That's where you're going." : "He's already in the chain.", "");
      const step = R.chain.length; // 1 = first link, 2 = second
      if (need === 1) {
        if (links.includes(i)) {
          R.chain.push(i);
          R.picks.push(i);
          R.goal = true;
          R.over = true;
          msg(PL[i][0] + " played with both. Linked.", "good");
          sfx.tick();
          return ctx.done();
        }
        return fail(PL[i][0] + " didn't play with both of them.");
      }
      if (step === 1) {
        if (links.includes(i)) {
          R.chain.push(i);
          R.picks.push(i);
          sfx.tick();
          msg(PL[i][0] + ". One more to go.", "good");
          return ctx.paint();
        }
        return fail("No route through " + PL[i][0] + ".");
      }
      if (second(R.chain[1]).includes(i)) {
        R.chain.push(i);
        R.picks.push(i);
        R.goal = true;
        R.over = true;
        msg(PL[i][0] + " played with " + PL[b][0] + ". Linked.", "good");
        sfx.tick();
        return ctx.done();
      }
      return fail(PL[i][0] + " doesn't link up from " + PL[R.chain[1]][0] + ".");
    };
    R.review = () => {
      const show = (l, n) => l.slice().sort((x, y) => PL[y][4] - PL[x][4]).slice(0, n).map(i => esc(PL[i][0])).join("</b>, <b>");
      return need === 1
        ? `<p class="note">One-name links: <b>${show(spec.v, 4)}</b>${spec.v.length > 4 ? " and " + (spec.v.length - 4) + " more" : ""}.</p>`
        : `<p class="note">No single player links them. It takes two, for instance <b>${esc(PL[spec.v[0][0]][0])}</b> then <b>${esc(PL[spec.v[0][1][0]][0])}</b>.</p>`;
    };
    R.end = () => {
      const n = R.chain.length - 1;
      return R.goal
        ? { goal: true, xp: 30 + 30, deep: need === 2, html: `<p>${[a].concat(R.chain.slice(1), b).map(i => "<b>" + esc(PL[i][0]) + "</b>").join(" › ")}</p><p>${n <= need ? "Shortest route there is." : "Got there."}</p>` }
        : { goal: false, xp: 0, html: `<p>Couldn't link <b>${esc(PL[a][0])}</b> to <b>${esc(PL[b][0])}</b>.</p>` };
    };
    return R;
  },
  buy(spec) {
    const N = spec.qs.length,
      R = tapRun({ rule: `Who signed him? Get ${spec.target} of ${N} right.` }, N, 1100);
    R.body = () => {
      if (R.k >= N) return R.pips();
      const q = spec.qs[R.k],
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${esc(q.n)}<span>Left ${esc(q.f)}. Joined who in ${q.y}?</span></p><div class="quad sm">${q.o.map((c, j) => `<button class="tc ${s === null ? "" : c === q.a ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(c)}</b></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const q = spec.qs[R.k];
      R.answer(q.o[+v] === q.a, +v);
    };
    R.review = () => `<div class="rv">${spec.qs.map((q, k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(q.n)} <em>left ${esc(q.f)}</em></span><i>to</i><span class="w">${esc(q.a)} <em>${q.y}</em></span></div>`).join("")}</div>`;
    R.end = tapEnd(R, N, spec.target, 5);
    return R;
  },
  fake(spec) {
    const N = spec.sets.length,
      R = tapRun({ rule: `One move in each career never happened. Tap it. Get ${spec.target} of ${N} right.` }, N, 1300);
    const withFake = st => {
      const path = st.path.slice();
      path.splice(st.at, 0, [st.f, st.y, 1]);
      return path;
    };
    R.body = () => {
      if (R.k >= N) return R.pips();
      const st = spec.sets[R.k],
        path = withFake(st),
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${esc(st.n)}<span>${XPOS[st.pos] ? XPOS[st.pos] + " · " : ""}clubs in the order he joined them</span></p><div class="fakep">${path.map((c, j) => `${j ? "<i>›</i>" : ""}<button class="${s === null ? "" : j === st.at ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}">${esc(c[0])}<em>'${String(c[1]).slice(2)}</em></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      R.answer(+v === spec.sets[R.k].at, +v);
    };
    R.end = () =>
      Object.assign(tapEnd(R, N, spec.target, 5)(), {
        after: `<div class="panel pad"><p class="note">The fakes: ${spec.sets.map(st => "<b>" + esc(st.n) + "</b> never played for " + esc(st.f)).join(", ")}.</p></div>`
      });
    return R;
  },
  flags(spec) {
    const N = spec.qs.length,
      R = tapRun({ rule: `Whose most-used XI is this? Get ${spec.target} of ${N} right.` }, N, 1300);
    // rows by position: forwards at the top, goalkeeper at the bottom
    const place = xi => {
      const rows = { 4: [], 3: [], 2: [], 1: [] },
        Y = { 4: 15, 3: 38, 2: 62, 1: 88 };
      xi.forEach(p => rows[p[2]].push(p));
      const out = [];
      for (const k of [4, 3, 2, 1]) rows[k].forEach((p, i) => out.push({ p, x: ((i + 1) / (rows[k].length + 1)) * 100, y: Y[k] }));
      return out;
    };
    R.body = () => {
      if (R.k >= N) return R.pips();
      const q = spec.qs[R.k],
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${seasonLabel(q.y)}<span>${s === null ? "most-used XI, flags only" : esc(q.c)}</span></p><div class="pitchwrap flagp">${place(q.xi)
          .map(({ p, x, y }) => `<span class="fl" style="left:${x}%;top:${y}%"><b>${flagOf(p[0]) || "·"}</b><em>${s === null ? (p[0] >= 0 ? natCode(p[0]) : "?") : esc(p[1])}</em></span>`)
          .join("")}</div><div class="quad sm">${q.o.map((c, j) => `<button class="tc ${s === null ? "" : c === q.c ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(c)}</b></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const q = spec.qs[R.k];
      R.answer(q.o[+v] === q.c, +v);
    };
    R.end = () =>
      Object.assign(tapEnd(R, N, spec.target, 5)(), {
        after: `<div class="panel pad"><p class="note">${spec.qs.map(q => "<b>" + esc(q.c) + "</b>, " + seasonLabel(q.y)).join("; ")}.</p></div>`
      });
    return R;
  }
};
/* Golden Boot: name two of a season's top three scorers (anyone level with third counts). Typed, so only players the game's search can find are in the answer set. */
RUNX.gboot = spec => {
  const R = { found: [], tries: 3, over: false, picks: [], goal: false, rule: `Name ${spec.target} of the top three scorers in the Premier League ${seasonLabel(spec.y)}. Level on goals with third counts.`, hint: "Premier League goals, by player" };
  R.title = "Golden Boot " + seasonLabel(spec.y);
  const names = rev => (rev ? spec.top.map(t => esc(t[0])) : R.found.map(i => esc(PL[i][0])));
  R.body = rev =>
    `<p class="rule" style="color:var(--text);font-weight:600">${seasonLabel(spec.y)} · Premier League top scorers</p><div class="chips">${R.found.map(i => `<span class="hit">${esc(PL[i][0])}</span>`).join("")}${rev ? "" : Array.from({ length: Math.max(0, spec.target - R.found.length) }, () => "<span>?</span>").join("")}</div>${
      rev ? `<p class="note">The top ${spec.top.length === 3 ? "three" : "scorers"}: <b>${names(true).join("</b>, <b>")}</b>.</p>` : ""
    }<div class="tries">${[0, 1, 2].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${R.found.length} of ${spec.target} · ${R.tries} ${R.tries === 1 ? "try" : "tries"} left</span></div>`;
  R.onPick = i => {
    if (R.over || i < 0) return;
    if (R.found.includes(i)) return msg("Already got him.", "");
    if (spec.top.some(t => t[1] === i)) {
      R.found.push(i);
      R.picks.push(i);
      sfx.tick();
      msg(PL[i][0] + ". Right.", "good");
      if (R.found.length >= spec.target) {
        R.goal = true;
        R.over = true;
        return ctx.done();
      }
      return ctx.paint();
    }
    R.tries--;
    msg(PL[i][0] + " wasn't in the top three that season.", "bad");
    sfx.no();
    if (R.tries <= 0) {
      R.over = true;
      ctx.done();
    } else ctx.paint();
  };
  R.end = () => ({
    goal: R.goal,
    xp: R.goal ? 30 + 6 * R.found.length : 5 * R.found.length,
    html: `<p>You named <b>${R.found.length}</b> of ${spec.target}.</p>`,
    after: R.body(true)
  });
  return R;
};
RUN.gboot = RUNX.gboot;
Object.keys(RUNX).filter(t => t !== "gboot").forEach(t => {
  const old = RUN[t];
  RUN[t] = spec => (spec && spec.x ? RUNX[t](spec) : old(spec));
});
