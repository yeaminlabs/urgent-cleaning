/* Accessibility basics on every page: language, landmarks, headings, images,
   labels, accessible names, skip link and keyboard-operable FAQs. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES } = require('../helpers/site');

for (const p of PAGES) {
  test(`${p.name}: accessibility basics`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
      const skips = levels.filter((l, i) => i > 0 && l > levels[i - 1] + 1).length;
      const controls = [...document.querySelectorAll('input, select, textarea')]
        .filter(c => c.type !== 'hidden' && !c.closest('[aria-hidden="true"]'));
      return {
        lang: document.documentElement.lang,
        mains: document.querySelectorAll('main#main').length,
        h1: document.querySelectorAll('h1').length,
        firstHeading: levels[0], skips,
        imgNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')),
        imgNoSize: [...document.images].filter(i => !i.hasAttribute('width') || !i.hasAttribute('height')).map(i => i.getAttribute('src')),
        unlabelled: controls.filter(c => !(c.id && document.querySelector(`label[for="${c.id}"]`)) && !c.getAttribute('aria-label')).map(c => c.id || c.name),
        namelessButtons: [...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
        namelessLinks: [...document.querySelectorAll('a[href]')].filter(a => !a.textContent.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])')).map(a => a.getAttribute('href')),
      };
    });
    expect(r.lang).toBe('en-CA');
    expect(r.mains).toBe(1);
    expect(r.h1).toBe(1);
    expect(r.firstHeading).toBe(1);
    expect(r.skips, 'heading levels skipped').toBe(0);
    expect(r.imgNoAlt, 'images without alt').toEqual([]);
    expect(r.imgNoSize, 'images without width/height').toEqual([]);
    expect(r.unlabelled, 'form controls without a label').toEqual([]);
    expect(r.namelessButtons, 'buttons without an accessible name').toBe(0);
    expect(r.namelessLinks, 'links without an accessible name').toEqual([]);

    // Skip link: first Tab stop, and it moves the reader to the main content.
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveClass(/skip-link/);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);

    // FAQs open and close from the keyboard.
    if (p.faq) {
      const summary = page.locator('details.faq-item > summary').first();
      await summary.focus();
      await page.keyboard.press('Enter');
      expect(await summary.evaluate(s => s.parentElement.open)).toBe(true);
      await page.keyboard.press('Enter');
      expect(await summary.evaluate(s => s.parentElement.open)).toBe(false);
    }
  });
}
