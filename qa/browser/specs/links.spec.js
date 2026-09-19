/* Every internal link returns 200, every in-page anchor has a target, and the
   sitemap lists exactly the site's pages. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES } = require('../helpers/site');

test('every internal link on every page returns 200 and every anchor has a target', async ({ page, request }) => {
  const hrefs = new Set();
  const deadAnchors = [];
  const crossAnchors = new Set();
  for (const p of PAGES) {
    await page.goto(p.path, { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(() => ({
      links: [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href')),
      dead: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
        .filter(h => h.length > 1 && !document.getElementById(h.slice(1))),
    }));
    r.links.forEach(h => { hrefs.add(h.split('#')[0]); if (h.includes('#')) crossAnchors.add(h); });
    r.dead.forEach(h => deadAnchors.push(`${p.path} -> ${h}`));
  }
  const bad = [];
  for (const h of hrefs) { const res = await request.get(h); if (res.status() !== 200) bad.push(`${res.status()} ${h}`); }
  expect(bad, 'internal links not returning 200').toEqual([]);
  expect(deadAnchors, 'same-page anchors with no target').toEqual([]);

  // Cross-page anchors (/contact/#quote, /#coverage …) must exist on the destination.
  const missing = [];
  for (const h of crossAnchors) {
    const [path, id] = h.split('#');
    await page.goto(path || '/', { waitUntil: 'domcontentloaded' });
    if (!(await page.evaluate(i => !!document.getElementById(i), id))) missing.push(h);
  }
  expect(missing, 'cross-page anchors with no target').toEqual([]);
  // Internal links point at exactly the 13 known pages: nothing unknown is
  // linked, and no page is an orphan.
  expect([...hrefs].sort(), 'distinct internal link targets').toEqual(PAGES.map(p => p.path).sort());
});

test('sitemap.xml lists exactly the 13 pages, and each returns 200', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const paths = [...xml.matchAll(/<loc>https:\/\/www\.urgentcleankamloops\.ca([^<]*)<\/loc>/g)].map(m => m[1]).sort();
  expect(paths).toEqual(PAGES.map(p => p.path).sort());
  for (const p of paths) expect((await request.get(p)).status(), p).toBe(200);
});
