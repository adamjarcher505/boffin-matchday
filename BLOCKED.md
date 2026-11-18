# Blocked or skipped

| What | Why | What would unblock it |
|---|---|---|
| **Bigger Premier League question bank** | Unblocked 13/11/2026: `data-pipeline/` builds `questions.js` from open data (SOURCES.md). data.js itself still has no build script and stays as it is. | — |
| **Scorer questions before 2025/26** | openfootball only has Premier League goalscorers for 2025/26, and no second source covers them yet. | A second scorer source (the paid-API hook, or openfootball adding scorers to older seasons). |
| **2022/23 and 2025/26 scores** | engsoccerdata (the score check) has no 2022/23 and stops at 2024/25, so big wins and derbies from those seasons are held in review. Tables for both seasons do ship (checked against Wikipedia). | football-data.co.uk as a verification source (max two downloads a week), or engsoccerdata updating. |
| **Spot-check of 20 new data items** | No new items were added. | Comes with the data expansion. |
| **Player photos on stickers** | Real photos need image rights from the players and the photographers (Panini pays for a licence). Free Wikimedia photos still carry personality rights and attribution, and would bloat the offline download. | A licence. Until then each sticker shows the club shirt from his era (kits.js). |
| **Connecting Supabase** | `SUPABASE_URL` and `SUPABASE_ANON_KEY` were blank in the brief. | Adam creates the project (HANDOVER.md), then config.js gets the URL and anon key. |
| **Supabase dashboard steps** | Need Adam's own Supabase login. | HANDOVER.md steps 2–5. |
| **Live RLS probes** | No Supabase project exists yet. | After setup, run the read-only checks in TESTING-CHECKLIST.md. |
| **Real-phone tests** | Need real devices. | TESTING-CHECKLIST.md. |
| **Re-running the stuck Pages build** | Needs a GitHub login. A `.nojekyll` file was added and the final push triggers a new build. | If it sticks again: repo → Actions → the run → "Re-run all jobs". |
| **Throttled first-load timing** | Not measured. The built-in browser doesn't throttle the network. data.js is 1.5 MB raw; GitHub Pages gzips it on the way out. It isn't lazy-loaded because every screen needs it. | Chrome DevTools → Network → "Slow 4G", on the live site. |
| **21 grounds still single-source in Pin the Ground** | A second independent source wasn't reachable on 18/11/2026: OpenStreetMap was blocked, Wikipedia was rate-limited, is already the one source for 8 of them, and returned nothing for 12 more. Preston's Deepdale is 414 m from Wikipedia's figure. | Check them on OpenStreetMap or the clubs' own sites from a normal connection; list is in DECISIONS.md (18/11/2026). |
