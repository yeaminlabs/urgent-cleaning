#!/usr/bin/env node
/* ============================================================================
   Pricing consistency — `npm run qa` (or `npm run qa:pricing`)
   ----------------------------------------------------------------------------
   Guards the single pricing source of truth, assets/js/pricing.js:

     1. The approved launch prices are exactly what pricing.js contains.
     2. pricing.js reproduces the original estimator for every reachable input
        (checked against a frozen copy of the pre-refactor formula).
     3. Every estimator page loads pricing.js and takes its extras from it.
     4. No page or script defines its own copy of the prices.
     5. Every price published in the site's HTML is registered below against
        the configuration it describes, and matches pricing.js for that
        configuration.

   Zero dependencies — Node built-ins only. Exits 1 on any failure.

   CHANGING PRICES ON PURPOSE: update pricing.js, update APPROVED below to the
   new approved values, then fix whatever section 5 reports as stale.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const Pricing = require(path.join(ROOT, 'assets/js/pricing.js'));

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('   ✓ ' + name); }
  catch (e) { failures.push(`${name}\n      ${e.message.split('\n').join('\n      ')}`); console.log('   ✗ ' + name); }
}
function section(title) { console.log(`\n${title}`); }
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const TYPES = ['standard', 'moveout', 'deep', 'postreno'];
const EXTRA_KEYS = ['fridge', 'oven', 'cabinets', 'laundry'];   // DOM order on every page

/* ── 1. APPROVED LAUNCH PRICES ───────────────────────────────────────────── */
const APPROVED = {
  BASE: { 1: 120, 2: 155, 3: 195, 4: 250, 5: 315 },
  BATH_X: 38,
  MULT: { standard: 1.0, moveout: 1.45, deep: 1.30, postreno: 1.65 },
  EXTRAS: { fridge: 35, oven: 30, cabinets: 50, laundry: 40 },
};
section('1. Approved constants');
check('BASE', () => assert.deepStrictEqual({ ...Pricing.BASE }, APPROVED.BASE));
check('BATH_X', () => assert.strictEqual(Pricing.BATH_X, APPROVED.BATH_X));
check('MULT', () => assert.deepStrictEqual({ ...Pricing.MULT }, APPROVED.MULT));
check('EXTRAS', () => assert.deepStrictEqual({ ...Pricing.EXTRAS }, APPROVED.EXTRAS));
check('constants are frozen (cannot be changed at runtime)', () => {
  for (const k of ['BASE', 'MULT', 'EXTRAS']) assert.ok(Object.isFrozen(Pricing[k]), k + ' is not frozen');
  assert.ok(Object.isFrozen(Pricing), 'API object is not frozen');
});

/* ── 2. PARITY WITH THE ORIGINAL ESTIMATOR ───────────────────────────────── */
/* Frozen copy of the pre-refactor formula exactly as it appeared in both
   index.html and service-page.js (extras were read from data-price attributes
   whose values equalled APPROVED.EXTRAS). Do not edit to make a test pass. */
function referenceEstimate(beds, stateBaths, type, extrasKeys) {
  const baths    = stateBaths || 1;
  const base     = APPROVED.BASE[beds];
  const bathAdd  = (baths - 1) * APPROVED.BATH_X;
  const extrasTotal = [...extrasKeys].reduce((s, k) => s + (APPROVED.EXTRAS[k] !== undefined ? APPROVED.EXTRAS[k] : 0), 0);
  const subtotal = base + bathAdd + extrasTotal;
  const raw      = subtotal * APPROVED.MULT[type];
  const lo       = Math.round(raw / 5) * 5;
  const hi       = Math.round(raw * 1.20 / 5) * 5;
  return { base, bathAdd, extrasTotal, subtotal, raw, low: lo, high: hi };
}
const subsets = [];
for (let mask = 0; mask < 16; mask++) subsets.push(EXTRA_KEYS.filter((_, i) => mask & (1 << i)));

section('2. Full estimator matrix vs the original formula');
let compared = 0;
check('every beds x baths x type x extras combination (incl. baths not chosen)', () => {
  for (const beds of [1, 2, 3, 4, 5])
    for (const baths of [null, 1, 2, 3, 4])
      for (const type of TYPES)
        for (const ex of subsets) {
          const want = referenceEstimate(beds, baths, type, ex);
          const got = Pricing.estimate(beds, baths, type, new Set(ex));
          for (const f of ['base', 'bathAdd', 'extrasTotal', 'subtotal', 'raw', 'low', 'high'])
            assert.strictEqual(got[f], want[f], `beds=${beds} baths=${baths} ${type} [${ex}] ${f}: ${got[f]} !== ${want[f]}`);
          compared++;
        }
});
check('extras order and container type do not change the result', () => {
  for (const ex of subsets) {
    const a = Pricing.estimate(3, 2, 'deep', ex), b = Pricing.estimate(3, 2, 'deep', [...ex].reverse()), c = Pricing.estimate(3, 2, 'deep', new Set(ex));
    assert.deepStrictEqual([a.low, a.high], [b.low, b.high]);
    assert.deepStrictEqual([a.low, a.high], [c.low, c.high]);
  }
});
console.log(`   ${compared} combinations compared field by field`);

/* The approved 1-bathroom, no-extras table (what the estimator shows). */
const TABLE = {
  standard: ['$120–$145', '$155–$185', '$195–$235', '$250–$300', '$315–$380'],
  moveout:  ['$175–$210', '$225–$270', '$285–$340', '$365–$435', '$455–$550'],
  deep:     ['$155–$185', '$200–$240', '$255–$305', '$325–$390', '$410–$490'],
  postreno: ['$200–$240', '$255–$305', '$320–$385', '$415–$495', '$520–$625'],
};
const range = r => `$${r.low}–$${r.high}`;
section('3. Approved price table (1 bathroom, no extras)');
for (const type of TYPES) check(`${type}: ${TABLE[type].join('  ')}`, () => {
  TABLE[type].forEach((want, i) => assert.strictEqual(range(Pricing.estimate(i + 1, 1, type)), want, `${i + 1} bed`));
});

section('4. Bathrooms, extras and rounding');
check('bathrooms 1-4 add $0 / $38 / $76 / $114 ("4+" is 4)', () =>
  [1, 2, 3, 4].forEach(b => assert.strictEqual(Pricing.estimate(2, b, 'standard').bathAdd, (b - 1) * 38)));
check('bathrooms not chosen count as 1', () =>
  [null, undefined, 0].forEach(b => assert.deepStrictEqual(range(Pricing.estimate(2, b, 'standard')), '$155–$185')));
check('no extras adds $0', () => assert.strictEqual(Pricing.estimate(2, 1, 'standard', []).extrasTotal, 0));
check('each extra adds its own price', () =>
  EXTRA_KEYS.forEach(k => assert.strictEqual(Pricing.estimate(2, 1, 'standard', [k]).extrasTotal, APPROVED.EXTRAS[k])));
check('all four extras add $155', () => assert.strictEqual(Pricing.estimate(2, 1, 'standard', EXTRA_KEYS).extrasTotal, 155));
check('fridge + cabinets (2-bed, 1-bath, standard) = $240–$290', () =>
  assert.strictEqual(range(Pricing.estimate(2, 1, 'standard', ['fridge', 'cabinets'])), '$240–$290'));
check('largest possible job (5+ bed, 4+ bath, all extras, post-reno) = $965–$1155', () =>
  assert.strictEqual(range(Pricing.estimate(5, 4, 'postreno', EXTRA_KEYS)), '$965–$1155'));
check('unknown extras key adds nothing', () => assert.strictEqual(Pricing.estimate(2, 1, 'standard', ['sauna']).extrasTotal, 0));
check('rounding: 1-bed deep raw $156 displays $155 (rounds down)', () => {
  const r = Pricing.estimate(1, 1, 'deep'); assert.strictEqual(r.raw, 156); assert.strictEqual(r.low, 155);
});
check('rounding: 1-bed move-out raw $174 displays $175 (rounds up)', () => {
  const r = Pricing.estimate(1, 1, 'moveout'); assert.strictEqual(r.raw, 174); assert.strictEqual(r.low, 175);
});
check('rounding: 2-bed move-out raw $224.75 displays $225–$270', () => {
  const r = Pricing.estimate(2, 1, 'moveout'); assert.ok(Math.abs(r.raw - 224.75) < 1e-9); assert.strictEqual(range(r), '$225–$270');
});
check('every low and high is a multiple of $5, high >= low', () => {
  for (const beds of [1, 2, 3, 4, 5]) for (const baths of [1, 2, 3, 4]) for (const type of TYPES) for (const ex of subsets) {
    const r = Pricing.estimate(beds, baths, type, ex);
    assert.ok(r.low % 5 === 0 && r.high % 5 === 0 && r.high >= r.low, `${beds}/${baths}/${type}/[${ex}] -> ${range(r)}`);
  }
});

section('5. Starting prices (studio/1-bed, 1 bath, no extras)');
const STARTING = { standard: 120, deep: 155, moveout: 175, postreno: 200 };
for (const [type, want] of Object.entries(STARTING))
  check(`startingFrom('${type}') = $${want}`, () => assert.strictEqual(Pricing.startingFrom(type), want));
check('startingFrom rejects types that have no pricing rule (rentalturnover, sameday, unknown)', () => {
  for (const t of ['rentalturnover', 'sameday', 'turnover', '']) assert.throws(() => Pricing.startingFrom(t), /Unknown pricing type/);
});

/* ── 3. EVERY ESTIMATOR PAGE ─────────────────────────────────────────────── */
/* Which clean type each estimator opens on. Rental Turnover and Same-Day have
   no pricing type of their own — they borrow moveout and standard. */
const ESTIMATOR_PAGES = {
  'index.html':                                     null,        // homepage: nothing preselected
  'house-cleaning-kamloops/index.html':             'standard',
  'deep-cleaning-kamloops/index.html':              'deep',
  'same-day-cleaning-kamloops/index.html':          'standard',  // no same-day surcharge
  'move-out-cleaning-kamloops/index.html':          'moveout',
  'rental-turnover-cleaning-kamloops/index.html':   'moveout',   // priced as a move-out clean
  'post-renovation-cleaning-kamloops/index.html':   'postreno',
};
const allHtml = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'qa'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) allHtml.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

section('6. Estimator pages');
check('exactly the expected pages host an estimator', () => {
  const found = allHtml.filter(f => read(f).includes('id="qc-price"')).sort();
  assert.deepStrictEqual(found, Object.keys(ESTIMATOR_PAGES).sort());
});
for (const [file, preselect] of Object.entries(ESTIMATOR_PAGES)) {
  const h = read(file);
  const label = file.replace('/index.html', '/');
  check(`${label} loads pricing.js before the estimator code`, () => {
    const p = h.indexOf('<script src="/assets/js/pricing.js"');
    assert.ok(p !== -1, 'pricing.js is not loaded');
    if (file === 'index.html') {
      // Anchor on the consumer itself — "QUOTE CALCULATOR" also appears in CSS.
      const inline = h.indexOf('const Pricing = window.UrgentCleanPricing');
      assert.ok(inline !== -1, 'homepage estimator does not read window.UrgentCleanPricing');
      assert.ok(p < inline, 'pricing.js loads after the inline estimator');
      assert.ok(!/<script src="\/assets\/js\/pricing\.js"[^>]*\b(defer|async)\b/.test(h), 'homepage must load pricing.js synchronously (the inline script runs at parse time)');
    } else {
      const s = h.indexOf('<script src="/assets/js/service-page.js"');
      assert.ok(s !== -1 && p < s, 'pricing.js must come before service-page.js');
    }
  });
  check(`${label} extras buttons match EXTRAS (keys, order, labels; no data-price)`, () => {
    const block = (h.match(/id="qc-extras"[\s\S]*?<\/div>/) || [''])[0];
    const buttons = [...block.matchAll(/<button class="qc-toggle" data-val="([a-z]+)"([^>]*)>[\s\S]*?class="qc-toggle-price">([^<]*)</g)];
    assert.deepStrictEqual(buttons.map(b => b[1]), EXTRA_KEYS, 'extras keys/order');
    for (const [, key, attrs, labelText] of buttons) {
      assert.ok(!/data-price/.test(attrs), `${key}: stale data-price attribute`);
      assert.strictEqual(labelText, '+$' + Pricing.EXTRAS[key], `${key}: HTML fallback label "${labelText}" != EXTRAS`);
    }
  });
  check(`${label} opens on ${preselect || 'no preselected type'} and offers all four clean types`, () => {
    const m = h.match(/id="qc-condition"[^>]*data-preselect="([^"]+)"/);
    assert.strictEqual(m ? m[1] : null, preselect);
    const group = (h.match(/id="qc-condition"[\s\S]*?<\/div>/) || [''])[0];   // buttons hold spans only
    assert.deepStrictEqual([...group.matchAll(/data-val="([a-z]+)"/g)].map(x => x[1]), TYPES);
  });
}

/* ── 4. SINGLE SOURCE OF TRUTH ───────────────────────────────────────────── */
section('7. No duplicate pricing engine');
const codeFiles = ['assets/js/service-page.js', ...allHtml];
const DUPLICATE_SIGNS = [
  [/\bBATH_X\s*=/, 'BATH_X definition'],
  [/\{\s*1\s*:\s*120\s*,\s*2\s*:\s*155/, 'BASE price table'],
  [/moveout\s*:\s*1\.45/, 'MULT table'],
  [/Math\.round\(raw\s*\/\s*5\)/, 'estimate rounding formula'],
  [/dataset\.price|data-price=/, 'data-price extras source'],
];
for (const f of codeFiles) check(`${f.replace('/index.html', '/')} has no pricing constants or formula`, () => {
  const src = read(f);
  for (const [re, what] of DUPLICATE_SIGNS) assert.ok(!re.test(src), `contains a ${what} — prices must live only in assets/js/pricing.js`);
});

/* ── 5. PUBLISHED PRICES ─────────────────────────────────────────────────── */
/* Every price range written into the site's HTML, pinned to the configuration
   it describes. A range is checked against pricing.js for THAT configuration —
   "$155–$185" is also what a 1-bed deep clean costs, so matching the number
   alone would prove nothing. `count` includes the FAQ JSON-LD copy.

   Adding "starting from" copy later? Register it here (kind: 'from'). Any
   price in the HTML that is not registered fails this check. */
const PUBLISHED = [
  { file: 'index.html', kind: 'range', beds: 2, baths: 1, type: 'standard', count: 2,
    where: 'homepage FAQ "How much does house cleaning in Kamloops cost?" (visible + JSON-LD)' },
  { file: 'index.html', kind: 'range', beds: 2, baths: 1, type: 'moveout', count: 2,
    where: 'homepage FAQ, same answer (visible + JSON-LD)' },
  { file: 'house-cleaning-kamloops/index.html', kind: 'range', beds: 2, baths: 1, type: 'standard', count: 2,
    where: 'House Cleaning FAQ "How much does house cleaning cost in Kamloops?" (visible + JSON-LD)' },
];
const decode = s => s.replace(/&ndash;|&#8211;|&#x2013;/gi, '–').replace(/&mdash;|&#8212;/gi, '—').replace(/&#36;|&dollar;/gi, '$');
section('8. Published prices vs pricing.js');
for (const entry of PUBLISHED) {
  const expected = entry.kind === 'from' ? `$${Pricing.startingFrom(entry.type)}` : range(Pricing.estimate(entry.beds, entry.baths, entry.type));
  check(`${entry.file.replace('/index.html', '/')}: ${entry.beds}-bed/${entry.baths}-bath ${entry.type} = ${expected} (x${entry.count}) — ${entry.where}`, () => {
    const h = decode(read(entry.file));
    const n = h.split(expected).length - 1;
    assert.strictEqual(n, entry.count, `found ${n} time(s); the page is stale or the registry needs updating`);
  });
}
check('no unregistered prices anywhere in the site HTML', () => {
  const problems = [];
  for (const f of allHtml) {
    let h = decode(read(f));
    // registered ranges for this file are accounted for
    for (const e of PUBLISHED.filter(e => e.file === f)) {
      const v = e.kind === 'from' ? `$${Pricing.startingFrom(e.type)}` : range(Pricing.estimate(e.beds, e.baths, e.type));
      h = h.split(v).join('');
    }
    // extras labels are verified in section 6
    h = h.replace(/class="qc-toggle-price">\+\$\d+</g, '');
    for (const m of h.matchAll(/\$\s?\d[\d,]*(?:\s*[–—-]\s*\$?\s?\d[\d,]*)?/g)) problems.push(`${f}: "${m[0]}"`);
  }
  assert.strictEqual(problems.length, 0, 'unregistered or stale price(s):\n' + problems.join('\n'));
});

/* ── RESULT ──────────────────────────────────────────────────────────────── */
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('PRICING QA PASSED');
