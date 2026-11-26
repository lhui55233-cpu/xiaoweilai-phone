
/* GROUP-BV · 开机动画：流泪之眼 + future（默认）/ 信笺（第二款） */
(function () {
  'use strict';
  if (window.GroupBV) return; /* GROUP-BV：防重入，拒绝重复挂载 */
  var KEY = 'phone_boot_anim_v1';
  var TOTAL_MS = 2600; /* 约 2.5 秒 */
  var _timers = [];
  var _playing = false;
  var _finished = false;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { enabled: true, style: 'eye' };
      var o = JSON.parse(raw) || {};
      return {
        enabled: o.enabled !== false,
        style: (o.style === 'letter' || o.style === 'eye') ? o.style : 'eye'
      };
    } catch (e) { return { enabled: true, style: 'eye' }; }
  }
  function save(patch) {
    var cur = load();
    if (patch && typeof patch.enabled === 'boolean') cur.enabled = patch.enabled;
    if (patch && (patch.style === 'eye' || patch.style === 'letter')) cur.style = patch.style;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }
  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function hexA(hex, a) {
    try {
      var h = String(hex || '#34363b').replace('#', '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) { return 'rgba(52,54,59,' + a + ')'; }
  }
  /* 主题跟随：GroupV c1/c2 优先；深色取值覆写为深底浅字；trianon 用藏青墨 */
  function resolveTheme() {
    var bg = '#ffffff', ink = '#34363b', name = 'guichao';
    try {
      if (window.GroupV && typeof window.GroupV.currentTheme === 'function') {
        var t = window.GroupV.currentTheme();
        if (t) {
          if (t.c1) bg = t.c1;
          if (t.c2) ink = t.c2;
          if (t.id) name = t.id;
        }
      }
    } catch (e) {}
    try {
      var p = {};
      if (typeof window.getUiPrefs === 'function') { try { p = window.getUiPrefs() || {}; } catch (e) { p = {}; } }
      else { try { p = JSON.parse(localStorage.getItem('phone_ui_prefs_v1') || '{}') || {}; } catch (e) { p = {}; } } /* GROUP-CORE: 走带缓存的 getUiPrefs，不再每次直读解析 */
      var th = p.theme;
      if (th === 'dark' || th === 'guichao-dark' || th === 'gruvbox-dark') {
        bg = '#17181c'; ink = '#ececef'; name = 'dark';
      } else if (th === 'trianon') {
        name = 'trianon';
        /* GROUP-FIX13：maison-des-mots token 重定基——墨色用 #1e2748（GroupV 的 c2
           #5c6884 是点缀色，不是墨色）；兜底改 #fbf9f4/#1e2748；深色分支只影响
           开机眼睛瞬态配色，用墨蓝 #1e2748 配纸白字（BP 深色块已删）。 */
        if (document.documentElement.getAttribute('data-theme-resolved') === 'dark') {
          bg = '#1e2748'; ink = '#fbf9f4';
        } else if (String(bg).toLowerCase() === '#fbf9f4') {
          ink = '#1e2748';
        } else {
          bg = (p.themeCustom && p.themeCustom.c1) || '#fbf9f4';
          ink = (p.themeCustom && p.themeCustom.c2) || '#1e2748';
        }
      } else if (th === 'auto') {
        try {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            bg = '#17181c'; ink = '#ececef'; name = 'dark';
          }
        } catch (e) {}
      }
      if (!window.GroupV && p.themeCustom && p.themeCustom.c1 && p.themeCustom.c2
          && th !== 'dark' && th !== 'guichao-dark' && th !== 'gruvbox-dark' && th !== 'trianon') {
        bg = p.themeCustom.c1; ink = p.themeCustom.c2;
      }
      if (document.documentElement.getAttribute('data-af-theme')) {
        bg = '#17181c'; ink = '#ececef'; name = 'dark';
      }
    } catch (e) {}
    return { bg: bg, ink: ink, name: name };
  }

  /* 眼睛：完全由文字排成。轮廓是 future 一词的字母 + 细点，虹膜处 o/● 更密。 */
  var EYE_ROWS = [
    '      . . .      ',
    '   f  u  t  u   ',
    ' f  u  t . . t  ',
    'f  u . o o o . u',
    'f  t . o o o . f',
    'f  u . o o o . u',
    ' f  u  t . . t  ',
    '   f  u  t  u   ',
    '      . . .      '
  ];
  function buildEye(ink) {
    var eye = document.createElement('div');
    eye.className = 'bv-eye';
    eye.setAttribute('aria-hidden', 'true');
    eye.style.color = ink;
    var delay = 0;
    EYE_ROWS.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'bv-eye-row';
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (ch === ' ') { line.appendChild(document.createTextNode(' ')); continue; }
        var sp = document.createElement('span');
        sp.className = 'bv-eye-ch';
        sp.textContent = ch;
        sp.style.transitionDelay = (delay * 12) + 'ms';
        line.appendChild(sp);
        delay++;
      }
      eye.appendChild(line);
    });
    return eye;
  }
  function buildLetter(theme) {
    var wrap = document.createElement('div');
    wrap.className = 'bv-letter';
    wrap.setAttribute('aria-hidden', 'true');
    var env = document.createElement('div');
    env.className = 'bv-env';
    env.style.background = hexA(theme.ink, 0.08);
    env.style.border = '1px solid ' + hexA(theme.ink, 0.25);
    var flap = document.createElement('div');
    flap.className = 'bv-env-flap';
    flap.style.background = hexA(theme.ink, 0.16);
    var paper = document.createElement('div');
    paper.className = 'bv-paper';
    paper.style.background = theme.bg;
    paper.style.color = theme.ink;
    paper.style.border = '1px solid ' + hexA(theme.ink, 0.2);
    paper.textContent = 'future';
    var seal = document.createElement('div');
    seal.className = 'bv-seal';
    seal.setAttribute('data-bv-seal', '1');
    env.appendChild(paper);
    env.appendChild(flap);
    env.appendChild(seal);
    wrap.appendChild(env);
    return { wrap: wrap, env: env, seal: seal };
  }

  function clearTimers() {
    _timers.forEach(function (t) { clearTimeout(t); });
    _timers = [];
  }
  function later(fn, ms) { _timers.push(setTimeout(fn, ms)); }

  function finish(overlay) {
    if (_finished) return;
    _finished = true;
    clearTimers();
    _playing = false;
    if (!overlay || !overlay.parentNode) return;
    overlay.classList.add('bv-fading');
    setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 160);
  }

  function play(style, opts) {
    opts = opts || {};
    if (_playing) return false;
    if (reducedMotion() && !opts.preview) return false;
    if (document.getElementById('bv-boot')) return false;
    var theme = resolveTheme();
    var st = (style === 'letter' || style === 'eye') ? style : load().style;
    var overlay = document.createElement('div');
    overlay.id = 'bv-boot';
    overlay.setAttribute('role', 'presentation');
    overlay.setAttribute('data-bv-style', st);
    overlay.setAttribute('data-bv-theme', theme.name);
    overlay.dataset.phase = st === 'eye' ? 'eye' : 'open';
    overlay.style.backgroundColor = theme.bg;
    overlay.style.color = theme.ink;
    var stage = document.createElement('div');
    stage.className = 'bv-stage';
    if (st === 'eye') {
      var eye = buildEye(theme.ink);
      var tear = document.createElement('div');
      tear.className = 'bv-tear';
      tear.setAttribute('data-bv-tear', '1');
      tear.style.background = hexA(theme.ink, 0.45);
      tear.style.border = '1px solid ' + hexA(theme.ink, 0.55);
      tear.style.left = '71%';
      tear.style.top = '16%';
      var trail = document.createElement('div');
      trail.className = 'bv-trail';
      trail.style.left = 'calc(71% + 6px)';
      trail.style.top = 'calc(16% + 12px)';
      var future = document.createElement('div');
      future.className = 'bv-future';
      future.setAttribute('data-bv-future', '1');
      future.style.color = theme.ink;
      future.textContent = 'future';
      stage.appendChild(eye);
      stage.appendChild(trail);
      stage.appendChild(tear);
      stage.appendChild(future);
      overlay.appendChild(stage);
      document.body.appendChild(overlay);
      _playing = true;
      _finished = false;
      /* 0–0.9s 眼睛逐字浮现 */
      var chars = eye.querySelectorAll('.bv-eye-ch');
      chars.forEach(function (c) { c.classList.add('bv-on'); });
      later(function () { /* 0.9–1.7s 一滴泪落下 */
        overlay.dataset.phase = 'tear';
        tear.classList.add('bv-fall');
        trail.classList.add('bv-fall');
      }, 900);
      later(function () { /* 1.7s 眼睛淡出，future 淡入 */
        overlay.dataset.phase = 'future';
        eye.classList.add('bv-eye-out');
        eye.style.opacity = '0';
        tear.style.opacity = '0';
        trail.style.opacity = '0';
        future.classList.add('bv-on');
        future.style.opacity = '1';
      }, 1700);
      later(function () { overlay.dataset.phase = 'done'; finish(overlay); }, 2400);
      later(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, TOTAL_MS);
    } else {
      var letter = buildLetter(theme);
      stage.appendChild(letter.wrap);
      overlay.appendChild(stage);
      document.body.appendChild(overlay);
      _playing = true;
      _finished = false;
      later(function () { /* 0–0.8s 信笺展开 */
        overlay.dataset.phase = 'seal';
        letter.env.classList.add('bv-open');
      }, 350);
      later(function () { /* 火漆印轻盖 */
        letter.seal.classList.add('bv-on');
      }, 1100);
      later(function () { /* 淡出到桌面 */
        overlay.dataset.phase = 'done';
        letter.wrap.classList.add('bv-letter-out');
        finish(overlay);
      }, 2100);
      later(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, TOTAL_MS);
    }
    var skip = function () { finish(overlay); };
    overlay.addEventListener('pointerdown', skip);
    overlay.addEventListener('click', skip);
    return true;
  }

  function boot() {
    if (reducedMotion()) return false;
    var cfg = load();
    if (!cfg.enabled) return false;
    return play(cfg.style);
  }

  /* 设置页接线：桌面与外观里的开关 / 样式段 / 预览（事件委托，不碰 GroupW 的键） */
  function rerenderDeskBody() {
    try {
      var body = document.querySelector('#gw-desk-body');
      if (body && window.GroupW && typeof window.GroupW.renderDesktopSettingsHTML === 'function') {
        body.innerHTML = window.GroupW.renderDesktopSettingsHTML();
      }
    } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-bv-boot-toggle],[data-bv-boot-set],[data-bv-boot-preview]') : null;
    if (!t) return;
    if (t.hasAttribute('data-bv-boot-toggle')) {
      var cur = load();
      save({ enabled: !cur.enabled });
      rerenderDeskBody();
      return;
    }
    if (t.hasAttribute('data-bv-boot-set')) {
      save({ style: t.getAttribute('data-v') || 'eye' });
      rerenderDeskBody();
      return;
    }
    if (t.hasAttribute('data-bv-boot-preview')) {
      play(load().style, { preview: true });
    }
  });

  window.GroupBV = {
    KEY: KEY, TOTAL_MS: TOTAL_MS, load: load, save: save,
    play: play, skip: function () { var o = document.getElementById('bv-boot'); if (o) finish(o); },
    resolveTheme: resolveTheme, boot: boot,
    _debug: { playing: function () { return _playing; } }
  };
  boot();
})();
