
/* ══════════ Group AK · 桌面真实编辑（GROUP-AK-DESKTOP-EDIT）══════════
   复用：IconSystem.layout + iconsystem_v1（图标顺序）、IconInteract（长按 480ms
   进编辑态/抖动/同页拖拽排序）、ACWidgets + phone_widgets_v1（小组件商店/移动/
   改大小/移除）、设置 .st-sub 子页规范与 [data-back] 返回链。
   新增键只有 phone_desktop_removed_v1：{ v:1, removed:[appId...] }，记被从桌面
   移除的图标；IconSystem.load() 的自动补全会跳过这些 id（见 E1 补丁）。
   系统 app（电话/短信/相册/设置）不可删、只可移动。
   长按分工：图标 480ms（IconInteract 已有）→ 编辑态；小组件 550ms（AC 已有）
   → 移动模式栏（移动/尺寸/移除/完成）。桌面空白长按进桌面与外观的入口已随
   桌面与外观页删除而移除（R3-STEP5a，js/00 与本模块的平行实现同批删除）。
   跨页移动走长按菜单“移到第 N 页”（拖拽跨页因两页是 translateX 分页的独立
   DOM 页、elementFromPoint 够不到隐藏页而未做，见补丁头说明）。
   与 W 组的关系：本模块只保留桌面图标的增删 / 移动 / 恢复机制（removeIcon /
   restoreIcon / restoreAll / moveIconToPage / rebuildDesktop）；桌面与外观
   设置页（E14 嵌段与本模块自出的平行页）已随 R3-STEP5a 删除，不再出设置行、
   不再接管桌面空白长按。E12/E13 的启动 bug 修已在 W 代码里，无需再动。 */
const AKDesktop = (() => {
  const REMOVED_KEY = 'phone_desktop_removed_v1';
  const SYSTEM_APPS = ['phone', 'sms', 'album', 'settings'];
  const LONG_PRESS_MS = 500;
  const DRAG_THRESHOLD_PX = 10;
  const MOVE_CANCEL_PX = 12;
  const ZONE_EL = { grid1: 'sys-grid-base', grid2: 'sys-grid-ext', dock: 'sys-dock-apps' };
  const ZONES = ['grid1', 'grid2', 'dock'];
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const readJSON = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const isSystemApp = (id) => SYSTEM_APPS.indexOf(id) >= 0;
  const readRemoved = () => {
    const d = readJSON(REMOVED_KEY, null);
    if (!d || !Array.isArray(d.removed)) return [];
    const seen = {};
    return d.removed.filter((x) => typeof x === 'string' && x && !seen[x] && (seen[x] = true));
  };
  const writeRemoved = (list) => writeJSON(REMOVED_KEY, { v: 1, removed: list.slice() });
  const layoutOf = () => (window.IconSystem && window.IconSystem.layout) || { grid1: [], grid2: [], dock: [] };
  const currentZone = (id) => {
    const L = layoutOf();
    for (let i = 0; i < ZONES.length; i++) { if (Array.isArray(L[ZONES[i]]) && L[ZONES[i]].indexOf(id) >= 0) return ZONES[i]; }
    return '';
  };
  const allPlacedIds = () => {
    const L = layoutOf(); const out = [];
    ZONES.forEach((z) => { (L[z] || []).forEach((id) => { if (out.indexOf(id) < 0) out.push(id); }); });
    return out;
  };
  const markSystemBadges = () => {
    document.querySelectorAll('.sys-app-icon-wrapper').forEach((w) => {
      w.classList.toggle('ak-system', isSystemApp(w.getAttribute('data-target-app')));
    });
  };
  /* 与 DesktopEngine.buildFromIconSystem 同构重建三区图标（布局已变时用，
     如删除/恢复/跨页移动后）；角标一并补上，系统 app 打 ak-system 标记。 */
  const rebuildDesktop = () => {
    if (typeof window.IconSystem === 'undefined') return false;
    const IS = window.IconSystem;
    let ok = true;
    ZONES.forEach((zone) => {
      const box = document.getElementById(ZONE_EL[zone]);
      if (!box) { ok = false; return; }
      const ids = Array.isArray(IS.layout[zone]) ? IS.layout[zone] : [];
      box.innerHTML = ids.map((id) => {
        let inner = '', name = id;
        try { inner = IS.renderIconInner(id); } catch (e) {}
        try { name = IS.getName(id); } catch (e) {}
        return '<div class="sys-app-icon-wrapper" data-target-app="' + esc(id) + '">'
          + '<div class="sys-app-icon" id="sys-icon-dyn-' + esc(id) + '">' + inner + '</div>'
          + '<div class="sys-app-name">' + esc(name) + '</div>'
          + '<div class="is-badge"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></div></div>';
      }).join('');
    });
    markSystemBadges();
    try { IS.repaintAll(); } catch (e) {}
    return ok;
  };
  const removeIcon = (id) => {
    if (!id || isSystemApp(id)) return false;
    if (typeof window.IconSystem === 'undefined') return false;
    const IS = window.IconSystem;
    ZONES.forEach((z) => {
      const arr = Array.isArray(IS.layout[z]) ? IS.layout[z] : [];
      if (arr.indexOf(id) >= 0) IS.updateLayout(z, arr.filter((x) => x !== id));
    });
    const rem = readRemoved();
    if (rem.indexOf(id) < 0) { rem.push(id); writeRemoved(rem); }
    rebuildDesktop();
    return true;
  };
  const restoreIcon = (id) => {
    if (!id || typeof window.IconSystem === 'undefined') return false;
    writeRemoved(readRemoved().filter((x) => x !== id));
    const IS = window.IconSystem;
    if (!currentZone(id)) {
      const g1 = Array.isArray(IS.layout.grid1) ? IS.layout.grid1.slice() : [];
      g1.push(id);
      IS.updateLayout('grid1', g1);
    }
    rebuildDesktop();
    return true;
  };
  const restoreAll = () => {
    const rem = readRemoved();
    if (!rem.length) return 0;
    writeRemoved([]);
    const IS = window.IconSystem;
    if (IS) {
      const g1 = Array.isArray(IS.layout.grid1) ? IS.layout.grid1.slice() : [];
      rem.forEach((id) => { if (!currentZone(id) && g1.indexOf(id) < 0) g1.push(id); });
      IS.updateLayout('grid1', g1);
    }
    rebuildDesktop();
    return rem.length;
  };
  const flipToPage = (n) => {
    const paging = document.getElementById('sys-desktop-paging');
    if (paging) paging.style.transform = n ? 'translateX(-50%)' : 'translateX(0%)';
    document.querySelectorAll('#sys-page-dots .sys-dot').forEach((d, i) => d.classList.toggle('sys-active', i === n));
    return n;
  };
  const moveIconToPage = (id) => {
    if (!id || typeof window.IconSystem === 'undefined') return false;
    const IS = window.IconSystem;
    const zone = currentZone(id);
    if (zone !== 'grid1' && zone !== 'grid2') return false;
    const other = zone === 'grid1' ? 'grid2' : 'grid1';
    IS.updateLayout(zone, IS.layout[zone].filter((x) => x !== id));
    const dest = (IS.layout[other] || []).slice();
    dest.push(id);
    IS.updateLayout(other, dest);
    rebuildDesktop();
    flipToPage(other === 'grid2' ? 1 : 0);
    return true;
  };
  /* 小组件移动模式下指针拖动换位（>40px 换一位，可连续换）。只在 AC 移动态下
     生效，不碰按钮/输入框/角拖拽柄/就地编辑面板；与 AC 的长按进移动态不冲突。 */
  const bindWidgetDrag = () => {
    const zone = document.getElementById('ac-widget-zone');
    if (!zone || zone.dataset.akDragBound) return false;
    zone.dataset.akDragBound = '1';
    let drag = null;
    const onDown = (e) => {
      if (drag) return;
      const AC = window.ACWidgets;
      if (!AC || !AC.isMoving || !AC.isMoving()) return;
      if (e.target.closest('button, input, [data-ac-resize], [data-ac-edit], .ac-w-edit')) return;
      const card = e.target.closest('.ac-widget');
      if (!card || !card.getAttribute('data-ac-uid')) return;
      drag = { uid: card.getAttribute('data-ac-uid'), startX: e.clientX };
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      if (Math.abs(dx) > 40) {
        const AC = window.ACWidgets;
        if (AC && AC.moveWidget) AC.moveWidget(drag.uid, dx > 0 ? 1 : -1);
        drag.startX = e.clientX;
      }
    };
    const onUp = () => { drag = null; };
    zone.addEventListener('pointerdown', onDown);
    zone.addEventListener('mousedown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('mouseup', onUp);
    return true;
  };
  const injectCSS = () => {
    if (document.getElementById('ak-desktop-css')) return;
    const s = document.createElement('style');
    s.id = 'ak-desktop-css';
    s.textContent = [
      '#ak-edit-done{ display:none; position:fixed; top:calc(12px + env(safe-area-inset-top, 0px)); right:16px; z-index:99990; min-width:64px; padding:8px 16px; border:0; border-radius:999px; background:rgba(37,38,42,.92); color:#fff; font-size:15px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,.25); cursor:pointer; }',
      '#ak-edit-done:active{ transform:scale(.96); }',
      '#sys-shell.is-edit-mode .sys-app-icon-wrapper.ak-system .is-badge{ display:none !important; }',
      '.sys-app-icon-wrapper.is-drop-target .sys-app-icon{ outline:2.5px solid #007AFF; outline-offset:3px; }',
      '.sys-app-icon-wrapper.is-drop-target{ position:relative; z-index:5; }',
      '.ac-w-move [data-ac-remove]{ color:#ff3b30; }',
      '.ak-sec-h{ font-size:13px; font-weight:700; color:#6d6d72; margin:22px 2px 8px; }',
      '.ak-note{ font-size:13px; color:#666; line-height:1.7; margin:6px 2px; }',
      '.ak-row{ display:flex; align-items:center; gap:10px; background:#fff; border-radius:12px; padding:11px 12px; margin-bottom:8px; }',
      '.ak-row-t{ flex:1; font-size:15px; color:#1c1c1e; min-width:0; }',
      '.ak-sub{ font-size:12px; color:#8e8e93; margin-top:2px; line-height:1.5; }',
      '.ak-btn{ border:1px solid #e5e5ea; background:#f7f7f8; border-radius:9px; padding:7px 12px; font-size:13px; color:#007AFF; cursor:pointer; white-space:nowrap; }',
      '.ak-btn.danger{ color:#ff3b30; }',
      '.ak-btn:active{ opacity:.6; }'
    ].join('\n');
    document.head.appendChild(s);
  };
  let doneBtn = null;
  const syncDoneBtn = () => {
    if (!doneBtn) return;
    const shell = document.getElementById('sys-shell');
    doneBtn.style.display = (shell && shell.classList.contains('is-edit-mode')) ? 'block' : 'none';
  };
  const createDoneBtn = () => {
    if (document.getElementById('ak-edit-done')) { doneBtn = document.getElementById('ak-edit-done'); syncDoneBtn(); return; }
    const b = document.createElement('button');
    b.id = 'ak-edit-done'; b.type = 'button'; b.textContent = '完成';
    b.style.display = 'none';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { if (window.IconInteract && window.IconInteract.exitEdit) window.IconInteract.exitEdit(); } catch (err) {}
      syncDoneBtn();
    });
    document.body.appendChild(b);
    doneBtn = b;
    try {
      const shell = document.getElementById('sys-shell');
      if (shell && window.MutationObserver) {
        const ob = new MutationObserver(() => syncDoneBtn());
        ob.observe(shell, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (e) {}
    syncDoneBtn();
  };
  let inited = false, tries = 0;
  const init = () => {
    if (inited) return true;
    if (typeof window.IconSystem === 'undefined' || !document.getElementById('sys-desktop-layer')) {
      tries++;
      if (tries <= 50) setTimeout(init, 100);
      return false;
    }
    inited = true;
    injectCSS();
    markSystemBadges();
    createDoneBtn();
    bindWidgetDrag();
    return true;
  };
  return {
    init: init, isSystemApp: isSystemApp, currentZone: currentZone,
    removeIcon: removeIcon, restoreIcon: restoreIcon, restoreAll: restoreAll,
    moveIconToPage: moveIconToPage, flipToPage: flipToPage,
    rebuildDesktop: rebuildDesktop, readRemoved: readRemoved,
    bindWidgetDrag: bindWidgetDrag,
    LONG_PRESS_MS: LONG_PRESS_MS, DRAG_THRESHOLD_PX: DRAG_THRESHOLD_PX, MOVE_CANCEL_PX: MOVE_CANCEL_PX,
    SYSTEM_APPS: SYSTEM_APPS.slice(), REMOVED_KEY: REMOVED_KEY
  };
})();
window.AKDesktop = AKDesktop;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { try { AKDesktop.init(); } catch (e) {} });
else { try { AKDesktop.init(); } catch (e) {} }
