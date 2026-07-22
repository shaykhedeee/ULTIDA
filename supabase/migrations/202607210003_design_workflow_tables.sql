-- Migration 9: Spaces, Layouts, Module Instances, Briefs, Approvals
-- Adds structured tables for the production design workflow
-- No existing tables are modified.

-- ─── Project Briefs ──────────────────────────────────────────────
create table if not exists public.project_briefs (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null unique references public.projects(id) on delete cascade,
  -- client
  client_name           text not null default '',
  client_email          text,
  client_phone          text,
  site_location         text,
  property_type         text,          -- apartment, villa, bungalow, rowhouse
  num_bedrooms          smallint,
  is_renovation         boolean not null default false,
  ceiling_height_mm     integer not null default 2700,
  possession_date       date,
  budget_inr            numeric(12,2),
  measurement_units     text not null default 'mm',
  -- style
  style_preferences     text[] not null default '{}',
  custom_style_ref      text,
  -- company standards (override from org defaults)
  company_standards     jsonb not null default '{}',
  -- functional requirements (per room)
  room_requirements     jsonb not null default '{}',
  -- reference uploads (asset IDs)
  reference_asset_ids   uuid[] not null default '{}',
  -- meta
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.project_briefs enable row level security;
grant select, insert, update on public.project_briefs to authenticated;

create policy briefs_member_all on public.project_briefs for all to authenticated
  using ((select private.is_org_member(
    (select organization_id from public.projects where id = project_id)
  )))
  with check ((select private.is_org_member(
    (select organization_id from public.projects where id = project_id)
  )));

-- ─── Spaces ──────────────────────────────────────────────────────
-- A space is a room detected/defined from an approved floor plan version.
create table if not exists public.spaces (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  floor_plan_version_id uuid references public.floor_plan_versions(id) on delete set null,
  name                  text not null,
  room_type             text not null,   -- living, bedroom, kitchen, bathroom, dining, utility, pooja, other
  area_sqm              numeric(8,2),
  ceiling_height_mm     integer,
  floor_level           smallint not null default 0,
  geometry_json         jsonb not null default '{}',   -- walls, openings from scene model
  requirements_json     jsonb not null default '{}',   -- furniture needs
  settings_json         jsonb not null default '{}',   -- ceiling type, floor finish, etc
  status                text not null default 'pending',  -- pending, configured, layout_selected, modules_placed, approved
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index spaces_project_idx on public.spaces(project_id, created_at);

alter table public.spaces enable row level security;
grant select, insert, update, delete on public.spaces to authenticated;

create policy spaces_member_all on public.spaces for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

-- ─── Layouts ─────────────────────────────────────────────────────
-- A layout is an approved symbolic furniture arrangement for a space.
create table if not exists public.layouts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  space_id              uuid not null references public.spaces(id) on delete cascade,
  layout_shape          text not null,        -- tv-opposite-sofa, l-shape-kitchen, bed-centred, etc
  label                 text not null default 'Option A',
  candidate_json        jsonb not null,       -- symbolic placements, dimensions, clearances
  rule_score_json       jsonb,               -- LayoutScore from rule-core
  status                text not null default 'candidate',  -- candidate, approved, rejected
  approved_by           uuid references auth.users(id),
  approved_at           timestamptz,
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now()
);

create index layouts_space_idx on public.layouts(space_id, created_at);

alter table public.layouts enable row level security;
grant select, insert, update, delete on public.layouts to authenticated;

create policy layouts_member_all on public.layouts for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

-- ─── Module Instances ────────────────────────────────────────────
-- A module instance is one configured parametric furniture unit within a layout.
create table if not exists public.module_instances (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  layout_id             uuid not null references public.layouts(id) on delete cascade,
  template_id           text not null,       -- e.g. 'tv-full-wall-profile-v1'
  category              text not null,       -- tv-unit, kitchen, wardrobe, crockery, pooja, study, bed
  label                 text not null default 'Module',
  config_json           jsonb not null,      -- full parametric configuration
  validation_json       jsonb,              -- rule violations from rule-core
  position_json         jsonb,              -- wall offset, elevation
  status                text not null default 'draft',   -- draft, configured, validated, approved
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index module_instances_layout_idx on public.module_instances(layout_id, created_at);

alter table public.module_instances enable row level security;
grant select, insert, update, delete on public.module_instances to authenticated;

create policy modules_member_all on public.module_instances for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

-- ─── Approvals ───────────────────────────────────────────────────
-- Stage-level sign-off audit trail.
create table if not exists public.approvals (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  stage                 text not null,       -- brief, plan, spaces, layout, modules, materials, scene, renders, drawings, estimate, presentation
  entity_id             uuid,               -- the specific row being approved (nullable for stage-level)
  entity_type           text,               -- floor_plan_version, layout, module_instance, etc
  status                text not null,       -- approved, rejected, revision_requested
  notes                 text,
  approved_by           uuid not null references auth.users(id),
  created_at            timestamptz not null default now()
);

create index approvals_project_stage_idx on public.approvals(project_id, stage, created_at desc);

alter table public.approvals enable row level security;
grant select, insert on public.approvals to authenticated;

create policy approvals_member_all on public.approvals for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and approved_by = (select auth.uid()));

-- ─── Company Standards ────────────────────────────────────────────
-- Configurable company-level design standards (overridable per project).
create table if not exists public.company_standards (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null unique references public.organizations(id) on delete cascade,
  standards_json        jsonb not null default '{
    "fingerGrooveGapMm": 30,
    "defaultLoftFillerMm": 50,
    "floatingTvBaseFloorGapMm": 200,
    "targetShutterWidthMm": 500,
    "allowSkirtingStripLight": false,
    "allowProfileLighting": true,
    "carcassThicknessMm": 18,
    "backPanelThicknessMm": 6,
    "edgeBandVisible": "2mm PVC",
    "edgeBandInternal": "0.8mm PVC",
    "sheetLengthMm": 2440,
    "sheetWidthMm": 1220,
    "preferredCarcassBrand": "",
    "preferredHardwareBrand": "",
    "standardSkirtingMm": 100,
    "standardLoftHeightMm": 600,
    "poojaTraySizeMm": 75
  }',
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.company_standards enable row level security;
grant select, insert, update on public.company_standards to authenticated;

create policy company_standards_member_all on public.company_standards for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));

-- ─── Extend projects table ────────────────────────────────────────
-- Add additional columns to existing projects table
alter table public.projects
  add column if not exists location text,
  add column if not exists property_type text,
  add column if not exists assigned_designer uuid references auth.users(id),
  add column if not exists workflow_stage text not null default 'brief',
  add column if not exists project_status text not null default 'draft';

-- ─── Comments ────────────────────────────────────────────────────
comment on table public.project_briefs is 'Structured client brief for each project';
comment on table public.spaces is 'Rooms detected/configured from approved floor plans';
comment on table public.layouts is 'Symbolic furniture layout candidates and approvals per space';
comment on table public.module_instances is 'Configured parametric modular units within layouts';
comment on table public.approvals is 'Stage-level sign-off audit trail';
comment on table public.company_standards is 'Organisation-level configurable design standards';
