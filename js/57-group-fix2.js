
/* GROUP-FIX2: 桌宠重画 + 桌面美化（补丁脚本 patch_groupFIX2.py 追加）。
   桌宠皮肤数据出处: welltilln/desksprite (MIT, github.com/welltilln/desksprite),
   skins/blue-boy.json 与 skins/cat.json 的帧点阵逐字照录; 渲染、换肤、帧选择为本组自写,
   未复制该库代码。帧槽按其 docs/SKIN_FORMAT.md: idle 必填, walk 2 帧交替, held 必填,
   carry 为 working 行走时叠加的携带物; 坐姿裁行略过(书桌在宠物身后, 视觉上不需要)。
   桌面图标字形取自已合入的 AQ 精选字典(AQIcons.iconSVG, Tabler MIT 为主), 逐个内联,
   无 CDN、无整包下载; 每 app 配色取自 IconSystem ASSETS 原 tint, 再按当前主题混合。
   注意: 日程 app 已于 2026-11-26 取消, 时钟/日历卡片点按时若桌面已无日程图标,
   自动改开「此刻」(char 的 24h 日程在 life sim 里); 日历/纪念日读的仍是本机真实数据。 */
(function () {
'use strict';
/* FIX2-SKIN boy 14x14 */
var BOY_IDLE = [
  '...HHHHHHHHH..',
  '..HHhhHHHhhH..',
  '..HHhSSSSShH..',
  '..HHSeeSSeeS..',
  '..HHSSSsSSSS..',
  '..HHSSsWWsSH..',
  '...HHSSSSsH...',
  '...WBBTtTBBW..',
  '..BBBbTtTbBBB.',
  '..BBBBTtTBBBB.',
  '..bBBBBBBBBBb.',
  '..bBBBBBBBBBb.',
  '...bbb..bbb...',
  '...bbb..bbb...'
];
var BOY_WALK_A = BOY_IDLE.slice(0, 12).concat(['........bbb...', '...bbb..bbb...']);
var BOY_WALK_B = BOY_IDLE.slice(0, 12).concat(['...bbb........', '...bbb..bbb...']);
var BOY_HELD = [
  '...HHHHHHHHH..',
  'S.HHhhHHHhhHS.',
  'SSHHhSSSSShSS.',
  '..HHSeeSSeeS..',
  '..HHooSooSSS..',
  '..HHoesoesSH..',
  '...HHSSSSsH...',
  '...WBBTtTBBW..',
  '..BBBbTtTbBBB.',
  '..BBBBTtTBBBB.',
  '..bBBBBBBBBBb.',
  '..bBBBBBBBBBb.',
  '..............',
  '..............'
];
var BOY_CARRY = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '...........ggg',
  '...........gog',
  '...........gog',
  '...........ggg',
  '..............',
  '..............',
  '..............',
  '..............'
];
var BOY_PALETTE = { '.': null, H: '#3D2714', h: '#5A3D22', S: '#FDBDA0', s: '#E09070', e: '#1A1A2E', W: '#F0F0F8', B: '#1E5FCC', b: '#1547A8', T: '#CC2233', t: '#AA1020', o: '#fff', g: '#E8C36A' };
/* FIX2-SKIN cat 13x13 */
var CAT_IDLE = [
  '.B.........B.',
  'BB.........BB',
  'BBBbBBBBBbBBB',
  '.BBBNgGgNBBB.',
  '.BBBggPggBBB.',
  '.BBBBBBBbBBB.',
  '.BWWWBBBBBB..',
  '.BWWWbBBBBB..',
  '.BBBBBBBBBB..',
  '..BBBBBBBB...',
  '..BBBBBBBB...',
  '..BB....BB...',
  '..BB....BB...'
];
var CAT_WALK_A = CAT_IDLE.slice(0, 11).concat(['.......BB....', '..BB....BB...']);
var CAT_WALK_B = CAT_IDLE.slice(0, 11).concat(['..BB.........', '..BB....BB...']);
var CAT_HELD = [
  '.B.........B.',
  'BB.........BB',
  'BBBbBBBBBbBBB',
  '.BBBWGBGWBBB.',
  '.BBBggPggBBB.',
  '.BBBBBBBbBBB.',
  '.BWWWBBBBBB..',
  '.BWWWbBBBBB..',
  '.BBBBBBBBBB..',
  '..BBBBBBBB...',
  '..BBBBBBBB...',
  '.............',
  '.............'
];
var CAT_PALETTE = { '.': null, B: '#D97B29', b: '#E89B4A', G: '#F2A950', g: '#F7BE78', W: '#FFF3E0', P: '#FF9EAD', N: '#3A2A1E' }; /* GROUP-DESKPET: 猫按截图改成橘色（只改色值，帧的行数据不动；W 仍是白胸、P 仍是粉鼻、N 仍是深色眼） */
/* FIX2-SKIN end */
var SKINS = {
  boy: { w: 14, h: 14, palette: BOY_PALETTE, frames: { idle: BOY_IDLE, walk: [BOY_WALK_A, BOY_WALK_B], held: BOY_HELD, carry: BOY_CARRY } },
  cat: { w: 13, h: 13, palette: CAT_PALETTE, frames: { idle: CAT_IDLE, walk: [CAT_WALK_A, CAT_WALK_B], held: CAT_HELD, carry: null } }
};

/* ── 小工具 ── */
var $id = function (id) { return document.getElementById(id); };
var readJSON = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
var _rgb = function (hex) { try { var h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join(''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; } catch (e) { return [0, 0, 0]; } };
var _hex = function (r, g, b) { var f = function (c) { return Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'); }; return '#' + f(r) + f(g) + f(b); };
var shade = function (hex, pct) { var c = _rgb(hex); var k = pct / 100 * 255; return _hex(c[0] + k, c[1] + k, c[2] + k); };
var mix = function (a, b, t) { var ca = _rgb(a), cb = _rgb(b); return _hex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t); };
var isHex = function (s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); };

/* ── 主题表（GROUP-FIX13：maison-des-mots token 重定基；默认白 + 8 款 BU + 特里亚农；未知主题用 GroupV 的 c1/c2 兜底）── */
var FIX2_THEMES = {
  'light':        { bg: '#ffffff', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#5c6884', card: 'rgba(255,253,248,.78)', glyph: 'auto',  filled: false, stroke: 2,   radius: 18, border: '' },
  'guichao':      { bg: '#ffffff', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#5c6884', card: 'rgba(255,253,248,.78)', glyph: 'auto',  filled: false, stroke: 2,   radius: 18, border: '' },
  'default':      { bg: '#ffffff', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#5c6884', card: 'rgba(255,253,248,.78)', glyph: 'auto',  filled: false, stroke: 2,   radius: 18, border: '' },
  'bu-spring-pink': { bg: '#fbf9f4', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#6f687e', card: 'rgba(251,249,244,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-autumn-red':  { bg: '#fffdf8', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#5b5871', card: 'rgba(255,253,248,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-night-black': { bg: '#1e2748', ink: '#fbf9f4', muted: '#a9b3cc', line: 'rgba(251,249,244,.16)', accent: '#e8c9d0', card: 'rgba(70,83,111,.72)', glyph: 'light', filled: true,  stroke: 2, radius: 12, border: '' },
  'bu-winter-blue': { bg: '#eef0f5', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#46536f', card: 'rgba(238,240,245,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-mint':        { bg: '#fbf9f4', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#6e7894', card: 'rgba(251,249,244,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-lavender':    { bg: '#fbf9f4', ink: '#1e2748', muted: '#5c6884', line: 'rgba(30,39,72,.16)', accent: '#5c6884', card: 'rgba(251,249,244,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-cream':       { bg: '#fffdf8', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#46536f', card: 'rgba(255,253,248,.78)', glyph: 'accent', filled: false, stroke: 2, radius: 18, border: '' },
  'bu-forest':      { bg: '#1e2748', ink: '#fbf9f4', muted: '#a9b3cc', line: 'rgba(251,249,244,.16)', accent: '#a9b3cc', card: 'rgba(70,83,111,.72)', glyph: 'light', filled: true,  stroke: 2, radius: 12, border: '' },
  'trianon':        { bg: '#fbf9f4', ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: '#5c6884', card: 'rgba(251,249,244,.80)', glyph: 'navy', filled: false, stroke: 1.8, radius: 10, border: '1px solid rgba(30,39,72,.42)' }
};
/* GROUP-THROTTLE: 主题 id 解析结果缓存（2000ms TTL + 写版本号失效；1s 轮询每两轮才
   重新解析一次，同页写 prefs 与跨 tab storage 均由 bump 立即失效；BuThemes/GroupV
   层已有各自缓存，热路径上本函数不再重复读盘）。 */
var _throttleThemeId = null, _throttleThemeIdAt = 0, _throttleThemeIdRev = -1;
var currentThemeId = function () {
  var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
  var _now = Date.now();
  if (_throttleThemeId !== null && _throttleThemeIdRev === _rev && _now - _throttleThemeIdAt < 2000) return _throttleThemeId;
  var id = null;
  try { if (window.BuThemes && BuThemes.currentId) { var _b = BuThemes.currentId(); if (_b) id = _b; } } catch (e) {}
  if (!id) { try { var t = document.documentElement.getAttribute('data-app-theme'); if (t) id = t; } catch (e) {} }
  if (!id) { try { if (window.GroupV && GroupV.currentTheme) { var c = GroupV.currentTheme(); if (c && c.id) id = c.id; } } catch (e) {} }
  if (!id) id = 'light';
  _throttleThemeId = id; _throttleThemeIdAt = _now; _throttleThemeIdRev = _rev;
  return id;
};
var themeDef = function (id) {
  if (FIX2_THEMES[id]) return FIX2_THEMES[id];
  try {
    if (window.GroupV && GroupV.currentTheme) {
      var c = GroupV.currentTheme();
      if (c && c.c1 && c.c2) {
        return { bg: c.c1, ink: '#1e2748', muted: '#46536f', line: 'rgba(30,39,72,.16)', accent: c.c2, card: 'rgba(255,253,248,.78)', glyph: 'auto', filled: false, stroke: 2, radius: 18, border: '' }; /* GROUP-FIX13: 兜底墨/灰/线改 maison 值 */
      }
    }
  } catch (e) {}
  return FIX2_THEMES.light;
};

/* ── 图标：每 app 配色取自 IconSystem ASSETS 原 tint；字形取自 AQ 精选字典 ── */
var FIX2_APP_TINT = {
  wechat: ['#E7F6EB', '#C9EBD4'], nobeidanci: ['#FFF6D8', '#FBE7A6'], schedule: ['#E9F1FD', '#C4DCF8'],
  album: ['#FCEBF1', '#F8C9DB'], weibo: ['#FDE9EC', '#F6C6CF'], forum: ['#F1EBFB', '#DACCF4'],
  novel: ['#FDEEE4', '#FBD8BF'], worldbook: ['#E7F3FB', '#C2E0F2'], guichao: ['#F7EFE6', '#EADFCF'],
  TarotDivine: ['#F3EAFB', '#DECBF3'], phone: ['#E4F6E9', '#C0E8CB'], sms: ['#E7F3FE', '#C2DEF8'],
  weather: ['#E8F3FE', '#C4E2F9'], memo: ['#FFF8D6', '#FBEFA8'], settings: ['#F0F0F2', '#DBDBDF'],
  cike: ['#FDE9EC', '#F7C3CC'], catos: ['#FFF1DC', '#FFD9A6'], music: ['#FCEBF0', '#F8C9D8'],
  privatedate: ['#FDE8EF', '#F6C2D4'], anecdote: ['#F5EFE2', '#EADFC6'],
  script: ['#F6E8D2', '#E8CF9F'], cinema: ['#E9E4F5', '#CFC2EC']
};
var FIX2_APP_ICON = {
  wechat: 'message-square', nobeidanci: 'bookmark', schedule: 'calendar', album: 'image',
  weibo: 'eye', forum: 'users', novel: 'book', worldbook: 'globe', guichao: 'home',
  TarotDivine: 'sparkles', phone: 'phone', sms: 'message-circle', weather: 'cloud',
  memo: 'file-text', settings: 'settings', cike: 'clock', catos: 'paw', music: 'music',
  privatedate: 'heart', anecdote: 'star', script: 'film', cinema: 'video'
};
var SLOT_FOR_APP = {
  phone: 'phone', sms: 'sms', wechat: 'wechat', album: 'album', music: 'music',
  memo: 'notes', schedule: 'calendar', weather: 'weather', settings: 'settings',
  guichao: 'guichao', script: 'script', novel: 'novel', cike: 'cike'
};
var iconBgFor = function (appId, theme) {
  var t = FIX2_APP_TINT[appId] || ['#D6F5E6', '#BCEBD6'];
  if (theme.glyph === 'light') return 'linear-gradient(155deg,' + shade(t[0], -58) + ',' + shade(t[1], -58) + ')';
  var wash = (theme.glyph === 'navy') ? 0.35 : 0.25;
  return 'linear-gradient(155deg,' + mix(t[0], theme.bg, wash) + ',' + mix(t[1], theme.bg, wash) + ')';
};
var glyphColorFor = function (appId, theme) {
  var t = FIX2_APP_TINT[appId] || ['#D6F5E6', '#BCEBD6'];
  if (theme.glyph === 'navy') return '#1e2748'; /* GROUP-FIX13: 特里亚农字形墨改 maison 墨蓝 */
  if (theme.glyph === 'light') return theme.ink;
  var base = shade(t[1], -45);
  if (theme.glyph === 'accent') return mix(base, theme.accent, 0.45);
  return base;
};
var repaintIcons = function () {
  try {
    if (!window.AQIcons || !AQIcons.iconSVG) return;
    var _tid = currentThemeId(); /* GROUP-THROTTLE: 主题 id 每轮只解析一次（原逐图标调 currentThemeId，约 21 图标 ×3 次读盘）；sig 循环内复用同一 id */
    var theme = themeDef(_tid);
    var custom = null;
    try { custom = (window.IconSystem && IconSystem.custom) || null; } catch (e) {}
    var wraps = document.querySelectorAll('.sys-app-icon-wrapper[data-target-app]');
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      var appId = w.getAttribute('data-target-app');
      var node = w.querySelector('.sys-app-icon');
      if (!appId || !node) continue;
      if (node.querySelector('.is-icon-img')) continue;
      if (custom && custom[appId] && custom[appId].img) continue;
      var pick = null;
      try { var slot = SLOT_FOR_APP[appId]; if (slot && AQIcons.getPick) pick = AQIcons.getPick(slot); } catch (e) {}
      var iconId = (pick && pick.icon) || FIX2_APP_ICON[appId];
      if (!iconId) continue;
      var stroke = (pick && pick.stroke) || theme.stroke;
      var filled = pick ? !!pick.filled : theme.filled;
      var svg = AQIcons.iconSVG(iconId, { size: 34, stroke: stroke, filled: filled });
      if (!svg) continue;
      var glyph = glyphColorFor(appId, theme);
      var sig = appId + '|' + _tid + '|' + iconId + '|' + stroke + '|' + (filled ? '1' : '0') + '|' + glyph;
      if (node.dataset.fix2Sig === sig) continue;
      node.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + iconBgFor(appId, theme) + ';border-radius:inherit;color:' + glyph + ';' + (theme.border ? 'border:' + theme.border + ';box-sizing:border-box;' : '') + '">' + svg + '</div>';
      node.style.borderRadius = theme.radius + 'px';
      node.dataset.fix2Sig = sig;
    }
  } catch (e) {}
};
var applyTheme = function () {
  try {
    var theme = themeDef(currentThemeId());
    var layer = $id('sys-desktop-layer');
    if (layer) {
      layer.style.setProperty('--fix2-w-bg', theme.card);
      layer.style.setProperty('--fix2-w-ink', theme.ink);
      layer.style.setProperty('--fix2-w-muted', theme.muted);
      layer.style.setProperty('--fix2-w-line', theme.line);
      layer.style.setProperty('--fix2-w-accent', theme.accent);
      layer.style.setProperty('--fix2-w-radius', theme.radius + 'px');
    }
    repaintIcons();
  } catch (e) {}
};

/* ── 桌宠像素渲染：画布放在 .gm-pet-char（默认 boy）或 #gw-pet-skin（猫）里；
   M/AB 重建 innerHTML 后由 MutationObserver 补回；抠图立绘时不动 ── */
var _held = false;
var _lastPetKey = '';
/* GROUP-THROTTLE: prefs 解析结果缓存（500ms TTL + 写版本号失效；每次返回新对象，
   调用方不污染缓存。唯一调用方 effectiveSkin 只读 petSkin）。 */
var _throttlePrefsCache = null, _throttlePrefsAt = 0, _throttlePrefsRev = -1;
var readPrefs = function () {
  var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
  var _now = Date.now();
  if (_throttlePrefsCache !== null && _throttlePrefsRev === _rev && _now - _throttlePrefsAt < 500) return (_throttlePrefsCache && typeof _throttlePrefsCache === 'object') ? Object.assign({}, _throttlePrefsCache) : {};
  var fresh = readJSON('phone_ui_prefs_v1', {});
  _throttlePrefsCache = fresh; _throttlePrefsAt = _now; _throttlePrefsRev = _rev;
  return (fresh && typeof fresh === 'object') ? Object.assign({}, fresh) : {};
};
var effectiveSkin = function () {
  try {
    var pet = $id('desk-pet');
    if (!pet) return 'boy';
    var charEl = pet.querySelector('.gm-pet-char');
    if (charEl && charEl.querySelector('img')) return 'cutout';
    var ov = pet.querySelector('#gw-pet-skin');
    if (ov && ov.querySelector('img.gw-cutout')) return 'cutout';
    var prefs = readPrefs();
    if (prefs.petSkin === 'cat') return 'cat';
    if (prefs.petSkin === 'cutout') return 'cutout';
    var ab = readJSON('pet_state_ab_v1', null);
    if (ab && ab.skin && ab.skin.id === 'cat') return 'cat';
    if (ab && ab.skin && (ab.skin.id === 'cutout' || ab.skin.id === 'custom')) return 'cutout';
  } catch (e) {}
  return 'boy';
};
var customPalette = function (skinId) {
  var base = SKINS[skinId].palette;
  var pal = {};
  Object.keys(base).forEach(function (k) { pal[k] = base[k]; });
  try {
    var look = readJSON('cike_char_look_v1', null);
    if (look && isHex(look.hair) && look.hair.toLowerCase() !== '#3a2a1e') {
      if (skinId === 'boy') { pal.H = look.hair; pal.h = shade(look.hair, -18); }
      if (skinId === 'cat') { pal.B = look.hair; pal.b = shade(look.hair, -15); }
    }
    if (look && isHex(look.eye) && look.eye.toLowerCase() !== '#2b2b2b' && look.eye.toLowerCase() !== '#3a2a1e') {
      if (skinId === 'boy') pal.e = look.eye;
      if (skinId === 'cat') pal.N = look.eye;
    }
  } catch (e) {}
  try {
    /* GROUP-PET：市场三款（pet-claude / pet-chatgpt / pet-muse）是 BOY 帧的换色；
       调色板以 GroupPET.MARKET_PALETTES 为唯一来源；GroupPET 不在时保持原色。 */
    if (skinId === 'boy' && window.GroupPET && GroupPET.MARKET_PALETTES) {
      var _ps = readPrefs().petSkin || '';
      var _mp = GroupPET.MARKET_PALETTES[_ps];
      if (_mp) Object.keys(_mp).forEach(function (k) { pal[k] = _mp[k]; });
    }
  } catch (e) {}
  return pal;
};
var drawSkin = function (canvas, skinId, rows, withCarry) {
  var sk = SKINS[skinId];
  if (!sk || !canvas || !rows) return false;
  canvas.width = sk.w; canvas.height = sk.h;
  var ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, sk.w, sk.h);
  var pal = customPalette(skinId);
  var paint = function (rs) {
    for (var y = 0; y < rs.length && y < sk.h; y++) {
      var row = rs[y];
      for (var x = 0; x < row.length && x < sk.w; x++) {
        var col = pal[row.charAt(x)];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    }
  };
  paint(rows);
  if (withCarry && sk.frames.carry) paint(sk.frames.carry);
  return true;
};
var drawCurrentPet = function (cv, skin) {
  try {
    var pet = $id('desk-pet');
    if (!pet || !cv) return;
    var sk = SKINS[skin];
    if (!sk) return;
    var walking = pet.classList.contains('gw-walking');
    var working = false;
    try { var mon = document.querySelector('#gw-desk .gw-mon-act'); working = !!(mon && /working/i.test(mon.textContent || '')); } catch (e) {}
    var frameKey = 'idle', rows = sk.frames.idle, withCarry = false;
    if (_held) { frameKey = 'held'; rows = sk.frames.held; }
    else if (walking) {
      var idx = (Date.now() % 640 < 320) ? 0 : 1;
      frameKey = 'walk' + idx;
      rows = sk.frames.walk[idx];
      withCarry = working;
    }
    var palSig = '';
    try { var lk = readJSON('cike_char_look_v1', null); palSig = lk ? (String(lk.hair || '') + '|' + String(lk.eye || '')) : ''; } catch (e) {}
    try { palSig += '|' + String(readPrefs().petSkin || ''); } catch (e) {} /* GROUP-PET: 换市场皮肤强制重画（否则 _lastPetKey 命中会跳过重绘） */
    var key = skin + '|' + frameKey + '|' + (withCarry ? 'carry' : '') + '|' + palSig;
    if (key === _lastPetKey) return;
    _lastPetKey = key;
    drawSkin(cv, skin, rows, withCarry);
  } catch (e) {}
};
var ensurePetCanvas = function () {
  try {
    var pet = $id('desk-pet');
    if (!pet) return;
    var skin = effectiveSkin();
    var charEl = pet.querySelector('.gm-pet-char');
    if (skin === 'cutout') {
      var olds = pet.querySelectorAll('canvas.fix2-pixel');
      for (var i = 0; i < olds.length; i++) { if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]); }
      if (charEl) {
        var svgs = charEl.querySelectorAll('svg[data-fix2-hidden="1"]');
        for (var j = 0; j < svgs.length; j++) { svgs[j].style.display = ''; svgs[j].removeAttribute('data-fix2-hidden'); }
      }
      _lastPetKey = '';
      return;
    }
    var ov = pet.querySelector('#gw-pet-skin');
    var host = (skin === 'cat' && ov) ? ov : charEl;
    if (!host) return;
    if (charEl) {
      var all = charEl.querySelectorAll('svg');
      for (var k = 0; k < all.length; k++) {
        if (!all[k].dataset.fix2Hidden) { all[k].dataset.fix2Hidden = '1'; all[k].style.display = 'none'; }
      }
    }
    var cvs = pet.querySelectorAll('canvas.fix2-pixel');
    for (var m = 0; m < cvs.length; m++) { if (cvs[m].parentNode !== host) cvs[m].parentNode.removeChild(cvs[m]); }
    var cv = host.querySelector('canvas.fix2-pixel');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'fix2-pixel'; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv); }
    drawCurrentPet(cv, skin);
  } catch (e) {}
};
/* M 组气泡（#gm-pet-bubble）出现时再夹一次：优先放宠物上方，不够放下方，始终在活动区内 */
var clampMbubble = function () {
  try {
    var pet = $id('desk-pet');
    var layer = $id('sys-desktop-layer');
    var bub = pet && pet.querySelector('#gm-pet-bubble');
    if (!pet || !layer || !bub) return;
    if (bub.style.display === 'none' || !bub.offsetWidth) return;
    var lh = layer.clientHeight || 700;
    var lw = layer.clientWidth || 390;
    var zoneTop = lh - 252, dockTop = lh - 102;
    var lr = layer.getBoundingClientRect(), pr = pet.getBoundingClientRect();
    var petTop = pr.top - lr.top, petLeft = pr.left - lr.left;
    var bw = bub.offsetWidth || 172, bh = bub.offsetHeight || 44;
    var top = petTop - bh - 6;
    if (top < zoneTop) top = petTop + pr.height + 6;
    if (top + bh > dockTop - 4) top = zoneTop;
    var left = petLeft + pr.width / 2 - bw / 2;
    left = Math.max(8, Math.min(lw - bw - 8, left));
    bub.style.right = 'auto'; bub.style.bottom = 'auto';
    bub.style.left = (left - petLeft) + 'px';
    bub.style.top = (top - petTop) + 'px';
  } catch (e) {}
};

/* ── 打开 app：先点桌面图标；图标不存在（app 已取消）时走 fallback ── */
var openApp = function (id, fallbackId) {
  var tryOne = function (appId) {
    var w = document.querySelector('.sys-app-icon-wrapper[data-target-app="' + appId + '"]');
    if (w) { try { w.click(); } catch (e) {} return true; }
    return false;
  };
  if (tryOne(id)) return true;
  if (fallbackId && fallbackId !== id && tryOne(fallbackId)) return true;
  try { if (window.AppManager && AppManager.launch) { AppManager.launch(fallbackId || id); return true; } } catch (e) {}
  return false;
};

/* GROUP-WIDGET（第 7 项缩减版）: #fix2-hero 的 5 张卡（时钟/纪念日/音乐/日历/照片）已移入小组件
   目录（WIDGET_CATALOG：clock / calendar / anniversary / music / photo），桌面默认不再贴任何
   小组件。renderHero 只保留壳（调用方与 GroupFIX2 导出不变），若残留旧 host 则移除；原来只服务
   英雄卡的 todaySchedule / nextAnniversary / musicState / latestPhoto / _parseYMD / _parseMD /
   _todayMid 已随之一并删除（同等读数逻辑已在 GROUP-WIDGET 块里按小组件需要重写：
   anniversaryHTML / musicHTML / photoHTML；日历页当天只读展示一行 phone_schedule_v1 安排）。
   fix2 日历卡片原来指向已删的 schedule、回落此刻——卡片本身已随英雄区移除，不再需要改指向；
   日历的入口现在是日历小组件点按与设置里日历行的“打开”。 */
var renderHero = function () {
  try { var _h = $id('fix2-hero'); if (_h) _h.remove(); } catch (e) {}
};

/* ── AF 搜索框接 AM 的计时/待办/算式命令（pill 已删，命令入口保留） ── */
var bindAfQuick = function () {
  try {
    var input = $id('af-search-input');
    var box = $id('af-search-results');
    if (!input || !box || input._fix2Quick) return;
    input._fix2Quick = true;
    input.addEventListener('input', function () {
      try {
        var old = box.querySelector('.fix2-quick');
        if (old) old.remove();
        var q = input.value.trim();
        if (!q || box.hidden) return;
        if (!window.GroupAM || !GroupAM.quickTools) return;
        var r = GroupAM.quickTools(q);
        if (!r) return;
        if (r.type === 'timer') {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'af-sr-item fix2-quick';
          b.innerHTML = '<span class="af-sr-type">专注</span>🍅 ' + esc(r.label) + ' · 点按开始';
          b.addEventListener('click', function () {
            try { GroupAM.runQuickTool(q); } catch (e) {}
            box.hidden = true; box.innerHTML = '';
            input.value = '';
          });
          box.insertBefore(b, box.firstChild);
        } else if (r.type === 'calc') {
          var d = document.createElement('div');
          d.className = 'af-sr-item fix2-quick';
          d.innerHTML = '<span class="af-sr-type">算式</span>🧮 ' + esc(r.label);
          box.insertBefore(d, box.firstChild);
        } else if (r.type === 'todos') {
          var t = document.createElement('div');
          t.className = 'af-sr-item fix2-quick';
          t.innerHTML = '<span class="af-sr-type">待办</span>' + ((r.items && r.items.length) ? '☑️ ' + esc(r.items.slice(0, 3).join(' · ')) : '今天没有待办，也可以什么都不做。');
          box.insertBefore(t, box.firstChild);
        }
      } catch (e) {}
    });
  } catch (e) {}
};

/* ── 监听与初始化 ── */
var _lastThemeId = '';
var _initTries = 0;
var init = function () {
  try {
    var layer = $id('sys-desktop-layer');
    if (!layer) {
      if (_initTries++ < 20) setTimeout(init, 300);
      return;
    }
    applyTheme();
    renderHero();
    bindAfQuick();
    ensurePetCanvas();
    var pet = $id('desk-pet');
    if (pet && !pet._fix2HeldBound) {
      pet._fix2HeldBound = true;
      pet.addEventListener('pointerdown', function () { _held = true; });
      window.addEventListener('pointerup', function () { _held = false; });
      window.addEventListener('pointercancel', function () { _held = false; });
    }
    if (typeof MutationObserver !== 'undefined') {
      var iconOb = new MutationObserver(function () { repaintIcons(); });
      iconOb.observe(layer, { childList: true, subtree: true });
      if (pet) {
        var petOb = new MutationObserver(function () { ensurePetCanvas(); });
        petOb.observe(pet, { childList: true, subtree: true });
      }
      var themeOb = new MutationObserver(function () { applyTheme(); });
      themeOb.observe(document.documentElement, { attributes: true, attributeFilter: ['data-app-theme', 'data-theme-resolved'] });
    }
    if (window.BuThemes && BuThemes.apply && !BuThemes._fix2Wrapped) {
      BuThemes._fix2Wrapped = true;
      var _origApply = BuThemes.apply;
      BuThemes.apply = function () { var r = _origApply.apply(this, arguments); setTimeout(applyTheme, 0); return r; };
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderHero(); ensurePetCanvas(); } });
    window.addEventListener('storage', function (e) {
      if (!e) return;
      if (e.key === 'phone_ui_prefs_v1') { try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (err) {} } /* GROUP-THROTTLE: 跨 tab 改 prefs 也立即失效 */
      if (e.key === 'phone_ui_prefs_v1' || e.key === 'iconsystem_v1') applyTheme();
      if (e.key === 'phone_schedule_v1' || e.key === 'char_special_dates_v1' || e.key === 'phone_music_list_v1' || e.key === 'phone_album_local_v1') renderHero();
    });
    setInterval(function () { ensurePetCanvas(); clampMbubble(); }, 160);
    setInterval(function () { renderHero(); }, 30000);
    setInterval(function () { var id = currentThemeId(); if (id !== _lastThemeId) { _lastThemeId = id; applyTheme(); } }, 1000);
    setTimeout(repaintIcons, 400);
    if (document.readyState === 'complete') setTimeout(repaintIcons, 100);
    else window.addEventListener('load', function () { setTimeout(repaintIcons, 100); });
  } catch (e) {}
};
window.GroupFIX2 = {
  MARKER: 'GROUP-FIX2', version: 1, SKINS: SKINS,
  applyTheme: applyTheme, repaintIcons: repaintIcons, renderHero: renderHero,
  ensurePetCanvas: ensurePetCanvas, openApp: openApp, currentThemeId: currentThemeId
};
init();
})();
