// What the pipeline covers. Phase 1: the Premier League from 1992/93, plus an Arsenal deep dive.
export const PL_FIRST = 1992;
// The season that's under way (or about to start): from July onwards it's this calendar year's season.
export const plCurrentStart = (d = new Date()) => d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
// Last finished season: only finished seasons get tables, champions and relegation questions.
export const plLastComplete = (d = new Date()) => plCurrentStart(d) - 1;
