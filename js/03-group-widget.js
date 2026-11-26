
/* GROUP-WIDGET: 日历小组件（第 3 项）+ home 弹书小屋小组件（第 5 项）+ 小组件目录机制（第 7 项缩减版）。
   许可（两处署名也写进了设置 → 关于）：
   - 日历：tchung1970/calendar，MIT，Copyright (c) 2025 Thomas Chung，https://github.com/tchung1970/calendar。
     只借月历网格算法 + “点日期 → 弹窗增删改查”流程；样式（1200px 容器、100px 日格、深蓝顶栏）、
     英文界面、localStorage['calendarEvents'] 存储全部重写，未复制仓库代码。
   - 弹书小屋：Dksie09/unfold，MIT，https://github.com/Dksie09/unfold（LICENSE 抓取渲染里没有版权人行，
     不编造作者名和年份）。只借思路不搬代码：书页绕书脊扇形展开、地面沿对角线对折、家具是立在地面上的
     平面纸卡；Next.js/React/three.js/着色器/手绘渲染器/写字系统全部搬不进单文件手机，小组件走手机已
     有的 CSS 3D 路子（乙游家已验证），不用 three.js。仓库本身没有旋转机制、没有人物、没有 PNG 上传——
     “小人跟着转”是新做的设计（纸卡机制借 unfold，转台是新加的），不是仓库自带功能。
   存储（复用 GROUP-STEP0 的 window.XWLDB 唯一底座，不另写第二套 IDB 或第二套备份）：
   - 日历：calendar_marks（id，by_date 索引）、calendar_notes（keyPath date）、calendar_meta；
     localStorage 只存轻量派生索引 cal_marks_index_v1（丢了可从 IDB 重建）。
   - home：widget_assets（id 'popuphouse_person'，Blob）；localStorage 只存小指针 gw_popuphouse_v1。
     整机备份已由 STEP0 接好（含 IDB，音频超 10MB 明说排除）；本组不另写备份机制。
   默认值（用户 2026-11-26 亲口确认的 5 个）：周一起始、默认 M 号、默认不放置、日常上限 500 字、
     候选标题自动“一起记住的日子：M月D日”。
   用户已定的 home 7 个答案（照做）：名字 home；尺寸 L（全宽x150）；轻摆 +-30 度，小人永远看得见，
     不转满圈；只在用户点按时才转，不自动转；点一下开书展开、点两下回家进乙游 3D 家；横向拖动换房间；
     只收 PNG（JPG 不要），<=2MB、长边压 512px；空状态房子也转（与有图时同一规则）。
   不做：桌面重设计二阶段、不改桌面排布、不动桌面小组件摆放、不改图标；第 7 项只做缩减版
   （目录机制 + 英雄卡移入目录 + 桌面默认不放小组件），不套 SLOT_MAP、不套 564px 纵向重排。 */
(function () {
'use strict';

/* ── 小工具 ── */
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var lsGet = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
var lsDel = function (k) { try { localStorage.removeItem(k); } catch (e) {} };
var p2 = function (n) { return String(n).padStart(2, '0'); };
var dstr = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
var parseYMD = function (s) { var p = String(s || '').split('-'); if (p.length !== 3) return null; var d = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); return isNaN(d.getTime()) ? null : d; };
var uid = function (p) { return (p || 'xwl') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); };
var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
var toast = function (msg) { try { if (window.SysDialog && SysDialog.alert) { SysDialog.alert(msg); return; } } catch (e) {} try { alert(msg); } catch (e) {} };
var appManager = function () {
  try { if (typeof AppManager !== 'undefined' && AppManager && AppManager.launch) return AppManager; } catch (e) {}
  try { if (window.AppManager && window.AppManager.launch) return window.AppManager; } catch (e) {}
  return null;
};
var launchApp = function (id) { var m = appManager(); if (!m) { toast('这个应用尚未加载。'); return false; } try { m.launch(id); return true; } catch (e) { return false; } };
var wxEngine = function () {
  try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine) return WeChatAppEngine; } catch (e) {}
  try { if (window.WeChatAppEngine) return window.WeChatAppEngine; } catch (e) {}
  return null;
};
var otomeF = function () {
  try { if (window.OtomeF) return window.OtomeF; } catch (e) {}
  try { if (typeof OtomeF !== 'undefined' && OtomeF) return OtomeF; } catch (e) {}
  return null;
};

/* ══════════════════════════════════════════════════════════════════
   一、共享：乙游家房间渲染（唯一实现）
   签名：OtomeHouse.renderRoomsHTML(rooms, focusedId, opts)
     rooms: [{ id, name, en, cls, furn: [{ id, ico, label }] }]（取自 WeChatAppEngine._otomeRooms()）
     focusedId: 当前房间 id（字符串；不在列表里则都不高亮）
     opts: { interactive: true|false }——true 时房间/家具带原来的 onclick（乙游家用），
           false 时只出静态结构（home 小组件用，小组件的点按走 gw 管道，不在房间上挂 onclick）
   返回：房间 HTML 字符串（与原来 openOtomeHome 内联拼的一字相同，interactive 为 true 时）。
   G-PET 的 3D 重做在其上换内核时只改这个函数（或在它之前包一层），不要再写第二份拼装。
   ══════════════════════════════════════════════════════════════════ */
var OTOME_ROOMS_FALLBACK = [
  { id: 'living', name: '客厅', en: 'LIVING', cls: 'ot-room-living', furn: [{ id: 'sofa', ico: '🛋️', label: '坐下' }, { id: 'tea', ico: '🍵', label: '喝茶' }, { id: 'books', ico: '📚', label: '看书' }] },
  { id: 'bed', name: '卧室', en: 'BEDROOM', cls: 'ot-room-bed', furn: [{ id: 'bed', ico: '🛏️', label: '休息' }, { id: 'wardrobe', ico: '👗', label: '换装' }, { id: 'lamp', ico: '💡', label: '台灯' }] },
  { id: 'kitchen', name: '厨房', en: 'KITCHEN', cls: 'ot-room-kitchen', furn: [{ id: 'stove', ico: '🍳', label: '做饭' }, { id: 'fridge', ico: '🧊', label: '冰箱' }, { id: 'table', ico: '🍽️', label: '餐桌' }] },
  { id: 'balcony', name: '阳台', en: 'BALCONY', cls: 'ot-room-balcony', furn: [{ id: 'flower', ico: '🌷', label: '浇花' }, { id: 'chair', ico: '🪑', label: '摇椅' }, { id: 'scope', ico: '🔭', label: '看风景' }] }
];
var otomeRooms = function () {
  var eng = wxEngine();
  try { if (eng && eng._otomeRooms) { var r = eng._otomeRooms(); if (Array.isArray(r) && r.length) return r; } } catch (e) {}
  return OTOME_ROOMS_FALLBACK;
};
var renderRoomsHTML = function (rooms, focusedId, opts) {
  var interactive = !opts || opts.interactive !== false;
  var list = Array.isArray(rooms) ? rooms : [];
  return list.map(function (r) {
    var furn = (r.furn || []).map(function (f) {
      if (interactive) return '<button class="ot-furn" onclick="event.stopPropagation();WeChatAppEngine.otomeFurnAct(\'' + r.id + '\',\'' + f.id + '\')"><span class="ot-furn-ico">' + f.ico + '</span><span>' + f.label + '</span></button>';
      return '<span class="ot-furn"><span class="ot-furn-ico">' + f.ico + '</span><span>' + f.label + '</span></span>';
    }).join('');
    var open = interactive ? ' onclick="WeChatAppEngine.otomeRoomFocus(\'' + r.id + '\')"' : '';
    return '<div class="ot-room ' + r.cls + (r.id === focusedId ? ' ot-focused' : '') + '" data-room="' + r.id + '"' + open + '>'
      + '<div class="ot-room-name">' + r.name + '</div><div class="ot-room-en">' + r.en + '</div>'
      + furn + '</div>';
  }).join('');
};
window.OtomeHouse = { renderRoomsHTML: renderRoomsHTML, rooms: otomeRooms };

/* ══════════════════════════════════════════════════════════════════
   二、日历纯函数（可单测；不碰 DOM、不碰存储）
   月历网格算法借 tchung1970/calendar：firstDay / daysInMonth / 42 格；
   本组改周一起始（仓库是周日开头），日期一律用 'YYYY-MM-DD' 字符串比较，不做 Date 换算。
   ══════════════════════════════════════════════════════════════════ */
var WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
var TOOL_LABEL = { circle: '圈圈', star: '星星', check: '打勾', together: '一起记住', free: '自由画', eraser: '橡皮' };
var TOOL_COLOR = { circle: '#C94F4F', star: '#1e2748', check: '#5B8A6A', together: '#E8C9D0', free: '#1e2748' };
/* 月历网格：42 格，周一起始；返回 [{ date:'YYYY-MM-DD', day, inMonth, isToday }] */
var monthGrid = function (y, m0) {
  var first = new Date(y, m0, 1);
  var dowMon = (first.getDay() + 6) % 7;
  var start = new Date(y, m0, 1 - dowMon);
  var today = dstr(new Date());
  var out = [];
  for (var i = 0; i < 42; i++) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push({ date: dstr(d), day: d.getDate(), inMonth: d.getMonth() === m0, isToday: dstr(d) === today });
  }
  return out;
};
/* 本周（周一起始）7 天 */
var weekOf = function (now) {
  var d = now || new Date();
  var dowMon = (d.getDay() + 6) % 7;
  var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dowMon);
  var out = [];
  for (var i = 0; i < 7; i++) out.push(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
  return out;
};
var starPoints = function (cx, cy, r) {
  var pts = [];
  for (var i = 0; i < 10; i++) {
    var rr = (i % 2 === 0) ? r : r * 0.45;
    var a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
};
/* 笔画形状 → SVG  inner（坐标 0-100 归一化；颜色走工具，不硬编进形状数据） */
var shapeInner = function (tool, shape) {
  var s = shape || {};
  var color = TOOL_COLOR[tool] || '#1e2748';
  if (s.kind === 'ellipse') return '<ellipse cx="' + s.cx + '" cy="' + s.cy + '" rx="' + s.rx + '" ry="' + s.ry + '" transform="rotate(' + (s.rotate || 0) + ' ' + s.cx + ' ' + s.cy + ')" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round"/>';
  if (s.kind === 'star') return '<polygon points="' + starPoints(s.cx || 50, s.cy || 50, s.r || 30) + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>';
  if (s.kind === 'check') return '<path d="M' + s.x1 + ' ' + s.y1 + ' L' + s.x2 + ' ' + s.y2 + ' L' + s.x3 + ' ' + s.y3 + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  if (s.kind === 'together') {
    var cx = s.cx || 50, cy = s.cy || 52, rx = s.rx || 30, ry = s.ry || 30;
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round"/>'
      + '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (rx * 0.72).toFixed(1) + '" ry="' + (ry * 0.72).toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/>'
      + '<path d="M78 28 C72 22 66 18 66 13 C66 9 70 7 73 9 C75 10 77 12 78 13 C79 12 81 10 83 9 C86 7 90 9 90 13 C90 18 84 22 78 28 Z" fill="' + color + '" stroke="none"/>';
  }
  if (s.kind === 'path' && Array.isArray(s.points) && s.points.length) {
    var d = 'M' + s.points.map(function (p) { return (+p[0]).toFixed(1) + ' ' + (+p[1]).toFixed(1); }).join(' L');
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  return '';
};
var markSVG = function (mark) {
  if (!mark || !mark.shape) return '';
  var inner = shapeInner(mark.tool, mark.shape);
  if (!inner) return '';
  return '<g data-mid="' + esc(mark.id) + '">' + inner + '</g>';
};
/* 点一下落在格子中央的默认形状（工具落点也算一条笔画；不用形状识别） */
var defaultShapeAt = function (tool, x, y) {
  var cx = clamp(Math.round(x), 20, 80), cy = clamp(Math.round(y), 20, 80);
  if (tool === 'circle') return { kind: 'ellipse', cx: cx, cy: cy, rx: 30, ry: 30, rotate: -8 };
  if (tool === 'star') return { kind: 'star', cx: cx, cy: cy, r: 30 };
  if (tool === 'check') return { kind: 'check', x1: cx - 22, y1: cy + 2, x2: cx - 6, y2: cy + 18, x3: cx + 24, y3: cy - 18 };
  if (tool === 'together') return { kind: 'together', cx: cx, cy: cy, rx: 30, ry: 30 };
  return null;
};
/* 派生索引 cal_marks_index_v1：{ 'YYYY-MM-DD': { marks, hasNote, together } } */
var calIndexLoad = function () { var v = lsGet('cal_marks_index_v1', null); return (v && typeof v === 'object') ? v : {}; };
/* 纪念日只读 char_special_dates_v1（按月日每年重复）：{ 'M-D': [rec] } */
var anniversaryByMD = function () {
  var map = {};
  try {
    var v = lsGet('char_special_dates_v1', null);
    var arr = (v && Array.isArray(v.dates)) ? v.dates : [];
    arr.forEach(function (rec) {
      if (!rec || !rec.title || !rec.date) return;
      var m = String(rec.date).match(/(\d{1,2})-(\d{1,2})$/);
      if (!m) return;
      var k = (+m[1]) + '-' + (+m[2]);
      (map[k] = map[k] || []).push(rec);
    });
  } catch (e) {}
  return map;
};
/* 下一个有标记的日子（今天起；标记来自派生索引，纪念日来自 char_special_dates_v1） */
var calNextMark = function (now, index, annMap) {
  var today = dstr(now || new Date());
  var best = null;
  var consider = function (dateStr, label) {
    if (!dateStr || dateStr <= today) return; /* “下个”指今天之后；今天有标记另由周条写“今天有标记” */
    if (!best || dateStr < best.date) best = { date: dateStr, label: label };
  };
  Object.keys(index || {}).forEach(function (ds) {
    var e = index[ds];
    if (!e || (!e.marks && !e.hasNote)) return;
    consider(ds, e.together ? '一起记住' : (e.marks ? '有标记' : '有日常'));
  });
  var t = now || new Date();
  Object.keys(annMap || {}).forEach(function (k) {
    var parts = k.split('-');
    var occ = new Date(t.getFullYear(), (+parts[0]) - 1, +parts[1]);
    if (dstr(occ) <= today) occ = new Date(t.getFullYear() + 1, (+parts[0]) - 1, +parts[1]);
    consider(dstr(occ), '纪念日');
  });
  return best;
};
/* 桌面周条 HTML（M 号三行：标题行 + 本周单行条 + 下个标记提示行） */
var calWeekStripHTML = function (now) {
  var n = now || new Date();
  var index = calIndexLoad();
  var annMap = anniversaryByMD();
  var title = (n.getMonth() + 1) + '月 · 今天 ' + n.getDate() + '日';
  var today = dstr(n);
  var cells = weekOf(n).map(function (d, i) {
    var ds = dstr(d);
    var e = index[ds] || {};
    var dots = '';
    if (e.together) dots += '<i class="gw-wk-dot" style="background:#D77A94"></i>'; /* 一起记住：莲粉，点上加深一档才看得清 */
    else if (e.marks) dots += '<i class="gw-wk-dot" style="background:#C94F4F"></i>';
    var md = (d.getMonth() + 1) + '-' + d.getDate();
    if (annMap[md]) dots += '<i class="gw-wk-dot" style="background:#1e2748"></i>';
    if (e.hasNote) dots += '<i class="gw-wk-dot" style="background:#8E8E93"></i>';
    return '<span class="gw-wk-cell' + (ds === today ? ' today' : '') + '"><span class="gw-wk-wd">' + WEEK_CN[i] + '</span>' + d.getDate() + '<span class="gw-wk-dots">' + dots + '</span></span>';
  }).join('');
  var next = calNextMark(n, index, annMap);
  var todayEntry = index[dstr(n)] || {};
  var todayHas = !!(todayEntry.marks || todayEntry.hasNote || annMap[(n.getMonth() + 1) + '-' + n.getDate()]);
  var nextLine = next
    ? '下个标记：' + (+next.date.split('-')[1]) + '月' + (+next.date.split('-')[2]) + '日 · ' + esc(next.label)
    : (todayHas ? '今天有标记' : '今天还没有标记');
  return '<div class="gw-w-cal-title">' + esc(title) + '</div><div class="gw-w-calweek">' + cells + '</div><div class="gw-wk-next">' + nextLine + '</div>';
};

/* ── 目录用到的三项读数（从 FIX2 英雄卡原地搬过来：目的地与内容口径不变，只换挂载位置） ── */
var nextAnniversary = function () {
  var now = new Date();
  var t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var best = null;
  var consider = function (title, md, kind) {
    if (!md) return;
    var occ = new Date(t.getFullYear(), md.mo - 1, md.da);
    if (occ < t) occ = new Date(t.getFullYear() + 1, md.mo - 1, md.da);
    var days = Math.round((occ - t) / 86400000);
    if (!best || days < best.days) best = { title: title, days: days, kind: kind || '' };
  };
  try {
    var v = lsGet('char_special_dates_v1', null);
    var arr = (v && Array.isArray(v.dates)) ? v.dates : [];
    arr.forEach(function (rec) {
      if (!rec || !rec.title) return;
      var m = String(rec.date).match(/(\d{1,2})-(\d{1,2})$/);
      if (m) consider(rec.title, { mo: +m[1], da: +m[2] }, rec.kind);
    });
  } catch (e) {}
  if (!best) {
    var sched = lsGet('phone_schedule_v1', []);
    if (Array.isArray(sched)) sched.forEach(function (it) {
      if (!it || !it.title || !/纪念|周年/.test(it.title)) return;
      var p = parseYMD(it.date);
      if (!p) return;
      var occ = new Date(p.getFullYear(), p.getMonth(), p.getDate());
      if (occ < t) return;
      consider(it.title, { mo: p.getMonth() + 1, da: p.getDate() }, '');
    });
  }
  return best;
};
var musicState = function () {
  try {
    if (window.GroupFIX11 && GroupFIX11.getState) {
      var s = GroupFIX11.getState();
      if (s && s.title) return { title: s.title, artist: s.artist || '', state: s.state };
    }
  } catch (e) {}
  try {
    if (window.DynamicIsland && DynamicIsland.getActivities) {
      var acts = DynamicIsland.getActivities() || [];
      for (var i = 0; i < acts.length; i++) {
        if (acts[i] && acts[i].type === 'music') return { title: acts[i].title || '音乐', artist: acts[i].artist || '', state: acts[i].playing ? 'playing' : 'paused' };
      }
    }
  } catch (e) {}
  var list = lsGet('phone_music_list_v1', []);
  if (Array.isArray(list) && list.length && list[0] && list[0].title) return { title: list[0].title, artist: list[0].artist || '', state: 'idle' };
  return null;
};
var latestPhoto = function () {
  var list = lsGet('phone_album_local_v1', []);
  if (!Array.isArray(list)) return null;
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (it && typeof it.src === 'string' && (it.src.indexOf('data:') === 0 || it.src.indexOf('http') === 0)) return { src: it.src, title: it.title || '照片', addedAt: it.addedAt || 0 };
  }
  return null;
};
var anniversaryHTML = function () {
  var ann = nextAnniversary();
  var big = ann ? (ann.days === 0 ? '就是今天' : '还有 ' + ann.days + ' 天') : '';
  var sub = ann ? esc(ann.title) + (ann.kind ? ' · ' + esc(ann.kind) : '') : '还没有纪念日，点这里加一个';
  return '<div class="gw-w-ann" data-gw-tap="anniversary"><div class="gw-w-mem-label">纪念日</div>' + (big ? '<div class="gw-w-big">' + big + '</div>' : '') + '<div class="gw-w-sub">' + sub + '</div></div>';
};
var musicHTML = function () {
  var mu = musicState();
  if (!mu) return '<div class="gw-w-music" data-gw-tap="music"><div class="gw-w-mem-label">音乐</div><div class="gw-w-sub">还没有音乐，去音乐里加一首</div></div>';
  var st = mu.state === 'playing' ? '正在播放' : mu.state === 'paused' ? '已暂停' : '未在播放';
  return '<div class="gw-w-music" data-gw-tap="music"><div class="gw-w-mem-label">音乐</div><div class="gw-w-big" style="font-size:16px">' + esc(mu.title) + '</div><div class="gw-w-sub">' + esc(mu.artist || '未知艺术家') + ' · ' + st + '</div></div>';
};
var photoHTML = function () {
  var ph = latestPhoto();
  if (!ph) return '<div class="gw-w-photo" data-gw-tap="photo"><div class="gw-w-mem-label">照片</div><div class="gw-w-sub">还没有照片，去相册添加一张</div></div>';
  return '<div class="gw-w-photo" data-gw-tap="photo" style="padding:0;overflow:hidden;position:relative"><img class="gw-w-photo-img" src="' + esc(ph.src) + '" alt=""><div style="position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.85);font-size:11px;color:#25262a;padding:4px 8px;text-align:left">照片 · ' + esc(ph.title) + '</div></div>';
};

/* ══════════════════════════════════════════════════════════════════
   三、日历存储（XWLDB 唯一底座；localStorage 只存派生索引）
   后端：'idb'（正常）/ 'ls'（本机不支持 IndexedDB 时的兜底，明确标注、容量有限、
   不随整机备份走）/ 'none'（用户关掉兜底：只放内存里，不假装存上了）。
   ══════════════════════════════════════════════════════════════════ */
var CAL_INDEX_KEY = 'cal_marks_index_v1';
var CAL_LS_MARKS = 'cal_marks_ls_v1';
var CAL_LS_NOTES = 'cal_notes_ls_v1';
var CAL_BACKEND_KEY = 'cal_store_backend_v1';
var CAL_NOTE_MAX = 500; /* 日常上限 500 字（已确认） */
var _idbReadyPromise = null;
var _memMarks = [];
var _memNotes = {};
var idbReady = function () {
  if (_idbReadyPromise) return _idbReadyPromise;
  _idbReadyPromise = (async function () {
    try { if (!window.XWLDB) return false; var db = await window.XWLDB.open(); return !!db; } catch (e) { return false; }
  })();
  return _idbReadyPromise;
};
var calBackend = function () {
  return idbReady().then(function (ok) {
    if (ok) return 'idb';
    var b = lsGet(CAL_BACKEND_KEY, 'ls');
    return b === 'none' ? 'none' : 'ls';
  });
};
var calSetBackend = function (v) { lsSet(CAL_BACKEND_KEY, v === 'none' ? 'none' : 'ls'); };
var calAllMarks = function (backend) {
  if (backend === 'idb') return window.XWLDB.getAll('calendar_marks').then(function (rows) { return Array.isArray(rows) ? rows : []; });
  if (backend === 'ls') return Promise.resolve(lsGet(CAL_LS_MARKS, []));
  return Promise.resolve(_memMarks.slice());
};
var calAllNotes = function (backend) {
  if (backend === 'idb') return window.XWLDB.getAll('calendar_notes').then(function (rows) { return Array.isArray(rows) ? rows : []; });
  if (backend === 'ls') { var o = lsGet(CAL_LS_NOTES, {}); return Promise.resolve(Object.keys(o).map(function (k) { return o[k]; })); }
  return Promise.resolve(Object.keys(_memNotes).map(function (k) { return _memNotes[k]; }));
};
/* 写完 IDB/兜底后同步派生索引，并让桌面周条同步重绘（小组件读索引，不等 IDB） */
var calSyncIndex = function () {
  return calBackend().then(function (backend) {
    if (backend === 'none') { lsSet(CAL_INDEX_KEY, {}); return {}; }
    return Promise.all([calAllMarks(backend), calAllNotes(backend)]).then(function (pair) {
      var idx = {};
      (pair[0] || []).forEach(function (m) {
        if (!m || !m.date) return;
        var e = idx[m.date] || (idx[m.date] = { marks: 0, hasNote: false, together: false });
        e.marks++;
        if (m.tool === 'together') e.together = true;
      });
      (pair[1] || []).forEach(function (n) {
        if (!n || !n.date) return;
        var e2 = idx[n.date] || (idx[n.date] = { marks: 0, hasNote: false, together: false });
        e2.hasNote = !!(n.text && String(n.text).trim());
      });
      lsSet(CAL_INDEX_KEY, idx);
      try { if (window.GroupW && GroupW.renderWidgets) GroupW.renderWidgets(); } catch (e) {}
      return idx;
    });
  });
};
var calPutMark = function (mark) {
  return calBackend().then(function (backend) {
    if (backend === 'idb') return window.XWLDB.put('calendar_marks', mark).then(function () { return calSyncIndex(); });
    if (backend === 'ls') { var arr = lsGet(CAL_LS_MARKS, []); arr.push(mark); lsSet(CAL_LS_MARKS, arr); return calSyncIndex(); }
    _memMarks.push(mark); return {};
  });
};
var calDeleteMark = function (id) {
  return calBackend().then(function (backend) {
    if (backend === 'idb') return window.XWLDB.delete('calendar_marks', id).then(function () { return calSyncIndex(); });
    if (backend === 'ls') { lsSet(CAL_LS_MARKS, lsGet(CAL_LS_MARKS, []).filter(function (m) { return m.id !== id; })); return calSyncIndex(); }
    _memMarks = _memMarks.filter(function (m) { return m.id !== id; }); return {};
  });
};
var calPutNote = function (date, text) {
  var rec = { date: date, text: String(text || '').slice(0, CAL_NOTE_MAX), updatedAt: Date.now() };
  return calBackend().then(function (backend) {
    if (backend === 'idb') return window.XWLDB.put('calendar_notes', rec).then(function () { return calSyncIndex(); });
    if (backend === 'ls') { var o = lsGet(CAL_LS_NOTES, {}); o[date] = rec; lsSet(CAL_LS_NOTES, o); return calSyncIndex(); }
    _memNotes[date] = rec; return {};
  });
};
var calDeleteNote = function (date) {
  return calBackend().then(function (backend) {
    if (backend === 'idb') return window.XWLDB.delete('calendar_notes', date).then(function () { return calSyncIndex(); });
    if (backend === 'ls') { var o = lsGet(CAL_LS_NOTES, {}); delete o[date]; lsSet(CAL_LS_NOTES, o); return calSyncIndex(); }
    delete _memNotes[date]; return {};
  });
};
var calLoadMonth = function (y, m0) {
  var prefix = y + '-' + p2(m0 + 1);
  return calBackend().then(function (backend) {
    return Promise.all([calAllMarks(backend), calAllNotes(backend)]).then(function (pair) {
      var marks = (pair[0] || []).filter(function (m) { return m && m.date && String(m.date).indexOf(prefix) === 0; });
      var notes = {};
      (pair[1] || []).forEach(function (n) { if (n && n.date && String(n.date).indexOf(prefix) === 0) notes[n.date] = n; });
      return { backend: backend, marks: marks, notes: notes };
    });
  });
};
var calSaveLastMonth = function (ym) {
  idbReady().then(function (ok) { if (ok) { try { window.XWLDB.put('calendar_meta', { key: 'lastViewedMonth', value: ym }); } catch (e) {} } });
};
var calLoadLastMonth = function () {
  return idbReady().then(function (ok) {
    if (!ok) return null;
    return window.XWLDB.get('calendar_meta', 'lastViewedMonth').then(function (rec) {
      if (rec && typeof rec.value === 'string' && /^\d{4}-\d{2}$/.test(rec.value)) return rec.value;
      return null;
    });
  });
};

/* ══════════════════════════════════════════════════════════════════
   四、日历 app（AppManager 'calendar'，全屏页；点按才进）
   布局（320x568 验算）：顶栏约 44px + 星期头 20px + 月历 6 行 x 52px + 工具栏约 48px，
   格子约 38x52px，手指可画、可点。默认点按 = 打开当天；画笔开关开着才画画。
   “一起记住”是专用标记类型（双圈 + 小粉爱心），经现有候选审阅才进记忆，绝不自动进召回。
   ══════════════════════════════════════════════════════════════════ */
var CAL_CAND_KEY = 'phone_an_candidates_v1';
var calState = { view: null, pen: false, tool: 'circle', day: null, undo: [], drawing: null, month: null, backend: 'idb' };
var calMonthTitle = function (y, m0) { return y + '年' + (m0 + 1) + '月'; };
var calShellHTML = function () {
  return '<div class="xwl-cal">'
    + '<div class="xwl-cal-head"><button type="button" data-cal-nav="-1" aria-label="上个月">‹</button>'
    + '<div class="xwl-cal-title" id="xwl-cal-title">日历</div>'
    + '<button type="button" data-cal-nav="1" aria-label="下个月">›</button>'
    + '<button type="button" data-cal-today>今天</button>'
    + '<button type="button" data-cal-pen id="xwl-cal-pen">画笔：关</button></div>'
    + '<div class="xwl-cal-week">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>'
    + '<div class="xwl-cal-grid" id="xwl-cal-grid"></div>'
    + '<div class="xwl-cal-tools" id="xwl-cal-tools">'
    + ['circle', 'star', 'check', 'together', 'free', 'eraser'].map(function (t) {
        return '<button type="button" data-cal-tool="' + t + '" class="' + (calState.tool === t ? 'on' : '') + '">' + TOOL_LABEL[t] + '</button>';
      }).join('')
    + '<button type="button" data-cal-undo>撤销</button></div>'
    + '<div class="xwl-cal-foot" id="xwl-cal-foot"></div>'
    + '<div class="xwl-cal-sheet" id="xwl-cal-sheet" hidden></div>'
    + '</div>';
};
var calGridHTML = function (cells, marksByDate, notes, annMap) {
  return cells.map(function (c) {
    var marks = marksByDate[c.date] || [];
    var svg = marks.map(markSVG).join('');
    var md = c.date.split('-');
    var anns = annMap[(+md[1]) + '-' + (+md[2])] || [];
    var dots = '';
    if (anns.length) dots += '<i class="xwl-cal-dot" style="background:#1e2748"></i>';
    if (notes[c.date]) dots += '<i class="xwl-cal-dot" style="background:#8E8E93"></i>';
    return '<div class="xwl-cal-cell' + (c.inMonth ? '' : ' other') + (c.isToday ? ' today' : '') + '" data-date="' + c.date + '">'
      + '<span class="xwl-cal-num">' + c.day + '</span>'
      + '<svg class="xwl-cal-draw" viewBox="0 0 100 100" preserveAspectRatio="none">' + svg + '</svg>'
      + (dots ? '<span class="xwl-cal-dots">' + dots + '</span>' : '')
      + '</div>';
  }).join('');
};
var calRefresh = function (win) {
  if (!win) return;
  if (!calState.view) {
    var now = new Date();
    calState.view = { y: now.getFullYear(), m: now.getMonth() };
    calLoadLastMonth().then(function (ym) {
      if (!ym || !calState.view) return;
      var p = ym.split('-');
      var y = +p[0], m = (+p[1]) - 1;
      var cur = new Date();
      if (y === cur.getFullYear() && m === cur.getMonth()) return;
      calState.view = { y: y, m: m };
      calRefresh(win);
    });
  }
  var y = calState.view.y, m = calState.view.m;
  var title = win.querySelector('#xwl-cal-title');
  if (title) title.textContent = calMonthTitle(y, m);
  var penBtn = win.querySelector('#xwl-cal-pen');
  if (penBtn) { penBtn.textContent = '画笔：' + (calState.pen ? '开' : '关'); penBtn.classList.toggle('on', calState.pen); }
  var tools = win.querySelector('#xwl-cal-tools');
  if (tools) tools.querySelectorAll('[data-cal-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cal-tool') === calState.tool); });
  var grid = win.querySelector('#xwl-cal-grid');
  if (grid) grid.style.touchAction = calState.pen ? 'none' : '';
  calLoadMonth(y, m).then(function (res) {
    calState.month = res;
    calState.backend = res.backend;
    var marksByDate = {};
    res.marks.forEach(function (mk) { (marksByDate[mk.date] = marksByDate[mk.date] || []).push(mk); });
    var cells = monthGrid(y, m);
    if (grid) grid.innerHTML = calGridHTML(cells, marksByDate, res.notes, anniversaryByMD());
    var foot = win.querySelector('#xwl-cal-foot');
    if (foot) {
      if (res.backend === 'idb') foot.innerHTML = '<span>标记存在本机 IndexedDB，随整机备份走。</span>';
      else if (res.backend === 'ls') foot.innerHTML = '<span>本机不支持 IndexedDB，标记存在 localStorage 临时区（容量有限，不随整机备份走）。</span> <button type="button" data-cal-backend="none">关掉临时保存</button>';
      else foot.innerHTML = '<span>临时保存已关：标记只放内存里，关掉页面就没了。</span> <button type="button" data-cal-backend="ls">打开临时保存</button>';
    }
    calSaveLastMonth(y + '-' + p2(m + 1));
  });
};
var calTodaySchedule = function (dateStr) {
  var items = lsGet('phone_schedule_v1', []);
  if (!Array.isArray(items)) return [];
  return items.filter(function (it) { return it && it.date === dateStr && it.title; }).sort(function (a, b) { return String(a.time || '') < String(b.time || '') ? -1 : 1; }).slice(0, 3);
};
var calOpenDay = function (win, dateStr) {
  var sheet = win.querySelector('#xwl-cal-sheet');
  if (!sheet) return;
  calState.day = dateStr;
  var d = parseYMD(dateStr) || new Date();
  var wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  var res = calState.month || { marks: [], notes: {} };
  var marks = (res.marks || []).filter(function (m) { return m.date === dateStr; });
  var note = res.notes[dateStr];
  var md = dateStr.split('-');
  var anns = (anniversaryByMD()[(+md[1]) + '-' + (+md[2])] || []);
  var sched = calTodaySchedule(dateStr);
  var hasTogether = marks.some(function (m) { return m.tool === 'together'; });
  var markRows = marks.length ? marks.map(function (m) {
    var t = m.createdAt ? new Date(m.createdAt) : null;
    var ts = t ? p2(t.getHours()) + ':' + p2(t.getMinutes()) : '';
    return '<div class="xwl-cal-markrow"><span>' + esc(TOOL_LABEL[m.tool] || m.tool) + (ts ? ' · ' + ts : '') + '</span><button type="button" data-cal-mark-del="' + esc(m.id) + '">删除</button></div>';
  }).join('') : '<div class="xwl-cal-empty">这一天还没有画过标记。</div>';
  sheet.innerHTML = '<div class="xwl-cal-sheet-h"><div><div class="xwl-cal-sheet-title">' + (+md[1]) + '月' + (+md[2]) + '日 ' + wd + '</div>'
    + '<div class="xwl-cal-sheet-sub">' + esc(dateStr) + '</div></div>'
    + '<button type="button" data-cal-close-sheet>关闭</button></div>'
    + (hasTogether ? '<div class="xwl-cal-together">已圈出想一起记住的日子，要不要记成记忆？<button type="button" data-cal-together>记成记忆</button></div>' : '')
    + (anns.length ? '<div class="xwl-cal-sec">纪念日（只读）</div>' + anns.map(function (a) { return '<div class="xwl-cal-line">' + esc(a.title) + (a.kind ? ' · ' + esc(a.kind) : '') + '</div>'; }).join('') : '')
    + (sched.length ? '<div class="xwl-cal-sec">他今天的安排（只读）</div>' + sched.map(function (s) { return '<div class="xwl-cal-line">' + esc(s.time ? s.time + ' ' : '') + esc(s.title) + '</div>'; }).join('') : '')
    + '<div class="xwl-cal-sec">当天标记</div>' + markRows
    + (marks.length ? '<button type="button" data-cal-clear-day>清除本日笔画</button>' : '')
    + '<div class="xwl-cal-sec">日常</div>'
    + '<textarea id="xwl-cal-note" maxlength="' + CAL_NOTE_MAX + '" rows="3" placeholder="写下今天的一小段日常……">' + esc(note ? note.text : '') + '</textarea>'
    + '<div class="xwl-cal-count"><span id="xwl-cal-count">' + (note ? String(note.text || '').length : 0) + '</span> / ' + CAL_NOTE_MAX + ' 字</div>'
    + '<div class="xwl-cal-sheet-btns"><button type="button" data-cal-save-note>保存日常</button>'
    + (note ? '<button type="button" data-cal-del-note>删除日常</button>' : '')
    + '</div>';
  sheet.hidden = false;
  var ta = sheet.querySelector('#xwl-cal-note');
  if (ta) ta.addEventListener('input', function () {
    var c = sheet.querySelector('#xwl-cal-count');
    if (c) c.textContent = String(ta.value.length);
  });
};
var calCloseDay = function (win) {
  var sheet = win.querySelector('#xwl-cal-sheet');
  if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; }
  calState.day = null;
};
/* “一起记住”→ 候选记忆审阅：只进 phone_an_candidates_v1 待审队列，绝不直接写 guichao.memories.v1 */
var calProposeTogether = function (dateStr, noteText) {
  var md = dateStr.split('-');
  var title = '一起记住的日子：' + (+md[1]) + '月' + (+md[2]) + '日';
  var text = title + (noteText ? '——' + String(noteText).slice(0, 200) : '（在日历上圈出了这一天）');
  try {
    var list = lsGet(CAL_CAND_KEY, []);
    if (Array.isArray(list)) {
      var dup = list.some(function (c) { return c && c.source === 'calendar-together' && c.status === 'pending' && String(c.text || '').indexOf(title) === 0; });
      if (dup) { toast('这条已经在待审里了，去审阅页看看吧。'); return false; }
    }
  } catch (e) {}
  try {
    if (window.GroupAN && GroupAN.proposeMemoryCandidate) {
      var item = GroupAN.proposeMemoryCandidate(text, 'calendar-together');
      if (item) { toast('已放进待审记忆，通过后才进归巢。'); return true; }
    }
  } catch (e) {}
  try {
    var l2 = lsGet(CAL_CAND_KEY, []);
    if (!Array.isArray(l2)) l2 = [];
    l2.push({ id: uid('cd'), text: text.slice(0, 300), source: 'calendar-together', status: 'pending', ts: Date.now(), auto: false });
    lsSet(CAL_CAND_KEY, l2);
    toast('已放进待审记忆，通过后才进归巢。');
    return true;
  } catch (e) { toast('放进待审失败了，再试一次。'); return false; }
};
var calSaveMark = function (win, mark) {
  calPutMark(mark).then(function () {
    calState.undo.push({ action: 'add', mark: mark });
    calRefresh(win);
  });
};
var calMount = function (win) {
  if (!win) return;
  if (!win._xwlCalBound) {
    win._xwlCalBound = true;
    win.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-cal-nav]');
      if (nav) {
        var dir = +nav.getAttribute('data-cal-nav');
        if (!calState.view) calState.view = { y: new Date().getFullYear(), m: new Date().getMonth() };
        var nm = calState.view.m + dir, ny = calState.view.y;
        if (nm < 0) { nm = 11; ny--; }
        if (nm > 11) { nm = 0; ny++; }
        calState.view = { y: ny, m: nm };
        calCloseDay(win);
        calRefresh(win);
        return;
      }
      if (e.target.closest('[data-cal-today]')) {
        var now = new Date();
        calState.view = { y: now.getFullYear(), m: now.getMonth() };
        calCloseDay(win);
        calRefresh(win);
        return;
      }
      if (e.target.closest('[data-cal-pen]')) {
        calState.pen = !calState.pen;
        if (!calState.pen) calState.tool = 'circle';
        calRefresh(win);
        return;
      }
      var toolBtn = e.target.closest('[data-cal-tool]');
      if (toolBtn) {
        calState.tool = toolBtn.getAttribute('data-cal-tool');
        calState.pen = true;
        calRefresh(win);
        return;
      }
      if (e.target.closest('[data-cal-undo]')) {
        var last = calState.undo.pop();
        if (!last) { toast('没有可以撤销的了。'); return; }
        if (last.action === 'add') calDeleteMark(last.mark.id).then(function () { calRefresh(win); });
        else if (last.action === 'del') calPutMark(last.mark).then(function () { calRefresh(win); });
        return;
      }
      var be = e.target.closest('[data-cal-backend]');
      if (be) {
        calSetBackend(be.getAttribute('data-cal-backend'));
        calRefresh(win);
        return;
      }
      if (e.target.closest('[data-cal-close-sheet]')) { calCloseDay(win); return; }
      var delMark = e.target.closest('[data-cal-mark-del]');
      if (delMark) {
        var mid = delMark.getAttribute('data-cal-mark-del');
        var mk = (calState.month && calState.month.marks || []).find(function (m) { return m.id === mid; });
        if (mk) { calState.undo.push({ action: 'del', mark: mk }); calDeleteMark(mid).then(function () { if (calState.day) calOpenDay(win, calState.day); calRefresh(win); }); }
        return;
      }
      if (e.target.closest('[data-cal-clear-day]')) {
        if (!calState.day) return;
        var dayMarks = (calState.month && calState.month.marks || []).filter(function (m) { return m.date === calState.day; });
        if (!dayMarks.length) return;
        var chain = Promise.resolve();
        dayMarks.forEach(function (m) { chain = chain.then(function () { return calDeleteMark(m.id); }); });
        chain.then(function () { if (calState.day) calOpenDay(win, calState.day); calRefresh(win); });
        return;
      }
      if (e.target.closest('[data-cal-save-note]')) {
        if (!calState.day) return;
        if (calState.backend === 'none') { toast('临时保存已关，日常现在存不下来。'); return; }
        var ta = win.querySelector('#xwl-cal-note');
        var txt = ta ? ta.value : '';
        if (!txt.trim()) { toast('日常是空的，写点什么再保存。'); return; }
        calPutNote(calState.day, txt).then(function () { toast('日常已保存。'); if (calState.day) calOpenDay(win, calState.day); calRefresh(win); });
        return;
      }
      if (e.target.closest('[data-cal-del-note]')) {
        if (!calState.day) return;
        calDeleteNote(calState.day).then(function () { if (calState.day) calOpenDay(win, calState.day); calRefresh(win); });
        return;
      }
      if (e.target.closest('[data-cal-together]')) {
        if (!calState.day) return;
        var note = (calState.month && calState.month.notes || {})[calState.day];
        calProposeTogether(calState.day, note ? note.text : '');
        return;
      }
      var cell = e.target.closest('.xwl-cal-cell');
      if (cell && !calState.pen) calOpenDay(win, cell.getAttribute('data-date'));
    });
    /* 手写层：Pointer Events + touch-action:none（画笔开着才画画；默认点按 = 打开当天） */
    var grid = win.querySelector('#xwl-cal-grid');
    if (grid) {
      var normPoint = function (ev, cell) {
        var r = cell.getBoundingClientRect();
        if (!r.width || !r.height) return { x: 50, y: 50 };
        return { x: clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100), y: clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100) };
      };
      grid.addEventListener('pointerdown', function (ev) {
        if (!calState.pen) return;
        var cell = ev.target.closest('.xwl-cal-cell');
        if (!cell) return;
        ev.preventDefault();
        var dateStr = cell.getAttribute('data-date');
        if (calState.tool === 'eraser') {
          var g = ev.target.closest('g[data-mid]');
          if (!g) { toast('点一下要擦掉的那一笔。'); return; }
          var mid = g.getAttribute('data-mid');
          var mk = (calState.month && calState.month.marks || []).find(function (m) { return m.id === mid; });
          if (mk) { calState.undo.push({ action: 'del', mark: mk }); calDeleteMark(mid).then(function () { calRefresh(win); }); }
          return;
        }
        if (calState.tool === 'free') {
          var svg = cell.querySelector('svg.xwl-cal-draw');
          if (!svg) return;
          var pt = normPoint(ev, cell);
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', TOOL_COLOR.free);
          path.setAttribute('stroke-width', '2.5');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('d', 'M' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1));
          svg.appendChild(path);
          calState.drawing = { date: dateStr, cell: cell, path: path, points: [[pt.x, pt.y]] };
          return;
        }
        var shape = defaultShapeAt(calState.tool, normPoint(ev, cell).x, normPoint(ev, cell).y);
        if (!shape) return;
        var mark = { id: 'mk_' + dateStr + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), date: dateStr, tool: calState.tool, color: TOOL_COLOR[calState.tool], shape: shape, createdAt: Date.now(), updatedAt: Date.now() };
        calSaveMark(win, mark);
      });
      grid.addEventListener('pointermove', function (ev) {
        var dr = calState.drawing;
        if (!dr) return;
        ev.preventDefault();
        var pt = normPoint(ev, dr.cell);
        var last = dr.points[dr.points.length - 1];
        if (Math.abs(pt.x - last[0]) < 3 && Math.abs(pt.y - last[1]) < 3) return;
        if (dr.points.length >= 200) return; /* 单条笔画上限 200 点，超出截断 */
        dr.points.push([pt.x, pt.y]);
        dr.path.setAttribute('d', 'M' + dr.points.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L'));
      });
      var endDraw = function () {
        var dr = calState.drawing;
        calState.drawing = null;
        if (!dr) return;
        if (dr.points.length < 2) { try { dr.path.remove(); } catch (e) {} return; }
        var mark = { id: 'mk_' + dr.date + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), date: dr.date, tool: 'free', color: TOOL_COLOR.free, shape: { kind: 'path', points: dr.points }, createdAt: Date.now(), updatedAt: Date.now() };
        calSaveMark(win, mark);
      };
      grid.addEventListener('pointerup', endDraw);
      grid.addEventListener('pointercancel', function () { var dr = calState.drawing; calState.drawing = null; if (dr) { try { dr.path.remove(); } catch (e) {} } });
    }
  }
  calRefresh(win);
};
var openCalendar = function () { launchApp('calendar'); };
try {
  if (typeof AppManager !== 'undefined' && AppManager && AppManager.register) {
    AppManager.register('calendar', {
      render: function () { return calShellHTML(); },
      mount: function (win) { calMount(win); },
      resume: function (win) { calRefresh(win); },
      show: function (win) { calRefresh(win); }
    });
  }
} catch (e) {}

/* ══════════════════════════════════════════════════════════════════
   五、home 弹书小屋小组件（第 5 项）
   只借 unfold 的思路不搬代码（见块头许可）；走手机已有的 CSS 3D 路子，不用 three.js。
   图存 XWLDB widget_assets（与日历共用 'xiaoweilai' 库），localStorage 只存小指针。
   小人是 unfold 式平面纸卡、立在地面上、随场景组绕竖轴转而始终直立；轻摆 +-30 度，
   只在用户点按时才转（一次 1.2 秒），不自动转；空状态房子也转（同一规则），绝不预填假人。
   ══════════════════════════════════════════════════════════════════ */
var PH_POINTER_KEY = 'gw_popuphouse_v1';
var PH_ASSET_ID = 'popuphouse_person';
var PH_MAX_BYTES = 2 * 1024 * 1024; /* 只收 PNG，<=2MB（已确认） */
var PH_MAX_EDGE = 512; /* 长边压 512px（已确认） */
var _phObjUrl = null;
var phPointer = function () { var v = lsGet(PH_POINTER_KEY, null); return (v && typeof v === 'object') ? v : { hasImage: false, assetId: PH_ASSET_ID, name: '', width: 0, height: 0, updatedAt: 0 }; };
var phSavePointer = function (p) { lsSet(PH_POINTER_KEY, p); };
var phValidateFile = function (file) {
  if (!file) return { ok: false, reason: '没有选到文件。' };
  var name = String(file.name || '');
  var isPng = file.type === 'image/png' || /\.png$/i.test(name);
  if (!isPng) return { ok: false, reason: '只收 PNG（JPG 不要）。请换一张 PNG，或先去背景再存。' };
  if (file.size > PH_MAX_BYTES) return { ok: false, reason: '这张图 ' + (file.size / 1048576).toFixed(1) + 'MB，超过 2MB 上限，请换一张小一点的。' };
  return { ok: true };
};
/* 图片 → 长边 <=512 的 PNG Blob（canvas 本地重编码，图片不上传） */
var phDownscaleToBlob = function (img) {
  return new Promise(function (resolve, reject) {
    try {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) { reject(new Error('读不到图片尺寸')); return; }
      var scale = Math.min(1, PH_MAX_EDGE / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      if (cv.toBlob) cv.toBlob(function (b) { b ? resolve({ blob: b, width: cw, height: ch }) : reject(new Error('转 PNG 失败')); }, 'image/png');
      else { var dataUrl = cv.toDataURL('image/png'); fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (b) { resolve({ blob: b, width: cw, height: ch }); }, reject); }
    } catch (e) { reject(e); }
  });
};
var phLoadImage = function (file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('这张图打不开。')); };
    img.src = url;
  });
};
var phSaveImage = function (blob, name, width, height) {
  return idbReady().then(function (ok) {
    if (!ok) { toast('本机不支持 IndexedDB，小人图片无法保存。'); return false; }
    return window.XWLDB.put('widget_assets', { id: PH_ASSET_ID, blob: blob, name: name || '小人.png', width: width, height: height, updatedAt: Date.now() }).then(function () {
      try { if (_phObjUrl) URL.revokeObjectURL(_phObjUrl); } catch (e) {}
      _phObjUrl = null;
      phSavePointer({ hasImage: true, assetId: PH_ASSET_ID, name: name || '小人.png', width: width, height: height, updatedAt: Date.now() });
      refreshHouseImages();
      try { if (window.GroupW && GroupW.renderWidgets) GroupW.renderWidgets(); } catch (e) {}
      return true;
    });
  });
};
var removePopupHouseImage = function () {
  var done = function () {
    try { if (_phObjUrl) URL.revokeObjectURL(_phObjUrl); } catch (e) {}
    _phObjUrl = null;
    phSavePointer({ hasImage: false, assetId: PH_ASSET_ID, name: '', width: 0, height: 0, updatedAt: 0 });
    try { if (window.GroupW && GroupW.renderWidgets) GroupW.renderWidgets(); } catch (e) {}
    toast('小人已移除，房子回到空状态。');
  };
  idbReady().then(function (ok) {
    if (ok) { try { window.XWLDB.delete('widget_assets', PH_ASSET_ID).then(done, done); return; } catch (e) {} }
    done();
  });
};
/* 小组件里的图：widgetHTML 是同步拼字符串，IDB 是异步的——先画框/剪影，blob 回来再把 <img> 换成真图 */
var refreshHouseImages = function () {
  var imgs = document.querySelectorAll('img[data-ph-img]');
  if (!imgs.length) return;
  if (_phObjUrl) {
    imgs.forEach(function (im) { if (im.getAttribute('src') !== _phObjUrl) im.src = _phObjUrl; im.setAttribute('data-ph-done', '1'); });
    return;
  }
  var p = phPointer();
  if (!p || !p.hasImage) return;
  idbReady().then(function (ok) {
    if (!ok) return;
    return window.XWLDB.get('widget_assets', PH_ASSET_ID).then(function (rec) {
      if (!rec || !rec.blob) return;
      try { _phObjUrl = URL.createObjectURL(rec.blob); } catch (e) { return; }
      document.querySelectorAll('img[data-ph-img]').forEach(function (im) { im.src = _phObjUrl; im.setAttribute('data-ph-done', '1'); });
    });
  });
};
var popupHouseHTML = function (item) {
  var opts = (item && item.opts) || {};
  var room = opts.room || 'living';
  var open = !!opts.open;
  var rooms = otomeRooms();
  var cur = null;
  rooms.forEach(function (r) { if (r.id === room) cur = r; });
  var p = phPointer();
  var person = '';
  if (_phObjUrl) person = '<img class="gw-ph-person-img" src="' + esc(_phObjUrl) + '" alt="小人">';
  else if (p && p.hasImage) person = '<img class="gw-ph-person-img" data-ph-img="1" src="" alt="小人">';
  else person = '<div class="gw-ph-silhouette"></div><div class="gw-ph-empty">放一张 PNG 小人进来</div>';
  return '<div class="gw-ph' + (open ? ' ph-open' : '') + '" data-gw-tap="popuphouse">'
    + '<div class="gw-ph-title">home · ' + esc(cur ? cur.name : '客厅') + '</div>'
    + '<div class="gw-ph-stage"><div class="gw-ph-scene-wrap"><div class="gw-ph-scene">'
    + '<div class="gw-ph-rooms">' + renderRoomsHTML(rooms, room, { interactive: false }) + '</div>'
    + '<div class="gw-ph-person">' + person + '</div>'
    + '</div></div></div>'
    + '<div class="gw-ph-hint">点一下开书 · 点两下回家 · 左右拖换房间</div>'
    + '</div>';
};
var phUpdateItem = function (wid, fn) {
  var g = null;
  try { g = window.GroupW; } catch (e) {}
  if (!g || !g.widgetLoad || !g.widgetSave) return false;
  var w = g.widgetLoad();
  var it = null;
  (w.items || []).forEach(function (x) { if (x.id === wid) it = x; });
  if (!it) return false;
  it.opts = it.opts || {};
  fn(it.opts);
  try { g.widgetSave(w); } catch (e) { return false; }
  try { if (g.renderWidgets) g.renderWidgets(); } catch (e) {}
  return true;
};
var popupHouseCycle = function (wid, dir) {
  var rooms = otomeRooms();
  var ids = rooms.map(function (r) { return r.id; });
  phUpdateItem(wid, function (opts) {
    var i = ids.indexOf(opts.room || 'living');
    if (i < 0) i = 0;
    opts.room = ids[(i + dir + ids.length) % ids.length];
  });
};
var popupHouseTap = function (wid) {
  var p = phPointer();
  if (!p || !p.hasImage) { openPopupHouseUpload(); return; } /* 空状态点按 → 直接打开上传页 */
  var wasOpen = false;
  var g = null;
  try { g = window.GroupW; } catch (e) {}
  if (g && g.widgetLoad) { var w = g.widgetLoad(); (w.items || []).forEach(function (x) { if (x.id === wid && x.opts && x.opts.open) wasOpen = true; }); }
  phUpdateItem(wid, function (opts) { opts.open = !wasOpen; });
  /* 点一下 = 开书展开（书页扇形展开、场景轻摆到正面，这就是“转”）：轻摆 +-30 度一次 1.2 秒 */
  var el = document.querySelector('.gw-widget[data-gw-wid="' + wid + '"]');
  if (el) {
    el.classList.add('ph-sway');
    setTimeout(function () { try { el.classList.remove('ph-sway'); } catch (e) {} }, 1300);
  }
};
var popupHouseGoHome = function () {
  launchApp('wechat');
  setTimeout(function () {
    var eng = wxEngine();
    try { if (eng && eng.openOtomeHome) eng.openOtomeHome(); } catch (e) {}
  }, 400);
};
var openPopupHouseUpload = function () {
  var old = document.getElementById('gw-ph-upload');
  if (old) old.remove();
  var f = otomeF();
  var custom = null;
  try { if (f && f.activeCustomChar) custom = f.activeCustomChar(); } catch (e) {}
  var p = phPointer();
  var ov = document.createElement('div');
  ov.className = 'gw-ph-upload';
  ov.id = 'gw-ph-upload';
  ov.innerHTML = '<div class="gw-ph-up-card">'
    + '<div class="gw-ph-up-title">home · 小人图片</div>'
    + '<div class="gw-ph-up-preview" id="gw-ph-up-preview"><span style="font-size:12px;color:#8E8E93">还没有选图</span></div>'
    + '<div class="gw-ph-up-note">只收 PNG（JPG 不要），≤2MB；长边压到 512px，存在本机 IndexedDB，不上传。</div>'
    + '<label class="gw-ph-up-btn">选择 PNG 图片<input id="gw-ph-up-file" type="file" accept="image/png" style="display:none"></label>'
    + (custom ? '<button type="button" class="gw-ph-up-btn" data-ph-act="usecutout">用现在的抠图人物</button>' : '')
    + '<button type="button" class="gw-ph-up-btn" data-ph-act="removebg" id="gw-ph-up-removebg" disabled>去背景（OtomeF.removeBg）</button>'
    + '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="gw-ph-up-btn primary" data-ph-act="save" id="gw-ph-up-save" disabled>保存</button>'
    + '<button type="button" class="gw-ph-up-btn" data-ph-act="cancel">取消</button>'
    + (p && p.hasImage ? '<button type="button" class="gw-ph-up-btn danger" data-ph-act="remove">移除立绘</button>' : '')
    + '</div></div>';
  (document.getElementById('sys-desktop-layer') || document.body).appendChild(ov);
  var pending = null; /* { blob, name, width, height } */
  var preview = ov.querySelector('#gw-ph-up-preview');
  var saveBtn = ov.querySelector('#gw-ph-up-save');
  var bgBtn = ov.querySelector('#gw-ph-up-removebg');
  var setPending = function (res, name) {
    pending = { blob: res.blob, name: name, width: res.width, height: res.height };
    try { preview.innerHTML = '<img src="' + URL.createObjectURL(res.blob) + '" alt="预览" style="max-width:100%;max-height:120px;object-fit:contain">'; } catch (e) {}
    saveBtn.disabled = false;
    bgBtn.disabled = false;
  };
  ov.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ph-act]');
    if (!b) return;
    var act = b.getAttribute('data-ph-act');
    if (act === 'cancel') { ov.remove(); return; }
    if (act === 'remove') { ov.remove(); removePopupHouseImage(); return; }
    if (act === 'save') {
      if (!pending) return;
      saveBtn.disabled = true;
      phSaveImage(pending.blob, pending.name, pending.width, pending.height).then(function (ok) {
        ov.remove();
        if (ok) toast('小人已放进 home。');
      });
      return;
    }
    if (act === 'usecutout') {
      if (!custom || !custom.dataUrl) { toast('此刻还没有抠图人物。'); return; }
      fetch(custom.dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
        var v = phValidateFile({ name: (custom.name || '抠图人物') + '.png', type: 'image/png', size: blob.size });
        if (!v.ok) { toast(v.reason); return; }
        return phLoadImage(blob).then(function (img) { return phDownscaleToBlob(img); }).then(function (res) { setPending(res, (custom.name || '抠图人物') + '.png'); });
      }).catch(function () { toast('抠图人物读不出来，换一张 PNG 试试。'); });
      return;
    }
    if (act === 'removebg') {
      if (!pending) return;
      var ff = otomeF();
      if (!ff || !ff.removeBg) { toast('去背景现在不可用，直接保存原图吧。'); return; }
      phLoadImage(pending.blob).then(function (img) {
        var cv = document.createElement('canvas');
        cv.width = pending.width; cv.height = pending.height;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, pending.width, pending.height);
        var imgData = ctx.getImageData(0, 0, pending.width, pending.height);
        var cut = ff.removeBg({ width: pending.width, height: pending.height, data: imgData.data }, 60);
        var out = ctx.createImageData(pending.width, pending.height);
        out.data.set(cut.data);
        ctx.putImageData(out, 0, 0);
        return new Promise(function (resolve, reject) { cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('转 PNG 失败')); }, 'image/png'); });
      }).then(function (blob) {
        setPending({ blob: blob, width: pending.width, height: pending.height }, pending.name);
        toast('背景已去掉，点保存放进 home。');
      }).catch(function () { toast('去背景失败了，原图还在，点保存直接用原图。'); });
      return;
    }
  });
  var fileInput = ov.querySelector('#gw-ph-up-file');
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var v = phValidateFile(file);
    if (!v.ok) { toast(v.reason); fileInput.value = ''; return; }
    phLoadImage(file).then(function (img) { return phDownscaleToBlob(img); }).then(function (res) { setPending(res, file.name); }).catch(function () { toast('这张图打不开，换一张 PNG 试试。'); });
  });
};

/* ── 日历页 + 上传浮层的样式（本组自有命名空间 xwl-cal / gw-ph-up，不碰别组样式） ── */
var WIDGET_CSS = [
  '.xwl-cal{position:absolute;inset:0;background:#fbf9f4;color:#25262a;box-sizing:border-box;display:flex;flex-direction:column;font-size:14px;overflow:hidden}',
  '.xwl-cal-head{display:flex;align-items:center;gap:6px;padding:12px 12px 6px}',
  '.xwl-cal-head button{border:1px solid #ececef;background:#fff;border-radius:10px;padding:7px 10px;font-size:14px;color:#25262a;cursor:pointer}',
  '.xwl-cal-head button.on{background:#1e2748;color:#fff;border-color:#1e2748}',
  '.xwl-cal-title{flex:1;font-size:17px;font-weight:700;text-align:center}',
  '.xwl-cal-week{display:grid;grid-template-columns:repeat(7,1fr);padding:2px 8px;font-size:11px;color:#8E8E93;text-align:center}',
  '.xwl-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:52px;gap:2px;padding:0 8px}',
  '.xwl-cal-cell{position:relative;border-radius:8px;background:#fff;border:1px solid #f0ede8;overflow:hidden}',
  '.xwl-cal-cell.other{opacity:.38}',
  '.xwl-cal-cell.today{border-color:#1e2748}',
  '.xwl-cal-cell.today .xwl-cal-num{background:#34363b;color:#fff;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center}',
  '.xwl-cal-num{position:absolute;left:3px;top:3px;font-size:12px;color:#25262a;z-index:2}',
  '.xwl-cal-draw{position:absolute;inset:0;width:100%;height:100%;touch-action:none;z-index:1}',
  '.xwl-cal-dots{position:absolute;right:3px;bottom:3px;display:flex;gap:2px;z-index:2}',
  '.xwl-cal-dot{width:5px;height:5px;border-radius:50%;display:inline-block}',
  '.xwl-cal-tools{display:flex;gap:6px;padding:10px 12px 4px;flex-wrap:wrap}',
  '.xwl-cal-tools button{border:1px solid #ececef;background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;color:#25262a;cursor:pointer}',
  '.xwl-cal-tools button.on{background:#1e2748;color:#fff;border-color:#1e2748}',
  '.xwl-cal-foot{padding:6px 14px 10px;font-size:11px;color:#8E8E93;line-height:1.6}',
  '.xwl-cal-foot button{border:1px solid #ececef;background:#fff;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer}',
  '.xwl-cal-sheet{position:absolute;left:0;right:0;bottom:0;max-height:78%;overflow-y:auto;background:#fff;border-top:1px solid #ececef;border-radius:16px 16px 0 0;padding:14px 16px 20px;box-shadow:0 -6px 24px rgba(0,0,0,.14);z-index:5;box-sizing:border-box}',
  '.xwl-cal-sheet-h{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
  '.xwl-cal-sheet-title{font-size:17px;font-weight:700}',
  '.xwl-cal-sheet-sub{font-size:11px;color:#8E8E93;margin-top:2px}',
  '.xwl-cal-sheet-h button,.xwl-cal-sheet-btns button{border:1px solid #ececef;background:#f7f7f8;border-radius:10px;padding:8px 12px;font-size:13px;cursor:pointer}',
  '.xwl-cal-together{margin:10px 0;padding:10px 12px;background:#fdf2f4;border:1px solid #E8C9D0;border-radius:12px;font-size:13px;line-height:1.6}',
  '.xwl-cal-together button{border:0;background:#1e2748;color:#fff;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;margin-left:6px}',
  '.xwl-cal-sec{font-size:12px;font-weight:700;color:#55555c;margin:12px 0 4px}',
  '.xwl-cal-line{font-size:13px;line-height:1.7;color:#25262a}',
  '.xwl-cal-markrow{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid #f4f2ef}',
  '.xwl-cal-markrow button{border:1px solid #ececef;background:#fff;border-radius:8px;padding:4px 10px;font-size:12px;color:#FF3B30;cursor:pointer}',
  '.xwl-cal-empty{font-size:12px;color:#8E8E93;padding:4px 0}',
  '.xwl-cal-sheet textarea{width:100%;box-sizing:border-box;border:1px solid #ececef;border-radius:10px;padding:10px;font-size:14px;line-height:1.7;resize:vertical}',
  '.xwl-cal-count{font-size:11px;color:#8E8E93;text-align:right;margin-top:4px}',
  '.xwl-cal-sheet-btns{display:flex;gap:8px;margin-top:10px}',
  '.gw-ph-upload{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10006;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}',
  '.gw-ph-up-card{background:#fffdf8;border-radius:16px;padding:18px;width:100%;max-width:320px;box-sizing:border-box;box-shadow:0 12px 32px rgba(0,0,0,.25)}',
  '.gw-ph-up-title{font-size:16px;font-weight:700;color:#25262a;margin-bottom:10px}',
  '.gw-ph-up-preview{min-height:90px;display:flex;align-items:center;justify-content:center;background:#f7f7f8;border:1px dashed #d8d2c8;border-radius:12px;padding:8px;box-sizing:border-box}',
  '.gw-ph-up-note{font-size:12px;color:#8E8E93;line-height:1.6;margin:10px 0}',
  '.gw-ph-up-btn{display:block;width:100%;border:1px solid #ececef;background:#fff;border-radius:10px;padding:10px;font-size:14px;color:#25262a;cursor:pointer;margin-top:8px;box-sizing:border-box;text-align:center}',
  '.gw-ph-up-btn.primary{background:#1e2748;color:#fff;border-color:#1e2748}',
  '.gw-ph-up-btn.danger{color:#FF3B30}',
  '.gw-ph-up-btn:disabled{opacity:.45;cursor:default}'
].join('\n');
try {
  if (!document.getElementById('xwl-widget-css')) {
    var _st = document.createElement('style');
    _st.id = 'xwl-widget-css';
    _st.textContent = WIDGET_CSS;
    (document.head || document.documentElement).appendChild(_st);
  }
} catch (e) {}

/* ── home 图片填充：renderWidgets 换掉行 innerHTML 时由 MutationObserver 补图 ── */
var _phObserver = null;
var setupHouseObserver = function () {
  if (_phObserver) return;
  try {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    _phObserver = new MutationObserver(function () { refreshHouseImages(); });
    _phObserver.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setupHouseObserver(); refreshHouseImages(); });
else { setupHouseObserver(); refreshHouseImages(); }
try { document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshHouseImages(); }); } catch (e) {}

/* ── 对外出口（测试与 GW 薄分支用） ── */
window.GroupWIDGET = {
  OtomeHouse: window.OtomeHouse,
  monthGrid: monthGrid, weekOf: weekOf, shapeInner: shapeInner, markSVG: markSVG,
  defaultShapeAt: defaultShapeAt, starPoints: starPoints,
  calIndexLoad: calIndexLoad, anniversaryByMD: anniversaryByMD, calNextMark: calNextMark,
  calWeekStripHTML: calWeekStripHTML, anniversaryHTML: anniversaryHTML, musicHTML: musicHTML, photoHTML: photoHTML,
  nextAnniversary: nextAnniversary, musicState: musicState, latestPhoto: latestPhoto,
  CAL_NOTE_MAX: CAL_NOTE_MAX, CAL_INDEX_KEY: CAL_INDEX_KEY,
  calBackend: calBackend, calSetBackend: calSetBackend, calLoadMonth: calLoadMonth,
  calPutMark: calPutMark, calDeleteMark: calDeleteMark, calPutNote: calPutNote, calDeleteNote: calDeleteNote,
  calSyncIndex: calSyncIndex, calProposeTogether: calProposeTogether,
  openCalendar: openCalendar, calShellHTML: calShellHTML, calGridHTML: calGridHTML, calMount: calMount, calRefresh: calRefresh,
  PH_MAX_BYTES: PH_MAX_BYTES, PH_MAX_EDGE: PH_MAX_EDGE,
  phPointer: phPointer, phValidateFile: phValidateFile, phDownscaleToBlob: phDownscaleToBlob, phSaveImage: phSaveImage,
  popupHouseHTML: popupHouseHTML, popupHouseTap: popupHouseTap, popupHouseCycle: popupHouseCycle,
  popupHouseGoHome: popupHouseGoHome, openPopupHouseUpload: openPopupHouseUpload,
  removePopupHouseImage: removePopupHouseImage, refreshHouseImages: refreshHouseImages
};
})();
