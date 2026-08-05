-- Governed reference metadata and studio decision memory.
-- Images are advisory evidence; dimensions remain authoritative in plan.v1/scene.v1.
create table if not exists public.reference_vault_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_path text not null,
  sha256 text not null,
  byte_size bigint not null default 0,
  file_extension text not null default 'png',
  title text not null,
  room text not null default 'unclassified',
  module_family text not null default 'unclassified',
  style text not null default 'unclassified',
  material_tags text[] not null default '{}',
  viewpoint text not null default 'unclassified',
  provenance text not null default 'internal_reference',
  license_state text not null default 'internal_only',
  review_state text not null default 'needs_review' check (review_state in ('needs_review','approved','rejected','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sha256)
);
create index if not exists reference_vault_filter_idx on public.reference_vault_entries(organization_id, room, module_family, style, review_state);
alter table public.reference_vault_entries enable row level security;
grant select, insert, update, delete on public.reference_vault_entries to authenticated;
create policy reference_vault_member_all on public.reference_vault_entries for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)));

create table if not exists public.studio_design_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id),
  decision_type text not null check (decision_type in ('layout','module','material','dimension','reference','render')),
  decision text not null check (decision in ('accepted','rejected','corrected','preferred')),
  subject jsonb not null default '{}'::jsonb,
  source_version_id text,
  created_at timestamptz not null default now()
);
create index if not exists studio_decisions_org_idx on public.studio_design_decisions(organization_id, decision_type, created_at desc);
create index if not exists studio_decisions_project_idx on public.studio_design_decisions(project_id, created_at desc);
alter table public.studio_design_decisions enable row level security;
grant select, insert on public.studio_design_decisions to authenticated;
create policy studio_decisions_member_read on public.studio_design_decisions for select to authenticated using ((select private.is_org_member(organization_id)));
create policy studio_decisions_member_insert on public.studio_design_decisions for insert to authenticated with check ((select private.is_org_member(organization_id)) and actor_id = (select auth.uid()));
