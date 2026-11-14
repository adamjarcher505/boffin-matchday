# Boffin Matchday

A football quiz where you play fixtures, not quizzes. Plain HTML, CSS and JavaScript: no framework, no build step.
Live at https://adamjarcher505.github.io/boffin-matchday/ once GitHub Pages has deployed (see HANDOVER.md).

## Run it
```
node tools/dev-server.js
```
Open http://localhost:8080/?offline (`?offline` keeps test sessions off the live database; the dev server never caches). The service worker caches everything, so when you're testing changes, clear it first
(DevTools → Application → Service workers → Unregister, then Storage → Clear site data) or you'll see old files.
`?preview=founder` / `?preview=member` show the badges, on localhost only.

## Test it
```
cd tests
node --test unit/*.test.js       # saves, merging, determinism, features, service worker list
node sim/stickers.js             # sticker pacing over 1,000 matches per skill level (writes tests/out/sticker-sim.txt)
node ../tools/difficulty.js      # how many well-known answers each division's questions have (add --worst for examples)
```
Browser checks, headless: `node tests/browser/run.js` from the project root. It starts its own server and, at
375×667, 390×844 and 375×400 (keyboard open), checks the game loads clean, runs the no-scroll pass on every question
screen, and plays a whole league match and cup tie. Add `--shots <folder>` for screenshots. Needs Playwright.
By hand instead: serve the folder, open it at phone size, and in the console run
`await import("/tests/browser/qa.js"); (await QA.run()).bad` (an empty list means every screen fits).

## Deploy
1. `node tools/bump-sw.js`: sets the service worker VERSION from the files and checks the precache list. **Every deploy.**
2. Run the tests.
3. Commit and push `main`. GitHub Pages serves the repo root (there's a `.nojekyll`, so files are served as they are).
Players get a "New version ready, tap to refresh" toast. Nothing takes over mid-match.

## Files
| File | What it is |
|---|---|
| `index.html` | Markup and the script order. No CSS or game code in it |
| `config.js` | Supabase URL and anon key, Google toggle, share link. Empty = solo play |
| `data.js` | ~1.5 MB of real football data. Don't hand-edit; no build script exists for it yet (BLOCKED.md) |
| `sticker-pages.js` | Frozen sticker album pages, made by `tools/make-sticker-pages.js` |
| `src/styles.css` | All the CSS. The newest sections are at the bottom, dated |
| `src/core.js` | Data lookups, constants, helpers, the player search |
| `src/state.js` | `TUNING`, `STICKER_RULES`, the save format (`SAVE_V`, `MIGRATIONS`, `hydrate`, `mergeSaves`), XP, founder badges |
| `src/fx.js` | Sound (all synthesised), crests, commentary lines, animation helpers. Changes nothing about results |
| `src/career.js` | Matchday streak, daily objectives, medals, season awards (`CAREER`, `OBJ`, `MEDALS`). XP only |
| `src/league.js` | League table, house sides, season settle |
| `src/generators.js` | Question makers, seeded. `EASE` = the fair-for-the-division limits |
| `src/rounds.js` | How each question type plays (`RUN`), and the long desktop modes |
| `src/rounds-more.js` | Eight more types (14/11/2026): Six Degrees, Ever Team-mates?, Spot the Fake, Who Bought Him?, Hidden Row, In Order, Flag XI, Exact Score |
| `src/match.js` | The match engine: league, cup, training; verdict and full-time screens. `QV` lives here |
| `src/grid.js` | The Daily Grid |
| `src/chain.js` | Chain Reaction, the daily 30-second team-mate chain |
| `src/screens.js` | Header, tabs, home, league, album, stats, sheets |
| `src/events.js` | Account actions, the name box, the click handler |
| `src/extras.js` | Share cards, season stakes, Club Wars, question log, theme of the day, haptics |
| `questions.js` | GENERATED question bank (Pub Quiz). Built by `data-pipeline/`; never hand-edit. Format in data-pipeline/README.md |
| `kits.js` | Home shirts for the 79 sticker clubs, with era shirts; sourced from Wikipedia (see the header) |
| `src/stickers.js` | The sticker album: offers, the "name the man on the sticker" attempt, pages, tokens, the sticker card |
| `src/stickers2.js` | Legends, Sticker of the Day, tilt-to-shine, peel-and-stick, Best XI, team photo, swaps with mates |
| `src/net.js` | Everything online, behind one interface (Supabase, Claude artifact db, or local) |
| `src/boot.js` | Starts the game; service worker and update toast |
| `sw.js` | Offline cache |
| `supabase/` | `schema.sql` (run first), `002_additions.sql` (run second), `003_handoff.sql` (third: iPhone sign-in hand-off), `make-founder.sql` |
| `tools/` | Icons, coverage report, sticker pages, theme support, service worker version |
| `tests/` | Dev-only. Never shipped or cached |

## Rules that keep the game honest
- **Determinism.** A league match rebuilds from its seed (`makeMatch`), so a ghost replays the same five chances on
  another device. Anything that changes what a seed produces (data, generators, difficulty) must bump `QV` in src/match.js.
  `tests/unit/determinism.test.js` checks it.
- **Saves.** The storage key never changes. The format version is `S.v` (`SAVE_V`). To change the format, add a step to
  `MIGRATIONS` and never remove a field. `tests/fixtures/save-v1.json` must always load.
- **Balance.** Every number lives in `TUNING` and `STICKER_RULES` in src/state.js; `EASE` in src/generators.js; `CAREER` in src/career.js.
- **Facts.** Real data only. Nothing from memory. See DATA_SOURCES.md.

## Data model (Supabase)
**`players`** (public read; each player updates only their own row; one row made per sign-up by a trigger)

| Column | Meaning |
|---|---|
| `id` | auth user id |
| `n`, `c` | name on the teamsheet, club |
| `d`, `s` | division (0 Sunday League … 7 Knows Ball), season number |
| `p`, `pl`, `wn`, `dr`, `ls`, `gf`, `ga` | this season: points, played, won, drawn, lost, goals for and against |
| `w`, `cg`, `cp` | Club Wars week number, goals and points that week |
| `xp`, `cu` | XP, cups won |
| `g` | recent match results by seed, so opponents can replay them as ghosts |
| `t` | last update (ms) |
| `f`, `m` | Founder flag, member number. A trigger stops players changing either |

**`saves`** (private: each player reads and writes only their own row): `id`, `json` (the whole save), `t` (its last-updated stamp, used to merge devices).

**From `002_additions.sql`** (the game works without it):
- `club_wars(wk)`: per club, the sum of its top 10 fans' goals that week, fans, places filled and the tenth fan's total.
- `question_log`: one anonymous row per match (`v` generator version, `d` division, `q` up to ten `[question key, tier, type, scored, seconds]`). Clients can insert but never read.
- `question_stats(min_n)`: correct rates by type and division, and per question, only for groups with enough answers.
- `delete_my_account()`: deletes the caller's save, league row and sign-in.

**Claude artifact db mode** (when the game runs inside claude.ai): the same `players` rows and saves at
`data/users/<id>/save`. Reads are capped at 500 unsorted records, so tables and Club Wars only see up to 500 players there.

## Syncing two devices
The device save is the source of truth while you play. When online, `Net.push()` checks the cloud save's stamp. If another
device has written since, it merges (`mergeSaves`) before writing back:
- League and season state comes whole from whichever device updated last (it all hangs together).
- The Names log, stickers, seen questions and season history are combined.
- XP and records take the higher value.

## Fairer difficulty, phase 2 (planned, not built)
Once the question log has a few thousand matches, `boffinStats()` in the console shows correct rates by type and division
and the hardest and easiest questions. Phase 2 would re-tier questions from those numbers. Changing tiers changes what a
seed produces, so it must ship as a versioned snapshot (a frozen table of question key → tier) with a `QV` bump, between
seasons, so nobody's season changes underneath them and ghosts still line up.
