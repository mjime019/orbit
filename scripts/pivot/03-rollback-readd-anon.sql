-- ============================================================================
-- EMERGENCY ROLLBACK — re-open anon access if Batch B breaks production.
-- Restores the pre-lockdown permissive anon posture on the tables the app
-- reads/writes. Run in the SQL editor, verify the app recovers, then
-- diagnose before attempting Batch B again.
-- ============================================================================

do $$
declare t text;
begin
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
        'create policy "anon_rollback_all" on %I for all to anon using (true) with check (true)', t
      );
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
