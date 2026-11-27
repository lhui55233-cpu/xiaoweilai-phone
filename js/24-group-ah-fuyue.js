
/* GROUP-AH-FUYUE · AH 组：赴约（fuyue）借鉴 12 项 ============================================================
   出处：赴约 https://github.com/TangfanOVO/fuyue（AGPL-3.0-only；packages/ui、Showcase、
   颜文字抽屉单独 MIT）。只借鉴做法，本模块全部为新写代码，未复制赴约的任何代码
   （连 MIT 部分也只借思路）；未引入 relay、React、IndexedDB、ElevenLabs/豆包语音、
   五栏导航、服务器与部署。AGPL 代码一行未碰。
   已合入的组（复用，不另起炉灶）：T 组备份安全模型（window.SafeBackupT）、O 组内心
   开关/日志（window.CharInnerLife）、X 组影院小本本（window.GroupX / cinema_notes_v1）、
   M 组桌面宠物（window.GroupM.pet.poke）、P 组动作台（window.GroupP.motion）、
   N 组一起玩角落、F 组 3D 家（OtomeF）、D 组电话拨号盘（GD.phoneApp，机内模拟）。
   未合入的组（本模块先按任务给定的键名与形状自己实现，汇报写清，待该组合并后以该组为准）：
   W 组桌面与外观（本模块自带外观包页）、Z 组装修方案（本模块自带装修日记，
   钩子挂在 3D 家第一次碰家具处）、AG 组接模型已合入（本模块自带模型连接页 + 数据承诺页，与 AG 的两键设计对齐：key 单存 phone_model_key_v1，与 PhoneModel 共用）。
   新增键（只新增，不改已有键）：phone_model_cfg_v1 /
   guichao_mem_review_v1 / char_tools_audit_v1 / otome_toys_v1 / cike_journey_v1 /
   cinema_watchlist_v1 / otome_decor_log_v1 / phone_call_transcripts_v1 /
   char_signature_v1 / char_room_notes_v1 / phone_model_audit_v1。
   只读复用旧键：guichao.memories.v1、guichao.diaries.v1、phone_wechat_store_v2、
   phone_ui_prefs_v1、char_inner_log_v1、char_inner_switches_v1、otome_home_v1、
   otome_affection_v1、cinema_notes_v1、phone_call_log_v1、cike_cache_v1、
   phone_my_persona / phone_my_persona_data / os_character。
   绝不写入的键：phone_model_key_v1（只存本机的 key）不进整屋导出、不进外观包（见 exportHome
   的 EXCLUDE_KEYS；手机自带的整体备份归档 phone_backups_v1 是 T 组整体快照，
   模型页里已如实提示这一点，不谎称已排除）。
   标记：GroupAH-v1
   （2026-11-27 删环境漂浮物：漂浮物键、漂浮物子页、漂浮层、相关函数与 setAppearance 工具整段删除；已存数据不主动删，只停用不读取。）
   ============================================================================================= */
(function () {
'use strict';
var MARK = 'GroupAH-v1';
var MODEL_KEY = 'phone_model_cfg_v1';
var KEY_KEY = 'phone_model_key_v1'; // AG 组已合入：key 单独存此键，与 AG 的 PhoneModel 共用；AH 已对齐，apiKey 不再进 phone_model_cfg_v1。
var REVIEW_KEY = 'guichao_mem_review_v1';
var AUDIT_KEY = 'char_tools_audit_v1';
var TOYS_KEY = 'otome_toys_v1';
var JOURNEY_KEY = 'cike_journey_v1';
var WATCH_KEY = 'cinema_watchlist_v1';
var DECOR_KEY = 'otome_decor_log_v1';
var CALLTR_KEY = 'phone_call_transcripts_v1';
var SIG_KEY = 'char_signature_v1';
var ROOMNOTE_KEY = 'char_room_notes_v1';
var MODELAUDIT_KEY = 'phone_model_audit_v1';
var MEM_KEY = 'guichao.memories.v1';
var DIARY_KEY = 'guichao.diaries.v1';
var WX_KEY = 'phone_wechat_store_v2';
var PREFS_KEY = 'phone_ui_prefs_v1';
var INNERLOG_KEY = 'char_inner_log_v1';
var HOME_KEY = 'otome_home_v1';
var AFF_KEY = 'otome_affection_v1';
var NOTES_KEY = 'cinema_notes_v1';
var CALLLOG_KEY = 'phone_call_log_v1';
var EXCLUDE_KEYS = [MODEL_KEY, KEY_KEY, 'phone_minimax_cfg', 'phone_lock_passcode', 'phone_backups_v1', 'phone_undo_v1', 'phone_model_fallback_keys_v1'];
var HOME_KEYS = [MEM_KEY, DIARY_KEY, WX_KEY, PREFS_KEY, REVIEW_KEY, INNERLOG_KEY, 'phone_model_fallback_v1', 'wx_files_v1', // GROUP-BO · BO-9 微信文件随整屋备份走
  'char_inner_switches_v1', HOME_KEY, AFF_KEY, TOYS_KEY, JOURNEY_KEY, NOTES_KEY, WATCH_KEY,
  CALLTR_KEY, AUDIT_KEY, DECOR_KEY, SIG_KEY, ROOMNOTE_KEY, 'char_goals_v1', 'char_promises_v1',
  'cike_char_look_v1', 'phone_my_persona', 'phone_my_persona_data', 'os_character',
  'char:imported_chats_v1', CALLLOG_KEY, 'phone_manual_contacts_v1', 'phone_sms_v1',
  'phone_album_local_v1', 'cinema_progress_v1', 'cinema_chat_v1', 'cinema_tickets_v1',
  'cinema_settings_v1', 'char_drives_v1', 'char_dreams_v1'];
var OVERWRITE_KEYS = ['phone_my_persona', 'phone_my_persona_data', 'os_character', 'cike_char_look_v1'];
var TOOL_NAMES = ['setSignature', 'writeReviewMemory', 'writeRoomNote', 'createToy'];
var POKE_LINES = ['嗯？怎么啦。', '嘿嘿，戳到我啦。', '我在呢，别戳啦。', '今天也想和你待在一起。', '……干嘛这样看着我。'];
var _seenMsgIds = {};
var _call = null;
var _whack = { active: false, score: 0, left: 0, mole: -1, timer: null };

function read(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function rawSet(k, raw) { try { if (raw == null) localStorage.removeItem(k); else localStorage.setItem(k, raw); return true; } catch (e) { return false; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function uid(p) { return (p || 'ah') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }
function nowISO() { return new Date().toISOString(); }
function pad2(n) { return String(n).padStart(2, '0'); }
function dayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function toast(msg) {
  try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine.triggerToast) { WeChatAppEngine.triggerToast(msg); return; } } catch (e) {}
  try { if (typeof SysDialog !== 'undefined' && SysDialog.alert) { SysDialog.alert(msg); return; } } catch (e) {}
  try { alert(msg); } catch (e) {}
}
function downloadFile(name, text, mime) {
  try {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 800);
    return true;
  } catch (e) { return false; }
}
function charName() {
  try { if (typeof SystemStore !== 'undefined' && SystemStore.get) { var c = SystemStore.get('character'); if (c) return c; } } catch (e) {}
  try { if (typeof MemoryCore !== 'undefined' && MemoryCore.world) { var a = MemoryCore.world.get('activeChar'); if (a) return a; } } catch (e) {}
  return '他';
}
function handsOn() {
  try { if (window.CharInnerLife && window.CharInnerLife.getSwitches) return !!window.CharInnerLife.getSwitches().hands; } catch (e) {}
  return true;
}
function mindOn() {
  try { if (window.CharInnerLife && window.CharInnerLife.getSwitches) return !!window.CharInnerLife.getSwitches().mind; } catch (e) {}
  return true;
}

/* ── 3. 模型连接 + 数据承诺 ── */
var MODEL_DEFAULT = { baseUrl: '', model: '', temperature: 0.7, maxTokens: 1024,
  master: false, features: { chat: true, script: true, diary: true, inner: true }, updatedAt: 0 };
function getModelCfg() {
  var c = read(MODEL_KEY, null);
  var out = JSON.parse(JSON.stringify(MODEL_DEFAULT));
  if (c && typeof c === 'object') {
    Object.keys(MODEL_DEFAULT).forEach(function (k) { if (c[k] !== undefined) out[k] = c[k]; });
    if (c.features && typeof c.features === 'object') {
      Object.keys(MODEL_DEFAULT.features).forEach(function (k) { if (typeof c.features[k] === 'boolean') out.features[k] = c.features[k]; });
    }
  }
  out.apiKey = read(KEY_KEY, '') || ''; // key 只读镜像：只存 phone_model_key_v1，绝不写进 cfg。
  return out;
}
function saveModelCfg(patch) {
  var cur = getModelCfg();
  if (patch && patch.apiKey !== undefined) { var _k = String(patch.apiKey || '').trim(); try { if (_k) { localStorage.setItem(KEY_KEY, JSON.stringify(_k)); } else { localStorage.removeItem(KEY_KEY); } } catch (e) {} delete patch.apiKey; }
  Object.keys(patch || {}).forEach(function (k) {
    if (k === 'features' && patch.features && typeof patch.features === 'object') {
      Object.keys(patch.features).forEach(function (f) { if (f in cur.features) cur.features[f] = !!patch.features[f]; });
    } else if (k in cur) { cur[k] = patch[k]; }
  });
  cur.updatedAt = Date.now();
  delete cur.apiKey; // 防御：apiKey 只存 KEY_KEY，绝不随 cfg 持久化。
  write(MODEL_KEY, cur);
  return cur;
}
function clearModelKey() { try { localStorage.removeItem(KEY_KEY); } catch (e) {} var c = getModelCfg(); c.apiKey = ''; c.master = false; c.updatedAt = Date.now(); delete c.apiKey; write(MODEL_KEY, c); return c; }
function modelReady() { var c = getModelCfg(); return !!(c.master && c.apiKey && c.baseUrl && c.model); }
function featureOn(kind) { var c = getModelCfg(); return modelReady() && !!c.features[kind]; }
/* 按数据承诺裁剪上下文（纯函数，可测）：聊天只带本轮 + 48h 内最多 100 条原文；
   电话只带本通最近 8 轮；记忆只带已审且启用的；绝不带 apiKey。 */
function buildModelPayload(kind, opts) {
  opts = opts || {};
  var now = Date.now();
  var within48h = function (m) { var t = m.ts || m.time || 0; var n = (typeof t === 'number') ? t : Date.parse(t); return !n || (now - n) <= 48 * 3600 * 1000; };
  var msgs = (opts.messages || []).filter(within48h);
  if (kind === 'call') msgs = msgs.slice(-8);
  else msgs = msgs.slice(-100);
  var mems = recallMemories('').filter(function (m) { return m.status === 'approved' && m.enabled !== false; });
  if (kind === 'call') mems = [];
  var personas = (opts.personas || []).slice(0, 2).map(function (p) { return { name: p.name || '', bio: p.bio || '' }; });
  var out = {
    kind: kind, model: getModelCfg().model,
    messages: msgs.map(function (m) { return { role: m.role || 'user', content: String(m.text || m.content || '') }; }),
    personas: personas,
    memories: mems.slice(0, 20).map(function (m) { return { id: m.id, level: m.level, text: m.text }; }),
    meta: { sentMessages: msgs.length, sentMemories: Math.min(mems.length, 20), within48h: true, cap: kind === 'call' ? 8 : 100 }
  };
  return out;
}
function noteModelAudit(kind, payload, ok) {
  var list = read(MODELAUDIT_KEY, []);
  if (!Array.isArray(list)) list = [];
  list.push({ ts: Date.now(), time: nowISO(), kind: kind, sentMessages: payload.meta.sentMessages,
    sentMemories: payload.meta.sentMemories, cap: payload.meta.cap, ok: !!ok });
  if (list.length > 20) list = list.slice(-20);
  write(MODELAUDIT_KEY, list);
  return list[list.length - 1];
}
function callModel(kind, opts) {
  var cfg = getModelCfg();
  if (!modelReady()) return Promise.resolve({ ok: false, reason: 'no_model' });
  if (!featureOn(kind) && kind !== 'call') return Promise.resolve({ ok: false, reason: 'feature_off' });
  if (typeof fetch === 'undefined') return Promise.resolve({ ok: false, reason: 'fetch_unavailable' });
  var payload = buildModelPayload(kind, opts);
  var url = String(cfg.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  var body = { model: cfg.model, temperature: cfg.temperature, max_tokens: cfg.maxTokens,
    messages: payload.messages.concat(payload.memories.length ? [{ role: 'system', content: '已审记忆（仅供参考）：' + payload.memories.map(function (m) { return m.text; }).join('；') }] : []) };
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var text = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      noteModelAudit(kind, payload, !!text);
      if (!text) return { ok: false, reason: 'empty_reply', payload: payload };
      return { ok: true, text: String(text), payload: payload };
    })
    .catch(function (e) { noteModelAudit(kind, payload, false); return { ok: false, reason: 'fetch_failed', error: String(e && e.message || e), payload: payload }; });
}
function testModelConnection() {
  var cfg = getModelCfg();
  if (!cfg.baseUrl || !cfg.apiKey) return Promise.resolve({ ok: false, reason: 'missing_config', text: '请先填 Base URL 和 API Key。' });
  if (typeof fetch === 'undefined') return Promise.resolve({ ok: false, reason: 'fetch_unavailable', text: '当前环境没有 fetch，无法测试连接。' });
  var url = String(cfg.baseUrl).replace(/\/+$/, '') + '/models';
  return fetch(url, { method: 'GET', headers: { 'Authorization': 'Bearer ' + cfg.apiKey } })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
    .then(function (r) {
      if (!r.ok) return { ok: false, reason: 'http_' + r.status, text: '连接失败：HTTP ' + r.status + '。请检查 Base URL 与 Key。' };
      return { ok: true, reason: '', text: '连接成功：模型服务可达。' };
    })
    .catch(function (e) { return { ok: false, reason: 'fetch_failed', text: '连接失败：' + String(e && e.message || e) + '。离线或地址不对时会出现这句，不造假。' }; });
}
var PROMISE_TEXT = '数据承诺（写死在这里，说到做到）：默认不调用任何模型、不向网络发送本地数据。' +
  '拍照与录音只在你点按时才请求权限；拍到的照片、录到的语音只存本机，不上传任何地方；拒绝后不会反复弹窗，可在原功能里点“重新请求权限”。' +
  '只有你主动发送消息或打电话时，才会把以下内容交给模型：本轮对话 + 48 小时内最多 100 条近期原文 + ' +
  '你和 char 两个人的人物资料 + 你明确启用且已审过的记忆。电话只带本通最近 8 轮，不带记忆。' +
  'API Key 只存在这台手机本地，不会随整屋导出或外观包离开这台手机，可随时清除。' +
  '注意：手机自带的整体备份归档（phone_backups_v1）是 T 组整体快照，会整体存一份当前状态，' +
  '如在意这一点，请先清除密钥再做整体归档——整屋导出本身已排除密钥。';

/* ── 2. 记忆 L1/L2/L3 + 审阅制 ── */
function getReview() { var a = read(REVIEW_KEY, []); return Array.isArray(a) ? a : []; }
function saveReview(list) { write(REVIEW_KEY, list); return list; }
function getGuichaoMemories() {
  var raw = read(MEM_KEY, null);
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.memories)) return raw.memories;
  if (raw && typeof raw === 'object') return Object.keys(raw).map(function (k) { var m = raw[k]; if (m && typeof m === 'object') { m.id = m.id || k; return m; } return { id: k, content: String(m) }; });
  return [];
}
function memTextOf(m) { return m.content || m.text || m.body || m.summary || m.title || ''; }
function addToReview(items, source) {
  var list = getReview();
  var added = 0, skipped = 0;
  (items || []).forEach(function (it) {
    var text = String((it && (it.text || it.content)) || '').trim();
    if (!text) { skipped++; return; }
    var srcId = it.id != null ? String(it.id) : '';
    var dup = list.some(function (x) { return (srcId && x.srcId === srcId) || (x.text === text && x.category === (it.category || it.cat || '未分类')); });
    if (dup) { skipped++; return; }
    list.push({ id: uid('rev'), srcId: srcId, text: text, category: it.category || it.cat || it.type || '未分类',
      level: it.level || ((it.factKey || it.fact_key) ? 'L1' : 'L2'),
      factKey: it.factKey || it.fact_key || '',
      status: 'pending', enabled: true, source: source || 'manual', ts: Date.now(), time: nowISO() });
    added++;
  });
  saveReview(list);
  return { added: added, skipped: skipped, total: list.length };
}
function importGuichaoToReview() {
  var mems = getGuichaoMemories();
  return addToReview(mems.map(function (m) { return { id: m.id, text: memTextOf(m), category: m.category || m.cat || '未分类', factKey: m.factKey || m.fact_key || '' }; }), 'guichao');
}
function reviewMemory(id, action) {
  var list = getReview();
  var found = null;
  list.forEach(function (x) { if (String(x.id) === String(id)) found = x; });
  if (!found) return { ok: false, reason: 'not_found' };
  if (action === 'approve') { found.status = 'approved'; }
  else if (action === 'disable') { found.enabled = false; }
  else if (action === 'enable') { found.enabled = true; }
  else if (action === 'reject') { found.status = 'rejected'; }
  else if (action === 'promote') { found.level = found.level === 'L1' ? 'L2' : 'L3'; }
  else if (action === 'delete') { list = list.filter(function (x) { return String(x.id) !== String(id); }); saveReview(list); return { ok: true, action: action }; }
  else return { ok: false, reason: 'bad_action' };
  found.reviewedAt = Date.now();
  saveReview(list);
  return { ok: true, action: action, item: found };
}
/* 召回只读已审过且启用了的记忆；待审草稿、已停用、已拒绝的一律不进。 */
function recallMemories(q) {
  var list = getReview().filter(function (x) { return x.status === 'approved' && x.enabled !== false; });
  if (q && String(q).trim()) {
    var ql = String(q).toLowerCase();
    list = list.filter(function (x) { return (x.text || '').toLowerCase().indexOf(ql) >= 0 || (x.category || '').toLowerCase().indexOf(ql) >= 0 || (x.factKey || '').toLowerCase().indexOf(ql) >= 0; });
  }
  return list;
}

/* ── 1. 整屋可搬走（接 T 组备份恢复流程） ── */
function homeValueOf(key) {
  var raw = rawGet(key);
  if (raw == null) return { present: false, value: null };
  try { return { present: true, value: JSON.parse(raw) }; } catch (e) { return { present: true, value: { __raw: raw } }; }
}
function exportHome() {
  var keys = {};
  HOME_KEYS.forEach(function (k) { if (EXCLUDE_KEYS.indexOf(k) >= 0) return; var v = homeValueOf(k); if (v.present) keys[k] = v.value; });
  return { format: 'phone_home_export_v1', version: 1, exportedAt: nowISO(), app: MARK,
    note: '整屋导出：不含模型 API Key、不含锁屏密码、不含备份归档本身。',
    counts: {}, keys: keys };
}
function itemId(it) { if (it && typeof it === 'object' && it.id != null) return String(it.id); return null; }
function mergeArrayValues(cur, inc) {
  var curArr = Array.isArray(cur) ? cur.slice() : [];
  var incArr = Array.isArray(inc) ? inc : [];
  var seenIds = {}, seenJson = {};
  curArr.forEach(function (it) { var id = itemId(it); if (id) seenIds[id] = true; else seenJson[JSON.stringify(it)] = true; });
  var added = 0, skipped = 0;
  incArr.forEach(function (it) {
    var id = itemId(it);
    if (id) { if (seenIds[id]) { skipped++; return; } seenIds[id] = true; }
    else { var j = JSON.stringify(it); if (seenJson[j]) { skipped++; return; } seenJson[j] = true; }
    curArr.push(it); added++;
  });
  return { value: curArr, added: added, skipped: skipped };
}
function mergeWxStore(cur, inc) {
  var c = (cur && typeof cur === 'object') ? cur : {};
  var n = (inc && typeof inc === 'object') ? inc : {};
  var sessions = Array.isArray(c.sessions) ? c.sessions.slice() : [];
  var byId = {};
  sessions.forEach(function (s) { if (s && s.id != null) byId[String(s.id)] = s; });
  var addedSess = 0, addedMsg = 0, skipped = 0;
  (Array.isArray(n.sessions) ? n.sessions : []).forEach(function (s) {
    if (!s || s.id == null) { skipped++; return; }
    var ex = byId[String(s.id)];
    if (!ex) { sessions.push(s); addedSess++; return; }
    var curMsgs = Array.isArray(ex.messages) ? ex.messages : [];
    var ids = {};
    curMsgs.forEach(function (m) { if (m && m.id != null) ids[String(m.id)] = true; });
    (Array.isArray(s.messages) ? s.messages : []).forEach(function (m) {
      if (!m || m.id == null || ids[String(m.id)]) { skipped++; return; }
      curMsgs.push(m); ids[String(m.id)] = true; addedMsg++;
    });
    ex.messages = curMsgs;
  });
  var out = {};
  Object.keys(c).forEach(function (k) { out[k] = c[k]; });
  Object.keys(n).forEach(function (k) { if (k !== 'sessions' && out[k] === undefined) out[k] = n[k]; });
  out.sessions = sessions;
  return { value: out, added: addedSess + addedMsg, skipped: skipped };
}
function previewHomeImport(data) {
  if (!data || data.format !== 'phone_home_export_v1' || !data.keys || typeof data.keys !== 'object') return { ok: false, reason: 'bad_format' };
  var lines = [], totalAdd = 0, totalSkip = 0, conflicts = 0;
  Object.keys(data.keys).forEach(function (k) {
    if (EXCLUDE_KEYS.indexOf(k) >= 0) { lines.push({ key: k, change: '已排除（不导入）', add: 0 }); return; }
    var cur = homeValueOf(k);
    var inc = data.keys[k];
    if (!cur.present) { var n = Array.isArray(inc) ? inc.length : 1; lines.push({ key: k, change: '新增', add: n }); totalAdd += n; return; }
    if (k === WX_KEY) { var r = mergeWxStore(cur.value, inc); lines.push({ key: k, change: '合并（会话/消息按 id 去重）', add: r.added, skip: r.skipped }); totalAdd += r.added; totalSkip += r.skipped; return; }
    if (Array.isArray(cur.value) && Array.isArray(inc)) {
      var m = mergeArrayValues(cur.value, inc);
      lines.push({ key: k, change: '合并（按 id 去重，已存在 ' + m.skipped + ' 条跳过）', add: m.added, skip: m.skipped });
      totalAdd += m.added; totalSkip += m.skipped; conflicts += m.skipped; return;
    }
    if (cur.value && inc && typeof cur.value === 'object' && typeof inc === 'object' && !Array.isArray(cur.value)) {
      var changed = Object.keys(inc).filter(function (f) { return JSON.stringify(cur.value[f]) !== JSON.stringify(inc[f]); }).length;
      lines.push({ key: k, change: '合并字段（' + changed + ' 个字段会被新值覆盖）', add: changed }); totalAdd += changed; return;
    }
    lines.push({ key: k, change: JSON.stringify(cur.value) === JSON.stringify(inc) ? '不变' : '改写', add: JSON.stringify(cur.value) === JSON.stringify(inc) ? 0 : 1 });
    if (JSON.stringify(cur.value) !== JSON.stringify(inc)) totalAdd += 1;
  });
  return { ok: true, lines: lines, totalAdd: totalAdd, totalSkip: totalSkip, conflicts: conflicts,
    summary: '将改变 ' + lines.filter(function (l) { return l.add > 0; }).length + ' 个键，预计新增/改写 ' + totalAdd + ' 处，已存在跳过 ' + totalSkip + ' 处；导入前会先归档当前状态。' };
}
function importHome(data) {
  var prev = previewHomeImport(data);
  if (!prev.ok) return prev;
  var backupId = null;
  try { if (window.SafeBackupT && window.SafeBackupT.archiveCurrent) { var bk = window.SafeBackupT.archiveCurrent('整屋导入前归档', 'phone'); backupId = bk && bk.id; } } catch (e) {}
  var added = {}, skipped = 0;
  Object.keys(data.keys).forEach(function (k) {
    if (EXCLUDE_KEYS.indexOf(k) >= 0) return;
    var cur = homeValueOf(k);
    var inc = data.keys[k];
    if (!cur.present) { write(k, inc); added[k] = Array.isArray(inc) ? inc.length : 1; return; }
    if (k === WX_KEY) { var r = mergeWxStore(cur.value, inc); write(k, r.value); added[k] = r.added; skipped += r.skipped; return; }
    if (Array.isArray(cur.value) && Array.isArray(inc)) {
      if (k === REVIEW_KEY) {
        var list = cur.value.slice(); var ids = {};
        list.forEach(function (x) { if (x && x.id != null) ids[String(x.id)] = true; });
        var a = 0;
        inc.forEach(function (x) { if (x && x.id != null && !ids[String(x.id)]) { list.push(x); ids[String(x.id)] = true; a++; } else skipped++; });
        write(k, list); added[k] = a; return;
      }
      var m = mergeArrayValues(cur.value, inc); write(k, m.value); added[k] = m.added; skipped += m.skipped; return;
    }
    if (cur.value && inc && typeof cur.value === 'object' && typeof inc === 'object' && !Array.isArray(cur.value)) {
      var out = {}; Object.keys(cur.value).forEach(function (f) { out[f] = cur.value[f]; });
      var changed = 0;
      Object.keys(inc).forEach(function (f) { if (JSON.stringify(out[f]) !== JSON.stringify(inc[f])) { out[f] = inc[f]; changed++; } });
      write(k, out); added[k] = changed; return;
    }
    if (JSON.stringify(cur.value) !== JSON.stringify(inc)) { write(k, inc); added[k] = 1; } else added[k] = 0;
  });
  try { if (window.SafeBackupT && window.SafeBackupT.buildMemIndex && (MEM_KEY in added)) window.SafeBackupT.buildMemIndex(); } catch (e) {}
  return { ok: true, added: added, skipped: skipped, backupId: backupId, preview: prev };
}

/* ── 4. 受限本机工具（白名单） ── */
function auditTool(tool, summary, result) {
  var list = read(AUDIT_KEY, []);
  if (!Array.isArray(list)) list = [];
  list.push({ ts: Date.now(), time: nowISO(), tool: tool, summary: String(summary || '').slice(0, 120), result: String(result || '').slice(0, 120) });
  if (list.length > 200) list = list.slice(-200);
  write(AUDIT_KEY, list);
  return list[list.length - 1];
}
function runTool(name, params) {
  params = params || {};
  if (TOOL_NAMES.indexOf(name) < 0) { auditTool(String(name), '拒绝：不在白名单', 'rejected:not_whitelisted'); return { ok: false, reason: 'not_whitelisted' }; }
  if (!handsOn()) { auditTool(name, '拒绝：动手（hands）开关已关', 'rejected:hands_off'); return { ok: false, reason: 'hands_off' }; }
  var r;
  if (name === 'setSignature') {
    var sig = String(params.text || '').slice(0, 60);
    if (!sig) return { ok: false, reason: 'empty' };
    write(SIG_KEY, { text: sig, mood: String(params.mood || '').slice(0, 20), updatedAt: Date.now() });
    r = { ok: true, text: sig };
  } else if (name === 'writeReviewMemory') {
    var a = addToReview([{ text: params.text, category: params.category || '日常记忆', level: params.level || 'L2' }], 'char_tool');
    r = a.added ? { ok: true, added: a.added } : { ok: false, reason: 'duplicate_or_empty' };
  } else if (name === 'writeRoomNote') {
    var room = String(params.room || '客厅').slice(0, 20);
    var text = String(params.text || '').slice(0, 200);
    if (!text) return { ok: false, reason: 'empty' };
    var notes = read(ROOMNOTE_KEY, []);
    if (!Array.isArray(notes)) notes = [];
    notes.push({ id: uid('room'), room: room, text: text, ts: Date.now(), time: nowISO() });
    write(ROOMNOTE_KEY, notes.slice(-100));
    r = { ok: true };
  } else if (name === 'createToy') {
    r = addToy(params.html || '', params.name || '未命名玩具');
  }
  auditTool(name, JSON.stringify(params).slice(0, 120), r && r.ok ? 'ok' : ('failed:' + (r && r.reason || 'unknown')));
  return r;
}

/* ── 5. 环境漂浮物（2026-11-27 整段删除：漂浮物子页、漂浮层与相关函数均已移除；已存数据不主动删，只停用不读取）── */

/* ── 6. 玩具盒 ── */
function listToys() { var a = read(TOYS_KEY, []); return Array.isArray(a) ? a : []; }
function addToy(html, name) {
  var h = String(html || '');
  if (!h.trim()) return { ok: false, reason: 'empty' };
  if (new RegExp('<scr' + 'ipt[^>]+src\\s*=|https?:\\/\\/', 'i').test(h)) return { ok: false, reason: 'external_ref', note: '单文件玩具不含外链：不许外链脚本、图片或地址。' };
  var list = listToys();
  var rec = { id: uid('toy'), name: String(name || '未命名玩具').slice(0, 30), kind: 'imported', html: h, createdAt: Date.now() };
  list.push(rec);
  write(TOYS_KEY, list);
  auditTool('createToy', '导入玩具：' + rec.name, 'ok');
  return { ok: true, toy: rec };
}
function deleteToy(id) { write(TOYS_KEY, listToys().filter(function (t) { return String(t.id) !== String(id); })); return true; }
function playToy(id) {
  var t = listToys().filter(function (x) { return String(x.id) === String(id); })[0];
  if (!t) return { ok: false, reason: 'not_found' };
  auditTool('toy_play', '玩玩具：' + t.name, 'ok');
  return { ok: true, toy: t };
}
function startWhack(seconds) {
  stopWhack();
  _whack.active = true; _whack.score = 0; _whack.left = seconds || 30; _whack.mole = Math.floor(Math.random() * 9);
  _whack.timer = setInterval(function () {
    _whack.left--;
    _whack.mole = Math.floor(Math.random() * 9);
    var s = document.getElementById('ah-whack-time'); if (s) s.textContent = String(Math.max(0, _whack.left));
    renderWhackMole();
    if (_whack.left <= 0) { stopWhack(); auditTool('toy_play', '打地鼠一局结束，得分 ' + _whack.score, 'ok'); var e = document.getElementById('ah-whack-end'); if (e) e.textContent = '时间到！得分 ' + _whack.score + '，已记入游玩记录。'; }
  }, 1000);
  return _whack;
}
function stopWhack() { if (_whack.timer) { clearInterval(_whack.timer); _whack.timer = null; } _whack.active = false; }
function hitWhack(cell) {
  if (!_whack.active) return { ok: false, reason: 'not_active', score: _whack.score };
  if (cell === _whack.mole) { _whack.score++; _whack.mole = Math.floor(Math.random() * 9); renderWhackMole(); var s = document.getElementById('ah-whack-score'); if (s) s.textContent = String(_whack.score); return { ok: true, score: _whack.score }; }
  return { ok: false, reason: 'miss', score: _whack.score };
}
function renderWhackMole() {
  for (var i = 0; i < 9; i++) { var c = document.getElementById('ah-whack-' + i); if (c) c.textContent = (i === _whack.mole && _whack.active) ? '🐹' : '🕳️'; }
}

/* ── 7. 一起看贴链接 ── */
function extractLinks(text) {
  var out = [];
  String(text || '').replace(/https?:\/\/[^\s"'<>）】]+/g, function (u) {
    var clean = u.replace(/[.,;!?、。，]+$/, '');
    if (/xiaohongshu\.com|github\.com/.test(clean)) out.push(clean);
    return u;
  });
  return out;
}
function listWatch() { var a = read(WATCH_KEY, []); return Array.isArray(a) ? a : []; }
function saveWatch(list) { write(WATCH_KEY, list); mirrorWatchToNotes(list); return list; }
function mirrorWatchToNotes(list) {
  try {
    if (!window.GroupX || !window.GroupX.saveNotes) return;
    var txt = (list || []).map(function (w) { return '· ' + w.url + ' ｜ ' + w.status + (w.title ? ' ｜ ' + w.title : '') + (w.comment ? '\n  char 说：' + w.comment : '') + (w.note ? '\n  备注：' + w.note : ''); }).join('\n');
    window.GroupX.saveNotes('__watchlist__', { notes: txt || '待看是空的，贴个小红书或 GitHub 链接进来吧。' });
  } catch (e) {}
}
function addWatch(url, extra) {
  var list = listWatch();
  var ex = null;
  list.forEach(function (w) { if (w.url === url) ex = w; });
  if (ex) { if (extra) Object.keys(extra).forEach(function (k) { ex[k] = extra[k]; }); saveWatch(list); return { added: false, item: ex }; }
  var rec = Object.assign({ id: uid('wl'), url: url, title: '', comment: '', status: 'pending', note: '', ts: Date.now(), time: nowISO() }, extra || {});
  list.push(rec);
  saveWatch(list);
  return { added: true, item: rec };
}
function fetchTitle(url) {
  if (typeof fetch === 'undefined') return Promise.resolve('');
  return fetch(url, { method: 'GET' }).then(function (r) { return r.text(); }).then(function (t) {
    var m = String(t).match(/<title[^>]*>([^<]*)<\/title>/i);
    return m ? m[1].trim().slice(0, 80) : '';
  }).catch(function () { return ''; });
}
function processLink(url) {
  if (!modelReady() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    var r = addWatch(url, { status: 'pending', note: '已存进待看，有网有模型时再看。' });
    return Promise.resolve({ ok: true, mode: 'watchlist', item: r.item });
  }
  return fetchTitle(url).then(function (title) {
    return callModel('chat', { messages: [{ role: 'user', text: '我贴了一个链接' + (title ? '，标题是「' + title + '」' : '，标题读不到') + '：' + url + '。请用一两句话说说你对它的看法，像平时聊天那样。', ts: Date.now() }], personas: [] })
      .then(function (res) {
        if (!res.ok) { addWatch(url, { title: title, status: 'pending', note: '模型这次没回（' + res.reason + '），先存进待看。' }); return { ok: false, mode: 'watchlist', reason: res.reason }; }
        var rr = addWatch(url, { title: title, comment: res.text, status: 'commented', note: '' });
        return { ok: true, mode: 'commented', item: rr.item };
      });
  });
}
function onUserMessage(sess, msg) {
  try {
    if (!msg || !msg.id || _seenMsgIds[msg.id]) return;
    _seenMsgIds[msg.id] = true;
    var links = extractLinks(msg.content || msg.text || '');
    if (!links.length) return;
    links.forEach(function (u) {
      processLink(u).then(function () { try { toast('链接已处理，见「一起看 · 待看」。'); } catch (e) {} });
    });
  } catch (e) {}
}

/* ── 8. 旅行手记（纯文字） ── */
function listJourney() { var a = read(JOURNEY_KEY, []); return Array.isArray(a) ? a : []; }
function addJourney(date, place, text, extra) {
  var t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  var list = listJourney();
  var ex = extra || {};
  var stars = parseInt(ex.stars, 10);
  if (isNaN(stars)) stars = 0;
  if (stars < 0) stars = 0;
  if (stars > 5) stars = 5;
  var rec = {
    id: uid('jr'), date: String(date || dayStr()), place: String(place || '').slice(0, 40),
    text: t.slice(0, 2000), ts: Date.now(),
    transport: String(ex.transport || '').slice(0, 20),
    from: String(ex.from || '').slice(0, 40),
    to: String(ex.to || '').slice(0, 40),
    stars: stars, comment: String(ex.comment || '').slice(0, 200)
  };
  list.push(rec);
  write(JOURNEY_KEY, list);
  return { ok: true, item: rec };
}

// [GROUP-MERGEAWESOME·F8] 旅行足迹（Stopover 做法，CC BY-NC-SA 4.0；只借“旅行地球仪
// + 登机牌日志 + 打星”的做法，代码全部自写；照片本次不做——手记原设计就是纯文字，
// 且照片进 localStorage 有配额风险，以后走既有相册管线再接）。
/* TravelSyncAdapter：旅行同步的“以后接什么”只落在这里。现在本地兜底：只存本机；
   以后接自建 Stopover / Morrow 服务器时，填 endpoint，并在 push 里用 fetch POST 到 /api/trips。
   同步队列只放内存（_queue），重启即清空——不写新键，不谎称已同步。 */
var TravelSyncAdapter = {
  endpoint: null,
  _queue: [],
  setEndpoint: function (url) { this.endpoint = String(url || '').replace(/\/$/, '') || null; return this.endpoint; },
  status: function () { return this.endpoint ? ('已接服务器：' + this.endpoint) : '只存本机 · 未接服务器（同步接口已留好，以后填地址就能推）'; },
  push: function (entry) {
    if (!this.endpoint) { this._queue.push(entry.id); return { ok: false, reason: 'no_server', queued: this._queue.length }; }
    return { ok: false, reason: 'not_implemented', note: 'endpoint 已填但推送未实现：以后在这里用 fetch POST 到 /api/trips' };
  }
};
function journeyCharComment(rec) {
  var stars = rec.stars || 0;
  if (stars >= 5) return '这地方他给了五颗星：“下次还要去。”';
  if (stars >= 4) return '他很喜欢这里：“记得那天晚上的风。”';
  if (stars >= 3) return '他觉得还不错：“下次可以再去看看。”';
  if (rec.transport) return '坐' + rec.transport + '去的，他说路上很稳。';
  return '他把这一站记下来了。';
}
function journeyStar(id, stars) {
  var list = listJourney();
  var hit = null;
  list.forEach(function (j) {
    if (String(j.id) === String(id)) {
      var n = parseInt(stars, 10);
      if (isNaN(n)) n = 0;
      if (n < 0) n = 0;
      if (n > 5) n = 5;
      j.stars = n;
      j.comment = journeyCharComment(j);
      hit = j;
    }
  });
  if (hit) write(JOURNEY_KEY, list);
  return hit;
}
function journeyBoardingHTML(j) {
  var h = '';
  if (j.from || j.to) h += '<br>🎫 ' + esc(j.from || '？') + ' → ' + esc(j.to || '？') + (j.transport ? ' · ' + esc(j.transport) : '');
  if (j.stars) h += '<br>' + '★★★★★'.slice(0, j.stars) + '☆☆☆☆☆'.slice(0, 5 - j.stars) + ' · 他打了 ' + j.stars + ' 颗星';
  if (j.comment) h += '<br><span style="color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(j.comment) + '</span>';
  return h;
}

function deleteJourney(id) { write(JOURNEY_KEY, listJourney().filter(function (x) { return String(x.id) !== String(id); })); return true; }

/* ── 9. 碰一碰 + 碎碎念 + 装修日记 ── */
function poke(where) {
  var acted = false;
  try { if (window.GroupM && window.GroupM.pet && typeof window.GroupM.pet.poke === 'function') { acted = !!window.GroupM.pet.poke(); } } catch (e) {}
  try { if (window.GroupP && typeof window.GroupP.motion === 'function') { var acts = ['greet', 'wave', 'laugh']; window.GroupP.motion(acts[Math.floor(Math.random() * acts.length)], where || 'poke'); } } catch (e) {}
  var line = POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)];
  if (Math.random() < 0.5) addMumble(line, 'poke');
  return { ok: true, line: line, petActed: acted, where: where || '' };
}
function mumbleList() {
  var log = read(INNERLOG_KEY, []);
  if (!Array.isArray(log)) log = [];
  var out = [];
  log.forEach(function (e) {
    var text = (e && (e.text || e.reflect || e.act || '')) || '';
    if (!text) return;
    out.push({ ts: e.ts || 0, time: e.time || '', text: String(text), kind: e.kind || 'inner', char: e.char || charName() });
  });
  out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return out.slice(0, 50);
}
function addMumble(text, kind) {
  if (!mindOn()) return { ok: false, reason: 'mind_off' };
  var t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  var log = read(INNERLOG_KEY, []);
  if (!Array.isArray(log)) log = [];
  log.push({ ts: Date.now(), time: nowISO(), char: charName(), kind: kind || 'mumble', text: t.slice(0, 200), sense: '', appraise: '', decide: '', act: '', reflect: t.slice(0, 200), trigger: kind || 'mumble', state: '' });
  if (log.length > 50) log = log.slice(-50);
  write(INNERLOG_KEY, log);
  return { ok: true };
}
function listDecor() { var a = read(DECOR_KEY, []); return Array.isArray(a) ? a : []; }
function logDecor(who, what) {
  var w = String(what || '').trim();
  if (!w) return { ok: false, reason: 'empty' };
  var list = listDecor();
  list.push({ id: uid('dc'), ts: Date.now(), time: nowISO(), who: String(who || '我').slice(0, 20), what: w.slice(0, 200) });
  write(DECOR_KEY, list.slice(-200));
  return { ok: true };
}

/* ── 10. 电话（接模型后升级） ── */
function srAvailable() { try { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); } catch (e) { return false; } }
function callModeLabel() {
  if (!modelReady()) return '模拟通话 · 没有真的拨出去，对方是机内模拟。';
  if (!srAvailable()) return '模型已连接，但这台设备没有语音识别，仍为模拟通话（已标注，不是真通话）。';
  return '实时语音通话 · 模型已连接：说话会被转写并由模型回复，通话原文会归档到本地。';
}
function callMode() {
  if (!modelReady()) return 'sim';
  if (!srAvailable()) return 'sim-nosr';
  return 'live';
}
function onCallStart(name, number) {
  _call = { name: name || '', number: number || '', startedAt: Date.now(), lines: [], mode: callMode(), rec: null };
  if (_call.mode !== 'live') return _call;
  try {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SR();
    rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = function (ev) {
      try {
        var res = ev.results;
        for (var i = 0; i < res.length; i++) {
          if (res[i].isFinal && res[i][0] && res[i][0].transcript) {
            var text = String(res[i][0].transcript).trim();
            if (!text) continue;
            _call.lines.push({ who: 'me', text: text, ts: Date.now() });
            var history = _call.lines.slice(-8).map(function (l) { return { role: l.who === 'me' ? 'user' : 'assistant', text: l.text, ts: l.ts }; });
            callModel('call', { messages: history, personas: [] }).then(function (r) {
              if (r.ok && _call) {
                _call.lines.push({ who: 'char', text: r.text, ts: Date.now() });
                try { if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speak) { var u = new SpeechSynthesisUtterance(r.text); u.lang = 'zh-CN'; speechSynthesis.speak(u); } } catch (e) {}
              }
            });
          }
        }
      } catch (e) {}
    };
    rec.onerror = function () { try { if (_call) _call.mode = 'sim-nosr'; } catch (e) {} };
    rec.start();
    _call.rec = rec;
  } catch (e) { _call.mode = 'sim-nosr'; _call.rec = null; }
  return _call;
}
function onCallEnd(callState, sec) {
  var c = _call || { name: (callState && callState.name) || '', number: (callState && callState.number) || '', startedAt: Date.now(), lines: [], mode: callMode() };
  try { if (c.rec && c.rec.stop) c.rec.stop(); } catch (e) {}
  var list = read(CALLTR_KEY, []);
  if (!Array.isArray(list)) list = [];
  list.push({ id: uid('ct'), name: c.name, number: c.number, startedAt: c.startedAt, endedAt: Date.now(),
    durationSec: (typeof sec === 'number') ? sec : Math.round((Date.now() - c.startedAt) / 1000),
    mode: c.mode, modeLabel: callModeLabel(), lines: c.lines || [] });
  write(CALLTR_KEY, list.slice(-100));
  _call = null;
  return list[list.length - 1];
}
function listCallTranscripts() { var a = read(CALLTR_KEY, []); return Array.isArray(a) ? a : []; }

/* ── 11. 外观包 ── */
function exportAppearance() {
  var prefs = read(PREFS_KEY, null) || {};
  return { format: 'phone_appearance_pack_v1', version: 1, exportedAt: nowISO(),
    theme: prefs.theme || 'light', themeCustom: prefs.themeCustom || null };
}
function previewAppearance(data) {
  if (!data || data.format !== 'phone_appearance_pack_v1') return { ok: false, reason: 'bad_format' };
  // 旧包里的漂浮物字段直接忽略，不报错（2026-11-27 删环境漂浮物）。
  return { ok: true, summary: '主题：' + (data.theme || 'light') + '。' };
}
function applyAppearance(data) {
  var prev = previewAppearance(data);
  if (!prev.ok) return prev;
  try {
    if (window.SafeBackupT && window.SafeBackupT.setUiPrefs) {
      var patch = {};
      if (data.theme) patch.theme = data.theme;
      if (data.themeCustom) patch.themeCustom = data.themeCustom;
      window.SafeBackupT.setUiPrefs(patch);
    }
  } catch (e) {}
  logDecor('我', '换了外观包（' + prev.summary + '）');
  return { ok: true, summary: prev.summary };
}

/* ── 界面：设置子页（复用 .st-sub 样式） ── */
var _currentPage = 'home';
var _pendingHome = null;
var _pendingAppearance = null;
var AH_CSS = '<style id="ah-style">'
  + '.ah-card{background:var(--st-paper,#fffdf8);border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:var(--st-radius-lg,10px);padding:12px 16px;margin:0 16px 12px;font-size:17px;line-height:1.5;color:var(--st-ink,#1e2748);}'
  + '.ah-btn{display:inline-block;padding:8px 16px;border-radius:var(--st-radius-md,8px);border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);font-size:17px;cursor:pointer;margin:2px 4px 2px 0;}'
  + '.ah-btn-pri{background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-color:var(--st-ink,#1e2748);}'
  + '.ah-input{width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);font-size:17px;margin:4px 0;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);}'
  + '.ah-chip{display:inline-block;padding:8px 12px;border-radius:var(--st-radius-sm,6px);border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);font-size:12px;margin:2px;cursor:pointer;}'
  + '.ah-chip.on{background:var(--st-silver-light,#dce2f1);color:var(--st-ink,#1e2748);border-color:var(--st-ink,#1e2748);}'
  + '.ah-filelabel{display:inline-block;padding:8px 16px;border-radius:var(--st-radius-md,8px);border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);font-size:17px;cursor:pointer;margin:2px 4px 2px 0;}'
  + '.ah-filelabel input{position:absolute;width:1px;height:1px;opacity:0;}'
  + '.ah-whack{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0;}'
  + '.ah-whack button{height:56px;font-size:26px;border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:var(--st-radius-lg,10px);background:var(--st-paper-cool,#eef0f5);cursor:pointer;}'
  + '</style>';
function ensureCss() { if (!document.getElementById('ah-style')) { var d = document.createElement('div'); d.innerHTML = AH_CSS; document.body.appendChild(d.firstChild); } }
function pageShell(title, sub, bodyHtml) {
  return '<div class="st-sub show" id="ah-sub">'
    + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1" data-ah-act="close">'
    + '<svg viewBox="0 0 24 24" width="22" fill="none" stroke="var(--st-ink,#1e2748)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>设置</div>'
    + '<div class="st-sub-title">' + esc(title) + '</div></div>'
    + '<div class="st-bigtitle" style="padding-top:4px;">' + esc(title) + '</div>'
    + '<div style="padding:0 16px 8px;font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(sub) + '</div>'
    + '<div id="ah-body">' + bodyHtml + '</div><div style="height:40px;"></div></div>';
}
function navChips(cur) {
  var pages = [['home', '整屋'], ['model', '模型与承诺'], ['memreview', '记忆审阅'], ['toys', '玩具盒'], ['watch', '待看'], ['journey', '旅行手记'], ['mumble', '碎碎念'], ['tools', 'char 的手'], ['appearance', '外观包']];
  return '<div class="ah-card">' + pages.map(function (p) { return '<span class="ah-chip' + (p[0] === cur ? ' on' : '') + '" data-ah-act="nav" data-page="' + p[0] + '">' + p[1] + '</span>'; }).join('') + '</div>';
}
function renderPage(page) {
  if (page === 'model') {
    var c = getModelCfg();
    var audit = read(MODELAUDIT_KEY, []);
    var last = (Array.isArray(audit) && audit.length) ? audit[audit.length - 1] : null;
    var trs = listCallTranscripts().slice(-3).reverse();
    var feat = function (k, label) { return '<label style="display:block;padding:8px 0;"><input type="checkbox" id="ah-model-f-' + k + '"' + (c.features[k] ? ' checked' : '') + '> ' + label + '</label>'; };
    return pageShell('模型连接与数据承诺', '赴约做法：家与模型连接分离；密钥只存本机。AG 组未合入，本页按任务给定形状先写。',
      navChips(page)
      + '<div class="ah-card"><b>数据承诺</b><br>' + esc(PROMISE_TEXT) + '</div>'
      + '<div class="ah-card"><b>连接（OpenAI 兼容）</b><br>'
      + '<input class="ah-input" id="ah-model-base" placeholder="Base URL，如 https://api.example.com/v1" value="' + esc(c.baseUrl) + '">'
      + '<input class="ah-input" id="ah-model-key" type="password" placeholder="API Key（只存本机，导出时排除）" value="' + esc(c.apiKey) + '">'
      + '<input class="ah-input" id="ah-model-name" placeholder="模型名，如 gpt-4o-mini" value="' + esc(c.model) + '">'
      + '<label style="display:block;padding:8px 0;">温度 <input id="ah-model-temp" type="number" step="0.1" min="0" max="2" value="' + esc(String(c.temperature)) + '" style="width:70px;"></label>'
      + '<label style="display:block;padding:8px 0;">最大 tokens <input id="ah-model-tokens" type="number" min="128" max="8192" value="' + esc(String(c.maxTokens)) + '" style="width:90px;"></label>'
      + '<label style="display:block;padding:8px 0;"><input type="checkbox" id="ah-model-master"' + (c.master ? ' checked' : '') + '> 总开关：允许调用模型（默认关）</label>'
      + feat('chat', '微信聊天可用模型') + feat('script', '剧本 DM 可用模型') + feat('diary', '日记生成可用模型') + feat('inner', '内心独白可用模型')
      + '<div style="margin-top:8px;"><button class="ah-btn ah-btn-pri" data-ah-act="model-save">保存</button>'
      + '<button class="ah-btn" data-ah-act="model-test">测试连接</button>'
      + '<button class="ah-btn" data-ah-act="model-clear">清除密钥</button></div>'
      + '<div id="ah-model-tip" style="margin-top:8px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + (modelReady() ? '当前状态：模型已接通' + (srAvailable() ? '，电话可走实时语音。' : '，但本设备无语音识别，电话仍为模拟（已标注）。') : '当前状态：未接模型，全部走本地模板，电话为模拟通话。') + '</div></div>'
      + '<div class="ah-card"><b>最近一次模型调用（实际行为对账）</b><br>' + (last ? ('时间 ' + esc(last.time || '') + ' · ' + esc(last.kind) + ' · 发出 ' + last.sentMessages + ' 条消息 / ' + last.sentMemories + ' 条记忆（上限 ' + last.cap + '）· ' + (last.ok ? '成功' : '失败')) : '还没有调用过模型。') + '</div>'
      + '<div class="ah-card"><b>电话转写归档（最近 3 通）</b><br>' + (trs.length ? trs.map(function (t) { return '· ' + esc(t.name || '') + ' · ' + esc(t.modeLabel || t.mode || '') + ' · ' + (t.lines || []).length + ' 行转写<br>'; }).join('') : '还没有通话转写。拨号在电话 app 里；没接模型时明确标注“模拟通话”。') + '</div>');
  }
  if (page === 'memreview') {
    var list = getReview();
    var pend = list.filter(function (x) { return x.status === 'pending'; }).length;
    var appr = recallMemories('').length;
    return pageShell('记忆审阅', '赴约做法：记忆分 L1/L2/L3，导入先落待审草稿，审过才参与召回。',
      navChips(page)
      + '<div class="ah-card">待审草稿 ' + pend + ' 条 · 已审启用（参与召回）' + appr + ' 条 · 共 ' + list.length + ' 条。<br>召回只读已审且启用的记忆，待审的绝不进模型上下文。'
      + '<div style="margin-top:8px;"><button class="ah-btn ah-btn-pri" data-ah-act="mem-import-guichao">从归巢导入待审</button>'
      + '<input class="ah-input" id="ah-mem-text" placeholder="手动写一条待审记忆…"><button class="ah-btn" data-ah-act="mem-add">加入待审</button></div></div>'
      + (list.length ? list.slice().reverse().slice(0, 30).map(function (x) {
          return '<div class="ah-card"><b>[' + esc(x.level) + ']</b> ' + esc(x.text) + '<br><span style="color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(x.category) + ' · ' + esc(x.status) + (x.enabled === false ? ' · 已停用' : '') + ' · ' + esc(x.source || '') + '</span><br>'
            + '<button class="ah-btn" data-ah-act="mem-act" data-op="approve" data-id="' + esc(x.id) + '">通过</button>'
            + '<button class="ah-btn" data-ah-act="mem-act" data-op="disable" data-id="' + esc(x.id) + '">停用</button>'
            + '<button class="ah-btn" data-ah-act="mem-act" data-op="enable" data-id="' + esc(x.id) + '">启用</button>'
            + '<button class="ah-btn" data-ah-act="mem-act" data-op="promote" data-id="' + esc(x.id) + '">升级</button>'
            + '<button class="ah-btn" data-ah-act="mem-act" data-op="delete" data-id="' + esc(x.id) + '">删除</button></div>';
        }).join('') : '<div class="ah-card">还没有待审记忆。点“从归巢导入待审”把归巢记忆复制一份进来审（原文不动）。</div>'));
  }
  if (page === 'toys') {
    var toys = listToys();
    var grid = '';
    for (var i = 0; i < 9; i++) grid += '<button type="button" id="ah-whack-' + i + '" data-ah-act="whack-hit" data-cell="' + i + '">🕳️</button>';
    return pageShell('玩具盒', '赴约做法：内置打地鼠 + 导入单文件 HTML 玩具（无网络沙箱跑），游玩记审计，随整屋迁移。',
      navChips(page)
      + '<div class="ah-card"><b>打地鼠</b> · 得分 <span id="ah-whack-score">0</span> · 剩余 <span id="ah-whack-time">30</span> 秒'
      + '<div class="ah-whack">' + grid + '</div>'
      + '<button class="ah-btn ah-btn-pri" data-ah-act="toy-whack-start">开始一局（30 秒）</button><span id="ah-whack-end" style="color:var(--st-ink-60,rgba(30,39,72,.6));"></span></div>'
      + '<div class="ah-card"><b>导入单文件 HTML 小游戏</b><br>只接受单文件 HTML，不含任何外链（脚本/图片/地址）；在 <code>sandbox="allow-scripts"</code> 的 iframe 里跑，无网络、不给 allow-same-origin。<br>'
      + '<label class="ah-filelabel">选择 HTML 文件<input type="file" id="ah-toy-file" accept=".html,.htm"></label></div>'
      + (toys.length ? toys.map(function (t) {
          return '<div class="ah-card"><b>' + esc(t.name) + '</b> <span style="color:var(--st-ink-60,rgba(30,39,72,.6));">导入于 ' + new Date(t.createdAt).toLocaleDateString() + '</span><br>'
            + '<button class="ah-btn ah-btn-pri" data-ah-act="toy-play" data-id="' + esc(t.id) + '">玩</button>'
            + '<button class="ah-btn" data-ah-act="toy-del" data-id="' + esc(t.id) + '">删除</button>'
            + '<div id="ah-toy-stage-' + esc(t.id) + '" style="margin-top:8px;"></div></div>';
        }).join('') : '<div class="ah-card">还没有导入的玩具。玩具存在 otome_toys_v1，随整屋导出一起搬走。</div>'));
  }
  if (page === 'watch') {
    var wl = listWatch();
    return pageShell('一起看 · 待看', '赴约做法：聊天里贴公开链接，有网有模型时读标题再评论；没网或没接模型时先存进待看。',
      navChips(page)
      + '<div class="ah-card"><b>贴个链接</b><br>支持 xiaohongshu.com / github.com 的公开链接。<br>'
      + '<input class="ah-input" id="ah-watch-url" placeholder="粘贴链接…"><button class="ah-btn ah-btn-pri" data-ah-act="watch-paste">处理这条链接</button>'
      + '<div id="ah-watch-tip" style="color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:8px;">' + (modelReady() ? '模型已接：会先读标题，再让模型评论，结果写进小本本。' : '未接模型：链接会先存进待看，并写清楚“已存进待看，有网有模型时再看”。') + '</div></div>'
      + (wl.length ? wl.slice().reverse().map(function (w) {
          return '<div class="ah-card"><a href="' + esc(w.url) + '" target="_blank" rel="noopener">' + esc(w.url) + '</a><br>'
            + (w.title ? '标题：' + esc(w.title) + '<br>' : '') + '状态：' + esc(w.status) + (w.note ? ' · ' + esc(w.note) : '') + '<br>'
            + (w.comment ? 'char 说：' + esc(w.comment) + '<br>' : '')
            + '<button class="ah-btn" data-ah-act="watch-retry" data-id="' + esc(w.id) + '">现在看（再试一次）</button>'
            + '<button class="ah-btn" data-ah-act="watch-del" data-id="' + esc(w.id) + '">删除</button></div>';
        }).join('') : '<div class="ah-card">待看是空的。微信里贴链接也会自动进这里（已接通微信发消息的钩子）。</div>')
      + '<div class="ah-card" style="color:var(--st-ink-60,rgba(30,39,72,.6));">待看同时写进影院小本本 cinema_notes_v1 的“待看”栏（__watchlist__），和影院手记在一起。</div>');
  }
  if (page === 'journey') {
    var js = listJourney();
    return pageShell('旅行手记', '赴约做法：纯文字旅行手记，一句话或长笔记直接存本地，不依赖视觉模型。',
      navChips(page)
      + '<div class="ah-card" style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(TravelSyncAdapter.status()) + '</div>'
      + '<div class="ah-card"><b>写一则手记</b><br>'
      + '<input class="ah-input" id="ah-jr-date" type="date" value="' + dayStr() + '">'
      + '<input class="ah-input" id="ah-jr-place" placeholder="地点（可从此刻时间线取，如：雨夜咖啡馆）">'
      + '<textarea class="ah-input" id="ah-jr-text" rows="3" placeholder="写一句话或一段长笔记，纯文字…"></textarea>'
      + '<input class="ah-input" id="ah-jr-from" placeholder="出发地（可选）">'
      + '<input class="ah-input" id="ah-jr-to" placeholder="目的地（可选）">'
      + '<input class="ah-input" id="ah-jr-transport" placeholder="交通方式（可选，如：高铁 / 飞机 / 步行）">'
      + '<select class="ah-input" id="ah-jr-stars"><option value="0">不等星</option><option value="3">★★★</option><option value="4">★★★★</option><option value="5">★★★★★</option></select>'
      + '<button class="ah-btn ah-btn-pri" data-ah-act="journey-add">存下来</button></div>'
      + (js.length ? js.slice().reverse().map(function (j) {
          return '<div class="ah-card"><b>' + esc(j.date) + ' · ' + esc(j.place || '未写地点') + '</b><br>' + esc(j.text) + journeyBoardingHTML(j)
            + '<br><button class="ah-btn" data-ah-act="journey-del" data-id="' + esc(j.id) + '">删除</button></div>';
        }).join('') : '<div class="ah-card">还没有旅行手记。手记只存文字，不拍照、不连视觉模型。</div>'));
  }
  if (page === 'mumble') {
    var mb = mumbleList();
    var dc = listDecor();
    return pageShell('碎碎念 · 装修日记', '赴约做法：碰一碰有反应；char 的嘟囔单独成流；3D 家每次布置改动记一笔。',
      navChips(page)
      + '<div class="ah-card"><b>碰一碰</b><br>在桌面上戳一下 char，或在 3D 家里点他，他会冒一句 + 做个小动作（复用 M 组桌面宠物点按与 P 组动作台）。<br><button class="ah-btn ah-btn-pri" data-ah-act="poke">戳一下试试</button></div>'
      + '<div class="ah-card"><b>碎碎念（可上下翻）</b><br><input class="ah-input" id="ah-mumble-text" placeholder="替他写一句嘟囔…"><button class="ah-btn" data-ah-act="mumble-add">记一句</button><br>'
      + (mb.length ? mb.map(function (m) { return '· ' + esc(m.text) + ' <span style="color:var(--st-ink-40,rgba(30,39,72,.4));">(' + esc(m.time || '') + ')</span><br>'; }).join('') : '还没有嘟囔。内心独白开关（mind）关着时不写。') + '</div>'
      + '<div class="ah-card"><b>装修日记（3D 家布置改动）</b><br><input class="ah-input" id="ah-decor-text" placeholder="比如：把阳台的花换成了向日葵…"><button class="ah-btn" data-ah-act="decor-add">记一笔</button><br>'
      + (dc.length ? dc.slice().reverse().slice(0, 20).map(function (d) { return '· ' + esc(d.who) + '：' + esc(d.what) + ' <span style="color:var(--st-ink-40,rgba(30,39,72,.4));">(' + esc(d.time || '') + ')</span><br>'; }).join('') : '还没有布置记录。在 3D 家里第一次碰一件家具时也会自动记一笔（Z 组装修方案未合入，先记在布置入口处）。') + '</div>');
  }
  if (page === 'tools') {
    var sw = handsOn();
    var audit = read(AUDIT_KEY, []);
    return pageShell('char 的手 · 白名单', '赴约做法：char 的手只允许五件，不开放任意命令与文件系统；hands 关时五件都不做。',
      navChips(page)
      + '<div class="ah-card"><b>白名单（四件）</b><br>1 改自己的个签/心情 · 2 写待审记忆 · 3 按明确请求写共同房间 · 4 创建/修改离线 HTML 小玩具。<br>动手（hands）开关当前：<b>' + (sw ? '开' : '关') + '</b>（O 组四开关，在设置“内心生活”里改）。关时下面四件都不做。<br>'
      + '<input class="ah-input" id="ah-tool-sig" placeholder="新个签（60 字内）…"><button class="ah-btn" data-ah-act="tool-run" data-tool="setSignature">改个签</button><br>'
      + '<input class="ah-input" id="ah-tool-mem" placeholder="写一条待审记忆…"><button class="ah-btn" data-ah-act="tool-run" data-tool="writeReviewMemory">写待审记忆</button><br>'
      + '<input class="ah-input" id="ah-tool-room" placeholder="共同房间的一句话…"><button class="ah-btn" data-ah-act="tool-run" data-tool="writeRoomNote">写房间便条</button><br>'
      + '</div>'
      + '<div class="ah-card"><b>审计日志（最近 10 条）</b><br>' + ((Array.isArray(audit) && audit.length) ? audit.slice(-10).reverse().map(function (a) { return '· ' + esc(a.time || '') + ' ' + esc(a.tool) + '：' + esc(a.summary || '') + ' → ' + esc(a.result || '') + '<br>'; }).join('') : '还没有工具调用记录。') + '</div>');
  }
  if (page === 'appearance') {
    return pageShell('外观包', '赴约做法 + Hanami 主题分享码思路：主题打成一个外观包，可导出分享、可导入（先预览再应用）。',
      navChips(page)
      + '<div class="ah-card"><b>导出外观包</b><br>包含：主题。不含 API Key。<br><button class="ah-btn ah-btn-pri" data-ah-act="appearance-export">下载外观包 JSON</button></div>'
      + '<div class="ah-card"><b>导入外观包</b><br><label class="ah-filelabel">选择外观包 JSON<input type="file" id="ah-appearance-file" accept=".json,application/json"></label>'
      + '<div id="ah-appearance-preview" style="color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:8px;">导入前会先预览，确认后再应用。</div>'
      + '<button class="ah-btn ah-btn-pri" data-ah-act="appearance-apply">确认应用</button></div>');
  }
  /* 默认：home 整屋 */
  var prev2 = null;
  return pageShell('整屋搬家', '赴约做法：把“家”打成一个 JSON 导出，换设备时导入；导入前预览、冲突检查、幂等导入。接 T 组备份恢复流程。',
    navChips(page)
    + '<div class="ah-card"><b>导出整屋</b><br>包含人物、聊天、记忆、信件、空间、心情、外观等 ' + HOME_KEYS.length + ' 个键。不含模型 API Key、锁屏密码与备份归档本身。<br>'
    + '<button class="ah-btn ah-btn-pri" data-ah-act="home-export">下载整屋 JSON</button></div>'
    + '<div class="ah-card"><b>导入整屋</b><br><label class="ah-filelabel">选择整屋 JSON<input type="file" id="ah-home-file" accept=".json,application/json"></label>'
    + '<div id="ah-home-preview" style="color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:8px;">先选文件，这里会展示“会改变什么”与冲突检查；确认后再写，写前先归档当前状态。</div>'
    + '<button class="ah-btn ah-btn-pri" data-ah-act="home-import-confirm">确认导入</button></div>'
    + '<div class="ah-card" style="color:var(--st-ink-60,rgba(30,39,72,.6));">幂等：同一份整屋导两次，第二次新增 0 条，不会重复。恢复走 T 组备份与安全中心（先归档、可撤销）。</div>');
}
function open(page, win) {
  _currentPage = page || 'home';
  ensureCss();
  var host = null;
  try {
    if (win && win.querySelector) host = win;
    else { var root = document.querySelector('#st-root'); host = (root && root.parentElement) ? root.parentElement : document.body; }
  } catch (e) { host = document.body; }
  var old = document.getElementById('ah-sub');
  if (old) old.remove();
  var tmp = document.createElement('div');
  tmp.innerHTML = renderPage(_currentPage);
  var sub = tmp.firstElementChild;
  host.appendChild(sub);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { try { sub.classList.add('show'); } catch (e) {} });
  else sub.classList.add('show');
  return sub;
}
function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function checked(id) { var el = document.getElementById(id); return el ? !!el.checked : false; }
function handleAct(act, el) {
  if (act === 'close') { var s = document.getElementById('ah-sub'); if (s) s.remove(); stopWhack(); return; }
  if (act === 'nav') { open(el.getAttribute('data-page')); return; }
  if (act === 'poke') { var r = poke('panel'); toast(r.line); open('mumble'); return; }
  if (act === 'home-export') { var data = exportHome(); downloadFile('整屋_' + dayStr() + '.json', JSON.stringify(data, null, 2)); toast('整屋已导出（不含 API Key）。'); return; }
  if (act === 'home-import-confirm') {
    if (!_pendingHome) { toast('请先选择整屋 JSON 文件。'); return; }
    var res = importHome(_pendingHome);
    if (!res.ok) { toast('导入失败：' + (res.reason || '格式不对')); return; }
    var n = 0; Object.keys(res.added || {}).forEach(function (k) { n += res.added[k]; });
    toast('整屋已导入：新增/改写 ' + n + ' 处，跳过 ' + res.skipped + ' 处（已归档，可撤销）。');
    _pendingHome = null; open('home'); return;
  }
  if (act === 'model-save') {
    saveModelCfg({ baseUrl: val('ah-model-base').trim(), apiKey: val('ah-model-key').trim(), model: val('ah-model-name').trim(),
      temperature: parseFloat(val('ah-model-temp')) || 0.7, maxTokens: parseInt(val('ah-model-tokens'), 10) || 1024,
      master: checked('ah-model-master'),
      features: { chat: checked('ah-model-f-chat'), script: checked('ah-model-f-script'), diary: checked('ah-model-f-diary'), inner: checked('ah-model-f-inner') } });
    toast('模型连接已保存（Key 只存本机）。'); open('model'); return;
  }
  if (act === 'model-test') {
    var tip = document.getElementById('ah-model-tip'); if (tip) tip.textContent = '测试连接中…';
    testModelConnection().then(function (r) { var t = document.getElementById('ah-model-tip'); if (t) t.textContent = r.text; });
    return;
  }
  if (act === 'model-clear') { clearModelKey(); toast('API Key 已清除，总开关已关。'); open('model'); return; }
  if (act === 'mem-import-guichao') { var r2 = importGuichaoToReview(); toast('从归巢导入待审：新增 ' + r2.added + ' 条，跳过 ' + r2.skipped + ' 条（都在待审，不进召回）。'); open('memreview'); return; }
  if (act === 'mem-add') { var a = addToReview([{ text: val('ah-mem-text'), category: '日常记忆' }], 'manual'); toast(a.added ? '已加入待审草稿。' : '没写内容或已存在。'); open('memreview'); return; }
  if (act === 'mem-act') { var rr = reviewMemory(el.getAttribute('data-id'), el.getAttribute('data-op')); toast(rr.ok ? '已处理。' : '失败：' + (rr.reason || '')); open('memreview'); return; }
  if (act === 'toy-whack-start') { startWhack(30); var sc = document.getElementById('ah-whack-score'); if (sc) sc.textContent = '0'; var tm = document.getElementById('ah-whack-time'); if (tm) tm.textContent = '30'; var en = document.getElementById('ah-whack-end'); if (en) en.textContent = ''; renderWhackMole(); return; }
  if (act === 'whack-hit') { hitWhack(parseInt(el.getAttribute('data-cell'), 10)); return; }
  if (act === 'toy-play') { var pr = playToy(el.getAttribute('data-id')); var stage = document.getElementById('ah-toy-stage-' + el.getAttribute('data-id')); if (pr.ok && stage) { stage.innerHTML = '<iframe sandbox="allow-scripts" style="width:100%;height:320px;border:1px solid #eee;border-radius:12px;background:#fff;" srcdoc="' + esc(pr.toy.html).replace(/"/g, '&quot;') + '"></iframe><div style="color:#888;font-size:12px;margin-top:4px;">沙箱运行：无网络、不给 allow-same-origin。游玩已记审计。</div>'; } return; }
  if (act === 'toy-del') { deleteToy(el.getAttribute('data-id')); toast('玩具已删除。'); open('toys'); return; }
  if (act === 'watch-paste') { var u = val('ah-watch-url').trim(); if (!u) { toast('请先粘贴链接。'); return; } var tip2 = document.getElementById('ah-watch-tip'); if (tip2) tip2.textContent = '处理中…'; processLink(u).then(function (r3) { open('watch'); toast(r3.mode === 'commented' ? '模型已评论，写进小本本了。' : '已存进待看，有网有模型时再看。'); }); return; }
  if (act === 'watch-retry') { var wl = listWatch(); var w = null; wl.forEach(function (x) { if (String(x.id) === String(el.getAttribute('data-id'))) w = x; }); if (!w) return; processLink(w.url).then(function () { open('watch'); }); return; }
  if (act === 'watch-del') { saveWatch(listWatch().filter(function (x) { return String(x.id) !== String(el.getAttribute('data-id')); })); open('watch'); return; }
  if (act === 'journey-add') { var jr = addJourney(val('ah-jr-date'), val('ah-jr-place'), val('ah-jr-text'), { from: val('ah-jr-from'), to: val('ah-jr-to'), transport: val('ah-jr-transport'), stars: val('ah-jr-stars') }); if (jr.ok && jr.item) { jr.item.comment = journeyCharComment(jr.item); var _jl = listJourney(); _jl.forEach(function (x) { if (x.id === jr.item.id) x.comment = jr.item.comment; }); write(JOURNEY_KEY, _jl); TravelSyncAdapter.push(jr.item); } toast(jr.ok ? '手记已存（纯文字）。' : '请先写点文字。'); open('journey'); return; }
  if (act === 'journey-del') { deleteJourney(el.getAttribute('data-id')); open('journey'); return; }
  if (act === 'mumble-add') { var mr = addMumble(val('ah-mumble-text'), 'mumble'); toast(mr.ok ? '嘟囔已记进碎碎念。' : '写不进去：' + (mr.reason || '')); open('mumble'); return; }
  if (act === 'decor-add') { var dr = logDecor('我', val('ah-decor-text')); toast(dr.ok ? '装修日记记了一笔。' : '请先写改了什么。'); open('mumble'); return; }
  if (act === 'tool-run') {
    var tool = el.getAttribute('data-tool');
    var params = {};
    if (tool === 'setSignature') params = { text: val('ah-tool-sig') };
    if (tool === 'writeReviewMemory') params = { text: val('ah-tool-mem') };
    if (tool === 'writeRoomNote') params = { room: '客厅', text: val('ah-tool-room') };
    var tr = runTool(tool, params);
    toast(tr.ok ? '工具已执行：' + tool : '工具被拒：' + (tr.reason || ''));
    open('tools'); return;
  }
  if (act === 'appearance-export') { downloadFile('外观包_' + dayStr() + '.json', JSON.stringify(exportAppearance(), null, 2)); toast('外观包已导出（不含 API Key）。'); return; }
  if (act === 'appearance-apply') {
    if (!_pendingAppearance) { toast('请先选择外观包 JSON 文件。'); return; }
    var ap = applyAppearance(_pendingAppearance);
    toast(ap.ok ? '外观包已应用：' + ap.summary : '外观包格式不对。');
    _pendingAppearance = null; open('appearance'); return;
  }
}
function readFileAsText(file, done) {
  try {
    var rd = new FileReader();
    rd.onload = function () { try { done(null, String(rd.result || '')); } catch (e) { done(e); } };
    rd.onerror = function () { done(new Error('read_failed')); };
    rd.readAsText(file);
  } catch (e) { done(e); }
}
function onDocClick(e) {
  try {
    var t = e.target;
    if (t && t.closest) {
      var pet = t.closest('#desk-pet');
      if (pet) { poke('desktop'); return; }
      var ch = t.closest('#ot-char');
      if (ch) { poke('otome'); return; }
      var ah = t.closest('[data-ah-act]');
      if (ah) { handleAct(ah.getAttribute('data-ah-act'), ah); return; }
    }
  } catch (err) {}
}
function onDocChange(e) {
  try {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'ah-home-file' && t.files && t.files[0]) {
      readFileAsText(t.files[0], function (err, text) {
        if (err) { toast('读取文件失败。'); return; }
        try { _pendingHome = JSON.parse(text); } catch (ex) { toast('不是有效的 JSON 文件。'); return; }
        var prev = previewHomeImport(_pendingHome);
        var box = document.getElementById('ah-home-preview');
        if (box) box.innerHTML = prev.ok ? esc(prev.summary) + '<br>' + prev.lines.slice(0, 8).map(function (l) { return '· ' + esc(l.key) + '：' + esc(l.change) + (l.add ? '（+' + l.add + '）' : ''); }).join('<br>') : '格式不对：不是整屋导出文件。';
      });
    }
    if (t.id === 'ah-toy-file' && t.files && t.files[0]) {
      var name = t.files[0].name || '未命名玩具';
      readFileAsText(t.files[0], function (err, text) {
        if (err) { toast('读取文件失败。'); return; }
        var r = addToy(text, name.replace(/\.html?$/i, ''));
        toast(r.ok ? '玩具已导入：' + name : '玩具被拒：' + (r.reason || '') + (r.note ? '（' + r.note + '）' : ''));
        open('toys');
      });
    }
    if (t.id === 'ah-appearance-file' && t.files && t.files[0]) {
      readFileAsText(t.files[0], function (err, text) {
        if (err) { toast('读取文件失败。'); return; }
        try { _pendingAppearance = JSON.parse(text); } catch (ex) { toast('不是有效的 JSON 文件。'); return; }
        var pv = previewAppearance(_pendingAppearance);
        var box2 = document.getElementById('ah-appearance-preview');
        if (box2) box2.textContent = pv.ok ? ('预览：' + pv.summary + '点“确认应用”才写。') : '格式不对：不是外观包文件。';
      });
    }
  } catch (err) {}
}
function init() {
  ensureCss();
  try { document.addEventListener('click', onDocClick); } catch (e) {}
  try { document.addEventListener('change', onDocChange); } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.GroupAH = {
  version: MARK,
  keys: { model: MODEL_KEY, review: REVIEW_KEY, audit: AUDIT_KEY, toys: TOYS_KEY,
    journey: JOURNEY_KEY, watch: WATCH_KEY, decor: DECOR_KEY, transcripts: CALLTR_KEY,
    signature: SIG_KEY, roomNotes: ROOMNOTE_KEY, modelAudit: MODELAUDIT_KEY },
  TOOL_NAMES: TOOL_NAMES,
  PROMISE_TEXT: PROMISE_TEXT,
  getModelCfg: getModelCfg, saveModelCfg: saveModelCfg, clearModelKey: clearModelKey,
  modelReady: modelReady, featureOn: featureOn, buildModelPayload: buildModelPayload,
  callModel: callModel, testModelConnection: testModelConnection,
  getReview: getReview, addToReview: addToReview, importGuichaoToReview: importGuichaoToReview,
  reviewMemory: reviewMemory, recallMemories: recallMemories,
  exportHome: exportHome, previewHomeImport: previewHomeImport, importHome: importHome,
  runTool: runTool, auditTool: auditTool,
  listToys: listToys, addToy: addToy, deleteToy: deleteToy, playToy: playToy,
  startWhack: startWhack, stopWhack: stopWhack, hitWhack: hitWhack, _whack: _whack,
  extractLinks: extractLinks, listWatch: listWatch, addWatch: addWatch, processLink: processLink, onUserMessage: onUserMessage,
  listJourney: listJourney, addJourney: addJourney, deleteJourney: deleteJourney, journeyStar: journeyStar, journeyCharComment: journeyCharComment, journeyBoardingHTML: journeyBoardingHTML, TravelSyncAdapter: TravelSyncAdapter,
  poke: poke, mumbleList: mumbleList, addMumble: addMumble, listDecor: listDecor, logDecor: logDecor,
  callModeLabel: callModeLabel, callMode: callMode, onCallStart: onCallStart, onCallEnd: onCallEnd, listCallTranscripts: listCallTranscripts,
  exportAppearance: exportAppearance, previewAppearance: previewAppearance, applyAppearance: applyAppearance,
  open: open, renderPage: renderPage
};
})();

