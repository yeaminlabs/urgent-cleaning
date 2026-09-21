#!/usr/bin/env node
/* ============================================================================
   Site integrity — `npm run qa` (or `npm run qa:site`)
   ----------------------------------------------------------------------------
   Static checks over the HTML source: SEO metadata, structured data, FAQ
   schema, GA4 tag, forms, calls to action, navigation, footer, trust copy and
   secrets. Replaces the old ad-hoc "qa-meta-intact" suite, updated for the
   current 13-page site.

   Pricing architecture (one engine in assets/js/pricing.js, no duplicate
   constants in index.html or service-page.js, no data-price attributes,
   pricing.js loaded before the estimator on all 7 estimator pages, extras
   labels in sync, startingFrom(), estimator outputs) is owned by
   qa/pricing-consistency.js and is not repeated here. `npm run qa` runs both.

   Zero dependencies — Node built-ins only. Exits 1 on any failure.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PAGES, PRODUCTION, DESKTOP_NAV, FOOTER_COMPANY } = require('./browser/helpers/site');

const ROOT = path.resolve(__dirname, '..');
const fileOf = p => (p === '/' ? 'index.html' : p.slice(1) + 'index.html');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = Object.fromEntries(PAGES.map(p => [p.path, read(fileOf(p.path))]));

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('   ✓ ' + name); }
  catch (e) { failures.push(`${name}\n      ${e.message.split('\n').join('\n      ')}`); console.log('   ✗ ' + name); }
}
const section = t => console.log(`\n${t}`);
const attr = (h, re) => { const m = h.match(re); return m ? m[1] : null; };

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  mdash: '—', ndash: '–', middot: '·', hellip: '…', rarr: '→', rsaquo: '›', times: '×', copy: '©' };
const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n] !== undefined ? ENTITIES[n] : m));
const text = s => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const jsonLd = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const nodes = block => block['@graph'] || [block];

/* ── 1. METADATA ─────────────────────────────────────────────────────────── */
section('1. SEO metadata (all 13 pages)');
const meta = {};
for (const p of PAGES) {
  const h = html[p.path];
  const m = meta[p.path] = {
    title: decode(attr(h, /<title>([^<]*)<\/title>/) || ''),
    description: decode(attr(h, /<meta name="description" content="([^"]*)"/) || ''),
    canonical: attr(h, /<link rel="canonical" href="([^"]*)"/),
    robots: attr(h, /<meta name="robots" content="([^"]*)"/),
    ogTitle: decode(attr(h, /<meta property="og:title" content="([^"]*)"/) || ''),
    ogDescription: decode(attr(h, /<meta property="og:description" content="([^"]*)"/) || ''),
    ogUrl: attr(h, /<meta property="og:url" content="([^"]*)"/),
    twTitle: decode(attr(h, /<meta name="twitter:title" content="([^"]*)"/) || ''),
    twDescription: decode(attr(h, /<meta name="twitter:description" content="([^"]*)"/) || ''),
  };
  check(`${p.path}: title, description, canonical, robots, Open Graph, Twitter, one H1`, () => {
    assert.ok(m.title, 'missing <title>');
    // Google truncates around 60 characters; 62 is the agreed ceiling (Sprint 37).
    assert.ok(m.title.length <= 62, `title is ${m.title.length} chars (want <= 62): "${m.title}"`);
    assert.ok(m.description.length > 50 && m.description.length <= 160, `description is ${m.description.length} chars (want 51-160)`);
    assert.strictEqual(m.canonical, PRODUCTION + p.path, 'canonical');
    assert.strictEqual(m.ogUrl, PRODUCTION + p.path, 'og:url');
    assert.ok(m.robots === null || /^index, ?follow/.test(m.robots), `robots "${m.robots}"`);
    assert.deepStrictEqual([m.ogTitle, m.twTitle], [m.title, m.title], 'og/twitter title must equal <title>');
    assert.deepStrictEqual([m.ogDescription, m.twDescription], [m.description, m.description], 'og/twitter description must equal meta description');
    assert.strictEqual((h.match(/<h1[\s>]/g) || []).length, 1, 'H1 count');
  });
}
for (const key of ['title', 'description', 'canonical']) check(`every ${key} is unique`, () => {
  const seen = {};
  for (const p of PAGES) (seen[meta[p.path][key]] = seen[meta[p.path][key]] || []).push(p.path);
  assert.deepStrictEqual(Object.values(seen).filter(v => v.length > 1), []);
});
check('sitemap.xml lists exactly the 13 pages; robots.txt points to it', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(locs, PAGES.map(p => PRODUCTION + p.path).sort());
  assert.match(read('robots.txt'), /Sitemap: https:\/\/www\.urgentcleankamloops\.ca\/sitemap\.xml/);
});

/* ── 2. STRUCTURED DATA ──────────────────────────────────────────────────── */
section('2. Structured data');
const allNodes = [];
for (const p of PAGES) check(`${p.path}: every JSON-LD block parses`, () => {
  for (const b of jsonLd(html[p.path])) for (const n of nodes(b)) allNodes.push({ page: p.path, n });
});
check('exactly one LocalBusiness entity, https://www.urgentcleankamloops.ca/#business', () => {
  const lb = allNodes.filter(x => x.n['@type'] === 'LocalBusiness');
  assert.strictEqual(lb.length, 1, `found ${lb.length} top-level LocalBusiness nodes`);
  assert.strictEqual(lb[0].n['@id'], PRODUCTION + '/#business');
  assert.strictEqual(lb[0].page, '/');
});
check('no dangling @id references (publisher, author, isPartOf, mainEntity, provider)', () => {
  const ids = new Set(allNodes.map(x => x.n['@id']).filter(Boolean));
  const dangling = [];
  for (const { page, n } of allNodes) for (const k of ['publisher', 'author', 'isPartOf', 'mainEntity', 'provider'])
    if (n[k] && n[k]['@id'] && !ids.has(n[k]['@id'])) dangling.push(`${page} ${k} -> ${n[k]['@id']}`);
  assert.deepStrictEqual(dangling, []);
});
for (const p of PAGES.filter(p => p.faq)) check(`${p.path}: FAQ schema matches the visible FAQ exactly`, () => {
  const h = html[p.path];
  const faq = jsonLd(h).flatMap(nodes).find(n => n['@type'] === 'FAQPage');
  assert.ok(faq, 'no FAQPage node');
  assert.ok(faq['@id'], 'FAQPage has no @id');
  // Only FAQ items — the quote form's "Optional details" <summary> is not a FAQ.
  const pairs = [...h.matchAll(/<details class="faq-item">\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)];
  const qs = pairs.map(m => text(m[1]));
  const as = pairs.map(m => text(m[2]));
  assert.strictEqual(faq.mainEntity.length, qs.length, `schema has ${faq.mainEntity.length} questions, page shows ${qs.length}`);
  faq.mainEntity.forEach((q, i) => {
    assert.strictEqual(q.name, qs[i], `question ${i + 1} differs`);
    assert.strictEqual(q.acceptedAnswer.text, as[i], `answer ${i + 1} ("${q.name}") differs`);
  });
});

/* Sprint 37: the six service pages each answer "how much does X cost" for
   their own service. They shared one generic answer before, which duplicated
   FAQ content across four pages. Other answers (availability, service area)
   are legitimately shared between pages and are not covered here. */
check('each service page answers its own cost question in its own words', () => {
  const SERVICE_PAGES = PAGES.filter(p => p.estimator && p.path !== '/');
  const answers = new Map();
  for (const p of SERVICE_PAGES) {
    const pairs = [...html[p.path].matchAll(/<details class="faq-item">\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)];
    const cost = pairs.find(m => /how much|cost/i.test(text(m[1])));
    assert.ok(cost, `${p.path} has no cost FAQ`);
    const a = text(cost[2]);
    assert.ok(a.length >= 200, `${p.path} cost answer is only ${a.length} chars`);
    (answers.get(a) || answers.set(a, []).get(a)).push(p.path);
  }
  const shared = [...answers.values()].filter(v => v.length > 1);
  assert.deepStrictEqual(shared, [], `service pages sharing one cost answer: ${JSON.stringify(shared)}`);
});

/* Sprint 38: prose links into the two service pages that had the least
   contextual support. Each sits in a paragraph that already discusses the
   service, so if the surrounding copy is rewritten the link should be
   re-placed deliberately rather than quietly dropped. */
const PROSE_LINKS = [
  ['/about/', '/same-day-cleaning-kamloops/', 'same-day or short-notice cleaning'],
  ['/about/', '/post-renovation-cleaning-kamloops/', 'post-renovation cleanup'],
  ['/blog/house-cleaning-cost-kamloops/', '/same-day-cleaning-kamloops/', 'Same-day and short-notice appointments'],
  ['/blog/move-out-cleaning-checklist-kamloops/', '/same-day-cleaning-kamloops/', 'Same-day availability'],
  ['/same-day-cleaning-kamloops/', '/post-renovation-cleaning-kamloops/', 'post-renovation cleanup'],
];
check('contextual prose links into Same-Day and Post-Renovation are in place', () => {
  for (const [from, to, anchor] of PROSE_LINKS) {
    const re = new RegExp(`<a href="${to}"[^>]*>${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`);
    assert.match(html[from], re, `${from} -> ${to} ("${anchor}")`);
  }
});

/* The homepage hero is the LCP image: responsive sources, but still eager and
   high priority, with dimensions so it reserves its box. */
check('homepage hero image is responsive and still the priority LCP image', () => {
  const img = (html['/'].match(/<img[^>]*kamloops_city[\s\S]*?>/) || [''])[0];
  assert.ok(img, 'hero <img> not found');
  for (const [re, what] of [[/sizes="100vw"/, 'sizes'], [/fetchpriority="high"/, 'fetchpriority'],
    [/loading="eager"/, 'eager loading'], [/width="\d+"/, 'width'], [/height="\d+"/, 'height'], [/alt="[^"]+"/, 'alt text']])
    assert.match(img, re, `hero image lost its ${what}`);
  const srcset = (img.match(/srcset="([\s\S]*?)"/) || [, ''])[1];
  const widths = [...srcset.matchAll(/(\S+)\s+(\d+)w/g)].map(m => ({ file: m[1].replace('./', ''), w: +m[2] }));
  assert.ok(widths.length >= 3, `hero srcset has ${widths.length} candidates (want 3+)`);
  assert.ok(widths.some(c => c.w <= 640), 'hero srcset has no small (<=640w) candidate for phones');
  for (const c of widths) {
    const p = path.join(ROOT, c.file);
    assert.ok(fs.existsSync(p), `hero srcset points at a missing file: ${c.file}`);
    // Declared width must match the file, or the browser picks the wrong one.
    // All three WebP header forms, so no candidate is skipped silently.
    const b = fs.readFileSync(p);
    const fourcc = b.slice(12, 16).toString();
    const real = fourcc === 'VP8 ' ? (b.readUInt16LE(26) & 0x3fff)
      : fourcc === 'VP8L' ? ((b.readUInt32LE(21) & 0x3fff) + 1)
      : fourcc === 'VP8X' ? (b.readUIntLE(24, 3) + 1) : null;
    assert.ok(real, `${c.file}: unrecognised WebP header "${fourcc}" — cannot verify its width`);
    assert.strictEqual(real, c.w, `${c.file} is ${real}px wide but declared ${c.w}w`);
  }
});

/* ── 3. ANALYTICS ────────────────────────────────────────────────────────── */
section('3. GA4 tag and event instrumentation (source)');
for (const p of PAGES) check(`${p.path}: GA4 tag for G-774RV984ST`, () => {
  const h = html[p.path];
  assert.ok(h.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-774RV984ST"></script>'), 'async gtag.js tag');
  assert.ok(/gtag\('config', 'G-774RV984ST'\);/.test(h), 'inline gtag config');
});
const home = html['/'], shared = read('assets/js/service-page.js');
check('homepage fires all 7 events; service-page.js fires the 6 page events', () => {
  const has = (src, e) => src.includes(`'${e}'`);
  for (const e of ['call_click', 'service_click', 'blog_click', 'estimator_complete', 'quote_form_start', 'quote_form_success', 'quote_form_error'])
    assert.ok(has(home, e), `homepage lost ${e}`);
  for (const e of ['call_click', 'service_click', 'estimator_complete', 'quote_form_start', 'quote_form_success', 'quote_form_error'])
    assert.ok(has(shared, e), `service-page.js lost ${e}`);
});
/* Every analytics payload — written inline in the trackEvent() call or built
   in a variable first (`const params = {…}; params.x = …; trackEvent(…, params)`)
   — may only use the approved parameter names, and may never read a
   customer-input field. An allowlist, so a new key fails until reviewed. */
const APPROVED_PARAMS = ['click_location', 'form_location', 'service_name', 'article', 'bedrooms_count',
  'estimate_low', 'estimate_high', 'has_photo', 'used_estimator', 'error_type'];
const CUSTOMER_FIELD = /\b(fd\.get\(\s*['"]|elements\.|elements\[\s*['"]|getElementById\(\s*['"]|querySelector\(\s*['"][^'"]*)(name|phone|email|address|location|description|message)\b|\bselectedPhoto\s*\.|\bpayload\b/i;
function objectLiteralAt(src, open) {             // src[open] === '{' → the balanced literal
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced object literal');
}
function payloadParts(src) {
  const parts = [];
  for (const m of src.matchAll(/trackEvent\('([a-z_]+)',\s*/g)) {
    const at = m.index + m[0].length;
    if (src[at] === '{') { parts.push({ event: m[1], code: objectLiteralAt(src, at) }); continue; }
    const id = (src.slice(at).match(/^([A-Za-z_$][\w$]*)\s*\)/) || [])[1];
    assert.ok(id, `trackEvent('${m[1]}') payload is neither an object literal nor a variable`);
    const decl = src.slice(0, m.index).lastIndexOf(`const ${id} = {`);
    assert.ok(decl !== -1, `trackEvent('${m[1]}', ${id}): no "const ${id} = {…}" found before it`);
    const body = objectLiteralAt(src, src.indexOf('{', decl));
    const later = src.slice(decl, m.index).match(new RegExp(`\\b${id}(\\.[A-Za-z_$][\\w$]*|\\[[^\\]]*\\])\\s*=[^=][^;\\n]*`, 'g')) || [];
    parts.push({ event: m[1], code: body + '\n' + later.join('\n'), keys: later.map(a => a.match(/^[\w$]+(?:\.([\w$]+)|\[\s*['"]?([^'"\]]*))/)).map(x => x[1] || x[2]) });
  }
  return parts;
}
check('analytics payloads use only approved, non-PII parameters (inline or built in a variable)', () => {
  for (const [label, src, calls] of [['index.html', home, 7], ['service-page.js', shared, 6]]) {
    const parts = payloadParts(src);
    assert.strictEqual(parts.length, calls, `${label}: expected ${calls} trackEvent calls, parsed ${parts.length}`);
    for (const p of parts) {
      const topKeys = [...(p.keys || [])];          // keys added later: params.x = …
      // Top-level keys of the literal: strip nested literals/calls, then read `key:`.
      let flat = objectLiteralAt(p.code, 0).slice(1, -1);
      for (let prev; prev !== flat;) { prev = flat; flat = flat.replace(/\([^()]*\)|\{[^{}]*\}|\[[^\[\]]*\]/g, ''); }
      for (const k of flat.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) topKeys.push(k[1]);
      for (const k of topKeys) assert.ok(APPROVED_PARAMS.includes(k), `${label}: ${p.event} sends unapproved parameter "${k}"`);
      assert.ok(!CUSTOMER_FIELD.test(p.code), `${label}: ${p.event} payload reads a customer-input field: ${(p.code.match(CUSTOMER_FIELD) || [''])[0]}`);
    }
  }
});

/* ── 4. FORMS AND CALLS TO ACTION ────────────────────────────────────────── */
section('4. Forms and "Request a Quote" routing');
for (const p of PAGES) check(`${p.path}: ${p.form ? 'one quote form' : 'no form'}; quote CTAs -> ${p.quoteCta}`, () => {
  const h = html[p.path];
  assert.strictEqual((h.match(/<form\b/g) || []).length, p.form ? 1 : 0, 'form count');
  if (p.form) assert.ok(h.includes('id="quote-form"'), 'form id');
  const ctas = [...h.matchAll(/<a href="([^"]+)" class="(?:btn-nav|nav-drawer-cta|mcb-item)"(?! aria-label="Call)/g)].map(m => m[1]);
  assert.deepStrictEqual([...new Set(ctas)], [p.quoteCta], `CTA targets ${JSON.stringify(ctas)}`);
});
check('the quote form posts to /api/quote in both scripts', () => {
  assert.ok(/fetch\('\/api\/quote'/.test(home), 'homepage');
  assert.ok(/fetch\('\/api\/quote'/.test(shared), 'service-page.js');
});

/* ── 5. NAVIGATION, FOOTER, TRUST COPY ───────────────────────────────────── */
section('5. Navigation, footer and trust copy');
for (const p of PAGES) check(`${p.path}: desktop nav, drawer Blog link, footer Company column`, () => {
  const h = html[p.path];
  const nav = [...(h.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/) || ['', ''])[1].matchAll(/>([^<]+)<\/a>/g)].map(m => m[1].trim());
  assert.deepStrictEqual(nav, DESKTOP_NAV, 'desktop nav');
  const drawer = (h.match(/<div id="nav-drawer">([\s\S]*?)<\/div>/) || ['', ''])[1];
  assert.ok(drawer.includes('<a href="/blog/">Blog</a>'), 'drawer Blog link');
  const col = (h.match(/Company<\/p>([\s\S]*?)<\/nav>/) || ['', ''])[1];
  const links = [...col.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[2], m[1]]);
  assert.deepStrictEqual(links.map(l => l[0]), FOOTER_COMPANY, 'Company column order');
  assert.strictEqual(links.find(l => l[0] === 'Price Estimator')[1], p.path === '/' ? '#quote' : '/#quote', 'Price Estimator href');
  assert.strictEqual(links.find(l => l[0] === 'Blog')[1], '/blog/', 'Blog href');
});
check('homepage trust strip shows exactly the approved five claims', () => {
  const chips = [...home.matchAll(/<div class="trust-item"><div class="trust-dot"><\/div>([^<]*)<\/div>/g)].map(m => m[1]);
  assert.deepStrictEqual(chips, ['Same-day availability', 'Local Kamloops Service', 'Fast Quote Process', 'No contract required', 'Supplies Included']);
});
check('no unverified "fully insured" claim anywhere', () => {
  for (const p of PAGES) assert.ok(!/fully insured/i.test(html[p.path]), p.path);
});

/* ── 6. SECRETS ──────────────────────────────────────────────────────────── */
section('6. Secrets');
check('no SMTP credentials or API keys in any page or browser script', () => {
  const scripts = fs.readdirSync(path.join(ROOT, 'assets', 'js')).map(f => 'assets/js/' + f);
  const leaks = [...PAGES.map(p => fileOf(p.path)), ...scripts]
    .filter(f => /SMTP_PASS|SMTP_USER|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]/i.test(read(f)));
  assert.deepStrictEqual(leaks, []);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('SITE INTEGRITY QA PASSED');
