-- Run this once in your Supabase project's SQL Editor
-- (left sidebar -> SQL Editor -> New query -> paste this -> Run)

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table kv_store enable row level security;

-- This tool has no login system -- it's an internal team tool where
-- "anyone with the site's link" is the intended access model, matching
-- how the original template's Saved Proposals sidebar was designed.
-- This policy lets the public anon key read and write every row.
-- That means anyone who has your site's URL + anon key (visible in the
-- page's source code, by design) can read or edit saved proposals.
-- Don't put anything more sensitive than proposal drafts in this table.
drop policy if exists "anon full access" on kv_store;
create policy "anon full access"
  on kv_store
  for all
  to anon
  using (true)
  with check (true);
