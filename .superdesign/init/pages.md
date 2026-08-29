# Page dependency trees

## `/` Studio dashboard
Entry: `apps/web/src/App.tsx`

- `apps/web/src/features/dashboard/StudioDashboard.tsx`
  - `apps/web/src/features/dashboard/studio-dashboard.css`
  - `apps/web/src/lib/supabase.ts`
- `apps/web/src/Shell.tsx`
  - `apps/web/src/shell.css`

## `/library` Design library
Entry: `apps/web/src/App.tsx`

- `apps/web/src/components/library/ReferenceLibraryWorkspace.tsx`
  - `apps/web/src/components/library/ModulePreview.tsx`
  - `apps/web/src/components/ui/primitives.tsx`
  - `apps/web/src/lib/supabase.ts`

## `/tools/cnc` CNC pattern studio
Entry: `apps/web/src/App.tsx`

- `apps/web/src/features/tools/CncPatternStudio.tsx`
  - `apps/web/src/features/tools/cnc-pattern-studio.css`
