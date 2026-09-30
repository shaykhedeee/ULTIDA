import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Structural guards for the Spaces placement experience.
 *
 * The catalog used to be a full-screen modal, which meant the user had to
 * close it to see the wall they were placing against. These tests lock in the
 * docked-rail contract and the live-fit drag flow so a future refactor cannot
 * quietly regress to a canvas-obscuring overlay or a drop that skips
 * reconciliation.
 */

const workspace = readFileSync(new URL('../src/features/spaces/SpacesWorkspace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/features/spaces/spaces.css', import.meta.url), 'utf8');
const library = readFileSync(new URL('../src/components/library/ReferenceLibraryWorkspace.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/Shell.tsx', import.meta.url), 'utf8');

test('the design library is a docked rail, not a canvas-obscuring modal', () => {
  assert.ok(!workspace.includes('design-library-drawer-backdrop'), 'the full-screen backdrop must not return');
  assert.ok(workspace.includes('design-library-rail'), 'the catalog must render as a docked rail');
  assert.ok(css.includes('.design-library-rail'), 'the rail needs its own styles');
  assert.ok(!css.includes('.design-library-drawer-backdrop'), 'backdrop styles must be removed');
});

test('the rail reserves layout width instead of covering the plan', () => {
  assert.ok(
    css.includes('.spaces-workspace--library-open'),
    'opening the library must reflow the workspace so the canvas stays visible',
  );
  assert.match(css, /\.spaces-workspace--library-open\s*\{[^}]*padding-right/, 'the rail width must be reserved');
});

test('catalog cards are draggable and arm a placement', () => {
  assert.ok(workspace.includes('onDragStart'), 'cards must start a drag');
  assert.ok(workspace.includes('setDraggingModule'), 'dragging must arm a module');
  assert.ok(workspace.includes('onDragEnd={cancelPlacementDrag}'), 'an abandoned drag must clear state');
});

test('the plan canvas accepts drops and previews them live', () => {
  assert.ok(workspace.includes('onDragOver'), 'the canvas must accept drag-over');
  assert.ok(workspace.includes('onDrop'), 'the canvas must accept drops');
  assert.ok(workspace.includes('updateDropPreview'), 'drag-move must refresh the ghost');
});

test('every drag-move re-runs the same reconciliation used at commit time', () => {
  const preview = workspace.slice(workspace.indexOf('function evaluateDropPreview'));
  assert.ok(
    preview.slice(0, 2600).includes('reconcileCatalogPlacement'),
    'the ghost must be validated by the real placement reconciler, not a heuristic',
  );
  assert.ok(
    workspace.includes('SNAP_DISTANCE_MM'),
    'drops far from any wall must be rejected rather than snapped to a distant wall',
  );
});

test('invalid drops report beside the cursor, not through the save banner', () => {
  assert.ok(workspace.includes('drop-reject-tip'), 'a cursor-anchored rejection tooltip must exist');
  assert.ok(css.includes('.drop-reject-tip'), 'the rejection tooltip needs styles');
  const commit = workspace.slice(workspace.indexOf('async function commitDropPlacement'));
  assert.ok(
    !commit.slice(0, 500).includes('setSaveState'),
    'a rejected drop must not surface as a top-of-screen save message',
  );
});

test('Escape cancels an armed placement', () => {
  assert.ok(workspace.includes("event.key === 'Escape'"), 'Escape must cancel placement');
  assert.ok(workspace.includes('cancelPlacementDrag'), 'a cancel path must exist');
});

test('placement still routes through the measured-wall API contract', () => {
  assert.ok(
    workspace.includes('placeCatalogModuleOnWall'),
    'placement must accept an explicit wall and offset',
  );
  assert.ok(
    workspace.includes('placeCatalogModuleOnSelectedWall'),
    'the existing wall-first click flow must keep working',
  );
  assert.ok(workspace.includes('module-instances'), 'the persistence contract must be unchanged');
  assert.ok(workspace.includes("setSpacePanel('modules')"), 'the panel auto-switch must be preserved');
});

test('Spaces keeps common room tasks visible and puts secondary tools behind More', () => {
  const tabsStart = workspace.indexOf('<div className="space-panel-tabs" role="tablist" aria-label="Room configuration">');
  const tabsEnd = workspace.indexOf("                {spacePanel === 'candidates' && (", tabsStart);
  const tabs = workspace.slice(tabsStart, tabsEnd);
  assert.match(tabs, /Layout/);
  assert.match(tabs, /Room/);
  assert.match(tabs, /Furniture/);
  assert.match(tabs, /Finishes/);
  assert.match(tabs, /'Less' : 'More'/);
  assert.ok(tabs.indexOf('More') < tabs.indexOf('Advice'), 'advice, brief, and 3D details should be secondary');
  assert.ok(!shell.includes('className={`workflow-stage'), 'project stages should not be duplicated in the sidebar and top guide');
});

test('project visual references can be imported, reloaded, and remain separate from catalog geometry', () => {
  assert.ok(workspace.includes('/library?projectId='), 'module rail should open the current project library');
  assert.ok(library.includes("searchParams.get('projectId')"), 'library should retain project context');
  assert.ok(library.includes('/references`'), 'library should fetch saved references after refresh');
  assert.ok(library.includes('This project’s images'), 'saved project images should be visible in the library');
  assert.ok(library.includes('never set dimensions or production geometry'), 'images must remain style references, not geometry');
});
