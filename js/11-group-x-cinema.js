

/* GROUP-X-CINEMA · 影院「一起看」 ═══════════════════════════════════════════
出处：Open Watch Cinema https://github.com/wynsyl1014/open-watch-cinema（MIT）。
只借鉴做法——本地片库与播片、按剧集建合集、可跳过片头片尾、AI 跟着进度看、
边看边聊 + 弹幕 + 轻互动、点时间戳跳回那一幕、共享手记、续看、票根导出。
未复制其代码，本模块为全新自写；不要服务器、FFmpeg、MCP、真实影片文件、
AI 看画面听声音——手机里没有真实影片，片是本地模拟短片（立体书世界场景 +
对白 + 分镜卡，CSS/SVG 画，不外链图片或音频），界面上诚实标注。
新增键（只新增，不改已有键）：
cinema_progress_v1（每部片 {sceneIdx, ts, finished}，续看）、
cinema_notes_v1（每部片 {relations, timeline, qa, notes, charNote}，共享手记）、
cinema_chat_v1（每部片放映室聊天，消息带电影时间戳）、
cinema_tickets_v1（票根列表）、cinema_settings_v1（弹幕开关）。
只读复用：otome_affection_v1（F 组好感，决定 char 反应文案的阶段；只读不写）、
otome_home_v1（F 组宠物，领养了猫就坐在旁边当观众；只读不写）、
cike_char_look_v1（换装发色瞳色，只读）、phone_album_local_v1（D 组相册结构，
票根存入相册时按同一结构追加 {id, src, title, addedAt}）。
S 组心情向量未合入（工作文件里没有相关键），反应文案按好感阶段 + 时间段取。
══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var MARKER = 'GroupX-v1';
var PROG_KEY = 'cinema_progress_v1';
var NOTES_KEY = 'cinema_notes_v1';
var CHAT_KEY = 'cinema_chat_v1';
var TICKET_KEY = 'cinema_tickets_v1';
var SET_KEY = 'cinema_settings_v1';
var AFF_KEY = 'otome_affection_v1';
var HOME_KEY = 'otome_home_v1';
var LOOK_KEY = 'cike_char_look_v1';
var ALBUM_KEY = 'phone_album_local_v1';

function read(k, fb) { try { var r = localStorage.getItem(k); return r == null? fb: JSON.parse(r);} catch (e) { return fb;}}
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}}
function esc(s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');}
function uid(p) { return (p || 'cx') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);}
function pad2(n) { return String(n).padStart(2, '0');}
function fmtClock(sec) { sec = Math.max(0, Math.round(sec || 0)); return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);}
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());}
function charName() {
try { if (typeof SystemStore!== 'undefined') { var c = SystemStore.get('character'); if (c) return c;}} catch (e) {}
try { if (typeof MemoryCore!== 'undefined' && MemoryCore.world) { var a = MemoryCore.world.get('activeChar'); if (a) return a;}} catch (e) {}
return '他';
}
function look() { var v = read(LOOK_KEY, null); return { hair: (v && v.hair) || '#3a2a1e', eye: (v && v.eye) || '#2b2b2b'};}
function affValue() {
var name = charName();
try { if (typeof OtomeF!== 'undefined' && OtomeF.loadAff) { var r = OtomeF.loadAff(name); if (r && typeof r.value === 'number') return r.value;}} catch (e) {}
try { var all = read(AFF_KEY, {}) || {}; var rec = all[name]; if (rec && typeof rec.value === 'number') return rec.value;} catch (e) {}
return 0;
}
function tierOf(v) {
if (v >= 75) return { min: 75, label: '恋人'};
if (v >= 50) return { min: 50, label: '暧昧'};
if (v >= 20) return { min: 20, label: '朋友'};
return { min: 0, label: '相识'};
}
function petCat() {
try { var h = read(HOME_KEY, null); if (h && h.pet && h.pet.kind === 'cat') return { name: h.pet.name || '猫'};} catch (e) {}
return null;
}

/* ── 片库：本地模拟短片（CSS 渐变 + 表情分镜卡，无真实影片文件） ── */
var SERIES = [
{ id: 'day', title: 'char 的一天', desc: '跟着他过完普普通通、又有点发光的一天。'},
{ id: 'rain', title: '雨夜', desc: '一场雨，把两个人留在同一间咖啡馆里。'},
{ id: 'fest', title: '夏日祭', desc: '烟花、捞金鱼，和走散又重逢的夜晚。'}
];
/* GROUP-CINEMA-OWC · 恢复 4 部内置模拟短片（2026-11-26）
   原因：42062 行 FILMS=[] 被 [AJ] 清空，影院只剩“还没有短片”空页（见补丁 §1）。
   原片数据已丢失（备份文件里也没有），按 [AJ] 注释留下的 4 个原片名重写，非恢复原片。
   全部原创台词；OWC 本身不带内置影片，无内容可复用。片是模拟放映，界面已有“本地模拟短片”诚实标注。 */
var FILMS = [
  { id: 'cx-day-morning', series: 'day', title: 'char 的一天 · 清晨', desc: '闹钟响之前，他已经把早餐摆好了。', scenes: [
    { t: '闹钟之前', place: '卧室 · 6:40', g: ['#f7d9a0', '#e8a56b'], ic: '🌅', dur: 25, intro: true, react: '早饭是我做的，粥没糊，值得表扬一下吧。', lines: [['旁白', '闹钟还没响，厨房已经有动静了。'], ['他', '再睡五分钟……好吧，是我输了，起来吃早饭。']] },
    { t: '早餐', place: '餐桌 · 7:05', g: ['#fdeecf', '#f5c98a'], ic: '🍚', dur: 30, react: '你吃东西的样子，比粥还暖。', lines: [['他', '粥里放了你喜欢的红枣，趁热吃。'], ['你', '你怎么知道我今天想吃这个？'], ['他', '因为每天都是今天。']] },
    { t: '出门', place: '楼下 · 7:40', g: ['#cfe8d8', '#8fc7a8'], ic: '🚶', dur: 25, react: '今天也要好好过，晚上见。', lines: [['他', '伞在包里，天气预报说下午有雨。'], ['你', '你比天气预报准多了。']] },
    { t: '午后', place: '街角书店 · 13:20', g: ['#dcebf7', '#a8c8e8'], ic: '📖', dur: 30, react: '这本书我替你留着，回来一起看。', lines: [['旁白', '他替你留了一本书，夹着一张写了字的书签。'], ['他', '看到第三章就停了，等你回来一起看。']] },
    { t: '回家', place: '家门口 · 18:30', g: ['#f9c5a0', '#e88ca0'], ic: '🏠', dur: 30, outro: true, react: '你回来了。今天也辛苦啦。', lines: [['他', '回来了？鞋放这边，饭马上就好。'], ['你', '今天的夕阳很好看，可惜你没看到。'], ['他', '看到了啊——你一进门，夕阳就跟着进来了。']] }
  ] },
  { id: 'cx-day-night', series: 'day', title: 'char 的一天 · 深夜', desc: '城市睡了，他还醒着，替你留一盏灯。', scenes: [
    { t: '加班', place: '书房 · 23:10', g: ['#3a3a5c', '#232338'], ic: '🌙', dur: 30, react: '别熬太晚，我陪你到这一页写完。', lines: [['旁白', '只剩书房一盏灯，和一杯快凉了的茶。'], ['他', '还有多少？写完这一页就睡，好不好？']] },
    { t: '热牛奶', place: '厨房 · 23:40', g: ['#4a3a5c', '#2c2340'], ic: '🥛', dur: 25, react: '牛奶热好了，小心烫。', lines: [['他', '牛奶热好了，蜂蜜放了一点点。'], ['你', '你怎么还不睡？'], ['他', '你睡了我再睡，不然我不放心。']] },
    { t: '阳台', place: '阳台 · 0:05', g: ['#2c3a5c', '#1a2340'], ic: '✨', dur: 30, react: '星星不多，但今晚的月亮很好看。', lines: [['他', '出来透透气，夜里的风是凉的。'], ['你', '月亮今晚真好看。'], ['他', '嗯，和你一样好看。']] },
    { t: '晚安', place: '卧室 · 0:30', g: ['#5c4a6b', '#33283f'], ic: '💤', dur: 25, outro: true, react: '晚安。明天也是很好的一天。', lines: [['他', '灯我留着最小那档，你怕黑。'], ['你', '晚安。'], ['他', '晚安。明天也是很好的一天。']] }
  ] },
  { id: 'cx-rain', series: 'rain', title: '雨夜', desc: '一场雨，把两个人留在同一间咖啡馆里。', scenes: [
    { t: '躲雨', place: '咖啡馆门口 · 20:15', g: ['#5c7a8a', '#33505f'], ic: '🌧️', dur: 30, intro: true, react: '进来躲躲雨吧，我点了两杯热的。', lines: [['旁白', '雨下得突然，整条街的人都在找屋檐。'], ['他', '进来躲躲雨吧，我点了两杯热的。']] },
    { t: '靠窗的位置', place: '咖啡馆 · 20:30', g: ['#6b7f8a', '#42586b'], ic: '☕', dur: 35, react: '你头发上有雨，我帮你擦擦。', lines: [['他', '坐窗边吧，能看见雨。'], ['你', '你经常来这家店吗？'], ['他', '第一次。但以后可能会经常来。']] },
    { t: '雨声', place: '咖啡馆 · 21:00', g: ['#4a5c6b', '#2c3a4a'], ic: '🎵', dur: 30, react: '雨声这么大，说话要靠近一点才听得见。', lines: [['旁白', '雨声盖住了店里的音乐，只剩下两个人的声音。'], ['他', '雨声这么大，说话要靠近一点才听得见。']] },
    { t: '伞', place: '咖啡馆门口 · 21:40', g: ['#5c6b7a', '#333f4d'], ic: '☂️', dur: 25, react: '只有一把伞，往我这边靠靠。', lines: [['他', '雨小了，走吧。'], ['你', '只有一把伞啊。'], ['他', '嗯，所以往我这边靠靠。']] },
    { t: '雨停了', place: '长街 · 22:05', g: ['#7a8a9a', '#4a5568'], ic: '🌈', dur: 30, outro: true, react: '雨停了，但我不想这么快说再见。', lines: [['旁白', '雨停的时候，地面亮晶晶的，像撒了一街星星。'], ['他', '雨停了。'], ['你', '嗯。'], ['他', '但我不想这么快说再见。']] }
  ] },
  { id: 'cx-fest', series: 'fest', title: '夏日祭', desc: '烟花、捞金鱼，和走散又重逢的夜晚。', scenes: [
    { t: '出发', place: '家门口 · 18:00', g: ['#f9b8c4', '#e88ca0'], ic: '🎐', dur: 25, intro: true, react: '浴衣穿好了吗？祭典可不等人的。', lines: [['他', '浴衣穿好了吗？祭典可不等人的。'], ['你', '好了好了，带子帮我系一下。']] },
    { t: '捞金鱼', place: '祭典小摊 · 19:10', g: ['#f7c98a', '#e89a6b'], ic: '🐟', dur: 30, react: '捞到了！这条归你，我养的那条归你养。', lines: [['旁白', '纸网破了三张，第四张终于捞上来一条。'], ['他', '捞到了！这条归你。'], ['你', '那你养的那条呢？'], ['他', '也归你养。']] },
    { t: '章鱼烧', place: '小吃摊 · 19:45', g: ['#f9d976', '#e8a56b'], ic: '🍢', dur: 25, react: '烫烫烫……给你一半，不许嫌弃。', lines: [['他', '章鱼烧，刚出锅的。'], ['你', '烫！'], ['他', '给你一半，不许嫌弃。']] },
    { t: '走散', place: '人海 · 20:20', g: ['#8a7fb8', '#5c548a'], ic: '🎇', dur: 35, react: '别怕，我在这里。手给我，别再走散了。', lines: [['旁白', '一个浪头般的人群涌过来，再回头，他不见了。'], ['你', '人呢……'], ['他', '别怕，我在这里。手给我，别再走散了。']] },
    { t: '烟花', place: '河边 · 21:00', g: ['#6b5c9e', '#3a2a5c'], ic: '🎆', dur: 40, outro: true, react: '烟花很美，但你看烟花的时候更美。', lines: [['旁白', '第一朵烟花升起来，整条河都被照亮了。'], ['他', '烟花很美。'], ['你', '嗯。'], ['他', '但你看烟花的时候更美。']] }
  ] }
];
function filmById(id) { for (var i = 0; i < FILMS.length; i++) if (FILMS[i].id === id) return FILMS[i]; return null;}
function sceneStartSec(film, idx) { var s = 0; for (var i = 0; i < idx && i < film.scenes.length; i++) s += film.scenes[i].dur || 0; return s;}
function filmTotalSec(film) { var s = 0; film.scenes.forEach(function (sc) { s += sc.dur || 0;}); return s;}

/* ── char 反应：好感阶段 + 时间段（S 组心情向量未合入，用好感 + 时间推导） ── */
var TIER_PREFIX = {
'相识': '他有点拘谨，小声说：「',
'朋友': '他笑着凑过来：「',
'暧昧': '他耳根有点红，轻声说：「',
'恋人': '他握住你的手：「'
};
function reactionFor(filmId, sceneIdx, aff, hour) {
var film = filmById(filmId); if (!film) return null;
var sc = film.scenes[sceneIdx]; if (!sc) return null;
var v = (typeof aff === 'number')? aff: affValue();
var h = (typeof hour === 'number')? hour: new Date().getHours();
var tier = tierOf(v);
var text = (TIER_PREFIX[tier.label] || '') + (sc.react || '') + '」';
if (h >= 23 || h < 6) text += '（夜深了，他声音放得很轻。）';
return { tier: tier.label, aff: v, text: text, sceneTitle: sc.t === undefined? '': sc.t};
}

/* GROUP-CINEMA-OWC · 服务端接口占位 + 本地兜底（2026-11-26 改写新增）
   目的：原补丁 §6 里“做不了的部分”（真实影片/导入/字幕/AI 看画面/MCP 跟片/多 AI 同房/SSE/云端票根）
   不跳过、不编假功能，改成这个接口。以后真接服务器时，只改这个对象内部的实现，
   调用方（手术 F）不用改。本地兜底行为见 §4；所有“以后接什么”都只写在 reason / 注释里，不执行。 */
var CinemaServer = {
  mode: 'local', // 现在只有 'local'；以后真接通服务器再出现 'remote'
  baseUrl: null, // 仅记录地址；填了地址也不等于已联网（见 configure）
  status: function () {
    return { mode: 'local', available: false, label: '本地模式 · 未连接服务器：真实影片、字幕、多 AI 同房暂不可用（以后接服务器开启）' };
  },
  isAvailable: function () { return false; },
  configure: function (opts) {
    if (opts && typeof opts.baseUrl === 'string') this.baseUrl = opts.baseUrl;
    return this.status(); // 诚实标注：现在没有远程握手实现，配了地址 available 仍是 false
  },
  describeScene: function (filmId, sceneIdx) { // 本地兜底：复用已有 reactionFor 的模板文案
    var r = reactionFor(filmId, sceneIdx);
    if (!r) return { ok: false, mode: 'local', reason: '没有这一幕' };
    return { ok: true, mode: 'local', text: r.text, tier: r.tier, source: 'template' };
  },
  fetchFilm: function (filmId) { return { ok: false, mode: 'local', reason: '本地模拟放映，无真实影片文件；以后接 OWC 服务端 /api/media + HTTP Range' }; },
  importFilm: function () { return { ok: false, mode: 'local', reason: '无导入入口；以后接服务端文件接收 + FFmpeg 探针/转码' }; },
  subtitlesFor: function (filmId) { return []; }, // 本地无字幕轨，返回空数组（不是假字幕）
  observeScene: function (filmId, sceneIdx) { return { ok: false, mode: 'local', reason: '无画面/声音观测；以后接 OWC 观影包预计算 + observer（CoNeTTE 环境声描述）' }; },
  joinRoom: function () { return { ok: false, mode: 'local', reason: '无服务器；本机单人放映室，多 AI 同房实时同步不可用；以后接 OWC 放映室 + SSE / MCP / ChatGPT / Codex watch-bridge' }; },
  publishTicket: function (ticket) { return { ok: true, mode: 'local', stored: 'cinema_tickets_v1', id: ticket ? ticket.id : null, note: '票根只存本机 localStorage；云端票根需以后接服务器' }; }
};

/* ── 存储 ── */
function progressAll() { var d = read(PROG_KEY, null); return (d && typeof d === 'object')? d: {};}
function progressFor(filmId) { return progressAll()[filmId] || null;}
function saveProgress(filmId, sceneIdx, finished) {
var all = progressAll();
all[filmId] = { sceneIdx: sceneIdx, ts: Date.now(), finished:!!finished};
write(PROG_KEY, all); return all[filmId];
}
function notesBlank() { return { relations: '', timeline: '', qa: '', notes: '', charNote: ''};}
function notesFor(filmId) { var all = read(NOTES_KEY, {}) || {}; var n = all[filmId]; return n? Object.assign(notesBlank(), n): notesBlank();}
function saveNotes(filmId, patch) {
var all = read(NOTES_KEY, {}) || {};
var n = Object.assign(notesFor(filmId), patch || {}, { updatedAt: Date.now()});
all[filmId] = n; write(NOTES_KEY, all); return n;
}
function charWriteNote(filmId) {
var film = filmById(filmId); if (!film) return null;
var tier = tierOf(affValue());
var line = 'char 的记录（模板生成）：今天和你一起看了《' + film.title + '》，一共 ' + film.scenes.length + ' 幕。'
+ '现在是「' + tier.label + '」阶段，我最喜欢「' + film.scenes[Math.min(2, film.scenes.length - 1)].t + '」那一幕，'
+ '因为那一刻你就坐在我旁边。';
var n = notesFor(filmId);
n.charNote = (n.charNote? n.charNote + '\n': '') + line;
saveNotes(filmId, { charNote: n.charNote});
return line;
}
function chatFor(filmId) { var all = read(CHAT_KEY, {}) || {}; var a = all[filmId]; return Array.isArray(a)? a: [];}
function pushChat(filmId, who, text, sceneIdx) {
var film = filmById(filmId); if (!film) return null;
var all = read(CHAT_KEY, {}) || {};
var list = chatFor(filmId);
var msg = { who: who, text: String(text || ''), sceneIdx: sceneIdx, filmTs: sceneStartSec(film, sceneIdx), ts: Date.now()};
list.push(msg); if (list.length > 200) list = list.slice(-200);
all[filmId] = list; write(CHAT_KEY, all); return msg;
}
function settings() { var s = read(SET_KEY, null); return { danmaku:!(s && s.danmaku === false)};}
function setDanmaku(on) { write(SET_KEY, { danmaku:!!on}); return!!on;}
function tickets() { var a = read(TICKET_KEY, null); return Array.isArray(a)? a: [];}
function buildTicket(filmId, thought) {
var film = filmById(filmId); if (!film) return null;
var last = reactionFor(filmId, film.scenes.length - 1);
return {
id: uid('ticket'), filmId: filmId, title: film.title, date: todayStr(),
withWhom: charName(), thought: thought || (last? last.text: ''),
scenes: film.scenes.length, createdAt: Date.now()
};
}
function saveTicket(t) { var a = tickets(); a.unshift(t); if (a.length > 20) a = a.slice(0, 20); write(TICKET_KEY, a); return t;}
function ticketHTML(t) {
return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>影院票根 · ' + esc(t.title) + '</title>'
+ '<style>body{margin:0;background:#1e1b2e;font-family:-apple-system,"PingFang SC",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}'
+ '.tk{width:340px;background:#fff8ec;border-radius:16px;padding:22px;color:#2b2a28;box-shadow:0 12px 40px rgba(0,0,0,.4)}'
+ '.tk h1{font-size:20px;margin:0 0 4px}.tk.sub{font-size:12px;color:#8a8580}.tk.row{display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px dashed #e5d9c3}'
+ '.tk.th{margin-top:12px;font-size:14px;line-height:1.8;background:#fdf6ec;border-radius:10px;padding:10px 12px}'
+ '.tk.ft{font-size:11px;color:#a8a29c;margin-top:12px;text-align:center}</style></head><body><div class="tk">'
+ '<h1>🎬 ' + esc(t.title) + '</h1><div class="sub">影院 · 一起看 ｜ 本地模拟短片票根</div>'
+ '<div class="row"><span>日期</span><b>' + esc(t.date) + '</b></div>'
+ '<div class="row"><span>一起看的人</span><b>' + esc(t.withWhom) + ' 和你</b></div>'
+ '<div class="row"><span>分镜</span><b>共 ' + t.scenes + ' 幕</b></div>'
+ '<div class="th">char 的一句感想：' + esc(t.thought) + '</div>'
+ '<div class="ft">这张票根只存在这台手机里 · 没有真实影片文件</div>'
+ '</div></body></html>';
}
function ticketSVG(t) {
var s = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
+ '<rect width="640" height="360" rx="20" fill="#fff8ec"/>'
+ '<rect x="0" y="0" width="640" height="84" rx="20" fill="#2b2d42"/>'
+ '<text x="28" y="52" font-size="30" fill="#ffffff" font-family="sans-serif">🎬 ' + esc(t.title) + '</text>'
+ '<text x="28" y="132" font-size="22" fill="#2b2a28" font-family="sans-serif">日期：' + esc(t.date) + '</text>'
+ '<text x="28" y="172" font-size="22" fill="#2b2a28" font-family="sans-serif">一起看的人：' + esc(t.withWhom) + ' 和你</text>'
+ '<text x="28" y="212" font-size="22" fill="#2b2a28" font-family="sans-serif">分镜：共 ' + t.scenes + ' 幕</text>'
+ '<text x="28" y="262" font-size="20" fill="#6d4c2f" font-family="sans-serif">' + esc(String(t.thought || '').slice(0, 34)) + '</text>'
+ '<text x="28" y="322" font-size="16" fill="#a8a29c" font-family="sans-serif">影院 · 一起看 ｜ 本地模拟短片票根</text></svg>';
return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
function saveTicketToAlbum(ticketId) {
var t = null; tickets().forEach(function (x) { if (x.id === ticketId) t = x;});
if (!t) return false;
var arr = read(ALBUM_KEY, null); if (!Array.isArray(arr)) arr = [];
arr.unshift({ id: uid('album'), src: ticketSVG(t), title: '影院票根·' + t.title, addedAt: Date.now()});
if (arr.length > 20) arr = arr.slice(0, 20);
write(ALBUM_KEY, arr); return true;
}
function notesText(filmId) {
var film = filmById(filmId); if (!film) return '';
var n = notesFor(filmId);
return '《' + film.title + '》· 一起看手记\n'
+ '（本地模拟短片的手记，只存在这台手机里）\n\n'
+ '人物关系图：\n' + (n.relations || '（还没写）') + '\n\n'
+ '剧情时间线：\n' + (n.timeline || '（还没写）') + '\n\n'
+ '疑问解答：\n' + (n.qa || '（还没写）') + '\n\n'
+ '随记：\n' + (n.notes || '（还没写）') + '\n\n'
+ 'char 的记录：\n' + (n.charNote || '（char 还没写）') + '\n（char 的记录为模板生成）\n';
}
function downloadFile(name, content, mime) {
try {
var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8'});
var url = URL.createObjectURL(blob);
var a = document.createElement('a'); a.href = url; a.download = name;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(function () { try { URL.revokeObjectURL(url);} catch (e) {}}, 2000);
return true;
} catch (e) { return false;}
}

/* ── 放映状态（内存态；进度落盘 cinema_progress_v1） ── */
var state = { view: 'lib', filmId: null, sceneIdx: 0, playing: false, remain: 0, notice: '', lastTicketId: null };
var timer = null;
function curFilm() { return state.filmId ? filmById(state.filmId) : null; }
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function startTimer() {
  stopTimer();
  timer = setInterval(function () { tick(); }, 1000);
}
function tick() {
  if (!state.playing) return;
  state.remain -= 1;
  var el = document.getElementById('cx-remain');
  if (el) el.textContent = fmtClock(Math.max(0, state.remain));
  if (state.remain <= 0) nextScene();
}
function onSceneChange() {
  var film = curFilm(); if (!film) return;
  var sc = film.scenes[state.sceneIdx]; if (!sc) return;
  state.remain = sc.dur || 20;
  saveProgress(film.id, state.sceneIdx, false);
  var d = CinemaServer.describeScene(film.id, state.sceneIdx);
  if (d && d.ok) pushChat(film.id, 'char', d.text, state.sceneIdx);
  var cat = petCat();
  if (cat && state.sceneIdx % 3 === 2) pushChat(film.id, 'cat', '喵。', state.sceneIdx);
}
function openFilm(filmId) {
  var film = filmById(filmId); if (!film) return false;
  var p = progressFor(filmId);
  state.filmId = filmId;
  state.sceneIdx = (p && !p.finished) ? Math.min(p.sceneIdx, film.scenes.length - 1) : 0;
  state.view = 'screen'; state.playing = false; state.notice = '';
  stopTimer();
  var sc = film.scenes[state.sceneIdx];
  state.remain = sc ? (sc.dur || 20) : 20;
  onSceneChange();
  render();
  return true;
}
function jumpTo(idx) {
  var film = curFilm(); if (!film) return false;
  idx = Math.max(0, Math.min(film.scenes.length - 1, idx | 0));
  state.sceneIdx = idx; onSceneChange(); render(); return true;
}
function nextScene() {
  var film = curFilm(); if (!film) return false;
  if (state.sceneIdx >= film.scenes.length - 1) { finishFilm(); return true; }
  state.sceneIdx += 1; onSceneChange(); render(); return true;
}
function prevScene() {
  var film = curFilm(); if (!film) return false;
  if (state.sceneIdx <= 0) return false;
  state.sceneIdx -= 1; onSceneChange(); render(); return true;
}
function skipIntro() {
  var film = curFilm(); if (!film) return false;
  var idx = 0; film.scenes.forEach(function (sc, i) { if (sc.intro) idx = i + 1; });
  return jumpTo(Math.min(idx, film.scenes.length - 1));
}
function skipOutro() {
  var film = curFilm(); if (!film) return false;
  var idx = film.scenes.length - 1;
  for (var i = film.scenes.length - 1; i >= 0; i--) { if (film.scenes[i].outro) idx = i; }
  return jumpTo(idx);
}
function play() { var film = curFilm(); if (!film) return false; state.playing = true; startTimer(); render(); return true; }
function pause() { state.playing = false; stopTimer(); render(); return true; }
function finishFilm() {
  var film = curFilm(); if (!film) return null;
  state.playing = false; stopTimer();
  saveProgress(film.id, film.scenes.length - 1, true);
  var t = saveTicket(buildTicket(film.id));
  state.lastTicketId = t.id;
  charWriteNote(film.id);
  pushChat(film.id, 'char', '看完啦。' + t.thought, film.scenes.length - 1);
  state.view = 'ticket'; render();
  return t;
}

/* ── 聊天 + 轻互动 ── */
var QUICK = [
  { k: 'haha', label: '哈哈', me: '哈哈', reply: '哈哈，你笑起来真好看。', flo: '😆' },
  { k: 'moved', label: '感动', me: '有点感动……', reply: '我也是。这段拍得真好。', flo: '🥹' },
  { k: 'popcorn', label: '🍿 递爆米花', me: '（递给你一桶爆米花）', reply: '谢谢，正好看到精彩的地方。', flo: '🍿' },
  { k: 'cola', label: '🥤 递可乐', me: '（递给你一杯可乐）', reply: '冰的！你怎么知道我想喝这个。', flo: '🥤' },
  { k: 'cheers', label: '🥂 碰杯', me: '（举起杯子碰杯）', reply: '碰杯！为这部片，也为你。', flo: '🥂' }
];
function floatEmoji(emoji) {
  try {
    var scr = document.getElementById('cx-screen');
    if (!scr) return false;
    var s = document.createElement('span');
    s.className = 'cx-float'; s.textContent = emoji;
    s.style.left = (20 + Math.floor(Math.random() * 60)) + '%';
    scr.appendChild(s);
    setTimeout(function () { try { s.remove(); } catch (e) {} }, 1600);
    return true;
  } catch (e) { return false; }
}
function danmaku(text) {
  if (!settings().danmaku) return false;
  try {
    var scr = document.getElementById('cx-screen');
    if (!scr) return false;
    var s = document.createElement('span');
    s.className = 'cx-danmaku'; s.textContent = String(text || '');
    s.style.top = (8 + Math.floor(Math.random() * 60)) + '%';
    scr.appendChild(s);
    setTimeout(function () { try { s.remove(); } catch (e) {} }, 5000);
    return true;
  } catch (e) { return false; }
}
function sendChat(text, who) {
  var film = curFilm(); if (!film) return null;
  var t = String(text || '').trim(); if (!t) return null;
  var m = pushChat(film.id, who || 'me', t, state.sceneIdx);
  render();
  if (m) danmaku((who === 'char' ? charName() + '：' : '') + t);
  return m;
}
function interact(kind) {
  var film = curFilm(); if (!film) return null;
  var q = null; QUICK.forEach(function (x) { if (x.k === kind) q = x; });
  if (!q) return null;
  pushChat(film.id, 'me', q.me, state.sceneIdx);
  var r = pushChat(film.id, 'char', q.reply, state.sceneIdx);
  render();
  danmaku(q.me);
  danmaku(charName() + '：' + q.reply);
  floatEmoji(q.flo);
  return { me: q.me, reply: q.reply, msg: r };
}

/* ── 样式（.cx- 前缀，不碰现有样式） ── */
var CX_CSS = '<style>'
+ '.cx-root{position:absolute;inset:0;background:#fffdfb;color:#2b2a28;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:40px;}'
+ '.cx-head{position:sticky;top:0;z-index:5;background:rgba(255,253,251,.94);backdrop-filter:blur(12px);padding:14px 18px 10px;border-bottom:1px solid #f0edea;}'
+ '.cx-back{font-size:14px;color:#8a8580;cursor:pointer;}'
+ '.cx-title{font-size:26px;font-weight:600;margin:6px 0 2px;}'
+ '.cx-sub{font-size:12px;color:#9a958f;line-height:1.6;}'
+ '.cx-note{margin:12px 16px 0;padding:10px 12px;background:#fdf6ec;border:1px solid #f3e3c8;border-radius:14px;font-size:12px;line-height:1.7;color:#8a6d3b;}'
+ '.cx-body{padding:12px 16px 30px;}'
+ '.cx-sec{font-size:13px;font-weight:700;color:#6d4c2f;margin:16px 2px 8px;}'
+ '.cx-sec span{font-weight:400;color:#9a958f;font-size:12px;}'
+ '.cx-card{background:#fff;border:1px solid #f0edea;border-radius:18px;padding:14px 16px;margin-bottom:10px;box-shadow:0 4px 16px rgba(90,75,60,.06);}'
+ '.cx-poster{height:120px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;}'
+ '.cx-poster .ic{font-size:38px;}'
+ '.cx-poster .tt{font-size:16px;font-weight:700;}'
+ '.cx-poster .pl{font-size:11px;opacity:.9;}'
+ '.cx-btn{display:inline-block;background:#33363b;color:#fff;border:none;border-radius:16px;padding:10px 16px;font-size:14px;font-weight:500;cursor:pointer;text-align:center;}'
+ '.cx-btn:active{transform:scale(.97);}'
+ '.cx-ghost{display:inline-block;background:#f4f1ee;color:#55524e;border:1px solid #ece7e2;border-radius:16px;padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;text-align:center;}'
+ '.cx-chip{display:inline-block;background:#f4f1ee;border:1px solid #ece7e2;border-radius:999px;padding:6px 12px;font-size:12px;color:#6d6862;margin:0 6px 6px 0;cursor:pointer;}'
+ '.cx-badge{display:inline-block;background:#fdf0e4;color:#b06a2a;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;}'
+ '.cx-screen{position:relative;border-radius:18px;overflow:hidden;min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:22px 16px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.3);}'
+ '.cx-screen .ic{font-size:52px;}'
+ '.cx-screen .tt{font-size:18px;font-weight:700;text-align:center;}'
+ '.cx-screen .pl{font-size:12px;opacity:.92;}'
+ '.cx-screen .ln{font-size:14px;line-height:1.8;text-align:center;max-width:92%;}'
+ '.cx-screen .ln b{opacity:.85;}'
+ '.cx-prog{height:6px;border-radius:3px;background:rgba(255,255,255,.35);width:100%;margin-top:10px;overflow:hidden;}'
+ '.cx-prog>i{display:block;height:100%;background:#fff;border-radius:3px;}'
+ '.cx-danmaku{position:absolute;left:100%;white-space:nowrap;font-size:14px;font-weight:600;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6);animation:cx-dm 5s linear forwards;pointer-events:none;z-index:3;}'
+ '@keyframes cx-dm{from{transform:translateX(0);}to{transform:translateX(-140vw);}}'
+ '.cx-float{position:absolute;bottom:12px;font-size:34px;animation:cx-fl 1.6s ease-out forwards;pointer-events:none;z-index:4;}'
+ '@keyframes cx-fl{0%{transform:translateY(0) scale(.6);opacity:0;}20%{opacity:1;}100%{transform:translateY(-120px) scale(1.2);opacity:0;}}'
+ '.cx-seat{display:flex;gap:10px;align-items:flex-start;margin:12px 0;}'
+ '.cx-av{width:44px;height:44px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;}'
+ '.cx-bubble{flex:1;background:#fff;border:1px solid #efe9e4;border-radius:16px;border-top-left-radius:4px;padding:10px 12px;font-size:14px;line-height:1.7;}'
+ '.cx-chat{margin-top:6px;}'
+ '.cx-msg{max-width:82%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.6;margin-bottom:8px;word-break:break-word;}'
+ '.cx-msg.me{margin-left:auto;background:#2b2d42;color:#fff;border-bottom-right-radius:5px;}'
+ '.cx-msg.char{background:#fff;border:1px solid #efe9e4;border-bottom-left-radius:5px;}'
+ '.cx-msg.cat{background:#fff7e6;border:1px solid #f3e3c8;border-bottom-left-radius:5px;}'
+ '.cx-ts{color:#b06a2a;text-decoration:underline;cursor:pointer;font-size:12px;}'
+ '.cx-inputrow{display:flex;gap:8px;margin-top:10px;}'
+ '.cx-input{flex:1;box-sizing:border-box;border:1px solid #e9e4df;border-radius:14px;padding:10px 12px;font-size:15px;outline:none;background:#fff;color:#2b2a28;}'
+ '.cx-label{font-size:12px;color:#9a958f;margin:14px 2px 6px;font-weight:500;}'
+ '.cx-ta{width:100%;box-sizing:border-box;border:1px solid #e9e4df;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.7;min-height:64px;outline:none;background:#fff;color:#2b2a28;resize:vertical;}'
+ '.cx-ticket{background:#fff8ec;border:1px dashed #e8c9a0;border-radius:16px;padding:16px;margin-bottom:10px;}'
+ '.cx-ticket h3{margin:0 0 4px;font-size:18px;}'
+ '.cx-ticket .row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px dashed #e5d9c3;}'
+ '.cx-ticket .th{margin-top:10px;font-size:13px;line-height:1.8;background:#fdf6ec;border-radius:10px;padding:9px 11px;}'
+ '.cx-empty{text-align:center;color:#a8a29c;font-size:13px;line-height:2;padding:34px 20px;}'
+ '</style>';

/* ── 渲染 ── */
function seatHTML() {
  var lk = look();
  var cat = petCat();
  var r = reactionFor(state.filmId, state.sceneIdx);
  var h = '<div class="cx-seat"><div class="cx-av" style="background:' + esc(lk.hair) + ';">' + esc(charName().slice(0, 1)) + '</div>'
    + '<div class="cx-bubble">' + (r ? esc(r.text) : '一起看吧。') + '<div style="font-size:11px;color:#9a958f;margin-top:4px;">' + esc(charName()) + ' · 好感「' + (r ? r.tier : tierOf(affValue()).label) + '」' + (cat ? ' · 🐱 ' + esc(cat.name) + ' 也坐在旁边' : '') + '</div></div></div>';
  if (cat) h += '<div class="cx-seat"><div class="cx-av" style="background:#f3c969;">🐱</div><div class="cx-bubble">「' + esc(cat.name) + '」蹲在旁边看，尾巴一下一下地晃，偶尔「喵」一声。</div></div>';
  return h;
}
function renderLib() {
  var h = '<div class="cx-head"><div class="cx-title">影院 · 一起看</div><div class="cx-sub">和 ' + esc(charName()) + ' 一起看短片 · 片是手机里的模拟短片</div></div>'
    + '<div class="cx-note">🎬 本地模拟短片，非真实影片文件：没有真实视频，只有立体书世界场景 + 对白 + 分镜卡（CSS 画的），不连网、不下载影片。</div>'
    + (state.notice ? '<div class="cx-note">' + esc(state.notice) + '</div>' : '')
    + '<div class="cx-note">📡 ' + esc(CinemaServer.status().label) + '</div>'
    + '<div class="cx-body">';
  SERIES.forEach(function (s) {
    if (!FILMS.some(function (f) { return f.series === s.id; })) return; // [AJ] 该系列无片时不留空标题
    h += '<div class="cx-sec">' + esc(s.title) + ' <span>' + esc(s.desc) + '</span></div>';
    FILMS.forEach(function (f) {
      if (f.series !== s.id) return;
      var p = progressFor(f.id);
      var first = f.scenes[0];
      h += '<div class="cx-card"><div class="cx-poster" data-cx="open" data-id="' + f.id + '" style="background:linear-gradient(150deg,' + first.g[0] + ',' + first.g[1] + ');">'
        + '<span class="ic">' + first.ic + '</span><span class="tt">' + esc(f.title) + '</span>'
        + '<span class="pl">' + f.scenes.length + ' 幕 · 约 ' + Math.round(filmTotalSec(f) / 60) + ' 分钟 · ' + esc(f.desc) + '</span></div>'
        + '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">'
        + (p ? (p.finished ? '<span class="cx-badge">已看完</span>' : '<span class="cx-badge">续看：第 ' + (p.sceneIdx + 1) + ' 幕</span>') : '')
        + '<button class="cx-btn" data-cx="open" data-id="' + f.id + '" style="margin-left:auto;">' + (p && !p.finished ? '▶ 续看' : '▶ 开始看') + '</button>'
        + '<button class="cx-ghost" data-cx="notes" data-id="' + f.id + '">📓 手记</button>'
        + '</div></div>';
    });
  });
  if (!FILMS.length) h += '<div class="cx-empty">还没有短片<br><span style="font-size:12px;">内置模拟短片已清空；短片是本机模拟内容，暂无新增入口。</span></div>';
  var tk = tickets();
  h += '<div class="cx-sec">票根 <span>看完的场次都在这里</span></div>';
  if (!tk.length) h += '<div class="cx-empty">还没有票根<br><span style="font-size:12px;">看完一部短片，就会得到一张票根。</span></div>';
  else h += '<button class="cx-ghost" data-cx="tickets">🎟 看全部票根（' + tk.length + ' 张）</button>';
  h += '</div>';
  return h;
}
function renderScreen() {
  var film = curFilm(); if (!film) return renderLib();
  var sc = film.scenes[state.sceneIdx];
  var pct = Math.round(((state.sceneIdx) / film.scenes.length) * 100);
  var msgs = chatFor(film.id);
  var h = '<div class="cx-head"><span class="cx-back" data-cx="lib">‹ 片库</span><div class="cx-title" style="font-size:20px;">' + esc(film.title) + '</div>'
    + '<div class="cx-sub">第 ' + (state.sceneIdx + 1) + ' / ' + film.scenes.length + ' 幕 · ' + esc(sc.place) + ' · 剩余 <span id="cx-remain">' + fmtClock(state.remain) + '</span></div></div>'
    + '<div class="cx-body">'
    + '<div class="cx-screen" id="cx-screen" style="background:linear-gradient(155deg,' + sc.g[0] + ',' + sc.g[1] + ');">'
    + '<span class="ic">' + sc.ic + '</span><span class="tt">' + esc(sc.t) + '</span><span class="pl">' + esc(sc.place) + '</span>'
    + sc.lines.map(function (ln) { return '<div class="ln"><b>' + esc(ln[0]) + '</b> ' + esc(ln[1]) + '</div>'; }).join('')
    + '<div class="cx-prog"><i style="width:' + pct + '%;"></i></div></div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">'
    + '<button class="cx-ghost" data-cx="prev">‹ 上一幕</button>'
    + '<button class="cx-btn" data-cx="playpause">' + (state.playing ? '⏸ 暂停' : '▶ 播放') + '</button>'
    + '<button class="cx-ghost" data-cx="next">下一幕 ›</button>'
    + (sc.intro ? '<button class="cx-ghost" data-cx="skip-intro">跳过片头 »</button>' : '')
    + (sc.outro ? '<button class="cx-ghost" data-cx="skip-outro">跳过片尾 »</button>' : '')
    + '</div>'
    + seatHTML()
    + '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap;">'
    + '<button class="cx-ghost" data-cx="danmaku">' + (settings().danmaku ? '💬 弹幕：开' : '💬 弹幕：关') + '</button>'
    + '<button class="cx-ghost" data-cx="notes" data-id="' + film.id + '">📓 这部片的手记</button>'
    + '<button class="cx-ghost" data-cx="finish">看完领票根</button>'
    + '</div>'
    + '<div class="cx-label">放映室聊天 · 点时间戳跳回那一幕</div>'
    + '<div class="cx-chat">' + (msgs.length ? msgs.slice(-30).map(function (m) {
        var who = m.who === 'me' ? '你' : (m.who === 'cat' ? ('🐱 ' + (petCat() ? petCat().name : '猫')) : charName());
        return '<div class="cx-msg ' + (m.who === 'me' ? 'me' : m.who) + '"><b style="font-size:12px;">' + esc(who) + '</b> <span class="cx-ts" data-cx="jump" data-idx="' + m.sceneIdx + '">' + fmtClock(m.filmTs) + '</span><br>' + esc(m.text) + '</div>';
      }).join('') : '<div class="cx-empty">还没人说话——发一句，或者点下面的快捷消息。</div>') + '</div>'
    + '<div style="margin-top:6px;">' + QUICK.map(function (q) { return '<button class="cx-chip" data-cx="quick" data-k="' + q.k + '">' + esc(q.label) + '</button>'; }).join('') + '</div>'
    + '<div class="cx-inputrow"><input class="cx-input" id="cx-chat-input" placeholder="和 ' + esc(charName()) + ' 聊聊这幕……" maxlength="200"><button class="cx-btn" data-cx="send">发送</button></div>'
    + '</div>';
  return h;
}
function renderNotes() {
  var film = filmById(state.filmId) || FILMS[0];
  if (!film) { state.view = 'lib'; state.notice = '这部短片已不在片库。'; return renderLib(); } // GROUP-CINEMA-OWC：修 B1，空库/旧 filmId 不再读 film.id 抛错
  var n = notesFor(film.id);
  var h = '<div class="cx-head"><span class="cx-back" data-cx="lib">‹ 片库</span><div class="cx-title" style="font-size:20px;">📓 ' + esc(film.title) + ' · 手记</div>'
    + '<div class="cx-sub">每部片一本共享手记，跨场次保留 · 你和 ' + esc(charName()) + ' 都能写</div></div>'
    + '<div class="cx-body">'
    + '<div class="cx-label">人物关系图</div><textarea class="cx-ta" id="cx-n-relations">' + esc(n.relations) + '</textarea>'
    + '<div class="cx-label">剧情时间线</div><textarea class="cx-ta" id="cx-n-timeline">' + esc(n.timeline) + '</textarea>'
    + '<div class="cx-label">疑问解答</div><textarea class="cx-ta" id="cx-n-qa">' + esc(n.qa) + '</textarea>'
    + '<div class="cx-label">随记</div><textarea class="cx-ta" id="cx-n-notes">' + esc(n.notes) + '</textarea>'
    + '<div class="cx-label">char 的记录 <span style="color:#b06a2a;">（模板生成，不是真人写的）</span></div>'
    + '<div class="cx-card" style="white-space:pre-wrap;font-size:14px;line-height:1.8;">' + esc(n.charNote || '（char 还没写）') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="cx-btn" data-cx="notes-save" data-id="' + film.id + '">保存手记</button>'
    + '<button class="cx-ghost" data-cx="notes-char" data-id="' + film.id + '">✍️ 让 char 写一句</button>'
    + '<button class="cx-ghost" data-cx="notes-export" data-id="' + film.id + '">⬇ 导出成文本 (.txt)</button>'
    + '<button class="cx-ghost" data-cx="open" data-id="' + film.id + '">▶ 回放映室</button>'
    + '</div>'
    + (state.notice ? '<div class="cx-note" style="margin:12px 0 0;">' + esc(state.notice) + '</div>' : '')
    + '</div>';
  return h;
}
function renderTickets() {
  var tk = tickets();
  var h = '<div class="cx-head"><span class="cx-back" data-cx="lib">‹ 片库</span><div class="cx-title" style="font-size:20px;">🎟 票根</div>'
    + '<div class="cx-sub">看完的场次 · 可以导出成 HTML 留念，或存入相册</div></div><div class="cx-body">';
  if (!tk.length) h += '<div class="cx-empty">还没有票根<br><span style="font-size:12px;">看完一部短片，就会得到一张票根。</span></div>';
  tk.forEach(function (t) {
    h += '<div class="cx-ticket"><h3>🎬 ' + esc(t.title) + '</h3>'
      + '<div class="row"><span>日期</span><b>' + esc(t.date) + '</b></div>'
      + '<div class="row"><span>一起看的人</span><b>' + esc(t.withWhom) + ' 和你</b></div>'
      + '<div class="row"><span>分镜</span><b>共 ' + t.scenes + ' 幕</b></div>'
      + '<div class="th">char 的一句感想：' + esc(t.thought) + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
      + '<button class="cx-ghost" data-cx="ticket-html" data-id="' + t.id + '">⬇ 导出票根 HTML</button>'
      + '<button class="cx-ghost" data-cx="ticket-album" data-id="' + t.id + '">🖼 存入相册</button>'
      + '</div></div>';
  });
  h += (state.notice ? '<div class="cx-note" style="margin:0;">' + esc(state.notice) + '</div>' : '') + '</div>';
  return h;
}
function renderTicket() {
  var t = null; tickets().forEach(function (x) { if (x.id === state.lastTicketId) t = x; });
  if (!t) return renderTickets();
  var h = '<div class="cx-head"><span class="cx-back" data-cx="lib">‹ 片库</span><div class="cx-title" style="font-size:20px;">🎟 看完啦！</div>'
    + '<div class="cx-sub">这场一起看结束了，票根留给你</div></div><div class="cx-body">'
    + '<div class="cx-ticket"><h3>🎬 ' + esc(t.title) + '</h3>'
    + '<div class="row"><span>日期</span><b>' + esc(t.date) + '</b></div>'
    + '<div class="row"><span>一起看的人</span><b>' + esc(t.withWhom) + ' 和你</b></div>'
    + '<div class="row"><span>分镜</span><b>共 ' + t.scenes + ' 幕</b></div>'
    + '<div class="th">char 的一句感想：' + esc(t.thought) + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
    + '<button class="cx-ghost" data-cx="ticket-html" data-id="' + t.id + '">⬇ 导出票根 HTML</button>'
    + '<button class="cx-ghost" data-cx="ticket-album" data-id="' + t.id + '">🖼 存入相册</button>'
    + '<button class="cx-ghost" data-cx="notes" data-id="' + t.filmId + '">📓 写进手记</button>'
    + '</div></div></div>';
  return h;
}
function render(win) {
  // [GROUP-FIX5] FIX5-F1：render 时序修复——首次创建时窗口尚未进文档，querySelector 找不到，
  // render() 静默返回致 #cx-root 全空。接受可选 win 参数；无参调用仍走 querySelector。
  win = win || document.querySelector('[data-app-sandbox="cinema"]');
  if (!win) return;
  var root = win.querySelector('#cx-root');
  if (!root) return;
  if (state.view === 'screen') root.innerHTML = renderScreen();
  else if (state.view === 'notes') root.innerHTML = renderNotes();
  else if (state.view === 'tickets') root.innerHTML = renderTickets();
  else if (state.view === 'ticket') root.innerHTML = renderTicket();
  else root.innerHTML = renderLib();
}
function readNotesForm(win) {
  var g = function (id) { var el = win.querySelector('#' + id); return el ? el.value : ''; };
  return { relations: g('cx-n-relations'), timeline: g('cx-n-timeline'), qa: g('cx-n-qa'), notes: g('cx-n-notes') };
}
function bind(win) {
  win.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cx]');
    if (!el) return;
    var act = el.getAttribute('data-cx');
    var id = el.getAttribute('data-id');
    if (act === 'lib') { state.view = 'lib'; state.playing = false; stopTimer(); render(); }
    else if (act === 'open') { openFilm(id); }
    else if (act === 'notes') { var nid = id || state.filmId; if (!nid || !filmById(nid)) { state.view = 'lib'; state.notice = '这部短片已不在片库，旧票根还在票根页里。'; } else { state.filmId = nid; state.view = 'notes'; state.notice = ''; } render(); }
    else if (act === 'tickets') { state.view = 'tickets'; state.notice = ''; render(); }
    else if (act === 'prev') { prevScene(); }
    else if (act === 'next') { nextScene(); }
    else if (act === 'playpause') { if (state.playing) pause(); else play(); }
    else if (act === 'skip-intro') { skipIntro(); }
    else if (act === 'skip-outro') { skipOutro(); }
    else if (act === 'finish') { finishFilm(); }
    else if (act === 'danmaku') { setDanmaku(!settings().danmaku); render(); }
    else if (act === 'jump') { jumpTo(Number(el.getAttribute('data-idx')) || 0); }
    else if (act === 'quick') { interact(el.getAttribute('data-k')); }
    else if (act === 'send') {
      var inp = win.querySelector('#cx-chat-input');
      if (inp && inp.value.trim()) { sendChat(inp.value, 'me'); }
    }
    else if (act === 'notes-save') { saveNotes(id, readNotesForm(win)); state.notice = '手记已保存，下次打开还在。'; render(); }
    else if (act === 'notes-char') { charWriteNote(id); state.notice = 'char 写了一句（模板生成）。'; render(); }
    else if (act === 'notes-export') {
      saveNotes(id, readNotesForm(win));
      var ok = downloadFile('一起看手记_' + (filmById(id) ? filmById(id).title : id) + '.txt', notesText(id), 'text/plain;charset=utf-8');
      state.notice = ok ? '手记已导出成 .txt。' : '浏览器没让下载，但手记内容还在本机，可复制。';
      render();
    }
    else if (act === 'ticket-html') {
      var t = null; tickets().forEach(function (x) { if (x.id === id) t = x; });
      if (t) { var ok2 = downloadFile('影院票根_' + t.title + '.html', ticketHTML(t), 'text/html;charset=utf-8'); state.notice = ok2 ? '票根 HTML 已下载。' : '浏览器没让下载，票根还保存在本机。'; }
      render();
    }
    else if (act === 'ticket-album') {
      var ok3 = saveTicketToAlbum(id);
      state.notice = ok3 ? '票根已存入相册，去相册里看看吧。' : '存入相册失败，票根还保存在本机。';
      if (state.view === 'ticket') { state.view = 'tickets'; }
      render();
    }
  });
  win.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'cx-chat-input') {
      if (e.target.value.trim()) sendChat(e.target.value, 'me');
    }
  });
}

/* ── 注册 ── */
var CX = {
  version: MARKER, FILMS: FILMS, SERIES: SERIES,
  keys: { progress: PROG_KEY, notes: NOTES_KEY, chat: CHAT_KEY, tickets: TICKET_KEY, settings: SET_KEY },
  charName: charName, affValue: affValue, tierOf: tierOf, petCat: petCat,
  reactionFor: reactionFor, filmById: filmById, sceneStartSec: sceneStartSec, filmTotalSec: filmTotalSec,
  openFilm: openFilm, jumpTo: jumpTo, nextScene: nextScene, prevScene: prevScene,
  skipIntro: skipIntro, skipOutro: skipOutro, play: play, pause: pause, tick: tick, finishFilm: finishFilm,
  sendChat: sendChat, interact: interact, QUICK: QUICK,
  setDanmaku: setDanmaku, danmakuOn: function () { return settings().danmaku; },
  progressFor: progressFor, notesFor: notesFor, saveNotes: saveNotes, charWriteNote: charWriteNote,
  notesText: notesText, downloadNotes: function (filmId) { return downloadFile('一起看手记_' + filmId + '.txt', notesText(filmId), 'text/plain;charset=utf-8'); },
  tickets: tickets, buildTicket: buildTicket, ticketHTML: ticketHTML, ticketSVG: ticketSVG, saveTicketToAlbum: saveTicketToAlbum,
  chatFor: chatFor, state: function () { return { view: state.view, filmId: state.filmId, sceneIdx: state.sceneIdx, playing: state.playing, remain: state.remain }; },
  server: CinemaServer,
  render: render
};
try { if (typeof AppManager !== 'undefined') AppManager.register('cinema', {
  createApp: function (win) { win.innerHTML = CX_CSS + '<div class="cx-root" id="cx-root"></div>'; bind(win); render(win); },
  resume: function (win) { render(win); },
  pause: function () { state.playing = false; stopTimer(); }
}); } catch (e) {}
window.GroupX = CX;
window.CinemaCore = CX;
})();

