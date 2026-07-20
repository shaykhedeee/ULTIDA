export type AuraTool = {
  id: string;
  label: string;
  group: 'plan' | 'scene' | 'visual' | 'production' | 'commercial';
  description: string;
  mode: 'read' | 'propose' | 'confirm';
  requires: string[];
};

export const AURA_TOOLS: AuraTool[] = [
  { id: 'analyze_plan', label: 'Analyze floor plan', group: 'plan', description: 'Read rooms, walls, openings, dimensions and confidence from an uploaded plan.', mode: 'propose', requires: ['source_asset'] },
  { id: 'place_modular_kitchen', label: 'Build modular kitchen', group: 'scene', description: 'Suggest and validate kitchen modules against the approved plan.', mode: 'propose', requires: ['approved_plan', 'scene'] },
  { id: 'generate_tv_unit', label: 'TV unit generator', group: 'scene', description: 'Create a parameterized TV wall concept with cable, storage and production metadata.', mode: 'propose', requires: ['approved_plan', 'scene'] },
  { id: 'change_laminate', label: 'Laminate changer', group: 'visual', description: 'Apply a material direction to selected scene modules and generate a labelled visual proposal.', mode: 'propose', requires: ['scene', 'selected_modules'] },
  { id: 'generate_visual_proposal', label: 'AI visual proposal', group: 'visual', description: 'Generate a room visual using scene context, references, masks and provenance.', mode: 'confirm', requires: ['scene', 'room'] },
  { id: 'generate_elevations', label: 'Generate elevations', group: 'production', description: 'Project the approved scene into wall elevations, DXF and PDF sheets.', mode: 'confirm', requires: ['scene'] },
  { id: 'generate_cutlist', label: 'Generate cutlist', group: 'production', description: 'Create production parts, hardware, edging and sheet requirements from approved modules.', mode: 'confirm', requires: ['scene', 'production_ready'] },
  { id: 'calculate_quote', label: 'Calculate quote', group: 'commercial', description: 'Price the approved design with materials, labour, GST and margin controls.', mode: 'confirm', requires: ['scene', 'catalog_prices'] },
];

export function listAuraTools(group?: AuraTool['group']) { return group ? AURA_TOOLS.filter((tool) => tool.group === group) : AURA_TOOLS; }
