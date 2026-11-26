/* 简约手绘图标：默认桌面使用统一线稿；用户自己的图与配色仍优先。 */
(function (w, d) {
  'use strict';
  var PATHS = {
    wechat: '<path d="M9 13.5c0-3.6 3-6.3 7.1-6.3s7.1 2.7 7.1 6.3-3 6.2-7.1 6.2c-.9 0-1.8-.1-2.6-.4l-3.2 1.6.7-2.9A5.7 5.7 0 0 1 9 13.5Z"/><path d="M13 13.4h.1m5.7 0h.1"/>',
    worldbook: '<circle cx="16" cy="16" r="9.3"/><path d="M6.8 16h18.4M16 6.7c-3.3 3.5-3.8 14.4 0 18.6M16 6.7c3.3 3.5 3.8 14.4 0 18.6M8.5 11.6c4.7 1.8 10.3 1.8 15 0M8.5 20.4c4.7-1.8 10.3-1.8 15 0"/>',
    novel: '<path d="M5.6 8.1c4.1-1.1 7.7-.4 10.4 2.1 2.6-2.5 6.3-3.2 10.4-2.1v15c-4.2-1-7.8-.3-10.4 2.1-2.8-2.4-6.3-3.1-10.4-2.1Z"/><path d="M16 10.2v15M8.8 12c1.7-.2 3.2.1 4.4.8m5.6 0a8 8 0 0 1 4.5-.8"/>',
    cike: '<path d="M16 25s-9.8-5.8-9.8-12.2c0-4.3 5.3-6.1 9.8-1.4 4.4-4.7 9.8-2.9 9.8 1.4C25.8 19.2 16 25 16 25Z"/><path d="M23.8 7.6v-2m-1 1h2"/>',
    guichao: '<path d="M5.8 14.3 16 6.5l10.2 7.8M8.2 13.3v11.4h15.6V13.3M13.3 24.7v-6.8h5.4v6.8"/><path d="M22 7.2h2.5v4"/>',
    nobeidanci: '<path d="m9 22.6 1-4.3 10.8-10.8c1.8-1.8 4.5.9 2.8 2.8L12.9 21.1 9 22.6ZM19.2 9.2l4 4M7.8 25h15.8"/>',
    weibo: '<path d="M25 18c0 4-4.2 7-9.4 7s-9.2-2.5-9.2-6.1c0-3.2 3.8-6.4 7.1-7.2 1.8-.4 2.4.3 2 1.8 1.8-.8 4.3-1 4.5.8.1.5-.2 1-.4 1.4 3-.2 5.4.7 5.4 2.3Z"/><ellipse cx="15.3" cy="19.1" rx="3.6" ry="2.6"/><path d="M21.7 8.5c2 .2 3.5 1.7 3.8 3.7m-4-6.5a8 8 0 0 1 6.5 6.5"/>',
    forum: '<path d="M6.3 8.1h14.4a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H12l-4.2 3v-3H6.3a2 2 0 0 1-2-2v-8.8a2 2 0 0 1 2-2Z"/><path d="M10 12.4h7.8M10 16h5.4M22.7 12.1h2.7a2 2 0 0 1 2 2v8.3h-2.2v2.4l-3.2-2.4"/>',
    TarotDivine: '<path d="M8 6.1h16v20H8zM16 10l1.1 3.4 3.4 1.1-3.4 1.1L16 19l-1.1-3.4-3.4-1.1 3.4-1.1ZM11 22h10"/>',
    weather: '<path d="M10.6 23.4h12a4.4 4.4 0 0 0 .1-8.8 6.7 6.7 0 0 0-12.8 1.1 3.9 3.9 0 0 0 .7 7.7ZM10.5 10.8a4.5 4.5 0 0 1 5.9-3.3M8.5 6.3l1 1.3M5.5 11h1.7M16 5v1.5"/>',
    memo: '<path d="M9 6.8h10.2l4 4v14.5H9zM19.2 6.8v4.1h4M12.4 15h7.8M12.4 18.7h7.8M12.4 22.3h4.6"/>',
    script: '<path d="M7 8h18v16H7zM7 12h18M11.5 8l2.5 4M19 8l2.5 4M12.7 17h6.6M12.7 20h4.3"/>',
    cinema: '<path d="M7.2 8h17.6v16H7.2zM10.4 8v16M21.6 8v16M7.2 12h3.2m11.2 0h3.2M7.2 20h3.2m11.2 0h3.2M14.1 13.3v5.4l4.7-2.7z"/>',
    phone: '<path d="M10 7.3 13 11l-1.9 2.5a17 17 0 0 0 7.4 7.3l2.5-1.9 3.7 3c.5.4.6 1.2.1 1.7-1.1 1.3-2.7 1.7-4.5 1.1C13.9 22.4 9.6 18.2 7.2 11.8c-.6-1.8-.2-3.4 1.1-4.5.5-.5 1.3-.4 1.7 0Z"/>',
    sms: '<rect x="5.7" y="9" width="20.6" height="14.3" rx="2.2"/><path d="m6.4 10.2 9.6 7 9.6-7"/>',
    album: '<path d="M7 7h18v18H7zM9.2 21l5.1-5 3.7 3.5 2.5-2.4 2.7 3.9"/><circle cx="19.7" cy="12.2" r="1.6"/>',
    settings: '<path d="M16 6.5v2.2m0 14.6v2.2M6.5 16h2.2m14.6 0h2.2M9.3 9.3l1.6 1.6m10.2 10.2 1.6 1.6m0-13.4-1.6 1.6M10.9 21.1l-1.6 1.6"/><circle cx="16" cy="16" r="6.2"/><circle cx="16" cy="16" r="2.5"/>',
    music: '<path d="M20.3 21.1V8.3l-8 1.9v12.2M20.3 12l-8 1.9"/><ellipse cx="9.9" cy="22.2" rx="2.5" ry="1.7"/><ellipse cx="17.9" cy="21" rx="2.5" ry="1.7"/>',
    pomodoro: '<path d="M16 10.3c-5.3-2.3-9.4 1.4-9.4 6.8 0 6 3.8 9.4 9.4 9.4s9.4-3.4 9.4-9.4c0-5.4-4.1-9.1-9.4-6.8Z"/><path d="M16 10.6c-.5-2.9-2.5-4.7-5.4-4.8.9 3 2.8 4.6 5.4 4.8Zm0 0c1.5-2.9 3.9-4.1 6.7-3.8-1 2.7-3.3 4.1-6.7 3.8ZM16 10.8v3"/><path d="M10.6 18.4c1.1-.7 2.3-.7 3.4-.1m7.4.1c-1.1-.7-2.3-.7-3.4-.1" stroke-width="1.1"/>',
    catos: '<path d="M7.7 14.1 7.3 8c0-.5.3-.7.8-.5l4.2 2.4a13 13 0 0 1 7.4 0l4.2-2.4c.5-.2.8 0 .8.5l-.4 6.1a7.7 7.7 0 0 1 .4 7.1c-1.4 2.6-4.5 4-8.7 4s-7.3-1.4-8.7-4a7.7 7.7 0 0 1 .4-7.1Z"/><path d="m9.5 10.3 1.8 1.1m11.2-1.1-1.8 1.1M12.3 16.3h.1m7.2 0h.1"/><path d="M15.3 18.2h1.4l-.7.8z" fill="#40565a" stroke-width=".8"/><path d="M16 19v.8c-.5 1.2-1.6 1.4-2.5.7m2.5-.7c.5 1.2 1.6 1.4 2.5.7M8.5 18.5l-2.2-.4m2.4 2.3-2.1.3m16.9-2.2 2.2-.4m-2.4 2.3 2.1.3" stroke-width="1.05"/>'
  };
  function icon(id) {
    return '<svg class="xwl-handdrawn-svg" viewBox="0 0 64 64" aria-hidden="true"><rect x="1.1" y="1.1" width="61.8" height="61.8" rx="16" fill="rgba(253,254,252,.84)" stroke="rgba(91,112,116,.48)" stroke-width="1.2"/><g transform="translate(7 7) scale(1.56)" fill="none" stroke="#40565a" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[id] || '<path d="M16 7l2.4 6.4L25 16l-6.6 2.4L16 25l-2.4-6.6L7 16l6.6-2.6Z"/>') + '</g></svg>';
  }
  function install(IS) {
    if (!IS || typeof IS.renderIconInner !== 'function') return false;
    if (IS.__xwlHanddrawnPatched) return true;
    var old = IS.renderIconInner, repaint = IS.repaintAll;
    function active(id) {
      var c = IS.custom && IS.custom[id];
      if (c && (c.img || c.color)) return false;
      var p = {}; try { p = JSON.parse(w.localStorage.getItem('phone_ui_prefs_v1') || '{}') || {}; } catch (_) {}
      if (p.iconStyle && p.iconStyle !== 'default') return false;
      if (IS.cfg && ((IS.cfg.iconStyle && IS.cfg.iconStyle !== 'line' && IS.cfg.iconStyle !== 'jelly') || (IS.cfg.colorId && IS.cfg.colorId !== 'mint'))) return false;
      return !!(IS.ASSETS && IS.ASSETS[id]);
    }
    IS.renderIconInner = function (id) { return active(id) ? icon(id) : old.call(IS, id); };
    IS.repaintAll = function () {
      var result = repaint.apply(IS, arguments);
      d.querySelectorAll('.sys-app-icon-wrapper[data-target-app]').forEach(function (wrap) {
        var node = wrap.querySelector('.sys-app-icon');
        if (node) { delete node.dataset.fix2Sig; node.innerHTML = IS.renderIconInner(wrap.getAttribute('data-target-app')); }
      });
      return result;
    };
    IS.__xwlHanddrawnPatched = true;
    IS.handdrawnIcons = { render: icon, isActive: active, apps: Object.keys(PATHS) };
    try { IS.repaintAll(); } catch (_) {}
    return true;
  }
  function boot() { if (!install(w.IconSystem)) w.setTimeout(boot, 100); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window, document);
