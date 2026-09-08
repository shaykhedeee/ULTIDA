# Durable plan-analysis jobs

Status: active  
Owner: platform workflow  
Source authority: `public.jobs` in canonical Supabase project `ichnyfuetcucxhxilnre`

| ID | Requirement | Acceptance criteria | Evidence |
| --- | --- | --- | --- |
| JOB-001 | A queued delivery claims only the named job. | Claim is atomic, filters the requested id, and uses row locking. | `claim_plan_analysis_job`; `plan-job-claim-contract.test.ts` |
| JOB-002 | A browser status request is read-only. | It does not update `jobs`, redispatch, or call a provider. | `getPlanAnalysisJob` review; API tests |
| JOB-003 | Only the worker owns recovery. | Scheduled queue sweep resets expired leases and reclaims queued work. | `processPlanAnalysisJobs` |
| JOB-004 | A job has bounded progress. | Worker writes stage, lease, deadline, and a terminal state or timeout. | `plan-jobs.ts`; live canary pending |
| JOB-005 | Failed delivery is recoverable without silent loss. | Queue retries are bounded; exhausted messages go to `ultida-ai-jobs-dlq`. | `apps/cloudflare-ai-worker/wrangler.toml` |
| JOB-006 | A plan can still be reviewed when providers fail. | Guided tracing remains available; no fabricated successful AI model is saved. | Plan review workflow; regression tests |

## State transition contract

`queued -> running -> preparing -> analysing -> reconciling -> saving -> succeeded`

Terminal states are `failed`, `cancelled`, and `timed_out`. The UI may show user-friendly labels, but it must not invent a terminal status before the database records it.

## Out of scope

- A browser is not a worker and cannot repair jobs automatically.
- AI does not become geometry authority by finishing a job.
- A dead-letter queue is not a visible success state; it requires operational review.
