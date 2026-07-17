-- ============================================================================
-- PIVOT BATCH A — authenticated policies (ADDITIVE — run FIRST)
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Adds full access for logged-in users (the family) on every family table.
-- DOES NOT touch the existing anon policies — the live app keeps working
-- during the rollout. Batch B (02-batch-b-drop-anon.sql) removes anon access
-- ONLY after the auth deploy is verified.
--
-- BEFORE running: create the two auth users in the dashboard
-- (Authentication → Users → Add user): the founder and his wife,
-- email + password, "Auto Confirm User" checked.
-- ============================================================================

do $$
declare t text;
begin
  -- Every table the app touches — including the school/planner seed tables,
  -- which logged-in pages still read after anon access is dropped.
  foreach t in array array[
    'children', 'observations', 'highlights', 'child_profiles',
    'conversations', 'messages', 'captures', 'child_summaries',
    'parent_children', 'profiles', 'journey_chapters', 'onboarding_responses',
    'classrooms', 'schools', 'school_knowledge', 'school_calendar',
    'activities', 'activity_recommendations', 'weekend_places',
    'weekend_recommendations', 'extracurricular_providers', 'transition_schools',
    'digests', 'camp_observations'
  ]
  loop
    begin
      execute format(
        'create policy "family_all" on %I for all to authenticated using (true) with check (true)', t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Verification:
-- select tablename, policyname from pg_policies
--   where policyname = 'family_all' order by tablename;   -- expect 24 rows
