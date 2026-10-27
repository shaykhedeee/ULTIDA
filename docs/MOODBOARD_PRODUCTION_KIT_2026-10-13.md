# ULTIDA moodboard and production integration kit

This package contains both session implementation batches. It is source code with automated verification, not a deployed or manufacturing-certified release.

## One room, one material library, one board

The room workspace now contains a moodboard editor instead of a second disconnected palette. It reads actual saved assignments and links every material card to its organization-library identity. Merino references distinguish decorative boards from laminate; Ebco/Hettich references keep real fitting identities. Purchased furniture remains separate from fabrication panels.

The editor provides an editorial hero composition, grid and studio layouts, card dragging and keyboard movement, numerical resizing, notes, project images, undo/redo, saved revisions, supplier links, PNG output, structured specification JSON and browser Print / Save as PDF. Presentation exports carry a permanent draft/design-reference notice and room, scene and source identifiers. They do not confer production approval.

### Use actual laminate samples

1. Import the exact supplier record into the shared material library and assign it to a saved room or module.
2. Upload a manufacturer-permitted sample or your sample photograph through the room's existing References workflow. PNG, JPEG and WebP are verified by actual bytes, dimensions, size and full raster decode.
3. In the moodboard inspector select the material card and an existing project image. Confirm permission to use that image and choose Attach saved swatch.
4. Regenerate deliberately from the saved materials after the source changes; save a new board revision.
5. Review the physical sample before client specification or fabrication. Uploaded images are explicitly not color calibrated. Missing images remain labelled; no manufacturer grain or texture is synthesized.

Asset identities, not permanent signed URLs, are saved. Image access is project/organization scoped, and signed links can be refreshed. This release does not download or rehost proprietary supplier assets on your behalf.

## Persistence and conflicts

The additive `202610130001_room_moodboard_versions.sql` migration creates immutable board history with organization/project/room checks and SELECT/INSERT permissions. It is included, not applied to any hosted database. The API refuses fake successful saves when migration or access is missing; the editor can still produce clearly labelled local drafts with server saving disabled.

Concurrent saves use expected revisions and a unique revision constraint. Material/swatches/source changes mark boards stale; undoing to old sources does not unlock export. Replacing a swatch checks its old asset and material timestamp so another user's edit cannot be silently overwritten. Switching rooms preserves server identity checks and prevents old responses from replacing the active context.

The assignment fingerprint check and append are not one database transaction. If another material change races insertion, the next GET marks the new board stale. Strict transactional source locking remains a release-hardening task for simultaneous multi-user editing.

## 3D correctness and resource ownership

- Floors now use saved room surface polygons, material references, elevations/build-up, tile dimensions, grout, origin, rotation and grid/brick pattern. Unassigned floors use an explicitly unassigned neutral preview rather than room-name presets.
- The viewer no longer adds the legacy unsaved villa staircase, mezzanine or chandelier. Further multi-storey architecture requires actual persisted geometry.
- Saved scene cameras restore canonical z-up position, target and lens; viewport resize preserves focal length. Orbit and calculated preview angles remain separate from saved AI-render cameras.
- GPU teardown releases geometry/material/texture resources once. Cached GLB instances receive separate GPU resources so a late disposed asset cannot release cached source meshes used by another view.
- These are measured visual previews, not verified reproduction of supplier PBR textures. Client swatches and construction data remain separate.

## Access and source hardening

Project identities in request paths, bodies and queries must agree. Source uploads reject forged MIME, size mismatch, path traversal and truncated raster data. Moodboard cards cannot persist arbitrary remote image URLs or out-of-bounds geometry. Saved boards and image cards are isolated by authenticated project and organization access.

## Tests and rollout

See `PRODUCTION_RELEASE_GATES_2026-10-13.md` for verified gates and remaining release blockers. Apply the combined patch series or Git bundle on its stated base, not both. Run the repository reliability and secret checks, apply/reconcile the migration on a verified staging schema, then run authenticated desktop/tablet/mobile journeys before deployment. No paid service or hosted database mutation was invoked by this package.
