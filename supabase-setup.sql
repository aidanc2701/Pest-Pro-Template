-- Run this once in your Supabase project's SQL Editor
-- (left sidebar -> SQL Editor -> New query -> paste this -> Run)
--
-- If you already ran an older version of this file: running this again is
-- safe. It replaces the old "anyone with the anon key can read/write
-- everything" policy with one that requires a signed-in user, and creates
-- the table if it doesn't exist yet.

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table kv_store enable row level security;

-- Only signed-in users (your team, via the login screen) can read or write
-- proposal/CRM data through the app's normal Supabase connection. The
-- public anon key alone -- visible in the page's source, by design -- is
-- no longer enough to access anything.
drop policy if exists "anon full access" on kv_store;
drop policy if exists "authenticated full access" on kv_store;
create policy "authenticated full access"
  on kv_store
  for all
  to authenticated
  using (true)
  with check (true);

-- The one exception: a client opening a "Signing Link" isn't logged in and
-- never will be. That flow no longer talks to this table directly at all --
-- it goes through the /api/proposal serverless function instead, which
-- uses a separate service-role key (never exposed to the browser) to reach
-- exactly one proposal at a time. No anon policy is needed or created here
-- for that path, which is what makes the rest of this table actually
-- private now.
