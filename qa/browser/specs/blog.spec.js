/* Blog discovery: hub, published articles, planned (unlinked) articles, and the
   links into and between articles. */
'use strict';
const { test, expect } = require('../helpers/fixtures');

const ARTICLES = [
  { path: '/blog/house-cleaning-cost-kamloops/', h1: 'How Much Does House Cleaning Cost in Kamloops?' },
  { path: '/blog/move-out-cleaning-checklist-kamloops/', h1: 'Move-Out Cleaning Checklist for Kamloops Renters' },
  { path: '/blog/same-day-cleaning-kamloops/', h1: 'Same-Day Cleaning in Kamloops: What to Expect & How It Works' },
];
/* The homepage teaser row intentionally shows only the first two guides — it is
   a two-up layout, and the hub is the complete index. */
const HOMEPAGE_ARTICLES = ARTICLES.slice(0, 2);

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

test('homepage "Cleaning Tips & Guides" section opens the guides it teases', async ({ page }) => {
  for (const a of HOMEPAGE_ARTICLES) {
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
  // Sprint 40: the same-day cluster links both ways.
  expect(await inMain('/same-day-cleaning-kamloops/', ARTICLES[2].path), 'Same-Day service -> article 3').toBeGreaterThan(0);
  expect(await inMain(ARTICLES[2].path, '/same-day-cleaning-kamloops/'), 'article 3 -> Same-Day service').toBeGreaterThan(0);
  for (const a of ARTICLES) {
    await page.goto(a.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.crumb a[href="/blog/"]')).toHaveCount(1);
  }
});
