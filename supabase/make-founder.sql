-- Run this ONCE, after you've signed in to the game for the first time.
-- Put your own sign-in email between the quotes, then Supabase → SQL Editor → Run.
-- It should say "1 row affected". Reopen the game and the Founder badge, card and kit appear.

update public.players
set f = true
where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
