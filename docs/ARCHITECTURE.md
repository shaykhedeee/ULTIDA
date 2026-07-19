# Architecture Invariants

1. Approved plan versions own measured geometry before scene creation.
2. `scene.v1` owns measured design after scene creation.
3. Every visual, drawing, cutlist and quote references an exact scene version.
4. AI outputs are synthetic proposals and cannot update dimensions.
5. Provider failures are visible and never replaced with unrelated stock media.
6. Every mutation has organization, actor, source version, reason and audit event.
7. Legacy ULTIDA is read-only; imports are selective and reconciled.
