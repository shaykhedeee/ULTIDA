create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'designer', 'production', 'viewer');
create type public.version_status as enum ('draft', 'review', 'approved', 'locked', 'superseded');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'designer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  client_name text not null default '',
  stage text not null default 'brief',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,
  storage_path text not null unique,
  mime_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.floor_plan_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.version_status not null default 'draft',
  source_asset_id uuid references public.project_assets(id) on delete restrict,
  spatial_model jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  change_reason text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table public.scene_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_version_id uuid not null references public.floor_plan_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  branch_name text not null default 'main',
  status public.version_status not null default 'draft',
  scene jsonb not null,
  change_reason text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, branch_name, version_number)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  scene_version_id uuid references public.scene_versions(id) on delete restrict,
  kind text not null,
  status public.job_status not null default 'queued',
  idempotency_key text unique,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_version_id uuid not null references public.scene_versions(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  kind text not null,
  status text not null default 'draft',
  stale boolean not null default false,
  storage_path text,
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id, organization_id);
create index projects_organization_idx on public.projects(organization_id, updated_at desc);
create index assets_project_idx on public.project_assets(project_id, created_at desc);
create index plans_project_idx on public.floor_plan_versions(project_id, version_number desc);
create index scenes_project_idx on public.scene_versions(project_id, branch_name, version_number desc);
create index jobs_claim_idx on public.jobs(status, available_at, created_at) where status = 'queued';
create index artifacts_scene_idx on public.artifacts(scene_version_id, kind, stale);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_assets enable row level security;
alter table public.floor_plan_versions enable row level security;
alter table public.scene_versions enable row level security;
alter table public.jobs enable row level security;
alter table public.artifacts enable row level security;

grant select, insert, update, delete on public.organizations, public.organization_members, public.projects, public.project_assets, public.floor_plan_versions, public.scene_versions, public.jobs, public.artifacts to authenticated;

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;

create policy organizations_member_select on public.organizations for select to authenticated
using ((select private.is_org_member(id)));

create policy members_same_org_select on public.organization_members for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy projects_member_all on public.projects for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy assets_member_all on public.project_assets for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy plans_member_all on public.floor_plan_versions for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy scenes_member_all on public.scene_versions for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy jobs_member_select on public.jobs for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy jobs_member_insert on public.jobs for insert to authenticated
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy artifacts_member_all on public.artifacts for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-assets', 'project-assets', false, 52428800, array['image/png','image/jpeg','application/pdf','application/dxf','application/octet-stream'])
on conflict (id) do nothing;

create policy project_assets_storage_select on storage.objects for select to authenticated
using (bucket_id = 'project-assets' and (select private.is_org_member(((storage.foldername(name))[1])::uuid)));

create policy project_assets_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-assets' and (select private.is_org_member(((storage.foldername(name))[1])::uuid)));

create policy project_assets_storage_update on storage.objects for update to authenticated
using (bucket_id = 'project-assets' and (select private.is_org_member(((storage.foldername(name))[1])::uuid)))
with check (bucket_id = 'project-assets' and (select private.is_org_member(((storage.foldername(name))[1])::uuid)));
