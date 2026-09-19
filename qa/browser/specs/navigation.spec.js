/* Responsive layout, navigation, footer and calls to action on every page at
   every supported width. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, WIDTHS, NAV_BREAKPOINT, DESKTOP_NAV, FOOTER_COMPANY, watchPage } = require('../helpers/site');

async function scrollThrough(page) {
  // Step down the page so lazy images actually enter the viewport and load.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += Math.round(innerHeight * 0.8)) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
    }
    scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 15_000 });
}

test.describe('Responsive layout, navigation and footer', () => {
  for (const p of PAGES) {
    test(`${p.name}: every width`, async ({ page }) => {
      const w = watchPage(page);
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 860 });
        await page.goto(p.path, { waitUntil: 'networkidle' });
        await scrollThrough(page);
        const r = await page.evaluate(() => {
          const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
          const cols = [...document.querySelectorAll('.footer-col')];
          const company = cols.find(c => /Company/.test(c.querySelector('.footer-col-h')?.textContent || ''));
          const sticky = document.querySelector('.m-call-bar');
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            hamburger: vis(document.getElementById('menu-btn')),
            desktopNav: vis(document.querySelector('.nav-right')),
            nav: [...document.querySelectorAll('.nav-links li')].map(li => li.textContent.trim()),
            footerCols: cols.length,
            company: company ? [...company.querySelectorAll('a')].map(a => a.textContent.trim()) : [],
            ctas: [...document.querySelectorAll('.btn-nav, .nav-drawer-cta, .m-call-bar a:not([href^="tel:"])')].map(a => a.getAttribute('href')),
            stickyVisible: vis(sticky),
            stickyHeights: sticky ? [...sticky.querySelectorAll('.mcb-item')].map(a => Math.round(a.getBoundingClientRect().height)) : [],
            brokenImages: [...document.images].filter(i => i.naturalWidth === 0).map(i => i.getAttribute('src')),
            cls: window.__cls,
          };
        });
        const at = `${p.path} @${width}px`;
        expect(r.overflow, `${at} horizontal overflow`).toBe(0);
        if (width <= NAV_BREAKPOINT) {
          expect(r.hamburger && !r.desktopNav, `${at} should show the hamburger`).toBe(true);
        } else {
          expect(!r.hamburger && r.desktopNav, `${at} should show the desktop nav`).toBe(true);
          expect(r.nav, `${at} desktop nav`).toEqual(DESKTOP_NAV);
        }
        expect(r.footerCols, `${at} footer columns`).toBe(2);
        expect(r.company, `${at} footer Company column`).toEqual(FOOTER_COMPANY);
        expect(new Set(r.ctas), `${at} Request a Quote targets`).toEqual(new Set([p.quoteCta]));
        if (width <= 640) {
          expect(r.stickyVisible, `${at} sticky call bar`).toBe(true);
          for (const h of r.stickyHeights) expect(h, `${at} sticky tap target`).toBeGreaterThanOrEqual(44);
        }
        expect(r.brokenImages, `${at} images that failed to load`).toEqual([]);
        expect(r.cls, `${at} cumulative layout shift`).toBeLessThan(0.1);
      }
      expect(w.consoleErrors, 'console errors').toEqual([]);
      expect(w.failedRequests, 'failed first-party requests').toEqual([]);
    });
  }

  test('breakpoint: hamburger at 1040px, desktop nav at 1041px', async ({ page }) => {
    for (const [width, hamburger] of [[NAV_BREAKPOINT, true], [NAV_BREAKPOINT + 1, false]]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('#menu-btn')).toBeVisible({ visible: hamburger });
      await expect(page.locator('.nav-right')).toBeVisible({ visible: !hamburger });
    }
  });

  test('mobile drawer opens, closes, and its links work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [label, path, h1] of [['Services', '/services/', 'Professional Cleaning Services in Kamloops'],
      ['About', '/about/', 'About Urgent Clean Kamloops'], ['Contact', '/contact/', 'Contact Urgent Clean Kamloops'],
      ['Blog', '/blog/', 'Cleaning Tips & Guides for Kamloops Homes']]) {
      await page.goto('/', { waitUntil: 'networkidle' });
      const btn = page.locator('#menu-btn');
      await btn.click();
      await expect(page.locator('#nav-drawer')).toHaveClass(/\bopen\b/);
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await btn.click();
      await expect(page.locator('#nav-drawer')).not.toHaveClass(/\bopen\b/);
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await btn.click();
      await page.locator('#nav-drawer').getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
      await expect(page.locator('h1')).toHaveText(h1);
    }
  });

  test('desktop nav links reach their pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [label, path] of [['Services', '/services/'], ['About', '/about/'], ['Contact', '/contact/']]) {
      await page.goto('/blog/', { waitUntil: 'networkidle' });
      await page.locator('.nav-links').getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
    }
  });

  test('"Request a Quote" on content pages lands on the Contact page form', async ({ page }) => {
    for (const path of ['/about/', '/services/', '/blog/', '/blog/house-cleaning-cost-kamloops/', '/blog/move-out-cleaning-checklist-kamloops/']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.locator('#nav .btn-nav').click();
      await expect(page).toHaveURL(/\/contact\/#quote$/);
      await expect(page.locator('#quote-form')).toBeVisible();
    }
  });
});
