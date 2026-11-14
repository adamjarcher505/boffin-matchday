-- Boffin Matchday: swaps with mates (14/11/2026, locked down the same evening). Run after schema.sql. Safe to run again.
-- A swap: you offer one of your doubles by link. A signed-in mate opens it, takes your sticker and gives one of their
-- doubles back. The SERVER does the moving: it checks each side really has the double in their saved album, then
-- writes the change into both saves itself. Nobody can offer a sticker their save doesn't hold, offer the same double
-- twice, or take a swap without giving a real double back.
--
-- How counts work in a save: stk.got (earned), stk.recv (came in by swap), stk.gone (went out by swap). You hold
-- got + recv - gone. All three only ever go up, so a phone and a laptop merging their saves can't undo a swap.
create table if not exists public.swaps (
  code   text primary key check (code ~ '^[a-z0-9]{10}$'),
  owner  uuid not null references auth.users(id) on delete cascade,
  give   text not null check (char_length(give) between 3 and 80),
  taker  uuid references auth.users(id) on delete set null,
  back   text check (back is null or char_length(back) between 3 and 80),
  made   timestamptz not null default now(),
  taken  timestamptz,
  done   boolean not null default false
);
create index if not exists swaps_owner on public.swaps(owner) where not done;
alter table public.swaps enable row level security;
revoke all on public.swaps from anon, authenticated;

-- how many of a sticker someone's saved album holds
create or replace function public.stk_have(p_uid uuid, p_key text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((j->'stk'->'got'->>p_key)::int, 0)
       + coalesce((j->'stk'->'recv'->>p_key)::int, 0)
       - coalesce((j->'stk'->'gone'->>p_key)::int, 0)
  from (select json::jsonb as j from saves where id = p_uid) s;
$$;

-- add one to stk.<field>.<key> in someone's save, and stamp it so their devices pull the change
create or replace function public.stk_bump(p_uid uuid, p_field text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if p_field not in ('recv', 'gone') then raise exception 'bad field'; end if;
  select json::jsonb into j from saves where id = p_uid for update;
  if j is null then raise exception 'no save'; end if;
  if j->'stk' is null then j := jsonb_set(j, '{stk}', '{}'::jsonb); end if;
  if j->'stk'->p_field is null then j := jsonb_set(j, array['stk', p_field], '{}'::jsonb); end if;
  j := jsonb_set(j, array['stk', p_field, p_key], to_jsonb(coalesce((j->'stk'->p_field->>p_key)::int, 0) + 1));
  update saves set json = j::text, t = greatest(coalesce(t, 0) + 1, (extract(epoch from clock_timestamp()) * 1000)::bigint) where id = p_uid;
end $$;
revoke execute on function public.stk_have(uuid, text), public.stk_bump(uuid, text, text) from public, anon, authenticated;

-- offer a double. At most 5 open offers each. The double leaves your save straight away (so it can't go twice).
create or replace function public.swap_offer(p_code text, p_give text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  perform 1 from saves where id = auth.uid() for update;
  if coalesce(stk_have(auth.uid(), p_give), 0) < 2 then return false; end if;
  if (select count(*) from swaps where owner = auth.uid() and not done) >= 5 then return false; end if;
  insert into swaps(code, owner, give) values (p_code, auth.uid(), p_give);
  perform stk_bump(auth.uid(), 'gone', p_give);
  return true;
end $$;

-- what's on offer behind a link (anyone signed in)
create or replace function public.swap_peek(p_code text) returns table(give text, open boolean, mine boolean)
language sql security definer set search_path = public as $$
  select s.give, (s.taker is null and s.made > now() - interval '14 days'), s.owner = auth.uid()
  from swaps s where s.code = p_code;
$$;

-- take it and give a double back. Both saves are changed here, together. Returns the sticker you got, or null.
create or replace function public.swap_take(p_code text, p_back text) returns text
language plpgsql security definer set search_path = public as $$
declare g text; o uuid;
begin
  if auth.uid() is null or p_back is null then return null; end if;
  perform 1 from saves where id = auth.uid() for update;
  if coalesce(stk_have(auth.uid(), p_back), 0) < 2 then return null; end if;
  update swaps set taker = auth.uid(), back = p_back, taken = now()
   where code = p_code and taker is null and owner <> auth.uid() and made > now() - interval '14 days'
   returning give, owner into g, o;
  if g is null then return null; end if;
  perform stk_bump(auth.uid(), 'gone', p_back);
  perform stk_bump(auth.uid(), 'recv', g);
  perform stk_bump(o, 'recv', p_back);
  return g;
end $$;

-- the owner's list of finished swaps (the sticker is already in their save; this is for the "swap done" message)
create or replace function public.swap_collect() returns table(code text, back text)
language sql security definer set search_path = public as $$
  update swaps set done = true where owner = auth.uid() and taker is not null and not done
  returning code, back;
$$;

-- the owner withdraws an offer nobody has taken; the double goes back into their save
create or replace function public.swap_cancel(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  delete from swaps where code = p_code and owner = auth.uid() and taker is null returning give into g;
  if g is null then return false; end if;
  perform stk_bump(auth.uid(), 'recv', g);
  return true;
end $$;

grant execute on function public.swap_offer(text, text), public.swap_peek(text), public.swap_take(text, text),
  public.swap_collect(), public.swap_cancel(text) to authenticated;
revoke execute on function public.swap_offer(text, text), public.swap_peek(text), public.swap_take(text, text),
  public.swap_collect(), public.swap_cancel(text) from public, anon;
