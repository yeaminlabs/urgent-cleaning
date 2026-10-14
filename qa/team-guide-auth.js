#!/usr/bin/env node
/* ============================================================================
   Team price guide — private route QA (`npm run qa:team-guide`)
   ----------------------------------------------------------------------------
   Two things are checked here:

     1. The middleware LOGIC, by importing proxy.ts and calling it with real
        Request objects: no credentials -> 401, wrong credentials -> 401, right
        credentials -> pass through, public routes -> untouched, and the gate
        working with NO environment variables set at all.

     2. DISCOVERY safety: the guide must not be in the sitemap, must not be
        linked from any public page, must keep its noindex meta tag, must not be
        advertised in robots.txt, and no credential may ever be committed.

   The credentials below are the real ones. That is not a leak: proxy.ts ships
   their SHA-256 digests, and a 4-digit password is recoverable from a digest
   instantly, so anyone who can read this repository can already get in. This is
   a lightweight staff gate, not authentication — see the note in proxy.ts.

   Zero dependencies beyond the middleware itself. Exits 1 on any failure.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const GUIDE = '/team-price-guide';
const GUIDE_FILE = 'team-price-guide/index.html';

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log('   ✓ ' + name); }
  catch (e) { failures.push(`${name}\n      ${e.message.split('\n').join('\n      ')}`); console.log('   ✗ ' + name); }
}
const section = t => console.log(`\n${t}`);

const USER = 'admin';
const PASS = '1234';
const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
const req = (url, headers = {}) => new Request('https://www.urgentcleankamloops.ca' + url, { headers });

(async () => {
  /* ── 1. MIDDLEWARE LOGIC ───────────────────────────────────────────────── */
  section('1. Basic Auth on /team-price-guide');
  // Deliberately NOT setting any environment variable: the gate must work on a
  // deployment where none can be configured.
  for (const k of Object.keys(process.env)) if (k.startsWith('TEAM_GUIDE_')) delete process.env[k];
  const { default: proxy } = await import('../proxy.ts');

  // `next()` resolves to a Response carrying Vercel's continue marker.
  const isPassThrough = r => r.status < 400 && (r.headers.get('x-middleware-next') === '1' || r.headers.has('x-middleware-next'));

  await check('no Authorization header -> 401 with a Basic challenge', async () => {
    const r = await proxy(req(GUIDE + '/'));
    assert.strictEqual(r.status, 401, `status ${r.status}`);
    assert.match(r.headers.get('www-authenticate') || '', /^Basic realm="Urgent Clean Team"/, 'WWW-Authenticate');
    assert.strictEqual(r.headers.get('cache-control'), 'no-store', 'Cache-Control');
    assert.strictEqual(r.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', 'X-Robots-Tag');
  });

  await check('wrong password -> 401', async () => {
    assert.strictEqual((await proxy(req(GUIDE + '/', { authorization: basic(USER, 'wrong') }))).status, 401);
  });
  await check('wrong username -> 401', async () => {
    assert.strictEqual((await proxy(req(GUIDE + '/', { authorization: basic('someone', PASS) }))).status, 401);
  });
  await check('malformed / non-Basic Authorization headers -> 401', async () => {
    for (const h of ['', 'Bearer abc123', 'Basic', 'Basic !!!not-base64!!!', 'Basic ' + Buffer.from('no-colon').toString('base64')])
      assert.strictEqual((await proxy(req(GUIDE + '/', { authorization: h }))).status, 401, `header "${h}"`);
  });
  await check('empty password is never accepted', async () => {
    assert.strictEqual((await proxy(req(GUIDE + '/', { authorization: basic(USER, '') }))).status, 401);
  });

  await check('correct credentials -> request continues, private + noindex headers', async () => {
    const r = await proxy(req(GUIDE + '/', { authorization: basic(USER, PASS) }));
    assert.ok(isPassThrough(r), `expected pass-through, got status ${r.status}`);
    assert.strictEqual(r.headers.get('cache-control'), 'private, no-store', 'Cache-Control');
    assert.strictEqual(r.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', 'X-Robots-Tag');
  });

  await check('every path under the guide is protected, including the raw file', async () => {
    for (const p of [GUIDE, GUIDE + '/', GUIDE + '/index.html', GUIDE + '/?x=1', GUIDE + '/anything/deeper'])
      assert.strictEqual((await proxy(req(p))).status, 401, `unprotected: ${p}`);
  });

  await check('public routes pass through untouched, with no auth and no added headers', async () => {
    for (const p of ['/', '/services/', '/contact/', '/blog/', '/blog/same-day-cleaning-kamloops/', '/house-cleaning-kamloops/',
      '/post-renovation-cleaning-kamloops/', '/api/quote', '/sitemap.xml', '/robots.txt', '/assets/js/pricing.js']) {
      const r = await proxy(req(p));
      assert.ok(isPassThrough(r), `${p} did not pass through (status ${r.status})`);
      assert.strictEqual(r.headers.get('www-authenticate'), null, `${p} got an auth challenge`);
      assert.strictEqual(r.headers.get('x-robots-tag'), null, `${p} got a noindex header`);
    }
  });

  await check('a path that merely starts with the same text is NOT protected', async () => {
    // /team-price-guide-public would be a different, public page.
    assert.ok(isPassThrough(await proxy(req('/team-price-guide-public/'))), 'prefix match leaked');
  });

  await check('the gate needs no environment variables at all', async () => {
    // Nothing TEAM_GUIDE_* is set anywhere in this process (cleared above), and
    // the correct pair still works while a wrong one is still refused.
    assert.deepStrictEqual(Object.keys(process.env).filter(k => k.startsWith('TEAM_GUIDE_')), [], 'a TEAM_GUIDE_* variable is set');
    assert.ok(isPassThrough(await proxy(req(GUIDE + '/', { authorization: basic(USER, PASS) }))), 'correct credentials refused');
    assert.strictEqual((await proxy(req(GUIDE + '/', { authorization: basic(USER, 'nope') }))).status, 401);
  });

  await check('credentials are stored as digests, never as literals, and read from no env var', () => {
    const src = read('proxy.ts');
    assert.ok(!/process\.env/.test(src), 'proxy.ts still reads process.env — the gate must be self-contained');
    const digests = src.match(/^const (?:USER|PASS)_SHA256 = '([0-9a-f]{64})';$/gm) || [];
    assert.strictEqual(digests.length, 2, 'expected exactly two SHA-256 digest constants');
    // The plaintext must not appear in the middleware itself.
    for (const literal of [`'${USER}'`, `"${USER}"`, `'${PASS}'`, `"${PASS}"`])
      assert.ok(!src.includes(literal), `proxy.ts contains the literal ${literal}`);
    // ...and the digests must actually be the digests of the documented pair.
    const sha = v => require('crypto').createHash('sha256').update(v, 'utf8').digest('hex');
    assert.ok(src.includes(sha(USER)), 'the username digest does not match the documented username');
    assert.ok(src.includes(sha(PASS)), 'the password digest does not match the documented password');
  });

  /* ── 2. ROUTE CONFIGURATION ────────────────────────────────────────────── */
  section('2. Vercel route configuration');
  await check('vercel.json points at proxy.ts and matches only the guide', () => {
    const cfg = JSON.parse(read('vercel.json'));
    assert.strictEqual(cfg.proxy.entrypoint, 'proxy.ts');
    assert.deepStrictEqual(cfg.proxy.matcher, ['/team-price-guide', '/team-price-guide/:path*']);
    assert.ok(fs.existsSync(path.join(ROOT, 'proxy.ts')), 'proxy.ts is missing');
    // Nothing else may be configured here by accident.
    assert.deepStrictEqual(Object.keys(cfg).sort(), ['$schema', 'proxy']);
  });
  await check('middleware stays ESM without forcing the project to ESM', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.strictEqual(pkg.type, undefined, 'package.json became an ES module — api/quote.js and the QA scripts are CommonJS');
    assert.ok(pkg.dependencies['@vercel/functions'], '@vercel/functions is not a dependency');
    assert.match(read('api/quote.js'), /module\.exports/, 'api/quote.js is no longer CommonJS');
  });

  /* ── 3. DISCOVERY SAFETY ───────────────────────────────────────────────── */
  section('3. The guide stays undiscoverable');
  const publicHtml = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'qa', 'team-price-guide'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) publicHtml.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  })(ROOT);

  await check(`no public page links to the guide (${publicHtml.length} pages scanned)`, () => {
    const linked = publicHtml.filter(f => read(f).includes(GUIDE));
    assert.deepStrictEqual(linked, [], `pages linking to the guide: ${linked.join(', ')}`);
  });
  await check('the guide is not in sitemap.xml', () => {
    assert.ok(!read('sitemap.xml').includes(GUIDE), 'sitemap advertises the internal route');
  });
  await check('robots.txt does not name the route (a Disallow line would publish it)', () => {
    assert.ok(!read('robots.txt').includes('team-price-guide'), 'robots.txt names the internal route');
  });
  await check('the guide itself is noindex, nofollow', () => {
    assert.match(read(GUIDE_FILE), /<meta name="robots" content="noindex, nofollow">/, 'noindex meta tag');
  });

  /* ── 4. THE GUIDE'S OWN INTEGRITY ──────────────────────────────────────── */
  section('4. Guide integrity');
  const guide = read(GUIDE_FILE);
  await check('title, phone number and logo are intact', () => {
    assert.match(guide, /<title>Team Price Guide · Urgent Clean<\/title>/, 'title');
    assert.match(guide, /href="tel:\+12508792425"/, 'phone link');
    assert.match(guide, /urgent-clean-main-logo\.png/, 'logo');
  });
  await check('the guide sends no analytics, makes no network calls and stores nothing', () => {
    for (const [re, what] of [[/googletagmanager|gtag\(|dataLayer|trackEvent/, 'analytics'],
      [/fetch\(|XMLHttpRequest|navigator\.sendBeacon/, 'network calls'],
      [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'client-side storage'],
      [/\/api\//, 'API calls']])
      assert.ok(!re.test(guide), `the guide contains ${what}`);
  });
  await check('the internal price table is present and is the guide\'s own (not imported)', () => {
    assert.match(guide, /const PRICES = \{/, 'PRICES object');
    assert.ok(!guide.includes('pricing.js') && !guide.includes('UrgentCleanPricing'),
      'the guide must not depend on the public pricing engine');
  });

  /* ── 5. NO SECRETS ─────────────────────────────────────────────────────── */
  section('5. The credentials stay in the middleware only');
  await check('no public file, the guide itself or the deploy config carries them', () => {
    for (const f of ['vercel.json', '.env.example', GUIDE_FILE, 'package.json', ...publicHtml]) {
      const src = read(f);
      assert.ok(!/TEAM_GUIDE_(USER|PASS)/.test(src), `${f} still references the removed TEAM_GUIDE_* variables`);
      // The gate is middleware-only — the password must never reach a browser.
      assert.ok(!new RegExp(`['"\`]${PASS}['"\`]`).test(src), `${f} contains the password literal`);
    }
    assert.ok(!fs.existsSync(path.join(ROOT, '.env')), 'a .env file exists in the project root');
    assert.ok(!/authorization|btoa\(/i.test(read(GUIDE_FILE)), 'the guide page must not do its own auth');
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log('  ✗ ' + f);
    process.exit(1);
  }
  console.log('TEAM GUIDE QA PASSED');
})();
