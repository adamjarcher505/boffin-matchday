# Progress (combined brief: finish, extend, go live)

Run 1 stopped early on 11/11/2026 (usage limit). Run 2 on 12/11/2026 finished the build. Everything below is done unless marked.

## Phase 0 and 1
- [x] Orient, v1 save fixture, test harness, COVERAGE.md
- [x] Pages check: the first build (11/11) was cancelled by GitHub after 15 min with no runner. Added `.nojekyll`; the final push triggers a new build.

## Phase 2
- [x] A. Foundations: save v2 + migrations, TUNING / STICKER_RULES, SHARE_URL, net.js adapter, boot.js, update toast, merge sync, iOS-app Google hiding
- [x] F. Question bank: new data BLOCKED (no build script or sources). Generator fixes for thin clubs, 19 clubs added to the picker, QV v3
- [x] B. Spoiler-free share cards (league, cup, grid, season end, stickers)
- [x] C. Season stakes, run-in / Final Day, around-you lines, season-end card, training XP cap, abandon reseeds
- [x] E. Club Wars top 10 ÷ 10 (club_wars function + client fallback)
- [x] G. Question log (insert-only table, question_stats, boffinStats()), phase 2 plan in README
- [x] H. Theme of the day (13 themes measured and kept, 5 dropped)
- [x] D. Stickers (79 frozen pages, offers tuned by simulation, attempt, swaps, tokens, chase list, page complete)
- [x] J. Delete account, privacy note, haptics, short-screen sheets, grid sheet overflow fix, desktop treatments

## Phase 3
- [x] Unit tests: determinism, migration, two-device merge, features, service worker list (all pass)
- [x] Sticker pacing simulation (tests/out/sticker-sim.txt)
- [x] In-browser no-scroll pass at 375x667, 390x844, 375x400; desktop check at 1280x800
- [ ] Playwright headless pass: not run (built-in browser used instead; see DECISIONS.md)

## Phase 4
- [ ] Supabase connect: skipped, URL and key were blank in the brief (HANDOVER.md)
- [x] Docs: README, DECISIONS, BLOCKED, DATA_SOURCES, CHANGELOG, HANDOVER, TESTING-CHECKLIST, SETUP, CLAUDE.md
- [ ] Push and check Pages: see the final commit log
