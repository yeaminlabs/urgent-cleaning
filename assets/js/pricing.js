/* ============================================================================
   Urgent Clean — Public pricing (single source of truth)
   ----------------------------------------------------------------------------
   These are explicit price tables, not a formula. Every public price — the
   estimator, the "from $X" lines on the service cards, the cost answers in the
   FAQs — comes from this file and must agree with the internal Team Price
   Guide. The guide may hold more than this (crew hourly rates, operational
   detail); only what the public needs lives here.

   There is deliberately no bedroom/bathroom formula, no clean-type multiplier
   and no automatic +20% "range". A size tier is one price. If a property does
   not fit a tier, the answer is a custom quote, not an invented number.

   To change a price: edit the table, then run `npm run qa` — it fails if any
   published price in the site's HTML no longer matches this file.

   Loaded as a plain script (no build step): exposes window.UrgentCleanPricing
   in the browser, and module.exports under Node for the QA suite.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ── Flat-rate services ──────────────────────────────────────────────────
     One price per size tier, in the order of SIZES. The last tier is a
     starting price ("$350+"), because 5+ bedroom homes vary too much to quote
     blind. */
  const SIZES = Object.freeze([
    { id: 'studio', label: 'Studio / small 1 bed' },
    { id: '1bed',   label: '1 bed / 1 bath' },
    { id: '2bed',   label: '2 bed / 1 bath' },
    { id: '3bed',   label: '3 bed / 2 bath' },
    { id: '4bed',   label: '4 bed / 2–3 bath' },
    { id: '5plus',  label: '5+ bedroom' },
  ]);
  const FLAT = Object.freeze({
    standard: Object.freeze([125, 150, 175, 200, 250, 350]),
    deep:     Object.freeze([175, 200, 260, 350, 450, 550]),
    moveout:  Object.freeze([195, 235, 295, 395, 495, 595]),
  });
  /* Index of the tier that is quoted as "from": the 5+ row. */
  const OPEN_ENDED = SIZES.length - 1;

  /* ── Airbnb / rental turnover ────────────────────────────────────────────
     A separate table, for units kept in reasonable turnover condition. A
     heavily soiled move-out is a move-out clean, not a turnover. */
  const TURNOVER_SIZES = Object.freeze([
    { id: 't-studio', label: 'Studio / 1 bedroom' },
    { id: 't-2bed',   label: '2 bedroom' },
    { id: 't-3bed',   label: '3 bedroom' },
    { id: 't-4bed',   label: '4 bedroom' },
    { id: 't-5plus',  label: '5+ bedroom' },
  ]);
  const TURNOVER = Object.freeze([110, 145, 185, 225, null]);   // null = custom quote

  const SERVICES = Object.freeze([
    { id: 'standard', label: 'Standard Cleaning',      table: 'standard' },
    { id: 'deep',     label: 'Deep Cleaning',          table: 'deep' },
    { id: 'moveout',  label: 'Move-In / Move-Out',     table: 'moveout' },
    { id: 'turnover', label: 'Airbnb / Rental Turnover', table: 'turnover' },
  ]);

  /* ── Add-ons ─────────────────────────────────────────────────────────────
     price === null means the item has no fixed amount and needs a quote; it is
     never given an invented value and never attracts a rush percentage. */
  const ADDONS = Object.freeze([
    { id: 'oven',     label: 'Inside oven',                      price: 20,   common: true },
    { id: 'fridge',   label: 'Inside fridge',                    price: 20,   common: true },
    { id: 'cabinets', label: 'Inside all kitchen cabinets',      price: 20,   common: true },
    { id: 'laundry',  label: 'Laundry — first load',        price: 30,   common: true },
    { id: 'laundry-extra', label: 'Laundry — extra loads',  price: 15,   common: true,  qty: true, unit: 'load' },
    { id: 'linen',    label: 'Linen change',                     price: 10,   common: true,  qty: true, unit: 'bed' },
    { id: 'windows',  label: 'Interior windows',                 price: 10,   common: true,  qty: true, unit: 'window' },
    { id: 'patio',    label: 'Patio / sliding-door glass',       price: 10,   common: false, qty: true, unit: 'door' },
    { id: 'pet-hair', label: 'Heavy pet hair',                   price: 25,   common: true },
    { id: 'grease',   label: 'Heavy grease',                     price: null, common: false },
    { id: 'walls',    label: 'Wall washing',                     price: null, common: false },
  ]);

  /* ── Rush tiers ──────────────────────────────────────────────────────────
     fee = max(pct of the priced subtotal, minimum). Custom-quote add-ons are
     not in the subtotal, so they never inflate a rush fee. */
  const RUSH = Object.freeze([
    { id: 'normal',    label: 'Normal booking',          pct: 0,    min: 0 },
    { id: 'rush-24h',  label: 'Within 24 hours',         pct: 0.15, min: 50 },
    { id: 'rush-6h',   label: 'Under 6 hours',           pct: 0.20, min: 60 },
    { id: 'rush-3h',   label: 'Under 3 hours',           pct: 0.30, min: 70 },
    { id: 'overnight', label: 'Overnight 10 PM – 7 AM', pct: 0.35, min: 70 },
  ]);

  /* ── How each service is presented publicly ──────────────────────────────
     Not every service has a flat starting price, and none should be given one
     it does not have. Post-renovation is quoted per job: scope, dust spread and
     debris vary too much for a table. */
  const DISPLAY = Object.freeze({
    standard: Object.freeze({ model: 'flat', from: FLAT.standard[0] }),
    deep:     Object.freeze({ model: 'flat', from: FLAT.deep[0] }),
    moveout:  Object.freeze({ model: 'flat', from: FLAT.moveout[0] }),
    turnover: Object.freeze({ model: 'flat', from: TURNOVER[0] }),
    postreno: Object.freeze({ model: 'custom' }),
  });

  const byId = (list, id) => list.find(x => x.id === id) || null;
  const sizesFor = serviceId => (serviceId === 'turnover' ? TURNOVER_SIZES : SIZES);
  const priceModel = serviceId => (DISPLAY[serviceId] ? DISPLAY[serviceId].model : null);

  /* The lowest published price for a service. Throws for anything quoted per
     job, so a caller can never print a number the business has not set. */
  function startingFrom(serviceId) {
    const d = DISPLAY[serviceId];
    if (!d) throw new Error('Unknown service: ' + serviceId);
    if (d.model !== 'flat') throw new Error('No flat starting price for: ' + serviceId + ' (quoted ' + d.model + ')');
    return d.from;
  }

  /* Base price for one service + size. Returns null when the tier is quoted
     individually (turnover 5+), and open:true when it is a "from" price. */
  function basePrice(serviceId, sizeId) {
    const service = byId(SERVICES, serviceId);
    if (!service) return null;
    const sizes = sizesFor(serviceId);
    const i = sizes.findIndex(s => s.id === sizeId);
    if (i === -1) return null;
    const amount = serviceId === 'turnover' ? TURNOVER[i] : FLAT[service.table][i];
    if (amount === null) return { amount: null, open: false, custom: true, label: sizes[i].label };
    return { amount, open: serviceId !== 'turnover' && i === OPEN_ENDED, custom: false, label: sizes[i].label };
  }

  function rushFee(tierId, pricedSubtotal) {
    const tier = byId(RUSH, tierId);
    if (!tier || !tier.pct) return 0;
    return Math.max(Math.round(pricedSubtotal * tier.pct), tier.min);
  }

  /* estimate({service, size, addons:{id:qty}, timing})
     Returns every line the result panel shows. Items without a price are
     listed separately as custom work rather than being guessed at. */
  function estimate(sel) {
    const serviceId = sel && sel.service, sizeId = sel && sel.size;
    const service = byId(SERVICES, serviceId);
    const base = basePrice(serviceId, sizeId);
    const chosen = (sel && sel.addons) || {};
    const lines = [], custom = [];
    let addonsTotal = 0;

    for (const a of ADDONS) {
      const qty = Math.max(0, Math.floor(Number(chosen[a.id]) || 0));
      if (!qty) continue;
      if (a.price === null) { custom.push(a.label); lines.push({ id: a.id, label: a.label, qty, amount: null }); continue; }
      const amount = a.price * (a.qty ? qty : 1);
      addonsTotal += amount;
      lines.push({ id: a.id, label: a.label, qty, amount, unit: a.unit || null });
    }

    const baseAmount = base && base.amount !== null ? base.amount : 0;
    const pricedSubtotal = baseAmount + addonsTotal;
    const tier = byId(RUSH, (sel && sel.timing) || 'normal') || RUSH[0];
    const fee = base && base.amount !== null ? rushFee(tier.id, pricedSubtotal) : 0;

    return {
      service: service ? service.label : null,
      serviceId: serviceId || null,
      size: base ? base.label : null,
      base,
      addons: lines,
      addonsTotal,
      custom,                                   // labels with no fixed price
      hasCustom: custom.length > 0 || !!(base && base.custom),
      pricedSubtotal,
      rush: { id: tier.id, label: tier.label, pct: tier.pct, min: tier.min, fee },
      total: pricedSubtotal + fee,
      open: !!(base && base.open),              // "from" price, e.g. 5+ bedroom
      quoteOnly: !!(base && base.custom),       // nothing priced at all
    };
  }

  const money = n => '$' + Number(n).toLocaleString('en-US');

  const api = Object.freeze({
    SIZES, TURNOVER_SIZES, SERVICES, FLAT, TURNOVER, ADDONS, RUSH, DISPLAY,
    sizesFor, priceModel, startingFrom, basePrice, rushFee, estimate, money,
  });

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UrgentCleanPricing = api;
})(typeof self !== 'undefined' ? self : this);
