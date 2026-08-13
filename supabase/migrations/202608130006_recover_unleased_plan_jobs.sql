-- Older API deployments could leave a plan job running before lease metadata
-- was attached. Close those abandoned claims so the browser receives a
-- terminal, retryable result instead of polling forever.
update public.jobs
set status = 'failed',
    error = jsonb_build_object(
      'code', 'UNLEASED_JOB_RECOVERED',
      'message', 'This analysis was interrupted before a durable worker lease was established. Retry from the current plan workspace.'
    ),
    last_error_code = 'UNLEASED_JOB_RECOVERED',
    failed_at = now(),
    progress_stage = 'failed',
    locked_at = null,
    locked_by = null,
    lease_token = null,
    lease_expires_at = null,
    updated_at = now()
where kind = 'plan-analysis'
  and status = 'running'
  and lease_token is null
  and lease_expires_at is null
  and deadline_at is null
  and updated_at < now() - interval '5 minutes';

notify pgrst, 'reload schema';
