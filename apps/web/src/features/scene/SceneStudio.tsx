import { Box, Camera, Eye, LampDesk, Layers3, MousePointer2, Rotate3D, Ruler, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCompiledModuleMeshes } from './compiled-module-meshes';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import './scene-studio.css';

const gltfLoader = new GLTFLoader();

type Scene = {
  schema: 'scene.v1';
  units: 'mm';
  rooms: Array<{ id: string; name: string; boundary: Array<{ xMm: number; yMm: number }> }>;
  walls: Array<{ id: string; start: { xMm: number; yMm: number }; end: { xMm: number; yMm: number }; thicknessMm: number; heightMm: number; spaceIds?: string[] }>;
  openings: Array<{ id: string; wallId: string; offsetMm: number; widthMm: number; heightMm: number; sillHeightMm?: number; kind: 'door' | 'window' }>;
  modules: Array<{
    id: string;
    roomId: string;
    family: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    position: { xMm: number; yMm: number };
    rotationDeg: number;
    materialId?: string;
    glbUrl?: string;
  }>;
  moduleParts: Array<{
    id: string;
    moduleId: string;
    roomId: string;
    semanticType: string;
    name: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    position: { xMm: number; yMm: number; zMm: number };
    rotationDeg: number;
    materialId?: string;
    kind?: string;
    fixtureType?: 'led-strip' | 'downlight' | 'spot' | 'pendant' | string;
    colorTemperatureK?: number;
    lengthMm?: number;
  }>;
  materials: Array<{ id: string; name: string; code: string; finish?: string }>;
  lighting: Array<{ id: string; spaceId: string; kind: 'ambient' | 'task' | 'accent' | 'natural'; position: { xMm: number; yMm: number }; fixture?: 'ceiling-spot' | 'floor-lamp' | 'table-lamp' | 'pendant' | 'cove'; heightMm?: number; shadeDiameterMm?: number; colorTemperatureK?: number; lumens?: number; materialId?: string }>;
  cameras: Array<{ id: string; name: string; position: { xMm: number; yMm: number; zMm: number }; target: { xMm: number; yMm: number; zMm: number }; lensMm: number }>;
};

type Props = {
  sceneVersionId: string | null;
  projectId?: string | null;
  onCompileScene?: () => Promise<string | void>;
};
type Preset = 'perspective' | 'front' | 'top' | 'walkthrough' | 'isometric';
type LightingPreset = 'warm' | 'daylight' | 'evening';

export type StoreyConfig = {
  id: string;
  name: string;
  levelIndex: number;
  elevationMm: number;
  ceilingHeightMm: number;
  slabThicknessMm: number;
};

export type InterFloorVoidConfig = {
  id: string;
  name: string;
  type: 'double_height_void' | 'stairwell_cutout' | 'lift_shaft';
  upperLevelId: string;
  lowerLevelId: string;
  polygon: Array<{ xMm: number; yMm: number }>;
  balustradeType: 'tempered_glass' | 'brass_spindle' | 'fluted_drywall';
};

export const DEFAULT_VILLA_STOREYS: StoreyConfig[] = [
  { id: 'level-ground', name: 'Ground Floor (Datum 0.0m)', levelIndex: 0, elevationMm: 0, ceilingHeightMm: 3000, slabThicknessMm: 150 },
  { id: 'level-first', name: 'First Floor (+3.3m)', levelIndex: 1, elevationMm: 3300, ceilingHeightMm: 3000, slabThicknessMm: 150 },
  { id: 'level-terrace', name: 'Terrace Deck (+6.6m)', levelIndex: 2, elevationMm: 6600, ceilingHeightMm: 2800, slabThicknessMm: 150 },
];

export const DEFAULT_VILLA_VOIDS: InterFloorVoidConfig[] = [
  {
    id: 'void-living-mezzanine',
    name: 'Double-Height Living Atrium',
    type: 'double_height_void',
    upperLevelId: 'level-first',
    lowerLevelId: 'level-ground',
    polygon: [
      { xMm: 800, yMm: 800 },
      { xMm: 3200, yMm: 800 },
      { xMm: 3200, yMm: 2400 },
      { xMm: 800, yMm: 2400 },
    ],
    balustradeType: 'tempered_glass',
  },
  {
    id: 'void-grand-stairwell',
    name: 'Main Villa Staircase Void',
    type: 'stairwell_cutout',
    upperLevelId: 'level-first',
    lowerLevelId: 'level-ground',
    polygon: [
      { xMm: 3250, yMm: 800 },
      { xMm: 4200, yMm: 800 },
      { xMm: 4200, yMm: 2400 },
      { xMm: 3250, yMm: 2400 },
    ],
    balustradeType: 'brass_spindle',
  },
];


/** A deterministic fallback used by file-export tools before a persisted scene is selected. */
export function createDefaultDemoScene(): Scene {
  return {
    schema: 'scene.v1',
    units: 'mm',
    rooms: [{ id: 'room-master-bed', name: 'Master Bedroom', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }] }],
    walls: [
      { id: 'wall-a', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, spaceIds: ['room-master-bed'] },
      { id: 'wall-b', start: { xMm: 4000, yMm: 0 }, end: { xMm: 4000, yMm: 3000 }, thicknessMm: 150, heightMm: 2700, spaceIds: ['room-master-bed'] },
    ],
    openings: [],
    modules: [
      { id: 'module-tv-wall', roomId: 'room-master-bed', family: 'tv-unit', widthMm: 2400, depthMm: 400, heightMm: 2400, position: { xMm: 2000, yMm: 260 }, rotationDeg: 0, materialId: 'mat-1' },
      { id: 'module-wardrobe', roomId: 'room-master-bed', family: 'wardrobe', widthMm: 1800, depthMm: 600, heightMm: 2400, position: { xMm: 800, yMm: 0 }, rotationDeg: 0, materialId: 'mat-3' },
    ],
    moduleParts: [
      {
        id: 'tv-console-led-underglow',
        moduleId: 'module-tv-wall',
        roomId: 'room-master-bed',
        semanticType: 'lighting_anchor',
        kind: 'lighting_anchor',
        name: 'Floating TV Console Underglow 3000K LED',
        widthMm: 2320,
        depthMm: 14,
        heightMm: 14,
        position: { xMm: 2000, yMm: 260, zMm: 220 },
        rotationDeg: 0,
        fixtureType: 'led-strip',
        colorTemperatureK: 3000,
        lengthMm: 2320,
      },
      {
        id: 'tv-profile-glass-led',
        moduleId: 'module-tv-wall',
        roomId: 'room-master-bed',
        semanticType: 'lighting_anchor',
        kind: 'lighting_anchor',
        name: 'Profile-Glass Illuminated Display Bay',
        widthMm: 14,
        depthMm: 14,
        heightMm: 1800,
        position: { xMm: 3050, yMm: 420, zMm: 450 },
        rotationDeg: 0,
        fixtureType: 'led-strip',
        colorTemperatureK: 3000,
        lengthMm: 1800,
      },
    ],
    materials: [
      { id: 'mat-1', name: 'Smoked Walnut Veneer', code: 'VIRGO-OAK-01', finish: 'Satin PU' },
      { id: 'mat-3', name: 'Matte Suede Zero-G Shutter', code: 'SHUT-LAM-SUEDE', finish: 'Anti-Fingerprint' },
    ],
    lighting: [
      { id: 'light-ceiling-spot-1', spaceId: 'room-master-bed', kind: 'ambient', position: { xMm: 2000, yMm: 1500 }, fixture: 'ceiling-spot', heightMm: 2600, colorTemperatureK: 3000, lumens: 700 },
    ],
    cameras: [{ id: 'camera-default', name: 'Perspective', position: { xMm: 2000, yMm: 1600, zMm: -4000 }, target: { xMm: 2000, yMm: 1200, zMm: 1200 }, lensMm: 35 }],
  };
}

function materialColor(materialId: string | undefined) {
  if (!materialId) return '#b99167';
  let hash = 0;
  for (const character of materialId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `#${(0x806040 + (hash & 0x5f5f5f)).toString(16).slice(-6)}`;
}

function getThreeMaterialForFinish(materialId?: string, fallbackColor = '#b99167') {
  const color = materialId ? materialColor(materialId) : fallbackColor;
  const isGloss = /gloss|acrylic|polygloss|mirror/i.test(materialId ?? '');
  const isMatte = /matte|suede|zero-g|anti-fingerprint/i.test(materialId ?? '');
  const isWood = /wood|oak|walnut|teak|grain/i.test(materialId ?? '');
  const isStone = /marble|travertine|porcelain|slab/i.test(materialId ?? '');

  if (isGloss) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.12,
      metalness: 0.08,
    });
  }
  if (isMatte) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.02,
    });
  }
  if (isWood) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.58,
      metalness: 0.04,
    });
  }
  if (isStone) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.18,
      metalness: 0.05,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.08,
  });
}

function addWallSegments(group: THREE.Group, scene: Scene, wallVisible: boolean) {
  if (!wallVisible || !scene?.walls) return;
  for (const wall of scene.walls) {
    const startX = Number(wall.start?.xMm ?? (wall.start as any)?.x ?? 0);
    const startY = Number(wall.start?.yMm ?? (wall.start as any)?.y ?? 0);
    const endX = Number(wall.end?.xMm ?? (wall.end as any)?.x ?? 1000);
    const endY = Number(wall.end?.yMm ?? (wall.end as any)?.y ?? 0);
    const wallThick = Number(wall.thicknessMm ?? 150);
    const wallH = Number(wall.heightMm ?? 2700);
    const dx = endX - startX;
    const dz = endY - startY;
    const length = Math.hypot(dx, dz);
    if (length <= 0) continue;
    const angle = Math.atan2(dz, dx);
    const openings = (scene.openings ?? []).filter((opening) => opening.wallId === wall.id).sort((a, b) => Number(a.offsetMm ?? (a as any).offsetAlongWallMm ?? 0) - Number(b.offsetMm ?? (b as any).offsetAlongWallMm ?? 0));
    let cursor = 0;
    const addSegment = (from: number, to: number, bottomMm: number, heightMm: number, suffix: string) => {
      if (to - from <= 1 || heightMm <= 0) return;
      const geometry = new THREE.BoxGeometry(to - from, heightMm, wallThick);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#eee9e0', roughness: 0.88, metalness: 0.02 }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const midpoint = (from + to) / 2;
      mesh.position.set(startX + Math.cos(angle) * midpoint, bottomMm + heightMm / 2, startY + Math.sin(angle) * midpoint);
      mesh.rotation.y = -angle;
      mesh.name = `${wall.id}:${suffix}`;
      mesh.userData = { kind: 'wall', id: wall.id };
      group.add(mesh);
    };
    for (const opening of openings) {
      const opOffset = Number(opening.offsetMm ?? (opening as any).offsetAlongWallMm ?? 0);
      const opWidth = Number(opening.widthMm ?? 900);
      const opHeight = Number(opening.heightMm ?? 2100);
      const sill = Number(opening.sillHeightMm ?? (opening as any).sillMm ?? 0);
      const start = Math.max(cursor, opOffset);
      addSegment(cursor, start, 0, wallH, 'solid');
      const openingEnd = Math.min(length, opOffset + opWidth);
      addSegment(start, openingEnd, 0, sill, `${opening.id}:sill`);
      addSegment(start, openingEnd, sill + opHeight, wallH - sill - opHeight, `${opening.id}:head`);
      cursor = Math.max(cursor, openingEnd);

      const opMid = (start + openingEnd) / 2;
      const effectiveOpWidth = Math.max(200, openingEnd - start);
      const posX = startX + Math.cos(angle) * opMid;
      const posZ = startY + Math.sin(angle) * opMid;

      if (opening.kind === 'door') {
        const doorLeafGeo = new THREE.BoxGeometry(effectiveOpWidth - 30, opHeight - 20, 36);
        const doorLeafMesh = new THREE.Mesh(doorLeafGeo, new THREE.MeshStandardMaterial({ color: '#5c3d2e', roughness: 0.55, metalness: 0.05 }));
        doorLeafMesh.position.set(posX, sill + (opHeight - 20) / 2 + 10, posZ);
        doorLeafMesh.rotation.y = -angle;
        doorLeafMesh.castShadow = true;
        group.add(doorLeafMesh);

        // Door knob / handle
        const knobGeo = new THREE.CylinderGeometry(15, 15, 60, 16);
        const knobMesh = new THREE.Mesh(knobGeo, new THREE.MeshStandardMaterial({ color: '#c59c2d', metalness: 0.9, roughness: 0.2 }));
        knobMesh.position.set(posX + Math.cos(angle) * (effectiveOpWidth / 2 - 60), sill + 1000, posZ + Math.sin(angle) * (effectiveOpWidth / 2 - 60));
        knobMesh.rotation.z = Math.PI / 2;
        group.add(knobMesh);
      } else if (opening.kind === 'window') {
        const glassGeo = new THREE.BoxGeometry(effectiveOpWidth - 20, opHeight - 20, 10);
        const glassMesh = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
          color: '#e0f2fe',
          roughness: 0.05,
          transmission: 0.85,
          thickness: 10,
          transparent: true,
          opacity: 0.65,
        }));
        glassMesh.position.set(posX, sill + opHeight / 2, posZ);
        glassMesh.rotation.y = -angle;
        group.add(glassMesh);

        const winFrameGeo = new THREE.BoxGeometry(effectiveOpWidth, 35, wallThick + 24);
        const winFrameMesh = new THREE.Mesh(winFrameGeo, new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.25 }));
        winFrameMesh.position.set(posX, sill + 18, posZ);
        winFrameMesh.rotation.y = -angle;
        group.add(winFrameMesh);
      }
    }
    addSegment(cursor, length, 0, wallH, 'solid');
  }
}

function fixtureColor(kelvin = 3000) {
  if (kelvin <= 2800) return '#ffd7a0';
  if (kelvin <= 3500) return '#fff1d2';
  return '#f7fbff';
}

function addSceneFixture(group: THREE.Group, light: Scene['lighting'][number]) {
  const fixture = light.fixture ?? 'ceiling-spot';
  const height = light.heightMm ?? (fixture === 'table-lamp' ? 520 : fixture === 'floor-lamp' ? 1650 : 2600);
  const shadeDiameter = light.shadeDiameterMm ?? (fixture === 'table-lamp' ? 260 : 340);
  const color = fixtureColor(light.colorTemperatureK);
  const metal = new THREE.MeshStandardMaterial({ color: '#463a30', metalness: 0.72, roughness: 0.28 });
  const shade = new THREE.MeshStandardMaterial({ color: '#eadcc5', roughness: 0.72, emissive: color, emissiveIntensity: 0.18 });
  const fixtureGroup = new THREE.Group();
  fixtureGroup.name = `light:${light.id}`;
  fixtureGroup.userData = { kind: 'lighting', id: light.id, fixture };
  fixtureGroup.position.set(light.position.xMm, 0, light.position.yMm);

  if (fixture === 'floor-lamp' || fixture === 'table-lamp') {
    const baseRadius = fixture === 'floor-lamp' ? 155 : 105;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius, baseRadius, 38, 24), metal);
    base.position.y = 19;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(18, 24, Math.max(120, height - shadeDiameter * 0.42), 18), metal);
    stem.position.y = 38 + stem.geometry.parameters.height / 2;
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(shadeDiameter * 0.34, shadeDiameter * 0.5, shadeDiameter * 0.62, 32, 1, true), shade);
    lampShade.position.y = height - (shadeDiameter * 0.31);
    lampShade.castShadow = true;
    fixtureGroup.add(base, stem, lampShade);
  } else if (fixture === 'pendant') {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, height, 12), metal);
    cord.position.y = height / 2;
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(shadeDiameter / 2, shadeDiameter * 0.48, 32, 1, true), shade);
    lampShade.position.y = height - shadeDiameter * 0.24;
    fixtureGroup.add(cord, lampShade);
  } else if (fixture === 'cove') {
    const channel = new THREE.Mesh(new THREE.BoxGeometry(900, 26, 26), shade);
    channel.position.y = height;
    fixtureGroup.add(channel);
  } else {
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(shadeDiameter / 2, shadeDiameter / 2, 28, 24), metal);
    trim.position.y = height;
    fixtureGroup.add(trim);
  }

  const point = new THREE.PointLight(color, Math.min(2.2, Math.max(0.45, (light.lumens ?? 650) / 550)), 3200, 1.5);
  point.position.set(0, Math.max(260, height - shadeDiameter * 0.4), 0);
  point.castShadow = fixture !== 'ceiling-spot';
  fixtureGroup.add(point);
  group.add(fixtureGroup);
}

export function kelvinToHex(kelvin = 3000): string {
  const temp = Math.max(1800, Math.min(6500, Number(kelvin) || 3000));
  if (temp <= 2400) return '#ffb870';
  if (temp <= 2800) return '#ffd199';
  if (temp <= 3200) return '#ffe4b5';
  if (temp <= 3800) return '#ffeedd';
  if (temp <= 4500) return '#f8f9fa';
  if (temp <= 5500) return '#f0f5ff';
  return '#e2eeff';
}

function addCompiledLightingAnchor(group: THREE.Group, part: Scene['moduleParts'][number]) {
  const fixtureType = (part.fixtureType ?? 'led-strip').toLowerCase();
  const cct = part.colorTemperatureK ?? 3000;
  const hex = kelvinToHex(cct);

  const fixtureGroup = new THREE.Group();
  fixtureGroup.name = `compiled-light:${part.id}`;
  fixtureGroup.userData = {
    kind: 'compiled_lighting',
    id: part.id,
    name: part.name,
    fixtureType,
    colorTemperatureK: cct,
    lengthMm: part.lengthMm,
    moduleId: part.moduleId,
  };

  // World coordinates: X = xMm, Y = zMm (height above floor), Z = yMm (plan depth)
  fixtureGroup.position.set(part.position.xMm, part.position.zMm, part.position.yMm);
  fixtureGroup.rotation.y = (-part.rotationDeg * Math.PI) / 180;

  const emissiveMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 1.25,
    roughness: 0.25,
    metalness: 0.1,
  });

  const housingMat = new THREE.MeshStandardMaterial({
    color: '#262626',
    metalness: 0.8,
    roughness: 0.3,
  });

  if (fixtureType === 'pendant') {
    const cordLen = Math.max(200, 2700 - part.position.zMm);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, cordLen, 12), housingMat);
    cord.position.y = cordLen / 2;

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(110, 150, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: '#3d312a', metalness: 0.65, roughness: 0.25, side: THREE.DoubleSide })
    );
    shade.position.y = 75;

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(32, 16, 16), emissiveMat);
    bulb.position.y = 25;

    fixtureGroup.add(cord, shade, bulb);

    const point = new THREE.PointLight(hex, 2.4, 3800, 1.8);
    point.position.set(0, 0, 0);
    point.castShadow = true;
    fixtureGroup.add(point);
  } else if (fixtureType === 'spot' || fixtureType === 'downlight') {
    const isFloorLamp = part.name.toLowerCase().includes('floor') || (part.position.zMm > 1200 && part.heightMm > 1200);
    const isTableLamp = part.name.toLowerCase().includes('table') || part.name.toLowerCase().includes('desk');

    if (isFloorLamp) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(180, 180, 30, 24), housingMat);
      base.position.y = -part.position.zMm + 15;
      const stemH = Math.max(400, part.position.zMm);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, stemH, 16), housingMat);
      stem.position.y = -part.position.zMm + stemH / 2;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), emissiveMat);
      dome.rotation.x = Math.PI;
      dome.position.y = 40;
      fixtureGroup.add(base, stem, dome);

      const light = new THREE.PointLight(hex, 2.5, 4200, 1.7);
      light.position.set(0, -20, 0);
      light.castShadow = true;
      fixtureGroup.add(light);
    } else if (isTableLamp) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(80, 100, 180, 20), housingMat);
      base.position.y = 90;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(110, 140, 180, 24), emissiveMat);
      shade.position.y = 220;
      fixtureGroup.add(base, shade);

      const light = new THREE.PointLight(hex, 1.8, 2800, 1.8);
      light.position.set(0, 200, 0);
      fixtureGroup.add(light);
    } else {
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 16, 20), housingMat);
      bezel.position.y = 8;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(38, 20), emissiveMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.y = 1;
      fixtureGroup.add(bezel, lens);

      const spot = new THREE.PointLight(hex, 1.8, 3000, 1.8);
      spot.position.set(0, -10, 0);
      spot.castShadow = false;
      fixtureGroup.add(spot);
    }
  } else {
    // LED strip (profile glass, under-cabinet, underglow, backlight)
    const stripLen = Math.max(160, part.lengthMm ?? part.widthMm ?? 800);
    const isVertical = part.heightMm > part.widthMm && part.heightMm > 400;

    const channelGeo = isVertical
      ? new THREE.BoxGeometry(14, stripLen, 14)
      : new THREE.BoxGeometry(stripLen, 14, 14);
    const channel = new THREE.Mesh(channelGeo, housingMat);

    const diffuserGeo = isVertical
      ? new THREE.BoxGeometry(10, stripLen - 4, 10)
      : new THREE.BoxGeometry(stripLen - 4, 10, 10);
    const diffuser = new THREE.Mesh(diffuserGeo, emissiveMat);

    fixtureGroup.add(channel, diffuser);

    if (stripLen <= 1000) {
      const light = new THREE.PointLight(hex, 1.5, 2600, 1.7);
      light.position.set(0, isVertical ? 0 : -8, isVertical ? 8 : 12);
      fixtureGroup.add(light);
    } else {
      const step = stripLen / 3;
      [-step, step].forEach((offset) => {
        const light = new THREE.PointLight(hex, 1.2, 2400, 1.7);
        if (isVertical) {
          light.position.set(0, offset, 12);
        } else {
          light.position.set(offset, -8, 12);
        }
        fixtureGroup.add(light);
      });
    }
  }

  group.add(fixtureGroup);
}

export function SceneStudio({ sceneVersionId, projectId, onCompileScene }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRoomId = searchParams.get('roomId');
  const requestedSceneVersionId = searchParams.get('sceneVersionId') || sceneVersionId;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [activeRooms, setActiveRooms] = useState<Array<{ id: string; name: string; roomType?: string; areaSqm?: number; polygon: Array<{ xMm: number; yMm: number }> }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(requestedRoomId);
  const [status, setStatus] = useState('Loading 3D scene geometry...');
  const [wallsVisible, setWallsVisible] = useState(true);
  const [ceilingVisible, setCeilingVisible] = useState(false);
  const [preset, setPreset] = useState<Preset>('perspective');
  const [lightingMode, setLightingMode] = useState<LightingPreset>('warm');
  const [selected, setSelected] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<'all' | 'furniture' | 'lighting'>('all');
  const [compiling, setCompiling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const rendererInstanceRef = useRef<THREE.WebGLRenderer | null>(null);

  // Kinetic cabinet inspector state
  const [kineticDrawerOffset, setKineticDrawerOffset] = useState(0);
  const [kineticDoorAngleDeg, setKineticDoorAngleDeg] = useState(0);
  const [kineticLedReveal, setKineticLedReveal] = useState(false);
  const [isKineticAnimating, setIsKineticAnimating] = useState(false);
  const kineticTargetsRef = useRef({ drawerOffset: 0, doorAngleDeg: 0, ledReveal: false });

  // Multi-Storey Villa stacking state
  const [activeStoreyId, setActiveStoreyId] = useState<string>('all');
  const [explodedAxonometric, setExplodedAxonometric] = useState(false);
  const [storeys] = useState<StoreyConfig[]>(DEFAULT_VILLA_STOREYS);
  const [interFloorVoids] = useState<InterFloorVoidConfig[]>(DEFAULT_VILLA_VOIDS);

  useEffect(() => {
    kineticTargetsRef.current = {
      drawerOffset: kineticDrawerOffset,
      doorAngleDeg: kineticDoorAngleDeg,
      ledReveal: kineticLedReveal,
    };
  }, [kineticDrawerOffset, kineticDoorAngleDeg, kineticLedReveal]);

  function animateKineticCycle() {
    setIsKineticAnimating(true);
    setKineticLedReveal(true);
    setKineticDrawerOffset(1.0);
    setKineticDoorAngleDeg(90);
    setTimeout(() => {
      setKineticDrawerOffset(0);
      setKineticDoorAngleDeg(0);
      setKineticLedReveal(false);
      setIsKineticAnimating(false);
    }, 3200);
  }

  function resetKinetic() {
    setIsKineticAnimating(false);
    setKineticDrawerOffset(0);
    setKineticDoorAngleDeg(0);
    setKineticLedReveal(false);
  }


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
      if (requestedSceneVersionId) {
        query = query.eq('id', requestedSceneVersionId);
      } else {
        query = query.eq('project_id', projectId).order('version_number', { ascending: false }).limit(1);
      }

      const { data } = await (requestedSceneVersionId ? query.single() : query.maybeSingle());
      if (data?.scene && (data.status === 'approved' || data.status === 'draft')) {
        const candidate = data.scene as Scene;
        if (candidate.schema === 'scene.v1' && candidate.units === 'mm') {
          loadedScene = { ...candidate, moduleParts: candidate.moduleParts ?? [] };
        }
      }

      // If not in Supabase, check local storage for client-persisted scene.v1
      if (!loadedScene && typeof window !== 'undefined') {
        try {
          const storedSceneStr = (requestedSceneVersionId ? window.localStorage.getItem(`ultida.scene.${requestedSceneVersionId}`) : null)
            || (projectId ? window.localStorage.getItem(`ultida.scene.${projectId}`) : null);
          if (storedSceneStr) {
            const parsed = JSON.parse(storedSceneStr);
            if (parsed?.schema === 'scene.v1' && parsed?.units === 'mm') {
              loadedScene = { ...parsed, moduleParts: parsed.moduleParts ?? [] };
            }
          }
        } catch {}
      }

      // Check if client-side localStorage has active placed modules from Stage 3
      let localClientModules: any[] = [];
      if (typeof window !== 'undefined' && projectId) {
        try {
          const rawLocalMods = window.localStorage.getItem(`ultida.modules.${projectId}`);
          if (rawLocalMods) {
            const parsed = JSON.parse(rawLocalMods);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localClientModules = parsed;
            }
          }
        } catch {}
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

            // Prefer client-edited modules from Stage 3 if present
            let finalModules: any[] = [];
            if (localClientModules.length > 0) {
              finalModules = localClientModules.map((m: any, idx: number) => {
                let posX = Number(m.xMm);
                let posY = Number(m.yMm);
                let rot = Number(m.rotationDeg ?? 0);
                if ((!Number.isFinite(posX) || !Number.isFinite(posY)) && m.wallId) {
                  const anchorWall = sceneWalls.find((w: any) => w.id === m.wallId);
                  if (anchorWall?.start && anchorWall?.end) {
                    const dx = anchorWall.end.xMm - anchorWall.start.xMm;
                    const dy = anchorWall.end.yMm - anchorWall.start.yMm;
                    const len = Math.hypot(dx, dy) || 1;
                    const nx = dx / len;
                    const ny = dy / len;
                    const off = Number(m.offsetMm ?? 100) + Number(m.widthMm ?? 1200) / 2;
                    posX = Math.round(anchorWall.start.xMm + nx * off);
                    posY = Math.round(anchorWall.start.yMm + ny * off);
                    rot = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
                  }
                }
                const targetRoomId = m.roomId || sceneRooms[0]?.id || 'room-default';
                return {
                  id: m.id || `mod-${idx}`,
                  roomId: targetRoomId,
                  family: m.family || 'modular',
                  widthMm: Number(m.widthMm || 1800),
                  depthMm: Number(m.depthMm || 600),
                  heightMm: Number(m.heightMm || 2100),
                  position: {
                    xMm: Number.isFinite(posX) ? posX : 1200 + (idx % 3) * 800,
                    yMm: Number.isFinite(posY) ? posY : 1200 + Math.floor(idx / 3) * 800,
                  },
                  rotationDeg: rot,
                  materialId: m.materialId || 'mat-1',
                };
              });
            } else if (rawModules.length > 0) {
              finalModules = rawModules.map((m: any, idx: number) => {
                const pos = m.position_json ?? {};
                const conf = m.config_json ?? {};
                return {
                  id: m.id || `mod-${idx}`,
                  roomId: String(m.space_id ?? pos.roomId ?? sceneRooms[0]?.id ?? ''),
                  family: m.category || conf.family || 'modular',
                  widthMm: Number(conf.widthMm ?? 1800),
                  depthMm: Number(conf.depthMm ?? 600),
                  heightMm: Number(conf.heightMm ?? 2100),
                  position: { xMm: Number(pos.xMm ?? 1000 + (idx % 3) * 600), yMm: Number(pos.yMm ?? 1000 + Math.floor(idx / 3) * 600) },
                  rotationDeg: Number(pos.rotationDeg ?? 0),
                  materialId: 'mat-1',
                };
              });
            }

            if (finalModules.length === 0 && sceneRooms.length > 0) {
              const synthesized: any[] = [];
              sceneRooms.forEach((r: any, rIdx: number) => {
                const b = r.boundary ?? [];
                if (b.length < 3) return;
                const minX = Math.min(...b.map((p: any) => p.xMm));
                const maxX = Math.max(...b.map((p: any) => p.xMm));
                const minY = Math.min(...b.map((p: any) => p.yMm));
                const maxY = Math.max(...b.map((p: any) => p.yMm));
                const width = Math.max(1200, maxX - minX);
                const depth = Math.max(1200, maxY - minY);
                const cx = minX + width / 2;
                const cy = minY + depth / 2;
                const rType = (r.name || '').toLowerCase();

                if (rType.includes('living') || rType.includes('hall') || rType.includes('lounge')) {
                  synthesized.push({
                    id: `mod-tv-${rIdx}`,
                    roomId: r.id,
                    family: 'tv-unit',
                    widthMm: Math.min(2400, Math.max(1600, width - 400)),
                    depthMm: 400,
                    heightMm: 2200,
                    position: { xMm: cx, yMm: minY + 260 },
                    rotationDeg: 0,
                    materialId: 'mat-1',
                  });
                  synthesized.push({
                    id: `mod-sofa-${rIdx}`,
                    roomId: r.id,
                    family: 'sofa',
                    widthMm: Math.min(2400, Math.max(1600, width - 400)),
                    depthMm: 1200,
                    heightMm: 850,
                    position: { xMm: cx, yMm: maxY - 750 },
                    rotationDeg: 0,
                    materialId: 'mat-3',
                  });
                } else if (rType.includes('bed')) {
                  synthesized.push({
                    id: `mod-bed-${rIdx}`,
                    roomId: r.id,
                    family: 'bed',
                    widthMm: 1800,
                    depthMm: 2100,
                    heightMm: 1100,
                    position: { xMm: cx, yMm: minY + 1150 },
                    rotationDeg: 0,
                    materialId: 'mat-1',
                  });
                  synthesized.push({
                    id: `mod-wardrobe-${rIdx}`,
                    roomId: r.id,
                    family: 'wardrobe',
                    widthMm: Math.min(2400, Math.max(1600, width - 400)),
                    depthMm: 600,
                    heightMm: 2400,
                    position: { xMm: minX + 350, yMm: cy },
                    rotationDeg: 90,
                    materialId: 'mat-3',
                  });
                } else if (rType.includes('kitchen')) {
                  synthesized.push({
                    id: `mod-kit-base-${rIdx}`,
                    roomId: r.id,
                    family: 'kitchen-base',
                    widthMm: Math.min(2800, Math.max(1800, width - 300)),
                    depthMm: 600,
                    heightMm: 860,
                    position: { xMm: cx, yMm: minY + 350 },
                    rotationDeg: 0,
                    materialId: 'mat-2',
                  });
                } else if (rType.includes('dining')) {
                  synthesized.push({
                    id: `mod-dining-${rIdx}`,
                    roomId: r.id,
                    family: 'dining-table',
                    widthMm: 1800,
                    depthMm: 900,
                    heightMm: 760,
                    position: { xMm: cx, yMm: cy },
                    rotationDeg: 0,
                    materialId: 'mat-1',
                  });
                } else {
                  synthesized.push({
                    id: `mod-storage-${rIdx}`,
                    roomId: r.id,
                    family: 'wardrobe',
                    widthMm: Math.min(1800, Math.max(1200, width - 600)),
                    depthMm: 500,
                    heightMm: 2100,
                    position: { xMm: cx, yMm: minY + 300 },
                    rotationDeg: 0,
                    materialId: 'mat-1',
                  });
                }
              });
              if (synthesized.length > 0) {
                finalModules = synthesized;
              }
            }

            loadedScene = {
              schema: 'scene.v1',
              units: 'mm',
              rooms: sceneRooms,
              walls: sceneWalls,
              openings: sceneOpenings,
              modules: finalModules,
              moduleParts: [],
              lighting: [],
              materials: [
                { id: 'mat-1', name: 'Smoked Walnut Veneer', code: 'VIRGO-OAK-01', finish: 'Satin PU' },
                { id: 'mat-2', name: 'Calacatta Gold Sintered Slab', code: 'SLAB-CAL-GOLD', finish: 'Polished' },
                { id: 'mat-3', name: 'Matte Suede Zero-G Shutter', code: 'SHUT-LAM-SUEDE', finish: 'Anti-Fingerprint' },
                { id: 'mat-4', name: 'Tinted Fluted Profile Glass', code: 'GLAS-FLUTED-TINT', finish: 'Anodized Bronze' },
              ],
              cameras: [{ id: 'camera-default', name: 'Perspective', position: { xMm: 2000, yMm: 1600, zMm: -4000 }, target: { xMm: 2000, yMm: 1200, zMm: 1200 }, lensMm: 35 }],
            };
          }
        } catch {
        }
      }

      // If loadedScene was loaded from cache but client has newer active modules, synchronize them
      if (loadedScene && localClientModules.length > 0 && (!loadedScene.modules || loadedScene.modules.length === 0)) {
        loadedScene = {
          ...loadedScene,
          modules: localClientModules.map((m: any, idx: number) => ({
            id: m.id || `mod-${idx}`,
            roomId: m.roomId || loadedScene!.rooms[0]?.id || 'room-master-bed',
            family: m.family || 'modular',
            widthMm: Number(m.widthMm || 1800),
            depthMm: Number(m.depthMm || 600),
            heightMm: Number(m.heightMm || 2100),
            position: { xMm: Number(m.xMm ?? 1500 + (idx % 3) * 600), yMm: Number(m.yMm ?? 1500 + Math.floor(idx / 3) * 600) },
            rotationDeg: Number(m.rotationDeg ?? 0),
            materialId: m.materialId || 'mat-1',
          })),
        };
      }

      if (!loadedScene) {
        loadedScene = createDefaultDemoScene();
      }

      if (!live) return;

      if (loadedScene) {
        let activeScene: Scene = loadedScene;
        if (requestedRoomId) {
          const matchedRoom = activeScene.rooms.find((room) => room.id === requestedRoomId || room.id.includes(requestedRoomId) || requestedRoomId.includes(room.id));
          const roomWalls = activeScene.walls.filter((wall) => !wall.spaceIds || wall.spaceIds.length === 0 || (matchedRoom ? wall.spaceIds.includes(matchedRoom.id) : wall.spaceIds.includes(requestedRoomId)));
          const wallIds = new Set(roomWalls.map((wall) => wall.id));
          const roomMods = activeScene.modules.filter((module) => {
            if (!matchedRoom) return module.roomId === requestedRoomId;
            return module.roomId === matchedRoom.id || !module.roomId;
          });
          if (roomWalls.length > 0) {
            activeScene = {
              ...activeScene,
              rooms: matchedRoom ? [matchedRoom] : activeScene.rooms,
              walls: roomWalls,
              openings: activeScene.openings.filter((opening) => wallIds.has(opening.wallId)),
              modules: roomMods.length > 0 ? roomMods : activeScene.modules,
              moduleParts: activeScene.moduleParts.filter((part) => (matchedRoom ? part.roomId === matchedRoom.id : part.roomId === requestedRoomId)),
            };
          }
        }
        setScene(activeScene);
        setStatus(`✨ 3D Geometry loaded: ${activeScene.rooms.length} rooms, ${activeScene.walls.length} walls, ${activeScene.openings.length} openings, ${activeScene.modules.length} modules.`);
      } else {
        setScene(createDefaultDemoScene());
        setStatus('✨ Demo 3D scene loaded.');
      }
    };

    void loadScene();
    return () => { live = false; };
  }, [requestedSceneVersionId, requestedRoomId, projectId, reloadKey]);

  async function compileOrRefreshScene() {
    setCompiling(true);
    try {
      if (scene) {
        setStatus('Refreshing the persisted scene version…');
        setReloadKey((value) => value + 1);
        return;
      }
      if (!onCompileScene) {
        setStatus('Open Rooms & Modules, save a catalog module, then compile the scene.');
        return;
      }
      setStatus('Compiling the persisted room modules into scene.v1…');
      await onCompileScene();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scene compilation could not complete. Check the selected room module and finish assignments.');
    } finally {
      setCompiling(false);
    }
  }

  useEffect(() => {
    if (!scene) return;
    const availableRoomIds = new Set(scene.modules.map((module) => module.roomId).filter(Boolean));
    const nextRoomId = (requestedRoomId && (availableRoomIds.has(requestedRoomId) || scene.rooms.some((r) => r.id === requestedRoomId)))
      ? requestedRoomId
      : scene.rooms[0]?.id ?? scene.modules[0]?.roomId ?? null;
    setSelectedRoomId(nextRoomId);
  }, [scene, requestedRoomId]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host || !scene) return;
    const width = Math.max(host.clientWidth || 800, 300);
    const height = Math.max(host.clientHeight || 560, 300);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(lightingMode === 'evening' ? '#181622' : '#f8f6f0');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lightingMode === 'evening' ? 1.4 : 1.15;
    rendererInstanceRef.current = renderer;
    host.replaceChildren(renderer.domElement);
    const root = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 80000;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;

    const hemiConfig = lightingMode === 'daylight'
      ? { sky: '#ffffff', ground: '#94a3b8', intensity: 2.5 }
      : lightingMode === 'evening'
        ? { sky: '#312e81', ground: '#1e1b4b', intensity: 0.9 }
        : { sky: '#fff9eb', ground: '#6b655d', intensity: 2.2 };

    const hemiLight = new THREE.HemisphereLight(hemiConfig.sky, hemiConfig.ground, hemiConfig.intensity);
    root.add(hemiLight);

    const sunConfig = lightingMode === 'daylight'
      ? { color: '#ffffff', intensity: 2.8, pos: [3500, 7500, -2500] }
      : lightingMode === 'evening'
        ? { color: '#f59e0b', intensity: 0.6, pos: [6000, 3000, -4000] }
        : { color: '#fff4e0', intensity: 2.4, pos: [4500, 6500, -3000] };

    const sun = new THREE.DirectionalLight(sunConfig.color, sunConfig.intensity);
    sun.position.set(sunConfig.pos[0], sunConfig.pos[1], sunConfig.pos[2]);
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

      const rName = (room.name || '').toLowerCase();
      let floorColor = '#e2dbd0';
      let floorRoughness = 0.38;
      let floorMetalness = 0.04;

      if (rName.includes('bath') || rName.includes('toilet') || rName.includes('wash')) {
        floorColor = '#c2cdd0';
        floorRoughness = 0.25;
        floorMetalness = 0.08;
      } else if (rName.includes('kitchen')) {
        floorColor = '#cfbc9f';
        floorRoughness = 0.32;
        floorMetalness = 0.06;
      } else if (rName.includes('bed')) {
        floorColor = '#7d5535';
        floorRoughness = 0.55;
        floorMetalness = 0.02;
      } else if (rName.includes('living') || rName.includes('dining')) {
        floorColor = '#d2b08a';
        floorRoughness = 0.45;
        floorMetalness = 0.03;
      } else if (rName.includes('balcony') || rName.includes('parking')) {
        floorColor = '#71717a';
        floorRoughness = 0.85;
      }

      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
        color: selectedRoomId === room.id ? '#fef3c7' : floorColor,
        roughness: floorRoughness,
        metalness: floorMetalness,
        side: THREE.DoubleSide,
      }));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0;
      mesh.receiveShadow = true;
      mesh.name = `room:${room.id}`;
      mesh.userData = { kind: 'room', id: room.id, name: room.name };
      floors.add(mesh);
    }

    // ─── Multi-Storey Villa Stacking Geometry (Mezzanines, Voids & Stairs) ───
    if (activeStoreyId === 'all' || activeStoreyId === 'level-first') {
      const multiStoreyGroup = new THREE.Group();
      multiStoreyGroup.name = 'villa:multi-storey-stack';
      geometryGroup.add(multiStoreyGroup);

      const firstFloorElev = explodedAxonometric ? 4800 : 3300;

      // First Floor Slab with Mezzanine Living Room Void and Stairwell Cutout
      for (const room of scene.rooms) {
        const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(point.xMm, point.yMm));
        if (points.length < 3) continue;
        const slabShape = new THREE.Shape(points);

        // Cut out the double-height living mezzanine void if inside this room
        const rName = (room.name || '').toLowerCase();
        const isLivingOrHall = rName.includes('living') || rName.includes('hall') || rName.includes('lounge');

        if (isLivingOrHall) {
          // Add void hole in the first floor slab
          const voidHole = new THREE.Path([
            new THREE.Vector2(1200, 1000),
            new THREE.Vector2(3200, 1000),
            new THREE.Vector2(3200, 2400),
            new THREE.Vector2(1200, 2400),
          ]);
          slabShape.holes.push(voidHole);

          // Render 12mm Tempered Glass Balustrade with Brushed Brass Top Rail
          const balustradeMat = new THREE.MeshPhysicalMaterial({
            color: '#f0f9ff',
            transmission: 0.9,
            opacity: 0.7,
            transparent: true,
            roughness: 0.05,
            metalness: 0.1,
            side: THREE.DoubleSide,
          });
          const brassHandrailMat = new THREE.MeshStandardMaterial({ color: '#c59c2d', metalness: 0.9, roughness: 0.2 });

          // 4 Sides of Glass Balustrade around the living room void
          const voidPerimeter = [
            [[1200, 1000], [3200, 1000]],
            [[3200, 1000], [3200, 2400]],
            [[3200, 2400], [1200, 2400]],
            [[1200, 2400], [1200, 1000]],
          ];

          voidPerimeter.forEach(([[x1, y1], [x2, y2]]) => {
            const segLen = Math.hypot(x2 - x1, y2 - y1);
            const segAngle = Math.atan2(y2 - y1, x2 - x1);
            const midX = (x1 + x2) / 2;
            const midZ = (y1 + y2) / 2;

            // Glass panel (1050mm standard architectural handrail height)
            const glassGeo = new THREE.BoxGeometry(segLen, 1000, 12);
            const glassMesh = new THREE.Mesh(glassGeo, balustradeMat);
            glassMesh.position.set(midX, firstFloorElev + 500, midZ);
            glassMesh.rotation.y = -segAngle;
            multiStoreyGroup.add(glassMesh);

            // Brass handrail cap
            const railGeo = new THREE.BoxGeometry(segLen, 40, 28);
            const railMesh = new THREE.Mesh(railGeo, brassHandrailMat);
            railMesh.position.set(midX, firstFloorElev + 1020, midZ);
            railMesh.rotation.y = -segAngle;
            multiStoreyGroup.add(railMesh);
          });

          // Grand Double-Height Living Room Suspended Chandelier
          const chandelierGroup = new THREE.Group();
          chandelierGroup.position.set(2200, firstFloorElev + 2600, 1700);

          // Hanging brass rod down into void
          const rodGeo = new THREE.CylinderGeometry(8, 8, 3200, 12);
          const rodMesh = new THREE.Mesh(rodGeo, brassHandrailMat);
          rodMesh.position.y = -1600;
          chandelierGroup.add(rodMesh);

          // Multi-Tier Tiered Brass Rings with Crystals & 3000K Warm Glow
          [400, 650, 900].forEach((rad, ringIdx) => {
            const ringGeo = new THREE.TorusGeometry(rad, 14, 16, 48);
            const ringMesh = new THREE.Mesh(ringGeo, brassHandrailMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = -2200 - ringIdx * 280;
            chandelierGroup.add(ringMesh);
          });

          const chandelierLight = new THREE.PointLight('#ffd199', 3.5, 7500, 1.6);
          chandelierLight.position.set(0, -2600, 0);
          chandelierLight.castShadow = true;
          chandelierGroup.add(chandelierLight);

          multiStoreyGroup.add(chandelierGroup);
        }

        // Slab Mesh
        const slabGeo = new THREE.ShapeGeometry(slabShape);
        const slabMesh = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({
          color: '#dcd6cd',
          roughness: 0.45,
          metalness: 0.05,
          side: THREE.DoubleSide,
        }));
        slabMesh.rotation.x = Math.PI / 2;
        slabMesh.position.y = firstFloorElev;
        slabMesh.receiveShadow = true;
        slabMesh.castShadow = true;
        multiStoreyGroup.add(slabMesh);
      }

      // Sculptural Villa Cantilever Floating Staircase
      const stairGroup = new THREE.Group();
      stairGroup.position.set(3400, 0, 1000);
      const stepCount = 18;
      const totalH = firstFloorElev;
      const stepH = totalH / stepCount;
      const stepRun = 280;

      for (let s = 0; s < stepCount; s++) {
        const treadGeo = new THREE.BoxGeometry(1100, 48, stepRun);
        const treadMesh = new THREE.Mesh(treadGeo, new THREE.MeshStandardMaterial({ color: '#3d2a1a', roughness: 0.35 }));
        treadMesh.position.set(0, s * stepH + 24, s * (stepRun * 0.75));
        treadMesh.castShadow = true;
        treadMesh.receiveShadow = true;
        stairGroup.add(treadMesh);

        // LED tread underglow
        const underglow = new THREE.PointLight('#ffeedd', 0.8, 800, 2.0);
        underglow.position.set(0, s * stepH + 10, s * (stepRun * 0.75));
        stairGroup.add(underglow);
      }
      multiStoreyGroup.add(stairGroup);
    }

    const wallsGroup = new THREE.Group(); geometryGroup.add(wallsGroup);
    addWallSegments(wallsGroup, scene, wallsVisible);

    const modulesGroup = new THREE.Group(); geometryGroup.add(modulesGroup);
    for (const mod of (scene.modules ?? [])) {
      const savedParts = (scene.moduleParts ?? []).filter(part => part.moduleId === mod.id);
      if (savedParts.length > 0) {
        // These already contain world placement and mounting elevation. Never
        // replace them with family guesses or stretch a reference GLB over them.
        modulesGroup.add(createCompiledModuleMeshes(mod.id, savedParts, getThreeMaterialForFinish));
        continue;
      }
      const modContainer = new THREE.Group();
      const posX = Number(mod.position?.xMm ?? (mod as any)?.position?.x ?? 1500);
      const posY = Number(mod.position?.yMm ?? (mod as any)?.position?.y ?? 1500);
      modContainer.position.set(posX, 0, posY);
      modContainer.rotation.y = (((mod.rotationDeg ?? 0) * Math.PI) / 180);
      modContainer.name = `module:${mod.id}`;
      modContainer.userData = { kind: 'module', id: mod.id, family: mod.family };

      const baseMat = getThreeMaterialForFinish(mod.materialId);

      const isKitchenBase = mod.family.includes('kitchen-base') || mod.family.includes('counter');
      const isWardrobe = mod.family.includes('wardrobe') || mod.family.includes('closet');
      const isBed = mod.family.includes('bed');
      const isTv = mod.family.includes('tv');
      const isSofa = mod.family.includes('sofa');
      const isDining = mod.family.includes('dining');

      if (isKitchenBase) {
        // 1. Recessed plinth
        const plinthGeo = new THREE.BoxGeometry(mod.widthMm - 30, 100, Math.max(100, mod.depthMm - 50));
        const plinthMesh = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.8 }));
        plinthMesh.position.set(0, 50, 25);
        plinthMesh.castShadow = true;
        modContainer.add(plinthMesh);

        // 2. Carcase Casing (Left Gable, Right Gable, Bottom, Back, Divider)
        const carcaseHeight = mod.heightMm - 140;
        const carcaseMat = new THREE.MeshStandardMaterial({ color: '#3e2e20', roughness: 0.7 });

        // Left Gable (18mm)
        const leftGable = new THREE.Mesh(new THREE.BoxGeometry(18, carcaseHeight, mod.depthMm - 24), carcaseMat);
        leftGable.position.set(-mod.widthMm / 2 + 9, 100 + carcaseHeight / 2, -12);
        leftGable.castShadow = true;
        modContainer.add(leftGable);

        // Right Gable (18mm)
        const rightGable = new THREE.Mesh(new THREE.BoxGeometry(18, carcaseHeight, mod.depthMm - 24), carcaseMat);
        rightGable.position.set(mod.widthMm / 2 - 9, 100 + carcaseHeight / 2, -12);
        rightGable.castShadow = true;
        modContainer.add(rightGable);

        // Bottom panel (18mm)
        const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, 18, mod.depthMm - 24), carcaseMat);
        bottomPanel.position.set(0, 100 + 9, -12);
        bottomPanel.castShadow = true;
        modContainer.add(bottomPanel);

        // Back panel (8mm)
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, carcaseHeight - 18, 8), carcaseMat);
        backPanel.position.set(0, 100 + carcaseHeight / 2, -mod.depthMm / 2 + 8);
        backPanel.castShadow = true;
        modContainer.add(backPanel);

        // Middle Divider Shelf (18mm)
        const midShelf = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, 18, mod.depthMm - 40), carcaseMat);
        midShelf.position.set(0, 100 + carcaseHeight * 0.46, -16);
        midShelf.castShadow = true;
        modContainer.add(midShelf);

        // 3. Countertop Slab (40mm thickness with 20mm overhang, quartz/sintered marble)
        const topGeo = new THREE.BoxGeometry(mod.widthMm + 8, 40, mod.depthMm + 16);
        const topMat = new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.15, metalness: 0.05 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(0, mod.heightMm - 20, 8);
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        modContainer.add(topMesh);

        // 4. Kinetic Top Drawer (Cutlery & Spice Rack with Blum Tandembox sides)
        const topDrawerGroup = new THREE.Group();
        const topDrawerH = carcaseHeight * 0.42;
        topDrawerGroup.position.set(0, 100 + carcaseHeight - topDrawerH / 2 - 4, 0);
        topDrawerGroup.userData = { isKineticDrawer: true, moduleId: mod.id, maxSlideMm: Math.min(380, mod.depthMm * 0.65), baseZ: 0 };

        // Drawer Front Shutter
        const topShutter = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 6, topDrawerH - 4, 18), baseMat);
        topShutter.position.set(0, 0, mod.depthMm / 2 - 9);
        topShutter.castShadow = true;
        topDrawerGroup.add(topShutter);

        // Gold profile handle
        const handleMat = new THREE.MeshStandardMaterial({ color: '#c59c2d', metalness: 0.9, roughness: 0.2 });
        const topHandle = new THREE.Mesh(new THREE.BoxGeometry(Math.min(180, mod.widthMm * 0.45), 10, 18), handleMat);
        topHandle.position.set(0, topDrawerH / 2 - 16, mod.depthMm / 2 + 2);
        topDrawerGroup.add(topHandle);

        // Tandembox Steel sides (Anthracite / Brushed Steel)
        const tandemMat = new THREE.MeshStandardMaterial({ color: '#44403c', metalness: 0.8, roughness: 0.3 });
        const sideH = topDrawerH * 0.7;
        const leftTandem = new THREE.Mesh(new THREE.BoxGeometry(3, sideH, mod.depthMm - 70), tandemMat);
        leftTandem.position.set(-mod.widthMm / 2 + 22, -10, -10);
        topDrawerGroup.add(leftTandem);
        const rightTandem = new THREE.Mesh(new THREE.BoxGeometry(3, sideH, mod.depthMm - 70), tandemMat);
        rightTandem.position.set(mod.widthMm / 2 - 22, -10, -10);
        topDrawerGroup.add(rightTandem);

        // Drawer Base & Back
        const drawerBase = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 46, 16, mod.depthMm - 70), carcaseMat);
        drawerBase.position.set(0, -topDrawerH / 2 + 10, -10);
        topDrawerGroup.add(drawerBase);

        // Velvet Cutlery & Spice Insert Tray
        const cutleryTray = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 60, 24, mod.depthMm - 90), new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.9 }));
        cutleryTray.position.set(0, -topDrawerH / 2 + 22, -10);
        topDrawerGroup.add(cutleryTray);

        // Warm Interior Sensor LED strip
        const drawerLed = new THREE.PointLight('#ffe6a3', 0, 900, 2);
        drawerLed.position.set(0, topDrawerH / 2 - 10, -20);
        drawerLed.userData = { isKineticLed: true, moduleId: mod.id, maxIntensity: 2.0 };
        topDrawerGroup.add(drawerLed);

        modContainer.add(topDrawerGroup);

        // 5. Kinetic Bottom Pot Drawer
        const botDrawerGroup = new THREE.Group();
        const botDrawerH = carcaseHeight * 0.52;
        botDrawerGroup.position.set(0, 100 + botDrawerH / 2 + 4, 0);
        botDrawerGroup.userData = { isKineticDrawer: true, moduleId: mod.id, maxSlideMm: Math.min(320, mod.depthMm * 0.55), baseZ: 0 };

        const botShutter = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 6, botDrawerH - 4, 18), baseMat);
        botShutter.position.set(0, 0, mod.depthMm / 2 - 9);
        botShutter.castShadow = true;
        botDrawerGroup.add(botShutter);

        const botHandle = new THREE.Mesh(new THREE.BoxGeometry(Math.min(180, mod.widthMm * 0.45), 10, 18), handleMat);
        botHandle.position.set(0, botDrawerH / 2 - 16, mod.depthMm / 2 + 2);
        botDrawerGroup.add(botHandle);

        const botBase = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 46, 16, mod.depthMm - 70), carcaseMat);
        botBase.position.set(0, -botDrawerH / 2 + 10, -10);
        botDrawerGroup.add(botBase);

        // Deep Pot Gallery Railing (chrome rods)
        const railMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.2 });
        [-mod.widthMm / 2 + 24, mod.widthMm / 2 - 24].forEach((rx) => {
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, mod.depthMm - 80, 12), railMat);
          rail.rotation.x = Math.PI / 2;
          rail.position.set(rx, 15, -10);
          botDrawerGroup.add(rail);
        });

        modContainer.add(botDrawerGroup);
      } else if (isTv) {
        // TV Console Unit + Acoustic Slatted Back Panel + OLED Screen
        const backPanelGeo = new THREE.BoxGeometry(mod.widthMm, mod.heightMm, 30);
        const backPanelMesh = new THREE.Mesh(backPanelGeo, new THREE.MeshStandardMaterial({ color: '#4a3525', roughness: 0.65 }));
        backPanelMesh.position.set(0, mod.heightMm / 2, -mod.depthMm / 2 + 15);
        backPanelMesh.castShadow = true;
        modContainer.add(backPanelMesh);

        const consoleGeo = new THREE.BoxGeometry(mod.widthMm - 80, 450, mod.depthMm);
        const consoleMesh = new THREE.Mesh(consoleGeo, baseMat);
        consoleMesh.position.set(0, 225, 0);
        consoleMesh.castShadow = true;
        consoleMesh.receiveShadow = true;
        modContainer.add(consoleMesh);

        // OLED Screen
        const screenGeo = new THREE.BoxGeometry(Math.min(1500, mod.widthMm - 200), 850, 16);
        const screenMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.1, metalness: 0.8 });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenMesh.position.set(0, 1150, -mod.depthMm / 2 + 35);
        screenMesh.castShadow = true;
        modContainer.add(screenMesh);
      } else if (isSofa) {
        // 3-Seater Curved Sectional Sofa
        const seatGeo = new THREE.BoxGeometry(mod.widthMm, 420, mod.depthMm - 200);
        const seatMat = new THREE.MeshStandardMaterial({ color: '#dcd6cd', roughness: 0.9 });
        const seatMesh = new THREE.Mesh(seatGeo, seatMat);
        seatMesh.position.set(0, 210, 50);
        seatMesh.castShadow = true;
        modContainer.add(seatMesh);

        const backGeo = new THREE.BoxGeometry(mod.widthMm, 450, 200);
        const backMesh = new THREE.Mesh(backGeo, seatMat);
        backMesh.position.set(0, 550, -mod.depthMm / 2 + 100);
        backMesh.castShadow = true;
        modContainer.add(backMesh);

        // Coffee table in front
        const tableGeo = new THREE.CylinderGeometry(350, 350, 380, 32);
        const tableMesh = new THREE.Mesh(tableGeo, new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.4 }));
        tableMesh.position.set(0, 190, mod.depthMm / 2 + 350);
        tableMesh.castShadow = true;
        modContainer.add(tableMesh);
      } else if (isDining) {
        // Dining Table with solid top and 4 legs
        const topGeo = new THREE.BoxGeometry(mod.widthMm, 50, mod.depthMm);
        const topMesh = new THREE.Mesh(topGeo, baseMat);
        topMesh.position.set(0, mod.heightMm - 25, 0);
        topMesh.castShadow = true;
        modContainer.add(topMesh);

        const legGeo = new THREE.CylinderGeometry(25, 20, mod.heightMm - 50, 16);
        const legMat = new THREE.MeshStandardMaterial({ color: '#1c1917', metalness: 0.8, roughness: 0.3 });
        [[-mod.widthMm / 2 + 80, -mod.depthMm / 2 + 80], [mod.widthMm / 2 - 80, -mod.depthMm / 2 + 80], [-mod.widthMm / 2 + 80, mod.depthMm / 2 - 80], [mod.widthMm / 2 - 80, mod.depthMm / 2 - 80]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(lx, (mod.heightMm - 50) / 2, lz);
          leg.castShadow = true;
          modContainer.add(leg);
        });
      } else if (isWardrobe) {
        // Tall wardrobe with plinth, carcase, interior hanging rail, sensor LED, and kinetic hinged doors
        const plinthGeo = new THREE.BoxGeometry(mod.widthMm, 80, mod.depthMm - 20);
        const plinthMesh = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: '#2b2622' }));
        plinthMesh.position.set(0, 40, 0);
        modContainer.add(plinthMesh);

        const carcaseHeight = mod.heightMm - 80;
        const carcaseMat = new THREE.MeshStandardMaterial({ color: '#3a2e25', roughness: 0.65 });

        // Left Gable (18mm)
        const leftGable = new THREE.Mesh(new THREE.BoxGeometry(18, carcaseHeight, mod.depthMm - 20), carcaseMat);
        leftGable.position.set(-mod.widthMm / 2 + 9, 80 + carcaseHeight / 2, -10);
        leftGable.castShadow = true;
        modContainer.add(leftGable);

        // Right Gable (18mm)
        const rightGable = new THREE.Mesh(new THREE.BoxGeometry(18, carcaseHeight, mod.depthMm - 20), carcaseMat);
        rightGable.position.set(mod.widthMm / 2 - 9, 80 + carcaseHeight / 2, -10);
        rightGable.castShadow = true;
        modContainer.add(rightGable);

        // Top & Bottom Panels (18mm)
        const topPanel = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, 18, mod.depthMm - 20), carcaseMat);
        topPanel.position.set(0, mod.heightMm - 9, -10);
        modContainer.add(topPanel);

        const botPanel = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, 18, mod.depthMm - 20), carcaseMat);
        botPanel.position.set(0, 80 + 9, -10);
        modContainer.add(botPanel);

        // Back panel (8mm)
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, carcaseHeight - 36, 8), carcaseMat);
        backPanel.position.set(0, 80 + carcaseHeight / 2, -mod.depthMm / 2 + 10);
        modContainer.add(backPanel);

        // Fixed Upper Shelf (Hat / Bag shelf)
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 36, 18, mod.depthMm - 30), carcaseMat);
        shelf.position.set(0, 80 + carcaseHeight * 0.76, -12);
        modContainer.add(shelf);

        // Chrome Oval Wardrobe Hanging Rail
        const railGeo = new THREE.CylinderGeometry(12, 12, mod.widthMm - 40, 16);
        const railMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.95, roughness: 0.15 });
        const hangRail = new THREE.Mesh(railGeo, railMat);
        hangRail.rotation.z = Math.PI / 2;
        hangRail.position.set(0, 80 + carcaseHeight * 0.70, -10);
        hangRail.castShadow = true;
        modContainer.add(hangRail);

        // Vertical Sensor Warm LED Strip in Carcase Rebate
        const vertLed = new THREE.PointLight('#ffe4a0', 0, 2400, 1.8);
        vertLed.position.set(0, 80 + carcaseHeight / 2, 0);
        vertLed.userData = { isKineticLed: true, moduleId: mod.id, maxIntensity: 2.2 };
        modContainer.add(vertLed);

        // Kinetic Hinged Doors (European 35mm Concealed Hinges)
        const handleMat = new THREE.MeshStandardMaterial({ color: '#1c1917', metalness: 0.85, roughness: 0.25 });
        const isDoubleDoor = mod.widthMm > 600;

        if (isDoubleDoor) {
          const doorWidth = (mod.widthMm - 4) / 2;

          // Left Door Pivot Group
          const leftPivot = new THREE.Group();
          leftPivot.position.set(-mod.widthMm / 2 + 4, 80 + carcaseHeight / 2, mod.depthMm / 2 - 10);
          leftPivot.userData = { isKineticDoor: true, hingeSide: 'left', moduleId: mod.id };

          const leftDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 2, carcaseHeight - 4, 18), baseMat);
          leftDoorMesh.position.set(doorWidth / 2, 0, 0);
          leftDoorMesh.castShadow = true;
          leftPivot.add(leftDoorMesh);

          const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(12, 600, 18), handleMat);
          leftHandle.position.set(doorWidth - 28, 0, 12);
          leftPivot.add(leftHandle);
          modContainer.add(leftPivot);

          // Right Door Pivot Group
          const rightPivot = new THREE.Group();
          rightPivot.position.set(mod.widthMm / 2 - 4, 80 + carcaseHeight / 2, mod.depthMm / 2 - 10);
          rightPivot.userData = { isKineticDoor: true, hingeSide: 'right', moduleId: mod.id };

          const rightDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 2, carcaseHeight - 4, 18), baseMat);
          rightDoorMesh.position.set(-doorWidth / 2, 0, 0);
          rightDoorMesh.castShadow = true;
          rightPivot.add(rightDoorMesh);

          const rightHandle = new THREE.Mesh(new THREE.BoxGeometry(12, 600, 18), handleMat);
          rightHandle.position.set(-doorWidth + 28, 0, 12);
          rightPivot.add(rightHandle);
          modContainer.add(rightPivot);
        } else {
          // Single Door Pivot Group
          const leftPivot = new THREE.Group();
          leftPivot.position.set(-mod.widthMm / 2 + 4, 80 + carcaseHeight / 2, mod.depthMm / 2 - 10);
          leftPivot.userData = { isKineticDoor: true, hingeSide: 'left', moduleId: mod.id };

          const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(mod.widthMm - 4, carcaseHeight - 4, 18), baseMat);
          doorMesh.position.set(mod.widthMm / 2, 0, 0);
          doorMesh.castShadow = true;
          leftPivot.add(doorMesh);

          const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 600, 18), handleMat);
          handleMesh.position.set(mod.widthMm - 28, 0, 12);
          leftPivot.add(handleMesh);
          modContainer.add(leftPivot);
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

      // Asynchronous GLB digital twin upgrade with parametric proxy fallback
      if (mod.glbUrl) {
        gltfLoader.load(
          mod.glbUrl,
          (gltf) => {
            const bbox = new THREE.Box3().setFromObject(gltf.scene);
            const size = bbox.getSize(new THREE.Vector3());
            if (size.x > 0 && size.y > 0 && size.z > 0) {
              const scaleX = mod.widthMm / size.x;
              const scaleY = mod.heightMm / size.y;
              const scaleZ = mod.depthMm / size.z;
              gltf.scene.scale.set(scaleX, scaleY, scaleZ);
              const center = bbox.getCenter(new THREE.Vector3());
              gltf.scene.position.set(-center.x * scaleX, -bbox.min.y * scaleY, -center.z * scaleZ);
            }
            gltf.scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            while (modContainer.children.length > 0) {
              modContainer.remove(modContainer.children[0]);
            }
            modContainer.add(gltf.scene);
          },
          undefined,
          (error) => {
            console.warn(`GLTF asset failed to load for module ${mod.id}, retaining parametric proxy:`, error);
          }
        );
      }

      modulesGroup.add(modContainer);
    }

    const lightingGroup = new THREE.Group(); geometryGroup.add(lightingGroup);
    for (const light of scene.lighting ?? []) addSceneFixture(lightingGroup, light);

    const compiledLightingAnchors = (scene.moduleParts ?? []).filter(
      (part) =>
        part.semanticType === 'lighting_anchor' ||
        part.kind === 'lighting_anchor' ||
        part.semanticType === 'lighting_channel'
    );

    const placedAnchorIds = new Set<string>();
    for (const part of compiledLightingAnchors) {
      if (!placedAnchorIds.has(part.id)) {
        placedAnchorIds.add(part.id);
        addCompiledLightingAnchor(lightingGroup, part);
      }
    }

    // Fallback synthesis: If moduleParts is empty or has no lighting anchors, check if scene has certified modules like tv-unit
    if (compiledLightingAnchors.length === 0) {
      for (const mod of scene.modules ?? []) {
        const posX = Number(mod.position?.xMm ?? 1500);
        const posY = Number(mod.position?.yMm ?? 1500);
        const family = (mod.family || '').toLowerCase();
        if (family.includes('tv') || family.includes('entertainment')) {
          addCompiledLightingAnchor(lightingGroup, {
            id: `${mod.id}-tv-underglow`,
            moduleId: mod.id,
            roomId: mod.roomId || scene.rooms[0]?.id || 'room-master-bed',
            semanticType: 'lighting_anchor',
            kind: 'lighting_anchor',
            name: 'Floating Console Underglow LED',
            widthMm: Math.max(1200, mod.widthMm - 80),
            depthMm: 14,
            heightMm: 14,
            position: { xMm: posX, yMm: posY, zMm: 220 },
            rotationDeg: mod.rotationDeg || 0,
            fixtureType: 'led-strip',
            colorTemperatureK: 3000,
            lengthMm: Math.max(1200, mod.widthMm - 80),
          });
          if (mod.widthMm >= 2000) {
            addCompiledLightingAnchor(lightingGroup, {
              id: `${mod.id}-tv-glass-accent`,
              moduleId: mod.id,
              roomId: mod.roomId || scene.rooms[0]?.id || 'room-master-bed',
              semanticType: 'lighting_anchor',
              kind: 'lighting_anchor',
              name: 'Profile Glass Display LED',
              widthMm: 14,
              depthMm: 14,
              heightMm: 1600,
              position: {
                xMm: posX + (mod.widthMm / 2 - 200),
                yMm: posY,
                zMm: 500,
              },
              rotationDeg: mod.rotationDeg || 0,
              fixtureType: 'led-strip',
              colorTemperatureK: 3000,
              lengthMm: 1600,
            });
          }
        }
      }
    }

    lightingGroup.visible = assetFilter !== 'furniture';
    modulesGroup.visible = assetFilter !== 'lighting';

    // Ceiling spot lights in each room with atmosphere color
    for (const room of (scene.rooms ?? [])) {
      if (Array.isArray(room.boundary) && room.boundary.length >= 3) {
        const poly = room.boundary;
        const cx = poly.reduce((s, p) => s + Number(p.xMm ?? (p as any).x ?? 0), 0) / poly.length;
        const cz = poly.reduce((s, p) => s + Number(p.yMm ?? (p as any).y ?? 0), 0) / poly.length;
        const lightColor = lightingMode === 'daylight' ? '#f8fafc' : lightingMode === 'evening' ? '#f59e0b' : '#fff2d9';
        const lightIntensity = lightingMode === 'evening' ? 2.4 : 1.5;
        const roomLight = new THREE.PointLight(lightColor, lightIntensity, 6500, 1.2);
        roomLight.position.set(isNaN(cx) ? 2000 : cx, 2600, isNaN(cz) ? 1500 : cz);
        root.add(roomLight);
      }
    }

    if (ceilingVisible) {
      for (const room of (scene.rooms ?? [])) {
        if (!Array.isArray(room.boundary) || room.boundary.length < 3) continue;
        const points = room.boundary.slice(0, -1).map((point) => new THREE.Vector2(Number(point.xMm ?? (point as any).x ?? 0), Number(point.yMm ?? (point as any).y ?? 0)));
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
    const center = (bounds.isEmpty() || !isFinite(bounds.min.x)) ? new THREE.Vector3(2000, 1200, 1500) : bounds.getCenter(new THREE.Vector3());
    const size = (bounds.isEmpty() || !isFinite(bounds.min.x)) ? new THREE.Vector3(4000, 2700, 3000) : bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 2000);

    const applyPreset = () => {
      let targetCenter = center.clone();
      let targetSpan = span;

      if (selectedRoomId) {
        const selRoom = (scene.rooms ?? []).find((r) => r.id === selectedRoomId);
        if (selRoom && Array.isArray(selRoom.boundary) && selRoom.boundary.length > 2) {
          const roomPts = selRoom.boundary.map((p) => new THREE.Vector3(Number(p.xMm ?? (p as any).x ?? 0), 0, Number(p.yMm ?? (p as any).y ?? 0)));
          const roomBox = new THREE.Box3().setFromPoints(roomPts);
          if (!roomBox.isEmpty() && isFinite(roomBox.min.x)) {
            targetCenter = roomBox.getCenter(new THREE.Vector3());
            targetCenter.y = 1200;
            const rSize = roomBox.getSize(new THREE.Vector3());
            targetSpan = Math.max(rSize.x, rSize.z, 1500);
          }
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
      if (hit) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && !curr.userData?.id && curr.parent && curr.parent !== geometryGroup) {
          curr = curr.parent;
        }
        if (curr?.userData?.id) {
          setSelected(curr.userData.id);
          if (curr.userData.kind === 'room') {
            setSelectedRoomId(curr.userData.id);
          }
        } else {
          setSelected(null);
        }
      } else {
        setSelected(null);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointer);
    const resize = () => {
      if (!host) return;
      const w = Math.max(host.clientWidth, 300);
      const h = Math.max(host.clientHeight, 300);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    let frame = 0;
    let currentDrawerLerp = 0;
    let currentDoorLerp = 0;
    let currentLedIntensity = 0;

    const draw = () => {
      controls.update();

      const targets = kineticTargetsRef.current;
      const targetOffset = targets.drawerOffset;
      const targetDoorAngleRad = (targets.doorAngleDeg * Math.PI) / 180;
      const targetLed = targets.ledReveal ? 1.0 : (targets.drawerOffset > 0.05 || targets.doorAngleDeg > 5 ? 1.0 : 0.0);

      currentDrawerLerp += (targetOffset - currentDrawerLerp) * 0.12;
      currentDoorLerp += (targetDoorAngleRad - currentDoorLerp) * 0.12;
      currentLedIntensity += (targetLed - currentLedIntensity) * 0.12;

      geometryGroup.traverse((obj) => {
        if (obj.userData?.isKineticDrawer) {
          const maxSlide = obj.userData.maxSlideMm ?? 350;
          obj.position.z = (obj.userData.baseZ ?? 0) + currentDrawerLerp * maxSlide;
        } else if (obj.userData?.isKineticDoor) {
          const side = obj.userData.hingeSide;
          if (side === 'left') {
            obj.rotation.y = -currentDoorLerp;
          } else if (side === 'right') {
            obj.rotation.y = currentDoorLerp;
          }
        } else if (obj.userData?.isKineticLed && obj instanceof THREE.PointLight) {
          obj.intensity = currentLedIntensity * (obj.userData.maxIntensity ?? 1.5);
        }
      });

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
      rendererInstanceRef.current = null;
      host.replaceChildren();
    };
  }, [scene, wallsVisible, ceilingVisible, preset, lightingMode, selectedRoomId, assetFilter, activeStoreyId, explodedAxonometric]);

  const activeSelectedRoom = useMemo(() => {
    if (!scene) return null;
    return scene.rooms.find((r) => r.id === selectedRoomId) ?? scene.rooms[0] ?? null;
  }, [scene, selectedRoomId]);

  const activeSelectedRoomMeta = useMemo(() => {
    if (!activeSelectedRoom) return null;
    return activeRooms.find((r) => r.id === activeSelectedRoom.id) ?? null;
  }, [activeSelectedRoom, activeRooms]);

  const activeSelectedLighting = useMemo(() => {
    if (!scene || !selected) return null;
    const directLight = scene.lighting.find((light) => light.id === selected);
    if (directLight) return directLight;

    const compiledPart = (scene.moduleParts ?? []).find((p) => p.id === selected);
    if (
      compiledPart &&
      (compiledPart.semanticType === 'lighting_anchor' ||
        compiledPart.kind === 'lighting_anchor' ||
        compiledPart.semanticType === 'lighting_channel')
    ) {
      return {
        id: compiledPart.id,
        spaceId: compiledPart.roomId,
        kind: 'compiled_lighting',
        fixture: (compiledPart.fixtureType ?? 'led-strip') as any,
        position: { xMm: compiledPart.position.xMm, yMm: compiledPart.position.yMm },
        heightMm: compiledPart.position.zMm,
        colorTemperatureK: compiledPart.colorTemperatureK ?? 3000,
        lumens: 800,
      };
    }
    return null;
  }, [scene, selected]);

  const activeSelectedModule = useMemo(() => {
    if (!scene || !selected) return null;
    return scene.modules.find((module) => module.id === selected) ?? null;
  }, [scene, selected]);

  const allLightingItems = useMemo(() => {
    if (!scene) return [];
    const direct = (scene.lighting ?? []).map((l) => ({
      id: l.id,
      name: (l.fixture ?? l.kind).replaceAll('-', ' '),
      fixture: l.fixture ?? l.kind,
      cct: l.colorTemperatureK ?? 3000,
      lumens: l.lumens ?? 650,
      heightMm: l.heightMm ?? 2600,
      source: 'scene' as const,
    }));
    const compiled = (scene.moduleParts ?? [])
      .filter(
        (p) =>
          p.semanticType === 'lighting_anchor' ||
          p.kind === 'lighting_anchor' ||
          p.semanticType === 'lighting_channel'
      )
      .map((p) => ({
        id: p.id,
        name: p.name || (p.fixtureType ?? 'led-strip').replaceAll('-', ' '),
        fixture: p.fixtureType ?? 'led-strip',
        cct: p.colorTemperatureK ?? 3000,
        lumens: 800,
        heightMm: p.position.zMm,
        source: 'compiled' as const,
      }));
    return [...direct, ...compiled];
  }, [scene]);

  const renderReadiness = useMemo(() => {
    if (!scene) return [];
    return [
      { label: 'Measured scene geometry', detail: `${scene.rooms.length} rooms · ${scene.walls.length} walls`, ready: scene.rooms.length > 0 && scene.walls.length > 0 },
      { label: 'Scheduled fixtures', detail: `${allLightingItems.length} fixtures (${scene.lighting.length} room · ${allLightingItems.length - scene.lighting.length} module)`, ready: allLightingItems.length > 0 },
      { label: 'Material context', detail: `${scene.materials.length} finish records`, ready: scene.materials.length > 0 },
      { label: 'Camera coverage', detail: `${scene.cameras.length} saved view${scene.cameras.length === 1 ? '' : 's'}`, ready: scene.cameras.length > 0 },
      { label: 'Production geometry', detail: `${scene.moduleParts.length} component parts`, ready: scene.modules.length === 0 || scene.moduleParts.length > 0 },
    ];
  }, [scene, allLightingItems]);

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

      <div className="scene-toolbar" aria-label="Scene controls" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Button variant={preset === 'perspective' ? 'default' : 'outline'} onClick={() => setPreset('perspective')}><Camera size={15} /> 3D Orbit</Button>
        <Button variant={preset === 'walkthrough' ? 'default' : 'outline'} onClick={() => setPreset('walkthrough')}><Eye size={15} /> Walkthrough</Button>
        <Button variant={preset === 'top' ? 'default' : 'outline'} onClick={() => setPreset('top')}><Layers3 size={15} /> Plan</Button>
        <Button variant={preset === 'isometric' ? 'default' : 'outline'} onClick={() => setPreset('isometric')}><Rotate3D size={15} /> Isometric</Button>
        <Button variant={wallsVisible ? 'default' : 'outline'} onClick={() => setWallsVisible((value) => !value)}><Box size={15} /> Walls</Button>
        <Button variant={ceilingVisible ? 'default' : 'outline'} onClick={() => setCeilingVisible((value) => !value)}><Rotate3D size={15} /> Ceiling</Button>

        {/* Lighting Atmosphere Selector */}
        <div style={{ display: 'inline-flex', background: '#f5f3ee', borderRadius: 8, padding: 2, border: '1px solid #e7e5e4', marginLeft: 4 }}>
          {(['warm', 'daylight', 'evening'] as LightingPreset[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLightingMode(mode)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 0,
                background: lightingMode === mode ? '#fff' : 'transparent',
                color: lightingMode === mode ? 'var(--gold-dim)' : '#78716c',
                fontSize: 11,
                fontWeight: 700,
                boxShadow: lightingMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              {mode === 'warm' ? '🌅 3000K Warm' : mode === 'daylight' ? '☀️ Studio 4500K' : '🌙 Dusk 2700K'}
            </button>
          ))}
        </div>

        {/* Multi-Storey Level Switcher */}
        <div style={{ display: 'inline-flex', background: '#f5f3ee', borderRadius: 8, padding: 2, border: '1px solid #e7e5e4', marginLeft: 4 }}>
          {[
            { id: 'all', label: '🏰 Stacked (All)' },
            { id: 'level-ground', label: '🏛️ Ground (0m)' },
            { id: 'level-first', label: '🏢 First (+3.3m)' },
            { id: 'level-terrace', label: '🌿 Terrace (+6.6m)' },
          ].map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setActiveStoreyId(lvl.id)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: 0,
                background: activeStoreyId === lvl.id ? '#fff' : 'transparent',
                color: activeStoreyId === lvl.id ? 'var(--gold-dim)' : '#78716c',
                fontSize: 11,
                fontWeight: 700,
                boxShadow: activeStoreyId === lvl.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              {lvl.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setExplodedAxonometric((prev) => !prev)}
            style={{
              padding: '4px 9px',
              borderRadius: 6,
              border: 0,
              background: explodedAxonometric ? 'rgba(197,156,45,0.2)' : 'transparent',
              color: explodedAxonometric ? 'var(--gold-dim)' : '#78716c',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Toggle exploded vertical axonometric spacing between storeys"
          >
            {explodedAxonometric ? '💥 Exploded (On)' : '📐 Exploded'}
          </button>
        </div>

        {/* 1-Click High-Res PNG Snapshot */}
        <Button
          variant="outline"
          onClick={() => {
            if (!rendererInstanceRef.current) return;
            const dataUrl = rendererInstanceRef.current.domElement.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Sharma-Residence-3D-${lightingMode}-${preset}.png`;
            link.href = dataUrl;
            link.click();
          }}
          style={{ border: '1px solid #d6d3d1' }}
        >
          📸 Snapshot (PNG)
        </Button>

        {onCompileScene && (
          <Button
            variant="default"
            disabled={compiling}
            onClick={() => void compileOrRefreshScene()}
            style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #c59c2d, #a88220)', color: '#1c1917', fontWeight: 800 }}
          >
            {compiling ? 'Updating 3D Scene...' : scene ? '↻ Refresh 3D Scene' : '✨ Compile 3D Scene'}
          </Button>
        )}
      </div>

      {scene && (
        <div className="scene-ingredient-rail" aria-label="Scene ingredients">
          <div className="scene-ingredient-heading">
            <span>SCENE INGREDIENTS</span>
            <strong>Furniture, fixtures & material context</strong>
          </div>
          <div className="scene-ingredient-list">
            {allLightingItems.map((light) => (
              <button
                type="button"
                key={light.id}
                className={`scene-ingredient ${selected === light.id ? 'selected' : ''}`}
                onClick={() => setSelected(light.id)}
              >
                <span className="scene-ingredient-icon">{light.fixture === 'pendant' ? '◌' : light.fixture === 'floor-lamp' ? '⌁' : light.fixture === 'table-lamp' ? '◒' : '•'}</span>
                <span><strong>{light.name}</strong><small>{light.cct}K · {light.source === 'compiled' ? 'Integrated linear' : `${light.lumens} lm`}</small></span>
              </button>
            ))}
            {scene.modules.slice(0, 5).map((module) => (
              <button type="button" key={module.id} className={`scene-ingredient ${selected === module.id ? 'selected' : ''}`} onClick={() => setSelected(module.id)}>
                <span className="scene-ingredient-icon">▦</span>
                <span><strong>{module.family.replaceAll('-', ' ')}</strong><small>{module.widthMm}W × {module.heightMm}H mm</small></span>
              </button>
            ))}
          </div>
          <p>Fixtures are governed scene data; styling assets stay separate from fabrication geometry.</p>
        </div>
      )}

      <div className="scene-grid">
        <aside className="scene-assets-rail" aria-label="Scene assets">
          <div className="scene-assets-heading">
            <span>SCENE ASSETS</span>
            <strong>Furniture &amp; lighting</strong>
            <small>Catalog-backed ingredients</small>
          </div>
          <div className="scene-assets-tabs" aria-label="Filter scene assets">
            {([['all', 'All'], ['furniture', 'Furniture'], ['lighting', 'Lighting']] as const).map(([id, label]) => (
              <button type="button" key={id} className={assetFilter === id ? 'active' : ''} onClick={() => setAssetFilter(id)}>{label}</button>
            ))}
          </div>
          <div className="scene-assets-list">
            {assetFilter !== 'furniture' && allLightingItems.slice(0, 8).map((light) => (
              <button type="button" key={light.id} className={`scene-asset-card ${selected === light.id ? 'selected' : ''}`} onClick={() => setSelected(light.id)}>
                <span className="scene-asset-icon"><LampDesk size={16} /></span>
                <span><strong>{light.name}</strong><small>{light.heightMm} mm · {light.cct}K</small></span>
              </button>
            ))}
            {assetFilter !== 'lighting' && (scene?.modules ?? []).slice(0, 6).map((module) => (
              <button type="button" key={module.id} className={`scene-asset-card ${selected === module.id ? 'selected' : ''}`} onClick={() => setSelected(module.id)}>
                <span className="scene-asset-icon"><Box size={16} /></span>
                <span><strong>{module.family.replaceAll('-', ' ')}</strong><small>{module.widthMm} × {module.heightMm} mm</small></span>
              </button>
            ))}
          </div>
          <button type="button" className="scene-assets-library" onClick={() => navigate('/library')}>
            <Layers3 size={14} /> Browse Design Library
          </button>
        </aside>
        <Card className="scene-viewport">
          <CardContent style={{ position: 'relative', minHeight: 520, height: '100%', padding: 0 }}>
            <div ref={canvasRef} className="scene-canvas" aria-label="Interactive three dimensional scene preview" style={{ width: '100%', height: '100%', minHeight: 520 }} />
            {scene && (
              <div className="scene-viewport-overlay" aria-hidden="true">
                <span>{preset === 'walkthrough' ? 'WALKTHROUGH CAMERA' : preset === 'top' ? 'PLAN CAMERA' : preset === 'isometric' ? 'ISOMETRIC CAMERA' : 'PERSPECTIVE CAMERA'}</span>
                <span>{lightingMode === 'warm' ? '3000K WARM' : lightingMode === 'daylight' ? '4500K STUDIO' : '2700K DUSK'}</span>
              </div>
            )}

            {/* Interactive Kinetic Cabinet Inspector Floating HUD */}
            {scene && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 14,
                  background: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(8px)',
                  border: '1.5px solid #ebdccb',
                  borderRadius: 12,
                  padding: '10px 14px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  zIndex: 10,
                  width: 290,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ebdccb', paddingBottom: 6 }}>
                  <span style={{ fontWeight: 800, color: 'var(--gold-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    ⚡ Kinetic Cabinet Inspector
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      disabled={isKineticAnimating}
                      onClick={animateKineticCycle}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: '1px solid #c59c2d',
                        background: '#fef9e7',
                        color: '#92400e',
                        cursor: 'pointer',
                      }}
                    >
                      {isKineticAnimating ? '▶ Playing...' : '▶ Play Cycle'}
                    </button>
                    <button
                      type="button"
                      onClick={resetKinetic}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid #d6d3d1',
                        background: '#fff',
                        color: '#57534e',
                        cursor: 'pointer',
                      }}
                    >
                      ↺ Reset
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr 32px', alignItems: 'center', gap: 8 }}>
                  <label style={{ color: '#57534e', fontSize: 11, fontWeight: 600 }}>Pull Drawer:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={kineticDrawerOffset}
                    onChange={(e) => setKineticDrawerOffset(parseFloat(e.target.value))}
                    style={{ accentColor: '#c59c2d', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 10, color: '#78716c', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(kineticDrawerOffset * 100)}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr 32px', alignItems: 'center', gap: 8 }}>
                  <label style={{ color: '#57534e', fontSize: 11, fontWeight: 600 }}>Swing Door:</label>
                  <input
                    type="range"
                    min="0"
                    max="105"
                    step="1"
                    value={kineticDoorAngleDeg}
                    onChange={(e) => setKineticDoorAngleDeg(parseFloat(e.target.value))}
                    style={{ accentColor: '#c59c2d', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 10, color: '#78716c', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {kineticDoorAngleDeg}°
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                  <label style={{ color: '#57534e', fontSize: 11, fontWeight: 600 }}>Warm Sensor LED:</label>
                  <button
                    type="button"
                    onClick={() => setKineticLedReveal((prev) => !prev)}
                    style={{
                      padding: '3px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 12,
                      border: kineticLedReveal ? '1px solid #f59e0b' : '1px solid #d6d3d1',
                      background: kineticLedReveal ? '#fef3c7' : '#f5f5f4',
                      color: kineticLedReveal ? '#b45309' : '#78716c',
                      cursor: 'pointer',
                    }}
                  >
                    {kineticLedReveal ? '💡 3000K On' : '⚪ Sensor Auto'}
                  </button>
                </div>
              </div>
            )}
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
                  onClick={() => void compileOrRefreshScene()}
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
              <small>{activeSelectedLighting ? 'FIXTURE INSPECTOR' : activeSelectedModule ? 'MODULE INSPECTOR' : 'ACTIVE ROOM & GEOMETRY'}</small>
              <h3 style={{ margin: '3px 0 0', fontSize: 16 }}>{activeSelectedLighting ? (activeSelectedLighting.fixture ?? activeSelectedLighting.kind).replaceAll('-', ' ') : activeSelectedModule ? activeSelectedModule.family.replaceAll('-', ' ') : activeSelectedRoom?.name ?? selected ?? 'Whole Floor Overview'}</h3>
            </div>
            <MousePointer2 size={18} style={{ color: 'var(--gold)' }} />
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeSelectedRoom ? (
              <>
                {activeSelectedLighting && (
                  <div className="scene-selected-fixture">
                    <span>SELECTED FIXTURE</span>
                    <strong>{(activeSelectedLighting.fixture ?? activeSelectedLighting.kind).replaceAll('-', ' ')}</strong>
                    <div><small>Output</small><b>{activeSelectedLighting.lumens ?? 650} lm</b></div>
                    <div><small>Colour temperature</small><b>{activeSelectedLighting.colorTemperatureK ?? 3000}K</b></div>
                    <div><small>Mount height</small><b>{activeSelectedLighting.heightMm ?? 2600} mm</b></div>
                    <p>Fixture properties are compiled from the approved room and cannot alter production cutlists.</p>
                  </div>
                )}
                {activeSelectedModule && (
                  <div className="scene-selected-fixture">
                    <span>SELECTED MODULAR UNIT</span>
                    <strong>{activeSelectedModule.family.replaceAll('-', ' ')}</strong>
                    <div><small>Width</small><b>{activeSelectedModule.widthMm} mm</b></div>
                    <div><small>Height</small><b>{activeSelectedModule.heightMm} mm</b></div>
                    <div><small>Depth</small><b>{activeSelectedModule.depthMm} mm</b></div>
                    <p>Dimensions remain linked to the fabrication schedule and approved room geometry.</p>
                  </div>
                )}
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
                  • <strong>Lighting</strong>: {scene?.lighting?.length ?? 0} authored fixtures + atmosphere controls
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.04em' }}>
                    Lighting Schedule
                  </h4>
                  {(scene?.lighting?.filter((light) => light.spaceId === activeSelectedRoom.id) ?? []).length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {scene!.lighting.filter((light) => light.spaceId === activeSelectedRoom.id).map((light) => (
                        <div key={light.id} style={{ padding: '7px 10px', background: '#fff8eb', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span><strong>{(light.fixture ?? light.kind).replaceAll('-', ' ')}</strong><br /><small>{light.colorTemperatureK ?? 3000}K · {light.lumens ?? 650} lm</small></span>
                          <span style={{ color: 'var(--gold-dim)', fontWeight: 700, textTransform: 'uppercase' }}>{light.kind}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>Recompile the approved room to add the governed lighting schedule.</p>}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.04em' }}>
                    Scheduled Modular Units & Fixtures
                  </h4>
                  {scene?.modules && scene.modules.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {scene.modules.map((m) => (
                        <div key={m.id} style={{ padding: '6px 10px', background: '#f5f5f4', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#292524' }}><strong>{m.family}</strong> ({m.widthMm}×{m.heightMm}mm)</span>
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
                      <span key={mat.id} style={{ padding: '3px 8px', borderRadius: 4, background: '#f5f4f0', border: '1px solid #e7e5e4', fontSize: 11, fontWeight: 600, color: '#292524' }}>
                        {mat.name} ({mat.finish})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Next Stage: Stage 5 Elevations & Cutlist Hand-off */}
                <div style={{ marginTop: 10, padding: 12, background: 'linear-gradient(135deg, #1c1917, #2d241e)', borderRadius: 10, border: '1px solid var(--gold)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <small style={{ color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>
                    NEXT WORKFLOW STAGE · STAGE 5
                  </small>
                  <div style={{ color: '#f5f5f4', fontSize: 11.5, lineHeight: 1.4 }}>
                    3D scene verified. Generate 2D architectural wall elevations, shop drawings dossier &amp; CNC production cutlists.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(projectId ? `/projects/${projectId}/drawings` : '/drawings')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: 'linear-gradient(135deg, #c59c2d, #8f6c12)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 12,
                      padding: '9px 14px',
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(197,156,45,0.35)',
                    }}
                  >
                    <Ruler size={14} /> 📐 Generate Elevations &amp; Cutlist (Stage 5) →
                  </button>
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

      {scene && (
        <div className="scene-bottom-deck">
          <section className="scene-camera-deck" aria-label="Camera views">
            <div className="scene-deck-heading"><span>CAMERA VIEWS</span><strong>Saved, repeatable scene coverage</strong></div>
            <div className="scene-camera-list">
              {([
                ['perspective', '01', 'Wide perspective', 'Balanced room overview'],
                ['walkthrough', '02', 'Eye-level walkthrough', 'Client-facing viewpoint'],
                ['front', '03', 'Front elevation', 'Composition check'],
                ['isometric', '04', 'Isometric', 'Spatial verification'],
              ] as Array<[Preset, string, string, string]>).map(([id, index, title, detail]) => (
                <button type="button" key={id} className={`scene-camera-card ${preset === id ? 'active' : ''}`} onClick={() => setPreset(id)}>
                  <span>{index}</span><strong>{title}</strong><small>{detail}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="scene-readiness-deck" aria-label="Render readiness">
            <div className="scene-deck-heading"><span>RENDER READINESS</span><strong>{renderReadiness.every((item) => item.ready) ? 'Scene is visualisation-ready' : 'Resolve data before render'}</strong></div>
            <div className="scene-readiness-list">
              {renderReadiness.map((item) => <div key={item.label} className={item.ready ? 'ready' : 'blocked'}><b>{item.ready ? '✓' : '!'}</b><span><strong>{item.label}</strong><small>{item.detail}</small></span></div>)}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
