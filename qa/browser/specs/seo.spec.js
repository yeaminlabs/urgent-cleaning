/* SEO as rendered in the browser. Deeper static checks (FAQ schema equality,
   @id references, sitemap/canonical agreement) live in qa/site-integrity.js. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, PRODUCTION } = require('../helpers/site');

test('rendered metadata and structured data on every page', async ({ page }) => {
  const titles = new Map(), descriptions = new Map();
  let localBusiness = 0;
  for (const p of PAGES) {
    await page.goto(p.path, { waitUntil: 'domcontentloaded' });
    const m = await page.evaluate(() => {
      const meta = sel => document.querySelector(sel)?.getAttribute('content') ?? null;
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
        try { return JSON.parse(s.textContent); } catch { return 'INVALID'; }
      });
      return {
        title: document.title, canonical: document.querySelector('link[rel="canonical"]')?.href,
        description: meta('meta[name="description"]'), robots: meta('meta[name="robots"]'),
        ogTitle: meta('meta[property="og:title"]'), ogDescription: meta('meta[property="og:description"]'), ogUrl: meta('meta[property="og:url"]'),
        twTitle: meta('meta[name="twitter:title"]'), twDescription: meta('meta[name="twitter:description"]'),
        h1: document.querySelectorAll('h1').length, ld,
      };
    });
    const at = p.path;
    expect(m.title, at).toBeTruthy();
    expect(m.canonical, at).toBe(PRODUCTION + p.path);
    expect(m.ogUrl, at).toBe(PRODUCTION + p.path);
    expect(m.description?.length, `${at} description length`).toBeGreaterThan(50);
    expect(m.description.length, `${at} description length`).toBeLessThanOrEqual(160);
    expect([m.ogTitle, m.twTitle], `${at} og/twitter title`).toEqual([m.title, m.title]);
    expect([m.ogDescription, m.twDescription], `${at} og/twitter description`).toEqual([m.description, m.description]);
    if (m.robots !== null) expect(m.robots, at).toMatch(/^index, ?follow/);
    expect(m.h1, `${at} H1 count`).toBe(1);
    expect(m.ld.length, `${at} JSON-LD blocks`).toBeGreaterThan(0);
    expect(m.ld, `${at} JSON-LD must parse`).not.toContain('INVALID');
    for (const block of m.ld) for (const n of (block['@graph'] || [block])) if (n['@type'] === 'LocalBusiness') localBusiness++;
    titles.set(m.title, [...(titles.get(m.title) || []), at]);
    descriptions.set(m.description, [...(descriptions.get(m.description) || []), at]);
  }
  expect([...titles.values()].filter(v => v.length > 1), 'duplicate titles').toEqual([]);
  expect([...descriptions.values()].filter(v => v.length > 1), 'duplicate descriptions').toEqual([]);
  expect(localBusiness, 'LocalBusiness nodes declared site-wide').toBe(1);
});
