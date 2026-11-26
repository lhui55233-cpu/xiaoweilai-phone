
/* ══════════ GROUP-AW-PLATEN-VN-WENYOU · Platen 慢递/定时信 + 剧本视觉小说 + 文游 ══════════
   Platen（Jerry Nkongolo @raffiki_art 2026-10-08 帖，Platen Letters 早期原型）：
   只借三样思路——(1) 信不是即时到，(2) 写给未来的定时信，(3) 一列白色信封
   纵向叠放的信箱列表视觉。不搬 Platen 代码、不用作者原信件文字、不搬底部导航。
   [GROUP-FIX16] 视觉小说按 SakiEngine（MIT）重做：SKS 为第一档导入格式
   （label/scene/show/menu/endmenu/return/nvl/多语言片段/转场，见 parseSKSVN
   前的注释；jump/call/if/music/video 是手机本地扩展，非已核实 SKS 语法），
   解析后转手机内部 JSON 模型再保存，仍是一套运行时模型；播放器 1280×720
   逻辑舞台缩放适配、立绘/表情/转场/音乐（仅显示曲名）、存档/读档/backlog
   回望与回滚；视频（Erika）只留接口 + 静态兜底，不编假视频。
   文游：AnyWorld 思路（场景=开局、回合制、隐藏概率事件只显效果）复用于
   自由文字冒险，DM 是 char；出处注释见第一块。 */
(function () {
'use strict';
if (!window.AWGroup) return;
var AW = window.AWGroup;
var TRANSIT_KEY = 'cike_letter_transit_v1', CAPSULE_KEY = 'cike_timecapsule_v1';
var VN_KEY = 'phone_script_vn_v1', WY_KEY = 'phone_wenyou_v1', WY_MODEL_KEY = 'aw_wenyou_model_v1', WY_FB_KEY = 'phone_wenyou_feedback_v1', WY_MS_KEY = 'phone_wenyou_milestones_v1';
var ALBUM_KEY3 = 'cike_album_v1', GC_KEY3 = 'guichao.memories.v1', AFF_KEY = 'otome_affection_v1';
var esc3 = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var rd3 = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
var wr3 = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
var uid3 = function (p) { return p + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); };
var pad3 = function (n) { return (n < 10 ? '0' : '') + n; };
var fmtTime3 = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad3(d.getMonth() + 1) + '-' + pad3(d.getDate()) + ' ' + pad3(d.getHours()) + ':' + pad3(d.getMinutes()); };
var dayStr3 = function (ms) { var d = new Date(ms || Date.now()); return d.getFullYear() + '-' + pad3(d.getMonth() + 1) + '-' + pad3(d.getDate()); };
var mainName3 = function () { try { if (typeof SystemStore !== 'undefined') { var c = SystemStore.get('character'); if (c) return c; } } catch (e) {} return '机'; };
var toast3 = function (m) { try { if (window.WeChatAppEngine && WeChatAppEngine.triggerToast) WeChatAppEngine.triggerToast(m); } catch (e) {} };
var notify3 = function (opts) { try { if (window.GroupAS && window.GroupAS.notifyExternal) window.GroupAS.notifyExternal(opts); } catch (e) {} };

/* ════════════════ 一、Platen 慢递 + 定时信 ════════════════ */
function nextMorning8(nowMs) { var d = new Date(nowMs || Date.now()); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.getTime(); }
function loadTransit() { var v = rd3(TRANSIT_KEY, null); if (v && Array.isArray(v.letters)) return v; return { letters: [] }; }
function saveTransit(t) { return wr3(TRANSIT_KEY, t); }
function sendLetterToChar(text, role) {
  text = String(text || '').trim(); if (!text) throw new Error('先写点什么');
  var t = loadTransit();
  var e = { id: uid3('lt'), role: role || '我', to: 'char', text: text, writtenAt: Date.now(), arriveAt: nextMorning8(), status: 'in-transit' };
  t.letters.unshift(e); saveTransit(t); return e;
}
function deliverCharLetter(text, role) {
  text = String(text || '').trim(); if (!text) throw new Error('信是空的');
  var t = loadTransit();
  var e = { id: uid3('lt'), role: role || mainName3(), to: 'me', text: text, writtenAt: Date.now(), arriveAt: nextMorning8(), status: 'in-transit' };
  t.letters.unshift(e); saveTransit(t); return e;
}
function listInTransit() { return loadTransit().letters.filter(function (l) { return l.status === 'in-transit'; }); }
function deliverDueLetters(nowMs) {
  var now = nowMs || Date.now();
  var t = loadTransit(); var due = [];
  t.letters.forEach(function (l) { if (l.status === 'in-transit' && l.arriveAt <= now) { l.status = 'delivered'; due.push(l); } });
  if (!due.length) return [];
  saveTransit(t);
  var album = rd3(ALBUM_KEY3, []); if (!Array.isArray(album)) album = [];
  due.forEach(function (l) { album.unshift({ role: l.role, time: new Date(l.arriveAt).toLocaleString('zh-CN'), text: l.text }); });
  wr3(ALBUM_KEY3, album);
  try { var st = rd3(AW.LETTER_STATE_KEY || 'cike_letter_state_v1', null); if (st && typeof st === 'object') { st.lastSeenCount = album.length; wr3(AW.LETTER_STATE_KEY || 'cike_letter_state_v1', st); } } catch (e) {}
  due.forEach(function (l) { notify3({ kind: 'char', app: 'cike', appName: '此刻', sender: l.role, title: '✉️ 信到了', body: l.role + '的信到了信箱，去看看吧', targetApp: 'cike', refId: 'letter_' + l.id }); });
  return due;
}
function loadCapsules() { var v = rd3(CAPSULE_KEY, null); if (v && Array.isArray(v.letters)) return v; return { letters: [] }; }
function saveCapsules(c) { return wr3(CAPSULE_KEY, c); }
function createTimeCapsule(o) {
  o = o || {};
  var text = String(o.text || '').trim(); if (!text) throw new Error('先写点信的内容');
  var openDate = String(o.openDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openDate)) throw new Error('打开日期要写成 YYYY-MM-DD，例如 2027-01-01');
  if (openDate < dayStr3()) throw new Error('打开日期不能是过去的日子');
  var to = (o.to === 'char') ? 'char' : 'me';
  var c = loadCapsules();
  var e = { id: uid3('tc'), to: to, text: text, openDate: openDate, createdAt: Date.now(), opened: false, openedAt: 0, promise: true };
  c.letters.unshift(e); saveCapsules(c); return e;
}
function listTimeCapsules() { return loadCapsules().letters.slice().sort(function (a, b) { return String(a.openDate).localeCompare(String(b.openDate)); }); }
function capsuleDue(nowMs) { var today = dayStr3(nowMs || Date.now()); return loadCapsules().letters.filter(function (l) { return !l.opened && l.openDate <= today; }); }
function checkCapsules(nowMs) {
  var due = capsuleDue(nowMs);
  due.forEach(function (l) { notify3({ kind: 'char', app: 'cike', appName: '此刻', sender: '定时信', title: '📬 定时信到了', body: '一封写给' + (l.to === 'me' ? '你自己' : mainName3()) + '的信到了打开的日子（opens ' + l.openDate + '）', targetApp: 'cike', refId: 'capsule_' + l.id }); });
  return due;
}
function openTimeCapsule(id, nowMs) {
  var c = loadCapsules(); var found = null;
  c.letters.forEach(function (l) { if (l.id === id) found = l; });
  if (!found) throw new Error('找不到这封定时信');
  if (found.openDate > dayStr3(nowMs || Date.now())) throw new Error('还没到打开的日子（opens ' + found.openDate + '），封存中，拆不开');
  if (!found.opened) { found.opened = true; found.openedAt = Date.now(); saveCapsules(c); }
  return found;
}

/* Platen 式信封叠放视觉（只用于过往信件档案列表；读信页仍是复古报纸风） */
var PLATEN_CSS = [
  '#aw-letter-archive .aw-news-list{padding:20px 10px 28px;background:linear-gradient(#dfe5d8,#e9ede6);border-radius:8px;box-shadow:inset 0 3px 12px rgba(90,100,80,.28);}',
  '#aw-letter-archive .aw-news-row{background:#fffdf7;border:1px solid #e3dcc9;border-radius:3px;box-shadow:0 10px 18px rgba(90,100,80,.20),0 2px 0 rgba(90,100,80,.10);padding:16px 40px 12px 16px;margin-bottom:-8px;transform:perspective(700px) rotateX(5deg);position:relative;}',
  '#aw-letter-archive .aw-news-row:last-child{margin-bottom:0;}',
  '#aw-letter-archive .aw-news-sec{color:#2f5d8a;font-family:"Courier New",ui-monospace,monospace;letter-spacing:1px;}',
  '#aw-letter-archive .aw-news-row b{color:#2f5d8a;font-family:"Courier New",ui-monospace,monospace;font-weight:600;}',
  '#aw-letter-archive .aw-news-row::after{content:"✿";position:absolute;top:10px;right:10px;width:26px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid #7ba05b;color:#5c7a45;background:#eef3e6;font-size:15px;}',
  '#aw-letter-archive .aw-news-row:nth-child(odd)::after{content:"☀";border-color:#c9a227;color:#a8851e;background:#f7ecd0;}',
  '.aw-transit-block{background:#fffdf7;border:1px dashed #b08d3e;border-radius:4px;padding:10px 12px;margin-bottom:14px;font-size:13px;line-height:1.9;}',
  '.aw-transit-block h4{margin:0 0 4px;font-size:13px;color:#7a4a28;letter-spacing:2px;}',
  '.aw-opens{color:#2f5d8a;font-family:"Courier New",ui-monospace,monospace;}',
  '.aw-capsule-form label{display:block;font-size:12px;color:#8a6a52;margin-top:10px;}',
  '.aw-capsule-form input,.aw-capsule-form select,.aw-capsule-form textarea{width:100%;box-sizing:border-box;border:1px solid #d9c48a;border-radius:4px;padding:8px 10px;margin-top:4px;background:#fffdf7;font-size:13px;}'
].join('\n');
function ensurePlatenStyle() {
  if (document.getElementById('aw-platen-style')) return;
  var st = document.createElement('style'); st.id = 'aw-platen-style'; st.textContent = PLATEN_CSS;
  document.head.appendChild(st);
}
function injectTransitBlock() {
  ensurePlatenStyle();
  var layer = document.getElementById('aw-letter-archive');
  if (!layer || layer.style.display === 'none') return false;
  layer.style.background = '#e9ede6';
  if (layer.querySelector('[data-aw-transit-block]')) return true;
  var transit = listInTransit();
  var caps = listTimeCapsules();
  var block = document.createElement('div'); block.className = 'aw-transit-block'; block.setAttribute('data-aw-transit-block', '1');
  var h = '<h4>📮 信箱格口</h4><div style="color:#8a6a52;font-size:12px">信不是即时到的：写好后次日早上 8 点送达，送达时会提醒你。</div>';
  if (transit.length) {
    h += '<div style="margin-top:8px"><b>在路上的信（' + transit.length + ' 封）</b>' + transit.map(function (l) {
      return '<div>✉️ ' + esc3(l.role) + ' → ' + (l.to === 'me' ? '我' : mainName3()) + ' · 预计 ' + fmtTime3(l.arriveAt) + ' 送达<br><span style="color:#a08a7a">' + esc3(l.text.slice(0, 30)) + '……</span></div>';
    }).join('') + '</div>';
  }
  if (caps.length) {
    h += '<div style="margin-top:8px"><b>定时信（' + caps.length + ' 封 · 一种承诺，到日子兑现）</b>' + caps.map(function (l) {
      var openable = l.openDate <= dayStr3();
      return '<div>🔒 写给' + (l.to === 'me' ? '自己' : mainName3()) + ' · <span class="aw-opens">opens ' + esc3(l.openDate) + '</span> · ' + (l.opened ? '已拆开 ✓' : (openable ? '到了，可以拆了' : '封存中，拆不开')) + ' <button type="button" class="aw-news-btn ghost" data-aw-cap-open="' + l.id + '" style="padding:4px 10px">' + (l.opened ? '再看' : '拆信') + '</button></div>';
    }).join('') + '</div>';
  }
  h += '<div style="margin-top:8px"><button type="button" class="aw-news-btn ghost" data-aw-cap-new="1">✉️ 写定时信</button> <span style="font-size:12px;color:#a08a7a">只存你自己写的，不预填示例。</span></div>';
  h += '<div class="aw-cap-detail" style="margin-top:8px"></div>';
  block.innerHTML = h;
  layer.insertBefore(block, layer.children[1] || layer.firstChild);
  block.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-cap-open]') : null;
    var nw = ev.target && ev.target.closest ? ev.target.closest('[data-aw-cap-new]') : null;
    if (nw) { openCapsuleForm(); return; }
    if (b) {
      var detail = block.querySelector('.aw-cap-detail');
      try {
        var l = openTimeCapsule(b.getAttribute('data-aw-cap-open'));
        if (detail) detail.innerHTML = '<div style="border-top:1px solid #e6dcc3;padding-top:8px;white-space:pre-wrap">' + esc3(l.text) + '</div><div style="font-size:12px;color:#8a6a52">写给' + (l.to === 'me' ? '自己' : mainName3()) + ' · opens ' + esc3(l.openDate) + ' · 已兑现</div>';
      } catch (e) { if (detail) detail.textContent = e.message || '拆不开'; toast3(e.message || '拆不开'); }
      return;
    }
  });
  return true;
}
function openCapsuleForm() {
  var host = document.querySelector('.gB-ov') || document.body;
  var layer = document.getElementById('aw-capsule-form');
  if (!layer) {
    layer = document.createElement('div'); layer.id = 'aw-capsule-form'; layer.className = 'aw-capsule-form';
    layer.style.cssText = 'position:absolute;inset:0;background:#f7f1e5;z-index:75;overflow-y:auto;padding:14px 14px 40px;box-sizing:border-box;font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#2b2620;';
    host.appendChild(layer);
  }
  layer.innerHTML = '<button type="button" class="aw-news-back" data-aw-capf="back">‹ 返回</button>'
    + '<div class="aw-news-mast"><div class="aw-news-mastname">写定时信</div><div class="aw-news-mastsub">写给未来的信 · 封存到日子才可拆封</div></div>'
    + '<label>写给谁</label><select id="aw-capf-to"><option value="me">我自己</option><option value="char">' + esc3(mainName3()) + '</option></select>'
    + '<label>打开日期（opens）</label><input id="aw-capf-date" type="date">'
    + '<label>信的内容</label><textarea id="aw-capf-text" rows="10" placeholder="写给未来的话……"></textarea>'
    + '<div style="margin-top:10px"><button type="button" class="aw-news-btn" data-aw-capf="save">封存这封信</button> <span id="aw-capf-out" style="font-size:12px;color:#8a6a52"></span></div>'
    + '<div style="font-size:12px;color:#a08a7a;line-height:1.8;margin-top:10px">到日子会本地通知提醒拆信；与日记/记忆树/承诺打通——定时信视作一种承诺，到日子兑现。只存你自己写的。</div>';
  layer.style.display = 'block';
  layer.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-capf]') : null; if (!b) return;
    var act = b.getAttribute('data-aw-capf');
    if (act === 'back') { layer.style.display = 'none'; return; }
    if (act === 'save') {
      var out = document.getElementById('aw-capf-out');
      try {
        var e = createTimeCapsule({ to: (document.getElementById('aw-capf-to') || {}).value, openDate: (document.getElementById('aw-capf-date') || {}).value, text: (document.getElementById('aw-capf-text') || {}).value });
        if (out) out.textContent = '已封存，opens ' + e.openDate + '。到日子会提醒你拆信。';
        toast3('定时信已封存');
      } catch (err) { if (out) out.textContent = err.message || '保存失败'; }
      return;
    }
  };
}

/* ════════════════ 二、剧本视觉小说 ════════════════ */
var MAX_VN_FILE_BYTES = 500 * 1024;
function vnStore() { var v = rd3(VN_KEY, null); if (v && Array.isArray(v.vns)) return v; return { vns: []};}
function saveVNStore(s) { return wr3(VN_KEY, s);}
function listVNs() { return vnStore().vns;}
function getVN(id) { var v = listVNs(); for (var i = 0; i < v.length; i++) if (v[i].id === id) return v[i]; return null;}
function saveVN(vn) { var s = vnStore(); var i = -1; s.vns.forEach(function (x, j) { if (x.id === vn.id) i = j;}); if (i >= 0) s.vns[i] = vn; else s.vns.unshift(vn); saveVNStore(s); return vn;}
function deleteVN(id) { var s = vnStore(); s.vns = s.vns.filter(function (x) { return x.id!== id;}); saveVNStore(s); return true;}
function parseVNFile(fileName, text) {
var name = String(fileName || '');
var size = (typeof TextEncoder!== 'undefined')? new TextEncoder().encode(text).length: String(text).length;
if (size > MAX_VN_FILE_BYTES) throw new Error('文件太大了（' + Math.round(size / 1024) + 'KB，超过 500KB），可能超 localStorage；请拆小一点再传');
if (/\.sks$/i.test(name)) return parseSKSVN(text, name);
if (/\.json$/i.test(name)) return parseJsonVN(text);
if (/\.txt$/i.test(name) ||!/\.[a-z0-9]+$/i.test(name)) return parseTxtVN(text);
throw new Error('不支持的格式：' + (name.split('.').pop() || '未知') + '。目前支持 .sks（SakiEngine，第一档）、.txt、.json，其他格式不假装支持');
}

/* ══════════ [GROUP-FIX16] SKS 解析与 VN 支撑 ══════════
   出处：SakiEngine（AimesSoft/SakiEngine，MIT）——官网
   https://sakiengine.aimes-soft.com/ 、仓库 README、docs/script-guide.md、
   演示剧本 Game/SakiEngine/GameScript/labels/start.sks（2026-11-26 实读）。
   只借语法与行为定义，本实现全部自写，不抄引擎代码；SKS 解析后转手机内部
   JSON 模型再保存，不另起第二套运行时模型。
   已核实（有出处）的 SKS 语法：
     label X / scene bg NAME [with fade|diss|dissolve|wipe|blink|eyeopen|eye|pixel]
       [timer N] / 角色对白 `yk pose2 happy "…"`（姿势 + 表情，第二层差分
       `x happy mask` / `x happy --mask` / `x happy --none`）/ show CHAR [pose]
       [expr] [at left|center|right] / hide CHAR / menu … "选项" label …
       endmenu / return / nvl…endnvl / nvlm…endnvlm / cg NAME /
       anime NAME [keep] [loop] / 文字标签 [w=N] [size=N]…[/size]
       [pass]…[/pass] / 多语言片段 `/zhs …/ /zhc …/ /en …/ /jp …/`（渐进写法
       `你好 /en Hello/`，缺失按默认语言回退；script_default_language）。
   未核实（公开文档与演示剧本里没出现，勿当作 SakiEngine 原生语法）：
     jump / call / if … jump / set / music / video——以下实现为「手机本地扩展」，
     解析与播放都走同一套内部 JSON 模型；video 另见 vnVideoFallback。
   逐行报错：结构性问题（引号未闭合、menu 缺 endmenu、跳向不存在的 label、
   label 重复、看不懂的命令）收进 errors，解析结束时一次抛出，报错里写清行号；
   单行可保留的内容（hide canvas、anime 无素材等）收进 warnings，进审阅页列出，
   不静默丢。 */
var VN_LANGS = ['zhs', 'zhc', 'en', 'jp'];
var VN_LANG_NAMES = { zhs: '简体中文', zhc: '繁體中文', en: 'English', jp: '日本語' };
var VN_SAVE_KEY = 'phone_vn_save_v1';
var VN_LANG_KEY = 'phone_vn_lang_v1';
var VN_LOGIC_W = 1280, VN_LOGIC_H = 720; /* SakiEngine 逻辑分辨率做法：舞台按逻辑尺寸布局再缩放适配 */
function vnParseLangText(raw) {
  var s = String(raw == null ? '' : raw);
  var i18n = {};
  var re = /[\/／](zhs|zhc|en|jp)[\s　]+/g, m, marks = [];
  while ((m = re.exec(s)) !== null) marks.push({ lang: m[1], start: m.index, body: m.index + m[0].length });
  if (!marks.length) return { text: s, i18n: i18n };
  var def = s.slice(0, marks[0].start);
  for (var i = 0; i < marks.length; i++) {
    var end = (i + 1 < marks.length) ? marks[i + 1].start : s.length;
    var body = s.slice(marks[i].body, end).replace(/[\/／]\s*$/, '').replace(/\s+$/, '');
    i18n[marks[i].lang] = body;
  }
  def = def.replace(/[\/／]\s*$/, '').trim();
  var text = def || i18n.zhs || i18n.en || i18n.zhc || i18n.jp || '';
  return { text: text, i18n: i18n };
}
function vnLangText(val, lang, fallbackLang) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  var i18n = val.i18n || val.textI18n || val.labelI18n || null;
  var fb = fallbackLang || 'zhs';
  if (i18n) {
    if (i18n[lang]) return i18n[lang];
    if (i18n[fb]) return i18n[fb];
    var k; for (k in i18n) return i18n[k];
  }
  return val.text || val.label || '';
}
function vnGetLang() { try { var l = localStorage.getItem(VN_LANG_KEY); if (VN_LANGS.indexOf(l) >= 0) return l; } catch (e) {} return 'zhs'; }
function vnSetLang(l) { if (VN_LANGS.indexOf(l) < 0) return 'zhs'; try { localStorage.setItem(VN_LANG_KEY, l); } catch (e) {} return l; }
function vnRichText(s) {
  var h = esc3(s);
  h = h.replace(/\[size=([0-9.]+)\]/g, '<span style="font-size:$1em">').replace(/\[\/size\]/g, '</span>');
  h = h.replace(/\[w=[^\]]*\]/g, '').replace(/\[pass\]/g, '').replace(/\[\/pass\]/g, '');
  return h;
}
function vnStageScale(cw, ch) {
  cw = Number(cw) || 0; ch = Number(ch) || 0;
  if (cw <= 0 || ch <= 0) return { scale: 0, w: 0, h: 0 };
  var s = Math.min(cw / VN_LOGIC_W, ch / VN_LOGIC_H);
  return { scale: s, w: Math.floor(VN_LOGIC_W * s), h: Math.floor(VN_LOGIC_H * s) };
}
function vnEvalCond(cond, vars) {
  if (!cond || !cond.name) return false;
  var v = vars ? vars[cond.name] : undefined;
  if (typeof v !== 'number') v = parseFloat(v);
  if (isNaN(v)) v = 0;
  var r = cond.value;
  if (cond.op === '>=') return v >= r;
  if (cond.op === '<=') return v <= r;
  if (cond.op === '==') return v === r;
  if (cond.op === '!=') return v !== r;
  if (cond.op === '>') return v > r;
  if (cond.op === '<') return v < r;
  return false;
}
function vnVideoFallback(src) {
  /* Erika 视频接口：SakiEngine 的 Erika 是 Rust 原生播放器内核（背景视频、
     循环与片段衔接、播放速度、透明视频），单文件手机装不进。这里是干净的
     接口 + 静态兜底——永远不造 <video> 假装在播；未来真有原生桥时，在此
     函数内接管即可，调用点（播放器 video 行与 scene.video）不用改。 */
  return { supported: false, src: String(src || ''), note: '视频背景暂不支持，已用静态场景代替' };
}
function parseSKSVN(text, fileName) {
  var src = String(text || '').replace(/\r\n/g, '\n');
  var rawLines = src.split('\n');
  var base = String(fileName || '未命名视觉小说').replace(/\.(sks|txt|json)$/i, '');
  var vn = { id: uid3('vn'), title: base || '未命名视觉小说', source: 'sks', lang: 'zhs', scenes: [], characters: [], createdAt: Date.now() };
  var warnings = [], errors = [];
  var labels = {};
  var speakers = {};
  var cur = null;
  var autoStart = true;
  var newScene = function (label, ln) {
    if (label === 'start' && autoStart && cur && cur.lines.length === 0) { labels[label] = { sceneIdx: vn.scenes.length - 1, line: ln }; return cur; }
    if (labels[label]) { errors.push({ line: ln, reason: 'label 重复：' + label + ' 已在第 ' + labels[label].line + ' 行定义过' }); return cur; }
    cur = { id: uid3('sc'), title: label === 'start' ? '开场' : label, label: label, bg: '', lines: [] };
    labels[label] = { sceneIdx: vn.scenes.length, line: ln };
    vn.scenes.push(cur);
    if (ln !== 0) autoStart = false; /* 初始 newScene('start', 0) 不清 autoStart，否则首行 label start 会判重 */
    return cur;
  };
  newScene('start', 0);
  var stripComment = function (s) {
    var inQ = false, out = '';
    for (var k = 0; k < s.length; k++) { var c = s[k]; if (c === '"') inQ = !inQ; if (!inQ && c === '/' && s[k + 1] === '/') break; out += c; }
    return out;
  };
  var parseMods = function (tokens, ln) {
    var r = { pose: '', expr: '', expr2: null, expr2Clear: false, anim: '' };
    for (var t = 0; t < tokens.length; t++) {
      var tk = tokens[t];
      if (/^pose\d+$/i.test(tk)) r.pose = tk;
      else if (tk === 'an' && tokens[t + 1]) { r.anim = tokens[t + 1]; t++; }
      else if (tk === '--none') { r.expr2 = null; r.expr2Clear = true; }
      else if (/^--/.test(tk)) r.expr2 = tk.slice(2);
      else if (!r.expr) r.expr = tk;
      else if (r.expr2 === null && !r.expr2Clear) r.expr2 = tk;
      else warnings.push({ line: ln, reason: '多余的修饰词已忽略：' + tk });
    }
    return r;
  };
  var pushDialogue = function (speaker, tokens, qtext, ln) {
    var mods = parseMods(tokens, ln);
    var parsed = vnParseLangText(qtext);
    var line = { type: 'dialogue', speaker: speaker, text: parsed.text, pose: mods.pose, expr: mods.expr, anim: mods.anim };
    if (mods.expr2 || mods.expr2Clear) { line.expr2 = mods.expr2; line.expr2Clear = mods.expr2Clear; }
    if (Object.keys(parsed.i18n).length) line.textI18n = parsed.i18n;
    speakers[speaker] = 1;
    cur.lines.push(line);
  };
  var i = 0;
  while (i < rawLines.length) {
    var ln = i + 1;
    var raw = stripComment(rawLines[i]).trim();
    i++;
    if (!raw) continue;
    var m;
    if ((m = raw.match(/^label\s+(\S+)$/))) { newScene(m[1], ln); continue; }
    if ((m = raw.match(/^script_default_language\s*:\s*(zhs|zhc|en|jp)\s*$/))) { vn.lang = m[1]; continue; }
    if ((m = raw.match(/^scene\s+(?:bg\s+)?(\S+)(.*)$/))) {
      var rest = m[2] || '';
      var tr = '', timer = 0;
      var mt = rest.match(/with\s+(\S+)/); if (mt) tr = mt[1];
      var mti = rest.match(/timer\s+([0-9.]+)/); if (mti) timer = parseFloat(mti[1]) || 0;
      cur.lines.push({ type: 'scene', bg: m[1], transition: tr, timer: timer });
      if (!cur.bg) cur.bg = m[1];
      continue;
    }
    if ((m = raw.match(/^show\s+(\S+)(.*)$/))) {
      var toks = (m[2] || '').trim().split(/\s+/).filter(function (s) { return !!s; });
      var at = 'center', ai = toks.indexOf('at');
      if (ai >= 0) { at = toks[ai + 1] || 'center'; toks.splice(ai, 2); }
      var mods = parseMods(toks, ln);
      cur.lines.push({ type: 'show', char: m[1], pose: mods.pose, expr: mods.expr, expr2: mods.expr2, expr2Clear: mods.expr2Clear, at: at, anim: mods.anim });
      speakers[m[1]] = 1;
      continue;
    }
    if ((m = raw.match(/^hide\s+(\S+)\s*$/))) {
      if (m[1] === 'canvas') { warnings.push({ line: ln, reason: 'hide canvas：项目画布在单文件手机里不支持，已跳过这一行' }); continue; }
      cur.lines.push({ type: 'hide', char: m[1] });
      continue;
    }
    if (raw === 'menu') {
      var menuLn = ln, opts = [], closed = false;
      while (i < rawLines.length) {
        var mln = i + 1;
        var mraw = stripComment(rawLines[i]).trim();
        i++;
        if (!mraw) continue;
        if (mraw === 'endmenu') { closed = true; break; }
        var om = mraw.match(/^"([^"]*)"\s+(\S+)\s*$/);
        if (!om) { errors.push({ line: mln, reason: 'menu 里这一行看不懂（应为 "选项文字" 跳转label）：' + mraw.slice(0, 40) }); continue; }
        var op = vnParseLangText(om[1]);
        var opt = { label: op.text, goto: om[2] };
        if (Object.keys(op.i18n).length) opt.labelI18n = op.i18n;
        opts.push(opt);
      }
      if (!closed) errors.push({ line: menuLn, reason: 'menu 没有配对的 endmenu' });
      if (opts.length < 1) errors.push({ line: menuLn, reason: 'menu 里一个有效选项都没有' });
      else cur.lines.push({ type: 'choice', options: opts });
      continue;
    }
    if ((m = raw.match(/^jump\s+(\S+)$/))) { cur.lines.push({ type: 'jump', target: m[1], line: ln }); continue; }
    if ((m = raw.match(/^call\s+(\S+)$/))) { cur.lines.push({ type: 'call', target: m[1], line: ln }); continue; }
    if (raw === 'return') { cur.lines.push({ type: 'return' }); continue; }
    if (raw === 'nvl') { cur.lines.push({ type: 'nvl', on: true }); continue; }
    if (raw === 'endnvl') { cur.lines.push({ type: 'nvl', on: false }); continue; }
    if (raw === 'nvlm') { cur.lines.push({ type: 'nvl', on: true, cinematic: true }); continue; }
    if (raw === 'endnvlm') { cur.lines.push({ type: 'nvl', on: false, cinematic: true }); continue; }
    if ((m = raw.match(/^cg\s+(\S+)$/))) { cur.lines.push({ type: 'scene', bg: m[1], cg: true }); if (!cur.bg) cur.bg = m[1]; continue; }
    if ((m = raw.match(/^anime\s+(\S+)(.*)$/))) {
      var arest = m[2] || '';
      cur.lines.push({ type: 'anime', name: m[1], keep: /keep/.test(arest), loop: /loop/.test(arest) });
      warnings.push({ line: ln, reason: 'anime 特效「' + m[1] + '」没有 WebP 素材，播放时只显示名称标注，不假装播动画' });
      continue;
    }
    if ((m = raw.match(/^music\s+(\S+)\s*$/))) {
      if (m[1] === 'stop' || m[1] === 'none') cur.lines.push({ type: 'music', action: 'stop' });
      else cur.lines.push({ type: 'music', track: m[1] });
      warnings.push({ line: ln, reason: 'music「' + m[1] + '」：本地扩展写法（SakiEngine 官方文档未核实到音乐命令语法），播放时只显示曲名，未接音频文件' });
      continue;
    }
    if ((m = raw.match(/^video\s+(\S+)(.*)$/))) {
      cur.lines.push({ type: 'video', src: m[1], loop: /loop/.test(m[2] || '') });
      warnings.push({ line: ln, reason: 'video「' + m[1] + '」：本地扩展写法，Erika 视频内核装不进单文件手机，播放时用静态场景代替并如实标注' });
      continue;
    }
    if ((m = raw.match(/^set\s+([A-Za-z_][A-Za-z0-9_]*)\s*([+-]?\d+)\s*$/))) { cur.lines.push({ type: 'set', name: m[1], delta: parseInt(m[2], 10) }); continue; }
    if ((m = raw.match(/^set\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+)\s*$/))) { cur.lines.push({ type: 'set', name: m[1], value: parseInt(m[2], 10) }); continue; }
    if ((m = raw.match(/^if\s+([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)\s+jump\s+(\S+)$/))) {
      cur.lines.push({ type: 'cond', cond: { name: m[1], op: m[2], value: parseInt(m[3], 10) }, target: m[4], line: ln });
      continue;
    }
    if (raw.charAt(0) === '"') {
      var qm = raw.match(/^"([^"]*)"\s*$/);
      if (!qm) { errors.push({ line: ln, reason: '旁白引号没有闭合：' + raw.slice(0, 40) }); continue; }
      var np = vnParseLangText(qm[1]);
      var nline = { type: 'narration', text: np.text };
      if (Object.keys(np.i18n).length) nline.textI18n = np.i18n;
      cur.lines.push(nline);
      continue;
    }
    var qe = raw.match(/^(.*?)\s*"([^"]*)"\s*$/);
    if (qe) {
      var head = qe[1].trim().split(/\s+/).filter(function (s) { return !!s; });
      if (head.length) { pushDialogue(head[0], head.slice(1), qe[2], ln); continue; }
    }
    if (raw.indexOf('"') >= 0) { errors.push({ line: ln, reason: '引号没有闭合：' + raw.slice(0, 40) }); continue; }
    if (/[\u4e00-\u9fff]/.test(raw)) { cur.lines.push({ type: 'narration', text: raw }); continue; }
    errors.push({ line: ln, reason: '看不懂这一行（对白要用引号括起来；命令不在支持列表里）：' + raw.slice(0, 40) });
  }
  vn.scenes.forEach(function (sc) {
    sc.lines.forEach(function (L) {
      if ((L.type === 'jump' || L.type === 'call' || L.type === 'cond') && !labels[L.target]) {
        errors.push({ line: L.line || 0, reason: '跳向不存在的 label：' + L.target });
      }
      if (L.type === 'choice') L.options.forEach(function (o) {
        if (o.goto && !labels[o.goto]) errors.push({ line: 0, reason: '选项「' + o.label + '」跳向不存在的 label：' + o.goto });
      });
    });
  });
  var playable = 0;
  vn.scenes.forEach(function (sc) { sc.lines.forEach(function (L) { if (L.type === 'dialogue' || L.type === 'narration' || L.type === 'choice') playable++; }); });
  if (!playable) errors.push({ line: 0, reason: '文件里没有可玩的对白/旁白/选项' });
  if (errors.length) {
    var shown = errors.slice(0, 6).map(function (e) { return '第 ' + (e.line || '—') + ' 行：' + e.reason; }).join('；');
    var err = new Error('SKS 解析失败（' + errors.length + ' 处）：' + shown + (errors.length > 6 ? '；另有 ' + (errors.length - 6) + ' 处' : ''));
    err.sksErrors = errors;
    throw err;
  }
  vn.scenes = vn.scenes.filter(function (s) { return s.lines.length > 0; });
  if (!vn.scenes.length) { vn.scenes.push({ id: uid3('sc'), title: '开场', label: 'start', bg: '', lines: [{ type: 'narration', text: '（空剧本）' }] }); }
  var lastSc = vn.scenes[vn.scenes.length - 1];
  var hasEnd = false;
  lastSc.lines.forEach(function (L) { if (L.type === 'ending' || L.type === 'return') hasEnd = true; });
  if (!hasEnd) lastSc.lines.push({ type: 'ending', label: '故事的结尾' });
  vn.characters = Object.keys(speakers);
  return { vn: vn, warnings: warnings, errors: [] };
}
function parseTxtVN(text) {
var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
var vn = { id: uid3('vn'), title: '未命名视觉小说', source: 'upload', scenes: [], characters: [], createdAt: Date.now()};
var warnings = [];
var cur = null;
var newScene = function (title) { cur = { id: uid3('sc'), title: title, bg: title, lines: []}; vn.scenes.push(cur); return cur;};
newScene('开场');
var speakers = {};
lines.forEach(function (raw, idx) {
var ln = idx + 1;
var line = raw.trim();
if (!line) return;
var m;
if ((m = line.match(/^#{1,3}\s+(.+)$/))) { if (vn.title === '未命名视觉小说' && idx < 3) vn.title = m[1].trim(); else newScene(m[1].trim()); return;}
if ((m = line.match(/^$/))) { newScene(m[1].trim()); return;}
if ((m = line.match(/^$/))) { cur.lines.push({ type: 'ending', label: m[1].trim()}); return;}
if ((m = line.match(/^结局[：:]\s*(.+)$/))) { cur.lines.push({ type: 'ending', label: m[1].trim()}); return;}
if ((m = line.match(/^\[选项\]\s*(.+)$/))) {
var parts = m[1].split(/[|｜]/).map(function (s) { return s.trim();}).filter(function (s) { return!!s;});
if (parts.length < 2) { warnings.push({ line: ln, reason: '选项少于 2 个，看不懂，已当旁白处理：' + line.slice(0, 30)}); cur.lines.push({ type: 'narration', text: line}); return;}
var opts = parts.map(function (p) {
var om = p.match(/^(.*?)\s*->\s*(.+)$/);
var aff = 0; var am = p.match(/（好感\s*\+(\d+)）|\(好感\s*\+(\d+)\)/);
if (am) aff = parseInt(am[1] || am[2], 10) || 0;
var label = p.replace(/（好感\s*\+\d+）|\(好感\s*\+\d+\)/g, '').trim();
if (om) { label = om[1].replace(/（好感\s*\+\d+）|\(好感\s*\+\d+\)/g, '').trim(); return { label: label, goto: om[2].trim(), affection: aff};}
return { label: label, affection: aff};
});
cur.lines.push({ type: 'choice', options: opts});
return;
}
if ((m = line.match(/^$/))) { warnings.push({ line: ln, reason: '看不懂的标记，已当旁白处理：' + line.slice(0, 30)}); cur.lines.push({ type: 'narration', text: line}); return;}
if ((m = line.match(/^([^：:]{1,8})[：:]\s*(.+)$/))) {
var sp = m[1].trim();
if (!/^(旁白|场景|章节|注|提示)$/.test(sp)) { speakers[sp] = 1; cur.lines.push({ type: 'dialogue', speaker: sp, text: m[2].trim()}); return;}
}
cur.lines.push({ type: 'narration', text: line});
});
vn.scenes = vn.scenes.filter(function (s) { return s.lines.length > 0;});
if (!vn.scenes.length) { newScene('开场'); vn.scenes[0].lines.push({ type: 'narration', text: '（空剧本）'}); warnings.push({ line: 0, reason: '文件里没有可识别的场景/对话/旁白'});}
var lastSc = vn.scenes[vn.scenes.length - 1]; if (lastSc && !lastSc.lines.some(function (l) { return l.type === 'ending'; })) lastSc.lines.push({ type: 'ending', label: '故事的结尾' });
vn.characters = Object.keys(speakers);
return { vn: vn, warnings: warnings};
}
function parseJsonVN(text) {
var obj;
try { obj = JSON.parse(text);} catch (e) { throw new Error('JSON 解析失败：' + (e.message || '格式不对') + '。请检查括号与逗号');}
var warnings = [];
if (!obj || typeof obj!== 'object') throw new Error('JSON 里不是一个对象，看不懂');
var scenesRaw = obj.scenes || obj.chapters || obj.acts;
if (!Array.isArray(scenesRaw) ||!scenesRaw.length) throw new Error('JSON 里没有 scenes（场景数组），看不懂。请用 {title, scenes:[{title, lines:[{speaker?, text, choices?}]}]} 的形状');
var vn = { id: uid3('vn'), title: String(obj.title || '未命名视觉小说'), source: 'upload', lang: (obj.lang && VN_LANGS.indexOf(obj.lang) >= 0) ? obj.lang : 'zhs', scenes: [], characters: [], createdAt: Date.now()};
var speakers = {};
var normText = function (L) {
  if (L.textI18n && typeof L.textI18n === 'object') return { text: String(L.text || vnLangText({ text: L.text || '', i18n: L.textI18n }, 'zhs', 'zhs')), textI18n: L.textI18n };
  if (L.text && typeof L.text === 'object') return { text: vnLangText({ text: '', i18n: L.text }, 'zhs', 'zhs'), textI18n: L.text };
  return { text: String(L.text || '') };
};
scenesRaw.forEach(function (sc, si) {
var scene = { id: uid3('sc'), title: String(sc.title || sc.name || ('场景' + (si + 1))), label: sc.label ? String(sc.label) : undefined, bg: String(sc.bg || sc.background || sc.title || ''), lines: []};
if (sc.video) scene.lines.push({ type: 'video', src: String(sc.video) });
var lines = sc.lines || sc.dialogue || [];
if (!Array.isArray(lines)) { warnings.push({ line: 0, reason: '场景「' + scene.title + '」没有 lines 数组，已跳过'}); return;}
lines.forEach(function (L) {
if (typeof L === 'string') { scene.lines.push({ type: 'narration', text: L}); return;}
if (!L || typeof L!== 'object') { warnings.push({ line: 0, reason: '场景「' + scene.title + '」里有一行不是对象也不是文字，已跳过'}); return;}
if (Array.isArray(L.choices) && L.choices.length) {
scene.lines.push({ type: 'choice', options: L.choices.map(function (c) { var o = { label: String(c.label || c.text || ''), goto: c.goto? String(c.goto): undefined, affection: c.affection? parseInt(c.affection, 10) || 0: 0}; if (c.labelI18n && typeof c.labelI18n === 'object') o.labelI18n = c.labelI18n; return o;})});
return;
}
if (L.type === 'scene' || L.type === 'show' || L.type === 'hide' || L.type === 'music' || L.type === 'video' || L.type === 'set' || L.type === 'jump' || L.type === 'cond' || L.type === 'call' || L.type === 'return' || L.type === 'nvl' || L.type === 'anime') {
var nl = { type: L.type };
['bg', 'transition', 'timer', 'cg', 'char', 'pose', 'expr', 'expr2', 'at', 'anim', 'track', 'action', 'src', 'loop', 'keep', 'name', 'value', 'delta', 'target', 'on', 'cinematic'].forEach(function (k) { if (L[k] !== undefined) nl[k] = L[k]; });
if (L.cond && typeof L.cond === 'object') nl.cond = { name: L.cond.name, op: L.cond.op, value: L.cond.value };
scene.lines.push(nl);
return;
}
if (L.ending || L.type === 'ending') { scene.lines.push({ type: 'ending', label: String(L.ending || L.label || L.text || '结局')}); return;}
if (L.speaker) { speakers[L.speaker] = 1; var d = normText(L); var dl = { type: 'dialogue', speaker: String(L.speaker), text: d.text }; if (d.textI18n) dl.textI18n = d.textI18n; ['pose', 'expr', 'expr2', 'anim'].forEach(function (k) { if (L[k] !== undefined) dl[k] = L[k]; }); scene.lines.push(dl); return;}
if (L.text) { var n2 = normText(L); var nl2 = { type: 'narration', text: n2.text }; if (n2.textI18n) nl2.textI18n = n2.textI18n; scene.lines.push(nl2); return;}
warnings.push({ line: 0, reason: '场景「' + scene.title + '」里有一行既没说话人也没正文，已跳过'});
});
vn.scenes.push(scene);
});
vn.scenes = vn.scenes.filter(function (s) { return s.lines.length > 0;});
if (!vn.scenes.length) throw new Error('JSON 里所有场景都是空的，看不懂');
vn.characters = Object.keys(speakers);
return { vn: vn, warnings: warnings};
}
function structureProseToVN(text, input) {
input = input || {};
var paras = String(text || '').split(/\n\s*\n|\n/).map(function (s) { return s.trim();}).filter(function (s) { return!!s;});
var buildTemplate = function () {
  var vn = { id: uid3('vn'), title: String(input.title || '未命名视觉小说'), source: 'template', scenes: [], characters: [], createdAt: Date.now()};
var speakers = {};
var CHUNK = 3;
for (var i = 0; i < paras.length; i += CHUNK) {
var scene = { id: uid3('sc'), title: '场景 ' + (Math.floor(i / CHUNK) + 1), bg: '', lines: []};
paras.slice(i, i + CHUNK).forEach(function (p) {
var m = p.match(/^([^：:]{1,8})[：:]\s*(.+)$/);
if (m &&!/^(旁白|场景|章节)$/.test(m[1])) { speakers[m[1]] = 1; scene.lines.push({ type: 'dialogue', speaker: m[1], text: m[2]});}
else scene.lines.push({ type: 'narration', text: p});
});
scene.lines.push({ type: 'choice', options: [{ label: '继续前进', affection: 0}, { label: '停下来，四处看看', affection: 0}]});
if (i + CHUNK >= paras.length) scene.lines.push({ type: 'ending', label: '故事的结尾'});
vn.scenes.push(scene);
}
if (!vn.scenes.length) { vn.scenes.push({ id: uid3('sc'), title: '开场', bg: '', lines: [{ type: 'narration', text: '（空文本）'}, { type: 'ending', label: '故事的结尾'}]});}
vn.characters = Object.keys(speakers);
return vn;
};
try {
if (window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('novelVn') && window.PhoneModel.chatComplete && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('novelVn')) {
var sys = '你是视觉小说编剧。把下面这段普通小说正文整理成视觉小说结构，只返回 JSON，不要解释。结构：{title, scenes:[{title, lines:[{speaker?, text} | {choices:[{label, affection?}]} | {ending, label}]}]}。规则：分 2-5 个场景；对话要指认说话人（人名在前，如 {"speaker":"阿梨","text":"……"}），指认不出的写旁白；每场景末尾给一个 2 选 1 的选项（label 简短）；最后加一个结局节点；不要编造原文没有的人名、地名、事件。';
return window.PhoneModel.chatComplete([{ role: 'system', content: sys}, { role: 'user', content: String(text).slice(0, 6000)}], { feature: 'novelVn'}).then(function (resp) {
var raw = String(resp || '');
var m = raw.match(/\{[\s\S]*\}/);
if (!m) throw new Error('模型返回不是 JSON');
var r = parseJsonVN(m[0]);
r.vn.source = 'structured'; r.vn.title = input.title || r.vn.title;
var model = ''; try { model = (window.PhoneModel.modelName && window.PhoneModel.modelName('novelVn')) || '';} catch (e) {}
return { vn: r.vn, warnings: r.warnings, via: 'model', model: model};
}).catch(function () {
return { vn: buildTemplate(), warnings: [{ line: 0, reason: '模型调用失败，已用模板规则整理'}], via: 'template', reason: '模型调用失败，已用模板规则整理'};
});
}
} catch (e) {}
return Promise.resolve({ vn: buildTemplate(), warnings: [{ line: 0, reason: '未接模型，用模板规则整理（每 3 段一个场景，场景末尾提议选项）'}], via: 'template', reason: '未接模型，用模板规则整理'});
}
function matchVNCharacters(vn) {
var all = [];
try { all = AW.allArchiveChars? AW.allArchiveChars(): [];} catch (e) {}
return (vn.characters || []).map(function (name) {
var found = null; all.forEach(function (c) { if (!found && c.name === name) found = c;});
return { name: name, found: found};
});
}
function vnSceneBgCSS(bg) {
var key = String(bg || '');
var map = { '家': 'linear-gradient(180deg,#f6e8d8,#e8cfa8)', '家里': 'linear-gradient(180deg,#f6e8d8,#e8cfa8)', '河边': 'linear-gradient(180deg,#bcd6e8,#7fa8c8)', '旧书店': 'linear-gradient(180deg,#e8dcc3,#c9b088)', '街角咖啡馆': 'linear-gradient(180deg,#e8d3b8,#c9a878)', '地铁': 'linear-gradient(180deg,#cfd8dc,#8a9aa5)', '公司': 'linear-gradient(180deg,#dfe8ee,#aebfc9)', '面馆': 'linear-gradient(180deg,#f2e2c8,#d9b078)', '海边': 'linear-gradient(180deg,#bfe0ea,#6fa8c0)', '山顶': 'linear-gradient(180deg,#d8e8d0,#9ab88a)', '公园': 'linear-gradient(180deg,#d8ecd0,#9ac88a)', '夜': 'linear-gradient(180deg,#2b3245,#171c28)'};
for (var k in map) if (key.indexOf(k)!== -1) return map[k];
return 'linear-gradient(180deg,#efe9dc,#d8cdb4)';
}
function changeAffection(name, delta) {
var all = rd3(AFF_KEY, {}); if (!all || typeof all!== 'object') all = {};
var rec = all[name] && typeof all[name] === 'object'? all[name]: {};
var v = (typeof rec.value === 'number'? rec.value: 0) + delta;
v = Math.max(0, Math.min(100, v));
rec.value = v; all[name] = rec; wr3(AFF_KEY, all);
return v;
}
var vnResizeHandler = null;
function vnSaveGame(vnId, slot) {
  slot = parseInt(slot, 10);
  if (slot < 1 || slot > 3) return null;
  var ov = document.getElementById('aw-vn-player');
  var st = ov && ov._awVN;
  if (!st || st.vnId !== vnId || st.ended) return null;
  var sc = null, line = null;
  try { var v = getVN(vnId); sc = v && v.scenes[st.sceneIdx]; line = sc && sc.lines[st.lineIdx]; } catch (e) {}
  var save = { vnId: vnId, slot: slot, sceneIdx: st.sceneIdx, lineIdx: st.lineIdx,
    vars: JSON.parse(JSON.stringify(st.vars || { affection: 0 })),
    sprites: JSON.parse(JSON.stringify(st.sprites || {})),
    bg: st.bg || '', music: st.music || '', nvl: !!st.nvl, nvlCine: !!st.nvlCine,
    nvlText: (st.nvlText || []).slice(), callStack: (st.callStack || []).slice(),
    log: JSON.parse(JSON.stringify(st.log || [])),
    choicesMade: (st.choicesMade || []).slice(), affectionDelta: st.affectionDelta || 0,
    savedAt: Date.now(), title: sc ? sc.title : '',
    preview: line ? vnLangText(line, st.lang, 'zhs').slice(0, 30) : '' };
  var all = { saves: [] };
  try { var raw = JSON.parse(localStorage.getItem(VN_SAVE_KEY) || 'null'); if (raw && Array.isArray(raw.saves)) all = raw; } catch (e) {}
  all.saves = all.saves.filter(function (s) { return !(s.vnId === vnId && s.slot === slot); });
  all.saves.unshift(save);
  try { localStorage.setItem(VN_SAVE_KEY, JSON.stringify(all)); } catch (e) { return null; }
  return save;
}
function vnListSaves(vnId) {
  try { var raw = JSON.parse(localStorage.getItem(VN_SAVE_KEY) || 'null'); if (raw && Array.isArray(raw.saves)) return raw.saves.filter(function (s) { return s.vnId === vnId; }); } catch (e) {}
  return [];
}
function vnLoadGame(vnId, slot) {
  slot = parseInt(slot, 10);
  var list = vnListSaves(vnId);
  for (var i = 0; i < list.length; i++) if (list[i].slot === slot) return list[i];
  return null;
}
function openVNPlayer(vnId, save) {
var vn = getVN(vnId); if (!vn) { toast3('找不到这部视觉小说'); return false;}
var host = document.querySelector('.gd-root[data-gd="script"]') || document.body;
var ov = document.getElementById('aw-vn-player');
if (!ov) {
ov = document.createElement('div'); ov.id = 'aw-vn-player';
ov.style.cssText = 'position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;overflow:hidden;background:#efe9dc;box-sizing:border-box;padding-top:60px;';
host.appendChild(ov);
}
var state = { vnId: vn.id, sceneIdx: 0, lineIdx: 0, log: [], snaps: [], vars: { affection: 0 }, sprites: {}, bg: '', transition: '', music: '', video: null, fx: '', nvl: false, nvlCine: false, nvlText: [], callStack: [], choicesMade: [], affectionDelta: 0, ended: false, lang: vnGetLang(), panel: '' };
if (save && save.vnId === vn.id) {
  state.sceneIdx = save.sceneIdx || 0; state.lineIdx = save.lineIdx || 0;
  try { state.vars = JSON.parse(JSON.stringify(save.vars || { affection: 0 })); } catch (e) {}
  try { state.sprites = JSON.parse(JSON.stringify(save.sprites || {})); } catch (e) {}
  state.bg = save.bg || ''; state.music = save.music || '';
  state.nvl = !!save.nvl; state.nvlCine = !!save.nvlCine;
  state.nvlText = (save.nvlText || []).slice(); state.callStack = (save.callStack || []).slice();
  try { state.log = JSON.parse(JSON.stringify(save.log || [])); } catch (e) {}
  state.choicesMade = (save.choicesMade || []).slice(); state.affectionDelta = save.affectionDelta || 0;
} else if (vn.scenes[0]) { state.bg = vn.scenes[0].bg || ''; }
ov._awVN = state;
var allChars = []; try { allChars = AW.allArchiveChars? AW.allArchiveChars(): [];} catch (e) {}
var charOf = function (name) { var f = null; allChars.forEach(function (c) { if (!f && c.name === name) f = c;}); return f;};
var resolveGoto = function (target) { var gi = -1; vn.scenes.forEach(function (s, i) { if (gi < 0 && (s.label === target || s.title === target)) gi = i; }); return gi; };
var snapshot = function () {
  return { sceneIdx: state.sceneIdx, lineIdx: state.lineIdx,
    vars: JSON.parse(JSON.stringify(state.vars)),
    sprites: JSON.parse(JSON.stringify(state.sprites)),
    bg: state.bg, music: state.music, video: state.video ? { src: state.video.src } : null,
    nvl: state.nvl, nvlCine: state.nvlCine, nvlText: state.nvlText.slice(),
    callStack: state.callStack.slice(), logLen: state.log.length,
    choicesLen: state.choicesMade.length, affectionDelta: state.affectionDelta };
};
var restoreSnap = function (sn) {
  state.sceneIdx = sn.sceneIdx; state.lineIdx = sn.lineIdx;
  state.vars = JSON.parse(JSON.stringify(sn.vars));
  state.sprites = JSON.parse(JSON.stringify(sn.sprites));
  state.bg = sn.bg; state.music = sn.music;
  state.video = sn.video ? vnVideoFallback(sn.video.src) : null;
  state.nvl = sn.nvl; state.nvlCine = sn.nvlCine; state.nvlText = sn.nvlText.slice();
  state.callStack = sn.callStack.slice();
  state.log.length = sn.logLen; state.choicesMade.length = sn.choicesLen;
  state.affectionDelta = sn.affectionDelta;
  state.panel = '';
};
var curLine = function () { var sc = vn.scenes[state.sceneIdx]; return sc ? sc.lines[state.lineIdx] : null; };
var stepToVisible = function () {
  var guard = 0;
  while (guard++ < 2000) {
    var sc = vn.scenes[state.sceneIdx];
    if (!sc) { state.sceneIdx = vn.scenes.length; return; }
    var line = sc.lines[state.lineIdx];
    if (!line) { state.sceneIdx++; state.lineIdx = 0; continue; }
    if (line.type === 'scene') { if (line.bg) state.bg = line.bg; state.transition = line.transition || ''; if (line.cg) state.bg = line.bg || state.bg; state.lineIdx++; continue; }
    if (line.type === 'show') {
      var sp = state.sprites[line.char] || { char: line.char, at: 'center' };
      if (line.pose) sp.pose = line.pose;
      if (line.expr) sp.expr = line.expr;
      if (line.expr2Clear) sp.expr2 = null; else if (line.expr2) sp.expr2 = line.expr2;
      if (line.at) sp.at = line.at;
      if (line.anim) sp.anim = line.anim;
      state.sprites[line.char] = sp; state.lineIdx++; continue;
    }
    if (line.type === 'hide') { delete state.sprites[line.char]; state.lineIdx++; continue; }
    if (line.type === 'music') { if (line.action === 'stop' || line.track === 'stop' || line.track === 'none') state.music = ''; else if (line.track) state.music = line.track; state.lineIdx++; continue; }
    if (line.type === 'video') { state.video = vnVideoFallback(line.src); state.lineIdx++; continue; }
    if (line.type === 'anime') { state.fx = line.name || ''; state.lineIdx++; continue; }
    if (line.type === 'set') {
      if (typeof line.delta === 'number') state.vars[line.name] = (state.vars[line.name] || 0) + line.delta;
      else if (typeof line.value === 'number') state.vars[line.name] = line.value;
      state.lineIdx++; continue;
    }
    if (line.type === 'jump') { var gi = resolveGoto(line.target); if (gi < 0) { state.lineIdx++; continue; } state.sceneIdx = gi; state.lineIdx = 0; continue; }
    if (line.type === 'call') { var ci = resolveGoto(line.target); if (ci < 0) { state.lineIdx++; continue; } state.callStack.push({ sceneIdx: state.sceneIdx, lineIdx: state.lineIdx + 1 }); state.sceneIdx = ci; state.lineIdx = 0; continue; }
    if (line.type === 'cond') { if (vnEvalCond(line.cond, state.vars)) { var gj = resolveGoto(line.target); if (gj >= 0) { state.sceneIdx = gj; state.lineIdx = 0; continue; } } state.lineIdx++; continue; }
    if (line.type === 'return') { if (state.callStack.length) { var back = state.callStack.pop(); state.sceneIdx = back.sceneIdx; state.lineIdx = back.lineIdx; continue; } state.sceneIdx = vn.scenes.length; return; }
    if (line.type === 'nvl') { state.nvl = !!line.on; state.nvlCine = !!line.cinematic; if (!state.nvl) state.nvlText = []; state.lineIdx++; continue; }
    return;
  }
};
var vnFitStage = function () {
  var wrap = ov.querySelector('[data-vn="stagewrap"]'); var st = ov.querySelector('[data-vn="stage"]');
  if (!wrap || !st) return;
  var cw = wrap.clientWidth || window.innerWidth || 0; var ch = wrap.clientHeight || 0;
  if (!cw || !ch) { cw = 360; ch = 240; }
  var f = vnStageScale(cw, ch);
  st.style.width = VN_LOGIC_W + 'px'; st.style.height = VN_LOGIC_H + 'px';
  st.style.transform = 'translate(-50%,-50%) scale(' + f.scale + ')';
};
var vnApplyTransition = function () {
  var bgEl = ov.querySelector('[data-vn="bg"]');
  if (!bgEl) return;
  var key = state.bg + '|' + state.transition;
  if (ov._vnBgKey === key) return;
  ov._vnBgKey = key;
  var reduce = false; try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce || !state.transition) return;
  var kind = state.transition;
  if (kind === 'fade' || kind === 'diss' || kind === 'dissolve' || kind === 'pixel') {
    bgEl.style.opacity = '0';
    setTimeout(function () { try { bgEl.style.opacity = '1'; } catch (e) {} }, 30);
  } else if (kind === 'wipe') {
    bgEl.style.clipPath = 'inset(0 100% 0 0)';
    setTimeout(function () { try { bgEl.style.clipPath = 'inset(0 0 0 0)'; } catch (e) {} }, 30);
  } else if (kind === 'blink' || kind === 'eyeopen' || kind === 'eye') {
    var bars = ov.querySelectorAll('[data-vn="blinkbar"]');
    for (var i = 0; i < bars.length; i++) bars[i].style.height = '50%';
    setTimeout(function () { try { var bs = ov.querySelectorAll('[data-vn="blinkbar"]'); for (var j = 0; j < bs.length; j++) bs[j].style.height = '0%'; } catch (e) {} }, 30);
  }
};
var spriteHTML = function (sp) {
  var ch = charOf(sp.char);
  var left = sp.at === 'left' ? '170px' : (sp.at === 'right' ? '1110px' : '640px');
  var inner = '';
  if (ch && ch.avatar) inner = '<img src="' + esc3(ch.avatar) + '" style="height:100%;max-width:100%;object-fit:contain;filter:drop-shadow(0 12px 18px rgba(0,0,0,.25))">';
  else if (ch && ch.avatarSvg) inner = '<div style="height:100%">' + ch.avatarSvg + '</div>';
  else inner = '<div style="width:100%;height:100%;border-radius:12px;background:#8a7bb8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:180px">' + esc3((sp.char || '?').charAt(0)) + '</div>';
  var tag = esc3(sp.char) + (sp.pose ? ' · ' + esc3(sp.pose) : '') + (sp.expr ? ' · ' + esc3(sp.expr) : '') + (sp.expr2 ? ' + ' + esc3(sp.expr2) : '');
  return '<div data-vn="sprite" data-vn-anim="' + esc3(sp.anim || '') + '" style="position:absolute;left:' + left + ';bottom:0;transform:translateX(-50%);height:76%;width:320px;">' + inner
    + '<div style="position:absolute;left:50%;transform:translateX(-50%);bottom:6px;white-space:nowrap;font-size:22px;color:#fff;background:rgba(0,0,0,.45);padding:2px 12px;border-radius:20px">' + tag + '</div></div>';
};
var render = function () {
  if (state.ended) return;
  stepToVisible();
  var scene = vn.scenes[state.sceneIdx];
  if (!scene || state.sceneIdx >= vn.scenes.length) { endVN('end'); return; }
  var line = scene.lines[state.lineIdx];
  if (!line) { endVN('end'); return; }
  var langBtns = VN_LANGS.map(function (l) {
    return '<button type="button" data-aw-vn="lang:' + l + '" style="padding:4px 8px;border:1px solid ' + (state.lang === l ? '#b08d3e' : '#d8cdb4') + ';border-radius:14px;background:' + (state.lang === l ? '#f3e6c8' : '#fff') + ';font-size:12px;cursor:pointer">' + VN_LANG_NAMES[l] + '</button>';
  }).join('');
  var toolbar = '<div style="display:flex;gap:6px;align-items:center;padding:8px 10px;background:#fffdf7;border-bottom:1px solid #e6dcc3;flex-wrap:wrap">'
    + '<span style="font-size:13px;font-weight:700;flex:1;min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">《' + esc3(vn.title) + '》</span>'
    + langBtns
    + '<button type="button" data-aw-vn="savepanel" style="padding:4px 10px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:12px;cursor:pointer">💾 存档</button>'
    + '<button type="button" data-aw-vn="loadpanel" style="padding:4px 10px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:12px;cursor:pointer">📂 读档</button>'
    + '<button type="button" data-aw-vn="backlog" style="padding:4px 10px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:12px;cursor:pointer">🕘 回望</button>'
    + '<button type="button" data-aw-vn="rollback" style="padding:4px 10px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:12px;cursor:pointer">↩ 回滚</button>'
    + '<button type="button" data-aw-vn="audiopanel" style="padding:4px 10px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:12px;cursor:pointer">♪ 音频</button>'
    + '<button type="button" data-aw-vn="close" style="padding:4px 10px;border:0;border-radius:14px;background:#efe9dc;font-size:12px;cursor:pointer">✕ 退出</button></div>';
  var bgCSS = vnSceneBgCSS(state.bg || scene.bg || scene.title);
  var sprites = '';
  Object.keys(state.sprites).forEach(function (k) { sprites += spriteHTML(state.sprites[k]); });
  var chips = '<div style="position:absolute;top:10px;left:12px;font-size:12px;color:#5a4a32;background:rgba(255,253,247,.8);padding:4px 10px;border-radius:20px">' + esc3(scene.title) + ' · ' + (state.sceneIdx + 1) + '/' + vn.scenes.length + '</div>';
  if (state.music) chips += '<div style="position:absolute;top:44px;left:12px;font-size:12px;color:#5a4a32;background:rgba(255,253,247,.8);padding:4px 10px;border-radius:20px">♪ 音乐：' + esc3(state.music) + '（本地音频：上传同名文件后自动播）</div>';
  if (state.video) chips += '<div style="position:absolute;top:' + (state.music ? 78 : 44) + 'px;left:12px;font-size:12px;color:#7a4a28;background:rgba(255,248,230,.92);padding:4px 10px;border-radius:20px">🎬 ' + esc3(state.video.note) + '（' + esc3(state.video.src) + '）</div>';
  if (state.fx) chips += '<div style="position:absolute;top:' + (state.music ? 112 : 78) + 'px;left:12px;font-size:12px;color:#5a4a32;background:rgba(255,253,247,.8);padding:4px 10px;border-radius:20px">✦ 特效：' + esc3(state.fx) + '（无素材，仅标注）</div>';
  var stage = '<div data-vn="stagewrap" style="flex:1;position:relative;overflow:hidden;background:#20263a;min-height:120px">'
    + '<div data-vn="stage" style="position:absolute;left:50%;top:50%;width:1280px;height:720px;overflow:hidden;background:#20263a">'
    + '<div data-vn="bg" style="position:absolute;inset:0;background:' + bgCSS + ';transition:opacity .6s ease,clip-path .7s ease"></div>'
    + '<div data-vn="blinkbar" style="position:absolute;left:0;top:0;width:100%;height:0;background:#000;transition:height .7s ease"></div>'
    + '<div data-vn="blinkbar" style="position:absolute;left:0;bottom:0;width:100%;height:0;background:#000;transition:height .7s ease"></div>'
    + sprites + chips + '</div></div>';
  var body = '';
  if (line.type === 'choice') {
    body = '<div style="font-size:13px;color:#8a6a52;margin-bottom:8px">选一个：</div>' + line.options.map(function (o, i) {
      return '<button type="button" data-aw-vn-choice="' + i + '" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;border:1px solid #b08d3e;background:#fffdf7;border-radius:8px;font-size:14px;cursor:pointer">' + esc3(vnLangText(o, state.lang, vn.lang || 'zhs')) + '</button>';
    }).join('');
  } else if (line.type === 'ending') {
    body = '<div style="font-size:15px;line-height:1.9">' + esc3(vnLangText(line, state.lang, vn.lang || 'zhs')) + '</div><div style="margin-top:10px"><button type="button" data-aw-vn="finish" style="padding:10px 18px;border:0;border-radius:8px;background:#b08d3e;color:#fff;font-size:14px;cursor:pointer">看复盘</button></div>';
  } else {
    var speaker = line.speaker || '';
    var textHtml = vnRichText(vnLangText(line, state.lang, vn.lang || 'zhs'));
    if (state.nvl) {
      var acc = state.nvlText.map(function (e) { return '<div style="margin-bottom:10px"><span style="color:#b08d3e;font-size:12px;letter-spacing:2px">' + esc3(e.speaker || '旁白') + '</span><div style="font-size:15px;line-height:1.9">' + vnRichText(vnLangText(e, state.lang, vn.lang || 'zhs')) + '</div></div>'; }).join('');
      acc += '<div style="margin-bottom:6px"><span style="color:#b08d3e;font-size:12px;letter-spacing:2px">' + (line.type === 'dialogue' ? esc3(speaker) : '旁白') + '</span><div style="font-size:15px;line-height:1.9">' + textHtml + '</div></div>';
      body = '<div style="font-size:12px;color:#a08a7a;margin-bottom:6px">旁白模式（NVL）· 点一下继续 ›</div><div style="max-height:220px;overflow-y:auto">' + acc + '</div>';
    } else {
      body = '<div style="font-size:12px;color:#b08d3e;letter-spacing:2px">' + (line.type === 'dialogue' ? esc3(speaker) : '旁白') + '</div><div style="font-size:15px;line-height:1.9;margin-top:6px">' + textHtml + '</div><div style="font-size:12px;color:#a08a7a;margin-top:8px">点一下继续 ›</div>';
    }
  }
  var dlg = '<div data-aw-vn="stage" style="background:#fffdf7;border-top:1px solid #e6dcc3;padding:14px 16px 26px;min-height:150px;cursor:pointer">' + body + '</div>';
  var panel = '';
  if (state.panel === 'backlog') {
    panel = '<div style="position:absolute;inset:0;z-index:20;background:rgba(247,241,229,.97);overflow-y:auto;padding:16px;box-sizing:border-box">'
      + '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">🕘 回望（点一句回到那里）</b><button type="button" data-aw-vn="panelback" style="padding:6px 12px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:13px;cursor:pointer">‹ 返回</button></div>'
      + (state.log.length ? state.log.map(function (e, idx) { return '<button type="button" data-aw-vn="blog" data-vn-log="' + idx + '" style="display:block;width:100%;text-align:left;margin-top:8px;padding:10px;border:1px solid #e6dcc3;border-radius:8px;background:#fffdf7;font-size:13px;line-height:1.7;cursor:pointer"><span style="color:#b08d3e;font-size:12px">' + esc3(e.scene || '') + ' · ' + esc3(e.speaker || '旁白') + '</span><br>' + esc3(vnLangText(e, state.lang, vn.lang || 'zhs')) + '</button>'; }).join('') : '<div style="margin-top:12px;font-size:13px;color:#a08a7a">还没有读过的对白。</div>')
      + '</div>';
  } else if (state.panel === 'save' || state.panel === 'load') {
    var isSave = state.panel === 'save';
    var saves = vnListSaves(vn.id);
    var slotHtml = [1, 2, 3].map(function (n) {
      var sv = null; saves.forEach(function (s) { if (s.slot === n) sv = s; });
      var desc = sv ? ('第 ' + (sv.sceneIdx + 1) + ' 幕 · ' + esc3(sv.title || '') + ' · ' + esc3(sv.preview || '') + ' · ' + fmtTime3(sv.savedAt)) : '空槽位';
      return '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;padding:10px;border:1px solid #e6dcc3;border-radius:8px;background:#fffdf7;font-size:13px"><span style="flex:1">' + '槽位 ' + n + '：' + desc + '</span><button type="button" data-aw-vn="' + (isSave ? 'slotsave' : 'slotload') + '" data-slot="' + n + '" style="padding:8px 14px;border:0;border-radius:8px;background:#b08d3e;color:#fff;font-size:13px;cursor:pointer">' + (isSave ? '存到这里' : (sv ? '读档' : '空')) + '</button></div>';
    }).join('');
    panel = '<div style="position:absolute;inset:0;z-index:20;background:rgba(247,241,229,.97);overflow-y:auto;padding:16px;box-sizing:border-box">'
      + '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">' + (isSave ? '💾 存档（3 个槽位）' : '📂 读档') + '</b><button type="button" data-aw-vn="panelback" style="padding:6px 12px;border:1px solid #d8cdb4;border-radius:14px;background:#fff;font-size:13px;cursor:pointer">‹ 返回</button></div>'
      + slotHtml + '</div>';
  }
  ov.innerHTML = toolbar + stage + dlg + panel;
  try { if (window.XWLAudio) window.XWLAudio.syncVNMusic(vn.id, state.music); } catch (e) {}
  vnFitStage();
  vnApplyTransition();
  try {
    var animEls = ov.querySelectorAll('[data-vn-anim]');
    for (var a = 0; a < animEls.length; a++) {
      var an = animEls[a].getAttribute('data-vn-anim');
      if (!an || typeof animEls[a].animate !== 'function') continue;
      if (an === 'jump') animEls[a].animate([{ transform: 'translateX(-50%) translateY(0)' }, { transform: 'translateX(-50%) translateY(-36px)' }, { transform: 'translateX(-50%) translateY(0)' }], { duration: 500, iterations: 1 });
      else if (an === 'shake') animEls[a].animate([{ transform: 'translateX(-50%) translateX(0)' }, { transform: 'translateX(-50%) translateX(-8px)' }, { transform: 'translateX(-50%) translateX(8px)' }, { transform: 'translateX(-50%) translateX(0)' }], { duration: 400, iterations: 1 });
      else if (an === 'bounce') animEls[a].animate([{ transform: 'translateX(-50%) translateY(0)' }, { transform: 'translateX(-50%) translateY(-18px)' }, { transform: 'translateX(-50%) translateY(0)' }], { duration: 600, iterations: 2 });
    }
  } catch (e) {}
};
var advance = function () {
var scene = vn.scenes[state.sceneIdx]; var line = scene && scene.lines[state.lineIdx];
if (!line || line.type === 'choice' || line.type === 'ending') return;
state.snaps.push(snapshot());
state.log.push({ scene: scene.title, speaker: line.speaker || '', text: line.text || '', textI18n: line.textI18n || null });
if (state.nvl) state.nvlText.push(state.log[state.log.length - 1]);
state.lineIdx++; render();
};
var endVN = function (how) {
state.ended = true;
try { if (window.XWLAudio) window.XWLAudio.stopAll(); } catch (e) {}
var review = '一共 ' + state.log.length + ' 句对白/旁白，走了 ' + (state.sceneIdx + 1) + ' 个场景，做了 ' + state.choicesMade.length + ' 次选择' + (state.affectionDelta? '，好感变化 ' + (state.affectionDelta > 0? '+': '') + state.affectionDelta: '，好感没有变化') + '。';
ov.innerHTML = '<div style="flex:1;overflow-y:auto;padding:20px 16px 30px;background:#f7f1e5;font-family:serif;color:#2b2620">'
+ '<div style="text-align:center;font-size:22px;letter-spacing:4px">复盘</div>'
+ '<div style="text-align:center;font-size:12px;color:#8a6a52;margin-top:4px">《' + esc3(vn.title) + '》</div>'
+ '<div style="margin-top:14px;font-size:14px;line-height:2;background:#fffdf7;border:1px solid #e6dcc3;border-radius:8px;padding:14px">' + esc3(review) + '</div>'
+ (state.choicesMade.length? '<div style="margin-top:10px;font-size:13px;line-height:1.9">' + state.choicesMade.map(function (c) { return '· ' + esc3(c);}).join('<br>') + '</div>': '')
+ '<div style="margin-top:10px;font-size:12px;color:#8a6a52">回望里有 ' + state.log.length + ' 条记录；语言：' + VN_LANG_NAMES[state.lang] + '；好感变量 affection=' + (state.vars.affection || 0) + '。</div>'
+ '<div style="display:flex;gap:8px;margin-top:16px"><button type="button" data-aw-vn="save" style="flex:1;padding:12px;border:0;border-radius:8px;background:#b08d3e;color:#fff;font-size:14px;cursor:pointer">💾 保存成归巢记忆</button><button type="button" data-aw-vn="discard" style="flex:1;padding:12px;border:1px solid #b08d3e;border-radius:8px;background:transparent;color:#7a4a28;font-size:14px;cursor:pointer">放弃，不留记录</button></div>'
+ '<div style="margin-top:10px;text-align:center"><button type="button" data-aw-vn="close" style="border:0;background:none;color:#7a4a28;font-size:14px;cursor:pointer">‹ 回到剧本</button></div></div>';
};
ov.onclick = function (ev) {
var chBtn = ev.target && ev.target.closest? ev.target.closest('[data-aw-vn-choice]'): null;
var b = ev.target && ev.target.closest? ev.target.closest('[data-aw-vn]'): null;
if (chBtn) {
var scene = vn.scenes[state.sceneIdx]; var line = scene.lines[state.lineIdx];
var opt = line.options[parseInt(chBtn.getAttribute('data-aw-vn-choice'), 10)];
if (!opt) return;
state.snaps.push(snapshot());
state.choicesMade.push('在「' + scene.title + '」选了「' + vnLangText(opt, state.lang, vn.lang || 'zhs') + '」');
if (opt.affection) { var nm = line.speaker || mainName3(); changeAffection(nm, opt.affection); state.affectionDelta += opt.affection; state.vars.affection = (state.vars.affection || 0) + opt.affection;}
if (opt.goto) {
var gi = resolveGoto(opt.goto);
if (gi >= 0) { state.sceneIdx = gi; state.lineIdx = 0;} else { state.lineIdx++;}
} else { state.lineIdx++;}
render(); return;
}
if (!b) return;
var act = b.getAttribute('data-aw-vn');
if (act === 'stage') { advance(); return;}
if (act === 'audiopanel') { try { if (window.XWLAudio) window.XWLAudio.openPanel(vn.id, '《' + vn.title + '》的音频'); } catch (e) {} return;}
if (act === 'finish') { endVN('end'); return;}
if (act === 'close') { if (vnResizeHandler) { try { window.removeEventListener('resize', vnResizeHandler); window.removeEventListener('orientationchange', vnResizeHandler); } catch (e) {} vnResizeHandler = null; } try { if (window.XWLAudio) window.XWLAudio.stopAll(); } catch (e) {} ov.style.display = 'none'; ov.innerHTML = ''; ov._vnBgKey = ''; return;}
if (act === 'save') {
var mem = { id: uid3('mem'), title: '视觉小说 · ' + vn.title, category: 'relationship', content: '演完了视觉小说《' + vn.title + '》。' + state.choicesMade.join('；') + '。好感变化 ' + state.affectionDelta + '。', created: Date.now(), updated: Date.now()};
var gc = rd3(GC_KEY3, []); if (!Array.isArray(gc)) gc = []; gc.push(mem); wr3(GC_KEY3, gc);
toast3('已存成归巢记忆'); try { if (window.XWLAudio) window.XWLAudio.stopAll(); } catch (e) {} ov.style.display = 'none'; ov.innerHTML = ''; return;
}
if (act === 'discard') { toast3('已放弃，不留记录'); try { if (window.XWLAudio) window.XWLAudio.stopAll(); } catch (e) {} ov.style.display = 'none'; ov.innerHTML = ''; return;}
if (act.indexOf('lang:') === 0) { state.lang = vnSetLang(act.slice(5)); render(); return;}
if (act === 'savepanel' || act === 'loadpanel') { state.panel = act === 'savepanel' ? 'save' : 'load'; render(); return;}
if (act === 'backlog') { state.panel = 'backlog'; render(); return;}
if (act === 'panelback') { state.panel = ''; render(); return;}
if (act === 'rollback') {
if (!state.snaps.length) { toast3('没有可回滚的记录'); return; }
restoreSnap(state.snaps.pop()); render(); return;
}
if (act === 'blog') {
var idx = parseInt(b.getAttribute('data-vn-log'), 10);
if (isNaN(idx) || !state.snaps[idx]) { toast3('这条记录没有回滚快照（读档后回滚从当前点重新积累）'); return; }
restoreSnap(state.snaps[idx]); state.snaps.length = idx; render(); return;
}
if (act === 'slotsave') {
var s1 = vnSaveGame(vn.id, b.getAttribute('data-slot'));
if (s1) { toast3('已存档到槽位 ' + s1.slot); state.panel = ''; render(); } else toast3('存档失败（本轮已结束或存储空间不足）');
return;
}
if (act === 'slotload') {
var sv = vnLoadGame(vn.id, b.getAttribute('data-slot'));
if (!sv) { toast3('这个槽位是空的'); return; }
openVNPlayer(vn.id, sv); toast3('已读档：槽位 ' + sv.slot);
return;
}
};
if (vnResizeHandler) { try { window.removeEventListener('resize', vnResizeHandler); window.removeEventListener('orientationchange', vnResizeHandler); } catch (e) {} }
vnResizeHandler = function () { try { vnFitStage(); } catch (e) {} };
try { window.addEventListener('resize', vnResizeHandler); window.addEventListener('orientationchange', vnResizeHandler); } catch (e) {}
ov.style.display = 'flex';
render();
return true;
}
function openVNReview(result, fileName, opts) { /* [GROUP-FIX16] WENYOU2 合并：保留 opts（host/fromWenyou/win），见 FIX16-4-REBASED */
var host = (opts && opts.host) || document.querySelector('.gd-root[data-gd="script"]') || document.body;
var ov = document.getElementById('aw-vn-review');
if (!ov) { ov = document.createElement('div'); ov.id = 'aw-vn-review'; ov.style.cssText = 'position:absolute;inset:0;z-index:95;background:#f7f1e5;overflow-y:auto;padding:60px 14px 40px;box-sizing:border-box;font-family:serif;color:#2b2620;'; host.appendChild(ov);}
var vn = result.vn;
var matches = matchVNCharacters(vn);
var sceneCount = vn.scenes.length;
var choiceCount = 0, endingCount = 0, dlgCount = 0, labelCount = 0;
var musics = [], videos = [], animes = [], bgs = [];
var langCov = { zhs: 0, zhc: 0, en: 0, jp: 0 }, langTotal = 0;
var addUniq = function (arr, v) { if (v && arr.indexOf(v) < 0) arr.push(v); };
vn.scenes.forEach(function (s) {
  if (s.label) labelCount++;
  if (s.bg) addUniq(bgs, s.bg);
  s.lines.forEach(function (l) {
    if (l.type === 'choice') choiceCount++;
    if (l.type === 'ending') endingCount++;
    if (l.type === 'dialogue' || l.type === 'narration') {
      dlgCount++;
      if (l.textI18n) { langTotal++; VN_LANGS.forEach(function (lg) { if (l.textI18n[lg]) langCov[lg]++; }); }
    }
    if (l.type === 'choice' && l.options) l.options.forEach(function (o) { if (o.labelI18n) { langTotal++; VN_LANGS.forEach(function (lg) { if (o.labelI18n[lg]) langCov[lg]++; }); } });
    if (l.type === 'music' && l.track) addUniq(musics, l.track);
    if (l.type === 'video' && l.src) addUniq(videos, l.src);
    if (l.type === 'anime' && l.name) addUniq(animes, l.name);
    if (l.type === 'scene' && l.bg) addUniq(bgs, l.bg);
  });
});
var srcLabel = vn.source === 'sks' ? 'SKS 导入' : (vn.source === 'structured' ? '模型整理' : (vn.source === 'template' ? '模板规则整理' : '上传'));
ov.innerHTML = '<button type="button" class="aw-news-back" data-aw-vnr="back">‹ 返回</button>'
+ '<div class="aw-news-mast"><div class="aw-news-mastname">审阅视觉小说</div><div class="aw-news-mastsub">' + esc3(fileName || '') + ' · 解析结果先审阅，确认后才保存</div></div>'
+ '<div style="font-size:15px;line-height:1.9"><b>《' + esc3(vn.title) + '》</b><br>来源：' + srcLabel + ' · 场景 ' + sceneCount + ' 个' + (labelCount ? '（label ' + labelCount + ' 个）' : '') + ' · 对白/旁白 ' + dlgCount + ' 句 · 选项 ' + choiceCount + ' 处 · 结局 ' + endingCount + ' 个' + (result.via? '<br>整理方式：' + (result.via === 'model'? '模型整理' + (result.model? '（' + esc3(result.model) + '）': ''): '模板整理'): '') + '</div>'
+ wyVNReviewCoverHTML(vn)
+ (langTotal ? '<div style="margin-top:10px;font-size:13px;line-height:1.9"><b>多语言覆盖</b>（共 ' + langTotal + ' 句带翻译片段）<br>' + VN_LANGS.map(function (lg) { return VN_LANG_NAMES[lg] + ' ' + langCov[lg] + ' 句'; }).join(' · ') + '<br>缺失的语言播放时按默认语言（' + VN_LANG_NAMES[vn.lang || 'zhs'] + '）回退显示。</div>' : '')
+ '<div style="margin-top:10px"><b>场景列表</b>' + vn.scenes.map(function (s) { return '<div style="padding:6px 0;border-bottom:1px solid #e6dcc3;font-size:13px">' + esc3(s.title) + (s.label && s.label !== s.title ? '（label ' + esc3(s.label) + '）' : '') + ' · ' + s.lines.length + ' 行' + (s.bg ? ' · 背景 ' + esc3(s.bg) : '') + '</div>';}).join('') + '</div>'
+ '<div style="margin-top:10px"><b>识别出的人物</b>' + (matches.length? matches.map(function (mm) { return '<div style="padding:6px 0;border-bottom:1px solid #e6dcc3;font-size:13px">' + esc3(mm.name) + ' · ' + (mm.found? '角色库里有 ✓': '没建过 <button type="button" class="aw-news-btn ghost" data-aw-vnr-new="' + esc3(mm.name) + '" style="padding:4px 10px">新建人物</button>') + '</div>';}).join(''): '<div style="font-size:13px;color:#a08a7a">没有识别出说话人（全是旁白也可以玩）。</div>') + '</div>'
+ ((musics.length || videos.length || animes.length) ? '<div style="margin-top:10px"><b>素材说明（诚实标注，不假装有）</b>'
  + (musics.length ? '<div style="padding:6px 0;font-size:13px;color:#8a6a52">音乐 ' + musics.map(function (x) { return esc3(x); }).join('、') + '：只显示曲名，未接音频文件。</div>' : '')
  + (videos.length ? '<div style="padding:6px 0;font-size:13px;color:#8a6a52">视频 ' + videos.map(function (x) { return esc3(x); }).join('、') + '：视频背景暂不支持，已用静态场景代替。</div>' : '')
  + (animes.length ? '<div style="padding:6px 0;font-size:13px;color:#8a6a52">特效 ' + animes.map(function (x) { return esc3(x); }).join('、') + '：没有 WebP 素材，只显示名称标注。</div>' : '')
  + '</div>' : '')
+ (result.errors && result.errors.length? '<div style="margin-top:10px"><b>解析错误（已拦下，未保存）</b>' + result.errors.map(function (w) { return '<div style="padding:6px 0;border-bottom:1px solid #f0e8da;font-size:13px;color:#a33">第 ' + (w.line || '—') + ' 行：' + esc3(w.reason) + '</div>';}).join('') + '</div>': '')
+ (result.warnings && result.warnings.length? '<div style="margin-top:10px"><b>看不懂的行（没有静默丢掉）</b>' + result.warnings.map(function (w) { return '<div style="padding:6px 0;border-bottom:1px solid #f0e8da;font-size:13px;color:#8a6a52">第 ' + (w.line || '—') + ' 行：' + esc3(w.reason) + '</div>';}).join('') + '</div>': '')
+ '<div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="aw-news-btn" data-aw-vnr="save">确认，保存为可玩的视觉小说</button>' + ((opts && opts.fromWenyou) ? '<button type="button" class="aw-news-btn" data-aw-vnr="save-wenyou">转为文游世界并开局</button>' : '') + '<button type="button" class="aw-news-btn ghost" data-aw-vnr="back">取消</button></div>';
ov._awVNResult = result;
ov._wyWin = (opts && opts.win) || null;
ov.style.display = 'block';
ov.onclick = function (ev) {
var nb = ev.target && ev.target.closest? ev.target.closest('[data-aw-vnr-new]'): null;
var b = ev.target && ev.target.closest? ev.target.closest('[data-aw-vnr]'): null;
if (nb) {
var nm = nb.getAttribute('data-aw-vnr-new');
ov.style.display = 'none';
try { AW.openCreateChar();} catch (e) {}
setTimeout(function () { var el = document.getElementById('aw-cc-name'); if (el &&!el.value) el.value = nm;}, 300);
return;
}
if (!b) return;
var act = b.getAttribute('data-aw-vnr');
if (act === 'back') { ov.style.display = 'none'; return;}
if (act === 'save') { saveVN(result.vn); ov.style.display = 'none'; toast3('已保存，可以玩了'); ensureScriptVN(true); return;}
if (act === 'save-wenyou') { saveVN(result.vn); var _w2 = wyVNToWorld(result.vn); ov.style.display = 'none'; toast3('已保存为视觉小说，并按开篇开了一局文游'); if (ov._wyWin) wyRenderPlay(ov._wyWin, _w2.id); return;}
};
return true;
}
function handleVNFile(file) {
if (!file) return;
wyParseUploadFile(file).then(function (res) {
var text = res.text;
try {
var parsed = res.parsed;
var hasDialogueOrChoice = false;
parsed.vn.scenes.forEach(function (s) { s.lines.forEach(function (l) { if (l.type === 'dialogue' || l.type === 'choice') hasDialogueOrChoice = true;});});
if (!hasDialogueOrChoice && /\.(txt|epub)$/i.test(file.name)) {
var host = document.querySelector('.gd-root[data-gd="script"]') || document.body;
var ov = document.getElementById('aw-vn-review');
if (!ov) { ov = document.createElement('div'); ov.id = 'aw-vn-review'; ov.style.cssText = 'position:absolute;inset:0;z-index:95;background:#f7f1e5;overflow-y:auto;padding:60px 14px 40px;box-sizing:border-box;font-family:serif;color:#2b2620;'; host.appendChild(ov);}
ov.innerHTML = '<button type="button" class="aw-news-back" data-aw-vnr="back">‹ 返回</button><div class="aw-news-mast"><div class="aw-news-mastname">正在整理小说正文</div><div class="aw-news-mastsub">没有识别到明确对白/选项 · 整理后仍会先审阅，不会直接保存</div></div>'
+ '<div style="font-size:14px;line-height:1.9">正在尝试把正文拆分为场景、对白、选项与结局。若已配置视觉小说模型，会优先使用模型；否则会明确标注为模板整理。</div>';
ov.style.display = 'block';
ov.onclick = function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-vnr="back"]') : null; if (b) ov.style.display = 'none'; };
structureProseToVN(text, { title: file.name.replace(/\.(txt|epub)$/i, '') }).then(function (r) { openVNReview(r, file.name); }).catch(function (e) { toast3(e.message || '整理失败'); try { window.alert(e.message || '整理失败'); } catch (err) {} });
return;
}
openVNReview(parsed, file.name + (res.encoding ? ' · ' + res.encoding : ''));
} catch (e) { toast3(e.message || '解析失败'); try { window.alert(e.message || '解析失败');} catch (err) {}}
}).catch(function (e) { toast3(e.message || '解析失败'); try { window.alert(e.message || '解析失败');} catch (err) {} });
}
function ensureScriptVN(force) {
  /* [GROUP-FIX9] 兼容桩：视觉小说区已收进剧本 app 的 renderBody（新增 'vn' 视图，
     oaVNHTML），不再以外挂节点插进 #gd-body-script（旧写法是 FIX-6 诊断的乒乓风暴
     写入源之一，开剧本后约 50 秒重写 8107 次；每次 _refresh 也都会被洗掉、等 tick
     才回来）。boot3 的 tick 继续调本函数，只清掉可能残留的旧节点，不再新建；force
     为真时（openVNReview 保存后）刷新一次剧本 app，让 VN 视图里的新条目立刻出现。 */
  try { var old = document.getElementById('aw-script-vn'); if (old && old.parentNode) old.parentNode.removeChild(old); } catch (e) {}
  if (force) { try { var gd = window.GroupD; if (gd && gd.scriptApp && gd.scriptApp._refresh) gd.scriptApp._refresh(); } catch (e) {} }
  return true;
}
/* ════════════════ 三、文游（文字冒险，参考应用式结构） ════════════════
   只借结构与版式：世界卡片墙（拱顶卡片）/创建世界弹窗（名称+世界指令）/
   游玩页（标题栏+返回、衬线剧情、A/B/C 选项、人物内心独白、底部输入框、
   属性面板、群聊式场景）。不抄参考应用的名字与品牌，不抄截图里的具体世界名与剧情文本——文游从空状态开始，只有用户自己创建的世界，通用文字冒险，不限定题材。DM 走 AnyWorld 思路：回合制、隐藏概率事件只显效果。 */
function wyStore() { var v = rd3(WY_KEY, null); if (v && Array.isArray(v.worlds) && Array.isArray(v.adventures)) return v; return { worlds: [], adventures: [] }; }
function saveWYStore(s) { return wr3(WY_KEY, s); }
function listWorlds() { return wyStore().worlds; }
function getWorld(id) { var w = listWorlds(); for (var i = 0; i < w.length; i++) if (w[i].id === id) return w[i]; return null; }
function createWorld(o) {
  o = o || {};
  var title = String(o.title || '').trim(); if (!title) throw new Error('先给世界起个名字（只填一个主题词也可以）');
  var s = wyStore();
  var w = { id: uid3('wy'), title: title, instructions: String(o.instructions || ''), place: String(o.place || ''), goal: String(o.goal || ''), source: o.source || 'user', createdAt: Date.now() };
  s.worlds.unshift(w); saveWYStore(s); return w;
}
function deleteWorld(id) { var s = wyStore(); s.worlds = s.worlds.filter(function (x) { return x.id !== id; }); saveWYStore(s); return true; }
function wyPlaces() {
  var out = [];
  try { (AW.listPostcards() || []).forEach(function (p) { if (p.place && out.indexOf(p.place) === -1) out.push(p.place); }); } catch (e) {}
  try { (AW.listTravel() || []).forEach(function (t) { if (t.name && out.indexOf(t.name) === -1) out.push(t.name); }); } catch (e) {}
  ['家', '河边', '旧书店', '街角咖啡馆', '公园'].forEach(function (p) { if (out.indexOf(p) === -1) out.push(p); });
  return out;
}
function listAdventures() { return wyStore().adventures; }
function getAdventure(id) { var a = listAdventures(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
function saveAdventure(a) { var s = wyStore(); var i = -1; s.adventures.forEach(function (x, j) { if (x.id === a.id) i = j; }); if (i >= 0) s.adventures[i] = a; else s.adventures.unshift(a); a.updatedAt = Date.now(); saveWYStore(s); return a; }
function searchAdventures(q) {
  q = String(q || '').trim(); var all = listAdventures();
  if (!q) return all;
  return all.filter(function (a) { return (a.title + ' ' + (a.rounds || []).map(function (r) { return (r.dm || '') + ' ' + (r.action || ''); }).join(' ')).indexOf(q) !== -1; });
}
function exportAdventuresJSONL() {
  return listAdventures().map(function (a) {
    return JSON.stringify({ type: 'adventure', id: a.id, title: a.title, status: a.status, createdAt: a.createdAt, endedAt: a.endedAt || null });
  }).concat(listAdventures().reduce(function (acc, a) {
    (a.rounds || []).forEach(function (r) { acc.push(JSON.stringify({ type: 'round', adventureId: a.id, n: r.n, action: r.action, dm: r.dm, summary: r.summary })); });
    return acc;
  }, [])).join('\n');
}
function wyModelOn() { var v = rd3(WY_MODEL_KEY, null); return !(v && v.enabled === false); }
function setWYModelOn(on) { wr3(WY_MODEL_KEY, { enabled: !!on }); return !!on; }
function dmModeLabel() {
  try {
    if (wyModelOn() && window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('wenYou') && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('wenYou')) {
      if (window.PhoneModel.modeLabel) return window.PhoneModel.modeLabel('wenYou');
      var m = ''; try { m = (window.PhoneModel.modelName && window.PhoneModel.modelName('wenYou')) || ''; } catch (e) {}
      return '已接模型' + (m ? '（' + m + '）' : '');
    }
  } catch (e) {}
  return '模板模式';
}
function wyHiddenEvents(world) {
  var place = world.place || world.title;
  var goal = world.goal || '看看这个世界';
  return [
    { text: '你在' + place + '的角落里发现了一枚旧硬币，金币 +5。', p: 0.3, effect: { coins: 5 } },
    { text: '一阵风吹过，你闻到了' + place + '特有的气味，精神一振，精力 +5。', p: 0.4, effect: { stamina: 5 } },
    { text: '路边有人向你打了个招呼，你们聊了两句，社交的感觉回来了。', p: 0.5, effect: { stamina: -2 } }
  ];
}
function startAdventure(worldId, opts) {
  opts = opts || {};
  var w = getWorld(worldId); if (!w) throw new Error('找不到这个世界');
  var adv = {
    id: uid3('wa'), worldId: w.id, title: w.title, place: w.place || w.title, goal: w.goal || '',
    status: 'active', rounds: [], hiddenEvents: wyHiddenEvents(w),
    state: { place: w.place || w.title, inventory: [], coins: 10, stamina: 100, goal: w.goal || '', flags: [], companions: [mainName3()] },
    affectionDelta: 0, createdAt: Date.now(), updatedAt: Date.now(), endedAt: 0, review: null, memoryId: null
  };
  var opening = '你来到了' + adv.place + '。' + (w.instructions ? '这里的情形是：' + w.instructions.slice(0, 120) + '。' : '') + (w.goal ? '你的目标是：' + w.goal + '。' : '先四处看看吧。') + mainName3() + '跟在你身边，和你一起出发。' + ' ' + mainName3() + '：“走吧，一起看看。”';
  adv.rounds.push({ n: 0, dm: opening, action: '', result: '', summary: '开局：抵达' + adv.place, monologue: '', hiddenEvent: null, mode: dmModeLabel() });
  saveAdventure(adv);
  return adv;
}
function startAdventureFromTrip(tripId) {
  var trip = null;
  try { trip = AW.findTrip ? AW.findTrip(tripId) : null; } catch (e) {}
  if (!trip) throw new Error('找不到这次旅行');
  var w = createWorld({ title: trip.name, instructions: trip.setting || '', place: trip.name, goal: trip.goal || '', source: 'travel' });
  return startAdventure(w.id);
}
function suggestActions(adv) {
  var st = adv.state; var out = [];
  if (st.stamina < 30) out.push({ key: 'A', label: '休息一会儿，恢复精力', bold: '休息' });
  else out.push({ key: 'A', label: '探索一下' + st.place, bold: '探索' + st.place });
  out.push({ key: 'B', label: '和' + (st.companions[0] || mainName3()) + '聊聊', bold: '聊聊' });
  if (st.goal) out.push({ key: 'C', label: '往目标走：' + st.goal, bold: '往目标走' });
  else if (st.stamina < 30) out.push({ key: 'C', label: '探索一下' + st.place, bold: '探索' + st.place });
  else out.push({ key: 'C', label: '休息一会儿，恢复精力', bold: '休息' });
  if (st.inventory.length) out.push({ key: 'D', label: '翻翻背包（' + st.inventory.join('、') + '）', bold: '翻背包' });
  return out.slice(0, 4);
}
function narrateWY(adv, action, ctx, wbBlock, mileMs) {
  var world = getWorld(adv.worldId) || { title: adv.title };
  var sys = '你是文字冒险游戏的 DM（' + mainName3() + '），正在主持一场自由文字冒险。世界：' + world.title + '。' + (world.instructions ? '世界指令：' + world.instructions.slice(0, 500) : '') + '地点：' + adv.state.place + '。目标：' + (adv.state.goal || '无') + '。只根据已发生的事实叙述，不编造没发生的事；叙述 2-4 句；不要出现概率、骰子、数值。' + '输出结构：先写 1-3 句旁白（动作描写，不加引号）；角色说的话每句单独用中文引号 “……” 包起来，一句一段；最后可另起一行写「内心：……」一句内心独白。不要输出代码块，不要输出数值或状态。';
  // GROUP-BK: 文游 DM 先查世界书再生成（模型模式把世界书拼进系统提示词；调用方已查过时直接用传进来的块，不重复查）。
  var _bkWb = wbBlock ? { block: wbBlock, titles: [], count: 0 } : ((window.WorldBook && window.WorldBook.first) ? window.WorldBook.first('wenyou', mainName3(), action) : { block: '', titles: [], count: 0 });
  if (_bkWb.block) sys += '\n' + _bkWb.block;
  if (mileMs && mileMs.length) {
    var _mileDesc = mileMs.map(function (m) { return m + '（' + (WY_MILESTONE_TIER[m] || '') + '）'; }).join('、');
    sys += '\n本轮好感首次到达' + _mileDesc + '：在内心行之外，另起一行写「信：……」作为密封信里的心里话（第一人称，按这个阶段的心境写，只写此刻的心里话，不提数值，不编过去没发生的事）。';
  }
  var user = '玩家行动：' + action + '\n当前状态：位置 ' + adv.state.place + '，金币 ' + adv.state.coins + '，精力 ' + adv.state.stamina + '，背包 ' + (adv.state.inventory.join('、') || '空') + '。' + (ctx ? '\n' + ctx : '');
  try {
    if (wyModelOn() && window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('wenYou') && window.PhoneModel.chatComplete && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('wenYou')) {
      return window.PhoneModel.chatComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], { feature: 'wenYou' }).then(function (text) {
        var t = String(text || '').trim();
        if (!t) throw new Error('空回复');
        return t;
      });
    }
  } catch (e) {}
  return Promise.resolve(null);
}
function templateNarrateWY(adv, action) {
  var st = adv.state;
  var a = String(action || '');
  var nm = st.companions[0] || mainName3();
  if (/休息|睡|坐下|歇/.test(a)) return '你找了个地方坐下来歇了口气。' + nm + '在旁边陪着你，什么也没说，只是递过来一瓶水。精力恢复了一些。' + nm + '：“先歇会儿，等会儿再走。”';
  if (/聊|问|说|谈/.test(a)) return '你和' + nm + '聊了起来。TA 说起' + st.place + '的一些事，你听得很认真。你们之间的气氛松快了不少。' + nm + '：“说起来，' + st.place + '最近变了不少，你发现了吗？”';
  if (/去|走|前往|出发|逛/.test(a)) return '你们往' + a.replace(/^(去|走|前往|出发|逛)/, '') + '的方向走去。一路上' + st.place + '的景色慢慢变化，你注意到一些之前没留意的细节。' + nm + '：“走吧，前面好像有意思的东西。”';
  if (/拿|捡|买|收/.test(a)) return '你顺手把那样东西收了起来，放进背包。它也许会在后面派上用场。' + nm + '：“收好了，说不定后面用得上。”';
  if (/看|观察|望|瞧/.test(a)) return '你停下来仔细看了看' + st.place + '。有些细节只有慢下来才看得见，你把它们记在了心里。' + nm + '：“你看那边，是不是有点不一样？”';
  return '你' + a + '。' + st.place + '的气氛跟着你的行动变了变，' + nm + '在一旁看着你，等你的下一步。' + nm + '：“然后呢？你想怎么做？”';
}
function applyActionEffects(adv, action) {
  var st = adv.state; var a = String(action || '');
  var notes = [];
  var m;
  if ((m = a.match(/(?:去|走|前往|出发|逛)\s*(.+)/))) { var dest = m[1].replace(/[，。,.!！]+$/, '').trim(); if (dest && dest !== st.place) { st.place = dest; notes.push('位置：' + dest); if (st.flags.indexOf('first:' + dest) === -1) { st.flags.push('first:' + dest); } } }
  if (/拿|捡|买|收/.test(a)) { var item = (a.match(/(?:拿|捡|买|收)(?:起|了|下)?\s*(.+)/) || [])[1]; item = (item || '一件小东西').replace(/[，。,.!！]+$/, '').trim().slice(0, 12) || '一件小东西'; st.inventory.push(item); notes.push('获得：' + item); }
  if (/休息|睡|坐下|歇/.test(a)) { st.stamina = Math.min(100, st.stamina + 20); notes.push('精力 +20'); }
  else st.stamina = Math.max(0, st.stamina - 5);
  if (/聊|问|说|谈/.test(a)) { changeAffection(mainName3(), 1); adv.affectionDelta = (adv.affectionDelta || 0) + 1; notes.push('好感 +1'); }
  if (st.goal && a.indexOf(st.goal.slice(0, 4)) !== -1) { if (st.flags.indexOf('goal:' + st.goal) === -1) st.flags.push('goal:' + st.goal); notes.push('离目标近了一步'); }
  return notes;
}
function doWenyouRound(advId, action, rngFn) {
  action = String(action || '').trim(); if (!action) throw new Error('先输入你想做的事，或选一个建议行动');
  var adv = getAdventure(advId); if (!adv) throw new Error('找不到这场冒险');
  if (adv.status !== 'active') throw new Error('这场冒险已经结束了');
  var rng = (typeof rngFn === 'function') ? rngFn : Math.random;
  var triggered = null;
  (adv.hiddenEvents || []).forEach(function (ev) {
    if (!ev.triggered && !triggered && rng() < ev.p) {
      ev.triggered = true; triggered = ev;
      if (ev.effect) {
        if (ev.effect.coins) adv.state.coins += ev.effect.coins;
        if (ev.effect.stamina) adv.state.stamina = Math.max(0, Math.min(100, adv.state.stamina + ev.effect.stamina));
      }
    }
  });
  // GROUP-BK: 文游每轮先查世界书再生成（模板/模型都走这一步；无条目记 0 条）。
  var _bkWb = (window.WorldBook && window.WorldBook.first) ? window.WorldBook.first('wenyou', mainName3(), action) : { block: '', titles: [], count: 0 };
  var _wyPrevAff = 0; try { _wyPrevAff = AW.affectionValue ? AW.affectionValue() : 0; } catch (e) {}
  var _wyPrevStam = adv.state.stamina;
  var notes = applyActionEffects(adv, action);
  var _wyCrossed = wyMilestoneCrossed(_wyPrevAff, adv);
  var n = adv.rounds.length;
  var summary = '第 ' + n + ' 轮小结：你' + action.slice(0, 20) + (notes.length ? '（' + notes.join('，') + '）' : '') + (triggered ? '；还发生了一件意料之外的事' : '');
  var monologue = '';
  if (n % 2 === 0) monologue = '她刚才' + action.slice(0, 12) + '的时候，我在想……如果一直这样走下去也不错。';
  var finish = function (dmText, mode) {
    var _wyBuilt = wyBuildMilestoneLetters(adv, _wyCrossed, dmText, mode, monologue, action, n);
    var round = { n: n, dm: dmText, action: action, result: notes.join('；'), summary: summary, monologue: monologue, hiddenEvent: triggered ? triggered.text : null, mode: mode, wbTitles: (_bkWb.titles || []).slice(), status: wyStatusSnapshot(adv), wy: _wyBuilt.parsed, hpDelta: adv.state.stamina - _wyPrevStam, letters: _wyBuilt.letters };
    adv.rounds.push(round);
    saveAdventure(adv);
    if (triggered) { try { if (AW.sendPostcard) AW.sendPostcard({ place: adv.state.place, event: triggered.text.slice(0, 24), discovery: '文游里遇到的事', caption: '', source: 'moment', ref: { type: 'scene', id: 'wenyou' } }); } catch (e) {} }
    return round;
  };
  var mode = dmModeLabel();
  if (mode.indexOf('已接模型') === 0) {
    return narrateWY(adv, action, triggered ? ('还发生了一件意料之外的事：' + triggered.text) : '', _bkWb.block, _wyCrossed).then(function (t) {
      return finish(t || templateNarrateWY(adv, action) + (triggered ? ' ' + triggered.text : ''), t ? mode : '模板模式');
    }).catch(function () {
      return finish(templateNarrateWY(adv, action) + (triggered ? ' ' + triggered.text : ''), '模板模式');
    });
  }
  return finish(templateNarrateWY(adv, action) + (triggered ? ' ' + triggered.text : ''), '模板模式');
}
function endAdventure(advId, opts) {
  opts = opts || {};
  var adv = getAdventure(advId); if (!adv) throw new Error('找不到这场冒险');
  if (adv.status === 'ended' && adv.review) return adv.review;
  adv.status = 'ended'; adv.endedAt = Date.now();
  var goalDone = !!(adv.state.goal && adv.state.flags.indexOf('goal:' + adv.state.goal) !== -1);
  var revealed = (adv.hiddenEvents || []).map(function (ev) { return { text: ev.text, triggered: !!ev.triggered }; });
  var review = {
    rounds: adv.rounds.length - 1, choices: adv.rounds.filter(function (r) { return r.action; }).map(function (r) { return r.action; }),
    hiddenEvents: revealed, affectionDelta: adv.affectionDelta || 0, goalDone: goalDone,
    outcome: goalDone ? '达成目标：' + adv.state.goal : '未达成目标，随时结束'
  };
  adv.review = review;
  var mem = null;
  if (opts.saveMemory) {
    mem = { id: uid3('mem'), title: '文游 · ' + adv.title, category: goalDone ? 'relationship' : 'daily', content: '在「' + adv.title + '」冒险了 ' + review.rounds + ' 轮。' + review.outcome + '。关键事件：' + review.choices.slice(0, 5).join('；') + '。地点：' + adv.state.place + '。', created: Date.now(), updated: Date.now() };
    var gc = rd3(GC_KEY3, []); if (!Array.isArray(gc)) gc = []; gc.push(mem); wr3(GC_KEY3, gc);
    adv.memoryId = mem.id;
  }
  saveAdventure(adv);
  return { review: review, memory: mem };
}

/* ═════════ GROUP-WENYOU · 文游截图版式 helpers（旁白+一句一泡+心理卡+状态卡+操作行） ═════════
   状态映射（只用手机里已有的真实模拟状态，不编数）：
   - 好感度 ← AW.affectionValue()（otome_affection_v1，0–100）；
   - 爱意   ← char_drives_v1.closeness（亲近驱动；无记录时取该驱动自身的系统默认 60）；
   - 愤怒   ← char_drives_v1.anxiety（焦虑驱动；手机里没有独立的“愤怒”数值，
              焦虑是最接近的负面激动指标）；
   - 理智   ← 100 − anxiety（焦虑越低越理智，与愤怒同一来源、互补呈现）。
   以后若有了独立的爱意/愤怒/理智数值，只改 wyStatusValues 一处。
   角色英文名：手机里没有角色英文名/罗马音字段（os_character 无 en 字段，
   SystemStore 的 character 就是一个字符串名字），INNER THOUGHTS 抬头无英文名
   时用中文名，不编。 */
function wySplitSentences(s) {
  var out = []; var cur = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i); cur += ch;
    if ('。！？!?…'.indexOf(ch) !== -1) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}
function wyParseWenyou(text, name) {
  var out = { blocks: [], thoughts: '', letterText: '' };
  var s = String(text || '').replace(/\r\n?/g, '\n');
  var th = [];
  var letterLines = [];
  var pushNarr = function (t) {
    wySplitSentences(String(t || '')).forEach(function (sen) {
      var v = sen.trim(); if (v) out.blocks.push({ t: 'n', s: v });
    });
  };
  s.split('\n').forEach(function (raw) {
    var line = String(raw || '').trim();
    if (!line) return;
    var lm = line.match(/^(?:里程碑信|密封信|信)[：:]\s*(.*)$/);
    if (lm) { if (lm[1]) letterLines.push(lm[1].trim()); return; }
    var m = line.match(/^(?:内心独白|内心|INNER THOUGHTS)(?:\s*·[^：:]*)?[：:]\s*(.*)$/i);
    if (m) { if (m[1]) th.push(m[1].trim()); return; }
    m = line.match(/^(?:旁白|叙述|动作描写)[：:]\s*(.*)$/);
    if (m) { if (m[1]) pushNarr(m[1]); return; }
    m = line.match(/^(?:对白|台词)[：:]\s*(.*)$/);
    if (m) { var d0 = m[1].replace(/^[“"「『]/, '').replace(/[”"」』]$/, '').trim(); if (d0) out.blocks.push({ t: 'd', s: d0 }); return; }
    var rest = line; var guard = 0;
    while (guard++ < 20) {
      var q = rest.match(/^(.*?)[“"「『]([^”"」』]+)[”"」』](.*)$/);
      if (!q) break;
      var pre = q[1] || '';
      pre = pre.replace(/[^：:]{1,12}[：:]\s*$/, '');
      if (pre) pushNarr(pre);
      var said = q[2].trim(); if (said) out.blocks.push({ t: 'd', s: said });
      rest = q[3] || '';
      if (!rest.trim()) { rest = ''; break; }
    }
    if (rest.trim()) pushNarr(rest);
  });
  if (!out.blocks.length && s.trim()) pushNarr(s.trim());
  out.thoughts = th.join(' ');
  out.letterText = letterLines.join(' ');
  return out;
}
function wyCharEnName() {
  try {
    var oc = rd3('os_character', null);
    if (oc && typeof oc === 'object') {
      var en = oc.enName || oc.englishName || oc.en || oc.roman || oc.romaji;
      if (en) return String(en);
    }
  } catch (e) {}
  return mainName3();
}
function wyStatusValues(adv) {
  var aff = 0;
  try { aff = AW.affectionValue ? AW.affectionValue() : 0; } catch (e) {}
  if (typeof aff !== 'number' || !isFinite(aff)) aff = 0;
  aff = Math.max(0, Math.min(100, Math.round(aff)));
  var drives = null;
  try { drives = AW.readDrives ? AW.readDrives() : null; } catch (e) {}
  var closeness = (drives && typeof drives.closeness === 'number') ? drives.closeness : 60;
  var anxiety = (drives && typeof drives.anxiety === 'number') ? drives.anxiety : 25;
  closeness = Math.max(0, Math.min(100, Math.round(closeness)));
  anxiety = Math.max(0, Math.min(100, Math.round(anxiety)));
  return { affection: aff, love: closeness, anger: anxiety, reason: 100 - anxiety };
}
function wyStatusSnapshot(adv) {
  var v = wyStatusValues(adv);
  v.place = (adv && adv.state && adv.state.place) || '';
  v.at = fmtTime3(Date.now());
  return v;
}
function wyStatusCardHTML(snap) {
  var cell = function (label, key, color) {
    return '<div class="wy-status-cell"><div class="wy-status-k" style="color:' + color + '">' + label + '</div><div class="wy-status-v" style="color:' + color + '" data-wy-v="' + key + '">' + snap[key] + '%</div></div>';
  };
  return '<div class="wy-status" data-wy-status="1"><div class="wy-status-h">STATUS · CHARACTER</div>'
    + '<div class="wy-status-loc">当前地点 | ' + esc3(snap.at) + ' · ' + esc3(snap.place) + '</div>'
    + '<div class="wy-status-grid">' + cell('好感度', 'affection', '#c98a9b') + cell('爱意', 'love', '#c98a9b') + cell('愤怒', 'anger', '#a85b4b') + cell('理智', 'reason', '#7a9cc0') + '</div></div>';
}
function wyLoadFeedback() { var v = rd3(WY_FB_KEY, []); return Array.isArray(v) ? v : []; }
function wyFeedbackFor(advId, n) {
  var list = wyLoadFeedback();
  for (var i = 0; i < list.length; i++) if (list[i].advId === advId && list[i].n === n) return list[i].kind;
  return '';
}
function wyToggleFeedback(advId, n, kind) {
  var list = wyLoadFeedback();
  var found = -1;
  list.forEach(function (f, i) { if (f.advId === advId && f.n === n) found = i; });
  if (found >= 0 && list[found].kind === kind) list.splice(found, 1);
  else if (found >= 0) list[found] = { advId: advId, n: n, kind: kind, ts: Date.now() };
  else list.unshift({ advId: advId, n: n, kind: kind, ts: Date.now() });
  wr3(WY_FB_KEY, list.slice(0, 200));
  return wyFeedbackFor(advId, n);
}
function wyRoundPlainText(r, adv) {
  var name = mainName3();
  var parsed = (r.wy && r.wy.blocks) ? r.wy : wyParseWenyou(r.dm, name);
  var parts = [];
  parsed.blocks.forEach(function (b) { parts.push(b.t === 'd' ? (name + '： “' + b.s + '”') : b.s); });
  if (r.letters && r.letters.length) { r.letters.forEach(function (L) { parts.push('信（好感度 ' + L.m + '）：' + L.text); }); }
  else { var th = wyThoughtsText(r, parsed); if (th) parts.push('内心独白：' + th); }
  return parts.join('\n');
}
function wyActionRowHTML(r, adv) {
  var fb = wyFeedbackFor(adv.id, r.n);
  var btn = function (act, label, icon) {
    return '<button type="button" class="wy-act' + ((fb === act) ? ' wy-on' : '') + '" data-wy-act="' + act + '" data-wy-adv="' + adv.id + '" data-wy-round="' + r.n + '" aria-label="' + label + '">' + icon + '<span>' + label + '</span></button>';
  };
  return '<div class="wy-actions" data-wy-actions="1">'
    + btn('copy', '复制', '⧉') + btn('like', '赞', '👍') + btn('dislike', '踩', '👎')
    + btn('tts', '朗读', '🔊') + btn('share', '分享', '↗') + btn('more', '•••', '•••') + '</div>';
}
function wyRoundHTML(r, adv) {
  var name = mainName3();
  var h = '';
  if (r.n > 0 && r.action) h += '<div class="wy-user"><div class="wy-user-bubble">' + esc3(r.action) + '</div></div>';
  var parsed = (r.wy && r.wy.blocks) ? r.wy : wyParseWenyou(r.dm, name);
  parsed.blocks.forEach(function (b) {
    if (b.t === 'd') h += '<div class="wy-say"><b>' + esc3(name) + '：</b> “' + esc3(b.s) + '”</div>';
    else h += '<p class="wy-narr">' + esc3(b.s) + '</p>';
  });
  if (r.letters && r.letters.length) { r.letters.forEach(function (L) { h += wyLetterHTML(L, adv, r); }); }
  else { var th = wyThoughtsText(r, parsed); if (th) h += '<div class="wy-thoughts"><div class="wy-thoughts-h">INNER THOUGHTS · ' + esc3(wyCharEnName()) + '</div><div class="wy-thoughts-b">' + esc3(th) + '</div></div>'; }
  h += wyStatusCardHTML(r.status || wyStatusSnapshot(adv));
  h += wyActionRowHTML(r, adv);
  if (r.summary) h += '<div class="wy-sum">' + esc3(r.summary) + ' · ' + esc3(r.mode || '') + '</div>';
  return h;
}
function wyCopyFallback(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}
function wyExportRoundText(adv, r, text) {
  try {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wenyou_' + adv.id + '_round' + r.n + '.txt';
    a.click();
    toast3('已导出本轮文本');
  } catch (e) { toast3(e.message || '导出失败'); }
}
function wySpeak(text) {
  var v = { pitch: 1, rate: 1, volume: 1, voiceURI: '', lang: 'zh-CN', muted: false };
  try { if (window.OtomeF && OtomeF.loadVoice) v = OtomeF.loadVoice(); } catch (e) {}
  if (v.muted) { toast3('已静音（otome 捏声音设置里可改）'); return false; }
  if (!('speechSynthesis' in window) || !window.speechSynthesis) { toast3('当前环境没有语音合成'); return false; }
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text || '').slice(0, 300));
    u.lang = v.lang || 'zh-CN'; u.pitch = v.pitch; u.rate = v.rate; u.volume = v.volume;
    if (v.voiceURI) {
      var vs = window.speechSynthesis.getVoices() || []; var m2 = null;
      vs.forEach(function (x) { if (!m2 && x.voiceURI === v.voiceURI) m2 = x; });
      if (m2) u.voice = m2;
    }
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) { toast3('朗读失败'); return false; }
}
function wyHandleAction(win, btn) {
  var act = btn.getAttribute('data-wy-act');
  var advId = btn.getAttribute('data-wy-adv');
  var n = parseInt(btn.getAttribute('data-wy-round') || '0', 10) || 0;
  var adv = getAdventure(advId); if (!adv) return;
  var r = null; (adv.rounds || []).forEach(function (x) { if (x.n === n) r = x; });
  if (!r) return;
  var text = wyRoundPlainText(r, adv);
  if (act === 'copy') {
    var done = function () { toast3('已复制'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { wyCopyFallback(text); done(); }); }
      else { wyCopyFallback(text); done(); }
    } catch (e) { try { wyCopyFallback(text); done(); } catch (e2) {} }
    return;
  }
  if (act === 'like' || act === 'dislike') {
    var cur = wyToggleFeedback(advId, n, act);
    toast3(cur === 'like' ? '已赞' : cur === 'dislike' ? '已踩' : '已取消');
    wyRenderPlay(win, advId);
    return;
  }
  if (act === 'tts') { wySpeak(text); return; }
  if (act === 'share') {
    if (navigator.share) { try { navigator.share({ title: '文游 · ' + adv.title, text: text }).catch(function () {}); return; } catch (e) {} }
    wyExportRoundText(adv, r, text);
    return;
  }
  if (act === 'more') { wyOpenRoundMenu(win, adv, r, text); return; }
}
function wyOpenRoundMenu(win, adv, r, text) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  var m = document.createElement('div'); m.className = 'wy-modal';
  m.innerHTML = '<div class="wy-modal-card"><h3>本轮操作</h3>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'
    + '<button type="button" class="aw-news-btn" data-wy-roundmenu="copy">复制本轮全文</button>'
    + '<button type="button" class="aw-news-btn" data-wy-roundmenu="tts">朗读本轮</button>'
    + '<button type="button" class="aw-news-btn" data-wy-roundmenu="export">导出本轮 .txt</button>'
    + '<button type="button" class="aw-news-btn ghost" data-wy="menuclose">关闭</button></div></div>';
  root.appendChild(m);
  m.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-wy-roundmenu]') : null;
    if (!b) return;
    var a = b.getAttribute('data-wy-roundmenu');
    if (a === 'copy') { try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); } catch (e) {} toast3('已复制'); }
    if (a === 'tts') wySpeak(text);
    if (a === 'export') wyExportRoundText(adv, r, text);
    m.remove();
  });
}
function wyOpenWyMenu(win) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  var m = document.createElement('div'); m.className = 'wy-modal';
  m.innerHTML = '<div class="wy-modal-card"><h3>文游菜单</h3>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'
    + '<button type="button" class="aw-news-btn" data-wy="attrs">查看属性</button>'
    + '<button type="button" class="aw-news-btn" data-wy="status">查看状态</button>'
    + '<button type="button" class="aw-news-btn" data-wy-export="1">导出冒险记录</button>'
    + '<button type="button" class="aw-news-btn" data-wy="end">结束这场冒险</button>'
    + '<button type="button" class="aw-news-btn ghost" data-wy="menuclose">关闭</button></div></div>';
  root.appendChild(m);
}
function wyOpenWyPlus(win) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  var adv = root._wyAdvId ? getAdventure(root._wyAdvId) : null;
  var sugs = adv ? suggestActions(adv) : [];
  var m = document.createElement('div'); m.className = 'wy-modal';
  m.innerHTML = '<div class="wy-modal-card"><h3>＋</h3><div style="font-size:12px;color:#8a6a52">建议行动（点一个直接发出）</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'
    + (sugs.length ? sugs.map(function (s) { return '<button type="button" class="aw-news-btn" data-wy-sug="' + esc3(s.label) + '">' + esc3(s.key) + '. ' + esc3(s.label) + '</button>'; }).join('') : '<div class="wy-empty">暂无建议行动</div>')
    + '<button type="button" class="aw-news-btn" data-wy-export="1">导出冒险记录</button>'
    + '<button type="button" class="aw-news-btn ghost" data-wy="menuclose">关闭</button></div></div>';
  root.appendChild(m);
}
function wyStartVoiceInput(win) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast3('当前环境不支持语音输入，可以直接打字'); return; }
  try {
    var rec = new SR(); rec.lang = 'zh-CN'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var t = '';
      try { t = ev.results[0][0].transcript || ''; } catch (e) {}
      var inp = root.querySelector('[data-wy-input]');
      if (inp && t) { inp.value = t; wyUpdateSendBtn(root); inp.focus(); }
    };
    rec.onerror = function () { toast3('语音输入没听清，再试一次'); };
    rec.start();
    toast3('正在听…请说话');
  } catch (e) { toast3('语音输入不可用，可以直接打字'); }
}
function wyUpdateSendBtn(root) {
  if (!root) return;
  var inp = root.querySelector('[data-wy-input]');
  var btn = root.querySelector('[data-wy-sendbtn]');
  if (!inp || !btn) return;
  var has = !!String(inp.value || '').trim();
  btn.textContent = has ? '↑' : '●';
  btn.setAttribute('aria-label', has ? '发送' : '语音输入');
}
/* ═════════ GROUP-WENYOU helpers 结束 ═════════ */
/* ═════════ GROUP-WENYOU2 · 里程碑信 + 决策卡 + 共享上传 + 换封面 ═════════
   里程碑：好感首次到达 60/80/90/100。触发记录按角色名存新键
   phone_wenyou_milestones_v1（每角色每档只一次，重启不重复）；信内容
   由生成侧按真实状态现写——模型模式走模型（「信：……」行），模板模式
   按规则写并在信纸下标明；不预填固定台词、不编假回忆、不提数值。
   信封动画复用此刻信箱的 ck-letter-* CSS（.opened 驱动），只收敛尺寸。
   上传：TXT 用 TextDecoder 先 UTF-8 严格解、失败 GBK 兜底；epub 是 zip，
   用 JSZip（CDN 动态加载，离线/加载失败如实报错，绝不假装成功）；解析
   出的章节/段落转进剧本已有的内部 JSON 剧本模型；保存前先审阅、逐行
   报错；上传文件里的内容只当文本解析，绝不执行。
   换封面：复用阅读的 window.BuCovers（novel_book_covers_v1），上传图
   裁成 300x450、≤2MB，按本（世界/VN 的 id）存，跟着备份走。
   WY_MS_KEY 在 VN_KEY 同一行定义（唯一一处），这里只用。 */
var WY_MILESTONES = [60, 80, 90, 100];
var WY_MILESTONE_TIER = { 60: '初动心', 80: '渐深', 90: '近乎认定', 100: '完整' };
var WY_JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
function wyLoadMilestones() { var v = rd3(WY_MS_KEY, {}); return (v && typeof v === 'object') ? v : {}; }
function wyMilestonesFor(name) { var all = wyLoadMilestones(); var rec = all[name]; return (rec && typeof rec === 'object') ? rec : {}; }
function wyMilestoneCrossed(prevAff, adv) {
  var cur = 0;
  try { cur = AW.affectionValue ? AW.affectionValue() : 0; } catch (e) {}
  if (typeof cur !== 'number' || !isFinite(cur)) cur = 0;
  prevAff = (typeof prevAff === 'number' && isFinite(prevAff)) ? prevAff : 0;
  var fired = wyMilestonesFor(mainName3());
  var out = [];
  WY_MILESTONES.forEach(function (m) { if (prevAff < m && cur >= m && !fired[String(m)]) out.push(m); });
  return out;
}
function wyMarkMilestonesFired(crossed, adv, n) {
  if (!crossed || !crossed.length) return;
  var name = mainName3();
  var all = wyLoadMilestones();
  var rec = all[name] || {};
  crossed.forEach(function (m) { rec[String(m)] = { at: Date.now(), advId: adv ? adv.id : '', n: n }; });
  all[name] = rec;
  wr3(WY_MS_KEY, all);
}
function wyTemplateLetterText(adv, m, action) {
  var place = (adv && adv.state && adv.state.place) || '';
  var act = String(action || '').replace(/[。！？!?.]+$/, '');
  var withAct = function (mid) { return act ? ('在' + place + '，刚才你' + act + mid) : ('在' + place + mid); };
  if (m >= 100) return '到了这一步，我不想再绕圈子了。' + withAct('的时候') + '，我心里只剩下一个很确定的念头：就是你了。以后不管去哪、遇到什么，我都想和你一起走。';
  if (m >= 90) return '我发现自己已经不太会想象没有你的日子了。' + withAct('之后') + '，那种“就是你”的感觉越来越清楚，只差一句说出口的话。';
  if (m >= 80) return '有些话我一直没说出口，但现在瞒不住了。' + withAct('的时候') + '，我越来越确定：你在我心里已经是很重要的人了。';
  return '写这封信的时候，我的手有点抖。' + withAct('的时候') + '，我忽然发现自己开始在意你了——在意你的脚步，在意你说话的神情。我不想再装作什么都没发生。';
}
function wyBuildMilestoneLetters(adv, crossed, dmText, mode, monologue, action, n) {
  var parsed = wyParseWenyou(dmText, mainName3());
  var letters = [];
  if (!crossed || !crossed.length) return { letters: letters, parsed: parsed };
  var isModel = !!(mode && String(mode).indexOf('已接模型') === 0);
  var modelText = parsed.letterText || '';
  var usedModelText = false;
  crossed.forEach(function (m, idx) {
    var text = '';
    var via = 'template';
    if (isModel && modelText && !usedModelText) { text = modelText; via = 'model'; usedModelText = true; }
    else if (idx === 0 && (parsed.thoughts || monologue)) { text = parsed.thoughts || monologue; via = isModel ? 'model' : 'template'; }
    else { text = wyTemplateLetterText(adv, m, action); via = 'template'; }
    letters.push({ m: m, text: text, via: via, open: false });
  });
  wyMarkMilestonesFired(crossed, adv, n);
  return { letters: letters, parsed: parsed };
}
function wyThoughtsText(r, parsed) {
  var th = parsed.thoughts || r.monologue || '';
  if (parsed.letterText) th = (th ? th + ' ' : '') + parsed.letterText;
  return th;
}
function wyLetterHTML(letter, adv, r) {
  var name = mainName3();
  var m = letter.m;
  var viaNote = letter.via === 'model' ? '由模型按当前状态现写' : '模板按当前状态写就';
  return '<div class="wy-letter"><div class="wy-letter-cap">✉ 密封的心里话 · 好感度 ' + m + '</div>'
    + '<div class="ck-letter-stage' + (letter.open ? ' opened' : '') + '" data-wy-letter-stage="' + adv.id + ':' + r.n + ':' + m + '">'
    + '<div class="ck-letter-paper-slide"><div class="ck-letter-slide-greeting">给你的信</div>'
    + '<div class="ck-letter-slide-body">' + esc3(letter.text) + '</div>'
    + '<div class="ck-letter-slide-sign">— ' + esc3(name) + ' · 好感度 ' + m + '</div>'
    + '<div class="wy-letter-via">（' + viaNote + '）</div></div>'
    + '<div class="ck-letter-envelope"><div class="ck-letter-envelope-flap"></div>'
    + '<div class="ck-letter-stamp"><div class="ck-letter-stamp-inner"><span class="heart">♥</span>' + m + '</div></div>'
    + '<div class="ck-letter-envelope-to"><div class="ck-letter-envelope-to-label">TO</div><div class="ck-letter-envelope-to-name">' + esc3(name) + '</div></div></div>'
    + '<div class="ck-letter-tap-hint">点按拆开 · 好感度 ' + m + '</div>'
    + '</div></div>';
}
function wyToggleLetter(win, stage) {
  if (!stage) return;
  var key = stage.getAttribute('data-wy-letter-stage') || '';
  var parts = key.split(':');
  stage.classList.toggle('opened');
  var opened = stage.classList.contains('opened');
  var adv = getAdventure(parts[0]);
  if (!adv) return;
  var n = parseInt(parts[1] || '0', 10) || 0;
  var m = parseInt(parts[2] || '0', 10) || 0;
  var found = null;
  (adv.rounds || []).forEach(function (r) { if (r.n === n) found = r; });
  if (found && found.letters) {
    found.letters.forEach(function (L) { if (L.m === m) L.open = opened; });
    saveAdventure(adv);
  }
}
function wyDecisionCardHTML(adv) {
  var st = adv.state;
  var sugs = suggestActions(adv);
  var last = (adv.rounds || []).length ? adv.rounds[adv.rounds.length - 1] : null;
  var hpDelta = (last && typeof last.hpDelta === 'number') ? last.hpDelta : 0;
  var hp = 'HP ' + st.stamina + (hpDelta ? ' · ' + (hpDelta > 0 ? '+' : '') + hpDelta : '');
  var opts = sugs.map(function (s) { return '<button type="button" class="wy-decide-opt" data-wy-decide="' + esc3(s.label) + '">✧ ' + esc3(s.label) + '</button>'; }).join('');
  return '<div class="wy-hp-row"><span class="wy-hp">' + esc3(hp) + '</span></div>'
    + '<div class="wy-scene-line">正在经历 ' + esc3(st.place) + '</div>'
    + '<div class="wy-decide"><div class="wy-decide-h">接下来，你想怎么做？</div>'
    + '<div class="wy-decide-sub">点一个行动，或自己写一句。</div>'
    + opts
    + '<div class="wy-decide-free-h">写下你想做的事，或想对人物说的话</div>'
    + '<div class="wy-decide-free-box"><textarea data-wy-free="1" maxlength="500" rows="3" placeholder="在这里写下你的行动或想说的话…"></textarea>'
    + '<div class="wy-decide-free-foot"><span data-wy-free-count="1">500 字以内</span><button type="button" class="wy-decide-send" data-wy-decide-send="1" disabled>发送行动</button></div></div></div>';
}
function wyBottomNavHTML() {
  var b = function (act, icon, label) { return '<button type="button" class="wy-nav-btn" data-wy-nav="' + act + '"><span class="wy-nav-ic">' + icon + '</span><span>' + label + '</span></button>'; };
  return '<div class="wy-nav">' + b('story', '☰', '故事') + b('chars', '👤', '人物') + b('archive', '▣', '存档') + b('settings', '⚙', '设置') + b('help', '？', '帮助') + '</div>';
}
function wyOpenWyModal(win, title, bodyHTML) {
  var root = win.querySelector('.wy-root'); if (!root) return null;
  var m = document.createElement('div'); m.className = 'wy-modal';
  m.innerHTML = '<div class="wy-modal-card"><h3>' + esc3(title) + '</h3><div style="font-size:13px;line-height:1.9;margin-top:8px">' + bodyHTML + '</div>'
    + '<div style="margin-top:14px;text-align:center"><button type="button" class="aw-news-btn ghost" data-wy="menuclose">关闭</button></div></div>';
  root.appendChild(m);
  return m;
}
function wyOpenWyArchive(win) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  var adv = root._wyAdvId ? getAdventure(root._wyAdvId) : null;
  if (!adv) { toast3('没有进行中的冒险'); return; }
  var aff = 0;
  try { aff = AW.affectionValue ? AW.affectionValue() : 0; } catch (e) {}
  var body = '本场冒险自动保存在手机里，退出再回来可以继续。<br>'
    + '世界：' + esc3(adv.title) + '<br>地点：' + esc3(adv.state.place) + '<br>已进行：' + (adv.rounds.length - 1) + ' 轮<br>'
    + '精力：' + adv.state.stamina + ' · 金币：' + adv.state.coins + ' · 好感度：' + aff + '<br>'
    + '最近保存：' + esc3(fmtTime3(adv.updatedAt || Date.now()))
    + '<div style="margin-top:12px"><button type="button" class="aw-news-btn" data-wy-export="1">导出冒险记录 JSONL</button></div>'
    + '<div style="font-size:12px;color:#8a6a52;margin-top:8px">全部存档在文游首页「冒险记录」里，点「继续」回到本场。</div>';
  wyOpenWyModal(win, '存档', body);
}
function wyOpenWySettings(win) {
  var body = '<label style="cursor:pointer;display:block"><input type="checkbox" data-wy-nav-model="1" ' + (wyModelOn() ? 'checked' : '') + '> 允许模型当 DM（关掉后只用模板叙述）</label>'
    + '<div style="margin-top:10px">朗读用 otome 的捏声音设置（音调/语速/音色），在 otome 里改。</div>'
    + '<div style="margin-top:10px"><button type="button" class="aw-news-btn" data-wy-export="1">导出冒险记录 JSONL</button></div>'
    + '<div style="margin-top:10px"><button type="button" class="aw-news-btn ghost" data-wy="end">结束这场冒险…</button></div>';
  wyOpenWyModal(win, '设置', body);
}
function wyOpenWyHelp(win) {
  var body = '文游是自由文字冒险，' + esc3(mainName3()) + ' 当 DM。<br>'
    + '· 每轮点一个 ✧ 行动，或在决策卡里自己写一句（500 字内），再点「发送行动」；底部输入栏也可以直接发。<br>'
    + '· HP 是精力（0–100），休息恢复、行动消耗；「正在经历」是当前地点。<br>'
    + '· 里程碑信：好感首次到 60 / 80 / 90 / 100 时，那轮的心理栏会变成一封密封的信，点按拆开，每档每人只出现一次。<br>'
    + '· 首页可以上传 .txt / .sks / .json / .epub 文本，本地解析成可玩内容，保存前先审阅。<br>'
    + '· 世界卡片和视觉小说列表里都能换封面（上传本地图 ≤2MB，或选内置封面）。';
  wyOpenWyModal(win, '帮助', body);
}
/* ── 共享上传：文游 + 视觉小说同一套 ── */
function wyFileToBuffer(file) {
  if (file.arrayBuffer) {
    try { var p = file.arrayBuffer(); if (p && typeof p.then === 'function') return p; } catch (e) {}
  }
  return new Promise(function (resolve, reject) {
    var rd = new FileReader();
    rd.onload = function () { resolve(rd.result); };
    rd.onerror = function () { reject(new Error('读文件失败')); };
    rd.readAsArrayBuffer(file);
  });
}
function wyReadUploadedText(file) {
  return wyFileToBuffer(file).then(function (buf) {
    var dec;
    try { dec = new TextDecoder('utf-8', { fatal: true }); return { text: dec.decode(buf), encoding: 'UTF-8' }; }
    catch (e1) {
      try { dec = new TextDecoder('gbk'); return { text: dec.decode(buf), encoding: 'GBK' }; }
      catch (e2) { dec = new TextDecoder('utf-8'); return { text: dec.decode(buf), encoding: 'UTF-8（容错）' }; }
    }
  });
}
function wyLoadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (wyLoadJSZip._p) return wyLoadJSZip._p;
  wyLoadJSZip._p = new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; wyLoadJSZip._p = null; reject(new Error('JSZip 加载超时：离线或 CDN 不可达，epub 暂时解析不了，请联网后再试，或先把 epub 转成 .txt')); } }, 15000);
    var s = document.createElement('script');
    s.onload = function () { if (done) return; done = true; clearTimeout(timer); if (window.JSZip) resolve(window.JSZip); else { wyLoadJSZip._p = null; reject(new Error('JSZip 加载到了但不可用，epub 解析不了')); } };
    s.onerror = function () { if (done) return; done = true; clearTimeout(timer); wyLoadJSZip._p = null; reject(new Error('JSZip 加载失败：离线或 CDN 不可达，epub 暂时解析不了，请联网后再试，或先把 epub 转成 .txt')); };
    s.src = WY_JSZIP_CDN;
    (document.head || document.documentElement).appendChild(s);
  });
  return wyLoadJSZip._p;
}
function wyEpubDocText(htmlText) {
  var out = { title: '', paras: [] };
  var doc = null;
  try { doc = new DOMParser().parseFromString(htmlText, 'text/html'); } catch (e) { return out; }
  if (!doc || !doc.body) return out;
  var scripts = doc.querySelectorAll('script,style');
  for (var i = 0; i < scripts.length; i++) { if (scripts[i].parentNode) scripts[i].parentNode.removeChild(scripts[i]); }
  var nodes = doc.body.querySelectorAll('h1,h2,h3,h4,p,blockquote,li');
  if (!nodes.length) {
    String(doc.body.textContent || '').split('\n').forEach(function (x) { var v = x.trim(); if (v) out.paras.push(v); });
    return out;
  }
  for (var j = 0; j < nodes.length; j++) {
    var tag = (nodes[j].tagName || '').toLowerCase();
    var v2 = String(nodes[j].textContent || '').replace(/\s+/g, ' ').trim();
    if (!v2) continue;
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') { if (!out.title) out.title = v2; else out.paras.push(v2); }
    else out.paras.push(v2);
  }
  return out;
}
function wyParseEpubBuffer(buf) {
  return wyLoadJSZip().then(function (JSZip) { return JSZip.loadAsync(buf); }).then(function (zip) {
    var container = zip.file('META-INF/container.xml');
    if (!container) throw new Error('这个 epub 里没有 META-INF/container.xml，解不开');
    return container.async('string').then(function (xmlText) {
      var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      var rf = doc ? doc.getElementsByTagName('rootfile')[0] : null;
      var opfPath = (rf && rf.getAttribute('full-path')) || 'OEBPS/content.opf';
      var opfFile = zip.file(opfPath);
      if (!opfFile) throw new Error('这个 epub 里找不到 ' + opfPath + '，解不开');
      return opfFile.async('string').then(function (opfText) {
        var odoc = new DOMParser().parseFromString(opfText, 'text/xml');
        var base = opfPath.indexOf('/') !== -1 ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
        var manifest = {};
        var items = odoc ? odoc.getElementsByTagName('item') : [];
        for (var i = 0; i < items.length; i++) manifest[items[i].getAttribute('id')] = items[i].getAttribute('href');
        var spine = [];
        var refs = odoc ? odoc.getElementsByTagName('itemref') : [];
        for (var j = 0; j < refs.length; j++) { var href = manifest[refs[j].getAttribute('idref')]; if (href) spine.push(href.split('#')[0]); }
        if (!spine.length) throw new Error('这个 epub 的 spine 是空的，没有正文可读');
        var chapters = [];
        var warnings = [];
        var chain = Promise.resolve();
        spine.forEach(function (href, idx) {
          chain = chain.then(function () {
            var f = zip.file(base + href) || zip.file(href);
            if (!f) { warnings.push({ line: 0, reason: 'spine 第 ' + (idx + 1) + ' 个文件缺失，已跳过：' + href }); return; }
            return f.async('string').then(function (htmlText) {
              var parsed = wyEpubDocText(htmlText);
              if (!parsed.paras.length) { warnings.push({ line: 0, reason: '「' + (parsed.title || href) + '」里没有读到正文，已跳过' }); return; }
              chapters.push({ title: parsed.title || ('第 ' + (chapters.length + 1) + ' 章'), text: parsed.paras.join('\n') });
            });
          });
        });
        return chain.then(function () {
          if (!chapters.length) throw new Error('这个 epub 里没有读到任何正文');
          return { chapters: chapters, warnings: warnings };
        });
      });
    });
  });
}
function wyChaptersToVN(chapters, title) {
  var vn = { id: uid3('vn'), title: String(title || '未命名视觉小说'), source: 'upload', scenes: [], characters: [], createdAt: Date.now() };
  var warnings = [];
  var speakers = {};
  (chapters || []).forEach(function (ch, ci) {
    var scene = { id: uid3('sc'), title: String(ch.title || ('第 ' + (ci + 1) + ' 章')), bg: String(ch.title || ''), lines: [] };
    String(ch.text || '').split('\n').forEach(function (raw) {
      var line = String(raw || '').trim();
      if (!line) return;
      var m = line.match(/^([^：:]{1,8})[：:]\s*(.+)$/);
      if (m && !/^(旁白|场景|章节|注|提示)$/.test(m[1])) { speakers[m[1]] = 1; scene.lines.push({ type: 'dialogue', speaker: m[1].trim(), text: m[2].trim() }); return; }
      scene.lines.push({ type: 'narration', text: line });
    });
    if (!scene.lines.length) { warnings.push({ line: 0, reason: '「' + scene.title + '」是空的，已跳过' }); return; }
    vn.scenes.push(scene);
  });
  if (!vn.scenes.length) throw new Error('章节里没有可玩的内容');
  var last = vn.scenes[vn.scenes.length - 1];
  if (!last.lines.some(function (l) { return l.type === 'ending'; })) last.lines.push({ type: 'ending', label: '故事的结尾' });
  vn.characters = Object.keys(speakers);
  return { vn: vn, warnings: warnings };
}
function wyParseUploadFile(file) {
  if (!file) return Promise.reject(new Error('没有文件'));
  var name = String(file.name || '');
  if (/\.epub$/i.test(name)) {
    return wyFileToBuffer(file).then(function (buf) { return wyParseEpubBuffer(buf); }).then(function (res) {
      var text = res.chapters.map(function (c) { return c.title + '\n' + c.text; }).join('\n\n');
      var size = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text).length : text.length;
      if (size > MAX_VN_FILE_BYTES) throw new Error('解析出的正文太大了（' + Math.round(size / 1024) + 'KB，超过 500KB），localStorage 装不下，请拆小一点再传');
      var built = wyChaptersToVN(res.chapters, name.replace(/\.epub$/i, ''));
      return { kind: 'epub', text: text, parsed: { vn: built.vn, warnings: built.warnings.concat(res.warnings || []) }, chapters: res.chapters };
    });
  }
  return wyReadUploadedText(file).then(function (r) {
    var parsed = parseVNFile(name, r.text);
    var kind = /\.json$/i.test(name) ? 'json' : (/\.sks$/i.test(name) ? 'sks' : 'txt');
    return { kind: kind, text: r.text, parsed: parsed, encoding: r.encoding };
  });
}
function wyHandleWenyouUpload(win, file) {
  var root = win.querySelector('.wy-root'); if (!root) return;
  toast3('正在解析 ' + (file.name || '文件') + '…');
  wyParseUploadFile(file).then(function (res) {
    openVNReview(res.parsed, (file.name || '') + ' · ' + res.kind + (res.encoding ? ' · ' + res.encoding : ''), { host: root, fromWenyou: true, win: win });
  }).catch(function (e) { toast3(e.message || '解析失败'); try { window.alert(e.message || '解析失败'); } catch (err) {} });
}
function wyVNToWorld(vn) {
  var first = (vn.scenes || [])[0];
  var opening = '';
  if (first) {
    var bits = [];
    (first.lines || []).slice(0, 3).forEach(function (l) { if (l.text) bits.push((l.speaker ? l.speaker + '：' : '') + l.text); });
    opening = bits.join(' ');
  }
  var w = createWorld({ title: vn.title || '未命名世界', instructions: opening.slice(0, 500), place: (first && (first.bg || first.title)) || '', goal: '', source: 'upload' });
  return startAdventure(w.id);
}
function wyVNReviewCoverHTML(vn) {
  if (window.BuCovers && window.BuCovers.detailCoverHtml) {
    try { return window.BuCovers.detailCoverHtml(vn); } catch (e) {}
  }
  return '';
}
/* ── 换封面：复用阅读 window.BuCovers（novel_book_covers_v1） ── */
function wyCoverThumbHTML(book, w, h, block) {
  var inner = '';
  if (window.BuCovers && window.BuCovers.coverBoxHtml) {
    try { inner = window.BuCovers.coverBoxHtml(book, w, h); } catch (e) { inner = ''; }
  }
  if (!inner) {
    var t = String((book && book.title) || '书').slice(0, 1);
    inner = '<div style="width:' + w + 'px;height:' + h + 'px;border-radius:8px;background:' + ((book && book.color) || '#7a9e7e') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.18);">' + esc3(t) + '</div>';
  }
  if (block) return '<span class="wy-cover-thumb" style="display:block;margin:0 auto;width:' + w + 'px">' + inner + '</span>';
  return '<span class="wy-cover-thumb" style="display:inline-block;vertical-align:middle">' + inner + '</span>';
}
function wyOpenCoverChooser(bookId, bookTitle, onDone, hostEl) {
  if (!window.BuCovers) { toast3('换封面组件还没加载好，稍后再试'); return; }
  var host = hostEl || document.querySelector('.gd-root[data-gd="script"]') || document.body;
  var ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;z-index:96;background:rgba(43,38,32,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  var builtins = '';
  try {
    builtins = (window.BuCovers.BUILTINS || []).map(function (b) {
      return '<button type="button" data-wy-cov-builtin="' + esc3(b.id) + '" style="border:1px solid #e6dcc3;border-radius:8px;padding:6px;cursor:pointer;background:#fffdf7;font-size:11px;color:#2b2620"><span style="display:block;height:44px;border-radius:4px;background:' + esc3(b.css) + ';margin-bottom:4px"></span>' + esc3(b.name) + '</button>';
    }).join('');
  } catch (e) {}
  ov.innerHTML = '<div style="background:#f7f1e5;border-radius:14px;padding:18px;width:100%;max-width:420px;max-height:86%;overflow-y:auto;box-sizing:border-box;font-family:serif;color:#2b2620">'
    + '<h3 style="margin:0 0 4px;font-size:18px;letter-spacing:2px">换封面</h3>'
    + '<div style="font-size:12px;color:#8a6a52">《' + esc3(bookTitle || '') + '》 · 上传本地图（裁成封面比例，≤2MB）或选一款内置封面；换好的封面存在手机里，跟着备份走。</div>'
    + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><label style="flex:1;text-align:center;padding:10px;border:1px solid #b08d3e;background:#fffdf7;border-radius:8px;font-size:13px;cursor:pointer">📤 上传本地图片<input type="file" accept="image/*" style="display:none" data-wy-cov-file="1"></label>'
    + '<button type="button" data-wy-cov-clear="1" style="flex:1;padding:10px;border:1px solid #b08d3e;background:transparent;border-radius:8px;font-size:13px;cursor:pointer;color:#7a4a28">恢复自动封面</button></div>'
    + '<div style="font-size:12px;color:#8a6a52;margin-top:14px">内置封面</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">' + builtins + '</div>'
    + '<div style="margin-top:14px;text-align:center"><button type="button" data-wy-cov-close="1" style="border:0;background:none;color:#7a4a28;font-size:14px;cursor:pointer">关闭</button></div></div>';
  host.appendChild(ov);
  ov.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-wy-cov-builtin],[data-wy-cov-clear],[data-wy-cov-close]') : null;
    if (!b) return;
    if (b.hasAttribute('data-wy-cov-close')) { ov.remove(); return; }
    if (b.hasAttribute('data-wy-cov-clear')) { window.BuCovers.clear(bookId); toast3('已恢复自动封面'); ov.remove(); if (onDone) onDone(); return; }
    var bid = b.getAttribute('data-wy-cov-builtin');
    if (bid) { if (window.BuCovers.setBuiltin(bookId, bid)) { toast3('封面已换'); ov.remove(); if (onDone) onDone(); } else toast3('换封面失败'); return; }
  });
  ov.addEventListener('change', function (ev) {
    var inp = ev.target && ev.target.closest ? ev.target.closest('[data-wy-cov-file]') : null;
    if (!inp || !inp.files || !inp.files[0]) return;
    var f = inp.files[0];
    if (f.size > window.BuCovers.MAX_BYTES) { toast3('图片超过 2MB，换张小一点的'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var dataUrl = String(rd.result || '');
      window.BuCovers.cropToCover(dataUrl, function (cropped) {
        if (!window.BuCovers.setUpload(bookId, cropped)) { toast3('保存封面失败（可能超出了存储空间）'); return; }
        toast3('封面已换');
        ov.remove();
        if (onDone) onDone();
      });
    };
    rd.readAsDataURL(f);
  });
}
/* ═════════ GROUP-WENYOU2 helpers 结束 ═════════ */



/* ── 文游 UI（参考应用式结构，本手机自己的代码与文案） ── */
var WY_CSS = [
'.wy-root{position:absolute;inset:0;overflow-y:auto;background:linear-gradient(180deg,#f3eff9,#f7f1e5);font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#2b2620;padding:14px 14px 40px;box-sizing:border-box;}',
'.wy-title{font-size:26px;letter-spacing:6px;text-align:center;}',
'.wy-sub{text-align:center;font-size:11px;letter-spacing:3px;color:#8a6a52;margin-top:4px;}',
'.wy-wall{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;}',
'.wy-card{border-radius:90px 90px 12px 12px;padding:26px 10px 16px;min-height:150px;text-align:center;cursor:pointer;box-shadow:0 6px 16px rgba(120,100,160,.12);display:flex;flex-direction:column;justify-content:center;gap:8px;}',
'.wy-card.lav{background:#efe9f7;}.wy-card.cream{background:#f7f1e5;}',
'.wy-card b{font-size:15px;line-height:1.6;}',
'.wy-card.wy-en{font-size:10px;letter-spacing:2px;color:#8a6a52;border-top:1px solid #d9c8e8;padding-top:6px;}',
'.wy-card.create{border:1.5px dashed #b9a8d8;background:transparent;box-shadow:none;color:#6a5a8a;}',
'.wy-card.wy-plus{font-size:26px;}',
'.wy-empty{grid-column:1/-1;font-size:13px;color:#a08a7a;line-height:1.9;text-align:center;padding:8px;}',
'.wy-sec{font-size:14px;font-weight:700;margin:18px 0 8px;letter-spacing:2px;}',
'.wy-adv-row{display:flex;justify-content:space-between;align-items:center;background:#fffdf7;border:1px solid #e6dcc3;border-left:3px solid #b08d3e;border-radius:6px;padding:10px 12px;margin-bottom:8px;}',
'.wy-modal{position:absolute;inset:0;background:rgba(43,38,32,.35);z-index:20;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}',
'.wy-modal-card{background:#f7f1e5;border-radius:14px;padding:18px;width:100%;max-width:420px;max-height:86%;overflow-y:auto;box-sizing:border-box;}',
'.wy-modal-card h3{margin:0 0 4px;font-size:18px;letter-spacing:2px;}',
'.wy-modal-card label{display:block;font-size:12px;color:#8a6a52;margin-top:12px;}',
'.wy-modal-card input,.wy-modal-card select,.wy-modal-card textarea{width:100%;box-sizing:border-box;border:1px solid #d9c48a;border-radius:6px;padding:9px 10px;margin-top:4px;background:#fffdf7;font-size:13px;font-family:inherit;}',
'.wy-modal-card textarea{min-height:130px;line-height:1.8;}',
'.wy-root.wy-playing{background:#f4f4f5;}',
'.wy-play-top{display:flex;align-items:center;gap:10px;position:sticky;top:-14px;background:#f4f4f5;padding:6px 0 10px;z-index:5;}',
'.wy-play-top b{flex:1;text-align:center;font-size:17px;font-weight:700;color:#1c1c1e;}',
'.wy-worldline{text-align:center;font-size:11px;color:#8a6a52;margin:-4px 0 10px;letter-spacing:1px;}',
'.wy-play-top .wy-back,.wy-play-top .wy-more{width:38px;height:38px;flex:none;border:0;border-radius:50%;background:#fff;color:#1c1c1e;font-size:18px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08);}',
'.wy-story{font-size:15px;line-height:2.1;}',
'.wy-narr{font-style:italic;font-family:Georgia,"Songti SC","Noto Serif SC",serif;color:#6e6e73;font-size:14px;line-height:1.9;margin:10px 2px;}',
'.wy-say{background:#ececee;border-radius:18px;padding:14px 16px;margin:10px 0;font-size:15px;line-height:1.8;color:#1c1c1e;max-width:92%;}',
'.wy-say b{font-weight:700;}',
'.wy-user{display:flex;justify-content:flex-end;margin:10px 0;}',
'.wy-user-bubble{background:#e8e8ea;border-radius:18px;padding:12px 16px;font-size:15px;line-height:1.7;color:#1c1c1e;max-width:85%;}',
'',
'.wy-sum{font-size:12px;color:#a08a7a;border-top:1px solid #e6dcc3;padding-top:6px;margin:8px 0 14px;}',
'.wy-thoughts{background:#ececee;border-radius:12px;padding:12px 14px;margin:12px 0;font-size:14px;line-height:1.9;color:#3a3a3c;}',
'.wy-thoughts-h{font-size:12px;letter-spacing:1px;color:#6e6e73;margin-bottom:6px;font-weight:700;}',
'.wy-status{background:#fff;border:1px solid #d9d9de;border-radius:14px;padding:14px 16px;margin:14px 0;}',
'.wy-status-h{font-size:13px;font-weight:700;letter-spacing:1px;color:#3a3a3c;}',
'.wy-status-loc{font-size:13px;color:#5b8dc9;margin:8px 0 12px;}',
'.wy-status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:left;}',
'.wy-status-k{font-size:12px;margin-bottom:4px;}',
'.wy-status-v{font-size:26px;font-weight:700;line-height:1.1;}',
'.wy-actions{display:flex;gap:4px;margin:4px 0 12px;}',
'.wy-act{flex:1;border:0;background:transparent;color:#8a8a8e;font-size:11px;cursor:pointer;padding:6px 0;display:flex;flex-direction:column;align-items:center;gap:2px;}',
'.wy-act.wy-on{color:#c98a9b;font-weight:700;}',
'.wy-letter{margin:12px 0;}',
'.wy-letter-cap{font-size:12px;letter-spacing:1px;color:#8a6a52;margin-bottom:2px;}',
'.wy-letter .ck-letter-stage{min-height:300px;max-width:340px;}',
'.wy-letter .ck-letter-paper-slide{min-height:230px;}',
'.wy-letter .ck-letter-stage.opened .ck-letter-paper-slide{transform:translateX(-50%) translateY(-170px);}',
'.wy-letter-via{font-size:11px;color:#a08868;margin-top:14px;text-align:right;}',
'.wy-cover-btn{border:1px solid #d9c48a;background:#fffdf7;color:#7a4a28;border-radius:999px;padding:4px 12px;font-size:11px;cursor:pointer;align-self:center;}',
'.wy-hp-row{margin:14px 0 6px;}',
'.wy-hp{display:inline-block;border:1px solid #c9a06f;background:#fffdf7;color:#a85b4b;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;}',
'.wy-scene-line{font-size:13px;color:#6e6e73;margin:0 0 10px;}',
'.wy-decide{background:#ececf1;border:1px solid #d9d9de;border-radius:14px;padding:16px;margin:0 0 12px;}',
'.wy-decide-h{font-size:17px;font-weight:700;color:#1c1c1e;}',
'.wy-decide-sub{font-size:12px;color:#6e6e73;margin:6px 0 12px;}',
'.wy-decide-opt{display:block;width:100%;text-align:left;background:#fff;border:1px solid #d9d9de;border-radius:12px;padding:12px 14px;margin-bottom:8px;font-size:14px;line-height:1.6;color:#1c1c1e;cursor:pointer;}',
'.wy-decide-free-h{font-size:13px;font-weight:700;color:#1c1c1e;margin:12px 0 8px;}',
'.wy-decide-free-box{background:#fff;border:1px solid #d9d9de;border-radius:12px;padding:10px 12px;}',
'.wy-decide-free-box textarea{width:100%;box-sizing:border-box;border:0;outline:none;resize:vertical;min-height:64px;font-size:14px;line-height:1.7;font-family:inherit;background:transparent;color:#1c1c1e;}',
'.wy-decide-free-foot{display:flex;align-items:center;justify-content:space-between;margin-top:6px;}',
'.wy-decide-free-foot span{font-size:11px;color:#8a8a8e;}',
'.wy-decide-send{border:0;border-radius:999px;background:#3b3b6d;color:#fff;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;}',
'.wy-decide-send:disabled{opacity:.45;cursor:default;}',
'.wy-bottombar{position:sticky;bottom:0;z-index:5;background:#f4f4f5;padding:6px 0 2px;}',
'.wy-nav{display:flex;gap:4px;margin-top:8px;background:#fff;border:1px solid #e4e4e7;border-radius:999px;padding:4px;box-shadow:0 2px 10px rgba(0,0,0,.06);}',
'.wy-nav-btn{flex:1;border:0;background:transparent;color:#3a3a3c;font-size:11px;cursor:pointer;padding:6px 0;display:flex;flex-direction:column;align-items:center;gap:2px;}',
'.wy-nav-ic{font-size:16px;line-height:1;}',
'',
'',
'.wy-group{background:#e8f0f8;border:1px solid #c8d8e8;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;line-height:1.9;}',
'.wy-group.wy-gname{text-align:center;letter-spacing:2px;border-top:1px solid #b8c8d8;border-bottom:1px solid #b8c8d8;padding:6px 0;margin-bottom:8px;}',
'.wy-panel{background:#fffdf7;border:1px solid #e6dcc3;border-radius:8px;padding:12px;margin:10px 0;font-size:13px;line-height:2;}',
'.wy-inputbar{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e4e4e7;border-radius:999px;padding:6px 8px 6px 6px;margin-top:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);}',
'.wy-bottombar{position:sticky;bottom:0;z-index:5;background:#f4f4f5;padding:6px 0 2px;}',
'.wy-inputbar .wy-plus,.wy-inputbar .wy-mic{width:36px;height:36px;flex:none;border:0;background:transparent;font-size:20px;color:#1c1c1e;cursor:pointer;}',
'.wy-inputbar input{flex:1;min-width:0;border:0;outline:none;padding:8px 4px;font-size:15px;background:transparent;font-family:inherit;}',
'.wy-send{width:40px;height:40px;border-radius:50%;border:0;background:#1c1c1e;color:#fff;font-size:16px;cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center;}'
].join('\n');
function deleteAdventure(id) { var s = wyStore(); s.adventures = s.adventures.filter(function (x) { return x.id!== id;}); saveWYStore(s); return true;}
function wyGroupPanel(adv) {
var names = [];
try { (AW.allArchiveChars? AW.allArchiveChars(): []).forEach(function (c) { if (c.name && c.name!== mainName3()) names.push(c.name);});} catch (e) {}
var mentioned = {};
(adv.rounds || []).forEach(function (r) { names.forEach(function (nm) { if (((r.dm || '') + ' ' + (r.action || '')).indexOf(nm)!== -1) mentioned[nm] = true;});});
var list = Object.keys(mentioned);
if (!list.length) return '';
var bubbles = [];
(adv.rounds || []).forEach(function (r) {
list.forEach(function (nm) {
var text = (r.dm || '');
if (text.indexOf(nm)!== -1) bubbles.push(nm + '：' + text.slice(Math.max(0, text.indexOf(nm)), text.indexOf(nm) + 60));
});
});
return '<div class="wy-group"><div class="wy-gname">「' + esc3(adv.state.place) + '」的聊天群</div>'
+ (bubbles.length? bubbles.slice(0, 4).map(function (b) { return '<div>' + esc3(b) + '……</div>';}).join(''): '<div>（群里还没有人说话）</div>')
+ '<div style="margin-top:6px">[图片：' + esc3(adv.state.place) + '的照片.jpg]</div>'
+ '<div style="text-align:center;margin-top:10px"></div><div style="text-align:center;font-size:12px;color:#8a9ab0">（你还未发布任何内容，弹幕区空空如也）</div></div>';
}
function wyHomeHTML() {
var worlds = listWorlds();
var advs = listAdventures();
var wall = worlds.map(function (w, i) {
return '<div class="wy-card ' + (i % 2? 'cream': 'lav') + '" data-wy-open-world="' + w.id + '">' + wyCoverThumbHTML(w, 64, 96, true) + '<b>' + esc3(w.title) + '</b><span style="font-size:12px;color:#8a6a52">' + esc3(w.place || '') + (w.goal? ' · ' + esc3(w.goal.slice(0, 10)): '') + '</span><span class="wy-en">WORLD ' + String(i + 1).padStart(2, '0') + '</span><button type="button" class="wy-cover-btn" data-wy-cover="world:' + w.id + '">换封面</button></div>';
}).join('');
wall += '<div class="wy-card create" data-wy-create="1"><span class="wy-plus">＋</span><b>创建世界</b><span class="wy-en">NEW WORLD</span></div>';
var hist = advs.length? advs.map(function (a) {
return '<div class="wy-adv-row"><div><b>' + esc3(a.title) + '</b> <span style="font-size:12px;color:#8a6a52">' + (a.status === 'active'? '进行中': '已结束') + ' · ' + (a.rounds.length - 1) + ' 轮</span><br><span style="font-size:12px;color:#a08a7a">' + esc3(a.state.place) + ' · ' + dayStr3(a.createdAt) + '</span></div><div>' + (a.status === 'active'? '<button type="button" class="aw-news-btn" data-wy-resume="' + a.id + '">继续</button> ': '<button type="button" class="aw-news-btn ghost" data-wy-review="' + a.id + '">复盘</button> ') + '<button type="button" class="aw-news-btn ghost" data-wy-del-adv="' + a.id + '">✕</button></div></div>';
}).join(''): '<div class="wy-empty">还没有冒险记录。创建一个世界，开第一局吧。</div>';
return '<div class="wy-title">文游</div><div class="wy-sub">文字冒险 · ' + esc3(mainName3()) + ' 当 DM</div>'
+ '<div style="text-align:center;margin-top:8px;font-size:12px;color:#8a6a52">' + esc3(dmModeLabel()) + ' · <label style="cursor:pointer"><input type="checkbox" data-wy-model-switch="1" ' + (wyModelOn()? 'checked': '') + '> 允许模型当 DM</label></div>'
+ '<div class="wy-wall">' + wall + '</div>'
+ (!worlds.length? '<div class="wy-empty">还没有世界——创建一个世界（只填一个主题词也可以），或从一次旅行开一局。世界只存你自己创建的，不预填示例。</div>': '')
+ '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0 4px"><label class="aw-news-btn" style="cursor:pointer">📤 上传文本开一局<input type="file" accept=".txt,.json,.epub,.sks" style="display:none" data-wy-upload="1"></label><span style="font-size:12px;color:#a08a7a">TXT / epub / SKS / JSON，手机本地解析；TXT 自动识别 UTF-8/GBK；epub 需在线加载 JSZip，离线会如实提示。</span></div>'
+ '<div data-xwl-audio-sec="wenyou" style="margin:12px 0 4px;font-size:12px;color:#8a6a52">作品音频加载中……</div>'
+ '<div class="wy-sec">📜 冒险记录</div>'
+ '<div style="display:flex;gap:6px;margin-bottom:8px"><input data-wy-q="1" type="text" placeholder="搜索冒险记录…" style="flex:1;border:1px solid #d9c48a;border-radius:6px;padding:8px 10px;background:#fffdf7"><button type="button" class="aw-news-btn ghost" data-wy-export="1">导出 JSONL</button></div>'
+ '<div data-wy-hist="1">' + hist + '</div>';
}
function wyRenderHome(win) {
var root = win.querySelector('.wy-root'); if (!root) return;
root.classList.remove('wy-playing');
root.innerHTML = wyHomeHTML();
try { if (window.XWLAudio) { window.XWLAudio.stopBgm(); var _sec = root.querySelector('[data-xwl-audio-sec]'); if (_sec) window.XWLAudio.renderInto(_sec, (listWorlds()[0] || {}).id || '', { title: '作品音频', worlds: listWorlds().map(function (w) { return { id: w.id, title: w.title }; }) }); } } catch (e) {}
}
function wyOpenCreateModal(win) {
var root = win.querySelector('.wy-root'); if (!root) return;
var places = wyPlaces();
var trips = []; try { trips = AW.listTravel() || [];} catch (e) {}
var m = document.createElement('div'); m.className = 'wy-modal'; m.id = 'wy-create-modal';
m.innerHTML = '<div class="wy-modal-card"><h3>Create World</h3><div style="font-size:12px;color:#8a6a52">创建一个世界 · 只存你自己写的</div>'
+ '<label>世界名称</label><input id="wy-nw-title" type="text" placeholder="例如：雾港旧街">'
+ '<label>世界指令</label><textarea id="wy-nw-inst" placeholder="请建设一个……的文字冒险，内容由文字组成。\n「世界背景」\n（写下这个世界的地点、背景、目标、人物、氛围……）"></textarea>'
+ '<label>地点（可选，从已有地点选）</label><select id="wy-nw-place"><option value="">不指定</option>' + places.map(function (p) { return '<option>' + esc3(p) + '</option>';}).join('') + '</select>'
+ '<label>目标（可选）</label><input id="wy-nw-goal" type="text" placeholder="例如：找到雾港的灯塔">'
+ (trips.length? '<label>或从旅行开一局</label><select id="wy-nw-trip"><option value="">不选</option>' + trips.map(function (t) { return '<option value="' + t.id + '">' + esc3(t.name) + '</option>';}).join('') + '</select>': '')
+ '<div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="aw-news-btn ghost" data-wy-modal="cancel" style="flex:1">取消</button><button type="button" class="aw-news-btn" data-wy-modal="done" style="flex:1">完成创建</button></div>'
+ '<div id="wy-nw-out" style="font-size:12px;color:#8a6a52;margin-top:8px"></div></div>';
root.appendChild(m);
m.addEventListener('click', function (ev) {
var b = ev.target && ev.target.closest? ev.target.closest('[data-wy-modal]'): null; if (!b) return;
if (b.getAttribute('data-wy-modal') === 'cancel') { m.remove(); return;}
var out = document.getElementById('wy-nw-out');
try {
var tripId = (document.getElementById('wy-nw-trip') || {}).value || '';
if (tripId) { var adv = startAdventureFromTrip(tripId); m.remove(); wyRenderPlay(win, adv.id); return;}
var w = createWorld({ title: (document.getElementById('wy-nw-title') || {}).value, instructions: (document.getElementById('wy-nw-inst') || {}).value, place: (document.getElementById('wy-nw-place') || {}).value, goal: (document.getElementById('wy-nw-goal') || {}).value});
m.remove(); wyRenderHome(win);
var adv2 = startAdventure(w.id); wyRenderPlay(win, adv2.id);
} catch (e) { if (out) out.textContent = e.message || '创建失败';}
});
}
function wyRenderPlay(win, advId) {
var root = win.querySelector('.wy-root'); if (!root) return;
var adv = getAdventure(advId); if (!adv) { wyRenderHome(win); return;}
var world = getWorld(adv.worldId) || { title: adv.title};
var rounds = (adv.rounds || []).map(function (r) { return wyRoundHTML(r, adv); }).join('');
var opts = adv.status === 'active' ? wyDecisionCardHTML(adv) : '';
var st = adv.state;
root.classList.add('wy-playing');
root.innerHTML = '<div class="wy-play-top"><button type="button" class="wy-back" data-wy="back" aria-label="返回">←</button><b>' + esc3(mainName3()) + '</b><button type="button" class="wy-more" data-wy="menu" aria-label="更多">•••</button></div>'
+ '<div class="wy-worldline">' + wyCoverThumbHTML(world, 26, 39) + ' ' + esc3(world.title) + ' · ' + esc3(st.place) + '</div>'
+ '<div data-wy-panels="1"></div>'
+ '<div class="wy-story">' + rounds + wyGroupPanel(adv) + '</div>'
+ (adv.status === 'active'? opts: '<div class="wy-empty">这场冒险已经结束了。</div>')
+ (adv.status === 'active'? '<div class="wy-bottombar"><div class="wy-inputbar"><button type="button" class="wy-plus" data-wy="plus" aria-label="更多">＋</button><input data-wy-input="1" type="text" placeholder="输入你的回复或行动..." autocomplete="off"><button type="button" class="wy-mic" data-wy="mic" aria-label="语音输入">🎙</button><button type="button" class="wy-send" data-wy="send" data-wy-sendbtn="1" aria-label="语音输入">●</button></div>' + wyBottomNavHTML() + '</div>': '')
+ '<div style="text-align:center;font-size:12px;color:#a08a7a;margin-top:10px">' + esc3(dmModeLabel()) + ' · 隐藏事件只显效果，不亮骰子</div>';
var panels = root.querySelector('[data-wy-panels]');
var showPanel = function (kind) {
if (!panels) return;
if (kind === 'attrs') {
panels.innerHTML = '<div class="wy-panel"><b>🌸 你的属性 🌸</b><br>- <b>姓名：</b>我<br>- <b>年龄：</b>未设定<br>- <b>身份：</b>冒险者<br>- <b>容貌：</b>未设定<br>- <b>当前状态：</b>' + esc3(st.place) + ' · 精力 ' + st.stamina + ' · 金币 ' + st.coins + '</div>';
} else if (kind === 'status') {
panels.innerHTML = '<div class="wy-panel"><b>状态面板</b><br>当前位置：' + esc3(st.place) + '<br>背包/物品：' + esc3(st.inventory.join('、') || '空') + '<br>金币：' + st.coins + '<br>体力/精力：' + st.stamina + '/100<br>当前目标：' + esc3(st.goal || '无') + '<br>关键标记：' + esc3(st.flags.join('、') || '无') + '<br>同行者：' + esc3(st.companions.join('、')) + '（好感 ' + (AW.affectionValue? AW.affectionValue(): 0) + '）</div>';
} else panels.innerHTML = '';
};
root._wyShowPanel = showPanel;
var doAction = function (action) {
if (!action) return;
try {
var r = doWenyouRound(adv.id, action);
if (r && typeof r.then === 'function') {
var story = root.querySelector('.wy-story');
if (story) story.insertAdjacentHTML('beforeend', '<div class="wy-user"><div class="wy-user-bubble">' + esc3(action) + '</div></div><p class="wy-narr">DM 思考中…</p>');
r.then(function () { wyRenderPlay(win, adv.id);}).catch(function (e) { toast3(e.message || '这回合没推进'); wyRenderPlay(win, adv.id);});
} else wyRenderPlay(win, adv.id);
} catch (e) { toast3(e.message || '这回合没推进');}
};
root._wyDoAction = doAction;
root._wyAdvId = adv.id;
try { if (window.XWLAudio) window.XWLAudio.playSceneBgm(adv.worldId, st.place); } catch (e) {}
}
function wyShowReview(win, advId, saved) {
var root = win.querySelector('.wy-root'); if (!root) return;
try { if (window.XWLAudio) window.XWLAudio.stopBgm(); } catch (e) {}
var adv = getAdventure(advId); if (!adv ||!adv.review) { wyRenderHome(win); return;}
var rv = adv.review;
root.classList.add('wy-playing');
root.innerHTML = '<div class="wy-play-top"><button type="button" class="wy-back" data-wy="back" aria-label="返回">←</button><b>复盘 · ' + esc3(adv.title) + '</b><span style="width:38px;flex:none"></span></div>'
+ '<div class="wy-panel"><b>结局复盘</b><br>' + esc3(rv.outcome) + '<br>一共 ' + rv.rounds + ' 轮 · 做了 ' + rv.choices.length + ' 次行动 · 好感变化 ' + (rv.affectionDelta > 0? '+': '') + rv.affectionDelta + '</div>'
+ '<div class="wy-panel"><b>隐藏线索与随机事件（现在揭示）</b><br>' + rv.hiddenEvents.map(function (e) { return (e.triggered? '✓ ': '✗ ') + esc3(e.text);}).join('<br>') + '</div>'
+ '<div class="wy-panel"><b>你的选择</b><br>' + (rv.choices.length? rv.choices.map(function (c) { return '· ' + esc3(c);}).join('<br>'): '（没有行动记录）') + '</div>'
+ '<div style="font-size:13px;color:#8a6a52;line-height:1.9">' + (saved === true? '已存成归巢记忆。': saved === false? '已放弃，不留记录。': '结束时选择保存记忆或放弃记忆（与剧本同一规则）。') + '</div>'
+ '<div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="aw-news-btn" data-wy="home" style="flex:1">回到文游首页</button></div>';
}
function wyBindRoot(win) {
var root = win.querySelector('.wy-root'); if (!root || root._wyBound) return;
root._wyBound = true;
root.addEventListener('click', function (ev) {
var b = ev.target && ev.target.closest? ev.target.closest('[data-wy]'): null;
var ow = ev.target && ev.target.closest? ev.target.closest('[data-wy-open-world]'): null;
var cr = ev.target && ev.target.closest? ev.target.closest('[data-wy-create]'): null;
var rs = ev.target && ev.target.closest? ev.target.closest('[data-wy-resume]'): null;
var rv = ev.target && ev.target.closest? ev.target.closest('[data-wy-review]'): null;
var dl = ev.target && ev.target.closest? ev.target.closest('[data-wy-del-adv]'): null;
var ex = ev.target && ev.target.closest? ev.target.closest('[data-wy-export]'): null;
var sg = ev.target && ev.target.closest? ev.target.closest('[data-wy-sug]'): null;
var sw = ev.target && ev.target.closest? ev.target.closest('[data-wy-model-switch]'): null;
var ac = ev.target && ev.target.closest? ev.target.closest('[data-wy-act]'): null;
var cv = ev.target && ev.target.closest? ev.target.closest('[data-wy-cover]'): null;
var dc = ev.target && ev.target.closest? ev.target.closest('[data-wy-decide]'): null;
var ds = ev.target && ev.target.closest? ev.target.closest('[data-wy-decide-send]'): null;
var nv = ev.target && ev.target.closest? ev.target.closest('[data-wy-nav]'): null;
var lt = ev.target && ev.target.closest? ev.target.closest('[data-wy-letter-stage]'): null;
var nm2 = ev.target && ev.target.closest? ev.target.closest('[data-wy-nav-model]'): null;
if (sw) { setWYModelOn(sw.checked); setTimeout(function () { wyRenderHome(win);}, 50); return;}
if (nm2) { setWYModelOn(nm2.checked); toast3(nm2.checked ? '已允许模型当 DM' : '已只用模板叙述'); return;}
if (cv) { var _cvParts = (cv.getAttribute('data-wy-cover') || '').split(':'); var _cvKind = _cvParts[0] || 'world'; var _cvId = _cvParts.slice(1).join(':'); var _cvBook = _cvKind === 'world' ? getWorld(_cvId) : getVN(_cvId); if (_cvBook) wyOpenCoverChooser(_cvId, _cvBook.title, function () { wyRenderHome(win); }, root); return;}
if (ow) { var adv = startAdventure(ow.getAttribute('data-wy-open-world')); wyRenderPlay(win, adv.id); return;}
if (cr) { wyOpenCreateModal(win); return;}
if (rs) { wyRenderPlay(win, rs.getAttribute('data-wy-resume')); return;}
if (rv) { wyShowReview(win, rv.getAttribute('data-wy-review')); return;}
if (dl) { deleteAdventure(dl.getAttribute('data-wy-del-adv')); wyRenderHome(win); return;}
if (ex) {
try { var blob = new Blob([exportAdventuresJSONL()], { type: 'application/jsonl'}); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wenyou_history.jsonl'; a.click(); toast3('已导出冒险记录');} catch (e) { toast3(e.message || '导出失败');}
return;
}
if (sg) { if (root._wyDoAction) root._wyDoAction(sg.getAttribute('data-wy-sug')); return;}
if (dc) { if (root._wyDoAction) root._wyDoAction(dc.getAttribute('data-wy-decide')); return;}
if (ds) { var _fta = root.querySelector('[data-wy-free]'); var _fv = _fta ? String(_fta.value || '').slice(0, 500).trim() : ''; if (!_fv) { toast3('先写点什么，再发送行动'); return; } if (_fta) { _fta.value = ''; var _fc = root.querySelector('[data-wy-free-count]'); if (_fc) _fc.textContent = '500 字以内'; ds.disabled = true; } if (root._wyDoAction) root._wyDoAction(_fv); return;}
if (lt) { wyToggleLetter(win, lt); return;}
if (nv) { var _nact = nv.getAttribute('data-wy-nav'); if (_nact === 'story') { var _st2 = root.querySelector('.wy-story'); if (_st2 && _st2.scrollIntoView) _st2.scrollIntoView(); return; } if (_nact === 'chars') { if (root._wyShowPanel) root._wyShowPanel('attrs'); var _pn = root.querySelector('[data-wy-panels]'); if (_pn && _pn.scrollIntoView) _pn.scrollIntoView(); return; } if (_nact === 'archive') { wyOpenWyArchive(win); return; } if (_nact === 'settings') { wyOpenWySettings(win); return; } if (_nact === 'help') { wyOpenWyHelp(win); return; } return;}
if (ac) { wyHandleAction(win, ac); return;}
if (!b) return;
var act = b.getAttribute('data-wy');
if (act === 'back' || act === 'home') { wyRenderHome(win); return;}
if (act === 'menuclose') { var mm = b.closest('.wy-modal'); if (mm) mm.remove(); return;}
if (act === 'menu') { wyOpenWyMenu(win); return;}
if (act === 'mic') { wyStartVoiceInput(win); return;}
if (act === 'plus') { wyOpenWyPlus(win); return;}
if (act === 'attrs' || act === 'status') { if (root._wyShowPanel) root._wyShowPanel(act); return;}
if (act === 'send') { var inp = root.querySelector('[data-wy-input]'); if (inp) { var v = inp.value; if (!String(v || '').trim()) { wyStartVoiceInput(win); return; } inp.value = ''; wyUpdateSendBtn(root); if (root._wyDoAction) root._wyDoAction(v);} return;}
if (act === 'end') {
var _mm = b.closest('.wy-modal'); if (_mm) _mm.remove();
var advId = root._wyAdvId; if (!advId) return;
var m = document.createElement('div'); m.className = 'wy-modal';
m.innerHTML = '<div class="wy-modal-card"><h3>结束这场冒险？</h3><div style="font-size:13px;line-height:1.9">结束时会出一份复盘（隐藏线索与随机事件揭示）。然后选择：保存成归巢记忆，或放弃不留记录。</div><div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="aw-news-btn" data-wy-end="save" style="flex:1">💾 保存记忆并结束</button><button type="button" class="aw-news-btn ghost" data-wy-end="drop" style="flex:1">放弃，不留记录</button></div><div style="margin-top:10px;text-align:center"><button type="button" class="aw-news-btn ghost" data-wy-end="cancel">再玩一会儿</button></div></div>';
root.appendChild(m);
m.addEventListener('click', function (e2) {
var eb = e2.target && e2.target.closest? e2.target.closest('[data-wy-end]'): null; if (!eb) return;
var ea = eb.getAttribute('data-wy-end');
if (ea === 'cancel') { m.remove(); return;}
var res = endAdventure(advId, { saveMemory: ea === 'save'});
m.remove();
wyShowReview(win, advId, ea === 'save');
});
return;
}
});
root.addEventListener('keydown', function (ev) {
if (ev.key === 'Enter' && ev.target && ev.target.matches && ev.target.matches('[data-wy-input]')) {
var v = ev.target.value; ev.target.value = ''; wyUpdateSendBtn(root); if (root._wyDoAction) root._wyDoAction(v);
}
});
root.addEventListener('change', function (ev) {
var up = ev.target && ev.target.closest? ev.target.closest('[data-wy-upload]'): null;
if (up && up.files && up.files[0]) { var _uf = up.files[0]; up.value = ''; wyHandleWenyouUpload(win, _uf); }
});
root.addEventListener('input', function (ev) {
if (ev.target && ev.target.matches && ev.target.matches('[data-wy-input]')) { wyUpdateSendBtn(root); return; }
if (ev.target && ev.target.matches && ev.target.matches('[data-wy-free]')) { var _ta = ev.target; var _cnt = root.querySelector('[data-wy-free-count]'); if (_cnt) _cnt.textContent = _ta.value.length + ' / 500 字'; var _sb = root.querySelector('[data-wy-decide-send]'); if (_sb) _sb.disabled = !String(_ta.value || '').trim(); return; }
if (ev.target && ev.target.matches && ev.target.matches('[data-wy-q]')) {
var q = ev.target.value; var box = root.querySelector('[data-wy-hist]');
if (!box) return;
var list = searchAdventures(q);
box.innerHTML = list.length? list.map(function (a) {
return '<div class="wy-adv-row"><div><b>' + esc3(a.title) + '</b> <span style="font-size:12px;color:#8a6a52">' + (a.status === 'active'? '进行中': '已结束') + ' · ' + (a.rounds.length - 1) + ' 轮</span></div><div>' + (a.status === 'active'? '<button type="button" class="aw-news-btn" data-wy-resume="' + a.id + '">继续</button> ': '<button type="button" class="aw-news-btn ghost" data-wy-review="' + a.id + '">复盘</button> ') + '</div></div>';
}).join(''): '<div class="wy-empty">没有找到相关的冒险记录。</div>';
}
});
}
function registerWenyouApp() {
try {
if (typeof AppManager === 'undefined') return false;
AppManager.register('wenyou', {
createApp: function (win) {
win.innerHTML = '<style>' + WY_CSS + '</style><div class="wy-root" id="wy-root"></div>';
wyRenderHome(win); wyBindRoot(win);
},
resume: function (win) { var root = win.querySelector('.wy-root'); if (root &&!root.innerHTML.trim()) { wyRenderHome(win); wyBindRoot(win);}},
pause: function () {}
});
return true;
} catch (e) { return false;}
}
function removeWenyouDesktopIcon() {
/* [GROUP-APPS] 文游入口只在剧本 app 内：桌面不再放文游图标。清掉 SWEEP-3 补建的
   桌面图标（IconSystem ASSETS 注册、layout.grid2 里的 'wenyou'、已建的 wrapper 节点，
   含已持久化到本机的 layout），不留孤儿图标。文游 app 本身仍注册（AppManager.register
   ('wenyou')），剧本 app 的 mode-wenyou 照常 launch('wenyou')。 */
try {
if (window.IconSystem && window.IconSystem.ASSETS && window.IconSystem.ASSETS['wenyou']) delete window.IconSystem.ASSETS['wenyou'];
var layout = window.IconSystem && window.IconSystem.layout;
if (layout && Array.isArray(layout.grid2)) {
var ix = layout.grid2.indexOf('wenyou');
if (ix !== -1) { layout.grid2.splice(ix, 1); if (window.IconSystem.save) window.IconSystem.save(); if (window.IconSystem.repaintAll) window.IconSystem.repaintAll(); }
}
var wrap = document.querySelector('.sys-app-icon-wrapper[data-target-app="wenyou"]');
if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
return true;
} catch (e) { return false; }
}

/* ── 启动（第三块） ── */
function boot3() {
try { ensurePlatenStyle(); registerWenyouApp(); removeWenyouDesktopIcon();} catch (e) {}
var tick3 = function () {
try { deliverDueLetters();} catch (e) {}
try { checkCapsules();} catch (e) {}
try { injectTransitBlock();} catch (e) {}
try { ensureScriptVN();} catch (e) {}
try { registerWenyouApp(); removeWenyouDesktopIcon();} catch (e) {}
};
tick3();
setInterval(tick3, 3000);
if (typeof MutationObserver!== 'undefined') {
try {
var ob = new MutationObserver(function () { tick3();});
ob.observe(document.documentElement || document.body, { childList: true, subtree: true});
} catch (e) {}
}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot3); else boot3();

Object.assign(window.AWGroup, {
TRANSIT_KEY: TRANSIT_KEY, CAPSULE_KEY: CAPSULE_KEY, VN_KEY: VN_KEY, WY_KEY: WY_KEY,
nextMorning8: nextMorning8, sendLetterToChar: sendLetterToChar, deliverCharLetter: deliverCharLetter,
listInTransit: listInTransit, deliverDueLetters: deliverDueLetters,
createTimeCapsule: createTimeCapsule, listTimeCapsules: listTimeCapsules, capsuleDue: capsuleDue,
checkCapsules: checkCapsules, openTimeCapsule: openTimeCapsule, injectTransitBlock: injectTransitBlock, openCapsuleForm: openCapsuleForm,
listVNs: listVNs, getVN: getVN, saveVN: saveVN, deleteVN: deleteVN,
parseVNFile: parseVNFile, parseTxtVN: parseTxtVN, parseJsonVN: parseJsonVN, parseSKSVN: parseSKSVN, structureProseToVN: structureProseToVN,
vnParseLangText: vnParseLangText, vnLangText: vnLangText, vnRichText: vnRichText, vnStageScale: vnStageScale, vnSaveGame: vnSaveGame, vnLoadGame: vnLoadGame, vnListSaves: vnListSaves, vnVideoFallback: vnVideoFallback, vnGetLang: vnGetLang, vnSetLang: vnSetLang,
matchVNCharacters: matchVNCharacters, openVNPlayer: openVNPlayer, openVNReview: openVNReview, handleVNFile: handleVNFile,
ensureScriptVN: ensureScriptVN, changeAffection: changeAffection, MAX_VN_FILE_BYTES: MAX_VN_FILE_BYTES,
listWorlds: listWorlds, getWorld: getWorld, createWorld: createWorld, deleteWorld: deleteWorld, wyPlaces: wyPlaces,
listAdventures: listAdventures, getAdventure: getAdventure, saveAdventure: saveAdventure, deleteAdventure: deleteAdventure,
searchAdventures: searchAdventures, exportAdventuresJSONL: exportAdventuresJSONL,
wyModelOn: wyModelOn, setWYModelOn: setWYModelOn, dmModeLabel: dmModeLabel,
startAdventure: startAdventure, startAdventureFromTrip: startAdventureFromTrip, suggestActions: suggestActions,
doWenyouRound: doWenyouRound, endAdventure: endAdventure, wyHiddenEvents: wyHiddenEvents,
registerWenyouApp: registerWenyouApp, removeWenyouDesktopIcon: removeWenyouDesktopIcon, wyRenderHome: wyRenderHome, wyRenderPlay: wyRenderPlay, wyMilestoneCrossed: wyMilestoneCrossed, wyBuildMilestoneLetters: wyBuildMilestoneLetters, wyTemplateLetterText: wyTemplateLetterText, wyParseUploadFile: wyParseUploadFile, wyReadUploadedText: wyReadUploadedText, wyParseEpubBuffer: wyParseEpubBuffer, wyChaptersToVN: wyChaptersToVN, wyCoverThumbHTML: wyCoverThumbHTML, wyDecisionCardHTML: wyDecisionCardHTML, openScriptCoverChooser: wyOpenCoverChooser
});
})();
