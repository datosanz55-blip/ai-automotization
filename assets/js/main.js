/* УралСМТ — интерактив сайта (общий для всех страниц) */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };

  // Анимации появления стартуют, когда шторка перехода открыла страницу
  function whenReady(fn) {
    if (root.classList.contains('is-ready')) fn();
    else document.addEventListener('site:ready', fn, { once: true });
  }

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Шапка и мобильное меню ---------- */
  var header = $('#header');
  var burger = $('.burger');
  var menu = $('#mobile-menu');

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ---------- Появление при скролле и счётчики ---------- */
  function countUp(el) {
    var target = +el.getAttribute('data-count');
    if (reduceMotion) { el.textContent = fmt(target); return; }
    var t0 = performance.now(), dur = 1600;
    (function step(now) {
      var p = clamp((now - t0) / dur, 0, 1);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  whenReady(function () {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      $$('[data-count]').forEach(countUp);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        var c = en.target.querySelector('[data-count]');
        if (c) countUp(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(function (el) {
      var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sib, 6) * 70 + 'ms';
      io.observe(el);
    });
  });

  /* ---------- Скролл-сцены ---------- */
  var drives = $$('.drive').map(function (sec) {
    var truck = $('.drive__truck', sec);
    return { sec: sec, truck: truck, word: $('.drive__word', sec), wheels: $$('.wheel', truck), speed: $('.speed', sec) };
  });
  var heroBg = $('.page-hero__bg');
  var splitImg = $('.split__media img');
  var whyImg = $('.why__bg img');
  var strip = $('.gallery-strip__track');
  var lastY = window.scrollY, speed = 0, ticking = false;

  function sectionProgress(el) {
    var r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - window.innerHeight), 0, 1);
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  // Доля пути элемента через экран: 0 — только показался снизу, 1 — ушёл вверх
  function passProgress(el) {
    var r = el.getBoundingClientRect(), vh = window.innerHeight;
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }

  function onScroll() {
    ticking = false;
    var y = window.scrollY, vw = window.innerWidth;
    header.classList.toggle('is-scrolled', y > 40);
    if (reduceMotion) return;

    var dp = Math.abs(y - lastY);
    lastY = y;
    speed += (dp - speed) * 0.25;

    drives.forEach(function (d) {
      if (!inView(d.sec)) return;
      var p = sectionProgress(d.sec);
      var tw = d.truck.offsetWidth;
      var x = -tw * 1.05 + p * (vw + tw * 1.1);
      d.truck.style.transform = 'translate3d(' + x + 'px,0,0)';
      var angle = (x / (tw * 38 / 640)) * 180 / Math.PI;
      d.wheels.forEach(function (w) { w.style.transform = 'rotate(' + angle + 'deg)'; });
      d.word.style.transform = 'translate3d(' + (vw * 0.55 - p * (d.word.offsetWidth + vw * 0.2)) + 'px,-78%,0)';
      d.speed.textContent = String(Math.min(99, Math.round(speed * 0.9))).padStart(2, '0');
    });

    if (heroBg && inView(heroBg)) heroBg.style.transform = 'translate3d(0,' + (y * 0.25) + 'px,0)';
    if (splitImg && inView(splitImg.parentElement)) splitImg.style.transform = 'translate3d(0,' + (-passProgress(splitImg.parentElement) * 12) + '%,0)';
    if (whyImg && inView(whyImg.parentElement)) whyImg.style.transform = 'scale(' + (1.25 - passProgress(whyImg.parentElement) * 0.2) + ')';
    if (strip && inView(strip)) strip.style.transform = 'translate3d(' + (-passProgress(strip) * (strip.scrollWidth - vw)) + 'px,0,0)';
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();
  // Плавно гасим спидометр, когда скролл остановился
  if (!reduceMotion && drives.length) setInterval(function () { if (speed > 0.5) requestTick(); }, 120);

  /* ---------- Превью услуг за курсором ---------- */
  var preview = $('.svc-preview');
  if (preview && window.matchMedia('(hover: hover)').matches) {
    var pImg = $('img', preview), px = 0, py = 0, tx = 0, ty = 0, pOn = false;
    $$('[data-preview] [data-img]').forEach(function (row) {
      row.addEventListener('mouseenter', function () { pImg.src = row.getAttribute('data-img'); preview.classList.add('is-on'); pOn = true; });
      row.addEventListener('mouseleave', function () { preview.classList.remove('is-on'); pOn = false; });
    });
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    (function follow() {
      px += (tx - px) * 0.15; py += (ty - py) * 0.15;
      preview.style.transform = 'translate3d(' + (px + 30) + 'px,' + (py - 120) + 'px,0) scale(' + (pOn ? 1 : 0.6) + ')';
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- Тарифы ---------- */
  var TARIFFS = {
    awd: { kind: 'Полноприводные', items: [
      { f: '4×4', rates: [40, 43, 46] },
      { f: '6×6', rates: [40, 43, 46] },
      { f: '8×4', rates: [40, 43, 46] }
    ] },
    road: { kind: 'Шоссейные', items: [
      { f: '4×2', rates: [38, 40, 42] },
      { f: '6×4', rates: [40, 42, 45] },
      { f: '8×4', rates: [42, 44, 47] }
    ] }
  };
  var TONNAGE = ['до 10 тонн', 'до 16 тонн', 'до 25 тонн'];

  Object.keys(TARIFFS).forEach(function (key) {
    var panel = $('[data-panel="' + key + '"]');
    if (!panel) return;
    var g = TARIFFS[key];
    panel.innerHTML = g.items.map(function (it, idx) {
      return '<article class="tariff" style="animation-delay:' + idx * 80 + 'ms">' +
        '<div class="tariff__top"><span class="tariff__formula">' + it.f + '</span><span class="tariff__kind">' + g.kind + '<br>от 10 до 25 т</span></div>' +
        '<div class="tariff__price">от <b>' + it.rates[0] + '</b> ₽/км</div>' +
        '<ul class="tariff__rows">' + it.rates.map(function (r, i) { return '<li><span>' + TONNAGE[i] + '</span><span>от ' + r + ' ₽/км</span></li>'; }).join('') + '</ul>' +
        '<button class="btn btn--dark" data-open-order data-service="Перегон колёсной техники своим ходом" data-message="Тариф: ' + g.kind.toLowerCase() + ', колёсная формула ' + it.f + '. ">Заказать перегон</button>' +
        '</article>';
    }).join('');
  });

  var tabs = $$('.tab');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = $('[data-panel="' + t.getAttribute('data-tab') + '"]');
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next); next.focus();
      }
    });
  });

  /* ---------- Калькулятор ---------- */
  var cGroup = $('#calc-group');
  if (cGroup) {
    var cFormula = $('#calc-formula'), cTon = $('#calc-tonnage');
    var cRange = $('#calc-range'), cKm = $('#calc-km'), cRate = $('#calc-rate'), cTotal = $('#calc-total');
    var fillFormulas = function () {
      cFormula.innerHTML = TARIFFS[cGroup.value].items.map(function (it, i) { return '<option value="' + i + '">' + it.f + '</option>'; }).join('');
    };
    var calc = function () {
      var g = TARIFFS[cGroup.value];
      var it = g.items[+cFormula.value || 0];
      var rate = it.rates[+cTon.value];
      var km = clamp(parseInt(cKm.value, 10) || 0, 0, 15000);
      cRate.textContent = rate;
      cTotal.textContent = fmt(rate * km);
      return { group: g.kind, formula: it.f, tonnage: TONNAGE[+cTon.value], km: km, rate: rate, total: rate * km };
    };
    cGroup.addEventListener('change', function () { fillFormulas(); calc(); });
    cFormula.addEventListener('change', calc);
    cTon.addEventListener('change', calc);
    cRange.addEventListener('input', function () { cKm.value = cRange.value; calc(); });
    cKm.addEventListener('input', function () { cRange.value = clamp(+cKm.value || 0, +cRange.min, +cRange.max); calc(); });
    fillFormulas(); calc();

    $('#calc-order').addEventListener('click', function () {
      var r = calc();
      openOrder('Перегон колёсной техники своим ходом',
        'Расчёт с сайта: ' + r.group.toLowerCase() + ', ' + r.formula + ', ' + r.tonnage + ', ' + fmt(r.km) + ' км × ' + r.rate + ' ₽/км ≈ от ' + fmt(r.total) + ' ₽. Маршрут: ');
    });
  }

  /* ---------- Карусель работ ---------- */
  var track = $('#works-track');
  var dragMoved = 0;
  if (track) {
    $$('[data-scroll]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = track.querySelector('.work');
        var step = card ? card.offsetWidth + 16 : 400;
        track.scrollBy({ left: step * +b.getAttribute('data-scroll'), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    var down = false, startX = 0, startLeft = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; dragMoved = 0; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      dragMoved = Math.max(dragMoved, Math.abs(dx));
      if (dragMoved > 5) track.classList.add('is-drag');
      track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      setTimeout(function () { track.classList.remove('is-drag'); dragMoved = 0; }, 0);
    });
  }

  /* ---------- Фильтр работ ---------- */
  var chips = $$('.chip[data-filter]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      $$('.wgrid__item').forEach(function (it, i) {
        var show = f === 'all' || it.getAttribute('data-cat') === f;
        it.classList.toggle('is-hidden', !show);
        it.classList.remove('is-pop');
        if (show && !reduceMotion) {
          void it.offsetWidth; // перезапуск анимации
          it.style.animationDelay = Math.min(i, 12) * 30 + 'ms';
          it.classList.add('is-pop');
        }
        it.classList.add('is-in');
      });
    });
  });

  /* ---------- Модальные окна ---------- */
  var modal = $('#order-modal');
  var lightbox = $('#lightbox');

  function showDialog(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
  }
  function closeDialog(d) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  $$('dialog').forEach(function (d) {
    d.addEventListener('close', function () { document.body.style.overflow = ''; });
    d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });
    $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { closeDialog(d); }); });
  });

  /* ---------- Лайтбокс с листанием ---------- */
  var lbImg = $('img', lightbox), lbCap = $('.lightbox__cap', lightbox), lbList = [], lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + lbList.length) % lbList.length;
    var b = lbList[lbIndex];
    lbImg.src = b.getAttribute('data-lightbox');
    lbImg.alt = $('img', b) ? $('img', b).alt : '';
    lbCap.textContent = b.getAttribute('data-caption') || '';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lightbox]');
    if (!b) return;
    if (dragMoved > 5) { e.preventDefault(); return; }
    var group = b.closest('.wgrid, .works__track, .photo-row') || b.parentElement;
    lbList = $$('[data-lightbox]', group).filter(function (x) { return !x.closest('.is-hidden'); });
    if (lbList.length > 1) lightbox.setAttribute('data-multi', ''); else lightbox.removeAttribute('data-multi');
    lbShow(lbList.indexOf(b));
    showDialog(lightbox);
  });
  $$('[data-lb]', lightbox).forEach(function (b) {
    b.addEventListener('click', function () { lbShow(lbIndex + +b.getAttribute('data-lb')); });
  });
  lightbox.addEventListener('keydown', function (e) {
    if (lbList.length < 2) return;
    if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
  });

  /* ---------- Заявка ---------- */
  function openOrder(service, message) {
    var form = $('form', modal);
    var sel = form.elements.service;
    if (service) {
      var found = Array.prototype.some.call(sel.options, function (o) {
        var match = o.text.replace(/ё/g, 'е').toLowerCase() === service.replace(/ё/g, 'е').toLowerCase();
        if (match) sel.value = o.value || o.text;
        return match;
      });
      if (!found) sel.selectedIndex = 0;
    }
    form.elements.message.value = message || '';
    $('.form-status', form).textContent = '';
    $('.form-status', form).className = 'form-status';
    showDialog(modal);
    setTimeout(function () { form.elements.name.focus(); }, 50);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-order]');
    if (!t) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    openOrder(t.getAttribute('data-service'), t.getAttribute('data-message'));
  });

  /* ---------- Формы ---------- */
  function maskPhone(input) {
    input.addEventListener('input', function () {
      var d = input.value.replace(/\D/g, '');
      if (!d) { input.value = ''; return; }
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ')';
      if (d.length > 4) out += ' ' + d.slice(4, 7);
      if (d.length > 7) out += '-' + d.slice(7, 9);
      if (d.length > 9) out += '-' + d.slice(9, 11);
      input.value = out;
    });
  }

  function mailtoFallback(data) {
    var lines = [
      'Заявка с сайта',
      'Услуга: ' + (data.service || '—'),
      'Имя: ' + data.name,
      'Телефон: ' + data.phone,
      data.email ? 'E-mail: ' + data.email : '',
      data.message ? 'Сообщение: ' + data.message : ''
    ].filter(Boolean).join('\n');
    window.location.href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('Заявка с сайта: ' + (data.service || 'обратный звонок')) + '&body=' + encodeURIComponent(lines);
  }

  $$('[data-lead-form]').forEach(function (form) {
    var status = $('.form-status', form);
    var btn = $('button[type="submit"]', form);
    if (form.elements.phone) maskPhone(form.elements.phone);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var el = form.elements;
      var ok = true;
      ['name', 'phone'].forEach(function (n) {
        var bad = !el[n].value.trim() || (n === 'phone' && el[n].value.replace(/\D/g, '').length < 11);
        el[n].classList.toggle('is-invalid', bad);
        if (bad) ok = false;
      });
      var consentLabel = el.consent.closest('.consent');
      consentLabel.classList.toggle('is-invalid', !el.consent.checked);
      if (!el.consent.checked) ok = false;
      if (!ok) {
        status.className = 'form-status err';
        status.textContent = 'Укажите имя, телефон и подтвердите согласие на обработку данных.';
        return;
      }
      if (el.website && el.website.value) return; // бот

      var data = {
        name: el.name.value.trim(),
        phone: el.phone.value.trim(),
        email: el.email ? el.email.value.trim() : '',
        service: el.service ? el.service.value : '',
        message: el.message ? el.message.value.trim() : '',
        page: location.href
      };

      btn.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Отправляем…';

      function done() {
        status.className = 'form-status ok';
        status.textContent = 'Спасибо! Заявка отправлена — менеджер свяжется с вами в ближайшее время.';
        form.reset();
        btn.disabled = false;
      }
      function fail() {
        btn.disabled = false;
        status.className = 'form-status';
        status.innerHTML = 'Открываем почтовую программу с готовым письмом. Если она не открылась — позвоните: <a href="tel:' + CFG.phone + '">' + CFG.phoneText + '</a>.';
        mailtoFallback(data);
      }

      if (!CFG.formEndpoint) { fail(); return; }
      var body = new FormData();
      Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
      fetch(CFG.formEndpoint, { method: 'POST', body: body, headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (res) { res && res.ok ? done() : fail(); })
        .catch(fail);
    });
  });
})();
