# Blocked or skipped

| What | Why | What would unblock it |
|---|---|---|
| **Bigger Premier League question bank (new data)** | There's no build script or list of sources for data.js in the repo or the notes. The only clue is CLAUDE.md saying 2022–23 onwards came from Fantasy Premier League data. The brief rules out hand-editing data.js or filling gaps from memory. | The original build scripts or source list from the chat that made data.js. With those, add top tens, line-ups, final tables (all 20 places, not just the top four) and transfers for the thinnest clubs first (COVERAGE.md), then bump `QV`. |
| **Spot-check of 20 new data items** | No new items were added. | Comes with the data expansion. |
| **Player photos on stickers** | Real photos need image rights from the players and the photographers (Panini pays for a licence). Free Wikimedia photos still carry personality rights and attribution, and would bloat the offline download. | A licence. Until then each sticker shows the club shirt from his era (kits.js). |
| **Connecting Supabase** | `SUPABASE_URL` and `SUPABASE_ANON_KEY` were blank in the brief. | Adam creates the project (HANDOVER.md), then config.js gets the URL and anon key. |
| **Supabase dashboard steps** | Need Adam's own Supabase login. | HANDOVER.md steps 2–5. |
| **Live RLS probes** | No Supabase project exists yet. | After setup, run the read-only checks in TESTING-CHECKLIST.md. |
| **Real-phone tests** | Need real devices. | TESTING-CHECKLIST.md. |
| **Re-running the stuck Pages build** | Needs a GitHub login. A `.nojekyll` file was added and the final push triggers a new build. | If it sticks again: repo → Actions → the run → "Re-run all jobs". |
| **Throttled first-load timing** | Not measured. The built-in browser doesn't throttle the network. data.js is 1.5 MB raw; GitHub Pages gzips it on the way out. It isn't lazy-loaded because every screen needs it. | Chrome DevTools → Network → "Slow 4G", on the live site. |
