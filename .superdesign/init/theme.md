# Design tokens

## Compact summary

- Warm application ground: `#f7f3eb`; paper/card: `#fff`; ink: `#1c1917`; muted: `#78716c`.
- Brand action: brown `#3d2a1a`; supporting gold is used for workflow progress.
- Borders: `#e7e5e4` / `#d6d3d1`; rounded controls are 6–10px.
- Typography is a restrained editorial product system: strong dark headings, compact uppercase kickers, readable sans-serif labels.
- Desktop uses a fixed studio sidebar and command bar. Mobile uses a drawer and a one-column work area.

## Source files

The visual source is `apps/web/src/shell.css`, `apps/web/src/index.css`, and route-specific CSS such as `apps/web/src/features/dashboard/studio-dashboard.css`. Route pages use semantic buttons, `ui-card`, and `ui-badge` primitives above.
