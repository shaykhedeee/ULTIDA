-- Adds top-level design_intent JSONB column to scene_versions for direct SQL querying and indexing
alter table public.scene_versions
  add column if not exists design_intent jsonb default null;

-- Populate design_intent from existing scene JSON if present
update public.scene_versions
set design_intent = scene->'designIntent'
where design_intent is null
  and scene ? 'designIntent';

select pg_notify('pgrst', 'reload schema');
