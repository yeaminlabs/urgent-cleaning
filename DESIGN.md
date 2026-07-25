---
name: Urgent Clean Kamloops
description: Emergency house cleaning for Kamloops landlords and homeowners — same day, no contracts.
colors:
  signal: "#E8421A"
  signal-dk: "#CC3300"
  signal-lt: "#F05530"
  slate-1: "#181C22"
  slate-2: "#1E2229"
  slate-3: "#242A32"
  slate-4: "#2C333C"
  slate-5: "#363E48"
  text-1: "#F2F4F6"
  text-2: "#9AA4B2"
  text-3: "#4E5866"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI Variable', 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "clamp(40px, 6vw, 82px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI Variable', 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "clamp(28px, 3.8vw, 50px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI Variable', 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "clamp(17px, 1.5vw, 20px)"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI Variable', 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
  mono:
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', 'Courier New', monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  gap-fluid: "clamp(24px, 5vw, 64px)"
  section-y: "clamp(64px, 8vw, 120px)"
components:
  button-primary:
    backgroundColor: "{colors.signal-dk}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "14px 28px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-secondary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.text-1}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  coverage-tag:
    backgroundColor: "{colors.slate-4}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  coverage-tag-hover:
    backgroundColor: "{colors.slate-4}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  nav-cta:
    backgroundColor: "{colors.signal-dk}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "8px 18px"
  input-default:
    backgroundColor: "{colors.slate-2}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  input-focus:
    backgroundColor: "{colors.slate-2}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
---

# Design System: Urgent Clean Kamloops

## Overview

**Creative North Star: "The Emergency Signal"**

The design system lives entirely in the dark. A five-step slate tonal ramp — #181C22 through #363E48 — is the complete spatial vocabulary: depth is the distance between slates, not the presence of shadows. Into that controlled dark drops a single signal-orange flame (#E8421A / #CC3300), used with the discipline of a warning light. It appears on CTAs, iconography, interactive states, and one deliberate manifesto section. Its rarity is its urgency. Everything it touches is acted on immediately.

Typography is system-sans at weight 800–900 with tight negative tracking (-0.03em to -0.04em) and sub-1.0 line heights on display text. The result feels like a dispatch board or flight-information terminal — information locked and ready to act on. Body copy runs at normal weight with generous line-height (1.65) for fast scanning in low-light context. Monospaced numerals (SF Mono / Fira Code) mark dispatch items and row indices — the only typographic accent that costs no color.

**Key Characteristics:**
- Exclusively dark: all surfaces use the slate ramp; no warm or light-mode sections exist
- One accent: signal orange appears sparingly; it is never decorative
- Sharp everywhere: border-radius is 0px system-wide; the only curve is the 8px eyebrow indicator dot
- Tonal depth: shadows are absent; depth is communicated through background-color steps alone
- Snappy transitions: 0.15s ease on hover; 0.55s ease on scroll reveals

## Colors

A cold operational dark with a single thermal accent.

### Primary
- **Signal Fire** (`#E8421A`): The visual alarm. Used for accent marks (eyebrow dot, logo "Clean" wordmark), icon fills, focus-state borders, and hover indicators. Never fills a whole background — the Manifesto section (signal-dk) is the one approved exception.
- **Scorched Signal** (`#CC3300`): Darker variant of the accent; the correct value for buttons and CTA elements to meet WCAG AA contrast against white text (#ffffff on #CC3300 = 5.0:1).
- **Signal Lift** (`#F05530`): Lighter warm variant for hover states on primary buttons and nav CTA. Only ever appears as a hover target, never at rest.

### Neutral
- **Void** (`#181C22`): Footer background. The deepest surface in the stack.
- **Operational Dark** (`#1E2229`): Primary page background — the body ground and hero canvas.
- **Station** (`#242A32`): Alternate section background (trust strip, services, contact). One step lighter than the body.
- **Field** (`#2C333C`): Card hover state, coverage tags. The elevated surface.
- **Border Iron** (`#363E48`): Input and component borders at rest. The highest visible step in the ramp.
- **Smoke** (`#F2F4F6`): Primary text. Near-white against all slate backgrounds.
- **Steel** (`#9AA4B2`): Secondary and body text. Sufficient contrast on all slate steps.
- **Fog** (`#4E5866`): Muted copy, form labels, dispatch indices. Supporting information only.

### Named Rules
**The One Flame Rule.** Signal orange is used on at most one prominent accent per visual cluster. Its rarity is the urgency. When it appears on every element, the alarm is silent.

**The Theme-Lock Rule.** Every section uses the slate tonal ramp. The Manifesto section — signal-dk background — is the one approved world-swap. No warm paper, no light-grey, no white sections may be inserted between dark sections.

## Typography

**Display Font:** system-ui (-apple-system, 'Segoe UI Variable', 'Segoe UI', Helvetica, Arial, sans-serif)
**Body Font:** Same stack
**Mono Font:** SF Mono, Fira Code, Consolas, Courier New — exclusively for sequential row identifiers

**Character:** All-system sans with extreme weight and negative tracking on headings. The pairing feels operational and precise — like a terminal readout or a departure board — with no editorial affect or custom display personality. Weight and tracking do the work that a distinctive font face would normally do in other systems.

### Hierarchy
- **Display** (900, `clamp(40px, 6vw, 82px)`, line-height 0.95, -0.04em): Hero headlines only. Sub-unit line height locks tight multi-line headings into a single visual mark.
- **Headline** (800, `clamp(28px, 3.8vw, 50px)`, line-height 1.05, -0.03em): Section H2 headings. Same tight tracking, fractionally more breathing room.
- **Body Large** (400, `clamp(17px, 1.5vw, 20px)`, line-height 1.65): Subheads and descriptive copy directly under section headings.
- **Body** (400–600, `13px–16px`, line-height 1.6): Card descriptions, nav links, trust strip text, form support notes.
- **Label** (700, `11px`, +0.12em, UPPERCASE): Section eyebrow marks, form field labels, contact block labels. The system's only wide-tracked all-caps pattern.
- **Mono** (400, `11px`, +0.08em): Dispatch item indices (01, 02...) and manifesto row numbers. Exclusively for sequential operational identifiers.

### Named Rules
**The Weight-Does-The-Work Rule.** Personality comes from font-weight (800–900) and negative tracking (-0.04em), not from a display typeface. Never introduce a third font family. The system is intentionally weight-and-tracking-driven.

## Layout

Max content width: 1180px (`--max`). Fluid horizontal padding: `clamp(24px, 5vw, 64px)` — compresses gracefully without a hard breakpoint jump. Section vertical rhythm: `clamp(64px, 8vw, 120px)` top and bottom — breathing room on desktop, dense but readable on mobile.

Grid patterns: hero (1fr 1fr, collapses to 1fr at 860px); dispatch and services (`repeat(auto-fit, minmax(260–300px, 1fr))`); manifesto and contact (1fr 1fr, collapse at 720px). All grids set `gap: 1px` and use the **hairline-grid technique**: the grid wrapper's background is set to `var(--rule)` (rgba 255,255,255,0.07), so the 1px gap between cells becomes a translucent hairline divider — no per-cell borders needed.

Mobile: single column throughout below 720–860px. Form rows collapse from 2-column to 1-column. The hamburger drawer uses slate-1 background (the deepest slate) for clear layering above page content.

## Elevation & Depth

Fully flat. No `box-shadow` anywhere in the system. Depth is communicated exclusively through the five-step slate tonal ramp: a card at slate-3 sitting on a slate-2 section background is elevated by one tonal step. Hover states shift the card background one further step (slate-3 → slate-4). The Manifesto section reverses entirely to signal-dk, which reads as a surface inversion — the most dramatic depth gesture in the system.

Dividers and borders use semi-transparent white overlays: `rgba(255,255,255,0.07)` (--rule) for hairlines and structural borders; `rgba(255,255,255,0.13)` (--rule-2) for emphasized outlines (coverage tag borders, hero image badge). Semi-transparency means they adapt to any slate background without hardcoded per-step values.

### Named Rules
**The Flat-By-Conviction Rule.** No box-shadow is used anywhere. New components requiring depth get a one-step tonal background shift. New components requiring a hover lift get translateY(-2px). Shadow is not the tool here.

## Shapes

Sharp everywhere. `border-radius: 0px` on all buttons, inputs, cards, tags, and containers. The system reads as angular and built for function — no rounded softening.

The single permitted curve: the 8×8px eyebrow indicator dot (border-radius: 50%) in the hero section. It acts as a location signal marker — a deliberate exception that makes the dot feel like a map pin, not a stylistic softening. This exception does not generalize.

### Named Rules
**The Sharp-Edged Rule.** All interactive and container elements are 0px radius. The only curve in the system is the 8px eyebrow dot. Add padding for comfort; never add radius for softness.

## Components

### Buttons

Sharp (0px), weight-led, fast transitions (0.15s ease).

- **Primary:** `#CC3300` background, white text (`#fff`), 14px 28px padding, 15px/700/+0.02em. Hover: background shifts to `#E8421A`, translateY(-2px). Active: scale(0.98).
- **Nav CTA:** Same primary treatment, compact padding (8px 18px), 13px font. This is the converted landing CTA in the sticky nav.
- **Secondary / Ghost:** Transparent background, 1px border at rgba(255,255,255,0.13), text-2 color. Hover: border lifts to solid text-2, text shifts to text-1, translateY(-2px). No background fill on hover.

### Chips

- **Coverage Tag:** slate-4 background (#2C333C), 1px border rgba(255,255,255,0.13), 8px 16px padding, 13px/600, text-2. Hover: border shifts to signal (#E8421A), text shifts to text-1. Background stays fixed.

### Cards / Containers

The hairline-grid technique is the system's canonical card container. Parent grid: `gap: 1px; background: rgba(255,255,255,0.07)`. Cards: no border, sharp corners, same background as their section. Hover: one tonal step up the slate ramp.

- **Dispatch Card:** slate-2 background, 32px 28px padding. Hover inherits section background (no explicit hover in dispatch).
- **Service Card:** slate-3 background, 36px 32px padding. Hover: slate-4.
- **Hero Image Badge:** slate-1 background (deepest), 1px border rgba(0.13), 12px 16px padding, positioned absolute inside the photo frame.

### Inputs / Fields

- **Default:** slate-2 background, 1px border at slate-5 (#363E48), 0px radius, 12px 14px padding, 14px/400 text. Placeholder: text-3. Matches the depth of the contact section (slate-3 background means the input sits one step below at slate-2).
- **Focus:** Border shifts to signal (#E8421A). No glow, no halo. The border shift is the only focus indicator.
- **Select:** Custom chevron SVG (text-2 color) as background-image; native appearance removed.

### Navigation

- **Default:** Transparent background, no bottom border. Logo: 15px/800/−0.02em, "Urgent" in text-1, "Clean" in signal. Links: 13px/600, text-2 → text-1 on hover.
- **Scrolled:** rgba(24,28,34,0.92) frosted dark background, backdrop-filter blur(12px), 1px bottom border at rule opacity. Activates after 80px scroll.
- **Mobile (≤720px):** Links and CTA hidden; hamburger (3-bar icon) toggles a full-width drawer in slate-1.

### Dispatch Log (Signature Component)

The repeating pattern for "list of situations" content: a hairline-grid auto-fit grid where each cell leads with a monospaced index (01, 02...) in text-3, a bold 16px/700 title in text-1, and 14px/400 body in text-2. This is the system's primary content pattern — used for use cases (why people call) and services alike. It communicates operational density without table structure.

## Do's and Don'ts

### Do:
- **Do** use signal orange on at most one prominent accent per visual cluster. Its job is to mark the single most important interactive element or accent mark.
- **Do** use the hairline-grid technique for any new card grids: `gap: 1px; background: rgba(255,255,255,0.07)` on the grid wrapper, no per-card borders.
- **Do** use monospace (SF Mono / Fira Code, 11px, +0.08em) for any sequential numbered identifier in the UI.
- **Do** express hover depth on cards by shifting background one tonal step up the slate ramp (e.g., slate-3 → slate-4).
- **Do** match each new section's background to its depth role: deepest = footer = slate-1; mid-page = slate-2/3; never lighter than slate-1.
- **Do** keep all body text at text-2 (#9AA4B2) and primary headings at text-1 (#F2F4F6) for consistent tonal hierarchy.

### Don't:
- **Don't** add border-radius to buttons, inputs, cards, or any container. Sharp corners are non-negotiable.
- **Don't** introduce a second accent color. Signal orange is the only non-neutral hue in the system.
- **Don't** create a light-background section. The Theme-Lock Rule applies. If a section needs emphasis, step to the Manifesto treatment (signal-dk) or shift one slate step — not warm paper.
- **Don't** use box-shadow for depth. One tonal step on the slate ramp is the correct mechanism.
- **Don't** increase tracking on display or headline text. The tight negative tracking (-0.03em to -0.04em) is load-bearing for the operational character.
- **Don't** use font-weight below 600 for any text that carries hierarchy — this is a weight-driven system.
- **Don't** fabricate social proof, ratings, or customer counts in copy. No evidence is on record yet; invented claims violate the product's credibility commitment.
