/**
 * packages/aura-tools/src/prompt_compiler.ts
 *
 * THE THING YOU ASKED FOR: brief data flowing visibly through to the AI
 * prompt, like an n8n pipeline -- each stage below is a pure function,
 * typed input -> typed output, independently testable and independently
 * loggable. Nothing about "what the AI was told and why" is hidden inside
 * one giant prompt-string-builder function.
 *
 * PIPELINE
 *   BriefCoreV1 + RoomRequirementsV1 + CanonicalPlanV1(room)
 *     -> Stage 1: deriveDesignIntent()      => DesignIntentV1
 *     -> Stage 2: buildRoomContext()        => RoomContextV1
 *     -> Stage 3: compilePromptSegments()   => PromptSegments
 *     -> Stage 4: assembleFinalPrompt()     => CompiledPromptV1  (sent to provider-gateway)
 *
 * Every stage's output is meant to be persisted alongside the render job
 * (ai_runs table already exists per your migration work -- add a
 * `prompt_compiler_trace` JSONB column there, or a sibling table) so a
 * designer or you can literally see: here's the brief data, here's what it
 * became at each stage, here's the final prompt, here's what came back.
 * That visibility IS the "like n8n" property -- it's not about the tool,
 * it's about each transformation being inspectable.
 */

import type { BriefCoreV1, RoomRequirementsV1, StylePreference, PriorityDriver } from '../../contracts/src/brief_schema';

// ---- Minimal shape of an approved room from CanonicalPlanV1 ----
export interface ApprovedRoomGeometry {
  roomId: string;
  roomType: string;
  areaSqft: number;
  dimensionsMm: { width: number; length: number };
  ceilingHeightMm: number;
  windowCount: number;
  doorCount: number;
  orientation: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | null;
}

// ================= STAGE 1: Brief -> Design Intent =================

export interface DesignIntentV1 {
  styleKeywords: string[];
  priorityWeights: Record<PriorityDriver, number>; // rank 1 = 1.0, rank 2 = 0.66, rank 3 = 0.33
  hardConstraints: string[];
  budgetTier: BriefCoreV1['budgetBand'];
  householdContext: string; // human-readable summary for the prompt, derived not copied
}

const STYLE_KEYWORDS: Record<StylePreference, string[]> = {
  contemporary_minimal: ['clean lines', 'minimal ornamentation', 'neutral palette', 'uncluttered'],
  warm_modern: ['warm wood tones', 'soft textures', 'modern silhouettes', 'inviting'],
  classic_traditional: ['classic detailing', 'rich materials', 'symmetry', 'traditional Indian motifs'],
  industrial: ['exposed materials', 'metal accents', 'raw textures', 'utilitarian forms'],
  scandinavian_light: ['light woods', 'airy', 'functional', 'pale neutral palette'],
  indian_contemporary: ['contemporary forms with Indian material palette', 'jali-inspired detailing', 'warm neutrals'],
  let_designer_decide: [], // deliberately empty -- the compiler must not invent a style, flag it downstream
};

export function deriveDesignIntent(brief: BriefCoreV1): DesignIntentV1 {
  const weights: Partial<Record<PriorityDriver, number>> = {};
  brief.topPriorities.forEach((p, i) => { weights[p] = [1.0, 0.66, 0.33][i] ?? 0.2; });

  const hardConstraints: string[] = [];
  if (brief.constraints.vastuRequired) hardConstraints.push('must comply with Vastu zone recommendations for this room type');
  if (brief.constraints.noFalseCeiling) hardConstraints.push('no false ceiling');
  if (brief.constraints.petSafeMaterialsRequired) hardConstraints.push('pet-safe, scratch-resistant, non-toxic materials only');
  if (brief.household.elderly > 0) hardConstraints.push('avoid trip hazards, ensure clear circulation width for elderly mobility');
  if (brief.household.children > 0) hardConstraints.push('rounded edges on low furniture, no low-hanging fragile decor');

  return {
    styleKeywords: STYLE_KEYWORDS[brief.stylePreference],
    priorityWeights: weights as Record<PriorityDriver, number>,
    hardConstraints,
    budgetTier: brief.budgetBand,
    householdContext: `${brief.household.adults} adult(s)${brief.household.children ? `, ${brief.household.children} child(ren)` : ''}${brief.household.elderly ? `, ${brief.household.elderly} elderly` : ''}${brief.household.pets ? ', has pets' : ''}`,
  };
}

// ================= STAGE 2: + Room -> Room Context =================

export interface RoomContextV1 {
  roomId: string;
  roomType: string;
  geometrySummary: string; // human-readable, derived from real measured data only
  requirements: RoomRequirementsV1 | null;
  intent: DesignIntentV1;
  missingDataFlags: string[]; // visible gaps -- what wasn't available, so the prompt doesn't silently guess
}

export function buildRoomContext(
  room: ApprovedRoomGeometry,
  requirements: RoomRequirementsV1 | null,
  intent: DesignIntentV1,
): RoomContextV1 {
  const missingDataFlags: string[] = [];
  if (!requirements) missingDataFlags.push('No room-specific requirements captured yet — design will use generic defaults for this room type, not client-specific input.');
  if (!room.orientation) missingDataFlags.push('Orientation unknown — Vastu-specific recommendations cannot be generated for this room.');

  const geometrySummary = `${room.roomType}, ${room.dimensionsMm.width}mm × ${room.dimensionsMm.length}mm (${room.areaSqft} sqft), ${room.ceilingHeightMm}mm ceiling, ${room.windowCount} window(s), ${room.doorCount} door(s)${room.orientation ? `, facing ${room.orientation}` : ''}`;

  return { roomId: room.roomId, roomType: room.roomType, geometrySummary, requirements, intent, missingDataFlags };
}

// ================= STAGE 3: Room Context -> Prompt Segments =================

export interface PromptSegments {
  geometrySegment: string;
  styleSegment: string;
  constraintSegment: string;
  requirementSegment: string;
  negativeConstraintSegment: string;
}

export function compilePromptSegments(ctx: RoomContextV1): PromptSegments {
  const styleSegment = ctx.intent.styleKeywords.length
    ? `Style: ${ctx.intent.styleKeywords.join(', ')}.`
    : 'Style: no client preference specified — propose within the budget tier, flag as designer-choice, do not present as client-requested.';

  const priorityList = Object.entries(ctx.intent.priorityWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k.replace(/_/g, ' '));

  const requirementSegment = ctx.requirements
    ? buildRequirementSegment(ctx.requirements)
    : 'No room-specific requirements on file — generic layout for this room type only.';

  return {
    geometrySegment: `Exact room geometry (must not be altered): ${ctx.geometrySummary}.`,
    styleSegment,
    constraintSegment: [
      `Priority order: ${priorityList.join(' > ')}.`,
      `Budget tier: ${ctx.intent.budgetTier}.`,
      ...ctx.intent.hardConstraints,
    ].join(' '),
    requirementSegment,
    negativeConstraintSegment: [
      'Do not alter wall positions, room dimensions, door/window locations.',
      'Do not invent furniture or fixtures not implied by the requirements above.',
      ctx.missingDataFlags.length ? `Known data gaps: ${ctx.missingDataFlags.join(' ')}` : '',
    ].filter(Boolean).join(' '),
  };
}

function buildRequirementSegment(req: RoomRequirementsV1): string {
  const parts: string[] = [];
  if (req.mustHaveFurniture.length) parts.push(`Must include: ${req.mustHaveFurniture.join(', ')}.`);
  parts.push(`Storage priority: ${req.storagePriority}.`);
  if (req.kitchen) parts.push(`Kitchen: ${req.kitchen.cookingStyle} cooking style, ${req.kitchen.hasChimney ? 'with' : 'without'} chimney, appliances: ${req.kitchen.applianceList.join(', ') || 'none specified'}${req.kitchen.tallUnitNeeded ? ', tall unit required' : ''}.`);
  if (req.bedroom) parts.push(`Bedroom: ${req.bedroom.wardrobeType} wardrobe${req.bedroom.studyCornerNeeded ? ', study corner required' : ''}.`);
  if (req.livingRoom) parts.push(`Living room: seating for ${req.livingRoom.seatingCapacity}${req.livingRoom.tvWallNeeded ? ', TV wall required' : ''}${req.livingRoom.poojaCornerNeeded ? ', pooja corner required' : ''}.`);
  return parts.join(' ');
}

// ================= STAGE 4: Segments -> Final Compiled Prompt =================

export interface CompiledPromptV1 {
  promptVersion: string; // bump whenever the compiler logic changes, for reproducibility
  finalPrompt: string;
  segments: PromptSegments; // kept alongside the final string, not discarded -- this is the audit trail
  sourceRoomId: string;
  sourceBriefFieldsUsed: string[]; // explicit list, for the "did the brief actually reach the prompt" question
}

export const PROMPT_COMPILER_VERSION = '1.0.0';

export function assembleFinalPrompt(ctx: RoomContextV1, segments: PromptSegments): CompiledPromptV1 {
  const finalPrompt = [
    segments.geometrySegment,
    segments.styleSegment,
    segments.constraintSegment,
    segments.requirementSegment,
    segments.negativeConstraintSegment,
  ].join('\n');

  return {
    promptVersion: PROMPT_COMPILER_VERSION,
    finalPrompt,
    segments,
    sourceRoomId: ctx.roomId,
    sourceBriefFieldsUsed: [
      'stylePreference', 'topPriorities', 'budgetBand', 'constraints',
      'household', ...(ctx.requirements ? ['roomRequirements'] : []),
    ],
  };
}

// ================= Orchestrator (the "run the whole n8n flow" entrypoint) =================

export function compilePrompt(
  brief: BriefCoreV1,
  room: ApprovedRoomGeometry,
  requirements: RoomRequirementsV1 | null,
): CompiledPromptV1 {
  const intent = deriveDesignIntent(brief);
  const ctx = buildRoomContext(room, requirements, intent);
  const segments = compilePromptSegments(ctx);
  return assembleFinalPrompt(ctx, segments);
}
