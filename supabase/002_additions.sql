-- Boffin Matchday, database additions (12/11/2026). Run AFTER schema.sql: Supabase → SQL Editor → paste all → Run.
-- Additive and safe to run again. The game works without this file; these features switch on once it's run:
--   * Club Wars scored fairly from each club's top 10 fans (club_wars)
--   * the anonymous question log, for fairer difficulty later (question_log, question_stats)
--   * "Delete my account" in the profile (delete_my_account)

-- ---------------------------------------------------------------------------------------------
-- Club Wars: a club's score is the sum of its top 10 fans' goals this week (the game divides by 10).
-- One small query instead of every client downloading every player row.
create or replace function public.club_wars(wk int)
returns table (c text, gf int, fans int, filled int, cut int)
language sql stable security definer set search_path = public as $$
  with r as (
    select p.c, coalesce(p.cg, 0) as g,
           row_number() over (partition by p.c order by coalesce(p.cg, 0) desc, p.t desc) as rn,
           count(*) over (partition by p.c) as n
    from public.players p
    where p.w = wk and p.c is not null and p.n is not null and p.n <> ''
  )
  select r.c,
         coalesce(sum(r.g) filter (where r.rn <= 10), 0)::int as gf,
         max(r.n)::int as fans,
         least(max(r.n), 10)::int as filled,
         coalesce(max(r.g) filter (where r.rn = 10), 0)::int as cut
  from r group by r.c
  order by gf desc
  limit 200;
$$;
revoke all on function public.club_wars(int) from public;
grant execute on function public.club_wars(int) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Question log: one row per finished match, no user id or anything else that identifies a player.
-- q = up to 10 chances, each [question key, tier, question type, scored 0/1, seconds taken].
-- Clients can add rows but never read them back; numbers only come out through question_stats, in aggregate.
create table if not exists public.question_log (
  id  bigint generated always as identity primary key,
  at  timestamptz not null default now(),
  v   text not null check (char_length(v) between 1 and 12),
  d   smallint not null check (d between 0 and 7),
  q   jsonb not null check (jsonb_typeof(q) = 'array' and jsonb_array_length(q) between 1 and 10 and pg_column_size(q) <= 4000)
);
alter table public.question_log enable row level security;
drop policy if exists "anyone can add a match log" on public.question_log;
create policy "anyone can add a match log" on public.question_log for insert to anon, authenticated with check (true);
revoke select, update, delete on public.question_log from anon, authenticated;

-- Aggregates only, and only for groups with at least min_n answers (never fewer than 10).
create or replace function public.question_stats(min_n int default 30)
returns table (kind text, key text, d int, n int, ok int)
language sql stable security definer set search_path = public as $$
  with x as (
    select l.d as div, e->>0 as qk, (e->>1)::int as tier, e->>2 as typ, (e->>3)::int as okv
    from public.question_log l, jsonb_array_elements(l.q) e
    where jsonb_typeof(e) = 'array' and (e->>1) ~ '^[0-9]$' and (e->>3) in ('0', '1') and char_length(coalesce(e->>0, '')) <= 80
  )
  select 'type'::text, typ, div::int, count(*)::int, sum(okv)::int from x group by typ, div having count(*) >= greatest(min_n, 10)
  union all
  select 'q'::text, qk, tier, count(*)::int, sum(okv)::int from x group by qk, tier having count(*) >= greatest(min_n, 10);
$$;
revoke all on function public.question_stats(int) from public;
grant execute on function public.question_stats(int) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Delete my account: removes the player's save, league row and sign-in. Only ever their own (auth.uid()).
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.saves   where id = uid;
  delete from public.players where id = uid;
  delete from auth.users     where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
