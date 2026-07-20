# Supabase Live Validation

The hosted project `ichnyfuetcucxhxilnre` is connected and the required migrations are applied.

## Verified remotely

- Foundation migration exists.
- Security compatibility migration exists.
- Private `project-assets` Storage bucket exists.
- Foreign-key index migration exists.
- `organizations`, `organization_members`, `projects`, `project_assets`, `floor_plan_versions`, `scene_versions`, `jobs`, and `artifacts` exist with RLS enabled.
- Security advisor returns no lints.

## Run the user-flow check

1. Open `http://127.0.0.1:5174/`.
2. Select **Create project**.
3. Create an account or sign in.
4. Enter a studio name, project name, and client name.
5. Upload a PNG/JPEG/PDF/DXF/DWG plan.
6. Click **Run plan intake**.
7. Add at least one wall or room zone, calibrate a known length, and click **Approve reviewed plan**.
8. Add a valid kitchen or living module.
9. Open the hosted Supabase dashboard and inspect the project rows.

The browser cannot prove a user-owned row without a signed-in session. That is intentional: RLS blocks anonymous reads and writes. The app now reports the real error when authentication, Storage, or a policy blocks an action.

## Dashboard inspection

In Supabase Dashboard -> Table Editor, verify:

- `floor_plan_versions.status = approved`
- `floor_plan_versions.interpretation` contains the reviewed snapshot
- `scene_versions.floor_plan_version_id` points to the approved plan
- `scene_versions.scene.schema = scene.v1`
- previous `artifacts.status = stale` after a scene revision

In Storage -> `project-assets`, verify the uploaded file is inside the organization/project path and is not publicly accessible.
