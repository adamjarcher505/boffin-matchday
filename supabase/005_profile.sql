-- Boffin Matchday: public profile numbers (run fifth, after 004_swaps.sql). Safe to run more than once.
-- Adds `pr` to each player's league row: the stats other players see on your card and in head to head
-- (matches, wins, goals, deep cuts, scoring rate by question type, names, stickers, best division, streaks).
-- Nothing private: no email, no save. The game works without it; profiles just show less until it's run.

alter table public.players add column if not exists pr jsonb default '{}'::jsonb;

-- keep it small so nobody can stuff the public table (a real one is well under 1 KB)
do $$ begin
  alter table public.players add constraint players_pr_small check (pg_column_size(pr) < 4096);
exception when duplicate_object then null;
end $$;

-- tell the API about the new column straight away
notify pgrst, 'reload schema';
