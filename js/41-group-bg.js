
/* GROUP-BG · 相机与麦克风调用做实（自写，未抄第三方代码）
   规则：只在用户点按时请求权限；每次请求前先说明为什么需要；拒绝后记 bg_perm_v1，
   不再自动反复弹窗，只留“重新请求权限”入口；照片/录音只存本机，不上传；
   file:// 下直接诚实说明，不静默失败。 */
(function () {
  var MARK = 'GROUP-BG';
  var PERM_KEY = 'bg_perm_v1';
  var MEMO_KEY = 'bg_voice_memos_v1';
  var MAX_PHOTO_PX = 1280;
  var MAX_MEMOS = 10;
  var CAM_DENIED_TEXT = '未获得相机权限，请在浏览器设置里允许';
  var MIC_DENIED_TEXT = '未获得麦克风权限，请在浏览器设置里允许';
  var FILE_TEXT = '当前打开方式不支持调用相机/麦克风，请用 localhost 或打包后的 APK 打开';
  var INSECURE_TEXT = '当前页面不是安全上下文，浏览器不允许调用相机/麦克风，请用 https、localhost 或打包后的 APK 打开';

  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(msg) {
    try {
      if (window.WeChatAppEngine && typeof WeChatAppEngine.triggerToast === 'function') { WeChatAppEngine.triggerToast(msg); return; }
    } catch (e) {}
    try {
      var d = document.createElement('div');
      d.className = 'bg-toast';
      d.textContent = msg;
      document.body.appendChild(d);
      setTimeout(function () { try { d.remove(); } catch (e) {} }, 3000);
    } catch (e) {}
  }
  function readPerm() { try { var o = JSON.parse(localStorage.getItem(PERM_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
  function writePerm(o) { try { localStorage.setItem(PERM_KEY, JSON.stringify(o || {})); } catch (e) {} }
  function noteDenied(kind) { var p = readPerm(); p[kind] = 'denied'; writePerm(p); }
  function clearDenied(kind) { var p = readPerm(); if (p[kind]) { delete p[kind]; writePerm(p); } }
  function isDenied(kind) { return readPerm()[kind] === 'denied'; }
  function secureOk() {
    var proto = '';
    try { proto = location.protocol; } catch (e) {}
    if (proto === 'file:') return { ok: false, reason: 'file', text: FILE_TEXT };
    try { if (window.isSecureContext === false) return { ok: false, reason: 'insecure', text: INSECURE_TEXT }; } catch (e) {}
    return { ok: true, reason: '', text: '' };
  }
  function srAvailable() { try { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); } catch (e) { return false; } }
  function closeEl(id) { var el = document.getElementById(id); if (el) { try { el.remove(); } catch (e) {} } }

  /* ── 权限被拒后的底部选择页：重新请求权限 / 替代入口 / 取消（唯一关闭键在页内） ── */
  function showPermSheet(kind, opts) {
    opts = opts || {};
    closeEl('bg-perm-sheet');
    var isCam = kind === 'camera';
    var sh = document.createElement('div');
    sh.id = 'bg-perm-sheet';
    sh.innerHTML = '<div class="bg-sheet">'
      + '<div class="bg-sheet-title">' + (isCam ? '相机权限' : '麦克风权限') + '</div>'
      + '<div class="bg-sheet-body">' + (isCam ? CAM_DENIED_TEXT : MIC_DENIED_TEXT) + '。'
      + (isCam ? '拍照只在你点按时请求，照片只存本机，不上传。' : '录音只在你点按/按住时请求，录音只存本机，不上传。')
      + '拒绝后不会反复弹窗，需要时可在这里重新请求。</div>'
      + '<div class="bg-sheet-row"><button type="button" class="bg-btn bg-btn-pri" id="bg-perm-retry">重新请求权限</button>'
      + '<button type="button" class="bg-btn" id="bg-perm-alt">' + (isCam ? '改用文件上传' : '改用打字') + '</button>'
      + '<button type="button" class="bg-btn" id="bg-perm-close">取消</button></div></div>';
    document.body.appendChild(sh);
    sh.querySelector('#bg-perm-close').onclick = function () { closeEl('bg-perm-sheet'); };
    sh.querySelector('#bg-perm-alt').onclick = function () {
      closeEl('bg-perm-sheet');
      if (isCam) {
        if (opts.fallbackInputId) { var inp = document.getElementById(opts.fallbackInputId); if (inp) inp.click(); }
        else if (opts.onFileFallback) opts.onFileFallback();
        else toast('请用各功能里的文件上传入口选一张照片');
      } else {
        var input = document.getElementById('wx-msg-input');
        if (input) { try { input.focus(); } catch (e) {} }
        toast('已切换为打字输入');
      }
    };
    sh.querySelector('#bg-perm-retry').onclick = function () {
      closeEl('bg-perm-sheet');
      clearDenied(kind);
      if (isCam) openCamera(Object.assign({}, opts, { retry: true }));
      else if (opts.onRetryMic) opts.onRetryMic();
      else toast('请再次点按录音按钮重试');
    };
  }

  /* ── 相机：取景浮层（前后切换 / 拍照 / 文件上传替代） ── */
  var _cam = null;
  function stopCamStream() {
    if (_cam && _cam.stream) { try { _cam.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {} }
    _cam = null;
  }
  function capturePhoto(video) {
    try {
      var w = video.videoWidth || 0, h = video.videoHeight || 0;
      if (!w || !h) return null; /* 画面还没准备好：不拍黑图，诚实失败 */
      var scale = Math.min(1, MAX_PHOTO_PX / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      if (ctx) { try { ctx.drawImage(video, 0, 0, cw, ch); } catch (e) {} }
      var url = '';
      try { url = canvas.toDataURL('image/jpeg', 0.82); } catch (e) {}
      if (!url || url.length < 100) return null;
      if (url.length > 1500000) { try { var url2 = canvas.toDataURL('image/jpeg', 0.6); if (url2 && url2.length >= 100) url = url2; } catch (e) {} }
      return url;
    } catch (e) { return null; }
  }
  function openCamera(opts) {
    opts = opts || {};
    var sec = secureOk();
    if (!sec.ok) { toast(sec.text); if (opts.onUnavailable) opts.onUnavailable(sec); return { ok: false, reason: sec.reason }; }
    if (isDenied('camera') && !opts.retry) { showPermSheet('camera', opts); return { ok: false, reason: 'denied-before' }; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('当前浏览器不支持调用相机，请改用文件上传');
      if (opts.onUnavailable) opts.onUnavailable({ reason: 'unsupported' });
      return { ok: false, reason: 'unsupported' };
    }
    closeEl('bg-cam-overlay');
    var ov = document.createElement('div');
    ov.id = 'bg-cam-overlay';
    ov.innerHTML = '<div class="bg-cam-box">'
      + '<div class="bg-cam-title"><span>' + escHtml(opts.title || '拍照') + '</span><button type="button" class="bg-cam-x" id="bg-cam-close">✕</button></div>'
      + '<video id="bg-cam-video" autoplay playsinline muted></video>'
      + '<div class="bg-cam-why">' + escHtml(opts.why || '拍照需要使用相机，照片只存本机，不上传。') + '</div>'
      + '<div class="bg-cam-row"><button type="button" class="bg-btn" id="bg-cam-switch">切换前后摄像头</button></div>'
      + '<div class="bg-cam-row"><button type="button" class="bg-btn bg-btn-pri" id="bg-cam-shoot">拍照</button>'
      + '<button type="button" class="bg-btn" id="bg-cam-file">改用文件上传</button></div>'
      + '<div class="bg-cam-err" id="bg-cam-err"></div></div>';
    document.body.appendChild(ov);
    var video = ov.querySelector('#bg-cam-video');
    var errEl = ov.querySelector('#bg-cam-err');
    var facing = opts.facing || 'environment';
    var closed = false;
    function close() { if (closed) return; closed = true; stopCamStream(); closeEl('bg-cam-overlay'); }
    ov.querySelector('#bg-cam-close').onclick = close;
    ov.querySelector('#bg-cam-file').onclick = function () {
      close();
      if (opts.fallbackInputId) { var inp = document.getElementById(opts.fallbackInputId); if (inp) inp.click(); }
      else if (opts.onFileFallback) opts.onFileFallback();
      else toast('请用各功能里的文件上传入口选一张照片');
    };
    function startStream() {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } }).then(function (stream) {
        if (closed) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return null; }
        _cam = { stream: stream, facing: facing, opts: opts };
        try { video.srcObject = stream; } catch (e) {}
        try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        return stream;
      });
    }
    function fail(err) {
      var name = (err && err.name) || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        noteDenied('camera'); close(); showPermSheet('camera', opts);
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
        if (errEl) errEl.textContent = '这台设备没有可用的摄像头，请改用文件上传。';
      } else {
        if (errEl) errEl.textContent = '无法打开相机：' + ((err && err.message) || '未知错误');
      }
    }
    ov.querySelector('#bg-cam-switch').onclick = function () {
      facing = (facing === 'environment') ? 'user' : 'environment';
      stopCamStream(); startStream().catch(fail);
    };
    ov.querySelector('#bg-cam-shoot').onclick = function () {
      var url = capturePhoto(video);
      if (!url) { if (errEl) errEl.textContent = '拍照失败，请重试'; return; }
      close();
      try { if (opts.onPhoto) opts.onPhoto(url); } catch (e) {}
    };
    startStream().catch(fail);
    return { ok: true };
  }

  function dataUrlToFile(dataUrl, name) {
    try {
      var parts = dataUrl.split(',');
      var mime = 'image/jpeg';
      var m = parts[0].match(/data:([^;]+)/);
      if (m) mime = m[1];
      var bin = atob(parts[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var blob = new Blob([arr], { type: mime });
      try { return new File([blob], name || 'photo.jpg', { type: mime }); } catch (e) { return blob; }
    } catch (e) { return null; }
  }
  /* 拍照后把照片写进已有的 file input，走该入口原有的上传流程 */
  function fillInputFromCamera(target) {
    var input = null;
    try { input = (target.charAt(0) === '.' || target.charAt(0) === '#') ? document.querySelector(target) : document.getElementById(target); } catch (e) {}
    if (!input) { toast('找不到上传入口'); return; }
    openCamera({
      title: '拍照上传', why: '拍照需要使用相机，拍到的照片会走原来的上传流程，只存本机。',
      fallbackInputId: (target.charAt(0) === '#') ? target.slice(1) : null,
      onPhoto: function (url) {
        var file = dataUrlToFile(url, 'camera-photo.jpg');
        if (!file) { toast('照片处理失败，请改用文件上传'); return; }
        try {
          var wrote = false;
          if (typeof DataTransfer !== 'undefined') {
            try {
              var dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              wrote = true;
            } catch (e) { wrote = false; }
          }
          if (!wrote) {
            /* 无 DataTransfer 的环境（如老 WebView）：直接定义 files 再派发 change */
            try { Object.defineProperty(input, 'files', { value: [file], configurable: true }); wrote = true; } catch (e2) { wrote = false; }
          }
          if (!wrote) { toast('当前浏览器不支持直接写入文件选择框，请改用文件上传'); input.click(); return; }
          var ev;
          try { ev = new Event('change', { bubbles: true }); } catch (e2) { ev = document.createEvent('Event'); ev.initEvent('change', true, true); }
          input.dispatchEvent(ev);
        } catch (e) { toast('照片写入失败，请改用文件上传'); }
      }
    });
  }

  /* ── 聊天图片消息（与 handleImgUpload 单张路径同字段） ── */
  function currentChatSession() {
    try {
      var store = AppRegistry['wechat'] && AppRegistry['wechat'].wxStore;
      if (!store) return null;
      return store.sessions.find(function (s) { return s.id === store.currentChatId; }) || null;
    } catch (e) { return null; }
  }
  function sendChatImage(url, afterText) {
    var sess = currentChatSession();
    if (!sess) { toast('请先打开一个聊天'); return false; }
    sess.messages.push({ id: 'img_' + Date.now(), sender: '我', type: 'image', url: url, time: '刚刚' });
    sess.preview = '[图片]'; sess.lastTime = '刚刚';
    if (!sess.events) sess.events = [];
    sess.events.push({ type: 'image', url: url, time: Date.now(), consumed: false });
    if (afterText) sess.messages.push({ id: 'txt_' + Date.now(), sender: '我', type: 'text', content: afterText, time: '刚刚' });
    try { if (window.WeChatAppEngine && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates(); } catch (e) {}
    try { if (window.GroupP && GroupP.onPhotoSent) GroupP.onPhotoSent(url); } catch (e) {}
    return true;
  }
  function chatCamera() {
    openCamera({
      title: '拍照发给 TA', why: '拍照需要使用相机，照片会作为图片消息发进当前聊天，只存本机。',
      fallbackInputId: 'wx-camera-upload',
      onPhoto: function (url) { sendChatImage(url); }
    });
  }

  /* ── “我”页头像：选择页（拍照 / 从相册选），不改原有文件上传流程 ── */
  function meAvatarCamera() {
    openCamera({
      title: '拍照换头像', why: '拍照需要使用相机，拍到的照片会设为你的微信头像，只存本机。',
      onPhoto: function (url) {
        try { var img = document.getElementById('wx-me-avatar-img'); if (img) img.src = url; } catch (e) {}
        try { if (typeof SystemStore !== 'undefined') SystemStore.set('wx-user-avatar', url); } catch (e) {}
        toast('头像更新完毕');
      }
    });
  }
  function avatarSheet() {
    closeEl('bg-avatar-sheet');
    var sh = document.createElement('div');
    sh.id = 'bg-avatar-sheet';
    sh.innerHTML = '<div class="bg-sheet"><div class="bg-sheet-title">更换头像</div>'
      + '<div class="bg-sheet-row"><button type="button" class="bg-btn bg-btn-pri" id="bg-av-cam">拍照</button>'
      + '<button type="button" class="bg-btn" id="bg-av-file">从相册选</button>'
      + '<button type="button" class="bg-btn" id="bg-av-close">取消</button></div></div>';
    document.body.appendChild(sh);
    sh.querySelector('#bg-av-close').onclick = function () { closeEl('bg-avatar-sheet'); };
    sh.querySelector('#bg-av-file').onclick = function () { closeEl('bg-avatar-sheet'); try { if (window.WeChatAppEngine) WeChatAppEngine.changeMeAvatar(); } catch (e) {} };
    sh.querySelector('#bg-av-cam').onclick = function () { closeEl('bg-avatar-sheet'); meAvatarCamera(); };
  }

  /* ── 自拍相机（实拍）：复用已有场景模板，只作标签说明；明确标注是实拍 ── */
  function selfieCamera() {
    var scene = 'coffee', label = '自拍';
    try { if (typeof pickSelfieScene === 'function') scene = pickSelfieScene(); } catch (e) {}
    try { if (typeof SELFIE_SCENES !== 'undefined' && SELFIE_SCENES[scene]) label = SELFIE_SCENES[scene].label; } catch (e) {}
    openCamera({
      title: '实拍自拍 · ' + label, why: '用真相机拍一张实拍照片发进聊天（不是 char 的示意自拍），照片只存本机。',
      facing: 'user',
      onPhoto: function (url) { sendChatImage(url, '📷 实拍 · ' + label + '（真机拍摄，不是示意自拍）'); }
    });
  }

  /* ── 麦克风：MediaRecorder 录音（返回控制器；promise 在停表时结算） ── */
  function pickMime() {
    var cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg', ''];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c === '' || (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c))) return c;
    }
    return '';
  }
  function recordVoice(opts) {
    opts = opts || {};
    var maxSec = opts.maxSec || 60;
    var ctrl = { stopped: false, stop: function () {}, promise: null };
    ctrl.promise = new Promise(function (resolve) {
      var sec = secureOk();
      if (!sec.ok) { toast(sec.text); resolve({ ok: false, reason: sec.reason, text: sec.text }); return; }
      if (isDenied('mic') && !opts.retry) {
        showPermSheet('mic', { onRetryMic: opts.onRetryMic });
        resolve({ ok: false, reason: 'denied-before' });
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        toast('当前浏览器不支持录音');
        resolve({ ok: false, reason: 'unsupported' });
        return;
      }
      toast(opts.why || '需要麦克风权限来录音，录音只存本机，不上传。');
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var mime = pickMime();
        var rec;
        try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
        catch (e) {
          try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
          resolve({ ok: false, reason: 'recorder-failed' });
          return;
        }
        var chunks = []; var startTs = Date.now(); var done = false; var wasCancelled = false;
        var timer = setInterval(function () { if (Date.now() - startTs >= maxSec * 1000) finish(false); }, 250);
        var tickTimer = null;
        if (opts.onTick) { tickTimer = setInterval(function () { try { opts.onTick(Math.floor((Date.now() - startTs) / 1000)); } catch (e) {} }, 250); }
        function finish(cancelled) {
          if (done) return; done = true; wasCancelled = !!cancelled;
          clearInterval(timer); if (tickTimer) clearInterval(tickTimer);
          try { rec.stop(); } catch (e) {}
          try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        }
        ctrl.stop = function (cancelled) { finish(!!cancelled); };
        rec.ondataavailable = function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
        rec.onstop = function () {
          if (wasCancelled) { resolve({ ok: false, reason: 'cancelled' }); return; }
          var dur = Math.max(1, Math.round((Date.now() - startTs) / 1000));
          if (!chunks.length) { resolve({ ok: false, reason: 'too-short', text: '录音太短' }); return; }
          var blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
          var reader = new FileReader();
          reader.onload = function (ev) { resolve({ ok: true, audioSrc: ev.target.result, duration: dur, mime: blob.type }); };
          reader.onerror = function () { resolve({ ok: false, reason: 'read-failed' }); };
          reader.readAsDataURL(blob);
        };
        try { rec.start(); } catch (e) { finish(false); resolve({ ok: false, reason: 'start-failed' }); }
      }).catch(function (err) {
        var name = (err && err.name) || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          noteDenied('mic');
          showPermSheet('mic', { onRetryMic: opts.onRetryMic });
          resolve({ ok: false, reason: 'denied', text: MIC_DENIED_TEXT });
        } else if (name === 'NotFoundError') { toast('这台设备没有可用的麦克风'); resolve({ ok: false, reason: 'no-mic' }); }
        else { toast('无法打开麦克风：' + ((err && err.message) || '未知错误')); resolve({ ok: false, reason: 'failed' }); }
      });
    });
    return ctrl;
  }

  /* ── 语音备忘（备忘录里的入口）：录音 / 回放 / 删除，只存本机 ── */
  function loadMemos() { try { var a = JSON.parse(localStorage.getItem(MEMO_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveMemos(a) { try { localStorage.setItem(MEMO_KEY, JSON.stringify(a)); } catch (e) { toast('本地空间不足，语音备忘没存上'); } }
  function openVoiceMemos() {
    closeEl('bg-memo-overlay');
    var ov = document.createElement('div');
    ov.id = 'bg-memo-overlay';
    ov.innerHTML = '<div class="bg-sheet bg-memo-sheet"><div class="bg-sheet-title"><span>语音备忘</span><button type="button" class="bg-cam-x" id="bg-memo-close">✕</button></div>'
      + '<div class="bg-sheet-body">点按才请求麦克风；录音只存本机，不上传。最多保存 ' + MAX_MEMOS + ' 条。</div>'
      + '<div id="bg-memo-list"></div>'
      + '<div class="bg-sheet-row"><button type="button" class="bg-btn bg-btn-pri" id="bg-memo-rec">● 录一段</button><span id="bg-memo-rec-state" style="font-size:12px;color:#888;"></span></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#bg-memo-close').onclick = function () { closeEl('bg-memo-overlay'); };
    function renderList() {
      var list = loadMemos();
      var box = ov.querySelector('#bg-memo-list');
      if (!list.length) { box.innerHTML = '<div class="bg-sheet-body">还没有语音备忘。</div>'; return; }
      box.innerHTML = list.map(function (m) {
        return '<div class="bg-memo-item"><div style="flex:1;min-width:0;"><div style="font-size:13px;">' + escHtml(m.title || '语音备忘') + ' · ' + (m.duration || 0) + '″</div>'
          + '<audio controls preload="none" src="' + escHtml(m.audioSrc || '') + '" style="width:100%;margin-top:4px;"></audio></div>'
          + '<button type="button" class="bg-btn" style="flex:none;" data-bg-del="' + escHtml(m.id) + '">删除</button></div>';
      }).join('');
      box.querySelectorAll('[data-bg-del]').forEach(function (b) {
        b.onclick = function () { saveMemos(loadMemos().filter(function (m) { return m.id !== b.getAttribute('data-bg-del'); })); renderList(); };
      });
    }
    renderList();
    var recCtrl = null, recState = ov.querySelector('#bg-memo-rec-state'), recBtn = ov.querySelector('#bg-memo-rec');
    function startRec() {
      if (recCtrl) return;
      recBtn.textContent = '■ 停止并保存';
      recCtrl = recordVoice({ maxSec: 60, why: '录语音备忘需要麦克风，录音只存本机。', onRetryMic: startRec, onTick: function (s) { if (recState) recState.textContent = '录音中 ' + s + '″（最长 60″）'; } });
      recCtrl.promise.then(function (r) {
        recCtrl = null; recBtn.textContent = '● 录一段'; if (recState) recState.textContent = '';
        if (!r || !r.ok) { if (r && r.reason === 'too-short') toast('录音太短'); return; }
        var list = loadMemos();
        list.unshift({ id: 'vm_' + Date.now(), title: '语音备忘 ' + new Date().toLocaleString('zh-CN'), audioSrc: r.audioSrc, duration: r.duration, createdAt: Date.now() });
        if (list.length > MAX_MEMOS) list = list.slice(0, MAX_MEMOS);
        saveMemos(list); renderList(); toast('语音备忘已保存（只存本机）');
      });
    }
    recBtn.onclick = function () {
      if (recCtrl) { recCtrl.stop(false); return; }
      startRec();
    };
  }

  /* ── 捏声音 · 录音试听：录 8 秒，按调好的语速回放（不是训练的真人声） ── */
  function voiceSampleTest() {
    var v = { pitch: 1, rate: 1, volume: 1 };
    try { if (typeof OtomeF !== 'undefined' && OtomeF.loadVoice) v = OtomeF.loadVoice(); } catch (e) {}
    toast('正在录音，最长 8 秒，录完自动用你调好的语速回放');
    var ctrl = recordVoice({ maxSec: 8, why: '录一段你自己的声音试听：只用来当场回放，不保存、不上传。', onRetryMic: voiceSampleTest });
    ctrl.promise.then(function (r) {
      if (!r || !r.ok) { if (r && r.reason === 'too-short') toast('录音太短'); return; }
      try {
        var audio = new Audio(r.audioSrc);
        audio.playbackRate = v.rate || 1;
        try { audio.preservesPitch = false; } catch (e) {}
        audio.volume = (typeof v.volume === 'number') ? v.volume : 1;
        var p = audio.play();
        if (p && p.catch) p.catch(function () { toast('需要再点一次才能播放'); });
        toast('正在用你调好的语速回放你刚录的声音（不是训练的真人声）');
      } catch (e) { toast('回放失败'); }
    });
  }

  /* ── 微信语音通话：真实麦克风 + 实时转写显示（对方仍为机内模拟） ── */
  var _callMic = null;
  function callSub(line) {
    var subs = document.getElementById('wx-call-subtitles');
    if (!subs) return;
    var d = document.createElement('div');
    d.textContent = line;
    subs.appendChild(d);
    try { subs.scrollTop = subs.scrollHeight; } catch (e) {}
  }
  function startCallMic() {
    stopCallMic();
    var sec = secureOk();
    if (!sec.ok) { callSub('[系统]: ' + sec.text + '，通话为模拟。'); return { ok: false, reason: sec.reason }; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { callSub('[系统]: 当前浏览器不支持调用麦克风，通话为模拟。'); return { ok: false, reason: 'unsupported' }; }
    callSub('[系统]: 正在请求麦克风…说话会实时转写显示在这里。');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _callMic = { stream: stream, rec: null };
      callSub('[系统]: 麦克风已接通。');
      if (!srAvailable()) { callSub('[系统]: 当前浏览器不支持语音识别，通话为模拟。'); return; }
      try {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        var rec = new SR();
        rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
        rec.onresult = function (ev) {
          try {
            var res = ev.results;
            for (var i = 0; i < res.length; i++) {
              if (res[i].isFinal && res[i][0] && res[i][0].transcript) {
                callSub('[我]: ' + String(res[i][0].transcript).trim());
              }
            }
          } catch (e) {}
        };
        rec.onerror = function () { callSub('[系统]: 语音识别中断，通话为模拟。'); };
        rec.start();
        _callMic.rec = rec;
      } catch (e) { callSub('[系统]: 语音识别启动失败，通话为模拟。'); }
    }).catch(function (err) {
      var name = (err && err.name) || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') { noteDenied('mic'); callSub('[系统]: ' + MIC_DENIED_TEXT + '，通话为模拟。'); }
      else callSub('[系统]: 无法打开麦克风，通话为模拟。');
    });
    return { ok: true };
  }
  function stopCallMic() {
    if (!_callMic) return;
    try { if (_callMic.rec && _callMic.rec.stop) _callMic.rec.stop(); } catch (e) {}
    try { if (_callMic.stream) _callMic.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
    _callMic = null;
  }

  window.GroupBG = {
    MARK: MARK,
    secureOk: secureOk, srAvailable: srAvailable,
    camDeniedText: function () { return CAM_DENIED_TEXT; },
    micDeniedText: function () { return MIC_DENIED_TEXT; },
    fileText: function () { return FILE_TEXT; },
    noteDenied: noteDenied, clearDenied: clearDenied, isDenied: isDenied,
    showPermSheet: showPermSheet,
    openCamera: openCamera, capturePhoto: capturePhoto,
    fillInputFromCamera: fillInputFromCamera,
    chatCamera: chatCamera, meAvatarCamera: meAvatarCamera, avatarSheet: avatarSheet,
    selfieCamera: selfieCamera, albumCamera: function () { fillInputFromCamera('gd-album-file'); },
    recordVoice: recordVoice, openVoiceMemos: openVoiceMemos,
    voiceSampleTest: voiceSampleTest,
    startCallMic: startCallMic, stopCallMic: stopCallMic,
    sendChatImage: sendChatImage, loadMemos: loadMemos
  };
})();
