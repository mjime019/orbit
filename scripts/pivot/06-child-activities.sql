-- ============================================================================
-- PIVOT — child_activities: per-kid sports, classes & pursuits
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

create table if not exists child_activities (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  name          text not null,
  category      text not null default 'other'
                  check (category in ('sport','music','art','stem','other')),
  schedule_note text,
  status        text not null default 'active'
                  check (status in ('active','paused','past')),
  started_on    date,
  notes         text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

alter table child_activities enable row level security;
do $$ begin
  create policy "family_all" on child_activities
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Verification:
-- select count(*) from child_activities;                       -- 0 (new)
-- select policyname from pg_policies
--   where tablename = 'child_activities';                      -- family_all
