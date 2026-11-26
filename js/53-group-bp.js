
/* GROUP-BP · 特里亚农 · 洛可可主题开关（自写；只借 Trianon 设计语言思路）
   - set('trianon'|'default')：一键切换 + 实时预览；trianon 经 GroupV 主题表
     走 phone_ui_prefs_v1.themeCustom（复用现有主题键），同时把选择存进新键
     phone_theme_trianon_v1（随整屋备份走）；切回默认时 GroupV 回到 guichao，
     并摘掉 data-phone-theme，全部 BP 规则即刻失效。
   - init：重启后按 phone_theme_trianon_v1 恢复；GroupV 主题表里直接点选
     trianon 时，MutationObserver 把 data-gv-theme 镜像为 data-phone-theme。
   - GroupV 未加载时仍可仅靠 data-phone-theme + 本键工作。 */
(function () {
  'use strict';
  var KEY = 'phone_theme_trianon_v1';
  var root = document.documentElement;
  function read() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function applyAttr(on) {
    if (on) root.setAttribute('data-phone-theme', 'trianon');
    else root.removeAttribute('data-phone-theme');
  }
  function syncFromGv() {
    var on = root.getAttribute('data-gv-theme') === 'trianon';
    applyAttr(on);
    if (on) write('trianon');
    return on;
  }
  function set(mode) {
    var on = mode === 'trianon';
    write(on ? 'trianon' : 'default');
    try {
      if (window.GroupV && window.GroupV.setTheme) window.GroupV.setTheme(on ? 'trianon' : 'guichao');
    } catch (e) {}
    applyAttr(on);
    return on ? 'trianon' : 'default';
  }
  function get() {
    if (read() === 'trianon') return 'trianon';
    if (root.getAttribute('data-gv-theme') === 'trianon') return 'trianon';
    return 'default';
  }
  function isOn() { return get() === 'trianon'; }
  function init() {
    if (read() === 'trianon') {
      try { if (window.GroupV && window.GroupV.setTheme) window.GroupV.setTheme('trianon'); } catch (e) {}
      applyAttr(true);
    } else { syncFromGv(); }
    try {
      var mo = new MutationObserver(function () { syncFromGv(); });
      mo.observe(root, { attributes: true, attributeFilter: ['data-gv-theme'] });
    } catch (e) {}
  }
  /* 解析时先按键恢复一次，避免主题闪回默认 */
  try { if (read() === 'trianon') applyAttr(true); } catch (e) {}
  window.TrianonTheme = { KEY: KEY, set: set, get: get, isOn: isOn, applyAttr: applyAttr, syncFromGv: syncFromGv, MARKER: 'GROUP-BP-TRIANON' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

