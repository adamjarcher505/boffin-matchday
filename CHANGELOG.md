# Changelog

## 14/11/2026 (overnight): match feel, a livelier home screen, streaks and medals
**In a match**
- **Goals feel like goals.** The verdict slams in with a crowd roar, then the other side's chance lands a beat later
  ("They score" / "They miss") and the scoreboard catches up. A commentary line after every chance, read off the real score.
- **Sound**, all made in code (no audio files): crowd, whistle at kick-off, three blasts at full time, a tick for the
  last five seconds. Sound on/off is in the profile, as before.
- **The card before each chance** shows the state of play ("You lead 2–1 · Second half", "Last chance. Must score").
- **Full time** is a sequence: crests and an LED score, the table around you sliding into place, XP counting up.
- Three goals in a row lights up the scoreboard.

**Around the match**
- **Home screen** rebuilt: one big fixture card with crests and a "a win takes you to 3rd" line; Club Cup and Daily
  Grid as tiles; training as a grid of icons. Roughly half the scrolling it was.
- **League table**: a crest for every side, last-five form, and up/down arrows since your last match. Real players are
  tagged REAL; everyone else is a house side.
- **Tabs have icons**, and a thin XP rail runs under the header.
- **Matchday streak**: play a league or cup match on consecutive days. Pays 10 XP a day of streak, up to 70.
- **Three objectives a day**, the same for everyone. Each pays XP; all three pays a bonus.
- **38 medals** (Album → Medals). Existing players get the ones they've already earned, quietly.
- **Season awards** on the season card: biggest win, your banker round, your bogey round.
- **Stats on the phone** (Album → Stats). It was desktop only.
- **New players go straight into their first match** after signing on.

**Fairer questions**
- The Link, Squad Sheet, Top Ten, Missing XI and Career Path now have limits per division, so Sunday League doesn't get
  a Link with three possible answers or a line-up of players nobody's heard of. `tools/difficulty.js` measures it.
- Fixed: Pub Quiz had no description on the training list. Fixed: eight Name the Season tables with long relegated
  lists scrolled on short screens.

**Under the bonnet**
- `app.js` split into nine files in `src/`; the CSS moved out of `index.html`. No build step, same load order.
- `tests/browser/run.js` plays a full league match and cup tie in a headless browser at three phone sizes.
- Save format v3 (adds the streak, objectives, medals and counters; nothing removed). `QV` is now v5.
- League scoring, promotion, relegation, the cup and sticker rules are unchanged.

## 13/11/2026 (evening): a real question bank
- **Pub Quiz**, a new chance type: three multiple-choice questions, get two right. Shows up in league matches, Club
  Cup (questions about your club only) and training.
- **8,320 questions** built from open data: every Premier League champion, finishing position, relegation, points and
  defeats since 1992/93; big wins, derby scores and head-to-heads; player nationality, position, transfers, "which of
  these never played for…", and who's at which club this season. Arsenal alone has over 500.
- **Every question is checked against two independent sources** before it ships. Tables rebuilt from results match
  Wikipedia's final tables for all 34 finished seasons. Anything the sources disagree on is held back for review.
- **Report** button on each Pub Quiz answer, so dodgy questions can be flagged with their sources.
- A weekly refresh (Tuesday mornings) rebuilds the bank and opens a pull request; nothing goes live without a merge.

## 13/11/2026 (evening): iPhone sign-in that lands in the app
- **Signing in from the home-screen app on an iPhone now works.** The sign-in link always opens Safari, which doesn't share its login with the installed game, and Supabase won't put the 6-digit code in its emails without a custom email server. Now the app puts a one-off id in the link; Safari, once signed in, hands the login to the app (and forgets it itself), and the app picks it up within a few seconds of you switching back. Needs `supabase/003_handoff.sql` and the `/**` redirect URL (HANDOVER.md). Elsewhere (laptop, Android, Safari tabs) sign-in is unchanged.

## 13/11/2026: club shirts on stickers, smarter search, grid hints
- **Stickers wear the club's shirt from his time there.** 79 home kits drawn in the club's colours and patterns (stripes, hoops, halves, Ajax's band, PSG's Hechter, Monaco's diagonal), with era shirts where they changed: Henry, Bergkamp and Pires sign off in the 2005/06 redcurrant, Cardiff go red for 2012–15, Bayern have their mid-90s stripes, Bournemouth plain red for 2004–06. Colours sourced from each club's Wikipedia article. No badges or sponsors.
- **Player search is easier.** Best-known players come first ("henry" gives Thierry first, not whoever's first in the data), spelling slips are forgiven ("aguro", "ibrahimovich", "ronaldiho"), spaces don't matter ("vanpersie"). The letters you've typed are lit up, each row shows position and birth year, near misses are tagged "close", players you've already used on today's grid are greyed out, there's a clear button, and arrow keys work on a keyboard.
- **Grid hints.** Stuck on a square? Take a hint: position, birth decade and nationality (2% off), then initials and surname length (another 3%). The grid now has a score: all nine with no hints is 100%, all nine with one hint is 98%. Hinted squares show yellow on the grid and in the share card, and earn 5 XP less per hint.
- **Fix:** the faint drawing on question screens hung off the bottom and right edges, so the page could scroll by 24px and wobble sideways. It's pinned inside the screen now.

## 12/11/2026 (evening): bigger question screens, stickers worth having
- **Question screens use the whole screen** when the keyboard is down: bigger answer cards and category boxes, a bigger pitch for Missing XI, a faint drawing for each question type, and a chance strip under the scoreboard. While the keyboard is up you get the compact layout as before, so the answer box and what you're answering stay above it.
- **Each chance opens with a title card**: the question type's badge, name and a one-line description.
- **Stickers carry real records.** The front shows the best line from the data ("PL top scorer 16/17", "PL title squad 15/16", "€117m move"). Tap a sticker to turn it over: clubs on record, title-winning squads, top-ten finishes, biggest fee, big-match line-ups, and when you stuck him in.
- **Condition and Shiny.** Name him first go on the fewest clues and he's Mint. About 1 in 25 stickers comes out ✦ Shiny (holographic), and a duplicate can still roll shiny.
- Local testing: `node tools/dev-server.js` (never caches) and `?offline` (keeps a test session off the live database).

## 12/11/2026: stickers, stakes and fair Club Wars
**New**
- **Sticker album.** Earn a shot in a match (a deep cut or four goals → Paper; five from five or a cup semi-final win → Foil; promotion or lifting the cup → Gold Icon), then name the man on the sticker from the clues. Miss and he's gone. 79 club pages of 18, swaps, pick-your-player tokens, a chase list, page-complete titles. The old album lives on as "Names".
- **Season stakes.** Points to the promotion line and to safety above the table; "The run-in" and "Final Day" on the last three fixtures; "around you" lines on the vidiprinter after each match; a proper season-end card with a share line.
- **Theme of the day.** +50% XP on matching chances: derbies, Golden Boot, Deadline Day and more.
- **Fair Club Wars.** A club's score is its top 10 fans' goals divided by 10.
- **Share cards** for league, cup, grid, season end and Foil or Gold stickers. Never an answer.
- **Delete my account**, plus a privacy note under sign-in.
- **"New version ready" toast**, so updates never land mid-match.
- **Haptics** (on phones that support them), with a toggle next to Sound.
- **19 more clubs** to support: former Premier League sides.

**Changed**
- Two devices that both played offline now merge instead of the bigger XP total winning.
- Small clubs get proper cup ties (Odd One Out and The Link adapt to them).
- Training XP halves after 20 chances a day.
- Walking off a league match means the rematch is five new questions.
- Google sign-in is hidden inside an installed iPhone app; the email code works there.
- Sheets tighten up when the keyboard is open; the Daily Grid entry no longer overflows.

**Behind the scenes**
- Save format v2 with migrations; code split into net.js, extras.js, stickers.js and boot.js; tests in `tests/`.
- `supabase/002_additions.sql`: Club Wars tally, anonymous question log, aggregate stats, account deletion.

## 11/11/2026: offline app, accounts, Founder, desktop
- Installable offline PWA; Supabase sign-in and cloud saves; Founder and Founding Member badges; desktop dashboard, Stats, match review and Extra Time.

## 11/11/2026: moved from claude.ai
- Imported from the claude.ai artifact.
