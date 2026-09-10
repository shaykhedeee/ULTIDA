# Latest update: evidence and next priorities

## Verified remote release

GitHub main: `dff8bea44351751e816b5f48a24c4f97ba6aff0d`.
Vercel production deployment `dpl_ALqwkKYqwEMR7FCMpewZ5izaYfe1` reports READY and the same GitHub SHA, with alias https://ultida.vercel.app.
This proves deployment, not authenticated workflow correctness or manufacturing certification.

## Findings from the update

- The standalone CAM CSV constructed the same generic cabinet schedule for every selected family. It did not use compiled parts. Replaced with a clearly labelled, non-fabrication design brief containing only the selected envelope dimensions.
- Project dispatch stages a browser-local proposal; it does not persist placement. Corrected success text and navigation to avoid claiming placement.
- The newer approval path rectified geometry during approval. Retained the requirement to approve the geometry actually reviewed.
- The newer render fallback could promote Gemini by default and allow text-only generation despite an input scene image. Retained explicit provider and image-input safeguards.
- The island compiler emits waterfall legs outside its declared width (negative X and X equal to total width). Its input checks also need finite-number, depth/overhang, height and drawer-count validation. Do not treat its current test coverage as production certification.
- The reported dual-currency feature conflicts with the user's INR-only requirement. Pricing also needs dated supplier evidence before being presented as current factory rates.

## Next best implementation sequence

1. Certify the new island compiler: bounded inputs, complete physical envelope, side/partition topology, real panels versus assembly placeholders, and per-material BOM reconciliation. Test minimum, nominal, maximum and malformed inputs.
2. Finish authenticated project placement: authenticated project loading, project-bound draft, explicit room/wall selection, server validation, persisted placement and revision invalidation.
3. Run one real measured room through calibration, openings, adjustable bays, compilation, approval, rendering and production. Reload between each stage. Check door offsets, sill heights, cutlist identity and stale outputs.
4. Complete the dossier from that exact approved revision, including real wall sheets, finishes, Excel panel schedules and labels. Block uncertified components rather than synthesizing production details.
5. Only then expand multi-storey, animated interiors or machine-specific CNC exports. Those features do not repair the existing correctness gaps.

See also `connected-app-completion-plan.md` for the surface-by-surface acceptance checklist. No claim is made that every screen, provider or authenticated journey has been verified.
