// How often each theme of the day matches a league chance, across all four tiers. Themes the data can't back up
// (fewer than MIN of chances match) are left out of the rota. Run from the project root:  node tools/theme-support.js
// Prints the table and the rota to paste into THEME_ROTA in extras.js (or pass --write to update it).
const fs = require("fs"), path = require("path");
const { load } = require("../tests/harness.js");
const MIN = .06;   // with 5 chances a match, 6% of chances matching = roughly 1 match in 4 has at least one themed chance
const g = load();
const rows = JSON.parse(g.run(`(() => {
  const N = 300, specs = [];
  for (let t = 0; t < 4; t++) for (let k = 0; k < N; k++) makeMatch(QV + "ts-" + t + "-" + k + "-1", t).forEach(sp => specs.push(sp));
  return JSON.stringify(Object.keys(THEMES).map(id => {
    const T = THEMES[id]; let n = 0, matches = 0;
    if (T.late) return { id, n: T.n, share: null, note: "depends on the answer given (deep cuts), always possible" };
    specs.forEach(sp => { try { if (T.m(sp)) n++; } catch (e) { } });
    for (let i = 0; i < specs.length; i += 5) if (specs.slice(i, i + 5).some(sp => { try { return T.m(sp); } catch (e) { return false; } })) matches++;
    return { id, n: T.n, share: n / specs.length, perMatch: matches / (specs.length / 5) };
  }));
})()`));
const keep = rows.filter(r => r.share === null || r.share >= MIN), drop = rows.filter(r => r.share !== null && r.share < MIN);
const pct = x => (x * 100).toFixed(1) + "%";
const txt = `Theme support (league chances, 300 matches per tier, 6,000 chances)\n\n` +
  rows.map(r => `${(r.n + "                         ").slice(0, 24)} ${r.share === null ? "n/a     " : pct(r.share).padStart(6) + "  "} ${r.share === null ? r.note : pct(r.perMatch) + " of matches have one"}  ${r.share !== null && r.share < MIN ? "DROPPED" : ""}`).join("\n") +
  `\n\nRota (${keep.length}): ${keep.map(r => r.id).join(", ")}\nDropped (${drop.length}): ${drop.map(r => r.n).join(", ")}\n`;
fs.mkdirSync(path.join(__dirname, "..", "tests", "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "tests", "out", "theme-support.txt"), txt);
console.log(txt);
if (process.argv.includes("--write")) {
  const f = path.join(__dirname, "..", "extras.js"); let s = fs.readFileSync(f, "utf8");
  s = s.replace(/const THEME_ROTA = \[[^\]]*\];/, "const THEME_ROTA = " + JSON.stringify(keep.map(r => r.id)).replace(/,/g, ", ") + ";");
  fs.writeFileSync(f, s); console.log("THEME_ROTA updated in extras.js");
}
