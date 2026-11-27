
/* GROUP-V-SCENES-GARDEN-THEME · V组：阶段五 场景与动作（A29/A30/A31）+ 阶段六 锦上添花（A5/A6/A7）+ A32 主题
   只借鉴做法，全部为本组新写代码，未复制任何项目代码；Hanami 为 AGPL-3.0，其代码一行未拿。
   做法出处（设计思路 only）：
   - A29/A30/A31/A32：Hanami（https://github.com/Undi95/Hanami，AGPL-3.0）。
   - A5/A6/A7：Pulse（https://github.com/elliejayliquid/pulse，MIT）。
   合并接线（实测）：M 组记忆树已合入，花园接在它的树上；N 组一起玩/表情包已合入，像素画与表情包包接 N 组；
   P 组动作台/VRM 预览已合入，动作按 A30 约定重命名后委托 P 的 motion，VRM 加载复用 P 的预览器；
   T 组 phone_ui_prefs_v1 已合入（theme=light|dark|auto，themeCustom={c1浅色,c2主色}），主题两色按此形状写。
   C 档一项未碰：见补丁脚本头注释。
*/
(function () {
'use strict';
/* ── 通用小工具 ── */
var $ = function (s, r) { try { return (r || document).querySelector(s); } catch (e) { return null; } };
var $$ = function (s, r) { try { return Array.prototype.slice.call((r || document).querySelectorAll(s)); } catch (e) { return []; } };
var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var clamp = function (n, a, b) { n = +n || 0; return Math.max(a, Math.min(b, n)); };
var lsGet = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
var HEX6 = /^#[0-9a-fA-F]{6}$/;
var isHex = function (c) { return typeof c === 'string' && HEX6.test(c); };
var hexRgb = function (hex) { var h = String(hex || '').replace('#', ''); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; };
var hexLum = function (hex) { var r = hexRgb(hex); return (0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]) / 255; };
var dayNum = function () { return new Date().getDate(); };

/* ══════════ A32 主题：14 套 + 每套 5 配色 + 可分享代码 ══════════
   写进 T 组已合入的 phone_ui_prefs_v1（theme=light|dark|auto 不动其含义；主题两色写 themeCustom.c1/c2，
   c1=浅色/背景，c2=主色/强调——与 T 的默认值 {c1:'#ffffff', c2:'#34363b'} 语义一致）。
   2026-11-28 批量 0020（项 1）：主题是唯一数据源（js/54 BU_THEMES 与 js/15 AppTheme.THEMES
   都以这里为准，不再各存一份）；每套主题 = {封面(由 c1/c2 + 配色画), 配色方案 colors[5]}，
   colors[0] 永远是主题原配色 c2，5 个配色全部不含纯黑 #000000；vars 是全套 --app-*（与
   AppTheme.THEMES / BuThemes 注入的样式同值），dark 标深色款。选颜色只改 themeCustom.c2，
   theme 字段始终保留主题 id（setCustomColor 也不再把它写成 'light'）。 */
var PREFS_KEY = 'phone_ui_prefs_v1';
var PREFS_DEFAULT = { lang: 'zh-CN', theme: 'light', themeCustom: { c1: '#ffffff', c2: '#34363b' }, layout: 'default', lastChar: '', lastChat: '', wallpaper: 'fish', fishStyle: 'ascii', fishBg: '#ffffff', fishFollowTheme: false, wallpaperMigrated: false, iconStyle: 'default', widgetsEnabled: true, petEnabled: true, petMode: 'full', petSize: 'medium', petSkin: 'default', clockStyle: 'default', migratedFrom: [] };
var THEMES = [
  { id: 'guichao', name: '归巢默认', c1: '#ffffff', c2: '#34363b', desc: '归巢黑白灰，默认主题', dark: false, colors: ['#34363b', '#4a4d52', '#6e7278', '#9aa0a6', '#b08d57'], vars: { '--app-bg': '#ffffff', '--app-surface': '#f9f9f9', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': '#e5e5e5', '--app-accent': '#34363b', '--app-accent-soft': '#e5e5e5' } },
  { id: 'warm', name: '晨光暖阳', c1: '#fdf6ec', c2: '#c87a5a', desc: '陶土暖阳', dark: false, colors: ['#c87a5a', '#b96a4b', '#d99a76', '#e8b48f', '#8a5a44'], vars: { '--app-bg': '#fdf6ec', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#c87a5a', '--app-accent-soft': '#f3ddd2' } },
  { id: 'mint', name: '薄荷清晨', c1: '#eef7f2', c2: '#2f9e7e', desc: '薄荷绿', dark: false, colors: ['#2f9e7e', '#27856c', '#57b89a', '#7ccbb3', '#1f6f57'], vars: { '--app-bg': '#eef7f2', '--app-surface': '#f7fbf9', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#2f9e7e', '--app-accent-soft': '#d2ece3' } },
  { id: 'dusk', name: '暮山紫', c1: '#f4f0fa', c2: '#7a5fb5', desc: '暮山紫', dark: false, colors: ['#7a5fb5', '#6a4ea3', '#9783c9', '#b3a6d8', '#54428a'], vars: { '--app-bg': '#f4f0fa', '--app-surface': '#faf8fd', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#7a5fb5', '--app-accent-soft': '#e3dcf2' } },
  { id: 'sea', name: '海盐蓝', c1: '#eef4fb', c2: '#3a7bd5', desc: '海盐蓝', dark: false, colors: ['#3a7bd5', '#2f68b8', '#5f97dd', '#8db6e6', '#1f4e8c'], vars: { '--app-bg': '#eef4fb', '--app-surface': '#f7fafd', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#3a7bd5', '--app-accent-soft': '#d8e6f7' } },
  { id: 'trianon', name: '特里亚农 · 洛可可', c1: '#fbf9f4', c2: '#5c6884', desc: '雾蓝银蓝奶白，洛可可信笺风', dark: false, colors: ['#5c6884', '#4c5670', '#7c88a3', '#9aa5bb', '#3d465e'], vars: { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5c6884', '--app-accent-soft': '#dce2f1' } },
  { id: 'bu-spring-pink', name: '春·槐花粉', c1: '#fbf9f4', c2: '#6f687e', desc: '奶白纸底，藕粉只一点点。', dark: false, colors: ['#6f687e', '#5d5768', '#8a8494', '#a9a3b1', '#4a4456'], vars: { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#6f687e', '--app-accent-soft': '#e8c9d0' } },
  { id: 'bu-autumn-red', name: '秋·枫叶红', c1: '#fffdf8', c2: '#5b5871', desc: '信笺纸底，深藕粉点缀。', dark: false, colors: ['#5b5871', '#4a475e', '#75718a', '#9793a8', '#38354a'], vars: { '--app-bg': '#fffdf8', '--app-surface': '#fbf9f4', '--app-card': '#fbf9f4', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5b5871', '--app-accent-soft': '#e8c9d0' } },
  { id: 'bu-night-black', name: '夜·蜕茧黑', c1: '#1e2748', c2: '#e8c9d0', desc: '墨蓝底，藕粉点缀（深色款）。', dark: true, colors: ['#e8c9d0', '#d9aeb8', '#f0dde1', '#c99aa6', '#b98a96'], vars: { '--app-bg': '#1e2748', '--app-surface': '#46536f', '--app-card': '#46536f', '--app-text': '#fbf9f4', '--app-muted': '#a9b3cc', '--app-line': 'rgba(251,249,244,.16)', '--app-accent': '#e8c9d0', '--app-accent-soft': '#5c6884' } },
  { id: 'bu-winter-blue', name: '冬·雪河蓝', c1: '#eef0f5', c2: '#46536f', desc: '画布底，墨蓝柔点缀。', dark: false, colors: ['#46536f', '#39435c', '#5f6d8c', '#7f8ca8', '#2e3648'], vars: { '--app-bg': '#eef0f5', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#46536f', '--app-accent-soft': '#dce2f1' } },
  { id: 'bu-mint', name: '薄荷绿', c1: '#fbf9f4', c2: '#6e7894', desc: '奶白纸底，银蓝点缀。', dark: false, colors: ['#6e7894', '#5d667f', '#8b93a8', '#a8adbd', '#4a5165'], vars: { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#6e7894', '--app-accent-soft': '#dce2f1' } },
  { id: 'bu-lavender', name: '薰衣草紫', c1: '#fbf9f4', c2: '#5c6884', desc: '奶白纸底，雾蓝点缀。', dark: false, colors: ['#5c6884', '#6e5f9e', '#8f83b5', '#b0a6cc', '#4a4468'], vars: { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5c6884', '--app-accent-soft': '#dce2f1' } },
  { id: 'bu-cream', name: '奶油黄', c1: '#fffdf8', c2: '#46536f', desc: '信笺纸底，墨蓝柔点缀。', dark: false, colors: ['#46536f', '#39435c', '#5f6d8c', '#8a7a52', '#b08d57'], vars: { '--app-bg': '#fffdf8', '--app-surface': '#fbf9f4', '--app-card': '#fbf9f4', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#46536f', '--app-accent-soft': '#eef0f5' } },
  { id: 'bu-forest', name: '墨绿', c1: '#1e2748', c2: '#a9b3cc', desc: '墨蓝底，雾蓝浅点缀（深色款）。', dark: true, colors: ['#a9b3cc', '#93a0bd', '#c2cadb', '#d8dde8', '#7c88a3'], vars: { '--app-bg': '#1e2748', '--app-surface': '#46536f', '--app-card': '#46536f', '--app-text': '#fbf9f4', '--app-muted': '#a9b3cc', '--app-line': 'rgba(251,249,244,.16)', '--app-accent': '#a9b3cc', '--app-accent-soft': '#5c6884' } }
];
var themeById = function (id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return null; };
/* GROUP-THROTTLE: 缓存 prefs 原始解析结果（500ms TTL + 写版本号失效；与 FIXAPPS 的
   loadPrefs 同款做法：只省读盘与 JSON.parse，不省合并，每次仍返回新合并对象，
   调用方改返回对象不污染缓存）。 */
var _throttleRaw = null, _throttleRawAt = 0, _throttleRawRev = -1, _throttleRawReady = false;
var readPrefs = function () {
  var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
  var _now = Date.now();
  var raw;
  if (_throttleRawReady && _throttleRawRev === _rev && _now - _throttleRawAt < 500) { raw = _throttleRaw; }
  else { raw = lsGet(PREFS_KEY, null); _throttleRaw = raw; _throttleRawAt = _now; _throttleRawRev = _rev; _throttleRawReady = true; }
  var out = JSON.parse(JSON.stringify(PREFS_DEFAULT));
  if (raw && typeof raw === 'object') {
    Object.keys(PREFS_DEFAULT).forEach(function (k) { if (raw[k] !== undefined) out[k] = raw[k]; });
    Object.keys(raw).forEach(function (k) { if (!(k in out)) out[k] = raw[k]; });
  }
  return out;
};
var writePrefs = function (patch) {
  var cur = readPrefs();
  Object.keys(patch || {}).forEach(function (k) { cur[k] = patch[k]; });
  lsSet(PREFS_KEY, cur);
  try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */
  return cur;
};
var readCustom = function () {
  var p = readPrefs();
  var tc = (p && p.themeCustom) || {};
  if (isHex(tc.c1) && isHex(tc.c2)) return { c1: tc.c1, c2: tc.c2 };
  if (isHex(tc.hex)) return { c1: '#ffffff', c2: tc.hex };
  return { c1: PREFS_DEFAULT.themeCustom.c1, c2: PREFS_DEFAULT.themeCustom.c2 };
};
/* 2026-11-28 批量 0020（项 1）：生效主题 = 主题定义 + themeCustom 里选中的配色。
   themeCustom.c2 是该主题 colors 里的配色时（详情页点的 5 色之一）即生效；非 BU 主题时，
   高级取色器点的任意合法颜色也生效（老“自定义两色”行为）；BU 主题只认 colors 里的配色，
   与 AppTheme.apply “BU 主题不吃 themeCustom 覆盖”的保护口径一致（AC 组启动时会重写
   themeCustom，任意色会把 BU 点缀色改错）。不加新字段，配色只存在 themeCustom.c1/c2 里。 */
var effectiveTheme = function (t, tc) {
  var c1 = t.c1, c2 = t.c2;
  tc = tc || {};
  var inColors = function (v) { return !!(t.colors && isHex(v) && t.colors.indexOf(String(v).toLowerCase()) >= 0); };
  var isBu = String(t.id || '').indexOf('bu-') === 0;
  if (isHex(tc.c2) && (inColors(tc.c2) || !isBu)) c2 = tc.c2;
  if (isHex(tc.c1) && (inColors(tc.c1) || !isBu)) c1 = tc.c1;
  return { id: t.id, name: t.name, c1: c1, c2: c2, desc: t.desc, colors: t.colors, dark: t.dark, vars: t.vars };
};
var currentTheme = function () {
  /* GROUP-BU：theme 字段存着主题 id 时优先认它（AC 组启动时重写 themeCustom 两色，theme 字段不受影响，重启后主题靠它恢复）。 */
  /* GROUP-THROTTLE: 原直读 localStorage 解析改走带缓存的 readPrefs（theme 字段值与 raw 一致，语义不变）。 */
  try { var _pt2 = readPrefs(); if (_pt2 && typeof _pt2.theme === 'string') { var _bt = themeById(_pt2.theme); if (_bt) return effectiveTheme(_bt, _pt2.themeCustom); } } catch (e1) {}
  var c = readCustom();
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].c1.toLowerCase() === String(c.c1).toLowerCase() && THEMES[i].c2.toLowerCase() === String(c.c2).toLowerCase()) return effectiveTheme(THEMES[i], c);
  }
  return { id: 'custom', name: '自定义', c1: c.c1, c2: c.c2, desc: '自定义两色', colors: null, dark: false, vars: null };
};
var applyTheme = function () {
  var cur = currentTheme();
  try {
    var de = document.documentElement;
    de.style.setProperty('--gv-soft', cur.c1);
    de.style.setProperty('--gv-accent', cur.c2);
    de.style.setProperty('--gv-on-accent', hexLum(cur.c2) > 0.6 ? '#25262a' : '#ffffff');
    de.style.setProperty('--wx-theme-color', cur.c2);
    de.style.setProperty('--sys-theme-color', cur.c2);
    de.setAttribute('data-gv-theme', cur.id);
    var shell = document.getElementById('sys-shell');
    if (shell) { shell.style.setProperty('--gc-accent', cur.c2); shell.style.setProperty('--gc-soft', cur.c1); }
    $$('[data-gv-theme-name]').forEach(function (el) { el.textContent = cur.name; });
  } catch (e) {}
  /* GROUP-BU：V 主题换完后同步 AppTheme 全套变量、桌面底色与 AL 深浅判定。 */
  try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (e2) {}
  try { if (window.BuThemes && window.BuThemes.syncShellBg) window.BuThemes.syncShellBg(); } catch (e3) {}
  try { if (window.applyTheme) window.applyTheme(); } catch (e4) {}
  return cur;
};
var setTheme = function (id) {
  var t = themeById(id);
  if (!t) return null;
  writePrefs({ theme: id, themeCustom: { c1: t.c1, c2: t.c2 } });
  var cur = applyTheme();
  refreshOtomeSettings();
  return cur;
};
var setCustomColor = function (which, val) {
  if (!isHex(val)) return null;
  var c = readCustom();
  if (which === 1) c.c1 = val; else c.c2 = val;
  /* 2026-11-28 批量 0020（项 1）：以前这里写死 theme:'light'，选颜色就丢了主题 id，
     currentTheme() 只能靠 c1/c2 反推，推不出就是 custom。改为保留当前主题 id；
     生效与否由 effectiveTheme() 按“BU 只认 5 配色 / 非 BU 认任意色”判定。 */
  var cur = currentTheme();
  var id = (cur && cur.id && cur.id !== 'custom') ? cur.id : 'light';
  writePrefs({ theme: id, themeCustom: { c1: c.c1, c2: c.c2 } });
  var cur2 = applyTheme();
  return cur2;
};
/* 2026-11-28 批量 0020（项 1）：详情页选配色——只改 themeCustom.c2，theme id 不动。 */
var themeColors = function (id) { var t = themeById(id); return (t && t.colors) ? t.colors.slice() : []; };
var setThemeColor = function (id, hex) {
  var t = themeById(id);
  if (!t || !isHex(hex)) return null;
  var h = String(hex).toLowerCase();
  if (!t.colors || t.colors.indexOf(h) < 0) return null;
  writePrefs({ theme: id, themeCustom: { c1: t.c1, c2: h } });
  var cur = applyTheme();
  refreshOtomeSettings();
  return cur;
};
var shareCode = function () {
  var cur = currentTheme();
  var t = themeById(cur.id);
  /* 选了非原配色时用 C 码带走真实两色（否则 T 码只剩主题 id，配色会丢）。 */
  if (t && (String(cur.c1).toLowerCase() !== String(t.c1).toLowerCase() || String(cur.c2).toLowerCase() !== String(t.c2).toLowerCase())) return 'GV1-C-' + String(cur.c1).slice(1).toUpperCase() + '-' + String(cur.c2).slice(1).toUpperCase();
  if (cur.id !== 'custom') return 'GV1-T-' + cur.id.toUpperCase();
  return 'GV1-C-' + String(cur.c1).slice(1).toUpperCase() + '-' + String(cur.c2).slice(1).toUpperCase();
};
var decodeTheme = function (code) {
  var s = String(code || '').trim();
  var m = /^GV1-(?:T-([A-Za-z-]+)|C-([0-9A-Fa-f]{6})-([0-9A-Fa-f]{6}))$/.exec(s);
  if (!m) return null;
  if (m[1]) { var t = themeById(m[1].toLowerCase()); if (!t) return null; return { id: t.id, themeCustom: { c1: t.c1, c2: t.c2 } }; }
  var c1 = '#' + m[2], c2 = '#' + m[3];
  /* C 码的两色若正好是某主题的 c1 + colors 里的配色，认回该主题 id（否则落盘成 custom）。 */
  for (var i = 0; i < THEMES.length; i++) {
    var tt = THEMES[i];
    if (tt.c1.toLowerCase() === c1.toLowerCase() && tt.colors && tt.colors.indexOf(c2.toLowerCase()) >= 0) return { id: tt.id, themeCustom: { c1: c1, c2: c2 } };
  }
  return { id: 'custom', themeCustom: { c1: c1, c2: c2 } };
};
var importShareCode = function (code) {
  var d = decodeTheme(code);
  if (!d) return null;
  writePrefs({ theme: (d && d.id) || 'light', themeCustom: d.themeCustom });
  var cur = applyTheme();
  refreshOtomeSettings();
  return cur;
};
var setShareMsg = function (t) { var el = document.getElementById('gv-share-msg'); if (el) el.textContent = t; };
var fallbackCopy = function (code) {
  try {
    var ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); setShareMsg(ok ? '已复制：' + code : '复制失败，请手动复制：' + code);
  } catch (e) { setShareMsg('请手动复制：' + code); }
};
var copyShareCode = function () {
  var code = shareCode();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { setShareMsg('已复制：' + code); }, function () { fallbackCopy(code); });
      return code;
    }
  } catch (e) {}
  fallbackCopy(code);
  return code;
};
var importShareCodeUI = function () {
  var inp = document.getElementById('gv-share-import');
  var r = importShareCode(inp ? inp.value : '');
  setShareMsg(r ? ('已导入主题：' + r.name) : '代码不对（应为 GV1- 开头）');
  return r;
};
/* D 批禁 emoji：主题对勾/关闭/人物/刷新/调色盘/猫/背包改线稿 SVG（猫取 js/64-ui-vector-icons 的线稿）。 */
var GV_CHECK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>';
var GV_X_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var GV_FACE_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.1m6.8 0h.1M8.5 15c1.1 1.5 2.3 2.2 3.5 2.2s2.4-.7 3.5-2.2"/></svg>';
var GV_PERSON_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-3.6 2.7-5.4 6.5-5.4s6 1.8 6.5 5.4"/></svg>';
var GV_BOX_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 5 9-5M12 12.5V21"/></svg>';
var GV_REFRESH_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>';
var GV_PALETTE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1.1 1.7-2.3-.5-1.3.3-2.7 1.8-2.7H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
var GV_CAT_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M4.5 10 4 4l5 2.5a9 9 0 0 1 6 0L20 4l-.5 6a8 8 0 1 1-15 0Z"/><path d="M8.5 12h.1m6.8 0h.1M10 15.5c1.4 1.1 2.6 1.1 4 0m-4-2.4-4-1m8 0 4-1"/></svg>';
var GV_PACK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><rect x="6" y="8" width="12" height="12" rx="4"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6"/></svg>';
var GV_DOWN_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M12 4v16m0 0-6-6m6 6 6-6"/></svg>';
/* ══════════ Cover Flow #247（2026-11-28 批量 0020 项 1）══════════
   仓库原先没有任何 coverflow/carousel（全文检索 0 命中），PhotoStack 是多图堆叠不是
   Cover Flow，不能复用。按 Dock 放大 #249 的模式：一个中心值 p（浮点“正中序号”）驱动
   全部封面的 transform，唯一驱动函数 cfRender() + 唯一 rAF 动画 cfAnimateTo()。
   封面是壁纸形 132×198（非 #247 的 88×88 方块），封面画 = 主题自己的颜色
   （coverBg：c2 → colors[1] → colors[2] 渐变 + c1 圆 + colors[3] 底带），无新图片资产。
   #247 的数照抄：横移 rel×74px，再往外每张 30px 递进；旋转 clamp(|rel|)×62°，左右镜像；
   侧面罩白最高 45%；倒影透明度 0.22 向地面淡出；正中标题只在 p 接近整数时显示。
   开场 4.7s 内分四段步进（0.25–0.75s、1.05–1.55s、1.85–2.35s、3.0–4.3s，cubic
   ease-in-out）：从当前主题往前 4 张走到当前主题；用户一碰（pointerdown/点按）即停。
   滑动/点按切换 p；点正中封面进主题详情（该主题的 5 个配色）。 */
var _cfP = 0, _cfRaf = 0, _cfTimers = [], _cfDrag = null, _cfSuppressClick = false;
var _cfEase = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
var _cfIndex = function () { var cur = currentTheme(); for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === cur.id) return i; return 0; };
var coverBg = function (t) {
  var cs = (t && t.colors) || [];
  var a = (t && t.c2) || '#34363b', b = cs[1] || a, c = cs[2] || a;
  return 'linear-gradient(165deg,' + a + ' 0%,' + b + ' 55%,' + c + ' 100%)';
};
var _cfCoverStyle = function (i, p) {
  var rel = i - p, ax = Math.abs(rel), s = rel < 0 ? -1 : 1;
  var x = ax <= 1 ? rel * 74 : s * (74 + 30 * (ax - 1));
  var rot = s * Math.min(ax, 1) * 62;
  return { transform: 'translateX(' + x.toFixed(1) + 'px) rotateY(' + rot.toFixed(1) + 'deg)', z: 100 - Math.round(ax * 10), wash: Math.min(ax, 1) * 0.45 };
};
var _cfCoverHTML = function (t, i, p) {
  var st = _cfCoverStyle(i, p);
  var cs = t.colors || [];
  return '<div class="gv-cf-cover" data-cf-i="' + i + '" role="button" tabindex="0" aria-label="' + esc(t.name) + '" style="transform:' + st.transform + ';z-index:' + st.z + '" onclick="window.GroupV.cfTap(' + i + ')">'
    + '<div class="gv-cf-art" style="background:' + coverBg(t) + ';"><i class="gv-cf-sun" style="background:' + t.c1 + '"></i><i class="gv-cf-band" style="background:' + (cs[3] || t.c2) + '"></i></div>'
    + '<div class="gv-cf-wash" style="opacity:' + st.wash.toFixed(2) + '"></div></div>';
};
var cfRender = function () {
  var stage = document.getElementById('gv-cf-stage');
  if (!stage) return false;
  var covers = $$('.gv-cf-cover', stage);
  covers.forEach(function (el) {
    var i = parseInt(el.getAttribute('data-cf-i') || '0', 10);
    var st = _cfCoverStyle(i, _cfP);
    el.style.transform = st.transform;
    el.style.zIndex = String(st.z);
    var w = el.querySelector('.gv-cf-wash');
    if (w) w.style.opacity = st.wash.toFixed(2);
  });
  var title = document.getElementById('gv-cf-title');
  if (title) {
    var fi = Math.round(_cfP), frac = Math.abs(_cfP - fi);
    var t = THEMES[fi];
    if (t) { title.textContent = t.name; title.style.opacity = frac < 0.12 ? String(1 - frac / 0.12) : '0'; }
  }
  var view = stage.parentNode;
  if (view) {
    $$('.gv-cf-dot', view).forEach(function (d, di) { d.classList.toggle('on', di === Math.round(_cfP)); });
  }
  return true;
};
var _cfCancelRaf = function () { if (_cfRaf) { try { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_cfRaf); } catch (e) {} _cfRaf = 0; } };
var _cfCancelIntro = function () { _cfTimers.forEach(function (id) { clearTimeout(id); }); _cfTimers = []; _cfCancelRaf(); };
var cfAnimateTo = function (target, durMs, done) {
  _cfCancelRaf();
  target = clamp(target, 0, THEMES.length - 1);
  if (typeof requestAnimationFrame !== 'function') { _cfP = target; cfRender(); if (done) done(); return true; }
  var from = _cfP, dur = Math.max(1, durMs || 350), t0 = null;
  var step = function (ts) {
    if (t0 === null) t0 = ts;
    var k = Math.min(1, (ts - t0) / dur);
    _cfP = from + (target - from) * _cfEase(k);
    cfRender();
    if (k < 1) { _cfRaf = requestAnimationFrame(step); }
    else { _cfRaf = 0; _cfP = target; cfRender(); if (done) done(); }
  };
  _cfRaf = requestAnimationFrame(step);
  return true;
};
var cfIntro = function () {
  _cfCancelIntro();
  var cur = _cfIndex(), start = Math.max(0, cur - 4), steps = cur - start;
  if (steps <= 0) { _cfP = cur; cfRender(); return true; }
  _cfP = start; cfRender();
  var wins = [[250, 750], [1050, 1550], [1850, 2350], [3000, 4300]];
  for (var k = 0; k < steps; k++) {
    (function (kk) {
      var w = wins[kk] || wins[wins.length - 1];
      _cfTimers.push(setTimeout(function () { cfAnimateTo(start + kk + 1, w[1] - w[0]); }, w[0]));
    })(k);
  }
  return true;
};
var cfInit = function () {
  var stage = document.getElementById('gv-cf-stage');
  if (!stage) return false;
  /* 只在首次绑定时把 p 对到当前主题；已绑定的 stage 上再次 cfInit（点按/回详情时）
     不能重置 p，否则刚滑到的封面会被拉回当前主题，点正中封面也进不了详情。 */
  if (!stage._cfBound) _cfP = _cfIndex();
  cfRender();
  if (stage._cfBound) return true;
  stage._cfBound = true;
  stage.addEventListener('pointerdown', function (ev) {
    _cfCancelIntro();
    _cfDrag = { x0: ev.clientX, p0: _cfP, moved: false };
    try { if (stage.setPointerCapture) stage.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  stage.addEventListener('pointermove', function (ev) {
    if (!_cfDrag) return;
    var dx = ev.clientX - _cfDrag.x0;
    if (Math.abs(dx) > 8) _cfDrag.moved = true;
    if (_cfDrag.moved) { _cfCancelRaf(); _cfP = clamp(_cfDrag.p0 - dx / 74, 0, THEMES.length - 1); cfRender(); }
  });
  var end = function () {
    if (!_cfDrag) return;
    var d = _cfDrag;
    _cfDrag = null;
    if (d.moved) { _cfSuppressClick = true; setTimeout(function () { _cfSuppressClick = false; }, 50); cfAnimateTo(Math.round(_cfP), 300); }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  return true;
};
var cfGoTo = function (i) { _cfCancelIntro(); cfInit(); cfAnimateTo(i, 350); return true; };
var cfTap = function (i) {
  if (_cfSuppressClick) return false;
  _cfCancelIntro();
  cfInit();
  if (i === Math.round(_cfP)) return openThemeDetail(THEMES[i].id);
  cfAnimateTo(i, 350);
  return true;
};
var openThemeDetail = function (id) {
  var t = themeById(id);
  if (!t) return false;
  var view = document.getElementById('gv-cf-view'), det = document.getElementById('gv-cf-detail');
  if (!view || !det) return false;
  var cur = currentTheme();
  var cs = t.colors || [];
  var sw = cs.map(function (c) {
    var on = cur.id === t.id && String(cur.c2).toLowerCase() === String(c).toLowerCase();
    return '<button type="button" class="gv-cf-color' + (on ? ' gv-cf-color-on' : '') + '" style="background:' + c + '" title="' + c + '" aria-pressed="' + on + '" onclick="window.GroupV.setThemeColor(\'' + t.id + '\',\'' + c + '\');window.GroupV.openThemeDetail(\'' + t.id + '\')"></button>';
  }).join('');
  det.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><button type="button" class="ot-btn ot-btn-ghost" onclick="window.GroupV.closeThemeDetail()">‹ 主题</button></div>'
    + '<div style="display:flex;justify-content:center;margin-top:12px;"><div class="gv-cf-cover gv-cf-cover-big"><div class="gv-cf-art" style="background:' + coverBg(t) + ';"><i class="gv-cf-sun" style="background:' + t.c1 + '"></i><i class="gv-cf-band" style="background:' + (cs[3] || t.c2) + '"></i></div></div></div>'
    + '<div style="text-align:center;font-weight:700;font-size:17px;margin-top:10px;">' + esc(t.name) + '</div>'
    + '<div class="ot-muted" style="text-align:center;">' + esc(t.desc) + '</div>'
    + '<div style="font-weight:600;font-size:15px;margin:16px 0 8px;">配色（5 种）</div>'
    + '<div class="gv-cf-colors">' + sw + '</div>'
    + '<div class="ot-muted" style="margin-top:8px;">当前配色：<span>' + esc(cur.id === t.id ? cur.c2 : t.c2) + '</span> · 选中的颜色会跟着「' + esc(t.name) + '」保存，主题本身不变。</div>';
  view.hidden = true;
  det.hidden = false;
  return true;
};
var closeThemeDetail = function () {
  var view = document.getElementById('gv-cf-view'), det = document.getElementById('gv-cf-detail');
  if (view) view.hidden = false;
  if (det) { det.hidden = true; det.innerHTML = ''; }
  cfInit();
  return true;
};
var themeSectionHTML = function () {
  var cur = currentTheme();
  var p = _cfIndex();
  var covers = THEMES.map(function (t, i) { return _cfCoverHTML(t, i, p); }).join('');
  var dots = THEMES.map(function (t, i) { return '<button type="button" class="gv-cf-dot' + (i === p ? ' on' : '') + '" aria-label="' + esc(t.name) + '" onclick="window.GroupV.cfGoTo(' + i + ')"></button>'; }).join('');
  /* 自定义卡片已并进详情/高级：当前为自定义两色时，高级区默认展开（见 gv-adv 的 open）。 */
  var customOn = cur.id === 'custom';
  return '<div id="gv-coverflow">'
    + '<div id="gv-cf-view">'
    + '<div style="font-weight:600;font-size:17px;margin:12px 0 8px;">主题</div>'
    + '<div class="ot-muted">当前：<span data-gv-theme-name>' + esc(cur.name) + '</span></div>'
    + '<div class="gv-cf-stage" id="gv-cf-stage">' + covers + '<div class="gv-cf-title" id="gv-cf-title">' + esc(THEMES[p].name) + '</div></div>'
    + '<div class="gv-cf-dots">' + dots + '</div>'
    + '<div class="ot-muted" style="margin-top:8px;">左右滑动或点按切换封面，点正中的封面进入详情选配色。</div>'
    + '</div>'
    + '<div id="gv-cf-detail" hidden></div>'
    + '<details id="gv-adv" style="margin-top:12px;"' + (customOn ? ' open' : '') + '><summary style="font-size:13px;cursor:pointer;">高级</summary>'
    + '<div style="margin-top:8px;font-size:14px;line-height:1.5;">自定义两色：浅色 <input type="color" value="' + cur.c1 + '" onchange="window.GroupV.setCustomColor(1,this.value)"> 主色 <input type="color" value="' + cur.c2 + '" onchange="window.GroupV.setCustomColor(2,this.value)"></div>'
    + '<div style="margin-top:8px;font-size:13px;">分享代码：<input id="gv-share-code" readonly value="' + esc(shareCode()) + '" style="width:150px;border:1px solid #e5e5e5;border-radius:8px;padding:8px 12px;font-size:12px;background:#fff;color:#171717;"> <button class="ot-btn ot-btn-ghost" style="padding:8px 12px;" onclick="window.GroupV.copyShareCode()">复制</button></div>'
    + '<div style="margin-top:8px;font-size:13px;">导入代码：<input id="gv-share-import" placeholder="粘贴 GV1- 开头的代码" style="width:150px;border:1px solid #e5e5e5;border-radius:8px;padding:8px 12px;font-size:12px;background:#fff;color:#171717;"> <button class="ot-btn ot-btn-ghost" style="padding:8px 12px;" onclick="window.GroupV.importShareCodeUI()">导入</button> <span id="gv-share-msg" class="ot-muted"></span></div></details>'
    + '</div>';
};
var refreshOtomeSettings = function () {
  try {
    var pnl = document.getElementById('ot-panel');
    if (pnl && pnl.classList.contains('ot-show') && window.WeChatAppEngine && WeChatAppEngine._otomePanelSettings) WeChatAppEngine._otomePanelSettings();
  } catch (e) {}
};
var openThemeSheet = function () {
  closeThemeSheet();
  var ov = document.createElement('div');
  ov.id = 'gv-theme-sheet';
  ov.innerHTML = '<div class="gv-sheet"><div class="gv-sheet-grab"></div><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:20px;font-weight:600;">主题</h3><button type="button" class="ot-btn ot-btn-ghost" onclick="window.GroupV.closeThemeSheet()">' + GV_X_SVG + '</button></div>' + themeSectionHTML() + '<div class="ot-muted" style="margin-top:8px;">主题改全机配色，插画场景保持原画风。</div></div>';
  document.body.appendChild(ov);
  cfInit();
  cfIntro();
  return true;
};
var closeThemeSheet = function () { _cfCancelIntro(); var el = document.getElementById('gv-theme-sheet'); if (el) el.remove(); return true; };
/* 点「自定义」卡片：展开高级里的取色器，让用户直接改两色。 */
var openCustomTheme = function () {
  var d = document.getElementById('gv-adv');
  if (d) { d.open = true; try { d.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  return true;
};

/* ══════════ A30 动作库：动作名即配置 ══════════
   命名约定（Hanami“文件名即配置”的做法，本组自写实现）：
   idle / 六个情绪名（开心/难过/生气/害羞/困/惊讶）/ -2/-3 变体 / world- 前缀区分场景片段。
   一个动作表 {name, dur, desc}，按名查动作。
   P 组动作台已合入（GroupP.motion，动作 greet/wave/bow/laugh/sleep/hug，1500ms，class groupp-act-*）：
   按约定重命名接入——world-打招呼/挥手/鞠躬/笑/睡（+抱抱）委托给 P 的 motion；裸名（打招呼/挥手/…）也按约定解析为 world-。 */
var EMOTIONS = ['开心', '难过', '生气', '害羞', '困', '惊讶'];
var EMO_EXPR = { '开心': 'happy', '难过': 'sad', '生气': 'angry', '害羞': 'shy', '困': 'normal', '惊讶': 'normal' };
var ACTIONS = {};
(function buildActions() {
  ACTIONS['idle'] = { name: 'idle', dur: 0, desc: '待机：站着，眨眼，眼睛跟随' };
  EMOTIONS.forEach(function (e) { ACTIONS[e] = { name: e, dur: 1200, desc: '情绪：' + e }; });
  EMOTIONS.forEach(function (e) {
    ACTIONS[e + '-2'] = { name: e + '-2', dur: 1600, desc: '情绪变体2：更强烈的' + e };
    ACTIONS[e + '-3'] = { name: e + '-3', dur: 2000, desc: '情绪变体3：最强烈的' + e };
  });
  var world = [
    ['world-打招呼', 1500, '场景片段：抬手打招呼（P 组动作台 greet）'],
    ['world-挥手', 1500, '场景片段：挥手（P 组动作台 wave）'],
    ['world-鞠躬', 1500, '场景片段：鞠躬（P 组动作台 bow）'],
    ['world-笑', 1500, '场景片段：笑出声（P 组动作台 laugh）'],
    ['world-睡', 1500, '场景片段：打瞌睡（P 组动作台 sleep）'],
    ['world-抱抱', 1500, '场景片段：抱抱（P 组动作台 hug）'],
    ['world-坐下', 800, '场景片段：坐下'],
    ['world-走路', 1000, '场景片段：走路']
  ];
  world.forEach(function (w) { ACTIONS[w[0]] = { name: w[0], dur: w[1], desc: w[2] }; });
})();
var P_MOTION = { 'world-打招呼': 'greet', 'world-挥手': 'wave', 'world-鞠躬': 'bow', 'world-笑': 'laugh', 'world-睡': 'sleep', 'world-抱抱': 'hug', '打招呼': 'greet', '挥手': 'wave', '鞠躬': 'bow', '笑': 'laugh', '睡': 'sleep', '抱抱': 'hug' };
var lookupAction = function (name) {
  if (!name) return null;
  if (ACTIONS[name]) return ACTIONS[name];
  if (ACTIONS['world-' + name]) return ACTIONS['world-' + name];
  return null;
};
var listActions = function () { return Object.keys(ACTIONS); };
var ACT_CLASSES = ['gv-nod', 'gv-wave', 'gv-bow', 'gv-laugh', 'gv-sleep', 'gv-sit', 'gv-walk', 'gv-sleepy', 'gv-surprised', 'gv-walking'];
var removeActClasses = function (el) { if (!el) return; ACT_CLASSES.forEach(function (c) { el.classList.remove(c); }); };
var actionClass = function (name) {
  var n = String(name || '');
  if (n === 'world-坐下') return 'gv-sit';
  if (n === 'world-走路') return 'gv-walk';
  if (n === '困' || n === '困-2' || n === '困-3') return 'gv-sleepy';
  if (n === '惊讶' || n === '惊讶-2' || n === '惊讶-3') return 'gv-surprised';
  return '';
};
var playAction = function (name, where) {
  var a = lookupAction(name);
  if (!a) return null;
  var w = where || 'otome';
  var pm = P_MOTION[a.name];
  if (pm && window.GroupP && typeof window.GroupP.motion === 'function') {
    try { window.GroupP.motion(pm, w === 'ck' ? 'cike' : 'otome'); } catch (e) {}
    return a;
  }
  var targets = [];
  if (w === 'otome' || w === 'both') { var o = document.getElementById('ot-char'); if (o) targets.push(o); }
  if (w === 'ck' || w === 'both') { var c = document.getElementById('ck-char'); if (c) targets.push(c); }
  var cls = actionClass(a.name);
  targets.forEach(function (el) { removeActClasses(el); if (cls) { void el.offsetWidth; el.classList.add(cls); } });
  var base = a.name.replace(/-[23]$/, '').replace(/^world-/, '');
  if (EMO_EXPR[base]) { try { if (window.WeChatAppEngine && WeChatAppEngine.otomeSetExpr) WeChatAppEngine.otomeSetExpr(EMO_EXPR[base]); } catch (e) {} }
  if (a.dur > 0 && cls) { setTimeout(function () { targets.forEach(function (el) { el.classList.remove(cls); }); }, a.dur); }
  return a;
};

/* ══════════ A29 生活场景交互语法 ══════════
   复用 F 组乙游 3D 家走动逻辑（otomeGroundTap 移动“我”）和 C 组立体书小人（ck 自动走路 + 点击放大），不另起一套走动。
   V 组只补三处：①点地面 char 也走过去（跟在“我”身边）；②点座位 char 坐下；③点 char 本人点头回应；④眼睛跟随镜头/手指。
   乙游家的眼睛跟随 F 组已有（home.onpointermove 写 st.gaze，tick 推瞳孔 + 弹簧头），V 组补一个与之同向的直接
   写入（pointermove 即写瞳孔，不依赖 rAF，jsdom 也可验证）；立体书小人原来没有跟随，V 组在 ckWire 里补。 */
var seated = false;
var charSit = function (furnId) {
  var el = document.getElementById('ot-char');
  if (!el) return false;
  el.classList.remove('gv-walking');
  el.classList.add('gv-sit');
  seated = true;
  return true;
};
var isSeated = function () { return seated; };
var otomeCharWalkTo = function (x, y) {
  var el = document.getElementById('ot-char');
  if (!el) return false;
  var tx = clamp(x, 8, 88);
  var cur = parseFloat(el.style.left) || 50;
  el.classList.remove('gv-sit');
  seated = false;
  el.classList.add('gv-walking');
  el.classList.toggle('gv-flip', tx < cur);
  el.style.left = tx + '%';
  setTimeout(function () { el.classList.remove('gv-walking'); }, 700);
  return true;
};
var charNod = function () {
  var el = document.getElementById('ot-char');
  if (!el) return false;
  el.classList.remove('gv-nod');
  void el.offsetWidth;
  el.classList.add('gv-nod');
  setTimeout(function () { el.classList.remove('gv-nod'); }, 700);
  return true;
};
var ckNod = function (el) {
  var t = el || document.getElementById('ck-char');
  if (!t) return false;
  t.classList.remove('gv-nod');
  void t.offsetWidth;
  t.classList.add('gv-nod');
  setTimeout(function () { t.classList.remove('gv-nod'); }, 700);
  return true;
};
var onGaze = function (ev) {
  try {
    var t = ev.target;
    if (!t || !t.closest) return;
    var home = t.closest('#wx-otome-home');
    if (home) {
      var r = home.getBoundingClientRect();
      if (r.width) {
        var gx = ((ev.clientX - r.left) / r.width - 0.5) * 7;
        var gy = ((ev.clientY - r.top) / r.height - 0.5) * 5;
        $$('#ot-char .ot-pupil').forEach(function (p) { p.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)'; });
      }
      return;
    }
    var book = t.closest('#ck-popbook');
    if (book) {
      var rb = book.getBoundingClientRect();
      if (rb.width) {
        var bx = ((ev.clientX - rb.left) / rb.width - 0.5) * 5;
        var by = ((ev.clientY - rb.top) / rb.height - 0.5) * 3.5;
        $$('#ck-char ellipse[cx="47"], #ck-char ellipse[cx="73"]').forEach(function (p) { p.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)'; });
      }
    }
  } catch (e) {}
};
var onCkCharClick = function (ev) {
  try { if (ev.target && ev.target.closest && ev.target.closest('#ck-char')) ckNod(); } catch (e) {}
};
/* 立体书小世界接线：由 C 组 initPopBook 内调用（补丁在 charEl 点击监听后插入调用），传入闭包里的 walk/setZoom。
   点地面（未放大时）char 走过去：复用 C 组 walk 对象（walk.pos / walk.pauseUntil），自动走路的 interval 会读到新位置，
   不另起一套走动；点到 char 身边则点头；放大时点空白只缩回（F…C 组已有处理），不走路。 */
var ckWire = function (ctx) {
  if (!ctx || !ctx.page || !ctx.charEl) return false;
  if (ctx.page._gvWired) return true;
  ctx.page._gvWired = true;
  ctx.page.addEventListener('click', function (ev) {
    try {
      if (ctx.isZoomed && ctx.isZoomed()) return;
      if (ev.target && ev.target.closest && ev.target.closest('#ck-char, #ck-char-panel, .ck-pagebtn, .ck-timeline')) return;
      var r = ctx.page.getBoundingClientRect();
      if (!r.width) return;
      var x = clamp(((ev.clientX - r.left) / r.width) * 100, 8, 88);
      var before = (ctx.walk && typeof ctx.walk.pos === 'number') ? ctx.walk.pos : (parseFloat(ctx.charEl.style.left) || 12);
      if (Math.abs(x - before) < 6) { ckNod(ctx.charEl); return; }
      if (ctx.walk) { ctx.walk.pos = x; ctx.walk.pauseUntil = Date.now() + 900; ctx.walk.dir = x >= before ? 1 : -1; }
      ctx.charEl.style.left = x + '%';
      ctx.charEl.classList.toggle('ck-flip', x < before);
      ctx.charEl.classList.add('ck-walking');
      setTimeout(function () { ctx.charEl.classList.remove('ck-walking'); }, 900);
    } catch (e) {}
  }, true);
  return true;
};

/* ══════════ A31 两套 rig 永不混用 ══════════
   自绘 rig 与 VRM 各是一套，切换时整套换（#ot-char 内容整体替换，不混用）。
   VRM 加载复用 P 组（GroupP.vrmState / importVRMFile，CDN three.js + 预览器）：P 的 VRM 只是预览，不替换 live 形象，
   所以 VRM 槽位内显示 2D 抠图立绘兜底（优先用用户已上传的抠图人物，否则自绘 SVG），并诚实说明原因与状态。
   rig 选择存在新键 gv_rig_v1；P 组自己的 VRM 状态键 groupp_vrm_v1 只读，不改。 */
var RIG_KEY = 'gv_rig_v1';
var loadRig = function () { var r = lsGet(RIG_KEY, null); if (r && (r.rig === 'vrm' || r.rig === 'drawn')) return r.rig; return 'drawn'; };
var _inApplyRig = false;
var rigState = function () {
  var rig = loadRig();
  var vrm = { status: 'none', name: '' };
  try { if (window.GroupP && typeof window.GroupP.vrmState === 'function') vrm = window.GroupP.vrmState() || vrm; } catch (e) {}
  return { rig: rig, vrm: vrm };
};
var applyRig = function () {
  var el = document.getElementById('ot-char');
  if (!el) return false;
  if (loadRig() !== 'vrm') {
    if (el.classList.contains('gv-vrm-slot')) {
      el.classList.remove('gv-vrm-slot');
      if (!_inApplyRig) {
        _inApplyRig = true;
        try { if (window.WeChatAppEngine && WeChatAppEngine.otomeRenderChar) WeChatAppEngine.otomeRenderChar(); } catch (e) {}
        _inApplyRig = false;
      }
    }
    return false;
  }
  var st = rigState();
  var fallback = '';
  try {
    if (window.OtomeF) {
      var custom = (typeof OtomeF.activeCustomChar === 'function') ? OtomeF.activeCustomChar() : null;
      if (custom && custom.dataUrl) fallback = '<img src="' + custom.dataUrl + '" alt="抠图人物（2D 兜底）" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 10px rgba(0,0,0,.25));">';
      else if (OtomeF.charSVG) fallback = OtomeF.charSVG((typeof OtomeF.loadLook === 'function') ? OtomeF.loadLook() : null);
    }
  } catch (e) {}
  if (!fallback) fallback = '<div style="height:190px;background:#f7f7f7;border-radius:8px;"></div>';
  var note = st.vrm.status === 'loaded'
    ? 'VRM 模型「' + esc(st.vrm.name || '') + '」已在 P 组预览器里加载（仅预览，不替换 live 形象）；这里显示 2D 抠图立绘兜底，完整 VRM 预览在下方设置区。'
    : st.vrm.status === 'failed'
    ? 'VRM 上次导入失败（' + esc(st.vrm.error || '') + '）；已保留自绘形象，这里显示 2D 抠图立绘兜底。'
    : 'VRM 槽位：还没导入 .vrm 模型；这里显示 2D 抠图立绘兜底。用下方 P 组导入入口导入你自己的模型。';
  el.classList.add('gv-vrm-slot');
  el.innerHTML = '<div class="ot-bubble" id="ot-char-bubble"></div>' + fallback + '<div class="gv-vrm-note">' + note + '</div>';
  return true;
};
var setRig = function (rig) {
  if (rig !== 'vrm' && rig !== 'drawn') return loadRig();
  lsSet(RIG_KEY, { rig: rig });
  applyRig();
  refreshOtomeSettings();
  return rig;
};
var rigSectionHTML = function () {
  var st = rigState();
  var vrmText = st.vrm.status === 'loaded' ? ('已加载预览：' + (st.vrm.name || '')) : st.vrm.status === 'failed' ? ('上次导入失败：' + (st.vrm.error || '')) : st.vrm.status === 'loading' ? '正在加载…' : '还没导入过 VRM 模型';
  return '<div style="font-weight:700;margin:14px 0 6px;">' + GV_PERSON_SVG + ' 形象 rig 切换（两套永不混用）</div>'
    + '<div class="ot-muted">自绘 rig（QQ 小人 SVG / 抠图立绘）与 VRM 槽位各是一套，切换时整套换。VRM 加载复用 P 组预览器（仅预览，不替换 live 形象）；槽位没模型时显示 2D 抠图立绘并明说。</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'
    + '<button class="ot-btn' + (st.rig === 'drawn' ? '' : ' ot-btn-ghost') + '" onclick="window.GroupV.setRig(\'drawn\')">' + GV_FACE_SVG + ' 自绘 rig' + (st.rig === 'drawn' ? ' ' + GV_CHECK_SVG : '') + '</button>'
    + '<button class="ot-btn' + (st.rig === 'vrm' ? '' : ' ot-btn-ghost') + '" onclick="window.GroupV.setRig(\'vrm\')">' + GV_PERSON_SVG + ' VRM 槽位' + (st.rig === 'vrm' ? ' ' + GV_CHECK_SVG : '') + '</button></div>'
    + '<div class="ot-muted" style="margin-top:6px;">当前：' + (st.rig === 'drawn' ? '自绘 rig' : 'VRM 槽位') + ' · VRM 状态：' + esc(vrmText) + '</div>'
    + '<div style="margin-top:8px;"><label class="ot-btn ot-btn-ghost" style="display:block;text-align:center;cursor:pointer;">' + GV_BOX_SVG + ' 导入 .vrm 模型（P 组）<input type="file" accept=".vrm" style="display:none;" onchange="window.GroupP && window.GroupP.importVRMFile(this)"></label></div>'
    + '<div style="margin-top:6px;"><button class="ot-btn ot-btn-ghost" style="padding:5px 10px;" onclick="window.GroupV.refreshOtomeSettings()">' + GV_REFRESH_SVG + ' 刷新 VRM 状态</button></div>';
};

/* ══════════ A5 记忆花园：此刻 Hub“记忆花园”页（#ck-garden-root）══════════
   2026-11-27 Hub：花园从记忆树里拆出，住自己的子页面；gardenRefresh() 原地渲染（见下）。
   读同一份 guichao.memories.v1；封印状态只读 M 组的 sealed_days_v1（不写）；花园自己的状态存在新键 gv_garden_v1。
   规则：记忆 -> 可种的种子；种下 -> 幼苗；浇水每 2 次长大一级（种子/幼苗/成长/开花）；修剪 +1 水、标记已修剪。 */
var GARDEN_KEY = 'gv_garden_v1';
var GARDEN_STAGES = [{ ico: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><ellipse cx="12" cy="15" rx="6" ry="7" fill="#c9a06a"/><path d="M12 8 Q12 4 15 3" stroke="#4a7a5a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>', name: '种子' }, { ico: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21 V11" stroke="#4a7a5a" stroke-width="2" stroke-linecap="round"/><path d="M12 11 C12 6 8 4 4 4 C4 9 8 11 12 11 Z" fill="#6aa87a"/><path d="M12 11 C12 6 16 4 20 4 C20 9 16 11 12 11 Z" fill="#7cbc8c"/></svg>', name: '幼苗' }, { ico: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="10" r="7" fill="#4a7a5a"/><rect x="10.8" y="15" width="2.4" height="6" fill="#8a6a4a"/></svg>', name: '成长' }, { ico: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="6.5" r="3" fill="#e8c9d0"/><circle cx="17.5" cy="12" r="3" fill="#e8c9d0"/><circle cx="12" cy="17.5" r="3" fill="#e8c9d0"/><circle cx="6.5" cy="12" r="3" fill="#e8c9d0"/><circle cx="12" cy="12" r="3.2" fill="#f5d90a"/></svg>', name: '开花' }];
var gardenLoad = function () { var g = lsGet(GARDEN_KEY, null); if (!g || typeof g !== 'object' || !g.plants) return { plants: {} }; return g; };
var gardenSave = function (g) { return lsSet(GARDEN_KEY, g); };
var gardenMemories = function () {
  var mems = lsGet('guichao.memories.v1', []);
  if (!Array.isArray(mems)) return [];
  var sealed = lsGet('sealed_days_v1', {}) || {};
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  return mems.slice().sort(function (a, b) { var ta = (a && (a.updated || a.id)) || 0; var tb = (b && (b.updated || b.id)) || 0; return tb - ta; }).slice(0, 12).map(function (m) {
    var ts = (m && (m.updated || m.id)) || 0; var d = ts ? new Date(ts) : null;
    var dk = d ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) : '';
    return { id: String(m.id), title: (m && m.title) || '记忆', date: dk, sealed: !!(dk && sealed[dk]) };
  });
};
var gardenStageOf = function (p) { if (!p) return -1; return clamp(Math.floor((p.water || 0) / 2), 0, 3); };
/* 2026-11-27 Hub：花园拆去自己的 #ck-garden-root 页。始终原地渲染：.gv-garden 在就地替换，
   没有就在 #ck-garden-root 里生成；不再经 memtree.render() 间接渲染（记忆树也不再拼花园）。 */
var gardenRefresh = function () {
  try { var el = document.querySelector('.gv-garden'); if (el) { var tmp = document.createElement('div'); tmp.innerHTML = gardenHTML(); if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild); return; } } catch (e) {}
  try { var root = document.getElementById('ck-garden-root'); if (root) root.innerHTML = gardenHTML(); } catch (e) {}
};
var gardenPlant = function (id) { var g = gardenLoad(); if (g.plants[id]) return g.plants[id]; g.plants[id] = { stage: 0, water: 0, pruned: false, plantedAt: Date.now() }; gardenSave(g); gardenRefresh(); return g.plants[id]; };
var gardenWater = function (id) { var g = gardenLoad(); var p = g.plants[id]; if (!p) return null; p.water = (p.water || 0) + 1; p.stage = gardenStageOf(p); gardenSave(g); gardenRefresh(); return p; };
var gardenPrune = function (id) { var g = gardenLoad(); var p = g.plants[id]; if (!p) return null; p.pruned = true; p.water = (p.water || 0) + 1; p.stage = gardenStageOf(p); gardenSave(g); gardenRefresh(); return p; };
var gardenAct = function (act, id) {
  if (act === 'plant') gardenPlant(id);
  else if (act === 'water') gardenWater(id);
  else if (act === 'prune') gardenPrune(id);
  gardenRefresh();
};
var gardenHTML = function () {
  var g = gardenLoad(); var mems = gardenMemories();
  var planted = mems.filter(function (m) { return g.plants[m.id]; });
  var seeds = mems.filter(function (m) { return !g.plants[m.id]; });
  var h = '<div class="gv-garden"><div class="gv-garden-head"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21 V11" stroke="#4a7a5a" stroke-width="2" stroke-linecap="round"/><path d="M12 11 C12 6 8 4 4 4 C4 9 8 11 12 11 Z" fill="#6aa87a"/><path d="M12 11 C12 6 16 4 20 4 C20 9 16 11 12 11 Z" fill="#7cbc8c"/></svg> 记忆花园 <span class="ot-muted">记忆种成幼苗，浇水长大</span></div>';
  if (!mems.length) h += '<div class="ot-muted">还没有记忆。去归巢记一条，回来就能种下它。</div>';
  if (planted.length) {
    h += '<div class="gv-garden-grid">' + planted.map(function (m) {
      var p = g.plants[m.id]; var st = GARDEN_STAGES[gardenStageOf(p)];
      return '<div class="gv-sprout"><div class="gv-sprout-ico">' + st.ico + '</div><div class="gv-sprout-t">' + esc(m.title) + '</div><div class="ot-muted">' + st.name + ' · 浇水 ' + (p.water || 0) + ' 次' + (p.pruned ? ' · 已修剪' : '') + (m.sealed ? ' · 已封印' : '') + '</div><div class="gv-sprout-btns"><button type="button" class="ot-btn" onclick="window.GroupV.gardenAct(\'water\',\'' + esc(m.id) + '\')">浇水</button><button type="button" class="ot-btn ot-btn-ghost" onclick="window.GroupV.gardenAct(\'prune\',\'' + esc(m.id) + '\')">修剪</button></div></div>';
    }).join('') + '</div>';
  }
  if (seeds.length) {
    h += '<div class="ot-muted" style="margin-top:8px;">还没种下的记忆：</div><div class="gv-seeds">' + seeds.map(function (m) {
      return '<button type="button" class="gv-seed" onclick="window.GroupV.gardenAct(\'plant\',\'' + esc(m.id) + '\')">' + esc(m.title) + (m.sealed ? ' · 已封印' : '') + '</button>';
    }).join('') + '</div>';
  }
  return h + '</div>';
};

/* ══════════ A6 像素画：16×16 共同作画，放进 N 组「一起玩」 ══════════
   N 组已合入：一起玩面板（WeChatAppEngine._otomePanelPlay）。补丁把 pixelHTML() 接进该面板（钓鱼/斗地主/花园之后）。
   16×16 网格，点格子填色/盖印章；char 也会画几笔（按日期确定的爱心图案，不靠运气）；导出 PNG 用 canvas 画，
   当前环境不支持 canvas 时诚实返回 {ok:false, reason:'no-canvas'}，不假装导出成功。画布状态存在新键 gv_pixel_v1。 */
var PIXEL_KEY = 'gv_pixel_v1';
var PX_COLORS = ['#25262a', '#ffffff', '#e5484d', '#f76b15', '#f5d90a', '#46a758', '#3e9bff', '#8e4ec6'];
/* D 批禁 emoji：像素画印章从 emoji 字符改成手绘形状（存 stamp:xxx，调色板/格子/canvas 导出同一套）；
   旧画里已存的 emoji 格子是用户作品，原样保留渲染，不改数据。 */
var PX_STAMPS = [
  { id: 'stamp:smile', name: '笑脸' },
  { id: 'stamp:heart', name: '爱心' },
  { id: 'stamp:flower', name: '小花' },
  { id: 'stamp:star', name: '星星' },
  { id: 'stamp:cat', name: '小猫' }
];
var PX_STAMP_SVG = {
  'stamp:smile': '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd93b"/><circle cx="8.5" cy="10" r="1.5" fill="#1e2748"/><circle cx="15.5" cy="10" r="1.5" fill="#1e2748"/><path d="M8.5 14.5Q12 17.5 15.5 14.5" stroke="#1e2748" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  'stamp:heart': '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.3C3.5 6.6 5.6 5 7.8 5c1.8 0 3.2 1 4.2 2.4C13 6 14.4 5 16.2 5c2.2 0 4.3 1.6 4.3 4.3 0 5.7-8.5 11.2-8.5 11.2Z" fill="#e5484d"/></svg>',
  'stamp:flower': '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="6" r="3" fill="#e8c9d0"/><circle cx="18" cy="12" r="3" fill="#e8c9d0"/><circle cx="12" cy="18" r="3" fill="#e8c9d0"/><circle cx="6" cy="12" r="3" fill="#e8c9d0"/><circle cx="12" cy="12" r="3.2" fill="#f5d90a"/></svg>',
  'stamp:star': '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="#f5d90a" stroke="#b08d3e" stroke-width="1" stroke-linejoin="round"/></svg>',
  'stamp:cat': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1e2748" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10 4 4l5 2.5a9 9 0 0 1 6 0L20 4l-.5 6a8 8 0 1 1-15 0Z"/><path d="M8.5 12h.1m6.8 0h.1M10 15.5c1.4 1.1 2.6 1.1 4 0m-4-2.4-4-1m8 0 4-1"/></svg>'
};
var pxStampSVG = function (id) { return PX_STAMP_SVG[id] || ''; };
var pxStampName = function (v) { for (var i = 0; i < PX_STAMPS.length; i++) if (PX_STAMPS[i].id === v) return PX_STAMPS[i].name; return v; };
var drawPxStamp = function (ctx, id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
  if (id === 'stamp:smile') {
    ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(12, 12, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e2748'; ctx.beginPath(); ctx.arc(8.5, 10, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(15.5, 10, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e2748'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8.5, 14.5); ctx.quadraticCurveTo(12, 17.5, 15.5, 14.5); ctx.stroke();
  } else if (id === 'stamp:heart') {
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(8, 9, 4, Math.PI, 0); ctx.arc(16, 9, 4, Math.PI, 0); ctx.lineTo(12, 20); ctx.closePath(); ctx.fill();
  } else if (id === 'stamp:flower') {
    ctx.fillStyle = '#e8c9d0';
    [[12, 6], [18, 12], [12, 18], [6, 12]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#f5d90a'; ctx.beginPath(); ctx.arc(12, 12, 3.2, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'stamp:star') {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5; var r = (i % 2 === 0) ? 9 : 3.8; var px = 12 + Math.cos(a) * r, py = 12 + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fillStyle = '#f5d90a'; ctx.fill(); ctx.strokeStyle = '#b08d3e'; ctx.lineWidth = 1; ctx.stroke();
  } else if (id === 'stamp:cat') {
    ctx.fillStyle = '#f5a623';
    ctx.beginPath(); ctx.moveTo(4, 9); ctx.lineTo(4.5, 3); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20, 9); ctx.lineTo(19.5, 3); ctx.lineTo(15, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(12, 13, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e2748'; ctx.beginPath(); ctx.arc(9, 12, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(15, 12, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e2748'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(10, 15.5); ctx.quadraticCurveTo(12, 16.8, 14, 15.5); ctx.stroke();
  }
  ctx.restore();
};
var PX_HEART = [[5, 4], [6, 4], [9, 4], [10, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [6, 8], [7, 8], [8, 8], [9, 8], [7, 9], [8, 9]];
var pxTool = '#e5484d';
var pixelLoad = function () { var s = lsGet(PIXEL_KEY, null); if (!s || typeof s !== 'object' || !s.cells) return { cells: {}, updatedAt: 0 }; return s; };
var pixelSave = function (s) { return lsSet(PIXEL_KEY, s); };
var pixelPick = function (v) { pxTool = v; var n = document.getElementById('gv-px-note'); if (n) n.textContent = '当前工具：' + (isHex(v) ? v : pxStampName(v)); return pxTool; };
var pixelPaint = function (x, y) {
  var s = pixelLoad();
  s.cells[x + ',' + y] = pxTool; s.updatedAt = Date.now(); pixelSave(s);
  var cell = document.querySelector('[data-gv-px="' + x + ',' + y + '"]');
  if (cell) { if (isHex(pxTool)) { cell.style.background = pxTool; cell.innerHTML = ''; } else if (String(pxTool).indexOf('stamp:') === 0) { cell.style.background = '#ffffff'; cell.innerHTML = pxStampSVG(pxTool); } else { cell.style.background = '#ffffff'; cell.textContent = pxTool; } }
  return true;
};
var pixelCharDraw = function () {
  var s = pixelLoad();
  var color = ['#e5484d', '#f76b15', '#8e4ec6'][dayNum() % 3];
  var n = 0;
  PX_HEART.forEach(function (pt) { var k = pt[0] + ',' + pt[1]; if (!s.cells[k]) n++; s.cells[k] = color; });
  s.cells['2,2'] = 'stamp:star'; s.cells['13,3'] = 'stamp:star'; n += 2;
  s.updatedAt = Date.now(); pixelSave(s);
  return { drawn: n, color: color };
};
var pixelCharDrawUI = function () {
  var r = pixelCharDraw();
  try { if (window.WeChatAppEngine && WeChatAppEngine._otomePanelPlay) WeChatAppEngine._otomePanelPlay(); } catch (e) {}
  var n = document.getElementById('gv-px-note'); if (n) n.textContent = '机画了一个' + r.color + '的爱心 + 两颗星星，共 ' + r.drawn + ' 笔。';
  return r;
};
var pixelClear = function () {
  pixelSave({ cells: {}, updatedAt: Date.now() });
  try { if (window.WeChatAppEngine && WeChatAppEngine._otomePanelPlay) WeChatAppEngine._otomePanelPlay(); } catch (e) {}
  return true;
};
var pixelExport = function () {
  var st = pixelLoad();
  var cv = null; var ctx = null;
  try { cv = document.createElement('canvas'); ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
  if (!cv || !ctx) return { ok: false, reason: 'no-canvas' };
  try {
    cv.width = 256; cv.height = 256;
    ctx.imageSmoothingEnabled = false;
    var off = document.createElement('canvas'); off.width = 16; off.height = 16;
    var octx = off.getContext('2d');
    if (!octx) return { ok: false, reason: 'no-canvas' };
    octx.fillStyle = '#ffffff'; octx.fillRect(0, 0, 16, 16);
    Object.keys(st.cells || {}).forEach(function (k) {
      var parts = k.split(','); var x = +parts[0], y = +parts[1]; var v = st.cells[k];
      if (isHex(v)) { octx.fillStyle = v; octx.fillRect(x, y, 1, 1); }
    });
    ctx.drawImage(off, 0, 0, 256, 256);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    Object.keys(st.cells || {}).forEach(function (k) {
      var parts = k.split(','); var x = +parts[0], y = +parts[1]; var v = st.cells[k];
      if (!isHex(v)) { try { if (String(v).indexOf('stamp:') === 0) drawPxStamp(ctx, v, x * 16, y * 16, 16); else ctx.fillText(v, x * 16 + 8, y * 16 + 8); } catch (e) {} }
    });
    var url = cv.toDataURL('image/png');
    if (!url || url.indexOf('data:image/png') !== 0) return { ok: false, reason: 'no-canvas' };
    var a = document.createElement('a'); a.href = url; a.download = 'pixel-16x16.png';
    try { document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
    return { ok: true, url: url };
  } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
};
var pixelExportUI = function () {
  var r = pixelExport();
  var n = document.getElementById('gv-px-note');
  if (n) n.textContent = r.ok ? '已导出 PNG（下载开始）。' : '当前环境不支持 canvas 导出：' + r.reason + '（在真机浏览器里可以导出）。';
  return r;
};
var pixelHTML = function () {
  var st = pixelLoad();
  var pal = PX_COLORS.map(function (c) { return '<button type="button" class="gv-pal-sw" style="background:' + c + ';" title="' + c + '" onclick="window.GroupV.pixelPick(\'' + c + '\')"></button>'; }).join('')
    + PX_STAMPS.map(function (st) { return '<button type="button" class="gv-pal-emoji" title="' + esc(st.name) + '" onclick="window.GroupV.pixelPick(\'' + st.id + '\')">' + pxStampSVG(st.id) + '</button>'; }).join('');
  var cells = '';
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var v = (st.cells || {})[x + ',' + y];
    var bg = isHex(v) ? v : '#ffffff';
    var inner = (!v || isHex(v)) ? '' : (String(v).indexOf('stamp:') === 0 ? pxStampSVG(v) : esc(v));
    cells += '<button type="button" class="gv-px" data-gv-px="' + x + ',' + y + '" style="background:' + bg + ';" onclick="window.GroupV.pixelPaint(' + x + ',' + y + ')">' + inner + '</button>';
  }
  return '<div style="font-weight:700;margin:12px 0 6px;">' + GV_PALETTE_SVG + ' 像素画（16×16，一起画）</div>'
    + '<div class="ot-muted">点格子填色或盖印章；机也会上来画几笔；画完导出 PNG。</div>'
    + '<div class="gv-pal">' + pal + '</div>'
    + '<div class="gv-px-grid">' + cells + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'
    + '<button class="ot-btn" onclick="window.GroupV.pixelCharDrawUI()">' + GV_CAT_SVG + ' 让机也画几笔</button>'
    + '<button class="ot-btn ot-btn-ghost" onclick="window.GroupV.pixelClear()">清空</button>'
    + '<button class="ot-btn ot-btn-ghost" onclick="window.GroupV.pixelExportUI()">' + GV_DOWN_SVG + ' 导出 PNG</button>'
    + '<button class="ot-btn ot-btn-ghost" onclick="window.GroupV.sendPackSticker()">' + GV_PACK_SVG + ' 按心情发个表情包包</button></div>'
    + '<div class="ot-muted" id="gv-px-note" style="margin-top:6px;">当前工具：' + esc(isHex(pxTool) ? pxTool : pxStampName(pxTool)) + '</div>';
};

/* ══════════ A7 表情包包：按包定义，按心情匹配发送 ══════════
   接 N 组已合入的情绪表情包：标签（GroupN.stickerMood）、情绪筛选（GroupN.stickerFilterList）、
   心情（GroupN.charMood + MOODS）、发送（GroupN.sendCharSticker 的会话写入方式，本组按同一 wxStore 形状自写推送）。
   包定义 {name, mood, keywords, desc, stickers[]}；先按 char 当前心情精确匹配一个包，再从包里挑表情：
   优先取包内表情与 N 组该心情筛选结果的交集（即 N 组已标过该心情的表情），交集为空时用包自己的表情。 */
var STICKER_PACKS = [
  { mood: '开心', name: '开心大放送', keywords: ['开心', '高兴', '哈哈', '好耶', '喜欢'], desc: '高兴的时候发', stickers: ['😀', '😂', '😍', '🎉', '✨', '👍'] },
  { mood: '委屈', name: '委屈巴巴', keywords: ['委屈', '难过', '哭', '失落', '对不起'], desc: '委屈了，求安慰', stickers: ['😭', '😱', '🥺', '😢'] },
  { mood: '生气', name: '气鼓鼓', keywords: ['生气', '讨厌', '烦', '别理我'], desc: '生气了，哄哄我', stickers: ['😡', '🔥', '😤'] },
  { mood: '撒娇', name: '撒娇卖萌', keywords: ['撒娇', '抱抱', '亲', '可爱', '喜欢你'], desc: '想贴贴的时候发', stickers: ['🥰', '❤️', '🦊', '🐱', '😘'] },
  { mood: '困', name: '困困想睡', keywords: ['困', '累', '晚安', '睡觉'], desc: '困了，要睡了', stickers: ['😴', '🥱', '🌙'] },
  { mood: '害羞', name: '脸红心跳', keywords: ['害羞', '脸红', '爱你', '好可爱'], desc: '害羞的时候发', stickers: ['🥰', '😳', '💕', '😊'] }
];
var matchPackForMood = function (mood) {
  var m = String(mood || '');
  for (var i = 0; i < STICKER_PACKS.length; i++) if (STICKER_PACKS[i].mood === m) return STICKER_PACKS[i];
  for (var j = 0; j < STICKER_PACKS.length; j++) { if (STICKER_PACKS[j].keywords.indexOf(m) >= 0) return STICKER_PACKS[j]; }
  return STICKER_PACKS[0];
};
var currentMood = function () {
  try {
    if (window.GroupN && typeof window.GroupN.charMood === 'function') {
      var aff = 0;
      try { var all = lsGet('otome_affection_v1', {}); Object.keys(all || {}).forEach(function (k) { var v = (all[k] && all[k].value) || 0; if (v > aff) aff = v; }); } catch (e) {}
      return window.GroupN.charMood(aff, new Date().getHours());
    }
  } catch (e) {}
  var h = new Date().getHours();
  return (h >= 23 || h < 6) ? '困' : '开心';
};
var charSession = function () {
  try {
    var store = (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) ? AppRegistry['wechat'].wxStore : null;
    if (!store || !Array.isArray(store.sessions)) return null;
    var cur = null;
    store.sessions.forEach(function (s) { if (s.id === store.currentChatId) cur = s; });
    if (cur) return { store: store, sess: cur };
    var named = null;
    store.sessions.forEach(function (s) { if (!named && (s.name === '机' || s.name === '小机')) named = s; });
    if (named) return { store: store, sess: named };
    if (store.sessions.length) return { store: store, sess: store.sessions[0] };
  } catch (e) {}
  return null;
};
var sendPackSticker = function (mood) {
  var m = mood || currentMood();
  var pack = matchPackForMood(m);
  var pool = pack.stickers.slice();
  try {
    var cs = charSession();
    if (cs) {
      var list = cs.store.stickers || [];
      if (window.GroupN && typeof window.GroupN.stickerFilterList === 'function') {
        var moodList = window.GroupN.stickerFilterList(list, m) || [];
        var inter = pack.stickers.filter(function (s) { return moodList.indexOf(s) >= 0; });
        if (inter.length) pool = inter;
      }
    }
  } catch (e) {}
  var sticker = pool[(dayNum() + m.length) % pool.length];
  var target = charSession();
  if (!target) return { pack: pack.name, mood: m, sticker: sticker, sent: false };
  try {
    var sess = target.sess;
    sess.messages.push({ id: 'gv_' + Date.now(), sender: sess.name, type: 'text', content: sticker, time: '刚刚' });
    sess.preview = sticker; sess.lastTime = '刚刚'; sess.unread = (sess.unread || 0) + 1;
    if (target.store._persist) { try { target.store._persist(); } catch (e) {} }
    if (window.WeChatAppEngine && WeChatAppEngine.renderUpdates) { try { WeChatAppEngine.renderUpdates(); } catch (e) {} }
    return { pack: pack.name, mood: m, sticker: sticker, sent: true };
  } catch (e) { return { pack: pack.name, mood: m, sticker: sticker, sent: false }; }
};
var packRowHTML = function () {
  var m = currentMood();
  var chips = STICKER_PACKS.map(function (p) {
    return '<button type="button" class="gv-pack-chip' + (p.mood === m ? ' gv-pack-on' : '') + '" title="' + esc(p.desc) + '：' + esc(p.keywords.join('、')) + '" onclick="window.GroupV.sendPackSticker(\'' + p.mood + '\')">' + esc(p.name) + '</button>';
  }).join('');
  return '<div class="gv-pack-row"><div style="font-size:12px;color:#888;margin-bottom:6px;">' + GV_PACK_SVG + ' 表情包包（按心情匹配 · 当前心情：' + esc(m) + '）</div><div style="display:flex;gap:6px;flex-wrap:wrap;">' + chips + '</div><div style="margin-top:6px;"><button type="button" class="gv-pack-send" onclick="window.GroupV.sendPackSticker()">按现在的心情发一包</button></div></div>';
};

/* ── 样式（运行时注入，不碰原有 style 块）── */
var GV_CSS = [
  '#wx-otome-home .ot-char{transition:left .6s ease;}',
  '#wx-otome-home .ot-char.gv-flip{transform:translateX(-50%) scaleX(-1);}',
  '#wx-otome-home .ot-char.gv-walking svg{animation:gvBob .28s ease-in-out infinite alternate;}',
  '@keyframes gvBob{from{transform:translateY(0);}to{transform:translateY(-4px);}}',
  '#ot-char.gv-nod .ot-head{animation:gvNod .65s ease;}',
  '#ck-char.gv-nod svg{animation:gvNod .65s ease;}',
  '@keyframes gvNod{0%,100%{transform:translateY(0);}30%{transform:translateY(5px);}60%{transform:translateY(2px);}}',
  '#ot-char.gv-sit{transform:translateX(-50%) translateY(14px) scaleY(.9);}',
  '#ot-char.gv-sit.gv-flip{transform:translateX(-50%) scaleX(-1) translateY(14px) scaleY(.9);}',
  '#ot-char.gv-sleepy .ot-eye{transform:scaleY(.15)!important;}',
  '#ot-char.gv-surprised .ot-mouth-open{opacity:1!important;}',
  '#ot-char.gv-surprised .ot-mouth-flat{opacity:0!important;}',
  '.gv-vrm-note{position:absolute;top:100%;left:50%;transform:translateX(-50%);width:160px;margin-top:4px;font-size:10px;line-height:1.5;color:#8a6a52;background:rgba(255,252,248,.94);border-radius:8px;padding:4px 6px;text-align:left;z-index:10;}',
  '.gv-px-grid{display:grid;grid-template-columns:repeat(16,1fr);gap:1px;background:#e8ddd2;border:1px solid #e8ddd2;border-radius:8px;overflow:hidden;margin-top:8px;}',
  '.gv-px{aspect-ratio:1;border:0;padding:0;cursor:pointer;font-size:9px;line-height:1;display:flex;align-items:center;justify-content:center;min-width:0;}',
  '.gv-pal{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;}',
  '.gv-pal-sw{width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ddd;cursor:pointer;padding:0;}',
  '.gv-pal-emoji{border:1px solid #e8ddd2;background:#fff;border-radius:8px;font-size:16px;padding:2px 6px;cursor:pointer;}',
  '.gv-pal-emoji svg{display:block;}',
  '.gv-pack-row{margin-top:10px;background:#fff;border-radius:10px;padding:10px;}',
  '.gv-pack-chip{border:1px solid #e8ddd2;background:#f7f7f7;color:#333;border-radius:12px;padding:5px 10px;font-size:12px;cursor:pointer;}',
  '.gv-pack-chip.gv-pack-on{background:#07c160;color:#fff;border-color:#07c160;}',
  '.gv-pack-send{border:0;background:#07c160;color:#fff;border-radius:12px;padding:7px 12px;font-size:12px;cursor:pointer;}',
  '.gv-theme-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;}',
  '.gv-theme-btn{border:1px solid #e5e5e5;background:#fff;color:#171717;border-radius:12px;padding:10px 12px;font-size:15px;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:48px;min-width:0;box-sizing:border-box;text-align:left;}',
  '.gv-theme-btn-on{background:#f9f9f9;font-weight:600;border-color:#171717;box-shadow:inset 0 0 0 1px #171717;}',
  '.gv-theme-sw{display:inline-block;width:24px;height:24px;border-radius:8px;border:1px solid rgba(23,23,23,.12);flex-shrink:0;}',
  '.gv-theme-sw-custom{display:flex;overflow:hidden;padding:0;}',
  '.gv-theme-sw-custom i{flex:1;display:block;}',
  '.gv-theme-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  '.gv-theme-check{width:20px;height:20px;border-radius:50%;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
  '.gv-theme-check svg{vertical-align:0;}',
  '.gv-cf-stage{position:relative;height:296px;margin-top:14px;perspective:900px;touch-action:pan-y;overflow:visible;}',
  '.gv-cf-cover{position:absolute;left:50%;top:8px;width:132px;height:198px;margin-left:-66px;border-radius:14px;overflow:hidden;cursor:pointer;box-shadow:0 10px 24px rgba(23,23,23,.22);will-change:transform;-webkit-box-reflect:below 6px linear-gradient(rgba(255,255,255,.22),transparent 75%);background:#fff;}',
  '.gv-cf-art{position:absolute;inset:0;}',
  '.gv-cf-sun{position:absolute;top:18px;left:50%;width:44px;height:44px;margin-left:-22px;border-radius:50%;opacity:.92;display:block;}',
  '.gv-cf-band{position:absolute;left:0;right:0;bottom:0;height:34px;opacity:.85;display:block;}',
  '.gv-cf-wash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;}',
  '.gv-cf-title{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-weight:700;font-size:17px;color:#171717;transition:opacity .18s ease;}',
  '.gv-cf-dots{display:flex;gap:6px;justify-content:center;margin-top:10px;}',
  '.gv-cf-dot{width:7px;height:7px;border-radius:50%;border:0;background:#d9d9d9;padding:0;cursor:pointer;}',
  '.gv-cf-dot.on{background:#171717;}',
  '.gv-cf-cover-big{position:relative;left:auto;top:auto;margin:0;transform:none!important;cursor:default;}',
  '.gv-cf-colors{display:flex;gap:12px;flex-wrap:wrap;}',
  '.gv-cf-color{width:44px;height:44px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ddd;cursor:pointer;padding:0;}',
  '.gv-cf-color-on{box-shadow:0 0 0 2px #171717;}',
  '.gv-sheet-grab{width:36px;height:4px;border-radius:999px;background:#e5e5e5;margin:0 auto 12px;}',
  '#gv-theme-sheet{position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:flex-end;justify-content:center;}',
  '#gv-theme-sheet .gv-sheet{width:100%;max-width:480px;max-height:70vh;overflow:auto;background:#fff;border:none;border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-sizing:border-box;font-size:16px;color:#171717;box-shadow:0 4px 16px rgba(23,23,23,.12);}',
  '.gv-garden{margin-top:12px;background:rgba(255,255,255,.82);border-radius:18px;padding:12px 14px;box-shadow:0 8px 24px rgba(160,110,80,.14),0 0 0 1px rgba(255,255,255,.9);}',
  '.gv-garden-head{font-weight:700;font-size:14px;margin-bottom:8px;}',
  '.gv-garden-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
  '.gv-sprout{background:#fff;border:1px solid #f0e6dc;border-radius:12px;padding:10px;}',
  '.gv-sprout-ico{font-size:26px;}',
  '.gv-sprout-t{font-size:13px;font-weight:700;margin-top:2px;}',
  '.gv-sprout-btns{display:flex;gap:6px;margin-top:8px;}',
  '.gv-seeds{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}',
  '.gv-seed{border:1px solid #e8ddd2;background:#fff;border-radius:12px;padding:6px 10px;font-size:12px;cursor:pointer;}'
].join('\n');
var THEME_CSS = [
  '#sys-shell{background-color:var(--gv-soft);}',
  '#sys-shell .sys-dock-bg{background-color:var(--gv-soft)!important;}',
  '.sys-app-window[data-app-sandbox="wechat"] #wx-otome-home{background:linear-gradient(180deg,var(--gv-soft) 0%,#ffffff 65%)!important;}',
  '.st-bigtitle{color:var(--gv-accent)!important;}'
].join('\n');
var injectStyles = function () {
  try {
    var head = document.head || document.documentElement;
    if (!document.getElementById('gv-style')) { var s1 = document.createElement('style'); s1.id = 'gv-style'; s1.textContent = GV_CSS; head.appendChild(s1); }
    if (!document.getElementById('gv-theme-style')) { var s2 = document.createElement('style'); s2.id = 'gv-theme-style'; s2.textContent = THEME_CSS; head.appendChild(s2); }
  } catch (e) {}
};

/* ── 初始化 ── */
var _initDone = false;
var init = function () {
  if (_initDone) return; _initDone = true;
  injectStyles();
  applyTheme();
  try { document.addEventListener('pointermove', onGaze, true); } catch (e) {}
  try { document.addEventListener('click', onCkCharClick, true); } catch (e) {}
  try { if (window.GroupM && window.GroupM.memtree && typeof window.GroupM.memtree.render === 'function') window.GroupM.memtree.render(); } catch (e) {}
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.GroupV = {
  THEMES: THEMES, themeById: themeById, currentTheme: currentTheme, applyTheme: applyTheme,
  setTheme: setTheme, setCustomColor: setCustomColor, themeColors: themeColors, setThemeColor: setThemeColor,
  coverBg: coverBg, cfRender: cfRender, cfInit: cfInit, cfIntro: cfIntro, cfAnimateTo: cfAnimateTo,
  cfTap: cfTap, cfGoTo: cfGoTo, openThemeDetail: openThemeDetail, closeThemeDetail: closeThemeDetail,
  shareCode: shareCode, decodeTheme: decodeTheme,
  importShareCode: importShareCode, copyShareCode: copyShareCode, importShareCodeUI: importShareCodeUI,
  themeSectionHTML: themeSectionHTML, openThemeSheet: openThemeSheet, closeThemeSheet: closeThemeSheet,
  openCustomTheme: openCustomTheme,
  refreshOtomeSettings: refreshOtomeSettings,
  ACTIONS: ACTIONS, EMOTIONS: EMOTIONS, lookupAction: lookupAction, listActions: listActions,
  playAction: playAction, charNod: charNod, ckNod: ckNod, charSit: charSit, isSeated: isSeated,
  otomeCharWalkTo: otomeCharWalkTo, ckWire: ckWire,
  loadRig: loadRig, setRig: setRig, applyRig: applyRig, rigState: rigState, rigSectionHTML: rigSectionHTML,
  gardenLoad: gardenLoad, gardenMemories: gardenMemories, gardenStageOf: gardenStageOf,
  gardenPlant: gardenPlant, gardenWater: gardenWater, gardenPrune: gardenPrune,
  gardenAct: gardenAct, gardenHTML: gardenHTML, gardenRefresh: gardenRefresh,
  pixelLoad: pixelLoad, pixelPick: pixelPick, pixelPaint: pixelPaint, pixelCharDraw: pixelCharDraw,
  pixelCharDrawUI: pixelCharDrawUI, pixelClear: pixelClear, pixelExport: pixelExport,
  pixelExportUI: pixelExportUI, pixelHTML: pixelHTML,
  STICKER_PACKS: STICKER_PACKS, matchPackForMood: matchPackForMood, currentMood: currentMood,
  sendPackSticker: sendPackSticker, packRowHTML: packRowHTML
};
})();
