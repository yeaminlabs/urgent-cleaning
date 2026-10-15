/* Quote forms and estimators. Expected prices come from assets/js/pricing.js,
   so these specs check that each page SHOWS what the engine computes; the
   approved values themselves are pinned by qa/pricing-consistency.js.
   /api/quote is always mocked. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, Pricing, FORM_PAYLOAD_KEYS, priceText, watchPage } = require('../helpers/site');

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

/* Service -> home size -> add-ons -> timing -> estimated total. Every option is
   rendered from pricing.js, so these specs drive the real controls and compare
   the panel against the engine rather than against numbers typed in here. */
const SERVICE_FOR_ID = { standard: 'House Cleaning', deep: 'Deep Cleaning', moveout: 'Move-Out Cleaning', turnover: 'Rental Turnover Cleaning' };

/* Driving helpers, bound to one page. */
const driver = page => ({
  pickService: id => page.click(`#qc-service .qc-opt[data-val="${id}"]`),
  pickSize:    id => page.click(`#qc-size .qc-opt[data-val="${id}"]`),
  pickTiming:  id => page.click(`#qc-timing .qc-opt[data-val="${id}"]`),
  /* Reveals the add-on if it is behind "More add-ons", then sets its quantity
     by clicking the control the component actually rendered for it. */
  async setAddon(id, qty) {
    let row = page.locator(`.qc-addon[data-id="${id}"]`);
    if (!(await row.count())) { await page.click('#qc-more'); row = page.locator(`.qc-addon[data-id="${id}"]`); }
    await expect(row, `add-on ${id} is not offered`).toHaveCount(1);
    const toggle = row.locator('[data-step="toggle"]');
    if (await toggle.count()) {
      const on = (await toggle.getAttribute('aria-pressed')) === 'true';
      if (on !== qty > 0) await toggle.click();
      return;
    }
    const val = row.locator('.qc-qty-val');
    for (let guard = 0; Number(await val.textContent()) !== qty; guard++) {
      expect(guard, `could not reach quantity ${qty} for ${id}`).toBeLessThan(20);
      const current = Number(await val.textContent());
      await row.locator(`[data-step="${current < qty ? 1 : -1}"]`).click();
    }
  },
});

test.describe('Estimators', () => {
  for (const p of PAGES.filter(p => p.estimator)) {
    test(`${p.name}: shows exactly what pricing.js computes`, async ({ page }) => {
      const w = watchPage(page);
      await page.goto(p.path, { waitUntil: 'networkidle' });
      const d = driver(page);

      // Nothing is priced until a size is chosen, even where the page
      // preselects its own service.
      await expect(page.locator('#qc-price')).toHaveText('—');
      await expect(page.locator('#qc-breakdown')).toBeHidden();
      const activeService = page.locator('#qc-service .qc-opt.active');
      if (p.preselect) await expect(activeService).toHaveAttribute('data-val', p.preselect);
      else await expect(activeService).toHaveCount(0);
      await expect(page.locator('#qc-timing .qc-opt.active')).toHaveAttribute('data-val', 'normal');

      // The options are the tables, in table order.
      expect(await page.$$eval('#qc-service .qc-opt', els => els.map(e => e.dataset.val)))
        .toEqual(Pricing.SERVICES.map(s => s.id));
      expect(await page.$$eval('#qc-timing .qc-opt', els => els.map(e => e.dataset.val)))
        .toEqual(Pricing.RUSH.map(r => r.id));

      // Every rendered "from $X" starting price equals startingFrom() for its
      // service and is visible. A service quoted per job has none to render.
      const starting = await page.$$eval('[data-starting-from]', els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { type: el.dataset.startingFrom, text: el.textContent, visible: r.width > 0 && r.height > 0 };
      }));
      expect(starting.length, 'starting prices on the page').toBeGreaterThan(0);
      for (const s of starting) expect(s, `starting price for ${s.type}`).toEqual({ type: s.type, text: Pricing.money(Pricing.startingFrom(s.type)), visible: true });
      if (p.preselect) expect(starting.map(s => s.type)).toContain(p.preselect);

      /* Each case is [service, size, addons, timing]. The expected figures are
         in the comments so a wrong total is readable in the failure output. */
      const cases = [
        ['standard', 'studio', {}, 'normal'],                                 // $125
        ['standard', '2bed', { oven: 1 }, 'normal'],                          // 175 + 20 = $195
        ['standard', '2bed', { oven: 1, fridge: 1 }, 'normal'],               // 175 + 40 = $215
        ['deep', '2bed', {}, 'normal'],                                       // $260
        ['moveout', '2bed', {}, 'rush-24h'],                                  // 295 + max(44,50) = $345
        ['standard', '2bed', {}, 'rush-24h'],                                 // 175 + 50 = $225 (minimum)
        ['deep', '4bed', {}, 'rush-3h'],                                      // 450 + 135 = $585
        ['standard', '2bed', { laundry: 1, 'laundry-extra': 2 }, 'normal'],   // 175 + 30 + 30 = $235
        ['standard', '2bed', { windows: 4, linen: 2 }, 'normal'],             // 175 + 40 + 20 = $235
        ['standard', '5plus', {}, 'normal'],                                  // $350+ (open-ended)
        ['turnover', 't-2bed', {}, 'normal'],                                 // $145
        ['turnover', 't-5plus', { oven: 1 }, 'overnight'],                    // custom quote, no rush
        ['standard', '2bed', { grease: 1 }, 'rush-6h'],                       // 175 + 60; grease quoted
      ];
      for (const [service, size, addons, timing] of cases) {
        await d.pickService(service);
        await d.pickSize(size);
        for (const a of Pricing.ADDONS) await d.setAddon(a.id, addons[a.id] || 0);
        await d.pickTiming(timing);

        const e = Pricing.estimate({ service, size, addons, timing });
        const at = `${service}/${size}/${JSON.stringify(addons)}/${timing}`;
        await expect(page.locator('#qc-price'), at).toHaveText(priceText(e));
        await expect(page.locator('#qc-breakdown')).toBeVisible();
        const total = page.locator('#qc-breakdown .qc-bd-row.total');
        if (e.quoteOnly) {
          await expect(total, at).toHaveCount(0);                       // nothing to total
          await expect(page.locator('#qc-breakdown')).toContainText('Custom quote');
        } else {
          await expect(total, at).toContainText(Pricing.money(e.total));
        }
        // A quote-only add-on is shown as needing a quote, never as $0.
        for (const line of e.addons.filter(l => l.amount === null))
          await expect(page.locator('#qc-breakdown'), at).toContainText(line.label);
        // The rush fee appears as its own line only when one is charged.
        const rush = page.locator('#qc-breakdown .qc-bd-row', { hasText: 'rush' });
        await expect(rush, at).toHaveCount(e.rush.fee ? 1 : 0);
        if (e.rush.fee) await expect(rush, at).toContainText(Pricing.money(e.rush.fee));
      }

      // A quantity control can never go below zero.
      await d.setAddon('windows', 0);
      const minus = page.locator('.qc-addon[data-id="windows"] [data-step="-1"]');
      await expect(minus).toBeDisabled();
      await expect(page.locator('.qc-addon[data-id="windows"] .qc-qty-val')).toHaveText('0');

      // Switching to turnover swaps the size list and drops an incompatible size.
      await d.pickService('standard');
      await d.pickSize('3bed');
      await d.pickService('turnover');
      expect(await page.$$eval('#qc-size .qc-opt', els => els.map(e => e.dataset.val)))
        .toEqual(Pricing.TURNOVER_SIZES.map(s => s.id));
      await expect(page.locator('#qc-price')).toHaveText('—');

      // Estimator -> form handoff. The context line carries the selection and
      // the figure the visitor was shown.
      await d.pickService('deep');
      await d.pickSize('3bed');
      for (const a of Pricing.ADDONS) await d.setAddon(a.id, a.id === 'fridge' ? 1 : 0);
      await d.pickTiming('normal');
      const e = Pricing.estimate({ service: 'deep', size: '3bed', addons: { fridge: 1 }, timing: 'normal' });
      await page.click('#qc-request-quote');
      await expect(page.locator('#fservice')).toHaveValue(SERVICE_FOR_ID.deep);
      await expect(page.locator('#fbeds')).toHaveValue('3');
      expect(await page.locator('#festimator').inputValue())
        .toBe(`Estimator selection: Deep Cleaning, 3 bed / 2 bath, Inside fridge. Estimated total: ${Pricing.money(e.total)}.`);
      expect(w.consoleErrors).toEqual([]);
    });
  }

  for (const p of PAGES.filter(p => p.quotePanel)) {
    test(`${p.name}: offers a quote request instead of inventing a price`, async ({ page }) => {
      const w = watchPage(page);
      await page.goto(p.path, { waitUntil: 'networkidle' });
      for (const id of ['#qc-service', '#qc-size', '#qc-addons', '#qc-timing', '#qc-price'])
        await expect(page.locator(id), `${id} should not exist on a quoted-per-job page`).toHaveCount(0);
      const panel = page.locator('#qc-result');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Custom quote');
      await expect(panel).not.toContainText(/\$\d/);
      /* .qc-cta is invisible until it carries .ready, so check the link is
         genuinely usable rather than merely present in the markup. */
      const cta = panel.locator('a.qc-cta');
      await expect(cta).toHaveAttribute('href', '#contact');
      await expect(cta).toBeVisible();
      expect((await cta.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await cta.click();
      await expect(page.locator('#quote-form')).toBeVisible();
      expect(w.consoleErrors).toEqual([]);
    });
  }
});
