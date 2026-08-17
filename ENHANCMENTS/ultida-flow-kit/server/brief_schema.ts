/**
 * packages/contracts/src/brief_schema.ts
 *
 * REDESIGN RATIONALE
 * -------------------
 * The old brief tried to capture everything upfront (rooms, lifestyle,
 * storage, kitchen specifics, materials, budget, timeline, services, vastu,
 * references, approvals -- per SMART_PROJECT_EXECUTION_PLAN.md) in one form.
 * That's high-friction AND low-value at intake time: you don't know what
 * kitchen storage a client needs before you know their kitchen's actual
 * shape and size, which you don't have until the plan is analyzed.
 *
 * NEW MODEL: two tiers.
 *   CORE (this file, BriefCoreV1) -- ~9 fields, answerable in under 2
 *   minutes, sufficient to generate a real first design-intent prompt.
 *   ENRICHMENT (RoomRequirementsV1, lives in Spaces, filled in per-room
 *   AFTER the plan is analyzed and rooms are real) -- this is where
 *   "cooking style, storage volume, appliances" etc. actually belongs,
 *   because by then you have a real room with real dimensions to attach
 *   the requirement to, instead of a guess in the abstract.
 *
 * This is the same total information, at the right stage, which is both
 * less friction for the client AND more precise for design generation --
 * "we need more storage" attached to an actual 2400mm wall is useful;
 * the same sentence in a Word-doc-style intake form is not.
 */

export type StylePreference =
  | 'contemporary_minimal' | 'warm_modern' | 'classic_traditional'
  | 'industrial' | 'scandinavian_light' | 'indian_contemporary' | 'let_designer_decide';

export type BudgetBand = 'value' | 'mid' | 'premium' | 'luxury';

export type PriorityDriver =
  | 'storage' | 'aesthetics' | 'budget_efficiency' | 'durability'
  | 'vastu_compliance' | 'low_maintenance' | 'fast_turnaround';

export interface BriefCoreV1 {
  /** Who lives here -- drives ergonomics, storage volume, safety constraints. */
  household: {
    adults: number;
    children: number;
    elderly: number;
    pets: boolean;
  };

  /** Property basics -- enough to size expectations, not full geometry
   *  (that comes from the plan, not from the client's estimate of it). */
  property: {
    type: 'apartment' | 'independent_house' | 'villa' | 'office';
    approxTotalAreaSqft: number | null; // null is fine -- plan analysis will derive the real number
    city: string;
  };

  /** Which rooms are in scope for this project -- just a checklist, not
   *  a requirements form. Requirements move to Spaces per room. */
  roomsInScope: string[]; // e.g. ['living','kitchen','master_bedroom','kids_bedroom']

  /** One style pick from a curated list beats a free-text paragraph --
   *  it's directly usable as a prompt-compiler input, and 'let_designer_decide'
   *  is a legitimate, common, honest answer. */
  stylePreference: StylePreference;

  /** Budget as a band, not a number the client has to defend precision on. */
  budgetBand: BudgetBand;

  /** Rank, don't ask open text -- this becomes prompt-compiler weighting,
   *  directly, with no interpretation step. Max 3, ranked. */
  topPriorities: [PriorityDriver, PriorityDriver, PriorityDriver] | PriorityDriver[];

  /** Hard constraints -- small, explicit, boolean/enum, not paragraphs. */
  constraints: {
    vastuRequired: boolean;
    noFalseCeiling: boolean;
    petSafeMaterialsRequired: boolean;
    strictBudgetCap: boolean;
  };

  /** Optional, genuinely optional -- reference image URLs, not required
   *  to complete the brief. */
  referenceImageUrls: string[];

  /** Timeline as a band, same reasoning as budget. */
  timelineBand: 'urgent_under_4_weeks' | 'standard_2_3_months' | 'flexible';
}

/**
 * RoomRequirementsV1 -- lives on the Spaces screen, one instance per
 * approved room, filled in AFTER floor-plan approval when the room's real
 * dimensions/openings/orientation are known. This is where the old brief's
 * "kitchen storage volume, cooking style, appliances" etc. actually belongs.
 */
export interface RoomRequirementsV1 {
  roomId: string; // references the approved CanonicalPlanV1 room, not a guess
  roomType: string;

  // Common to all room types
  mustHaveFurniture: string[]; // curated checklist per roomType, not free text
  storagePriority: 'minimal' | 'standard' | 'maximize';
  naturalLightNotes: string | null;

  // Room-type-specific requirement blocks -- only the relevant one is shown
  // in the UI based on roomType, so a bedroom form never shows kitchen fields.
  kitchen?: {
    cookingStyle: 'light' | 'daily_indian' | 'heavy_indian_multi_cook';
    hasChimney: boolean;
    applianceList: string[];
    tallUnitNeeded: boolean;
  };
  bedroom?: {
    wardrobeType: 'sliding' | 'openable' | 'walk_in';
    studyCornerNeeded: boolean;
  };
  livingRoom?: {
    seatingCapacity: number;
    tvWallNeeded: boolean;
    poojaCornerNeeded: boolean;
  };
}
