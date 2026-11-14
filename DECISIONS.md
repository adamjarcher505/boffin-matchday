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

## Question bank (13/11/2026)
- **There was no question bank to slot into.** Every question in the game is generated on the fly from `data.js`
  tables by the type generators. So the new questions needed a new chance type, not a new file format: **Pub Quiz**
  reuses the Final Standings layout (three questions, four tappable answers, two to score). Gameplay, scoring, league
  mode and the UI are otherwise unchanged. `data.js` is untouched and backwards compatible.
- **What changes in league mode:** Pub Quiz joins the pool the five chances are drawn from (12 types instead of 11),
  so each existing type turns up slightly less often. `QV` now includes the bank version (`v4.20261113|`), so ghosts
  only replay matches built from the same bank; an old save simply has no matching ghosts for a week.
- **Difficulty by division:** Sunday League and Non-League get difficulty 1–2 (there are only ~80 d1 questions),
  then up to d3 and d4 as you climb. Club Cup uses only questions tagged with your club (any difficulty for small clubs).
- **Node, not Python,** for the pipeline: the repo's tools and tests are Node, and Node 22's built-in `node:sqlite`
  means no dependencies to install locally or on GitHub Actions. Downloads go through `curl` because it honours proxies everywhere.
- **Second sources:** engsoccerdata and Wikipedia season tables are verification-only. Adam's notes listed
  engsoccerdata as non-commercial; its DESCRIPTION file says GPL (≥ 2). Either way it's never shipped or committed.
  Wikipedia wasn't on Adam's list; it's used the same way because it's the only source with every final table and
  every points deduction (Middlesbrough 1996/97, Portsmouth 2009/10, Everton and Forest 2023/24).
- **The game's own `data.js` is a second source** for player facts (it already ships). Where it disagrees with
  Wikidata, nothing is published. It lists many defensive midfielders as defenders (Vieira, Kanté, Rice, Carrick,
  Makélélé, Xhaka): 35 well-known players disagree on position, so those position questions are skipped and subtitles
  only show a position both sources agree on.
- **FPL has no birth dates,** so FPL ↔ Wikidata is matched on name + current club (both must agree on the club anyway).
  321 of 672 FPL players linked; the rest just don't get current-squad questions yet.
- **Transfers** use the year both sources give for the move, and the club names `data.js` uses (short). Wrong answers
  for moves abroad come from clubs other players really moved to that year, not a list of giants.
- **Shipped format is compact** (1.4 MB, ~310 KB gzipped): one array per question, one question per line, so a weekly
  PR diff is readable. Source ids are shortened (`of:`, `wd:`, `wp:`, `es:`, `bd:`, `fpl:`).
- **Report** keeps the last 50 reports on the phone and inserts into `question_reports` (`003_question_reports.sql`),
  failing soft until that's run. No user id is stored.

## Testing
- **Pub Quiz passes the no-scroll check** at 375×667, 390×844 and 375×400 (18 screens), including the longest question and answers in the bank.
- **13/11/2026: the no-scroll pass now also runs in headless Playwright** (pre-installed in the cloud session). It found the question drawing overflowing by 24px on every question screen, now fixed.
- **Browser checks ran in the app's built-in browser, not Playwright.** Installing Playwright means a large browser download. `tests/browser/qa.js` drives the real game in-page and reports any screen that scrolls. All question types, both grid and sign-in sheets, all three sticker tiers: no scrolling at 375×667, 390×844 or 375×400. Screenshots from that pass were checked by eye, not saved to the repo.
- **Short-screen sheets.** At keyboard height (≤520px tall) the profile and sign-on sheets hide the welcome steps, the founder card and the privacy line, so the fields fit.

## Left as they were
- `supabase/schema.sql`: no bugs found, so untouched. Everything new is in `002_additions.sql`.
- Founder perks: unchanged and cosmetic only.
- `push.bat`: untracked, never staged, never deleted.
- **iPhone sign-in via hand-off, not the emailed code (13/11/2026).** Supabase now requires custom SMTP to edit email templates, so `{{ .Token }}` can't be added. The installed iPhone app asks for a link with a 256-bit random `?h=` id; Safari files the fresh session with `handoff_put` and drops it locally *without* calling signOut (even `scope: local` revokes the session server-side), and the app polls `handoff_take` (one-time, 15-minute expiry, table unreadable directly). Safari never refreshes, so refresh-token rotation stays with the app. Only used when `navigator.standalone` (iPhone home screen); Chrome and Android installs share storage with the browser already.

## Overnight run (14/11/2026)
- **League rules untouched.** Scoring, the 19-match season, four up and four down, house sides, ghosts and opponent
  results are exactly as they were. Everything added is feel (sound, animation, commentary) or XP (streak, objectives,
  medals). A test still checks a seed builds the same match every time.
- **The opponent's chance is revealed a beat after yours.** Their result was always decided before kick-off; it's
  only shown later. Tapping "Next chance" early skips the wait and nothing is lost.
- **Commentary never invents a fact.** Lines are picked from the real score before and after the chance (took the
  lead, equalised, still behind). No scorers, no minutes beyond the fixed five.
- **Crests are drawn in code** from a side's name: a shield, two colours, initials. Your own uses your club's home
  colours from kits.js. They aren't any real club's badge.
- **Sound is synthesised** (Web Audio noise and tones), so nothing is downloaded or cached. It was already on by
  default with a toggle in the profile; that hasn't changed. iPhones stay silent with the ringer switch off.
- **House-side form** is recorded from the same simulated results the table already used, so it can't disagree with
  the table. Movement arrows compare with the table one match back; real players have no history here, so no arrow.
- **HOUSE tags went, REAL tags came in.** Nineteen HOUSE tags was noise. The note under the table still says what a
  house side is, and real players are the ones marked.
- **Fair-for-the-division limits** (`EASE` in src/generators.js) were set from `node tools/difficulty.js`. "Known" is
  fame 4.5+, "famous" 5.0+. Club Cup rounds are exempt because a small club's data can't always meet them. A round
  gets ten seeded tries to meet the limit, then takes what comes, so a seed always builds something.
- **QV v5.** The limits change what a seed builds, so ghosts recorded on v4 won't be replayed. Opponents fall back to
  house-style results until players have v5 matches behind them (about a week).
- **Objectives are the same for everyone each day** (seeded by the date), so mates can compare. Three from different
  groups, so you never get "win a match" twice. "Keep a clean sheet" was left out: it depends on the other side's luck.
- **Medals for existing players are awarded silently at start-up** (no XP, no fanfare) so nobody opens the game to
  thirty toasts. New ones earned from here pay XP: bronze 25, silver 60, gold 150.
- **Streak XP is capped at seven days** (70 XP) so a long streak is a badge of honour, not an XP farm.
- **Save v3** adds S.sk, S.ob, S.md, S.ct, S.sn and S.wp. Old versions of the game keep fields they don't know, so a
  phone still on the old build doesn't wipe them when it syncs.
- **Stats on phones** lives under Album → Stats to avoid a fifth tab.

## Question categories and generation (14/11/2026, evening)
Reviewed every question type against 2,000 generated league matches and the whole Pub Quiz bank (scripts were
one-off; `node tools/difficulty.js` still covers fairness). What changed, and why:
- **The five chances are mixed on purpose now** (`pickTypes` in src/generators.js). Before, it was any five of twelve
  with The Grid forced in: 4% of matches had four tap rounds and only The Grid to type, 1.5% had five typing rounds on a
  phone keyboard. Now every match has 2 or 3 of each. The Grid still turns up in every match, in a random slot.
- **One per family.** The Fee and Higher or Lower (both "which number's bigger") met in 11% of matches; Final Standings
  and Name the Season (both a final table) in 12%. Now never. Club Cup already kept the tables apart; it now keeps
  both families apart and tries for the same typed/tap balance, dropping that rule only when a small club can't build
  enough of one kind (better than padding with repeat Grids).
- **Final Standings and Pub Quiz can still meet** (12% of matches). Same layout, but different questions entirely;
  splitting them would have made Pub Quiz rarer. Worth revisiting if players say it feels samey.
- **The Fee never shows the same transfer or player twice in a round.** One in ten Fee rounds did.
- **Sunday League gets 44 top tens instead of 16** (`easyTop`): the next band's Premier League lists where at least
  7 of the 10 are well known. A third of Sunday League top tens were repeats over 250 matches. Ligue 1 and Serie A
  scoring charts were left out on purpose, even where they'd pass the fame test.
- **Pub Quiz picks a template first, then a question** (`QUIZ_W`). Straight random picks meant nationality was 24% of
  Sunday League questions and "what position did he play" (the same four buttons every time) was one in ten. Weights
  favour the good stuff (played for, never played for, champions, transfers, finishing positions); position guesses
  are down to 2-3%. Templates with under 60 questions are scaled down so a handful of questions doesn't repeat weekly.
  Inside a template it leans towards the division's band (weight 3 on it, 2 one away, 1 further).
- **QV v6.** The mix changes what every seed builds, so v5 ghosts aren't replayed; house-style results fill in until
  players have v6 matches behind them, as with v5.
- **Not changed:** EASE limits, the round rules, scoring and XP. The Grid repeats about one match in five for a
  Sunday League player who stays down for 250 matches; promotion makes that unlikely, so it was left.
- **New Pub Quiz template: "Which of these clubs did he play for?"** (`played-for`, data-pipeline/generate.mjs). The
  bank had only 45 difficulty-1 questions, so Sunday League leaned on nationality. 632 new questions (61 at d1, 169
  d2, 402 d3), well-known players only (fame 4.4+). The right answer is his longest Premier League spell that
  Wikidata and data.js both have; wrong answers are clubs in the Premier League at the time that neither source has
  him at. Bank 20261113 → 20261114: 8,320 → 8,982 questions.
- **Transfer wrong answers are like for like.** Abroad, they were random (Juventus v San Jose, Treviso, FC Gueugnon).
  Now they're the destinations closest to the right answer in how often PL players went there, from the same side of
  the border: a foreign answer gets foreign wrong answers, an English one English. English clubs are recognised from
  engsoccerdata's team names, used as a build-time filter only (nothing from it ships; it stays verification-only).
- **Wrong Wikidata IDs fixed in config/clubs.mjs.** AFC Wimbledon pointed at Q19593, which is Celtic, so 294 Celtic
  spells were filed as AFC Wimbledon (the new template asked about John Hartson's "AFC Wimbledon" years before this
  was caught). Now Q48851; MK Dons fixed to Q248188 too. The bank as shipped on 13/11 had no question affected. Every
  club ID was then checked against its Wikidata label: all 53 match. Played-for also only ever uses Premier League clubs.
- **The other 451 "never played for" questions that changed** came from Wikidata's data moving between the 13/11 and
  14/11 downloads (same count, different trios), not from code.
