/* ============================================================
   main.js — minimal interaction layer (plain script)
   Reveal-on-scroll, nav blur, mobile menu, active link,
   subtle opacity page transition, lightweight preloader.
   No cursor / HUD / marquee — this is a quiet, minimal build.
   ============================================================ */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── PRELOADER (first load per tab only) ── */
  var pre = document.getElementById('preloader');
  if (pre) {
    var seal = function () {
      pre.classList.add('done');
      try { sessionStorage.setItem('sd-loaded', '1'); } catch (e) {}
    };
    var seen = false;
    try { seen = !!sessionStorage.getItem('sd-loaded'); } catch (e) {}
    if (seen || reduced) {
      seal();
    } else {
      window.addEventListener('load', function () { setTimeout(seal, 900); });
      setTimeout(seal, 2600); // failsafe
    }
  }

  /* ── NAV: blur on scroll ── */
  var nav = document.getElementById('nav');
  var onScroll = function () { if (nav) nav.classList.toggle('solid', pageYOffset > 40); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── MOBILE MENU ── */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () { document.body.classList.toggle('menu-open'); });

  /* ── ACTIVE LINK by filename ── */
  var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  Array.prototype.forEach.call(document.querySelectorAll('.nav-links a, .mobile-menu a'), function (a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path || ((path === '' || path === 'index.html') && (href === 'index.html' || href === './'))) {
      a.classList.add('active');
    }
  });

  /* ── REVEAL ON SCROLL ── */
  var revs = document.querySelectorAll('.reveal');
  if (revs.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(revs, function (el) { el.classList.add('visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
      Array.prototype.forEach.call(revs, function (el) { io.observe(el); });
    }
  }

  /* ── PAGE TRANSITIONS (subtle opacity wash) ── */
  var trans = document.getElementById('transition');
  var isInternal = function (a) {
    var href = a.getAttribute('href');
    if (!href || a.target === '_blank') return false;
    if (href.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|https?:)/i.test(href)) return false;
    return /\.html$/i.test(href) || href === './' || href === '/';
  };
  if (trans && !reduced) {
    document.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target.closest('a');
      if (!a || !isInternal(a)) return;
      e.preventDefault();
      var dest = a.getAttribute('href');
      document.body.classList.remove('menu-open');
      trans.classList.add('cover');
      setTimeout(function () { location.href = dest; }, 460);
    });
    // clear wash if restored from bfcache
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) trans.classList.remove('cover'); });
  }
})();
