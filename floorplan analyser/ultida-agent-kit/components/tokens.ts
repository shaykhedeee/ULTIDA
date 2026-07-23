/**
 * packages/ui/tokens.ts
 *
 * Single source of truth for design values. Nothing in apps/web should use
 * a literal hex color, arbitrary Tailwind bracket value, or literal px
 * spacing -- everything routes through here. Run
 * `node scripts/audit_design_tokens.mjs` after wiring this in to confirm.
 *
 * IMPORTANT: if packages/ui already has a tokens file or theme config,
 * do NOT blindly overwrite it -- diff this against it and merge, since the
 * existing one may already reflect real brand decisions made since this
 * was written.
 */

export const colors = {
  // Base surfaces -- dark, premium, per FINAL_PRODUCT_PLAN.md
  surface: {
    base: '#0B0B0D',
    raised: '#141417',
    overlay: '#1C1C20',
    border: '#2A2A30',
  },
  text: {
    primary: '#F5F3EE',
    secondary: '#A8A6A0',
    muted: '#6B6963',
  },
  accent: {
    gold: '#C9A84C',
    goldMuted: '#8C763A',
  },
  // Provenance/state colors -- used ONLY by ProvenanceBadge and status chips,
  // never as general decorative color, so their meaning stays unambiguous.
  state: {
    synthetic: '#B8860B',   // AI proposal, not yet approved -- amber, deliberately unsettled
    approved: '#3E8E5A',    // designer-confirmed, part of the design package -- calm green
    stale: '#8A3B3B',       // source mutated since this was generated -- warning red
    unreviewed: '#6B6963',  // default/fallback value, no human has confirmed it -- neutral, not green
  },
} as const;

export const spacing = {
  // 4px base scale, per FINAL_PRODUCT_PLAN.md "Unified spacing scale (4px base)"
  0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px',
  5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
} as const;

export const radius = {
  sm: '6px', md: '10px', lg: '16px', full: '9999px',
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 16px rgba(0,0,0,0.5)',
  lg: '0 12px 40px rgba(0,0,0,0.6)',
} as const;

export const type = {
  // Inter for UI/body, Outfit for display/headings, per FINAL_PRODUCT_PLAN.md
  body: '"Inter", system-ui, sans-serif',
  display: '"Outfit", "Inter", system-ui, sans-serif',
  scale: {
    xs: '12px', sm: '13px', base: '15px', md: '17px',
    lg: '20px', xl: '26px', xxl: '34px',
  },
} as const;

/** Tailwind CSS var mapping -- add these to tailwind.config once and every
 *  screen can use `bg-surface-raised`, `text-accent-gold`, etc. instead of
 *  arbitrary values. */
export const tailwindThemeExtend = {
  colors: {
    surface: { base: colors.surface.base, raised: colors.surface.raised, overlay: colors.surface.overlay, border: colors.surface.border },
    ink: { primary: colors.text.primary, secondary: colors.text.secondary, muted: colors.text.muted },
    accent: { gold: colors.accent.gold, 'gold-muted': colors.accent.goldMuted },
    state: colors.state,
  },
  borderRadius: radius,
  boxShadow: shadow,
};
