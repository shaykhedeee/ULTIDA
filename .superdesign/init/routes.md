# Routes

`apps/web/src/App.tsx` owns the React Router route map.

| Route | Screen |
| --- | --- |
| `/` | `StudioDashboard` |
| `/projects` | project portfolio dashboard |
| `/library` | `ReferenceLibraryWorkspace` |
| `/tools/cnc` | `CncPatternStudio` |
| `/rules` | studio company rules |
| `/team` | team administration |
| `/settings` | studio settings |
| `/projects/:projectId/:stage` | project workflow workspaces |

The root dashboard is a studio command centre and project flow remains scene-first inside a selected project.
