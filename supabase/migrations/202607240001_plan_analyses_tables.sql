-- Plan analysis: full vision-provider output + deterministic evidence + reconciliation
create table if not exists public.plan_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  analysis_uuid uuid not null unique,
  provider text not null,
  model text not null,
  prompt_version text not null,
  source_file_name text,
  source_mime_type text,
  input_sha256 text not null,
  preview_sha256 text not null,
  request_payload jsonb not null default '{}'::jsonb,
  deterministic jsonb not null default '{}'::jsonb,
  response_validated jsonb not null default '{}'::jsonb,
  latency_ms integer not null default 0 check (latency_ms >= 0),
  usage jsonb,
  status text not null check (status in ('succeeded', 'failed')),
  error jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plan_analyses_project_created_idx
  on public.plan_analyses(project_id, created_at desc);

alter table public.plan_analyses enable row level security;
grant select, insert, update on public.plan_analyses to authenticated;
drop policy if exists plan_analyses_member_all on public.plan_analyses;
create policy plan_analyses_member_all on public.plan_analyses for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));

-- Editable draft derived from a plan_analysis, used by the review workspace
create table if not exists public.plan_analysis_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  analysis_uuid uuid not null references public.plan_analyses(analysis_uuid) on delete cascade,
  elements jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  scale jsonb,
  ceiling_height_mm integer,
  status text not null check (status in ('draft', 'needs_review', 'approved')),
  updated_at timestamptz not null default now()
);

create index if not exists plan_analysis_drafts_project_idx
  on public.plan_analysis_drafts(project_id, updated_at desc);

alter table public.plan_analysis_drafts enable row level security;
grant select, insert, update on public.plan_analysis_drafts to authenticated;
drop policy if exists plan_analysis_drafts_member_all on public.plan_analysis_drafts;
create policy plan_analysis_drafts_member_all on public.plan_analysis_drafts for all to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));

notify pgrst, 'reload schema';
