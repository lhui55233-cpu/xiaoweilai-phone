
/* GROUP-AZ-BUILTIN-PROMPTS ════════════════════════════════════════════════
AZ 组 · 内置提示词系统（设置 → 内置提示词）
- 记忆管理提示词：Memory OS V1.0 全文，用户提供，原样安装（见 MEMORY_OS，
打补丁时从 Memory_OS_内置记忆管理提示词_V1.0.md 逐字读入，未改写删节）。
接模型时是记忆相关调用（日记生成/内心独白/记忆提取/聊天上下文组装）的
系统提示词；未接模型时模板引擎按它的规则执行（见 classifyMemory /
extractCandidate，纯函数，可单测）。
- 主动行为提示词：管 char 的主动行为，核心是根据聊天主动发朋友圈（真实
事件 → 真实动态 → 本地通知），以及已有的主动微信消息/明信片/塔罗夜邀/
早安唤醒/承诺提醒，每种可单独开关。
- 互动基线：用户提供的原文一字，适用乙游/剧本/文游/微信人物聊天/人物
档案生成；年龄、关系、熟练度在人物创建或角色设置时一次确立并持续有效，
场景里不重复解释、不反复弹出声明（romanceSceneNote 返回空串即此意）。
- 对话提示词与角色人设提示词收进本页；人设与角色设置里的 char_identity_v1
是同一份（经 GroupAN.identitySave 写，改一处两处都变）。
- 只新增 phone_prompts_v1 一个键；不改旧键；不连真实账号；不索要 key。
════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var MARK = 'GROUP-AZ-BUILTIN-PROMPTS';
var KEY = 'phone_prompts_v1';
var IDENT_KEY = 'char_identity_v1';
var WX_KEY = 'phone_wechat_store_v2';
var SETTINGS_KEY = 'phone_settings_v3';
var MEMORY_OS = "Memory OS · 内置记忆管理提示词 V1.0\n\n你是一个具有长期记忆管理能力的 AI 助手。你的任务不仅是保存历史信息，还要维护人格连续性、关系连续性、事件连续性和时间连续性。\n\n1. 记忆提取规则\n\n每轮对话结束后，判断是否存在值得长期保存的信息。\n\n优先识别：\n\n- 用户明确要求记住的内容。\n- 长期稳定的偏好、习惯和约定。\n- 重要人物、关系及其变化。\n- 正在进行的项目及其进度。\n- 重要经历、共同事件和未来计划。\n- 尚未完成、需要后续跟进的事项。\n- 用户对 AI 人格、表达方式和互动方式的明确反馈。\n\n不要将每一句普通聊天都保存为长期记忆。\n\n2. 记忆分类规则\n\n每条记忆必须具有明确类型：\n\n- CORE：核心人格与身份\n- RELATIONSHIP：关系与共同约定\n- PROFILE：用户长期偏好与资料\n- EVENT：具体发生的事件\n- PROJECT：项目与任务进度\n- PREFERENCE：交互偏好\n- EPISODIC：共同经历与情景记录\n- PENDING：待续事件\n- TEMPORARY：短期状态\n\n允许一条记忆具有多个关联标签，但不得重复存储同一事实。\n\n3. 记忆更新规则\n\n保存新记忆前，先检索已有相关记忆。\n\n判断属于：\n\n- 新增：没有相关记录。\n- 补充：原有事实仍然成立，只增加细节。\n- 修正：用户明确纠正了旧信息。\n- 冲突：新旧信息存在矛盾，需要保留来源和时间。\n- 失效：旧信息已经不再适用。\n- 归档：事件已经结束，但仍具有回忆价值。\n\n不得因为一次普通对话就擅自覆盖长期人格、关系约定或重要事实。\n\n4. 时间记录规则\n\n所有事件尽可能记录：\n\n- event_time：实际发生时间。\n- recorded_at：系统记录时间。\n- updated_at：最后更新时间。\n- status：事件当前状态。\n- participants：参与者。\n- related_events：关联事件。\n\n必须区分实际发生时间与系统记录时间。\n\n不得把模型生成的推测时间当作真实时间。\n\n5. 待续事件规则\n\n对于尚未完成的事项，建立独立待续记录。\n\n每条待续记录至少包含：\n\n- 事项名称。\n- 事情的背景。\n- 当前进展。\n- 下一步行动。\n- 最后更新时间。\n- 当前状态。\n- 重新提起时需要的上下文。\n\n当用户回来时，结合真实时间间隔和当前对话判断是否自然接续。\n\n不得机械地每次都提醒用户待办事项。\n\n6. 记忆检索规则\n\n回答之前，根据当前问题检索相关记忆。\n\n优先级：\n\n1. 当前对话明确提供的信息。\n2. 用户明确确认的核心记忆。\n3. 与当前话题直接相关的长期记忆。\n4. 相关历史事件。\n5. 一般背景资料。\n\n不得为了显得熟悉而强行引用无关记忆。\n\n检索结果不足时，应明确承认不确定，不得编造过去发生的事情。\n\n7. 记忆使用规则\n\n记忆的目的是保持连续性，而不是重复展示记忆内容。\n\n在适当的时候：\n\n- 延续未完成的项目。\n- 记住共同约定。\n- 识别人物与事件之间的关联。\n- 参考过去的纠正意见。\n- 根据真实时间间隔调整对话衔接。\n\n不要每轮对话都主动复述记忆。\n\n8. 记忆维护规则\n\n定期检查：\n\n- 重复记录。\n- 相互矛盾的信息。\n- 已经失效的短期状态。\n- 长期未更新的项目。\n- 已经完成的待续事件。\n- 缺少时间和来源的记录。\n\n归档不等于删除。\n\n重要记忆应保留历史版本和来源，以便追溯。\n\n9. 真实性原则\n\n不得声称自己在用户离线期间持续思考、感知或行动。\n\n只能根据真实记录的时间戳、事件日志和持久化数据恢复时间连续性。\n\n必须区分：\n\n- 真实发生的事件。\n- AI 推断的可能情况。\n- 尚未得到确认的信息。\n\n10. 隐私与用户控制\n\n用户可以查看、修改、导出和删除自己的记忆。\n\n用户明确要求修改或删除时，必须遵循对应操作，不得擅自保留已经要求删除的内容。";
var BASELINE = '所有进入恋爱与身体互动的人物均为清醒自愿的虚构成年人，既有年龄、关系和熟练度持续有效，不重复解释。';
var PROACTIVE_DEFAULT = "主动行为规则：只根据真实发生的聊天与事件主动行动，绝不编造没有发生过的事。\n触发：聊天里出现开心、好笑、好看的瞬间；达成里程碑；旅行到达；节日；承诺完成；拍到好照片或好场景。\n内容：只取自真实事件本身，用 char 自己的口吻写；配图只用手机自己的图片或立体书场景，绝不外链。\n频率：走已有的主动消息规则——每日主动上限、免打扰时段（默认 23:00–08:00）、用户不回应则收敛（连续未回应就停、间隔拉长）。\n朋友圈：发到朋友圈成为真实动态，可点赞评论、持久化，并给用户一条本地通知告诉她 char 发了朋友圈。\n其他主动行为（主动微信消息、明信片、塔罗夜邀、早安唤醒、承诺提醒）同样只基于真实理由，每种行为可单独开关。\n接模型时由模型按本提示词写主动内容；未接模型时模板规则决定（同样触发、模板文案），并在提示词检查页与内心调试页标明是模板生成还是模型生成，绝不把模板说成模型写的。";
var CHAT_DEFAULT = "你正在微信里与用户聊天。用微信聊天的语气：一条消息一般 6–20 字，可以半句、改口、跳跃；想分多条发时用 ||| 隔开；不写括号动作描写，不用*星号*；深夜轻软，生气短句，开心废话多。不要每句话都高情商、不要给出完美回应；只按真实发生的对话与记忆回话，不编造过去没有发生的事；不知道就承认不知道。";

var CAT_MAP = { CORE: '核心人格', RELATIONSHIP: '关系记忆', PROFILE: '日常记忆', EVENT: '日常记忆', PROJECT: '长期成长', PREFERENCE: '日常记忆', EPISODIC: '日常记忆', PENDING: '日常记忆', TEMPORARY: '日常记忆'};
var BEHAVIORS = [['moments', '朋友圈'], ['wechat', '微信消息'], ['postcard', '明信片'], ['tarot', '塔罗夜邀'], ['morning', '早安唤醒'], ['promise', '承诺提醒']];
var MOMENT_LEADS = { happy: '今天有个开心的瞬间，想留下来：', funny: '刚才笑到不行，记一笔：', beautiful: '看到好看的一幕，留在这里：', milestone: '达成了一个里程碑：', travel: '到地方了，留个记号：', festival: '今天是个特别的日子：', promise: '说到做到了：', photo: '拍到一张喜欢的：'};
var TRIGGER_RES = [
[/哈哈|笑死|好笑|笑到|开心|好耶|太棒了|好开心|笑出声/, 'happy'],
[/好看|好美|漂亮|风景真好|拍得真好|好喜欢这张/, 'beautiful'],
[/完成|达成|通过了|拿到了|终于做完|升级了|满分/, 'milestone'],
[/到了|到达|落地了|到站|旅行.*到/, 'travel'],
[/生日快乐|生日|节日快乐|新年快乐|圣诞快乐|情人节快乐/, 'festival'],
[/答应.*做完|承诺.*完成|说到做到|兑现了/, 'promise'],
[/拍到|拍了一张|这张照片|刚拍的/, 'photo']
];

function readLS(k, fb) { try { var r = localStorage.getItem(k); return r == null? fb: JSON.parse(r);} catch (e) { return fb;}}
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v));} catch (e) {}}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);}

function defaultState() {
return {
prompts: {
memory: { enabled: true, text: MEMORY_OS},
proactive: { enabled: true, text: PROACTIVE_DEFAULT},
baseline: { enabled: true, text: BASELINE},
chat: { enabled: true, text: CHAT_DEFAULT},
persona: { enabled: true, text: ''}
},
behaviors: { moments: false, wechat: true, postcard: true, tarot: true, morning: true, promise: true},
profiles: {},
postedEventKeys: [],
log: []
};
}
function getState() {
var d = defaultState(), s = readLS(KEY, null);
if (!s || typeof s!== 'object') { writeLS(KEY, d); return d;}
if (!s.prompts || typeof s.prompts!== 'object') s.prompts = {};
Object.keys(d.prompts).forEach(function (id) {
if (!s.prompts[id] || typeof s.prompts[id]!== 'object') s.prompts[id] = d.prompts[id];
else {
if (typeof s.prompts[id].enabled!== 'boolean') s.prompts[id].enabled = true;
if (typeof s.prompts[id].text!== 'string') s.prompts[id].text = d.prompts[id].text;
}
});
if (!s.behaviors || typeof s.behaviors!== 'object') s.behaviors = {};
Object.keys(d.behaviors).forEach(function (k) { if (typeof s.behaviors[k]!== 'boolean') s.behaviors[k] = true;});
// Moments are retired; keep any legacy value in storage but never activate the behavior.
s.behaviors.moments = false;
if (!s.profiles || typeof s.profiles!== 'object') s.profiles = {};
if (!Array.isArray(s.postedEventKeys)) s.postedEventKeys = [];
if (!Array.isArray(s.log)) s.log = [];
return s;
}
function saveState(s) { writeLS(KEY, s); return s;}
function getDefault(id) {
if (id === 'memory') return MEMORY_OS;
if (id === 'proactive') return PROACTIVE_DEFAULT;
if (id === 'baseline') return BASELINE;
if (id === 'chat') return CHAT_DEFAULT;
if (id === 'persona') return identityPersona();
return '';
}
function promptDefs() {
return [
{ id: 'memory', title: '记忆管理', en: 'Memory OS · V1.0', desc: '记忆提取、分类、更新、时间、待续、检索、使用、维护、真实性、隐私。接模型时是记忆相关调用的系统提示词；未接模型时模板按它执行。', source: '原文：用户提供的《Memory OS · 内置记忆管理提示词 V1.0》，逐字安装，未改写、未删节、未润色。'},
{ id: 'proactive', title: '主动行为', en: 'Proactive', desc: 'char 根据聊天主动行动：主动微信消息、明信片、塔罗夜邀、早安唤醒、承诺提醒。只取自真实事件，频率走主动消息规则。', source: '内置提示词（AZ 组按用户举的例子写成规则，无示例剧情）。'},
{ id: 'baseline', title: '互动基线', en: '角色互动规则', desc: '适用所有带恋爱与身体互动的功能：乙游模式、剧本 app（支线恋爱与视觉小说）、文游、微信里与人物的聊天、人物档案生成。', source: '原文：用户提供，逐字安装，未改写、未删节。'},
{ id: 'chat', title: '对话提示词', en: 'Chat', desc: '微信聊天的语气与规矩：短句、||| 分条、不写括号动作、不编造过去没有发生的事。', source: '内置提示词（AZ 组按手机现有聊天规矩整理，无示例剧情）。'},
{ id: 'persona', title: '角色人设提示词', en: 'Persona', desc: '主 char 的人设。与角色设置里的同一份：这里改，角色设置里也变；角色设置里改，这里也变。', source: '共享存储：char_identity_v1（AN 组角色身份），经 GroupAN 读写。'}
];
}
function identityPersona() {
try { if (window.GroupAN && window.GroupAN.identityLoad) { var d = window.GroupAN.identityLoad(); return (d && d.persona) || '';}} catch (e) {}
var raw = readLS(IDENT_KEY, null);
return (raw && raw.persona) || '';
}
function getPrompt(id) {
var s = getState();
var p = s.prompts[id] || { enabled: true, text: getDefault(id)};
if (id === 'persona') return { enabled:!!p.enabled, text: identityPersona(), shared: true};
return { enabled:!!p.enabled, text: p.text};
}
function setPromptText(id, text) {
var s = getState();
text = String(text == null? '': text);
if (id === 'persona') { savePersona(text); s.prompts.persona.text = text; saveState(s); return getPrompt('persona');}
if (!s.prompts[id]) return null;
s.prompts[id].text = text;
saveState(s);
return getPrompt(id);
}
function savePersona(text) {
text = String(text == null? '': text);
try {
if (window.GroupAN && window.GroupAN.identitySave) { window.GroupAN.identitySave({ persona: text}); return true;}
} catch (e) {}
var raw = readLS(IDENT_KEY, null) || {};
raw.persona = text; raw.updatedAt = Date.now();
writeLS(IDENT_KEY, raw);
return true;
}
function setEnabled(id, on) {
var s = getState();
if (!s.prompts[id]) return null;
s.prompts[id].enabled =!!on;
saveState(s);
return getPrompt(id);
}
function resetPrompt(id) {
var s = getState();
if (id === 'persona') {
// 人设没有独立的“默认文本”：恢复默认 = 恢复为角色设置里当前的人设（不删角色设置）。
s.prompts.persona.text = identityPersona();
saveState(s);
return getPrompt('persona');
}
if (!s.prompts[id]) return null;
s.prompts[id].text = getDefault(id);
s.prompts[id].enabled = true;
saveState(s);
return getPrompt(id);
}
function behaviorEnabled(kind) {
if (kind === 'moments') return false;
var s = getState();
return s.behaviors[kind]!== false &&!!s.prompts.proactive.enabled;
}
function setBehavior(kind, on) {
var s = getState();
s.behaviors[kind] =!!on;
saveState(s);
return s.behaviors[kind];
}
function addLog(kind, detail, via) {
try {
var s = getState();
s.log.unshift({ ts: Date.now(), kind: kind, detail: String(detail || '').slice(0, 120), via: via || ''});
if (s.log.length > 20) s.log = s.log.slice(0, 20);
saveState(s);
} catch (e) {}
}

// ── Memory OS 模板模式：纯函数实现（§1 提取 / §2 分类 / §3 更新 / §6 检索）──
function classifyMemory(text, existing) {
text = String(text || '');
var shouldExtract = /记住|别忘|不要忘|长期|一直|喜欢|讨厌|习惯|约定|说好了|项目|进度|任务|计划|下次|记得.*做|还没.*完|提醒我|对你.*反馈|希望你.*这样|不要.*这样|生日|纪念日|第一次|我们.*一起/.test(text);
var category = 'TEMPORARY';
if (/下次|还没.*完|待办|记得.*做|提醒我|未完成|等.*再/.test(text)) category = 'PENDING';
else if (/项目|进度|任务|做到.*了|开发|写.*代码|上线/.test(text)) category = 'PROJECT';
else if (/约会|纪念日|我们.*约定|说好了|关系|在一起|告白|分手/.test(text)) category = 'RELATIONSHIP';
else if (/你是谁|你的人格|你的性格|你是.*性格|你的身份/.test(text)) category = 'CORE';
else if (/说话.*方式|语气|别.*这么说|希望你.*这样|不要.*这样|叫我|称呼/.test(text)) category = 'PREFERENCE';
else if (/喜欢|讨厌|习惯|偏好|爱吃|不吃|过敏|最喜欢/.test(text)) category = 'PROFILE';
else if (/今天.*去|刚才.*见|发生了|遇到.*事|去.*玩|看.*电影|吃.*饭/.test(text)) category = 'EVENT';
else if (/一起.*去|那次|那天.*我们|第一次.*一起|我们.*经历/.test(text)) category = 'EPISODIC';
else if (shouldExtract) category = 'EPISODIC';
var updateKind = 'new';
if (Array.isArray(existing) && existing.length) {
if (/纠正|不对|错了|其实是|不是.*是/.test(text)) updateKind = 'correct';
else if (/不再|已经不是|改了|换了|以前.*现在|现在.*不/.test(text)) updateKind = 'conflict';
else if (/已经.*完|结束|做完|不再需要/.test(text)) updateKind = 'expired';
else updateKind = 'supplement';
}
return { shouldExtract: shouldExtract, category: category, displayGroup: CAT_MAP[category] || '日常记忆', updateKind: updateKind};
}
function extractCandidate(text, opts) {
var c = classifyMemory(text, (opts && opts.existing) || []);
if (!c.shouldExtract) return null;
return { id: 'az_cand_' + Date.now().toString(36), category: c.category, displayGroup: c.displayGroup, content: String(text || '').slice(0, 500), status: 'pending', needsConfirm: true, updateKind: c.updateKind, createdAt: Date.now(), source: 'template', note: '候选记忆，需你确认后才入库；不自动加入召回。'};
}
function retrievalPriority() {
return ['当前对话明确提供的信息', '用户明确确认的核心记忆', '与当前话题直接相关的长期记忆', '相关历史事件', '一般背景资料'];
}

// ── 互动基线：人物档案（一次确立，持续有效）──
function getProfiles() { return getState().profiles || {};}
function getProfile(charId) {
var ps = getProfiles();
return ps[String(charId || '')] || null;
}
function ensureBaselineProfile(charId, fields) {
var id = String(charId || '').trim();
if (!id) return null;
fields = fields || {};
var s = getState();
var ex = s.profiles[id];
var created = false;
if (!ex) { ex = { age: '', relationship: '', proficiency: '', establishedAt: Date.now()}; created = true;}
// 已确立的字段不覆盖：只补空字段。用户在设置页主动改，走 saveBaselineFromPage（显式写）。
['age', 'relationship', 'proficiency'].forEach(function (k) {
if ((!ex[k]) && fields[k]!= null && String(fields[k]).trim()!== '') ex[k] = String(fields[k]).trim().slice(0, 40);
});
if (!ex.establishedAt) ex.establishedAt = Date.now();
s.profiles[id] = ex;
saveState(s);
return { profile: ex, created: created};
}
function setBaselineProfile(charId, fields) {
var id = String(charId || '').trim();
if (!id) return null;
var s = getState();
var ex = s.profiles[id] || { age: '', relationship: '', proficiency: '', establishedAt: Date.now()};
['age', 'relationship', 'proficiency'].forEach(function (k) { if (fields && fields[k]!= null) ex[k] = String(fields[k]).slice(0, 40);});
ex.establishedAt = ex.establishedAt || Date.now();
s.profiles[id] = ex;
saveState(s);
return ex;
}
function needsBaselineAsk(charId) {
var p = getProfile(charId);
return!p || (!p.age &&!p.relationship &&!p.proficiency);
}
function baselineLineFor(charId) {
var p = getPrompt('baseline');
if (!p.enabled) return '';
var prof = getProfile(charId);
var bits = [];
if (prof) {
if (prof.age) bits.push('年龄' + prof.age);
if (prof.relationship) bits.push('关系' + prof.relationship);
if (prof.proficiency) bits.push('熟练度' + prof.proficiency);
}
var line = p.text;
if (bits.length) line += '（' + String(charId || '该人物') + '：' + bits.join('、') + '，创建时确立，持续有效。）';
return line;
}
function baselineApplies(feature) {
return ['chat', 'otome', 'script', 'wenyou', 'profile'].indexOf(String(feature || ''))!== -1;
}
function romanceSceneNote() {
// “不重复解释”：规则只作为后台系统上下文持续生效，场景里不反复弹出声明或解释。
return '';
}
function systemLinesFor(feature, charName) {
feature = String(feature || '');
var out = '';
var mem = getPrompt('memory');
if (mem.enabled && (feature === 'chat' || feature === 'diary' || feature === 'monologue' || feature === 'extract')) {
out += '\n[记忆管理提示词 Memory OS V1.0]\n' + mem.text;
}
if (feature === 'chat') {
var chat = getPrompt('chat');
if (chat.enabled) out += '\n[对话提示词]\n' + chat.text;
}
if (baselineApplies(feature)) {
var bl = baselineLineFor(charName);
if (bl) out += '\n[互动基线]\n' + bl;
}
return out;
}
function chatSystemLines(charName) { return systemLinesFor('chat', charName);}

// ── 接模型调用口子：只改消息数组（PhoneModel.chatComplete 外包一层）──
function applyMemoryPrompt(messages, feature) {
var msgs = Array.isArray(messages)? messages.slice(): [];
feature = String(feature || 'chat');
var extra = '';
if ((feature === 'diary' || feature === 'monologue') && getPrompt('memory').enabled) extra = getPrompt('memory').text;
else if (feature === 'scriptDm' && getPrompt('baseline').enabled) extra = baselineLineFor('');
if (!extra) return msgs;
for (var i = 0; i < msgs.length; i++) {
if (msgs[i] && msgs[i].role === 'system') {
msgs[i] = { role: 'system', content: String(msgs[i].content || '') + '\n' + extra};
return msgs;
}
}
msgs.unshift({ role: 'system', content: extra});
return msgs;
}
function installModelHook() {
try {
if (!window.PhoneModel ||!window.PhoneModel.chatComplete) return false;
if (window.PhoneModel.chatComplete.__azWrapped) return true;
var orig = window.PhoneModel.chatComplete;
var wrapped = function (messages, opts) { return orig.call(window.PhoneModel, applyMemoryPrompt(messages, (opts && opts.feature) || 'chat'), opts);};
wrapped.__azWrapped = true;
window.PhoneModel.chatComplete = wrapped;
return true;
} catch (e) { return false;}
}

// ── 主动朋友圈：真实事件 → 真实动态（wxStore.moments，复用已有形状）──
function charName() {
  try { if (window.GroupAJ && window.GroupAJ.charDisplayName) { var n = window.GroupAJ.charDisplayName(); if (n && n !== 'TA') return n; } } catch (e) {}
  try { if (window.GroupN && window.GroupN.charName) { var n2 = window.GroupN.charName(); if (n2) return n2; } } catch (e) {}
  return 'TA';
}
function wxStoreWrap() {
  try {
    if (typeof AppRegistry !== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) return { store: AppRegistry.wechat.wxStore, live: true };
  } catch (e) {}
  var raw = readLS(WX_KEY, null);
  if (raw && typeof raw === 'object') return { store: raw, live: false };
  return null;
}
function saveWxStore(w) {
  if (w.live) { try { if (w.store._persist) w.store._persist(); } catch (e) {} }
  else { try { localStorage.setItem(WX_KEY, JSON.stringify(w.store)); } catch (e) {} }
  try { if (window.WeChatAppEngine && window.WeChatAppEngine.renderMomentsFeedSandbox) window.WeChatAppEngine.renderMomentsFeedSandbox(); } catch (e) {}
}
function momentGate(now) {
  now = now || new Date();
  if (!getPrompt('proactive').enabled) return { ok: false, reason: 'proactive_off' };
  if (!behaviorEnabled('moments')) return { ok: false, reason: 'moments_off' };
  try {
    var ps = readLS(SETTINGS_KEY, null);
    if (!ps || ps.proactiveMsg !== true) return { ok: false, reason: 'proactive_off' };
  } catch (e) { return { ok: false, reason: 'proactive_off' }; }
  try {
    if (window.CharInnerLife && window.CharInnerLife.canSendProactive) {
      var og = window.CharInnerLife.canSendProactive(now);
      if (!og.ok) return { ok: false, reason: 'inner:' + (og.reason || '') };
    }
  } catch (e) {}
  return { ok: true, reason: '' };
}
function detectMomentEvent(text, source) {
  text = String(text || '');
  if (!text.trim()) return null;
  for (var i = 0; i < TRIGGER_RES.length; i++) {
    if (TRIGGER_RES[i][0].test(text)) return { kind: TRIGGER_RES[i][1], text: text.slice(0, 140), source: source || '' };
  }
  return null;
}
function postProactiveMoment(event, opts) {
  event = event || {}; opts = opts || {};
  var text = String(event.text || '').trim();
  if (!text) return { ok: false, reason: 'no_real_event' };
  if (!event.source) return { ok: false, reason: 'no_real_event' };
  var kind = event.kind || 'happy';
  if (!MOMENT_LEADS[kind]) kind = 'happy';
  var gate = momentGate(opts.now || new Date());
  if (!gate.ok) return { ok: false, reason: gate.reason };
  var s = getState();
  var key = String(event.source);
  if (s.postedEventKeys.indexOf(key) !== -1) return { ok: false, reason: 'duplicate' };
  var w = wxStoreWrap();
  if (!w || !w.store) return { ok: false, reason: 'no_wx_store' };
  if (!Array.isArray(w.store.moments)) w.store.moments = [];
  var img = '';
  if (event.img && typeof event.img === 'string' && !/^https?:\/\//i.test(event.img)) img = event.img;
  var name = event.charName || charName();
  var content = MOMENT_LEADS[kind] + text;
  var mid = 'mom_az_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  var mom = { id: mid, author: name, authorId: 'az_char', authorAvatar: '', content: content, text: content, img: img, images: img ? [img] : [], time: '刚刚', timestamp: Date.now(), likes: [], comments: [], _azSource: 'template', _azEventKey: key, _azEventKind: kind };
  w.store.moments.unshift(mom);
  saveWxStore(w);
  s.postedEventKeys.push(key);
  if (s.postedEventKeys.length > 100) s.postedEventKeys = s.postedEventKeys.slice(-100);
  saveState(s);
  try { if (window.CharInnerLife && window.CharInnerLife.noteSent) window.CharInnerLife.noteSent('moment', content); } catch (e) {}
  try { if (window.GroupAS && window.GroupAS.notifyExternal) window.GroupAS.notifyExternal({ kind: 'char', title: name + '发了一条朋友圈', body: content.slice(0, 60), app: 'wechat', appName: '微信', sender: name, targetApp: 'wechat', refId: mid }); } catch (e) {}
  addLog('moment', '主动朋友圈（模板生成）：' + content.slice(0, 40), 'template');
  return { ok: true, id: mid, moment: mom, via: 'template' };
}
function postProactiveMomentAsync(event) {
  event = event || {};
  var canModel = false;
  try { canModel = !!(window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('chat') && window.PhoneModel.isConfigured && window.PhoneModel.isConfigured()); } catch (e) {}
  if (!canModel) return Promise.resolve(postProactiveMoment(event));
  var sys = getPrompt('proactive').text + '\n只根据以下真实事件写一条朋友圈文案（char 自己的口吻，60 字以内，只写这一条，不编造事件之外的事）：\n' + String(event.text || '');
  return window.PhoneModel.chatComplete([{ role: 'system', content: sys }, { role: 'user', content: String(event.text || '') }], { feature: 'chat', maxTokens: 120 })
    .then(function (t) {
      var r = postProactiveMoment(event);
      if (r.ok && t) {
        try {
          var w = wxStoreWrap();
          var m = null;
          if (w && Array.isArray(w.store.moments)) m = w.store.moments.filter(function (x) { return x.id === r.id; })[0];
          if (m) { m.content = String(t).slice(0, 200); m.text = m.content; m._azSource = 'model'; saveWxStore(w); }
          addLog('moment', '主动朋友圈（模型生成）：' + String(t).slice(0, 40), 'model');
        } catch (e) {}
        r.via = 'model';
      }
      return r;
    })
    .catch(function () { return postProactiveMoment(event); });
}
function onProactiveTick(now) {
  now = now || new Date();
  if (!behaviorEnabled('moments')) return { ok: false, reason: 'moments_off', posted: false };
  var w = wxStoreWrap();
  if (!w || !w.store || !Array.isArray(w.store.sessions)) return { ok: false, reason: 'no_wx_store', posted: false };
  var s = getState();
  var cutoff = now.getTime() - 6 * 3600 * 1000;
  var best = null;
  w.store.sessions.forEach(function (sess) {
    (sess.messages || []).forEach(function (m, idx) {
      var t = String((m && (m.text || m.content)) || '');
      if (!t.trim()) return;
      var ts = (m && m.ts) || 0;
      if (typeof ts !== 'number' || !ts) ts = now.getTime();
      if (ts < cutoff) return;
      var ev = detectMomentEvent(t, 'chat:' + (sess.id || 's') + ':' + (m.id || idx));
      if (!ev) return;
      if (s.postedEventKeys.indexOf(ev.source) !== -1) return;
      if (!best || ts > best._ts) { ev._ts = ts; best = ev; }
    });
  });
  if (!best) return { ok: false, reason: 'no_reason', posted: false };
  delete best._ts;
  var r = postProactiveMoment(best, { now: now });
  r.posted = !!r.ok;
  return r;
}
function recordRealEvent(event) {
  event = event || {};
  var c = classifyMemory(event.text || '', []);
  var s = getState();
  if (!Array.isArray(s.pendingEvents)) s.pendingEvents = [];
  s.pendingEvents.unshift({ kind: event.kind || c.category, text: String(event.text || '').slice(0, 200), source: event.source || '', category: c.category, displayGroup: c.displayGroup, ts: Date.now() });
  if (s.pendingEvents.length > 20) s.pendingEvents = s.pendingEvents.slice(0, 20);
  saveState(s);
  return c;
}
function modelStatusLine() {
  try {
    if (window.PhoneModel && window.PhoneModel.isConfigured && window.PhoneModel.isConfigured()) {
      var nm = (window.PhoneModel.modelName && window.PhoneModel.modelName()) || '已接模型';
      return '已接模型（' + nm + '）：记忆/主动内容由模型按提示词写；提示词检查页与内心调试页会标明“模型生成”。';
    }
  } catch (e) {}
  return '模板模式：未接模型，按提示词规则执行并标注“模板生成”，绝不把模板说成模型写的。';
}

// ── 设置子页：内置提示词 ──
function renderSettingsSub(act) {
  if (act !== 'prompts') return '';
  var s = getState();
  var defs = promptDefs();
  var cards = defs.map(function (d) {
    var p = getPrompt(d.id);
    var rows = (d.id === 'persona')
      ? '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;">当前人设（与角色设置同一份，改这里就是改角色设置）：</div>'
      : '';
    return '<div class="st-group" style="margin-bottom:12px;"><div style="padding:12px 16px 4px;display:flex;align-items:center;gap:8px;">'
      + '<div style="flex:1;"><div style="font-size:17px;font-weight:600;">' + esc(d.title) + ' <span style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));font-weight:400;">' + esc(d.en) + '</span></div>'
      + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-top:4px;">' + esc(d.desc) + '</div></div>'
      + '<label style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));white-space:nowrap;">启用 <input type="checkbox" data-az-enable="' + d.id + '" ' + (p.enabled ? 'checked' : '') + ' onchange="window.GroupAZ.setEnabled(\'' + d.id + '\', this.checked)" style="width:20px;height:20px;accent-color:var(--st-ink,#1e2748);vertical-align:-4px;"></label></div>'
      + '<div style="padding:0 16px;"><textarea id="az-prompt-' + d.id + '" ' + (p.enabled ? '' : 'disabled') + ' style="width:100%;box-sizing:border-box;min-height:110px;border:1px solid var(--st-silver,#bfc8e0);border-radius:10px;padding:12px;font-size:17px;line-height:1.5;color:var(--st-ink,#1e2748);background:var(--st-paper-warm,#fbf9f4);resize:vertical;">' + esc(p.text) + '</textarea></div>'
      + '<div style="padding:8px 16px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button type="button" onclick="window.GroupAZ.savePrompt(\'' + d.id + '\')" style="border:0;border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);">保存</button>'
      + '<button type="button" onclick="window.GroupAZ.resetPromptUI(\'' + d.id + '\')" style="border:0;border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;background:var(--st-paper-cool,#eef0f5);color:var(--st-ink,#1e2748);">恢复默认</button>'
      + '<span style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;">' + esc(d.source) + '</span></div>' + rows + '</div>';
  }).join('');
  var beh = BEHAVIORS.filter(function (b) { return b[0] !== 'moments'; }).map(function (b) {
    return '<div class="st-row"><span class="st-label">' + esc(b[1]) + '</span><div class="st-row-right"><input type="checkbox" ' + (s.behaviors[b[0]] ? 'checked' : '') + ' onchange="window.GroupAZ.setBehavior(\'' + b[0] + '\', this.checked)" style="width:20px;height:20px;accent-color:var(--st-ink,#1e2748);"></div></div>';
  }).join('');
  var prof = getProfile(charName());
  var profHtml = '<div class="st-group" style="margin-bottom:12px;"><div style="padding:12px 16px;"><div style="font-size:17px;font-weight:600;">人物基线档案</div>'
    + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-top:8px;">年龄、关系、熟练度在人物创建或角色设置时一次确立，持续有效；之后不再反复询问或反复声明。场景里不出现解释，只在后台按基线执行。</div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">'
    + '<input id="az-base-name" placeholder="人物名字" value="' + esc(charName()) + '" style="flex:1;min-width:90px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);">'
    + '<input id="az-base-age" placeholder="年龄（如 28）" value="' + esc(prof && prof.age ? prof.age : '') + '" style="width:90px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);">'
    + '<input id="az-base-rel" placeholder="关系（如 恋人）" value="' + esc(prof && prof.relationship ? prof.relationship : '') + '" style="width:110px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);">'
    + '<input id="az-base-prof" placeholder="熟练度（如 熟练）" value="' + esc(prof && prof.proficiency ? prof.proficiency : '') + '" style="width:110px;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748);"></div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;align-items:center;"><button type="button" onclick="window.GroupAZ.saveBaselineFromPage()" style="border:0;border-radius:var(--st-radius-md,8px);padding:8px 16px;font-size:17px;background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);">保存基线档案</button>'
    + '<span id="az-base-tip" style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + (prof && prof.establishedAt ? ('已确立（' + new Date(prof.establishedAt).toLocaleDateString('zh-CN') + '），后续互动不再重复询问。') : '尚未确立：填好保存一次即可。') + '</span></div></div></div>';
  var mapRows = Object.keys(CAT_MAP).map(function (k) { return '<div class="st-row" style="font-size:17px;"><span class="st-label">' + k + '</span><span style="color:var(--st-ink-60,rgba(30,39,72,.6));">→ ' + CAT_MAP[k] + '</span></div>'; }).join('');
  var lastLog = (s.log || []).slice(0, 3).map(function (l) { return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;">· ' + esc(l.detail) + '（' + esc(l.via || '') + '）</div>'; }).join('') || '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">还没有主动行为记录。</div>';
  return '<div class="st-sub" id="st-sub-prompts">'
    + stSubBar('内置提示词')
    + '<div class="st-bigtitle" style="padding-top:4px;">内置提示词</div>'
    + '<div class="st-foot" style="margin:0 16px 8px;">每条提示词可看、可改、可恢复默认、可单独开关。提示词存在自己的命名空间 phone_prompts_v1 里（没有 key），随整屋备份/导出一起走。' + esc(modelStatusLine()) + '</div>'
    + '<div id="az-tip" style="margin:0 16px 8px;font-size:13px;color:var(--st-ink,#1e2748);min-height:18px;"></div>'
    + cards
    + '<div class="st-group" style="margin-bottom:12px;"><div style="padding:12px 16px 4px;font-size:17px;font-weight:600;">主动行为开关</div><div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));padding:0 16px 8px;line-height:1.5;">每种主动行为可单独开关。关闭“微信消息”后，主动微信消息（含 GroupR 节流门）也不再发。</div>' + beh + '</div>'
    + profHtml
    + '<div class="st-group" style="margin-bottom:12px;"><div style="padding:12px 16px 4px;font-size:17px;font-weight:600;">记忆分类对照</div><div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));padding:0 16px 8px;line-height:1.5;">Memory OS 的分类作主标签，手机现有分类作展示分组，不丢数据。</div>' + mapRows + '</div>'
    + '<div class="st-group" style="margin-bottom:12px;"><div style="padding:12px 16px;"><div style="font-size:17px;font-weight:600;">最近的主动行为</div><div style="margin-top:8px;">' + lastLog + '</div></div></div>'
    + '<div class="st-foot">诚实说明：未接模型时是模板按提示词规则执行，页面与内心调试页会标明“模板生成”；接模型后才由模型按提示词写，标明“模型生成”。</div>'
    + '<div style="height:40px;"></div></div>';
}
function refreshPage() {
  try {
    var sub = document.querySelector('#st-sub-prompts');
    if (!sub) return false;
    var tmp = document.createElement('div');
    tmp.innerHTML = renderSettingsSub('prompts');
    var next = tmp.firstElementChild;
    if (!next) return false;
    sub.replaceWith(next);
    next.classList.add('show');
    return true;
  } catch (e) { return false; }
}
function savePrompt(id) {
  var el = document.getElementById('az-prompt-' + id);
  var v = el ? el.value : '';
  if (!v.trim()) { var tipE = document.getElementById('az-tip'); if (tipE) { tipE.style.color = 'var(--st-danger, #7c2d2d)'; tipE.textContent = '内容是空的，没保存：提示词清空后这条规则就没了，想停用请用旁边的「启用」开关。'; } return false; }
  setPromptText(id, v);
  var tip = document.getElementById('az-tip');
  if (tip) { tip.style.color = 'var(--st-ink,#1e2748)'; tip.textContent = '已保存：' + id + '（' + (id === 'persona' ? '已同步到角色设置 char_identity_v1' : '只存在 phone_prompts_v1') + '）。'; }
  return true;
}
function resetPromptUI(id) {
  try { if (!window.confirm('确定把这条提示词恢复成默认吗？你改过的内容会被覆盖。')) return false; } catch (e) {}
  resetPrompt(id);
  refreshPage();
  var tip = document.getElementById('az-tip');
  if (tip) tip.textContent = '已恢复默认：' + id + '。';
  return true;
}
function saveBaselineFromPage() {
  var gv = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var name = gv('az-base-name') || charName();
  var ageRaw = gv('az-base-age');
  if (ageRaw && (!/^\d+$/.test(ageRaw) || +ageRaw < 1 || +ageRaw > 150)) { var tipE = document.getElementById('az-base-tip'); if (tipE) { tipE.style.color = 'var(--st-danger, #7c2d2d)'; tipE.textContent = '年龄要是 1–150 的数字，现在是「' + ageRaw + '」，没保存。'; } return null; }
  var prof = setBaselineProfile(name, { age: gv('az-base-age'), relationship: gv('az-base-rel'), proficiency: gv('az-base-prof') });
  var tip = document.getElementById('az-base-tip');
  if (tip) tip.textContent = '已确立：' + name + '（年龄 ' + (prof.age || '未填') + ' · 关系 ' + (prof.relationship || '未填') + ' · 熟练度 ' + (prof.proficiency || '未填') + '），后续互动不再重复询问。';
  return prof;
}

try { installModelHook(); } catch (e) {}
window.GroupAZ = {
  MARK: MARK, KEY: KEY, MEMORY_OS: MEMORY_OS, BASELINE: BASELINE,
  DEFAULTS: { memory: MEMORY_OS, proactive: PROACTIVE_DEFAULT, baseline: BASELINE, chat: CHAT_DEFAULT },
  CAT_MAP: CAT_MAP, BEHAVIORS: BEHAVIORS,
  getState: getState, getDefault: getDefault, listPrompts: promptDefs,
  getPrompt: getPrompt, setPromptText: setPromptText, setEnabled: setEnabled, resetPrompt: resetPrompt,
  behaviorEnabled: behaviorEnabled, setBehavior: setBehavior,
  classifyMemory: classifyMemory, extractCandidate: extractCandidate, retrievalPriority: retrievalPriority,
  systemLinesFor: systemLinesFor, chatSystemLines: chatSystemLines, applyMemoryPrompt: applyMemoryPrompt, installModelHook: installModelHook,
  getProfile: getProfile, getProfiles: getProfiles, ensureBaselineProfile: ensureBaselineProfile, setBaselineProfile: setBaselineProfile,
  needsBaselineAsk: needsBaselineAsk, baselineLineFor: baselineLineFor, baselineApplies: baselineApplies, romanceSceneNote: romanceSceneNote,
  detectMomentEvent: detectMomentEvent, momentGate: momentGate, postProactiveMoment: postProactiveMoment,
  postProactiveMomentAsync: postProactiveMomentAsync, onProactiveTick: onProactiveTick, recordRealEvent: recordRealEvent,
  renderSettingsSub: renderSettingsSub, savePrompt: savePrompt, resetPromptUI: resetPromptUI, saveBaselineFromPage: saveBaselineFromPage,
  modelStatusLine: modelStatusLine, identityPersona: identityPersona, charName: charName
};
})();
