-- Index for atomic moodboard version lookup
create index if not exists room_moodboard_versions_project_space_idx on public.room_moodboard_versions(project_id, space_id, version_number desc);
