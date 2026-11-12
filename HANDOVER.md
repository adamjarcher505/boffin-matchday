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
5. **Authentication → Emails → Templates**: in **both** "Magic Link" and "Confirm signup", add this line to the message
   (keep everything else): `<p>Your code: <b>{{ .Token }}</b></p>`

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

## 8. Bigger question bank
Needs the scripts or sources that made `data.js`. If you have them from the old chat, hand them to Claude (BLOCKED.md).
