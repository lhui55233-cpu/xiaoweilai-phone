
/* ══════════ Group M · 桌面宠物 + 内心驱动/做梦 + 唤醒抽奖 + 记忆树 ══════════
出处（只借鉴做法，绝不复制代码；本模块全部为新写代码）：
- 桌面宠物：做法借鉴 VPet（MIT，桌面宠物）、ai-live2d-body（CC BY 4.0，自绘 Live2D 风小人）、
Miru（桌面宠物待机/互动）；形象与立体书世界、乙游、微信头像同一套（读 cike_char_look_v1 发色瞳色，
抠图人物 otome_custom_char_v1 优先）。
- 内心驱动：做法借鉴 jiwen（MIT，约 500 行思路：内在状态随时间/事件漂移、到阈值触发行为）；
梦境做法借鉴 dreams（通用做法：夜间整理白天经历、早上讲梦）。
- 唤醒抽奖：做法借鉴 wake-lottery（MIT，早上抽一张券、兑现要真实）；记忆树做法借鉴 sealed-days
（按日期挂牌、封印收藏、可逆）。
- 共读见 novel 内的 Group M 段落（做法借鉴 reading-nook MIT / coread）。
- 汇总合集出处：github.com/DasterProkio/awesome-ai-companion（CC BY 4.0 的合集，各项目保持各自许可）。
触发行为走已有微信消息通道（AppRegistry.wechat.wxStore + WeChatAppEngine.renderUpdates，
与 worldstate_proactive 的 _dispatch 同款做法），不新开通道、不改微信发送/回复逻辑。
新键：char_drives_v1 / char_dreams_v1 / wake_lottery_v1 / sealed_days_v1。
只读/复用旧键：cike_char_look_v1、otome_custom_char_v1、cike_cache_v1、ck_diary_meta_v1、
guichao.memories.v1、phone_schedule_v1、phone_settings_v3、phone_wechat_store_v2、cike_album_v1。
标记：GroupM-v1
══════════ */
(function () {
'use strict';

function lsGet(k, def) { try { var r = localStorage.getItem(k); if (r == null) return def; return JSON.parse(r);} catch (e) { return def;}}
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v));} catch (e) {}}
function esc(s) { return String(s == null? '': s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];});}
function pad2(n) { return String(n).padStart(2, '0');}
function dayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());}
function clamp(v) { return Math.max(5, Math.min(95, Math.round(v)));}
function gmAlert(msg) { try { alert(msg);} catch (e) {}}
/* 昼夜规则与此刻的 ckPhaseForHour 同款（6–17 白天，17–19 黄昏，其余夜晚），此处重写一份小函数 */
function phaseForHour(h) { return (h >= 6 && h < 17)? 'day': ((h >= 17 && h < 19)? 'dusk': 'night');}

function wxSessions() {
try { if (typeof AppRegistry!== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) return AppRegistry.wechat.wxStore.sessions || [];} catch (e) {}
return [];
}
function charName() {
try { if (typeof SystemStore!== 'undefined' && SystemStore.get) { var c = SystemStore.get('character'); if (c) return c;}} catch (e) {}
var s = wxSessions();
if (s.length && s[0].name) return s[0].name;
return '机';
}
function proactiveAllowed() {
try { var s = lsGet('phone_settings_v3', null); return!!(s && s.proactiveMsg === true);} catch (e) { return false;}
}
/* 微信消息投递：只写会话 store（与 worldstate_proactive 的 _dispatch 同款做法），不碰发送/回复逻辑 */
function wxPush(name, text, kind) {
var delivered = false;
try {
var store = (typeof AppRegistry!== 'undefined' && AppRegistry.wechat)? AppRegistry.wechat.wxStore: null;
var sess = store && (store.sessions || []).find(function (s) { return s.name === name &&!s.isGroup;});
if (sess) {
sess.messages.push({ id: 'gm_' + Date.now(), sender: name, type: 'text', content: text, time: '刚刚'});
sess.preview = text; sess.unread = (sess.unread || 0) + 1;
try { if (typeof WeChatAppEngine!== 'undefined' && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates();} catch (e) {}
try { if (typeof MemoryCore!== 'undefined' && MemoryCore.write) MemoryCore.write({ source: name, content: text, layer: 'short', forceWeight: 0.4});} catch (e) {}
delivered = true;
}
} catch (e) {}
if (!delivered) {
try {
var raw = localStorage.getItem('phone_wechat_store_v2');
if (raw) {
var data = JSON.parse(raw);
var ss = data.sessions || [];
var s2 = ss.find(function (x) { return x.name === name &&!x.isGroup;});
if (s2) {
s2.messages = s2.messages || [];
s2.messages.push({ id: 'gm_' + Date.now(), sender: name, type: 'text', content: text, time: '刚刚'});
s2.preview = text; s2.unread = (s2.unread || 0) + 1;
localStorage.setItem('phone_wechat_store_v2', JSON.stringify(data));
delivered = true;
}
}
} catch (e) {}
}
try {
var island = document.getElementById('sys-dynamic-island');
if (island) {
try { if (window.DynamicIsland) window.DynamicIsland.showMessage(name, text); } catch (e) {}
}
} catch (e) {}
return delivered;
}

/* ── 内心驱动：五条内在状态，随时间小幅漂移，到阈值走微信通道触发行为 ── */
var DRIVES_KEY = 'char_drives_v1';
var DRIVE_DEFS = [{ k: 'closeness', label: '亲近'}, { k: 'stubborn', label: '倔强'}, { k: 'mood', label: '心情'}, { k: 'anxiety', label: '焦虑'}, { k: 'busy', label: '忙碌'}];
var DRIVE_DEFAULT = { closeness: 60, stubborn: 40, mood: 65, anxiety: 25, busy: 30};
function drivesLoad() {
var d = lsGet(DRIVES_KEY, null);
if (!d || typeof d!== 'object') d = {};
var out = {};
DRIVE_DEFS.forEach(function (x) { out[x.k] = (typeof d[x.k] === 'number')? d[x.k]: DRIVE_DEFAULT[x.k];});
out._last = d._last || {};
out._lastDrift = d._lastDrift || 0;
return out;
}
function drivesSave(d) { lsSet(DRIVES_KEY, d);}
function drivesDrift(nowMs) {
var now = nowMs || Date.now();
var d = drivesLoad();
if (d._lastDrift && now - d._lastDrift < 3600 * 1000) return d; /* 每小时最多轻推一次 */
var h = new Date(now).getHours();
var walk = function (v, amt) { return clamp(v + (Math.random() * 2 - 1) * amt);};
d.closeness = walk(d.closeness, 2);
d.stubborn = walk(d.stubborn, 2);
d.mood = walk(d.mood, 3);
d.anxiety = walk(d.anxiety, 3);
d.busy = walk(d.busy, 3);
if (h >= 0 && h < 6) { d.busy = clamp(d.busy - 4); d.mood = clamp(d.mood - 1);}
if (h >= 6 && h < 9) { d.anxiety = clamp(d.anxiety - 1); d.mood = clamp(d.mood + 1);}
d._lastDrift = now;
drivesSave(d);
return d;
}
function drivesCheck(nowMs, opts) {
var now = nowMs || Date.now();
var d = drivesLoad();
var name = charName();
var out = [];
var cool = 6 * 3600 * 1000;
var fire = function (kind, text) {
if ((d._last[kind] || 0) && now - d._last[kind] < cool) return false;
if (!proactiveAllowed() &&!(opts && opts.force)) return false;
var ok = wxPush(name, text, 'drive_' + kind);
d._last[kind] = now;
drivesSave(d);
out.push({ kind: kind, text: text, delivered: ok});
return true;
};
if (d.anxiety >= 75) fire('anxiety', '最近有点焦虑……想和你说说话，你在吗？');
if (d.busy >= 75) fire('busy', '今天有点忙，可能回消息会慢一点，别担心我。');
if (d.mood <= 20) fire('mood', '今天心情有点蔫……想靠着你待一会儿。');
return out;
}

/* ── 做梦：夜里按当天日程/日记生成梦境，早上第一次打开时在微信里讲给你听 ── */
var DREAMS_KEY = 'char_dreams_v1';
function dreamsLoad() { var a = lsGet(DREAMS_KEY, []); return Array.isArray(a)? a: [];}
function buildDream(dateStr) {
var y = new Date(); y.setDate(y.getDate() - 1);
var yStr = dayStr(y);
var sched = lsGet('phone_schedule_v1', []);
var todays = (Array.isArray(sched)? sched: []).filter(function (x) { return x && x.date === yStr;});
var place = '';
try {
var cache = lsGet('cike_cache_v1', {});
var txt = '';
Object.keys(cache).forEach(function (k) { if (/::(beside|trip)$/.test(k) && cache[k]) txt += String(cache[k]).slice(0, 80);});
var m = txt.match(/(咖啡馆|咖啡店|书店|花店|公园|车站|电影院|餐厅|图书馆|海边|学校|面包房|便利店|商场|美术馆)/);
if (m) place = m[1];
} catch (e) {}
var doing = todays.length? todays[0].title: (place? ('去' + place): '散步');
var scenes = [
'梦见我们一起' + doing + '，醒来时天刚亮，梦里的光还留在被子上。',
'梦见' + doing + '，你笑起来的样子特别清楚，醒来还记得。',
'做了一个很长的梦，梦里一直在' + doing + '，舍不得醒。'
];
var scene = scenes[Math.floor(Math.random() * scenes.length)];
return { date: dateStr, scene: scene, text: scene + ' 余韵：今天也要像梦里一样，一起好好过。', delivered: false, createdAt: Date.now()};
}
function ensureDream(dateStr) {
var list = dreamsLoad();
var ex = list.find(function (x) { return x.date === dateStr;});
if (ex) return ex;
var d = buildDream(dateStr);
list.push(d);
lsSet(DREAMS_KEY, list);
return d;
}
function deliverDream(nowDate) {
var now = nowDate || new Date();
var h = now.getHours();
if (h < 6 || h > 11) return { ok: false, reason: 'not-morning'};
var ds = dayStr(now);
var d = ensureDream(ds);
if (d.delivered) return { ok: false, reason: 'already-delivered'};
if (window.GroupAZ && !window.GroupAZ.behaviorEnabled('morning')) return { ok: false, reason: 'az_morning_off', dream: d };
var ok = wxPush(charName(), '早安。昨晚我做了一个梦：' + d.text, 'dream');
if (ok) {
d.delivered = true; d.deliveredAt = Date.now();
var list = dreamsLoad();
var i = list.findIndex(function (x) { return x.date === ds;});
if (i >= 0) list[i] = d;
lsSet(DREAMS_KEY, list);
}
return { ok: ok, delivered: ok, dream: d};
}

/* ── 唤醒抽奖：一天一次，四种券都要真的能兑现 ── */
var LOTTERY_KEY = 'wake_lottery_v1';
var LOTTERY_TYPES = {
photo: { label: '照片券', desc: 'char 的示意自拍一张'},
voice: { label: '语音券', desc: 'char 用语音读一句早安给你听'},
chat: { label: '聊天券', desc: 'char 主动给你发一条消息'},
punish: { label: '惩罚券', desc: '记一条待办进日程，char 监督你完成'}
};
function lotteryList() { var a = lsGet(LOTTERY_KEY, []); return Array.isArray(a)? a: [];}
function lotteryToday(nowDate) {
var ds = dayStr(nowDate || new Date());
return lotteryList().find(function (r) { return r.date === ds;}) || null;
}
function lotteryDraw(nowDate) {
var ds = dayStr(nowDate || new Date());
var list = lotteryList();
var ex = list.find(function (r) { return r.date === ds;});
if (ex) return { already: true, rec: ex};
var types = Object.keys(LOTTERY_TYPES);
var type = types[Math.floor(Math.random() * types.length)];
var rec = { date: ds, type: type, redeemed: false, createdAt: Date.now()};
list.push(rec);
lsSet(LOTTERY_KEY, list);
return { already: false, rec: rec};
}
function showPhotoVoucher(name) {
try {
var old = document.getElementById('gm-photo-modal');
if (old) old.remove();
var look = petLook();
var div = document.createElement('div');
div.id = 'gm-photo-modal'; div.className = 'gm-photo-modal';
div.innerHTML = '<div class="gm-photo-card"><div class="gm-photo-scene">' + (look.img? '<img src="' + esc(look.img) + '" alt="char">': petSvg(look.hair, look.eye, false)) + '</div><div class="gm-photo-cap">' + esc(name) + ' 的示意自拍 · 唤醒券兑现</div><div class="gm-photo-sub">早上抽到的照片券，今天也要一起加油。</div><button type="button" class="gm-photo-close">收下</button></div>';
div.querySelector('.gm-photo-close').addEventListener('click', function () { div.remove();});
div.addEventListener('click', function (e) { if (e.target === div) div.remove();});
document.body.appendChild(div);
return true;
} catch (e) { return false;}
}
function lotteryRedeem(nowDate) {
var rec = lotteryToday(nowDate);
if (!rec) return { ok: false, reason: 'not-drawn'};
if (rec.redeemed) return { ok: false, reason: 'already-redeemed'};
var name = charName();
var detail = '';
if (rec.type === 'photo') {
showPhotoVoucher(name);
detail = '已兑现：char 的示意自拍（见弹窗，已存入信件箱）';
try {
var alb = lsGet('cike_album_v1', []);
alb.unshift({ role: name, time: new Date().toLocaleString('zh-CN'), text: '唤醒券兑现：char 的示意自拍。今天也要一起加油。'});
lsSet('cike_album_v1', alb);
} catch (e) {}
} else if (rec.type === 'voice') {
var line = '早安，今天也要一起加油呀。';
try {
if (typeof speechSynthesis!== 'undefined' && speechSynthesis.speak) {
speechSynthesis.speak(new SpeechSynthesisUtterance(line));
detail = '已兑现：语音已播放';
} else { detail = '已兑现：本设备不支持语音播放，已记下这句早安';}
} catch (e) { detail = '已兑现：语音播放失败，已记下这句早安';}
} else if (rec.type === 'chat') {
var ok = wxPush(name, '早安！抽到聊天券的你，今天也要记得想我哦。', 'lottery_chat');
detail = ok? '已兑现：char 已发来一条消息': '已兑现：消息已排队，等微信打开就能看到';
} else if (rec.type === 'punish') {
var sched = lsGet('phone_schedule_v1', []);
sched.push({ id: 'gm_punish_' + Date.now(), title: '惩罚券：' + name + ' 指定的小任务', date: dayStr(), time: '', note: '早上抽到的惩罚券：今天做一件让 char 开心的事（比如发一张照片、说一句晚安）。' /* GROUP-FIX7：日程 app 已删，去掉打勾指引 */, done: false, createdAt: Date.now()});
lsSet('phone_schedule_v1', sched);
detail = '已兑现：已记一条待办进日程';
}
rec.redeemed = true; rec.redeemedAt = Date.now(); rec.detail = detail;
var list = lotteryList();
var i = list.findIndex(function (r) { return r.date === rec.date;});
if (i >= 0) list[i] = rec;
lsSet(LOTTERY_KEY, list);
return { ok: true, rec: rec, detail: detail};
}

/* ── 桌面宠物：QQ 小人住在桌面上 ── */
function petLook() {
var look = { hair: '#3a2a1e', eye: '#2b2b2b'};
try { var v = lsGet('cike_char_look_v1', null); if (v && v.hair) look.hair = v.hair; if (v && v.eye) look.eye = v.eye;} catch (e) {}
var img = '';
try {
var cc = lsGet('otome_custom_char_v1', null);
if (cc) {
var cur = cc.current || cc.active || null;
var arr = cc.list || cc.chars || [];
var it = null;
if (cur) it = arr.find(function (x) { return x && (x.id === cur || x.name === cur);});
if (!it && arr.length) it = arr[0];
if (it && (it.img || it.dataUrl || it.src)) img = it.img || it.dataUrl || it.src;
}
} catch (e) {}
return { hair: look.hair, eye: look.eye, img: img};
}
function petSvg(hair, eye, sleeping) {
var eyes = sleeping
? '<path d="M46 62 q6 5 12 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M74 62 q6 5 12 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
: '<ellipse cx="52" cy="60" rx="5" ry="7" fill="' + eye + '"/><ellipse cx="80" cy="60" rx="5" ry="7" fill="' + eye + '"/><circle cx="54" cy="57" r="1.8" fill="#fff"/><circle cx="82" cy="57" r="1.8" fill="#fff"/>';
return '<svg viewBox="0 0 132 150" xmlns="http://www.w3.org/2000/svg" aria-label="桌面宠物">'
+ '<ellipse cx="66" cy="143" rx="26" ry="5" fill="rgba(0,0,0,0.15)"/>'
+ '<rect x="54" y="118" width="10" height="22" rx="4" fill="#3a3a3a"/><rect x="68" y="118" width="10" height="22" rx="4" fill="#3a3a3a"/>'
+ '<path d="M44 96 Q66 86 88 96 L92 122 Q66 130 40 122 Z" fill="#7aa8c9"/>'
+ '<path d="M44 98 Q34 112 36 124" stroke="#ffe3c4" stroke-width="9" stroke-linecap="round" fill="none"/>'
+ '<path d="M88 98 Q98 112 96 124" stroke="#ffe3c4" stroke-width="9" stroke-linecap="round" fill="none"/>'
+ '<circle cx="66" cy="58" r="34" fill="#ffe3c4"/>'
+ '<path d="M33 60 Q28 18 66 16 Q104 18 99 60 Q94 36 66 34 Q38 36 33 60 Z" fill="' + hair + '"/>'
+ '<path d="M36 54 Q40 32 66 30 Q92 32 96 54 Q90 42 66 40 Q42 42 36 54 Z" fill="' + hair + '" opacity="0.55"/>'
+ eyes
+ '<circle cx="42" cy="72" r="4.5" fill="#ffb3a0" opacity="0.7"/><circle cx="90" cy="72" r="4.5" fill="#ffb3a0" opacity="0.7"/>'
+ '<path d="M60 76 Q66 81 72 76" stroke="#c87a5a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
+ '</svg>';
}
function petEnabled() {
try { var s = lsGet('phone_settings_v3', null); if (s && s.deskPet === false) return false;} catch (e) {}
return true;
}
var petState = { x: 0, sig: '', _bubbleTimer: null};
function petLookSig() {
var l = petLook();
return l.hair + '|' + l.eye + '|' + (l.img? ('img:' + l.img.length + ':' + l.img.slice(0, 24)): 'svg');
}
function petLines() {
var h = new Date().getHours();
var base;
if (h < 6) base = ['嘘……我还在睡觉，轻一点。'];
else if (h < 12) base = ['早上好呀，今天也要一起加油。', '早安！昨晚我梦见你了。'];
else if (h < 18) base = ['今天的风很温柔。', '想去街角那家咖啡馆坐坐。'];
else if (h < 22) base = ['晚上想和你一起散步。', '今天过得怎么样？'];
else base = ['夜深了，早点睡，我守着你。'];
try {
var cache = lsGet('cike_cache_v1', {});
var texts = [];
['beside', 'trip'].forEach(function (k) {
Object.keys(cache).forEach(function (ck) {
if (ck.slice(-(k.length + 2)) === '::' + k && cache[ck]) {
String(cache[ck]).replace(/\u3010/g, '').replace(/\u3011/g, '').split(/[。！？\n]/).map(function (s) { return s.trim();}).filter(function (s) { return s.length >= 4 && s.length <= 28;}).forEach(function (s) { if (texts.length < 3) texts.push(s);});
}
});
});
if (texts.length) base = base.concat(texts);
} catch (e) {}
return base;
}
function petPoke() {
var el = document.getElementById('desk-pet');
if (!el) return false;
var bubble = el.querySelector('#gm-pet-bubble');
var txt = el.querySelector('#gm-pet-bubble-text');
if (!bubble ||!txt) return false;
var lines = petLines();
txt.textContent = lines[Math.floor(Math.random() * lines.length)];
bubble.style.display = 'block';
clearTimeout(petState._bubbleTimer);
petState._bubbleTimer = setTimeout(function () { bubble.style.display = 'none';}, 5000);
try { var d = drivesLoad(); d.mood = clamp(d.mood + 1); d.closeness = clamp(d.closeness + 1); drivesSave(d);} catch (e) {}
return true;
}
function petBuild(nowDate) {
var el = document.getElementById('desk-pet');
if (!el) return false;
if (!petEnabled()) { el.style.display = 'none'; return false;}
el.style.display = '';
var now = nowDate || new Date();
var h = now.getHours();
var sleeping = (h >= 22 || h < 6);
var look = petLook();
el.classList.toggle('gm-sleeping', sleeping);
el.setAttribute('data-phase', phaseForHour(h));
el.innerHTML = '<div class="gm-pet-char" role="button" title="桌面宠物 · 点一点我">' + (look.img? '<img src="' + esc(look.img) + '" alt="char">': petSvg(look.hair, look.eye, sleeping)) + '</div>'
+ '<div class="gm-pet-bubble" id="gm-pet-bubble" style="display:none;"><span id="gm-pet-bubble-text"></span><div class="gm-pet-bubble-btns"><button type="button" id="gm-pet-lottery-btn">抽唤醒券</button><button type="button" id="gm-pet-hide-btn">隐藏宠物</button></div></div>'
+ (sleeping? '<div class="gm-pet-zzz">Z z</div>': '');
petState.sig = phaseForHour(h) + '|' + (sleeping? 'sleep': 'awake') + '|' + petLookSig();
if (!el._gmBound) {
el._gmBound = true;
el.addEventListener('click', function (e) {
var t = e.target;
if (t.closest && t.closest('#gm-pet-hide-btn')) {
try { var s = lsGet('phone_settings_v3', {}) || {}; s.deskPet = false; lsSet('phone_settings_v3', s);} catch (err) {}
el.style.display = 'none';
gmAlert('桌面宠物已隐藏。'); /* R3-STEP6：原提示指向的设置页「桌面宠物」开关已删，恢复入口待定——先不写假路径，见工位报告。 */
return;
}
if (t.closest && t.closest('#gm-pet-lottery-btn')) {
var r = lotteryDraw();
var bubble = el.querySelector('#gm-pet-bubble');
var txt = el.querySelector('#gm-pet-bubble-text');
if (bubble && txt) {
txt.textContent = r.already? ('今天已经抽过「' + LOTTERY_TYPES[r.rec.type].label + '」了，一天一次哦。去此刻的记忆树里兑现它。'): ('抽到「' + LOTTERY_TYPES[r.rec.type].label + '」！' + LOTTERY_TYPES[r.rec.type].desc + '，去此刻的记忆树里点「兑现」。');
bubble.style.display = 'block';
clearTimeout(petState._bubbleTimer);
petState._bubbleTimer = setTimeout(function () { bubble.style.display = 'none';}, 6000);
}
try { memtreeRender();} catch (err) {}
return;
}
petPoke();
});
}
return true;
}
function petTick(nowDate) {
var el = document.getElementById('desk-pet');
if (!el) return;
if (!petEnabled()) { el.style.display = 'none'; return;}
el.style.display = '';
var now = nowDate || new Date();
var h = now.getHours();
var sleeping = (h >= 22 || h < 6);
var sig = phaseForHour(h) + '|' + (sleeping? 'sleep': 'awake') + '|' + petLookSig();
if (petState.sig!== sig ||!el.querySelector('.gm-pet-char')) { petBuild(now); return;}
var charEl = el.querySelector('.gm-pet-char');
if (!charEl) return;
var r = Math.random();
if (r < 0.25) {
charEl.classList.add('gm-blink');
setTimeout(function () { charEl.classList.remove('gm-blink');}, 320);
} else if (r < 0.45) {
charEl.classList.add('gm-sway');
setTimeout(function () { charEl.classList.remove('gm-sway');}, 900);
} else if (r < 0.60 &&!sleeping) {
petState.x = Math.max(-26, Math.min(26, petState.x + (Math.random() < 0.5? -14: 14)));
charEl.style.transform = 'translateX(' + petState.x + 'px)';
}
}

/* ── 记忆树：每天的记忆挂成摇曳木牌，珍贵的日子可封印（可逆） ── */
var SEALED_KEY = 'sealed_days_v1';
function memtreeDays() {
var map = {};
var add = function (dateKey, title, text, source) {
if (!dateKey) return;
if (!map[dateKey]) map[dateKey] = [];
map[dateKey].push({ title: title, text: text, source: source});
};
var mems = lsGet('guichao.memories.v1', []);
(Array.isArray(mems)? mems: []).forEach(function (m) {
var ts = (typeof m.updated === 'number')? m.updated: (typeof m.id === 'number'? m.id: 0);
var d = ts? new Date(ts): null;
add(d? dayStr(d): '', m.title || '记忆', m.content || '', '归巢·' + (m.category || '记忆'));
});
var meta = lsGet('ck_diary_meta_v1', {});
var cache = lsGet('cike_cache_v1', {});
Object.keys(meta || {}).forEach(function (k) {
if (!/::beside$/.test(k)) return;
var dm = meta[k];
var dateStr = dm && dm.date;
var key = '';
if (dateStr) {
var mm = String(dateStr).match(/(\d+)月(\d+)日/);
if (mm) key = new Date().getFullYear() + '-' + pad2(+mm[1]) + '-' + pad2(+mm[2]);
}
if (key) add(key, '日记', String(cache[k] || '').slice(0, 40), '此刻·日记');
});
dreamsLoad().forEach(function (dr) { add(dr.date, '梦境', dr.scene || dr.text || '', '梦境');});
var sealed = lsGet(SEALED_KEY, {});
var days = Object.keys(map).map(function (k) { return { date: k, items: map[k], sealed:!!sealed[k]};});
days.sort(function (a, b) { return a.date < b.date? -1: 1;});
return days.slice(-30);
}
/* 记忆树上方的画出来的月树（2026-11-27 第二轮）：复用归巢 sealed-days 月树挂木牌的做法，
   全部代码画 SVG 矩形像素画：树干 + 枝 + 树冠，木牌按天挂在枝上（最多 8 块，封印的变金色）；
   木牌列表仍在树下列出，封印/解封逻辑不动。无记忆时也画一棵空树，不编假木牌。 */
function memtreeTreeSVG(days) {
var canopy = '<rect x="110" y="18" width="100" height="26" fill="#5b8c5a"/><rect x="90" y="34" width="140" height="22" fill="#6a9a5a"/><rect x="130" y="6" width="60" height="16" fill="#6a9a5a"/>'
+ '<rect x="120" y="24" width="10" height="8" fill="#4e7a4e"/><rect x="180" y="40" width="10" height="8" fill="#4e7a4e"/><rect x="150" y="12" width="8" height="6" fill="#4e7a4e"/>';
var trunk = '<g class="gm-mt-trunk"><rect x="152" y="70" width="16" height="68" fill="#7a4a28"/><rect x="120" y="60" width="36" height="6" fill="#7a4a28"/><rect x="164" y="52" width="40" height="6" fill="#7a4a28"/><rect x="140" y="44" width="16" height="8" fill="#6b4226"/><rect x="168" y="40" width="14" height="8" fill="#6b4226"/></g>';
var hangs = '';
(days || []).slice(0, 8).forEach(function (d, i) {
var x = 96 + i * 16; /* 木牌横向只排在树冠正下方（树冠 x 90–230）：旧式 24 + i*34 会把前两块挂到树左边的半空，吊绳顶端 y=56 悬空无枝可连；新式 16px 步进、两行错开（同行间距 32px、牌宽 30px），每根吊绳顶端都落在树冠底边上 */
var y = 78 + (i % 2) * 20; /* 两行行距 20px：牌高 18px，旧行距 12px 时上下两排斜对角重叠 14×6px（复查见 11-26/11-27 两牌略有重叠）；20px 后两排之间留 2px 缝，不再重叠；吊绳仍从 y=50 树冠底带垂下 */
var col = d.sealed? '#d8a93c': '#caa06e';
var label = String(d.date || '').slice(5) || String(d.date || '');
hangs += '<g class="gm-mt-hang" data-gm-date="' + esc(d.date) + '"><rect x="' + (x + 14) + '" y="50" width="2" height="' + (y - 50) + '" fill="#7a4a28"/><rect x="' + x + '" y="' + y + '" width="30" height="18" fill="' + col + '"/><text x="' + (x + 15) + '" y="' + (y + 12) + '" font-size="8" fill="#fff8ea" text-anchor="middle">' + esc(label) + '</text></g>'; /* 吊绳顶端 y=50：伸进树冠底带（y 34–56）6px 重叠，不再是 y=56 边缘相接——边缘相接在小屏上看着像悬空；重叠 6px 后肉眼一看就是系在树冠上 */
});
return '<div class="gm-mt-tree-svg"><svg class="gm-mt-tree-draw" viewBox="0 0 320 148" shape-rendering="crispEdges" aria-label="记忆树">'
+ '<rect x="0" y="138" width="320" height="10" fill="#8a5a2e"/>'
+ canopy + trunk + hangs + '</svg></div>';
}
function memtreeRender() {
var root = document.getElementById('ck-memtree-root');
if (!root) return false;
var days = memtreeDays();
var lot = lotteryToday();
var lotHtml = lot
? '<div class="gm-mt-lot">今日唤醒券：' + esc(LOTTERY_TYPES[lot.type].label) + ' · ' + esc(LOTTERY_TYPES[lot.type].desc) + ' — ' + (lot.redeemed? '已兑现': '<button type="button" data-gm-act="lottery-redeem">兑现</button>') + '</div>'
: '<div class="gm-mt-lot">还没有抽今天的唤醒券 <button type="button" data-gm-act="lottery-draw">抽一张</button></div>';
var planks = days.length? days.map(function (d) {
return '<div class="gm-plank' + (d.sealed? ' gm-sealed': '') + '" data-gm-date="' + esc(d.date) + '" role="button" title="' + (d.sealed? '已封印 · 点一下解封': '点一下封印这一天') + '">'
+ '<div class="gm-plank-date">' + esc(d.date) + '</div>'
+ '<div class="gm-plank-title">' + esc(d.items[0].title) + '</div>'
+ '<div class="gm-plank-meta">' + esc(d.items[0].source) + (d.items.length > 1? ' · 等' + d.items.length + '条': '') + '</div>'
+ '<div class="gm-plank-seal">' + (d.sealed? '已封印': '') + '</div></div>';
}).join(''): '<div class="gm-mt-empty">还没有记忆。去归巢记一条，或在此时写一篇日记，木牌就会挂上来。</div>';
/* 2026-11-27 Hub：花园已拆去自己的 #ck-garden-root 页，不再拼进记忆树。 */
var _fix6Html = '<div class="gm-mt-head"><span>记忆树</span><span class="gm-mt-sub">每天的记忆挂成木牌 · 点一下封印 / 解封</span></div>' + lotHtml + memtreeTreeSVG(days) + '<div class="gm-mt-tree">' + planks + '</div>';
  /* GROUP-FIX6 · FIX6-1 记忆树去重写：内容与上次写入完全相同就不写 innerHTML。
     根因：gmInit 的 body/subtree observer 回调 memtreeRender()，无条件写
     innerHTML 又触发 observer，无限微任务乒乓饿死定时器（开此刻后 10 秒
     #ck-memtree-root 重写 3259 次、observer 回调 58726 次、定时器冻结）。
     html 完全由数据决定（天数/唤醒券，无时钟），数据不变恒命中；封印、
     抽券、兑现、新记忆改变 html 时照常重写。缓存用写入的字符串本身比对，
     不读 innerHTML 序列化，避免序列化差异导致永不命中。 */
  if (root.__fix6LastHtml === _fix6Html) return true;
  root.innerHTML = _fix6Html;
  root.__fix6LastHtml = _fix6Html;
return true;
}
function memtreeToggleSeal(dateKey) {
var s = lsGet(SEALED_KEY, {});
if (s[dateKey]) delete s[dateKey]; else s[dateKey] = true;
lsSet(SEALED_KEY, s);
memtreeRender();
return!!s[dateKey];
}
function onDocClick(e) {
try {
var lotBtn = e.target.closest? e.target.closest('[data-gm-act]'): null;
if (lotBtn) {
var act = lotBtn.getAttribute('data-gm-act');
if (act === 'lottery-draw') {
var r = lotteryDraw();
gmAlert(r.already? ('今天已经抽过「' + LOTTERY_TYPES[r.rec.type].label + '」了，一天一次哦。'): ('抽到「' + LOTTERY_TYPES[r.rec.type].label + '」！' + LOTTERY_TYPES[r.rec.type].desc + '，点「兑现」就能拿到。'));
memtreeRender();
return;
}
if (act === 'lottery-redeem') {
var rr = lotteryRedeem();
gmAlert(rr.ok? ('已兑现：' + rr.detail): ('兑现失败：' + (rr.reason || '')));
memtreeRender();
return;
}
}
var plank = e.target.closest? e.target.closest('.gm-plank'): null;
if (plank) {
var dk = plank.getAttribute('data-gm-date');
var sealed = memtreeToggleSeal(dk);
gmAlert(sealed? ('已封印 ' + dk + '，木牌变成金色了。'): ('已解封 ' + dk + '。'));
return;
}
} catch (err) {}
}

var GM = {
version: 'GroupM-v1',
charName: charName,
wxPush: wxPush,
phaseForHour: phaseForHour,
drives: {
load: drivesLoad, save: drivesSave, drift: drivesDrift, check: drivesCheck,
set: function (patch) { var d = drivesLoad(); Object.keys(patch || {}).forEach(function (k) { if (typeof patch[k] === 'number') d[k] = clamp(patch[k]);}); drivesSave(d); return d;}
},
dreams: { load: dreamsLoad, ensure: ensureDream, build: buildDream, deliver: deliverDream},
lottery: {
types: LOTTERY_TYPES, draw: lotteryDraw, redeem: lotteryRedeem, today: lotteryToday,
forceDraw: function (type) {
var ds = dayStr();
var list = lotteryList().filter(function (r) { return r.date!== ds;});
var rec = { date: ds, type: type, redeemed: false, createdAt: Date.now()};
list.push(rec);
lsSet(LOTTERY_KEY, list);
return rec;
}
},
pet: {
el: function () { return document.getElementById('desk-pet');},
phaseForHour: phaseForHour, poke: petPoke, tick: petTick, build: petBuild, enabled: petEnabled,
setEnabled: function (v) { try { var s = lsGet('phone_settings_v3', {}) || {}; s.deskPet =!!v; lsSet('phone_settings_v3', s);} catch (e) {} if (v) petBuild(); else { var el = document.getElementById('desk-pet'); if (el) el.style.display = 'none';} return petEnabled();}
},
memtree: { render: memtreeRender, days: memtreeDays, toggleSeal: memtreeToggleSeal, sealed: function () { return lsGet(SEALED_KEY, {});}}
};

var _gmInitDone = false;
function gmInit() {
if (_gmInitDone) return;
_gmInitDone = true;
try { drivesDrift(Date.now());} catch (e) {}
try { petBuild();} catch (e) {}
try {
if (typeof MutationObserver!== 'undefined' && document.body) {
var ob = new MutationObserver(function () { try { memtreeRender();} catch (e) {}});
ob.observe(document.body, { childList: true, subtree: true});
}
} catch (e) {}
try { deliverDream(new Date());} catch (e) {}
try { document.addEventListener('click', onDocClick);} catch (e) {}
setInterval(function () {
try { drivesDrift(Date.now());} catch (e) {}
try { drivesCheck(Date.now());} catch (e) {}
try { deliverDream(new Date());} catch (e) {}
try { petTick();} catch (e) {}
}, 60000);
setInterval(function () { try { petTick();} catch (e) {}}, 5000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gmInit);
else gmInit();
window.GroupM = GM;
})();

