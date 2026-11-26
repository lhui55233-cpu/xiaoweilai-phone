
/* GROUP-S-SUBJECT  ══════════════════════════════════════════════════════════════
Group S · 主体性内核 CharSubject（调研报告第五节阶段二：A12 + A13 + A16）
出处（只借设计思路，未复制代码）：
- Cyber Companion https://github.com/Xiaoyan43/cyber-companion（MIT）：
  主体性内核（心情向量 + 关系状态向量 + 慢速存在层，三层共同投射
  语气）、立场账本（不满与修复状态在模型之外，确定性转移 + 回复
  门控 + 单元测试保证不塌缩成应声虫）、行为引擎决策表（先决定
  回/沉默/拒绝/嘟囔/打断，再决定说什么）、驾驶舱调试页。
- Pulse https://github.com/elliejayliquid/pulse（MIT）：被动记忆召回
  （关键词 + 重要度 + 新近度近似版，不用向量）、Dev ticks 改写为
  建议箱（char 只提建议、用户批准、char 不写代码不改文件）。
- Hanami https://github.com/Undi95/Hanami（AGPL-3.0，代码一行未拿，
  只借做法）：提示词检查器（模板组装过程全部可见）、时间感注入
  （日期/小时/距上条消息多久，作 plain facts）。
- 记忆生命周期（Cyber Companion）：显著度衰减 → 淡化 → 墓碑 +
  每周反思成印象；小手机版是可选档位，不默认删，原始记忆一律保留。
接已有的好感度/看法/五条内在状态，不另起炉灶：好感度仍读
otome_affection_v1（只读），内心日志仍走 char_inner_log_v1（只读
复用 O 组键，决策记录同时写一份进 O 组日志供“她为什么这么做”页
展示），免打扰时段读 char_quiet_v1（只读）。
新增键见文件头注释。全部逻辑为全新自写，纯函数可单测。
══════════════════════════════════════════════════════════════ */
(function () {
var SUBJ_KEY = 'char_subject_v1';
var STANCE_KEY = 'char_stance_v1';
var SUGG_KEY = 'char_suggestions_v1';
var DEC_KEY = 'char_subject_decisions_v1';
var PROMPT_KEY = 'char_subject_prompt_v1';
var IMPR_KEY = 'char_subject_impressions_v1';
var TIER_KEY = 'char_subject_tiers_v1';
var GC_KEY = 'guichao.memories.v1';
var QUIET_KEY = 'char_quiet_v1';
var AFF_KEY = 'otome_affection_v1';

/* RAW-DIV-BALANCE: renderSettingsSub 的 4 个分支各带一个闭合标签关闭 subHeadS 打开的 .st-sub（运行时每条路径恰好平衡）；静态计数会把 4 条互斥分支都算上，故此处补 4 个仅供静态计数、不渲染的开标签：<div> <div> <div> <div> */
function read(k, fb) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function clamp(v) { v = +v || 0; return v < 0 ? 0 : (v > 100 ? 100 : Math.round(v)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function pad2(n) { return ('0' + n).slice(-2); }

// ── A12 主体性内核 ──
function defaultSubject() {
  return {
    mood: { irritated: 20, worried: 20, lonely: 20, energy: 70, bored: 20, trust: 60 },
    rel: { trust: 60, closeness: 50, familiarity: 40, tension: 20 },
    slow: { moodBaseline: 55, closenessBaseline: 50, updatedDate: todayStr() },
    lastUserTs: 0, lastGapHours: 0, lastUserText: '', userMsgTimes: [], lastOfferDate: '', lastReflectDate: ''
  };
}
function getSubject() {
  var s = read(SUBJ_KEY, null);
  if (!s || !s.mood || !s.rel || !s.slow) { s = defaultSubject(); write(SUBJ_KEY, s); return s; }
  ['irritated', 'worried', 'lonely', 'energy', 'bored', 'trust'].forEach(function (k) { if (typeof s.mood[k] !== 'number') s.mood[k] = defaultSubject().mood[k]; });
  ['trust', 'closeness', 'familiarity', 'tension'].forEach(function (k) { if (typeof s.rel[k] !== 'number') s.rel[k] = defaultSubject().rel[k]; });
  if (typeof s.slow.moodBaseline !== 'number') s.slow.moodBaseline = 55;
  if (typeof s.slow.closenessBaseline !== 'number') s.slow.closenessBaseline = 50;
  if (!Array.isArray(s.userMsgTimes)) s.userMsgTimes = [];
  return s;
}
function saveSubject(s) { write(SUBJ_KEY, s); return s; }

// 纯函数：三层共同投射语气档（微信回复和乙游对话都读它）
// 档位：温柔 / 平淡 / 闹别扭 / 疲惫 / 冷淡 / 开心
function toneFromState(mood, rel, slow, openUntreated) {
  mood = mood || {}; rel = rel || {}; slow = slow || {};
  var irrit = mood.irritated || 0, energy = (mood.energy == null ? 70 : mood.energy);
  var tension = rel.tension || 0, trust = mood.trust || 0, close = rel.closeness || 0;
  if (energy <= 25) return { tone: '疲惫', reason: '精力只剩 ' + energy + '（≤25），先顾着自己喘口气' };
  if (irrit >= 75 || tension >= 75) return { tone: '冷淡', reason: '烦躁 ' + irrit + ' / 紧张 ' + tension + '（≥75），不想热络' };
  if (irrit >= 55 || tension >= 55) return { tone: '闹别扭', reason: '烦躁 ' + irrit + ' / 紧张 ' + tension + '（≥55），还在气头上' };
  if ((openUntreated || 0) > 0) return { tone: '闹别扭', reason: '有 ' + openUntreated + ' 条未处理的不满，语气不立刻变好' };
  if (trust >= 75 && close >= 70 && energy >= 60) return { tone: '开心', reason: '信任 ' + trust + '、亲近 ' + close + '、精力 ' + energy + ' 都高' };
  if (trust >= 65 && close >= 60) return { tone: '温柔', reason: '信任 ' + trust + '、亲近 ' + close + '，慢速基线 ' + (slow.moodBaseline == null ? '—' : slow.moodBaseline) };
  return { tone: '平淡', reason: '没有强烈的情绪信号，按平常的样子回' };
}
function toneLabel() { var s = getSubject(); return toneFromState(s.mood, s.rel, s.slow, openUntreated().length).tone; }
function toneDetail() { var s = getSubject(); return toneFromState(s.mood, s.rel, s.slow, openUntreated().length); }

// 向量按事件小幅漂移（有上下限 0–100）
function drift(patch) {
  var s = getSubject();
  if (patch.mood) Object.keys(patch.mood).forEach(function (k) { if (k in s.mood) s.mood[k] = clamp(s.mood[k] + patch.mood[k]); });
  if (patch.rel) Object.keys(patch.rel).forEach(function (k) { if (k in s.rel) s.rel[k] = clamp(s.rel[k] + patch.rel[k]); });
  saveSubject(s); return s;
}
function noteSilenceDrift(now) {
  var s = getSubject(); now = now || new Date();
  if (!s.lastUserTs) return s;
  var gapH = (now.getTime() - s.lastUserTs) / 3600000;
  if (gapH < 6) return s;
  var steps = Math.min(6, Math.floor(gapH / 6)); // 每 6 小时冷落记一小步，上限 6 步
  if (steps <= 0) return s;
  s.mood.lonely = clamp(s.mood.lonely + 2 * steps);
  s.mood.irritated = clamp(s.mood.irritated + 1 * steps);
  s.rel.closeness = clamp(s.rel.closeness - 1 * steps);
  s._silenceSteps = (s._silenceSteps || 0) + steps;
  saveSubject(s); return s;
}
function slowTick(now) {
  // 慢速存在层：每天只动一点（最多 1），向当日心情均值靠拢
  var s = getSubject(); now = now || new Date();
  var today = todayStr(now);
  if (s.slow.updatedDate === today) return s;
  var target = clamp((s.mood.energy + (100 - s.mood.irritated) + s.mood.trust) / 3);
  var d = target - s.slow.moodBaseline;
  s.slow.moodBaseline = clamp(s.slow.moodBaseline + (d > 0 ? 1 : (d < 0 ? -1 : 0)));
  var targetC = clamp(s.rel.closeness);
  var dc = targetC - s.slow.closenessBaseline;
  s.slow.closenessBaseline = clamp(s.slow.closenessBaseline + (dc > 0 ? 1 : (dc < 0 ? -1 : 0)));
  s.slow.updatedDate = today;
  saveSubject(s); return s;
}

// ── A33 时间感注入（plain facts）──
var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
function timeFacts(now, lastTs) {
  now = now || new Date();
  var gap;
  if (!lastTs) gap = '这是今天第一条消息';
  else {
    var mins = Math.max(0, Math.round((now.getTime() - lastTs) / 60000));
    if (mins < 60) gap = mins + '分钟';
    else if (mins < 1440) gap = Math.floor(mins / 60) + '小时' + (mins % 60 ? (mins % 60) + '分钟' : '');
    else gap = Math.floor(mins / 1440) + '天' + Math.floor((mins % 1440) / 60) + '小时';
  }
  var line = '今天是 ' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日' +
    WEEKDAYS[now.getDay()] + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) +
    '，距你上条消息 ' + gap;
  return { dateStr: now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日', weekday: WEEKDAYS[now.getDay()], hour: now.getHours(), minute: now.getMinutes(), gapText: gap, line: line };
}

// ── A13 立场账本 ──
function getStance() { var v = read(STANCE_KEY, null); if (!v || !Array.isArray(v.items)) { v = { items: [] }; write(STANCE_KEY, v); } return v; }
function saveStance(v) { write(STANCE_KEY, v); return v; }
function openGrievances() { return getStance().items.filter(function (g) { return g.status !== '已修复'; }); }
function openUntreated() { return getStance().items.filter(function (g) { return g.status === '未处理'; }); }
function hasCost(text) { return /请你|请.*吃|补偿|赔你|送你|给你买|请客|陪你去|帮你|我来做|我请|给你做/.test(String(text || '')); }
function isApology(text) { return /对不起|抱歉|是我不好|我错了|原谅我|是我的错/.test(String(text || '')); }
function addGrievance(reason, severity) {
  var v = getStance();
  var g = { id: uid('griev'), reason: String(reason || '没说清楚的不满').slice(0, 60), severity: clamp(severity == null ? 50 : severity), status: '未处理', createdTs: Date.now(), history: [] };
  v.items.push(g); saveStance(v);
  drift({ mood: { irritated: 15, trust: -5 }, rel: { tension: 20, closeness: -5 } });
  return g;
}
function advanceGrievance(g, costDesc) {
  // 确定性转移：有实际代价才推进；未处理 → 已道歉 → 已修复
  if (g.status === '未处理') { g.status = '已道歉'; }
  else if (g.status === '已道歉') { g.status = '已修复'; }
  g.history.push({ ts: Date.now(), cost: costDesc || '' });
  return g;
}
function recordApology(text, hasCostFlag) {
  var v = getStance();
  var open = v.items.filter(function (g) { return g.status !== '已修复'; });
  if (!open.length) return { changed: false, reason: 'no_open', status: null };
  var cost = (hasCostFlag == null) ? hasCost(text) : !!hasCostFlag;
  if (!cost) {
    open.forEach(function (g) { g.history.push({ ts: Date.now(), cost: '', note: '空话道歉（无实际代价），状态不变' }); });
    saveStance(v);
    return { changed: false, reason: 'empty_apology', status: open[0].status };
  }
  open.forEach(function (g) { advanceGrievance(g, String(text || '').slice(0, 40)); });
  saveStance(v);
  drift({ mood: { irritated: -15, trust: 5 }, rel: { tension: -20, closeness: 5 } });
  return { changed: true, reason: 'cost_apology', status: open[0].status };
}
function recordRepair(id, costDesc) {
  var v = getStance();
  var g = null; v.items.forEach(function (x) { if (x.id === id) g = x; });
  if (!g) return { changed: false, reason: 'not_found' };
  if (g.status === '已修复') return { changed: false, reason: 'already_fixed', status: g.status };
  advanceGrievance(g, costDesc || '实际行动补偿');
  saveStance(v);
  drift({ mood: { irritated: -10 }, rel: { tension: -15 } });
  return { changed: true, reason: 'repair', status: g.status };
}

// 用户消息：漂移 + 检测道歉/不满触发（不改消息存储结构）
function noteUserMessage(text, opts) {
  opts = opts || {};
  var s = getSubject();
  var now = Date.now();
  var gapH = s.lastUserTs ? (now - s.lastUserTs) / 3600000 : 0;
  s.lastGapHours = Math.round(gapH * 10) / 10;
  if (gapH >= 6) { // 冷落过再回来：孤独先降一点，烦躁不立刻消
    s.mood.lonely = clamp(s.mood.lonely - 5);
  }
  s.lastUserTs = now; s.lastUserText = String(text || '').slice(0, 120);
  s.userMsgTimes = (s.userMsgTimes || []).concat([now]).slice(-5);
  saveSubject(s);
  drift({ mood: { irritated: -2, lonely: -5, bored: -3 }, rel: { closeness: 3, trust: 1, familiarity: 1 } });
  slowTick(new Date());
  var res = { tone: toneLabel(), grievanceAdded: null, apology: null };
  if (isApology(text)) res.apology = recordApology(text);
  if (/你忘了|失约|骗我|不在乎|又不回|根本不|说话不算/.test(String(text || ''))) {
    res.grievanceAdded = addGrievance('用户提到：' + String(text).slice(0, 20), 60);
  }
  return res;
}

// ── A16 行为引擎决策表 ──
// K2 组核查（2026-11-26，grep 本文件）：cike_char_day_v1 只出现在 O 组
// 注释里，本文件没有已读不回反应、深夜语气、被冷落收敛的现成代码可
// 复用——下面这张表是 S 组从头实现的，收进了这三类行为（R6/R8/R9）。
// 决策表（按顺序查，第一条命中即出动作；先决定动作，再决定说什么）：
//  R1 urgent → reply（救命/危险/难受/出事，压过免打扰与立场门控）
//  R2 dnd → silence（免打扰时段，非紧急不回）
//  R3 untreated && severity>=60 → refuse（可以连着几轮生气）
//  R4 untreated && kind=apology_empty → refuse（空话哄不好）
//  R5 untreated && kind=casual → mutter（冷淡嘟囔）
//  R6 recentUserCount>=3（60 秒内连发 3 条以上）→ interrupt（打断）
//  R7 energy<=20 && hour>=23 → silence（深夜没电了）
//  R8 bored>=75 → mutter（无聊到不想好好回）
//  R9 untreated（其余）→ reply（但语气档仍是闹别扭/冷淡，不立刻变好）
//  R10 默认 → reply
var ACTION_TEXT = {
  refuse: ['现在不想回这个。', '嗯。', '你自己想想。'],
  mutter: ['……', '哼。', '哦。'],
  interrupt: ['等一下——让我先说完。', '你先别急，一句一句来。'],
  silence: ['']
};
function inQuietHours(now) {
  try {
    var q = read(QUIET_KEY, null);
    if (!q || !q.quietStart || !q.quietEnd) return false;
    var toMin = function (s) { var p = String(s).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
    var m = now.getHours() * 60 + now.getMinutes(), qs = toMin(q.quietStart), qe = toMin(q.quietEnd);
    if (qs === qe) return false;
    return qs < qe ? (m >= qs && m < qe) : (m >= qs || m < qe);
  } catch (e) { return false; }
}
function decideAction(ctx) {
  ctx = ctx || {};
  var mood = ctx.mood || {}, rel = ctx.rel || {};
  var tone = toneFromState(mood, rel, ctx.slow || {}, ctx.openUntreated || 0);
  var urgent = !!ctx.urgent;
  var open = ctx.openUntreated || 0, openSev = ctx.openSeverity || 0;
  var kind = ctx.userKind || 'normal';
  var hour = (ctx.hour == null ? new Date().getHours() : ctx.hour);
  var pick = function (arr, n) { return arr[(n || 0) % arr.length]; };
  var base = { tone: tone.tone, toneReason: tone.reason };
  if (urgent) return Object.assign(base, { action: 'reply', rule: 'R1_urgent', reason: '紧急（救命/危险/难受），压过免打扰与立场门控' });
  if (ctx.dnd) return Object.assign(base, { action: 'silence', rule: 'R2_dnd', reason: '现在是免打扰时段，非紧急不回' });
  if (open > 0 && openSev >= 60) return Object.assign(base, { action: 'refuse', rule: 'R3_stance_severe', reason: '有未处理的严重不满（严重度 ' + openSev + '），拒绝被哄好', text: pick(ACTION_TEXT.refuse, ctx.angryRounds || 0) });
  if (open > 0 && kind === 'apology_empty') return Object.assign(base, { action: 'refuse', rule: 'R4_empty_apology', reason: '空话道歉（无实际代价），状态不变，拒绝', text: pick(ACTION_TEXT.refuse, ctx.angryRounds || 0) });
  if (open > 0 && kind === 'casual') return Object.assign(base, { action: 'mutter', rule: 'R5_stance_casual', reason: '有未处理的不满，对闲聊只嘟囔', text: pick(ACTION_TEXT.mutter, ctx.angryRounds || 0) });
  if ((ctx.recentUserCount || 0) >= 3) return Object.assign(base, { action: 'interrupt', rule: 'R6_interrupt', reason: '60 秒内连发 ' + ctx.recentUserCount + ' 条，先打断', text: pick(ACTION_TEXT.interrupt, 0) });
  if ((mood.energy == null ? 70 : mood.energy) <= 20 && hour >= 23) return Object.assign(base, { action: 'silence', rule: 'R7_night_low_energy', reason: '深夜且精力 ≤20，没电了，先沉默' });
  if ((mood.bored || 0) >= 75) return Object.assign(base, { action: 'mutter', rule: 'R8_bored', reason: '无聊 ' + mood.bored + '（≥75），懒得好好回', text: pick(ACTION_TEXT.mutter, 0) });
  if (open > 0) return Object.assign(base, { action: 'reply', rule: 'R9_stance_gate_reply', reason: '有未处理的不满但这条不是哄话：回，但语气仍是' + tone.tone + '，不立刻变好' });
  return Object.assign(base, { action: 'reply', rule: 'R10_default', reason: '没有门控命中，正常回' });
}
function userKindOf(text) {
  text = String(text || '');
  if (isApology(text) && !hasCost(text)) return 'apology_empty';
  if (isApology(text)) return 'apology_cost';
  if (/^(嗯|哦|好|在吗|在干嘛|哈哈|早|晚安|你好)/.test(text.trim()) || text.trim().length <= 4) return 'casual';
  return 'normal';
}
function decideForMessage(text, opts) {
  opts = opts || {};
  var s = getSubject();
  var now = new Date();
  var untreated = openUntreated();
  var sev = 0; untreated.forEach(function (g) { sev = Math.max(sev, g.severity || 0); });
  var recent = (s.userMsgTimes || []).filter(function (t) { return now.getTime() - t < 60000; }).length;
  var decs = getDecisions();
  var angryRounds = 0;
  for (var i = decs.length - 1; i >= 0; i--) { if (decs[i].action === 'refuse' || decs[i].action === 'mutter') angryRounds++; else break; }
  var ctx = {
    mood: s.mood, rel: s.rel, slow: s.slow,
    openUntreated: untreated.length, openSeverity: sev,
    userKind: userKindOf(text),
    hour: now.getHours(), dnd: inQuietHours(now),
    recentUserCount: recent, angryRounds: angryRounds,
    urgent: /救命|危险|出事|难受得|快不行|帮帮我/.test(String(text || ''))
  };
  var d = decideAction(ctx);
  d.text = d.text || null;
  var rec = { ts: Date.now(), charName: opts.charName || '', userText: String(text || '').slice(0, 60), action: d.action, rule: d.rule, reason: d.reason, tone: d.tone, userKind: ctx.userKind, openUntreated: untreated.length };
  logDecision(rec);
  var asm = assembleFor(text, opts.charName || '', { template: 'wechat_gate_v1', decision: rec });
  d.assembly = asm;
  return d;
}
function getDecisions() { var v = read(DEC_KEY, null); return Array.isArray(v) ? v : []; }
function logDecision(rec) {
  var v = getDecisions(); v.push(rec); if (v.length > 30) v = v.slice(-30); write(DEC_KEY, v);
  try {
    if (window.CharInnerLife && window.CharInnerLife.logCycle) {
      window.CharInnerLife.logCycle({
        sense: '收到你的消息：' + String(rec.userText || '').slice(0, 30),
        appraise: '查决策表命中 ' + rec.rule + '：' + rec.reason + '（语气档 ' + rec.tone + '）',
        decide: '动作：' + rec.action,
        act: rec.action === 'silence' ? '保持沉默（不回）' : (rec.action === 'reply' ? '正常回' : '回「' + (rec.text || '') + '」'),
        reflect: '决定已记进 char_subject_decisions_v1，可在驾驶舱里看到',
        trigger: 'decision:' + rec.rule, memoryRef: '决策表 A16 · 立场账本 char_stance_v1'
      });
    }
  } catch (e) {}
  return rec;
}

// ── A4 被动记忆召回（关键词 + 重要度 + 新近度，不用向量）──
function readGuichaoMemories() {
  var raw = read(GC_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(function (m, i) {
    var text = String((m && (m.content || m.text || m.title || m.summary)) || '');
    var imp = (m && (m.importance || m.weight || m.salience));
    imp = (typeof imp === 'number') ? imp : 5;
    var tsRaw = m && (m.createdAt || m.date || m.ts || m.time || m.updatedAt);
    var ts = 0;
    if (typeof tsRaw === 'number') ts = tsRaw;
    else if (tsRaw) { var p = Date.parse(String(tsRaw)); if (!isNaN(p)) ts = p; }
    return { id: (m && (m.id || m.key)) || ('gc_' + i), text: text, category: (m && (m.category || m.cat)) || '', importance: imp, ts: ts, raw: m };
  }).filter(function (m) { return m.text; });
}
function recallFor(userText, now) {
  now = now || new Date();
  var mems = readGuichaoMemories();
  var q = String(userText || '');
  if (!q || !mems.length) return [];
  var keys = {};
  for (var i = 0; i + 1 < q.length; i++) { var bg = q.slice(i, i + 2); if (bg.trim().length === 2) keys[bg] = true; }
  q.split(/[\s，。、；：！？!?,.]+/).forEach(function (w) { if (w && w.length >= 2) keys[w] = true; });
  var scored = mems.map(function (m) {
    var hits = 0;
    Object.keys(keys).forEach(function (k) { if (m.text.indexOf(k) >= 0) hits++; });
    var days = m.ts ? Math.max(0, (now.getTime() - m.ts) / 864e5) : 30;
    var recency = 1 / (1 + days / 30);
    return { id: m.id, text: m.text, category: m.category, importance: m.importance, hits: hits, recency: Math.round(recency * 100) / 100, score: Math.round(hits * m.importance * recency * 100) / 100 };
  }).filter(function (x) { return x.hits > 0; });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored.slice(0, 3);
}

// ── A14 记忆生命周期：显著度衰减 → 淡化 → 墓碑（可选档位，不默认删）──
function tierForMemory(mem, now) {
  now = now || new Date();
  var over = read(TIER_KEY, {}) || {};
  if (mem && mem.id && over[mem.id]) return over[mem.id];
  var days = (mem && mem.ts) ? Math.max(0, (now.getTime() - mem.ts) / 864e5) : 30;
  var eff = (mem ? (mem.importance || 5) : 5) * (1 / (1 + days / 180));
  if (days <= 7 || eff >= 6) return 'fresh';
  if (days > 180 && eff < 3) return 'tombstone';
  return 'faded';
}
function setTierOverride(id, tier) {
  if (['fresh', 'faded', 'tombstone'].indexOf(tier) < 0) return false;
  var over = read(TIER_KEY, {}) || {}; over[id] = tier; write(TIER_KEY, over); return true;
}
function getTieredMemories(now) {
  now = now || new Date();
  var out = { fresh: [], faded: [], tombstone: [] };
  readGuichaoMemories().forEach(function (m) { out[tierForMemory(m, now)].push({ id: m.id, text: m.text, category: m.category, importance: m.importance, tier: tierForMemory(m, now) }); });
  return out;
}
function weeklyReflect(now, force) {
  now = now || new Date();
  var s = getSubject();
  if (!force && s.lastReflectDate) {
    var last = Date.parse(s.lastReflectDate + 'T00:00:00');
    if (!isNaN(last) && (now.getTime() - last) < 7 * 864e5) return { done: false, reason: 'too_soon' };
  }
  var tiers = getTieredMemories(now);
  var picks = tiers.fresh.concat(tiers.faded).slice(0, 3);
  if (!picks.length) return { done: false, reason: 'no_memories' };
  var before = readGuichaoMemories().length;
  var text = '这一周，我印象最深的是：' + picks.map(function (p) { return '「' + p.text.slice(0, 24) + '」'; }).join('、') + '。这些我都记着，没有删掉任何一条原来的记忆。';
  var list = read(IMPR_KEY, []);
  if (!Array.isArray(list)) list = [];
  list.push({ date: todayStr(now), text: text, sourceIds: picks.map(function (p) { return p.id; }) });
  if (list.length > 20) list = list.slice(-20);
  write(IMPR_KEY, list);
  s.lastReflectDate = todayStr(now); saveSubject(s);
  var after = readGuichaoMemories().length;
  try { if (window.CharInnerLife && window.CharInnerLife.logCycle) window.CharInnerLife.logCycle({ sense: '到每周反思的时间了', appraise: '把这周的记忆整合成印象，原始记忆一条都不删', decide: '写进印象槽 char_subject_impressions_v1', act: '写好本周印象（' + picks.length + ' 条来源）', reflect: '印象是印象，记忆还是记忆', trigger: 'weekly_reflect', memoryRef: '归巢 guichao.memories.v1（只读，' + before + ' 条 → ' + after + ' 条）' }); } catch (e) {}
  return { done: true, reason: 'ok', impression: text, sourceCount: picks.length, gcBefore: before, gcAfter: after };
}
function getImpressions() { var v = read(IMPR_KEY, []); return Array.isArray(v) ? v : []; }

// ── 建议箱（Pulse dev ticks 改写版：char 只提建议，用户批准，char 不写代码）──
var SUGG_POOL = [
  { id: 'sug-run', title: '明天早上一起跑步怎么样', when: '早上', mood: 'energy' },
  { id: 'sug-walk', title: '晚饭后一起去散步怎么样', when: '晚上', mood: 'calm' },
  { id: 'sug-cook', title: '今晚一起做顿饭怎么样', when: '晚上', mood: 'calm' },
  { id: 'sug-read', title: '睡前一起读十分钟书怎么样', when: '深夜', mood: 'calm' },
  { id: 'sug-photo', title: '周末去常去的地方拍张照怎么样', when: '周末', mood: 'energy' },
  { id: 'sug-garden', title: '在记忆树上种一棵新的怎么样', when: '随时', mood: 'bored' },
  { id: 'sug-movie', title: '今晚一起看一部老电影怎么样', when: '晚上', mood: 'bored' },
  { id: 'sug-plan', title: '明天列一个小目标清单怎么样', when: '早上', mood: 'energy' }
];
function getSuggStore() { var v = read(SUGG_KEY, null); if (!v || typeof v !== 'object') { v = { decided: {}, pendingId: null, lastOfferDate: '' }; write(SUGG_KEY, v); } if (!v.decided) v.decided = {}; return v; }
function listSuggestions() {
  var st = getSuggStore();
  return SUGG_POOL.map(function (p) {
    var d = st.decided[p.id];
    return { id: p.id, title: p.title, when: p.when, mood: p.mood, status: d ? d.status : (st.pendingId === p.id ? 'pending' : 'new'), decidedTs: d ? d.ts : 0 };
  });
}
function maybeOfferSuggestion(now) {
  now = now || new Date();
  var st = getSuggStore();
  if (st.pendingId) return listSuggestions().filter(function (x) { return x.id === st.pendingId; })[0] || null;
  if (st.lastOfferDate === todayStr(now)) return null;
  var s = getSubject();
  var cands = SUGG_POOL.filter(function (p) { return !st.decided[p.id]; });
  if (!cands.length) return null;
  var pick = cands[0];
  if (s.mood.energy >= 60) pick = cands.filter(function (p) { return p.mood === 'energy'; })[0] || cands[0];
  else if (s.mood.bored >= 60) pick = cands.filter(function (p) { return p.mood === 'bored'; })[0] || cands[0];
  st.pendingId = pick.id; st.lastOfferDate = todayStr(now); write(SUGG_KEY, st);
  return { id: pick.id, title: pick.title, when: pick.when, mood: pick.mood, status: 'pending' };
}
function approveSuggestion(id) {
  var st = getSuggStore();
  if (!SUGG_POOL.some(function (p) { return p.id === id; })) return false;
  st.decided[id] = { status: 'approved', ts: Date.now() };
  if (st.pendingId === id) st.pendingId = null;
  write(SUGG_KEY, st); return true;
}
function rejectSuggestion(id) {
  var st = getSuggStore();
  if (!SUGG_POOL.some(function (p) { return p.id === id; })) return false;
  st.decided[id] = { status: 'rejected', ts: Date.now() };
  if (st.pendingId === id) st.pendingId = null;
  write(SUGG_KEY, st); return true; // 拒绝的记下来，不再提
}
function pendingSuggestion() { var st = getSuggStore(); if (!st.pendingId) return null; return listSuggestions().filter(function (x) { return x.id === st.pendingId; })[0] || null; }

// ── A26 提示词检查器 + A33 时间事实：最近一次回复的模板组装过程 ──
// GROUP-BK: 提示词检查页的世界书注入行（读 wb_last_injection_v1；没有记录时显示 0 条，不谎报）。
function bkWbLine() {
try {
var r = null; try { r = JSON.parse(localStorage.getItem('wb_last_injection_v1') || 'null'); } catch (e) {}
var n = (r && typeof r.count === 'number') ? r.count : 0;
var t = (r && r.titles && r.titles.length) ? '（' + r.titles.map(function (x) { return esc(x); }).join('、') + '）' : '';
return '<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">世界书注入</div><div style="font-size:13px;line-height:1.7;color:#3A3A3C;">本次注入世界书条目：' + n + ' 条' + t + '</div></div>';
} catch (e) { return '<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-size:13px;color:#3A3A3C;">本次注入世界书条目：0 条</div></div>'; }
}
function assembleFor(userText, charName, opts) {
opts = opts || {};
var s = getSubject();
var now = new Date();
var tone = toneFromState(s.mood, s.rel, s.slow, openUntreated().length);
var tf = timeFacts(now, s.lastUserTs);
var recalled = recallFor(userText || s.lastUserText || '', now);
var untreated = openUntreated();
var pend = pendingSuggestion();
var aff = 0;
try { var all = read(AFF_KEY, {}); var nm = charName || ''; var r = all[nm]; aff = (r && r.value) || 0;} catch (e) {}
var block = '\n语气档：' + tone.tone + '（' + tone.reason + '）。' +
'\n' + tf.line + '。' +
(recalled.length? '\n' + recalled.map(function (x) { return '「' + x.text.slice(0, 24) + '」（分 ' + x.score + '，关键词命中 ' + x.hits + ' × 重要度 ' + x.importance + ' × 新近度 ' + x.recency + '）';}).join('；'): '\n本轮没有关键词命中的记忆。') +
'\n未处理不满 ' + untreated.length + ' 条' + (untreated.length? '（' + untreated.map(function (g) { return g.reason + '·严重度' + g.severity + '·' + g.status;}).join('；') + '）': '，无门控。') +
'\n' + aff +
(pend? '\n' + pend.title + '（等你批准或拒绝，char 不写代码）': '\n无。');
var rec = {
ts: Date.now(), charName: charName || '', template: opts.template || 'wechat_reply_v1',
tone: tone.tone, toneReason: tone.reason,
filled: {
mood: s.mood, rel: s.rel, slow: s.slow,
timeFact: tf.line, recalled: recalled,
stanceOpen: untreated.map(function (g) { return { reason: g.reason, severity: g.severity, status: g.status};}),
affectionReadOnly: aff, pendingSuggestion: pend? pend.title: null
},
decision: opts.decision || null, promptBlock: block
};
write(PROMPT_KEY, rec);
return rec;
}
function getLastAssembly() { return read(PROMPT_KEY, null);}

// ── A17 驾驶舱：扩展 O 组内心调试页（四个区块）──
function barRow(label, v) {
return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px;"><span style="width:52px;color:#3A3A3C;">' + esc(label) + '</span>' +
'<span style="flex:1;height:8px;border-radius:4px;background:#EFEFF4;overflow:hidden;"><span style="display:block;height:8px;background:#5856D6;width:' + clamp(v) + '%;"></span></span>' +
'<span style="width:28px;text-align:right;color:#8E8E93;">' + clamp(v) + '</span></div>';
}
function subHeadS(title, en, id) {
return '<div class="st-sub" id="st-sub-' + esc(id) + '">' +
'<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div>' +
'<div class="st-sub-title">' + esc(title) + '</div></div>' +
'<div class="st-bigtitle" style="padding-top:4px;">' + esc(title) + '</div>' +
'<div class="st-foot" style="margin:0 16px 8px;">' + esc(en) + '</div>';
}
function renderSettingsSub(act) {
var s = getSubject();
var tone = toneFromState(s.mood, s.rel, s.slow);
if (act === 'subjectCockpit') {
var decs = getDecisions().slice().reverse().slice(0, 8);
var decHtml = decs.length? decs.map(function (d) {
return '<div class="st-row" style="display:block;padding:12px 14px;margin-bottom:8px;"><div style="font-size:12px;color:#8E8E93;">' + esc(new Date(d.ts).toLocaleString()) + ' · ' + esc(d.rule) + ' · 语气 ' + esc(d.tone) + '</div>' +
'<div style="font-size:15px;font-weight:600;margin:4px 0;">动作：' + esc(d.action) + '</div>' +
'<div style="font-size:13px;color:#3A3A3C;line-height:1.6;">原因：' + esc(d.reason) + (d.text? '<br>回的话：' + esc(d.text): '') + '</div></div>';
}).join(''): '<div class="st-group"><div class="st-row" style="padding:14px;">还没有查表记录。发一条微信给她，决策表就会在这里留下每一条决定与原因。</div></div>';
var stance = getStance().items;
var stanceHtml = stance.length? stance.map(function (g) {
return '<div style="font-size:13px;line-height:1.7;color:#3A3A3C;">· ' + esc(g.reason) + '（严重度 ' + g.severity + '）— ' + esc(g.status) + '</div>';
}).join(''): '<div style="font-size:13px;color:#8E8E93;">暂无不满，账本是空的。</div>';
var tiers = getTieredMemories(new Date());
return subHeadS('主体性驾驶舱', '心情 / 关系 / 立场账本 / 决策表查表记录，全部摊开。数据来自 char_subject_v1 / char_stance_v1 / char_subject_decisions_v1。', 'subjectCockpit') +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">心情向量 · 语气档：' + esc(tone.tone) + '</div>' +
barRow('烦躁', s.mood.irritated) + barRow('担忧', s.mood.worried) + barRow('孤独', s.mood.lonely) + barRow('精力', s.mood.energy) + barRow('无聊', s.mood.bored) + barRow('信任', s.mood.trust) +
'<div style="font-size:12px;color:#8E8E93;margin-top:6px;">' + esc(tone.reason) + '；慢速层：最近总体心情 ' + s.slow.moodBaseline + ' / 亲近基线 ' + s.slow.closenessBaseline + '（每天最多动 1，更新于 ' + esc(s.slow.updatedDate || '') + '）</div></div>' +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">关系向量</div>' +
barRow('信任', s.rel.trust) + barRow('亲近', s.rel.closeness) + barRow('熟悉', s.rel.familiarity) + barRow('紧张', s.rel.tension) + '</div>' +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">立场账本</div>' + stanceHtml + '</div>' +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">记忆生命周期（归巢，只读）</div>' +
'<div style="font-size:13px;color:#3A3A3C;">新鲜 ' + tiers.fresh.length + ' 条 · 淡化 ' + tiers.faded.length + ' 条 · 墓碑 ' + tiers.tombstone.length + ' 条（墓碑只是归档，不删除）</div></div>' +
'<div style="font-size:12px;letter-spacing:1px;color:#8E8E93;font-weight:700;margin:4px 16px 8px;">决策表最近查表记录</div>' + decHtml + '</div>';
}
if (act === 'subjectPrompt') {
var a = getLastAssembly();
if (!a) return subHeadS('提示词检查器', '最近一次回复的模板组装过程：用了哪个模板、填了哪些记忆/事实、语气档怎么来的，全部展开。', 'subjectPrompt') +
'<div class="st-group"><div class="st-row" style="padding:14px;">还没有组装记录。发一条微信（走真实 API 或本地模拟都会经过门控），这里就会出现最近一次的完整组装过程。</div></div>' + bkWbLine() + '</div>';
var f = a.filled || {};
var recHtml = (f.recalled && f.recalled.length)? f.recalled.map(function (x) { return '<div style="font-size:13px;line-height:1.7;">· 「' + esc(x.text.slice(0, 30)) + '」— 分 ' + x.score + '（关键词命中 ' + x.hits + ' × 重要度 ' + x.importance + ' × 新近度 ' + x.recency + '）</div>';}).join(''): '<div style="font-size:13px;color:#8E8E93;">本轮没有关键词命中的记忆。</div>';
var stHtml = (f.stanceOpen && f.stanceOpen.length)? f.stanceOpen.map(function (g) { return '<div style="font-size:13px;line-height:1.7;">· ' + esc(g.reason) + '（严重度 ' + g.severity + ' · ' + esc(g.status) + '）</div>';}).join(''): '<div style="font-size:13px;color:#8E8E93;">无未处理不满，门控放行。</div>';
return subHeadS('提示词检查器', '最近一次回复的模板组装过程，全部展开。模板是本地规则组装，不是真实大模型调用；小手机诚实标注自己是 Simple 模式。', 'subjectPrompt') +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;">' +
'<div style="font-size:13px;line-height:1.9;color:#3A3A3C;">模板：<b>' + esc(a.template) + '</b><br>时间：' + esc(new Date(a.ts).toLocaleString()) + '<br>角色：' + esc(a.charName || '') + '</div></div>' +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">语气档：' + esc(a.tone) + '</div><div style="font-size:13px;line-height:1.7;color:#3A3A3C;">' + esc(a.toneReason || '') + '<br>心情：烦躁 ' + (f.mood? f.mood.irritated: '—') + ' / 担忧 ' + (f.mood? f.mood.worried: '—') + ' / 孤独 ' + (f.mood? f.mood.lonely: '—') + ' / 精力 ' + (f.mood? f.mood.energy: '—') + ' / 无聊 ' + (f.mood? f.mood.bored: '—') + ' / 信任 ' + (f.mood? f.mood.trust: '—') + '<br>关系：信任 ' + (f.rel? f.rel.trust: '—') + ' / 亲近 ' + (f.rel? f.rel.closeness: '—') + ' / 熟悉 ' + (f.rel? f.rel.familiarity: '—') + ' / 紧张 ' + (f.rel? f.rel.tension: '—') + '<br>慢速层：总体心情 ' + (f.slow? f.slow.moodBaseline: '—') + ' / 亲近基线 ' + (f.slow? f.slow.closenessBaseline: '—') + '</div></div>' +
bkWbLine() +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">填进模板的记忆 / 事实</div>' +
'<div style="font-size:13px;line-height:1.7;color:#3A3A3C;">时间事实：' + esc(f.timeFact || '') + '<br>好感度（只读）：' + (f.affectionReadOnly == null? '—': f.affectionReadOnly) + '<br>待提建议：' + esc(f.pendingSuggestion || '无') + '</div>' +
'<div style="margin-top:6px;">' + recHtml + '</div></div>' +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">立场门控</div>' + stHtml + '</div>' +
(a.decision? '<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">本轮决策</div><div style="font-size:13px;line-height:1.7;color:#3A3A3C;">' + esc(a.decision.rule || '') + ' → ' + esc(a.decision.action || '') + '：' + esc(a.decision.reason || '') + '</div></div>': '') +
'</div>';
}
if (act === 'subjectStance') {
var items = getStance().items.slice().reverse();
var rows = items.length? items.map(function (g) {
var btn = g.status === '已修复'
? '<span style="color:#34C759;">✓ 已修复</span>'
: '<button data-subj-repair="' + esc(g.id) + '" style="border:1px solid #007AFF;color:#007AFF;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;">已用行动补偿</button>';
var hist = (g.history || []).map(function (h) { return '<div style="font-size:12px;color:#8E8E93;">' + esc(new Date(h.ts).toLocaleString()) + ' ' + esc(h.note || ('实际代价：' + (h.cost || ''))) + '</div>';}).join('');
return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;">' +
'<div style="font-size:15px;line-height:1.5;">' + esc(g.reason) + '</div>' +
'<div style="font-size:12px;color:#8E8E93;margin-top:6px;">严重度 ' + g.severity + ' · ' + esc(g.status) + ' · ' + esc(new Date(g.createdTs).toLocaleString()) + '</div>' + hist +
'<div style="margin-top:8px;text-align:right;">' + btn + '</div></div></div>';
}).join(''): '<div class="st-group"><div class="st-row" style="padding:14px;">账本是空的。她可以连着几轮生气，但空话哄不好——道歉没有实际代价就不变状态，有实际代价的道歉/行动才推进修复。</div></div>';
return subHeadS('立场账本', '不满与修复状态存在独立账本里，状态转移用确定性规则：空话道歉不修复，有实际代价才推进（未处理 → 已道歉 → 已修复）。', 'subjectStance') +
'<div class="st-group" style="margin:0 16px 10px;"><div class="st-row" style="padding:10px 12px;gap:8px;">' +
'<input id="subj-griev-input" type="text" placeholder="手动记一条不满，如：昨天失约了" style="flex:1;border:none;outline:none;font-size:15px;min-width:0;">' +
'<button id="subj-griev-add" style="border:0;background:#007AFF;color:#fff;border-radius:12px;padding:7px 12px;font-size:14px;flex-shrink:0;">记下</button>' +
'</div></div>' + rows + '</div>';
}
if (act === 'subjectSuggestions') {
var list = listSuggestions();
var rows2 = list.map(function (sg) {
var btns = sg.status === 'approved'
? '<span style="color:#34C759;">✓ 已批准</span>'
: sg.status === 'rejected'
? '<span style="color:#8E8E93;">已拒绝，不再提</span>'
: '<button data-sug-approve="' + esc(sg.id) + '" style="border:1px solid #34C759;color:#34C759;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;margin-right:6px;">批准</button>' +
'<button data-sug-reject="' + esc(sg.id) + '" style="border:1px solid #8E8E93;color:#8E8E93;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;">拒绝</button>';
return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;">' +
'<div style="font-size:15px;line-height:1.5;">' + esc(sg.title) + '</div>' +
'<div style="font-size:12px;color:#8E8E93;margin-top:6px;">适合：' + esc(sg.when) + ' · 状态：' + esc(sg.status === 'pending'? '待你决定': (sg.status === 'approved'? '已批准': (sg.status === 'rejected'? '已拒绝': '未提过'))) + '</div>' +
'<div style="margin-top:8px;text-align:right;">' + btns + '</div></div></div>';
}).join('');
var impr = getImpressions().slice().reverse().slice(0, 3);
var imprHtml = impr.length? impr.map(function (im) { return '<div style="font-size:13px;line-height:1.7;color:#3A3A3C;">· ' + esc(im.date) + '：' + esc(im.text) + '</div>';}).join(''): '<div style="font-size:13px;color:#8E8E93;">还没有每周印象。满 7 天（或在驾驶舱等）会自动写一条，原始记忆一条都不删。</div>';
return subHeadS('建议箱', 'char 偶尔提一个新日常/新功能建议。建议由你来决定是否做——char 不写代码、不改文件；批准的记下来，拒绝的记下来不再提。', 'subjectSuggestions') +
rows2 +
'<div class="st-group" style="margin:0 16px 10px;padding:12px 14px;"><div style="font-weight:700;font-size:15px;margin-bottom:6px;">每周反思印象</div>' + imprHtml +
'<div style="margin-top:10px;"><button id="subj-reflect-now" style="border:1px solid #5856D6;color:#5856D6;background:#fff;border-radius:12px;padding:7px 12px;font-size:14px;">现在做一次每周反思</button> <span id="subj-reflect-tip" style="font-size:12px;color:#8E8E93;"></span></div></div></div>';
}
return '';
}

window.CharSubject = {
toneFromState: toneFromState, toneLabel: toneLabel, toneDetail: toneDetail,
getSubject: getSubject, saveSubject: saveSubject, drift: drift,
noteUserMessage: noteUserMessage, noteSilenceDrift: noteSilenceDrift, slowTick: slowTick,
timeFacts: timeFacts,
getStance: getStance, openGrievances: openGrievances, openUntreated: openUntreated,
addGrievance: addGrievance, recordApology: recordApology, recordRepair: recordRepair,
hasCost: hasCost, isApology: isApology,
decideAction: decideAction, decideForMessage: decideForMessage,
getDecisions: getDecisions, logDecision: logDecision, inQuietHours: inQuietHours,
recallFor: recallFor, readGuichaoMemories: readGuichaoMemories,
tierForMemory: tierForMemory, setTierOverride: setTierOverride, getTieredMemories: getTieredMemories,
weeklyReflect: weeklyReflect, getImpressions: getImpressions,
listSuggestions: listSuggestions, maybeOfferSuggestion: maybeOfferSuggestion,
approveSuggestion: approveSuggestion, rejectSuggestion: rejectSuggestion, pendingSuggestion: pendingSuggestion,
assembleFor: assembleFor, getLastAssembly: getLastAssembly,
renderSettingsSub: renderSettingsSub,
_keys: { subject: SUBJ_KEY, stance: STANCE_KEY, suggestions: SUGG_KEY, decisions: DEC_KEY, prompt: PROMPT_KEY, impressions: IMPR_KEY, tiers: TIER_KEY, guichao: GC_KEY}
};
})();

