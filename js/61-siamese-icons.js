/* Xiaoweilai Phone · Siamese pixel icon pack
 * Pure-code original SVG. No external images, fonts, or network assets.
 * Integration: load after js/60-group-fish-wallpaper.js.
 * Only default IconSystem icons are replaced; custom image/color overrides remain authoritative.
 */
(function (w, d) {
  'use strict';

  var PACK_ID = 'xwl-siamese-pixel-v1';
  var PATCHED = '__xwlSiamesePatched';
  var CAT_FACE = '<path d="M9 12h2v2H9zM13 12h2v2h-2zM11 15h2v1h-2z" fill="#2a2028"/><path d="M11 15h2v1h-2z" fill="#eaa0aa"/><path d="M10 17h4v1h-4z" fill="none" stroke="#2a2028" stroke-width="1"/>';

  var APP = {
    wechat:     { bg:'#79c99b', accent:'#f8fff2', item:'bubble' },
    worldbook:  { bg:'#6db7d6', accent:'#fff0ad', item:'globe' },
    novel:      { bg:'#d59b73', accent:'#fff5db', item:'book' },
    cike:       { bg:'#d88398', accent:'#fff0f3', item:'heart' },
    guichao:    { bg:'#b88c61', accent:'#fff0c7', item:'home' },
    nobeidanci: { bg:'#e1b84c', accent:'#fff9dc', item:'pencil' },
    weibo:      { bg:'#db7181', accent:'#fff1d6', item:'eye' },
    forum:      { bg:'#9d7bc5', accent:'#f8e9ff', item:'chat' },
    TarotDivine:{ bg:'#ad82cc', accent:'#ffe89b', item:'star' },
    weather:    { bg:'#64add7', accent:'#fff6c8', item:'sun' },
    memo:       { bg:'#d4b648', accent:'#fff9df', item:'note' },
    script:     { bg:'#b38b5a', accent:'#ffe8ac', item:'film' },
    cinema:     { bg:'#57577f', accent:'#e7dcff', item:'play' },
    phone:      { bg:'#6ec687', accent:'#f8fff0', item:'phone' },
    sms:        { bg:'#70b9de', accent:'#f8ffff', item:'bubble' },
    album:      { bg:'#df8fb0', accent:'#fff7df', item:'photo' },
    settings:   { bg:'#96969e', accent:'#f5f5f5', item:'gear' },
    music:      { bg:'#d987a2', accent:'#fff1bd', item:'music' },
    catos:      { bg:'#e4ae75', accent:'#fff5dc', item:'heart' }
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function itemGlyph(kind, fg) {
    var s = fg || '#fff7d6';
    var common = 'fill="none" stroke="' + s + '" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="miter"';
    switch (kind) {
      case 'bubble': return '<path d="M5 7h14v8H10l-4 3v-3H5z" ' + common + '/><path d="M8 10h1M11 10h1M14 10h1" ' + common + '/>';
      case 'globe': return '<circle cx="12" cy="12" r="7" ' + common + '/><path d="M5 12h14M12 5c2 2 2 12 0 14M12 5c-2 2-2 12 0 14" ' + common + '/>';
      case 'book': return '<path d="M5 5h5c1.2 0 2 .8 2 2v11c0-1.2-.8-2-2-2H5zM19 5h-5c-1.2 0-2 .8-2 2v11c0-1.2.8-2 2-2h5z" ' + common + '/>';
      case 'heart': return '<path d="M12 18l-6-6c-3-4 2-7 6-3 4-4 9-1 6 3z" fill="' + s + '" stroke="none"/>';
      case 'home': return '<path d="M5 11l7-6 7 6v7H5z" ' + common + '/><path d="M10 18v-4h4v4" ' + common + '/>';
      case 'pencil': return '<path d="M7 17l1-3 7-7 2 2-7 7zM15 7l2 2" ' + common + '/><path d="M6 19h5" ' + common + '/>';
      case 'eye': return '<path d="M4 12s3-4 8-4 8 4 8 4-3 4-8 4-8-4-8-4z" ' + common + '/><circle cx="12" cy="12" r="2" ' + common + '/>';
      case 'chat': return '<path d="M5 6h14v8H9l-4 3z" ' + common + '/><path d="M8 9h8M8 12h5" ' + common + '/>';
      case 'star': return '<path d="M12 5l2 4 4 .5-3 3 1 4.5-4-2.2-4 2.2 1-4.5-3-3 4-.5z" fill="' + s + '" stroke="none"/>';
      case 'sun': return '<circle cx="12" cy="12" r="3" fill="' + s + '"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" ' + common + '/>';
      case 'note': return '<path d="M7 4h8l3 3v13H7zM15 4v4h3M9 12h6M9 15h5" ' + common + '/>';
      case 'film': return '<rect x="5" y="6" width="14" height="12" ' + common + '/><path d="M8 6v12M16 6v12M5 9h3M16 9h3M5 15h3M16 15h3" ' + common + '/>';
      case 'play': return '<path d="M9 7l7 5-7 5z" fill="' + s + '" stroke="none"/>';
      case 'phone': return '<path d="M8 6l2 3-2 2c1 2 2 3 4 4l2-2 3 2v3c-5 1-10-4-9-12z" ' + common + '/>';
      case 'photo': return '<rect x="5" y="6" width="14" height="12" ' + common + '/><circle cx="9" cy="10" r="1" fill="' + s + '"/><path d="M6 16l4-4 3 3 2-2 3 3" ' + common + '/>';
      case 'gear': return '<circle cx="12" cy="12" r="3" ' + common + '/><path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.5 1.5M15.5 15.5L17 17M17 7l-1.5 1.5M8.5 15.5L7 17" ' + common + '/>';
      case 'music': return '<path d="M15 7v8M15 7l4-1v7M15 15c0 2-5 2-5 0s5-2 5 0M19 13c0 2-4 2-4 0" ' + common + '/>';
      default: return '<path d="M8 9h8v7H8z" ' + common + '/>';
    }
  }

  function catSvg(appId) {
    var meta = APP[appId] || { bg:'#a78b72', accent:'#fff1c4', item:'star' };
    var fg = meta.accent;
    var accessory = '';
    if (meta.item === 'sun') accessory = '<path d="M4 18h5M15 18h5" stroke="#fff8d0" stroke-width="1"/>';
    if (meta.item === 'book' || meta.item === 'note') accessory = '<path d="M4 20h16" stroke="#2a2028" stroke-width="1"/>';
    if (meta.item === 'music') accessory = '<path d="M4 6h3M17 6h3" stroke="#fff0bd" stroke-width="1"/>';
    return '<svg class="xwl-siamese-svg" viewBox="0 0 24 24" role="img" aria-label="像素暹罗猫图标" shape-rendering="crispEdges">' +
      '<rect width="24" height="24" rx="4" fill="' + esc(meta.bg) + '"/>' +
      '<path d="M2 19h20v3H2z" fill="#3b2e3b" opacity=".22"/>' +
      '<path d="M5 8L4 3l4 2 4-2 4 2 4-2-1 5v6c0 4-3 7-7 7s-7-3-7-7z" fill="#f6d8c5" stroke="#2a2028" stroke-width=".8"/>' +
      '<path d="M5 8L4 3l4 2-2 4zM19 8l1-5-4 2 2 4z" fill="#7b5260"/>' +
      '<path d="M6 8h4v7H6zM14 8h4v7h-4z" fill="#7b5260" opacity=".9"/>' +
      '<path d="M5 17h14v3H5z" fill="#f6d8c5"/>' + CAT_FACE +
      '<path d="M6 15H2M6 17H3M18 15h4M18 17h3" stroke="#2a2028" stroke-width=".55"/>' +
      '<path d="M8 20h3v2H8zM13 20h3v2h-3z" fill="#7b5260"/>' +
      '<g transform="translate(14 1) scale(.38)">' + itemGlyph(meta.item, fg) + '</g>' + accessory +
      '</svg>';
  }

  function install(IS) {
    if (!IS) return false;
    if (IS[PATCHED]) return true;
    var original = IS.renderIconInner;
    if (typeof original !== 'function') return false;
    var old = original;
    function active(appId) {
      var custom = IS.custom && IS.custom[appId];
      if (custom && (custom.img || custom.color)) return false;
      var prefs = {};
      try { prefs = JSON.parse(w.localStorage.getItem('phone_ui_prefs_v1') || '{}') || {}; } catch (e) {}
      if (prefs.iconStyle && prefs.iconStyle !== 'default') return false;
      if (IS.cfg && ((IS.cfg.iconStyle && IS.cfg.iconStyle !== 'line' && IS.cfg.iconStyle !== 'jelly') ||
          (IS.cfg.colorId && IS.cfg.colorId !== 'mint'))) return false;
      return !!APP[appId];
    }
    IS.renderIconInner = function (appId) {
      if (!active(appId)) return old.call(IS, appId);
      return catSvg(appId);
    };
    /* The original repaintAll closes over its private renderer. Run it first,
       then update just its inner content through the public, patched renderer. */
    var repaint = IS.repaintAll;
    IS.repaintAll = function () {
      var result = repaint.apply(IS, arguments);
      d.querySelectorAll('.sys-app-icon-wrapper[data-target-app]').forEach(function (wrap) {
        var icon = wrap.querySelector('.sys-app-icon');
        if (icon) {
          delete icon.dataset.fix2Sig;
          icon.innerHTML = IS.renderIconInner(wrap.getAttribute('data-target-app'));
        }
      });
      return result;
    };
    IS[PATCHED] = true;
    IS.siameseIcons = { id: PACK_ID, apps: Object.keys(APP), render: catSvg, isActive: active };
    try { IS.repaintAll(); } catch (e) {}
    return true;
  }

  function boot() {
    if (install(w.IconSystem)) return;
    if (w.setTimeout) w.setTimeout(boot, 80);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
