
/* ══════════ AN组 · 第三批7参考借鉴（GROUP-AN-THIRD-BATCH）══════════
只借做法、自己写代码。timelayer 与 memex 为 GPL-3.0-only：思路
可借，代码一行没抄；pet-deadline 未注明许可证：只借思路。
全部逻辑为全新自写；新增键见补丁头注释；旧键只读/复用。 */
(function () {
'use strict';
var MARK = 'GROUP-AN-THIRD-BATCH';
/* ── 键 ── */
var TL_KEY = 'phone_timeline_v1';
var SUM_KEY = 'phone_an_summaries_v1';
var FACTHIST_KEY = 'guichao_fact_history_v1';
var VERS_KEY = 'phone_an_mem_versions_v1';
var CAND_KEY = 'phone_an_candidates_v1';
var SHARED_KEY = 'phone_an_shared_v1';
var IDENT_KEY = 'char_identity_v1';
var PET_KEY = 'phone_an_pet_v1';
var SET_KEY = 'phone_an_settings_v1';
var DEMO_KEY = 'phone_an_demo_v1';
var TRASH_KEY = 'phone_an_trash_v1';
var AUDIT_KEY = 'phone_an_ctx_audit_v1';
var MEM_KEY = 'guichao.memories.v1';
var DIARY_KEY = 'guichao.diaries.v1';
var HABIT_KEY = 'phone_habits_v1';
var COINS_KEY = 'otome_coins_v1';
var WX_KEY = 'phone_wechat_store_v2';
var SETTINGS_KEY = 'phone_settings_v3';
var PROM_O_KEY = 'char_promises_v1';
var INNERLOG_KEY = 'char_inner_log_v1';
var MODEL_KEY = 'global_api_config_v1'; /* 统一配置键（设置 → API 设置）；只读探测 */
var EVENT_KEY = 'phone_event_log_v1'; /* AE 组未合入时不存在，读时兼容 */
/* ── 小工具 ── */
function ls() { try { return window.localStorage;} catch (e) { return null;}}
function read(k, fb) { try { var s = ls() && ls().getItem(k); return s? JSON.parse(s): fb;} catch (e) { return fb;}}
function write(k, v) { try { if (ls()) ls().setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function uid(p) { return (p || 'an') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);}
function p2(n) { return String(n).padStart(2, '0');}
function dstr(d) { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());}
function parseD(s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);}
function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return dstr(d);}
function mondayOf(dateStr) { var d = parseD(dateStr); var w = d.getDay(); return addDays(dateStr, -(w === 0? 6: w - 1));}
function csvCell(v) { var s = String(v == null? '': v); return /[",\n]/.test(s)? '"' + s.replace(/"/g, '""') + '"': s;}
function today() { return dstr(new Date());}

/* ════════ 1-2 · 时间线（唯一真相源，追加式永不改写）+ 分层摘要 ════════ */
function timelineLoad() { var t = read(TL_KEY, null); return Array.isArray(t)? t: [];}
function timelineAppend(kind, text, ref) {
var t = timelineLoad();
var row = { id: uid('tl'), ts: Date.now(), kind: kind || 'note', text: String(text || '').slice(0, 500), ref: ref || null};
t.push(row); write(TL_KEY, t);
/* AE 组事件流若已合入，同步追加一份（同一事件，不另起真相源） */
try { var ev = read(EVENT_KEY, null); if (Array.isArray(ev)) { ev.push({ id: row.id, ts: row.ts, kind: row.kind, text: row.text, ref: row.ref, from: 'AN-timeline'}); write(EVENT_KEY, ev);}} catch (e) {}
return row;
}
function timelineByDate(dateStr) { return timelineLoad().filter(function (r) { return dstr(new Date(r.ts)) === dateStr;});}
function daySummary(dateStr) {
var rows = timelineByDate(dateStr);
var kinds = {};
rows.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + 1;});
var diaries = read(DIARY_KEY, null);
var hasDiary = false;
try { if (diaries && typeof diaries === 'object') hasDiary =!!diaries[dateStr];} catch (e) {}
var s = { date: dateStr, generatedBy: 'template', note: '模板生成·本地规则，非模型生成', count: rows.length, kinds: kinds, hasDiary: hasDiary,
text: dateStr + ' 共 ' + rows.length + ' 条事件' + (rows.length? '（' + Object.keys(kinds).map(function (k) { return k + '×' + kinds[k];}).join('、') + '）': '，无事件记录') + (hasDiary? '；当日有日记。': '；当日无日记。')};
var all = read(SUM_KEY, { day: {}, week: {}, month: {}});
if (!all.day) all.day = {};
all.day[dateStr] = s; write(SUM_KEY, all);
return s;
}
function weekSummary(mondayStr) {
var days = [];
for (var i = 0; i < 7; i++) days.push(daySummary(addDays(mondayStr, i)));
var total = 0; days.forEach(function (d) { total += d.count;});
var s = { weekStart: mondayStr, generatedBy: 'template', note: '由 7 天日摘要压缩而成·模板生成', count: total, days: days.map(function (d) { return { date: d.date, count: d.count};}),
text: '本周（' + mondayStr + ' 起）共 ' + total + ' 条事件；' + days.map(function (d) { return d.date.slice(5) + ':' + d.count + '条';}).join('，') + '。'};
var all = read(SUM_KEY, { day: {}, week: {}, month: {}});
if (!all.week) all.week = {};
all.week[mondayStr] = s; write(SUM_KEY, all);
return s;
}
function monthSummary(yearMonth) {
/* 月汇总读 4 周周汇总：取当月第 1 天所在周起的 4 个周一 */
var first = yearMonth + '-01';
var mon = mondayOf(first);
var weeks = [];
for (var i = 0; i < 4; i++) weeks.push(weekSummary(addDays(mon, i * 7)));
var total = 0; weeks.forEach(function (w) { total += w.count;});
var s = { month: yearMonth, generatedBy: 'template', note: '由 4 周周汇总压缩而成·模板生成', count: total,
weeks: weeks.map(function (w) { return { weekStart: w.weekStart, count: w.count};}),
text: yearMonth + ' 共 ' + total + ' 条事件；四周分别为 ' + weeks.map(function (w) { return w.count + '条';}).join('、') + '。'};
var all = read(SUM_KEY, { day: {}, week: {}, month: {}});
if (!all.month) all.month = {};
all.month[yearMonth] = s; write(SUM_KEY, all);
return s;
}

/* ════════ 3-5 · 待办三态 + 逾期温柔语气 + CSV 导出 ════════ */
function habitLoad() { var d = read(HABIT_KEY, null); if (!d || typeof d!== 'object') return { habits: [], checks: {}, todos: [], quickNote: '', settings: {}}; if (!Array.isArray(d.todos)) d.todos = []; return d;}
function habitSave(d) { return write(HABIT_KEY, d);}
function todoStatus(t, refDate) {
refDate = refDate || today();
if (t.done || t.status === 'completed') return 'Completed';
var due = t.due || t.date || '';
if (due && due < refDate) return 'Overdue';
return t.status === 'overdue'? 'Overdue': 'Active';
}
function todoList() { return habitLoad().todos.map(function (t) { var c = Object.assign({}, t); c._status = todoStatus(t); return c;});}
function completeTodo(id, opts) {
var d = habitLoad(); var t = null;
d.todos.forEach(function (x) { if (x.id === id) t = x;});
if (!t) return null;
t._prevStatus = todoStatus(t);
t.done = true; t.status = 'completed'; t.completedAt = Date.now();
habitSave(d);
timelineAppend('todo', '完成待办：' + (t.text || ''), { todoId: id});
awardXP('todo', 10, '完成待办');
return { todo: t, celebrate: celebrateText('todo')};
}
function undoTodo(id) {
var d = habitLoad(); var t = null;
d.todos.forEach(function (x) { if (x.id === id) t = x;});
if (!t ||!t._prevStatus) return null;
t.done = (t._prevStatus === 'Completed');
t.status = (t._prevStatus === 'Overdue')? 'overdue': 'active';
delete t.completedAt;
var prev = t._prevStatus; delete t._prevStatus;
habitSave(d);
return { todo: t, restoredTo: prev};
}
function rescheduleTodo(id, newDue) {
var d = habitLoad(); var t = null;
d.todos.forEach(function (x) { if (x.id === id) t = x;});
if (!t) return null;
t.due = newDue; t.done = false; t.status = 'active';
habitSave(d);
return t;
}
function overdueNudge(t) {
var name = (t && t.text) || '这件事';
var lines = ['「' + name + '」过期了，没关系，慢慢来就好。', '「' + name + '」还在等你，不着急，想到的时候再做也可以。', '「' + name + '」逾期了，猫猫有点蔫蔫的……做完它就又精神啦。'];
return lines[Math.floor(Math.random() * lines.length)];
}
function petMoodForTodos(refDate) {
var list = todoList();
var overdue = list.filter(function (t) { return todoStatus(t, refDate) === 'Overdue';}).length;
var doneToday = list.filter(function (t) { return t.status === 'completed' && t.completedAt && dstr(new Date(t.completedAt)) === (refDate || today());}).length;
if (doneToday > 0) return { mood: 'celebrate', text: '今天完成了 ' + doneToday + ' 件待办，猫猫开心得转圈圈。'};
if (overdue > 0) return { mood: 'wilted', text: '有 ' + overdue + ' 件待办逾期了，猫猫有点蔫蔫的，等你一起做完它。'};
return { mood: 'calm', text: '没有逾期待办，猫猫懒洋洋地晒太阳。'};
}
function exportCSV(scope) {
scope = scope || 'all';
var lines = [];
if (scope === 'all' || scope === 'schedule') {
lines.push('类型,日期,内容,状态');
todoList().forEach(function (t) { lines.push(['待办', t.due || '', t.text || '', todoStatus(t)].map(csvCell).join(','));});
var sched = read('phone_schedule_v1', null);
if (sched && Array.isArray(sched.events)) sched.events.forEach(function (e) { lines.push(['日程', e.date || '', e.title || e.text || '', e.done? '完成': '未完成'].map(csvCell).join(','));});
else if (Array.isArray(sched)) sched.forEach(function (e) { lines.push(['日程', e.date || '', e.title || e.text || '', ''].map(csvCell).join(','));});
}
if (scope === 'all' || scope === 'habits') {
var d = habitLoad();
d.habits.forEach(function (h) { lines.push(['习惯', h.createdAt? dstr(new Date(h.createdAt)): '', (h.name || h.title || '') + '（目标：' + (h.goal || '未设') + '）', h.archived? '归档': '进行中'].map(csvCell).join(','));});
}
if (scope === 'all' || scope === 'memories') {
var mems = read(MEM_KEY, []);
if (Array.isArray(mems)) mems.forEach(function (m) { lines.push(['记忆', m.date || '', m.content || m.text || '', m.category || m.type || ''].map(csvCell).join(','));});
}
return lines.join('\n');
}
function safeCenterExtrasHTML() {
return '<div class="an-safe-extras" style="margin-top:10px;">'
+ '<div style="font-size:13px;font-weight:700;margin-bottom:6px;">AN组补充导出（T组安全中心）</div>'
+ '<button data-an-export="csv" onclick="window.GroupAN && window.GroupAN.downloadCSV()">导出 CSV（日程/习惯/归巢）</button> '
+ '<button data-an-export="md" onclick="window.GroupAN && window.GroupAN.downloadMarkdown()">导出 Markdown 合集（日记+记忆）</button> '
+ '<div style="font-size:11px;color:#8a857e;margin-top:4px;">导出无加密；API key 已排除（不在任何导出键里）。</div></div>';
}
function downloadText(filename, text, mime) {
try {
var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8'});
var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
document.body.appendChild(a); a.click();
setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove();} catch (e) {}}, 800);
return true;
} catch (e) { return false;}
}

/* ════════ 6 · 碎片自动判型成卡 ════════ */
var FRAG_RULES = [
{ type: 'task', label: '任务', re: /要做|记得|别忘|完成|待办|去做|买|约[^好]/},  /* 约好归日程，不被任务规则抢走 */
{ type: 'habit', label: '习惯', re: /每天|坚持|打卡|跑步|早起|读书|喝水|运动|练习/},
{ type: 'schedule', label: '日程', re: /明天|后天|周[一二三四五六日]|下周|\d{1,2}[:：]\d{2}|\d{1,2}点|约好|见面/},
{ type: 'progress', label: '进度', re: /完成.*%|进度|写了.*章|看到第|学到|练到/},
{ type: 'diary', label: '日记', re: /今天.*开心|今天.*难过|心情|想起|梦见|日记/},
{ type: 'memory', label: '记忆', re: /记住|喜欢|最喜欢|第一次|想起.*时候/}
];
var PLACE_WORDS = ['学校', '公司', '家里', '家', '公园', '展览', '电影院', '咖啡馆', '图书馆', '车站', '超市'];
function classifyFragment(text) {
text = String(text || '');
var hit = null;
for (var i = 0; i < FRAG_RULES.length; i++) { if (FRAG_RULES[i].re.test(text)) { hit = FRAG_RULES[i]; break;}}
if (!hit) hit = { type: 'note', label: '笔记'};
var tags = [];
var m = text.match(/#([\u4e00-\u9fa5A-Za-z0-9_]+)/g);
if (m) m.forEach(function (t) { tags.push(t.slice(1));});
var places = PLACE_WORDS.filter(function (w) { return text.indexOf(w) >= 0;});
var person = null;
try { var mems = read(MEM_KEY, []); if (Array.isArray(mems)) { for (var j = 0; j < mems.length; j++) { var c = String(mems[j].content || ''); if (c.indexOf('夏油杰') >= 0 && text.indexOf('杰') >= 0) { person = '夏油杰'; break;}}}} catch (e) {}
return { type: hit.type, label: hit.label, tags: tags, places: places, person: person, text: text};
}
function fragmentCardHTML(text) {
var f = classifyFragment(text);
return '<div class="an-frag-card" data-an-frag="' + esc(f.type) + '" style="border:1px solid #ececef;border-radius:12px;padding:10px 12px;background:#fff;">'
+ '<div style="font-size:12px;color:#8a857e;">' + esc(f.label) + '卡片' + (f.tags.length? ' · #' + f.tags.map(esc).join(' #'): '') + (f.places.length? ' · ' + f.places.map(esc).join('、'): '') + (f.person? ' · ' + esc(f.person): '') + '</div>'
+ '<div style="font-size:13px;color:#25262a;margin-top:4px;line-height:1.6;">' + esc(f.text) + '</div></div>';
}

/* ════════ 7-11 · 伴侣：评论 / 角色卡 / 身份分离 / 共同经历 / 位置粒度 ════════ */
function canSendProactive() {
try { if (window.CharInnerLife && window.CharInnerLife.canSendProactive) { var r = window.CharInnerLife.canSendProactive(new Date()); return!!r.ok;}} catch (e) {}
try { var s = read(SETTINGS_KEY, null); if (s && s.proactiveMsg === false) return false; if (!s) return false;} catch (e) { return false;}
return true;
}
function buildCharComment(mem) {
var content = String((mem && (mem.content || mem.text)) || '');
var short = content.slice(0, 18);
var lines = ['看到你记下了「' + short + '」，我也替你记住了。', '「' + short + '」……嗯，这件事我会好好放在心上。', '你刚写下的「' + short + '」，我读了两遍，喜欢。'];
return lines[Math.floor(Math.random() * lines.length)];
}
function commentOnNewMemory(mem) {
if (!canSendProactive()) return { ok: false, reason: 'throttled-or-off'};
var text = buildCharComment(mem);
var delivered = false;
try {
var store = read(WX_KEY, null);
var sessions = (store && Array.isArray(store.sessions))? store.sessions: (store && Array.isArray(store)? store: []);
var sess = sessions[0] || null;
if (sess) {
if (!Array.isArray(sess.messages)) sess.messages = [];
sess.messages.push({ id: uid('wx'), from: 'them', role: 'them', text: text, ts: Date.now(), anComment: true});
sess.preview = text; sess.unread = (sess.unread || 0) + 1;
write(WX_KEY, store);
delivered = true;
}
} catch (e) {}
timelineAppend('char_comment', 'char 评论了新记忆：' + text, { memId: mem && mem.id});
return { ok: true, text: text, delivered: delivered};
}
function defaultIdentity() { return { name: '', persona: '', worldbook: '', examples: [], version: 3, updatedAt: Date.now()};}
function identityLoad() { var d = read(IDENT_KEY, null); return (d && typeof d === 'object')? d: defaultIdentity();}
function identitySave(patch) { var d = identityLoad(); Object.keys(patch || {}).forEach(function (k) { d[k] = patch[k];}); d.updatedAt = Date.now(); write(IDENT_KEY, d); return d;}
function exportIdentityCard() {
/* 对齐 N 组角色卡导出与 P 组工作室字段：人设/世界书/示例对话 */
var id = identityLoad();
return { spec: 'character-card', version: 'v3', name: id.name || '', persona: id.persona || '', personality: id.persona || '',
worldbook: id.worldbook || '', world_book: id.worldbook || '',
exampleDialogue: id.examples || [], examples: id.examples || [],
model: null, modelConfig: null, note: '身份设定与模型配置分离：换模型不断线。模型配置在 global_api_config_v1（设置 → API 设置），不在此卡里。'};
}
function importIdentityCard(card) {
if (!card || typeof card!== 'object') return null;
var d = identityLoad();
if (card.name!== undefined) d.name = String(card.name);
if (card.persona!== undefined) d.persona = String(card.persona);
else if (card.personality!== undefined) d.persona = String(card.personality);
if (card.worldbook!== undefined) d.worldbook = String(card.worldbook);
else if (card.world_book!== undefined) d.worldbook = String(card.world_book);
var ex = card.exampleDialogue || card.examples || card.mes_example || [];
if (Array.isArray(ex)) d.examples = ex;
d.version = (card.version === 'v2' || card.version === 2)? 2: 3;
d.updatedAt = Date.now();
write(IDENT_KEY, d);
return d;
}
function sharedLoad() { var d = read(SHARED_KEY, null); return (d && typeof d === 'object')? d: { shared: [], promises: []};}
function addSharedExperience(input) {
var d = sharedLoad();
var item = { id: uid('sh'), date: (input && input.date) || today(), text: String((input && input.text) || '').slice(0, 300),
contributions: { me: (input && input.contributions && input.contributions.me) || '', char: (input && input.contributions && input.contributions.char) || ''}, ts: Date.now()};
d.shared.push(item); write(SHARED_KEY, d);
timelineAppend('shared', '共同经历：' + item.text, { sharedId: item.id});
return item;
}
function addPromise(input) {
var d = sharedLoad();
var item = { id: uid('pr'), text: String((input && input.text) || '').slice(0, 200), due: (input && input.due) || '', status: 'open', ts: Date.now()};
d.promises.push(item); write(SHARED_KEY, d);
timelineAppend('promise', '承诺：' + item.text, { promiseId: item.id});
return item;
}
function listPromises() {
/* O 组 char_promises_v1 只读复用 + 本组跟踪的承诺合并展示 */
var mine = sharedLoad().promises;
var o = read(PROM_O_KEY, null);
var oList = [];
if (Array.isArray(o)) oList = o;
else if (o && Array.isArray(o.promises)) oList = o.promises;
return { mine: mine, fromInnerLife: oList};
}
function locationPrefs() { var s = read(SET_KEY, null); return (s && typeof s === 'object')? s: { demo: false, locationGranularity: 'district'};}
function setLocationGranularity(g) {
if (['city', 'district', 'exact'].indexOf(g) < 0) return null;
var s = locationPrefs(); s.locationGranularity = g; write(SET_KEY, s); return s;
}
function formatLocation(loc) {
/* loc: {city, district, placeName, lat, lng}；粒度开关决定给到哪一层 */
var g = locationPrefs().locationGranularity || 'district';
if (!loc) return '';
if (g === 'city') return loc.city || '';
if (g === 'district') return [loc.city, loc.district].filter(Boolean).join(' · ') || loc.placeName || '';
return [loc.city, loc.district, loc.placeName].filter(Boolean).join(' · ') || '';
}
function sendLocationViaGateway() {
/* J 组 LocationGateway 只读包一层：先取位置，再按粒度裁剪后返回，不直接发 */
if (typeof LocationGateway === 'undefined' ||!navigator.geolocation) return Promise.resolve({ ok: false, reason: 'unsupported'});
return LocationGateway.getCurrent().then(function (pos) {
var known = null;
try { known = LocationGateway.nearestKnownPlace(pos.lat, pos.lng);} catch (e) {}
var loc = { city: (known && known.city) || '', district: (known && known.district) || '', placeName: (known && known.placeName) || '', lat: pos.lat, lng: pos.lng};
return { ok: true, display: formatLocation(loc), raw: loc, granularity: locationPrefs().locationGranularity};
}).catch(function (e) { return { ok: false, reason: 'denied'};});
}

/* ════════ 12-20 · 记忆：证据 / Facts Center / 召回开关 / 类型置顶月视图 / 主题 / 月报 / 洞察 / 备份 ════════ */
function memsLoad() { var m = read(MEM_KEY, []); return Array.isArray(m)? m: [];}
function memsSave(m) { return write(MEM_KEY, m);}
function findMem(id) { var m = null; memsLoad().forEach(function (x) { if (x.id === id) m = x;}); return m;}
function factKeyOf(m) { return m.factKey || m.fact_key || m.key || '';}
function addMemoryEvidence(memId, ev) {
var mems = memsLoad(); var target = null;
mems.forEach(function (m) { if (m.id === memId) target = m;});
if (!target) return null;
target.source = { chatId: ev.chatId || '', msgIds: ev.msgIds || []};
target.reason = String((ev && ev.reason) || '').slice(0, 200);
memsSave(mems);
return target;
}
function memorySourceLink(memId) {
var m = findMem(memId);
if (!m ||!m.source) return null;
return { chatId: m.source.chatId, msgIds: m.source.msgIds || [], reason: m.reason || '', jump: 'wechat://chat/' + (m.source.chatId || '') + '#' + (m.source.msgIds || []).join(',')};
}
function factHistoryLoad() { var h = read(FACTHIST_KEY, []); return Array.isArray(h)? h: [];}
function logFactHistory(entry) { var h = factHistoryLoad(); h.push(Object.assign({ id: uid('fh'), ts: Date.now(), by: 'user'}, entry)); write(FACTHIST_KEY, h); return h[h.length - 1];}
function resolveFactConflict(factKey, newValue, decision) {
/* decision: 'keep' 保留旧事实 / 'replace' 用新事实替换旧事实 */
if (decision!== 'keep' && decision!== 'replace') return { ok: false, reason: 'decision must be keep|replace'};
var mems = memsLoad();
var olds = mems.filter(function (m) { return factKeyOf(m) === factKey;});
var oldValue = olds.length? (olds[olds.length - 1].content || olds[olds.length - 1].text || ''): '';
if (decision === 'replace') {
olds.forEach(function (m) { m._anSuperseded = true; m.status = m.status || 'history';});
mems.push({ id: uid('mem'), content: newValue, text: newValue, category: '事实', date: today(), factKey: factKey, fact_key: factKey, type: 'fact', recall: 'ask', createdAt: Date.now()});
memsSave(mems);
}
var rec = logFactHistory({ factKey: factKey, action: decision, oldValue: oldValue, newValue: newValue});
return { ok: true, decision: decision, oldValue: oldValue, newValue: newValue, historyId: rec.id};
}
function setRecall(memId, mode) {
/* ask 每次确认 / auto 相关时可带 / never 永不带上；兼容 AH 审阅字段 */
if (['ask', 'auto', 'never'].indexOf(mode) < 0) return null;
var mems = memsLoad(); var t = null;
mems.forEach(function (m) { if (m.id === memId) t = m;});
if (!t) return null;
t.recall = mode; t.reviewLevel = (mode === 'never')? 'L3': (mode === 'auto'? 'L1': 'L2');
memsSave(mems);
return t;
}
function pinMemory(memId, pinned) { var mems = memsLoad(); var t = null; mems.forEach(function (m) { if (m.id === memId) t = m;}); if (!t) return null; t.pinned =!!pinned; memsSave(mems); return t;}
function archiveMemory(memId) { var mems = memsLoad(); var t = null; mems.forEach(function (m) { if (m.id === memId) t = m;}); if (!t) return null; t.archived = true; memsSave(mems); return t;}
function restoreMemory(memId) { var mems = memsLoad(); var t = null; mems.forEach(function (m) { if (m.id === memId) t = m;}); if (!t) return null; t.archived = false; memsSave(mems); return t;}
function deleteMemory(memId) {
/* 软删除：原条目移入回收站键，记忆列表里不再出现，可恢复 */
var mems = memsLoad(); var t = null;
mems = mems.filter(function (m) { if (m.id === memId) { t = m; return false;} return true;});
if (!t) return null;
var trash = read(TRASH_KEY, []);
if (!Array.isArray(trash)) trash = [];
trash.push(Object.assign({}, t, { deletedAt: Date.now()}));
write(TRASH_KEY, trash);
memsSave(mems);
return { deleted: t, trashCount: trash.length};
}
function setMemType(memId, type) {
var ok = ['笔记', '决定', '项目日志', '对话', '反思'];
if (ok.indexOf(type) < 0) return null;
var mems = memsLoad(); var t = null;
mems.forEach(function (m) { if (m.id === memId) t = m;});
if (!t) return null;
t.type = type; memsSave(mems); return t;
}
function monthlyTimelineView(yearMonth) {
var groups = {};
memsLoad().forEach(function (m) {
var d = String(m.date || (m.createdAt? dstr(new Date(m.createdAt)): '') || '');
if (d.slice(0, 7)!== yearMonth) return;
if (!groups[d]) groups[d] = [];
groups[d].push(m);
});
timelineLoad().forEach(function (r) {
var d = dstr(new Date(r.ts));
if (d.slice(0, 7)!== yearMonth) return;
if (!groups[d]) groups[d] = [];
groups[d].push({ id: r.id, content: r.text, date: d, kind: r.kind, _fromTimeline: true});
});
var days = Object.keys(groups).sort();
var pinned = memsLoad().filter(function (m) { return m.pinned;});
return { month: yearMonth, days: days.map(function (d) { return { date: d, items: groups[d]};}), pinned: pinned};
}
function monthlyThemes(yearMonth) {
/* 本地规则版：按关键词/类型统计本月高频主题；语义版只留接口（见 semanticThemesStub） */
var words = {};
var stop = ['的', '了', '是', '我', '你', '他', '她', '和', '在', '有', '就', '也', '都', '很', '吗', '啊', '吧', '呢', '这', '那'];
memsLoad().forEach(function (m) {
var d = String(m.date || (m.createdAt? dstr(new Date(m.createdAt)): '') || '');
if (d.slice(0, 7)!== yearMonth) return;
var text = String(m.content || m.text || '');
var toks = text.replace(/[，。、；：！？""''（）\s]/g, ' ').split(' ').filter(Boolean);
toks.forEach(function (tok) {
if (tok.length < 2 || stop.indexOf(tok) >= 0) return;
words[tok] = (words[tok] || 0) + 1;
});
if (m.type) words['类型:' + m.type] = (words['类型:' + m.type] || 0) + 1;
});
timelineLoad().forEach(function (r) {
var d = dstr(new Date(r.ts));
if (d.slice(0, 7)!== yearMonth) return;
words['事件:' + r.kind] = (words['事件:' + r.kind] || 0) + 1;
});
var list = Object.keys(words).map(function (k) { return { theme: k, count: words[k]};}).sort(function (a, b) { return b.count - a.count;});
return list.slice(0, 3);
}
function semanticThemesStub() {
return { available: false, reason: '本地规则版已上线；接模型后升级为语义分析（需在设置 → API 设置里配好模型），接口已留好。'};
}
function monthlyReport(yearMonth) {
var themes = monthlyThemes(yearMonth);
var view = monthlyTimelineView(yearMonth);
var total = 0; view.days.forEach(function (d) { total += d.items.length;});
var sum = read(SUM_KEY, { month: {}});
var s = (sum.month && sum.month[yearMonth])? sum.month[yearMonth]: monthSummary(yearMonth);
var lines = [];
lines.push('# ' + yearMonth + ' 月度反思');
lines.push('');
lines.push('> 本报告由本地规则生成（模板生成·非模型生成），数据只来自本机 localStorage。');
lines.push('');
lines.push('## 本月反复出现的三件事');
if (themes.length) themes.forEach(function (t, i) { lines.push((i + 1) + '. ' + t.theme + '（出现 ' + t.count + ' 次）');});
else lines.push('本月暂无足够记录，未检出反复主题。');
lines.push('');
lines.push('## 数据概览');
lines.push('- 事件与记忆共 ' + total + ' 条；' + s.text);
lines.push('- 置顶记忆 ' + view.pinned.length + ' 条。');
lines.push('');
lines.push('## 按日回顾');
view.days.forEach(function (d) { lines.push('### ' + d.date + '（' + d.items.length + ' 条）'); d.items.forEach(function (it) { lines.push('- ' + String(it.content || it.text || '').slice(0, 80));});});
lines.push('');
lines.push('## 下月想做的事');
lines.push('- （空着，等你填）');
return lines.join('\n');
}
function printViewHTML(yearMonth) {
var md = monthlyReport(yearMonth);
var body = esc(md).replace(/\n/g, '<br>');
return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(yearMonth) + ' 月度反思</title>'
+ '<style>body{font-family:system-ui,sans-serif;color:#25262a;max-width:640px;margin:24px auto;padding:0 16px;line-height:1.8;}@media print{body{margin:0;}}</style></head>'
+ '<body>' + body + '<p style="color:#8a857e;font-size:12px;">本地生成 · 可打印 · 归巢</p></body></html>';
}
function insightCards() {
var d = habitLoad();
var total = 0, done = 0;
var now = new Date();
for (var i = 0; i < 7; i++) {
var day = addDays(today(), -i);
d.habits.forEach(function (h) { if (h.archived) return; total++; if (d.checks[h.id + ':' + day]) done++;});
}
var lastWeekDone = 0, lastWeekTotal = 0;
for (var j = 7; j < 14; j++) {
var day2 = addDays(today(), -j);
d.habits.forEach(function (h) { if (h.archived) return; lastWeekTotal++; if (d.checks[h.id + ':' + day2]) lastWeekDone++;});
}
var coins = read(COINS_KEY, { balance: 0});
var tl = timelineLoad();
var thisWeekTl = tl.filter(function (r) { return r.ts >= Date.now() - 7 * 864e5;}).length;
return [
{ kind: 'ring', title: '本周习惯完成率', pct: total? Math.round(done * 100 / total): 0, detail: '本周 ' + done + '/' + total + ' 次，上周 ' + lastWeekDone + '/' + lastWeekTotal + ' 次'},
{ kind: 'bar', title: '本周事件', value: thisWeekTl, detail: '过去 7 天时间线事件 ' + thisWeekTl + ' 条'},
{ kind: 'ring', title: '金币账本', pct: Math.min(100, Math.round(((coins.balance || 0) % 100))), detail: '金币余额 ' + (coins.balance || 0) + '（otome_coins_v1）'},
{ kind: 'text', title: '要点', detail: (done >= lastWeekDone? '本周打卡不比上周少，继续保持。': '本周打卡比上周少 ' + (lastWeekDone - done) + ' 次，没关系，明天再来。')}
];
}
function exportMarkdownCollection() {
var lines = ['# 归巢 · 日记与记忆合集', '', '> 人类可读备份：由本地数据生成，无加密；API key 已排除。', ''];
var diaries = read(DIARY_KEY, null);
lines.push('## 日记');
if (diaries && typeof diaries === 'object') {
Object.keys(diaries).sort().forEach(function (date) {
var dg = diaries[date];
lines.push('### ' + date);
lines.push(String((dg && (dg.content || dg.text)) || dg || '').slice(0, 2000));
lines.push('');
});
} else lines.push('（无日记）');
lines.push('## 记忆');
memsLoad().forEach(function (m) {
lines.push('- [' + (m.date || '') + '] ' + String(m.content || m.text || '') + (m.type? '（' + m.type + '）': '') + (m.reason? ' —— 为什么记住：' + m.reason: ''));
});
lines.push('');
lines.push('## 事实操作历史');
factHistoryLoad().forEach(function (h) { lines.push('- ' + dstr(new Date(h.ts)) + ' ' + h.factKey + ' ' + h.action + '：' + String(h.oldValue || '').slice(0, 30) + ' → ' + String(h.newValue || '').slice(0, 30));});
return lines.join('\n');
}
function recordMemVersion(memId, content) {
var v = read(VERS_KEY, {});
if (!v[memId]) v[memId] = [];
v[memId].push({ ts: Date.now(), content: String(content || '').slice(0, 500), by: 'user'});
write(VERS_KEY, v);
return v[memId];
}
function exportWithHistory() {
return JSON.stringify({ exportedAt: Date.now(), format: 'AN-backup-v1', encrypted: false, apiKeyExcluded: true,
memories: memsLoad(), timeline: timelineLoad(), factHistory: factHistoryLoad(),
memVersions: read(VERS_KEY, {}), shared: sharedLoad(), identity: identityLoad()}, null, 2);
}
function importBackupCheck(jsonText) {
/* 冲突检查 + 幂等：同 id 同内容 → 跳过；同 id 不同内容 → 冲突；新 id → 新增 */
var data = null;
try { data = JSON.parse(jsonText);} catch (e) { return { ok: false, reason: 'not-json'};}
var incoming = data.memories || data.mems || [];
var existing = {};
memsLoad().forEach(function (m) { existing[m.id] = m;});
var result = { ok: true, add: [], skip: [], conflicts: []};
incoming.forEach(function (m) {
var old = existing[m.id];
if (!old) result.add.push(m.id);
else if (String(old.content || old.text || '') === String(m.content || m.text || '')) result.skip.push(m.id);
else result.conflicts.push({ id: m.id, oldContent: old.content || old.text || '', newContent: m.content || m.text || ''});
});
return result;
}
function importBackupApply(jsonText, opts) {
var check = importBackupCheck(jsonText);
if (!check.ok) return check;
opts = opts || {};
var data = JSON.parse(jsonText);
var mems = memsLoad();
var byId = {};
mems.forEach(function (m) { byId[m.id] = m;});
(data.memories || []).forEach(function (m) {
var old = byId[m.id];
if (!old) { mems.push(m); byId[m.id] = m;}
else if (opts.onConflict === 'replace' && String(old.content || '')!== String(m.content || '')) {
recordMemVersion(m.id, old.content || old.text || '');
old.content = m.content; old.text = m.text;
}
});
memsSave(mems);
return Object.assign({ applied: true}, check);
}

/* ════════ 21-26 · 习惯：统一奖励 / 乐观 UI / 进度环 / 固定结构 / 庆祝 ════════ */
var PET_STAGES = [{ xp: 0, name: '幼崽'}, { xp: 100, name: '少年'}, { xp: 300, name: '成年'}, { xp: 600, name: '大师'}, { xp: 1000, name: '传说'}];
function petLoad() { var p = read(PET_KEY, null); return (p && typeof p === 'object')? p: { xp: 0, stage: '幼崽', coinsEarned: 0};}
function petStageFor(xp) { var name = PET_STAGES[0].name; PET_STAGES.forEach(function (s) { if (xp >= s.xp) name = s.name;}); return name;}
function awardXP(source, xp, note) {
/* 习惯 XP、番茄币、徽章统一进同一账本：金币走 otome_coins_v1，成长走同一只猫 */
var coins = read(COINS_KEY, { balance: 0, earned: 0, spent: 0, syncedFocusMin: 0});
if (!coins || typeof coins!== 'object') coins = { balance: 0, earned: 0, spent: 0};
var gain = (source === 'habit')? 2: (source === 'pomodoro')? 3: 1;
coins.balance = (coins.balance || 0) + gain;
coins.earned = (coins.earned || 0) + gain;
write(COINS_KEY, coins);
var pet = petLoad();
pet.xp = (pet.xp || 0) + (xp || 0);
pet.coinsEarned = (pet.coinsEarned || 0) + gain;
pet.stage = petStageFor(pet.xp);
write(PET_KEY, pet);
timelineAppend('reward', '奖励：' + (note || source) + ' +' + (xp || 0) + ' XP、+' + gain + ' 金币（猫：' + pet.stage + '）', { source: source});
return { coins: coins, pet: pet};
}
function normalizeHabit(input) {
/* 固定结构 {title, goal, frequency}，供打卡/日程/热力图/宠物 XP 四处共用 */
return { title: String((input && (input.title || input.name)) || '').trim().slice(0, 20),
goal: String((input && input.goal) || '').trim().slice(0, 60),
frequency: (input && (input.frequency || (input.freq && input.freq.type))) || 'daily'};
}
function migrateHabits() {
/* AD 组习惯若无 goal 就补 goal:'' 并写回；已有 goal 一字不动 */
var d = habitLoad();
var changed = 0;
d.habits.forEach(function (h) {
if (h.goal === undefined) { h.goal = ''; changed++;}
if (h.title === undefined && h.name!== undefined) h.title = h.name;
if (h.frequency === undefined && h.freq) h.frequency = h.freq.type || 'daily';
});
if (changed) habitSave(d);
return { migrated: changed, total: d.habits.length};
}
function checkHabitOptimistic(habitId, dateStr, done) {
/* 乐观 UI：先返回“已变”的 UI 状态，再写 localStorage；写失败则回滚标记 */
dateStr = dateStr || today();
var uiState = { habitId: habitId, date: dateStr, checked:!!done, optimistic: true, saved: false};
var d = habitLoad();
var exists = false;
d.habits.forEach(function (h) { if (h.id === habitId) exists = true;});
if (!exists) { uiState.error = 'habit-not-found'; return uiState;}
if (done) d.checks[habitId + ':' + dateStr] = true; else delete d.checks[habitId + ':' + dateStr];
var ok = habitSave(d);
uiState.saved =!!ok;
if (ok && done) { var r = awardXP('habit', 10, '习惯打卡'); uiState.xp = r.pet.xp; uiState.stage = r.pet.stage; uiState.coins = r.coins.balance; uiState.celebrate = celebrateText('habit');}
return uiState;
}
function todayRate(dateStr) {
dateStr = dateStr || today();
var d = habitLoad();
var planned = d.habits.filter(function (h) { return!h.archived;});
var done = planned.filter(function (h) { return d.checks[h.id + ':' + dateStr];}).length;
return { total: planned.length, done: done, pct: planned.length? Math.round(done * 100 / planned.length): 0};
}
function weekRingData(refDate) {
refDate = refDate || today();
var d = habitLoad();
var mon = mondayOf(refDate);
var days = [];
for (var i = 0; i < 7; i++) {
var day = addDays(mon, i);
var planned = d.habits.filter(function (h) { return!h.archived;}).length;
var done = d.habits.filter(function (h) { return!h.archived && d.checks[h.id + ':' + day];}).length;
days.push({ date: day, done: done, total: planned, pct: planned? Math.round(done * 100 / planned): 0});
}
var totalDone = 0, totalPlanned = 0;
days.forEach(function (x) { totalDone += x.done; totalPlanned += x.total;});
return { weekStart: mon, days: days, pct: totalPlanned? Math.round(totalDone * 100 / totalPlanned): 0};
}
function habitHeaderHTML(dateStr) {
var r = todayRate(dateStr);
var w = weekRingData(dateStr);
var ring = '<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#ececef" stroke-width="5"/>'
+ '<circle cx="22" cy="22" r="18" fill="none" stroke="#34363b" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (w.pct * 1.13).toFixed(1) + ' 113" transform="rotate(-90 22 22)"/>'
+ '<text x="22" y="26" text-anchor="middle" font-size="11" fill="#25262a">' + w.pct + '%</text></svg>';
return '<div class="an-habit-head" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid #ececef;border-radius:12px;">'
+ '<span class="an-ring-wrap">' + ring + '</span>'
+ '<div style="font-size:13px;color:#25262a;line-height:1.6;">今日完成 ' + r.done + '/' + r.total + '（' + r.pct + '%）<br><span style="color:#8a857e;font-size:12px;">本周进度环 ' + w.pct + '% · 与 91 天热力图、仅计计划日 streak 互补（AD 组已合入）</span></div></div>';
}
function celebrateText(kind) {
if (kind === 'habit') return '打卡完成！猫猫长大了，+10 XP。';
if (kind === 'todo') return '待办完成！猫猫开心得转圈圈。';
if (kind === 'milestone') return '连续打卡里程碑！猫猫戴上了小徽章。';
return '完成！';
}
function celebrateHTML(kind) {
/* 轻量 CSS / 小 canvas 庆祝，不引入动画库 */
return '<div class="an-celebrate" role="status" style="text-align:center;padding:8px 0;">'
+ '<canvas class="an-confetti" width="120" height="24" data-an-celebrate="' + esc(kind || 'done') + '"></canvas>'
+ '<div style="font-size:13px;color:#25262a;">' + esc(celebrateText(kind)) + '</div></div>';
}
function drawConfetti(canvas) {
try {
var ctx = canvas.getContext('2d');
if (!ctx) return false;
var colors = ['#34363b', '#5b8c5a', '#c9a86a', '#8a7ca8', '#b08968'];
for (var i = 0; i < 24; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(Math.random() * 120, Math.random() * 24, 4, 4);}
return true;
} catch (e) { return false;}
}

/* ════════ 27-37 · 消息：typing / 气泡 / 滚动 / 输入 / 状态点 / 模型前清单 / 上下文审计 / 待审 / 演示隔离 ════════ */
function typingDotsHTML() { return '<span class="an-typing-dots" aria-label="对方正在输入"><i></i><i></i><i></i></span>';}
function bubbleHTML(text, who, ts) {
/* 气泡结构：me/them 分行、最大宽 72%、收角、每条下挂灰色时间戳；归巢深灰 accent、圆角 12px */
var time = ts? new Date(ts): new Date();
var stamp = p2(time.getHours()) + ':' + p2(time.getMinutes());
return '<div class="wx-msg-row ' + (who === 'me'? 'wx-self': '') + '"><div class="wx-bubble-wrap"><div class="wx-bubble">' + esc(text) + '</div>'
+ '<span class="an-bubble-ts">' + stamp + '</span></div></div>';
}
function enhanceBubbles(container) {
/* 给已有气泡补时间戳（每条下挂灰色时间戳），不改原有消息内容 */
if (!container ||!container.querySelectorAll) return 0;
var rows = container.querySelectorAll('.wx-msg-row');
var added = 0;
rows.forEach(function (row) {
if (row.querySelector('.an-bubble-ts')) return;
var wrap = row.querySelector('.wx-bubble-wrap');
if (!wrap) return;
var ts = document.createElement('span');
ts.className = 'an-bubble-ts';
var d = new Date();
ts.textContent = p2(d.getHours()) + ':' + p2(d.getMinutes());
wrap.appendChild(ts);
added++;
});
return added;
}
function autoScroll(container) {
if (!container) return false;
try {
container.classList.add('an-scroll-thin');
container.scrollTo({ top: container.scrollHeight, behavior: 'smooth'});
return true;
} catch (e) {
try { container.scrollTop = container.scrollHeight; return true;} catch (e2) { return false;}
}
}
function bindWxInput(input, sendBtn, onSend) {
if (!input || input._anBound) return false;
input._anBound = true;
input.addEventListener('keydown', function (e) {
if (e.key === 'Enter' &&!e.shiftKey) {
e.preventDefault();
var v = input.value.trim();
if (!v) return; /* 空内容拦截 */
if (typeof onSend === 'function') onSend(v);
input.value = '';
}
});
input.addEventListener('focus', function () { input.classList.add('an-focused');});
input.addEventListener('blur', function () { input.classList.remove('an-focused');});
if (sendBtn) {
sendBtn.addEventListener('click', function () {
var v = input.value.trim();
if (!v) return;
if (typeof onSend === 'function') onSend(v);
input.value = '';
});
}
return true;
}
function statusDotHTML(state) {
/* 顶栏在线状态圆点，复用到 O 组 ENGAGED/IDLE/DORMANT/DREAM */
var map = { ENGAGED: 'engaged', IDLE: 'idle', DORMANT: 'dormant', DREAM: 'dream', online: 'engaged', offline: 'dormant'};
var cls = map[state] || 'idle';
var label = { engaged: '在线', idle: '闲置', dormant: '休息中', dream: '梦中'}[cls] || state;
return '<span class="an-status-dot an-dot-' + cls + '" title="' + esc(label) + '"></span>' + esc(label);
}
function currentInnerState() {
try { if (window.CharInnerLife && window.CharInnerLife.currentState) return window.CharInnerLife.currentState();} catch (e) {}
try { var s = read('char_inner_state_v1', null); if (s && s.state) return s.state;} catch (e) {}
return 'IDLE';
}
function buildContextPreview(input) {
/* 固定上下文组装顺序：活跃事实 + 当日摘要 + 检索命中 + 最近 N 行原文（默认 20 行），并设上限 */
input = input || {};
var facts = [];
memsLoad().forEach(function (m) { if (factKeyOf(m) && m.recall!== 'never' &&!m.archived) facts.push(m);});
facts = facts.slice(0, 10);
var day = daySummary(today());
var hits = [];
var q = String(input.query || '');
if (q) {
memsLoad().forEach(function (m) {
var c = String(m.content || m.text || '');
if (c.indexOf(q) >= 0 && m.recall!== 'never') hits.push(m);
});
hits = hits.slice(0, 5);
}
var recentN = input.recentN || 20;
var recent = [];
try {
var store = read(WX_KEY, null);
var sessions = (store && Array.isArray(store.sessions))? store.sessions: [];
var sess = sessions[0];
if (sess && Array.isArray(sess.messages)) recent = sess.messages.slice(-recentN).map(function (m) { return String(m.text || m.content || '');});
} catch (e) {}
return { order: ['活跃事实', '当日摘要', '检索命中', '最近原文'], caps: { facts: 10, hits: 5, recent: recentN},
facts: facts.map(function (m) { return { id: m.id, factKey: factKeyOf(m), content: String(m.content || m.text || '').slice(0, 60)};}),
daySummary: day.text, hits: hits.map(function (m) { return { id: m.id, content: String(m.content || m.text || '').slice(0, 60)};}),
recent: recent, modelConfigured: (function () { try { var c = read(MODEL_KEY, null); return !!(c && c.baseUrl && c.model && c.key); } catch (e) { return false; } })(),
promise: '发模型前先展示此清单，用户确认后才调用；绝不代点发送。'};
}
function contextConfirmHTML(preview) {
var rows = '';
preview.facts.forEach(function (f) { rows += '<div style="padding:4px 0;border-top:1px dashed #ececef;font-size:12px;">事实 ' + esc(f.factKey || '') + '：' + esc(f.content) + '</div>';});
preview.hits.forEach(function (h) { rows += '<div style="padding:4px 0;border-top:1px dashed #ececef;font-size:12px;">命中记忆：' + esc(h.content) + '</div>';});
rows += '<div style="padding:4px 0;border-top:1px dashed #ececef;font-size:12px;">当日摘要：' + esc(preview.daySummary) + '</div>';
rows += '<div style="padding:4px 0;border-top:1px dashed #ececef;font-size:12px;">最近原文 ' + preview.recent.length + ' 行（上限 ' + preview.caps.recent + ' 行）</div>';
return '<div class="an-ctx-confirm" style="background:#fff;border:1px solid #ececef;border-radius:12px;padding:12px;">'
+ '<div style="font-size:14px;font-weight:700;">将带上的设定与记忆清单</div>'
+ '<div style="font-size:11px;color:#8a857e;margin:4px 0 8px;">顺序固定：活跃事实 → 当日摘要 → 检索命中 → 最近原文 · 事实≤10 · 命中≤5 · 原文≤' + preview.caps.recent + ' 行</div>'
+ rows
+ '<div style="display:flex;gap:8px;margin-top:10px;"><button data-an-ctx="confirm" style="flex:1;border:0;border-radius:12px;background:#34363b;color:#fff;padding:9px 0;">确认调用</button>'
+ '<button data-an-ctx="cancel" style="flex:1;border:1px solid #ececef;border-radius:12px;background:#fff;padding:9px 0;">取消</button></div>'
+ '<div style="font-size:11px;color:#8a857e;margin-top:6px;">绝不代点发送：只有你点了「确认调用」才会发。</div></div>';
}
function showContextConfirm(preview, onConfirm) {
var overlay = document.createElement('div');
overlay.className = 'an-ctx-overlay';
overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
overlay.innerHTML = '<div style="width:100%;max-width:430px;max-height:82vh;overflow:auto;padding:12px;">' + contextConfirmHTML(preview) + '</div>';
overlay.addEventListener('click', function (e) {
var t = e.target;
if (t && t.getAttribute && t.getAttribute('data-an-ctx') === 'confirm') { overlay.remove(); if (typeof onConfirm === 'function') onConfirm(preview);}
else if (t && t.getAttribute && t.getAttribute('data-an-ctx') === 'cancel') { overlay.remove();}
else if (t === overlay) { overlay.remove();}
});
document.body.appendChild(overlay);
return overlay;
}
function auditContext(preview, replyText) {
/* 上下文审计：本次回复注入了哪几条记忆、为什么选中；对接 O 组内心调试页 */
var audit = { id: uid('au'), ts: Date.now(), used: [], reasons: []};
(preview.facts || []).forEach(function (f) { audit.used.push({ id: f.id, kind: 'fact', content: f.content}); audit.reasons.push('活跃事实 ' + (f.factKey || '') + '：当前事实，召回开关非 never');});
(preview.hits || []).forEach(function (h) { audit.used.push({ id: h.id, kind: 'hit', content: h.content}); audit.reasons.push('检索命中：与本次输入关键词相关');});
audit.used.push({ kind: 'daySummary', content: preview.daySummary});
audit.reasons.push('当日摘要：提供今天的上下文');
audit.replyPreview = String(replyText || '').slice(0, 120);
var list = read(AUDIT_KEY, []);
if (!Array.isArray(list)) list = [];
list.push(audit);
if (list.length > 50) list = list.slice(-50);
write(AUDIT_KEY, list);
try {
var log = read(INNERLOG_KEY, []);
if (Array.isArray(log)) { log.push({ ts: audit.ts, kind: 'ctx_audit', text: '上下文审计：注入 ' + audit.used.length + ' 条（事实 ' + (preview.facts || []).length + '、命中 ' + (preview.hits || []).length + '、当日摘要 1）', auditId: audit.id}); write(INNERLOG_KEY, log);}
} catch (e) {}
return audit;
}
function mindDebugAuditHTML() {
var list = read(AUDIT_KEY, []);
if (!Array.isArray(list) ||!list.length) return '<div style="font-size:12px;color:#8a857e;">暂无上下文审计记录。发模型/模板回复后，这里会显示注入了哪几条记忆、为什么选中。</div>';
return list.slice(-5).reverse().map(function (a) {
return '<div style="border:1px solid #ececef;border-radius:12px;padding:8px 10px;margin-bottom:8px;font-size:12px;line-height:1.7;">'
+ '<div style="font-weight:700;">' + dstr(new Date(a.ts)) + ' · 注入 ' + a.used.length + ' 条</div>'
+ (a.worldbook ? '<div>本次注入世界书条目：' + (a.worldbook.count || 0) + ' 条' + ((a.worldbook.titles && a.worldbook.titles.length) ? '（' + a.worldbook.titles.map(esc).join('、') + '）' : '') + '</div>' : '')
+ a.reasons.map(function (r) { return '<div>· ' + esc(r) + '</div>';}).join('')
+ (a.replyPreview? '<div style="color:#8a857e;">回复预览：' + esc(a.replyPreview) + '</div>': '') + '</div>';
}).join('');
}
function templateReply(userText) {
var t = String(userText || '');
if (/累|辛苦|好累/.test(t)) return '辛苦啦，先歇一会儿，我在呢。';
if (/晚安|睡/.test(t)) return '晚安，明天见。猫猫已经先睡了。';
if (/喜欢|爱/.test(t)) return '嗯，我也喜欢和你待在一起。';
if (/谢谢/.test(t)) return '不用谢，应该的。';
return '嗯，我听到了。你刚说的，我记下了。';
}
function templateReplyFlow(userText, deliver) {
/* 模板模式骨架：先出 typing，再取一条回复；接模型后把随机取回复换成模型调用，失败回落到此 */
return new Promise(function (resolve) {
var typing = { shown: true, html: typingDotsHTML()};
setTimeout(function () {
var _bkWb = (typeof window.WorldBook !== 'undefined' && window.WorldBook.firstGlobal) ? window.WorldBook.firstGlobal('chat', userText) : { block: '', titles: [], count: 0 }; // GROUP-BK: 模板模式先查世界书再生成（无角色上下文，只取全局条目）
var preview = buildContextPreview({ query: userText});
var reply = templateReply(userText);
try { if (window.GroupN && window.GroupN.pillApplyLocal) reply = window.GroupN.pillApplyLocal(reply);} catch (e) {}
var audit = auditContext(preview, reply);
audit.worldbook = { count: _bkWb.count, titles: (_bkWb.titles || []).slice() };
typing.shown = false;
if (typeof deliver === 'function') { try { deliver(reply, audit);} catch (e) {}}
resolve({ reply: reply, audit: audit, mode: 'template', worldbook: { count: _bkWb.count, titles: (_bkWb.titles || []).slice() } });
}, 900);
});
}
function modelCallInterface() {
/* AG 组未合入时的接口：有配置才返回可调用，否则模板回落 */
var cfg = read(MODEL_KEY, null);
if (!cfg || !cfg.baseUrl || !cfg.model || !cfg.key) return { available: false, mode: 'template', reason: '未检测到模型配置（请到设置 → API 设置里配好地址、模型名和 key），用本地模板回复；配置后走用户自填的 OpenAI 兼容接口。'};
return { available: true, mode: 'model', reason: '已检测到模型配置；调用前仍需用户在清单上点确认。'};
}
function proposeMemoryCandidate(text, source) {
var t = String(text || '').trim();
if (!t) return null;
var list = read(CAND_KEY, []);
if (!Array.isArray(list)) list = [];
var item = { id: uid('cd'), text: t.slice(0, 300), source: source || 'chat', status: 'pending', ts: Date.now(), auto: false};
list.push(item); write(CAND_KEY, list);
timelineAppend('candidate', '待审记忆候选：' + item.text, { candidateId: item.id});
return item;
}
function rememberCommand(text) {
/* 用户说“记住……”进待审 */
var m = String(text || '').match(/^[记記]住[：:，,]?(.*)$/);
if (!m ||!m[1]) return null;
var item = proposeMemoryCandidate(m[1], 'remember-command');
return item;
}
function suggestCandidates(texts) {
/* 日常对话自动提议候选（仍需用户确认才生效） */
var out = [];
(texts || []).forEach(function (t) {
if (/我喜欢|我最喜欢|我决定|从今天起|以后每天/.test(String(t))) out.push(proposeMemoryCandidate(t, 'auto-suggest'));
});
return out;
}
function confirmCandidate(id, approve) {
var list = read(CAND_KEY, []);
if (!Array.isArray(list)) return null;
var item = null;
list.forEach(function (c) { if (c.id === id) item = c;});
if (!item) return null;
item.status = approve? 'approved': 'rejected';
write(CAND_KEY, list);
if (approve) {
var mems = memsLoad();
var mem = { id: uid('mem'), content: item.text, text: item.text, category: '日常记忆', date: today(), type: '对话', recall: 'ask', createdAt: Date.now()};
mems.push(mem); memsSave(mems);
timelineAppend('memory', '确认记忆：' + item.text, { memId: mem.id});
return { candidate: item, memory: mem};
}
return { candidate: item, memory: null};
}
function demoEnabled() { var s = locationPrefs(); return!!s.demo;}
function setDemoEnabled(on) { var s = locationPrefs(); s.demo =!!on; write(SET_KEY, s); return s.demo;}
function loadDemoData() {
/* 演示数据必须明确可选、与真实数据隔离：默认关闭；开启后只写隔离键，绝不写入真实键 */
if (!demoEnabled()) return { ok: false, reason: 'demo-off'};
var demo = { demo: true, label: '演示数据', items: [
{ id: 'demo-mem-1', content: '演示记忆：喜欢喝冰美式（演示）', category: '喜好', date: today(), _anDemo: true},
{ id: 'demo-todo-1', text: '演示待办：去看展（演示）', due: today(), _anDemo: true}
]};
write(DEMO_KEY, demo);
return { ok: true, count: demo.items.length};
}
function clearDemoData() { try { if (ls()) ls().removeItem(DEMO_KEY);} catch (e) {} return true;}

/* ── 对外出口 ── */
var AN = {
MARK: MARK,
keys: { timeline: TL_KEY, summaries: SUM_KEY, factHistory: FACTHIST_KEY, versions: VERS_KEY, candidates: CAND_KEY, shared: SHARED_KEY, identity: IDENT_KEY, pet: PET_KEY, settings: SET_KEY, demo: DEMO_KEY, trash: TRASH_KEY, audit: AUDIT_KEY},
timelineAppend: timelineAppend, timelineLoad: timelineLoad, timelineByDate: timelineByDate,
daySummary: daySummary, weekSummary: weekSummary, monthSummary: monthSummary,
todoStatus: todoStatus, todoList: todoList, completeTodo: completeTodo, undoTodo: undoTodo, rescheduleTodo: rescheduleTodo,
overdueNudge: overdueNudge, petMoodForTodos: petMoodForTodos,
exportCSV: exportCSV, safeCenterExtrasHTML: safeCenterExtrasHTML,
downloadCSV: function () { return downloadText('phone-export.csv', exportCSV('all'), 'text/csv;charset=utf-8');},
downloadMarkdown: function () { return downloadText('guichao-collection.md', exportMarkdownCollection(), 'text/markdown;charset=utf-8');},
classifyFragment: classifyFragment, fragmentCardHTML: fragmentCardHTML,
buildCharComment: buildCharComment, commentOnNewMemory: commentOnNewMemory, canSendProactive: canSendProactive,
identityLoad: identityLoad, identitySave: identitySave, exportIdentityCard: exportIdentityCard, importIdentityCard: importIdentityCard,
addSharedExperience: addSharedExperience, addPromise: addPromise, listPromises: listPromises,
setLocationGranularity: setLocationGranularity, formatLocation: formatLocation, sendLocationViaGateway: sendLocationViaGateway,
addMemoryEvidence: addMemoryEvidence, memorySourceLink: memorySourceLink,
resolveFactConflict: resolveFactConflict, factHistoryLoad: factHistoryLoad, logFactHistory: logFactHistory,
setRecall: setRecall, pinMemory: pinMemory, archiveMemory: archiveMemory, restoreMemory: restoreMemory, deleteMemory: deleteMemory,
setMemType: setMemType, monthlyTimelineView: monthlyTimelineView, monthlyThemes: monthlyThemes, semanticThemesStub: semanticThemesStub,
monthlyReport: monthlyReport, printViewHTML: printViewHTML, insightCards: insightCards,
exportMarkdownCollection: exportMarkdownCollection, recordMemVersion: recordMemVersion,
exportWithHistory: exportWithHistory, importBackupCheck: importBackupCheck, importBackupApply: importBackupApply,
awardXP: awardXP, petLoad: petLoad, petStageFor: petStageFor, normalizeHabit: normalizeHabit, migrateHabits: migrateHabits,
checkHabitOptimistic: checkHabitOptimistic, todayRate: todayRate, weekRingData: weekRingData, habitHeaderHTML: habitHeaderHTML,
celebrateText: celebrateText, celebrateHTML: celebrateHTML, drawConfetti: drawConfetti,
typingDotsHTML: typingDotsHTML, bubbleHTML: bubbleHTML, enhanceBubbles: enhanceBubbles, autoScroll: autoScroll,
bindWxInput: bindWxInput, statusDotHTML: statusDotHTML, currentInnerState: currentInnerState,
buildContextPreview: buildContextPreview, contextConfirmHTML: contextConfirmHTML, showContextConfirm: showContextConfirm,
auditContext: auditContext, mindDebugAuditHTML: mindDebugAuditHTML,
templateReply: templateReply, templateReplyFlow: templateReplyFlow, modelCallInterface: modelCallInterface,
proposeMemoryCandidate: proposeMemoryCandidate, rememberCommand: rememberCommand, suggestCandidates: suggestCandidates, confirmCandidate: confirmCandidate,
demoEnabled: demoEnabled, setDemoEnabled: setDemoEnabled, loadDemoData: loadDemoData, clearDemoData: clearDemoData,
migrateHabitsOnLoad: migrateHabits
};
window.GroupAN = AN;
try { migrateHabits();} catch (e) {}
})();
