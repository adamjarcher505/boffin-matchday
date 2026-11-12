# Getting Boffin Matchday live

The game already works offline and installs as an app. These steps put it on the internet, switch on sign-in, and make you the Founder. Budget about 30 minutes. Everything here is free.

You'll set up two free accounts:
- **GitHub**: hosts the game at a web address and backs up the code.
- **Supabase**: handles sign-in and stores everyone's progress and the shared league tables.

---

## 1. Put the game online (GitHub Pages)

1. Make a free account at github.com.
2. Click **New repository**. Name it `boffin-matchday` and make it **Public** (free Pages hosting needs that). Don't tick any of the "add a README" boxes.
3. In a terminal in this folder, run the two commands GitHub shows under "push an existing repository", e.g.:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/boffin-matchday.git
   git push -u origin main
   ```
   A browser window pops up the first time to log you in to GitHub.
4. On the repo page: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**.
5. After a minute or two the game is live at `https://YOUR-USERNAME.github.io/boffin-matchday/`.

From now on, every `git push` updates the live game.

## 2. Switch on sign-in (Supabase)

1. Make a free account at supabase.com. Click **New project**, pick the **London** region and set a database password (store it in your password manager; the game doesn't need it).
2. When the project is ready, open **SQL Editor**, paste in all of `supabase/schema.sql` and click **Run**. It should say "Success".
   Then do the same with `supabase/002_additions.sql` (fair Club Wars, the question log, Delete account). The game works without it, but those three stay switched off.
3. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-USERNAME.github.io/boffin-matchday/`
   - Redirect URLs: add the same address, plus `http://localhost:8080/` for testing at home.
4. **Authentication → Emails → Templates.** In both the **Magic Link** and **Confirm signup** templates, add this line somewhere in the message body:
   ```
   <p>Your code: <b>{{ .Token }}</b></p>
   ```
   This matters on iPhone: a login link opens Safari rather than the installed app, so players type the 6-digit code into the app instead.
5. **Project Settings → API.** Copy the **Project URL** and the **anon public** key into `config.js`:
   ```js
   supabaseUrl: "https://xxxx.supabase.co",
   supabaseKey: "eyJ...",
   shareUrl: "https://YOUR-USERNAME.github.io/boffin-matchday/"
   ```
   The anon key is safe to publish. The database rules stop anyone touching data that isn't theirs.
6. Run `node tools/bump-sw.js` so phones pick up the new config. Then commit and push.

## 3. Become the Founder

Do this **before sharing the link**, so you're also member number 1.

1. Open the live game, tap your name (top right) and sign in with your email.
2. In Supabase, open **SQL Editor** and paste in `supabase/make-founder.sql`. Put your email between the quotes, then click **Run**. It should say "1 row affected".
3. Reload the game. You'll see the gold ★ FOUNDER badge, the Founder card (in your profile and at the top of your album) and the gold Founder's kit across the whole app. The kit can be switched off in your profile.

The next 99 people to sign up get a silver **Founding Member No. 0xx** badge and card automatically. Badges show next to names in the shared league tables. Nobody can give themselves one: the database blocks it.

## 4. Google sign-in (optional, do it later if you like)

1. Go to console.cloud.google.com and create a project. Open **APIs & Services → OAuth consent screen**, choose External and fill in the app name.
2. Open **Credentials → Create credentials → OAuth client ID** and choose **Web application**. Under **Authorised redirect URIs**, add `https://xxxx.supabase.co/auth/v1/callback` (your Supabase project URL plus that path).
3. Copy the Client ID and Secret into Supabase: **Authentication → Providers → Google**, then switch it on.
4. In `config.js`, set `google: true`, run `node tools/bump-sw.js`, then commit and push. (The Google button stays hidden inside an installed iPhone app, where its redirect would land in Safari; the email code works there.)

## 5. Install it

- **iPhone:** open the link in Safari, tap **Share → Add to Home Screen**.
- **Android:** open it in Chrome, then tap **⋮ → Install app**.
- **PC:** in Chrome or Edge, click the install icon at the right of the address bar. The PC gets the desktop version: dashboard, Stats tab, full match review and the Extra Time modes.

Once opened, it works with no signal. Progress saves on the device and syncs to your account when you're back online.

## Good to know

- **Shipping an update:** change the files, run `node tools/bump-sw.js` (it sets the version and checks every file is cached), run the tests (README.md), then commit and push. Players see "New version ready, tap to refresh".
- **Supabase free tier** pauses a project after a week with no visits. One click in the dashboard wakes it up. Real players visiting keep it awake.
- **Login emails:** Supabase's built-in sender only allows a few emails an hour. That's fine for you and some mates. If lots of people join, connect a free email service: sign up at resend.com (free tier), verify a sending domain or use their test domain, create an API key, then in Supabase go to **Authentication → Emails → SMTP settings** → enable custom SMTP → host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender = an address on your verified domain. The game already tells players to wait a minute if they hit the limit.
- **Previewing badges locally:** `http://localhost:8080/?preview=founder` or `?preview=member`. This only works on localhost.
