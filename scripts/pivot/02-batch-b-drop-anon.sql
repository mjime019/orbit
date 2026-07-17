-- ============================================================================
-- PIVOT BATCH B — drop ALL anon access (THE LOCKDOWN — run LAST)
-- Run ONLY after: Batch A ran, the auth deploy is live, and both parents
-- have verified login + full app function in production.
--
-- After this, anyone without a logged-in session gets NOTHING from the
-- database. Emergency rollback: 03-rollback-readd-anon.sql.
-- ============================================================================

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and 'anon' = any(roles)
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    raise notice 'dropped % on %', r.policyname, r.tablename;
  end loop;
end $$;

-- Verification (run after):
-- select count(*) from pg_policies
--   where schemaname='public' and 'anon' = any(roles);      -- expect 0
-- Then from a terminal WITHOUT a session:
--   curl -s "$SUPABASE_URL/rest/v1/children?select=id" -H "apikey: $ANON_KEY"
--   -> expect [] (empty), and the logged-in app still works.
