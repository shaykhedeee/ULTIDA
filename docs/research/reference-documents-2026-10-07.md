# Reference documents: drawing and client-delivery requirements

## Evidence reviewed

All four links resolved through their redirects. Canva metadata and all available rich text were read: 170 pages in total. Representative drawing and material-selection pages were visually inspected. This is not a claim that every raster drawing's individual dimension has been transcribed or verified.

| Reference | Pages | Main lessons |
|---|---:|---|
| [Ankur & Mansi sign-off](https://canva.link/zysiykz8mldiz0z) | 38 | Client/designer details, review signatures, floor plan, laminate selections by unit, appliance requirements, studio/client scope, rendered and drawn units, checklist. |
| [Greenage](https://canva.link/p55r150uwlgf79e) | 54 | Room/wall grouping, internal laminate and external finish distinction, separate base/wall/tall/loft depths, rafters/panelling, front and internal elevations beside a top view. |
| [Chandan & Ritika imported PDF](https://canva.link/nm7hqhkvrihfuw9) | 53 | Similar room-by-room structure but different specifications in places. A newer-looking document must not silently replace approved dimensions. |
| [Kitchen-focused sign-off](https://canva.link/8rbzbcl9lsxuipj) | 25 | Kitchen plan and laminate selection followed by wall A/B/C render and two drawing views, breakfast counter, store room and utility. |

The visually inspected Greenage shoe-rack sheet has a clear title band, top view, external elevation, internal elevation, red dimension chains and leaders, and explicit depth notes. The visually inspected finish board groups real supplier swatches beneath finish names and codes. These are more useful than one attractive room image without build details.

## Design-document structure

1. Project cover and exact saved revision.
2. Scope and supplied/client-supplied items, only when saved records exist.
3. Approved room floor plan with openings and furniture footprints.
4. Finish board: supplier code, finish and actual assigned use. An indicative colour is not a supplier texture sample.
5. For each room/wall: saved render, external elevation, internal elevation, component dimensions and material references.
6. Details/sections where supported by authored geometry, never invented joinery.
7. Review checklist and explicit sign-off fields. Blank fields are not approvals.
8. Production package generated separately after fabrication review.

## Implemented in this pass

- Client PDF includes saved room plan, selected-material colour board, module material-slot assignments, external/internal saved-component elevations and paginated component schedules.
- Printed schedules expose exact component width/depth/height, mounting elevation, part ID and finish code; these facts are no longer available only through SVG hover titles.
- Elevations show explicit overall width/height dimension lines alongside existing material legends.
- Drawing and finish pages use the selected saved revision; unrelated reference-project furniture, contacts, branding and finish choices are not copied into customer output.
- Review signature/date fields are blank, without fabricated sign-off.
- Preview and download remain the same private generated PDF.

## Important remaining work

- The saved scene material model has one material ID per part and broad module slots. It does not independently preserve substrate, inner laminate, outer laminate, balancing face and adhesive per physical face. Do not treat the carcass slot as proof of an internal-laminate specification. A face-specific production contract is needed before those reference-level finishes can be fully certified.
- Supplier swatch textures must be pinned to saved material versions with rights/provenance. Current PDF boards explicitly show colour chips; they do not download arbitrary images or manufacture texture imagery.
- Client-supplied appliances and studio/client scope need durable project records before auto-populating comparable scope pages.
- A project-wide document needs an explicit set of approved room revisions. The current endpoint documents one exact saved scene revision; it must not imply all rooms are included.
- Detailed sections, per-bay dimension chains and machining details need the corresponding authored components and joinery records. Overall dimension lines plus panel schedules do not certify missing joinery.
- The render section embeds existing completed saved images. This work improves delivery; it does not prove a hosted AI generation job succeeds.
- Hosted authenticated generation, browser preview/download, and output review remain release checks after deployment.

## Acceptance checks

- A scene with ten components produces two readable schedule sheets, not a truncated list.
- Only used material records appear; unresolved slot references remain explicit.
- Internal elevations remove front shutters without inventing shelves or drawers.
- Empty geometry does not create a fictional plan or moodboard.
- Rendered PDF pages open, keep landscape dimensions and do not contain unwanted automatic blank pages.
