-- ============================================================================
-- PIVOT — reports: uploaded progress reports & assessments per kid
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- ALSO REQUIRED (dashboard, not SQL): Storage → New bucket →
--   name: reports  ·  Public bucket: OFF (private!)
-- Then Storage → reports → Policies → New policy (for each of
-- INSERT / SELECT / DELETE): allow for authenticated users only
-- (target roles: authenticated, USING/CHECK: true).
-- ============================================================================

create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  title        text not null,
  kind         text not null default 'school_report'
                 check (kind in ('school_report','assessment','artwork','other')),
  period_label text,
  storage_path text not null,
  notes        text,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

alter table reports enable row level security;
do $$ begin
  create policy "family_all" on reports
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Verification:
-- select count(*) from reports;                                -- 0 (new)
-- select policyname from pg_policies where tablename='reports'; -- family_all
