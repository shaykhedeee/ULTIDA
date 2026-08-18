import { Box, Camera, Eye, Layers3, MousePointer2, Rotate3D, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import './scene-studio.css';

type Scene = {
  schema: 'scene.v1';
  units: 'mm';
  rooms: Array<{ id: string; name: string; boundary: Array<{ xMm: number; yMm: number }> }>;
  walls: Array<{ id: string; start: { xMm: number; yMm: number }; end: { xMm: number; yMm: number }; thicknessMm: number; heightMm: number }>;
  openings: Array<{ id: string; wallId: string; offsetMm: number; widthMm: number; heightMm: number; sillHeightMm?: number; kind: 'door' | 'window' }>;
  modules: Array<{ id: string; family: string; widthMm: number; depthMm: number; heightMm: number; position: { xMm: number; yMm: number }; rotationDeg: number; materialId?: string }>;
  moduleParts: Array<{ id: string; moduleId: string; semanticType: string; name: string; widthMm: number; depthMm: number; heightMm: number; position: { xMm: number; yMm: number; zMm: number }; rotationDeg: number; materialId?: string }>;
  materials: Array<{ id: string; name: string; code: string; finish?: string }>;
  cameras: Array<{ id: string; name: string; position: { xMm: number; yMm: number; zMm: number }; target: { xMm: number; yMm: number; zMm: number }; lensMm: number }>;
};

type Props = {
  sceneVersionId: string | null;
  projectId?: string | null;
  onCompileScene?: () => Promise<void>;
};
type Preset = 'perspective' | 'front' | 'top';

function materialColor(materialId: string | undefined) {
  if (!materialId) return '#b99167';
  let hash = 0;
  for (const character of materialId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `#${(0x806040 + (hash & 0x5f5f5f)).toString(16).slice(-6)}`;
}

function addWallSegments(group: THREE.Group, scene: Scene, wallVisible: boolean) {
  if (!wallVisible) return;
  for (const wall of scene.walls) {
    const dx = wall.end.xMm - wall.start.xMm;
    const dz = wall.end.yMm - wall.start.yMm;
    const length = Math.hypot(dx, dz);
    if (length <= 0) continue;
    const angle = Math.atan2(dz, dx);
    const openings = scene.openings.filter((opening) => opening.wallId === wall.id).sort((a, b) => a.offsetMm - b.offsetMm);
    let cursor = 0;
    const addSegment = (from: number, to: number, bottomMm: number, heightMm: number, suffix: string) => {
      if (to - from <= 1 || heightMm <= 0) return;
      const geometry = new THREE.BoxGeometry(to - from, heightMm, wall.thicknessMm);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#eee9e0', roughness: 0.88, metalness: 0.02 }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const midpoint = (from + to) / 2;
      mesh.position.set(wall.start.xMm + Math.cos(angle) * midpoint, bottomMm + heightMm / 2, wall.start.yMm + Math.sin(angle) * midpoint);
      mesh.rotation.y = -angle;
      mesh.name = `${wall.id}:${suffix}`;
      mesh.userData = { kind: 'wall', id: wall.id };
      group.add(mesh);
    };
    for (const opening of openings) {
      const start = Math.max(cursor, opening.offsetMm);
      addSegment(cursor, start, 0, wall.heightMm, 'solid');
      const openingEnd = Math.min(length, opening.offsetMm + opening.widthMm);
      const sill = opening.sillHeightMm ?? 0;
      addSegment(start, openingEnd, 0, sill, `${opening.id}:sill`);
      addSegment(start, openingEnd, sill + opening.heightMm, wall.heightMm - sill - opening.heightMm, `${opening.id}:head`);
      cursor = Math.max(cursor, openingEnd);
    }
    addSegment(cursor, length, 0, wall.heightMm, 'solid');
  }
}

export function SceneStudio({ sceneVersionId, projectId, onCompileScene }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState('Select an approved scene to inspect its geometry.');
  const [wallsVisible, setWallsVisible] = useState(true);
  const [ceilingVisible, setCeilingVisible] = useState(false);
  const [preset, setPreset] = useState<Preset>('perspective');
  const [selected, setSelected] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    const sb = supabase;
    if (!sb) { setScene(null); return; }

    const loadScene = async () => {
      setStatus('Loading persisted scene geometry...');
      let query = sb.from('scene_versions').select('id,scene,status');
      if (sceneVersionId) {
        query = query.eq('id', sceneVersionId);
      } else if (projectId) {
        query = query.eq('project_id', projectId).order('version_number', { ascending: false }).limit(1);
      } else {
        setScene(null);
        setStatus('Select an approved scene to inspect its geometry.');
        return;
      }

      const { data, error } = await (sceneVersionId ? query.single() : query.maybeSingle());
      if (error || !data?.scene) {
        if (projectId) {
          try {
            setStatus('Auto-compiling 3D scene from approved spaces and plan geometry...');
            const session = (await sb.auth.getSession()).data.session;
            if (session?.access_token) {
              const apiBase = getApiBase();
              const compileRes = await fetch(`${apiBase}/projects/${projectId}/scenes/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              });
              const compilePayload = await compileRes.json().catch(() => null);
              if (compilePayload?.success && compilePayload?.scene) {
                const compiledScene = compilePayload.scene as Scene;
                const normalized = { ...compiledScene, moduleParts: compiledScene.moduleParts ?? [] };
                setScene(normalized);
                setStatus(`✨ 3D Scene compiled: ${normalized.rooms?.length ?? 0} rooms, ${normalized.walls?.length ?? 0} walls, ${normalized.modules?.length ?? 0} modules.`);
                return;
              }
            }
          } catch {
            // ignore
          }
        }
        setScene(null);
        setStatus('No 3D scene compiled yet. Click ✨ Compile 3D Scene to generate from approved plan.');
        return;
      }
      if (data.status !== 'approved' && data.status !== 'draft') {
        setScene(null);
        setStatus('This scene version is not available for preview.');
        return;
      }
      const candidate = data.scene as Scene;
      if (candidate.schema !== 'scene.v1' || candidate.units !== 'mm') {
        setScene(null);
        setStatus('This stored scene does not use the required scene.v1 millimetre contract.');
        return;
      }
      const normalized = { ...candidate, moduleParts: candidate.moduleParts ?? [] };
      setScene(normalized);
      setStatus(`Scene loaded: ${normalized.rooms.length} rooms, ${normalized.walls.length} walls, ${normalized.modules.length} modules, ${normalized.moduleParts.length} exact parts.`);
    };

    void loadScene();
  }, [sceneVersionId, projectId]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host || !scene) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor('#f8f6f0');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.replaceChildren(renderer.domElement);
    const root = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 10, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(0, 1000, 0);

    const hemiLight = new THREE.HemisphereLight('#fff9eb', '#6b655d', 2.2);
    root.add(hemiLight);

    const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.position.set(4500, 6500, -3000);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 500;
    sun.shadow.camera.far = 25000;
    const d = 8000;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    root.add(sun);

    const fillLight = new THREE.DirectionalLight('#e8f0fe', 0.8);
    fillLight.position.set(-4000, 3000, 4000);
    root.add(fillLight);

    const geometryGroup = new THREE.Group(); root.add(geometryGroup);
    const floors = new THREE.Group(); geometryGroup.add(floors);
    for (const room of scene.rooms) {
      const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
      if (points.length < 3) continue;
      const shape = new THREE.Shape(points);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
        color: '#e2dbd0',
        roughness: 0.38,
        metalness: 0.06,
        side: THREE.DoubleSide,
      }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.name = room.id;
      mesh.userData = { kind: 'room', id: room.id };
      mesh.receiveShadow = true;
      floors.add(mesh);
    }
    addWallSegments(geometryGroup, scene, wallsVisible);
    if (ceilingVisible) {
      for (const room of scene.rooms) {
        const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
        if (points.length < 3) continue;
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points)), new THREE.MeshStandardMaterial({ color: '#fbfaf6', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.y = 2700; geometryGroup.add(mesh);
      }
    }
    const modulesWithParts = new Set(scene.moduleParts.map((part) => part.moduleId));
    const renderableModules = scene.modules.filter((module) => !modulesWithParts.has(module.id));
    const addModuleBox = (module: { id: string; family: string; widthMm: number; depthMm: number; heightMm: number; position: { xMm: number; yMm: number }; rotationDeg: number; materialId?: string }, verticalMm = 0, label?: string) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(module.widthMm, module.heightMm, module.depthMm), new THREE.MeshStandardMaterial({ color: materialColor(module.materialId), roughness: 0.55, metalness: 0.08 }));
      box.castShadow = true;
      box.receiveShadow = true;
      const theta = -THREE.MathUtils.degToRad(module.rotationDeg);
      box.position.set(
        module.position.xMm + module.widthMm / 2 * Math.cos(theta) - module.depthMm / 2 * Math.sin(theta),
        verticalMm + module.heightMm / 2,
        module.position.yMm + module.widthMm / 2 * Math.sin(theta) + module.depthMm / 2 * Math.cos(theta),
      );
      box.rotation.y = -THREE.MathUtils.degToRad(module.rotationDeg);
      box.name = module.id; box.userData = { kind: 'module', id: module.id, family: label ?? module.family }; geometryGroup.add(box);
    };
    for (const module of renderableModules) addModuleBox(module);
    for (const part of scene.moduleParts) addModuleBox({ ...part, family: part.semanticType, position: { xMm: part.position.xMm, yMm: part.position.yMm } }, part.position.zMm, part.semanticType);
    const bounds = new THREE.Box3().setFromObject(geometryGroup);
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(4000, 2700, 3000) : bounds.getSize(new THREE.Vector3());
    const applyPreset = () => {
      const span = Math.max(size.x, size.z, 3000);
      if (preset === 'top') camera.position.set(center.x, center.y + span * 1.5, center.z + 1);
      else if (preset === 'front') camera.position.set(center.x, center.y + 1400, center.z - span * 1.15);
      else camera.position.set(center.x + span * 0.9, center.y + span * 0.62, center.z - span * 0.9);
      controls.target.copy(center); controls.update();
    };
    applyPreset();
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(geometryGroup.children, true)[0];
      setSelected(hit?.object.userData?.id ?? null);
    };
    renderer.domElement.addEventListener('pointerdown', onPointer);
    const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host);
    let frame = 0;
    const draw = () => { controls.update(); renderer.render(root, camera); frame = requestAnimationFrame(draw); };
    draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', onPointer); controls.dispose(); renderer.dispose(); host.replaceChildren(); };
  }, [scene, wallsVisible, ceilingVisible, preset]);

  return <section className="scene-studio">
    <div className="scene-heading"><div><small>SCENE STUDIO / SCENE.V1</small><h2>Inspect the measured room before visualization.</h2><p>{status}</p></div><Badge tone={scene ? 'success' : 'accent'}>{scene ? 'Geometry loaded' : 'No scene'}</Badge></div>
    <div className="scene-toolbar" aria-label="Scene controls">
      <Button variant={preset === 'perspective' ? 'default' : 'outline'} onClick={() => setPreset('perspective')}><Camera size={16} /> Perspective</Button>
      <Button variant={preset === 'front' ? 'default' : 'outline'} onClick={() => setPreset('front')}><Eye size={16} /> Front</Button>
      <Button variant={preset === 'top' ? 'default' : 'outline'} onClick={() => setPreset('top')}><Layers3 size={16} /> Top</Button>
      <Button variant={wallsVisible ? 'default' : 'outline'} onClick={() => setWallsVisible((value) => !value)}><Box size={16} /> Walls</Button>
      <Button variant={ceilingVisible ? 'default' : 'outline'} onClick={() => setCeilingVisible((value) => !value)}><Rotate3D size={16} /> Ceiling</Button>
      {onCompileScene && (
        <Button
          variant="default"
          disabled={compiling}
          onClick={async () => {
            setCompiling(true);
            try {
              await onCompileScene();
            } finally {
              setCompiling(false);
            }
          }}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #c59c2d, #a88220)', color: '#1c1917', fontWeight: 800 }}
        >
          {compiling ? 'Compiling 3D Scene...' : '✨ Compile 3D Scene'}
        </Button>
      )}
    </div>
    <div className="scene-grid">
      <Card className="scene-viewport">
        <CardContent style={{ position: 'relative' }}>
          <div ref={canvasRef} className="scene-canvas" aria-label="Interactive three dimensional scene preview" />
          {!scene && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(250, 248, 244, 0.96)', padding: 24, textAlign: 'center', gap: 14 }}>
              <Box size={44} style={{ color: 'var(--gold)' }} />
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-primary)' }}>3D Scene Ready to Compile</h3>
              <p style={{ margin: 0, maxWidth: 440, fontSize: 12.5, color: 'var(--text-muted)' }}>
                Your approved floor plan and configured modular units are ready. Click below to compile the 3D scene.
              </p>
              <Button
                variant="default"
                disabled={compiling}
                onClick={async () => {
                  setCompiling(true);
                  setStatus('Compiling 3D scene from approved spaces...');
                  try {
                    if (onCompileScene) {
                      await onCompileScene();
                    } else if (projectId) {
                      const sb = supabase;
                      if (sb) {
                        const session = (await sb.auth.getSession()).data.session;
                        if (session?.access_token) {
                          const apiBase = getApiBase();
                          const res = await fetch(`${apiBase}/projects/${projectId}/scenes/compile`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                          });
                          const payload = await res.json().catch(() => null);
                          if (payload?.success && payload?.scene) {
                            const norm = { ...payload.scene, moduleParts: payload.scene.moduleParts ?? [] };
                            setScene(norm);
                            setStatus(`✨ Scene compiled: ${norm.rooms?.length ?? 0} rooms, ${norm.modules?.length ?? 0} modules.`);
                          }
                        }
                      }
                    }
                  } finally {
                    setCompiling(false);
                  }
                }}
                style={{ background: 'linear-gradient(135deg, #c59c2d, #a88220)', color: '#1c1917', fontWeight: 800, padding: '10px 20px', fontSize: 13 }}
              >
                <Sparkles size={15} /> {compiling ? 'Compiling 3D Scene...' : '✨ Generate & Compile 3D Scene'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="scene-inspector"><CardHeader><div><small>SELECTION</small><h3>{selected ?? 'Nothing selected'}</h3></div><MousePointer2 size={18} /></CardHeader><CardContent><p>{selected ? 'Selected geometry comes directly from the stored scene.v1 graph.' : 'Select a room, wall segment, or module in the preview.'}</p><p>{scene ? `${scene.openings.length} anchored openings • ${scene.materials.length} material records` : 'Create a scene from an approved floor plan to begin.'}</p></CardContent></Card>
    </div>
  </section>;
}
