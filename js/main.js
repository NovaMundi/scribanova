/* Scriba Nova — main.js */

(function () {
  'use strict';

  /* ── Mobile nav ────────────────────────────────────────── */
  const burger  = document.getElementById('burger');
  const mobileNav = document.getElementById('mobileNav');

  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      const open = this.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      this.setAttribute('aria-expanded', open);
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Support form ──────────────────────────────────────── */
  const form    = document.getElementById('supportForm');
  const success = document.getElementById('formSuccess');

  if (form) {
    form.addEventListener('submit', function (e) {
      // Netlify Forms handles the actual submission
      // Show success message after brief delay so Netlify can process
      setTimeout(function () {
        if (success) {
          success.style.display = 'block';
          form.reset();
          success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 400);
    });
  }

  /* ── Animate elements on scroll ────────────────────────── */
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.service-card, .why-card, .stats__item').forEach(function (el) {
    el.classList.add('fade-up');
    observer.observe(el);
  });

})();
