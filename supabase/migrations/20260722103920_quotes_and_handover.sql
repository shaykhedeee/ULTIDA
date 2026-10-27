create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  scene_version_id uuid references public.scene_versions(id) on delete set null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft', -- 'draft', 'approved', 'sent'
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

-- Keep quote versions self-contained so an approved commercial result remains
-- reproducible even when the catalog or scene changes later.
alter table public.quotes add column if not exists currency text not null default 'INR';
alter table public.quotes add column if not exists subtotal_inr numeric(12,2) not null default 0;
alter table public.quotes add column if not exists discount_inr numeric(12,2) not null default 0;
alter table public.quotes add column if not exists margin_rate numeric(8,6) not null default 0;
alter table public.quotes add column if not exists margin_inr numeric(12,2) not null default 0;
alter table public.quotes add column if not exists gst_rate numeric(8,6) not null default 0;
alter table public.quotes add column if not exists gst_inr numeric(12,2) not null default 0;
alter table public.quotes add column if not exists taxable_inr numeric(12,2) not null default 0;
alter table public.quotes add column if not exists assumptions jsonb not null default '[]'::jsonb;
alter table public.quotes add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table public.quotes add column if not exists stale boolean not null default false;
alter table public.quotes add column if not exists approved_by uuid references auth.users(id);
alter table public.quotes add column if not exists approved_at timestamptz;

create index if not exists quotes_project_status_idx on public.quotes(project_id, status, stale);

alter table public.quotes enable row level security;
grant select, insert, update, delete on public.quotes to authenticated;

drop policy if exists quotes_member_all on public.quotes;
create policy quotes_member_all on public.quotes for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
