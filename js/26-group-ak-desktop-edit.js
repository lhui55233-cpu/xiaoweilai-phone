
/* ══════════ Group AK · 桌面真实编辑（GROUP-AK-DESKTOP-EDIT）══════════
   复用：IconSystem.layout + iconsystem_v1（图标顺序）、IconInteract（长按 480ms
   进编辑态/抖动/同页拖拽排序）、ACWidgets + phone_widgets_v1（小组件商店/移动/
   改大小/移除）、设置 .st-sub 子页规范与 [data-back] 返回链。
   新增键只有 phone_desktop_removed_v1：{ v:1, removed:[appId...] }，记被从桌面
   移除的图标；IconSystem.load() 的自动补全会跳过这些 id（见 E1 补丁）。
   系统 app（电话/短信/相册/设置）不可删、只可移动。
   长按分工：图标 480ms（IconInteract 已有）→ 编辑态；空白 500ms（本模块）
   → 桌面与外观；小组件 550ms（AC 已有）→ 移动模式栏（移动/尺寸/移除/完成）。
   跨页移动走长按菜单“移到第 N 页”（拖拽跨页因两页是 translateX 分页的独立
   DOM 页、elementFromPoint 够不到隐藏页而未做，见补丁头说明）。
   与 W 组的关系（不按文件标记分模式，按锚点在不在接）：W 代码在时，“桌面图标”
   段嵌进 W 的桌面与外观页（E14），长按空白走 W 的入口（本模块检测到 W 已绑就
   让路），另修 W 的两个启动 bug——applyPrefs 在 IconSystem.init() 之前 save 会
   把已存布局覆盖回默认（E12）、openDesktopSettings 用未定义的 window.AppManager
   启动设置导致长按空白打不开（E13）；W 代码不在时 AK 自己出设置行和页面、自己
   接管长按空白。settingsIconsHTML() 是“桌面图标”管理段的独立片段。 */
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
  /* “桌面图标”管理段（独立片段，供 W 组桌面与外观页复用嵌套）。 */
  const settingsIconsHTML = () => {
    const placed = allPlacedIds();
    const rem = readRemoved();
    const IS = window.IconSystem;
    const nm = (id) => { try { return IS ? IS.getName(id) : id; } catch (e) { return id; } };
    let h = '<div class="ak-note">桌面上 ' + placed.length + ' 个图标 · 已移除 ' + rem.length + ' 个 · 系统应用（电话 / 短信 / 相册 / 设置）不可移除，只能移动。</div>';
    if (!rem.length) {
      h += '<div class="ak-note">没有已移除的图标。长按桌面图标进入编辑态，点角标上的关闭按钮即可从桌面移除，app 本身保留，随时能在这里加回来。</div>';
    } else {
      h += rem.map((id) => '<div class="ak-row"><div class="ak-row-t">' + esc(nm(id)) + '</div><button type="button" class="ak-btn" data-ak-restore="' + esc(id) + '">加回桌面</button></div>').join('');
      h += '<div class="ak-row"><div class="ak-row-t">全部已移除的图标</div><button type="button" class="ak-btn" data-ak-restore="__all">全部加回</button></div>';
    }
    return h;
  };
  const settingsWidgetsHTML = () => {
    const AC = window.ACWidgets;
    if (!AC) return '<div class="ak-note">小组件商店尚未加载。</div>';
    let placed = [];
    try { placed = (AC._state() && AC._state().placed) || []; } catch (e) { placed = []; }
    const cat = (id) => { try { const c = (AC.catalog() || []).find((x) => x.id === id); return c ? c.name : id; } catch (e) { return id; } };
    let h = '<div class="ak-row"><div class="ak-row-t">小组件商店<div class="ak-sub">挑尺寸放到桌面；桌面上长按小组件可移动、换尺寸、移除。</div></div><button type="button" class="ak-btn" data-ak-wstore="1">打开商店</button></div>';
    if (!placed.length) {
      h += '<div class="ak-note">桌面上还没有小组件。</div>';
    } else {
      h += placed.map((p) => '<div class="ak-row"><div class="ak-row-t">' + esc(cat(p.id)) + ' · ' + esc(p.size || 'M') + ' 尺寸</div><button type="button" class="ak-btn" data-ak-wsize="' + esc(p.uid) + '">换尺寸</button><button type="button" class="ak-btn danger" data-ak-wdel="' + esc(p.uid) + '">移除</button></div>').join('');
    }
    return h;
  };
  const renderDesktopSettingsHTML = () => {
    return '<div class="ak-sec-h">桌面图标</div>' + settingsIconsHTML()
      + '<div class="ak-sec-h">小组件</div>' + settingsWidgetsHTML()
      + '<div class="ak-sec-h">说明</div>'
      + '<div class="ak-note">图标顺序存在 iconsystem_v1（随拖动保存）；已移除的图标存在 phone_desktop_removed_v1；小组件存在 phone_widgets_v1。长按桌面空白处进这里；长按图标进编辑态；长按小组件弹出移动 / 换尺寸 / 移除菜单。</div>';
  };
  const openDesktopSettings = (win) => {
    try {
      let host = win || null;
      if (!host) {
        const root = document.getElementById('st-root');
        if (root && root.parentElement) host = root.parentElement;
      }
      if (!host) {
        try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('settings'); } catch (e) {}
        let tries = 0;
        const poll = setInterval(() => {
          tries++;
          const root = document.getElementById('st-root');
          if (root && root.parentElement) { clearInterval(poll); openDesktopSettings(root.parentElement); }
          else if (tries > 20) clearInterval(poll);
        }, 100);
        return false;
      }
      let sub = host.querySelector('#st-sub-ak-desktop');
      if (!sub) {
        const tmp = document.createElement('div');
        tmp.innerHTML = '<div class="st-sub" id="st-sub-ak-desktop">' + stSubBar('桌面与外观', {glyph: 'chev'}) + '<div id="ak-desk-body" style="padding:0 16px 30px"></div></div>';
        sub = tmp.firstElementChild;
        host.appendChild(sub);
        sub.addEventListener('click', (e) => {
          if (e.target.closest('[data-back]')) return;
          const re = e.target.closest('[data-ak-restore]');
          if (re) {
            e.stopPropagation();
            const id = re.getAttribute('data-ak-restore');
            if (id === '__all') restoreAll(); else restoreIcon(id);
            const body = sub.querySelector('#ak-desk-body');
            if (body) body.innerHTML = renderDesktopSettingsHTML();
            return;
          }
          const ws = e.target.closest('[data-ak-wstore]');
          if (ws) { e.stopPropagation(); if (window.ACWidgets) window.ACWidgets.openStore(); return; }
          const wd = e.target.closest('[data-ak-wdel]');
          if (wd) {
            e.stopPropagation();
            if (window.ACWidgets) window.ACWidgets.removeWidget(wd.getAttribute('data-ak-wdel'));
            const body = sub.querySelector('#ak-desk-body');
            if (body) body.innerHTML = renderDesktopSettingsHTML();
            return;
          }
          const wz = e.target.closest('[data-ak-wsize]');
          if (wz) {
            e.stopPropagation();
            const uid = wz.getAttribute('data-ak-wsize');
            const AC = window.ACWidgets;
            if (AC) {
              let cur = 'M';
              try { const p = (AC._state().placed || []).find((x) => x.uid === uid); if (p) cur = p.size || 'M'; } catch (err) {}
              const order = ['S', 'M', 'L'];
              AC.resizeWidget(uid, order[(order.indexOf(cur) + 1) % 3]);
            }
            const body = sub.querySelector('#ak-desk-body');
            if (body) body.innerHTML = renderDesktopSettingsHTML();
            return;
          }
        });
      }
      const body = sub.querySelector('#ak-desk-body');
      if (body) body.innerHTML = renderDesktopSettingsHTML();
      requestAnimationFrame(() => sub.classList.add('show'));
      return true;
    } catch (e) { return false; }
  };
  /* 长按桌面空白 → 桌面与外观。只认空白目标；图标/小组件/dock/桌宠/菜单一律不认，
     编辑态与小组件移动态下不触发；W 组已绑（gwLpBound）则让路，不绑第二套。 */
  const bindDesktopLongPress = () => {
    const layer = document.getElementById('sys-desktop-layer');
    if (!layer || layer.dataset.akLpBound) return false;
    if (layer.dataset.gwLpBound) return false;
    layer.dataset.akLpBound = '1';
    let timer = null, sx = 0, sy = 0;
    const isEmptyTarget = (t) => {
      if (!t || !t.closest) return false;
      if (t.closest('.sys-app-icon-wrapper, .sys-widget-host, .gw-pet, .gw-desk, .gw-widget, .ac-widget, #ac-dock-bar, .sys-dock-apps, .sys-page-indicator, .sys-home-indicator, .gw-widget-menu, .is-ctx-menu, .is-ctx-mask, #ak-edit-done, #desk-pet')) return false;
      return t === layer || t.classList.contains('sys-desktop-page') || t.classList.contains('sys-desktop-paging') || t.id === 'sys-widget-row' || t.id === 'gw-widget-row' || t.id === 'ac-widget-zone';
    };
    const onDown = (e) => {
      if (!isEmptyTarget(e.target)) return;
      if (window.IconInteract && window.IconInteract.isEditMode && window.IconInteract.isEditMode()) return;
      if (window.ACWidgets && window.ACWidgets.isMoving && window.ACWidgets.isMoving()) return;
      sx = e.clientX; sy = e.clientY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; openDesktopSettings(); }, LONG_PRESS_MS);
    };
    const onMove = (e) => {
      if (timer && (Math.abs(e.clientX - sx) > MOVE_CANCEL_PX || Math.abs(e.clientY - sy) > MOVE_CANCEL_PX)) { clearTimeout(timer); timer = null; }
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('pointermove', onMove);
    layer.addEventListener('pointerup', cancel);
    layer.addEventListener('pointercancel', cancel);
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
    bindDesktopLongPress();
    bindWidgetDrag();
    return true;
  };
  return {
    init: init, isSystemApp: isSystemApp, currentZone: currentZone,
    removeIcon: removeIcon, restoreIcon: restoreIcon, restoreAll: restoreAll,
    moveIconToPage: moveIconToPage, flipToPage: flipToPage,
    rebuildDesktop: rebuildDesktop, readRemoved: readRemoved,
    settingsIconsHTML: settingsIconsHTML, settingsWidgetsHTML: settingsWidgetsHTML,
    renderDesktopSettingsHTML: renderDesktopSettingsHTML,
    openDesktopSettings: openDesktopSettings,
    bindDesktopLongPress: bindDesktopLongPress, bindWidgetDrag: bindWidgetDrag,
    LONG_PRESS_MS: LONG_PRESS_MS, DRAG_THRESHOLD_PX: DRAG_THRESHOLD_PX, MOVE_CANCEL_PX: MOVE_CANCEL_PX,
    SYSTEM_APPS: SYSTEM_APPS.slice(), REMOVED_KEY: REMOVED_KEY
  };
})();
window.AKDesktop = AKDesktop;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { try { AKDesktop.init(); } catch (e) {} });
else { try { AKDesktop.init(); } catch (e) {} }
