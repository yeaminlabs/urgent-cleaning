/* ============================================================================
   Urgent Clean — Public price estimator (shared by every page that shows one)
   ----------------------------------------------------------------------------
   Service -> home size -> add-ons -> timing -> estimated total.

   Every number comes from assets/js/pricing.js, which loads first. Nothing is
   priced here and no price is written into the HTML: the options below are
   rendered from the tables, so a price can only ever change in one place.

   The estimate is an estimate. Where the business has no fixed number — a 5+
   bedroom home, a turnover of that size, heavy grease, wall washing — the panel
   says so and points at a quote instead of inventing a figure.

   Markup contract (ids): qc-service, qc-size, qc-addons, qc-more, qc-timing,
   qc-price, qc-note, qc-breakdown, qc-request-quote. Preselect a service for a
   page with data-preselect on #qc-service.
   ========================================================================== */
(function () {
  'use strict';
  const P = window.UrgentCleanPricing;
  const $ = id => document.getElementById(id);
  const svcBox = $('qc-service');
  if (!P || !svcBox) return;                       // page has no estimator

  const sizeBox = $('qc-size'), addonBox = $('qc-addons'), timingBox = $('qc-timing');
  const moreBtn = $('qc-more'), priceEl = $('qc-price'), noteEl = $('qc-note');
  const bdEl = $('qc-breakdown'), requestEl = $('qc-request-quote');
  const PAGE = document.body.dataset.page || 'homepage';

  const state = { service: svcBox.dataset.preselect || null, size: null, addons: {}, timing: 'normal', showAll: false };

  /* Service id -> the name the quote form's Service <select> uses. Analytics
     sends this rather than the estimator's own label, so service_name holds one
     vocabulary across estimator_complete, service_click and quote_form_*
     instead of two spellings of the same service. */
  const FORM_SERVICE = {
    standard: 'House Cleaning',
    deep: 'Deep Cleaning',
    moveout: 'Move-Out Cleaning',
    turnover: 'Rental Turnover Cleaning',
  };

  /* Size tier -> bedroom count. One map, two consumers: the estimator_complete
     event (whose bedrooms_count dimension has held "1".."5" since it was
     created) and the quote form's Bedrooms <select>, whose option text is the
     same thing capitalised. The turnover tiers are the same sizes under
     different ids, so they map to the same counts. */
  const BED_COUNT = {
    studio: 'studio', '1bed': '1', '2bed': '2', '3bed': '3', '4bed': '4', '5plus': '5+',
    't-studio': 'studio', 't-2bed': '2', 't-3bed': '3', 't-4bed': '4', 't-5plus': '5+',
  };

  /* ── rendering ─────────────────────────────────────────────────────────── */
  const chip = (id, label, hint, on) =>
    `<button type="button" class="qc-opt${hint ? ' qc-opt--card' : ''}${on ? ' active' : ''}" data-val="${id}" aria-pressed="${on ? 'true' : 'false'}">` +
    (hint ? `<span class="qc-opt-title">${label}</span><span class="qc-opt-hint">${hint}</span>` : label) + '</button>';

  const SERVICE_HINT = {
    standard: 'Regularly maintained home',
    deep: 'Neglected or overdue',
    moveout: 'Empty unit, end of tenancy',
    turnover: 'Between guests or tenants',
  };

  function renderServices() {
    svcBox.innerHTML = P.SERVICES.map(s => chip(s.id, s.label, SERVICE_HINT[s.id], state.service === s.id)).join('');
  }
  function renderSizes() {
    const sizes = P.sizesFor(state.service || 'standard');
    if (state.size && !sizes.some(s => s.id === state.size)) state.size = null;
    sizeBox.innerHTML = sizes.map(s => chip(s.id, s.label, null, state.size === s.id)).join('');
  }
  function renderTiming() {
    timingBox.innerHTML = P.RUSH.map(r => chip(r.id, r.label, null, state.timing === r.id)).join('');
  }
  function renderAddons() {
    const list = P.ADDONS.filter(a => state.showAll || a.common || state.addons[a.id]);
    addonBox.innerHTML = list.map(a => {
      const qty = state.addons[a.id] || 0;
      const price = a.price === null ? 'Custom quote' : '+' + P.money(a.price) + (a.qty ? ' / ' + a.unit : '');
      if (a.qty) {
        return `<div class="qc-addon" data-id="${a.id}">
            <span class="qc-addon-label">${a.label} <span class="qc-addon-price">${price}</span></span>
            <span class="qc-qty">
              <button type="button" class="qc-qty-btn" data-step="-1" aria-label="Remove one ${a.unit}: ${a.label}"${qty ? '' : ' disabled'}>&minus;</button>
              <span class="qc-qty-val" aria-live="polite" aria-label="${a.label}: ${qty} ${a.unit}${qty === 1 ? '' : 's'}">${qty}</span>
              <button type="button" class="qc-qty-btn" data-step="1" aria-label="Add one ${a.unit}: ${a.label}">+</button>
            </span>
          </div>`;
      }
      return `<div class="qc-addon" data-id="${a.id}">
          <span class="qc-addon-label">${a.label} <span class="qc-addon-price">${price}</span></span>
          <button type="button" class="qc-toggle${qty ? ' active' : ''}" data-step="toggle" aria-pressed="${qty ? 'true' : 'false'}">${qty ? 'Added' : 'Add'}</button>
        </div>`;
    }).join('');
    if (moreBtn) moreBtn.textContent = state.showAll ? 'Show fewer add-ons' : 'More add-ons';
  }

  const row = (label, value, cls) => `<div class="qc-bd-row${cls ? ' ' + cls : ''}"><span>${label}</span><span>${value}</span></div>`;

  function render() {
    renderServices(); renderSizes(); renderTiming(); renderAddons();

    if (!state.service || !state.size) {
      priceEl.textContent = '—';
      noteEl.textContent = 'Choose a service and home size to see an estimated total.';
      bdEl.innerHTML = ''; bdEl.classList.remove('visible');
      /* .qc-cta is opacity:0 / pointer-events:none until it carries .ready, so
         the button cannot be clicked before there is anything to send. */
      if (requestEl) {
        requestEl.classList.remove('ready');
        requestEl.setAttribute('aria-disabled', 'true');
        requestEl.textContent = 'Request a quote →';
      }
      return;
    }

    const e = P.estimate(state);
    const rows = [];

    if (e.quoteOnly) {
      priceEl.textContent = 'Custom quote';
      noteEl.textContent = 'This size is quoted individually — send the details and we’ll confirm the price.';
      rows.push(row(e.service + ' — ' + e.size, 'Custom quote'));
    } else {
      priceEl.textContent = P.money(e.total) + (e.open ? '+' : '');
      noteEl.textContent = e.open
        ? 'Starting price — we’ll confirm after reviewing the size and condition.'
        : 'Estimated total for the options selected.';
      rows.push(row('Base service — ' + e.size, P.money(e.base.amount) + (e.open ? '+' : '')));
    }

    for (const a of e.addons) {
      const label = a.qty > 1 && a.unit ? `${a.label} × ${a.qty}` : a.label;
      rows.push(row(label, a.amount === null ? 'Custom quote' : '+' + P.money(a.amount)));
    }
    if (e.rush.fee) rows.push(row(e.rush.label + ' rush', '+' + P.money(e.rush.fee)));
    if (!e.quoteOnly) rows.push(row('Estimated total', P.money(e.total) + (e.open ? '+' : ''), 'total'));
    bdEl.innerHTML = rows.join(''); bdEl.classList.add('visible');

    if (requestEl) {
      requestEl.classList.add('ready');
      requestEl.removeAttribute('aria-disabled');
      requestEl.textContent = (e.quoteOnly || e.hasCustom) ? 'Request final quote →' : 'Request this quote →';
    }
    report(e);
  }

  /* ── analytics ─────────────────────────────────────────────────────────── */
  /* The existing estimator_complete event, once per distinct selection, with
     the same three parameters it has always sent. Enum values only: no dollar
     amount is reported, and nothing a visitor typed.

     It goes through the host page's tracker (index.html inline, or
     service-page.js) rather than calling gtag directly, so every analytics
     payload on the site stays in one shape that qa/site-integrity.js can
     parse and vet. If the page script has not loaded, the event is dropped. */
  function trackEvent(name, params) {
    try {
      if (typeof window.UrgentCleanTrack === 'function') window.UrgentCleanTrack(name, params);
    } catch (err) { /* analytics must never break the estimator */ }
  }

  let lastSig = null;
  function report(e) {
    const sig = [state.service, state.size, state.timing, Object.keys(state.addons).filter(k => state.addons[k]).sort().join('+')].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    trackEvent('estimator_complete', {
      service_name: FORM_SERVICE[state.service] || e.service,
      bedrooms_count: BED_COUNT[state.size] || state.size,
      form_location: PAGE,
    });
  }

  /* ── the handoff into the quote form ───────────────────────────────────── */
  const FORM_BEDS = { studio: 'Studio' };          // the rest match BED_COUNT exactly

  function contextLine(e) {
    const bits = [e.service, e.size];
    for (const a of e.addons) bits.push(a.qty > 1 && a.unit ? `${a.label} x${a.qty}` : a.label);
    if (e.rush.id !== 'normal') bits.push(e.rush.label);
    const total = e.quoteOnly ? 'custom quote' : P.money(e.total) + (e.open ? '+' : '');
    return `Estimator selection: ${bits.join(', ')}. Estimated total: ${total}.`;
  }

  function handoff(ev) {
    if (!state.service || !state.size) { if (ev) ev.preventDefault(); return; }
    const e = P.estimate(state);
    const svc = document.getElementById('fservice');
    const beds = document.getElementById('fbeds');
    const ctx = document.getElementById('festimator');
    if (svc && FORM_SERVICE[state.service]) {
      const match = [...svc.options].find(o => o.text === FORM_SERVICE[state.service]);
      if (match) svc.value = match.value || match.text;
    }
    const bedText = FORM_BEDS[state.size] || BED_COUNT[state.size];
    if (beds && bedText) {
      const match = [...beds.options].find(o => o.text === bedText);
      if (match) beds.value = match.value || match.text;
    }
    if (ctx) ctx.value = contextLine(e);
  }

  /* ── events ────────────────────────────────────────────────────────────── */
  svcBox.addEventListener('click', ev => {
    const b = ev.target.closest('.qc-opt'); if (!b) return;
    state.service = b.dataset.val; render();
  });
  sizeBox.addEventListener('click', ev => {
    const b = ev.target.closest('.qc-opt'); if (!b) return;
    state.size = b.dataset.val; render();
  });
  timingBox.addEventListener('click', ev => {
    const b = ev.target.closest('.qc-opt'); if (!b) return;
    state.timing = b.dataset.val; render();
  });
  addonBox.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-step]'); if (!btn) return;
    const id = btn.closest('.qc-addon').dataset.id;
    const current = state.addons[id] || 0;
    if (btn.dataset.step === 'toggle') state.addons[id] = current ? 0 : 1;
    else state.addons[id] = Math.max(0, current + Number(btn.dataset.step));   // never negative
    render();
  });
  if (moreBtn) moreBtn.addEventListener('click', () => { state.showAll = !state.showAll; render(); });
  if (requestEl) requestEl.addEventListener('click', handoff);

  render();
})();
