/* Site behaviour: theme, mobile menu, copy email, scroll reveal, section highlight. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  /* Theme: follows the system until the visitor picks one; the choice is remembered per browser. */
  var KEY = 'op-theme';
  try { var saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved); } catch (e) {}
  document.getElementById('theme-btn').addEventListener('click', function () {
    var current = root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });

  /* Mobile menu */
  var nav = document.getElementById('site-nav');
  var menuBtn = document.getElementById('menu-btn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* Copy email */
  var status = document.getElementById('copy-status');
  document.getElementById('copy-btn').addEventListener('click', function () {
    var email = document.getElementById('email-text').textContent;
    var uk = document.documentElement.lang === 'uk';
    var done = function () { status.textContent = uk ? 'Адресу скопійовано.' : 'Address copied.'; };
    var fail = function () { status.textContent = uk ? 'Копіювання тут заблоковано. Виділіть адресу та скопіюйте вручну.' : 'Copying is blocked here. Select the address and copy it manually.'; };
    try { navigator.clipboard.writeText(email).then(done, fail); } catch (e) { fail(); }
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }

  /* Reveal on scroll */
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); revealer.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

  /* Highlight the section currently in view */
  var links = {};
  nav.querySelectorAll('a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      Object.keys(links).forEach(function (id) { links[id].removeAttribute('aria-current'); });
      if (links[entry.target.id]) links[entry.target.id].setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });
})();
