export type PlanVisionProviderId = 'cloudflare' | 'openai' | 'gemini' | 'structured-floorplan';

/** Server-side studio policy: a credential is configuration, never spending consent. */
export function eligiblePlanVisionProviders(environment: Record<string, string | undefined>, preferred?: PlanVisionProviderId): PlanVisionProviderId[] {
  const configured: PlanVisionProviderId[] = [];
  if (environment.CLOUDFLARE_ACCOUNT_ID && environment.CLOUDFLARE_AI_TOKEN) configured.push('cloudflare');
  if (environment.FLOORPLAN_VISION_URL) configured.push('structured-floorplan');
  if (environment.GEMINI_VISION_OPT_IN === 'true' && (environment.GEMINI_VISION_API_KEY || environment.GEMINI_API_KEY || environment.GOOGLE_AI_STUDIO_KEY_1 || environment.GOOGLE_AI_STUDIO_KEY_2)) configured.push('gemini');
  if (environment.OPENAI_VISION_OPT_IN === 'true' && environment.OPENAI_API_KEY) configured.push('openai');
  const requested = preferred ?? environment.PLAN_ANALYZER_PRIMARY;
  return configured.includes(requested as PlanVisionProviderId)
    ? [requested as PlanVisionProviderId, ...configured.filter(id => id !== requested)]
    : configured;
}
