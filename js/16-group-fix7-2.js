
/* ══════════ Group AB · 桌宠状态机/语义总线/皮肤/设置/收起 + 番茄猫进阶 ══════════
出处（只借思路，不复制任何项目代码；本模块全部新写）：
- 桌宠 11 项：批量调研桌宠分组的做法——desksprite（MIT，零依赖桌面宠物：抓/扔/坐下
  物理、三种模式、皮肤数据驱动）的做法；tux-pet-js（GPL-3.0：持久心情 + 一次性动作
  两层状态机、语义化状态做法）只借思路，代码与 Tux/GNU/Gopher/Ferris 形象一律不搬；
  mini-games（未注明许可：小游戏模块化结构）只借玩法结构。M 组桌宠底座已借鉴的
  VPet / ai-live2d-body 做法由 M 组承担，AB 不重复。
- 番茄猫 5 项：pomodoro-timer-with-game（作者声明可自由学习，无正式许可文件：黑猫
  番茄钟、专注 3 金币/分钟、WebAudio 提示音、7 天统计/每日目标）只借思路；
  notion-aesthetic-pomodoro（未注明许可：进阶计划 + 进度环结构）只借结构。
- 不做的 C 档：服务器/部署、真实大模型调用、多人联机、桌面端形态与输入、外部依赖
  与联网内容（用户自己上传的背景图/提示音/立绘除外，存在本地，不走外链）。
- 新增键：pet_state_ab_v1（桌宠+番茄猫共用的同一份宠物状态，情绪只存这一份）、
  focus_plan_ab_v1（番茄计划/场次/金币预留/检查点/上传背景与提示音）。
- 只读/复用旧键：focus_log_v1 / focus_state_v1（经 GroupN 的 focusStart/focusEnd
  读写，AB 只包一层钩子，不直接写）、cike_char_look_v1（只读：皮肤未自定义时发色
  瞳色跟此刻换装走）、otome_custom_char_v1（只读）、otome_home_v1（只读：3D 家那
  只猫就是这只猫）、phone_settings_v3（只读 deskPet 开关）。
- W 组状态：打补丁时 W 组抓/扔物理与番茄猫计时器主干尚未合入本文件（无 GroupW
  标记），AB 不造物理、不造第二只计时器；闪光庆祝做在独立 overlay 层上，不碰
  transform 主干，并留好 setOneshot('grab') / setOneshot('throw') 接口给 W 组
  物理将来调用；番茄进阶包在 GroupN.focusStart/focusEnd 外面。
- 理解：桌宠 char 与番茄猫是同一只猫的两种表现形态（桌面 char 本人形态 / 专注时
  3D 家那只猫形态），不是两只宠物；情绪只有一份，存在 pet_state_ab_v1.mood。
标记：GroupAB-v1
══════════ */
(function () {
'use strict';
var PET_KEY = 'pet_state_ab_v1';
var FOCUS_KEY = 'focus_plan_ab_v1';
var MOODS = ['Content', 'Focused', 'Hyper', 'Sleepy', 'Curious', 'Stretching', 'Celebrating', 'Napping'];
var MOOD_CN = { Content: '自在', Focused: '专注中', Hyper: '兴奋', Sleepy: '犯困', Curious: '好奇', Stretching: '拉伸中', Celebrating: '庆祝中', Napping: '睡觉中' };
var MOOD_EMOJI = { Content: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.1m6.8 0h.1M8.5 15c1.1 1.5 2.3 2.2 3.5 2.2s2.4-.7 3.5-2.2"/></svg>', Focused: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/></svg>', Hyper: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>', Sleepy: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/></svg>', Curious: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/></svg>', Stretching: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-3.6 2.7-5.4 6.5-5.4s6 1.8 6.5 5.4"/></svg>', Celebrating: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>', Napping: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/></svg>' };
var PERSISTENT = ['idle', 'sit', 'sun', 'sleep', 'walk'];
var ONESHOT_MS = { wave: 1200, jump: 900, grab: 1500, throw: 1200, celebrate: 1200, stretch: 2000, think: 1500, point: 1200, shake: 800 };
var SEMANTIC = {
  idle: { persistent: 'idle' }, thinking: { oneshot: 'think' }, building: { persistent: 'walk' },
  delegating: { oneshot: 'point' }, leaving: { persistent: 'walk' }, greeting: { oneshot: 'wave' },
  waiting: { persistent: 'idle' }, success: { oneshot: 'celebrate', celebrate: true }, error: { oneshot: 'shake' }
};
var MODES = [
  { id: 'follow', label: '跟随手指' }, { id: 'random', label: '随机漫步' },
  { id: 'wander', label: '踱步' }, { id: 'chase', label: '追小球' }
];
/* GROUP-PET-MERGE：皮肤注册表与 js/58 MARKET 合并为一处事实来源（MARKET 为准，
   这里只做映射，不另造第二份表）。petSkin 是写进 phone_ui_prefs_v1 的值（领养
   与设置共用同一个）；frame 是 FIX2 SKINS 里的帧键；qqboy 是旧存档兼容
   （默认小人，petSkin 'default'）。 */
var SKINS = {
  cat: { name: '小猫', petSkin: 'cat', frame: 'cat' },
  'pet-claude': { name: 'Claude · 螃蟹', petSkin: 'pet-claude', frame: 'crab' },
  'pet-chatgpt': { name: 'ChatGPT · 黑狐', petSkin: 'pet-chatgpt', frame: 'fox' },
  'pet-muse': { name: 'Muse · Jolly', petSkin: 'pet-muse', frame: 'jolly' },
  qqboy: { name: 'QQ boy（默认小人）', petSkin: 'default', frame: 'boy' },
  custom: { name: '上传抠图立绘', petSkin: 'cutout', frame: null }
};
var PATTERNS = { solid: '纯色', stripes: '条纹', dots: '圆点' };
var BUBBLES = [
  { text: '去归巢看看今天的记忆', target: 'guichao' },
  { text: '去此刻看看他在做什么', target: 'cike' },
  { text: '去微信找他聊聊', target: 'wechat' }
];
var COINS_PER_MIN = 3;
var MAX_BG_LEN = 1500000;
var MAX_SND_LEN = 2000000;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr(d) { var t = d || new Date(); return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); }
function clampNum(v, lo, hi) { v = Number(v); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
function lsRead(k) { try { var r = localStorage.getItem(k); if (r == null) return null; return JSON.parse(r); } catch (e) { return null; } }
function lsWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ── 1. 共用宠物状态（唯一一份情绪） ── */
function petDefaults() {
  return {
    mood: 'Content', persistent: 'idle', oneshot: null, oneshotUntil: 0, mode: 'follow',
    skin: { id: 'qqboy', hair: '#3a2a1e', eye: '#2b2b2b', pattern: 'solid', customImg: '', customized: false },
    settings: { speed: 1, activity: 0.7, follow: true },
    collapsed: false, pos: { right: 14, bottom: 118 },
    lastActive: Date.now(), lastCelebrateAt: 0,
    eye: { dx: 0, dy: 0, side: 'right' }, bubble: { text: '', target: '' } /* GROUP-FIX7：日程 app 已删，默认气泡无跳转目标 */
  };
}
function loadPet() {
  var d = lsRead(PET_KEY);
  var out = petDefaults();
  if (d && typeof d === 'object') {
    Object.keys(out).forEach(function (k) {
      if (k === 'skin' || k === 'settings' || k === 'pos' || k === 'eye' || k === 'bubble') {
        if (d[k] && typeof d[k] === 'object') out[k] = Object.assign({}, out[k], d[k]);
      } else if (d[k] !== undefined) out[k] = d[k];
    });
    if (out.bubble && out.bubble.target === 'schedule') out.bubble.target = ''; /* GROUP-FIX7：旧存档里的气泡目标随日程 app 一起清掉 */
    if (PERSISTENT.indexOf(out.persistent) < 0) out.persistent = 'idle';
    if (MODES.map(function (m) { return m.id; }).indexOf(out.mode) < 0) out.mode = 'follow';
    if (!SKINS[out.skin.id]) out.skin.id = 'qqboy';
    if (!PATTERNS[out.skin.pattern]) out.skin.pattern = 'solid';
    if (MOODS.indexOf(out.mood) < 0) out.mood = 'Content';
  }
  return out;
}
function petState() { return loadPet(); }
function savePet(st) { return lsWrite(PET_KEY, st); }
function updatePet(fn) { var st = loadPet(); fn(st); savePet(st); return st; }

/* 情绪推导（纯函数）：专注 > 休息拉伸 > 庆祝 > 睡觉 > 兴奋 > 好奇 > 自在。
   桌宠标签与番茄猫都读 refreshMood 写进 pet_state_ab_v1.mood 的同一个值。 */
function moodFor(ctx) {
  ctx = ctx || {};
  if (ctx.focusing) return 'Focused';
  if (ctx.resting) return 'Stretching';
  if (ctx.celebrating) return 'Celebrating';
  if (ctx.sleeping) return (ctx.hour >= 22 || ctx.hour < 6) ? 'Napping' : 'Sleepy';
  if ((ctx.activity || 0) >= 0.85) return 'Hyper';
  if (ctx.hour >= 6 && ctx.hour < 9) return 'Curious';
  return 'Content';
}
function isFocusing() {
  try { var G = window.GroupN; return !!(G && G.focusStatus && G.focusStatus()); } catch (e) { return false; }
}
function refreshMood(nowMs) {
  var now = nowMs || Date.now();
  var st = loadPet();
  var fp = loadFocus();
  var h = new Date(now).getHours();
  var m = moodFor({
    hour: h, focusing: isFocusing(),
    resting: !!(fp.break && fp.break.until && now < fp.break.until),
    sleeping: st.persistent === 'sleep' || h >= 22 || h < 6,
    celebrating: (now - (st.lastCelebrateAt || 0)) < 60000,
    activity: (st.settings && st.settings.activity) || 0
  });
  if (m !== st.mood) updatePet(function (s) { s.mood = m; });
  refreshOverlay();
  return m;
}
function moodNow() { return loadPet().mood; }
function modeLabel(id) { var m = MODES.find(function (x) { return x.id === id; }); return m ? m.label : id; }

/* ── 2. 两层状态机：persistent（持久）+ oneshot（一次性，播完自动回落） ── */
var _oneshotTimer = null;
var _semTimer = null;
function petEl() { return document.getElementById('desk-pet'); }
function charEl() { var el = petEl(); return el ? el.querySelector('.gm-pet-char') : null; }
function setPersistent(p) {
  if (PERSISTENT.indexOf(p) < 0) return { ok: false, reason: 'bad-persistent' };
  var st = loadPet();
  if (st.persistent === p) return { ok: false, reason: 'same' };
  updatePet(function (s) { s.persistent = p; });
  var el = petEl();
  if (el) {
    PERSISTENT.forEach(function (x) { el.classList.remove('gm-ab-p-' + x); });
    el.classList.add('gm-ab-p-' + p);
  }
  refreshMood();
  return { ok: true, persistent: p };
}
function clearOneshot() {
  clearTimeout(_oneshotTimer); _oneshotTimer = null;
  var el = petEl();
  if (el) Object.keys(ONESHOT_MS).forEach(function (n) { el.classList.remove('gm-ab-o-' + n); });
  updatePet(function (s) { s.oneshot = null; s.oneshotUntil = 0; });
  refreshMood();
  return true;
}
function setOneshot(name, ms) {
  if (!ONESHOT_MS[name]) return { ok: false, reason: 'bad-oneshot' };
  var dur = ms || ONESHOT_MS[name];
  clearTimeout(_oneshotTimer);
  var el = petEl();
  if (el) {
    Object.keys(ONESHOT_MS).forEach(function (n) { el.classList.remove('gm-ab-o-' + n); });
    el.classList.add('gm-ab-o-' + name);
  }
  updatePet(function (s) {
    s.oneshot = name; s.oneshotUntil = Date.now() + dur;
    if (name === 'celebrate') s.lastCelebrateAt = Date.now();
  });
  _oneshotTimer = setTimeout(function () { clearOneshot(); }, dur);
  refreshMood();
  return { ok: true, oneshot: name, ms: dur };
}
/* 语义状态总线：各功能只发语义状态，不直接操作帧。 */
function setSemantic(name) {
  var m = SEMANTIC[name];
  if (!m) return null;
  var el = petEl();
  if (el) {
    clearTimeout(_semTimer);
    Object.keys(SEMANTIC).forEach(function (n) { el.classList.remove('gm-ab-sem-' + n); });
    el.classList.add('gm-ab-sem-' + name);
    _semTimer = setTimeout(function () { try { el.classList.remove('gm-ab-sem-' + name); } catch (e) {} }, 1200);
  }
  if (m.oneshot) setOneshot(m.oneshot, 1200);
  else if (m.persistent) setPersistent(m.persistent);
  if (m.celebrate) updatePet(function (s) { s.lastCelebrateAt = Date.now(); });
  refreshMood();
  return { name: name, applied: m };
}

/* ── 3. 眼睛跟随 + 朝向 ── */
var _eye = { dx: 0, dy: 0, side: 'right' };
function lookAt(clientX, clientY, vw, vh, saveIt) {
  vw = vw || window.innerWidth || 375; vh = vh || window.innerHeight || 667;
  var side = clientX < vw / 2 ? 'left' : 'right';
  var dx = clampNum((clientX - vw / 2) / (vw / 2) * 6, -6, 6);
  var dy = clampNum((clientY - vh / 2) / (vh / 2) * 4, -4, 4);
  _eye = { dx: dx, dy: dy, side: side };
  if (saveIt) updatePet(function (s) { s.eye = { dx: dx, dy: dy, side: side }; });
  applyEyes();
  return { dx: dx, dy: dy, side: side };
}
function applyEyes() {
  var ch = charEl();
  if (!ch) return false;
  var flip = _eye.side === 'left';
  var effDx = flip ? -_eye.dx : _eye.dx;
  var pupils = ch.querySelectorAll('.ab-pupil');
  var hls = ch.querySelectorAll('.ab-hl');
  var i;
  if (pupils.length) {
    for (i = 0; i < pupils.length; i++) pupils[i].setAttribute('transform', 'translate(' + effDx + ' ' + _eye.dy + ')');
    for (i = 0; i < hls.length; i++) hls[i].setAttribute('transform', 'translate(' + effDx + ' ' + _eye.dy + ')');
  } else {
    /* M 组原版 svg 的回退：按 cx 找两只眼睛 + 高光 */
    var all = ch.querySelectorAll('ellipse, circle');
    for (i = 0; i < all.length; i++) {
      var cx = all[i].getAttribute('cx');
      if (cx === '52' || cx === '80' || cx === '54' || cx === '82') {
        all[i].setAttribute('transform', 'translate(' + effDx + ' ' + _eye.dy + ')');
      }
    }
  }
  return true;
}

/* ── 4. 行为模式 ── */
function setMode(id) {
  if (!MODES.some(function (m) { return m.id === id; })) return { ok: false, reason: 'bad-mode' };
  updatePet(function (s) { s.mode = id; });
  refreshOverlay();
  return { ok: true, mode: id, label: modeLabel(id) };
}
function cycleMode() {
  var st = loadPet();
  var idx = MODES.findIndex(function (m) { return m.id === st.mode; });
  var next = MODES[(idx + 1) % MODES.length];
  setMode(next.id);
  showBubble('已切换到「' + next.label + '」模式', st.bubble.target || ''); /* GROUP-FIX7：日程 app 已删 */
  return next;
}

/* ── 5. 空闲：5 分钟坐下、15 分钟睡觉；专注时不睡；夜里 22:00–6:00 也睡 ──
   3D 家（otome_home_v1）里没有独立的日程睡觉字段（只有 pet / visitedRooms /
   furnFirst / lastRoom），所以睡觉时间段沿用 M 组宠物已有的 22:00–6:00 夜晚规则，
   与 3D 家的夜晚作息一致；空闲睡觉与专注不睡是 AB 层叠加的规则。 */
function noteActivity(nowMs) {
  var now = nowMs || Date.now();
  updatePet(function (s) {
    s.lastActive = now;
    if (s.persistent === 'sleep' || s.persistent === 'sit') s.persistent = 'idle';
  });
  refreshMood();
  return true;
}
function idleCheck(nowMs, hourOverride) {
  var now = nowMs || Date.now();
  var h = (hourOverride === undefined || hourOverride === null) ? new Date(now).getHours() : hourOverride;
  var st = loadPet();
  if (isFocusing()) {
    if (st.persistent === 'sleep') setPersistent('idle');
    return { action: 'focus-awake', focusing: true, hour: h };
  }
  if (h >= 22 || h < 6) {
    if (st.persistent !== 'sleep') setPersistent('sleep');
    return { action: 'night-sleep', hour: h };
  }
  var idleMin = (now - (st.lastActive || now)) / 60000;
  if (idleMin >= 15) {
    if (st.persistent !== 'sleep') setPersistent('sleep');
    return { action: 'idle-sleep', idleMin: idleMin, hour: h };
  }
  if (idleMin >= 5 && (st.persistent === 'idle' || st.persistent === 'walk')) {
    setPersistent('sit');
    return { action: 'idle-sit', idleMin: idleMin, hour: h };
  }
  return { action: 'none', idleMin: idleMin, hour: h };
}

/* ── 6. 皮肤注册表 + 颜色 × 图案 ── */
function effectiveColors() {
  var st = loadPet();
  var col = { hair: st.skin.hair, eye: st.skin.eye };
  if (!st.skin.customized) {
    /* 未自定义时跟此刻换装走（只读 cike_char_look_v1，不写它） */
    try {
      var v = JSON.parse(localStorage.getItem('cike_char_look_v1') || 'null');
      if (v) { if (v.hair) col.hair = v.hair; if (v.eye) col.eye = v.eye; }
    } catch (e) {}
  }
  return col;
}
function patternBits(pattern, kind) {
  if (pattern === 'stripes') {
    if (kind === 'cat') return '<path class="ab-stripe" d="M38 34 l5 -8 M50 30 l0 -9 M62 34 l-5 -8" stroke="#8a6a52" stroke-width="2.5" stroke-linecap="round" fill="none"/><path class="ab-stripe" d="M30 96 l14 0 M56 96 l14 0" stroke="#8a6a52" stroke-width="2" stroke-linecap="round"/>';
    return '<path class="ab-stripe" d="M38 92 l24 0 M40 100 l20 0" stroke="#e07856" stroke-width="2.5" stroke-linecap="round"/>';
  }
  if (pattern === 'dots') {
    if (kind === 'cat') return '<circle class="ab-dot" cx="40" cy="78" r="3" fill="#e8b4b8"/><circle class="ab-dot" cx="60" cy="84" r="3" fill="#e8b4b8"/><circle class="ab-dot" cx="50" cy="72" r="2.5" fill="#e8b4b8"/>';
    return '<circle class="ab-dot" cx="44" cy="96" r="3" fill="#e8b4b8"/><circle class="ab-dot" cx="58" cy="102" r="3" fill="#e8b4b8"/>';
  }
  return '';
}
function qqSvg(hair, eye, sleeping, pattern) {
  var eyes = sleeping
    ? '<path d="M32 58 q5 4 10 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M58 58 q5 4 10 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<ellipse class="ab-pupil" cx="37" cy="57" rx="4.5" ry="6" fill="' + eye + '"/><ellipse class="ab-pupil" cx="63" cy="57" rx="4.5" ry="6" fill="' + eye + '"/><circle class="ab-hl" cx="39" cy="54" r="1.6" fill="#fff"/><circle class="ab-hl" cx="65" cy="54" r="1.6" fill="#fff"/>';
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="桌面宠物">'
    + '<ellipse cx="50" cy="114" rx="20" ry="4" fill="rgba(0,0,0,0.15)"/>'
    + '<rect x="40" y="94" width="8" height="18" rx="3.5" fill="#3a3a3a"/><rect x="52" y="94" width="8" height="18" rx="3.5" fill="#3a3a3a"/>'
    + '<path d="M34 76 Q50 68 66 76 L69 98 Q50 104 31 98 Z" fill="#7aa8c9"/>'
    + patternBits(pattern, 'qq')
    + '<circle cx="50" cy="46" r="27" fill="#ffe3c4"/>'
    + '<path d="M25 48 Q21 14 50 12 Q79 14 75 48 Q71 28 50 26 Q29 28 25 48 Z" fill="' + hair + '"/>'
    + eyes
    + '<circle cx="31" cy="66" r="3.5" fill="#ffb3a0" opacity="0.7"/><circle cx="69" cy="66" r="3.5" fill="#ffb3a0" opacity="0.7"/>'
    + '<path d="M45 68 Q50 72 55 68" stroke="#c87a5a" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '</svg>';
}
function catSvg(hair, eye, sleeping, pattern) {
  var eyes = sleeping
    ? '<path d="M34 58 q5 4 10 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M56 58 q5 4 10 0" stroke="' + eye + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<ellipse class="ab-pupil" cx="39" cy="57" rx="4.5" ry="6" fill="' + eye + '"/><ellipse class="ab-pupil" cx="61" cy="57" rx="4.5" ry="6" fill="' + eye + '"/><circle class="ab-hl" cx="41" cy="54" r="1.6" fill="#fff"/><circle class="ab-hl" cx="63" cy="54" r="1.6" fill="#fff"/>';
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="桌宠猫">'
    + '<ellipse cx="50" cy="114" rx="20" ry="4" fill="rgba(0,0,0,0.15)"/>'
    + '<path d="M28 40 L24 16 L44 28 Z" fill="' + hair + '"/><path d="M72 40 L76 16 L56 28 Z" fill="' + hair + '"/>'
    + '<path d="M31 34 L29 22 L39 28 Z" fill="#ffb3a0" opacity="0.8"/><path d="M69 34 L71 22 L61 28 Z" fill="#ffb3a0" opacity="0.8"/>'
    + '<ellipse cx="50" cy="88" rx="22" ry="24" fill="' + hair + '"/>'
    + patternBits(pattern, 'cat')
    + '<circle cx="50" cy="48" r="26" fill="' + hair + '"/>'
    + eyes
    + '<path d="M46 66 L54 66 L50 70 Z" fill="#e07856"/>'
    + '<path d="M46 70 Q50 73 54 70" stroke="#8a5a40" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    + '<path d="M18 60 L34 62 M18 68 L34 66 M82 60 L66 62 M82 68 L66 66" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>'
    + '</svg>';
}
function skinSig(st) {
  var col = effectiveColors();
  return st.skin.id + '|' + col.hair + '|' + col.eye + '|' + st.skin.pattern + '|'
    + (st.skin.customImg ? ('img:' + st.skin.customImg.length) : 'noimg') + '|'
    + (st.persistent === 'sleep' ? 'sleep' : 'awake');
}
/* GROUP-PET-MERGE：领养与设置写同一个 petSkin（js/58 GroupPET.adopt 同款写法）。 */
function writePetSkin(v) {
  try {
    if (window.GroupW && GroupW.setPref) { GroupW.setPref('petSkin', v); return true; }
  } catch (e) {}
  try {
    var p = JSON.parse(localStorage.getItem('phone_ui_prefs_v1') || '{}') || {};
    p.petSkin = v;
    localStorage.setItem('phone_ui_prefs_v1', JSON.stringify(p));
    return true;
  } catch (e) { return false; }
}
function repaintDesktopPet() {
  try { if (window.GroupFIX2 && GroupFIX2.ensurePetCanvas) GroupFIX2.ensurePetCanvas(); } catch (e) {}
}
/* 像素皮肤的 SVG 兜底脸（FIX2 像素画布不在时桌面宠才看得到它；平时 FIX2 会把
   这里的 SVG 藏起来改画 canvas）。帧与调色板只读 GroupFIX2.SKINS，不另抄。 */
function pixelSvg(frameKey) {
  try {
    var sk = (window.GroupFIX2 && window.GroupFIX2.SKINS && window.GroupFIX2.SKINS[frameKey]) || null;
    if (!sk || !sk.frames || !sk.frames.idle) return '';
    var pal = sk.palette || {};
    var rects = '';
    var rows = sk.frames.idle;
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y] || '';
      for (var x = 0; x < row.length; x++) {
        var c = pal[row.charAt(x)];
        if (c) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
      }
    }
    return '<svg viewBox="0 0 ' + sk.w + ' ' + sk.h + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="桌面宠物" style="width:100%;height:100%;">' + rects + '</svg>';
  } catch (e) { return ''; }
}
function applySkin() {
  var ch = charEl();
  if (!ch) return false;
  var st = loadPet();
  var col = effectiveColors();
  var sleeping = st.persistent === 'sleep';
  var html;
  var _frame = SKINS[st.skin.id] && SKINS[st.skin.id].frame;
  if (st.skin.id === 'cat') html = catSvg(col.hair, col.eye, sleeping, st.skin.pattern);
  else if (st.skin.id === 'custom' && st.skin.customImg) html = '<img src="' + esc(st.skin.customImg) + '" alt="char">';
  else if (_frame && _frame !== 'boy' && _frame !== 'cat') html = pixelSvg(_frame) || qqSvg(col.hair, col.eye, sleeping, st.skin.pattern);
  else html = qqSvg(col.hair, col.eye, sleeping, st.skin.pattern);
  var sig = skinSig(st);
  if (ch.getAttribute('data-ab-skin') !== st.skin.id || ch.getAttribute('data-ab-sig') !== sig) {
    ch.innerHTML = html;
    ch.setAttribute('data-ab-skin', st.skin.id);
    ch.setAttribute('data-ab-sig', sig);
  }
  return true;
}
function setSkin(id) {
  if (!SKINS[id]) return { ok: false, reason: 'bad-skin' };
  var st = loadPet();
  if (id === 'custom' && !st.skin.customImg) return { ok: false, reason: 'no-custom-img', hint: '先在桌宠设置里上传一张抠图立绘' };
  updatePet(function (s) { s.skin.id = id; });
  writePetSkin(SKINS[id].petSkin);
  applySkin(); refreshOverlay(); repaintDesktopPet();
  return { ok: true, skin: id };
}
function setCustomSkin(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return { ok: false, reason: 'not-image' };
  if (dataUrl.length > MAX_BG_LEN) return { ok: false, reason: 'too-big', hint: '图片太大了（超过约 1.5MB），换一张小一点的' };
  updatePet(function (s) { s.skin.customImg = dataUrl; s.skin.id = 'custom'; });
  writePetSkin('cutout');
  applySkin(); refreshOverlay(); repaintDesktopPet();
  return { ok: true, skin: 'custom' };
}
function setPattern(p) {
  if (!PATTERNS[p]) return { ok: false, reason: 'bad-pattern' };
  updatePet(function (s) { s.skin.pattern = p; });
  applySkin(); refreshOverlay();
  return { ok: true, pattern: p };
}
function setColor(hair, eye) {
  var ok = /^#[0-9a-fA-F]{6}$/;
  if (hair && !ok.test(hair)) return { ok: false, reason: 'bad-hair' };
  if (eye && !ok.test(eye)) return { ok: false, reason: 'bad-eye' };
  updatePet(function (s) {
    if (hair) s.skin.hair = hair;
    if (eye) s.skin.eye = eye;
    s.skin.customized = true;
  });
  applySkin(); refreshOverlay();
  return { ok: true };
}
function setSettings(patch) {
  patch = patch || {};
  updatePet(function (s) {
    if (patch.speed !== undefined) s.settings.speed = clampNum(patch.speed, 0.5, 2);
    if (patch.activity !== undefined) s.settings.activity = clampNum(patch.activity, 0, 1);
    if (patch.follow !== undefined) s.settings.follow = !!patch.follow;
  });
  refreshOverlay();
  return { ok: true, settings: loadPet().settings };
}
function petReset() {
  try { localStorage.removeItem(PET_KEY); } catch (e) {}
  /* GROUP-PET-MERGE：重置也把领养写回默认小人，否则设置页显示 QQ boy、
     桌面却仍是领养的模型，两处注册表又会各说各话。 */
  writePetSkin('default');
  _eye = { dx: 0, dy: 0, side: 'right' };
  applySkin(); refreshOverlay();
  return loadPet();
}

/* ── 7. 收起成角落小图标（位置与皮肤存 pet_state_ab_v1，重启后不变） ── */
function collapsePet() {
  updatePet(function (s) { s.collapsed = true; });
  refreshOverlay();
  return { ok: true, collapsed: true };
}
function expandPet() {
  updatePet(function (s) { s.collapsed = false; });
  noteActivity();
  refreshOverlay();
  return { ok: true, collapsed: false };
}

/* ── 8. 点按闪光庆祝（独立 overlay 层，不碰 transform 主干） ── */
function pokeFlash() {
  var el = petEl();
  if (!el) return false;
  var st = loadPet();
  if (st.collapsed) { expandPet(); return 'expanded'; }
  noteActivity();
  try {
    var b = document.createElement('span');
    b.className = 'gm-ab-burst'; b.innerHTML = '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>';
    el.appendChild(b);
    setTimeout(function () { try { b.remove(); } catch (e) {} }, 950);
  } catch (e) {}
  setOneshot('celebrate', 900);
  return true;
}

/* ── 9. 想法气泡：文案与目标成对，点一下跳到对应功能 ── */
function pickBubble(nowMs) {
  var d = new Date(nowMs || Date.now());
  return BUBBLES[(d.getDate() + d.getHours()) % BUBBLES.length];
}
function goTo(target) {
  if (!target) return { ok: false, reason: 'no-target' };
  try { window.__abLastJump = target; } catch (e) {}
  try {
    if (window.AppManager && AppManager.launch) {
      AppManager.launch(target);
      return { ok: true, via: 'launch', target: target };
    }
  } catch (e) {}
  return { ok: false, via: 'fallback', target: target };
}
var _bubbleTimer = null;
function showBubble(text, target) {
  var el = petEl();
  if (!el) return false;
  try {
    if (window.GroupM && GroupM.pet && GroupM.pet.build) GroupM.pet.build();
  } catch (e) {}
  var bubble = el.querySelector('#gm-pet-bubble');
  var txt = el.querySelector('#gm-pet-bubble-text');
  if (!bubble || !txt) return false;
  updatePet(function (s) { s.bubble = { text: text, target: target || '' }; });
  txt.textContent = text;
  bubble.style.display = 'block';
  ensureBubbleExtras();
  clearTimeout(_bubbleTimer);
  _bubbleTimer = setTimeout(function () { try { bubble.style.display = 'none'; } catch (e) {} }, 6000);
  return true;
}
function ensureBubbleExtras() {
  var el = petEl();
  if (!el) return false;
  var btns = el.querySelector('.gm-pet-bubble-btns');
  if (!btns) return false;
  var st = loadPet();
  if (!btns.querySelector('#gm-ab-jump')) {
    var j = document.createElement('button');
    j.type = 'button'; j.id = 'gm-ab-jump'; j.textContent = '去看看';
    btns.appendChild(j);
  }
  if (!btns.querySelector('#gm-ab-mode')) {
    var m = document.createElement('button');
    m.type = 'button'; m.id = 'gm-ab-mode'; m.textContent = '模式：' + modeLabel(st.mode);
    btns.appendChild(m);
  }
  var modeBtn = btns.querySelector('#gm-ab-mode');
  if (modeBtn) {
    var label = '模式：' + modeLabel(st.mode);
    if (modeBtn.textContent !== label) modeBtn.textContent = label;
  }
  return true;
}

/* ── 10. 覆盖层刷新：M 组重建后把 AB 的东西补回来（幂等，只在变化时写 DOM） ── */
var _inRefresh = false;
var _abX = 0;
var _ballX = 0;
function refreshOverlay() {
  var el = petEl();
  if (!el || _inRefresh) return false;
  _inRefresh = true;
  try {
    var st = loadPet();
    if (el.style.right !== st.pos.right + 'px') el.style.right = st.pos.right + 'px';
    if (el.style.bottom !== st.pos.bottom + 'px') el.style.bottom = st.pos.bottom + 'px';
    el.classList.toggle('gm-ab-collapsed', !!st.collapsed);
    try { el.style.setProperty('--ab-speed', String((st.settings && st.settings.speed) || 1)); } catch (e) {}
    PERSISTENT.forEach(function (x) { if (x !== st.persistent) el.classList.remove('gm-ab-p-' + x); });
    if (st.persistent) el.classList.add('gm-ab-p-' + st.persistent);
    /* GROUP-FIX · 18(b)：删掉桌宠头顶的浮动心情标签 #gm-ab-mood——
       FIX2 把它锚在桌宠底边后，截断的「😌 自」/残字「在」正好压在 Dock 上
       （真机截图 4491_50 / 4492_51）。心情仍在桌宠设置与专注面板里可见
       （MOOD_CN / MOOD_EMOJI 的其它用法不动）。 */
    applySkin();
    applyEyes();
    ensureBubbleExtras();
    var ch = charEl();
    if (ch && ch.firstElementChild) {
      var flip = _eye.side === 'left' ? -1 : 1;
      var tf = 'translateX(' + _abX + 'px) scaleX(' + flip + ')';
      if (ch.firstElementChild.style.transform !== tf) ch.firstElementChild.style.transform = tf;
    }
    var ball = el.querySelector('.gm-ab-ball');
    if (st.mode === 'chase' && !st.collapsed) {
      if (!ball) {
        ball = document.createElement('div');
        ball.className = 'gm-ab-ball';
        el.appendChild(ball);
      }
      var btf = 'translateX(' + _ballX + 'px)';
      if (ball.style.transform !== btf) ball.style.transform = btf;
    } else if (ball) ball.remove();
  } catch (e) {}
  _inRefresh = false;
  return true;
}
function petTick(nowMs) {
  var now = nowMs || Date.now();
  var st = loadPet();
  if (st.oneshot && now > (st.oneshotUntil || 0)) clearOneshot();
  var fp = loadFocus();
  if (fp.break && fp.break.until && now > fp.break.until) endBreak(now);
  idleCheck(now);
  st = loadPet();
  if (!st.collapsed && st.persistent !== 'sleep') {
    var speed = (st.settings && st.settings.speed) || 1;
    var activity = (st.settings && st.settings.activity) || 0;
    if (st.mode === 'follow') {
      if (st.settings.follow) {
        var target = _eye.side === 'left' ? -18 : 18;
        _abX += Math.max(-3 * speed, Math.min(3 * speed, target - _abX));
      }
    } else if (st.mode === 'random') {
      if (Math.random() < 0.2 * activity) _abX = clampNum(_abX + (Math.random() < 0.5 ? -8 : 8) * speed, -18, 18);
    } else if (st.mode === 'wander') {
      _abX = Math.round(12 * Math.sin(now / 9000));
    } else if (st.mode === 'chase') {
      _ballX = clampNum(_ballX + (Math.random() < 0.5 ? -4 : 4), -30, 30);
      _abX += Math.max(-4 * speed, Math.min(4 * speed, _ballX - _abX));
    }
  }
  refreshMood(now);
  refreshOverlay();
  return loadPet();
}

/* ── 11. 番茄猫进阶（包在 GroupN.focusStart/focusEnd 外面，不动计时器主干） ── */
function focusDefaults() {
  return {
    planned: 4, done: 0, dailyCount: 0, dailyDate: '',
    sessions: [], coins: 0, reserved: 0, goal: null,
    bg: '', sound: '', soundName: '', soundChoice: 'webaudio',
    break: { kind: null, until: 0, startedAt: 0 }, checkpoints: []
  };
}
function loadFocus() {
  var d = lsRead(FOCUS_KEY);
  var out = focusDefaults();
  if (d && typeof d === 'object') {
    Object.keys(out).forEach(function (k) {
      if (d[k] !== undefined) out[k] = d[k];
    });
    if (!Array.isArray(out.sessions)) out.sessions = [];
    if (!Array.isArray(out.checkpoints)) out.checkpoints = [];
    if (!out.break || typeof out.break !== 'object') out.break = { kind: null, until: 0, startedAt: 0 };
    if (out.soundChoice !== 'webaudio' && out.soundChoice !== 'custom') out.soundChoice = 'webaudio';
  }
  return out;
}
function focusPlan() { return loadFocus(); }
function saveFocus(fp) { return lsWrite(FOCUS_KEY, fp); }
function updateFocus(fn) { var fp = loadFocus(); fn(fp); saveFocus(fp); return fp; }
function rolloverInPlace(fp, today) {
  if (fp.dailyDate !== today) { fp.dailyDate = today; fp.dailyCount = 0; fp.done = 0; }
}
function dailyCount() {
  var fp = loadFocus();
  var today = todayStr();
  if (fp.dailyDate !== today) { rolloverInPlace(fp, today); saveFocus(fp); }
  return fp.dailyCount || 0;
}
function setPlan(n) {
  var v = Math.max(1, Math.min(8, Math.round(Number(n) || 4)));
  updateFocus(function (fp) { fp.planned = v; });
  return { ok: true, planned: v };
}
function onFocusStart() {
  refreshMood();
  return { ok: true, mood: moodNow() };
}
/* 专注结束：金币 3/分钟（pomodoro-timer-with-game 的数字）；有预留目标时先攒进
   预留池，达标后提示可买；专注分钟与养猫进度写进同一条检查记录 checkpoints。 */
function onFocusEnd(result, done) {
  if (!result) return null;
  var fp = loadFocus();
  var today = todayStr();
  rolloverInPlace(fp, today);
  var minutes = result.minutes || 0;
  var doneFlag = done !== false;
  var earned = 0, free = 0, take = 0;
  if (doneFlag) {
    fp.done = (fp.done || 0) + 1;
    fp.dailyCount = (fp.dailyCount || 0) + 1;
    fp.sessions.unshift({ date: today, minutes: minutes, kind: 'focus', at: Date.now() });
    fp.sessions = fp.sessions.slice(0, 20);
    earned = COINS_PER_MIN * minutes;
    if (fp.goal && fp.reserved < fp.goal.target) {
      take = Math.min(earned, fp.goal.target - fp.reserved);
      fp.reserved += take;
    }
    free = earned - take;
    fp.coins = (fp.coins || 0) + free;
  }
  var st = loadPet();
  var reached = !!(fp.goal && fp.reserved >= fp.goal.target);
  fp.checkpoints.unshift({
    date: today, at: Date.now(), focusMinutes: minutes,
    petMood: st.mood, petPersistent: st.persistent,
    coins: fp.coins, reserved: fp.reserved,
    goal: fp.goal ? { name: fp.goal.name, target: fp.goal.target } : null,
    done: doneFlag
  });
  fp.checkpoints = fp.checkpoints.slice(0, 20);
  saveFocus(fp);
  if (doneFlag) {
    updatePet(function (s) { s.lastCelebrateAt = Date.now(); });
    setOneshot('celebrate', 1200);
  }
  refreshMood();
  return {
    minutes: minutes, earned: earned, free: free, reservedTake: take,
    reserved: fp.reserved, coins: fp.coins, reached: reached,
    done: fp.done, dailyCount: fp.dailyCount
  };
}
function breakState(nowMs) {
  var now = nowMs || Date.now();
  var fp = loadFocus();
  if (fp.break && fp.break.until && now < fp.break.until) {
    return { active: true, kind: fp.break.kind, leftMin: Math.max(0, Math.ceil((fp.break.until - now) / 60000)) };
  }
  return { active: false, kind: null, leftMin: 0 };
}
function sendStretch(kind) {
  var text = kind === 'long'
    ? '长休到啦，好好拉伸一下，看看窗外，让眼睛休息会儿～'
    : '短休到啦，站起来伸个懒腰，转转脖子，喝口水～';
  showBubble(text, '');
  return text;
}
function startBreak(kind) {
  var k = kind === 'long' ? 'long' : 'short';
  var min = k === 'long' ? 15 : 5;
  var now = Date.now();
  updateFocus(function (fp) { fp.break = { kind: k, until: now + min * 60000, startedAt: now }; });
  setPersistent('sleep');
  var text = sendStretch(k);
  refreshMood();
  return { ok: true, kind: k, minutes: min, until: now + min * 60000, stretch: text };
}
function endBreak(nowMs) {
  var fp = loadFocus();
  if (!fp.break || !fp.break.until) return { ok: false, reason: 'no-break' };
  updateFocus(function (f2) { f2.break = { kind: null, until: 0, startedAt: 0 }; });
  setPersistent('idle');
  noteActivity(nowMs);
  showBubble('休息结束，回来啦～', '');
  refreshMood();
  return { ok: true };
}
function catState(nowMs) {
  var bs = breakState(nowMs);
  var mood = moodNow();
  if (bs.active) return { state: 'sleeping', kind: bs.kind, text: '黑猫正在睡觉（' + (bs.kind === 'long' ? '长休' : '短休') + '）· ' + (MOOD_CN[mood] || mood) };
  if (isFocusing()) return { state: 'focused', text: '黑猫陪你专注中 · ' + (MOOD_CN[mood] || mood) };
  return { state: 'awake', text: '黑猫醒着 · ' + (MOOD_CN[mood] || mood) };
}
function setFocusBg(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return { ok: false, reason: 'not-image' };
  if (dataUrl.length > MAX_BG_LEN) return { ok: false, reason: 'too-big', hint: '图片太大了（超过约 1.5MB），换一张小一点的' };
  updateFocus(function (fp) { fp.bg = dataUrl; });
  return { ok: true };
}
function clearFocusBg() { updateFocus(function (fp) { fp.bg = ''; }); return { ok: true }; }
function setFocusSound(dataUrl, name) {
  if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:audio/') !== 0) return { ok: false, reason: 'not-audio' };
  if (dataUrl.length > MAX_SND_LEN) return { ok: false, reason: 'too-big', hint: '音频太大了（超过约 2MB），换一段短一点的' };
  updateFocus(function (fp) { fp.sound = dataUrl; fp.soundName = String(name || '自定义提示音').slice(0, 30); fp.soundChoice = 'custom'; });
  return { ok: true, soundChoice: 'custom' };
}
function clearFocusSound() { updateFocus(function (fp) { fp.sound = ''; fp.soundName = ''; fp.soundChoice = 'webaudio'; }); return { ok: true }; }
function setSoundChoice(c) {
  if (c !== 'webaudio' && c !== 'custom') return { ok: false, reason: 'bad-choice' };
  var fp = loadFocus();
  if (c === 'custom' && !fp.sound) return { ok: false, reason: 'no-custom-sound', hint: '还没有上传提示音，先传一段音频' };
  updateFocus(function (f2) { f2.soundChoice = c; });
  return { ok: true, soundChoice: c };
}
function playWebAudioBeep() {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return { ok: false, reason: 'no-audio' };
    var ctx = new AC();
    [880, 660].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      var t = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.32);
    });
    return { ok: true, via: 'webaudio' };
  } catch (e) { return { ok: false, reason: 'play-failed' }; }
}
function playChime() {
  var fp = loadFocus();
  if (fp.soundChoice === 'custom' && fp.sound) {
    try {
      var a = new Audio(fp.sound);
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
      return { ok: true, via: 'custom' };
    } catch (e) { return playWebAudioBeep(); }
  }
  return playWebAudioBeep();
}
function setReserveGoal(name, target) {
  var n = String(name || '').trim();
  var t = Math.round(Number(target) || 0);
  if (!n) return { ok: false, reason: 'no-name' };
  if (t < 1 || t > 10000) return { ok: false, reason: 'bad-target' };
  updateFocus(function (fp) { fp.goal = { name: n.slice(0, 20), target: t }; });
  return { ok: true, goal: { name: n.slice(0, 20), target: t } };
}
function clearReserveGoal() { updateFocus(function (fp) { fp.goal = null; }); return { ok: true }; }
function reserveStatus() {
  var fp = loadFocus();
  if (!fp.goal) return { goal: null, reserved: fp.reserved || 0, coins: fp.coins || 0, remaining: 0, reached: false };
  return {
    goal: fp.goal, reserved: fp.reserved || 0, coins: fp.coins || 0,
    remaining: Math.max(0, fp.goal.target - (fp.reserved || 0)),
    reached: (fp.reserved || 0) >= fp.goal.target
  };
}
function rerenderPanel() {
  try { if (window.WeChatAppEngine && WeChatAppEngine._otomePanelFocus) WeChatAppEngine._otomePanelFocus(); } catch (e) {}
}
function focusPanelHTML() {
  var fp = loadFocus();
  var st = loadPet();
  var bs = breakState(Date.now());
  var cs = catState(Date.now());
  var done = fp.done || 0, planned = fp.planned || 4;
  var C = 163.36;
  var off = C * (1 - Math.min(1, done / Math.max(1, planned)));
  var hist = fp.sessions.slice(0, 7).map(function (s) {
    return '<div>· ' + esc(s.date) + ' · ' + (s.kind === 'break' ? '休息' : '专注') + ' ' + s.minutes + ' 分钟</div>';
  }).join('') || '<div style="color:var(--st-ink-40,rgba(30,39,72,.4));">还没有专注记录，完成一次专注后会出现在这里。</div>';
  var rs = reserveStatus();
  var goalHtml = rs.goal
    ? ('目标「' + esc(rs.goal.name) + '」：已预留 ' + rs.reserved + ' / ' + rs.goal.target + ' 金币' + (rs.reached ? ' · ' + '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>' + ' 已攒够，可以买了！' : ''))
    : '还没有预留目标（比如攒 100 金币买猫窝）';
  var bgStyle = fp.bg ? ' style="background-image:url(' + esc(fp.bg) + ');"' : '';
  return '<div class="ab-focus-sec" id="ab-focus-sec"' + bgStyle + '>'
    + '<div class="ab-focus-title"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/></svg> 番茄猫进阶 · 今日计划</div>'
    + '<div class="ab-focus-mood">心情：' + (MOOD_EMOJI[st.mood] || '') + ' ' + (MOOD_CN[st.mood] || st.mood) + '（' + st.mood + '）· 与桌宠同一份状态<br>' + esc(cs.text) + '</div>'
    + '<div style="display:flex;gap:12px;align-items:center;">'
    + '<svg class="ab-ring" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="26" fill="none" stroke="#dce2f1" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="#e07856" stroke-width="6" stroke-linecap="round" stroke-dasharray="163.36" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 32 32)"/><text x="32" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="#1e2748">' + done + '/' + planned + '</text></svg>'
    + '<div style="flex:1;font-size:13px;line-height:1.8;color:var(--st-ink,#1e2748);">今日计划 ' + done + ' / ' + planned + ' 轮 '
    + '<button type="button" onclick="window.GroupAB.focusPlanDelta(-1)">−</button><button type="button" onclick="window.GroupAB.focusPlanDelta(1)">＋</button><br>'
    + '今日完成场次：' + (fp.dailyCount || 0) + ' 场（午夜自动清零）<br>金币：' + (fp.coins || 0) + ' <svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>（专注 3 金币/分钟）</div></div>'
    + '<div style="font-size:13px;margin-top:6px;color:var(--st-ink,#1e2748);">休息：' + (bs.active
      ? ('<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/></svg> ' + (bs.kind === 'long' ? '长休' : '短休') + '中，剩约 ' + bs.leftMin + ' 分钟 <button type="button" onclick="window.GroupAB.focusEndBreak()">结束休息</button>')
      : ('<button type="button" onclick="window.GroupAB.focusStartBreak(\'short\')">短休 5 分钟</button><button type="button" onclick="window.GroupAB.focusStartBreak(\'long\')">长休 15 分钟</button>')) + '</div>'
    + '<div style="font-size:13px;margin-top:6px;color:var(--st-ink,#1e2748);">背景：' + (fp.bg ? '已上传自定义背景 <button type="button" onclick="window.GroupAB.focusClearBg()">清除</button>' : '未上传')
    + ' <label class="ab-chip-btn" style="display:inline-block;">上传背景图<input type="file" accept="image/*" style="display:none" onchange="window.GroupAB._onBgFile(this)"></label></div>'
    + '<div style="font-size:13px;margin-top:6px;color:var(--st-ink,#1e2748);">提示音：' + (fp.soundChoice === 'custom' ? ('自定义：' + esc(fp.soundName || '已上传')) : 'WebAudio 合成')
    + ' <button type="button" onclick="window.GroupAB.focusSetSoundChoice(\'webaudio\')">用 WebAudio</button><button type="button" onclick="window.GroupAB.focusSetSoundChoice(\'custom\')">用上传的</button><button type="button" onclick="window.GroupAB.focusPlayChime()">试听</button>'
    + ' <label class="ab-chip-btn" style="display:inline-block;">上传提示音<input type="file" accept="audio/*" style="display:none" onchange="window.GroupAB._onSoundFile(this)"></label></div>'
    + '<div style="font-size:13px;margin-top:6px;color:var(--st-ink,#1e2748);">金币预留：' + goalHtml + '<br>'
    + '<input id="ab-goal-name" placeholder="目标名字，如猫窝" value="' + esc(rs.goal ? rs.goal.name : '') + '"><input id="ab-goal-target" type="number" placeholder="金币数，如 100" value="' + (rs.goal ? rs.goal.target : '') + '">'
    + '<button type="button" onclick="window.GroupAB.focusSetGoal()">设为预留目标</button>' + (rs.goal ? '<button type="button" onclick="window.GroupAB.focusClearGoal()">取消预留</button>' : '') + '</div>'
    + '<div style="font-size:13px;font-weight:600;margin-top:8px;color:var(--st-ink,#1e2748);">历史记录</div><div class="ab-focus-hist">' + hist + '</div>'
    + '</div>';
}
/* GROUP-PET-MERGE：桌宠设置不再独立成页——本函数返回“设置”页签的片段，
   由桌宠市场 app（catos，js/07）嵌在 领养 | 设置 页签里。控件的读写与事件
   委托都在本文件（data-ab-* 由 abInit 的 document 级监听接管），
   与放在哪里无关；皮肤按钮读上面与 MARKET 合并后的 SKINS。 */
function renderPetSettingsHTML() {
  var st = loadPet();
  var s = st.settings;
  var skin = st.skin;
  var col = effectiveColors();
  var skinBtns = Object.keys(SKINS).map(function (id) {
    return '<button type="button" class="ab-chip-btn' + (skin.id === id ? ' ab-active' : '') + '" data-ab-skin="' + id + '">' + SKINS[id].name + '</button>';
  }).join('');
  var patBtns = Object.keys(PATTERNS).map(function (id) {
    return '<button type="button" class="ab-chip-btn' + (skin.pattern === id ? ' ab-active' : '') + '" data-ab-pattern="' + id + '">' + PATTERNS[id] + '</button>';
  }).join('');
  return '<div id="ab-pet-settings-tab">'
    + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));line-height:1.5;margin-bottom:8px;">桌宠 char 与番茄猫是同一只宠物，共用同一份情绪状态（' + (MOOD_EMOJI[st.mood] || '') + ' ' + (MOOD_CN[st.mood] || st.mood) + '）；改这里，专注面板里的猫也会跟着变。</div>'
    + '<div class="st-group"><div class="ab-set-row"><label>速度</label><input type="range" min="0.5" max="2" step="0.1" value="' + s.speed + '" data-ab-set="speed"><span class="ab-set-val">' + s.speed + '×</span></div>'
    + '<div class="ab-set-row"><label>活跃度</label><input type="range" min="0" max="1" step="0.1" value="' + s.activity + '" data-ab-set="activity"><span class="ab-set-val">' + s.activity + '</span></div>'
    + '<div class="ab-set-row"><label>跟随手指</label><input type="checkbox" ' + (s.follow ? 'checked' : '') + ' data-ab-set="follow"><span class="ab-set-val">' + (s.follow ? '开' : '关') + '</span></div></div>'
    + '<div class="st-group"><div style="font-weight:600;font-size:13px;margin:12px 0 8px;">皮肤（切换立即生效，不用重载）</div>' + skinBtns
    + '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin:8px 0;">发色 <input type="color" value="' + col.hair + '" data-ab-color="hair"> 瞳色 <input type="color" value="' + col.eye + '" data-ab-color="eye"></div>'
    + '<div style="font-weight:600;font-size:13px;margin:12px 0 8px;">图案</div>' + patBtns
    + '<div style="margin-top:8px;"><label class="ab-chip-btn" style="display:inline-block;">上传抠图立绘<input type="file" accept="image/*" style="display:none" onchange="window.GroupAB._onCustomSkinFile(this)"></label> <span id="ab-skin-status" style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">' + (skin.customImg ? '已上传抠图立绘' : '未上传抠图立绘') + '</span></div></div>'
    + '<div class="st-group"><div class="ab-set-row"><label>行为模式</label><span id="ab-mode-label" style="flex:1;font-size:17px;">' + modeLabel(st.mode) + '</span><button type="button" class="ab-chip-btn" data-ab-mode-cycle>切换模式</button></div>'
    + '<div class="ab-set-row"><label>收起宠物</label><span style="flex:1;font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">收成角落小图标，点图标恢复；位置与皮肤会记住</span><button type="button" class="ab-chip-btn" data-ab-collapse>' + (st.collapsed ? '恢复宠物' : '收起来') + '</button></div>'
    + '<div class="ab-set-row"><label>重置</label><span style="flex:1;font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));">把桌宠状态恢复默认</span><button type="button" class="ab-chip-btn" data-ab-reset>重置</button></div></div>'
    + '</div>';
}
function syncSettingsUI() {
  try {
    var st = loadPet();
    document.querySelectorAll('[data-ab-skin]').forEach(function (b) { b.classList.toggle('ab-active', b.getAttribute('data-ab-skin') === st.skin.id); });
    document.querySelectorAll('[data-ab-pattern]').forEach(function (b) { b.classList.toggle('ab-active', b.getAttribute('data-ab-pattern') === st.skin.pattern); });
    var col = document.querySelector('[data-ab-collapse]');
    if (col) col.textContent = st.collapsed ? '恢复宠物' : '收起来';
    var ml = document.getElementById('ab-mode-label');
    if (ml) ml.textContent = modeLabel(st.mode);
    var ss = document.getElementById('ab-skin-status');
    if (ss) ss.textContent = st.skin.customImg ? '已上传抠图立绘' : '未上传抠图立绘';
  } catch (e) {}
}
function alertSafe(msg) { try { alert(msg); } catch (e) {} }
function _onBgFile(input) {
  try {
    var f = input && input.files && input.files[0];
    if (!f) { alertSafe('没有选到文件'); return; }
    if (f.size > 1500000) { alertSafe('图片太大了（超过约 1.5MB），换一张小一点的吧'); return; }
    var r = new FileReader();
    r.onload = function () { var res = setFocusBg(String(r.result)); alertSafe(res.ok ? '专注背景已换好' : ('换背景失败：' + (res.reason || ''))); rerenderPanel(); };
    r.onerror = function () { alertSafe('读取图片失败，换一张试试'); };
    r.readAsDataURL(f);
  } catch (e) { alertSafe('当前环境不支持读取文件'); }
}
function _onSoundFile(input) {
  try {
    var f = input && input.files && input.files[0];
    if (!f) { alertSafe('没有选到文件'); return; }
    if (f.size > 2000000) { alertSafe('音频太大了（超过约 2MB），换一段短一点的吧'); return; }
    var r = new FileReader();
    r.onload = function () { var res = setFocusSound(String(r.result), f.name); alertSafe(res.ok ? '提示音已换成上传的音频' : ('换提示音失败：' + (res.reason || ''))); rerenderPanel(); };
    r.onerror = function () { alertSafe('读取音频失败，换一段试试'); };
    r.readAsDataURL(f);
  } catch (e) { alertSafe('当前环境不支持读取文件'); }
}
function _onCustomSkinFile(input) {
  try {
    var f = input && input.files && input.files[0];
    if (!f) { alertSafe('没有选到文件'); return; }
    if (f.size > 1500000) { alertSafe('图片太大了（超过约 1.5MB），换一张小一点的吧'); return; }
    var r = new FileReader();
    r.onload = function () { var res = setCustomSkin(String(r.result)); alertSafe(res.ok ? '抠图立绘已换好' : ('换立绘失败：' + (res.reason || ''))); syncSettingsUI(); };
    r.onerror = function () { alertSafe('读取图片失败，换一张试试'); };
    r.readAsDataURL(f);
  } catch (e) { alertSafe('当前环境不支持读取文件'); }
}

/* ── 12. 初始化：包钩子 + 事件委托 + 覆盖层守望 ── */
var _abInitDone = false;
var _abTickTimer = null;
function wrapFocus() {
  try {
    var G = window.GroupN;
    if (!G || G.__abWrapped) return;
    if (typeof G.focusEnd === 'function') {
      var origEnd = G.focusEnd;
      G.focusEnd = function (nowMs, done) {
        var r = origEnd.apply(this, arguments);
        try { if (r) onFocusEnd(r, done); } catch (e) {}
        return r;
      };
    }
    if (typeof G.focusStart === 'function') {
      var origStart = G.focusStart;
      G.focusStart = function (minutes, nowMs) {
        var r = origStart.apply(this, arguments);
        try { if (r) onFocusStart(); } catch (e) {}
        return r;
      };
    }
    G.__abWrapped = true;
  } catch (e) {}
}
function bindPetEl() {
  var el = petEl();
  if (!el || el._abBound) return;
  el._abBound = true;
  el.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#gm-pet-bubble')) return;
    pokeFlash();
  });
  el.addEventListener('dblclick', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#gm-pet-bubble')) return;
    cycleMode();
  });
}
function abInit() {
  if (_abInitDone) return;
  _abInitDone = true;
  try { if (window.GroupM && GroupM.pet && GroupM.pet.build) GroupM.pet.build(); } catch (e) {}
  var stored = loadPet();
  _eye = { dx: (stored.eye && stored.eye.dx) || 0, dy: (stored.eye && stored.eye.dy) || 0, side: (stored.eye && stored.eye.side) || 'right' };
  wrapFocus();
  bindPetEl();
  document.addEventListener('pointerdown', function (e) {
    try { lookAt(e.clientX, e.clientY, window.innerWidth, window.innerHeight, true); } catch (err) {}
    try { noteActivity(); } catch (err) {}
  }, true);
  document.addEventListener('pointermove', function (e) {
    try { lookAt(e.clientX, e.clientY, window.innerWidth, window.innerHeight, false); } catch (err) {}
  });
  document.addEventListener('keydown', function () { try { noteActivity(); } catch (e) {} });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var jump = t.closest('#gm-ab-jump');
    if (jump) { var b0 = loadPet().bubble; if (b0.target) goTo(b0.target); return; }
    var btxt = t.closest('#gm-pet-bubble-text');
    if (btxt) { var b1 = loadPet().bubble; if (b1.target) goTo(b1.target); return; }
    var modeBtn = t.closest('#gm-ab-mode');
    if (modeBtn) { cycleMode(); return; }
    var skinBtn = t.closest('[data-ab-skin]');
    if (skinBtn) { var sr = setSkin(skinBtn.getAttribute('data-ab-skin')); if (!sr.ok) alertSafe(sr.hint || ('换皮肤失败：' + sr.reason)); syncSettingsUI(); return; }
    var patBtn = t.closest('[data-ab-pattern]');
    if (patBtn) { setPattern(patBtn.getAttribute('data-ab-pattern')); syncSettingsUI(); return; }
    var colBtn = t.closest('[data-ab-collapse]');
    if (colBtn) { if (loadPet().collapsed) expandPet(); else collapsePet(); syncSettingsUI(); return; }
    var cycBtn = t.closest('[data-ab-mode-cycle]');
    if (cycBtn) { cycleMode(); syncSettingsUI(); return; }
    var rstBtn = t.closest('[data-ab-reset]');
    if (rstBtn) { petReset(); syncSettingsUI(); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-ab-set');
    if (k) {
      if (k === 'speed') setSettings({ speed: parseFloat(t.value) });
      else if (k === 'activity') setSettings({ activity: parseFloat(t.value) });
      else if (k === 'follow') setSettings({ follow: !!t.checked });
      var row = t.closest ? t.closest('.ab-set-row') : null;
      var val = row ? row.querySelector('.ab-set-val') : null;
      if (val) val.textContent = k === 'speed' ? (t.value + '×') : (k === 'follow' ? (t.checked ? '开' : '关') : t.value);
      return;
    }
    var c = t.getAttribute('data-ab-color');
    if (c) {
      var cur = effectiveColors();
      if (c === 'hair') setColor(t.value, cur.eye);
      else setColor(cur.hair, t.value);
    }
  });
  try {
    if (typeof MutationObserver !== 'undefined') {
      var el = petEl();
      if (el) {
        var ob = new MutationObserver(function () { setTimeout(function () { try { refreshOverlay(); } catch (e) {} }, 50); });
        ob.observe(el, { childList: true, subtree: true });
      }
    }
  } catch (e) {}
  refreshMood();
  refreshOverlay();
  _abTickTimer = setInterval(function () { try { petTick(); } catch (e) {} }, 1000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', abInit);
else abInit();

window.GroupAB = {
  version: 'GroupAB-v1',
  MOODS: MOODS, MOOD_CN: MOOD_CN, MOOD_EMOJI: MOOD_EMOJI,
  SEMANTIC_MAP: SEMANTIC, MODES: MODES, SKINS: SKINS, PATTERNS: PATTERNS, BUBBLES: BUBBLES,
  COINS_PER_MIN: COINS_PER_MIN,
  pet: {
    state: petState, load: loadPet, save: savePet, reload: function () { refreshOverlay(); return petState(); },
    moodNow: moodNow, moodFor: moodFor, refreshMood: refreshMood,
    setPersistent: setPersistent, setOneshot: setOneshot, clearOneshot: clearOneshot,
    tick: petTick, setSemantic: setSemantic,
    cycleMode: cycleMode, setMode: setMode, modeLabel: modeLabel,
    setSkin: setSkin, setCustomSkin: setCustomSkin, setPattern: setPattern, setColor: setColor,
    setSettings: setSettings, reset: petReset,
    collapse: collapsePet, expand: expandPet,
    pokeFlash: pokeFlash, noteActivity: noteActivity, idleCheck: idleCheck,
    lookAt: lookAt, applyEyes: applyEyes, applySkin: applySkin, refreshOverlay: refreshOverlay,
    showBubble: showBubble, pickBubble: pickBubble, goTo: goTo
  },
  focus: {
    plan: focusPlan, load: loadFocus, save: saveFocus,
    setPlan: setPlan, dailyCount: dailyCount,
    onFocusStart: onFocusStart, onFocusEnd: onFocusEnd,
    startBreak: startBreak, endBreak: endBreak, breakState: breakState,
    catState: catState, sendStretch: sendStretch,
    setFocusBg: setFocusBg, clearFocusBg: clearFocusBg,
    setFocusSound: setFocusSound, clearFocusSound: clearFocusSound,
    setSoundChoice: setSoundChoice, playChime: playChime,
    setReserveGoal: setReserveGoal, clearReserveGoal: clearReserveGoal, reserveStatus: reserveStatus,
    focusPanelHTML: focusPanelHTML
  },
  renderPetSettingsHTML: renderPetSettingsHTML,
  focusPanelHTML: focusPanelHTML,
  focusPlanDelta: function (d) { var fp = loadFocus(); setPlan((fp.planned || 4) + d); rerenderPanel(); return loadFocus().planned; },
  focusStartBreak: function (kind) { var r = startBreak(kind); rerenderPanel(); return r; },
  focusEndBreak: function () { var r = endBreak(); rerenderPanel(); return r; },
  focusSetSoundChoice: function (c) { var r = setSoundChoice(c); if (!r.ok) alertSafe(r.hint || ('切换失败：' + r.reason)); rerenderPanel(); return r; },
  focusPlayChime: function () { return playChime(); },
  focusClearBg: function () { clearFocusBg(); rerenderPanel(); return { ok: true }; },
  focusClearSound: function () { clearFocusSound(); rerenderPanel(); return { ok: true }; },
  focusSetGoal: function () {
    var nEl = document.getElementById('ab-goal-name');
    var tEl = document.getElementById('ab-goal-target');
    var r = setReserveGoal(nEl ? nEl.value : '', tEl ? tEl.value : '');
    if (!r.ok) alertSafe('设目标失败：' + (r.reason === 'no-name' ? '先写个目标名字' : '金币数要在 1–10000 之间'));
    rerenderPanel();
    return r;
  },
  focusClearGoal: function () { clearReserveGoal(); rerenderPanel(); return { ok: true }; },
  _onBgFile: _onBgFile, _onSoundFile: _onSoundFile, _onCustomSkinFile: _onCustomSkinFile,
  _keys: { pet: PET_KEY, focus: FOCUS_KEY }
};
})();
