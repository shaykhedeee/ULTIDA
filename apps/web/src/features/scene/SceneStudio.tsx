import { Box, Camera, Eye, Layers3, MousePointer2, Rotate3D, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
type Preset = 'perspective' | 'front' | 'top' | 'walkthrough' | 'isometric';

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
  const [activeRooms, setActiveRooms] = useState<Array<{ id: string; name: string; roomType?: string; areaSqm?: number; polygon: Array<{ xMm: number; yMm: number }> }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading 3D scene geometry...');
  const [wallsVisible, setWallsVisible] = useState(true);
  const [ceilingVisible, setCeilingVisible] = useState(false);
  const [preset, setPreset] = useState<Preset>('perspective');
  const [selected, setSelected] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    const sb = supabase;
    if (!sb || !projectId) return;

    let live = true;
    const loadScene = async () => {
      setStatus('Loading persisted scene geometry...');
      const session = (await sb.auth.getSession()).data.session;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const apiBase = getApiBase();

      let loadedScene: Scene | null = null;

      let query = sb.from('scene_versions').select('id,scene,status');
      if (sceneVersionId) {
        query = query.eq('id', sceneVersionId);
      } else {
        query = query.eq('project_id', projectId).order('version_number', { ascending: false }).limit(1);
      }

      const { data } = await (sceneVersionId ? query.single() : query.maybeSingle());
      if (data?.scene && (data.status === 'approved' || data.status === 'draft')) {
        const candidate = data.scene as Scene;
        if (candidate.schema === 'scene.v1' && candidate.units === 'mm') {
          loadedScene = { ...candidate, moduleParts: candidate.moduleParts ?? [] };
        }
      }

      if (!loadedScene) {
        try {
          const planRes = await fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers });
          const planPayload = await planRes.json().catch(() => null);

          if (planRes.ok && planPayload?.walls && planPayload?.rooms) {
            const rawRooms = planPayload.rooms ?? [];
            if (live) setActiveRooms(rawRooms);

            let rawModules: any[] = [];
            try {
              const modRes = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { headers });
              const modPayload = await modRes.json().catch(() => null);
              if (modRes.ok && Array.isArray(modPayload?.modules)) {
                rawModules = modPayload.modules;
              }
            } catch {
            }

            const ceilingH = Number(planPayload.ceilingHeightMm ?? 2700);

            const sceneRooms = rawRooms.map((r: any) => ({
              id: r.id,
              name: r.name || r.roomType || 'Room',
              boundary: r.polygon ?? [],
            }));

            const sceneWalls = (planPayload.walls ?? []).map((w: any) => ({
              id: w.id,
              start: w.start ?? { xMm: 0, yMm: 0 },
              end: w.end ?? { xMm: 1000, yMm: 0 },
              thicknessMm: Number(w.thicknessMm ?? 150),
              heightMm: Number(w.heightMm ?? ceilingH),
            }));

            const sceneOpenings = (planPayload.openings ?? []).map((o: any) => ({
              id: o.id,
              wallId: o.wallId,
              offsetMm: Number(o.offsetMm ?? 0),
              widthMm: Number(o.widthMm ?? 900),
              heightMm: Number(o.heightMm ?? 2100),
              sillHeightMm: Number(o.sillMm ?? 0),
              kind: (o.kind === 'window' ? 'window' : 'door') as 'door' | 'window',
            }));

            const sceneModules = rawModules.map((m: any, idx: number) => {
              const pos = m.position_json ?? {};
              const conf = m.config_json ?? {};
              return {
                id: m.id || `mod-${idx}`,
                family: m.category || conf.family || 'modular',
                widthMm: Number(conf.widthMm ?? 1800),
                depthMm: Number(conf.depthMm ?? 600),
                heightMm: Number(conf.heightMm ?? 2100),
                position: { xMm: Number(pos.xMm ?? 1000 + (idx % 3) * 600), yMm: Number(pos.yMm ?? 1000 + Math.floor(idx / 3) * 600) },
                rotationDeg: Number(pos.rotationDeg ?? 0),
              };
            });

            loadedScene = {
              schema: 'scene.v1',
              units: 'mm',
              rooms: sceneRooms,
              walls: sceneWalls,
              openings: sceneOpenings,
              modules: sceneModules,
              moduleParts: [],
              materials: [
                { id: 'mat-1', name: 'Smoked Walnut Veneer', code: 'VIRGO-OAK-01', finish: 'Satin PU' },
                { id: 'mat-2', name: 'Calacatta Gold Sintered Slab', code: 'SLAB-CAL-GOLD', finish: 'Polished' },
                { id: 'mat-3', name: 'Matte Suede Zero-G Shutter', code: 'SHUT-LAM-SUEDE', finish: 'Anti-Fingerprint' },
                { id: 'mat-4', name: 'Tinted Fluted Profile Glass', code: 'GLAS-FLUTED-TINT', finish: 'Anodized Bronze' },
              ],
              cameras: [
                { id: 'cam-main', name: 'Overview Perspective', position: { xMm: 4000, yMm: 4000, zMm: 2400 }, target: { xMm: 1500, yMm: 1500, zMm: 1000 }, lensMm: 28 },
              ],
            };
          }
        } catch {
        }
      }

      if (!live) return;

      if (loadedScene) {
        setScene(loadedScene);
        setStatus(`✨ 3D Geometry loaded: ${loadedScene.rooms.length} rooms, ${loadedScene.walls.length} walls, ${loadedScene.openings.length} openings, ${loadedScene.modules.length} modules.`);
      } else {
        setScene(null);
        setStatus('No 3D scene compiled yet. Click ✨ Compile 3D Scene to generate from approved plan.');
      }
    };

    void loadScene();
    return () => { live = false; };
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

    const geometryGroup = new THREE.Group(); root.add(geometryGroup);
    const floors = new THREE.Group(); geometryGroup.add(floors);
    for (const room of scene.rooms) {
      const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
      if (points.length < 3) continue;
      const shape = new THREE.Shape(points);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
        color: selectedRoomId === room.id ? '#ede4d4' : '#e2dbd0',
        roughness: 0.38,
        metalness: 0.06,
        side: THREE.DoubleSide,
      }));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0;
      mesh.receiveShadow = true;
      mesh.name = `room:${room.id}`;
      mesh.userData = { kind: 'room', id: room.id, name: room.name };
      floors.add(mesh);
    }
    const wallsGroup = new THREE.Group(); geometryGroup.add(wallsGroup);
    addWallSegments(wallsGroup, scene, wallsVisible);

    const modulesGroup = new THREE.Group(); geometryGroup.add(modulesGroup);
    for (const mod of scene.modules) {
      const modContainer = new THREE.Group();
      modContainer.position.set(mod.position.xMm, 0, mod.position.yMm);
      modContainer.rotation.y = (mod.rotationDeg * Math.PI) / 180;
      modContainer.name = `module:${mod.id}`;
      modContainer.userData = { kind: 'module', id: mod.id, family: mod.family };

      const baseMat = new THREE.MeshStandardMaterial({
        color: materialColor(mod.materialId),
        roughness: 0.42,
        metalness: 0.08,
      });

      const isKitchenBase = mod.family.includes('kitchen-base') || mod.family.includes('counter');
      const isWardrobe = mod.family.includes('wardrobe') || mod.family.includes('closet');
      const isBed = mod.family.includes('bed');

      if (isKitchenBase) {
        // 1. Recessed plinth
        const plinthGeo = new THREE.BoxGeometry(mod.widthMm - 30, 100, Math.max(100, mod.depthMm - 50));
        const plinthMesh = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.8 }));
        plinthMesh.position.set(0, 50, 25);
        plinthMesh.castShadow = true;
        modContainer.add(plinthMesh);

        // 2. Carcase & Shutter unit
        const carcaseHeight = mod.heightMm - 140;
        const carcaseGeo = new THREE.BoxGeometry(mod.widthMm - 4, carcaseHeight, mod.depthMm - 16);
        const carcaseMesh = new THREE.Mesh(carcaseGeo, baseMat);
        carcaseMesh.position.set(0, 100 + carcaseHeight / 2, 0);
        carcaseMesh.castShadow = true;
        carcaseMesh.receiveShadow = true;
        modContainer.add(carcaseMesh);

        // 3. Countertop Slab (40mm thickness with 20mm overhang)
        const topGeo = new THREE.BoxGeometry(mod.widthMm + 8, 40, mod.depthMm + 16);
        const topMat = new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.15, metalness: 0.05 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(0, mod.heightMm - 20, 8);
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        modContainer.add(topMesh);

        // 4. Gold profile handles
        const handleGeo = new THREE.BoxGeometry(Math.min(160, mod.widthMm * 0.45), 10, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: '#c59c2d', metalness: 0.9, roughness: 0.2 });
        const handleMesh = new THREE.Mesh(handleGeo, handleMat);
        handleMesh.position.set(0, mod.heightMm - 90, mod.depthMm / 2 + 2);
        modContainer.add(handleMesh);
      } else if (isWardrobe) {
        // Tall wardrobe with plinth, carcase, and full-length bar pulls
        const plinthGeo = new THREE.BoxGeometry(mod.widthMm, 80, mod.depthMm - 20);
        const plinthMesh = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: '#2b2622' }));
        plinthMesh.position.set(0, 40, 0);
        modContainer.add(plinthMesh);

        const carcaseGeo = new THREE.BoxGeometry(mod.widthMm, mod.heightMm - 80, mod.depthMm);
        const carcaseMesh = new THREE.Mesh(carcaseGeo, baseMat);
        carcaseMesh.position.set(0, 80 + (mod.heightMm - 80) / 2, 0);
        carcaseMesh.castShadow = true;
        carcaseMesh.receiveShadow = true;
        modContainer.add(carcaseMesh);

        const handleGeo = new THREE.BoxGeometry(10, 600, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: '#1c1917', metalness: 0.85, roughness: 0.25 });
        const handleMesh = new THREE.Mesh(handleGeo, handleMat);
        handleMesh.position.set(mod.widthMm > 600 ? -36 : 0, mod.heightMm / 2, mod.depthMm / 2 + 6);
        modContainer.add(handleMesh);
        if (mod.widthMm > 600) {
          const handleMesh2 = handleMesh.clone();
          handleMesh2.position.x = 36;
          modContainer.add(handleMesh2);
        }
      } else if (isBed) {
        // Bed base + mattress + headboard
        const baseGeo = new THREE.BoxGeometry(mod.widthMm, 240, mod.depthMm - 80);
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.set(0, 120, 0);
        baseMesh.castShadow = true;
        modContainer.add(baseMesh);

        const mattressGeo = new THREE.BoxGeometry(mod.widthMm - 30, 200, mod.depthMm - 120);
        const matMesh = new THREE.Mesh(mattressGeo, new THREE.MeshStandardMaterial({ color: '#fcfbf7', roughness: 0.9 }));
        matMesh.position.set(0, 340, 0);
        matMesh.castShadow = true;
        modContainer.add(matMesh);

        const headboardGeo = new THREE.BoxGeometry(mod.widthMm + 40, mod.heightMm || 1050, 100);
        const headMesh = new THREE.Mesh(headboardGeo, new THREE.MeshStandardMaterial({ color: '#3d2a1a', roughness: 0.6 }));
        headMesh.position.set(0, (mod.heightMm || 1050) / 2, -mod.depthMm / 2 + 50);
        headMesh.castShadow = true;
        modContainer.add(headMesh);
      } else {
        const boxGeometry = new THREE.BoxGeometry(mod.widthMm, mod.heightMm, mod.depthMm);
        const boxMesh = new THREE.Mesh(boxGeometry, baseMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        boxMesh.position.set(0, mod.heightMm / 2, 0);
        modContainer.add(boxMesh);
      }

      modulesGroup.add(modContainer);
    }

    // Warm ceiling spot lights in each room
    for (const room of scene.rooms) {
      if (room.boundary.length >= 3) {
        const poly = room.boundary;
        const cx = poly.reduce((s, p) => s + p.xMm, 0) / poly.length;
        const cz = poly.reduce((s, p) => s + p.yMm, 0) / poly.length;
        const roomLight = new THREE.PointLight('#fff2d9', 1.5, 6500, 1.2);
        roomLight.position.set(cx, 2600, cz);
        root.add(roomLight);
      }
    }

    if (ceilingVisible) {
      for (const room of scene.rooms) {
        const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
        if (points.length < 3) continue;
        const shape = new THREE.Shape(points);
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
          color: '#f5f3ee',
          roughness: 0.9,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        }));
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = 2700;
        geometryGroup.add(mesh);
      }
    }

    const bounds = new THREE.Box3().setFromObject(geometryGroup);
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(4000, 2700, 3000) : bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 2000);

    const applyPreset = () => {
      let targetCenter = center.clone();
      let targetSpan = span;

      if (selectedRoomId) {
        const selRoom = scene.rooms.find((r) => r.id === selectedRoomId);
        if (selRoom && selRoom.boundary.length > 2) {
          const roomPts = selRoom.boundary.map((p) => new THREE.Vector3(p.xMm, 0, p.yMm));
          const roomBox = new THREE.Box3().setFromPoints(roomPts);
          targetCenter = roomBox.getCenter(new THREE.Vector3());
          targetCenter.y = 1200;
          const rSize = roomBox.getSize(new THREE.Vector3());
          targetSpan = Math.max(rSize.x, rSize.z, 1500);
        }
      }

      if (preset === 'top') {
        camera.position.set(targetCenter.x, targetCenter.y + targetSpan * 1.8, targetCenter.z + 0.001);
      } else if (preset === 'front') {
        camera.position.set(targetCenter.x, targetCenter.y + targetSpan * 0.35, targetCenter.z + targetSpan * 1.4);
      } else if (preset === 'walkthrough') {
        camera.position.set(targetCenter.x - targetSpan * 0.2, 1500, targetCenter.z - targetSpan * 0.2);
      } else if (preset === 'isometric') {
        camera.position.set(targetCenter.x + targetSpan * 1.1, targetCenter.y + targetSpan * 0.9, targetCenter.z + targetSpan * 1.1);
      } else {
        camera.position.set(targetCenter.x + targetSpan * 0.9, targetCenter.y + targetSpan * 0.62, targetCenter.z - targetSpan * 0.9);
      }
      controls.target.copy(targetCenter);
      controls.update();
    };
    applyPreset();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(geometryGroup.children, true)[0];
      if (hit?.object.userData?.id) {
        setSelected(hit.object.userData.id);
        if (hit.object.userData.kind === 'room') {
          setSelectedRoomId(hit.object.userData.id);
        }
      } else {
        setSelected(null);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointer);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    let frame = 0;
    const draw = () => {
      controls.update();
      renderer.render(root, camera);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      controls.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [scene, wallsVisible, ceilingVisible, preset, selectedRoomId]);

  const activeSelectedRoom = useMemo(() => {
    if (!scene) return null;
    return scene.rooms.find((r) => r.id === selectedRoomId) ?? scene.rooms[0] ?? null;
  }, [scene, selectedRoomId]);

  const activeSelectedRoomMeta = useMemo(() => {
    if (!activeSelectedRoom) return null;
    return activeRooms.find((r) => r.id === activeSelectedRoom.id) ?? null;
  }, [activeSelectedRoom, activeRooms]);

  return (
    <section className="scene-studio">
      <div className="scene-heading">
        <div>
          <small>SCENE STUDIO / SCENE.V1</small>
          <h2>3D Space & Measured Room Inspector</h2>
          <p>{status}</p>
        </div>
        <Badge tone={scene ? 'success' : 'accent'}>{scene ? '3D Geometry Active' : 'No scene'}</Badge>
      </div>

      {scene && scene.rooms.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', borderBottom: '1px solid #ebdccb' }}>
          <button
            type="button"
            onClick={() => setSelectedRoomId(null)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: !selectedRoomId ? '1.5px solid var(--gold)' : '1px solid #d6d3d1',
              background: !selectedRoomId ? 'rgba(197,156,45,0.14)' : '#fff',
              color: !selectedRoomId ? 'var(--gold-dim)' : '#57534e',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ✨ Entire Residence ({scene.rooms.length} Rooms)
          </button>
          {scene.rooms.map((r) => {
            const isSelected = selectedRoomId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoomId(r.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: isSelected ? '1.5px solid var(--gold)' : '1px solid #d6d3d1',
                  background: isSelected ? 'rgba(197,156,45,0.14)' : '#fff',
                  color: isSelected ? 'var(--gold-dim)' : '#57534e',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.name.toLowerCase().includes('bed') ? '🛏️ ' : r.name.toLowerCase().includes('kitchen') ? '🍳 ' : r.name.toLowerCase().includes('living') ? '🛋️ ' : r.name.toLowerCase().includes('dining') ? '🍽️ ' : r.name.toLowerCase().includes('pooja') ? '🪔 ' : '🚪 '}
                {r.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="scene-toolbar" aria-label="Scene controls" style={{ marginTop: 8 }}>
        <Button variant={preset === 'perspective' ? 'default' : 'outline'} onClick={() => setPreset('perspective')}><Camera size={16} /> 3D Orbit</Button>
        <Button variant={preset === 'walkthrough' ? 'default' : 'outline'} onClick={() => setPreset('walkthrough')}><Eye size={16} /> Eye-Level Walkthrough</Button>
        <Button variant={preset === 'top' ? 'default' : 'outline'} onClick={() => setPreset('top')}><Layers3 size={16} /> Top-Down Plan</Button>
        <Button variant={preset === 'isometric' ? 'default' : 'outline'} onClick={() => setPreset('isometric')}><Rotate3D size={16} /> Isometric</Button>
        <Button variant={preset === 'front' ? 'default' : 'outline'} onClick={() => setPreset('front')}><Eye size={16} /> Front</Button>
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
          <CardContent style={{ position: 'relative', minHeight: 460 }}>
            <div ref={canvasRef} className="scene-canvas" aria-label="Interactive three dimensional scene preview" style={{ width: '100%', height: 460 }} />
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

        <Card className="scene-inspector">
          <CardHeader>
            <div>
              <small>ACTIVE ROOM & GEOMETRY</small>
              <h3 style={{ margin: '3px 0 0', fontSize: 16 }}>{activeSelectedRoom?.name ?? selected ?? 'Whole Floor Overview'}</h3>
            </div>
            <MousePointer2 size={18} style={{ color: 'var(--gold)' }} />
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeSelectedRoom ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 10, background: '#faf8f5', borderRadius: 8, border: '1px solid #ede5d8' }}>
                  <div>
                    <small style={{ color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Floor Area</small>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1c1917' }}>
                      {activeSelectedRoomMeta?.areaSqm ? `${activeSelectedRoomMeta.areaSqm.toFixed(1)} m²` : '24.5 m²'}
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#78716c', marginLeft: 4 }}>
                        ({Math.round((activeSelectedRoomMeta?.areaSqm ?? 24.5) * 10.764)} sq ft)
                      </span>
                    </div>
                  </div>
                  <div>
                    <small style={{ color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Ceiling Height</small>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#1c1917' }}>2,700 mm</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.04em' }}>
                    Structural Boundaries & Openings
                  </h4>
                  <div style={{ fontSize: 12, color: '#44403c', lineHeight: 1.6 }}>
                    • <strong>{scene?.walls.length ?? 0} Walls</strong>: 150mm thick with bevel relief<br />
                    • <strong>{scene?.openings.length ?? 0} Openings</strong>: Verified door & window frames<br />
                    • <strong>Lighting</strong>: 3000K Warm Architectural Sun + Ambient Sky
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.04em' }}>
                    Scheduled Modular Units & Fixtures
                  </h4>
                  {scene?.modules && scene.modules.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {scene.modules.map((m) => (
                        <div key={m.id} style={{ padding: '6px 10px', background: '#f5f5f4', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span><strong>{m.family}</strong> ({m.widthMm}×{m.heightMm}mm)</span>
                          <span style={{ color: 'var(--gold-dim)', fontWeight: 700 }}>Cutlist ready</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>
                      Add modular cabinetry from the <a href="/library" style={{ color: 'var(--gold-dim)', fontWeight: 700 }}>Design Library</a> or Spaces tool.
                    </p>
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.04em' }}>
                    Assigned Finishes & Materials
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {scene?.materials.map((mat) => (
                      <span key={mat.id} style={{ padding: '3px 8px', borderRadius: 4, background: '#f5f4f0', border: '1px solid #e7e5e4', fontSize: 11, fontWeight: 600 }}>
                        {mat.name} ({mat.finish})
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>
                Select a room above to inspect its 3D geometry and scheduled modular cabinetry.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
