/* Scriba Nova — hero signal field.
   A calm dot grid on dark. Dots near the cursor brighten and drift
   toward it, and a soft link forms between the closest ones. Modern,
   restrained, no neural-blob cliche. Static frame under reduced motion. */

(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, dpr, cols, rows, GAP = 34, dots = [];
  var mouse = { x: -9999, y: -9999, active: false };
  var raf = null;

  function build() {
    var rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    cols = Math.ceil(W / GAP) + 1;
    rows = Math.ceil(H / GAP) + 1;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        dots.push({ ox: x * GAP, oy: y * GAP, x: x * GAP, y: y * GAP });
      }
    }
  }

  function paintStatic() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      ctx.beginPath();
      ctx.arc(d.ox, d.oy, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,150,235,.16)';
      ctx.fill();
    }
  }

  var R = 150;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dx = mouse.x - d.ox, dy = mouse.y - d.oy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var near = mouse.active && dist < R;

      var tx = d.ox, ty = d.oy, size = 1, alpha = 0.16;
      if (near) {
        var pull = (1 - dist / R);
        tx = d.ox + dx * 0.16 * pull;
        ty = d.oy + dy * 0.16 * pull;
        size = 1 + pull * 1.7;
        alpha = 0.16 + pull * 0.55;
      }
      d.x += (tx - d.x) * 0.14;
      d.y += (ty - d.y) * 0.14;

      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(134,165,255,' + alpha.toFixed(3) + ')';
      ctx.fill();

      if (near && dist < R * 0.6) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = 'rgba(91,132,255,' + (0.12 * (1 - dist / (R * 0.6))).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  build();

  if (reduced) {
    paintStatic();
  } else {
    var host = canvas.parentElement;
    host.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    }, { passive: true });
    host.addEventListener('mouseleave', function () { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });

    // Pause when the hero scrolls out of view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
          else if (raf) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(canvas);
    } else {
      raf = requestAnimationFrame(frame);
    }
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { build(); if (reduced) paintStatic(); }, 200);
  }, { passive: true });

  // Safety: if layout was not ready at init, rebuild once loaded
  window.addEventListener('load', function () {
    if (!W || W < 2) { build(); if (reduced) paintStatic(); }
  });

})();
