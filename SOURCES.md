# Sources and credits

Boffin Matchday's facts come from open data. This page credits each source and says how it's used. The short version:
only public-domain (CC0) data and facts derived from it ship in the game; everything else is used on the build machine
to check those facts, and is never shipped or committed.

## Shipped (facts in `questions.js`)

| Source | Licence | What it gives | How it's used |
|---|---|---|---|
| **openfootball** ([england](https://github.com/openfootball/england), [football.json](https://github.com/openfootball/football.json)) | CC0 1.0 (public domain) | Premier League results 1992/93 onwards; goalscorers for 2025/26 | Final tables rebuilt from results; scores, big wins, head-to-heads. Thanks to Gerald Bauer and the openfootball contributors. |
| **Wikidata** ([query.wikidata.org](https://query.wikidata.org)) | CC0 1.0 (public domain) | Player birth dates, nationality, position, career clubs (P54 with dates); season winners; club IDs | Player questions, transfers, "never played for", champions check. Queried with a descriptive User-Agent and cached. |
| **Fantasy Premier League** (`fantasy.premierleague.com/api/bootstrap-static/`) | Unofficial, no published licence | Current squads, positions, minutes | Only derived facts (which club a player is at this season, his position) are used, and only when Wikidata agrees. Fetched at most once per run, never committed. Player photos and the raw feed are never used or stored. |
| **Boffin Matchday's own `data.js`** | Shipped with the game since 11/11/2026 | Nationality, position, birth year and career clubs | Used as the second source for player facts. It already ships, so nothing new is exposed. |

## Verification only (never shipped, never committed)

| Source | Licence | Used for |
|---|---|---|
| **engsoccerdata** ([jalapic/engsoccerdata](https://github.com/jalapic/engsoccerdata)) | GPL (≥ 2), per the package's DESCRIPTION file (there's no separate LICENSE file). Adam's notes listed it as non-commercial; the package itself says GPL. | Second source for every score, big win and head-to-head. It stops at 2024/25 and has no 2022/23 season, so those matches only ship when another check covers them. |
| **Wikipedia season articles** (en.wikipedia.org, CC BY-SA 4.0) | CC BY-SA 4.0 | Final tables (positions, W/D/L, goals, points deductions), compared row by row with the table rebuilt from openfootball. Only the comparison result is kept. |

Facts themselves (who won, what the score was) aren't copyrightable. Nothing from the GPL or CC BY-SA sources is
copied into the game: they confirm facts that come from the CC0 sources.

## Not used

- football-data.co.uk (private use only; could be added for verification at most twice a week).
- dcaribou/transfermarkt-datasets (scraped against Transfermarkt's terms).
- Scraping FBref, Transfermarkt, WhoScored, SofaScore, FotMob or ESPN; StatsBomb open data.
- Any club crests, kit images, player photos, "Panini" or Premier League branding. Sticker shirts are original drawings
  in club colours (see `kits.js`).

## Optional later

A paid fixtures API (API-Football or football-data.org) for current-season line-ups and scorers. The hook is
`data-pipeline/sources/paid-api.mjs`; it does nothing unless a `FOOTBALL_API_KEY` secret is set in GitHub, and the
key is only read on the build runner, never in the browser.

## Credits and data sources: the 1X2 database (added 17/11/2026)
Results and tables: openfootball (CC0) and James Curley's engsoccerdata (GPL-2; checked against openfootball and Wikipedia, 0 mismatches over 13,266 Premier League matches).
Players, clubs, careers, grounds: Wikidata (CC0). Appearances, season stats and 2026-27 results: Fantasy Premier League (the Premier League's data; switchable, see
data-pipeline/db/config.mjs). Satellite imagery in Pin the Ground: Esri World Imagery (terms not yet verified, see DECISIONS.md). Built into data/x/ by data-pipeline/db/.
