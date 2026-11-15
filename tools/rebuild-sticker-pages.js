// Rebuilds sticker-pages.js from tools/sticker-picks.json (14/11/2026). Adam asked for it: the first pages ranked players
// by a fame score that leaned to the 2010s, so Lacazette was a Gold Icon and Henry a Paper.
//   Gold Icons (slots 1-3) and Foils (4-8): hand-picked in sticker-picks.json.
//   Paper (9-18): players already on the old page, best-known and longest-serving first, so albums lose as little as possible;
//   topped up from the data if the old page runs short.
// Albums are keyed by player (name|birth-year), not slot, so a player who stays on the page keeps his sticker.
// A sticker whose player has left the page turns into a token on the player's next load (stickers2.js, PAGES_V).
//   node tools/rebuild-sticker-pages.js           write sticker-pages.js + STICKER-PAGES.md
//   node tools/rebuild-sticker-pages.js --check   just report
const fs = require("fs"), path = require("path");
const { load } = require("../tests/harness.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "sticker-pages.js"), check = process.argv.includes("--check");
const picks = JSON.parse(fs.readFileSync(path.join(__dirname, "sticker-picks.json"), "utf8"));
delete picks._about;
const g = load();
const res = JSON.parse(g.run(`(() => {
  const P = ${JSON.stringify(picks)}, R = STICKER_RULES, out = { pages: [], bad: [], dropped: [] };
  const strip = s => norm(s).replace(/[^a-z ]/g, "");
  const old = {};
  window.BOFFIN_PAGES.forEach(p => (old[p.c] = p.s));
  window.BOFFIN_PAGES.forEach(op => {
    const club = op.c, c = CLUBS_PICK.find(x => CLUB[x] === club), pk = P[club];
    if (c === undefined || !pk) { out.bad.push(club + ": no picks"); out.pages.push({ c: club, s: op.s }); return; }
    const find = n => { const [nm, yy] = n.split("|"); const at = clubPl[c].filter(i => strip(PL[i][0]) === strip(nm) && (!yy || pkey(i).endsWith("|" + yy)) && stkEligible(i)); if (at.length !== 1) out.bad.push(club + ": " + n); return at.length === 1 ? pkey(at[0]) : null; };
    const top = pk.gold.concat(pk.foil).map(find).filter(Boolean), used = new Set(top);
    const keyIdx = k => KEY2IDX[k], sc = i => fame(i) + 0.2 * stkTenure(i, c); // years at the club count, so a loan star doesn't beat a long-server
    const paper = op.s.filter(k => !used.has(k) && keyIdx(k) !== undefined).sort((a, b) => sc(keyIdx(b)) - sc(keyIdx(a)) || (a < b ? -1 : 1));
    let fill = paper.slice(0, R.pageSize - top.length);
    if (fill.length < R.pageSize - top.length) {
      const have = new Set(top.concat(fill)), more = clubPl[c].filter(i => stkEligible(i) && !stkShortStay(i, c) && !have.has(pkey(i))).sort((a, b) => fame(b) - fame(a) || a - b).map(pkey);
      fill = fill.concat(more.slice(0, R.pageSize - top.length - fill.length));
    }
    const s = top.concat(fill);
    op.s.filter(k => !s.includes(k)).forEach(k => out.dropped.push(club + ": " + k.split("|")[0]));
    out.pages.push({ c: club, s, names: s.map(k => PL[keyIdx(k)][0]) });
  });
  return JSON.stringify(out);
})()`));
if (res.bad.length) { console.error("Unresolved picks:\n" + res.bad.join("\n")); process.exit(1); }
const short = res.pages.filter(p => p.s.length !== 18);
if (short.length) { console.error("Pages not 18:", short.map(p => p.c + " " + p.s.length).join(", ")); process.exit(1); }
console.log(res.pages.length, "pages,", res.dropped.length, "players dropped from pages (their stickers become tokens)");
if (check) { console.log(res.dropped.join("\n")); process.exit(0); }
fs.writeFileSync(OUT, "// Sticker album pages: 18 players per club, by name|birth-year key. Rebuilt 14/11/2026 from tools/sticker-picks.json\n// (node tools/rebuild-sticker-pages.js). Slots 1-3 Gold Icon, 4-8 Foil, 9-18 Paper. Players' albums point at these keys:\n// don't reshuffle casually. If you do, bump PAGES_V in src/stickers2.js so removed stickers turn into tokens.\nwindow.BOFFIN_PAGES = [" + res.pages.map(p => JSON.stringify({ c: p.c, s: p.s })).join(",\n") + "];\n");
fs.writeFileSync(path.join(ROOT, "STICKER-PAGES.md"), "# Sticker pages\n\nRebuilt 14/11/2026 by `node tools/rebuild-sticker-pages.js` from `tools/sticker-picks.json`.\nGold Icons and Foils are hand-picked (club legends of the era the data covers, roughly 1992 on). Paper is the best-known of the players already on the old page, topped up from the data.\n\n" + res.pages.map(p => "**" + p.c + "**  \nGold: " + p.names.slice(0, 3).join(", ") + "  \nFoil: " + p.names.slice(3, 8).join(", ") + "  \nPaper: " + p.names.slice(8).join(", ")).join("\n\n") + "\n\n## Dropped from the old pages (stickers turned into tokens)\n\n" + res.dropped.join("\n") + "\n");
console.log("wrote sticker-pages.js and STICKER-PAGES.md");
