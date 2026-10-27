-- Kitchen and modular quote versions
create table if not exists public.kitchen_quote_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  scene_version_id uuid references public.scene_versions(id) on delete set null,
  version_number integer not null default 1,
  status text not null default 'draft',
  quote_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.kitchen_quote_versions enable row level security;
