-- ============================================================================
-- Orbit overhaul schema changes — July 2026
-- Run ONCE in the Supabase SQL editor (idempotent: safe to re-run).
-- Covers: observations.source, captures table, child_summaries cache,
-- and seed rows for the camp fold-in (Carla, Summer Camp, Felipe, Rafael).
--
-- UUID choices verified against seed-data.sql to avoid collisions:
--   profiles 101/102 taken (Elena, Lisa)      -> Carla = ...103
--   classrooms 010 taken (Sunshine Room)      -> Summer Camp = ...011
--   children 1001-1008 taken (Johnny + peers) -> Felipe = ...1101, Rafael = ...1102
--
-- PRIVACY: this file is committed to a PUBLIC repo. Felipe/Rafael birthdates
-- below are deliberate placeholders that only yield the correct ages (3, 4).
-- ============================================================================

-- 1. Observation provenance ---------------------------------------------------
alter table observations
  add column if not exists source text not null default 'teacher'
  check (source in ('teacher','parent'));
-- Naming debt (do not rename this round): parent-recorded rows store the
-- parent's profile id in observations.teacher_id.

-- 2. captures — words-first landing zone (generalizes camp_observations) ------
create table if not exists captures (
  id                  uuid primary key default gen_random_uuid(),
  author_profile_id   uuid references profiles(id) on delete set null,
  child_ids           uuid[] not null default '{}',
  transcript          text not null,
  followup_transcript text,
  structured          jsonb,
  status              text not null default 'draft'
                        check (status in ('draft','processed','confirmed')),
  created_at          timestamptz not null default now()
);

alter table captures enable row level security;
do $$ begin
  create policy "captures_anon_insert" on captures for insert to anon with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "captures_anon_select" on captures for select to anon using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "captures_anon_update" on captures for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
-- Deliberately NO delete policy: a teacher's or parent's words are never
-- destroyed from the app (same stance as camp_observations).

-- 3. child_summaries — cache for the home page "What this means" card ---------
create table if not exists child_summaries (
  child_id              uuid primary key references children(id) on delete cascade,
  content               text not null,
  observation_count     int not null default 0,
  latest_observation_at timestamptz,
  generated_at          timestamptz not null default now()
);

alter table child_summaries enable row level security;
do $$ begin
  create policy "child_summaries_anon_all" on child_summaries
    for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 3b. parent_children was never read by the app before the child switcher,
-- so it has no anon SELECT policy (its original policies key on auth.uid()).
-- Without this, getParentChildren() returns zero rows through the anon key
-- and the header switcher stays hidden.
do $$ begin
  create policy "parent_children_anon_select" on parent_children
    for select to anon using (true);
exception when duplicate_object then null; end $$;

-- 4. Seed: camp fold-in --------------------------------------------------------
insert into profiles (id, email, name, role, school_id) values (
  '00000000-0000-0000-0000-000000000103',
  'carla@littleexplorers.com',
  'Carla',
  'teacher',
  '00000000-0000-0000-0000-000000000001'
) on conflict (id) do nothing;

insert into classrooms (id, school_id, name, lesson_theme) values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Summer Camp',
  'Summer exploration'
) on conflict (id) do nothing;

insert into children (id, name, date_of_birth, classroom_id, school_id) values
  ('00000000-0000-0000-0000-000000001101', 'Felipe', '2023-01-01',
   '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000001102', 'Rafael', '2022-01-01',
   '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into child_profiles (child_id)
select c.id from (values
  ('00000000-0000-0000-0000-000000001101'::uuid),
  ('00000000-0000-0000-0000-000000001102'::uuid)
) as c(id)
where not exists (select 1 from child_profiles cp where cp.child_id = c.id);

insert into parent_children (parent_id, child_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000001101'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000001102'),
  -- ensure Johnny's link exists too (no-op if seeded already)
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000001001')
on conflict (parent_id, child_id) do nothing;

-- 5. Verification (run these after; expected values in comments) ---------------
-- select count(*) from profiles where id = '00000000-0000-0000-0000-000000000103';    -- 1
-- select count(*) from children where id in
--   ('00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000001102');  -- 2
-- select count(*) from parent_children
--   where parent_id = '00000000-0000-0000-0000-000000000201';                          -- 3
-- select column_name from information_schema.columns
--   where table_name = 'observations' and column_name = 'source';                      -- 1 row
-- select count(*) from captures;                                                       -- 0 (new)
-- select count(*) from child_summaries;                                                -- 0 (new)
