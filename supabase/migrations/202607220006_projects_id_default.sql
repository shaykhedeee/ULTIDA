-- The connected live project keeps legacy text identifiers. Keep that contract
-- while ensuring browser inserts receive a stable UUID-compatible project ID.
alter table public.projects
  alter column id set default (gen_random_uuid()::text);
