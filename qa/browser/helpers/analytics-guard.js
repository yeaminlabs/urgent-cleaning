/* ============================================================================
   Analytics guard — browser QA must never send traffic to Google Analytics.
   ----------------------------------------------------------------------------
   The site loads gtag.js from www.googletagmanager.com for the live GA4
   property G-774RV984ST. Earlier ad-hoc tests tried to block it with a URL glob
   that only matches a host named exactly "googletagmanager.com" (see
   specs/ga-safety.spec.js for the pattern), so www.googletagmanager.com was
   never matched and real hits reached the live property. This module replaces
   that with three independent layers:

     1. Interception (per browser context) by exact HOSTNAME — the domain or any
        subdomain of it. gtag.js is answered with an empty script, so the real
        tag never runs and nothing can be transmitted. The site's inline
        `gtag()` stub still pushes every event into window.dataLayer, which is
        what the analytics tests assert against.
     2. A DNS black-hole on the browser (HOST_RESOLVER_RULES, applied in
        playwright.config.js). If layer 1 is ever broken or bypassed, these
        hostnames still cannot resolve.
     3. Escape detection, independent of the blocklist. Every request the
        browser makes to a host other than the local QA server and Google
        Fonts must have been answered by layer 1 (or refused); the test
        fixture fails any test in which one was not. So the protection is
        verified on every run, not assumed.

   The production host is refused too, so no test can ever reach the live
   /api/quote endpoint and send a real email.

   Matching is by hostname only — never by substring of the full URL — so the
   site's own assets can never be blocked by accident.
   ========================================================================== */
'use strict';

const ANALYTICS_DOMAINS = Object.freeze([
  'googletagmanager.com',     // gtag.js / GTM
  'google-analytics.com',     // GA collection, incl. region1.google-analytics.com
  'analytics.google.com',     // GA4 collection, incl. region1.analytics.google.com
  'doubleclick.net',          // stats.g.doubleclick.net (GA4 with Google signals)
]);
const PRODUCTION_DOMAINS = Object.freeze(['urgentcleankamloops.ca']);

/* Layers 1 and 2 are both built from ANALYTICS_DOMAINS, so deleting a domain
   from that list would switch off both at once. Fail closed instead: this runs
   when playwright.config.js loads, so a missing domain stops Playwright before
   any browser starts. Removing a domain here needs a second, deliberate edit. */
const MUST_BLOCK = ['googletagmanager.com', 'google-analytics.com', 'analytics.google.com'];
for (const d of MUST_BLOCK) {
  if (!ANALYTICS_DOMAINS.includes(d)) {
    throw new Error(`analytics-guard: "${d}" is missing from ANALYTICS_DOMAINS — refusing to run browser QA, it could send real GA4 traffic.`);
  }
}

const BLOCK_MARKER = 'QA-ANALYTICS-BLOCKED';

/* Layer 3 is deliberately independent of layers 1 and 2: it does not use
   hostMatches() or ANALYTICS_DOMAINS at all. It is default-deny — every
   request to a host that is neither the local QA server nor on this exact
   allowlist must have been answered by layer 1 or refused, otherwise the test
   fails. A bug in the blocklist matcher therefore cannot also hide the leak it
   causes (mutation testing found exactly that weakness in an earlier version). */
const ALLOWED_EXTERNAL_HOSTS = Object.freeze(['fonts.googleapis.com', 'fonts.gstatic.com']);
const isLocalHost = h => h === '127.0.0.1' || h === 'localhost' || h === '';   // '' = data:, blob:, about:

function hostMatches(hostname, domains) {
  const h = String(hostname || '').toLowerCase();
  return domains.some(d => h === d || h.endsWith('.' + d));
}
function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
const isAnalyticsUrl = url => hostMatches(hostOf(url), ANALYTICS_DOMAINS);
const isProductionUrl = url => hostMatches(hostOf(url), PRODUCTION_DOMAINS);

/* Layer 2: Chromium --host-resolver-rules value. `~NOTFOUND` makes resolution
   fail outright (safer than mapping to 127.0.0.1, which is where the QA server
   runs). */
const HOST_RESOLVER_RULES = [...ANALYTICS_DOMAINS, ...PRODUCTION_DOMAINS]
  .flatMap(d => [`MAP ${d} ~NOTFOUND`, `MAP *.${d} ~NOTFOUND`])
  .join(', ');

/* Layer 1 + bookkeeping for layer 3. Call before any page in the context
   navigates. Returns a log the fixture (and tests) inspect. */
async function installAnalyticsGuard(context) {
  const log = { external: [], intercepted: [], productionRefused: [] };

  context.on('request', req => {
    const h = hostOf(req.url());
    if (!isLocalHost(h) && !ALLOWED_EXTERNAL_HOSTS.includes(h)) log.external.push(req.url());
  });

  await context.route(url => hostMatches(url.hostname, ANALYTICS_DOMAINS), route => {
    const req = route.request();
    log.intercepted.push(req.url());
    const script = req.resourceType() === 'script' || /\/(gtag\/js|gtm\.js)\b/.test(req.url());
    return route.fulfill({
      status: 200,
      headers: {
        'content-type': script ? 'text/javascript' : 'text/plain',
        'access-control-allow-origin': '*',
        'x-qa-analytics-blocked': '1',
      },
      body: script ? `/* ${BLOCK_MARKER} */` : BLOCK_MARKER,
    });
  });

  await context.route(url => hostMatches(url.hostname, PRODUCTION_DOMAINS), route => {
    log.productionRefused.push(route.request().url());
    return route.abort('blockedbyclient');
  });

  return log;
}

/* Layer 3. External requests that were neither answered by layer 1 nor
   refused. Compared as multisets, and re-checked briefly so a request whose
   'request' event fired just before its route handler is not misreported. */
async function escapedRequests(log, settleMs = 1500) {
  const diff = () => {
    const left = [...log.intercepted, ...log.productionRefused];
    return log.external.filter(u => { const i = left.indexOf(u); if (i === -1) return true; left.splice(i, 1); return false; });
  };
  const until = Date.now() + settleMs;
  let escaped = diff();
  while (escaped.length && Date.now() < until) {
    await new Promise(r => setTimeout(r, 100));
    escaped = diff();
  }
  return escaped;
}

module.exports = {
  ANALYTICS_DOMAINS, PRODUCTION_DOMAINS, ALLOWED_EXTERNAL_HOSTS, BLOCK_MARKER, HOST_RESOLVER_RULES,
  hostMatches, isAnalyticsUrl, isProductionUrl, installAnalyticsGuard, escapedRequests,
};
