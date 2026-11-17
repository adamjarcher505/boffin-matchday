# The 1X2 football database → the game

`football.db` (58 MB, built 16/11/2026, see `DB-README.md` for what's in it) never ships to phones. It is kept here as `football.db.gz`
(17 MB; unpacked to `football.db` on first run, which git ignores). One script turns it into small JSON chunks in `data/x/`.

```
node --no-warnings data-pipeline/db/build.mjs      # or: cd data-pipeline && npm run chunks
node tools/bump-sw.js                              # then, before any deploy, as always
```

Writes `data/x/*.json` (named by content hash), `data/x/manifest.json` and `data-pipeline/db/report.md` (what was fixed, dropped and why).
The game loads the chunks a division needs, in the background (`src/dbx.js`). Each mode falls back to the old question bank (data.js,
questions.js) if a chunk is missing, still loading, or built against a different data.js (the chunks carry a signature of it).

## Rollback, one line
`config.js`: set `useDb: false`. Every mode then runs on the old bank and the game never fetches `data/x/`. (`?olddb` on the address does the same for testing.)

## Licence switches: `config.mjs` → `SOURCES`
- `fpl: false` drops everything from Fantasy Premier League (appearances, season stats, 2026-27 results): Ever Team-mates, Six Degrees, Flag XI, Golden Boot.
- `engsoccerdata: false` drops results and tables that came from engsoccerdata (GPL-2): Exact Score and the final-table modes keep only 2022-23 and 2025-26.
Rebuild after changing either.

## What the script fixes (the database has these; the README doesn't mention them)
Wimbledon FC filed as "AFC Wimbledon" · the 2023-24 points deductions missing from the standings (Everton −8, Forest −4; `EXTRA_DEDUCTIONS`) ·
the unfinished 2026-27 table · women's players filed under the men's clubs · the same person twice (Wikidata row + FPL row with a web name like "Silva") ·
a country filed as a club ("India") · youth, B-team, national and regional sides in careers · raw club names ("Real Madrid Club de Fútbol").

## Difficulty
Players: the game's own fame score where the player is in data.js, otherwise estimated from Premier League games since 2016 (calibrated against
the linked players). Matches: how big both clubs are, how recent, derby, goals. Players below fame 3.2 are never asked about; careers must be fully dated.

## Weekly top-up: not automated yet
The database is rebuilt by `scripts/build_db.py` from a `raw/` folder (jalapic/engsoccerdata, openfootball/football.json, vaastav/Fantasy-Premier-League,
the Wikidata pulls from `fetch_wikidata_*.py`, and `scripts/fetch_fpl_live.py` for the current season). `raw/` wasn't in the zip, so a scheduled run can't
be tested from here. To refresh by hand: recreate `raw/` as `DB-README.md` describes, run the three commands there, gzip the new `football.db`
over `football.db.gz`, then run the chunk build above (or the "1X2 database chunks" workflow, which rebuilds from the committed copy and opens a PR).
