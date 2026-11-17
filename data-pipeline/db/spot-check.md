# Spot check: 30 random database questions (17/11/2026)

Pulled at random across the modes from the built chunks (seeded matches, tiers 1-3), then checked against what I know to be true.
"Known" = checked from my own knowledge of the football. "Can't say" = after my knowledge cutoff (2026-27 transfers) or too obscure for me to confirm; the underlying rows were
still checked against football.db in SQL by the unit tests.

| # | Mode | Question → answer | Verdict |
|--:|---|---|---|
| 1 | Spot the Fake | Roy Keane: Cobh Ramblers › Nottingham Forest › Man United › Celtic; fake: Leicester | Known: correct (never played for Leicester) |
| 2 | Flag XI | 2016-17 Man City XI: Bravo CHI, De Bruyne BEL, Silva ESP, Otamendi ARG, Kolarov SRB, Sterling ENG, Agüero ARG, Clichy FRA, Stones ENG, Touré CIV, Sané GER | Known: correct. (Surname showed "Bruyne": fixed) |
| 3 | Flag XI | 2018-19 Man United XI | Known: correct |
| 4 | Flag XI | 2023-24 Everton XI | Known: correct |
| 5 | Flag XI | 2025-26 Everton XI | Can't say (one nationality unknown, shown as "?") |
| 6 | Exact Score | West Ham v Everton, 18/01/2020 → 1-1 | Known: correct |
| 7 | Exact Score | Southampton v Liverpool, 22/02/2015 → 0-2 | Known: correct |
| 8 | Exact Score | West Brom v West Ham, 17/09/2016 → 4-2 | Known: correct |
| 9 | Exact Score | Norwich v Everton, 17/08/2013 → 2-2 | Known: correct |
| 10 | Hidden Row | 2018-19 third place, 72 pts → Chelsea | Known: correct |
| 11 | Hidden Row | 2007-08 first, 87 pts → Man United | Known: correct |
| 12 | Hidden Row | 2012-13 first, 89 pts → Man United | Known: correct |
| 13 | Hidden Row | 1993-94 first, 92 pts → Man United | Known: correct |
| 14 | In Order | 2001-02: Arsenal 1, Spurs 9, Bolton 16, Leicester 20 | Known: correct |
| 15 | In Order | 2008-09: Man United 1, Villa 6, West Ham 9, Portsmouth 14 | Known: correct |
| 16 | In Order | 2007-08: Portsmouth 8, Newcastle 12, Sunderland 15, Derby 20 | Known: correct |
| 17 | In Order | 2012-13: Chelsea 3, West Ham 10, Southampton 14, Sunderland 17 | Known: correct |
| 18 | Who Bought Him | Brendan O'Callaghan left Stoke, 1984 → Oldham | Known: correct |
| 19 | Who Bought Him | Gordon Strachan left Aberdeen, 1984 → Man United | Known: correct |
| 20 | Who Bought Him | Paul Elliott left Celtic, 1991 → Chelsea | Known: correct |
| 21 | Who Bought Him | Jonathan Castro Otto left PAOK, 2025 → Alavés | Can't say (after my knowledge) |
| 22 | Ever Team-mates | Bellerín + Walcott at Arsenal: yes, 30 games | Known: plausible (overlap 2016-18); count checked in SQL |
| 23 | Ever Team-mates | Deeney + Niang at Watford: yes, 15 games | Known: plausible (Niang loan 2016-17); count checked in SQL |
| 24 | Ever Team-mates | Zambo Anguissa + Daniel James at Fulham: never | Known: correct (Anguissa left in 2019, James joined 2024); never-shared checked in SQL |
| 25 | Ever Team-mates | Sessegnon + Kolo Muani at Tottenham: never | Can't say (Kolo Muani's Spurs spell is after my knowledge); never-shared checked in SQL |
| 26 | Six Degrees | Odion Ighalo → Cristian Romero via Martial then Reguilón | Known: valid (Ighalo/Martial, Martial/Reguilón at United, Reguilón/Romero at Spurs) |
| 27 | Six Degrees | Christian Benteke → Phil Jones via Wan-Bissaka or Fosu-Mensah | Known: valid (Palace, then United) |
| 28 | Six Degrees | Pedro → Raheem Sterling via Jorginho, Kanté or Caballero | Known: valid (Chelsea) |
| 29 | Spot the Fake | Thomas Butler: Sunderland › Darlington › Dunfermline › Hartlepool › Swansea › Alnwick; fake: Middlesbrough | Can't say (obscure) |
| 30 | Golden Boot | 2021-22: Son, Salah, Ronaldo | Known: correct (also checked every season 2016-17 to 2024-25) |

**Result:** 0 wrong answers in the 24 I could check; 6 I couldn't confirm independently. One cosmetic fault (surnames dropping "De"/"van") found and fixed.
Questions with two valid answers: Six Degrees (one-name links) and Golden Boot (tied scorers) accept every valid answer; the Grid only ever accepts more than before (tests in tests/unit/db.test.js).
