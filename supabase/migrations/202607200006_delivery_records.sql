ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS delivery_records jsonb not null default '{}'::jsonb;
