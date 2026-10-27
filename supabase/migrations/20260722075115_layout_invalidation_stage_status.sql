-- P0 workflow persistence: approved layout invalidation and DB-backed stage state.
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  floor_plan_version_id uuid references public.floor_plan_versions(id) on delete set null,
  name text not null,
  room_type text not null default 'other',
  geometry_json jsonb not null default '{}'::jsonb,
  requirements_json jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.spaces enable row level security;
grant select, insert, update, delete on public.spaces to authenticated;
drop policy if exists spaces_member_all on public.spaces;
create policy spaces_member_all on public.spaces for all to authenticated using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  layout_shape text not null default 'custom',
  label text not null default 'Option A',
  candidate_json jsonb not null default '{}'::jsonb,
  rule_score_json jsonb,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','stale')),
  approved_by uuid references auth.users(id), approved_at timestamptz,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.layouts enable row level security;
grant select, insert, update, delete on public.layouts to authenticated;
drop policy if exists layouts_member_all on public.layouts;
create policy layouts_member_all on public.layouts for all to authenticated using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.layout_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'candidate' check (status in ('candidate','approved','superseded','stale')),
  config jsonb not null default '{}'::jsonb,
  candidate_json jsonb not null default '{}'::jsonb,
  source_plan_version_id uuid references public.floor_plan_versions(id) on delete set null,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id, space_id, version_number)
);

create index if not exists layout_versions_project_idx on public.layout_versions(project_id, space_id, created_at desc);
alter table public.layout_versions enable row level security;
grant select, insert, update on public.layout_versions to authenticated;
drop policy if exists layout_versions_member_all on public.layout_versions;
create policy layout_versions_member_all on public.layout_versions for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()) or approved_by = (select auth.uid()));

create table if not exists public.layout_invalidation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  source_layout_version_id uuid references public.layout_versions(id) on delete set null,
  reason text not null,
  stale_artifact_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.layout_invalidation_events enable row level security;
grant select, insert on public.layout_invalidation_events to authenticated;
drop policy if exists layout_invalidation_member_all on public.layout_invalidation_events;
create policy layout_invalidation_member_all on public.layout_invalidation_events for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.workflow_stage_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  stage text not null,
  status text not null default 'blocked' check (status in ('blocked','ready','in_progress','needs_review','approved','stale','complete')),
  blocker text,
  next_action text,
  evidence jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(project_id, stage)
);
alter table public.workflow_stage_status enable row level security;
grant select, insert, update on public.workflow_stage_status to authenticated;
drop policy if exists workflow_stage_status_member_all on public.workflow_stage_status;
create policy workflow_stage_status_member_all on public.workflow_stage_status for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and updated_by = (select auth.uid()));
