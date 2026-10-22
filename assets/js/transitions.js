/* Переходы между страницами: шторка закрывает экран, затем открывает новую страницу */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var titleEl = document.getElementById('pt-title');
  var LEAVE_MS = 720;

  // Подписи для шторки по имени файла
  var TITLES = {
    'index.html': 'Главная',
    'about.html': 'О компании',
    'services.html': 'Услуги',
    'peregon.html': 'Перегон своим ходом',
    'tral.html': 'Перевозка тралом',
    'zip.html': 'Монтаж и крепление ЗИП',
    'adblue.html': 'Отключение AdBlue',
    'tariffs.html': 'Тарифы',
    'works.html': 'Наши работы',
    'drivers.html': 'Водителям',
    'contacts.html': 'Контакты',
    'policy.html': 'Политика'
  };

  function fileOf(url) {
    var name = url.pathname.split('/').pop();
    return name === '' ? 'index.html' : name;
  }

  function ready() {
    if (root.classList.contains('is-ready')) return;
    root.classList.add('is-ready');
    document.dispatchEvent(new Event('site:ready'));
  }

  /* ---------- Приход на страницу ---------- */
  function reveal() {
    if (!root.classList.contains('pt-enter')) { ready(); return; }
    root.classList.add('pt-reveal');
    // Контент первого экрана начинает анимацию, пока шторка ещё уезжает
    setTimeout(ready, 260);
    setTimeout(function () { root.classList.remove('pt-enter', 'pt-reveal'); }, 1000);
  }

  if (root.classList.contains('pt-enter')) {
    // Ждём шрифты, но не дольше 600 мс, чтобы шторка не висела
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 600); })]).then(function () {
      requestAnimationFrame(function () { requestAnimationFrame(reveal); });
    });
  } else {
    ready();
  }

  // Возврат кнопкой «Назад» из кэша браузера — убрать закрытую шторку
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      root.classList.remove('pt-leave', 'pt-enter', 'pt-reveal');
      ready();
    }
  });

  /* ---------- Уход со страницы ---------- */
  function isInternal(a, e) {
    if (!a || e.defaultPrevented || e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto|tel):/i.test(href)) return false;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    // Ссылка на якорь этой же страницы — обычная прокрутка
    if (url.pathname === location.pathname && url.search === location.search) return false;
    return url;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    var url = isInternal(a, e);
    if (!url || reduceMotion) return;
    e.preventDefault();
    if (root.classList.contains('pt-leave')) return;

    var title = TITLES[fileOf(url)] || a.textContent.trim();
    titleEl.textContent = title;
    try { sessionStorage.setItem('pt-title', title); } catch (err) {}
    root.classList.add('pt-leave');
    setTimeout(function () { location.href = url.href; }, LEAVE_MS);
  });

  /* ---------- Предзагрузка страницы при наведении ---------- */
  var prefetched = {};
  function prefetch(e) {
    var a = e.target.closest && e.target.closest('a');
    var url = isInternal(a, { button: 0 });
    if (!url) return;
    var href = url.href.split('#')[0];
    if (prefetched[href]) return;
    prefetched[href] = true;
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }
  document.addEventListener('mouseover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });
})();
