
/* GROUP-PET: 桌宠（第 8 项行为 + 第 15 项桌宠市场 + 第 21 项 3D 桌宠与世界）。
   ── 直接复用（原样用，没重写）──
   · desksprite（welltilln/desksprite，MIT）真实像素皮肤数据：FIX2 SKINS.boy（blue-boy.json，
     14x14）与 SKINS.cat（cat.json，13x13）帧点阵逐字照录——本组不画一格新像素。
   · GROUP-PET-MERGE：市场三款不再是 boy 帧换色——Claude 是本站手画的像素螃蟹
     （FIX2 SKINS.crab，13x13，照图 3 像素风），ChatGPT 是本站手画的像素黑狐
     （FIX2 SKINS.fox，14x13，蓝丝带占 R/r 专属键），Muse 是本站手画的 Jolly
     像素版（FIX2 SKINS.jolly，13x13，照当前默认头像的奶油毛绒形象）；三款各
     5 张帧 + 独立调色板，MARKET_PALETTES 换色表已随换色款一起删除。
     旧存档里已领养 pet-claude / pet-chatgpt / pet-muse 的用户会直接看到新模型。
   · P 组 VRM 预览链路（three@0.128.0 + three-vrm@0.6.7，jsdelivr CDN，UMD 全局加载）：
     导入入口直接调 window.GroupP.importVRMFile；口型复用 GroupP.attachBoundary（TTS 词边界）
     与 GroupP.startAudioLipsync（已播音频按振幅，ARPAHLS 方案）；手势名沿用 GroupP.motion。
   · Hanami（Undi95/Hanami）资产许可口径：代码 AGPL-3.0 只借思路不抄代码；模型/房间只看
     资产自己的许可。Seed-san.vrm 是 VRM Public License 1.0（allowRedistribution: true，
     署名 VirtualCast, Inc.，条款见 vrm/Seed-san.LICENCE.txt，约 10.4 MB）；7 间 .glb 房间
     全部 CC BY 4.0（须逐间署名，见 ROOMS）。
   · unfold（Dksie09/unfold，MIT）折叠数学：思路可借、Next.js 代码不可搬。本组的
     pageAngles / floorApex 按学习笔记 §2.2 所述规则自己重写（不是复制 lib/fold.ts）。
   ── 版本（核实后决定不升，见 VERSION_NOTE）──
   · three@0.170.0 的 build/three.min.js 已 404（UMD 构建自 r160 起取消；2026-11-26 实测）；
     three-vrm@3.1.0 只有 ESM（package.json: type module，main lib/three-vrm.module.js），
     与手机现有 <script src> 全局加载方式不兼容。升级须改 import map + ESM 链路，另立项，
     本批保持 three 0.128.0 + three-vrm 0.6.7。
   ── 离线与诚实回落 ──
   · Seed-san 与 .glb 房间只在联网时下载；Seed-san 下载一次存 XWLDB vrm_models，离线复用；
     模型文件绝不 base64 内嵌进 HTML；整机备份只导模型元数据（STEP0 口径），恢复后重下/重导。
   · 没联网 / CDN 加载失败 / 解析失败时，一律回落像素猫（或原有 CSS 3D），并在界面上写明原因，
     不假装在播 3D。3D 桌宠默认不开，由用户在桌宠市场里打开。 */
(function () {
'use strict';
/* ── 0. 清单（唯一事实来源；桌宠设置页的皮肤注册表与这里合并，见 js/16 SKINS） ── */
var MARKET = [
  { id: 'cat', skin: 'cat', frame: 'cat', name: '小猫', note: 'desksprite cat.json 原始帧（13x13 橘猫），逐字照录。' },
  { id: 'pet-claude', skin: 'pet-claude', frame: 'crab', name: 'Claude', note: '像素螃蟹（本站手画，13x13，照图 3 像素风：扁平暖色、无描边）。' },
  { id: 'pet-chatgpt', skin: 'pet-chatgpt', frame: 'fox', name: 'ChatGPT', note: '像素黑狐（本站手画，14x13：尖耳、吻部、蓬松尾巴，脖子上系着蓝丝带）。' },
  { id: 'pet-muse', skin: 'pet-muse', frame: 'jolly', name: 'Muse', note: 'Jolly 像素版（本站手画，13x13：圆乎乎的奶油色毛绒身子，大脸、黑眼睛、粉腮红）。' },
  { id: 'pet-wumi', skin: 'pet-wumi', frame: null, img: 'assets/pets/wumi.png', name: '五条猫猫', note: '猫塑五条悟：白毛圆墨镜，像素风。' }
];
/* GROUP-PET-MERGE：MARKET_PALETTES 换色表已删除——三款不再是 boy 帧换色，
   各自有真模型（frame 指向 FIX2 SKINS 的 crab / fox / jolly）；领养与设置
   写同一个 petSkin，effectiveSkin 只认 frame。 */
var SEED_SAN = {
  id: 'seed-san', name: 'Seed-san',
  url: 'https://raw.githubusercontent.com/Undi95/Hanami/main/vrm/Seed-san.vrm',
  sizeLabel: '约 10.4 MB', license: 'VRM Public License 1.0', credit: 'VirtualCast, Inc.',
  licenseFile: 'Undi95/Hanami vrm/Seed-san.LICENCE.txt'
};
var ROOMS = [
  /* 7 间 Hanami environments/ .glb 全部 CC BY 4.0（Sketchfab 原作者，须逐间署名）。大小为
     2026-11-26 用 GitHub contents API 实测的字节数；cozy-loft-room 与另两间（small-cafe、
     cute-isometric-room / rustic-bedroom 一类）在本次拉取中未完整返回，作者与大小待查，
     未列入可选房间——不猜、不编，见 GROUP-PET_说明.md 清单。 */
  { id: 'anime-classroom', file: 'anime-classroom.glb', title: 'Anime Class Room', author: 'AnixMoonLight', size: 8864508, selectable: true },
  { id: 'apartment-floorplan', file: 'apartment-floorplan.glb', title: 'apartment floor plan', author: 'SrMonteiro', size: 9177876, selectable: true },
  { id: 'japanese-classroom', file: 'japanese-classroom.glb', title: 'Japanese Classroom', author: 'T I A N', size: 19968720, selectable: true },
  { id: 'lowpoly-restaurant', file: 'lowpoly-restaurant.glb', title: 'Low Poly Restaurant Interior Scene', author: 'GameAssetsFin', size: 4759240, selectable: true },
  { id: 'cozy-loft-room', file: 'cozy-loft-room.glb', title: 'cozy loft room', author: '待查（environments/CREDITS.md）', size: 5544308, selectable: false }
];
var CDN = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
  gltfLoader: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  threeVrm: 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@0.6.7/lib/three-vrm.js',
  threeVrmAlt: 'https://unpkg.com/@pixiv/three-vrm@0.6.7/lib/three-vrm.js',
  roomBase: 'https://cdn.jsdelivr.net/gh/Undi95/Hanami@main/environments/'
};
var VERSION_NOTE = '保持 three 0.128.0 + three-vrm 0.6.7：three@0.170.0 的 build/three.min.js 已 404（UMD 自 r160 起取消），three-vrm@3.1.0 只有 ESM（type: module，main lib/three-vrm.module.js），与手机现有 <script src> 全局加载不兼容；升级须改 import map + ESM 链路，另立项。';
var THREE_TIMEOUT_MS = 15000;
var ROOM_SIZE_LIMIT = 25 * 1024 * 1024;
var ROOM_SIZE_WARN = 10 * 1024 * 1024;

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function readJSON(k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function readPrefs() { return readJSON('phone_ui_prefs_v1', {}) || {}; }
function writePrefs(patch) {
  var p = readPrefs();
  Object.keys(patch || {}).forEach(function (k) { p[k] = patch[k]; });
  writeJSON('phone_ui_prefs_v1', p);
  try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {}
  return p;
}
function isOnline() { try { return navigator.onLine !== false; } catch (e) { return true; } }
function loadScriptOnce(src) {
  return new Promise(function (resolve, reject) {
    try { if (document.querySelector('script[src="' + src + '"]')) { resolve(true); return; } } catch (e) {}
    var sc = document.createElement('script');
    sc.src = src; sc.async = true;
    var done = false;
    sc.onload = function () { if (!done) { done = true; resolve(true); } };
    sc.onerror = function () { if (!done) { done = true; reject(new Error('CDN 加载失败：' + src)); } };
    document.head.appendChild(sc);
  });
}
function injectCSS() {
  try {
    if (document.getElementById('grouppet-style')) return;
    var s = document.createElement('style');
    s.id = 'grouppet-style';
    s.textContent = '#desk-pet.grouppet-vrm-on .gm-pet-char{display:none}' +
      '#desk-pet.grouppet-vrm-on #gw-pet-skin{display:none}' +
      '#grouppet-vrm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}';
    document.head.appendChild(s);
  } catch (e) {}
}

/* ── 1. 像素市场：预览与领养（只换 petSkin，不换猫） ──
   预览按 MARKET 的 frame 取 FIX2 SKINS 的真帧画，不再是 cat/boy 二选一，
   也不再叠 MARKET_PALETTES 换色。 */
function drawMarketPreview(canvas, modelId) {
  try {
    var sk = (window.GroupFIX2 && window.GroupFIX2.SKINS) || null;
    if (!sk || !canvas || !canvas.getContext) return false;
    var m = null;
    MARKET.forEach(function (x) { if (x.id === modelId) m = x; });
    if (!m) return false;
    if (m.img) return false; /* 内置图片皮肤：市场卡直接渲染 <img>，不画 FIX2 预览 */
    /* 按 MARKET 的 frame 取真帧；GroupFIX2.skinKeyForPetSkin 是同一映射的
       另一头（petSkin → 帧键），frame 缺失时才用它兜底。 */
    var key = m.frame || null;
    if (!key && window.GroupFIX2 && GroupFIX2.skinKeyForPetSkin) key = GroupFIX2.skinKeyForPetSkin(m.skin);
    if (!key) key = (modelId === 'cat') ? 'cat' : 'boy';
    var skin = sk[key];
    if (!skin) return false;
    var rows = (skin.frames && skin.frames.idle) || null;
    if (!rows) return false;
    var pal = skin.palette || {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    canvas.width = skin.w; canvas.height = skin.h;
    ctx.clearRect(0, 0, skin.w, skin.h);
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y] || '';
      for (var x = 0; x < row.length; x++) {
        var c = pal[row.charAt(x)];
        if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
      }
    }
    return true;
  } catch (e) { return false; }
}
function currentModel() {
  var skin = '';
  try { skin = (readPrefs() || {}).petSkin || 'default'; } catch (e) {}
  if (skin === 'cat' || skin === 'pet-claude' || skin === 'pet-chatgpt' || skin === 'pet-muse' || skin === 'pet-wumi') return skin;
  return skin === 'cutout' ? 'cutout' : 'default';
}
function adopt(modelId) {
  var m = null;
  MARKET.forEach(function (x) { if (x.id === modelId) m = x; });
  if (!m) return { ok: false, reason: 'bad-model' };
  try {
    if (window.GroupW && GroupW.setPref) GroupW.setPref('petSkin', m.skin);
    else writePrefs({ petSkin: m.skin });
  } catch (e) { return { ok: false, reason: 'save-failed' }; }
  try { if (window.GroupFIX2 && GroupFIX2.ensurePetCanvas) GroupFIX2.ensurePetCanvas(); } catch (e) {}
  return { ok: true, skin: m.skin, name: m.name };
}

/* ── 2. three.js 懒加载（只在用户点 3D 功能时联网，绝不阻塞开机） ── */
var _threeBasePromise = null;
var _threeVrmPromise = null;
var _modernVRMPromise = null;
var _threeError = '';
function ensureThree(withVRM) {
  if (!withVRM) {
    if (_threeBasePromise) return _threeBasePromise;
    _threeBasePromise = new Promise(function (resolve) {
      if (typeof window.THREE !== 'undefined' && window.THREE && window.THREE.WebGLRenderer) { resolve(window.THREE); return; }
      if (!isOnline()) { _threeError = '没联网'; resolve(null); return; }
      var timer = setTimeout(function () { _threeError = '加载超时（可能没联网）'; resolve(null); }, THREE_TIMEOUT_MS);
      loadScriptOnce(CDN.three).then(function () { return loadScriptOnce(CDN.gltfLoader); }).then(function () {
        clearTimeout(timer);
        var T = window.THREE;
        if (T && T.GLTFLoader) resolve(T);
        else { _threeError = '运行库已加载，但接口不匹配'; resolve(null); }
      }).catch(function (err) { clearTimeout(timer); _threeError = (err && err.message) || '加载失败'; resolve(null); });
    });
    return _threeBasePromise;
  }
  if (_threeVrmPromise) return _threeVrmPromise;
  _threeVrmPromise = ensureThree(false).then(function (T) {
    if (!T) return null;
    if (T.VRMLoaderPlugin) return T;
    if (!isOnline()) { _threeError = '没联网'; return null; }
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { _threeError = '加载超时（可能没联网）'; resolve(null); }, THREE_TIMEOUT_MS);
      loadScriptOnce(CDN.threeVrm).catch(function () { return loadScriptOnce(CDN.threeVrmAlt); }).then(function () {
        clearTimeout(timer);
        var legacy = window.THREE_VRM && window.THREE_VRM.VRM;
        var available = !!(T.VRMLoaderPlugin || (legacy && typeof legacy.from === 'function'));
        if (!available) _threeError = '运行库已加载，但缺少 VRM 解析器';
        resolve(available ? T : null);
      }).catch(function (err) { clearTimeout(timer); _threeError = (err && err.message) || '加载失败'; resolve(null); });
    });
  });
  return _threeVrmPromise;
}
// The visual-novel stage needs VRM 1.0 support. Keep this ESM runtime
// isolated from the existing global THREE used by the desktop and rooms.
function ensureModernVRM() {
  if (_modernVRMPromise) return _modernVRMPromise;
  if (!isOnline()) return Promise.resolve(null);
  var timeout;
  var imports = Promise.all([
    import('https://esm.sh/three@0.169.0'),
    import('https://esm.sh/three@0.169.0/examples/jsm/loaders/GLTFLoader.js'),
    import('https://esm.sh/@pixiv/three-vrm@3.1.0?deps=three@0.169.0')
  ]).then(function (m) {
    return Object.assign({}, m[0], { GLTFLoader: m[1].GLTFLoader, VRMLoaderPlugin: m[2].VRMLoaderPlugin, VRMUtils: m[2].VRMUtils });
  });
  _modernVRMPromise = Promise.race([imports, new Promise(function (_, reject) {
    timeout = setTimeout(function () { reject(new Error('VRM 运行库加载超时')); }, THREE_TIMEOUT_MS);
  })]).then(function (runtime) { clearTimeout(timeout); return runtime; }, function () {
    clearTimeout(timeout); _modernVRMPromise = null; return null;
  });
  return _modernVRMPromise;
}
function threeError() { return _threeError; }

/* ── 3. VRM 模型：下载一次存 XWLDB vrm_models；用户自己导入自己的 .vrm ── */
function listStoredModels() {
  if (!window.XWLDB) return Promise.resolve([]);
  return window.XWLDB.getAll('vrm_models').then(function (rows) {
    return (rows || []).filter(function (r) { return r && r.source !== 'vn-character'; }).map(function (r) {
      return { id: r.id, name: r.name, source: r.source, license: r.license, credit: r.credit, size: r.size, createdAt: r.createdAt, hasBlob: !!r.blob };
    });
  }).catch(function () { return []; });
}
function downloadSeedSan() {
  if (!isOnline()) return Promise.resolve({ ok: false, reason: 'offline', message: '现在没联网，Seed-san 要联网下载一次；已回落像素猫。' });
  if (typeof fetch === 'undefined') return Promise.resolve({ ok: false, reason: 'no-fetch', message: '当前环境不支持下载，已回落像素猫。' });
  if (!window.XWLDB) return Promise.resolve({ ok: false, reason: 'no-idb', message: '本机没有 IndexedDB，模型存不下来，已回落像素猫。' });
  return fetch(SEED_SAN.url).then(function (res) {
    if (!res.ok) throw new Error('下载失败（HTTP ' + res.status + '）');
    return res.blob();
  }).then(function (blob) {
    if (!blob || blob.size < 1024 * 1024) throw new Error('下载到的文件过小（' + (blob ? blob.size : 0) + ' 字节），可能不是完整模型');
    var sizeMB = Math.round(blob.size / 1024 / 1024 * 10) / 10;
    return window.XWLDB.put('vrm_models', {
      id: SEED_SAN.id, name: SEED_SAN.name, source: 'hanami',
      license: SEED_SAN.license, credit: SEED_SAN.credit, size: blob.size,
      createdAt: Date.now(), blob: blob
    }).then(function () { return { ok: true, id: SEED_SAN.id, sizeMB: sizeMB, size: blob.size }; });
  }).catch(function (e) {
    return { ok: false, reason: 'download-failed', message: 'Seed-san 下载失败：' + (e && e.message || '未知错误') + '，已回落像素猫。' };
  });
}
function importVRMFile(input) {
  var f = input && input.files && input.files[0];
  if (!f) return false;
  try {
    if (window.XWLDB) {
      window.XWLDB.put('vrm_models', {
        id: 'user-' + Date.now().toString(36), name: f.name, source: 'user-import',
        license: '', credit: '', size: f.size, createdAt: Date.now(), blob: f
      });
    }
  } catch (e) {}
  try {
    if (window.GroupP && GroupP.importVRMFile) return GroupP.importVRMFile(input);
  } catch (e) {}
  return false;
}
function vrmState() {
  try { if (window.GroupP && GroupP.vrmState) return window.GroupP.vrmState(); } catch (e) {}
  return { status: 'none' };
}

/* VRM 舞台：待机呼吸眨眼 + 程序化手势 + 口型。手势是程序化骨骼动作，不是 .vrma
   文件（ARPAHLS 的 7 个 VRMA 禁以可重绑定/可提取形式再分发，Hanami 的 Overte .vrma
   也不往单文件里嵌二进制动画；动作名沿用 Hanami“文件名即配置”的约定：idle / greet /
   wave / bow / jump）。口型两种驱动分开标注：系统 TTS 按词边界（GroupP.attachBoundary），
   已播音频按振幅（ARPAHLS 方案：AnalyserNode 读 RMS）。 */
var _vrmStage = { renderer: null, vrm: null, scene: null, canvas: null, raf: 0, modelId: null, gesture: null, gestureStart: 0, nextBlinkAt: 0, blinkUntil: 0, disposed: false };
function _vrmSetExpr(name, v) {
  try {
    var vrm = _vrmStage.vrm;
    if (!vrm) return;
    if (vrm.expressionManager && vrm.expressionManager.setValue) { vrm.expressionManager.setValue(name === 'A' ? 'aa' : name.toLowerCase(), v); return; }
    if (vrm.blendShapeProxy && vrm.blendShapeProxy.setValue) {
      var schema = (window.THREE_VRM && window.THREE_VRM.VRMSchema) || (window.THREE && window.THREE.VRMSchema) || {};
      var preset = schema.BlendShapePresetName || (window.THREE && window.THREE.VRMBlendShapePresetName) || {};
      var key = preset[name] || name;
      vrm.blendShapeProxy.setValue(key, v);
    }
  } catch (e) {}
}
function _vrmBone(name) {
  try {
    var vrm = _vrmStage.vrm;
    if (!vrm || !vrm.humanoid || !vrm.humanoid.getBoneNode) return null;
    var schema = (window.THREE_VRM && window.THREE_VRM.VRMSchema) || (window.THREE && window.THREE.VRMSchema) || {};
    var bones = schema.HumanoidBoneName || {};
    var key = bones[name];
    if (!key) return null;
    return vrm.humanoid.getBoneNode(key);
  } catch (e) { return null; }
}
function disposeVRMStage() {
  _vrmStage.disposed = true;
  try { if (_vrmStage.raf) cancelAnimationFrame(_vrmStage.raf); } catch (e) {}
  _vrmStage.raf = 0;
  try { if (_vrmStage.renderer) _vrmStage.renderer.dispose(); } catch (e) {}
  _vrmStage.renderer = null; _vrmStage.vrm = null; _vrmStage.scene = null; _vrmStage.modelId = null; _vrmStage.gesture = null;
}
function _startVRMStage(canvas, T, gltf, modelId) {
  disposeVRMStage();
  _vrmStage.disposed = false;
  var w = (canvas.clientWidth || 52), h = (canvas.clientHeight || 62);
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    return { ok: false, reason: 'no-webgl', message: '这台设备开不了 WebGL，已回落像素猫。', fallback: 'pixel' };
  }
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(30, w / h, 0.1, 100);
  cam.position.set(0, 1.25, 2.4);
  cam.lookAt(0, 1.0, 0);
  scene.add(new T.AmbientLight(0xffffff, 0.9));
  var key = new T.DirectionalLight(0xffffff, 0.6);
  key.position.set(1, 2, 2);
  scene.add(key);
  var vrm = (gltf && gltf.userData && gltf.userData.vrm) || null;
  var root = gltf.scene;
  try {
    var box = new T.Box3().setFromObject(root);
    var center = box.getCenter(new T.Vector3());
    var size = box.getSize(new T.Vector3());
    var s = 1.5 / Math.max(size.y || 1, 0.001);
    root.scale.setScalar(s);
    root.position.x -= center.x * s;
    root.position.z -= center.z * s;
    root.position.y -= box.min.y * s;
    if (canvas.hasAttribute('data-vnca-canvas')) {
      var aspect = Math.max(w / h, 0.01);
      var fitHeight = Math.max(size.y * s, size.x * s / aspect);
      var distance = fitHeight / (2 * Math.tan(30 * Math.PI / 360)) * 1.12 + size.z * s / 2;
      cam.position.set(0, size.y * s / 2, Math.max(2.4, distance));
      cam.lookAt(0, size.y * s / 2, 0);
    }
  } catch (e) {}
  scene.add(root);
  _vrmStage.renderer = renderer; _vrmStage.vrm = vrm; _vrmStage.scene = root;
  _vrmStage.canvas = canvas; _vrmStage.modelId = modelId;
  _vrmStage.nextBlinkAt = Date.now() + 2400;
  var baseY = root.position.y;
  var baseRotY = root.rotation.y;
  var last = Date.now();
  var tick = function () {
    if (_vrmStage.disposed || !canvas.isConnected) return;
    var now = Date.now();
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var t = now / 1000;
    try {
      if (vrm && vrm.update) vrm.update(dt);
      /* 待机呼吸：全身轻摆 + 轻微上下浮动（Hanami 待机做法的程序化版）。 */
      root.rotation.y = baseRotY + Math.sin(t * 0.4) * 0.06;
      root.position.y = baseY + Math.sin(t * 1.2) * 0.01;
      /* 眨眼：每 2.4–4.8 秒闭眼约 120 毫秒。 */
      if (now >= _vrmStage.nextBlinkAt) { _vrmStage.blinkUntil = now + 120; _vrmStage.nextBlinkAt = now + 2400 + Math.random() * 2400; }
      _vrmSetExpr('Blink', now < _vrmStage.blinkUntil ? 1 : 0);
      /* 手势：1.2 秒正弦包络，播完骨骼归零。 */
      var g = _vrmStage.gesture;
      if (g) {
        var p = (now - _vrmStage.gestureStart) / 1200;
        if (p >= 1) {
          _vrmStage.gesture = null;
          ['RightUpperArm', 'RightLowerArm', 'Spine', 'Head'].forEach(function (bn) {
            var b = _vrmBone(bn);
            if (b) { b.rotation.set(0, 0, 0); }
          });
          root.position.y = baseY + Math.sin(t * 1.2) * 0.01;
        } else {
          var env = Math.sin(Math.PI * p);
          if (g === 'wave') {
            var arm = _vrmBone('RightUpperArm'), fore = _vrmBone('RightLowerArm');
            if (arm) arm.rotation.z = -2.0 * env;
            if (fore) fore.rotation.z = -0.4 * env;
          } else if (g === 'bow') {
            var spine = _vrmBone('Spine');
            if (spine) spine.rotation.x = 0.45 * env;
          } else if (g === 'jump') {
            root.position.y = baseY + 0.25 * Math.sin(Math.PI * p);
          } else if (g === 'greet') {
            var head = _vrmBone('Head'), arm2 = _vrmBone('RightUpperArm');
            if (head) head.rotation.x = 0.2 * env;
            if (arm2) arm2.rotation.z = -0.9 * env;
          }
        }
      }
    } catch (e) {}
    try { renderer.render(scene, cam); } catch (e) {}
    _vrmStage.raf = requestAnimationFrame(tick);
  };
  renderer.render(scene, cam);
  _vrmStage.raf = requestAnimationFrame(tick);
  return { ok: true, mode: 'vrm', model: modelId, animated: !!vrm };
}
function loadVRMInto(canvas, modelId) {
  if (!canvas) return Promise.resolve({ ok: false, reason: 'no-canvas' });
  if (!window.XWLDB) return Promise.resolve({ ok: false, reason: 'no-idb', message: '本机没有 IndexedDB，模型存不下来，已回落像素猫。', fallback: 'pixel' });
  return window.XWLDB.get('vrm_models', modelId).then(function (rec) {
    if (!rec || !rec.blob) return { ok: false, reason: 'no-model', message: '库里没有这个模型文件，先下载 Seed-san 或导入自己的 .vrm。', fallback: 'pixel' };
    var runtime = canvas.hasAttribute('data-vnca-canvas') ? ensureModernVRM().then(function (T) { return T || ensureThree(true); }) : ensureThree(true);
    return runtime.then(function (T) {
      if (!T) return { ok: false, reason: 'three-unavailable', message: 'VRM 运行库没加载上（' + (_threeError || '可能没联网') + '），已回落像素猫。', fallback: 'pixel' };
      return rec.blob.arrayBuffer().then(function (buf) {
        return new Promise(function (resolve) {
          var loader = new T.GLTFLoader();
          var hasPlugin = false;
          if (T.VRMLoaderPlugin && typeof loader.register === 'function') {
            try { loader.register(function (p) { return new T.VRMLoaderPlugin(p); }); hasPlugin = true; } catch (e) {}
          }
          var legacy = window.THREE_VRM && window.THREE_VRM.VRM;
          if (!hasPlugin && !(legacy && typeof legacy.from === 'function')) { resolve({ ok: false, reason: 'no-vrm-plugin', message: '运行库里没有 VRM 解析器，已回落像素猫。', fallback: 'pixel' }); return; }
          loader.parse(buf, '', function (gltf) {
            var converted = hasPlugin ? Promise.resolve(gltf.userData && gltf.userData.vrm) : legacy.from(gltf);
            Promise.resolve(converted).then(function (vrm) {
              if (!vrm) throw new Error('文件不包含可识别的 VRM 模型');
              if (!canvas.isConnected || canvas._vncaDiscarded) { resolve({ ok: false, reason: 'cancelled' }); return; }
              if (T.VRMUtils && T.VRMUtils.rotateVRM0) T.VRMUtils.rotateVRM0(vrm);
              gltf.userData = gltf.userData || {};
              gltf.userData.vrm = vrm;
              resolve(_startVRMStage(canvas, T, gltf, modelId));
            }).catch(function (e) { resolve({ ok: false, reason: 'render-failed', message: 'VRM 渲染失败：' + (e.message || '未知错误') + '，已回落图片立绘。', fallback: 'pixel' }); });
          }, function () { resolve({ ok: false, reason: 'parse-failed', message: '模型解析失败，已回落像素猫。', fallback: 'pixel' }); });
        });
      });
    });
  }).catch(function (e) {
    return { ok: false, reason: 'load-failed', message: 'VRM 加载失败：' + ((e && e.message) || '未知错误') + '，已回落像素猫。', fallback: 'pixel' };
  });
}
function gesture(name) {
  if (_vrmStage.gesture) return { ok: false, reason: 'busy' };
  if (!_vrmStage.vrm || !_vrmStage.renderer) return { ok: false, reason: 'no-vrm', message: '先开 3D 桌宠再做手势（现在是像素猫）。' };
  if (['wave', 'bow', 'jump', 'greet'].indexOf(name) < 0) return { ok: false, reason: 'bad-gesture' };
  _vrmStage.gesture = name;
  _vrmStage.gestureStart = Date.now();
  return { ok: true, gesture: name };
}
function speakTest(text) {
  try {
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return { ok: false, reason: 'no-tts' };
    var u = new SpeechSynthesisUtterance(text || '你好呀，我是桌宠，今天也要一起加油。');
    u.lang = 'zh-CN';
    try { if (window.GroupP && GroupP.attachBoundary) GroupP.attachBoundary(u); } catch (e) {}
    /* TTS 词边界 → 口型张合：有 VRM 时驱动口型 blendshape，同时保留 P 组的 talking 标记。 */
    var prevBoundary = u.onboundary;
    u.onboundary = function (ev) {
      _vrmSetExpr('A', 0.7);
      setTimeout(function () { _vrmSetExpr('A', 0.15); }, 180);
      if (prevBoundary) { try { prevBoundary(ev); } catch (e) {} }
    };
    var prevEnd = u.onend;
    u.onend = function (ev) {
      _vrmSetExpr('A', 0);
      if (prevEnd) { try { prevEnd(ev); } catch (e) {} }
    };
    window.speechSynthesis.speak(u);
    return { ok: true, mode: 'tts-boundary' };
  } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
}
function attachAudioLipsync(audioEl) {
  /* 已播音频按振幅（ARPAHLS 方案）：有 VRM 时本组直接读 AnalyserNode 的 RMS 推口型；
     没 VRM 时交给 P 组已有的 startAudioLipsync（同样是振幅驱动 talking 标记）。 */
  if (!audioEl) return false;
  if (_vrmStage.vrm) {
    try {
      if (audioEl._grouppetLipsync) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      var ctx = new AC();
      var src = ctx.createMediaElementSource(audioEl);
      var an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an); an.connect(ctx.destination);
      var data = new Uint8Array(an.fftSize);
      var loop = function () {
        try {
          if (audioEl.paused || audioEl.ended) { _vrmSetExpr('A', 0); return; }
          an.getByteTimeDomainData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
          var lvl = Math.sqrt(sum / data.length);
          _vrmSetExpr('A', Math.min(1, lvl * 6));
        } catch (e) {}
        if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
      };
      audioEl._grouppetLipsync = true;
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
      return true;
    } catch (e) { return false; }
  }
  try { if (window.GroupP && GroupP.startAudioLipsync) return GroupP.startAudioLipsync(audioEl); } catch (e) {}
  return false;
}
function isDesktopVRMOn() {
  try { return (readPrefs() || {}).pet3d === true; } catch (e) { return false; }
}
function setDesktopVRM(on) {
  var el = document.getElementById('desk-pet');
  if (!el) return Promise.resolve({ ok: false, reason: 'no-pet-el' });
  injectCSS();
  if (!on) {
    el.classList.remove('grouppet-vrm-on');
    disposeVRMStage();
    writePrefs({ pet3d: false });
    return Promise.resolve({ ok: true, mode: 'pixel' });
  }
  var cv = document.getElementById('grouppet-vrm-canvas');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'grouppet-vrm-canvas';
    el.appendChild(cv);
  }
  el.classList.add('grouppet-vrm-on');
  return listStoredModels().then(function (list) {
    var pick = null;
    list.forEach(function (m) { if (m.id === 'seed-san') pick = m; });
    if (!pick && list.length) pick = list[0];
    if (!pick) {
      el.classList.remove('grouppet-vrm-on');
      return { ok: false, reason: 'no-model', message: '还没下载 Seed-san，也没导入过 .vrm；先下载或导入一个模型。', fallback: 'pixel' };
    }
    return loadVRMInto(cv, pick.id).then(function (r) {
      if (!r.ok) { el.classList.remove('grouppet-vrm-on'); disposeVRMStage(); }
      else writePrefs({ pet3d: true });
      return r;
    });
  });
}

/* ── 4. 折叠数学（unfold 思路，自己重写；纯函数，可单测） ──
   第一折：书页绕书脊扇形展开。正对的房间永远张开 90°；剩下半圆（90°）由其余房间分，
   离得越近分得越多——权重 1/距离，按权重比例分。翻房间就是把 90° 换给另一个房间。
   第二折：地面是沿对角线对折的正方形。墙夹角 θ、页宽 L 时，折线尖端离书脊 L/cos(θ/2)，
   高度 √(2L² − (L/cos(θ/2))²)；θ=90° 时高度 0（平铺），θ=0 时高度 L（直立）。
   第三折：家具是立在地面上的平面纸卡；只有房间完全打开时纸卡才立起来，折叠就躺平。 */
function pageAngles(n, focus) {
  var angles = [];
  if (n <= 0) return angles;
  if (n === 1) { angles.push(90); return angles; }
  var weights = [];
  var total = 0;
  for (var i = 0; i < n; i++) {
    if (i === focus) { weights.push(0); continue; }
    var w = 1 / Math.abs(i - focus);
    weights.push(w);
    total += w;
  }
  for (var j = 0; j < n; j++) {
    if (j === focus) angles.push(90);
    else angles.push(90 * weights[j] / total);
  }
  return angles;
}
function pageRotations(n, focus) {
  var angles = pageAngles(n, focus);
  var rots = [];
  for (var i = 0; i < n; i++) {
    if (i === focus) { rots.push(0); continue; }
    var acc = angles[focus] / 2 + angles[i] / 2;
    var step = i > focus ? 1 : -1;
    var k = i > focus ? focus + 1 : focus - 1;
    while ((step > 0 && k < i) || (step < 0 && k > i)) { acc += angles[k]; k += step; }
    rots.push((i > focus ? acc : -acc) * Math.PI / 180);
  }
  return rots;
}
function floorApex(L, thetaDeg) {
  var half = thetaDeg * Math.PI / 360;
  var dist = L / Math.cos(half);
  var h2 = 2 * L * L - dist * dist;
  return { dist: dist, height: Math.sqrt(Math.max(0, h2)) };
}
function defaultRooms() {
  try {
    if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine._otomeRooms) {
      var rs = WeChatAppEngine._otomeRooms();
      if (rs && rs.length) return rs;
    }
  } catch (e) {}
  /* 与 openOtomeHome 渲染段同一张房间表（客厅/卧室/厨房/阳台）；拿不到 _otomeRooms 时的兜底，不新编房间。 */
  return [
    { id: 'living', name: '客厅', en: 'LIVING', cls: 'ot-room-living', furn: [{ id: 'sofa', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V11"/><path d="M3.5 13a2 2 0 0 1 4 0v1h9v-1a2 2 0 0 1 4 0v2.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V13Z"/><path d="M7 19.5v1.5m10-1.5v1.5"/></svg>', label: '坐下' }, { id: 'tea', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-6Zm12 1h1.5a3 3 0 0 1 0 6h-1.8M7 4.5c0 1 .8 1.3.8 2.3m3-2.3c0 1 .8 1.3.8 2.3M4 21h14"/></svg>', label: '喝茶' }, { id: 'books', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.2-.9 5.9-.3 8 1.5 2.1-1.8 4.8-2.4 8-1.5v14c-3.2-.8-5.9-.2-8 1.5-2.1-1.7-4.8-2.3-8-1.5Z"/><path d="M12 7v14m-5-12h2m6 0h2"/></svg>', label: '看书' }] },
    { id: 'bed', name: '卧室', en: 'BEDROOM', cls: 'ot-room-bed', furn: [{ id: 'bed', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V6.5M4 13.5h16V18M4 18v1.5m16-1.5v1.5"/><path d="M4 13.5v-2a2 2 0 0 1 2-2h6a3.5 3.5 0 0 1 3.5 3.5"/></svg>', label: '休息' }, { id: 'wardrobe', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M9.5 11h.01M14.5 11h.01"/></svg>', label: '换装' }, { id: 'lamp', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16c0-2-3-3.2-3-7a7 7 0 0 1 14 0c0 3.8-3 5-3 7Zm1 2h6m-5 3h4"/></svg>', label: '台灯' }] },
    { id: 'kitchen', name: '厨房', en: 'KITCHEN', cls: 'ot-room-kitchen', furn: [{ id: 'stove', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="12" rx="1.5"/><circle cx="9" cy="14.5" r="2"/><circle cx="15" cy="14.5" r="2"/><path d="M8 5.5h.01M12 5.5h.01M16 5.5h.01"/></svg>', label: '做饭' }, { id: 'fridge', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M7 10.5h10M14 5.5v3M14 13.5v3"/></svg>', label: '冰箱' }, { id: 'table', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h17M5.5 9v11M18.5 9v11M5.5 14.5h13"/></svg>', label: '餐桌' }] },
    { id: 'balcony', name: '阳台', en: 'BALCONY', cls: 'ot-room-balcony', furn: [{ id: 'flower', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c-4.5-1-5.3-4.2-3.2-5.3 1.5-.8 3.1.4 3.2 3.3.1-2.9 1.7-4.1 3.2-3.3 2.1 1.1 1.3 4.3-3.2 5.3 4.5-1 6.2 1.8 4.3 3.5-1.3 1.2-3.2.4-4.3-2.4 1.1 2.8.2 4.6-1.6 4.4-2.4-.2-3-3.4 1.6-6.2-4.6 2.8-7.1.7-5.8-1.5 1-1.6 3-.9 5.8 1.5Z"/><circle cx="12" cy="12" r="2"/></svg>', label: '浇花' }, { id: 'chair', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v8m0 0h8v2.5H8M8 13.5V18m8-4.5V18"/><path d="M4.5 20c2.5 1.2 5 1.8 7.5 1.8s5-.6 7.5-1.8"/></svg>', label: '摇椅' }, { id: 'scope', ico: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 19.5 12 11"/><path d="m12 11 5-5 3.5 3.5-5 5"/><path d="M7 21l-2.5-4M12 21l-1-4M17 21l-3.5-4"/></svg>', label: '看风景' }] }
  ];
}
var ROOM_COLORS = { living: 0xf6d9c4, bed: 0xdfe8f5, kitchen: 0xf9eec8, balcony: 0xd8ecdd };
var _homeHandle = null;
function renderOtomeHome3D(container, home, opts) {
  opts = opts || {};
  home = home || {};
  var rooms = (opts.rooms && opts.rooms.length) ? opts.rooms : defaultRooms();
  var focusIdx = 0;
  rooms.forEach(function (r, i) { if (r.id === (home.lastRoom || 'living')) focusIdx = i; });
  if (!container) return Promise.resolve({ ok: false, reason: 'no-container', mode: 'css3d', fallback: 'css3d' });
  return ensureThree(false).then(function (T) {
    if (!T) return { ok: false, reason: 'three-unavailable', mode: 'css3d', fallback: 'css3d', message: '没联网或 three.js 没加载上（' + (_threeError || '未知原因') + '），乙游家仍用原来的 CSS 3D。' };
    try { return buildHome3D(container, T, rooms, focusIdx, home, opts); }
    catch (e) { return { ok: false, reason: 'build-failed', mode: 'css3d', fallback: 'css3d', message: '3D 家搭建失败：' + (e.message || '未知错误') + '，仍用原来的 CSS 3D。' }; }
  });
}
function buildHome3D(host, T, rooms, focusIdx, home, opts) {
  var W = host.clientWidth || 320, H = host.clientHeight || 220;
  var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(45, W / H, 0.1, 100);
  cam.position.set(0, 2.4, 3.8);
  cam.lookAt(0.4, 0.2, 0);
  scene.add(new T.AmbientLight(0xffffff, 0.85));
  var sun = new T.DirectionalLight(0xfff2dd, 0.7);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  var world = new T.Group();
  scene.add(world);
  var L = 1.2;
  /* 书底（与 .ot-book-base 同一配色）。 */
  var base = new T.Mesh(new T.BoxGeometry(2.6, 0.07, 1.5), new T.MeshLambertMaterial({ color: 0xc89a6a }));
  base.position.set(0.6, -0.05, 0);
  world.add(base);
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var roomGroups = [];
  var hash = function (s) { var h = 0; for (var i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0; return h; };
  rooms.forEach(function (room, i) {
    var g = new T.Group();
    var color = ROOM_COLORS[room.id] || 0xf6d9c4;
    var floorMat = new T.MeshLambertMaterial({ color: color });
    var floor = new T.Mesh(new T.PlaneGeometry(L, L), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(L / 2, 0.01, 0);
    g.add(floor);
    var wall = new T.Mesh(new T.PlaneGeometry(L, 0.8), new T.MeshLambertMaterial({ color: color }));
    wall.rotation.y = -Math.PI / 2;
    wall.position.set(L, 0.4, 0);
    g.add(wall);
    var cards = [];
    (room.furn || []).forEach(function (f, fi) {
      var card = new T.Mesh(new T.PlaneGeometry(0.24, 0.32), new T.MeshBasicMaterial({ color: 0xfffdf8, side: T.DoubleSide }));
      card.position.set(0.3 + (hash(f.id) % 3) * 0.3, 0.17, -0.35 + (hash(f.id + 'z') % 3) * 0.3);
      card.rotation.y = (hash(f.id) % 5 - 2) * 0.2;
      card.userData.standing = true;
      g.add(card);
      cards.push(card);
    });
    g.userData = { room: room, floor: floor, cards: cards };
    world.add(g);
    roomGroups.push(g);
  });
  /* 共享宠：3D 家里的猫就是桌宠那只（otome_home_v1.pet），不是第二只；这里只是它在 3D 家里的位置标记。 */
  if (home.pet) {
    var petMark = new T.Group();
    var body = new T.Mesh(new T.ConeGeometry(0.09, 0.16, 12), new T.MeshLambertMaterial({ color: 0xd97b29 }));
    body.position.y = 0.08;
    var head = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), new T.MeshLambertMaterial({ color: 0xd97b29 }));
    head.position.y = 0.2;
    petMark.add(body); petMark.add(head);
    petMark.position.set(0.7, 0.01, 0.25);
    world.add(petMark);
  }
  var focus = focusIdx;
  var applyFocus = function (idx) {
    focus = idx;
    var angles = pageAngles(rooms.length, focus);
    var rots = pageRotations(rooms.length, focus);
    roomGroups.forEach(function (g, i) {
      g.rotation.y = rots[i];
      var apex = floorApex(L, angles[i]);
      var tilt = Math.atan2(apex.height, Math.max(apex.dist, 0.001));
      g.userData.floor.rotation.z = tilt;
      var open = (i === focus);
      g.userData.cards.forEach(function (card) {
        if (open) { card.rotation.x = 0; card.position.y = 0.17; }
        else { card.rotation.x = -Math.PI / 2; card.position.y = 0.03; }
      });
    });
    return { angles: angles, focus: focus };
  };
  var state = applyFocus(focusIdx);
  var raf = 0;
  var disposed = false;
  var viewRot = 0;
  var downX = null, downMoved = 0;
  var onDown = function (e) { downX = e.clientX; downMoved = 0; };
  var onMove = function (e) {
    if (downX === null) return;
    var dx = e.clientX - downX;
    downMoved = Math.max(downMoved, Math.abs(dx));
    viewRot = Math.max(-1.0, Math.min(1.0, viewRot + dx * 0.004));
    downX = e.clientX;
  };
  var onUp = function () {
    if (downX !== null && downMoved < 6) {
      var next = (focus + 1) % rooms.length;
      state = applyFocus(next);
      try { if (home) { home.lastRoom = rooms[next].id; } } catch (e) {}
    }
    downX = null;
  };
  try {
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);
  } catch (e) {}
  var last = Date.now();
  var loop = function () {
    if (disposed || !host.isConnected) return;
    var now = Date.now();
    var t = now / 1000;
    world.rotation.y = viewRot + (reduced ? 0 : Math.sin(t * 0.3) * 0.02);
    try { renderer.render(scene, cam); } catch (e) {}
    raf = requestAnimationFrame(loop);
  };
  renderer.render(scene, cam);
  if (!reduced) raf = requestAnimationFrame(loop);
  else raf = 0;
  var handle = {
    ok: true, mode: 'three', rooms: rooms, angles: state.angles, focus: focus,
    focusRoom: function () { return rooms[focus]; },
    setFocus: function (idx) {
      if (idx < 0 || idx >= rooms.length) return { ok: false, reason: 'bad-room' };
      state = applyFocus(idx);
      handle.angles = state.angles; handle.focus = focus;
      return { ok: true, focus: focus, room: rooms[focus].id };
    },
    loadGLB: function (roomId) { return loadRoomGLB(roomId, handle, T, roomGroups, rooms); },
    dispose: function () {
      disposed = true;
      try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
      try { host.removeEventListener('pointerdown', onDown); } catch (e) {}
      try { host.removeEventListener('pointermove', onMove); } catch (e) {}
      try { host.removeEventListener('pointerup', onUp); } catch (e) {}
      try { host.removeEventListener('pointercancel', onUp); } catch (e) {}
      try { renderer.dispose(); } catch (e) {}
      try { if (renderer.domElement && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement); } catch (e) {}
      if (_homeHandle === handle) _homeHandle = null;
    }
  };
  _homeHandle = handle;
  return handle;
}
function loadRoomGLB(roomId, handle, T, roomGroups, rooms) {
  var entry = null;
  ROOMS.forEach(function (r) { if (r.id === roomId) entry = r; });
  if (!entry) return Promise.resolve({ ok: false, reason: 'bad-room', message: '没有这个房间。' });
  if (!entry.selectable) return Promise.resolve({ ok: false, reason: 'not-verified', message: '「' + entry.title + '」的署名/大小还没核实完，暂不提供；先用已核实的 4 间。' });
  if (!handle || !T) return Promise.resolve({ ok: false, reason: 'no-home', message: '先预览乙游 3D 家，再换 .glb 房间。' });
  if (!isOnline()) return Promise.resolve({ ok: false, reason: 'offline', message: '现在没联网，.glb 房间要联网加载；已保留原来的程序化房间。' });
  if (entry.size > ROOM_SIZE_LIMIT) return Promise.resolve({ ok: false, reason: 'too-large', message: '「' + entry.title + '」约 ' + Math.round(entry.size / 1024 / 1024) + ' MB，超过 25 MB 上限，不加载。' });
  var warn = entry.size > ROOM_SIZE_WARN ? '（约 ' + Math.round(entry.size / 1024 / 1024) + ' MB，加载可能慢）' : '';
  var url = CDN.roomBase + entry.file;
  var sizeCheck = Promise.resolve(true);
  try {
    sizeCheck = fetch(url, { method: 'HEAD' }).then(function (res) {
      var len = res.headers ? res.headers.get('content-length') : null;
      if (len && Number(len) > ROOM_SIZE_LIMIT) throw new Error('too-large');
      return true;
    }).catch(function (e) {
      if (e && e.message === 'too-large') throw e;
      return true;
    });
  } catch (e) { sizeCheck = Promise.resolve(true); }
  return sizeCheck.then(function () {
    return new Promise(function (resolve) {
      var loader = new T.GLTFLoader();
      loader.load(url, function (gltf) {
        try {
          var idx = -1;
          rooms.forEach(function (r, i) { if (r.id === roomId) idx = i; });
          var target = idx >= 0 ? roomGroups[idx] : null;
          if (target) {
            while (target.children.length) target.remove(target.children[0]);
            gltf.scene.scale.setScalar(0.5);
            gltf.scene.position.set(0.6, 0, 0);
            target.add(gltf.scene);
          }
          resolve({ ok: true, id: roomId, title: entry.title, author: entry.author, size: entry.size, warn: warn });
        } catch (e) { resolve({ ok: false, reason: 'add-failed', message: '房间加上去了但摆不进场景，已保留原来的房间。' }); }
      }, undefined, function () {
        resolve({ ok: false, reason: 'load-failed', message: '「' + entry.title + '」加载失败，已保留原来的程序化房间。' });
      });
    });
  }).catch(function () {
    return { ok: false, reason: 'too-large', message: '「' + entry.title + '」超过 25 MB 上限，不加载。' };
  });
}

/* ── 5. 阅读 3D 书架（真 three.js；原来是 CSS 3D 近似——perspective + rotateX/Y 的 DOM 面片）。
   输入与原 Controller.renderShelf 一致：books = NovelStore.books（{id, title, author, color}，
   封面图不直接当纹理用，只取 color + 标题文字画 CanvasTexture）。离线/无 three.js 时返回
   {ok:false, fallback:'css3d'}，调用方保留原来的 CSS 书架，不动原实现。 */
function renderNovelShelf3D(container, books, opts) {
  opts = opts || {};
  books = books || [];
  if (!container) return Promise.resolve({ ok: false, reason: 'no-container', fallback: 'css3d' });
  if (!books.length) return Promise.resolve({ ok: false, reason: 'no-books', message: '书架还是空的，先放一本书进来。', fallback: 'css3d' });
  return ensureThree(false).then(function (T) {
    if (!T) return { ok: false, reason: 'three-unavailable', fallback: 'css3d', message: '没联网或 three.js 没加载上（' + (_threeError || '未知原因') + '），仍用原来的 CSS 3D 书架。' };
    try { return buildShelf3D(container, T, books, opts); }
    catch (e) { return { ok: false, reason: 'build-failed', fallback: 'css3d', message: '3D 书架搭建失败：' + (e.message || '未知错误') + '，仍用原来的 CSS 3D 书架。' }; }
  });
}
function buildShelf3D(host, T, books, opts) {
  var W = host.clientWidth || 320, H = host.clientHeight || 200;
  var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(42, W / H, 0.1, 100);
  cam.position.set(0, 0.6, 4.2);
  cam.lookAt(0, 0.4, 0);
  scene.add(new T.AmbientLight(0xffffff, 0.85));
  var lamp = new T.DirectionalLight(0xfff2dd, 0.7);
  lamp.position.set(1, 3, 2);
  scene.add(lamp);
  var world = new T.Group();
  scene.add(world);
  var board = new T.Mesh(new T.BoxGeometry(7.5, 0.16, 1.0), new T.MeshLambertMaterial({ color: 0x8a6a45 }));
  board.position.set(0, -0.5, 0);
  world.add(board);
  var titleTexture = function (book) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 192;
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = book.color || '#c96f4a';
    ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    var title = String(book.title || '未命名');
    var lines = [];
    var cur = '';
    for (var i = 0; i < title.length; i++) {
      cur += title[i];
      if (cur.length >= 6) { lines.push(cur); cur = ''; }
    }
    if (cur) lines.push(cur);
    lines.slice(0, 4).forEach(function (ln, li) { ctx.fillText(ln, 64, 84 + li * 20); });
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    if (book.author) ctx.fillText(String(book.author).slice(0, 12), 64, 168);
    var tex = new T.CanvasTexture(cv);
    return tex;
  };
  var bookMeshes = [];
  books.forEach(function (book, i) {
    var tex = titleTexture(book);
    var mats = [];
    var edge = new T.MeshLambertMaterial({ color: 0xf4f1e6 });
    var cover = tex ? new T.MeshBasicMaterial({ map: tex }) : new T.MeshLambertMaterial({ color: new T.Color(book.color || '#c96f4a') });
    var spine = new T.MeshLambertMaterial({ color: new T.Color(book.color || '#c96f4a') });
    mats = [edge, spine, edge, edge, cover, spine];
    var mesh = new T.Mesh(new T.BoxGeometry(0.62, 0.92, 0.16), mats);
    mesh.userData.book = book;
    mesh.userData.index = i;
    world.add(mesh);
    bookMeshes.push(mesh);
  });
  var pos = 0;
  var focus = 0;
  var layout = function () {
    bookMeshes.forEach(function (mesh, i) {
      var d = i - pos;
      mesh.position.set(d * 0.68, 0.05, -Math.abs(d) * 0.28);
      mesh.rotation.y = Math.max(-0.9, Math.min(0.9, d * -0.32));
      mesh.scale.setScalar(1 + Math.max(0, 1 - Math.abs(d) * 2) * 0.1);
    });
  };
  layout();
  var raf = 0;
  var disposed = false;
  var drag = null;
  var onDown = function (e) { drag = { x: e.clientX, pos: pos, moved: 0 }; };
  var onMove = function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    pos = Math.max(0, Math.min(books.length - 1, drag.pos - dx / 64));
    layout();
  };
  var onUp = function (e) {
    if (!drag) return;
    var moved = drag.moved;
    drag = null;
    focus = Math.round(pos);
    pos = focus;
    layout();
    if (moved <= 8 && opts.onOpen) {
      var b = books[focus];
      if (b) { try { opts.onOpen(b); } catch (err) {} }
    }
  };
  try {
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);
  } catch (e) {}
  var loop = function () {
    if (disposed || !host.isConnected) return;
    try { renderer.render(scene, cam); } catch (e) {}
    raf = requestAnimationFrame(loop);
  };
  renderer.render(scene, cam);
  raf = requestAnimationFrame(loop);
  return {
    ok: true, mode: 'three', count: books.length,
    focus: function () { return books[focus]; },
    setFocus: function (idx) {
      if (idx < 0 || idx >= books.length) return { ok: false, reason: 'bad-index' };
      focus = idx; pos = idx; layout();
      return { ok: true, focus: focus };
    },
    dispose: function () {
      disposed = true;
      try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
      try { host.removeEventListener('pointerdown', onDown); } catch (e) {}
      try { host.removeEventListener('pointermove', onMove); } catch (e) {}
      try { host.removeEventListener('pointerup', onUp); } catch (e) {}
      try { host.removeEventListener('pointercancel', onUp); } catch (e) {}
      try { renderer.dispose(); } catch (e) {}
      try { if (renderer.domElement && renderer.domElement.parentNode === host) host.removeChild(renderer.domElement); } catch (e) {}
    }
  };
}

/* ── 6. 开机：3D 桌宠只在用户开过开关时才尝试恢复；失败就静静回像素猫，不弹错 ── */
function bootRestore() {
  try {
    if (!isDesktopVRMOn()) return;
    setTimeout(function () {
      try {
        listStoredModels().then(function (list) {
          if (!list.length) return;
          setDesktopVRM(true).catch(function () {});
        });
      } catch (e) {}
    }, 1500);
  } catch (e) {}
}
injectCSS();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootRestore);
else bootRestore();

window.GroupPET = {
  version: 'GroupPET-v1',
  MARKET: MARKET,
  SEED_SAN: SEED_SAN, ROOMS: ROOMS, CDN: CDN, VERSION_NOTE: VERSION_NOTE,
  previewInto: drawMarketPreview, adopt: adopt, currentModel: currentModel,
  ensureThree: ensureThree, threeError: threeError,
  listStoredModels: listStoredModels, downloadSeedSan: downloadSeedSan,
  importVRMFile: importVRMFile, vrmState: vrmState,
  loadVRMInto: loadVRMInto, gesture: gesture, speakTest: speakTest,
  attachAudioLipsync: attachAudioLipsync,
  isDesktopVRMOn: isDesktopVRMOn, setDesktopVRM: setDesktopVRM, disposeVRMStage: disposeVRMStage,
  fold: { pageAngles: pageAngles, pageRotations: pageRotations, floorApex: floorApex },
  defaultRooms: defaultRooms,
  renderOtomeHome3D: renderOtomeHome3D, loadRoomGLB: loadRoomGLB,
  renderNovelShelf3D: renderNovelShelf3D
};
})();
