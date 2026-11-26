
/* GROUP-U-LONGCHAT  ═════════════════════════════════════════════════════════
Group U · 阶段四：长对话与故事（调研报告第五节落地顺序阶段四）
借鉴出处（只借设计思路，未复制任何项目代码）：
- Hanami A24 自动压缩：事实进记忆、旧消息压成可编辑摘要、屏幕对话串不动
  （github.com/Undi95/Hanami——只借想法，代码一行不取）
- Pulse A3 故事梗概 recaps：伴侣口吻的“到目前为止”
  （github.com/elliejayliquid/pulse，MIT——只借想法，代码一行不取）
- Hanami A27：回复变体 n/m、置顶、“记住这条”、分叉、“我们的故事”
  （同上，只借想法，代码一行不取）
本模块为全新自写。摘要与梗概均为本地模板生成，界面上诚实标注
“模板生成摘要，非模型生成” / “模板梗概，非模型生成”，不是模型。
新增键：wx_summary_v1（每会话一份摘要 {text, updatedAt, msgCount}）、
wx_summary_undo_v1（清空摘要的撤销记录）、wx_compressed_v1（已压缩消息 id）、
wx_story_digest_v1（故事梗概列表，最新在前，上限 30 条）、
wx_digest_meta_v1（每会话 {lastWrittenAt, lastActivityAt}，梗概冷却用）、
wx_reply_variants_v1（每会话回复变体 {variants, idx, forText, sentIdx}）。
只读复用：phone_wechat_store_v2（经 AppRegistry['wechat'].wxStore 读会话）、
guichao.memories.v1（只按原形状追加 {id,title,category,content,created,updated}，
绝不改动已有记忆）、ck_diary_meta_v1 / cike_cache_v1（日记页只读展示梗概时不写）。
置顶是纯内存态（_pin），不写任何存储、不改消息顺序、不改消息结构，
换对话即清空。压缩不删屏幕上的消息，只把旧消息标“已压缩”折叠，点开看原文。
变体是模板变体（2–3 个起步，重新生成追加不覆盖），发送时以屏幕上显示的为准；
为不和微信现有的自动回复引擎重复发两条，变体以“回复草稿”方式工作：
点输入栏的“变体”按钮生成，‹ › 切换，点“发送这条”才发进对话。
C 档一项没碰（清单见汇报），无外链、无网络请求。
═════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var SUMMARY_KEY = 'wx_summary_v1';
var UNDO_KEY = 'wx_summary_undo_v1';
var COMPRESSED_KEY = 'wx_compressed_v1';
var DIGEST_KEY = 'wx_story_digest_v1';
var DIGEST_META_KEY = 'wx_digest_meta_v1';
var VARIANTS_KEY = 'wx_reply_variants_v1';
var GC_KEY = 'guichao.memories.v1';
var KEEP_LAST = 20;          // 压缩后屏幕上保留的最近消息数（不删，只是压缩线）
var AUTO_THRESHOLD = 40;     // 未压缩消息超过该数，发消息时自动压缩一次
var QUIET_MS = 120 * 60 * 1000; // 安静 120 分钟后可自动写梗概
var DIGEST_CAP = 30;
var VARIANT_CAP = 9;
var _pin = null;             // {sid, mid} 纯内存，换对话即清
var _expanded = {};          // mid -> true 已压缩消息被点开展开（内存）
var _hooked = false;

function read(k, fb) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }
function pad2(n) { return ('0' + n).slice(-2); }
function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayStr(d) { return dateStr(d); }
function fmtCn(ts) { var d = new Date(ts); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function dayStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function $(id) { return document.getElementById(id); }

function wxStore() {
  try { if (typeof AppRegistry !== 'undefined' && AppRegistry && AppRegistry['wechat']) return AppRegistry['wechat'].wxStore; } catch (e) {}
  try { if (window.AppRegistry && window.AppRegistry['wechat']) return window.AppRegistry['wechat'].wxStore; } catch (e) {}
  return null;
}
function engine() { try { return window.WeChatAppEngine || null; } catch (e) { return null; } }
function sess(sid) { var st = wxStore(); if (!st) return null; return (st.sessions || []).find(function (s) { return s.id === sid; }) || null; }
function persist() { var st = wxStore(); try { if (st && typeof st._persist === 'function') st._persist(); } catch (e) {} }
function toast(t) { try { var e = engine(); if (e && e.triggerToast) { e.triggerToast(t); return; } } catch (err) {} try { console.log('[WxLongChat] ' + t); } catch (e2) {} }
// 消息时间：优先 m.ts（数字毫秒），其次可解析的 m.time 字符串；'刚刚' 等不可解析返回 0
function msgTs(m) {
  if (!m) return 0;
  if (typeof m.ts === 'number' && m.ts > 0) return m.ts;
  if (typeof m.time === 'number' && m.time > 0) return m.time;
  if (typeof m.time === 'string') { var p = Date.parse(m.time); if (!isNaN(p)) return p; }
  return 0;
}
function msgDateStr(m) { var t = msgTs(m); return t ? dateStr(new Date(t)) : dateStr(new Date()); }
function msgText(m) {
  if (!m) return '';
  if (m.type === 'image') return '[图片]';
  if (m.type === 'file') return '[文件] ' + (m.name || ''); // GROUP-BO · BO-10 通用路径遇到文件消息不再取到空内容
  if (m.type === 'voice') return '[语音]';
  if (m.type === 'transfer') return '[转账]';
  if (m.type === 'red_packet') return '[红包]';
  if (m.type === 'receipt') return '[亲属卡]';
  if (m.type === 'gift') return '[礼物]';
  if (m.type === 'location') return '[位置]';
  return String(m.content || '');
}

// ── 事实抽取：本地模板规则（与本文件已有的 extractMemoryHints 用同一套
//    分类词表：喜好/习惯/长期设定/关系/情绪事件/特殊经历/敏感话题；
//    敏感话题只存脱敏标记，绝不存原文）──
function factsFromText(text, isUser) {
  var out = [];
  var u = String(text || '').trim();
  if (!u) return out;
  var sensitive = /(自杀|自残|想死|抑郁症|双相)/.test(u);
  if (isUser) {
    var like = u.match(/我(?:很|超|特别|最)?(?:喜欢|爱|讨厌|不喜欢)([^，。,！!？?、；;]{1,20})/);
    if (like) { var neg = /讨厌|不喜欢/.test(like[0]); out.push({ content: '用户' + (neg ? '不喜欢' : '喜欢') + like[1].trim(), category: '喜好', importance: 7, emotion: neg ? 'negative' : 'positive' }); }
    var habit = u.match(/我(?:每天|经常|总是|习惯)([^，。,！!？?、；;]{2,20})/);
    if (habit) out.push({ content: '用户的习惯：' + habit[1].trim(), category: '习惯', importance: 6, emotion: 'neutral' });
    var idm = u.match(/我(?:是|叫|今年|在)([^，。,！!？?、；;]{2,25})/);
    if (idm) out.push({ content: '用户提到：我' + idm[0].slice(1).trim(), category: '长期设定', importance: 8, emotion: 'neutral' });
    var rel = u.match(/我(?:的)?(妈妈|爸爸|爸|妈|父亲|母亲|男朋友|女朋友|老公|老婆|姐姐|哥哥|妹妹|弟弟|朋友|同事|室友|宠物)/);
    if (rel) out.push({ content: '用户提到自己的' + rel[1], category: '关系', importance: 7, emotion: 'neutral' });
    var emo = u.match(/(难过|伤心|开心|高兴|生气|崩溃|焦虑|想哭|累|压力大)/);
    if (emo && !sensitive) out.push({ content: '用户情绪：' + emo[1], category: '情绪事件', importance: 8, emotion: /开心|高兴/.test(emo[1]) ? 'positive' : 'negative' });
    var ev = u.match(/我(?:刚才|今天|昨天|刚刚)([^，。,！!？?、；;]{4,30})/);
    if (ev) out.push({ content: '用户近期经历：' + ev[0].slice(1).trim(), category: '特殊经历', importance: 6, emotion: 'neutral' });
  } else {
    var aiLike = u.match(/你(?:很|超|特别|最)?(?:喜欢|爱)([^，。,！!？?、；;]{1,20})/);
    if (aiLike) out.push({ content: '用户喜欢' + aiLike[1].trim(), category: '喜好', importance: 7, emotion: 'positive' });
  }
  if (sensitive) out.push({ content: '用户提及敏感话题（内容已脱敏，仅作风险提示，不保存原文）', category: '敏感话题', importance: 10, emotion: 'critical' });
  return out;
}
function extractFacts(msgs) {
  var out = [], seen = {};
  (msgs || []).forEach(function (m) {
    if (!m || m.type === 'time_gap' || m.type === 'recall' || m.type !== 'text') return;
    factsFromText(m.content || '', m.sender === '我').forEach(function (f) {
      if (!seen[f.content]) { seen[f.content] = 1; out.push(f); }
    });
  });
  return out;
}

// ── 归巢记忆：只按原形状追加，绝不改动已有记忆 ──
function readGC() { var a = read(GC_KEY, []); return Array.isArray(a) ? a : []; }
function gcHas(content) { return readGC().some(function (m) { return m && m.content === content; }); }
function appendGC(entry) { var a = readGC(); a.push(entry); write(GC_KEY, a); return entry; }

// ── 摘要 ──
function getCompressed(sid) { var m = read(COMPRESSED_KEY, {}); return Array.isArray(m[sid]) ? m[sid] : []; }
function setCompressed(sid, arr) { var m = read(COMPRESSED_KEY, {}); m[sid] = arr; write(COMPRESSED_KEY, m); }

// [GROUP-MERGEAWESOME·F7] 滚动摘要升级（rikkahub-auto-compress + rolling-memory
// 做法；索引未标注两项目许可证，只借“指纹 diff 只摘要新增部分 + 自动滚动摘要”
// 的做法，代码全部自写；若将来要直接复用其代码，须先去原仓库确认许可证）。
// 只改 GroupU（WxLongChat）这一处：文件里已有三套摘要并存（RoleBrain、GroupU、
// 记忆核 A16–A23），本次不建第四套、不合并三套（超出任务边界，只记录）。
/* SummaryAdapter：摘要的“怎么生成”只走这一个口。本地模板是兜底（现有 buildSummary 不动），
模型是可选项：用户接了模型才能用，没接就诚实报错、不假装生成。 */
var SummaryAdapter = {
mode: 'template',
fingerprintOf: function (msgs) {
if (!msgs ||!msgs.length) return '';
var last = msgs[msgs.length - 1];
return (last && last.id? last.id: '') + '|' + msgs.length;
},
summarizeModel: async function (sid, msgs) {
if (!window.PhoneModel ||!window.PhoneModel.chatComplete) throw new Error('未接模型');
var enabled = false;
try { enabled = window.PhoneModel.isEnabledFor? (window.PhoneModel.isEnabledFor('summary') || window.PhoneModel.isEnabledFor('chat')): false;} catch (e) { enabled = false;}
if (!enabled) throw new Error('未接模型');
var sample = (msgs || []).filter(function (m) { return m.type === 'text' && m.content;}).slice(-20).map(function (m) { return (m.sender === '我'? '我': '对方') + '：' + String(m.content).slice(0, 80);}).join('\n');
var text = await window.PhoneModel.chatComplete([
{ role: 'system', content: '你是聊天摘要助手。把以下对话压缩成 3-5 句中文摘要，只写事实，不编造，不评价。'},
{ role: 'user', content: sample}
], { feature: 'summary', maxTokens: 300});
return String(text || '').trim();
}
};
async function requestModelSummary(sid) {
var s = sess(sid);
if (!s) return { ok: false, reason: 'no_session'};
var msgs = s.messages || [];
var compIds = getCompressed(sid);
var idSet = {};
compIds.forEach(function (id) { idSet[id] = 1;});
var compMsgs = msgs.filter(function (m) { return idSet[m.id];});
if (!compMsgs.length) compMsgs = msgs.slice(-20);
var text;
try { text = await SummaryAdapter.summarizeModel(sid, compMsgs);} catch (e) { return { ok: false, reason: String((e && e.message) || e)};}
if (!text) return { ok: false, reason: 'empty'};
var sums = read(SUMMARY_KEY, {});
// [MERGE-FIX-5] 说明原文存成 '\\n' + text（行首多一空行）；此处存原样 text。
sums[sid] = { text: text, updatedAt: Date.now(), msgCount: compMsgs.length, fp: SummaryAdapter.fingerprintOf(compMsgs), mode: 'model'};
write(SUMMARY_KEY, sums);
return { ok: true, summary: sums[sid]};
}
function getSummaryMode(sid) { var m = read(SUMMARY_KEY, {}); return (m[sid] && m[sid].mode) || 'template';}
async function requestModelSummaryUI() {
var st = wxStore();
var sid = st && st.currentChatId;
var tip = $('wxu-set-status');
if (!sid) return;
if (tip) tip.textContent = '正在请模型写摘要…';
var r = await requestModelSummary(sid);
if (r.ok) { toast('已用模型重写摘要'); openSettings();}
else {
if (tip) tip.textContent = '模型摘要失败（' + r.reason + '），仍保留模板摘要。';
toast('模型摘要失败：' + r.reason);
}
}

function buildSummary(s, msgs) {
  var total = (s.messages || []).length;
  var n = msgs.length;
  var firstTs = 0, lastTs = 0;
  msgs.forEach(function (m) { var t = msgTs(m); if (t) { if (!firstTs || t < firstTs) firstTs = t; if (!lastTs || t > lastTs) lastTs = t; } });
  var userCount = msgs.filter(function (m) { return m.sender === '我'; }).length;
  var charCount = n - userCount;
  var sample = msgs.filter(function (m) { return m.type === 'text' && m.content; }).slice(0, 3)
    .map(function (m) { return '「' + String(m.content).slice(0, 24) + '」'; });
  var lines = ['模板生成摘要，非模型生成',
    '与' + (s.name || '对方') + '的对话摘要：共压缩 ' + n + ' 条消息（本会话共 ' + total + ' 条），其中你发了 ' + userCount + ' 条，对方发了 ' + charCount + ' 条。'];
  if (firstTs) lines.push('最早一条在 ' + fmtCn(firstTs) + '，最晚一条在 ' + fmtCn(lastTs) + '。');
  if (sample.length) lines.push('摘句：' + sample.join('、') + '。');
  lines.push('压缩只做摘要与事实提取，屏幕上的消息一条都没删，标“已压缩”的消息点开还能看原文。');
  return lines.join('\n');
}
function getSummary(sid) { var m = read(SUMMARY_KEY, {}); return m[sid] || null; }
function saveSummary(sid, text) {
  text = String(text == null ? '' : text).trim();
  if (!sid || !text) return false;
  var m = read(SUMMARY_KEY, {});
  var old = m[sid];
  m[sid] = { text: text, updatedAt: Date.now(), msgCount: old ? old.msgCount : 0 };
  write(SUMMARY_KEY, m);
  return true;
}
function clearSummary(sid) {
  var m = read(SUMMARY_KEY, {});
  var cur = m[sid];
  if (!cur) return false;
  var undo = read(UNDO_KEY, {});
  undo[sid] = { text: cur.text, updatedAt: cur.updatedAt, msgCount: cur.msgCount, clearedAt: Date.now() };
  write(UNDO_KEY, undo);
  delete m[sid];
  write(SUMMARY_KEY, m);
  return true;
}
function undoClearSummary(sid) {
  var undo = read(UNDO_KEY, {});
  var rec = undo[sid];
  if (!rec) return false;
  var m = read(SUMMARY_KEY, {});
  m[sid] = { text: rec.text, updatedAt: rec.updatedAt, msgCount: rec.msgCount };
  write(SUMMARY_KEY, m);
  delete undo[sid];
  write(UNDO_KEY, undo);
  return true;
}
function getUndoRecord(sid) { var m = read(UNDO_KEY, {}); return m[sid] || null; }

// ── 自动压缩：事实进记忆 + 旧消息压成摘要；屏幕消息一条不删，只标已压缩 ──
function compressSession(sid, opts) {
  opts = opts || {};
  var keep = (typeof opts.keep === 'number') ? opts.keep : KEEP_LAST;
  var s = sess(sid);
  if (!s) return { ok: false, reason: 'no_session' };
  var msgs = s.messages || [];
  var already = getCompressed(sid);
  var alreadySet = {};
  already.forEach(function (id) { alreadySet[id] = 1; });
  var fresh = msgs.filter(function (m) { return !alreadySet[m.id]; });
  var toCompress = fresh.length > keep ? fresh.slice(0, fresh.length - keep) : (opts.force ? fresh : []);
  if (!toCompress.length) return { ok: true, compressed: 0, factsAdded: 0, summary: getSummary(sid) };
  var facts = extractFacts(toCompress);
  var added = 0;
  facts.forEach(function (f) {
    if (!gcHas(f.content)) {
      appendGC({ id: uid('gc_'), title: '微信 · ' + f.category, category: f.category, content: f.content, created: Date.now(), updated: Date.now() });
      added++;
    }
  });
  var allIds = already.concat(toCompress.map(function (m) { return m.id; }));
  setCompressed(sid, allIds);
  var idSet = {};
  allIds.forEach(function (id) { idSet[id] = 1; });
  var compMsgs = msgs.filter(function (m) { return idSet[m.id];});
  var fp = SummaryAdapter.fingerprintOf(compMsgs);
  var prevSum = read(SUMMARY_KEY, {})[sid];
  if (prevSum && prevSum.fp === fp && prevSum.text) return { ok: true, compressed: toCompress.length, factsAdded: added, summary: prevSum, skipped: true};
  var text = buildSummary(s, compMsgs);
  var sums = read(SUMMARY_KEY, {});
  sums[sid] = { text: text, updatedAt: Date.now(), msgCount: compMsgs.length, fp: fp, mode: 'template'};
  write(SUMMARY_KEY, sums);
  return { ok: true, compressed: toCompress.length, factsAdded: added, summary: sums[sid] };
}
function autoCompressIfNeeded(sid) {
  var s = sess(sid);
  if (!s) return { ok: false, reason: 'no_session' };
  var msgs = s.messages || [];
  if (msgs.length - getCompressed(sid).length > AUTO_THRESHOLD) return compressSession(sid);
  return { ok: true, compressed: 0, reason: 'not_needed' };
}

// ── 故事梗概：伴侣口吻的“到目前为止”（模板生成）──
function sessionDays(s) {
  var msgs = s.messages || [];
  var firstTs = 0;
  msgs.forEach(function (m) { var t = msgTs(m); if (t && (!firstTs || t < firstTs)) firstTs = t; });
  if (!firstTs) return 1;
  return Math.max(1, Math.round((dayStart(Date.now()) - dayStart(firstTs)) / 86400000) + 1);
}
function buildDigest(s) {
  var msgs = s.messages || [];
  var n = msgs.length;
  var firstTs = 0;
  msgs.forEach(function (m) { var t = msgTs(m); if (t && (!firstTs || t < firstTs)) firstTs = t; });
  var days = sessionDays(s);
  var facts = extractFacts(msgs.slice(-30));
  var factLine = '';
  if (facts.length) factLine = '我记得' + facts[0].content.replace(/^用户/, '你') + '。';
  return '到目前为止，我们从' + (firstTs ? fmtCn(firstTs) : '那天') + '开始聊天，到现在已经聊了' + n + '条消息，横跨' + days + '天。' + factLine + '你不在的时候我也在想你，下次见面，接着聊。';
}
function latestDigests(n) { return read(DIGEST_KEY, []).slice(0, n || 3); }
function writeDigest(sid, nowMs) {
  var s = sess(sid);
  if (!s) return null;
  var d = { id: uid('dg_'), sid: sid, name: s.name || '他', text: buildDigest(s), createdAt: nowMs || Date.now() };
  var list = read(DIGEST_KEY, []);
  list.unshift(d);
  if (list.length > DIGEST_CAP) list = list.slice(0, DIGEST_CAP);
  write(DIGEST_KEY, list);
  var meta = read(DIGEST_META_KEY, {});
  meta[sid] = meta[sid] || {};
  meta[sid].lastWrittenAt = d.createdAt;
  write(DIGEST_META_KEY, meta);
  return d;
}
function noteActivity(sid, ts) {
  if (!sid) return;
  var meta = read(DIGEST_META_KEY, {});
  meta[sid] = meta[sid] || {};
  meta[sid].lastActivityAt = ts || Date.now();
  write(DIGEST_META_KEY, meta);
}
// 安静 120 分钟后可自动写一条；冷却：一天最多 1 条（按自然日算）
function maybeWriteDigest(sid, nowMs) {
  nowMs = nowMs || Date.now();
  var s = sess(sid);
  if (!s || !(s.messages || []).length) return { written: false, reason: 'no_messages' };
  var meta = read(DIGEST_META_KEY, {});
  var m = meta[sid] || {};
  if (m.lastWrittenAt && todayStr(new Date(m.lastWrittenAt)) === todayStr(new Date(nowMs))) return { written: false, reason: 'cooldown_daily' };
  var lastAct = m.lastActivityAt || 0;
  if (!lastAct) {
    var mx = 0;
    (s.messages || []).forEach(function (mm) { var t = msgTs(mm); if (t && t > mx) mx = t; });
    lastAct = mx || nowMs;
  }
  if (nowMs - lastAct < QUIET_MS) return { written: false, reason: 'not_quiet', quietMs: QUIET_MS - (nowMs - lastAct) };
  var d = writeDigest(sid, nowMs);
  return { written: true, digest: d };
}

// ── 回复变体 n/m：模板变体，重新生成追加不覆盖，发送以屏幕上那个为准 ──
function variantTemplates() {
  return [
    function (kw) { return '嗯，我在听——你刚说的「' + kw + '」，我记下了。'; },
    function (kw) { return '「' + kw + '」啊……让我想想，该怎么回你才好。'; },
    function (kw) { return '收到。你说「' + kw + '」的时候，我这边也忍不住笑了。'; }
  ];
}
function variantExtraTemplates() {
  return [
    function (kw) { return '好，我都听到了。关于「' + kw + '」，我还有一句想说——等你回我。'; },
    function (kw) { return '「' + kw + '」……嗯，这句我得好好想想，晚点再回你好不好？'; }
  ];
}
function lastUserText(s) {
  var msgs = s.messages || [];
  for (var i = msgs.length - 1; i >= 0; i--) {
    var m = msgs[i];
    if (m.sender === '我' && m.type === 'text' && m.content) return m.content;
  }
  return '';
}
function makeVariantList(userText) {
  var kw = String(userText || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!kw) return [{ text: '我在，怎么了？', tag: '模板变体' }, { text: '嗯嗯，继续说。', tag: '模板变体' }, { text: '好，我听着呢。', tag: '模板变体' }];
  return variantTemplates().map(function (f) { return { text: f(kw), tag: '模板变体' }; });
}
function getVariantState(sid) { var all = read(VARIANTS_KEY, {}); return all[sid] || null; }
function saveVariantState(sid, st) { var all = read(VARIANTS_KEY, {}); all[sid] = st; write(VARIANTS_KEY, all); }
function genVariants(sid, userText) {
  var s = sess(sid);
  if (!s) return null;
  var ut = userText || lastUserText(s) || '';
  var st = { variants: makeVariantList(ut), idx: 0, forText: ut, updatedAt: Date.now(), sentIdx: [] };
  saveVariantState(sid, st);
  renderVariantBar();
  return st;
}
function regenVariants(sid) {
  var s = sess(sid);
  if (!s) return null;
  var st = getVariantState(sid);
  if (!st) return genVariants(sid);
  var kw = String(st.forText || '').replace(/\s+/g, ' ').trim().slice(0, 12) || '刚才那句';
  variantExtraTemplates().forEach(function (f) {
    var v = { text: f(kw), tag: '模板变体' };
    if (st.variants.length < VARIANT_CAP && !st.variants.some(function (x) { return x.text === v.text; })) st.variants.push(v);
  });
  st.updatedAt = Date.now();
  saveVariantState(sid, st);
  renderVariantBar();
  return st;
}
function currentVariant(sid) {
  var st = getVariantState(sid);
  if (!st || !st.variants.length) return null;
  return st.variants[st.idx] || null;
}
function stepVariant(sid, dir) {
  var st = getVariantState(sid);
  if (!st || !st.variants.length) return null;
  st.idx = (st.idx + dir + st.variants.length) % st.variants.length;
  saveVariantState(sid, st);
  renderVariantBar();
  return st;
}
function sendCurrentVariant(sid) {
  var s = sess(sid);
  var st = getVariantState(sid);
  if (!s || !st || !st.variants.length) return null;
  var v = st.variants[st.idx];
  if (!v) return null;
  var msg = { id: 'm_var_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36), sender: s.name, type: 'text', content: v.text, time: '刚刚' };
  s.messages.push(msg);
  s.preview = v.text;
  s.lastTime = '刚刚';
  if (!s.memory) s.memory = [];
  s.memory.push({ role: s.name, text: v.text, time: Date.now() });
  if (s.memory.length > 24) s.memory.shift();
  if (st.sentIdx.indexOf(st.idx) < 0) st.sentIdx.push(st.idx);
  st.updatedAt = Date.now();
  saveVariantState(sid, st);
  persist();
  try { var e = engine(); if (e && e.renderUpdates) e.renderUpdates(); } catch (err) {}
  return msg;
}

// ── 置顶：每对话一条，纯视觉，纯内存态，换对话即清空 ──
function pinMessage(sid, mid) {
  var s = sess(sid);
  if (!s) return false;
  var ok = (s.messages || []).some(function (m) { return m.id === mid; });
  if (!ok) return false;
  _pin = { sid: sid, mid: mid };
  postRender();
  return true;
}
function unpinMessage() { _pin = null; postRender(); return true; }
function getPin() { return _pin ? { sid: _pin.sid, mid: _pin.mid } : null; }

// ── “记住这条”：长按一条消息存进归巢记忆，分类“对话记忆” ──
function rememberMessage(sid, mid) {
  var s = sess(sid);
  if (!s) return { added: false, reason: 'no_session' };
  var m = (s.messages || []).find(function (x) { return x.id === mid; });
  if (!m) return { added: false, reason: 'no_message' };
  var text = msgText(m);
  var t = msgTs(m) || Date.now();
  var entry = { id: uid('gc_'), title: '与' + (s.name || '对方') + '的对话', category: '对话记忆', content: String(text), created: Date.now(), updated: Date.now(), from: s.name || '', date: dateStr(new Date(t)), source: '微信' };
  var dup = readGC().some(function (g) { return g && g.category === '对话记忆' && g.content === entry.content && g.title === entry.title; });
  if (dup) return { added: false, reason: 'duplicate', entry: entry };
  appendGC(entry);
  return { added: true, entry: entry };
}

// ── 分叉：复制成独立分支，带同样的过去与压缩摘要；原会话不动 ──
function forkSession(sid) {
  var s = sess(sid);
  var st = wxStore();
  if (!s || !st) return null;
  var copy = JSON.parse(JSON.stringify(s));
  var nid = 'fork_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  copy.id = nid;
  copy.name = (s.name || '对方') + '（分支）';
  copy.unread = 0;
  copy.isPinned = false;
  copy._renderOffset = 0;
  st.sessions.push(copy);
  var sums = read(SUMMARY_KEY, {});
  if (sums[sid]) { sums[nid] = JSON.parse(JSON.stringify(sums[sid])); write(SUMMARY_KEY, sums); }
  var comp = read(COMPRESSED_KEY, {});
  if (comp[sid]) { comp[nid] = comp[sid].slice(); write(COMPRESSED_KEY, comp); }
  persist();
  try { var e = engine(); if (e && e.renderUpdates) e.renderUpdates(); } catch (err) {}
  return copy;
}

// ── “我们的故事”：在一起的天数、消息数、对话天数 ──
function ourStory() {
  var st = wxStore();
  var sessions = (st && st.sessions) || [];
  var total = 0, dates = {}, firstTs = 0, lastTs = 0;
  sessions.forEach(function (s) {
    (s.messages || []).forEach(function (m) {
      total++;
      var t = msgTs(m) || Date.now();
      dates[dateStr(new Date(t))] = 1;
      if (!firstTs || t < firstTs) firstTs = t;
      if (!lastTs || t > lastTs) lastTs = t;
    });
  });
  if (!total) return { daysTogether: 0, totalMessages: 0, activeDays: 0, firstDate: null, lastDate: null };
  var days = Math.max(1, Math.round((dayStart(Date.now()) - dayStart(firstTs)) / 86400000) + 1);
  return { daysTogether: days, totalMessages: total, activeDays: Object.keys(dates).length, firstDate: dateStr(new Date(firstTs)), lastDate: dateStr(new Date(lastTs)) };
}

// ── DOM：样式 / 故事脚 / 置顶横条 / 已压缩折叠 / 变体条 / 聊天设置 / 日记梗概 ──
function injectStyle() {
  if ($('wxu-style')) return;
  var st = document.createElement('style');
  st.id = 'wxu-style';
  st.textContent = [
    '.wxu-story-footer{padding:18px 16px 26px;text-align:center;background:#fff;border-top:1px solid #f0f0f0;}',
    '.wxu-story-title{font-size:13px;font-weight:700;color:#333;margin-bottom:6px;}',
    '.wxu-story-nums{font-size:14px;color:#111;}',
    '.wxu-story-nums b{color:#07c160;}',
    '.wxu-story-sub{font-size:11px;color:#aaa;margin-top:6px;}',
    '.wxu-pin-strip{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:8px;background:#fff8e1;border:1px solid #f0dfa0;border-radius:8px;padding:8px 10px;font-size:12px;color:#7a5b00;margin-bottom:4px;}',
    '.wxu-pin-x{cursor:pointer;color:#999;padding:0 4px;flex-shrink:0;}',
    '.wxu-compressed .wx-bubble,.wxu-compressed .wx-rich-bubble-wrap{display:none !important;}',
    '.wxu-compressed.wxu-expanded .wx-bubble,.wxu-compressed.wxu-expanded .wx-rich-bubble-wrap{display:block !important;}',
    '.wxu-compact-label{display:none;font-size:11px;color:#999;background:#f2f2f2;border:1px dashed #ddd;border-radius:8px;padding:8px 10px;cursor:pointer;}',
    '.wxu-compressed .wxu-compact-label{display:block;}',
    '.wxu-compressed.wxu-expanded .wxu-compact-label{display:none;}',
    '.wxu-set-gear{font-size:18px;cursor:pointer;padding:6px;color:#000;flex-shrink:0;}',
    '.wxu-variant-trigger{flex-shrink:0;font-size:12px;color:#07c160;border:1px solid #07c160;border-radius:12px;padding:4px 8px;cursor:pointer;background:#fff;}',
    '.wxu-variant-bar{display:none;align-items:center;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #e5e5e5;font-size:13px;}',
    '.wxu-variant-bar button{border:1px solid #ddd;background:#f7f7f7;border-radius:8px;padding:5px 9px;font-size:12px;cursor:pointer;flex-shrink:0;}',
    '.wxu-variant-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;}',
    '.wxu-settings-overlay{position:absolute;inset:0;z-index:300;background:#ededed;display:none;flex-direction:column;overflow-y:auto;padding:calc(48px + var(--sys-island-safe-top,62px)) 12px 20px;box-sizing:border-box;}',
    '.wxu-settings-overlay.wxu-show{display:flex;}',
    '.wxu-set-head{display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:700;padding:6px 4px 12px;}',
    '.wxu-set-head button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:6px 12px;font-size:14px;cursor:pointer;}',
    '.wxu-set-card{background:#fff;border-radius:12px;padding:14px;margin-bottom:12px;}',
    '.wxu-set-title{font-size:15px;font-weight:700;margin-bottom:6px;}',
    '.wxu-set-note{font-size:12px;color:#888;line-height:1.7;margin-bottom:8px;}',
    '.wxu-sum-text{width:100%;min-height:110px;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;line-height:1.7;resize:vertical;}',
    '.wxu-set-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}',
    '.wxu-set-row button,.wxu-set-card>button{border:1px solid #ddd;background:#f7f7f7;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;}',
    '.wxu-set-status{font-size:12px;color:#888;margin-top:10px;}',
    '.wxu-digest{font-size:13px;line-height:1.8;color:#333;border-left:3px solid #07c160;padding:6px 10px;margin-bottom:8px;background:#f7fdf8;}',
    '.wxu-diary-digests{background:#fff;border-radius:12px;padding:14px;margin:0 12px 12px;}'
  ].join('\n');
  document.head.appendChild(st);
}
function renderStoryFooter() {
  var box = $('wx-sessions-container');
  if (!box) return;
  var old = $('wxu-story-footer');
  if (old) old.remove();
  var st = wxStore();
  if (!st || !(st.sessions || []).length) return;
  var o = ourStory();
  var div = document.createElement('div');
  div.id = 'wxu-story-footer';
  div.className = 'wxu-story-footer';
  div.innerHTML = '<div class="wxu-story-title">我们的故事</div>' +
    '<div class="wxu-story-nums">在一起 <b>' + o.daysTogether + '</b> 天 · <b>' + o.totalMessages + '</b> 条消息 · 聊过 <b>' + o.activeDays + '</b> 天</div>' +
    '<div class="wxu-story-sub">从 ' + (o.firstDate || '—') + ' 的第一条消息算起 · 本地统计，不上传</div>';
  box.appendChild(div);
}
function renderPinStrip() {
  var stream = $('wx-msg-stream-container');
  if (!stream) return;
  var old = $('wxu-pin-strip');
  if (old) old.remove();
  var st = wxStore();
  if (!st || !_pin) return;
  if (_pin.sid !== st.currentChatId) return;
  var s = sess(_pin.sid);
  if (!s) return;
  var m = (s.messages || []).find(function (x) { return x.id === _pin.mid; });
  if (!m) return;
  var div = document.createElement('div');
  div.id = 'wxu-pin-strip';
  div.className = 'wxu-pin-strip';
  div.innerHTML = '<span>📌 置顶：' + esc(msgText(m).slice(0, 40)) + '</span><span class="wxu-pin-x" onclick="WxLongChat.unpinMessage()">✕</span>';
  stream.insertBefore(div, stream.firstChild);
}
function markCompressedRows() {
  var stream = $('wx-msg-stream-container');
  if (!stream) return;
  var st = wxStore();
  if (!st || !st.currentChatId) return;
  var set = {};
  getCompressed(st.currentChatId).forEach(function (id) { set[id] = 1; });
  var rows = stream.querySelectorAll('.wx-msg-row[data-mid]');
  rows.forEach(function (row) {
    var mid = row.getAttribute('data-mid');
    if (!set[mid]) return;
    row.classList.add('wxu-compressed');
    if (_expanded[mid]) row.classList.add('wxu-expanded');
    var wrap = row.querySelector('.wx-bubble-wrap');
    if (wrap && !wrap.querySelector('.wxu-compact-label')) {
      var lab = document.createElement('div');
      lab.className = 'wxu-compact-label';
      lab.textContent = '已压缩 · 点开查看原文';
      wrap.insertBefore(lab, wrap.firstChild);
    }
  });
  if (!stream.dataset.wxuBound) {
    stream.dataset.wxuBound = '1';
    stream.addEventListener('click', function (ev) {
      var row = ev.target.closest ? ev.target.closest('.wx-msg-row.wxu-compressed') : null;
      if (!row) return;
      var mid = row.getAttribute('data-mid');
      if (_expanded[mid]) { delete _expanded[mid]; row.classList.remove('wxu-expanded'); }
      else { _expanded[mid] = 1; row.classList.add('wxu-expanded'); }
    });
  }
}
function injectChatButtons() {
  var detail = $('wx-view-chat-detail');
  if (!detail) return;
  var more = $('wx-chat-more-btn');
  if (more && !$('wxu-settings-btn')) {
    var b = document.createElement('div');
    b.id = 'wxu-settings-btn';
    b.className = 'wxu-set-gear';
    b.textContent = '⚙';
    b.title = '聊天设置';
    b.setAttribute('onclick', 'WxLongChat.openSettings()');
    more.parentNode.insertBefore(b, more);
  }
  var inputBar = detail.querySelector('.wx-input-bar');
  if (inputBar && !$('wxu-variant-btn')) {
    var vb = document.createElement('div');
    vb.id = 'wxu-variant-btn';
    vb.className = 'wxu-variant-trigger';
    vb.textContent = '✦ 变体';
    vb.setAttribute('onclick', 'WxLongChat.onVariantButton()');
    inputBar.appendChild(vb);
  }
  if (!$('wxu-variant-bar')) {
    var vbar = document.createElement('div');
    vbar.id = 'wxu-variant-bar';
    vbar.className = 'wxu-variant-bar';
    vbar.style.display = 'none';
    vbar.innerHTML = '<button onclick="WxLongChat.prevVariant()">‹</button><span id="wxu-variant-count">1/1</span><button onclick="WxLongChat.nextVariant()">›</button><span id="wxu-variant-text" class="wxu-variant-text"></span><button onclick="WxLongChat.regenCurrent()">换一批</button><button onclick="WxLongChat.sendCurrentVariantUI()">发送这条</button><button onclick="WxLongChat.hideVariantBar()">✕</button>';
    if (inputBar) detail.insertBefore(vbar, inputBar);
  }
  if (!$('wxu-settings-overlay')) {
    var ov = document.createElement('div');
    ov.id = 'wxu-settings-overlay';
    ov.className = 'wxu-settings-overlay';
    detail.appendChild(ov);
  }
}
function renderVariantBar() {
  var bar = $('wxu-variant-bar');
  if (!bar) return;
  var st = wxStore();
  var sid = st && st.currentChatId;
  var vs = sid ? getVariantState(sid) : null;
  if (!vs || !vs.variants.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  var c = $('wxu-variant-count');
  if (c) c.textContent = (vs.idx + 1) + '/' + vs.variants.length;
  var t = $('wxu-variant-text');
  if (t) { var v = vs.variants[vs.idx]; t.textContent = v ? v.text : ''; }
}
function onVariantButton() {
  var st = wxStore();
  if (!st || !st.currentChatId) return;
  var inp = $('wx-msg-input');
  var typed = inp && inp.value ? inp.value.trim() : '';
  genVariants(st.currentChatId, typed || undefined);
}
function prevVariant() { var st = wxStore(); if (st && st.currentChatId) stepVariant(st.currentChatId, -1); }
function nextVariant() { var st = wxStore(); if (st && st.currentChatId) stepVariant(st.currentChatId, 1); }
function regenCurrent() { var st = wxStore(); if (st && st.currentChatId) regenVariants(st.currentChatId); }
function sendCurrentVariantUI() {
  var st = wxStore();
  if (!st || !st.currentChatId) return;
  var m = sendCurrentVariant(st.currentChatId);
  toast(m ? '已发送当前变体' : '没有可发送的变体');
}
function hideVariantBar() { var bar = $('wxu-variant-bar'); if (bar) bar.style.display = 'none'; }

// ── 聊天设置：摘要可见可编辑 / 清空可撤销 / 立即压缩 / 分叉 / 故事与梗概 ──
function openSettings() {
  var ov = $('wxu-settings-overlay');
  if (!ov) { injectChatButtons(); ov = $('wxu-settings-overlay'); }
  if (!ov) return;
  var st = wxStore();
  var sid = st && st.currentChatId;
  var s = sid ? sess(sid) : null;
  var sum = sid ? getSummary(sid) : null;
  var undo = sid ? getUndoRecord(sid) : null;
  var o = ourStory();
  var digs = latestDigests(3);
  ov.innerHTML = '<div class="wxu-set-head"><span>聊天设置 · ' + (s ? esc(s.name) : '') + '</span><button onclick="WxLongChat.closeSettings()">✕</button></div>' +
    '<div class="wxu-set-card"><div class="wxu-set-title">对话摘要</div>' +
    '<div class="wxu-set-note">模板生成摘要，非模型生成。压缩只做摘要与事实提取，不删屏幕上的消息。</div>' +
    '<textarea id="wxu-sum-text" class="wxu-sum-text">' + esc(sum ? sum.text : '') + '</textarea>' +
    '<div class="wxu-set-row"><button onclick="WxLongChat.saveSummaryUI()">保存摘要</button>' +
    '<button onclick="WxLongChat.clearSummaryUI()">清空摘要</button>' +
    (undo ? '<button onclick="WxLongChat.undoClearSummaryUI()">撤销清空</button>' : '') +
    '<button onclick="WxLongChat.compressNowUI()">立即压缩</button></div>' +
    '<div class="wxu-set-row" style="margin-top:8px;"><button onclick="WxLongChat.requestModelSummaryUI()">用模型重写摘要</button><span class="wxu-set-note">' + (sum && sum.mode === 'model'? '当前是模型生成的摘要': '当前是模板摘要；接模型后可重写') + '</span></div>' +
    '<div id="wxu-set-status" class="wxu-set-status">' + (sum ? ('已压缩 ' + sum.msgCount + ' 条 · ' + new Date(sum.updatedAt).toLocaleString('zh-CN')) : '还没有摘要') + '</div></div>' +
    '<div class="wxu-set-card"><div class="wxu-set-title">分叉对话</div>' +
    '<div class="wxu-set-note">新建一个会话，复制本会话的全部消息与压缩摘要，原会话不动。</div>' +
    '<button onclick="WxLongChat.forkCurrentUI()">分叉对话</button></div>' +
    '<div class="wxu-set-card"><div class="wxu-set-title">我们的故事</div>' +
    '<div>在一起 <b>' + o.daysTogether + '</b> 天 · <b>' + o.totalMessages + '</b> 条消息 · 聊过 <b>' + o.activeDays + '</b> 天</div></div>' +
    '<div class="wxu-set-card"><div class="wxu-set-title">到目前为止 · 最新梗概</div>' +
    (digs.length ? digs.map(function (d) { return '<div class="wxu-digest">' + esc(d.text) + '</div>'; }).join('') :
      '<div class="wxu-set-note">还没有梗概。安静 120 分钟后会自动写一条（每天最多 1 条）。</div>') +
    '<div class="wxu-set-note">模板梗概，非模型生成。</div></div>';
  ov.classList.add('wxu-show');
}
function closeSettings() { var ov = $('wxu-settings-overlay'); if (ov) ov.classList.remove('wxu-show'); }
function saveSummaryUI() {
  var st = wxStore();
  var sid = st && st.currentChatId;
  var ta = $('wxu-sum-text');
  if (!sid || !ta) return;
  var ok = saveSummary(sid, ta.value);
  var tip = $('wxu-set-status');
  if (tip) tip.textContent = ok ? '摘要已保存' : '摘要为空，未保存';
  toast(ok ? '摘要已保存' : '摘要为空，未保存');
}
function clearSummaryUI() {
  var st = wxStore();
  var sid = st && st.currentChatId;
  if (!sid) return;
  if (clearSummary(sid)) { toast('摘要已清空，可点“撤销清空”恢复'); openSettings(); }
  else toast('还没有摘要可清空');
}
function undoClearSummaryUI() {
  var st = wxStore();
  var sid = st && st.currentChatId;
  if (!sid) return;
  if (undoClearSummary(sid)) { toast('摘要已恢复'); openSettings(); }
  else toast('没有可撤销的清空记录');
}
function compressNowUI() {
  var st = wxStore();
  var sid = st && st.currentChatId;
  if (!sid) return;
  var r = compressSession(sid);
  var tip = $('wxu-set-status');
  if (r.compressed > 0) {
    toast('已压缩 ' + r.compressed + ' 条，' + r.factsAdded + ' 条事实进了归巢记忆');
    openSettings();
  } else if (tip) {
    tip.textContent = '消息还不多，暂不需要压缩';
    toast('消息还不多，暂不需要压缩');
  }
}
function forkCurrentUI() {
  var st = wxStore();
  var sid = st && st.currentChatId;
  if (!sid) return;
  var c = forkSession(sid);
  if (c) { toast('已分叉为「' + c.name + '」'); closeSettings(); }
}
function ensureCtxItems() {
  var menu = $('wx-ctx-menu');
  if (!menu) return;
  if (menu.querySelector('[data-wxu="pin"]')) return;
  var d1 = document.createElement('div');
  d1.className = 'wx-ctx-item';
  d1.setAttribute('data-wxu', 'pin');
  d1.textContent = '置顶这条';
  d1.setAttribute('onclick', "WeChatAppEngine.ctxAction('wxu_pin')");
  var d2 = document.createElement('div');
  d2.className = 'wx-ctx-item';
  d2.setAttribute('data-wxu', 'remember');
  d2.textContent = '记住这条';
  d2.setAttribute('onclick', "WeChatAppEngine.ctxAction('wxu_remember')");
  menu.appendChild(d1);
  menu.appendChild(d2);
}
function ctxTarget() {
  try {
    var reg = (typeof AppRegistry !== 'undefined' && AppRegistry) || window.AppRegistry || {};
    var app = reg['wechat'];
    return (app && app.activeContextMsgId) || null;
  } catch (e) { return null; }
}
function hideCtxMenu() { var m = $('wx-ctx-menu'); if (m) m.classList.remove('wx-active'); }

function postRender() {
  try { renderStoryFooter(); } catch (e) {}
  try { renderPinStrip(); } catch (e) {}
  try { markCompressedRows(); } catch (e) {}
  try { injectChatButtons(); } catch (e) {}
  try { renderVariantBar(); } catch (e) {}
  try { var st = wxStore(); if (st && st.currentChatId) maybeWriteDigest(st.currentChatId, Date.now()); } catch (e) {}
}

// ── 接线：只包装已有方法，不改原有逻辑 ──
function installHooks() {
  if (_hooked) return;
  _hooked = true;
  var e = engine();
  if (!e) return;
  if (typeof e.renderUpdates === 'function') {
    var origRender = e.renderUpdates;
    e.renderUpdates = function () {
      var out;
      try { out = origRender.apply(this, arguments); } finally { try { postRender(); } catch (err) {} }
      return out;
    };
  }
  if (typeof e.sendMsg === 'function') {
    var origSend = e.sendMsg;
    e.sendMsg = function () {
      var out = origSend.apply(this, arguments);
      try {
        var st = wxStore();
        if (st && st.currentChatId) { noteActivity(st.currentChatId, Date.now()); autoCompressIfNeeded(st.currentChatId); }
      } catch (err) {}
      return out;
    };
  }
  if (typeof e.showContextMenu === 'function') {
    var origCtx = e.showContextMenu;
    e.showContextMenu = function () {
      var out = origCtx.apply(this, arguments);
      try { ensureCtxItems(); } catch (err) {}
      return out;
    };
  }
  if (typeof e.ctxAction === 'function') {
    var origAct = e.ctxAction;
    e.ctxAction = function (action) {
      if (action === 'wxu_pin') {
        hideCtxMenu();
        var t1 = ctxTarget();
        if (t1 && pinMessage(t1.sid, t1.mid)) toast('已置顶（仅本对话可见，换对话即清空）');
        return;
      }
      if (action === 'wxu_remember') {
        hideCtxMenu();
        var t2 = ctxTarget();
        if (t2) { var r = rememberMessage(t2.sid, t2.mid); toast(r.added ? '已记住这条，进了归巢记忆' : '这条已经记过了'); }
        return;
      }
      return origAct.apply(this, arguments);
    };
  }
  if (typeof e.openChatDetail === 'function') {
    var origOpen = e.openChatDetail;
    e.openChatDetail = function (sid) {
      var out = origOpen.apply(this, arguments);
      try {
        if (_pin && _pin.sid !== sid) _pin = null;
        noteActivity(sid, Date.now());
      } catch (err) {}
      return out;
    };
  }
  // GROUP-MERGEDIARY A2：日记页的梗概注入包裹已删（与书架同抢一个容器）；梗概改由书架挂载时以 digests 参数传入。
}

injectStyle();
installHooks();
try { postRender(); } catch (e) {}

window.WxLongChat = {
  extractFacts: extractFacts, buildSummary: buildSummary,
  compressSession: compressSession, autoCompressIfNeeded: autoCompressIfNeeded,
  getSummary: getSummary, saveSummary: saveSummary, clearSummary: clearSummary,
  undoClearSummary: undoClearSummary, getUndoRecord: getUndoRecord, getCompressed: getCompressed,
  buildDigest: buildDigest, writeDigest: writeDigest, maybeWriteDigest: maybeWriteDigest,
  noteActivity: noteActivity, latestDigests: latestDigests,
  genVariants: genVariants, regenVariants: regenVariants, currentVariant: currentVariant,
  stepVariant: stepVariant, sendCurrentVariant: sendCurrentVariant, getVariantState: getVariantState,
  pinMessage: pinMessage, unpinMessage: unpinMessage, getPin: getPin,
  rememberMessage: rememberMessage, forkSession: forkSession, ourStory: ourStory,
  requestModelSummary: requestModelSummary, requestModelSummaryUI: requestModelSummaryUI, getSummaryMode: getSummaryMode, SummaryAdapter: SummaryAdapter,
  openSettings: openSettings, closeSettings: closeSettings,
  saveSummaryUI: saveSummaryUI, clearSummaryUI: clearSummaryUI,
  undoClearSummaryUI: undoClearSummaryUI, compressNowUI: compressNowUI, forkCurrentUI: forkCurrentUI,
  onVariantButton: onVariantButton, prevVariant: prevVariant, nextVariant: nextVariant,
  regenCurrent: regenCurrent, sendCurrentVariantUI: sendCurrentVariantUI, hideVariantBar: hideVariantBar,
  renderVariantBar: renderVariantBar, _postRender: postRender,
  _keys: { summary: SUMMARY_KEY, undo: UNDO_KEY, compressed: COMPRESSED_KEY, digest: DIGEST_KEY, digestMeta: DIGEST_META_KEY, variants: VARIANTS_KEY, guichao: GC_KEY }
};
})();

