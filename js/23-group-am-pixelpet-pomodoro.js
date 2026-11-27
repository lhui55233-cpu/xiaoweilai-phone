
// ══════════════════════════════════════════════════════════════════════
// AM组 · 第二批借鉴（GROUP-AM-PIXELPET-POMODORO）
// 出处只借做法，代码全部原创，未复制 pixel-pet / avocadoro / cute-Pomodoro /
// notion-widget / murmur / pixelpets / desksprite 任何项目的代码。
// 许可：MIT 的 pixel-pet、avocadoro、murmur、pixelpets；未注明许可证的
// cute-Pomodoro、notion-widget 只借玩法与结构；Calender 未验证（仓库 404、
// 演示站打不开，用户已说“打不开不要了”），本组不写任何关于它的猜测。
// 动作节制：遵循“没有全局常开动画、只在交互时动”的动效原则——
//   地形行走与季节天气只在桌面可见且未开启 prefers-reduced-motion 时跑，
//   且天气可一键关；抚摸/拖拽/打字/滚动反应只在交互发生时触发一次。
// 隐私：打字/滚动反应只用“有输入/滚动”这一事件（事件类型 + 目标元素标签），
//   从不读输入框内容、消息文本或书本正文；阅读小互动用的词来自固定装饰词表。
// ══════════════════════════════════════════════════════════════════════
(function () {
'use strict';
/* ── 0. 工具 ── */
var PET_KEY = 'groupam_pet_v1';
var FOCUS_KEY = 'groupam_focus_v1';
var FOCUS_MD_KEY = 'groupam_focus_log_md_v1';
var WCFG_KEY = 'groupam_widget_cfg_v1';
var COINS_KEY = 'otome_coins_v1';
var FLOG_KEY = 'focus_log_v1';
var FSTATE_KEY = 'focus_state_v1';
var MEMO_KEY = 'phone_memo_v1';
var SCHED_KEY = 'phone_schedule_v1';
var WIDGETS_KEY = 'phone_widgets_v1';
var DESKW_KEY = 'desktop_widgets_v2';
function rd(k, fb) { try { var v = localStorage.getItem(k); if (v == null) return fb; return JSON.parse(v); } catch (e) { return fb; } }
function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function rdStr(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : v; } catch (e) { return fb; } }
function wrStr(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dayStrFull(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function reduceMotion() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function isDarkNow() { try { if (document.querySelector('.wx-dark-mode')) return true; } catch (e) {} try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }
function petEl() { return document.getElementById('desk-pet'); }
function charEl() { var p = petEl(); return p ? p.querySelector('.gm-pet-char') : null; }

/* ── 1. 皮肤注册表（avocadoro 皮肤注册表 + pixel-pet 调色板换肤做法；自写）──
   一份定义共用三处：桌宠像素画、番茄小浮窗的猫、设置页的皮肤圆点。
   AB 组皮肤注册表未合入本版文件，AM 自备这份；AB 合入后以 AB 为准、AM 可改接。 */
var SKINS = {
  qqboy: { name: 'QQ boy', idle: 'sway', idleDesc: '轻轻摇晃、眨眼',
    palette: { main: '#3a2a1e', face: '#ffe3c4', eye: '#2b2b2b', body: '#7aa8c9', accent: '#c87a5a' },
    pixels: ['..HHHHHHHH..', '.HHHHHHHHHH.', '.HHFFFFFFHH.', '.HFEFFFFEFH.', '.HFFFFFFFFH.', '.HFFPPPPFFH.', '..FFFFFFFF..', '...BBBBBB...', '..BBBBBBBB..', '............'] },
  cat: { name: '猫', idle: 'loaf', idleDesc: '团成一团、尾巴轻摆',
    palette: { main: '#e8a04c', face: '#e8a04c', eye: '#2b2b2b', body: '#e8a04c', accent: '#e8a04c' },
    pixels: ['..H......H..', '..HH....HH..', '..HHHHHHHH..', '..HEHHHHEH..', '..HHHHHHHH..', '...HHPPHH...', '..HHHHHHHH..', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '............'] },
  dog: { name: '狗', idle: 'pant', idleDesc: '耳朵一扇一扇、吐舌头喘气',
    palette: { main: '#8a6a4f', face: '#c9a186', eye: '#2b2b2b', body: '#8a6a4f', accent: '#8a6a4f' },
    pixels: ['..H......H..', '.HHH....HHH.', '.HHHHHHHHHH.', '.HEHHHHHHEH.', '.HHHHHHHHHH.', '..HHHPPHHH..', '...HHHHHH...', '..HHHHHHHH..', '.HHHHHHHHHH.', '............'] }
};
function skinPalette(id) { var s = SKINS[id] || SKINS.qqboy; return { main: s.palette.main, face: s.palette.face, eye: s.palette.eye, body: s.palette.body, accent: s.palette.accent, name: s.name }; }
function pixelHtml(skinId, mood) {
  var s = SKINS[skinId] || SKINS.qqboy;
  var pal = s.palette;
  var colorOf = function (ch) {
    if (ch === 'H') return pal.main; if (ch === 'F') return pal.face;
    if (ch === 'E') return pal.eye; if (ch === 'P') return '#ffb3a0';
    if (ch === 'B') return pal.body; return '';
  };
  var cells = '';
  s.pixels.forEach(function (row) {
    for (var i = 0; i < row.length; i++) {
      var c = colorOf(row[i]);
      cells += c ? '<i style="background:' + c + ';"></i>' : '<i></i>';
    }
  });
  return '<div class="am-pixel am-idle-' + s.idle + (mood ? ' am-mood-' + mood : '') + '" data-am-skin="' + skinId + '" title="' + esc(s.name) + ' · ' + esc(s.idleDesc) + '">' + cells + '</div>';
}

/* ── 2. 时段基调表（murmur 时段基调做法；自写）──
   七档：早晨/上午/午休/下午/傍晚/深夜/周末。char 台词、日记语气、此刻光线氛围共用这一张表。 */
var TONE_SLOTS = [
  { id: 'morning', label: '早晨', hours: [6, 9], char: ['早上好呀，今天也要一起加油。', '早安，昨晚我梦见你了。'], diary: '轻快、带着刚醒的暖意，多写光和早餐。', light: 'linear-gradient(180deg,#fdf6ec,#fbeed3)' },
  { id: 'forenoon', label: '上午', hours: [9, 12], char: ['上午的风很温柔，适合慢慢来。', '先做一件小事，剩下的也可以晚一点。'], diary: '平稳、专注，多写正在做的事。', light: 'linear-gradient(180deg,#ffffff,#f7f7f8)' },
  { id: 'lunch', label: '午休', hours: [12, 14], char: ['吃点好吃的，歇一会儿也没关系。', '午休时间，猫也团成一团了。'], diary: '松弛、慵懒，多写饭和困意。', light: 'linear-gradient(180deg,#fff8e7,#fdeecd)' },
  { id: 'afternoon', label: '下午', hours: [14, 17], char: ['下午茶时间，要不要一起读一页？', '阳光正好，适合出门走走。'], diary: '明亮、舒展，多写窗外和散步。', light: 'linear-gradient(180deg,#fffdf4,#fdf0d5)' },
  { id: 'evening', label: '傍晚', hours: [17, 20], char: ['晚饭想吃什么？也可以随便吃点。', '天快黑了，今天过得怎么样？'], diary: '温和、收束，多写晚饭和今天的小事。', light: 'linear-gradient(180deg,#fdeeda,#f6d9b8)' },
  { id: 'night', label: '深夜', hours: [20, 23], char: ['夜深了，早点睡，我守着你。', '今天辛苦啦，剩下的明天再说也没关系。'], diary: '安静、放轻，多写灯和晚安。', light: 'linear-gradient(180deg,#2b2b3a,#1e1e28)' },
  { id: 'late', label: '深夜', hours: [23, 24], char: ['这么晚还没睡？陪你一会儿就去睡，好不好？', '嘘……轻一点，猫睡着了。'], diary: '极轻、克制，只写一两句。', light: 'linear-gradient(180deg,#23232e,#181820)' },
  { id: 'late', label: '深夜', hours: [0, 6], char: ['这么晚还没睡？陪你一会儿就去睡，好不好？', '嘘……轻一点，猫睡着了。'], diary: '极轻、克制，只写一两句。', light: 'linear-gradient(180deg,#23232e,#181820)' }
];
var WEEKEND_TONE = { id: 'weekend', label: '周末', char: ['周末呀，不做什么也可以。', '今天没有安排，陪你发会儿呆。'], diary: '松散、不用赶时间，多写“没做什么也很好”。', light: 'linear-gradient(180deg,#fdf6ec,#f3e3c8)' };
function toneFor(d) {
  d = d || new Date();
  var h = d.getHours(); var dow = d.getDay();
  if ((dow === 0 || dow === 6) && h >= 6 && h < 20) return WEEKEND_TONE;
  for (var i = 0; i < TONE_SLOTS.length; i++) {
    var s = TONE_SLOTS[i];
    if (h >= s.hours[0] && h < s.hours[1]) return s;
  }
  return TONE_SLOTS[0];
}
function applyTone() {
  try {
    var t = toneFor(new Date());
    document.documentElement.setAttribute('data-am-tone', t.id);
    document.documentElement.style.setProperty('--am-cike-light', t.light);
  } catch (e) {}
}
/* ── 文案语气规范（murmur 做法；自写）── */
var TONE_RULES = [
  '多用“也可以、没关系”，不用“你应该”。',
  '对方说累 / 焦虑 / 孤独时，先接住情绪，再给选择，不催、不评判。',
  '不把关心变成任务：不打卡、不计分、不追问“做到了吗”。',
  '一次只说一句，短一点，留白一点。'
];
function systemPromptTone() {
  return '语气规范（接模型后请追加进 system prompt）：说话多用“也可以、没关系”，不要说“你应该”；对方表达疲惫、焦虑或孤独时，先接住情绪再给选择，不催促、不评判、不开药方、不布置打卡任务；一次只说一句，保持简短。AG 组接模型未合入本版文件，本条目先存在这里，待 AG 合入后由接模型处引用。';
}
/* ── 3. “动作 → 反应”对照表（pixel-pet + desksprite + avocadoro 做法；自写）──
   四种心情 sleepy / calm / playful / zoomies，由最近互动推导（avocadoro 两层状态机思路）。 */
var REACTIONS = {
  pet: { sleepy: '……唔，被摸了，好困……', calm: '呼噜……他很喜欢这样。', playful: '嘿嘿，再摸摸，耳朵都竖起来了。', zoomies: '哈哈，摸得我都想跑两圈了！' },
  purr: { sleepy: '呼噜……（声音越来越轻）', calm: '呼噜……呼噜……', playful: '呼噜！呼噜！', zoomies: '呼噜呼噜，停不下来啦！' },
  drag: { sleepy: '……别拎我，困……', calm: '被拎起来啦……轻轻放下哦。', playful: '哇，飞起来了！', zoomies: '放我下来，我要自己跑！' },
  drop: { sleepy: '……落脚了，继续睡。', calm: '稳稳落脚，好啦。', playful: '落脚！再来一次！', zoomies: '落脚就跑，追不上我！' },
  type: { sleepy: '（半梦半醒地揉了揉键盘）', calm: '在旁边轻轻揉键盘，陪你打字。', playful: '打字声好好听，爪子也想来两下。', zoomies: '你打字好快！我都跟不上了！' },
  scroll: { sleepy: '……叶子飘过去了，好困。', calm: '扑了一下飘落的叶子。', playful: '扑叶子！又扑到一片！', zoomies: '叶子、叶子，全都扑下来！' },
  idle: { sleepy: 'Z z……（已经睡着了）', calm: '（打了个小盹）', playful: '（等你等得团成了一个球）', zoomies: '（等太久了，自己跑去玩了）' },
  cinema_pause: { sleepy: '他放下爆米花，声音放得很轻：要歇一会儿吗？', calm: '他放下爆米花：歇一会儿，猫也抬起头看你。', playful: '暂停啦！他放下爆米花，趁机捏了捏猫的耳朵。', zoomies: '暂停！他放下爆米花，立刻站起来伸了个大大的懒腰。' },
  cinema_scene: { sleepy: '下一幕了，他往你这边靠了靠，声音还是轻轻的。', calm: '下一幕了，他往你这边挪了挪，猫换了个姿势继续看。', playful: '下一幕！他眼睛都亮了，猫也坐直了。', zoomies: '下一幕！他差点从座位上蹦起来。' }
};
var _acts = [];
function moodFor(nowMs) {
  var h = new Date(nowMs || Date.now()).getHours();
  if (h >= 22 || h < 6) return 'sleepy';
  var now = nowMs || Date.now();
  var recent = _acts.filter(function (t) { return now - t < 10 * 60000; }).length;
  if (recent >= 3) return 'zoomies';
  if (recent >= 1) return 'playful';
  return 'calm';
}
function reactTo(action, nowMs) {
  var mood = moodFor(nowMs);
  _acts.push(nowMs || Date.now());
  if (_acts.length > 40) _acts = _acts.slice(-40);
  var table = REACTIONS[action] || REACTIONS.pet;
  return { action: action, mood: mood, text: table[mood] || table.calm };
}
function showPetBubble(text, ms) {
  var p = petEl(); if (!p) return false;
  var b = p.querySelector('#gm-pet-bubble'); var t = p.querySelector('#gm-pet-bubble-text');
  if (b && t) {
    t.textContent = text; b.style.display = 'block';
    clearTimeout(showPetBubble._t);
    showPetBubble._t = setTimeout(function () { b.style.display = 'none'; }, ms || 4000);
    return true;
  }
  var old = document.getElementById('am-pet-bubble'); if (old) old.remove();
  var d = document.createElement('div'); d.id = 'am-pet-bubble'; d.textContent = text;
  var r = p.getBoundingClientRect();
  d.style.left = Math.max(8, Math.min((window.innerWidth || 390) - 168, (r.left || 20) - 40)) + 'px'; d.style.top = Math.max(8, Math.min((window.innerHeight || 700) - 120, (r.top || 200) - 56)) + 'px'; /* GROUP-FIX2: 备用气泡夹在屏内 */
  document.body.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, ms || 4000);
  return true;
}

/* ── 4. 桌宠行为模块（同一套钩子，各模块独立；M 组 #desk-pet 之上叠加，不另起角色）── */
var Hooks = { _m: {}, on: function (ev, fn) { (this._m[ev] = this._m[ev] || []).push(fn); }, emit: function (ev, data) { (this._m[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) {} }); } };
var _pet = { lastInteract: Date.now(), walking: false, sitting: false, dozeShown: false, pressTimer: null, pressStart: 0, pressMoved: false, pressX: 0, pressY: 0, lpTimer: null, bound: false };
function petSettings() { var s = rd(PET_KEY, null) || {}; if (!s.skin) s.skin = 'qqboy'; if (!s.weather) s.weather = { enabled: true, kind: 'auto' }; return s; }
function savePetSettings(s) { return wr(PET_KEY, s); }
function applySkin(id) {
  if (!SKINS[id]) id = 'qqboy';
  var s = petSettings(); s.skin = id; savePetSettings(s);
  var c = charEl(); var p = petEl();
  if (!c || !p) return { ok: false, skin: id };
  if (id === 'qqboy') {
    try { if (window.GM && window.GM.pet && window.GM.pet.build) window.GM.pet.build(); } catch (e) {}
    var old = p.querySelector('.am-pixel'); if (old && !p.querySelector('.gm-pet-char svg')) { try { if (window.GM && window.GM.pet && window.GM.pet.build) window.GM.pet.build(); } catch (e2) {} }
    return { ok: true, skin: id, via: 'gm' };
  }
  c.innerHTML = pixelHtml(id, moodFor(Date.now()));
  c.classList.add('gm-pet-char');
  return { ok: true, skin: id, via: 'am-pixel' };
}
function ensureSkin() {
  var s = petSettings();
  if (s.skin && s.skin !== 'qqboy') {
    var p = petEl(); if (!p) return;
    if (!p.querySelector('.am-pixel')) applySkin(s.skin);
  }
}
/* 4a. 季节小天气（pixelpets 季节微天气做法；自写。AM 自备宠物周围开关） */
function weatherKind(d) {
  var s = petSettings();
  if (s.weather && s.weather.kind && s.weather.kind !== 'auto') return s.weather.kind;
  var m = (d || new Date()).getMonth();
  if (m === 11 || m === 0 || m === 1) return 'snow';
  if (m >= 2 && m <= 4) return 'petals';
  if (m >= 5 && m <= 7) return 'fireflies';
  return 'leaves';
}
var WEATHER_ICON = { snow: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/></svg>', petals: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c-4.5-1-5.3-4.2-3.2-5.3 1.5-.8 3.1.4 3.2 3.3.1-2.9 1.7-4.1 3.2-3.3 2.1 1.1 1.3 4.3-3.2 5.3 4.5-1 6.2 1.8 4.3 3.5-1.3 1.2-3.2.4-4.3-2.4 1.1 2.8.2 4.6-1.6 4.4-2.4-.2-3-3.4 1.6-6.2-4.6 2.8-7.1.7-5.8-1.5 1-1.6 3-.9 5.8 1.5Z"/><circle cx="12" cy="12" r="2"/></svg>', leaves: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 19C5.5 10 11 4.5 19.5 4.5c0 8.5-5.5 14-14 14.5Z"/><path d="M5.5 19c2.5-5 6-8.5 10-10.5"/></svg>', fireflies: '<svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>' };
function weatherEnabled() { var s = petSettings(); return !!(s.weather && s.weather.enabled); }
function setWeather(enabled, kind) {
  var s = petSettings();
  s.weather = { enabled: !!enabled, kind: kind || (s.weather && s.weather.kind) || 'auto' };
  savePetSettings(s); renderWeather();
  return { ok: true, enabled: s.weather.enabled, kind: s.weather.kind };
}
function renderWeather() {
  var p = petEl(); if (!p) return false;
  var old = p.querySelector('.am-weather'); if (old) old.remove();
  if (!weatherEnabled() || reduceMotion()) return false;
  var kind = weatherKind(new Date());
  var box = document.createElement('div'); box.className = 'am-weather'; box.setAttribute('data-am-weather', kind);
  var parts = '';
  for (var i = 0; i < 6; i++) {
    var left = 4 + i * 15 + (i % 2) * 6;
    var delay = (i * 0.9).toFixed(1);
    var cls = kind === 'fireflies' ? 'am-w-fireflies' : '';
    parts += '<i class="' + cls + '" style="left:' + left + '%;animation-delay:' + delay + 's;">' + WEATHER_ICON[kind] + '</i>';
  }
  box.innerHTML = parts;
  p.appendChild(box);
  return true;
}
/* 4b. “页面即地形”（desksprite 地形行走做法；自写。行走时 pointer-events:none，绝不遮挡图标点按） */
function terrainIcons() {
  var nodes = document.querySelectorAll('#sys-desktop-layer .sys-app-grid > *, #sys-desktop-layer [data-app], #sys-desktop-layer .sys-app');
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var label = '';
    try { label = (el.getAttribute('data-app') || el.getAttribute('data-name') || (el.textContent || '').trim().slice(0, 8) || ('图标' + (i + 1))); } catch (e) { label = '图标' + (i + 1); }
    out.push({ el: el, label: label, index: i });
  }
  return out;
}
function terrainStep(nowMs) {
  var p = petEl(); if (!p) return { ok: false, reason: 'no-pet' };
  if (reduceMotion()) return { ok: false, reason: 'reduced-motion' };
  var icons = terrainIcons();
  if (!icons.length) return { ok: false, reason: 'no-icons' };
  var pick = icons[Math.floor(Math.random() * icons.length)];
  /* 位移以宠物当前位置为原点（相对位移），避免把绝对坐标错当成 transform。 */
  var dx = 0, dy = 0;
  try {
    var pr = p.getBoundingClientRect(); var ir = pick.el.getBoundingClientRect();
    if (ir.width > 0 && pr.width > 0) {
      dx = (ir.left + ir.width / 2) - (pr.left + pr.width / 2);
      dy = (ir.top + ir.height / 2) - (pr.top + pr.height / 2);
    } else {
      dx = (pick.index % 4) * 40 - 60; dy = Math.floor(pick.index / 4) * 30 - 30;
    }
  } catch (e) { dx = 20; dy = 0; }
  dx = clamp(dx, -260, 260); dy = clamp(dy, -260, 260);
  _pet.walking = true;
  p.classList.add('am-walking');
  var c = charEl();
  if (c) c.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
  var sitting = Math.random() < 0.3;
  _pet.sitting = sitting;
  p.classList.toggle('am-sitting', sitting);
  Hooks.emit('pet-terrain', { icon: pick.label, index: pick.index, sitting: sitting });
  setTimeout(function () { _pet.walking = false; p.classList.remove('am-walking'); }, 900);
  return { ok: true, icon: pick.label, index: pick.index, dx: Math.round(dx), dy: Math.round(dy), sitting: sitting };
}
function setWalking(on) {
  var p = petEl(); if (!p) return false;
  _pet.walking = !!on;
  p.classList.toggle('am-walking', !!on);
  var c = charEl(); if (c) c.style.pointerEvents = ''; /* GROUP-PET: 走路时也不禁点（原 on ? 'none' : '' 已删） */
  return _pet.walking;
}
/* 4c. 细腻手势：抚摸进度、拎起挣扎/放松、久不理打瞌睡、深夜小灯 */
function bindPet() {
  var p = petEl(); if (!p || _pet.bound) return false;
  var c = charEl(); if (!c) return false;
  _pet.bound = true;
  var noteInteract = function () { _pet.lastInteract = Date.now(); _pet.dozeShown = false; };
  p.addEventListener('pointerdown', function (e) {
    noteInteract();
    _pet.pressStart = Date.now(); _pet.pressMoved = false;
    _pet.pressX = e.clientX || 0; _pet.pressY = e.clientY || 0;
    if (c) c.classList.add('am-petting');
    clearTimeout(_pet.lpTimer);
    _pet.lpTimer = setTimeout(function () { try { openSettings('pet'); } catch (err) {} }, 800);
  });
  p.addEventListener('pointermove', function (e) {
    if (!_pet.pressStart) return;
    var dx = (e.clientX || 0) - _pet.pressX, dy = (e.clientY || 0) - _pet.pressY;
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
      _pet.pressMoved = true;
      if (c) { c.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scaleY(1.12) scaleX(.92)'; }
    }
  });
  var endPress = function (e) {
    clearTimeout(_pet.lpTimer);
    if (!_pet.pressStart) return;
    var held = Date.now() - _pet.pressStart;
    _pet.pressStart = 0;
    if (c) { c.classList.remove('am-petting'); c.style.transform = ''; }
    if (_pet.pressMoved) {
      var r = reactTo('drop'); showPetBubble(r.text); Hooks.emit('pet-action', r);
      try { if (window.GM && window.GM.pet && window.GM.pet.tick) window.GM.pet.tick(); } catch (err) {}
      return;
    }
    if (held >= 600) { var rp = reactTo('purr'); showPetBubble(rp.text); Hooks.emit('pet-action', rp); }
  };
  p.addEventListener('pointerup', endPress);
  p.addEventListener('pointercancel', endPress);
  p.addEventListener('contextmenu', function (e) { try { e.preventDefault(); } catch (err) {} noteInteract(); try { openSettings('pet'); } catch (err2) {} });
  p.addEventListener('mouseenter', function () {
    noteInteract();
    setTimeout(function () {
      try {
        if (p.matches(':hover')) { var r = reactTo('pet'); showPetBubble(r.text, 2500); Hooks.emit('pet-action', r); }
      } catch (err) {}
    }, 800);
  });
  /* 打字揉键盘 / 阅读滚动扑叶子：只用事件本身（类型 + 目标标签），从不读内容。 */
  var lastType = 0, lastScroll = 0;
  document.addEventListener('input', function (e) {
    try {
      var t = e.target; if (!t) return;
      var tag = (t.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
      var inWx = false;
      try { inWx = !!(t.closest && t.closest('[data-app-sandbox="wechat"]')); } catch (err) {}
      if (!inWx) return;
      var now = Date.now(); if (now - lastType < 10000) return; lastType = now;
      noteInteract();
      var r = reactTo('type'); Hooks.emit('pet-action', r);
      if (c) { c.classList.add('am-knead'); setTimeout(function () { c.classList.remove('am-knead'); }, 1300); }
    } catch (err) {}
  }, true);
  document.addEventListener('scroll', function (e) {
    try {
      var t = e.target; if (!t || !t.closest) return;
      if (!t.closest('#novel-reader-view')) return;
      var now = Date.now(); if (now - lastScroll < 15000) return; lastScroll = now;
      noteInteract();
      var r = reactTo('scroll'); Hooks.emit('pet-action', r);
      if (c) { c.classList.add('am-pounce'); setTimeout(function () { c.classList.remove('am-pounce'); }, 900); }
    } catch (err) {}
  }, true);
  /* 久不理打瞌睡 + 深夜小灯：每 30 秒检查一次，只在交互空闲时触发。 */
  setInterval(function () {
    try {
      var idle = Date.now() - _pet.lastInteract;
      if (idle > 90000 && !_pet.dozeShown) {
        _pet.dozeShown = true;
        p.classList.add('am-dozy');
        var r = reactTo('idle'); showPetBubble(r.text, 5000); Hooks.emit('pet-action', r);
        setTimeout(function () { p.classList.remove('am-dozy'); }, 6000);
      }
      var h = new Date().getHours();
      var dark = (h >= 22 || h < 6) || isDarkNow();
      p.classList.toggle('am-lamp', dark);
    } catch (err) {}
  }, 30000);
  /* 地形行走：桌面可见时每 9 秒走一步；减弱动效时不走。 */
  setInterval(function () {
    try {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (_pet.walking || _pet.pressStart) return;
      terrainStep();
    } catch (err) {}
  }, 9000);
  setInterval(ensureSkin, 5000);
  return true;
}
/* 4d. 提醒：char/猫头顶气泡 + 一声叫（WebAudio 合成提示音），只在应用运行时触发。 */
function remind(text, opts) {
  opts = opts || {};
  var visible = true;
  try { if (document.visibilityState) visible = document.visibilityState === 'visible'; } catch (e) {}
  if (!opts.force && !visible) return { ok: false, reason: 'app-not-running' };
  var ok = showPetBubble(String(text || '该休息一下啦。'), 6000);
  try { chirp(); } catch (e) {}
  Hooks.emit('pet-remind', { text: text });
  return { ok: ok, text: text };
}
var _audio = { ctx: null, nodes: [] };
function audioCtx() {
  if (_audio.ctx) return _audio.ctx;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audio.ctx = new AC();
    return _audio.ctx;
  } catch (e) { return null; }
}
function chirp() {
  var ctx = audioCtx(); if (!ctx) return false;
  try {
    var o = ctx.createOscillator(); var g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
    return true;
  } catch (e) { return false; }
}

/* ── 5. 番茄钟（cute-Pomodoro 玩法；自写。只包 N 组 GroupN，不另起计时器）── */
var _focus = { autoTimer: null, autoState: { scheduled: false, at: 0, minutes: 25 }, lastComfort: '', lastReward: '', wrapped: false };
function focusSettings() { var s = rd(FOCUS_KEY, null) || {}; if (!s.view) s.view = 'elapsed'; if (!s.sound) s.sound = 'off'; s.autoStart = !!s.autoStart; s.miniAlways = !!s.miniAlways; return s; }
function saveFocusSettings(s) { return wr(FOCUS_KEY, s); }
function setFocusView(v) { var s = focusSettings(); s.view = (v === 'remaining') ? 'remaining' : 'elapsed'; saveFocusSettings(s); try { if (window.WeChatAppEngine && window.WeChatAppEngine._otomePanelFocus) window.WeChatAppEngine._otomePanelFocus(); } catch (e) {} return s.view; }
function setFocusSound(v) { var s = focusSettings(); s.sound = (v === 'lofi' || v === 'rain' || v === 'forest') ? v : 'off'; saveFocusSettings(s); if (s.sound === 'off') stopAmbient(); else startAmbient(s.sound); return s.sound; }
function setFocusAutoStart(on) { var s = focusSettings(); s.autoStart = !!on; saveFocusSettings(s); return s.autoStart; }
function focusState() { try { if (window.GroupN && window.GroupN.focusStatus) return window.GroupN.focusStatus(); } catch (e) {} return rd(FSTATE_KEY, null); }
function focusViewText(view, nowMs) {
  var st = focusState();
  var v = view || focusSettings().view;
  if (!st || !st.active) return '还没有开始专注，点一下就开始。';
  var now = nowMs || Date.now();
  var total = Number(st.minutes) || 25;
  if (v === 'remaining') {
    var left = Math.max(0, Math.ceil(((st.until || now) - now) / 60000));
    return '还剩 ' + left + ' 分钟（共 ' + total + ' 分钟）';
  }
  var el = Math.max(0, Math.floor((now - (st.startedAt || now)) / 60000));
  return '已专注 ' + el + ' 分钟（共 ' + total + ' 分钟）';
}
function coinsTotal() {
  var c = rd(COINS_KEY, null);
  if (typeof c === 'number') return c;
  if (c && typeof c === 'object') return Number(c.total || c.coins || c.balance || 0) || 0;
  return 0;
}
function focusWeekStats(nowMs) {
  var log = null;
  try { if (window.GroupN && window.GroupN.focusLog) log = window.GroupN.focusLog(); } catch (e) {}
  if (!log) log = rd(FLOG_KEY, null) || { total: 0, days: {} };
  var days = (log && log.days) || {};
  var out = [];
  var base = new Date(nowMs || Date.now());
  for (var i = 6; i >= 0; i--) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    var k = dayKey(d);
    out.push({ date: k, label: (d.getMonth() + 1) + '/' + d.getDate(), minutes: Number(days[k]) || 0 });
  }
  return out;
}
var COMFORT_LINES = ['没关系，停下来也很好，猫陪你坐一会儿。', '放弃不扣分，刚才那几分钟也算数，记下来了。', '也可以先歇着，等想继续了再来，猫不催你。'];
function focusLogMd() { return rdStr(FOCUS_MD_KEY, ''); }
function appendFocusLog(line) {
  var cur = focusLogMd();
  var next = cur ? (cur.replace(/\n$/, '') + '\n' + line + '\n') : (line + '\n');
  wrStr(FOCUS_MD_KEY, next);
  return next;
}
function recordFocusEnd(done, r) {
  if (!r) return { ok: false };
  var mins = Number(r.minutes) || 0;
  var status = done ? 'completed' : 'abandoned';
  var line = '- ' + dayStrFull(new Date()) + ' · ' + mins + ' 分钟 · ' + status + ' · 累计 ' + (Number(r.total) || 0) + ' 分钟';
  appendFocusLog(line);
  var out = { ok: true, line: line, comfort: '', reward: '' };
  if (!done) {
    var c = COMFORT_LINES[Math.floor(Math.random() * COMFORT_LINES.length)];
    _focus.lastComfort = c; out.comfort = c;
    try { if (window.WeChatAppEngine && window.WeChatAppEngine.otomeCharBubble) window.WeChatAppEngine.otomeCharBubble(c); } catch (e) {}
    try { showPetBubble(c, 6000); } catch (e) {}
  } else {
    if (mins >= 45) {
      _focus.lastReward = '猫送了你一朵小花，记在专注日志里了。';
      out.reward = _focus.lastReward;
      appendFocusLog('- ' + dayStrFull(new Date()) + ' · 奖励 · 长专注满 45 分钟，猫送了一朵小花');
      try { celebrateMini(); } catch (e) {}
    }
    var s = focusSettings();
    if (s.autoStart) {
      _focus.autoState = { scheduled: true, at: Date.now() + 5 * 60000, minutes: 25 };
      clearTimeout(_focus.autoTimer);
      _focus.autoTimer = setTimeout(function () { triggerAutoStart(); }, 5 * 60000);
      out.autoStartAt = _focus.autoState.at;
    }
  }
  try { stopAmbient(); } catch (e) {}
  try { refreshMiniWindow(); } catch (e) {}
  return out;
}
function autoStartState() { return { scheduled: _focus.autoState.scheduled, at: _focus.autoState.at, minutes: _focus.autoState.minutes }; }
function triggerAutoStart() {
  _focus.autoState.scheduled = false;
  clearTimeout(_focus.autoTimer);
  try { if (window.GroupN && window.GroupN.focusStart) { var r = window.GroupN.focusStart(_focus.autoState.minutes || 25, Date.now()); return { ok: !!r, started: r }; } } catch (e) {}
  return { ok: false };
}
function endFocusAbandon() {
  try { if (window.GroupN && window.GroupN.focusEnd) { var r = window.GroupN.focusEnd(Date.now(), false); return { ok: !!r, result: r }; } } catch (e) {}
  return { ok: false };
}
var _abandonTimer = null;
function abandonDown() { clearTimeout(_abandonTimer); _abandonTimer = setTimeout(function () { endFocusAbandon(); }, 700); }
function abandonUp() { clearTimeout(_abandonTimer); }
function wrapFocusEngine() {
  if (_focus.wrapped) return false;
  try {
    if (!window.GroupN || typeof window.GroupN.focusStart !== 'function') return false;
    var _start = window.GroupN.focusStart, _end = window.GroupN.focusEnd;
    window.GroupN.focusStart = function (minutes, nowMs) {
      var r = _start.call(window.GroupN, minutes, nowMs);
      if (r) { try { var s = focusSettings(); if (s.sound !== 'off') startAmbient(s.sound); } catch (e) {} try { refreshMiniWindow(); } catch (e2) {} }
      return r;
    };
    window.GroupN.focusEnd = function (nowMs, done) {
      var r = _end.call(window.GroupN, nowMs, done);
      if (r) recordFocusEnd(done !== false ? true : false, r);
      return r;
    };
    _focus.wrapped = true;
    return true;
  } catch (e) { return false; }
}
/* 环境音：WebAudio 合成（lofi 和弦垫 / 雨声滤波噪声 / 森林噪声 + 鸟鸣），无外部音频文件，界面诚实标注。 */
function startAmbient(kind) {
  var ctx = audioCtx();
  if (!ctx) return { ok: false, reason: 'no-audio', synthesized: true };
  try {
    stopAmbient();
    var g = ctx.createGain(); g.gain.value = 0.12; g.connect(ctx.destination);
    if (kind === 'rain' || kind === 'forest') {
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = kind === 'rain' ? 'lowpass' : 'bandpass'; f.frequency.value = kind === 'rain' ? 900 : 3200;
      src.connect(f); f.connect(g); src.start();
      _audio.nodes = [src, g];
      if (kind === 'forest') {
        _audio.chirpTimer = setInterval(function () {
          try {
            var o = ctx.createOscillator(); var og = ctx.createGain();
            o.type = 'sine'; o.frequency.value = 2400 + Math.random() * 1200;
            og.gain.setValueAtTime(0.05, ctx.currentTime);
            og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            o.connect(og); og.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.3);
          } catch (e) {}
        }, 7000);
      }
    } else {
      var freqs = [220, 277.18, 329.63];
      var oscs = freqs.map(function (fr) {
        var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        var og = ctx.createGain(); og.gain.value = 0.33;
        o.connect(og); og.connect(g); o.start(); return o;
      });
      _audio.nodes = oscs.concat([g]);
    }
    _audio.kind = kind;
    return { ok: true, kind: kind, synthesized: true };
  } catch (e) { return { ok: false, reason: String(e && e.message || e), synthesized: true }; }
}
function stopAmbient() {
  try { if (_audio.chirpTimer) { clearInterval(_audio.chirpTimer); _audio.chirpTimer = null; } } catch (e) {}
  try { _audio.nodes.forEach(function (n) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e2) {} }); } catch (e) {}
  _audio.nodes = []; _audio.kind = 'off';
  return true;
}
function completionChime() {
  var ctx = audioCtx(); if (!ctx) return false;
  try {
    [523.25, 783.99].forEach(function (fr, i) {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      var t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.55);
    });
    return true;
  } catch (e) { return false; }
}
function focusPanelHtml() {
  var st = focusState();
  var s = focusSettings();
  var viewTxt = focusViewText(s.view);
  var total = st && st.active ? (Number(st.minutes) || 25) : 25;
  var elapsed = 0;
  if (st && st.active) elapsed = clamp(Math.floor((Date.now() - (st.startedAt || Date.now())) / 60000), 0, total);
  var prog = total > 0 ? clamp(elapsed / total, 0, 1) : 0;
  var C = 2 * Math.PI * 34;
  var coins = coinsTotal();
  var bright = (0.55 + 0.45 * Math.min(1, coins / 100)).toFixed(2);
  var week = focusWeekStats();
  var maxW = Math.max.apply(null, week.map(function (w) { return w.minutes; }).concat([1]));
  var weekBars = week.map(function (w) {
    return '<i title="' + w.date + ' · ' + w.minutes + ' 分钟" style="height:' + Math.max(4, Math.round(w.minutes / maxW * 40)) + 'px;"></i>';
  }).join('');
  var dark = isDarkNow() ? ' am-dark' : '';
  var h = '<div class="am-focus' + dark + '" id="am-focus-panel"><h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/></svg> 专注 · 果核表盘</h4>'
    + '<div class="am-dial"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="#f0e2d2" stroke-width="7"/>'
    + '<circle cx="42" cy="42" r="34" fill="none" stroke="#c87a5a" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - prog)).toFixed(1) + '" transform="rotate(-90 42 42)"/>'
    + '<text x="42" y="46" text-anchor="middle" font-size="15" font-weight="700" fill="#7a4a28">' + elapsed + '′</text></svg>'
    + '<div>' + pixelHtml('cat', moodFor(Date.now())) + '</div>'
    + '<div style="flex:1;"><div id="am-focus-view" style="font-size:16px;font-weight:700;">' + esc(viewTxt) + '</div>'
    + '<div class="am-muted">圆环是真实的专注进度，猫按心情待在旁边陪你。</div>'
    + '<div class="am-muted"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg> 金币 <span style="filter:brightness(' + bright + ');"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg></span> ' + coins + ' 枚（otome_coins_v1，全机唯一账本，只读；怀里的金币随总数变亮）</div></div></div>'
    + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">'
    + '<button type="button" class="' + (s.view === 'elapsed' ? 'am-on' : '') + '" onclick="window.GroupAM.setFocusView(\'elapsed\')">已专注多久</button>'
    + '<button type="button" class="' + (s.view === 'remaining' ? 'am-on' : '') + '" onclick="window.GroupAM.setFocusView(\'remaining\')">还剩多久</button>'
    + '<select onchange="window.GroupAM.setFocusSound(this.value)" title="环境音（WebAudio 合成，无外部音频）"><option value="off"' + (s.sound === 'off' ? ' selected' : '') + '>环境音：关</option><option value="lofi"' + (s.sound === 'lofi' ? ' selected' : '') + '>lofi</option><option value="rain"' + (s.sound === 'rain' ? ' selected' : '') + '>雨声</option><option value="forest"' + (s.sound === 'forest' ? ' selected' : '') + '>森林</option></select></div>'
    + '<div style="margin-top:8px;"><label><input type="checkbox"' + (s.autoStart ? ' checked' : '') + ' onchange="window.GroupAM.setFocusAutoStart(this.checked)"> 完成 5 分钟后自动开始下一轮</label>'
    + ' <label><input type="checkbox"' + (s.miniAlways ? ' checked' : '') + ' onchange="window.GroupAM.setMiniAlways(this.checked)"> 猫常驻桌面角落小浮窗</label></div>'
    + '<div style="margin-top:8px;"><button type="button" onpointerdown="window.GroupAM.abandonDown()" onpointerup="window.GroupAM.abandonUp()" onpointerleave="window.GroupAM.abandonUp()">长按放弃（不惩罚，只如实记录）</button>'
    + ' <button type="button" onclick="window.GroupAM.exportFocusLog()">导出专注日志 .md</button>'
    + ' <button type="button" onclick="window.GroupAM.openSettings(\'focus\')"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg> 宠物与专注设置</button></div>'
    + '<div style="margin-top:8px;"><div class="am-muted">本周专注（分钟）</div><div class="am-week">' + weekBars + '</div><div class="am-muted">' + week.map(function (w) { return w.label; }).join(' · ') + '</div></div>'
    + '<div class="am-muted" style="margin-top:6px;">长专注满 45 分钟，猫会送一朵小花，记进日志；放弃只记 abandoned，猫会安慰一句，不扣分。</div></div>';
  return h;
}
function exportFocusLog() {
  var md = focusLogMd() || '# 专注日志\n\n（还没有记录，开始一次专注就有了。）\n';
  try {
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '专注日志.md';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} if (a.parentNode) a.parentNode.removeChild(a); }, 800);
    return { ok: true, bytes: md.length };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}
function setMiniAlways(on) { var s = focusSettings(); s.miniAlways = !!on; saveFocusSettings(s); refreshMiniWindow(); return s.miniAlways; }
function toggleMiniWindow() { var s = focusSettings(); return setMiniAlways(!s.miniAlways); }
function miniWindowHtml() {
  var st = focusState();
  var s = focusSettings();
  var txt = focusViewText(s.view);
  var pal = skinPalette('cat');
  return '<div class="am-mini-cat" style="color:' + pal.accent + ';">' + pixelHtml('cat', moodFor(Date.now())) + '</div><div>' + esc(txt) + '</div><div style="font-size:10px;color:#a08a76;">点一下展开完整计时器</div>';
}
function refreshMiniWindow() {
  var el = document.getElementById('am-focus-mini');
  var st = focusState(); var s = focusSettings();
  var show = !!((st && st.active) || s.miniAlways);
  if (!show) { if (el) el.style.display = 'none'; return false; }
  if (!el) {
    el = document.createElement('div'); el.id = 'am-focus-mini';
    el.addEventListener('click', function () { openFocusPanel(); });
    document.body.appendChild(el);
  }
  el.style.display = '';
  el.className = isDarkNow() ? 'am-dark' : '';
  el.innerHTML = miniWindowHtml();
  return true;
}
function celebrateMini() {
  var el = document.getElementById('am-focus-mini');
  if (!el) refreshMiniWindow();
  el = document.getElementById('am-focus-mini');
  if (!el) return false;
  el.classList.add('am-celebrate');
  try { completionChime(); } catch (e) {}
  setTimeout(function () { el.classList.remove('am-celebrate'); }, 2000);
  return true;
}
function openFocusPanel() {
  try {
    if (window.WeChatAppEngine && window.WeChatAppEngine.otomeShowPanel) { window.WeChatAppEngine.otomeShowPanel('focus'); return { ok: true, via: 'otome' }; }
  } catch (e) {}
  openSettings('focus');
  return { ok: true, via: 'am-settings' };
}

/* ── 6. 备忘录与便签小组件（notion-widget 玩法；自写。接 D 组 phone_memo_v1）── */
var MEMO_COLORS = ['#fff8d6', '#ffe9ec', '#e6f4e8', '#e3eefc', '#f1e8fc'];
var MEMO_FONTS = [{ id: 'default', label: '默认' }, { id: 'hand', label: '手写感' }, { id: 'mono', label: '等宽' }];
function memoDefaults() {
  var d = { color: '#fff8d6', fontSize: 15, font: 'default' };
  try { if (window.GroupAM && window.GroupAM._memoPending) Object.assign(d, window.GroupAM._memoPending); } catch (e) {}
  return d;
}
function memoStyle(m) {
  var d = memoDefaults();
  if (!m) return d;
  if (typeof m.color === 'string' && m.color) d.color = m.color;
  if (typeof m.fontSize === 'number' && m.fontSize > 0) d.fontSize = m.fontSize;
  if (typeof m.font === 'string' && m.font) d.font = m.font;
  return d;
}
function memoFontFamily(font) {
  if (font === 'hand') return '"Kaiti SC", "STKaiti", cursive';
  if (font === 'mono') return 'ui-monospace, "SF Mono", monospace';
  return 'inherit';
}
function memoStyleRow(ed) {
  var st = memoStyle(ed || null);
  var colorBtns = MEMO_COLORS.map(function (c) {
    return '<button type="button" data-am-memo-field="color" data-am-memo-value="' + c + '" style="width:22px;height:22px;border-radius:50%;border:' + (st.color === c ? '2px solid #7a4a28' : '1px solid #d8d2cc') + ';background:' + c + ';padding:0;cursor:pointer;" title="' + c + '"></button>';
  }).join('');
  var sizeOpts = [13, 15, 17, 19].map(function (n) { return '<option value="' + n + '"' + (st.fontSize === n ? ' selected' : '') + '>' + n + 'px</option>'; }).join('');
  var fontOpts = MEMO_FONTS.map(function (f) { return '<option value="' + f.id + '"' + (st.font === f.id ? ' selected' : '') + '>' + f.label + '</option>'; }).join('');
  return '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;" id="am-memo-style">'
    + '<span style="font-size:12px;color:#8a8580;">便签颜色</span>' + colorBtns
    + '<span style="font-size:12px;color:#8a8580;">字号</span><select data-am-memo-field="fontSize" style="border:1px solid #e8d5c0;border-radius:8px;padding:4px;">' + sizeOpts + '</select>'
    + '<span style="font-size:12px;color:#8a8580;">字体</span><select data-am-memo-field="font" style="border:1px solid #e8d5c0;border-radius:8px;padding:4px;">' + fontOpts + '</select></div>';
}
function memoCardAttr(it) {
  var st = memoStyle(it || null);
  return ' style="border-left:4px solid ' + esc(st.color) + ';background:' + esc(st.color) + '22;"';
}
function memoTitleSize(it) { return memoStyle(it || null).fontSize; }
function latestMemo() {
  var list = rd(MEMO_KEY, []);
  if (!Array.isArray(list) || !list.length) return null;
  var sorted = list.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  return sorted[0];
}
function stickyHtml(size) {
  var m = latestMemo();
  var st = memoStyle(m || null);
  var cfg = getCfg('sticky');
  var STICKY_HEX = { '米黄': '#fff8d6', '粉': '#ffe9ec', '绿': '#e6f4e8', '蓝': '#e3eefc', '紫': '#f1e8fc' };
  /* 只用用户在配置表里真正存过的 sticky 值；没存过时以备忘录本身的颜色/字号为准，不用配置默认值覆盖。 */
  var savedSticky = {};
  try { var allCfg = rd(WCFG_KEY, {}) || {}; savedSticky = allCfg.sticky || {}; } catch (e) {}
  if (savedSticky.color && STICKY_HEX[savedSticky.color]) st.color = STICKY_HEX[savedSticky.color];
  if (savedSticky.fontSize) st.fontSize = Number(savedSticky.fontSize) || st.fontSize;
  var title = '', body = '', date = '';
  if (m) {
    var lines = String(m.content || '').split('\n').filter(function (x) { return x.trim(); });
    title = lines[0] || '（空备忘）';
    body = String(m.content || '').slice(0, 60);
    try { date = new Date(m.updatedAt || Date.now()).toLocaleDateString(); } catch (e) { date = ''; }
  } else {
    title = '还没有备忘录'; body = '点一下新建第一条，存在本机。';
  }
  var inner = '<div style="font-weight:700;font-size:' + st.fontSize + 'px;font-family:' + memoFontFamily(st.font) + ';">' + esc(title) + '</div>';
  if (size !== 'S') inner += '<div style="font-size:13px;color:#6d6862;margin-top:3px;font-family:' + memoFontFamily(st.font) + ';">' + esc(body) + '</div>';
  if (size === 'L') inner += '<div style="font-size:11px;color:#a08a76;margin-top:4px;">' + esc(date) + ' · 点开进备忘录 · 深色下颜色自适应</div>';
  else if (size === 'M' && date) inner += '<div style="font-size:11px;color:#a08a76;margin-top:4px;">' + esc(date) + '</div>';
  return '<div class="am-sticky" data-am-sticky="1" style="background:' + esc(st.color) + ';font-family:' + memoFontFamily(st.font) + ';" onclick="window.GroupAM.openMemo()">' + inner + '</div>';
}
function openMemo() {
  try {
    var icons = document.querySelectorAll('[data-app="memo"], [data-app-name="memo"]');
    for (var i = 0; i < icons.length; i++) { icons[i].click(); return { ok: true, via: 'icon' }; }
  } catch (e) {}
  try { if (window.AppManager && window.AppManager.open) { window.AppManager.open('memo'); return { ok: true, via: 'AppManager' }; } } catch (e) {}
  try { if (window.GD && window.GD.memoApp) { return { ok: false, reason: 'memo-app-no-opener' }; } } catch (e) {}
  return { ok: false, reason: 'no-memo-opener' };
}

/* ── 7. 小组件清单式配置（notion-widget 清单式配置做法；自写。接 AC 组小组件仓库）──
   AC 的 CATALOG 是闭包内 const，AM 不改它；在商店卡片下方追加这张配置表（锚点注入），
   每档尺寸固定显示哪些字段（widgetFieldsFor），不简单缩放。 */
var WIDGET_CFG = {
  heatmap: { group: '专注', name: '专注热力图', fields: [
    { key: 'showHabit', label: '显示习惯打卡', type: 'bool', def: true },
    { key: 'habitWeight', label: '习惯折算分钟', type: 'number', def: 20, min: 0, max: 60, step: 5, showIf: { field: 'showHabit', value: true } },
    { key: 'days', label: '显示天数', type: 'number', def: 28, min: 7, max: 60, step: 7 },
    { key: 'style', label: '格子样式', type: 'select', def: '方块', options: ['方块', '圆点'] } ] },
  focus: { group: '专注', name: '番茄统计', fields: [
    { key: 'showToday', label: '显示今天', type: 'bool', def: true },
    { key: 'todayLabel', label: '今天的标签', type: 'text', def: '今天', showIf: { field: 'showToday', value: true } },
    { key: 'showTotal', label: '显示累计', type: 'bool', def: true },
    { key: 'font', label: '数字字体', type: 'font', def: '默认', options: ['默认', '大号数字', '等宽'] } ] },
  pet: { group: '家里', name: '宠物状态', fields: [
    { key: 'showMood', label: '显示心情', type: 'bool', def: true },
    { key: 'showName', label: '显示名字', type: 'bool', def: true },
    { key: 'nameText', label: '名字', type: 'text', def: '猫', showIf: { field: 'showName', value: true } } ] },
  game: { group: '一起玩', name: '游戏最高分', fields: [
    { key: 'showFish', label: '显示钓鱼', type: 'bool', def: true },
    { key: 'showDdz', label: '显示斗地主', type: 'bool', def: true } ] },
  read: { group: '阅读', name: '共读统计', fields: [
    { key: 'showBooks', label: '显示书数', type: 'bool', def: true },
    { key: 'showMinutes', label: '显示分钟', type: 'bool', def: true } ] },
  quote: { group: '桌面', name: '今日一句话', fields: [
    { key: 'autoRotate', label: '自动换句', type: 'bool', def: false },
    { key: 'intervalMin', label: '换句间隔（分钟）', type: 'number', def: 60, min: 5, max: 240, step: 5, showIf: { field: 'autoRotate', value: true } },
    { key: 'font', label: '字体', type: 'font', def: '默认', options: ['默认', '手写感', '等宽'] } ] },
  dock: { group: '桌面', name: '底部栏', fields: [
    { key: 'showWeather', label: '显示天气', type: 'bool', def: true },
    { key: 'city', label: '城市', type: 'city', def: '上海', showIf: { field: 'showWeather', value: true } } ] },
  sticky: { group: '桌面', name: '桌面便签', fields: [
    { key: 'color', label: '便签颜色', type: 'select', def: '米黄', options: ['米黄', '粉', '绿', '蓝', '紫'] },
    { key: 'fontSize', label: '字号', type: 'number', def: 15, min: 12, max: 20, step: 1 },
    { key: 'font', label: '字体', type: 'font', def: '默认', options: ['默认', '手写感', '等宽'] },
    { key: 'showDate', label: '显示日期', type: 'bool', def: true } ] },
  focusmini: { group: '专注', name: '番茄小浮窗', fields: [
    { key: 'always', label: '常驻桌面角落', type: 'bool', def: false },
    { key: 'sound', label: '默认环境音', type: 'select', def: '关', options: ['关', 'lofi', '雨声', '森林'] } ] }
};
function cfgDefaults(id) {
  var m = WIDGET_CFG[id]; if (!m) return {};
  var out = {};
  m.fields.forEach(function (f) { out[f.key] = f.def; });
  return out;
}
function getCfg(id) {
  var all = rd(WCFG_KEY, {}) || {};
  var saved = (all && all[id]) || {};
  return Object.assign(cfgDefaults(id), saved);
}
function setCfg(id, key, val) {
  var m = WIDGET_CFG[id]; if (!m) return null;
  var f = null;
  m.fields.forEach(function (x) { if (x.key === key) f = x; });
  if (!f) return null;
  var v = val;
  if (f.type === 'bool') v = (val === true || val === 'true' || val === 1 || val === '1');
  else if (f.type === 'number') { v = clamp(Number(val) || 0, f.min, f.max); if (f.step) v = Math.round(v / f.step) * f.step; v = clamp(v, f.min, f.max); }
  else if (f.type === 'select' || f.type === 'font') { if (f.options && f.options.indexOf(val) < 0) v = f.def; else v = val; }
  else v = String(val == null ? '' : val);
  var all = rd(WCFG_KEY, {}) || {};
  if (!all[id]) all[id] = {};
  all[id][key] = v;
  wr(WCFG_KEY, all);
  return getCfg(id);
}
function fieldVisible(id, f, cfg) {
  if (!f.showIf) return true;
  return cfg[f.showIf.field] === f.showIf.value;
}
function visibleFields(id) {
  var m = WIDGET_CFG[id]; if (!m) return [];
  var cfg = getCfg(id);
  return m.fields.filter(function (f) { return fieldVisible(id, f, cfg); }).map(function (f) { return f.key; });
}
function widgetFieldsFor(id, size) {
  var vis = visibleFields(id);
  if (size === 'S') return vis.slice(0, 2);
  if (size === 'M') return vis.slice(0, 4);
  return vis;
}
function cfgInputHtml(id, f, cfg) {
  var val = cfg[f.key];
  var attr = 'data-am-cfg="' + id + '.' + f.key + '"';
  if (f.type === 'bool') return '<input type="checkbox" ' + attr + (val ? ' checked' : '') + '>';
  if (f.type === 'number') return '<input type="number" ' + attr + ' value="' + val + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '">';
  if (f.type === 'text' || f.type === 'city') {
    var list = f.type === 'city' ? ' list="am-city-list"' : '';
    return '<input type="text" ' + attr + ' value="' + esc(val) + '"' + list + '>';
  }
  var opts = (f.options || []).map(function (o) { return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
  return '<select ' + attr + '>' + opts + '</select>';
}
function configTableHtml() {
  var groups = {};
  Object.keys(WIDGET_CFG).forEach(function (id) {
    var m = WIDGET_CFG[id];
    (groups[m.group] = groups[m.group] || []).push(id);
  });
  var h = '<datalist id="am-city-list"><option value="上海"></option><option value="北京"></option><option value="杭州"></option><option value="成都"></option><option value="深圳"></option></datalist>';
  h += '<div class="am-cfg" id="am-widget-cfg"><h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg> 小组件配置表（AM）</h4><div class="am-hint">改完自动保存；带条件的行只在相关开关打开时出现。</div>';
  Object.keys(groups).forEach(function (g) {
    h += '<div style="font-weight:600;font-size:17px;color:#171717;margin:20px 0 4px;">' + esc(g) + '</div><table>';
    groups[g].forEach(function (id) {
      var m = WIDGET_CFG[id]; var cfg = getCfg(id);
      h += '<tr><td colspan="2" style="font-weight:600;border-top:1px solid rgba(23,23,23,.08);">' + esc(m.name) + '</td></tr>';
      m.fields.forEach(function (f) {
        var vis = fieldVisible(id, f, cfg);
        var hint = f.type === 'number' ? ('默认 ' + f.def + ' · ' + f.min + '–' + f.max + '，步长 ' + f.step) : ('默认 ' + f.def);
        h += '<tr data-am-cfg-row="' + id + '.' + f.key + '"' + (vis ? '' : ' style="display:none;"') + '><td>' + esc(f.label) + '</td><td>' + cfgInputHtml(id, f, cfg) + ' <span class="am-hint">' + esc(hint) + '</span></td></tr>';
      });
    });
    h += '</table>';
  });
  h += '<div style="margin-top:8px;"><button type="button" onclick="window.GroupAM.resetWidgetLayout()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3.5V9h-5.5"/></svg> 一键恢复默认位置尺寸</button> <button type="button" onclick="window.GroupAM.snapGuides(true)">显示吸附参考线</button> <button type="button" onclick="window.GroupAM.snapGuides(false)">隐藏参考线</button></div>'
    + '<div class="am-hint">桌面拖拽编辑尚未合入：这里只提供参考线与恢复默认。</div></div>';
  return h;
}
function resetWidgetLayout() {
  var count = 0;
  try {
    var w = rd(WIDGETS_KEY, null);
    if (w && Array.isArray(w.placed)) {
      w.placed.forEach(function (p) { p.size = 'M'; count++; });
      wr(WIDGETS_KEY, w);
    }
  } catch (e) {}
  try {
    var d = rd(DESKW_KEY, null);
    if (d && typeof d === 'object') { d.widgetOrder = []; wr(DESKW_KEY, d); }
  } catch (e) {}
  try { if (window.ACWidgets && window.ACWidgets.render) window.ACWidgets.render(); } catch (e) {}
  try { if (window.DesktopWidgets && window.DesktopWidgets.refresh) window.DesktopWidgets.refresh(); } catch (e) {}
  return { ok: true, reset: count };
}
function snapGuides(on) {
  var layer = document.getElementById('sys-desktop-layer') || document.body;
  var old = document.getElementById('am-snap-guides');
  if (old) old.remove();
  if (!on) return { ok: true, shown: false };
  var g = document.createElement('div'); g.id = 'am-snap-guides';
  g.innerHTML = '<i class="v" style="left:50%;"></i><i class="v" style="left:25%;"></i><i class="v" style="left:75%;"></i><i class="h" style="top:33%;"></i><i class="h" style="top:66%;"></i>';
  layer.appendChild(g);
  return { ok: true, shown: true };
}

/* ── 8. 桌面搜索 Quick Tools（AF 组桌面搜索未合入：AM 先做命令解析函数 + 临时入口）── */
function calcEval(expr) {
  var s = String(expr || '').replace(/\s+/g, '');
  if (!s || !/^[0-9+\-*/().%]+$/.test(s)) return null;
  var i = 0;
  function peek() { return s[i]; }
  function num() {
    var start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) return null;
    var v = parseFloat(s.slice(start, i));
    return isNaN(v) ? null : v;
  }
  function factor() {
    if (peek() === '-') { i++; var v = factor(); return v == null ? null : -v; }
    if (peek() === '(') { i++; var v = expr2(); if (peek() !== ')') return null; i++; return v; }
    return num();
  }
  function term() {
    var v = factor(); if (v == null) return null;
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      var op = s[i++]; var r = factor(); if (r == null) return null;
      if (op === '*') v = v * r; else if (op === '/') { if (r === 0) return null; v = v / r; } else v = v % r;
    }
    return v;
  }
  function expr2() {
    var v = term(); if (v == null) return null;
    while (peek() === '+' || peek() === '-') {
      var op = s[i++]; var r = term(); if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  var out = expr2();
  if (i !== s.length || out == null || !isFinite(out)) return null;
  return Math.round(out * 10000) / 10000;
}
function todayTodos() {
  var raw = rd(SCHED_KEY, null);
  var items = [];
  var today = dayKey(new Date());
  var todayFull = today + '';
  var push = function (t) { if (t && items.length < 5) items.push(String(t)); };
  if (Array.isArray(raw)) {
    raw.forEach(function (it) {
      if (!it) return;
      var d = it.date || it.day || '';
      if (!d || String(d).indexOf(today) >= 0 || String(d) === todayFull) push(it.title || it.text || it.name);
    });
  } else if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach(function (k) {
      if (k.indexOf(today) >= 0) {
        var v = raw[k];
        if (Array.isArray(v)) v.forEach(function (it) { push(it && (it.title || it.text || it)); });
        else push(v && (v.title || v.text || v));
      }
    });
  }
  return items.slice(0, 5);
}
function appNames() {
  var names = [];
  try {
    document.querySelectorAll('#sys-desktop-layer .sys-app-grid > *, #sys-desktop-layer [data-app]').forEach(function (el) {
      var t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12);
      if (t) names.push(t);
    });
  } catch (e) {}
  var fallback = ['微信', '此刻', '阅读', '备忘录', '影院', '设置', '电话', '相册', '天气', '微博', '剧本']; /* GROUP-FIX7：删日程 */
  fallback.forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
  return names;
}
function quickTools(input) {
  var q = String(input == null ? '' : input).trim();
  if (!q) return { type: 'empty', q: q };
  var m = q.match(/^(?:计时|番茄|timer|focus)\s*(\d{1,3})?/);
  if (m) {
    var mins = clamp(parseInt(m[1] || '25', 10) || 25, 1, 120);
    return { type: 'timer', q: q, minutes: mins, label: '开始 ' + mins + ' 分钟专注' };
  }
  if (/^(待办|todo|todos|今日待办)/i.test(q)) {
    return { type: 'todos', q: q, items: todayTodos() };
  }
  var calc = calcEval(q);
  if (calc !== null) return { type: 'calc', q: q, value: calc, label: q + ' = ' + calc };
  var hits = appNames().filter(function (n) { return n.indexOf(q) >= 0 || q.indexOf(n) >= 0; });
  return { type: 'search', q: q, hits: hits };
}
function runQuickTool(input) {
  var r = quickTools(input);
  if (r.type === 'timer') {
    try { if (window.GroupN && window.GroupN.focusStart) { var st = window.GroupN.focusStart(r.minutes, Date.now()); return Object.assign(r, { ok: !!st, started: st }); } } catch (e) {}
    return Object.assign(r, { ok: false, reason: 'no-focus-engine' });
  }
  return Object.assign(r, { ok: true });
}
function mountSearchPill() {
  /* GROUP-FIX2: 浮动搜索 pill 已合并进 AF 桌面搜索；计时/待办/算式命令仍可走 GroupAM.quickTools/runQuickTool，FIX2 已接进 AF 搜索框。 */
  try { var _old2 = document.getElementById('am-search-pill'); if (_old2) _old2.remove(); } catch (e) {}
  return false;
  if (document.getElementById('am-search-pill')) return false;
  var layer = document.getElementById('sys-desktop-layer');
  if (!layer) return false;
  var b = document.createElement('button');
  b.type = 'button'; b.id = 'am-search-pill';
  b.textContent = '搜索 · 计时 · 待办 · 算式';
  b.addEventListener('click', function () { openSearchOverlay(); });
  layer.appendChild(b);
  return true;
}
function openSearchOverlay() {
  closeSearchOverlay();
  var ov = document.createElement('div');
  ov.id = 'am-search-overlay';
  ov.innerHTML = '<div class="am-sheet"><h3><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m15.8 15.8 5 5"/></svg> 桌面搜索 · Quick Tools</h3>'
    + '<input type="text" id="am-search-input" placeholder="试试：计时25 / 待办 / 2+3*4 / 微信">'
    + '<div class="am-res" id="am-search-res"><div style="font-size:12px;color:#8a8580;">命令：计时（番茄）、待办（当日最多 5 条）、算式；其他文字搜应用。</div></div>'
    + '<div style="margin-top:10px;"><button type="button" onclick="window.GroupAM.openSettings()"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg> 宠物与专注设置</button> <button type="button" onclick="window.GroupAM.closeSearchOverlay()">关闭</button></div>'
    + '<div style="font-size:11px;color:#a08a76;margin-top:8px;">AM 临时入口：AF 组桌面搜索未合入本版文件，AF 合入后以 AF 的搜索为准，本入口保留命令解析函数。</div></div>';
  document.body.appendChild(ov);
  var inp = ov.querySelector('#am-search-input');
  var res = ov.querySelector('#am-search-res');
  var render = function () {
    var r = quickTools(inp.value);
    var h = '';
    if (r.type === 'timer') h = '<div class="am-res-row"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/></svg> ' + esc(r.label) + ' <button type="button" onclick="window.GroupAM.runQuickTool(document.getElementById(\'am-search-input\').value);window.GroupAM.closeSearchOverlay();">开始</button></div>';
    else if (r.type === 'todos') h = r.items.length ? r.items.map(function (t) { return '<div class="am-res-row"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 5-6"/></svg> ' + esc(t) + '</div>'; }).join('') : '<div class="am-res-row">今天没有待办，也可以什么都不做。</div>';
    else if (r.type === 'calc') h = '<div class="am-res-row"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7.5h6M9.5 12h.01M12 12h.01M14.5 12h.01M9.5 15.5h.01M12 15.5h.01M14.5 15.5h.01"/></svg> ' + esc(r.label) + '</div>';
    else if (r.type === 'search') h = r.hits.length ? r.hits.map(function (n) { return '<div class="am-res-row"><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8h9.6a2 2 0 0 1 2 2v12.4a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z"/><path d="M9 6.5h6m-6 10h6"/></svg> ' + esc(n) + '</div>'; }).join('') : '<div class="am-res-row">没有找到“' + esc(r.q) + '”相关的应用。</div>';
    else h = '<div style="font-size:12px;color:#8a8580;">命令：计时（番茄）、待办（当日最多 5 条）、算式；其他文字搜应用。</div>';
    res.innerHTML = h;
  };
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { runQuickTool(inp.value); } });
  setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeSearchOverlay(); });
  return true;
}
function closeSearchOverlay() { var ov = document.getElementById('am-search-overlay'); if (ov) ov.remove(); return true; }

/* ── 9. 影院反应（接 X 组 GroupX；只包 pause/nextScene/prevScene/jumpTo，不改影院主逻辑）── */
var _cxWrapped = false;
function cinemaReact(kind) {
  var root = document.getElementById('cx-root');
  if (!root) return { ok: false, reason: 'no-cinema-root' };
  var r = reactTo(kind === 'pause' ? 'cinema_pause' : 'cinema_scene');
  var old = root.querySelector('.am-cinema-react'); if (old) old.remove();
  var d = document.createElement('div');
  d.className = 'am-cinema-react';
  var extra = '';
  try { if (window.GroupX && window.GroupX.reactionFor) { var rr = window.GroupX.reactionFor(); if (rr && rr.text) extra = '（他说：' + rr.text + '）'; } } catch (e) {}
  d.textContent = r.text + (extra ? ' ' + extra : '');
  root.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 6000);
  Hooks.emit('cinema-react', { kind: kind, mood: r.mood });
  return { ok: true, kind: kind, text: r.text };
}
function wrapCinema() {
  if (_cxWrapped) return false;
  try {
    if (!window.GroupX) return false;
    var wrap = function (name, kind) {
      var orig = window.GroupX[name];
      if (typeof orig !== 'function') return;
      window.GroupX[name] = function () {
        var r = orig.apply(window.GroupX, arguments);
        setTimeout(function () { try { cinemaReact(kind); } catch (e) {} }, 60);
        return r;
      };
    };
    wrap('pause', 'pause'); wrap('nextScene', 'scene'); wrap('prevScene', 'scene'); wrap('jumpTo', 'scene');
    _cxWrapped = true;
    return true;
  } catch (e) { return false; }
}

/* ── 10. 阅读小互动（接 H 组 Ice-Paperbound 阅读器；纯装饰，不动正文）── */
var DECO_WORDS = ['风', '月', '灯', '雨', '梦', '雪', '星', '花'];
var _reader = { lastCount: -1, lastSteal: 0, lastBookmark: 0 };
function readerDeco(kind, force) {
  var view = document.getElementById('novel-reader-view');
  var host = view || document.body;
  if (!host) return { ok: false };
  var now = Date.now();
  if (!force) {
    if (kind === 'steal' && now - _reader.lastSteal < 5 * 60000) return { ok: false, reason: 'cooldown' };
    if (kind === 'bookmark' && now - _reader.lastBookmark < 5 * 60000) return { ok: false, reason: 'cooldown' };
  }
  var d = document.createElement('div');
  d.className = 'am-reader-deco';
  var text = '';
  if (kind === 'bookmark') { text = '猫把书签推下去，又捡回来了。'; _reader.lastBookmark = now; }
  else { var w = DECO_WORDS[Math.floor(Math.random() * DECO_WORDS.length)]; text = '他叼走了「' + w + '」这个词，又轻轻放回去了。'; _reader.lastSteal = now; }
  d.textContent = text;
  host.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4000);
  return { ok: true, kind: kind, text: text };
}
function readerTick(force) {
  var view = document.getElementById('novel-reader-view');
  if (!view) return { ok: false, reason: 'no-reader' };
  var count = view.childElementCount;
  if (!force && count === _reader.lastCount) return { ok: false, reason: 'same-page' };
  _reader.lastCount = count;
  if (force || Math.random() < 0.3) return readerDeco(Math.random() < 0.5 ? 'steal' : 'bookmark', force);
  return { ok: false, reason: 'no-deco-this-time' };
}

/* ── 11. 设置页（AM）：宠物皮肤 / 天气 / 专注 / 小组件 / 话术 / 数据承诺 ── */
var _memoPending = {};
function openSettings(section) {
  closeSettings();
  var ps = petSettings(); var fs = focusSettings();
  var skinBtns = Object.keys(SKINS).map(function (id) {
    var pal = SKINS[id].palette;
    return '<button type="button" class="' + (ps.skin === id ? 'am-on' : '') + '" onclick="window.GroupAM.applySkin(\'' + id + '\');window.GroupAM.openSettings(\'pet\')"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + pal.main + ';vertical-align:-1px;"></span> ' + esc(SKINS[id].name) + ' · ' + esc(SKINS[id].idleDesc) + '</button>';
  }).join('');
  var wkind = (ps.weather && ps.weather.kind) || 'auto';
  var wkOpts = [['auto', '按季节自动'], ['snow', '雪'], ['petals', '花瓣'], ['leaves', '落叶'], ['fireflies', '萤火']].map(function (o) {
    return '<option value="' + o[0] + '"' + (wkind === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  var tone = toneFor(new Date());
  var ov = document.createElement('div');
  ov.id = 'am-settings-modal';
  ov.innerHTML = '<div class="am-sheet"><h3><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg> 宠物与专注设置（AM）</h3>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16.4" rx="5.5" ry="4.2"/><ellipse cx="5.8" cy="9.2" rx="1.8" ry="2.5"/><ellipse cx="10.1" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="14.4" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="18.6" cy="9.2" rx="1.8" ry="2.5"/></svg> 桌宠皮肤（长按宠物也能打开这里）</h4><div>' + skinBtns + '</div>'
    + '<div class="am-note">皮肤注册表是 AM 自备的（AB 组未合入）；一份定义共用桌宠、番茄小浮窗的猫和这里的圆点。猫 / 狗 / QQ boy 待机动作各不相同，不只是换颜色。</div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c-4.5-1-5.3-4.2-3.2-5.3 1.5-.8 3.1.4 3.2 3.3.1-2.9 1.7-4.1 3.2-3.3 2.1 1.1 1.3 4.3-3.2 5.3 4.5-1 6.2 1.8 4.3 3.5-1.3 1.2-3.2.4-4.3-2.4 1.1 2.8.2 4.6-1.6 4.4-2.4-.2-3-3.4 1.6-6.2-4.6 2.8-7.1.7-5.8-1.5 1-1.6 3-.9 5.8 1.5Z"/><circle cx="12" cy="12" r="2"/></svg> 宠物周围季节小天气</h4><label><input type="checkbox"' + (weatherEnabled() ? ' checked' : '') + ' onchange="window.GroupAM.setWeather(this.checked)"> 开启小天气</label> '
    + '<select onchange="window.GroupAM.setWeather(true,this.value)">' + wkOpts + '</select>'
    + '<div class="am-note">按季节自动：冬天雪、春天花瓣、夏天萤火、秋天落叶；也可以手动选。这是宠物周围的小天气开关。</div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/></svg> 专注</h4><div>计时视角：<button type="button" class="' + (fs.view === 'elapsed' ? 'am-on' : '') + '" onclick="window.GroupAM.setFocusView(\'elapsed\')">已专注多久</button> <button type="button" class="' + (fs.view === 'remaining' ? 'am-on' : '') + '" onclick="window.GroupAM.setFocusView(\'remaining\')">还剩多久</button></div>'
    + '<div style="margin-top:6px;">环境音：<select onchange="window.GroupAM.setFocusSound(this.value)"><option value="off"' + (fs.sound === 'off' ? ' selected' : '') + '>关</option><option value="lofi"' + (fs.sound === 'lofi' ? ' selected' : '') + '>lofi</option><option value="rain"' + (fs.sound === 'rain' ? ' selected' : '') + '>雨声</option><option value="forest"' + (fs.sound === 'forest' ? ' selected' : '') + '>森林</option></select> <span style="font-size:11px;color:#a08a76;">WebAudio 合成，无外部音频文件</span></div>'
    + '<div style="margin-top:6px;"><label><input type="checkbox"' + (fs.autoStart ? ' checked' : '') + ' onchange="window.GroupAM.setFocusAutoStart(this.checked)"> 完成 5 分钟后自动开始下一轮</label></div>'
    + '<div style="margin-top:6px;"><button type="button" onclick="window.GroupAM.exportFocusLog()">导出专注日志 .md</button> <button type="button" onclick="window.GroupAM.toggleMiniWindow();window.GroupAM.openSettings(\'focus\')">切换桌面小浮窗</button></div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 4v16M4 12h16"/></svg> 小组件</h4><div>' + configTableHtml() + '</div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/></svg> 此刻基调：' + esc(tone.label) + '</h4><div class="am-note">char 现在会说：「' + esc(tone.char[0]) + '」<br>日记语气：' + esc(tone.diary) + '<br>此刻光线：' + esc(tone.light) + '</div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6Z"/><path d="M8 9h8M8 12.5h5"/></svg> 说话的语气</h4><div class="am-note">' + TONE_RULES.map(function (r) { return esc(r); }).join('<br>') + '<br><br>' + esc(systemPromptTone()) + '</div>'
    + '<h4><svg class="xwl-ui-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg> 数据承诺（AM 暂存处；AH 组数据承诺页合入后移过去）</h4><div class="am-note">桌宠的打字 / 滚动反应只用“有输入 / 滚动”这一事件，从不读输入框内容、消息文本或书本正文；专注日志只记时长与完成 / 放弃，不记你在做什么；金币只读 otome_coins_v1，不改账本；API Key 不经过本组任何代码。</div>'
    + '<div style="margin-top:14px;text-align:center;"><button type="button" onclick="window.GroupAM.closeSettings()">完成</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeSettings(); });
  return true;
}
function closeSettings() { var ov = document.getElementById('am-settings-modal'); if (ov) ov.remove(); return true; }

/* ── 12. 初始化 ── */
var _inited = false;
function init() {
  if (_inited) return { ok: false, reason: 'already' };
  _inited = true;
  try { applyTone(); } catch (e) {}
  try { setInterval(applyTone, 3600000); } catch (e) {}
  try { bindPet(); } catch (e) {}
  try { renderWeather(); } catch (e) {}
  try { ensureSkin(); } catch (e) {}
  try { wrapFocusEngine(); } catch (e) {}
  try { wrapCinema(); } catch (e) {}
  try { mountSearchPill(); } catch (e) {}
  try { refreshMiniWindow(); } catch (e) {}
  try { setInterval(refreshMiniWindow, 5000); } catch (e) {}
  try { setInterval(function () { readerTick(false); }, 4000); } catch (e) {}
  /* 小组件配置表 + 备忘录样式控件：文档级委托，绑定一次。 */
  try {
    if (!document._amCfgBound) {
      document._amCfgBound = true;
      document.addEventListener('change', function (e) {
        try {
          var t = e.target; if (!t || !t.getAttribute) return;
          var cfg = t.getAttribute('data-am-cfg');
          if (cfg) {
            var parts = cfg.split('.');
            var val = t.type === 'checkbox' ? t.checked : t.value;
            setCfg(parts[0], parts[1], val);
            var tbl = document.getElementById('am-widget-cfg');
            if (tbl) {
              var m = WIDGET_CFG[parts[0]];
              if (m) {
                var cur = getCfg(parts[0]);
                m.fields.forEach(function (f) {
                  var row = tbl.querySelector('[data-am-cfg-row="' + parts[0] + '.' + f.key + '"]');
                  if (row) row.style.display = fieldVisible(parts[0], f, cur) ? '' : 'none';
                });
              }
            }
            return;
          }
          var mf = t.getAttribute('data-am-memo-field');
          if (mf) {
            if (t.tagName === 'BUTTON') return;
            var mv = t.value;
            if (mf === 'fontSize') mv = Number(mv) || 15;
            if (window.GroupAM) window.GroupAM._memoPending[mf] = mv;
            var ta = document.getElementById('gd-memo-text');
            if (ta) { if (mf === 'fontSize') ta.style.fontSize = mv + 'px'; if (mf === 'font') ta.style.fontFamily = memoFontFamily(mv); }
          }
        } catch (err) {}
      });
      document.addEventListener('click', function (e) {
        try {
          var t = e.target; if (!t || !t.closest) return;
          var btn = t.closest('[data-am-memo-field="color"]');
          if (btn) {
            var c = btn.getAttribute('data-am-memo-value');
            if (window.GroupAM) window.GroupAM._memoPending.color = c;
            var ta = document.getElementById('gd-memo-text');
            if (ta) ta.style.background = c + '44';
            document.querySelectorAll('#am-memo-style [data-am-memo-field="color"]').forEach(function (b) {
              b.style.border = (b.getAttribute('data-am-memo-value') === c) ? '2px solid #7a4a28' : '1px solid #d8d2cc';
            });
          }
          var st = t.closest('[data-am-sticky]');
          if (st) { try { openMemo(); } catch (err) {} }
        } catch (err) {}
      });
    }
  } catch (e) {}
  try { wrapCinema(); } catch (e) {}
  return { ok: true };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

window.GroupAM = {
  SKINS: SKINS, skinPalette: skinPalette, pixelHtml: pixelHtml,
  TONE_SLOTS: TONE_SLOTS, WEEKEND_TONE: WEEKEND_TONE, toneFor: toneFor, applyTone: applyTone,
  TONE_RULES: TONE_RULES, systemPromptTone: systemPromptTone,
  REACTIONS: REACTIONS, moodFor: moodFor, reactTo: reactTo, showPetBubble: showPetBubble,
  Hooks: Hooks, petSettings: petSettings, applySkin: applySkin, ensureSkin: ensureSkin,
  weatherKind: weatherKind, weatherEnabled: weatherEnabled, setWeather: setWeather, renderWeather: renderWeather,
  terrainIcons: terrainIcons, terrainStep: terrainStep, setWalking: setWalking, bindPet: bindPet,
  remind: remind, chirp: chirp,
  focusSettings: focusSettings, setFocusView: setFocusView, setFocusSound: setFocusSound, setFocusAutoStart: setFocusAutoStart,
  focusState: focusState, focusViewText: focusViewText, coinsTotal: coinsTotal, focusWeekStats: focusWeekStats,
  focusLogMd: focusLogMd, appendFocusLog: appendFocusLog, recordFocusEnd: recordFocusEnd,
  autoStartState: autoStartState, triggerAutoStart: triggerAutoStart, endFocusAbandon: endFocusAbandon,
  abandonDown: abandonDown, abandonUp: abandonUp, wrapFocusEngine: wrapFocusEngine,
  startAmbient: startAmbient, stopAmbient: stopAmbient, completionChime: completionChime,
  focusPanelHtml: focusPanelHtml, exportFocusLog: exportFocusLog, setMiniAlways: setMiniAlways,
  toggleMiniWindow: toggleMiniWindow, miniWindowHtml: miniWindowHtml, refreshMiniWindow: refreshMiniWindow,
  celebrateMini: celebrateMini, openFocusPanel: openFocusPanel,
  MEMO_COLORS: MEMO_COLORS, MEMO_FONTS: MEMO_FONTS, memoDefaults: memoDefaults, memoStyle: memoStyle,
  memoFontFamily: memoFontFamily, memoStyleRow: memoStyleRow, memoCardAttr: memoCardAttr, memoTitleSize: memoTitleSize,
  latestMemo: latestMemo, stickyHtml: stickyHtml, openMemo: openMemo, _memoPending: _memoPending,
  WIDGET_CFG: WIDGET_CFG, cfgDefaults: cfgDefaults, getCfg: getCfg, setCfg: setCfg,
  fieldVisible: fieldVisible, visibleFields: visibleFields, widgetFieldsFor: widgetFieldsFor,
  configTableHtml: configTableHtml, resetWidgetLayout: resetWidgetLayout, snapGuides: snapGuides,
  calcEval: calcEval, todayTodos: todayTodos, appNames: appNames, quickTools: quickTools, runQuickTool: runQuickTool,
  mountSearchPill: mountSearchPill, openSearchOverlay: openSearchOverlay, closeSearchOverlay: closeSearchOverlay,
  cinemaReact: cinemaReact, wrapCinema: wrapCinema,
  readerDeco: readerDeco, readerTick: readerTick,
  openSettings: openSettings, closeSettings: closeSettings,
  reduceMotion: reduceMotion, isDarkNow: isDarkNow, init: init,
  _keys: { pet: PET_KEY, focus: FOCUS_KEY, focusMd: FOCUS_MD_KEY, widgetCfg: WCFG_KEY },
  _lastComfort: function () { return _focus.lastComfort; },
  _lastReward: function () { return _focus.lastReward; },
  _wrappedFocus: function () { return _focus.wrapped; },
  _cxWrapped: function () { return _cxWrapped; }
};
})();
