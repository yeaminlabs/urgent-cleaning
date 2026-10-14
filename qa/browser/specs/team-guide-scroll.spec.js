/* Team price guide — scrolling must stay the browser's job.
   ---------------------------------------------------------------------------
   The guide once centred the active section tab with
   scrollIntoView({block:"nearest",behavior:"smooth"}). That call scrolls every
   scrollable ancestor, the document included, and its animation fought a finger
   already mid-swipe on iOS: the page stuck, paused and drifted after the touch
   ended. These tests fail if anything in the guide ever moves the page
   vertically on its own again.

   The guide is private (HTTP Basic Auth in production). Locally it is served as
   a static file, so no credentials are involved here. It is deliberately NOT in
   the shared page inventory — it is not a public page — so this spec uses the
   plain Playwright fixture and installs its own analytics block. */
'use strict';
const { test, expect } = require('@playwright/test');
const { ANALYTICS_DOMAINS, hostMatches } = require('../helpers/analytics-guard');

const GUIDE = '/team-price-guide/';
const SECTIONS = ['#calc', '#flat', '#hourly', '#turnover', '#rush', '#addons'];
const WIDTHS = [360, 390, 430, 768];
// 1x1 PNG: the guide references the live logo URL, answered locally so no test
// traffic leaves the machine.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openGuide(page, context) {
  const external = [];
  await context.route(u => hostMatches(u.hostname, ANALYTICS_DOMAINS), r => {
    external.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  await context.route(u => u.hostname.endsWith('urgentcleankamloops.ca'), r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  // Record anything the page does to the document scroll position by itself.
  await page.addInitScript(() => {
    window.__programmatic = [];
    const iv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) {
      window.__programmatic.push('scrollIntoView ' + JSON.stringify(a[0] || null));
      return iv.apply(this, a);
    };
  });
  await page.goto(GUIDE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { external };
}

const scrollY = page => page.evaluate(() => Math.round(window.scrollY));

/* Waits until the document scroll stops changing, then returns where it came to
   rest. Fails if it never settles — an animation that never ends is exactly the
   bug this file guards against. */
async function settleScroll(page, timeout = 4000) {
  const deadline = Date.now() + timeout;
  let last = await scrollY(page), stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(120);
    const now = await scrollY(page);
    stable = now === last ? stable + 1 : 0;
    last = now;
    if (stable >= 3) return now;                           // ~360ms with no movement
  }
  throw new Error(`the page never stopped scrolling (last position ${last})`);
}
const activeTab = page => page.evaluate(() => { const a = document.querySelector('#secnav a.on'); return a ? a.getAttribute('href') : null; });

for (const width of WIDTHS) {
  test(`@${width}px: vertical scrolling is never taken over by the page`, async ({ page, context }) => {
    await context.addInitScript(() => {});
    const { external } = await openGuide(page, context);
    await page.setViewportSize({ width, height: 780 });

    // ── down, in steps: must increase every time and settle where it lands ──
    const seen = [];
    let previous = await scrollY(page);
    for (let i = 0; i < 24; i++) {
      await page.mouse.wheel(0, 340);
      // Let the input finish being applied (a wheel event can be delivered a
      // frame or two late), then require the page to be completely still.
      const settled = await settleScroll(page);
      expect(settled, `@${width}px step ${i}: scroll went backwards (${previous} -> ${settled})`).toBeGreaterThanOrEqual(previous);
      await page.waitForTimeout(250);
      expect(await scrollY(page), `@${width}px step ${i}: the page moved on its own after the gesture settled`).toBe(settled);
      previous = settled;
      const tab = await activeTab(page);
      if (tab && seen[seen.length - 1] !== tab) seen.push(tab);
    }

    // Every section was crossed, in order, with no flip-flopping.
    expect(seen, `@${width}px active-tab order`).toEqual(seen.slice().sort((a, b) => SECTIONS.indexOf(a) - SECTIONS.indexOf(b)));
    expect(seen.length, `@${width}px: tabs seen ${seen.join(' ')}`).toBeGreaterThanOrEqual(4);
    expect(new Set(seen).size, `@${width}px: a tab was activated twice (oscillation): ${seen.join(' ')}`).toBe(seen.length);
    expect(await activeTab(page), `@${width}px: the last section is active at the bottom`).toBe('#addons');

    // ── back up: must decrease every time ──────────────────────────────────
    previous = await scrollY(page);
    for (let i = 0; i < 24; i++) {
      await page.mouse.wheel(0, -340);
      const settled = await settleScroll(page);
      expect(settled, `@${width}px up-step ${i}: scroll went forwards (${previous} -> ${settled})`).toBeLessThanOrEqual(previous);
      await page.waitForTimeout(250);
      expect(await scrollY(page), `@${width}px up-step ${i}: the page moved on its own after the gesture settled`).toBe(settled);
      previous = settled;
    }
    expect(previous, `@${width}px: scrolling up returns to the top`).toBe(0);

    // Nothing in the page ever called scrollIntoView, and no analytics escaped.
    expect(await page.evaluate(() => window.__programmatic), 'the guide must not scroll elements into view').toEqual([]);
    expect(external, 'analytics requests from the guide').toEqual([]);
  });

  test(`@${width}px: section links land below the sticky header and stay put`, async ({ page, context }) => {
    await openGuide(page, context);
    await page.setViewportSize({ width, height: 780 });

    for (const href of SECTIONS) {
      await page.click(`#secnav a[href="${href}"]`);
      // The anchor jump is a smooth animation (user-initiated, so it is fine);
      // wait for it to come to rest rather than guessing a duration.
      const settled = await settleScroll(page);
      const box = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        const bar = document.querySelector('.secnav').getBoundingClientRect();
        return { top: Math.round(el.getBoundingClientRect().top), stickyBottom: Math.round(bar.bottom) };
      }, href);
      // The heading must be visible, not tucked under the sticky topbar + nav.
      expect(box.top, `${href} @${width}px is hidden under the sticky header`).toBeGreaterThanOrEqual(box.stickyBottom - 2);
      expect(box.top, `${href} @${width}px landed too far down the page`).toBeLessThan(400);
      // And the page must not keep moving afterwards.
      await page.waitForTimeout(400);
      expect(await scrollY(page), `${href} @${width}px kept moving after the jump`).toBe(settled);
    }
    expect(await page.evaluate(() => window.__programmatic), 'nav clicks must not use scrollIntoView').toEqual([]);
  });
}
