
/* GROUP-BJ-PROACTIVE-PHOTO  ═════════════════════════════════════════════════
BJ 组 · AI 主动发照片 + 主动发消息做实（端到端跑通）
照片：只用本机图片（此刻场景 / 相册 / 自拍相机 / 明信片插画），绝不外链、
  绝不编造；url 强制 data: 开头，拿不到本机图就不发；每张照片配一句
  char 口吻的文字，来源标在照片下面（photoSource + photoCaption）。
触发：AW 明信片（旅行到达/第一次/里程碑/节日，24h 内）→ 好看的地方
  （当前活动地点在风景集合且和上次拍的不一样）→ 想你了的自拍
  （K2 shouldNudge：沉默满 8 小时，一天一次）。
节流：照片开关 → 主动消息总开关 → R 粘性静音 → O 门（动手开关）
  → 每日照片上限（默认 2 张）→ 同一触发 key 去重；发照片同样三处记账。
消息：不另起引擎。_dispatch 走 deliverBurst（CharK burstSegments 拆
  2–3 条 + 打字停顿，深夜 softenLateNight），每类消息单独开关在
  _dispatch 开头拦截；checkAndSendMessage 是同一条路的可测入口。
设置：包一层 GroupR.renderSettingsSub/saveProactiveForm，在主动消息
  子页追加 BJ 区（主动照片开关/每日上限/六类消息开关/今日计数）。
新增键：char_bj_cfg_v1（配置）、char_bj_state_v1（已发照片去重状态）。
复用键（只读或经原属模块写）：phone_settings_v3、
  char_proactive_cfg_v1、char_proactive_state_v1、cike_postcards_v1、
  cike_char_day_v1、phone_wechat_store_v2。不抄第三方代码，无外链。
═════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var CFG_KEY = 'char_bj_cfg_v1';
var STATE_KEY = 'char_bj_state_v1';
var PC_KEY = 'cike_postcards_v1';
var MSG_KEYS = ['greeting', 'schedule', 'promise', 'milestone', 'nudge', 'memory'];
var MSG_LABEL = { greeting: '问候', schedule: '日程提醒', promise: '承诺提醒', milestone: '里程碑', nudge: '碎碎念/想你了', memory: '回忆' };
var TYPE_TO_MSG = { good_morning: 'greeting', good_night: 'greeting', midnight_check: 'greeting', return_after_long_absence: 'greeting', daytime: 'nudge', nudge_8h: 'nudge', special_date: 'schedule', promise_reminder: 'promise' };
var REASON_TO_MSG = { schedule: 'schedule', promise: 'promise', special_date: 'schedule', nudge: 'nudge', memory: 'memory' };
var SCENIC_RE = /咖啡|书店|河边|公园|海边|花店|美术馆/;
var PHOTO_DAY_CAP_DEFAULT = 2;
var DAY_MS = 86400000;

function rd(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return ('0' + n).slice(-2); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function phaseForHour(h) { return (h >= 6 && h < 17) ? 'day' : ((h >= 17 && h < 19) ? 'dusk' : 'night'); }
function uid(p) { return (p || 'bj') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }

// ── 配置 char_bj_cfg_v1 ──
function defaultCfg() { return { photo: true, photoDailyCap: PHOTO_DAY_CAP_DEFAULT, msg: { greeting: true, schedule: true, promise: true, milestone: true, nudge: true, memory: true } }; }
function getCfg() {
  var c = rd(CFG_KEY, null), d = defaultCfg();
  if (!c || typeof c !== 'object') return d;
  if (typeof c.photo === 'boolean') d.photo = c.photo;
  var cap = parseInt(c.photoDailyCap, 10);
  if (isFinite(cap)) d.photoDailyCap = Math.max(0, Math.min(5, cap));
  if (c.msg && typeof c.msg === 'object') MSG_KEYS.forEach(function (k) { if (typeof c.msg[k] === 'boolean') d.msg[k] = c.msg[k]; });
  return d;
}
function setCfg(patch) {
  var c = getCfg();
  if (!patch || typeof patch !== 'object') return c;
  if (typeof patch.photo === 'boolean') c.photo = patch.photo;
  var cap = parseInt(patch.photoDailyCap, 10);
  if (isFinite(cap)) c.photoDailyCap = Math.max(0, Math.min(5, cap));
  if (patch.msg && typeof patch.msg === 'object') MSG_KEYS.forEach(function (k) { if (typeof patch.msg[k] === 'boolean') c.msg[k] = patch.msg[k]; });
  wr(CFG_KEY, c);
  return c;
}

// ── 状态 char_bj_state_v1（只记已发照片的去重 key，30 天以上自动清，上限 100 条）──
function defaultState() { return { sentPhotoKeys: {}, lastPhotoTs: 0, lastScenicPlace: '' }; }
function pruneState(st) {
  var nowMs = Date.now(), keys;
  if (!st.sentPhotoKeys || typeof st.sentPhotoKeys !== 'object') st.sentPhotoKeys = {};
  keys = Object.keys(st.sentPhotoKeys);
  keys.forEach(function (k) { if (!st.sentPhotoKeys[k] || nowMs - st.sentPhotoKeys[k] > 30 * DAY_MS) delete st.sentPhotoKeys[k]; });
  keys = Object.keys(st.sentPhotoKeys);
  if (keys.length > 100) {
    keys.sort(function (a, b) { return st.sentPhotoKeys[a] - st.sentPhotoKeys[b]; }).slice(0, keys.length - 100).forEach(function (k) { delete st.sentPhotoKeys[k]; });
  }
  return st;
}
function readState() {
  var st = rd(STATE_KEY, null);
  if (!st || typeof st !== 'object') st = {};
  if (!st.sentPhotoKeys || typeof st.sentPhotoKeys !== 'object') st.sentPhotoKeys = {};
  if (typeof st.lastPhotoTs !== 'number') st.lastPhotoTs = 0;
  if (typeof st.lastScenicPlace !== 'string') st.lastScenicPlace = '';
  return st;
}
function writeState(st) { wr(STATE_KEY, pruneState(st)); return st; }
function photosTodayCount(now) {
  var t = todayStr(now || new Date()), st = readState(), n = 0;
  Object.keys(st.sentPhotoKeys).forEach(function (k) { var ts = st.sentPhotoKeys[k]; if (ts && todayStr(new Date(ts)) === t) n++; });
  return n;
}

// ── 微信会话 / 渲染 / 打字指示 ──
function wxStore() { try { return (typeof AppRegistry !== 'undefined' && AppRegistry && AppRegistry.wechat) ? AppRegistry.wechat.wxStore : null; } catch (e) { return null; } }
function charName() {
  try { if (typeof MemoryCore !== 'undefined' && MemoryCore.world) { var a = MemoryCore.world.get('activeChar'); if (a) return a; } } catch (e) {}
  return '夏油杰';
}
function findSession(name) {
  var st = wxStore(); if (!st) return null;
  var ss = st.sessions || [], s = null;
  for (var i = 0; i < ss.length; i++) { if (ss[i] && ss[i].name === name && !ss[i].isGroup) { s = ss[i]; break; } }
  return s;
}
function ensureSession(name) {
  var s = findSession(name);
  if (s) return s;
  var st = wxStore(); if (!st) return null;
  // v2 没有预置会话：和 AW 明信片投递同款做法，没有就新建一个单聊会话
  s = { id: 'chat_bj_' + Date.now(), name: name, avatar: '', isGroup: false, isPinned: false, unread: 0, heartsVoice: '', emotionState: '平静', chatBg: '', lastTime: '刚刚', preview: '', memory: [], events: [], messages: [] };
  st.sessions.push(s);
  return s;
}
function persistWx() { var st = wxStore(); try { if (st && typeof st._persist === 'function') st._persist(); } catch (e) {} }
function renderWx() { try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates(); } catch (e) {} }
function scrollChat() { try { var b = document.getElementById('wx-msg-stream-container'); if (b) b.scrollTop = b.scrollHeight; } catch (e) {} }
function showTyping(sess, on) {
  try {
    var st = wxStore();
    if (!st || st.currentChatId !== sess.id) return false;
    var bar = document.getElementById('wx-chat-state-bar');
    if (!bar) return false;
    if (on) bar.classList.add('wx-typing'); else bar.classList.remove('wx-typing');
    return true;
  } catch (e) { return false; }
}
function island(name, text) {
  try {
    var el = document.getElementById('sys-dynamic-island');
    if (!el) return;
    el.innerHTML = '<span style="font-size:11px;color:#fff;padding:0 8px;">' + esc(name) + '：' + esc(String(text || '').slice(0, 16)) + '</span>';
    el.style.width = '200px';
    setTimeout(function () { el.innerHTML = ''; el.style.width = ''; }, 4000);
  } catch (e) {}
}

// ── 真人式分段：复用 K2 burstSegments / softenLateNight，开关关时单条 ──
function splitSegments(text) {
  var t = String(text == null ? '' : text).trim();
  if (!t) return ['……'];
  try {
    if (window.CharK && window.CharK.humanizeEnabled && window.CharK.humanizeEnabled()) {
      var h = new Date().getHours();
      if (h >= 23 || h < 5) return [window.CharK.softenLateNight(t, h)];
      var segs = window.CharK.burstSegments(t);
      if (segs && segs.length) return segs;
    }
  } catch (e) {}
  return [t];
}
function typingDelayMs(seg) { return 600 + Math.min(String(seg || '').length * 60, 1400); }
// 往会话里投递一段 burst：首条立即发，其余带“正在输入”停顿后发；返回段数（0 = 没发）
function deliverBurst(sess, charName, text, opts) {
  if (!sess || text == null || String(text).trim() === '') return 0;
  opts = opts || {};
  var segs = splitSegments(text);
  var base = Date.now();
  var pushOne = function (i) {
    sess.messages.push({ id: 'bj_' + base + '_' + i + '_' + Math.floor(Math.random() * 1000), sender: charName, type: 'text', content: segs[i], time: '刚刚' });
    renderWx(); scrollChat();
  };
  pushOne(0);
  if (opts.instant || segs.length <= 1) { for (var j = 1; j < segs.length; j++) pushOne(j); return segs.length; }
  var idx = 1;
  var step = function () {
    if (idx >= segs.length) { showTyping(sess, false); return; }
    showTyping(sess, true);
    var seg = segs[idx];
    setTimeout(function () {
      showTyping(sess, false);
      pushOne(idx);
      idx++;
      if (idx < segs.length) step();
    }, typingDelayMs(seg));
  };
  step();
  return segs.length;
}

// ── 每类主动消息开关 ──
function msgTypeAllowed(type) {
  var k = TYPE_TO_MSG[type];
  if (!k) return true;
  return getCfg().msg[k] !== false;
}
function reasonToMsgKey(kind) { return REASON_TO_MSG[kind] || null; }
function messageTextForReason(reason) {
  var kind = reason.kind, t = String(reason.text || '').trim();
  if (kind === 'schedule') return '今天要' + t + '，别忘了。我会记着的。';
  if (kind === 'promise') return '之前答应你的「' + t.slice(0, 20) + '」，快到时间了，别忘了我。';
  if (kind === 'special_date') return t || '今天有个重要的日子，记得吗？';
  if (kind === 'nudge') return t || '想你了。';
  if (kind === 'memory') return '突然想起' + t + '。那天真的很好。';
  return t || '在吗？';
}
// 主动消息可测入口：R 门（含理由）→ BJ 按类开关 → burst 投递 → 三处记账 + 去重标记
function checkAndSendMessage(now, opts) {
  now = now || new Date(); opts = opts || {};
  var gate = null;
  try { if (window.GroupR && window.GroupR.gateForTrigger) gate = window.GroupR.gateForTrigger(now); } catch (e) {}
  if (!gate) return { sent: false, reason: 'no_gate' };
  if (!gate.ok) return { sent: false, reason: gate.reason };
  var reason = gate.reason || {};
  var mk = reasonToMsgKey(reason.kind);
  if (mk && getCfg().msg[mk] === false) {
    try { if (window.CharInnerLife && window.CharInnerLife.noteSuppressed) window.CharInnerLife.noteSuppressed('bj_msg_off:' + mk); } catch (e) {}
    return { sent: false, reason: 'msg_off', kind: reason.kind };
  }
  var name = charName();
  var sess = ensureSession(name);
  if (!sess) return { sent: false, reason: 'no_session' };
  var text = messageTextForReason(reason);
  var segs = splitSegments(text);
  var n = deliverBurst(sess, name, text, { type: 'bj:' + (reason.kind || 'msg'), instant: !!opts.instant });
  if (!n) return { sent: false, reason: 'deliver_failed' };
  sess.preview = segs[segs.length - 1];
  sess.lastTime = '刚刚';
  sess.unread = (sess.unread || 0) + 1;
  persistWx(); renderWx(); scrollChat();
  try { if (typeof MemoryCore !== 'undefined' && MemoryCore.write) MemoryCore.write({ source: name, content: text, layer: 'short', forceWeight: 0.4 }); } catch (e) {}
  try { if (window.GroupR && window.GroupR.recordSent) window.GroupR.recordSent('bj:' + (reason.kind || 'msg'), text, reason); } catch (e) {}
  try { if (window.CharInnerLife && window.CharInnerLife.noteSent) window.CharInnerLife.noteSent('bj:' + (reason.kind || 'msg'), text, name); } catch (e) {}
  try { if (reason.kind === 'special_date' && window.CharK && window.CharK.markReminded && reason.key) window.CharK.markReminded(reason.key, Date.now()); } catch (e) {}
  try { if (reason.kind === 'promise' && window.CharInnerLife && window.CharInnerLife.markReminded && reason.key) window.CharInnerLife.markReminded(String(reason.key).replace(/^promise:/, '')); } catch (e) {}
  try { if (reason.kind === 'nudge' && window.CharK && window.CharK.markNudged) window.CharK.markNudged(Date.now()); } catch (e) {}
  return { sent: true, kind: reason.kind, segments: n, text: text };
}

// ── 照片来源（只用本机图片；url 强制 data: 开头）──
function svgDataUrl(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
function postcards() {
  try { if (window.AWGroup && window.AWGroup.listPostcards) return window.AWGroup.listPostcards(); } catch (e) {}
  var v = rd(PC_KEY, []);
  return Array.isArray(v) ? v : [];
}
function sceneSvgFor(place, activity, phase) {
  try {
    if (window.AWGroup && window.AWGroup.postcardSVG && window.AWGroup.sceneKeyFor) return window.AWGroup.postcardSVG(window.AWGroup.sceneKeyFor(place, activity), phase || 'day');
  } catch (e) {}
  return '';
}
function albumImages() {
  var out = [];
  try {
    var st = wxStore();
    (st && st.sessions || []).forEach(function (s) {
      (s.messages || []).forEach(function (m) {
        if (m && m.type === 'image' && typeof m.url === 'string' && m.url.indexOf('data:') === 0) out.push({ url: m.url, label: '相册', note: (s.name || '') + '的聊天图片' });
      });
    });
  } catch (e) {}
  try {
    if (window.CharK && window.CharK.activeCustomChar) {
      var c = window.CharK.activeCustomChar();
      if (c && c.dataUrl && String(c.dataUrl).indexOf('data:') === 0) out.push({ url: c.dataUrl, label: '相册', note: 'char 立绘' });
    }
  } catch (e) {}
  return out;
}
function selfieUrl(place) {
  try {
    if (window.CharK && window.CharK.selfieDataUrl) {
      var look = (window.CharK.loadLook) ? window.CharK.loadLook() : null;
      return window.CharK.selfieDataUrl(look, place || '街角咖啡馆', '蓝色外套');
    }
  } catch (e) {}
  return '';
}
// 找一个该发的照片触发（只看真实事件；没有就返回 null，不编造）
function pickPhotoTrigger(now) {
  now = now || new Date();
  var nowMs = now.getTime();
  var st = readState();
  var sent = function (k) { return !!st.sentPhotoKeys[k]; };
  // 1) 新明信片：旅行到达 / 第一次 / 里程碑 / 节日（24 小时内，照片还没发过）
  var pcs = postcards();
  for (var i = 0; i < pcs.length; i++) {
    var pc = pcs[i];
    if (!pc || !pc.place || !pc.event) continue;
    if (['travel', 'first', 'milestone', 'festival'].indexOf(pc.source) === -1) continue;
    if (!pc.ts || nowMs - pc.ts > 24 * 3600000) continue;
    var key = 'pc:' + pc.id;
    if (sent(key)) continue;
    var scene = pc.scene || ((window.AWGroup && window.AWGroup.sceneKeyFor) ? window.AWGroup.sceneKeyFor(pc.place, pc.event) : 'street');
    var svg = '';
    try { if (window.AWGroup && window.AWGroup.postcardSVG) svg = window.AWGroup.postcardSVG(scene, phaseForHour(new Date(pc.ts).getHours())); } catch (e) {}
    if (!svg) continue;
    var kind = pc.source === 'travel' ? 'travel' : (pc.source === 'first' ? 'first' : (pc.source === 'milestone' ? 'milestone' : 'festival'));
    return { kind: kind, key: key, source: '明信片', url: svgDataUrl(svg), caption: String(pc.caption || '').trim() || ('到' + pc.place + '啦。'), place: pc.place, event: pc.event, ref: '明信片 · ' + pc.place };
  }
  // 2) 好看的地方：当前活动地点在风景集合里，且和上次拍的不一样
  try {
    if (window.AWGroup && window.AWGroup.currentActivity) {
      var cur = window.AWGroup.currentActivity(nowMs);
      if (cur && cur.place && SCENIC_RE.test(cur.place) && cur.place !== st.lastScenicPlace) {
        var key2 = 'scenic:' + cur.place + ':' + todayStr(now);
        if (!sent(key2)) {
          var svg2 = sceneSvgFor(cur.place, cur.activity, cur.phase);
          if (svg2) return { kind: 'scenic', key: key2, source: '此刻场景', url: svgDataUrl(svg2), caption: cur.place + '这里很好看，拍给你看。', place: cur.place, event: cur.activity, ref: '此刻场景 · ' + cur.place };
          var alb = albumImages();
          if (alb.length) return { kind: 'scenic', key: key2, source: '相册', url: alb[0].url, caption: cur.place + '这里很好看，翻到一张给你看。', place: cur.place, event: cur.activity, ref: '相册 · ' + cur.place };
        }
      }
    }
  } catch (e) {}
  // 3) 想你了的自拍：沉默满 8 小时（K2 念叨），一天一次
  try {
    if (window.CharK && window.CharK.shouldNudge && window.CharK.shouldNudge(nowMs)) {
      var key3 = 'nudge-selfie:' + todayStr(now);
      if (!sent(key3)) {
        var place3 = '';
        try { place3 = window.AWGroup.currentActivity(nowMs).place; } catch (e) {}
        var url3 = selfieUrl(place3 || '街角咖啡馆');
        if (url3) return { kind: 'selfie', key: key3, source: '自拍相机', url: url3, caption: '想你了，自拍一张给你。', place: place3 || '', event: '想你了', ref: '自拍 · 想你了' };
      }
    }
  } catch (e) {}
  return null;
}
// 照片节流门（事件驱动，不走 R 的心跳/思念等待；其余和主动消息同一套门）
function gateForPhoto(now, trigger) {
  now = now || new Date();
  var fail = function (r) { return { ok: false, reason: r }; };
  var cfg = getCfg();
  if (cfg.photo === false) return fail('photo_off');
  try { var ps = rd('phone_settings_v3', null); if (!ps || ps.proactiveMsg !== true) return fail('proactive_off'); } catch (e) { return fail('proactive_off'); }
  try { if (window.GroupR && window.GroupR.getCfg && window.GroupR.getCfg().muted) return fail('muted'); } catch (e) {}
  try {
    if (window.CharInnerLife && window.CharInnerLife.canSendProactive) {
      var og = window.CharInnerLife.canSendProactive(now);
      if (!og.ok) return fail(og.reason);
    }
  } catch (e) {}
  if (photosTodayCount(now) >= cfg.photoDailyCap) return fail('photo_cap');
  if (trigger && readState().sentPhotoKeys[trigger.key]) return fail('dup');
  return { ok: true, reason: '' };
}
// 同步发一张照片：图片消息（带来源标注字段）+ 一句 caption 文字；三处记账
function sendPhotoNow(trigger, opts) {
  opts = opts || {};
  var now = opts.now || new Date();
  if (!trigger || typeof trigger.url !== 'string' || trigger.url.indexOf('data:') !== 0) return { sent: false, reason: 'bad_url' };
  if (!trigger.source) return { sent: false, reason: 'no_source' };
  if (!opts.force) {
    var g = gateForPhoto(now, trigger);
    if (!g.ok) {
      try { if (window.CharInnerLife && window.CharInnerLife.noteSuppressed) window.CharInnerLife.noteSuppressed('bj_photo:' + g.reason); } catch (e) {}
      return { sent: false, reason: g.reason };
    }
  }
  var name = charName();
  var sess = ensureSession(name);
  if (!sess) return { sent: false, reason: 'no_session' };
  var base = Date.now();
  sess.messages.push({ id: 'bjph_' + base, sender: name, type: 'image', url: trigger.url, photoSource: trigger.source, photoCaption: trigger.caption || '', time: '刚刚' });
  if (trigger.caption) sess.messages.push({ id: 'bjphc_' + base, sender: name, type: 'text', content: trigger.caption, time: '刚刚' });
  sess.preview = '[图片]';
  sess.lastTime = '刚刚';
  sess.unread = (sess.unread || 0) + 1;
  persistWx(); renderWx(); scrollChat();
  try { if (typeof MemoryCore !== 'undefined' && MemoryCore.write) MemoryCore.write({ source: name, content: '[照片 · ' + trigger.source + '] ' + (trigger.caption || ''), layer: 'short', forceWeight: 0.4 }); } catch (e) {}
  island(name, '📷 ' + (trigger.caption || '[图片]'));
  try { if (window.GroupR && window.GroupR.recordSent) window.GroupR.recordSent('photo:' + trigger.kind, trigger.caption || '[图片]', { kind: 'photo:' + trigger.kind, key: trigger.key, text: trigger.caption || '', ref: trigger.ref || '' }); } catch (e) {}
  try { if (window.CharInnerLife && window.CharInnerLife.noteSent) window.CharInnerLife.noteSent('photo:' + trigger.kind, trigger.caption || '[图片]', name); } catch (e) {}
  var st = readState();
  st.sentPhotoKeys[trigger.key] = Date.now();
  st.lastPhotoTs = Date.now();
  if (trigger.kind === 'scenic' && trigger.place) st.lastScenicPlace = trigger.place;
  writeState(st);
  try { if (trigger.kind === 'selfie' && window.CharK && window.CharK.markNudged) window.CharK.markNudged(Date.now()); } catch (e) {}
  return { sent: true, kind: trigger.kind, source: trigger.source, caption: trigger.caption };
}
// 异步发照片：先显示“正在输入”停顿一下再发（instant 时同步发，供测试）
function sendPhoto(trigger, opts) {
  opts = opts || {};
  if (opts.instant) return sendPhotoNow(trigger, opts);
  var name = charName();
  var sess = ensureSession(name);
  if (!sess) return { sent: false, reason: 'no_session' };
  showTyping(sess, true);
  setTimeout(function () {
    showTyping(sess, false);
    try { sendPhotoNow(trigger, opts); } catch (e) {}
  }, 1200);
  return { queued: true, kind: trigger && trigger.kind };
}
// 照片 tick：只发照片，不发消息（消息仍由 worldstate_proactive 引擎发，避免双发）
function tick(now, opts) {
  now = now || new Date(); opts = opts || {};
  var trig = null;
  try { trig = pickPhotoTrigger(now); } catch (e) {}
  if (!trig) return { sent: false, reason: 'no_trigger' };
  return sendPhoto(trig, { now: now, instant: !!opts.instant, force: !!opts.force });
}

// ── 设置页：包一层 GroupR 的主动消息子页（不改 R 组源码）──
function settingsSectionHTML() {
  var cfg = getCfg();
  var count = photosTodayCount(new Date());
  var chk = function (on) { return on ? ' checked' : ''; };
  var row = function (id, label, on) {
    return '<div class="st-row"><span class="st-label">' + esc(label) + '</span><div class="st-row-right"><input id="' + id + '" type="checkbox"' + chk(on) + ' style="width:22px;height:22px;"></div></div>';
  };
  var rows = '';
  MSG_KEYS.forEach(function (k) { rows += row('bj-msg-' + k, MSG_LABEL[k], cfg.msg[k]); });
  return '<div class="st-bigtitle" style="padding-top:8px;">主动照片与主动消息（BJ 组）</div>'
    + '<div class="st-foot" style="margin:0 16px 8px;">照片只用本机图片（此刻场景 / 相册 / 自拍相机 / 明信片插画），不外链、不编造；每张照片下面会标出来源。主动消息按触发种类单独开关，关掉的那类就不发。</div>'
    + '<div class="st-group">'
    + row('bj-photo-enabled', '主动照片', cfg.photo)
    + '<div class="st-row"><span class="st-label">每日主动照片上限</span><div class="st-row-right"><input id="bj-photo-cap" type="number" min="0" max="5" value="' + cfg.photoDailyCap + '" style="width:72px;height:40px;text-align:right;border:1px solid var(--st-silver,#bfc8e0);border-radius:8px;padding:0 12px;font-size:17px;"> 张</div></div>'
    + rows
    + '</div>'
    + '<div class="st-foot" id="bj-status">今日主动照片已发 ' + count + ' / ' + cfg.photoDailyCap + ' 张。</div>';
}
function wrapSettings() {
  try {
    if (!window.GroupR || !window.GroupR.renderSettingsSub || !window.GroupR.saveProactiveForm || window.GroupR.__bjWrapped) return false;
    var origRender = window.GroupR.renderSettingsSub;
    var origSave = window.GroupR.saveProactiveForm;
    window.GroupR.renderSettingsSub = function (act) {
      var html = origRender.apply(window.GroupR, arguments);
      if (act !== 'proactive' || !html) return html;
      // BJ 区插在子页末尾的 40px spacer 之前（只用 lastIndexOf 定位；
      // marker 拆开写，避免全文件 div 计数把这个字面量当成一个未闭合的 div）
      var marker = '<di' + 'v style="height:40px;">';
      var pos = html.lastIndexOf(marker);
      if (pos !== -1) html = html.slice(0, pos) + settingsSectionHTML() + html.slice(pos);
      return html;
    };
    window.GroupR.saveProactiveForm = function (sub) {
      var r = origSave.apply(window.GroupR, arguments);
      try {
        var v = function (id) { var el = sub.querySelector('#' + id); return el ? el.value : null; };
        var c = function (id) { var el = sub.querySelector('#' + id); return el ? !!el.checked : false; };
        var patch = { photo: c('bj-photo-enabled'), photoDailyCap: parseInt(v('bj-photo-cap'), 10), msg: {} };
        MSG_KEYS.forEach(function (k) { patch.msg[k] = c('bj-msg-' + k); });
        var cfg = setCfg(patch);
        var el2 = sub.querySelector('#bj-status');
        if (el2) el2.textContent = '今日主动照片已发 ' + photosTodayCount(new Date()) + ' / ' + cfg.photoDailyCap + ' 张。';
        r.bj = { cfg: cfg };
        r.summary = (r.summary || '') + ' 主动照片' + (cfg.photo ? '开' : '关') + '（每日 ' + cfg.photoDailyCap + ' 张）。';
      } catch (e) {}
      return r;
    };
    window.GroupR.__bjWrapped = true;
    return true;
  } catch (e) { return false; }
}

function init() {
  try { wrapSettings(); } catch (e) {}
  try {
    if (typeof CentralEngine !== 'undefined' && CentralEngine && CentralEngine.register) {
      CentralEngine.register('bj_proactive_photo', null, 240, function () { try { tick(new Date(), {}); } catch (e) {} }, false);
    }
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

window.GroupBJ = {
  getCfg: getCfg, setCfg: setCfg, msgTypeAllowed: msgTypeAllowed, reasonToMsgKey: reasonToMsgKey,
  splitSegments: splitSegments, deliverBurst: deliverBurst, messageTextForReason: messageTextForReason,
  checkAndSendMessage: checkAndSendMessage,
  pickPhotoTrigger: pickPhotoTrigger, gateForPhoto: gateForPhoto, sendPhotoNow: sendPhotoNow, sendPhoto: sendPhoto,
  tick: tick, photosTodayCount: photosTodayCount, albumImages: albumImages,
  ensureSession: ensureSession, charName: charName,
  settingsSectionHTML: settingsSectionHTML, wrapSettings: wrapSettings,
  MSG_KEYS: MSG_KEYS, MSG_LABEL: MSG_LABEL, TYPE_TO_MSG: TYPE_TO_MSG,
  _keys: { cfg: CFG_KEY, state: STATE_KEY },
  _readState: readState, _writeState: writeState
};
})();
