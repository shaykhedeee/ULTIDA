-- Immutable, organization-isolated moodboard revisions. No paid infrastructure.
-- Existing installations have used UUID and text project identities; inherit
-- the authoritative projects.id SQL type rather than introducing a broken FK.
do $migration$
declare project_id_type text;
begin
  select format_type(a.atttypid,a.atttypmod) into project_id_type
    from pg_attribute a where a.attrelid='public.projects'::regclass
    and a.attname='id' and not a.attisdropped;
  if project_id_type not in ('uuid','text','character varying') then
    raise exception 'Unsupported projects.id type: %', project_id_type;
  end if;
  execute format($ddl$
create table if not exists public.room_moodboard_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id %s not null references public.projects(id),
  room_id uuid not null references public.spaces(id),
  revision integer not null check (revision > 0),
  source_fingerprint text not null,
  document jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, room_id, revision)
);
$ddl$, project_id_type);
end
$migration$;

alter table public.room_moodboard_versions enable row level security;
revoke all on public.room_moodboard_versions from anon, authenticated;
grant select, insert on public.room_moodboard_versions to authenticated;
create policy room_moodboard_versions_read on public.room_moodboard_versions for select to authenticated
using ((select private.is_org_member(organization_id)) and exists (
  select 1 from public.projects p join public.spaces s on s.project_id::text=p.id::text
  where p.id=room_moodboard_versions.project_id and s.id=room_moodboard_versions.room_id and p.organization_id=room_moodboard_versions.organization_id
  and s.organization_id=room_moodboard_versions.organization_id
));
create policy room_moodboard_versions_append on public.room_moodboard_versions for insert to authenticated
with check (created_by=(select auth.uid()) and (select private.is_org_member(organization_id)) and exists (
  select 1 from public.projects p join public.spaces s on s.project_id::text=p.id::text
  where p.id=room_moodboard_versions.project_id and s.id=room_moodboard_versions.room_id
  and p.organization_id=room_moodboard_versions.organization_id and s.organization_id=room_moodboard_versions.organization_id
) and document->>'projectId'=project_id::text and document->>'roomId'=room_id::text
and document->>'sourceFingerprint'=source_fingerprint);
