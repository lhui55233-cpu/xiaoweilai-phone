
/* GROUP-BE · 查手机翻盖机（自写）：锁屏 / 被发现判定 / 内里短信与新闻只读数据 / 外观设置。
只借翻盖机形态与结构，不复制参考截图里的剪影/Q 版小人形象、原壁纸图案、水印与帖子文案。
锁屏小人是手机自己的 QQ 风 char 形象（自绘 SVG，发色瞳色读 cike_char_look_v1）。 */
(function () {
'use strict';
if (window.FlipPhone) return;
var MARK = 'GROUP-BE';
var KEY = 'cike_flipphone_v1';
var CACHE_KEY = 'cike_cache_v1';
var AFF_KEY = 'otome_affection_v1';
var LOOK_KEY = 'cike_char_look_v1';
var FRAMES = [
{ id: 'gold', name: '金色', c: '#c9a24b'},
{ id: 'pink', name: '粉色', c: '#e8a0b0'},
{ id: 'black', name: '黑色', c: '#2b2b2e'},
{ id: 'white', name: '白色', c: '#f2f2f0'},
{ id: 'blue', name: '蓝色', c: '#7aa8c9'},
{ id: 'green', name: '墨绿', c: '#7d9b8a'}
];
var WALLPAPERS = [
{ id: 'mist', name: '晨雾白', css: 'linear-gradient(160deg,#fdfbf7 0%,#f3ede4 55%,#e8dfd2 100%)'},
{ id: 'sea', name: '浅海蓝', css: 'linear-gradient(160deg,#dceef5 0%,#bcd9e8 55%,#9cc3d8 100%)'},
{ id: 'dusk', name: '暮山紫', css: 'linear-gradient(160deg,#e9e2f2 0%,#cfc2e2 55%,#b3a1cf 100%)'},
{ id: 'sand', name: '暖沙', css: 'linear-gradient(160deg,#f7ead2 0%,#eed9b4 55%,#dfc193 100%)'},
{ id: 'forest', name: '墨绿', css: 'linear-gradient(160deg,#dce8dd 0%,#b9cfbc 55%,#93b39a 100%)'}
];
/* 被发现概率是翻盖机自己的规则表（写在界面上，不冒充模拟人生的实测数字）：
在家 高 40% / 不知道在哪 中 20% / 出门在外 低 8% / 深夜或旅行 低 5%。 */
var RISK_TABLE = { home: 0.4, unknown: 0.2, out: 0.08, night: 0.05, travel: 0.05};
var testRand = null;

var esc = function (s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');};
var rd = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined)? dflt: v;} catch (e) { return dflt;}};
var pad2 = function (n) { return (n < 10? '0': '') + n;};
var fmtDate = function (d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());};
var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function loadPrefs() {
var p = rd(KEY, null);
var out = { wallpaper: 'mist', customWallpaper: '', frame: 'gold', events: []};
if (p && typeof p === 'object') {
if (typeof p.wallpaper === 'string') out.wallpaper = p.wallpaper;
if (typeof p.customWallpaper === 'string') out.customWallpaper = p.customWallpaper;
if (typeof p.frame === 'string') out.frame = p.frame;
if (Array.isArray(p.events)) out.events = p.events;
}
if (!FRAMES.some(function (f) { return f.id === out.frame;})) out.frame = 'gold';
if (out.wallpaper!== 'phone' && out.wallpaper!== 'custom' &&!WALLPAPERS.some(function (w) { return w.id === out.wallpaper;})) out.wallpaper = 'mist';
return out;
}
function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true;} catch (e) { return false;}}
function frameById(id) { for (var i = 0; i < FRAMES.length; i++) if (FRAMES[i].id === id) return FRAMES[i]; return FRAMES[0];}
function wpById(id) { for (var i = 0; i < WALLPAPERS.length; i++) if (WALLPAPERS[i].id === id) return WALLPAPERS[i]; return WALLPAPERS[0];}
function phoneWallpaperCss() {
try {
if (typeof SystemStore!== 'undefined') {
var wp = SystemStore.get('wallpaper') || '';
if (wp) {
if (wp.indexOf('data:') === 0 || wp.indexOf('http') === 0) return 'url("' + wp + '") center/cover no-repeat';
return wp;
}
}
} catch (e) {}
return '';
}
function wallpaperCss(prefs) {
prefs = prefs || loadPrefs();
if (prefs.wallpaper === 'custom' && prefs.customWallpaper) return 'url("' + prefs.customWallpaper + '") center/cover no-repeat';
if (prefs.wallpaper === 'phone') { var pw = phoneWallpaperCss(); if (pw) return pw;}
return wpById(prefs.wallpaper).css;
}
function charLook() {
var look = { hair: '#3a2a1e', eye: '#2b2b2b'};
try { var v = rd(LOOK_KEY, null); if (v) { if (v.hair) look.hair = v.hair; if (v.eye) look.eye = v.eye;}} catch (e) {}
return look;
}
function batteryPct() {
var b = 40;
try { var v = parseInt(localStorage.getItem('phone_battery_pct') || '40', 10); if (!isNaN(v)) b = Math.max(0, Math.min(100, v));} catch (e) {}
return b;
}
function resolveName(passed) {
if (passed) return passed;
try { if (typeof SystemStore!== 'undefined') { var c = SystemStore.get('character'); if (c) return c;}} catch (e) {}
return '';
}
function bubbleText() {
try { if (window.AWGroup && AWGroup.murmurNow) { var m = AWGroup.murmurNow(); if (m && m.text) return { text: String(m.text), src: 'murmur'};}} catch (e) {}
try { if (window.AWGroup && AWGroup.phoneNow) { var pn = AWGroup.phoneNow(); if (pn) return { text: String(pn), src: 'phone'};}} catch (e) {}
try { if (window.AWGroup && AWGroup.currentActivity) { var c = AWGroup.currentActivity(); if (c && c.place) return { text: '在' + c.place + '，' + (c.activity || ''), src: 'activity'};}} catch (e) {}
return { text: '', src: 'none'};
}

/* ── 被发现风险：只由模拟人生的真实状态算（地点 / 时间 / 是否在旅行）── */
function liveState(nowMs) {
var d = new Date(nowMs || Date.now());
var out = { place: '', hour: d.getHours(), traveling: false};
try { if (window.AWGroup && AWGroup.currentActivity) { var c = AWGroup.currentActivity(nowMs); if (c && c.place) out.place = c.place;}} catch (e) {}
try {
if (window.AWGroup && AWGroup.listTravel) {
var trips = AWGroup.listTravel() || [];
for (var i = 0; i < trips.length; i++) if (trips[i] && trips[i].status === 'active') { out.traveling = true; break;}
}
} catch (e) {}
return out;
}
function assessRisk(nowMs, override) {
var s = liveState(nowMs);
if (override && typeof override === 'object') {
if (typeof override.place === 'string') s.place = override.place;
if (typeof override.hour === 'number') s.hour = override.hour;
if (typeof override.traveling === 'boolean') s.traveling = override.traveling;
}
var home = /家|家里|卧室|客厅|厨房|阳台|书房/.test(s.place || '');
var night = s.hour >= 23 || s.hour < 6;
var r;
if (s.traveling) r = { level: '低', probability: RISK_TABLE.travel, reasons: ['他正在外旅行，不在家']};
else if (night) r = { level: '低', probability: RISK_TABLE.night, reasons: ['深夜，他已经睡了']};
else if (home) r = { level: '高', probability: RISK_TABLE.home, reasons: ['他现在在家，抬头就能看见你']};
else if (s.place) r = { level: '低', probability: RISK_TABLE.out, reasons: ['他现在出门在外（' + s.place + '）']};
else r = { level: '中', probability: RISK_TABLE.unknown, reasons: ['不知道他现在在哪']};
r.place = s.place || ''; r.hour = s.hour; r.traveling =!!s.traveling;
return r;
}
function cryptoRand() {
var c = null;
try { if (typeof window!== 'undefined' && window.crypto && window.crypto.getRandomValues) c = window.crypto;} catch (e) {}
if (!c) { try { if (typeof globalThis!== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) c = globalThis.crypto;} catch (e) {}}
if (!c ||!c.getRandomValues) throw new Error('无可用的安全随机数来源（crypto.getRandomValues）');
var a = new Uint32Array(1); c.getRandomValues(a);
return a[0] / 4294967296;
}
function roll(probability, randFn) {
var r;
if (typeof randFn === 'function') r = randFn();
else if (typeof testRand === 'function') r = testRand();
else r = cryptoRand();
return r < probability;
}
function affectionValue(name) {
try { if (window.OtomeF && OtomeF.loadAff) { var rec = OtomeF.loadAff(name); if (rec && typeof rec.value === 'number') return rec.value;}} catch (e) {}
try { var all = rd(AFF_KEY, {}); var r2 = all && all[name]; if (r2 && typeof r2.value === 'number') return r2.value;} catch (e) {}
return 0;
}
function tierOf(v) { return v >= 85? '恋人': v >= 60? '暧昧': v >= 30? '朋友': '相识';}
function sendWeChat(name, text) {
var store = null;
try { if (typeof AppRegistry!== 'undefined' && AppRegistry['wechat']) store = AppRegistry['wechat'].wxStore;} catch (e) {}
if (!store ||!Array.isArray(store.sessions)) return false;
var sess = null;
store.sessions.forEach(function (s) { if (!sess && s && s.name === name &&!s.isGroup) sess = s;});
if (!sess) {
sess = { id: 'chat_' + Date.now(), name: name, avatar: '', isGroup: false, isPinned: false, unread: 0, heartsVoice: '', emotionState: '平静', chatBg: '', lastTime: '刚刚', preview: '', memory: [], events: [], messages: []};
store.sessions.push(sess);
}
if (!Array.isArray(sess.messages)) sess.messages = [];
sess.messages.push({ id: 'm_be_' + Date.now(), sender: name, type: 'text', content: text, time: '刚刚'});
sess.preview = String(text).slice(0, 40); sess.lastTime = '刚刚'; sess.unread = (sess.unread || 0) + 1;
try { if (typeof store._persist === 'function') store._persist();} catch (e) {}
try { if (window.WeChatAppEngine && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates();} catch (e) {}
return true;
}
function handleCaught(name, risk) {
var affBefore = name? affectionValue(name): 0;
var funny = affBefore >= 85;
var msg;
if (affBefore >= 85) msg = '好啦好啦，是我抓到你了才对。你想看就直说嘛，我的手机又没藏什么不能看的。下次别偷偷翻了，我直接给你看。';
else if (affBefore >= 60) msg = '……你刚才是不是在翻我手机？哼，胆子不小嘛。看在你这么好奇的份上，这次就算了——仅此一次哦。';
else if (affBefore >= 30) msg = '喂——你翻我手机干什么！里面都是我的东西！……算了，下次先问我一声。';
else msg = '你动我手机了？……别乱碰我的东西。';
var affAfter = affBefore;
if (!funny && name) {
try {
if (window.OtomeF && OtomeF.addAff) OtomeF.addAff(name, -2, '翻手机被抓到');
else { var all = rd(AFF_KEY, {}); var rec = all[name] || { value: 0, gifts: [], events: [], rewards: [], impressions: []}; rec.value = Math.max(0, (rec.value || 0) - 2); all[name] = rec; try { localStorage.setItem(AFF_KEY, JSON.stringify(all));} catch (e) {}}
affAfter = affectionValue(name);
} catch (e) {}
}
var sent = false;
if (name) { try { sent = sendWeChat(name, msg);} catch (e) { sent = false;}}
var ev = { id: 'be_' + Date.now().toString(36), ts: Date.now(), kind: 'caught', risk: risk.level, probability: risk.probability, place: risk.place || '', hour: risk.hour, affBefore: affBefore, affAfter: affAfter, funny: funny, sent: sent};
try { var p = loadPrefs(); p.events.unshift(ev); p.events = p.events.slice(0, 50); savePrefs(p);} catch (e) {}
return { affBefore: affBefore, affAfter: affAfter, delta: funny? 0: -2, funny: funny, msg: msg, sent: sent, event: ev};
}

/* ── QQ 风 char 小人（自绘 SVG；发色瞳色读 cike_char_look_v1）── */
function qqFigure(hair, eye) {
return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="char">'
+ '<ellipse cx="50" cy="114" rx="20" ry="4" fill="rgba(0,0,0,0.12)"/>'
+ '<rect x="41" y="92" width="8" height="18" rx="4" fill="#3a3a3a"/><rect x="51" y="92" width="8" height="18" rx="4" fill="#3a3a3a"/>'
+ '<path d="M36 78 Q50 70 64 78 L67 96 Q50 102 33 96 Z" fill="#7aa8c9"/>'
+ '<circle cx="50" cy="46" r="26" fill="#ffe3c4"/>'
+ '<path d="M26 46 Q22 16 50 14 Q78 16 74 46 Q70 30 50 28 Q30 30 26 46 Z" fill="' + esc(hair) + '"/>'
+ '<ellipse cx="39" cy="56" rx="4" ry="5.5" fill="' + esc(eye) + '"/><ellipse cx="61" cy="56" rx="4" ry="5.5" fill="' + esc(eye) + '"/>'
+ '<circle cx="41" cy="53.5" r="1.5" fill="#fff"/><circle cx="63" cy="53.5" r="1.5" fill="#fff"/>'
+ '<circle cx="32" cy="65" r="3.2" fill="#ffb3a0" opacity="0.7"/><circle cx="68" cy="65" r="3.2" fill="#ffb3a0" opacity="0.7"/>'
+ '<path d="M46 67 Q50 70 54 67" stroke="#c87a5a" stroke-width="2" fill="none" stroke-linecap="round"/>'
+ '</svg>';
}

function hideSubBack() { try { var b = document.querySelector('#ck-sub-back'); if (b) b.style.display = 'none'; } catch (e) {} }
function restoreSubBack() { try { var b = document.querySelector('#ck-sub-back'); if (b) b.style.display = ''; } catch (e) {} }
function clickSubBack() { restoreSubBack(); try { var b = document.querySelector('#ck-sub-back'); if (b) b.click(); } catch (e) {} }

function lockHtml(prefs, name, risk, bub, batt) {
  var now = new Date();
  var dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEK_CN[now.getDay()];
  var timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  var look = charLook();
  var riskCls = risk.level === '高' ? 'be-risk-high' : risk.level === '中' ? 'be-risk-mid' : 'be-risk-low';
  var bubbleSrc = bub.src === 'murmur' ? '他刚才的碎碎念' : bub.src === 'phone' ? '模拟人生推测：他此刻手机上的状态' : bub.src === 'activity' ? '模拟人生推测：他此刻在干什么' : '';
  var bubble = bub.text
    ? '<div class="be-flip-bubble">' + esc(bub.text) + (bubbleSrc ? '<div class="be-flip-bubble-src">' + esc(bubbleSrc) + '</div>' : '') + '</div>'
    : '<div class="be-flip-bubble">他现在不知道在干嘛，手机安安静静的。<div class="be-flip-bubble-src">模拟人生里还没有他的实时状态</div></div>';
  return '<div class="be-flip" data-be-frame="' + esc(prefs.frame) + '" data-be-risk-level="' + esc(risk.level) + '">'
    + '<div class="be-flip-cover">FLIP · ' + esc(name || '他') + '的手机</div>'
    + '<div class="be-flip-wallpaper" style="background:' + esc(wallpaperCss(prefs)) + '">'
    + '<div class="be-flip-top"><span class="be-flip-date">' + esc(dateStr) + '</span><span class="be-flip-batt">电量 ' + batt + '%</span></div>'
    + '<div class="be-flip-clock">' + esc(timeStr) + '</div>'
    + '<div class="be-flip-char">' + qqFigure(look.hair, look.eye) + '</div>'
    + bubble
    + '</div>'
    + '<div class="be-flip-risk">被发现风险：<b class="' + riskCls + '">' + esc(risk.level) + ' · 约 ' + Math.round(risk.probability * 100) + '%</b><br>' + risk.reasons.map(function (x) { return esc(x); }).join('；')
    + '<div class="be-flip-risk-note">概率按翻盖机自己的规则估算（在家高 / 出门低 / 深夜低），不是模拟人生的实测数字。</div></div>'
    + '<div class="be-flip-keys"><button type="button" data-be-key="back">戻る</button><button type="button" data-be-key="menu">MENU</button><button type="button" data-be-key="ok">決定</button></div>'
    + '<button type="button" class="be-flip-gear" data-be-key="settings"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></g></svg> 外观设置 · 长按外壳也可以打开</button>'
    + '</div>';
}

function attemptUnlock(area, name) {
  if (!area || area._beBusy) return;
  area._beBusy = true;
  var risk = assessRisk();
  var caught;
  try { caught = roll(risk.probability); }
  catch (e) {
    area._beBusy = false;
    var note = area.querySelector('.be-flip-risk-note');
    if (note) note.textContent = '这次没法判定：' + (e && e.message ? e.message : '随机数不可用') + '。请稍后再试。';
    return;
  }
  if (caught) {
    var res = handleCaught(name, risk);
    renderCaught(area, name, risk, res);
    area._beBusy = false;
    return;
  }
  var shell = area.querySelector('.be-flip');
  if (shell) shell.classList.add('be-opening');
  setTimeout(function () {
    area._beBusy = false;
    area._beFlipPassed = true;
    restoreSubBack();
    var cb = area._beUnlockCb;
    if (typeof cb === 'function') cb();
  }, 400);
}

function renderCaught(area, name, risk, res) {
  hideSubBack();
  var look = charLook();
  var affLine = res.funny
    ? '他反而把手机递给了你，好感不变。'
    : '好感 -2（' + res.affBefore + ' → ' + res.affAfter + '）。';
  area.innerHTML = '<div class="be-caught" data-be-caught="1">'
    + '<div class="be-caught-char">' + qqFigure(look.hair, look.eye) + '</div>'
    + '<div class="be-caught-title">被抓到了！</div>'
    + '<div class="be-caught-text">' + esc(name || '他') + '正好回头，看见你拿着他的手机。<br>这件事已经记进了事件流。</div>'
    + '<div class="be-caught-msg">他在微信里说：「' + esc(res.msg) + '」' + (res.sent ? '' : '<br><span style="color:#a08a7a;font-size:12px;">（微信没打开，这句话没能发出去，事件已记录。）</span>') + '</div>'
    + '<div class="be-caught-aff">' + esc(affLine) + '</div>'
    + '<button type="button" class="be-caught-back" data-be-key="caught-back" aria-label="回到此刻">‹</button>'
    + '</div>';
  var back = area.querySelector('[data-be-key="caught-back"]');
  if (back) back.addEventListener('click', function () { clickSubBack(); });
}

function openLock(area, charName, onUnlock) {
  if (!area) return false;
  if (typeof onUnlock === 'function') area._beUnlockCb = onUnlock;
  var name = resolveName(charName);
  var prefs = loadPrefs();
  var risk = assessRisk();
  var bub = bubbleText();
  hideSubBack();
  area.innerHTML = lockHtml(prefs, name, risk, bub, batteryPct());
  var shell = area.querySelector('.be-flip');
  var bindKey = function (key, fn) { var b = area.querySelector('[data-be-key="' + key + '"]'); if (b) b.addEventListener('click', fn); };
  bindKey('back', function () { clickSubBack(); });
  bindKey('menu', function () { attemptUnlock(area, name); });
  bindKey('ok', function () { attemptUnlock(area, name); });
  bindKey('settings', function () { openSettings(area, name); });
  if (shell) {
    var lpTimer = null;
    shell.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-be-key]')) return;
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = setTimeout(function () { openSettings(area, name); }, 600);
    });
    shell.addEventListener('pointerup', function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });
    shell.addEventListener('pointerleave', function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });
  }
  return true;
}

function settingsHtml(prefs) {
  var wpBtns = WALLPAPERS.map(function (w) {
    return '<button type="button" class="be-wp-btn' + (prefs.wallpaper === w.id ? ' on' : '') + '" data-be-wp="' + w.id + '" style="background:' + esc(w.css) + '">' + esc(w.name) + '</button>';
  }).join('');
  wpBtns += '<button type="button" class="be-wp-btn' + (prefs.wallpaper === 'phone' ? ' on' : '') + '" data-be-wp="phone">当前手机壁纸</button>';
  wpBtns += '<button type="button" class="be-wp-btn' + (prefs.wallpaper === 'custom' ? ' on' : '') + '" data-be-wp="custom">' + (prefs.customWallpaper ? '已上传的图片' : '上传图片（未选）') + '</button>';
  var frBtns = FRAMES.map(function (f) {
    return '<button type="button" class="be-sw' + (prefs.frame === f.id ? ' on' : '') + '" data-be-frame-btn="' + f.id + '" style="background:' + f.c + '" title="' + esc(f.name) + '" aria-label="外框' + esc(f.name) + '"></button>';
  }).join('');
  var hist = '';
  if (!prefs.events.length) hist = '<div class="be-history-empty">还没有被抓到过。</div>';
  else hist = prefs.events.slice(0, 5).map(function (ev) {
    return '<div>· ' + esc(fmtDate(new Date(ev.ts || Date.now()))) + ' 被抓到（风险' + esc(ev.risk || '') + '，好感 ' + ev.affBefore + ' → ' + ev.affAfter + (ev.funny ? '，他把手机递了过来' : '') + '）</div>';
  }).join('');
  return '<div class="be-settings">'
    + '<button type="button" class="be-set-back" data-be-key="set-back" aria-label="返回锁屏">‹</button>'
    + '<h3>翻盖机外观</h3>'
    + '<div class="be-mini-preview" style="background:' + esc(wallpaperCss(prefs)) + '"><span>壁纸预览</span><span style="background:' + frameById(prefs.frame).c + ';color:#fff;border-radius:10px;padding:2px 8px;">外框 · ' + esc(frameById(prefs.frame).name) + '</span></div>'
    + '<div class="be-set-sec">壁纸</div>'
    + '<div class="be-wp-list">' + wpBtns + '</div>'
    + '<label style="display:block;margin-top:10px;font-size:12px;color:#5a4632;">上传图片作壁纸 <input type="file" accept="image/*" data-be-upload style="display:block;margin-top:6px;"></label>'
    + '<div class="be-set-err" data-be-err></div>'
    + '<div class="be-set-sec">外框颜色</div>'
    + '<div class="be-frame-list">' + frBtns + '</div>'
    + '<div class="be-set-sec">最近被抓记录</div>'
    + '<div class="be-history">' + hist + '</div>'
    + '<button type="button" class="be-wp-btn" data-be-key="set-reset" style="margin-top:14px;">恢复默认外观</button>'
    + '<div class="be-set-note">壁纸与外框颜色存在 cike_flipphone_v1，随整屋备份走。上传的图片只存本机。</div>'
    + '</div>';
}

function openSettings(area, charName) {
  if (!area) return false;
  var name = resolveName(charName);
  var render = function () {
    var prefs = loadPrefs();
    area.innerHTML = settingsHtml(prefs);
    var back = area.querySelector('[data-be-key="set-back"]');
    if (back) back.addEventListener('click', function () { openLock(area, name, area._beUnlockCb); });
    area.querySelectorAll('[data-be-wp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-be-wp');
        if (id === 'custom' && !loadPrefs().customWallpaper) {
          var err = area.querySelector('[data-be-err]');
          if (err) err.textContent = '先点下面的「上传图片作壁纸」选一张图。';
          return;
        }
        setWallpaper(id); render();
      });
    });
    area.querySelectorAll('[data-be-frame-btn]').forEach(function (b) {
      b.addEventListener('click', function () { setFrame(b.getAttribute('data-be-frame-btn')); render(); });
    });
    var up = area.querySelector('[data-be-upload]');
    if (up) up.addEventListener('change', function () {
      var f = up.files && up.files[0];
      if (!f) return;
      var err = area.querySelector('[data-be-err]');
      var rd2 = new FileReader();
      rd2.onload = function () {
        var r = setWallpaper('custom', String(rd2.result || ''));
        if (!r.ok) { if (err) err.textContent = r.reason === 'too-big' ? '图片太大了（超过约 1.5MB），换一张小一点的。' : '这张图读不出来，换一张图片试试。'; return; }
        render();
      };
      rd2.onerror = function () { if (err) err.textContent = '图片读取失败，换一张试试。'; };
      rd2.readAsDataURL(f);
    });
    var reset = area.querySelector('[data-be-key="set-reset"]');
    if (reset) reset.addEventListener('click', function () { resetAppearance(); render(); });
  };
  render();
  return true;
}

function applyPrefsToDocument() {
  try {
    var prefs = loadPrefs();
    var shell = document.querySelector('.be-flip');
    if (shell) {
      shell.setAttribute('data-be-frame', prefs.frame);
      var wp = shell.querySelector('.be-flip-wallpaper');
      if (wp) wp.style.background = wallpaperCss(prefs);
    }
  } catch (e) {}
}
function setWallpaper(id, customDataUrl) {
  if (id === 'custom') {
    if (!customDataUrl || customDataUrl.indexOf('data:image/') !== 0) return { ok: false, reason: 'not-image' };
    if (customDataUrl.length > 1500000) return { ok: false, reason: 'too-big' };
    var p = loadPrefs(); p.wallpaper = 'custom'; p.customWallpaper = customDataUrl; savePrefs(p); applyPrefsToDocument(); return { ok: true };
  }
  if (id !== 'phone' && !WALLPAPERS.some(function (w) { return w.id === id; })) return { ok: false, reason: 'bad-wallpaper' };
  var p2 = loadPrefs(); p2.wallpaper = id; savePrefs(p2); applyPrefsToDocument(); return { ok: true };
}
function setFrame(id) {
  if (!FRAMES.some(function (f) { return f.id === id; })) return { ok: false, reason: 'bad-frame' };
  var p = loadPrefs(); p.frame = id; savePrefs(p); applyPrefsToDocument(); return { ok: true };
}
function resetAppearance() {
  var p = loadPrefs(); p.wallpaper = 'mist'; p.customWallpaper = ''; p.frame = 'gold'; savePrefs(p); applyPrefsToDocument(); return loadPrefs();
}
function listEvents() { return loadPrefs().events || []; }

var api = {
  MARK: MARK, KEY: KEY, FRAMES: FRAMES, WALLPAPERS: WALLPAPERS, RISK_TABLE: RISK_TABLE,
  loadPrefs: loadPrefs, savePrefs: savePrefs, wallpaperCss: wallpaperCss,
  assessRisk: assessRisk, roll: roll, cryptoRand: cryptoRand,
  openLock: openLock, openSettings: openSettings, renderCaught: renderCaught,
  setWallpaper: setWallpaper, setFrame: setFrame, resetAppearance: resetAppearance,
  handleCaught: handleCaught, sendWeChat: sendWeChat, bubbleText: bubbleText,
  affectionValue: affectionValue, tierOf: tierOf, listEvents: listEvents,
  qqFigure: qqFigure, batteryPct: batteryPct
};
Object.defineProperty(api, '_rand', {
  get: function () { return testRand; },
  set: function (v) { testRand = (typeof v === 'function') ? v : null; }
});
window.FlipPhone = api;
})();
