# Device testing checklist

Tests that need real phones, real email or the live Supabase project. Tick them off once the site is live and connected (HANDOVER.md steps 1–4).

## Sign-in
- [ ] **Desktop Chrome**: email code works. Magic link from the email works. Google works, if switched on.
- [ ] **Android Chrome** (and installed to the home screen): email code works. Magic link works in the browser.
- [ ] **iPhone home-screen app**: there's no Google button; the email code signs you in inside the app.
- [ ] Sign out, then sign back in: progress is still there.

## Saves
- [ ] **Two devices**: play a match on phone A, open phone B signed in to the same account: same level, division and Names.
- [ ] **Both offline**: put both phones in airplane mode, play a match on each, turn signal back on, open both. Neither loses its Names or stickers; the league comes from whichever played last.
- [ ] **Different account, same phone**: sign out, sign in as someone else: they start fresh and don't get your progress.
- [ ] **Airplane-mode match**: install the app, airplane mode on, open it from the home screen, play a full match, signal back on. Progress syncs and the match appears in the shared table.
- [ ] **Update toast**: after a deploy (VERSION changed), opening the app shows "New version ready, tap to refresh" and tapping it reloads into the new version.

## Badges
- [ ] Your ★ FOUNDER badge shows next to your name in a mate's league table (once they're in your division).
- [ ] The second person to sign up gets **FOUNDING MEMBER NO. 002**.
- [ ] A mate can't give themselves a badge (they'd need your SQL editor).

## Features that need 002_additions.sql
- [ ] Club Wars shows real fans per club and "x of 10 places filled".
- [ ] **Delete account**: Profile → Delete account → confirm. The account's gone from Supabase (Authentication → Users), the row is gone from `players`, and signing in again with that email starts a brand-new account with a new member number.
- [ ] In the browser console on the live site, `boffinStats()` runs (it says "not enough shared samples" until there's data).

## Database rules (read-only checks, anon key only)
Run in the browser console on the live site while signed out:
```js
const sb = window.supabase.createClient(BOFFIN_CONFIG.supabaseUrl, BOFFIN_CONFIG.supabaseKey);
(await sb.from("saves").select("*").limit(5)).data           // expect []  (no one's saves visible)
(await sb.from("question_log").select("*").limit(5)).error   // expect an error (log can't be read)
(await sb.from("players").select("id,n,c,d,f,m").limit(5)).data  // expect league rows (these are public by design)
```

## Phones
- [ ] No question screen scrolls with the keyboard open (try The Grid, Top Ten, Squad Sheet and a sticker attempt).
- [ ] Haptics: a goal buzzes, a miss buzzes, a sticker landing buzzes (Android; iPhone browsers don't support vibration). The "Buzz" toggle turns it off.
