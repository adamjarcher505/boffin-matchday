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
- **Club colours aren't shown yet.** (12/11) Superseded 13/11: the shirt on each sticker now carries sourced club colours (kits.js); the band stays the tier's colour.
- **Misses never reveal the player,** so a sticker stays a mystery until you name him.
- **Leaving mid-attempt, or closing the app, counts as a miss,** otherwise anyone could look at the clues and back out.
- **One offer waits at a time.** A better offer replaces a waiting worse one; a worse one never replaces a better one.
- **The free first sticker** (after your first win) is a Gold Icon from your own club, a household name, played on Paper rules (3 clues, 2 guesses).

## Question screens and sticker records (12/11/2026, evening)
- **Keyboard detection, not screen size alone.** The roomy layout only applies when the screen is tall (640px or more) **and** the keyboard isn't up (`.kb`, from the visual viewport shrinking, or straight away when a text box is focused on a touch screen). On iPhones the page doesn't shrink when the keyboard opens, so height alone can't tell; the visual viewport can. Checked: with the keyboard up, every typed question keeps the answer box and the question body above a 336px keyboard on a 390×844 screen.
- **Typed questions keep their content under the answer box** (bigger, not centred). Centring left a gap between the box and the question. Tap questions centre their cards.
- **Sticker facts are computed from data.js at display time**, never stored or written by hand. Title squads need both the squad record and the final table; line-ups are only used for names that appear once in the data, so a shared name can't pick up someone else's caps. The front only claims a title won with that page's club (a test checks every sticker).
- **Shiny is a cosmetic rarity on top of winning**: 4% of wins, and duplicates can roll it, which gives swaps a purpose. It never changes how hard a sticker is to get.

## Shirts, search and grid hints (13/11/2026)
- **Shirts, not photos.** Adam asked for the actual players if possible. Not done: see BLOCKED.md. Each sticker draws the club's home shirt instead: plain SVG in the club's colours, no badge, sponsor or maker's mark.
- **Kit colours are sourced** from each club's English Wikipedia article (infobox kit and the colours section), read 13/11/2026. Four layouts come from the club's well-known look where the article gives colours only (Monaco's diagonal, Southampton's stripes, Burnley's blue sleeves, and QPR/Reading hoops from "the Hoops" and the club's kit page); they're marked in kits.js.
- **Which shirt:** the one worn in the middle of his spell, with eras where the article dates a change. A famous one-off ("sig", only Arsenal's 2005/06 redcurrant so far) goes to players whose spell ended in it or the season after, so Henry, Bergkamp and Pires get it and Fàbregas and Van Persie don't. With no next club in the data, a spell is taken to run to age 36 (shirt choice only).
- **The sticker band keeps the tier colour.** Adam likes the look, and the shirt now carries the club colours.
- **Search ranking:** every typed word must start a word of the name or be one slip away (4+ letters; two slips at 8+), then whole surname > surname start > first-name start > near miss, then fame. Near misses only show when they run a proper match close, so "kane" doesn't offer Mané. In surname-only questions, Enter never swaps what you typed for a near miss.
- **Suggestions show position and birth year,** never club or nationality, since those are what the grid and sticker clues ask.
- **Grid hints point at one real answer** (the best-known fit not already on the grid) and are fixed once given, so reopening a square doesn't reroll them. A hint on a square you never fill costs nothing, because that square already scores 0. Costs are `TUNING.gridHint` ([2, 3]%) and `gridHintXp` (5 XP).

## Testing
- **13/11/2026: the no-scroll pass now also runs in headless Playwright** (pre-installed in the cloud session). It found the question drawing overflowing by 24px on every question screen, now fixed.
- **Browser checks ran in the app's built-in browser, not Playwright.** Installing Playwright means a large browser download. `tests/browser/qa.js` drives the real game in-page and reports any screen that scrolls. All question types, both grid and sign-in sheets, all three sticker tiers: no scrolling at 375×667, 390×844 or 375×400. Screenshots from that pass were checked by eye, not saved to the repo.
- **Short-screen sheets.** At keyboard height (≤520px tall) the profile and sign-on sheets hide the welcome steps, the founder card and the privacy line, so the fields fit.

## Left as they were
- `supabase/schema.sql`: no bugs found, so untouched. Everything new is in `002_additions.sql`.
- Founder perks: unchanged and cosmetic only.
- `push.bat`: untracked, never staged, never deleted.
- **iPhone sign-in via hand-off, not the emailed code (13/11/2026).** Supabase now requires custom SMTP to edit email templates, so `{{ .Token }}` can't be added. The installed iPhone app asks for a link with a 256-bit random `?h=` id; Safari files the fresh session with `handoff_put` and drops it locally *without* calling signOut (even `scope: local` revokes the session server-side), and the app polls `handoff_take` (one-time, 15-minute expiry, table unreadable directly). Safari never refreshes, so refresh-token rotation stays with the app. Only used when `navigator.standalone` (iPhone home screen); Chrome and Android installs share storage with the browser already.
