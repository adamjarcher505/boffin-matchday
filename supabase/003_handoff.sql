-- Boffin Matchday, iPhone sign-in hand-off (13/11/2026). Run AFTER 002_additions.sql: Supabase → SQL Editor → paste all → Run.
-- Additive and safe to run again.
--
-- Why: on an iPhone, a sign-in link in an email always opens in Safari, and Safari doesn't share its login with
-- the game installed on the home screen. So the installed game puts a long random id in the link it asks for.
-- Safari, once the link has signed it in, files the new session under that id (handoff_put) and forgets it
-- without signing out. The installed game collects it (handoff_take) and is then the only holder of the session.
-- Rows are taken once and expire after 15 minutes. Nobody can read the table directly.

create table if not exists public.handoffs (
  id   text primary key check (char_length(id) = 64),
  a    text not null,                       -- access token
  r    text not null,                       -- refresh token
  made timestamptz not null default now()
);
alter table public.handoffs enable row level security;   -- no policies: only the two functions below touch it
revoke all on public.handoffs from anon, authenticated;

-- Safari, signed in by the link, files its session under the id from the link
create or replace function public.handoff_put(p_id text, p_access text, p_refresh text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_id !~ '^[0-9a-f]{64}$' then raise exception 'bad id'; end if;
  delete from public.handoffs where made < now() - interval '15 minutes';
  insert into public.handoffs (id, a, r) values (p_id, p_access, p_refresh) on conflict (id) do nothing;
end $$;

-- the installed game collects it, once
create or replace function public.handoff_take(p_id text)
returns table (a text, r text) language plpgsql security definer set search_path = public as $$
begin
  return query
    with gone as (
      delete from public.handoffs h where h.id = p_id and h.made > now() - interval '15 minutes'
      returning h.a, h.r
    )
    select gone.a, gone.r from gone;
end $$;

revoke all on function public.handoff_put(text, text, text) from public;
revoke all on function public.handoff_take(text) from public;
grant execute on function public.handoff_put(text, text, text) to authenticated;
grant execute on function public.handoff_take(text) to anon, authenticated;
