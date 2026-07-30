-- Durable, supervised history for AURA proposals and review decisions.
-- This table is append-only for authenticated project members: AURA never
-- mutates approved geometry or rewrites its own training data from this ledger.
create table if not exists public.aura_audit_events (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Existing ULTIDA projects use stable text IDs; preserve that contract.
  project_id text not null references public.projects(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  tool_id text not null,
  event_type text not null check (event_type in ('proposal_created', 'proposal_approved', 'proposal_rejected', 'correction_recorded')),
  source_version_id text not null,
  proposal_id text not null,
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_audit_events_project_proposal_created_idx
  on public.aura_audit_events (project_id, proposal_id, created_at desc);

alter table public.aura_audit_events enable row level security;
grant select, insert on public.aura_audit_events to authenticated;

create policy aura_audit_events_member_read on public.aura_audit_events
  for select to authenticated
  using ((select private.is_org_member(organization_id)));

create policy aura_audit_events_member_append on public.aura_audit_events
  for insert to authenticated
  with check (
    (select private.is_org_member(organization_id))
    and actor_id = (select auth.uid())
  );

comment on table public.aura_audit_events is 'Append-only supervised AURA proposal and review ledger; not an autonomous training source.';
