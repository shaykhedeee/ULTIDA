import { Box, Camera, Eye, Layers3, MousePointer2, Rotate3D } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { supabase } from '../../lib/supabase';
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

type Props = { sceneVersionId: string | null };
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
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#e5e0d8', roughness: 0.92 }));
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

export function SceneStudio({ sceneVersionId }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState('Select an approved scene to inspect its geometry.');
  const [wallsVisible, setWallsVisible] = useState(true);
  const [ceilingVisible, setCeilingVisible] = useState(false);
  const [preset, setPreset] = useState<Preset>('perspective');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!sceneVersionId || !supabase) { setScene(null); return; }
    setStatus('Loading persisted scene geometry...');
    void supabase.from('scene_versions').select('scene,status').eq('id', sceneVersionId).single().then(({ data, error }) => {
      if (error || !data?.scene) { setScene(null); setStatus(error?.message ?? 'Scene data is unavailable.'); return; }
      if (data.status !== 'approved' && data.status !== 'draft') { setScene(null); setStatus('This scene version is not available for preview.'); return; }
      const candidate = data.scene as Scene;
      if (candidate.schema !== 'scene.v1' || candidate.units !== 'mm') { setScene(null); setStatus('This stored scene does not use the required scene.v1 millimetre contract.'); return; }
      const normalized = { ...candidate, moduleParts: candidate.moduleParts ?? [] };
      setScene(normalized); setStatus(`Scene loaded: ${normalized.rooms.length} rooms, ${normalized.walls.length} walls, ${normalized.modules.length} modules, ${normalized.moduleParts.length} exact parts.`);
    });
  }, [sceneVersionId]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host || !scene) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor('#f4f1eb');
    host.replaceChildren(renderer.domElement);
    const root = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 10, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1000, 0);
    root.add(new THREE.HemisphereLight('#fff9eb', '#6b6f76', 2.4));
    const sun = new THREE.DirectionalLight('#fff3dd', 2.2); sun.position.set(4000, 5500, -2500); root.add(sun);
    const geometryGroup = new THREE.Group(); root.add(geometryGroup);
    const floors = new THREE.Group(); geometryGroup.add(floors);
    for (const room of scene.rooms) {
      const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
      if (points.length < 3) continue;
      const shape = new THREE.Shape(points);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#d8d0c5', roughness: 1, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.name = room.id; mesh.userData = { kind: 'room', id: room.id }; floors.add(mesh);
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
      const box = new THREE.Mesh(new THREE.BoxGeometry(module.widthMm, module.heightMm, module.depthMm), new THREE.MeshStandardMaterial({ color: materialColor(module.materialId), roughness: 0.62, metalness: 0.05 }));
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
    </div>
    <div className="scene-grid"><Card className="scene-viewport"><CardContent><div ref={canvasRef} className="scene-canvas" aria-label="Interactive three dimensional scene preview" /></CardContent></Card><Card className="scene-inspector"><CardHeader><div><small>SELECTION</small><h3>{selected ?? 'Nothing selected'}</h3></div><MousePointer2 size={18} /></CardHeader><CardContent><p>{selected ? 'Selected geometry comes directly from the stored scene.v1 graph.' : 'Select a room, wall segment, or module in the preview.'}</p><p>{scene ? `${scene.openings.length} anchored openings • ${scene.materials.length} material records` : 'Create a scene from an approved floor plan to begin.'}</p></CardContent></Card></div>
  </section>;
}
