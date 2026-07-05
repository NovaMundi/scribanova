/* Scriba Nova — the Living Ledger
   Turns one sentence into a bespoke mini brand kit.
   Tries the Claude-backed function first, always falls back to a
   local generator so the experience never breaks. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var form     = document.getElementById('ledgerForm');
  var input    = document.getElementById('ledgerInput');
  var hint     = document.getElementById('ledgerHint');
  var thinking = document.getElementById('ledgerThinking');
  var out      = document.getElementById('ledgerOut');
  if (!form) return;

  /* Prefill chips */
  hint.querySelectorAll('b[data-fill]').forEach(function (b) {
    b.addEventListener('click', function () {
      input.value = b.getAttribute('data-fill');
      input.focus();
    });
  });

  /* ── Industry detection + palettes ─────────────────────── */
  var PALETTES = {
    food:    { name: 'Warm Roast',   sw: ['#6F4E37', '#C89F6D', '#E8D8C3', '#2E2018'], voice: ['Warm, never precious', 'Sensory and specific', 'Craft over hype'] },
    finance: { name: 'Cool Ledger',  sw: ['#1C2B3A', '#3E7CB1', '#DCE6EE', '#0E1620'], voice: ['Calm and exact', 'Trust before flair', 'Clarity as a feature'] },
    wellness:{ name: 'Still Sage',   sw: ['#44574A', '#9CB39A', '#E4EADD', '#26312A'], voice: ['Unhurried and kind', 'Grounded, not fluffy', 'Space to breathe'] },
    fashion: { name: 'Ink & Ember',  sw: ['#17140E', '#8A2B1E', '#E8D9C0', '#5A4632'], voice: ['Confident, low volume', 'Editorial and precise', 'Desire over description'] },
    family:  { name: 'Bright Day',   sw: ['#2A4D69', '#E4A33A', '#F2E4C9', '#7A3B2E'], voice: ['Playful, never childish', 'Warm and reassuring', 'Simple on purpose'] },
    tech:    { name: 'Signal',       sw: ['#141A24', '#4C7EF3', '#DDE4F0', '#0B0F16'], voice: ['Sharp and modern', 'Show, do not tell', 'Speed you can feel'] },
    default: { name: 'House Ink',    sw: ['#17140E', '#8A2B1E', '#C9B89A', '#4A443A'], voice: ['Exact over impressive', 'Confident, not loud', 'Made with intent'] }
  };

  var KEYS = [
    ['food',     /coffee|roaster|bakery|restaurant|food|kitchen|cafe|café|wine|brew|chocolate|deli|catering|butcher/i],
    ['finance',  /fintech|finance|bank|invoice|account|payment|payroll|insur|invest|lending|tax|money/i],
    ['wellness', /yoga|wellness|health|spa|meditat|therapy|fitness|nutrition|calm|mindful|clinic|dental/i],
    ['fashion',  /fashion|beauty|luxury|jewel|apparel|cosmetic|atelier|couture|boutique|salon|perfume/i],
    ['family',   /kid|child|family|parent|school|education|learn|toy|nursery|teen|baby/i],
    ['tech',     /app|saas|platform|software|ai|developer|api|dashboard|automation|startup|b2b|tool/i]
  ];

  function detect(text) {
    for (var i = 0; i < KEYS.length; i++) { if (KEYS[i][1].test(text)) return KEYS[i][0]; }
    return 'default';
  }

  /* ── Local generator (fallback / instant) ──────────────── */
  function cleanSubject(raw) {
    var s = raw.trim().replace(/^(a|an|the|my|our|we are|we're|i run|i have|it's|its)\s+/i, '');
    s = s.replace(/[.!?]+$/, '');
    return s || 'your business';
  }
  function splitPlace(subject) {
    var m = subject.match(/^(.*?)\s+(?:in|based in|located in)\s+(.+)$/i);
    if (m) return { core: m[1].trim(), place: m[2].trim() };
    return { core: subject, place: '' };
  }
  function titleCase(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function localDraft(raw) {
    var subject = cleanSubject(raw);
    var sp = splitPlace(subject);
    var core = sp.core, place = sp.place;
    var ind = detect(raw);
    var pal = PALETTES[ind];

    var taglines = [
      'The ' + core + ' people tell their friends about.',
      place ? titleCase(place) + '’s ' + core + ', done properly.' : 'Your ' + core + ', done properly.',
      'Made to be the one you come back to.',
      'Serious ' + core + '. Zero noise.'
    ];
    var tagline = taglines[raw.length % taglines.length];

    var frames = [
      { tag: 'Hook', line: 'Everyone says they do ' + core + '. Here is the difference.' },
      { tag: 'Proof', line: place ? 'Made in ' + titleCase(place) + '. Felt everywhere.' : 'Built to be the one you come back to.' },
      { tag: 'Call', line: 'See it for yourself. This week.' }
    ];

    return {
      source: subject,
      palette: pal.name,
      swatches: pal.sw,
      voice: pal.voice,
      tagline: tagline,
      frames: frames,
      engine: 'local'
    };
  }

  /* ── Render ────────────────────────────────────────────── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function render(d, seconds) {
    var sw = d.swatches.map(function (c) {
      return '<div class="draft__sw" style="background:' + esc(c) + '"><span>' + esc(c).toUpperCase() + '</span></div>';
    }).join('');
    var voice = d.voice.map(function (v) { return '<p>' + esc(v) + '</p>'; }).join('');
    var frames = d.frames.map(function (f) {
      return '<div class="draft__frame"><b>' + esc(f.tag) + '</b><p>' + esc(f.line) + '</p></div>';
    }).join('');

    var briefLink = '/support/?from=' + encodeURIComponent(d.source) + '#brief';
    out.innerHTML =
      '<div class="draft">' +
        '<div class="draft__row"><div class="draft__label">Tagline</div><div class="draft__tagline">' + esc(d.tagline) + '</div></div>' +
        '<div class="draft__row"><div class="draft__label">Brand voice</div><div class="draft__lines">' + voice + '</div></div>' +
        '<div class="draft__row"><div class="draft__label">Palette — ' + esc(d.palette) + '</div><div class="draft__swatches" style="margin-bottom:1.1rem">' + sw + '</div></div>' +
        '<div class="draft__row"><div class="draft__label">Campaign concept</div><div class="draft__frames">' + frames + '</div></div>' +
      '</div>' +
      '<div class="draft__seal">' +
        '<div class="stamp"><span class="wax" aria-hidden="true"></span>Drafted for &ldquo;' + esc(d.source) + '&rdquo; in ' + seconds + 's</div>' +
        '<div class="draft__actions">' +
          '<a class="btn btn-ox" href="' + briefLink + '">Bring the real brief</a>' +
        '</div>' +
      '</div>';
    out.classList.add('show');
    if (window.SN_reveal) window.SN_reveal();
  }

  /* ── Thinking sequence ─────────────────────────────────── */
  var STEPS = ['Reading your brief', 'Finding the angle', 'Setting the tagline', 'Mixing a palette', 'Sketching the campaign'];

  function runThinking(done) {
    if (reduced) { done(); return; }
    thinking.classList.add('show');
    var i = 0;
    function step() {
      if (i >= STEPS.length) { thinking.classList.remove('show'); thinking.innerHTML = ''; done(); return; }
      thinking.innerHTML = STEPS[i] + '<span class="caret2"></span>';
      i++;
      setTimeout(step, 360);
    }
    step();
  }

  /* ── Try the server (Claude) then fall back ────────────── */
  function fetchDraft(raw) {
    return fetch('/api/generate-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: raw })
    }).then(function (r) {
      if (!r.ok) throw new Error('bad');
      return r.json();
    }).then(function (data) {
      if (!data || !data.tagline) throw new Error('shape');
      data.source = data.source || cleanSubject(raw);
      data.engine = 'claude';
      return data;
    });
  }

  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value.trim();
    if (!raw || busy) { if (!raw) input.focus(); return; }
    busy = true;
    out.classList.remove('show');
    hint.style.display = 'none';
    var t0 = Date.now();

    var settled = false;
    var payload = null;

    /* Kick off the server request in parallel with the animation */
    var pending = fetchDraft(raw).then(function (d) { payload = d; }).catch(function () { payload = null; });

    runThinking(function () {
      pending.then(function () {
        var d = payload || localDraft(raw);
        var seconds = Math.max(3, Math.round((Date.now() - t0) / 1000));
        render(d, seconds);
        busy = false;
      });
    });

    /* Safety: if the server hangs, do not wait forever */
    setTimeout(function () {
      if (!settled && !payload && !out.classList.contains('show')) {
        settled = true;
      }
    }, 6000);
  });

})();
