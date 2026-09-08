-- A production pack is not release-ready merely because its source scene is
-- approved. Persist the panel review against that exact immutable scene.
create table if not exists public.production_snapshot_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  scene_version_id uuid not null references public.scene_versions(id) on delete cascade,
  fabrication_rules_version text not null,
  status text not null default 'review_required' check (status in ('review_required', 'approved', 'revoked')),
  approved_part_ids text[] not null default '{}',
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scene_version_id)
);

create index if not exists production_snapshot_reviews_org_project_idx
  on public.production_snapshot_reviews (organization_id, project_id, updated_at desc);
create index if not exists production_snapshot_reviews_reviewed_by_idx
  on public.production_snapshot_reviews (reviewed_by);

alter table public.production_snapshot_reviews enable row level security;
grant select, insert, update on public.production_snapshot_reviews to authenticated;

drop policy if exists production_snapshot_reviews_member_select on public.production_snapshot_reviews;
create policy production_snapshot_reviews_member_select on public.production_snapshot_reviews
for select to authenticated
using ((select private.is_org_member(organization_id)));

drop policy if exists production_snapshot_reviews_authorized_write on public.production_snapshot_reviews;
drop policy if exists production_snapshot_reviews_authorized_insert on public.production_snapshot_reviews;
drop policy if exists production_snapshot_reviews_authorized_update on public.production_snapshot_reviews;
create policy production_snapshot_reviews_authorized_insert on public.production_snapshot_reviews
for insert to authenticated
with check (
  reviewed_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = production_snapshot_reviews.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'designer', 'production')
  )
);

create policy production_snapshot_reviews_authorized_update on public.production_snapshot_reviews
for update to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = production_snapshot_reviews.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'designer', 'production')
  )
)
with check (
  reviewed_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = production_snapshot_reviews.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'designer', 'production')
  )
);

notify pgrst, 'reload schema';
