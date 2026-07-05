/* Scriba Nova — main.js (Exclusive Edition) */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Nav scroll state ──────────────────────────────────── */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile nav ────────────────────────────────────────── */
  var burger = document.getElementById('burger');
  var mobileNav = document.getElementById('mobileNav');
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      var open = this.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      this.setAttribute('aria-expanded', open);
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Scroll reveal ─────────────────────────────────────── */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window && !reducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── Count-up numbers ──────────────────────────────────── */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reducedMotion) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countObserver.unobserve(entry.target);
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var start = null;
        var dur = 1600;
        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(eased * target) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ── Cursor glow (desktop only) ────────────────────────── */
  var glow = document.querySelector('.cursor-glow');
  if (glow && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    var gx = 0, gy = 0, cx = 0, cy = 0, glowActive = false;
    document.addEventListener('mousemove', function (e) {
      gx = e.clientX; gy = e.clientY;
      if (!glowActive) { glowActive = true; glow.style.opacity = '1'; tick(); }
    }, { passive: true });
    var tick = function () {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.left = cx + 'px';
      glow.style.top = cy + 'px';
      requestAnimationFrame(tick);
    };
  }

  /* ── Card spotlight (mouse-tracked gradient) ───────────── */
  document.querySelectorAll('.service-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ── Magnetic buttons ──────────────────────────────────── */
  if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.btn').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.25;
        var y = (e.clientY - r.top - r.height / 2) * 0.35;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      }, { passive: true });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  /* ── Hero video fade-in ────────────────────────────────── */
  var heroVideo = document.getElementById('heroVideo');
  if (heroVideo) {
    if (reducedMotion) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
    } else {
      heroVideo.playbackRate = 0.65; // calm, ambient drift that matches the parallax pace
      var showVideo = function () { heroVideo.classList.add('loaded'); };
      if (heroVideo.readyState >= 3) showVideo();
      else heroVideo.addEventListener('canplay', showVideo, { once: true });
    }
  }

  /* ── Hero parallax drift ───────────────────────────────── */
  var heroMedia = document.querySelector('.hero__media');
  var hero = document.querySelector('.hero');
  if (heroMedia && hero && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    var px = 0, py = 0, tx = 0, ty = 0, parallaxRunning = false;
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 48;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 48;
      if (!parallaxRunning) { parallaxRunning = true; pTick(); }
    }, { passive: true });
    var pTick = function () {
      px += (tx - px) * 0.06;
      py += (ty - py) * 0.06;
      heroMedia.style.transform = 'translate(' + px + 'px,' + py + 'px) scale(1.04)';
      requestAnimationFrame(pTick);
    };
  }

  /* ── Hero particle network ─────────────────────────────── */
  var canvas = document.getElementById('heroCanvas');
  if (canvas && !reducedMotion) {
    var ctx = canvas.getContext('2d');
    var particles = [];
    var mouse = { x: -9999, y: -9999 };
    var W, H, COUNT;

    var resize = function () {
      var rect = canvas.parentElement.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      COUNT = Math.min(Math.floor(W * H / 16000), 110);
      if (particles.length > COUNT) particles.length = COUNT;
      while (particles.length < COUNT) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6
        });
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    canvas.parentElement.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }, { passive: true });
    canvas.parentElement.addEventListener('mouseleave', function () {
      mouse.x = -9999; mouse.y = -9999;
    }, { passive: true });

    var LINK = 130;
    var draw = function () {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        // Gentle attraction to the mouse
        var dxm = mouse.x - p.x, dym = mouse.y - p.y;
        var dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < 220 && dm > 0.001) {
          p.vx += (dxm / dm) * 0.012;
          p.vy += (dym / dm) * 0.012;
        }

        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.995; p.vy *= 0.995;
        // keep a baseline drift
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.02;
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.02;

        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        p.x = Math.max(0, Math.min(W, p.x));
        p.y = Math.max(0, Math.min(H, p.y));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96,165,250,.5)';
        ctx.fill();

        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            var a = (1 - Math.sqrt(d2) / LINK) * 0.22;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(59,130,246,' + a + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ── Support form success ──────────────────────────────── */
  var form = document.getElementById('supportForm');
  var success = document.getElementById('formSuccess');
  if (form && success) {
    form.addEventListener('submit', function () {
      setTimeout(function () {
        success.style.display = 'block';
        form.reset();
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 400);
    });
  }

})();
