# Decisions

Judgment calls made while finishing the game (runs on 11 and 12/11/2026), and why.

## Foundations
- **Save key stays `boffin-matchday-v1`; the format version moved to `S.v = 2`.** Changing the key would orphan every existing save. A `MIGRATIONS` table upgrades old saves in place; new fields only, nothing removed, so an older copy of the game still reads a newer save.
- **Merging replaced "more XP wins".** League state (division, season, week, salt, form) can't be mixed between devices without breaking the table, so it comes whole from the save updated last. Collections are unioned and records take the max. Counters aren't summed: without a common ancestor that would double-count shared history. Tested with two devices both playing offline.
- **Sync is pull-merge-push** and never runs mid-match (`M.live`). A per-device "last synced stamp" lives outside the save, so a stamp never travels between devices.
- **The service worker no longer takes over on install.** A new version downloads, waits and shows "New version ready, tap to refresh". The old worker skipped waiting, which would have swapped files under a live match. Same-origin files are now served cache-first from a versioned cache. `tools/bump-sw.js` sets VERSION from a hash of the shipped files, and a unit test fails if it's stale.
- **Code split into plain script files** (`net.js`, `extras.js`, `stickers.js`, `boot.js`, `sticker-pages.js`). No modules or build step; load order is in index.html and the precache list matches it (checked by a test).
- **Google sign-in is hidden inside an installed iPhone app** (`navigator.standalone`): the redirect lands in Safari, not the app. The email code works there.

## Question bank
- **No new data was added.** There's no build script or source list for data.js in the repo, and the brief rules out hand-editing or filling from memory (BLOCKED.md).
- **Thin clubs fixed in the generators instead.** Club-scoped Odd One Out and The Link now step their fame bar down for small clubs. Ipswich, Luton, Hull and Sheffield United went from 3 buildable question types (every cup tie padded with repeats) to 5, with no padding. `QV` bumped `v2| → v3|`, so old ghosts aren't replayed against new questions.
- **19 former Premier League clubs added to the club picker** (Birmingham, Blackpool, Cardiff, Huddersfield, Norwich, QPR, Reading, Swansea, Watford, West Brom, Wigan, Barnsley, Bradford, Charlton, Derby, Oldham, Portsmouth, Sheffield Wednesday, Swindon). They were in the data but unpickable. Eight of them (no 2010+ squad records) still build only 4 question types and repeat The Grid in cup ties; they're still playable. See COVERAGE.md.

## Season stakes
- **"Around you" lines only state things read off the before/after tables:** places moved, who you passed, gap to 4th or the drop, and whether the side next to you won, drew or lost (from their points). No scorelines are invented for house sides.
- **Training XP:** full for 20 chances a day, then halved (`TUNING.trainSoftCap`, `trainSoftFactor`), minimum 1.
- **Replaying for XP:** league and cup XP only come from finished fixtures. Abandoning a league match now gives the rematch a fresh seed (`S.ab`), so nobody can peek at five questions, walk off and replay them for points. Abandoning still forfeits nothing else, as before.

## Club Wars
- **Score = top 10 fans' weekly goals ÷ 10, empty places count as nil**, as briefed. The Supabase function returns the totals; the game divides. When not signed in, your own goals are added on the device so you still see your contribution.

## Theme of the day
- **Themes only add XP (+50% on matching chances); they never touch question generation.** A test checks that seeds produce identical matches whatever the theme.
- **Measured, not guessed.** `tools/theme-support.js` counts matching chances over 6,000 league chances. Dropped for being too rare (under 6% of chances): Invincibles (0.9%), International Break (6.0%, just under), M23 derby (4.7%), Derby della Madonnina (5.7%), Der Klassiker (5.3%). Kept: Golden Boot, Deadline Day, Cult Heroes, Title Race, Teamsheet Day, Journeymen, and the North London, Merseyside, Manchester, Tyne–Wear, Northwest and Second City derbies and El Clásico.
- **Derby names checked against Wikipedia** (DATA_SOURCES.md). "Northwest derby" uses Wikipedia's spelling. The East Midlands and West London derbies weren't used: each covers more than two clubs.

## Stickers
- **Pacing tuned by simulation** (`tests/out/sticker-sim.txt`). As briefed, Paper needed 2 deep cuts and Foil came from any cup-tie win. The sim gave an average player Paper once in 500 matches and Foil once in 6. Changes:
  - **Paper:** one deep cut **or** 4 goals from 5 (`paperDeep: 1`, `paperGoals: 4`). The 4-goal route is new. It rewards a strong match, and deep cuts alone can't hit the target pace for an average player.
  - **Foil:** five from five, or winning a cup **semi-final** (`foilCupRound: 2`). A final win earns a Gold Icon.
  - Result for an average player (50% accuracy): Paper 1 in 5.2 matches, Foil 1 in 20.4, Gold only at promotions and cup wins. Deep-cut rates in the sim are estimates; retune once the question log has real numbers.
- **Who can be offered:** players with a nationality, a birth year and at least one club with a year. 12,899 of 15,337; 2,438 have no nationality on file. One-club players are allowed (a one-club trail is still a clue), otherwise Saka, Gerrard and Scholes could never appear.
- **Page order: fame + 0.25 per year at the club (up to 8 years).** Pure fame put loanees and late arrivals on top (Arsenal's three Icons were Sterling, Aubameyang and Lacazette, with no Henry, Bergkamp or Vieira). Stays of a year or less are left out. The data's fame score still leans to the 2010s, so some legends sit low or miss out (Gerrard isn't on Liverpool's page). **Adam can hand-edit `sticker-pages.js` before launch.** Once players have stickers the pages are frozen (`--add` only adds clubs).
- **Stickers show "Joined 2017", not a range.** The data's club trails miss some moves (Lacazette's 2022 return to Lyon, Cazorla's 2018 move to Villarreal), so departure years worked out from the next recorded club can be wrong.
- **Club colours aren't shown yet.** The band uses the tier's colour. Real club colours are facts and none were sourced this run; `CLUB_COLOURS` in stickers.js is ready for a sourced list.
- **Misses never reveal the player,** so a sticker stays a mystery until you name him.
- **Leaving mid-attempt, or closing the app, counts as a miss,** otherwise anyone could look at the clues and back out.
- **One offer waits at a time.** A better offer replaces a waiting worse one; a worse one never replaces a better one.
- **The free first sticker** (after your first win) is a Gold Icon from your own club, a household name, played on Paper rules (3 clues, 2 guesses).

## Testing
- **Browser checks ran in the app's built-in browser, not Playwright.** Installing Playwright means a large browser download. `tests/browser/qa.js` drives the real game in-page and reports any screen that scrolls. All question types, both grid and sign-in sheets, all three sticker tiers: no scrolling at 375×667, 390×844 or 375×400. Screenshots from that pass were checked by eye, not saved to the repo.
- **Short-screen sheets.** At keyboard height (≤520px tall) the profile and sign-on sheets hide the welcome steps, the founder card and the privacy line, so the fields fit.

## Left as they were
- `supabase/schema.sql`: no bugs found, so untouched. Everything new is in `002_additions.sql`.
- Founder perks: unchanged and cosmetic only.
- `push.bat`: untracked, never staged, never deleted.
