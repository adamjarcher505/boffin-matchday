# Changelog

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
