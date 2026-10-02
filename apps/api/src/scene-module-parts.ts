import { RenderIntentV1Schema } from '@ultida/contracts';
import { COMPILER_REGISTRY, type CategoryType, type Part } from '@ultida/module-framework';
import type { CompiledModulePart } from '@ultida/scene-compiler';
import { IndianModularCatalog } from '@ultida/catalog-core';
import { DEFAULT_SCENE_GEOMETRY_CONVENTION, rotateScenePlanPoint, type SceneGeometryConvention } from '@ultida/scene-core';

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
  if (normalized.includes('island')) return 'island';
  if (normalized.includes('tv')) return 'tv_unit';
  if (normalized.includes('wardrobe')) return 'wardrobe';
  if (normalized.includes('crockery')) return 'crockery_unit';
  if (normalized.includes('study')) return 'study_unit';
  if (normalized.includes('pooja')) return 'pooja_unit';
  if (normalized.includes('kitchen')) return 'kitchen';
  if (normalized.includes('bed')) return 'bed';
  if (normalized.includes('utility')) return 'utility';
  if (normalized.includes('light')) return 'freestanding_lighting';
  return null;
}

function wallLengthMm(wall: CanonicalWall) {
  return Math.hypot(wall.worldEnd.xMm - wall.worldStart.xMm, wall.worldEnd.yMm - wall.worldStart.yMm);
}

function scenePosition(
  modulePosition: { xMm: number; yMm: number; zMm: number; rotationDeg: number },
  local: { xMm: number; yMm: number; zMm: number },
  convention: SceneGeometryConvention,
) {
  const rotated = rotateScenePlanPoint(local.xMm, local.yMm, modulePosition.rotationDeg, convention);
  return {
    xMm: modulePosition.xMm + rotated.xMm,
    yMm: modulePosition.yMm + rotated.yMm,
    zMm: modulePosition.zMm + local.zMm,
  };
}

export function compileStoredModuleForScene(
  module: StoredModule,
  walls: CanonicalWall[],
  convention: SceneGeometryConvention = DEFAULT_SCENE_GEOMETRY_CONVENTION,
): { ok: true; module: CompiledModulePart; parts: CompiledModulePart[] } | { ok: false; code: string; message: string } {
  const config = module.config_json ?? {};
  const position = module.position_json ?? {};
  const intent = config.designIntent === undefined ? null : RenderIntentV1Schema.safeParse(config.designIntent);
  if (intent && !intent.success) return { ok: false, code: 'MODULE_STYLE_INVALID', message: 'The unit style reference is invalid. Choose it again from the library.' };
  const widthMm = Number(config.widthMm);
  const depthMm = Number(config.depthMm);
  const heightMm = Number(config.heightMm);
  const xMm = Number(position.xMm);
  const yMm = Number(position.yMm);
  const rotationDeg = Number(position.rotationDeg ?? 0);
  const family = String(config.family ?? module.category);
  const zMm = Number(position.zMm ?? 0);
  if (![widthMm, depthMm, heightMm, xMm, yMm, rotationDeg, zMm].every(Number.isFinite) || Math.min(widthMm, depthMm, heightMm) <= 0 || zMm < 0) {
    return { ok: false, code: 'MODULE_INSTANCE_NOT_SCENE_READY', message: `Module ${module.id} has incomplete millimetre geometry.` };
  }

  const catalogModule = IndianModularCatalog.find((candidate) => candidate.id === module.template_id);
  const moduleEnvelope: CompiledModulePart = {
    id: module.id, templateId: module.template_id, roomId: module.space_id, family, widthMm, depthMm, heightMm,
    xMm, yMm, zMm: Number(position.zMm ?? 0), rotationDeg, anchor: 'wall', materialId: typeof config.materialId === 'string' ? config.materialId : undefined,
    // Asset URLs are resolved only from the trusted catalog record, never from
    // browser module config. The renderer falls back to this exact envelope if
    // the optional digital twin cannot load.
    glbUrl: catalogModule?.glbUrl,
    designIntent: intent?.success ? intent.data : undefined,
  };
  const islandTemplate = ['kit-island-waterfall-1800', 'wardrobe-island-jewellery-900'].includes(module.template_id ?? '');
  const category = islandTemplate ? 'island' : compilerCategory(family);
  if (!category) return { ok: true, module: moduleEnvelope, parts: [] };

  const wallId = typeof position.wallId === 'string' ? position.wallId : '';
  const wall = walls.find((candidate) => candidate.id === wallId);
  if (!wall) return { ok: false, code: 'MODULE_WALL_NOT_FOUND', message: `Module ${module.id} references a wall outside the active plan.` };
  if (!Number.isFinite(wall.heightMm) || Number(wall.heightMm) <= 0) return { ok: false, code: 'ROOM_CEILING_UNCONFIRMED', message: 'Confirm the measured wall and ceiling height before compiling this room.' };
  if (zMm + heightMm > Number(wall.heightMm)) return { ok: false, code: 'MODULE_EXCEEDS_HEIGHT', message: `Module ${module.id} reaches ${zMm + heightMm} mm but the measured ceiling is ${wall.heightMm} mm. Reduce its height or mounting level.` };
  const compiler = COMPILER_REGISTRY[category];
  const configuration = typeof config.configuration === 'object' && config.configuration ? config.configuration as Record<string, unknown> : {};
  const parameters = typeof config.parameters === 'object' && config.parameters ? config.parameters as Record<string, unknown> : {};
  // Module family remains a placement/category concept. The saved archetype is
  // the construction choice that must reach the compiler unchanged.
  const archetype = typeof parameters.archetype === 'string'
    ? parameters.archetype
    : typeof parameters.family === 'string'
      ? parameters.family
      : typeof configuration.archetype === 'string'
        ? configuration.archetype
        : undefined;
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
      ...(archetype ? { archetype } : {}),
      totalWidthMm: widthMm,
      totalDepthMm: depthMm,
      totalHeightMm: heightMm,
      drawerCount,
      shutterCount,
      lighting,
      shutterStyle,
      handleStyle,
      includeLoft,
      ...(configuration.loftHeightMm !== undefined ? { loftHeightMm: configuration.loftHeightMm } : {}),
      glassProfile,
      profileGlassOption: glassProfile,
    },
    wall: { id: wall.id, widthMm: wallLengthMm(wall), heightMm: Number(wall.heightMm ?? 0), depthMm },
  });
  if (!compiled.valid) {
    return { ok: false, code: 'MODULE_COMPILATION_BLOCKED', message: compiled.blockingViolations.join(' ') || `Module ${module.id} did not satisfy its construction rules.` };
  }
  const modulePosition = { xMm, yMm, zMm: moduleEnvelope.zMm ?? 0, rotationDeg };
  return {
    ok: true,
    module: moduleEnvelope,
    parts: compiled.parts.map((part: Part) => ({
      id: part.id,
      moduleId: module.id,
      roomId: module.space_id,
      family,
      semanticType: part.meta.semanticType,
      name: part.name,
      widthMm: part.size.widthMm,
      depthMm: part.size.depthMm,
      heightMm: part.size.heightMm,
      ...scenePosition(modulePosition, part.transform, convention),
      rotationDeg,
      materialId: part.meta.materialSlot.id,
      kind: part.kind ?? (part.meta.semanticType === 'lighting_anchor' ? 'lighting_anchor' : undefined),
      fixtureType: part.fixtureType ?? part.meta.fixtureType,
      colorTemperatureK: part.colorTemperatureK ?? part.meta.colorTemperatureK,
      lengthMm: part.lengthMm ?? part.meta.lengthMm,
    })),
  };
}
