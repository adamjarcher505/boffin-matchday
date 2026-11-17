// Flag XI: each club's most-used eleven in a Premier League season (by minutes played), shown as flags. Needs FPL appearances.
// "De Bruyne", "van Dijk": keep the particle with the surname
const PARTICLE = new Set(["de", "da", "do", "dos", "das", "di", "van", "von", "der", "den", "el", "al", "le", "la", "del", "della", "mac", "ten", "ter", "bin", "ben"]);
const surname = name => { const t = name.split(" "); let i = t.length - 1; while (i > 1 && PARTICLE.has(t[i - 1].toLowerCase())) i--; return t.slice(i).join(" "); };

export function build(ctx) {
  const { app, people, clubs, stats, notes, SOURCES, bigness } = ctx;
  if (!SOURCES.fpl || !app.has) { notes.push("Flag XI skipped: FPL source is switched off."); return {}; }
  const names = [], ix = new Map(), ci = n => { if (!ix.has(n)) { ix.set(n, names.length); names.push(n); } return ix.get(n); };
  const POS = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4 };
  const rows = []; let thin = 0, noNat = 0;
  const complete = new Set(ctx.q("select season s from standings where competition_id=1 and season>='2016-17' group by season having min(played)=max(played) and max(played)>=38").map(r => r.s));
  for (const [key, m] of [...app.clubSeason].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [season, cid] = key.split("|"), cn = clubs.get(+cid)?.name;
    if (!cn || !complete.has(season)) continue;
    const list = [...m].map(([id, v]) => ({ id, ...v, p: people.get(id) })).filter(x => x.p && x.p.name && POS[x.p.pos]);
    const gk = list.filter(x => x.p.pos === "Goalkeeper").sort((a, b) => b.mins - a.mins)[0];
    const out = list.filter(x => x.p.pos !== "Goalkeeper").sort((a, b) => b.mins - a.mins).slice(0, 10);
    if (!gk || out.length < 10 || [gk, ...out].some(x => x.mins < 900)) { thin++; continue; }
    const xi = [gk, ...out];
    if (xi.filter(x => x.p.natI >= 0).length < 10) { noNat++; continue; }
    const def = out.filter(x => x.p.pos === "Defender").length, mid = out.filter(x => x.p.pos === "Midfielder").length, fwd = out.filter(x => x.p.pos === "Forward").length;
    if (def < 3 || mid < 2 || fwd < 1) { thin++; continue; }
    const y = +season.slice(0, 4), big = (bigness?.get(cn) ?? 0.3);
    const d = Math.max(1, Math.min(4, Math.round(5 - (big * 3 + (y >= 2021 ? 1 : y >= 2018 ? 0.4 : 0)))));
    rows.push([y, ci(cn), xi.map(x => [x.p.natI, surname(x.p.name), POS[x.p.pos]]), d]);
  }
  stats.flagXIs = rows.length; stats.flagThin = thin; stats.flagNoNat = noNat;
  return { flags: { clubs: names, x: rows, _n: rows.length } };
}
