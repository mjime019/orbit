-- ============================================================================
-- ROUND 3 — one batch: re-seed tracking, report ingestion columns,
-- planner_ideas, children hygiene.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- All app code tolerates these columns/tables being absent, so deploy
-- order doesn't matter — but run this before using reports ingestion,
-- planners, or the re-seed nudge.
-- ============================================================================

-- Re-seed tracking: when the file was last seeded/refreshed.
alter table child_profiles add column if not exists last_seeded_at timestamptz;
-- Backfill: files seeded before the stamp existed start their 6-month
-- clock now instead of immediately showing the refresh nudge.
update child_profiles set last_seeded_at = now()
  where onboarding_complete = true and last_seeded_at is null;

-- Reports: structured dates + AI ingestion results.
alter table reports add column if not exists report_date    date;
alter table reports add column if not exists period_start   date;
alter table reports add column if not exists period_end     date;
alter table reports add column if not exists ai_summary     text;
alter table reports add column if not exists ai_extracted   jsonb;
alter table reports add column if not exists ai_processed_at timestamptz;

-- Planner ideas: one table for all three engines.
-- child_id null = family-wide (weekend plans for the whole crew).
create table if not exists planner_ideas (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null
               check (kind in ('activity','weekend','extracurricular')),
  child_id   uuid references children(id) on delete cascade,
  title      text not null,
  payload    jsonb not null default '{}',
  status     text not null default 'suggested'
               check (status in ('suggested','saved','done','dismissed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table planner_ideas enable row level security;
do $$ begin
  create policy "family_all" on planner_ideas
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Children hygiene: the pivot never detached the boys from the demo
-- school/classroom, so chat context still said "Summer Camp" etc.
-- Their observations keep their own classroom refs — this only touches
-- the children rows.
update children set classroom_id = null, school_id = null
  where id in (
    '00000000-0000-0000-0000-000000001101',
    '00000000-0000-0000-0000-000000001102'
  );

-- Verification:
-- select column_name from information_schema.columns
--   where table_name = 'reports' and column_name like 'ai_%';   -- 3 rows
-- select policyname from pg_policies
--   where tablename = 'planner_ideas';                          -- family_all
-- select name, school_id, classroom_id from children
--   where school_id is not null;                                -- demo kids only
