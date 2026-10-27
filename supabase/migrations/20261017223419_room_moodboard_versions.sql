-- Room moodboard versions persistence
create table if not exists public.room_moodboard_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  version_number integer not null default 1,
  status text not null default 'draft',
  moodboard jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.room_moodboard_versions enable row level security;
