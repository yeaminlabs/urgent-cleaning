/* Brand assets: header and footer logos load undistorted, and the favicon is
   served on every page. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES } = require('../helpers/site');

for (const p of PAGES) {
  test(`${p.name}: logos and favicon`, async ({ page, request }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => [...document.images].filter(i => /logo/.test(i.src)).every(i => i.complete && i.naturalWidth > 0));
    const logos = await page.evaluate(() => ['.nav-logo-img', '.footer-logo-img'].map(sel => {
      const i = document.querySelector(sel);
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return { file: i.getAttribute('src'), alt: i.getAttribute('alt'), loaded: i.naturalWidth > 0,
        rendered: +(r.width / r.height).toFixed(2), natural: +(i.naturalWidth / i.naturalHeight).toFixed(2) };
    }));
    expect(logos[0]).toMatchObject({ file: '/assets/images/urgent-clean-main-logo.png', alt: 'Urgent Clean', loaded: true });
    expect(logos[1]).toMatchObject({ file: '/assets/images/urgent-clean-kamloops-logo-dark.png', alt: 'Urgent Clean', loaded: true });
    for (const l of logos) expect(Math.abs(l.rendered - l.natural), `${l.file} is distorted`).toBeLessThan(0.05);

    const icons = await page.$$eval('link[rel="icon"], link[rel="apple-touch-icon"]', ls => ls.map(l => l.getAttribute('href')));
    expect(icons).toEqual(['/assets/images/urgent-clean-favicon.png', '/assets/images/urgent-clean-favicon.png']);
    const fav = await request.get('/assets/images/urgent-clean-favicon.png');
    expect(fav.status()).toBe(200);
    expect(fav.headers()['content-type']).toBe('image/png');
  });
}
