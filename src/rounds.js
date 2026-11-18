"use strict";
/* ============ rounds.js: how each question type plays (RUN), plus the long-form desktop modes ============ */
/* ============ round runtimes ============ */
/* 0 = the obvious answer, 1 = the deepest cut. Ranked by fame (18/11/2026), not by position in the list: players the 1X2 database adds are
   appended to the end of validSetX, and used to score as deep cuts however famous they were. Ties keep list order. */
function rarity(valid, i) {
  if (valid.length < 2 || !valid.includes(i)) return 0;
  const f = PL[i][4];
  let rank = 0,
    seen = false;
  for (const j of valid) {
    if (j === i) seen = true;
    else if (PL[j][4] > f || (PL[j][4] === f && !seen)) rank++;
  }
  return rank / (valid.length - 1);
}
const rarText = x => (x >= 0.7 ? pickR(SAY.deep) : x >= 0.35 ? "A decent pull." : "The obvious one. Still counts.");
function nameOne(spec, valid, intro) {
  // shared by The Grid and The Link
  const R = { tries: 3, goal: false, pick: -1, over: false, rar: 0, picks: [], miss: [] };
  R.review = () => {
    const v = valid.slice().sort((x, y) => PL[y][4] - PL[x][4]),
      nm = a => a.map(i => esc(PL[i][0])).join("</b>, <b>");
    return `<p class="note">${R.miss.length ? "Your misses: " + R.miss.map(i => "<s>" + esc(PL[i][0]) + "</s>").join(", ") + ". " : ""}${v.length} valid answers. Obvious ones: <b>${nm(v.slice(0, 5))}</b>.${v.length > 9 ? " Deep cuts: <b>" + nm(v.slice(-4)) + "</b>." : ""}</p>`;
  };
  R.body = intro;
  R.onPick = i => {
    if (R.over || i < 0) return;
    if (spec.type === "cell" && PL[i][1] < 0 && (spec.a.t === "n" || spec.b.t === "n") && fits(i, spec.a.t === "n" ? spec.b : spec.a)) {
      msg("No nationality on file for " + PL[i][0] + ". Try someone else.", "");
      return;
    }
    if (valid.includes(i)) {
      R.goal = true;
      R.pick = i;
      R.rar = rarity(valid, i);
      R.picks = [i];
      R.over = true;
      ctx.done();
    } else {
      R.tries--;
      R.miss.push(i);
      msg(PL[i][0] + "? " + pickR(SAY.no), "bad");
      sfx.no();
      if (R.tries <= 0) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    }
  };
  R.tries$ = () =>
    `<div class="tries">${[0, 1, 2].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${R.tries} ${R.tries === 1 ? "try" : "tries"} left</span></div>`;
  R.end = () =>
    R.goal
      ? {
          goal: true,
          xp: 30 + Math.round(30 * R.rar),
          deep: R.rar >= 0.7,
          html: `<p><b>${esc(PL[R.pick][0])}</b> fits. ${esc(rarText(R.rar))}</p><p>${valid.length} players would have done.</p>`
        }
      : {
          goal: false,
          xp: 0,
          html: `<p>Would have done: <b>${valid
            .slice(0, 3)
            .map(i => esc(PL[i][0]))
            .join("</b>, <b>")}</b>${valid.length > 3 ? " and " + (valid.length - 3) + " more" : ""}.</p>`
        };
  return R;
}
const RUN = {
  cell(spec) {
    const v = validSetX(spec.a, spec.b); // plain validSet, plus anyone the 1X2 database adds (src/dbx.js)
    const R = nameOne(
      spec,
      v,
      () =>
        `<div class="cats"><div class="cat"><span>${catSub(spec.a)}</span><b>${esc(catLabel(spec.a))}</b></div><div class="amp">+</div><div class="cat"><span>${catSub(spec.b)}</span><b>${esc(catLabel(spec.b))}</b></div></div>${R.tries$()}`
    );
    R.rule =
      spec.a.t === "c" && spec.b.t === "c"
        ? `Name a player who played for both ${CLUB[spec.a.v]} and ${CLUB[spec.b.v]}.`
        : `Name a player who ${catPhrase(spec.a)} and ${catPhrase(spec.b)}.`;
    R.cover = "Two categories, one player. You'll see them when the clock starts."; // 14/11/2026: no thinking time before kick-off
    return R;
  },
  mates(spec) {
    const [a, b] = spec.ab || BD.pairs[spec.i],
      v = ALLIDX.filter(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b));
    const R = nameOne(
      spec,
      v,
      () =>
        `<div class="cats"><div class="cat"><span>Team-mate of</span><b>${esc(PL[a][0])}</b></div><div class="amp">+</div><div class="cat"><span>Team-mate of</span><b>${esc(PL[b][0])}</b></div></div>${R.tries$()}`
    );
    R.rule = `Name a player who was team-mates with both ${PL[a][0]} and ${PL[b][0]}.`;
    R.hint = "Same club, same season, 2010 onwards";
    R.cover = "Two players. Name someone who played with both. You'll see who when the clock starts.";
    return R;
  },
  top(spec) {
    const L = BD.lists[spec.i],
      items = L[3],
      R = { found: {}, n: 0, over: false, picks: [], rule: `Name ${spec.target} players from this top ten.` };
    R.title = L[0];
    R.body = rev =>
      `<p class="rule" style="color:var(--text);font-weight:600">${esc(L[0])}</p><div class="slots">${items.map((it, k) => `<div class="slot ${R.found[k] ? "hit" : rev ? "rev" : ""}"><span class="n">${k + 1}</span><span class="p">${R.found[k] || rev ? esc(PL[it[0]][0]) : "—"}</span><span class="v">${it[1]}${L[1] === "€m" ? "m" : ""}</span></div>`).join("")}</div><div class="tries"><span>${R.n} of ${spec.target} needed · ${L[1] === "€m" ? "fees in €m" : L[1]}</span></div>`;
    R.onPick = i => {
      if (R.over || i < 0) return;
      const k = items.findIndex(it => it[0] === i);
      if (k < 0) {
        msg(PL[i][0] + " isn't in the ten.", "bad");
        sfx.no();
        return;
      }
      if (R.found[k]) {
        msg("Already got him.", "");
        return;
      }
      R.found[k] = 1;
      R.n++;
      R.picks.push(i);
      msg(PL[i][0] + ", number " + (k + 1) + ".", "good");
      sfx.tick();
      if (R.n >= spec.target) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    };
    R.end = () => ({
      goal: R.n >= spec.target,
      xp: R.n >= spec.target ? 30 + 4 * R.n : 4 * R.n,
      html: `<p>You named <b>${R.n}</b> of the ten.</p>`,
      after: R.body(true)
    });
    return R;
  },
  xi(spec) {
    const X = BD.xi[spec.i],
      pl = X[6],
      R = { hit: {}, n: 0, over: false, picks: [], raw: true, rule: `Three players are hidden in this line-up. Name ${spec.target} of them.` };
    const tok = pl.map(p => norm(p[0]).split(" "));
    R.body = rev =>
      `<p class="rule" style="color:var(--text);font-weight:600">${esc(X[0])} ${esc(X[2])} ${esc(X[1])}<span class="eyebrow" style="display:block;font-weight:500;margin-top:3px">${esc(X[4])} · ${esc(X[0])}'s starting XI</span></p><div class="pitchwrap">${pl
        .map((p, k) => {
          const xy = SB[p[1]] || [50, 50],
            b = spec.blanks.indexOf(k),
            sn = p[0].split(" ").slice(-1)[0];
          const show = b < 0 || R.hit[k] || rev;
          return `<span class="pp ${b >= 0 ? (R.hit[k] ? "hit" : rev ? "miss" : "q") : ""}" style="left:${xy[0]}%;top:${100 - xy[1]}%">${show ? esc(b >= 0 ? p[0] : sn) : "?"}</span>`;
        })
        .join("")}</div><div class="tries"><span>${R.n} of ${spec.target} needed · surnames are fine</span></div>`;
    R.onPick = (i, raw) => {
      if (R.over) return;
      const at = norm(i >= 0 ? PL[i][0] : raw)
        .split(" ")
        .filter(Boolean);
      if (!at.length) return;
      const al = at[at.length - 1];
      const k = spec.blanks.find(k => {
        if (R.hit[k]) return false;
        const t = tok[k],
          tl = t[t.length - 1];
        return tl === al || (at.length === t.length && at.every(x => t.includes(x))) || (at.length === 1 && al.length >= 4 && t.includes(al));
      });
      if (k === undefined) {
        msg((i >= 0 ? PL[i][0] : raw) + " isn't one of the three.", "bad");
        sfx.no();
        return;
      }
      R.hit[k] = 1;
      R.n++;
      if (i >= 0) R.picks.push(i);
      msg(pl[k][0] + ". Correct.", "good");
      sfx.tick();
      if (R.n >= spec.target) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    };
    R.end = () => ({
      goal: R.n >= spec.target,
      xp: R.n >= spec.target ? 30 + 5 * R.n : 5 * R.n,
      html: `<p>You found <b>${R.n}</b> of the three.</p>`,
      after: R.body(true)
    });
    return R;
  },
  career(spec) {
    const p = spec.p,
      a = PL[p][5],
      path = [];
    for (let k = 0; k < a.length; k += 2) if (!path.length || path[path.length - 1][0] !== a[k]) path.push([a[k], a[k + 1] + 1990]);
    const sig = i => clubsOf(i).join(","),
      R = { tries: 2, goal: false, over: false, picks: [], rule: "Whose career is this? Clubs in the order he joined them." };
    R.body = () =>
      `<div class="path">${path.map((c, k) => `${k ? "<i>›</i>" : ""}<span>${esc(CLUB[c[0]])}<em>${c[1] >= 2025 ? "now" : "'" + String(c[1]).slice(2)}</em></span>`).join("")}</div><div class="tries">${[0, 1].map(k => `<i class="${k >= R.tries ? "x" : ""}"></i>`).join("")}<span>${POSN[PL[p][2]]} · top-league moves since 1992</span></div>`;
    R.onPick = i => {
      if (R.over || i < 0) return;
      if (i === p || sig(i) === sig(p)) {
        R.goal = true;
        R.picks = [i];
        R.over = true;
        ctx.done();
      } else {
        R.tries--;
        msg(PL[i][0] + "? " + pickR(SAY.no), "bad");
        sfx.no();
        if (R.tries <= 0) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }
    };
    R.review = () => R.body();
    R.end = () => ({
      goal: R.goal,
      xp: R.goal ? 30 + (R.tries === 2 ? 10 : 0) : 0,
      html: `<p>${R.goal ? "Correct:" : "It was"} <b>${esc(PL[p][0])}</b>${PL[p][1] >= 0 ? ", " + esc(NAT[PL[p][1]]) : ""}.</p>`
    });
    return R;
  },
  hl(spec) {
    const R = {
      k: 0,
      ok: 0,
      res: [],
      over: false,
      lock: false,
      shown: null,
      picks: [],
      rule: `Tap the transfer that cost more. Get ${spec.target} of 5 right.`
    };
    const card = (h, side, rev) => {
      const t = BD.hl[h];
      return `<button class="tc ${rev ? rev : ""}" data-act="tap" data-v="${side}"><b>${esc(PL[t[0]][0])}</b><span>${esc(CLUB[t[1]])} to ${esc(CLUB[t[2]])}, ${t[3]}</span><em>${R.shown !== null ? "€" + t[4] + "m" : ""}</em></button>`;
    };
    R.body = () => {
      if (R.k >= 5) return `<div class="pips">${R.res.map(x => `<i class="${x ? "ok" : "no"}"></i>`).join("")}</div>`;
      const [a, b] = spec.pairs[R.k],
        fa = BD.hl[a][4],
        fb = BD.hl[b][4],
        s = R.shown;
      return `<div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div><div class="duo">${card(a, 0, s === null ? "" : fa >= fb ? "right" : s === 0 ? "wrong" : "")}${card(b, 1, s === null ? "" : fb >= fa ? "right" : s === 1 ? "wrong" : "")}</div>`;
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const [a, b] = spec.pairs[R.k],
        fa = BD.hl[a][4],
        fb = BD.hl[b][4],
        good = (+v === 0) === fa >= fb;
      R.res.push(good ? 1 : 0);
      if (good) {
        R.ok++;
        sfx.tick();
      } else sfx.no();
      R.shown = +v;
      R.lock = true;
      ctx.paint();
      setTimeout(() => {
        R.shown = null;
        R.lock = false;
        R.k++;
        if (R.k >= 5) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }, 850);
    };
    R.review = () =>
      `<div class="rv">${spec.pairs
        .map(([a, b], k) => {
          const A = BD.hl[a],
            B = BD.hl[b],
            w = A[4] >= B[4] ? 0 : 1;
          return `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span class="${w === 0 ? "w" : ""}">${esc(PL[A[0]][0])} <em>€${A[4]}m</em></span><i>v</i><span class="${w === 1 ? "w" : ""}">${esc(PL[B[0]][0])} <em>€${B[4]}m</em></span></div>`;
        })
        .join("")}</div>`;
    R.end = () => ({
      goal: R.ok >= spec.target,
      xp: R.ok >= spec.target ? 30 + 2 * R.ok : 3 * R.ok,
      html: `<p><b>${R.ok}</b> of ${Math.max(R.res.length, 1)} right.</p>`
    });
    return R;
  },
  squad(spec) {
    const c = spec.c,
      v = squadOf(c, spec.y).sort((a, b) => PL[b][4] - PL[a][4]),
      lab = sqLabel(spec.y),
      R = { found: [], over: false, picks: [], rule: `Name ${spec.target} players who were in the ${CLUB[c]} squad in ${lab}.` };
    R.title = CLUB[c] + " " + lab;
    R.cover = `One club, one season. Name ${spec.target} of the squad. You'll see which when the clock starts.`;
    R.body = rev =>
      `<p class="rule" style="color:var(--text);font-weight:600">${esc(CLUB[c])} squad · ${lab}</p><div class="chips">${R.found.map(i => `<span class="hit">${esc(PL[i][0])}</span>`).join("")}${rev ? "" : Array.from({ length: Math.max(0, spec.target - R.found.length) }, () => "<span>?</span>").join("")}</div>${
        rev
          ? `<p class="note">Also in it: <b>${v
              .filter(i => !R.found.includes(i))
              .slice(0, 6)
              .map(i => esc(PL[i][0]))
              .join("</b>, <b>")}</b> and ${Math.max(0, v.length - R.found.length - 6)} more.</p>`
          : ""
      }<div class="tries"><span>${R.found.length} of ${spec.target} · anyone on the books that season</span></div>`;
    R.onPick = i => {
      if (R.over || i < 0) return;
      if (R.found.includes(i)) {
        msg("Already got him.", "");
        return;
      }
      if (!v.includes(i)) {
        msg(PL[i][0] + " wasn't in that squad.", "bad");
        sfx.no();
        return;
      }
      R.found.push(i);
      R.picks.push(i);
      msg(PL[i][0] + ". " + (rarity(v, i) >= 0.7 ? pickR(SAY.deep) : "In."), "good");
      sfx.tick();
      if (R.found.length >= spec.target) {
        R.over = true;
        ctx.done();
      } else ctx.paint();
    };
    R.end = () => {
      const n = R.found.length,
        deep = R.found.some(i => rarity(v, i) >= 0.7);
      return {
        goal: n >= spec.target,
        deep,
        xp: n >= spec.target ? 30 + 5 * n + (deep ? 15 : 0) : 5 * n,
        html: `<p>You named <b>${n}</b> of ${spec.target}.${deep ? " One proper deep cut in there." : ""}</p>`,
        after: R.body(true)
      };
    };
    return R;
  },
  odd(spec) {
    const N = spec.sets.length,
      R = {
        k: 0,
        ok: 0,
        res: [],
        over: false,
        lock: false,
        shown: null,
        picks: [],
        rule:
          spec.q
            .replace(/^Three played for (.*)\. Who never did\?$/, "Tap the one who never played for $1.")
            .replace(/^Three played in the Premier League\. Who never did\?$/, "Tap the one who never played in the Premier League.") +
          ` Get ${spec.target} of ${N} right.`
      };
    const pips = () =>
      `<div class="pips">${spec.sets.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    R.body = () => {
      if (R.k >= N) return pips();
      const st = spec.sets[R.k],
        s = R.shown;
      return (
        pips() +
        `<div class="quad">${st.o.map((i, j) => `<button class="tc ${s === null ? "" : j === st.x ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(PL[i][0])}</b><span>${POSN[PL[i][2]]}${PL[i][3] > 0 ? " · b. " + (1900 + PL[i][3]) : ""}</span><em>${s !== null && j === st.x ? "Odd one" : ""}</em></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const st = spec.sets[R.k],
        good = +v === st.x;
      R.res.push(good ? 1 : 0);
      if (good) {
        R.ok++;
        sfx.tick();
      } else sfx.no();
      R.shown = +v;
      R.lock = true;
      ctx.paint();
      setTimeout(() => {
        R.shown = null;
        R.lock = false;
        R.k++;
        if (R.k >= N) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }, 1100);
    };
    R.end = () => ({
      goal: R.ok >= spec.target,
      xp: R.ok >= spec.target ? 30 + 5 * R.ok : 5 * R.ok,
      html: `<p><b>${R.ok}</b> of ${N} right.</p>`,
      after: `<div class="panel pad"><p class="note">${spec.sets.map(st => "<b>" + esc(PL[st.o[st.x]][0]) + "</b>").join(", ")} were the odd ones out.</p></div>`
    });
    return R;
  },
  race(spec) {
    const verb = L =>
      L[1] === "goals" ? "scored more" : L[1] === "assists" ? "had more assists" : L[1] === "apps" ? "made more appearances" : "cost more";
    const R = {
      k: 0,
      ok: 0,
      res: [],
      over: false,
      lock: false,
      shown: null,
      picks: [],
      rule: `Tap the player with the bigger number. Get ${spec.target} of 5 right.`
    };
    const pips = () =>
      `<div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    R.body = () => {
      if (R.k >= 5) return pips();
      const [li, a, b] = spec.pairs[R.k],
        L = BD.lists[li],
        it = L[3],
        s = R.shown,
        win = it[a][1] > it[b][1] ? 0 : 1,
        u = L[1] === "€m" ? "m" : " " + L[1];
      const card = (k, side) =>
        `<button class="tc ${s === null ? "" : side === win ? "right" : s === side ? "wrong" : ""}" data-act="tap" data-v="${side}"><b>${esc(PL[it[k][0]][0])}</b><em>${s !== null ? (L[1] === "€m" ? "€" : "") + it[k][1] + u : ""}</em></button>`;
      return pips() + `<p class="ask">Who ${verb(L)}?<span>${esc(L[0])}</span></p><div class="duo">${card(a, 0)}${card(b, 1)}</div>`;
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const [li, a, b] = spec.pairs[R.k],
        it = BD.lists[li][3],
        good = (+v === 0) === it[a][1] > it[b][1];
      R.res.push(good ? 1 : 0);
      if (good) {
        R.ok++;
        sfx.tick();
      } else sfx.no();
      R.shown = +v;
      R.lock = true;
      ctx.paint();
      setTimeout(() => {
        R.shown = null;
        R.lock = false;
        R.k++;
        if (R.k >= 5) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }, 950);
    };
    R.review = () =>
      `<div class="rv">${spec.pairs
        .map(([li, a, b], k) => {
          const L = BD.lists[li],
            it = L[3],
            u = v => (L[1] === "€m" ? "€" + v + "m" : v + " " + L[1]),
            w = it[a][1] > it[b][1] ? 0 : 1;
          return `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span class="${w === 0 ? "w" : ""}">${esc(PL[it[a][0]][0])} <em>${u(it[a][1])}</em></span><i>v</i><span class="${w === 1 ? "w" : ""}">${esc(PL[it[b][0]][0])} <em>${u(it[b][1])}</em></span><small>${esc(L[0])}</small></div>`;
        })
        .join("")}</div>`;
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 2 * R.ok : 3 * R.ok, html: `<p><b>${R.ok}</b> of 5 right.</p>` });
    return R;
  },
  champ(spec) {
    const N = spec.qs.length,
      R = { k: 0, ok: 0, res: [], over: false, lock: false, shown: null, picks: [], rule: `Tap the right answer. Get ${spec.target} of ${N} right.` };
    const pips = () =>
      `<div class="pips">${spec.qs.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    const ans = q => (q.c !== undefined ? BD.tables[q.t][3].findIndex(x => x[0] === CLUB[q.c]) : q.o.indexOf(q.p));
    R.body = () => {
      if (R.k >= N) return pips();
      const q = spec.qs[R.k],
        T = BD.tables[q.t],
        s = R.shown,
        a = ans(q);
      const head = q.c !== undefined ? `Where did ${esc(CLUB[q.c])} finish?` : `Who finished ${ord(q.p + 1)}?`;
      const opts =
        q.c !== undefined
          ? [0, 1, 2, 3].map(k => ({ b: ord(k + 1), e: T[3][k][1] + " pts" }))
          : q.o.map(k => ({ b: T[3][k][0], e: ord(k + 1) + " · " + T[3][k][1] + " pts" }));
      return (
        pips() +
        `<p class="ask">${head}<span>${esc(T[0])} ${seasonLabel(T[1])}</span></p><div class="quad">${opts.map((o, j) => `<button class="tc ${s === null ? "" : j === a ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(o.b)}</b><em>${s !== null ? esc(o.e) : ""}</em></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const good = +v === ans(spec.qs[R.k]);
      R.res.push(good ? 1 : 0);
      if (good) {
        R.ok++;
        sfx.tick();
      } else sfx.no();
      R.shown = +v;
      R.lock = true;
      ctx.paint();
      setTimeout(() => {
        R.shown = null;
        R.lock = false;
        R.k++;
        if (R.k >= N) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }, 1100);
    };
    R.review = () =>
      `<div class="rv">${spec.qs
        .map((q, k) => {
          const T = BD.tables[q.t],
            a = ans(q);
          return `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${q.c !== undefined ? esc(CLUB[q.c]) + " finished" : "Finished " + ord(q.p + 1)}</span><i>›</i><span class="w">${q.c !== undefined ? ord(a + 1) : esc(T[3][q.p][0])}</span><small>${esc(T[0])} ${seasonLabel(T[1])}</small></div>`;
        })
        .join("")}</div>`;
    R.end = () => ({ goal: R.ok >= spec.target, xp: R.ok >= spec.target ? 30 + 6 * R.ok : 6 * R.ok, html: `<p><b>${R.ok}</b> of ${N} right.</p>` });
    return R;
  },
  quiz(spec) {
    const qs = spec.qs.map(s => (QB.by[s.id] ? Object.assign({ s }, QB.by[s.id]) : null)).filter(Boolean),
      N = qs.length,
      target = Math.min(spec.target, N);
    const R = { k: 0, ok: 0, res: [], over: !N, lock: false, shown: null, picks: [], rule: `Tap the right answer. Get ${target} of ${N} right.` };
    const pips = () => `<div class="pips">${qs.map((x, k) => `<i class="${k < R.res.length ? (R.res[k] ? "ok" : "no") : ""}"></i>`).join("")}</div>`;
    const opt = (x, j) => (x.s.o[j] === 0 ? x.a : x.o[x.s.o[j] - 1]),
      ans = x => x.s.o.indexOf(0);
    R.body = () => {
      if (R.k >= N) return pips();
      const x = qs[R.k],
        s = R.shown,
        a = ans(x);
      return (
        pips() +
        `<p class="ask">${esc(x.q)}${x.sub ? `<span>${esc(x.sub)}</span>` : ""}</p><div class="quad">${x.s.o.map((_, j) => `<button class="tc ${s === null ? "" : j === a ? "right" : s === j ? "wrong" : ""}" data-act="tap" data-v="${j}"><b>${esc(opt(x, j))}</b></button>`).join("")}</div>`
      );
    };
    R.onTap = v => {
      if (R.over || R.lock) return;
      const good = +v === ans(qs[R.k]);
      R.res.push(good ? 1 : 0);
      if (good) {
        R.ok++;
        sfx.tick();
      } else sfx.no();
      R.shown = +v;
      R.lock = true;
      ctx.paint();
      setTimeout(() => {
        R.shown = null;
        R.lock = false;
        R.k++;
        if (R.k >= N) {
          R.over = true;
          ctx.done();
        } else ctx.paint();
      }, 1100);
    };
    R.review = () =>
      `<div class="rv">${qs.map((x, k) => `<div class="${k >= R.res.length ? "" : R.res[k] ? "ok" : "no"}"><span>${esc(x.q)}</span><i>›</i><span class="w">${esc(x.a)}</span><small>${esc(x.sub)}<button class="rpt" data-act="qreport" data-v="${esc(x.id)}">Report</button></small></div>`).join("")}</div>`;
    R.end = () => ({
      goal: R.ok >= target,
      xp: R.ok >= target ? 30 + 6 * R.ok : 6 * R.ok,
      html: `<p><b>${R.ok}</b> of ${N} right.</p>`,
      after: R.review()
    });
    return R;
  },
  season(spec) {
    const T = BD.tables[spec.i],
      ys = BD.tables.filter(t => t[0] === T[0]).map(t => t[1]),
      lo = Math.min(...ys),
      hi = Math.max(...ys),
      R = {
        val: Math.round((lo + hi) / 2),
        over: false,
        locked: false,
        picks: [],
        rule: "Which season ended with this top four? Slide to the year, then lock it in.",
        hint: T[0] + (spec.tol ? " · one year either side still scores" : " · exact year only")
      };
    R.body = rev =>
      `<div class="panel"><table class="tbl"><tr><th></th><th>Club</th><th>GF</th><th>GA</th><th>PTS</th></tr>${T[3].map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r[0])}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[1]}</td></tr>`).join("")}</table><div class="key">Relegated: ${T[4].map(esc).join(", ")}</div></div>${rev ? "" : `<div class="season"><output id="slo">${seasonLabel(R.val)}</output><input type="range" id="sl" min="${lo}" max="${hi}" value="${R.val}" aria-label="Season"><button class="btn" data-act="tap" data-v="lock">Lock it in</button></div>`}`;
    R.onInput = v => {
      R.val = +v;
      const o = $("slo");
      if (o) o.textContent = seasonLabel(R.val);
    };
    R.onTap = () => {
      if (R.over) return;
      R.locked = true;
      R.over = true;
      ctx.done();
    };
    R.review = () => R.body(true);
    R.end = () => {
      const d = R.locked ? Math.abs(R.val - T[1]) : 99;
      return {
        goal: d <= spec.tol,
        xp: d === 0 ? 50 : d <= spec.tol ? 30 : 0,
        html: `<p>It was <b>${seasonLabel(T[1])}</b>. ${R.locked ? "You said " + seasonLabel(R.val) + "." : "You never locked one in."}</p>`
      };
    };
    return R;
  }
};

/* ============ extra time: long-form desktop modes ============ */
const LONG = {
  alltop: {
    n: "All Ten",
    type: "top",
    t: 120,
    d: "A top ten list. Every name, two minutes.",
    make: (r, tier) => {
      const s = makeRound0("top", r, tier, null);
      if (s) s.target = 10;
      return s;
    },
    rule: () => "Name all ten. Every one you get scores."
  },
  fullxi: {
    n: "Blank Teamsheet",
    type: "xi",
    t: 150,
    d: "A whole historic XI blanked out. Name all eleven.",
    make: (r, tier) => {
      const s = makeRound0("xi", r, tier, null);
      if (!s) return null;
      const n = BD.xi[s.i][6].length;
      s.blanks = Array.from({ length: n }, (_, k) => k);
      s.target = n;
      return s;
    },
    rule: () => "The whole line-up is hidden. Name as many as you can. Surnames are fine."
  },
  fullsq: {
    n: "Full Squad",
    type: "squad",
    t: 180,
    d: "One club, one season. Name the lot in three minutes.",
    make: (r, tier) => {
      const s = makeRound0("squad", r, tier, null);
      if (s) s.target = squadOf(s.c, s.y).length;
      return s;
    },
    rule: s => `Name as many of the ${CLUB[s.c]} ${sqLabel(s.y)} squad as you can.`
  }
};
function longSpec() {
  const L = LONG[M.long];
  for (let k = 0; k < 12; k++) {
    const s = L.make(M.seedR, M.tier);
    if (s && !isSeen(s)) return s;
  }
  return L.make(M.seedR, M.tier);
}
function startLong(kind) {
  M = {
    mode: "train",
    long: kind,
    type: LONG[kind].type,
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
const limitS = T => (M.long ? LONG[M.long].t : T.t * (M.mode === "train" ? 1.5 : 1));
const longCount = run => (run.n !== undefined ? run.n : run.found ? run.found.length : 0);
