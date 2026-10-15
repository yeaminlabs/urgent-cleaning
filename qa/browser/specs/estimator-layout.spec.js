/* Reading order of the public estimator.
   ----------------------------------------------------------------------------
   A visitor should finish choosing before meeting the total:

     Service -> Home size -> Add-ons -> Timing -> Estimated total -> CTA

   The DOM is already in that order, so these specs assert the GEOMETRY agrees
   with it at every width. A CSS `order`, a float, or an absolutely positioned
   summary that lifted the result card above the controls would fail here —
   that is exactly the regression this file exists for (the result card used to
   carry `order: -1` below 640px, left over from an earlier design).

   Nothing here touches pricing; the figures are covered by
   specs/estimator-prices.spec.js and qa/pricing-consistency.js. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, watchPage } = require('../helpers/site');

/* The phone widths that matter, including the narrow 320 edge and the common
   iPhone/Android logical widths. 640px is the estimator's mobile breakpoint. */
const MOBILE = [320, 360, 375, 390, 393, 414, 430];
const TABLET_AND_DESKTOP = [768, 1024, 1440];

/* The four control groups, in the order a visitor should meet them. */
const STEPS = [
  ['Service', '#qc-service'],
  ['Home size', '#qc-size'],
  ['Add-ons', '#qc-addons'],
  ['Timing', '#qc-timing'],
];

/* `.reveal` holds its children at translateY(20px) until the IntersectionObserver
   adds `.in`, so geometry has to be read after the estimator has revealed.
   Each step is scrolled past in turn to trigger its observer — at 320px the
   stacked steps are taller than the viewport, so simply scrolling to the top
   of the section would leave the lower ones unrevealed and 20px out of place. */
async function settle(page) {
  for (const s of ['#qc-service', '#qc-size', '#qc-addons', '#qc-timing', '#qc-result']) {
    await page.locator(s).scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.qc-layout .reveal')].every(el => el.classList.contains('in')));
  await page.waitForTimeout(550);               // the 0.5s transform transition
}

/* Document-relative boxes, so a scroll between measurements cannot skew them. */
const boxes = (page, sel) => page.evaluate(sel => {
  const out = {};
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) { out[s] = null; continue; }
    const r = el.getBoundingClientRect();
    out[s] = { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX, right: r.right + scrollX };
  }
  return out;
}, sel);

const overlaps = (a, b) =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

for (const p of PAGES.filter(p => p.estimator)) {
  test(`${p.name}: on a phone the total comes after every option`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(p.path, { waitUntil: 'networkidle' });

    for (const width of MOBILE) {
      await page.setViewportSize({ width, height: 900 });
      // A selection is made so the result card is populated and at full height.
      await page.click('#qc-service .qc-opt[data-val="standard"]');
      await page.click('#qc-size .qc-opt[data-val="2bed"]');
      await settle(page);

      const sel = [...STEPS.map(s => s[1]), '#qc-result', '#qc-price', '#qc-breakdown', '#qc-request-quote', '.qc-form'];
      const b = await boxes(page, sel);
      const at = `${p.path} @${width}px`;

      // 1. the four steps are in order, each strictly below the last
      for (let i = 1; i < STEPS.length; i++) {
        expect(b[STEPS[i][1]].top, `${at}: ${STEPS[i][0]} must come after ${STEPS[i - 1][0]}`)
          .toBeGreaterThan(b[STEPS[i - 1][1]].top);
      }
      // 2. the result follows all four of them
      for (const [label, s] of STEPS) {
        expect(b['#qc-result'].top, `${at}: the total must come after ${label}`).toBeGreaterThan(b[s].top);
        expect(b['#qc-result'].top, `${at}: the total must start below the ${label} controls`)
          .toBeGreaterThanOrEqual(b[s].bottom - 0.5);
      }
      // 3. and never covers a control
      for (const [label, s] of STEPS) {
        expect(overlaps(b['#qc-result'], b[s]), `${at}: the total overlaps the ${label} controls`).toBe(false);
      }
      // 4. inside the result: total, then breakdown, then the CTA
      expect(b['#qc-breakdown'].top, `${at}: breakdown after the total`).toBeGreaterThan(b['#qc-price'].top);
      expect(b['#qc-request-quote'].top, `${at}: CTA after the breakdown`).toBeGreaterThan(b['#qc-breakdown'].top);
      expect(b['#qc-request-quote'].top, `${at}: the CTA must never sit above the selections`)
        .toBeGreaterThan(b['.qc-form'].top);
      // 5. single column on a phone, and nothing in it is wider than the screen
      const layout = await page.evaluate(() => {
        const docW = document.documentElement.clientWidth;
        const wide = [];
        for (const el of document.querySelectorAll('.qc-layout, .qc-layout *')) {
          const r = el.getBoundingClientRect();
          if (r.right > docW + 0.5 && r.width > 0) wide.push(String(el.className || el.id || el.tagName));
        }
        return {
          cols: getComputedStyle(document.querySelector('.qc-layout')).gridTemplateColumns.split(' ').length,
          order: getComputedStyle(document.getElementById('qc-result')).order,
          position: getComputedStyle(document.getElementById('qc-result')).position,
          wide,
          pageOverflow: document.documentElement.scrollWidth - docW,
        };
      });
      expect(layout.cols, `${at}: the estimator should be a single column on a phone`).toBe(1);
      expect(layout.order, `${at}: the result must not be reordered away from the DOM`).toBe('0');
      expect(['static', 'relative'], `${at}: the result must not be sticky or fixed on a phone`).toContain(layout.position);
      expect(layout.wide, `${at}: estimator element(s) wider than the screen`).toEqual([]);
      /* Page-level overflow is asserted from 360px up. At 320px the nav bar
         (logo + phone CTA + hamburger) overflows by 22px; that predates this
         spec, lives outside the estimator, and is covered separately by
         specs/navigation.spec.js from 360px. Asserting it here would fail for
         a reason this file has no say over. */
      if (width >= 360) expect(layout.pageOverflow, `${at}: horizontal page overflow`).toBeLessThanOrEqual(0);
    }
    expect(w.consoleErrors).toEqual([]);
  });

  test(`${p.name}: the result never overlaps the controls on tablet or desktop`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(p.path, { waitUntil: 'networkidle' });

    for (const width of TABLET_AND_DESKTOP) {
      await page.setViewportSize({ width, height: 900 });
      await page.click('#qc-service .qc-opt[data-val="deep"]');
      await page.click('#qc-size .qc-opt[data-val="3bed"]');
      await settle(page);

      const sel = [...STEPS.map(s => s[1]), '#qc-result', '.qc-form'];
      const b = await boxes(page, sel);
      const at = `${p.path} @${width}px`;

      for (const [label, s] of STEPS) {
        expect(overlaps(b['#qc-result'], b[s]), `${at}: the result overlaps the ${label} controls`).toBe(false);
      }
      expect(overlaps(b['#qc-result'], b['.qc-form']), `${at}: the result overlaps the controls column`).toBe(false);

      /* Side-by-side above the breakpoint, stacked at or below it. Either is
         fine; what must hold is that a stacked result sits after the controls. */
      const sideBySide = b['#qc-result'].left >= b['.qc-form'].right - 0.5;
      if (!sideBySide) {
        expect(b['#qc-result'].top, `${at}: a stacked result must follow the controls`)
          .toBeGreaterThanOrEqual(b['.qc-form'].bottom - 0.5);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${at}: horizontal overflow`).toBeLessThanOrEqual(0);
    }
    expect(w.consoleErrors).toEqual([]);
  });
}

/* The result sits below the options now, so it has to keep updating by itself:
   no Calculate button may appear, and no reload may be needed. */
test('the total still updates live, with no Calculate step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('#qc-price')).toHaveText('—');
  await page.click('#qc-service .qc-opt[data-val="standard"]');
  await page.click('#qc-size .qc-opt[data-val="2bed"]');
  await expect(page.locator('#qc-price'), 'the total should appear with no further action').toHaveText('$175');
  await page.click('#qc-timing .qc-opt[data-val="rush-24h"]');
  await expect(page.locator('#qc-price'), 'a timing change should re-price immediately').toHaveText('$225');

  const buttons = await page.$$eval('#quote button', els => els.map(b => (b.textContent || '').trim().toLowerCase()));
  for (const label of buttons) {
    expect(label, 'the estimator must not grow a Calculate/submit step').not.toMatch(/calculate|get (my )?(price|total)|show (my )?(price|total)/);
  }
});

/* Custom-quote and open-ended states change the result's height and content,
   so confirm they land below the options too rather than above them. */
for (const [label, service, size, addons] of [
  ['Airbnb 5+ (custom quote)', 'turnover', 't-5plus', {}],
  ['heavy grease (custom add-on)', 'standard', '2bed', { grease: 1 }],
  ['wall washing (custom add-on)', 'standard', '2bed', { walls: 1 }],
  ['Standard 5+ (starting-at price)', 'standard', '5plus', {}],
]) {
  test(`${label}: the message appears in the result, below the options`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click(`#qc-service .qc-opt[data-val="${service}"]`);
    await page.click(`#qc-size .qc-opt[data-val="${size}"]`);
    for (const id of Object.keys(addons)) {
      let row = page.locator(`.qc-addon[data-id="${id}"]`);
      if (!(await row.count())) { await page.click('#qc-more'); row = page.locator(`.qc-addon[data-id="${id}"]`); }
      await row.locator('[data-step="toggle"]').click();
    }
    await settle(page);

    const b = await boxes(page, ['#qc-timing', '#qc-result', '#qc-price']);
    expect(b['#qc-result'].top, `${label}: must follow the Timing step`).toBeGreaterThanOrEqual(b['#qc-timing'].bottom - 0.5);

    const shown = (await page.textContent('#qc-price')).trim();
    const breakdown = await page.textContent('#qc-breakdown');
    if (service === 'turnover') {
      expect(shown).toBe('Custom quote');
      expect(breakdown).toContain('Custom quote');
    } else if (size === '5plus') {
      expect(shown).toBe('$350+');
    } else {
      expect(breakdown, 'a custom add-on must say so in the result').toContain('Custom quote');
    }
  });
}
