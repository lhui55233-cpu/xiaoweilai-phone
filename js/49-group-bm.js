
/* GROUP-BM · 图片失败兜底 + 世界书/归巢 iframe 加载兜底（自写，不新增 localStorage 键） */
(function () {
'use strict';
if (window.__bmUiGuard) return;
window.__bmUiGuard = true;
/* ── BM-D2：图片加载失败全局兜底 ── */
var BM_IMG_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#ececef"/><text x="60" y="48" font-size="11" text-anchor="middle" fill="#8e8e93">图片加载失败</text></svg>');
/* GROUP-FIX3 · FIX3-1 头像失败占位：空白灰块（满幅不透明、无文字、无人脸、data: 内联）。
   根因：BM 原占位本身就是灰底 +“图片加载失败”文字；“我”页头像是真实 <img>（外链），
   失败即被换上该占位。头像失败一律走空白占位；其余图片仍走 BM 原占位。 */
var BM_AVATAR_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e2e2e2"/></svg>');
function bmIsAvatarImg(img) {
  try {
    if (img.id === 'wx-me-avatar-img') return true;
    if (img.closest && img.closest('.wx-avatar-wrapper,.wx-me-header-avatar,.wx-cg-avatar,.ot-prof-av')) return true;
    var cls = img.className;
    if (cls && typeof cls === 'string' && /(^|\s)avatar/i.test(cls)) return true;
    if (/avatar/i.test(img.alt || '') || /avatar/i.test(img.id || '')) return true;
  } catch (e) {}
  return false;
}
function bmImgFallback(img) {
  if (!img || img.tagName !== 'IMG') return;
  var cur = '';
  try { cur = img.getAttribute('src') || ''; } catch (e) {}
  if (cur.indexOf('data:image/svg+xml') === 0) return;
  if (img.dataset.bmFb && img.dataset.bmFb === cur) return;
  img.dataset.bmFb = cur;
  var isAv = bmIsAvatarImg(img);
  try { img.src = isAv ? BM_AVATAR_PH : BM_IMG_PH; } catch (e) {}
  if (isAv) { try { img.dataset.fix3Avatar = '1'; } catch (e) {} }
}
/* 捕获期：error 不冒泡，必须捕获才能收到所有 img 的失败 */
document.addEventListener('error', function (e) {
  if (e && e.target && e.target.tagName === 'IMG') bmImgFallback(e.target);
}, true);
/* 启动时已失败的图片（监听器装上之前就 error 过的）：只处理已完成且确实没像素的 */
function bmScanBrokenImgs() {
  try {
    Array.prototype.forEach.call(document.querySelectorAll('.sys-app-window img[src]'), function (img) {
      if (img.complete && img.naturalWidth === 0 && img.src && img.src.indexOf('data:') !== 0) bmImgFallback(img);
    });
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bmScanBrokenImgs);
else bmScanBrokenImgs();
/* ── BM-D3：世界书 / 归巢 iframe 加载兜底 ── */
var BM_IFRAME_TIMEOUT_MS = 6000;
function bmArmIframe(frame, appName) {
  if (!frame || frame.dataset.bmArmed) return;
  frame.dataset.bmArmed = '1';
  var parent = frame.parentElement;
  if (!parent) return;
  var fb = document.createElement('div');
  fb.className = 'bm-iframe-fallback';
  fb.setAttribute('data-bm-iframe-fallback', appName);
  fb.innerHTML = '<div>' + appName + '加载中…</div>'
    + '<div style="display:none;" data-bm-fb-fail>内容加载失败或耗时较长，可能是页面没有加载出来。<br>点按重试，或返回桌面重进。</div>'
    + '<button type="button" style="display:none;" data-bm-fb-retry>重试加载</button>';
  parent.insertBefore(fb, frame);
  /* 兜底层 z-index 0 在下；iframe 抬到 1，加载成功就盖住它 */
  try { frame.style.position = 'relative'; frame.style.zIndex = '1'; } catch (e) {}
  var loaded = false;
  var timer = null;
  var failBox = fb.querySelector('[data-bm-fb-fail]');
  var retryBtn = fb.querySelector('[data-bm-fb-retry]');
  function showFail() {
    if (loaded) return;
    var loading = fb.firstElementChild;
    if (loading) loading.style.display = 'none';
    if (failBox) failBox.style.display = '';
    if (retryBtn) retryBtn.style.display = '';
  }
  function armTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(showFail, BM_IFRAME_TIMEOUT_MS);
  }
  frame.addEventListener('load', function () {
    loaded = true;
    if (timer) clearTimeout(timer);
    if (fb.parentElement) fb.parentElement.removeChild(fb);
  });
  retryBtn.addEventListener('click', function () {
    loaded = false;
    var loading = fb.firstElementChild;
    if (loading) loading.style.display = '';
    if (failBox) failBox.style.display = 'none';
    retryBtn.style.display = 'none';
    try {
      if (frame.srcdoc !== undefined && frame.srcdoc) frame.srcdoc = frame.srcdoc;
      else if (frame.src) frame.src = frame.src;
    } catch (e) {}
    armTimer();
  });
  armTimer();
}
function bmArmIframes() {
  var wb = document.getElementById('wb-embed-frame');
  if (wb) bmArmIframe(wb, '世界书');
  var gc = document.getElementById('gc-embed-frame');
  if (gc) bmArmIframe(gc, '归巢');
}
/* 跟着每次启动 app 走：iframe 是 render 时才建的，启动后立刻挂兜底；
   有些 app 的渲染是异步/带转场的，单次挂可能赶在 iframe 出现之前，
   所以再加 MutationObserver 补挂（两窗都挂上即断开），兜底只挂一次 */
function bmArmIframesSoon() {
  bmArmIframes();
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    bmArmIframes();
    var wb = document.getElementById('wb-embed-frame');
    var gc = document.getElementById('gc-embed-frame');
    if ((wb && wb.dataset.bmArmed && gc && gc.dataset.bmArmed) || tries >= 10) clearInterval(iv);
  }, 300);
}
try {
  var _bmLaunch = (typeof AppManager !== 'undefined' && AppManager && AppManager.launch)
    ? AppManager.launch.bind(AppManager) : null;
  if (_bmLaunch) {
    AppManager.launch = function (id) {
      var r = _bmLaunch(id);
      setTimeout(bmArmIframesSoon, 0);
      return r;
    };
  }
} catch (e) {}
try {
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var _bmOb = new MutationObserver(function () {
      bmArmIframes();
      var wb = document.getElementById('wb-embed-frame');
      var gc = document.getElementById('gc-embed-frame');
      if (wb && wb.dataset.bmArmed && gc && gc.dataset.bmArmed) _bmOb.disconnect();
    });
    _bmOb.observe(document.body, { childList: true, subtree: true });
  }
} catch (e) {}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bmArmIframesSoon);
else bmArmIframesSoon();
window.__bmUiGuardApi = { armIframes: bmArmIframes, scanBrokenImgs: bmScanBrokenImgs, timeoutMs: BM_IFRAME_TIMEOUT_MS };
})();
