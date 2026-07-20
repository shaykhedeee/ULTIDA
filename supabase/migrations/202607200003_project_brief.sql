alter table public.projects add column if not exists brief jsonb not null default '{}'::jsonb;
