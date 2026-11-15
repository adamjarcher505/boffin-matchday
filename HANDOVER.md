# Handover: what Adam does next, in order

Everything in the code is done and tested on the computer. These steps need you: your logins, your phone, your email.

**Heads up:** there's a file called `push.bat` in the project folder that isn't part of the repo. It's been left alone. It's
yours to keep or delete.

## 1. Check the site is live (2 minutes)
Open https://adamjarcher505.github.io/boffin-matchday/.
- **The game loads:** go to step 2.
- **404:** the first Pages build on 11/11 got stuck and GitHub cancelled it. The latest push should have triggered a new one.
  Open the repo on GitHub → **Actions**. If the newest "pages build and deployment" run failed or is still queued after 10
  minutes, open it and click **Re-run all jobs**. Also check **Settings → Pages** still says: Deploy from a branch, `main`, `/ (root)`.

## 2. Create the Supabase project (10 minutes)
1. Sign in at supabase.com → **New project** → name `boffin-matchday`, region **London**. Set the database password
   yourself and keep it in your password manager. The game never needs it.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**. It should say "Success".
3. **SQL Editor** → paste all of `supabase/002_additions.sql` → **Run**. This switches on fair Club Wars, the question log
   and Delete account.
4. **Authentication → URL Configuration**:
   - Site URL: `https://adamjarcher505.github.io/boffin-matchday/`
   - Redirect URLs: add that same address, and `http://localhost:8080/`
5. **SQL Editor** → paste all of `supabase/003_handoff.sql` → **Run**. This lets the sign-in link (which opens Safari on an
   iPhone) pass the login back to the game on the home screen. Supabase no longer lets you edit the email templates
   without your own email server, so the 6-digit code isn't in the emails; the hand-off replaces it.
6. **Authentication → URL Configuration → Redirect URLs**: also add `https://adamjarcher505.github.io/boffin-matchday/**`
   (the hand-off link carries `?h=…`).

## 3. Connect the game (5 minutes)
1. Supabase → **Project Settings → API**: copy the **Project URL** and the **anon public** key. Never the service_role or secret key.
2. Put them in `config.js` (`supabaseUrl`, `supabaseKey`), and set `shareUrl` to `https://adamjarcher505.github.io/boffin-matchday/`. Leave `google: false`.
3. Run `node tools/bump-sw.js`, then commit and push (double-click `push.bat` if a login window is needed).
4. Or paste the two values into a Claude session and ask it to do step 3.

## 4. Become the Founder (2 minutes). Do this before sharing the link
1. Open the live game, tap your name (top right), sign in with your email and the 6-digit code. You'll be member number 1.
2. Supabase → **SQL Editor** → paste `supabase/make-founder.sql`, put your email between the quotes → **Run** → "1 row affected".
3. Reload the game: gold ★ FOUNDER badge, the Legend card and the Founder's kit.

## 5. Optional, before launch: look over the sticker pages
`STICKER-PAGES.md` lists all 79 pages. Ranking comes from the data's fame scores, which lean to the 2010s (Gerrard missed
Liverpool's page, for one). Before anyone has stickers you can hand-edit `sticker-pages.js` (swap a key for another
player's `Name|birth-year-code`), or ask Claude to. **After launch the pages are frozen.**

## 6. Test on real phones
Work through `TESTING-CHECKLIST.md`: sign-in on iPhone and Android, two-device sync, airplane mode, delete account, badges.

## 7. Later, if lots of people join
Supabase's built-in email sender allows only a few login emails an hour. Connect a free sender such as Resend under
**Authentication → Emails → SMTP settings** (SETUP.md has the steps).

## 8. Question bank (built 13/11/2026)
The Pub Quiz chance plays `questions.js` (8,320 questions, Premier League 1992/93 on + Arsenal deep dive), made by
`data-pipeline/` from open data. Three things to do:
1. **Supabase → SQL Editor:** run `supabase/003_question_reports.sql` so "Report" taps reach you (they're kept on the
   phone until then). Read them under Table editor → `question_reports`.
2. **GitHub → Settings → Actions → General → Workflow permissions:** tick "Allow GitHub Actions to create and approve
   pull requests". Then the weekly refresh (Tuesdays 06:00 UTC) opens a PR for you to read and merge. It never touches `main` itself.
3. **Glance at `data-pipeline/reports/review.json`** now and then: facts the sources disagree on. Nothing in it ships.

## 9. Overnight run (14/11/2026): nothing for you to set up
Everything from the overnight run is live and needs no Supabase or GitHub steps. Three things worth knowing:
1. **Your phone will show "New version ready, tap to refresh"** the first time you open it. Tap it.
2. **Ghost opponents reset.** The question generator changed (fairer questions for the lower divisions), so real
   players' recorded matches from before today aren't replayed. They build back up as people play.
3. **Try it with the sound on.** On an iPhone the ringer switch has to be on to hear it.

## 10. Sticker swaps: one SQL script (2 minutes). Run it again if you ran it before 14/11 evening
Swapping stickers with mates goes through your Supabase database, so it needs one more script. Until you run it,
the swap buttons just say swaps aren't available, and everything else works.
1. Supabase → **SQL Editor** → **New query**.
2. Paste the whole of `supabase/004_swaps.sql` and press **Run**. It's safe to run twice.
3. Test it: on your phone, tap a double in the album → swap → send the link to yourself, open it on another
   account. Both accounts have to be signed in.

Also worth a look: **STICKER-PAGES.md** lists every club's Gold Icons, Foils and Paper. The Gold Icons are the club
legends and double as the Legend editions. If you'd change any pick, tell Claude (or edit `tools/sticker-picks.json`
and run `node tools/rebuild-sticker-pages.js`, then bump `PAGES_V` in `src/stickers2.js`). The lower-league pages are
the weakest, because the data is thinnest there.

## 11. Full player profiles: one SQL script (1 minute)
Supabase → **SQL Editor** → **New query** → paste the whole of `supabase/005_profile.sql` → **Run**. Safe to run twice.
This lets players see each other's full stats (scoring rate, deep cuts, medals, specialist subject...) on their cards
and in head to head. Until it's run, cards and rankings still work but only show level, title, club, division and cups
for other people.
