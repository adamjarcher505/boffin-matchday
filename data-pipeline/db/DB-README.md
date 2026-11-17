# 1X2 football database

`football.db` is one SQLite file (about 58 MB) built entirely from free, keyless sources. No accounts or API keys needed.

## What's in it (built 16/11/2026)

| Table | Rows | What it is |
|---|---|---|
| matches | 242,624 | Every English league match 1888-89 to now (tiers 1-4), FA Cup 1871-2019, League Cup 1960-2019, play-offs, European Cup 1955-2018, and the 2026-27 PL to gameweek 10 |
| standings | 9,926 | Final tables computed from results, including points deductions |
| players | 27,616 | Everyone who's played for the 51 PL clubs per Wikidata, plus every FPL player since 2016-17 |
| player_clubs | 139,588 | Career spells (club, dates, apps, goals) for those players, including clubs abroad and national teams |
| appearances | 260,393 | Player-by-match PL rows since 2016-17: minutes, goals, assists, cards, saves |
| player_season_stats | 7,462 | PL season totals per player |
| lineups / match_events | 11,492 / 28,250 | Full 2025-26 starting XIs, benches, subs and scorers with minutes; goals, assists and cards for 2016-17 onward |
| venues / clubs | 51 / 1,308 | PL grounds with exact coordinates; town-level coordinates, founding year, nicknames and colours for English clubs |
| squads, fixtures_upcoming, points_deductions, competitions | | Supporting tables |

`sample_questions.md` has real questions pulled for every game mode, which proves the data supports them.

## Sources and licences

- **openfootball** (GitHub): CC0, free for any use. 2022-23 and 2025-26 onward results, plus 2025-26 lineups and scorers.
- **engsoccerdata** (GitHub, James Curley): GPL-2. English results 1888 to 2024-25, cups and club data.
- **Wikidata**: CC0, free for any use. Clubs, grounds, careers, nationality and dates of birth.
- **Fantasy Premier League**: the official FPL API (current season) and the vaastav/Fantasy-Premier-League archive (2016-17 onward). This data belongs to the Premier League, so check the FPL terms before relying on it in a paid game. If it's a problem, everything except appearances, season stats and 2016-26 events still stands.

## Rebuild or update

```
python3 -I scripts/fetch_fpl_live.py raw/fpl_live      # delete raw/fpl_live first to refresh the current season
python3 -I scripts/build_db.py                          # about 15 seconds
python3 -I scripts/sample_questions.py                  # optional check
```

Weekly top-up: delete `raw/fpl_live`, rerun the three lines above, and `git pull` inside `raw/openfootball_*` and `raw/fpl_archive`.

## Adding other leagues later

openfootball already holds the top leagues of Spain, Germany, Italy and France, among others (`raw/openfootball_football.json/<season>/es.1.json` etc.), and engsoccerdata has historical results for Spain, Germany, Italy, France, Scotland and more. Add a block in `build_db.py` like the English one, and a Wikidata careers pull for that league's clubs.

## Known gaps (see build_log.txt)

- Player-by-match data starts 2016-17. Before that we have results and careers, but not who played in which game.
- No transfer fees. Who Bought Him works from career order, not prices.
- 1,090 FPL players aren't yet linked to their Wikidata record (mostly fringe and young players). A few of them may appear twice.
- Nationality is filled for 8,511 players. Adding a citizenship fallback from Wikidata would push that up.
- 79 of 11,492 2025-26 lineup names didn't match (Savinho, Gabriel Jesus, Rodrigo Gomes, Toti), so they're stored by name only.
- Clubs abroad use their full Wikidata names (e.g. "Real Madrid Club de Fútbol"), which need a tidy-up for display.
- Cup data ends 2018-19 and European Cup data ends 2017-18.
