
/* GROUP-BI · char 主动来电做实（端到端）
   触发来自真实数据（承诺/日程/问候），不编造；底线：动手开关 +
   深夜 22:00-08:00 绝不打；
   铃声接 BH 组（phone_ringtone_v1 / window.GroupBH），BH 不在则用默认
   合成铃声；接听即停铃；挂断即结束通话；拒接原因进微信 + 通话记录；
   未接只留一条微信跟进；
   回拨 10 秒未接通自动转文字；通话记录 + 一行摘要。
   新增键：phone_bi_call_cfg_v1 / phone_bi_call_state_v1（仅本组）。
   只读：char_promises_v1 / phone_schedule_v1 /
   phone_call_log_v1 / char_inner_state_v1 / phone_ringtone_v1。
   全部新写代码，未抄任何第三方代码。 */
window.GroupBI = (() => {
'use strict';
var CFG_KEY = 'phone_bi_call_cfg_v1';
var STATE_KEY = 'phone_bi_call_state_v1';
var PROM_KEY = 'char_promises_v1';
var SCHED_KEY = 'phone_schedule_v1';
var RING_KEY = 'phone_ringtone_v1';
var CALL_LOG_KEY = 'phone_call_log_v1';
var NIGHT_START = 22, NIGHT_END = 8;
var SLOW_ANSWER_MS = 10000;
var DEFAULT_PICKUP_MS = 6000;

function read(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); if (sec < 60) return sec + '秒'; return Math.floor(sec / 60) + '分' + (sec % 60) + '秒'; }

/* 开关：独立键 phone_bi_call_cfg_v1，默认开；不动设置总开关 */
function getCfg() { var c = read(CFG_KEY, null); if (!c || typeof c !== 'object') return { callsEnabled: true }; return { callsEnabled: c.callsEnabled !== false }; }
function callsEnabled() { return getCfg().callsEnabled; }
function setCallsEnabled(v) { var c = { callsEnabled: !!v }; write(CFG_KEY, c); return c.callsEnabled; }

/* 本组状态：seen 去重 / 问候计数 / 最近一次摘要、拒接、未接、回拨 */
function defaultState() { return { seen: {}, greet: { date: '', count: 0 }, lastSummary: '', lastDecline: null, lastMissed: null, lastCall: null, lastCallback: null }; }
function getState() { var s = read(STATE_KEY, null); if (!s || typeof s !== 'object') return defaultState(); if (!s.seen || typeof s.seen !== 'object') s.seen = {}; if (!s.greet || typeof s.greet !== 'object') s.greet = { date: '', count: 0 }; return s; }
function saveState(s) { write(STATE_KEY, s); return s; }
function seenHas(key) { var st = getState(); return !!(st.seen && st.seen[key]); }
function seenMark(key) {
  var st = getState(); st.seen[key] = Date.now();
  var ks = Object.keys(st.seen);
  if (ks.length > 80) { var nk = {}; ks.slice(-80).forEach(function (k) { nk[k] = st.seen[k]; }); st.seen = nk; }
  saveState(st);
}

/* 底线：深夜 + 动手开关 */
function isNight(now) { var h = (now || new Date()).getHours(); return h >= NIGHT_START || h < NIGHT_END; }
function baseGate(now) {
  now = now || new Date();
  if (!callsEnabled()) return { ok: false, reason: 'calls_off' };
  if (isNight(now)) return { ok: false, reason: 'night' };
  try {
    if (window.CharInnerLife && window.CharInnerLife.canSendProactive) {
      var g = window.CharInnerLife.canSendProactive(now);
      if (!g.ok) return { ok: false, reason: g.reason };
      return { ok: true, reason: '' };
    }
  } catch (e) {}
  return { ok: true, reason: '' };
}
function canCall(now, kind) {
  var g = baseGate(now || new Date());
  if (!g.ok) return g;
  if (kind === 'greeting') {
    var st = getState();
    if (st.greet && st.greet.date === todayStr(now || new Date()) && (st.greet.count || 0) >= 1) return { ok: false, reason: 'greet_done' };
  }
  return { ok: true, reason: '' };
}

/* 用户最后互动时间（读 O / K2 / humanize 三处，取最晚；只读） */
function lastInteractTs() {
  var t = 0;
  try { var a = read('char_inner_state_v1', null); if (a && a.lastInteractTs) t = Math.max(t, a.lastInteractTs); } catch (e) {}
  try { var b = read('char_proactive_state_v1', null); if (b) { if (b.lastUserTs) t = Math.max(t, b.lastUserTs); if (b.lastUserReplyTs) t = Math.max(t, b.lastUserReplyTs); } } catch (e) {}
  try { var c = read('char_humanize_v1', null); if (c && c.lastUserTs) t = Math.max(t, c.lastUserTs); } catch (e) {}
  return t || 0;
}

/* 真实数据源：承诺 / 日程 */
function readPromises() { var a = read(PROM_KEY, []); return Array.isArray(a) ? a : []; }
function readSched() { var a = read(SCHED_KEY, []); return Array.isArray(a) ? a : []; }
function schedStartMs(it) {
  if (!it || !it.date) return null;
  var t = String(it.time || '').split(':');
  var h = parseInt(t[0], 10) || 0, m = parseInt(t[1], 10) || 0;
  var d = new Date(String(it.date) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.getTime() + h * 3600000 + m * 60000;
}
function alreadyCalledToday(reason, now) {
  try {
    var logs = (window.GroupAO && window.GroupAO.loadCallLog) ? window.GroupAO.loadCallLog() : [];
    var ds = todayStr(now);
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i];
      if (e && e.reason === reason && e.time && todayStr(new Date(e.time)) === ds) return true;
    }
  } catch (e) {}
  return false;
}

/* 触发挑选（不含门禁；门禁由 canCall/tick 单独算，便于测试）
   优先级：拿不定主意 > 承诺到期 > 日程到点 > 每日问候。 */
function pickTrigger(now) {
  now = now || new Date();
  var nowMs = now.getTime();
  var i, p, short, reason, key;
  var proms = readPromises();
  for (i = 0; i < proms.length; i++) {
    p = proms[i];
    if (!p || p.status !== 'open' || typeof p.dueTs !== 'number') continue;
    short = String(p.text || '').slice(0, 24);
    if (!short) continue;
    var overdue = nowMs - p.dueTs;
    if (p.reminded && overdue >= 0 && overdue <= 24 * 3600 * 1000) {
      reason = '之前说的「' + short + '」还没定下来，打来问问你怎么想';
      key = 'undecided:' + (p.id || p.text);
      if (!seenHas(key) && !alreadyCalledToday(reason, now)) return { kind: 'undecided', reason: reason, key: key, ref: p.id || '' };
      continue;
    }
    var diff = p.dueTs - nowMs;
    if (diff <= 15 * 60 * 1000 && diff >= -60 * 60 * 1000) {
      reason = '承诺到期：' + short;
      key = 'promise:' + (p.id || p.text);
      if (!seenHas(key) && !alreadyCalledToday(reason, now)) return { kind: 'promise', reason: reason, key: key, ref: p.id || '' };
    }
  }
  var sched = readSched();
  for (i = 0; i < sched.length; i++) {
    var it = sched[i];
    if (!it || it.done) continue;
    var start = schedStartMs(it);
    if (start == null) continue;
    if (start <= nowMs && nowMs - start <= 30 * 60 * 1000) {
      short = String(it.title || '').slice(0, 24);
      if (!short) continue;
      reason = '约好的事到了：' + short;
      key = 'schedule:' + (it.id || it.title) + ':' + todayStr(now);
      if (!seenHas(key) && !alreadyCalledToday(reason, now)) return { kind: 'schedule', reason: reason, key: key, ref: it.id || '' };
    }
  }
  var li = lastInteractTs();
  if (li && nowMs - li < 30 * 60 * 1000) return null;
  /* 问候每天一次由 canCall 的 greet_done 门禁执行，这里不提前用 seen 拦，
     否则第二次 tick 会报 no_trigger 而不是真实的 greet_done */
  return { kind: 'greeting', reason: '想你了，打来看看你在干嘛', key: 'greet:' + todayStr(now), ref: '' };
}

function callUiPresent() {
  try { return !!(document.getElementById('ao-incoming') || document.getElementById('ao-incall') || document.getElementById('bi-outgoing')); } catch (e) { return false; }
}
function fire(trigger, now) {
  if (!trigger) return false;
  if (callUiPresent()) return false;
  if (!window.GroupAO || !window.GroupAO.showIncoming) return false;
  now = now || new Date();
  var ok = false;
  try { ok = window.GroupAO.showIncoming({ kind: trigger.kind, reason: trigger.reason }); } catch (e) { ok = false; }
  if (!ok) return false;
  seenMark(trigger.key);
  if (trigger.kind === 'greeting') {
    var st = getState();
    if (!st.greet || st.greet.date !== todayStr(now)) st.greet = { date: todayStr(now), count: 0 };
    st.greet.count = (st.greet.count || 0) + 1;
    saveState(st);
  }
  try {
    if (window.CharInnerLife && window.CharInnerLife.logCycle) {
      window.CharInnerLife.logCycle({
        sense: '到了该打电话的时候：' + trigger.reason,
        appraise: '节流门放行（不在深夜、动手开关开着）',
        decide: '打一通电话给你', act: '来电：' + trigger.reason, reflect: '等你接听',
        trigger: 'bi_call:' + trigger.kind, memoryRef: '来电原因：' + trigger.reason
      });
    }
  } catch (e) {}
  return true;
}
function tick(now) {
  now = now || new Date();
  if (callUiPresent()) return { fired: false, reason: 'in_call' };
  var tr = null;
  try { tr = pickTrigger(now); } catch (e) { tr = null; }
  if (!tr) return { fired: false, reason: 'no_trigger' };
  var g = canCall(now, tr.kind);
  if (!g.ok) {
    try { if (window.CharInnerLife && window.CharInnerLife.noteSuppressed) window.CharInnerLife.noteSuppressed('bi:' + g.reason); } catch (e) {}
    return { fired: false, reason: g.reason, trigger: tr };
  }
  var ok = fire(tr, now);
  return { fired: ok, reason: ok ? 'ok' : 'show_failed', trigger: tr };
}

/* 铃声：接 BH 组（有设置用设置的、无设置用默认），BH 不在也不报错 */
var ring = { playing: false, bursts: 0, source: 'default', name: '默认铃声', audio: null, actx: null };
function resolveRingtone(opts) {
  opts = opts || {};
  var onLine = (typeof opts.onLine === 'boolean') ? opts.onLine : (function () { try { return navigator.onLine !== false; } catch (e) { return true; } })();
  try {
    if (window.GroupBH) {
      var cand = null;
      if (typeof window.GroupBH.getRingtone === 'function') cand = window.GroupBH.getRingtone();
      else if (typeof window.GroupBH.currentRingtone === 'function') cand = window.GroupBH.currentRingtone();
      else if (window.GroupBH.ringtone) cand = window.GroupBH.ringtone;
      if (cand && (cand.url || cand.dataUrl || cand.type || cand.name)) {
        return { source: 'bh', name: String(cand.name || '已设铃声'), type: cand.type || '', url: cand.url || cand.dataUrl || '' };
      }
    }
  } catch (e) {}
  try {
    var cfg = read(RING_KEY, null);
    if (cfg && typeof cfg === 'object') {
      if (cfg.type === 'url' && cfg.url && !onLine) return { source: 'default', name: '默认铃声', type: 'builtin', url: '', fallback: '链接铃声离线不可用，已回落默认铃声' };
      if (cfg.url || cfg.dataUrl) return { source: 'bh-' + (cfg.type || 'file'), name: String(cfg.name || '已设铃声'), type: cfg.type || '', url: cfg.url || cfg.dataUrl || '' };
      if (cfg.type === 'builtin' && cfg.name) return { source: 'bh-builtin', name: String(cfg.name), type: 'builtin', url: '' };
    }
  } catch (e) {}
  return { source: 'default', name: '默认铃声', type: 'builtin', url: '' };
}
function ringtoneInfo() { return resolveRingtone({}); }
function playBurstAudio(res) {
  try {
    if (res && res.url) {
      try {
        if (!ring.audio) ring.audio = new Audio();
        ring.audio.src = res.url;
        try { ring.audio.currentTime = 0; } catch (e) {}
        var pr = ring.audio.play();
        if (pr && pr.catch) pr.catch(function () {});
        return true;
      } catch (e) {}
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        if (!ring.actx) ring.actx = new AC();
        var ctx = ring.actx;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        var t0 = ctx.currentTime;
        [0, 0.28, 0.56].forEach(function (off, i) {
          var o = ctx.createOscillator(), gn = ctx.createGain();
          o.type = 'sine'; o.frequency.value = (i === 2 ? 1174.66 : 880);
          gn.gain.setValueAtTime(0.0001, t0 + off);
          gn.gain.exponentialRampToValueAtTime(0.12, t0 + off + 0.03);
          gn.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.24);
          o.connect(gn); gn.connect(ctx.destination);
          o.start(t0 + off); o.stop(t0 + off + 0.26);
        });
        return true;
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}
/* AO 的 burst() 每阵响铃调一次；接听/拒接/未接时 AO 的 stopRingTimers() 调 stopRingtone() */
function onRingBurst() {
  var res = resolveRingtone({});
  ring.playing = true; ring.bursts++; ring.source = res.source; ring.name = res.name;
  try { playBurstAudio(res); } catch (e) {}
  return true;
}
function stopRingtone() {
  ring.playing = false;
  try { if (ring.audio) ring.audio.pause(); } catch (e) {}
  try { if (ring.actx && ring.actx.suspend) ring.actx.suspend(); } catch (e) {}
  return true;
}
function ringState() { return { playing: ring.playing, bursts: ring.bursts, source: ring.source, name: ring.name }; }

/* 通话中说话：语音识别 + TTS + 模型回答；未接模型走模板并标注 */
function ttsSpeak(text, onend) {
  try {
    if (!('speechSynthesis' in window) || !window.speechSynthesis) { if (onend) setTimeout(onend, 600); return false; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1; u.pitch = 1;
    try {
      var vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      for (var i = 0; i < vs.length; i++) { if (vs[i] && vs[i].lang && vs[i].lang.indexOf('zh') === 0) { u.voice = vs[i]; break; } }
    } catch (e) {}
    u.onend = function () { if (onend) onend(); };
    u.onerror = function () { if (onend) onend(); };
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) { if (onend) setTimeout(onend, 400); return false; }
}
function modelAvailable() {
  try {
    if (!window.PhoneModel || !window.PhoneModel.isEnabledFor || !window.PhoneModel.isEnabledFor('chat')) return false;
    if (!window.PhoneModel.isConfigured || !window.PhoneModel.isConfigured()) return false;
    return !!window.PhoneModel.chatComplete;
  } catch (e) { return false; }
}
function templateReply(text) {
  var t = String(text || '');
  if (/吗|么|？|\?/.test(t)) return '这个问题我想想，晚点在微信里认真回你。';
  if (/^(好|嗯|行|可以|没问题)/.test(t)) return '好，那我记下了。';
  if (/想你|爱你/.test(t)) return '我也想你，等你回来。';
  return '嗯，我在听，你慢慢说。';
}
function setCallModeLine(mode) {
  try { var el = document.getElementById('ao-call-mode'); if (el) el.textContent = (mode === 'model' ? '通话模式：模型回答' : '通话模式：模板对话（未接模型）'); } catch (e) {}
  try { var el2 = document.getElementById('bi-out-mode'); if (el2) el2.textContent = (mode === 'model' ? '通话模式：模型回答' : '通话模式：模板对话（未接模型）'); } catch (e) {}
}
function handleCallSpeech(text) {
  text = String(text || '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  var inCall = false, outTalking = false;
  try { inCall = !!document.getElementById('ao-incall'); } catch (e) {}
  try { outTalking = (cb.phase === 'talking'); } catch (e) {}
  if (!inCall && !outTalking) return { ok: false, reason: 'no_call' };
  var lineEl = null;
  try { lineEl = document.getElementById(inCall ? 'ao-call-line' : 'bi-out-line'); } catch (e) {}
  var done = function (reply, mode) {
    if (lineEl) lineEl.textContent = reply;
    setCallModeLine(mode);
    try {
      var st = getState();
      if (st.lastCall) {
        st.lastCall.transcript = st.lastCall.transcript || [];
        st.lastCall.transcript.push({ who: 'user', text: text }, { who: 'char', text: reply, mode: mode });
        saveState(st);
      }
    } catch (e) {}
    try { ttsSpeak(reply); } catch (e) {}
    return { ok: true, mode: mode, reply: reply };
  };
  if (modelAvailable()) {
    try {
      var p = window.PhoneModel.chatComplete([{ role: 'user', content: '（电话里，用户说：' + text + '）用一句话自然地接话，不超过 40 字。' }], { maxTokens: 80 });
      if (p && p.then) {
        var settled = false;
        setTimeout(function () { if (!settled) { settled = true; done(templateReply(text), 'template'); } }, 6000);
        p.then(function (txt) {
          if (settled) return;
          settled = true;
          var r = String(txt || '').trim();
          if (!r) { done(templateReply(text), 'template'); return; }
          done(r, 'model');
        }).catch(function () { if (settled) return; settled = true; done(templateReply(text), 'template'); });
        if (lineEl) lineEl.textContent = '（正在想怎么回你…）';
        return { ok: true, mode: 'model_pending', reply: '' };
      }
    } catch (e) {}
  }
  return done(templateReply(text), 'template');
}
function dictationOk() {
  var SR = null;
  try { SR = window.SpeechRecognition || window.webkitSpeechRecognition; } catch (e) {}
  if (!SR) return false;
  var proto = '', host = '';
  try { proto = location.protocol; host = location.hostname; } catch (e) {}
  return proto === 'https:' || proto === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
function speakInCall() {
  if (!document.getElementById('ao-incall')) return { ok: false, reason: 'no_call' };
  if (!dictationOk()) {
    try { var el = document.getElementById('ao-call-line'); if (el) el.textContent = '（本机不支持语音识别，仍用模板对话；你也可以直接说话，我听着呢）'; } catch (e) {}
    return { ok: false, reason: 'no_sr' };
  }
  try {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SR();
    rec.lang = 'zh-CN'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      try {
        var t = '';
        if (ev.results && ev.results[0] && ev.results[0][0]) t = ev.results[0][0].transcript || '';
        if (t) handleCallSpeech(t);
      } catch (e) {}
    };
    rec.onerror = function () {
      try { var el2 = document.getElementById('ao-call-line'); if (el2) el2.textContent = '（没听清，再说一遍吧）'; } catch (e) {}
    };
    rec.start();
    try { var el3 = document.getElementById('ao-call-line'); if (el3) el3.textContent = '（正在听你说…）'; } catch (e) {}
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'sr_error' }; }
}

/* 未接去重 / 拒接记录 / 通话结束摘要 */
function noteMissedOnce(c) {
  if (!c) return true;
  var key = 'miss:' + String(c.startedAt || '') + '|' + String(c.reason || '');
  var st = getState();
  if (st.seen && st.seen[key]) return false;
  st.seen = st.seen || {};
  st.seen[key] = Date.now();
  st.lastMissed = { reason: c.reason, kind: c.kind, at: Date.now() };
  saveState(st);
  return true;
}
function lastMissed() { return getState().lastMissed || null; }
function noteDeclined(o) {
  o = o || {};
  var st = getState();
  st.lastDecline = { reason: o.reason || '', kind: o.kind || '', chip: o.chip || '', chipText: o.chipText || '', at: Date.now() };
  saveState(st);
  return true;
}
function lastDeclineReason() { return getState().lastDecline || null; }
function noteCallEnded(o) {
  o = o || {};
  var line = '与' + (o.name || '') + '通话' + fmtDur(o.duration) + '：' + (o.reason || '') + '（' + (o.how || '已挂断') + '）';
  var st = getState();
  st.lastSummary = line;
  st.lastCall = { name: o.name || '', reason: o.reason || '', duration: o.duration || 0, how: o.how || '已挂断', summary: o.summary || '', summaryLine: line, transcript: (st.lastCall && st.lastCall.transcript) || [], at: Date.now() };
  saveState(st);
  try {
    var logs = (window.GroupAO && window.GroupAO.loadCallLog) ? window.GroupAO.loadCallLog() : [];
    if (logs.length && logs[0] && logs[0].reason === o.reason && Math.abs((logs[0].time || 0) - Date.now()) < 10000) {
      logs[0].summaryLine = line;
      try { localStorage.setItem(CALL_LOG_KEY, JSON.stringify(logs.slice(0, 100))); } catch (e) {}
    }
  } catch (e) {}
  try {
    if (window.CharInnerLife && window.CharInnerLife.logCycle) {
      window.CharInnerLife.logCycle({
        sense: '刚和你打完电话', appraise: '通话 ' + fmtDur(o.duration) + '，原因：' + (o.reason || ''),
        decide: '把这次通话记下来', act: '通话摘要：' + line, reflect: '这通电话值得记住',
        trigger: 'bi_call_ended', memoryRef: '通话摘要：' + line
      });
    }
  } catch (e) {}
  return line;
}
function lastCallSummary() { return getState().lastSummary || ''; }

/* 回拨：超过 SLOW_ANSWER_MS 未接通自动转文字 */
var cb = { phase: 'idle', name: '', startedAt: 0, elapsedS: 0, timers: [], answerDelayMs: DEFAULT_PICKUP_MS, slowMs: SLOW_ANSWER_MS };
function cbClearTimers() {
  cb.timers.forEach(function (t) { try { clearTimeout(t); } catch (e) {} try { clearInterval(t); } catch (e) {} });
  cb.timers = [];
}
function cbRemove() { try { var el = document.getElementById('bi-outgoing'); if (el) el.remove(); } catch (e) {} }
function callback(name, opts) {
  opts = opts || {};
  if (callUiPresent()) return { ok: false, reason: 'busy' };
  name = name || (function () { try { return (window.GroupAO && window.GroupAO.charName) ? window.GroupAO.charName() : '他'; } catch (e) { return '他'; } })();
  cbClearTimers(); cbRemove();
  cb.phase = 'dialing'; cb.name = name; cb.startedAt = Date.now(); cb.elapsedS = 0;
  cb.answerDelayMs = (typeof opts.answerDelayMs === 'number') ? opts.answerDelayMs : DEFAULT_PICKUP_MS;
  cb.slowMs = (typeof opts.slowMs === 'number') ? opts.slowMs : SLOW_ANSWER_MS;
  var ov = document.createElement('div');
  ov.id = 'bi-outgoing'; ov.className = 'bi-outgoing';
  ov.innerHTML = '<div class="bi-out-card">'
    + '<div class="bi-out-av">' + esc((name || '?')[0]) + '</div>'
    + '<div class="bi-out-name">' + esc(name) + '</div>'
    + '<div class="bi-out-status" id="bi-out-status">正在呼叫…</div>'
    + '<div class="bi-out-timer" id="bi-out-timer">0秒</div>'
    + '<div class="bi-out-line" id="bi-out-line">……</div>'
    + '<div class="bi-out-mode" id="bi-out-mode">通话模式：模板对话（未接模型）</div>'
    + '<div class="bi-out-btns"><button type="button" id="bi-out-totext">转文字</button>'
    + '<button type="button" id="bi-out-hangup">挂断</button></div>'
    + '</div>';
  document.body.appendChild(ov);
  cb.timers.push(setInterval(function () {
    cb.elapsedS = Math.round((Date.now() - cb.startedAt) / 1000);
    var el = document.getElementById('bi-out-timer');
    if (el) el.textContent = fmtDur(cb.elapsedS);
  }, 1000));
  ov.querySelector('#bi-out-totext').addEventListener('click', function () { cbSwitchToText('manual'); });
  ov.querySelector('#bi-out-hangup').addEventListener('click', function () { cbEndCall(); });
  cb.timers.push(setTimeout(function () {
    if (cb.phase !== 'dialing') return;
    cb.phase = 'talking'; cb.startedAt = Date.now(); cb.elapsedS = 0;
    var s = document.getElementById('bi-out-status');
    if (s) s.textContent = '通话中';
    var l = document.getElementById('bi-out-line');
    if (l) l.textContent = '喂，是我。你回拨过来啦。';
    try { ttsSpeak('喂，是我。你回拨过来啦。'); } catch (e) {}
  }, cb.answerDelayMs));
  cb.timers.push(setTimeout(function () {
    if (cb.phase !== 'dialing') return;
    cbSwitchToText('slow_answer');
  }, cb.slowMs));
  return { ok: true, phase: 'dialing' };
}
function cbSwitchToText(how) {
  if (cb.phase === 'switched' || cb.phase === 'ended') return false;
  cb.phase = 'switched';
  cbClearTimers(); cbRemove();
  try {
    if (window.GroupAO && window.GroupAO.callToText) window.GroupAO.callToText();
    else if (window.GroupAO && window.GroupAO.pushWeChatAs) window.GroupAO.pushWeChatAs('我', '刚才回拨你没接上，我发文字说也行。');
  } catch (e) {}
  try {
    if (window.GroupAO && window.GroupAO.logCall) window.GroupAO.logCall({ id: 'bi_' + Date.now().toString(36), name: cb.name, number: cb.name, type: 'outgoing', time: Date.now(), duration: '', summary: '回拨未接通，已转文字（' + how + '）', reason: '回拨' });
  } catch (e) {}
  var st = getState();
  st.lastCallback = { name: cb.name, switched: true, how: how, at: Date.now() };
  saveState(st);
  return true;
}
function cbEndCall(how) {
  if (cb.phase === 'ended') return false;
  var dur = Math.max(0, Math.round((Date.now() - cb.startedAt) / 1000));
  var nm = cb.name;
  cb.phase = 'ended';
  cbClearTimers(); cbRemove();
  try {
    if (window.GroupAO && window.GroupAO.logCall) window.GroupAO.logCall({ id: 'bi_' + Date.now().toString(36), name: nm, number: nm, type: 'outgoing', time: Date.now(), duration: fmtDur(dur), summary: '回拨 · 通话 ' + fmtDur(dur) + ' · ' + (how || '已挂断'), reason: '回拨' });
  } catch (e) {}
  try { noteCallEnded({ name: nm, reason: '回拨', duration: dur, how: how, summary: '回拨 · 通话 ' + fmtDur(dur) }); } catch (e) {}
  return true;
}
function endCallback(how) {
  if (cb.phase === 'talking') return cbEndCall(how || '已挂断');
  if (cb.phase === 'dialing') { cb.phase = 'ended'; cbClearTimers(); cbRemove(); return true; }
  return false;
}
function callbackState() { return { phase: cb.phase, name: cb.name, elapsedS: cb.elapsedS }; }

/* 样式（本组自有；通话中“说话”按钮与回拨浮层） */
function injectCSS() {
  try {
    if (document.getElementById('groupbi-style')) return;
    var s = document.createElement('style');
    s.id = 'groupbi-style';
    s.textContent = [
      '.ao-call-speak{background:#5856D6;}',
      '.ao-call-mode{font-size:11px;color:rgba(255,255,255,.6);margin-top:6px;}',
      '.bi-outgoing{position:fixed;inset:0;z-index:99999;background:rgba(24,24,28,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;color:#fff;}',
      '.bi-out-card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px;max-width:340px;width:100%;box-sizing:border-box;}',
      '.bi-out-av{width:84px;height:84px;border-radius:50%;background:#34C759;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:600;}',
      '.bi-out-name{font-size:22px;font-weight:600;margin-top:16px;}',
      '.bi-out-status{font-size:14px;color:rgba(255,255,255,.85);margin-top:8px;}',
      '.bi-out-timer{font-size:15px;color:rgba(255,255,255,.8);margin-top:10px;}',
      '.bi-out-line{font-size:14px;line-height:1.7;margin-top:14px;min-height:44px;}',
      '.bi-out-mode{font-size:11px;color:rgba(255,255,255,.6);margin-top:6px;}',
      '.bi-out-btns{display:flex;gap:16px;margin-top:20px;}',
      '.bi-out-btns button{border:0;border-radius:999px;padding:12px 26px;font-size:15px;color:#fff;cursor:pointer;}',
      '#bi-out-totext{background:#5856D6;}',
      '#bi-out-hangup{background:#e5484d;}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}
}

var __biInit = false;
function init() {
  if (__biInit) return;
  __biInit = true;
  try { injectCSS(); } catch (e) {}
  try { setTimeout(function () { try { tick(); } catch (e) {} }, 60000); setInterval(function () { try { tick(); } catch (e) {} }, 300000); } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

return {
  MARKER: 'GROUP-BI',
  getCfg: getCfg, callsEnabled: callsEnabled, setCallsEnabled: setCallsEnabled,
  getState: getState, isNight: isNight,
  baseGate: baseGate, canCall: canCall, pickTrigger: pickTrigger, tick: tick, fire: fire,
  resolveRingtone: resolveRingtone, ringtoneInfo: ringtoneInfo,
  ringState: ringState, onRingBurst: onRingBurst, stopRingtone: stopRingtone,
  speakInCall: speakInCall, handleCallSpeech: handleCallSpeech, modelAvailable: modelAvailable,
  noteMissedOnce: noteMissedOnce, lastMissed: lastMissed,
  noteDeclined: noteDeclined, lastDeclineReason: lastDeclineReason,
  noteCallEnded: noteCallEnded, lastCallSummary: lastCallSummary,
  callback: callback, endCallback: endCallback, callbackState: callbackState,
  SLOW_ANSWER_MS: SLOW_ANSWER_MS, DEFAULT_PICKUP_MS: DEFAULT_PICKUP_MS
};
})();

