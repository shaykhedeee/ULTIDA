-- Publish only lifecycle tables used by the authenticated project workspace.
-- Existing table RLS policies remain the authorization boundary for Postgres Changes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jobs',
    'workflow_stage_status',
    'project_assets',
    'reference_library_items'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
