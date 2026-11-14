// How hard are the questions each division actually gets? Builds league matches from seeds (the same way the game
// does) and measures, for the name-a-player rounds, how many well-known answers there are. Dev-only.
//   node tools/difficulty.js            summary table per tier and type
//   node tools/difficulty.js --worst    also list the hardest examples per tier
// "Famous" = fame 5.0 or more in data.js (a household name). A typed round with no famous answer is a stinker for
// the lower divisions; that is what the limits in generators.js (EASE) are tuned against.
const { load } = require("../tests/harness.js");
const g = load(), N = +(process.argv.find(a => /^\d+$/.test(a)) || 300), worst = process.argv.includes("--worst");
const out = JSON.parse(g.run(`(() => {
  const fam = (v, t) => v.filter(i => fame(i) >= t).length, res = [];
  for (let tier = 0; tier < 4; tier++) for (let k = 0; k < ${N}; k++) makeMatch(QV + "d-" + tier + "-" + k + "-5150", tier).forEach(sp => {
    let m = null, label = "";
    if (sp.type === "cell") { const v = validSet(sp.a, sp.b); m = fam(v, 5); label = catLabel(sp.a) + " + " + catLabel(sp.b) + " (" + v.length + " valid)"; }
    else if (sp.type === "mates") { const [a, b] = sp.ab || BD.pairs[sp.i], v = ALLIDX.filter(i => i !== a && i !== b && PL[i][6].length && overlaps(i, a) && overlaps(i, b)); m = fam(v, 5); label = PL[a][0] + " + " + PL[b][0] + " (" + v.length + " valid, pair fame " + fame(a) + "/" + fame(b) + ")"; }
    else if (sp.type === "career") { m = fame(sp.p); label = PL[sp.p][0]; }
    else if (sp.type === "squad") { const v = squadOf(sp.c, sp.y); m = fam(v, 5) - sp.target; label = CLUB[sp.c] + " " + sqLabel(sp.y) + " (" + fam(v, 5) + " famous, need " + sp.target + ")"; }
    else if (sp.type === "top") { const it = BD.lists[sp.i][3]; m = fam(it.map(x => x[0]), 5) - sp.target; label = BD.lists[sp.i][0] + " (need " + sp.target + ")"; }
    else if (sp.type === "xi") { const X = BD.xi[sp.i]; m = Math.min(...sp.blanks.map(b => X[6][b][2])); label = X[0] + " v " + X[1] + " " + X[3] + ": " + sp.blanks.map(b => X[6][b][0]).join(", "); }
    else if (sp.type === "odd") { m = Math.min(...sp.sets.map(st => Math.min(...st.o.map(i => fame(i))))); label = sp.sets.map(st => PL[st.o[st.x]][0]).join(", "); }
    if (m !== null) res.push([tier, sp.type, m, label]);
  });
  return JSON.stringify(res);
})()`));
const by = {};
out.forEach(([tier, type, m, label]) => (by[tier + "|" + type] = by[tier + "|" + type] || []).push([m, label]));
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const NOTE = { cell: "famous answers", mates: "famous answers", career: "player's fame", squad: "famous players beyond the target", top: "famous names beyond the target", xi: "least-known hidden player (line-up score)", odd: "least-known name on screen (fame)" };
console.log("tier type    n     worst   10%    median   measure");
Object.keys(by).sort().forEach(k => {
  const [tier, type] = k.split("|"), a = by[k].slice().sort((x, y) => x[0] - y[0]), v = a.map(x => x[0]);
  console.log(`${tier}    ${type.padEnd(7)} ${String(a.length).padEnd(5)} ${String(v[0]).padEnd(7)} ${String(q(v, 0.1)).padEnd(6)} ${String(q(v, 0.5)).padEnd(8)} ${NOTE[type]}`);
  if (worst) a.slice(0, 4).forEach(x => console.log("        · " + x[0] + "  " + x[1]));
});
