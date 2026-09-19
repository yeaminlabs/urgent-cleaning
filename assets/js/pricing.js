/* ============================================================================
   Urgent Clean — Pricing (single source of truth)
   ----------------------------------------------------------------------------
   Every price the estimators show is calculated here and nowhere else. The
   homepage estimator and assets/js/service-page.js both consume this file, and
   the extras buttons take their prices from EXTRAS.

   To change a price, edit the constants below, then run `npm run qa` — it fails
   if any price published in the site's HTML no longer matches this engine.

   These are the approved launch prices. The formula and rounding reproduce the
   original estimator exactly; do not "tidy" the expressions in estimate()
   without re-running the parity check, since floating-point results depend on
   the exact order of operations.

   Services without a pricing type of their own (intentional — do not add one
   without an explicit pricing decision):
     - Rental Turnover Cleaning  -> priced as `moveout`. Its page preselects
       Move-out in the estimator and tells visitors to pick it.
     - Same-Day / Short-Notice   -> no surcharge. Its page preselects
       `standard`; the price is whatever clean type the visitor chooses.

   Loaded as a plain script (no build step): exposes window.UrgentCleanPricing
   in the browser, and module.exports under Node for the QA suite.
   ========================================================================== */
(function (root) {
  'use strict';

  /* Base price by bedrooms. 1 = "Studio / 1", 5 = "5+". */
  const BASE = Object.freeze({ 1: 120, 2: 155, 3: 195, 4: 250, 5: 315 });

  /* Added per bathroom beyond the first. 4 = "4+". */
  const BATH_X = 38;

  /* Applied to the whole subtotal (base + bathrooms + extras). */
  const MULT = Object.freeze({ standard: 1.0, moveout: 1.45, deep: 1.30, postreno: 1.65 });

  /* Optional detail work. Keys match the data-val of each extras button. */
  const EXTRAS = Object.freeze({ fridge: 35, oven: 30, cabinets: 50, laundry: 40 });

  /* estimate(beds, baths, type, extras)
       beds   1-5
       baths  1-4; falsy means "not chosen yet" and counts as 1, as it always has
       type   'standard' | 'moveout' | 'deep' | 'postreno'
       extras iterable of EXTRAS keys (Set or Array); unknown keys add nothing
     Returns every intermediate value, because the estimator's breakdown shows
     base, bathrooms, the clean-type markup (raw - subtotal) and extras. */
  function estimate(beds, baths, type, extras) {
    const b           = baths || 1;
    const base        = BASE[beds];
    const bathAdd     = (b - 1) * BATH_X;
    let   extrasTotal = 0;
    if (extras) for (const k of extras) extrasTotal = extrasTotal + (EXTRAS[k] || 0);
    const subtotal    = base + bathAdd + extrasTotal;
    const mult        = MULT[type];
    const raw         = subtotal * mult;
    const low         = Math.round(raw / 5) * 5;          // nearest $5
    const high        = Math.round(raw * 1.20 / 5) * 5;   // +20%, nearest $5
    return { beds, baths: b, type, base, bathAdd, extrasTotal, subtotal, mult, raw, low, high };
  }

  /* Lowest possible estimate for a clean type: studio/1-bedroom, 1 bathroom,
     no extras. This is what any "starting from" figure must be derived from. */
  function startingFrom(type) {
    if (!Object.prototype.hasOwnProperty.call(MULT, type)) {
      throw new Error('Unknown pricing type: ' + type);
    }
    return estimate(1, 1, type).low;
  }

  /* Writes each extras button's visible "+$X" label from EXTRAS, so the label
     and the price used in the calculation can never disagree. The same text is
     kept in the HTML as a no-JS / no-layout-shift fallback, and `npm run qa`
     checks that fallback against EXTRAS. */
  function syncExtraLabels(doc) {
    if (!doc) return;
    doc.querySelectorAll('#qc-extras .qc-toggle[data-val]').forEach(btn => {
      const price = EXTRAS[btn.dataset.val];
      const label = btn.querySelector('.qc-toggle-price');
      if (price !== undefined && label) label.textContent = '+$' + price;
    });
  }

  const api = Object.freeze({ BASE, BATH_X, MULT, EXTRAS, estimate, startingFrom, syncExtraLabels });

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UrgentCleanPricing = api;
})(typeof self !== 'undefined' ? self : this);
