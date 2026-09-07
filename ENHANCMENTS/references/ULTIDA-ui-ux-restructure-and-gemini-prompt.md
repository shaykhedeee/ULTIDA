# ULTIDA — UI/UX Restructure & Gemini Execution Prompt
2026-09-07. This one found the actual smoking gun for "too many buttons doing the same thing" — it's not a vague impression, it's three separate navigation surfaces pointing at the same nine destinations, with three different names each.

---

## 0. The exact duplication, with receipts

`StudioDashboard.tsx` currently renders **three separate button rows that all navigate to the same set of destinations**, verified by reading the actual `onClick` handlers:

**Row 1 — "Launchpad" quick actions (lines ~248-312):**
| Button | Destination | Label used |
|---|---|---|
| 🚀 System 32 Elevation Canvas | `/tools/modules` | emoji + slogan |
| 💎 SketchUp Ruby Generator | `/tools/skp` | emoji + slogan |
| 📚 Design Vault & Moodboard | `/library` | emoji + slogan |
| 📐 Measured Room Builder | `/tools/room-builder` | emoji + slogan |
| ✨ Interactive Hotspot BOM | `/tools/render` | emoji + slogan |
| ⚙️ CNC Pattern Studio | `/tools/cnc` | emoji + slogan |
| 📏 Unit Converter | `/tools/measurements` | emoji + slogan |
| 🤖 AURA Design Agent | `/tools/aura` | emoji + slogan |
| 📊 Studio Operations | `/tools/operations` | emoji + slogan |

**Row 2 — "Design tools" card grid (lines ~429-440), same page, further down:**
Same 9 destinations, again, this time with plain labels: "Modular unit planner," "SketchUp Studio" isn't there but "Room builder," "Render studio," "CNC pattern studio," "Measurement converter," "AURA design agent," plus **two extra buttons that dead-end into `/library` and `/projects` a second time each** ("Furniture catalogue" and "Moodboard library" both → `/library`; "Floor plan intelligence" and "Cutlist & production" both → `/projects`).

**Row 3 — the persistent sidebar (`Shell.tsx` `TOOL_NAV`), visible on every screen simultaneously:**
The same 9 destinations again, as "SketchUp Studio," "Room Builder," "Module Planner," "Render Studio," "CNC Patterns," "Measurements," "Calendar," "Invoices."

**Net result: a user looking at the dashboard sees the exact same 9 tools named 3 different ways in 3 different places at the same time**, plus the sidebar is *also* visible while they're looking at rows 1 and 2, so it's really the same button 3 times simultaneously on one screen. This is your literal complaint, confirmed in code, not a vague design smell.

Separately, two routes are also just aliases of each other with two different sidebar-adjacent entry points: `/tools/skp` and `/tools/sketchup-generator` both render `SketchupCodeStudio`; `/tools/measurements` and `/tools/converter` both render `MeasurementConverter`. Low priority compared to the dashboard issue, but worth collapsing to one canonical path each while you're in there.

**One thing already fixed, credit where due:** the sidebar tool grouping (`AI & Design Tools` / `Production & CNC` / `Studio Operations`) that I recommended two passes ago is already implemented in `Shell.tsx` — that part of the earlier plan is done. The problem now isn't the sidebar, it's that the dashboard duplicates the sidebar twice over with different names.

---

## 1. The fix: one destination, one name, one place — pick the *role* each surface plays

Don't delete functionality — collapse **presentation**, not routes. Each of the three surfaces should have a distinct job, and none of them should be a copy of another:

| Surface | Job | What goes here |
|---|---|---|
| **Sidebar (`TOOL_NAV`)** | Always-available utility drawer for power users who already know what they want | Keep as-is — it's already grouped well. This is the "I know exactly which tool I need" path. |
| **Dashboard hero + 5-step pipeline rail** (per your existing `implementation_plan.md`, already scoped) | The *guided* path for "what should I do next on this project" | Replaces both Row 1 and Row 2 entirely. No standalone tool grid. |
| **Project workspace itself** (`/spaces`, `/3d`, `/production`, etc.) | Where the actual work happens | Room Builder, Module Planner, Render Studio functionality lives *inside* the project flow (`/spaces?tab=modules`, `/3d?tab=render`), not as separate global tools competing with it |

Concretely, delete Row 1 ("Launchpad") entirely and delete Row 2's redundant entries. What the dashboard should show instead, per your own `implementation_plan.md` (which already specifies this correctly, it just hasn't been built yet): the luxury hero with the 1-click demo, the 5-step pipeline navigator, the active-projects gallery, and *one* small "Quick tools" section containing only things that are **genuinely global and don't belong to any single project** — Measurement Converter, CNC Pattern reference library, Studio Calendar/Invoices. That's it. Three items, not nine, and none of them duplicate a project-workflow step.

**The harder call: are standalone Room Builder / Module Planner / Render Studio worth keeping at all?** Per your own backlog (W02.6, still open): *"Make standalone room/module/render/CNC/measurement tools attach to a selected project and reuse authoritative commands; label untethered sketches as drafts."* Two honest options:
- **(A) Recommended:** Fold them away as separate nav destinations. When someone clicks "Rooms & Modules" in the project workflow, that *is* the room builder and module planner — there's no separate global version to maintain or explain.
- **(B) If you want a true "sandbox before you have a project" mode:** Keep exactly one entry point, clearly labeled "Sandbox / Draft (not attached to a project)," and make it visually distinct (different background tint, a persistent banner) so it can never be mistaken for the authoritative in-project version.

Don't do both — right now you're doing a confusing middle ground where the standalone versions exist, aren't labeled as drafts, and are advertised in three places as if they were the main way to do the work.

---

## 2. SpacesWorkspace.tsx (3,606 lines) — specific enhancement, not just decluttering

Beyond the toolbar/CSS/room-card fixes already scoped in the earlier plan, given today's finding, add:
- **Remove any internal shortcut buttons inside `SpacesWorkspace.tsx` that duplicate the dashboard's now-deleted Row 1/Row 2** (e.g. if there's a "Open Module Planner" button inside the Spaces screen that navigates out to `/tools/modules` instead of just switching to the modules tab in-place, that's the same disease at a smaller scale — fix it the same way: one tab switch, not a navigation to a separate tool).
- **Modular composition editing (the bay editor) belongs here, front and center**, not off in `ModularCabinetBuilder.tsx` or `ModularUnitPlanner.tsx` as separate experiences. Once the bay-reconciliation compiler pass from the earlier plan exists, its UI (bay widths, fillers, keep-out visualization) should be a tab/panel inside `SpacesWorkspace.tsx`'s module configuration, using the same inspector pattern as the rest of the room workspace — not a fourth place someone has to learn.
- **Audit `ModularCabinetBuilder.tsx` (527 lines) and `ModularUnitPlanner.tsx` (363 lines) for overlap with each other and with Spaces.** Three files with "modular"/"module" in the name that aren't the same component is worth 15 minutes of Codex's time to map: which one is the real one, which are legacy, which should be deleted or merged. This is very likely the same duplication pattern as the dashboard, just at the component level instead of the navigation level.

---

## 3. Full detailed prompt for Gemini

Copy this directly:

> **Context:** ULTIDA is a professional interior-design and manufacturing platform (React + TypeScript + Vite, Three.js, Supabase, Vercel). The visual language should read as a luxury architectural studio tool — think a high-end CAD/BIM product crossed with a premium SaaS dashboard, not a generic admin template. Reference feel: crisp neutral light mode, deep obsidian and champagne-gold command accents, restrained typography, generous whitespace, subtle depth via shadow rather than heavy borders.
>
> **The core problem to fix:** the dashboard currently shows the same 9 tools in 3 different places with 3 different naming conventions (one row uses emoji + marketing slogans like "🚀 System 32 Elevation Canvas," another uses plain labels like "Modular unit planner," and the persistent sidebar has a third set of labels like "Module Planner" — all pointing to the same destinations). This reads as unfinished and confuses users about which button is the "real" one. Your job is to collapse this into one coherent hierarchy.
>
> **Do this, in order:**
>
> 1. **Delete the "Launchpad" quick-actions row** in `StudioDashboard.tsx` (the section with emoji-prefixed buttons like "🚀 System 32 Elevation Canvas," "💎 SketchUp Ruby Generator," etc.) entirely.
> 2. **In the "Design tools" card grid further down the same file, remove duplicate destinations** — currently "Floor plan intelligence" and "Cutlist & production" both navigate to `/projects`; "Furniture catalogue" and "Moodboard library" both navigate to `/library`. Each destination should appear as exactly one card, with one clear name and one clear purpose statement, not two competing framings of the same link.
> 3. **Build the executive dashboard hero + 5-step pipeline navigator specified in `implementation_plan.md`** to replace what those two deleted/trimmed rows used to do: a luxury greeting, portfolio metrics, a single "✨ Launch Demo" button, and an interactive 5-step rail (Floorplan Analyser → Stager → System 32 Walls → 3D Photoreal Renders → Production & Cutlists) with direct jump-in actions per step. This becomes the *guided* path; it should feel like the primary hero of the page, not a small addition.
> 4. **Reduce the surviving "Quick tools" section to exactly 3 items**: Measurement Converter, CNC Pattern reference, Studio Calendar/Invoices — the genuinely global utilities that don't belong to any single project. Nothing else goes here. If you're tempted to add a 4th, stop and ask whether it actually belongs inside the project workflow instead.
> 5. **Leave the sidebar (`Shell.tsx` `TOOL_NAV` groups) as-is** — it's already correctly grouped into "AI & Design Tools," "Production & CNC," "Studio Operations." Do not add new items there to compensate for what you removed from the dashboard; the point is fewer total surfaces, not moving the duplication around.
> 6. **Apply the luxury visual tokens from `implementation_plan.md`** throughout: champagne gold highlights at `rgba(197, 156, 45, 0.15)`, card shadows from `0 4px 20px rgba(0,0,0,0.04)` resting to `0 12px 32px rgba(45,30,15,0.08)` on hover, deep warm charcoal gradients where dark surfaces are used. Typography should be clean and confident — avoid emoji in UI copy anywhere in this pass (the "🚀"/"💎"/"✨" prefixes you're removing are a symptom of the same "trying too hard" problem as the duplication itself).
> 7. **`SpacesWorkspace.tsx` (large file, edit in isolated sections, not one rewrite):**
>    - Fix `.wall-elevation-preview svg` height from a fixed `145px` to a responsive `clamp(180px, 22vw, 320px)` — the SVG now renders more detail than the old fixed box allows.
>    - Remove the redundant wall-count/opening-count text on room cards — it's already shown in the readiness checklist elsewhere on the same card.
>    - Group the workspace's own toolbar using the same three-category taxonomy as the sidebar (`AI Architecture` / `Production & CNC` / `Operations`), so a user moving between the sidebar and the in-workspace toolbar sees one consistent mental model, not two different groupings of the same kind of tools.
>    - If you find any button inside this file that navigates *away* to a standalone tool route (e.g. `/tools/modules`) instead of switching to an in-place tab, flag it — don't silently leave it, since that's the same duplication problem at a smaller scale.
> 8. **Before finishing, take a screenshot (or describe layout) at 1440px, 1024px, and 390px widths** and confirm nothing overflows or collapses awkwardly — this app needs to work on tablet and phone per its own UX spec, not just desktop.
>
> **What NOT to do:** don't touch anything under `packages/` — you own `apps/web` only. Don't delete the underlying route/component for Room Builder, Module Planner, or Render Studio (`RoomBuilder.tsx`, `ModularUnitPlanner.tsx`, `RenderLauncher.tsx`) — only remove the *duplicate dashboard entry points* to them; the routes and sidebar links stay, since they're the sole (correct) presentation of those tools. Don't invent new navigation destinations that don't already exist in `App.tsx`'s route list.
>
> **Verify before calling it done:** run `npm run build --workspace=@ultida/web` and confirm it's clean. Then manually click through: dashboard → each surviving dashboard element → confirm no destination appears more than once anywhere the user can see it on one screen.

---

## 4. Where this fits in the roadmap

This is Phase 7 (Navigation unification / declutter) from the consolidated roadmap, pulled forward slightly because it's now well-specified and low-risk relative to the backend phases still ahead of it (bay reconciliation, flooring, module certification). It's safe to let Gemini start this now, in parallel with Codex's backend work, since it touches `apps/web` only and doesn't depend on any of the unfinished contract/compiler work — just don't let it block on or get blocked by Codex's `packages/` changes.
