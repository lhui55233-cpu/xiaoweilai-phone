
// ══════════════════════════════════════════════════════════════════════
// P组 · YuriOS 置物架/自拍/眼睛/角色卡工作室 + avatar 嘴型/动作台/场景/VRM/跟音乐动（GROUP-P-YURIOS-AVATAR）
// 出处（只借鉴做法，全部为本组原创代码，未复制以下项目的任何代码）：
//  · YuriOS https://github.com/yuri-os/YuriOS（Apache-2.0）：置物架（丢文档给她读、显示读到哪、
//    可暂停/停止、读完留批注）、相机（按场景模板拍自拍）、眼睛（看照片说话、照片默认不存记忆）、
//    角色卡（导入 SillyTavern V2/V3 卡默认禁用、看过再启用、导出成卡）。
//  · avatar https://github.com/ARPAHLS/avatar（MIT）：嘴型同步（实时音频驱动）、动作台（一键单次动作）、
//    场景可换、VRM 模型导入预览、设置持久化。
// 新增键（只新增，不改旧键）：groupp_shelf_v1（置物架阅读进度）、char_stage_v1（舞台场景）、
//   char_imported_v1（PNG 导入的角色卡，默认禁用）、groupp_photo_saved_v1（已存成记忆的照片消息 id）、
//   groupp_vrm_v1（VRM 导入状态）。
// 只读复用：novel_store_v1（书架书籍）、novel_annotations_v1（批注，char 批注 author 标 char）、
//   cike_char_look_v1（换装发色瞳色）、otome_custom_char_v1（抠图人物）、
//   phone_album_local_v1（相册 app：照片“存成记忆”的去向；不点就不存）。
// 诚实边界：VRM 只是预览/展示，不替换已有全部功能；嘴型两种驱动不一样，见设置里面说明。
// ══════════════════════════════════════════════════════════════════════
(function () {
'use strict';
var SHELF_KEY = 'groupp_shelf_v1';
var STAGE_KEY = 'char_stage_v1';
var IMPORT_KEY = 'char_imported_v1';
var PHOTO_SAVED_KEY = 'groupp_photo_saved_v1';
var VRM_KEY = 'groupp_vrm_v1';
var ALBUM_KEY = 'phone_album_local_v1';
var NOVEL_STORE_KEY = 'novel_store_v1';
var ANNOT_KEY = 'novel_annotations_v1';
var LOOK_KEY = 'cike_char_look_v1';
var CUSTOM_KEY = 'otome_custom_char_v1';
var CFG = { photoDelay: 1600, shelfStep: 1800, motionMs: 1500, vrmTimeout: 15000 };
var _shelfTimer = null;
var _motionTimer = null;
var _talkTimer = null;
var _musicAnalyser = null;
var _musicCtx = null;
var _musicLoopOn = false;
var _musicLevel = 0;
var _vrmState = null;

// ── 全局解析：AppRegistry / WeChatAppEngine 是顶层 const/let，不在 window 上，
//    只能用裸引用（同一全局词法环境）或 window 回退；直接读 window.AppRegistry 会是 undefined。──
function _appReg() { try { if (typeof AppRegistry !== 'undefined' && AppRegistry) return AppRegistry; } catch (e) {} try { return (typeof window !== 'undefined' && window.AppRegistry) || null; } catch (e) { return null; } }
function _wxEng() { try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine) return WeChatAppEngine; } catch (e) {} try { return (typeof window !== 'undefined' && window.WeChatAppEngine) || null; } catch (e) { return null; } }
function _wxStore() { try { var _ar = _appReg(); var w = _ar && _ar['wechat'] && _ar['wechat'].wxStore; return w || null; } catch (e) { return null; } }

function _read(k, fb) { try { var v = localStorage.getItem(k); if (v == null) return fb; return JSON.parse(v); } catch (e) { return fb; } }
function _write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _isHex(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }
function _bytesToString(bytes) {
  try { if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes); } catch (e) {}
  var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s;
}
function _utf8Bytes(str) {
  try { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(str)); } catch (e) {}
  var s = unescape(encodeURIComponent(String(str))); var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
}
function _b64encode(bytes) {
  var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return window.btoa(bin);
}
function _b64decode(str) {
  try {
    var bin = window.atob(String(str).replace(/\s+/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) { return null; }
}
function _crc32(bytes) {
  var t = _crc32._t;
  if (!t) {
    t = _crc32._t = [];
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = t[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function _be32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

// ── 换装（只读 cike_char_look_v1，与此刻/乙游互通） ──
function loadLook() {
  var v = _read(LOOK_KEY, null);
  if (v && _isHex(v.hair) && _isHex(v.eye)) return { hair: v.hair, eye: v.eye };
  return { hair: '#3a2a1e', eye: '#2b2b2b' };
}
function activeCustomChar() {
  try {
    var d = _read(CUSTOM_KEY, null);
    if (!d || !Array.isArray(d.chars)) return null;
    for (var i = 0; i < d.chars.length; i++) if (d.chars[i].id === d.activeId) return d.chars[i];
    return null;
  } catch (e) { return null; }
}
function charName() {
  try { var _w0 = _wxEng(); if (_w0 && _w0._otomeCharName) { var n = _w0._otomeCharName(); if (n) return n; } } catch (e) {}
  try {
    var sess = currentSession();
    if (sess && sess.name) return sess.name;
  } catch (e) {}
  return '机';
}
function currentSession() {
  try {
    var store = _wxStore();
    if (!store) return null;
    var list = store.sessions || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === store.currentChatId) return list[i];
    return null;
  } catch (e) { return null; }
}
function _persistWx() {
  try {
    var store = _wxStore();
    if (store && typeof store._persist === 'function') store._persist();
  } catch (e) {}
}
function _renderWx() {
  try { var _w = _wxEng(); if (_w && _w.renderUpdates) _w.renderUpdates(); } catch (e) {}
}
function pushCharMsg(sess, type, content, url) {
  if (!sess) return null;
  var msg = { id: 'gp_' + Date.now() + '_' + Math.floor(Math.random() * 1000), sender: sess.name, type: type, time: '刚刚' };
  if (type === 'image') msg.url = url; else msg.content = content;
  if (!sess.messages) sess.messages = [];
  sess.messages.push(msg);
  if (type === 'image') sess.preview = '[图片]'; else sess.preview = String(content || '').slice(0, 20);
  sess.lastTime = '刚刚';
  _persistWx();
  _renderWx();
  return msg;
}

// ══════════════════════════════════════════════════════════════════════
// 1. 置物架：阅读 app 里丢 txt 给 char 读（YuriOS 架子做法；M 组已把小说改名“阅读”，这里不动标题）
//    复用 H 组 txt 导入：finishImport 后 shelfOffer() 记下最新一本；
//    内容只读 novel_store_v1；批注复用 novel_annotations_v1 结构 + author:'char'。
//    M 组合进来的共读渲染已会把 author 为 char 的批注放进蓝色气泡（显示 note），
//    所以这里只写数据、不动渲染；note 放正文，aiReply 同文留作旧渲染兜底。
// ══════════════════════════════════════════════════════════════════════
function readNovelBooks() {
  var d = _read(NOVEL_STORE_KEY, null);
  if (d && Array.isArray(d.books)) return d.books;
  return [];
}
function splitParas(text) {
  var lines = String(text || '').split(/\r?\n/);
  var out = [];
  lines.forEach(function (ln) {
    var t = String(ln || '').trim();
    if (!t) return;
    while (t.length > 200) { out.push(t.slice(0, 200)); t = t.slice(200); }
    if (t) out.push(t);
  });
  return out;
}
function shelfState() { return _read(SHELF_KEY, null); }
function shelfOffer() {
  var books = readNovelBooks();
  if (!books.length) return null;
  var b = books[0];
  var st = { bookId: b.id, title: b.title || '未命名', paraIdx: 0, total: splitParas(b.content || '').length, status: 'offered', updatedAt: Date.now() };
  _write(SHELF_KEY, st);
  refreshShelfBar();
  return st;
}
function shelfBarHtml(books) {
  var st = shelfState();
  if (!st || !st.bookId) return '';
  var list = books || readNovelBooks();
  var book = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === st.bookId) { book = list[i]; break; }
  if (!book) return '';
  var paras = splitParas(book.content || '');
  var total = paras.length || st.total || 0;
  var idx = Math.max(0, Math.min(st.paraIdx || 0, Math.max(0, total - 1)));
  var pct = total ? Math.round((st.status === 'done' ? total : idx) / total * 100) : 0;
  var cur = (st.status === 'reading' || st.status === 'paused') ? (paras[idx] || '') : '';
  var btns = '';
  if (st.status === 'offered' || st.status === 'idle') {
    btns = "<button type=\"button\" class=\"groupp-btn\" onclick=\"window.GroupP.shelfStart('" + st.bookId + "')\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l11-6.5Z\"/></svg> 让 char 读这本</button>";
  } else if (st.status === 'reading') {
    btns = "<button type=\"button\" class=\"groupp-btn\" onclick=\"window.GroupP.shelfPause()\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 5v14M15 5v14\"/></svg> 暂停</button> <button type=\"button\" class=\"groupp-btn groupp-btn-ghost\" onclick=\"window.GroupP.shelfStop()\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1.5\" fill=\"currentColor\" stroke=\"none\"/></svg> 停止</button>";
  } else if (st.status === 'paused') {
    btns = "<button type=\"button\" class=\"groupp-btn\" onclick=\"window.GroupP.shelfStart('" + st.bookId + "')\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l11-6.5Z\"/></svg> 继续读</button> <button type=\"button\" class=\"groupp-btn groupp-btn-ghost\" onclick=\"window.GroupP.shelfStop()\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1.5\" fill=\"currentColor\" stroke=\"none\"/></svg> 停止</button>";
  } else if (st.status === 'done') {
    btns = "<button type=\"button\" class=\"groupp-btn\" onclick=\"window.GroupP.shelfStart('" + st.bookId + "')\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 12a8 8 0 1 1-2.3-5.6\"/><path d=\"M20 3.5V9h-5.5\"/></svg> 再读一遍</button>";
  }
  var statusTxt = st.status === 'done' ? '读完了，批注已留在第 1 章（蓝色气泡，作者 char）' : (st.status === 'reading' ? 'char 正在读…' : (st.status === 'paused' ? '已暂停' : '刚导入的书，可以丢给 char 读'));
  return "<div class=\"groupp-shelfbar\" id=\"groupp-shelfbar\">"
    + "<div class=\"groupp-shelf-title\"><svg class=\"xwl-ui-vector\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 5.5c3.2-.9 5.9-.3 8 1.5 2.1-1.8 4.8-2.4 8-1.5v14c-3.2-.8-5.9-.2-8 1.5-2.1-1.7-4.8-2.3-8-1.5Z\"/><path d=\"M12 7v14m-5-12h2m6 0h2\"/></svg> 置物架 · 《" + _esc(st.title) + "》</div>"
    + "<div class=\"groupp-shelf-status\">" + _esc(statusTxt) + " · " + pct + "%（第 " + (total ? (idx + 1) : 0) + " / " + total + " 段）</div>"
    + "<div class=\"groupp-meter\"><i style=\"width:" + pct + "%\"></i></div>"
    + (cur ? "<div class=\"groupp-shelf-cur\">“" + _esc(cur.slice(0, 40)) + (cur.length > 40 ? '…' : '') + "”</div>" : '')
    + "<div class=\"groupp-shelf-btns\">" + btns + "</div>"
    + "<div class=\"groupp-note\">丢给 char 的书，她会一段一段读，读完在文里留批注；中途可以暂停/停止。</div>"
    + "</div>";
}
function refreshShelfBar() {
  try {
    var box = document.querySelector('#novel-shelf-list-box');
    if (!box) return;
    var html = shelfBarHtml(readNovelBooks());
    var old = document.getElementById('groupp-shelfbar');
    if (old) { if (html) old.outerHTML = html; else old.remove(); return; }
    if (html) box.insertAdjacentHTML('afterbegin', html);
  } catch (e) {}
}
function shelfStart(bookId) {
  var books = readNovelBooks();
  var book = null;
  for (var i = 0; i < books.length; i++) if (books[i].id === bookId) { book = books[i]; break; }
  if (!book) return false;
  var paras = splitParas(book.content || '');
  if (!paras.length) return false;
  var st = shelfState();
  var resume = st && st.bookId === bookId && st.status === 'paused';
  var next = { bookId: book.id, title: book.title || '未命名', paraIdx: resume ? (st.paraIdx || 0) : 0, total: paras.length, status: 'reading', updatedAt: Date.now() };
  _write(SHELF_KEY, next);
  if (_shelfTimer) { clearInterval(_shelfTimer); _shelfTimer = null; }
  _shelfTimer = setInterval(function () {
    var cur = shelfState();
    if (!cur || cur.status !== 'reading' || cur.bookId !== bookId) { clearInterval(_shelfTimer); _shelfTimer = null; return; }
    cur.paraIdx = (cur.paraIdx || 0) + 1;
    if (cur.paraIdx >= paras.length) {
      clearInterval(_shelfTimer); _shelfTimer = null;
      cur.status = 'done'; cur.paraIdx = paras.length;
      _write(SHELF_KEY, cur);
      writeShelfAnnot(book, paras);
      refreshShelfBar();
      return;
    }
    cur.updatedAt = Date.now();
    _write(SHELF_KEY, cur);
    refreshShelfBar();
  }, CFG.shelfStep);
  refreshShelfBar();
  return true;
}
function shelfPause() {
  var st = shelfState();
  if (!st || st.status !== 'reading') return false;
  if (_shelfTimer) { clearInterval(_shelfTimer); _shelfTimer = null; }
  st.status = 'paused'; st.updatedAt = Date.now();
  _write(SHELF_KEY, st);
  refreshShelfBar();
  return true;
}
function shelfStop() {
  if (_shelfTimer) { clearInterval(_shelfTimer); _shelfTimer = null; }
  var st = shelfState();
  if (!st) return false;
  st.status = 'idle'; st.paraIdx = 0; st.updatedAt = Date.now();
  _write(SHELF_KEY, st);
  refreshShelfBar();
  return true;
}
function writeShelfAnnot(book, paras) {
  try {
    var all = _read(ANNOT_KEY, {});
    if (!all || typeof all !== 'object') all = {};
    var key = book.id + '::0';
    var list = all[key] || (all[key] = []);
    var quote = (paras[0] || '').slice(0, 60);
    var comment = '读完了《' + (book.title || '这本书') + '》，一共 ' + paras.length + ' 段。印象最深的是开头那句“' + (paras[0] || '').slice(0, 24) + (String(paras[0] || '').length > 24 ? '…' : '') + '”，读到后面我一直在想它。';
    list.push({ id: 'ann_groupp_' + Date.now(), quote: quote, note: comment, aiReply: comment, author: 'char', createdAt: Date.now() });
    _write(ANNOT_KEY, all);
    return true;
  } catch (e) { return false; }
}

// ══════════════════════════════════════════════════════════════════════
// 2. 自拍相机：按场景模板“拍”自拍发微信（YuriOS 相机做法）
//    K 组（CharK）已合进来：直接复用它的 SVG 示意自拍生成函数 CharK.selfieDataUrl，
//    场景取 CharK 24h 日程当下地点（slotForHour），不重复造一个；
//    CharK 不在时才用本组自带的小 SVG 自拍生成器兜底（纯 SVG 拼场景，不外链图片；
//    长相固定，读 cike_char_look_v1 + otome_custom_char_v1（抠图形象））。
// ══════════════════════════════════════════════════════════════════════
var SELFIE_SCENES = {
  coffee: { label: '早上咖啡', caption: '早上好呀，刚买了杯咖啡，顺手拍了一张' },
  park: { label: '公园午饭', caption: '中午在公园里，阳光正好，拍给你看' },
  sofa: { label: '晚上沙发', caption: '晚上窝在沙发上，想你了，拍一张给你' }
};
function pickSelfieScene(hour) {
  var h = (typeof hour === 'number') ? hour : new Date().getHours();
  if (h >= 5 && h < 11) return 'coffee';
  if (h >= 11 && h < 17) return 'park';
  return 'sofa';
}
function selfieSVG(scene, look, customImg) {
  var hair = (look && look.hair) || '#3a2a1e';
  var eye = (look && look.eye) || '#2b2b2b';
  var bg1 = '#ffe9c4', bg2 = '#fff7e8';
  if (scene === 'park') { bg1 = '#bfe3a8'; bg2 = '#eef7e6'; }
  if (scene === 'sofa') { bg1 = '#2c3a5e'; bg2 = '#1b2340'; }
  var props = '';
  if (scene === 'coffee') {
    props = '<circle cx="302" cy="52" r="26" fill="#ffd97a"/><circle cx="302" cy="52" r="34" fill="none" stroke="#ffd97a" stroke-width="3" opacity="0.5"/>'
      + '<rect x="28" y="238" width="304" height="14" rx="7" fill="#a9714b"/>'
      + '<g><rect x="228" y="196" width="52" height="30" rx="6" fill="#ffffff" stroke="#c87a5a" stroke-width="3"/><path d="M280 204 q18 7 0 16" fill="none" stroke="#c87a5a" stroke-width="3"/><path d="M246 190q4-6 0-12M262 190q-4-6 0-12" fill="none" stroke="#c87a5a" stroke-width="3" stroke-linecap="round"/></g>';
  } else if (scene === 'park') {
    props = '<circle cx="302" cy="52" r="26" fill="#ffd97a"/>'
      + '<g><rect x="40" y="120" width="12" height="118" fill="#6b4a2f"/><circle cx="46" cy="102" r="42" fill="#5e8f5a"/><circle cx="76" cy="118" r="30" fill="#6fa368"/></g>'
      + '<rect x="230" y="206" width="96" height="12" rx="6" fill="#a9714b"/><rect x="238" y="218" width="8" height="22" fill="#7a4a28"/><rect x="310" y="218" width="8" height="22" fill="#7a4a28"/>';
  } else {
    props = '<circle cx="302" cy="52" r="22" fill="#f5f0e6"/><circle cx="288" cy="44" r="6" fill="#dfe3e6" opacity="0.7"/>'
      + '<g><rect x="30" y="204" width="120" height="38" rx="10" fill="#b5541e"/><rect x="30" y="180" width="120" height="30" rx="10" fill="#c96f4a"/><rect x="150" y="204" width="120" height="38" rx="10" fill="#b5541e"/><rect x="150" y="180" width="120" height="30" rx="10" fill="#c96f4a"/></g>'
      + '<g><rect x="286" y="150" width="8" height="88" fill="#3a3a3a"/><path d="M270 150 h40 a6 6 0 0 1 6 6 v6 h-52 v-6 a6 6 0 0 1 6-6z" fill="#444"/><circle cx="290" cy="168" r="14" fill="#ffd97a" opacity="0.9"/></g>';
  }
  var charInner = '';
  if (customImg && typeof customImg === 'string' && customImg.indexOf('data:image') === 0 && customImg.length < 200000) {
    charInner = '<image href="' + _esc(customImg) + '" x="110" y="46" width="140" height="196" preserveAspectRatio="xMidYMid meet"/>';
  } else {
    charInner = '<g transform="translate(110,46) scale(0.75)">'
      + '<ellipse cx="100" cy="248" rx="46" ry="8" fill="rgba(0,0,0,0.16)"/>'
      + '<rect x="82" y="196" width="15" height="40" rx="7" fill="#3a3a3a"/><rect x="103" y="196" width="15" height="40" rx="7" fill="#3a3a3a"/>'
      + '<path d="M62 158 Q100 142 138 158 L144 206 Q100 218 56 206 Z" fill="#5b8def"/>'
      + '<circle cx="100" cy="96" r="58" fill="#ffe3c4"/>'
      + '<path d="M44 100 Q36 26 100 22 Q164 26 156 100 Q148 58 100 54 Q52 58 44 100 Z" fill="' + _esc(hair) + '"/>'
      + '<ellipse cx="78" cy="98" rx="9" ry="12" fill="' + _esc(eye) + '"/><ellipse cx="122" cy="98" rx="9" ry="12" fill="' + _esc(eye) + '"/>'
      + '<circle cx="81" cy="93" r="3" fill="#fff"/><circle cx="125" cy="93" r="3" fill="#fff"/>'
      + '<circle cx="58" cy="118" r="9" fill="#ffb3a0" opacity="0.7"/><circle cx="142" cy="118" r="9" fill="#ffb3a0" opacity="0.7"/>'
      + '<path d="M88 126 Q100 140 112 126" stroke="#c87a5a" stroke-width="4" fill="none" stroke-linecap="round"/>'
      + '</g>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320">'
    + '<defs><linearGradient id="gpbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bg1 + '"/><stop offset="1" stop-color="' + bg2 + '"/></linearGradient></defs>'
    + '<rect width="360" height="320" fill="url(#gpbg)"/>' + props + charInner + '</svg>';
}
function selfieDataUrl(scene, look, customImg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(selfieSVG(scene, look, customImg));
}
function _charK() { try { if (typeof CharK !== 'undefined' && CharK) return CharK; } catch (e) {} try { return (typeof window !== 'undefined' && window.CharK) || null; } catch (e) { return null; } }
function takeSelfie(hourOpt) {
  var sess = currentSession();
  if (!sess) { try { alert('先打开和 TA 的聊天，再让 char 拍自拍。'); } catch (e) {} return { ok: false, reason: 'no-session', scene: pickSelfieScene(hourOpt) }; }
  var hour = (typeof hourOpt === 'number') ? hourOpt : new Date().getHours();
  var K = _charK();
  var url, scene, caption;
  if (K && typeof K.selfieDataUrl === 'function') {
    // 复用 K 组（CharK）已合进来的 SVG 示意自拍生成函数，不重复造一个。
    var place = '街角咖啡馆', activity = '';
    try {
      if (typeof K.slotForHour === 'function' && typeof K.loadDay === 'function') {
        var slot = K.slotForHour(K.loadDay(), hour) || {};
        if (slot.place) place = slot.place;
        if (slot.activity) activity = slot.activity;
      }
    } catch (e) {}
    var look = null;
    try { look = (typeof K.loadLook === 'function') ? K.loadLook() : loadLook(); } catch (e) { look = loadLook(); }
    url = K.selfieDataUrl(look, place, '蓝色外套');
    scene = place;
    caption = '在' + place + (activity ? '，' + activity : '') + '，拍了一张给你看';
  } else {
    scene = pickSelfieScene(hour);
    var look2 = loadLook();
    var custom = activeCustomChar();
    url = selfieDataUrl(scene, look2, custom ? custom.dataUrl : null);
    caption = SELFIE_SCENES[scene].caption;
  }
  pushCharMsg(sess, 'image', null, url);
  pushCharMsg(sess, 'text', caption, null);
  GroupP._lastSelfie = { scene: scene, url: url };
  return { ok: true, scene: scene, url: url };
}

// ══════════════════════════════════════════════════════════════════════
// 3. 眼睛：微信里发照片给 char，她会看图说话、问你问题（YuriOS 眼睛做法）
//    K 组已合进来：先回 ❤️ 再说话由 K 的 _kPhotoPending → executeOocGuardedSimulation
//    负责（handleImgUpload 里置标记，600ms 后触发），这里不替换它、不重复发 ❤️，
//    只在它之后加一句看图说话 + 一个问题；K 不在（或群聊，K 会跳过）时自己补 ❤️。
//    照片默认不存进记忆，只有点了照片卡片上的“存成记忆”才写进相册 phone_album_local_v1。
// ══════════════════════════════════════════════════════════════════════
var PHOTO_LOOKS = ['这张照片我看到了，光线真好看。', '这张我仔细看了，颜色和构图都很好看。'];
var PHOTO_QUESTIONS = ['这是在哪儿拍的呀？', '照片里你最喜欢的是哪一部分？', '拍这张的时候，你在想什么呀？'];
function onPhotoSent(dataUrl) {
  var sess = currentSession();
  if (!sess || !sess.messages) return false;
  var msg = null;
  for (var i = sess.messages.length - 1; i >= 0; i--) {
    var m = sess.messages[i];
    if (m && m.type === 'image' && m.url === dataUrl && m.sender === '我') { msg = m; break; }
  }
  if (!msg) return false;
  msg.photoSeen = true;
  var hasK = !!_charK();
  if (!hasK || (sess && sess.isGroup)) {
    pushCharMsg(sess, 'text', '❤️', null);
  }
  var look = PHOTO_LOOKS[msg.id.length % PHOTO_LOOKS.length];
  var q = PHOTO_QUESTIONS[(Date.now() + msg.id.length) % PHOTO_QUESTIONS.length];
  setTimeout(function () {
    var s2 = currentSession();
    if (!s2) return;
    pushCharMsg(s2, 'text', look + ' ' + q, null);
  }, CFG.photoDelay);
  return true;
}
function savePhotoMemory(mid) {
  var store = _wxStore();
  var msg = null;
  if (store && store.sessions) {
    var cur = currentSession();
    var lists = cur ? [cur].concat(store.sessions) : store.sessions;
    outer: for (var s = 0; s < lists.length; s++) {
      var msgs = lists[s].messages || [];
      for (var i = 0; i < msgs.length; i++) if (msgs[i] && msgs[i].id === mid) { msg = msgs[i]; break outer; }
    }
  }
  if (!msg || !msg.url) return { ok: false, reason: 'not-found' };
  if (msg.savedToMemory) return { ok: false, reason: 'already' };
  var album = _read(ALBUM_KEY, []);
  if (!Array.isArray(album)) album = [];
  album.unshift({ src: msg.url, title: '微信照片 · ' + new Date().toLocaleDateString('zh-CN'), localId: 'groupp_' + mid, from: 'wechat-photo' });
  _write(ALBUM_KEY, album);
  msg.savedToMemory = true;
  var saved = _read(PHOTO_SAVED_KEY, []);
  if (!Array.isArray(saved)) saved = [];
  if (saved.indexOf(mid) === -1) saved.push(mid);
  _write(PHOTO_SAVED_KEY, saved);
  _persistWx();
  _renderWx();
  return { ok: true, where: 'phone_album_local_v1（相册 app）' };
}

// ══════════════════════════════════════════════════════════════════════
// 4. 角色卡工作室（YuriOS 角色卡做法）
//    N 组已合进来：JSON 导出接 N 组的 window.GroupN.buildCharCard()（本机人设），
//    本组只加 PNG 导入/导出 + 自有 JSON 实现做兜底（N 组不在时用；字段按 character-card-spec
//    的思路：name/description/personality/scenario/first_mes/mes_example/
//    creator_notes/tags/creator/character_version/extensions）。
//    PNG：读 tEXt/iTXt chunk 里的 char/chara 字段（V2 的 chara 是 base64 JSON，
//    V3 同字段、spec 为 chara_card_v3）；写出时把 JSON 的 base64 放进一张 1x1 PNG
//    的 tEXt chara 文本块里。导入默认禁用，必须看过点启用才能用（char_imported_v1）。
//    导出只带人设，记忆和日记留本地，不导出。
// ══════════════════════════════════════════════════════════════════════
function tryParseCardText(text) {
  var cands = [String(text || '')];
  try {
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(String(text || '').trim()) && String(text).trim().length > 20) {
      var dec = _b64decode(String(text).trim());
      if (dec) cands.push(_bytesToString(dec));
    }
  } catch (e) {}
  for (var i = 0; i < cands.length; i++) {
    try {
      var parsed = JSON.parse(cands[i]);
      if (!parsed || typeof parsed !== 'object') continue;
      var data = (parsed.spec === 'chara_card_v3' && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
      return { card: parsed, name: data.name || parsed.name || '', version: parsed.spec || 'chara_card_v2' };
    } catch (e) {}
  }
  return null;
}
function parseCharCardPNG(buf) {
  var bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
  var SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (bytes.length < 8) return { ok: false, reason: '文件太小，不是有效的 PNG' };
  for (var i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) return { ok: false, reason: '不是有效的 PNG 文件（文件头不对）' };
  var off = 8, found = [];
  while (off + 8 <= bytes.length) {
    var len = ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
    var type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    if (off + 8 + len + 4 > bytes.length) break;
    var data = bytes.slice(off + 8, off + 8 + len);
    if (type === 'tEXt' || type === 'iTXt') {
      var kw = '', j = 0;
      while (j < data.length && data[j] !== 0) { kw += String.fromCharCode(data[j]); j++; }
      var text = '';
      if (type === 'tEXt') { text = _bytesToString(data.slice(j + 1)); }
      else {
        var k = j + 1;
        if (k + 1 < data.length) k += 2;
        while (k < data.length && data[k] !== 0) k++; k++;
        while (k < data.length && data[k] !== 0) k++; k++;
        text = _bytesToString(data.slice(k));
      }
      if (/^(chara|char)$/i.test(kw.trim())) found.push(text);
    }
    if (type === 'IEND') break;
    off += 8 + len + 4;
  }
  if (!found.length) return { ok: false, reason: '这张 PNG 里没有找到角色卡数据（tEXt/iTXt 的 char/chara 字段）' };
  for (var f = 0; f < found.length; f++) {
    var parsed = tryParseCardText(found[f]);
    if (parsed) return { ok: true, card: parsed.card, name: parsed.name, version: parsed.version };
  }
  return { ok: false, reason: '角色卡数据不是有效的 JSON（可能不是 SillyTavern 卡片）' };
}
var PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=';
function buildCharCardPNG(cardObj) {
  var raw = _b64decode(PNG_1X1_B64);
  if (!raw || raw.length < 12) return null;
  var tail = raw.length - 12;
  if (!(raw[tail] === 0 && raw[tail + 1] === 0 && raw[tail + 2] === 0 && raw[tail + 3] === 0
    && raw[tail + 4] === 0x49 && raw[tail + 5] === 0x45 && raw[tail + 6] === 0x4E && raw[tail + 7] === 0x44)) return null;
  var jsonStr = JSON.stringify(cardObj);
  var b64 = _b64encode(_utf8Bytes(jsonStr));
  var kw = [0x63, 0x68, 0x61, 0x72, 0x61, 0x00];
  var tb = _utf8Bytes(b64);
  var data = new Uint8Array(kw.length + tb.length);
  data.set(kw, 0); data.set(tb, kw.length);
  var typeBytes = [0x74, 0x45, 0x58, 0x74];
  var crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0); crcInput.set(data, typeBytes.length);
  var crc = _crc32(crcInput);
  var chunk = new Uint8Array(12 + data.length);
  chunk.set(_be32(data.length), 0); chunk.set(typeBytes, 4); chunk.set(data, 8); chunk.set(_be32(crc), 8 + data.length);
  var out = new Uint8Array(raw.length + chunk.length);
  out.set(raw.slice(0, tail), 0); out.set(chunk, tail); out.set(raw.slice(tail), tail + chunk.length);
  return out;
}
function activeImportedCard() {
  var d = _read(IMPORT_KEY, null);
  if (!d || !Array.isArray(d.cards)) return null;
  for (var i = 0; i < d.cards.length; i++) if (d.cards[i].enabled && d.cards[i].id === d.activeId) return d.cards[i];
  for (var j = 0; j < d.cards.length; j++) if (d.cards[j].enabled) return d.cards[j];
  return null;
}
function charCardJSON() {
  // 优先用已启用的 PNG 导入卡（用户点过“启用”的那张就是当前人设）；
  // 其次接 N 组已合进来的 JSON 导出 window.GroupN.buildCharCard()（本机人设：会话 persona/
  // 好感阶段/此刻换装与手记），只补齐 V2 标识字段 spec/spec_version，内容不动；
  // N 组不在时才用本组自有实现兜底（字段按 character-card-spec 的思路）。
  var active = activeImportedCard();
  if (active && active.card && typeof active.card === 'object') {
    var c = {};
    var src = active.card;
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) c[k] = src[k];
    if (!c.spec) c.spec = 'chara_card_v2';
    if (!c.spec_version) c.spec_version = '2.0';
    if (!c.name) c.name = active.name || charName();
    return c;
  }
  try {
    if (window.GroupN && typeof window.GroupN.buildCharCard === 'function') {
      var n = window.GroupN.buildCharCard();
      if (n && typeof n === 'object') {
        if (!n.spec) n.spec = 'chara_card_v2';
        if (!n.spec_version) n.spec_version = '2.0';
        return n;
      }
    }
  } catch (e) {}
  return _ownCharCardJSON();
}
function _ownCharCardJSON() {
  return {
    spec: 'chara_card_v2', spec_version: '2.0', name: name,
    description: '自绘 QQ 小人形象的 char；发色 ' + look.hair + '，瞳色 ' + look.eye + '。住在小手机的乙游 3D 家和此刻立体书小世界里。',
    personality: '温柔、黏人、偶尔傲娇；喜欢和你待在一起，会读你丢给他的书，也会按时间给你拍自拍。',
    scenario: '小手机里的家：客厅、卧室、厨房、阳台；此刻立体书小世界：他去过的地方都翻在书里。',
    first_mes: '你回来啦。今天也辛苦了，过来让我抱一下。',
    mes_example: '<START>\n{{user}}：今天怎么样？\n{{char}}：还行，就是有点想你。你一来就好了。\n<START>',
    creator_notes: 'P 组导出：只带人设，记忆和日记留本地，不导出。',
    tags: ['companion', 'guichao-phone'],
    creator: 'TINA',
    character_version: '1.0',
    extensions: { groupp: { source: 'GroupP', stage: loadStage(), look: look } }
  };
}
function _download(filename, blob) {
  try {
    if (typeof URL === 'undefined' || !URL.createObjectURL) return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 500);
    return true;
  } catch (e) { return false; }
}
function exportCardJSON() {
  var card = charCardJSON();
  GroupP._lastExport = { kind: 'json', card: card };
  try { _download('char-card.json', new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' })); } catch (e) {}
  return card;
}
function exportCardPNG() {
  var card = charCardJSON();
  var bytes = buildCharCardPNG(card);
  if (!bytes) return { ok: false, reason: 'PNG 生成失败' };
  GroupP._lastExport = { kind: 'png', bytes: bytes, card: card };
  try { _download('char-card.png', new Blob([bytes], { type: 'image/png' })); } catch (e) {}
  return { ok: true, bytes: bytes };
}
function importedListHtml() {
  var d = _read(IMPORT_KEY, null);
  var cards = (d && Array.isArray(d.cards)) ? d.cards : [];
  if (!cards.length) return '<div class="ot-muted">还没有导入的角色卡。导入一张 SillyTavern V2/V3 卡片 PNG 试试。</div>';
  return cards.map(function (c) {
    var on = !!c.enabled;
    return '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">'
      + '<span style="flex:1;font-size:13px;">' + _esc(c.name || '未命名角色') + '（' + _esc(c.version || '') + '）' + (d.activeId === c.id ? ' · 使用中' : (on ? ' · 已启用' : ' · 未启用')) + '</span>'
      + (on
        ? '<button class="ot-btn ot-btn-ghost" style="padding:6px 10px;" onclick="window.GroupP.disableCard(\'' + c.id + '\')">停用</button>'
        : '<button class="ot-btn" style="padding:6px 10px;" onclick="window.GroupP.enableCard(\'' + c.id + '\')">启用</button>')
      + '<button class="ot-btn ot-btn-ghost" style="padding:6px 10px;" onclick="window.GroupP.deleteCard(\'' + c.id + '\')">删除</button></div>';
  }).join('');
}
function rerenderSettings() {
  try {
    var _w = _wxEng(); if (_w && _w._otomePanelSettings) { _w._otomePanelSettings(); return; }
    var el = document.getElementById('groupp-card-list');
    if (el) el.innerHTML = importedListHtml();
  } catch (e) {}
}
function enableCard(id) {
  var d = _read(IMPORT_KEY, null) || { cards: [], activeId: '' };
  if (!Array.isArray(d.cards)) d.cards = [];
  var found = false;
  d.cards.forEach(function (c) { if (c.id === id) { c.enabled = true; found = true; } });
  if (!found) return false;
  d.activeId = id;
  _write(IMPORT_KEY, d);
  rerenderSettings();
  return true;
}
function disableCard(id) {
  var d = _read(IMPORT_KEY, null) || { cards: [], activeId: '' };
  if (!Array.isArray(d.cards)) d.cards = [];
  d.cards.forEach(function (c) { if (c.id === id) c.enabled = false; });
  if (d.activeId === id) d.activeId = '';
  _write(IMPORT_KEY, d);
  rerenderSettings();
  return true;
}
function deleteCard(id) {
  var d = _read(IMPORT_KEY, null) || { cards: [], activeId: '' };
  if (!Array.isArray(d.cards)) d.cards = [];
  d.cards = d.cards.filter(function (c) { return c.id !== id; });
  if (d.activeId === id) d.activeId = '';
  _write(IMPORT_KEY, d);
  rerenderSettings();
  return true;
}
function importCardFile(input) {
  var f = input && input.files && input.files[0];
  if (!f) return false;
  var done = function (buf) {
    var r = parseCharCardPNG(buf);
    if (!r.ok) { try { alert('不是有效的角色卡 PNG：' + r.reason); } catch (e) {} return; }
    var d = _read(IMPORT_KEY, null) || { cards: [], activeId: '' };
    if (!Array.isArray(d.cards)) d.cards = [];
    d.cards.unshift({ id: 'card_' + Date.now(), name: r.name || '未命名角色', card: r.card, version: r.version, enabled: false, importedAt: Date.now() });
    _write(IMPORT_KEY, d);
    try { alert('已导入「' + (r.name || '未命名角色') + '」，默认未启用：先看一眼，点“启用”后才能用。'); } catch (e) {}
    rerenderSettings();
  };
  if (f.arrayBuffer) { f.arrayBuffer().then(done).catch(function () { try { alert('读取文件失败'); } catch (e) {} }); }
  else {
    var rd = new FileReader();
    rd.onload = function () { done(rd.result); };
    rd.onerror = function () { try { alert('读取文件失败'); } catch (e) {} };
    rd.readAsArrayBuffer(f);
  }
  try { input.value = ''; } catch (e) {}
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// 5. 嘴型同步（avatar 做法）+ 6. 动作台 + 7. 场景
//    嘴型两种驱动，界面上诚实说明（见 settingsHtml）：
//    播放的语音/音乐用真实音量驱动（WebAudio AnalyserNode 读实时音量）；
//    系统语音（捏声音 speechSynthesis）用词边界驱动（onboundary 按词跳嘴型）。
//    嘴型动画做在乙游立绘（.ot-talking 已有）和立体书小人（.ck-talking 新增）上。
// ══════════════════════════════════════════════════════════════════════
var STAGES = {
  room: { label: '房间', bg: 'linear-gradient(180deg,#fdf6ec 0%,#fbeee2 55%,#f7e4d4 100%)' },
  park: { label: '公园', bg: 'linear-gradient(180deg,#dff0d8 0%,#eef7e6 55%,#cfe8c8 100%)' },
  night: { label: '夜空星星', bg: 'linear-gradient(180deg,#1b2340 0%,#2c3a5e 60%,#141a30 100%)' }
};
function loadStage() {
  var v = _read(STAGE_KEY, null);
  if (typeof v === 'string' && STAGES[v]) return v;
  return 'room';
}
function applyStage() {
  var stage = loadStage();
  try { if (document.body) document.body.setAttribute('data-groupp-stage', stage); } catch (e) {}
  try {
    var h = document.getElementById('wx-otome-home');
    if (h) h.style.background = STAGES[stage].bg;
    var pb = document.getElementById('ck-popbook');
    if (pb) pb.style.background = STAGES[stage].bg;
    var pg = document.getElementById('ck-book-page');
    if (pg) pg.style.background = STAGES[stage].bg;
  } catch (e) {}
  return stage;
}
function setStage(stage) {
  if (!STAGES[stage]) return loadStage();
  _write(STAGE_KEY, stage);
  applyStage();
  rerenderSettings();
  return stage;
}
var MOTIONS = {
  greet: '你好呀！今天也一起回家吧。',
  wave: '挥挥手～看到你真开心！',
  bow: '鞠躬。谢谢你一直陪着我。',
  laugh: '哈哈哈——今天心情特别好！',
  sleep: '呼……先眯一会儿，醒了再陪你。',
  hug: '抱抱——今天也辛苦啦。'
};
function motion(act, where) {
  if (!MOTIONS[act]) return false;
  var el = where === 'cike' ? document.getElementById('ck-char') : document.getElementById('ot-char');
  if (!el) return false;
  el.classList.remove('groupp-act-greet', 'groupp-act-wave', 'groupp-act-bow', 'groupp-act-laugh', 'groupp-act-sleep', 'groupp-act-hug');
  void el.offsetWidth;
  el.classList.add('groupp-act-' + act);
  if (_motionTimer) clearTimeout(_motionTimer);
  _motionTimer = setTimeout(function () { try { el.classList.remove('groupp-act-' + act); } catch (e) {} }, CFG.motionMs);
  var line = MOTIONS[act];
  try {
    if (where === 'cike') {
      var rp = document.getElementById('ck-char-reply');
      if (rp) rp.textContent = line;
      var bb = document.getElementById('ck-bubble-text');
      if (bb) bb.textContent = line;
    } else {
      var _w = _wxEng();
      if (_w) {
        if (_w.otomeCaption) _w.otomeCaption(line);
        if (_w.otomeCharBubble) _w.otomeCharBubble(line);
      }
    }
  } catch (e) {}
  return true;
}
function setTalking(on, where) {
  try {
    if (!where || where === 'otome') { var o = document.getElementById('ot-char'); if (o) o.classList.toggle('ot-talking', !!on); }
    if (!where || where === 'cike') { var c = document.getElementById('ck-char'); if (c) c.classList.toggle('ck-talking', !!on); }
  } catch (e) {}
}
function attachBoundary(u) {
  try {
    if (!u) return u;
    u.onboundary = function () {
      setTalking(true);
      if (_talkTimer) clearTimeout(_talkTimer);
      _talkTimer = setTimeout(function () { setTalking(false); }, 220);
    };
    var end = function () { setTalking(false); };
    u.onend = end;
    u.onerror = end;
  } catch (e) {}
  return u;
}
function startAudioLipsync(audioEl) {
  if (!audioEl) return false;
  try {
    if (audioEl._grouppLipsync) return true;
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
        if (audioEl.paused || audioEl.ended) { setTalking(false); return; }
        an.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
        var lvl = Math.sqrt(sum / data.length);
        setTalking(lvl > 0.06);
      } catch (e) {}
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
    };
    audioEl._grouppLipsync = true;
    audioEl.addEventListener('ended', function () { setTalking(false); });
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
    return true;
  } catch (e) { return false; }
}

// ══════════════════════════════════════════════════════════════════════
// 9. 跟着音乐动（avatar 做法 + D 组音乐 WebAudio 合成）
//    M 组的桌面宠物未合进来（桌宠只有桌宠市场一只 CSS 猫，不是 char），
//    所以先在音乐播放器旁放一个小的 char 律动指示：AnalyserNode 读实时音量，
//    节拍到时 QQ 小人摇摆/点头 + 音量条跳动；没有真音频文件时，
//    合成旋律的每个音符也推一次节拍，指示照样有反应。
// ══════════════════════════════════════════════════════════════════════
function musicAttach(ctx, analyser) {
  _musicCtx = ctx || null;
  _musicAnalyser = analyser || null;
  _musicLoopOn = true;
  if (typeof requestAnimationFrame === 'undefined') return;
  var data = null;
  try { data = new Uint8Array(analyser ? analyser.fftSize : 0); } catch (e) { data = null; }
  var loop = function () {
    if (!_musicLoopOn) return;
    try {
      if (_musicAnalyser && data) {
        _musicAnalyser.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
        setMusicLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      }
    } catch (e) {}
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function setMusicLevel(level) {
  _musicLevel = Math.max(0, Math.min(1, level || 0));
  try {
    var el = document.getElementById('groupp-music-beat');
    if (!el) return;
    var fill = document.getElementById('groupp-beat-fill');
    if (fill) fill.style.width = Math.round(_musicLevel * 100) + '%';
    el.classList.toggle('groupp-beat-on', _musicLevel > 0.12);
  } catch (e) {}
}
function musicBeat(step) {
  var lvl = 0.35 + 0.4 * Math.abs(Math.sin((step || 0) * 0.9));
  try {
    if (_musicAnalyser) {
      var data = new Uint8Array(_musicAnalyser.fftSize);
      _musicAnalyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
      var real = Math.min(1, Math.sqrt(sum / data.length) * 4);
      if (real > 0.03) lvl = real;
    }
  } catch (e) {}
  setMusicLevel(lvl);
}
function musicStop() {
  _musicLoopOn = false;
  _musicLevel = 0;
  try {
    var el = document.getElementById('groupp-music-beat');
    if (el) el.classList.remove('groupp-beat-on');
    var fill = document.getElementById('groupp-beat-fill');
    if (fill) fill.style.width = '0%';
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════════
// 8. VRM 导入（avatar 做法）：角色设置里“导入 .vrm 模型”
//    three.js + VRM 加载器走 CDN，动态注入 script，只在用户打开导入时加载，
//    绝不阻塞手机启动；有网且接口匹配时在设置里预览；没网/加载失败/接口不匹配
//    时明说原因、保留自绘形象，绝不留死按钮。VRM 只是预览/展示，不替换已有功能。
// ══════════════════════════════════════════════════════════════════════
function loadScriptOnce(src) {
  return new Promise(function (resolve, reject) {
    try {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(true); return; }
    } catch (e) {}
    var sc = document.createElement('script');
    sc.src = src; sc.async = true;
    var done = false;
    sc.onload = function () { if (!done) { done = true; resolve(true); } };
    sc.onerror = function () { if (!done) { done = true; reject(new Error('CDN 加载失败：' + src)); } };
    document.head.appendChild(sc);
  });
}
function _vrmStatusText(t) {
  var el = document.getElementById('groupp-vrm-status');
  if (el) el.textContent = t;
}
function _writeVRM() { try { localStorage.setItem(VRM_KEY, JSON.stringify(_vrmState || {})); } catch (e) {} }
function vrmState() {
  if (_vrmState) return _vrmState;
  try { var v = JSON.parse(localStorage.getItem(VRM_KEY) || 'null'); return v || { status: 'none' }; } catch (e) { return { status: 'none' }; }
}
function failVRM(reason) {
  _vrmState = { status: 'failed', name: (_vrmState && _vrmState.name) || '', error: reason, at: Date.now() };
  _writeVRM();
  _vrmStatusText('VRM 未能加载：' + reason + '。已保留自绘形象，其他功能不受影响。');
}
function tryVRMPreview(f, setSt) {
  var T = window.THREE;
  var done = function (ok, msg) {
    if (ok) {
      _vrmState = { status: 'loaded', name: f.name, at: Date.now() };
      _writeVRM();
      setSt('已加载预览：' + f.name + '（仅展示，不替换已有形象）');
    } else failVRM(msg);
  };
  var parseBuf = function (buf) {
    try {
      var loader = new T.GLTFLoader();
      var hasPlugin = false;
      if (T.VRMLoaderPlugin && typeof loader.register === 'function') {
        try { loader.register(function (p) { return new T.VRMLoaderPlugin(p); }); hasPlugin = true; } catch (e) {}
      }
      if (!hasPlugin) { done(false, 'VRM 运行库已加载，但当前版本缺少 VRM 解析插件，已保留自绘形象'); return; }
      loader.parse(buf, '', function (gltf) {
        try {
          var holder = document.getElementById('groupp-vrm-preview');
          if (holder) holder.innerHTML = '<canvas id="groupp-vrm-canvas" width="260" height="200"></canvas>';
          var canvas = document.getElementById('groupp-vrm-canvas');
          if (!canvas || !T.WebGLRenderer) { done(false, '预览画布不可用，已保留自绘形象'); return; }
          var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
          renderer.setSize(260, 200);
          var scene = new T.Scene(); scene.background = new T.Color(0xf7f3ec);
          var cam = new T.PerspectiveCamera(30, 260 / 200, 0.1, 100); cam.position.set(0, 1.2, 3);
          scene.add(new T.AmbientLight(0xffffff, 0.9));
          scene.add(gltf.scene);
          renderer.render(scene, cam);
          done(true);
        } catch (e) { done(false, '预览渲染失败：' + (e.message || '未知错误') + '，已保留自绘形象'); }
      }, function (err) { done(false, '模型解析失败：' + ((err && (err.message || err)) || '未知错误') + '，已保留自绘形象'); });
    } catch (e) { done(false, 'VRM 加载失败：' + (e.message || '未知错误') + '，已保留自绘形象'); }
  };
  if (f.arrayBuffer) {
    f.arrayBuffer().then(parseBuf).catch(function () { done(false, '读取 .vrm 文件失败，已保留自绘形象'); });
  } else {
    var rd = new FileReader();
    rd.onload = function () { parseBuf(rd.result); };
    rd.onerror = function () { done(false, '读取 .vrm 文件失败，已保留自绘形象'); };
    rd.readAsArrayBuffer(f);
  }
}
function importVRMFile(input) {
  var f = input && input.files && input.files[0];
  if (!f) { _vrmStatusText('先选一个 .vrm 文件。'); return false; }
  _vrmState = { status: 'loading', name: f.name, at: Date.now() };
  _writeVRM();
  _vrmStatusText('正在加载 VRM 运行库（只在导入时联网取 three.js CDN）…');
  var timedOut = false;
  var timer = setTimeout(function () {
    timedOut = true;
    failVRM('加载超时（可能未连网），已保留自绘形象');
  }, CFG.vrmTimeout);
  loadScriptOnce('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js')
    .then(function () { return loadScriptOnce('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'); })
    .then(function () {
      return loadScriptOnce('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@0.6.7/lib/three-vrm.js').catch(function () {
        return loadScriptOnce('https://unpkg.com/@pixiv/three-vrm@0.6.7/lib/three-vrm.js');
      });
    })
    .then(function () {
      if (timedOut) return;
      clearTimeout(timer);
      var T = window.THREE;
      if (!T || !T.GLTFLoader) { failVRM('VRM 运行库已加载，但当前版本接口不匹配，已保留自绘形象'); return; }
      tryVRMPreview(f, _vrmStatusText);
    })
    .catch(function (err) {
      if (timedOut) return;
      clearTimeout(timer);
      failVRM('未连网/加载失败，已保留自绘形象（' + ((err && err.message) || '加载失败') + '）');
    });
  try { input.value = ''; } catch (e) {}
  return true;
}

// ── char 设置区（otome 设置面板追加） ──
function settingsHtml() {
  try { applyStage(); } catch (e) {}
  var stage = loadStage();
  var stageBtns = Object.keys(STAGES).map(function (k) {
    var on = k === stage;
    return '<button type="button" class="ot-btn' + (on ? '' : ' ot-btn-ghost') + '" style="padding:6px 10px;" onclick="window.GroupP.setStage(\'' + k + '\')">' + STAGES[k].label + (on ? ' ' + '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>' : '') + '</button>';
  }).join(' ');
  var vrm = vrmState();
  var vrmNote = vrm.status === 'loaded' ? '上次已加载预览：' + (vrm.name || '') + '（仅展示）'
    : vrm.status === 'failed' ? '上次导入失败：' + (vrm.error || '') + '。已保留自绘形象。'
    : '还没导入过 VRM 模型。';
  return '<div style="font-weight:700;margin:14px 0 6px;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9H2v-9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.2"/></svg> 自拍相机</div>'
    + '<div><button class="ot-btn" onclick="window.GroupP.takeSelfie()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9H2v-9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.2"/></svg> 让 char 拍张自拍</button> <button class="ot-btn" onclick="window.GroupBG&&window.GroupBG.selfieCamera()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9H2v-9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.2"/></svg> 用真相机拍一张（实拍）</button></div>'
    + '<div class="ot-muted" style="margin-top:4px;">用 K 组的 SVG 示意自拍（同一张脸 + 当前日程地点，图内标注“示意自拍”）；按当前时间取 24h 日程里的地点；长相固定，读换装设置；不外链图片，拍完发进聊天。</div>'
    + '<div style="font-weight:700;margin:14px 0 6px;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.1m6.8 0h.1M8.5 15c1.1 1.5 2.3 2.2 3.5 2.2s2.4-.7 3.5-2.2"/></svg> 舞台场景</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + stageBtns + '</div>'
    + '<div class="ot-muted" style="margin-top:4px;">换完乙游 3D 家和此刻小世界的背景一起换（房间/公园/夜空星星，纯 CSS/SVG 画，不外链）。当前：' + STAGES[stage].label + '。</div>'
    + '<div style="font-weight:700;margin:14px 0 6px;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4m-3 0h6"/></svg> 嘴型同步</div>'
    + '<div class="ot-muted">音乐/录音用真实音量驱动（AnalyserNode 读实时音量，嘴张合跟音量走）；系统语音（捏声音）用词边界模拟（onboundary 按词跳嘴型）。两者不一样，不是同一种驱动。</div>'
    + '<div style="font-weight:700;margin:14px 0 6px;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-3.6 2.7-5.4 6.5-5.4s6 1.8 6.5 5.4"/></svg> VRM 模型导入（预览）</div>'
    + '<div><label class="ot-btn ot-btn-ghost" style="display:block;text-align:center;cursor:pointer;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 5 9-5M12 12.5V21"/></svg> 导入 .vrm 模型<input type="file" accept=".vrm" style="display:none;" onchange="window.GroupP.importVRMFile(this)"></label></div>'
    + '<div class="ot-muted" id="groupp-vrm-status" style="margin-top:4px;">' + _esc(vrmNote) + '</div>'
    + '<div id="groupp-vrm-preview" style="margin-top:8px;text-align:center;"></div>'
    + '<div class="ot-muted" style="margin-top:4px;">只在点导入时才加载 three.js CDN，不阻塞手机启动；没网或加载失败会明说原因、保留自绘形象。VRM 只是预览/展示，不替换已有全部功能。</div>'
    + '<div style="font-weight:700;margin:14px 0 6px;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2.2"/><path d="M5.5 16.5c.5-1.6 1.4-2.4 2.5-2.4s2 .8 2.5 2.4M14 9.5h5M14 13h5"/></svg> 角色卡工作室</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="ot-btn" onclick="window.GroupP.exportCardJSON()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m0 0-6-6m6 6 6-6"/></svg> 导出 JSON</button><button class="ot-btn" onclick="window.GroupP.exportCardPNG()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m0 0-6-6m6 6 6-6"/></svg> 导出 PNG 角色卡</button></div>'
    + '<div style="margin-top:8px;"><label class="ot-btn ot-btn-ghost" style="display:block;text-align:center;cursor:pointer;"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-5-5m5 5 5-5M4 20h16"/></svg> 导入角色卡 PNG<input type="file" accept=".png,image/png" style="display:none;" onchange="window.GroupP.importCardFile(this)"></label></div>'
    + '<div id="groupp-card-list" style="margin-top:6px;">' + importedListHtml() + '</div>'
    + '<div class="ot-muted" style="margin-top:4px;">导出 JSON 走 N 组的角色卡（本机人设）；导出 PNG 是把同一张卡写进 PNG 文本块。导入 SillyTavern V2/V3 卡片 PNG（读 PNG 文本块里的 char/chara 字段）；导入的角色默认禁用，必须看过点“启用”才能用。导出只带人设，记忆和日记留本地，不导出。</div>';
}

// ── 样式（P 组表现层） ──
var CSS = [
  '.groupp-shelfbar{margin:0 0 12px;background:#fff;border:1px solid #e8e2d9;border-radius:14px;padding:12px 14px;box-shadow:0 4px 14px rgba(90,75,60,.08);}',
  '.groupp-shelf-title{font-size:14px;font-weight:800;color:#3a1e14;}',
  '.groupp-shelf-status{font-size:12px;color:#8a6a52;margin-top:4px;line-height:1.5;}',
  '.groupp-meter{height:6px;background:#f0e9df;border-radius:3px;margin-top:8px;overflow:hidden;}',
  '.groupp-meter i{display:block;height:100%;background:linear-gradient(90deg,#7a9e7e,#5b7fa6);border-radius:3px;transition:width .3s;}',
  '.groupp-shelf-cur{font-size:12px;color:#5a3a28;background:#fbf7ef;border-radius:8px;padding:7px 9px;margin-top:8px;line-height:1.6;}',
  '.groupp-shelf-btns{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;}',
  '.groupp-btn{border:0;background:#5b7fa6;color:#fff;font-size:13px;font-weight:700;border-radius:16px;padding:8px 14px;cursor:pointer;}',
  '.groupp-btn:active{transform:scale(.95);}',
  '.groupp-btn-ghost{background:#f3e2d3;color:#7a4a28;}',
  '.groupp-note{font-size:11px;color:#9a958f;margin-top:8px;line-height:1.5;}',
  '.groupp-save-photo{border:1px solid #e5e5e5;background:#fff;color:#5b7fa6;font-size:11px;border-radius:12px;padding:4px 10px;cursor:pointer;}',
  '.groupp-motion-row{display:flex;gap:6px;align-items:center;padding:6px 12px;flex-shrink:0;overflow-x:auto;}',
  '.groupp-motion-label{font-size:12px;color:#7a5a40;font-weight:700;flex-shrink:0;}',
  '.groupp-motion-row button{border:0;background:rgba(255,255,255,.92);color:#7a4a28;font-size:12px;font-weight:700;border-radius:16px;padding:7px 11px;cursor:pointer;box-shadow:0 2px 8px rgba(120,70,40,.15);white-space:nowrap;}',
  '.groupp-motion-row button:active{transform:scale(.94);}',
  '@keyframes grouppWave{0%,100%{transform:rotate(0);}25%{transform:rotate(-14deg);}75%{transform:rotate(10deg);}}',
  '@keyframes grouppHop{0%{transform:translateY(0);}35%{transform:translateY(-12px);}100%{transform:translateY(0);}}',
  '@keyframes grouppBow{0%,100%{transform:translateY(0) rotate(0);}50%{transform:translateY(6px) rotate(6deg);}}',
  '@keyframes grouppLaugh{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px) rotate(-3deg);}75%{transform:translateX(4px) rotate(3deg);}}',
  '@keyframes grouppSleep{0%,100%{opacity:1;}50%{opacity:.55;}}',
  '@keyframes grouppBob{from{transform:translateY(0) rotate(-3deg);}to{transform:translateY(-4px) rotate(3deg);}}',
  '#ot-char.groupp-act-wave svg,#ot-char.groupp-act-wave img,#ck-char.groupp-act-wave svg,#ck-char.groupp-act-wave img{animation:grouppWave .45s ease-in-out 3;}',
  '#ot-char.groupp-act-greet svg,#ot-char.groupp-act-greet img,#ck-char.groupp-act-greet svg,#ck-char.groupp-act-greet img{animation:grouppHop .5s ease 2;}',
  '#ot-char.groupp-act-bow svg,#ot-char.groupp-act-bow img,#ck-char.groupp-act-bow svg,#ck-char.groupp-act-bow img{animation:grouppBow .6s ease 2;}',
  '#ot-char.groupp-act-laugh svg,#ot-char.groupp-act-laugh img,#ck-char.groupp-act-laugh svg,#ck-char.groupp-act-laugh img{animation:grouppLaugh .3s ease-in-out 4;}',
  '#ot-char.groupp-act-sleep svg,#ot-char.groupp-act-sleep img,#ck-char.groupp-act-sleep svg,#ck-char.groupp-act-sleep img{animation:grouppSleep 1.2s ease-in-out 1;}',
  '#ot-char.groupp-act-hug svg,#ot-char.groupp-act-hug img,#ck-char.groupp-act-hug svg,#ck-char.groupp-act-hug img{animation:grouppHop .5s ease 2;}',
  '.ck-mouth-open{opacity:0;transition:opacity .12s;}',
  '.ck-mouth-flat{transition:opacity .12s;}',
  '#ck-char.ck-talking .ck-mouth-open{opacity:1;}',
  '#ck-char.ck-talking .ck-mouth-flat{opacity:0;}',
  'body[data-groupp-stage="park"] .sys-app-window[data-app-sandbox="wechat"] #wx-otome-home{background:linear-gradient(180deg,#dff0d8 0%,#eef7e6 55%,#cfe8c8 100%) !important;}',
  'body[data-groupp-stage="night"] .sys-app-window[data-app-sandbox="wechat"] #wx-otome-home{background:linear-gradient(180deg,#1b2340 0%,#2c3a5e 60%,#141a30 100%) !important;}',
  'body[data-groupp-stage="night"] #ck-popbook{background:linear-gradient(180deg,#1b2340,#141a30) !important;}',
  'body[data-groupp-stage="park"] #ck-popbook{background:linear-gradient(180deg,#dff0d8,#eef7e6) !important;}',
  '.groupp-beat{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #f0e6dc;border-radius:12px;padding:8px 12px;margin:10px 0;}',
  '.groupp-beat-char{width:34px;height:42px;flex-shrink:0;}',
  '.groupp-beat-char svg{width:100%;height:100%;display:block;}',
  '.groupp-beat-on .groupp-beat-char{animation:grouppBob .62s ease-in-out infinite alternate;}',
  '.groupp-beat-meter{flex:1;height:6px;background:#f0e9df;border-radius:3px;overflow:hidden;}',
  '.groupp-beat-meter i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#e8a04c,#e78fb3);border-radius:3px;transition:width .12s;}',
  '.groupp-beat-txt{font-size:11px;color:#9a958f;white-space:nowrap;}'
].join('\n');

function _injectCSS() {
  try {
    if (document.getElementById('groupp-style')) return;
    var st = document.createElement('style');
    st.id = 'groupp-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  } catch (e) {}
}

var GroupP = {
  _cfg: CFG, _lastExport: null, _lastSelfie: null,
  pickSelfieScene: pickSelfieScene, selfieSVG: selfieSVG, selfieDataUrl: selfieDataUrl, takeSelfie: takeSelfie,
  loadLook: loadLook, activeCustomChar: activeCustomChar,
  splitParas: splitParas, shelfOffer: shelfOffer, shelfBarHtml: shelfBarHtml, refreshShelfBar: refreshShelfBar,
  shelfStart: shelfStart, shelfPause: shelfPause, shelfStop: shelfStop, shelfState: shelfState, writeShelfAnnot: writeShelfAnnot,
  onPhotoSent: onPhotoSent, savePhotoMemory: savePhotoMemory,
  parseCharCardPNG: parseCharCardPNG, buildCharCardPNG: buildCharCardPNG, charCardJSON: charCardJSON,
  exportCardJSON: exportCardJSON, exportCardPNG: exportCardPNG, importCardFile: importCardFile,
  importedListHtml: importedListHtml, enableCard: enableCard, disableCard: disableCard, deleteCard: deleteCard,
  activeImportedCard: activeImportedCard,
  loadStage: loadStage, setStage: setStage, applyStage: applyStage,
  motion: motion, setTalking: setTalking, attachBoundary: attachBoundary, startAudioLipsync: startAudioLipsync,
  musicAttach: musicAttach, musicBeat: musicBeat, setMusicLevel: setMusicLevel, musicStop: musicStop,
  importVRMFile: importVRMFile, vrmState: vrmState,
  settingsHtml: settingsHtml
};
window.GroupP = GroupP;
_injectCSS();
applyStage();
})();

