
/* GROUP-AY-INTERACTIONS · 8 仓库调研 A 清单落地（只借思路，代码全部自写）
   来源（想法 only，未复制任何仓库代码；许可证见任务书核实结果）：
   - paper-crumple-demo（MIT 已核实）：只留时间线心智模型与起步数值
     1.15s / 1.25s / 0.82 倍 / 6px 阈值 / 出界反弹 0.42。
   - Origamio（MIT 已核实）：翻折 0.8s 节律、过 90 度换面、吸附、层叠加深、
     红折痕、角度档位 0/6/15/30。
   - newton-playground（无许可证）：重力 980 像素制、钉子约束、弹簧张力思路。
   - physics-playground（MIT 宣称，正文未核实）：阻尼/弹跳量级参考。
   - 3DStackMotion（MIT 已核实）：堆叠展开 rotateX/Y + Z 拉开 + stagger。
   - CardSleightAnimation（无许可证）：双阈值回落 swoop（833ms/375ms）。
   - Scrapbook（无许可证）：纸纹三选一、拍立得微倾、胶带、日期戳、便签。
   - ui-demo（MIT 已核实）：翻面结构、弹簧数值参考、FLIP 共享布局思路。
   C 类一项没碰：无框架/WebGL/CDN/服务器/常驻动画/桌面交互/外链内容。 */
(function () {
'use strict';
var MARK = 'GROUP-AY-INTERACTIONS';
/* ── A1 常量（像素制单制；newton 980 / physics-playground 0.4 归一制 /
   ui-demo 0.3 每帧，三处单位不同，此处只取像素制并注明）── */
var GRAVITY = 980, DAMPING = 0.999, BOUNCE = 0.6, WALL_DAMP = 0.7;
/* B批禁emoji：UI 图标改用内联 SVG（currentColor，随文字颜色走） */
var AYIC = {
  cross: ['s', '<path d="M6 6l12 12M18 6 6 18"/>'],
  play: ['f', '<path d="M8 5v14l11-7z"/>'],
  pause: ['f', '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>']
};
var ayIc = function (n, sz) { var e = AYIC[n]; if (!e) return ''; var s = sz || 14; if (e[0] === 'f') return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" style="vertical-align:-2px;flex:none;" fill="currentColor" stroke="none">' + e[1] + '</svg>'; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" style="vertical-align:-2px;flex:none;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + e[1] + '</svg>'; };
var SUBSTEPS = 8, DT_MAX = 0.033, THROW_MAX_VX = 12, THROW_MAX_VY = 14;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function uid() { return 'ay' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function ayReduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
/* WAAPI 不可用环境（jsdom 等）的回退：直接置最终态并按约定时长 resolve */
function ayAnimate(el, frames, opts) {
  var dur = (opts && opts.duration) || 300;
  if (!el) return Promise.resolve();
  try {
    if (typeof el.animate === 'function') {
      var a = el.animate(frames, opts);
      if (a && a.finished && typeof a.finished.then === 'function') return a.finished.catch(function () {});
      return new Promise(function (r) { setTimeout(r, dur); });
    }
  } catch (e) {}
  var last = frames && frames[frames.length - 1];
  if (last) { if (last.transform !== undefined) el.style.transform = last.transform; if (last.opacity !== undefined) el.style.opacity = String(last.opacity); }
  return new Promise(function (r) { setTimeout(r, dur); });
}
/* ── A1 迷你 Verlet（纯函数；与补丁 R1 的 petStep fall 分支同一套数学）──
   状态沿用 W 组单位：vx/vy 为 px/16.7ms 帧；内部换算 px/s 积分后换回。
   质量按面积 m = r^2：桌宠半径固定，质量只影响注释与 API 形状，不另算。 */
function ayVerletStep(st, dtMs, o) {
  var s = {}; for (var k in st) s[k] = st[k];
  var opts = o || {};
  if (s.mode !== 'fall') return s;
  if (opts.reduced) { s.y = s.groundY; s.vy = 0; s.mode = 'walk'; return s; }
  var dt = Math.min(Math.max(0, dtMs || 0) / 1000, DT_MAX);
  var h = dt / SUBSTEPS, vx = (s.vx || 0) * 60, vy = (s.vy || 0) * 60;
  var x = s.x || 0, y = s.y || 0;
  var minX = opts.minX || 0, maxX = opts.maxX || 600, i;
  for (i = 0; i < SUBSTEPS; i++) {
    vy += GRAVITY * h; vx *= DAMPING; x += vx * h; y += vy * h;
    if (x < minX) { x = minX; vx = Math.abs(vx) * WALL_DAMP; }
    if (x > maxX) { x = maxX; vx = -Math.abs(vx) * WALL_DAMP; }
    if (y >= s.groundY) { y = s.groundY; if (Math.abs(vy) > 360) vy = -vy * BOUNCE; else vy = 0; }
  }
  s.x = x; s.y = y; s.vx = vx / 60; s.vy = vy / 60;
  if (s.y >= s.groundY && Math.abs(s.vy) < 0.01) { s.vy = 0; s.mode = 'walk'; }
  return s;
}
/* A1 松手初速度：最近几帧采样首尾位移（>=16ms 跨度才算），上限钳制 */
function ayThrowVelocity(samples) {
  if (!samples || samples.length < 2) return { vx: 0, vy: 0 };
  var a0 = samples[0], a1 = samples[samples.length - 1];
  var dt = Math.max(16, a1.t - a0.t);
  return {
    vx: clamp((a1.x - a0.x) / dt * 16.7, -THROW_MAX_VX, THROW_MAX_VX),
    vy: clamp((a1.y - a0.y) / dt * 16.7, -THROW_MAX_VY, THROW_MAX_VY)
  };
}
function ayTilt(dx) { return clamp(dx * 0.05, -15, 15); }
/* A12 动画期防重入 */
function ayGuard(el, ms) {
  if (!el) return;
  el.style.pointerEvents = 'none';
  setTimeout(function () { try { el.style.pointerEvents = ''; } catch (e) {} }, ms || 300);
}
/* A11 一次性微光/纸屑：寿命 180-300ms，落定即停，不常驻 */
function ayBurst(x, y, n, host) {
  if (ayReduced()) return;
  var box = host || document.body, i, p;
  for (i = 0; i < (n || 8); i++) {
    p = document.createElement('span');
    p.className = 'ay-burst-p';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = ['#f6c453', '#e8a87c', '#c9a06f', '#f2d492'][i % 4];
    box.appendChild(p);
    (function (el) {
      var ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 26;
      var life = 180 + Math.random() * 120;
      ayAnimate(el, [
        { transform: 'translate(0,0) scale(1)', opacity: '1' },
        { transform: 'translate(' + (Math.cos(ang) * dist).toFixed(1) + 'px,' + (Math.sin(ang) * dist).toFixed(1) + 'px) scale(.4)', opacity: '0' }
      ], { duration: life, easing: 'ease-out' }).then(function () { if (el.parentNode) el.parentNode.removeChild(el); });
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
    })(p);
  }
}
/* A11 成功反馈：只在用户主动操作成功时触发一次、可关闭 */
var _toastTimer = null;
function ayToast(msg) {
  var t = document.querySelector('.ay-toast');
  if (!t) {
    t = document.createElement('div'); t.className = 'ay-toast';
    t.innerHTML = '<span class="ay-toast-msg"></span><button type="button" aria-label="关闭">' + ayIc('cross',12) + '</button>';
    t.querySelector('button').addEventListener('click', function () { t.remove(); });
    document.body.appendChild(t);
  }
  t.querySelector('.ay-toast-msg').textContent = msg;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

/* ═══ A2 揉纸团扔掉（主落点：剧本“放弃记忆”）═══
   流程：捕获拦截放弃点击 → 原地 1.15s 揉皱到 0.82 倍 → 成为纸团（可拖可甩；
   不动则 1.25s 内自动飞出）→ 消失前点按 1.15s 展开回卡片（留轻微皱感）→
   飞出后才重派点击，走原 discardCurrent 落盘（真实删除，不改原逻辑）。
   一次只揉一张；点与拖用 6px 阈值区分；出界反弹 0.42 + 往回拉。 */
var crumpleActive = false, passThrough = false;
function crumpleDiscard(card, btn, onCommit) {
  if (crumpleActive) return false;
  crumpleActive = true;
  var done = false;
  function finish(commit) {
    if (done) return; done = true; crumpleActive = false;
    if (commit && onCommit) onCommit();
  }
  if (ayReduced()) { setTimeout(function () { finish(true); }, 60); return true; }
  card.style.setProperty('--ay-rot', (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4) + 'deg');
  card.classList.add('ay-crumpling');
  ayGuard(card, 2600);
  var ball = null, autoTimer = null;
  function toBall() {
    card.classList.remove('ay-crumpling');
    card.classList.add('ay-crumpled-ball');
    ball = { el: card, x0: 0, y0: 0, dx: 0, dy: 0, moved: 0, down: false, samples: [], lastX: 0, lastY: 0 };
    autoTimer = setTimeout(function () { if (!done) throwOut(null); }, 900);
  }
  function throwOut(vel) {
    if (done) return;
    if (autoTimer) clearTimeout(autoTimer);
    var r = card.getBoundingClientRect();
    var vw = window.innerWidth || 400, vh = window.innerHeight || 800;
    var v = vel || { vx: (Math.random() < 0.5 ? -1 : 1) * 260, vy: -320 };
    v.vx = clamp(v.vx, -600, 600); v.vy = clamp(v.vy, -600, 600);
    var tx = r.left + r.width / 2 + v.vx * 1.1, ty = r.top + r.height / 2 + v.vy * 1.1;
    /* 出界反弹 0.42 + 往回拉（不瞬移）：目标越界则以 0.42 折返 */
    if (tx < -40) tx = -40 + (-40 - tx) * 0.42;
    if (tx > vw + 40) tx = vw + 40 - (tx - vw - 40) * 0.42;
    if (ty < -40) ty = -40 + (-40 - ty) * 0.42;
    if (ty > vh + 40) ty = vh + 40 - (ty - vh - 40) * 0.42;
    var dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
    var rot = clamp(v.vx * 0.06, -40, 40);
    card.style.transition = 'none';
    ayAnimate(card, [
      { transform: 'translate(0px,0px) rotate(0deg) scale(.82)', opacity: '1' },
      { transform: 'translate(' + (dx * 0.5).toFixed(1) + 'px,' + (dy * 0.5 - 60).toFixed(1) + 'px) rotate(' + (rot * 0.6).toFixed(1) + 'deg) scale(.7)', opacity: '.9' },
      { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(.55)', opacity: '0' }
    ], { duration: 1250, easing: 'cubic-bezier(.2,.7,.3,1)' }).then(function () {
      card.style.visibility = 'hidden';
      var cr = card.getBoundingClientRect();
      ayBurst(clamp(cr.left + 20, 0, vw - 10), clamp(cr.top + 20, 0, vh - 10), 8);
      finish(true);
    });
  }
  function expandBack() {
    if (done) return;
    if (autoTimer) clearTimeout(autoTimer);
    card.classList.remove('ay-crumpled-ball');
    card.style.transition = 'transform 1.15s cubic-bezier(.215,.61,.355,1), opacity 1.15s ease';
    card.style.transform = ''; card.style.opacity = '';
    requestAnimationFrame(function () {
      card.style.transform = 'scale(1) rotate(0deg)';
      card.style.opacity = '1';
    });
    setTimeout(function () {
      card.style.transition = ''; card.style.transform = ''; card.style.opacity = '';
      card.classList.add('ay-wrinkled');
      finish(false);
    }, 1150);
  }
  setTimeout(toBall, 1150);
  /* 纸团阶段：Pointer Events 统一；touchmove preventDefault 只在纸团上 */
  var downPos = null, dragSamples = [];
  function onDown(e) {
    if (!ball || done) return;
    if (autoTimer) clearTimeout(autoTimer);
    downPos = { x: e.clientX, y: e.clientY, t: Date.now() };
    dragSamples = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    try { card.setPointerCapture && card.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  function onMove(e) {
    if (!downPos || !ball || done) return;
    if (e.cancelable) e.preventDefault();
    var dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    ball.moved = Math.max(ball.moved, Math.abs(dx) + Math.abs(dy));
    dragSamples.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (dragSamples.length > 5) dragSamples.shift();
    card.style.transition = 'none';
    card.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + ayTilt(dx).toFixed(1) + 'deg) scale(.82)';
  }
  function onUp(e) {
    if (!downPos || !ball || done) return;
    var wasTap = ball.moved < 6;
    var samples = dragSamples.slice();
    downPos = null;
    if (wasTap) { expandBack(); return; }
    var v = ayThrowVelocity(samples);
    throwOut({ vx: v.vx * 60, vy: v.vy * 60 });
  }
  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
  return true;
}
function bindDiscard() {
  document.addEventListener('click', function (e) {
    if (passThrough) return;
    var t = e.target;
    var btn = (t && t.closest) ? t.closest('[data-act="discard-memory"]') : null;
    if (!btn) return;
    var card = btn.closest('.sc-card');
    if (!card) return;
    e.preventDefault(); e.stopPropagation();
    if (crumpleActive) return;
    crumpleDiscard(card, btn, function () {
      passThrough = true;
      try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
      catch (err) { try { btn.click(); } catch (e2) {} }
      passThrough = false;
    });
  }, true);
}

/* ═══ A4 塔罗还牌 + 牌堆展开 ═══ */
var tarotDrag = null, tarotDragged = false, fanDetent = 7;
function setFanDetent(deg) {
  if ([0, 6, 15, 30].indexOf(deg) === -1) return false;
  fanDetent = deg;
  document.querySelectorAll('.tarot-ax-fan').forEach(function (f) { f.style.setProperty('--ay-fan-step', deg + 'deg'); });
  return true;
}
function tarotReturn(card, dx) {
  var far = Math.abs(dx) > 80;
  var h = card.getBoundingClientRect().height || 56;
  var scale = clamp(h / 180, 0.25, 1);
  var arcH = -120 * scale;
  var peak = clamp(dx * 0.15, -15, 15);
  var scatterX = (Math.random() * 10 - 5).toFixed(1), scatterR = (Math.random() * 6 - 3).toFixed(1);
  ayGuard(card, far ? 900 : 450);
  card.style.zIndex = '99';
  card.style.pointerEvents = 'none';
  var cur = card.style.transform || '';
  var anim;
  if (far) {
    /* 双阈值回落·远：833ms 四次方 ease-out 弧线 swoop 回堆底 */
    anim = ayAnimate(card, [
      { transform: cur + ' translate(' + dx.toFixed(1) + 'px,0px) rotate(' + ayTilt(dx).toFixed(1) + 'deg)', opacity: '1' },
      { transform: 'translate(' + (dx * 0.4).toFixed(1) + 'px,' + arcH.toFixed(1) + 'px) rotate(' + peak.toFixed(1) + 'deg)', opacity: '1' },
      { transform: 'translate(' + scatterX + 'px,0px) rotate(' + scatterR + 'deg)', opacity: '1' }
    ], { duration: 833, easing: 'cubic-bezier(.165,.84,.44,1)' });
  } else {
    /* 双阈值回落·近：375ms 三次方 ease-out 直线归位 */
    anim = ayAnimate(card, [
      { transform: 'translate(' + dx.toFixed(1) + 'px,0px) rotate(' + ayTilt(dx).toFixed(1) + 'deg)', opacity: '1' },
      { transform: 'translate(0px,0px) rotate(0deg)', opacity: '1' }
    ], { duration: 375, easing: 'cubic-bezier(.215,.61,.355,1)' });
  }
  anim.then(function () {
    card.style.transform = ''; card.style.zIndex = ''; card.style.pointerEvents = '';
  });
  return far ? 'swoop' : 'gentle';
}
function bindTarot() {
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    var card = (t && t.closest) ? t.closest('.tarot-ax-fan-card') : null;
    if (!card) return;
    var fan = card.closest('.tarot-ax-fan');
    if (!fan || !fan.classList.contains('tarot-ax-open')) return;
    tarotDrag = { card: card, x0: e.clientX, dx: 0, moved: 0 };
    tarotDragged = false;
    try { card.setPointerCapture && card.setPointerCapture(e.pointerId); } catch (err) {}
  });
  document.addEventListener('pointermove', function (e) {
    if (!tarotDrag) return;
    if (e.cancelable) e.preventDefault();
    tarotDrag.dx = e.clientX - tarotDrag.x0;
    tarotDrag.moved = Math.max(tarotDrag.moved, Math.abs(tarotDrag.dx));
    if (tarotDrag.moved > 6) tarotDragged = true;
    var c = tarotDrag.card;
    c.style.zIndex = '99';
    c.style.transform = 'translate(' + tarotDrag.dx.toFixed(1) + 'px,0px) rotate(' + ayTilt(tarotDrag.dx).toFixed(1) + 'deg)';
  }, { passive: false });
  document.addEventListener('pointerup', function () {
    if (!tarotDrag) return;
    var d = tarotDrag; tarotDrag = null;
    if (d.moved <= 6) { d.card.style.transform = ''; d.card.style.zIndex = ''; return; }
    tarotReturn(d.card, d.dx);
  });
  document.addEventListener('pointercancel', function () {
    if (!tarotDrag) return;
    var d = tarotDrag; tarotDrag = null;
    d.card.style.transform = ''; d.card.style.zIndex = '';
  });
  /* 拖过 6px 后的一次点击不触发选牌（wCard.onclick 在祖先上，捕获拦截） */
  document.addEventListener('click', function (e) {
    if (!tarotDragged) return;
    var t = e.target;
    if (t && t.closest && t.closest('.tarot-ax-fan-card')) {
      e.preventDefault(); e.stopPropagation(); tarotDragged = false;
    }
  }, true);
  /* 牌堆展开：点按堆叠底座切换展开/收拢（仪式散开/切牌进行中不打扰） */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var stack = (t && t.closest) ? t.closest('.tarot-ax-stack') : null;
    if (!stack) return;
    if (stack.classList.contains('tarot-ax-scattering') || stack.classList.contains('tarot-ax-cutting')) return;
    stack.classList.toggle('ay-stack-open');
  });
}

/* ═══ A6 拼贴日记页（最优先）═══
   画布模型：元素统一 {x,y,w,h,rotation,isLocked,zIndex} + 类型专属字段；
   纸纹点/网格/格纹三选一（纯 CSS 渐变）；荧光笔 1000ms / 20ms 步进 / 每步 2%；
   撤销/重做 400ms 防抖快照、上限 50 条；锁定只留一个解锁入口；多页模型
   savedAt 排序、打开落在空白新页、删页二次确认；localStorage 新键
   ay_collage_diary_v1（不用 IndexedDB）；导出 PNG 首版不做。 */
var CLG_KEY = 'ay_collage_diary_v1';
var clg = { pages: [], cur: 0, hist: [], hi: -1, snapTimer: null, sel: null, replaying: false, replayTimer: null };
function clgTodayStamp() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
}
function clgLoad() {
  try {
    var raw = localStorage.getItem(CLG_KEY);
    var data = raw ? JSON.parse(raw) : null;
    if (data && Array.isArray(data.pages)) { clg.pages = data.pages; return; }
  } catch (e) {}
  clg.pages = [];
}
function clgSave() {
  try { localStorage.setItem(CLG_KEY, JSON.stringify({ pages: clg.pages })); return true; }
  catch (e) { ayToast('保存失败：存储空间不足'); return false; }
}
function clgBlankPage() {
  return { id: uid(), title: '拼贴日记', savedAt: Date.now(), paper: 'dots', elements: [] };
}
function clgCur() { return clg.pages[clg.cur] || null; }
function clgSortPages() { clg.pages.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); }); }
function clgElDefaults(type) {
  var base = { id: uid(), type: type, x: 20, y: 20, w: 120, h: 120, rotation: 0, isLocked: false, zIndex: 1 };
  var pg = clgCur();
  var maxZ = 0;
  if (pg) pg.elements.forEach(function (e) { if (e.zIndex > maxZ) maxZ = e.zIndex; });
  base.zIndex = maxZ + 1;
  if (type === 'note') { base.w = 130; base.h = 130; base.rotation = Math.round(Math.random() * 12 - 6); base.text = '写点什么…'; }
  if (type === 'text') { base.w = 220; base.h = 90; base.rotation = 0; base.html = '正文…'; }
  if (type === 'stamp') { base.w = 118; base.h = 36; base.rotation = -3; base.text = clgTodayStamp(); }
  if (type === 'tape') { base.w = 96; base.h = 28; base.rotation = Math.round(Math.random() * 10 - 5); }
  if (type === 'photo') { base.w = 150; base.h = 176; base.rotation = Math.round(Math.random() * 20 - 10); base.src = ''; base.cap = clgTodayStamp(); }
  return base;
}
function clgSnapshot() { var pg = clgCur(); return pg ? JSON.stringify(pg.elements) : '[]'; }
function clgApplySnapshot(json) {
  var pg = clgCur(); if (!pg) return;
  try { pg.elements = JSON.parse(json); } catch (e) { return; }
  clgRender();
}
function clgPushHistory() {
  if (clg.snapTimer) clearTimeout(clg.snapTimer);
  clg.snapTimer = setTimeout(function () {
    var snap = clgSnapshot();
    if (clg.hist[clg.hi] === snap) return;
    clg.hist = clg.hist.slice(0, clg.hi + 1);
    clg.hist.push(snap);
    if (clg.hist.length > 50) clg.hist.shift();
    clg.hi = clg.hist.length - 1;
    clgUpdateCount();
  }, 400);
}
function clgPushHistoryNow() {
  if (clg.snapTimer) clearTimeout(clg.snapTimer);
  var snap = clgSnapshot();
  if (clg.hist[clg.hi] === snap) return;
  clg.hist = clg.hist.slice(0, clg.hi + 1);
  clg.hist.push(snap);
  if (clg.hist.length > 50) clg.hist.shift();
  clg.hi = clg.hist.length - 1;
  clgUpdateCount();
}
function clgUndo() {
  if (clg.hi <= 0) return false;
  clg.hi--; clgApplySnapshot(clg.hist[clg.hi]); clgSave(); clgUpdateCount(); return true;
}
function clgRedo() {
  if (clg.hi >= clg.hist.length - 1) return false;
  clg.hi++; clgApplySnapshot(clg.hist[clg.hi]); clgSave(); clgUpdateCount(); return true;
}
function clgUpdateCount() {
  var el = document.querySelector('.ay-collage-ov .ay-count');
  if (el) el.textContent = clg.hist.length + ' / 50';
  var pg = clgCur();
  var pl = document.querySelector('.ay-collage-ov .ay-page-label');
  if (pl && pg) pl.textContent = '第 ' + (clg.cur + 1) + ' 页 · 共 ' + clg.pages.length + ' 页';
}
function clgElHTML(e) {
  var st = 'left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px;transform:rotate(' + e.rotation + 'deg);z-index:' + e.zIndex + ';';
  var lock = e.isLocked ? ' ay-locked' : '';
  var sel = (clg.sel === e.id) ? ' ay-selected' : '';
  var chip = (e.isLocked && clg.sel === e.id) ? '<button type="button" class="ay-lock-chip" data-ay-act="unlock">解锁</button>' : '';
  if (e.type === 'note') return '<div class="ay-clg-el ay-clg-note' + lock + sel + '" data-ay-el="' + e.id + '" style="' + st + '">' + chip + '<div data-ay-text contenteditable="true">' + esc(e.text || '') + '</div></div>';
  if (e.type === 'text') return '<div class="ay-clg-el ay-clg-text' + lock + sel + '" data-ay-el="' + e.id + '" style="' + st + '">' + chip + '<div data-ay-text contenteditable="true">' + (e.html || '') + '</div></div>';
  if (e.type === 'stamp') return '<div class="ay-clg-el ay-clg-stamp' + lock + sel + '" data-ay-el="' + e.id + '" style="' + st + '">' + chip + '<span class="ay-date-stamp">' + esc(e.text || '') + '</span></div>';
  if (e.type === 'tape') return '<div class="ay-clg-el ay-clg-tape-el' + lock + sel + '" data-ay-el="' + e.id + '" style="' + st + '">' + chip + '</div>';
  if (e.type === 'photo') {
    var img = e.src
      ? '<img class="ay-clg-photo-img" data-ay-fallback="拍立得" src="' + esc(e.src) + '" alt="拍立得">'
      : '<div class="ay-img-fallback">拍立得 · 点“拍立得”上传照片</div>';
    return '<div class="ay-clg-el ay-clg-photo' + lock + sel + '" data-ay-el="' + e.id + '" style="' + st + '">' + chip + img + '<div class="ay-cap">' + esc(e.cap || '') + '</div></div>';
  }
  return '';
}
function clgRender() {
  var ov = document.querySelector('.ay-collage-ov');
  if (!ov) return;
  var pg = clgCur(); if (!pg) return;
  var cv = ov.querySelector('.ay-clg-canvas');
  cv.className = 'ay-clg-canvas ay-paper-' + (pg.paper || 'dots');
  var els = pg.elements.slice().sort(function (a, b) { return a.zIndex - b.zIndex; });
  cv.innerHTML = els.map(clgElHTML).join('') + (els.length ? '' : '<div class="ay-clg-empty">这一页还是空的。<br>点上面加便利贴、文本框、日期戳、胶带或拍立得，<br>拼出今天的日记页吧。</div>');
  var title = ov.querySelector('.ay-title');
  if (title && document.activeElement !== title) title.value = pg.title || '';
  clgUpdateCount();
}
function clgAdd(type, extra) {
  var pg = clgCur(); if (!pg) return null;
  var e = clgElDefaults(type);
  if (extra) for (var k in extra) e[k] = extra[k];
  e.x = 20 + Math.floor(Math.random() * 120); e.y = 20 + Math.floor(Math.random() * 160);
  pg.elements.push(e);
  pg.savedAt = Date.now(); clgSortPages(); clg.cur = clg.pages.indexOf(pg);
  clg.sel = e.id;
  clgRender(); clgPushHistoryNow(); clgSave();
  return e;
}
function clgFind(id) { var pg = clgCur(); if (!pg) return null; for (var i = 0; i < pg.elements.length; i++) if (pg.elements[i].id === id) return pg.elements[i]; return null; }
function clgDeleteSel() {
  var pg = clgCur(); if (!pg || !clg.sel) return false;
  var el = clgFind(clg.sel); if (!el) return false;
  var dom = document.querySelector('[data-ay-el="' + clg.sel + '"]');
  if (dom) { var r = dom.getBoundingClientRect(); ayBurst(r.left + r.width / 2, r.top + r.height / 2, 8); }
  pg.elements = pg.elements.filter(function (e) { return e.id !== clg.sel; });
  clg.sel = null;
  pg.savedAt = Date.now();
  clgRender(); clgPushHistoryNow(); clgSave();
  return true;
}
function clgHighlight() {
  var el = clgFind(clg.sel);
  if (!el || el.type !== 'text') { ayToast('先选一个文本框，再点荧光笔'); return false; }
  var dom = document.querySelector('[data-ay-el="' + el.id + '"] [data-ay-text]');
  if (!dom) return false;
  var sel = window.getSelection && window.getSelection();
  var done = false;
  function animateSpan(span) {
    var p = 0;
    span.style.backgroundSize = '0% 100%';
    var iv = setInterval(function () {
      p += 2;
      span.style.backgroundSize = Math.min(100, p) + '% 100%';
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(function () { span.classList.add('ay-hl-done'); el.html = dom.innerHTML; clgPushHistoryNow(); clgSave(); }, 100);
      }
    }, 20);
  }
  try {
    if (sel && sel.rangeCount && dom.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      if (!range.collapsed) {
        var span = document.createElement('span');
        span.className = 'ay-clg-hl';
        range.surroundContents(span);
        animateSpan(span);
        done = true;
      }
    }
  } catch (e) {}
  if (!done) {
    /* 无选区时标注重句：第一句（到第一个句号/感叹号/问号为止） */
    var txt = dom.textContent || '';
    var m = txt.match(/^[^。！？.!?]+[。！？.!?]?/);
    if (!m || !m[0]) { ayToast('这段文字没有可标注重句'); return false; }
    var first = m[0], rest = txt.slice(first.length);
    dom.innerHTML = '<span class="ay-clg-hl">' + esc(first) + '</span>' + esc(rest);
    el.html = dom.innerHTML;
    animateSpan(dom.querySelector('.ay-clg-hl'));
  }
  return true;
}
function openCollage() {
  clgLoad();
  clgSortPages();
  /* 打开落在空白新页：最新页已有内容就新建一页空白页 */
  if (!clg.pages.length) { clg.pages.unshift(clgBlankPage()); }
  else if (clg.pages[0].elements.length) { clg.pages.unshift(clgBlankPage()); }
  clg.cur = 0;
  clg.hist = [JSON.stringify(clg.pages[0].elements)]; clg.hi = 0;
  clg.sel = null;
  clgSave();
  if (document.querySelector('.ay-collage-ov')) { clgRender(); return; }
  var ov = document.createElement('div');
  ov.className = 'ay-collage-ov';
  ov.innerHTML =
    '<div class="ay-collage-top"><button type="button" class="ay-back" data-ay-act="close">‹ 返回</button>' +
    '<input class="ay-title" data-ay-act="title" value="拼贴日记" aria-label="标题">' +
    '<span class="ay-page-label" style="font-size:11px;color:#8a8a90;white-space:nowrap;"></span></div>' +
    '<div class="ay-collage-bar">' +
    '<button type="button" data-ay-act="add-note">便利贴</button>' +
    '<button type="button" data-ay-act="add-text">文本框</button>' +
    '<button type="button" data-ay-act="add-stamp">日期戳</button>' +
    '<button type="button" data-ay-act="add-tape">胶带</button>' +
    '<button type="button" data-ay-act="add-photo">拍立得</button>' +
    '<button type="button" data-ay-act="add-photo-camera">实拍入贴</button>' +
    '<button type="button" data-ay-act="highlight">荧光笔</button>' +
    '<button type="button" data-ay-act="undo">撤销</button>' +
    '<button type="button" data-ay-act="redo">重做</button>' +
    '<button type="button" data-ay-act="lock">锁定</button>' +
    '<button type="button" data-ay-act="expand">展开</button>' +
    '<button type="button" data-ay-act="del">删除</button>' +
    '<button type="button" data-ay-act="save">保存</button>' +
    '<button type="button" data-ay-act="prev-page">‹ 上一页</button>' +
    '<button type="button" data-ay-act="next-page">下一页 ›</button>' +
    '<button type="button" data-ay-act="new-page">＋ 新页</button>' +
    '<button type="button" data-ay-act="del-page">删页</button>' +
    '<button type="button" data-ay-act="replay">' + ayIc('play',12) + ' 回放</button>' +
    '<span class="ay-count">1 / 50</span></div>' +
    '<div class="ay-scrub-row" style="display:none;"><span>回放</span>' +
    '<input type="range" min="0" max="0" value="0" data-ay-act="scrub">' +
    '<select data-ay-act="speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select>' +
    '<button type="button" data-ay-act="play">' + ayIc('play',12) + ' 播放</button></div>' +
    '<div class="ay-collage-scroll"><div class="ay-clg-canvas ay-paper-dots"></div></div>' +
    '<input type="file" accept="image/*" class="ay-photo-input" style="display:none">';
  document.body.appendChild(ov);
  ov.addEventListener('click', clgToolbarClick);
  ov.querySelector('.ay-title').addEventListener('change', function (e) {
    var pg = clgCur(); if (!pg) return;
    pg.title = e.target.value || '拼贴日记'; pg.savedAt = Date.now(); clgSave();
  });
  ov.querySelector('.ay-photo-input').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { clgAdd('photo', { src: String(rd.result || '') }); };
    rd.readAsDataURL(f);
    e.target.value = '';
  });
  var cv = ov.querySelector('.ay-clg-canvas');
  cv.addEventListener('pointerdown', clgCanvasDown);
  ov.querySelector('[data-ay-act="scrub"]').addEventListener('input', function (e) {
    var v = parseInt(e.target.value || '0', 10);
    if (clg.hist[v] !== undefined) { clg.hi = v; clgApplySnapshot(clg.hist[v]); }
  });
  clgRender();
}
function closeCollage() {
  var ov = document.querySelector('.ay-collage-ov');
  if (ov) ov.parentNode.removeChild(ov);
  clgStopReplay();
  clg.sel = null;
}
function clgToolbarClick(e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-ay-act]') : null;
  if (!b) return;
  var act = b.getAttribute('data-ay-act');
  var pg = clgCur();
  if (act === 'close') { closeCollage(); return; }
  if (!pg) return;
  if (act === 'add-note') clgAdd('note');
  else if (act === 'add-text') clgAdd('text');
  else if (act === 'add-stamp') clgAdd('stamp');
  else if (act === 'add-tape') clgAdd('tape');
  else if (act === 'add-photo') { var inp = document.querySelector('.ay-collage-ov .ay-photo-input'); if (inp) inp.click(); }
  else if (act === 'add-photo-camera') { if (window.GroupBG) window.GroupBG.fillInputFromCamera('.ay-collage-ov .ay-photo-input'); }
  else if (act === 'highlight') clgHighlight();
  else if (act === 'undo') { if (!clgUndo()) ayToast('没有可撤销的了'); }
  else if (act === 'redo') { if (!clgRedo()) ayToast('没有可重做的了'); }
  else if (act === 'lock') {
    var le = clgFind(clg.sel);
    if (!le) { ayToast('先点选一个元素'); return; }
    le.isLocked = true; clgRender(); clgPushHistoryNow(); clgSave();
  }
  else if (act === 'unlock') {
    var ue = clgFind(clg.sel);
    if (ue) { ue.isLocked = false; clgRender(); clgPushHistoryNow(); clgSave(); }
  }
  else if (act === 'del') { if (!clgDeleteSel()) ayToast('先点选一个元素'); }
  else if (act === 'expand') clgExpandSel();
  else if (act === 'save') { if (clgSave()) ayToast('已保存'); }
  else if (act === 'prev-page') clgSwitchPage(-1);
  else if (act === 'next-page') clgSwitchPage(1);
  else if (act === 'new-page') { clg.pages.unshift(clgBlankPage()); clg.cur = 0; clg.hist = [JSON.stringify([])]; clg.hi = 0; clg.sel = null; clgSave(); clgRender(); }
  else if (act === 'del-page') clgDeletePage(b);
  else if (act === 'replay') {
    var row = document.querySelector('.ay-collage-ov .ay-scrub-row');
    if (row) { row.style.display = row.style.display === 'none' ? 'flex' : 'none'; clgSyncScrub(); }
  }
  else if (act === 'play') clgToggleReplay(b);
}
function clgSwitchPage(dir) {
  var n = clg.pages.length;
  if (n < 2) { ayToast('只有一页'); return; }
  clg.cur = (clg.cur + dir + n) % n;
  clg.hist = [JSON.stringify(clgCur().elements)]; clg.hi = 0; clg.sel = null;
  clgRender();
}
function clgDeletePage(btn) {
  if (!btn.getAttribute('data-ay-armed')) {
    btn.setAttribute('data-ay-armed', '1');
    btn.textContent = '再点一次确认删除';
    setTimeout(function () { btn.removeAttribute('data-ay-armed'); btn.textContent = '删页'; }, 3000);
    return;
  }
  clg.pages.splice(clg.cur, 1);
  if (!clg.pages.length) clg.pages.unshift(clgBlankPage());
  clg.cur = Math.min(clg.cur, clg.pages.length - 1);
  clg.hist = [JSON.stringify(clgCur().elements)]; clg.hi = 0; clg.sel = null;
  clgSave(); clgRender();
  ayToast('已删除这一页');
}
function clgSyncScrub() {
  var r = document.querySelector('.ay-collage-ov [data-ay-act="scrub"]');
  if (!r) return;
  r.max = String(Math.max(0, clg.hist.length - 1));
  r.value = String(clg.hi);
}
function clgStopReplay() {
  if (clg.replayTimer) { clearInterval(clg.replayTimer); clg.replayTimer = null; }
  clg.replaying = false;
  var b = document.querySelector('.ay-collage-ov [data-ay-act="play"]');
  if (b) b.innerHTML = ayIc('play',12) + ' 播放';
}
function clgToggleReplay(btn) {
  if (clg.replaying) { clgStopReplay(); clgApplySnapshot(clg.hist[clg.hist.length - 1]); clg.hi = clg.hist.length - 1; return; }
  if (clg.hist.length < 2) { ayToast('还没有可回放的步骤'); return; }
  clg.replaying = true;
  btn.innerHTML = ayIc('pause',12) + ' 停止';
  var speedSel = document.querySelector('.ay-collage-ov [data-ay-act="speed"]');
  var speed = parseFloat((speedSel && speedSel.value) || '1') || 1;
  var i = 0;
  clg.replayTimer = setInterval(function () {
    i++;
    if (i >= clg.hist.length) { clgStopReplay(); clgApplySnapshot(clg.hist[clg.hist.length - 1]); clg.hi = clg.hist.length - 1; return; }
    clg.hi = i; clgApplySnapshot(clg.hist[i]); clgSyncScrub();
  }, Math.round(400 / speed));
}
/* 拼贴画布拖拽：Pointer Events 统一；6px 区分点与拖；长按 500ms 出菜单 */
var clgDrag = null, clgLpTimer = null;
function clgCanvasDown(e) {
  var cv = e.currentTarget;
  var t = e.target;
  var elDom = (t && t.closest) ? t.closest('[data-ay-el]') : null;
  if (!elDom) { clg.sel = null; clgRender(); return; }
  var id = elDom.getAttribute('data-ay-el');
  var el = clgFind(id);
  if (!el) return;
  clg.sel = id;
  clgRender();
  if (el.isLocked) return;
  var r = cv.getBoundingClientRect();
  clgDrag = { id: id, x0: e.clientX, y0: e.clientY, elX: el.x, elY: el.y, moved: 0, r: r };
  try { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
  if (clgLpTimer) clearTimeout(clgLpTimer);
  clgLpTimer = setTimeout(function () {
    if (clgDrag && clgDrag.moved < 6) clgShowMenu(id, e.clientX, e.clientY);
  }, 500);
}
function clgShowMenu(id, x, y) {
  clgCloseMenu();
  var m = document.createElement('div');
  m.className = 'ay-ctx-menu';
  m.innerHTML = '<button type="button" data-ay-m="lock">锁定</button>' +
    '<button type="button" data-ay-m="top">置顶</button>' +
    '<button type="button" data-ay-m="expand">展开查看</button>' +
    '<button type="button" data-ay-m="del">删除</button>';
  m.style.left = Math.min(window.innerWidth - 170, Math.max(8, x)) + 'px';
  m.style.top = Math.min(window.innerHeight - 180, Math.max(8, y)) + 'px';
  document.body.appendChild(m);
  m.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ay-m]');
    if (!b) return;
    var act = b.getAttribute('data-ay-m');
    var el = clgFind(id);
    clgCloseMenu();
    if (!el) return;
    if (act === 'lock') { el.isLocked = true; clgRender(); clgPushHistoryNow(); clgSave(); }
    if (act === 'top') { var mx = 0; clgCur().elements.forEach(function (o) { if (o.zIndex > mx) mx = o.zIndex; }); el.zIndex = mx + 1; clgRender(); clgPushHistoryNow(); clgSave(); }
    if (act === 'expand') { clg.sel = id; clgExpandSel(); }
    if (act === 'del') { clg.sel = id; clgDeleteSel(); }
  });
  setTimeout(function () {
    document.addEventListener('pointerdown', function h(ev) {
      if (!m.contains(ev.target)) { clgCloseMenu(); document.removeEventListener('pointerdown', h, true); }
    }, true);
  }, 0);
}
function clgCloseMenu() { var m = document.querySelector('.ay-ctx-menu'); if (m) m.remove(); }
function clgBindGlobal() {
  document.addEventListener('pointermove', function (e) {
    if (!clgDrag) return;
    if (e.cancelable) e.preventDefault();
    var d = clgDrag;
    var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    if (clgLpTimer && d.moved >= 6) { clearTimeout(clgLpTimer); clgLpTimer = null; }
    if (d.moved < 6) return;
    var el = clgFind(d.id);
    if (!el) return;
    el.x = Math.round(d.elX + dx); el.y = Math.round(d.elY + dy);
    var dom = document.querySelector('[data-ay-el="' + d.id + '"]');
    if (dom) { dom.style.left = el.x + 'px'; dom.style.top = el.y + 'px'; }
  }, { passive: false });
  function endDrag() {
    if (clgLpTimer) { clearTimeout(clgLpTimer); clgLpTimer = null; }
    if (!clgDrag) return;
    var moved = clgDrag.moved >= 6;
    clgDrag = null;
    if (moved) { var pg = clgCur(); if (pg) pg.savedAt = Date.now(); clgPushHistoryNow(); clgSave(); }
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  /* 文本编辑提交：失焦/输入后防抖落盘（只在拼贴画布内） */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var ed = t.closest('[data-ay-text]');
    if (!ed) return;
    var host = ed.closest('[data-ay-el]');
    if (!host) return;
    var el = clgFind(host.getAttribute('data-ay-el'));
    if (!el) return;
    if (el.type === 'note') el.text = ed.textContent;
    else if (el.type === 'text') el.html = ed.innerHTML;
    clgPushHistory();
    if (clg.snapTimer) { /* 落盘跟随快照防抖 */ }
    setTimeout(function () { clgSave(); }, 450);
  });
}
/* A8 FLIP 展开：从元素位置展开为详情页；关闭键是唯一返回键 */
function flipExpand(sourceEl, title, bodyHTML) {
  if (!sourceEl) return null;
  var r = sourceEl.getBoundingClientRect();
  var ov = document.createElement('div');
  ov.className = 'ay-expand-ov';
  ov.innerHTML = '<div class="ay-expand-card"><button type="button" class="ay-expand-close">‹ 返回</button>' +
    '<div class="ay-expand-title">' + esc(title) + '</div><div class="ay-expand-body">' + bodyHTML + '</div></div>';
  document.body.appendChild(ov);
  var card = ov.querySelector('.ay-expand-card');
  var cr = card.getBoundingClientRect();
  var dx = r.left + r.width / 2 - (cr.left + cr.width / 2);
  var dy = r.top + r.height / 2 - (cr.top + cr.height / 2);
  var sx = clamp(r.width / Math.max(1, cr.width), 0.05, 1);
  var sy = clamp(r.height / Math.max(1, cr.height), 0.05, 1);
  card.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  card.style.opacity = '0.3';
  requestAnimationFrame(function () {
    card.style.transition = 'transform .3s cubic-bezier(.2,.7,.3,1), opacity .3s ease';
    card.style.transform = ''; card.style.opacity = '1';
  });
  ov.querySelector('.ay-expand-close').addEventListener('click', function () {
    card.style.transition = 'transform .25s ease, opacity .25s ease';
    card.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    card.style.opacity = '0';
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
  });
  return ov;
}
function clgExpandSel() {
  var el = clgFind(clg.sel);
  if (!el) { ayToast('先点选一个元素'); return; }
  var dom = document.querySelector('[data-ay-el="' + el.id + '"]');
  var title = { note: '便利贴', text: '文本框', stamp: '日期戳', tape: '胶带', photo: '拍立得' }[el.type] || '元素';
  var body = '';
  if (el.type === 'note') body = esc(el.text || '');
  else if (el.type === 'text') body = (el.html || '').replace(/<[^>]+>/g, '');
  else if (el.type === 'stamp') body = '日期戳：' + esc(el.text || '');
  else if (el.type === 'tape') body = '装饰胶带（压边用，无文字）。';
  else if (el.type === 'photo') body = '拍立得 · ' + esc(el.cap || '') + (el.src ? '' : '\n（还没有照片）');
  body += '\n\n—— 位置 ' + el.x + ',' + el.y + ' · 旋转 ' + el.rotation + '° · 层级 ' + el.zIndex + (el.isLocked ? ' · 已锁定' : '');
  flipExpand(dom, title, esc(body));
}

/* ═══ A9 标签页/视图切换：指示条弹簧滑动 + 面板横滑 ═══
   弹簧 stiffness 400 / damping 30 用 CSS 三次贝塞尔近似
   cubic-bezier(.34,1.56,.64,1)；落点：剧本 .sc-tab、塔罗 .tarot-ax-chip。 */
function ayMoveIndicator(row, target) {
  if (!row || !target) return;
  var ind = row.querySelector(':scope > .ay-tab-indicator');
  if (!ind) {
    ind = document.createElement('div');
    ind.className = 'ay-tab-indicator';
    row.appendChild(ind);
  }
  ind.style.left = target.offsetLeft + 'px';
  ind.style.width = target.offsetWidth + 'px';
}
function bindTabs() {
  document.addEventListener('click', function (e) {
    var t = e.target;
    var tab = (t && t.closest) ? t.closest('.sc-tab, .tarot-ax-chip') : null;
    if (!tab) return;
    var row = tab.closest('.sc-tabrow, .tarot-ax-chip-row');
    if (!row) return;
    ayMoveIndicator(row, tab);
    var panel = row.parentElement;
    if (panel) {
      panel.classList.remove('ay-panel-slide-in');
      void panel.offsetWidth;
      panel.classList.add('ay-panel-slide-in');
    }
    /* 宿主重渲染后（剧本 _refresh / 塔罗 updateView）再对准一次 */
    setTimeout(function () {
      var row2 = document.querySelector('.sc-tabrow, .tarot-ax-chip-row');
      if (!row2) return;
      var active = row2.querySelector('.sc-tab.on, .tarot-ax-chip.tarot-ax-active');
      if (active) ayMoveIndicator(row2, active);
    }, 80);
  });
}

/* ═══ A10 纸面装饰（克制）+ A3 红折痕图例 + A6 记忆树一次轻展 ═══ */
function applyDecor() {
  document.querySelectorAll('.gB-lpage:not([data-ay-decor])').forEach(function (el) {
    el.setAttribute('data-ay-decor', '1');
    el.classList.add('ay-paper-dots', 'ay-paper-host');
    var tape = document.createElement('span');
    tape.className = 'ay-tape ay-tape-corner';
    el.appendChild(tape);
  });
  document.querySelectorAll('.gm-plank:not([data-ay-decor])').forEach(function (el) {
    el.setAttribute('data-ay-decor', '1');
    el.classList.add('ay-paper-host');
    var tape = document.createElement('span');
    tape.className = 'ay-tape ay-tape-corner';
    el.appendChild(tape);
  });
  document.querySelectorAll('.sc-card:not([data-ay-decor])').forEach(function (el) {
    el.setAttribute('data-ay-decor', '1');
    el.classList.add('ay-paper-host');
    var tape = document.createElement('span');
    tape.className = 'ay-tape ay-tape-corner';
    el.appendChild(tape);
  });
  /* A3 红折痕图例：只加在信件牌组视图（写信心路/档案页的折痕示意同款） */
  document.querySelectorAll('.gB-deck:not([data-ay-decor])').forEach(function (deck) {
    deck.setAttribute('data-ay-decor', '1');
    var legend = document.createElement('div');
    legend.className = 'ay-crease-legend';
    legend.innerHTML = '<svg width="46" height="18" viewBox="0 0 46 18" aria-hidden="true">' +
      '<line x1="2" y1="6" x2="44" y2="6" stroke="#b3543f" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<line x1="2" y1="12" x2="44" y2="12" stroke="#b3543f" stroke-width="1.5" stroke-dasharray="4 3"/></svg>' +
      '<span>折痕示意：三折 · 沿红线翻折（0.8s）</span>';
    if (deck.parentNode) deck.parentNode.insertBefore(legend, deck.nextSibling);
  });
  /* 拼贴日记入口：注入此刻日记书本容器（只注入一次） */
  document.querySelectorAll('.ck-diary-wrap:not([data-ay-entry])').forEach(function (wrap) {
    wrap.setAttribute('data-ay-entry', '1');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ay-collage-entry';
    b.textContent = '拼贴日记页';
    b.style.cssText = 'margin:8px 0;padding:8px 14px;border:1px solid #ececef;background:#fff;border-radius:999px;font-size:13px;color:#25262a;cursor:pointer;';
    b.addEventListener('click', function () { openCollage(); });
    wrap.insertBefore(b, wrap.firstChild);
  });
  /* A6 记忆树进入该屏时一次轻微展开（禁止滚动全程联动） */
  var mtRoot = document.getElementById('ck-memtree-root');
  if (mtRoot && !mtRoot.getAttribute('data-ay-mt')) {
    mtRoot.setAttribute('data-ay-mt', '1');
    try {
      if (typeof IntersectionObserver !== 'undefined') {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              var tree = mtRoot.querySelector('.gm-mt-tree');
              if (tree) tree.classList.add('ay-mt-enter');
              io.disconnect();
            }
          });
        }, { threshold: 0.2 });
        io.observe(mtRoot);
      }
    } catch (e) {}
  }
  injectPendulum();
}
var _decorLast = 0;
function bindDecorObserver() {
  function run() {
    var now = Date.now();
    if (now - _decorLast < 300) return;
    _decorLast = now;
    try { applyDecor(); } catch (e) {}
  }
  try {
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      var mo = new MutationObserver(run);
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (e) {}
  run();
  setTimeout(run, 1000);
  setTimeout(run, 3000);
}

/* ═══ A11 单摆小玩具（3D 家 #ot-stage 右上角；点一下摆动、阻尼停）═══ */
var pendSwinging = false;
function injectPendulum() {
  var home = document.getElementById('wx-otome-home');
  var stage = document.getElementById('ot-stage');
  if (!home || !stage) return;
  if (!home.classList.contains('wx-active')) return;
  if (stage.querySelector('.ay-pendulum')) return;
  var p = document.createElement('div');
  p.className = 'ay-pendulum';
  p.setAttribute('role', 'button');
  p.setAttribute('title', '点一下，单摆摆动后停下');
  p.innerHTML = '<div class="ay-pend-swing" style="transform-origin:top center;">' +
    '<span class="ay-pend-string"></span><span class="ay-pend-bob"></span></div>' +
    '<div class="ay-pend-label">单摆 · 点我</div>';
  p.addEventListener('click', function (e) {
    e.stopPropagation();
    if (pendSwinging || ayReduced()) return;
    pendSwinging = true;
    p.classList.add('ay-taut');
    setTimeout(function () { p.classList.remove('ay-taut'); }, 600);
    var sw = p.querySelector('.ay-pend-swing');
    ayAnimate(sw, [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(18deg)' }, { transform: 'rotate(-15deg)' },
      { transform: 'rotate(11deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(4deg)' },
      { transform: 'rotate(-2deg)' }, { transform: 'rotate(0deg)' }
    ], { duration: 2400, easing: 'ease-out' }).then(function () { pendSwinging = false; });
    setTimeout(function () { pendSwinging = false; }, 2600);
  });
  stage.appendChild(p);
}
/* A11 拖动落点提示：桌宠拖拽时在书桌处显示回座提示环 */
function bindPetHint() {
  var hint = null;
  document.addEventListener('pointermove', function () {
    var pet = document.getElementById('desk-pet');
    var desk = document.getElementById('gw-desk');
    var dragging = pet && pet.classList.contains('gw-dragging');
    if (!dragging || !desk) { if (hint) hint.style.display = 'none'; return; }
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'ay-drop-hint';
      document.body.appendChild(hint);
    }
    var r = desk.getBoundingClientRect();
    hint.style.display = 'block';
    hint.style.left = (r.left + r.width / 2 - 35) + 'px';
    hint.style.top = (r.top + r.height / 2 - 35) + 'px';
    hint.style.width = '70px'; hint.style.height = '70px';
  });
  document.addEventListener('pointerup', function () { if (hint) hint.style.display = 'none'; });
}

/* ═══ A8 懒渲染 + 离线图失败文字占位；A12 Resize 节流 ═══ */
function bindImgFallback() {
  /* 捕获阶段监听资源错误：带 data-ay-fallback 的图失败时换文字占位 */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (!t.getAttribute('data-ay-fallback')) return;
    var fb = document.createElement('div');
    fb.className = 'ay-img-fallback';
    fb.textContent = '图片离线不可用 · 文字占位：' + t.getAttribute('data-ay-fallback');
    if (t.parentNode) t.parentNode.replaceChild(fb, t);
  }, true);
}
var _rszLast = 0;
function bindResize() {
  window.addEventListener('resize', function () {
    var now = Date.now();
    if (now - _rszLast < 100) return;
    _rszLast = now;
    try { setFanDetent(fanDetent); } catch (e) {}
    if (document.querySelector('.ay-collage-ov')) clgRender();
  });
}

/* ═══ 初始化与导出 ═══ */
function initAY() {
  bindDiscard();
  bindTarot();
  clgBindGlobal();
  bindTabs();
  bindDecorObserver();
  bindImgFallback();
  bindResize();
  bindPetHint();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAY);
else initAY();
window.GroupAY = {
  MARK: MARK,
  verlet: ayVerletStep, throwVelocity: ayThrowVelocity, tilt: ayTilt,
  crumpleDiscard: crumpleDiscard, flipExpand: flipExpand,
  openCollage: openCollage, closeCollage: closeCollage,
  setFanDetent: setFanDetent, tarotReturn: tarotReturn,
  burst: ayBurst, toast: ayToast, guard: ayGuard,
  clgLoad: clgLoad, clgSave: clgSave, clgAdd: clgAdd,
  clgUndo: clgUndo, clgRedo: clgRedo, clgHighlight: clgHighlight,
  constants: { gravity: GRAVITY, damping: DAMPING, bounce: BOUNCE, wall: WALL_DAMP, substeps: SUBSTEPS, dtMax: DT_MAX },
  SKIPPED: [
    'A5 明信片册整项：AW 未合入，工作文件无明信片册（无 cike_postcards_v1），无锚点可改',
    'A3 档案翻页：AW 未合入，无刑侦人物档案/翻阅记录',
    'A8 论坛报纸文章：AW 未合入；世界书条目：世界书是 data: URL iframe，AY 够不到内部',
    'A9 信件“成品/写信心路”两视图：AW 未合入，无该视图',
    'A10 论坛报纸纸纹 / 档案页点缀：AW 未合入，无锚点'
  ],
  _pure: { ayVerletStep: ayVerletStep, ayThrowVelocity: ayThrowVelocity, ayTilt: ayTilt }
};
})();
