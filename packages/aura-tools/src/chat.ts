import { AURA_TOOLS, type AuraTool } from './index.js';

export type AuraIntent =
  | 'inspect_project'
  | 'analyze_floor_plan'
  | 'configure_module'
  | 'change_material'
  | 'generate_render'
  | 'generate_production'
  | 'commercial_review'
  | 'unknown';

export type AuraChatPlan = {
  intent: AuraIntent;
  summary: string;
  tool: AuraTool | null;
  requiredContext: string[];
  safety: { mutates: boolean; requiresApproval: boolean; geometryAuthority: 'scene.v1' };
  clarification?: string;
};

const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

/**
 * Development intent parser for AURA. It is deliberately deterministic: a
 * future model may improve language understanding, but it must still return
 * this same typed plan before any ULTIDA tool can run.
 */
export function planAuraMessage(message: string): AuraChatPlan {
  const normalized = words(message);
  let intent: AuraIntent = 'unknown';
  let tool: AuraTool | null = null;

  if (hasAny(normalized, ['floor plan', 'floorplan', 'wall detector', 'analyze plan'])) {
    intent = 'analyze_floor_plan';
    tool = AURA_TOOLS.find((candidate) => candidate.id === 'analyze_plan') ?? null;
  } else if (hasAny(normalized, ['laminate', 'material', 'edge band', 'edgeband'])) {
    intent = 'change_material';
    tool = AURA_TOOLS.find((candidate) => candidate.id === 'change_laminate') ?? null;
  } else if (hasAny(normalized, ['render', 'photoreal', 'visual'])) {
    intent = 'generate_render';
    tool = AURA_TOOLS.find((candidate) => candidate.id === 'generate_visual_proposal') ?? null;
  } else if (hasAny(normalized, ['cutlist', 'cut list', 'dxf', 'elevation', 'production'])) {
    intent = 'generate_production';
    tool = hasAny(normalized, ['cutlist', 'cut list'])
      ? AURA_TOOLS.find((candidate) => candidate.id === 'generate_cutlist') ?? null
      : AURA_TOOLS.find((candidate) => candidate.id === 'generate_elevations') ?? null;
  } else if (hasAny(normalized, ['quote', 'invoice', 'price', 'budget', 'finance'])) {
    intent = 'commercial_review';
    tool = AURA_TOOLS.find((candidate) => candidate.id === 'calculate_quote') ?? null;
  } else if (hasAny(normalized, ['kitchen', 'wardrobe', 'tv unit', 'crockery', 'pooja', 'module'])) {
    intent = 'configure_module';
    tool = hasAny(normalized, ['kitchen'])
      ? AURA_TOOLS.find((candidate) => candidate.id === 'place_modular_kitchen') ?? null
      : AURA_TOOLS.find((candidate) => candidate.id === 'generate_tv_unit') ?? null;
  } else if (hasAny(normalized, ['inspect', 'status', 'show', 'what is', 'review'])) {
    intent = 'inspect_project';
  }

  const requiredContext = tool?.requires ?? [];
  const clarification = intent === 'unknown'
    ? 'Tell me whether you want to inspect the project, analyze a floor plan, configure a module, change a laminate, generate a render, create production files, or review pricing.'
    : requiredContext.length
      ? `Before I prepare this, I need: ${requiredContext.join(', ')}.`
      : undefined;

  return {
    intent,
    summary: tool ? `${tool.label}: ${tool.description}` : 'Project inspection and guided next-step planning.',
    tool,
    requiredContext,
    safety: {
      mutates: tool?.mode === 'confirm',
      requiresApproval: Boolean(tool && tool.mode !== 'read'),
      geometryAuthority: 'scene.v1',
    },
    clarification,
  };
}
