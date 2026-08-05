create table if not exists public.studio_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete cascade,
  title text not null,
  event_type text not null default 'milestone' check (event_type in ('milestone','site_visit','client_review','delivery','payment_due','task')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  notes text not null default '',
  assigned_to uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_calendar_org_time_idx on public.studio_calendar_events(organization_id, starts_at);
alter table public.studio_calendar_events enable row level security;
grant select, insert, update, delete on public.studio_calendar_events to authenticated;
create policy studio_calendar_member_all on public.studio_calendar_events for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create table if not exists public.studio_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_number text not null,
  client_name text not null default '',
  currency text not null default 'INR',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  due_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);
create index if not exists studio_invoices_project_idx on public.studio_invoices(project_id, status);
alter table public.studio_invoices enable row level security;
grant select, insert, update on public.studio_invoices to authenticated;
create policy studio_invoices_member_all on public.studio_invoices for all to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
