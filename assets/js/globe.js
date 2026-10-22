/* Точечный глобус с маршрутами перегонов (canvas, без библиотек) */
(function () {
  'use strict';

  var canvas = document.getElementById('globe');
  if (!canvas || !window.LAND_DOTS) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var RAD = Math.PI / 180;
  var HUB = { name: 'Челябинск', lat: 55.16, lon: 61.40 };
  var CITIES = [
    { name: 'Москва', lat: 55.75, lon: 37.62 },
    { name: 'Санкт-Петербург', lat: 59.94, lon: 30.31 },
    { name: 'Усть-Луга', lat: 59.67, lon: 28.27, noLabel: true },
    { name: 'Кострома', lat: 57.77, lon: 40.93, noLabel: true },
    { name: 'Магнитогорск', lat: 53.41, lon: 58.98, noLabel: true },
    { name: 'Красноярск', lat: 56.01, lon: 92.87 },
    { name: 'Иркутск', lat: 52.29, lon: 104.28 },
    { name: 'Чита', lat: 52.03, lon: 113.50, noLabel: true },
    { name: 'Невер', lat: 53.98, lon: 124.15 },
    { name: 'Благовещенск', lat: 50.27, lon: 127.53, noLabel: true },
    { name: 'Большой Камень', lat: 43.11, lon: 132.35 },
    { name: 'Магадан', lat: 59.57, lon: 150.80 }
  ];

  // Точки суши -> единичные векторы
  var raw = window.LAND_DOTS, n = raw.length / 2;
  var dots = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    var la = raw[i * 2] / 10 * RAD, lo = raw[i * 2 + 1] / 10 * RAD;
    dots[i * 3] = Math.cos(la) * Math.sin(lo);
    dots[i * 3 + 1] = Math.sin(la);
    dots[i * 3 + 2] = Math.cos(la) * Math.cos(lo);
  }

  function vec(lat, lon) {
    lat *= RAD; lon *= RAD;
    return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  }

  // Дуги: сферическая интерполяция с подъёмом над поверхностью
  var hubV = vec(HUB.lat, HUB.lon);
  var arcs = CITIES.map(function (c, idx) {
    var b = vec(c.lat, c.lon);
    var dot = hubV[0] * b[0] + hubV[1] * b[1] + hubV[2] * b[2];
    var omega = Math.acos(Math.min(1, Math.max(-1, dot)));
    var steps = 64, pts = [];
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var k1 = Math.sin((1 - t) * omega) / Math.sin(omega), k2 = Math.sin(t * omega) / Math.sin(omega);
      var lift = 1 + Math.sin(Math.PI * t) * (0.04 + omega * 0.14);
      pts.push([(hubV[0] * k1 + b[0] * k2) * lift, (hubV[1] * k1 + b[1] * k2) * lift, (hubV[2] * k1 + b[2] * k2) * lift]);
    }
    return { city: c, v: b, pts: pts, offset: (idx * 0.37) % 1, speed: 0.12 + (idx % 4) * 0.025 };
  });

  // Звёзды
  var stars = [];
  for (var k = 0; k < 160; k++) stars.push([Math.random(), Math.random(), Math.random() * 1.1 + 0.2, Math.random()]);

  var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1, mobile = false;
  var rotLon = 88, rotLat = 38;           // центр обзора
  var baseLon = 88, dragLon = 0, dragLat = 0;
  var dragging = false, lastX = 0, lastY = 0, velX = 0;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mobile = W < 760;
    if (mobile) { R = W * 0.78; cx = W * 0.62; cy = H * 0.95; }
    else { R = Math.min(W * 0.34, H * 0.62); cx = W * 0.72; cy = H * 0.56; }
  }

  // Поворот: сначала вокруг оси Y (долгота), затем вокруг X (широта)
  var sinL, cosL, sinP, cosP;
  function setRotation() {
    var l = -rotLon * RAD, p = rotLat * RAD;
    sinL = Math.sin(l); cosL = Math.cos(l); sinP = Math.sin(p); cosP = Math.cos(p);
  }
  function rotate(x, y, z, out) {
    var x1 = x * cosL + z * sinL;
    var z1 = -x * sinL + z * cosL;
    var y2 = y * cosP - z1 * sinP;
    var z2 = y * sinP + z1 * cosP;
    out[0] = x1; out[1] = y2; out[2] = z2;
    return out;
  }
  var tmp = [0, 0, 0];

  function visible(p) { // учитываем перекрытие сферой
    return p[2] > 0 || (p[0] * p[0] + p[1] * p[1]) > 1;
  }

  function drawStars(t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = 0.25 + 0.35 * Math.sin(t * 0.6 + s[3] * 10);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(s[0] * W, s[1] * H, s[2], s[2]);
    }
  }

  function drawSphere() {
    // Тень сферы
    var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#16120f');
    g.addColorStop(1, '#060606');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // Атмосфера: синее свечение по краю + тёплый блик сверху
    var a = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.14);
    a.addColorStop(0, 'rgba(36,51,255,0)');
    a.addColorStop(0.42, 'rgba(60,90,255,.55)');
    a.addColorStop(1, 'rgba(36,51,255,0)');
    ctx.fillStyle = a;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2); ctx.fill();

    var w = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.9, 0, cx - R * 0.2, cy - R * 0.9, R * 0.9);
    w.addColorStop(0, 'rgba(255,120,40,.28)');
    w.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = w;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2); ctx.fill();
  }

  function drawDots() {
    var size = mobile ? 1.3 : 1.6;
    // Три слоя прозрачности вместо смены цвета для каждой точки
    var buckets = [[], [], []];
    for (var i = 0; i < n; i++) {
      rotate(dots[i * 3], dots[i * 3 + 1], dots[i * 3 + 2], tmp);
      if (tmp[2] <= 0.02) continue;
      var b = tmp[2] > 0.55 ? 2 : tmp[2] > 0.25 ? 1 : 0;
      buckets[b].push(cx + tmp[0] * R, cy - tmp[1] * R);
    }
    var alphas = [0.22, 0.5, 0.85];
    for (var j = 0; j < 3; j++) {
      ctx.fillStyle = 'rgba(255,255,255,' + alphas[j] + ')';
      var arr = buckets[j];
      for (var q = 0; q < arr.length; q += 2) ctx.fillRect(arr[q] - size / 2, arr[q + 1] - size / 2, size, size);
    }
  }

  function project(p) { return [cx + p[0] * R, cy - p[1] * R]; }

  function drawArcs(t) {
    ctx.lineCap = 'round';
    for (var i = 0; i < arcs.length; i++) {
      var arc = arcs[i], pts = arc.pts, prev = null, prevVis = false;
      // Базовая линия
      ctx.strokeStyle = 'rgba(255,90,31,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var proj = [];
      for (var s = 0; s < pts.length; s++) {
        var r = rotate(pts[s][0], pts[s][1], pts[s][2], [0, 0, 0]);
        var vis = visible(r);
        var sp = project(r);
        proj.push(vis ? sp : null);
        if (vis && prevVis) ctx.lineTo(sp[0], sp[1]); else if (vis) ctx.moveTo(sp[0], sp[1]);
        prevVis = vis; prev = sp;
      }
      ctx.stroke();

      // Бегущий «груз» по дуге
      var phase = reduceMotion ? 0.999 : ((t * arc.speed + arc.offset) % 1.25);
      if (phase <= 1) {
        var head = Math.floor(phase * (pts.length - 1));
        var tail = Math.max(0, head - 14);
        for (var z = tail; z < head; z++) {
          if (!proj[z] || !proj[z + 1]) continue;
          var k = (z - tail) / (head - tail || 1);
          ctx.strokeStyle = 'rgba(255,' + Math.round(90 + 80 * k) + ',' + Math.round(31 + 40 * k) + ',' + (0.15 + 0.85 * k).toFixed(2) + ')';
          ctx.lineWidth = 1 + 1.6 * k;
          ctx.beginPath(); ctx.moveTo(proj[z][0], proj[z][1]); ctx.lineTo(proj[z + 1][0], proj[z + 1][1]); ctx.stroke();
        }
        if (proj[head]) {
          ctx.fillStyle = '#ffd2b8';
          ctx.beginPath(); ctx.arc(proj[head][0], proj[head][1], 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  function drawPin(v, label, t, isHub) {
    var r = rotate(v[0], v[1], v[2], [0, 0, 0]);
    if (r[2] < 0.08) return;
    var p = project(r);
    var pulse = reduceMotion ? 0.5 : (t * 0.8 + v[0] * 3) % 1;
    ctx.strokeStyle = 'rgba(255,90,31,' + (0.7 * (1 - pulse)).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p[0], p[1], 3 + pulse * (isHub ? 16 : 10), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = isHub ? '#ffffff' : '#ff5a1f';
    ctx.beginPath(); ctx.arc(p[0], p[1], isHub ? 4 : 3, 0, Math.PI * 2); ctx.fill();

    if (!label || (mobile && !isHub)) return;
    ctx.font = '500 10px "JetBrains Mono", monospace';
    var text = label.toUpperCase();
    var tw = ctx.measureText(text).width;
    var bx = p[0] - tw / 2 - 7, by = p[1] - 30;
    ctx.globalAlpha = Math.min(1, (r[2] - 0.08) * 5);
    ctx.fillStyle = isHub ? '#ff5a1f' : '#ffffff';
    ctx.fillRect(bx, by, tw + 14, 18);
    ctx.fillStyle = isHub ? '#ffffff' : '#0b0b0c';
    ctx.fillText(text, bx + 7, by + 12.5);
    ctx.globalAlpha = 1;
  }

  var running = false, start = performance.now();
  function render(now) {
    var t = (now - start) / 1000;
    if (!dragging) {
      velX *= 0.94;
      dragLon += velX;
      dragLat *= 0.96;
    }
    rotLon = baseLon + (reduceMotion ? 0 : Math.sin(t * 0.08) * 14) - dragLon;
    rotLat = Math.max(5, Math.min(70, 38 + dragLat));
    setRotation();

    ctx.clearRect(0, 0, W, H);
    drawStars(t);
    drawSphere();
    drawDots();
    drawArcs(t);
    for (var i = 0; i < arcs.length; i++) drawPin(arcs[i].v, arcs[i].city.noLabel ? null : arcs[i].city.name, t, false);
    drawPin(hubV, HUB.name, t, true);
  }

  function loop(now) {
    if (!running) return;
    render(now);
    requestAnimationFrame(loop);
  }
  function startLoop() {
    if (running) return;
    if (reduceMotion) { render(performance.now()); return; }
    running = true; requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; }

  // Перетаскивание
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return; // на тач-экранах не мешаем скроллу
    dragging = true; lastX = e.clientX; lastY = e.clientY; velX = 0;
    canvas.classList.add('is-drag');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velX = dx * 0.25;
    dragLon += velX;
    dragLat += dy * 0.2;
    if (reduceMotion) render(performance.now());
  });
  function endDrag() { dragging = false; canvas.classList.remove('is-drag'); }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  resize();
  window.addEventListener('resize', function () { resize(); render(performance.now()); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? startLoop() : stopLoop();
    }).observe(canvas);
  } else {
    startLoop();
  }
  // Перерисовать подписи, когда загрузится шрифт
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { render(performance.now()); });
  render(performance.now());
})();
