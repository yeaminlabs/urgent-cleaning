/* Blog discovery: the hub, the published articles, and the links into and
   between them.

   Every guide is published. There are no placeholder cards any more, so the
   contract is stricter than it used to be: every card in the hub must be a real
   link, every link must open, and every article must carry the expected H1 and
   a breadcrumb back to the hub. A card that is not a link — or a "Coming soon"
   badge — now fails rather than being tolerated. */
'use strict';
const { test, expect } = require('../helpers/fixtures');

/* In the order the hub lists them. */
const ARTICLES = [
  { path: '/blog/house-cleaning-cost-kamloops/', h1: 'How Much Does House Cleaning Cost in Kamloops?' },
  { path: '/blog/move-out-cleaning-checklist-kamloops/', h1: 'Move-Out Cleaning Checklist for Kamloops Renters' },
  { path: '/blog/same-day-cleaning-kamloops/', h1: 'Same-Day Cleaning in Kamloops: What to Expect & How It Works' },
  { path: '/blog/deep-cleaning-vs-regular-cleaning/', h1: 'Deep Cleaning vs Regular Cleaning: What’s the Difference?' },
  { path: '/blog/airbnb-turnover-cleaning-kamloops/', h1: 'Airbnb Turnover Cleaning Checklist for Kamloops Hosts' },
  { path: '/blog/post-renovation-cleaning-kamloops/', h1: 'Post-Renovation Cleaning in Kamloops' },
];
/* The homepage teaser row intentionally shows only the first two guides — it is
   a two-up layout, and the hub is the complete index. */
const HOMEPAGE_ARTICLES = ARTICLES.slice(0, 2);

/* Service page <-> supporting article, both directions. */
const CLUSTERS = [
  ['/house-cleaning-kamloops/', '/blog/house-cleaning-cost-kamloops/'],
  ['/move-out-cleaning-kamloops/', '/blog/move-out-cleaning-checklist-kamloops/'],
  ['/same-day-cleaning-kamloops/', '/blog/same-day-cleaning-kamloops/'],
  ['/deep-cleaning-kamloops/', '/blog/deep-cleaning-vs-regular-cleaning/'],
  ['/rental-turnover-cleaning-kamloops/', '/blog/airbnb-turnover-cleaning-kamloops/'],
  ['/post-renovation-cleaning-kamloops/', '/blog/post-renovation-cleaning-kamloops/'],
];

test(`blog hub: all ${ARTICLES.length} guides are real links, and no placeholder cards remain`, async ({ page }) => {
  await page.goto('/blog/', { waitUntil: 'networkidle' });
  const cards = await page.$$eval('#guides .duo-card', els => els.map(c => ({
    link: c.tagName === 'A', href: c.getAttribute('href'), planned: c.getAttribute('data-planned-url'),
    badge: c.querySelector('.duo-eyebrow')?.textContent.trim(),
    cta: c.querySelector('.rel-go')?.textContent.trim(),
  })));

  expect(cards, 'card count').toHaveLength(ARTICLES.length);
  expect(cards.filter(c => !c.link), 'every card must be a link now').toHaveLength(0);
  expect(cards.filter(c => c.planned !== null), 'data-planned-url must be gone').toHaveLength(0);
  expect(cards.filter(c => /coming soon/i.test(c.badge || '')), '"Coming soon" badges must be gone').toHaveLength(0);
  expect(cards.map(c => c.href), 'hub card order').toEqual(ARTICLES.map(a => a.path));
  for (const c of cards) {
    expect(c.badge, `badge on ${c.href}`).toBe('Cleaning guide');
    expect(c.cta, `read-the-guide CTA on ${c.href}`).toMatch(/^Read the guide/);
  }
});

test('blog hub: every card opens its article with the expected H1', async ({ page }) => {
  for (const a of ARTICLES) {
    await page.goto('/blog/', { waitUntil: 'networkidle' });
    await page.locator(`#guides a[href="${a.path}"]`).click();
    await expect(page).toHaveURL(new RegExp(a.path.replace(/\//g, '\\/') + '$'));
    await expect(page.locator('h1')).toHaveText(a.h1);
  }
});

test('every article returns 200 and links back to the hub', async ({ page, request }) => {
  for (const a of ARTICLES) {
    expect((await request.get(a.path)).status(), a.path).toBe(200);
    await page.goto(a.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.crumb a[href="/blog/"]'), `${a.path} breadcrumb`).toHaveCount(1);
  }
});

test('no public page still advertises a planned or coming-soon guide', async ({ page }) => {
  for (const p of ['/', '/blog/', '/services/']) {
    await page.goto(p, { waitUntil: 'domcontentloaded' });
    const found = await page.evaluate(() => ({
      planned: document.querySelectorAll('[data-planned-url]').length,
      soon: document.body.innerText.match(/coming soon/i) ? 1 : 0,
    }));
    expect(found.planned, `${p}: data-planned-url elements`).toBe(0);
    expect(found.soon, `${p}: "Coming soon" text`).toBe(0);
  }
});

test('homepage "Cleaning Tips & Guides" section opens the guides it teases', async ({ page }) => {
  for (const a of HOMEPAGE_ARTICLES) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator(`#guides a[href="${a.path}"]`).click();
    await expect(page.locator('h1')).toHaveText(a.h1);
  }
});

test('each service page and its supporting article link to each other', async ({ page }) => {
  const inMain = async (from, to) => {
    await page.goto(from, { waitUntil: 'domcontentloaded' });
    return page.locator(`main a[href="${to}"]`).count();
  };
  for (const [service, article] of CLUSTERS) {
    expect(await inMain(service, article), `${service} -> ${article}`).toBeGreaterThan(0);
    expect(await inMain(article, service), `${article} -> ${service}`).toBeGreaterThan(0);
  }
});

test('the first two articles cross-link to each other', async ({ page }) => {
  const inMain = async (from, to) => {
    await page.goto(from, { waitUntil: 'domcontentloaded' });
    return page.locator(`main a[href="${to}"]`).count();
  };
  expect(await inMain(ARTICLES[0].path, ARTICLES[1].path), 'cost -> checklist').toBeGreaterThan(0);
  expect(await inMain(ARTICLES[1].path, ARTICLES[0].path), 'checklist -> cost').toBeGreaterThan(0);
});
