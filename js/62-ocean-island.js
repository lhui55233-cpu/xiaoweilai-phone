/* [OCEAN-ISLAND] 纯手绘 SVG + CSS 交互沙盘
 * 接入：主代理只需在 index.html 末尾加载本文件与 css/34-ocean-island.css。
 * 不依赖外部图片；所有节点与事件均带 xwl-ocean-island 前缀，避免碰撞现有手机系统。
 */
(function () {
  'use strict';
  if (window.__xwlOceanIslandLoaded) return;
  window.__xwlOceanIslandLoaded = true;

  var LANDMARKS = [
    { id: 'lighthouse', name: '雾灯塔', note: '给晚归的小船留一盏灯' },
    { id: 'cat-house', name: '猫咪小屋', note: '岛上最软的一块云' },
    { id: 'shell', name: '贝壳湾', note: '潮声会把心事带回来' },
    { id: 'windmill', name: '风车丘', note: '风经过时会轻轻转动' },
    { id: 'ice-arch', name: '冰蓝拱门', note: '通往安静海面的入口' },
    { id: 'star-pool', name: '星星潮池', note: '收集一点点夜光' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function createSvg() {
    return '<svg class="xwl-ocean-island__svg" viewBox="0 0 800 600" role="img" aria-labelledby="xwl-ocean-island-title xwl-ocean-island-desc">' +
      '<title id="xwl-ocean-island-title">猫咪小岛 · 海洋沙盘</title>' +
      '<desc id="xwl-ocean-island-desc">柔和冰蓝海面上的六个手绘立体地标。点击或触摸地标查看岛屿小记。</desc>' +
      '<defs>' +
        '<linearGradient id="xwl-ocean-water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaf9fb"/><stop offset="1" stop-color="#a9dbe7"/></linearGradient>' +
        '<linearGradient id="xwl-ocean-sand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#cce8e8"/></linearGradient>' +
        '<linearGradient id="xwl-ocean-ice" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#f8ffff"/><stop offset="1" stop-color="#8fc8da"/></linearGradient>' +
        '<filter id="xwl-ocean-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="7"/></filter>' +
        '<filter id="xwl-ocean-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>' +
      '</defs>' +
      '<g class="xwl-ocean-island__layer xwl-ocean-island__layer--base">' +
        '<path class="xwl-ocean-island__water" d="M72 333C89 227 220 140 378 126c177-16 324 57 354 159 29 98-77 206-240 238-174 34-389-4-420-111-8-27-8-53 0-79Z"/>' +
        '<path class="xwl-ocean-island__water-line" d="M117 305c68-88 204-131 359-115m-383 171c102-63 245-80 425-38m-389 94c89-38 223-38 367-7"/>' +
        '<ellipse class="xwl-ocean-island__island-shadow" cx="400" cy="375" rx="263" ry="108"/>' +
        '<path class="xwl-ocean-island__island" d="M169 355c22-65 105-107 211-108 111-2 221 28 251 93 26 56-43 107-151 128-115 23-269 5-306-48-9-14-10-39-5-65Z"/>' +
        '<path class="xwl-ocean-island__island-edge" d="M180 401c74 48 236 61 363 13 51-19 80-45 84-68"/>' +
      '</g>' +
      '<g class="xwl-ocean-island__layer xwl-ocean-island__layer--details" aria-hidden="true">' +
        '<path class="xwl-ocean-island__wave" d="M107 261q22-16 44 0m467-22q22-16 44 0M92 475q22-16 44 0m518-26q22-16 44 0"/>' +
        '<circle class="xwl-ocean-island__bubble" cx="143" cy="340" r="4"/><circle class="xwl-ocean-island__bubble" cx="648" cy="351" r="3"/><circle class="xwl-ocean-island__bubble" cx="582" cy="206" r="5"/>' +
      '</g>' +
      '<g class="xwl-ocean-island__layer xwl-ocean-island__layer--landmarks">' +
        '<g class="xwl-ocean-island__landmark" data-island-id="lighthouse" tabindex="0" role="button" aria-label="雾灯塔：给晚归的小船留一盏灯"><ellipse class="xwl-ocean-island__landmark-shadow" cx="273" cy="326" rx="50" ry="14"/><path class="xwl-ocean-island__side" d="M244 253h44v70l-44 12Z"/><path class="xwl-ocean-island__face" d="M244 253l31-13 28 13-31 14Z"/><path class="xwl-ocean-island__cap" d="M238 240l37-16 36 16-37 16Z"/><path class="xwl-ocean-island__stripe" d="M244 270l44 10v12l-44-10Z"/><path class="xwl-ocean-island__glow" d="M275 224l-17-19 18 8 18-17-10 25Z"/></g>' +
        '<g class="xwl-ocean-island__landmark" data-island-id="cat-house" tabindex="0" role="button" aria-label="猫咪小屋：岛上最软的一块云"><ellipse class="xwl-ocean-island__landmark-shadow" cx="416" cy="361" rx="62" ry="16"/><path class="xwl-ocean-island__side" d="M374 291l40-18 47 17v60l-44 16-43-18Z"/><path class="xwl-ocean-island__face" d="M374 291l39-22 48 21-40 21Z"/><path class="xwl-ocean-island__roof" d="M369 271l44-27 54 24-6 22-48-21-40 22Z"/><path class="xwl-ocean-island__door" d="M405 320q12-9 23 0v28h-23Z"/><path class="xwl-ocean-island__cat-ear" d="M421 283l7-14 10 14m-1 0 9-13 8 17"/></g>' +
        '<g class="xwl-ocean-island__landmark" data-island-id="shell" tabindex="0" role="button" aria-label="贝壳湾：潮声会把心事带回来"><ellipse class="xwl-ocean-island__landmark-shadow" cx="551" cy="408" rx="63" ry="15"/><path class="xwl-ocean-island__side" d="M512 374q40-25 79 0v27q-40 23-79 0Z"/><path class="xwl-ocean-island__shell" d="M512 375q5-57 39-66 37 9 40 66-38 24-79 0Z"/><path class="xwl-ocean-island__shell-line" d="M551 311v67m-23-57 23 57m25-49-25 49"/></g>' +
        '<g class="xwl-ocean-island__landmark" data-island-id="windmill" tabindex="0" role="button" aria-label="风车丘：风经过时会轻轻转动"><ellipse class="xwl-ocean-island__landmark-shadow" cx="327" cy="422" rx="49" ry="13"/><path class="xwl-ocean-island__side" d="M311 332h31v79l-31 9Z"/><path class="xwl-ocean-island__face" d="M311 332l17-10 14 10-17 11Z"/><path class="xwl-ocean-island__hub" d="M328 324v-36m0 36-28-17m28 17 28-17"/><circle class="xwl-ocean-island__hub-dot" cx="328" cy="324" r="6"/></g>' +
        '<g class="xwl-ocean-island__landmark" data-island-id="ice-arch" tabindex="0" role="button" aria-label="冰蓝拱门：通往安静海面的入口"><ellipse class="xwl-ocean-island__landmark-shadow" cx="459" cy="441" rx="57" ry="13"/><path class="xwl-ocean-island__arch" d="M426 415v-54q1-25 31-25t32 25v54h-17v-51q0-12-15-12t-15 12v51Z"/><path class="xwl-ocean-island__arch-side" d="M474 336q15 5 15 24v55l-17 7v-54q0-12-15-12Z"/></g>' +
        '<g class="xwl-ocean-island__landmark" data-island-id="star-pool" tabindex="0" role="button" aria-label="星星潮池：收集一点点夜光"><ellipse class="xwl-ocean-island__landmark-shadow" cx="626" cy="369" rx="47" ry="11"/><path class="xwl-ocean-island__pool" d="M581 348q45-27 91 0v21q-44 27-91 0Z"/><path class="xwl-ocean-island__star" d="M626 329l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z"/></g>' +
      '</g>' +
      '<g class="xwl-ocean-island__layer xwl-ocean-island__layer--animation" aria-hidden="true"><circle class="xwl-ocean-island__dust" cx="206" cy="280" r="3"/><circle class="xwl-ocean-island__dust" cx="372" cy="211" r="2"/><circle class="xwl-ocean-island__dust" cx="595" cy="282" r="3"/><circle class="xwl-ocean-island__dust" cx="513" cy="469" r="2"/><path class="xwl-ocean-island__light-ray" d="M97 113l155 104M145 94l142 119M74 164l184 75"/></g>' +
      '</svg>';
  }

  function mount() {
    if (document.getElementById('xwl-ocean-island-launcher')) return;
    var launcher = document.createElement('button');
    launcher.id = 'xwl-ocean-island-launcher';
    launcher.className = 'xwl-ocean-island__launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-controls', 'xwl-ocean-island-panel');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<span class="xwl-ocean-island__launcher-mark" aria-hidden="true">✦</span><span class="xwl-ocean-island__launcher-label sys-app-name">猫咪小岛</span>';

    var panel = document.createElement('section');
    panel.id = 'xwl-ocean-island-panel';
    panel.className = 'xwl-ocean-island__panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', '猫咪小岛海洋沙盘');
    panel.innerHTML = '<div class="xwl-ocean-island__backdrop" data-ocean-close="true"></div>' +
      '<div class="xwl-ocean-island__dialog" role="dialog" aria-modal="true" aria-labelledby="xwl-ocean-island-heading">' +
        '<header class="xwl-ocean-island__header"><div><p class="xwl-ocean-island__eyebrow">OCEAN ISLAND · 02:5D</p><h2 id="xwl-ocean-island-heading">猫咪小岛</h2><p class="xwl-ocean-island__hint" id="xwl-ocean-island-hint">点一点地标，听岛屿说晚安</p></div><button type="button" class="xwl-ocean-island__close" data-ocean-close="true" aria-label="关闭猫咪小岛">×</button></header>' +
        '<div class="xwl-ocean-island__scene" aria-describedby="xwl-ocean-island-hint">' + createSvg() + '</div>' +
        '<p class="xwl-ocean-island__status" aria-live="polite">海风把小岛吹得亮晶晶。</p>' +
      '</div>';
    var grid = document.getElementById('sys-grid-base');
    if (grid) grid.appendChild(launcher);
    else document.body.appendChild(launcher);
    document.body.appendChild(panel);
    // 桌面编辑会重建网格；保留原按钮和事件，避免入口消失。
    if (grid && window.MutationObserver) {
      new MutationObserver(function () {
        if (!grid.contains(launcher)) grid.appendChild(launcher);
      }).observe(grid, { childList: true });
    }

    var status = panel.querySelector('.xwl-ocean-island__status');
    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false;
      launcher.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { panel.classList.add('is-open'); panel.querySelector('.xwl-ocean-island__close').focus(); });
    }
    function close() {
      panel.classList.remove('is-open');
      launcher.setAttribute('aria-expanded', 'false');
      window.setTimeout(function () { panel.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }, 180);
    }
    function choose(node) {
      var item = LANDMARKS.find(function (x) { return x.id === node.getAttribute('data-island-id'); });
      panel.querySelectorAll('.xwl-ocean-island__landmark.is-selected').forEach(function (x) { x.classList.remove('is-selected'); });
      node.classList.add('is-selected');
      if (item) status.textContent = item.name + '：' + item.note + '。';
    }
    launcher.addEventListener('click', open);
    panel.addEventListener('click', function (e) {
      var closeTarget = e.target.closest('[data-ocean-close]');
      if (closeTarget) return close();
      var landmark = e.target.closest('.xwl-ocean-island__landmark');
      if (landmark) choose(landmark);
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      var target = e.target.closest('.xwl-ocean-island__landmark');
      if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(target); }
    });
    window.OceanIsland = { open: open, close: close };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
