# Plan: Daily Grid + Pin the Ground (written 18/11/2026)

Written by the planning model to be built by a smaller, cheaper model, one task at a time. Every decision is
already made here. If a task needs a decision that isn't in this file, **stop and ask Adam**, don't invent one.

## How to run this (for the build model)

1. Read `CLAUDE.md`, then this file. Read only the files a task names.
2. Before starting: `cd tests && node --test unit/*.test.js` (baseline 18/11: **103 pass**). The test run rewrites
   the date line in `data-pipeline/db/report.md`; undo it with `git checkout -- data-pipeline/db/report.md`, don't commit it.
3. Do **one task per commit**, in order. After each task: unit tests, plus `node tests/browser/run.js` if the task
   touches a screen. Commit message starts with the task id, e.g. `G1: ...`.
4. Tick the box in this file in the same commit. Add a line to `CHANGELOG.md` (player-facing words) and, for any
   judgment call, `DECISIONS.md` under a `## dd/mm/2026: Grid and Pin` heading.
5. Finish each phase with `node tools/bump-sw.js` and push to the working branch. Never push `main`.

### Hard rules (from CLAUDE.md, repeated because they bite)
- **The Daily Grid must be the same for everyone on a given day.** Any change to how `dailyGrid()` *picks* a grid
  only applies from a future grid number (`GRID_V2_FROM`, see G4). Never change today's or past grids.
- **Match seeds must replay identically.** If a task changes what a seed builds (any `make*` function, `pin` pool),
  bump `QV` in `src/match.js` (`"v6."` → `"v7."`). Only once per phase, not per task.
- **No scrolling on question screens** (390×844, 375×667, 360×640 in `tests/browser/run.js`).
- Real data only. No made-up grounds, coordinates, fees or stats.
- Don't touch league balance (`TUNING` values not named here, `league.js`, `EASE`).
- Save format: new save fields go through `hydrate` defaults and `mergeSaves` in `src/state.js`. Follow how
  `S.sk` / `S.ct` were added. Don't bump `SAVE_V` unless a field changes meaning.
- `questions.js`, `data.js`, `data/x/` are generated. Never hand-edit.

### Stop and ask Adam if
- a task would change league mode, the level curve, or sticker pages;
- a Supabase table is needed beyond `supabase/005_grid.sql` (G8);
- any test that passed before now fails and the fix isn't obvious inside the task's files;
- a coordinate check (P7) finds two sources disagreeing by more than 300 m.

---

## What's wrong now (found 18/11 while planning)

**Grid**
- "% obscure" is really *position in the data file*, which is roughly fame order. Players the 1X2 database adds
  (`validSetX`) are appended to the end of the list, so they **always score ~100% obscure** however famous they are.
- `S.grid` keeps only today (`gridState` overwrites it), so there's no history, no grid streak, no average.
- A wrong guess just says "no". It doesn't say which half failed ("never played for Spurs").
- Only four category kinds (club, nationality, league, 15+ goals) from the top 30 clubs and 14 nations. Every day
  feels similar and difficulty never moves.
- Finished grid shows one greyed name per missed square, labelled "the answer most people would have given",
  but it's just the most famous answer, not what people gave.

**Pin the Ground**
- **Breaks offline.** Leaflet is cached, but satellite tiles aren't, so in an offline PWA the round is a black box
  and you score 0. Matches are meant to play offline.
- Pool ignores division and club: a Sunday League player gets League Two grounds; a Cup tie (all fans of one club)
  never features your own ground.
- Lock is allowed at zoom 6 where one tap is ~10 km wide; 45 s for three pins with pinch-zoom is tight on a phone.
- DECISIONS.md (15/11) says the generator and scoring are unit-tested. **They aren't**: no unit test mentions
  `pin` or `GROUNDS`. Only the browser run drops perfect pins.
- 22 of 91 grounds are single-source (`v: "single"`). Esri imagery terms still unchecked (Adam's job, HANDOVER.md).
- Thresholds (1.5 km / 8 km) are hard-coded in `RUN.pin`, not in `TUNING`.

---

## Phase 1: fixes, no new features (do first, low risk)

- [x] **P1. Pin unit tests** (`tests/unit/pin.test.js`, new). Use the harness like `more.test.js` does.
  Cover: `makeRound("pin", ...)` gives 3 distinct indexes into `GROUNDS` for every tier over 200 seeds; same seed
  gives same spec; every ground has numeric `la`/`ln` inside the UK + Ireland box (49–61 N, −11–2 E);
  `gKm` gives ~0 for identical points and Emirates→Tottenham Hotspur Stadium between 5 and 7 km; scoring returns
  2 / 1 / 0 at 1.4 / 7.9 / 8.1 km (extract a `pinPoints(km)` helper in `rounds-more.js` so it's testable).
  Done when: tests pass, nothing else changes.

- [x] **P2. Thresholds into TUNING.** Add `pinNear: 1.5, pinFar: 8` to `TUNING` in `src/state.js`; `pinPoints`
  and the rule text in `RUN.pin` read them. No behaviour change.

- [x] **P3. Offline / failed-tile fallback.** In `RUN.pin`, if `typeof L === "undefined"`, or
  `navigator.onLine === false` at mount, or the tile layer fires 4+ `tileerror` events before any `tileload`,
  switch that round (all remaining grounds) to **"Which ground?"**: four stadium names, tap one. Options are built
  deterministically from the spec (`rngOf(hash("pinmc" + spec.qs.join(".")))`): the right ground plus three others
  from the same division `d` if possible. Right answer = 2 points, wrong = 0, same `target`. Show a one-line note:
  "No signal for the map, so it's names today." Seeds don't change, so **no QV bump**. Add a unit test that options
  always contain the right ground, have 4 distinct names, and are stable for a given spec.
  Done when: `?offline` with network blocked in Playwright plays the round to the end (add a case to
  `tests/browser/run.js` that aborts `server.arcgisonline.com` requests).

- [x] **G1. Real obscurity.** In `gridPick` (and `nameOne`'s `rarity` call for match Grid rounds), rank the valid
  set by `fame()` descending before calling `rarity`, so a database-added famous player isn't scored as a deep
  cut. Ties keep current order. Stored `g.r` for past squares are left alone. Also make the finished-grid greyed
  name the most famous answer explicitly (sort by fame) and change the note from "the answer most people would
  have given" to "the best-known answer" until G8 gives real numbers.
  Unit test: for a cell where `validSetX` adds a player, that player's rarity matches his fame rank, not ~1.

- [x] **G2. Say why a guess missed.** In `gridPick`'s wrong branch, if the player fits one category, say
  "`{name}` never {catPhrase of the other}" (use `catPhrase` from core.js, e.g. "never played for Chelsea");
  if he fits neither, keep the current line. Still costs a guess. Text only.

## Phase 2: Grid becomes a habit

- [x] **G3. Grid history and streak.** New save field `S.gh` = `{ "2026-11-18": [score, got, hints], ... }`, last 60
  days only, written when a grid finishes (same place `careerGrid` is called). `mergeSaves`: union by day, keep the
  entry with the higher score. Grid streak = consecutive days finished up to today or yesterday. Show on the Grid
  screen header ("🔥 4 days") and the finished panel ("Avg last 7: 71%"), add streak to `shareGrid()` when ≥ 2.
  Add a medal in `career.js` `MEDALS`: `grid7` "Seven-Day Grid", finish 7 days running. Save round-trip test in
  `save.test.js`.

- [x] **G4. Fresh grids: new category kinds, weekday difficulty.** Add `const GRID_V2_FROM = <gridNo of the day
  after this ships>` in `grid.js`; `dailyGrid()` keeps the current generator for `gridNo() < GRID_V2_FROM` exactly
  as it is (copy it to `dailyGridV1`, don't edit it).
  The v2 generator:
  - New category `t: "p"` = position (`v` = index into `POSN`; players' `PL[i][2]`). Wire it through `fits`,
    `poolOf` (build `posPl` like `natPl`), `catLabel` (`POSN` holds codes "GK/DEF/MID/FWD", so map them to
    "Goalkeeper", "Defender", "Midfielder", "Forward"), `catPhrase` ("is a goalkeeper"),
    `catSub` ("Position"), and the hint text in `gridHintText` (don't print the position when one header *is*
    position). Check every `.t ===` switch in `extras.js`, `dbx.js`, `generators.js`, `rounds.js` still behaves
    for `"p"`; match rounds must **not** start using `"p"` (that would change seeds).
  - Max one position header per grid, columns only.
  - Weekday difficulty from the grid's date: Mon/Tue club pool top 20 and min valid answers 8; Wed/Thu top 30,
    min 5; Fri–Sun top 40, min 4 and allow a second nationality column. Put these in `TUNING.gridDays`.
  - Label it in the header: "Monday · Gentle", "Thursday · Proper", "Saturday · Brutal".
  Unit tests: `dailyGrid` for 60 future days always returns 3+3 headers, no duplicate header, every cell has at
  least the day's minimum valid answers; for a day before `GRID_V2_FROM` it returns exactly what `dailyGridV1`
  returns (determinism test).

- [x] **G5. Answers sheet after finishing.** On a finished grid, tapping any square opens a sheet: your answer and
  its obscurity, then "Best-known" (top 5 by fame) and "Deep cuts" (bottom 4), total valid count. Reuse the markup
  of `nameOne`'s `R.review`. Must fit without scrolling at 360×640 (cap names, `.q` compact styles).

## Phase 3: Pin the Ground plays fairer, plus a daily version

- [x] **P4. Pool by division and club** (bump `QV` once in this phase). In `makeRound("pin")`: tier 0 picks only
  `PL` grounds, tier 1 `PL` + `CH`, tier 2 adds `L1`, tier 3 all. When the round has a club (`club` option, Cup and
  club-scoped matches), one of the three is that club's ground if it's in `GROUNDS` (match on `GROUNDS[i].c ===
  CLUB[C]`). Never two grounds in one round within 3 km of each other at tiers 0–1 (no Arsenal + Spurs on Sunday
  League). Update P1 tests for the new pools.

- [x] **P5. Map feel.** Timer `TYPES.pin.t` 45 → 60. Show "Zoom in to drop it accurately" over the map while zoom
  < 11, and keep the Lock button disabled until zoom ≥ 11 *or* 20 s have passed (so nobody's stuck). Reveal line
  gets banter by distance: < 0.3 km "On the centre spot.", < 1.5 km "In the car park.", < 8 km "Right town, wrong
  street.", < 50 km "Wrong side of the ring road.", else "Not even the right county." Put lines in `TALK` in fx.js.
  Check no-scroll at all three sizes.

- [x] **P6. Pin of the Day** (new daily game, home tile next to Grid and Chain). Copy the shape of `src/chain.js`
  into `src/pinday.js` (add to `index.html` after chain.js and to `sw.js` SHELL). Five grounds, same for everyone,
  seeded `rngOf(hash("pinday" + dayKey()))`, all divisions, no repeat within 18 days (**corrected while building**: 30 days x 5 = 150 grounds, and there are only 91, so 91 / 5 = 18 days is the most that can be promised; one fixed shuffle, five along it a day). Score = total km (lower is better) and points by the same thresholds. One go per
  day; state in `S.pd = { day, i, km: [], done }`, merged like `S.chain`. Share card: `1X2 PIN No. n` then one
  emoji per ground (🟩 ≤ near, 🟨 ≤ far, 🟥 beyond) and total km. Objective in `OBJ`: "Play Pin of the Day", 30 XP.
  Uses P3's fallback when offline. Tests: same five grounds for a given day, no repeats over 30 days, share text
  has no ground names (spoiler-free).

- [x] **P7. Check the 22 single-source grounds** (only if the session can reach Wikipedia). For each `v: "single"`
  row, find a second independent source (Wikipedia infobox coordinates + the club's own site or OpenStreetMap).
  Agree within 300 m → set `v: "yes"`. Disagree → leave it, list it in `DECISIONS.md` and stop-and-ask. Record the
  sources in the `grounds.js` header. If the network blocks it, write that in `BLOCKED.md` and move on.

## Phase 4 (optional, needs Adam to run SQL): real "% picked"

- [ ] **G8. Crowd obscurity.** `supabase/005_grid.sql`: table `grid_picks(day date, cell smallint, pkey text,
  n int, primary key(day, cell, pkey))` with an RPC `grid_pick(day, cell, pkey)` that increments, plus
  `grid_stats(day)` read. `Net.gridPick` / `Net.gridStats` in `net.js`, failing soft like the other 002 features.
  On a finished grid, show "picked by 12%" when ≥ 20 people played that day, else keep the fame-based number.
  Add the SQL step to `HANDOVER.md`. Don't change the score formula; this is display only.

---

## Order and size (estimates)

| Phase | Tasks | Risk | Rough size |
|---|---|---|---|
| 1 | P1, P2, P3, G1, G2 | Low | 1 session |
| 2 | G3, G4, G5 | Medium (G4 touches the daily seed) | 1–2 sessions |
| 3 | P4, P5, P6, P7 | Medium (QV bump, new mode) | 1–2 sessions |
| 4 | G8 | Needs Adam's Supabase step | Short |

At the end of each phase, ask the planning model (or `/code-review high`) to review the diff before merging.
