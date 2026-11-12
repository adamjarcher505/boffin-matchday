// Sticker pacing simulation. Plays 1,000 matches (league and cup, 3:1) at several accuracy levels through the
// game's real full-time code, which decides sticker offers, and counts what each accuracy level gets offered.
// Target for an average player: about one Paper offer per 4 matches, one Foil per 20, Gold only at milestones.
//   node tests/sim/stickers.js           (writes tests/out/sticker-sim.txt)
const fs = require("fs"), path = require("path");
const { load } = require("../harness.js");
const MATCHES = 1000;
// accuracy = chance of scoring each chance; deep = chance that a goal on a name-one question is a deep cut (rarity >= 0.7).
// Deep-cut rates are estimates: rarity() puts the 30% least famous valid answers in the deep band, and most players
// reach for famous names first. Replace with real numbers from the question log once it has data.
const LEVELS = [{ n: "Struggling", acc: .35, deep: .06 }, { n: "Average", acc: .5, deep: .12 }, { n: "Decent", acc: .65, deep: .2 }, { n: "Boffin", acc: .8, deep: .3 }];
const out = [];
for (const L of LEVELS) {
  const g = load({ localStorage: {} });
  const res = JSON.parse(g.run(`(() => {
    const rnd = rngOf(${Math.round(L.acc * 1000)}); Math.random = rnd;
    S = fresh(); S.made = true; S.name = "Sim"; S.club = "Arsenal"; S.salt = 7; S.stk.free = true;   // skip the one-off onboarding freebie
    const deepTypes = { cell: 1, mates: 1, squad: 1 }, c = { paper: 0, foil: 0, gold: 0, m: 0, league: 0, cup: 0, promos: 0, cups: 0, seasons: 0, divs: [] };
    const take = () => { const o = S.stk.offer; if (o) { c[o.tier]++; S.stk.offer = null; } };
    const play = () => { let deep = 0; const my = M.rounds.slice(0, 5).map(sp => { const goal = rnd() < ${L.acc}; if (goal && deepTypes[sp.type] && rnd() < ${L.deep}) deep++; return goal ? 1 : 0; }); M.my = my; M.deep = deep; M.out = []; M.rev = []; M.xp = 0; M.tt = [0, 0, 0, 0, 0]; };
    for (let k = 0; k < ${MATCHES}; k++) {
      if (k % 4 === 3) {
        startCupMatch(); play(); c.cup++;
        let guard = 0; while (view !== "ft" && guard++ < 12) { const n = M.my.length; if (n < M.rounds.length) { M.my = M.my.concat(M.rounds.slice(n).map(() => rnd() < ${L.acc} ? 1 : 0)); } const before = S.cup.won; cupContinue(); if (S.cup.won > before) c.cups++; }
      } else {
        const d0 = S.div, s0 = S.season; startLeagueMatch(); play(); fullTime(); c.league++;
        if (S.season !== s0) { c.seasons++; if (S.div > d0) c.promos++; c.divs.push(S.div); }
      }
      take(); c.m++;
    }
    return JSON.stringify(c);
  })()`));
  out.push(Object.assign({ level: L.n, acc: L.acc, deep: L.deep }, res));
}
const R = x => x ? "1 per " + (out[0] && 0, (MATCHES / x).toFixed(1)) : "never";
const rules = load().run("JSON.stringify(STICKER_RULES)");
const txt = `Sticker pacing simulation (${MATCHES} matches per level: 3 league to 1 cup tie; real full-time and offer code)
Rules: ${rules}

${"Level".padEnd(11)} ${"acc".padEnd(5)} ${"Paper".padEnd(16)} ${"Foil".padEnd(16)} ${"Gold".padEnd(16)} seasons  promotions  cups won  final division
${out.map(o => `${o.level.padEnd(11)} ${String(o.acc).padEnd(5)} ${(o.paper + " (" + R(o.paper) + ")").padEnd(16)} ${(o.foil + " (" + R(o.foil) + ")").padEnd(16)} ${(o.gold + " (" + R(o.gold) + ")").padEnd(16)} ${String(o.seasons).padEnd(8)} ${String(o.promos).padEnd(11)} ${String(o.cups).padEnd(9)} ${o.divs.length ? o.divs[o.divs.length - 1] : 0}`).join("\n")}

Target for the Average level: Paper about 1 per 4 matches, Foil about 1 per 20, Gold only at promotions and cup wins.
`;
fs.mkdirSync(path.join(__dirname, "..", "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "out", "sticker-sim.txt"), txt);
console.log(txt);
