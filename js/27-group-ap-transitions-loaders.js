
/* GROUP-AP-TRANSITIONS-LOADERS · AP 组：转场与加载（只借做法，自己写代码）
   借鉴：PageTransitions（5 对配对 + 顺序切换 + isAnimating 守卫 + animationend
   清理的设计思路，CSS 文本未复制）；SpinKit / css-spinner（细线圆环与三点输入态
   的风格，自己写）；Whirl / loading-animations-gallery（追逐圆点、单点脉冲、
   伪元素单 div 加载器的思路）；Transition-kit（主题圆心扩散的思路）；
   microinteractions-showcase（数字翻动、错峰淡入的思路）。
   不引任何动画框架与 npm 包；不复制任何项目代码；不改已有 localStorage 键，
   不新增 localStorage 键（phone_app_hooks_v1 只是钩子表注册名，内存注册）。 */
(function () {
'use strict';
if (window.GCTrans) return; /* 已注入则不再重复 */
var DUR = 300; /* 与 --gc-trans-dur 一致（ms），在 0.25–0.35s 内 */
var DUR_FAST = 250;
function reduced() {
    try {
        if (document.documentElement && document.documentElement.classList.contains('sys-reduce-motion')) return true;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) {}
    return false;
}
/* ── 转场守卫：isAnimating 标志 + animationend 后清理 class，防重复点击 ── */
var _animating = false, _animFailsafe = null;
function _setAnimating(v) {
    _animating = !!v;
    if (_animFailsafe) { clearTimeout(_animFailsafe); _animFailsafe = null; }
    if (v) _animFailsafe = setTimeout(function () { _animating = false; _animFailsafe = null; }, 1500);
}
function isAnimating() { return _animating; }
function afterAnim(el, cb, ms) {
    var done = false;
    var finish = function () { if (done) return; done = true; try { cb(); } catch (e) {} };
    if (!el || reduced()) { finish(); return; }
    var t = setTimeout(finish, (ms || DUR) + 80);
    try {
        el.addEventListener('animationend', function h() {
            el.removeEventListener('animationend', h); clearTimeout(t); finish();
        });
    } catch (e) { finish(); }
}
/* ── 钩子表：每个 App 的 onEnter/onLeave 收拢处 ──
   phone_app_hooks_v1 是钩子表注册名，只做内存注册，不写入 localStorage。
   默认钩子（所有 App）：离场保存滚动位置、进场恢复滚动位置、离场停加载/输入态；
   微信专属：离场停打字机显示（只去掉 .wx-typing，不碰发送/回复主逻辑），
   进场给会话列表播一次错峰淡入。自定义钩子用 GCAppHooks.register 注册。 */
var HOOKS_KEY = 'phone_app_hooks_v1';
var _scrollPos = {};
var _hooks = {};
var GCAppHooks = {
    KEY: HOOKS_KEY,
    register: function (appId, hooks) {
        if (!appId || !hooks) return;
        _hooks[appId] = Object.assign({}, _hooks[appId] || {}, hooks);
    },
    get: function (appId) { return _hooks[appId] || null; },
    run: function (appId, stage, win) {
        var h = _hooks[appId];
        if (h && typeof h[stage] === 'function') { try { h[stage](win); } catch (e) {} }
    }
};
function playStagger() {
    try {
        var sc = document.getElementById('wx-sessions-container');
        if (!sc || !sc.hasAttribute('data-gc-stagger')) return;
        sc.classList.remove('gc-stagger-play'); void sc.offsetWidth;
        sc.classList.add('gc-stagger-play');
        setTimeout(function () { sc.classList.remove('gc-stagger-play'); }, 700);
    } catch (e) {}
}
function defaultOnLeave(appId, win) {
    if (win) { try { _scrollPos[appId] = win.scrollTop; } catch (e) {} }
    if (appId === 'wechat') {
        try { var sb = document.getElementById('wx-chat-state-bar'); if (sb) sb.classList.remove('wx-typing'); } catch (e) {}
    }
    hideLoader(); hideAllTyping();
}
function defaultOnEnter(appId, win) {
    if (win) { try { if (typeof _scrollPos[appId] === 'number') win.scrollTop = _scrollPos[appId]; } catch (e) {} }
    if (appId === 'wechat') playStagger();
}
/* ── App 转场：顺序模式（旧页先走、新页再进），只有居中弹窗才用同时淡入 ── */
function _winFor(appId) {
    try {
        if (typeof AppManager !== 'undefined' && AppManager.getWin) return AppManager.getWin(appId);
    } catch (e) {}
    try { return document.querySelector('.sys-app-window[data-app-sandbox="' + appId + '"]'); } catch (e) { return null; }
}
function _enterAnim(win) {
    if (!win || reduced()) return;
    try {
        win.classList.remove('gc-t-app-out');
        win.classList.add('gc-t-app-in');
        void win.offsetWidth;
        win.classList.remove('gc-t-app-in');
    } catch (e) {}
}
function wrapAppManager() {
    try {
        if (typeof AppManager === 'undefined' || !AppManager.launch || !AppManager.minimize) return false;
        if (AppManager.launch.__gcWrapped) return false;
        var origLaunch = AppManager.launch, origMin = AppManager.minimize;
        AppManager.launch = function (appId) {
            if (_animating) return; /* 守卫：转场进行中，忽略重复点击 */
            var cur = null;
            try { cur = AppManager.getActiveId(); } catch (e) {}
            if (reduced() || !cur || cur === appId) {
                var r = origLaunch.call(AppManager, appId);
                if (!reduced() && cur !== appId) {
                    var w0 = _winFor(appId);
                    try { GCAppHooks.run(appId, 'onEnter', w0); defaultOnEnter(appId, w0); } catch (e) {}
                    _enterAnim(w0);
                }
                return r;
            }
            /* 顺序模式：旧页先下滑走，DUR 后新页再上滑进 */
            _setAnimating(true);
            var prevWin = _winFor(cur), prevId = cur;
            try { GCAppHooks.run(prevId, 'onLeave', prevWin); defaultOnLeave(prevId, prevWin); } catch (e) {}
            if (prevWin) { try { prevWin.classList.add('gc-t-app-out'); } catch (e) {} }
            setTimeout(function () {
                try {
                    if (prevWin) prevWin.classList.remove('gc-t-app-out');
                    origLaunch.call(AppManager, appId);
                    var nw = _winFor(appId);
                    try { GCAppHooks.run(appId, 'onEnter', nw); defaultOnEnter(appId, nw); } catch (e) {}
                    _enterAnim(nw);
                } catch (e) {
                    try { origLaunch.call(AppManager, appId); } catch (e2) {}
                } finally { _setAnimating(false); }
            }, DUR);
        };
        AppManager.launch.__gcWrapped = true;
        AppManager.minimize = function () {
            if (_animating) return; /* 守卫：转场进行中，忽略重复点击 */
            var cur = null;
            try { cur = AppManager.getActiveId(); } catch (e) {}
            if (reduced() || !cur) return origMin.call(AppManager);
            if (cur === 'settings') {
                var settingsWin = _winFor(cur);
                try { GCAppHooks.run(cur, 'onLeave', settingsWin); defaultOnLeave(cur, settingsWin); } catch (e) {}
                return origMin.call(AppManager);
            }
            _setAnimating(true);
            var win = _winFor(cur);
            try { GCAppHooks.run(cur, 'onLeave', win); defaultOnLeave(cur, win); } catch (e) {}
            if (win) { try { win.classList.add('gc-t-app-out'); } catch (e) {} }
            setTimeout(function () {
                try {
                    if (win) win.classList.remove('gc-t-app-out');
                    origMin.call(AppManager);
                } catch (e) {
                    try { origMin.call(AppManager); } catch (e2) {}
                } finally { _setAnimating(false); }
            }, DUR);
        };
        AppManager.minimize.__gcWrapped = true;
        return true;
    } catch (e) { return false; }
}
/* ── 列表进详情 / 场景淡入：一次性动效，animationend 后清理 class ── */
function enterDetail(el) {
    if (!el) return false;
    if (reduced()) return true;
    try {
        el.classList.remove('gc-t-detail-out');
        el.classList.add('gc-t-detail-in');
        afterAnim(el, function () { el.classList.remove('gc-t-detail-in'); });
        return true;
    } catch (e) { return false; }
}
function exitDetail(el) {
    if (!el) return false;
    if (reduced()) return true;
    try {
        el.classList.remove('gc-t-detail-in');
        el.classList.add('gc-t-detail-out');
        afterAnim(el, function () { el.classList.remove('gc-t-detail-out'); });
        return true;
    } catch (e) { return false; }
}
function fadeIn(el) {
    if (!el) return false;
    if (reduced()) return true;
    try {
        el.classList.add('gc-t-fade');
        afterAnim(el, function () { el.classList.remove('gc-t-fade'); }, DUR_FAST);
        return true;
    } catch (e) { return false; }
}
var GCNav = { enterDetail: enterDetail, exitDetail: exitDetail, fadeIn: fadeIn };
/* 子页面激活时自动播一次详情入场（.sys-app-subpage / .wx-subpage-box /
   .b-page-view / .st-sub  gaining 激活类时）；只做 class，不动原有逻辑 */
function _isActiveSubpage(el) {
    return el.classList.contains('sys-active') || el.classList.contains('wx-active') ||
        el.classList.contains('active') || el.classList.contains('show');
}
function _watchSubpages() {
    try {
        if (typeof MutationObserver === 'undefined') return;
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (mu) {
                if (mu.type !== 'attributes') return;
                var el = mu.target;
                if (!el.classList) return;
                var isSub = el.classList.contains('sys-app-subpage') || el.classList.contains('wx-subpage-box') ||
                    el.classList.contains('b-page-view') || el.classList.contains('st-sub');
                if (!isSub || el.__gcAnimating) return;
                if (_isActiveSubpage(el)) {
                    el.__gcAnimating = true;
                    enterDetail(el);
                    setTimeout(function () { el.__gcAnimating = false; }, DUR + 100);
                }
            });
        });
        obs.observe(document.documentElement || document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
}
/* 居中弹窗：#sys-modal-container 一有新子节点就播一次淡入缩放（同时淡入） */
function _modalEnter(n) {
    if (reduced()) return;
    try {
        n.classList.add('gc-t-modal');
        afterAnim(n, function () { n.classList.remove('gc-t-modal'); }, DUR_FAST);
    } catch (e) {}
}
function _watchModal() {
    try {
        if (typeof MutationObserver === 'undefined') return;
        var c = document.getElementById('sys-modal-container');
        if (!c) return;
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (mu) {
                for (var i = 0; i < mu.addedNodes.length; i++) {
                    var n = mu.addedNodes[i];
                    if (n.nodeType === 1) _modalEnter(n);
                }
            });
        });
        obs.observe(c, { childList: true });
    } catch (e) {}
}
/* ── 主题切换圆心扩散：接 AA 组 AppTheme.apply；主题真的变了、且 1.5s 内有过
   点按，才从点按位置做一次很淡、很短的灰色圆形展开；启动/跨标签同步不扩散 ── */
var _lastTap = { x: 0, y: 0, t: 0 };
try {
    document.addEventListener('pointerdown', function (e) {
        _lastTap.x = e.clientX || 0; _lastTap.y = e.clientY || 0; _lastTap.t = Date.now();
    }, true);
    document.addEventListener('touchstart', function (e) {
        var t = e.touches && e.touches[0];
        if (t) { _lastTap.x = t.clientX; _lastTap.y = t.clientY; _lastTap.t = Date.now(); }
    }, true);
} catch (e) {}
function themeRipple() {
    if (reduced()) return false;
    if (Date.now() - _lastTap.t > 1500) return false;
    try {
        var host = document.getElementById('sys-shell') || document.body;
        var veil = document.createElement('div');
        veil.className = 'gc-theme-ripple';
        veil.setAttribute('aria-hidden', 'true');
        var x = _lastTap.x, y = _lastTap.y;
        var maxR = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))) + 20;
        veil.style.clipPath = 'circle(0px at ' + x + 'px ' + y + 'px)';
        host.appendChild(veil);
        void veil.offsetWidth;
        veil.style.transition = 'clip-path .35s cubic-bezier(.32,.72,0,1), opacity .15s ease .35s';
        veil.style.clipPath = 'circle(' + maxR + 'px at ' + x + 'px ' + y + 'px)';
        setTimeout(function () { veil.style.opacity = '0'; }, 350);
        setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 560);
        return true;
    } catch (e) { return false; }
}
function wrapTheme() {
    try {
        if (!window.AppTheme || !window.AppTheme.apply || window.AppTheme.apply.__gcWrapped) return false;
        var orig = window.AppTheme.apply;
        var wrapped = function () {
            var before = null, after = null;
            try { before = window.AppTheme.resolved(); } catch (e) {}
            var r = orig.apply(window.AppTheme);
            try { after = window.AppTheme.resolved(); } catch (e) {}
            if (before !== null && after !== null && before !== after) themeRipple();
            return r;
        };
        wrapped.__gcWrapped = true;
        window.AppTheme.apply = wrapped;
        return true;
    } catch (e) { return false; }
}
/* ── 加载：同一时间只跑一个；超约 2 秒才上追逐圆点；超时移除；切页就停 ── */
var LOADER_COPIES = ['正在思考…', '正在写…', '快好了…'];
var _loader = null, _loaderChaseTimer = null, _loaderCopyTimer = null, _loaderTimeout = null, _copyIdx = 0;
function _clearLoaderTimers() {
    if (_loaderChaseTimer) { clearTimeout(_loaderChaseTimer); _loaderChaseTimer = null; }
    if (_loaderCopyTimer) { clearInterval(_loaderCopyTimer); _loaderCopyTimer = null; }
    if (_loaderTimeout) { clearTimeout(_loaderTimeout); _loaderTimeout = null; }
}
function showLoader(host, opts) {
    opts = opts || {};
    hideLoader();
    var container = host || document.body;
    var box = document.createElement('div');
    box.className = 'gc-loader';
    box.setAttribute('role', 'status');
    box.setAttribute('data-gc-loader', '1');
    box.innerHTML = '<div class="gc-ring" aria-hidden="true"></div><div class="gc-loader-copy"></div>';
    var copyEl = box.querySelector('.gc-loader-copy');
    _copyIdx = 0;
    var setCopy = function (t) { if (copyEl) copyEl.textContent = t; };
    setCopy(opts.copy || LOADER_COPIES[0]);
    try { container.appendChild(box); } catch (e) { return null; }
    _loader = { el: box, copyEl: copyEl, setCopy: setCopy, host: container };
    _loaderCopyTimer = setInterval(function () {
        if (!_loader) return;
        _copyIdx = (_copyIdx + 1) % LOADER_COPIES.length;
        setCopy(LOADER_COPIES[_copyIdx]);
    }, 2500);
    _loaderChaseTimer = setTimeout(function () {
        if (!_loader) return;
        var ring = box.querySelector('.gc-ring');
        if (ring) {
            var ch = document.createElement('div');
            ch.className = 'gc-chase';
            ch.setAttribute('aria-hidden', 'true');
            ch.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
            ring.parentNode.replaceChild(ch, ring);
        }
    }, 2000);
    _loaderTimeout = setTimeout(function () { hideLoader(); }, opts.timeoutMs || 15000);
    return _loader;
}
function hideLoader() {
    _clearLoaderTimers();
    if (_loader && _loader.el && _loader.el.parentNode) {
        try { _loader.el.parentNode.removeChild(_loader.el); } catch (e) {}
    }
    _loader = null;
}
function setLoaderCopy(t) { if (_loader && _loader.copyEl) _loader.copyEl.textContent = t; }
function loaderActive() { return !!_loader; }
/* 输入中三点：同一时间只跑一个（同容器内已有就复用）；回复一到调用方 hideTyping 停 */
function showTyping(host) {
    var container = host || document.body;
    try {
        var old = container.querySelector ? container.querySelector('.gc-typing[data-gc-typing="1"]') : null;
        if (old) return old;
    } catch (e) {}
    var d = document.createElement('span');
    d.className = 'gc-typing';
    d.setAttribute('data-gc-typing', '1');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i></i><i></i><i></i>';
    try { container.appendChild(d); } catch (e) { return null; }
    return d;
}
function hideTyping(host) {
    var c = host || document;
    var els = [];
    try { els = c.querySelectorAll ? c.querySelectorAll('.gc-typing[data-gc-typing="1"]') : []; } catch (e) {}
    for (var i = 0; i < els.length; i++) {
        if (els[i].parentNode) { try { els[i].parentNode.removeChild(els[i]); } catch (e) {} }
    }
}
function hideAllTyping() { hideTyping(document); }
/* 骨架屏：一次短暂淡入占位（灰色圆角块，圆角 12px），数据一到 replaceSkeleton 替换 */
function skeleton(container, rows) {
    if (!container) return null;
    var n = rows || 3;
    var box = document.createElement('div');
    box.className = 'gc-skeleton';
    box.setAttribute('data-gc-skeleton', '1');
    var widths = [90, 70, 85, 60, 75, 80], html = '';
    for (var i = 0; i < n; i++) html += '<div class="gc-skeleton-row" style="width:' + widths[i % widths.length] + '%"></div>';
    box.innerHTML = html;
    try { container.innerHTML = ''; container.appendChild(box); } catch (e) { return null; }
    return box;
}
function replaceSkeleton(container, html) {
    if (!container) return;
    try { container.innerHTML = html; } catch (e) {}
}
/* 数字翻动：一次短促（金币、专注分钟、连续天数）；减动效下直接换字 */
function flipNumber(el, text) {
    if (!el) return false;
    var s = String(text);
    if (el.textContent === s) return true;
    if (reduced()) { el.textContent = s; return true; }
    try {
        el.classList.remove('gc-flip'); void el.offsetWidth;
        el.textContent = s;
        el.classList.add('gc-flip');
        var done = false;
        var clean = function () { if (done) return; done = true; el.classList.remove('gc-flip'); };
        setTimeout(clean, 350);
        el.addEventListener('animationend', function h() { el.removeEventListener('animationend', h); clean(); });
    } catch (e) { el.textContent = s; }
    return true;
}
/* watchFlip：迟到的元素也接上（新增节点里找到就挂文本监听，文本一变翻一次） */
function watchFlip(selector) {
    function attach(el) {
        if (!el || el.__gcFlipWatched) return;
        el.__gcFlipWatched = true;
        try {
            var obs = new MutationObserver(function () { flipNumber(el, el.textContent); });
            obs.observe(el, { characterData: true, childList: true, subtree: true });
        } catch (e) {}
    }
    try {
        if (typeof MutationObserver === 'undefined') return;
        var cur = document.querySelector(selector);
        if (cur) attach(cur);
        var docObs = new MutationObserver(function (muts) {
            muts.forEach(function (mu) {
                for (var i = 0; i < mu.addedNodes.length; i++) {
                    var n = mu.addedNodes[i];
                    if (n.nodeType !== 1) continue;
                    if (n.matches && n.matches(selector)) attach(n);
                    var inner = n.querySelector ? n.querySelector(selector) : null;
                    if (inner) attach(inner);
                }
            });
        });
        docObs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}
}
/* ── 状态按钮：接 AG 组 PhoneModel.testFromForm ──
   点按后按钮内转圈 + 细进度线 → 成功变勾 / 失败变叉并显示文字，期间禁用重复
   点击；1.2 秒后按钮恢复原标签，只留 #pm-test-result 的文字结果。 */
function wrapModelTest() {
    try {
        if (!window.PhoneModel || !window.PhoneModel.testFromForm || window.PhoneModel.testFromForm.__gcWrapped) return false;
        var orig = window.PhoneModel.testFromForm;
        var wrapped = async function () {
            var btn = null;
            try { btn = document.querySelector('button[onclick*="testFromForm"]'); } catch (e) {}
            if (!btn || reduced()) return orig.apply(window.PhoneModel, arguments);
            if (btn.dataset.gcBusy) return;
            btn.dataset.gcBusy = '1';
            var origLabel = btn.textContent;
            btn.classList.add('gc-status-btn', 'gc-busy');
            try { btn.disabled = true; } catch (e) {}
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = '<span class="gc-btn-spin" aria-hidden="true"></span><span class="gc-btn-line" aria-hidden="true"></span><span>正在测试…</span>';
            var ok = false;
            try { await orig.apply(window.PhoneModel, arguments); } catch (e) {}
            try {
                var res = document.getElementById('pm-test-result');
                var t = res ? (res.textContent || '') : '';
                ok = /连接成功/.test(t);
            } catch (e) {}
            btn.classList.remove('gc-busy');
            btn.classList.add(ok ? 'gc-ok' : 'gc-fail');
            btn.innerHTML = '<span>' + (ok ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 连接成功' : '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" style="vertical-align:-1px"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 连接失败') + '</span>';
            setTimeout(function () {
                btn.classList.remove('gc-status-btn', 'gc-ok', 'gc-fail');
                try { btn.disabled = false; } catch (e) {}
                btn.removeAttribute('aria-busy');
                try { delete btn.dataset.gcBusy; } catch (e) {}
                btn.textContent = origLabel;
            }, 1200);
        };
        wrapped.__gcWrapped = true;
        window.PhoneModel.testFromForm = wrapped;
        return true;
    } catch (e) { return false; }
}
function init() {
    var okApp = wrapAppManager();
    if (!okApp) {
        setTimeout(function () { wrapAppManager(); }, 500); /* 兜底：AppManager 晚定义时再包一次 */
    }
    wrapTheme();
    wrapModelTest();
    _watchSubpages();
    _watchModal();
    watchFlip('#ot-focus-left'); /* 专注分钟：文本一变翻一次 */
    try {
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { hideLoader(); hideAllTyping(); }
        });
    } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
window.GCTrans = {
    DUR: DUR, DUR_FAST: DUR_FAST, LOADER_COPIES: LOADER_COPIES,
    reduced: reduced, isAnimating: isAnimating, afterAnim: afterAnim,
    showLoader: showLoader, hideLoader: hideLoader, setLoaderCopy: setLoaderCopy, loaderActive: loaderActive,
    showTyping: showTyping, hideTyping: hideTyping, hideAllTyping: hideAllTyping,
    skeleton: skeleton, replaceSkeleton: replaceSkeleton,
    flipNumber: flipNumber, watchFlip: watchFlip,
    themeRipple: themeRipple, enterDetail: enterDetail, exitDetail: exitDetail, fadeIn: fadeIn
};
window.GCAppHooks = GCAppHooks;
window.GCNav = GCNav;
})();
