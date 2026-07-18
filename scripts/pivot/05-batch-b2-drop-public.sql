-- ============================================================================
-- PIVOT BATCH B2 — corrected lockdown (run this; 02 was incomplete)
--
-- 02-batch-b matched policies granted TO the `anon` role — but most of the
-- old permissive policies were created without a TO clause, which Postgres
-- records as TO `public` (a superset that includes anon). Those survived the
-- first pass, so anonymous reads still worked on children/observations/etc.
--
-- This drops EVERY policy on public-schema tables that is exposed to anon or
-- public, keeping only the `family_all` (authenticated) policies. Safe to
-- re-run. Rollback remains 03-rollback-readd-anon.sql.
-- ============================================================================

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and ('anon' = any(roles) or 'public' = any(roles))
      and policyname <> 'family_all'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    raise notice 'dropped % on %', r.policyname, r.tablename;
  end loop;
end $$;

-- Verification:
-- select tablename, policyname, roles from pg_policies
--   where schemaname='public' and ('anon' = any(roles) or 'public' = any(roles));
--   -- expect 0 rows
