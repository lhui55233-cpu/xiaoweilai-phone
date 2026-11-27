
/* GROUP-BU · 八款颜色主题 + 阅读换封面（本组新写，未复制任何第三方代码；
   主题（GROUP-FIX13 重定基）：maison-des-mots-skill 色板为底，点缀只动一点点；
   春粉/秋红/薄荷点缀是给定 token 的混合值（见 patch_groupFIX13.py 头注释），
   不再用旧自编色板；截图里的文字、诗句、英文、插画元素一律不出现，
   主题只用颜色 + 手机自己的排版与图形。
   2026-11-28 批量 0020（项 1）：主题表唯一来源是 V 组 GroupV.THEMES（js/19，14 套，
   含每套 5 配色 + 全套 --app-* vars + 深浅）；本文件不再自带第二份 BU_THEMES 表，
   buThemes() 每次都读 GroupV 的表。js/15 AppTheme.THEMES 是同一组值的静态副本
   （加载顺序兜底，apply() 时以 GroupV 的 vars 为准）。
   2026-11-28 批量 0020（项 4）：删掉了 injectStyle 里那条
   html[data-app-theme^="bu-"] .st-group{background:var(--app-card)} 覆盖——它是四张
   截图深蓝卡片的唯一成因：深色主题下 --app-card #46536f 染蓝全部 .st-group 卡片壳，
   而 .st-row 仍是白底、文字仍是固定深色 ink。删后设置页卡片回到 js/00 的 --st-paper
   浅色底（#fffdf8），深色主题下设置页保持浅色卡片。css/28-group-fix13.css:41 那条
   trianon 下的 .st-group 覆盖是另一个属性（data-phone-theme）下的浅色纸底，不受影响。
   封面存在新键 novel_book_covers_v1，不动 novel_store_v1 与任何既有键。 */
(function () {
  'use strict';
  var PREFS_KEY = 'phone_ui_prefs_v1';
  var COVER_KEY = 'novel_book_covers_v1';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* ── 主题表唯一来源：V 组 GroupV.THEMES（js/19）──
     本文件不再自带第二份表；每次都读 GroupV 的表（js/19 在 js/54 之前加载）。
     GroupV 未加载时返回空表，各调用方已有兜底（currentId 认 GroupV.currentTheme，
     desktopSettingsHtml 只剩归巢默认一项，injectStyle 不注入主题规则）。 */
  var buThemes = function () { try { if (window.GroupV && window.GroupV.THEMES) return window.GroupV.THEMES; } catch (e) {} return []; };
  var byId = function (id) { var all = buThemes(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; };
  /* GROUP-THROTTLE: 主题 id 解析结果缓存（500ms TTL + 写版本号失效）；原两处直读
     JSON.parse 合并为一次解析（p2 与 p 同键同刻，复读无意义）。语义不变：raw.theme
     认表优先，其次 GroupV.currentTheme() 兜底，再次 raw.theme 原样，最后 'light'。 */
  var _throttleIdCache = null, _throttleIdAt = 0, _throttleIdRev = -1;
  var currentId = function () {
    var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
    var _now = Date.now();
    if (_throttleIdCache !== null && _throttleIdRev === _rev && _now - _throttleIdAt < 500) return _throttleIdCache;
    var id = null, rawTheme = null;
    try { var p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); if (p && typeof p.theme === 'string') { rawTheme = p.theme; if (byId(p.theme)) id = p.theme; else { try { if (window.GroupV && window.GroupV.themeById && window.GroupV.themeById(p.theme)) id = p.theme; } catch (e) {} } } } catch (e) {}
    if (id === null) { try { if (window.GroupV && window.GroupV.currentTheme) { var c = window.GroupV.currentTheme(); if (c && c.id) id = c.id; } } catch (e) {} }
    if (id === null && rawTheme) id = rawTheme;
    if (id === null) id = 'light';
    _throttleIdCache = id; _throttleIdAt = _now; _throttleIdRev = _rev;
    return id;
  };
  var currentName = function () { var id = currentId(); var t = byId(id); if (t) return t.name; try { if (window.GroupV && window.GroupV.THEMES) { var all = window.GroupV.THEMES; for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name; } } catch (e) {} return ''; };
  var prefsWallpaper = function () { try { if (typeof window.getUiPrefs === 'function') { var g = window.getUiPrefs(); return (g && g.wallpaper) || ''; } var p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); return (p && p.wallpaper) || ''; } catch (e) { return ''; } }; /* GROUP-CORE: 走带缓存的 getUiPrefs，不再每次直读解析 */
  var shellBg = function () { var id = currentId(); var t = byId(id); if (t) return t.c1; try { if (window.GroupV && window.GroupV.currentTheme) { var c = window.GroupV.currentTheme(); if (c && c.c1) return c.c1; } } catch (e) {} return '#ffffff'; };
  var syncShellBg = function () { var shell = document.getElementById('sys-shell'); if (!shell) return; if (prefsWallpaper()) return; shell.style.backgroundImage = 'none'; shell.style.backgroundColor = shellBg(); };
  var syncThemeButtons = function () { var id = currentId(); var nm = currentName(); try { var labels = document.querySelectorAll('[data-bu-cur-theme]'); for (var i = 0; i < labels.length; i++) labels[i].textContent = nm || '归巢默认'; } catch (e) {} try { var btns = document.querySelectorAll('[data-bu-theme]'); for (var j = 0; j < btns.length; j++) { var on = btns[j].getAttribute('data-bu-theme') === id; btns[j].classList.toggle('on', on); } } catch (e) {} };

  var injectStyle = function () {
    if (document.getElementById('groupbu-style')) return;
    var css = '';
    buThemes().forEach(function (t) {
      if (!t.vars) return;
      var parts = [];
      Object.keys(t.vars).forEach(function (k) { parts.push(k + ':' + t.vars[k]); });
      parts.push('--al-bg:' + t.vars['--app-bg']);
      parts.push('--al-fg:' + t.vars['--app-text']);
      parts.push('--al-muted:' + t.vars['--app-muted']);
      parts.push('--al-border:' + t.vars['--app-line']);
      parts.push('--al-subtle:' + t.vars['--app-surface']);
      parts.push('--al-focus:' + t.vars['--app-accent']);
      css += 'html[data-app-theme="' + t.id + '"]{' + parts.join(';') + ';}';
    });
    /* 2026-11-28 批量 0020（项 4）：下面原来还有一条
       html[data-app-theme^="bu-"] .st-group{background:var(--app-card)!important;...}，
       已删除——它是深蓝卡片的唯一成因（见文件头注释）。设置页卡片回到 --st-paper 浅色底，
       .st-row 的边框/按压态两条规则保留（只改线色与按压底色，不动卡片底色）。 */
    css += 'html[data-app-theme^="bu-"] #sys-shell{background-color:var(--app-bg);}'
      + 'html[data-app-theme^="bu-"] .sys-app-window .st-row{border-color:var(--app-line)!important;}'
      + 'html[data-app-theme^="bu-"] .sys-app-window .st-row:active{background:var(--app-surface)!important;}'
      + '.bu-theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}'
      + '.bu-theme-btn{display:flex;gap:8px;align-items:flex-start;text-align:left;border:1px solid var(--app-line,#ececef);background:var(--app-card,#fff);border-radius:10px;padding:8px;cursor:pointer;color:var(--app-text,#25262a);}'
      + '.bu-theme-btn.on{border-color:var(--app-accent,#34363b);outline:2px solid var(--app-accent,#34363b);}'
      + '.bu-theme-sw{flex:none;width:26px;height:34px;border-radius:5px;border:1px solid rgba(0,0,0,.15);display:block;}';
    var st = document.createElement('style');
    st.id = 'groupbu-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  };

  var applyThemeId = function (id) {
    var t = byId(id);
    if (!t) { try { if (window.GroupV && window.GroupV.THEMES) { var all = window.GroupV.THEMES; for (var i = 0; i < all.length; i++) if (all[i].id === id) { t = all[i]; break; } } } catch (e) {} }
    if (!t) return false;
    try { if (window.GroupV && window.GroupV.setTheme) window.GroupV.setTheme(id); } catch (e) {}
    /* GROUP-BU：主题 id 再写一份进 phone_ui_prefs_v1.theme（AC 组启动时会重写 themeCustom 两色，theme 字段不受影响，重启后主题靠它恢复）。 */
    try { if (window.setUiPrefs) window.setUiPrefs({ theme: id }); else { var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); p.theme = id; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */ } } catch (e) {}
    try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (e) {}
    try { if (window.applyTheme) window.applyTheme(); } catch (e) {}
    try { syncShellBg(); } catch (e) {}
    syncThemeButtons();
    try { if (typeof toast === 'function') toast('主题已切换为' + t.name + '。'); else if (typeof ALToast === 'function') ALToast('success', '主题已切换为' + t.name + '。'); } catch (e) {}
    return true;
  };

  var desktopSettingsHtml = function () {
    var cur = currentId();
    var items = [];
    try { var all = buThemes(); for (var i = 0; i < all.length; i++) if (all[i].id === 'guichao' || all[i].id.indexOf('bu-') === 0) items.push(all[i]); } catch (e) {}
    if (!items.length) { items = [{ id: 'guichao', name: '归巢默认', c1: '#ffffff', c2: '#34363b', desc: '归巢黑白灰，默认主题' }]; }
    var curName = currentName() || '归巢默认';
    var grid = items.map(function (t) {
      return '<button type="button" class="bu-theme-btn' + (cur === t.id ? ' on' : '') + '" data-bu-theme="' + t.id + '" title="' + esc(t.desc) + '"><span class="bu-theme-sw" style="background:' + t.c1 + ';border-color:' + t.c2 + ';"></span><span><span style="display:block;font-size:13px;font-weight:700;">' + esc(t.name) + (cur === t.id ? ' <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</span><span style="display:block;font-size:11px;color:#8a857e;line-height:1.5;">' + esc(t.desc) + '</span></span></button>';
    }).join('');
    return '<div class="gw-set-row"><div class="lb">当前主题：<span data-bu-cur-theme>' + esc(curName) + '</span><div class="sub">点下面任意一款立即切换，全机跟随；其余 5 套（晨光暖阳、薄荷清晨、暮山紫、海盐蓝、特里亚农 · 洛可可）在设置 → 主题里，点封面可进详情选 5 个配色。</div></div><button data-gw-theme="info" style="border:1px solid #e8ddd2;background:#fff;border-radius:8px;padding:7px 10px;font-size:12px">主题入口</button></div>'
      + '<div class="bu-theme-grid">' + grid + '</div>';
  };

  /* ── 换封面：内置封面全部是手机自己画的 CSS（纯色/竖纹/波点/渐变），无外部图片 ── */
  var BUILTINS = [
    { id: 'bu-cov-pine', name: '纯色·松绿', css: '#2d5240', ink: '#ffffff', dark: true },
    { id: 'bu-cov-clay', name: '纯色·陶土', css: '#c96f4a', ink: '#ffffff', dark: true },
    { id: 'bu-cov-mist', name: '纯色·雾蓝', css: '#5b7fa6', ink: '#ffffff', dark: true },
    { id: 'bu-cov-cream', name: '纯色·米白', css: '#f4efe6', ink: '#3a3220', dark: false },
    { id: 'bu-cov-stripe-pine', name: '竖纹·松绿', css: 'repeating-linear-gradient(90deg, #2d5240 0 12px, #24413a 12px 14px)', ink: '#ffffff', dark: true },
    { id: 'bu-cov-stripe-cream', name: '竖纹·米白', css: 'repeating-linear-gradient(90deg, #f4efe6 0 10px, #e3d9c6 10px 12px)', ink: '#3a3220', dark: false },
    { id: 'bu-cov-dots-pink', name: '波点·粉', css: 'radial-gradient(circle, #d98a96 2.5px, transparent 3px) 0 0/22px 22px, #fbeef0', ink: '#3a2a2e', dark: false },
    { id: 'bu-cov-dots-blue', name: '波点·蓝', css: 'radial-gradient(circle, #7a9ec0 2.5px, transparent 3px) 0 0/22px 22px, #eef4f8', ink: '#1e2e3d', dark: false },
    { id: 'bu-cov-grad-dusk', name: '渐变·暮山', css: 'linear-gradient(165deg, #8e6fb8 0%, #c96f4a 55%, #e8c98a 100%)', ink: '#ffffff', dark: true }
  ];
  var builtinById = function (id) { for (var i = 0; i < BUILTINS.length; i++) if (BUILTINS[i].id === id) return BUILTINS[i]; return null; };
  var coverLoad = function () { try { var raw = localStorage.getItem(COVER_KEY); if (!raw) return {}; var d = JSON.parse(raw); return (d && typeof d === 'object') ? d : {}; } catch (e) { return {}; } };
  var coverSave = function (map) { try { localStorage.setItem(COVER_KEY, JSON.stringify(map)); return true; } catch (e) { return false; } };
  var coverGet = function (bookId) { if (!bookId) return null; var m = coverLoad(); var e = m[String(bookId)]; return (e && typeof e === 'object') ? e : null; };
  var coverSet = function (bookId, entry) { if (!bookId || !entry) return false; var m = coverLoad(); m[String(bookId)] = entry; return coverSave(m); };
  var coverClear = function (bookId) { if (!bookId) return false; var m = coverLoad(); delete m[String(bookId)]; return coverSave(m); };
  var coverFrontBg = function (book, fallbackColor) {
    var e = coverGet(book && book.id);
    if (!e) return null;
    if (e.kind === 'upload' && typeof e.data === 'string' && e.data.indexOf('data:image/') === 0) return { bg: 'url(' + e.data + ') center/cover', hideTitle: true, ink: '#ffffff' };
    if (e.kind === 'builtin') { var b = builtinById(e.data); if (b) return { bg: b.css, hideTitle: false, ink: b.ink }; }
    return null;
  };
  var coverBoxHtml = function (book, w, h) {
    var cov = coverFrontBg(book, (book && book.color) || '#7a9e7e');
    var bg, txt, ink;
    if (cov) { bg = cov.bg; txt = cov.hideTitle ? '' : esc(book.title); ink = cov.ink; }
    else if (book && book.cover) { bg = 'url(' + book.cover + ') center/cover'; txt = ''; ink = '#ffffff'; }
    else { bg = (book && book.color) || '#7a9e7e'; txt = esc(book.title); ink = '#ffffff'; }
    return '<div style="width:' + w + 'px;height:' + h + 'px;border-radius:8px;background:' + bg + ';display:flex;align-items:flex-end;justify-content:center;padding:10px 8px;color:' + ink + ';font-size:13px;font-weight:700;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.35);box-shadow:0 2px 8px rgba(0,0,0,.18);">' + txt + '</div>';
  };
  var cropToCover = function (dataUrl, cb) {
    var done = false;
    var finish = function (out) { if (!done) { done = true; cb(out); } };
    try {
      var img = new Image();
      var timer = setTimeout(function () { finish(dataUrl); }, 1500);
      img.onload = function () { clearTimeout(timer); try { var cv = document.createElement('canvas'); cv.width = 300; cv.height = 450; var ctx = cv.getContext('2d'); if (!ctx) return finish(dataUrl); var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return finish(dataUrl); var sc = Math.max(300 / iw, 450 / ih); var dw = iw * sc, dh = ih * sc; ctx.drawImage(img, (300 - dw) / 2, (450 - dh) / 2, dw, dh); finish(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { finish(dataUrl); } };
      img.onerror = function () { clearTimeout(timer); finish(dataUrl); };
      img.src = dataUrl;
    } catch (e) { finish(dataUrl); }
  };

  window.BuThemes = {
    list: buThemes(), byId: byId, apply: applyThemeId, currentId: currentId, currentName: currentName,
    shellBg: shellBg, syncShellBg: syncShellBg, desktopSettingsHtml: desktopSettingsHtml,
    isDarkId: function (id) { var t = byId(id); return !!(t && t.dark); }
  };
  window.BuCovers = {
    KEY: COVER_KEY, MAX_BYTES: 2 * 1024 * 1024, BUILTINS: BUILTINS,
    get: coverGet, load: coverLoad,
    setUpload: function (bookId, dataUrl) { if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return false; if (dataUrl.length > 2800000) return false; return coverSet(bookId, { kind: 'upload', data: dataUrl, updatedAt: Date.now() }); },
    setBuiltin: function (bookId, builtinId) { if (!builtinById(builtinId)) return false; return coverSet(bookId, { kind: 'builtin', data: builtinId, updatedAt: Date.now() }); },
    clear: coverClear, frontBg: coverFrontBg, coverBoxHtml: coverBoxHtml, cropToCover: cropToCover,
    builtinById: builtinById,
    builtinName: function (id) { var b = builtinById(id); return b ? b.name : '内置封面'; },
    detailCoverHtml: function (book) { return '<div id="novel-detail-cover" style="margin-top:14px;display:flex;justify-content:center;">' + coverBoxHtml(book, 110, 165) + '</div>'; },
    paintReaderThumb: function (el, book) { if (!el || !book) return; var cov = coverFrontBg(book, book.color || '#5b7fa6'); if (cov) { el.style.background = cov.bg; el.style.color = cov.ink; el.textContent = cov.hideTitle ? '' : String(book.title || '书').slice(0, 1); } else { el.style.background = book.color || '#5b7fa6'; el.style.color = '#ffffff'; el.textContent = String(book.title || '书').slice(0, 1); } el.title = '换封面'; }
  };

  var initBu = function () {
    injectStyle();
    try { syncShellBg(); } catch (e) {}
    if (!document.__buBound) {
      document.__buBound = true;
      document.addEventListener('click', function (e) {
        var b = (e.target && e.target.closest) ? e.target.closest('[data-bu-theme]') : null;
        if (!b) return;
        var id = b.getAttribute('data-bu-theme');
        if (id) applyThemeId(id);
      });
    }
    try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (e) {}
  };
  try { initBu(); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { initBu(); } catch (e) {} });
  else setTimeout(function () { try { initBu(); } catch (e) {} }, 0);
  try { window.addEventListener('storage', function (e) { if (e && e.key === PREFS_KEY) { try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (err) {} /* GROUP-THROTTLE: 跨 tab 改 prefs 也立即失效 */ try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (err) {} try { syncShellBg(); } catch (err) {} } }); } catch (e) {}
})();
