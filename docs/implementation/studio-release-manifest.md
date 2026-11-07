# ULTIDA studio release manifest

- Candidate: `aacfd526b8476c0a2079df451632be2523aaead0`, branch `codex/ultida-studio-completion-20261106`.
- Preview: `dpl_6r2QPdZ5He9ssecuhKhRJuDeKikL` (READY), Vercel project `ultida`, team `shays-projects-4d072282`.
- Production rollback target: `dpl_6AuJe6qAQCAaSbXE2u3f9JB7sgow` (`fe2cf8473b8c3dca83de78df2cf70bd1f847c260`). Its source commit is not available from the current Git remote.
- Pending migration: `20261106194351_atomic_room_module_save.sql`; not applied to `ichnyfuetcucxhxilnre`. New API handlers require its functions. Apply and release as a coordinated, tested unit.
- Hosted test environment: none identified. Supabase lists only its main branch. Local PGlite tests use simplified RLS fixtures and do not certify hosted policies.
- Release blocker: hosted `module_instances`, `spaces`, `layouts`, `quotes`, `artifacts`, and `scene_versions` UPDATE policies have creator-sensitive checks. The invoker-rights transaction can fail when a project collaborator saves or invalidates another creator's rows. Reproduce with two authorized test users in an isolated project before selecting and testing a narrowly authorized fix. Do not weaken organization or project boundaries.
- GitHub connection fixed on 2026-11-07; branch pushed and preview built. Production deployment and customer data remain unchanged.
- Still required: the remaining studio scope in `studio-completion.md`, hosted authenticated acceptance, usability sessions, supplier evidence, real kitchen fixture, and workshop acceptance. A READY build does not certify these.

- Local follow-up: output invalidation now uses an organization-checked private helper and passes a collaborator-role regression test. Editing another creator’s unit remains blocked; a second test documents that behavior. Hosted RLS acceptance remains required. Supabase branch creation was attempted and rejected because the current plan does not support branching; no upgrade is required for local tests.
