---
name: Urgent Clean Kamloops
description: Same-day and short-notice house cleaning in Kamloops — fast photo-based quotes, no in-person visit required for most jobs.
colors:
  signal: "#C94B0C"
  signal-dk: "#A63D0A"
  signal-lt: "#EA580C"
  ground: "#FFFFFF"
  surface-1: "#F6F8FA"
  surface-2: "#EEF1F5"
  text-1: "#111827"
  text-2: "#4B5563"
  text-3: "#9CA3AF"
  border-1: "#E5E7EB"
  border-2: "#D1D5DB"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(40px, 6vw, 78px)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif"
    fontSize: "clamp(28px, 3.5vw, 48px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  body:
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif"
    fontSize: "15px-17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em-0.12em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "14px"
spacing:
  gap-fluid: "clamp(24px, 5vw, 64px)"
  section-y: "clamp(64px, 8vw, 112px)"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.signal-lt}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-ghost:
    backgroundColor: "transparent"
    border: "1.5px solid {colors.signal}"
    textColor: "{colors.signal}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.ground}"
    border: "1.5px solid {colors.border-1}"
    rounded: "{rounded.lg}"
    padding: "22px-28px"
  tag:
    backgroundColor: "{colors.surface-1}"
    border: "1.5px solid {colors.border-1}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  input:
    backgroundColor: "{colors.ground}"
    border: "1.5px solid {colors.border-2}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
---

# Design System: Urgent Clean Kamloops

## Status

This document describes the site as it is actually built (last verified against
`index.html` 2026-08-17). An earlier version of this file specified a fully dark,
sharp-cornered, hairline-grid system that was never implemented — the live site has
always been light, warm, and rounded. If any tooling regenerates this file, **preserve
the direction below**; do not reintroduce the dark/sharp variant.

## Overview

Light, warm-neutral ground with a single ember/orange accent, rounded cards, and a
display grotesk (Bricolage Grotesque) carrying most of the personality through weight
and negative tracking rather than color. The system reads as approachable and local,
not corporate — closer to a well-run trades business than a SaaS product. It should
never drift toward a disaster-restoration or luxury-housekeeping register.

**Key characteristics:**
- Light throughout: white/off-white grounds (`--ground`, `--surface`, `--surface-2`);
  the only dark surfaces are the hero photo (under a dark gradient overlay), the
  ember-filled Process section, and the footer.
- One accent, used with intent: ember orange (`#C94B0C`) marks every primary action —
  call/text/submit buttons, active states, the logo's "Clean" wordmark. It does not
  fill large background areas outside the two exceptions above.
- Rounded, not sharp: 8px on buttons/inputs/nav elements, 14px on cards and the
  photo-quote/result panels. There is no 0px-radius anywhere in the live system.
- Soft depth via border + shadow-on-hover, not a tonal ramp: cards sit on `--ground`
  or `--surface` with a 1.5px `--border` line; hover lifts with `translateY(-2px)`
  to `-3px` and a soft `box-shadow`, not a background-color step.

## Colors

- **Ember** (`#C94B0C`) — primary accent. Buttons, active/focus states, links inside
  otherwise-neutral copy, the logo's "Clean" wordmark.
- **Ember Light** (`#EA580C`) — hover state for ember buttons only.
- **Ember Dark** (`#A63D0A`) — small accent text (e.g. the "fastest way to quote"
  label) needing more contrast than base ember on a tinted background.
- **Ember Tint** (`rgba(201,75,12,0.09)`) — active/selected pill backgrounds, the
  SMS-quote card fill.
- **Ground** (`#FFFFFF`) — page background, card fill, input fill.
- **Surface** (`#F6F8FA`) / **Surface 2** (`#EEF1F5`) — alternate section backgrounds,
  used to create zebra-striped rhythm between sections down the page.
- **Ink** (`#111827`) — primary text and headings.
- **Ink 2** (`#4B5563`) — body copy, secondary text.
- **Ink 3** (`#9CA3AF`) — muted labels, placeholders, disclaimers.
- **Border / Border 2** (`#E5E7EB` / `#D1D5DB`) — card and input borders.
- **Footer ink** — the footer and the Process section are the two places that go
  fully dark/ember; everywhere else stays light.

## Typography

**Font:** Bricolage Grotesque (Google Fonts, weights 400–800), falling back to
`system-ui, -apple-system, sans-serif`.

- **Display** (800, `clamp(40px,6vw,78px)`, line-height 0.96, −0.04em): hero H1 only.
- **Headline** (800, `clamp(28px,3.5vw,48px)`, line-height 1.05, −0.03em): section H2s.
- **Body** (400, 15–17px, line-height 1.6–1.65): descriptive copy.
- **Label** (700, 11px, +0.08–0.12em, uppercase): eyebrows, form labels, badge text.

## Layout

Max content width `1180px`. Fluid horizontal padding `clamp(24px,5vw,64px)`. Section
vertical rhythm `clamp(64px,8vw,112px)`. Grids: services/photo-quote steps go
`repeat(3-4, 1fr)` down to 2 then 1 column; two-column layouts (contact, property
managers, process) collapse to 1 column at 768px. Single column throughout below
640–768px depending on section.

## Components

- **Buttons** — 8px radius, 700–800 weight. Primary: ember fill, white text, lifts
  `translateY(-2px)` + soft shadow on hover. Secondary/outlined: transparent fill,
  1.5px border (e.g. the hero's "Request a Quote" button). Tertiary actions inside
  a cluster with a primary button use a plain underlined text link instead of a
  second button style (e.g. "Call to Confirm Price" + "Request Quote" under the
  calculator result, or "Request a Quote" + "Or call…" in the photo-quote section).
- **Cards** — white or surface fill, 1.5px border, 14px radius, hover lifts with
  border-color shift to ember + shadow. Used for services, photo-quote steps, and
  the calculator result panel.
- **Tags/chips** — surface fill, 1.5px border, 8px radius, hover shifts to ember
  border + ember-tint fill. Used for coverage areas and property-manager capabilities.
- **Nav** — sticky, white/blurred background, scroll-triggered shadow. Desktop shows
  inline links + a filled CTA button; below 860px collapses to a hamburger-triggered
  full-width drawer.
- **Mobile sticky action bar** — fixed to the viewport bottom below 640px, ember fill,
  two equal-width real links (Call Now / Request Quote), each independently focusable
  and screen-reader-reachable — nothing in this component is `aria-hidden`. Call is
  primary; the quote form is secondary. SMS/photo texting still works (phone number,
  nav drawer) but has no dedicated CTA of its own anymore.
- **Forms** — 8px radius inputs, ember focus ring, 16px font size on mobile inputs
  specifically to prevent iOS auto-zoom. Only Phone, Email, Service, and a short
  description are visible by default; everything else (name, location, bedrooms,
  timing, photo) lives inside a collapsed native `<details>` labeled "Optional
  details — helps us quote faster," styled to match the FAQ's rotating `+` marker.

## Do's and Don'ts

**Do:**
- Keep ember as the only accent color; everything else is neutral.
- Use rounded corners (8–14px) on every new interactive/container element.
- Reserve dark/ember-filled full-width sections for moments that need real emphasis
  (currently: Process, footer) — don't stack more than one or two per page.
- Keep claims hedged where they depend on scheduling or property condition
  ("scheduling permitting", "in most cases") rather than stated as guarantees.

**Don't:**
- Don't introduce a second accent hue.
- Don't add 0px-radius "sharp" components — that direction was written into this file
  once, never built, and shouldn't be revived without an explicit decision to redesign.
- Don't use "emergency cleaning" as a positioning term — it implies biohazard/flood/
  fire-restoration services this business doesn't offer. Prefer same-day, short-notice,
  last-minute, or "fast photo quotes."
- Don't fabricate reviews, ratings, or customer counts — none are on record yet.
