import { z } from 'zod';

export const LivingRequirementSchema = z.object({
  seating_count: z.number().int().positive().optional(),
  tv_size_inch: z.number().int().positive().optional(),
  pooja_unit: z.string().optional(),
  display: z.boolean().optional(),
  study: z.boolean().optional(),
  partition: z.boolean().optional(),
  crockery: z.boolean().optional(),
}).partial();

export const BedroomRequirementSchema = z.object({
  bed_size: z.string().optional(),
  wardrobe: z.string().optional(),
  dresser: z.boolean().optional(),
  study: z.boolean().optional(),
  tv: z.boolean().optional(),
  side_tables: z.string().optional(),
  storage: z.string().optional(),
}).partial();

export const KitchenRequirementSchema = z.object({
  shape: z.string().optional(),
  appliances: z.array(z.string()).default([]),
  sink: z.string().optional(),
  hob: z.string().optional(),
  chimney: z.string().optional(),
  fridge: z.string().optional(),
  pantry: z.boolean().optional(),
  dishwasher: z.boolean().optional(),
  utility: z.boolean().optional(),
}).partial();

export const RoomRequirementsSchema = z.object({
  project_id: z.string().uuid(),
  space_id: z.string().uuid(),
  floor_plan_version_id: z.string().uuid().optional(),
  room_type: z.string().min(1),
  name: z.string().optional(),
  ceiling_height_mm: z.number().int().positive().default(2700),
  false_ceiling: z.string().default(''),
  floor_finish: z.string().default(''),
  existing_fixed_items: z.array(z.string()).default([]),
  design_priority: z.enum(['basic','standard','premium','luxury']).default('standard'),
  style_preference: z.string().default(''),
  budget_allocation_inr: z.number().nonnegative().default(0),
  living: LivingRequirementSchema.optional(),
  bedroom: BedroomRequirementSchema.optional(),
  kitchen: KitchenRequirementSchema.optional(),
  required_furniture: z.array(z.string()).default([]),
});

export type RoomRequirements = z.infer<typeof RoomRequirementsSchema>;
export type LivingRequirement = z.infer<typeof LivingRequirementSchema>;
export type BedroomRequirement = z.infer<typeof BedroomRequirementSchema>;
export type KitchenRequirement = z.infer<typeof KitchenRequirementSchema>;
