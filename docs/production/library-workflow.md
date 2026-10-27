# ULTIDA Project-Scoped Library & Construction Workflow

## Overview

The ULTIDA Design Library supports both global browsing (`/library`) and project-scoped configuration (`/projects/:projectId/library`):

1. **Select Module**: Browse the 65 canonical modular entries (`ultida-catalog-2026.10.21`), including 54 cutlist-certified parametric templates, verified Ebco/Hettich/Blum hardware packages, Merino/Greenlam/CenturyPly/Royale Touche laminates, and IKEA India loose/modular retail items.
2. **Configure Exact Dimensions**: Edit width, depth, and height within the template's certified min/nominal/max construction envelope.
3. **Compiler-Backed Construction Preview**: `POST /api/catalog/modules/:moduleId/preview` compiles the exact carcass gables, shelves, shutters, drawer fronts, drawer boxes, and service rails, rejecting dimensions that violate the module envelope (`HTTP 422`).
4. **Place in Room**: Handoff preserves the selected template ID and exact custom dimensions in a project-scoped draft until persisted onto a measured wall in Spaces (`POST /api/projects/:projectId/module-instances`).
5. **Scene Compilation & Production Authority**: Once placed and saved on an approved floor plan, `POST /api/projects/:projectId/scenes/compile` generates `scene.v1` parts with surface recipes (`faceA` / `faceB`), scannable QR labels, core & laminate-face nesting layouts, and the project dossier.
