create table if not exists public.reference_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete cascade,
  asset_id uuid references public.project_assets(id) on delete set null,
  title text not null,
  kind text not null check (kind in ('reference', 'render', 'material', 'inspiration', 'output')),
  tags text[] not null default '{}',
  notes text not null default '',
  source text not null default 'studio',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists reference_library_org_idx on public.reference_library_items(organization_id, created_at desc);
create index if not exists reference_library_project_idx on public.reference_library_items(project_id, created_at desc);
create index if not exists reference_library_asset_idx on public.reference_library_items(asset_id);
create index if not exists reference_library_created_by_idx on public.reference_library_items(created_by);
alter table public.reference_library_items enable row level security;
grant select, insert, update, delete on public.reference_library_items to authenticated;

create policy reference_library_member_all on public.reference_library_items for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
