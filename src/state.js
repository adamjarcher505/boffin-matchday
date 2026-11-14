"use strict";
/* ============ state.js: balance numbers (TUNING, STICKER_RULES), the save format, migrations, merge, XP, founder badges ============ */

/* ============ state ============ */
/* ============ tuning: every balance number in one place ============ */
const CFG = window.BOFFIN_CONFIG || {};
const SHARE_URL = CFG.shareUrl || (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : ""); // the one share link; set shareUrl in config.js
const TUNING = {
  trainGoalXp: 12,
  trainMissXp: 2, // training XP per chance...
  trainSoftCap: 20,
  trainSoftFactor: 0.5, // ...halved after this many training chances in a day (never zero), so it can't be farmed
  themeBonus: 0.5, // theme of the day: +50% XP on matching chances only
  finalDay: 3, // the last N fixtures of a season get the Final Day treatment
  warsTop: 10, // Club Wars: a club's score is its top N fans' weekly goals divided by N
  gridHint: [2, 3], // daily grid: % off a square's share of the score for the first and second hint (one hint on a full grid = 98%)
  chainXp: 5, // Chain Reaction: XP per link...
  chainXpCap: 60, // ...up to this much a day
  gridHintXp: 5, // ...and XP off that square per hint taken
  logMinSample: 30 // question log: aggregates only come back once a question has this many answers
};
const STICKER_RULES = {
  paperDeep: 1, // paper offer: a league or cup match with at least this many deep cuts (rarity >= deepAt)
  deepAt: 0.7,
  paperGoals: 4, // ...or this many goals from the five chances
  foilCupRound: 2, // foil offer: five from five, or winning a cup tie from this round on (0 = any tie, 1 = quarter-final...)
  clues: { paper: 3, foil: 2, gold: 1 }, // clues showing at the start, of four: clubs, position + nation, born, initials (14/11: clubs always first)
  tries: { paper: 3, foil: 2, gold: 2 }, // 14/11: was 2/1/1. Each wrong guess also unlocks the next clue
  secs: 45, // the clock on a sticker attempt (was 30)
  goldClueEvery: 6, // gold: one more clue every N seconds
  ownClub: 0.5, // share of offers that come from the player's own club
  chaseWeight: 3,
  chaseMax: 3, // chase-list players are this many times likelier
  dupXp: 15,
  dupsPerToken: 3, // duplicates: bonus XP, and every N make one pick-your-player token
  winXp: { paper: 40, foil: 90, gold: 200 },
  pageSize: 18,
  pageIcons: 3,
  pageFoils: 5,
  pageXp: 600,
  ownPageXp: 1500,
  goldChoices: 3,
  shinyChance: 0.04,
  shinyXp: 100 // about 1 in 25 won stickers comes out holographic; a duplicate can still roll shiny
};

/* ============ state ============
   The storage key never changes (so nobody loses a save); the format version is S.v.
   To change the format: bump SAVE_V and add a MIGRATIONS[old] step that upgrades a save in place. Never remove or
   rename a field an older client reads: old clients keep unknown fields, so new ones are safe to add. */
const KEY = "boffin-matchday-v1";
const SAVE_V = 3;
const freshCup = () => ({ club: "", rd: 0, runs: 0, won: 0, best: -1, w: 0, l: 0 });
const freshStk = () => ({
  got: {},
  meta: {},
  chase: [],
  pick: "",
  tok: 0,
  dups: 0,
  offer: null,
  free: false,
  pages: {},
  n: { off: 0, won: 0, lost: 0 }
});
const fresh = () => ({
  cup: freshCup(),
  v: SAVE_V,
  made: false,
  name: "",
  club: "Arsenal",
  xp: 0,
  div: 0,
  season: 1,
  cw: { wk: weekNo(), gf: 0, pts: 0 },
  week: { pl: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
  form: [],
  g: {},
  played: [],
  album: {},
  recent: [],
  grid: {},
  st: { m: 0, w: 0, goals: 0, deep: 0, bestDiv: 0, grids: 0 },
  sound: true,
  salt: Math.floor(Math.random() * 1e9),
  note: null,
  ts: {},
  hist: [],
  lb: {},
  kit: true,
  owner: "",
  t: 0,
  stk: freshStk(),
  tr: { d: "", n: 0 },
  hap: true,
  sk: { d: "", n: 0, best: 0 },
  ob: { d: "", p: {}, done: {}, all: false },
  md: {},
  ct: {},
  sn: { ty: {} },
  wp: null
});
const MIGRATIONS = {
  // v1 -> v2 (12/11/2026): stickers (S.stk), last-updated stamp (S.t), daily training counter (S.tr), haptics toggle (S.hap). Nothing removed.
  1: s => {
    if (!s.stk) s.stk = freshStk();
    if (!s.t) s.t = 0;
    if (!s.tr) s.tr = { d: "", n: 0 };
    if (s.hap === undefined) s.hap = true;
  },
  // v2 -> v3 (14/11/2026): matchday streak (S.sk), daily objectives (S.ob), medals (S.md), lifetime counters (S.ct),
  // this season's running stats (S.sn), last match's table snapshot (S.wp). Nothing removed or renamed.
  2: s => {
    if (!s.sk) s.sk = { d: "", n: 0, best: 0 };
    if (!s.ob) s.ob = { d: "", p: {}, done: {}, all: false };
    if (!s.md) s.md = {};
    if (!s.ct) s.ct = {};
    if (!s.sn) s.sn = { ty: {} };
  }
};
function migrate(o) {
  let v = o.v | 0 || 1;
  while (v < SAVE_V) {
    if (MIGRATIONS[v]) MIGRATIONS[v](o);
    v++;
  }
  if (v > (o.v | 0)) o.v = v;
  return o;
}
const hydrate = o => {
  o = migrate(Object.assign({}, o || {}));
  const s = Object.assign(fresh(), o);
  s.week = Object.assign(fresh().week, o.week || {});
  s.st = Object.assign(fresh().st, o.st || {});
  s.cw = Object.assign(fresh().cw, o.cw || {});
  s.cup = Object.assign(freshCup(), o.cup || {});
  s.stk = Object.assign(freshStk(), o.stk || {});
  s.stk.n = Object.assign(freshStk().n, (o.stk || {}).n || {});
  s.tr = Object.assign({ d: "", n: 0 }, o.tr || {});
  s.sk = Object.assign({ d: "", n: 0, best: 0 }, o.sk || {});
  s.ob = Object.assign({ d: "", p: {}, done: {}, all: false }, o.ob || {});
  if (!s.sn || typeof s.sn !== "object") s.sn = { ty: {} };
  ["album", "grid", "chain", "g", "ts", "lb", "md", "ct"].forEach(k => {
    if (!s[k] || typeof s[k] !== "object") s[k] = {};
  });
  ["form", "played", "recent", "hist"].forEach(k => {
    if (!Array.isArray(s[k])) s[k] = [];
  });
  return s;
};
/* Merge two saves of the same account (two devices that both played, possibly offline).
   League and season state has to stay in one piece (division, season, week, salt and the table all hang together), so it
   comes whole from the save that was updated last. Everything that only ever grows is combined: the Names album and the
   stickers are unioned, XP and records take the higher value, season history keeps every season. Counters are NOT added
   together: without a common starting point that would double-count everything both devices already shared. */
/* sticker collector details: keep the earliest date, the best condition and any shiny from either device */
function mergeMeta(x, y) {
  const o = {};
  [x || {}, y || {}].forEach(src =>
    Object.keys(src).forEach(k => {
      const a = o[k] || {},
        b = src[k] || {};
      o[k] = { d: a.d && b.d ? (a.d < b.d ? a.d : b.d) : a.d || b.d, c: Math.max(a.c || 0, b.c || 0) || undefined, sh: a.sh || b.sh || undefined };
    })
  );
  return o;
}
function mergeSaves(a, b) {
  if (!a || !a.made) return b || a;
  if (!b || !b.made) return a;
  const ta = a.t || 0,
    tb = b.t || 0,
    aNewer = ta !== tb ? ta > tb : a.season !== b.season ? a.season > b.season : (a.xp || 0) >= (b.xp || 0);
  const base = aNewer ? a : b,
    other = aNewer ? b : a,
    m = JSON.parse(JSON.stringify(base)),
    max = (x, y) => Math.max(x || 0, y || 0);
  const maxMap = (x, y) => {
    const o = Object.assign({}, x || {});
    Object.keys(y || {}).forEach(k => {
      o[k] = max(o[k], y[k]);
    });
    return o;
  };
  m.xp = max(a.xp, b.xp);
  m.album = maxMap(base.album, other.album);
  m.seen = (other.seen || [])
    .filter(k => !(base.seen || []).includes(k))
    .concat(base.seen || [])
    .slice(-400);
  m.played = (other.played || [])
    .filter(k => !(base.played || []).includes(k))
    .concat(base.played || [])
    .slice(-60);
  m.st = maxMap(base.st, other.st);
  m.kr = Math.max(base.kr || 0, other.kr || 0); // club knowledge rank already paid out
  // Chain Reaction: one go a day, so keep whichever device got further with today's
  Object.keys(other.chain || {}).forEach(k => {
    const x = (m.chain || {})[k],
      y = other.chain[k];
    if (!x || (y.done && !x.done) || (y.c || []).length > (x.c || []).length) m.chain = { [k]: y };
  });
  m.lb = maxMap(base.lb, other.lb);
  m.ts = Object.assign({}, other.ts || {});
  Object.keys(base.ts || {}).forEach(k => {
    const x = base.ts[k],
      y = m.ts[k];
    m.ts[k] = !y || x[0] >= y[0] ? x : y;
  });
  const hs = {};
  (other.hist || []).concat(base.hist || []).forEach(h => {
    hs[h.s] = h;
  });
  m.hist = Object.keys(hs)
    .map(k => hs[k])
    .sort((x, y) => x.s - y.s)
    .slice(-60);
  m.cup = Object.assign({}, base.cup, {
    won: max(base.cup.won, other.cup.won),
    best: Math.max(base.cup.best, other.cup.best),
    w: max(base.cup.w, other.cup.w),
    l: max(base.cup.l, other.cup.l)
  });
  const bs = base.stk || freshStk(),
    os = other.stk || freshStk();
  m.stk = Object.assign({}, bs, {
    got: maxMap(bs.got, os.got),
    free: !!(bs.free || os.free),
    tok: max(bs.tok, os.tok),
    n: maxMap(bs.n, os.n),
    pages: Object.assign({}, os.pages || {}, bs.pages || {}),
    meta: mergeMeta(os.meta, bs.meta)
  });
  // medals keep the earliest date either device earned them; counters and the best streak take the higher value
  m.md = Object.assign({}, other.md || {});
  Object.keys(base.md || {}).forEach(k => {
    m.md[k] = m.md[k] && m.md[k] < base.md[k] ? m.md[k] : base.md[k];
  });
  m.ct = maxMap(base.ct, other.ct);
  m.sk = Object.assign({ d: "", n: 0, best: 0 }, base.sk || {}, { best: max((base.sk || {}).best, (other.sk || {}).best) });
  m.t = max(ta, tb);
  return hydrate(m);
}
let S = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = hydrate(JSON.parse(raw));
} catch (e) {}
let saveT = 0;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }, 50);
}
function save(push) {
  S.t = Date.now();
  persist();
  if (push) Net.push();
}
const cwNow = () => {
  if (S.cw.wk !== weekNo()) S.cw = { wk: weekNo(), gf: 0, pts: 0 };
  return S.cw;
};
const levelAt = n => Math.round((120 * Math.pow(n, 1.6)) / 10) * 10;
const levelOf = xp => {
  let n = 0;
  while (xp >= levelAt(n + 1)) n++;
  return n + 1;
};
function addXp(n) {
  const a = levelOf(S.xp);
  S.xp += Math.round(n);
  const b = levelOf(S.xp);
  if (b > a) {
    toast("Level " + b + ". The knowledge grows.");
    setTimeout(() => sfx.level(), 500);
  }
}
function addAlbum(i) {
  const k = pkey(i);
  const isNew = !S.album[k];
  const mine = isNew && S.club ? clubIdx(S.club) : -1,
    before = mine >= 0 && hasClub(i, mine) ? knowRank(mine).r : -1;
  S.album[k] = (S.album[k] || 0) + 1;
  S.recent = [k].concat(S.recent.filter(x => x !== k)).slice(0, 40);
  if (before >= 0) {
    // club knowledge: a new rank with your own club pays out (once per rank, kept in S.kr)
    const now = knowRank(mine);
    if (now.r > before && now.r > (S.kr || 0)) {
      S.kr = now.r;
      addXp(KNOW_XP[now.r]);
      toast(S.club + " knowledge: " + KNOW_RANKS[now.r] + ". +" + KNOW_XP[now.r] + " XP");
    }
  }
  return isNew;
}
/* ---------- club knowledge (14/11/2026): the Names log counted per club ----------
   Every player you've named who has a record at a club counts towards that club. Ranks are absolute counts, but scaled
   down for clubs with a small pool in the data, so Brentford fans can reach the top too. */
const KNOW_RANKS = ["Day Tripper", "Regular", "Season Ticket", "Anorak", "Boffin", "Club Historian"];
const KNOW_AT = [0, 10, 25, 50, 100, 200],
  KNOW_FRAC = [0, 0.05, 0.12, 0.25, 0.45, 0.7],
  KNOW_XP = [0, 50, 100, 200, 400, 800];
const knowNeed = (c, r) => Math.min(KNOW_AT[r], Math.max(r, Math.ceil(clubPl[c].length * KNOW_FRAC[r])));
function knowCounts() {
  const n = {};
  Object.keys(S.album).forEach(k => {
    const i = KEY2IDX[k];
    if (i !== undefined) clubsOf(i).forEach(c => (n[c] = (n[c] || 0) + 1));
  });
  return n;
}
function knowRank(c, counts) {
  const n = counts ? counts[c] || 0 : Object.keys(S.album).filter(k => KEY2IDX[k] !== undefined && hasClub(KEY2IDX[k], c)).length;
  let r = 0;
  for (let k = 1; k < KNOW_AT.length; k++) if (n >= knowNeed(c, k)) r = k;
  const next = r + 1 < KNOW_AT.length ? knowNeed(c, r + 1) : null;
  return { n, r, next, of: clubPl[c].length, pc: next ? (n - knowNeed(c, r)) / (next - knowNeed(c, r)) : 1 };
}

/* ============ founder & founding members ============
   f = Founder (one account, set by hand in Supabase). m = member number from sign-up order; 2–100 are Founding Members.
   Both are locked server-side, so nobody can award themselves one. ?preview=founder|member shows the look on localhost only. */
const PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? new URLSearchParams(location.search).get("preview") : null;
const meB = () => (PREVIEW ? { f: PREVIEW === "founder", m: PREVIEW === "member" ? 23 : 0 } : Net.me || {});
const badgeOf = r => (!r ? "" : r.f ? "fd" : r.m && r.m <= 100 ? "fm" : "");
const memNo = r => (r.f ? "001" : pad3(r.m));
const pad3 = n => String(n | 0).padStart(3, "0");
const badgeHTML = (r, size) => {
  const b = badgeOf(r);
  if (!b) return "";
  if (size === "xs") return b === "fd" ? '<span class="badge fd">★</span>' : `<span class="badge fm">FM</span>`;
  return b === "fd"
    ? '<span class="badge fd">★ FOUNDER</span>'
    : `<span class="badge fm">FOUNDING ${size === "lg" ? "MEMBER " : ""}NO. ${memNo(r)}</span>`;
};
function founderCard() {
  const r = meB(),
    b = badgeOf(r);
  if (!b) return "";
  return b === "fd"
    ? `<div class="fcard fd"><span class="fx"></span><div class="fh"><span>Legend</span><span>No. 001</span></div><div class="nm">${esc(S.name || "The Founder")}</div><div class="mt">The Founder · ${esc(S.club)}</div><p>Built the ground. First name on the teamsheet before a ball was kicked, 11.11.26.</p><div class="ff"><span>★ One of one</span><span>Est. 2026</span></div></div>`
    : `<div class="fcard fm"><span class="fx"></span><div class="fh"><span>Founding Member</span><span>No. ${memNo(r)}</span></div><div class="nm">${esc(S.name || "Founding Member")}</div><div class="mt">${esc(S.club)}</div><p>One of the first hundred through the turnstiles. Can't be bought, can't be earned any more.</p><div class="ff"><span>First 100</span><span>Est. 2026</span></div></div>`;
}
