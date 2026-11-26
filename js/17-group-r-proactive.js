
/* GROUP-R-PROACTIVE  ═════════════════════════════════════════════════════════
Group R · 主动消息完整节流（调研报告第五节阶段一 A1 + A28 + A15）+ A2 + A8 + A36 + A19 + A35
出处（只借设计思路，未复制代码；Hanami AGPL-3.0 代码一行没拿）：
  Pulse https://github.com/elliejayliquid/pulse（MIT）：A1 心跳三件套（固定/随机间隔、
  离场模式 always/taper/once、免打扰、粘性静音）、A2 Lantern 状态灯、A8 日程优先级。
  Cyber Companion https://github.com/Xiaoyan43/cyber-companion（MIT）：A15 思念模型
  （亲近度 × 沉默时长，泊松随机时间）+ 三段节流（速率 → 可达性 → 信息增益）、
  A19 Mock 模式诚实标注。
  Hanami https://github.com/Undi95/Hanami（AGPL-3.0，思路 only）：A28 自发消息阶梯
  4h/10h/24h/48h、A35 模型模式 Full vs Simple（本机是 Simple）、A36 口述门控。
新增键：char_proactive_cfg_v1（本组唯一新增配置键）；
  char_proactive_state_v1（K2 收敛状态键名，K2 未合入时不存在则容错建空壳，
  进度写在 .r 子对象里，顶层未知字段原样保留，绝不覆盖 K2 的字段）。
只读/复用（不改键名、不改结构）：char_quiet_v1（O 组，免打扰 + 每日上限唯一真相，
  写经 CharInnerLife.setQuiet）、char_inner_log_v1（理由写进内心日志，经 logCycle）、
  char_promises_v1（O 组，读；只给条目加一个可选 priority 字段）、
  phone_schedule_v1（D 组，读；优先级字段由日程补丁写）、guichao.memories.v1（读，找值得回忆的记忆）、
  char_inner_state_v1（O 组，读 lastInteractTs 判断用户是否回了）、phone_settings_v3（读 proactiveMsg 总开关）。
不删任何现有功能；不连真实账号；不索要密码/API Key；不引入外链；C 档一项没碰。
═════════════════════════════════════════════════════════════════ */
(function () {
var CFG_KEY = 'char_proactive_cfg_v1';
var STATE_KEY = 'char_proactive_state_v1';
var QUIET_KEY = 'char_quiet_v1';
var SCHED_KEY = 'phone_schedule_v1';
var MEM_KEY = 'guichao.memories.v1';
var INNER_STATE_KEY = 'char_inner_state_v1';
var MIN = 60000, HOUR = 3600000, DAY = 86400000;
var LADDER_HOURS = [4, 10, 24, 48];
var PRI_LABEL = { urgent: '紧急', daily: '日常', creative: '创意' };
var STATE_LABEL = { ENGAGED: '在线聊天中', IDLE: '白天待机', DORMANT: '深夜休息', DREAM: '正在做梦' };
var STATE_COLOR = { ENGAGED: '#34C759', IDLE: '#FF9500', DORMANT: '#8E8E93', DREAM: '#AF52DE' };
var HONEST = '诚实说明：本机是模板模式（Simple）——没有接真实大模型。角色的回复由本机模板加上你注入的记忆拼出来，会从文字里猜情绪，不是真模型在思考；主动找你的每一条消息都有真实理由（承诺、日程或记忆），没有理由就不发。';

function read(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function clamp(v, lo, hi, fb) { v = Number(v); if (!isFinite(v)) return fb; return Math.max(lo, Math.min(hi, v)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function toMin(s) { var p = String(s || '0:0').split(':'); return ((+p[0] || 0) * 60 + (+p[1] || 0)); }
function fmtHM(ts) { var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

// ── 配置 char_proactive_cfg_v1 ──
function defaultCfg() {
  return { heartbeatMode: 'fixed', heartbeatMinutes: 30, awayMode: 'taper', muted: false, maxPerHour: 2, ladderEnabled: true, longingEnabled: true, closeness: 0.5 };
}
function getCfg() {
  var c = read(CFG_KEY, null), d = defaultCfg();
  if (!c || typeof c !== 'object') return d;
  if (c.heartbeatMode === 'fixed' || c.heartbeatMode === 'random') d.heartbeatMode = c.heartbeatMode;
  d.heartbeatMinutes = clamp(c.heartbeatMinutes, 5, 120, 30);
  if (c.awayMode === 'always' || c.awayMode === 'taper' || c.awayMode === 'once') d.awayMode = c.awayMode;
  if (typeof c.muted === 'boolean') d.muted = c.muted;
  d.maxPerHour = clamp(c.maxPerHour, 1, 6, 2);
  if (typeof c.ladderEnabled === 'boolean') d.ladderEnabled = c.ladderEnabled;
  if (typeof c.longingEnabled === 'boolean') d.longingEnabled = c.longingEnabled;
  d.closeness = clamp(c.closeness, 0, 1, 0.5);
  return d;
}
function setCfg(patch) {
  var c = getCfg();
  if (!patch || typeof patch !== 'object') return c;
  if (patch.heartbeatMode === 'fixed' || patch.heartbeatMode === 'random') c.heartbeatMode = patch.heartbeatMode;
  if (patch.heartbeatMinutes != null) c.heartbeatMinutes = clamp(patch.heartbeatMinutes, 5, 120, 30);
  if (patch.awayMode === 'always' || patch.awayMode === 'taper' || patch.awayMode === 'once') c.awayMode = patch.awayMode;
  if (typeof patch.muted === 'boolean') c.muted = patch.muted;
  if (patch.maxPerHour != null) c.maxPerHour = clamp(patch.maxPerHour, 1, 6, 2);
  if (typeof patch.ladderEnabled === 'boolean') c.ladderEnabled = patch.ladderEnabled;
  if (typeof patch.longingEnabled === 'boolean') c.longingEnabled = patch.longingEnabled;
  if (patch.closeness != null) c.closeness = clamp(patch.closeness, 0, 1, 0.5);
  write(CFG_KEY, c);
  return c;
}

// ── 收敛状态 char_proactive_state_v1（容错读 K2 键，进度只写 .r，顶层字段原样保留）──
function defaultR() {
  return { ladderStep: 0, taperLevel: 0, onceFired: false, onceFiredTs: 0, unanswered: 0, lastProactiveTs: 0, nextHeartbeatTs: 0, longingNextTs: 0, lastSeenInteractTs: 0, lastSentKey: '', lastSentTs: 0, sentTs: [] };
}
function readState() {
  var st = read(STATE_KEY, null);
  if (!st || typeof st !== 'object') st = {};
  if (!st.r || typeof st.r !== 'object') st.r = {};
  var d = defaultR(), r = st.r;
  Object.keys(d).forEach(function (k) { if (r[k] === undefined) r[k] = d[k]; });
  if (!Array.isArray(r.sentTs)) r.sentTs = [];
  return st;
}
function writeState(st) { write(STATE_KEY, st); return st; }

// ── 免打扰/每日上限：唯一真相是 char_quiet_v1；键不存在时有效默认 23:00-08:00（Pulse 默认）──
function getQuietMerged() {
  var hasKey = false;
  try { hasKey = localStorage.getItem(QUIET_KEY) != null; } catch (e) {}
  if (hasKey && window.CharInnerLife && window.CharInnerLife.getQuiet) {
    try { return window.CharInnerLife.getQuiet(); } catch (e) {}
  }
  var q = read(QUIET_KEY, null);
  if (q && typeof q === 'object') {
    return { dailyCap: typeof q.dailyCap === 'number' ? q.dailyCap : 3, quietStart: q.quietStart || '23:00', quietEnd: q.quietEnd || '08:00', sent: q.sent || {} };
  }
  return { dailyCap: 3, quietStart: '23:00', quietEnd: '08:00', sent: {} };
}
function inQuiet(now, q) {
  var m = now.getHours() * 60 + now.getMinutes();
  var qs = toMin(q.quietStart), qe = toMin(q.quietEnd);
  if (qs === qe) return false;
  return qs < qe ? (m >= qs && m < qe) : (m >= qs || m < qe);
}

// ── 心跳间隔：固定 = 设定分钟数；随机 = 20-45 分钟均匀抽取 ──
function nextHeartbeatMs(cfg, randFn) {
  cfg = cfg || getCfg();
  if (cfg.heartbeatMode === 'random') {
    var r = (randFn || Math.random)();
    if (!isFinite(r)) r = 0.5;
    r = Math.max(0, Math.min(0.999999, r));
    return (20 + r * 25) * MIN;
  }
  return cfg.heartbeatMinutes * MIN;
}
// ── 离场 taper：30 分钟起步，每次无人应答翻倍，封顶 16 倍（8 小时），且不超过 24 小时 ──
function taperDelayMs(level) {
  var mult = Math.pow(2, Math.max(0, level | 0));
  if (mult > 16) mult = 16;
  return Math.min(30 * MIN * mult, 24 * HOUR);
}
// ── 自发阶梯：沉默满 4/10/24/48 小时各一档，共 4 条 ──
function ladderStepFor(silenceMs) {
  var n = 0;
  LADDER_HOURS.forEach(function (h) { if (silenceMs >= h * HOUR) n++; });
  return n;
}
// ── 思念模型：亲近度越高、沉默越久，平均等待越短；等待时间按泊松（指数分布）抽取 ──
function longingMeanMs(closeness, silenceMs) {
  var c = clamp(closeness, 0, 1, 0.5);
  var meanMin = 360 * (1.2 - 0.7 * c) / (1 + Math.max(0, silenceMs || 0) / (12 * HOUR));
  return clamp(meanMin, 30, 720, 360) * MIN;
}
function poissonWaitMs(meanMs, rand) {
  var r = rand;
  if (!isFinite(r)) r = 0.5;
  r = Math.max(0, Math.min(0.999999, r));
  return -Math.log(1 - r) * meanMs;
}
function longingNextTs(nowMs, closeness, silenceMs, randFn) {
  var r = (randFn || Math.random)();
  return nowMs + poissonWaitMs(longingMeanMs(closeness, silenceMs), r);
}

// ── 用户最后互动时间：O 组 char_inner_state_v1、K2 的 lastUserTs、char_humanize_v1 三处取最晚 ──
function lastInteractTs() {
  var t = 0;
  try {
    var key = (window.CharInnerLife && window.CharInnerLife._keys && window.CharInnerLife._keys.state) || INNER_STATE_KEY;
    var st = read(key, null);
    if (st && st.lastInteractTs) t = Math.max(t, st.lastInteractTs);
  } catch (e) {}
  try {
    var s = read(STATE_KEY, null);
    if (s && s.lastUserTs) t = Math.max(t, s.lastUserTs);
    if (s && s.lastUserReplyTs) t = Math.max(t, s.lastUserReplyTs);
    if (s && s.lastInteractTs) t = Math.max(t, s.lastInteractTs);
  } catch (e) {}
  try {
    var hum = read('char_humanize_v1', null);
    if (hum && hum.lastUserTs) t = Math.max(t, hum.lastUserTs);
  } catch (e) {}
  return t || 0;
}
// ── 亲近度：优先 K2 已有的好感 otome_affection_v1（经 CharK.affectionValue，0-100 归一化），没有就用配置后备值 ──
function getCloseness(cfg) {
  try {
    if (window.CharK && window.CharK.affectionValue) {
      var name = '夏油杰';
      try { if (typeof MemoryCore !== 'undefined' && MemoryCore.world) name = MemoryCore.world.get('activeChar') || name; } catch (e) {}
      var store = read('otome_affection_v1', null);
      var hasRec = !!(store && (store[name] || typeof store.value === 'number'));
      if (hasRec) {
        var v = window.CharK.affectionValue(name);
        if (typeof v === 'number' && isFinite(v)) return clamp(v / 100, 0, 1, 0.5);
      }
    }
  } catch (e) {}
  return (cfg && typeof cfg.closeness === 'number') ? cfg.closeness : 0.5;
}
function noteUserReply(ts) {
  var st = readState();
  st.r.ladderStep = 0; st.r.taperLevel = 0; st.r.onceFired = false; st.r.onceFiredTs = 0;
  st.r.unanswered = 0; st.r.longingNextTs = 0;
  st.r.lastSeenInteractTs = ts || Date.now();
  writeState(st);
  return true;
}
function syncFromInteraction(nowMs) {
  var li = lastInteractTs();
  if (!li) return false;
  var st = readState();
  if (li <= (st.r.lastSeenInteractTs || 0)) return false;
  // 只有晚于上一条主动消息的互动才算“回了”；更早的互动只是第一次见到旧时间戳，只记下来，不清零
  if (li > (st.r.lastProactiveTs || 0)) { noteUserReply(li); return true; }
  st.r.lastSeenInteractTs = li;
  writeState(st);
  return false;
}

// ── 理由：到期承诺 / 日程 / 值得回忆的记忆；三者皆无就返回 null（无理由不发）──
function schedTodayMs(dateStr, timeStr) {
  if (!timeStr) return null;
  var p = String(timeStr).split(':');
  var d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
  return d.getTime();
}
function pickReason(now) {
  var nowMs = now.getTime(), today = todayStr(now);
  var sched = read(SCHED_KEY, []);
  if (!Array.isArray(sched)) sched = [];
  var priRank = function (x) { return x === 'urgent' ? 0 : x === 'creative' ? 2 : 1; };
  // 0) K2 特殊日期/日程到期提醒（今天或明天，CharK.dueReminders 已含去重）
  try {
    if (window.CharK && window.CharK.dueReminders) {
      var due = window.CharK.dueReminders(nowMs) || [];
      if (due.length) return { kind: 'special_date', key: due[0].key, text: due[0].text, ref: '特殊日期/日程到期 · ' + (due[0].when || '') };
    }
  } catch (e) {}
  // 1) 紧急日程：今天、未完成、两小时内到点
  var urgent = sched.filter(function (it) {
    return it && !it.done && it.date === today && (it.priority || 'daily') === 'urgent';
  }).sort(function (a, b) { return (schedTodayMs(a.date, a.time) || 0) - (schedTodayMs(b.date, b.time) || 0); });
  for (var i = 0; i < urgent.length; i++) {
    var t = schedTodayMs(urgent[i].date, urgent[i].time);
    if (t != null && t >= nowMs - 30 * MIN && t <= nowMs + 2 * HOUR) {
      return { kind: 'schedule', key: 'schedule:' + urgent[i].id, text: urgent[i].title, ref: urgent[i].date + ' ' + (urgent[i].time || '') + ' · 紧急' };
    }
  }
  // 2) 到期承诺：24 小时内到期、未提醒过；显式标紧急的优先，再按到期时间
  try {
    if (window.CharInnerLife && window.CharInnerLife.getPromises) {
      var open = window.CharInnerLife.getPromises().filter(function (p) {
        return p && p.status === 'open' && !p.reminded && (p.dueTs - nowMs) <= 24 * HOUR;
      }).sort(function (a, b) { return (priRank(a.priority) - priRank(b.priority)) || (a.dueTs - b.dueTs); });
      if (open.length) {
        return { kind: 'promise', key: 'promise:' + open[0].id, text: open[0].text, ref: '承诺到期 ' + fmtHM(open[0].dueTs) + (open[0].priority === 'urgent' ? ' · 紧急' : '') };
      }
    }
  } catch (e) {}
  // 3) 今天的日程（未完成，紧急优先，再按时间）
  var todays = sched.filter(function (it) { return it && !it.done && it.date === today; })
    .sort(function (a, b) { return (priRank(a.priority || 'daily') - priRank(b.priority || 'daily')) || ((schedTodayMs(a.date, a.time) || 0) - (schedTodayMs(b.date, b.time) || 0)); });
  if (todays.length) {
    return { kind: 'schedule', key: 'schedule:' + todays[0].id, text: todays[0].title, ref: todays[0].date + ' ' + (todays[0].time || '') + ' · ' + (PRI_LABEL[todays[0].priority || 'daily'] || '日常') };
  }
  // 3.5) K2 的 8 小时念叨：沉默满 8 小时、今天还没念叨过（理由是“你很久没出现”）
  try {
    if (window.CharK && window.CharK.shouldNudge && window.CharK.shouldNudge(nowMs)) {
      var nt = (window.CharK.nudgeText ? window.CharK.nudgeText(nowMs) : '想你了。');
      return { kind: 'nudge', key: 'nudge:' + today, text: nt, ref: '沉默满 8 小时 · K2 念叨' };
    }
  } catch (e) {}
  // 4) 值得回忆的记忆：归巢里最近 30 天的一条记忆
  try {
    var raw = read(MEM_KEY, null), arr = null;
    if (Array.isArray(raw)) arr = raw;
    else if (raw && Array.isArray(raw.list)) arr = raw.list;
    else if (raw && Array.isArray(raw.items)) arr = raw.items;
    else if (raw && Array.isArray(raw.memories)) arr = raw.memories;
    if (arr && arr.length) {
      var mems = arr.map(function (m) {
        var ts = m.createdAt || m.updatedAt || m.time || 0;
        if (typeof m.date === 'string' && !ts) { var dd = new Date(m.date); if (!isNaN(dd.getTime())) ts = dd.getTime(); }
        return { id: m.id || '', title: m.title || m.text || m.content || '', text: m.content || m.text || m.title || '', ts: ts || 0 };
      }).filter(function (m) { return m.title && m.ts && (nowMs - m.ts) <= 30 * DAY; })
        .sort(function (a, b) { return b.ts - a.ts; });
      if (mems.length) {
        return { kind: 'memory', key: 'memory:' + (mems[0].id || mems[0].title), text: mems[0].title, ref: '归巢记忆 · ' + todayStr(new Date(mems[0].ts)) };
      }
    }
  } catch (e) {}
  return null;
}
// ── 三段节流门（粘性静音最先；速率 → 可达性 → 心跳/离场/阶梯 → 信息增益 → 思念）──
function gateForTrigger(now, opts) {
  now = now || new Date();
  opts = opts || {};
  var randFn = opts.randFn || Math.random;
  var nowMs = now.getTime();
  var cfg = getCfg();
  var fail = function (reason) { return { ok: false, reason: reason, cfg: cfg }; };
  if (cfg.muted) return fail('muted');
  try { if (window.GroupAZ && !window.GroupAZ.behaviorEnabled('wechat')) return fail('az_wechat_off'); } catch (e) {}
  try {
    var ps = read('phone_settings_v3', null);
    if (!ps || ps.proactiveMsg !== true) return fail('proactive_off');
  } catch (e) { return fail('proactive_off'); }
  try { syncFromInteraction(nowMs); } catch (e) {}
  var st = readState(), r = st.r;
  // 速率段：O 组每日上限先算（cap 归速率段），其余原因留给可达性段
  try {
    if (window.CharInnerLife && window.CharInnerLife.canSendProactive) {
      var og = window.CharInnerLife.canSendProactive(now);
      if (!og.ok) {
        if (og.reason === 'cap') return fail('cap');
        if (og.reason === 'hands_off') return fail('hands_off');
      }
    }
  } catch (e) {}
  // K2 收敛门也在这里会诊（连续 2 次未回就停、每天最多 3 条、冷却中不发）；引擎里它还会再算一次，结果一致
  try {
    if (window.CharK && window.CharK.proactiveGate) {
      var kg = window.CharK.proactiveGate(nowMs);
      if (!kg.allowed) return fail('k2:' + (kg.reason || 'backoff'));
    }
  } catch (e) {}
  var hourAgo = nowMs - HOUR;
  r.sentTs = (r.sentTs || []).filter(function (t) { return t > nowMs - DAY; });
  var inLastHour = r.sentTs.filter(function (t) { return t > hourAgo; }).length;
  if (inLastHour >= cfg.maxPerHour) return fail('rate');
  // 可达性段：免打扰（与 char_quiet_v1 共用同一个值）/ 用户正在聊天
  if (inQuiet(now, getQuietMerged())) return fail('quiet');
  var li = lastInteractTs();
  if (li && (nowMs - li) < 5 * MIN) return fail('user_active');
  // 心跳到期：没到下次心跳时间就不发
  if (r.nextHeartbeatTs && nowMs < r.nextHeartbeatTs) return fail('heartbeat_wait');
  // 离场模式：只在上一条主动消息无人应答时才起作用
  var silenceMs = li ? (nowMs - li) : (r.lastProactiveTs ? (nowMs - r.lastProactiveTs) : 0);
  if (r.unanswered > 0) {
    if (cfg.awayMode === 'taper') {
      if (nowMs < r.lastProactiveTs + taperDelayMs(r.taperLevel)) return fail('taper_wait');
    } else if (cfg.awayMode === 'once') {
      if (r.onceFired) return fail('once_done');
    }
  }
  // 自发阶梯：4 条发完就安静，等用户回消息才清零
  if (cfg.ladderEnabled && r.ladderStep >= 4) return fail('ladder_done');
  // 信息增益段：没有理由就不发；记忆类理由 24 小时内不重复（承诺/日程以到期时间为新鲜度，不拦）
  var reason = pickReason(now);
  if (!reason) return fail('no_reason');
  if (reason.kind === 'memory' && reason.key === r.lastSentKey && (nowMs - r.lastSentTs) < DAY) return fail('no_gain');
  // 思念模型：只约束记忆类自发消息；承诺/日程类是到点必须提醒，bypass
  if (cfg.longingEnabled && reason.kind === 'memory' && r.longingNextTs && nowMs < r.longingNextTs) return fail('longing_wait');
  return { ok: true, reason: reason, cfg: cfg };
}
function recordSent(type, text, reason) {
  var nowMs = Date.now(), cfg = getCfg(), st = readState(), r = st.r;
  reason = reason || { kind: 'event', key: 'event:' + String(type || 'proactive'), text: String(type || '主动消息'), ref: '' };
  var li = lastInteractTs();
  var silenceMs = li ? (nowMs - li) : (r.lastProactiveTs ? (nowMs - r.lastProactiveTs) : 0);
  r.sentTs = (r.sentTs || []).filter(function (t) { return t > nowMs - DAY; });
  r.sentTs.push(nowMs);
  if (r.sentTs.length > 50) r.sentTs = r.sentTs.slice(-50);
  r.lastProactiveTs = nowMs;
  r.unanswered = (r.unanswered || 0) + 1;
  r.nextHeartbeatTs = nowMs + nextHeartbeatMs(cfg);
  if (cfg.longingEnabled) r.longingNextTs = longingNextTs(nowMs, getCloseness(cfg), silenceMs);
  if (cfg.ladderEnabled && r.ladderStep < 4 && silenceMs >= LADDER_HOURS[r.ladderStep] * HOUR) r.ladderStep++;
  if (cfg.awayMode === 'taper') r.taperLevel = Math.min((r.taperLevel || 0) + 1, 10);
  if (cfg.awayMode === 'once') { r.onceFired = true; r.onceFiredTs = nowMs; }
  r.lastSentKey = reason.key || '';
  r.lastSentTs = nowMs;
  writeState(st);
  try {
    if (window.CharInnerLife && window.CharInnerLife.logCycle) {
      window.CharInnerLife.logCycle({
        sense: '主动联系的理由：' + (reason.text || ''),
        appraise: '节流门放行（理由是' + (reason.kind === 'promise' ? '承诺到期' : reason.kind === 'schedule' ? '日程到点' : reason.kind === 'memory' ? '值得回忆的记忆' : reason.kind === 'special_date' ? '特殊日期到期' : reason.kind === 'nudge' ? '你很久没出现' : '事件') + '，不是没话找话）',
        decide: '发一条微信给你',
        act: '发微信：' + String(text || '').slice(0, 40),
        reflect: '已经发出去了，等你回我',
        trigger: 'groupR:' + (reason.kind || ''),
        memoryRef: '理由：' + (reason.text || '') + '（' + (reason.ref || reason.key || '') + '）'
      });
    }
  } catch (e) {}
  return r;
}

// ── A2 Lantern 状态灯：状态 + 未完的线头（未兑现承诺 + 未读消息）──
function currentState(now) {
  now = now || new Date();
  try {
    if (window.CharInnerLife && window.CharInnerLife.currentState) return window.CharInnerLife.currentState(now);
  } catch (e) {}
  var li = lastInteractTs(), h = now.getHours();
  if (li && (now.getTime() - li) < 5 * MIN) return 'ENGAGED';
  if (h >= 23 || h < 6) return 'DORMANT';
  return 'IDLE';
}
function openThreads() {
  var promises = 0, unread = 0;
  try {
    if (window.CharInnerLife && window.CharInnerLife.getPromises) {
      promises = window.CharInnerLife.getPromises().filter(function (p) { return p && p.status === 'open'; }).length;
    }
  } catch (e) {}
  try {
    var store = (typeof AppRegistry !== 'undefined' && AppRegistry.wechat) ? AppRegistry.wechat.wxStore : null;
    (store && store.sessions || []).forEach(function (s) { unread += (s.unread || 0); });
  } catch (e) {}
  return { promises: promises, unread: unread, total: promises + unread };
}
function lanternInner(now) {
  var st = currentState(now || new Date()), th = openThreads();
  return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + STATE_COLOR[st] + ';margin-right:6px;vertical-align:1px;"></span>'
    + '<span style="font-weight:700;">' + esc(st) + ' · ' + esc(STATE_LABEL[st] || st) + '</span>'
    + '<span style="color:#8E8E93;"> · 未完 ' + th.total + ' 条（承诺 ' + th.promises + ' · 未读 ' + th.unread + '）</span>';
}
function lanternHTML(now) {
  return '<div class="groupr-lantern" data-groupr-lantern="1" style="font-size:12px;color:#3A3A3C;line-height:1.5;padding:8px 12px;">' + lanternInner(now) + '</div>';
}
function renderLanternIntoDesktop() {
  try {
    var el = document.getElementById('groupr-lantern');
    if (el) el.innerHTML = lanternInner(new Date());
  } catch (e) {}
  return true;
}

// ── A36 口述门控：只有浏览器支持语音识别且页面是 HTTPS/localhost/file 时才出现 ──
function dictationAvailable() {
  var SR = null;
  try { SR = window.SpeechRecognition || window.webkitSpeechRecognition; } catch (e) {}
  if (!SR) return false;
  var proto = '', host = '';
  try { proto = location.protocol; host = location.hostname; } catch (e) {}
  return proto === 'https:' || proto === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
function applyDictationGate() {
  var ok = dictationAvailable();
  try {
    var els = document.querySelectorAll('[data-groupr-dictation]');
    for (var i = 0; i < els.length; i++) els[i].style.display = ok ? '' : 'none';
  } catch (e) {}
  return ok;
}

// ── A8 承诺优先级：只给 char_promises_v1 的条目加一个可选 priority 字段 ──
function setPromisePriority(id, pri) {
  try {
    if (!window.CharInnerLife || !window.CharInnerLife.getPromises) return false;
    var key = (window.CharInnerLife._keys && window.CharInnerLife._keys.promises) || 'char_promises_v1';
    var list = window.CharInnerLife.getPromises(), hit = false;
    list.forEach(function (p) {
      if (p && p.id === id) {
        if (pri === 'urgent' || pri === 'daily' || pri === 'creative') p.priority = pri;
        else delete p.priority;
        hit = true;
      }
    });
    if (hit) write(key, list);
    return hit;
  } catch (e) { return false; }
}

// ── 设置页「主动消息」+ 关于页（A19/A35 诚实标注）──
function statusLine(now) {
  now = now || new Date();
  var cfg = getCfg(), q = getQuietMerged(), st = readState(), r = st.r;
  var sent = (q.sent && q.sent[todayStr(now)]) || 0;
  var next = r.nextHeartbeatTs ? ('下次心跳约 ' + fmtHM(r.nextHeartbeatTs)) : '心跳待触发（下次到点就检查）';
  var parts = ['今天已发 ' + sent + ' / ' + q.dailyCap + ' 条', '免打扰 ' + q.quietStart + '–' + q.quietEnd, next,
    '自发阶梯 ' + r.ladderStep + '/4 条', '离场 ' + cfg.awayMode + (cfg.awayMode === 'taper' ? '（第 ' + r.taperLevel + ' 级，下次间隔 ' + Math.round(taperDelayMs(r.taperLevel) / MIN) + ' 分钟）' : '')];
  if (cfg.muted) parts.push('已静音（粘性，重启后仍有效，需手动恢复）');
  return parts.join(' · ');
}
function renderSettingsSub(act) {
  if (act === 'aboutPhone') {
    return '<div class="st-sub" id="st-sub-aboutPhone">'
      + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div><div class="st-sub-title">关于本机</div></div>'
      + '<div class="st-bigtitle" style="padding-top:4px;">关于本机</div>'
      + '<div class="st-group"><div class="st-row" style="display:block;padding:14px;line-height:1.7;font-size:14px;">'
      + '<div style="font-weight:700;margin-bottom:6px;">小未来的手机 · 本地模拟手机</div>'
      + '<div id="groupr-honest-about">' + esc(HONEST) + '</div>' + '<div style="margin-top:10px;color:#8E8E93;font-size:13px;line-height:1.7;" id="aq-about-credits">图标与许可（AQ 组精选字典，只借做法、未复制任何项目代码、未下载图标文件）：Tabler（MIT）· Phosphor（MIT）· Fluent（MIT）· Lucide（ISC）· IconPark（Apache-2.0）· OpenMoji 图形（CC BY-SA 4.0）—— All emojis designed by OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0。桌面 app 图标（GROUP-FIX2）：取自 AQ 精选字典逐个内联的 SVG（字形来源以 Tabler MIT 为主，Phosphor MIT / Lucide ISC 为备选，见 AQ 组 SOURCES），无 CDN、无整包下载；桌宠像素皮肤取自 desksprite（MIT，github.com/welltilln/desksprite）；玻璃风格为本机纯 CSS 复现，无真折射。</div>'
      + '<div style="margin-top:8px;color:#8E8E93;font-size:13px;">日历小组件：月历网格算法与“点日期 → 弹窗增删改查”流程借鉴 tchung1970/calendar（MIT，Copyright © 2025 Thomas Chung，github.com/tchung1970/calendar），样式、中文界面与存储本地重写；弹书小屋：立体书折叠思路借鉴 Dksie09/unfold（MIT，github.com/Dksie09/unfold），未复制其代码。两处均为借鉴做法、本地重写。</div>'
      + '<div style="margin-top:8px;color:#8E8E93;font-size:13px;">模式：模板模式（Simple）。没有接真实大模型，没有连任何账号；全部数据只存在本机 localStorage 里。想接真实模型是另一个决定，需要你自己在设置里填接口，本机不会替你去要密码或 Key。</div>' + '<div style="margin-top:8px;color:#8E8E93;font-size:13px;">设计与样式参考 Sui 的 Internal Beyond（github.com/Sui-IB/InternalBeyond），PolyForm Noncommercial 1.0.0 / CC BY-NC-SA 4.0，已按本项目修改。Copyright © 2025–2026 Sui. Internal Beyond (https://github.com/Sui-IB/InternalBeyond)。仅个人非商业使用；公开分享改编部分时按 CC BY-NC-SA 4.0 相同方式共享。</div>'
      + '</div></div>'
      + '<div class="st-foot">微信 / 此刻 / 归巢里的角色都是机内模拟，不是真人，也不是真模型。</div>' /* GROUP-FIX7：删日程 */
      + '</div>';
  }
  if (act !== 'proactive') return '';
  var cfg = getCfg(), q = getQuietMerged();
  var sel = function (cur, val) { return cur === val ? ' selected' : ''; };
  var promRows = '';
  try {
    if (window.CharInnerLife && window.CharInnerLife.getPromises) {
      var open = window.CharInnerLife.getPromises().filter(function (p) { return p && p.status === 'open'; });
      promRows = open.length ? open.map(function (p) {
        var pr = p.priority || 'daily';
        return '<div class="st-row" style="display:block;padding:12px 14px;"><div style="font-size:14px;line-height:1.5;">' + esc(p.text) + '</div>'
          + '<div style="margin-top:8px;font-size:13px;color:#8E8E93;">优先级 <select data-groupr-pri="' + esc(p.id) + '" style="border:1px solid #E5E5EA;border-radius:8px;padding:5px 8px;font-size:14px;">'
          + '<option value="urgent"' + sel(pr, 'urgent') + '>紧急</option><option value="daily"' + sel(pr, 'daily') + '>日常</option><option value="creative"' + sel(pr, 'creative') + '>创意</option></select>'
          + ' · 到期 ' + esc(fmtHM(p.dueTs)) + '</div></div>';
      }).join('') : '<div class="st-row" style="padding:14px;">暂无进行中的承诺。</div>';
    }
  } catch (e) { promRows = '<div class="st-row" style="padding:14px;">承诺清单暂不可读。</div>'; }
  return '<div class="st-sub" id="st-sub-proactive">'
    + '<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div><div class="st-sub-title">主动消息</div></div>'
    + '<div class="st-bigtitle" style="padding-top:4px;">主动消息</div>'
    + '<div class="st-foot" style="margin:0 16px 8px;" id="groupr-honest">' + esc(HONEST) + '</div>'
    + '<div class="st-group">'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">心跳间隔</span><div class="st-row-right"><select id="gr-heartbeat-mode" style="border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"><option value="fixed"' + sel(cfg.heartbeatMode, 'fixed') + '>固定</option><option value="random"' + sel(cfg.heartbeatMode, 'random') + '>随机 20–45 分钟</option></select></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">固定间隔（分钟）</span><div class="st-row-right"><input id="gr-heartbeat-minutes" type="number" min="5" max="120" value="' + cfg.heartbeatMinutes + '" style="width:72px;text-align:right;border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">离场模式</span><div class="st-row-right"><select id="gr-away-mode" style="border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"><option value="always"' + sel(cfg.awayMode, 'always') + '>每次到点都发</option><option value="taper"' + sel(cfg.awayMode, 'taper') + '>渐渐少发（翻倍）</option><option value="once"' + sel(cfg.awayMode, 'once') + '>安静后只跳一次</option></select></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">每小时最多几条</span><div class="st-row-right"><input id="gr-max-per-hour" type="number" min="1" max="6" value="' + cfg.maxPerHour + '" style="width:72px;text-align:right;border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">免打扰开始</span><div class="st-row-right"><input id="gr-quiet-start" type="time" value="' + esc(q.quietStart) + '" style="border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">免打扰结束</span><div class="st-row-right"><input id="gr-quiet-end" type="time" value="' + esc(q.quietEnd) + '" style="border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"></div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">每日主动消息上限</span><div class="st-row-right"><input id="gr-daily-cap" type="number" min="0" max="20" value="' + q.dailyCap + '" style="width:72px;text-align:right;border:1px solid #E5E5EA;border-radius:8px;padding:6px 8px;font-size:15px;"> 条</div></div>'
    + '<div class="st-row" style="padding:12px 14px;"><span class="st-label">粘性静音（停掉全部主动消息）</span><div class="st-row-right"><input id="gr-muted" type="checkbox"' + (cfg.muted ? ' checked' : '') + ' style="width:22px;height:22px;"></div></div>'
    + '</div>'
    + '<div class="st-foot" id="groupr-status">' + esc(statusLine(new Date())) + '</div>'
    + '<div style="margin:12px 16px;"><button id="groupr-proactive-save" style="width:100%;border:0;background:#007AFF;color:#fff;border-radius:12px;padding:12px;font-size:16px;">保存（立即生效）</button>'
    + '<div id="groupr-tip" style="text-align:center;font-size:13px;color:#34C759;margin-top:8px;min-height:18px;"></div></div>'
    + '<div class="st-foot">离场“渐渐少发”：无人应答时间隔翻倍，30 分钟 → 1 小时 → 2 小时 → 4 小时……最多 16 倍，不超过 24 小时；你一回消息就清零。自发阶梯：沉默满 4 / 10 / 24 / 48 小时各发一条，共 4 条，最后一条是表示理解的便条，然后安静；免打扰时段内不发。</div>'
    + '<div class="st-bigtitle" style="font-size:18px;padding-top:8px;">承诺优先级</div>'
    + '<div class="st-foot" style="margin:0 16px 8px;">标“紧急”的到期承诺会优先提醒；改完点上面“保存”一起生效。</div>'
    + '<div class="st-group">' + promRows + '</div>'
    + '<div style="height:40px;"></div></div>';
}
function saveProactiveForm(sub) {
  var v = function (id) { var el = sub.querySelector('#' + id); return el ? el.value : null; };
  var chk = function (id) { var el = sub.querySelector('#' + id); return el ? !!el.checked : false; };
  var cfg = setCfg({
    heartbeatMode: v('gr-heartbeat-mode'),
    heartbeatMinutes: parseInt(v('gr-heartbeat-minutes'), 10),
    awayMode: v('gr-away-mode'),
    maxPerHour: parseInt(v('gr-max-per-hour'), 10),
    muted: chk('gr-muted')
  });
  var quiet = null;
  try {
    if (window.CharInnerLife && window.CharInnerLife.setQuiet) {
      quiet = window.CharInnerLife.setQuiet({ dailyCap: parseInt(v('gr-daily-cap'), 10), quietStart: v('gr-quiet-start') || '23:00', quietEnd: v('gr-quiet-end') || '08:00' });
    }
  } catch (e) {}
  try {
    var sels = sub.querySelectorAll('[data-groupr-pri]');
    for (var i = 0; i < sels.length; i++) setPromisePriority(sels[i].getAttribute('data-groupr-pri'), sels[i].value);
  } catch (e) {}
  var q = quiet || getQuietMerged();
  var summary = '已保存：心跳' + (cfg.heartbeatMode === 'random' ? '随机 20–45 分钟' : '固定 ' + cfg.heartbeatMinutes + ' 分钟')
    + ' · 离场' + cfg.awayMode + ' · 每小时最多 ' + cfg.maxPerHour + ' 条 · 每日上限 ' + q.dailyCap + ' 条'
    + ' · 免打扰 ' + q.quietStart + '–' + q.quietEnd + (cfg.muted ? ' · 已静音（粘性）' : ' · 未静音') + '。';
  return { summary: summary, cfg: cfg, quiet: q };
}

// ── 启动：口述门控 + 桌面 Lantern + 此刻页顶部 Lantern（包一层 O 组渲染，不改它）──
function init() {
  try { applyDictationGate(); } catch (e) {}
  try {
    renderLanternIntoDesktop();
    setInterval(renderLanternIntoDesktop, 30000);
  } catch (e) {}
  // 口述 tile 是微信运行时渲染的模板，不是静态 DOM：监听 DOM 变化，出现就按支持情况显示/隐藏
  try {
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var _mo = new MutationObserver(function () { try { applyDictationGate(); } catch (e2) {} });
      _mo.observe(document.body, { childList: true, subtree: true });
    }
  } catch (e) {}
  try {
    if (window.CharInnerLife && window.CharInnerLife.renderInnerHTML && !window.CharInnerLife.__groupRWrapped) {
      var orig = window.CharInnerLife.renderInnerHTML;
      window.CharInnerLife.renderInnerHTML = function () { return lanternHTML(new Date()) + orig.apply(window.CharInnerLife, arguments); };
      window.CharInnerLife.__groupRWrapped = true;
    }
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.GroupR = {
  getCfg: getCfg, setCfg: setCfg,
  nextHeartbeatMs: nextHeartbeatMs, taperDelayMs: taperDelayMs,
  LADDER_HOURS: LADDER_HOURS, ladderStepFor: ladderStepFor,
  poissonWaitMs: poissonWaitMs, longingMeanMs: longingMeanMs, longingNextTs: longingNextTs,
  inQuiet: inQuiet, getQuietMerged: getQuietMerged,
  gateForTrigger: gateForTrigger, pickReason: pickReason, recordSent: recordSent,
  noteUserReply: noteUserReply, syncFromInteraction: syncFromInteraction, lastInteractTs: lastInteractTs, getCloseness: getCloseness,
  currentState: currentState, openThreads: openThreads, lanternHTML: lanternHTML, lanternInner: lanternInner, renderLanternIntoDesktop: renderLanternIntoDesktop,
  dictationAvailable: dictationAvailable, applyDictationGate: applyDictationGate,
  setPromisePriority: setPromisePriority, statusLine: statusLine,
  renderSettingsSub: renderSettingsSub, saveProactiveForm: saveProactiveForm,
  PRI_LABEL: PRI_LABEL, HONEST: HONEST,
  _keys: { cfg: CFG_KEY, state: STATE_KEY, quiet: QUIET_KEY },
  _readState: readState, _writeState: writeState
};
})();

