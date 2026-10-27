-- Index for atomic AURA audit event review
create index if not exists aura_audit_events_project_created_idx on public.aura_audit_events(project_id, created_at desc);
