-- Additive design-library foundation. No existing project geometry is modified.
-- Apply to staging first; all browser access remains organization-scoped by RLS.

create table if not exists public.material_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  supplier text,
  brand text,
  code text not null,
  category text not null,
  finish text,
  texture_asset_id uuid references public.project_assets(id) on delete set null,
  texture_width_mm numeric,
  texture_height_mm numeric,
  grain_direction text not null default 'none',
  roughness numeric,
  metalness numeric,
  transparency numeric,
  thickness_mm numeric,
  unit_cost numeric,
  availability text not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists material_library_items_lookup_idx
  on public.material_library_items (organization_id, category, availability, name);

create table if not exists public.module_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  family text not null,
  name text not null,
  room_types jsonb not null default '[]'::jsonb,
  layout_shapes jsonb not null default '[]'::jsonb,
  preview_asset_id uuid references public.project_assets(id) on delete set null,
  parameter_schema jsonb not null default '{}'::jsonb,
  dimensional_limits jsonb not null default '{}'::jsonb,
  manufacturing_rules jsonb not null default '{}'::jsonb,
  price_metadata jsonb not null default '{}'::jsonb,
  version integer not null,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, family, name, version)
);

create index if not exists module_template_versions_lookup_idx
  on public.module_template_versions (organization_id, family, status, created_at desc);

create table if not exists public.material_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  material_id uuid not null references public.material_library_items(id) on delete restrict,
  module_instance_id uuid references public.module_instances(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  semantic_slot text not null,
  revision integer not null default 1,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, target_kind, target_id, semantic_slot, revision)
);

create index if not exists material_assignments_project_idx
  on public.material_assignments (project_id, module_instance_id, status, created_at desc);

alter table public.material_library_items enable row level security;
alter table public.module_template_versions enable row level security;
alter table public.material_assignments enable row level security;

grant select, insert, update, delete on public.material_library_items, public.module_template_versions, public.material_assignments to authenticated;

create policy material_library_items_member_all on public.material_library_items for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy module_template_versions_member_all on public.module_template_versions for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy material_assignments_member_all on public.material_assignments for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
