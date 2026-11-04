-- ============================================================================
-- ROUND 6 — Capture inbox (jot now, review later) + the twice-weekly email.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

-- 1. Each parent gets a private inbox token: the Siri shortcut / any HTTP
--    client posts words with it, no login needed. Rotate from the app.
alter table profiles add column if not exists inbox_token text;
update profiles
   set inbox_token = replace(gen_random_uuid()::text, '-', '')
                  || replace(gen_random_uuid()::text, '-', '')
 where inbox_token is null;
create unique index if not exists profiles_inbox_token_idx on profiles (inbox_token);

-- 2. Captures learn where they came from and can be dismissed.
--    channel: app (reviewed in-flow) · later (in-app "save for later")
--             · shortcut (inbox token) · email (reply to the digest)
--    Inbox = status in ('draft','processed') and channel <> 'app'.
alter table captures add column if not exists channel text not null default 'app';
alter table captures add column if not exists source_ref text;   -- e.g. Resend email id (idempotency)
alter table captures add column if not exists context_note text; -- what the parent was replying to
alter table captures add column if not exists reviewed_at timestamptz;
alter table captures drop constraint if exists captures_status_check;
alter table captures add constraint captures_status_check
  check (status in ('draft','processed','confirmed','dismissed'));
alter table captures drop constraint if exists captures_channel_check;
alter table captures add constraint captures_channel_check
  check (channel in ('app','later','shortcut','email'));
create unique index if not exists captures_source_ref_idx on captures (source_ref) where source_ref is not null;
create index if not exists captures_inbox_idx on captures (status, channel, created_at desc);

-- 3. The emails Orbit sent: which questions it asked (so it doesn't repeat
--    itself) and the id that replies carry back.
create table if not exists family_digests (
  id               uuid primary key default gen_random_uuid(),
  sent_at          timestamptz not null default now(),
  recipient_emails text[] not null default '{}',
  questions        jsonb not null default '[]',
  pending_count    int not null default 0,
  provider_ids     jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists family_digests_sent_idx on family_digests (sent_at desc);

alter table family_digests enable row level security;
do $$ begin
  create policy "family_all" on family_digests
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Verification:
-- select email, left(inbox_token, 6) || '…' as token from profiles;      -- every parent has one
-- select column_name from information_schema.columns
--   where table_name = 'captures' and column_name in ('channel','source_ref','context_note','reviewed_at'); -- 4 rows
