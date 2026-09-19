/* Proves browser QA cannot send traffic to Google Analytics. Run this first:
   `npm run qa:ga-safety`. Every other spec also fails automatically if a
   request escapes (see helpers/fixtures.js) — this file proves each layer of
   the guard independently.

   Safety of the probes themselves: they use the fake measurement ID
   G-QATEST0000 and fetch() — which downloads but never executes a script — so
   even a broken layer could not record anything in the live property. The
   live tag URL (G-774RV984ST) is only ever requested by a real page in a
   guarded context. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { BLOCK_MARKER, HOST_RESOLVER_RULES, installAnalyticsGuard, escapedRequests, hostMatches, ANALYTICS_DOMAINS } = require('../helpers/analytics-guard');
const config = require('../playwright.config');

/* The raw-context tests below deliberately switch off layer 1. They must never
   run unless layer 2 is configured, or their probes would leave the machine.
   Fail closed: this throws before any probe is sent. */
function requireDnsBlackHole() {
  const args = (config.use && config.use.launchOptions && config.use.launchOptions.args) || [];
  expect(args, 'DNS black-hole missing from playwright.config.js — refusing to probe').toContain(`--host-resolver-rules=${HOST_RESOLVER_RULES}`);
}

const FAKE = 'G-QATEST0000';
const PROBES = [
  'https://www.googletagmanager.com/',
  `https://www.googletagmanager.com/gtag/js?id=${FAKE}`,
  `https://googletagmanager.com/gtm.js?id=GTM-QATEST`,
  'https://www.google-analytics.com/',
  `https://www.google-analytics.com/g/collect?v=2&tid=${FAKE}&en=qa_probe`,
  `https://google-analytics.com/g/collect?v=2&tid=${FAKE}&en=qa_probe`,
  `https://region1.google-analytics.com/g/collect?v=2&tid=${FAKE}&en=qa_probe`,
  'https://analytics.google.com/',
  `https://analytics.google.com/g/collect?v=2&tid=${FAKE}&en=qa_probe`,
  `https://region1.analytics.google.com/g/collect?v=2&tid=${FAKE}&en=qa_probe`,
  `https://stats.g.doubleclick.net/g/collect?v=2&tid=${FAKE}`,
];
const LIVE_TAG = 'https://www.googletagmanager.com/gtag/js?id=G-774RV984ST';

test.describe('GA safety — no test traffic can reach Google', () => {

  test('hostname matching covers each domain and subdomain, and nothing else', () => {
    for (const u of PROBES) expect(hostMatches(new URL(u).hostname, ANALYTICS_DOMAINS), u).toBe(true);
    // Look-alikes and the site's own hosts must never be blocked.
    for (const h of ['127.0.0.1', 'localhost', 'www.urgentcleankamloops.ca', 'fonts.googleapis.com', 'fonts.gstatic.com',
      'notgoogletagmanager.com', 'googletagmanager.com.evil.test', 'google.com', 'www.google.com'])
      expect(hostMatches(h, ANALYTICS_DOMAINS), h).toBe(false);
  });

  test('layer 1: the site\'s own GA4 tag is answered locally and never runs, while events still record', async ({ page, analyticsGuard }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(analyticsGuard.intercepted).toContain(LIVE_TAG);
    expect(await escapedRequests(analyticsGuard)).toEqual([]);
    // The real Google tag never executed…
    expect(await page.evaluate(() => typeof window.google_tag_manager)).toBe('undefined');
    // …but the page's inline gtag() stub still recorded the config locally.
    const configured = await page.evaluate(() => (window.dataLayer || []).map(a => Array.from(a))
      .some(a => a[0] === 'config' && a[1] === 'G-774RV984ST'));
    expect(configured).toBe(true);
  });

  test('layer 1: every Google analytics hostname is intercepted (fetch and sendBeacon)', async ({ page, analyticsGuard }) => {
    await page.goto('/robots.txt');
    const bodies = await page.evaluate(async urls => Promise.all(urls.map(async u => {
      try { return await (await fetch(u, { mode: 'cors', credentials: 'omit' })).text(); } catch (e) { return 'ERROR ' + e.message; }
    })), PROBES);
    // Script URLs get the marker inside a JS comment, everything else as text.
    PROBES.forEach((u, i) => expect(bodies[i], `${u} was not answered by the guard`).toContain(BLOCK_MARKER));
    // GA4 also transmits with navigator.sendBeacon.
    const beacon = `https://region1.google-analytics.com/g/collect?v=2&tid=${FAKE}&en=qa_beacon`;
    await page.evaluate(u => navigator.sendBeacon(u, 'qa'), beacon);
    await expect.poll(() => analyticsGuard.intercepted.includes(beacon)).toBe(true);
    for (const u of PROBES) expect(analyticsGuard.intercepted).toContain(u);
    expect(await escapedRequests(analyticsGuard)).toEqual([]);
  });

  test('layer 2: the browser is launched with the DNS black-hole', () => {
    requireDnsBlackHole();
  });

  test('layer 2: with interception removed, the DNS black-hole still stops every request', async ({ browser }) => {
    requireDnsBlackHole();
    // A raw context: same browser (same --host-resolver-rules), no interception.
    const ctx = await browser.newContext();
    const failures = [];
    ctx.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
    const page = await ctx.newPage();
    await page.goto('/robots.txt');
    const results = await page.evaluate(async urls => Promise.all(urls.map(async u => {
      try { await fetch(u, { mode: 'no-cors', credentials: 'omit' }); return 'REACHED'; } catch { return 'blocked'; }
    })), PROBES);
    await ctx.close();
    PROBES.forEach((u, i) => expect(results[i], `${u} was reachable without interception`).toBe('blocked'));
    for (const u of PROBES) {
      const f = failures.find(x => x.url === u);
      expect(f, `${u} produced no failed request`).toBeTruthy();
      expect(f.error, `${u} failed for the wrong reason`).toMatch(/NAME_NOT_RESOLVED/);
    }
  });

  test('regression: the historical glob never matched the real tag host', async ({ browser }) => {
    // Earlier ad-hoc tests used this glob. It misses www.googletagmanager.com,
    // which is why they sent real traffic. Proven here without contacting
    // Google: fake ID, fetch() only, and the DNS black-hole underneath.
    requireDnsBlackHole();
    const ctx = await browser.newContext();
    let globMatched = false;
    await ctx.route('**/googletagmanager.com/**', r => { globMatched = true; return r.abort(); });
    const failures = [];
    ctx.on('requestfailed', r => failures.push(r.failure()?.errorText));
    const page = await ctx.newPage();
    await page.goto('/robots.txt');
    await page.evaluate(u => fetch(u, { mode: 'no-cors' }).catch(() => {}), `https://www.googletagmanager.com/gtag/js?id=${FAKE}`);
    await ctx.close();
    expect(globMatched, 'the old glob unexpectedly matched').toBe(false);
    expect(failures.join(' '), 'request should have died at DNS instead').toMatch(/NAME_NOT_RESOLVED/);
  });

  test('the production site is refused, so no test can reach the live /api/quote', async ({ browser }) => {
    const ctx = await browser.newContext();
    const log = await installAnalyticsGuard(ctx);
    const page = await ctx.newPage();
    await page.goto('/robots.txt');
    const r = await page.evaluate(() => fetch('https://www.urgentcleankamloops.ca/api/quote', { method: 'POST', body: '{}' })
      .then(() => 'REACHED').catch(() => 'refused'));
    await ctx.close();
    expect(r).toBe('refused');
    expect(log.productionRefused).toContain('https://www.urgentcleankamloops.ca/api/quote');
  });
});
