# 1X2 database build report

Built 2026-11-17 by `node --no-warnings data-pipeline/db/build.mjs`. Data signature `uck0rb` (the game refuses chunks built against a different data.js).
Sources on: fpl=true, engsoccerdata=false.

## Chunks (460 KB raw, loaded only when a mode needs them)

| Chunk | Size | Items |
|---|---:|---:|
| careers-a | 31 KB | 263 |
| careers-b | 213 KB | 2234 |
| flags | 28 KB | 146 |
| gridv | 96 KB | 197 |
| pals | 40 KB | 1390 |
| scorers | 1 KB | 10 |
| scores-d1 | 3 KB | 105 |
| scores-d2 | 6 KB | 199 |
| scores-d3 | 7 KB | 259 |
| scores-d4 | 8 KB | 297 |
| six | 26 KB | 224 |
| tables | 1 KB | 2 |

## What the script fixed or dropped

- Club 99 is labelled “AFC Wimbledon” but holds Wimbledon FC (1921-2004): renamed to Wimbledon. The real AFC Wimbledon is not in the club table.
- Pin the Ground: the database's 51 grounds are older and fewer than the game's 91 (e.g. it still has Brentford at Griffin Park, Stoke's old Britannia name, one ground with no name). Used only as a cross-check: 39 of 40 shared grounds agree within 300 m; the rest are the database being out of date: AFC Wimbledon (Plough Lane) 0.4 km. The game's own list stays.
- Tables skipped as unfinished: 2026-27.
- Tables dropped because their data source is switched off: 1992-93, 1993-94, 1994-95, 1995-96, 1996-97, 1997-98, 1998-99, 1999-00, 2000-01, 2001-02, 2002-03, 2003-04, 2004-05, 2005-06, 2006-07, 2007-08, 2008-09, 2009-10, 2010-11, 2011-12, 2012-13, 2013-14, 2014-15, 2015-16, 2016-17, 2017-18, 2018-19, 2019-20, 2020-21, 2021-22, 2023-24, 2024-25.
- Top scorers ship names only, not goal counts: FPL's tally differs from the official one in places (Kane 2017-18: FPL 29, official 30).

## Counts

- womenPeople: 127
- fplOnly: 1090
- merged: 12
- mergeAmbiguous: 0
- people: 27355
- unreadableNames: 146
- linkedToGame: 5203
- linkedNoDob: 458
- pinGroundsCompared: 40
- pinGroundsAgree: 39
- scoresByTier: [105,199,259,297]
- scoresSkipped: 12406
- tableSeasons: 2
- teammatePairs: 42345
- palsYes: 9232
- palsNo: 3397
- palsShipped: 1390
- sixNodes: 1739
- sixCandidates: 307
- sixShipped: {"1":54,"2":80,"3":90,"4":0}
- careerEligible: 2497
- careerShipped: 2497
- careerNoDecoy: 0
- gridClubs: 197
- gridClubsNotInGame: 86
- flagXIs: 146
- flagThin: 36
- flagNoNat: 18
- scorerSeasons: 10
