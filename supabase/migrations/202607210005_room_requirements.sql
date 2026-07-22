-- Migration 11: Spaces stage persistence
-- Room requirements tied to active floor plan version and project.
-- No existing tables are modified.
create table if not exists public.room_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  floor_plan_version_id uuid references public.floor_plan_versions(id) on delete set null,
  space_id uuid not null references public.spaces(id) on delete cascade,
  -- core identity
  name text not null default '',
  room_type text not null,
  ceiling_height_mm integer not null default 2700,
  false_ceiling text not null default '',
  floor_finish text not null default '',
  -- design intent
  design_priority text not null default 'standard', -- basic, standard, premium, luxury
  style_preference text not null default '',
  budget_allocation_inr numeric(12,2) not null default 0,
  -- existing fixed items
  existing_fixed_items jsonb not null default '[]',
  -- living requirements
  tv_size_inch integer,
  seating_count smallint,
  -- bedroom requirements
  bed_size text,
  storage_needs text,
  -- kitchen requirements
  kitchen_shape text,
  appliances jsonb not null default '[]',
  sink_position text,
  hob_position text,
  chimney_type text,
  fridge_position text,
  pantry boolean not null default false,
  dishwasher boolean not null default false,
  utility boolean not null default false,
  -- pooja/religious requirements
  pooja_unit text,
  -- generic furniture requirements
  required_furniture jsonb not null default '[]',
  -- readiness/completion
  geometry_verified boolean not null default false,
  requirements_complete boolean not null default false,
  ready_for_layout boolean not null default false,
  blocked_by_plan_issue boolean not null default false,
  blocking_issue_ids uuid[] not null default '{}',
  incomplete_requirements text[] not null default '{}',
  -- meta
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index room_requirements_project_idx on public.room_requirements(project_id, created_at desc);
create index room_requirements_space_idx on public.room_requirements(space_id);
create index room_requirements_floor_plan_idx on public.room_requirements(floor_plan_version_id);

alter table public.room_requirements enable row level security;
grant select, insert, update, delete on public.room_requirements to authenticated;

create policy room_requirements_member_all on public.room_requirements for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

comment on table public.room_requirements is 'Per-room design requirements tied to approved floor plan versions and spaces.';
