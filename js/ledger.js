/* Scriba Nova — the Living Ledger
   Turns one sentence into a bespoke starter brand kit.
   Tries the Claude-backed function first, always falls back to a
   local generator. Renders as staged "writing" theatre. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var form     = document.getElementById('ledgerForm');
  var input    = document.getElementById('ledgerInput');
  var goBtn    = document.querySelector('.ledger__go');
  var hint     = document.getElementById('ledgerHint');
  var out      = document.getElementById('ledgerOut');
  var ledger   = document.getElementById('ledger');
  if (!form) return;

  /* Prefill chips */
  hint.querySelectorAll('b[data-fill]').forEach(function (b) {
    b.addEventListener('click', function () {
      input.value = b.getAttribute('data-fill');
      input.focus();
    });
  });

  /* ── Industry detection + local palettes ───────────────── */
  var PALETTES = {
    food:    { name: 'Warm Roast',  sw: ['#6F4E37', '#C89F6D', '#E8D8C3', '#2E2018'], voice: ['Warm, never precious', 'Sensory and specific', 'Craft over hype'] },
    finance: { name: 'Cool Ledger', sw: ['#1C2B3A', '#3E7CB1', '#DCE6EE', '#0E1620'], voice: ['Calm and exact', 'Trust before flair', 'Clarity as a feature'] },
    wellness:{ name: 'Still Sage',  sw: ['#44574A', '#9CB39A', '#E4EADD', '#26312A'], voice: ['Unhurried and kind', 'Grounded, not fluffy', 'Space to breathe'] },
    fashion: { name: 'Ink & Ember', sw: ['#17140E', '#8A2B1E', '#E8D9C0', '#5A4632'], voice: ['Confident, low volume', 'Editorial and precise', 'Desire over description'] },
    family:  { name: 'Bright Day',  sw: ['#2A4D69', '#E4A33A', '#F2E4C9', '#7A3B2E'], voice: ['Playful, never childish', 'Warm and reassuring', 'Simple on purpose'] },
    tech:    { name: 'Signal',      sw: ['#141A24', '#4C7EF3', '#DDE4F0', '#0B0F16'], voice: ['Sharp and modern', 'Show, do not tell', 'Speed you can feel'] },
    default: { name: 'House Ink',   sw: ['#17140E', '#8A2B1E', '#C9B89A', '#4A443A'], voice: ['Exact over impressive', 'Confident, not loud', 'Made with intent'] }
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

  /* ── Local generator (fallback) ────────────────────────── */
  function cleanSubject(raw) {
    var s = raw.trim().replace(/^(a|an|the|my|our|we are|we're|i run|i have|it's|its)\s+/i, '');
    return (s.replace(/[.!?]+$/, '')) || 'your business';
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
    var pal = PALETTES[detect(raw)];

    var taglines = [
      'The ' + core + ' people tell their friends about.',
      place ? titleCase(place) + '’s ' + core + ', done properly.' : 'Your ' + core + ', done properly.',
      'Made to be the one you come back to.',
      'Serious ' + core + '. Zero noise.'
    ];

    return {
      source: subject,
      palette: pal.name,
      swatches: pal.sw,
      voice: pal.voice,
      tagline: taglines[raw.length % taglines.length],
      audience: [
        'Your real buyer is the one who already tried the cheap option and regretted it.',
        'They are not buying ' + core + '. They are buying the confidence it works.'
      ],
      heroLine: titleCase(core) + ' without the second-guessing.',
      ad: {
        headline: 'Finally, ' + core + ' done right.',
        body: 'You have seen the mediocre version. This is the other kind. See the difference this week.'
      },
      moves: [
        { move: 'Claim one sharp position and say it everywhere, identically.', why: 'Consistency compounds; scattered messages reset trust to zero each time.' },
        { move: 'Publish one honest piece that answers your buyer’s biggest doubt.', why: 'The doubt is the last thing standing between reading and buying.' },
        { move: 'Put one clear offer on the homepage and measure it.', why: 'One measurable offer beats five vague ones you cannot learn from.' }
      ],
      taglineWhy: 'Built from how you describe yourself; specific enough to be remembered.',
      voiceWhy: 'Matches what your kind of buyer expects to hear before trusting.',
      paletteWhy: 'Chosen to fit your sector without looking like everyone in it.',
      heroWhy: 'Leads with the outcome your buyer wants, not with your category.',
      frames: [
        { tag: 'Hook', line: 'Everyone says they do ' + core + '. Here is the difference.' },
        { tag: 'Proof', line: place ? 'Made in ' + titleCase(place) + '. Felt everywhere.' : 'Built to be the one you come back to.' },
        { tag: 'Call', line: 'See it for yourself. This week.' }
      ],
      engine: 'local'
    };
  }

  /* ── Rendering (staged writing theatre) ────────────────── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function why(text) {
    return text ? '<p class="draft__why">Because ' + esc(String(text).replace(/^because\s+/i, '')) + '</p>' : '';
  }

  function rowsFor(d) {
    var rows = [];

    if (d.observations && d.observations.length) {
      rows.push({
        label: 'What we read on your site',
        html: '<div class="draft__obs">' + d.observations.map(function (o) {
          return '<div class="draft__ob"><q>' + esc(o.quote) + '</q><p>' + esc(o.insight) + '</p></div>';
        }).join('') + '</div>'
      });
    }

    rows.push({ label: 'Tagline', html: '<div class="draft__tagline" style="color:' + esc((d.swatches && d.swatches[0]) || 'inherit') + '">' + esc(d.tagline) + '</div>' + why(d.taglineWhy) });

    if (d.audience && d.audience.length) {
      rows.push({ label: 'Who actually buys this', html: '<div class="draft__lines">' + d.audience.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' });
    }

    rows.push({ label: 'Brand voice', html: '<div class="draft__lines">' + d.voice.map(function (v) { return '<p>' + esc(v) + '</p>'; }).join('') + '</div>' + why(d.voiceWhy) });

    rows.push({
      label: 'Your palette — ' + esc(d.palette),
      html: '<div class="draft__swatches" style="margin-bottom:1.4rem">' + d.swatches.map(function (c) {
        return '<div class="draft__sw" style="background:' + esc(c) + '"><span>' + esc(c).toUpperCase() + '</span></div>';
      }).join('') + '</div>' + why(d.paletteWhy) + '<p class="draft__note">Yours, not ours. We write in ink; your brand gets its own colours.</p>'
    });

    if (d.heroLine) {
      rows.push({ label: 'Landing page opener', html: '<div class="draft__hero">' + esc(d.heroLine) + '</div>' + why(d.heroWhy) });
    }

    if (d.ad && d.ad.headline) {
      rows.push({ label: 'Sample ad', html: '<div class="draft__ad"><strong>' + esc(d.ad.headline) + '</strong><p>' + esc(d.ad.body) + '</p></div>' });
    }

    rows.push({ label: 'Campaign concept', html: '<div class="draft__frames">' + d.frames.map(function (f) {
      return '<div class="draft__frame"><b>' + esc(f.tag) + '</b><p>' + esc(f.line) + '</p></div>';
    }).join('') + '</div>' });

    if (d.moves && d.moves.length) {
      rows.push({ label: 'First three moves', html: '<ol class="draft__moves">' + d.moves.map(function (m) {
        var move = (typeof m === 'string') ? { move: m, why: '' } : m;
        return '<li>' + esc(move.move) + (move.why ? '<span class="draft__movewhy">' + esc(move.why) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' });
    }

    return rows;
  }

  function sealHtml(d, seconds) {
    var briefLink = '/support/?from=' + encodeURIComponent(d.source) + '#brief';
    return '<div class="draft__seal">' +
      '<div class="stamp"><span class="wax" aria-hidden="true"></span>Drafted for &ldquo;' + esc(d.source) + '&rdquo; in ' + seconds + 's</div>' +
      '<div class="draft__actions"><a class="btn btn-ox" href="' + briefLink + '">Bring the real brief</a></div>' +
    '</div>';
  }

  function render(d, seconds, done) {
    var rows = rowsFor(d);
    var container = document.createElement('div');
    container.className = 'draft';
    out.innerHTML = '';
    out.appendChild(container);
    out.classList.add('show');

    function addRow(i) {
      if (i >= rows.length) {
        var seal = document.createElement('div');
        seal.innerHTML = sealHtml(d, seconds);
        var el = seal.firstChild;
        el.classList.add('draft__written');
        out.appendChild(el);
        void el.offsetHeight; // force reflow so the transition always plays
        el.classList.add('on');
        if (done) done();
        return;
      }
      var row = document.createElement('div');
      row.className = 'draft__row draft__written';
      row.innerHTML = '<div class="draft__label">' + rows[i].label + '</div>' + rows[i].html;
      container.appendChild(row);
      void row.offsetHeight;
      row.classList.add('on');
      if (i <= 1 && !reduced) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(function () { addRow(i + 1); }, reduced ? 0 : 480);
    }
    addRow(0);
  }

  /* ── Progress state while generating ───────────────────── */
  var STEPS = ['Reading your brief', 'Finding the angle', 'Naming your buyer', 'Setting the tagline', 'Mixing your palette', 'Sketching the campaign', 'Planning the first moves'];
  var STEPS_SITE = ['Opening your website', 'Reading your homepage', 'Noting what you stand for', 'Finding the angle', 'Naming your buyer', 'Setting the tagline', 'Mixing your palette', 'Sketching the campaign', 'Planning the first moves'];
  var stepTimer = null;

  function startProgress(isUrl) {
    var steps = isUrl ? STEPS_SITE : STEPS;
    goBtn.disabled = true;
    goBtn.dataset.label = goBtn.textContent;
    goBtn.textContent = 'Drafting…';
    out.innerHTML = '<div class="draft"><div class="draft__row"><div class="draft__label">Working</div><div class="ledger__writing" id="ledgerWriting">' + steps[0] + '<span class="caret2"></span></div></div></div>';
    out.classList.add('show');
    if (!reduced) out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var i = 1;
    var w = document.getElementById('ledgerWriting');
    stepTimer = setInterval(function () {
      if (w) w.innerHTML = steps[Math.min(i, steps.length - 1)] + '<span class="caret2"></span>';
      i++;
    }, 1100);
  }
  function stopProgress() {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    goBtn.disabled = false;
    goBtn.textContent = goBtn.dataset.label || 'Draft it';
  }

  /* ── Server call with fallback ─────────────────────────── */
  function looksLikeUrl(s) {
    if (/\s/.test(s.trim())) return false;
    return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#]\S*)?$/i.test(s.trim());
  }

  function fetchDraft(raw) {
    var isUrl = looksLikeUrl(raw);
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timeout = setTimeout(function () { if (ctl) ctl.abort(); }, isUrl ? 20000 : 14000);
    return fetch('/api/generate-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isUrl ? { url: raw } : { prompt: raw }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timeout);
      if (!r.ok) throw new Error('bad');
      return r.json();
    }).then(function (data) {
      if (!data || !data.tagline) throw new Error('shape');
      data.source = data.source || cleanSubject(raw);
      data.engine = 'claude';
      return data;
    });
  }

  function fallbackFor(raw) {
    if (!looksLikeUrl(raw)) return localDraft(raw);
    // Reading a site needs the server; fall back to the domain name as brief
    var name = raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0];
    var d = localDraft(name.split('.')[0].replace(/[-_]/g, ' ') + ' (' + name + ')');
    d.source = name;
    d.observations = [];
    return d;
  }

  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value.trim();
    if (!raw || busy) { if (!raw) input.focus(); return; }
    busy = true;
    hint.style.display = 'none';
    var t0 = Date.now();
    startProgress(looksLikeUrl(raw));

    fetchDraft(raw).catch(function () { return null; }).then(function (d) {
      var kit = d || fallbackFor(raw);
      var seconds = Math.max(3, Math.round((Date.now() - t0) / 1000));
      var minTheatre = reduced ? 0 : 2600;
      var elapsed = Date.now() - t0;
      setTimeout(function () {
        stopProgress();
        render(kit, seconds, function () { busy = false; });
      }, Math.max(0, minTheatre - elapsed));
    });
  });

})();
