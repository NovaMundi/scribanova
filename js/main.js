/* Scriba Nova — main.js (nav, reveal, form) */

(function () {
  'use strict';

  /* Nav scroll state */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 20); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Mobile nav */
  var burger = document.getElementById('burger');
  var mobileNav = document.getElementById('mobileNav');
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      var open = this.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      this.setAttribute('aria-expanded', open);
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Scroll reveal, re-scannable for injected content */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = null;
  if ('IntersectionObserver' in window && !reduced) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  }
  window.SN_reveal = function () {
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    });
  };
  window.SN_reveal();

  /* Margin Notes: copy a permalink to a single note */
  document.querySelectorAll('.note__share').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-anchor');
      var url = window.location.origin + window.location.pathname + '#' + id;
      var done = function () {
        var label = btn.textContent;
        btn.textContent = 'Link copied';
        btn.classList.add('copied');
        setTimeout(function () { btn.textContent = label; btn.classList.remove('copied'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { window.location.hash = id; done(); });
      } else {
        window.location.hash = id;
        done();
      }
    });
  });

  /* Prefill the brief field from ?from= on the support page */
  try {
    var params = new URLSearchParams(window.location.search);
    var from = params.get('from');
    var briefField = document.getElementById('briefWhat');
    if (from && briefField && !briefField.value) briefField.value = from;
  } catch (e) {}

  /* Support / brief form success */
  var forms = document.querySelectorAll('form[data-success]');
  forms.forEach(function (form) {
    var success = document.getElementById(form.getAttribute('data-success'));
    form.addEventListener('submit', function () {
      setTimeout(function () {
        if (success) { success.style.display = 'block'; form.reset(); success.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }, 400);
    });
  });

})();
