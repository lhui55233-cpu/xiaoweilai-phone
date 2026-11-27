
/* ══════════ GROUP-AW-SIM-CHAR · 此刻模拟人生 + 微信加好友=创建人物 + 旅行青蛙式明信片 ══════════
   AnyWorld（github.com/iamarxs/AnyWorld，MIT）只借做法：目的地=场景、一轮一轮行动、
   隐藏概率只见效果不见骰子、历史可浏览可搜索可导出 JSONL；服务器/Python/FastAPI/
   WebSocket/真 AI DM 都没借，代码一行不抄。旅行青蛙式明信片：规则触发，插画是画出来的，
   不是真照片。 */
(function () {
'use strict';
if (window.AWGroup) return;
var MARK = 'GROUP-AW-SIM-CHAR';
var SIM_KEY = 'cike_sim_v1', TRAVEL_KEY = 'cike_travel_v1', MURMUR_KEY = 'cike_murmur_v1';
var PC_KEY = 'cike_postcards_v1', CHARS_KEY = 'wx_chars_v1', GC_KEY = 'guichao.memories.v1';
var DAY_KEY = 'cike_char_day_v1';
var DEFAULT_SLOTS = [
  { hour: 7, place: '家', activity: '煮咖啡' },
  { hour: 8, place: '地铁', activity: '坐地铁去公司' },
  { hour: 9, place: '公司', activity: '到公司开始工作' },
  { hour: 12, place: '面馆', activity: '在面馆吃一碗面' },
  { hour: 14, place: '街角咖啡馆', activity: '点了第二杯拿铁' },
  { hour: 17, place: '旧书店', activity: '在旧书店翻旧杂志' },
  { hour: 19, place: '家里', activity: '回到家里' },
  { hour: 21, place: '河边', activity: '去河边散步' },
  { hour: 23, place: '家', activity: '准备休息' }
];
var ROOMS = [
  { id: 'living', name: '客厅', en: 'LIVING' },
  { id: 'bed', name: '卧室', en: 'BEDROOM' },
  { id: 'kitchen', name: '厨房', en: 'KITCHEN' },
  { id: 'balcony', name: '阳台', en: 'BALCONY' }
];
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var rd = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
var wr = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
var uid = function (p) { return p + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); };
var clamp = function (n) { n = Math.round(n); return n < 0 ? 0 : (n > 100 ? 100 : n); };
var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
var fmtTime = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
var dayStr = function (ms) { var d = new Date(ms || Date.now()); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
var mainCharName = function () { try { if (typeof SystemStore !== 'undefined') { var c = SystemStore.get('character'); if (c) return c; } } catch (e) {} return '机'; };
var wxStore = function () { try { return (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) ? AppRegistry['wechat'].wxStore : null; } catch (e) { return null; } };
var persistWx = function () { var s = wxStore(); try { if (s && typeof s._persist === 'function') s._persist(); } catch (e) {} };
var renderWx = function () { try { if (window.WeChatAppEngine && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates(); } catch (e) {} };
var toast = function (m) { try { if (window.WeChatAppEngine && WeChatAppEngine.triggerToast) WeChatAppEngine.triggerToast(m); } catch (e) {} };

/* ── 日程（只读 cike_char_day_v1，K 组 9 时段；无效时回默认） ── */
function loadDay() {
  var d = rd(DAY_KEY, null);
  if (d && Array.isArray(d.slots) && d.slots.length >= 1 && d.slots.every(function (s) { return typeof s.hour === 'number' && typeof s.place === 'string' && typeof s.activity === 'string'; })) {
    var out = Object.assign({}, d);
    out.isDefault = false;
    return out;
  }
  return { city: '上海', weather: '晴', slots: DEFAULT_SLOTS.slice(), isDefault: true };
}
function slotForHour(day, hour) {
  var idx = 0;
  (day.slots || []).forEach(function (s, i) { if (hour >= s.hour) idx = i; });
  return day.slots[idx] || day.slots[0];
}
function currentActivity(nowMs) {
  var d = new Date(nowMs || Date.now());
  var day = loadDay();
  var s = slotForHour(day, d.getHours());
  var phase = (d.getHours() >= 6 && d.getHours() < 17) ? 'day' : ((d.getHours() >= 17 && d.getHours() < 19) ? 'dusk' : 'night');
  return { hour: s.hour, place: s.place, activity: s.activity, text: '在' + s.place + '，' + s.activity + '。', phase: phase, at: fmtTime(nowMs || Date.now()), isDefault: !!day.isDefault };
}

/* ── 需求（cike_sim_v1；按流逝时间衰减，按当前活动回补） ── */
function blankSim() { return { needs: { hunger: 70, energy: 75, mood: 70, social: 60 }, lastTick: Date.now(), visitedPlaces: [], seenOnce: false, lastTier: '', lastTierMin: 0, lastPetKey: '', lastRoomCount: 0, donePromiseIds: [], lastMomentDay: '' }; }
function loadSim() { var v = rd(SIM_KEY, null); var b = blankSim(); if (!v || typeof v !== 'object') return b; b.needs = Object.assign({}, b.needs, v.needs || {}); ['lastTick', 'visitedPlaces', 'seenOnce', 'lastTier', 'lastTierMin', 'lastPetKey', 'lastRoomCount', 'donePromiseIds', 'lastMomentDay', 'scriptCharId' /* [GROUP-FIX9] F9-J：白名单漏了 scriptCharId——setScriptChar 存进 cike_sim_v1 后，下次 loadSim 回拷就丢了，scriptCharId() 永远读回 'main'，人物选择器的选中态粘不住。补一词即可；此刻其他字段不受影响 */].forEach(function (k) { if (v[k] !== undefined) b[k] = v[k]; }); return b; }
function saveSim(s) { return wr(SIM_KEY, s); }
function tickNeeds(nowMs) {
  var s = loadSim(); var now = nowMs || Date.now();
  var hours = Math.max(0, Math.min(12, (now - (s.lastTick || now)) / 3600000));
  if (hours >= 0.25) {
    var n = s.needs;
    n.hunger = clamp(n.hunger - 4 * hours); n.energy = clamp(n.energy - 3 * hours);
    n.mood = clamp(n.mood - 1 * hours); n.social = clamp(n.social - 2 * hours);
    var cur = currentActivity(now); var a = cur.activity || '';
    if (/吃|面|饭|咖啡|早餐|午餐|晚餐/.test(a)) n.hunger = clamp(n.hunger + 15);
    if (/休息|睡|午睡/.test(a)) n.energy = clamp(n.energy + 20);
    if (/散步|书店|河边|公园/.test(a)) n.mood = clamp(n.mood + 5);
    if (/公司|面馆|咖啡馆|书店/.test(cur.place || '')) n.social = clamp(n.social + 3);
    s.lastTick = now; saveSim(s);
  }
  return s;
}

/* ── 好感阶段（任务书 K2 口径：0 相识 / 30 朋友 / 60 暧昧 / 85 恋人） ── */
function affectionValue() {
  try {
    var all = rd('otome_affection_v1', {});
    var rec = all && all[mainCharName()];
    if (rec && typeof rec.value === 'number') return rec.value;
    var ks = Object.keys(all || {});
    if (ks.length && all[ks[0]] && typeof all[ks[0]].value === 'number') return all[ks[0]].value;
  } catch (e) {}
  return 0;
}
function tierOf(v) { return v >= 85 ? { label: '恋人', min: 85 } : v >= 60 ? { label: '暧昧', min: 60 } : v >= 30 ? { label: '朋友', min: 30 } : { label: '相识', min: 0 }; }
function readDrives() { return rd('char_drives_v1', null); }
function readGoals() {
  try { if (window.CharInnerLife && window.CharInnerLife.getGoals) return window.CharInnerLife.getGoals() || []; } catch (e) {}
  var v = rd('char_goals_v1', []); if (Array.isArray(v)) return v; if (v && Array.isArray(v.goals)) return v.goals; return [];
}
function readPromises() {
  try { if (window.CharInnerLife && window.CharInnerLife.getPromises) return window.CharInnerLife.getPromises() || []; } catch (e) {}
  var v = rd('char_promises_v1', []); if (Array.isArray(v)) return v; if (v && Array.isArray(v.promises)) return v.promises; return [];
}
function readInnerLog() {
  try { if (window.CharInnerLife && window.CharInnerLife.getLog) return window.CharInnerLife.getLog() || []; } catch (e) {}
  var v = rd('char_inner_log_v1', []); return Array.isArray(v) ? v : [];
}
function goalText(g) { if (!g) return ''; return g.text || g.title || g.goal || String(g); }
function promiseText(p) { if (!p) return ''; return p.text || p.title || p.promise || String(p); }
function promiseDone(p) { return !!(p && (p.done === true || p.status === 'done' || p.completed === true)); }

/* ── 碎碎念（cike_murmur_v1，接内心日志只读） ── */
function listMurmur() { var v = rd(MURMUR_KEY, []); return Array.isArray(v) ? v : []; }
function addMurmur(text, source) {
  if (!text || !String(text).trim()) return null;
  var list = listMurmur();
  var e = { id: uid('mu'), ts: Date.now(), text: String(text).trim(), source: source || 'sim' };
  list.unshift(e); wr(MURMUR_KEY, list.slice(0, 100)); return e;
}
function murmurNow() {
  var list = listMurmur(); if (list.length) return list[0];
  var log = readInnerLog();
  for (var i = log.length - 1; i >= 0; i--) { var t = log[i] && (log[i].text || log[i].msg || log[i].content); if (t) return { id: 'inner_' + i, ts: log[i].ts || log[i].time || Date.now(), text: String(t), source: 'inner' }; }
  return null;
}
function genMurmur(nowMs) {
  var cur = currentActivity(nowMs);
  var mood = loadSim().needs.mood;
  var picks = [
    '刚才在' + cur.place + '，' + cur.activity + '，忽然想起你。',
    '在' + cur.place + '发了会儿呆——' + (mood >= 70 ? '今天心情还不错。' : '有点累，想靠一会儿。'),
    cur.activity + '……嗯，就是这样，平平常常的一天。'
  ];
  var t = picks[Math.floor(Math.random() * picks.length)];
  addMurmur(t, 'template'); return t;
}

/* ── 查手机此刻状态（模板推测，诚实标注，不是真截屏） ── */
function phoneNow(nowMs) {
  var cur = currentActivity(nowMs); var h = new Date(nowMs || Date.now()).getHours();
  var s = (cur.place || '') + ' ' + (cur.activity || '');
  if (/公司|工作/.test(s)) return '正在回工作微信';
  if (/咖啡|书店/.test(s)) return '在听歌 · 刚拍了一张街景';
  if (/面馆|吃/.test(s)) return '在看外卖，犹豫吃什么';
  if (/河边|散步/.test(s)) return '在听歌散步，手机在口袋里';
  if (/家|家里/.test(s)) return h >= 23 ? '手机充着电，屏幕暗着' : '在刷备忘录，记了两行字';
  return '在看手机 · ' + cur.activity;
}

/* ── 旅行（AnyWorld 做法：场景 + 轮次 + 隐藏概率 + 历史导出；服务器没借） ── */
function loadTravel() { var v = rd(TRAVEL_KEY, null); if (v && Array.isArray(v.trips)) return v; return { trips: [], activeId: null }; }
function saveTravel(t) { return wr(TRAVEL_KEY, t); }
function listTravel() { return loadTravel().trips; }
function findTrip(id) { var ts = listTravel(); for (var i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i]; return null; }
function parseEvents(text) {
  var out = [];
  String(text || '').split('\n').forEach(function (line, i) {
    line = line.trim(); if (!line) return;
    var parts = line.split('|'); var chance = parseFloat(parts[1]);
    out.push({ id: 'ev_' + i, text: parts[0].trim(), chance: (isNaN(chance) ? 0.2 : Math.max(0, Math.min(1, chance))) });
  });
  return out;
}
function createTrip(data) {
  data = data || {};
  var name = String(data.name || '').trim();
  if (!name) throw new Error('目的地名必填');
  var t = { id: uid('tr'), name: name, setting: String(data.setting || '').trim(), goal: String(data.goal || '').trim(), events: Array.isArray(data.events) ? data.events : parseEvents(data.eventsText || ''), rounds: [], status: 'active', createdAt: Date.now(), endedAt: null, savedMemoryId: null };
  var all = loadTravel(); all.trips.unshift(t); all.activeId = t.id; saveTravel(all); return t;
}
function listDestinations() {
  var out = [];
  loadDay().slots.forEach(function (s) { if (s.place && out.indexOf(s.place) === -1) out.push(s.place); });
  listTravel().forEach(function (t) { if (t.name && out.indexOf(t.name) === -1) out.push(t.name); });
  return out;
}
function doRound(tripId, action, rng) {
  var all = loadTravel(); var tr = null;
  all.trips.forEach(function (x) { if (x.id === tripId) tr = x; });
  if (!tr) throw new Error('找不到这次旅行');
  if (tr.status !== 'active') throw new Error('这次旅行已结束');
  var act = String(action || '').trim(); if (!act) throw new Error('先写一句行动');
  var r = (typeof rng === 'function') ? rng : Math.random;
  var n = tr.rounds.length + 1;
  var ev = null;
  (tr.events || []).forEach(function (e) { if (!ev && r() < e.chance) ev = e; });
  var narrative = '第' + n + '轮 · ' + act + '。';
  if (tr.setting) narrative += '（' + tr.setting + '）';
  if (ev) narrative += '忽然，' + ev.text + '。';
  else if (tr.goal) narrative += '离「' + tr.goal + '」又近了一步。';
  var round = { n: n, action: act, narrative: narrative, event: ev ? { id: ev.id, text: ev.text } : null, ts: Date.now() };
  tr.rounds.push(round); saveTravel(all);
  if (/到|到达|抵达|走进|进入/.test(act)) sendPostcard({ place: tr.name, event: '到达' + tr.name, discovery: tr.goal ? ('此行目标：' + tr.goal) : (tr.setting || '第一次到这里'), caption: '', source: 'travel', ref: { type: 'travel', id: tr.id } });
  return round;
}
function saveTripMemory(tr) {
  var lines = (tr.rounds || []).map(function (r) { return '第' + r.n + '轮 · ' + r.action + ' —— ' + r.narrative; });
  var content = '旅行 · ' + tr.name + '\n设定：' + (tr.setting || '—') + '\n目标：' + (tr.goal || '—') + '\n' + lines.join('\n');
  var mem = { id: uid('mem'), title: '旅行 · ' + tr.name, category: 'relationship', content: content, created: Date.now(), updated: Date.now() };
  var gc = rd(GC_KEY, []); if (!Array.isArray(gc)) gc = []; gc.push(mem); wr(GC_KEY, gc);
  tr.savedMemoryId = mem.id; return mem;
}
function endTrip(tripId, opts) {
  opts = opts || {};
  var all = loadTravel(); var idx = -1; var tr = null;
  all.trips.forEach(function (x, i) { if (x.id === tripId) { tr = x; idx = i; } });
  if (!tr) throw new Error('找不到这次旅行');
  if (opts.saveMemory) {
    var mem = saveTripMemory(tr);
    tr.status = 'ended'; tr.endedAt = Date.now(); saveTravel(all);
    return { trip: tr, memory: mem, discarded: false };
  }
  all.trips.splice(idx, 1); if (all.activeId === tripId) all.activeId = all.trips.length ? all.trips[0].id : null;
  saveTravel(all);
  return { trip: null, memory: null, discarded: true };
}
function searchTravel(q) {
  q = String(q || '').trim(); var out = [];
  listTravel().forEach(function (t) {
    if (!q) { out.push(t); return; }
    var hay = (t.name + ' ' + t.setting + ' ' + t.goal + ' ' + (t.rounds || []).map(function (r) { return r.action + ' ' + r.narrative; }).join(' '));
    if (hay.indexOf(q) !== -1) out.push(t);
  });
  return out;
}
function exportTravelJSONL() {
  var lines = [];
  listTravel().forEach(function (t) {
    lines.push(JSON.stringify({ type: 'trip', id: t.id, name: t.name, setting: t.setting, goal: t.goal, status: t.status, createdAt: t.createdAt, savedMemoryId: t.savedMemoryId || null }));
    (t.rounds || []).forEach(function (r) { lines.push(JSON.stringify({ type: 'round', tripId: t.id, n: r.n, action: r.action, narrative: r.narrative, event: r.event ? r.event.text : null, ts: r.ts })); });
  });
  return lines.join('\n');
}

/* ── 写信过程（模板生成的“过程记录”，不是真实录像） ── */
var LETTER_JOURNEY_NOTE = '根据信件内容整理的写信过程，不是真实录像。';
function buildLetterJourney(text) {
  var t = String(text || '');
  var sents = t.split(/(?<=[。！？\n])/).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
  var first = sents.slice(0, 2).join('');
  var crossed = sents.length ? sents[sents.length - 1] : '今天过得很好。';
  return {
    note: LETTER_JOURNEY_NOTE,
    versions: [
      { v: 1, label: '第一稿', text: first || '（信很短，第一稿就是全文。）', note: '先写了开头，觉得太生硬。' },
      { v: 2, label: '定稿', text: t, note: '改了两处措辞，读了三遍才折好。' }
    ],
    crossedOut: ['「' + crossed + '」—— 划掉，改成更老实的一句。'],
    hesitations: ['这句要不要写……', '写到一半停下来，想了想你今天的样子。', '落笔前犹豫了很久，最后还是写下来了。'],
    monologue: [
      { at: '开始写', text: '先写了称呼，顿了顿。' },
      { at: '写到一半', text: '有一句写了又划掉，怕你觉得太黏。' },
      { at: '折好信', text: '读了一遍，觉得可以了，才放进信封。' }
    ]
  };
}

/* ── 房子（只读 otome_home_v1；操作仍在乙游 3D 家） ── */
function getHome() {
  try { if (window.OtomeF && OtomeF.loadHome) return OtomeF.loadHome(); } catch (e) {}
  var v = rd('otome_home_v1', null);
  return (v && typeof v === 'object') ? v : { pet: null, visitedRooms: [], lastRoom: 'living' };
}
function roomNow(nowMs) {
  var cur = currentActivity(nowMs);
  if (/家|家里/.test(cur.place || '')) { var h = new Date(nowMs || Date.now()).getHours(); return (h >= 22 || h < 7) ? 'bed' : 'living'; }
  return null;
}
function roomName(id) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i].name; return id; }

/* ── 明信片（旅行青蛙式；规则触发；插画是画出来的 SVG，不是真照片） ── */
var PC_SOURCES = { travel: '旅行到达', first: '第一次', milestone: '里程碑', moment: '瞬间', festival: '节日/季节' };
function listPostcards() { var v = rd(PC_KEY, []); return Array.isArray(v) ? v : []; }
function sceneKeyFor(place, activity) {
  var s = String(place || '') + ' ' + String(activity || '');
  if (/咖啡/.test(s)) return 'cafe';
  if (/河/.test(s)) return 'river';
  if (/书店|书/.test(s)) return 'bookstore';
  if (/家|家里/.test(s)) return 'home';
  if (/地铁|车站|站|机场/.test(s)) return 'station';
  if (/公园|花/.test(s)) return 'park';
  if (/海|沙滩/.test(s)) return 'beach';
  return 'street';
}
function postcardSVG(scene, phase) {
  var sky = phase === 'night' ? '#2b3245,#1a1e2e' : (phase === 'dusk' ? '#f2a65a,#e07856' : '#a8d0f0,#f7e8c8');
  var sun = phase === 'night' ? '<circle cx="150" cy="26" r="12" fill="#f4ead0"/><circle cx="128" cy="18" r="2" fill="#fff"/><circle cx="168" cy="14" r="1.6" fill="#fff"/>' : '<circle cx="150" cy="26" r="13" fill="#ffd76e"/>';
  var ground = { cafe: '#e8d5b5', river: '#9cc8e8', bookstore: '#d9c3a5', home: '#f0e2c8', station: '#cfd6dd', park: '#b8d8a0', beach: '#f2dd9e', street: '#e3d3b8' }[scene] || '#e3d3b8';
  var mid = {
    cafe: '<rect x="52" y="52" width="76" height="42" rx="4" fill="#b08954"/><rect x="62" y="62" width="18" height="18" fill="#ffe9b0"/><rect x="92" y="62" width="18" height="18" fill="#ffe9b0"/><path d="M52 52 L90 34 L128 52 Z" fill="#8a5a2e"/><circle cx="90" cy="46" r="4" fill="#fff"/>',
    river: '<path d="M0 78 Q45 66 90 78 T180 78 L180 110 L0 110 Z" fill="#7fb8dd"/><path d="M20 84 q10 -6 20 0 t20 0" stroke="#fff" stroke-width="2" fill="none"/><circle cx="140" cy="60" r="10" fill="#5b8def"/>',
    bookstore: '<rect x="48" y="44" width="84" height="52" rx="4" fill="#a5714f"/><rect x="58" y="54" width="10" height="30" fill="#e8b4b8"/><rect x="72" y="54" width="10" height="30" fill="#7a9cc6"/><rect x="86" y="54" width="10" height="30" fill="#e8d27a"/><rect x="100" y="54" width="10" height="30" fill="#8ab08a"/>',
    home: '<rect x="55" y="52" width="70" height="44" rx="4" fill="#e8b4b8"/><path d="M48 56 L90 32 L132 56 Z" fill="#b5541e"/><rect x="82" y="70" width="16" height="26" fill="#7a4a28"/><circle cx="66" cy="66" r="5" fill="#ffe9b0"/>',
    station: '<rect x="40" y="58" width="100" height="14" fill="#8a857e"/><rect x="52" y="30" width="76" height="28" rx="6" fill="#5b8def"/><circle cx="66" cy="66" r="6" fill="#3a3a3a"/><circle cx="114" cy="66" r="6" fill="#3a3a3a"/>',
    park: '<circle cx="55" cy="58" r="16" fill="#6a9a5a"/><circle cx="125" cy="58" r="16" fill="#6a9a5a"/><rect x="52" y="70" width="6" height="24" fill="#7a5a2e"/><rect x="122" y="70" width="6" height="24" fill="#7a5a2e"/><circle cx="90" cy="82" r="6" fill="#e8b4b8"/>',
    beach: '<path d="M0 88 Q90 74 180 88 L180 110 L0 110 Z" fill="#7fb8dd"/><circle cx="90" cy="86" r="12" fill="#f2dd9e"/><path d="M70 60 l8 -14 4 14 Z" fill="#e07856"/>',
    street: '<rect x="40" y="48" width="34" height="48" fill="#c9a86a"/><rect x="86" y="40" width="40" height="56" fill="#b08954"/><rect x="132" y="54" width="26" height="42" fill="#8a7bb8"/><circle cx="90" cy="88" r="5" fill="#3a3a3a"/>'
  }[scene] || '';
  return '<svg viewBox="0 0 180 110" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block"><defs><linearGradient id="awsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky.split(',')[0] + '"/><stop offset="1" stop-color="' + sky.split(',')[1] + '"/></linearGradient></defs><rect width="180" height="110" fill="url(#awsky)"/>' + sun + '<rect y="94" width="180" height="16" fill="' + ground + '"/>' + mid + '<circle cx="30" cy="102" r="5" fill="#ffe3c4"/><circle cx="30" cy="94" r="7" fill="#ffe3c4"/><path d="M24 94 Q30 84 36 94" fill="#3a2a1e"/></svg>';
}
function templateCaption(pc) {
  if (pc.source === 'travel') return '到' + pc.place + '啦，' + pc.event + '——' + pc.discovery + '。';
  if (pc.source === 'first') return '第一次来' + pc.place + '，' + pc.discovery + '。';
  if (pc.source === 'milestone') return '今天值得记一笔：' + pc.event + '。';
  if (pc.source === 'festival') return pc.place + '的' + pc.event + '，' + pc.discovery + '。';
  return pc.place + '，' + pc.event + '——' + pc.discovery + '。';
}
function sendPostcard(data, opts) {
  data = data || {}; opts = opts || {};
  var place = String(data.place || '').trim(), event = String(data.event || '').trim(), discovery = String(data.discovery || '').trim();
  if (!place || !event || !discovery) return null;
  var now = data.ts || Date.now();
  var pc = { id: uid('pc'), ts: now, time: fmtTime(now), place: place, event: event, discovery: discovery, caption: String(data.caption || '').trim(), source: data.source || 'moment', scene: data.scene || sceneKeyFor(place, event), ref: data.ref || null, savedMemoryId: null };
  if (!pc.caption) pc.caption = templateCaption(pc);
  var list = listPostcards(); list.unshift(pc); wr(PC_KEY, list.slice(0, 200));
  if (!opts.quiet) {
    try { deliverPostcardToWeChat(pc); } catch (e) {}
    try { notifyPostcard(pc); } catch (e) {}
  }
  return pc;
}
function deliverPostcardToWeChat(pc) {
  var store = wxStore(); if (!store) return false;
  var name = mainCharName();
  var sess = null;
  (store.sessions || []).forEach(function (s) { if (!sess && s.name === name && !s.isGroup) sess = s; });
  if (!sess) {
    sess = { id: 'chat_' + Date.now(), name: name, avatar: '', isGroup: false, isPinned: false, unread: 0, heartsVoice: '', emotionState: '平静', chatBg: '', lastTime: '刚刚', preview: '', memory: [], events: [], messages: [] };
    store.sessions.push(sess);
  }
  sess.messages.push({ id: 'm_pc_' + pc.id, sender: name, type: 'text', content: '明信片 · ' + pc.place + '\n' + pc.caption + '\n' + pc.time + ' · ' + pc.event + ' · 新见闻：' + pc.discovery + '\n（插画，非照片）', time: '刚刚', _awPostcardId: pc.id });
  sess.preview = '明信片 · ' + pc.place; sess.lastTime = '刚刚';
  persistWx(); renderWx(); return true;
}
function notifyPostcard(pc) {
  if (window.GroupAS && typeof window.GroupAS.notifyExternal === 'function') {
    return window.GroupAS.notifyExternal({ kind: 'char', app: 'cike', appName: '此刻', sender: mainCharName(), title: mainCharName() + ' 寄来一张明信片', body: pc.place + ' · ' + pc.event, targetApp: 'cike', refId: pc.id });
  }
  return null;
}
function checkMilestones(nowMs) {
  var s = loadSim(); var sent = []; var now = nowMs || Date.now();
  var tier = tierOf(affectionValue());
  if (s.lastTier && tier.min > s.lastTierMin) {
    var p1 = sendPostcard({ place: currentActivity(now).place, event: '好感度到了「' + tier.label + '」', discovery: '和你的关系到了新阶段', source: 'milestone', ref: { type: 'scene', id: 'affection' } });
    if (p1) sent.push(p1);
  }
  s.lastTier = tier.label; s.lastTierMin = tier.min;
  var cur = currentActivity(now);
  var place = cur.place === '家里' ? '家' : cur.place;
  if (place) {
    if (!s.seenOnce) { s.seenOnce = true; if (s.visitedPlaces.indexOf(place) === -1) s.visitedPlaces.push(place); }
    else if (s.visitedPlaces.indexOf(place) === -1) {
      s.visitedPlaces.push(place);
      var p2 = sendPostcard({ place: place, event: '第一次来' + place, discovery: cur.activity, source: 'first', ref: { type: 'scene', id: place } });
      if (p2) sent.push(p2);
    }
  }
  var home = getHome(); var petKey = home.pet ? (home.pet.kind + ':' + (home.pet.name || '')) : '';
  if (petKey && s.lastPetKey && petKey !== s.lastPetKey) {
    var p3 = sendPostcard({ place: '家', event: '新宠物 ' + (home.pet.name || home.pet.kind) + ' 来了', discovery: '家里多了新成员', source: 'milestone', ref: { type: 'scene', id: 'home' } });
    if (p3) sent.push(p3);
  }
  if (petKey) s.lastPetKey = petKey;
  var rc = (home.visitedRooms || []).length;
  if (rc > s.lastRoomCount) {
    if (s.lastRoomCount > 0) {
      var p4 = sendPostcard({ place: '家', event: '家里多了新房间/新家具', discovery: '一共 ' + rc + ' 间房有了足迹', source: 'milestone', ref: { type: 'scene', id: 'home' } });
      if (p4) sent.push(p4);
    }
    s.lastRoomCount = rc;
  }
  readPromises().forEach(function (pr) {
    if (promiseDone(pr) && pr.id && (s.donePromiseIds || []).indexOf(pr.id) === -1) {
      s.donePromiseIds.push(pr.id);
      var p5 = sendPostcard({ place: currentActivity(now).place, event: '兑现了承诺：' + promiseText(pr).slice(0, 20), discovery: '说到做到', source: 'milestone', ref: { type: 'scene', id: 'promise' } });
      if (p5) sent.push(p5);
    }
  });
  saveSim(s); return sent;
}
function maybeMomentPostcard(nowMs) {
  var s = loadSim(); var today = dayStr(nowMs || Date.now());
  if (s.lastMomentDay === today) return null;
  var cur = currentActivity(nowMs); var h = new Date(nowMs || Date.now()).getHours();
  var moment = null;
  if (cur.place === '河边' && h >= 17) moment = { event: '河边晚霞很好看', discovery: '晚霞把河面染成了金色' };
  else if (cur.place === '旧书店') moment = { event: '在旧书店翻到一本旧杂志', discovery: '杂志里夹着一张旧书签' };
  else if (h === 7 && cur.place === '家') moment = { event: '清晨煮咖啡，香气满屋', discovery: '今天的咖啡拉花成功了' };
  if (!moment) return null;
  s.lastMomentDay = today; saveSim(s);
  return sendPostcard({ place: cur.place, event: moment.event, discovery: moment.discovery, source: 'moment', ref: { type: 'scene', id: cur.place } });
}
function maybeFestivalPostcard(nowMs) {
  var d = new Date(nowMs || Date.now()); var md = (d.getMonth() + 1) + '-' + d.getDate();
  var fest = { '1-1': '新年', '2-14': '情人节', '5-20': '520', '11-26': '感恩节' }[md];
  if (!fest) return null;
  var s = loadSim(); var key = 'fest_' + md + '_' + d.getFullYear();
  if ((s.donePromiseIds || []).indexOf(key) !== -1) return null;
  s.donePromiseIds.push(key); saveSim(s);
  return sendPostcard({ place: currentActivity(nowMs).place, event: fest + '快乐', discovery: '今天是' + fest, source: 'festival', ref: { type: 'scene', id: 'festival' } });
}
function savePostcardMemory(pcId) {
  var list = listPostcards(); var pc = null;
  list.forEach(function (x) { if (x.id === pcId) pc = x; });
  if (!pc) return null;
  if (pc.savedMemoryId) return { already: true, id: pc.savedMemoryId };
  var mem = { id: uid('mem'), title: '明信片 · ' + pc.place + ' · ' + pc.event, category: (pc.source === 'travel' || pc.source === 'milestone') ? 'relationship' : 'daily', content: pc.time + ' · ' + pc.place + '\n事件：' + pc.event + '\n新见闻：' + pc.discovery + '\n' + pc.caption + '\n（明信片插画，非照片）', created: Date.now(), updated: Date.now() };
  var gc = rd(GC_KEY, []); if (!Array.isArray(gc)) gc = []; gc.push(mem); wr(GC_KEY, gc);
  pc.savedMemoryId = mem.id; wr(PC_KEY, list); return mem;
}
function postcardsForDate(dateStr) { return listPostcards().filter(function (p) { return String(p.time || '').indexOf(dateStr) === 0; }); }
function postcardsByPlace(place) { return listPostcards().filter(function (p) { return p.place === place; }); }
function postcardPlaces() { var out = []; listPostcards().forEach(function (p) { if (p.place && out.indexOf(p.place) === -1) out.push(p.place); }); return out; }

/* ── 微信加好友 = 创建人物（wx_chars_v1；主 char 不在这里创建） ── */
var _ccAvatar = '', _ccAvatarSvg = '';
function listChars() { var v = rd(CHARS_KEY, []); return Array.isArray(v) ? v : []; }
function findChar(id) { var cs = listChars(); for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
function mainCharConflict(name) { return String(name || '').trim() === mainCharName(); }
function parseExamples(text) {
  var out = [];
  String(text || '').split('\n').forEach(function (line) {
    line = line.trim(); if (!line) return;
    var m = line.match(/^(?:问|Q|q)[：:]\s*(.+?)\s*(?:答|A|a)[：:]\s*(.+)$/);
    if (m) out.push({ q: m[1].trim(), a: m[2].trim() });
  });
  return out.slice(0, 8);
}
function createChar(data) {
  data = data || {};
  var name = String(data.name || '').trim();
  if (!name) throw new Error('名字必填');
  var ch = {
    id: uid('ch'), name: name, nickname: String(data.nickname || '').trim(), gender: String(data.gender || '').trim(),
    age: String(data.age || '').trim(), occupation: String(data.occupation || '').trim(),
    relationship: String(data.relationship || '').trim(), birthday: String(data.birthday || '').trim(),
    notes: String(data.notes || '').trim(), traits: String(data.traits || '').trim(),
    background: String(data.background || '').trim(), speechStyle: String(data.speechStyle || '').trim(),
    likes: String(data.likes || '').trim(), dislikes: String(data.dislikes || '').trim(),
    habits: String(data.habits || '').trim(), rules: String(data.rules || '').trim(),
    greeting: String(data.greeting || '').trim(), examples: Array.isArray(data.examples) ? data.examples : parseExamples(data.examplesText || ''),
    avatar: String(data.avatar || '').trim(), avatarSvg: String(data.avatarSvg || '').trim(),
    source: 'created', status: 'active', enabled: true, createdAt: Date.now(), sessionId: ''
  };
  var cs = listChars(); cs.unshift(ch); wr(CHARS_KEY, cs);
  registerCharInWeChat(ch); return ch;
}
function registerCharInWeChat(ch) {
  var store = wxStore(); if (!store) return false;
  var sess = null;
  (store.sessions || []).forEach(function (s) { if (s.name === ch.name && !s.isGroup) sess = s; });
  if (!sess) {
    sess = { id: 'chat_' + Date.now() + '_' + ch.id, name: ch.name, avatar: ch.avatar || '', isGroup: false, isPinned: false, unread: 0, heartsVoice: '好感度 0% | 潜台词：刚认识，还不了解。', emotionState: '平静', chatBg: '', wxid: 'wxid_' + ch.name.toLowerCase().replace(/\s/g, ''), region: '中国', lastTime: '刚刚', preview: ch.greeting || '我们已经是好友了，开始聊天吧', memory: [], events: [], messages: [{ id: 'init', sender: ch.name, type: 'text', content: ch.greeting || '你好，我们已经是好友了。', time: '刚刚' }] };
    store.sessions.push(sess);
  }
  ch.sessionId = sess.id;
  var cs = listChars(); cs.forEach(function (x) { if (x.id === ch.id) x.sessionId = sess.id; }); wr(CHARS_KEY, cs);
  try {
    if (!store.wordBank) store.wordBank = {};
    if (!store.wordBank.agents) store.wordBank.agents = {};
    store.wordBank.agents[ch.name] = { characterCore: { name: ch.name, persona: ch.traits, traits: ch.traits, background: ch.background, speechStyle: ch.speechStyle, likes: ch.likes, dislikes: ch.dislikes, habits: ch.habits, rules: ch.rules, greeting: ch.greeting, examples: ch.examples, occupation: ch.occupation, relationship: ch.relationship } };
    if (ch.examples && ch.examples.length) {
      if (!store.offlineLibraries) store.offlineLibraries = {};
      store.offlineLibraries[ch.name] = ch.examples.map(function (ex) { return { trigger: [ex.q], reply: ex.a }; });
    }
  } catch (e) {}
  persistWx(); renderWx(); return true;
}
function updateChar(id, patch) {
  var cs = listChars(); var ch = null;
  cs.forEach(function (x) { if (x.id === id) ch = x; });
  if (!ch) throw new Error('找不到这个人物');
  Object.keys(patch || {}).forEach(function (k) { if (k !== 'id' && k !== 'createdAt' && patch[k] !== undefined) ch[k] = patch[k]; });
  if (typeof patch.examplesText === 'string') ch.examples = parseExamples(patch.examplesText);
  wr(CHARS_KEY, cs); registerCharInWeChat(ch); return ch;
}
function deleteChar(id) {
  var cs = listChars(); var ch = null;
  cs = cs.filter(function (x) { if (x.id === id) { ch = x; return false; } return true; });
  if (!ch) return false;
  wr(CHARS_KEY, cs);
  var store = wxStore();
  if (store) {
    store.sessions = (store.sessions || []).filter(function (s) { return !(s.id === ch.sessionId || (s.name === ch.name && !s.isGroup && ch.source === 'created')); });
    try { if (store.wordBank && store.wordBank.agents) delete store.wordBank.agents[ch.name]; } catch (e) {}
    try { if (store.offlineLibraries) delete store.offlineLibraries[ch.name]; } catch (e) {}
    persistWx(); renderWx();
  }
  return true;
}
function exportCard(chOrId) {
  var ch = (typeof chOrId === 'string') ? findChar(chOrId) : chOrId;
  if (!ch) throw new Error('找不到这个人物');
  return {
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
      name: ch.name, nickname: ch.nickname || '', description: (ch.background || '') + (ch.traits ? '\n性格：' + ch.traits : ''),
      personality: ch.traits || '', scenario: '', first_mes: ch.greeting || '', mes_example: (ch.examples || []).map(function (ex) { return 'user: ' + ex.q + '\nchar: ' + ex.a; }).join('\n'),
      creator_notes: ch.notes || '', system_prompt: ch.rules || '',
      extensions: { aw: { gender: ch.gender, age: ch.age, occupation: ch.occupation, relationship: ch.relationship, birthday: ch.birthday, speechStyle: ch.speechStyle, likes: ch.likes, dislikes: ch.dislikes, habits: ch.habits, avatarSvg: ch.avatarSvg || '' } } }
  };
}
function importCard(card, opts) {
  opts = opts || {};
  var data = (card && card.data) ? card.data : card;
  if (!data || !data.name) throw new Error('角色卡里没有名字');
  var ex = data.extensions && data.extensions.aw ? data.extensions.aw : {};
  var ch = {
    id: uid('ch'), name: String(data.name).trim(), nickname: String(data.nickname || '').trim(),
    gender: String(ex.gender || '').trim(), age: String(ex.age || '').trim(), occupation: String(ex.occupation || '').trim(),
    relationship: String(ex.relationship || '').trim(), birthday: String(ex.birthday || '').trim(),
    notes: String(data.creator_notes || '').trim(), traits: String(data.personality || '').trim(),
    background: String(data.description || '').trim(), speechStyle: String(ex.speechStyle || '').trim(),
    likes: String(ex.likes || '').trim(), dislikes: String(ex.dislikes || '').trim(),
    habits: String(ex.habits || '').trim(), rules: String(data.system_prompt || '').trim(),
    greeting: String(data.first_mes || '').trim(), examples: parseExamples(String(data.mes_example || '').replace(/user:\s*/g, '问：').replace(/char:\s*/g, '答：')),
    avatar: '', avatarSvg: String(ex.avatarSvg || '').trim(),
    source: 'imported', status: 'pending', enabled: false, createdAt: Date.now(), sessionId: ''
  };
  var cs = listChars(); cs.unshift(ch); wr(CHARS_KEY, cs); return ch;
}
function enableChar(id) {
  var ch = findChar(id); if (!ch) throw new Error('找不到这个人物');
  ch.status = 'active'; ch.enabled = true;
  var cs = listChars(); cs.forEach(function (x) { if (x.id === id) { x.status = 'active'; x.enabled = true; } }); wr(CHARS_KEY, cs);
  registerCharInWeChat(ch); return ch;
}
/* ── 人物回复：模板回复必须带可见标注 label（调用方渲染时要把 label
   显示出来，不能只留在返回值里）；用户自己写的示例对话按原样回，via:'example'。
   模型路径见 replyForCharModel：接通模型时 via:'model'，失败才回落模板。 ── */
function replyForChar(chOrId, userText) {
  var ch = (typeof chOrId === 'string') ? findChar(chOrId) : chOrId;
  if (!ch) throw new Error('找不到这个人物');
  var t = String(userText || '');
  var ex = null;
  (ch.examples || []).forEach(function (e) { if (!ex && e.q && t.indexOf(e.q) !== -1) ex = e; });
  if (ex) return { text: ex.a, via: 'example', matched: 'example' };
  var short = /简短|短句|话少/.test(ch.rules || '') || /简短|短句/.test(ch.speechStyle || '');
  var style = ch.speechStyle || '';
  var cands = short
    ? ['嗯。', '在呢。', '好呀。', '嗯嗯，听你的。']
    : ['嗯，我在听，你继续说。', '这个嘛……' + (ch.traits ? '按我的性子，' : '') + '我觉得挺好的。', '哈哈，你这么一说，我也想起来了。', '好呀，那我们就这么说定了。'];
  var text = cands[Math.floor(Math.random() * cands.length)];
  if (style) text = text;
  return { text: text, via: 'template', matched: 'template', label: '模板回复 · 未接模型' };
}
function replyForCharModel(chOrId, userText) {
  var ch = (typeof chOrId === 'string') ? findChar(chOrId) : chOrId;
  if (!ch) return Promise.reject(new Error('找不到这个人物'));
  var sys = '你正在扮演「' + ch.name + '」与用户进行微信聊天。'
    + (ch.traits ? '性格：' + ch.traits + '。' : '') + (ch.background ? '背景：' + ch.background + '。' : '')
    + (ch.speechStyle ? '说话风格：' + ch.speechStyle + '。' : '') + (ch.rules ? '行为规则：' + ch.rules : '');
  try { if (window.GroupN && window.GroupN.pillConsumeForPrompt) sys += window.GroupN.pillConsumeForPrompt();} catch (e) {}
  try {
    if (window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('chat') && window.PhoneModel.chatComplete) {
      return window.PhoneModel.chatComplete([{ role: 'system', content: sys }, { role: 'user', content: String(userText || '') }], { feature: 'chat' }).then(function (text) { return { text: String(text || ''), via: 'model' }; }).catch(function () { var r = replyForChar(ch, userText); r.fallback = true; return r; });
    }
  } catch (e) {}
  var r = replyForChar(ch, userText); r.fallback = true;
  return Promise.resolve(r);
}

/* ── 此刻 UI：模拟人生面板 + 浮层页 ── */
function ensureStyle() {
  if (document.getElementById('aw-style')) return;
  var st = document.createElement('style'); st.id = 'aw-style';
  st.textContent = [
    '#aw-sim-panel{margin:10px 2px 12px;background:rgba(251,249,244,.96);border:1px solid #dce2f1;border-radius:16px;padding:12px 14px;box-shadow:0 1px 2px rgba(30,39,72,.06),0 4px 14px rgba(30,39,72,.08);}',
    '#aw-sim-panel h4{margin:0 0 6px;font-size:13px;color:#1e2748;letter-spacing:1px;}',
    '.aw-sim-line{font-size:13px;color:#1e2748;line-height:1.6;}',
    '.aw-need{margin:6px 0;} .aw-need span{display:inline-block;width:44px;font-size:11px;color:#5b6b8a;}',
    '.aw-bar{display:inline-block;width:120px;height:6px;background:#eef0f5;border-radius:3px;vertical-align:middle;} .aw-bar i{display:block;height:6px;background:#1e2748;border-radius:3px;}',
    '.aw-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
    '.aw-btns button{border:0;background:#dce2f1;color:#1e2748;font-size:12px;font-weight:700;border-radius:16px;padding:7px 11px;cursor:pointer;}',
    '.aw-btns button:active{transform:scale(.94);}',
    '#aw-overlay{position:absolute;inset:0;background:#fbf9f4;z-index:120;overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 40px;box-sizing:border-box;display:none;}', // z-index 120：高于此刻子页面 .ck-sub(95)/.ck-pop(90)，低于系统级浮层（创建人物页 3200 起）
    '#aw-overlay.show{display:block;}',
    '.aw-ov-back{border:0;background:none;color:#1e2748;font-size:15px;font-weight:700;cursor:pointer;padding:6px 0;}',
    '.aw-ov-title{font-size:17px;font-weight:800;color:#1e2748;margin:4px 0 10px;}',
    '.aw-card{background:#fffdf8;border:1px solid #dce2f1;border-radius:14px;padding:12px;margin-bottom:10px;font-size:13px;line-height:1.7;color:#1e2748;box-shadow:0 1px 2px rgba(30,39,72,.05),0 4px 12px rgba(30,39,72,.06);}',
    '.aw-card input,.aw-card textarea,.aw-card select{width:100%;box-sizing:border-box;border:1px solid #dce2f1;border-radius:8px;padding:8px;font-size:13px;margin:4px 0 8px;font-family:inherit;background:#fffdf8;color:#1e2748;}',
    '.aw-card label{font-size:12px;color:#5b6b8a;font-weight:700;}',
    '.aw-btn{border:0;background:#1e2748;color:#fff;font-size:13px;font-weight:700;border-radius:16px;padding:8px 14px;cursor:pointer;margin:2px 4px 2px 0;}',
    '.aw-btn.ghost{background:#dce2f1;color:#1e2748;}',
    '.aw-empty{font-size:13px;color:#5b6b8a;line-height:1.8;padding:10px 2px;}',
    '.aw-pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
    '.aw-pc{background:#fffdf8;border:1px solid #dce2f1;border-radius:12px;overflow:hidden;cursor:pointer;}',
    '.aw-pc-meta{padding:8px 10px;font-size:11px;line-height:1.6;color:#1e2748;}',
    '.aw-pc-meta b{font-size:12px;color:#1e2748;}',
    '#wx-view-aw-create-char{background:#ededed;z-index:3200;}',
    '#wx-view-aw-create-char .wx-scroll-view{padding-top:calc(48px + var(--sys-island-safe-top, 62px));background:#ededed;}',
    '.aw-cc-field{margin:0 12px 10px;background:#fff;border-radius:10px;padding:12px;}',
    '.aw-cc-field label{display:block;font-size:12px;color:#888;margin-bottom:4px;}',
    '.aw-cc-field input,.aw-cc-field textarea,.aw-cc-field select{width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;}',
    '.aw-cc-field details{font-size:13px;color:#333;} .aw-cc-field summary{cursor:pointer;font-weight:700;padding:4px 0;}',
    '.aw-warn{color:#1e2748;font-size:12px;line-height:1.6;}'
  ].join('\n');
  document.head.appendChild(st);
}
function needsBarHTML(label, v) { return '<div class="aw-need"><span>' + label + '</span><span class="aw-bar"><i style="width:' + v + '%"></i></span> ' + v + '</div>'; }
function simPanelHTML() {
  var s = tickNeeds();
  var cur = currentActivity();
  var tier = tierOf(affectionValue());
  var goals = readGoals(); var g = goals.find(function (x) { return !x.done && x.status !== 'done'; }) || goals[0];
  var promises = readPromises().filter(function (p) { return !promiseDone(p); });
  var mu = murmurNow();
  var drives = readDrives();
  var pcs = listPostcards();
  var driveLine = '';
  if (drives && typeof drives === 'object') {
    var parts = [];
    Object.keys(drives).forEach(function (k) { var v = drives[k]; if (typeof v === 'number') parts.push(k + ' ' + v); else if (v && typeof v === 'object' && typeof v.value === 'number') parts.push(k + ' ' + v.value); });
    if (parts.length) driveLine = '<div class="aw-sim-line">内在驱动：' + esc(parts.slice(0, 5).join(' · ')) + '</div>';
  }
  return '<h4>模拟人生 · ' + esc(mainCharName()) + ' 的一天</h4>'
    + '<div class="aw-sim-line">' + esc(cur.at) + ' — ' + esc(cur.text) + '（好感：' + esc(tier.label) + '）' + (cur.isDefault ? ' · 默认日程 · 未设置' : '') + '</div>'
    + '<div class="aw-sim-line">此刻他手机上：' + esc(phoneNow()) + '（模拟人生推测，不是真截屏）</div>'
    + needsBarHTML('饿', s.needs.hunger) + needsBarHTML('累', 100 - s.needs.energy) + needsBarHTML('心情', s.needs.mood) + needsBarHTML('社交', s.needs.social)
    + driveLine
    + '<div class="aw-sim-line">今日小目标：' + esc(g ? goalText(g) : '今天还没有小目标') + '</div>'
    + '<div class="aw-sim-line">最近承诺：' + esc(promises.length ? promiseText(promises[0]) : '没有进行中的承诺') + '</div>'
    + '<div class="aw-sim-line">' + (mu ? '刚才他嘟囔：「' + esc(mu.text) + '」' + (mu.source === 'template' ? '（模板嘟囔）' : '') : '他还没嘟囔什么。') + '</div>'
    + '<div class="aw-sim-line">明信片：共 ' + pcs.length + ' 张' + (pcs.length ? '，最新一张来自' + esc(pcs[0].place) + ' · ' + esc(pcs[0].event) : '') + '</div>'
    + '<div class="aw-btns"><button type="button" data-aw-open="travel">旅行</button><button type="button" data-aw-open="murmur">碎碎念</button><button type="button" data-aw-open="postcards">明信片册</button><button type="button" data-aw-open="home">家</button><button type="button" data-aw-open="letters">写信过程</button><button type="button" data-aw-open="phone">查手机</button></div>';
}
function ensureSimPanel() {
  var book = document.getElementById('ck-popbook'); if (!book) return false;
  var tl = document.getElementById('ck-timeline'); if (!tl) return false;
  try { checkMilestones(); maybeMomentPostcard(); maybeFestivalPostcard(); } catch (e) {}
  var panel = document.getElementById('aw-sim-panel');
  if (!panel) {
    panel = document.createElement('div'); panel.id = 'aw-sim-panel';
    /* 2026-11-27 Hub：面板住进“他的一天”子页的 #ck-simday-area；该容器不存在时才回落到时间线后面。 */
    var simdayArea = document.getElementById('ck-simday-area');
    if (simdayArea) simdayArea.appendChild(panel);
    else if (tl.after) tl.after(panel); else tl.parentNode.insertBefore(panel, tl.nextSibling);
    panel.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-open]') : null; if (!b) return;
      var page = b.getAttribute('data-aw-open');
      if (page === 'phone') { /* 2026-11-27 Hub：首页 .ck-card 已删，查手机改走冒泡事件，js/00 mount 里接 openSub('photo') */ try { panel.dispatchEvent(new CustomEvent('ck-open-sub', { detail: 'photo', bubbles: true })); } catch (e) {} return; }
      openOverlay(page);
    });
    /* 2026-11-27：底部“模拟人生”卡片已删（用户要求）；内联 #aw-sim-panel 留着。 */
  }
  var _fix6Html = simPanelHTML();
  /* GROUP-FIX6 · FIX6-2 模拟人生面板去重写：与 FIX6-1 同一根因（AW boot 的
     documentElement/subtree observer 回调 ensureSimPanel()，无条件写
     #aw-sim-panel；开此刻后 10 秒重写 3258 次，与记忆树互为乒乓）。
     simPanelHTML 的时钟是分钟粒度、需求 15 分钟才衰减一次，数据不变时
     一分钟内恒命中，最多每分钟写一次；好感/目标/承诺/碎碎念/明信片变化时
     照常重写。面板创建分支与点击委托不动。 */
  if (panel.__fix6LastHtml === _fix6Html) return true;
  panel.innerHTML = _fix6Html;
  panel.__fix6LastHtml = _fix6Html;
  return true;
}
function ckRoot() { var p = document.getElementById('ck-popbook'); return p ? p.closest('.ck-root') : null; }
function openOverlay(page, arg) {
  ensureStyle();
  var host = ckRoot() || document.body;
  var ov = document.getElementById('aw-overlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'aw-overlay'; host.appendChild(ov); }
  ov.innerHTML = overlayHTML(page, arg);
  ov.classList.add('show');
  ov.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-act]') : null; if (!b) return;
    handleOverlayAct(b.getAttribute('data-aw-act'), b.getAttribute('data-id') || '', b, ov);
  };
  var sc = ov.querySelector('#aw-tr-q'); if (sc) sc.addEventListener('input', function () { var list = document.getElementById('aw-tr-list'); if (list) list.innerHTML = travelListHTML(sc.value); });
  var pf = ov.querySelector('#aw-pc-filter'); if (pf) pf.addEventListener('change', function () { var grid = document.getElementById('aw-pc-grid'); if (grid) grid.innerHTML = postcardGridHTML(pf.value, grid.getAttribute('data-aw-pc-date') || ''); });
  if (ov.scrollTop !== undefined) ov.scrollTop = 0;
}
function closeOverlay() { var ov = document.getElementById('aw-overlay'); if (ov) ov.classList.remove('show'); }
function travelListHTML(q) {
  var ts = searchTravel(q);
  if (!ts.length) {
    var dayDefault = false; try { dayDefault = !!loadDay().isDefault; } catch (e) {}
    return '<div class="aw-empty">还没有旅行。新建一个目的地场景，char 就可以出发了。' + (dayDefault ? '<br>今日日程还没设置（默认日程），先去此刻设置真实日程，这里的地点会跟着变；也可以直接编一个新地方。' : '<br>目的地可以是手机里已有的真实地点（' + esc(listDestinations().slice(0, 6).join('、')) + '），也可以是你编的新地方。') + '</div>';
  }
  return ts.map(function (t) {
    return '<div class="aw-card"><b>' + esc(t.name) + '</b> · ' + (t.status === 'active' ? '进行中' : '已结束') + ' · ' + (t.rounds || []).length + ' 轮<br><span style="color:#5b6b8a">' + esc(t.goal || t.setting || '') + '</span><br><button class="aw-btn ghost" type="button" data-aw-act="tr-open" data-id="' + t.id + '">进入行程</button></div>';
  }).join('');
}
function postcardGridHTML(place, dateStr) {
  var pcs = place ? postcardsByPlace(place) : listPostcards();
  if (dateStr) pcs = pcs.filter(function (p) { return String(p.time || '').indexOf(dateStr) === 0; });
  if (!pcs.length) return '<div class="aw-empty">' + (dateStr ? '这一天没有明信片。' : '还没有明信片。char 出门旅行或遇到值得记的事时，会寄明信片回来。') + '</div>';
  return '<div class="aw-pc-grid">' + pcs.map(function (p) {
    return '<div class="aw-pc" data-aw-act="pc-open" data-id="' + p.id + '"><div>' + postcardSVG(p.scene, currentActivity(p.ts).phase) + '</div><div class="aw-pc-meta"><b>' + esc(p.place) + '</b><br>' + esc(p.time) + '<br>' + esc(p.event) + '<br>新见闻：' + esc(p.discovery) + '</div></div>';
  }).join('') + '</div>';
}
function overlayHTML(page, arg) {
  var back = '<button class="aw-ov-back" type="button" data-aw-act="back">‹ 返回</button>';
  if (page === 'travel') {
    return back + '<div class="aw-ov-title">旅行</div>'
      + '<div class="aw-card"><label>搜索行程</label><input id="aw-tr-q" type="text" placeholder="搜目的地 / 行动 / 事件…">'
      + '<div id="aw-tr-list">' + travelListHTML('') + '</div></div>'
      + '<div class="aw-card"><label>新建目的地场景（不预填示例旅行）</label>'
      + '<input id="aw-tr-name" type="text" placeholder="目的地名（必填，如：海边小镇）">'
      + '<textarea id="aw-tr-setting" rows="2" placeholder="设定：这里是什么地方、什么氛围"></textarea>'
      + '<input id="aw-tr-goal" type="text" placeholder="目标：这次旅行想达成什么">'
      + '<textarea id="aw-tr-events" rows="3" placeholder="隐藏事件（每行一个，格式：效果文本 | 概率，如：遇见一只橘猫，跟着它走了一段路 | 0.3）&#10;只会看到效果，不会看到概率和骰子。"></textarea>'
      + '<button class="aw-btn" type="button" data-aw-act="tr-create">出发</button>'
      + '<div style="font-size:12px;color:#5b6b8a">已有真实地点：' + esc(listDestinations().join('、')) + '</div></div>'
      + '<div class="aw-card"><button class="aw-btn ghost" type="button" data-aw-act="tr-export">导出行程 JSONL</button><span id="aw-tr-export-out" style="font-size:12px;color:#5b6b8a"></span></div>';
  }
  if (page === 'trip') {
    var tr = findTrip(arg); if (!tr) return back + '<div class="aw-empty">找不到这次旅行。</div>';
    var rounds = (tr.rounds || []).map(function (r) { return '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>第' + r.n + '轮</b> · ' + esc(r.action) + '<br>' + esc(r.narrative) + (r.event ? '<br><span style="color:#1e2748">· ' + esc(r.event.text) + '</span>' : '') + '</div>'; }).join('') || '<div class="aw-empty">还没行动，写下第一句行动吧。</div>';
    return back + '<div class="aw-ov-title">' + esc(tr.name) + '</div>'
      + '<div class="aw-card">' + esc(tr.setting || '') + (tr.goal ? '<br>目标：' + esc(tr.goal) : '') + ' · ' + (tr.status === 'active' ? '进行中' : '已结束') + '</div>'
      + '<div class="aw-card">' + rounds + '</div>'
      + (tr.status === 'active' ? '<div class="aw-card"><label>下一轮行动（用自己的话写）</label><input id="aw-tr-action" type="text" placeholder="如：走到海边，脱了鞋踩沙子"><button class="aw-btn" type="button" data-aw-act="tr-round" data-id="' + tr.id + '">行动</button></div>'
        + '<div class="aw-card"><button class="aw-btn" type="button" data-aw-act="tr-end-save" data-id="' + tr.id + '">结束并存成记忆</button><button class="aw-btn ghost" type="button" data-aw-act="tr-end-drop" data-id="' + tr.id + '">结束并放弃（不留记录）</button></div>' : '')
      + '<div class="aw-card"><button class="aw-btn ghost" type="button" data-aw-act="tr-postcards" data-id="' + tr.id + '">看这次旅行的明信片</button></div>';
  }
  if (page === 'murmur') {
    var list = listMurmur();
    var inner = readInnerLog().slice(-5).reverse().map(function (e) { var t = e && (e.text || e.msg || e.content); return t ? '<div style="border-top:1px solid #dce2f1;padding:6px 0">' + esc(String(t)) + '</div>' : ''; }).join('');
    return back + '<div class="aw-ov-title">碎碎念</div>'
      + '<div class="aw-card"><button class="aw-btn" type="button" data-aw-act="mu-gen">听他嘟囔一句</button><span style="font-size:12px;color:#5b6b8a">模板嘟囔 · 未接模型，点一下生成一句</span></div>'
      + '<div class="aw-card">' + (list.length ? list.map(function (m) { return '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>' + esc(fmtTime(m.ts)) + '</b><br>「' + esc(m.text) + '」<br><span style="font-size:11px;color:#5b6b8a">来源：' + esc(m.source === 'inner' ? '内心独白' : (m.source === 'template' ? '模板嘟囔' : '模拟人生')) + '</span></div>'; }).join('') : '<div class="aw-empty">还没有碎碎念。点“听他嘟囔一句”，或等他自己嘟囔。</div>') + '</div>'
      + '<div class="aw-card"><b>内心独白 · 最近</b>' + (inner || '<div class="aw-empty">暂无内心独白记录。</div>') + '</div>';
  }
  if (page === 'postcards') {
    var places = postcardPlaces();
    var dateArg = (typeof arg === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(arg)) ? arg : '';
    return back + '<div class="aw-ov-title">明信片册' + (dateArg ? ' · ' + esc(dateArg) + '（' + postcardsForDate(dateArg).length + ' 张）' : '') + '</div>'
      + (dateArg ? '<div class="aw-card"><button class="aw-btn ghost" type="button" data-aw-act="pc-all">看全部明信片</button></div>' : '')
      + '<div class="aw-card"><label>按地点筛选</label><select id="aw-pc-filter"><option value="">全部地点</option>' + places.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('') + '</select>'
      + '<div id="aw-pc-grid" data-aw-pc-date="' + esc(dateArg) + '">' + postcardGridHTML('', dateArg) + '</div></div>'
      + '<div style="font-size:12px;color:#5b6b8a">插画是画出来的场景，不是真照片。每张明信片可点开看大图、存成归巢记忆。</div>';
  }
  if (page === 'postcard') {
    var pcs = listPostcards(); var pc = null; pcs.forEach(function (x) { if (x.id === arg) pc = x; });
    if (!pc) return back + '<div class="aw-empty">找不到这张明信片。</div>';
    return back + '<div class="aw-ov-title">明信片</div>'
      + '<div class="aw-card"><div>' + postcardSVG(pc.scene, currentActivity(pc.ts).phase) + '</div><div style="font-size:12px;color:#5b6b8a">插画（非照片）· 立体书风格手绘场景</div>'
      + '<div style="margin-top:8px">「' + esc(pc.caption) + '」</div>'
      + '<div style="margin-top:8px">时间：' + esc(pc.time) + '<br>地点：' + esc(pc.place) + '<br>事件：' + esc(pc.event) + '<br>新见闻：' + esc(pc.discovery) + '<br>来源：' + esc(PC_SOURCES[pc.source] || pc.source) + '</div>'
      + '<div style="margin-top:8px"><button class="aw-btn" type="button" data-aw-act="pc-save" data-id="' + pc.id + '">存成归巢记忆</button>' + (pc.savedMemoryId ? '<span style="font-size:12px;color:#4a7a5a">已存（' + esc(pc.savedMemoryId) + '）</span>' : '') + '</div>'
      + '<div style="margin-top:8px"><button class="aw-btn ghost" type="button" data-aw-act="pc-jump" data-id="' + pc.id + '">跳回当时的立体书场景</button>' + (pc.ref && pc.ref.type === 'travel' ? '<button class="aw-btn ghost" type="button" data-aw-act="tr-open" data-id="' + pc.ref.id + '">看旅行记录</button>' : '') + '<button class="aw-btn ghost" type="button" data-aw-act="pc-day" data-id="' + pc.id + '">看当天明信片</button></div>'
      + '<div style="font-size:12px;color:#5b6b8a">当天明信片共 ' + postcardsForDate(pc.time.slice(0, 10)).length + ' 张；存成记忆后，记忆树里也能找到这一天。</div></div>';
  }
  if (page === 'home') {
    var home = getHome(); var rn = roomNow();
    return back + '<div class="aw-ov-title">char 的家</div>'
      + '<div class="aw-card">现在：' + (rn ? '在家里 · ' + esc(roomName(rn)) + '，' + esc(currentActivity().activity) : '出门在外 · ' + esc(currentActivity().text)) + '<br>这间房子就是乙游 3D 家的那一间，同一份数据（otome_home_v1），不是两间房。</div>'
      + '<div class="aw-card">' + ROOMS.map(function (r) { return '<div style="padding:6px 0;border-top:1px solid #dce2f1">' + (rn === r.id ? '› ' : '· ') + esc(r.name) + ' <span style="color:#5b6b8a">' + r.en + '</span>' + ((home.visitedRooms || []).indexOf(r.id) !== -1 ? ' · 去过' : '') + '</div>'; }).join('') + '</div>'
      + '<div class="aw-card">宠物：' + (home.pet ? esc(home.pet.name || home.pet.kind) + '（饱食 ' + (home.pet.satiety != null ? home.pet.satiety : '—') + ' · 心情 ' + (home.pet.mood != null ? home.pet.mood : '—') + '）' : '还没有宠物') + '<br><span style="font-size:12px;color:#5b6b8a">装修/养宠/互动在乙游 3D 家里做，此刻这里只看他在家干什么。</span></div>';
  }
  if (page === 'letters') {
    var album = rd('cike_album_v1', []);
    if (!album.length) return back + '<div class="aw-empty">信件箱还是空的。等 char 给你写信，这里会出现每封信的写信过程。</div>';
    return back + '<div class="aw-ov-title">写信过程</div><div class="aw-card">'
      + album.map(function (l, i) { return '<div style="padding:8px 0;border-top:1px solid #dce2f1"><b>' + esc(l.role || 'char') + '</b> · ' + esc(l.time || '') + '<br>' + esc(String(l.text || '').slice(0, 40)) + '……<br><button class="aw-btn ghost" type="button" data-aw-act="letter-open" data-id="' + i + '">看这封信是怎么写出来的</button></div>'; }).join('')
      + '</div><div style="font-size:12px;color:#5b6b8a">成品信仍在信件箱里，用手撕信封动画打开；这里只看写信过程。</div>';
  }
  if (page === 'letter') {
    var alb = rd('cike_album_v1', []); var letter = alb[parseInt(arg, 10)];
    if (!letter) return back + '<div class="aw-empty">找不到这封信。</div>';
    var j = buildLetterJourney(letter.text || '');
    return back + '<div class="aw-ov-title">写信过程</div>'
      + '<div class="aw-card"><div style="font-size:12px;color:#1e2748">' + esc(j.note) + '</div>'
      + j.versions.map(function (v) { return '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>' + esc(v.label) + '</b> · ' + esc(v.note) + '<br>' + esc(v.text) + '</div>'; }).join('')
      + '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>划掉的句子</b><br>' + j.crossedOut.map(esc).join('<br>') + '</div>'
      + '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>停顿和犹豫</b><br>' + j.hesitations.map(esc).join('<br>') + '</div>'
      + '<div style="border-top:1px solid #dce2f1;padding:8px 0"><b>写信时的内心独白</b><br>' + j.monologue.map(function (m) { return esc(m.at) + '：' + esc(m.text); }).join('<br>') + '</div>'
      + '<button class="aw-btn" type="button" data-aw-act="letter-goto">去信件箱打开原信</button></div>';
  }
  /* 2026-11-27：默认分支原是“模拟人生”浮层（openOverlay('sim')），随底部卡片一起删；
     未知 page 改走诚实空态，不再返回 undefined。 */
  return back + '<div class="aw-empty">找不到这一页。</div>';
}
function handleOverlayAct(act, id, btn, ov) {
  if (act === 'back') { closeOverlay(); return; }
  /* 2026-11-27：'goto' 分支已删——它的按钮只存在于已删的“模拟人生”浮层里。 */
  if (act === 'tr-create') {
    try {
      var t = createTrip({ name: (document.getElementById('aw-tr-name') || {}).value, setting: (document.getElementById('aw-tr-setting') || {}).value, goal: (document.getElementById('aw-tr-goal') || {}).value, eventsText: (document.getElementById('aw-tr-events') || {}).value });
      openOverlay('trip', t.id); toast('出发了，祝一路顺风');
    } catch (e) { toast(e.message || '创建失败'); }
    return;
  }
  if (act === 'tr-open') { openOverlay('trip', id); return; }
  if (act === 'tr-round') {
    var inp = document.getElementById('aw-tr-action');
    try { doRound(id, inp ? inp.value : ''); openOverlay('trip', id); } catch (e) { toast(e.message || '行动失败'); }
    return;
  }
  if (act === 'tr-end-save') { try { var r1 = endTrip(id, { saveMemory: true }); toast(r1.memory ? '已存成归巢记忆' : '已结束'); openOverlay('travel'); } catch (e) { toast(e.message || '结束失败'); } return; }
  if (act === 'tr-end-drop') { try { endTrip(id, { saveMemory: false }); toast('已放弃，没有留下记录'); openOverlay('travel'); } catch (e) { toast(e.message || '结束失败'); } return; }
  if (act === 'tr-export') {
    var out = document.getElementById('aw-tr-export-out'); var j = exportTravelJSONL();
    if (!j) { if (out) out.textContent = '暂无行程可导出'; toast('暂无行程可导出'); return; }
    var lines = j.split('\n').length;
    try {
      var blob = new Blob([j], { type: 'application/x-ndjson;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      var d0 = new Date(); a.download = '旅行行程-' + d0.getFullYear() + '-' + pad2(d0.getMonth() + 1) + '-' + pad2(d0.getDate()) + '.jsonl';
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} if (a.parentNode) a.parentNode.removeChild(a); }, 800);
      if (out) out.textContent = '已导出 ' + lines + ' 行，文件已下载';
      toast('已导出 ' + lines + ' 行，文件已下载');
    } catch (e) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(j);
          if (out) out.textContent = '下载失败，已复制 ' + lines + ' 行到剪贴板';
          toast('下载失败，已复制到剪贴板');
        } else { if (out) out.textContent = '导出失败：浏览器不支持下载'; toast('导出失败：浏览器不支持下载'); }
      } catch (e2) { if (out) out.textContent = '导出失败'; toast('导出失败'); }
    }
    return;
  }
  if (act === 'tr-postcards') { openOverlay('postcards'); return; }
  if (act === 'mu-gen') { genMurmur(); openOverlay('murmur'); return; }
  if (act === 'pc-open') { openOverlay('postcard', id); return; }
  if (act === 'pc-save') { var m = savePostcardMemory(id); if (m) { toast(m.already ? '这张已经存过了' : '已存成归巢记忆'); openOverlay('postcard', id); } else toast('保存失败'); return; }
  if (act === 'pc-jump') {
    var pc0 = null; listPostcards().forEach(function (x) { if (x.id === id) pc0 = x; });
    closeOverlay();
    var tl = document.getElementById('ck-timeline');
    var jumped = false;
    if (pc0 && tl) {
      var items = tl.querySelectorAll('.ck-tl-item');
      var best = null;
      for (var i = 0; i < items.length; i++) { if ((items[i].textContent || '').indexOf(pc0.place) !== -1) { best = items[i]; break; } }
      if (best) {
        try { best.click(); } catch (e) {}
        try { best.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e2) { try { best.scrollIntoView(); } catch (e3) {} }
        jumped = true;
      }
    }
    if (!jumped && tl) { try { tl.scrollIntoView(); } catch (e) {} }
    toast(jumped ? '已跳回「' + (pc0 ? pc0.place : '') + '」的立体书场景' : '时间线里没有这一站，已回到时间线');
    return;
  }
  if (act === 'pc-day') {
    var pc1 = null; listPostcards().forEach(function (x) { if (x.id === id) pc1 = x; });
    openOverlay('postcards', pc1 ? pc1.time.slice(0, 10) : '');
    return;
  }
  if (act === 'pc-all') { openOverlay('postcards'); return; }
  if (act === 'letter-open') { openOverlay('letter', id); return; }
  if (act === 'letter-goto') { closeOverlay(); var ab = document.getElementById('ck-album-btn'); if (ab) ab.click(); return; }
}

/* ── 微信：创建人物页 ── */
function qqAvatarSVG(hair, eye) {
  return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:64px;height:64px"><circle cx="60" cy="62" r="34" fill="#ffe3c4"/><path d="M27 62 Q22 20 60 18 Q98 20 93 62 Q88 34 60 32 Q32 34 27 62Z" fill="' + esc(hair) + '"/><circle cx="48" cy="62" r="5" fill="' + esc(eye) + '"/><circle cx="72" cy="62" r="5" fill="' + esc(eye) + '"/><path d="M48 82 Q60 90 72 82" stroke="#b5541e" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
}
function createFormHTML(editId) {
  var ch = editId ? findChar(editId) : null;
  var v = function (k) { return ch ? esc(ch[k] || '') : ''; };
  var exText = ch ? (ch.examples || []).map(function (e) { return '问：' + e.q + ' 答：' + e.a; }).join('\n') : '';
  var list = listChars().filter(function (x) { return x.status === 'active'; });
  return '<div class="wx-header" style="background:#ededed;"><div class="wx-header-left" data-aw-cc="back">‹</div><div class="wx-header-title">' + (ch ? '编辑人物' : '创建人物') + '</div><div class="wx-header-right"></div></div>'
    + '<div class="wx-scroll-view"><div style="padding:12px 12px 0;font-size:13px;color:#888;line-height:1.7">通讯录 → 添加朋友就是创建人物。主 char（TA）在角色设置里配，这里创建的是其他人物（朋友 / NPC）。只填名字和头像就是普通联系人，展开人设与指令就是完整人物。</div>'
    + '<div class="aw-cc-field"><label>头像</label><div style="display:flex;gap:10px;align-items:center"><div id="aw-cc-avatar-preview">' + (ch && ch.avatarSvg ? ch.avatarSvg : qqAvatarSVG('#3a2a1e', '#2b2b2b')) + '</div><div><input id="aw-cc-avatar-file" type="file" accept="image/*"><button type="button" onclick="window.GroupBG&&window.GroupBG.fillInputFromCamera(\'aw-cc-avatar-file\')" style="padding:6px 12px;border:1px solid #ddd;border-radius:16px;background:#fff;font-size:12px;cursor:pointer;margin-left:6px;">📷 拍照</button><div style="font-size:11px;color:#888;margin-top:4px">上传图片：支持自动抠图成站姿立绘（OtomeF.removeBg），不支持时用原图；也可以从下面挑自画 QQ 风形象。</div></div></div>'
    + '<div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="aw-btn ghost" data-aw-cc="qq" data-hair="#3a2a1e" data-eye="#2b2b2b">深棕发</button><button type="button" class="aw-btn ghost" data-aw-cc="qq" data-hair="#b5541e" data-eye="#3a6ea5">红发蓝瞳</button><button type="button" class="aw-btn ghost" data-aw-cc="qq" data-hair="#7a9cc6" data-eye="#4a7a5a">蓝发绿瞳</button></div></div>'
    + '<div class="aw-cc-field"><label>名字 *</label><input id="aw-cc-name" type="text" placeholder="必填" value="' + v('name') + '"><div id="aw-cc-warn" class="aw-warn"></div>'
    + '<label>昵称</label><input id="aw-cc-nickname" type="text" value="' + v('nickname') + '">'
    + '<label>性别</label><select id="aw-cc-gender"><option value="">—</option>' + ['女', '男', '其他'].map(function (g) { return '<option value="' + g + '"' + (ch && ch.gender === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select>'
    + '<label>年龄</label><input id="aw-cc-age" type="text" value="' + v('age') + '"><label>职业</label><input id="aw-cc-occupation" type="text" value="' + v('occupation') + '">'
    + '<label>与你的关系</label><input id="aw-cc-relationship" type="text" placeholder="如：朋友 / 同事 / 邻居" value="' + v('relationship') + '">'
    + '<label>生日</label><input id="aw-cc-birthday" type="text" placeholder="如：3月14日" value="' + v('birthday') + '">'
    + '<label>备注</label><input id="aw-cc-notes" type="text" value="' + v('notes') + '"></div>'
    + '<div class="aw-cc-field"><details' + (ch && ch.traits ? ' open' : '') + '><summary>人设（性格 / 背景 / 说话风格 / 喜欢 / 讨厌 / 习惯）</summary>'
    + '<label>性格特点</label><textarea id="aw-cc-traits" rows="2">' + v('traits') + '</textarea>'
    + '<label>背景故事</label><textarea id="aw-cc-background" rows="2">' + v('background') + '</textarea>'
    + '<label>说话风格</label><input id="aw-cc-speech" type="text" value="' + v('speechStyle') + '">'
    + '<label>喜欢</label><input id="aw-cc-likes" type="text" value="' + v('likes') + '"><label>讨厌</label><input id="aw-cc-dislikes" type="text" value="' + v('dislikes') + '"><label>习惯</label><input id="aw-cc-habits" type="text" value="' + v('habits') + '"></details></div>'
    + '<div class="aw-cc-field"><details' + (ch && ch.rules ? ' open' : '') + '><summary>指令（聊天行为规则 / 开场白 / 示例对话）</summary>'
    + '<label>行为规则（系统提示词式，如：说话简短、爱用表情包、不会主动提工作）</label><textarea id="aw-cc-rules" rows="2">' + v('rules') + '</textarea>'
    + '<label>开场白（第一条消息）</label><input id="aw-cc-greeting" type="text" value="' + v('greeting') + '">'
    + '<label>示例对话（每行一组：问：…… 答：……）</label><textarea id="aw-cc-examples" rows="3">' + esc(exText) + '</textarea></details></div>'
    + '<div style="margin:0 12px 12px"><button class="aw-btn" type="button" data-aw-cc="save" data-id="' + (ch ? ch.id : '') + '" style="background:#07c160">保存人物</button>'
    + (ch ? '<button class="aw-btn ghost" type="button" data-aw-cc="export" data-id="' + ch.id + '">导出角色卡</button><button class="aw-btn ghost" type="button" data-aw-cc="delete" data-id="' + ch.id + '">删除人物</button>' : '')
    + '<button class="aw-btn ghost" type="button" data-aw-cc="import">导入角色卡（ST v2/v3，需审阅启用）</button></div>'
    + '<div class="aw-cc-field"><b style="font-size:13px">我创建的人物（' + list.length + '）</b>' + (list.length ? list.map(function (x) { return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #f0f0f0"><span>' + esc(x.name) + (x.nickname ? '（' + esc(x.nickname) + '）' : '') + ' · ' + esc(x.relationship || '联系人') + '</span><span><button type="button" class="aw-btn ghost" data-aw-cc="edit" data-id="' + x.id + '">编辑</button><button type="button" class="aw-btn ghost" data-aw-act2="chat" data-id="' + x.id + '">聊天</button></span></div>'; }).join('') : '<div class="aw-empty">还没有创建人物。</div>') + '</div>'
    + '<div class="aw-cc-field"><b style="font-size:13px">待审阅的导入（默认禁用）</b>' + (function () { var pend = listChars().filter(function (x) { return x.status === 'pending'; }); return pend.length ? pend.map(function (x) { return '<div style="padding:8px 0;border-top:1px solid #f0f0f0">' + esc(x.name) + '（导入，未启用） <button type="button" class="aw-btn ghost" data-aw-cc="enable" data-id="' + x.id + '">审阅后启用</button></div>'; }).join('') : '<div class="aw-empty">没有待审阅的导入。</div>'; })() + '</div>'
    + '<div style="height:40px"></div></div>';
}
function openCreateChar(editId) {
  ensureStyle();
  var root = document.getElementById('wx-app-root');
  if (!root) {
    try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('wechat'); } catch (e) {}
    setTimeout(function () { openCreateChar(editId); }, 400); return;
  }
  var page = document.getElementById('wx-view-aw-create-char');
  if (!page) { page = document.createElement('div'); page.id = 'wx-view-aw-create-char'; page.className = 'wx-subpage-box wx-slide-right'; root.appendChild(page); }
  _ccAvatar = ''; _ccAvatarSvg = '';
  var ch = editId ? findChar(editId) : null;
  if (ch) { _ccAvatar = ch.avatar || ''; _ccAvatarSvg = ch.avatarSvg || ''; }
  page.innerHTML = createFormHTML(editId);
  page.classList.add('wx-active');
  var nameInput = document.getElementById('aw-cc-name');
  if (nameInput) nameInput.addEventListener('input', function () {
    var w = document.getElementById('aw-cc-warn');
    if (w) w.textContent = mainCharConflict(nameInput.value) ? '提醒：这个名字和主 char（TA）重名，聊天时容易混淆，确定要用吗？' : '';
  });
  var fileInput = document.getElementById('aw-cc-avatar-file');
  if (fileInput) fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var url = String(reader.result || '');
      try {
        if (window.OtomeF && OtomeF.removeBg) {
          var img = new Image();
          img.onload = function () {
            try {
              var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
              var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
              var imgData = ctx.getImageData(0, 0, cv.width, cv.height);
              var cut = OtomeF.removeBg({ width: cv.width, height: cv.height, data: imgData.data }, 60);
              var out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
              var octx = out.getContext('2d'); octx.putImageData(new ImageData(new Uint8ClampedArray(cut.data), cv.width, cv.height), 0, 0);
              _ccAvatar = out.toDataURL('image/png');
            } catch (e) { _ccAvatar = url; }
            var pv = document.getElementById('aw-cc-avatar-preview'); if (pv) pv.innerHTML = '<img src="' + _ccAvatar + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover">';
          };
          img.src = url; return;
        }
      } catch (e) {}
      _ccAvatar = url;
      var pv2 = document.getElementById('aw-cc-avatar-preview'); if (pv2) pv2.innerHTML = '<img src="' + url + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover">';
    };
    reader.readAsDataURL(f);
  });
  page.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? (ev.target.closest('[data-aw-cc]') || ev.target.closest('[data-aw-act2]')) : null; if (!b) return;
    var act = b.getAttribute('data-aw-cc') || b.getAttribute('data-aw-act2');
    var id = b.getAttribute('data-id') || '';
    if (act === 'back') { page.classList.remove('wx-active'); return; }
    if (act === 'qq') { _ccAvatarSvg = qqAvatarSVG(b.getAttribute('data-hair'), b.getAttribute('data-eye')); _ccAvatar = ''; var pv = document.getElementById('aw-cc-avatar-preview'); if (pv) pv.innerHTML = _ccAvatarSvg; return; }
    if (act === 'edit') { openCreateChar(id); return; }
    if (act === 'chat') { page.classList.remove('wx-active'); var c2 = findChar(id); if (c2) { var st = wxStore(); if (st) { st.currentChatId = c2.sessionId; persistWx(); } renderWx(); } return; }
    if (act === 'enable') { try { enableChar(id); toast('已启用，进通讯录和消息列表了'); openCreateChar(); } catch (e) { toast(e.message || '启用失败'); } return; }
    if (act === 'export') { try { var card = exportCard(id); var blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (findChar(id).name || 'char') + '.json'; a.click(); toast('角色卡已导出'); } catch (e) { toast(e.message || '导出失败'); } return; }
    if (act === 'delete') { try { if (window.confirm && !window.confirm('确定删除这个人物吗？ta 的会话也会一起删掉。')) return; deleteChar(id); toast('已删除'); page.classList.remove('wx-active'); } catch (e) { toast(e.message || '删除失败'); } return; }
    if (act === 'import') {
      try {
        var raw = window.prompt('粘贴 SillyTavern v2/v3 角色卡 JSON：');
        if (!raw) return;
        var imported = importCard(JSON.parse(raw));
        toast('已导入，待审阅启用（默认禁用，不进通讯录）');
        openCreateChar();
      } catch (e) { toast('导入失败：' + (e.message || '格式不对')); }
      return;
    }
    if (act === 'save') {
      var gv = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
      var data = { name: gv('aw-cc-name'), nickname: gv('aw-cc-nickname'), gender: gv('aw-cc-gender'), age: gv('aw-cc-age'), occupation: gv('aw-cc-occupation'), relationship: gv('aw-cc-relationship'), birthday: gv('aw-cc-birthday'), notes: gv('aw-cc-notes'), traits: gv('aw-cc-traits'), background: gv('aw-cc-background'), speechStyle: gv('aw-cc-speech'), likes: gv('aw-cc-likes'), dislikes: gv('aw-cc-dislikes'), habits: gv('aw-cc-habits'), rules: gv('aw-cc-rules'), greeting: gv('aw-cc-greeting'), examplesText: gv('aw-cc-examples'), avatar: _ccAvatar, avatarSvg: _ccAvatarSvg };
      try {
        if (id) updateChar(id, data); else createChar(data);
        toast('人物已保存，进通讯录和消息列表了');
        page.classList.remove('wx-active'); renderWx();
      } catch (e) { toast(e.message || '保存失败'); }
      return;
    }
  };
}
function hookWeChat() {
  var e = window.WeChatAppEngine; if (!e || e._awHooked) return false;
  if (typeof e.openAddFriend !== 'function') return false;
  e._awOrigOpenAddFriend = e.openAddFriend;
  e.openAddFriend = function () { openCreateChar(); };
  e._awHooked = true; return true;
}

/* ── 启动 ── */
function boot() {
  try { ensureStyle(); } catch (e) {}
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try { ensureSimPanel(); } catch (e) {}
    try { hookWeChat(); } catch (e) {}
    if (tries > 40) clearInterval(timer);
  }, 800);
  if (typeof MutationObserver !== 'undefined') {
    try {
      var ob = new MutationObserver(function () { try { ensureSimPanel(); } catch (e) {} try { hookWeChat(); } catch (e) {} });
      ob.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

window.AWGroup = {
  MARK: MARK, SIM_KEY: SIM_KEY, TRAVEL_KEY: TRAVEL_KEY, MURMUR_KEY: MURMUR_KEY, PC_KEY: PC_KEY, CHARS_KEY: CHARS_KEY, GC_KEY: GC_KEY,
  loadDay: loadDay, slotForHour: slotForHour, currentActivity: currentActivity,
  loadSim: loadSim, saveSim: saveSim, tickNeeds: tickNeeds,
  affectionValue: affectionValue, tierOf: tierOf, readDrives: readDrives, readGoals: readGoals, readPromises: readPromises, readInnerLog: readInnerLog,
  listMurmur: listMurmur, addMurmur: addMurmur, murmurNow: murmurNow, genMurmur: genMurmur, phoneNow: phoneNow,
  createTrip: createTrip, listTravel: listTravel, findTrip: findTrip, doRound: doRound, endTrip: endTrip, searchTravel: searchTravel, exportTravelJSONL: exportTravelJSONL, listDestinations: listDestinations, parseEvents: parseEvents,
  buildLetterJourney: buildLetterJourney, LETTER_JOURNEY_NOTE: LETTER_JOURNEY_NOTE,
  getHome: getHome, roomNow: roomNow, roomName: roomName, ROOMS: ROOMS,
  listPostcards: listPostcards, sendPostcard: sendPostcard, postcardSVG: postcardSVG, sceneKeyFor: sceneKeyFor,
  checkMilestones: checkMilestones, maybeMomentPostcard: maybeMomentPostcard, maybeFestivalPostcard: maybeFestivalPostcard,
  savePostcardMemory: savePostcardMemory, postcardsForDate: postcardsForDate, postcardsByPlace: postcardsByPlace, postcardPlaces: postcardPlaces,
  deliverPostcardToWeChat: deliverPostcardToWeChat, notifyPostcard: notifyPostcard,
  listChars: listChars, findChar: findChar, mainCharConflict: mainCharConflict, createChar: createChar, updateChar: updateChar, deleteChar: deleteChar,
  exportCard: exportCard, importCard: importCard, enableChar: enableChar, replyForChar: replyForChar, replyForCharModel: replyForCharModel,
  ensureSimPanel: ensureSimPanel, openOverlay: openOverlay, closeOverlay: closeOverlay, openCreateChar: openCreateChar, hookWeChat: hookWeChat
};
})();
