/* Blog discovery: hub, published articles, planned (unlinked) articles, and the
   links into and between articles. */
'use strict';
const { test, expect } = require('../helpers/fixtures');

const ARTICLES = [
  { path: '/blog/house-cleaning-cost-kamloops/', h1: 'How Much Does House Cleaning Cost in Kamloops?' },
  { path: '/blog/move-out-cleaning-checklist-kamloops/', h1: 'Move-Out Cleaning Checklist for Kamloops Renters' },
];

test('blog hub: published guides are links that open, planned guides are not links', async ({ page }) => {
  await page.goto('/blog/', { waitUntil: 'networkidle' });
  const cards = await page.$$eval('#guides .duo-card', els => els.map(c => ({
    link: c.tagName === 'A', href: c.getAttribute('href'), planned: c.getAttribute('data-planned-url'),
    badge: c.querySelector('.duo-eyebrow')?.textContent.trim(),
  })));
  const published = cards.filter(c => c.link);
  expect(published.map(c => c.href)).toEqual(ARTICLES.map(a => a.path));
  for (const c of cards.filter(c => !c.link)) {
    expect(c.badge).toBe('Coming soon');
    expect(c.planned).toMatch(/^\/blog\/.+\/$/);
  }
  for (const a of ARTICLES) {
    await page.goto('/blog/', { waitUntil: 'networkidle' });
    await page.locator(`#guides a[href="${a.path}"]`).click();
    await expect(page).toHaveURL(new RegExp(a.path.replace(/\//g, '\\/') + '$'));
    await expect(page.locator('h1')).toHaveText(a.h1);
  }
});

test('homepage "Cleaning Tips & Guides" section opens both articles', async ({ page }) => {
  for (const a of ARTICLES) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator(`#guides a[href="${a.path}"]`).click();
    await expect(page.locator('h1')).toHaveText(a.h1);
  }
});

test('articles link to each other, back to the blog, and are linked from their service pages', async ({ page }) => {
  const inMain = async (from, to) => {
    await page.goto(from, { waitUntil: 'domcontentloaded' });
    return page.locator(`main a[href="${to}"]`).count();
  };
  expect(await inMain(ARTICLES[0].path, ARTICLES[1].path), 'article 1 -> article 2').toBeGreaterThan(0);
  expect(await inMain(ARTICLES[1].path, ARTICLES[0].path), 'article 2 -> article 1').toBeGreaterThan(0);
  expect(await inMain('/house-cleaning-kamloops/', ARTICLES[0].path), 'House Cleaning -> article 1').toBeGreaterThan(0);
  expect(await inMain('/move-out-cleaning-kamloops/', ARTICLES[1].path), 'Move-Out -> article 2').toBeGreaterThan(0);
  for (const a of ARTICLES) {
    await page.goto(a.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.crumb a[href="/blog/"]')).toHaveCount(1);
  }
});
