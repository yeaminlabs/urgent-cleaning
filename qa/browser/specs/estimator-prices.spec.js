/* The canonical price table, driven through the real calculator at every
   supported width.

   The expected figures here are written out literally, NOT derived from
   assets/js/pricing.js. forms-estimator.spec.js already proves the panel agrees
   with the engine; this file proves the engine agrees with the approved price
   list, end to end in a browser. If a price changes on purpose, these numbers
   are updated deliberately — the same contract as qa/pricing-consistency.js. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { WIDTHS, watchPage } = require('../helpers/site');

/* [service, size, expected total with no add-ons and a normal booking] */
const BASE_CASES = [
  ['standard', 'studio', '$125'],
  ['standard', '1bed',   '$150'],
  ['standard', '2bed',   '$175'],
  ['deep',     'studio', '$175'],
  ['deep',     '2bed',   '$260'],
  ['moveout',  'studio', '$195'],
  ['moveout',  '2bed',   '$295'],
  ['turnover', 't-studio', '$110'],
  ['turnover', 't-2bed',   '$145'],
  ['turnover', 't-4bed',   '$225'],
  ['turnover', 't-5plus',  'Custom quote'],
];

/* Rush fee = max(percentage of the priced subtotal, tier minimum).
   Two subtotals, reached with real selections:
     $200 = standard / 3 bed
     $500 = deep / 4 bed ($450) + 5 interior windows ($50)
   [tier, fee at $200, total at $200, fee at $500, total at $500] */
const RUSH_CASES = [
  ['rush-24h',  '$50',  '$250', '$75',  '$575'],   // 15%: 30 -> minimum 50 | 75
  ['rush-6h',   '$60',  '$260', '$100', '$600'],   // 20%: 40 -> minimum 60 | 100
  ['rush-3h',   '$70',  '$270', '$150', '$650'],   // 30%: 60 -> minimum 70 | 150
  ['overnight', '$70',  '$270', '$175', '$675'],   // 35%: 70 = minimum 70 | 175
];

const ADDON_IDS = ['oven', 'fridge', 'cabinets', 'laundry', 'laundry-extra', 'linen', 'windows', 'patio', 'pet-hair', 'grease', 'walls'];

function driver(page) {
  const d = {
    pick: (group, val) => page.click(`#qc-${group} .qc-opt[data-val="${val}"]`),
    async setAddon(id, qty) {
      let row = page.locator(`.qc-addon[data-id="${id}"]`);
      if (!(await row.count())) { await page.click('#qc-more'); row = page.locator(`.qc-addon[data-id="${id}"]`); }
      const toggle = row.locator('[data-step="toggle"]');
      if (await toggle.count()) {
        if (((await toggle.getAttribute('aria-pressed')) === 'true') !== qty > 0) await toggle.click();
        return;
      }
      const val = row.locator('.qc-qty-val');
      for (let g = 0; Number(await val.textContent()) !== qty; g++) {
        expect(g, `quantity ${qty} for ${id}`).toBeLessThan(20);
        await row.locator(`[data-step="${Number(await val.textContent()) < qty ? 1 : -1}"]`).click();
      }
    },
    clearAddons: async () => { for (const id of ADDON_IDS) await d.setAddon(id, 0); },
  };
  return d;
}

for (const width of WIDTHS) {
  test(`@${width}px: the calculator shows the approved price for every tier`, async ({ page }) => {
    const w = watchPage(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const d = driver(page);
    const price = page.locator('#qc-price');

    for (const [service, size, want] of BASE_CASES) {
      await d.pick('service', service);
      await d.pick('size', size);
      await expect(price, `${service}/${size} @${width}px`).toHaveText(want);
    }

    // 5+ bedrooms is an open-ended starting price, shown as such.
    await d.pick('service', 'standard');
    await d.pick('size', '5plus');
    await expect(price, `standard/5plus @${width}px`).toHaveText('$350+');

    // Add-ons stack onto the base price.
    await d.pick('size', '2bed');
    await expect(price).toHaveText('$175');
    await d.setAddon('oven', 1);
    await expect(price, `2 bed + oven @${width}px`).toHaveText('$195');
    await d.setAddon('fridge', 1);
    await expect(price, `2 bed + oven + fridge @${width}px`).toHaveText('$215');
    await d.clearAddons();
    await expect(price).toHaveText('$175');

    // Rush tiers, on a $200 and a $500 priced subtotal.
    const rushRow = page.locator('#qc-breakdown .qc-bd-row', { hasText: 'rush' });
    await d.pick('size', '3bed');                       // standard 3 bed = $200
    await expect(price).toHaveText('$200');
    for (const [tier, fee, total] of RUSH_CASES) {
      await d.pick('timing', tier);
      await expect(rushRow, `${tier} fee on $200 @${width}px`).toContainText(fee);
      await expect(price, `${tier} total on $200 @${width}px`).toHaveText(total);
    }
    await d.pick('timing', 'normal');
    await d.pick('service', 'deep');
    await d.pick('size', '4bed');                       // deep 4 bed = $450
    await d.setAddon('windows', 5);                     // + 5 x $10 = $500
    await expect(price).toHaveText('$500');
    for (const [tier, , , fee, total] of RUSH_CASES) {
      await d.pick('timing', tier);
      await expect(rushRow, `${tier} fee on $500 @${width}px`).toContainText(fee);
      await expect(price, `${tier} total on $500 @${width}px`).toHaveText(total);
    }

    // A custom-priced add-on is never surcharged and never guessed at.
    await d.pick('timing', 'rush-3h');
    const before = await price.textContent();
    await d.setAddon('grease', 1);
    await expect(page.locator('#qc-breakdown')).toContainText('Heavy grease');
    await expect(price, `a quote-only add-on must not change the total @${width}px`).toHaveText(before);

    expect(w.consoleErrors).toEqual([]);
  });

  test(`@${width}px: the calculator fits, and its controls are usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('#qc-service .qc-opt[data-val="standard"]');
    await page.click('#qc-size .qc-opt[data-val="2bed"]');
    await page.click('#qc-more');                                  // show every add-on row

    const r = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const small = [];
      for (const el of document.querySelectorAll('#quote .qc-opt, #quote .qc-qty-btn, #quote .qc-toggle, #quote #qc-more, #quote .qc-cta')) {
        const b = el.getBoundingClientRect();
        if (b.height < 44) small.push(`${el.className || el.id} ${Math.round(b.height)}px`);
      }
      const wide = [];
      for (const el of document.querySelectorAll('#quote *')) {
        const b = el.getBoundingClientRect();
        if (b.right > docW + 0.5 && b.width > 0) wide.push(String(el.className || el.tagName));
      }
      const panel = document.getElementById('qc-price');
      return {
        pageOverflow: document.documentElement.scrollWidth - docW,
        tooSmall: small,
        wide,
        priceSize: parseFloat(getComputedStyle(panel).fontSize),
        priceText: panel.textContent,
      };
    });

    expect(r.pageOverflow, `@${width}px horizontal overflow`).toBeLessThanOrEqual(0);
    expect(r.wide, `@${width}px elements wider than the viewport`).toEqual([]);
    expect(r.tooSmall, `@${width}px tap targets under 44px`).toEqual([]);
    expect(r.priceSize, `@${width}px the total must stay readable`).toBeGreaterThanOrEqual(24);
    expect(r.priceText).toBe('$175');
  });
}
