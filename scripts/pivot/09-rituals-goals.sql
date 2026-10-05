-- ============================================================================
-- ROUND 5 — Rituals (responsibilities a kid owns) + long-term Goals.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- App code tolerates these tables being absent (the tabs show a "run the
-- SQL" note), so deploy order doesn't matter.
-- ============================================================================

-- Rituals: small real responsibilities, suggested as a kid grows.
-- suggested → active (he's learning it) → mastered (it's his).
create table if not exists kid_rituals (
  id                   uuid primary key default gen_random_uuid(),
  child_id             uuid not null references children(id) on delete cascade,
  title                text not null,
  area                 text not null default 'home'
                         check (area in ('self_care','home','belongings','family','choices')),
  why_now              text,
  how_to_start         text,
  cadence              text,
  looks_like_owning_it text,
  status               text not null default 'suggested'
                         check (status in ('suggested','active','mastered','dismissed')),
  source               text not null default 'ai' check (source in ('ai','parent')),
  started_on           date,
  mastered_on          date,
  created_by           uuid references profiles(id),
  created_at           timestamptz not null default now()
);
create index if not exists kid_rituals_child_idx on kid_rituals (child_id, status);

-- Long-term goals the parents hold for a kid, and the steps toward them.
create table if not exists kid_goals (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children(id) on delete cascade,
  title       text not null,
  why         text,
  horizon     text,
  approach    text,
  status      text not null default 'active'
                check (status in ('active','achieved','paused')),
  checkin     jsonb,
  checkin_at  timestamptz,
  achieved_on date,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists kid_goals_child_idx on kid_goals (child_id, status);

-- Steps: routines (recurring), activities (one-off), signs (things you'd
-- notice that say it's taking root — observed, never scored).
create table if not exists goal_steps (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references kid_goals(id) on delete cascade,
  kind       text not null check (kind in ('routine','activity','sign')),
  title      text not null,
  detail     text,
  cadence    text,
  status     text not null default 'suggested'
               check (status in ('suggested','active','done','dismissed')),
  source     text not null default 'ai' check (source in ('ai','parent')),
  done_on    date,
  created_at timestamptz not null default now()
);
create index if not exists goal_steps_goal_idx on goal_steps (goal_id, status);

alter table kid_rituals enable row level security;
alter table kid_goals   enable row level security;
alter table goal_steps  enable row level security;

do $$ begin
  create policy "family_all" on kid_rituals
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "family_all" on kid_goals
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "family_all" on goal_steps
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Verification:
-- select tablename, policyname from pg_policies
--   where tablename in ('kid_rituals','kid_goals','goal_steps');   -- 3 rows
