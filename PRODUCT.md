# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Landlords and property managers in Kamloops, BC. They need a unit cleaned fast — between tenants, before an inspection, after a renovation — and cannot afford to wait days for a booking. Time pressure is the defining condition of every job.

**Secondary:** Homeowners with an acute, unplanned need (guests arriving tonight, post-reno dust, a showing tomorrow). Same urgency profile, lower frequency.

## Product Purpose

Urgent Clean Kamloops is a same-day and short-notice house cleaning service for situations where the normal multi-day booking window doesn't exist: a tenant just vacated, a renovation just wrapped, a showing got booked with little warning. Success means the landlord or homeowner gets a confirmed cleaner within the hour and a spotless result before their deadline.

## Positioning

Fast quotes, short notice, no wasted time. The business is built around two things most Kamloops cleaners don't offer together: same-day/next-day availability, and a quoting process that skips the in-person visit — call or send a quick request with the basics, get an estimate back, book a time. A photo can help but is never required to get quoted. Avoid "emergency cleaning" framing (it implies biohazard/flood/fire-restoration services this business doesn't provide) and avoid exclusivity claims ("the only company that...") unless independently verifiable.

## Operating Context

- Customers are often calling with little notice: a tenant just vacated, a realtor just called, a renovation just finished
- Speed of confirmation matters as much as speed of arrival — a callback within the hour reduces anxiety
- Landlords evaluate on: turnaround time, unit condition passing inspection, and whether the team showed up as promised
- Conversion hierarchy is **Call → Quote form**, in that order. Call is the fastest, most prominent path everywhere (hero, mobile sticky bar, nav). The quote form is the secondary path for visitors who'd rather not call. Texting the business number still works but has no dedicated CTA of its own — it's a quiet fallback, not a featured channel

## Capabilities and Constraints

Services offered (also the exact option list in the quote form's Service field): House Cleaning, Same-Day / Short-Notice Cleaning, Move-Out Cleaning, Move-In Cleaning, Deep Cleaning, Rental Turnover Cleaning, Post-Renovation Cleaning, Recurring Cleaning. The homepage features six of these as cards (House Cleaning, Move-Out, Same-Day/Short-Notice, Deep Cleaning, Rental Turnover, Post-Renovation) — Move-In and Recurring stay available in the form and are candidates for their own dedicated pages later.

Coverage: Downtown Kamloops, Sahali, Brocklehurst, Aberdeen, Westsyde, Valleyview, Juniper Ridge, Pineview, Rayleigh, Sun Rivers, Dallas, Barnhartvale — and additional areas by call.

How the site actually works:
- Static homepage (`index.html`), no build tool, no CMS, no framework
- The quote form **has a real backend**: it POSTs JSON to `/api/quote`, a Vercel serverless function (`api/quote.js`, zero npm dependencies) that validates and sanitizes every field server-side and emails the request to `urgentcleankamloops@gmail.com` via the **Resend** API. Requires a `RESEND_API_KEY` environment variable in Vercel — no secrets are ever in the repo. On success the visitor sees an inline "request received" panel in place of the form; on failure the form stays filled in and shows a Call fallback. Nothing is faked either direction
- Required fields: phone, email, service, a short description of what needs cleaning. Optional fields (name, location/neighbourhood, bedrooms, timing, a photo) live inside a collapsed `<details>` labeled "Optional details — helps us quote faster," so the form reads as short by default
- Photo upload is real, not preview-only: one photo, JPG/PNG/WebP/HEIC/HEIF, capped at 3MB (client- and server-validated), sent as an actual email attachment via Resend. It's explicitly optional and framed as "may help us confirm pricing" — never presented as required
- Service cards and the price calculator both hand off to the form: clicking a service card preselects that service in the form (with a small "✓ [service] selected" confirmation) and scrolls down; the calculator's "Request Quote" link additionally preselects bedrooms and passes the calculator's selections (beds/baths/service/extras/estimated range) into a hidden, sanitized, length-capped field so the customer doesn't have to retype what they already told the estimator
- The price calculator's base rates, per-bathroom add-on, condition multipliers, and low/high range math are approved and fixed — do not change them without an explicit request. The calculator's breakdown line-items must always sum to the displayed total; if a future edit changes the pricing model, re-derive the breakdown from `subtotal`/`raw` rather than hand-adjusting individual rows (that's exactly how the 2026-08-17 breakdown bug happened). The estimate is always a range, never presented as a final price — the actual amount is confirmed through a call or the quote request, not by the calculator alone
- Live phone: (250) 879-2425. Live email: urgentcleankamloops@gmail.com
- The business is presented as **available 24/7** (matches the logo's "Professional Cleaning Services 24/7" line) — `openingHours` is `Mo-Su 00:00-23:59` in the LocalBusiness schema. Don't reintroduce daytime-only hours language (e.g. "7am–9pm", "7 days a week") anywhere on the site
- Business is active and taking bookings; locally operating in Kamloops since 2025, though not originally under this professional branding — don't imply a longer track record than that

## Brand Commitments

Name: Urgent Clean Kamloops. The name signals the core promise — urgency — and the geography. Preserve both.

Voice: Direct, operational, no-hedging. Speaks like the job description, not a brochure. Tells the customer exactly what happens and when, without softening language or aspirational filler.

## Evidence on Hand

No testimonials, press, or case studies on record yet. Do not fabricate social proof, customer counts, or ratings. Real evidence should be collected and added before the site claims it.

## Product Principles

1. **Urgency is the product.** Every surface decision — copy, hierarchy, CTA placement — should answer the question "can I get someone here today?" before anything else.
2. **Credibility over decoration.** The customer is calling in a stressful moment. Clarity and confidence matter more than visual novelty. Design earns trust, not attention.
3. **No invented proof.** The business is real and active. Claims must be true: no fabricated reviews, no inflated stats, no generic "trusted by thousands" filler.
4. **Confirm fast, complete clean.** The two things a landlord cares about are a fast response and a unit that's inspection-ready. Standardize response-time language site-wide to "usually respond within an hour" — not hedged into meaninglessness, but not phrased as an unconditional guarantee either. The business now presents as available 24/7, so don't qualify this with "during business hours."
5. **Call first, quote form second.** The highest-urgency customers call. The site's primary job is to make picking up the phone feel like the obvious and safe next step — the quote form is a genuinely easy secondary path for everyone else, not a consolation prize. Photos are an optional detail on that form, never a required step.
