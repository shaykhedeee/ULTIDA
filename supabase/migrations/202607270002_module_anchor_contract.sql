-- Additive module-anchor contract. Existing rows remain valid but cannot be
-- compiled until their position_json contains a wallId and millimetre point.
alter table public.module_instances
  add column if not exists space_id uuid references public.spaces(id) on delete cascade;

create index if not exists module_instances_space_idx
  on public.module_instances(project_id, space_id, created_at);

comment on column public.module_instances.position_json is
  'Authoritative wall anchor: wallId, offsetMm, xMm, yMm, zMm, rotationDeg, anchor.';
