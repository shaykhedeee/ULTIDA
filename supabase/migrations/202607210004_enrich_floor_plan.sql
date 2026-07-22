-- Migration 10: Enrich floor plan schema
-- Adds canonical JSON, scale/verification/state, schema version, review gate.
alter table public.floor_plan_versions
  add column if not exists canonical_model jsonb,
  add column if not exists scale_state jsonb,
  add column if not exists verification_state jsonb,
  add column if not exists schema_version text not null default 'plan.v1',
  add column if not exists confidence_min numeric(5,4),
  add column if not exists review_status text not null default 'validated',
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

-- Issue queue for plan analysis stages
create table if not exists public.plan_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_version_id uuid references public.floor_plan_versions(id) on delete set null,
  code text not null,
  severity text not null check (severity in ('warning','critical')),
  entity_id text,
  message text not null,
  suggestion_a text,
  suggestion_b text,
  dismissed_reason text,
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index plan_issues_project_idx on public.plan_issues(project_id, created_at desc);

alter table public.plan_issues enable row level security;
grant select, insert, update, delete on public.plan_issues to authenticated;

create policy plan_issues_member_all on public.plan_issues for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and coalesce(resolved_by, auth.uid()) = auth.uid());

comment on table public.floor_plan_versions is 'Approved immutable floor-plan versions with canonical model and validation.';
comment on table public.plan_issues is 'Designer review issue queue tied to a floor-plan version or analysis.';
