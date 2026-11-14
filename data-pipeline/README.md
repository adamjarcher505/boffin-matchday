# Question pipeline

Builds `questions.js` (the game's question bank) from open data. Runs at build time only: on a laptop, or weekly on
GitHub Actions (`.github/workflows/question-bank.yml`), which opens a pull request. It never runs in the app and never
pushes to `main`.

```
node --no-warnings run.mjs        # fetch -> build -> generate (Node 22.13+, no npm install needed)
node --no-warnings run.mjs --fresh   # ignore the download cache
```

| Step | File | Does |
|---|---|---|
| 1 | `fetch.mjs` | Downloads into `cache/` (gitignored): openfootball PL results, Wikidata (players, careers, winners, venues), the FPL feed, and verification-only engsoccerdata + Wikipedia season tables. Cached; polite to every source. |
| 2 | `build.mjs` | Loads it all into `out/football.db` (SQLite, gitignored). Schema in `schema.sql`. |
| 3 | `generate.mjs` | Writes `../questions.js`, plus `reports/validation.md`, `reports/review.json` and `reports/sample.md` (committed, so each weekly PR shows what changed). |

## Rules it enforces

- **Two sources or it doesn't ship.** Every question names two independent sources in its `src`. Anything with one
  source, or where sources disagree, goes to `reports/review.json` instead.
  - Tables: rebuilt from openfootball results, checked row by row against Wikipedia's final table; champions also
    against Wikidata.
  - Scores: openfootball against engsoccerdata.
  - Player nationality, position, transfers, "never played for": Wikidata against the game's `data.js`.
  - Current club: FPL against Wikidata (FPL has no birth dates, so that link is name + club, not name + birth date).
- **Players are keyed on Wikidata Q-ID.** Matching to `data.js` is name + birth year; never name alone.
- **Clubs are keyed on Wikidata Q-ID** with an alias table (`config/clubs.mjs`): every spelling openfootball,
  engsoccerdata, FPL and `data.js` use. Name changes are stored with dates (`club_eras`); only eras marked `ok` are
  used. Wimbledon FC, MK Dons and AFC Wimbledon are separate clubs.
- **Names** are stored in Unicode NFC, matched on an ASCII-folded key (Ødegaard = Odegaard), the same folding the game uses.
- **Own goals** are credited to the team that benefited, flagged `og`, never counted as the player's goal.
- **Abandoned / awarded / expunged** matches are kept but left out of tables (none in the PL files so far).
- **Points deductions** come from the Wikipedia table (`adjust_points`) and are applied before ordering.
- **Wording**: no "current", "most ever" or "record" (rejected). Current-squad questions carry a month and year.
  "FA Premier League" was the official name until 2006/07; questions say "Premier League" throughout.
- **Phone-sized**: question ≤ 70 characters, subtitle ≤ 40, each answer ≤ 22 (`config/limits.mjs`). Longer ones are
  rejected, not cut.
- **Difficulty 1–4**: from how long ago and how obscure (the player's fame score, the league position).

## Shipped format

`questions.js` sets `window.BOFFIN_Q = { v, asOf, n, t, k, tags, q }`. Each row of `q`:
`[id, template#, category (0 competition, 1 club), difficulty, season, [club#], question, subtitle, answer, [wrong answers], [sources], tag bits]`.
`t` lists template names, `k` the club names (as `data.js` spells them, so Club Cup can filter). The id is a hash of
the question's key, so it stays the same between runs as long as the fact does.

## Adding a template

Add it in `generate.mjs` through `Q({...})`, giving it two sources. Run, read `reports/validation.md`, check
`reports/sample.md`. The game picks it up with no code change. Pub Quiz picks a template first, by the weights in `QUIZ_W`
(src/generators.js); a template not listed there counts as 1, so add it to `QUIZ_W` if it deserves more or less airtime.

## Phases

1. Premier League 1992/93 onwards + Arsenal deep dive (done, 13/11/2026).
2. Champions League / European Cup (openfootball `champions-league`).
3. Old First Division, FA Cup, other top-five leagues, internationals.
