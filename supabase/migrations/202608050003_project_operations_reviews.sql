-- Studio operations layer: accountable stage reviews, risks, comments,
-- cutlist history, and supplier/material readiness. All records stay scoped
-- to the owning organization and are additive to the existing approvals log.
create table if not exists public.project_stage_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  stage text not null check (stage in ('plan','scene','cutlist','quote','delivery')),
  status text not null default 'pending' check (status in ('pending','changes_requested','approved','rejected')),
  assigned_to uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  version_id text,
  notes text not null default '',
  decided_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, stage)
);
create index if not exists project_stage_reviews_org_idx on public.project_stage_reviews(organization_id, status, stage);
alter table public.project_stage_reviews enable row level security;
grant select, insert, update on public.project_stage_reviews to authenticated;
create policy project_stage_reviews_member_all on public.project_stage_reviews for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and (created_by = (select auth.uid()) or reviewer_id = (select auth.uid()) or assigned_to = (select auth.uid())));

create table if not exists public.project_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  stage text not null default 'plan',
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open','mitigated','accepted','closed')),
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_risks_project_idx on public.project_risks(project_id, status, severity);
alter table public.project_risks enable row level security;
grant select, insert, update on public.project_risks to authenticated;
create policy project_risks_member_all on public.project_risks for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.project_version_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  stage text not null,
  version_id text,
  body text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  author_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists project_version_comments_project_idx on public.project_version_comments(project_id, stage, created_at desc);
alter table public.project_version_comments enable row level security;
grant select, insert, update on public.project_version_comments to authenticated;
create policy project_version_comments_member_all on public.project_version_comments for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and author_id = (select auth.uid()));

create table if not exists public.project_cutlist_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  scene_version_id text,
  revision integer not null default 1,
  change_summary text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists project_cutlist_history_project_idx on public.project_cutlist_history(project_id, revision desc);
alter table public.project_cutlist_history enable row level security;
grant select, insert on public.project_cutlist_history to authenticated;
create policy project_cutlist_history_member_all on public.project_cutlist_history for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.project_material_readiness (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  material_id uuid references public.material_library_items(id) on delete set null,
  supplier text not null default '',
  status text not null default 'unreviewed' check (status in ('unreviewed','available','ordered','received','blocked')),
  notes text not null default '',
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(project_id, material_id, supplier)
);
create index if not exists project_material_readiness_project_idx on public.project_material_readiness(project_id, status);
alter table public.project_material_readiness enable row level security;
grant select, insert, update on public.project_material_readiness to authenticated;
create policy project_material_readiness_member_all on public.project_material_readiness for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)) and updated_by = (select auth.uid()));
