create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  measurement_units text not null default 'mm',
  default_external_wall_mm numeric not null default 254,
  default_internal_wall_mm numeric not null default 152.4,
  default_ceiling_height_mm integer not null default 2700,
  standards jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.organization_settings enable row level security;
create policy organization_settings_member_select on public.organization_settings for select using (private.is_org_member(organization_id));
create policy organization_settings_admin_write on public.organization_settings for all using (exists (select 1 from public.organization_members m where m.organization_id = organization_settings.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin'))) with check (exists (select 1 from public.organization_members m where m.organization_id = organization_settings.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin')));
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null, role text not null default 'designer' check (role in ('admin','designer','production','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.organization_invitations enable row level security;
create policy organization_invites_admin_all on public.organization_invitations for all using (exists (select 1 from public.organization_members m where m.organization_id = organization_invitations.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin'))) with check (exists (select 1 from public.organization_members m where m.organization_id = organization_invitations.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin')));
