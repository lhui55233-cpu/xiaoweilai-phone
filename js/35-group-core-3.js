
/* GROUP-CORE · 文游/视觉小说音频（第 1 项）══════════════════════════════
   只做文游 + 视觉小说（微信语音消息是另一回事，已有录音发送，不混在一起）。
   存储：XWLDB audio_blobs（Blob，不放 localStorage；按作品/场景挂 key，
   by_work 索引；随整机备份走 STEP0 已接好的口径：10MB 预算，超了明说排除，
   本组不另写第二套备份机制）。播放：复用手机已有的 `new Audio(url)` 路径
   （铃声/语音试听同款），不另写播放器。进场景播、离场停；播放/暂停/音量。
   格式以实际解码为准；不支持/解码失败/超限都诚实提示，不假装能播、不静默截断。
   上传文件只当数据，不执行其中任何代码。离线可播（本地 Blob + object URL）。 */
(function () {
  'use strict';
  if (window.XWLAudio) return;
  var api = null;
  var MAX_FILE_BYTES = 20 * 1024 * 1024; /* 单文件上限 20MB */
  var TOTAL_BUDGET_BYTES = 200 * 1024 * 1024; /* 音频总量上限 200MB，防撑爆存储 */
  var ACCEPT_EXTS = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'opus'];
  var KIND_NAMES = { bgm: 'BGM', ambience: '环境音', sfx: '音效', voice: '语音台词' };
  var VOL_KEY = 'xwl_audio_vol_v1';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function extOf(name) { var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
  function baseName(name) { return String(name || '').replace(/\.[a-z0-9]+$/i, ''); }
  function fmtMB(n) { n = Number(n) || 0; return (n / 1048576).toFixed(n >= 10485760 ? 1 : 2) + ' MB'; }
  function fmtDur(sec) { if (typeof sec !== 'number' || isNaN(sec) || sec < 0) return '时长未知'; sec = Math.round(sec); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function uid(p) { return p + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }
  function db() { return window.XWLDB || null; }
  function metaOf(r) { if (!r) return null; return { id: r.id, workId: r.workId, kind: r.kind, name: r.name, ext: r.ext, mime: r.mime || '', size: r.size, duration: (typeof r.duration === 'number' ? r.duration : null), decoded: !!r.decoded, sceneId: r.sceneId || '', lineRef: r.lineRef || '', createdAt: r.createdAt || 0 }; }
  /* 同步查询用的内存索引（list() 刷新；未刷新前 hasTrack() 宁可报“未知”也不瞎猜） */
  var _idx = { byWork: {}, ready: {} };
  function indexPut(workId, metas) { _idx.byWork[String(workId)] = metas || []; _idx.ready[String(workId)] = true; }
  function matchTrack(m, track) { var t = String(track || ''); if (!t) return false; return baseName(m.name) === t || m.name === t || m.sceneId === t || m.id === t; }
  function hasTrack(workId, track) { var arr = _idx.byWork[String(workId)] || []; for (var i = 0; i < arr.length; i++) if (matchTrack(arr[i], track)) return true; return false; }
  function findByTrack(workId, track) { return list(workId).then(function (arr) { for (var i = 0; i < arr.length; i++) if (matchTrack(arr[i], track)) return arr[i]; return null; }); }

  /* 解码校验：有 AudioContext 就真解一次；没有就如实返回“未校验”，不编时长。 */
  function decodeCheck(file) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve({ ok: true, checked: false, duration: null });
    var bufP;
    try { bufP = file.arrayBuffer ? file.arrayBuffer() : Promise.reject(new Error('no-arrayBuffer')); }
    catch (e) { return Promise.resolve({ ok: true, checked: false, duration: null }); }
    return bufP.then(function (buf) {
      var ctx;
      try { ctx = new AC(); } catch (e) { return { ok: true, checked: false, duration: null }; }
      var p;
      try { p = ctx.decodeAudioData(buf); } catch (e) { try { if (ctx.close) ctx.close(); } catch (e2) {} return { ok: false, error: '解码失败：浏览器解不开这个文件' }; }
      return Promise.resolve(p).then(function (ab) {
        var d = (ab && typeof ab.duration === 'number') ? ab.duration : null;
        try { if (ctx.close) ctx.close(); } catch (e) {}
        return { ok: true, checked: true, duration: d };
      }, function () {
        try { if (ctx.close) ctx.close(); } catch (e) {}
        return { ok: false, error: '解码失败：浏览器解不开这个文件（可能是损坏的音频，或扩展名与实际格式不符）' };
      });
    }, function () { return { ok: true, checked: false, duration: null }; });
  }

  function upload(workId, file, opts) {
    opts = opts || {};
    return Promise.resolve().then(function () {
      if (!file) throw new Error('没有选到文件');
      if (!workId) throw new Error('先选一个作品（世界/视觉小说），再传音频');
      var ext = extOf(file.name);
      if (ACCEPT_EXTS.indexOf(ext) < 0) throw new Error('不支持的格式：' + (ext ? '.' + ext : '（没有扩展名）') + '。目前支持 ' + ACCEPT_EXTS.map(function (e) { return '.' + e; }).join(' / ') + '，以浏览器实际能解码为准');
      if (file.size > api.MAX_FILE_BYTES) throw new Error('文件太大了（' + fmtMB(file.size) + '，单文件上限 20MB），请压小一点再传，不会静默截断');
      var D = db();
      if (!D) throw new Error('音频存不下来：本机没有 IndexedDB 助手');
      return D.open().then(function (conn) {
        if (!conn) throw new Error('音频存不下来：本机没有 IndexedDB（浏览器禁用或不支持），请换个浏览器再试');
        return decodeCheck(file).then(function (chk) {
          if (!chk.ok) throw new Error(chk.error);
          return D.getAll('audio_blobs').then(function (all) {
            var total = 0; (all || []).forEach(function (r) { total += (r && r.size) || 0; });
            if (total + file.size > api.TOTAL_BUDGET_BYTES) throw new Error('音频总量快满了（已有 ' + fmtMB(total) + '，上限 ' + fmtMB(api.TOTAL_BUDGET_BYTES) + '），请先删掉一些旧音频再传');
            var rec = { id: uid('aud'), workId: String(workId), kind: KIND_NAMES[opts.kind] ? opts.kind : 'bgm', name: file.name, ext: ext, mime: file.type || '', size: file.size, duration: chk.duration, decoded: !!chk.checked, sceneId: String(opts.sceneId || ''), lineRef: String(opts.lineRef || ''), createdAt: Date.now(), blob: file };
            return D.put('audio_blobs', rec).then(function () {
              return D.get('audio_blobs', rec.id).then(function (back) {
                if (!back) throw new Error('写入失败：音频没存进本机（存储可能满了），请删掉一些旧音频再试');
                _idx.ready[String(workId)] = false;
                return metaOf(back);
              });
            });
          });
        });
      });
    });
  }

  function list(workId) {
    var D = db();
    if (!D) return Promise.resolve([]);
    return D.getAllByIndex('audio_blobs', 'by_work', String(workId)).then(function (rows) {
      var out = (rows || []).map(metaOf).filter(Boolean).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      indexPut(workId, out);
      return out;
    });
  }
  function totalBytes() {
    var D = db();
    if (!D) return Promise.resolve(0);
    return D.getAll('audio_blobs').then(function (all) { var t = 0; (all || []).forEach(function (r) { t += (r && r.size) || 0; }); return t; });
  }
  function getMeta(id) { var D = db(); if (!D) return Promise.resolve(null); return D.get('audio_blobs', id).then(metaOf); }
  function rename(id, name) {
    name = String(name || '').trim();
    if (!name) return Promise.reject(new Error('名字不能为空'));
    var D = db();
    if (!D) return Promise.reject(new Error('音频库不可用'));
    return D.get('audio_blobs', id).then(function (rec) {
      if (!rec) throw new Error('找不到这段音频（可能已被删除）');
      rec.name = name;
      return D.put('audio_blobs', rec).then(function () { _idx.ready[String(rec.workId)] = false; return metaOf(rec); });
    });
  }
  function setScene(id, sceneId) {
    var D = db();
    if (!D) return Promise.reject(new Error('音频库不可用'));
    return D.get('audio_blobs', id).then(function (rec) {
      if (!rec) throw new Error('找不到这段音频（可能已被删除）');
      rec.sceneId = String(sceneId || '');
      return D.put('audio_blobs', rec).then(function () { _idx.ready[String(rec.workId)] = false; return metaOf(rec); });
    });
  }
  function remove(id) {
    stopId(id);
    var D = db();
    if (!D) return Promise.resolve(false);
    return D.get('audio_blobs', id).then(function (rec) {
      if (!rec) return false;
      return D.delete('audio_blobs', id).then(function () { _idx.ready[String(rec.workId)] = false; return true; });
    });
  }

  /* ── 播放：手机已有的 `new Audio(url)` 路径；BGM 循环 1 个元素，单次 1 个元素 ── */
  var _els = { bgm: null, one: null };
  var _urls = { bgm: '', one: '' };
  function loadVol() { try { var v = parseFloat(localStorage.getItem(VOL_KEY)); if (!isNaN(v)) return Math.max(0, Math.min(1, v)); } catch (e) {} return 0.8; }
  var _cur = { bgmId: null, bgmName: '', bgmTrack: '', oneId: null, volume: loadVol() };
  function revoke(key) { try { if (_urls[key]) URL.revokeObjectURL(_urls[key]); } catch (e) {} _urls[key] = ''; }
  function stopKey(key) {
    var a = _els[key];
    if (a) { try { a.pause(); } catch (e) {} try { a.src = ''; } catch (e) {} }
    _els[key] = null; revoke(key);
    if (key === 'bgm') { _cur.bgmId = null; _cur.bgmName = ''; _cur.bgmTrack = ''; }
    else _cur.oneId = null;
  }
  function stopId(id) { if (_cur.bgmId === id) stopKey('bgm'); if (_cur.oneId === id) stopKey('one'); }
  function stopAll() { stopKey('bgm'); stopKey('one'); }
  function stopBgm() { stopKey('bgm'); }
  function pauseBgm() { try { if (_els.bgm) _els.bgm.pause(); } catch (e) {} }
  function resumeBgm() {
    if (!_els.bgm) return Promise.resolve({ ok: false, reason: 'no-bgm' });
    var pr;
    try { pr = _els.bgm.play(); } catch (e) { return Promise.resolve({ ok: false, reason: 'play-failed' }); }
    if (pr && pr.catch) return pr.catch(function () { return { ok: false, reason: 'play-failed' }; }).then(function () { return { ok: true }; });
    return Promise.resolve({ ok: true });
  }
  function setVolume(v) {
    v = Math.max(0, Math.min(1, Number(v)));
    if (isNaN(v)) v = 0.8;
    _cur.volume = v;
    try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) {}
    ['bgm', 'one'].forEach(function (k) { try { if (_els[k]) _els[k].volume = v; } catch (e) {} });
    return v;
  }
  function state() { return { bgmId: _cur.bgmId, bgmName: _cur.bgmName, bgmTrack: _cur.bgmTrack, oneId: _cur.oneId, playing: !!_els.bgm, volume: _cur.volume }; }
  function play(id, opts) {
    opts = opts || {};
    var D = db();
    if (!D) return Promise.reject(new Error('音频库不可用：本机没有 IndexedDB'));
    return D.get('audio_blobs', id).then(function (rec) {
      if (!rec || !rec.blob) throw new Error('找不到这段音频（可能已被删除）');
      var key = (rec.kind === 'bgm' || rec.kind === 'ambience') ? 'bgm' : 'one';
      stopKey(key);
      var url;
      try { url = URL.createObjectURL(rec.blob); } catch (e) { throw new Error('播不出来：本机建不出音频地址'); }
      var a;
      try { a = new Audio(url); } catch (e) { try { URL.revokeObjectURL(url); } catch (e2) {} throw new Error('播不出来：本机建不出播放器'); }
      try { a.loop = (key === 'bgm'); a.volume = _cur.volume; } catch (e) {}
      _els[key] = a; _urls[key] = url;
      if (key === 'bgm') { _cur.bgmId = rec.id; _cur.bgmName = rec.name; _cur.bgmTrack = opts.track || baseName(rec.name); }
      else _cur.oneId = rec.id;
      var pr;
      try { pr = a.play(); } catch (e) { stopKey(key); throw new Error('播不出来：' + (e && e.message ? String(e.message).slice(0, 60) : '浏览器拒绝播放')); }
      if (pr && pr.catch) return pr.catch(function () { stopKey(key); throw new Error('播不出来：浏览器不让自动播放，点一下播放键再试'); }).then(function () { return { ok: true, id: rec.id, name: rec.name, kind: rec.kind }; });
      return { ok: true, id: rec.id, name: rec.name, kind: rec.kind };
    });
  }
  /* 视觉小说：music 行的曲名 → 同名已传音频则播（循环 BGM），没传则如实不播。 */
  function syncVNMusic(workId, track) {
    if (!track) { if (_cur.bgmId) stopKey('bgm'); return Promise.resolve({ ok: false, reason: 'no-track' }); }
    if (_cur.bgmId && _cur.bgmTrack === String(track)) return Promise.resolve({ ok: true, already: true });
    return findByTrack(workId, track).then(function (m) {
      if (!m) return { ok: false, reason: 'not-found' };
      return play(m.id, { track: String(track) });
    });
  }
  /* 文游：进场景按地点（place）找挂了该场景的 BGM，没有则用作品默认 BGM（sceneId 为空）。 */
  function playSceneBgm(workId, place) {
    return list(workId).then(function (arr) {
      var pick = null, def = null;
      arr.forEach(function (m) {
        if (m.kind !== 'bgm') return;
        if (place && m.sceneId === String(place)) pick = pick || m;
        if (!m.sceneId) def = def || m;
      });
      var target = pick || def;
      if (!target) { if (_cur.bgmId) stopKey('bgm'); return { ok: false, reason: 'not-found' }; }
      if (_cur.bgmId === target.id) return { ok: true, already: true };
      return play(target.id, { track: target.sceneId || baseName(target.name) });
    });
  }

  /* ── 面板：作品音频列表（上传/改名/挂场景/删除/播放/暂停/音量）── */
  function ensureStyle() {
    if (document.getElementById('xwl-audio-css')) return;
    var st = document.createElement('style');
    st.id = 'xwl-audio-css';
    st.textContent = '.xwl-audio-row{display:flex;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;line-height:1.5;flex-wrap:wrap;}' +
      '.xwl-audio-row b{flex:1;min-width:90px;font-weight:600;word-break:break-all;}' +
      '.xwl-audio-row .xwl-audio-meta{color:#8a6a52;font-size:12px;}' +
      '.xwl-audio-btn{border:1px solid #d9c48a;background:#fffdf7;border-radius:8px;padding:5px 9px;font-size:12px;cursor:pointer;color:#7a4a28;}' +
      '.xwl-audio-btn.primary{background:#b08d3e;color:#fff;border-color:#b08d3e;}' +
      '.xwl-audio-btn.danger{color:#c0392b;border-color:#e5b8b0;}';
    (document.head || document.documentElement).appendChild(st);
  }
  function panelHTML(workId, title) {
    return '<div data-xwl-audio-root="1" data-xwl-work="' + esc(workId || '') + '">' +
      '<div style="display:flex;align-items:center;gap:8px;"><b style="flex:1;font-size:14px;">' + esc(title || '作品音频') + '</b>' +
      '<button type="button" class="xwl-audio-btn" data-xwl-audio-close="1">✕ 关闭</button></div>' +
      '<div style="font-size:12px;color:#8a6a52;line-height:1.7;margin-top:4px;">传给这个作品的音频存在本机（IndexedDB），离线也能播；单文件 ≤20MB，总量 ≤200MB；只收浏览器能解码的格式。</div>' +
      '<div data-xwl-audio-workrow="1"></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;">' +
      '<label class="xwl-audio-btn primary" style="cursor:pointer;">＋ 上传音频<input type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,.aac,.opus" style="display:none" data-xwl-audio-file="1"></label>' +
      '<select data-xwl-audio-kind="1" style="border:1px solid #d9c48a;border-radius:8px;padding:6px;background:#fffdf7;font-size:13px;">' +
      '<option value="bgm">BGM</option><option value="ambience">环境音</option><option value="sfx">音效</option><option value="voice">语音台词</option></select>' +
      '<input data-xwl-audio-scene="1" type="text" placeholder="挂到哪个场景（可空＝整部作品）" style="flex:1;min-width:120px;border:1px solid #d9c48a;border-radius:8px;padding:6px 8px;background:#fffdf7;font-size:13px;">' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px;"><span>音量</span>' +
      '<input data-xwl-audio-vol="1" type="range" min="0" max="100" value="' + Math.round(_cur.volume * 100) + '" style="flex:1;">' +
      '<button type="button" class="xwl-audio-btn" data-xwl-audio-stop="1">■ 停止</button></div>' +
      '<div data-xwl-audio-status="1" style="font-size:12px;color:#8a6a52;margin-top:6px;line-height:1.6;"></div>' +
      '<div data-xwl-audio-list="1" style="margin-top:4px;"><div style="font-size:13px;color:#8a6a52;">音频加载中……</div></div>' +
      '</div>';
  }
  function listRowsHTML(arr) {
    if (!arr.length) return '<div style="font-size:13px;color:#8a6a52;padding:8px 0;">这个作品还没有音频：上面选一段传进来，离线也能播。</div>';
    return arr.map(function (m) {
      return '<div class="xwl-audio-row" data-xwl-audio-id="' + esc(m.id) + '"><b>' + esc(m.name) + '</b>' +
        '<span class="xwl-audio-meta">' + esc(KIND_NAMES[m.kind] || m.kind) + (m.sceneId ? ' · 场景：' + esc(m.sceneId) : ' · 整部作品') + ' · ' + esc(fmtDur(m.duration)) + ' · ' + esc(fmtMB(m.size)) + (m.decoded ? '' : ' · 未校验解码') + '</span>' +
        '<button type="button" class="xwl-audio-btn primary" data-xwl-audio-play="' + esc(m.id) + '">▶ 播</button>' +
        '<button type="button" class="xwl-audio-btn" data-xwl-audio-rename="' + esc(m.id) + '">改名</button>' +
        '<button type="button" class="xwl-audio-btn" data-xwl-audio-scene-btn="' + esc(m.id) + '">挂场景</button>' +
        '<button type="button" class="xwl-audio-btn danger" data-xwl-audio-del="' + esc(m.id) + '">删除</button></div>';
    }).join('');
  }
  function refreshList(root) {
    var box = root.querySelector ? root.querySelector('[data-xwl-audio-list]') : null;
    var workId = root.getAttribute ? root.getAttribute('data-xwl-work') : '';
    if (!box || !workId) { if (box) box.innerHTML = '<div style="font-size:13px;color:#8a6a52;padding:8px 0;">还没有作品：先创建一个世界 / 视觉小说，再给它传音频。</div>'; return Promise.resolve([]); }
    return list(workId).then(function (arr) { box.innerHTML = listRowsHTML(arr); return arr; }, function () { box.innerHTML = '<div style="font-size:13px;color:#8a6a52;">音频列表读不出来（本机没有 IndexedDB）。</div>'; return []; });
  }
  function setStatus(root, t) { var s = root.querySelector ? root.querySelector('[data-xwl-audio-status]') : null; if (s) s.textContent = t; }
  function bindPanel(root, workId, opts) {
    if (!root || root._xwlAudioBound) return false;
    root._xwlAudioBound = true;
    opts = opts || {};
    ensureStyle();
    var workRow = root.querySelector ? root.querySelector('[data-xwl-audio-workrow]') : null;
    if (workRow && opts.worlds && opts.worlds.length) {
      workRow.innerHTML = '<label style="font-size:13px;">作品 <select data-xwl-audio-worksel="1" style="border:1px solid #d9c48a;border-radius:8px;padding:6px;background:#fffdf7;font-size:13px;max-width:100%;">' +
        opts.worlds.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === workId ? ' selected' : '') + '>' + esc(w.title) + '</option>'; }).join('') + '</select></label>';
      var sel = workRow.querySelector('[data-xwl-audio-worksel]');
      if (sel) sel.addEventListener('change', function () { root.setAttribute('data-xwl-work', sel.value); refreshList(root); });
    }
    root.addEventListener('change', function (ev) {
      var f = ev.target && ev.target.closest ? ev.target.closest('[data-xwl-audio-file]') : null;
      if (f && f.files && f.files[0]) {
        var file = f.files[0]; f.value = '';
        var kind = (root.querySelector('[data-xwl-audio-kind]') || {}).value || 'bgm';
        var scene = (root.querySelector('[data-xwl-audio-scene]') || {}).value || '';
        var wid = root.getAttribute('data-xwl-work') || '';
        setStatus(root, '正在检查并保存「' + file.name + '」……');
        upload(wid, file, { kind: kind, sceneId: scene }).then(function (m) {
          setStatus(root, '已存下「' + m.name + '」（' + fmtMB(m.size) + '，' + fmtDur(m.duration) + (m.decoded ? '' : '，未校验解码') + '）。');
          refreshList(root);
        }, function (err) { setStatus(root, '没存下来：' + (err && err.message ? err.message : '未知原因')); });
        return;
      }
      var vol = ev.target && ev.target.closest ? ev.target.closest('[data-xwl-audio-vol]') : null;
      if (vol) setVolume(Number(vol.value) / 100);
    });
    root.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-xwl-audio-close],[data-xwl-audio-stop],[data-xwl-audio-play],[data-xwl-audio-rename],[data-xwl-audio-scene-btn],[data-xwl-audio-del]') : null;
      if (!t) return;
      if (t.hasAttribute('data-xwl-audio-close')) { var ov = root.closest ? root.closest('[data-xwl-audio-overlay]') : null; if (ov && ov.parentNode) ov.parentNode.removeChild(ov); else { root.innerHTML = ''; } return; }
      if (t.hasAttribute('data-xwl-audio-stop')) { stopAll(); setStatus(root, '已停止播放。'); return; }
      var id = t.getAttribute('data-xwl-audio-play') || t.getAttribute('data-xwl-audio-rename') || t.getAttribute('data-xwl-audio-scene-btn') || t.getAttribute('data-xwl-audio-del');
      if (!id) return;
      if (t.hasAttribute('data-xwl-audio-play')) {
        play(id).then(function (r) { setStatus(root, '正在播「' + r.name + '」。'); }, function (err) { setStatus(root, '播不出来：' + (err && err.message ? err.message : '未知原因')); });
      } else if (t.hasAttribute('data-xwl-audio-rename')) {
        var cur = ''; try { var row = root.querySelector('[data-xwl-audio-id="' + id + '"] b'); cur = row ? row.textContent : ''; } catch (e) {}
        var nv = null; try { nv = window.prompt('改名（音频文件名）：', cur); } catch (e) {}
        if (nv == null) return;
        rename(id, nv).then(function () { setStatus(root, '已改名。'); refreshList(root); }, function (err) { setStatus(root, '改名失败：' + (err && err.message ? err.message : '未知原因')); });
      } else if (t.hasAttribute('data-xwl-audio-scene-btn')) {
        var sc = null; try { sc = window.prompt('挂到哪个场景？（填场景名或地点；留空 = 整部作品默认 BGM）', ''); } catch (e) {}
        if (sc == null) return;
        setScene(id, sc).then(function () { setStatus(root, '已挂到场景「' + (sc || '整部作品') + '」。'); refreshList(root); }, function (err) { setStatus(root, '挂场景失败：' + (err && err.message ? err.message : '未知原因')); });
      } else if (t.hasAttribute('data-xwl-audio-del')) {
        var ok = true; try { ok = window.confirm('确定删除这段音频吗？删了就没了（只删本机这段音频，不动作品本身）。'); } catch (e) {}
        if (!ok) return;
        remove(id).then(function () { setStatus(root, '已删除。'); refreshList(root); }, function () { setStatus(root, '删除失败。'); });
      }
    });
    refreshList(root);
    return true;
  }
  function renderInto(el, workId, opts) {
    if (!el) return false;
    ensureStyle();
    el.innerHTML = panelHTML(workId, (opts && opts.title) || '作品音频');
    var root = el.querySelector('[data-xwl-audio-root]');
    if (root) bindPanel(root, workId, opts);
    return true;
  }
  function openPanel(workId, title) {
    ensureStyle();
    var old = document.getElementById('xwl-audio-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var ov = document.createElement('div');
    ov.id = 'xwl-audio-overlay';
    ov.setAttribute('data-xwl-audio-overlay', '1');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div style="width:100%;max-width:480px;max-height:82vh;overflow-y:auto;background:#fffdf7;border-radius:16px 16px 0 0;padding:14px 16px 28px;box-sizing:border-box;color:#2b2620;">' + panelHTML(workId, title || '作品音频') + '</div>';
    (document.body || document.documentElement).appendChild(ov);
    var root = ov.querySelector('[data-xwl-audio-root]');
    if (root) bindPanel(root, workId, {});
    ov.addEventListener('click', function (ev) { if (ev.target === ov) { if (ov.parentNode) ov.parentNode.removeChild(ov); } });
    return ov;
  }

  api = {
    MARK: 'GROUP-CORE-AUDIO',
    get MAX_FILE_BYTES() { return MAX_FILE_BYTES; }, set MAX_FILE_BYTES(v) { MAX_FILE_BYTES = v; },
    get TOTAL_BUDGET_BYTES() { return TOTAL_BUDGET_BYTES; }, set TOTAL_BUDGET_BYTES(v) { TOTAL_BUDGET_BYTES = v; },
    ACCEPT_EXTS: ACCEPT_EXTS.slice(), KIND_NAMES: KIND_NAMES,
    extOf: extOf, fmtDur: fmtDur, fmtMB: fmtMB,
    decodeCheck: decodeCheck, upload: upload, list: list, getMeta: getMeta,
    rename: rename, setScene: setScene, remove: remove, totalBytes: totalBytes,
    play: play, stopAll: stopAll, stopBgm: stopBgm, pauseBgm: pauseBgm, resumeBgm: resumeBgm,
    setVolume: setVolume, state: state, hasTrack: hasTrack, findByTrack: findByTrack,
    syncVNMusic: syncVNMusic, playSceneBgm: playSceneBgm,
    panelHTML: panelHTML, renderInto: renderInto, openPanel: openPanel, bindPanel: bindPanel
  };
  window.XWLAudio = api;
})();
