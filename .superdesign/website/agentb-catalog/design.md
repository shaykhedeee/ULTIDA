---
version: "ui2web-website-clone"
name: "Agent B Studio | Designer Login"
description: "Deep charcoal surface with vibrant purple/cyan accents. Centered modal composition using Inter body text and Space Grotesk labels. High-contrast text on dark grounds, with restrained color rationing: purple dominates the primary action button; cyan highlights secondary links and supporting UI. Spacing rhythm of 8px base creates breathing room around form fields and modals."
colors:
  primary: "#824DCB"
  accent: "#25D366"
  background: "#0E1115"
  surface: "#15181E"
  text-primary: "#FFFFFF"
  text-secondary: "#737B8C"
  border: "#22272F"
typography:
  body-md:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.43"
  label-md:
    fontFamily: "Space Grotesk"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "1.33"
    letterSpacing: "-0.6px"
spacing:
  base: "8px"
  gap: "16px"
  card-padding: "24px"
  section-padding: "32px"
rounded:
  control: "6px"
  card: "8px"
  pill: "9999px"
components:
  card: { background: "#15181E", radius: "8px" }
  button: { background: "#824DCB", radius: "9999px" }
---
# Agent B Studio | Designer Login

Source: https://agentb.studio/designer/catalog

## Overview

A dark-mode interface system anchored in near-black backgrounds (#0E1115 and #15181E) with deliberate color hierarchy. The palette reserves vibrant purple (#824DCB) exclusively for primary actions and cyan (#25D366) for secondary interactive elements and micro-interactions. Typography pairs Space Grotesk's geometric weight (24px, 600) for display hierarchy with Inter's neutrality (14px, 400) for body text and form labels. Spacing builds on an 8px base, creating consistent breathing room across inputs, cards, and modal regions.

## Composition

A centered modal card dominates the first screen, vertically stacked: logo icon at the apex, heading and subheading in the center, then two stacked form fields (email and password inputs) occupying full modal width, followed by a full-width primary action button below. A secondary link pair (password recovery link and signup prompt) anchors the modal footer in smaller text. The modal sits on a full-bleed dark background with a fixed header nav (logo, centered nav items, top-right CTA button) and sticky footer nav (footer links, copyright text). This arrangement prioritizes vertical depth over lateral movement — a single-column form path rather than a multi-column or side-by-side layout.

## Colors

**Primary (#824DCB, ~0.6% coverage):** Purple dominates the single full-width action button in the modal. This restraint — using the accent only on the primary CTA — makes the button's role unmistakable and avoids color noise across the page.

**Accent (#25D366, ~0.1% coverage):** Cyan appears on secondary interactive elements: the "Forgot password?" link and the signup prompt link. The extreme scarcity (0.1%) reinforces that these are tertiary paths.

**Background (#0E1115, ~86.7% coverage):** Near-black fills the full-bleed page ground, establishing the dark-mode foundation and making the centered modal card "float" visually.

**Surface (#15181E, ~7.4% coverage):** Slightly lighter charcoal defines the modal card itself and input fields, creating separation from the background without introducing a bright or warm tone. This subtle lift maintains the dark mood while improving card discoverability.

**Text Primary (#FFFFFF, ~2% coverage):** White is reserved for headings, form labels, and all actionable text (button labels, link copy). High contrast against charcoal ensures readability.

**Text Secondary (#737B8C, ~11% combined coverage):** Mid-gray (placeholder text, helper text, footer copy) establishes hierarchy and de-emphasizes non-critical information. The ratio of primary to secondary text is roughly 1:5, keeping the visual weight light.

**Border (#22272F, ~0.5% coverage):** A subtly darker shade than the surface, used for input field borders and card outlines. The minimal contrast prevents hard lines from dominating the composition.

The color logic rejects a high-saturation palette in favor of restraint: the purple accent is earned by appearing only once per viewport, and the cyan is so sparse it reads as a micro-accent. This prevents fatigue on a dark background and reserves surprise for interactive moments.

## Typography

**Space Grotesk 24px / 600 weight / -0.6px letter-spacing (label-md)** is deployed for modal headings and any primary display text. Its geometric, geometric sans-serif character and tight tracking create a sophisticated, tech-forward tone at large scale.

**Inter 14px / 400 weight / 1.43 line-height (body-md)** handles form labels, helper text, input placeholders, and all body copy. Inter's neutrality and optical balance keep the interface readable at small sizes without competing with the Space Grotesk hierarchy.

No serif or display fonts appear; the system is purely geometric sans-serif, reinforcing a contemporary, product-focused identity.

## Layout

Modal card width is constrained (approx. 400px) and centered vertically and horizontally on the page. Form fields stack in a single column (email, password) with 16px gaps between sections. Input height is uniform at ~40px, padding ~12px horizontal / ~8px vertical. The primary button inherits full modal width with 24px padding, maintaining visual unity.

The header nav employs a horizontal flex layout: logo left-aligned, nav items center-clustered, primary CTA button right-aligned. Footer is a single-row footer nav with left-aligned logo and center/right-aligned link clusters. No grid is used; the layout is rule-based flex/block composition, scaling fluidly from mobile (modal width narrows) to desktop (modal remains constrained, centered on wider viewports).

## Components

**Card (modal):** background `#15181E`, radius `8px`, padding `24px`, border `1px solid #22272F`. Shadow is subtle (dark mode — a light gray shadow is avoided; instead, the card relies on its background lift and border to define itself).

**Button (primary action):** background `#824DCB`, radius `9999px`, padding `12px 24px` (implicit from form field height), text `#FFFFFF`. No border. On hover, background shifts toward a brighter purple or gains slight opacity increase (easing: `background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)`).

**Input fields:** background `#0E1115`, border `1px solid #22272F`, border-radius `6px`, padding `12px 12px`, text color `#FFFFFF`, placeholder `#737B8C`. On focus, border becomes `#824DCB` (purple glow effect). Easing on border-color is `0.15s cubic-bezier(0.4, 0, 0.2, 1)`.

**Links (secondary):** text `#25D366`, no underline by default, underline on hover. Easing: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1)`.

## Motion

All transitions use the cubic-bezier easing `cubic-bezier(0.4, 0, 0.2, 1)` with durations: padding `0.2s`, color/background-color/border-color `0.15s`, opacity `0.15s`, transform `0.15s`. These restrained timings prevent motion from becoming a distraction; the focus is on clarity and responsiveness.

Button hover state animates background-color smoothly. Input focus-state border color transitions subtly to purple. No bounce, no scale exaggeration — motion reinforces interaction intention only.

## Effects

The modal card has a negligible drop shadow (very dark gray, low opacity — appropriate to dark mode) to lift it from the background. No blur, gradients, or atmospheric effects appear on the main card or inputs. The page background is flat, ensuring the form remains the focal point. The brand icon (logo) in the modal header is the only graphical flourish — a simple vector shape with purple and cyan layers.

## Guardrails

- **Maintain deep backgrounds (#0E1115, #15181E) at all times.** Never lighten to mid-gray; the dark mood is foundational. Avoid white or light surfaces as page backgrounds.
- **Reserve purple (#824DCB) for primary actions only** — one button per modal/section. Do not apply to secondary buttons, badges, or decorative elements.
- **Keep cyan (#25D366) restricted to secondary links and micro-interactions.** It is a sparring accent, not a primary color. Never fill buttons or large surfaces with it.
- **Typography hierarchy is Space Grotesk for headings / display, Inter for all else.** Do not reverse or swap these families. Do not introduce a third font family.
- **Input focus state must transition its border to purple, not expand or change radius.** Preserve the 6px radius; motion should be color-only, not geometric.