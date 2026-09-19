/* GA4 instrumentation, asserted locally against window.dataLayer. Nothing is
   sent to Google: the fixture intercepts every analytics request and fails the
   test if one escapes. /api/quote is always mocked — the QA server has no API. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, EVENT_NAMES, Pricing, gaEvents, holdNextNavigation } = require('../helpers/site');

const PII = { phone: '2505550000', email: 'qa-person@example.com', name: 'QA Person', location: 'Sahali', description: 'QA description text' };

test.describe('Analytics — GA4 tag present on every page', () => {
  for (const p of PAGES) {
    test(`${p.name}: loads the GA4 tag for G-774RV984ST`, async ({ page, analyticsGuard }) => {
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await expect(page.locator('script[async][src="https://www.googletagmanager.com/gtag/js?id=G-774RV984ST"]')).toHaveCount(1);
      const cfg = await page.evaluate(() => (window.dataLayer || []).map(a => Array.from(a)).filter(a => a[0] === 'config').map(a => a[1]));
      expect(cfg).toEqual(['G-774RV984ST']);
      expect(analyticsGuard.intercepted).toContain('https://www.googletagmanager.com/gtag/js?id=G-774RV984ST');
    });
  }
});

async function fillAndSubmit(page) {
  await page.fill('#fphone', PII.phone);
  await page.fill('#femail', PII.email);
  await page.fill('#fdesc', PII.description);
  await page.evaluate(() => { const d = document.getElementById('form-optional'); if (d) d.open = true; });
  await page.fill('#fname', PII.name);
  await page.fill('#flocation', PII.location);
  await page.click('#form-submit-btn');
}
const expectNoPII = async page => {
  const dump = JSON.stringify(await page.evaluate(() => (window.dataLayer || []).map(a => Array.from(a))));
  for (const [k, v] of Object.entries(PII)) expect(dump, `${k} leaked into dataLayer`).not.toContain(v);
};

for (const flow of [
  { page: PAGES.find(p => p.path === '/'), serviceCard: '.svc[data-service]', serviceLocation: 'homepage_services', blog: true },
  { page: PAGES.find(p => p.path === '/house-cleaning-kamloops/'), serviceCard: '.rel[data-service]', serviceLocation: 'house_cleaning_related', blog: false },
]) {
  test(`${flow.page.name}: every event fires locally with the expected parameters`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/api/quote', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.goto(flow.page.path, { waitUntil: 'networkidle' });
    const e = Pricing.estimate(2, 1, 'moveout');

    // estimator_complete — and not again for an identical selection
    await page.click('#qc-beds .qc-opt[data-val="2"]');
    await page.click('#qc-condition .qc-opt[data-val="moveout"]');
    let est = (await gaEvents(page)).filter(x => x.name === 'estimator_complete');
    const last = est[est.length - 1].params;
    expect(last).toMatchObject({ service_name: 'Move-Out Cleaning', bedrooms_count: 2, estimate_low: e.low, estimate_high: e.high });
    if (flow.page.path === '/') expect(last).not.toHaveProperty('form_location');     // homepage has never sent it
    else expect(last.form_location).toBe(flow.page.formLocation);
    const count = est.length;
    await page.click('#qc-condition .qc-opt[data-val="moveout"]');
    expect((await gaEvents(page)).filter(x => x.name === 'estimator_complete')).toHaveLength(count);
    await page.click('#qc-request-quote');

    // service_click
    await holdNextNavigation(page);
    const card = page.locator(flow.serviceCard).first();
    const svcName = await card.getAttribute('data-service');
    await card.click();
    expect((await gaEvents(page)).filter(x => x.name === 'service_click').pop().params)
      .toEqual({ service_name: svcName, click_location: flow.serviceLocation });

    // blog_click (homepage only)
    if (flow.blog) {
      await holdNextNavigation(page);
      await page.locator('[data-article="house-cleaning-cost-kamloops"]').click();
      expect((await gaEvents(page)).filter(x => x.name === 'blog_click').pop().params)
        .toEqual({ article: 'house-cleaning-cost-kamloops', click_location: 'homepage_blog_section' });
    }

    // call_click
    await holdNextNavigation(page);
    await page.locator('#nav .nav-phone').click();
    expect((await gaEvents(page)).filter(x => x.name === 'call_click').pop().params).toEqual({ click_location: 'navigation' });

    // quote_form_start (once) and quote_form_success
    await fillAndSubmit(page);
    await expect.poll(async () => (await gaEvents(page)).some(x => x.name === 'quote_form_success')).toBe(true);
    const ev = await gaEvents(page);
    expect(ev.filter(x => x.name === 'quote_form_start')).toHaveLength(1);
    expect(ev.find(x => x.name === 'quote_form_success').params).toEqual({
      service_name: svcName, form_location: flow.page.formLocation, has_photo: false,
      used_estimator: true, estimate_low: e.low, estimate_high: e.high,
    });
    // Only the known event names, and every expected one present.
    const names = [...new Set(ev.map(x => x.name))];
    for (const n of names) expect(EVENT_NAMES).toContain(n);
    const want = ['estimator_complete', 'service_click', 'call_click', 'quote_form_start', 'quote_form_success', ...(flow.blog ? ['blog_click'] : [])];
    for (const n of want) expect(names).toContain(n);
    await expectNoPII(page);
  });
}

for (const [label, handler, errorType] of [
  ['500 server error', r => r.fulfill({ status: 500, body: 'x' }), 'server'],
  ['400 validation error', r => r.fulfill({ status: 400, body: 'x' }), 'validation'],
  ['network failure', r => r.abort('failed'), 'network'],
]) {
  test(`quote_form_error classifies a ${label} as "${errorType}"`, async ({ page }) => {
    await page.route('**/api/quote', handler);
    await page.goto('/deep-cleaning-kamloops/', { waitUntil: 'networkidle' });
    await fillAndSubmit(page);
    await expect.poll(async () => (await gaEvents(page)).some(x => x.name === 'quote_form_error')).toBe(true);
    const ev = await gaEvents(page);
    expect(ev.find(x => x.name === 'quote_form_error').params).toEqual({ error_type: errorType, form_location: 'deep_cleaning_page', service_name: 'Deep Cleaning' });
    expect(ev.some(x => x.name === 'quote_form_success')).toBe(false);
    await expect(page.locator('#form-error')).toBeVisible();
    await expectNoPII(page);
  });
}
