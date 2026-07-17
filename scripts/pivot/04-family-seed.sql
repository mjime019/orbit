-- ============================================================================
-- PIVOT FAMILY SEED — the real family replaces the demo identity
--
-- !!! EDIT BEFORE RUNNING — three placeholders:
--   <FOUNDER_AUTH_UUID>  Authentication → Users → (your user) → copy UUID
--   <WIFE_AUTH_UUID>     same, for your wife's user
--   <WIFE_NAME>          her display name (shows on her captures)
--
-- PRIVACY (public repo): the birthdates below are PLACEHOLDERS chosen only
-- to land the right ages (Rafael 5½, Felipe 4, Santiago 8 mo as of Jul 2026).
-- After running, set the boys' REAL birthdates in the dashboard
-- (Table Editor → children → date_of_birth). Never commit real DOBs.
--
-- Run AFTER 01-batch-a. Safe to re-run.
-- ============================================================================

-- 1. Parent profiles (id must equal the auth user id)
insert into profiles (id, email, name, role) values
  ('<FOUNDER_AUTH_UUID>', 'mjime019@gmail.com', 'Miguel', 'parent'),
  ('<WIFE_AUTH_UUID>', 'wife@example.com', '<WIFE_NAME>', 'parent')
on conflict (id) do nothing;

-- 2. Santiago (new) + placeholder-DOB corrections for the older boys
insert into children (id, name, date_of_birth) values
  ('00000000-0000-0000-0000-000000001103', 'Santiago', '2025-11-01')
on conflict (id) do nothing;

insert into child_profiles (child_id)
select '00000000-0000-0000-0000-000000001103'::uuid
where not exists (select 1 from child_profiles
  where child_id = '00000000-0000-0000-0000-000000001103');

update children set date_of_birth = '2021-01-01'  -- placeholder ~5½y — set real DOB in dashboard
  where id = '00000000-0000-0000-0000-000000001102'; -- Rafael
update children set date_of_birth = '2022-07-01'  -- placeholder ~4y — set real DOB in dashboard
  where id = '00000000-0000-0000-0000-000000001101'; -- Felipe

-- 3. Family links: both parents x three boys; demo-parent links retired
delete from parent_children
  where parent_id = '00000000-0000-0000-0000-000000000201'; -- demo "Miguel" incl. Johnny

insert into parent_children (parent_id, child_id)
select p.id, c.id
from (values ('<FOUNDER_AUTH_UUID>'::uuid), ('<WIFE_AUTH_UUID>'::uuid)) as p(id),
     (values ('00000000-0000-0000-0000-000000001101'::uuid),  -- Felipe
             ('00000000-0000-0000-0000-000000001102'::uuid),  -- Rafael
             ('00000000-0000-0000-0000-000000001103'::uuid))  -- Santiago
       as c(id)
on conflict (parent_id, child_id) do nothing;

-- 4. Columns future phases rely on (additive)
alter table child_profiles add column if not exists extra jsonb not null default '{}';
alter table child_summaries add column if not exists pulse text;

-- Verification:
-- select p.name, c.name from parent_children pc
--   join profiles p on p.id = pc.parent_id
--   join children c on c.id = pc.child_id
--   order by p.name, c.date_of_birth;   -- expect 6 rows: 2 parents x 3 boys, no Johnny
