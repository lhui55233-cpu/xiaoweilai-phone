

(function () {
'use strict';
if (window.GroupBT) return;
var MARK = 'GROUP-BT';
var BT_KEY = 'phone_seen_seal_v1';
var SEAL_MS = 30 * 60 * 1000;
var SILENT_MARK = '⟦SILENT⟧';
var SEEN_RE = /⟦SEEN:([^|⟧]{1,30})\|([^⟧]{1,120})⟧/;
var _n = 0;
var _tickTimer = null;
var _forceCoax = null;
var _listeners = [];
var _lastFrame = null;
var pendingSeenByChar = {};
var pendingModelTurn = {};
var FALLBACK_GIFTS = [
{ id: 'coffee', name: '手冲咖啡', desc: '他最喜欢的提神方式', delta: 8, line: '……你怎么知道我今天正想喝这个？'},
{ id: 'book', name: '旧书店淘来的书', desc: '扉页上还有上一任主人的批注', delta: 8, line: '这本我找了好久……你居然淘到了。'},
{ id: 'dessert', name: '草莓大福', desc: '甜到心里去的点心', delta: 7, line: '甜点啊……好吧，看在你面子上吃一个。'}
];

var SEEN_TOOL_SPEC = {
name: 'seen_no_reply',
description: '我看完她的话，不想回：写一个心情词和一句为什么。她那句下面会显示「已读」，原因她点开才看得见。用了这一轮就别再写字。',
input_schema: {
type: 'object',
properties: {
mood: { type: 'string', description: '一个心情词，10 个字以内'},
reason: { type: 'string', description: '一句话为什么不回，60 个字以内'}
},
required: ['mood', 'reason']
}
};
var SEEN_CAPABILITY_LINE = '你看完她的话，如果不想回，可以调 seen_no_reply：在本机上输出 ⟦SEEN:心情词|原因⟧（心情词 10 字以内，原因 60 字以内），然后只输出 ⟦SILENT⟧ 这一个标记，别的一个字、一个标点都别写。她那句下面会显示「已读」，原因她点开才看得见；用了这一轮你就不说话。她接着发，你照样都收到；想回的时候再回，不想回可以接着不回。';

/* ── 小工具 ── */
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function p2(n) { return (n < 10? '0': '') + n;}
function fmtTime(ts) { var d = new Date(ts || Date.now()); return p2(d.getHours()) + ':' + p2(d.getMinutes());}
function fmtCountdown(ms) { ms = Math.max(0, ms || 0); var s = Math.ceil(ms / 1000); return p2(Math.floor(s / 60)) + ':' + p2(s % 60);}
function uid(p) { _n++; return p + '_' + Date.now().toString(36) + '_' + _n;}
function clamp(n, a, b) { n = +n || 0; return Math.max(a, Math.min(b, n));}
function trimN(s, n) { return String(s || '').trim().slice(0, n);}
function stripSilent(t) { return String(t == null? '': t).split(SILENT_MARK).join('');}
function onlyPunctuation(t) {
var s = stripSilent(t);
s = s.replace(/[\s.,，。、；：！？!?:;…·—\-~'"“”‘’()（）《》〈〉\[\]{}<>|/\\]/g, '');
return s === '';
}
function lsGet(k) { try { var v = localStorage.getItem(k); return v == null? null: JSON.parse(v);} catch (e) { return null;}}
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}}

/* ── BT 状态（唯一新键 phone_seen_seal_v1） ── */
function loadState() {
var s = lsGet(BT_KEY);
if (!s || typeof s!== 'object') s = { globalEnabled: true, perChar: {}, sessions: {}};
if (s.globalEnabled === undefined) s.globalEnabled = true;
if (!s.perChar) s.perChar = {};
if (!s.sessions) s.sessions = {};
return s;
}
var state = loadState();
function saveState() { lsSet(BT_KEY, state); return state;}
function sessState(sid) {
if (!state.sessions[sid]) state.sessions[sid] = { consecSeen: 0, seens: [], sealed: null, sealCount: 0, events: [], userTimes: []};
var st = state.sessions[sid];
if (!st.seens) st.seens = [];
if (!st.events) st.events = [];
if (!st.userTimes) st.userTimes = [];
return st;
}

/* ── 微信 store ── */
function wxStore() {
try {
var R = (typeof AppRegistry !== 'undefined' ? AppRegistry : window.AppRegistry);
return R && R['wechat'] ? R['wechat'].wxStore : null;
} catch (e) { return null; }
}
function curSess() { try { var st = wxStore(); if (!st) return null; return (st.sessions || []).filter(function (s) { return s.id === st.currentChatId;})[0] || null;} catch (e) { return null;}}
function sessById(id) { try { var st = wxStore(); if (!st) return null; return (st.sessions || []).filter(function (s) { return s.id === id;})[0] || null;} catch (e) { return null;}}
function persistWx() { try { var st = wxStore(); if (st && st._persist) st._persist();} catch (e) {}}
function renderUpdates() { try { if (window.WeChatAppEngine && window.WeChatAppEngine.renderUpdates) window.WeChatAppEngine.renderUpdates();} catch (e) {}}
function lastUserMsg(sess, text) {
var msgs = (sess && sess.messages) || [];
for (var i = msgs.length - 1; i >= 0; i--) {
if (msgs[i] && msgs[i].sender === '我' && (!text || msgs[i].content === text)) return msgs[i];
}
return null;
}
function modelConfigured() {
try {
if (window.PhoneModel && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('chat')) return true;
if (window.WeChatAppEngine && window.WeChatAppEngine.getActiveApiConfig && window.WeChatAppEngine.getActiveApiConfig()) return true;
} catch (e) {}
return false;
}
function enabledFor(name) {
if (state.globalEnabled === false) return false;
var pc = state.perChar[name];
if (pc && pc.enabled === false) return false;
return true;
}
function severeGrievance() {
try {
if (window.CharSubject && window.CharSubject.openUntreated) {
var u = window.CharSubject.openUntreated() || [];
var sev = 0; u.forEach(function (g) { sev = Math.max(sev, g.severity || 0);});
return sev;
}
} catch (e) {}
return 0;
}
function affection(name) {
try {
var all = lsGet('otome_affection_v1') || {};
var rec = all[name];
if (rec && typeof rec.value === 'number') return rec.value;
} catch (e) {}
return 50;
}
function giftList() {
try {
if (window.OtomeF && window.OtomeF.GIFTS && window.OtomeF.GIFTS.length) return window.OtomeF.GIFTS;
} catch (e) {}
return FALLBACK_GIFTS;
}
function giveGiftVia(name, giftId) {
try {
if (window.OtomeF && window.OtomeF.giveGift) {
var r = window.OtomeF.giveGift(name, giftId);
if (r) return r;
}
} catch (e) {}
var g = null; giftList().forEach(function (x) { if (x.id === giftId) g = x;});
if (!g) g = FALLBACK_GIFTS[0];
try {
var all = lsGet('otome_affection_v1') || {};
var rec = all[name] || { value: 0, gifts: [], events: [], rewards: [], impressions: []};
rec.value = clamp((rec.value || 0) + (g.delta || 5), 0, 100);
rec.gifts = rec.gifts || []; rec.gifts.push({ id: g.id, date: new Date().toISOString().slice(0, 10), delta: g.delta || 5});
all[name] = rec; lsSet('otome_affection_v1', all);
return { gift: g, delta: g.delta || 5, value: rec.value};
} catch (e) { return { gift: g, delta: 0, value: affection(name)};}
}

/* ── 帧（进程内事件；本机无真实后端/SSE，不经过网络） ── */
function emitFrame(f) {
_lastFrame = f;
_listeners.forEach(function (cb) { try { cb(f);} catch (e) {}});
}
function onFrame(cb) { if (typeof cb === 'function') _listeners.push(cb); return _listeners.length;}
function filterToolCalls(list) {
return (list || []).filter(function (x) { return!(x && (x.name === 'seen_no_reply' || x.tool === 'seen_no_reply'));});
}

/* ── toast ── */
function toast(msg) {
try {
var el = document.getElementById('bt-toast');
if (!el) {
el = document.createElement('div');
el.id = 'bt-toast'; el.className = 'bt-toast';
document.body.appendChild(el);
}
el.textContent = msg;
el.classList.add('show');
clearTimeout(el._btT);
el._btT = setTimeout(function () { try { el.classList.remove('show');} catch (e) {}}, 2200);
} catch (e) {}
}
function shakeInput() {
try {
var inp = document.getElementById('wx-msg-input');
if (!inp) return;
inp.classList.remove('bt-shake');
void inp.offsetWidth;
inp.classList.add('bt-shake');
setTimeout(function () { try { inp.classList.remove('bt-shake');} catch (e) {}}, 350);
} catch (e) {}
}

/* ── 模板模式：按规则决定是否已读不回 ── */
function decideTemplateSeen(text, sess) {
var st = sessState(sess.id);
if (st.sealed) return null;
var t = String(text || '');
try {
if (window.CharSubject && window.CharSubject.isApology(t) && window.CharSubject.hasCost(t)) return null;
} catch (e) {}
if (/早点睡/.test(t) && /没睡|还没睡|又熬夜|熬夜/.test(t)) return { mood: '不开心', reason: '你说了要早点睡的', rule: 'sleep_promise', mode: 'template'};
if (/说话不算|失约|没做到/.test(t) || /(说好|答应|承诺|说过)[^，。！？]{0,12}(没|不|忘|又)/.test(t)) return { mood: '有点生气', reason: '说好的事又没做到', rule: 'promise', mode: 'template'};
if (severeGrievance() >= 60) return { mood: '还在生气', reason: '上次的事还没过去', rule: 'stance', mode: 'template'};
if ((st.consecSeen || 0) > 0) {
return (st.consecSeen >= 2)
? { mood: '不想理你', reason: '你一直没理他', rule: 'cold_streak', mode: 'template'}
: { mood: '还在生气', reason: '他还在等你好好说话', rule: 'cold_streak', mode: 'template'};
}
var now = Date.now();
var times = (st.userTimes || []).filter(function (x) { return now - x < 60000;});
if (times.length >= 3) {
var msgs = sess.messages || [];
var userIdx = [];
for (var i = 0; i < msgs.length; i++) { if (msgs[i] && msgs[i].sender === '我') userIdx.push(i);}
if (userIdx.length >= 3) {
var start = userIdx[userIdx.length - 3];
var charAfter = false;
for (var j = start + 1; j < msgs.length; j++) {
if (msgs[j] && msgs[j].sender && msgs[j].sender!== '我' && msgs[j].type === 'text') { charAfter = true; break;}
}
if (!charAfter) return { mood: '被晾着', reason: '你发了好几句，都没等他回', rule: 'ignored', mode: 'template'};
}
}
return null;
}

/* ── 轮次 ── */
function beginTurn(sess, text) {
var st = sessState(sess.id);
st.userTimes = (st.userTimes || []).concat([Date.now()]).slice(-5);
saveState();
try { sess._btSeenThisTurn = false; sess._btSilentThisTurn = false;} catch (e) {}
if (!enabledFor(sess.name)) return null;
var turn = { turn_id: uid('turn'), sessId: sess.id, charName: sess.name, text: text, at: Date.now(), source: 'template'};
if (modelConfigured()) {
turn.source = 'model';
pendingModelTurn[sess.id] = turn;
return turn;
}
var dec = decideTemplateSeen(text, sess);
if (dec) {
turn.mood = dec.mood; turn.reason = dec.reason; turn.rule = dec.rule; turn.mode = 'template';
pendingSeenByChar[sess.name] = turn;
}
return turn;
}
function clearPending(turn) {
if (!turn) return;
if (pendingSeenByChar[turn.charName] && pendingSeenByChar[turn.charName].turn_id === turn.turn_id) delete pendingSeenByChar[turn.charName];
if (pendingModelTurn[turn.sessId] && pendingModelTurn[turn.sessId].turn_id === turn.turn_id) delete pendingModelTurn[turn.sessId];
}
function turnValidForSeen(sess, turn) {
var msgs = (sess && sess.messages) || [];
var lu = null, li = -1;
for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i] && msgs[i].sender === '我') { lu = msgs[i]; li = i; break;}}
if (!lu) return false;
if (turn && turn.msgId && lu.id!== turn.msgId) return false;
for (var j = li + 1; j < msgs.length; j++) {
if (msgs[j] && msgs[j].type === 'bt_seen') continue;
if (msgs[j] && msgs[j].sender && msgs[j].sender!== '我' && msgs[j].type === 'text') return false;
}
return true;
}

/* ── 记已读 / 作废 ── */
function recordSeen(sess, turn) {
if (!sess ||!turn ||!turn.mood ||!turn.reason) return null;
if (!enabledFor(sess.name)) return null;
var msgs = sess.messages || (sess.messages = []);
for (var i = 0; i < msgs.length; i++) {
if (msgs[i] && msgs[i].type === 'bt_seen' && msgs[i].turn_id === turn.turn_id) return null;
if (msgs[i] && msgs[i].type === 'bt_seen' && turn.msgId && msgs[i].targetMsgId === turn.msgId) return null;
}
var st = sessState(sess.id);
for (var k = 0; k < (st.seens || []).length; k++) { if (st.seens[k].turn_id === turn.turn_id) return null; if (turn.msgId && st.seens[k].msgId === turn.msgId) return null; }
var at = Date.now();
var rec = { turn_id: turn.turn_id, mood: trimN(turn.mood, 10), reason: trimN(turn.reason, 60), at: at, msgId: turn.msgId || null, source: turn.source || 'template'};
if (!rec.mood ||!rec.reason) return null;
st.seens.push(rec);
st.consecSeen = (st.consecSeen || 0) + 1;
msgs.push({ id: 'seen_' + turn.turn_id, sender: sess.name, type: 'bt_seen', content: '', text: '', turn_id: turn.turn_id, mood: rec.mood, reason: rec.reason, at: at, targetMsgId: turn.msgId || null, time: fmtTime(at)});
try { sess._btSeenThisTurn = true;} catch (e) {}
saveState(); persistWx();
emitFrame({ type: 'seen', turn_id: turn.turn_id, mood: rec.mood, reason: rec.reason, at: at});
try { var sb = document.getElementById('wx-chat-state-bar'); if (sb) sb.classList.remove('wx-typing');} catch (e) {}
renderUpdates();
maybeSeal(sess, rec);
return rec;
}
function emitSeen(turn) {
if (!turn ||!turn.mood) return null;
var sess = sessById(turn.sessId);
if (!sess) return null;
if (!enabledFor(sess.name)) return null;
var msgs = sess.messages || [];
var idx = -1;
if (turn.msgId) { for (var i = 0; i < msgs.length; i++) { if (msgs[i] && msgs[i].id === turn.msgId) { idx = i; break;}}}
if (idx < 0) {
var lu = lastUserMsg(sess, turn.text);
if (!lu) return null;
idx = msgs.indexOf(lu);
turn.msgId = lu.id;
}
for (var j = idx + 1; j < msgs.length; j++) {
if (msgs[j] && msgs[j].type === 'bt_seen') continue;
if (msgs[j] && msgs[j].sender === '我') break;
if (msgs[j] && msgs[j].sender && msgs[j].sender!== '我' && msgs[j].type === 'text') return null;
}
return recordSeen(sess, turn);
}
function removeSeenFromState(sessId, turnId) {
var st = sessState(sessId);
st.seens = (st.seens || []).filter(function (x) { return x.turn_id!== turnId;});
saveState();
}
function voidSeenForTurn(sess, turnId) {
if (!sess ||!turnId) return false;
var msgs = sess.messages || [];
var found = false;
for (var i = msgs.length - 1; i >= 0; i--) {
if (msgs[i] && msgs[i].type === 'bt_seen' && msgs[i].turn_id === turnId) { msgs.splice(i, 1); found = true;}
}
if (found) {
removeSeenFromState(sess.id, turnId);
emitFrame({ type: 'seen_void', turn_id: turnId});
saveState(); persistWx();
}
return found;
}
function voidCheck(sess) {
var msgs = sess.messages || [];
var st = sessState(sess.id);
var voided = [];
for (var i = 0; i < msgs.length; i++) {
var m = msgs[i];
if (!m || m.type!== 'bt_seen') continue;
var sealedAfter = (st.events || []).some(function (ev) { return ev.kind === 'seal' && ev.at >= (m.at || 0);});
if (sealedAfter) continue;
for (var j = i + 1; j < msgs.length; j++) {
var n = msgs[j];
if (!n) continue;
if (n.type === 'bt_seen') continue;
if (n.sender === '我') break;
if (n.type === 'text') {
msgs.splice(i, 1); i--;
removeSeenFromState(sess.id, m.turn_id);
st.consecSeen = 0;
voided.push(m.turn_id);
emitFrame({ type: 'seen_void', turn_id: m.turn_id});
break;
}
}
}
if (voided.length) { saveState(); persistWx();}
return voided;
}

/* ── 接模型：onModelReply（校验 + 静默标记兜底） ── */
function onModelReply(reply, sess) {
var raw = String(reply == null? '': reply);
var s = sess || curSess();
if (!s) return { reply: raw, seen: false};
var turn = pendingModelTurn[s.id] || null;
if (turn) delete pendingModelTurn[s.id];
var mood = null, reason = null, cleaned = raw;
var mm = raw.match(SEEN_RE);
if (mm) { mood = mm[1]; reason = mm[2]; cleaned = raw.replace(SEEN_RE, '');}
else {
var jm = raw.match(/\{[^}]*"seen_no_reply"[^}]*\}/);
if (jm) {
try {
var o = JSON.parse(jm[0]);
var v = o.seen_no_reply || o;
if (v && v.mood) { mood = String(v.mood); reason = String(v.reason || ''); cleaned = raw.replace(jm[0], '');}
} catch (e) {}
}
}
cleaned = stripSilent(cleaned).trim();
if (mood!== null) {
var m2 = String(mood || '').trim(), r2 = String(reason || '').trim();
if (!turnValidForSeen(s, turn) ||!m2 ||!r2) {
return { reply: cleaned, seen: false, error:!turnValidForSeen(s, turn)? 'not_user_turn': 'empty_mood_reason'};
}
if (onlyPunctuation(cleaned)) {
if (!enabledFor(s.name)) { try { s._btSilentThisTurn = true;} catch (e) {} return { reply: '', seen: false, silent: true};}
var t2 = turn || { turn_id: uid('turn'), sessId: s.id, charName: s.name, text: '', at: Date.now(), source: 'model'};
t2.mood = m2.slice(0, 10); t2.reason = r2.slice(0, 60); t2.source = 'model';
var lu = lastUserMsg(s);
if (lu) t2.msgId = lu.id;
var rec = recordSeen(s, t2);
if (rec) return { reply: '', seen: true, turn_id: rec.turn_id};
try { s._btSilentThisTurn = true;} catch (e) {}
return { reply: '', seen: false, silent: true};
}
if (turn) voidSeenForTurn(s, turn.turn_id);
return { reply: cleaned, seen: false};
}
if (raw.indexOf(SILENT_MARK) >= 0 && onlyPunctuation(stripSilent(raw).trim())) {
try { s._btSilentThisTurn = true;} catch (e) {}
return { reply: '', seen: false, silent: true};
}
return { reply: raw, seen: false};
}
function turnHasSeen(sess) { try { return!!(sess && sess._btSeenThisTurn);} catch (e) { return false;}}
function turnSilent(sess) { try { return!!(sess && sess._btSilentThisTurn);} catch (e) { return false;}}

/* ── 封窗 ── */
function isSealed(sessId) {
var st = sessState(sessId);
if (!st.sealed) return false;
if (Date.now() >= (st.sealed.until || 0)) { setTimeout(function () { try { tickSeals(Date.now());} catch (e) {}}, 0); return false;}
return true;
}
function anySealed() {
var now = Date.now(), found = false;
Object.keys(state.sessions || {}).forEach(function (sid) {
var st = state.sessions[sid];
if (st && st.sealed && now < (st.sealed.until || 0)) found = true;
});
return found;
}
function maybeSeal(sess, rec) {
var st = sessState(sess.id);
if (st.sealed) return null;
if ((st.consecSeen || 0) >= 3 || ((st.consecSeen || 0) >= 1 && severeGrievance() >= 60)) {
return sealSession(sess, rec);
}
return null;
}
function proposeCandidate(text) {
try {
if (window.GroupAN && window.GroupAN.proposeMemoryCandidate) window.GroupAN.proposeMemoryCandidate(text, 'bt-seal');
} catch (e) {}
}
function sealSession(sess, rec) {
var st = sessState(sess.id);
if (st.sealed) return st.sealed;
var now = Date.now();
st.sealCount = (st.sealCount || 0) + 1;
st.sealed = {
at: now, until: now + SEAL_MS,
mood: (rec && rec.mood) || '不想说话',
reason: (rec && rec.reason) || '他把窗封上了',
sealCount: st.sealCount, coaxTries: 0, coaxFailed: [], note: ''
};
st.events.push({ kind: 'seal', at: now, reason: st.sealed.reason, mood: st.sealed.mood, sealCount: st.sealCount});
saveState(); persistWx();
proposeCandidate('他把和你的聊天窗口封上了。原因：' + st.sealed.reason + '。');
emitFrame({ type: 'seal', sessId: sess.id, at: now, until: st.sealed.until, reason: st.sealed.reason});
startTick();
renderUpdates();
return st.sealed;
}
function unsealSession(sessId, how, replyText) {
var sess = sessById(sessId);
if (!sess) return false;
var st = sessState(sessId);
if (!st.sealed) return false;
var sealed = st.sealed;
st.sealed = null;
st.consecSeen = 0;
if (pendingSeenByChar[sess.name]) delete pendingSeenByChar[sess.name];
st.events.push({ kind: 'unseal', at: Date.now(), how: how, reason: sealed.reason});
saveState();
proposeCandidate('他解开了封窗。怎么解开的：' + how + '。');
emitFrame({ type: 'unseal', sessId: sessId, how: how, at: Date.now()});
if (replyText) {
sess.messages = sess.messages || [];
sess.messages.push({ id: 'm_bt_' + Date.now(), sender: sess.name, type: 'text', content: replyText, time: '刚刚'});
sess.preview = replyText;
}
persistWx();
renderUpdates();
return true;
}
function coax(sessId, kind, giftId) {
var sess = sessById(sessId);
if (!sess) return { ok: false, reason: 'no_session'};
var st = sessState(sessId);
if (!st.sealed) return { ok: false, reason: 'not_sealed'};
if ((st.sealed.coaxTries || 0) >= 3) return { ok: false, reason: 'tries_exhausted'};
var forced = _forceCoax; _forceCoax = null;
st.sealed.coaxTries = (st.sealed.coaxTries || 0) + 1;
var giftLine = '';
if (kind === 'gift') {
var g = null; giftList().forEach(function (x) { if (x.id === giftId) g = x;});
if (!g) { var gl = giftList(); g = gl[0];}
var gr = giveGiftVia(sess.name, g.id);
giftLine = (gr && gr.gift && gr.gift.line) || g.line || '';
}
var aff = affection(sess.name);
var chance = clamp(20 + aff - 15 * ((st.sealed.sealCount || 1) - 1) - 12 * (st.sealed.coaxTries - 1) + (kind === 'gift'? 10: (kind === 'cute'? 5: 0)), 5, 95);
var success;
if (forced!== null && forced!== undefined) success =!!forced;
else {
var h = (aff * 7 + (st.sealed.sealCount || 1) * 31 + st.sealed.coaxTries * 17 + sess.name.length * 13) % 100;
success = h < chance;
}
if (success) {
var line = kind === 'gift'? ((giftLine? giftLine + ' ': '') + '好吧，不生气了。'): kind === 'cute'? '……真是拿你没办法。': '……好吧，原谅你了。';
unsealSession(sessId, 'coax:' + kind, line);
return { ok: true, chance: chance, line: line};
}
var label = kind === 'gift'? '送礼物': kind === 'cute'? '撒娇': '道歉';
st.sealed.coaxFailed.push({ kind: kind, at: Date.now()});
st.sealed.note = '你试着哄他（' + label + '），他还没消气。';
saveState();
return { ok: false, reason: 'not_yet', chance: chance, tries: st.sealed.coaxTries};
}
function startTick() {
if (_tickTimer) return;
_tickTimer = setInterval(function () { try { tickSeals(Date.now());} catch (e) {}}, 1000);
}
function tickSeals(now) {
now = now || Date.now();
var changed = false;
Object.keys(state.sessions || {}).forEach(function (sid) {
var st = state.sessions[sid];
if (st && st.sealed && now >= (st.sealed.until || 0)) {
unsealSession(sid, 'timeout', '我回来了。刚才封了窗，现在气消了。');
changed = true;
}
});
if (!anySealed() && _tickTimer) { clearInterval(_tickTimer); _tickTimer = null;}
updateCountdownDom();
return changed;
}
function updateCountdownDom() {
try {
var el = document.getElementById('bt-countdown');
if (el) {
var sess = curSess();
if (sess) { var st = sessState(sess.id); if (st.sealed) el.textContent = fmtCountdown(st.sealed.until - Date.now());}
}
var nodes = document.querySelectorAll('[data-bt-countdown]');
for (var i = 0; i < nodes.length; i++) {
var sid = nodes[i].getAttribute('data-bt-countdown');
var st2 = sessState(sid);
if (st2.sealed) nodes[i].textContent = fmtCountdown(st2.sealed.until - Date.now());
}
} catch (e) {}
}

/* ── 渲染：已读戳 + 锁窗页 ── */
function lockSVG() {
return '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
+ '<path d="M60 102 C32 80 20 60 20 44 C20 30 31 20 43 20 C51 20 57 25 60 32 C63 25 69 20 77 20 C89 20 100 30 100 44 C100 60 88 80 60 102 Z"/>'
+ '<path d="M44 40 V32 a16 16 0 0 1 32 0 V40"/>'
+ '<circle cx="60" cy="58" r="6"/>'
+ '<path d="M60 64 V76"/>'
+ '</svg>';
}
function lockHTML(sess, sealed) {
var tries = sealed.coaxTries || 0;
return '<div class="bt-lock-inner">'
+ '<div class="bt-lock-art">' + lockSVG() + '</div>'
+ '<div class="bt-lock-en">SESSION LOCKED</div>'
+ '<div class="bt-lock-cn">' + esc(sess.name) + '把窗封上了</div>'
+ '<div class="bt-lock-meta">封于 ' + fmtTime(sealed.at) + ' · <b><span id="bt-countdown">' + fmtCountdown(sealed.until - Date.now()) + '</span></b> 后他自己消气</div>'
+ '<div class="bt-lock-btns">'
+ '<button type="button" class="bt-btn" data-bt-act="why" data-bt-sess="' + esc(sess.id) + '">他为什么关门</button>'
+ '<button type="button" class="bt-btn primary" data-bt-act="coax" data-bt-sess="' + esc(sess.id) + '">哄哄他</button>'
+ '</div>'
+ '<div class="bt-lock-note">每封一次最多哄 3 次（已用 ' + tries + '/3 次）· 实在等不及可以在设置 → 已读不回与封窗里手动解封</div>'
+ '</div>';
}
function injectStamps(sess) {
var box = document.getElementById('wx-msg-stream-container');
if (!box) return;
var rows = box.querySelectorAll('.wx-msg-row[data-mid^="seen_"]');
for (var r = 0; r < rows.length; r++) { rows[r].style.display = 'none';}
(sess.messages || []).forEach(function (m) {
if (!m || m.type!== 'bt_seen' ||!m.targetMsgId) return;
var row = box.querySelector('.wx-msg-row[data-mid="' + m.targetMsgId + '"]');
if (!row) return;
var wrap = row.querySelector('.wx-bubble-wrap');
if (!wrap) return;
var ts = row.querySelector('.an-bubble-ts');
if (ts) ts.style.display = 'none';
if (wrap.querySelector('.bt-seen-stamp')) return;
var d = document.createElement('div');
d.className = 'bt-seen-stamp';
d.setAttribute('data-bt-turn', m.turn_id);
d.setAttribute('data-bt-sess', sess.id);
d.textContent = '已读 ' + fmtTime(m.at || Date.now());
wrap.appendChild(d);
});
}
function syncSealUI(sess) {
var input = document.getElementById('wx-msg-input');
var sendBtn = document.getElementById('wx-send-btn-el');
var box = document.getElementById('wx-msg-stream-container');
var sealed =!!(sess && isSealed(sess.id));
var overlay = document.getElementById('bt-lock-overlay');
if (sealed) {
var st = sessState(sess.id).sealed;
if (input) { input.readOnly = true; input.placeholder = '窗封着呢，先哄哄他或者等他消气';}
if (sendBtn) sendBtn.disabled = true;
if (box &&!overlay) {
var host = box.parentNode;
if (host) {
try { var cs = window.getComputedStyle? getComputedStyle(host): null; if (cs && cs.position === 'static') host.style.position = 'relative';} catch (e) {}
var ov = document.createElement('div');
ov.id = 'bt-lock-overlay'; ov.className = 'bt-lock-overlay';
ov.innerHTML = lockHTML(sess, st);
host.appendChild(ov);
}
} else if (overlay) {
var cd = document.getElementById('bt-countdown');
if (cd) cd.textContent = fmtCountdown(st.until - Date.now());
}
} else {
if (overlay) overlay.remove();
if (input && input.readOnly) { input.readOnly = false; input.placeholder = '输入内容...';}
if (sendBtn && sendBtn.disabled) sendBtn.disabled = false;
}
}
function postRender() {
try {
var sess = curSess();
if (!sess) { syncSealUI(null); return;}
var voided = voidCheck(sess);
if (voided.length) {
voided.forEach(function (tid) {
var row = document.querySelector('.wx-msg-row[data-mid="seen_' + tid + '"]');
if (row) row.remove();
});
}
injectStamps(sess);
syncSealUI(sess);
tickSeals(Date.now());
} catch (e) {}
}

/* ── 卡片 / 哄他面板 / 设置页 ── */
function closeOverlays() {
try {
var nodes = document.querySelectorAll('[data-bt-overlay]');
for (var i = 0; i < nodes.length; i++) { nodes[i].remove();}
} catch (e) {}
}
function avatarHTML(sess) {
if (sess && sess.avatarImg) return '<span class="bt-card-av"><img src="' + esc(sess.avatarImg) + '" alt=""></span>';
var ch = (sess && sess.name? String(sess.name).trim().charAt(0): '?') || '?';
return '<span class="bt-card-av">' + esc(ch) + '</span>';
}
function openSeenCard(sessId, turnId) {
var sess = sessById(sessId);
if (!sess) return false;
var rec = null;
(sess.messages || []).forEach(function (m) { if (m && m.type === 'bt_seen' && m.turn_id === turnId) rec = m;});
if (!rec) {
var st = sessState(sessId);
(st.seens || []).forEach(function (x) { if (x.turn_id === turnId) rec = x;});
}
if (!rec) return false;
closeOverlays();
var ov = document.createElement('div');
ov.className = 'bt-panel'; ov.setAttribute('data-bt-overlay', '1');
var extra = '';
var st2 = sessState(sessId);
if (st2.sealed && st2.sealed.reason === rec.reason) extra = '<div class="bt-card-extra">这次已读之后，他把窗封上了。</div>';
if (rec.source === 'template') extra += '<div class="bt-card-extra">模板模式：未接模型时按模板规则决定。</div>';
ov.innerHTML = '<div class="bt-panel-card">'
+ '<div class="bt-card-head">' + avatarHTML(sess)
+ '<div><div class="bt-card-name">' + esc(sess.name) + '</div><div class="bt-card-time">' + fmtTime(rec.at || Date.now()) + '</div></div></div>'
+ '<div class="bt-card-mood">心情：<b>' + esc(rec.mood || '') + '</b></div>'
+ '<div class="bt-card-reason">' + esc(rec.reason || '') + '</div>'
+ extra
+ '<div style="margin-top:14px;"><button type="button" class="bt-btn primary" data-bt-act="close-panel">知道了</button></div>'
+ '</div>';
document.body.appendChild(ov);
return true;
}
function openWhyCard(sessId) {
var sess = sessById(sessId);
if (!sess) return false;
var st = sessState(sessId);
if (!st.sealed) return false;
closeOverlays();
var ov = document.createElement('div');
ov.className = 'bt-panel'; ov.setAttribute('data-bt-overlay', '1');
var fails = '';
(st.sealed.coaxFailed || []).forEach(function (f) {
var label = f.kind === 'gift'? '送礼物': f.kind === 'cute'? '撒娇': '道歉';
fails += '<div>你试着哄他（' + esc(label) + '），他还没消气。</div>';
});
if (st.sealed.note) fails += '<div>' + esc(st.sealed.note) + '</div>';
ov.innerHTML = '<div class="bt-panel-card">'
+ '<div class="bt-card-head">' + avatarHTML(sess)
+ '<div><div class="bt-card-name">' + esc(sess.name) + '</div><div class="bt-card-time">封于 ' + fmtTime(st.sealed.at) + ' · <span data-bt-countdown="' + esc(sess.id) + '">' + fmtCountdown(st.sealed.until - Date.now()) + '</span> 后自动解封</div></div></div>'
+ '<div class="bt-card-mood">心情：<b>' + esc(st.sealed.mood || '') + '</b></div>'
+ '<div class="bt-card-reason">' + esc(st.sealed.reason || '') + '</div>'
+ (fails? '<div class="bt-card-extra">' + fails + '</div>': '')
+ '<div style="margin-top:14px;"><button type="button" class="bt-btn primary" data-bt-act="close-panel">知道了</button></div>'
+ '</div>';
document.body.appendChild(ov);
return true;
}
function openCoaxPanel(sessId) {
var sess = sessById(sessId);
if (!sess) return false;
var st = sessState(sessId);
if (!st.sealed) return false;
closeOverlays();
var tries = st.sealed.coaxTries || 0;
var ov = document.createElement('div');
ov.className = 'bt-panel'; ov.setAttribute('data-bt-overlay', '1');
ov.id = 'bt-coax-panel';
ov.setAttribute('data-bt-sess', sess.id);
var gifts = giftList().slice(0, 4);
var giftBtns = gifts.map(function (g) {
return '<button type="button" class="bt-btn" data-bt-gift="' + esc(g.id) + '">' + esc(g.name) + ' · 好感 +' + (g.delta || 0) + '</button>';
}).join('');
ov.innerHTML = '<div class="bt-panel-card">'
+ '<div class="bt-panel-title">哄哄他</div>'
+ '<div class="bt-panel-sub">成功率看好感度和封窗次数（第 ' + (st.sealed.sealCount || 1) + ' 次封窗）。每封一次最多哄 3 次，已用 ' + tries + '/3 次。</div>'
+ '<div class="bt-coax-btns">'
+ '<button type="button" class="bt-btn" data-bt-coax="apology"' + (tries >= 3? ' disabled': '') + '>道歉</button>'
+ '<button type="button" class="bt-btn" data-bt-coax="cute"' + (tries >= 3? ' disabled': '') + '>撒娇</button>'
+ '<button type="button" class="bt-btn" data-bt-act="show-gifts"' + (tries >= 3? ' disabled': '') + '>送礼物</button>'
+ '</div>'
+ '<div class="bt-gift-list" id="bt-gift-list" style="display:none;">' + giftBtns + '</div>'
+ '<div class="bt-panel-note" id="bt-coax-note">' + (tries >= 3? '3 次都失败了，只能等他自己消气了。': '') + '</div>'
+ '<div style="margin-top:14px;"><button type="button" class="bt-btn" data-bt-act="close-panel">先不等了</button></div>'
+ '</div>';
document.body.appendChild(ov);
return true;
}
function settingsRowValue() {
if (state.globalEnabled === false) return '关';
var n = 0;
Object.keys(state.sessions || {}).forEach(function (sid) { if (state.sessions[sid] && state.sessions[sid].sealed) n++;});
return n? ('开 · 已封窗 ' + n + ' 个'): '开';
}
function openSettings() {
closeOverlays();
var ov = document.createElement('div');
ov.className = 'bt-settings'; ov.id = 'bt-settings-overlay'; ov.setAttribute('data-bt-overlay', '1');
document.body.appendChild(ov);
renderSettingsContent();
return true;
}
function renderSettingsContent() {
var ov = document.getElementById('bt-settings-overlay');
if (!ov) return false;
var store = wxStore();
var sessions = (store && store.sessions) || [];
var charRows = '';
sessions.forEach(function (s) {
if (s.isGroup) return;
var on = enabledFor(s.name);
charRows += '<div class="bt-set-row"><span>' + esc(s.name) + (isSealed(s.id)? ' · 已封窗': '') + '</span>'
+ '<button type="button" class="bt-btn" data-bt-act="toggle-char" data-bt-name="' + esc(s.name) + '">' + (on? '开': '关') + '</button></div>';
});
if (!charRows) charRows = '<div class="bt-set-note">还没有 1 对 1 聊天会话。</div>';
var sealedRows = '';
sessions.forEach(function (s) {
var st = sessState(s.id);
if (!st.sealed) return;
sealedRows += '<div class="bt-set-row"><span>' + esc(s.name) + ' · 封于 ' + fmtTime(st.sealed.at) + ' · <span data-bt-countdown="' + esc(s.id) + '">' + fmtCountdown(st.sealed.until - Date.now()) + '</span></span>'
+ '<button type="button" class="bt-btn primary" data-bt-act="manual-unseal" data-bt-sess="' + esc(s.id) + '">手动解封</button></div>';
});
if (!sealedRows) sealedRows = '<div class="bt-set-note">现在没有封着的聊天窗口。</div>';
ov.innerHTML = '<div class="bt-settings-bar">'
+ '<button type="button" class="bt-btn" data-bt-act="close-panel">‹ 设置</button>'
+ '<div class="bt-settings-title">已读不回与封窗</div></div>'
+ '<div class="bt-settings-body">'
+ '<div class="bt-set-row"><span>总开关（默认开）</span><button type="button" class="bt-btn" data-bt-act="toggle-global">' + (state.globalEnabled === false? '关': '开') + '</button></div>'
+ '<div class="bt-set-note">关掉后，他不会再留「已读不回」，也不会封窗。未接模型时按模板规则决定（模板模式）。</div>'
+ '<div class="bt-set-sec">按人物</div>' + charRows
+ '<div class="bt-set-sec">封窗中的聊天</div>' + sealedRows
+ '<div class="bt-set-note">实在等不及可以在这里解封。封窗与解封都会写进该会话的事件记录，并进候选记忆审阅（你确认才记）。</div>'
+ '<details><summary>模型工具 seen_no_reply</summary>'
+ '<div>工具名：seen_no_reply；字段：mood（心情词，10 字以内）、reason（原因，60 字以内）。'
+ '本机 PhoneModel.chatComplete 是纯文本补全、没有 tools 参数，所以工具以 ⟦SEEN:心情|原因⟧ 标记协议实现，'
+ '模型用后只输出 ⟦SILENT⟧ 这一个静默标记；去掉标记后只剩空白和标点的内容直接丢弃，不会多出一条“.”回复。</div></details>'
+ '</div>';
return true;
}
function handleBtAct(el) {
var act = el.getAttribute('data-bt-act');
var sessId = el.getAttribute('data-bt-sess');
if (act === 'close-panel') { var ov = el.closest? el.closest('[data-bt-overlay]'): null; if (ov) ov.remove(); return true;}
if (act === 'why') { return openWhyCard(sessId);}
if (act === 'coax') { return openCoaxPanel(sessId);}
if (act === 'show-gifts') {
var gl = document.getElementById('bt-gift-list');
if (gl) gl.style.display = gl.style.display === 'none'? 'flex': 'none';
return true;
}
if (act === 'toggle-global') {
state.globalEnabled = state.globalEnabled === false? true: false;
saveState(); renderSettingsContent();
return true;
}
if (act === 'toggle-char') {
var name = el.getAttribute('data-bt-name');
if (name) {
var cur = enabledFor(name);
state.perChar[name] = { enabled:!cur};
saveState(); renderSettingsContent();
}
return true;
}
if (act === 'manual-unseal') {
if (sessId) {
unsealSession(sessId, 'manual', '你手动把窗打开了，我回来了。');
closeOverlays();
toast('窗已解开');
}
return true;
}
return false;
}
function doCoax(el) {
var panel = document.getElementById('bt-coax-panel');
var sessId = panel? panel.getAttribute('data-bt-sess'): el.getAttribute('data-bt-sess');
var kind = el.getAttribute('data-bt-coax');
if (!sessId ||!kind) return false;
var res = coax(sessId, kind);
var note = document.getElementById('bt-coax-note');
if (res.ok) {
closeOverlays();
toast('他消气了，窗解开了');
return true;
}
if (note) {
note.textContent = res.reason === 'tries_exhausted'
? '3 次都失败了，只能等他自己消气了。'
: ('他还没消气。（已用 ' + (res.tries || 0) + '/3 次）');
}
if (res.reason === 'tries_exhausted' || (res.tries || 0) >= 3) {
var btns = document.querySelectorAll('#bt-coax-panel [data-bt-coax], #bt-coax-panel [data-bt-act="show-gifts"]');
for (var i = 0; i < btns.length; i++) { btns[i].disabled = true;}
}
renderUpdates();
return false;
}
function doCoaxGift(el) {
var panel = document.getElementById('bt-coax-panel');
var sessId = panel? panel.getAttribute('data-bt-sess'): el.getAttribute('data-bt-sess');
var giftId = el.getAttribute('data-bt-gift');
if (!sessId ||!giftId) return false;
var res = coax(sessId, 'gift', giftId);
var note = document.getElementById('bt-coax-note');
if (res.ok) {
closeOverlays();
toast('他收下礼物，消气了，窗解开了');
return true;
}
if (note) {
note.textContent = res.reason === 'tries_exhausted'
? '3 次都失败了，只能等他自己消气了。'
: ('他收下了礼物，但还没消气。（已用 ' + (res.tries || 0) + '/3 次）');
}
if (res.reason === 'tries_exhausted' || (res.tries || 0) >= 3) {
var btns = document.querySelectorAll('#bt-coax-panel [data-bt-coax], #bt-coax-panel [data-bt-act="show-gifts"]');
for (var i = 0; i < btns.length; i++) { btns[i].disabled = true;}
}
renderUpdates();
return false;
}

/* ── 接线 ── */
function wrapEngine() {
try {
var e = window.WeChatAppEngine;
if (!e || typeof e.sendMsg!== 'function' || typeof e.renderUpdates!== 'function') return false;
if (!e.sendMsg._btWrapped) {
var origSend = e.sendMsg;
var wrappedSend = function () {
var inp = document.getElementById('wx-msg-input');
var text = inp? String(inp.value || '').trim(): '';
var sess = curSess();
if (!sess || sess.isGroup ||!text) return origSend.apply(this, arguments);
if (isSealed(sess.id)) { shakeInput(); toast('窗封着呢，先哄哄他或者等他消气'); return false;}
var turn = null;
try { turn = beginTurn(sess, text);} catch (err) { turn = null;}
var out = origSend.apply(this, arguments);
if (turn) {
try {
var m = lastUserMsg(sess, text);
if (m) turn.msgId = m.id; else clearPending(turn);
} catch (err2) { clearPending(turn);}
}
return out;
};
wrappedSend._btWrapped = true;
e.sendMsg = wrappedSend;
}
if (!e.renderUpdates._btWrapped) {
var origRender = e.renderUpdates;
var wrappedRender = function () {
var out;
try { out = origRender.apply(this, arguments);} finally { try { postRender();} catch (err) {}}
return out;
};
wrappedRender._btWrapped = true;
e.renderUpdates = wrappedRender;
}
if (typeof e.startVoiceCall === 'function' &&!e.startVoiceCall._btWrapped) {
var origCall = e.startVoiceCall;
var wrappedCall = function () {
var sess2 = curSess();
if (sess2 && isSealed(sess2.id)) { toast('窗封着呢，他不会接电话'); return false;}
return origCall.apply(this, arguments);
};
wrappedCall._btWrapped = true;
e.startVoiceCall = wrappedCall;
}
return true;
} catch (err) { return false;}
}
function wrapDecide() {
try {
var CS = window.CharSubject;
if (!CS || typeof CS.decideForMessage!== 'function' || CS.decideForMessage._btWrapped) return false;
var orig = CS.decideForMessage;
var wrapped = function (text, opts) {
var name = (opts && opts.charName) || '';
var pend = pendingSeenByChar[name];
if (pend) {
delete pendingSeenByChar[name];
if (Date.now() - pend.at < 15000) {
var turn = pend;
setTimeout(function () { try { emitSeen(turn);} catch (e) {}}, 120);
return { action: 'silence', rule: 'BT_seen', reason: '已读不回：这一轮只留心情词和原因，不写正文', tone: '冷淡', text: null};
}
}
return orig.apply(CS, arguments);
};
wrapped._btWrapped = true;
CS.decideForMessage = wrapped;
return true;
} catch (e) { return false;}
}
function wrapProactive() {
try {
var CI = window.CharInnerLife;
if (!CI || typeof CI.canSendProactive!== 'function' || CI.canSendProactive._btWrapped) return false;
var orig = CI.canSendProactive;
var wrapped = function (now) {
try { if (anySealed()) return { ok: false, reason: 'bt_sealed'};} catch (e) {}
return orig.apply(CI, arguments);
};
wrapped._btWrapped = true;
CI.canSendProactive = wrapped;
return true;
} catch (e) { return false;}
}
function installClicks() {
if (installClicks._done) return;
installClicks._done = true;
document.addEventListener('click', function (e) {
try {
var t = e.target;
if (!t ||!t.closest) return;
var srow = t.closest('[data-act="bt_seen"]');
if (srow) { e.preventDefault(); e.stopPropagation(); openSettings(); return;}
var stamp = t.closest('.bt-seen-stamp');
if (stamp) { openSeenCard(stamp.getAttribute('data-bt-sess'), stamp.getAttribute('data-bt-turn')); return;}
var actEl = t.closest('[data-bt-act]');
if (actEl) { handleBtAct(actEl); return;}
var coaxEl = t.closest('[data-bt-coax]');
if (coaxEl) { doCoax(coaxEl); return;}
var giftEl = t.closest('[data-bt-gift]');
if (giftEl) { doCoaxGift(giftEl); return;}
if (t.id === 'wx-msg-input') {
var sess = curSess();
if (sess && isSealed(sess.id)) { e.preventDefault(); shakeInput(); toast('窗封着呢，先哄哄他或者等他消气');}
}
} catch (err) {}
}, true);
}
function install() {
installClicks();
var tries = 0;
function attempt() {
tries++;
var ok = false;
try { ok = wrapEngine();} catch (e) {}
try { wrapDecide();} catch (e) {}
try { wrapProactive();} catch (e) {}
if (!ok && tries < 10) setTimeout(attempt, 400);
else if (ok) { try { tickSeals(Date.now());} catch (e) {}}
}
attempt();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
else install();

window.GroupBT = {
MARK: MARK,
key: BT_KEY,
seenToolSpec: SEEN_TOOL_SPEC,
capabilityLine: SEEN_CAPABILITY_LINE,
sealMs: SEAL_MS,
state: function () { return state;},
saveState: saveState,
enabledFor: enabledFor,
setGlobalEnabled: function (on) { state.globalEnabled =!!on; saveState(); return state.globalEnabled;},
setPerCharEnabled: function (name, on) { state.perChar[name] = { enabled:!!on}; saveState(); return state.perChar[name].enabled;},
settingsRowValue: settingsRowValue,
openSettings: openSettings,
decideTemplateSeen: decideTemplateSeen,
beginTurn: beginTurn,
emitSeen: emitSeen,
recordSeen: recordSeen,
voidSeenForTurn: voidSeenForTurn,
onModelReply: onModelReply,
stripSilent: stripSilent,
onlyPunctuation: onlyPunctuation,
turnHasSeen: turnHasSeen,
turnSilent: turnSilent,
filterToolCalls: filterToolCalls,
onFrame: onFrame,
lastFrame: function () { return _lastFrame;},
isSealed: isSealed,
anySealed: anySealed,
sealSession: sealSession,
unsealSession: unsealSession,
coax: coax,
tickSeals: tickSeals,
affection: affection,
openSeenCard: openSeenCard,
openWhyCard: openWhyCard,
openCoaxPanel: openCoaxPanel,
_testSetCoax: function (v) { _forceCoax = (v === true); return _forceCoax;},
_testSetSealUntil: function (sessId, ts) { var st = sessState(sessId); if (st.sealed) { st.sealed.until = ts; saveState();} return st.sealed;},
_testFastForward: function (sessId, ms) { var st = sessState(sessId); if (st.sealed) { st.sealed.until = Date.now() - 1000; saveState(); tickSeals(Date.now());} return!isSealed(sessId);},
_postRender: postRender
};
})();

