-- Boffin Matchday database. Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to run again: it only creates what's missing and replaces the rules.

-- League rows: one per player, readable by everyone (that's what fills the shared tables).
create table if not exists public.players (
  id  uuid primary key references auth.users (id) on delete cascade,
  n   text,                 -- name on the teamsheet
  c   text,                 -- club
  d   int  default 0,       -- division
  s   int  default 1,       -- season
  w   int,                  -- week number (Club Wars)
  cg  int  default 0,       -- Club Wars goals this week
  cp  int  default 0,       -- Club Wars points this week
  p   int  default 0,  pl int default 0, wn int default 0, dr int default 0, ls int default 0, gf int default 0, ga int default 0,
  xp  int  default 0,
  g   jsonb default '{}'::jsonb,   -- recent match results (opponents replay them as "ghosts")
  cu  int  default 0,       -- cups won
  t   bigint default 0,     -- last update, ms
  f   boolean not null default false,  -- Founder (set by hand, see make-founder.sql)
  m   int                              -- member number in sign-up order; 2–100 are Founding Members
);

-- Full save files: private, each player can only see and write their own.
create table if not exists public.saves (
  id   uuid primary key references auth.users (id) on delete cascade,
  json text,
  t    bigint
);

create sequence if not exists public.member_no;

alter table public.players enable row level security;
alter table public.saves   enable row level security;

drop policy if exists "league is public"   on public.players;
drop policy if exists "update own row"     on public.players;
drop policy if exists "read own save"      on public.saves;
drop policy if exists "insert own save"    on public.saves;
drop policy if exists "update own save"    on public.saves;
create policy "league is public" on public.players for select using (true);
create policy "update own row"   on public.players for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "read own save"    on public.saves for select to authenticated using (auth.uid() = id);
create policy "insert own save"  on public.saves for insert to authenticated with check (auth.uid() = id);
create policy "update own save"  on public.saves for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Every new sign-up gets a league row and the next member number.
create or replace function public.boffin_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, m) values (new.id, nextval('public.member_no')) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists boffin_signup on auth.users;
create trigger boffin_signup after insert on auth.users for each row execute function public.boffin_on_signup();

-- Players can't award themselves badges or change their member number. (You still can, from this SQL editor.)
create or replace function public.boffin_lock_badges() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then new.f := old.f; new.m := old.m; new.id := old.id; end if;
  return new;
end $$;
drop trigger if exists boffin_lock_badges on public.players;
create trigger boffin_lock_badges before update on public.players for each row execute function public.boffin_lock_badges();

-- Anyone who signed up before this script ran gets a row too, in sign-up order.
insert into public.players (id, m)
select u.id, nextval('public.member_no') from auth.users u
where not exists (select 1 from public.players p where p.id = u.id)
order by u.created_at;
