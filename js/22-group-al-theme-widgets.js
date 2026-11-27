
// ══════════════════════════════════════════════════════════════════════
// GROUP-AL-THEME-WIDGETS · AL 组：主题与小组件 + 微交互（自写实现）
// 许可证：只借做法，不复制任何项目代码。glint / micro-interactions-library
// 的 MIT 未完全核实、microinteractions-showcase 未注明许可证（含 GSAP 未
// 验证），三处只借思路；正式采用前须先核对 LICENSE 正文。
// 落点：只接在已有功能上。T 组 phone_ui_prefs_v1 复用；AC 组商店只改选中
// 态样式并加搜索；AG 组已合入（window.PhoneModel 存在），AL 按它接线；
// AF/AK 两组未合入本文件——桌面搜索、拖拽视觉层按任务要求先做行为层/
// 视觉层，机制等对应组（见 patch_groupAL.py 头部注释与汇报）。不碰微信
// 发送/回复主逻辑、图片消息渲染、乙游 3D 家。
// 新增键：phone_theme_al_v1（色温/壁纸线条/圆体镜像）、al_search_recent_v1
// （桌面搜索最近使用）；圆体另写 af_round_font_v1（AF 组已定键名，先写
// 共用）。不改任何已有键；不连网；不引入外链图片/音频。
// ══════════════════════════════════════════════════════════════════════
(function () {
'use strict';
var AL_KEY = 'phone_theme_al_v1';
var RECENT_KEY = 'al_search_recent_v1';
var ROUND_KEY = 'af_round_font_v1';
var PREFS_KEY = 'phone_ui_prefs_v1';
var MAX_RECENT = 8;

function $(s, r) { try { return (r || document).querySelector(s); } catch (e) { return null; } }
function $$(s, r) { try { return Array.prototype.slice.call((r || document).querySelectorAll(s)); } catch (e) { return []; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function lsGet(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function matchMediaSafe(q) { try { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {}, addListener: function () {} }; } catch (e) { return { matches: false, addEventListener: function () {}, addListener: function () {} }; } }
function reducedMotion() { return matchMediaSafe('(prefers-reduced-motion: reduce)').matches; }
function prefersDark() { return matchMediaSafe('(prefers-color-scheme: dark)').matches; }

/* ── 主题：读 T 组 phone_ui_prefs_v1.theme，AL 偏好存 phone_theme_al_v1 ── */
function readUiPrefs() {
  try { if (typeof window.getUiPrefs === 'function') { var p = window.getUiPrefs(); if (p && typeof p === 'object') return p; } } catch (e) {}
  var p = lsGet(PREFS_KEY, null);
  return (p && typeof p === 'object') ? p : { theme: 'light', themeCustom: { c1: '#ffffff', c2: '#34363b' }, wallpaper: '' };
}
function readAlPrefs() {
  var d = { variant: 'none', wall: 'none', roundFont: false };
  var a = lsGet(AL_KEY, null);
  if (a && typeof a === 'object') { if (a.variant) d.variant = a.variant; if (a.wall) d.wall = a.wall; if (typeof a.roundFont === 'boolean') d.roundFont = a.roundFont; }
  var r = lsGet(ROUND_KEY, null);
  if (typeof r === 'boolean') d.roundFont = r; /* AF 键优先：AF 合入后共用同一键 */
  return d;
}
function saveAlPrefs(p) { lsSet(AL_KEY, p); if (typeof p.roundFont === 'boolean') lsSet(ROUND_KEY, p.roundFont); }
function saveThemeMode(mode) {
  try { if (typeof window.setUiPrefs === 'function') { window.setUiPrefs({ theme: mode }); return; } } catch (e) {}
  var cur = readUiPrefs(); cur.theme = mode; lsSet(PREFS_KEY, cur); try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */
}
function resolvedTheme(mode) { return mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : (mode === 'dark' ? 'dark' : 'light'); }
function applyTheme() {
  try {
    var ui = readUiPrefs();
    var al = readAlPrefs();
    var mode = (ui.theme === 'dark' || ui.theme === 'auto') ? ui.theme : 'light';
    var res = resolvedTheme(mode);
    /* GROUP-BU：V 组深色主题（夜·蜕茧黑 / 墨绿）按深色解析，其余 BU 主题按浅色。 */
    try { var _buGv = document.documentElement.getAttribute('data-gv-theme') || ''; if (_buGv === 'bu-night-black' || _buGv === 'bu-forest' || ui.theme === 'bu-night-black' || ui.theme === 'bu-forest') { mode = 'dark'; res = 'dark'; } } catch (e2) {}
    var html = document.documentElement;
    html.setAttribute('data-theme', mode);
    html.setAttribute('data-theme-resolved', res);
    if (al.variant === 'warm' || al.variant === 'cold') html.setAttribute('data-theme-variant', al.variant);
    else html.removeAttribute('data-theme-variant');
    html.setAttribute('data-al-round-font', al.roundFont ? 'on' : 'off');
    var shell = $('#sys-shell');
    if (shell) {
      /* 壁纸线条只在用户未设其他壁纸时出现，默认纯白不变 */
      var wpEmpty = !ui.wallpaper;
      shell.setAttribute('data-al-wall', (wpEmpty && al.wall && al.wall !== 'none') ? al.wall : 'none');
    }
    /* GROUP-BU：AL 主题流程走完后同步 AppTheme 全套变量。 */
    try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (e2) {}
  } catch (e) {}
}
function themeReveal() {
  if (reducedMotion()) return;
  try {
    var d = document.createElement('div');
    d.className = 'al-theme-reveal';
    document.body.appendChild(d);
    setTimeout(function () { try { d.remove(); } catch (e) {} }, 400);
  } catch (e) {}
}
function setTheme(mode) {
  if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') mode = 'light';
  saveThemeMode(mode); applyTheme(); themeReveal();
  return mode;
}
function setVariant(v) {
  var al = readAlPrefs();
  al.variant = (v === 'warm' || v === 'cold') ? v : 'none';
  saveAlPrefs(al); applyTheme();
  return al.variant;
}
function setWall(w) {
  var al = readAlPrefs();
  al.wall = (w === 'waves' || w === 'mountains' || w === 'forest' || w === 'desert') ? w : 'none';
  saveAlPrefs(al); applyTheme();
  return al.wall;
}
function setRoundFont(on) {
  var al = readAlPrefs();
  al.roundFont = !!on;
  saveAlPrefs(al); applyTheme();
  return al.roundFont;
}

/* ── 模式标注：AG 未合入 → 模板模式；AG 合入后自动读 PhoneModel ── */
function modeInfo() {
  try {
    if (typeof window.PhoneModel !== 'undefined' && window.PhoneModel) {
      var cfg = false, name = '', label = '';
      try { if (typeof window.PhoneModel.isConfigured === 'function') cfg = !!window.PhoneModel.isConfigured(); } catch (e) {}
      try { if (typeof window.PhoneModel.modelName === 'function') name = String(window.PhoneModel.modelName() || ''); } catch (e) {}
      try { if (typeof window.PhoneModel.modeLabel === 'function') label = String(window.PhoneModel.modeLabel() || ''); } catch (e) {}
      if (cfg) return { mode: 'model', label: name ? ('模型模式 · ' + name) : (label || '模型模式') };
    }
  } catch (e) {}
  return { mode: 'template', label: '模板模式' };
}

/* ── 15. Toast 四态（data-state 驱动）── */
function ALToast(type, msg) {
  var t = (type === 'success' || type === 'error' || type === 'warning') ? type : 'info';
  try {
    var wrap = $('#al-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'al-toast-wrap';
      (document.getElementById('sys-shell') || document.body).appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'al-toast';
    el.setAttribute('data-state', t);
    el.setAttribute('role', 'status');
    el.textContent = String(msg == null ? '' : msg);
    wrap.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (e) {} }, 2600);
    return el;
  } catch (e) { try { alert(msg); } catch (e2) {} return null; }
}

/* ── 15. Modal 行为约定：点遮罩关闭、按 Esc 关闭 ── */
function openModal(html, title) {
  var mask = document.createElement('div');
  mask.className = 'al-modal-mask';
  mask.setAttribute('data-state', 'open');
  var card = document.createElement('div');
  card.className = 'al-modal-card';
  card.setAttribute('data-state', 'open');
  card.setAttribute('role', 'dialog');
  if (title) card.setAttribute('aria-label', title);
  card.innerHTML = html;
  mask.appendChild(card);
  mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(mask); });
  (document.getElementById('sys-shell') || document.body).appendChild(mask);
  return mask;
}
function closeModal(mask) {
  try {
    var m = mask || $('.al-modal-mask[data-state="open"]');
    if (m) { m.setAttribute('data-state', 'closed'); m.remove(); return true; }
  } catch (e) {}
  return false;
}

/* ── 32. data-state 驱动 ── */
function setState(el, state) { try { if (el) el.setAttribute('data-state', state); } catch (e) {} return el; }

/* ── 12. 骨架屏 ── */
function skeleton(container, rows) {
  try {
    if (!container) return null;
    var n = rows || 3;
    container.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'al-skeleton';
      d.style.height = (i === 0 ? 18 : 14) + 'px';
      d.style.width = (i === n - 1 ? '62%' : '100%');
      container.appendChild(d);
    }
    return container;
  } catch (e) { return null; }
}

/* ── 30. 纸屑（纯 CSS/JS，不外链；减弱动效时不撒）── */
function confetti(host) {
  if (reducedMotion()) return 0;
  try {
    var h = host || document.body;
    var colors = ['#34363b', '#8a857e', '#c9c9ce', '#25262a', '#ececef'];
    for (var i = 0; i < 24; i++) {
      var p = document.createElement('div');
      p.className = 'al-confetti-piece';
      p.style.left = Math.floor(Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.3).toFixed(2) + 's';
      h.appendChild(p);
    }
    setTimeout(function () { $$('.al-confetti-piece', h).forEach(function (x) { try { x.remove(); } catch (e) {} }); }, 1600);
    return 24;
  } catch (e) { return 0; }
}

/* ── 29. char 状态点 ── */
function setCharStatus(status) {
  var s = (status === 'online' || status === 'busy' || status === 'sleeping') ? status : 'online';
  $$('[data-al-char-status]').forEach(function (el) { el.setAttribute('data-status', s); });
  $$('.al-status-dot').forEach(function (el) { el.setAttribute('data-status', s); });
  return s;
}

/* ── 23. 流式小圆点 + 模式徽标 + 停止按钮 ── */
function showTyping(on) {
  try {
    var bar = $('#wx-chat-state-bar');
    var host = bar;
    if (!host) {
      host = $('#al-typing-float');
      if (!host) {
        host = document.createElement('div');
        host.id = 'al-typing-float';
        host.className = 'al-thinking-shimmer';
        host.style.cssText = 'padding:8px 12px;font-size:12px;color:#8a857e;';
        (document.getElementById('sys-shell') || document.body).appendChild(host);
      }
    }
    var old = $('.al-typing-dots', host);
    var oldBadge = $('.al-mode-badge', host);
    var oldStop = $('.al-stop-btn', host);
    if (old) old.remove();
    if (oldBadge) oldBadge.remove();
    if (oldStop) oldStop.remove();
    if (!on) { if (!bar && host.id === 'al-typing-float') host.textContent = ''; return false; }
    var dots = document.createElement('span');
    dots.className = 'al-typing-dots';
    dots.setAttribute('aria-label', '正在输入');
    dots.innerHTML = '<i></i><i></i><i></i>';
    host.appendChild(dots);
    var mi = modeInfo();
    var badge = document.createElement('span');
    badge.className = 'al-mode-badge';
    badge.setAttribute('data-mode', mi.mode);
    badge.textContent = mi.label;
    host.appendChild(badge);
    var stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'al-stop-btn';
    stop.textContent = '停止';
    stop.addEventListener('click', function (ev) {
      try { ev.stopPropagation(); } catch (e) {}
      try { document.dispatchEvent(new CustomEvent('al:stop-stream', { detail: { mode: modeInfo().mode } })); } catch (e) {}
      showTyping(false);
      ALToast('info', mi.mode === 'model' ? '已请求停止' : '已停止显示（模板模式下没有正在进行的模型流）');
    });
    host.appendChild(stop);
    return true;
  } catch (e) { return false; }
}

/* ── 24. 异步加载态 helper（AG 未合入时行为层；AG 合入后其测试按钮自带）── */
function asyncTest(btn, fn) {
  if (!btn) return Promise.resolve(false);
  try { btn.setAttribute('data-state', 'loading'); } catch (e) {}
  var spin = document.createElement('span');
  spin.className = 'al-spinner';
  try { btn.insertBefore(spin, btn.firstChild); } catch (e) {}
  var done = function () { try { btn.removeAttribute('data-state'); spin.remove(); } catch (e) {} };
  try {
    var r = fn ? fn() : Promise.resolve(true);
    return Promise.resolve(r).then(function (v) { done(); return v; }, function (err) { done(); throw err; });
  } catch (e) { done(); return Promise.resolve(false); }
}

/* ── 13. 桌面搜索：Cmd-K 结构（AF 未合入，先做搜索框 + 分组 + 最近使用 + 无结果态）── */
function appEntries() {
  var out = [];
  $$('.sys-app-icon').forEach(function (el) {
    var name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    out.push({ kind: 'app', name: name.slice(0, 20), sub: '', el: el });
  });
  return out;
}
function widgetEntries() {
  var out = [];
  try {
    if (window.ACWidgets && typeof window.ACWidgets.catalog === 'function') {
      window.ACWidgets.catalog().forEach(function (c) {
        out.push({ kind: 'widget', name: c.name || c.id, sub: '小组件 · ' + (c.desc || ''), id: c.id });
      });
      return out;
    }
  } catch (e) {}
  var placed = lsGet('phone_widgets_v1', null);
  if (placed && placed.placed) {
    placed.placed.forEach(function (p) { out.push({ kind: 'widget', name: p.title || p.id, sub: '桌面小组件', id: p.id }); });
  }
  return out;
}
function settingEntries() {
  return [
    { kind: 'setting', name: '主题与外观', sub: '设置 · 浅色/深色/色温/壁纸', act: 'theme' },
    { kind: 'setting', name: '接模型', sub: '设置 · 模型连接（AG 组未合入时仅提示）', act: 'model' },
    { kind: 'setting', name: '锁屏密码', sub: '设置 · 默认关闭，自行设置', act: 'lock' },
    { kind: 'setting', name: '小组件商店', sub: '设置 · 挑选桌面小组件', act: 'store' }
  ];
}
function readRecent() { var r = lsGet(RECENT_KEY, null); return Array.isArray(r) ? r : []; }
function recordRecent(entry) {
  var r = readRecent().filter(function (x) { return !(x.kind === entry.kind && x.name === entry.name); });
  r.unshift({ kind: entry.kind, name: entry.name, sub: entry.sub || '' });
  lsSet(RECENT_KEY, r.slice(0, MAX_RECENT));
}
function searchAll(q) {
  var needle = String(q || '').trim().toLowerCase();
  var match = function (name, sub) { return !needle || String(name).toLowerCase().indexOf(needle) !== -1 || String(sub || '').toLowerCase().indexOf(needle) !== -1; };
  var groups = [];
  var apps = appEntries().filter(function (e) { return match(e.name, e.sub); });
  if (apps.length) groups.push({ title: '应用', items: apps });
  var wids = widgetEntries().filter(function (e) { return match(e.name, e.sub); });
  if (wids.length) groups.push({ title: '小组件', items: wids });
  var sets = settingEntries().filter(function (e) { return match(e.name, e.sub); });
  if (sets.length) groups.push({ title: '设置项', items: sets });
  var recent = readRecent().filter(function (e) { return match(e.name, e.sub); });
  if (!needle && recent.length) groups.unshift({ title: '最近使用', items: recent });
  else if (needle && recent.length) groups.push({ title: '最近使用', items: recent });
  return { groups: groups, empty: groups.length === 0 };
}
function renderSearchResults(q) {
  var box = $('#al-desk-results');
  if (!box) return;
  var res = searchAll(q);
  if (res.empty) {
    box.innerHTML = '<div class="al-sr-empty">没有找到“' + esc(q) + '”，试试换个词。</div>';
  } else {
    var html = '';
    res.groups.forEach(function (g) {
      html += '<div class="al-sr-group">' + esc(g.title) + '</div>';
      g.items.forEach(function (it) {
        html += '<button type="button" class="al-sr-item" data-kind="' + esc(it.kind) + '" data-name="' + esc(it.name) + '">'
          + '<span class="al-sr-type">' + esc(g.title) + '</span>' + esc(it.name)
          + (it.sub ? '<div class="al-sr-sub">' + esc(it.sub) + '</div>' : '') + '</button>';
      });
    });
    box.innerHTML = html;
  }
  box.classList.add('al-fade-in');
  box.removeAttribute('hidden');
}
function openSettingEntry(act) {
  if (act === 'store') {
    try { if (window.ACWidgets && typeof window.ACWidgets.openStore === 'function') { window.ACWidgets.openStore(); return; } } catch (e) {}
    ALToast('info', '小组件商店未就绪');
    return;
  }
  if (act === 'model') { ALToast('info', '接模型尚未合入（AG 组），请稍后再来'); return; }
  /* 主题/锁屏：点桌面“设置”图标；找不到时只提示，不造假跳转 */
  var icons = appEntries();
  var target = null;
  icons.forEach(function (e) { if (!target && e.name.indexOf('设置') !== -1) target = e.el; });
  if (target) { try { target.click(); } catch (e) {} ALToast('info', act === 'theme' ? '已打开设置，在“界面偏好”里改主题' : '已打开设置'); return; }
  ALToast('info', '请打开设置应用');
}
function buildDeskSearch() {
  /* GROUP-FIX2: 第二搜索入口已合并进 AF 桌面搜索（#af-search），这里不再建 #al-desk-search；searchAll/renderSearchResults 函数保留备用，以下旧体为死代码。 */
  try { var _old = document.getElementById('al-desk-search'); if (_old) _old.remove(); } catch (e) {}
  return true;
  try {
    if ($('#al-desk-search')) return true;
    var layer = $('#sys-desktop-layer');
    if (!layer) return false;
    var wrap = document.createElement('div');
    wrap.id = 'al-desk-search';
    wrap.innerHTML = '<input id="al-desk-input" type="search" role="searchbox" aria-label="搜索应用、小组件与设置" placeholder="搜索应用 / 小组件 / 设置…" autocomplete="off" />'
      + '<div id="al-desk-results" class="al-search-results" hidden="hidden"></div>';
    var paging = $('#sys-desktop-paging');
    if (paging && paging.parentNode === layer) layer.insertBefore(wrap, paging);
    else layer.insertBefore(wrap, layer.firstChild);
    var input = $('#al-desk-input');
    var box = $('#al-desk-results');
    input.addEventListener('input', function () { renderSearchResults(input.value); });
    input.addEventListener('focus', function () { renderSearchResults(input.value); });
    input.addEventListener('blur', function () { setTimeout(function () { try { box.setAttribute('hidden', 'hidden'); } catch (e) {} }, 200); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; box.setAttribute('hidden', 'hidden'); input.blur(); } });
    box.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.al-sr-item') : null;
      if (!btn) return;
      var kind = btn.getAttribute('data-kind');
      var name = btn.getAttribute('data-name');
      recordRecent({ kind: kind, name: name });
      box.setAttribute('hidden', 'hidden');
      input.value = '';
      if (kind === 'app') {
        var found = null;
        appEntries().forEach(function (a) { if (!found && a.name === name) found = a.el; });
        if (found) { try { found.click(); } catch (err) {} }
      } else if (kind === 'widget') {
        openSettingEntry('store');
      } else if (kind === 'setting') {
        var act = null;
        settingEntries().forEach(function (s) { if (s.name === name) act = s.act; });
        openSettingEntry(act || 'theme');
      }
    });
    return true;
  } catch (e) { return false; }
}

/* ── 14. 商店搜索框：SearchBar 全文搜索 + 自动补全的行为约定 ── */
function injectStoreSearch() {
  try {
    var modal = $('#ac-store-modal');
    if (!modal || $('#al-store-search')) return false;
    var card = $('.ac-store-card', modal);
    if (!card) return false;
    var box = document.createElement('div');
    box.id = 'al-store-search';
    box.className = 'al-store-search';
    box.innerHTML = '<input id="al-store-input" type="search" aria-label="搜索小组件" placeholder="搜索小组件…" autocomplete="off" />'
      + '<div id="al-store-suggest" class="al-store-suggest"></div>';
    card.insertBefore(box, card.firstChild);
    var input = $('#al-store-input');
    var suggest = $('#al-store-suggest');
    var applyFilter = function () {
      var q = input.value.trim().toLowerCase();
      var names = [];
      $$('.ac-store-item', card).forEach(function (it) {
        var text = (it.textContent || '').toLowerCase();
        var show = !q || text.indexOf(q) !== -1;
        it.style.display = show ? '' : 'none';
        if (q && show) { var nm = $('.ac-si-name', it); if (nm) names.push(nm.textContent.trim()); }
      });
      suggest.innerHTML = '';
      names.slice(0, 5).forEach(function (nm) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = nm;
        b.addEventListener('click', function () { input.value = nm; applyFilter(); input.focus(); });
        suggest.appendChild(b);
      });
    };
    input.addEventListener('input', applyFilter);
    /* 已在桌面的卡片同步选中态（单色细边） */
    $$('.ac-store-item', card).forEach(function (it) {
      var st = $('.ac-si-state', it);
      if (st && /已/.test(st.textContent || '')) { it.setAttribute('data-state', 'selected'); it.classList.add('ac-selected'); }
    });
    card.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.ac-si-sizes button') : null;
      if (!btn) return;
      var item = btn.closest('.ac-store-item');
      if (item) { item.setAttribute('data-state', 'selected'); item.classList.add('ac-selected'); }
    });
    return true;
  } catch (e) { return false; }
}

/* ── 22. 拖动视觉层（AK 未合入：只做视觉，不实现拖拽机制）── */
var dragVisual = { active: false, el: null, gap: null, timer: null, sx: 0, sy: 0 };
function dragInfo() {
  var ak = false;
  try { ak = !!window.AKDrag || !!document.querySelector('[data-ak-drag]'); } catch (e) {}
  return { akPresent: ak, mechanism: ak ? 'ak' : 'visual-only' };
}
function showTrashZone(hot) {
  var z = $('#al-trash-zone');
  if (!z) {
    z = document.createElement('div');
    z.id = 'al-trash-zone';
    z.textContent = '拖到这里删除（仅视觉演示：松手不删除，拖拽机制等 AK 组）';
    (document.getElementById('sys-shell') || document.body).appendChild(z);
  }
  z.setAttribute('data-state', hot ? 'hot' : 'idle');
  z.style.display = 'block';
}
function clearDragVisual() {
  try {
    if (dragVisual.timer) { clearTimeout(dragVisual.timer); dragVisual.timer = null; }
    if (dragVisual.el) dragVisual.el.classList.remove('al-dragging');
    if (dragVisual.gap && dragVisual.gap.parentNode) dragVisual.gap.parentNode.removeChild(dragVisual.gap);
    var z = $('#al-trash-zone');
    if (z) z.style.display = 'none';
  } catch (e) {}
  dragVisual.active = false; dragVisual.el = null; dragVisual.gap = null;
}
function bindDragVisual() {
  if (dragInfo().akPresent) return; /* AK 已合入：不抢它的拖拽 */
  document.addEventListener('pointerdown', function (e) {
    var icon = e.target && e.target.closest ? e.target.closest('.sys-app-icon') : null;
    if (!icon || (e.target.closest && e.target.closest('.ac-widget'))) return;
    if ($('.ac-moving')) return; /* AC 移动模式中不抢 */
    dragVisual.sx = e.clientX || 0; dragVisual.sy = e.clientY || 0;
    dragVisual.timer = setTimeout(function () {
      dragVisual.active = true;
      dragVisual.el = icon;
      icon.classList.add('al-dragging');
      var gap = document.createElement('div');
      gap.className = 'al-drop-gap';
      gap.style.width = (icon.offsetWidth || 54) + 'px';
      gap.style.height = (icon.offsetHeight || 54) + 'px';
      try { if (icon.parentNode) icon.parentNode.insertBefore(gap, icon.nextSibling); } catch (err) {}
      dragVisual.gap = gap;
      showTrashZone(false);
    }, 500);
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, clearDragVisual, true); });
  document.addEventListener('pointermove', function (e) {
    if (dragVisual.timer && (Math.abs((e.clientX || 0) - dragVisual.sx) > 12 || Math.abs((e.clientY || 0) - dragVisual.sy) > 12)) {
      clearTimeout(dragVisual.timer); dragVisual.timer = null;
    }
    if (dragVisual.active) {
      var z = $('#al-trash-zone');
      if (z) { var r = z.getBoundingClientRect(); var hot = (e.clientY || 0) > r.top && (e.clientY || 0) < r.bottom; z.setAttribute('data-state', hot ? 'hot' : 'idle'); }
    }
  }, true);
}

/* ── 26. 读屏标签：只给图标按钮补 aria-label，视觉保持极简 ── */
function a11yPass() {
  try {
    var bar = $('#sys-home-bar');
    if (bar && !bar.getAttribute('aria-label')) bar.setAttribute('aria-label', '回到桌面');
    $$('#sys-app-host button').forEach(function (b) {
      if (b.getAttribute('aria-label') || (b.textContent || '').trim()) return;
      var cls = b.className || '';
      var label = /back/.test(cls) ? '返回' : /close/.test(cls) ? '关闭' : /more/.test(cls) ? '更多' : /search/.test(cls) ? '搜索' : '按钮';
      b.setAttribute('aria-label', label);
    });
    $$('button').forEach(function (b) {
      if ((b.textContent || '').trim() === '•••' && !b.getAttribute('aria-label')) b.setAttribute('aria-label', '更多选项');
    });
    $$('.ac-w-move button, .ac-w-edit button').forEach(function (b) {
      if (!b.getAttribute('aria-label') && (b.textContent || '').trim()) b.setAttribute('aria-label', (b.textContent || '').trim());
    });
  } catch (e) {}
}

/* ── 25. 星级只作显示 ── */
function initStars() {
  $$('.al-stars[data-rating]').forEach(function (el) {
    var r = Math.max(0, Math.min(5, parseInt(el.getAttribute('data-rating') || '0', 10) || 0));
    el.textContent = '★'.repeat(r) + '☆'.repeat(5 - r);
    el.setAttribute('aria-label', '好感度 ' + r + ' 星，仅显示，不可改');
    el.setAttribute('title', '好感度由互动决定，这里只作显示');
  });
}

/* ── 设置页主题控件：#t-p-theme 出现时在其后注入变体/壁纸/圆体 ── */
function injectThemeControls() {
  try {
    var sel = $('#t-p-theme');
    if (!sel || $('#al-theme-extra')) return false;
    var al = readAlPrefs();
    var ui = readUiPrefs();
    var div = document.createElement('div');
    div.id = 'al-theme-extra';
    div.style.cssText = 'font-size:13px;line-height:2.2;flex-basis:100%;'; /* 占满整行：#t-p-theme 所在行是 flex（js/12 row() 的控件 span，带 flex-wrap），不占满会被挤在同一行、把色温变体/壁纸线条两个下拉压窄 */
    div.innerHTML = '<span>色温变体 </span><select id="al-variant" aria-label="色温变体">'
      + '<option value="none">默认</option><option value="warm">暖</option><option value="cold">冷</option></select> '
      + '<span>壁纸线条 </span><select id="al-wall" aria-label="壁纸线条">'
      + '<option value="none">纯白</option><option value="waves">波浪</option><option value="mountains">山</option><option value="forest">森林</option><option value="desert">沙漠</option></select><br/>'
      + '<label><input id="al-round-font" type="checkbox" /> 圆体界面字体（只改界面字体）</label> '
      + '<button type="button" class="al-theme-toggle" id="al-theme-toggle" aria-label="切换浅色深色跟随系统"><span class="al-ico al-ico-sun">☀</span><span class="al-ico al-ico-moon">☾</span><span id="al-theme-mode-label"></span></button>'
      + '<div style="font-size:12px;color:#8a857e;line-height:1.6;">深色为归巢深色（opt-in，白底默认不变）；壁纸线条仅在未设其他壁纸时出现；圆体默认关闭。</div>';
    sel.parentNode.insertBefore(div, sel.nextSibling);
    var vSel = $('#al-variant');
    var wSel = $('#al-wall');
    var rChk = $('#al-round-font');
    var label = $('#al-theme-mode-label');
    vSel.value = al.variant;
    wSel.value = al.wall;
    rChk.checked = !!al.roundFont;
    var syncLabel = function () { var _buN = ''; try { if (window.BuThemes) _buN = window.BuThemes.currentName(); } catch (e) {} label.textContent = '当前：' + (_buN || ((readUiPrefs().theme || 'light') === 'auto' ? '跟随系统' : (readUiPrefs().theme === 'dark' ? '深色' : '浅色'))); };
    syncLabel();
    vSel.addEventListener('change', function () { setVariant(vSel.value); ALToast('success', '色温变体已保存'); });
    wSel.addEventListener('change', function () { setWall(wSel.value); ALToast('success', wSel.value === 'none' ? '已恢复纯白壁纸' : '壁纸线条已保存'); });
    rChk.addEventListener('change', function () { setRoundFont(rChk.checked); ALToast('success', rChk.checked ? '圆体界面字体已开启' : '圆体界面字体已关闭'); });
    $('#al-theme-toggle').addEventListener('click', function () {
      var cur = readUiPrefs().theme || 'light';
      var next = cur === 'light' ? 'dark' : (cur === 'dark' ? 'auto' : 'light');
      setTheme(next);
      syncLabel();
      ALToast('success', '主题已切换为' + (next === 'auto' ? '跟随系统' : (next === 'dark' ? '深色' : '浅色')));
    });
    sel.addEventListener('change', function () { try { var _v = sel.value; if (window.BuThemes && _v && _v.indexOf('bu-') === 0) { window.BuThemes.apply(_v); } else { applyTheme(); } } catch (e) { applyTheme(); } syncLabel(); });
    return true;
  } catch (e) { return false; }
}

/* ── 24. AG 测试连接按钮的异步加载态（AG 已合入：按钮无 id，用 onclick 定位）── */
function wireAgTestButton() {
  try {
    if (typeof window.PhoneModel === 'undefined' || !window.PhoneModel) return false;
    var btn = document.querySelector('button[onclick*="testFromForm"]');
    if (!btn || btn.getAttribute('data-al-wired')) return !!btn;
    btn.setAttribute('data-al-wired', '1');
    btn.addEventListener('click', function () {
      try {
        btn.setAttribute('data-state', 'loading');
        if (!btn.querySelector('.al-spinner')) {
          var spin = document.createElement('span');
          spin.className = 'al-spinner';
          btn.insertBefore(spin, btn.firstChild);
        }
        var clear = function () { try { btn.removeAttribute('data-state'); var s = btn.querySelector('.al-spinner'); if (s) s.remove(); } catch (e) {} };
        var result = document.getElementById('pm-test-result');
        if (result && typeof MutationObserver !== 'undefined') {
          var ob = new MutationObserver(function () {
            var t = result.textContent || '';
            if (t && t.indexOf('正在测试连接') === -1) { try { ob.disconnect(); } catch (e) {} clear(); }
          });
          ob.observe(result, { childList: true, characterData: true, subtree: true });
        }
        setTimeout(clear, 15000);
      } catch (e) {}
    });
    return true;
  } catch (e) { return false; }
}

/* ── 全局委托：涟漪 / 复制 / 点赞 / 开关 / 分段 / Esc / Cmd-K ── */
function bindGlobal() {
  document.addEventListener('pointerdown', function (e) {
    if (reducedMotion()) return;
    var t = e.target && e.target.closest ? e.target.closest('.wx-send-btn, [data-al-primary], .al-btn-primary') : null;
    if (!t) return;
    try {
      if (!t.classList.contains('al-ripple')) t.classList.add('al-ripple');
      var r = t.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2.2;
      var ink = document.createElement('span');
      ink.className = 'al-ripple-ink';
      ink.style.width = size + 'px';
      ink.style.height = size + 'px';
      ink.style.left = ((e.clientX || r.left + r.width / 2) - r.left - size / 2) + 'px';
      ink.style.top = ((e.clientY || 0) - r.top - size / 2) + 'px';
      t.appendChild(ink);
      setTimeout(function () { try { ink.remove(); } catch (err) {} }, 500);
    } catch (err) {}
  });
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-al-copy]') : null;
    if (t) {
      var text = t.getAttribute('data-al-copy') || '';
      var done = function () { t.classList.add('al-copied'); setTimeout(function () { try { t.classList.remove('al-copied'); } catch (err) {} }, 1200); ALToast('success', '已复制'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); }
        else {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (err) {}
          ta.remove(); done();
        }
      } catch (err) { done(); }
      return;
    }
    var like = e.target && e.target.closest ? e.target.closest('[data-al-like]') : null;
    if (like && !reducedMotion()) {
      try {
        for (var i = 0; i < 6; i++) {
          var b = document.createElement('span');
          b.className = 'al-burst-bit';
          b.style.setProperty('--dx', (Math.random() * 36 - 18).toFixed(0) + 'px');
          b.style.setProperty('--dy', (-(14 + Math.random() * 22)).toFixed(0) + 'px');
          b.style.left = '50%'; b.style.top = '0';
          like.appendChild(b);
          (function (el) { setTimeout(function () { try { el.remove(); } catch (err) {} }, 700); })(b);
        }
      } catch (err) {}
      return;
    }
    var sw = e.target && e.target.closest ? e.target.closest('[data-al-switch]') : null;
    if (sw) {
      var on = sw.getAttribute('data-state') === 'on';
      sw.setAttribute('data-state', on ? 'off' : 'on');
      sw.setAttribute('aria-checked', on ? 'false' : 'true');
      return;
    }
    var seg = e.target && e.target.closest ? e.target.closest('.al-segmented button') : null;
    if (seg) {
      $$('.al-segmented button', seg.parentNode).forEach(function (b) { b.setAttribute('data-state', 'idle'); });
      seg.setAttribute('data-state', 'active');
      return;
    }
    var stars = e.target && e.target.closest ? e.target.closest('.al-stars') : null;
    if (stars) { ALToast('info', '好感度由互动决定，这里只作显示'); return; }
    var cf = e.target && e.target.closest ? e.target.closest('[data-al-confetti]') : null;
    if (cf) { confetti(cf.parentNode && cf.parentNode !== document ? cf.parentNode : document.body); return; }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      var input = $('#al-desk-input');
      if (input) { e.preventDefault(); input.focus(); renderSearchResults(input.value); }
      return;
    }
    if (e.key === 'Escape') {
      if (closeModal()) return;
      var store = $('#ac-store-modal');
      if (store) {
        var closer = $('[data-ac-close-store]', store);
        if (closer) { try { closer.click(); return; } catch (err) {} }
        try { store.remove(); } catch (err) {}
        return;
      }
      var box = $('#al-desk-results');
      if (box) box.setAttribute('hidden', 'hidden');
    }
  });
  /* AG 测试按钮若已存在（AG 合入后）：点按时加异步加载态；AG 未合入时只留 helper */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-al-async-test]') : null;
    if (btn && !window.PhoneModel) { asyncTest(btn, function () { return new Promise(function (res) { setTimeout(function () { res(true); }, 600); }); }); }
  });
  /* 微信“正在输入”出现时补流式小圆点与模式徽标（只加 UI，不碰发送/回复逻辑） */
  try {
    var bar0 = $('#wx-chat-state-bar');
    if (bar0) {
      var obs = new MutationObserver(function () {
        try { showTyping(bar0.classList.contains('wx-typing')); } catch (err) {}
      });
      obs.observe(bar0, { attributes: true, attributeFilter: ['class'] });
    }
  } catch (e) {}
}

/* ── 初始化 ── */
var _inited = false;
function init() {
  if (_inited) return true;
  _inited = true;
  try { applyTheme(); } catch (e) {}
  try { buildDeskSearch(); } catch (e) {}
  try { injectThemeControls(); } catch (e) {}
  try { a11yPass(); } catch (e) {}
  try { initStars(); } catch (e) {}
  try { $$('[data-al-skeleton]').forEach(function (el) { if (!el.children.length) skeleton(el, parseInt(el.getAttribute('data-al-skeleton') || '3', 10) || 3); }); } catch (e) {}
  try { bindGlobal(); } catch (e) {}
  try { bindDragVisual(); } catch (e) {}
  try { wireAgTestButton(); } catch (e) {}
  try {
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        try { buildDeskSearch(); } catch (e) {}
        try { injectThemeControls(); } catch (e) {}
        try { injectStoreSearch(); } catch (e) {}
        try { wireAgTestButton(); } catch (e) {}
        try { a11yPass(); } catch (e) {}
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  } catch (e) {}
  try {
    var mq = matchMediaSafe('(prefers-color-scheme: dark)');
    var onChange = function () { try { if ((readUiPrefs().theme || 'light') === 'auto') applyTheme(); } catch (e) {} };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch (e) {}
  return true;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
}
window.ThemeAL = {
  init: init, applyTheme: applyTheme, setTheme: setTheme, setVariant: setVariant,
  setWall: setWall, setRoundFont: setRoundFont, readAlPrefs: readAlPrefs, readUiPrefs: readUiPrefs,
  modeInfo: modeInfo, showTyping: showTyping, skeleton: skeleton, confetti: confetti,
  setCharStatus: setCharStatus, setState: setState, openModal: openModal, closeModal: closeModal,
  asyncTest: asyncTest, searchAll: searchAll, renderSearchResults: renderSearchResults,
  buildDeskSearch: buildDeskSearch, injectStoreSearch: injectStoreSearch, injectThemeControls: injectThemeControls,
  dragInfo: dragInfo, reducedMotion: reducedMotion, a11yPass: a11yPass, initStars: initStars,
  wireAgTestButton: wireAgTestButton,
  info: function () {
    var al = readAlPrefs();
    var ui = readUiPrefs();
    return {
      theme: ui.theme || 'light', resolved: resolvedTheme(ui.theme || 'light'),
      variant: al.variant, wall: al.wall, roundFont: al.roundFont,
      mode: modeInfo().mode,
      agPresent: (typeof window.PhoneModel !== 'undefined' && !!window.PhoneModel),
      afPresent: !!document.querySelector('.af-search'),
      acPresent: !!document.querySelector('#ac-widget-zone') || !!document.querySelector('.ac-store-item'),
      akPresent: dragInfo().akPresent, dragMechanism: dragInfo().mechanism
    };
  }
};
window.ALToast = ALToast;
})();
