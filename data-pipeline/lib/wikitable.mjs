// Reads the final league table out of a Wikipedia season article ({{#invoke:Sports table}}). Verification only.
// Returns [{pos, code, article, display, w, d, l, gf, ga, adj}] in finishing order, or null if no table is found.
export function parseWikiTable(raw) {
  const start = raw.search(/\{\{#invoke:\s*Sports table/i); if (start < 0) return null;
  // the block runs to the first line that is just "}}" (the template's close)
  const rest = raw.slice(start), end = rest.search(/\n\s*\}\}\s*(\n|<\/onlyinclude>)/), block = (end > 0 ? rest.slice(0, end) : rest).replace(/<!--[\s\S]*?-->/g, "");
  const val = (k) => { const m = block.match(new RegExp("\\|\\s*" + k + "\\s*=\\s*([^|\\n]*)")); return m ? m[1].trim() : null; };
  let order = val("team_order");
  let codes = order ? order.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (!codes.length) {   // older layout: |team1=LEI |team2=ARS ...
    const byPos = []; for (const m of block.matchAll(/\|\s*team(\d+)\s*=\s*([A-Za-z0-9]+)/g)) byPos[+m[1] - 1] = m[2];
    if (byPos.length && !byPos.includes(undefined)) codes = byPos;
  }
  if (!codes.length) { const seen = new Set(); for (const m of block.matchAll(/\|\s*win_([A-Za-z0-9]+)\s*=/g)) if (!seen.has(m[1])) { seen.add(m[1]); codes.push(m[1]); } }
  if (codes.length < 18) return null;
  const rows = codes.map((code, k) => {
    const nm = block.match(new RegExp("\\|\\s*name_" + code + "\\s*=\\s*\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]"));
    const num = f => { const v = val(f + "_" + code); return v === null || v === "" ? null : +v.replace(/[^\d-]/g, ""); };
    return { pos: k + 1, code, article: nm ? nm[1].trim() : "", display: nm ? (nm[2] || nm[1]).trim() : "", w: num("win"), d: num("draw"), l: num("loss"), gf: num("gf"), ga: num("ga"), adj: num("adjust_points") || 0 };
  });
  if (rows.some(r => r.w === null || !r.article)) return null;
  return rows;
}
