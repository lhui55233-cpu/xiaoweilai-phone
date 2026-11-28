
/* GROUP-T-SAFEBACKUP ══════════════════════════════════════════════════════════
T 组 · 阶段三：备份恢复的安全模型 + A20/A21/A22/A25/A34
出处（只借设计思路，绝不复制代码；本模块全部为新写代码）：
- 备份恢复安全模型：Hanami A23「先展示改变、先归档当前状态再写」+
Pulse A10「保存即备份 + diff 预览 + 撤销」的做法。
Hanami https://github.com/Undi95/Hanami 是 AGPL-3.0，它的代码一行都没拿。
- 旧对话导入：Pulse A9「先预览、再挑、再存」的做法。
- 一个角色一个命名空间：Hanami A20 的做法（一个角色 = 一个文件夹 → 一个
localStorage 命名空间，落成本地版：char: 前缀 + 命名空间清单页）。
- 记忆索引 + 每事实一条记录、对话每对话一个消息数组：Hanami A21 的做法。
- 界面偏好统一存放：Hanami A22「ui.json 式界面偏好统一存放」的做法。
- 上下文仪表：Hanami A25「100% = 压缩点，本地近似版」的做法。
- 本地聊天搜索：Hanami A34「chat_search 引用原文 + 日期（关键词版）」的做法。
向量部分不要：只用关键词 + 重要度 + 新近度排序。
C 档一项都没碰：无 Telegram、无 llama.cpp、无云端 key、无 whisper、无
Qwen3-TTS、无 MCP、无 Pipecat/WebRTC、无 SearXNG、无 Cloudflare Tunnel、
无密码认证、无 Overte/Rocketbox 动画文件、无 Sketchfab 房间、无第三方
VRM 再分发、无任何 AGPL 代码。
新增键（只新增，不改旧键）：
phone_backups_v1 备份归档区：每次备份一条记录 {id,ts,label,scope,keys,snapshot}
phone_undo_v1 撤销记录：记忆/日记编辑、恢复操作的事前快照
guichao_mem_index_v1 归巢记忆轻量索引（按事实 key / 分类 / 日期；不改 guichao.memories.v1）
phone_ui_prefs_v1 界面偏好统一键（形状见下面 PHONE_UI_PREFS_SHAPE 注释）
char:imported_chats_v1 导入的旧对话归档（char: 命名空间；同时写入微信会话，标题标【导入】）
phone_ctx_notes_v1 上下文仪表压缩请求记录（U 组压缩未合入时的记账）
只读复用旧键：guichao.memories.v1、guichao.diaries.v1（若存在）、
phone_wechat_store_v2（微信会话源）、phone_settings_v3（偏好迁移源，只读一次）。
安全模型（所有导出/导入/恢复统一走同一流程）：
预览 diff（会改变什么）→ 先把当前状态归档进 phone_backups_v1 →
再写 → 可撤销（撤销按钮把归档快照写回去；恢复操作先归档再写，永远有网兜）。
设置页的原 import / exportPart / exportAll 入口由补丁包一层确认 + 归档，
doImport / doExport 本体一字未动；角色卡导出（N 组 JSON / P 组 PNG）在
安全中心的入口先归档再打开原有角色卡弹窗，文件下载仍走原流程。
══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var BACKUP_KEY = 'phone_backups_v1';
var UNDO_KEY = 'phone_undo_v1';
var INDEX_KEY = 'guichao_mem_index_v1';
var PREFS_KEY = 'phone_ui_prefs_v1';
var IMPORT_KEY = 'char:imported_chats_v1';
var CTX_KEY = 'phone_ctx_notes_v1';
var MEM_KEY = 'guichao.memories.v1';
var DIARY_KEY = 'guichao.diaries.v1';
var WX_KEY = 'phone_wechat_store_v2';
var MAX_BACKUPS = 20;
var MAX_UNDO = 50;

/* ── A22 界面偏好统一键形状（V 组主题 / W 组桌面外观按同一份形状读写）──
phone_ui_prefs_v1 = {
lang: 'zh-CN', // 界面语言
theme: 'light', // 主题：light | dark | auto
themeCustom: { c1: '#ffffff', c2: '#34363b'}, // 自定义主题两色
layout: 'default', // 桌面布局：default | compact
lastChar: '', // 上次使用的角色名
lastChat: '', // 上次打开的会话 id
wallpaper: '', // 壁纸（本地色值 / data URL / 本地路径，不引入外链）
iconStyle: 'default', // 图标风格：default | round | square
widgetsEnabled: true, // 桌面组件总开关
petEnabled: true, // 桌面宠物总开关
petMode: 'full', // 宠物模式：full | walk-only | desk-only
petSize: 'medium', // 宠物大小：small | medium | large
petSkin: 'default', // 宠物皮肤
clockStyle: 'default', // 时钟组件样式
migratedFrom: [] // 本次迁移读过哪些旧键（只读一次，不回写旧键）
} */
var PREFS_DEFAULT = { lang: 'zh-CN', theme: 'light', themeCustom: { c1: '#ffffff', c2: '#34363b'}, layout: 'default', lastChar: '', lastChat: '', wallpaper: 'fish', fishStyle: 'ascii', fishBg: '#ffffff', fishFollowTheme: false, fishWater: true, wallpaperMigrated: false, iconStyle: 'default', widgetsEnabled: true, petEnabled: true, petMode: 'full', petSize: 'medium', petSkin: 'default', clockStyle: 'default', migratedFrom: []};

/* ── A20 命名空间方案（文档化）──
char: 命名空间：一切「属于这个角色」的数据都归 char: 前缀（或历史遗留的
char_ 前缀）之下；手机系统数据用 phone_ / cike_ / wx_ / iconsystem /
guichao. 等前缀。旧键不动、不迁移，只定规范 + 清单页。
char: 归属判定（见 namespaceInventory）：键以 'char:' 或 'char_' 开头，
或在 CHAR_OWNED_KEYS 清单里。清单页列出哪些键属于 char、哪些属于手机系统。 */
var CHAR_OWNED_KEYS = ['char:imported_chats_v1', 'char_inner_log_v1', 'char_inner_switches_v1', 'char_goals_v1', 'char_promises_v1', 'char_inner_state_v1', 'char_drives_v1', 'char_dreams_v1', 'phone_my_persona', 'phone_my_persona_data', 'os_character'];
var SCOPES = {
guichao: [MEM_KEY, DIARY_KEY, INDEX_KEY],
wx: [WX_KEY],
charcard: ['phone_my_persona', 'phone_my_persona_data', 'os_character', 'char:imported_chats_v1', 'phone_wechat_store_v2'],
prefs: [PREFS_KEY],
phone: null /* 全部键：快照时取当时 localStorage 全部键 */
};

function lsGet(k, fb) { try { var r = localStorage.getItem(k); return r == null? fb: JSON.parse(r);} catch (e) { return fb;}}
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}}
function rawGet(k) { try { return localStorage.getItem(k);} catch (e) { return null;}}
function rawSet(k, raw) { try { if (raw == null) localStorage.removeItem(k); else localStorage.setItem(k, raw); return true;} catch (e) { return false;}}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);}
function nowISO() { return new Date().toISOString();}
function fmtTime(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);}
function toast(msg) { try { if (typeof WeChatAppEngine!== 'undefined' && WeChatAppEngine.triggerToast) { WeChatAppEngine.triggerToast(msg); return;}} catch (e) {} try { if (typeof SysDialog!== 'undefined' && SysDialog.alert) { SysDialog.alert(msg); return;}} catch (e) {} try { alert(msg);} catch (e) {}}
/* ── 备份排除清单（安全修复 2026-11-27）──
   canonical 清单在 js/71 的 window.MemBackup.EXCLUDE_KEYS；下面这份字面量是
   fallback（js/71 未必已加载）。isExcludedKey 取两者并集（宁可多排、不许漏排）。
   所有导出/归档路径（allKeys → scopeKeys → archiveCurrent/previewDiff/_ui.doExport）
   统一走 isExcludedKey，不要在各处另写排除条件。
   清单口径 = 设置页安全路径 js/00 doExport（:5520-5521）+ 本次新增 3 键：
   模型 key 3 键、锁屏 10 键、备份 token / 私语 / 已删功能残留各 1 键。 */
var EXPORT_EXCLUDE_KEYS = ['phone_model_key_v1', 'phone_model_per_feature_v1', 'phone_model_fallback_keys_v1', 'phone_lock_pw_hash_v1', 'phone_lock_salt_v1', 'phone_lock_pw_kind_v1', 'phone_lock_pw_v1', 'phone_lock_passcode', 'phone_lock_disabled', 'phone_lock_fail_v1', 'phone_lock_cool_v1', 'phone_lock_attempts_v1', 'phone_lock_last_verified_v1', 'phone_membackup_token_v1', 'wb_whisper_v1', 'phone_iftheatre_v1'];
function isExcludedKey(k) { if (EXPORT_EXCLUDE_KEYS.indexOf(k) >= 0) return true; try { var c = window.MemBackup && window.MemBackup.EXCLUDE_KEYS; if (Array.isArray(c) && c.indexOf(k) >= 0) return true; } catch (e) {} return false; }
function allKeys() { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var _k = localStorage.key(i); if (isExcludedKey(_k)) continue; out.push(_k); } } catch (e) {} return out; }
function scopeKeys(scope) { if (scope === 'phone') return allKeys(); var ks = SCOPES[scope]; if (ks) return ks.slice(); return [scope];}

/* ── 备份 / 归档 / 撤销（安全模型核心）── */
function snapshotOf(keys) {
var present = {}, absent = [];
keys.forEach(function (k) { var r = rawGet(k); if (r == null) absent.push(k); else present[k] = r;});
return { present: present, absent: absent};
}
function applySnapshot(snap) {
Object.keys(snap.present || {}).forEach(function (k) { rawSet(k, snap.present[k]);});
(snap.absent || []).forEach(function (k) { rawSet(k, null);});
}
function listBackups() { var b = lsGet(BACKUP_KEY, []); return Array.isArray(b)? b: [];}
function archiveCurrent(label, scope) {
var keys = scopeKeys(scope || 'phone');
var rec = { id: uid('bk'), ts: Date.now(), time: nowISO(), label: label || '归档', scope: scope || 'phone', keys: keys, snapshot: snapshotOf(keys)};
var list = listBackups();
list.push(rec);
if (list.length > MAX_BACKUPS) list = list.slice(-MAX_BACKUPS);
lsSet(BACKUP_KEY, list);
return rec;
}
function previewDiff(scope, incoming) {
/* incoming: {key: rawString} 将要写入的内容；不传则只预览归档范围 */
var keys = scopeKeys(scope || 'phone');
var lines = [];
keys.forEach(function (k) {
var cur = rawGet(k);
var curN = cur == null? 0: cur.length;
if (incoming && Object.prototype.hasOwnProperty.call(incoming, k)) {
var next = incoming[k];
lines.push({ key: k, before: cur == null? '（无）': curN + ' 字符', after: next == null? '（删除）': String(next).length + ' 字符', change: cur == null? '新增': (next == null? '删除': (cur === next? '不变': '改写'))});
} else {
lines.push({ key: k, before: cur == null? '（无）': curN + ' 字符', after: '归档后保持不变', change: cur == null? '无此键': '仅归档'});
}
});
return { scope: scope || 'phone', keys: keys, lines: lines, summary: '范围「' + (scope || 'phone') + '」共 ' + keys.length + ' 个键；先归档当前状态，再写入。'};
}
function previewText(diff) {
var s = diff.summary + '\n';
diff.lines.slice(0, 12).forEach(function (l) { s += '· ' + l.key + '：' + l.before + ' → ' + l.after + '（' + l.change + '）\n';});
if (diff.lines.length > 12) s += '· ……其余 ' + (diff.lines.length - 12) + ' 个键见安全中心\n';
return s;
}
function safeWrite(label, scope, writes) {
/* 预览 → 归档 → 写。writes: {key: rawString} */
var diff = previewDiff(scope, writes);
var bk = archiveCurrent(label + '（写前归档）', scope);
Object.keys(writes).forEach(function (k) { rawSet(k, writes[k]);});
return { backupId: bk.id, diff: diff};
}
function listUndo() { var u = lsGet(UNDO_KEY, []); return Array.isArray(u)? u: [];}
function recordEditUndo(kind, key, beforeRaw, label) {
var list = listUndo();
var rec = { id: uid('ud'), ts: Date.now(), time: nowISO(), kind: kind, key: key, beforeRaw: beforeRaw == null? null: String(beforeRaw), label: label || (kind + ' 编辑前快照')};
list.push(rec);
if (list.length > MAX_UNDO) list = list.slice(-MAX_UNDO);
lsSet(UNDO_KEY, list);
return rec;
}
function undoById(id) {
var list = listUndo();
var rec = null;
for (var i = list.length - 1; i >= 0; i--) { if (!id || list[i].id === id) { rec = list[i]; break;}}
if (!rec) return { ok: false, reason: 'no_undo'};
rawSet(rec.key, rec.beforeRaw);
if (rec.key === MEM_KEY) buildMemIndex();
lsSet(UNDO_KEY, list.filter(function (r) { return r.id!== rec.id;}));
return { ok: true, label: rec.label, key: rec.key};
}
function undoLast() { return undoById(null);}
function restoreBackup(id) {
/* 恢复前先归档当前状态（永远有网兜），再写恢复内容；恢复本身也可撤销 */
var list = listBackups();
var rec = null;
list.forEach(function (r) { if (r.id === id) rec = r;});
if (!rec) return { ok: false, reason: 'no_backup'};
var net = archiveCurrent('恢复前归档（恢复「' + rec.label + '」之前）', rec.scope);
applySnapshot(rec.snapshot);
recordEditUndo('restore', rec.keys[0] || '', null, '恢复「' + rec.label + '」的网兜归档：' + net.id);
if (rec.scope === 'guichao' || (rec.keys || []).indexOf(MEM_KEY) >= 0) buildMemIndex();
return { ok: true, restored: rec.label, netBackupId: net.id};
}
function confirmExport(scope, fn, opts) {
opts = opts || {};
var diff = previewDiff(scope);
var ok = true;
if (!opts.autoConfirm) {
try { ok = window.confirm('导出前先按安全流程走：\n\n' + previewText(diff) + '\n点「确定」先归档当前状态，再导出。');} catch (e) { ok = true;}
}
if (!ok) return { ok: false, reason: 'cancelled'};
var bk = archiveCurrent('导出前归档（' + scope + '）', scope);
try { fn();} catch (e) { return { ok: false, reason: 'export_failed', backupId: bk.id};}
return { ok: true, backupId: bk.id};
}
function confirmImport(fn, opts) {
opts = opts || {};
var ok = true;
if (!opts.autoConfirm) {
try { ok = window.confirm('导入前先归档当前全部状态，导入出问题可以从「备份与安全中心」恢复。\n点「确定」先归档，再选择导入文件。');} catch (e) { ok = true;}
}
if (!ok) return { ok: false, reason: 'cancelled'};
var bk = archiveCurrent('导入前归档（全部）', 'phone');
try { fn();} catch (e) { return { ok: false, reason: 'import_failed', backupId: bk.id};}
return { ok: true, backupId: bk.id};
}

/* ── 归巢记忆 / 日记（只读旧键形状，写回时先记撤销）── */
function getMemories() {
var raw = lsGet(MEM_KEY, null);
if (Array.isArray(raw)) return raw;
if (raw && Array.isArray(raw.memories)) return raw.memories;
if (raw && typeof raw === 'object') return Object.keys(raw).map(function (k) { var m = raw[k]; if (m && typeof m === 'object') { m.id = m.id || k; return m;} return { id: k, content: String(m)};});
return [];
}
function memText(m) { return m.content || m.text || m.body || m.summary || m.title || '';}
function memCat(m) { return m.category || m.cat || m.type || '未分类';}
function memDate(m) { return m.date || m.createdAt || m.created_at || m.time || '';}
function memFactKey(m) { return m.factKey || m.fact_key || m.key || '';}
function buildMemIndex() {
var mems = getMemories();
var byFact = {}, byCat = {}, byDate = {};
mems.forEach(function (m) {
var fk = memFactKey(m); if (fk) { (byFact[fk] = byFact[fk] || []).push(m.id);}
var c = memCat(m); (byCat[c] = byCat[c] || []).push(m.id);
var d = String(memDate(m)).slice(0, 10); if (d) { (byDate[d] = byDate[d] || []).push(m.id);}
});
var idx = { builtAt: nowISO(), count: mems.length, byFactKey: byFact, byCategory: byCat, byDate: byDate};
lsSet(INDEX_KEY, idx);
return idx;
}
function searchMemIndex(q) {
var idx = lsGet(INDEX_KEY, null) || buildMemIndex();
var mems = getMemories();
var byId = {}; mems.forEach(function (m) { byId[m.id] = m;});
var hits = [];
var addIds = function (ids, why) { (ids || []).forEach(function (id) { if (byId[id] && hits.indexOf(byId[id]) < 0) { var m = byId[id]; m._hitWhy = why; hits.push(m);}});};
if (idx.byFactKey && idx.byFactKey[q]) addIds(idx.byFactKey[q], '事实 key');
if (idx.byCategory && idx.byCategory[q]) addIds(idx.byCategory[q], '分类');
if (idx.byDate && idx.byDate[q]) addIds(idx.byDate[q], '日期');
var ql = String(q).toLowerCase();
mems.forEach(function (m) { if (memText(m).toLowerCase().indexOf(ql) >= 0 && hits.indexOf(m) < 0) { m._hitWhy = '内容'; hits.push(m);}});
return hits;
}
function editMemory(id, patch) {
var before = rawGet(MEM_KEY);
var mems = getMemories();
var found = false;
mems = mems.map(function (m) { if (String(m.id) === String(id)) { found = true; var n = {}; Object.keys(m).forEach(function (k) { n[k] = m[k];}); Object.keys(patch).forEach(function (k) { n[k] = patch[k];}); return n;} return m;});
if (!found) return { ok: false, reason: 'not_found'};
var rec = recordEditUndo('memory', MEM_KEY, before, '编辑记忆 ' + id + ' 前');
rawSet(MEM_KEY, JSON.stringify(mems));
buildMemIndex();
return { ok: true, undoId: rec.id};
}
function getDiaries() { var raw = lsGet(DIARY_KEY, null); if (Array.isArray(raw)) return raw; if (raw && Array.isArray(raw.diaries)) return raw.diaries; return [];}
function editDiary(idOrDate, patch) {
var before = rawGet(DIARY_KEY);
var ds = getDiaries();
var found = false;
ds = ds.map(function (d) { if (String(d.id) === String(idOrDate) || String(d.date) === String(idOrDate)) { found = true; var n = {}; Object.keys(d).forEach(function (k) { n[k] = d[k];}); Object.keys(patch).forEach(function (k) { n[k] = patch[k];}); return n;} return d;});
if (!found) return { ok: false, reason: 'not_found'};
var rec = recordEditUndo('diary', DIARY_KEY, before, '编辑日记 ' + idOrDate + ' 前');
rawSet(DIARY_KEY, JSON.stringify(ds));
return { ok: true, undoId: rec.id};
}

/* ── A21 微信会话一致性检查（启动时校验，坏了提示、不静默丢数据）── */
function wxStore() { try { if (typeof AppRegistry!== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) return AppRegistry.wechat.wxStore;} catch (e) {} return null;}
function wxSessions() { var s = wxStore(); if (s && Array.isArray(s.sessions)) return s.sessions; var raw = lsGet(WX_KEY, null); if (raw && Array.isArray(raw.sessions)) return raw.sessions; return [];}
function persistWx() { var s = wxStore(); try { if (s && typeof s._persist === 'function') { s._persist(); return true;}} catch (e) {} try { var raw = lsGet(WX_KEY, null); if (raw) { raw.sessions = wxSessions(); lsSet(WX_KEY, raw); return true;}} catch (e) {} return false;}
function validateWxSessions() {
var sessions = wxSessions();
var issues = [];
sessions.forEach(function (s, i) {
if (!s || typeof s!== 'object') { issues.push({ index: i, problem: '会话不是对象'}); return;}
if (!s.id) issues.push({ sessionIndex: i, problem: '缺少 id'});
if (!s.name) issues.push({ sessionId: s.id, problem: '缺少名字'});
if (!Array.isArray(s.messages)) issues.push({ sessionId: s.id || i, name: s.name, problem: 'messages 不是数组（共 ' + (s.messages == null? '无': typeof s.messages) + '）'});
else s.messages.forEach(function (m, j) { if (!m || typeof m!== 'object' || (m.content == null && m.text == null && m.type!== 'image')) issues.push({ sessionId: s.id, msgIndex: j, problem: '消息缺内容'});});
});
return { ok: issues.length === 0, count: sessions.length, issues: issues};
}
function validateWxSessionsAtStartup() {
var r = validateWxSessions();
if (!r.ok) toast('微信会话检查发现 ' + r.issues.length + ' 个问题（数据未删除，详见备份与安全中心）：' + r.issues.slice(0, 2).map(function (x) { return x.problem;}).join('；'));
return r;
}

/* ── A20 命名空间清单 ── */
function namespaceInventory() {
var keys = allKeys();
var charKeys = [], sysKeys = [], otherKeys = [];
keys.forEach(function (k) {
if (CHAR_OWNED_KEYS.indexOf(k) >= 0 || k.indexOf('char:') === 0 || k.indexOf('char_') === 0) charKeys.push(k);
else if (/^(phone_|cike_|wx_|iconsystem|guichao|novel_|worldbook_|backend_|ck_|os_)/.test(k)) sysKeys.push(k);
else otherKeys.push(k);
});
return { char: charKeys.sort(), system: sysKeys.sort(), other: otherKeys.sort(), counts: { char: charKeys.length, system: sysKeys.length, other: otherKeys.length, total: keys.length}, doc: 'char: 命名空间：一切属于这个角色的数据（人设、角色导入对话、内心日志/目标/承诺、驱动/梦境）都归 char: 前缀（历史遗留 char_ 前缀同属）；手机系统数据用 phone_/cike_/wx_/guichao. 等前缀；新键按此前缀命名，旧键不动、不迁移。'};
}

/* ── A22 界面偏好统一键：读写 + 迁移 ── */
/* GROUP-THROTTLE: prefs 写版本号（主题解析缓存的失效信号）——同页写 phone_ui_prefs_v1 的
   漏斗（T setUiPrefs、V writePrefs、W savePrefs、AC writeJSON、两处直写兜底）每写一次 +1；各主题解析
   缓存只认“同版本号 + 短 TTL 内”的结果，写后立即失效，不靠 TTL 等；跨 tab 由各模块
   已有的 storage 监听 bump。色板数值不动，只节流读取。 */
window.__throttlePrefsRev = (typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
window.__throttlePrefsBump = window.__throttlePrefsBump || function () { window.__throttlePrefsRev = (window.__throttlePrefsRev || 0) + 1; };
var _coreUiPrefsRaw = null, _coreUiPrefsAt = 0, _coreUiPrefsRev = -1, _coreUiPrefsReady = false;
function getUiPrefs() {
/* GROUP-CORE: 原始解析结果缓存——复用 GROUP-THROTTLE 写版本号 + 500ms TTL；每次仍返回新合并对象，调用方改返回对象不污染缓存。 */
var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
var _now = Date.now();
var p;
if (_coreUiPrefsReady && _coreUiPrefsRev === _rev && _now - _coreUiPrefsAt < 500) { p = _coreUiPrefsRaw; }
else { p = lsGet(PREFS_KEY, null); _coreUiPrefsRaw = p; _coreUiPrefsAt = _now; _coreUiPrefsRev = _rev; _coreUiPrefsReady = true; }
if (!p || typeof p!== 'object') return JSON.parse(JSON.stringify(PREFS_DEFAULT));
var out = JSON.parse(JSON.stringify(PREFS_DEFAULT));
Object.keys(PREFS_DEFAULT).forEach(function (k) { if (p[k]!== undefined) out[k] = p[k];});
/* 布局只认 default/compact：旧迁移曾把图标位置对象 String() 成 "[object Object]" 写进来，读到非法值一律回默认（保存偏好时会写回合法值） */
if (out.layout !== 'default' && out.layout !== 'compact') out.layout = 'default';
if (out.themeCustom == null || typeof out.themeCustom !== 'object') out.themeCustom = { c1: '#ffffff', c2: '#34363b' };
return out;
}
function setUiPrefs(patch) {
var cur = getUiPrefs();
Object.keys(patch || {}).forEach(function (k) { if (k in PREFS_DEFAULT) cur[k] = patch[k];});
lsSet(PREFS_KEY, cur);
try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */
return cur;
}
function migrateUiPrefs() {
/* 旧的分散偏好读一次、写进统一键；只读旧键，绝不回写旧键。 */
var cur = lsGet(PREFS_KEY, null);
var from = [];
var patch = {};
var s3 = lsGet('phone_settings_v3', null);
if (s3 && typeof s3 === 'object') {
from.push('phone_settings_v3');
if (typeof s3.theme === 'string') patch.theme = s3.theme;
if (typeof s3.lang === 'string') patch.lang = s3.lang;
if (typeof s3.wallpaper === 'string') patch.wallpaper = s3.wallpaper;
if (typeof s3.layout === 'string') patch.layout = s3.layout;
}
var wp = rawGet('phone_wallpaper_v1') || rawGet('phone_wallpaper');
if (wp) { from.push('phone_wallpaper_v1'); if (!patch.wallpaper) patch.wallpaper = wp;}
var icons = lsGet('iconsystem_v1', null);
if (icons && typeof icons === 'object') { from.push('iconsystem_v1'); /* iconsystem 的 layout 是图标位置对象（各区 id 数组），不是偏好的 default/compact，绝不能 String() 进来（会写成 "[object Object]"）；只接受字符串枚举值 */ if (typeof icons.layout === 'string' && (icons.layout === 'default' || icons.layout === 'compact') && !patch.layout) patch.layout = icons.layout;}
var pet = lsGet('char_inner_switches_v1', null);
if (pet && typeof pet === 'object') { from.push('char_inner_switches_v1');}
if (!cur) { var created = JSON.parse(JSON.stringify(PREFS_DEFAULT)); Object.keys(patch).forEach(function (k) { created[k] = patch[k];}); created.migratedFrom = from; lsSet(PREFS_KEY, created); try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */ return { created: true, from: from, prefs: created};}
var merged = false;
Object.keys(patch).forEach(function (k) { if (cur[k] === PREFS_DEFAULT[k] || cur[k] === '' || cur[k] == null) { cur[k] = patch[k]; merged = true;}});
from.forEach(function (f) { if ((cur.migratedFrom || []).indexOf(f) < 0) { cur.migratedFrom = (cur.migratedFrom || []).concat([f]); merged = true;}});
if (merged) { lsSet(PREFS_KEY, cur); try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存 */ }
return { created: false, merged: merged, from: from, prefs: cur};
}

/* ── A25 上下文仪表（本地近似版：消息数/记忆量；100% = 压缩点）── */
var CTX_MSG_CAP = 100; /* 微信持久化每会话只留最近 100 条 */
var CTX_MEM_CAP = 120; /* 长期记忆上限 120 条 */
function contextUsage(sessionId) {
var sessions = wxSessions();
var sess = null;
sessions.forEach(function (s) { if (s.id === sessionId) sess = s;});
if (!sess && sessions.length) sess = sessions[0];
var msgCount = sess && Array.isArray(sess.messages)? sess.messages.length: 0;
var memCount = getMemories().length;
var pct = Math.min(100, Math.round(100 * (0.6 * Math.min(msgCount, CTX_MSG_CAP) / CTX_MSG_CAP + 0.4 * Math.min(memCount, CTX_MEM_CAP) / CTX_MEM_CAP)));
return { sessionId: sess? sess.id: null, sessionName: sess? sess.name: '', msgCount: msgCount, memCount: memCount, msgCap: CTX_MSG_CAP, memCap: CTX_MEM_CAP, pct: pct, needCompress: pct >= 100};
}
function contextMeterHTML(sessionId, variant) {
var u = contextUsage(sessionId);
var bar = '<div style="height:6px;background:var(--st-silver-light,#dce2f1);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + u.pct + '%;background:' + (u.needCompress? 'var(--st-danger,#7c2d2d)': 'var(--st-silver,#bfc8e0)') + ';"></div></div>';
var tip = u.needCompress? '可以压缩了（已满 100%）': '上下文 ' + u.pct + '%';
var inner = bar + '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span>' + esc(tip) + ' · 消息 ' + u.msgCount + '/' + u.msgCap + ' · 记忆 ' + u.memCount + '/' + u.memCap + '</span><span style="color:var(--st-ink,#1e2748);font-weight:500;cursor:pointer;" onclick="window.SafeBackupT.requestCompress(\'' + esc(u.sessionId || '') + '\')">压缩</span></div>';
/* variant 'card'：安全中心备份页里的卡片版——不用聊天页的通条底色/下边框；id 也另起，避免与聊天页那条重名、被 1.5s 轮询 ensureCtxMeter 误换。 */
if (variant === 'card') return '<div id="t-ctx-meter-center" style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));" data-pct="' + u.pct + '">' + inner + '</div>';
return '<div id="t-ctx-meter" style="padding:8px 12px;background:var(--st-paper-cool,#eef0f5);border-bottom:1px solid var(--st-silver,#bfc8e0);font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));" data-pct="' + u.pct + '">' + inner + '</div>';
}
function requestCompress(sessionId) {
/* U 组压缩未合入：先提示 + 记一条，不假装已压缩。合入后这里改为调用 U 组入口。 */
var notes = lsGet(CTX_KEY, []);
if (!Array.isArray(notes)) notes = [];
var u = contextUsage(sessionId);
var note = { id: uid('ctx'), ts: Date.now(), time: nowISO(), sessionId: u.sessionId, sessionName: u.sessionName, pct: u.pct, msgCount: u.msgCount, memCount: u.memCount, status: (typeof window.UCompress!== 'undefined' && window.UCompress.compress)? 'handed_to_u': 'pending_u_group'};
notes.push(note);
lsSet(CTX_KEY, notes);
if (note.status === 'handed_to_u') { try { window.UCompress.compress(sessionId);} catch (e) {} toast('已交给 U 组压缩。');}
else toast('已记一条压缩请求（' + u.pct + '%，可以压缩了）。U 组压缩未合入，暂未真正压缩。');
return note;
}

/* ── A34 本地聊天搜索（关键词；引用原文 + 日期；点结果跳转）── */
function msgText(m) { return m.content!= null? String(m.content): (m.text!= null? String(m.text): '');}
function msgDate(m, sess) { return m.time || m.date || m.createdAt || sess.lastTime || '';}
function searchAllChats(q, opts) {
opts = opts || {};
var needle = String(q == null? '': q).toLowerCase();
if (!needle) return [];
var results = [];
var scan = function (sess, source) {
(sess.messages || []).forEach(function (m, i) {
var t = msgText(m);
if (t.toLowerCase().indexOf(needle) < 0) return;
results.push({ sessionId: sess.id, sessionName: sess.name, source: source, msgId: m.id || ('msg_' + i), sender: m.sender || '', text: t, quote: t.length > 80? t.slice(0, 80) + '…': t, date: msgDate(m, sess), index: i});
});
};
wxSessions().forEach(function (s) { scan(s, '微信会话');});
var imported = lsGet(IMPORT_KEY, []);
if (Array.isArray(imported)) imported.forEach(function (c) { scan({ id: c.sessionId || ('import_' + c.id), name: c.title, messages: c.messages || [], lastTime: c.date}, '导入归档');});
results.sort(function (a, b) { return String(b.date).localeCompare(String(a.date));});
return results;
}
function searchImportedChats(q) {
var needle = String(q == null? '': q).toLowerCase();
var imported = lsGet(IMPORT_KEY, []);
if (!Array.isArray(imported)) return [];
var out = [];
imported.forEach(function (c) {
var hits = (c.messages || []).filter(function (m) { return msgText(m).toLowerCase().indexOf(needle) >= 0;});
if ((c.title || '').toLowerCase().indexOf(needle) >= 0 || hits.length) out.push({ id: c.id, title: c.title, date: c.date, count: (c.messages || []).length, hits: hits.length});
});
return out;
}
function jumpToMessage(sessionId, msgId) {
var sessions = wxSessions();
var sess = null;
sessions.forEach(function (s) { if (s.id === sessionId) sess = s;});
if (!sess) {
var imported = lsGet(IMPORT_KEY, []);
var found = null;
(Array.isArray(imported)? imported: []).forEach(function (c) { if (c.sessionId === sessionId || ('import_' + c.id) === sessionId) found = c;});
if (!found) return { ok: false, reason: 'no_session'};
sess = { id: found.sessionId || ('import_' + found.id), name: '【导入】' + (found.title || '旧对话'), messages: found.messages || [], preview: '', lastTime: found.date || ''};
var store = wxStore();
if (store) { store.sessions.push(sess); persistWx();}
}
var store2 = wxStore();
if (store2) store2.currentChatId = sess.id;
try { if (typeof WeChatAppEngine!== 'undefined' && WeChatAppEngine.openChatDetail) WeChatAppEngine.openChatDetail(sess.id);} catch (e) {}
try { setUiPrefs({ lastChat: sess.id});} catch (e) {}
setTimeout(function () {
try {
var box = document.getElementById('wx-msg-stream-container');
if (!box) return;
var els = box.querySelectorAll('[data-msg-id="' + msgId + '"]');
if (els.length) { els[0].scrollIntoView({ block: 'center'}); els[0].style.outline = '2px solid var(--st-ink,#1e2748)'; setTimeout(function () { els[0].style.outline = '';}, 2500);}
else box.scrollTop = box.scrollHeight;
} catch (e) {}
}, 60);
return { ok: true, sessionId: sess.id, msgId: msgId};
}

/* ── 旧对话导入（Pulse A9：先预览、再挑、再存；清洗；关键词可搜）── */
var SYSTEM_PROMPT_RE = /^(You are|You\'re|你是|System prompt|系统提示词|## Instructions|# System\b)/i;
function cleanMessages(msgs) {
return (msgs || []).filter(function (m) {
var t = String(m.text == null? '': m.text).trim();
if (!t) return false;
if ((m.sender === 'system' || m.role === 'system') && SYSTEM_PROMPT_RE.test(t)) return false;
if (SYSTEM_PROMPT_RE.test(t) && t.length < 400 && /AI|助手|模型|assistant|模型/i.test(t)) return false;
return true;
}).map(function (m) { return { sender: m.sender || m.role || '对方', text: String(m.text == null? '': m.text), time: m.time || m.date || ''};});
}
function parseImport(text, formatHint) {
var raw = String(text == null? '': text).trim();
if (!raw) return { format: 'empty', conversations: []};
var asJson = null;
try { asJson = JSON.parse(raw);} catch (e) { asJson = null;}
if (asJson) return parseImportJson(asJson, formatHint);
if (/^#\s+\S/m.test(raw) || /\*\*(我|对方|AI|助手|user|assistant)\*\*/.test(raw)) return parseImportMarkdown(raw);
return parseImportPlain(raw);
}
function normMsgList(list, defaultSender) {
return (list || []).map(function (m) {
if (typeof m === 'string') return { sender: defaultSender || '对方', text: m, time: ''};
var role = m.role || m.sender || m.author || '';
var sender = role === 'user' || role === 'human' || role === '我'? '我': (role === 'assistant' || role === 'ai' || role === 'AI'? 'AI': (role || (defaultSender || '对方')));
var text = '';
if (typeof m.content === 'string') text = m.content;
else if (m.content && Array.isArray(m.content.parts)) text = m.content.parts.filter(function (p) { return typeof p === 'string';}).join('\n');
else if (Array.isArray(m.content)) text = m.content.map(function (p) { return typeof p === 'string'? p: (p.text || '');}).join('\n');
else text = m.text || m.message || '';
return { sender: sender, text: String(text), time: m.time || m.date || m.create_time || m.created_at || ''};
});
}
function parseImportJson(j, formatHint) {
var convs = [];
var list = null, format = formatHint || 'json';
if (Array.isArray(j)) list = j;
else if (Array.isArray(j.conversations)) { list = j.conversations; format = 'chatgpt-or-claude';}
else if (Array.isArray(j.sessions)) list = j.sessions;
else if (Array.isArray(j.chats)) list = j.chats;
else if (j.title && (j.messages || j.mapping)) list = [j];
else if (j.name && (j.chat_messages || j.messages)) list = [j];
if (!list) return { format: 'json-unknown', conversations: []};
list.forEach(function (c, i) {
var title = c.title || c.name || ('对话 ' + (i + 1));
var date = c.create_time? new Date(c.create_time * 1000).toISOString().slice(0, 10): (c.created_at || c.date || c.update_time || '');
var msgs = [];
if (c.mapping && typeof c.mapping === 'object') {
var nodes = Object.keys(c.mapping).map(function (k) { return c.mapping[k];});
nodes.sort(function (a, b) { return (a.message && a.message.create_time || 0) - (b.message && b.message.create_time || 0);});
nodes.forEach(function (n) { var m = n.message; if (!m ||!m.content) return; var role = m.author? m.author.role: ''; var parts = m.content.parts || []; msgs.push({ sender: role, text: parts.filter(function (p) { return typeof p === 'string';}).join('\n'), time: m.create_time? new Date(m.create_time * 1000).toISOString().slice(0, 10): ''});});
format = 'chatgpt';
} else if (Array.isArray(c.chat_messages)) { msgs = c.chat_messages.map(function (m) { return { sender: m.sender || m.role, text: m.text || m.content || '', time: m.created_at || ''};}); format = 'claude';}
else if (Array.isArray(c.messages)) msgs = normMsgList(c.messages);
msgs = cleanMessages(msgs);
convs.push({ title: String(title), date: String(date).slice(0, 10), count: msgs.length, messages: msgs});
});
return { format: format, conversations: convs};
}
function parseImportMarkdown(raw) {
var sections = raw.split(/(?=^#\s+\S)/m).filter(function (s) { return s.trim();});
if (!sections.length) sections = [raw];
var convs = sections.map(function (sec, i) {
var lines = sec.split('\n');
var title = '对话 ' + (i + 1);
var date = '';
var msgs = [];
lines.forEach(function (ln) {
var hm = ln.match(/^#\s+(.+)$/);
if (hm) { title = hm[1].trim(); return;}
var dm = ln.match(/(\d{4}-\d{2}-\d{2})/);
if (dm &&!date) date = dm[1];
var mm = ln.match(/^(?:\*\*)?(我|对方|AI|助手|user|assistant)(?:\*\*)?[:：]\s*(.*)$/);
if (mm) { msgs.push({ sender: mm[1] === '我' || mm[1] === 'user'? '我': (mm[1] === '对方'? '对方': 'AI'), text: mm[2], time: date}); return;}
if (/^\s*[-*]\s+\S/.test(ln)) msgs.push({ sender: '对方', text: ln.replace(/^\s*[-*]\s+/, ''), time: date});
});
msgs = cleanMessages(msgs);
return { title: title, date: date, count: msgs.length, messages: msgs};
});
return { format: 'markdown', conversations: convs};
}
function parseImportPlain(raw) {
var lines = raw.split('\n').map(function (l) { return l.trim();}).filter(function (l) { return l;});
var msgs = lines.map(function (ln) {
var mm = ln.match(/^(我|对方|AI|助手)[:：]\s*(.*)$/);
if (mm) return { sender: mm[1] === '我'? '我': mm[1], text: mm[2], time: ''};
return { sender: '对方', text: ln, time: ''};
});
msgs = cleanMessages(msgs);
return { format: 'text', conversations: [{ title: '导入的对话', date: '', count: msgs.length, messages: msgs}]};
}
function importConversations(parsed, selectedIndexes) {
var sel = selectedIndexes && selectedIndexes.length? selectedIndexes: (parsed.conversations || []).map(function (_, i) { return i;});
var archive = lsGet(IMPORT_KEY, []);
if (!Array.isArray(archive)) archive = [];
var created = [];
sel.forEach(function (idx) {
var c = (parsed.conversations || [])[idx];
if (!c) return;
var rec = { id: uid('imp'), ts: Date.now(), time: nowISO(), title: c.title, date: c.date || '', count: c.messages.length, messages: c.messages, sessionId: 'import_' + Date.now().toString(36) + '_' + idx};
archive.push(rec);
var store = wxStore();
var sess = { id: rec.sessionId, name: '【导入】' + c.title, remark: '', avatar: '', messages: c.messages.map(function (m, i) { return { id: 'imp_' + rec.id + '_' + i, sender: m.sender, type: 'text', content: m.text, time: m.time || c.date || ''};}), preview: c.messages.length? String(c.messages[c.messages.length - 1].text).slice(0, 40): '', lastTime: c.date || fmtTime(Date.now()), unread: 0};
if (store) { store.sessions.push(sess); persistWx();}
else { var raw = lsGet(WX_KEY, null); if (raw && Array.isArray(raw.sessions)) { raw.sessions.push(sess); lsSet(WX_KEY, raw);}}
created.push({ sessionId: sess.id, title: c.title, count: c.messages.length});
});
lsSet(IMPORT_KEY, archive);
return { ok: true, created: created, archived: archive.length};
}

/* ── 微信列表顶部搜索框（由补丁接线在 renderUpdates 里调用）── */
function ensureWxSearchBox() {
try {
var sBox = document.getElementById('wx-sessions-container');
if (!sBox ||!sBox.parentNode) return false;
if (document.getElementById('t-wx-search-box')) return true;
var wrap = document.createElement('div');
wrap.id = 't-wx-search-box';
wrap.innerHTML = '<div id="t-wx-search-results"></div>';
sBox.parentNode.insertBefore(wrap, sBox);
var input = document.querySelector('#wx-view-sessions .wx-search-box input');
if (!input) { wrap.remove(); return false; }
input.addEventListener('input', function () { renderWxSearchResults(input.value);});
input.addEventListener('keydown', function (e) { if (e.key === 'Enter') renderWxSearchResults(input.value);});
return true;
} catch (e) { return false;}
}
function renderWxSearchResults(q) {
try {
var box = document.getElementById('t-wx-search-results');
if (!box) return [];
var query = String(q || '').trim();
if (!query) { box.innerHTML = ''; return [];}
var hits = searchAllChats(query).slice(0, 10);
if (!hits.length) { box.innerHTML = '<div style="font-size:12px;color:#999;padding:6px 2px;">没有找到「' + esc(query) + '」</div>'; return [];}
box.innerHTML = hits.map(function (h) {
return '<div data-t-hit="1" data-session="' + esc(h.sessionId) + '" data-msg="' + esc(h.msgId) + '" style="padding:8px;border-bottom:1px solid #f0f0f0;cursor:pointer;" onclick="window.SafeBackupT.jumpToMessage(\'' + esc(h.sessionId).replace(/'/g, '') + '\',\'' + esc(h.msgId).replace(/'/g, '') + '\')">' +
'<div style="font-size:13px;font-weight:600;">' + esc(h.sessionName) + ' <span style="font-weight:400;color:#999;font-size:11px;">' + esc(h.date || '') + ' · ' + esc(h.source) + '</span></div>' +
'<div style="font-size:12px;color:#666;margin-top:2px;">' + esc(h.quote) + '</div></div>';
}).join('');
return hits;
} catch (e) { return [];}
}

/* ── 上下文仪表：聊天页一比一仿真，不再往聊天页顶部插仪表条；contextMeterHTML/requestCompress 仍供安全中心卡片版使用 ── */
function ensureCtxMeter() {
try {
var old = document.getElementById('t-ctx-meter');
if (old) { old.remove(); }
return false;
} catch (e) { return false;}
}

/* ── 安全中心 UI（设置页入口 + 各 tab）── */
var _pendingImport = null;
function openCenter(tab) {
closeCenter();
var overlay = document.createElement('div');
overlay.id = 't-safe-center';
overlay.style.cssText = 'position:fixed;inset:0;background:var(--st-paper,#fffdf8);z-index:99999;overflow:auto;font-family:inherit;color:var(--st-ink,#1e2748);';
overlay.innerHTML =
'<div style="position:sticky;top:0;background:var(--st-paper,#fffdf8);border-bottom:1px solid var(--st-ink-20,rgba(30,39,72,.2));padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">' +
'<div style="font-size:20px;font-weight:600;">备份与安全中心</div>' +
'<button onclick="window.SafeBackupT.closeCenter()" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;">关闭</button></div>' +
'<div style="display:flex;gap:8px;padding:12px 16px;flex-wrap:wrap;border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));">' +
['backup|备份与恢复', 'import|导入旧对话', 'memory|记忆与撤销', 'ns|命名空间', 'prefs|界面偏好', 'search|聊天搜索'].map(function (t) {
var parts = t.split('|');
return '<button data-t-tab="' + parts[0] + '" onclick="window.SafeBackupT._ui.showTab(\'' + parts[0] + '\')" style="border:1px solid var(--st-silver,#bfc8e0);background:' + ((tab || 'backup') === parts[0]? 'var(--st-silver-light,#dce2f1);color:var(--st-ink,#1e2748)': 'var(--st-paper,#fffdf8)') + ';border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;">' + parts[1] + '</button>';
}).join('') + '</div>' +
'<div id="t-center-body" style="padding:16px;"></div>';
document.body.appendChild(overlay);
showTab(tab || 'backup');
}
function closeCenter() { try { var el = document.getElementById('t-safe-center'); if (el) el.remove();} catch (e) {}}
function centerBody() { return document.getElementById('t-center-body');}
function showTab(name) {
var body = centerBody();
if (!body) return;
var btns = document.querySelectorAll('#t-safe-center [data-t-tab]');
btns.forEach(function (b) { var on = b.getAttribute('data-t-tab') === name; b.style.background = on? 'var(--st-silver-light,#dce2f1)': 'var(--st-paper,#fffdf8)'; b.style.color = 'var(--st-ink,#1e2748)';});
if (name === 'backup') body.innerHTML = renderBackupTab();
else if (name === 'import') body.innerHTML = renderImportTab();
else if (name === 'memory') body.innerHTML = renderMemoryTab();
else if (name === 'ns') body.innerHTML = renderNsTab();
else if (name === 'prefs') body.innerHTML = renderPrefsTab();
else if (name === 'search') body.innerHTML = renderSearchTab();
}
function renderBackupTab() {
var backs = listBackups().slice().reverse();
var undos = listUndo().slice().reverse();
var rows = backs.map(function (b) {
return '<div class="t-backup-row" style="border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:10px;padding:12px 16px;margin-bottom:8px;"><div style="font-size:13px;font-weight:600;">' + esc(b.label) + '</div><div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin:4px 0;">' + esc(b.time || '') + ' · 范围 ' + esc(b.scope) + ' · ' + (b.keys || []).length + ' 个键</div><div><button onclick="window.SafeBackupT._ui.doRestore(\'' + b.id + '\')" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:13px;">恢复这条（先归档当前状态）</button></div></div>';
}).join('') || '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">暂无备份归档。</div>';
var urows = undos.map(function (u) {
return '<div style="font-size:13px;padding:8px 0;border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));">' + esc(u.label) + ' · ' + esc(u.time || '') + ' <button onclick="window.SafeBackupT._ui.doUndo(\'' + u.id + '\')" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:13px;">撤销</button></div>';
}).join('') || '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">暂无可撤销的编辑。</div>';
return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">安全模型：任何导出 / 导入 / 恢复都先展示会改变什么（预览 diff）→ 先把当前状态归档进备份区 → 再写 → 可撤销。恢复前一定先归档，永远有网兜。</div>' +
'<div style="border:1px solid var(--st-silver,#bfc8e0);border-radius:10px;padding:12px 16px;margin-bottom:12px;background:var(--st-paper,#fffdf8);"><div style="font-size:17px;font-weight:600;margin-bottom:8px;">上下文用量</div>' + contextMeterHTML(null, 'card') + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:8px;line-height:1.5;">100% = 该压缩了；只按消息与记忆的条数估算，不读内容。点“压缩”先记一条请求（U 组压缩未合入，暂不真正压缩）。</div></div>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
'<button onclick="window.SafeBackupT._ui.doExport(\'guichao\')" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">导出归巢（先归档）</button>' +
'<button onclick="window.SafeBackupT._ui.doExport(\'phone\')" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">导出整机备份（先归档）</button>' +
'<button onclick="window.SafeBackupT._ui.doArchiveNow()" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">只归档一次（不导出）</button>' +
'<button onclick="window.SafeBackupT._ui.openCharCard()" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">导出角色卡（先归档，再开原导出弹窗）</button></div>' +
'<div style="margin-bottom:12px;"><input id="t-backup-q" placeholder="搜索备份：标签 / 时间 / 范围，如 导出前归档" oninput="window.SafeBackupT._ui.filterBackups(this.value)" style="width:100%;box-sizing:border-box;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);" /></div>' +
'<div style="font-size:17px;font-weight:600;margin-bottom:8px;">备份归档（phone_backups_v1，最多 ' + MAX_BACKUPS + ' 条）</div>' + rows +
'<div style="font-size:17px;font-weight:600;margin:12px 0 8px;">可撤销的编辑</div>' + urows;
}
function renderImportTab() {
return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">旧对话导入（Pulse A9：先预览、再挑、再存）。支持 ChatGPT / Claude / Markdown / 纯文本四种导出：粘贴或上传文件后先解析出对话列表预览（标题、条数、日期），勾选要导入的，清洗掉明显的系统提示词和空消息后存档。导入的对话存进微信会话（新会话，标题标【导入】），同时归档进 char:imported_chats_v1，可关键词搜索。不用向量。</div>' +
'<textarea id="t-import-text" placeholder="粘贴 ChatGPT / Claude / Markdown / JSON 导出内容……" style="width:100%;box-sizing:border-box;height:120px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);"></textarea>' +
'<div style="display:flex;gap:8px;margin:10px 0;"><input type="file" id="t-import-file" accept=".json,.md,.txt" style="font-size:13px;" /><button onclick="window.SafeBackupT._ui.importPreview()" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">解析预览</button></div>' +
'<div id="t-import-preview"></div>';
}
function renderMemoryTab() {
var mems = getMemories();
var idx = lsGet(INDEX_KEY, null);
var rows = mems.slice(0, 30).map(function (m) {
return '<div style="border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:10px;padding:12px 16px;margin-bottom:8px;"><div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(memCat(m)) + ' · ' + esc(String(memDate(m)).slice(0, 10)) + (memFactKey(m)? ' · 事实 key：' + esc(memFactKey(m)): '') + '</div><div style="font-size:13px;margin:8px 0;">' + esc(memText(m)).slice(0, 120) + '</div><textarea id="t-mem-' + esc(String(m.id)) + '" style="width:100%;box-sizing:border-box;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);" rows="2">' + esc(memText(m)) + '</textarea><button onclick="window.SafeBackupT._ui.saveMemoryEdit(\'' + esc(String(m.id)).replace(/'/g, '') + '\')" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:13px;margin-top:8px;">保存修改（先记撤销记录）</button></div>';
}).join('') || '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">暂无记忆。</div>';
return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">记忆索引 guichao_mem_index_v1：按事实 key / 分类 / 日期索引，不改 guichao.memories.v1 本身。共 ' + mems.length + ' 条记忆' + (mems.length > 30 ? '（下方只列出前 30 条，其余请用上方搜索查）' : '') + (idx? '，索引建于 ' + esc(idx.builtAt || ''): '，索引尚未建立') + '。</div>' +
'<div style="display:flex;gap:8px;margin-bottom:12px;"><input id="t-mem-q" placeholder="按事实 key / 分类 / 日期查，如 喜好.咖啡" style="flex:1;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);" /><button onclick="window.SafeBackupT._ui.searchMem()" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">查索引</button><button onclick="window.SafeBackupT._ui.rebuildIndex()" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">重建索引</button></div>' +
'<div id="t-mem-hits" style="margin-bottom:12px;"></div>' + rows;
}
function renderNsTab() {
var inv = namespaceInventory();
var li = function (arr) { return arr.map(function (k) { return '<div class="t-ns-key" style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));word-break:break-all;">' + esc(k) + '</div>';}).join('') || '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">（无）</div>';};
return '<div style="margin-bottom:12px;"><input id="t-ns-q" placeholder="搜索 key 名，如 guichao / phone_" oninput="window.SafeBackupT._ui.filterNs(this.value)" style="width:100%;box-sizing:border-box;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);" /></div>' +
'<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">' + esc(inv.doc) + '</div>' +
'<div style="font-size:17px;font-weight:600;">属于 char（' + inv.counts.char + ' 个键）</div>' + li(inv.char) +
'<div style="font-size:17px;font-weight:600;margin-top:12px;">属于手机系统（' + inv.counts.system + ' 个键）</div>' + li(inv.system) +
'<div style="font-size:17px;font-weight:600;margin-top:12px;">其他（' + inv.counts.other + ' 个键）</div>' + li(inv.other);
}
function renderPrefsTab() {
var p = getUiPrefs();
/* 选项表：值沿用 phone_ui_prefs_v1 的原值（保存时原样写回），标签全部中文。
   选项来源与 js/00 的同名表一致（ICON_STYLES / CLOCK_STYLES / PET_MODES /
   PET_SIZES / PET_SKINS / WALLPAPERS）；这里各写一份字面量，不跨文件读 js/00 的
   const，避免加载顺序耦合。壁纸值可能是色值 / data URL / 路径，见不到的走“其他”兜底。 */
var OPTS = {
lang: [['zh-CN', '中文（简体）'], ['en', 'English']],
theme: [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统'], ['bu-spring-pink', '春·槐花粉'], ['bu-autumn-red', '秋·枫叶红'], ['bu-night-black', '夜·蜕茧黑'], ['bu-winter-blue', '冬·雪河蓝'], ['bu-mint', '薄荷绿'], ['bu-lavender', '薰衣草紫'], ['bu-cream', '奶油黄'], ['bu-forest', '墨绿']],
layout: [['default', '默认'], ['compact', '紧凑']],
iconStyle: [['default', '默认'], ['line', '极简线条'], ['jelly', '液态果冻'], ['frost', '磨砂玻璃'], ['classic', '经典纯色'], ['ios', 'iOS 原生']],
wallpaper: [['fish', '游鱼'], ['', '纯白'], ['#fdf2f4', '柔粉'], ['#eef7f2', '薄荷'], ['#eef4fb', '天空'], ['#faf6ef', '暖米'], ['unsent-words', '无法显现的文字'], ['rain-letters', '雨落碎了字里行间']],
petMode: [['full', '完整（书桌 + 溜达）'], ['walk-only', '只走路'], ['desk-only', '只坐桌']],
petSize: [['small', '小'], ['medium', '中'], ['large', '大']],
petSkin: [['default', 'QQ 小人（默认）'], ['cat', '小猫'], ['cutout', '抠图立绘'], ['pet-claude', 'Claude'], ['pet-chatgpt', 'ChatGPT'], ['pet-muse', 'Muse']],
clockStyle: [['default', '默认'], ['digital', '数字'], ['analog', '模拟表盘'], ['minimal', '简约']] /* 'default' 是 PREFS_DEFAULT 的存量值（js/00:17399 未命中 analog/minimal 时按数字渲染），必须进选项表，否则存量默认会显示成“其他（原值：default）” */
};
var SEL_STYLE = 'border:1px solid var(--st-silver,#bfc8e0);border-radius:8px;padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);max-width:200px;';
var otherLabel = function (cur) {
var s = String(cur == null ? '' : cur);
if (s.indexOf('data:') === 0 || s.indexOf('/') === 0 || s.indexOf('http') === 0) return '自定义图片';
return '其他（原值：' + (s.length > 12 ? s.slice(0, 12) + '…' : s) + '）';
};
var sel = function (id, opts, cur) {
var h = '<select id="' + id + '" style="' + SEL_STYLE + '">';
var found = false;
opts.forEach(function (o) { if (String(o[0]) === String(cur)) found = true; });
if (!found) h += '<option value="' + esc(cur) + '" selected>' + esc(otherLabel(cur)) + '</option>';
opts.forEach(function (o) { h += '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; });
return h + '</select>';
};
var hex = function (v, fb) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : fb; };
var c1 = hex(p.themeCustom.c1, '#ffffff'), c2 = hex(p.themeCustom.c2, '#34363b');
var colorCtl = function (id, val) {
return '<span style="display:inline-flex;align-items:center;gap:8px;"><input type="color" id="' + id + '" value="' + esc(val) + '" oninput="var s=this.nextElementSibling;if(s)s.textContent=this.value;" style="width:44px;height:32px;padding:2px;border:1px solid var(--st-silver,#bfc8e0);border-radius:8px;background:var(--st-paper,#fffdf8);" /><span style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + esc(val) + '</span></span>';
};
var row = function (label, ctl, last) {
return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;' + (last ? '' : 'border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));') + '"><span style="font-size:17px;flex-shrink:0;">' + label + '</span><span style="display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;">' + ctl + '</span></div>'; /* 控件 span 允许换行：主题行会被 js/22 的 #al-theme-extra 注入两个下拉+复选框+切换按钮，不换行时同一行挤压、两个下拉被压窄 */
};
var checkCtl = function (id, on) {
return '<span style="display:inline-flex;align-items:center;gap:8px;"><span style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + (on ? '开' : '关') + '</span><input id="' + id + '" type="checkbox"' + (on ? ' checked' : '') + ' class="st-check" /></span>';
};
return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">界面偏好统一存在本机，主题与桌面外观共用同一份；改完点“保存偏好”生效。</div>' +
'<div style="background:var(--st-paper,#fffdf8);border:1px solid var(--st-silver,#bfc8e0);border-radius:10px;overflow:hidden;margin-bottom:12px;">' +
row('语言', sel('t-p-lang', OPTS.lang, p.lang)) +
row('主题', sel('t-p-theme', OPTS.theme, p.theme)) +
row('自定义两色', colorCtl('t-p-c1', c1) + colorCtl('t-p-c2', c2)) +
row('布局', sel('t-p-layout', OPTS.layout, p.layout)) +
row('图标风格', sel('t-p-icon', OPTS.iconStyle, p.iconStyle)) +
row('壁纸', sel('t-p-wp', OPTS.wallpaper, p.wallpaper)) +
row('桌面组件', checkCtl('t-p-wd', p.widgetsEnabled)) +
row('桌面宠物', checkCtl('t-p-pet', p.petEnabled)) +
row('宠物模式', sel('t-p-petmode', OPTS.petMode, p.petMode)) +
row('宠物大小', sel('t-p-petsize', OPTS.petSize, p.petSize)) +
row('宠物皮肤', sel('t-p-petskin', OPTS.petSkin, p.petSkin)) +
row('时钟样式', sel('t-p-clock', OPTS.clockStyle, p.clockStyle), true) +
'</div>' +
'<div style="display:flex;gap:8px;margin-top:12px;"><button onclick="window.SafeBackupT._ui.savePrefs()" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">保存偏好</button><button onclick="window.SafeBackupT._ui.migrateNow()" style="border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">从旧分散偏好迁移一次</button></div>' +
'<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:12px;">已迁移来源：' + esc((p.migratedFrom || []).join('、') || '（无）') + '</div>';
}
function renderSearchTab() {
return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:12px;">本地聊天搜索：关键词搜全部会话的消息，引用原文 + 日期，点结果跳到那条消息。不改消息存储结构，不用向量。</div>' +
'<div style="display:flex;gap:8px;"><input id="t-search-q" placeholder="输入关键词，如 明天" style="flex:1;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);" /><button onclick="window.SafeBackupT._ui.runSearch()" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">搜索</button></div>' +
'<div id="t-search-results" style="margin-top:12px;"></div>';
}
var _ui = {
showTab: showTab,
filterBackups: function (q) { var needle = String(q || '').trim().toLowerCase(); var shown = 0; var rows = document.querySelectorAll('#t-safe-center .t-backup-row'); rows.forEach(function (r) { var hit = !needle || (r.textContent || '').toLowerCase().indexOf(needle) >= 0; r.style.display = hit ? '' : 'none'; if (hit) shown++; }); var empty = document.getElementById('t-backup-empty'); if (!empty) { var body = centerBody(); if (body) { empty = document.createElement('div'); empty.id = 't-backup-empty'; empty.style.cssText = 'color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;'; empty.textContent = '没有匹配的备份，换个词试试。'; body.appendChild(empty); } } if (empty) empty.style.display = (!needle || shown) ? 'none' : ''; },
filterNs: function (q) { var needle = String(q || '').trim().toLowerCase(); var shown = 0; var rows = document.querySelectorAll('#t-safe-center .t-ns-key'); rows.forEach(function (r) { var hit = !needle || (r.textContent || '').toLowerCase().indexOf(needle) >= 0; r.style.display = hit ? '' : 'none'; if (hit) shown++; }); var empty = document.getElementById('t-ns-empty'); if (!empty) { var body = centerBody(); if (body) { empty = document.createElement('div'); empty.id = 't-ns-empty'; empty.style.cssText = 'color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;'; empty.textContent = '没有匹配的 key，换个词试试。'; body.appendChild(empty); } } if (empty) empty.style.display = (!needle || shown) ? 'none' : ''; },
doArchiveNow: function () { var bk = archiveCurrent('手动归档（全部）', 'phone'); toast('已归档：' + bk.id + '，共 ' + bk.keys.length + ' 个键。'); showTab('backup');},
/* GROUP-STEP0b: 改为 async——整机备份要 await XWLDB.exportDump；调用处（onclick）不依赖返回值。 */
doExport: async function (scope) {
var diff = previewDiff(scope);
var ok = true;
try { ok = window.confirm('导出预览：\n\n' + previewText(diff) + '\n点「确定」先归档，再下载导出文件。');} catch (e) { ok = true;}
if (!ok) return;
var bk = archiveCurrent('导出前归档（' + scope + '）', scope);
var data = {};
scopeKeys(scope).forEach(function (k) { if (k === '__xwl_idb_v1' || k === '__xwl_idb_note') return; /* GROUP-STEP0b: 备份块是导出时现算的，localStorage 里的旧值不带出（与 STEP0 同口径） */ if (isExcludedKey(k)) return; /* 安全修复：非 phone 范围（guichao/charcard/单键）不走 allKeys，这里再拦一道 */ var r = rawGet(k); if (r!= null) data[k] = r;});
/* 安全修复：与设置页 js/00 doExport 同口径，导出前再过一遍 PhoneModel.sanitizeExportData（值里混进 key 字符串的整条删掉；未加载则只靠上面 isExcludedKey 兜底）。 */
try { if (window.PhoneModel && window.PhoneModel.sanitizeExportData) data = window.PhoneModel.sanitizeExportData(data, scope); } catch (e) {}
try {
/* GROUP-STEP0b: 整机备份带上 IndexedDB（XWLDB 唯一底座）；归巢导出（guichao）不含整机数据。 */
if (scope === 'phone' && window.XWLDB) {
    try {
        var _idb = await window.XWLDB.exportDump();
        if (_idb) {
            data['__xwl_idb_v1'] = _idb;
            if (_idb.excluded && _idb.excluded.length) {
                var _exNote = '本次备份排除了 IndexedDB 里的部分数据：' + _idb.excluded.map(function (e) { return (e.store === '*' ? 'IndexedDB' : e.store) + '（' + e.reason + '）'; }).join('；') + '。其余数据已正常备份。';
                data['__xwl_idb_note'] = _exNote;
                alert('备份提示：' + _exNote);
            }
        }
    } catch (e) { /* GROUP-STEP0b: IndexedDB 导出失败也不中断整机备份 */ }
}
var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json'});
var url = URL.createObjectURL(blob);
var a = document.createElement('a'); a.href = url; a.download = 'safe_backup_' + scope + '_' + Date.now() + '.json';
document.body.appendChild(a); a.click();
setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url);}, 100);
toast('已归档（' + bk.id + '）并开始下载导出文件。');
} catch (e) { toast('导出失败，但归档已保存：' + bk.id);}
showTab('backup');
},
openCharCard: function () {
archiveCurrent('角色卡导出前归档', 'charcard');
toast('已先归档角色卡相关数据，正在打开原有角色卡导出弹窗（JSON / PNG 下载仍走原流程）。');
try { if (typeof WeChatAppEngine!== 'undefined' && WeChatAppEngine.otomeCharCardOpen) WeChatAppEngine.otomeCharCardOpen();} catch (e) {}
},
doRestore: function (id) {
var ok = true;
try { ok = window.confirm('恢复前会先把当前状态归档（永远有网兜），再写入这条备份。确定恢复吗？');} catch (e) { ok = true;}
if (!ok) return;
var r = restoreBackup(id);
toast(r.ok? '已恢复，恢复前归档：' + r.netBackupId: '恢复失败：' + r.reason);
showTab('backup');
},
doUndo: function (id) { var r = undoById(id); toast(r.ok? '已撤销：' + r.label: '撤销失败：' + r.reason); showTab('backup');},
importPreview: function () {
var fileInput = document.getElementById('t-import-file');
var ta = document.getElementById('t-import-text');
var box = document.getElementById('t-import-preview');
var done = function (text) {
var parsed = parseImport(text);
_pendingImport = parsed;
if (!parsed.conversations.length) { box.innerHTML = '<div style="color:var(--st-danger, #7c2d2d);font-size:13px;">未能解析出对话（格式：' + esc(parsed.format) + '）。请确认是 ChatGPT / Claude / Markdown / JSON 导出。</div>'; return;}
box.innerHTML = '<div style="font-size:13px;margin-bottom:8px;">解析格式：' + esc(parsed.format) + '，共 ' + parsed.conversations.length + ' 个对话（已清洗系统提示词与空消息）：</div>' +
parsed.conversations.map(function (c, i) {
return '<label style="display:block;border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:var(--st-radius-lg,10px);padding:12px 16px;margin-bottom:8px;font-size:17px;"><input type="checkbox" data-t-imp="' + i + '" checked /> <b>' + esc(c.title) + '</b> <span style="color:var(--st-ink-60,rgba(30,39,72,.6));">' + c.count + ' 条 · ' + esc(c.date || '日期未知') + '</span><div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;margin-top:8px;">' + esc(c.messages.length? c.messages[0].text.slice(0, 60): '') + '</div></label>';
}).join('') +
'<button onclick="window.SafeBackupT._ui.doImportSelected()" style="border:1px solid var(--st-ink,#1e2748);background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;">导入勾选的对话（先归档当前状态）</button>';
};
if (fileInput && fileInput.files && fileInput.files[0]) {
var r = new FileReader();
r.onload = function (ev) { done(String(ev.target.result));};
r.readAsText(fileInput.files[0]);
} else if (ta && ta.value.trim()) done(ta.value);
else box.innerHTML = '<div style="color:var(--st-danger, #7c2d2d);font-size:13px;">请先粘贴内容或选择文件。</div>';
},
doImportSelected: function () {
if (!_pendingImport) { toast('请先解析预览。'); return;}
var boxes = document.querySelectorAll('#t-safe-center [data-t-imp]');
var sel = [];
boxes.forEach(function (b) { if (b.checked) sel.push(parseInt(b.getAttribute('data-t-imp'), 10));});
if (!sel.length) { toast('请至少勾选一个对话。'); return;}
var bk = archiveCurrent('旧对话导入前归档', 'phone');
var r = importConversations(_pendingImport, sel);
toast('已导入 ' + r.created.length + ' 个对话到微信（标题标【导入】），同时归档进 char:imported_chats_v1；导入前归档：' + bk.id);
showTab('import');
},
saveMemoryEdit: function (id) {
var ta = document.getElementById('t-mem-' + id);
if (!ta) return;
var mems = getMemories();
var m = null; mems.forEach(function (x) { if (String(x.id) === String(id)) m = x;});
if (!m) { toast('找不到这条记忆。'); return;}
var field = m.content!= null? 'content': (m.text!= null? 'text': 'content');
var patch = {}; patch[field] = ta.value;
var r = editMemory(id, patch);
toast(r.ok? '已保存（已记撤销记录，可撤销回原文）。': '保存失败：' + r.reason);
showTab('memory');
},
searchMem: function () {
var q = (document.getElementById('t-mem-q') || {}).value || '';
var box = document.getElementById('t-mem-hits');
if (!box) return;
if (!q.trim()) { box.innerHTML = ''; return;}
var hits = searchMemIndex(q.trim());
box.innerHTML = hits.length? hits.map(function (m) { return '<div style="font-size:13px;padding:8px 0;border-bottom:1px solid var(--st-ink-08,rgba(30,39,72,.08));">[' + esc(m._hitWhy || '') + '] ' + esc(memText(m)).slice(0, 100) + ' <span style="color:var(--st-ink-60,rgba(30,39,72,.6));">· ' + esc(memCat(m)) + ' ' + esc(String(memDate(m)).slice(0, 10)) + '</span></div>';}).join(''): '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">索引里没有「' + esc(q) + '」。</div>';
},
rebuildIndex: function () { var idx = buildMemIndex(); toast('索引已重建，共 ' + idx.count + ' 条记忆。'); showTab('memory');},
savePrefs: function () {
var v = function (id) { var el = document.getElementById(id); return el? el.value: '';};
var c = function (id) { var el = document.getElementById(id); return el?!!el.checked: false;};
setUiPrefs({ lang: v('t-p-lang'), theme: v('t-p-theme'), themeCustom: { c1: v('t-p-c1'), c2: v('t-p-c2')}, layout: v('t-p-layout'), iconStyle: v('t-p-icon'), wallpaper: v('t-p-wp'), widgetsEnabled: c('t-p-wd'), petEnabled: c('t-p-pet'), petMode: v('t-p-petmode'), petSize: v('t-p-petsize'), petSkin: v('t-p-petskin'), clockStyle: v('t-p-clock')});
try { var _buT = v('t-p-theme'); if (window.BuThemes && _buT && _buT.indexOf('bu-') === 0) window.BuThemes.apply(_buT); } catch (e) {}
toast('界面偏好已保存到 phone_ui_prefs_v1。');
showTab('prefs');
},
migrateNow: function () { var r = migrateUiPrefs(); toast('迁移完成，读过：' + (r.from.join('、') || '（无旧键）')); showTab('prefs');},
runSearch: function () {
var q = (document.getElementById('t-search-q') || {}).value || '';
var box = document.getElementById('t-search-results');
if (!box) return;
var hits = searchAllChats(q.trim());
box.innerHTML = hits.length? hits.map(function (h) {
return '<div style="border:1px solid var(--st-ink-20,rgba(30,39,72,.2));border-radius:10px;padding:12px 16px;margin-bottom:8px;cursor:pointer;" onclick="window.SafeBackupT.jumpToMessage(\'' + esc(h.sessionId).replace(/'/g, '') + '\',\'' + esc(h.msgId).replace(/'/g, '') + '\')"><div style="font-size:13px;font-weight:600;">' + esc(h.sessionName) + ' <span style="font-weight:400;color:var(--st-ink-60,rgba(30,39,72,.6));font-size:12px;">' + esc(h.date || '') + ' · ' + esc(h.source) + '</span></div><div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin-top:4px;">' + esc(h.quote) + '</div></div>';
}).join(''): '<div style="color:var(--st-ink-60,rgba(30,39,72,.6));font-size:13px;">没有找到「' + esc(q) + '」。</div>';
}
};

/* ── 启动：偏好迁移 + 会话一致性检查 + 上下文仪表轮询 ── */
try { migrateUiPrefs();} catch (e) {}
try { buildMemIndex();} catch (e) {}
setTimeout(function () { try { validateWxSessionsAtStartup();} catch (e) {}}, 800);
try { setInterval(function () { ensureCtxMeter();}, 1500);} catch (e) {}

/* GROUP-CORE: 把带缓存的 getUiPrefs/setUiPrefs 挂到 window 上——51478 的 readUiPrefs 早就这样查（此前从未挂载，走的一直是直读兜底）；B3/B4/B5 与它共用同一份缓存。 */
window.getUiPrefs = getUiPrefs; window.setUiPrefs = setUiPrefs;
window.SafeBackupT = {
BACKUP_KEY: BACKUP_KEY, UNDO_KEY: UNDO_KEY, INDEX_KEY: INDEX_KEY, PREFS_KEY: PREFS_KEY, IMPORT_KEY: IMPORT_KEY, CTX_KEY: CTX_KEY,
EXCLUDE_KEYS: EXPORT_EXCLUDE_KEYS, isExcludedKey: isExcludedKey,
listBackups: listBackups, archiveCurrent: archiveCurrent, previewDiff: previewDiff, previewText: previewText,
safeWrite: safeWrite, listUndo: listUndo, recordEditUndo: recordEditUndo, undoById: undoById, undoLast: undoLast,
restoreBackup: restoreBackup, confirmExport: confirmExport, confirmImport: confirmImport,
getMemories: getMemories, buildMemIndex: buildMemIndex, searchMemIndex: searchMemIndex,
editMemory: editMemory, getDiaries: getDiaries, editDiary: editDiary,
validateWxSessions: validateWxSessions, validateWxSessionsAtStartup: validateWxSessionsAtStartup,
  wxSessions: wxSessions, getWxStore: wxStore,
namespaceInventory: namespaceInventory, CHAR_OWNED_KEYS: CHAR_OWNED_KEYS,
getUiPrefs: getUiPrefs, setUiPrefs: setUiPrefs, migrateUiPrefs: migrateUiPrefs,
contextUsage: contextUsage, contextMeterHTML: contextMeterHTML, requestCompress: requestCompress,
searchAllChats: searchAllChats, searchImportedChats: searchImportedChats, jumpToMessage: jumpToMessage,
parseImport: parseImport, cleanMessages: cleanMessages, importConversations: importConversations,
ensureWxSearchBox: ensureWxSearchBox, renderWxSearchResults: renderWxSearchResults, ensureCtxMeter: ensureCtxMeter,
openCenter: openCenter, closeCenter: closeCenter, _ui: _ui
};
})();
