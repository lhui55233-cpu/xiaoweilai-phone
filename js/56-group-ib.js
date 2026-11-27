
/* ══════════ GROUP-IB · Internal Beyond 融合层（本地实现） ══════════
   设计与样式参考 Sui 的 Internal Beyond（github.com/Sui-IB/InternalBeyond），
   PolyForm Noncommercial 1.0.0 / CC BY-NC-SA 4.0，已按本项目修改。
   Required Notice: Copyright © 2025–2026 Sui. Internal Beyond (https://github.com/Sui-IB/InternalBeyond)
   仅个人非商业使用；公开分享改编部分时按 CC BY-NC-SA 4.0 相同方式共享。
   只借思路、自己写代码，未复制原仓库代码、美术、演示数据与固定台词；
   未拿：全部图片美术、Sui 的名字/形象、演示数据、项目名/Logo、“IB”字样、
   15 个 provider 元数据、QQ/DSH/Voicebox/Android、需服务器的功能。
   记忆评分数字不抄（原仓库 docs/MEMORY.md 是历史版，本次不改召回打分）。 */
(function () {
  'use strict';
  var MARK = 'GROUP-IB';
  /* D 批禁 emoji：月相/关闭改线稿 SVG（月亮取 js/64-ui-vector-icons 的月亮线稿）。 */
  var IB_MOON_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/></svg>';
  var IB_X_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hashStr(s) { var h = 2166136261; s = String(s || ''); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }
  function dkey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* ── 月相（token 化：颜色只走 --ib-moon-*，JS 与 SVG/CSS 的契约是 CSS 变量）── */
  var MOON_NAMES = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
  function moonPhase(date) {
    var d = date instanceof Date ? date : new Date(date);
    var syn = 29.530588853;
    var ref = Date.UTC(2000, 0, 6, 18, 14, 0);
    var age = ((d.getTime() - ref) / 86400000) % syn;
    if (age < 0) age += syn;
    var illum = (1 - Math.cos(2 * Math.PI * age / syn)) / 2;
    var idx = Math.floor(((age / syn) * 8 + 0.5)) % 8;
    return { age: age, illum: illum, name: MOON_NAMES[idx], idx: idx };
  }

  /* ── 静谧模式 body.quiet：关背景动效、玻璃模糊、长过渡；开关在设置里，持久化在 phone_settings_v3.quietMode ── */
  function readQuiet() { var s = lsGet('phone_settings_v3', {}); return !!(s && s.quietMode); }
  function applyQuiet(on) { try { document.body.classList.toggle('quiet', !!on); } catch (e) {} return !!on; }
  function isQuiet() { try { return document.body.classList.contains('quiet'); } catch (e) { return false; } }
  function reducedMotion() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

  /* ── 音乐 48 频段波形（WebAudio AnalyserNode；只画真实频谱数据，不编假波形）── */
  var wave = { canvas: null, analyser: null, ctx: null, raf: 0, last: null, active: false };
  function waveColor() { try { var v = getComputedStyle(document.documentElement).getPropertyValue('--ib-token-accent-brand') || ''; v = v.trim(); return v || '#5c6884'; } catch (e) { return '#5c6884'; } }
  function ensureWaveCanvas() {
    var old = document.getElementById('ib-wave');
    if (old) { wave.canvas = old; return old; }
    var anchor = null, parent = null;
    try { anchor = document.querySelector('.ins-echo .echo-deck') || document.querySelector('.echo-deck'); if (anchor) parent = anchor.parentNode; } catch (e) {}
    if (!anchor) { try { anchor = document.getElementById('groupp-music-beat'); if (anchor) parent = anchor.parentNode; } catch (e) {} }
    if (!anchor || !parent) return null;
    var c = document.createElement('canvas');
    c.id = 'ib-wave'; c.className = 'ib-wave'; c.width = 620; c.height = 44;
    c.setAttribute('aria-label', '48 频段波形');
    c.title = '48 频段波形（随播放实时变化；减弱动态效果时静止）';
    parent.insertBefore(c, anchor.nextSibling);
    wave.canvas = c;
    return c;
  }
  function drawWave(data) {
    var c = wave.canvas || document.getElementById('ib-wave');
    if (c) wave.canvas = c;
    var arr = [];
    for (var i = 0; i < 48; i++) { var v = (data && data[i] != null) ? data[i] : 0; arr.push(Math.max(0, Math.min(255, v > 1 ? v : v * 255))); }
    wave.last = arr.slice();
    if (!c) return false;
    var ctx = null;
    try { ctx = c.getContext('2d'); } catch (e) {}
    if (!ctx) return true; /* jsdom 没有 2d 上下文：几何已记在 wave.last，真机上画 */
    var W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = waveColor();
    ctx.globalAlpha = 0.68;
    var bw = W / 48;
    for (var j = 0; j < 48; j++) { var h = Math.max(2, (arr[j] / 255) * (H - 4)); ctx.fillRect(j * bw + 1, (H - h) / 2, Math.max(1, bw - 2), h); }
    ctx.globalAlpha = 1;
    return true;
  }
  function waveTick() {
    if (!wave.active) return;
    if (!wave.analyser) { wave.active = false; return; }
    if (reducedMotion()) { wave.active = false; return; }
    try {
      var buf = new Uint8Array(wave.analyser.frequencyBinCount);
      wave.analyser.getByteFrequencyData(buf);
      var out = [];
      for (var i = 0; i < 48; i++) out.push(buf[Math.floor(i * buf.length / 48)]);
      drawWave(out);
    } catch (e) {}
    wave.raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 50); })(waveTick);
  }
  function waveStart() {
    ensureWaveCanvas();
    if (!wave.analyser) return false;
    if (reducedMotion()) { drawWave(new Array(48).fill(0)); return true; }
    if (wave.active) return true;
    wave.active = true;
    waveTick();
    return true;
  }
  function waveStop() {
    wave.active = false;
    try { if (wave.raf) (window.cancelAnimationFrame || clearTimeout)(wave.raf); } catch (e) {}
    drawWave(new Array(48).fill(0));
  }
  function attachFix11() {
    /* FIX-11 银灰余音唯一播放器：走它共享的 <audio>，MediaElementSource 只建一次 */
    try {
      if (!window.GroupFIX11 || !GroupFIX11._audio) return false;
      var audio = GroupFIX11._audio();
      if (!audio || audio.__ibSrc) return !!wave.analyser;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      var ctx = new AC();
      var src = ctx.createMediaElementSource(audio);
      var an = ctx.createAnalyser();
      an.fftSize = 256; an.smoothingTimeConstant = 0.8;
      src.connect(an); an.connect(ctx.destination);
      audio.__ibSrc = true;
      wave.ctx = ctx; wave.analyser = an;
      audio.addEventListener('play', waveStart);
      audio.addEventListener('pause', waveStop);
      audio.addEventListener('ended', waveStop);
      if (!audio.paused) waveStart();
      return true;
    } catch (e) { return false; }
  }
  function wrapGroupP() {
    /* FIX-11 合入前：GD 合成播放器每次播放都新建 AnalyserNode 并交给 GroupP.musicAttach；
       包一层捕获它，不改 GD 原代码，不另起播放器。 */
    try {
      if (!window.GroupP || window.GroupP.__ibWrapped) return false;
      var origAttach = window.GroupP.musicAttach, origStop = window.GroupP.musicStop;
      window.GroupP.musicAttach = function (ctx, analyser) {
        try { if (origAttach) origAttach.apply(window.GroupP, arguments); } catch (e) {}
        wave.analyser = analyser || null;
        if (analyser) waveStart();
      };
      window.GroupP.musicStop = function () {
        try { if (origStop) origStop.apply(window.GroupP, arguments); } catch (e) {}
        wave.analyser = null;
        waveStop();
      };
      window.GroupP.__ibWrapped = true;
      return true;
    } catch (e) { return false; }
  }

  /* ── 日历悬浮窗 + 挂历（读 phone_schedule_v1，只读；月相 token 化）── */
  var calState = { y: 0, m: 0, wall: false };
  function calLoadSched() { var a = lsGet('phone_schedule_v1', []); return Array.isArray(a) ? a : []; }
  function calCells(y, m) {
    var first = new Date(y, m, 1);
    var startDay = first.getDay();
    var dim = new Date(y, m + 1, 0).getDate();
    var prevDim = new Date(y, m, 0).getDate();
    var sched = calLoadSched();
    var set = {};
    sched.forEach(function (s) { if (s && s.date) set[s.date] = true; });
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var dnum = i - startDay + 1, dt, inM = true;
      if (dnum < 1) { dt = new Date(y, m - 1, prevDim + dnum); inM = false; }
      else if (dnum > dim) { dt = new Date(y, m + 1, dnum - dim); inM = false; }
      else dt = new Date(y, m, dnum);
      var key = dkey(dt);
      cells.push({ date: dt, key: key, inMonth: inM, day: dt.getDate(), hasSched: !!set[key], moon: moonPhase(dt) });
    }
    return cells;
  }
  function renderCalendarHTML(y, m, wall) {
    var now = new Date();
    var todayKey = dkey(now);
    var cells = calCells(y, m);
    var wd = ['日', '一', '二', '三', '四', '五', '六'];
    var moonToday = moonPhase(now);
    var h = '<div class="ib-cal-float ib-fade-in' + (wall ? ' ib-cal-wall' : '') + '" id="ib-cal-float" role="dialog" aria-label="日历悬浮窗">'
      + '<div class="ib-cal-head" id="ib-cal-head"><span class="ib-cal-title">' + y + '年' + (m + 1) + '月</span>'
      + '<button type="button" class="ib-cal-btn ib-press" data-ib-cal="wall">' + (wall ? '月历' : '挂历') + '</button>'
      + '<button type="button" class="ib-cal-btn ib-press" data-ib-cal="prev">‹ 上月</button>'
      + '<button type="button" class="ib-cal-btn ib-press" data-ib-cal="next">下月 ›</button>'
      + '<button type="button" class="ib-cal-btn ib-press" data-ib-cal="mini">— 收起</button>'
      + '<button type="button" class="ib-cal-btn ib-press" data-ib-cal="close">' + IB_X_SVG + '</button></div>'
      + '<div class="ib-cal-body"><div class="ib-cal-grid">'
      + wd.map(function (w) { return '<div class="ib-cal-wd">' + w + '</div>'; }).join('')
      + cells.map(function (c) {
          return '<div class="ib-cal-day' + (c.inMonth ? '' : ' out') + (c.key === todayKey ? ' today' : '') + '" title="' + c.key + ' · ' + c.moon.name + '（照亮 ' + Math.round(c.moon.illum * 100) + '%）">'
            + '<span>' + c.day + '</span>'
            + (c.hasSched ? '<span class="ib-dot" title="这天有日程"></span>' : '<span class="ib-moon">' + IB_MOON_SVG + '</span>')
            + '</div>';
        }).join('')
      + '</div><div class="ib-cal-foot">今天 ' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + moonToday.name + '（照亮 ' + Math.round(moonToday.illum * 100) + '%）'
      + ' · 圆点是有日程的日子 · 可拖动标题栏移动，收起后变成小浮条。</div></div></div>';
    return h;
  }
  function calMiniHTML() {
    var now = new Date();
    var moon = moonPhase(now);
    return '<div class="ib-cal-mini ib-press" id="ib-cal-mini" role="button" tabindex="0">' + IB_MOON_SVG + ' ' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + moon.name + ' · 日历</div>';
  }
  function openCalendar() {
    var old = document.getElementById('ib-cal-float');
    if (old) { old.style.display = ''; var mn = document.getElementById('ib-cal-mini'); if (mn) mn.remove(); return old; }
    var now = new Date();
    calState.y = now.getFullYear(); calState.m = now.getMonth();
    var tmp = document.createElement('div');
    tmp.innerHTML = renderCalendarHTML(calState.y, calState.m, calState.wall);
    var ov = tmp.firstElementChild;
    var pos = lsGet('ib_cal_pos_v1', null);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') { ov.style.left = pos.x + 'px'; ov.style.top = pos.y + 'px'; }
    else { ov.style.right = '12px'; ov.style.top = '86px'; }
    document.body.appendChild(ov);
    bindCalendar(ov);
    return ov;
  }
  function rerenderCalendar() {
    var ov = document.getElementById('ib-cal-float');
    if (!ov) return;
    var left = ov.style.left, top = ov.style.top, right = ov.style.right;
    var tmp = document.createElement('div');
    tmp.innerHTML = renderCalendarHTML(calState.y, calState.m, calState.wall);
    var next = tmp.firstElementChild;
    if (left) next.style.left = left; if (top) next.style.top = top; if (right) next.style.right = right;
    ov.parentNode.replaceChild(next, ov);
    bindCalendar(next);
  }
  function bindCalendar(ov) {
    ov.querySelectorAll('[data-ib-cal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-ib-cal');
        if (act === 'prev') { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } rerenderCalendar(); }
        else if (act === 'next') { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } rerenderCalendar(); }
        else if (act === 'wall') { calState.wall = !calState.wall; rerenderCalendar(); }
        else if (act === 'close') { ov.remove(); var mn = document.getElementById('ib-cal-mini'); if (mn) mn.remove(); }
        else if (act === 'mini') {
          ov.style.display = 'none';
          if (!document.getElementById('ib-cal-mini')) {
            var tmp = document.createElement('div');
            tmp.innerHTML = calMiniHTML();
            var mini = tmp.firstElementChild;
            document.body.appendChild(mini);
            mini.addEventListener('click', function () { mini.remove(); ov.style.display = ''; });
          }
        }
      });
    });
    var head = ov.querySelector('#ib-cal-head');
    if (head) {
      head.addEventListener('pointerdown', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('[data-ib-cal]')) return;
        var r = ov.getBoundingClientRect();
        var dx = ev.clientX - r.left, dy = ev.clientY - r.top;
        ov.style.right = 'auto';
        var mv = function (e) { ov.style.left = Math.max(0, e.clientX - dx) + 'px'; ov.style.top = Math.max(0, e.clientY - dy) + 'px'; };
        var up = function () {
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
          lsSet('ib_cal_pos_v1', { x: parseInt(ov.style.left, 10) || 0, y: parseInt(ov.style.top, 10) || 0 });
        };
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
      });
    }
  }
  function injectCalButton() {
    try {
      var body = document.getElementById('gd-body-schedule');
      if (!body || body.querySelector('#ib-cal-open-btn')) return;
      var btn = document.createElement('button');
      btn.id = 'ib-cal-open-btn'; btn.type = 'button';
      btn.className = 'gd-btn ib-press';
      btn.textContent = '挂历 / 悬浮窗';
      btn.style.cssText = 'width:100%;margin-bottom:8px;';
      btn.addEventListener('click', function () { openCalendar(); });
      body.insertBefore(btn, body.firstChild);
    } catch (e) {}
  }


  /* ── 朋友圈 @提及：只在“发表动态”输入框里，输入 @ 弹出角色候选，点选插入 ── */
  function mentionCandidates() {
    var out = [];
    try {
      var st = (window.AppRegistry && AppRegistry.wechat && AppRegistry.wechat.wxStore) || null;
      if (st) {
        if (st.accountMeta && st.accountMeta.nickname) out.push(st.accountMeta.nickname);
        (st.sessions || []).forEach(function (s) { if (s && s.name) out.push(s.name); });
      }
    } catch (e) {}
    if (!out.length) {
      try {
        var raw = localStorage.getItem('phone_wechat_store_v2');
        if (raw) {
          var j = JSON.parse(raw);
          var ss = j.sessions || j.sessionsList || [];
          ss.forEach(function (s) { if (s && s.name) out.push(s.name); });
          if (j.accountMeta && j.accountMeta.nickname) out.push(j.accountMeta.nickname);
        }
      } catch (e) {}
    }
    var seen = {};
    return out.filter(function (n) { if (!n || seen[n]) return false; seen[n] = 1; return true; });
  }
  function mentionPopupFor(text, cursor) {
    var head = String(text || '').slice(0, cursor == null ? undefined : cursor);
    var m = /@([^\s@]{0,12})$/.exec(head);
    if (!m) return [];
    var q = m[1];
    return mentionCandidates().filter(function (n) { return !q || n.indexOf(q) !== -1; });
  }
  function mentionHTML(text) {
    var safe = esc(text);
    var out = safe;
    mentionCandidates().forEach(function (n) {
      var en = esc(n);
      out = out.split('@' + en).join('<span class="ib-mention">@' + en + '</span>');
    });
    return out;
  }
  function hideMentionPopup() { var p = document.getElementById('ib-mention-pop'); if (p) p.remove(); }
  function showMentionPopup(list) {
    var dlg = document.getElementById('wx-input-dialog');
    if (!dlg) return;
    hideMentionPopup();
    var pop = document.createElement('div');
    pop.id = 'ib-mention-pop'; pop.className = 'ib-mention-pop';
    pop.innerHTML = list.map(function (n) { return '<button type="button" data-ib-mention="' + esc(n) + '">@' + esc(n) + '</button>'; }).join('');
    pop.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ib-mention]') : null;
      if (b) insertMention(b.getAttribute('data-ib-mention'));
    });
    dlg.appendChild(pop);
  }
  function insertMention(name) {
    var input = document.getElementById('wx-dialog-input');
    if (!input || !name) return false;
    var pos = (typeof input.selectionStart === 'number') ? input.selectionStart : input.value.length;
    var end = (typeof input.selectionEnd === 'number') ? input.selectionEnd : pos;
    var val = input.value || '';
    var head = val.slice(0, pos);
    var at = head.lastIndexOf('@');
    var cut = at >= 0 ? at : pos;
    input.value = val.slice(0, cut) + '@' + name + ' ' + val.slice(end);
    try { input.focus(); input.setSelectionRange(cut + name.length + 2, cut + name.length + 2); } catch (e) {}
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    hideMentionPopup();
    return true;
  }
  function onDocInput(e) {
    try {
      if (!e.target || e.target.id !== 'wx-dialog-input') return;
      var title = (document.getElementById('wx-dialog-title') || {}).textContent || '';
      if (title !== '发表动态') { hideMentionPopup(); return; }
      var list = mentionPopupFor(e.target.value, e.target.selectionStart);
      if (list.length) showMentionPopup(list); else hideMentionPopup();
    } catch (err) {}
  }

  /* ── 设置 → 诊断页：大白话标题 + 三色状态 + 状态药丸 + 一键修复 + 脱敏导出 ── */
  function diagChecks() {
    var out = [];
    try {
      localStorage.setItem('__ib_probe', '1');
      localStorage.removeItem('__ib_probe');
      out.push({ id: 'storage', title: '本机存储', status: 'ok', label: '正常', note: '本机存储可读写，记忆和设置能存下来。' });
    } catch (e) { out.push({ id: 'storage', title: '本机存储', status: 'bad', label: '故障', note: '本机存储写不进去：' + (e && e.message ? String(e.message).slice(0, 60) : '未知原因') + '。先试试一键修复。' }); }
    var memCount = -1;
    try {
      var mems = lsGet('guichao.memories.v1', null);
      if (Array.isArray(mems)) { memCount = mems.length; out.push({ id: 'memory', title: '归巢记忆', status: 'ok', label: '正常', note: '归巢记忆 ' + mems.length + ' 条，可以正常读。' }); }
      else out.push({ id: 'memory', title: '归巢记忆', status: 'warn', label: '注意', note: '归巢记忆读不到：可能还没有记过记忆。' });
    } catch (e) { out.push({ id: 'memory', title: '归巢记忆', status: 'bad', label: '故障', note: '归巢记忆解析失败，可能是存坏了，先导出备份再修。' }); }
    var cfgCount = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /cfg|api|model/i.test(k)) cfgCount++; } } catch (e) {}
    out.push(cfgCount
      ? { id: 'model', title: '模型连接', status: 'ok', label: '正常', note: '已配置 ' + cfgCount + ' 项模型设置（只数个数，不读密钥）。' }
      : { id: 'model', title: '模型连接', status: 'opt', label: '可选', note: '没有接模型：不影响聊天，本地模板仍可用；接模型是另一个决定。' });
    var hasBackup = false;
    try { for (var j = 0; j < localStorage.length; j++) { var k2 = localStorage.key(j); if (k2 && /backup|export/i.test(k2)) { hasBackup = true; break; } } } catch (e) {}
    out.push(hasBackup
      ? { id: 'backup', title: '备份', status: 'ok', label: '正常', note: '检测到备份或导出相关记录。' }
      : { id: 'backup', title: '备份', status: 'warn', label: '注意', note: '没检测到备份记录：建议先去设置 → 导出全部数据，备一份再说。' });
    try {
      var prefs = lsGet('phone_ui_prefs_v1', null);
      out.push(prefs
        ? { id: 'theme', title: '主题与外观', status: 'ok', label: '正常', note: '主题偏好可以正常读。' }
        : { id: 'theme', title: '主题与外观', status: 'opt', label: '可选', note: '没有主题偏好记录，用默认白底。' });
    } catch (e) { out.push({ id: 'theme', title: '主题与外观', status: 'warn', label: '注意', note: '主题偏好解析失败，一键修复会按默认重应用一次。' }); }
    return { checks: out, memCount: memCount, cfgCount: cfgCount };
  }
  function renderDiagSub() {
    var ids = [['storage', '本机存储'], ['memory', '归巢记忆'], ['model', '模型连接'], ['backup', '备份'], ['theme', '主题与外观']];
    var cards = ids.map(function (pair) {
      return '<div class="ib-diag-card" style="margin:0 16px 12px;"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:17px;font-weight:600;flex:1;">' + pair[1] + '</span>'
        + '<span class="ib-pill check" data-ib-diag="' + pair[0] + '">检查中</span></div>'
        + '<div class="ib-diag-note" data-ib-diag-note="' + pair[0] + '">正在检查……</div></div>';
    }).join('');
    return '<div class="st-sub" id="st-sub-ibDiag">'
      + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div><div class="st-sub-title">诊断</div></div>'
      + '<div class="st-bigtitle" style="padding-top:4px;">哪里不对劲，一眼看懂</div>'
      + '<div class="st-foot" style="margin-top:0;">这里只说结论：哪项正常、哪项要注意、会不会影响聊天、能不能一键恢复。技术细节收在下面，不含密钥、不含记忆正文。</div>'
      + cards
      + '<div style="margin:4px 16px 10px;display:flex;gap:8px;"><button type="button" class="ib-press" id="ib-diag-fix" style="flex:1;border:0;background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:12px;font-size:17px;">一键修复</button>'
      + '<button type="button" class="ib-press" id="ib-diag-export" style="flex:1;border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:12px;font-size:17px;">导出脱敏报告</button></div>'
      + '<div style="margin:4px 16px 10px;"><button type="button" class="ib-press" id="ib-diag-ai" style="width:100%;border:0;background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:12px;font-size:17px;">AI 诊断（请模型看脱敏报告）</button></div>'
      + '<div class="st-foot" id="ib-diag-ai-result" style="margin-top:0;white-space:pre-wrap;"></div>'
      + '<details style="margin:0 16px;"><summary style="font-size:17px;color:var(--st-ink-60,rgba(30,39,72,.6));cursor:pointer;">最近报错（只记最近 30 条，不联网、不上报）</summary>'
      + '<div class="st-foot" id="ib-diag-errors-body" style="margin:8px 0 0;">还没检查。</div></details>'
      + '<div class="st-foot" id="ib-diag-fix-result" style="margin-top:0;"></div>'
      + '<details style="margin:0 16px;"><summary style="font-size:17px;color:var(--st-ink-60,rgba(30,39,72,.6));cursor:pointer;">技术细节（只含条数，不含内容）</summary>'
      + '<div class="st-foot" id="ib-diag-tech" style="margin:8px 0 0;">还没检查。</div></details>'
      + '<div style="height:40px;"></div></div>';
  }
  function runDiag(root) {
    root = root || document;
    var res = diagChecks();
    var pillCls = { ok: 'ok', warn: 'warn', bad: 'bad', opt: 'opt' };
    res.checks.forEach(function (c) {
      var pill = root.querySelector ? root.querySelector('[data-ib-diag="' + c.id + '"]') : null;
      if (pill) { pill.className = 'ib-pill ' + (pillCls[c.status] || 'check'); pill.textContent = c.label; }
      var note = root.querySelector ? root.querySelector('[data-ib-diag-note="' + c.id + '"]') : null;
      if (note) note.textContent = c.note;
    });
    var tech = root.querySelector ? root.querySelector('#ib-diag-tech') : null;
    if (tech) {
      var sched = lsGet('phone_schedule_v1', []);
      tech.textContent = '归巢记忆 ' + (res.memCount < 0 ? '读不到' : res.memCount + ' 条') + ' · 日程 ' + (Array.isArray(sched) ? sched.length : 0) + ' 条 · 模型配置 ' + res.cfgCount + ' 项（只数个数，不读密钥） · 诊断本身不联网。';
    }
    return res.checks;
  }
  function fixAll(root) {
    root = root || document;
    try { applyQuiet(readQuiet()); } catch (e) {}
    try { if (window.AppTheme && window.AppTheme.apply) window.AppTheme.apply(); } catch (e) {}
    try { localStorage.removeItem('__ib_probe'); } catch (e) {}
    var checks = runDiag(root);
    var okN = checks.filter(function (c) { return c.status === 'ok'; }).length;
    var summary = '已修复：重新应用了主题与静谧设置，存储复查了一遍。现在 ' + okN + ' / ' + checks.length + ' 项正常，其余按上面每项的说明处理。';
    var line = root.querySelector ? root.querySelector('#ib-diag-fix-result') : null;
    if (line) line.textContent = summary;
    return summary;
  }
  function buildDiagReport() {
    var res = diagChecks();
    var sched = lsGet('phone_schedule_v1', []);
    return {
      app: '小未来的手机', page: '诊断', generatedAt: new Date().toISOString(),
      checks: res.checks.map(function (c) { return { id: c.id, title: c.title, status: c.status, label: c.label, note: c.note }; }),
      counts: { memories: res.memCount < 0 ? null : res.memCount, schedule: Array.isArray(sched) ? sched.length : 0, modelConfigs: res.cfgCount },
      note: '脱敏报告：不含密钥、不含记忆正文、不含人名与聊天内容。'
    };
  }
  function exportDiag(root) {
    var report = buildDiagReport();
    try {
      var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'phone-diagnosis.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
    } catch (e) {}
    return report;
  }
  /* GROUP-CORE · 最近报错：只读内存里的 window.__xwlCoreErrors（全局 error 监听收，
     见开屏兜底脚本处），只记最近 30 条，只记错误信息与位置，不记记忆正文与密钥；
     不联网、不自动上报、不落盘。 */
  function diagErrorList() { try { var l = window.__xwlCoreErrors; return Array.isArray(l) ? l.slice() : []; } catch (e) { return []; } }
  function renderDiagErrors(root) {
    root = root || document;
    var box = root.querySelector ? root.querySelector('#ib-diag-errors-body') : null;
    if (!box) return 0;
    var list = diagErrorList();
    if (!list.length) { box.textContent = '最近没有收到报错。'; return 0; }
    box.innerHTML = list.slice().reverse().map(function (e) {
      return '<div style="padding:8px 0;border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));font-size:13px;line-height:1.5;"><div>' + esc(String(e.message || '未知错误')) + '</div><div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">' + esc(String(e.at || '')) + (e.file ? ' · ' + esc(String(e.file)) + (e.line ? ':' + e.line : '') : '') + '</div></div>';
    }).join('') + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:8px;">只记最近 30 条，只记错误信息与位置，不记记忆正文与密钥；不联网、不自动上报。</div>';
    return list.length;
  }
  /* GROUP-CORE · AI 诊断：把 buildDiagReport 的脱敏报告发给已接好的模型。
     没接模型时明说，不假装诊断过。模型调用复用 PhoneModel.chatComplete。 */
  var _aiDiagBusy = false;
  function aiDiagnose(root) {
    root = root || document;
    var line = root.querySelector ? root.querySelector('#ib-diag-ai-result') : null;
    var setLine = function (t) { if (line) line.textContent = t; };
    var btn = root.querySelector ? root.querySelector('#ib-diag-ai') : null;
    if (_aiDiagBusy) { setLine('AI 诊断正在跑，等这一轮跑完再点。'); return Promise.resolve('busy'); }
    if (!window.PhoneModel || !window.PhoneModel.isConfigured || !window.PhoneModel.isConfigured()) {
      setLine('AI 诊断需要先在设置 → API 设置里接好模型（填好地址、模型名和 key）。现在还没接好，所以没有诊断——不是模型说没问题，是根本没问模型。');
      return Promise.resolve('need-model');
    }
    _aiDiagBusy = true; if (btn) btn.disabled = true;
    setLine('正在请模型看脱敏报告……（只发状态与条数，不发密钥、记忆正文、人名与聊天内容）');
    var report = buildDiagReport();
    var sys = '你是手机诊断助手。只根据下面这份脱敏诊断报告（只含状态与条数）给修复建议。只返回一个 JSON 对象：{"safe":[{"title":"...","action":"fixAll"}],"risky":[{"title":"...","why":"..."}]}。safe 只放确定安全、只走“重新应用主题与静谧设置并复查”就能修的项，action 只能是 fixAll；凡是动数据、删东西、改配置、或你不确定的，一律放进 risky，只写标题与原因，不要编具体操作。不要返回 JSON 以外的文字。';
    return window.PhoneModel.chatComplete([{ role: 'system', content: sys }, { role: 'user', content: '脱敏诊断报告：\n' + JSON.stringify(report) }], { feature: 'diag', maxTokens: 800 }).then(function (text) {
      _aiDiagBusy = false; if (btn) btn.disabled = false;
      var parsed = null;
      try { var m = String(text || '').match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch (e) { parsed = null; }
      if (!parsed || (!Array.isArray(parsed.safe) && !Array.isArray(parsed.risky))) {
        setLine('模型回来了，但没按约定的格式给建议，所以只展示、不执行：\n' + String(text || '').slice(0, 500));
        return 'unparsed';
      }
      var safe = (parsed.safe || []).filter(function (s) { return s && s.action === 'fixAll' && typeof s.title === 'string'; });
      var risky = (parsed.risky || []).filter(function (r) { return r && typeof r.title === 'string'; });
      (parsed.safe || []).filter(function (s) { return !(s && s.action === 'fixAll'); }).forEach(function (s) {
        risky.push({ title: (s && s.title) || '未说明的建议', why: '模型把它标为“可直接修”，但不是白名单里的 fixAll 路径，所以先列出来问你，不擅自执行。' });
      });
      var html = '';
      if (!safe.length && !risky.length) html = '模型看完了脱敏报告，没给出需要修的项。';
      else {
        if (safe.length) html += '<div style="font-weight:600;margin-bottom:4px;">可以直接修的（走现有的一键修复路径）：</div>' + safe.map(function (s, i) { return '<div style="margin:8px 0;"><button type="button" data-ib-ai-fix="' + i + '" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;">修：' + esc(s.title) + '</button></div>'; }).join('');
        if (risky.length) html += '<div style="font-weight:600;margin:8px 0;">先问你、不会擅自执行的：</div>' + risky.map(function (r) { return '<div style="font-size:13px;line-height:1.5;">· ' + esc(r.title) + (r.why ? ' —— ' + esc(r.why) : '') + '</div>'; }).join('');
      }
      if (line) line.innerHTML = html;
      if (line) {
        var btns = line.querySelectorAll('[data-ib-ai-fix]');
        for (var i = 0; i < btns.length; i++) {
          btns[i].addEventListener('click', function () {
            try { fixAll(root); } catch (e) {}
            var l2 = root.querySelector('#ib-diag-ai-result');
            if (l2) l2.textContent = '已按建议走了一遍一键修复（重新应用主题与静谧设置并复查）。上面每项的状态已更新。';
            try { renderDiagErrors(root); } catch (e2) {}
          });
        }
      }
      return 'ok';
    }, function (err) {
      _aiDiagBusy = false; if (btn) btn.disabled = false;
      setLine('AI 诊断没跑成：' + (err && err.message ? String(err.message).slice(0, 80) : '模型调用失败') + '。没改任何东西，等模型接好了再试。');
      return 'failed';
    });
  }
  function bindDiag(sub) {
    if (!sub) return;
    var fix = sub.querySelector('#ib-diag-fix');
    if (fix) fix.addEventListener('click', function () { fixAll(sub); });
    var ai = sub.querySelector('#ib-diag-ai');
    if (ai) ai.addEventListener('click', function () { aiDiagnose(sub); });
    try { renderDiagErrors(sub); } catch (e) {}
    var exp = sub.querySelector('#ib-diag-export');
    if (exp) exp.addEventListener('click', function () {
      exportDiag(sub);
      var line = sub.querySelector('#ib-diag-fix-result');
      if (line) line.textContent = '脱敏报告已导出（只含状态与条数，不含密钥与记忆正文）。';
    });
    try { runDiag(sub); } catch (e) {}
  }

  /* ── Role DM 观察页：角色↔角色私聊只读查看；刻意没有消息输入框 ── */
  function roleDMData() {
    var sessions = [];
    try {
      var st = (window.AppRegistry && AppRegistry.wechat && AppRegistry.wechat.wxStore) || null;
      if (st && st.sessions) sessions = st.sessions;
    } catch (e) {}
    if (!sessions.length) {
      try {
        var raw = localStorage.getItem('phone_wechat_store_v2');
        if (raw) { var j = JSON.parse(raw); sessions = j.sessions || j.sessionsList || []; }
      } catch (e) {}
    }
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i] || {};
      var msgs = s.messages || s.msgs || [];
      if (!Array.isArray(msgs) || msgs.length < 2) continue;
      var senders = {};
      msgs.forEach(function (m) { var who = (m && (m.sender || m.author || m.from || m.name)) || ''; if (who && who !== '我') senders[who] = 1; });
      var names = Object.keys(senders);
      if (names.length >= 2) return { session: s, msgs: msgs, names: names };
    }
    return null;
  }
  function renderRoleDMSub() {
    var t = roleDMData();
    var auto = !!lsGet('ib_roledm_auto_v1', false);
    var scene = '<div class="ib-roledm-scene"><h3>角色私聊 · 观察</h3>'
      + '<p>这里是角色之间的私聊，你是旁观者，不是参与者——所以没有输入框，只能看。'
      + '关系数值（信任 / 熟悉 / 好感）本地没有记录，这里不编数字。</p></div>';
    var thread = '';
    if (t) {
      var head = '<div class="ib-roledm-scene"><h3>场景：' + esc(t.session.name || t.names.join(' × ')) + '</h3>'
        + '<p>参与者：' + esc(t.names.join('、')) + ' · 共 ' + t.msgs.length + ' 条（只读，按原顺序）</p></div>';
      var rows = t.msgs.slice(0, 60).map(function (m) {
        var who = (m && (m.sender || m.author || m.from || m.name)) || 'TA';
        var text = (m && (m.content || m.text || m.body)) || '';
        var when = (m && (m.time || m.createdAt)) || '';
        return '<div class="ib-roledm-row"><div class="ib-roledm-av">' + esc(String(who).slice(0, 1)) + '</div>'
          + '<div class="ib-roledm-body"><div class="ib-roledm-meta">' + esc(who) + (when ? ' · ' + esc(String(when)) : '') + '</div>'
          + '<div class="ib-roledm-text">' + esc(text) + '</div></div></div>';
      }).join('');
      thread = head + rows + (t.msgs.length > 60 ? '<div class="st-foot">只显示前 60 条。</div>' : '');
    } else {
      thread = '<div class="ib-diag-card" style="margin:0 16px 12px;"><div style="font-size:17px;font-weight:600;">还没有可观察的角色私聊</div>'
        + '<div class="ib-diag-note">需要一段至少两位角色（不含你）的对话记录；有了之后这里会自动出现，不编假对话。</div></div>';
    }
    var autoBlock = '<details style="margin:12px 16px;"><summary style="font-size:17px;font-weight:600;cursor:pointer;">自主发起</summary>'
      + '<div style="margin-top:8px;font-size:17px;line-height:1.5;">现在是' + (auto ? '开的' : '关的') + '。'
      + '<span id="ib-roledm-status">（' + (auto ? '开' : '关') + '）</span></div>'
      + '<label style="display:flex;align-items:center;gap:10px;margin-top:12px;font-size:17px;"><input type="checkbox" id="ib-roledm-auto"' + (auto ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--st-ink,#1e2748);"> 允许角色自主发起私聊</label>'
      + '<div class="st-foot" style="margin:8px 0 0;">开启后也只在打开手机时本地检查：一天最多 3 条，间隔至少 30 分钟，免打扰 23:00–08:00；关页后不发送（见 ActiveScheduler 接口，单文件没有后台调度）。</div></details>';
    return '<div class="st-sub" id="st-sub-ibRoleDM">'
      + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div><div class="st-sub-title">角色私聊观察</div></div>'
      + '<div class="st-bigtitle" style="padding-top:4px;">角色私聊</div>'
      + '<div style="margin:0 16px 12px;">' + scene + '</div>'
      + '<div style="margin:0 16px;">' + thread + '</div>'
      + autoBlock
      + '<div style="height:40px;"></div></div>';
  }
  function bindRoleDM(sub) {
    if (!sub) return;
    var cb = sub.querySelector('#ib-roledm-auto');
    if (cb) cb.addEventListener('change', function () {
      lsSet('ib_roledm_auto_v1', !!cb.checked);
      var st = sub.querySelector('#ib-roledm-status');
      if (st) st.textContent = cb.checked ? '（开）' : '（关）';
      var line = sub.querySelector('details div');
      if (line && line.textContent.indexOf('现在是') === 0) line.childNodes[0].textContent = '现在是' + (cb.checked ? '开的' : '关的') + '。';
    });
  }

  /* ── P3 接口：ActiveScheduler（关页后主动消息 / 朋友圈后台调度只留接口 + 本地兜底）── */
  var ActiveScheduler = {
    enqueue: function (kind, payload, whenTs) {
      var q = lsGet('ib_active_queue_v1', []);
      var item = { id: 'ibq-' + Date.now() + '-' + Math.floor(Math.random() * 1000000), kind: kind, payload: payload || null, whenTs: whenTs || 0, createdAt: Date.now() };
      q.push(item);
      lsSet('ib_active_queue_v1', q);
      return item;
    },
    list: function () { return lsGet('ib_active_queue_v1', []); },
    dueNow: function (nowTs) {
      var now = nowTs || Date.now();
      var q = lsGet('ib_active_queue_v1', []);
      var due = q.filter(function (it) { return (it.whenTs || 0) <= now; });
      if (due.length) {
        lsSet('ib_active_queue_v1', q.filter(function (it) { return (it.whenTs || 0) > now; }));
        var prev = lsGet('ib_active_due_v1', []);
        lsSet('ib_active_due_v1', prev.concat(due));
      }
      return due;
    },
    schedule: function (kind, payload, whenTs) {
      var item = this.enqueue(kind, payload, whenTs);
      return { ok: false, queued: true, id: item.id, reason: 'single-file: no background scheduler; item queued for next open (local trigger only)' };
    }
  };

  /* ── 启动 ── */
  function init() {
    try { applyQuiet(readQuiet()); } catch (e) {}
    try { wrapGroupP(); } catch (e) {}
    try { attachFix11(); } catch (e) {}
    try { injectCalButton(); ensureWaveCanvas(); } catch (e) {}
    try {
      if (typeof MutationObserver !== 'undefined' && document.body) {
        var mo = new MutationObserver(function () {
          try { injectCalButton(); } catch (e) {}
          try { if (ensureWaveCanvas()) attachFix11(); } catch (e) {}
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {}
    try { document.addEventListener('input', onDocInput); } catch (e) {}
    try { ActiveScheduler.dueNow(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.GroupIB = {
    MARK: MARK, version: 1,
    moonPhase: moonPhase, applyQuiet: applyQuiet, readQuiet: readQuiet, isQuiet: isQuiet,
    reducedMotion: reducedMotion,
    ensureWaveCanvas: ensureWaveCanvas, drawWave: drawWave, waveStart: waveStart, waveStop: waveStop,
    attachFix11: attachFix11, wrapGroupP: wrapGroupP, _wave: wave,
    openCalendar: openCalendar, renderCalendarHTML: renderCalendarHTML, calCells: calCells, calLoadSched: calLoadSched,
    mentionCandidates: mentionCandidates, mentionPopupFor: mentionPopupFor, mentionHTML: mentionHTML, insertMention: insertMention,
    renderDiagSub: renderDiagSub, runDiag: runDiag, fixAll: fixAll, exportDiag: exportDiag, bindDiag: bindDiag, diagChecks: diagChecks,
    buildDiagReport: buildDiagReport, aiDiagnose: aiDiagnose, diagErrorList: diagErrorList, renderDiagErrors: renderDiagErrors,
    renderRoleDMSub: renderRoleDMSub, bindRoleDM: bindRoleDM, roleDMData: roleDMData,
    scheduler: ActiveScheduler, _hash: hashStr
  };
  window.ActiveScheduler = ActiveScheduler;
})();
