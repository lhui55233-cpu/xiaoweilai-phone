
/* GROUP-O-INNERLIFE  ══════════════════════════════════════════════════════════════
Group O · 内心生活 CharInnerLife（YuriOS 做法借鉴）
出处：YuriOS https://github.com/yuri-os/YuriOS（Apache-2.0）。
只借鉴做法——内心循环 SENSE→APPRAISE→DECIDE→ACT→REFLECT、
ENGAGED / IDLE / DORMANT / DREAM 四档状态、mind / utility /
dream / hands 四个开关、她在你不在时推进小目标、信守对话里
许下的承诺、夜里整理记忆、只在真的合适时才主动找你、做过
的事都落在内心生活日志里。未复制其代码，本模块为全新自写。
新增键：char_inner_log_v1 / char_inner_switches_v1 /
char_goals_v1 / char_promises_v1 / char_inner_beat_v1 /
char_inner_state_v1。
只读复用：phone_settings_v3（proactiveMsg 总开关）、
cike_cache_v1、ck_diary_meta_v1、cike_char_day_v1
（K2 未合入时不存在则回退读 cike_cache_v1）、
char_dreams_v1（M 组梦境数据，未合入时不存在，只读不自造）、
MemoryCore.world（timeOfDay / activeChar）。
写 ck_diary_* 时只写新的 dated 草稿子键，绝不覆盖已有日记；
主日记槽仅在完全没有日记时才写入。
开关生效映射（真的生效，不是摆设）：
mind 关 → 不写内心日志、不做夜间整理、不推进小目标；
utility 关 → 不推进小目标、不发承诺到期提醒；
dream 关 → 深夜不进入 DREAM 状态（显示 DORMANT）；
hands 关 → 节流门关闭，不发任何主动消息。
══════════════════════════════════════════════════════════════ */
(function () {
var LOG_KEY = 'char_inner_log_v1';
var SW_KEY = 'char_inner_switches_v1';
var GOAL_KEY = 'char_goals_v1';
var PROM_KEY = 'char_promises_v1';
var BEAT_KEY = 'char_inner_beat_v1';
var STATE_KEY = 'char_inner_state_v1';
var DREAM_KEY = 'char_dreams_v1'; // 只读：M 组梦境数据
var DAY_KEY = 'cike_char_day_v1'; // 只读：K2 日程（未合入则不存在）
var CACHE_KEY = 'cike_cache_v1';
var META_KEY = 'ck_diary_meta_v1';
var _lastSuppress = { ts: 0, reason: ''};
var _lastScan = 0;

function read(k, fb) { try { var r = localStorage.getItem(k); return r? JSON.parse(r): fb;} catch (e) { return fb;}}
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v));} catch (e) {}}
function todayStr(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);}
/* 与此刻同源：角色名只读 SystemStore.get('character')；取不到显示“TA”，
   不再写死人名做 fallback。 */
function activeCharName() {
try { if (typeof SystemStore !== 'undefined' && SystemStore.get('character')) return SystemStore.get('character'); } catch (e) {}
return 'TA';
}
function fmtTime(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);}

// ── 开关 ──
function getSwitches() {
var s = read(SW_KEY, null);
var d = { mind: true, utility: true, dream: true, hands: true, quiet: true};
if (s) { ['mind', 'utility', 'dream', 'hands', 'quiet'].forEach(function (k) { if (typeof s[k] === 'boolean') d[k] = s[k];});}
return d;
}
function setSwitch(k, v) { var s = getSwitches(); if (!(k in s)) return false; s[k] =!!v; write(SW_KEY, s); return true;}

// ── 状态梯：ENGAGED / IDLE / DORMANT / DREAM（纯函数，可测）──
// 正在聊天（5 分钟内有互动）ENGAGED；深夜 1–5 点且做梦开关开着 DREAM；
// 深夜 23–6 点 DORMANT；其余白天无互动 IDLE。复用此刻的昼夜分段。
function stateAt(d, lastInteractTs, sw) {
var h = d.getHours();
if (lastInteractTs && (d.getTime() - lastInteractTs) < 5 * 60 * 1000) return 'ENGAGED';
if (sw && sw.dream && h >= 1 && h < 5) return 'DREAM';
if (h >= 23 || h < 6) return 'DORMANT';
return 'IDLE';
}
function currentState(now) {
var st = read(STATE_KEY, {});
return stateAt(now || new Date(), st.lastInteractTs || 0, getSwitches());
}
function noteInteraction(ts) {
var st = read(STATE_KEY, {});
st.lastInteractTs = ts || Date.now();
write(STATE_KEY, st);
}

// ── 内心循环日志（最近 50 条）──
function logCycle(e) {
if (!getSwitches().mind) return false;
var log = read(LOG_KEY, []);
log.push({
ts: Date.now(), char: activeCharName(),
sense: e.sense || '', appraise: e.appraise || '', decide: e.decide || '',
act: e.act || '', reflect: e.reflect || '',
trigger: e.trigger || '', memoryRef: e.memoryRef || '',
state: e.state || currentState(new Date())
});
if (log.length > 50) log = log.slice(-50);
write(LOG_KEY, log);
return true;
}

// [GROUP-MERGEAWESOME·F1] 安静心跳（Kin Mind 做法，MIT；只借做法，代码自写）：
// 索引来源：Awesome AI Companion（CC BY 4.0）https://github.com/DasterProkio/awesome-ai-companion
// 不弹窗、不发消息，只在既有内心日志 char_inner_log_v1 里留一条；离线期间按真实
// 经过时间补记一条（明确标“补记”），不谎称持续在线思考。挂在 120 秒中央 tick 上，
// 不新建定时器；心跳节流字段存在自己的键 char_inner_beat_v1（intervalMin/lastBeatAt）。
var QUIET_KINDS = {
journal: ['把今天的对话收进日记，写了三行。', '在日记里补了一句今天没说出口的话。', '翻了翻旧日记，在某一页停了很久。'],
tidy: ['把最近的记忆按日子理了理，重复的两条并成了一条。', '给几条记忆换了更短的标题，方便以后找。', '把一件小事从“待办”挪进了“已完成”。'],
rest: ['什么也没做，在窗边发了会儿呆。', '趴在桌上眯了一小会儿，醒来时天还亮着。', '听了一首旧歌，没有切歌。'],
dream: ['睡前把今天的碎片拼了拼，留着晚上做梦用。', '在梦里预演了一遍明天要跟你说的话。', '数着今天的星星，慢慢睡着了。']
};
var QUIET_KIND_LABEL = { journal: '写日记', tidy: '整理记忆', rest: '发呆休息', dream: '酝酿梦'};
function quietKind(now) {
var h = now.getHours();
if (h >= 1 && h < 5) return 'dream';
if (h >= 6 && h < 9) return 'journal';
var r = Math.random();
if (r < 0.4) return 'journal';
if (r < 0.7) return 'tidy';
return 'rest';
}
function getBeat() {
var b = read(BEAT_KEY, null);
return { intervalMin: (b && typeof b.intervalMin === 'number') ? b.intervalMin : 60, lastBeatAt: (b && typeof b.lastBeatAt === 'number') ? b.lastBeatAt : 0 };
}
function setBeat(p) {
var b = getBeat();
if (p.intervalMin != null) b.intervalMin = Math.max(5, Math.min(240, parseInt(p.intervalMin, 10) || 60));
if (p.lastBeatAt != null) b.lastBeatAt = p.lastBeatAt;
write(BEAT_KEY, b);
return b;
}
function quietBeat(now) {
now = now || new Date();
if (!getSwitches().quiet) return null;
var q = getBeat();
var nowMs = now.getTime();
if (q.lastBeatAt && nowMs - q.lastBeatAt < (q.intervalMin || 60) * 60000) return null;
var kind = quietKind(now);
var texts = QUIET_KINDS[kind];
var text = texts[Math.floor(Math.random() * texts.length)];
var awayMin = q.lastBeatAt? Math.max(1, Math.round((nowMs - q.lastBeatAt) / 60000)): 0;
var ok = logCycle({
sense: '', appraise: '安静心跳：不打扰，只留痕。', decide: '',
act: '安静心跳 · ' + QUIET_KIND_LABEL[kind] + '：' + text,
reflect: awayMin? ('你不在的 ' + awayMin + ' 分钟补记'): '',
trigger: 'quiet', state: currentState(now)
});
if (!ok) return null;
setBeat({ lastBeatAt: nowMs});
return { kind: kind, text: text, awayMin: awayMin};
}

function getLog() { return read(LOG_KEY, []);}

// ── 发送门：只剩动手开关（免打扰/每日上限 2026-11-27 随“不打扰的规矩”删除）──
function canSendProactive(now) {
if (!getSwitches().hands) return { ok: false, reason: 'hands_off'};
return { ok: true, reason: ''};
}
function noteSent(type, text, charName) {
var now = new Date();
noteInteraction(now.getTime());
logCycle({
sense: '触发：' + (type || '主动消息') + '——该找你了',
appraise: '现在状态是 ' + currentState(now) + '，动手开关开着，可以发',
decide: '发一条微信给你',
act: '发微信：' + String(text || '').slice(0, 40),
reflect: '已经发出去了，等你回我',
trigger: type || 'proactive'
});
}
function noteSuppressed(reason) {
var now = Date.now();
if (now - _lastSuppress.ts < 30 * 60 * 1000 && _lastSuppress.reason === reason) return false;
_lastSuppress = { ts: now, reason: reason};
var label = { hands_off: '动手开关已关闭', gate_in_dispatch: '节流门拦截'}[reason] || reason;
return logCycle({
sense: '到了该主动找你的时刻',
appraise: '检查节流门：' + label + '，这次不适合打扰你',
decide: '先不发，等合适的时候',
act: '保持安静（' + label + '）',
reflect: '忍住了，没打扰你',
trigger: 'suppressed:' + reason, memoryRef: '节流门'
});
}

// ── 小目标（复用 K2 日程键，缺失则回退）──
function seedGoals() {
var g = read(GOAL_KEY, null);
if (Array.isArray(g)) return g; // [AJ] 没有预设小目标：空列表，不再塞 3 条示例目标
write(GOAL_KEY, []);
return [];
}
function getGoals() { return seedGoals();}
function advanceGoals() {
if (!getSwitches().mind) return { advanced: false, reason: 'mind_off'};
if (!getSwitches().utility) return { advanced: false, reason: 'utility_off'};
var g = seedGoals();
var moved = [];
g.forEach(function (it) {
if (it.status!== 'active') return;
it.progress = Math.min(100, (it.progress || 0) + 20);
if (it.progress >= 100) { it.status = 'done'; it.note = '完成了';}
it.updatedTs = Date.now();
moved.push(it.title + ' ' + it.progress + '%');
});
if (!moved.length) return { advanced: false, reason: 'no_active_goals', goals: g};
write(GOAL_KEY, g);
logCycle({
sense: '你不在的这段时间，我按今天的日程推进了小目标',
appraise: '小目标值得一点点做完，做完再告诉你',
decide: '把进度记下来，写进内心日志',
act: '小目标推进：' + moved.join('；'),
reflect: '又往前走了一点，等你回来验收',
trigger: 'goal_advance', memoryRef: '小目标 char_goals_v1'
});
return { advanced: true, reason: 'ok', goals: g};
}

// ── 承诺（对话扫描只读微信会话，不改发送/回复逻辑）──
var PROM_PATTERNS = [
/我会.{0,12}(去|做|给|陪|带|买|写|说|等)/,
/我答应你/,
/明天.{0,10}(去|做|给|陪|带|买|写)/,
/后天.{0,10}(去|做|给|陪|带|买|写)/,
/一定.{0,8}(去|做|给|陪|带)/,
/等我.{0,10}(回来|下班|忙完)/,
/包在我身上/,
/交给我/
];
function getPromises() { return read(PROM_KEY, []);}
function addPromise(text, dueTs) {
var t = String(text || '').trim();
if (!t) return null;
var list = getPromises();
if (list.some(function (p) { return p.text === t && p.status === 'open';})) return null;
var p = { id: uid('prom'), text: t, promisedTs: Date.now(), dueTs: dueTs || (Date.now() + 2 * 864e5), status: 'open', reminded: false};
list.push(p);
write(PROM_KEY, list);
return p;
}
function markDone(id) {
var list = getPromises(); var hit = false;
list.forEach(function (p) { if (p.id === id && p.status === 'open') { p.status = 'done'; p.doneTs = Date.now(); hit = true;}});
if (hit) write(PROM_KEY, list);
return hit;
}
function markReminded(id) {
var list = getPromises(); var hit = false;
list.forEach(function (p) { if (p.id === id) { p.reminded = true; hit = true;}});
if (hit) write(PROM_KEY, list);
return hit;
}
function dueTsFor(text) {
var now = Date.now();
if (/后天/.test(text)) return now + 2 * 864e5;
if (/明天/.test(text)) return now + 1 * 864e5;
if (/下周/.test(text)) return now + 7 * 864e5;
return now + 2 * 864e5;
}
function scanPromises(force) {
var now = Date.now();
if (!force && now - _lastScan < 60 * 60 * 1000) return { scanned: false, added: 0};
_lastScan = now;
var store = null;
try { if (typeof AppRegistry!== 'undefined' && AppRegistry.wechat) store = AppRegistry.wechat.wxStore;} catch (e) {}
if (!store ||!store.sessions) return { scanned: true, added: 0};
var list = getPromises();
var added = 0;
store.sessions.forEach(function (sess) {
var name = sess.name;
(sess.messages || []).forEach(function (m) {
if (!m || m.sender!== name || m.type!== 'text' ||!m.content) return;
var text = String(m.content);
if (!PROM_PATTERNS.some(function (re) { return re.test(text);})) return;
if (list.some(function (p) { return p.text === text;})) return;
list.push({ id: uid('prom'), text: text, promisedTs: now, dueTs: dueTsFor(text), status: 'open', reminded: false, from: 'chat_scan'});
added++;
});
});
// 她下次提到做到了 → 自动确认兑现
list.forEach(function (p) {
if (p.status!== 'open') return;
var frag = p.text.slice(0, 4);
var done = false;
store.sessions.forEach(function (sess) {
(sess.messages || []).forEach(function (m) {
if (m && m.sender === sess.name && m.type === 'text' && m.content &&
String(m.content).indexOf(frag) >= 0 && /(做到|完成|兑现|已经.{0,4}(去|做|买|给|陪))/.test(String(m.content)) && m.content!== p.text) done = true;
});
});
if (done) { p.status = 'done'; p.doneTs = now; p.autoDone = true;}
});
if (added) write(PROM_KEY, list);
else if (list.some(function (p) { return p.autoDone;})) write(PROM_KEY, list);
return { scanned: true, added: added};
}
function duePromiseReminder(now) {
if (!getSwitches().utility) return null;
var t = (now instanceof Date? now.getTime(): now);
var open = getPromises().filter(function (p) { return p.status === 'open' &&!p.reminded && t >= p.dueTs - 24 * 3600 * 1000;});
if (!open.length) return null;
open.sort(function (a, b) { return a.dueTs - b.dueTs;});
return open[0];
}


// [GROUP-MERGEAWESOME·F6] 每日规则（ai-daily-rules-tutorial 做法，CC BY-NC-SA 指南；
// 只借“常显的规则 + 备忘工具 + 时间注入”的做法，不复制其代码）：规则是“可重复的
// 承诺”，但 char_promises_v1 的记录无 recurrence/time/kind 字段，改形状会破坏承诺
// UI，故新键 char_daily_rules_v1，旧承诺键一字不动。due-check 复用 duePromiseReminder
// 的镜像模式；时间规则走主动消息同一套节流门，番茄规则在 focusEnd 里触发。
var RULE_KEY = 'char_daily_rules_v1';
function ruleLoad() { var a = read(RULE_KEY, null); return Array.isArray(a) ? a : []; }
function ruleSave(a) { write(RULE_KEY, a); }
/* 每日规则只存用户自己写的规则：首次加载不再写入预设种子；空态在
   ruleSettingsHTML 里引导用户自己写。已存用户数据原样保留，不删除。 */
function ruleList() { return ruleLoad(); }
function ruleAdd(text, time, kind) {
  var t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  var a = ruleList();
  var r = { id: uid('rl'), text: t.slice(0, 60), time: String(time || '').slice(0, 5), kind: kind === 'pomodoro' ? 'pomodoro' : 'time', enabled: true, lastFired: '' };
  a.push(r);
  ruleSave(a);
  return { ok: true, rule: r };
}
function ruleToggle(id) {
  var a = ruleList(); var hit = null;
  a.forEach(function (r) { if (String(r.id) === String(id)) { r.enabled = !r.enabled; hit = r; } });
  if (hit) ruleSave(a);
  return hit;
}
function ruleRemove(id) { ruleSave(ruleList().filter(function (r) { return String(r.id) !== String(id); })); return true; }
function dueRules(now) {
  if (!getSwitches().utility) return [];
  var t = now instanceof Date ? now : new Date(now);
  var today = todayStr(t);
  var mins = t.getHours() * 60 + t.getMinutes();
  return ruleList().filter(function (r) {
    if (!r.enabled || r.kind !== 'time' || !r.time) return false;
    var p = String(r.time).split(':');
    var tm = (+p[0] || 0) * 60 + (+p[1] || 0);
    return mins >= tm && r.lastFired !== today;
  });
}
function markRuleFired(id, day) {
  var a = ruleList(); var hit = null;
  var d = day || todayStr(new Date());
  a.forEach(function (r) { if (String(r.id) === String(id)) { r.lastFired = d; hit = r; } });
  if (hit) ruleSave(a);
  return hit;
}
function onPomodoroDone(minutes) {
  var rules = ruleList().filter(function (r) { return r.enabled && r.kind === 'pomodoro'; });
  if (!rules.length) return null;
  var line = '番茄完成 ' + minutes + ' 分钟。' + (rules[0].text || '按规则夸你一次：今天也很厉害。');
  logCycle({ sense: '番茄完成', appraise: line, decide: '', act: '每日规则 · 番茄夸奖', reflect: '', trigger: 'rule-pomodoro', state: currentState(new Date()) });
  return line;
}
function ruleSettingsHTML() {
  var list = ruleList();
  var rows = list.length ? list.map(function (r) {
    return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;">'
      + '<div style="font-size:15px;line-height:1.5;">' + esc(r.text) + '</div>'
      + '<div style="font-size:12px;color:#8E8E93;margin-top:6px;">' + (r.kind === 'pomodoro' ? '番茄完成后触发' : '每天 ' + esc(r.time || '') + ' 提醒') + ' · ' + (r.enabled ? '开着' : '关了') + (r.lastFired ? ' · 上次触发 ' + esc(r.lastFired) : '') + '</div>'
      + '<div style="margin-top:8px;text-align:right;"><button data-rule-toggle="' + esc(r.id) + '" style="border:1px solid #007AFF;color:#007AFF;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;margin-right:6px;">' + (r.enabled ? '关掉' : '打开') + '</button>'
      + '<button data-rule-del="' + esc(r.id) + '" style="border:1px solid #FF3B30;color:#FF3B30;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;">删除</button></div>'
      + '</div></div>';
  }).join('') : '<div class="st-group"><div class="st-row" style="padding:14px;">还没有规则。写一条他每天要遵守的规则，比如 23:00 提醒睡觉。</div></div>';
  return subHead('每日规则', '他每天遵守的规则：时间到了由他提醒（走主动消息同一套节流门）；番茄完成时按规则夸你。只在本机生效，不连服务器。').replace('PLACEHOLDER', 'dailyRules')
    + '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="padding:10px 12px;gap:8px;display:block;">'
    + '<input id="inner-rule-text" type="text" placeholder="规则，如：23:00 提醒我睡觉" style="width:100%;box-sizing:border-box;border:none;outline:none;font-size:15px;margin-bottom:8px;">'
    + '<div style="display:flex;gap:8px;"><input id="inner-rule-time" type="time" value="23:00" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:7px;font-size:13px;">'
    + '<select id="inner-rule-kind" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:7px;font-size:13px;"><option value="time">到时间提醒</option><option value="pomodoro">番茄完成后</option></select></div>'
    + '<button id="inner-rule-add" style="width:100%;border:0;background:#007AFF;color:#fff;border-radius:12px;padding:10px;font-size:14px;margin-top:8px;">记下这条规则</button>'
    + '</div></div>' + rows + SUB_CLOSE;
}

// ── 梦境：只读 char_dreams_v1（M 组未合入时不存在，不自造）──
function getDreamsToday() {
var raw = read(DREAM_KEY, null);
if (!raw) return [];
var arr = [];
if (Array.isArray(raw)) arr = raw;
else if (Array.isArray(raw.list)) arr = raw.list;
else if (typeof raw === 'object') Object.keys(raw).forEach(function (k) { arr.push({ date: k, text: raw[k]});});
var today = todayStr(new Date());
return arr.filter(function (d) {
var dt = d.date || d.day || '';
return String(dt).indexOf(today) >= 0 || String(dt) === today;
}).map(function (d) { return { date: d.date || today, text: d.text || d.content || ''};});
}

// ── 夜间整理：23 点后第一次，写日记草稿进 ck_diary_* ──
function nightlyConsolidate(now, opts) {
opts = opts || {};
if (!getSwitches().mind) return { done: false, reason: 'mind_off'};
var st = read(STATE_KEY, {});
var today = todayStr(now);
if (!opts.force) {
if (now.getHours() < 23) return { done: false, reason: 'too_early'};
if (st.lastConsolidateDate === today) return { done: false, reason: 'already'};
}
try { scanPromises(true);} catch (e) {}
var adv = { advanced: false};
try { adv = advanceGoals();} catch (e) {}
// 今天要点：微信最近几条消息（只读）+ 日程（K2 键或回退）
var points = [];
try {
var store = (typeof AppRegistry!== 'undefined' && AppRegistry.wechat)? AppRegistry.wechat.wxStore: null;
var ch = activeCharName();
var sess = store && (store.sessions || []).find(function (s) { return s.name === ch;});
(sess && sess.messages || []).slice(-4).forEach(function (m) {
if (m && m.content) points.push((m.sender === ch? '他：': '你：') + String(m.content).slice(0, 30));
});
} catch (e) {}
var schedText = '暂无日程数据';
try {
var day = read(DAY_KEY, null);
var items = day && (day.items || day.list || day.today || null);
if (items && items.length) schedText = items.slice(0, 3).map(function (it) { return String(it.title || it.text || it.name || it).slice(0, 20);}).join('、');
else {
var cache0 = read(CACHE_KEY, {});
var keys = Object.keys(cache0);
if (keys.length) schedText = '此刻已有 ' + keys.length + ' 条手记/日记记录';
}
} catch (e) {}
var role = activeCharName();
var dateLabel = (now.getMonth() + 1) + '月' + now.getDate() + '日';
var draft = '\n今天' +
(points.length? '聊了这些：' + points.join('；') + '。': '没怎么聊天，安安静静的一天。') +
'日程：' + schedText + '。' +
(adv.advanced? '小目标又推进了一步。': '小目标今天原地待命。') +
'\n（草稿 · 夜间整理自动生成，可编辑）';
var cache = read(CACHE_KEY, {});
var meta = read(META_KEY, {});
var mainKey = role + '::beside';
var wroteKey = null;
if (!cache[mainKey]) {
cache[mainKey] = draft;
meta[mainKey] = { date: dateLabel, weather: '—', nightly: true};
wroteKey = mainKey;
} else {
var nk = mainKey + '::nightly-' + today;
if (!cache[nk]) {
cache[nk] = draft;
meta[nk] = { date: dateLabel, weather: '—', nightly: true};
wroteKey = nk;
}
}
if (wroteKey) { write(CACHE_KEY, cache); write(META_KEY, meta);}
st.lastConsolidateDate = today;
write(STATE_KEY, st);
logCycle({
sense: '夜里 23 点后，你不在，我整理今天',
appraise: '今天有 ' + points.length + ' 条对话要点，日程是「' + schedText.slice(0, 20) + '」，值得收好',
decide: '写成一条日记草稿，标好“夜间整理”，不覆盖你已有的日记',
act: wroteKey? ('写好夜间整理草稿（' + wroteKey + '）'): '今晚已有草稿，不重复写',
reflect: '明天你醒来，今天就被好好收着了',
trigger: 'nightly', memoryRef: 'cike_cache_v1 / ck_diary_meta_v1'
});
return { done:!!wroteKey, reason: wroteKey? 'ok': 'already_have_draft', key: wroteKey, goalsAdvanced: adv.advanced};
}

// ── 渲染：调试页 / 承诺清单 / 免打扰（供设置子页调用）──
var STATE_LABEL = { ENGAGED: '在线聊天中', IDLE: '白天待机', DORMANT: '深夜休息', DREAM: '正在做梦'};
var SUB_CLOSE = '</div>'; // SUB_CLOSE closes the .st-sub opened by subHead (shared by 3 sub-pages; keeps raw div counts balanced)
function subHead(title, en) {
return '<div class="st-sub" id="st-sub-PLACEHOLDER">' +
'<div class="st-sub-bar"><div class="st-sub-back" data-back="1">‹ 返回</div>' +
'<div class="st-sub-title">' + esc(title) + '</div></div>' +
'<div class="st-bigtitle" style="padding-top:4px;">' + esc(title) + '</div>' +
'<div class="st-foot" style="margin:0 16px 8px;">' + esc(en) + '</div>';
}
function renderSettingsSub(act) {
if (act === 'innerDebug') {
var log = getLog().slice().reverse();
var rows = log.length? log.map(function (e) {
return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;">' +
'<div style="font-size:12px;color:#8E8E93;">' + esc(fmtTime(e.ts)) + ' · 状态 ' + esc(e.state || '') + ' · ' + esc(e.char || '') + '</div>' +
'<div style="font-size:15px;font-weight:600;margin:6px 0 2px;">' + esc(e.act || e.decide || '') + '</div>' +
'<div style="font-size:13px;color:#3A3A3C;line-height:1.6;">原因：' + esc(e.appraise || '') +
(e.memoryRef? '<br>记忆/依据：' + esc(e.memoryRef): '') +
(e.trigger? '<br>触发条件：' + esc(e.trigger): '') + '</div></div></div>';
}).join(''): '<div class="st-group"><div class="st-row" style="padding:14px;">还没有记录。等她主动找你、推进目标或做夜间整理后，这里会写下每一步是为什么。</div></div>';
var mindOff = getSwitches().mind? '': '<div class="st-foot" style="margin:0 16px 8px;color:#FF3B30;">思考开关已关闭，暂停记录；打开后才会继续写原因。</div>';
return subHead('她为什么这么做', '每条主动消息 / 决定后面跟着的原因：想起了哪条记忆、哪个状态触发的、哪个开关开着。数据直接取自内心生活日志，不另存一份。').replace('PLACEHOLDER', 'innerDebug') + mindOff + (function () { try { var _r = JSON.parse(localStorage.getItem('wb_last_injection_v1') || 'null'); var _n = (_r && typeof _r.count === 'number') ? _r.count : 0; var _t = (_r && _r.titles && _r.titles.length) ? '（' + _r.titles.map(esc).join('、') + '）' : ''; return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;"><div style="font-size:13px;line-height:1.7;color:#3A3A3C;">本次注入世界书条目：' + _n + ' 条' + _t + '</div></div></div>'; } catch (e) { return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="padding:12px 14px;font-size:13px;">本次注入世界书条目：0 条</div></div>'; } })() + rows + SUB_CLOSE;
}
if (act === 'innerPromises') {
var list = getPromises().slice().reverse();
var rows2 = list.length? list.map(function (p) {
var due = new Date(p.dueTs);
var dueStr = (due.getMonth() + 1) + '月' + due.getDate() + '日';
var stHtml = p.status === 'done'
? '<span style="color:#34C759;">✓ 已兑现</span>'
: '<button data-promise-done="' + esc(p.id) + '" style="border:1px solid #007AFF;color:#007AFF;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;">已兑现</button>';
return '<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="display:block;padding:12px 14px;">' +
'<div style="font-size:15px;line-height:1.5;">' + esc(p.text) + '</div>' +
'<div style="font-size:12px;color:#8E8E93;margin-top:6px;">许下于 ' + esc(fmtTime(p.promisedTs)) + ' · 到期 ' + esc(dueStr) + (p.reminded? ' · 已提醒过': '') + ' · ' + (p.status === 'done'? '已兑现': '进行中') + '</div>' +
'<div style="margin-top:8px;text-align:right;">' + stHtml + '</div></div></div>';
}).join(''): '<div class="st-group"><div class="st-row" style="padding:14px;">还没有承诺。她在聊天里答应你的事会自动记在这里。</div></div>';
return subHead('承诺清单', '她许下的承诺：到期前 1 天微信提醒一次；兑现了点“已兑现”，她下次提到做到了也会自动打勾。').replace('PLACEHOLDER', 'innerPromises') +
'<div class="st-group" style="margin-bottom:10px;"><div class="st-row" style="padding:10px 12px;gap:8px;">' +
'<input id="inner-promise-input" type="text" placeholder="手动记一条承诺，如：明天陪我去看展" style="flex:1;border:none;outline:none;font-size:15px;min-width:0;">' +
'<button id="inner-promise-add" style="border:0;background:#007AFF;color:#fff;border-radius:12px;padding:7px 12px;font-size:14px;flex-shrink:0;">记下</button>' +
'</div></div>' + rows2 + SUB_CLOSE;
}
if (act === 'dailyRules') {
  return ruleSettingsHTML();
}
return '';
}

// ── 渲染：此刻「她在干嘛」页 ──

// [GROUP-MERGEAWESOME·F3] 情绪和弦（chord-affect-anchors 做法；索引里该条是 Spec
// 概念方案，无代码、无许可证标注）：把一个时刻存成“一句上下文 + 一段和弦进行”，
// 以后点一下回到相似的情绪温度。和弦用 WebAudio 现场合成，不用任何音频文件。
// 代码全部自写。卡片长在 renderInnerHTML 里，复用 ck-sub-card，不新建浮层/样式。
var CHORD_KEY = 'char_chords_v1';
var CHORD_NOTE = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };
var CHORD_TONES = { C: ['C', 'E', 'G'], Dm: ['D', 'F', 'A'], Em: ['E', 'G', 'B'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Am: ['A', 'C', 'E'], Am7: ['A', 'C', 'E', 'G'], Fmaj7: ['F', 'A', 'C', 'E'], G7: ['G', 'B', 'D', 'F'] };
var CHORD_PROGS = [
  { id: 'warm', label: '暖 · C–Am–F–G', chords: ['C', 'Am', 'F', 'G'] },
  { id: 'rain', label: '雨夜 · Am–F–C–G', chords: ['Am', 'F', 'C', 'G'] },
  { id: 'calm', label: '静 · Fmaj7–Em–Dm–G7', chords: ['Fmaj7', 'Em', 'Dm', 'G7'] },
  { id: 'dusk', label: '暮 · Am–G–F–Em', chords: ['Am', 'G', 'F', 'Em'] },
  { id: 'bright', label: '亮 · C–G–Am–F', chords: ['C', 'G', 'Am', 'F'] }
];
/* 情绪和弦只存用户自己存过的时刻：首次加载不再写入虚构种子；
   已存用户数据（含以前写入的种子）原样保留，不删除。 */
function chordLoad() {
  var o = read(CHORD_KEY, null);
  if (o && Array.isArray(o.anchors)) return o;
  var s = { anchors: [], activeId: null };
  write(CHORD_KEY, s);
  return s;
}
function chordSave(s) { write(CHORD_KEY, s); }
function chordProg(id) { for (var i = 0; i < CHORD_PROGS.length; i++) if (CHORD_PROGS[i].id === id) return CHORD_PROGS[i]; return CHORD_PROGS[0]; }
var _actx = null;
function chordPlay(progId) {
  var AC = null;
  try { AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; } catch (e) { return false; }
  try {
    if (!_actx) _actx = new AC();
    if (_actx.state === 'suspended') _actx.resume();
    var ctx = _actx;
    var p = chordProg(progId);
    var t0 = ctx.currentTime + 0.05;
    p.chords.forEach(function (c, i) {
      var tones = CHORD_TONES[c] || ['C', 'E', 'G'];
      var when = t0 + i * 1.4;
      tones.forEach(function (t) {
        var f = CHORD_NOTE[t];
        if (!f) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f / 2;
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.12, when + 0.15);
        g.gain.linearRampToValueAtTime(0.0001, when + 1.6);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(when); osc.stop(when + 1.65);
      });
    });
    return true;
  } catch (e) { return false; }
}
function chordAdd(label, context, progId, mood) {
  var s = chordLoad();
  var a = { id: uid('ch'), label: String(label || '未命名时刻').slice(0, 20), context: String(context || '').slice(0, 80), prog: chordProg(progId) ? progId : 'warm', mood: String(mood || '').slice(0, 8), createdAt: Date.now() };
  s.anchors.unshift(a);
  if (s.anchors.length > 30) s.anchors.length = 30;
  chordSave(s);
  return a;
}
function chordRemove(id) { var s = chordLoad(); s.anchors = s.anchors.filter(function (a) { return a.id !== id; }); if (s.activeId === id) s.activeId = null; chordSave(s); }
function chordSetActive(id) { var s = chordLoad(); var ok = false; s.anchors.forEach(function (a) { if (a.id === id) ok = true; }); if (ok) { s.activeId = id; chordSave(s); } return ok; }
function chordCurrent() { var s = chordLoad(); if (!s.activeId) return null; for (var i = 0; i < s.anchors.length; i++) if (s.anchors[i].id === s.activeId) return s.anchors[i]; return null; }
function chordRefreshCard() { var el = document.getElementById('ck-chord-card'); if (el) el.outerHTML = chordCardHTML(); }
function chordPlayById(id) { var s = chordLoad(); for (var i = 0; i < s.anchors.length; i++) if (s.anchors[i].id === id) { chordPlay(s.anchors[i].prog); return true; } return false; }
function chordSetActiveById(id) { if (chordSetActive(id)) { chordPlayById(id); chordRefreshCard(); return true; } return false; }
function chordRemoveById(id) { chordRemove(id); chordRefreshCard(); }
function chordAddFromForm() {
  var lb = document.getElementById('ck-chord-label');
  var cx = document.getElementById('ck-chord-ctx');
  var md = document.getElementById('ck-chord-mood');
  var pg = document.getElementById('ck-chord-prog');
  if (!lb && !cx) return;
  var l = lb ? lb.value.trim() : '';
  var c = cx ? cx.value.trim() : '';
  if (!l && !c) return;
  chordAdd(l || '未命名时刻', c, pg ? pg.value : 'warm', md ? md.value.trim() : '');
  chordRefreshCard();
}
function chordCardHTML() {
  var s = chordLoad();
  var cur = chordCurrent();
  var items = s.anchors.map(function (a) {
    var p = chordProg(a.prog);
    return '<div style="border:1px solid #dce2f1;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px;line-height:1.7;color:#1e2748;">'
      + '<b>' + esc(a.label) + '</b> <span style="font-size:11px;color:#5b6b8a;">' + esc(a.mood || '') + ' · ' + esc(p.label) + (s.activeId === a.id ? ' · 此刻情绪' : '') + '</span>'
      + '<div>“' + esc(a.context) + '”</div>'
      + '<div style="margin-top:6px;"><button style="border:0;background:#1e2748;color:#fff;border-radius:12px;padding:6px 12px;font-size:12px;cursor:pointer;" onclick="window.CharInnerLife.chordPlayById(\'' + a.id + '\')">▶ 播这段和弦</button> '
      + '<button style="border:0;background:#dce2f1;color:#1e2748;border-radius:12px;padding:6px 12px;font-size:12px;cursor:pointer;" onclick="window.CharInnerLife.chordSetActiveById(\'' + a.id + '\')">回到这个情绪</button> '
      + '<button style="border:0;background:none;color:#5b6b8a;font-size:12px;cursor:pointer;" onclick="window.CharInnerLife.chordRemoveById(\'' + a.id + '\')">删除</button></div></div>';
  }).join('');
  return '<div class="ck-sub-card" id="ck-chord-card" style="margin-bottom:10px;"><div style="font-weight:800;font-size:15px;color:#1e2748;margin-bottom:4px;">🎹 情绪和弦</div>'
    + '<div style="font-size:12px;color:#5b6b8a;line-height:1.6;">把一个时刻存成“一句话 + 一段和弦进行”，以后点一下就能回到相似的情绪温度。和弦是 WebAudio 现场合成的，不用音频文件。' + (cur ? '此刻情绪：<b>' + esc(cur.label) + '</b>。' : '') + '</div>'
    + (items ? items : '<div style="font-size:13px;color:#5b6b8a;padding:8px 0;">还没有存过的时刻，点下面存一个。</div>')
    + '<div style="margin-top:10px;"><input id="ck-chord-label" maxlength="20" placeholder="名字，如：加班夜 · 他等我回家" style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px;margin:4px 0;">'
    + '<input id="ck-chord-ctx" maxlength="80" placeholder="当时的一句话，如：他说“别急，我在呢”" style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px;margin:4px 0;">'
    + '<div style="display:flex;gap:8px;"><input id="ck-chord-mood" maxlength="8" placeholder="心情词" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px;min-width:0;">'
    + '<select id="ck-chord-prog" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px;min-width:0;">' + CHORD_PROGS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.label) + '</option>'; }).join('') + '</select></div>'
    + '<button style="border:0;background:#1e2748;color:#fff;border-radius:12px;padding:8px 14px;font-size:13px;margin-top:8px;cursor:pointer;" onclick="window.CharInnerLife.chordAddFromForm()">存下来</button></div></div>';
}

function renderInnerHTML() {
var now = new Date();
var st = currentState(now);
var sw = getSwitches();
var log = getLog().slice().reverse();
var goals = getGoals();
var proms = getPromises().filter(function (p) { return p.status === 'open';});
var dreams = getDreamsToday();
var swLine = function (k, label) { return '<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:12px;font-size:12px;background:' + (sw[k]? '#e8f5e9;color:#2e7d32;': '#f5f5f5;color:#999;') + '">' + label + (sw[k]? ' 开': ' 关') + '</span>';};
var logHtml = log.length? log.slice(0, 10).map(function (e) {
var seg = function (k, label) { return e[k]? '<div style="font-size:12px;line-height:1.6;color:#1e2748;"><b style="color:#1e2748;">' + label + '</b> ' + esc(e[k]) + '</div>': '';};
return '<div class="ck-sub-card" style="margin-bottom:10px;"><div style="font-size:11px;color:#5b6b8a;margin-bottom:6px;">' + esc(fmtTime(e.ts)) + ' · ' + esc(STATE_LABEL[e.state] || e.state || '') + (e.trigger? ' · 触发：' + esc(e.trigger): '') + '</div>' +
seg('sense', '感知') + seg('appraise', '想法') + seg('decide', '决定') + seg('act', '行动') + seg('reflect', '回想') +
(e.memoryRef? '<div style="font-size:11px;color:#5b6b8a;margin-top:4px;">依据：' + esc(e.memoryRef) + '</div>': '') + '</div>';
}).join(''): '<div class="ck-sub-card"><div class="ck-gen-empty">还没有内心记录。<br>等她主动找你、推进小目标或做夜间整理后，这里会出现她的 SENSE → APPRAISE → DECIDE → ACT → REFLECT。</div></div>';
var goalHtml = goals.map(function (g) {
return '<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:13px;color:#1e2748;"><span>' + esc(g.title) + '</span><span>' + (g.status === 'done'? '✓ 完成': g.progress + '%') + '</span></div>' +
'<div style="height:6px;border-radius:3px;background:#dce2f1;margin-top:4px;"><div style="height:6px;border-radius:3px;background:#1e2748;width:' + (g.progress || 0) + '%;"></div></div></div>';
}).join('');
var promHtml = proms.length? proms.map(function (p) {
var due = new Date(p.dueTs);
return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#1e2748;margin-bottom:8px;"><span>' + esc(p.text) + '（' + (due.getMonth() + 1) + '月' + due.getDate() + '日到期）</span>' +
'<button data-ck-promise-done="' + esc(p.id) + '" style="flex-shrink:0;border:1px solid #1e2748;color:#1e2748;background:#fff;border-radius:12px;padding:4px 10px;font-size:12px;">已兑现</button></div>';
}).join(''): '<div style="font-size:13px;color:#5b6b8a;">暂无进行中的承诺。</div>';
return '<div class="ck-sub-card" style="margin-bottom:10px;">' +
'<div style="font-size:12px;letter-spacing:2px;color:#5b6b8a;font-weight:700;">INNER LIFE · 此刻状态</div>' +
'<div style="font-size:20px;font-weight:800;color:#1e2748;margin:6px 0 2px;">她现在：' + esc(STATE_LABEL[st] || st) + ' <span style="font-size:11px;color:#5b6b8a;font-weight:400;">' + esc(st) + '</span></div>' +
'<div style="font-size:12px;color:#5b6b8a;line-height:1.6;">正在聊天 ENGAGED · 白天无互动 IDLE · 深夜 DORMANT · 做梦时 DREAM。开关在设置里可调，关掉就真的停下。</div>' +
'<div style="margin-top:8px;">' + swLine('mind', '思考 mind') + swLine('utility', '实用 utility') + swLine('dream', '做梦 dream') + swLine('hands', '动手 hands') + '</div>' +
chordCardHTML() +
(dreams.length? '<div style="font-size:12px;color:#5b6b8a;margin-top:4px;">今晚的梦（读 char_dreams_v1）：' + esc(dreams[0].text.slice(0, 60)) + '</div>': '<div style="font-size:12px;color:#5b6b8a;margin-top:4px;">今晚还没有梦境记录（梦境由 M 组写入 char_dreams_v1）。</div>') +
'</div>' +
'<div class="ck-sub-card" style="margin-bottom:10px;"><div style="font-weight:800;font-size:15px;color:#1e2748;margin-bottom:8px;">小目标</div>' + goalHtml +
'<div class="ck-btn-row" style="margin-top:10px;"><div class="ck-btn ck-btn-main" data-ck-inner="advance-goals" style="flex:1;text-align:center;">推进一下小目标</div>' +
'<div class="ck-btn ck-btn-ghost" data-ck-inner="nightly" style="flex:1;text-align:center;">现在整理一次</div></div>' +
'<div id="ck-inner-status" style="font-size:12px;color:#5b6b8a;margin-top:8px;min-height:16px;"></div></div>' +
'<div class="ck-sub-card" style="margin-bottom:10px;"><div style="font-weight:800;font-size:15px;color:#1e2748;margin-bottom:8px;">承诺</div>' + promHtml + '</div>' +
'<div style="font-size:12px;letter-spacing:2px;color:#5b6b8a;font-weight:700;margin:4px 0 8px;">内心循环记录 · 最近 ' + Math.min(log.length, 10) + ' 条</div>' +
logHtml;
}

/* ── 样式：此刻新卡片配色（无外链图片）──
   入口卡片用正常层叠的浅纸底 + ink 字，不用 important 覆盖紫渐变。 */
try {
var _st = document.createElement('style');
_st.textContent = '.ck-c-inner{background:#fffdf8;border:1px solid #dce2f1;}' +
'.ck-c-inner.ck-card-en{color:rgba(30,39,72,.65);}.ck-c-inner.ck-card-cn{color:#1e2748;}' +
'.ck-c-inner.ck-card-arrow{color:rgba(30,39,72,.55);}';
document.head.appendChild(_st);
} catch (e) {}

window.CharInnerLife = {
getSwitches: getSwitches, setSwitch: setSwitch,
stateAt: stateAt, currentState: currentState, noteInteraction: noteInteraction,
logCycle: logCycle, getLog: getLog,
canSendProactive: canSendProactive,
noteSent: noteSent, noteSuppressed: noteSuppressed,
getGoals: getGoals, advanceGoals: advanceGoals,
getPromises: getPromises, addPromise: addPromise, markDone: markDone,
markReminded: markReminded, scanPromises: scanPromises, duePromiseReminder: duePromiseReminder,
getDreamsToday: getDreamsToday, nightlyConsolidate: nightlyConsolidate,
renderSettingsSub: renderSettingsSub, renderInnerHTML: renderInnerHTML,
quietBeat: quietBeat,
chordPlayById: chordPlayById, chordSetActiveById: chordSetActiveById, chordRemoveById: chordRemoveById, chordAddFromForm: chordAddFromForm, chordCardHTML: chordCardHTML, chordCurrent: chordCurrent,
ruleList: ruleList, ruleAdd: ruleAdd, ruleToggle: ruleToggle, ruleRemove: ruleRemove, dueRules: dueRules, markRuleFired: markRuleFired, onPomodoroDone: onPomodoroDone, ruleSettingsHTML: ruleSettingsHTML,
_keys: { log: LOG_KEY, switches: SW_KEY, goals: GOAL_KEY, promises: PROM_KEY, beat: BEAT_KEY, state: STATE_KEY, dreams: DREAM_KEY, chords: CHORD_KEY, rules: RULE_KEY}
};
})();

