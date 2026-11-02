/* map.js — dungeon map for the display companion.
 *
 * Renders the DM's map (pushed by display/map.py → POST /map → SSE {map}) as a
 * lit dungeon: textured stone, walls, iron bars / wooden doors, braziers whose
 * firelight cuts the darkness, hero tokens (a carried torch lights its own
 * circle), markers, grey crosses where enemies fell and bloodstains holding a
 * dead hero's gold. Unexplored rooms are not drawn at all.
 *
 * Two mount points, both optional:
 *   #map-pane     — phone "Map" tab (centres on this phone's own hero)
 *   #map-overlay  — TV view, opened with the 🗺 button
 *
 * Public API: window.DndMap.update(state), window.DndMap.open(), .close()
 */
(function () {
  'use strict';
  var U = 26;                          // px per grid cell in SVG units
  var state = null;
  var lang = (document.documentElement.getAttribute('data-ui-lang') || 'en');
  var STR = {
    uk: { where: 'Де ви зараз', log: 'Що сталося', empty: 'Карта з’явиться, щойно ведучий відкриє першу локацію.',
          legend: 'Позначки', close: 'Закрити', you: 'ти', zoomIn: 'Ближче', zoomOut: 'Далі', centre: 'До мене',
          lHero: 'Герой', lLit: 'Жаровня горить', lOut: 'Жаровня згасла', lStain: 'Пляма з грошима',
          lMark: 'Щось помітили', lDead: 'Тут загинув ворог', lBars: 'Ґрати', lDoor: 'Двері (червоне — замкнено)',
          scale: '1 клітинка = 5 футів (1,5 м)', map: 'Карта' },
    en: { where: 'Where you are', log: 'What happened', empty: 'The map appears once the DM reveals the first location.',
          legend: 'Legend', close: 'Close', you: 'you', zoomIn: 'Zoom in', zoomOut: 'Zoom out', centre: 'Find me',
          lHero: 'Hero', lLit: 'Lit brazier', lOut: 'Cold brazier', lStain: 'Bloodstain with gold',
          lMark: 'Point of interest', lDead: 'Fallen enemy', lBars: 'Bars', lDoor: 'Door (red = locked)',
          scale: '1 cell = 5 ft', map: 'Map' }
  };
  function t(k) { return (STR[lang] || STR.en)[k] || STR.en[k] || k; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function rnd(x, y, k) {
    var h = (Math.imul(x + 101, 374761393) + Math.imul(y + 211, 668265263) + Math.imul(k + 7, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  var HERO_COLORS = ['#6f9bd1', '#b07ad6', '#7fb069', '#d9a441', '#d1696f', '#5fb8b2'];
  function heroColor(h, i) {
    if (h.color) return h.color;
    var s = 0, n = String(h.name || '');
    for (var j = 0; j < n.length; j++) s = (s * 31 + n.charCodeAt(j)) | 0;
    return HERO_COLORS[Math.abs(s) % HERO_COLORS.length] || HERO_COLORS[i % HERO_COLORS.length];
  }
  function boundChar() {
    var q = new URLSearchParams(location.search);
    return (q.get('char') || q.get('character') || '').trim().toLowerCase();
  }

  function floorCell(x, y, isCell) {
    var X = x * U, Y = y * U, j = function (k) { return (rnd(x, y, k) - 0.5) * 3; };
    var p = 'M' + (X + 1.5 + j(1)) + ' ' + (Y + 1.5 + j(2)) + 'L' + (X + U - 1.5 + j(3)) + ' ' + (Y + 1.5 + j(4)) +
      'L' + (X + U - 1.5 + j(5)) + ' ' + (Y + U - 1.5 + j(6)) + 'L' + (X + 1.5 + j(7)) + ' ' + (Y + U - 1.5 + j(8)) + 'Z';
    var shade = rnd(x, y, 9), o = '<path d="' + p + '" fill="var(--dm-floor)"/>';
    o += shade < 0.55 ? '<path d="' + p + '" fill="#000" opacity="' + ((0.55 - shade) * 0.55).toFixed(3) + '"/>'
                      : '<path d="' + p + '" fill="#fff" opacity="' + ((shade - 0.55) * 0.09).toFixed(3) + '"/>';
    if (rnd(x, y, 10) < 0.14) {
      var a = rnd(x, y, 11) * U;
      o += '<path d="M' + (X + a) + ' ' + (Y + 3) + 'l' + ((rnd(x, y, 13) - 0.5) * 8) + ' ' + (U * 0.35) + 'l' + ((rnd(x, y, 14) - 0.5) * 8) + ' ' + (U * 0.35) + '" stroke="#000" stroke-opacity=".55" stroke-width="1" fill="none"/>';
    }
    if (rnd(x, y, 15) < 0.06) o += '<circle cx="' + (X + 4 + rnd(x, y, 16) * (U - 8)) + '" cy="' + (Y + 4 + rnd(x, y, 17) * (U - 8)) + '" r="' + (1.5 + rnd(x, y, 18) * 2) + '" fill="#7d756a" opacity=".8"/>';
    if (isCell && rnd(x, y, 19) < 0.6) {
      for (var i = 0; i < 4; i++) {
        var sx = X + rnd(x, y, 20 + i) * U, sy = Y + rnd(x, y, 30 + i) * U, an = rnd(x, y, 40 + i) * Math.PI;
        o += '<line x1="' + sx + '" y1="' + sy + '" x2="' + (sx + Math.cos(an) * 7) + '" y2="' + (sy + Math.sin(an) * 7) + '" stroke="#a08a55" stroke-opacity=".55" stroke-width="1.2"/>';
      }
    }
    return o;
  }

  function label(x, y, txt, size, col, weight) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + (size > 12 ? "'Alegreya SC','Cinzel',Georgia,serif" : "'Alegreya Sans','Segoe UI',sans-serif") +
      '" font-size="' + size + '"' + (weight ? ' font-weight="' + weight + '"' : '') + ' fill="' + col +
      '" paint-order="stroke" stroke="#000" stroke-width="3" stroke-linejoin="round">' + esc(txt) + '</text>';
  }

  function svg(s, pfx) {
    var W = (s.grid && s.grid.w) || 40, H = (s.grid && s.grid.h) || 28, pad = 1;
    var VX = -pad * U, VY = -pad * U, VW = (W + 2 * pad) * U, VH = (H + 2 * pad) * U;
    var rooms = (s.rooms || []).filter(function (r) { return r.rev; });
    if (!rooms.length) return '';
    var seen = {}, floors = '', grid = '';
    rooms.forEach(function (r) {
      var isCell = /^k/.test(r.id || '') || r.kind === 'cell';
      for (var x = r.x; x < r.x + r.w; x++) for (var y = r.y; y < r.y + r.h; y++) {
        var k = x + ',' + y; if (seen[k]) continue; seen[k] = 1;
        floors += floorCell(x, y, isCell);
        grid += '<path d="M' + (x * U) + ' ' + (y * U) + 'h' + U + 'M' + (x * U) + ' ' + (y * U) + 'v' + U + '" fill="none"/>';
      }
    });
    var T = 0.38 * U;
    var walls = rooms.map(function (r) { return '<rect x="' + (r.x * U - T) + '" y="' + (r.y * U - T) + '" width="' + (r.w * U + 2 * T) + '" height="' + (r.h * U + 2 * T) + '" rx="3"/>'; }).join('');
    var lights = [];
    (s.braziers || []).forEach(function (b) { if (b.rev && b.lit) lights.push({ x: b.x + 0.5, y: b.y + 0.5, r: b.radius || 6.5, fire: 1 }); });
    (s.heroes || []).forEach(function (h) { if (h.light) lights.push({ x: h.x + 0.5, y: h.y + 0.5, r: h.light, fire: 0 }); });
    var id = function (n) { return pfx + n; };

    var o = '<svg viewBox="' + VX + ' ' + VY + ' ' + VW + ' ' + VH + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(t('map')) + '" data-cw="' + VW + '">' +
      '<defs>' +
      '<filter id="' + id('rough') + '" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="4" seed="11" result="n"/><feDiffuseLighting in="n" lighting-color="#b3a896" surfaceScale="2.6" result="lit"><feDistantLight azimuth="235" elevation="50"/></feDiffuseLighting><feComposite in="lit" in2="SourceGraphic" operator="in" result="tex"/><feBlend in="tex" in2="SourceGraphic" mode="multiply"/></filter>' +
      '<filter id="' + id('grit') + '" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.18" result="dots"/><feComposite in="dots" in2="SourceGraphic" operator="in" result="d"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/></feMerge></filter>' +
      '<radialGradient id="' + id('hole') + '"><stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>' +
      '<radialGradient id="' + id('warm') + '"><stop offset="0" stop-color="#e8923a" stop-opacity=".42"/><stop offset=".6" stop-color="#e8923a" stop-opacity=".1"/><stop offset="1" stop-color="#e8923a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id('torch') + '"><stop offset="0" stop-color="#f3b469" stop-opacity=".3"/><stop offset="1" stop-color="#f3b469" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id('vign') + '" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>' +
      '<mask id="' + id('dark') + '" maskUnits="userSpaceOnUse" x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '"><rect x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '" fill="#fff"/>' +
      lights.map(function (l) { return '<circle cx="' + (l.x * U) + '" cy="' + (l.y * U) + '" r="' + (l.r * U) + '" fill="url(#' + id('hole') + ')"/>'; }).join('') + '</mask>' +
      '</defs>' +
      '<rect x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '" fill="var(--dm-void)"/>' +
      '<g fill="var(--dm-wall)" filter="url(#' + id('rough') + ')">' + walls + '</g>' +
      '<g filter="url(#' + id('grit') + ')">' + floors + '</g>' +
      '<g opacity=".22" stroke="#000" stroke-width="1">' + grid + '</g>';

    (s.doors || []).forEach(function (d) {
      if (!d.rev) return;
      var v = d.dir === 'v', X = d.x * U, Y = d.y * U, broken = d.state === 'broken', locked = d.state === 'locked';
      if ((d.kind || 'bars') === 'wood' && d.state !== 'open') {
        o += v ? '<rect x="' + (X - 4) + '" y="' + (Y + 2) + '" width="8" height="' + (U - 4) + '" fill="var(--dm-wood)" stroke="#000" stroke-width="1"/><line x1="' + (X - 4) + '" y1="' + (Y + U / 3) + '" x2="' + (X + 4) + '" y2="' + (Y + U / 3) + '" stroke="var(--dm-iron)"/><line x1="' + (X - 4) + '" y1="' + (Y + 2 * U / 3) + '" x2="' + (X + 4) + '" y2="' + (Y + 2 * U / 3) + '" stroke="var(--dm-iron)"/>'
               : '<rect x="' + (X + 2) + '" y="' + (Y - 4) + '" width="' + (U - 4) + '" height="8" fill="var(--dm-wood)" stroke="#000" stroke-width="1"/><line x1="' + (X + U / 3) + '" y1="' + (Y - 4) + '" x2="' + (X + U / 3) + '" y2="' + (Y + 4) + '" stroke="var(--dm-iron)"/><line x1="' + (X + 2 * U / 3) + '" y1="' + (Y - 4) + '" x2="' + (X + 2 * U / 3) + '" y2="' + (Y + 4) + '" stroke="var(--dm-iron)"/>';
      } else if ((d.kind || 'bars') === 'wood') {
        // open wooden door: a leaf swung against the wall
        o += v ? '<rect x="' + (X) + '" y="' + (Y + 2) + '" width="' + (U - 6) + '" height="5" fill="var(--dm-wood)" opacity=".8"/>'
               : '<rect x="' + (X + 2) + '" y="' + (Y) + '" width="5" height="' + (U - 6) + '" fill="var(--dm-wood)" opacity=".8"/>';
      } else if (d.state !== 'open') {
        var bars = '';
        for (var i = 1; i <= 4; i++) {
          var tt = i * U / 5, bend = broken ? (i % 2 ? 6 : -5) : 0;
          bars += v ? '<path d="M' + (X - 4) + ' ' + (Y + tt) + 'Q' + X + ' ' + (Y + tt + bend) + ' ' + (X + 4) + ' ' + (Y + tt) + '"/>'
                    : '<path d="M' + (X + tt) + ' ' + (Y - 4) + 'Q' + (X + tt + bend) + ' ' + Y + ' ' + (X + tt) + ' ' + (Y + 4) + '"/>';
        }
        o += '<g stroke="var(--dm-iron)" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="' + (broken ? 0.55 : 1) + '">' + bars + '</g>';
      }
      if (locked) o += '<circle cx="' + (v ? X : X + U / 2) + '" cy="' + (v ? Y + U / 2 : Y) + '" r="3" fill="var(--dm-blood)" stroke="#000" stroke-width="1"/>';
    });

    (s.braziers || []).forEach(function (b) {
      if (!b.rev) return;
      var cx = (b.x + 0.5) * U, cy = (b.y + 0.5) * U;
      o += '<circle cx="' + cx + '" cy="' + cy + '" r="8.5" fill="#2a2520" stroke="var(--dm-iron)" stroke-width="2"/>';
      if (!b.lit) o += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#3a352f"/>';
    });

    o += '<rect x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '" fill="#000" opacity=".66" mask="url(#' + id('dark') + ')"/>';
    lights.forEach(function (l) {
      o += '<circle class="' + (l.fire ? 'dm-flick' : 'dm-flick2') + '" cx="' + (l.x * U) + '" cy="' + (l.y * U) + '" r="' + (l.r * U * (l.fire ? 1 : 0.9)) + '" fill="url(#' + id(l.fire ? 'warm' : 'torch') + ')"/>';
    });
    (s.braziers || []).forEach(function (b) {
      if (!(b.rev && b.lit)) return;
      var cx = (b.x + 0.5) * U, cy = (b.y + 0.5) * U;
      o += '<circle cx="' + cx + '" cy="' + cy + '" r="5.5" fill="var(--dm-ember)"/><circle class="dm-flick" cx="' + cx + '" cy="' + (cy - 1) + '" r="3" fill="#ffd38a"/>';
    });
    o += '<rect x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '" fill="url(#' + id('vign') + ')" pointer-events="none"/>';

    rooms.forEach(function (r) {
      if (!r.name || r.label === false) return;
      o += label(((r.lx != null ? r.lx : r.x + r.w / 2)) * U, ((r.ly != null ? r.ly : r.y + r.h / 2)) * U + 5, r.name, r.fs || 13, 'var(--dm-muted)');
    });
    (s.braziers || []).forEach(function (b) {
      if (b.rev && b.name) o += label((b.x + 0.5) * U, (b.y - 0.15) * U, b.name, 11, b.lit ? 'var(--dm-ember)' : 'var(--dm-muted)');
    });
    (s.marks || []).forEach(function (m) {
      if (!m.rev && m.rev !== undefined) return;
      var cx = (m.x + 0.5) * U, cy = (m.y + 0.5) * U, dead = m.kind === 'dead';
      if (dead) {
        o += '<g stroke="#000" stroke-width="6" stroke-linecap="round"><line x1="' + (cx - 7) + '" y1="' + (cy - 7) + '" x2="' + (cx + 7) + '" y2="' + (cy + 7) + '"/><line x1="' + (cx + 7) + '" y1="' + (cy - 7) + '" x2="' + (cx - 7) + '" y2="' + (cy + 7) + '"/></g>' +
             '<g stroke="var(--dm-muted)" stroke-width="3" stroke-linecap="round"><line x1="' + (cx - 7) + '" y1="' + (cy - 7) + '" x2="' + (cx + 7) + '" y2="' + (cy + 7) + '"/><line x1="' + (cx + 7) + '" y1="' + (cy - 7) + '" x2="' + (cx - 7) + '" y2="' + (cy + 7) + '"/></g>';
      } else {
        o += label(cx, cy + 7, m.icon || '?', 20, 'var(--dm-ember)', 700);
      }
      if (m.label) o += label(cx + (m.dx || 0) * U, cy + (m.dy != null ? m.dy : 1.2) * U, m.label, 12, dead ? 'var(--dm-muted)' : 'var(--dm-ash)');
    });
    (s.stains || []).forEach(function (st) {
      var cx = (st.x + 0.5) * U, cy = (st.y + 0.5) * U;
      o += '<path transform="translate(' + (cx - 11) + ' ' + (cy - 11) + ')" d="M5 14c1-6 7-9 12-6 2 2 0 6-3 7-3 2-8 3-9-1z" fill="var(--dm-blood)" stroke="#000"/>' +
           label(cx, cy + U, (st.who || '') + ' ' + (st.gold || ''), 11, 'var(--dm-ash)');
    });
    var me = boundChar();
    (s.heroes || []).forEach(function (h, i) {
      var cx = (h.x + 0.5) * U, cy = (h.y + 0.5) * U, col = heroColor(h, i);
      var mine = me && String(h.name || '').toLowerCase() === me;
      if (mine) o += '<circle class="dm-pulse" cx="' + cx + '" cy="' + cy + '" r="' + (U * 0.62) + '" fill="none" stroke="' + col + '" stroke-width="2"/>';
      o += '<circle cx="' + cx + '" cy="' + (cy + 2) + '" r="' + (U * 0.44) + '" fill="#000" opacity=".6"/>' +
           '<circle cx="' + cx + '" cy="' + cy + '" r="' + (U * 0.42) + '" fill="' + col + '" stroke="#000" stroke-width="2.5"/>' +
           '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-family="\'Alegreya SC\',Georgia,serif" font-weight="700" font-size="14" fill="#0b0a09">' + esc(String(h.name || '?').charAt(0)) + '</text>';
    });
    return o + '</svg>';
  }

  // ── mount helpers ──────────────────────────────────────────────────────────
  var zoom = { pane: 1.6, overlay: 1 };

  function panelHTML(kind) {
    return '<div class="dm-map-head"><div class="dm-map-title"></div><div class="dm-map-tools">' +
      '<button type="button" class="dm-map-btn" data-act="out" title="' + esc(t('zoomOut')) + '">−</button>' +
      '<button type="button" class="dm-map-btn" data-act="in" title="' + esc(t('zoomIn')) + '">+</button>' +
      (kind === 'pane' ? '<button type="button" class="dm-map-btn dm-map-me" data-act="me" title="' + esc(t('centre')) + '">◎</button>' : '') +
      (kind === 'overlay' ? '<button type="button" class="dm-map-btn" data-act="close" title="' + esc(t('close')) + '">✕</button>' : '') +
      '</div></div>' +
      '<div class="dm-map-where" hidden><span class="dm-map-k">' + esc(t('where')) + '</span><p></p></div>' +
      '<div class="dm-map-scroll"><div class="dm-map-canvas"><div class="dm-map-empty">' + esc(t('empty')) + '</div></div></div>' +
      '<details class="dm-map-more"><summary>' + esc(t('log')) + ' · ' + esc(t('legend')) + '</summary>' +
      '<ol class="dm-map-log"></ol>' +
      '<div class="dm-map-legend">' + legendHTML() + '</div><p class="dm-map-scale">' + esc(t('scale')) + '</p></details>';
  }

  function legendHTML() {
    function item(svgInner, txt) { return '<span><svg width="22" height="22" viewBox="0 0 22 22">' + svgInner + '</svg>' + esc(txt) + '</span>'; }
    return item('<circle cx="11" cy="11" r="8" fill="#6f9bd1" stroke="#000" stroke-width="2"/>', t('lHero')) +
      item('<circle cx="11" cy="11" r="9" fill="#e8923a" opacity=".25"/><circle cx="11" cy="11" r="5" fill="#e8923a"/>', t('lLit')) +
      item('<circle cx="11" cy="11" r="5" fill="none" stroke="#7a4a1f" stroke-width="2"/>', t('lOut')) +
      item('<path d="M5 14c1-6 7-9 12-6 2 2 0 6-3 7-3 2-8 3-9-1z" fill="#8e2b22"/>', t('lStain')) +
      item('<text x="11" y="16" text-anchor="middle" font-size="16" font-weight="700" fill="#e8923a">?</text>', t('lMark')) +
      item('<g stroke="#9a9183" stroke-width="3" stroke-linecap="round"><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></g>', t('lDead')) +
      item('<g stroke="#8a8478" stroke-width="2"><line x1="6" y1="5" x2="6" y2="17"/><line x1="11" y1="5" x2="11" y2="17"/><line x1="16" y1="5" x2="16" y2="17"/></g>', t('lBars')) +
      item('<rect x="2" y="8" width="18" height="6" fill="#5a3b22"/><circle cx="11" cy="11" r="2" fill="#8e2b22"/>', t('lDoor'));
  }

  var mounts = [];
  function mount(el, kind) {
    if (!el || el.dataset.dmMounted) return;
    el.dataset.dmMounted = '1';
    el.classList.add('dnd-map');
    el.innerHTML = panelHTML(kind);
    var m = { el: el, kind: kind, pfx: 'dm' + kind + '-', first: true };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.dm-map-btn'); if (!b) return;
      var act = b.dataset.act;
      if (act === 'close') { api.close(); return; }
      if (act === 'me') { centre(m, true); return; }
      zoom[kind] = Math.max(0.6, Math.min(4, zoom[kind] * (act === 'in' ? 1.35 : 1 / 1.35)));
      applyZoom(m, true);
    });
    mounts.push(m);
    if (state) paint(m);
  }

  function applyZoom(m, keepCentre) {
    var sc = m.el.querySelector('.dm-map-scroll'), cv = m.el.querySelector('.dm-map-canvas');
    if (!sc || !cv) return;
    var cxr = sc.scrollWidth ? (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth : 0.5;
    var cyr = sc.scrollHeight ? (sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight : 0.5;
    cv.style.width = (zoom[m.kind] * 100) + '%';
    if (keepCentre) {
      sc.scrollLeft = cxr * sc.scrollWidth - sc.clientWidth / 2;
      sc.scrollTop = cyr * sc.scrollHeight - sc.clientHeight / 2;
    }
  }

  function centre(m, smooth) {
    var me = boundChar(); if (!state || !me) return;
    var h = (state.heroes || []).filter(function (x) { return String(x.name || '').toLowerCase() === me; })[0];
    var sc = m.el.querySelector('.dm-map-scroll'), svgEl = m.el.querySelector('svg');
    if (!h || !sc || !svgEl) return;
    var W = (state.grid && state.grid.w) || 40, H = (state.grid && state.grid.h) || 28;
    var fx = (h.x + 1.5) / (W + 2), fy = (h.y + 1.5) / (H + 2);
    sc.scrollTo({ left: fx * svgEl.clientWidth - sc.clientWidth / 2, top: fy * svgEl.clientHeight - sc.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  function paint(m) {
    var s = state || {};
    var el = m.el;
    el.querySelector('.dm-map-title').innerHTML = esc(s.title || '') + (s.area ? '<small>' + esc(s.area) + '</small>' : '');
    var w = el.querySelector('.dm-map-where');
    w.hidden = !s.where; w.querySelector('p').textContent = s.where || '';
    var cv = el.querySelector('.dm-map-canvas');
    var out = svg(s, m.pfx);
    cv.innerHTML = out || '<div class="dm-map-empty">' + esc(t('empty')) + '</div>';
    el.querySelector('.dm-map-log').innerHTML = (s.log || []).slice(-12).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    applyZoom(m, false);
    if (m.first && out && el.offsetParent) { m.first = false; requestAnimationFrame(function () { centre(m, false); }); }
  }

  var api = {
    update: function (s) {
      if (!s || typeof s !== 'object') return;
      state = s;
      mounts.forEach(paint);
      var btn = document.getElementById('map-btn');
      if (btn) btn.classList.toggle('dm-has-map', !!(s.rooms && s.rooms.length));
    },
    open: function () {
      var ov = document.getElementById('map-overlay'); if (!ov) return;
      ov.hidden = false; document.body.classList.add('dm-map-open');
      mounts.forEach(function (m) { if (m.kind === 'overlay') { applyZoom(m, false); } });
    },
    close: function () {
      var ov = document.getElementById('map-overlay'); if (!ov) return;
      ov.hidden = true; document.body.classList.remove('dm-map-open');
    },
    shown: function () {   // phone tab became visible
      mounts.forEach(function (m) {
        if (m.kind !== 'pane') return;
        applyZoom(m, false);
        if (m.first && state) { m.first = false; requestAnimationFrame(function () { requestAnimationFrame(function () { centre(m, false); }); }); }
      });
    }
  };
  window.DndMap = api;

  function init() {
    mount(document.getElementById('map-pane'), 'pane');
    mount(document.getElementById('map-overlay-body'), 'overlay');
    var btn = document.getElementById('map-btn');
    if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); api.open(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') api.close(); });
    var ov = document.getElementById('map-overlay');
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) api.close(); });
    fetch('/map', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { if (s && !state) api.update(s); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
