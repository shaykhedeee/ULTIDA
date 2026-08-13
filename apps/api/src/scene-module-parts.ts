import { COMPILER_REGISTRY, type CategoryType } from '@ultida/module-framework';
import type { CompiledModulePart } from '@ultida/scene-compiler';

type StoredModule = {
  id: string;
  space_id: string;
  category: string;
  config_json: Record<string, unknown>;
  position_json: Record<string, unknown>;
  template_id?: string;
};

type CanonicalWall = {
  id: string;
  worldStart: { xMm: number; yMm: number };
  worldEnd: { xMm: number; yMm: number };
  heightMm?: number;
};

function compilerCategory(family: string): CategoryType | null {
  const normalized = family.toLowerCase().replaceAll('-', '_');
  if (normalized.includes('tv')) return 'tv_unit';
  if (normalized.includes('wardrobe')) return 'wardrobe';
  if (normalized.includes('crockery')) return 'crockery_unit';
  if (normalized.includes('study')) return 'study_unit';
  if (normalized.includes('pooja')) return 'pooja_unit';
  if (normalized.includes('kitchen')) return 'kitchen';
  if (normalized.includes('bed')) return 'bed';
  if (normalized.includes('utility')) return 'utility';
  return null;
}

function wallLengthMm(wall: CanonicalWall) {
  return Math.hypot(wall.worldEnd.xMm - wall.worldStart.xMm, wall.worldEnd.yMm - wall.worldStart.yMm);
}

function scenePosition(
  modulePosition: { xMm: number; yMm: number; rotationDeg: number },
  local: { xMm: number; yMm: number; zMm: number },
) {
  // Keep the part transform convention aligned with the existing scene.v1
  // adapter and deterministic renderer, both of which rotate plan geometry by
  // negative yaw when mapping the plan's second axis into world Z.
  const radians = (-modulePosition.rotationDeg * Math.PI) / 180;
  return {
    xMm: modulePosition.xMm + local.xMm * Math.cos(radians) - local.yMm * Math.sin(radians),
    yMm: modulePosition.yMm + local.xMm * Math.sin(radians) + local.yMm * Math.cos(radians),
    zMm: local.zMm,
  };
}

export function compileStoredModuleForScene(
  module: StoredModule,
  walls: CanonicalWall[],
): { ok: true; module: CompiledModulePart; parts: CompiledModulePart[] } | { ok: false; code: string; message: string } {
  const config = module.config_json ?? {};
  const position = module.position_json ?? {};
  const widthMm = Number(config.widthMm);
  const depthMm = Number(config.depthMm);
  const heightMm = Number(config.heightMm);
  const xMm = Number(position.xMm);
  const yMm = Number(position.yMm);
  const rotationDeg = Number(position.rotationDeg ?? 0);
  const family = String(config.family ?? module.category);
  if (![widthMm, depthMm, heightMm, xMm, yMm, rotationDeg].every(Number.isFinite)) {
    return { ok: false, code: 'MODULE_INSTANCE_NOT_SCENE_READY', message: `Module ${module.id} has incomplete millimetre geometry.` };
  }

  const moduleEnvelope: CompiledModulePart = {
    id: module.id, roomId: module.space_id, family, widthMm, depthMm, heightMm,
    xMm, yMm, zMm: Number(position.zMm ?? 0), rotationDeg, anchor: 'wall', materialId: typeof config.materialId === 'string' ? config.materialId : undefined,
  };
  const category = compilerCategory(family);
  if (!category) return { ok: true, module: moduleEnvelope, parts: [] };

  const wallId = typeof position.wallId === 'string' ? position.wallId : '';
  const wall = walls.find((candidate) => candidate.id === wallId);
  if (!wall) return { ok: false, code: 'MODULE_WALL_NOT_FOUND', message: `Module ${module.id} references a wall outside the active plan.` };
  const compiler = COMPILER_REGISTRY[category];
  const configuration = typeof config.configuration === 'object' && config.configuration ? config.configuration as Record<string, unknown> : {};
  const parameters = typeof config.parameters === 'object' && config.parameters ? config.parameters as Record<string, unknown> : {};
  const drawerCount = typeof configuration.drawerCount === 'number' ? configuration.drawerCount : undefined;
  const shutterCount = typeof configuration.shutterCount === 'number' ? configuration.shutterCount : undefined;
  const lighting = configuration.lighting === 'shelf-led' || configuration.lighting === 'vertical-led' ? 'profile_led' : 'none';
  const shutterStyle = typeof configuration.shutterStyle === 'string' ? configuration.shutterStyle : undefined;
  const handleStyle = typeof configuration.handleStyle === 'string' ? configuration.handleStyle : undefined;
  const includeLoft = configuration.includeLoft === true;
  const glassProfile = configuration.glassProfile === true;
  const compiled = compiler({
    templateVersionId: module.template_id ?? `catalog-${family}`,
    instanceId: module.id,
    parameters: {
      ...parameters,
      ...config,
      totalWidthMm: widthMm,
      totalDepthMm: depthMm,
      totalHeightMm: heightMm,
      drawerCount,
      shutterCount,
      lighting,
      shutterStyle,
      handleStyle,
      includeLoft,
      glassProfile,
      profileGlassOption: glassProfile,
    },
    wall: { id: wall.id, widthMm: wallLengthMm(wall), heightMm: Number(wall.heightMm ?? 0), depthMm },
  });
  if (!compiled.valid) {
    return { ok: false, code: 'MODULE_COMPILATION_BLOCKED', message: compiled.blockingViolations.join(' ') || `Module ${module.id} did not satisfy its construction rules.` };
  }
  const modulePosition = { xMm, yMm, rotationDeg };
  return {
    ok: true,
    module: moduleEnvelope,
    parts: compiled.parts.map((part) => ({
      id: part.id,
      moduleId: module.id,
      roomId: module.space_id,
      family,
      semanticType: part.meta.semanticType,
      name: part.name,
      widthMm: part.size.widthMm,
      depthMm: part.size.depthMm,
      heightMm: part.size.heightMm,
      ...scenePosition(modulePosition, part.transform),
      rotationDeg,
      materialId: part.meta.materialSlot.id,
    })),
  };
}
