/* The mobile header: fit, and interactive target size, either side of 360px.
   ----------------------------------------------------------------------------
   The sticky header's three children were all unshrinkable — a flex-shrink:0
   120px logo, a white-space:nowrap phone pill whose min-content width is the
   full number, and the menu button — so with its two 20px gaps the row always
   needed 318px and ended at x=342px. Below that the whole page scrolled
   sideways (320px overflowed by 22px on every page).

   Two things are now guarded:

     <= 359px  the phone CTA is a 44x44 icon button, dropping the row to
               248px (ends at x=272px, 48px of headroom at 320px)
     >= 360px  the full phone pill is kept, unchanged in width and style,
               and both controls are 44px interactive targets

   The assertions are geometric rather than rule-based, so any future change
   that makes the header too wide, or that shrinks a target back below 44px,
   fails here. 359/360/361 are tested explicitly because that boundary is
   where the two designs meet.

   qa/browser/specs/navigation.spec.js keeps its own coverage from 360px up;
   this file adds the narrow widths, the boundary and the target sizes. */
'use strict';
const { test, expect } = require('../helpers/fixtures');
const { PAGES, watchPage } = require('../helpers/site');

/* Below the breakpoint: icon-only. 320 is the narrowest viewport in real use,
   340 was the old failure edge, 359 is the last icon-only pixel. */
const NARROW = [320, 330, 340, 359];
/* At and above it: the full pill, unchanged. 360 is the critical width — the
   row ends at x=348 there, with 12px to spare (10.4px with the web font
   blocked), which is what makes the 44px hamburger fit without touching gaps. */
const NORMAL = [360, 361, 375, 390, 393, 414, 430];
/* The mobile nav is still active up to 1040px, so the targets apply here too. */
const TABLET = [768, 1024];
const MIN_TARGET = 44;
const BREAKPOINT = 359;

const PHONE_NAME = 'Call Urgent Clean at (250) 879-2425';
const TEL = 'tel:+12508792425';

const header = page => page.evaluate(() => {
  const docW = document.documentElement.clientWidth;
  const box = el => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, left: b.left, right: b.right }; };
  const inView = b => b.left >= -0.5 && b.right <= docW + 0.5;
  const logo = document.querySelector('.nav-logo-img');
  const phone = document.querySelector('.nav-phone');
  const menu = document.getElementById('menu-btn');
  const nav = document.getElementById('nav');
  const lb = box(logo), pb = box(phone), mb = box(menu);
  const phoneCS = getComputedStyle(phone);
  return {
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    navOverflow: nav.scrollWidth - nav.clientWidth,
    logo: lb, phone: pb, menu: mb,
    logoInView: inView(lb), phoneInView: inView(pb), menuInView: inView(mb),
    logoAspect: lb.h ? lb.w / lb.h : 0,
    menuShown: getComputedStyle(menu).display !== 'none',
    /* Icon-only is identified by the CSS background icon AND the collapsed
       text, so a half-applied rule cannot read as either state. */
    phoneHasIcon: phoneCS.backgroundImage !== 'none',
    phoneFontSize: parseFloat(phoneCS.fontSize),
    phoneHref: phone.getAttribute('href'),
    phoneLabel: phone.getAttribute('aria-label'),
    /* The number must stay in the DOM — only visually collapsed — so the
       accessible name never depends on the icon alone. */
    phoneTextInDom: /250/.test(phone.textContent),
  };
});

function assertCommon(h, at) {
  expect(h.pageOverflow, `${at}: horizontal page overflow`).toBeLessThanOrEqual(0);
  expect(h.navOverflow, `${at}: the header itself overflows`).toBeLessThanOrEqual(0);
  expect(h.logoInView, `${at}: the logo must stay in the viewport`).toBe(true);
  expect(h.phoneInView, `${at}: the phone control must stay in the viewport`).toBe(true);
  if (h.menuShown) expect(h.menuInView, `${at}: the menu button must stay in the viewport`).toBe(true);
  // the logo is never sacrificed to make room
  expect(h.logo.w, `${at}: the logo must stay readable`).toBeGreaterThanOrEqual(110);
  expect(h.logoAspect, `${at}: the logo must not be distorted`).toBeCloseTo(3, 1);
  // the link always dials and always has a name
  expect(h.phoneHref, `${at}: tel: link`).toBe(TEL);
  expect(h.phoneLabel, `${at}: accessible name`).toBe(PHONE_NAME);
  expect(h.phoneTextInDom, `${at}: the number must stay in the DOM`).toBe(true);
}

/* Interactive targets, at every width where the mobile nav is in play. */
function assertTargets(h, at) {
  expect(h.phone.h, `${at}: phone target height`).toBeGreaterThanOrEqual(MIN_TARGET);
  if (h.menuShown) {
    expect(h.menu.w, `${at}: menu target width`).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(h.menu.h, `${at}: menu target height`).toBeGreaterThanOrEqual(MIN_TARGET);
  }
}

/* ── the overflow itself, on every public page, both sides of the boundary ── */
const PAGE_WIDTHS = [320, 359, 360, 390, 430];
for (const p of PAGES) {
  test(`${p.name}: fits and keeps 44px targets at ${PAGE_WIDTHS.join('/')}px`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(p.path, { waitUntil: 'networkidle' });
    for (const width of PAGE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const h = await header(page);
      const at = `${p.path} @${width}px`;
      assertCommon(h, at);
      assertTargets(h, at);
    }
    expect(w.consoleErrors).toEqual([]);
  });
}

/* ── below the breakpoint: icon-only, 44x44 ─────────────────────────────── */
test(`at or below ${BREAKPOINT}px the phone CTA is a 44x44 icon button`, async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const width of NARROW) {
    await page.setViewportSize({ width, height: 900 });
    const h = await header(page);
    const at = `@${width}px`;
    assertCommon(h, at);
    assertTargets(h, at);
    expect(h.phoneHasIcon, `${at}: the phone CTA should show its icon`).toBe(true);
    expect(h.phoneFontSize, `${at}: the number should be visually collapsed`).toBe(0);
    expect(h.phone.w, `${at}: phone target width`).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(h.phone.w, `${at}: the icon button should stay compact`).toBeLessThan(60);
  }
});

/* ── at and above it: the full pill, unchanged, but a real target ───────── */
test(`from ${BREAKPOINT + 1}px up the full phone number stays, with a 44px target`, async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const width of [...NORMAL, ...TABLET]) {
    await page.setViewportSize({ width, height: 900 });
    const h = await header(page);
    const at = `@${width}px`;
    assertCommon(h, at);
    assertTargets(h, at);
    expect(h.phoneHasIcon, `${at}: the narrow icon leaked above ${BREAKPOINT}px`).toBe(false);
    expect(h.phoneFontSize, `${at}: the phone number must stay visible`).toBeGreaterThan(0);
    expect(h.phone.w, `${at}: the full phone pill must keep its width`).toBeGreaterThanOrEqual(100);
  }
});

/* ── the boundary, explicitly ───────────────────────────────────────────── */
test(`the ${BREAKPOINT}/${BREAKPOINT + 1}px boundary switches exactly once`, async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.setViewportSize({ width: BREAKPOINT, height: 900 });
  const narrow = await header(page);
  await page.setViewportSize({ width: BREAKPOINT + 1, height: 900 });
  const normal = await header(page);
  await page.setViewportSize({ width: BREAKPOINT + 2, height: 900 });
  const above = await header(page);

  expect(narrow.phoneHasIcon, `@${BREAKPOINT}px must still be icon-only`).toBe(true);
  expect(normal.phoneHasIcon, `@${BREAKPOINT + 1}px must be the full pill`).toBe(false);
  expect(above.phoneHasIcon, `@${BREAKPOINT + 2}px must be the full pill`).toBe(false);

  expect(narrow.phone.w, 'icon button width').toBeLessThan(60);
  expect(normal.phone.w, 'full pill width').toBeGreaterThanOrEqual(100);

  // both sides fit, and both sides meet the target minimum
  for (const [label, h] of [[`${BREAKPOINT}px`, narrow], [`${BREAKPOINT + 1}px`, normal], [`${BREAKPOINT + 2}px`, above]]) {
    expect(h.pageOverflow, `@${label}: page overflow`).toBeLessThanOrEqual(0);
    expect(h.navOverflow, `@${label}: nav overflow`).toBeLessThanOrEqual(0);
    assertTargets(h, `@${label}`);
  }
});

/* ── the drawer, which must not reintroduce overflow when open ──────────── */
for (const width of [320, 359, 360, 390, 430, 768, 1024]) {
  test(`@${width}px: the menu opens, stays inside the viewport, and closes`, async ({ page }) => {
    const w = watchPage(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const btn = page.locator('#menu-btn');
    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    await btn.click();
    await expect(drawer).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');

    const open = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const links = [...document.querySelectorAll('#nav-drawer a')];
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        navOverflow: (n => n.scrollWidth - n.clientWidth)(document.getElementById('nav')),
        count: links.length,
        allInView: links.every(a => { const b = a.getBoundingClientRect(); return b.left >= -0.5 && b.right <= docW + 0.5; }),
        tooSmall: links.filter(a => a.getBoundingClientRect().height < 44).length,
        hasTel: links.some(a => (a.getAttribute('href') || '').startsWith('tel:')),
      };
    });
    expect(open.overflow, `@${width}px: the page overflows while the menu is open`).toBeLessThanOrEqual(0);
    expect(open.navOverflow, `@${width}px: the nav overflows while the menu is open`).toBeLessThanOrEqual(0);
    expect(open.count, 'the drawer should have links').toBeGreaterThan(5);
    expect(open.allInView, `@${width}px: a drawer link sits outside the viewport`).toBe(true);
    expect(open.tooSmall, `@${width}px: drawer links under 44px tall`).toBe(0);
    expect(open.hasTel, 'the drawer must keep a phone link').toBe(true);

    // clicking outside closes it (the site's existing behaviour)
    await page.locator('#main').click({ position: { x: 10, y: 10 } });
    await expect(drawer).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    // and a drawer link still navigates
    await btn.click();
    await page.locator('#nav-drawer a[href="/services/"]').click();
    await expect(page).toHaveURL(/\/services\/$/);

    expect(w.consoleErrors).toEqual([]);
  });
}

/* ── the phone control stays usable in both states ──────────────────────── */
for (const width of [320, 360]) {
  test(`@${width}px the phone link is a named, focusable tel: link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    /* getByRole computes the accessible name the way assistive technology
       does, so this fails if the name ever depends on the icon alone. It must
       also match exactly once — no duplicate label from a second mechanism. */
    await expect(page.getByRole('link', { name: PHONE_NAME })).toHaveCount(1);

    const phone = page.locator('.nav-phone');
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute('href', TEL);
    await phone.focus();
    expect(await phone.evaluate(el => document.activeElement === el), 'must be keyboard focusable').toBe(true);
    const vis = await phone.evaluate(el => {
      const cs = getComputedStyle(el);
      return { display: cs.display, visibility: cs.visibility, height: parseFloat(cs.height) };
    });
    expect(vis.display, 'the link must not be display:none').not.toBe('none');
    expect(vis.visibility, 'the link must not be visibility:hidden').not.toBe('hidden');
    expect(vis.height, 'the link must be a 44px target').toBeGreaterThanOrEqual(MIN_TARGET);
  });
}

/* ── the defect must be fixed, not concealed ────────────────────────────── */
test('no overflow-hidden or transform hack is used to hide the overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const css = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowX,
    body: getComputedStyle(document.body).overflowX,
    nav: getComputedStyle(document.getElementById('nav')).overflowX,
    navInner: getComputedStyle(document.querySelector('.nav-inner')).overflowX,
    navTransform: getComputedStyle(document.getElementById('nav')).transform,
    innerTransform: getComputedStyle(document.querySelector('.nav-inner')).transform,
  }));
  for (const key of ['html', 'body', 'nav', 'navInner']) {
    expect(css[key], `${key} overflow-x must stay visible — clipping would conceal the defect`).toBe('visible');
  }
  expect(css.navTransform, 'the nav must not be scaled').toBe('none');
  expect(css.innerTransform, 'the nav row must not be scaled').toBe('none');
});
