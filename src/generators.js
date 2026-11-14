"use strict";
/* ============ generators.js: question makers. Pure and seeded: the same seed must always build the same questions (bump QV if that changes) ============ */
/* ============ round makers (pure, seeded) ============ */
const CAREERS = ALLIDX.filter(i => PL[i][7] & 64 && clubsOf(i).length >= 3);
function makeCell(r, tier, sc) {
  sc = sc || {};
  const nC = [16, 26, 38, 99][tier],
    nN = [8, 12, 18, 26][tier],
    minV = sc.club !== undefined ? [5, 4, 3, 2][tier] : [8, 6, 4, 3][tier],
    minF = sc.club !== undefined ? [2, 1, 1, 0][tier] : [3, 2, 1, 0][tier];
  const gc = sc.pl ? PLGRID.slice(0, [11, 16, 22, 99][tier]) : BD.gridClubs.slice(0, nC),
    gn = BD.gridNats.slice(0, nN);
  for (let k = 0; k < 120; k++) {
    const a = { t: "c", v: sc.club !== undefined ? sc.club : pickR(gc, r) };
    let b;
    const x = r();
    if (sc.pl || sc.club !== undefined) {
      const pool = sc.club !== undefined && PLC.has(sc.club) ? PLGRID.slice(0, [11, 16, 22, 99][tier]) : gc;
      if (x < 0.5) b = { t: "c", v: pickR(pool, r) };
      else if (x < 0.9 || tier === 0) b = { t: "n", v: pickR(gn, r) };
      else b = { t: "g", v: 0 };
      if (sameCat(a, b)) continue;
      const v = validSet(a, b);
      if (v.length >= minV && v.filter(i => fame(i) >= 5).length >= minF) return { type: "cell", a, b };
      continue;
    }
    if (x < 0.5) b = { t: "c", v: pickR(gc, r) };
    else if (x < 0.86 || tier === 0) b = { t: "n", v: pickR(gn, r) };
    else if (x < 0.94) b = { t: "l", v: Math.floor(r() * 5) };
    else b = { t: "g", v: 0 };
    if (sameCat(a, b)) continue;
    const v = validSet(a, b);
    if (v.length >= minV && v.filter(i => fame(i) >= 5).length >= minF) return { type: "cell", a, b };
  }
  return { type: "cell", a: { t: "c", v: BD.gridClubs[0] }, b: { t: "c", v: BD.gridClubs[1] } };
}
function specKey(x) {
  if (!x) return "";
  const t = x.type;
  if (t === "cell") return "c" + x.a.t + x.a.v + x.b.t + x.b.v;
  if (t === "top") return "t" + x.i;
  if (t === "xi") return "x" + x.i;
  if (t === "season") return "s" + x.i;
  if (t === "mates") return "m" + (x.ab ? x.ab.join(".") : x.i);
  if (t === "career") return "p" + x.p;
  if (t === "squad") return "q" + x.c + "." + x.y;
  if (t === "hl" || t === "race") return t[0] + x.pairs.map(q => q.join(".")).join("_");
  if (t === "odd") return "o" + x.sets.map(z => z.o[z.x]).join(".");
  if (t === "champ") return "k" + x.qs.map(q => q.t + "." + (q.p !== undefined ? q.p : q.c)).join("_");
  if (t === "quiz") return "z" + x.qs.map(q => q.id).join(".");
  if (MORE_TYPES.includes(t)) return moreKey(x);
  return t;
}
const isSeen = x => !!x && (S.seen || []).includes(specKey(x));
function markSeen(x) {
  const k = specKey(x);
  if (!k) return;
  S.seen = (S.seen || [])
    .filter(y => y !== k)
    .concat(k)
    .slice(-400);
}
function makeRound(type, r, tier, sc, any) {
  let x = null;
  for (let k = 0; k < 6; k++) {
    x = makeRound0(type, r, tier, sc);
    if (any || !x || !isSeen(x)) return x;
  }
  return x;
}
/* ---------- fair for the division (14/11/2026) ----------
   The name-a-player rounds are only as fair as their best-known answers. These limits were set against
   `node tools/difficulty.js`, which builds league matches from seeds and counts them. Index = tier
   (0 Sunday League/Non-League, 1 League Two/One, 2 Championship/Top Flight, 3 European Nights/Knows Ball).
   "Known" is fame 4.5+, "famous" is 5.0+. Club Cup rounds are exempt: a small club's data can't always meet them. */
const EASE = {
  linkValid: [8, 6, 4, 3], // The Link: at least this many right answers...
  linkFamous: [3, 2, 1, 0], // ...of which this many are famous
  squadSpare: [3, 2, 0, 0], // Squad Sheet: known players in the squad beyond the number you have to name
  topSpare: [2, 1, 0, 0], // Top Ten: known names in the list beyond the number you have to name
  xiFloor: [40, 30, 20, 1], // Missing XI: the least-known hidden player's line-up score (0 = not in the records)
  careerFame: [5.6, 5.1, 4.4, 3.9], // Career Path: the player's fame
  careerFameClub: [4.6, 4.2, 3.8, 3.4]
};
const knownN = (v, t) => v.filter(i => fame(i) >= t).length;
function fairEnough(x, tier) {
  const t = x.type;
  if (t === "mates") {
    const [a, b] = x.ab || BD.pairs[x.i],
      v = ALLIDX.filter(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b));
    return v.length >= EASE.linkValid[tier] && knownN(v, 5) >= EASE.linkFamous[tier];
  }
  if (t === "squad") return knownN(squadOf(x.c, x.y), 4.5) >= x.target + EASE.squadSpare[tier];
  if (t === "top") return knownN(BD.lists[x.i][3].map(it => it[0]), 4.5) >= x.target + EASE.topSpare[tier];
  if (t === "xi") return Math.min(...x.blanks.map(k => BD.xi[x.i][6][k][2])) >= EASE.xiFloor[tier];
  return true;
}
/* The Link's pairs for a tier (pl = both players played in the Premier League), keeping only pairs with enough
   right answers and enough famous ones. Worked out once per tier and kept. */
const PAIRSTAT = {},
  FAIRPAIRS = {};
function pairStat(i) {
  if (!PAIRSTAT[i]) {
    const [a, b] = BD.pairs[i],
      v = ALLIDX.filter(k => k !== a && k !== b && PL[k][6].length && overlaps(k, a) && overlaps(k, b));
    PAIRSTAT[i] = [v.length, knownN(v, 5)];
  }
  return PAIRSTAT[i];
}
function fairPairs(tier, pl) {
  const key = tier + (pl ? "p" : "a");
  if (!FAIRPAIRS[key]) {
    const n = Math.min([150, 300, 500, 700][tier], BD.pairs.length),
      base = BD.pairs.map((p, i) => i).slice(0, n).filter(i => !pl || (isPLp(BD.pairs[i][0]) && isPLp(BD.pairs[i][1]))),
      fair = base.filter(i => pairStat(i)[0] >= EASE.linkValid[tier] && pairStat(i)[1] >= EASE.linkFamous[tier]);
    FAIRPAIRS[key] = fair.length >= 12 ? fair : base;
  }
  return FAIRPAIRS[key];
}
/* one round: up to ten seeded attempts to find one that's fair for the division, then take what comes */
function makeRound0(type, r, tier, sc) {
  let x = null;
  const club = sc && sc.club !== undefined;
  for (let k = 0; k < 10; k++) {
    x = makeRaw(type, r, tier, sc);
    if (!x || club || fairEnough(x, tier)) return x;
  }
  return x;
}
function makeRaw(type, r, tier, sc) {
  if (sc && (sc.pl || sc.club !== undefined)) {
    const x = makeScoped(type, r, tier, sc);
    if (x) return x;
    if (sc.club !== undefined) return null;
  }
  if (type === "squad" || type === "odd" || type === "race" || type === "champ") return makeScoped(type, r, tier, {});
  if (MORE_TYPES.includes(type)) return makeMore(type, r, tier, {}) || makeCell(r, tier); // data can't support it this time: a Grid instead
  if (type === "cell") return makeCell(r, tier);
  if (type === "quiz") return makeQuiz(r, tier, null) || makeScoped("champ", r, tier, {}); // no bank on this device: a Final Standings round instead
  if (type === "top") {
    const pool = BD.lists.map((l, i) => i).filter(i => BD.lists[i][2] <= tier + 1);
    return { type, i: pickR(pool, r), target: [3, 4, 4, 5][tier] };
  }
  if (type === "xi") {
    const pool = BD.xi.map((l, i) => i).filter(i => BD.xi[i][5] <= tier + 1),
      i = pickR(pool, r);
    const order = BD.xi[i][6].map((p, k) => k).sort((a, b) => BD.xi[i][6][b][2] - BD.xi[i][6][a][2]),
      idx = shuffle(order.slice(0, [5, 7, 9, 11][tier]), r).slice(0, 3);
    return { type, i, blanks: idx, target: 2 };
  }
  if (type === "mates") {
    const pool = fairPairs(tier, false);
    return { type, i: pickR(pool, r) };
  }
  if (type === "career") {
    const thr = EASE.careerFame[tier],
      pool = CAREERS.filter(i => fame(i) >= thr);
    return { type, p: pickR(pool, r) };
  }
  if (type === "hl") {
    const n = [250, 450, 700, 900][tier],
      ratio = [1.5, 1.35, 1.25, 1.15][tier],
      pairs = [];
    let guard = 0;
    while (pairs.length < 5 && guard++ < 400) {
      const a = Math.floor(r() * n),
        b = Math.floor(r() * n),
        fa = BD.hl[a][4],
        fb = BD.hl[b][4];
      if (a !== b && BD.hl[a][0] !== BD.hl[b][0] && Math.max(fa, fb) / Math.min(fa, fb) >= ratio) pairs.push([a, b]);
    }
    return { type, pairs, target: tier ? 4 : 3 };
  }
  const pool = BD.tables.map((t, i) => i).filter(i => BD.tables[i][2] <= tier + 1 && (tier > 1 || BD.tables[i][0] === "Premier League"));
  return { type: "season", i: pickR(pool, r), tol: tier === 3 ? 0 : 1 };
}
/* League matches must rebuild identically from their seed (so ghosts replay the same five chances), so they never skip seen questions inside a seed.
   Instead we try a few seed variants and keep the freshest. */
function makeMatch(seed, tier) {
  const r = rngOf(hash("m" + seed));
  let types = shuffle(Object.keys(TYPES), r).slice(0, 5);
  if (!types.includes("cell")) types[0] = "cell";
  return types.map(t => makeRound(t, r, tier, r() < 0.7 ? { pl: 1 } : null, true));
}
function freshSeed(seed, tier) {
  let best = seed,
    bestN = 9;
  for (let k = 0; k < 6; k++) {
    const sd = k ? seed + "~" + k : seed,
      n = makeMatch(sd, tier).filter(isSeen).length;
    if (n < bestN) {
      best = sd;
      bestN = n;
    }
    if (!n) break;
  }
  return best;
}
/* Pub Quiz: three questions from the bank. Difficulty follows the division (Sunday League gets d1-2, the top gets everything),
   Club Cup uses only questions about the club, and no two questions in a round come from the same template.
   Never looks at S.seen: league rounds must rebuild identically from their seed (makeRound handles freshness). */
function makeQuiz(r, tier, sc) {
  const club = sc && sc.club !== undefined ? CLUB[sc.club] : null,
    maxD = Math.max(2, tier + 1);
  let pool = QB.all.filter(x => x.d <= maxD && (!club || x.k.includes(club)));
  if (club && pool.length < 12) pool = QB.all.filter(x => x.k.includes(club)); // smaller clubs: any difficulty rather than nothing
  if (pool.length < 3) return null;
  const picks = [];
  for (let g = 0; picks.length < 3 && g < 80; g++) {
    const x = pickR(pool, r);
    if (!picks.some(p => p.id === x.id || (g < 60 && p.t === x.t))) picks.push(x);
  }
  if (picks.length < 3) return null;
  return {
    type: "quiz",
    qs: picks.map(x => ({
      id: x.id,
      o: shuffle(
        Array.from({ length: 1 + x.o.length }, (_, k) => k),
        r
      )
    })),
    target: 2
  };
}
/* Scoped rounds: sc.pl = Premier League only, sc.club = one club only. Returns null if the data can't support it. */
function makeScoped(type, r, tier, sc) {
  const C = sc.club,
    club = C !== undefined,
    pl = !!sc.pl;
  if (type === "cell") return makeCell(r, tier, sc);
  if (type === "quiz") return makeQuiz(r, tier, sc);
  if (MORE_TYPES.includes(type)) return makeMore(type, r, tier, sc);
  if (type === "top") {
    let pool = club ? listsOf(C) : pl ? PLLISTS.filter(i => BD.lists[i][2] <= tier + 1) : BD.lists.map((l, i) => i);
    if (!pool.length) return null;
    return { type, i: pickR(pool, r), target: club ? [3, 3, 4, 5][tier] : [3, 4, 4, 5][tier] };
  }
  if (type === "xi") {
    const pool = BD.xi
      .map((l, i) => i)
      .filter(i => (club ? BD.xi[i][0] === CLUB[C] : BD.xi[i][4].indexOf("Premier League") === 0 && BD.xi[i][5] <= tier + 1));
    if (!pool.length) return null;
    const i = pickR(pool, r),
      order = BD.xi[i][6].map((p, k) => k).sort((a, b) => BD.xi[i][6][b][2] - BD.xi[i][6][a][2]),
      idx = shuffle(order.slice(0, [5, 7, 9, 11][tier]), r).slice(0, 3);
    return { type, i, blanks: idx, target: 2 };
  }
  if (type === "mates") {
    if (club) {
      let thr = [5, 4.5, 4, 3.5][tier],
        base = clubPl[C].filter(i => PL[i][6].length && fame(i) >= thr);
      while (base.length < 10 && thr > 2.4) {
        thr -= 0.3;
        base = clubPl[C].filter(i => PL[i][6].length && fame(i) >= thr);
      }
      if (base.length < 6) return null;
      for (let g = 0; g < 14; g++) {
        const a = pickR(base, r),
          b = pickR(base, r);
        if (a === b) continue;
        let n = 0;
        for (let i = 0; i < PL.length && n < 3; i++) if (i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b)) n++;
        if (n >= 3) return { type, ab: [a, b] };
      }
      return null;
    }
    const pool = fairPairs(tier, true);
    if (!pool.length) return null;
    return { type, i: pickR(pool, r) };
  }
  if (type === "career") {
    const thr = club ? EASE.careerFameClub[tier] : EASE.careerFame[tier],
      pool = CAREERS.filter(i => fame(i) >= thr && (club ? hasClub(i, C) : isPLp(i)));
    if (!pool.length) return null;
    return { type, p: pickR(pool, r) };
  }
  if (type === "hl") {
    const pool = BD.hl.map((h, i) => i).filter(i => (club ? BD.hl[i][1] === C || BD.hl[i][2] === C : PLC.has(BD.hl[i][2])));
    if (pool.length < 8) return null;
    const ratio = club ? 1.12 : [1.5, 1.35, 1.25, 1.15][tier],
      pairs = [];
    let guard = 0;
    while (pairs.length < 5 && guard++ < 600) {
      const a = pickR(pool, r),
        b = pickR(pool, r),
        fa = BD.hl[a][4],
        fb = BD.hl[b][4];
      if (a !== b && BD.hl[a][0] !== BD.hl[b][0] && Math.max(fa, fb) / Math.min(fa, fb) >= ratio && !pairs.some(q => q.includes(a) && q.includes(b)))
        pairs.push([a, b]);
    }
    return pairs.length === 5 ? { type, pairs, target: tier ? 4 : 3 } : null;
  }
  if (type === "season") {
    const pool = BD.tables.map((t, i) => i).filter(i => (club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : BD.tables[i][0] === "Premier League"));
    if (pool.length < 2) return null;
    return { type, i: pickR(pool, r), tol: tier === 3 ? 0 : 1 };
  }
  if (type === "squad") {
    const c = club ? C : pickR(pl ? sqClubs.filter(x => PLC.has(x)) : sqClubs, r);
    if (c === undefined) return null;
    const ys = [];
    for (let y = 0; y < SQN; y++) if (squadOf(c, y).length >= 15) ys.push(y);
    if (!ys.length) return null;
    return { type, c, y: pickR(ys, r), target: [3, 3, 4, 5][tier] };
  }
  if (type === "odd") {
    let thr = club ? [5, 4.6, 4.2, 3.8][tier] : [5.6, 5.2, 4.8, 4.4][tier];
    const sets = [];
    if (club) while (clubPl[C].filter(i => fame(i) >= thr).length < 12 && thr > 3) thr -= 0.3;
    let ins, outs, q;
    if (club) {
      ins = clubPl[C].filter(i => fame(i) >= thr);
      const lg = PLC.has(C) ? 1 : PL[clubPl[C][0]][7] & 31 || 1;
      outs = ALLIDX.filter(i => fame(i) >= thr && !hasClub(i, C) && PL[i][7] & lg);
      q = `Three played for ${CLUB[C]}. Who never did?`;
    } else {
      ins = ALLIDX.filter(i => fame(i) >= thr && isPLp(i));
      outs = ALLIDX.filter(i => fame(i) >= thr + 0.2 && !isPLp(i) && PL[i][7] & 30 && !clubsOf(i).some(c => PLC.has(c)));
      q = "Three played in the Premier League. Who never did?";
    }
    if (ins.length < 9 || outs.length < 3) return null;
    const used = new Set();
    for (let g = 0; sets.length < 3 && g < 60; g++) {
      const three = shuffle(
          ins.filter(i => !used.has(i)),
          r
        ).slice(0, 3),
        mid = three.reduce((a, i) => a + PL[i][3], 0) / 3;
      const near = outs.filter(i => !used.has(i) && Math.abs(PL[i][3] - mid) <= 8),
        o = pickR(near.length ? near : outs, r);
      if (o === undefined || three.length < 3) continue;
      three.concat(o).forEach(i => used.add(i));
      const opts = shuffle(three.concat(o), r);
      sets.push({ o: opts, x: opts.indexOf(o) });
    }
    return sets.length === 3 ? { type, q, sets, target: 2 } : null;
  }
  if (type === "race") {
    const pool = club ? listsOf(C) : pl ? PLLISTS : BD.lists.map((l, i) => i);
    if (!pool.length) return null;
    const gap = [4, 3, 2, 1][tier],
      pairs = [];
    let guard = 0;
    while (pairs.length < 5 && guard++ < 300) {
      const li = pickR(pool, r),
        it = BD.lists[li][3],
        a = Math.floor(r() * it.length),
        b = Math.floor(r() * it.length);
      if (Math.abs(a - b) >= gap && it[a][1] !== it[b][1] && !pairs.some(q => q[0] === li && q.includes(a) && q.includes(b))) pairs.push([li, a, b]);
    }
    return pairs.length === 5 ? { type, pairs, target: [3, 3, 4, 4][tier] } : null;
  }
  if (type === "champ") {
    const pool = BD.tables
      .map((t, i) => i)
      .filter(i =>
        club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : (pl ? BD.tables[i][0] === "Premier League" : true) && BD.tables[i][2] <= tier + 1
      );
    if (pool.length < 2) return null;
    const pick = shuffle(pool, r).slice(0, 3);
    const qs = pick.map(ti =>
      club ? { t: ti, c: C } : { t: ti, p: tier === 0 ? 0 : tier === 1 ? Math.floor(r() * 2) : Math.floor(r() * 4), o: shuffle([0, 1, 2, 3], r) }
    );
    return { type, qs, target: qs.length >= 3 ? 2 : qs.length };
  }
  return null;
}
