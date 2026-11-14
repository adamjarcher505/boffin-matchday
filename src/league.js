"use strict";
/* ============ league.js: the league table, house sides, season settle, next opponent ============ */
/* ============ league ============ */
function houseRow(sid, div, name, slot, played) {
  const r0 = rngOf(hash("hs" + sid + "-" + div + "-" + slot)),
    s = r0(),
    r = rngOf(hash("hr" + sid + "-" + div + "-" + slot));
  const row = { id: "h" + slot, name, house: true, s, pl: played, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (let m = 0; m < played; m++) {
    const x = r(),
      pw = 0.2 + 0.38 * s;
    if (x < pw) {
      row.w++;
      row.pts += 3;
      row.gf += 2 + Math.floor(r() * 3);
      row.ga += Math.floor(r() * 2);
    } else if (x < pw + 0.24) {
      row.d++;
      row.pts++;
      const g = 1 + Math.floor(r() * 2);
      row.gf += g;
      row.ga += g;
    } else {
      row.l++;
      row.ga += 2 + Math.floor(r() * 3);
      row.gf += Math.floor(r() * 2);
    }
  }
  return row;
}
const SEASON = 19;
function leagueTable() {
  const div = S.div,
    sid = S.season + "." + S.salt;
  const real = Net.rows
    .filter(r => r && r.d === div && r.id !== Net.uid && r.n && (r.pl | 0) <= SEASON)
    .sort((a, b) => (b.t | 0) - (a.t | 0))
    .slice(0, 19)
    .map(r => ({
      id: r.id,
      name: String(r.n).slice(0, 18),
      real: true,
      club: r.c,
      pl: r.pl | 0,
      w: r.wn | 0,
      d: r.dr | 0,
      l: r.ls | 0,
      gf: r.gf | 0,
      ga: r.ga | 0,
      pts: r.p | 0,
      g: r.g || {},
      f: !!r.f,
      m: r.m | 0
    }));
  const names = shuffle(HOUSE, rngOf(hash("hn" + sid + "-" + div))),
    rows = real.slice();
  for (let k = 0; rows.length < 19; k++) rows.push(houseRow(sid, div, names[k], k, S.week.pl));
  const w = S.week;
  rows.push({ id: "me", me: true, name: S.name || "You", f: meB().f, m: meB().m, pl: w.pl, w: w.w, d: w.d, l: w.l, gf: w.gf, ga: w.ga, pts: w.pts });
  rows.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || (a.me ? -1 : b.me ? 1 : 0));
  return rows;
}
const myPos = rows => rows.findIndex(r => r.me) + 1;
function settleSeason() {
  if (S.week.pl < SEASON) return false;
  const pos = myPos(leagueTable()),
    from = S.div;
  if (pos <= 4 && S.div < DIVS.length - 1) S.div++;
  else if (pos >= 17 && S.div > 0) S.div--;
  S.st.bestDiv = Math.max(S.st.bestDiv, S.div);
  S.note = { pos, from, to: S.div, pts: S.week.pts, s: S.season, w: S.week.w, d: S.week.d, l: S.week.l };
  S.hist = (S.hist || [])
    .concat({ s: S.season, d: from, to: S.div, pos, pts: S.week.pts, w: S.week.w, dr: S.week.d, l: S.week.l, gf: S.week.gf, ga: S.week.ga })
    .slice(-60);
  S.season++;
  S.week = fresh().week;
  S.g = {};
  save(true);
  return true;
}
function nextOpponent() {
  const rows = leagueTable().filter(r => !r.me),
    order = shuffle(rows, rngOf(hash("fx" + S.season + "-" + S.div + "-" + S.salt)));
  return order[S.week.pl % order.length];
}
