/* GROUP-VN-CHARACTER-ASSETS
 * Visual-novel-only character assets. Images stay in IndexedDB (widget_assets),
 * VRM binaries use the existing shared vrm_models store and GroupPET renderer.
 * No image is sent to an AI service or uploaded to a server.
 */
(function () {
  'use strict';
  var MAP_KEY = 'phone_vn_character_assets_v1';
  var URL_CACHE = {};
  var PLAYER_OBSERVER = null;
  var PLAYER_ID = '';
  var RESTORE_DESKTOP_VRM = false;
  var toast = function (msg) {
    try { if (window.WeChatAppEngine && WeChatAppEngine.triggerToast) WeChatAppEngine.triggerToast(msg); } catch (e) {}
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var hash = function (s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  function readMap() {
    try { var v = JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  function writeMap(v) {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function keyOf(vnId, name) { return String(vnId || '') + '::' + String(name || ''); }
  function imageId(vnId, name, face) { return 'vnchar_img_' + hash(keyOf(vnId, name) + '::' + face); }
  function modelId(vnId, name) { return 'vnchar_vrm_' + hash(keyOf(vnId, name)); }
  function record(vnId, name) { return readMap()[keyOf(vnId, name)] || {}; }
  function getCachedURL(id) { return id && URL_CACHE[id] ? URL_CACHE[id].url : ''; }
  function loadImageURL(id) {
    if (!id) return Promise.resolve('');
    if (URL_CACHE[id]) return Promise.resolve(URL_CACHE[id].url);
    if (!window.XWLDB) return Promise.resolve('');
    return window.XWLDB.get('widget_assets', id).then(function (row) {
      if (!row || !row.blob) return '';
      var url = URL.createObjectURL(row.blob);
      URL_CACHE[id] = { url: url, blob: row.blob };
      return url;
    }).catch(function () { return ''; });
  }
  function preloadVN(vn) {
    if (!vn) return Promise.resolve();
    var m = readMap();
    var jobs = [];
    var prefix = String(vn.id || '') + '::';
    Object.keys(m).forEach(function (key) {
      if (key.indexOf(prefix) !== 0) return;
      var r = m[key] || {};
      ['baseId', 'blinkId', 'smileId'].forEach(function (k) { if (r[k]) jobs.push(loadImageURL(r[k])); });
    });
    return Promise.all(jobs).then(function () {});
  }
  function forSprite(vnId, name) {
    var r = record(vnId, name);
    var faces = {
      base: getCachedURL(r.baseId),
      blink: getCachedURL(r.blinkId),
      smile: getCachedURL(r.smileId)
    };
    return { mode: r.mode || (r.modelId ? 'model' : 'image'), modelId: r.modelId || '', faces: faces };
  }
  function beforeRender(ov) {
    var c = ov && ov.querySelector ? ov.querySelector('[data-vnca-canvas][data-vnca-mounted="1"]') : null;
    if (!c) return null;
    var saved = { canvas: c, modelId: c.getAttribute('data-vnca-model-id') || '' };
    try { c.parentNode.removeChild(c); } catch (e) {}
    return saved;
  }
  function setCanvasFailure(canvas, message) {
    if (!canvas) return;
    var host = canvas.parentNode;
    canvas.style.display = 'none';
    if (host) {
      var note = host.querySelector('.vnca-model-note');
      if (note) { note.hidden = false; note.textContent = (message || '3D 预览暂不可用，已显示图片立绘').replace(/已回落像素猫/g, '已显示图片立绘'); }
      var fallback = host.querySelector('.vnca-model-fallback');
      if (fallback) fallback.style.opacity = '1';
    }
  }
  function invalidateModelCanvas(vnId, id) {
    var ov = document.getElementById('aw-vn-player');
    if (!ov || !ov._awVN || ov._awVN.vnId !== vnId) return;
    var canvases = ov.querySelectorAll('[data-vnca-canvas]');
    for (var i = 0; i < canvases.length; i++) {
      if (canvases[i].getAttribute('data-vnca-model-id') !== id) continue;
      canvases[i]._vncaDiscarded = true;
      canvases[i].removeAttribute('data-vnca-mounted');
      try { if (window.GroupPET && window.GroupPET.disposeVRMStage) window.GroupPET.disposeVRMStage(); } catch (e) {}
    }
  }
  function mountModels(ov) {
    if (!ov || !ov.querySelectorAll) return;
    var canvases = ov.querySelectorAll('[data-vnca-canvas]');
    if (!canvases.length) return;
    var chosen = canvases[0];
    for (var i = 1; i < canvases.length; i++) {
      setCanvasFailure(canvases[i], '同屏暂只渲染一个 3D 角色');
    }
    if (chosen._vncaDiscarded || chosen.getAttribute('data-vnca-mounted') === '1' || chosen._vncaPending) return;
    chosen.setAttribute('data-vnca-mounted', '1');
    chosen._vncaPending = true;
    var id = chosen.getAttribute('data-vnca-model-id') || '';
    if (!window.GroupPET || !window.GroupPET.loadVRMInto || !window.XWLDB) {
      chosen._vncaPending = false;
      setCanvasFailure(chosen, '当前环境缺少 3D 运行库或本地存储');
      return;
    }
    try { RESTORE_DESKTOP_VRM = RESTORE_DESKTOP_VRM || !!(window.GroupPET.isDesktopVRMOn && window.GroupPET.isDesktopVRMOn()); } catch (e) {}
    window.GroupPET.loadVRMInto(chosen, id).then(function (res) {
      chosen._vncaPending = false;
      if (!chosen.isConnected) return;
      if (res && res.ok) {
        chosen.classList.add('vnca-model-ready');
        var host = chosen.parentNode;
        var fallback = host && host.querySelector('.vnca-model-fallback');
        if (fallback) fallback.style.opacity = '0';
      } else {
        setCanvasFailure(chosen, (res && res.message) || '3D 预览暂不可用，已显示图片立绘');
      }
    }).catch(function (err) {
      chosen._vncaPending = false;
      setCanvasFailure(chosen, (err && err.message) || '3D 预览暂不可用，已显示图片立绘');
    });
  }
  function syncFaces(ov) {
    if (!ov || !ov.querySelectorAll) return;
    var wraps = ov.querySelectorAll('.vnca-face-wrap');
    for (var i = 0; i < wraps.length; i++) {
      var wrap = wraps[i];
      var expr = String(wrap.getAttribute('data-vnca-expr') || '').toLowerCase();
      var happy = /(happy|smile|joy|laugh|love|开心|高兴|微笑|笑|喜悦|甜)/i.test(expr);
      var smile = wrap.querySelector('[data-vnca-face="smile"]');
      var base = wrap.querySelector('[data-vnca-face="base"]');
      var blink = wrap.querySelector('[data-vnca-face="blink"]');
      var useSmile = happy && smile;
      if (smile) smile.classList.toggle('vnca-face-on', !!useSmile);
      if (base) base.classList.toggle('vnca-face-on', !useSmile);
      if (blink) blink.classList.remove('vnca-face-on');
      if (blink && !useSmile && blink.getAttribute('data-vnca-ready') === '1' && !wrap._vncaBlinkTimer) {
        var schedule = function (w) {
          var delay = 2800 + Math.random() * 2500;
          w._vncaBlinkTimer = setTimeout(function () {
            w._vncaBlinkTimer = 0;
            if (!w.isConnected) return;
            var b = w.querySelector('[data-vnca-face="blink"]');
            var n = w.querySelector('[data-vnca-face="base"]');
            if (b && n && !/(happy|smile|joy|laugh|love|开心|高兴|微笑|笑|喜悦|甜)/i.test(w.getAttribute('data-vnca-expr') || '')) {
              b.classList.add('vnca-face-on'); n.classList.remove('vnca-face-on');
              setTimeout(function () { if (b.isConnected) { b.classList.remove('vnca-face-on'); n.classList.add('vnca-face-on'); schedule(w); } }, 140);
            } else schedule(w);
          }, delay);
        };
        schedule(wrap);
      }
    }
  }
  function afterRender(ov, vnId, saved) {
    if (!ov) return;
    if (saved && saved.canvas) {
      var placeholder = ov.querySelector('[data-vnca-canvas][data-vnca-model-id="' + (window.CSS && CSS.escape ? CSS.escape(saved.modelId) : saved.modelId.replace(/[^a-zA-Z0-9_-]/g, '\\$&')) + '"]');
      if (placeholder) {
        placeholder.parentNode.replaceChild(saved.canvas, placeholder);
      } else {
        try { if (window.GroupPET && window.GroupPET.disposeVRMStage) window.GroupPET.disposeVRMStage(); } catch (e) {}
      }
    }
    mountModels(ov);
    syncFaces(ov);
    addToolbarButton(ov, vnId);
  }
  function currentVN(ov) { try { return window.AWGroup && window.AWGroup.getVN && window.AWGroup.getVN(ov._awVN.vnId); } catch (e) { return null; } }
  function addToolbarButton(ov, vnId) {
    var toolbar = ov && ov.firstElementChild;
    if (!toolbar || toolbar.querySelector('[data-vnca-open]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-vnca-open', '1'); b.setAttribute('data-vnca-vn', vnId);
    b.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><circle cx="8" cy="5" r="2.6" fill="currentColor"/><path d="M2.5 14.5c.8-2.8 2.9-4.2 5.5-4.2s4.7 1.4 5.5 4.2z" fill="currentColor"/></svg> 形象';
    b.className = 'vnca-toolbar-button';
    toolbar.insertBefore(b, toolbar.lastElementChild || null);
  }
  function faceLabel(k) { return k === 'base' ? '普通立绘' : (k === 'blink' ? '闭眼/眨眼' : '笑脸'); }
  function assetPane(ov, name) {
    var vn = currentVN(ov); var r = record(vn && vn.id, name);
    var modelList = window.XWLDB ? window.XWLDB.getAll('vrm_models') : Promise.resolve([]);
    return Promise.resolve(modelList).then(function (models) {
      var modelRow = null;
      (models || []).forEach(function (m) { if (m && m.id === r.modelId) modelRow = m; });
      var files = ['base', 'blink', 'smile'].map(function (k) {
        var id = r[k + 'Id']; var filename = r[k + 'Name'];
        var info = id ? ('已上传：' + esc(filename || faceLabel(k))) : '尚未上传';
        return '<div class="vnca-file-row"><div><b>' + faceLabel(k) + '</b><small>' + info + '</small></div>'
          + '<label class="vnca-file-button">' + (id ? '更换图片' : '上传图片') + '<input type="file" accept="image/*" data-vnca-file="' + k + '"></label>'
          + (id ? '<button type="button" class="vnca-remove" data-vnca-remove="' + k + '">移除</button>' : '') + '</div>';
      }).join('');
      var mode = r.mode || (r.modelId ? 'model' : 'image');
      var modelInfo = modelRow ? ('已上传：' + esc(modelRow.name || 'VRM 模型') + ' · ' + (Math.max(1, Math.round((modelRow.size || 0) / 1048576 * 10) / 10)) + ' MB') : (r.modelId ? '模型记录未找到，请重新上传' : '尚未上传');
      return '<div class="vnca-card" data-vnca-current-char="' + esc(name) + '">'
        + '<div class="vnca-char-heading"><span class="vnca-avatar">' + esc(name.charAt(0) || '人') + '</span><div><b>' + esc(name) + '</b><small>只为这部视觉小说保存</small></div></div>'
        + '<div class="vnca-section-title">图片立绘</div>' + files
        + '<p class="vnca-tip">普通图是静态立绘；上传闭眼图后可自动短暂眨眼，上传笑脸图后会在剧本表情标记为开心/微笑时切换。只上传一张图时不会让 AI 改脸。</p>'
        + '<div class="vnca-section-title">3D 角色模型</div><div class="vnca-file-row"><div><b>VRM 模型</b><small>' + modelInfo + '</small></div>'
        + '<label class="vnca-file-button">' + (r.modelId ? '更换模型' : '上传 .vrm') + '<input type="file" accept=".vrm,model/vrm,application/octet-stream" data-vnca-file="model"></label>'
        + (r.modelId ? '<button type="button" class="vnca-remove" data-vnca-remove="model">移除</button>' : '') + '</div>'
        + '<p class="vnca-tip">模型在本机保存；使用时需联网加载现有 VRM 运行组件，设备需支持 WebGL。兼容模型会呼吸并眨眼；是否能眨眼取决于 VRM 模型是否含表情。图片与模型均不会发给 AI。</p>'
        + '<div class="vnca-mode"><span>舞台显示</span><button type="button" class="' + (mode === 'image' ? 'is-on' : '') + '" data-vnca-mode="image" ' + (!r.baseId ? 'disabled' : '') + '>图片</button><button type="button" class="' + (mode === 'model' ? 'is-on' : '') + '" data-vnca-mode="model" ' + (!r.modelId ? 'disabled' : '') + '>3D 模型</button></div>'
        + '<div class="vnca-privacy">素材只存在当前浏览器的本机数据库。VRM 大模型不随整机备份导出，换设备或清除网站数据后需重新上传。</div>'
        + '</div>';
    });
  }
  function openManager(ov, vnId) {
    var vn = window.AWGroup && window.AWGroup.getVN ? window.AWGroup.getVN(vnId) : null;
    if (!vn) { toast('找不到这部视觉小说'); return; }
    var chars = Array.isArray(vn.characters) ? vn.characters.slice() : [];
    var shown = {};
    Object.keys(ov._awVN && ov._awVN.sprites || {}).forEach(function (n) { if (chars.indexOf(n) < 0) chars.push(n); });
    var modal = document.createElement('div'); modal.className = 'vnca-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', '人物形象');
    modal.innerHTML = '<div class="vnca-sheet"><div class="vnca-head"><div><span class="vnca-kicker">CHARACTER STUDIO</span><h2>人物形象</h2><p>《' + esc(vn.title) + '》 · 添加自己的图片或 VRM</p></div><button type="button" data-vnca-close aria-label="关闭">×</button></div>'
      + (chars.length ? '<div class="vnca-character-tabs">' + chars.map(function (n, i) { return '<button type="button" data-vnca-select="' + esc(n) + '" class="' + (!i ? 'is-on' : '') + '">' + esc(n) + '</button>'; }).join('') + '</div>' : '')
      + '<div data-vnca-pane></div></div>';
    modal._vncaVNId = vnId; modal._vncaChars = chars; modal._vncaChar = chars[0] || '';
    ov.appendChild(modal);
    var emptyPane = modal.querySelector('[data-vnca-pane]');
    if (!chars.length && emptyPane) emptyPane.innerHTML = '<div class="vnca-empty-state"><div class="vnca-empty-title">暂时还没有人物</div><p>添加含人物姓名的剧本后，人物会出现在列表中；之后可以为人物上传图片立绘或 VRM 模型。</p><span>列表保持空白，不会预置占位角色。</span></div>';
    function show(name) {
      modal._vncaChar = name;
      modal.querySelectorAll('[data-vnca-select]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-vnca-select') === name); });
      assetPane(ov, name).then(function (html) { var pane = modal.querySelector('[data-vnca-pane]'); if (pane && modal.isConnected && modal._vncaChar === name) pane.innerHTML = html; });
    }
    modal._vncaShow = show; if (chars.length) show(chars[0]);
    modal.addEventListener('click', function (ev) {
      var sel = ev.target.closest && ev.target.closest('[data-vnca-select]');
      var close = ev.target.closest && ev.target.closest('[data-vnca-close]');
      var remove = ev.target.closest && ev.target.closest('[data-vnca-remove]');
      var mode = ev.target.closest && ev.target.closest('[data-vnca-mode]');
      if (close || ev.target === modal) { modal.remove(); rerenderPlayer(ov); return; }
      if (sel) { show(sel.getAttribute('data-vnca-select')); return; }
      if (mode) {
        var rr = record(vnId, modal._vncaChar); rr.mode = mode.getAttribute('data-vnca-mode'); saveRecord(vnId, modal._vncaChar, rr); show(modal._vncaChar); return;
      }
      if (remove) { removeAsset(vnId, modal._vncaChar, remove.getAttribute('data-vnca-remove')).then(function () { show(modal._vncaChar); }); return; }
    });
    modal.addEventListener('change', function (ev) {
      var input = ev.target && ev.target.closest ? ev.target.closest('[data-vnca-file]') : null;
      if (!input || !input.files || !input.files[0]) return;
      var kind = input.getAttribute('data-vnca-file'); var file = input.files[0]; input.value = '';
      input.disabled = true;
      importAsset(vnId, modal._vncaChar, kind, file).then(function (message) {
        input.disabled = false; toast(message); show(modal._vncaChar);
      }).catch(function (err) {
        input.disabled = false;
        var msg = (err && err.message) || '导入失败'; toast(msg);
        try { window.alert(msg); } catch (e) {}
      });
    });
  }
  function saveRecord(vnId, name, r) {
    var m = readMap(); m[keyOf(vnId, name)] = r;
    if (!writeMap(m)) throw new Error('浏览器本地设置空间不足，无法保存人物素材索引');
  }
  function fileToImageBlob(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var maxW = 1280, maxH = 1600; var scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
          var canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          var ctx = canvas.getContext('2d'); if (!ctx) throw new Error('图片处理器不可用');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var finish = function (blob) {
            URL.revokeObjectURL(url);
            if (!blob || !blob.size) { reject(new Error('图片压缩失败，请换一张图片')); return; }
            if (blob.size > 2 * 1024 * 1024) { reject(new Error('压缩后图片仍超过 2MB，请换较小的图片')); return; }
            resolve({ blob: blob, width: canvas.width, height: canvas.height });
          };
          if (canvas.toBlob) {
            canvas.toBlob(function (blob) {
              if (blob && blob.size) { finish(blob); return; }
              canvas.toBlob(finish, 'image/png');
            }, 'image/webp', 0.84);
          } else {
            var encoded = canvas.toDataURL('image/png').split(',')[1];
            var binary = atob(encoded); var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            finish(new Blob([bytes], { type: 'image/png' }));
          }
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')); };
      img.src = url;
    });
  }
  function importAsset(vnId, name, kind, file) {
    if (!window.XWLDB) return Promise.reject(new Error('本机素材库暂不可用'));
    if (kind === 'model') {
      if (!/\.vrm$/i.test(file.name || '')) return Promise.reject(new Error('请上传 .vrm 格式的角色模型'));
      if (file.size > 80 * 1024 * 1024) return Promise.reject(new Error('VRM 文件超过 80MB，暂不导入'));
      var id = modelId(vnId, name); var rr = record(vnId, name);
      return window.XWLDB.put('vrm_models', { id: id, name: file.name, source: 'vn-character', license: '', credit: '', size: file.size, createdAt: Date.now(), blob: file, vnId: vnId, characterName: name }).then(function () {
        return window.XWLDB.get('vrm_models', id);
      }).then(function (stored) {
        if (!stored || !stored.blob) throw new Error('模型写入本机数据库失败，可能是存储空间不足');
        rr.modelId = id; rr.modelName = file.name; rr.mode = 'model'; saveRecord(vnId, name, rr);
        invalidateModelCanvas(vnId, id);
        return 'VRM 模型已保存在本机';
      });
    }
    if (['base', 'blink', 'smile'].indexOf(kind) < 0) return Promise.reject(new Error('不认识的图片类型'));
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '')) return Promise.reject(new Error('请选择图片文件'));
    if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('原图超过 20MB，请先压缩后再上传'));
    return fileToImageBlob(file).then(function (result) {
      var id = imageId(vnId, name, kind); var rr = record(vnId, name);
      return window.XWLDB.put('widget_assets', { id: id, blob: result.blob, name: file.name, width: result.width, height: result.height, owner: 'vn-character', vnId: vnId, characterName: name, face: kind, updatedAt: Date.now() }).then(function () {
        return window.XWLDB.get('widget_assets', id);
      }).then(function (stored) {
        if (!stored || !stored.blob) throw new Error('图片写入本机数据库失败，可能是存储空间不足');
        if (URL_CACHE[id]) { try { URL.revokeObjectURL(URL_CACHE[id].url); } catch (e) {} delete URL_CACHE[id]; }
        rr[kind + 'Id'] = id; rr[kind + 'Name'] = file.name; if (kind === 'base') rr.mode = 'image'; saveRecord(vnId, name, rr);
        return faceLabel(kind) + '已保存在本机';
      });
    });
  }
  function removeAsset(vnId, name, kind) {
    var rr = record(vnId, name);
    var prop = kind === 'model' ? 'modelId' : kind + 'Id'; var id = rr[prop];
    if (!id) return Promise.resolve();
    var store = kind === 'model' ? 'vrm_models' : 'widget_assets';
    var del = window.XWLDB ? window.XWLDB.delete(store, id) : Promise.resolve();
    return Promise.resolve(del).then(function () {
      if (URL_CACHE[id]) { try { URL.revokeObjectURL(URL_CACHE[id].url); } catch (e) {} delete URL_CACHE[id]; }
      delete rr[prop]; delete rr[kind === 'model' ? 'modelName' : kind + 'Name'];
      if (kind === 'model' && rr.mode === 'model') rr.mode = rr.baseId ? 'image' : 'none';
      saveRecord(vnId, name, rr);
    });
  }
  function cleanupVN(vnId) {
    var m = readMap();
    var prefix = String(vnId || '') + '::';
    Object.keys(m).forEach(function (k) { if (k.indexOf(prefix) === 0) delete m[k]; });
    writeMap(m);
    if (!window.XWLDB) return Promise.resolve();
    return Promise.all([
      window.XWLDB.getAll('widget_assets').then(function (rows) {
        return Promise.all((rows || []).filter(function (r) { return r && String(r.vnId || '') === String(vnId) && r.owner === 'vn-character'; }).map(function (r) {
          if (URL_CACHE[r.id]) { try { URL.revokeObjectURL(URL_CACHE[r.id].url); } catch (e) {} delete URL_CACHE[r.id]; }
          return window.XWLDB.delete('widget_assets', r.id);
        }));
      }),
      window.XWLDB.getAll('vrm_models').then(function (rows) {
        return Promise.all((rows || []).filter(function (r) { return r && String(r.vnId || '') === String(vnId) && r.source === 'vn-character'; }).map(function (r) {
          return window.XWLDB.delete('vrm_models', r.id);
        }));
      })
    ]).then(function () {}, function () {});
  }
  function wrapDeleteVN() {
    var aw = window.AWGroup;
    if (!aw || !aw.deleteVN || aw.deleteVN.__vncaWrapped) return false;
    var original = aw.deleteVN;
    var wrapped = function (vnId) {
      var result = original.apply(this, arguments);
      cleanupVN(vnId);
      return result;
    };
    wrapped.__vncaWrapped = true;
    aw.deleteVN = wrapped;
    return true;
  }
  function rerenderPlayer(ov) {
    if (!ov || !ov._awVN || !window.AWGroup || !window.AWGroup.openVNPlayer) return;
    var s = ov._awVN; var v = {};
    try { v = JSON.parse(JSON.stringify(s)); } catch (e) { v = s; }
    v.vnId = s.vnId;
    setTimeout(function () { try { window.AWGroup.openVNPlayer(s.vnId, v); } catch (e) {} }, 0);
  }
  function bindPlayerObserver(ov, vnId) {
    if (PLAYER_OBSERVER) { try { PLAYER_OBSERVER.disconnect(); } catch (e) {} }
    PLAYER_ID = vnId;
    if (typeof MutationObserver !== 'undefined') {
      PLAYER_OBSERVER = new MutationObserver(function () {
        if (!ov.isConnected || ov.style.display === 'none') return;
        mountModels(ov); syncFaces(ov); addToolbarButton(ov, vnId);
      });
      PLAYER_OBSERVER.observe(ov, { childList: true, subtree: true });
    }
    if (!ov._vncaBound) {
      ov._vncaBound = true;
      ov.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-vnca-open]') : null;
        if (b) { ev.preventDefault(); ev.stopPropagation(); openManager(ov, b.getAttribute('data-vnca-vn') || PLAYER_ID || vnId); }
      }, true);
    }
  }
  function wrapPlayer() {
    var aw = window.AWGroup;
    if (!aw || !aw.openVNPlayer || aw.openVNPlayer.__vncaWrapped) return false;
    var original = aw.openVNPlayer;
    var wrapped = function (vnId, save) {
      var vn = aw.getVN ? aw.getVN(vnId) : null;
      return preloadVN(vn).then(function () {
        var result = original.call(aw, vnId, save);
        if (result) {
          var ov = document.getElementById('aw-vn-player');
          if (ov) { bindPlayerObserver(ov, vnId); addToolbarButton(ov, vnId); mountModels(ov); syncFaces(ov); }
        }
        return result;
      });
    };
    wrapped.__vncaWrapped = true;
    aw.openVNPlayer = wrapped;
    return true;
  }
  function cleanup() {
    if (PLAYER_OBSERVER) { try { PLAYER_OBSERVER.disconnect(); } catch (e) {} PLAYER_OBSERVER = null; }
    if (RESTORE_DESKTOP_VRM) {
      RESTORE_DESKTOP_VRM = false;
      setTimeout(function () { try { if (window.GroupPET && window.GroupPET.setDesktopVRM) window.GroupPET.setDesktopVRM(true); } catch (e) {} }, 200);
    } else {
      try { if (window.GroupPET && window.GroupPET.disposeVRMStage) window.GroupPET.disposeVRMStage(); } catch (e) {}
    }
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-vn="close"]') : null;
    if (b && PLAYER_ID) { PLAYER_ID = ''; setTimeout(cleanup, 30); }
  }, true);
  var api = {
    version: 'VNCharacterAssets-v1',
    preload: preloadVN,
    forSprite: forSprite,
    beforeRender: beforeRender,
    afterRender: afterRender,
    onPlayerEnd: cleanup,
    mountModels: mountModels,
    syncFaces: syncFaces,
    getMap: readMap,
    openManager: openManager,
    importAsset: importAsset
  };
  window.VNCharacterAssets = api;
  wrapPlayer();
  wrapDeleteVN();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { wrapPlayer(); wrapDeleteVN(); });
})();
