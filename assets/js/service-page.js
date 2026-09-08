/* ============================================================================
   Urgent Clean — Service Page Script
   ----------------------------------------------------------------------------
   Shared behaviour for the dedicated service pages. Copied from the homepage's
   inline script so the two can evolve independently — index.html is untouched
   and cannot be affected by changes here.

   Everything page-specific is read from data attributes rather than hardcoded,
   so the next service page only needs its own markup:

     <body data-page="house_cleaning_page" data-call-prefix="house_cleaning">
     <div id="qc-condition" data-preselect="standard">      auto-select clean type
     <form id="quote-form" data-preselect-service="House Cleaning">

   PRICING NOTE: the estimator constants and formula below are copied verbatim
   from the homepage and are approved and fixed. Do not change BASE, BATH_X,
   MULT, the rounding, or the low/high range without an explicit request.
   ========================================================================== */
(function () {
  'use strict';

  const BODY = document.body;
  /* form_location / quote_form_* parameter for this page. */
  const PAGE = BODY.dataset.page || 'service_page';
  /* Prefix for page-local call_click locations, e.g. "house_cleaning_hero". */
  const CALL_PREFIX = BODY.dataset.callPrefix || 'service';

  /* ── ANALYTICS (GA4) ──────────────────────────────────────────
     Fire-and-forget wrapper around gtag. Never sends customer PII — only
     fixed enum-ish values (service names from the dropdown's own option list,
     locations, counts, booleans, already-computed prices). Wrapped in
     try/catch behind a typeof guard so a blocked or failed gtag.js can never
     break a phone link, the form, or the estimator. */
  const DEBUG = /[?&]analytics_debug=1\b/.test(location.search);
  function trackEvent(name, params) {
    try {
      if (DEBUG) console.log('[analytics]', name, params || {});
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (err) { /* analytics must never break the page */ }
  }

  /* Where a tel: link lives, for call_click's click_location. Ordered
     most-specific first so nested matches resolve correctly. */
  function callLocation(el) {
    if (el.closest('.m-call-bar'))   return 'mobile_sticky';
    if (el.closest('#nav-drawer'))   return 'nav_drawer';
    if (el.closest('#nav'))          return 'navigation';
    if (el.closest('.svc-hero'))     return CALL_PREFIX + '_hero';
    if (el.closest('#same-day'))     return CALL_PREFIX + '_same_day';
    if (el.closest('#how'))          return CALL_PREFIX + '_how_it_works';
    if (el.closest('#pricing'))      return 'estimator';
    if (el.closest('#form-success')) return 'form_success';
    if (el.closest('#form-error'))   return 'form_error';
    if (el.closest('#contact'))      return CALL_PREFIX + '_contact';
    if (el.closest('footer'))        return 'footer';
    return 'other';
  }

  /* One delegated listener = one event per click, and it automatically covers
     any tel: link added later. Never calls preventDefault, so the dialer still
     opens exactly as before. */
  document.addEventListener('click', e => {
    const tel = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!tel) return;
    trackEvent('call_click', { click_location: callLocation(tel) });
  });

  /* Set by the estimator when a valid range is produced; read (non-PII) by
     quote_form_success. */
  let estimatorUsed = false;
  let lastEstimate = { low: null, high: null };
  /* Analytics-only label map for the estimator's clean-type values. Mirrors the
     handoff mapping below; kept separate so no pricing code is touched. */
  const COND_SERVICE = { standard: 'House Cleaning', moveout: 'Move-Out Cleaning', deep: 'Deep Cleaning', postreno: 'Post-Renovation Cleaning' };

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.10 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ── QUOTE CALCULATOR ─────────────────────────────────────────
     Constants and math copied verbatim from the homepage — approved and fixed. */
  (function () {
    const BASE   = { 1: 120, 2: 155, 3: 195, 4: 250, 5: 315 };
    const BATH_X = 38;
    const MULT   = { standard: 1.0, moveout: 1.45, deep: 1.30, postreno: 1.65 };
    const MULT_L = { standard: 'Standard clean', moveout: 'Move-out surcharge', deep: 'Deep clean surcharge', postreno: 'Post-reno surcharge' };
    const state  = { beds: null, baths: null, cond: null, extras: new Set() };
    let lastEstimateSig = null; // analytics dedup only

    function fmt(n) { return '$' + Math.round(n).toLocaleString(); }

    function recalc() {
      const priceEl = document.getElementById('qc-price');
      const noteEl  = document.getElementById('qc-note');
      const ctaEl   = document.getElementById('qc-cta');
      const bdEl    = document.getElementById('qc-breakdown');
      if (!priceEl) return;

      if (!state.beds || !state.cond) {
        priceEl.textContent = '—';
        noteEl.textContent  = 'Select bedrooms and clean type to see your estimate.';
        ctaEl.classList.remove('ready');
        ctaEl.setAttribute('aria-disabled', 'true');
        bdEl.classList.remove('visible');
        return;
      }

      const baths    = state.baths || 1;
      const base     = BASE[state.beds];
      const bathAdd  = (baths - 1) * BATH_X;
      const extrasTotal = [...state.extras].reduce((s, k) => {
        const btn = document.querySelector(`#qc-extras [data-val="${k}"]`);
        return s + (btn ? +btn.dataset.price : 0);
      }, 0);
      const subtotal = base + bathAdd + extrasTotal;
      const raw      = subtotal * MULT[state.cond];
      const lo       = Math.round(raw / 5) * 5;
      const hi       = Math.round(raw * 1.20 / 5) * 5;

      /* price display */
      priceEl.classList.add('flash');
      setTimeout(() => priceEl.classList.remove('flash'), 300);
      priceEl.textContent = fmt(lo) + ' – ' + fmt(hi);
      noteEl.textContent  = 'Call or request a quote to confirm your exact price.';
      ctaEl.classList.add('ready');
      ctaEl.setAttribute('aria-disabled', 'false');

      /* breakdown */
      document.getElementById('qcb-base-val').textContent   = fmt(base);
      const bathRow = document.getElementById('qcb-baths');
      bathRow.style.display = bathAdd > 0 ? '' : 'none';
      document.getElementById('qcb-baths-val').textContent  = '+' + fmt(bathAdd);
      document.getElementById('qcb-cond-label').textContent = MULT_L[state.cond];
      /* The multiplier applies to the whole subtotal (base + baths + extras),
         so its line-item markup is raw - subtotal — not a formula involving
         only base/baths, which under- or over-counted extras. */
      document.getElementById('qcb-cond-val').textContent   = MULT[state.cond] === 1 ? 'included' : '+' + fmt(raw - subtotal);
      const extRow = document.getElementById('qcb-extras');
      extRow.style.display = extrasTotal > 0 ? '' : 'none';
      document.getElementById('qcb-extras-val').textContent = '+' + fmt(extrasTotal);
      document.getElementById('qcb-total').textContent      = fmt(lo) + ' – ' + fmt(hi);
      bdEl.classList.add('visible');

      /* Analytics only — reads the values already computed above, changes none
         of them. Deduped by input+output signature so repeat recalcs of the
         same combination don't re-fire, while a genuinely new selection does. */
      estimatorUsed = true;
      lastEstimate = { low: lo, high: hi };
      const sig = [state.beds, baths, state.cond, [...state.extras].sort().join(','), lo, hi].join('|');
      if (sig !== lastEstimateSig) {
        lastEstimateSig = sig;
        trackEvent('estimator_complete', {
          service_name: COND_SERVICE[state.cond] || state.cond,
          bedrooms_count: state.beds,
          estimate_low: lo,
          estimate_high: hi,
          form_location: PAGE,
        });
      }
    }

    /* single-select groups */
    [['qc-beds', 'beds'], ['qc-baths', 'baths'], ['qc-condition', 'cond']].forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('click', e => {
        const btn = e.target.closest('.qc-opt');
        if (!btn) return;
        document.querySelectorAll('#' + id + ' .qc-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state[key] = key === 'cond' ? btn.dataset.val : +btn.dataset.val;
        recalc();
      });
    });

    /* multi-select extras */
    document.getElementById('qc-extras')?.addEventListener('click', e => {
      const btn = e.target.closest('.qc-toggle');
      if (!btn) return;
      const v = btn.dataset.val;
      state.extras[state.extras.has(v) ? 'delete' : 'add'](v);
      btn.classList.toggle('active', state.extras.has(v));
      recalc();
    });

    /* Page context: preselect the clean type this page is about (e.g. the
       House Cleaning page opens on "Standard"). Bedrooms stay unselected, so
       recalc() returns early — no estimate is shown and, importantly, no
       estimator_complete fires until the visitor actually makes a choice. */
    const condWrap = document.getElementById('qc-condition');
    const preCond  = condWrap && condWrap.dataset.preselect;
    if (preCond) {
      const btn = condWrap.querySelector(`.qc-opt[data-val="${preCond}"]`);
      if (btn) { btn.classList.add('active'); state.cond = preCond; }
    }
  })();

  /* ── SERVICE PRESELECTION ─────────────────────────────────────
     Sets the visible Service field, shows a subtle confirmation next to it,
     and — when called from the estimator — also preselects Bedrooms and opens
     the Optional details so the visitor can see what was filled in for them. */
  function preselectService(serviceName, opts) {
    opts = opts || {};
    const select = document.getElementById('fservice');
    if (!select || ![...select.options].some(o => o.value === serviceName)) return;
    select.value = serviceName;

    if (!opts.silent) {
      const confirm = document.getElementById('fservice-confirm');
      const confirmName = document.getElementById('fservice-confirm-name');
      if (confirm && confirmName) {
        confirmName.textContent = serviceName;
        confirm.hidden = false;
      }
    }

    if (opts.bedrooms) {
      const beds = document.getElementById('fbeds');
      if (beds && [...beds.options].some(o => o.value === opts.bedrooms)) {
        beds.value = opts.bedrooms;
        const details = document.getElementById('form-optional');
        if (details) details.open = true;
      }
    }

    if (opts.estimatorContext) {
      const ctx = document.getElementById('festimator');
      if (ctx) ctx.value = opts.estimatorContext;
    }
  }

  /* Related-service cards and any other [data-service] element. */
  document.querySelectorAll('[data-service]').forEach(el => {
    el.addEventListener('click', () => {
      preselectService(el.dataset.service);
      trackEvent('service_click', {
        service_name: el.dataset.service,
        click_location: el.dataset.serviceLocation || (CALL_PREFIX + '_related'),
      });
    });
  });

  /* Estimator -> form handoff. */
  (function () {
    const link = document.getElementById('qc-request-quote');
    const cta  = document.getElementById('qc-cta');
    if (!link) return;

    const SERVICE_MAP = { standard: 'House Cleaning', moveout: 'Move-Out Cleaning', deep: 'Deep Cleaning', postreno: 'Post-Renovation Cleaning' };
    const BEDS_MAP = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5+' };

    link.addEventListener('click', () => {
      if (!cta || !cta.classList.contains('ready')) return; // nothing selected yet — plain scroll only

      const condBtn    = document.querySelector('#qc-condition .qc-opt.active');
      const bedsBtn    = document.querySelector('#qc-beds .qc-opt.active');
      const bathsBtn   = document.querySelector('#qc-baths .qc-opt.active');
      const extrasBtns = [...document.querySelectorAll('#qc-extras .qc-toggle.active')];

      const cond = condBtn && condBtn.dataset.val;
      const serviceName = cond && SERVICE_MAP[cond];
      if (!serviceName) return;

      const bedsVal    = bedsBtn && bedsBtn.dataset.val;
      const bedsLabel  = bedsBtn ? bedsBtn.textContent.trim() : '';
      const bathsLabel = bathsBtn ? bathsBtn.textContent.trim() : '1';
      const extrasLabels = extrasBtns.map(b => b.childNodes[0].textContent.trim());
      const priceText = (document.getElementById('qc-price').textContent || '').trim();

      let context = `Estimator selection: ${bedsLabel || '—'} bedroom(s), ${bathsLabel} bathroom(s), ${serviceName}`;
      if (extrasLabels.length) context += `, ${extrasLabels.join(', ')}`;
      context += priceText && priceText !== '—' ? `. Estimated range: ${priceText}.` : '.';

      preselectService(serviceName, {
        bedrooms: bedsVal ? BEDS_MAP[bedsVal] : null,
        estimatorContext: context,
      });
    });
  })();

  let selectedPhoto = null; // { name, type, dataUrl } — set below, read by the submit handler

  /* ── IMAGE UPLOAD (single photo, actually submitted) ──────────
     Capped at one file so the base64-encoded payload stays comfortably under
     Vercel's ~4.5MB serverless request-body limit. */
  (function () {
    const MAX_BYTES = 3 * 1024 * 1024; // 3MB
    const ALLOWED = /^image\/(jpeg|png|webp|heic|heif)$/;
    const drop     = document.getElementById('img-drop');
    const input    = document.getElementById('img-input');
    const idle     = document.getElementById('img-drop-idle');
    const previews = document.getElementById('img-previews');
    const grid     = document.getElementById('img-grid');
    const errorEl  = document.getElementById('img-drop-error');
    if (!drop || !input) return;

    function showError(msg) {
      errorEl.textContent = msg || '';
      errorEl.hidden = !msg;
    }

    function clearFile() {
      selectedPhoto = null;
      grid.innerHTML = '';
      idle.style.display = '';
      previews.style.display = 'none';
      drop.classList.remove('has-files');
    }

    function setFile(file) {
      showError('');
      if (!file) return;
      if (!ALLOWED.test(file.type)) {
        showError('Please choose a JPG, PNG, or HEIC photo.');
        return;
      }
      if (file.size > MAX_BYTES) {
        showError('That photo is too large (max 3MB) — please choose a smaller one.');
        return;
      }

      idle.style.display = 'none';
      previews.style.display = '';
      drop.classList.add('has-files');
      grid.innerHTML = '';

      const thumb = document.createElement('div');
      thumb.className = 'img-thumb';
      thumb.innerHTML = `
        <img alt="">
        <button type="button" class="img-thumb-rm" aria-label="Remove photo">&#x2715;</button>
        <div class="img-thumb-bar"></div>`;
      grid.appendChild(thumb);
      thumb.querySelector('img').alt = file.name;

      const bar = thumb.querySelector('.img-thumb-bar');
      requestAnimationFrame(() => {
        bar.classList.add('go');
        bar.addEventListener('animationend', () => bar.classList.replace('go', 'done'), { once: true });
      });

      thumb.querySelector('.img-thumb-rm').addEventListener('click', e => {
        e.stopPropagation();
        clearFile();
      });

      const reader = new FileReader();
      reader.onload = ev => {
        thumb.querySelector('img').src = ev.target.result;
        selectedPhoto = { name: file.name, type: file.type, dataUrl: ev.target.result };
      };
      reader.readAsDataURL(file);
    }

    idle.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', e => { setFile(e.target.files[0]); input.value = ''; });

    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', e => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('dragover'); });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      setFile(e.dataTransfer.files[0]);
    });
  })();

  /* ── QUOTE FORM (real submission to /api/quote) ───────────────
     Same endpoint, same payload shape, same honeypot and validation as the
     homepage. The API route is untouched. */
  (function () {
    const form      = document.getElementById('quote-form');
    const success   = document.getElementById('form-success');
    const errorBox  = document.getElementById('form-error');
    const submitBtn = document.getElementById('form-submit-btn');
    const submitLbl = document.getElementById('form-submit-label');
    if (!form || !success || !errorBox || !submitBtn) return;

    /* Page context: preselect this page's own service. Done silently (no "✓
       selected" chip) because nothing was just clicked — and because assigning
       .value programmatically fires no input/change event, this correctly does
       NOT count as the visitor starting the form. */
    if (form.dataset.preselectService) {
      preselectService(form.dataset.preselectService, { silent: true });
    }

    /* quote_form_start — first genuine interaction only, once per page load. */
    let startTracked = false;
    function onFirstInteraction() {
      if (startTracked) return;
      startTracked = true;
      const service = form.elements.service ? form.elements.service.value : '';
      const params = { form_location: PAGE };
      if (service) params.service_name = service; // fixed dropdown option, not free text
      trackEvent('quote_form_start', params);
    }
    form.addEventListener('input', onFirstInteraction);
    form.addEventListener('change', onFirstInteraction);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorBox.hidden = true;
      submitBtn.disabled = true;
      const originalLabel = submitLbl.textContent;
      submitLbl.textContent = 'Sending…';

      const fd = new FormData(form);
      const payload = {
        name: fd.get('name') || '',
        phone: fd.get('phone') || '',
        email: fd.get('email') || '',
        service: fd.get('service') || '',
        description: fd.get('description') || '',
        location: fd.get('location') || '',
        bedrooms: fd.get('bedrooms') || '',
        timing: fd.get('timing') || '',
        estimatorContext: fd.get('estimatorContext') || '',
        company: fd.get('company') || '', // honeypot — must stay empty
        photo: selectedPhoto,              // { name, type, dataUrl } or null
      };

      /* Non-PII analytics snapshot: a fixed dropdown value, two booleans, and
         numbers the estimator already computed. Deliberately excludes name,
         phone, email, location, description, photo filename and the payload. */
      const analytics = {
        service_name: fd.get('service') || '',
        form_location: PAGE,
        has_photo: Boolean(selectedPhoto),
        used_estimator: Boolean(fd.get('estimatorContext')) || estimatorUsed,
      };
      if (analytics.used_estimator && lastEstimate.low !== null) {
        analytics.estimate_low = lastEstimate.low;
        analytics.estimate_high = lastEstimate.high;
      }

      let httpStatus = null;
      let succeeded = false;
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        httpStatus = res.status;
        if (!res.ok) throw new Error('request failed');

        /* Fired only after the backend confirms success, and before the DOM
           updates so the conversion is recorded even if rendering hiccups. */
        succeeded = true;
        trackEvent('quote_form_success', analytics);

        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        if (!succeeded) {
          trackEvent('quote_form_error', {
            error_type: httpStatus === null ? 'network'
                      : (httpStatus === 400 || httpStatus === 422) ? 'validation'
                      : httpStatus >= 500 ? 'server'
                      : 'unknown',
            form_location: PAGE,
            service_name: analytics.service_name,
          });
        }
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } finally {
        submitBtn.disabled = false;
        submitLbl.textContent = originalLabel;
      }
    });
  })();

  /* ── NAV ──────────────────────────────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 60); }, { passive: true });

    const btn = document.getElementById('menu-btn');
    const drawer = document.getElementById('nav-drawer');
    if (btn && drawer) {
      btn.addEventListener('click', () => { const o = drawer.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); });
      drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { drawer.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }));
      document.addEventListener('click', e => { if (!nav.contains(e.target)) { drawer.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    }
  }
})();
