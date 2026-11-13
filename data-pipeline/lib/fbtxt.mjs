// Parser for openfootball's Football.TXT match files.
// Handles both layouts in the repo:  "  15:00  Arsenal FC   2-1 (1-0)  Liverpool FC"  and  "Arsenal v Liverpool 2-1 (1-0)",
// date lines with or without a year, and scorer blocks "(Home 12', 40'(p); Away 77'(og))" that can run over several lines.
// Own goals are kept with the team that benefited and flagged og, so they're never credited to the player as a goal.
// Markers for abandoned / awarded / annulled matches are recognised and kept out of tables (none in the PL files today).
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const TIME = String.raw`(?:\d{1,2}[:.]\d{2})`;
const SCORE = String.raw`(\d+)-(\d+)(?:\s*\((\d+)-(\d+)\))?`;
const FLAG = String.raw`(?:\s*\[?(abd|abandoned|awd|awarded|annulled|void|expunged)\]?)?`;
const RE_A = new RegExp(String.raw`^\s*(?:${TIME}\s+)?(.+?)\s{2,}${SCORE}${FLAG}\s{2,}(.+?)\s*$`);          // team1  2-1 (1-0)  team2
const RE_B = new RegExp(String.raw`^\s*(?:${TIME}\s+)?(.+?)\s+v\s+(.+?)\s+${SCORE}${FLAG}\s*$`);            // team1 v team2 2-1 (1-0)
const RE_DATE = /^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\/?\s*(\d{1,2})(?:\s+(\d{4}))?\s*$/;

/* start: the season's first year (2003 for 2003/04). Months August onwards are the first year, the rest the second
   (covers 2019/20, which ran into July 2020). */
const closed = s => (s.match(/\(/g) || []).length <= (s.match(/\)/g) || []).length;   // brackets balance: "(p)" and "(og)" don't end a block
export function parseSeason(text, start) {
  const matches = [], lines = text.split(/\r?\n/);
  let date = null, round = "", cur = null, scorerBuf = null;
  const flush = () => { if (scorerBuf !== null && cur) cur.goals = parseScorers(scorerBuf, cur); scorerBuf = null; };
  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln], line = raw.replace(/\s+$/, "");
    if (scorerBuf !== null) { scorerBuf += " " + line.trim(); if (closed(scorerBuf)) flush(); continue; }
    if (!line.trim() || /^\s*#/.test(line) || /^=/.test(line)) continue;
    if (/^\s*▪/.test(line)) { round = line.replace(/^\s*▪\s*/, "").trim(); continue; }
    let m = RE_DATE.exec(line);
    if (m) { const mo = MON[m[1]], y = m[3] ? +m[3] : (mo >= 8 ? start : start + 1); date = `${y}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`; continue; }
    if (/^\s*\(/.test(line) && cur) { scorerBuf = line.trim(); if (closed(scorerBuf)) flush(); continue; }
    let t1, t2, g1, g2, h1, h2, flag;
    if ((m = RE_B.exec(line))) [, t1, t2, g1, g2, h1, h2, flag] = m;
    else if ((m = RE_A.exec(line))) [, t1, g1, g2, h1, h2, flag, t2] = m;
    else if (/^\s*(?:\d{1,2}[:.]\d{2}\s+)?.+?\s+v\s+.+?\s*$/.test(line)) { cur = null; continue; }   // fixture not played yet (no score)
    else throw new Error(`unparsed line ${ln + 1} (${start}): ${line}`);
    if (!date) throw new Error(`match before any date, line ${ln + 1} (${start})`);
    cur = { date, round, t1: t1.trim(), t2: t2.trim(), g1: +g1, g2: +g2, ht: h1 !== undefined ? [+h1, +h2] : null, status: flag ? flag.toLowerCase().slice(0, 3) : "ok", goals: null, line: ln + 1 };
    matches.push(cur);
  }
  flush();
  return matches;
}

/* "(Hugo EKITIKE 37', Cody GAKPO 49'; Antoine SEMENYO 64', 76')"  ->  [{side, name, min, pen, og}] */
export function parseScorers(buf, match) {
  const inner = buf.replace(/^\(/, "").replace(/\)\s*$/, ""), out = [];
  const parts = inner.split(";");
  // with no ";" and a clean sheet on one side, the file lists only the scoring side's goals: put them on that side
  const sideOf = k => parts.length === 1 && match.g1 === 0 && match.g2 > 0 ? 1 : k;
  parts.forEach((part, k) => { const side = sideOf(k);
    const re = /([^,;]+?)\s+((?:\d+(?:\+\d+)?'(?:\((?:p|pen|og)\))?(?:,\s*(?=\d))?)+)/g; let m;
    while ((m = re.exec(part))) {
      const name = m[1].replace(/^[,\s]+/, "").trim();
      for (const mm of m[2].matchAll(/(\d+)(?:\+(\d+))?'(?:\((p|pen|og)\))?/g)) out.push({ side, name, min: +mm[1], extra: mm[2] ? +mm[2] : 0, pen: mm[3] === "p" || mm[3] === "pen", og: mm[3] === "og" });
    }
  });
  // sanity: goals listed per side should equal the score; if not, keep them but mark the block unreliable
  const n0 = out.filter(g => g.side === 0).length, n1 = out.filter(g => g.side === 1).length;
  if (n0 !== match.g1 || n1 !== match.g2) out.forEach(g => { g.mismatch = true; });
  return out;
}
