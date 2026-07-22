-- Migration 13: Phase-1 Persistence Enhancements
-- Enrich project_briefs, floor_plan_versions, and spaces for deterministic workflow tracking.

alter table public.project_briefs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists brief jsonb not null default '{}'::jsonb,
  add column if not exists is_complete boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id);

alter table public.floor_plan_versions
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists active_version boolean not null default false;

alter table public.spaces
  add column if not exists space_id text,
  add column if not exists verification_status text not null default 'pending';

create unique index if not exists spaces_fpv_space_id_idx on public.spaces(floor_plan_version_id, space_id) where floor_plan_version_id is not null and space_id is not null;
