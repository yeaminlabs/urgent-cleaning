/* Quote forms and estimators. Expected prices come from assets/js/pricing.js,
   so these specs check that each page SHOWS what the engine computes; the
   approved values themselves are pinned by qa/pricing-consistency.js.
   /api/quote is always mocked. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, Pricing, EXTRA_KEYS, FORM_PAYLOAD_KEYS, rangeText, watchPage } = require('../helpers/site');

const SERVICE_FOR_TYPE = { standard: 'House Cleaning', moveout: 'Move-Out Cleaning', deep: 'Deep Cleaning', postreno: 'Post-Renovation Cleaning' };

test.describe('Quote forms', () => {
  for (const p of PAGES.filter(p => p.form)) {
    test(`${p.name}: form renders, validates, and submits the unchanged payload`, async ({ page }) => {
      const w = watchPage(page);
      const posts = [];
      await page.route('**/api/quote', r => { posts.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
      await page.goto(p.path, { waitUntil: 'networkidle' });

      const form = page.locator('#quote-form');
      await expect(form).toBeVisible();
      for (const id of ['#fphone', '#femail', '#fservice', '#fdesc']) await expect(page.locator(id)).toHaveAttribute('required', '');
      // Honeypot: moved off-screen (not display:none, which some bots skip),
      // out of the tab order, and hidden from assistive technology.
      const hp = await page.locator('#fcompany').evaluate(el => {
        const r = el.getBoundingClientRect();
        return { offscreen: r.right <= 0, tabindex: el.getAttribute('tabindex'), ariaHidden: el.closest('.hp-field')?.getAttribute('aria-hidden') };
      });
      expect(hp).toEqual({ offscreen: true, tabindex: '-1', ariaHidden: 'true' });
      const btn = page.locator('#form-submit-btn');
      expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44);

      // Empty submit is stopped by native validation — nothing is sent.
      await btn.click();
      await page.waitForTimeout(300);
      expect(posts).toHaveLength(0);

      await page.fill('#fphone', '2505550000');
      await page.fill('#femail', 'qa@example.com');
      if (!(await page.locator('#fservice').inputValue())) await page.selectOption('#fservice', 'House Cleaning');
      await page.fill('#fdesc', 'QA submission');
      await btn.click();
      await expect(page.locator('#form-success')).toBeVisible();
      await expect(form).toBeHidden();
      expect(posts).toHaveLength(1);
      expect(Object.keys(posts[0]).sort()).toEqual([...FORM_PAYLOAD_KEYS].sort());
      expect(posts[0].company).toBe('');
      expect(w.consoleErrors).toEqual([]);
    });
  }
});

test.describe('Estimators', () => {
  for (const p of PAGES.filter(p => p.estimator)) {
    test(`${p.name}: shows exactly what pricing.js computes`, async ({ page }) => {
      const w = watchPage(page);
      await page.goto(p.path, { waitUntil: 'networkidle' });

      await expect(page.locator('#qc-price')).toHaveText('—');
      const active = page.locator('#qc-condition .qc-opt.active');
      if (p.preselect) await expect(active).toHaveAttribute('data-val', p.preselect);
      else await expect(active).toHaveCount(0);

      // Every rendered "from $X" starting price equals startingFrom() for its
      // clean type, is visible, and the page's own service is among them.
      const starting = await page.$$eval('[data-starting-from]', els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { type: el.dataset.startingFrom, text: el.textContent, visible: r.width > 0 && r.height > 0 };
      }));
      expect(starting.length, 'starting prices on the page').toBeGreaterThan(0);
      for (const s of starting) expect(s, `starting price for ${s.type}`).toEqual({ type: s.type, text: '$' + Pricing.startingFrom(s.type), visible: true });
      if (p.preselect) expect(starting.map(s => s.type)).toContain(p.preselect);

      // Visible extras labels are generated from EXTRAS.
      const labels = await page.$$eval('#qc-extras .qc-toggle', els => els.map(b => [b.dataset.val, b.querySelector('.qc-toggle-price').textContent, b.hasAttribute('data-price')]));
      expect(labels).toEqual(EXTRA_KEYS.map(k => [k, '+$' + Pricing.EXTRAS[k], false]));

      const pick = async (group, val) => page.click(`#${group} .qc-opt[data-val="${val}"]`);
      const setExtras = async keys => {
        for (const k of EXTRA_KEYS) {
          const b = page.locator(`#qc-extras [data-val="${k}"]`);
          if ((await b.getAttribute('class')).includes('active') !== keys.includes(k)) await b.click();
        }
      };
      const cases = [
        [1, 1, 'standard', []],
        [2, 1, 'moveout', []],
        [3, 2, 'deep', ['fridge', 'laundry']],
        [4, 3, 'postreno', ['cabinets']],
        [5, 4, 'standard', EXTRA_KEYS],   // 5+ bedrooms, 4+ bathrooms, every extra
      ];
      for (const [beds, baths, type, extras] of cases) {
        await pick('qc-beds', beds); await pick('qc-baths', baths); await pick('qc-condition', type); await setExtras(extras);
        const e = Pricing.estimate(beds, baths, type, extras);
        await expect(page.locator('#qc-price'), `${beds}bd/${baths}ba/${type}/[${extras}]`).toHaveText(rangeText(e));
        await expect(page.locator('#qcb-total')).toHaveText(rangeText(e));
        await expect(page.locator('#qcb-base-val')).toHaveText('$' + e.base);
      }

      // Estimator -> form handoff
      await pick('qc-beds', 3); await pick('qc-baths', 2); await pick('qc-condition', 'deep'); await setExtras(['fridge']);
      const e = Pricing.estimate(3, 2, 'deep', ['fridge']);
      await page.click('#qc-request-quote');
      await expect(page.locator('#fservice')).toHaveValue(SERVICE_FOR_TYPE.deep);
      await expect(page.locator('#fbeds')).toHaveValue('3');
      expect(await page.locator('#festimator').inputValue()).toBe(`Estimator selection: 3 bedroom(s), 2 bathroom(s), Deep Cleaning, Inside fridge. Estimated range: ${rangeText(e)}.`);
      expect(w.consoleErrors).toEqual([]);
    });
  }
});
