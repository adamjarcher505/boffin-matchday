-- Boffin Matchday: "Report this question" (run after 002_additions.sql; safe to run twice).
-- One anonymous row per report: the question id, the bank version and the question's source ids. No user id.
-- Clients can add rows but never read them; Adam reads them in the Supabase dashboard (Table editor > question_reports).
create table if not exists public.question_reports (
  id   bigint generated always as identity primary key,
  at   timestamptz not null default now(),
  q    text not null check (char_length(q) between 1 and 16),
  bank text not null check (char_length(bank) between 1 and 12),
  src  jsonb not null default '[]'::jsonb check (jsonb_typeof(src) = 'array' and pg_column_size(src) <= 1000),
  d    smallint not null default 0 check (d between 0 and 7)
);
alter table public.question_reports enable row level security;
drop policy if exists "anyone can report a question" on public.question_reports;
create policy "anyone can report a question" on public.question_reports for insert to anon, authenticated with check (true);
revoke select, update, delete on public.question_reports from anon, authenticated;
