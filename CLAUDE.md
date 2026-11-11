# Boffin Matchday

Adam's football quiz game. Mobile-first web app, plain HTML/CSS/JS, no build step, no framework.
Moved here from a claude.ai artifact (https://claude.ai/code/artifact/5be71bbb-820c-4ce6-8f77-f2bcb3f9f007) on 11/11/2026.

## What it is
- AAA-feel football quiz. Core loop: play "matches" (5 chances + penalty) made of mixed question types, earn XP, level up, climb divisions.
- Divisions: Sunday League → Non-League → League Two → League One → Championship → Top Flight → European Nights…
- Modes: league season (19 games, promotion/relegation vs house sides + real players), Club Cup (R16 → Final vs fans of your own club), Club Wars weekly scores, sticker album (Panini-style) of players you name.
- Tone: tongue-in-cheek terrace banter, not cringe. Audience: football casuals, young lads to men in their 30s. UK English.
- Look: "Floodlights" skin — graphite panels, amber LED scoreboard, Big Shoulders Display / Inter / Share Tech Mono. Dark only, on purpose.

## Files
- `index.html` — markup shell + all CSS.
- `app.js` — whole game (~660 lines, dense one-liners). Key bits:
  - `TYPES` — question types: The Grid, Top Ten, Missing XI, The Link, Career Path, The Fee, Name the Season, Squad Sheet, Odd One Out, Higher or Lower, Final Standings.
  - `makeMatch` / `makeRound` — seeded match generation (`rngOf(hash(...))`), difficulty by `tier` (from division).
  - `S` — player state, saved to localStorage under `boffin-matchday-v1`. `fresh()` is the default shape.
  - `Net` — online league via the claude.ai artifact runtime (`window.claude.use("db")` / `"user"`). Outside claude.ai this is absent, so the game silently runs solo (no shared players table).
  - `leagueTable`, `settleSeason`, `nextOpponent` — league logic.
- `data.js` — `window.BD`, ~1.5 MB of real football data (do not hand-edit; regenerate if possible):
  - `players` 15,337 rows: `[name, natIdx, pos, ?, fame, clubSpells[], seasonSpells[], flags]`
  - `clubs` 1,358, `nats` 157, `leagues` 5 (top five)
  - `lists` 236 top-ten lists, `xi` 839 historic line-ups, `tables` 109 final league tables, `hl` 900 transfer-fee pairs, `pairs` 700 team-mate links, `gridClubs` / `gridNats`.
  - Squad records cover 2010–11 to 2026–27 (2022–23 onwards from Fantasy Premier League data).

## Running it
Open `index.html` in a browser, or serve the folder: `npx serve .` (or `python -m http.server`), then open on the phone over the local network.

## Things Adam cares about
- Don't ruin the league mode — it feels like being in a match with a tight promotion battle. Enhance, don't redesign.
- No scrolling on question screens (the `.q` compact layout exists for this; the answer box sits above the keyboard).
- Wants a bigger Premier League question bank and a way to use it as a phone app without opening Claude (PWA / proper hosting is the obvious next step).
- Long-term: Club Wars — fans of different clubs proving whose fans "know ball". Arsenal first.
- Check facts in questions; real data only, no made-up stats.
