# ULTIDA specification engineering

This directory makes requirements, implementation contracts, verification, and release evidence traceable for ULTIDA's geometry-first workflow.

Every new production-capable capability must have:

1. An immutable requirement ID.
2. A clear authority/source-of-truth statement.
3. Explicit success, failure, and review-required acceptance criteria.
4. A test or live-canary evidence reference.
5. A named owner of each side effect: browser, API, queue worker, or database.

The first active specification is [DURABLE_PLAN_JOBS.md](DURABLE_PLAN_JOBS.md). It is deliberately narrow: durable job reliability underpins upload, plan analysis, renders, and later production jobs.

Do not treat generated imagery or unreviewed AI proposals as satisfying a geometry or production requirement.
