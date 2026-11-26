
/* ══════════ GROUP-BH-PHONE-IOS-RINGTONE · BH组：电话 app 仿真 iOS + 铃声可设置 ══════════
   新键（只新增，不改旧键）：phone_ringtone_v1（全局铃声+专属铃声+振动开关）、
   phone_voicemail_v1（用户自己录的留言）、phone_favorites_v1（个人收藏人名）。
   只读旧键：phone_call_log_v1（最近通话/未接来电进语音留言列表）、
   phone_manual_contacts_v1（专属铃声选人）、phone_schedule_v1（“提醒我”记一条回电日程）、
   phone_sms_v1（最近通话“短信”建会话时追加一条空会话）。
   内置铃声是 WebAudio 合成的原创短旋律，不用音频文件、不抄 iOS 原版铃声；
   本地文件上限 2MB（data URL 存本地）；链接铃声离线时自动回落默认内置铃声并提示。
   来电/通话中页是 AO 组 GroupAO 的运行时换肤：AO 的响铃计时、拒接 chips、
   温柔挂断、通话记录逻辑全部保留，只换 DOM 与绑定；AO 内部 30 秒超时走内部
   missedCall（包不到），BH 用 1 秒看门狗兜底停铃声。通话本身仍是本地模拟，
   各处都写明“模拟通话”。 */
window.GroupBH = (function () {
  var MARK = 'GROUP-BH-PHONE-IOS-RINGTONE';
  var KEY = 'phone_ringtone_v1';
  var VM_KEY = 'phone_voicemail_v1';
  var FAV_KEY = 'phone_favorites_v1';
  var LOG_KEY = 'phone_call_log_v1';
  var MAX_LOCAL_BYTES = 2 * 1024 * 1024;
  var BUILTIN = [
    { id: 'bh-morning', name: '清晨', desc: '轻快的四音上行', notes: [[523.25, 0.22], [659.25, 0.22], [783.99, 0.22], [1046.5, 0.5]] },
    { id: 'bh-dusk', name: '暮色', desc: '舒缓的三音下行', notes: [[392, 0.3], [329.63, 0.3], [261.63, 0.6]] },
    { id: 'bh-breeze', name: '微风', desc: '五声音阶拨弦', notes: [[440, 0.18], [523.25, 0.18], [587.33, 0.18], [659.25, 0.18], [880, 0.45]] },
    { id: 'bh-tide', name: '潮汐', desc: '两音往复', notes: [[493.88, 0.35], [369.99, 0.35], [493.88, 0.35], [329.63, 0.55]] }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function textOf(ov, sel, def) { try { var el = ov.querySelector(sel); if (el) return el.textContent; } catch (e) {} return def; }
  function defEntry() { return { source: 'builtin', id: 'bh-morning', name: '清晨', url: '', dataUrl: '', size: 0 }; }
  function defaults() { return { global: defEntry(), vibrate: true, perContact: {} }; }
  function load() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return d;
      var o = JSON.parse(raw) || {};
      if (o.global && typeof o.global === 'object') d.global = { source: o.global.source || 'builtin', id: o.global.id || 'bh-morning', name: o.global.name || '清晨', url: o.global.url || '', dataUrl: o.global.dataUrl || '', size: o.global.size || 0 };
      if (typeof o.vibrate === 'boolean') d.vibrate = o.vibrate;
      if (o.perContact && typeof o.perContact === 'object') d.perContact = o.perContact;
      return d;
    } catch (e) { return d; }
  }
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return { ok: true }; }
    catch (e) { return { ok: false, reason: 'quota' }; }
  }
  function builtinById(id) { for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === id) return BUILTIN[i]; return null; }
  function entryLabel(e) {
    if (!e) return '默认';
    if (e.source === 'local') return '本地音频' + (e.name ? ' · ' + e.name : '');
    if (e.source === 'link') return '链接音频';
    var b = builtinById(e.id); return (b ? b.name : (e.name || '默认')) + '（内置）';
  }
  function globalLabel() { return entryLabel(load().global); }
  function ringtoneFor(name) { var st = load(); return (name && st.perContact && st.perContact[name]) ? st.perContact[name] : st.global; }

  /* ── 铃声解析：纯函数，可单测。online 未传时读 navigator.onLine ── */
  function resolveEntry(entry, online) {
    entry = entry || defEntry();
    var on = (typeof online === 'boolean') ? online : (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true);
    if (entry.source === 'local') {
      if (entry.dataUrl) return { entry: entry, play: 'local', fallback: false, note: '' };
      return { entry: defEntry(), play: 'builtin', fallback: true, note: '本地铃声文件不见了，已回落默认铃声' };
    }
    if (entry.source === 'link') {
      if (!entry.url || !/^https?:\/\//i.test(entry.url)) return { entry: defEntry(), play: 'builtin', fallback: true, note: '链接铃声地址无效，已回落默认铃声' };
      if (!on) return { entry: defEntry(), play: 'builtin', fallback: true, note: '当前离线，链接铃声播不了，已回落默认铃声' };
      return { entry: entry, play: 'link', fallback: false, note: '' };
    }
    var b = builtinById(entry.id) || BUILTIN[0];
    return { entry: { source: 'builtin', id: b.id, name: b.name, url: '', dataUrl: '', size: 0 }, play: 'builtin', fallback: false, note: '' };
  }
  function resolveFor(name, online) { return resolveEntry(ringtoneFor(name), online); }

  /* ── 音频：WebAudio 合成内置旋律；本地/链接走 <audio> ── */
  var _ctx = null;
  function audioCtx() {
    if (_ctx) return _ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
      return _ctx;
    } catch (e) { return null; }
  }
  function playNotes(ctx, notes) {
    var t = ctx.currentTime + 0.02, total = 0;
    notes.forEach(function (nd) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = nd[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + nd[1]);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + nd[1] + 0.05);
      t += nd[1]; total += nd[1];
    });
    return total;
  }
  function playBuiltinOnce(id) {
    var ctx = audioCtx();
    if (!ctx) return { ok: false, reason: 'no-audio' };
    var b = builtinById(id) || BUILTIN[0];
    try { playNotes(ctx, b.notes); return { ok: true }; } catch (e) { return { ok: false, reason: 'play-failed' }; }
  }
  function previewEntry(entry, online) {
    var r = resolveEntry(entry, online);
    if (r.play === 'builtin') {
      var p = playBuiltinOnce(r.entry.id);
      if (!p.ok) return { ok: false, play: 'builtin', fallback: r.fallback, note: '本机没有音频输出，试听不了', reason: p.reason };
      return { ok: true, play: 'builtin', fallback: r.fallback, note: r.note || '正在试听…' };
    }
    var url = r.play === 'local' ? r.entry.dataUrl : r.entry.url;
    var a = null;
    try { a = new Audio(url); } catch (e) { return { ok: false, play: r.play, fallback: true, note: '铃声音频建不出来，已回落默认铃声', reason: 'no-audio' }; }
    try {
      a.onerror = function () {};
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
      setTimeout(function () { try { a.pause(); } catch (e) {} }, 3000);
    } catch (e) { return { ok: false, play: r.play, fallback: true, note: '铃声播不出来，已回落默认铃声', reason: 'play-failed' }; }
    return { ok: true, play: r.play, fallback: r.fallback, note: r.note || '正在试听…' };
  }
  var _ring = null;
  function stopRingtone() {
    try {
      if (_ring) {
        if (_ring.audio) { try { _ring.audio.pause(); } catch (e) {} try { _ring.audio.src = ''; } catch (e) {} }
        if (_ring.timer) clearTimeout(_ring.timer);
      }
    } catch (e) {}
    _ring = null;
  }
  function startBuiltinLoop(id) {
    var ctx = audioCtx();
    if (!ctx) return false;
    var b = builtinById(id) || BUILTIN[0];
    _ring = { kind: 'builtin', timer: null };
    var cycle = function () {
      if (!_ring || _ring.kind !== 'builtin') return;
      var dur = 0;
      try { dur = playNotes(ctx, b.notes); } catch (e) {}
      _ring.timer = setTimeout(cycle, Math.round(dur * 1000) + 500);
    };
    cycle();
    return true;
  }
  function playRingtoneFor(name) {
    stopRingtone();
    var r = resolveFor(name);
    if (r.play === 'builtin') {
      if (!startBuiltinLoop(r.entry.id)) return { ok: false, play: 'builtin', fallback: r.fallback, note: '本机没有音频输出，铃声响不了', reason: 'no-audio' };
      return { ok: true, play: 'builtin', fallback: r.fallback, note: r.note };
    }
    var url = r.play === 'local' ? r.entry.dataUrl : r.entry.url;
    var a = null;
    try { a = new Audio(url); } catch (e) { return { ok: false, play: r.play, fallback: true, note: '铃声音频建不出来，已回落默认铃声', reason: 'no-audio' }; }
    _ring = { kind: r.play, audio: a };
    try { a.loop = true; } catch (e) {}
    a.onerror = function () { try { stopRingtone(); } catch (e) {} startBuiltinLoop(BUILTIN[0].id); };
    try {
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { return { ok: false, play: r.play, fallback: true, note: '铃声播不出来，已回落默认铃声', reason: 'play-failed' }; }
    return { ok: true, play: r.play, fallback: r.fallback, note: r.note };
  }
  var DTMF = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477] };
  function dtmf(digit) {
    var ctx = audioCtx();
    if (!ctx || !DTMF[digit]) return false;
    try {
      var t = ctx.currentTime + 0.01;
      DTMF[digit].forEach(function (f) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.12);
      });
      return true;
    } catch (e) { return false; }
  }

  /* ── 振动开关门：只在来电响铃期间、且开关关时，把 navigator.vibrate 换成空操作；通话结束恢复 ── */
  var _vibOrig = null;
  function gateVibrate(block) {
    try {
      if (!navigator || typeof navigator.vibrate !== 'function') return;
      if (block) { if (!_vibOrig) { _vibOrig = navigator.vibrate.bind(navigator); navigator.vibrate = function () { return false; }; } }
      else if (_vibOrig) { navigator.vibrate = _vibOrig; _vibOrig = null; }
    } catch (e) {}
  }
  function toast(msg) {
    try {
      var d = document.createElement('div');
      d.textContent = msg;
      d.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:100001;background:rgba(28,28,30,.92);color:#fff;font-size:13px;padding:10px 16px;border-radius:999px;max-width:82vw;text-align:center;pointer-events:none;';
      document.body.appendChild(d);
      setTimeout(function () { try { d.remove(); } catch (e) {} }, 2600);
    } catch (e) {}
  }

  /* ── 写入：全局 / 专属 / 振动 / 本地文件 ── */
  function setGlobal(entry) { var st = load(); st.global = entry; return save(st); }
  function setPerContact(name, entry) {
    if (!name) return { ok: false, reason: 'empty-name' };
    var st = load(); st.perContact[name] = entry; return save(st);
  }
  function removePerContact(name) { var st = load(); delete st.perContact[name]; return save(st); }
  function setVibrate(on) { var st = load(); st.vibrate = !!on; return save(st); }
  function readAudioFile(file, cb) {
    if (!file) { cb({ ok: false, reason: 'empty' }); return; }
    if (file.size > MAX_LOCAL_BYTES) { cb({ ok: false, reason: 'too-big' }); return; }
    try {
      var fr = new FileReader();
      fr.onload = function () { cb({ ok: true, name: file.name || '本地音频', size: file.size, dataUrl: String(fr.result || '') }); };
      fr.onerror = function () { cb({ ok: false, reason: 'read-failed' }); };
      fr.readAsDataURL(file);
    } catch (e) { cb({ ok: false, reason: 'read-failed' }); }
  }

  /* ── 联系人名：char + 通话记录 + 手动联系人（只读） ── */
  function charName() { try { if (window.GroupAO && window.GroupAO.charName) return window.GroupAO.charName(); } catch (e) {} return 'TA'; }
  function contactNames() {
    var names = [];
    var push = function (n) { n = String(n || '').trim(); if (n && names.indexOf(n) === -1) names.push(n); };
    try { push(charName()); } catch (e) {}
    try { var logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); if (Array.isArray(logs)) logs.forEach(function (l) { push(l.name); }); } catch (e) {}
    try { var mans = JSON.parse(localStorage.getItem('phone_manual_contacts_v1') || '[]'); if (Array.isArray(mans)) mans.forEach(function (c) { push(c.name); }); } catch (e) {}
    return names;
  }

  /* ── 语音留言：用户录音 + 未接来电（诚实标“未留语音”，不编 char 的留言） ── */
  function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); if (sec < 60) return sec + '秒'; return Math.floor(sec / 60) + '分' + (sec % 60) + '秒'; }
  function loadVM() { try { var a = JSON.parse(localStorage.getItem(VM_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function listVoicemail() {
    var out = loadVM().map(function (v) { return { id: v.id, from: v.from || '我的录音', time: v.time || 0, label: '我的录音', dur: v.dur || '', audio: v.audio || '', kind: 'rec' }; });
    try {
      var logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      if (Array.isArray(logs)) logs.forEach(function (l) { if (l && l.type === 'missed') out.push({ id: 'missed_' + (l.id || l.time), from: l.name || '未知', time: l.time || 0, label: '未接来电 · 未留语音', dur: '', audio: '', kind: 'missed' }); });
    } catch (e) {}
    out.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    return out.slice(0, 50);
  }
  function saveVoicemail(dataUrl, durSec) {
    if (!dataUrl || dataUrl.length > Math.round(MAX_LOCAL_BYTES * 4 / 3) + 64) return { ok: false, reason: 'too-big' };
    var a = loadVM();
    a.unshift({ id: 'vm_' + Date.now().toString(36), from: '我的录音', time: Date.now(), dur: fmtDur(durSec), audio: dataUrl });
    try { localStorage.setItem(VM_KEY, JSON.stringify(a.slice(0, 20))); return { ok: true }; } catch (e) { return { ok: false, reason: 'quota' }; }
  }
  function deleteVoicemail(id) {
    if (!id || id.indexOf('vm_') !== 0) return { ok: false, reason: 'missed' };
    var a = loadVM().filter(function (v) { return v.id !== id; });
    try { localStorage.setItem(VM_KEY, JSON.stringify(a)); return { ok: true }; } catch (e) { return { ok: false, reason: 'quota' }; }
  }
  var _vmAudio = null, _vmPlayingId = null;
  function playVoicemail(id) {
    var item = null;
    listVoicemail().forEach(function (v) { if (v.id === id) item = v; });
    if (!item || !item.audio) return { ok: false, reason: 'no-audio' };
    try {
      if (_vmAudio && _vmPlayingId === id) { try { _vmAudio.pause(); } catch (e) {} _vmAudio = null; _vmPlayingId = null; return { ok: true, playing: false }; }
      if (_vmAudio) { try { _vmAudio.pause(); } catch (e) {} }
      var a = new Audio(item.audio);
      _vmAudio = a; _vmPlayingId = id;
      a.onended = function () { _vmAudio = null; _vmPlayingId = null; };
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      return { ok: true, playing: true };
    } catch (e) { return { ok: false, reason: 'play-failed' }; }
  }
  var _rec = null, _recChunks = [], _recStart = 0;
  function isRecording() { return !!_rec; }
  function startRecording(cb) {
    if (_rec) { if (cb) cb({ ok: false, reason: 'busy' }); return; }
    var done = function (st) { if (cb) cb(st); };
    try {
      if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { done({ ok: false, reason: 'no-recorder' }); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        try {
          _recChunks = []; _recStart = Date.now();
          _rec = new MediaRecorder(stream);
          _rec.ondataavailable = function (e) { if (e.data && e.data.size) _recChunks.push(e.data); };
          _rec.onstop = function () {
            try { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
            var blob = new Blob(_recChunks, { type: _rec.mimeType || 'audio/webm' });
            _rec = null;
            var fr = new FileReader();
            fr.onload = function () { var r = saveVoicemail(String(fr.result || ''), (Date.now() - _recStart) / 1000); done(r.ok ? { ok: true } : { ok: false, reason: r.reason }); };
            fr.onerror = function () { done({ ok: false, reason: 'read-failed' }); };
            fr.readAsDataURL(blob);
          };
          _rec.start();
          done({ ok: true, started: true });
        } catch (e) { _rec = null; done({ ok: false, reason: 'no-recorder' }); }
      }).catch(function () { done({ ok: false, reason: 'denied' }); });
    } catch (e) { done({ ok: false, reason: 'no-recorder' }); }
  }
  function stopRecording() { try { if (_rec && _rec.state !== 'inactive') _rec.stop(); } catch (e) {} }

  /* ── 个人收藏 ── */
  function loadFav() { try { var a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function listFavorites() { return loadFav(); }
  function isFavorite(name) { return loadFav().indexOf(name) !== -1; }
  function toggleFavorite(name) {
    if (!name) return { fav: false };
    var a = loadFav(), i = a.indexOf(name);
    if (i === -1) a.push(name); else a.splice(i, 1);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch (e) {}
    return { fav: i === -1 };
  }

  /* ── 设置子页：电话铃声 ── */
  var _pendingLocal = null, _pendingPcLocal = null;
  function renderSettingsSub() {
    var st = load();
    var g = st.global;
    var sizeKB = 0;
    try { sizeKB = Math.round((localStorage.getItem(KEY) || '').length / 1024); } catch (e) {}
    var builtinRows = BUILTIN.map(function (b) {
      var sel = (g.source === 'builtin' && g.id === b.id);
      return '<div class="st-row"><span class="st-label">' + esc(b.name) + ' · ' + esc(b.desc) + (sel ? ' ✓' : '') + '</span><div class="st-row-right">'
        + '<button type="button" data-bh="pv-builtin" data-id="' + b.id + '" style="padding:7px 12px;border:1px solid #e5e5ea;border-radius:16px;background:#fff;font-size:13px;margin-right:6px;">试听</button>'
        + '<button type="button" data-bh="set-builtin" data-id="' + b.id + '" style="padding:7px 12px;border:0;border-radius:16px;background:#007AFF;color:#fff;font-size:13px;">' + (sel ? '当前铃声' : '设为铃声') + '</button>'
        + '</div></div>';
    }).join('');
    var pcNames = contactNames();
    Object.keys(st.perContact || {}).forEach(function (n) { if (pcNames.indexOf(n) === -1) pcNames.push(n); });
    var pcOptions = pcNames.length ? pcNames.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') : '<option value="">（还没有联系人）</option>';
    var pcBuiltinOptions = BUILTIN.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    var pcList = Object.keys(st.perContact || {}).map(function (n) {
      return '<div class="st-row"><span class="st-label">' + esc(n) + ' · ' + esc(entryLabel(st.perContact[n])) + '</span><div class="st-row-right"><button type="button" data-bh="del-pc" data-name="' + esc(n) + '" style="padding:7px 12px;border:1px solid #f3c8c8;border-radius:16px;background:#fff;color:#d33;font-size:13px;">删除</button></div></div>';
    }).join('') || '<div class="st-foot">还没有专属铃声。</div>';
    return '<div class="st-sub" id="st-sub-bhRingtone">'
      + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1"><svg viewBox="0 0 24 24" width="22" fill="none" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>设置</div><div class="st-sub-title">电话铃声</div></div>'
      + '<div class="st-bigtitle" style="padding-top:4px;">电话铃声</div>'
      + '<div class="st-foot">当前全局铃声：' + esc(globalLabel()) + '。通话是本地模拟，来电响铃用这里的铃声。</div>'
      + '<div class="st-group">' + builtinRows + '</div>'
      + '<div class="st-group">'
      + '<div class="st-row"><span class="st-label">本地音频（上传文件作铃声）</span><div class="st-row-right"><label style="padding:7px 12px;border:1px solid #e5e5ea;border-radius:16px;background:#fff;font-size:13px;cursor:pointer;">选择文件<input id="bh-local-file" type="file" accept="audio/*" style="display:none;"></label></div></div>'
      + '<div class="st-row"><span class="st-label">' + (_pendingLocal ? esc(_pendingLocal.name) + ' · ' + Math.round(_pendingLocal.size / 1024) + ' KB' : '还没选文件') + '</span><div class="st-row-right">'
      + '<button type="button" data-bh="pv-local" style="padding:7px 12px;border:1px solid #e5e5ea;border-radius:16px;background:#fff;font-size:13px;margin-right:6px;">试听</button>'
      + '<button type="button" data-bh="set-local" style="padding:7px 12px;border:0;border-radius:16px;background:#007AFF;color:#fff;font-size:13px;">设为全局铃声</button>'
      + '</div></div>'
      + '<div class="st-foot">本地文件存在本机（data URL），上限 2MB；超过会提示，不保存。</div>'
      + '</div>'
      + '<div class="st-group">'
      + '<div class="st-row"><span class="st-label">音频链接</span><div class="st-row-right"><input id="bh-link-url" type="url" placeholder="https://…" value="' + esc(g.source === 'link' ? g.url : '') + '" style="width:170px;font-size:14px;padding:7px 9px;border:1px solid #e5e5ea;border-radius:8px;"></div></div>'
      + '<div class="st-row"><span class="st-label">联网时播链接，离线自动回落默认铃声</span><div class="st-row-right">'
      + '<button type="button" data-bh="pv-link" style="padding:7px 12px;border:1px solid #e5e5ea;border-radius:16px;background:#fff;font-size:13px;margin-right:6px;">试听</button>'
      + '<button type="button" data-bh="set-link" style="padding:7px 12px;border:0;border-radius:16px;background:#007AFF;color:#fff;font-size:13px;">设为全局铃声</button>'
      + '</div></div>'
      + '</div>'
      + '<div class="st-group">'
      + '<div class="st-row"><span class="st-label">专属铃声 · 联系人</span><div class="st-row-right"><select id="bh-pc-name" style="font-size:14px;padding:7px 8px;border:1px solid #e5e5ea;border-radius:8px;">' + pcOptions + '</select></div></div>'
      + '<div class="st-row"><span class="st-label">来源</span><div class="st-row-right"><select id="bh-pc-source" style="font-size:14px;padding:7px 8px;border:1px solid #e5e5ea;border-radius:8px;"><option value="builtin">内置铃声</option><option value="local">本地音频</option><option value="link">音频链接</option></select></div></div>'
      + '<div id="bh-pc-input"><div class="st-row"><span class="st-label">内置铃声</span><div class="st-row-right"><select id="bh-pc-builtin" style="font-size:14px;padding:7px 8px;border:1px solid #e5e5ea;border-radius:8px;">' + pcBuiltinOptions + '</select></div></div></div>'
      + '<div class="st-row"><span class="st-label">给这个人单独设铃声</span><div class="st-row-right"><button type="button" data-bh="save-pc" style="padding:7px 12px;border:0;border-radius:16px;background:#007AFF;color:#fff;font-size:13px;">保存专属铃声</button></div></div>'
      + pcList
      + '</div>'
      + '<div class="st-group"><div class="st-row"><span class="st-label">来电振动</span><div class="st-row-right"><div class="bh-switch' + (st.vibrate ? ' on' : '') + '" data-bh="vibrate"><div class="bh-knob"></div></div></div></div></div>'
      + '<div class="st-foot" id="bh-tip"></div>'
      + '<div class="st-foot" id="bh-backup-note">当前铃声设置约 ' + sizeKB + ' KB。本地音频随整屋备份一起导出；超过约 1MB 时导出会先提示，不会静默丢掉。</div>'
      + '<div class="st-foot">内置铃声是本机合成的原创短旋律，没有音频文件；通话本身是模拟通话，不会真的拨出。</div>'
      + '</div>';
  }
  function refreshSub(sub) {
    try {
      var tmp = document.createElement('div');
      tmp.innerHTML = renderSettingsSub();
      var nu = tmp.firstElementChild;
      if (!nu) return;
      sub.replaceWith(nu);
      bindSettingsSub(nu);
    } catch (e) {}
  }
  function bindSettingsSub(sub) {
    if (!sub) return;
    var tip = sub.querySelector('#bh-tip');
    var say = function (t) { if (tip) tip.textContent = t || ''; };
    var sayPreview = function (r) { say(r.note || (r.ok ? '正在试听…' : '试听失败：本机没有音频输出')); };
    sub.querySelectorAll('[data-bh="pv-builtin"]').forEach(function (b) {
      b.addEventListener('click', function () { sayPreview(previewEntry({ source: 'builtin', id: b.getAttribute('data-id') })); });
    });
    sub.querySelectorAll('[data-bh="set-builtin"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id'), bb = builtinById(id) || BUILTIN[0];
        var r = setGlobal({ source: 'builtin', id: bb.id, name: bb.name, url: '', dataUrl: '', size: 0 });
        if (r.ok) { say('已设为全局铃声：' + bb.name + '（内置）'); refreshSub(sub); } else say('保存失败：本机存储已满');
      });
    });
    var fileInput = sub.querySelector('#bh-local-file');
    if (fileInput) fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      readAudioFile(f, function (r) {
        if (!r.ok) { say(r.reason === 'too-big' ? '文件超过 2MB，未保存' : '读不到这个文件'); return; }
        _pendingLocal = r; say('已选：' + r.name + '，点“设为全局铃声”保存'); refreshSub(sub);
      });
    });
    var pvLocal = sub.querySelector('[data-bh="pv-local"]');
    if (pvLocal) pvLocal.addEventListener('click', function () {
      if (!_pendingLocal) { say('先选一个本地音频文件'); return; }
      sayPreview(previewEntry({ source: 'local', name: _pendingLocal.name, dataUrl: _pendingLocal.dataUrl }));
    });
    var setLocal = sub.querySelector('[data-bh="set-local"]');
    if (setLocal) setLocal.addEventListener('click', function () {
      if (!_pendingLocal) { say('先选一个本地音频文件'); return; }
      var r = setGlobal({ source: 'local', id: '', name: _pendingLocal.name, url: '', dataUrl: _pendingLocal.dataUrl, size: _pendingLocal.size });
      if (r.ok) { say('已设为全局铃声：本地音频 · ' + _pendingLocal.name); _pendingLocal = null; refreshSub(sub); } else say('保存失败：本机存储已满，本地音频没存进去');
    });
    var linkInput = sub.querySelector('#bh-link-url');
    var pvLink = sub.querySelector('[data-bh="pv-link"]');
    if (pvLink) pvLink.addEventListener('click', function () {
      var url = linkInput ? linkInput.value.trim() : '';
      sayPreview(previewEntry({ source: 'link', url: url }));
    });
    var setLink = sub.querySelector('[data-bh="set-link"]');
    if (setLink) setLink.addEventListener('click', function () {
      var url = linkInput ? linkInput.value.trim() : '';
      if (!/^https?:\/\//i.test(url)) { say('链接无效：请填 http(s) 开头的音频链接'); return; }
      var r = setGlobal({ source: 'link', id: '', name: '', url: url, dataUrl: '', size: 0 });
      if (r.ok) { say('已设为全局铃声：链接音频（离线时自动回落默认铃声）'); refreshSub(sub); } else say('保存失败：本机存储已满');
    });
    var pcSource = sub.querySelector('#bh-pc-source');
    var pcInput = sub.querySelector('#bh-pc-input');
    var pcBuiltinOptions = BUILTIN.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    var renderPcInput = function () {
      if (!pcSource || !pcInput) return;
      var v = pcSource.value;
      if (v === 'local') pcInput.innerHTML = '<div class="st-row"><span class="st-label">本地音频</span><div class="st-row-right"><label style="padding:7px 12px;border:1px solid #e5e5ea;border-radius:16px;background:#fff;font-size:13px;cursor:pointer;">选择文件<input id="bh-pc-file" type="file" accept="audio/*" style="display:none;"></label></div></div>';
      else if (v === 'link') pcInput.innerHTML = '<div class="st-row"><span class="st-label">音频链接</span><div class="st-row-right"><input id="bh-pc-url" type="url" placeholder="https://…" style="width:170px;font-size:14px;padding:7px 9px;border:1px solid #e5e5ea;border-radius:8px;"></div></div>';
      else pcInput.innerHTML = '<div class="st-row"><span class="st-label">内置铃声</span><div class="st-row-right"><select id="bh-pc-builtin" style="font-size:14px;padding:7px 8px;border:1px solid #e5e5ea;border-radius:8px;">' + pcBuiltinOptions + '</select></div></div>';
      var pf = pcInput.querySelector('#bh-pc-file');
      if (pf) pf.addEventListener('change', function () {
        readAudioFile(pf.files && pf.files[0], function (r) {
          if (!r.ok) { say(r.reason === 'too-big' ? '文件超过 2MB，未保存' : '读不到这个文件'); return; }
          _pendingPcLocal = r; say('已选：' + r.name);
        });
      });
    };
    if (pcSource) pcSource.addEventListener('change', renderPcInput);
    var savePc = sub.querySelector('[data-bh="save-pc"]');
    if (savePc) savePc.addEventListener('click', function () {
      var nameSel = sub.querySelector('#bh-pc-name');
      var name = nameSel ? nameSel.value : '';
      if (!name) { say('先选一个联系人（还没有联系人时，去微信加好友或在电话里手动添加）'); return; }
      var src = pcSource ? pcSource.value : 'builtin';
      var entry = null;
      if (src === 'builtin') {
        var bs = sub.querySelector('#bh-pc-builtin');
        var bb = builtinById(bs ? bs.value : '') || BUILTIN[0];
        entry = { source: 'builtin', id: bb.id, name: bb.name, url: '', dataUrl: '', size: 0 };
      } else if (src === 'local') {
        if (!_pendingPcLocal) { say('先选一个本地音频文件'); return; }
        entry = { source: 'local', id: '', name: _pendingPcLocal.name, url: '', dataUrl: _pendingPcLocal.dataUrl, size: _pendingPcLocal.size };
      } else {
        var u = sub.querySelector('#bh-pc-url');
        var url = u ? u.value.trim() : '';
        if (!/^https?:\/\//i.test(url)) { say('链接无效：请填 http(s) 开头的音频链接'); return; }
        entry = { source: 'link', id: '', name: '', url: url, dataUrl: '', size: 0 };
      }
      var r = setPerContact(name, entry);
      if (r.ok) { say('已给 ' + name + ' 设专属铃声：' + entryLabel(entry)); _pendingPcLocal = null; refreshSub(sub); } else say('保存失败：本机存储已满');
    });
    sub.querySelectorAll('[data-bh="del-pc"]').forEach(function (b) {
      b.addEventListener('click', function () { removePerContact(b.getAttribute('data-name')); refreshSub(sub); });
    });
    var vsw = sub.querySelector('[data-bh="vibrate"]');
    if (vsw) vsw.addEventListener('click', function () {
      var st = load(); st.vibrate = !st.vibrate;
      var r = save(st);
      if (r.ok) { vsw.classList.toggle('on', st.vibrate); say(st.vibrate ? '来电振动已开' : '来电振动已关'); } else say('保存失败：本机存储已满');
    });
  }

  /* ── “提醒我”：拒接 + 记一条 1 小时后回电的日程 ── */
  function remindMe(name) {
    try {
      var now = new Date();
      var later = new Date(now.getTime() + 3600 * 1000);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem('phone_schedule_v1') || '[]'); } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push({ id: 'bh_' + Date.now().toString(36), title: '回电：' + name, date: later.getFullYear() + '-' + pad(later.getMonth() + 1) + '-' + pad(later.getDate()), time: pad(later.getHours()) + ':' + pad(later.getMinutes()), note: '来电时点了“提醒我”', done: false, createdAt: Date.now(), priority: 'normal' });
      localStorage.setItem('phone_schedule_v1', JSON.stringify(arr));
      toast('已记到日程：1 小时后回电给' + name);
    } catch (e) { toast('提醒没记上：日程读不到'); }
  }

  /* ── 来电页换肤（iOS 样式）── */
  function bindSlider(ov, onAnswer) {
    var thumb = ov.querySelector('#bh-slide-thumb');
    var track = ov.querySelector('#bh-slide');
    if (!thumb || !track) return;
    var startX = 0, dx = 0, dragging = false, done = false;
    var maxDx = function () { try { return Math.max(80, track.clientWidth - 64); } catch (e) { return 160; } };
    var setX = function (x) { thumb.style.transform = 'translateX(' + x + 'px)'; };
    var alive = function () { try { return document.getElementById('bh-slide-thumb') === thumb; } catch (e) { return false; } };
    var down = function (x) { if (done) return; dragging = true; startX = x; dx = 0; };
    var move = function (x) { if (!dragging || done || !alive()) return; dx = Math.max(0, Math.min(maxDx(), x - startX)); setX(dx); };
    var up = function () { if (!dragging) return; dragging = false; if (!alive()) return; if (dx >= maxDx() * 0.7) { done = true; onAnswer(); } else { setX(0); dx = 0; } };
    thumb.addEventListener('pointerdown', function (e) { down(e.clientX); });
    thumb.addEventListener('mousedown', function (e) { down(e.clientX); });
    thumb.addEventListener('touchstart', function (e) { if (e.touches && e.touches[0]) down(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('pointermove', function (e) { move(e.clientX); });
    document.addEventListener('mousemove', function (e) { move(e.clientX); });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('pointerup', up);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchend', up);
  }
  function reskinIncoming() {
    var ov = document.getElementById('ao-incoming');
    if (!ov) return false;
    if (ov.dataset.bhSkinned === '1') return true;
    var name = textOf(ov, '.ao-inc-name', charName());
    var reason = textOf(ov, '.ao-inc-reason', '').replace(/^📞\s*/, '');
    ov.dataset.bhSkinned = '1';
    var first = (name || '?').charAt(0);
    ov.innerHTML = '<div class="bh-inc">'
      + '<div class="bh-inc-top">'
      + '<div class="bh-inc-av ao-ringing" id="ao-inc-av">' + esc(first) + '</div>'
      + '<div class="bh-inc-name">' + esc(name) + '</div>'
      + '<div class="bh-inc-sub">语音通话邀请</div>'
      + '<div class="bh-inc-sim">本机模拟来电</div>'
      + '</div>'
      + '<div class="bh-inc-bottom">'
      + '<div class="bh-inc-quick"><button type="button" class="bh-quick" id="bh-inc-remind">提醒我</button><button type="button" class="bh-quick" id="bh-inc-msg">信息</button></div>'
      + '<div class="bh-slide" id="bh-slide"><div class="bh-slide-hint">滑动来接听</div><div class="bh-slide-thumb" id="bh-slide-thumb">☎</div></div>'
      + '<div class="bh-inc-btns"><button type="button" class="bh-inc-decline" id="ao-inc-decline" aria-label="拒绝">✕</button><button type="button" class="bh-inc-answer" id="ao-inc-answer" aria-label="接听">☎</button></div>'
      + '<div class="ao-inc-chips" id="ao-inc-chips" style="display:none;">'
      + '<button type="button" data-chip="busy">忙，晚点回你</button>'
      + '<button type="button" data-chip="out">在外面，晚点回你</button>'
      + '<button type="button" data-chip="text">改发文字吧</button></div>'
      + '</div></div>';
    var AO = window.GroupAO;
    var ans = ov.querySelector('#ao-inc-answer');
    if (ans) ans.addEventListener('click', function () { try { AO.answerCall(); } catch (e) {} });
    var dec = ov.querySelector('#ao-inc-decline');
    if (dec) dec.addEventListener('click', function () { try { AO.declineCall('busy', '不方便接听'); } catch (e) {} });
    var chipsBox = ov.querySelector('#ao-inc-chips');
    if (chipsBox) chipsBox.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-chip]') : null; if (!b) return; try { AO.declineCall(b.getAttribute('data-chip'), b.textContent); } catch (err) {} });
    var remind = ov.querySelector('#bh-inc-remind');
    if (remind) remind.addEventListener('click', function () { remindMe(name); try { AO.declineCall('busy', '忙，晚点回你'); } catch (e) {} });
    var msg = ov.querySelector('#bh-inc-msg');
    if (msg) msg.addEventListener('click', function () { try { AO.declineCall('text', '改发文字吧'); } catch (e) {} try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('wechat'); } catch (e) {} });
    bindSlider(ov, function () { try { AO.answerCall(); } catch (e) {} });
    return true;
  }

  /* ── 通话中页换肤（iOS 六宫格）── */
  var _icMuted = false, _icSpeaker = false, _icDial = '';
  function reskinInCall() {
    var ov = document.getElementById('ao-incall');
    if (!ov) return false;
    if (ov.dataset.bhSkinned === '1') return true;
    var name = textOf(ov, '.ao-inc-name', charName());
    var reason = textOf(ov, '.ao-inc-reason', '');
    var timerTxt = textOf(ov, '#ao-call-timer', '0秒');
    var lineTxt = textOf(ov, '#ao-call-line', '……');
    ov.dataset.bhSkinned = '1';
    var first = (name || '?').charAt(0);
    var keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    ov.innerHTML = '<div class="bh-inc">'
      + '<div class="bh-inc-top">'
      + '<div class="bh-inc-av">' + esc(first) + '</div>'
      + '<div class="bh-inc-name">' + esc(name) + '</div>'
      + '<div class="bh-inc-sub" id="ao-call-timer">' + esc(timerTxt) + '</div>'
      + '<div class="bh-inc-sim">模拟通话 · 对方是机内模拟</div>'
      + '<div class="bh-call-line" id="ao-call-line">' + esc(lineTxt) + '</div>'
      + '</div>'
      + '<div class="bh-inc-bottom">'
      + '<div class="bh-call-note" id="bh-ic-note"></div>'
      + '<div class="bh-ic-keys" id="bh-ic-keys" style="display:none;"><div class="bh-ic-dial" id="bh-ic-dial"></div><div class="bh-ic-keypad">'
      + keys.map(function (k) { return '<button type="button" class="bh-ic-key" data-ickey="' + k[0] + '">' + k[0] + (k[1] ? '<small>' + k[1] + '</small>' : '') + '</button>'; }).join('')
      + '</div></div>'
      + '<div class="bh-grid">'
      + '<button type="button" class="bh-grid-btn" data-ic="mute"><span class="bh-grid-ic">🔇</span>静音</button>'
      + '<button type="button" class="bh-grid-btn" data-ic="speaker"><span class="bh-grid-ic">🔊</span>免提</button>'
      + '<button type="button" class="bh-grid-btn" data-ic="keypad"><span class="bh-grid-ic">▦</span>拨号键盘</button>'
      + '<button type="button" class="bh-grid-btn" data-ic="add"><span class="bh-grid-ic">＋</span>添加通话</button>'
      + '<button type="button" class="bh-grid-btn" data-ic="ft"><span class="bh-grid-ic">📹</span>FaceTime</button>'
      + '<button type="button" class="bh-grid-btn" data-ic="contacts"><span class="bh-grid-ic">👤</span>通讯录</button>'
      + '</div>'
      + '<button type="button" class="bh-end" id="ao-call-hangup" aria-label="结束通话"><span class="bh-end-ic">☎</span></button>'
      + '<button type="button" class="bh-ic-interrupt" id="ao-call-interrupt">打断（只停语音，不丢台词）</button>'
      + '<div class="bh-call-grace" id="ao-call-grace" style="display:none;">说完再见，多留 <span id="ao-call-grace-n">18</span> 秒…<button type="button" id="ao-call-cancel-grace">取消挂断</button></div>'
      + '</div></div>';
    var AO = window.GroupAO;
    var note = ov.querySelector('#bh-ic-note');
    var sayNote = function (t) { if (note) note.textContent = t || ''; };
    ov.querySelectorAll('[data-ic]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-ic');
        if (k === 'mute') { _icMuted = !_icMuted; b.classList.toggle('on', _icMuted); sayNote(_icMuted ? '已静音（模拟通话）' : ''); }
        else if (k === 'speaker') { _icSpeaker = !_icSpeaker; b.classList.toggle('on', _icSpeaker); sayNote(_icSpeaker ? '免提已开（模拟通话）' : ''); }
        else if (k === 'keypad') { var ks = ov.querySelector('#bh-ic-keys'); if (ks) { var show = ks.style.display === 'none'; ks.style.display = show ? 'block' : 'none'; b.classList.toggle('on', show); } }
        else if (k === 'add') sayNote('模拟通话不支持添加通话');
        else if (k === 'ft') sayNote('模拟通话不支持 FaceTime');
        else if (k === 'contacts') sayNote('通话中查看通讯录暂不支持（模拟通话）');
      });
    });
    ov.querySelectorAll('[data-ickey]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-ickey');
        _icDial += d;
        try { dtmf(d); } catch (e) {}
        var el = ov.querySelector('#bh-ic-dial');
        if (el) el.textContent = '已拨：' + _icDial;
      });
    });
    var hang = ov.querySelector('#ao-call-hangup');
    if (hang) hang.addEventListener('click', function () { try { AO.gentleHangup(); } catch (e) {} });
    var intr = ov.querySelector('#ao-call-interrupt');
    if (intr) intr.addEventListener('click', function () { try { AO.interruptCall(); } catch (e) {} });
    var cancel = ov.querySelector('#ao-call-cancel-grace');
    if (cancel) cancel.addEventListener('click', function () { try { AO.cancelGrace(); } catch (e) {} });
    return true;
  }

  /* ── AO 包装 + 看门狗（AO 内部 30 秒超时走内部 missedCall，包不到，看门狗兜底停铃声）──
     注意：AO 的 testIncomingCall / maybeCharCall 调的是 IIFE 内部 showIncoming，
     不是导出的 GroupAO.showIncoming，所以只包导出方法会漏主入口：三层兜底——
     (1) 包 GroupAO.showIncoming；(2) 包导出的 testIncomingCall / maybeCharCall；
     (3) MutationObserver 看 #ao-incoming / #ao-incall 出现就换肤（防重复标记 bhSkinned）。 */
  var _wrapped = false, _watch = null;
  function stopWatch() { try { if (_watch) clearInterval(_watch); } catch (e) {} _watch = null; }
  function startWatch() {
    stopWatch();
    _watch = setInterval(function () {
      try {
        var inc = document.getElementById('ao-incoming');
        var cal = document.getElementById('ao-incall');
        if (!inc && !cal) { stopRingtone(); gateVibrate(false); stopWatch(); }
        else if (cal) { stopRingtone(); gateVibrate(false); }
      } catch (e) {}
    }, 1000);
  }
  function afterIncomingShown(name) {
    try { gateVibrate(!load().vibrate); } catch (e) {}
    try { reskinIncoming(); } catch (e) {}
    var st = null;
    try { st = playRingtoneFor(name || charName()); } catch (e) {}
    if (st && st.fallback && st.note) toast(st.note);
    startWatch();
  }
  function watchOverlays() {
    try {
      if (!window.MutationObserver || !document.body) return;
      var ob = new MutationObserver(function () {
        try {
          var inc = document.getElementById('ao-incoming');
          if (inc && inc.dataset.bhSkinned !== '1') afterIncomingShown(charName());
          var cal = document.getElementById('ao-incall');
          if (cal && cal.dataset.bhSkinned !== '1') {
            try { stopRingtone(); gateVibrate(false); } catch (e) {}
            _icMuted = false; _icSpeaker = false; _icDial = '';
            try { reskinInCall(); } catch (e) {}
          }
        } catch (e) {}
      });
      ob.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  function wrapAO() {
    if (_wrapped) return true;
    var AO = window.GroupAO;
    if (!AO || typeof AO.showIncoming !== 'function') return false;
    var _show = AO.showIncoming, _answer = AO.answerCall, _decline = AO.declineCall, _missed = AO.missedCall, _end = AO.endCall;
    var _test = AO.testIncomingCall, _maybe = AO.maybeCharCall;
    AO.showIncoming = function (o) {
      var ok = false;
      try { ok = _show.call(AO, o); } catch (e) { return false; }
      if (ok) afterIncomingShown((o && o.name) || charName());
      return ok;
    };
    if (typeof _test === 'function') AO.testIncomingCall = function (kind) {
      var ok = false;
      try { ok = _test.call(AO, kind); } catch (e) { return false; }
      if (ok) afterIncomingShown(charName());
      return ok;
    };
    if (typeof _maybe === 'function') AO.maybeCharCall = function () {
      try { _maybe.call(AO); } catch (e) {}
      try { if (document.getElementById('ao-incoming')) afterIncomingShown(charName()); } catch (e) {}
    };
    AO.answerCall = function () {
      var r;
      try { r = _answer.call(AO); } catch (e) { return; }
      try { stopRingtone(); gateVibrate(false); stopWatch(); } catch (e) {}
      _icMuted = false; _icSpeaker = false; _icDial = '';
      try { reskinInCall(); } catch (e) {}
      return r;
    };
    AO.declineCall = function (k, t) { var r; try { r = _decline.call(AO, k, t); } catch (e) {} try { stopRingtone(); gateVibrate(false); stopWatch(); } catch (e) {} return r; };
    AO.missedCall = function () { var r; try { r = _missed.call(AO); } catch (e) {} try { stopRingtone(); gateVibrate(false); stopWatch(); } catch (e) {} return r; };
    AO.endCall = function (h) { var r; try { r = _end.call(AO, h); } catch (e) {} try { stopRingtone(); gateVibrate(false); stopWatch(); } catch (e) {} return r; };
    _wrapped = true;
    return true;
  }

  /* ── 样式 ── */
  function injectCSS() {
    if (document.getElementById('bh-style')) return;
    var s = document.createElement('style');
    s.id = 'bh-style';
    s.textContent = [
      '.ao-incoming .bh-inc,.ao-incall .bh-inc{width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:52px 24px 44px;box-sizing:border-box;color:#fff;text-align:center;}',
      '.bh-inc-top{display:flex;flex-direction:column;align-items:center;width:100%;}',
      '.bh-inc-av{width:96px;height:96px;border-radius:50%;background:#34C759;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:600;color:#fff;flex-shrink:0;}',
      '.bh-inc-name{font-size:30px;font-weight:600;margin-top:18px;}',
      '.bh-inc-sub{font-size:14px;color:rgba(255,255,255,.75);margin-top:6px;}',
      '.bh-inc-reason{font-size:14px;color:rgba(255,255,255,.92);margin-top:12px;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 14px;max-width:320px;line-height:1.5;}',
      '.bh-inc-sim{font-size:11px;color:rgba(255,255,255,.55);margin-top:10px;}',
      '.bh-inc-bottom{width:100%;max-width:340px;display:flex;flex-direction:column;align-items:center;gap:18px;}',
      '.bh-inc-quick{display:flex;justify-content:space-between;width:100%;}',
      '.bh-quick{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:999px;padding:9px 18px;font-size:14px;cursor:pointer;}',
      '.bh-slide{position:relative;width:100%;height:56px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.bh-slide-hint{font-size:15px;color:rgba(255,255,255,.85);}',
      '.bh-slide-thumb{position:absolute;left:4px;top:4px;width:48px;height:48px;border-radius:50%;background:#34C759;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:grab;touch-action:none;}',
      '.bh-inc-btns{display:flex;gap:56px;}',
      '.bh-inc-decline,.bh-inc-answer{width:72px;height:72px;border-radius:50%;border:0;color:#fff;font-size:28px;cursor:pointer;}',
      '.bh-inc-decline{background:#FF3B30;}',
      '.bh-inc-answer{background:#34C759;}',
      '.bh-call-line{font-size:14px;line-height:1.7;color:#fff;margin-top:14px;min-height:44px;max-width:320px;}',
      '.bh-call-note{font-size:13px;color:#ffd9a0;min-height:18px;}',
      '.bh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;width:100%;max-width:300px;}',
      '.bh-grid-btn{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:16px;padding:12px 4px;font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;}',
      '.bh-grid-btn.on{background:rgba(255,255,255,.85);color:#1C1C1E;}',
      '.bh-grid-ic{font-size:22px;}',
      '.bh-end{width:72px;height:72px;border-radius:50%;border:0;background:#FF3B30;color:#fff;cursor:pointer;}',
      '.bh-end-ic{font-size:28px;display:inline-block;transform:rotate(135deg);}',
      '.bh-ic-interrupt{border:0;background:transparent;color:rgba(255,255,255,.65);font-size:12px;cursor:pointer;padding:6px;}',
      '.bh-call-grace{font-size:13px;color:#ffd9a0;}',
      '.bh-call-grace button{border:1px solid #ffd9a0;background:transparent;color:#ffd9a0;border-radius:999px;padding:6px 14px;font-size:13px;margin-left:8px;cursor:pointer;}',
      '.bh-ic-keys{width:100%;max-width:300px;}',
      '.bh-ic-dial{font-size:15px;color:rgba(255,255,255,.85);min-height:20px;text-align:center;}',
      '.bh-ic-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;}',
      '.bh-ic-key{height:52px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:20px;cursor:pointer;}',
      '.bh-ic-key small{display:block;font-size:8px;opacity:.6;letter-spacing:1px;}',
      '.bh-tabbar{position:sticky;bottom:0;z-index:5;display:flex;background:rgba(255,253,251,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:0.5px solid #ece7e2;padding:8px 2px 10px;margin:20px -16px -30px;}',
      '.bh-tab{flex:1;text-align:center;font-size:11px;color:#8E8E93;cursor:pointer;padding:2px 0;}',
      '.bh-tab.on{color:#007AFF;font-weight:600;}',
      '.bh-tab-ic{display:block;font-size:20px;margin-bottom:2px;}',
      '.gd-root .gd-keypad{gap:14px;max-width:320px;}',
      '.gd-root .gd-key{height:72px;background:#fff;border:1px solid #e5e5ea;font-size:28px;}',
      '.gd-root .gd-key small{font-size:10px;color:#8E8E93;}',
      '.bh-dial-actions{display:flex;align-items:center;justify-content:center;gap:24px;max-width:300px;margin:18px auto 0;position:relative;}',
      '.bh-call-btn{width:72px;height:72px;border-radius:50%;border:0;background:#34C759;color:#fff;font-size:30px;cursor:pointer;}',
      '.bh-del-btn{position:absolute;right:8px;border:0;background:transparent;font-size:24px;color:#1C1C1E;cursor:pointer;padding:8px;}',
      '.bh-incall{position:fixed;inset:0;z-index:50;background:linear-gradient(180deg,#3a3a3c,#1C1C1E);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:52px 24px 44px;text-align:center;color:#fff;box-sizing:border-box;}',
      '.bh-incall-av{width:96px;height:96px;border-radius:50%;background:#8E8E93;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:600;color:#fff;}',
      '.bh-incall-name{font-size:28px;font-weight:600;margin-top:16px;}',
      '.bh-incall-num{font-size:14px;color:rgba(255,255,255,.75);margin-top:4px;}',
      '.bh-incall-status{font-size:15px;color:rgba(255,255,255,.85);margin-top:10px;}',
      '.bh-incall-sim{font-size:11px;color:rgba(255,255,255,.55);margin-top:10px;}',
      '.bh-mini-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:300px;margin:12px auto 0;}',
      '.bh-mini-key{height:52px;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0;}',
      '.bh-inkeypad-display{font-size:14px;color:rgba(255,255,255,.85);min-height:20px;margin-top:8px;}',
      '.bh-switch{width:51px;height:31px;border-radius:999px;background:#E5E5EA;position:relative;cursor:pointer;flex-shrink:0;}',
      '.bh-switch.on{background:#34C759;}',
      '.bh-knob{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2);}',
      '.bh-switch.on .bh-knob{transform:translateX(20px);}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function init() {
    try { injectCSS(); } catch (e) {}
    try { wrapAO(); } catch (e) {}
    try { watchOverlays(); } catch (e) {}
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { wrapAO(); } catch (e) {} try { watchOverlays(); } catch (e) {} });
  }
  init();

  return {
    MARK: MARK, KEY: KEY, VM_KEY: VM_KEY, FAV_KEY: FAV_KEY, BUILTIN: BUILTIN,
    load: load, save: save, globalLabel: globalLabel, entryLabel: entryLabel,
    ringtoneFor: ringtoneFor, resolveEntry: resolveEntry, resolveFor: resolveFor,
    previewEntry: previewEntry, playRingtoneFor: playRingtoneFor, stopRingtone: stopRingtone,
    dtmf: dtmf, setGlobal: setGlobal, setPerContact: setPerContact,
    removePerContact: removePerContact, setVibrate: setVibrate, readAudioFile: readAudioFile,
    contactNames: contactNames, charName: charName,
    listVoicemail: listVoicemail, saveVoicemail: saveVoicemail, deleteVoicemail: deleteVoicemail,
    playVoicemail: playVoicemail, startRecording: startRecording, stopRecording: stopRecording,
    isRecording: isRecording, listFavorites: listFavorites, isFavorite: isFavorite,
    toggleFavorite: toggleFavorite, renderSettingsSub: renderSettingsSub,
    bindSettingsSub: bindSettingsSub, reskinIncoming: reskinIncoming,
    reskinInCall: reskinInCall, toast: toast,
    _debug: { wrapped: function () { return _wrapped; }, ring: function () { return _ring ? _ring.kind : null; } }
  };
})();
