/* Page inventory and small shared helpers for the browser specs.
   When a page is added or its role changes, update PAGES here. */
'use strict';
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
/* The live pricing engine, loaded under Node. Estimator expectations are
   derived from it, so a deliberate price change does not break these specs —
   qa/pricing-consistency.js is what pins the approved values. */
const Pricing = require(path.join(REPO, 'assets', 'js', 'pricing.js'));

const PRODUCTION = 'https://www.urgentcleankamloops.ca';
const WIDTHS = [360, 390, 430, 768, 1024, 1440];
const NAV_BREAKPOINT = 1040;   // hamburger at <= 1040px, desktop nav above
const DESKTOP_NAV = ['Services', 'About', 'Property Managers', 'Coverage', 'Contact'];
const FOOTER_COMPANY = ['About Us', 'Services', 'Property Managers', 'Coverage', 'Price Estimator', 'Blog', 'Contact'];
const TYPES = ['standard', 'moveout', 'deep', 'postreno'];
const EXTRA_KEYS = ['fridge', 'oven', 'cabinets', 'laundry'];
const EVENT_NAMES = ['call_click', 'service_click', 'blog_click', 'estimator_complete', 'quote_form_start', 'quote_form_success', 'quote_form_error'];
const FORM_PAYLOAD_KEYS = ['name', 'phone', 'email', 'service', 'description', 'location', 'bedrooms', 'timing', 'estimatorContext', 'company', 'photo'];

/* quoteCta = where "Request a Quote" (nav, drawer, sticky bar) points.
   formLocation = the form_location analytics value on pages with a form. */
const SERVICE = (path, name, preselect, formLocation) =>
  ({ path, name, form: true, estimator: true, preselect, faq: true, quoteCta: '#contact', formLocation });
const PAGES = [
  { path: '/', name: 'Homepage', form: true, estimator: true, preselect: null, faq: true, quoteCta: '#contact', formLocation: 'homepage' },
  { path: '/services/', name: 'Services hub', form: false, estimator: false, faq: true, quoteCta: '/contact/#quote' },
  { path: '/about/', name: 'About', form: false, estimator: false, faq: true, quoteCta: '/contact/#quote' },
  { path: '/contact/', name: 'Contact', form: true, estimator: false, faq: true, quoteCta: '#quote', formLocation: 'contact_page' },
  { path: '/blog/', name: 'Blog hub', form: false, estimator: false, faq: false, quoteCta: '/contact/#quote' },
  { path: '/blog/house-cleaning-cost-kamloops/', name: 'Article: house cleaning cost', form: false, estimator: false, faq: true, quoteCta: '/contact/#quote' },
  { path: '/blog/move-out-cleaning-checklist-kamloops/', name: 'Article: move-out checklist', form: false, estimator: false, faq: true, quoteCta: '/contact/#quote' },
  SERVICE('/house-cleaning-kamloops/', 'House Cleaning', 'standard', 'house_cleaning_page'),
  SERVICE('/move-out-cleaning-kamloops/', 'Move-Out Cleaning', 'moveout', 'move_out_cleaning_page'),
  SERVICE('/same-day-cleaning-kamloops/', 'Same-Day Cleaning', 'standard', 'same_day_cleaning_page'),   // no same-day surcharge
  SERVICE('/deep-cleaning-kamloops/', 'Deep Cleaning', 'deep', 'deep_cleaning_page'),
  SERVICE('/rental-turnover-cleaning-kamloops/', 'Rental Turnover', 'moveout', 'rental_turnover_page'),  // priced as a move-out
  SERVICE('/post-renovation-cleaning-kamloops/', 'Post-Renovation', 'postreno', 'post_renovation_page'),
];

/* GA events recorded locally by the site's inline gtag() stub. */
const gaEvents = page => page.evaluate(() => (window.dataLayer || [])
  .map(a => Array.from(a)).filter(a => a[0] === 'event').map(a => ({ name: a[1], params: a[2] || {} })));

/* Lets a click run every handler (analytics included) but stops the resulting
   navigation, so the test can read dataLayer on the same page afterwards. */
const holdNextNavigation = page => page.evaluate(() =>
  window.addEventListener('click', e => e.preventDefault(), { capture: true, once: true }));

/* Console errors and failed first-party requests for a page. Analytics
   requests are answered by the guard and never count here. */
function watchPage(page) {
  const out = { consoleErrors: [], failedRequests: [] };
  page.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
  page.on('pageerror', e => out.consoleErrors.push('Uncaught: ' + e.message));
  page.on('response', r => {
    const u = new URL(r.url());
    if ((u.hostname === '127.0.0.1' || u.hostname === 'localhost') && r.status() >= 400) out.failedRequests.push(`${r.status()} ${u.pathname}`);
  });
  page.on('requestfailed', r => {
    const u = new URL(r.url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') out.failedRequests.push(`FAILED ${u.pathname} ${r.failure()?.errorText}`);
  });
  return out;
}

const rangeText = e => `$${e.low} – $${e.high}`;   // as the estimator renders it

module.exports = {
  REPO, Pricing, PRODUCTION, WIDTHS, NAV_BREAKPOINT, DESKTOP_NAV, FOOTER_COMPANY, TYPES, EXTRA_KEYS,
  EVENT_NAMES, FORM_PAYLOAD_KEYS, PAGES, gaEvents, holdNextNavigation, watchPage, rangeText,
};
