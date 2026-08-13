import { ArrowRight, Check, FileText, Image, Layers3, Loader2, Palette, Plus, RefreshCw, Send, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';
import MaterialSwapPanel from './MaterialSwapPanel';
import './visual-studio.css';
import { ModulePreview } from '../library/ModulePreview';

type Stage = 'Design' | 'Visualize' | 'Document';
type Module = { id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number; wallId?: string; offsetMm?: number; xMm?: number; yMm?: number; rotationDeg?: number; configuration?: ModuleConfiguration };
type CatalogItem = { id: string; family: string; name: string; widthMm: number; depthMm: number; heightMm: number; tags: string[]; description?: string; manufacturingRules?: string[] };
type PreparedModulePlan = { schema: 'ultida.module-plan.v1'; templateId: string; family: string; name: string; dimensionsMm: { width: number; depth: number; height: number }; wallWidthMm: number; clearanceMm: number };
type DesignPreset = { id: string; name: string; family: string; roomTypes: string[]; referenceStyle: string[]; renderRules: string[]; productionRules: string[] };
type ModuleConfiguration = { archetype: string; shutterStyle: 'swing' | 'sliding' | 'profile-glass' | 'open'; drawerCount: number; shutterCount?: number; includeLoft: boolean; glassProfile: boolean; handleStyle: 'gola' | 'long-profile' | 'knob' | 'none'; lighting: 'none' | 'shelf-led' | 'vertical-led' };
type Provider = { id: string; configured: boolean; operations: string[] };
type StoredRender = { id: string; scene_version_id: string; status: string; stale?: boolean; signedUrl: string | null; created_at: string; provenance?: { provider?: string; model?: string; promptVersion?: string; reviewStatus?: string } };
type DesignFocus = 'all' | 'modules' | 'materials';
type Props = { stage: Stage; focus?: DesignFocus; projectId: string | null; planApproved: boolean; briefComplete: boolean; sceneVersionId: string | null; sceneApproved: boolean; modules: Module[]; materials: any[]; onSceneCreated: (id: string, modules: Module[], materials: any[]) => Promise<string | void>; onSceneApproved: (sceneVersionId?: string) => Promise<boolean> };
const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';

function roundToModuleIncrement(valueMm: number, incrementMm = 50) {
  return Math.round(valueMm / incrementMm) * incrementMm;
}

function fitModuleToMeasuredWall(item: CatalogItem, wallLengthMm: number) {
  const adaptiveFamily = item.family === 'tv-unit' || item.family === 'crockery';
  if (!adaptiveFamily || !Number.isFinite(wallLengthMm) || wallLengthMm <= 0) {
    return { widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, adapted: false };
  }
  const minWidthMm = item.family === 'tv-unit' ? 1200 : 900;
  const safeWallWidthMm = roundToModuleIncrement(Math.max(0, wallLengthMm - 200));
  if (safeWallWidthMm < minWidthMm) return null;
  const isWallComposition = /wall|full|asymmetric|profile|crockery|display|bar|panel/i.test(`${item.name} ${item.tags.join(' ')}`);
  const targetWidthMm = isWallComposition ? safeWallWidthMm : Math.min(item.widthMm, safeWallWidthMm);
  const maxWidthMm = item.family === 'tv-unit' ? 4200 : 3600;
  const widthMm = Math.min(maxWidthMm, Math.max(minWidthMm, targetWidthMm));
  return { widthMm, depthMm: item.depthMm, heightMm: item.heightMm, adapted: widthMm !== item.widthMm };
}

export function DesignFlowWorkspace({ stage, focus = 'all', projectId, planApproved, briefComplete, sceneVersionId, sceneApproved, modules, materials, onSceneCreated, onSceneApproved }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSpaceId = searchParams.get('spaceId');
  const pendingModuleRequested = searchParams.get('pendingModule') === '1';
  const [room, setRoom] = useState('kitchen');
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string; roomType: string }>>([]);
  const [walls, setWalls] = useState<Array<{ id: string; start?: { xMm: number; yMm: number }; end?: { xMm: number; yMm: number } }>>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [moduleConfiguration, setModuleConfiguration] = useState<ModuleConfiguration>({ archetype: 'full_wall_storage', shutterStyle: 'swing', drawerCount: 0, includeLoft: false, glassProfile: false, handleStyle: 'long-profile', lighting: 'none' });
  const [draftModules, setDraftModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [designMode, setDesignMode] = useState<'layout' | 'moodboard'>(focus === 'materials' ? 'moodboard' : 'layout');
  const [visualState, setVisualState] = useState('No visual proposal requested');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [drawingState, setDrawingState] = useState('Generate drawing package');
  const [dxfState, setDxfState] = useState('Export DXF');
  const [cutlistState, setCutlistState] = useState('Generate cutlist');
  const [elevationState, setElevationState] = useState('Export elevations');
  const [pdfState, setPdfState] = useState('Export PDF');
  const [placementNotice, setPlacementNotice] = useState('Placement rules are checked before a module enters the scene.');
  const [renders, setRenders] = useState<StoredRender[]>([]);
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);
  const [activeVisualJobId, setActiveVisualJobId] = useState<string | null>(null);
  const [reviewVisualJobId, setReviewVisualJobId] = useState<string | null>(null);
  const [visualBusy, setVisualBusy] = useState(false);
  const [compiledSceneId, setCompiledSceneId] = useState<string | null>(sceneVersionId);
  const [materialLibrary, setMaterialLibrary] = useState<any[]>([]);
  const [materialAssignmentsSaved, setMaterialAssignmentsSaved] = useState(materials.length > 0);
  const [starterMaterialsState, setStarterMaterialsState] = useState('');

  useEffect(() => { setCompiledSceneId(sceneVersionId); }, [sceneVersionId]);

  // The project routes have distinct jobs, but both update the same draft scene.
  // Enter the task-specific tab when following a workflow action without losing
  // any persisted placement or material data.
  useEffect(() => {
    if (focus === 'modules') setDesignMode('layout');
    if (focus === 'materials') setDesignMode('moodboard');
  }, [focus]);

  // Moodboard States
  const [stylePresets, setStylePresets] = useState<DesignPreset[]>([]);
  const [activeTheme, setActiveTheme] = useState('');
  const [activeLaminate, setActiveLaminate] = useState('');
  const [activeHardware, setActiveHardware] = useState('');
  // Library materials must be available before scene.v1 exists. Scene-only
  // materials made the first assignment impossible, even though compilation
  // correctly requires persisted assignments.
  const availableMaterials = materialLibrary.length ? materialLibrary : materials;
  const catalogLaminates = availableMaterials.filter((item: any) => ['laminate', 'veneer', 'acrylic', 'stone', 'countertop'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), hex: String(item.metadata?.hex ?? '#d6c7b8'), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  const catalogHardwares = availableMaterials.filter((item: any) => ['hardware', 'handle', 'profile', 'glass'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  
  const selectedThemeObj = stylePresets.find((preset) => preset.id === activeTheme) ?? stylePresets[0];
  const selectedLaminateObj = catalogLaminates.find((l) => l.id === activeLaminate) ?? catalogLaminates[0] ?? { id: '', name: 'No laminate selected', code: '', hex: '#d6c7b8', unitCost: 0 };
  const selectedHardwareObj = catalogHardwares.find((h) => h.id === activeHardware) ?? catalogHardwares[0] ?? { id: '', name: 'No hardware selected', code: '', unitCost: 0 };
  const selectedModule = draftModules.find((module) => module.id === selectedModuleId) ?? draftModules[0] ?? null;
  
  const compiledStylePrompt = `${selectedThemeObj ? [...selectedThemeObj.referenceStyle, ...selectedThemeObj.renderRules].join('. ') : 'Approved project style'} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`;
  const [style, setStyle] = useState(compiledStylePrompt);
  const [quality, setQuality] = useState<'draft' | 'review' | 'final'>('review');

  useEffect(() => {
    setStyle(`${selectedThemeObj ? [...selectedThemeObj.referenceStyle, ...selectedThemeObj.renderRules].join('. ') : 'Approved project style'} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`);
    if (!activeLaminate && catalogLaminates[0]) setActiveLaminate(catalogLaminates[0].id);
    if (!activeHardware && catalogHardwares[0]) setActiveHardware(catalogHardwares[0].id);
  }, [activeTheme, activeLaminate, activeHardware, materials, stylePresets]);

  async function authenticatedHeaders() {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function loadRenders() {
    if (!projectId) return;
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { headers: await authenticatedHeaders() });
      const payload = await response.json();
      const next: StoredRender[] = response.ok && Array.isArray(payload.renders) ? payload.renders : [];
      setRenders(next);
      setSelectedRenderId((current) => current && next.some((render) => render.id === current) ? current : next[0]?.id ?? null);
    } catch {
      setRenders([]);
      setSelectedRenderId(null);
    }
  }

  useEffect(() => {
    if (stage !== 'Visualize') return;
    fetch(`${apiBase}/providers`)
      .then((response) => response.json())
      .then((payload) => setProviders(Array.isArray(payload.providers) ? payload.providers : []))
      .catch(() => setProviders([]));
    void loadRenders();
  }, [stage, projectId]);

  // A render selected from the persisted gallery must remain reviewable after
  // refresh. Previously only a newly-created job populated reviewVisualJobId,
  // which made Approve/Reject appear disabled for an existing output.
  useEffect(() => {
    const selected = renders.find((render) => render.id === selectedRenderId) ?? renders[0];
    if (selected) setReviewVisualJobId(selected.id);
  }, [renders, selectedRenderId]);

  useEffect(() => {
    if (!projectId || !planApproved) { setMaterialLibrary([]); return; }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/material-library`, { headers: await authenticatedHeaders() });
        const payload = await response.json().catch(() => null);
        setMaterialLibrary(response.ok && Array.isArray(payload?.materials) ? payload.materials : []);
      } catch {
        setMaterialLibrary([]);
      }
    })();
  }, [projectId, planApproved]);

  async function addStarterMaterials() {
    if (!projectId) return;
    setStarterMaterialsState('Adding curated starter materials...');
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/material-library/starter`, { method: 'POST', headers: await authenticatedHeaders() });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.materials)) {
        setStarterMaterialsState(payload?.message ?? 'Starter materials could not be added.');
        return;
      }
      setMaterialLibrary(payload.materials);
      setStarterMaterialsState(`Starter material library ready (${payload.materials.length} items). Confirm supplier SKUs before production.`);
    } catch {
      setStarterMaterialsState('Starter material service is unavailable.');
    }
  }

  useEffect(() => {
    if (!projectId || !planApproved) return;
    void (async () => {
      try {
        const headers = await authenticatedHeaders();
        const [spaceResponse, planResponse] = await Promise.all([
          fetch(`${apiBase}/projects/${projectId}/spaces`, { headers }),
          fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers }),
        ]);
        const spacePayload = await spaceResponse.json();
        const planPayload = await planResponse.json();
        // `/spaces` returns database rows (`room_type`), while this workspace
        // uses the UI contract (`roomType`). Normalize at this boundary so
        // catalogue filtering, wall placement, and rendering share one room.
        const nextSpaces = Array.isArray(spacePayload.spaces)
          ? spacePayload.spaces.map((space: any) => ({
              ...space,
              id: String(space.id),
              name: String(space.name ?? space.room_type ?? space.id),
              roomType: String(space.roomType ?? space.room_type ?? 'other'),
            }))
          : [];
        const nextWalls = Array.isArray(planPayload.walls) ? planPayload.walls : [];
        setSpaces(nextSpaces);
        setWalls(nextWalls);
        const nextSpace = requestedSpaceId && nextSpaces.some((space: any) => space.id === requestedSpaceId)
          ? nextSpaces.find((space: any) => space.id === requestedSpaceId)
          : nextSpaces.find((space: any) => space.id === spaceId) ?? nextSpaces[0];
        setSpaceId(nextSpace?.id ?? null);
        setWallId((current) => current ?? nextWalls[0]?.id ?? null);
        if (nextSpace?.roomType) setRoom(nextSpace.roomType);
      } catch {
        setSpaces([]); setWalls([]); setSpaceId(null); setWallId(null);
      }
    })();
  }, [projectId, planApproved, requestedSpaceId]);

  useEffect(() => {
    if (!planApproved) {
      setCatalogItems([]);
      setCatalogLoading(false);
      return;
    }
    void (async () => {
      setCatalogLoading(true);
      try {
        const response = await fetch(`${apiBase}/catalog/modules?room=${encodeURIComponent(room)}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        setCatalogItems(response.ok && Array.isArray(payload.modules) ? payload.modules : []);
      } catch {
        setCatalogItems([]);
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, [room, planApproved]);

  useEffect(() => {
    if (!pendingModuleRequested || !planApproved || !catalogItems.length) return;
    let prepared: PreparedModulePlan | null = null;
    try {
      const raw = window.localStorage.getItem('ultida.pendingModulePlan.v1');
      prepared = raw ? JSON.parse(raw) as PreparedModulePlan : null;
    } catch {
      window.localStorage.removeItem('ultida.pendingModulePlan.v1');
    }
    if (!prepared || prepared.schema !== 'ultida.module-plan.v1') {
      setPlacementNotice('The prepared module was not found. Choose a catalogue module to continue.');
      return;
    }
    const item = catalogItems.find((candidate) => candidate.id === prepared?.templateId);
    if (!item) {
      setPlacementNotice(`${prepared.name} is not compatible with the selected room. Choose a matching room or template.`);
      return;
    }
    setFamilyFilter(item.family);
    setCatalogQuery(item.name);
    setModuleConfiguration((current) => ({ ...current, shutterCount: ['tv-unit', 'crockery'].includes(item.family) ? Math.max(2, Math.round(prepared!.dimensionsMm.width / 450)) : current.shutterCount }));
    setPlacementNotice(`${prepared.name} is prepared at ${prepared.dimensionsMm.width} × ${prepared.dimensionsMm.depth} × ${prepared.dimensionsMm.height} mm. Select a verified wall, then place it to persist the module.`);
  }, [pendingModuleRequested, planApproved, catalogItems]);

  useEffect(() => {
    if (!planApproved) {
      setStylePresets([]);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/catalog/presets?room=${encodeURIComponent(room)}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        const next = response.ok && Array.isArray(payload.presets) ? payload.presets : [];
        setStylePresets(next);
        setActiveTheme((current) => next.some((preset: DesignPreset) => preset.id === current) ? current : next[0]?.id ?? '');
      } catch {
        setStylePresets([]);
      }
    })();
  }, [room, planApproved]);

  useEffect(() => {
    if (!projectId || !planApproved) return;
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.modules)) return;
        setDraftModules(payload.modules.map((saved: any) => {
          const config = saved.config_json ?? {};
          const position = saved.position_json ?? {};
          return { id: saved.id, roomId: saved.space_id, family: config.family ?? saved.category, label: saved.label, widthMm: Number(config.widthMm), depthMm: Number(config.depthMm), heightMm: Number(config.heightMm), wallId: position.wallId, offsetMm: position.offsetMm, xMm: position.xMm, yMm: position.yMm, rotationDeg: position.rotationDeg, configuration: config.configuration };
        }).filter((item: Module) => Number.isFinite(item.widthMm) && Number.isFinite(item.depthMm) && Number.isFinite(item.heightMm)));
      } catch {
        setDraftModules([]);
      }
    })();
  }, [projectId, planApproved]);

  useEffect(() => {
    if (!activeVisualJobId || !projectId) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/renders/${activeVisualJobId}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        const latest = payload.result;
        const status = latest?.status;
        if (!response.ok) {
          setVisualState(payload.message ?? 'Render status could not be read.'); setVisualBusy(false); setActiveVisualJobId(null);
        } else if (status === 'succeeded' && latest?.signedUrl) {
          setVisualState('Render stored privately and ready for review.'); setVisualBusy(false); setActiveVisualJobId(null); await loadRenders();
        } else if (status === 'failed') {
          setVisualState(latest?.reason ?? latest?.error ?? 'Render generation failed. No image was stored.'); setVisualBusy(false); setActiveVisualJobId(null);
        } else setVisualState(status === 'running' ? 'Rendering in progress...' : 'Render queued...');
      } catch { setVisualState('Render status is temporarily unavailable.'); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeVisualJobId, projectId]);

  useEffect(() => {
    setSelectedModuleId((current) => current && draftModules.some((module) => module.id === current) ? current : draftModules[0]?.id ?? null);
  }, [draftModules]);

  async function addModule(item: CatalogItem, preparedDimensions?: PreparedModulePlan['dimensionsMm']) {
    if (!briefComplete) { setPlacementNotice('Complete and save the client brief before creating a scene.'); return; }
    if (!planApproved) { setPlacementNotice('Approve the reviewed floor plan before creating a scene.'); return; }
    if (!spaceId || !wallId) { setPlacementNotice('Select a verified room and wall before placing a module.'); return; }
    const anchorWall = walls.find((wall) => wall.id === wallId);
    if (!anchorWall?.start) { setPlacementNotice('The selected wall has no canonical coordinates.'); return; }
    const wallLengthMm = anchorWall.end
      ? Math.hypot(anchorWall.end.xMm - anchorWall.start.xMm, anchorWall.end.yMm - anchorWall.start.yMm)
      : 0;
    const requestedItem = preparedDimensions ? { ...item, widthMm: preparedDimensions.width, depthMm: preparedDimensions.depth, heightMm: preparedDimensions.height } : item;
    const fitted = fitModuleToMeasuredWall(requestedItem, wallLengthMm);
    if (!fitted) {
      setPlacementNotice(`${item.name} needs at least ${item.family === 'tv-unit' ? 1200 : 900} mm of clear wall after end fillers; choose a wider wall or a smaller module family.`);
      return;
    }
    const offsetMm = Math.max(0, Math.round((wallLengthMm - fitted.widthMm) / 2));
    setPlacementNotice('Checking room compatibility and circulation...');
    try {
      const response = await fetch(`${apiBase}/catalog/validate-placement`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ moduleId: item.id, roomType: room, clearanceMm: room === 'living' ? 800 : 1200 }) });
      const result = await response.json();
      if (!response.ok || !result.valid) { setPlacementNotice(result.issues?.join(' ') ?? 'This module cannot be placed here.'); return; }
      const adaptiveShutterCount = ['tv-unit', 'crockery'].includes(item.family) ? Math.max(2, Math.round(fitted.widthMm / 450)) : undefined;
      const moduleResponse = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ spaceId, templateId: item.id, category: item.family, label: item.name, config: { family: item.family, widthMm: fitted.widthMm, depthMm: fitted.depthMm, heightMm: fitted.heightMm, templateWidthMm: item.widthMm, tags: item.tags, manufacturingRules: item.manufacturingRules ?? [], parameters: { family: moduleConfiguration.archetype, archetype: moduleConfiguration.archetype, overheadStorage: moduleConfiguration.includeLoft, includeLoft: moduleConfiguration.includeLoft, profileGlassOption: moduleConfiguration.glassProfile, shelfOption: true, lighting: moduleConfiguration.lighting === 'none' ? 'none' : 'profile_led', drawerCount: moduleConfiguration.drawerCount, shutterCount: adaptiveShutterCount, handleStyle: moduleConfiguration.handleStyle }, configuration: { ...moduleConfiguration, shutterCount: adaptiveShutterCount, source: fitted.adapted ? 'wall-fit' : 'catalog' } }, position: { wallId, offsetMm } }) });
      const modulePayload = await moduleResponse.json();
      if (!moduleResponse.ok || !modulePayload.module) { setPlacementNotice(modulePayload.message ?? 'Module anchor could not be saved.'); return; }
      const saved = modulePayload.module;
      const resolved = saved.position_json ?? {};
      const next = { id: saved.id, roomId: spaceId, family: item.family, label: item.name, widthMm: fitted.widthMm, depthMm: fitted.depthMm, heightMm: fitted.heightMm, wallId: resolved.wallId, offsetMm: resolved.offsetMm, xMm: resolved.xMm, yMm: resolved.yMm, rotationDeg: resolved.rotationDeg, configuration: { ...moduleConfiguration, shutterCount: adaptiveShutterCount } };
      setDraftModules((current) => current.some((module) => module.id === next.id) ? current : [...current, next]);
      if (pendingModuleRequested) window.localStorage.removeItem('ultida.pendingModulePlan.v1');
      setSelectedModuleId(next.id);
      setPlacementNotice(`${item.name} was saved at ${Math.round(offsetMm)} mm along the verified wall${fitted.adapted ? ` and fitted to ${fitted.widthMm} mm of usable wall` : ''}. Select it to assign materials or make a targeted render revision.`);
    } catch { setPlacementNotice('Placement validator unavailable. The module was not added.'); }
  }

  async function saveMoodboard(): Promise<boolean> {
    if (!projectId) { setPlacementNotice('Select a project before saving the moodboard.'); return false; }
    if (!briefComplete || !planApproved) { setPlacementNotice('Save the brief and approve the floor plan before saving materials.'); return false; }
    if (!selectedLaminateObj.id && !selectedHardwareObj.id) {
      setPlacementNotice('Choose a material from the organization library before saving the moodboard.');
      return false;
    }
    setPlacementNotice('Saving versioned material assignments...');
    try {
      const headers = await authenticatedHeaders();
      if (!selectedModule) {
        setPlacementNotice('Place and select one module before assigning materials.');
        return false;
      }
      const assignments = [
        selectedLaminateObj.id ? { materialId: selectedLaminateObj.id, semanticSlot: 'shutter', targetId: selectedModule.id } : null,
        selectedHardwareObj.id ? { materialId: selectedHardwareObj.id, semanticSlot: 'hardware', targetId: selectedModule.id } : null,
      ].filter(Boolean) as Array<{ materialId: string; semanticSlot: 'shutter' | 'hardware'; targetId: string }>;
      const results = await Promise.all(assignments.map((assignment) => fetch(`${apiBase}/projects/${projectId}/material-assignments`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...assignment, targetKind: 'module', moduleInstanceId: selectedModule.id, status: 'draft' }),
      }).then(async (response) => ({ response, payload: await response.json() }))));
      const failed = results.find(({ response, payload }) => !response.ok || !payload.success);
      if (failed) { setPlacementNotice(failed.payload.message ?? 'A material assignment could not be saved.'); return false; }
      if (selectedThemeObj) {
        const preference = await fetch(`${apiBase}/projects/${projectId}/design-preferences`, {
          method: 'PUT', headers,
          body: JSON.stringify({ stylePresetId: selectedThemeObj.id, styleText: selectedThemeObj.name }),
        });
        const preferencePayload = await preference.json();
        if (!preference.ok || !preferencePayload.success) { setPlacementNotice(preferencePayload.message ?? 'Project style preference could not be saved.'); return false; }
      }
      setMaterialAssignmentsSaved(true);
      setPlacementNotice(`${selectedModule.label} now has ${assignments.length} versioned material assignment${assignments.length === 1 ? '' : 's'}.`);
      return true;
    } catch {
      setPlacementNotice('Material assignment service unavailable. No moodboard changes were applied.');
      return false;
    }
  }

  async function compileMoodboard(materialSelection?: any[], assignmentVerified = materialAssignmentsSaved) {
    if (!projectId || !draftModules.length) { setPlacementNotice('Place at least one persisted module before compiling a scene.'); return; }
    const sceneMaterials = materialSelection ?? [selectedLaminateObj, selectedHardwareObj].filter((item) => item.id);
    if (!sceneMaterials.length) { setPlacementNotice('Save a real material-library selection before compiling a scene.'); return; }
    if (!assignmentVerified) { setPlacementNotice('Save the selected component materials before compiling scene.v1.'); return; }
    setPlacementNotice('Compiling the reviewed moodboard into scene.v1...');
    try {
      const nextSceneId = await onSceneCreated(crypto.randomUUID(), draftModules, sceneMaterials);
      if (nextSceneId) setCompiledSceneId(nextSceneId);
      setPlacementNotice('Scene compiled from persisted room anchors, module dimensions, and library materials.');
      return nextSceneId;
    } catch {
      setPlacementNotice('Scene compilation failed. The moodboard remains saved for correction.');
      return undefined;
    }
  }

  async function createVisual(operation: 'generate' | 'material-swap' = 'generate', materialName?: string, sceneVersionOverride?: string, sceneIsApproved = sceneApproved, materialTarget?: { materialId: string; semanticSlot: string }) {
    const renderSceneVersionId = sceneVersionOverride ?? compiledSceneId ?? sceneVersionId;
    if (!renderSceneVersionId) { setVisualState('Create and save a scene first.'); return; }
    if (!sceneIsApproved) { setVisualState('Approve the source scene before generating a scene-linked render or laminate revision.'); return; }
    if (!projectId) { setVisualState('Select a project before generating a render.'); return; }
    setVisualBusy(true); setVisualState(operation === 'material-swap' ? 'Saving the selected laminate and preparing its scene-locked preview...' : 'Validating scene and visual providers...');
    try {
      const renderStyle = materialName ? `${style}; apply ${materialName} only to the selected shutter/material region` : style;
      // A normal room render follows the room selected in Visual Studio. A
      // material swap is intentionally narrower and follows the selected
      // module, because its source mask is bound to that module in scene.v1.
      const renderRoomId = operation === 'material-swap' ? selectedModule?.roomId ?? null : spaceId ?? null;
      if (!renderRoomId) { setVisualBusy(false); setVisualState('Select a persisted room before generating a render.'); return; }
      if (operation === 'material-swap' && !selectedModule) { setVisualBusy(false); setVisualState('Select the exact module whose material should change before creating a revision.'); return; }
      const normalizedStyle = renderStyle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'studio-default';
      const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ sceneVersionId: renderSceneVersionId, idempotencyKey: `${renderSceneVersionId}:${renderRoomId}:${selectedModule?.id ?? 'room'}:${materialTarget?.materialId ?? 'base'}:${materialTarget?.semanticSlot ?? 'module'}:${operation}:${normalizedStyle}:${quality}`, options: { roomId: renderRoomId, targetModuleId: selectedModule?.id ?? null, targetMaterialId: materialTarget?.materialId, targetSemanticSlot: materialTarget?.semanticSlot, style: renderStyle, quality, operation } }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setVisualBusy(false);
      if (payload.result?.code === 'IMAGE_PROVIDER_NOT_CONFIGURED' || payload.code === 'IMAGE_PROVIDER_NOT_CONFIGURED') {
          setVisualState('No real image provider is configured. No render was generated or substituted.');
          return;
        }
        setVisualState(payload.result?.message ?? payload.result?.reason ?? payload.message ?? 'Image generation failed.');
        return;
      }
      if (payload.result?.jobId) { setReviewVisualJobId(payload.result.jobId); setActiveVisualJobId(payload.result.jobId); }
      if (payload.result?.status === 'succeeded' && payload.result?.signedUrl) { setVisualBusy(false); setActiveVisualJobId(null); setVisualState('Render stored privately and ready for review.'); await loadRenders(); return; }
      if (payload.result?.jobId) { setActiveVisualJobId(payload.result.jobId); setVisualState('Render queued with scene provenance.'); return; }
      setVisualBusy(false); setVisualState('Render request returned no durable job.');
    } catch { setVisualBusy(false); setVisualState('Visual service unavailable. The approved scene is unchanged.'); }
  }

  async function reviewRender(decision: 'approve' | 'reject') {
    const latestJobId = reviewVisualJobId;
    if (!latestJobId || !projectId) { setVisualState('Generate or select a render job before recording a decision.'); return; }
    const response = await fetch(`${apiBase}/projects/${projectId}/renders/${latestJobId}/review`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ decision: decision === 'approve' ? 'approved' : 'rejected', note: decision === 'approve' ? 'Approved in Visual Studio' : 'Rejected in Visual Studio' }) });
    setVisualState(response.ok ? `Render ${decision === 'approve' ? 'approved' : 'rejected'}.` : 'Render review could not be saved.');
    if (response.ok) { setActiveVisualJobId(null); await loadRenders(); }
  }

  async function loadApprovedSceneForProduction(setState: (value: string) => void): Promise<Record<string, unknown> | null> {
    if (!projectId || !sceneVersionId) {
      setState('Select a project and save a scene first.');
      return null;
    }
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}`, { headers: await authenticatedHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.sceneVersion) {
        setState(payload.message ?? 'The saved scene could not be read.');
        return null;
      }
      if (payload.sceneVersion.status !== 'approved') {
        setState('Approve the saved scene before generating production files.');
        return null;
      }
      if (!payload.sceneVersion.scene || typeof payload.sceneVersion.scene !== 'object') {
        setState('The saved scene has no valid geometry. Recompile it from the approved plan.');
        return null;
      }
      return payload.sceneVersion.scene as Record<string, unknown>;
    } catch {
      setState('The saved scene service is unavailable. No fallback geometry was used.');
      return null;
    }
  }

  async function createDrawings() {
    setDrawingState('Validating the approved scene...');
    const scene = await loadApprovedSceneForProduction(setDrawingState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/drawings/elevations.svg`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      setDrawingState(response.ok ? 'Drawing package validated. Download SVG, PDF, or DXF.' : 'Drawing validation failed.');
    } catch { setDrawingState('Drawing service unavailable.'); }
  }

  async function downloadDxf() {
    setDxfState('Exporting DXF...');
    const scene = await loadApprovedSceneForProduction(setDxfState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/drawings/dxf`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      if (!response.ok) { setDxfState('DXF export failed'); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `ultida-${sceneVersionId}.dxf`; link.click(); URL.revokeObjectURL(url);
      setDxfState('DXF exported');
    } catch { setDxfState('DXF service unavailable'); }
  }

  async function createCutlist() {
    setCutlistState('Preparing cutlist...');
    const scene = await loadApprovedSceneForProduction(setCutlistState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/production/cutlist`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) { setCutlistState(payload.message ?? 'Cutlist unavailable'); return; }
      setCutlistState(`${payload.cutlist.partCount} parts ready for review`);
    } catch { setCutlistState('Cutlist service unavailable'); }
  }

  async function downloadFile(path: string, filename: string, setState: (value: string) => void) {
    setState('Preparing file...');
    const scene = await loadApprovedSceneForProduction(setState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}${path}`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      if (!response.ok) { setState('File export failed'); return; }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); setState('File exported');
    } catch { setState('Export service unavailable'); }
  }

  if (stage === 'Visualize') {
    const latest = renders.find((render) => render.id === selectedRenderId) ?? renders[0];
    return (
      <section className="design-flow-workspace">
        <div className="workspace-heading">
          <div>
            <small>VISUAL STUDIO / SCENE-LINKED</small>
            <h2>Review the room as a stored design proposal.</h2>
            <p>Every render records its scene, prompt, provider and review state.</p>
          </div>
          <Badge tone={sceneApproved ? 'success' : 'accent'}>{sceneApproved ? 'Approved scene linked' : 'Scene approval required'}</Badge>
        </div>
        <div className="visual-studio-layout">
          <div className="visual-render-stage">
            {latest?.signedUrl ? (
              <img src={latest.signedUrl} alt={`Generated ${room} interior proposal`} />
            ) : (
              <div className="visual-preview-placeholder">
                <Image size={38} />
                <h3>No stored render yet</h3>
                <p>{visualState}</p>
              </div>
            )}
            <div className="visual-stage-status">
              <Badge tone={latest?.stale ? 'accent' : latest ? 'success' : 'accent'}>{latest?.stale ? 'Stale' : latest ? 'Ready' : visualBusy ? 'Processing' : 'Waiting'}</Badge>
              <span>{visualState}</span>
            </div>
          </div>
          <Card className="visual-studio-panel">
            <CardContent>
              <div className="provider-strip" aria-label="Visual provider availability">
                {providers.length ? (
                  providers.map((provider) => (
                    <span className="provider-status" key={provider.id}>
                      <span className={`provider-dot${provider.configured ? ' provider-dot-ready' : ''}`} />
                      {provider.id}
                      {provider.configured ? ' ready' : ' unavailable'}
                    </span>
                  ))
                ) : (
                  <span className="provider-status">Provider status unavailable</span>
                )}
              </div>
              <div className="visual-controls visual-controls-stack">
                <div className="scene-lock-summary" role="status">
                  <div className="scene-lock-summary-heading"><Layers3 size={15} /><strong>Geometry lock</strong><Badge tone={sceneApproved ? 'success' : 'accent'}>{sceneApproved ? 'Active' : 'Required'}</Badge></div>
                  <span>Camera, room shell, openings, ceiling and module bounds come from scene.v1 and cannot be changed by the image model.</span>
                  <small>{sceneVersionId ? `Scene ${sceneVersionId.slice(0, 8)} linked` : 'Compile a scene to continue'}</small>
                </div>
                <label>
                  Scene room
                  <select
                    value={spaceId ?? ''}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const next = spaces.find((space) => space.id === nextId);
                      setSpaceId(nextId || null);
                      if (next?.roomType) setRoom(next.roomType);
                    }}
                    disabled={!spaces.length}
                  >
                    {!spaces.length && <option value="">No persisted room available</option>}
                    {spaces.map((space) => <option key={space.id} value={space.id}>{space.name} · {space.roomType}</option>)}
                  </select>
                </label>
                <p className="visual-selection-note">
                  {selectedModule
                    ? `Selected module: ${selectedModule.label}. Material previews remain locked to this module and its room.`
                    : 'Select and place a module before requesting a targeted laminate preview.'}
                </p>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px', marginTop: '4px' }}>
                  <MaterialSwapPanel
                    projectId={projectId}
                    entityId={selectedModule?.id ?? ''}
                    moduleInstanceId={selectedModule?.id ?? null}
                    currentLaminate={selectedLaminateObj.name}
                    onConfirmCatalogSwap={({ laminate }) => {
                      setStyle((current) => `${current}; selected persisted material: ${laminate}`);
                      setMaterialAssignmentsSaved(true);
                      setVisualState('Material assignment saved. Preview it in the approved scene when ready.');
                    }}
                    onPreviewCatalogSwap={async ({ materialId, laminate, semanticSlot }) => {
                      setActiveLaminate(materialId);
                      if (!selectedModule) {
                        setVisualState('Select the exact module before creating a laminate revision.');
                        return;
                      }
                      const previewLaminate = catalogLaminates.find((item) => item.id === materialId);
                      if (!previewLaminate) {
                        setVisualState('The selected material is no longer available in the organization library. No revision was created.');
                        return;
                      }
                      setVisualState('Compiling the saved module material into a new scene version...');
                      const compiledSceneVersionId = await compileMoodboard([previewLaminate, selectedHardwareObj].filter((item) => item.id), true);
                      if (!compiledSceneVersionId) return;
                      setVisualState('Validating and approving the material revision before rendering...');
                      const revisionApproved = await onSceneApproved(compiledSceneVersionId);
                      if (!revisionApproved) {
                        setVisualState('The material revision was saved as a draft but could not be approved. Review its scene validation before rendering.');
                        return;
                      }
                      await createVisual('material-swap', laminate, compiledSceneVersionId, true, { materialId, semanticSlot });
                    }}
                  />
                </div>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>HARDWARE OPTIONS</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {catalogHardwares.map((hw) => (
                      <button
                        key={hw.id}
                        type="button"
                        onClick={() => setActiveHardware(hw.id)}
                        style={{
                          border: activeHardware === hw.id ? '2px solid #2563eb' : '1px solid #d8ccbd',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          background: activeHardware === hw.id ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          fontSize: '10px',
                          textAlign: 'left'
                        }}
                      >
                        {hw.name.split(' ')[0]} {hw.name.split(' ')[1]}
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ marginTop: '6px' }}>
                  Direction & Prompt
                  <input value={style} onChange={(event) => setStyle(event.target.value)} />
                </label>
                <label>
                  Quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="final">Final</option>
                  </select>
                </label>
                  <Button onClick={() => void createVisual()} disabled={!sceneApproved || !spaceId || visualBusy} title={!sceneApproved ? 'Approve scene.v1 first' : !spaceId ? 'Select a persisted room first' : 'Generate a scene-linked image'}>
                  {visualBusy ? <RefreshCw className="spin" size={16} /> : <Wand2 size={16} />} {visualBusy ? 'Processing' : 'Generate proposal'}
                </Button>
              </div>
              {latest && (
                <div className="render-provenance">
                  <small>PROVENANCE</small>
                  <span>Scene {latest.scene_version_id.slice(0, 8)}</span>
                  <span>
                    {latest.provenance?.provider ?? 'provider'} / {latest.provenance?.model ?? 'configured model'}
                  </span>
                  <span>{new Date(latest.created_at).toLocaleString()}</span>
                </div>
              )}
              <div className="render-review-actions">
                <Button variant="outline" onClick={() => reviewRender('reject')} disabled={!reviewVisualJobId || visualBusy}>
                  <ThumbsDown size={16} /> Reject
                </Button>
                <Button onClick={() => reviewRender('approve')} disabled={!reviewVisualJobId || visualBusy}>
                  <ThumbsUp size={16} /> Approve
                </Button>
              </div>
              <div className="render-variants">
                <small>RECENT OUTPUTS</small>
                {renders.slice(0, 4).map((render) => (
                  <button key={render.id} className="render-variant" type="button" aria-pressed={render.id === latest?.id} onClick={() => setSelectedRenderId(render.id)}>
                    <span>{render.stale ? 'Stale' : render.status}</span>
                    <small>{new Date(render.created_at).toLocaleDateString()}</small>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="workflow-next-action">
          <div><small>NEXT STEP</small><strong>Turn the reviewed scene into verified drawings and a cutlist.</strong><span>Available after a scene-linked render has been reviewed.</span></div>
          <Button onClick={() => navigate(`/projects/${projectId}/drawings`)} disabled={!projectId || !sceneApproved}><ArrowRight size={16} /> Continue to Drawings</Button>
        </div>
      </section>
    );
  }

  if (stage === 'Document') {
    return (
      <section className="design-flow-workspace">
        <div className="workspace-heading">
          <div>
            <small>DRAWINGS / PRODUCTION HANDOFF</small>
            <h2>Turn the approved scene into working documents.</h2>
            <p>Drawing requests stay attached to the same scene version as the visual proposal.</p>
          </div>
          <Badge tone={sceneApproved ? 'success' : sceneVersionId ? 'accent' : 'accent'}>{sceneApproved ? 'Production approved' : sceneVersionId ? 'Scene needs approval' : 'Scene required'}</Badge>
        </div>
        <Card className="drawing-panel">
          <CardHeader>
            <small>OUTPUTS</small>
            <h3>Production-ready package</h3>
          </CardHeader>
          <CardContent>
            <div className="output-row">
              <FileText size={20} />
              <div>
                <strong>Floor plan and wall elevations</strong>
                <span>Scene-linked SVG elevation file and DXF geometry</span>
              </div>
              <Badge>SVG / DXF / PDF</Badge>
            </div>
            <div className="output-row">
              <Layers3 size={20} />
              <div>
                <strong>Module schedule and cutlist</strong>
                <span>{modules.length} approved modules currently in the scene</span>
              </div>
              <Badge>CSV</Badge>
            </div>
            <div className="drawing-actions">
              <Button onClick={() => { void onSceneApproved(); }} disabled={!sceneVersionId || sceneApproved}>
                {' '}
                <Check size={16} /> {sceneApproved ? 'Scene approved' : 'Approve scene for production'}
              </Button>
              <Button onClick={createDrawings} disabled={!sceneVersionId || !sceneApproved}>
                <Send size={16} /> {drawingState}
              </Button>
              <Button variant="outline" onClick={downloadDxf} disabled={!sceneVersionId || !sceneApproved || dxfState === 'Exporting DXF...'}>
                <FileText size={16} /> {dxfState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-elevations.svg`, setElevationState)} disabled={!sceneVersionId || !sceneApproved}>
                <FileText size={16} /> {elevationState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/drawings/elevations.pdf', `ultida-${sceneVersionId}-elevations.pdf`, setPdfState)} disabled={!sceneVersionId || !sceneApproved}>
                <FileText size={16} /> {pdfState}
              </Button>
              <Button variant="outline" onClick={createCutlist} disabled={!sceneVersionId || !sceneApproved}>
                <Layers3 size={16} /> {cutlistState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/production/cutlist.csv', `ultida-${sceneVersionId}-cutlist.csv`, setCutlistState)} disabled={!sceneVersionId || !sceneApproved}>
                <Layers3 size={16} /> Export cutlist CSV
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="workflow-next-action">
          <div><small>NEXT STEP</small><strong>Review the scene-linked estimate when the production package is ready.</strong><span>Quotes stay tied to the exact approved scene version.</span></div>
          <Button onClick={() => navigate(`/projects/${projectId}/estimate`)} disabled={!projectId || !sceneApproved}><ArrowRight size={16} /> Continue to Estimate</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="design-flow-workspace">
      <div className="workspace-heading">
        <div>
          <small>{focus === 'materials' ? 'MATERIALS / COMPONENT ASSIGNMENT' : focus === 'modules' ? 'MODULE PLANNER / WALL-ANCHORED PLACEMENT' : 'SCENE CORE / MODULAR PLACEMENT'}</small>
          <h2>{focus === 'materials' ? 'Assign finishes to the exact parts you will render and build.' : focus === 'modules' ? 'Place buildable modules on measured room walls.' : 'Compose the room from buildable modules.'}</h2>
          <p>{focus === 'materials' ? 'Choose a placed module, then save laminate, edge-band, hardware and lighting choices before compiling scene.v1.' : focus === 'modules' ? 'Select a saved room and verified wall, then fit a parametric catalogue module to available space.' : 'Choose a room, place a catalog module, then save one scene version for every downstream output.'}</p>
        </div>
        <Badge tone={briefComplete && planApproved ? 'success' : 'accent'}>{!briefComplete ? 'Brief required' : planApproved ? 'Approved plan linked' : 'Approved plan required'}</Badge>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }} aria-label="Design workspace mode">
        <Button variant={designMode === 'layout' ? 'default' : 'outline'} onClick={() => setDesignMode('layout')}>
          <Layers3 size={16} style={{ marginRight: '0.5rem' }} /> Modular Layout
        </Button>
        <Button variant={designMode === 'moodboard' ? 'default' : 'outline'} onClick={() => setDesignMode('moodboard')}>
          <Palette size={16} style={{ marginRight: '0.5rem' }} /> Moodboard & Materials
        </Button>
      </div>

      <div className="module-layout">
        {designMode === 'layout' ? (
          <Card className="catalog-panel">
            <CardHeader>
              <small>MODULE CATALOG</small>
              <h3>Modular building blocks</h3>
            </CardHeader>
            <CardContent>
              <label>
                Place in
                <select value={spaceId ?? ''} onChange={(event) => { const next = spaces.find((item) => item.id === event.target.value); setSpaceId(event.target.value); if (next) setRoom(next.roomType); }}>
                  {spaces.length ? spaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No approved rooms</option>}
                </select>
              </label>
              <label>
                Anchor wall
                <select value={wallId ?? ''} onChange={(event) => setWallId(event.target.value || null)}>
                  {walls.length ? walls.map((wall) => <option key={wall.id} value={wall.id}>{wall.id}</option>) : <option value="">No verified walls</option>}
                </select>
              </label>
              <p className="placement-notice" role="status" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {catalogLoading && <Loader2 className="ultida-spinner" size={14} aria-hidden="true" />}
                {placementNotice}
              </p>
              <label>
                Search templates
                <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="TV wall, glass crockery, loft wardrobe" />
              </label>
              <label>
                Module family
                <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                  <option value="all">All compatible families</option>
                  {[...new Set(catalogItems.map((item) => item.family))].sort().map((family) => <option key={family} value={family}>{family}</option>)}
                </select>
              </label>
              <fieldset className="module-configuration" style={{ border: '1px solid #e8ded2', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.55rem' }}>
                <legend style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0 0.25rem' }}>CONFIGURE THE NEXT MOODBOARD MODULE</legend>
                <label>
                  Assembly archetype
                  <select value={moduleConfiguration.archetype} onChange={(event) => setModuleConfiguration((current) => ({ ...current, archetype: event.target.value }))}>
                    <option value="full_wall_storage">Full wall storage</option>
                    <option value="minimal_floating">Minimal floating</option>
                    <option value="asymmetric_profile_glass">Asymmetric profile glass</option>
                    <option value="tv_plus_study">TV plus study and library</option>
                    <option value="tv_plus_crockery">TV plus crockery</option>
                    <option value="tv_plus_partition">TV plus slatted partition</option>
                    <option value="french_beading_panel">French beading feature wall</option>
                    <option value="curved_contemporary">Curved contemporary return</option>
                    <option value="profile_glass_display">Profile glass display</option>
                    <option value="open_niche_storage">Open niche storage</option>
                  </select>
                </label>
                <label>
                  Front style
                  <select value={moduleConfiguration.shutterStyle} onChange={(event) => setModuleConfiguration((current) => ({ ...current, shutterStyle: event.target.value as ModuleConfiguration['shutterStyle'], glassProfile: event.target.value === 'profile-glass' }))}>
                    <option value="swing">Swing shutters</option>
                    <option value="sliding">Sliding shutters</option>
                    <option value="profile-glass">Aluminium profile glass</option>
                    <option value="open">Open shelving</option>
                  </select>
                </label>
                <label>
                  Drawer count
                  <select value={moduleConfiguration.drawerCount} onChange={(event) => setModuleConfiguration((current) => ({ ...current, drawerCount: Number(event.target.value) }))}>
                    <option value={0}>No drawers</option>
                    <option value={2}>2 drawers</option>
                    <option value={3}>3 drawers</option>
                    <option value={4}>4 drawers</option>
                  </select>
                </label>
                <label>
                  Handle/profile
                  <select value={moduleConfiguration.handleStyle} onChange={(event) => setModuleConfiguration((current) => ({ ...current, handleStyle: event.target.value as ModuleConfiguration['handleStyle'] }))}>
                    <option value="long-profile">Long profile handle</option>
                    <option value="gola">Gola / finger groove</option>
                    <option value="knob">Knob handle</option>
                    <option value="none">Handleless</option>
                  </select>
                </label>
                <label>
                  Lighting
                  <select value={moduleConfiguration.lighting} onChange={(event) => setModuleConfiguration((current) => ({ ...current, lighting: event.target.value as ModuleConfiguration['lighting'] }))}>
                    <option value="none">No integrated lighting</option>
                    <option value="shelf-led">Shelf LED</option>
                    <option value="vertical-led">Vertical LED</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input type="checkbox" checked={moduleConfiguration.includeLoft} onChange={(event) => setModuleConfiguration((current) => ({ ...current, includeLoft: event.target.checked }))} />
                  Include loft where the verified ceiling clearance allows it
                </label>
              </fieldset>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {catalogItems.filter((item) => familyFilter === 'all' || item.family === familyFilter).filter((item) => {
                  const search = catalogQuery.trim().toLowerCase();
                  return !search || [item.name, item.family, item.description, ...item.tags].filter(Boolean).join(' ').toLowerCase().includes(search);
                }).map((item) => (
                  <button className="catalog-item" key={item.id} onClick={() => {
                    let prepared: PreparedModulePlan | null = null;
                    try { const raw = window.localStorage.getItem('ultida.pendingModulePlan.v1'); prepared = raw ? JSON.parse(raw) as PreparedModulePlan : null; } catch { /* ignored: normal catalogue placement continues */ }
                    void addModule(item, prepared?.templateId === item.id ? prepared.dimensionsMm : undefined);
                  }} disabled={!briefComplete || !planApproved}>
                    <ModulePreview module={item} compact />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.widthMm} x {item.depthMm} x {item.heightMm} mm
                      </small>
                      {item.description ? <small>{item.description}</small> : null}
                    </span>
                    <Plus size={15} />
                  </button>
                ))}
                {catalogLoading ? <p className="placement-notice"><Loader2 className="ultida-spinner" size={14} aria-hidden="true" /> Loading compatible furniture…</p> : !catalogItems.length && <p className="placement-notice">No compatible templates are available for this approved room.</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="catalog-panel" style={{ minWidth: '400px' }}>
            <CardHeader>
              <small>MOODBOARD STUDIO</small>
              <h3>Aesthetic Material Curation</h3>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>1. Select Theme & Palette</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {stylePresets.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme.id)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        border: activeTheme === theme.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: activeTheme === theme.id ? '#fafaf9' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>{theme.name}</strong>
                      <small>{theme.referenceStyle.join(' · ')}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>2. Selected Laminate Finish</label>
                {!catalogLaminates.length && <div className="placement-notice" role="status" style={{ marginBottom: '0.6rem' }}><span>No organization laminate is available yet.</span><Button variant="outline" onClick={() => void addStarterMaterials()} disabled={!projectId || starterMaterialsState.startsWith('Adding')}>Add curated Cubex, Advance &amp; Virgo starters</Button><small>{starterMaterialsState || 'These are editable starter specifications; verify supplier availability before production.'}</small></div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {catalogLaminates.map((laminate) => (
                    <button
                      key={laminate.id}
                      onClick={() => setActiveLaminate(laminate.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: activeLaminate === laminate.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: laminate.hex, border: '1px solid #d1d5db' }} />
                      <span style={{ fontSize: '0.8rem', flex: 1 }}>{laminate.name}</span>
                      <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>{laminate.code}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>3. Accent Hardware</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {catalogHardwares.map((hardware) => (
                    <button
                      key={hardware.id}
                      onClick={() => setActiveHardware(hardware.id)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: activeHardware === hardware.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      {hardware.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={() => { void saveMoodboard(); }} style={{ marginTop: '0.5rem' }}>
                <Check size={16} style={{ marginRight: '0.5rem' }} /> Save Moodboard
              </Button>
              <Button onClick={() => void compileMoodboard()} variant="outline" disabled={!selectedModule || !materialAssignmentsSaved} title={!selectedModule ? 'Place and select a module first' : !materialAssignmentsSaved ? 'Save selected materials before compiling' : 'Compile persisted geometry, modules and materials'}>
                <Layers3 size={16} style={{ marginRight: '0.5rem' }} /> Compile {draftModules.length} reviewed module{draftModules.length === 1 ? '' : 's'} to scene.v1
              </Button>
              <Button onClick={() => { if (compiledSceneId) void onSceneApproved(compiledSceneId); }} variant="outline" disabled={!compiledSceneId || sceneApproved} title={!compiledSceneId ? 'Compile a scene first' : sceneApproved ? 'This scene is already approved' : 'Approve this exact scene before rendering'}>
                <Check size={16} style={{ marginRight: '0.5rem' }} /> {sceneApproved ? 'Scene approved' : 'Approve scene'}
              </Button>
              <Button disabled={!compiledSceneId || !projectId} onClick={() => navigate(`/projects/${projectId}/3d`)} variant="outline">
                <Layers3 size={16} style={{ marginRight: '0.5rem' }} /> Inspect compiled scene in 3D
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="scene-panel">
          <CardHeader>
            <div>
              <small>SCENE V1</small>
              <h3>{sceneVersionId ? `Version ${sceneVersionId.slice(0, 8)}` : 'Draft scene'}</h3>
            </div>
            <Badge>{draftModules.length} moodboard modules</Badge>
          </CardHeader>
          <CardContent>
            <div className="scene-canvas">
              <div className="scene-room-label">{room.toUpperCase()}</div>
              {draftModules.map((item, index) => (
                <button type="button" aria-pressed={item.id === selectedModule?.id} onClick={() => setSelectedModuleId(item.id)} className={`scene-module module-${item.family}${item.id === selectedModule?.id ? ' scene-module-selected' : ''}`} key={item.id} style={{ left: `${12 + (index % 4) * 22}%`, top: `${20 + Math.floor(index / 4) * 24}%` }}>
                  <Check size={13} />
                  {item.label}
                </button>
              ))}
            </div>
            
            {materials.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fafaf9', borderRadius: '0.375rem', border: '1px dashed #e5e7eb' }}>
                <small style={{ fontWeight: 'bold', color: '#c59c2d', display: 'block', marginBottom: '0.25rem' }}>ACTIVE MOODBOARD MATERIALS</small>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {materials.map((m) => (
                    <Badge key={m.id} tone="success">{m.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="module-list">
              {draftModules.length ? (
                draftModules.map((item) => (
                  <button type="button" key={item.id} className={item.id === selectedModule?.id ? 'module-list-selected' : ''} aria-pressed={item.id === selectedModule?.id} onClick={() => setSelectedModuleId(item.id)}>
                    <span>{item.label}</span>
                    <small>{item.widthMm} mm · {item.id === selectedModule?.id ? 'selected' : 'select'}</small>
                  </button>
                ))
              ) : (
                <p>Add a module to begin the scene.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="workflow-next-action">
        <div><small>NEXT STEP</small><strong>{compiledSceneId ? 'Inspect the compiled room before requesting a render.' : 'Compile the placed modules into one canonical scene.'}</strong><span>{compiledSceneId ? 'The same scene supplies 3D, renders, drawings, cutlists and estimates.' : 'Place a module, save its material assignment, then compile the scene.'}</span></div>
        <Button onClick={() => navigate(`/projects/${projectId}/${compiledSceneId ? '3d' : 'materials'}`)} disabled={!projectId || !compiledSceneId}><ArrowRight size={16} /> {compiledSceneId ? 'Continue to 3D Scene' : 'Scene required'}</Button>
      </div>
    </section>
  );
}
