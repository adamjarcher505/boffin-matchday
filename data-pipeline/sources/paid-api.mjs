// Hook for a paid fixtures API (e.g. API-Football or football-data.org) for current-season line-ups and scorers.
// NOT BUILT YET, on purpose. It does nothing unless FOOTBALL_API_KEY is set.
// The key lives in GitHub Secrets (Settings > Secrets and variables > Actions > FOOTBALL_API_KEY) and is only ever read
// here, at build time, on the GitHub runner. It must never be committed, written to the cache, or shipped to the browser.
// When it's built: fetch into cache/paid/, load into new tables in build.mjs, and treat it as one source for the
// two-source rule (openfootball or FPL as the other), never as both.
export function paidApiAvailable() { return !!process.env.FOOTBALL_API_KEY; }
export async function fetchPaid() {
  if (!paidApiAvailable()) return { skipped: "no FOOTBALL_API_KEY set" };
  return { skipped: "paid API not implemented yet" };
}
