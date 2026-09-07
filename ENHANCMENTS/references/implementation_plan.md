# Implementation Plan: ULTIDA Executive Studio & Luxury UI/UX Redesign

Restructure ULTIDA's primary dashboard and workspace shell into an ultra-sellable, cohesive, luxury interior-design operating system ("Hybrid Studio": crisp neutral light mode with deep obsidian/champagne command accents, unified navigation, and 1-click interactive demo access).

## User Review Required

> [!IMPORTANT]
> - **Unified Dashboard Architecture**: We will elevate `StudioDashboard.tsx` to become the definitive unified executive dashboard (merging the best of `StudioDashboard` and `ProjectDashboard`). Visitors and designers will immediately see:
>   1. **Luxury Executive Hero**: Clean studio greeting, active portfolio metrics, and an instant **✨ Launch Demo (Sharma 3BHK Residence)** button.
>   2. **Interactive 5-Step AI Pipeline Navigator**: Interactive progress cards showing the core path (Floorplan Analyser $\rightarrow$ Stager $\rightarrow$ System 32 Walls $\rightarrow$ 3D Photoreal Renders $\rightarrow$ Production & Cutlists) with direct jump-in actions.
>   3. **Active Projects Gallery**: Responsive luxury cards with stage progress rings/dots, live timestamps, status chips, quick actions, and filter pills.
>   4. **Curated Design Vault & Quick Tools Drawer**: Sleek accordion or grid showcasing real production renders and System 32 elevation tools without cluttering the screen.
> - **Sidebar Hierarchy Polish**: Re-organize the 9 loose standalone tools into sleek collapsible groups (`AI Architecture`, `Production & CNC`, `Operations`) with refined hover states and champagne gold active indicators.

---

## Proposed Changes

### Web Workspace (`apps/web`)

#### [MODIFY] [StudioDashboard.tsx](file:///c:/Users/zebbr/OneDrive/Documents/ULTIDA/ULTIDA/apps/web/src/features/dashboard/StudioDashboard.tsx)
- Re-architect the dashboard to include:
  - **Instant 1-Click Interactive Demo Launcher**: Incorporate the Sharma Luxury Residence (3BHK) auto-provisioning logic so any client or designer can test the full pipeline in 1 click without setup.
  - **Cohesive Hybrid Studio Aesthetic**: Replace raw inline dark blocks with refined frosted glass, subtle micro-borders, clean typography, and seamless theme variables.
  - **Streamlined 5-Step Workflow Rail**: Make each step an interactive milestone displaying status, description, and direct launcher.
  - **Live Projects Portfolio with Search & Status Filters**: Allow switching between All, Draft, Designing, Client Review, and Approved directly on the dashboard.
  - **Quick-Access Parametric Tools Accordion/Grid**: Neatly group the elevation canvas, room builder, and CNC tools with micro-badges.

#### [MODIFY] [studio-dashboard.css](file:///c:/Users/zebbr/OneDrive/Documents/ULTIDA/ULTIDA/apps/web/src/features/dashboard/studio-dashboard.css)
- Re-style dashboard components with luxury modern design tokens:
  - Deep warm charcoal gradients with champagne gold highlights (`rgba(197, 156, 45, 0.15)`).
  - Modern card shadows (`0 4px 20px rgba(0,0,0,0.04)` to `0 12px 32px rgba(45,30,15,0.08)` on hover).
  - Clean responsive grid layout for desktop, tablet, and mobile with zero visual overflow.
  - Interactive hover transitions and glowing status pills.

#### [MODIFY] [Shell.tsx](file:///c:/Users/zebbr/OneDrive/Documents/ULTIDA/ULTIDA/apps/web/src/Shell.tsx)
- Clean up and polish the primary sidebar navigation:
  - Refine tool grouping headers with subtle collapsible toggles or compact icons.
  - Enhance active state indicators and brand mark styling with a subtle champagne glow.
  - Ensure command bar breadcrumbs and quick project actions look polished and minimal.

#### [MODIFY] [shell.css](file:///c:/Users/zebbr/OneDrive/Documents/ULTIDA/ULTIDA/apps/web/src/shell.css)
- Polish sidebar transitions, user avatar styling, command bar borders, and tooltips.

---

## Verification Plan

### Automated / Code Quality Verification
- Monorepo contracts and type checking: inspect all modified TypeScript files for type consistency with `@ultida/contracts` and `@ultida/layout-core`.
- Verify no broken route links or dangling handlers.

### Manual Verification Flow
1. **Initial Load**: Verify the unified Executive Studio Dashboard loads cleanly with luxury styling.
2. **Demo Click**: Click "✨ Launch Sample 3BHK Residence" $\rightarrow$ verify it provisions or navigates directly to the Sharma Luxury Residence with plan, rooms, and 3D preview.
3. **Pipeline Navigation**: Click through Steps 1–5 in the automated pipeline to verify they open the expected workspaces.
4. **Project Filters & Search**: Test search and status filter pills (All, Designing, Approved).
5. **Responsiveness**: Check desktop and mobile breakpoints for seamless reflow and zero layout overflow.
