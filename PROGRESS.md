# Progress (combined brief: finish, extend, go live)

Run 1 stopped early on 11/11/2026 (usage limit). Run 2 resumed 12/11/2026. Resume from the first unchecked item.

## Phase 0: orient
- [x] Read CLAUDE.md, SETUP.md, git log, code
- [x] Old-format save fixture captured before any change: tests/fixtures/save-v1.json (S.v = 1, built with the game's own fresh())
- [x] Node test harness: tests/harness.js loads the real scripts (index.html order) into a vm with a stub DOM
- [x] DATA: coverage report written (tools/coverage.js -> COVERAGE.md)
- [ ] DECISIONS.md, BLOCKED.md, HANDOVER.md started (notes below need moving into them)

## Phase 1: Pages check
- [x] Checked (read-only). Result: the only "pages build and deployment" run (b9b6ad7) was CANCELLED by GitHub after 15 min
      with no runner picking it up; deploy skipped; live address returns 404. Not re-run (needs a GitHub login).
      Plan: add an empty `.nojekyll` file (Pages then copies files instead of running Jekyll) and let the end-of-run push trigger a new build.
      If that build also sticks, Adam re-runs it from the Actions tab.

## Phase 2: build
- [x] A. Foundations: save v2 + MIGRATIONS, TUNING / STICKER_RULES, SHARE_URL, net.js adapter (supabase / claude / local), boot.js,
      update toast (sw.js no longer skips waiting; tools/bump-sw.js sets VERSION), mergeSaves + pull-merge-push sync, tests
- [ ] A (leftover): hide Google button on iOS standalone, toast.act CSS, README data model
- [x] F. Question bank: data expansion BLOCKED (no build process or source list in repo). Fixed instead: club-scoped
      Odd One Out and The Link adapt their fame bar per club, so all 60 original picker clubs build 5+ question types with no padding.
      Added 19 former Premier League clubs to the picker (CLUBS_PICK). QV bumped v2 -> v3. COVERAGE.md regenerated.
- [ ] F (leftover): DATA_SOURCES.md, spot-check of thin-club facts against a second source
- [ ] B. Spoiler-free share card
- [ ] C. Season stakes (points needed, Final Day, around-you lines, season end, training XP diminishing)
- [ ] E. Club Wars top-10 tally (function in supabase/002_additions.sql, client fallback)
- [ ] G. Question log (insert-only table, aggregate function, hidden console function)
- [ ] H. Theme of the day
- [ ] D. Stickers
- [ ] J. PWA hardening, delete account, privacy note, haptics, accessibility, desktop treatments

## Phase 3: QA
- [ ] Determinism test, migration test, two-device merge test, sticker pacing sim, browser passes, service worker tests

## Phase 4: connect, push, hand over
- [ ] SUPABASE_URL / SUPABASE_ANON_KEY were blank in the brief: config.js not filled in
- [ ] Push once at the end (nothing pushed in run 1)
- [ ] Docs: README, DECISIONS, BLOCKED, DATA_SOURCES, CHANGELOG, HANDOVER, TESTING-CHECKLIST

## Findings so far (move into DECISIONS.md / BLOCKED.md)
- No build process for data.js exists in the repo (tools/ only has make-icons.js; CLAUDE.md names no sources beyond
  "Fantasy Premier League data" for 2022-23 onwards). Expanding data.js from "the same sources" is therefore blocked unless
  Adam can supply the original build scripts or source list.
- Coverage (COVERAGE.md): line-ups exist for only 8 clubs (Arsenal, Chelsea, Liverpool, Man City, Man United, Everton, Aston Villa,
  plus none for Tottenham/Newcastle). Final tables hold only each season's top four plus relegated sides.
  Ipswich, Luton, Hull and Sheffield United can build only 3 of 11 question types at lower tiers, so every one of their
  Club Cup ties pads out with repeated Grid questions (40 of 40 sampled). Fixable without new data by loosening the
  club-scoped Odd One Out and The Link generators for small clubs (generator change: bump QV).
- Current top-flight clubs missing from the club picker still need listing (the query was mid-flight when the run stopped).
- Service worker currently calls skipWaiting() on install, so a "waiting" worker never exists; the update toast needs that changed.
- push.bat is untracked in the project folder: left alone, never staged.
