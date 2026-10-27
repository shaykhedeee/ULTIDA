-- Dashboard project metadata. Keep this separate from the structured brief so the
-- project list can be queried without reading a full brief payload.
alter table public.projects
  add column if not exists location text,
  add column if not exists property_type text,
  add column if not exists assigned_designer text;
