(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var darkMQ = matchMedia('(prefers-color-scheme: dark)');

  /* ---------- Theme ---------- */
  var themeBtn = document.querySelector('.theme-btn');
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : darkMQ.matches; }
  function syncTheme() {
    var dark = isDark();
    root.classList.toggle('is-light', !dark);
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    if (radar) radar.recolor();
  }
  themeBtn.addEventListener('click', function () {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    syncTheme();
  });
  darkMQ.addEventListener('change', syncTheme);

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var navLinks = document.getElementById('nav-links');
  function setMenu(open) {
    navLinks.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!navLinks.classList.contains('open')); });
  navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });

  /* ---------- Active section in nav ---------- */
  var links = {};
  navLinks.querySelectorAll('a').forEach(function (a) { links[a.hash.slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      Object.keys(links).forEach(function (id) { links[id].removeAttribute('aria-current'); });
      if (links[en.target.id]) links[en.target.id].setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section[id]').forEach(function (s) { spy.observe(s); });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMQ.matches || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rev = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); rev.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { rev.observe(el); });
  }

  /* ---------- Project filters ---------- */
  var chips = document.querySelectorAll('.filters .chip');
  var cards = document.querySelectorAll('.cards .card');
  var status = document.getElementById('filter-status');
  function applyFilter(chip) {
    var f = chip.dataset.filter, n = 0;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
    cards.forEach(function (card) {
      var show = f === 'all' || card.dataset.tags.split(' ').indexOf(f) > -1;
      card.hidden = !show;
      if (show) n++;
    });
    status.textContent = 'Showing ' + n + ' project' + (n === 1 ? '' : 's') + (f === 'all' ? '' : ' tagged ' + chip.textContent);
  }
  chips.forEach(function (chip) { chip.addEventListener('click', function () { applyFilter(chip); }); });
  // A service "proof" link must still land on its card if a filter has hidden it.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#p-"]');
    var card = a && document.getElementById(a.hash.slice(1));
    if (card && card.hidden) applyFilter(chips[0]);
  });

  /* ---------- Hero radar (canvas) ---------- */
  var radar = (function () {
    var cv = document.getElementById('radar');
    if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext('2d');
    var size = 0, colors = {}, angle = -Math.PI / 2, raf = 0, visible = true, last = 0;
    // Contacts on the scope, labelled with the domains he works in.
    var blips = [
      { a: 0.6, r: 0.62, label: 'ESP32' }, { a: 1.9, r: 0.42, label: 'UART' },
      { a: 2.9, r: 0.74, label: 'CAN' }, { a: 4.1, r: 0.55, label: 'AIS' },
      { a: 5.2, r: 0.8, label: 'RFID' }, { a: 3.6, r: 0.25, label: 'IDS' }
    ];
    function recolor() {
      var cs = getComputedStyle(root);
      colors.line = cs.getPropertyValue('--accent').trim();
      colors.blip = cs.getPropertyValue('--phosphor').trim();
      colors.text = cs.getPropertyValue('--muted').trim();
      draw();
    }
    function resize() {
      var d = Math.min(window.devicePixelRatio || 1, 2);
      size = cv.clientWidth;
      cv.width = cv.height = Math.round(size * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      draw();
    }
    function draw() {
      if (!size) return;
      var c = size / 2, R = c - 6, i;
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
      // Range rings and cross-hair
      ctx.globalAlpha = 0.35;
      for (i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(c, c, R * i / 4, 0, 7); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
      // Bearing ticks every 10 degrees
      ctx.globalAlpha = 0.5;
      for (i = 0; i < 36; i++) {
        var t = i * Math.PI / 18, k = i % 9 === 0 ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(t) * R, c + Math.sin(t) * R);
        ctx.lineTo(c + Math.cos(t) * (R - k), c + Math.sin(t) * (R - k));
        ctx.stroke();
      }
      // Sweep: a fading wedge trailing the beam
      var trail = 1.1, steps = 24;
      ctx.fillStyle = colors.line;
      for (i = 0; i < steps; i++) {
        ctx.globalAlpha = 0.22 * (1 - i / steps);
        ctx.beginPath(); ctx.moveTo(c, c);
        ctx.arc(c, c, R, angle - trail * (i + 1) / steps, angle - trail * i / steps);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.9; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(angle) * R, c + Math.sin(angle) * R); ctx.stroke();
      // Blips glow when the beam passes, then fade
      ctx.font = '600 ' + Math.max(10, size / 36) + 'px ui-monospace, Consolas, monospace';
      blips.forEach(function (b) {
        var since = ((angle - b.a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        var glow = reduceMQ.matches ? 0.8 : Math.max(0.15, 1 - since / 4);
        var x = c + Math.cos(b.a) * R * b.r, y = c + Math.sin(b.a) * R * b.r;
        ctx.globalAlpha = glow;
        ctx.fillStyle = colors.blip;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
        ctx.globalAlpha = glow * 0.35;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        ctx.globalAlpha = Math.max(0.45, glow);
        ctx.fillStyle = colors.text;
        ctx.fillText(b.label, x + 10, y - 8);
      });
      ctx.globalAlpha = 1;
    }
    function loop(ts) {
      raf = 0;
      if (!visible || document.hidden || reduceMQ.matches) return;
      if (last) angle += Math.min(ts - last, 50) * 0.0011;
      last = ts;
      draw();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduceMQ.matches) { last = 0; raf = requestAnimationFrame(loop); } }
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }).observe(cv);
    document.addEventListener('visibilitychange', start);
    reduceMQ.addEventListener('change', function () { draw(); start(); });
    window.addEventListener('resize', resize);
    // Initial still frame, with the beam pointing at a contact.
    angle = 0.9;
    return { recolor: recolor, init: function () { recolor(); resize(); start(); } };
  })();

  syncTheme();
  if (radar) radar.init();
})();
