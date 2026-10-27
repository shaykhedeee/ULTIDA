-- Align the active hosted schema with the API contracts without replaying
-- historical foundation migrations against a live project.

create table if not exists public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null unique references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  brief jsonb not null default '{}'::jsonb,
  client_name text not null default '',
  client_email text,
  client_phone text,
  site_location text,
  property_type text,
  num_bedrooms smallint,
  is_renovation boolean not null default false,
  ceiling_height_mm integer not null default 2700,
  budget_inr numeric(12,2),
  measurement_units text not null default 'mm',
  style_preferences text[] not null default '{}',
  custom_style_ref text,
  company_standards jsonb not null default '{}'::jsonb,
  room_requirements jsonb not null default '{}'::jsonb,
  is_complete boolean not null default false,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_briefs enable row level security;
grant select, insert, update on public.project_briefs to authenticated;
drop policy if exists project_briefs_member_all on public.project_briefs;
create policy project_briefs_member_all on public.project_briefs for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)));

alter table public.projects
  add column if not exists workflow_stage text not null default 'brief',
  add column if not exists project_status text not null default 'draft';

alter table public.floor_plan_versions
  add column if not exists canonical_model jsonb,
  add column if not exists scale_state jsonb,
  add column if not exists verification_state jsonb,
  add column if not exists schema_version text not null default 'plan.v1',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists active_version boolean not null default false,
  add column if not exists review_status text not null default 'needs_review';

alter table public.spaces
  add column if not exists space_id text,
  add column if not exists area_sqm numeric(8,2),
  add column if not exists ceiling_height_mm integer,
  add column if not exists settings_json jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pending';

create unique index if not exists spaces_plan_space_id_idx
on public.spaces(floor_plan_version_id, space_id)
where floor_plan_version_id is not null and space_id is not null;
