"use strict";
/* ============ rounds-more.js (14/11/2026): eight more question types, makers and runtimes together ============
   Six Degrees, Ever Team-mates?, Spot the Fake, Who Bought Him?, Hidden Row, In Order, Flag XI, Exact Score.
   Makers are pure and seeded like generators.js (same seed, same questions; bump QV if that changes).
   Runtimes follow the RUN shape in rounds.js: rule, body(rev), onTap / onPick, end(), optional review() and cover. */

/* ---------- shared data helpers ---------- */
const SSP = ALLIDX.filter(i => PL[i][6].length); // players with season-by-season squad records (2010 on)
const TMATES = {};
function tmOf(i) {
  // everyone who shared a squad with i in the season records, kept once worked out
  if (!TMATES[i]) TMATES[i] = PL[i][6].length ? SSP.filter(j => j !== i && overlaps(i, j)) : [];
  return TMATES[i];
}
const spellClubs = i => {
  const a = PL[i][6],
    out = [];
  for (let k = 0; k < a.length; k += 3) if (!out.includes(a[k])) out.push(a[k]);
  return out;
};
const joinYear = (i, c) => {
  const a = PL[i][5];
  for (let k = 0; k < a.length; k += 2) if (a[k] === c) return a[k + 1] + 1990;
  return null;
};
/* line-up names to player rows (line-ups store names, not indexes). Same name twice: the better-known one. */
const NAME2IDX = {};
PL.forEach((p, i) => {
  const k = norm(p[0]);
  if (NAME2IDX[k] === undefined || PL[NAME2IDX[k]][4] < p[4]) NAME2IDX[k] = i;
});
const isClubXI = x => !/World Cup|Euro|Copa/.test(x[4]);
const xiSeason = x => x[4].replace(/,.*$/, "");
/* flags: ISO codes for the nations in the data. Home nations use the tag-sequence flags; anything missing shows its code. */
const ISO = {
  Spain: "ES", Italy: "IT", France: "FR", Germany: "DE", Brazil: "BR", Argentina: "AR", Portugal: "PT", Netherlands: "NL", Serbia: "RS", Senegal: "SN",
  Uruguay: "UY", Denmark: "DK", Croatia: "HR", Belgium: "BE", "Rep. of Ireland": "IE", Sweden: "SE", Switzerland: "CH", "Ivory Coast": "CI", Morocco: "MA",
  Poland: "PL", Nigeria: "NG", Ghana: "GH", Cameroon: "CM", Turkey: "TR", USA: "US", Mali: "ML", Colombia: "CO", "Czech Republic": "CZ", Austria: "AT",
  Algeria: "DZ", Norway: "NO", Romania: "RO", "DR Congo": "CD", Greece: "GR", Russia: "RU", Australia: "AU", Japan: "JP", Slovakia: "SK", Chile: "CL",
  Tunisia: "TN", Hungary: "HU", Guinea: "GN", Bosnia: "BA", Jamaica: "JM", Slovenia: "SI", Albania: "AL", Paraguay: "PY", Mexico: "MX", Finland: "FI",
  Venezuela: "VE", "South Korea": "KR", Congo: "CG", Ukraine: "UA", Bulgaria: "BG", Iceland: "IS", Montenegro: "ME", Israel: "IL", Martinique: "MQ",
  Kosovo: "XK", Peru: "PE", Ecuador: "EC", Guadeloupe: "GP", "Burkina Faso": "BF", "Cape Verde": "CV", Canada: "CA", "North Macedonia": "MK",
  "Guinea-Bissau": "GW", Togo: "TG", "South Africa": "ZA", Gabon: "GA", Gambia: "GM", Benin: "BJ", Georgia: "GE", Angola: "AO", Egypt: "EG", Comoros: "KM",
  "Costa Rica": "CR", Honduras: "HN", Haiti: "HT", Madagascar: "MG", Suriname: "SR", Iran: "IR", Curacao: "CW", "French Guiana": "GF", Belarus: "BY",
  "Equatorial Guinea": "GQ", China: "CN", Mauritania: "MR", Luxembourg: "LU", "Sierra Leone": "SL", "Dominican Republic": "DO",
  "Central African Republic": "CF", "Trinidad and Tobago": "TT", "New Zealand": "NZ", Zimbabwe: "ZW", Armenia: "AM", Estonia: "EE", Lithuania: "LT",
  Zambia: "ZM", Barbados: "BB", Burundi: "BI", Latvia: "LV", Mozambique: "MZ", Iraq: "IQ", Moldova: "MD", Indonesia: "ID", Kenya: "KE", Azerbaijan: "AZ",
  Montserrat: "MS", Cyprus: "CY", Philippines: "PH", Guyana: "GY", Grenada: "GD", Kazakhstan: "KZ", Liechtenstein: "LI", Chad: "TD",
  "St. Kitts & Nevis": "KN", "Antigua and Barbuda": "AG", Qatar: "QA", Panama: "PA", Uganda: "UG", "Saudi Arabia": "SA", Seychelles: "SC", Namibia: "NA",
  Lebanon: "LB", Niger: "NE", "North Korea": "KP", Neukaledonien: "NC", Syria: "SY", Bolivia: "BO", Libya: "LY", Malta: "MT", Bermuda: "BM",
  Uzbekistan: "UZ", Oman: "OM", Gibraltar: "GI", Malaysia: "MY", Eritrea: "ER", Tahiti: "PF", Mauritius: "MU", Thailand: "TH", Monaco: "MC", Laos: "LA",
  "El Salvador": "SV", Bangladesh: "BD", Guatemala: "GT", "Saint-Martin": "MF", Tanzania: "TZ", Cuba: "CU", "Faroe Islands": "FO", Palestine: "PS",
  Liberia: "LR", Jersey: "JE"
};
const HOME_FLAG = { England: "gbeng", Scotland: "gbsct", Wales: "gbwls" };
const NAT3 = { England: "ENG", Scotland: "SCO", Wales: "WAL", "Northern Ireland": "NIR" };
function flagOf(nat) {
  const n = NAT[nat];
  if (n === undefined) return "";
  if (HOME_FLAG[n]) return "🏴" + [...HOME_FLAG[n]].map(c => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("") + String.fromCodePoint(0xe007f);
  const c = ISO[n];
  return c ? String.fromCodePoint(...[...c].map(x => 0x1f1a5 + x.charCodeAt(0))) : "";
}
const natCode = nat => NAT3[NAT[nat]] || ISO[NAT[nat]] || "?";
/* the shared shape of a "tap through N" round (pips, reveal, next) */
function tapRun(R, N, delay, onGood) {
  R.k = 0;
  R.ok = 0;
  R.res = [];
  R.over = false;
  R.lock = false;
  R.shown = null;
  R.picks = R.picks || [];
  R.pips = () => `<div class="pips">${Array.from({ length: N }, (_, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
  R.answer = (good, shown) => {
    R.res.push(good ? 1 : 0);
    if (good) {
      R.ok++;
      sfx.tick();
      if (onGood) onGood();
    } else sfx.no();
    R.shown = shown;
    R.lock = true;
    ctx.paint();
    setTimeout(() => {
      R.shown = null;
      R.lock = false;
      R.k++;
      if (R.onNext) R.onNext();
      if (R.k >= N) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    }, delay);
  };
  return R;
}
const tapEnd = (R, N, target, per) => () => ({
  goal: R.ok >= target,
  xp: R.ok >= target ? 30 + per * R.ok : per * R.ok,
  html: `<p><b>${R.ok}</b> of ${N} right.</p>`
});
/* thresholds stepped down until a club-sized pool is big enough */
function famePool(base, thr, min, floor) {
  let t = thr,
    p = base.filter(i => fame(i) >= t);
  while (p.length < min && t > floor) {
    t -= 0.3;
    p = base.filter(i => fame(i) >= t);
  }
  return p;
}

/* ---------- makers ---------- */
function makeMore(type, r, tier, sc) {
  sc = sc || {};
  const C = sc.club,
    club = C !== undefined,
    pl = !!sc.pl;
  if (type === "six") {
    const base = SSP.filter(i => (club ? hasClub(i, C) : !pl || isPLp(i))),
      pool = famePool(base, club ? [5, 4.6, 4.2, 3.8][tier] : [5.6, 5.2, 4.8, 4.4][tier], 12, 2.5);
    if (pool.length < 8) return null;
    const minCommon = club ? 1 : [5, 3, 2, 1][tier];
    let best = null;
    for (let g = 0; g < 40; g++) {
      const a = pickR(pool, r),
        b = pickR(pool, r);
      if (a === b || overlaps(a, b)) continue;
      const nb = new Set(tmOf(b)),
        common = tmOf(a).filter(i => nb.has(i));
      if (tier === 3 && !club && !common.length) {
        // the top division can get a two-name link: one of a's team-mates must have played with one of b's
        const na = tmOf(a);
        if (na.length && nb.size && na.some(x => tmOf(b).some(y => overlaps(x, y)))) return { type, a, b, need: 2 };
        continue;
      }
      if (common.length >= minCommon) return { type, a, b, need: 1 };
      if (common.length && !best) best = { type, a, b, need: 1 };
    }
    return best;
  }
  if (type === "pals") {
    const thr = club ? [5, 4.5, 4, 3.5][tier] : [5.4, 5, 4.6, 4.2][tier],
      clubs = club ? [C] : (pl ? PLGRID : BD.gridClubs).slice(0, [12, 18, 26, 40][tier]),
      atClub = {};
    clubs.forEach(c => {
      atClub[c] = famePool(
        SSP.filter(i => spellClubs(i).includes(c)),
        thr,
        club ? 10 : 6,
        club ? 2.5 : thr
      );
    });
    const ok = clubs.filter(c => atClub[c].length >= 6);
    if (!ok.length) return null;
    // a "no" has to be a safe no: every club they share must be inside the season records for both, joined 2010 or later
    const safeNo = (a, b) =>
      clubsOf(a)
        .filter(c => clubsOf(b).includes(c))
        .every(c => spellClubs(a).includes(c) && spellClubs(b).includes(c) && joinYear(a, c) >= 2010 && joinYear(b, c) >= 2010);
    const pairs = [],
      used = new Set();
    for (let g = 0; pairs.length < 5 && g < 400; g++) {
      const want = pairs.filter(p => p[2]).length < 2 ? 1 : pairs.filter(p => !p[2]).length < 2 ? 0 : r() < 0.5 ? 1 : 0,
        c = pickR(ok, r),
        a = pickR(atClub[c], r),
        b = pickR(atClub[c], r);
      if (a === b || used.has(a) || used.has(b)) continue;
      const yes = overlaps(a, b);
      if (yes !== !!want || (!yes && !safeNo(a, b))) continue;
      used.add(a);
      used.add(b);
      pairs.push([a, b, yes ? 1 : 0]);
    }
    if (pairs.length < 5) return null;
    return { type, pairs: shuffle(pairs, r), target: [3, 4, 4, 4][tier] };
  }
  if (type === "fake") {
    const thr = club ? EASE.careerFameClub[tier] - 0.2 : EASE.careerFame[tier] - 0.2,
      pool = CAREERS.filter(i => fame(i) >= thr && (club ? hasClub(i, C) : !pl || isPLp(i)));
    if (pool.length < 3) return null;
    const sets = [],
      used = new Set();
    for (let g = 0; sets.length < 3 && g < 40; g++) {
      const p = pickR(pool, r);
      if (used.has(p)) continue;
      const path = careerPath(p);
      if (path.length < 3 || path.length > 6) continue;
      // skip trails the data has out of date order, or with one club under two names (e.g. Troyes / ESTAC Troyes)
      if (path.some((c, k) => k && c[1] < path[k - 1][1])) continue;
      const nm = path.map(c => norm(CLUB[c[0]]));
      if (nm.some((a, j) => nm.some((b, k) => j !== k && (a.includes(b) || b.includes(a))))) continue;
      // fakes come from clubs his old team-mates went on to: plausible, same sort of level. Never a club he has any record at.
      const mine = new Set(clubsOf(p).concat(spellClubs(p))),
        cnt = {};
      clubsOf(p).forEach(c =>
        clubPl[c].forEach(j => {
          if (j !== p) clubsOf(j).forEach(x => !mine.has(x) && clubPl[x].length >= 150 && (cnt[x] = (cnt[x] || 0) + 1));
        })
      );
      const cands = Object.keys(cnt)
        .map(Number)
        .sort((x, y) => cnt[y] - cnt[x] || x - y)
        .slice(0, 12);
      if (cands.length < 3) continue;
      const f = pickR(cands, r);
      let at = 1 + Math.floor(r() * path.length); // never first: the first club is where it started
      if (at === path.length && path[path.length - 1][1] >= 2024) at = path.length - 1;
      const y0 = path[at - 1][1],
        y = at < path.length ? y0 + Math.floor(r() * (path[at][1] - y0 + 1)) : Math.min(2025, y0 + 1 + Math.floor(r() * 2));
      used.add(p);
      sets.push({ p, f, at, y });
    }
    return sets.length === 3 ? { type, sets, target: 2 } : null;
  }
  if (type === "buy") {
    const n = [250, 450, 700, 900][tier],
      pool = BD.hl
        .map((h, i) => i)
        .filter(i => (club ? BD.hl[i][1] === C : (pl ? PLC.has(BD.hl[i][2]) : true) && i < n));
    if (pool.length < 3) return null;
    const qs = [],
      used = new Set();
    for (let g = 0; qs.length < 3 && g < 60; g++) {
      const h = pickR(pool, r),
        H = BD.hl[h];
      if (used.has(H[0])) continue;
      const bought = new Set(BD.hl.filter(x => x[0] === H[0]).map(x => x[2])),
        near = [
          ...new Set(
            BD.hl
              .filter(x => Math.abs(x[3] - H[3]) <= 3 && x[2] !== H[1] && !bought.has(x[2]) && PLC.has(x[2]) === PLC.has(H[2]))
              .map(x => x[2])
          )
        ].sort((x, y) => x - y);
      if (near.length < 3) continue;
      used.add(H[0]);
      qs.push({ h, o: shuffle(shuffle(near, r).slice(0, 3).concat(H[2]), r) });
    }
    return qs.length === 3 ? { type, qs, target: 2 } : null;
  }
  if (type === "row") {
    const pool = BD.tables
      .map((t, i) => i)
      .filter(i => (club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : (pl ? BD.tables[i][0] === "Premier League" : true) && BD.tables[i][2] <= tier + 1));
    if (pool.length < (club ? 2 : 3)) return null;
    const qs = [];
    for (const t of shuffle(pool, r)) {
      if (qs.length >= 3) break;
      const T = BD.tables[t],
        hide = shuffle([0, 1, 2, 3].filter(k => !club || T[3][k][0] !== CLUB[C]), r)[0], // Club Cup hides someone else: your own club would give it away
        here = new Set(T[3].map(x => x[0]).concat(T[4])),
        near = [...new Set(BD.tables.filter(x => x[0] === T[0] && Math.abs(x[1] - T[1]) <= 6).flatMap(x => x[3].map(y => y[0])))]
          .filter(c => !here.has(c))
          .sort();
      if (near.length < 3) continue;
      qs.push({ t, k: hide, o: shuffle(shuffle(near, r).slice(0, 3).concat(T[3][hide][0]), r) });
    }
    return qs.length >= 2 ? { type, qs, target: 2 } : null;
  }
  if (type === "order") {
    const sets = [],
      kinds = shuffle(["fee", "tab", "lst"], r);
    const feePool = BD.hl.map((h, i) => i).filter(i => (club ? BD.hl[i][1] === C || BD.hl[i][2] === C : (pl ? PLC.has(BD.hl[i][2]) : true) && i < [250, 450, 700, 900][tier]));
    const tabPool = BD.tables
      .map((t, i) => i)
      .filter(i => (club ? BD.tables[i][3].some(x => x[0] === CLUB[C]) : (pl ? BD.tables[i][0] === "Premier League" : true) && BD.tables[i][2] <= tier + 1));
    const lstPool = club ? listsOf(C) : pl ? PLLISTS : BD.lists.map((l, i) => i);
    for (let g = 0; sets.length < 3 && g < 30; g++) {
      const kind = kinds[g % 3];
      if (kind === "fee" && feePool.length >= 8) {
        const pick = shuffle(feePool, r).slice(0, 12),
          four = [];
        pick.forEach(h => {
          if (four.length < 4 && four.every(x => Math.max(BD.hl[x][4], BD.hl[h][4]) / Math.min(BD.hl[x][4], BD.hl[h][4]) >= 1.12 && BD.hl[x][0] !== BD.hl[h][0])) four.push(h);
        });
        if (four.length === 4 && !sets.some(s => s.v === "fee")) sets.push({ v: "fee", h: four });
      } else if (kind === "tab" && tabPool.length) {
        const t = pickR(tabPool, r);
        if (!sets.some(s => s.t === t)) sets.push({ v: "tab", t, o: shuffle([0, 1, 2, 3], r) });
      } else if (kind === "lst" && lstPool.length) {
        const li = pickR(lstPool, r),
          it = BD.lists[li][3],
          four = shuffle(
            it.map((x, k) => k),
            r
          )
            .filter((k, j, a) => a.slice(0, j).every(m => it[m][1] !== it[k][1]))
            .slice(0, 4);
        if (four.length === 4 && !sets.some(s => s.li === li)) sets.push({ v: "lst", li, o: four });
      }
    }
    return sets.length === 3 ? { type, sets, target: [1, 2, 2, 2][tier] } : null;
  }
  if (type === "flags") {
    if (club) return null; // your own club's line-up would always be the answer
    const ok = x => x[6].filter(p => NAME2IDX[norm(p[0])] !== undefined && PL[NAME2IDX[norm(p[0])]][1] >= 0).length >= 9;
    const pool = BD.xi.map((x, i) => i).filter(i => isClubXI(BD.xi[i]) && BD.xi[i][5] <= tier + 1 && (!pl || BD.xi[i][4].indexOf("Premier League") === 0) && ok(BD.xi[i]));
    if (pool.length < 6) return null;
    const qs = [];
    for (let g = 0; qs.length < 3 && g < 40; g++) {
      const i = pickR(pool, r),
        X = BD.xi[i];
      if (qs.some(q => BD.xi[q.i][0] === X[0])) continue;
      const lg = X[4].split(" ").slice(0, 2).join(" "),
        same = [...new Set(BD.xi.filter(x => isClubXI(x) && xiSeason(x) === xiSeason(X) && x[0] !== X[0]).map(x => x[0]))].sort(),
        wider = [...new Set(BD.xi.filter(x => isClubXI(x) && x[4].indexOf(lg) === 0 && x[0] !== X[0]).map(x => x[0]))].sort(),
        o = same.length >= 3 ? shuffle(same, r).slice(0, 3) : shuffle(wider, r).slice(0, 3);
      if (o.length < 3) continue;
      qs.push({ i, o: shuffle(o.concat(X[0]), r) });
    }
    return qs.length === 3 ? { type, qs, target: 2 } : null;
  }
  if (type === "exact") {
    const maxD = tier < 2 ? 3 : 4, // the bank's scorelines are all difficulty 3 or 4
      name = club ? CLUB[C] : null;
    let pool = SCORES.filter(x => x.d <= maxD && (!name || x.k.includes(name)));
    if (name && pool.length < 6) pool = SCORES.filter(x => x.k.includes(name));
    if (pool.length < 3) return null;
    const qs = [];
    for (let g = 0; qs.length < 3 && g < 40; g++) {
      const x = pickR(pool, r);
      if (!qs.includes(x.id)) qs.push(x.id);
    }
    return qs.length === 3 ? { type, qs, target: [2, 3, 3, 4][tier] } : null;
  }
  if (type === "pin") {
    // Pin the Ground: three clubs from the grounds list (src/grounds.js); a ground with no coordinates is never picked
    const pool = GROUNDS.map((g, i) => i);
    const qs = [];
    for (let g = 0; qs.length < 3 && g < 60; g++) {
      const i = pickR(pool, r);
      if (!qs.includes(i)) qs.push(i);
    }
    return qs.length === 3 ? { type, qs, target: [3, 4, 4, 5][tier] } : null;
  }
  return null;
}
/* Exact Score uses the bank's "what was the score?" questions (two-source checked) */
const SCORES = QB.all
  .filter(x => x.t === "score" && /^\d+-\d+$/.test(x.a) && / v .*: what was the score\?$/.test(x.q))
  .map(x => {
    const m = x.q.match(/^(.*) v (.*): what was the score\?$/),
      [h, a] = x.a.split("-").map(Number);
    return Object.assign({}, x, { home: m[1], away: m[2], hg: h, ag: a });
  });
const SCORE_BY = {};
SCORES.forEach(x => {
  SCORE_BY[x.id] = x;
});
function careerPath(p) {
  const a = PL[p][5],
    path = [];
  for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
  return path;
}
function gKm(a, b) {
  const R = 6371, t = x => (x * Math.PI) / 180;
  const dLa = t(b[0] - a[0]), dLn = t(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dLn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function moreKey(x) {
  const t = x.type;
  if (t === "six") return "6" + x.a + "." + x.b;
  if (t === "pals") return "y" + x.pairs.map(p => p[0] + "." + p[1]).join("_");
  if (t === "fake") return "f" + x.sets.map(s => s.p).join(".");
  if (t === "buy") return "b" + x.qs.map(q => q.h).join(".");
  if (t === "row") return "w" + x.qs.map(q => q.t + "." + q.k).join("_");
  if (t === "order") return "r" + x.sets.map(s => s.v + (s.h || s.o).join(".") + (s.t !== undefined ? "t" + s.t : s.li !== undefined ? "l" + s.li : "")).join("_");
  if (t === "flags") return "g" + x.qs.map(q => q.i).join(".");
  if (t === "exact") return "e" + x.qs.join(".");
  if (t === "pin") return "p" + x.qs.join(".");
  return t;
}

/* ---------- runtimes ---------- */
Object.assign(RUN, {
  six(spec) {
    const a = spec.a,
      b = spec.b,
      R = {
        chain: [a],
        tries: 3,
        goal: false,
        over: false,
        picks: [],
        rule: "Link them through team-mates. Each name has to have played with the last.",
        cover: "Two players. Link them through team-mates, one name at a time. Each has to have played with the last one.",
        hint: "Same club and season, 2010 on · " + (spec.need === 1 ? "one name can do it" : "two names can do it")
      };
    const last = () => R.chain[R.chain.length - 1];
    R.body = () =>
      `<div class="sixw"><div class="sixe"><span>From</span><b>${esc(PL[a][0])}</b></div>${R.chain
        .slice(1)
        .map(i => `<div class="sixl"><i>↓</i><b>${esc(PL[i][0])}</b></div>`)
        .join("")}${R.goal ? "" : `<div class="sixl q"><i>↓</i><b>?</b></div>`}<div class="sixe to"><span>To</span><b>${esc(PL[b][0])}</b></div></div><div class="tries">${[0, 1, 2]
        .map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`)
        .join("")}<span>${R.chain.length - 1} ${R.chain.length === 2 ? "link" : "links"} so far · max 4</span></div>`;
    R.onPick = i => {
      if (R.over || i < 0) return;
      const l = last();
      if (i === b) {
        if (overlaps(l, b)) {
          R.goal = true;
          R.over = true;
          ctx.done();
        } else {
          R.tries--;
          msg(PL[l][0] + " never played with " + PL[b][0] + ". Find another link.", "bad");
          sfx.no();
          if (R.tries <= 0) {
            R.over = true;
            ctx.done();
          } else ctx.paint();
        }
        return;
      }
      if (R.chain.includes(i)) {
        msg("He's already in the chain.", "");
        return;
      }
      if (!PL[i][6].length) {
        msg("No squad records for " + PL[i][0] + " from 2010 on. Try someone else.", "");
        return;
      }
      if (!overlaps(l, i)) {
        R.tries--;
        msg(PL[i][0] + " never played with " + PL[l][0] + ".", "bad");
        sfx.no();
        if (R.tries <= 0) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
        return;
      }
      R.chain.push(i);
      R.picks.push(i);
      sfx.tick();
      if (overlaps(i, b)) {
        R.goal = true;
        R.over = true;
        msg(PL[i][0] + " played with " + PL[b][0] + ". Linked.", "good");
        ctx.done();
        return;
      }
      if (R.chain.length - 1 >= 4) {
        R.over = true;
        ctx.done();
        return;
      }
      msg(PL[i][0] + ". Keep going.", "good");
      ctx.paint();
    };
    R.review = () => {
      const nb = new Set(tmOf(b)),
        common = tmOf(a)
          .filter(i => nb.has(i))
          .sort((x, y) => PL[y][4] - PL[x][4]);
      return common.length
        ? `<p class="note">One-name links: <b>${common
            .slice(0, 4)
            .map(i => esc(PL[i][0]))
            .join("</b>, <b>")}</b>${common.length > 4 ? " and " + (common.length - 4) + " more" : ""}.</p>`
        : `<p class="note">No single player links them. It takes two.</p>`;
    };
    R.end = () => {
      const n = R.chain.length - 1;
      return R.goal
        ? {
            goal: true,
            xp: 30 + (n <= spec.need ? 30 : 10),
            deep: n <= spec.need && spec.need === 2,
            html: `<p>${[a].concat(R.chain.slice(1), b).map(i => "<b>" + esc(PL[i][0]) + "</b>").join(" › ")}</p><p>${n <= spec.need ? "Shortest route there is." : n + " links. Got there."}</p>`
          }
        : { goal: false, xp: 0, html: `<p>Couldn't link <b>${esc(PL[a][0])}</b> to <b>${esc(PL[b][0])}</b>.</p>` };
    };
    return R;
  },
  pals(spec) {
    const N = spec.pairs.length,
      R = tapRun({ rule: `Did they ever play together? Get ${spec.target} of ${N} right.`, hint: "Same club, same season, 2010 onwards" }, N, 1000);
    R.body = () => {
      if (R.k >= N) return R.pips();
      const [a, b, yes] = spec.pairs[R.k],
        s = R.shown,
        cls = v => (s === null ? "" : v === yes ? "right" : s === v ? "wrong" : "");
      return (
        R.pips() +
        `<div class="cats"><div class="cat"><span>${POSN[PL[a][2]]}</span><b>${esc(PL[a][0])}</b></div><div class="amp">+</div><div class="cat"><span>${POSN[PL[b][2]]}</span><b>${esc(PL[b][0])}</b></div></div><div class="yn"><button class="tc ${cls(1)}" data-act="tap" data-v="1"><b>Team-mates</b></button><button class="tc ${cls(0)}" data-act="tap" data-v="0"><b>Never</b></button></div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      R.answer(+v === spec.pairs[R.k][2], +v);
    };
    R.review = () =>
      `<div class="rv">${spec.pairs
        .map(([a, b, y], k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(PL[a][0])}</span><i>${y ? "with" : "never"}</i><span>${esc(PL[b][0])}</span></div>`)
        .join("")}</div>`;
    R.end = tapEnd(R, N, spec.target, 3);
    return R;
  },
  fake(spec) {
    const N = spec.sets.length,
      R = tapRun({ rule: `One move in each career never happened. Tap it. Get ${spec.target} of ${N} right.` }, N, 1300);
    const withFake = st => {
      const path = careerPath(st.p).slice();
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
        `<p class="ask">${esc(PL[st.p][0])}<span>${POSN[PL[st.p][2]]} · clubs in the order he joined them</span></p><div class="fakep">${path
          .map(
            (c, j) =>
              `${j ? "<i>›</i>" : ""}<button class="${s === null ? "" : j === st.at ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}">${esc(CLUB[c[0]])}<em>'${String(c[1]).slice(2)}</em></button>`
          )
          .join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      R.answer(+v === spec.sets[R.k].at, +v);
    };
    R.end = () =>
      Object.assign(tapEnd(R, N, spec.target, 5)(), {
        after: `<div class="panel pad"><p class="note">The fakes: ${spec.sets.map(st => "<b>" + esc(PL[st.p][0]) + "</b> never played for " + esc(CLUB[st.f])).join(", ")}.</p></div>`
      });
    return R;
  },
  buy(spec) {
    const N = spec.qs.length,
      R = tapRun({ rule: `Who paid the fee? Get ${spec.target} of ${N} right.` }, N, 1100);
    R.body = () => {
      if (R.k >= N) return R.pips();
      const q = spec.qs[R.k],
        H = BD.hl[q.h],
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${esc(PL[H[0]][0])}<span>From ${esc(CLUB[H[1]])}, ${H[3]} · €${H[4]}m</span></p><div class="quad sm">${q.o
          .map((c, j) => `<button class="tc ${s === null ? "" : c === H[2] ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(CLUB[c])}</b></button>`)
          .join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const q = spec.qs[R.k];
      R.answer(q.o[+v] === BD.hl[q.h][2], +v);
    };
    R.review = () =>
      `<div class="rv">${spec.qs
        .map((q, k) => {
          const H = BD.hl[q.h];
          return `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(PL[H[0]][0])} <em>€${H[4]}m</em></span><i>to</i><span class="w">${esc(CLUB[H[2]])} <em>${H[3]}</em></span></div>`;
        })
        .join("")}</div>`;
    R.end = tapEnd(R, N, spec.target, 5);
    return R;
  },
  row(spec) {
    const N = spec.qs.length,
      R = tapRun({ rule: `Name the club in the blank row. Get ${spec.target} of ${N} right.` }, N, 1300);
    const table = (q, rev) => {
      const T = BD.tables[q.t];
      return `<div class="panel"><table class="tbl"><tr><th></th><th>${esc(T[0])} ${seasonLabel(T[1])}</th><th>GF</th><th>GA</th><th>PTS</th></tr>${T[3]
        .map((x, k) => `<tr class="${k === q.k ? "hid" : ""}"><td>${k + 1}</td><td>${k === q.k && !rev ? "? ? ?" : esc(x[0])}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[1]}</td></tr>`)
        .join("")}</table></div>`;
    };
    R.body = () => {
      if (R.k >= N) return R.pips();
      const q = spec.qs[R.k],
        ans = BD.tables[q.t][3][q.k][0],
        s = R.shown;
      return (
        R.pips() +
        table(q, s !== null) +
        `<div class="quad sm">${q.o.map((c, j) => `<button class="tc ${s === null ? "" : c === ans ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(c)}</b></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const q = spec.qs[R.k];
      R.answer(q.o[+v] === BD.tables[q.t][3][q.k][0], +v);
    };
    R.end = () =>
      Object.assign(tapEnd(R, N, spec.target, 5)(), {
        after: `<div class="panel pad"><p class="note">${spec.qs.map(q => "<b>" + esc(BD.tables[q.t][3][q.k][0]) + "</b> (" + ord(q.k + 1) + ", " + seasonLabel(BD.tables[q.t][1]) + ")").join(", ")}.</p></div>`
      });
    return R;
  },
  order(spec) {
    const N = spec.sets.length,
      R = tapRun({ rule: `Tap them in order, top first. Get the whole order right in ${spec.target} of ${N}.` }, N, 1600);
    R.sel = [];
    R.onNext = () => {
      R.sel = [];
    };
    // each set as four items: label, sub, value shown after, and the right order
    const items = st => {
      if (st.v === "fee")
        return {
          ask: "Most expensive first",
          sub: "Transfer fees",
          it: st.h.map(h => ({ b: PL[BD.hl[h][0]][0], s: CLUB[BD.hl[h][1]] + " to " + CLUB[BD.hl[h][2]] + ", " + BD.hl[h][3], e: "€" + BD.hl[h][4] + "m", v: BD.hl[h][4] }))
        };
      if (st.v === "tab") {
        const T = BD.tables[st.t];
        return { ask: "Champions first", sub: T[0] + " " + seasonLabel(T[1]) + " · the top four", it: st.o.map(k => ({ b: T[3][k][0], s: "", e: ord(k + 1) + " · " + T[3][k][1] + " pts", v: 4 - k })) };
      }
      const L = BD.lists[st.li],
        u = L[1] === "€m" ? "m" : " " + L[1];
      return { ask: "Biggest number first", sub: L[0], it: st.o.map(k => ({ b: PL[L[3][k][0]][0], s: "", e: (L[1] === "€m" ? "€" : "") + L[3][k][1] + u, v: L[3][k][1] })) };
    };
    const right = st => {
      const I = items(st).it;
      return I.map((x, j) => j).sort((x, y) => I[y].v - I[x].v);
    };
    R.body = () => {
      if (R.k >= N) return R.pips();
      const st = spec.sets[R.k],
        I = items(st),
        rt = right(st),
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${esc(I.ask)}<span>${esc(I.sub)}</span></p><div class="ordl">${I.it
          .map((x, j) => {
            const at = R.sel.indexOf(j),
              cls = s === null ? (at >= 0 ? "on" : "") : rt.indexOf(j) === at ? "right" : "wrong";
            return `<button class="tc ${cls}" data-act="tap" data-v="${j}"><i class="on">${at >= 0 ? at + 1 : ""}</i><b>${esc(x.b)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ""}<em>${s !== null ? esc(ord(rt.indexOf(j) + 1) + " · " + x.e) : ""}</em></button>`;
          })
          .join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const j = +v,
        at = R.sel.indexOf(j);
      if (at >= 0) R.sel = R.sel.slice(0, at); // tap a numbered one to take it (and anything after it) back
      else R.sel.push(j);
      sfx.tick();
      if (R.sel.length < 4) return ctx.paint();
      const rt = right(spec.sets[R.k]),
        good = R.sel.every((x, k) => x === rt[k]);
      R.answer(good, 1);
    };
    R.end = tapEnd(R, N, spec.target, 8);
    return R;
  },
  flags(spec) {
    const N = spec.qs.length,
      R = tapRun({ rule: `Whose starting XI is this? Get ${spec.target} of ${N} right.` }, N, 1300);
    R.body = () => {
      if (R.k >= N) return R.pips();
      const q = spec.qs[R.k],
        X = BD.xi[q.i],
        s = R.shown;
      return (
        R.pips() +
        `<p class="ask">${esc(xiSeason(X))}<span>${esc(X[3].split("-").reverse().join("/"))} · ${s === null ? "flags only" : esc(X[0] + " " + X[2] + " " + X[1])}</span></p><div class="pitchwrap flagp">${X[6]
          .map(p => {
            const xy = SB[p[1]] || [50, 50],
              i = NAME2IDX[norm(p[0])],
              n = i === undefined ? -1 : PL[i][1],
              f = n >= 0 ? flagOf(n) : "";
            return `<span class="fl" style="left:${xy[0]}%;top:${100 - xy[1]}%"><b>${f || "·"}</b><em>${s === null ? (n >= 0 ? natCode(n) : "?") : esc(p[0].split(" ").slice(-1)[0])}</em></span>`;
          })
          .join("")}</div><div class="quad sm">${q.o.map((c, j) => `<button class="tc ${s === null ? "" : c === X[0] ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(c)}</b></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const q = spec.qs[R.k];
      R.answer(q.o[+v] === BD.xi[q.i][0], +v);
    };
    R.end = () =>
      Object.assign(tapEnd(R, N, spec.target, 5)(), {
        after: `<div class="panel pad"><p class="note">${spec.qs.map(q => "<b>" + esc(BD.xi[q.i][0]) + "</b> v " + esc(BD.xi[q.i][1]) + ", " + esc(BD.xi[q.i][3].split("-").reverse().join("/"))).join("; ")}.</p></div>`
      });
    return R;
  },
  exact(spec) {
    const qs = spec.qs.map(id => SCORE_BY[id]).filter(Boolean),
      N = qs.length,
      R = { k: 0, pts: 0, res: [], h: 1, a: 1, over: !N, lock: false, shown: false, picks: [], rule: `Set the score and lock it in. Exact score 2 points, right result 1. Get ${spec.target} of ${N * 2}.` };
    const res = (h, a) => Math.sign(h - a);
    R.body = () => {
      const pips = `<div class="pips">${qs.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] === 2 ? "ok" : R.res[k] === 1 ? "half" : "no") : ""}"></i>`).join("")}</div>`;
      if (R.k >= N) return pips;
      const x = qs[R.k],
        s = R.shown,
        st = (side, v, real) =>
          `<div class="stp"><span class="tm">${esc(side)}</span><div class="ctl">${s ? "" : `<button class="tc" data-act="tap" data-v="${side === x.home ? "h" : "a"}-">−</button>`}<b class="led">${v}</b>${s ? "" : `<button class="tc" data-act="tap" data-v="${side === x.home ? "h" : "a"}+">+</button>`}</div>${s ? `<em>Actual ${real}</em>` : ""}</div>`;
      return (
        pips +
        `<p class="ask">${esc(x.home)} v ${esc(x.away)}<span>${esc(x.sub)}</span></p><div class="exw">${st(x.home, R.h, x.hg)}${st(x.away, R.a, x.ag)}</div>${
          s
            ? `<p class="exv ${R.res[R.k] === 2 ? "right" : R.res[R.k] === 1 ? "half" : "wrong"}">${R.res[R.k] === 2 ? "Spot on. 2 points." : R.res[R.k] === 1 ? "Right result. 1 point." : "Not even close."}</p>`
            : `<button class="btn" data-act="tap" data-v="lock">Lock it in</button>`
        }`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      if (v === "h+") R.h = Math.min(9, R.h + 1);
      else if (v === "h-") R.h = Math.max(0, R.h - 1);
      else if (v === "a+") R.a = Math.min(9, R.a + 1);
      else if (v === "a-") R.a = Math.max(0, R.a - 1);
      else if (v === "lock") {
        const x = qs[R.k],
          p = R.h === x.hg && R.a === x.ag ? 2 : res(R.h, R.a) === res(x.hg, x.ag) ? 1 : 0;
        R.res.push(p);
        R.pts += p;
        if (p) sfx.tick();
        else sfx.no();
        R.shown = true;
        R.lock = true;
        ctx.paint();
        setTimeout(() => {
          R.shown = false;
          R.lock = false;
          R.h = 1;
          R.a = 1;
          R.k++;
          if (R.k >= N) {
            R.over = true;
            ctx.done();
          } else ctx.paint();
        }, 1500);
        return;
      }
      ctx.paint();
    };
    R.review = () =>
      `<div class="rv">${qs.map((x, k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(x.home)}</span><i>${x.hg}–${x.ag}</i><span>${esc(x.away)}</span><small>${esc(x.sub)}</small></div>`).join("")}</div>`;
    R.end = () => ({
      goal: R.pts >= spec.target,
      xp: R.pts >= spec.target ? 30 + 5 * R.pts : 4 * R.pts,
      html: `<p><b>${R.pts}</b> of ${N * 2} points.</p>`
    });
    return R;
  },
  pin(spec) {
    const gs = spec.qs.map(i => GROUNDS[i]).filter(Boolean),
      N = gs.length,
      R = { k: 0, pts: 0, res: [], dists: [], over: !N, shown: false, lock: false, pin: null, view: null, map: null, rule: `Drop a pin on each home ground. Within 1.5km is 2 points, within 8km is 1. Get ${spec.target} of ${N * 2}.` };
    R.cover = "Three home grounds, satellite view, no names. You'll see which clubs when the clock starts.";
    R.body = () => {
      if (R.k >= N) return "";
      const g = gs[R.k],
        pips = `<div class="pips">${gs.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] === 2 ? "ok" : R.res[k] === 1 ? "half" : "no") : ""}"></i>`).join("")}</div>`,
        verdict = R.shown ? `<p class="exv ${R.res[R.k] === 2 ? "right" : R.res[R.k] === 1 ? "half" : "wrong"}">${esc(g.s)} · ${R.dists[R.k] < 1 ? Math.round(R.dists[R.k] * 1000) + " m" : R.dists[R.k].toFixed(1) + " km"} away · ${R.res[R.k] === 2 ? "2 points" : R.res[R.k] === 1 ? "1 point" : "0 points"}</p>` : "";
      return (
        pips +
        `<p class="ask">${esc(g.c)} home ground<span>Tap the map to drop your pin</span></p><div id="pinmap" class="pinmap" aria-label="Satellite map, no labels"></div>` +
        verdict +
        (R.shown ? "" : `<button class="btn" data-act="tap" data-v="lock" ${R.pin ? "" : "disabled"}>Lock it in</button>`)
      );
    };
    // called by the match engine after every paint: builds the satellite map in the new container
    R.mount = () => {
      const el = document.getElementById("pinmap");
      if (!el || typeof L === "undefined" || R.k >= N) return;
      if (R.map) {
        try { R.map.remove(); } catch (e) {}
        R.map = null;
      }
      const g = gs[R.k],
        map = L.map(el, { minZoom: 3, maxZoom: 19, zoomControl: true, attributionControl: true, worldCopyJump: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics"
      }).addTo(map);
      if (R.view) map.setView(R.view.c, R.view.z);
      else map.setView([53.6, -2.4], 6);
      map.on("moveend", () => (R.view = { c: map.getCenter(), z: map.getZoom() }));
      if (R.pin && !R.shown) R.marker = L.circleMarker(R.pin, { radius: 8, color: "#ffb000", weight: 3, fillColor: "#ffb000", fillOpacity: 0.9 }).addTo(map);
      if (!R.shown) {
        map.on("click", e => {
          if (R.lock) return;
          R.pin = [e.latlng.lat, e.latlng.lng];
          if (R.marker) R.marker.remove();
          R.marker = L.circleMarker(R.pin, { radius: 8, color: "#ffb000", weight: 3, fillColor: "#ffb000", fillOpacity: 0.9 }).addTo(map);
          const b = document.querySelector('[data-act="tap"][data-v="lock"]');
          if (b) b.disabled = false;
        });
      } else {
        // reveal: the real ground in green, your pin, and a line between them
        const real = [g.la, g.ln];
        L.circleMarker(real, { radius: 9, color: "#2ecc71", weight: 3, fillColor: "#2ecc71", fillOpacity: 0.9 }).addTo(map);
        if (R.pin) {
          L.circleMarker(R.pin, { radius: 8, color: "#ffb000", weight: 3, fillColor: "#ffb000", fillOpacity: 0.9 }).addTo(map);
          L.polyline([R.pin, real], { color: "#ffffff", weight: 2, dashArray: "6 6" }).addTo(map);
        }
        map.setView(real, Math.max(map.getZoom(), 13));
      }
      R.map = map;
      setTimeout(() => map.invalidateSize(), 0);
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      if (v !== "lock" || !R.pin) return;
      const g = gs[R.k],
        d = gKm(R.pin, [g.la, g.ln]),
        p = d <= 1.5 ? 2 : d <= 8 ? 1 : 0;
      R.dists.push(d);
      R.res.push(p);
      R.pts += p;
      R.lock = true;
      R.shown = true;
      if (p) sfx.tick();
      else sfx.no();
      ctx.paint();
      setTimeout(() => {
        R.shown = false;
        R.lock = false;
        R.pin = null;
        R.view = null;
        R.k++;
        if (R.k >= N) {
          R.over = true;
          if (R.map) try { R.map.remove(); } catch (e) {}
          R.map = null;
          ctx.done();
        } else ctx.paint();
      }, 2600);
    };
    R.review = () =>
      `<div class="rv">${gs.map((x, k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(x.c)}</span><i>${k < R.dists.length ? (R.dists[k] < 1 ? Math.round(R.dists[k] * 1000) + " m" : R.dists[k].toFixed(1) + " km") : "–"}</i><span>${esc(x.s)}</span></div>`).join("")}</div>`;
    R.end = () => ({
      goal: R.pts >= spec.target,
      xp: R.pts >= spec.target ? 30 + 5 * R.pts : 4 * R.pts,
      html: `<p><b>${R.pts}</b> of ${N * 2} points.</p>`
    });
    return R;
  }
});
