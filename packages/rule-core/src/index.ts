export type RuleSeverity = 'hard' | 'soft' | 'advisory';
export type RuleScope = 'global' | 'company' | 'room' | 'project' | 'instance';
export type ModuleCategory = 'tv-unit' | 'study-unit' | 'crockery-unit' | 'wardrobe' | 'kitchen' | 'sofa' | 'storage';

export type RuleViolation = {
  code: string;
  severity: RuleSeverity;
  scope: RuleScope;
  message: string;
  targetId?: string;
  measure?: string;
  actual?: number;
  limit?: number;
  suggestedFix?: {
    action: 'adjust_dimension' | 'adjust_elevation' | 'add_filler' | 'split_shutters' | 'remove_lighting' | 'add_anchoring';
    description: string;
    patch?: Record<string, unknown>;
  };
};

export type ModuleTemplate = {
  id: string;
  category: ModuleCategory;
  name: string;
  mounting: 'floating' | 'floor' | 'wall';
  minWidthMm: number;
  maxWidthMm: number;
  widthIncrementMm: number;
  minDepthMm: number;
  maxDepthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  targetShutterWidthMm: number;
  hasFingerGroove?: boolean;
  supportsProfileLighting?: boolean;
  requiresWallAnchoring?: boolean;
};

export type ModuleVariant = {
  id: string;
  templateId: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shutterCount: number;
  shutterType: 'hinged' | 'sliding' | 'open' | 'glass';
  hasProfileLighting: boolean;
  hasSkirtingLighting: boolean;
  fingerGrooveGapMm?: number;
};

export type ModuleInstance = {
  id: string;
  templateId: string;
  variantId?: string;
  category: ModuleCategory;
  family?: string;
  name?: string;
  mounting?: 'floating' | 'floor' | 'wall';
  position: { xMm: number; yMm: number; elevationMm: number };
  dimensions: { widthMm: number; depthMm: number; heightMm: number };
  wallId?: string;
  offsetAlongWallMm?: number;
  shutterCount?: number;
  shutterType?: 'hinged' | 'sliding' | 'open' | 'glass';
  hasProfileLighting?: boolean;
  hasSkirtingLighting?: boolean;
  hasFingerGroove?: boolean;
  topFillerMm?: number;
  sideFillerMm?: number;
  requiresWallAnchoring?: boolean;
};

export type CandidateLayout = {
  id: string;
  projectId?: string;
  wallId?: string;
  wallLengthMm?: number;
  wallHeightMm?: number;
  modules: ModuleInstance[];
  companySettings?: {
    fingerGrooveGapMm?: number; // default 30
    defaultLoftFillerMm?: number; // default 50
    floatingTvBaseFloorGapMm?: number; // default 200
    targetShutterWidthMm?: number; // default 500
    allowSkirtingStripLight?: boolean; // default false
    allowProfileLighting?: boolean; // default true
  };
};

export type LayoutScore = {
  overallScore: number; // 0 - 100
  passed: boolean;
  hardViolationsCount: number;
  softViolationsCount: number;
  breakdown: {
    ergonomics: number;
    manufacturing: number;
    aesthetics: number;
    clearance: number;
  };
  violations: RuleViolation[];
};

export type DesignRule = {
  id: string;
  code: string;
  name: string;
  category: ModuleCategory | 'general';
  scope: RuleScope;
  severity: RuleSeverity;
  description: string;
  evaluate: (layout: CandidateLayout) => RuleViolation[];
};

export const INDIA_PRODUCTION_PRESET = {
  key: 'production_standard_india_v1',
  boardDefaults: { carcassThicknessMm: 18, backPanelThicknessMm: 6, drawerPanelThicknessMm: 12, shelfDeductionMm: 10 },
  sheetDefaults: { lengthMm: 2440, widthMm: 1220, kerfMm: 3, trimMm: 10 },
  edgeBandDefaults: { visible: '2mm PVC', internal: '0.8mm PVC', hidden: 'none' }
} as const;

// Deterministic Standard Rules Engine Implementation
export const BUILTIN_DESIGN_RULES: DesignRule[] = [
  {
    id: 'rule-finger-groove-gap',
    code: 'COMPANY_FINGER_GROOVE_GAP',
    name: '30mm Finger Groove Gap',
    category: 'general',
    scope: 'company',
    severity: 'hard',
    description: 'Ensure handle-less units have a 30 mm finger groove gap clearance.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const requiredGap = layout.companySettings?.fingerGrooveGapMm ?? 30;
      for (const mod of layout.modules) {
        if (mod.hasFingerGroove) {
          const actualGap = (mod as any).fingerGrooveGapMm ?? 30;
          if (actualGap < requiredGap) {
            violations.push({
              code: 'COMPANY_FINGER_GROOVE_GAP',
              severity: 'hard',
              scope: 'company',
              message: `Finger groove gap must be at least ${requiredGap} mm for handle-less unit ${mod.id}.`,
              targetId: mod.id,
              measure: 'fingerGrooveGapMm',
              actual: actualGap,
              limit: requiredGap,
              suggestedFix: {
                action: 'adjust_dimension',
                description: `Set finger groove gap to ${requiredGap} mm.`,
                patch: { fingerGrooveGapMm: requiredGap }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-floating-tv-floor-gap',
    code: 'COMPANY_FLOATING_TV_FLOOR_GAP',
    name: '200mm Floating TV Base Floor Gap',
    category: 'tv-unit',
    scope: 'company',
    severity: 'hard',
    description: 'Floating TV base units must have a default 200 mm clearance from floor.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const requiredFloorGap = layout.companySettings?.floatingTvBaseFloorGapMm ?? 200;
      for (const mod of layout.modules) {
        if (mod.category === 'tv-unit' && (mod.mounting === 'floating' || mod.position.elevationMm > 0)) {
          if (mod.position.elevationMm < requiredFloorGap) {
            violations.push({
              code: 'COMPANY_FLOATING_TV_FLOOR_GAP',
              severity: 'hard',
              scope: 'company',
              message: `Floating TV unit ${mod.id} requires a minimum floor gap of ${requiredFloorGap} mm (current: ${mod.position.elevationMm} mm).`,
              targetId: mod.id,
              measure: 'elevationMm',
              actual: mod.position.elevationMm,
              limit: requiredFloorGap,
              suggestedFix: {
                action: 'adjust_elevation',
                description: `Elevate floating TV unit to ${requiredFloorGap} mm above floor level.`,
                patch: { elevationMm: requiredFloorGap }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-target-shutter-width',
    code: 'COMPANY_TARGET_SHUTTER_WIDTH',
    name: '500mm Target Shutter Width',
    category: 'general',
    scope: 'company',
    severity: 'soft',
    description: 'Target single shutter width of 500 mm (range 300 mm to 600 mm).',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const targetWidth = layout.companySettings?.targetShutterWidthMm ?? 500;
      for (const mod of layout.modules) {
        const count = mod.shutterCount ?? 1;
        if (count > 0 && mod.shutterType !== 'open') {
          const singleWidth = mod.dimensions.widthMm / count;
          if (singleWidth > 600) {
            const recommendedCount = Math.ceil(mod.dimensions.widthMm / targetWidth);
            violations.push({
              code: 'COMPANY_TARGET_SHUTTER_WIDTH_EXCEEDED',
              severity: 'soft',
              scope: 'company',
              message: `Shutter width of ${Math.round(singleWidth)} mm on module ${mod.id} exceeds recommended max 600 mm.`,
              targetId: mod.id,
              measure: 'shutterWidthMm',
              actual: singleWidth,
              limit: 600,
              suggestedFix: {
                action: 'split_shutters',
                description: `Split module into ${recommendedCount} shutters for optimal ergonomic operation.`,
                patch: { shutterCount: recommendedCount }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-no-skirting-strip-light',
    code: 'COMPANY_NO_SKIRTING_STRIP_LIGHT',
    name: 'No Skirting Strip Light Default',
    category: 'general',
    scope: 'company',
    severity: 'hard',
    description: 'Skirting strip lighting is disabled by default unless explicitly allowed.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const allowSkirting = layout.companySettings?.allowSkirtingStripLight ?? false;
      if (!allowSkirting) {
        for (const mod of layout.modules) {
          if (mod.hasSkirtingLighting) {
            violations.push({
              code: 'COMPANY_NO_SKIRTING_STRIP_LIGHT',
              severity: 'hard',
              scope: 'company',
              message: `Skirting strip lighting on module ${mod.id} violates company design standard.`,
              targetId: mod.id,
              suggestedFix: {
                action: 'remove_lighting',
                description: 'Remove skirting LED strip lighting and use profile shutter lighting instead.',
                patch: { hasSkirtingLighting: false }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-loft-top-filler',
    code: 'COMPANY_LOFT_TOP_FILLER',
    name: '50mm Default Loft Filler',
    category: 'general',
    scope: 'company',
    severity: 'soft',
    description: 'Enforce a default 50 mm loft top filler when gap to ceiling is under 100 mm.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const wallHeight = layout.wallHeightMm ?? 2700;
      const defaultFiller = layout.companySettings?.defaultLoftFillerMm ?? 50;
      for (const mod of layout.modules) {
        const topEdge = mod.position.elevationMm + mod.dimensions.heightMm;
        const ceilingGap = wallHeight - topEdge;
        if (ceilingGap > 0 && ceilingGap < 100) {
          const currentFiller = mod.topFillerMm ?? 0;
          if (currentFiller < defaultFiller) {
            violations.push({
              code: 'COMPANY_LOFT_TOP_FILLER_REQUIRED',
              severity: 'soft',
              scope: 'company',
              message: `Module ${mod.id} near ceiling (gap: ${ceilingGap} mm) requires a top filler of at least ${defaultFiller} mm.`,
              targetId: mod.id,
              measure: 'topFillerMm',
              actual: currentFiller,
              limit: defaultFiller,
              suggestedFix: {
                action: 'add_filler',
                description: `Add a ${defaultFiller} mm top filler panel to seal ceiling gap.`,
                patch: { topFillerMm: defaultFiller }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-study-leg-room',
    code: 'STUDY_LEG_ROOM_MIN',
    name: 'Study Desk Leg Room Clearance',
    category: 'study-unit',
    scope: 'global',
    severity: 'hard',
    description: 'Study desk surface must provide at least 650 mm vertical legroom clearance.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      for (const mod of layout.modules) {
        if (mod.category === 'study-unit' && mod.dimensions.heightMm <= 800) {
          const underClearance = mod.position.elevationMm + (mod.dimensions.heightMm - 100);
          if (underClearance < 650) {
            violations.push({
              code: 'STUDY_LEG_ROOM_MIN',
              severity: 'hard',
              scope: 'global',
              message: `Study desk ${mod.id} has insufficient legroom clearance (${underClearance} mm < 650 mm).`,
              targetId: mod.id,
              measure: 'underClearanceMm',
              actual: underClearance,
              limit: 650,
              suggestedFix: {
                action: 'adjust_elevation',
                description: 'Raise study desk to ensure 650 mm vertical knee clearance.',
                patch: { elevationMm: 650 - (mod.dimensions.heightMm - 100) }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-crockery-glass-span',
    code: 'CROCKERY_GLASS_SHUTTER_SPAN',
    name: 'Crockery Glass Shutter Span Limit',
    category: 'crockery-unit',
    scope: 'global',
    severity: 'hard',
    description: 'Glass shutters on crockery units cannot exceed 450 mm width per door.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      for (const mod of layout.modules) {
        if (mod.category === 'crockery-unit' && mod.shutterType === 'glass') {
          const count = mod.shutterCount ?? 1;
          const doorWidth = mod.dimensions.widthMm / count;
          if (doorWidth > 450) {
            const reqCount = Math.ceil(mod.dimensions.widthMm / 450);
            violations.push({
              code: 'CROCKERY_GLASS_SHUTTER_SPAN',
              severity: 'hard',
              scope: 'global',
              message: `Glass door width of ${Math.round(doorWidth)} mm on crockery unit ${mod.id} exceeds max 450 mm limit.`,
              targetId: mod.id,
              measure: 'doorWidthMm',
              actual: doorWidth,
              limit: 450,
              suggestedFix: {
                action: 'split_shutters',
                description: `Increase glass shutter count to ${reqCount} doors.`,
                patch: { shutterCount: reqCount }
              }
            });
          }
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-crockery-shelf-span',
    code: 'CROCKERY_SHELF_SPAN',
    name: 'Crockery Shelf Load Span',
    category: 'crockery-unit',
    scope: 'global',
    severity: 'hard',
    description: 'Crockery unit shelves exceeding 900 mm span require a central support partition.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      for (const mod of layout.modules) {
        if (mod.category === 'crockery-unit' && mod.dimensions.widthMm > 900) {
          violations.push({
            code: 'CROCKERY_SHELF_SPAN_EXCEEDED',
            severity: 'hard',
            scope: 'global',
            message: `Crockery unit ${mod.id} width (${mod.dimensions.widthMm} mm) exceeds 900 mm unsupported shelf span limit.`,
            targetId: mod.id,
            measure: 'widthMm',
            actual: mod.dimensions.widthMm,
            limit: 900,
            suggestedFix: {
              action: 'adjust_dimension',
              description: 'Add an 18 mm central vertical partition or reduce module width to 900 mm max.'
            }
          });
        }
      }
      return violations;
    }
  },
  {
    id: 'rule-module-collision',
    code: 'MODULE_COLLISION',
    name: '3D Spatial Collision Check',
    category: 'general',
    scope: 'global',
    severity: 'hard',
    description: 'Ensure no two module bounding boxes overlap in 3D space.',
    evaluate: (layout) => {
      const violations: RuleViolation[] = [];
      const mods = layout.modules;
      for (let i = 0; i < mods.length; i++) {
        for (let j = i + 1; j < mods.length; j++) {
          const a = mods[i];
          const b = mods[j];
          const xOverlap = (a.position.xMm < b.position.xMm + b.dimensions.widthMm) && (a.position.xMm + a.dimensions.widthMm > b.position.xMm);
          const zOverlap = (a.position.elevationMm < b.position.elevationMm + b.dimensions.heightMm) && (a.position.elevationMm + a.dimensions.heightMm > b.position.elevationMm);
          if (xOverlap && zOverlap) {
            violations.push({
              code: 'MODULE_COLLISION',
              severity: 'hard',
              scope: 'global',
              message: `Module ${a.id} collides spatially with module ${b.id}.`,
              targetId: a.id,
              suggestedFix: {
                action: 'adjust_elevation',
                description: `Reposition module ${a.id} or ${b.id} to resolve overlap.`
              }
            });
          }
        }
      }
      return violations;
    }
  }
];

export function evaluateRules(layout: CandidateLayout, customRules?: DesignRule[]): RuleViolation[] {
  const rules = customRules ?? BUILTIN_DESIGN_RULES;
  return rules.flatMap((rule) => rule.evaluate(layout));
}

export function scoreCandidateLayout(layout: CandidateLayout, customRules?: DesignRule[]): LayoutScore {
  const violations = evaluateRules(layout, customRules);
  const hardViolations = violations.filter((v) => v.severity === 'hard');
  const softViolations = violations.filter((v) => v.severity === 'soft');
  const advisoryViolations = violations.filter((v) => v.severity === 'advisory');

  const hardPenalty = hardViolations.length * 25;
  const softPenalty = softViolations.length * 8;
  const advisoryPenalty = advisoryViolations.length * 3;

  const overallScore = Math.max(0, Math.min(100, 100 - hardPenalty - softPenalty - advisoryPenalty));
  const passed = hardViolations.length === 0;

  return {
    overallScore,
    passed,
    hardViolationsCount: hardViolations.length,
    softViolationsCount: softViolations.length,
    breakdown: {
      ergonomics: Math.max(0, 100 - (violations.filter(v => v.code.includes('LEG') || v.code.includes('SHUTTER')).length * 15)),
      manufacturing: Math.max(0, 100 - (violations.filter(v => v.code.includes('SPAN') || v.code.includes('FINGER')).length * 15)),
      aesthetics: Math.max(0, 100 - (softViolations.length * 10)),
      clearance: Math.max(0, 100 - (violations.filter(v => v.code.includes('COLLISION') || v.code.includes('GAP')).length * 20))
    },
    violations
  };
}

export function validateModuleRules(input: { family?: string; widthMm?: number; depthMm?: number; walkwayMm?: number; swingClearanceMm?: number; adjacentFamily?: string }): RuleViolation[] {
  const candidate: CandidateLayout = {
    id: 'legacy-input-eval',
    modules: [{
      id: 'input-mod',
      templateId: 'tpl-input',
      category: (input.family?.includes('kitchen') ? 'kitchen' : input.family === 'wardrobe' ? 'wardrobe' : 'storage') as ModuleCategory,
      family: input.family,
      position: { xMm: 0, yMm: 0, elevationMm: 0 },
      dimensions: { widthMm: input.widthMm ?? 600, depthMm: input.depthMm ?? 600, heightMm: 750 }
    }]
  };
  const violations: RuleViolation[] = [];
  if (input.family === 'wardrobe' && input.depthMm !== undefined && input.depthMm < 650) {
    violations.push({ code: 'WARDROBE_SLIDING_DEPTH_MIN', severity: 'hard', scope: 'global', message: 'Wardrobe depth must be at least 650 mm.', measure: 'depthMm', actual: input.depthMm, limit: 650 });
  }
  if (input.family === 'wardrobe' && input.walkwayMm !== undefined && input.walkwayMm < 900) {
    violations.push({ code: 'WARDROBE_WALKIN_PASSAGE_MIN', severity: 'hard', scope: 'global', message: 'Wardrobe passage must be at least 900 mm.', measure: 'walkwayMm', actual: input.walkwayMm, limit: 900 });
  }
  if (input.family === 'wardrobe' && input.swingClearanceMm !== undefined && input.swingClearanceMm < 750) {
    violations.push({ code: 'WARDROBE_SWING_CLEARANCE_MIN', severity: 'hard', scope: 'global', message: 'Wardrobe swing clearance must be at least 750 mm.', measure: 'swingClearanceMm', actual: input.swingClearanceMm, limit: 750 });
  }
  if ((input.family === 'kitchen-hob' && input.adjacentFamily === 'kitchen-sink') || (input.family === 'kitchen-sink' && input.adjacentFamily === 'kitchen-hob')) {
    violations.push({ code: 'KITCHEN_HOB_SINK_ADJACENT', severity: 'hard', scope: 'global', message: 'Hob and sink must have safety clearance and cannot be directly adjacent.', measure: 'adjacentFamily' });
  }
  if ((input.family === 'kitchen-tall-appliance' && input.adjacentFamily === 'kitchen-sink') || (input.family === 'kitchen-sink' && input.adjacentFamily === 'kitchen-tall-appliance')) {
    violations.push({ code: 'KITCHEN_APPLIANCE_SINK_ADJACENT', severity: 'hard', scope: 'global', message: 'Tall appliance units cannot be adjacent to a water sink module.', measure: 'adjacentFamily' });
  }
  if ((input.family === 'kitchen-base' && input.adjacentFamily === 'kitchen-corner') || (input.family === 'kitchen-corner' && input.adjacentFamily === 'kitchen-base')) {
    violations.push({ code: 'KITCHEN_DRAWERS_CORNER_ADJACENT', severity: 'hard', scope: 'global', message: 'Base units adjacent to L-shape corners require filler spacing to prevent collision.', measure: 'adjacentFamily' });
  }
  return [...violations, ...evaluateRules(candidate)];
}
