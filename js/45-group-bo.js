
/* ══════════════════════════════════════════════════════════════════════
   GROUP-BO · 微信能发文件给 char（BO 组，自写实现，未抄第三方代码）
   入口：聊天页 + 菜单“文件”格 → #wx-file-upload → handleFileUpload。
   文件存新键 wx_files_v1（文本存 text、图/音/其他存 dataUrl；单文件
   上限 5MB，库最多 30 条、总计约 3MB，超了先清最旧的；配额满时退化
   为只存元数据并如实标注）。整屋备份：AH HOME_KEYS 已加 wx_files_v1；
   T 组 phone 档快照取全部键，本就包含；导出 JSON 超 2MB 时 toast 提示。
   char 回应：文本进 curSess.memory（接模型时 executeRealAIReply 放进
   上下文；未接时模板按关键词/标题回一句，标“（模板模式）”）；图片复用
   已有“眼睛”流程；音频/pdf/office/zip 诚实说打不开。不写示例内容。
   ══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var KEY = 'wx_files_v1';
var MAX_FILE = 5 * 1024 * 1024;
var MAX_FILES = 30;
var MAX_STORE_BYTES = 3 * 1024 * 1024;
var TEXT_EXTS = ['txt', 'md', 'json'];
var IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
var AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'webm'];
var NOVEL_KEY = 'novel_store_v1';
var SCRIPT_CUSTOM_KEY = 'phone_script_custom_v1';

var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var fmtSize = function (n) {
  n = +n || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
};
var toast = function (t) {
  try { if (window.WeChatAppEngine && WeChatAppEngine.triggerToast) { WeChatAppEngine.triggerToast(t); return; } } catch (e) {}
  try { alert(t); } catch (e) {}
};
var wxStore = function () { try { return (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) ? AppRegistry['wechat'].wxStore : null; } catch (e) { return null; } };
var persist = function () { try { var s = wxStore(); if (s && typeof s._persist === 'function') s._persist(); } catch (e) {} };
var scrollBottom = function () { setTimeout(function () { var b = document.getElementById('wx-msg-stream-container'); if (b) b.scrollTop = b.scrollHeight; }, 20); };
var uid = function (p) { return (p || 'wxf') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); };
var extOf = function (name) { var m = String(name || '').match(/\.([^./\\]+)$/); return m ? m[1].toLowerCase() : ''; };
var kindOf = function (file) {
  var ext = extOf(file.name);
  var mime = String(file.type || '');
  if (TEXT_EXTS.indexOf(ext) >= 0 || mime === 'application/json' || mime.indexOf('text/') === 0) return { kind: 'text', ext: ext };
  if (IMG_EXTS.indexOf(ext) >= 0 || mime.indexOf('image/') === 0) return { kind: 'image', ext: ext };
  if (AUDIO_EXTS.indexOf(ext) >= 0 || mime.indexOf('audio/') === 0) return { kind: 'audio', ext: ext };
  return { kind: 'other', ext: ext };
};
var kindLabel = function (kind) { return kind === 'text' ? '文本' : kind === 'image' ? '图片' : kind === 'audio' ? '音频' : '文件'; };

/* ── 存储：wx_files_v1 ── */
var listFiles = function () {
  try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
};
var writeFiles = function (arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
};
var getFile = function (id) {
  var arr = listFiles();
  for (var i = 0; i < arr.length; i++) { if (arr[i] && arr[i].id === id) return arr[i]; }
  return null;
};
var saveFileRecord = function (rec) {
  var arr = listFiles();
  arr.push(rec);
  while (arr.length > MAX_FILES) arr.shift();
  var total = function (a) { var n = 0; a.forEach(function (r) { n += JSON.stringify(r).length; }); return n; };
  while (arr.length > 1 && total(arr) > MAX_STORE_BYTES) arr.shift();
  if (writeFiles(arr)) return { ok: true, stored: 'full' };
  // 配额满：退化为只存元数据（不丢记录，如实标注）
  rec.text = null; rec.dataUrl = null; rec.stored = 'meta';
  var arr2 = listFiles();
  arr2.push(rec);
  while (arr2.length > MAX_FILES) arr2.shift();
  if (writeFiles(arr2)) return { ok: true, stored: 'meta' };
  return { ok: false, stored: 'lost' };
};

/* ── 读文件内容 ── */
var readFileContent = function (file, info) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onerror = function () { reject(new Error('read_failed')); };
    r.onload = function (e) {
      if (info.kind === 'text') resolve({ text: String(e.target.result || ''), dataUrl: null });
      else resolve({ text: null, dataUrl: String(e.target.result || '') });
    };
    if (info.kind === 'text') r.readAsText(file);
    else r.readAsDataURL(file);
  });
};

/* ── 模板回复：按关键词/标题，标“（模板模式）” ── */
var FILE_KEYWORDS = [
  { k: ['喜欢', '最爱', '爱吃', '爱喝'], t: '原来你喜欢这个，我记下了。' },
  { k: ['决定', '从今天起', '以后每天', '计划', '安排', '待办', '目标'], t: '这份计划我收到了，到时候提醒你。' },
  { k: ['生日', '纪念日', '周年'], t: '这个日子我记下了，到时候陪你过。' },
  { k: ['约', '见面', '碰头', '出来'], t: '约好了，到时候见。' },
  { k: ['旅行', '出门', '去玩', '机票', '酒店'], t: '想出去玩了？到时候一起计划。' },
  { k: ['难过', '难受', '不开心', '累', '烦'], t: '先抱抱你，慢慢讲给我听。' },
  { k: ['开心', '好消息', '太好了'], t: '听起来是好消息，替你开心。' },
  { k: ['猫', '狗', '宠物'], t: '毛孩子的事我最爱听了。' },
  { k: ['吃', '好吃', '餐厅', '做饭'], t: '说到吃的我就来劲了，下次一起去。' },
  { k: ['工作', '加班', '开会', '老板'], t: '工作上的事，辛苦了。' },
  { k: ['学习', '考试', '读书'], t: '学习的事，慢慢来，我陪你。' }
];
var firstLine = function (text) {
  var lines = String(text || '').split('\n');
  for (var i = 0; i < lines.length; i++) { var t = lines[i].trim(); if (t) return t; }
  return '';
};
var templateReplyFor = function (rec) {
  var text = rec.text || '';
  var title = '';
  if (rec.ext === 'json') { try { var j = JSON.parse(text); title = String(j.title || j.name || '').trim(); } catch (e) {} }
  var first = firstLine(text);
  var hit = '';
  for (var i = 0; i < FILE_KEYWORDS.length && !hit; i++) {
    for (var k = 0; k < FILE_KEYWORDS[i].k.length; k++) {
      if (text.indexOf(FILE_KEYWORDS[i].k[k]) >= 0) { hit = FILE_KEYWORDS[i].t; break; }
    }
  }
  var head = '「' + rec.name + '」我看了，';
  if (title) head += '标题是「' + title.slice(0, 30) + '」，';
  else if (first) head += '开头写着「' + first.slice(0, 40) + '」，';
  if (hit) return head + hit + '（模板模式）';
  return head + '你细讲讲？（模板模式）';
};

/* ── 发文件 ── */
var handleFileUpload = function (input) {
  var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
  var file = files[0] || null;
  if (input) { try { input.value = ''; } catch (e) {} }
  if (!file) return Promise.resolve({ ok: false, reason: 'no_file' });
  if (file.size > MAX_FILE) {
    var overMsg = '文件过大（超过 5MB），请拆小或发文字版';
    toast(overMsg);
    BO.lastReject = { name: file.name, size: file.size, at: Date.now() };
    return Promise.resolve({ ok: false, reason: 'too-big', message: overMsg });
  }
  var info = kindOf(file);
  var store = wxStore();
  var curSess = store && store.sessions ? store.sessions.find(function (s) { return s.id === store.currentChatId; }) : null;
  if (!curSess) { toast('没有打开的聊天，先进一个聊天再发文件'); return Promise.resolve({ ok: false, reason: 'no_session' }); }
  return readFileContent(file, info).then(function (content) {
    var rec = { id: uid('wxf'), name: file.name, size: file.size, kind: info.kind, ext: info.ext,
      mime: file.type || '', text: content.text, dataUrl: content.dataUrl, stored: 'full', savedAt: Date.now() };
    var saved = saveFileRecord(rec);
    if (!saved.ok) {
      rec.stored = 'lost';
      toast('文件记录没存下来（本机空间不足），消息已发出，点开可能看不到内容');
    } else if (saved.stored === 'meta') {
      toast('文件内容没存下来（本机空间不足），只保留了文件名和大小');
    }
    var m = { id: 'file_' + Date.now(), sender: '我', type: 'file', fileId: rec.id,
      name: rec.name, size: rec.size, kind: rec.kind, ext: rec.ext, time: '刚刚' };
    curSess.messages.push(m);
    curSess.preview = '[文件] ' + rec.name;
    curSess.lastTime = '刚刚';
    persist();
    try { if (window.WeChatAppEngine) WeChatAppEngine.renderUpdates(); } catch (e) {}
    scrollBottom();
    replyToFile(store, curSess, rec);
    return { ok: true, message: m, file: rec };
  }).catch(function () {
    toast('读取文件失败');
    return { ok: false, reason: 'read_failed' };
  });
};

/* ── char 回应 ── */
var pushCharText = function (store, curSess, sBar, text) {
  if (sBar) { try { sBar.classList.remove('wx-typing'); } catch (e) {} }
  curSess.messages.push({ id: 'm_bo_' + Date.now(), sender: curSess.name, type: 'text', content: text, time: '刚刚' });
  curSess.preview = text;
  curSess.lastTime = '刚刚';
  if (!curSess.memory) curSess.memory = [];
  curSess.memory.push({ role: curSess.name, text: text, time: Date.now() });
  if (curSess.memory.length > 24) curSess.memory.shift();
  persist();
  try { if (window.WeChatAppEngine) WeChatAppEngine.renderUpdates(); } catch (e) {}
  scrollBottom();
};
var replyToFile = function (store, curSess, rec) {
  if (!curSess || curSess.isGroup) return; // 群聊不自动回
  var sBar = document.getElementById('wx-chat-state-bar');
  if (sBar) { try { sBar.classList.add('wx-typing'); } catch (e) {} }
  var dummyBar = { classList: { add: function () {}, remove: function () {} } };
  var bar = sBar || dummyBar;
  if (rec.kind === 'image') {
    // 图片：复用已有“眼睛”流程（事件 + 视觉分析 + K 组先回 ❤️ 再说话）
    if (!curSess.events) curSess.events = [];
    curSess.events.push({ type: 'image', url: rec.dataUrl, time: Date.now(), consumed: false });
    try {
      if (typeof VisionAPI !== 'undefined' && VisionAPI.isConfigured && VisionAPI.isConfigured()) {
        var imgEvent = curSess.events[curSess.events.length - 1];
        VisionAPI.analyzeImage({ imageBase64: rec.dataUrl }).then(function (d) { imgEvent.visionResult = d; }).catch(function () {});
      }
    } catch (e) {}
    try { if (window.GroupP) window.GroupP.onPhotoSent(rec.dataUrl); } catch (e) {}
    curSess._kPhotoPending = true;
    setTimeout(function () {
      try {
        WeChatAppEngine.executeOocGuardedSimulation(store, curSess, '[图片]', bar)
          .catch(function () { if (sBar) sBar.classList.remove('wx-typing'); });
      } catch (e) { if (sBar) sBar.classList.remove('wx-typing'); }
    }, 600);
    return;
  }
  if (rec.kind === 'text') {
    // 文本：内容写进会话记忆——接模型时 executeRealAIReply 会把它放进上下文一起理解
    var excerpt = String(rec.text || '').slice(0, 2000);
    if (!curSess.memory) curSess.memory = [];
    curSess.memory.push({ role: 'user', text: '[文件：' + rec.name + ']\n' + excerpt, time: Date.now() });
    if (curSess.memory.length > 24) curSess.memory.shift();
    var apiCfg = null;
    try { apiCfg = (window.PhoneModel && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('chat')) || WeChatAppEngine.getActiveApiConfig(); } catch (e) {}
    try { if (window.PhoneModel) window.PhoneModel.refreshChatLine(); } catch (e) {}
    if (apiCfg) {
      setTimeout(function () {
        WeChatAppEngine.executeRealAIReply(store, curSess, apiCfg, bar).catch(function () {
          try { if (window.PhoneModel && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('chat')) WeChatAppEngine.triggerToast('模型调用失败，已回落模板模式'); } catch (_e) {}
          pushCharText(store, curSess, sBar, templateReplyFor(rec));
        });
      }, 900);
    } else {
      setTimeout(function () { pushCharText(store, curSess, sBar, templateReplyFor(rec)); }, 900);
    }
    return;
  }
  // 音频 / pdf / office / zip：诚实说打不开，不假装读过
  var line = rec.kind === 'audio'
    ? '收到了「' + rec.name + '」这段音频，我现在听不了里面的内容，你讲给我听听？'
    : '收到了「' + rec.name + '」，我打不开这个格式，你讲给我听听？';
  setTimeout(function () { pushCharText(store, curSess, sBar, line); }, 900);
};

/* ── 消息卡片 ── */
var fileCardHTML = function (m) {
  var icon = m.kind === 'image' ? '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.5" cy="6.5" r="1.3" fill="currentColor"/><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' : m.kind === 'audio' ? '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M6 12.5V3.5l6.5-1v9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="12.5" r="2" fill="currentColor"/><circle cx="10.5" cy="11.5" r="2" fill="currentColor"/></svg>' : m.kind === 'text' ? '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M4 1.5h5.5L13 5v9.5H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 6h3M6.5 8.5h3M6.5 11h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 2h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  return '<div class="wx-file-card" onclick="WeChatAppEngine.openWxFile(\'' + String(m.id).replace(/'/g, '') + '\')">'
    + '<div class="wx-file-ico">' + icon + '</div>'
    + '<div class="wx-file-meta"><div class="wx-file-name">' + esc(m.name || '文件') + '</div>'
    + '<div class="wx-file-sub">' + esc(fmtSize(m.size)) + ' · ' + esc(m.time || '') + '</div></div>'
    + '<div class="wx-file-open">查看 ›</div></div>';
};

/* ── 查看器 ── */
var ensureViewer = function () {
  var v = document.getElementById('wx-file-viewer');
  if (v) return v;
  v = document.createElement('div');
  v.id = 'wx-file-viewer';
  v.className = 'wx-file-viewer';
  v.innerHTML = '<div class="wx-file-viewer-head"><button type="button" class="wx-file-viewer-back" onclick="window.GroupBO.closeViewer()">‹ 返回</button><div class="wx-file-viewer-title" id="wx-file-viewer-title"></div><div style="width:52px;flex-shrink:0;"></div></div>'
    + '<div class="wx-file-viewer-body" id="wx-file-viewer-body"></div>'
    + '<div class="wx-file-viewer-actions" id="wx-file-viewer-actions" style="display:none;"></div>';
  document.body.appendChild(v);
  return v;
};
var DEST_LABEL = { read: '阅读书架', script: '剧本库', worldbook: '世界书（条目草稿）' };
var openViewer = function (rec, mode, dest) {
  var v = ensureViewer();
  var titleEl = document.getElementById('wx-file-viewer-title');
  var bodyEl = document.getElementById('wx-file-viewer-body');
  var actEl = document.getElementById('wx-file-viewer-actions');
  if (titleEl) titleEl.textContent = rec.name;
  var body = '';
  if (rec.kind === 'text') {
    var full = String(rec.text || '');
    var shown = full.slice(0, 20000);
    body = '<div class="wx-file-text">' + esc(shown) + '</div>'
      + (full.length > 20000 ? '<div class="wx-file-note">内容较长，仅显示前 20000 字。</div>' : '');
    if (rec.stored === 'meta') body += '<div class="wx-file-note">内容未存入本机（空间不足），这里只保留了文件名和大小。</div>';
  } else if (rec.kind === 'image') {
    body = rec.dataUrl
      ? '<img class="wx-file-img" src="' + rec.dataUrl + '" onclick="WeChatAppEngine.zoomImage(this.src)"><div class="wx-file-note">点图片可放大查看。</div>'
      : '<div class="wx-file-unsupported">图片内容不在了（只保留了文件名和大小）。</div>';
  } else if (rec.kind === 'audio') {
    body = rec.dataUrl
      ? '<audio controls src="' + rec.dataUrl + '" style="width:100%;"></audio><div class="wx-file-note">音频来自本地文件，仅在本机播放。</div>'
      : '<div class="wx-file-unsupported">音频内容不在了（只保留了文件名和大小）。</div>';
  } else {
    body = '<div class="wx-file-unsupported">暂不支持在手机内直接打开，已保存到本地文件，可在文件管理里查看。'
      + '<br>文件名：' + esc(rec.name) + '<br>大小：' + esc(fmtSize(rec.size)) + '<br>保存时间：' + esc(new Date(rec.savedAt || Date.now()).toLocaleString('zh-CN')) + '</div>';
    if (rec.stored === 'meta') body += '<div class="wx-file-note">内容未存入本机（空间不足），仅保留了文件名和大小。</div>';
  }
  if (mode === 'save' && dest) {
    body += '<div class="wx-file-note">保存到' + DEST_LABEL[dest] + '前请先看一眼内容，确认无误再点下面的确认保存。</div>';
    actEl.style.display = 'flex';
    actEl.innerHTML = '<div class="wx-file-save-note">将保存到' + DEST_LABEL[dest] + '。' + (dest === 'worldbook' ? '存为草稿（未启用，不会进对话）。' : '') + '</div>'
      + '<button type="button" class="wx-file-save-confirm" onclick="window.GroupBO.confirmSave()">确认保存到' + DEST_LABEL[dest] + '</button>'
      + '<button type="button" class="wx-file-save-cancel" onclick="window.GroupBO.closeViewer()">取消</button>';
  } else {
    actEl.style.display = 'none';
    actEl.innerHTML = '';
  }
  bodyEl.innerHTML = body;
  v.classList.add('on');
  return v;
};
var closeViewer = function () {
  var v = document.getElementById('wx-file-viewer');
  if (v) v.classList.remove('on');
  BO._pendingSave = null;
};
var findMsg = function (sid, mid) {
  try {
    var st = wxStore();
    if (!st) return null;
    var s = (st.sessions || []).find(function (x) { return x.id === sid; });
    if (!s) return null;
    var m = (s.messages || []).find(function (x) { return x.id === mid; });
    return m ? { sess: s, msg: m } : null;
  } catch (e) { return null; }
};
var currentMsg = function (mid) {
  try {
    var st = wxStore();
    if (!st) return null;
    var s = (st.sessions || []).find(function (x) { return x.id === st.currentChatId; });
    if (!s) return null;
    var m = (s.messages || []).find(function (x) { return x.id === mid; });
    return m ? { sess: s, msg: m } : null;
  } catch (e) { return null; }
};
var openWxFile = function (mid) {
  var found = currentMsg(mid);
  if (!found) { toast('找不到这条消息'); return { ok: false, reason: 'no_message' }; }
  var rec = getFile(found.msg.fileId);
  if (!rec) { toast('文件记录不在了（可能被清理了）'); return { ok: false, reason: 'no_file' }; }
  openViewer(rec, 'view');
  return { ok: true, file: rec };
};

/* ── 记住这个文件：进候选记忆审阅（先审阅再入库，用户确认才记） ── */
var rememberFile = function (sid, mid) {
  var found = findMsg(sid, mid);
  if (!found) { toast('找不到这条消息'); return { ok: false, reason: 'no_message' }; }
  var rec = getFile(found.msg.fileId);
  var label = rec ? ('「' + rec.name + '」（' + kindLabel(rec.kind) + '，' + fmtSize(rec.size) + '）') : '一个文件';
  var excerpt = '';
  if (rec && rec.kind === 'text') {
    var t = rec.text || '';
    if (rec.ext === 'json') { try { var j = JSON.parse(t); excerpt = String(j.title || j.name || '') || firstLine(t); } catch (e) { excerpt = firstLine(t); } }
    else excerpt = firstLine(t);
  }
  var text = '收到文件' + label + '。' + (excerpt ? '开头：「' + String(excerpt).slice(0, 80) + '」' : '');
  var added = false;
  try {
    if (window.GroupAH && window.GroupAH.addToReview) {
      var r = window.GroupAH.addToReview([{ text: text, category: '文件', level: 'L2' }], 'wechat-file');
      added = r && r.added > 0;
    } else if (window.GroupAN && window.GroupAN.proposeMemoryCandidate) {
      added = !!window.GroupAN.proposeMemoryCandidate(text, 'wechat-file');
    }
  } catch (e) { added = false; }
  if (!added) { toast('这条已经在待审里了'); }
  else { toast('已放进候选记忆，去记忆审阅里确认'); }
  try { if (window.GroupAH && window.GroupAH.open) window.GroupAH.open('memreview'); } catch (e) {}
  return { ok: true, added: added, text: text };
};

/* ── 存到阅读 / 剧本 / 世界书：先预览再保存 ── */
var previewSave = function (sid, mid, dest) {
  var found = findMsg(sid, mid);
  if (!found) { toast('找不到这条消息'); return false; }
  var rec = getFile(found.msg.fileId);
  if (!rec) { toast('文件记录不在了（可能被清理了）'); return false; }
  var okKind = dest === 'read' ? (rec.kind === 'text' && (rec.ext === 'txt' || rec.ext === 'md'))
    : dest === 'script' ? (rec.kind === 'text' && rec.ext === 'json')
    : rec.kind === 'text';
  if (!okKind) {
    var why = dest === 'read' ? '只有 .txt / .md 文本能存到阅读书架'
      : dest === 'script' ? '只有 .json 剧本能存到剧本库' : '只有文本能存为世界书条目';
    toast(why + '，这个文件是' + (rec.ext ? '.' + rec.ext : kindLabel(rec.kind)));
    return false;
  }
  if (dest === 'read' && !rec.text) { toast('文件内容不在了，存不了'); return false; }
  if (dest === 'script' && !rec.text) { toast('文件内容不在了，存不了'); return false; }
  if (dest === 'worldbook' && !rec.text) { toast('文件内容不在了，存不了'); return false; }
  BO._pendingSave = { fileId: rec.id, dest: dest };
  openViewer(rec, 'save', dest);
  return true;
};
var confirmSave = function () {
  var p = BO._pendingSave;
  if (!p) return false;
  var r = saveTo(p.dest, p.fileId);
  if (r.ok) { closeViewer(); toast(r.message); }
  else { toast(r.message); }
  return r.ok;
};
var lsGetJson = function (k, fb) { try { var v = localStorage.getItem(k); if (v == null) return fb; var d = JSON.parse(v); return d == null ? fb : d; } catch (e) { return fb; } };
var saveTo = function (dest, fileId) {
  var rec = getFile(fileId);
  if (!rec) return { ok: false, message: '文件记录不在了，存不了' };
  if (dest === 'read') {
    if (rec.kind !== 'text' || (rec.ext !== 'txt' && rec.ext !== 'md') || !rec.text) return { ok: false, message: '只有 .txt / .md 文本能存到阅读书架' };
    var raw = lsGetJson(NOVEL_KEY, null);
    var books = (raw && Array.isArray(raw.books)) ? raw.books : [];
    var folders = (raw && Array.isArray(raw.folders)) ? raw.folders : [];
    var title = rec.name.replace(/\.[^.]+$/, '') || '未命名';
    if (books.some(function (b) { return b && b.title === title; })) return { ok: false, message: '书架里已经有同名的一本了（' + title + '），没重复存' };
    books.unshift({ id: 'book_wxfile_' + Date.now().toString(36), title: title, author: '微信文件', cover: '', content: String(rec.text).slice(0, 10000), progress: '已读 0%' });
    try { localStorage.setItem(NOVEL_KEY, JSON.stringify({ books: books, folders: folders })); }
    catch (e) { return { ok: false, message: '书架保存失败（本机空间不足）' }; }
    return { ok: true, message: '已存到阅读书架：' + title };
  }
  if (dest === 'script') {
    if (rec.kind !== 'text' || rec.ext !== 'json' || !rec.text) return { ok: false, message: '只有 .json 剧本能存到剧本库' };
    var norm = normalizeScript(rec.text, rec.name);
    if (!norm.ok) return { ok: false, message: norm.reason };
    try {
      if (window.GD && GD.scriptCore && GD.scriptCore.validateScript) {
        var errs = GD.scriptCore.validateScript(norm.script);
        if (errs && errs.length) return { ok: false, message: '剧本校验没过：' + errs[0] };
      }
    } catch (e) {}
    var arr = lsGetJson(SCRIPT_CUSTOM_KEY, []);
    if (!Array.isArray(arr)) arr = [];
    if (arr.some(function (c) { return c && c.title === norm.script.title; })) return { ok: false, message: '剧本库里已经有同名剧本了（' + norm.script.title + '），没重复存' };
    arr.push(norm.script);
    try { localStorage.setItem(SCRIPT_CUSTOM_KEY, JSON.stringify(arr)); }
    catch (e) { return { ok: false, message: '剧本库保存失败（本机空间不足）' }; }
    return { ok: true, message: '已存到剧本库：' + norm.script.title };
  }
  if (dest === 'worldbook') {
    if (rec.kind !== 'text' || !rec.text) return { ok: false, message: '只有文本能存为世界书条目' };
    if (!window.WorldBook || !window.WorldBook.getAll || !window.WorldBook.setAll) return { ok: false, message: '世界书还没加载，存不了' };
    var wbTitle = rec.name.replace(/\.[^.]+$/, '') || '未命名';
    var entries = window.WorldBook.getAll();
    if (entries.some(function (e) { return e && e.title === wbTitle; })) return { ok: false, message: '世界书里已经有同名条目了，没重复存' };
    entries.push({ id: 'wb_wxfile_' + Date.now().toString(36), title: wbTitle, badge: '文件', content: String(rec.text).slice(0, 2000),
      scope: 'global', char: '', keywords: [], trigger: 'always', position: 'before', enabled: false });
    try { window.WorldBook.setAll(entries); }
    catch (e) { return { ok: false, message: '世界书保存失败' }; }
    return { ok: true, message: '已存为世界书条目草稿（未启用，不会进对话，去世界书里启用）' };
  }
  return { ok: false, message: '未知目的地' };
};
var normalizeScript = function (text, fileName) {
  var j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, reason: '这个 JSON 解析失败，不是有效的剧本 JSON' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, reason: '这个 JSON 不是剧本（需要一个对象，含标题与场景）' };
  var title = String(j.title || '').trim() || fileName.replace(/\.[^.]+$/, '');
  var scenesIn = Array.isArray(j.scenes) ? j.scenes : null;
  if ((!scenesIn || !scenesIn.length) && typeof j.content === 'string' && j.content.trim()) scenesIn = [{ title: '第一幕', lines: j.content }];
  if (!scenesIn || !scenesIn.length) return { ok: false, reason: '这个 JSON 里没有场景（需要 scenes 数组，或 content 文本）' };
  var scenes = [];
  for (var i = 0; i < scenesIn.length; i++) {
    var s = scenesIn[i] || {};
    var rawLines = Array.isArray(s.lines) ? s.lines : (typeof s.lines === 'string' ? s.lines.split('\n') : (typeof s === 'string' ? s.split('\n') : []));
    var lines = [];
    rawLines.forEach(function (ln) {
      if (ln && typeof ln === 'object') { if (String(ln.text || '').trim()) lines.push({ who: ln.who || 'narr', text: String(ln.text).trim() }); return; }
      var t = String(ln || '').trim(); if (!t) return;
      var m = t.match(/^(.{1,6})[：:]\s*(.+)$/);
      if (m) lines.push({ who: m[1] === '你' ? 'you' : (m[1] === '旁白' || m[1] === '叙述' ? 'narr' : 'char'), text: m[2] });
      else lines.push({ who: 'narr', text: t });
    });
    if (!lines.length) return { ok: false, reason: '第' + (i + 1) + '幕没有台词' };
    scenes.push({ title: String(s.title || ('第' + (i + 1) + '幕')), lines: lines, linesText: lines.map(function (l) { return l.text; }).join('\n') });
  }
  var endingsIn = Array.isArray(j.endings) ? j.endings : null;
  if (!endingsIn || endingsIn.length < 2) return { ok: false, reason: '这个 JSON 里没有结局（至少要两个结局：好结局 / 普通结局）' };
  var endings = endingsIn.map(function (e) { return typeof e === 'string' ? { label: e, text: '' } : { label: String(e.label || e.title || ''), text: String(e.text || '') }; }).filter(function (e) { return e.label; });
  if (endings.length < 2) return { ok: false, reason: '这个 JSON 里没有结局（至少要两个结局：好结局 / 普通结局）' };
  return { ok: true, script: { id: 'sc_wxfile_' + Date.now().toString(36), title: title, desc: String(j.desc || j.description || ''),
    setting: String(j.setting || ''), scenes: scenes, endings: endings,
    hiddenThreadText: '', hiddenThreadNode: '', charGoal: '', charGoalDone: '', charGoalFail: '', fromFile: fileName } };
};

/* ── 长按菜单接线 ── */
var ctxFileAction = function (action) {
  var t = null;
  try { t = AppRegistry['wechat'] && AppRegistry['wechat'].activeContextMsgId; } catch (e) {}
  if (!t) { toast('没选中消息'); return; }
  if (action === 'bo_remember_file') { rememberFile(t.sid, t.mid); return; }
  if (action === 'bo_save_read') { previewSave(t.sid, t.mid, 'read'); return; }
  if (action === 'bo_save_script') { previewSave(t.sid, t.mid, 'script'); return; }
  if (action === 'bo_save_worldbook') { previewSave(t.sid, t.mid, 'worldbook'); return; }
};
var syncCtxItems = function (sid, mid) {
  var found = findMsg(sid, mid);
  var show = !!(found && found.msg && found.msg.type === 'file');
  var items = document.querySelectorAll('[data-bo-file]');
  items.forEach(function (el) { el.style.display = show ? '' : 'none'; });
};

var BO = {
  MARK: 'GROUP-BO',
  keys: { files: KEY },
  MAX_FILE: MAX_FILE,
  lastReject: null,
  _pendingSave: null,
  fmtSize: fmtSize,
  esc: esc,
  listFiles: listFiles,
  getFile: getFile,
  saveFileRecord: saveFileRecord,
  fileCardHTML: fileCardHTML,
  templateReplyFor: templateReplyFor,
  handleFileUpload: handleFileUpload,
  replyToFile: replyToFile,
  openWxFile: openWxFile,
  openViewer: openViewer,
  closeViewer: closeViewer,
  previewSave: previewSave,
  confirmSave: confirmSave,
  saveTo: saveTo,
  rememberFile: rememberFile,
  ctxFileAction: ctxFileAction,
  syncCtxItems: syncCtxItems,
  normalizeScript: normalizeScript
};
window.GroupBO = BO;

/* 挂到 WeChatAppEngine（inline onchange / onclick 在事件发生时解析） */
try {
  if (window.WeChatAppEngine) {
    WeChatAppEngine.handleFileUpload = function (input) { return BO.handleFileUpload(input); };
    WeChatAppEngine.openWxFile = function (mid) { return BO.openWxFile(mid); };
    if (typeof WeChatAppEngine.showContextMenu === 'function' && !WeChatAppEngine.showContextMenu._boWrapped) {
      var _origShowCtx = WeChatAppEngine.showContextMenu;
      var _wrappedShowCtx = function (e, sid, mid) {
        var out = _origShowCtx.apply(this, arguments);
        try { BO.syncCtxItems(sid, mid); } catch (err) {}
        return out;
      };
      _wrappedShowCtx._boWrapped = true;
      WeChatAppEngine.showContextMenu = _wrappedShowCtx;
    }
    if (typeof WeChatAppEngine.ctxAction === 'function' && !WeChatAppEngine.ctxAction._boWrapped) {
      var _origCtxAct = WeChatAppEngine.ctxAction;
      var _wrappedCtxAct = function (action) {
        if (typeof action === 'string' && action.indexOf('bo_') === 0) {
          try { var _m = document.getElementById('wx-ctx-menu'); if (_m) _m.classList.remove('wx-active'); } catch (err) {}
          try { BO.ctxFileAction(action); } catch (err) { console.warn('[GroupBO] ctxAction 失败', err); }
          return;
        }
        return _origCtxAct.apply(this, arguments);
      };
      _wrappedCtxAct._boWrapped = true;
      WeChatAppEngine.ctxAction = _wrappedCtxAct;
    }
  }
} catch (e) { console.warn('[GroupBO] 挂接失败', e); }

/* 整屋导出过大提示（只提示，不改数据） */
try {
  if (window.GroupAH && window.GroupAH.exportHome && !window.GroupAH.exportHome._boWrapped) {
    var _origExport = window.GroupAH.exportHome;
    var _wrappedExport = function () {
      var out = _origExport.apply(this, arguments);
      try {
        var len = JSON.stringify(out).length;
        if (len > 2 * 1024 * 1024) toast('整屋备份较大（约 ' + (len / 1048576).toFixed(1) + ' MB，含微信文件），导出可能较慢，失败时可先清理旧文件再试');
      } catch (err) {}
      return out;
    };
    _wrappedExport._boWrapped = true;
    window.GroupAH.exportHome = _wrappedExport;
  }
} catch (e) {}
})();
