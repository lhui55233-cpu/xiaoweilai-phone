
/* GROUP-BD · 记忆系统 A 清单落地（自写实现，只借思路，不抄任何仓库代码）
来源：~/workspace/xiaoweilai/记忆系统调研_11仓库.md（A1-A76 / B1-B18 / C1-C20）
basic-memory 为 AGPL-3.0：只借思路（A5 语法、A19 留/跳标准、A25 融合公式思路、
A57 修订守卫思路、A14 导入溯源思路），绝不抄代码。未核实数字均已标注。
架构：单文件 + localStorage + 模板兜底；接模型时走用户自填的 OpenAI 兼容接口
（phone_model_cfg_v1，AG 组），本模块不另接任何云端服务，不做 embedding/向量检索。
自动入库一律走审阅流（B18/C5）：本模块只产候选，批准才进 guichao.memories.v1。 */
(function () {
'use strict';

/* ── 0 · 新键与默认配置 ─────────────────────────────────────────── */
var MEM_KEY = 'guichao.memories.v1'; /* 只读复用既有记忆库键，不改其结构 */
var CFG_KEY = 'guichao_bd_config_v1';
var STATE_KEY = 'guichao_bd_state_v1';
var GRAPH_KEY = 'guichao_bd_graph_v1';
var PROFILE_KEY = 'guichao_bd_profile_v1';
var AUDIT_KEY = 'guichao_bd_audit_v1';
var REVIEW_KEY = 'guichao_bd_review_v1';

/* 默认值出处见各字段注释；标“未核实”者为报告 second-hand/示例值，可在面板里改。 */
var DEFAULT_CONFIG = {
/* A1 langmem 防抖：对话静止 30 秒且无新消息才提炼；新消息取消旧任务 */
quietMs: 30000,
/* A2 memobase 缓冲批量：攒 >1024 tokens 或闲置 1 小时才跑一次（按手机场景可调小） */
batchTokens: 1024, batchIdleMs: 3600000,
/* A3 MemOS 任务边界：话题切换或 2 小时空闲即断段 */
segmentIdleMs: 7200000, topicSwitchJaccard: 0.2,
/* A16 langmem token 预算三参数：示例值 256/256/128，非默认值，未核实，按手机实测调整 */
budget: { maxTokensBeforeSummary: 256, tokensToSummarize: 256, summaryMaxTokens: 128, unverified: true},
/* A18 letta 上下文压力 70% 警告阈值：论文示例，未核实为产品配置 */
pressureWarnPct: 0.70, pressureWarnUnverified: true,
/* A19 basic-memory 夜间反思：1-2 次/天 */
reflectMaxPerDay: 2, reflectMinGapMs: 6 * 3600000,
/* A24 Memori 混合权重：稠密 0.85/词法 0.15；短查询(<=2词)词法 0.30；钳制 [0.05,0.40]；BM25 k1=1.2/b=0.75 */
hybrid: { dense: 0.85, lexical: 0.15, shortLexical: 0.30, clampMin: 0.05, clampMax: 0.40, bm25k1: 1.2, bm25b: 0.75},
/* A25 basic-memory 融合：max + 0.3 x min（只借公式思路） */
fusionBonus: 0.3,
/* A26 hindsight RRF 常数 k=60（页面搜索已核实；主召回 k=60 为 second-hand） */
rrfK: 60,
/* A27 hindsight 召回 token 预算：事实 2048 / 文本块 1000 / 去重 512 */
recallBudgets: { facts: 2048, chunks: 1000, dedup: 512},
/* A28 basic-memory：搜索默认 10、max_related 10、depth 1、since 7d */
searchDefaults: { limit: 10, maxRelated: 10, depth: 1, sinceDays: 7},
/* A29 Memori：limit=5、embeddings_limit=1000（本地版：规则打分候选上限 1000 条） */
quickLimit: 5, candidateCap: 1000,
/* A30 mem0：top_k=20、阈值 0.1（second-hand，未核实） */
topK: 20, threshold: 0.1, topKUnverified: true,
/* A39 hindsight：线性衰减，窗口 365 天、半衰期 90 天（config 已核实） */
decay: { windowDays: 365, halfLifeDays: 90, lightHalfLifeDays: 14, lightUnverified: true, profile: 'standard90'},
/* A46 MemOS 相似度 >0.80 走裁决（second-hand，未核实）；A47 本地版阈值 0.75、Top-5 */
conflictSim: 0.80, conflictSimUnverified: true, localSim: 0.75, localTopK: 5,
/* A62 memobase 画像上限：单主题 128 tokens、单画像子主题 15 个 */
profileCaps: { themeTokens: 128, subtopics: 15},
/* A63 memobase 处理截断 16384 tokens */
processCapTokens: 16384,
/* A48 langmem：删除默认关闭，只建议不执行 */
deletesDefaultOff: true
};

function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v == null? fb: JSON.parse(v);} catch (e) { return fb;}}
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}}
function uid(p) { return (p || 'bd') + '_' + Date.now().toString(36) + '_' + (++uidSeq);}
var uidSeq = 0;
function todayStr(d) { d = d || new Date(); var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10? '0': '') + m + '-' + (dd < 10? '0': '') + dd;}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}

/* A58 内容哈希去重：自写 djb2 哈希（非密码学用途，仅判重） */
function contentHash(text) {
var h = 5381, s = String(text || '');
for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
return 'h' + h.toString(16);
}
/* 粗略 token 估算（中文约 1 字 ~0.5 token 估算口径，面板可调，仅作触发/预算参考，不作计费依据） */
function estTokens(text) { return Math.ceil(String(text || '').length / 2);}
function getConfig() {
var c = lsGet(CFG_KEY, null);
if (!c || typeof c!== 'object') { lsSet(CFG_KEY, DEFAULT_CONFIG); return JSON.parse(JSON.stringify(DEFAULT_CONFIG));}
return c;
}
function saveConfig(patch) {
var c = getConfig();
Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k];});
lsSet(CFG_KEY, c); return c;
}
function getState() {
var s = lsGet(STATE_KEY, null);
if (!s || typeof s!== 'object') s = { summarizedIds: {}, segments: [], lastExtractAt: 0, lastReflectAt: 0, reflectRunsToday: {}, sessionCache: [], events: [], ingestionRuns: [], opIds: {}, summaries: [], lastDecaySweepAt: 0};
return s;
}
function saveState(s) { lsSet(STATE_KEY, s); return s;}
function loadMemories() { var m = lsGet(MEM_KEY, []); return Array.isArray(m)? m: [];}
function saveMemories(m) { return lsSet(MEM_KEY, m);}
function memText(m) { return String((m && (m.content || m.text || m.title || '')) || '');}
function memTs(m) {
var r = m && (m.createdAt || m.ts || m.date || m.updatedAt);
if (typeof r === 'number') return r;
if (r) { var p = Date.parse(String(r)); if (!isNaN(p)) return p;}
return 0;
}
function auditLog(entry) {
var a = lsGet(AUDIT_KEY, []); if (!Array.isArray(a)) a = [];
a.push(Object.assign({ id: uid('au'), ts: Date.now(), by: 'user'}, entry || {}));
if (a.length > 500) a = a.slice(-500);
lsSet(AUDIT_KEY, a); return a[a.length - 1];
}
function auditLoad() { var a = lsGet(AUDIT_KEY, []); return Array.isArray(a)? a: [];}

/* ── 1 · 分词 / 相似度 / BM25（B1/B7 重写：向量检索→规则打分） ────────── */
function tokenize(text) {
var s = String(text || '');
var out = {};
var words = s.split(/[\s，。、；：！？!?,.、""''（）()\[\]]+/).filter(function (w) { return w && w.length >= 2;});
words.forEach(function (w) { out[w] = true;});
var clean = s.replace(/[\s，。、；：！？!?,.、""''（）()\[\]]/g, '');
for (var i = 0; i + 1 < clean.length; i++) { var bg = clean.slice(i, i + 2); if (bg.trim().length === 2) out[bg] = true;}
return Object.keys(out);
}
function jaccard(a, b) {
var sa = {}, sb = {}, inter = 0;
a.forEach(function (x) { sa[x] = true;});
b.forEach(function (x) { sb[x] = true;});
Object.keys(sa).forEach(function (x) { if (sb[x]) inter++;});
var uni = Object.keys(sa).length + Object.keys(sb).length - inter;
return uni === 0? 0: inter / uni;
}
function bm25Score(qToks, docToks, docLen, avgLen, df, totalDocs, cfg) {
/* A24 Memori 手写 BM25：k1=1.2、b=0.75；IDF 平滑处理避免负值 */
var k1 = cfg.hybrid.bm25k1, b = cfg.hybrid.bm25b, score = 0;
var freq = {};
docToks.forEach(function (t) { freq[t] = (freq[t] || 0) + 1;});
qToks.forEach(function (t) {
var f = freq[t] || 0; if (!f) return;
var d = df[t] || 1;
var idf = Math.log(1 + (totalDocs - d + 0.5) / (d + 0.5));
score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / (avgLen || 1))));
});
return score;
}
function hybridWeights(queryWordCount, cfg) {
/* A24：短查询（<=2 词）词法权重提到 0.30；权重钳在 [0.05, 0.40] */
var lex = queryWordCount <= 2? cfg.hybrid.shortLexical: cfg.hybrid.lexical;
lex = Math.max(cfg.hybrid.clampMin, Math.min(cfg.hybrid.clampMax, lex));
return { lexical: lex, dense: 1 - lex, note: '无 embedding 时 dense 分为 0，仅词法分参与排序（模板模式）'};
}
/* A25 融合公式：max(vec, fts) + 0.3 x min(vec, fts)（只借公式思路，自写） */
function fuseScores(a, b, cfg) { return Math.max(a, b) + (cfg.fusionBonus || 0.3) * Math.min(a, b);}
/* A26 RRF 融合：score = sum 1/(k + rank)，k=60 */
function rrfFuse(rankLists, k) {
k = k || 60;
var scores = {};
rankLists.forEach(function (list) {
list.forEach(function (id, i) { scores[id] = (scores[id] || 0) + 1 / (k + i + 1);});
});
return Object.keys(scores).map(function (id) { return { id: id, score: scores[id]};})
.sort(function (a, b) { return b.score - a.score;});
}

/* ── 2 · 自动抓取触发：A1 防抖 / A2 批量 / A3 切分 ───────────────────── */
function createDebouncer(cfg) {
/* A1 langmem 防抖思路：对话静止 quietMs 且无新消息才提炼；新消息取消旧任务。
纯状态机（无定时器），便于测试；生产侧 armDebounce 再包一层 setTimeout。 */
var st = { pendingSince: 0, lastMsgAt: 0, cancelled: 0};
return {
state: st,
noteMessage: function (nowMs) { st.lastMsgAt = nowMs; if (st.pendingSince) { st.pendingSince = 0; st.cancelled++;} return st;},
arm: function (nowMs) { if (!st.pendingSince) st.pendingSince = nowMs; return st;},
dueAt: function () { return st.pendingSince? st.pendingSince + cfg.quietMs: 0;},
fireIfDue: function (nowMs) {
if (st.pendingSince && nowMs - st.lastMsgAt >= cfg.quietMs && nowMs >= st.pendingSince + cfg.quietMs) {
st.pendingSince = 0; return { fired: true, at: nowMs};
}
return { fired: false, at: 0};
}
};
}
var extractDebouncer = null;
function getDebouncer() { if (!extractDebouncer) extractDebouncer = createDebouncer(getConfig()); return extractDebouncer;}
function armDebounceExtraction(onFire) {
/* 生产侧：setTimeout 只负责到时回调一次，取消靠 noteMessage；不做循环定时器。 */
var d = getDebouncer(), cfg = getConfig();
d.arm(Date.now());
setTimeout(function () {
var r = d.fireIfDue(Date.now());
if (r.fired && typeof onFire === 'function') { try { onFire(r);} catch (e) {}}
}, cfg.quietMs + 50);
return d.dueAt();
}
function batchTriggerCheck(input) {
/* A2 memobase 缓冲批量：攒 >1024 tokens 或闲置 1 小时，或手动，才跑一次 */
var cfg = getConfig();
var buffered = input.bufferedTokens || 0, idleMs = input.idleMs || 0;
if (input.manual) return { ready: true, reason: 'manual 手动触发'};
if (buffered > cfg.batchTokens) return { ready: true, reason: 'buffer>' + cfg.batchTokens + 'tokens（已攒 ' + buffered + '）'};
if (idleMs >= cfg.batchIdleMs) return { ready: true, reason: 'idle>1h（闲置 ' + Math.round(idleMs / 60000) + ' 分钟）'};
return { ready: false, reason: '未达阈值：已攒 ' + buffered + '/' + cfg.batchTokens + ' tokens，闲置 ' + Math.round(idleMs / 60000) + ' 分钟'};
}
function splitSegments(messages, nowMs, cfg) {
/* A3 MemOS 任务边界：话题切换（Jaccard < 0.2）或 2 小时空闲即断段 */
cfg = cfg || getConfig();
var segs = [], cur = null, prevToks = null, prevTs = 0;
(messages || []).forEach(function (m) {
var ts = m.ts || 0, toks = tokenize(m.text || m.content || '');
var boundary = false, why = '';
if (!cur) { boundary = true; why = 'start';}
else if (ts - prevTs > cfg.segmentIdleMs) { boundary = true; why = 'idle>2h';}
else if (prevToks && jaccard(prevToks, toks) < cfg.topicSwitchJaccard) { boundary = true; why = 'topic-switch';}
if (boundary) { cur = { id: uid('seg'), startedAt: ts, why: why, messages: []}; segs.push(cur);}
cur.messages.push(m); prevToks = toks; prevTs = ts;
});
return segs;
}
function fourPartSummary(segment) {
/* A3 四段式结构摘要（目标/关键步骤/结果/关键细节）：模板抽取，标注模板模式 */
var lines = (segment.messages || []).map(function (m) { return String(m.text || m.content || '');}).filter(Boolean);
var goal = lines[0] || '';
var steps = lines.filter(function (l) { return /要做|记得|先|然后|接着|完成|去|买|约/.test(l);}).slice(0, 5);
var result = lines[lines.length - 1] || '';
var details = lines.filter(function (l) { return /\d{1,2}[:：]\d{2}|\d+月\d+日|明天|后天|周[一二三四五六日]/.test(l);}).slice(0, 5);
return { mode: 'template', segmentId: segment.id, boundary: segment.why,
goal: goal.slice(0, 120), steps: steps, result: result.slice(0, 120), details: details,
text: '目标：' + goal.slice(0, 80) + '；步骤：' + steps.join(' / ').slice(0, 200) + '；结果：' + result.slice(0, 80) + '；关键细节：' + details.join(' / ').slice(0, 200)};
}

/* ── 3 · 实体关系抽取：A4 管线 / A5 语法 / A6 本体 / A7 四层 / A8 标签 ── */
var PLACE_WORDS_BD = ['学校', '公司', '家里', '家', '公园', '展览', '电影院', '咖啡馆', '图书馆', '车站', '超市', '餐厅', '海边', '山上', '医院', '机场'];
/* A6 memobase 画像本体论思路：8 主题 x ~40 槽位（自写槽位名，按需填，不预填内容） */
var PROFILE_ONTOLOGY = {
  '基本信息': ['姓名', '昵称', '生日', '城市', '职业'],
  '联系': ['电话', '邮箱', '微信', '常用联系人', '紧急联系人'],
  '教育': ['学校', '专业', '学位', '毕业年份'],
  '工作': ['公司', '职位', '行业', '项目'],
  '兴趣': ['喜欢的食物', '喜欢的音乐', '喜欢的书', '喜欢的电影', '运动', '游戏', '收藏'],
  '心理': ['性格', '在意的事', '压力来源', '放松方式', '口头禅'],
  '生活': ['作息', '饮食偏好', '健康状况', '住所', '宠物'],
  '生活事件': ['重要日子', '纪念日', '旅行', '里程碑', '最近变化']
};
var EPISTEMIC_TYPES = ['world_fact', 'experience', 'observation', 'mental_model']; /* A7 hindsight 四层：世界事实/经历/观察/心智模型 */
var AUG_TAGS = ['属性', '事件', '事实', '人物', '偏好', '关系', '规则', '技能']; /* A8 Memori 8 类，新增“规则”与“技能” */
function extractEntities(text, aliasDict) {
  /* A4 graphiti 五步管线思路（自写规则版）：抽实体 -> 去重 -> 抽关系边 -> 解析边 -> 落图。
     实体来源：[[...]] 标注、人名（记忆库里出现过的人名 + 称呼）、地点词表。 */
  var s = String(text || ''), nodes = [], seen = {};
  var wiki = s.match(/\[\[([^\]]+)\]\]/g) || [];
  wiki.forEach(function (w) { var n = w.slice(2, -2).trim(); if (n && !seen[n]) { seen[n] = 1; nodes.push({ name: n, kind: 'entity', source: 'wiki-link' }); } });
  (aliasDict || []).forEach(function (name) { if (name && s.indexOf(name) >= 0 && !seen[name]) { seen[name] = 1; nodes.push({ name: name, kind: 'person', source: 'alias-dict' }); } });
  PLACE_WORDS_BD.forEach(function (p) { if (s.indexOf(p) >= 0 && !seen[p]) { seen[p] = 1; nodes.push({ name: p, kind: 'place', source: 'place-list' }); } });
  return nodes;
}
function extractEdges(text, nodes) {
  /* A4 第三步：关系边（模板规则版）。边带 valid_at/invalid_at 双时间（A4/A45）。 */
  var s = String(text || ''), edges = [], now = Date.now();
  var m;
  if ((m = s.match(/(.+?)\s*喜欢\s*(.+)/))) edges.push({ from: m[1].slice(-12), to: m[2].slice(0, 20), rel: '喜欢', valid_at: now, invalid_at: null });
  if ((m = s.match(/(.+?)\s*在\s*([^\s，。,]+)/))) edges.push({ from: m[1].slice(-12), to: m[2].slice(0, 20), rel: '在', valid_at: now, invalid_at: null });
  if ((m = s.match(/(.+?)\s*和\s*(.+?)\s*约好/))) edges.push({ from: m[1].slice(-12), to: m[2].slice(0, 20), rel: '约好', valid_at: now, invalid_at: null });
  if ((m = s.match(/(.+?)\s*决定\s*(.+)/))) edges.push({ from: m[1].slice(-12), to: m[2].slice(0, 20), rel: '决定', valid_at: now, invalid_at: null });
  return edges;
}
function graphLoad() { var g = lsGet(GRAPH_KEY, null); if (!g || typeof g !== 'object') g = { entities: {}, edges: [] }; if (!g.entities) g.entities = {}; if (!Array.isArray(g.edges)) g.edges = []; return g; }
function graphSave(g) { lsSet(GRAPH_KEY, g); return g; }
function addEdge(fromId, toId, type, opts) {
  /* A12 supermemory 三类关系边：updates（取代，旧的退出搜索、历史保留）/ extends（补充）/ derives（推断） */
  if (['updates', 'extends', 'derives'].indexOf(type) < 0) return { ok: false, reason: 'type must be updates|extends|derives' };
  var g = graphLoad();
  var edge = { id: uid('edge'), from: fromId, to: toId, type: type, isInference: type === 'derives',
    valid_at: Date.now(), invalid_at: null, episodes: (opts && opts.episodes) || [], createdAt: Date.now() };
  g.edges.push(edge);
  if (type === 'updates') {
    g.edges.forEach(function (e) { if (e.to === toId && e.id !== edge.id && !e.invalid_at) { e.invalid_at = edge.valid_at; } });
  }
  graphSave(g);
  auditLog({ kind: 'edge', action: 'add', edgeId: edge.id, type: type, from: fromId, to: toId });
  return { ok: true, edge: edge };
}
function graphRecall(startId, depth, sinceDays, nowMs) {
  /* A31 图遍历取回：从一个记忆出发沿关系边走 depth 1-5，配合 since 时间窗口 */
  var cfg = getConfig(), g = graphLoad();
  depth = Math.max(1, Math.min(5, depth || cfg.searchDefaults.depth || 1));
  var since = (nowMs || Date.now()) - (sinceDays == null ? cfg.searchDefaults.sinceDays : sinceDays) * 864e5;
  var seen = {}, frontier = [startId], out = [];
  for (var d = 0; d < depth && frontier.length; d++) {
    var next = [];
    frontier.forEach(function (id) {
      g.edges.forEach(function (e) {
        if (e.invalid_at) return;
        if (e.createdAt < since) return;
        var other = null;
        if (e.from === id) other = e.to; else if (e.to === id) other = e.from;
        if (other && !seen[other]) { seen[other] = 1; out.push({ id: other, depth: d + 1, via: e.id, type: e.type }); next.push(other); }
      });
    });
    frontier = next;
  }
  return out.slice(0, cfg.searchDefaults.maxRelated || 10);
}
/* A5 basic-memory Observation/Relation 语法思路（只借语法，不抄解析代码）：
   - [类别] 文本 #标签 (上下文) ；- 关系类型 [[目标]] */
function parseObservationLine(line) {
  var s = String(line || '').trim();
  var rel = s.match(/^-\s*([^\s\[]+)\s*\[\[([^\]]+)\]\]\s*$/);
  if (rel) return { kind: 'relation', relType: rel[1], target: rel[2], raw: s };
  var m = s.match(/^-\s*\[([^\]]+)\]\s*(.+?)(?:\s*#([^\s(]+))?(?:\s*\(([^)]+)\))?\s*$/);
  if (!m) return null;
  var tags = [];
  var tagMatch = s.match(/#([\u4e00-\u9fa5A-Za-z0-9_]+)/g) || [];
  tagMatch.forEach(function (t) { tags.push(t.slice(1)); });
  return { kind: 'observation', category: m[1], text: m[2], tags: tags, context: m[4] || '', raw: s };
}
function serializeObservation(o) {
  if (!o) return '';
  if (o.kind === 'relation') return '- ' + o.relType + ' [[' + o.target + ']]';
  return '- [' + (o.category || '事实') + '] ' + (o.text || '') + (o.tags && o.tags.length ? ' #' + o.tags.join(' #') : '') + (o.context ? ' (' + o.context + ')' : '');
}
function tagMemory(text) {
  /* A8：规则/技能两类新增；其余按关键词判型 */
  var s = String(text || ''), tags = [];
  if (/喜欢|最喜欢|偏爱|讨厌/.test(s)) tags.push('偏好');
  if (/决定|以后|规则|不许|必须|约定/.test(s)) tags.push('规则');
  if (/学会|会做|技能|方法|怎么做|步骤/.test(s)) tags.push('技能');
  if (/今天|昨天|去了|发生|遇到/.test(s)) tags.push('事件');
  if (/是|在|有|属于/.test(s)) tags.push('事实');
  if (tags.length === 0) tags.push('事实');
  return tags;
}
function classifyEpistemic(text) {
  /* A7 四层启发式（模板）：已沉淀结论 / 经历 / 观察 / 世界事实 */
  var s = String(text || '');
  if (/我发现|原来|其实|道理|结论|明白了/.test(s)) return 'mental_model';
  if (/今天|昨天|去了|经历|第一次|记得那次/.test(s)) return 'experience';
  if (/看到|听到|注意到|感觉|好像/.test(s)) return 'observation';
  return 'world_fact';
}
function profileLoad() { var p = lsGet(PROFILE_KEY, null); if (!p || typeof p !== 'object') p = { static: {}, dynamic: {}, subtopics: [] }; return p; }
function profileSave(p) { lsSet(PROFILE_KEY, p); return p; }
function fillProfileSlot(theme, slot, value) {
  /* A6 填槽 + A62 上限：单主题 128 tokens、单画像子主题上限 15 个；超限拒绝并返回原因 */
  var cfg = getConfig();
  var p = profileLoad();
  if (!PROFILE_ONTOLOGY[theme] || PROFILE_ONTOLOGY[theme].indexOf(slot) < 0) return { ok: false, reason: 'unknown slot' };
  var cur = p.static[theme] || {};
  var trial = Object.assign({}, cur); trial[slot] = String(value || '').slice(0, 500);
  var total = 0;
  Object.keys(trial).forEach(function (k) { total += estTokens(trial[k]); });
  if (total > cfg.profileCaps.themeTokens) return { ok: false, reason: 'theme over 128 tokens cap' };
  if (p.subtopics.length >= cfg.profileCaps.subtopics && p.subtopics.indexOf(theme + ':' + slot) < 0) return { ok: false, reason: 'profile over 15 subtopics cap' };
  p.static[theme] = trial;
  if (p.subtopics.indexOf(theme + ':' + slot) < 0) p.subtopics.push(theme + ':' + slot);
  profileSave(p);
  return { ok: true, theme: theme, slot: slot, themeTokens: total };
}
function profileSnapshot() {
  /* A13 画像两层：static 长期稳定常驻 + dynamic 近期动态每日滚动 */
  var p = profileLoad();
  return { static: p.static, dynamic: p.dynamic, subtopics: p.subtopics, caps: getConfig().profileCaps };
}
function extractionContext(recentMsgs, facts) {
  /* A9 mem0 V3 抽取上下文配方（second-hand）：最近 10 条 + 10 条最相似事实 + 2 个日期 */
  var now = new Date(), y = new Date(now.getTime() - 864e5);
  var recent = (recentMsgs || []).slice(-10);
  var qToks = tokenize(recent.map(function (m) { return m.text || m.content || ''; }).join(' '));
  var scored = (facts || []).map(function (f) {
    var t = memText(f);
    return { fact: f, sim: jaccard(qToks, tokenize(t)) };
  }).sort(function (a, b) { return b.sim - a.sim; }).slice(0, 10).map(function (x) { return x.fact; });
  return { recent: recent, similarFacts: scored, dates: [todayStr(now), todayStr(y)] };
}
function extractFactsFromMessages(messages, opts) {
  /* A10 结构化抽取 schema：事实模型只一个 content 字段起步（B2 重写：模型抽取→模板规则）。
     只产候选，绝不自动入库；返回的每条候选都带 isInference=false 与证据来源。 */
  opts = opts || {};
  var cfg = getConfig();
  var total = 0, out = [];
  var aliasDict = [];
  loadMemories().forEach(function (m) { var t = memText(m); var mm = t.match(/[\u4e00-\u9fa5]{2,4}(?=喜欢|决定|说|去)/g); if (mm) mm.forEach(function (n) { if (aliasDict.indexOf(n) < 0) aliasDict.push(n); }); });
  (messages || []).forEach(function (msg) {
    var text = String(msg.text || msg.content || '');
    if (!text) return;
    total += estTokens(text);
    if (total > cfg.processCapTokens) return; /* A63 处理截断 16384 tokens */
    var hit = null;
    if (/我喜欢|我最喜欢/.test(text)) hit = { factKey: '喜好.' + text.replace(/.*喜欢/, '').replace(/[，。、；：！？\s].*$/, '').slice(0, 12) };
    else if (/我决定|决定了/.test(text)) hit = { factKey: '决定.' + todayStr() };
    else if (/约好|约定/.test(text)) hit = { factKey: '约定.' + todayStr() };
    else if (/每天|坚持|打卡/.test(text)) hit = { factKey: '习惯.' + text.replace(/.*(每天|坚持|打卡)/, '').slice(0, 12) };
    if (!hit) return;
    var entities = extractEntities(text, aliasDict);
    var edges = extractEdges(text, entities);
    out.push({ content: text.slice(0, 300), factKey: hit.factKey, entities: entities, edges: edges,
      tags: tagMemory(text), epistemic: classifyEpistemic(text), isInference: false,
      evidence: { msgId: msg.id || '', quote: text.slice(0, 80) }, source: 'template-extract' });
  });
  return out;
}

/* ── 4 · 审查队列：A11 推断打标 / A66 两列 / A14 导入溯源 / A15 事件流 ── */
function reviewLoad() { var r = lsGet(REVIEW_KEY, []); return Array.isArray(r) ? r : []; }
function reviewSave(r) { lsSet(REVIEW_KEY, r); return r; }
function proposeCandidateBD(cand) {
  /* B18 重写：自动入库改为走审阅流；推断记忆单独一列（A11/A66） */
  var scan = defenseScan(cand.content || '');
  if (scan.blocked) return { ok: false, reason: 'defense-blocked', hits: scan.hits };
  var r = reviewLoad();
  var item = { id: uid('bdcd'), content: String(cand.content || '').slice(0, 300),
    factKey: cand.factKey || '', tags: cand.tags || [], epistemic: cand.epistemic || 'world_fact',
    isInference: !!cand.isInference, status: 'pending', source: cand.source || 'bd-extract',
    evidence: cand.evidence || null, entities: cand.entities || [], createdAt: Date.now() };
  r.push(item); reviewSave(r);
  return { ok: true, candidate: item, column: item.isInference ? 'inference' : 'ordinary' };
}
function reviewQueue() {
  var r = reviewLoad();
  return {
    ordinary: r.filter(function (x) { return !x.isInference && x.status === 'pending'; }),
    inference: r.filter(function (x) { return x.isInference && x.status === 'pending'; }),
    decided: r.filter(function (x) { return x.status !== 'pending'; })
  };
}
function reviewDecide(id, approve) {
  var r = reviewLoad(), item = null;
  r.forEach(function (x) { if (x.id === id) item = x; });
  if (!item || item.status !== 'pending') return { ok: false, reason: 'not_found_or_decided' };
  item.status = approve ? 'approved' : 'rejected';
  item.decidedAt = Date.now();
  reviewSave(r);
  auditLog({ kind: 'review', action: item.status, candidateId: id, isInference: item.isInference });
  if (!approve) return { ok: true, candidate: item, memory: null };
  var mems = loadMemories();
  var mem = { id: uid('mem'), content: item.content, text: item.content, category: '日常记忆',
    date: todayStr(), type: item.epistemic === 'mental_model' ? '反思' : '对话',
    factKey: item.factKey || '', fact_key: item.factKey || '', recall: 'ask',
    isInference: item.isInference, bdRev: 1, createdAt: Date.now(), bdNamespace: namespaceFor(currentIdentityId()) };
  mems.push(mem); saveMemories(mems);
  return { ok: true, candidate: item, memory: mem };
}
function recordIngestionRun(source, fileHash, count) {
  var s = getState();
  s.ingestionRuns.push({ id: uid('ing'), source: source, fileHash: fileHash, count: count, at: Date.now() });
  if (s.ingestionRuns.length > 50) s.ingestionRuns = s.ingestionRuns.slice(-50);
  saveState(s);
  return s.ingestionRuns[s.ingestionRuns.length - 1];
}
function importMemoriesBD(items, source) {
  /* A14 basic-memory 导入溯源思路：derived_from + ingestion run + 重导 no-op；
     A58 内容哈希去重。导入一律先挂起为待定草稿（BD 审查队列），永不自动加入回忆。 */
  var s = getState();
  var incoming = (items || []).map(function (it) { return typeof it === 'string' ? { content: it } : it; });
  var fileHash = contentHash(incoming.map(function (it) { return String(it.content || it.text || ''); }).join('\n'));
  var prev = null;
  s.ingestionRuns.forEach(function (run) { if (run.source === source && run.fileHash === fileHash) prev = run; });
  if (prev) return { ok: true, noop: true, reason: '重导未改动文件是 no-op', runId: prev.id, added: 0, dup: incoming.length };
  var existing = {};
  loadMemories().forEach(function (m) { existing[contentHash(memText(m))] = 1; });
  reviewLoad().forEach(function (c) { existing[contentHash(c.content)] = 1; });
  var added = 0, dup = 0;
  incoming.forEach(function (it) {
    var text = String(it.content || it.text || '').trim();
    if (!text) return;
    if (existing[contentHash(text)]) { dup++; return; }
    existing[contentHash(text)] = 1;
    var r = proposeCandidateBD({ content: text, factKey: it.factKey || '', source: 'import:' + source,
      evidence: { derived_from: source }, tags: tagMemory(text), epistemic: classifyEpistemic(text) });
    if (r.ok) added++;
  });
  var run = recordIngestionRun(source, fileHash, added);
  return { ok: true, noop: false, runId: run.id, added: added, dup: dup };
}
function logEventBD(type, text, profileDelta) {
  /* A15 统一事件流（已有设计，确认方向）：事件先落追加式流，各视图再聚合；事件带 profile_delta（A61） */
  var s = getState();
  s.events.push({ id: uid('ev'), type: type, text: String(text || '').slice(0, 300), profileDelta: profileDelta || null, ts: Date.now() });
  if (s.events.length > 500) s.events = s.events.slice(-500);
  saveState(s);
  return s.events[s.events.length - 1];
}

/* ── 5 · 自动总结：A16 预算 / A17 增量 / A18 压力 / A19 留跳 / A20-A23 ── */
function compressionNeeded(usedTokens, cfg) {
  /* A16：超过 maxTokensBeforeSummary 才压缩；摘要预留 summaryMaxTokens */
  cfg = cfg || getConfig();
  return { needed: usedTokens > cfg.budget.maxTokensBeforeSummary, used: usedTokens,
    threshold: cfg.budget.maxTokensBeforeSummary, reserve: cfg.budget.summaryMaxTokens,
    unverified: !!cfg.budget.unverified, note: '预算三参数为示例值，非默认值，未核实，按手机实测调整' };
}
function pressureCheck(usedTokens, capTokens) {
  /* A18：上下文压力触发压缩；70% 警告阈值是论文示例，未核实为产品配置 */
  var pct = capTokens ? usedTokens / capTokens : 0;
  return { pct: Math.round(pct * 1000) / 1000, warn: pct >= getConfig().pressureWarnPct,
    warnThreshold: getConfig().pressureWarnPct, unverified: !!getConfig().pressureWarnUnverified,
    action: pct >= getConfig().pressureWarnPct ? 'warn-and-compress-oldest' : 'ok' };
}
function summarizeIncremental(messages, state) {
  /* A17 langmem RunningSummary：记已摘要消息 id，下次只摘要新增部分 */
  state = state || getState();
  var fresh = (messages || []).filter(function (m) { return m.id && !state.summarizedIds[m.id]; });
  if (!fresh.length) return { done: false, reason: 'no-new', summary: null, newCount: 0 };
  var text = fresh.map(function (m) { return String(m.text || m.content || ''); }).filter(Boolean).join('；');
  var summary = { id: uid('sum'), mode: 'template', text: text.slice(0, 400),
    made_from: fresh.map(function (m) { return m.id; }), /* A21/A59 摘要回链 */
    source_chunk_id: fresh.length ? fresh[0].id : '', createdAt: Date.now() };
  fresh.forEach(function (m) { state.summarizedIds[m.id] = 1; });
  state.summaries.push(summary);
  if (state.summaries.length > 100) state.summaries = state.summaries.slice(-100);
  saveState(state);
  return { done: true, reason: 'ok', summary: summary, newCount: fresh.length };
}
/* A19 basic-memory memory-reflect“留/跳”清单（只借文字标准）+ 1-2 次/天节奏 */
var REFLECT_KEEP = [/决定|决心|以后|约定/, /教训|下次|再也不|应该/, /喜欢|偏好|讨厌|最爱/, /关系|朋友|家人|他|她/];
var REFLECT_SKIP = [/查.*天气|天气怎么样|今天.*天气/, /打开|点开|步骤|先.*再|操作/, /已收录|记过了/];
function reflectKeepSkip(items) {
  return (items || []).map(function (it) {
    var text = String(it.text || it.content || '');
    var skip = REFLECT_SKIP.some(function (re) { return re.test(text); });
    var keep = !skip && REFLECT_KEEP.some(function (re) { return re.test(text); });
    var reason = skip ? '跳过：查天气/例行步骤/已收录' : (keep ? '留下：决定/教训/偏好/关系细节' : '跳过：无留存价值');
    return { item: it, keep: keep, reason: reason };
  });
}
function nightReflectDue(nowMs) {
  var s = getState(), day = todayStr(new Date(nowMs));
  var runs = s.reflectRunsToday[day] || 0;
  var gapOk = !s.lastReflectAt || (nowMs - s.lastReflectAt) >= getConfig().reflectMinGapMs;
  return { due: runs < getConfig().reflectMaxPerDay && gapOk, runsToday: runs, maxPerDay: getConfig().reflectMaxPerDay, gapOk: gapOk };
}
function nightReflect(items, nowMs) {
  /* A19：夜间反思只写“留下”的条目；已收录/例行一律跳过；节奏 1-2 次/天 */
  var due = nightReflectDue(nowMs || Date.now());
  if (!due.due) return { done: false, reason: 'not-due', runsToday: due.runsToday };
  var judged = reflectKeepSkip(items);
  var kept = judged.filter(function (j) { return j.keep; }).map(function (j) { return j.item; });
  var s = getState(), day = todayStr(new Date(nowMs || Date.now()));
  s.reflectRunsToday[day] = (s.reflectRunsToday[day] || 0) + 1;
  s.lastReflectAt = nowMs || Date.now();
  saveState(s);
  return { done: true, kept: kept, skipped: judged.length - kept.length, runsToday: s.reflectRunsToday[day] };
}
function refineObservation(text, sourceIds) {
  /* A20 hindsight 观察层：精炼不改写，保留原话引文 + 证明计数（被多少来源佐证） */
  var s = String(text || '');
  return { kind: 'observation', quote: s, refined: s, evidenceCount: (sourceIds || []).length,
    sourceIds: sourceIds || [], note: '观察层只做精炼不改写；原话保留，证明计数为来源数' };
}
function daySummaryTwoPart(events) {
  /* A22 memobase：事件梗概（event gist）+ 画像增量（profile_delta）两段分开写 */
  var evs = events || [];
  var gist = evs.map(function (e) { return e.text || ''; }).filter(Boolean).join('；').slice(0, 400);
  var deltas = evs.map(function (e) { return e.profileDelta; }).filter(Boolean);
  return { mode: 'template', gist: gist, profileDelta: deltas, made_from: evs.map(function (e) { return e.id; }) };
}
function compressionPreview(beforeText, afterText) {
  /* A23 Hanami 压缩对比：压缩前/后对照 + 可编辑摘要；屏幕上的对话线程本身不动 */
  return { before: beforeText, after: afterText, beforeTokens: estTokens(beforeText), afterTokens: estTokens(afterText),
    editable: true, threadUntouched: true, note: '压缩只产出一份可编辑摘要，不改写原始对话线程' };
}

/* ── 6 · 召回：A24-A38（B1/B7 重写：向量→规则打分 + 简单融合） ─────────── */
var QUERY_ROUTES = [ /* A33 cognee 规则路由思路：正则/关键词分流到检索策略（自写 16 种） */
  { id: 'fact', re: /是什么|多少|哪里|哪个|什么时候|是谁/ },
  { id: 'preference', re: /喜欢|讨厌|偏爱|最爱/ },
  { id: 'decision', re: /决定|约定|承诺|说好/ },
  { id: 'schedule', re: /明天|后天|周[一二三四五六日]|几点|约/ },
  { id: 'person', re: /他|她|朋友|家人|同事|妈妈|爸爸/ },
  { id: 'place', re: /在哪|去哪|学校|公司|家里|公园|咖啡馆/ },
  { id: 'emotion', re: /开心|难过|生气|累|想念|害怕/ },
  { id: 'habit', re: /每天|坚持|打卡|习惯/ },
  { id: 'rule', re: /规则|不许|必须|应该|约定俗成/ },
  { id: 'skill', re: /怎么|如何|方法|步骤|学会/ },
  { id: 'experience', re: /记得.*时候|那次|第一次|经历/ },
  { id: 'summary', re: /总结|回顾|这周|这个月|最近怎么样/ },
  { id: 'date', re: /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d+月\d+日/ },
  { id: 'quote', re: /原话|他说|她说|说过/ },
  { id: 'conflict', re: /改了|不对|以前.*现在|换了/ },
  { id: 'general', re: /.*/ }
];
function routeQuery(q) {
  var s = String(q || '');
  for (var i = 0; i < QUERY_ROUTES.length; i++) { if (QUERY_ROUTES[i].re.test(s)) return QUERY_ROUTES[i].id; }
  return 'general';
}
var SYNONYMS_BD = { '喜欢': ['喜爱', '爱', '偏爱'], '开心': ['高兴', '快乐'], '难过': ['伤心', '不开心'], '累': ['疲惫', '辛苦'], '约': ['约好', '见面'], '去': ['前往', '到'] };
function rewriteQueries(q) {
  /* A32 langmem 多查询并行 + 去重思路（自写同义词扩展，无模型） */
  var s = String(q || ''), out = [s], seen = {};
  seen[s] = 1;
  Object.keys(SYNONYMS_BD).forEach(function (k) {
    if (s.indexOf(k) >= 0) SYNONYMS_BD[k].forEach(function (syn) {
      var v = s.split(k).join(syn);
      if (!seen[v]) { seen[v] = 1; out.push(v); }
    });
  });
  return out;
}
function sessionCacheLookup(q) {
  /* A34 cognee 会话缓存优先：Jaccard token 重叠 >= 0.5 即命中，不走全量召回 */
  var s = getState(), qt = tokenize(q), best = null, bestSim = 0;
  (s.sessionCache || []).forEach(function (entry) {
    var sim = jaccard(qt, tokenize(entry.query));
    if (sim > bestSim) { bestSim = sim; best = entry; }
  });
  if (best && bestSim >= 0.5) return { hit: true, sim: bestSim, result: best.result };
  return { hit: false, sim: bestSim };
}
function sessionCacheStore(q, result) {
  var s = getState();
  s.sessionCache.push({ query: q, result: result, at: Date.now() });
  if (s.sessionCache.length > 20) s.sessionCache = s.sessionCache.slice(-20);
  saveState(s);
}
function simpleHash(text) { return contentHash(text); }
function scoreMemories(query, mems, cfg, nowMs) {
  /* A24/A25/A30：BM25 词法分 + 混合权重 + 融合公式；过期先过滤、再取 top_k（A41 顺序的一部分） */
  var qToks = tokenize(query);
  var docs = mems.map(function (m) { return { m: m, toks: tokenize(memText(m)) }; });
  var total = docs.length || 1;
  var df = {};
  docs.forEach(function (d) { var seen = {}; d.toks.forEach(function (t) { if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } }); });
  var avgLen = docs.reduce(function (a, d) { return a + d.toks.length; }, 0) / total;
  var w = hybridWeights(qToks.length, cfg);
  return docs.map(function (d) {
    var lex = bm25Score(qToks, d.toks, d.toks.length, avgLen, df, total, cfg);
    var dense = 0; /* 无 embedding：dense 分为 0（模板模式），见 hybridWeights 注释 */
    var fused = fuseScores(lex, dense, cfg);
    var days = d.m && memTs(d.m) ? Math.max(0, (nowMs - memTs(d.m)) / 864e5) : 30;
    var imp = (d.m && typeof d.m.importance === 'number') ? d.m.importance : 5;
    return { id: d.m.id, mem: d.m, lexical: Math.round(lex * 1000) / 1000, dense: dense,
      fused: Math.round(fused * 1000) / 1000, relevanceScore: Math.round(fused * 100) / 100,
      days: Math.round(days * 10) / 10, importance: imp, weights: w };
  });
}
function decayFactor(ageDays, cfg, profile) {
  /* A39 hindsight 线性衰减：窗口 365 天、半衰期 90 天；因子 = max(0, 1 - age/(2*halfLife))，
     超过窗口归 0。A40 14 天轻量档为 second-hand，未核实，仅作可选档。 */
  cfg = cfg || getConfig();
  var hl = (profile === 'light14') ? cfg.decay.lightHalfLifeDays : cfg.decay.halfLifeDays;
  if (ageDays > cfg.decay.windowDays) return 0;
  return Math.max(0, 1 - ageDays / (2 * hl));
}
function recallPipeline(scored, opts, nowMs) {
  /* A41 mem0 执行顺序（second-hand）：阈值 -> 衰减 -> 过期过滤（过期在取 top_k 之前） */
  var cfg = getConfig();
  opts = opts || {};
  var profile = opts.decayProfile || cfg.decay.profile;
  var step1 = scored.filter(function (x) { return x.fused >= (opts.threshold == null ? cfg.threshold : opts.threshold); });
  var step2 = step1.map(function (x) {
    var f = decayFactor(x.days, cfg, profile);
    var y = Object.assign({}, x); y.decay = Math.round(f * 1000) / 1000; y.decayedScore = Math.round(x.fused * f * 1000) / 1000;
    return y;
  });
  var step3 = step2.filter(function (x) {
    var m = x.mem || {};
    if (m.archived) return false;
    if (m.recall === 'never') return false;
    if (m.tombstone) return false;
    if (m.forgetAfter && nowMs > m.forgetAfter) return false; /* A42 到期退出搜索，不物理删 */
    if (m.invalid_at || m.expired_at) return false; /* A45 已失效事实不进召回，历史保留 */
    return true;
  });
  step3.sort(function (a, b) { return b.decayedScore - a.decayedScore; });
  return step3.slice(0, opts.topK || cfg.topK);
}
function applyRecallBudgets(items, cfg) {
  /* A27 hindsight 召回 token 预算：事实 2048 / 文本块 1000 / 去重 512 */
  cfg = cfg || getConfig();
  var b = cfg.recallBudgets, used = 0, kept = [], dedupUsed = 0;
  var seen = {};
  items.forEach(function (x) {
    var t = memText(x.mem || x);
    var h = contentHash(t);
    if (seen[h]) return; /* 去重 */
    var tk = estTokens(t);
    if (used + tk > b.facts) return;
    if (dedupUsed + tk > b.facts + b.dedup) return;
    seen[h] = 1; used += tk; dedupUsed += tk;
    kept.push(x);
  });
  return { items: kept, usedTokens: used, budgets: b };
}
function recallBD(query, opts) {
  /* A24-A38 主召回：缓存优先 -> 多查询并行去重 -> 打分融合 -> 管线 -> 预算；两档（A37） */
  opts = opts || {};
  var cfg = getConfig(), nowMs = opts.nowMs || Date.now();
  var cache = sessionCacheLookup(query);
  if (cache.hit && !opts.bypassCache) return { fromCache: true, sim: cache.sim, results: cache.result };
  var mems = loadMemories();
  var queries = rewriteQueries(query);
  var all = {};
  queries.forEach(function (q) {
    scoreMemories(q, mems, cfg, nowMs).forEach(function (x) { if (!all[x.id] || x.fused > all[x.id].fused) all[x.id] = x; });
  });
  var scored = Object.keys(all).map(function (k) { return all[k]; });
  /* A26 RRF：把词法排序与时间排序两路按 RRF k=60 融合，再与打分排序取交集顺序 */
  var byLex = scored.slice().sort(function (a, b) { return b.lexical - a.lexical; }).map(function (x) { return x.id; });
  var byTime = scored.slice().sort(function (a, b) { return a.days - b.days; }).map(function (x) { return x.id; });
  var rrf = rrfFuse([byLex, byTime], cfg.rrfK);
  var rrfRank = {}; rrf.forEach(function (r, i) { rrfRank[r.id] = i; });
  scored.forEach(function (x) { x.rrfRank = rrfRank[x.id] == null ? 999 : rrfRank[x.id]; });
  var piped = recallPipeline(scored, opts, nowMs);
  var budgeted = applyRecallBudgets(piped, cfg);
  var tier = opts.tier || 'full'; /* A37 两档：full 全文 vs summary 只给摘要版 */
  var results = budgeted.items.map(function (x) {
    var m = x.mem;
    return { id: x.id, text: tier === 'summary' ? memText(m).slice(0, 60) : memText(m),
      tier: tier, score: x.decayedScore, relevanceScore: x.relevanceScore,
      evidence: { /* A35 证据回链：命中 chunk 原文 + permalink + checksum + 相关度 */
        quote: memText(m).slice(0, 80),
        permalink: 'wechat://chat/' + ((m.source && m.source.chatId) || '') + '#' + ((m.source && m.source.msgIds) || []).join(','),
        checksum: simpleHash(memText(m)),
        relevanceScore: x.relevanceScore,
        reason: m.reason || ''
      },
      edgeIds: (m.bdEdgeIds || []) /* A36 边 <-> 剧集双向回链的一半 */
    };
  });
  if (!opts.bypassCache) sessionCacheStore(query, results);
  return { fromCache: false, route: routeQuery(query), queries: queries, results: results,
    usedTokens: budgeted.usedTokens, budgets: budgeted.budgets, tier: tier, mode: 'template' };
}
function assembleContext(query, opts) {
  /* A38 画像 + 最近事件在前，再拼检索命中；固定四段顺序与既有设计一致 */
  opts = opts || {};
  var prof = profileSnapshot();
  var s = getState();
  var recentEvents = (s.events || []).slice(-5);
  var rec = recallBD(query, opts);
  var mems = loadMemories();
  var recentLines = mems.slice(-20).map(function (m) { return memText(m); });
  return { sections: [
    { name: 'profile-static', items: prof.static },
    { name: 'profile-dynamic', items: prof.dynamic },
    { name: 'recent-events', items: recentEvents.map(function (e) { return e.text; }) },
    { name: 'recall-hits', items: rec.results.map(function (r) { return r.text; }) },
    { name: 'recent-lines', items: recentLines }
  ], recall: rec, mode: 'template' };
}
function searchMemoriesBD(q) {
  /* A68 按日期 + 原话引用搜聊天/记忆 */
  var query = q || {};
  var mems = loadMemories();
  return mems.filter(function (m) {
    if (query.date && String(m.date || '').slice(0, 10) !== String(query.date).slice(0, 10)) return false;
    if (query.quote && memText(m).indexOf(String(query.quote)) < 0) return false;
    if (query.text && memText(m).toLowerCase().indexOf(String(query.text).toLowerCase()) < 0) return false;
    return true;
  }).map(function (m) { return { id: m.id, text: memText(m), date: m.date || '', quote: memText(m).slice(0, 80) }; });
}

/* ── 7 · 遗忘：A39-A51 ─────────────────────────────────────────────── */
function preferenceReinforce(factKey) {
  /* A43 supermemory 定性规则（无参数，未核实）：同一偏好被多次提到则显著度上升 */
  var mems = loadMemories(), changed = 0;
  mems.forEach(function (m) {
    if ((m.factKey || m.fact_key) === factKey) {
      m.mentions = (m.mentions || 0) + 1;
      m.importance = Math.min(10, (typeof m.importance === 'number' ? m.importance : 5) + 0.5);
      changed++;
    }
  });
  if (changed) saveMemories(mems);
  return { factKey: factKey, reinforced: changed };
}
function importanceSortKey(distance, importanceWeight) {
  /* A44 cognee：三元组距离 x (2 - importance_weight)，weight 0-1 默认 0.5，沿推导链继承 */
  var w = (typeof importanceWeight === 'number') ? importanceWeight : 0.5;
  return distance * (2 - w);
}
function setForgetAfter(memId, ts) {
  /* A42 supermemory forgetAfter：到期自动退出搜索（是否物理删除未核实），删除另行确认 */
  var mems = loadMemories(), t = null;
  mems.forEach(function (m) { if (m.id === memId) t = m; });
  if (!t) return null;
  t.forgetAfter = ts; saveMemories(mems);
  return t;
}
function localAdjudicate(newText, topK) {
  /* A47 MemOS 本地版：相似度阈值 0.75、取 Top-5 相似后裁决 DUPLICATE/UPDATE/NEW（规则版，无 LLM） */
  var cfg = getConfig();
  var qt = tokenize(newText);
  var scored = loadMemories().map(function (m) {
    return { mem: m, sim: jaccard(qt, tokenize(memText(m))) };
  }).sort(function (a, b) { return b.sim - a.sim; }).slice(0, topK || cfg.localTopK);
  return scored.map(function (x) {
    var verdict = x.sim >= cfg.localSim ? (x.sim >= 0.95 ? 'DUPLICATE' : 'UPDATE') : 'NEW';
    return { id: x.mem.id, text: memText(x.mem), sim: Math.round(x.sim * 1000) / 1000, verdict: verdict };
  });
}
function conflictAdjudicate(newText) {
  /* A46 MemOS：相似度 >0.80（second-hand，未核实）走裁决，旧版本进历史并标 update_type */
  var cfg = getConfig();
  var cands = localAdjudicate(newText, cfg.localTopK);
  var hit = null;
  cands.forEach(function (c) { if (!hit && c.sim >= cfg.conflictSim) hit = c; });
  return { threshold: cfg.conflictSim, unverified: !!cfg.conflictSimUnverified,
    needsAdjudication: !!hit, top: cands, hit: hit };
}
function resolveFactConflictBD(factKey, newValue, decision, nowMs) {
  /* A45 graphiti 冲突自动失效规则（借规则、执行须用户确认，见调用方）：
     新事实的 valid_at 成为旧事实的 invalid_at，旧事实保留、可按时间点查询；
     A51/A50：补失效时间与改动类型字段 + 审计（old/new/by/at/sequence） */
  if (decision !== 'keep' && decision !== 'replace') return { ok: false, reason: 'decision must be keep|replace' };
  var now = nowMs || Date.now();
  var mems = loadMemories();
  var olds = mems.filter(function (m) { return (m.factKey || m.fact_key) === factKey; });
  var oldValue = olds.length ? memText(olds[olds.length - 1]) : '';
  var seq = auditLoad().length + 1;
  if (decision === 'replace') {
    olds.forEach(function (m) { m.invalid_at = now; m.expired_at = now; m.status = 'history'; m.isLatest = false; });
    var nm = { id: uid('mem'), content: newValue, text: newValue, category: '事实', date: todayStr(new Date(now)),
      factKey: factKey, fact_key: factKey, type: 'fact', recall: 'ask', valid_at: now, invalid_at: null,
      version: (olds.length ? (olds[olds.length - 1].version || 1) + 1 : 1), /* A60 版本链 */
      parentMemoryId: olds.length ? olds[olds.length - 1].id : null,
      rootMemoryId: olds.length ? (olds[olds.length - 1].rootMemoryId || olds[0].id) : null,
      isLatest: true, bdRev: 1, createdAt: now, bdNamespace: namespaceFor(currentIdentityId()) };
    if (!nm.rootMemoryId) nm.rootMemoryId = nm.id;
    mems.push(nm);
    saveMemories(mems);
    /* A12 updates 边：新事实取代旧事实，旧的退出搜索、历史保留备审计 */
    olds.forEach(function (o) { addEdge(nm.id, o.id, 'updates', { episodes: [] }); });
  }
  auditLog({ kind: 'fact-conflict', action: decision, factKey: factKey, oldValue: oldValue, newValue: newValue,
    updateType: decision === 'replace' ? 'UPDATE' : 'KEEP', invalidatedAt: decision === 'replace' ? now : null,
    sequenceNumber: seq, changedBy: 'user', changedAt: now });
  return { ok: true, decision: decision, oldValue: oldValue, newValue: newValue, sequenceNumber: seq };
}
function factCenterEntryBD(factKey, asOfMs) {
  /* A51/A71 事实中心：同一 fact_key 的当前事实 + 历史（含失效时间与改动类型）+ 任意时间点查询 */
  var mems = loadMemories().filter(function (m) { return (m.factKey || m.fact_key) === factKey; });
  var hist = auditLoad().filter(function (a) { return a.kind === 'fact-conflict' && a.factKey === factKey; });
  var current = null;
  mems.forEach(function (m) {
    if (asOfMs) {
      var v = m.valid_at || memTs(m), inv = m.invalid_at;
      if (v <= asOfMs && (!inv || inv > asOfMs)) current = m;
    } else if (!m.invalid_at && !m.expired_at) current = m;
  });
  return { factKey: factKey, current: current ? { id: current.id, text: memText(current), version: current.version || 1, isLatest: !!current.isLatest } : null,
    history: mems.map(function (m) { return { id: m.id, text: memText(m), valid_at: m.valid_at || memTs(m), invalid_at: m.invalid_at || null, isLatest: !!m.isLatest }; }),
    audit: hist };
}
function versionChainBD(memId) {
  /* A60 supermemory 版本链字段（second-hand）：version / parentMemoryId / rootMemoryId / isLatest */
  var mems = loadMemories(), target = null;
  mems.forEach(function (m) { if (m.id === memId) target = m; });
  if (!target) return null;
  var root = target.rootMemoryId || target.id;
  var chain = mems.filter(function (m) { return (m.rootMemoryId || m.id) === root; })
    .sort(function (a, b) { return (a.version || 1) - (b.version || 1); });
  return { root: root, isLatest: !!target.isLatest, version: target.version || 1,
    parentMemoryId: target.parentMemoryId || null,
    chain: chain.map(function (m) { return { id: m.id, version: m.version || 1, text: memText(m), isLatest: !!m.isLatest }; }) };
}
function updateMemoryGuarded(memId, patch, expectedRev) {
  /* A57 basic-memory 修订守卫思路（expected_checksum）：每条记忆递增 rev；版本不对返回冲突、什么都不改 */
  var mems = loadMemories(), t = null;
  mems.forEach(function (m) { if (m.id === memId) t = m; });
  if (!t) return { ok: false, reason: 'not_found' };
  var rev = (typeof t.bdRev === 'number') ? t.bdRev : 1;
  if (rev !== expectedRev) return { ok: false, reason: 'rev-conflict', currentRev: rev, expectedRev: expectedRev, changed: false };
  var oldValue = memText(t);
  Object.keys(patch || {}).forEach(function (k) { t[k] = patch[k]; });
  t.bdRev = rev + 1;
  saveMemories(mems);
  auditLog({ kind: 'version', action: 'update', memId: memId, oldValue: oldValue, newValue: memText(t),
    changedBy: 'user', changedAt: Date.now(), sequenceNumber: auditLoad().length + 1, updateType: 'UPDATE' });
  return { ok: true, mem: t, rev: t.bdRev };
}
function requestDeleteBD(memId) {
  /* A48 langmem：删除默认关闭，只建议不执行；A49 墓碑另见 tombstoneMemoryBD */
  return { ok: true, action: 'suggest-only', memId: memId,
    suggestion: '建议删除（未执行）。删除默认关闭，须用户在记忆页手动确认；墓碑请用 tombstoneMemoryBD。' };
}
function tombstoneMemoryBD(memId) {
  /* A49 hindsight 文档级墓碑：删除只标墓碑、不物理删；记录保留、可恢复 */
  var mems = loadMemories(), t = null;
  mems.forEach(function (m) { if (m.id === memId) t = m; });
  if (!t) return null;
  t.tombstone = true; t.tombstonedAt = Date.now();
  saveMemories(mems);
  auditLog({ kind: 'tombstone', action: 'tombstone', memId: memId, updateType: 'DELETE' });
  return t;
}
function appendGuard(existingText, addition) {
  /* A49 单调性守卫（AppendWouldTruncateDocument 思路）：追加永不截断已有内容 */
  var e = String(existingText || ''), a = String(addition || '');
  if (a.length < e.length || a.slice(0, e.length) !== e) return { ok: false, reason: 'AppendWouldTruncateDocument: 追加内容不得截断已有内容' };
  return { ok: true, text: a };
}
var opCache = {};
function runOperation(opId, fn) {
  /* A58 operation_id 幂等：同一 operation_id 重复调用不重复执行，直接返回首次结果 */
  if (Object.prototype.hasOwnProperty.call(opCache, opId)) return { ok: true, cached: true, result: opCache[opId] };
  var s = getState();
  if (s.opIds[opId]) return { ok: true, cached: true, result: s.opIds[opId] };
  var result = fn();
  opCache[opId] = result;
  s.opIds[opId] = result;
  saveState(s);
  return { ok: true, cached: false, result: result };
}
function decaySweep(nowMs) {
  /* A39/A43 遗忘扫荡：偏好随重复强化（已在入库时计 mentions），经历除非重要（importance>=8）否则衰减；
     只改 BD 计算出的衰减分展示，不删除任何记忆（删除另走墓碑流程） */
  var cfg = getConfig();
  var mems = loadMemories();
  var out = mems.map(function (m) {
    var days = memTs(m) ? Math.max(0, (nowMs - memTs(m)) / 864e5) : 30;
    var imp = (typeof m.importance === 'number') ? m.importance : 5;
    var exempt = imp >= 8;
    var f = exempt ? 1 : decayFactor(days, cfg, cfg.decay.profile);
    var tier = (days <= 7 || imp * f >= 6) ? 'fresh' : ((days > 180 && imp * f < 3) ? 'tombstone-candidate' : 'faded');
    return { id: m.id, days: Math.round(days), decay: Math.round(f * 1000) / 1000, exempt: exempt, tier: tier };
  });
  var s = getState(); s.lastDecaySweepAt = nowMs; saveState(s);
  return out;
}

/* ── 8 · 数据结构：A52-A64 ───────────────────────────────────────────── */
function coreBlocks() {
  /* A52 letta 核心记忆块：label + value + limit（字符上限）+ read_only，编译进系统提示 */
  var prof = profileSnapshot();
  var pinned = loadMemories().filter(function (m) { return m.pinned && !m.tombstone; }).slice(0, 5);
  var blocks = [
    { label: 'persona', value: Object.keys(prof.static).map(function (t) { return t + '：' + Object.keys(prof.static[t]).map(function (k) { return k + '=' + prof.static[t][k]; }).join('、'); }).join('；'), limit: 2000, read_only: true, description: '核心人格（长期稳定事实，只读，模型不可改）' },
    { label: 'human', value: pinned.map(function (m) { return memText(m); }).join('；'), limit: 2000, read_only: false, description: '置顶记忆（用户可改）' }
  ];
  return blocks;
}
function compileCoreBlocks() {
  /* A52：每块有上限，超限强制截断并注明；编译成系统提示可用的文本 */
  return coreBlocks().map(function (b) {
    var v = b.value || '';
    var truncated = v.length > b.limit;
    if (truncated) v = v.slice(0, b.limit);
    return '<' + b.label + ' limit=' + b.limit + (b.read_only ? ' read_only' : '') + '>' + v + (truncated ? '…（已按上限截断）' : '') + '</' + b.label + '>';
  }).join('\n');
}
function promoteDemoteBD(memId, dir) {
  /* A53 letta promote/demote：按使用频率在 L1/L2/L3 间升降级，不是删除 */
  var mems = loadMemories(), t = null;
  mems.forEach(function (m) { if (m.id === memId) t = m; });
  if (!t) return null;
  var levels = ['L1', 'L2', 'L3'];
  var cur = levels.indexOf(t.reviewLevel || 'L2');
  if (cur < 0) cur = 1;
  var next = dir === 'promote' ? Math.max(0, cur - 1) : Math.min(2, cur + 1);
  t.reviewLevel = levels[next];
  t.useCount = (t.useCount || 0) + (dir === 'promote' ? 1 : 0);
  saveMemories(mems);
  return { id: memId, from: levels[cur], to: levels[next] };
}
function cubeSlotsBD() {
  /* A54 MemOS MemCube 四槽：文本记忆 / 行动记忆 / 参数记忆 / 偏好记忆 */
  var slots = { text: [], action: [], param: [], preference: [] };
  loadMemories().forEach(function (m) {
    var t = memText(m);
    if (/喜欢|偏爱|最爱/.test(t)) slots.preference.push(m.id);
    else if (/决定|去|做|完成|约/.test(t)) slots.action.push(m.id);
    else if (/每天|规则|必须|应该/.test(t)) slots.param.push(m.id);
    else slots.text.push(m.id);
  });
  return slots;
}
function crystallizeBD(memId) {
  /* A55 MemOS：L1 痕迹 -> L2 策略 -> L3 世界模型 -> 结晶为技能（与既有 L1/L2/L3 分级同名不同义，此处为升华链） */
  var mems = loadMemories(), t = null;
  mems.forEach(function (m) { if (m.id === memId) t = m; });
  if (!t) return null;
  var chain = ['trace', 'strategy', 'world-model', 'skill'];
  var cur = chain.indexOf(t.bdStage || 'trace');
  if (cur < 0) cur = 0;
  var next = Math.min(chain.length - 1, cur + 1);
  t.bdStage = chain[next];
  if (chain[next] === 'skill' && (t.tags || []).indexOf('技能') < 0) { t.tags = (t.tags || []).concat(['技能']); }
  saveMemories(mems);
  return { id: memId, stage: chain[next] };
}
function parseTimeQualifiers(text) {
  /* A56 basic-memory 时间限定语法思路（只借语法）：@effective/@valid/@due/@occurred/@mentioned */
  var s = String(text || ''), out = {};
  ['effective', 'valid', 'due', 'occurred', 'mentioned'].forEach(function (k) {
    var m = s.match(new RegExp('@' + k + '\\s*([^\\s@]+)'));
    if (m) out[k] = m[1];
  });
  return out;
}
function namespaceFor(identityId) {
  /* A64 langmem 命名空间模板思路：("memories", "{user_id}") 式模板 */
  return 'memories:' + String(identityId || 'default');
}
function currentIdentityId() {
  try { var id = localStorage.getItem('phone_identity_v1'); if (id) return String(id); } catch (e) {}
  return 'default';
}
function isolateCheckBD(identityId) {
  /* A76 hindsight 银行隔离：一个身份的记忆绝不串到另一个身份 */
  var ns = namespaceFor(identityId || currentIdentityId());
  var mems = loadMemories();
  var foreign = mems.filter(function (m) { return m.bdNamespace && m.bdNamespace !== ns; });
  var legacy = mems.filter(function (m) { return !m.bdNamespace; });
  return { namespace: ns, total: mems.length, foreign: foreign.length, legacyUntagged: legacy.length,
    ok: foreign.length === 0, note: '未打命名空间标签的历史记忆记为 legacy，不跨身份混用，只在当前身份可见时才展示' };
}
function truncateProcessing(messages, capTokens) {
  /* A63 memobase 处理截断：单次处理的消息量上限 16384 tokens，超限只处理前面的部分并注明 */
  var cap = capTokens || getConfig().processCapTokens, used = 0, kept = [];
  (messages || []).forEach(function (m) {
    var tk = estTokens(m.text || m.content || '');
    if (used + tk > cap) return;
    used += tk; kept.push(m);
  });
  return { kept: kept, usedTokens: used, cap: cap, truncated: kept.length < (messages || []).length };
}

/* ── 9 · 管理界面：A65-A76 ─────────────────────────────────────────── */
/* A75 hindsight Memory Defense 思路：入库前扫 secrets/PII，命中则脱敏或拦截。
   45 种模式为自写正则清单（未读到原文清单，按常见 secrets/PII 类型自拟）。 */
var DEFENSE_PATTERNS = [
  { id: 'openai-key', name: 'OpenAI API Key', re: /sk-[A-Za-z0-9]{20,}/, kind: 'secret', action: 'block' },
  { id: 'anthropic-key', name: 'Anthropic API Key', re: /sk-ant-[A-Za-z0-9\-_]{10,}/, kind: 'secret', action: 'block' },
  { id: 'aws-access', name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/, kind: 'secret', action: 'block' },
  { id: 'aws-secret', name: 'AWS Secret 疑似', re: /aws_secret_access_key\s*=\s*[A-Za-z0-9\/+]{20,}/i, kind: 'secret', action: 'block' },
  { id: 'github-pat', name: 'GitHub Token', re: /ghp_[A-Za-z0-9]{20,}/, kind: 'secret', action: 'block' },
  { id: 'github-oauth', name: 'GitHub OAuth Token', re: /gho_[A-Za-z0-9]{20,}/, kind: 'secret', action: 'block' },
  { id: 'slack-token', name: 'Slack Token', re: /xox[baprs]-[A-Za-z0-9\-]{10,}/, kind: 'secret', action: 'block' },
  { id: 'private-key', name: '私钥 PEM 头', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, kind: 'secret', action: 'block' },
  { id: 'ssh-key', name: 'SSH 公钥', re: /ssh-(rsa|ed25519) [A-Za-z0-9+\/=]{20,}/, kind: 'secret', action: 'block' },
  { id: 'jwt', name: 'JWT Token', re: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/, kind: 'secret', action: 'block' },
  { id: 'password-assign', name: '明文密码赋值', re: /password\s*[:=]\s*\S{4,}/i, kind: 'secret', action: 'block' },
  { id: 'passwd-word', name: 'passwd 字段', re: /passwd\s*[:=]\s*\S{4,}/i, kind: 'secret', action: 'block' },
  { id: 'api-key-assign', name: 'api_key 赋值', re: /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9\-_]{8,}/i, kind: 'secret', action: 'block' },
  { id: 'secret-assign', name: 'secret 赋值', re: /secret\s*[:=]\s*["']?[A-Za-z0-9\-_]{8,}/i, kind: 'secret', action: 'block' },
  { id: 'token-assign', name: 'token 赋值', re: /token\s*[:=]\s*["']?[A-Za-z0-9\-_]{8,}/i, kind: 'secret', action: 'block' },
  { id: 'bearer', name: 'Bearer Token', re: /Bearer\s+[A-Za-z0-9\-_\.]{10,}/, kind: 'secret', action: 'block' },
  { id: 'client-secret', name: 'client_secret', re: /client[_-]?secret\s*[:=]\s*\S{6,}/i, kind: 'secret', action: 'block' },
  { id: 'access-key', name: 'access_key 赋值', re: /access[_-]?key\s*[:=]\s*\S{8,}/i, kind: 'secret', action: 'block' },
  { id: 'webhook-secret', name: 'webhook secret', re: /webhook[_-]?secret\s*[:=]\s*\S{6,}/i, kind: 'secret', action: 'block' },
  { id: 'db-url', name: '数据库连接串', re: /(postgres|mysql|mongodb)(\+srv)?:\/\/[^\s:]+:[^\s@]+@[^\s]+/i, kind: 'secret', action: 'block' },
  { id: 'idcard', name: '身份证号', re: /[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/, kind: 'pii', action: 'redact' },
  { id: 'phone-cn', name: '手机号', re: /1[3-9]\d{9}/, kind: 'pii', action: 'redact' },
  { id: 'bankcard', name: '银行卡号', re: /\b\d{16,19}\b/, kind: 'pii', action: 'redact' },
  { id: 'creditcard', name: '信用卡号（带空格）', re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/, kind: 'pii', action: 'redact' },
  { id: 'email', name: '邮箱', re: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/, kind: 'pii', action: 'redact' },
  { id: 'passport', name: '护照号', re: /\b[EG]\d{8}\b/, kind: 'pii', action: 'redact' },
  { id: 'drivers-license', name: '驾驶证号疑似', re: /\b\d{12}\b/, kind: 'pii', action: 'redact' },
  { id: 'address-detail', name: '详细住址', re: /[\u4e00-\u9fa5]{2,}(市|区|县)[\u4e00-\u9fa5\d]{2,}(路|街|巷|号)[\d号楼单元室\-]{1,}/, kind: 'pii', action: 'redact' },
  { id: 'cookie-session', name: 'Cookie session', re: /sessionid\s*=\s*[A-Za-z0-9]{10,}/i, kind: 'secret', action: 'block' },
  { id: 'otp-secret', name: 'OTP seed', re: /otpauth:\/\/[^\s]+/i, kind: 'secret', action: 'block' },
  { id: 'gcp-key', name: 'GCP 服务账号 Key', re: /"private_key"\s*:\s*"-----BEGIN/, kind: 'secret', action: 'block' },
  { id: 'azure-key', name: 'Azure Key 疑似', re: /AccountKey=[A-Za-z0-9+\/=]{20,}/, kind: 'secret', action: 'block' },
  { id: 'stripe-key', name: 'Stripe Key', re: /sk_(live|test)_[A-Za-z0-9]{10,}/, kind: 'secret', action: 'block' },
  { id: 'sendgrid-key', name: 'SendGrid Key', re: /SG\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/, kind: 'secret', action: 'block' },
  { id: 'twilio-key', name: 'Twilio Key', re: /SK[0-9a-f]{32}/, kind: 'secret', action: 'block' },
  { id: 'npm-token', name: 'npm Token', re: /npm_[A-Za-z0-9]{20,}/, kind: 'secret', action: 'block' },
  { id: 'docker-token', name: 'Docker Hub Token', re: /dckr_pat_[A-Za-z0-9_\-]{10,}/, kind: 'secret', action: 'block' },
  { id: 'vault-token', name: 'Vault Token', re: /\bhvs\.[A-Za-z0-9]{10,}/, kind: 'secret', action: 'block' },
  { id: 'aliyun-key', name: '阿里云 AK 疑似', re: /LTAI[A-Za-z0-9]{12,}/, kind: 'secret', action: 'block' },
  { id: 'wechat-secret', name: '微信 appsecret 赋值', re: /appsecret\s*[:=]\s*\S{8,}/i, kind: 'secret', action: 'block' },
  { id: 'qq-password', name: 'QQ 密码疑似', re: /qq[^，。；\n]{0,6}密码\s*[:：]?\s*\S{4,}/i, kind: 'secret', action: 'block' },
  { id: 'bank-password', name: '银行卡密码疑似', re: /取款密码|支付密码\s*[:：]?\s*\d{6}/, kind: 'secret', action: 'block' },
  { id: 'idcard-front', name: '身份证正面照片描述', re: /身份证(正面|照片|复印件)/, kind: 'pii', action: 'redact' },
  { id: 'salary', name: '工资卡号疑似', re: /工资卡\s*[:：]?\s*\d{10,}/, kind: 'pii', action: 'redact' },
  { id: 'health-id', name: '医保卡号疑似', re: /医保卡\s*[:：]?\s*[A-Za-z0-9]{8,}/, kind: 'pii', action: 'redact' }
];
function defenseScan(text) {
  /* A75：扫 secrets/PII；命中 secret 拦截（block），命中 PII 脱敏（redact 为 ***） */
  var s = String(text || ''), hits = [], redacted = s;
  DEFENSE_PATTERNS.forEach(function (p) {
    var m = s.match(p.re);
    if (m) { hits.push({ id: p.id, name: p.name, kind: p.kind, action: p.action, sample: m[0].slice(0, 12) + '…' }); }
  });
  var blocked = hits.some(function (h) { return h.action === 'block'; });
  if (!blocked) {
    DEFENSE_PATTERNS.forEach(function (p) {
      if (p.action === 'redact') redacted = redacted.replace(p.re, '***');
    });
  }
  if (hits.length) auditLog({ kind: 'defense', action: blocked ? 'blocked' : 'redacted', hits: hits.map(function (h) { return h.id; }) });
  return { hits: hits, blocked: blocked, redacted: blocked ? null : redacted, count: hits.length };
}
function contextGauge(usedTokens, capTokens) {
  /* A69 Hanami 上下文仪表思路：显示当前上下文用了多少、还剩多少 */
  var pct = capTokens ? Math.min(1, usedTokens / capTokens) : 0;
  var pressure = pressureCheck(usedTokens, capTokens);
  return { used: usedTokens, cap: capTokens, pct: Math.round(pct * 1000) / 1000,
    remaining: Math.max(0, capTokens - usedTokens), warn: pressure.warn,
    warnThreshold: getConfig().pressureWarnPct, unverified: pressure.unverified };
}
function gaugeHTML(usedTokens, capTokens) {
  var g = contextGauge(usedTokens, capTokens);
  var pct = Math.round(g.pct * 100);
  var color = g.warn ? '#e5484d' : '#34363b';
  return '<div class="bd-gauge" style="padding:8px 12px;background:#f7f7f8;border:1px solid #ececef;border-radius:12px;">'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;"><span>上下文用量</span><span>' + g.used + ' / ' + g.cap + ' tokens · 剩 ' + g.remaining + '</span></div>'
    + '<div style="height:8px;background:#ececef;border-radius:4px;margin-top:6px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;"></div></div>'
    + '<div style="font-size:11px;color:#8a857e;margin-top:4px;">' + pct + '%'
    + (g.warn ? ' · 已过 ' + Math.round(g.warnThreshold * 100) + '% 警告线（未核实阈值，按实测调整），建议压缩最旧内容' : ' · 未达警告线')
    + '</div></div>';
}
function graphDataBD() {
  /* A65 supermemory 记忆图可视化思路：文档节点（矩形）+ 记忆节点（六边形）+ 关系边（UPDATE/EXTENDS/DERIVES） */
  var mems = loadMemories().slice(-12);
  var g = graphLoad();
  var nodes = mems.map(function (m, i) {
    return { id: m.id, label: memText(m).slice(0, 14) || '记忆', shape: 'hex', x: 0, y: 0, index: i, kind: 'memory' };
  });
  var edges = g.edges.filter(function (e) { return nodes.some(function (n) { return n.id === e.from; }) || nodes.some(function (n) { return n.id === e.to; }); })
    .slice(0, 20).map(function (e) { return { id: e.id, from: e.from, to: e.to, type: e.type.toUpperCase(), invalid: !!e.invalid_at }; });
  var n = Math.max(nodes.length, 1);
  nodes.forEach(function (node, i) {
    var ang = (2 * Math.PI * i) / n;
    node.x = Math.round(160 + 130 * Math.cos(ang));
    node.y = Math.round(110 + 85 * Math.sin(ang));
  });
  return { nodes: nodes, edges: edges, docNode: { id: 'doc:timeline', label: '追加式时间线（唯一事实来源）', shape: 'rect', x: 160, y: 110 } };
}
function graphHTMLBD() {
  var d = graphDataBD();
  var byId = {};
  d.nodes.forEach(function (nd) { byId[nd.id] = nd; });
  var svg = '<svg width="320" height="220" viewBox="0 0 320 220" style="background:#fff;border:1px solid #ececef;border-radius:12px;">';
  svg += '<rect x="120" y="95" width="80" height="30" rx="6" fill="#f7f7f8" stroke="#34363b"/><text x="160" y="114" text-anchor="middle" font-size="10" fill="#25262a">时间线</text>';
  d.edges.forEach(function (e) {
    var a = byId[e.from], b = byId[e.to];
    if (!a || !b) return;
    svg += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + (e.invalid ? '#ccc' : '#34363b') + '" stroke-width="1" stroke-dasharray="' + (e.invalid ? '3,3' : 'none') + '"/>'
      + '<text x="' + Math.round((a.x + b.x) / 2) + '" y="' + Math.round((a.y + b.y) / 2) + '" font-size="8" fill="#8a857e">' + e.type + '</text>';
  });
  d.nodes.forEach(function (nd) {
    svg += '<polygon points="' + (nd.x - 22) + ',' + nd.y + ' ' + (nd.x - 11) + ',' + (nd.y - 12) + ' ' + (nd.x + 11) + ',' + (nd.y - 12) + ' ' + (nd.x + 22) + ',' + nd.y + ' ' + (nd.x + 11) + ',' + (nd.y + 12) + ' ' + (nd.x - 11) + ',' + (nd.y + 12) + '" fill="#fff" stroke="#34363b"/>'
      + '<text x="' + nd.x + '" y="' + (nd.y + 3) + '" text-anchor="middle" font-size="8" fill="#25262a">' + esc(nd.label) + '</text>';
  });
  svg += '</svg>';
  return '<div class="bd-graph">' + svg + '<div style="font-size:11px;color:#8a857e;margin-top:4px;">矩形=文档（时间线），六边形=记忆，边：UPDATES 取代 / EXTENDS 补充 / DERIVES 推断；虚线=已失效边（历史保留）。</div></div>';
}
function reviewHTMLBD() {
  /* A66：审查队列两列——普通候选 / 推断记忆（isInference）单独一列 */
  var q = reviewQueue();
  function col(title, list) {
    if (!list.length) return '<div style="flex:1;min-width:140px;"><div style="font-weight:700;font-size:13px;">' + title + '（0）</div><div style="font-size:12px;color:#8a857e;">暂无待审。</div></div>';
    return '<div style="flex:1;min-width:140px;"><div style="font-weight:700;font-size:13px;">' + title + '（' + list.length + '）</div>'
      + list.map(function (c) {
        return '<div style="border:1px solid #ececef;border-radius:10px;padding:8px;margin-top:6px;font-size:12px;line-height:1.6;">'
          + '<div>' + esc(c.content) + '</div>'
          + '<div style="color:#8a857e;">' + esc(c.factKey || '') + ' · ' + esc((c.tags || []).join('/')) + ' · ' + esc(c.epistemic || '') + '</div>'
          + '<div style="margin-top:4px;"><button type="button" onclick="window.BDMemory && window.BDMemory.reviewDecide(\'' + c.id + '\', true); window.BDMemory && window.BDMemory.openPanel();" style="border:1px solid #ddd;background:#fff;border-radius:8px;padding:3px 10px;">批准</button> '
          + '<button type="button" onclick="window.BDMemory && window.BDMemory.reviewDecide(\'' + c.id + '\', false); window.BDMemory && window.BDMemory.openPanel();" style="border:1px solid #ddd;background:#fff;border-radius:8px;padding:3px 10px;">拒绝</button></div></div>';
      }).join('') + '</div>';
  }
  return '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + col('待审候选', q.ordinary) + col('推断记忆（isInference，批准才转正）', q.inference) + '</div>';
}
function csvCellBD(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportMemoriesCSV() {
  /* A74 CSV 导出：记忆一档 */
  var lines = ['id,日期,分类,类型,内容,fact_key,召回开关,版本,是否最新'];
  loadMemories().forEach(function (m) {
    lines.push([m.id, m.date || '', m.category || '', m.type || '', memText(m), m.factKey || m.fact_key || '', m.recall || '', m.version || 1, m.isLatest ? '是' : '否'].map(csvCellBD).join(','));
  });
  return lines.join('\n');
}
function exportBackupMarkdownBD() {
  /* A72 Markdown 人可读备份（与 JSON 并行） */
  var lines = ['# 归巢记忆备份', '', '导出时间：' + new Date().toISOString(), '条数：' + loadMemories().length, ''];
  loadMemories().forEach(function (m) {
    lines.push('## ' + (m.date || '') + ' · ' + (m.category || '未分类'));
    lines.push('');
    lines.push(memText(m));
    lines.push('');
    lines.push('- fact_key：' + (m.factKey || m.fact_key || '无') + ' · 召回：' + (m.recall || 'ask') + ' · 版本：' + (m.version || 1) + (m.isLatest ? '（最新）' : '') + (m.invalid_at ? ' · 已失效（历史保留）' : ''));
    lines.push('');
  });
  return lines.join('\n');
}
function exportBackupBD() {
  /* A72 双格式备份：Markdown 人可读 + JSON 机器读 */
  return { markdown: exportBackupMarkdownBD(), json: JSON.stringify({ spec: 'guichao-backup', version: 1, exportedAt: Date.now(), memories: loadMemories() }, null, 2) };
}
function exportBackupWithHistoryBD() {
  /* A73 备份带版本历史 + 幂等导入（见 importBackupBD） */
  var b = exportBackupBD();
  var data = JSON.parse(b.json);
  data.audit = auditLoad();
  data.graph = graphLoad();
  data.profile = profileLoad();
  data.versions = loadMemories().map(function (m) { return { id: m.id, version: m.version || 1, parentMemoryId: m.parentMemoryId || null, rootMemoryId: m.rootMemoryId || null, isLatest: !!m.isLatest }; });
  return { markdown: b.markdown, json: JSON.stringify(data, null, 2) };
}
function importBackupBD(jsonText, opts) {
  /* A73/A58：按内容哈希判重、按版本号判冲突；operation_id 幂等（重复导入同一 operation_id 直接返回首次结果） */
  opts = opts || {};
  var opId = opts.operationId || contentHash(jsonText);
  return runOperation('import:' + opId, function () {
    var data;
    try { data = JSON.parse(jsonText); } catch (e) { return { ok: false, reason: 'bad-json' }; }
    var incoming = data.memories || [];
    var existing = {};
    loadMemories().forEach(function (m) { existing[contentHash(memText(m))] = m; });
    var added = 0, dup = 0, conflicts = [];
    var staged = [];
    incoming.forEach(function (it) {
      var text = memText(it);
      var h = contentHash(text);
      if (existing[h]) {
        var old = existing[h];
        if ((it.version || 1) > (old.version || 1)) conflicts.push({ id: old.id, text: text.slice(0, 40), oldVersion: old.version || 1, newVersion: it.version || 1 });
        dup++; return;
      }
      staged.push(it);
    });
    /* 导入一律先挂起为待定草稿（BD 审查队列），永不自动加入回忆 */
    staged.forEach(function (it) {
      var r = proposeCandidateBD({ content: memText(it), factKey: it.factKey || it.fact_key || '', source: 'import-backup',
        tags: tagMemory(memText(it)), epistemic: classifyEpistemic(memText(it)) });
      if (r.ok) added++;
    });
    recordIngestionRun('backup-import', contentHash(jsonText), added);
    return { ok: true, staged: added, dup: dup, conflicts: conflicts };
  }).result;
}
function downloadTextBD(filename, text, mime) {
  try {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 800);
    return true;
  } catch (e) { return false; }
}
function downloadBackupDualBD() {
  var b = exportBackupWithHistoryBD();
  var ok1 = downloadTextBD('guichao-backup.md', b.markdown, 'text/markdown;charset=utf-8');
  var ok2 = downloadTextBD('guichao-backup.json', b.json, 'application/json;charset=utf-8');
  var ok3 = downloadTextBD('guichao-memories.csv', exportMemoriesCSV(), 'text/csv;charset=utf-8');
  return { markdown: ok1, json: ok2, csv: ok3 };
}
function promptInspectorBD(query) {
  /* A70 提示词检查器（已有设计，确认方向）：调用前展示将要发给模型的人设 + 记忆清单 */
  var ctx = assembleContext(query || '', {});
  return { mode: 'template', coreBlocks: compileCoreBlocks(), sections: ctx.sections,
    recall: ctx.recall.results, note: '发送前请确认：以上人设 + 记忆清单才会发给模型；未接模型时为模板模式。' };
}
function monthlyReflectReportBD(yearMonth) {
  /* A67 月度反思报告（已有设计，确认方向）：BD 补“留/跳”标准后的版本 */
  var s = getState();
  var sums = (s.summaries || []).filter(function (x) { return String(new Date(x.createdAt).toISOString()).slice(0, 7) === yearMonth; });
  var judged = reflectKeepSkip(loadMemories().filter(function (m) { return String(m.date || '').slice(0, 7) === yearMonth; }).map(function (m) { return { text: memText(m) }; }));
  return { month: yearMonth, summaries: sums, kept: judged.filter(function (j) { return j.keep; }).length,
    skipped: judged.filter(function (j) { return !j.keep; }).length,
    markdown: '# ' + yearMonth + ' 月度反思\n\n留下 ' + judged.filter(function (j) { return j.keep; }).length + ' 条（决定/教训/偏好/关系细节），跳过 ' + judged.filter(function (j) { return !j.keep; }).length + ' 条（查天气/例行步骤/已收录）。\n' };
}

/* ── 10 · 后台改被动：B4/B13 重写（打开时检查时间戳，到点补跑） ───────── */
function runDueJobs(nowMs) {
  /* B4/B13：无常驻进程；打开时检查时间戳，到点补跑一次（夜间反思、衰减扫荡、批量提取检查），重试有限次 + 下次再试 */
  nowMs = nowMs || Date.now();
  var s = getState(), ran = [];
  var due = nightReflectDue(nowMs);
  if (due.due) {
    var r = nightReflect(loadMemories().slice(-20).map(function (m) { return { text: memText(m) }; }), nowMs);
    if (r.done) ran.push('night-reflect:' + r.kept.length + ' kept');
  }
  if (!s.lastDecaySweepAt || nowMs - s.lastDecaySweepAt > 864e5) {
    decaySweep(nowMs);
    ran.push('decay-sweep');
  }
  return { ran: ran, at: nowMs };
}

/* ── 11 · 清单映射与面板 ─────────────────────────────────────────────── */
/* A1-A76 各落在哪（实现位置，供测试与汇报核对） */
var A_MAP = {
  A1: 'createDebouncer/armDebounceExtraction（防抖，静止 quietMs 才提炼，新消息取消）',
  A2: 'batchTriggerCheck（>1024 tokens 或闲置 1 小时或手动）',
  A3: 'splitSegments + fourPartSummary（话题切换/2h 空闲断段，四段式）',
  A4: 'extractEntities + extractEdges + graphLoad/graphSave（五步管线规则版，双时间）',
  A5: 'parseObservationLine/serializeObservation（纯文本规则解析）',
  A6: 'PROFILE_ONTOLOGY 8 主题 x ~40 槽位 + fillProfileSlot',
  A7: 'classifyEpistemic（世界事实/经历/观察/心智模型）',
  A8: 'tagMemory（8 类，新增规则与技能）',
  A9: 'extractionContext（最近 10 条 + 10 条最相似事实 + 2 个日期）',
  A10: 'extractFactsFromMessages（content 字段起步，只产候选）',
  A11: 'proposeCandidateBD isInference + reviewQueue inference 列',
  A12: 'addEdge（updates/extends/derives）',
  A13: 'profileSnapshot（static/dynamic 两层）',
  A14: 'recordIngestionRun + importMemoriesBD（derived_from + ingestion run + 重导 no-op）',
  A15: 'logEventBD（统一事件流确认方向，事件带 profile_delta 见 A61）',
  A16: 'compressionNeeded + config.budget（示例值，未核实）',
  A17: 'summarizeIncremental（已摘要 id 集合，只摘要新增）',
  A18: 'pressureCheck（70% 警告阈值，未核实）',
  A19: 'reflectKeepSkip + nightReflect（留/跳清单 + 1-2 次/天）',
  A20: 'refineObservation（精炼不改写 + 原话引文 + 证明计数）',
  A21: 'summarizeIncremental 的 made_from/source_chunk_id',
  A22: 'daySummaryTwoPart（事件梗概 + 画像增量）',
  A23: 'compressionPreview（压缩前后对比 + 可编辑摘要，线程不动）',
  A24: 'bm25Score + hybridWeights（0.85/0.15、短查询 0.30、钳制、k1=1.2/b=0.75）',
  A25: 'fuseScores（max+0.3x min）',
  A26: 'rrfFuse（k=60）',
  A27: 'applyRecallBudgets（事实 2048/文本块 1000/去重 512）',
  A28: 'config.searchDefaults（10/10/depth 1/since 7d）',
  A29: 'quickLimit=5、candidateCap=1000',
  A30: 'recallPipeline topK=20、threshold=0.1（second-hand，未核实）',
  A31: 'graphRecall（depth 1-5 + since 窗口）',
  A32: 'rewriteQueries（同义词扩展多查询并行 + 去重）',
  A33: 'routeQuery（16 种策略规则路由）',
  A34: 'sessionCacheLookup/Store（Jaccard >= 0.5 命中）',
  A35: 'recallBD evidence（原文 + permalink + checksum + relevanceScore）',
  A36: 'addEdge episodes + recallBD edgeIds（边 <-> 剧集双向回链）',
  A37: 'recallBD tier full/summary 两档',
  A38: 'assembleContext（画像 + 最近事件在前）',
  A39: 'decayFactor（线性衰减，窗口 365 天、半衰期 90 天）',
  A40: 'decay light14 档（second-hand，未核实，仅可选）',
  A41: 'recallPipeline（阈值 -> 衰减 -> 过期过滤，过期在 top_k 之前）',
  A42: 'setForgetAfter（到期退出搜索，不物理删）',
  A43: 'preferenceReinforce（偏好随重复强化；经历除非重要否则衰减见 decaySweep）',
  A44: 'importanceSortKey（距离 x (2 - importance_weight)，默认 0.5，沿推导链继承）',
  A45: 'resolveFactConflictBD（新 valid_at = 旧 invalid_at，旧事实保留可按时间点查询）',
  A46: 'conflictAdjudicate（相似度 >0.80 走裁决，未核实）',
  A47: 'localAdjudicate（本地版阈值 0.75、Top-5）',
  A48: 'requestDeleteBD（删除默认关闭，只建议不执行）',
  A49: 'tombstoneMemoryBD + appendGuard（墓碑 + 单调性守卫）',
  A50: 'updateMemoryGuarded + auditLog（旧值/新值/改动人/时间/序列号）',
  A51: 'factCenterEntryBD + resolveFactConflictBD（补失效时间与改动类型字段）',
  A52: 'coreBlocks + compileCoreBlocks（label/value/limit/read_only）',
  A53: 'promoteDemoteBD（按使用频率升降级）',
  A54: 'cubeSlotsBD（文本/行动/参数/偏好四槽）',
  A55: 'crystallizeBD（痕迹 -> 策略 -> 世界模型 -> 技能）',
  A56: 'parseTimeQualifiers（@effective/@valid/@due/@occurred/@mentioned）',
  A57: 'updateMemoryGuarded（rev 修订守卫，版本不对什么都不改）',
  A58: 'contentHash + runOperation（内容哈希去重 + operation_id 幂等）',
  A59: 'summarizeIncremental made_from/source_chunk_id（同 A21）',
  A60: 'versionChainBD + resolveFactConflictBD（version/parent/root/isLatest）',
  A61: 'logEventBD profileDelta + daySummaryTwoPart',
  A62: 'fillProfileSlot 上限（单主题 128 tokens、单画像 15 子主题）',
  A63: 'truncateProcessing（16384 tokens）',
  A64: 'namespaceFor（("memories", user_id) 式模板）',
  A65: 'graphHTMLBD/graphDataBD（记忆图可视化）',
  A66: 'reviewHTMLBD/reviewQueue（审查队列，推断单独一列）',
  A67: 'monthlyReflectReportBD（已有设计，确认方向，补留/跳统计）',
  A68: 'searchMemoriesBD（按日期 + 原话引用）',
  A69: 'contextGauge/gaugeHTML（上下文用量仪表）',
  A70: 'promptInspectorBD（已有设计，确认方向）',
  A71: 'factCenterEntryBD（已有设计，补失效时间与改动类型字段）',
  A72: 'exportBackupBD（Markdown + JSON 双格式）',
  A73: 'exportBackupWithHistoryBD + importBackupBD（带版本历史 + 幂等导入）',
  A74: 'exportMemoriesCSV（CSV 导出）',
  A75: 'defenseScan（45 种模式扫 secrets/PII，命中脱敏或拦截）',
  A76: 'isolateCheckBD + namespaceFor（银行隔离）'
};
/* B1-B18 全部按单文件 + localStorage + 模板兜底重写（本模块即重写实现） */
var BD_REWRITES = {
  B1: '向量检索 -> 规则打分：BM25 + 关键词 + 时间 + 显著度（scoreMemories/recallBD），无 embedding',
  B2: '模型抽取 -> 模板规则抽取（extractFactsFromMessages），接模型后才启用模型版并标注',
  B3: '模型生成摘要 -> 模板摘要（summarizeIncremental/fourPartSummary），标注模板模式',
  B4: '后台整理管线 -> runDueJobs：打开时检查时间戳、到点补跑；重试有限次 + 下次再试',
  B5: '图数据库 -> localStorage JSON 邻接表（guichao_bd_graph_v1），遍历用 JS 实现（graphRecall）',
  B6: '关系型存储 -> localStorage 键值 + 内存索引；迁移改为版本号字段 + 升级函数（bdRev/version）',
  B7: '向量索引与重排 -> 规则打分 + 融合公式（fuseScores/rrfFuse），无 reranker 模型',
  B8: '多模态抽取 -> 仅纯文本导入（importMemoriesBD/importBackupBD），其余格式给诚实提示（面板注明）',
  B9: '连接器同步 -> 只借“导入先挂起为草稿”的思路与同步节奏，不复用任何服务端代码',
  B10: '实时语音/视频记忆 -> 不做；语音只用系统 TTS/录音（不在本模块范围内）',
  B11: '画像模型驱动更新 -> 模板规则填槽（fillProfileSlot），接模型后才启用模型版',
  B12: '遗忘模型裁决 -> 规则相似度（localAdjudicate/conflictAdjudicate）+ 用户确认',
  B13: '后台守护进程/cron -> runDueJobs 被动触发（打开时检查时间戳）',
  B14: 'embedding 维度与索引配置 -> 不存在；相关参数全部作废（candidateCap 为规则打分候选上限）',
  B15: '云端托管 API/本地二进制服务 -> 不引入；记忆只走本地 localStorage + 整包导出/导入',
  B16: '前端框架与构建链 -> 不引入；单文件原生 JS',
  B17: '云端同步与多设备 -> 只走整包 JSON 导出/导入（exportBackupBD/importBackupBD）',
  B18: '自动入库 -> 走审阅流重写：只产候选，批准才进 guichao.memories.v1（proposeCandidateBD/reviewDecide）'
};
/* C1-C20 一项不引入（本模块自查清单） */
var BD_NOT_INTRODUCED = ['C1 GPL/AGPL 代码', 'C2 闭源记忆引擎', 'C3 向量数据库/embedding 服务',
  'C4 云端 LLM 作为唯一记忆来源', 'C5 默认自动入库、无确认关卡', 'C6 默认删除原始聊天',
  'C7 forget --all 无确认', 'C8 Math.random 洗牌/抽样', 'C9 随机比较器排序',
  'C10 解耦的假动画定时器', 'C11 永久追加无遗忘', 'C12 agent 当唯一决策者',
  'C13 自主改写系统提示', 'C14 未经核实的基准数字', 'C15 未经核实的许可证',
  'C16 停滞维护的依赖', 'C17 遥测默认开启', 'C18 记忆中存 secrets/PII 明文',
  'C19 记忆跨身份串用', 'C20 记忆存第三方云端且无本地导出'];

function panelHTML() {
  var cfg = getConfig();
  var q = reviewQueue();
  var iso = isolateCheckBD();
  var gauge = gaugeHTML(estTokens(loadMemories().map(memText).join('')), 8192);
  var audit = auditLoad().slice(-5).reverse();
  return '<div style="padding:12px;font-size:13px;line-height:1.7;color:#25262a;background:#fff;">'
    + '<div style="font-size:16px;font-weight:700;">记忆系统 · BD 面板</div>'
    + '<div style="font-size:12px;color:#8a857e;">A 清单落地（模板模式，未接模型时全部规则生成并标注）。未核实数字已标注，可在下方阈值里按实测调整。</div>'
    + '<div style="font-weight:700;margin-top:12px;">自动抓取触发</div>'
    + '<div style="font-size:12px;">防抖：静止 ' + (cfg.quietMs / 1000) + ' 秒且无新消息才提炼，新消息取消旧任务（A1）<br>批量：攒 &gt;' + cfg.batchTokens + ' tokens 或闲置 1 小时或手动才跑一次（A2）<br>切分：话题切换或 2 小时空闲即断段，四段式摘要（A3）</div>'
    + '<div style="font-weight:700;margin-top:12px;">召回打分</div>'
    + '<div style="font-size:12px;">混合权重 0.85/0.15，短查询词法 0.30，钳制 [0.05, 0.40]，BM25 k1=1.2/b=0.75（A24）；融合 max+0.3x min（A25）；RRF k=60（A26）；top_k=20、阈值 0.1（未核实，A30）</div>'
    + '<div style="font-weight:700;margin-top:12px;">遗忘</div>'
    + '<div style="font-size:12px;">线性衰减：窗口 365 天、半衰期 90 天（A39）；轻量档 14 天（未核实，A40）；顺序：阈值 -&gt; 衰减 -&gt; 过期过滤（A41）；删除默认关闭，只建议不执行（A48）</div>'
    + '<div style="font-weight:700;margin-top:12px;">上下文用量</div>' + gauge
    + '<div style="font-weight:700;margin-top:12px;">记忆图</div>' + graphHTMLBD()
    + '<div style="font-weight:700;margin-top:12px;">审查队列</div>' + reviewHTMLBD()
    + '<div style="font-size:12px;color:#8a857e;margin-top:6px;">待审 ' + (q.ordinary.length + q.inference.length) + ' 条（普通 ' + q.ordinary.length + ' / 推断 ' + q.inference.length + '）。批准才进回忆，拒绝不进搜索。</div>'
    + '<div style="font-weight:700;margin-top:12px;">备份</div>'
    + '<div><button type="button" onclick="window.BDMemory && window.BDMemory.downloadBackupDual();" style="border:1px solid #ddd;background:#fff;border-radius:8px;padding:5px 10px;">下载备份（Markdown + JSON + CSV）</button></div>'
    + '<div style="font-size:12px;color:#8a857e;margin-top:4px;">双格式备份（A72）+ 带版本历史与幂等导入（A73）+ CSV（A74）。导入一律先挂起为草稿。</div>'
    + '<div style="font-weight:700;margin-top:12px;">Memory Defense</div>'
    + '<div style="display:flex;gap:6px;"><input id="bd-defense-input" type="text" placeholder="粘贴一段文字，扫 secrets/PII（45 种模式）" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:6px;font-size:12px;"><button type="button" onclick="window.BDMemory && window.BDMemory.defenseScanUI();" style="border:1px solid #ddd;background:#fff;border-radius:8px;padding:5px 10px;">扫描</button></div>'
    + '<div id="bd-defense-result" style="font-size:12px;margin-top:4px;"></div>'
    + '<div style="font-weight:700;margin-top:12px;">隔离检查</div>'
    + '<div style="font-size:12px;">当前命名空间 ' + esc(iso.namespace) + '：' + (iso.ok ? '无跨身份串用' : '发现 ' + iso.foreign + ' 条外身份记忆') + '；历史未打标签记忆 ' + iso.legacyUntagged + ' 条（A76）。</div>'
    + '<div style="font-weight:700;margin-top:12px;">最近审计</div>'
    + (audit.length ? audit.map(function (a) { return '<div style="font-size:12px;">· ' + esc(a.kind || '') + ' / ' + esc(a.action || '') + ' · ' + new Date(a.ts).toLocaleString() + '</div>'; }).join('') : '<div style="font-size:12px;color:#8a857e;">暂无审计记录。</div>')
    + '<div style="font-size:11px;color:#8a857e;margin-top:12px;">B 类 18 项全部按单文件 + localStorage + 模板兜底重写；C 类 20 项一项未引入；多模态导入仅支持纯文本（txt/json），其余格式暂不支持。</div>'
    + '</div>';
}
function openPanel() {
  var old = document.getElementById('bd-panel');
  if (old) old.remove();
  var wrap = document.createElement('div');
  wrap.id = 'bd-panel';
  wrap.setAttribute('style', 'position:fixed;inset:0;z-index:10003;background:#fff;overflow-y:auto;');
  wrap.innerHTML = '<div style="position:sticky;top:0;background:#fff;border-bottom:1px solid #ececef;padding:10px 12px;display:flex;align-items:center;gap:10px;z-index:1;">'
    + '<button type="button" id="bd-panel-back" style="border:none;background:none;font-size:16px;cursor:pointer;">‹ 返回</button>'
    + '<span style="font-weight:700;">记忆系统</span></div>'
    + '<div id="bd-panel-body">' + panelHTML() + '</div>';
  document.body.appendChild(wrap);
  var back = document.getElementById('bd-panel-back');
  if (back) back.addEventListener('click', function () { closePanel(); });
  return wrap;
}
function closePanel() {
  var old = document.getElementById('bd-panel');
  if (old) old.remove();
  return true;
}
function defenseScanUI() {
  var input = document.getElementById('bd-defense-input');
  var out = document.getElementById('bd-defense-result');
  if (!input || !out) return null;
  var r = defenseScan(input.value);
  out.textContent = r.blocked ? ('拦截：命中 ' + r.hits.map(function (h) { return h.name; }).join('、') + '，不会入库。')
    : (r.hits.length ? ('脱敏：命中 ' + r.hits.map(function (h) { return h.name; }).join('、') + '，已替换为 ***。') : '通过：未命中 secrets/PII 模式。');
  return r;
}
function initBD() {
  try { runDueJobs(Date.now()); } catch (e) {}
}

/* ── 对外出口 ── */
window.BDMemory = {
  MARK: 'GROUP-BD',
  config: getConfig, saveConfig: saveConfig, DEFAULT_CONFIG: DEFAULT_CONFIG,
  A_MAP: A_MAP, BD_REWRITES: BD_REWRITES, BD_NOT_INTRODUCED: BD_NOT_INTRODUCED,
  estTokens: estTokens, contentHash: contentHash, tokenize: tokenize, jaccard: jaccard,
  bm25Score: bm25Score, hybridWeights: hybridWeights, fuseScores: fuseScores, rrfFuse: rrfFuse,
  createDebouncer: createDebouncer, getDebouncer: getDebouncer, armDebounceExtraction: armDebounceExtraction,
  batchTriggerCheck: batchTriggerCheck, splitSegments: splitSegments, fourPartSummary: fourPartSummary,
  extractEntities: extractEntities, extractEdges: extractEdges, addEdge: addEdge, graphRecall: graphRecall,
  parseObservationLine: parseObservationLine, serializeObservation: serializeObservation,
  tagMemory: tagMemory, classifyEpistemic: classifyEpistemic, PROFILE_ONTOLOGY: PROFILE_ONTOLOGY,
  fillProfileSlot: fillProfileSlot, profileSnapshot: profileSnapshot, extractionContext: extractionContext,
  extractFactsFromMessages: extractFactsFromMessages,
  proposeCandidateBD: proposeCandidateBD, reviewQueue: reviewQueue, reviewDecide: reviewDecide,
  recordIngestionRun: recordIngestionRun, importMemoriesBD: importMemoriesBD, logEventBD: logEventBD,
  compressionNeeded: compressionNeeded, pressureCheck: pressureCheck,
  summarizeIncremental: summarizeIncremental, reflectKeepSkip: reflectKeepSkip,
  nightReflectDue: nightReflectDue, nightReflect: nightReflect,
  refineObservation: refineObservation, daySummaryTwoPart: daySummaryTwoPart, compressionPreview: compressionPreview,
  routeQuery: routeQuery, rewriteQueries: rewriteQueries,
  sessionCacheLookup: sessionCacheLookup, sessionCacheStore: sessionCacheStore,
  scoreMemories: scoreMemories, decayFactor: decayFactor, recallPipeline: recallPipeline,
  applyRecallBudgets: applyRecallBudgets, recallBD: recallBD, assembleContext: assembleContext,
  searchMemoriesBD: searchMemoriesBD,
  preferenceReinforce: preferenceReinforce, importanceSortKey: importanceSortKey,
  setForgetAfter: setForgetAfter, localAdjudicate: localAdjudicate, conflictAdjudicate: conflictAdjudicate,
  resolveFactConflictBD: resolveFactConflictBD, factCenterEntryBD: factCenterEntryBD,
  versionChainBD: versionChainBD, updateMemoryGuarded: updateMemoryGuarded,
  requestDeleteBD: requestDeleteBD, tombstoneMemoryBD: tombstoneMemoryBD, appendGuard: appendGuard,
  runOperation: runOperation, decaySweep: decaySweep,
  coreBlocks: coreBlocks, compileCoreBlocks: compileCoreBlocks,
  promoteDemoteBD: promoteDemoteBD, cubeSlotsBD: cubeSlotsBD, crystallizeBD: crystallizeBD,
  parseTimeQualifiers: parseTimeQualifiers, namespaceFor: namespaceFor, isolateCheckBD: isolateCheckBD,
  truncateProcessing: truncateProcessing,
  defenseScan: defenseScan, DEFENSE_PATTERNS: DEFENSE_PATTERNS,
  contextGauge: contextGauge, gaugeHTML: gaugeHTML, graphDataBD: graphDataBD, graphHTMLBD: graphHTMLBD,
  reviewHTMLBD: reviewHTMLBD, exportMemoriesCSV: exportMemoriesCSV,
  exportBackupBD: exportBackupBD, exportBackupWithHistoryBD: exportBackupWithHistoryBD,
  importBackupBD: importBackupBD, downloadBackupDual: downloadBackupDualBD,
  promptInspectorBD: promptInspectorBD, monthlyReflectReportBD: monthlyReflectReportBD,
  runDueJobs: runDueJobs, auditLog: auditLog, auditLoad: auditLoad,
  panelHTML: panelHTML, openPanel: openPanel, closePanel: closePanel, defenseScanUI: defenseScanUI,
  getState: getState, saveState: saveState, loadMemories: loadMemories,
  _pure: { estTokens: estTokens, contentHash: contentHash, tokenize: tokenize, jaccard: jaccard,
    bm25Score: bm25Score, hybridWeights: hybridWeights, fuseScores: fuseScores, rrfFuse: rrfFuse,
    decayFactor: decayFactor, splitSegments: splitSegments, fourPartSummary: fourPartSummary,
    parseObservationLine: parseObservationLine, serializeObservation: serializeObservation,
    reflectKeepSkip: reflectKeepSkip, batchTriggerCheck: batchTriggerCheck,
    compressionNeeded: compressionNeeded, pressureCheck: pressureCheck,
    appendGuard: appendGuard, importanceSortKey: importanceSortKey,
    parseTimeQualifiers: parseTimeQualifiers, routeQuery: routeQuery, rewriteQueries: rewriteQueries }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBD);
else initBD();
})();
