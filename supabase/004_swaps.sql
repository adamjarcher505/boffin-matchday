-- Boffin Matchday: swaps with mates (14/11/2026). Run after schema.sql. Safe to run twice.
-- A swap: you offer one of your doubles by link. A signed-in mate opens it, takes your sticker and gives one of their
-- doubles back. Your app collects it next time you look. Nothing in this table is readable directly: only these
-- functions touch it, and only for the signed-in user.
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

-- offer a double. At most 5 open offers each.
create or replace function public.swap_offer(p_code text, p_give text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if (select count(*) from swaps where owner = auth.uid() and not done) >= 5 then return false; end if;
  insert into swaps(code, owner, give) values (p_code, auth.uid(), p_give);
  return true;
end $$;

-- what's on offer behind a link (anyone signed in)
create or replace function public.swap_peek(p_code text) returns table(give text, open boolean, mine boolean)
language sql security definer set search_path = public as $$
  select s.give, (s.taker is null and s.made > now() - interval '14 days'), s.owner = auth.uid()
  from swaps s where s.code = p_code;
$$;

-- take it and give one back. Returns the sticker you got, or null if it's gone.
create or replace function public.swap_take(p_code text, p_back text) returns text
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if auth.uid() is null or p_back is null then return null; end if;
  update swaps set taker = auth.uid(), back = p_back, taken = now()
   where code = p_code and taker is null and owner <> auth.uid() and made > now() - interval '14 days'
   returning give into g;
  return g;
end $$;

-- the owner picks up whatever came back
create or replace function public.swap_collect() returns table(code text, back text)
language sql security definer set search_path = public as $$
  update swaps set done = true where owner = auth.uid() and taker is not null and not done
  returning code, back;
$$;

-- the owner withdraws an offer nobody has taken
create or replace function public.swap_cancel(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from swaps where code = p_code and owner = auth.uid() and taker is null;
  return found;
end $$;

grant execute on function public.swap_offer(text, text), public.swap_peek(text), public.swap_take(text, text),
  public.swap_collect(), public.swap_cancel(text) to authenticated;
revoke execute on function public.swap_offer(text, text), public.swap_peek(text), public.swap_take(text, text),
  public.swap_collect(), public.swap_cancel(text) from anon;
