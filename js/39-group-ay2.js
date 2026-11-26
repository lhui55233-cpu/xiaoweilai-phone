
/* GROUP-AY2 · AY 跳过的 5 项补做（AW 已合入，有锚点才做）
   思路来源（只借思路，代码全部自写，不抄仓库）：
   - A5：3DStack Effect 3（旋转 + 上移淡出，yPercent -100 按手机尺寸缩为 -72px）、
     CardSleight swoop（松手弧线飞回）、Scrapbook（拍立得微倾 -10~+10°、胶带、日期戳、手写便签）
   - A3：Origamio 翻折 + ui-demo 翻面结构（perspective 1000、preserve-3d、背面 rotateY 180、backface-hidden、0.8s）
   - A8：ui-demo layoutId 共享布局思路 → 手写 FLIP；懒渲染 IntersectionObserver（进入视口前 200px）
   - A9：ui-demo 弹簧数值 stiffness 400 / damping 30 → CSS cubic-bezier(.34,1.56,.64,1) 近似；面板横滑 300/30
   - A10：Scrapbook 纸纹三选一（只取点纹，纯 CSS 渐变）+ 克制点缀（胶带压角、日期戳）
   铁律：只读现有 localStorage 键（cike_album_v1 / phone_forum_news_v1），不新增、不改写任何键；
   不写示例/预设内容；动效只在交互时动一次；每屏一个返回键；无框架、无常驻循环。 */
(function () {
'use strict';
var MARK = 'GROUP-AY2';
if (window.GroupAY2) return;
var FLIP_MS = 800, SWOOP_MS = 500, SPRING_STIFFNESS = 400, SPRING_DAMPING = 30, SPARK_COUNT = 8;
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
/* 日期戳：自动填当天，DD.MM.YYYY */
function fmtStamp(d) { d = d || new Date(); return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }
function reducedMotion() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
/* 拍立得微倾：由 id 散列决定，-10°~+10°，同一张每次一样 */
function tiltFor(id) { var h = 0, s = String(id || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return (h % 21) - 10; }
function readJSON(k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } }

/* ═══ 一次性微光：点按才散开，8 粒，600ms 内收完，不做常驻氛围 ═══ */
function burst(host, x, y) {
  if (!host) return 0;
  var cs = host.style.position; if (!cs || cs === 'static') host.style.position = 'relative';
  for (var i = 0; i < SPARK_COUNT; i++) {
    (function (i) {
      var s = document.createElement('span');
      s.className = 'ay2-spark';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      host.appendChild(s);
      var ang = (Math.PI * 2 * i) / SPARK_COUNT, dx = Math.cos(ang) * 26, dy = Math.sin(ang) * 26;
      var apply = function () {
        s.style.transition = 'transform .55s ease-out, opacity .55s ease-out';
        s.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.35)';
        s.style.opacity = '0';
      };
      if (window.requestAnimationFrame) window.requestAnimationFrame(apply); else setTimeout(apply, 16);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
    })(i);
  }
  return SPARK_COUNT;
}

/* ═══ A5 明信片册 ═══ */
function pcGrid() { return document.getElementById('aw-pc-grid'); }
/* 注意：.aw-pc 的父级是 #aw-pc-grid 里的内层 .aw-pc-grid，不是 #aw-pc-grid 本身 */
function pcWrap() { var g = pcGrid(); if (!g) return null; return g.querySelector('.aw-pc-grid') || g; }
function pcCards() { var w = pcWrap(); return w ? w.querySelectorAll('.aw-pc') : []; }
/* 上一张：旋转 + 上移淡出离开（Effect 3 思路，-72px 手机尺寸），下一张从后方升起 */
function pcNext() {
  var w = pcWrap(); if (!w) return false;
  var cards = w.querySelectorAll('.aw-pc'); if (cards.length < 2) return false;
  var top = cards[0];
  top.classList.add('ay2-pc-leaving');
  setTimeout(function () {
    w.appendChild(top);
    top.classList.remove('ay2-pc-leaving');
    var n = w.querySelector('.aw-pc');
    if (n) { n.classList.remove('ay2-pc-rise'); void n.offsetWidth; n.classList.add('ay2-pc-rise'); }
  }, reducedMotion() ? 0 : 460);
  return true;
}
function pcPrev() {
  var w = pcWrap(); if (!w) return false;
  var cards = w.querySelectorAll('.aw-pc'); if (cards.length < 2) return false;
  var last = cards[cards.length - 1];
  w.insertBefore(last, cards[0]);
  last.classList.remove('ay2-pc-rise'); void last.offsetWidth; last.classList.add('ay2-pc-rise');
  return true;
}
/* 松手弧线飞回（CardSleight swoop 思路：中途上扬 -36px 再落回原位，500ms；与照片堆叠 fling 二选一，不重复） */
function pcSwoop(el, dx, dy) {
  if (!el) return false;
  dx = dx || 0; dy = dy || 0;
  var from = el.style.transform || '';
  var finish = function () { el.style.transform = ''; el.style.zIndex = ''; el.style.transition = ''; };
  if (el.animate) {
    var an = el.animate([
      { transform: from || 'translate(0px,0px)' },
      { transform: 'translate(' + (dx * 0.35).toFixed(1) + 'px,' + (dy * 0.35 - 36).toFixed(1) + 'px) rotate(' + (dx * 0.025).toFixed(2) + 'deg)' },
      { transform: 'translate(0px,0px) rotate(0deg)' }
    ], { duration: reducedMotion() ? 0 : SWOOP_MS, easing: 'cubic-bezier(.2,.7,.3,1)' });
    if (an) { an.onfinish = finish; }
    setTimeout(finish, SWOOP_MS + 80);
  } else {
    el.style.transition = 'transform .5s cubic-bezier(.2,.7,.3,1)';
    el.style.transform = 'translate(' + (dx * 0.35).toFixed(1) + 'px,' + (dy * 0.35 - 36).toFixed(1) + 'px)';
    setTimeout(function () { el.style.transform = ''; setTimeout(finish, 520); }, 30);
  }
  return true;
}
function toggleCollage() {
  var g = pcGrid(); if (!g) return false;
  var ov = document.getElementById('aw-overlay'); if (!ov) return false;
  var old = ov.querySelector('.ay2-pc-collage');
  if (old) {
    old.parentNode.removeChild(old);
    g.style.display = '';
    var b1 = ov.querySelector('[data-ay2-pc="collage"]'); if (b1) b1.textContent = '🧷 拼贴页';
    return false;
  }
  var AW = window.AWGroup || {};
  var list = [];
  try { list = AW.listPostcards ? AW.listPostcards() : readJSON('cike_postcards_v1', []); } catch (e) { list = []; }
  if (!Array.isArray(list) || !list.length) return false;
  var box = document.createElement('div');
  box.className = 'ay2-pc-collage';
  box.innerHTML = list.map(function (p) {
    var svg = '';
    try { svg = (AW.postcardSVG ? AW.postcardSVG(p.scene, 'day') : ''); } catch (e) { svg = ''; }
    return '<div class="ay2-polaroid" data-ay2-pc-id="' + esc(p.id) + '" style="transform:rotate(' + tiltFor(p.id) + 'deg)">'
      + '<span class="ay2-tape" style="top:-9px;left:50%;margin-left:-32px;transform:rotate(-2deg)"></span>'
      + (svg || '<div style="background:#f0e8da;height:90px"></div>')
      + '<div class="ay2-polaroid-cap">' + esc(p.caption || '') + '</div>'
      + '<div class="ay2-polaroid-meta">' + esc(p.place || '') + ' · ' + esc(p.time || '') + '<br>' + esc(p.event || '') + '</div>'
      + '<div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span class="ay2-stamp">' + fmtStamp(new Date()) + '</span><span style="font-size:11px;color:#b08d3e">✦ 点按有微光</span></div>'
      + '</div>';
  }).join('');
  box.addEventListener('click', function (ev) {
    var pol = ev.target && ev.target.closest ? ev.target.closest('.ay2-polaroid') : null;
    if (!pol) return;
    var r = pol.getBoundingClientRect();
    burst(pol, (ev.clientX || 0) - (r.left || 0) || 40, (ev.clientY || 0) - (r.top || 0) || 40);
  });
  g.parentNode.insertBefore(box, g.nextSibling);
  g.style.display = 'none';
  var b2 = ov.querySelector('[data-ay2-pc="collage"]'); if (b2) b2.textContent = '‹ 返回册子';
  return true;
}
var pcDrag = null;
function bindPcDrag(grid) {
  if (grid._ay2DragBound) return;
  grid._ay2DragBound = true;
  grid.addEventListener('pointerdown', function (ev) {
    var card = ev.target && ev.target.closest ? ev.target.closest('.aw-pc') : null;
    if (!card) return;
    pcDrag = { el: card, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false };
    card.style.zIndex = '200';
  });
  window.addEventListener('pointermove', function (ev) {
    if (!pcDrag) return;
    pcDrag.dx = ev.clientX - pcDrag.x0; pcDrag.dy = ev.clientY - pcDrag.y0;
    if (Math.abs(pcDrag.dx) + Math.abs(pcDrag.dy) > 6) pcDrag.moved = true;
    if (pcDrag.moved) {
      pcDrag.el.style.transition = 'none';
      pcDrag.el.style.transform = 'translate(' + pcDrag.dx + 'px,' + pcDrag.dy + 'px) rotate(' + (pcDrag.dx * 0.05).toFixed(2) + 'deg)';
    }
  });
  window.addEventListener('pointerup', function () {
    if (!pcDrag) return;
    var d = pcDrag; pcDrag = null;
    if (!d.moved) { d.el.style.zIndex = ''; return; }
    /* 拖过才拦截随后一次点击，不让它误开详情 */
    var el = d.el;
    var h = function (e) { e.stopPropagation(); e.preventDefault(); };
    el.addEventListener('click', h, true);
    setTimeout(function () { el.removeEventListener('click', h, true); }, 120);
    pcSwoop(el, d.dx, d.dy);
  });
}
function enhancePostcards() {
  var g = pcGrid(); if (!g) return;
  var cards = g.querySelectorAll('.aw-pc'); if (!cards.length) return;
  var ov = document.getElementById('aw-overlay');
  if (ov && !ov.querySelector('.ay2-pc-ctl')) {
    var ctl = document.createElement('div');
    ctl.className = 'ay2-pc-ctl';
    ctl.innerHTML = '<button type="button" class="ay2-btn ghost" data-ay2-pc="prev">‹ 上一张</button>'
      + '<button type="button" class="ay2-btn" data-ay2-pc="next">下一张 ›</button>'
      + '<button type="button" class="ay2-btn ghost" data-ay2-pc="collage">🧷 拼贴页</button>';
    ctl.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ay2-pc]') : null;
      if (!b) return;
      var act = b.getAttribute('data-ay2-pc');
      if (act === 'next') pcNext();
      else if (act === 'prev') pcPrev();
      else if (act === 'collage') toggleCollage();
    });
    g.parentNode.insertBefore(ctl, g.nextSibling);
  }
  bindPcDrag(g);
}

/* ═══ A3 档案翻页：0.8s 翻折（CSS 3D，见样式）；只加红折痕 + 图例 + 克制点缀 ═══ */
function enhanceArchive() {
  var ca = document.querySelector('.aw-ca:not([data-ay2-ca])');
  if (!ca) return;
  ca.setAttribute('data-ay2-ca', '1');
  ca.classList.add('ay2-flip');
  var tape = document.createElement('span');
  tape.className = 'ay2-tape ay2-tape-corner';
  ca.appendChild(tape);
  var stamp = document.createElement('span');
  stamp.className = 'ay2-stamp ay2-ca-stamp';
  stamp.textContent = fmtStamp(new Date());
  ca.appendChild(stamp);
  var crease = document.createElement('div');
  crease.className = 'ay2-ca-crease';
  ca.appendChild(crease);
  var label = document.createElement('div');
  label.className = 'ay2-ca-crease-label';
  label.textContent = '折痕示意：沿左缘翻折 · 0.8s';
  ca.appendChild(label);
}

/* ═══ A8 卡片展开详情页（手写 FLIP）+ 懒渲染 + 离线占位 ═══ */
var expandState = { host: null, card: null, rect: null };
function expandArticle(rowEl) {
  var AW = window.AWGroup || {};
  if (!AW.getNewsArticle || !rowEl) return null;
  var issueId = rowEl.getAttribute('data-id') || '';
  var articleId = rowEl.getAttribute('data-id2') || '';
  var art = AW.getNewsArticle(issueId, articleId);
  if (!art) return null;
  try { if (AW.readNewsArticle) AW.readNewsArticle(issueId, articleId); } catch (e) {}
  var host = document.getElementById('aw-news-ov'); if (!host) return null;
  closeExpand(true);
  var r = rowEl.getBoundingClientRect(), hr = host.getBoundingClientRect();
  var rel = { left: (r.left - hr.left), top: (r.top - hr.top), width: r.width || 300, height: r.height || 60 };
  var ov = document.createElement('div');
  ov.className = 'ay2-expand-ov';
  ov.innerHTML = '<div class="ay2-expand-card" style="left:' + rel.left.toFixed(1) + 'px;top:' + rel.top.toFixed(1) + 'px;width:' + rel.width.toFixed(1) + 'px">'
    + '<button type="button" class="ay2-expand-close">‹ 返回</button>'
    + '<div style="text-align:center;border-bottom:2px solid #b08d3e;padding:10px 0 12px;margin-bottom:12px"><div style="font-size:26px;font-weight:700;letter-spacing:6px">《此刻日报》</div><div style="font-size:11px;letter-spacing:3px;color:#8a6a52;margin-top:4px">' + esc(art.date) + ' · ' + esc(art.section) + '</div></div>'
    + '<h2>' + esc(art.title) + '</h2>'
    + '<div class="ay2-expand-meta">日期 ' + esc(art.date) + ' · 版面 ' + esc(art.section) + ' · 相关人物 ' + esc(art.people || '—') + ' · 字数 ' + String(art.body || '').length + ' · 阅读 ' + (art.views || 0) + ' 次</div>'
    + '<div class="ay2-expand-body">' + esc(art.body || '') + '</div>'
    + '<div style="margin-top:10px"><button type="button" class="ay2-btn ghost" data-ay2-fav="' + esc(art.id) + '">' + ((AW.isNewsFav && AW.isNewsFav(art.id)) ? '★ 已收藏' : '☆ 收藏') + '</button></div>'
    + '<div style="margin-top:10px;font-size:12px;color:#a08a7a">评论 ' + (AW.listArticleComments ? AW.listArticleComments(art.id).length : 0) + ' 条 · 在报纸文章页写评论</div>'
    + '</div>';
  host.appendChild(ov);
  var card = ov.querySelector('.ay2-expand-card');
  expandState = { host: host, card: card, rect: rel, ov: ov };
  var open = function () { card.classList.add('ay2-expand-open'); };
  if (window.requestAnimationFrame) window.requestAnimationFrame(open); else setTimeout(open, 16);
  ov.querySelector('.ay2-expand-close').addEventListener('click', function () { closeExpand(false); });
  var favBtn = ov.querySelector('[data-ay2-fav]');
  if (favBtn) favBtn.addEventListener('click', function () {
    try { var on = AW.toggleNewsFav ? AW.toggleNewsFav(art.id) : false; favBtn.textContent = on ? '★ 已收藏' : '☆ 收藏'; } catch (e) {}
  });
  return ov;
}
function closeExpand(instant) {
  var ov = document.querySelector('.ay2-expand-ov');
  if (!ov) return false;
  if (instant) { if (ov.parentNode) ov.parentNode.removeChild(ov); expandState = { host: null, card: null, rect: null }; return true; }
  var card = ov.querySelector('.ay2-expand-card');
  if (card && expandState.rect) {
    card.classList.remove('ay2-expand-open');
    card.style.left = expandState.rect.left.toFixed(1) + 'px';
    card.style.top = expandState.rect.top.toFixed(1) + 'px';
    card.style.width = expandState.rect.width.toFixed(1) + 'px';
    card.style.opacity = '0';
  }
  setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 320);
  expandState = { host: null, card: null, rect: null };
  return true;
}
/* 懒渲染：进入视口前 200px 才渲染（IntersectionObserver，rootMargin 200px）；无 IO 时立即全渲染 */
function lazyObserve(scope) {
  var els = (scope || document).querySelectorAll('.aw-news-row, .aw-news-front');
  if (!els.length) return 0;
  if (typeof IntersectionObserver === 'undefined') {
    els.forEach(function (el) { el.classList.add('ay2-lazy-in'); el.setAttribute('data-ay2-lazy', 'in'); });
    return els.length;
  }
  var host = document.getElementById('aw-news-ov');
  var obs = host && host._ay2LazyObs ? host._ay2LazyObs : null;
  if (!obs) {
    obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.remove('ay2-lazy-pending');
        en.target.classList.add('ay2-lazy-in');
        en.target.setAttribute('data-ay2-lazy', 'in');
        obs.unobserve(en.target);
      });
    }, { rootMargin: '200px 0px' });
    if (host) host._ay2LazyObs = obs;
  }
  var n = 0;
  els.forEach(function (el) {
    if (el.getAttribute('data-ay2-obs') === '1') return;
    el.setAttribute('data-ay2-obs', '1');
    el.classList.add('ay2-lazy-pending');
    obs.observe(el);
    n++;
  });
  return n;
}
function enhanceNews() {
  var ov = document.getElementById('aw-news-ov');
  if (!ov) return;
  /* A10：报纸只借纸纹（点纹，纯 CSS 渐变），不借拼贴 */
  ov.classList.add('ay2-paper-dots');
  lazyObserve(ov);
}
/* 世界书：base64 iframe（WB_B64）内部够不到，只做外层整体展开 */
function worldbookExpand() {
  var frame = document.getElementById('wb-embed-frame');
  if (!frame) return null;
  closeExpand(true);
  var host = frame.closest ? (frame.closest('.sys-app-window') || frame.parentElement) : frame.parentElement;
  var origParent = frame.parentNode, origNext = frame.nextSibling;
  var ov = document.createElement('div');
  ov.className = 'ay2-expand-ov';
  ov.style.position = 'absolute';
  ov.innerHTML = '<div class="ay2-expand-card ay2-expand-open" style="position:relative;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column">'
    + '<button type="button" class="ay2-expand-close">‹ 返回</button>'
    + '<div class="ay2-wb-note">世界书条目在 base64 iframe 内，外层够不到条目级展开；此处为外层整体展开（iframe 整体移入详情页，关闭时移回原位，状态不丢）。</div>'
    + '<div class="ay2-wb-frame-host" style="flex:1;min-height:300px;display:flex"></div>'
    + '</div>';
  (host || document.body).appendChild(ov);
  var slot = ov.querySelector('.ay2-wb-frame-host');
  frame.style.width = '100%'; frame.style.height = '100%';
  slot.appendChild(frame);
  ov.querySelector('.ay2-expand-close').addEventListener('click', function () {
    if (origNext) origParent.insertBefore(frame, origNext); else origParent.appendChild(frame);
    frame.style.width = ''; frame.style.height = '';
    if (ov.parentNode) ov.parentNode.removeChild(ov);
  });
  return ov;
}
function enhanceWorldbook() {
  var frame = document.getElementById('wb-embed-frame');
  if (!frame || frame.getAttribute('data-ay2-wb') === '1') return;
  frame.setAttribute('data-ay2-wb', '1');
  var parent = frame.parentElement; if (!parent) return;
  if (!parent.style.position) parent.style.position = 'relative';
  if (parent.querySelector('.ay2-wb-expand')) return;
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'ay2-wb-expand'; btn.textContent = '⤢ 展开详情';
  btn.addEventListener('click', function () { worldbookExpand(); });
  parent.appendChild(btn);
}

/* ═══ A9 信件“成品 / 写信心路”两视图：指示条弹簧 + 面板横滑 ═══
   弹簧 stiffness 400 / damping 30 用 CSS cubic-bezier(.34,1.56,.64,1) 近似；面板横滑 300/30 同款曲线 */
var lvView = 'journey';
function switchLetterView(view) {
  var ov = document.getElementById('aw-overlay'); if (!ov) return false;
  var tabs = ov.querySelector('.ay2-lv-tabs'); if (!tabs) return false;
  lvView = (view === 'finished') ? 'finished' : 'journey';
  tabs.querySelectorAll('.ay2-lv-tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-ay2-lv') === lvView); });
  var ind = tabs.querySelector('.ay2-lv-ind');
  var active = tabs.querySelector('.ay2-lv-tab.on');
  if (ind && active) { ind.style.left = (active.offsetLeft || 0) + 'px'; ind.style.width = (active.offsetWidth || 0) + 'px'; }
  var track = ov.querySelector('.ay2-lv-track');
  if (track) track.style.transform = lvView === 'finished' ? 'translateX(-50%)' : 'translateX(0)';
  return true;
}
function enhanceLetters() {
  var ov = document.getElementById('aw-overlay'); if (!ov) return;
  if (ov.querySelector('.ay2-lv-tabs')) return;
  var title = ov.querySelector('.aw-ov-title');
  if (!title || title.textContent.indexOf('写信过程') === -1) return;
  var card = title.nextElementSibling;
  if (!card || !card.classList.contains('aw-card')) return;
  /* 只在列表页做两视图（单封信详情页没有 letter-open 列表，不动） */
  if (!card.querySelector('[data-aw-act="letter-open"]')) return;
  var note = card.nextElementSibling;
  var tabs = document.createElement('div');
  tabs.className = 'ay2-lv-tabs';
  tabs.innerHTML = '<button type="button" class="ay2-lv-tab" data-ay2-lv="finished">成品</button>'
    + '<button type="button" class="ay2-lv-tab on" data-ay2-lv="journey">写信心路</button>'
    + '<span class="ay2-lv-ind"></span>';
  var viewport = document.createElement('div');
  viewport.className = 'ay2-lv-viewport';
  var track = document.createElement('div');
  track.className = 'ay2-lv-track';
  var pJourney = document.createElement('div');
  pJourney.className = 'ay2-lv-panel';
  var pFinished = document.createElement('div');
  pFinished.className = 'ay2-lv-panel';
  /* 成品：只列 cike_album_v1 里的真实信件，不编造 */
  var album = readJSON('cike_album_v1', []);
  if (Array.isArray(album) && album.length) {
    pFinished.innerHTML = '<div class="aw-card">' + album.map(function (l, i) {
      var first = String(l.text || '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return !!x; })[0] || '（无标题）';
      return '<div class="aw-news-row" data-aw-act="letter-open" data-id="' + i + '"><span class="aw-news-sec">' + esc(l.role || 'char') + ' · ' + esc(l.time || '时间未知') + '</span><b>' + esc(first.slice(0, 24)) + '</b><span class="aw-news-rowmeta">' + esc(String(l.text || '').replace(/\n/g, ' ').slice(0, 40)) + '……</span></div>';
    }).join('') + '</div>';
  } else {
    pFinished.innerHTML = '<div class="aw-empty">还没有成品信。char 写信后，成品会收进信件箱。</div>';
  }
  title.parentNode.insertBefore(tabs, title.nextSibling);
  title.parentNode.insertBefore(viewport, tabs.nextSibling);
  viewport.appendChild(track);
  track.appendChild(pFinished);
  track.appendChild(pJourney);
  pJourney.appendChild(card);
  if (note) pJourney.appendChild(note);
  tabs.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-ay2-lv]') : null;
    if (!t) return;
    switchLetterView(t.getAttribute('data-ay2-lv'));
  });
  switchLetterView(lvView);
}

/* ═══ 图片失败占位（只限报纸/信件/档案/展开页内的离线图） ═══ */
document.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG' || !t.closest) return;
  if (!t.closest('#aw-news-ov, #aw-overlay, .ay2-expand-ov, .aw-ca')) return;
  if (t.getAttribute('data-ay2-fb') === '1') return;
  t.setAttribute('data-ay2-fb', '1');
  var s = document.createElement('div');
  s.className = 'ay2-img-fallback';
  s.textContent = '图片离线未加载 · 文字占位：' + (t.alt || '图片');
  if (t.parentNode) t.parentNode.replaceChild(s, t);
}, true);

/* ═══ 拦截报纸文章卡片点击：改走 FLIP 展开（AW 的 ov.onclick 是冒泡，捕获先拦） ═══ */
document.addEventListener('click', function (e) {
  var row = e.target && e.target.closest ? e.target.closest('.aw-news-row[data-aw-news="article"]') : null;
  if (!row) return;
  if (!document.getElementById('aw-news-ov')) return;
  var AW = window.AWGroup || {};
  if (!AW.getNewsArticle) return;
  var art = null;
  try { art = AW.getNewsArticle(row.getAttribute('data-id') || '', row.getAttribute('data-id2') || ''); } catch (err) { art = null; }
  if (!art) return;
  e.stopPropagation();
  e.preventDefault();
  expandArticle(row);
}, true);

function enhanceAll() {
  try { enhancePostcards(); } catch (e) {}
  try { enhanceNews(); } catch (e) {}
  try { enhanceArchive(); } catch (e) {}
  try { enhanceLetters(); } catch (e) {}
  try { enhanceWorldbook(); } catch (e) {}
}
if (typeof MutationObserver !== 'undefined') {
  try {
    var ob = new MutationObserver(function () { enhanceAll(); });
    ob.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceAll);
else enhanceAll();
/* 兜底跑几拍（AW 浮层是运行时才建），随后停，不留常驻循环 */
var _tries = 0;
var _timer = setInterval(function () { _tries++; enhanceAll(); if (_tries >= 6) clearInterval(_timer); }, 500);

window.GroupAY2 = {
  MARK: MARK,
  pcNext: pcNext, pcPrev: pcPrev, pcSwoop: pcSwoop, toggleCollage: toggleCollage,
  burst: burst, fmtStamp: fmtStamp, tiltFor: tiltFor,
  expandArticle: expandArticle, closeExpand: closeExpand, worldbookExpand: worldbookExpand,
  switchLetterView: switchLetterView, enhanceAll: enhanceAll, lazyObserve: lazyObserve,
  constants: { FLIP_MS: FLIP_MS, SWOOP_MS: SWOOP_MS, SPRING_STIFFNESS: SPRING_STIFFNESS, SPRING_DAMPING: SPRING_DAMPING, SPARK_COUNT: SPARK_COUNT, LAZY_ROOT_MARGIN: '200px' },
  DONE: [
    'A5 明信片册：上一张旋转+上移淡出（-72px），下一张从后方升起；拖动松手弧线飞回（swoop 500ms）；拼贴页拍立得微倾-10~+10°+胶带+当天日期戳+手写便签；点按一次性8粒微光',
    'A3 档案翻页：0.8s CSS 3D 翻折（perspective 1000、preserve-3d、背面 rotateY 180、backface-hidden），红折痕+图例',
    'A8 卡片展开详情页：报纸文章手写 FLIP 展开，关闭键唯一返回键；懒渲染 IntersectionObserver（进入视口前 200px）；离线图文字占位；世界书只做外层整体展开',
    'A9 信件成品/写信心路两视图：指示条弹簧滑动（400/30 CSS 近似）+ 面板横滑切换（300/30）',
    'A10 纸面装饰克制：报纸只借点纹纸纹（纯 CSS 渐变）；档案页只加胶带压角+日期戳+红折痕，不搬彩色剪贴簿'
  ],
  NOT_DONE: [
    'A8 世界书条目级展开：世界书是 base64 data: URL iframe（WB_B64），外层够不到内部条目与卡片；只做了外层整体展开（iframe 移入详情页，关闭移回）',
    'A8 明信片/记忆树节点/剧本人物档案的卡片展开：任务书只点名论坛报纸文章与世界书条目，本组只做这两处'
  ]
};
})();
