# Changelog

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
