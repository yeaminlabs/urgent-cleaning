#!/usr/bin/env node
/* ============================================================================
   Pricing consistency — `npm run qa` (or `npm run qa:pricing`)
   ----------------------------------------------------------------------------
   Guards the single pricing source of truth, assets/js/pricing.js, which holds
   explicit price tables copied from the internal Team Price Guide:

     1. The canonical tables are exactly the approved figures.
     2. The arithmetic on top of them (add-on quantities, rush fees) is correct,
        including every worked example the pricing decision was signed off with.
     3. Nothing is priced that the business has not priced: a tier with no
        number, a custom add-on and post-renovation work all route to a quote
        instead of producing an invented amount.
     4. The retired model cannot come back — no bedroom base table, no bathroom
        increment, no clean-type multiplier, no automatic +20% range.
     5. Every estimator page loads the component correctly and renders its
        options from pricing.js rather than hard-coding them.
     6. Every price published in the site's HTML is either a starting price
        bound to a service, or registered below against the exact service and
        size tier it describes — and matches pricing.js for that tier.

   Zero dependencies — Node built-ins only. Exits 1 on any failure.

   CHANGING PRICES ON PURPOSE: update pricing.js, update APPROVED below to the
   new approved figures, then fix whatever sections 7-9 report as stale.
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
const money = n => '$' + Number(n).toLocaleString('en-US');

/* ── 1. THE CANONICAL TABLES ──────────────────────────────────────────────
   Transcribed from the approved Team Price Guide. Do not edit either side to
   make the other pass: change pricing.js and this together, deliberately. */
const APPROVED = {
  SIZES: ['studio', '1bed', '2bed', '3bed', '4bed', '5plus'],
  FLAT: {
    standard: [125, 150, 175, 200, 250, 350],
    deep:     [175, 200, 260, 350, 450, 550],
    moveout:  [195, 235, 295, 395, 495, 595],
  },
  TURNOVER_SIZES: ['t-studio', 't-2bed', 't-3bed', 't-4bed', 't-5plus'],
  TURNOVER: [110, 145, 185, 225, null],
  ADDONS: {
    oven: 20, fridge: 20, cabinets: 20,
    laundry: 30, 'laundry-extra': 15,
    linen: 10, windows: 10, patio: 10,
    'pet-hair': 25,
    grease: null, walls: null,               // quoted per job
  },
  QTY_ADDONS: { 'laundry-extra': 'load', linen: 'bed', windows: 'window', patio: 'door' },
  RUSH: {
    normal:    [0, 0],
    'rush-24h': [0.15, 50],
    'rush-6h':  [0.20, 60],
    'rush-3h':  [0.30, 70],
    overnight:  [0.35, 70],
  },
  STARTING: { standard: 125, deep: 175, moveout: 195, turnover: 110 },
  QUOTED_PER_JOB: ['postreno'],
};
const FLAT_SERVICES = Object.keys(APPROVED.FLAT);
const SERVICE_IDS = [...FLAT_SERVICES, 'turnover'];

section('1. Canonical price tables');
check('size tiers (ids and order)', () => {
  assert.deepStrictEqual(Pricing.SIZES.map(s => s.id), APPROVED.SIZES);
  assert.deepStrictEqual(Pricing.TURNOVER_SIZES.map(s => s.id), APPROVED.TURNOVER_SIZES);
  for (const s of [...Pricing.SIZES, ...Pricing.TURNOVER_SIZES])
    assert.ok(s.label && s.label.trim(), `${s.id} has no label`);
});
for (const t of FLAT_SERVICES) check(`${t}: ${APPROVED.FLAT[t].map(money).join('  ')}`, () =>
  assert.deepStrictEqual([...Pricing.FLAT[t]], APPROVED.FLAT[t]));
check(`turnover: ${APPROVED.TURNOVER.map(v => v === null ? 'custom' : money(v)).join('  ')}`, () =>
  assert.deepStrictEqual([...Pricing.TURNOVER], APPROVED.TURNOVER));
check('services offered by the estimator', () =>
  assert.deepStrictEqual(Pricing.SERVICES.map(s => s.id), SERVICE_IDS));
check('add-on prices (and which are quoted per job)', () => {
  const got = {};
  for (const a of Pricing.ADDONS) got[a.id] = a.price;
  assert.deepStrictEqual(got, APPROVED.ADDONS);
});
check('only the per-unit add-ons take a quantity, with the right unit', () => {
  const got = {};
  for (const a of Pricing.ADDONS) if (a.qty) got[a.id] = a.unit;
  assert.deepStrictEqual(got, APPROVED.QTY_ADDONS);
});
check('rush tiers (percentage and minimum)', () => {
  const got = {};
  for (const r of Pricing.RUSH) got[r.id] = [r.pct, r.min];
  assert.deepStrictEqual(got, APPROVED.RUSH);
});
check('the tables cannot be changed at runtime', () => {
  for (const k of ['SIZES', 'TURNOVER_SIZES', 'SERVICES', 'FLAT', 'TURNOVER', 'ADDONS', 'RUSH', 'DISPLAY'])
    assert.ok(Object.isFrozen(Pricing[k]), k + ' is not frozen');
  for (const t of FLAT_SERVICES) assert.ok(Object.isFrozen(Pricing.FLAT[t]), `FLAT.${t} is not frozen`);
  assert.ok(Object.isFrozen(Pricing), 'API object is not frozen');
});

/* ── 2. BASE PRICES ─────────────────────────────────────────────────────── */
section('2. Base price per service and size');
check('every service x size returns its table figure', () => {
  for (const t of FLAT_SERVICES)
    APPROVED.SIZES.forEach((size, i) => {
      const b = Pricing.basePrice(t, size);
      assert.strictEqual(b.amount, APPROVED.FLAT[t][i], `${t}/${size}`);
      assert.strictEqual(b.custom, false, `${t}/${size} should be priced`);
    });
  APPROVED.TURNOVER_SIZES.forEach((size, i) => {
    const b = Pricing.basePrice('turnover', size);
    assert.strictEqual(b.amount, APPROVED.TURNOVER[i], `turnover/${size}`);
  });
});
check('only the flat 5+ tier is an open-ended "from" price', () => {
  for (const t of FLAT_SERVICES) {
    for (const size of APPROVED.SIZES.slice(0, -1))
      assert.strictEqual(Pricing.basePrice(t, size).open, false, `${t}/${size} must be an exact price`);
    assert.strictEqual(Pricing.basePrice(t, '5plus').open, true, `${t}/5plus must be a "from" price`);
  }
});
check('turnover 5+ is a custom quote, not a number', () => {
  const b = Pricing.basePrice('turnover', 't-5plus');
  assert.strictEqual(b.amount, null);
  assert.strictEqual(b.custom, true);
  assert.strictEqual(b.open, false, 'a custom quote must not also claim to be a "from" price');
  assert.strictEqual(Pricing.estimate({ service: 'turnover', size: 't-5plus' }).quoteOnly, true);
});
check('an unknown service or size prices nothing', () => {
  for (const [s, z] of [['sauna', '2bed'], ['standard', '9bed'], ['turnover', '2bed'], ['standard', 't-2bed'], [null, null]])
    assert.strictEqual(Pricing.basePrice(s, z), null, `${s}/${z} must not resolve`);
});
check('each service offers only its own size tiers', () => {
  for (const t of FLAT_SERVICES) assert.deepStrictEqual(Pricing.sizesFor(t).map(s => s.id), APPROVED.SIZES);
  assert.deepStrictEqual(Pricing.sizesFor('turnover').map(s => s.id), APPROVED.TURNOVER_SIZES);
});

/* ── 3. ADD-ONS ─────────────────────────────────────────────────────────── */
section('3. Add-on arithmetic');
const est = (service, size, addons, timing) => Pricing.estimate({ service, size, addons, timing });
check('one of each fixed-price add-on adds its own price', () => {
  for (const [id, price] of Object.entries(APPROVED.ADDONS)) {
    if (price === null) continue;
    assert.strictEqual(est('standard', '2bed', { [id]: 1 }).addonsTotal, price, id);
  }
});
check('per-unit add-ons multiply by quantity; the others do not', () => {
  for (const [id, price] of Object.entries(APPROVED.ADDONS)) {
    if (price === null) continue;
    const want = APPROVED.QTY_ADDONS[id] ? price * 3 : price;
    assert.strictEqual(est('standard', '2bed', { [id]: 3 }).addonsTotal, want, `${id} x3`);
  }
});
check('worked example: 2-bed standard + inside oven = $195', () =>
  assert.strictEqual(est('standard', '2bed', { oven: 1 }).total, 195));
check('worked example: 2-bed standard + oven + fridge = $215', () =>
  assert.strictEqual(est('standard', '2bed', { oven: 1, fridge: 1 }).total, 215));
check('worked example: laundry first load $30 + 2 extra loads $30 = $60', () => {
  const r = est('standard', '2bed', { laundry: 1, 'laundry-extra': 2 });
  assert.strictEqual(r.addonsTotal, 60);
  assert.strictEqual(r.total, 235);
});
check('a custom-priced add-on is listed but never given an amount', () => {
  const r = est('standard', '2bed', { grease: 1, walls: 1 });
  assert.strictEqual(r.addonsTotal, 0, 'custom add-ons must not contribute a guessed amount');
  assert.strictEqual(r.pricedSubtotal, 175, 'custom add-ons must stay out of the priced subtotal');
  assert.strictEqual(r.total, 175);
  assert.strictEqual(r.hasCustom, true, 'the result must declare that something needs quoting');
  assert.deepStrictEqual(r.custom, ['Heavy grease', 'Wall washing']);
  for (const line of r.addons) assert.strictEqual(line.amount, null);
});
check('zero, negative, fractional and unknown quantities are ignored', () => {
  for (const addons of [{ oven: 0 }, { oven: -3 }, { oven: 0.6 }, { sauna: 2 }, { oven: NaN }, { oven: 'x' }])
    assert.strictEqual(est('standard', '2bed', addons).addonsTotal, 0, JSON.stringify(addons));
  assert.strictEqual(est('standard', '2bed', { windows: -5 }).addons.length, 0, 'a negative quantity must not appear as a line');
});
check('add-on lines come back in table order regardless of selection order', () => {
  const order = Pricing.ADDONS.map(a => a.id);
  const pick = { walls: 1, oven: 1, linen: 2, fridge: 1 };
  const got = est('standard', '2bed', pick).addons.map(l => l.id);
  assert.deepStrictEqual(got, order.filter(id => pick[id]));
});

/* ── 4. RUSH FEES ───────────────────────────────────────────────────────── */
section('4. Rush fees (max of percentage and minimum)');
check('normal booking adds nothing, at any subtotal', () => {
  for (const sub of [0, 110, 350, 1200]) assert.strictEqual(Pricing.rushFee('normal', sub), 0, `subtotal ${sub}`);
});
check('fee = max(pct x priced subtotal, minimum) for every tier', () => {
  for (const [id, [pct, min]] of Object.entries(APPROVED.RUSH)) {
    if (!pct) continue;
    for (const sub of [0, 100, 175, 300, 500, 1000, 2500])
      assert.strictEqual(Pricing.rushFee(id, sub), Math.max(Math.round(sub * pct), min), `${id} @ ${sub}`);
  }
});
check('worked example: $200 subtotal within 24h -> the $50 minimum (not $30)', () =>
  assert.strictEqual(Pricing.rushFee('rush-24h', 200), 50));
check('worked example: $500 subtotal within 24h -> $75 (the percentage)', () =>
  assert.strictEqual(Pricing.rushFee('rush-24h', 500), 75));
check('worked example: $500 subtotal under 3h -> $150 (the percentage)', () =>
  assert.strictEqual(Pricing.rushFee('rush-3h', 500), 150));
check('the rush fee is charged on base + priced add-ons together', () => {
  const r = est('deep', '3bed', { oven: 1, linen: 2 }, 'rush-6h');
  assert.strictEqual(r.pricedSubtotal, 350 + 20 + 20);
  assert.strictEqual(r.rush.fee, Math.max(Math.round(390 * 0.20), 60));
  assert.strictEqual(r.total, 390 + r.rush.fee);
});
check('custom-priced add-ons never inflate a rush fee', () => {
  const plain = est('standard', 'studio', {}, 'rush-3h');
  const withCustom = est('standard', 'studio', { grease: 1, walls: 1 }, 'rush-3h');
  assert.strictEqual(withCustom.rush.fee, plain.rush.fee, 'a quote-only item changed the rush fee');
});
check('a tier with no base price carries no rush fee', () => {
  const r = est('turnover', 't-5plus', { oven: 1 }, 'overnight');
  assert.strictEqual(r.rush.fee, 0, 'nothing is priced, so there is nothing to surcharge');
  assert.strictEqual(r.quoteOnly, true);
});
check('an unknown timing falls back to a normal booking', () => {
  for (const t of ['tomorrow', '', null, undefined])
    assert.strictEqual(est('standard', '2bed', {}, t).rush.fee, 0, String(t));
  assert.strictEqual(Pricing.rushFee('tomorrow', 500), 0);
});
check('every reachable combination totals base + add-ons + rush exactly', () => {
  let n = 0;
  const addonSets = [{}, { oven: 1 }, { windows: 4 }, { laundry: 1, 'laundry-extra': 2 }, { grease: 1 }, { oven: 1, fridge: 1, cabinets: 1, 'pet-hair': 1, linen: 3 }];
  for (const s of SERVICE_IDS)
    for (const size of Pricing.sizesFor(s).map(x => x.id))
      for (const addons of addonSets)
        for (const timing of Object.keys(APPROVED.RUSH)) {
          const r = est(s, size, addons, timing);
          assert.strictEqual(r.total, r.pricedSubtotal + r.rush.fee, `${s}/${size}/${timing}`);
          assert.ok(Number.isInteger(r.total) && r.total >= 0, `${s}/${size}/${timing} -> ${r.total}`);
          if (r.quoteOnly) assert.strictEqual(r.total, r.addonsTotal, 'an unpriced tier must only ever total its add-ons');
          n++;
        }
  console.log(`   ${n} combinations checked field by field`);
});

/* ── 5. WHAT IS NOT PRICED ──────────────────────────────────────────────── */
section('5. Work that must route to a quote');
for (const [t, want] of Object.entries(APPROVED.STARTING))
  check(`startingFrom('${t}') = ${money(want)}`, () => assert.strictEqual(Pricing.startingFrom(t), want));
check('post-renovation is quoted per job and has no starting price to print', () => {
  for (const t of APPROVED.QUOTED_PER_JOB) {
    assert.strictEqual(Pricing.priceModel(t), 'custom', `${t} is no longer quoted per job`);
    assert.throws(() => Pricing.startingFrom(t), /No flat starting price/, `startingFrom('${t}') returned a number`);
  }
});
check('startingFrom rejects anything with no pricing rule at all', () => {
  for (const t of ['rentalturnover', 'sameday', 'commercial', 'windows-exterior', '', null])
    assert.throws(() => Pricing.startingFrom(t), /Unknown service/, String(t));
});
check('a starting price is always the cheapest tier of its own table', () => {
  for (const t of Object.keys(APPROVED.STARTING)) {
    const prices = Pricing.sizesFor(t).map(s => Pricing.basePrice(t, s.id).amount).filter(v => v !== null);
    assert.strictEqual(Pricing.startingFrom(t), Math.min(...prices), t);
  }
});

/* ── 6. THE RETIRED MODEL MUST NOT COME BACK ────────────────────────────── */
/* The old estimator multiplied a bedroom base by a clean-type factor, added a
   per-bathroom increment and padded the result by 20% to make a "range". Those
   mechanics, and the extras prices that went with them, are gone. Each pattern
   below is one of them reappearing. */
const PRIVATE_DIRS = ['team-price-guide'];
const allHtml = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'qa', ...PRIVATE_DIRS].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) allHtml.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);
const SCRIPTS = ['assets/js/pricing.js', 'assets/js/estimator.js', 'assets/js/service-page.js'];

section('6. The retired formula model stays retired');
const RETIRED = [
  [/\bBATH_X\b/, 'bathroom increment constant'],
  [/\bbathAdd\b/, 'bathroom surcharge term'],
  [/\bMULT\b|moveout\s*:\s*1\.45|postreno\s*:\s*1\.65/, 'clean-type multiplier table'],
  [/\{\s*1\s*:\s*120\s*,\s*2\s*:\s*155/, 'bedroom base price table'],
  [/Math\.round\(\s*raw\s*\/\s*5\s*\)/, 'the old /5 rounding formula'],
  [/\*\s*1\.20?\b(?!\d)/, 'the automatic +20% range'],
  [/\bestimate_low\b|\bestimate_high\b/, 'a dollar amount reported to analytics'],
  [/data-price=|dataset\.price/, 'data-price extras source'],
  [/id="qc-(beds|baths|extras|condition)"/, 'a control from the retired estimator'],
  [/\bsyncExtraLabels\b/, 'the retired extras-label sync'],
];
for (const f of [...SCRIPTS, ...allHtml]) check(`${f.replace('/index.html', '/')} is free of the retired model`, () => {
  const src = read(f);
  for (const [re, what] of RETIRED) {
    const hit = src.match(re);
    assert.ok(!hit, `contains ${what}: "${hit && hit[0]}"`);
  }
});
check('the retired extras prices appear nowhere public', () => {
  for (const f of [...SCRIPTS, ...allHtml]) {
    const src = read(f);
    for (const v of [35, 38, 40, 50]) {
      const hit = src.match(new RegExp(`\\+?\\$${v}\\b`));
      assert.ok(!hit, `${f}: "${hit && hit[0]}" is a price from the retired model`);
    }
  }
});
check('no file other than pricing.js contains a copy of a canonical table', () => {
  const sig = [/125\s*,\s*150\s*,\s*175/, /175\s*,\s*200\s*,\s*260/, /195\s*,\s*235\s*,\s*295/, /110\s*,\s*145\s*,\s*185/];
  for (const f of [...SCRIPTS.filter(s => s !== 'assets/js/pricing.js'), ...allHtml])
    for (const re of sig) assert.ok(!re.test(read(f)), `${f} duplicates a price table — prices live only in assets/js/pricing.js`);
});

/* The internal team price guide is deliberately NOT a public page: it is behind
   HTTP Basic Auth (proxy.ts), carries its own staff rate card, and is allowed
   to differ from the public tables. Scanning it here would force internal rates
   to be registered against pricing.js, which is exactly the coupling we do not
   want. Its own guard is qa/team-guide-auth.js, which proves it stays private
   and keeps its prices self-contained. Public pages remain fully covered. */
check('the only HTML skipped by this suite is the private, authenticated guide', () => {
  for (const dir of PRIVATE_DIRS) {
    const p = path.join(ROOT, dir);
    assert.ok(fs.existsSync(p), `${dir}/ does not exist — remove it from PRIVATE_DIRS`);
    const cfg = JSON.parse(read('vercel.json'));
    assert.ok(cfg.proxy && cfg.proxy.matcher.some(m => m.startsWith('/' + dir)),
      `${dir}/ is skipped here but no longer protected by vercel.json`);
    assert.ok(!read('sitemap.xml').includes('/' + dir), `${dir}/ appears in sitemap.xml`);
    for (const f of allHtml) assert.ok(!read(f).includes('/' + dir + '/'), `${f} links to the private ${dir}/`);
  }
});

/* ── 7. ESTIMATOR PAGES ─────────────────────────────────────────────────── */
/* Which service each calculator opens on. Same-Day opens on `standard`: it is
   the clean type that is priced, and how soon it is needed is the timing step.
   Post-renovation has no calculator at all — see POST_RENO_PAGE below. */
const CALCULATOR_PAGES = {
  'index.html':                                   null,         // homepage: nothing preselected
  'house-cleaning-kamloops/index.html':           'standard',
  'deep-cleaning-kamloops/index.html':            'deep',
  'same-day-cleaning-kamloops/index.html':        'standard',
  'move-out-cleaning-kamloops/index.html':        'moveout',
  'rental-turnover-cleaning-kamloops/index.html': 'turnover',
};
const POST_RENO_PAGE = 'post-renovation-cleaning-kamloops/index.html';
/* The ids assets/js/estimator.js reads. If one is renamed in the markup the
   step silently disappears, so the contract is pinned here. */
const CONTRACT_IDS = ['qc-service', 'qc-size', 'qc-addons', 'qc-more', 'qc-timing', 'qc-price', 'qc-note', 'qc-breakdown', 'qc-request-quote'];

section('7. Estimator pages');
check('exactly the expected pages host a calculator', () => {
  const found = allHtml.filter(f => read(f).includes('id="qc-service"')).sort();
  assert.deepStrictEqual(found, Object.keys(CALCULATOR_PAGES).sort());
});
check('the estimator component reads only ids the pages actually provide', () => {
  const src = read('assets/js/estimator.js');
  for (const id of CONTRACT_IDS) assert.ok(src.includes(`'${id}'`), `estimator.js no longer reads #${id}`);
});
for (const [file, preselect] of Object.entries(CALCULATOR_PAGES)) {
  const h = read(file);
  const label = file.replace('/index.html', '/');
  check(`${label} provides the full markup contract`, () => {
    for (const id of CONTRACT_IDS) assert.ok(h.includes(`id="${id}"`), `missing #${id}`);
  });
  check(`${label} loads pricing.js, then estimator.js, before the page script`, () => {
    const p = h.indexOf('<script src="/assets/js/pricing.js"');
    const e = h.indexOf('<script src="/assets/js/estimator.js"');
    assert.ok(p !== -1, 'pricing.js is not loaded');
    assert.ok(e !== -1, 'estimator.js is not loaded');
    assert.ok(p < e, 'estimator.js must come after pricing.js — it reads the tables at load');
    assert.ok(/<script src="\/assets\/js\/estimator\.js"[^>]*\bdefer\b/.test(h), 'estimator.js must be deferred (it needs the DOM)');
    if (file !== 'index.html') {
      const s = h.indexOf('<script src="/assets/js/service-page.js"');
      assert.ok(s !== -1 && e < s, 'estimator.js must come before service-page.js');
    }
  });
  check(`${label} opens on ${preselect || 'no preselected service'}`, () => {
    const m = h.match(/id="qc-service"[^>]*data-preselect="([^"]+)"/);
    assert.strictEqual(m ? m[1] : null, preselect);
    if (preselect) assert.ok(Pricing.SERVICES.some(s => s.id === preselect), `"${preselect}" is not a service in pricing.js`);
  });
  check(`${label} hard-codes no option, price or label from pricing.js`, () => {
    for (const id of ['qc-service', 'qc-size', 'qc-addons', 'qc-timing']) {
      const block = (h.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</div>`)) || ['', ''])[1];
      assert.strictEqual(block.trim(), '', `#${id} ships markup from the server; the component renders it`);
    }
    for (const a of Pricing.ADDONS) assert.ok(!h.includes(a.label), `the "${a.label}" add-on label is hard-coded`);
    for (const r of Pricing.RUSH) assert.ok(!h.includes(r.label), `the "${r.label}" timing label is hard-coded`);
  });
}
check(`${POST_RENO_PAGE.replace('/index.html', '/')} offers a quote request, not a calculator`, () => {
  const h = read(POST_RENO_PAGE);
  for (const id of ['qc-service', 'qc-size', 'qc-addons', 'qc-timing', 'qc-price'])
    assert.ok(!h.includes(`id="${id}"`), `#${id} is present — this service is quoted per job`);
  assert.ok(!h.includes('assets/js/estimator.js'), 'the calculator component is still loaded');
  assert.ok(/quoted per job/i.test(h), 'the page does not say the work is quoted per job');
  /* .ready is required: a .qc-cta without it is transparent and ignores
     pointer events, so the only call to action on the page would be dead. */
  assert.ok(/<a href="#contact"[^>]*class="qc-cta ready"/.test(h), 'no usable quote-request call to action in the pricing panel');
});

/* ── 8. PUBLISHED PRICES ────────────────────────────────────────────────── */
/* Every exact amount written into the site's HTML, pinned to the service and
   size tier it describes. The amount is checked against pricing.js for THAT
   tier — $175 is both a 2-bed standard clean and the deep-clean starting
   price, so matching the number alone would prove nothing.
   Starting prices ("from $X") are not registered here: they are bound to a
   service in the markup and checked in section 9. */
const PUBLISHED = [
  { file: 'index.html', service: 'standard', size: '2bed', count: 1,
    where: 'homepage FAQ "How much does house cleaning in Kamloops cost?"' },
  { file: 'index.html', service: 'moveout', size: '2bed', count: 1,
    where: 'homepage FAQ, same answer' },
  { file: 'house-cleaning-kamloops/index.html', service: 'standard', size: '2bed', count: 1,
    where: 'House Cleaning cost FAQ' },
  { file: 'deep-cleaning-kamloops/index.html', service: 'deep', size: '2bed', count: 1,
    where: 'Deep Cleaning cost FAQ' },
  { file: 'move-out-cleaning-kamloops/index.html', service: 'moveout', size: '2bed', count: 1,
    where: 'Move-Out cost FAQ' },
  { file: 'rental-turnover-cleaning-kamloops/index.html', service: 'turnover', size: 't-2bed', count: 1,
    where: 'Rental Turnover cost FAQ' },
  { file: 'rental-turnover-cleaning-kamloops/index.html', service: 'turnover', size: 't-3bed', count: 1,
    where: 'Rental Turnover cost FAQ' },
];
const STARTING_EL = /<strong data-starting-from="([a-z]*)">([^<]*)<\/strong>/g;
const decode = s => s.replace(/&ndash;|&#8211;|&#x2013;/gi, '–').replace(/&mdash;|&#8212;/gi, '—').replace(/&#36;|&dollar;/gi, '$');
const norm = s => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/* A FAQPage answer repeats its visible paragraph verbatim; qa/site-integrity.js
   proves the two are byte-identical. Drop the JSON-LD copy so its prices are
   not reported a second time — but only where it really does mirror a visible
   paragraph, so a price that exists ONLY in the schema is still caught.

   The edit is confined to the <script type="application/ld+json"> blocks. An
   answer with no inline markup is character-for-character identical to its
   visible paragraph, so a whole-document replace would delete the visible copy
   too and the price would go unchecked in both places. */
function withoutSchemaMirrors(f) {
  const raw = read(f);
  const visible = new Set();
  for (const m of raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = norm(m[1]);
    if (t) visible.add(t);
  }
  const h = raw.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, block => {
    let b = block;
    for (const m of block.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g)) {
      let text;
      try { text = JSON.parse('"' + m[1] + '"'); } catch { continue; }
      if (visible.has(norm(text))) b = b.split(m[1]).join('');
    }
    return b;
  });
  return decode(h);
}
/* Starting prices are verified in section 9. Only a CORRECT one is removed
   here, so a stale one is reported by both sections, never by neither. */
const stripStarting = h => h.replace(STARTING_EL, (el, service, text) => {
  let want;
  try { want = money(Pricing.startingFrom(service)); } catch { return el; }
  return text === want ? '' : el;
});
const scannable = f => stripStarting(withoutSchemaMirrors(f));

section('8. Published prices vs pricing.js');
for (const e of PUBLISHED) {
  const want = money(Pricing.basePrice(e.service, e.size).amount);
  check(`${e.file.replace('/index.html', '/')}: ${e.service}/${e.size} = ${want} (x${e.count}) — ${e.where}`, () => {
    const h = scannable(e.file);
    const n = h.split(want).length - 1;
    assert.strictEqual(n, e.count, `found ${n} time(s); the page is stale or the registry needs updating`);
  });
}
check('no unregistered or stale price anywhere in the site HTML', () => {
  const problems = [];
  for (const f of allHtml) {
    let h = scannable(f);
    for (const e of PUBLISHED.filter(e => e.file === f)) h = h.split(money(Pricing.basePrice(e.service, e.size).amount)).join('');
    for (const m of h.matchAll(/\$\s?\d[\d,]*(?:\s*[–—-]\s*\$?\s?\d[\d,]*)?/g)) problems.push(`${f}: "${m[0]}"`);
  }
  assert.strictEqual(problems.length, 0, 'unregistered or stale price(s):\n' + problems.join('\n'));
});
check('no page publishes a price range the estimator cannot produce', () => {
  /* The retired engine printed "$155–$185" everywhere. A size tier is now one
     price, so a two-ended money range in the copy is stale by construction. */
  for (const f of allHtml) {
    const hit = decode(read(f)).replace(/<[^>]+>/g, ' ').match(/\$\s?\d[\d,]*\s*[–—]\s*\$?\s?\d[\d,]*/);
    assert.ok(!hit, `${f}: "${hit && hit[0]}" — tiers are single prices now`);
  }
});

/* ── 9. STARTING PRICES IN MARKETING COPY ───────────────────────────────── */
/* Marketing copy -> service -> pricing.js. Every "from $X" figure is written as
   <strong data-starting-from="SERVICE">$X</strong>, and X must equal
   startingFrom(SERVICE). The number sits in the HTML, so it is visible without
   JavaScript, indexable and causes no layout shift — but it cannot drift:
   change a price in pricing.js and this fails until the copy is updated.

   STARTING_SLOTS pins where they appear, in page order, so a price cannot
   silently be added, removed or attached to the wrong service. Same-Day uses
   `standard` (the clean type is what is priced); Rental Turnover has its own
   table; post-renovation appears nowhere here because it has no flat price. */
const STARTING_SLOTS = {
  'index.html': ['standard', 'moveout', 'standard', 'deep', 'turnover'],          // service cards, in grid order
  'services/index.html': ['standard', 'deep', 'standard', 'moveout', 'turnover'], // hub cards, in grid order
  'blog/same-day-cleaning-kamloops/index.html': ['standard', 'standard'],         // pricing section + cost FAQ
  'house-cleaning-kamloops/index.html':           ['standard', 'standard'],       // hero, pricing section
  // The third slot on these four is the cost FAQ answer, which cites the
  // page's own starting price (Sprint 37).
  'deep-cleaning-kamloops/index.html':            ['deep', 'deep', 'deep'],
  'same-day-cleaning-kamloops/index.html':        ['standard', 'standard', 'standard'],
  'move-out-cleaning-kamloops/index.html':        ['moveout', 'moveout', 'moveout'],
  'rental-turnover-cleaning-kamloops/index.html': ['turnover', 'turnover', 'turnover'],
};
section('9. Starting prices in marketing copy vs pricing.js');
for (const f of allHtml) {
  const h = read(f);
  const found = [...h.matchAll(STARTING_EL)];
  const loose = (h.match(/data-starting-from/g) || []).length;
  const want = STARTING_SLOTS[f] || [];
  if (!want.length && !loose) continue;
  const label = f.replace('/index.html', '/');
  check(`${label}: starting prices [${want.join(', ')}] = [${want.map(t => money(Pricing.startingFrom(t))).join(', ')}]`, () => {
    assert.strictEqual(loose, found.length, 'a data-starting-from attribute is not on a <strong> holding a single "$N"');
    assert.deepStrictEqual(found.map(m => m[1]), want, 'starting-price slots (services, order) changed — update STARTING_SLOTS deliberately');
    for (const [, service, text] of found) {
      assert.ok(Pricing.priceModel(service) === 'flat', `"${service}" has no flat starting price to publish`);
      assert.strictEqual(text, money(Pricing.startingFrom(service)), `${service}: page says ${text}, pricing.js says ${money(Pricing.startingFrom(service))}`);
    }
  });
}
check('nothing quoted per job is given a bound starting price', () => {
  for (const f of allHtml) {
    for (const t of APPROVED.QUOTED_PER_JOB)
      assert.ok(!read(f).includes(`data-starting-from="${t}"`), `${f} publishes a flat "from" price for ${t}, which is quoted per job`);
    for (const slots of Object.values(STARTING_SLOTS))
      for (const t of slots) assert.ok(!APPROVED.QUOTED_PER_JOB.includes(t), `${t} is registered in STARTING_SLOTS but is quoted per job`);
  }
});
/* On the card grids (homepage, Services hub) each price sits inside the <a>
   that links to a service page, so it can also be checked against the page it
   links to — a price on the wrong card fails even if the slot order matches.
   The service per page is CALCULATOR_PAGES, already pinned above. */
const CARD_PAGES = ['index.html', 'services/index.html'];
for (const f of CARD_PAGES) check(`${f.replace('/index.html', '/')}: each card's price matches the service page it links to`, () => {
  const cards = [...read(f).matchAll(/<a href="\/([a-z-]+)\/"[^>]*>([\s\S]*?)<\/a>/g)].filter(m => m[2].includes('data-starting-from'));
  assert.strictEqual(cards.length, 5, `expected 5 priced service cards, found ${cards.length}`);
  for (const [, slug, inner] of cards) {
    const want = CALCULATOR_PAGES[`${slug}/index.html`];
    assert.ok(want, `card links to /${slug}/, which has no preselected service to compare against`);
    const got = inner.match(/data-starting-from="([a-z]*)"/)[1];
    assert.strictEqual(got, want, `card linking to /${slug}/ shows the ${got} price; that page opens on ${want}`);
  }
  /* The sixth card is post-renovation: priced copy, no amount. */
  const postReno = read(f).match(/<a href="\/post-renovation-cleaning-kamloops\/"[\s\S]*?<\/a>/)[0];
  assert.ok(/class="svc-price">Quoted per job</.test(postReno), 'the post-renovation card should read "Quoted per job"');
  assert.ok(!/\$\d/.test(postReno), 'the post-renovation card shows an amount');
});
/* The conversion path each priced card grid has to complete: starting price ->
   estimator -> quote. Without this, the CTA could be dropped in an edit and
   nothing else would fail. The homepage links to its own estimator, the hub to
   the homepage's. */
const ESTIMATE_CTA = {
  'index.html': { href: '#quote', text: 'Get your instant estimate &rarr;' },
  'services/index.html': { href: '/#quote', text: 'Get Your Instant Estimate &rarr;' },
};
for (const [f, cta] of Object.entries(ESTIMATE_CTA)) check(`${f.replace('/index.html', '/')}: "${cta.text.replace(' &rarr;', '')}" CTA links to ${cta.href}`, () => {
  const h = read(f);
  const links = [...h.matchAll(/<a href="([^"]+)"[^>]*>([^<]*[Ii]nstant [Ee]stimate[^<]*)<\/a>/g)];
  assert.strictEqual(links.length, 1, `expected exactly 1 instant-estimate CTA, found ${links.length}`);
  assert.strictEqual(links[0][1], cta.href, 'CTA points somewhere else');
  assert.strictEqual(links[0][2].trim(), cta.text, 'CTA wording changed');
  const note = h.indexOf('Starting prices are for a studio');
  assert.ok(note !== -1 && h.indexOf(links[0][0]) > note, 'CTA must follow the starting-price note');
});
check('every page with starting prices is registered in STARTING_SLOTS', () => {
  for (const f of Object.keys(STARTING_SLOTS)) assert.ok(allHtml.includes(f), `${f} does not exist`);
});

/* ── 10. HONEST PRICING CLAIMS ──────────────────────────────────────────── */
section('10. Pricing claims the tables have to support');
check('starting prices are never presented as a guaranteed or lowest price', () => {
  for (const f of allHtml) {
    const text = read(f).replace(/<[^>]+>/g, ' ');
    const hit = text.match(/\b(cheapest|lowest price|lowest prices|best price|price guarantee|guaranteed price|flat[- ]rate price|exactly \$|final (amount|price|quote) within that range)/i);
    assert.ok(!hit, `${f}: "${hit && hit[0]}"`);
  }
});
check('no page denies rush pricing, now that rush tiers exist', () => {
  /* Rush tiers add up to 35%, so copy promising short notice costs no more is
     false. The approved position is that rush pricing MAY apply. */
  const DENIALS = [
    /no (?:separate )?(?:short[- ]notice|rush|same[- ]day) (?:rate|fee|charge|surcharge|pricing)/i,
    /there is no short[- ]notice rate/i,
    /(?:timing|the date)[^.]{0,60}(?:rather than|not) (?:the )?price/i,
    /priced (?:exactly )?(?:the same way|like) (?:as )?(?:one|a visit) booked/i,
    /no (?:extra|additional) (?:charge|cost) for (?:same[- ]day|short notice|rush)/i,
  ];
  for (const f of allHtml) {
    const text = decode(read(f)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const re of DENIALS) {
      const hit = text.match(re);
      assert.ok(!hit, `${f}: "${hit && hit[0]}" contradicts the rush tiers in pricing.js`);
    }
  }
});
check('no page prices bathrooms separately or describes a control that is gone', () => {
  /* A size tier bundles the bathroom count with the bedroom count ("3 bed /
     2 bath"), so bathrooms are not an input a visitor picks and not a line on a
     quote. Prose about bathrooms taking longer to clean is fine; these are the
     claims that are now false. */
  const STALE = [
    /priced (?:on|based on)[^.]{0,80}number of bathrooms/i,
    /\bper[- ]bathroom\b/i,
    /each (?:additional |extra )?bathroom (?:adds|costs|is)/i,
    /(?:choose|select|pick) (?:the )?bedrooms,? (?:and )?bathrooms/i,
    /main inputs are[^.]{0,60}number of bathrooms/i,
    /estimator[^.]{0,80}ballpark range/i,                 // the panel shows one total
    /turnovers? (?:are |is )?priced as a move-out/i,      // turnover has its own table
  ];
  for (const f of allHtml) {
    const text = decode(read(f)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const re of STALE) {
      const hit = text.match(re);
      assert.ok(!hit, `${f}: "${hit && hit[0]}" describes the retired pricing model`);
    }
  }
});
check('every rush tier the public can select is explained as "may apply"', () => {
  /* Pages that let a visitor pick a rush tier should say so in words too, so
     the fee is not a surprise that only appears in the total. */
  for (const f of Object.keys(CALCULATOR_PAGES)) {
    const text = decode(read(f)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.ok(/rush pricing may apply|rush fee may apply|may apply depending on how soon/i.test(text)
      || /final pricing may change/i.test(text), `${f} offers a timing step but never mentions that rush pricing may apply`);
  }
});

/* ── RESULT ──────────────────────────────────────────────────────────────── */
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('PRICING QA PASSED');
