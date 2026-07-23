export const color = {
  gold: '#c59b2d',
  goldDim: '#a37f1f',
  line: '#e6ddd0',
  surface: '#fffaf4',
  text: '#3a2e22',
  textSecondary: '#7a6b5a',
  textMuted: '#a69b8f',
  success: '#2a6',
  danger: '#c44',
  accent: '#7aa3ff',
};

export const spacing = [0, 4, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48] as const;
export type Spacing = typeof spacing[number];

export const radius = { sm: 6, md: 8, lg: 12, xl: 16 } as const;
export type Radius = typeof radius[keyof typeof radius];

export const shadow = {
  card: '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(58,46,34,0.08)',
  raised: '0 2px 0 rgba(0,0,0,0.05), 0 14px 30px rgba(58,46,34,0.10)',
};

export const font = {
  body: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};
