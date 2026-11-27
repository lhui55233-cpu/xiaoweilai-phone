
/* ══════════ GROUP-AS-OFFLINE-NOTIFY · AS组：离线通知 ══════════
   全部本地实现，不依赖网络、不依赖服务器推送。定时器 + localStorage，
   手机打开时按本地时间触发；离线、飞行模式下照常工作。
   - 通知中心：复用 SystemCenter（syscenter_notif_v1），顶部左侧下滑呼出；
     不另开桌面图标。列表按时间倒序，未读角标在中心标题与锁屏标题上；
     点一条进对应 app 并标已读；“清除全部”与单条左滑/点叉删除沿用原有实现。
   - 锁屏通知：#sys-lock-main 内自建 #as-lock-list（最新 5 条未读）。
     有密码时只显示“应用名 · 有新通知”，不显示标题/正文；无密码时显示
     标题 + 正文摘要。无密码点按直接解锁进 app；有密码先过密码再进
     （待处理 id 记在 _pending，解锁后由 _onUnlocked 打开；另有 500ms
     轮询兜底看 SystemStore.isLocked 翻转。AO 已合入但其 doUnlock 未调
     _onUnlocked，后续 AO 若改 doUnlock 请补调该钩子）。
   - 横幅：app 内顶部 #as-banner，5 秒后收起，只做展示，不抢焦点
     （不调用 focus、不弹全屏）；正在用的 app 只在顶部轻推一下。
   - 声音：WebAudio 合成两音提示（无音频文件）；震动：navigator.vibrate
     （没有就跳过、不报错）。各有开关。番茄钟完成不由 AS 再响一声：
     AM 的完成音（completionChime）已是完成提示音，AS 只弹横幅+记中心，
     避免双响。
   - 通知只呈现已发出的消息，不计数、不重 gate。专注进行中
     （GroupN.isFocusSilent）时除番茄完成外也只进中心。
   - 开关语义：总开关关 → 仍静默记进中心（silent:true），不弹不响不
     上锁屏；分类型开关关 → 该类型直接丢弃，不进中心也不弹。
   - 触发接线（只读，不改已有键）：日程读 phone_schedule_v1，到时提醒
     （当天内打开手机可补发一次，过期多日不翻旧账；无 time 的日程按
     当天 09:00）；习惯读 phone_habits_v1，未打卡的习惯在 AS 自己的
     提醒时间（默认 20:00）每天合并成一条提醒一次（习惯本身没有提醒
     时间字段，不往旧键写字段）；番茄完成包 GroupN.focusEnd（done!==false
     才发）；承诺只呈现两路——主路是 _dispatch 的 promise_reminder 事件，
     兜底是扫描 char_promises_v1 里 reminded===true 且 24 小时内到期、
     AS 还没呈现过的（避免与 O 组抢发、避免重复）；剧本包
     ScriptAE.logEvent（script_end/script_save）；影院包
     CinemaCore.finishFilm；阅读无完成事件，留 notifyExternal 接口。
   - 查岗电话（AO 的 maybeCharCall/来电卡片）AS 不自造、不代发；若 AO
     调 notify({kind:'char_call'})，同样只进中心（每天最多一次、
     不在夜间是 AO 的规矩，AS 不替它 gate，只不帮它越线）。
   - 不做的：服务器推送（Web Push/FCM/APNs）需要服务器+网络，单文件
     离线手机没有——不做、不写假文案。打包 APK 后可改走 Capacitor
     local-notifications 插件（本地定时、无需服务器、离线可用），那是
     打包后的待选项，现在不做（见设置页说明）。
   ══════════════════════════════════════════════════════════════ */
window.GroupAS = (() => {
'use strict';
var MARK = 'GROUP-AS-OFFLINE-NOTIFY';
var KEY = 'phone_notif_as_v1';
var SCHED_KEY = 'phone_schedule_v1';
var HABIT_KEY = 'phone_habits_v1';
var PROM_KEY = 'char_promises_v1';
var NOTIF_KEY = 'syscenter_notif_v1';
var PW_KEY = 'phone_lock_pw_v1';
var HONEST = '本机通知为本地通知，离线可用；不是系统级推送，关掉手机就不会响。';
var APK_NOTE = '服务器推送（Web Push / FCM / APNs）需要服务器与网络，单文件离线手机没有——不做、不冒充。打包 APK 后可改走 Capacitor local-notifications 插件（本地定时、无需服务器、离线可用），那是打包后的待选项，现在不做。';
var KIND_TYPE = { char: 'char', promise: 'char', char_call: 'char', schedule: 'schedule', habit: 'habit', focus: 'focus', system: 'system', script: 'system', reading: 'system', cinema: 'system' };
var KIND_APP = { char: 'wechat', promise: 'wechat', char_call: 'phone', schedule: 'schedule', habit: 'habits', focus: 'focus', system: 'settings', script: 'script', reading: 'novel', cinema: 'cinema' }; /* GROUP-FIX7：habit 改跳习惯 app；schedule 项保留作默认值，已被显式 null 与守卫兜底 */
var KIND_NAME = { char: '微信', promise: '微信', char_call: '电话', schedule: '日程', habit: '习惯', focus: '番茄专注', system: '系统', script: '剧本', reading: '小说', cinema: '影院' }; /* GROUP-FIX7：habit 显示名改习惯 */

var _data = null;
var _ac = null;
var _lastSound = { ok: false, reason: 'not-tried', ts: 0 };
var _lastVibrate = { ok: false, reason: 'not-tried', ts: 0 };
var _lastChar = { key: '', ts: 0 };
var _pending = null;
var _watchTimer = null;
var _lockTapGuard = { id: '', ts: 0 };
var _bannerTimer = null;
var _bannerId = null;
var _eventBusOk = false;
var _focusWrapped = false;
var _scriptWrapped = false;
var _cinemaWrapped = false;
var _inited = false;

function read(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return ('0' + n).slice(-2); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

/* ── 本组数据 phone_notif_as_v1 ── */
function defaultData() {
  return {
    settings: { master: true, sound: true, vibrate: true, types: { char: true, schedule: true, habit: true, focus: true, system: true }, habitTime: '20:00', bannerMs: 5000 },
    fired: {}, presented: {}
  };
}
function loadData() {
  if (_data) return _data;
  var d = read(KEY, null);
  var def = defaultData();
  if (!d || typeof d !== 'object') d = def;
  d.settings = Object.assign({}, def.settings, d.settings || {});
  d.settings.types = Object.assign({}, def.settings.types, (d.settings.types || {}));
  if (!d.fired || typeof d.fired !== 'object') d.fired = {};
  if (!d.presented || typeof d.presented !== 'object') d.presented = {};
  _data = d;
  return d;
}
function prune(d) {
  var fk = Object.keys(d.fired);
  if (fk.length > 300) fk.slice(0, fk.length - 300).forEach(function (k) { delete d.fired[k]; });
  var pk = Object.keys(d.presented);
  if (pk.length > 200) pk.slice(0, pk.length - 200).forEach(function (k) { delete d.presented[k]; });
}
function saveData(d) {
  _data = d || _data;
  try { prune(_data); localStorage.setItem(KEY, JSON.stringify(_data)); } catch (e) {}
  return _data;
}
function getSettings() { return loadData().settings; }
function setSettings(patch) {
  var d = loadData();
  var st = d.settings;
  if (!patch || typeof patch !== 'object') return st;
  ['master', 'sound', 'vibrate'].forEach(function (k) { if (typeof patch[k] === 'boolean') st[k] = patch[k]; });
  if (patch.types && typeof patch.types === 'object') {
    Object.keys(st.types).forEach(function (k) { if (typeof patch.types[k] === 'boolean') st.types[k] = patch.types[k]; });
  }
  if (typeof patch.habitTime === 'string' && /^\d{2}:\d{2}$/.test(patch.habitTime)) st.habitTime = patch.habitTime;
  if (patch.bannerMs != null) st.bannerMs = Math.max(1000, Math.min(15000, Number(patch.bannerMs) || 5000));
  saveData(d);
  return st;
}

function isFocusSilent() {
  try { if (window.GroupN && window.GroupN.isFocusSilent) return !!window.GroupN.isFocusSilent(); } catch (e) {}
  return false;
}
function isLocked() {
  try { if (typeof SystemStore !== 'undefined' && SystemStore && SystemStore.get) return SystemStore.get('isLocked') === true; } catch (e) {}
  var l = document.getElementById('sys-lockscreen-layer');
  return !!(l && l.classList.contains('sys-active'));
}
function hasPw() {
  try { if (window.GroupAO && window.GroupAO.hasPw) return !!window.GroupAO.hasPw(); } catch (e) {}
  try { if (window.GroupAJ && window.GroupAJ.hasPw) return !!window.GroupAJ.hasPw(); } catch (e) {}
  try { var p = localStorage.getItem(PW_KEY); return !!(p && p.length); } catch (e) {}
  return false;
}

/* ── 通知中心读写：走 SystemCenter API（单份列表 syscenter_notif_v1），缺失时直读写键 ── */
function sc() { try { return (typeof SystemCenter !== 'undefined') ? SystemCenter : null; } catch (e) { return null; } }
function centerList() {
  var s = sc();
  if (s && s.list) { try { return s.list() || []; } catch (e) {} }
  var a = read(NOTIF_KEY, []);
  return Array.isArray(a) ? a : [];
}
function centerPush(n) {
  var s = sc();
  if (s && s.pushNotification) { try { s.pushNotification(n); return true; } catch (e) {} }
  try {
    var a = read(NOTIF_KEY, []);
    if (!Array.isArray(a)) a = [];
    a.unshift(Object.assign({ id: 'n' + Date.now(), time: Date.now() }, n));
    if (a.length > 50) a = a.slice(0, 50);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(a));
    return true;
  } catch (e) { return false; }
}
function unreadCount() {
  var s = sc();
  if (s && s.unreadCount) { try { return s.unreadCount(); } catch (e) {} }
  return centerList().filter(function (n) { return n && n.read === false; }).length;
}
function markRead(id) {
  var s = sc();
  if (s && s.markRead) { try { return !!s.markRead(id); } catch (e) {} }
  try {
    var a = read(NOTIF_KEY, []);
    var hit = false;
    a.forEach(function (n) { if (n && n.id === id) { n.read = true; hit = true; } });
    if (hit) localStorage.setItem(NOTIF_KEY, JSON.stringify(a));
    return hit;
  } catch (e) { return false; }
}
function removeNotif(id) {
  var s = sc();
  if (s && s.removeNotification) { try { return !!s.removeNotification(id); } catch (e) {} }
  return false;
}

/* ── 声音与震动：WebAudio 合成 / navigator.vibrate，没有就跳过、不报错 ── */
function playSound() {
  var r;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { r = { ok: false, reason: 'no-audio' }; }
    else {
      if (!_ac) _ac = new AC();
      if (_ac.state === 'suspended') { try { _ac.resume(); } catch (e) {} }
      var t = _ac.currentTime;
      [523.25, 783.99].forEach(function (fr, i) {
        var o = _ac.createOscillator(), g = _ac.createGain();
        o.type = 'sine'; o.frequency.value = fr;
        var t0 = t + i * 0.18;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        o.connect(g); g.connect(_ac.destination); o.start(t0); o.stop(t0 + 0.55);
      });
      r = { ok: true, reason: 'played' };
    }
  } catch (e) { r = { ok: false, reason: String((e && e.message) || e) }; }
  r.ts = Date.now(); _lastSound = r;
  return r;
}
function vibrate(p) {
  var r;
  try {
    if (!navigator || typeof navigator.vibrate !== 'function') { r = { ok: false, reason: 'no-vibrate' }; }
    else {
      var ok = navigator.vibrate(p);
      r = { ok: ok !== false, reason: ok === false ? 'rejected' : 'vibrated' };
    }
  } catch (e) { r = { ok: false, reason: String((e && e.message) || e) }; }
  r.ts = Date.now(); _lastVibrate = r;
  return r;
}

/* ── 横幅：只做展示，不抢焦点 ── */
function ensureBanner() {
  var shell = document.getElementById('sys-shell');
  if (!shell || document.getElementById('as-banner')) return document.getElementById('as-banner');
  var b = document.createElement('div');
  b.id = 'as-banner'; b.className = 'as-banner';
  b.innerHTML = '<div class="as-banner-body"><div class="as-banner-title"></div><div class="as-banner-text"></div></div><button type="button" class="as-banner-x" aria-label="关闭">×</button>';
  shell.appendChild(b);
  b.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.as-banner-x')) { hideBanner(); return; }
    var id = _bannerId;
    hideBanner();
    if (id) openNotificationById(id);
  });
  return b;
}
function showBanner(item) {
  var b = ensureBanner();
  if (!b) return false;
  var t = b.querySelector('.as-banner-title'), x = b.querySelector('.as-banner-text');
  if (t) t.textContent = (item.appName || '') + ' · ' + (item.title || '');
  if (x) x.textContent = item.body || '';
  _bannerId = item.id;
  b.classList.add('show');
  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(hideBanner, getSettings().bannerMs || 5000);
  return true;
}
function hideBanner() {
  var b = document.getElementById('as-banner');
  if (b) b.classList.remove('show');
  _bannerId = null;
  clearTimeout(_bannerTimer);
}

/* ── 锁屏通知列表 ── */
function ensureLockList() {
  var main = document.getElementById('sys-lock-main');
  if (!main) return null;
  var old = document.getElementById('as-lock-list');
  if (old) return old;
  var div = document.createElement('div');
  div.id = 'as-lock-list'; div.className = 'as-lock-list';
  var box = document.getElementById('sys-lock-time-box');
  if (box && box.nextSibling) main.insertBefore(div, box.nextSibling);
  else main.appendChild(div);
  var onTap = function (e) {
    var el = (e.target && e.target.closest) ? e.target.closest('[data-as-nid]') : null;
    if (!el) return;
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    openFromLock(el.getAttribute('data-as-nid'));
  };
  div.addEventListener('click', onTap);
  div.addEventListener('touchend', onTap);
  return div;
}
function renderLockList() {
  var box = ensureLockList();
  if (!box) return false;
  var items = centerList().filter(function (n) { return n && n.read === false && !n.silent; })
    .sort(function (a, b) { return (b.time || 0) - (a.time || 0); }).slice(0, 5);
  var pw = hasPw();
  var h = '<div class="as-lock-head">通知' + (items.length ? ('（' + items.length + ' 条未读）') : '') + '</div>';
  if (!items.length) { h += '<div class="as-lock-empty">暂无新通知</div>'; }
  items.forEach(function (n) {
    var tm = '';
    try { var d = new Date(n.time || Date.now()); tm = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } catch (e) {}
    // 有密码只显示摘要（应用名 + 有新通知），不显示标题/正文细节
    var line = pw ? esc(n.appName || '系统') + ' · 有新通知'
      : esc(n.title || n.appName || '通知') + (n.body ? (' — ' + esc(String(n.body).slice(0, 40))) : '');
    h += '<div class="as-lock-item" data-as-nid="' + esc(n.id) + '"><span class="as-lock-time">' + tm + '</span><span class="as-lock-text">' + line + '</span><span class="as-lock-go">›</span></div>';
  });
  box.innerHTML = h;
  return true;
}
function unlockNow() {
  try { if (typeof SystemStore !== 'undefined' && SystemStore && SystemStore.set) SystemStore.set('isLocked', false); } catch (e) {}
  try { var l = document.getElementById('sys-lockscreen-layer'); if (l) l.classList.remove('sys-active'); } catch (e) {}
  try { var b = document.getElementById('sys-passcode-box'); if (b) b.classList.remove('sys-active'); } catch (e) {}
  try { var tb = document.querySelector('.sys-lock-time-box'); if (tb) tb.style.opacity = ''; } catch (e) {}
  try { var ft = document.querySelector('.sys-lock-footer'); if (ft) ft.style.opacity = ''; } catch (e) {}
  return true;
}
function unlockIfNoPassword() {
  if (hasPw()) return { ok: false, reason: 'has_password' };
  unlockNow();
  return { ok: true, reason: 'unlocked' };
}
function showPasscodeBox() {
  var box = document.getElementById('sys-passcode-box');
  if (box) box.classList.add('sys-active');
  try { if (window.GroupAJ && window.GroupAJ.syncPasscodeBox) window.GroupAJ.syncPasscodeBox(); } catch (e) {}
  try { var tb = document.querySelector('.sys-lock-time-box'); if (tb) tb.style.opacity = '0'; } catch (e) {}
  try { var ft = document.querySelector('.sys-lock-footer'); if (ft) ft.style.opacity = '0'; } catch (e) {}
}
function stopPendingWatch() { if (_watchTimer) { clearInterval(_watchTimer); _watchTimer = null; } }
function startPendingWatch() {
  stopPendingWatch();
  var tries = 0;
  _watchTimer = setInterval(function () {
    tries++;
    try {
      if (!isLocked()) { stopPendingWatch(); _onUnlocked(); }
      else if (tries > 240) { stopPendingWatch(); _pending = null; }
    } catch (e) { stopPendingWatch(); }
  }, 500);
}
function _onUnlocked() {
  if (!_pending) return false;
  var id = _pending;
  _pending = null;
  stopPendingWatch();
  try { markRead(id); } catch (e) {}
  var item = null;
  centerList().forEach(function (n) { if (n && n.id === id) item = n; });
  if (item) openTarget(item);
  return true;
}
function cancelPending() { _pending = null; stopPendingWatch(); return true; }
function openFromLock(id) {
  var now = Date.now();
  if (_lockTapGuard.id === id && now - _lockTapGuard.ts < 1000) return { ok: false, reason: 'dup-tap' };
  _lockTapGuard = { id: id, ts: now };
  var item = null;
  centerList().forEach(function (n) { if (n && n.id === id) item = n; });
  if (!item) return { ok: false, reason: 'not-found' };
  if (!hasPw()) {
    unlockNow();
    markRead(id);
    openTarget(item);
    return { ok: true, reason: 'unlocked' };
  }
  _pending = id;
  showPasscodeBox();
  startPendingWatch();
  return { ok: true, reason: 'need-password', pending: id };
}

/* ── 打开目标：focus 不是注册 app，走番茄面板 ── */
function openTarget(item) {
  if (!item) return false;
  if (item.targetApp === null) return false; /* GROUP-FIX7：显式不跳转（日程提醒） */
  var t = item.targetApp || item.app || 'settings';
  try {
    if (t === 'focus') {
      if (window.GroupW && window.GroupW.openPomodoro) { window.GroupW.openPomodoro(); return true; }
      if (window.GroupAM && window.GroupAM.openFocusPanel) { window.GroupAM.openFocusPanel(); return true; }
      return false;
    }
    if (t && typeof AppRegistry !== 'undefined' && !AppRegistry[t]) return false; /* GROUP-FIX7：目标 app 未注册（已删）时不跳 */
    if (typeof AppManager !== 'undefined' && AppManager.launch) { AppManager.launch(t); return true; }
  } catch (e) { return false; }
  return false;
}
function openNotificationById(id) {
  var item = null;
  centerList().forEach(function (n) { if (n && n.id === id) item = n; });
  if (!item) return false;
  hideBanner();
  try { var s = sc(); if (s && s.hideAll) s.hideAll(); } catch (e) {}
  if (isLocked()) { openFromLock(id); return true; }
  markRead(id);
  openTarget(item);
  return true;
}

/* ── 通知主入口：呈现层，不是第二条发送通道 ── */
function notify(opts) {
  opts = opts || {};
  var kind = opts.kind || 'system';
  var typeKey = KIND_TYPE[kind] || 'system';
  var st = getSettings();
  var item = {
    id: 'as_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36),
    app: opts.app || KIND_APP[kind] || 'settings',
    appName: opts.appName || KIND_NAME[kind] || '系统',
    sender: opts.sender || '',
    title: opts.title || '通知',
    body: opts.body || '',
    time: Date.now(),
    kind: kind,
    targetApp: opts.targetApp === null ? null : (opts.targetApp || opts.app || KIND_APP[kind] || 'settings'), /* GROUP-FIX7：显式传 null = 不跳转（日程提醒无 app 可跳） */
    refId: opts.refId || '',
    read: false,
    silent: false
  };
  // 分类型开关关：该类型直接丢弃，不进中心也不弹
  if (st.types[typeKey] === false) return { delivered: false, reason: 'type_off', id: item.id };
  var now = new Date();
  // 总开关关：仍静默记进中心，不弹横幅、不响铃、不震动、不上锁屏列表
  if (!st.master) {
    item.silent = true;
    centerPush(item);
    try { renderLockList(); } catch (e) {}
    return { delivered: true, reason: 'master_off_silent', silent: true, id: item.id };
  }
  centerPush(item);
  try { renderLockList(); } catch (e) {}
  // 锁屏上：只显示锁屏列表；按真机规矩仍可响一声/震一下
  if (isLocked()) {
    if (st.sound) playSound();
    if (st.vibrate) vibrate([40]);
    return { delivered: true, reason: 'locked', id: item.id };
  }
  if (kind !== 'focus' && isFocusSilent()) return { delivered: true, reason: 'focus_center_only', id: item.id };
  showBanner(item);
  // 番茄完成不由 AS 再响一声：AM 的完成音已是完成提示音，AS 只弹横幅+记中心，避免双响
  if (kind !== 'focus') {
    if (st.sound) playSound();
    if (st.vibrate) vibrate([60, 40, 60]);
  }
  return { delivered: true, reason: 'banner', id: item.id };
}
function notifyChar(charName, text, type) {
  var key = (charName || '') + '|' + (type || '') + '|' + (text || '');
  var now = Date.now();
  if (_lastChar.key === key && now - _lastChar.ts < 60000) return { delivered: false, reason: 'dup' };
  _lastChar = { key: key, ts: now };
  var kind = (type === 'promise_reminder') ? 'promise' : 'char';
  return notify({ kind: kind, app: 'wechat', appName: '微信', sender: charName, title: charName, body: text, targetApp: 'wechat', refId: 'char:' + (type || 'proactive') + ':' + now });
}
/* 供剧本/阅读/影院等组调用的通用入口（阅读目前无完成事件，阅读组后续在完成处调它） */
function notifyExternal(opts) { return notify(opts || {}); }

/* ── 定时扫描：日程 / 习惯 / 承诺兜底 ── */
function parseSchedTs(it) {
  if (!it || !it.date) return 0;
  var tm = it.time || '09:00';
  var d = new Date(it.date + 'T' + tm + ':00');
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
function isPlanned(h, dateStr) {
  var t = (h && h.freq && h.freq.type) || 'daily';
  var p = String(dateStr || '').split('-');
  var w = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1).getDay();
  if (t === 'daily') return true;
  if (t === 'weekdays') return w >= 1 && w <= 5;
  if (t === 'weekends') return w === 0 || w === 6;
  if (t === 'custom') return (h.freq.days || []).indexOf(w) >= 0;
  return true;
}
function scanNow(nowMs) {
  var now = nowMs || Date.now();
  var out = { schedule: 0, habit: 0, promise: 0 };
  var data = loadData();
  // 日程：到时提醒；当天内打开手机可补发一次，过期多日不翻旧账
  try {
    var arr = read(SCHED_KEY, []);
    var today = todayStr(new Date(now));
    (Array.isArray(arr) ? arr : []).forEach(function (it) {
      if (!it || it.done) return;
      var due = parseSchedTs(it);
      if (!due || due > now) return;
      if (String(it.date) !== today) return;
      var fk = 'sched:' + (it.id || it.title) + ':' + it.date;
      if (data.fired[fk]) return;
      data.fired[fk] = now;
      var r = notify({ kind: 'schedule', app: 'schedule', appName: '日程', sender: '日程提醒', title: '日程提醒', body: '已到时间：' + (it.title || '') + (it.time ? (' · ' + it.time) : ''), targetApp: null, refId: String(it.id || '') }); /* GROUP-FIX7：日程 app 已删，提醒不跳转 */
      if (r && r.delivered) out.schedule++;
    });
  } catch (e) {}
  // 习惯：未打卡的习惯在 AS 提醒时间（默认 20:00）每天合并成一条提醒一次
  try {
    var hb = read(HABIT_KEY, null);
    var st = getSettings();
    if (hb && Array.isArray(hb.habits)) {
      var today2 = todayStr(new Date(now));
      var htTs = new Date(today2 + 'T' + (st.habitTime || '20:00') + ':00').getTime();
      if (!isNaN(htTs) && now >= htTs && !data.fired['habit:day:' + today2]) {
        var checks = (hb.checks && typeof hb.checks === 'object') ? hb.checks : {};
        var missing = hb.habits.filter(function (h) { return h && !h.archived && isPlanned(h, today2) && !checks[h.id + ':' + today2]; });
        data.fired['habit:day:' + today2] = now;
        if (missing.length) {
          var names = missing.slice(0, 3).map(function (h) { return (h.emoji || '') + h.name; }).join('、');
          var more = missing.length > 3 ? (' 等 ' + missing.length + ' 个') : '';
          var r2 = notify({ kind: 'habit', app: 'habits', appName: '习惯', sender: '习惯打卡', title: '习惯打卡提醒', body: '今天还有 ' + missing.length + ' 个习惯没打卡：' + names + more, targetApp: 'habits', refId: 'habit:' + today2 }); /* GROUP-FIX7：习惯提醒改跳习惯 app */
          if (r2 && r2.delivered) out.habit = 1;
        }
      }
    }
  } catch (e) {}
  // 承诺兜底：只呈现 O 组已标记 reminded（即 _dispatch 已发出）且 24 小时内到期、
  // AS 还没呈现过的；主路是 _dispatch 的 promise_reminder 事件，AS 不抢发、不重复
  try {
    var pr = read(PROM_KEY, []);
    (Array.isArray(pr) ? pr : []).forEach(function (p) {
      if (!p || p.status !== 'open' || !p.reminded) return;
      if (data.presented[p.id]) return;
      var due = p.dueTs || 0;
      if (!due) return;
      if (now < due - 24 * 3600 * 1000 || now > due + 24 * 3600 * 1000) return;
      data.presented[p.id] = now;
      var r3 = notify({ kind: 'promise', app: 'wechat', appName: '微信', sender: '', title: '承诺提醒', body: '之前答应你的「' + String(p.text || '').slice(0, 30) + '」快到时间了。', targetApp: 'wechat', refId: String(p.id) });
      if (r3 && r3.delivered) out.promise++;
    });
  } catch (e) {}
  saveData(data);
  try { renderLockList(); } catch (e) {}
  return out;
}

/* ── 接线：char 主动消息事件 / 番茄完成 / 剧本事件 / 影院完成 ── */
function hookProactive() {
  try {
    if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
      EventBus.on('mc:proactiveDispatched', function (d) {
        try { if (d) notifyChar(d.charName, d.text, d.type); } catch (e) {}
      });
      _eventBusOk = true;
    }
  } catch (e) { _eventBusOk = false; }
  return _eventBusOk;
}
function wrapFocus() {
  if (_focusWrapped) return false;
  try {
    if (!window.GroupN || typeof window.GroupN.focusEnd !== 'function') return false;
    var orig = window.GroupN.focusEnd;
    window.GroupN.focusEnd = function (nowMs, done) {
      var r = orig.call(window.GroupN, nowMs, done);
      try {
        if (r && done !== false) {
          notify({ kind: 'focus', app: 'focus', appName: '番茄专注', sender: '番茄钟', title: '番茄钟完成', body: (r.celebrate || ('完成了 ' + (r.minutes || '') + ' 分钟专注！')), targetApp: 'focus', refId: 'focus:' + Date.now() });
        }
      } catch (e) {}
      return r;
    };
    _focusWrapped = true;
    return true;
  } catch (e) { return false; }
}
function wrapScript() {
  if (_scriptWrapped) return false;
  try {
    if (!window.ScriptAE || typeof window.ScriptAE.logEvent !== 'function') return false;
    var orig = window.ScriptAE.logEvent;
    window.ScriptAE.logEvent = function (type, actor, summary, ref) {
      var r = orig.apply(window.ScriptAE, arguments);
      try {
        if (type === 'script_end') notify({ kind: 'script', app: 'script', appName: '剧本', sender: '剧本', title: '剧本完成', body: String(summary || '').slice(0, 80), targetApp: 'script', refId: 'script:end:' + Date.now() });
        else if (type === 'script_save') notify({ kind: 'script', app: 'script', appName: '剧本', sender: '剧本', title: '剧本已存为记忆', body: String(summary || '').slice(0, 80), targetApp: 'script', refId: 'script:save:' + Date.now() });
      } catch (e) {}
      return r;
    };
    _scriptWrapped = true;
    return true;
  } catch (e) { return false; }
}
function wrapCinema() {
  if (_cinemaWrapped) return false;
  try {
    if (!window.CinemaCore || typeof window.CinemaCore.finishFilm !== 'function') return false;
    var orig = window.CinemaCore.finishFilm;
    window.CinemaCore.finishFilm = function () {
      var r = orig.apply(window.CinemaCore, arguments);
      try {
        var title = '影片';
        try {
          var st2 = window.CinemaCore.state ? window.CinemaCore.state() : null;
          if (st2 && st2.filmId && window.CinemaCore.filmById) { var f = window.CinemaCore.filmById(st2.filmId); if (f && f.title) title = f.title; }
        } catch (e) {}
        notify({ kind: 'cinema', app: 'cinema', appName: '影院', sender: '影院', title: '影片放完', body: '《' + title + '》放完了。', targetApp: 'cinema', refId: 'cinema:' + Date.now() });
      } catch (e) {}
      return r;
    };
    _cinemaWrapped = true;
    return true;
  } catch (e) { return false; }
}

/* ── 样式：横幅 / 锁屏列表 / 设置开关（.as-switch 自绘，不用 .st-switch，避免设置页通用开关处理器误写 phone_settings_v3） ── */
function injectCSS() {
  if (document.getElementById('groupas-style')) return;
  var s = document.createElement('style');
  s.id = 'groupas-style';
  s.textContent = [
    '.as-banner{position:absolute;top:0;left:0;right:0;z-index:65000;display:flex;gap:8px;align-items:flex-start;background:rgba(255,255,255,.96);border-bottom:1px solid #ececef;padding:16px 14px 12px;transform:translateY(-110%);transition:transform .28s ease;box-shadow:0 4px 16px rgba(0,0,0,.12);cursor:pointer;}',
    '.as-banner.show{transform:translateY(0);}',
    '.as-banner-body{flex:1;min-width:0;}',
    '.as-banner-title{font-size:13px;font-weight:700;color:#25262a;}',
    '.as-banner-text{font-size:13px;color:#55565a;margin-top:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
    '.as-banner-x{border:none;background:none;font-size:18px;color:#8a857e;padding:0 2px;cursor:pointer;}',
    '.as-lock-list{margin:10px 18px 0;padding:2px 0;}',
    '.as-lock-head{font-size:13px;font-weight:700;color:rgba(255,255,255,.92);padding:6px 4px;}',
    '.as-lock-empty{font-size:13px;color:rgba(255,255,255,.6);padding:10px 4px;}',
    '.as-lock-item{display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.16);border-radius:14px;padding:11px 12px;margin-bottom:8px;cursor:pointer;}',
    '.as-lock-time{font-size:12px;color:rgba(255,255,255,.75);flex-shrink:0;}',
    '.as-lock-text{flex:1;font-size:13px;color:#fff;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.as-lock-go{color:rgba(255,255,255,.7);}',
    '.as-switch{width:44px;height:24px;border-radius:999px;background:var(--st-silver,#bfc8e0);position:relative;transition:background 180ms ease-out;flex-shrink:0;}',
    '.as-switch.on{background:var(--st-silver,#bfc8e0);}',
    '.as-knob{width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left 180ms ease-out;box-shadow:0 1px 3px rgba(30,39,72,.25);}',
    '.as-switch.on .as-knob{left:20px;background:var(--st-ink,#1e2748);}',
    '.sc-notif-card.sc-notif-unread{box-shadow:inset 3px 0 0 #ff3b30;}',
    '.sc-notif-note{font-size:12px;color:rgba(255,255,255,.65);text-align:center;padding:6px 18px 18px;line-height:1.6;}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ── 设置子页 ── */
function renderSettingsSub() {
  var st = getSettings();
  var sw = function (label, on, attr) {
    return '<div class="st-row"><span class="st-label">' + esc(label) + '</span><div class="st-row-right"><div class="as-switch' + (on ? ' on' : '') + '" ' + attr + '><div class="as-knob"></div></div></div></div>';
  };
  var rows = '';
  rows += sw('通知总开关', st.master, 'data-as-sw="master"');
  rows += sw('提示音（WebAudio 合成）', st.sound, 'data-as-sw="sound"');
  rows += sw('震动', st.vibrate, 'data-as-sw="vibrate"');
  rows += sw('char 消息', !!st.types.char, 'data-as-type="char"');
  rows += sw('日程提醒', !!st.types.schedule, 'data-as-type="schedule"');
  rows += sw('习惯打卡提醒', !!st.types.habit, 'data-as-type="habit"');
  rows += sw('番茄钟完成', !!st.types.focus, 'data-as-type="focus"');
  rows += sw('系统 / 剧本 / 阅读 / 影院', !!st.types.system, 'data-as-type="system"');
  return '<div class="st-sub" id="st-sub-asNotif">'
    + stSubBar('通知')
    + '<div class="st-bigtitle" style="padding-top:4px;">通知</div>'
    + '<div class="st-group">' + rows + '</div>'
    + '<div class="st-foot">总开关关了：只静默记进通知中心，不弹横幅、不响铃、不震动。某一类关了：这类不进中心也不弹。</div>'
    + '<div class="st-group">'
    + '<div class="st-row"><span class="st-label">习惯提醒时间</span><div class="st-row-right"><input id="as-habit-time" type="time" value="' + esc(st.habitTime) + '" style="font-size:17px;padding:8px 12px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);"><button id="as-habit-save" type="button" style="margin-left:8px;padding:8px 16px;border:0;border-radius:var(--st-radius-md,8px);background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);font-size:17px;">保存</button></div></div>'
    + '<div class="st-row"><span class="st-label">发送一条测试通知</span><div class="st-row-right"><button id="as-test-btn" type="button" style="padding:8px 16px;border:0;border-radius:var(--st-radius-md,8px);background:var(--st-paper-cool,#eef0f5);color:var(--st-ink,#1e2748);font-size:17px;">发送</button></div></div>'
    + '</div>'
    + '<div class="st-foot" id="as-tip"></div>'
    + '<div class="st-foot">' + esc(HONEST) + '</div>'
    + '<div class="st-foot">' + esc(APK_NOTE) + '</div>'
    + '<div style="height:40px;"></div></div>';
}
function bindSettingsSub(sub) {
  if (!sub || sub.__asBound) return false;
  sub.__asBound = true;
  sub.addEventListener('click', function (e) {
    var tgl = (e.target && e.target.closest) ? e.target.closest('[data-as-sw],[data-as-type]') : null;
    if (tgl) {
      e.stopPropagation();
      var k = tgl.getAttribute('data-as-sw');
      if (k) {
        var cur = getSettings();
        var was = !!cur[k]; // 先快照：cur 是 settings 对象的活引用，setSettings 后 cur[k] 已是新值
        var p = {};
        p[k] = !was;
        setSettings(p);
        tgl.classList.toggle('on', !was);
      }
      var tk = tgl.getAttribute('data-as-type');
      if (tk) {
        var st2 = getSettings();
        var nt = {};
        Object.keys(st2.types).forEach(function (x) { nt[x] = st2.types[x]; });
        nt[tk] = !nt[tk];
        setSettings({ types: nt });
        tgl.classList.toggle('on', nt[tk]);
      }
      return;
    }
    if (e.target.closest && e.target.closest('#as-habit-save')) {
      e.stopPropagation();
      var inp = sub.querySelector('#as-habit-time');
      var tip = sub.querySelector('#as-tip');
      var v = inp ? inp.value : '';
      if (/^\d{2}:\d{2}$/.test(v)) {
        setSettings({ habitTime: v });
        if (tip) tip.textContent = '已保存：每天 ' + v + ' 提醒未打卡的习惯（只提醒一次）。';
      } else if (tip) tip.textContent = '时间格式不对，请选一个时间。';
      return;
    }
    if (e.target.closest && e.target.closest('#as-test-btn')) {
      e.stopPropagation();
      var r = notify({ kind: 'system', app: 'settings', appName: '设置', sender: '通知测试', title: '测试通知', body: '这是一条本机本地通知：横幅、声音、震动都按当前开关走。', targetApp: 'settings' });
      var tip2 = sub.querySelector('#as-tip');
      if (tip2) tip2.textContent = '已发送测试通知（' + ((r && r.reason) || '') + '）。';
      return;
    }
  });
  return true;
}

/* ── 初始化 ── */
function init() {
  if (_inited) return { ok: false, reason: 'already' };
  _inited = true;
  try { injectCSS(); } catch (e) {}
  try { var s = sc(); if (s && s.normalizeRead) s.normalizeRead(); } catch (e) {}
  try { ensureBanner(); } catch (e) {}
  try { ensureLockList(); renderLockList(); } catch (e) {}
  try { hookProactive(); } catch (e) {}
  try { wrapFocus(); } catch (e) {}
  try { wrapScript(); } catch (e) {}
  try { wrapCinema(); } catch (e) {}
  try { scanNow(); } catch (e) {}
  try { setInterval(function () { try { scanNow(); } catch (e) {} }, 30000); } catch (e) {}
  return { ok: true, eventBusOk: _eventBusOk, focusWrapped: _focusWrapped, scriptWrapped: _scriptWrapped, cinemaWrapped: _cinemaWrapped };
}
function _debug() {
  return {
    marker: MARK, eventBusOk: _eventBusOk, focusWrapped: _focusWrapped,
    scriptWrapped: _scriptWrapped, cinemaWrapped: _cinemaWrapped,
    settings: getSettings(),
    locked: isLocked(), hasPw: hasPw(), unread: unreadCount(),
    lastSound: _lastSound, lastVibrate: _lastVibrate, pending: _pending,
    centerCount: centerList().length
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

return {
  MARK: MARK, getSettings: getSettings, setSettings: setSettings,
  hasPw: hasPw, isLocked: isLocked,
  unlockIfNoPassword: unlockIfNoPassword,
  notify: notify, notifyChar: notifyChar, notifyExternal: notifyExternal,
  scanNow: scanNow, openNotificationById: openNotificationById,
  openFromLock: openFromLock, openTarget: openTarget,
  renderLockList: renderLockList, renderSettingsSub: renderSettingsSub,
  bindSettingsSub: bindSettingsSub, showBanner: showBanner, hideBanner: hideBanner,
  playSound: playSound, vibrate: vibrate, unreadCount: unreadCount,
  markRead: markRead, removeNotification: removeNotif,
  cancelPending: cancelPending, _onUnlocked: _onUnlocked, init: init, _debug: _debug,
  lastSound: function () { return _lastSound; },
  lastVibrate: function () { return _lastVibrate; },
  _keys: { as: KEY, notif: NOTIF_KEY }
};
})();
