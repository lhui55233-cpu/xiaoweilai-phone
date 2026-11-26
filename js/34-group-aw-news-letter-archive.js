
/* ══════════ GROUP-AW-NEWS-LETTER-ARCHIVE · 论坛报纸 + 信件复古风 + 过往信件档案 + 刑侦人物档案 + 智能体生成档案 ══════════
报纸：只借“报纸搜索图文软件 UI 设计”的版式做法（头版/版面导航/文章列表/
详情元数据/评论框），不抄截图里真实历史报纸的标题、正文、日期，
不复现小红书水印。文章全部取自手机里的真实事件（模拟人生事件、明信片、
旅行记录、论坛热帖），模板写就；模型只润色，不编造。
信件复古风：米白旧纸 + 深墨衬线 + 烫金点缀 + 撕纸边 + 红印章，只换视觉皮，
手撕信封动画与信件内容（cike_album_v1）不动。
档案：按用户自己的 docx（dvCaseArchiveV3）结构重写；闻砚及“临江旧站失踪案”
等内容不作内置预设，想让闻砚进手机时用户自己在角色里创建/导入。 */
(function () {
'use strict';
if (!window.AWGroup) return;
var AW = window.AWGroup;
var NEWS_KEY = 'phone_forum_news_v1', GEN_KEY = 'aw_char_gen_v1', LETTER_STATE_KEY = 'cike_letter_state_v1';
var FORUM_POSTS_KEY = 'phone_forum_posts_v1', FORUM_REPLIES_KEY = 'phone_forum_replies_v1', FORUM_FAV_KEY = 'phone_forum_favs';
var GC_KEY = 'guichao.memories.v1', ALBUM_KEY = 'cike_album_v1';
var esc2 = function (s) { return String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');};
var rd2 = function (k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined)? dflt: v;} catch (e) { return dflt;}};
var wr2 = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true;} catch (e) { return false;}};
var uid2 = function (p) { return p + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);};
var pad2b = function (n) { return (n < 10? '0': '') + n;};
var fmtTime2 = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad2b(d.getMonth() + 1) + '-' + pad2b(d.getDate()) + ' ' + pad2b(d.getHours()) + ':' + pad2b(d.getMinutes());};
var dayStr2 = function (ms) { var d = new Date(ms || Date.now()); return d.getFullYear() + '-' + pad2b(d.getMonth() + 1) + '-' + pad2b(d.getDate());};
var mainName2 = function () { try { if (typeof SystemStore!== 'undefined') { var c = SystemStore.get('character'); if (c) return c;}} catch (e) {} return '机';};
var toast2 = function (m) { try { if (window.WeChatAppEngine && WeChatAppEngine.triggerToast) WeChatAppEngine.triggerToast(m);} catch (e) {}};

/* ════════════════ 一、论坛报纸《此刻日报》 ════════════════ */
function loadNews() { var v = rd2(NEWS_KEY, null); if (v && Array.isArray(v.issues)) return v; return { issues: [], reported: { pc: [], trips: [], posts: []}};}
function saveNews(n) { return wr2(NEWS_KEY, n);}
function newsSectionOf(source) { return { travel: '旅行', first: '初见', milestone: '里程碑', moment: '瞬间', festival: '节日'}[source] || '瞬间';}
function articleFromPostcard(pc) {
return { id: 'na_' + pc.id, title: '「' + pc.place + '」来信：' + pc.event, section: newsSectionOf(pc.source), body: pc.time + '，' + mainName2() + '在' + pc.place + '寄回一张明信片。事件：' + pc.event + '。新见闻：' + pc.discovery + '。' + pc.caption, people: mainName2(), sourceType: 'postcard', refId: pc.id, date: pc.time.slice(0, 10), views: 0};
}
function articleFromTrip(tr) {
var rounds = (tr.rounds || []).length;
var first = rounds? (tr.rounds[0].narrative || ''): '';
return { id: 'na_' + tr.id, title: '远行：' + tr.name, section: '旅行', body: mainName2() + '去了' + tr.name + '。' + (tr.setting? '设定：' + tr.setting + '。': '') + (tr.goal? '目标：' + tr.goal + '。': '') + '一共走了 ' + rounds + ' 轮。' + (first? '出发时：' + first: ''), people: mainName2(), sourceType: 'travel', refId: tr.id, date: dayStr2(tr.createdAt), views: 0};
}
function articleFromPost(p) {
var body = String(p.body || '');
return { id: 'na_post_' + p.id, title: String(p.title || '无标题'), section: '论坛热帖', body: '论坛热帖 · ' + (p.board || '') + ' · 作者 ' + (p.author || '佚名') + '。' + body.slice(0, 140) + (body.length > 140? '……': ''), people: p.author || '', sourceType: 'post', refId: p.id, date: String(p.time || ''), views: p.views || 0};
}
function collectNewsEvents() {
var news = loadNews(); var rep = news.reported || { pc: [], trips: [], posts: []};
var out = [];
AW.listPostcards().forEach(function (pc) { if (rep.pc.indexOf(pc.id) === -1) out.push({ kind: 'postcard', article: articleFromPostcard(pc), refId: pc.id});});
AW.listTravel().forEach(function (tr) { if (rep.trips.indexOf(tr.id) === -1 && (tr.status === 'ended' || (tr.rounds || []).length >= 1)) out.push({ kind: 'trip', article: articleFromTrip(tr), refId: tr.id});});
var posts = rd2(FORUM_POSTS_KEY, []);
(Array.isArray(posts)? posts: []).forEach(function (p) {
var hot = (p.views || 0) >= 800 || (p.replies? p.replies.length: (p.replyCount || 0)) >= 4;
if (hot && rep.posts.indexOf(p.id) === -1) out.push({ kind: 'post', article: articleFromPost(p), refId: p.id});
});
return out;
}
function generateNewspaperIssue() {
var cands = collectNewsEvents();
if (!cands.length) return null;
var news = loadNews();
var arts = cands.map(function (c) { return c.article;});
var issue = { id: uid2('nw'), date: dayStr2(), title: '《此刻日报》', headline: arts[0].title, articles: arts, createdAt: Date.now(), polished: false, polishedBy: ''};
cands.forEach(function (c) { if (c.kind === 'postcard') news.reported.pc.push(c.refId); if (c.kind === 'trip') news.reported.trips.push(c.refId); if (c.kind === 'post') news.reported.posts.push(c.refId);});
news.issues.unshift(issue); saveNews(news); return issue;
}
function publishPostToNews(data) {
if (!data ||!data.title) return null;
var news = loadNews();
var art = { id: 'na_post_' + (data.id || uid2('p')), title: String(data.title), section: '论坛热帖', body: '论坛热帖 · ' + (data.board || '') + ' · 作者 ' + (data.author || '佚名') + '。' + String(data.body || '').slice(0, 140), people: data.author || '', sourceType: 'post', refId: data.id || '', date: String(data.time || dayStr2()), views: data.views || 0};
var today = dayStr2(); var issue = news.issues[0];
if (!issue || issue.date!== today) { issue = { id: uid2('nw'), date: today, title: '《此刻日报》', headline: art.title, articles: [art], createdAt: Date.now(), polished: false, polishedBy: ''}; news.issues.unshift(issue);}
else { if (!issue.articles.some(function (a) { return a.id === art.id;})) issue.articles.push(art);}
if (data.id && news.reported.posts.indexOf(data.id) === -1) news.reported.posts.push(data.id);
saveNews(news); return { issue: issue, article: art};
}
function listNewsIssues() { return loadNews().issues;}
function getNewsIssue(id) { var is = listNewsIssues(); for (var i = 0; i < is.length; i++) if (is[i].id === id) return is[i]; return null;}
function getNewsArticle(issueId, articleId) { var is = getNewsIssue(issueId); if (!is) return null; for (var i = 0; i < is.articles.length; i++) if (is.articles[i].id === articleId) return is.articles[i]; return null;}
function readNewsArticle(issueId, articleId) {
var news = loadNews(); var art = null;
news.issues.forEach(function (is) { if (is.id === issueId) is.articles.forEach(function (a) { if (a.id === articleId) { a.views = (a.views || 0) + 1; art = a;}});});
if (art) saveNews(news); return art;
}
function listArticleComments(articleId) { var v = rd2(FORUM_REPLIES_KEY, {}); var arr = (v && v[articleId]) || []; return Array.isArray(arr)? arr: [];}
function commentNewsArticle(articleId, text) {
text = String(text || '').trim(); if (!text) throw new Error('先写点评论');
var v = rd2(FORUM_REPLIES_KEY, {}); if (!v || typeof v!== 'object') v = {};
var arr = Array.isArray(v[articleId])? v[articleId]: [];
var reply = { floor: arr.length + 1, author: '我', tag: '读者', time: '刚刚', content: text};
arr.push(reply); v[articleId] = arr; wr2(FORUM_REPLIES_KEY, v); return reply;
}
function toggleNewsFav(articleId) {
var favs = rd2(FORUM_FAV_KEY, []); if (!Array.isArray(favs)) favs = [];
var i = favs.indexOf(articleId);
if (i >= 0) favs.splice(i, 1); else favs.push(articleId);
wr2(FORUM_FAV_KEY, favs); return favs.indexOf(articleId)!== -1;
}
function isNewsFav(articleId) { var favs = rd2(FORUM_FAV_KEY, []); return Array.isArray(favs) && favs.indexOf(articleId)!== -1;}
function polishNewsIssue(issueId) {
var issue = getNewsIssue(issueId); if (!issue) return Promise.reject(new Error('找不到这期报纸'));
try {
if (window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('chat') && window.PhoneModel.chatComplete && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('chat')) {
var facts = issue.articles.map(function (a) { return '' + a.title + '：' + a.body;}).join('\n');
return window.PhoneModel.chatComplete([
{ role: 'system', content: '你是报纸编辑。只润色下面每篇文章的文字，不增删事实（时间、地点、人物、事件、新见闻一个字不许改），每篇仍是一段话。直接返回润色后的正文，每篇一行，顺序不变，不要加标题和解释。'},
{ role: 'user', content: facts}
], { feature: 'chat'}).then(function (text) {
var lines = String(text || '').split('\n').map(function (s) { return s.trim();}).filter(function (s) { return!!s;});
if (lines.length === issue.articles.length) {
var news = loadNews();
var model = ''; try { model = (window.PhoneModel.modelName && window.PhoneModel.modelName('chat')) || '';} catch (e) {}
news.issues.forEach(function (is) { if (is.id === issueId) { is.articles.forEach(function (a, i) { a.body = lines[i];}); is.polished = true; is.polishedBy = model;}});
saveNews(news);
return { ok: true, via: 'model', model: model};
}
return { ok: false, via: 'template', reason: '模型返回行数对不上，已保留模板原文'};
}).catch(function () { return { ok: false, via: 'template', reason: '模型调用失败，已保留模板原文'};});
}
} catch (e) {}
return Promise.resolve({ ok: false, via: 'template', reason: '未接模型，保留模板原文'});
}

/* ── 报纸 UI（注入论坛.fm-root；与论坛现有发帖/回帖/收藏同一套键） ── */
function newsOverlayHTML(page, arg, arg2) {
var back = '<button type="button" class="aw-news-back" data-aw-news="back">‹ 返回</button>';
if (page === 'article') {
var art = getNewsArticle(arg, arg2); if (!art) return back + '<div class="aw-news-empty">找不到这篇文章。</div>';
var comments = listArticleComments(art.id);
var wc = art.body.length;
return back + '<div class="aw-news-mast"><div class="aw-news-mastname">《此刻日报》</div><div class="aw-news-mastsub">' + esc2(art.date) + ' · ' + esc2(art.section) + '</div></div>'
+ '<div class="aw-news-article"><h2>' + esc2(art.title) + '</h2>'
+ '<div class="aw-news-meta">日期 ' + esc2(art.date) + ' · 版面 ' + esc2(art.section) + ' · 相关人物 ' + esc2(art.people || '—') + ' · 字数 ' + wc + ' · 阅读 ' + (art.views || 0) + ' 次</div>'
+ '<div class="aw-news-body">' + esc2(art.body) + '</div>'
+ '<div style="margin-top:10px"><button type="button" class="aw-news-btn" data-aw-news="fav" data-id="' + art.id + '">' + (isNewsFav(art.id)? '★ 已收藏': '☆ 收藏') + '</button></div>'
+ '<div class="aw-news-cmt"><b>写评论</b><div style="display:flex;gap:8px;margin-top:8px"><input id="aw-news-cmt-input" type="text" maxlength="300" placeholder="写下你的评论…" style="flex:1"><button type="button" class="aw-news-btn" data-aw-news="comment" data-id="' + art.id + '">发表</button></div>'
+ '<div style="margin-top:10px">' + (comments.length? comments.map(function (c) { return '<div class="aw-news-cmt-row"><b>' + esc2(c.author) + '</b> <span style="color:#a08a7a">' + esc2(c.floor) + '楼 · ' + esc2(c.time) + '</span><br>' + esc2(c.content) + '</div>';}).join(''): '<div class="aw-news-empty">还没有评论。</div>') + '</div></div></div>';
}
if (page === 'issue') {
var is = getNewsIssue(arg); if (!is) return back + '<div class="aw-news-empty">找不到这期报纸。</div>';
return back + '<div class="aw-news-mast"><div class="aw-news-mastname">《此刻日报》</div><div class="aw-news-mastsub">' + esc2(is.date) + ' · 共 ' + is.articles.length + ' 篇' + (is.polished? ' · 已由模型润色': '') + '</div></div>'
+ '<h3 class="aw-news-headline">' + esc2(is.headline) + '</h3>'
+ '<div class="aw-news-list">' + is.articles.map(function (a) { return '<div class="aw-news-row" data-aw-news="article" data-id="' + is.id + '" data-id2="' + a.id + '"><span class="aw-news-sec">' + esc2(a.section) + '</span><b>' + esc2(a.title) + '</b><span class="aw-news-rowmeta">' + esc2(a.date) + ' · 阅读 ' + (a.views || 0) + '</span></div>';}).join('') + '</div>'
+ '<div style="margin-top:10px"><button type="button" class="aw-news-btn ghost" data-aw-news="polish" data-id="' + is.id + '">模型润色本期（可选）</button> <span id="aw-news-polish-out" style="font-size:12px;color:#8a6a52"></span></div>';
}
var issues = listNewsIssues();
var cands = collectNewsEvents().length;
var home = back + '<div class="aw-news-mast"><div class="aw-news-mastname">《此刻日报》</div><div class="aw-news-mastsub">手机里的报纸 · 只登真实发生过的事</div></div>';
if (!issues.length) {
home += '<div class="aw-news-empty">还没有报纸。<br>模拟人生里有值得报道的事时（char 旅行、里程碑、节日、论坛热帖），这里会出一期报纸；没事时不硬出。<br>现在' + (cands? '有 ' + cands + ' 件事可以登报，点下面出一期。': '暂时没有可登报的事——等 char 出门旅行，或去论坛发个热帖。') + '</div>';
} else {
var top = issues[0];
home += '<div class="aw-news-front" data-aw-news="issue" data-id="' + top.id + '"><div class="aw-news-frontdate">' + esc2(top.date) + '</div><h3>' + esc2(top.headline) + '</h3><div class="aw-news-frontmeta">头版 · 共 ' + top.articles.length + ' 篇 · 点击看本期</div></div>'
+ '<div class="aw-news-list">' + issues.slice(1).map(function (x) { return '<div class="aw-news-row" data-aw-news="issue" data-id="' + x.id + '"><span class="aw-news-sec">往期</span><b>' + esc2(x.date) + ' · ' + esc2(x.headline) + '</b></div>';}).join('') + '</div>';
}
home += '<div style="margin-top:12px"><button type="button" class="aw-news-btn" data-aw-news="generate">看看有没有新报</button> <span style="font-size:12px;color:#8a6a52">' + (cands? '有 ' + cands + ' 件新事可登报': '暂无新事') + '</span></div>';
return home;
}
function openNewsOverlay(page, arg, arg2) {
var root = document.querySelector('.fm-root');
var host = root || document.body;
var ov = document.getElementById('aw-news-ov');
if (!ov) { ov = document.createElement('div'); ov.id = 'aw-news-ov'; host.appendChild(ov);}
ov.innerHTML = newsOverlayHTML(page || 'home', arg, arg2);
ov.classList.add('show');
ov._awIssue = (page === 'article')? arg: (ov._awIssue || '');
ov.onclick = function (ev) {
var b = ev.target && ev.target.closest? ev.target.closest('[data-aw-news]'): null; if (!b) return;
var act = b.getAttribute('data-aw-news'); var id = b.getAttribute('data-id') || ''; var id2 = b.getAttribute('data-id2') || '';
if (act === 'back') { ov.classList.remove('show'); return;}
if (act === 'generate') { var is = generateNewspaperIssue(); if (is) { toast2('新一期报纸出了'); openNewsOverlay('issue', is.id);} else { toast2('最近没什么值得报道的事'); openNewsOverlay('home');} return;}
if (act === 'issue') { openNewsOverlay('issue', id); return;}
if (act === 'article') { readNewsArticle(id, id2); openNewsOverlay('article', id, id2); return;}
if (act === 'fav') { var on = toggleNewsFav(id); b.textContent = on? '★ 已收藏': '☆ 收藏'; return;}
if (act === 'comment') { var inp = document.getElementById('aw-news-cmt-input'); try { commentNewsArticle(id, inp? inp.value: ''); openNewsOverlay('article', ov._awIssue || '', id);} catch (e) { toast2(e.message || '评论失败');} return;}
if (act === 'polish') { var out = document.getElementById('aw-news-polish-out'); if (out) out.textContent = '润色中…'; polishNewsIssue(id).then(function (r) { if (out) out.textContent = r.ok? ('已润色（模型' + (r.model? ' · ' + r.model: '') + '）'): ('未改动：' + (r.reason || '')); if (r.ok) openNewsOverlay('issue', id);}); return;}
};
}
function ensureForumNews() {
var root = document.querySelector('.fm-root'); if (!root) return false;
var titlebar = root.querySelector('.fm-titlebar');
if (titlebar &&!document.getElementById('aw-news-btn')) {
var btn = document.createElement('span'); btn.id = 'aw-news-btn';
btn.style.cssText = 'font-size:14px;color:#b08d3e;font-weight:700;cursor:pointer;';
btn.textContent = '📰 报纸' + (collectNewsEvents().length? ' ·新': '');
btn.addEventListener('click', function () { openNewsOverlay('home');});
titlebar.appendChild(btn);
}
var toolbar = root.querySelector('.fm-d-toolbar');
if (toolbar &&!toolbar.querySelector('[data-aw-news-publish]')) {
var pub = document.createElement('div'); pub.className = 'fm-d-toolbtn'; pub.setAttribute('data-aw-news-publish', '1'); pub.textContent = '📰 登报';
pub.addEventListener('click', function () {
var detail = root.querySelector('.fm-detail') || root;
var title = (detail.querySelector('.fm-d-title') || {}).textContent || '';
var body = (detail.querySelector('.fm-d-content') || {}).textContent || '';
var info = (detail.querySelector('.fm-d-info') || {}).textContent || '';
var author = (detail.querySelector('.fm-d-info.author') || {}).textContent || '';
var m = info.match(/浏览\s*(\d+)/);
var r = publishPostToNews({ id: 'fm_' + Date.now().toString(36), title: title.trim(), body: body.trim(), author: author.trim(), time: dayStr2(), views: m? parseInt(m[1], 10): 0});
if (r) { toast2('已登报'); openNewsOverlay('article', r.issue.id, r.article.id);} else toast2('登报失败');
});
toolbar.appendChild(pub);
}
return true;
}

/* ════════════════ 二、信件复古风 + 过往信件档案 ════════════════ */
var RETRO_CSS = [
  '/* GROUP-AW  retro · 只用于信件与报纸，不动微信聊天/此刻/世界书 */',
  '.aw-retro-paper{background-color:#f7f1e5 !important;background-image:repeating-linear-gradient(0deg,transparent 0 26px,rgba(176,141,62,.06) 26px 27px),radial-gradient(ellipse at 20% 10%,rgba(176,141,62,.08),transparent 55%),radial-gradient(ellipse at 85% 90%,rgba(120,90,40,.07),transparent 50%) !important;}',
  '.aw-news-ov,.aw-news-ov *{box-sizing:border-box;}',
  '#aw-news-ov{position:absolute;inset:0;background:#f7f1e5;z-index:40;overflow-y:auto;padding:14px 14px 40px;display:none;font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#2b2620;}',
  '#aw-news-ov.show{display:block;}',
  '.aw-news-back{border:0;background:none;color:#7a4a28;font-size:15px;font-weight:700;cursor:pointer;padding:6px 0;}',
  '.aw-news-mast{text-align:center;border-bottom:2px solid #b08d3e;padding:10px 0 12px;margin-bottom:12px;}',
  '.aw-news-mastname{font-size:26px;font-weight:700;letter-spacing:6px;color:#2b2620;}',
  '.aw-news-mastsub{font-size:11px;letter-spacing:3px;color:#8a6a52;margin-top:4px;}',
  '.aw-news-headline{font-size:19px;line-height:1.5;margin:6px 0 12px;}',
  '.aw-news-front{background:#fffdf7;border:1px solid #e6dcc3;border-radius:4px;padding:16px;cursor:pointer;margin-bottom:10px;}',
  '.aw-news-front h3{font-size:20px;line-height:1.5;margin:6px 0;}',
  '.aw-news-frontdate{font-size:12px;color:#b08d3e;letter-spacing:2px;}',
  '.aw-news-frontmeta{font-size:12px;color:#8a6a52;}',
  '.aw-news-list{display:flex;flex-direction:column;}',
  '.aw-news-row{display:flex;flex-direction:column;gap:2px;padding:12px 4px;border-bottom:1px solid #e6dcc3;cursor:pointer;}',
  '.aw-news-row b{font-size:15px;line-height:1.5;}',
  '.aw-news-sec{font-size:11px;color:#b08d3e;letter-spacing:2px;}',
  '.aw-news-rowmeta{font-size:11px;color:#a08a7a;}',
  '.aw-news-article h2{font-size:20px;line-height:1.5;margin:4px 0 8px;}',
  '.aw-news-meta{font-size:11px;color:#8a6a52;border-top:1px solid #e6dcc3;border-bottom:1px solid #e6dcc3;padding:8px 0;line-height:1.8;}',
  '.aw-news-body{font-size:14.5px;line-height:2;padding:14px 2px;white-space:pre-wrap;}',
  '.aw-news-btn{border:1px solid #b08d3e;background:#b08d3e;color:#fffdf7;font-size:13px;font-weight:700;border-radius:4px;padding:8px 14px;cursor:pointer;}',
  '.aw-news-btn.ghost{background:transparent;color:#b08d3e;}',
  '.aw-news-cmt{margin-top:14px;border-top:1px solid #e6dcc3;padding-top:12px;}',
  '.aw-news-cmt input{border:1px solid #d9c48a;border-radius:4px;padding:8px 10px;font-size:13px;background:#fffdf7;}',
  '.aw-news-cmt-row{padding:8px 0;border-top:1px solid #f0e8da;font-size:13px;line-height:1.7;}',
  '.aw-news-empty{font-size:13px;color:#a08a7a;line-height:1.9;padding:14px 2px;}',
  '/* 信件复古：G 信箱浮层 + 此刻信件箱 + AW 信件浮层 */',
  '.gB-ov,.gB-ov .gB-body,#ck-album,#aw-overlay .aw-letter-view{background-color:#f7f1e5 !important;background-image:repeating-linear-gradient(0deg,transparent 0 26px,rgba(176,141,62,.05) 26px 27px) !important;color:#2b2620 !important;}',
  '.gB-ov .gB-letter-row,.ck-letter-item{background:#fffdf7 !important;border:1px solid #e6dcc3 !important;border-left:3px solid #b08d3e !important;border-radius:4px !important;box-shadow:0 2px 8px rgba(138,109,43,.08) !important;}',
  '.gB-ov .gB-letter-from,.gB-ov .gB-letter-title,.ck-letter-item{font-family:"Songti SC","Noto Serif SC",STSong,serif !important;color:#2b2620 !important;}',
  '.gB-ov .gB-face,.gB-ov .gB-letter,.ck-letter-paper,.ck-letter-slide-body{font-family:"Songti SC","Noto Serif SC",STSong,serif !important;color:#2b2620 !important;background-color:#fffdf7 !important;background-image:repeating-linear-gradient(0deg,transparent 0 25px,rgba(176,141,62,.07) 25px 26px) !important;}',
  '.gB-ov .gB-env-front,.gB-ov .gB-env-back,.ck-letter-envelope{background:linear-gradient(170deg,#f3ead2,#e8dcc0) !important;border:1px solid #d9c48a !important;}',
  '.gB-ov .gB-strip,.ck-letter-seal{border-color:#a34a4e !important;color:#a34a4e !important;}',
  '.gB-ov .gB-btn,.gB-ov .gB-back-list,.ck-letter-new-cta,.aw-letter-btn{border:1px solid #b08d3e !important;background:#b08d3e !important;color:#fffdf7 !important;font-family:"Songti SC","Noto Serif SC",STSong,serif !important;border-radius:4px !important;}',
  '.gB-ov .gB-letter-meta,.ck-letter-date,.ck-letter-header{color:#8a6a52 !important;font-family:"Songti SC","Noto Serif SC",STSong,serif !important;}',
  '.aw-torn{position:relative;}',
  '.aw-torn::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:8px;background:linear-gradient(-45deg,transparent 6px,#f7f1e5 0) 0 0/12px 8px repeat-x,linear-gradient(45deg,transparent 6px,#f7f1e5 0) 6px 0/12px 8px repeat-x;pointer-events:none;}',
  '.aw-seal{display:inline-block;border:2px solid #a34a4e;color:#a34a4e;border-radius:4px;padding:3px 8px;font-size:12px;font-weight:700;letter-spacing:2px;transform:rotate(-8deg);font-family:"Songti SC","Noto Serif SC",STSong,serif;}',
  '.aw-letter-meta{font-size:11px;color:#8a6a52;border-top:1px solid #e6dcc3;border-bottom:1px solid #e6dcc3;padding:8px 0;line-height:1.8;}',
  '@media (prefers-reduced-motion: reduce){ .aw-ca *, .aw-ca *::before, .aw-ca *::after{animation:none !important;transition:none !important;} }'
].join('\n');
function ensureRetroStyle() {
  if (document.getElementById('aw-retro-style')) return;
  var st = document.createElement('style'); st.id = 'aw-retro-style'; st.textContent = RETRO_CSS;
  document.head.appendChild(st);
}

/* ── 过往信件档案（数据就是 cike_album_v1 里的真实信件，不编造不预填） ── */
function loadLetterState() { var v = rd2(LETTER_STATE_KEY, null); if (v && typeof v === 'object') return { read: v.read || {}, starred: v.starred || {}, lastSeenCount: v.lastSeenCount || 0 }; return { read: {}, starred: {}, lastSeenCount: 0 }; }
function saveLetterState(s) { return wr2(LETTER_STATE_KEY, s); }
function letterKey(L) { return String(L.time || '') + '|' + String(L.text || '').slice(0, 20); }
function parseLetterTime(s) { var t = Date.parse(String(s || '').replace(/\//g, '-')); return isNaN(t) ? 0 : t; }
function letterTitleOf(text) { var t = String(text || '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return !!x; }); return t.length ? t[0].slice(0, 24) : '（无标题）'; }
function listPastLetters() {
  var album = rd2(ALBUM_KEY, []); if (!Array.isArray(album)) album = [];
  var st = loadLetterState();
  return album.map(function (L, i) {
    return { index: i, role: L.role || '来信', time: L.time || '', text: String(L.text || ''), title: letterTitleOf(L.text), isWelcome: !!L.isWelcome, key: letterKey(L), read: !!st.read[letterKey(L)], starred: !!st.starred[letterKey(L)], ts: parseLetterTime(L.time) };
  }).sort(function (a, b) { return (b.ts - a.ts) || (a.index - b.index); });
}
function filterPastLetters(opts) {
  opts = opts || {};
  var q = String(opts.q || '').trim(), sender = String(opts.sender || '').trim(), date = String(opts.date || '').trim(), starredOnly = !!opts.starredOnly;
  return listPastLetters().filter(function (L) {
    if (starredOnly && !L.starred) return false;
    if (sender && L.role !== sender) return false;
    if (date && String(L.time || '').indexOf(date) === -1) return false;
    if (q && (L.title + L.text + L.role).indexOf(q) === -1) return false;
    return true;
  });
}
function pastLetterSenders() { var out = []; listPastLetters().forEach(function (L) { if (L.role && out.indexOf(L.role) === -1) out.push(L.role); }); return out; }
function markLetterRead(key) { var st = loadLetterState(); st.read[key] = 1; saveLetterState(st); return true; }
function toggleLetterStar(key) { var st = loadLetterState(); if (st.starred[key]) delete st.starred[key]; else st.starred[key] = 1; saveLetterState(st); return !!st.starred[key]; }
function saveLetterMemory(letterIndex) {
  var album = rd2(ALBUM_KEY, []); var L = album[letterIndex];
  if (!L || !String(L.text || '').trim()) return null;
  var mem = { id: uid2('mem'), title: '信 · ' + (L.role || '来信') + ' · ' + letterTitleOf(L.text), category: 'relationship', content: (L.time || '') + '\n' + String(L.text), created: Date.now(), updated: Date.now() };
  var gc = rd2(GC_KEY, []); if (!Array.isArray(gc)) gc = []; gc.push(mem); wr2(GC_KEY, gc); return mem;
}
function writeLetter(text, role) {
  /* Platen 慢递：信不是即时到。写好的信先进“途中”，次日早上 8 点送达后才进
     信箱（cike_album_v1）。AW_JS3 提供 sendLetterToChar；若第三块未加载，
     退回直接进信箱（不丢信）。 */
  text = String(text || '').trim(); if (!text) throw new Error('先写点什么');
  try {
    if (window.AWGroup && window.AWGroup.sendLetterToChar) return window.AWGroup.sendLetterToChar(text, role || '我');
  } catch (e) {}
  var album = rd2(ALBUM_KEY, []); if (!Array.isArray(album)) album = [];
  var L = { role: role || '我', time: new Date().toLocaleString('zh-CN'), text: text };
  album.unshift(L); wr2(ALBUM_KEY, album); return L;
}
function checkNewLetters() {
  var album = rd2(ALBUM_KEY, []); var n = Array.isArray(album) ? album.length : 0;
  var st = loadLetterState();
  if (n > (st.lastSeenCount || 0) && st.lastSeenCount > 0) {
    st.lastSeenCount = n; saveLetterState(st);
    try { if (window.GroupAS && window.GroupAS.notifyExternal) window.GroupAS.notifyExternal({ kind: 'char', app: 'cike', appName: '此刻', sender: mainName2(), title: '✉️ 新信到了', body: '信箱里多了一封信，去看看吧', targetApp: 'cike', refId: 'letter_' + n }); } catch (e) {}
    return true;
  }
  st.lastSeenCount = n; saveLetterState(st); return false;
}

/* ── 过往信件档案 UI（盖在 G 信箱浮层之上的一层，不动 G 的列表与撕信封） ── */
function pastArchiveHTML(opts) {
  opts = opts || {};
  var list = filterPastLetters(opts);
  var senders = pastLetterSenders();
  var rows = list.length ? list.map(function (L) {
    return '<div class="aw-news-row" data-aw-letter-open="' + L.index + '"><span class="aw-news-sec">' + esc2(L.role) + ' · ' + esc2(L.time || '时间未知') + ' ' + (L.read ? '' : '· 未读') + (L.starred ? ' · ★' : '') + '</span><b>' + esc2(L.title) + '</b><span class="aw-news-rowmeta">' + esc2(String(L.text).replace(/\n/g, ' ').slice(0, 40)) + '……</span></div>';
  }).join('') : '<div class="aw-news-empty">还没有旧信，char 写信后会收在这里。</div>';
  return '<div class="aw-news-mast"><div class="aw-news-mastname">过往信件</div><div class="aw-news-mastsub">档案 · 全部 ' + listPastLetters().length + ' 封 · 只列真实信件</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><input id="aw-la-q" type="text" placeholder="搜关键词…" value="' + esc2(opts.q || '') + '" style="flex:1;min-width:110px">'
    + '<select id="aw-la-sender"><option value="">全部寄件人</option>' + senders.map(function (s) { return '<option value="' + esc2(s) + '"' + (opts.sender === s ? ' selected' : '') + '>' + esc2(s) + '</option>'; }).join('') + '</select>'
    + '<input id="aw-la-date" type="text" placeholder="日期 如 2026-11-26" value="' + esc2(opts.date || '') + '" style="width:130px">'
    + '<button type="button" class="aw-news-btn ghost" data-aw-letter="filter">筛选</button>'
    + '<button type="button" class="aw-news-btn ghost" data-aw-letter="starred">★ 收藏</button></div>'
    + '<div class="aw-news-list">' + rows + '</div>'
    + '<div style="margin-top:12px"><button type="button" class="aw-news-btn ghost" data-aw-letter="write">✉️ 写信</button></div>';
}
function openPastArchive(hostOv) {
  var ov = hostOv || document.querySelector('.gB-ov');
  if (!ov) return false;
  var layer = document.getElementById('aw-letter-archive');
  if (!layer) { layer = document.createElement('div'); layer.id = 'aw-letter-archive'; layer.style.cssText = 'position:absolute;inset:0;background:#f7f1e5;z-index:60;overflow-y:auto;padding:14px 14px 40px;box-sizing:border-box;font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#2b2620;'; ov.appendChild(layer); }
  layer.innerHTML = '<button type="button" class="aw-news-back" data-aw-letter="back">‹ 返回信件列表</button>' + pastArchiveHTML({});
  layer.style.display = 'block';
  layer.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-letter]') : null;
    var row = ev.target && ev.target.closest ? ev.target.closest('[data-aw-letter-open]') : null;
    if (row) {
      var idx = parseInt(row.getAttribute('data-aw-letter-open'), 10);
      var L = listPastLetters().filter(function (x) { return x.index === idx; })[0];
      if (L) markLetterRead(L.key);
      layer.style.display = 'none';
      var grow = ov.querySelector('.gB-letter-row[data-gb-letter="' + idx + '"]');
      if (grow) { grow.click(); return; }
      var crow = document.querySelector('.ck-letter-item[data-hist-idx="' + idx + '"], .ck-letter-item[data-histIdx="' + idx + '"]');
      if (crow) { crow.click(); return; }
      toast2('已标记已读');
      return;
    }
    if (!b) return;
    var act = b.getAttribute('data-aw-letter');
    if (act === 'back') { layer.style.display = 'none'; return; }
    if (act === 'write') { openWriteLetter(layer); return; }
    if (act === 'filter' || act === 'starred') {
      var q = (document.getElementById('aw-la-q') || {}).value || '';
      var sender = (document.getElementById('aw-la-sender') || {}).value || '';
      var date = (document.getElementById('aw-la-date') || {}).value || '';
      layer.innerHTML = '<button type="button" class="aw-news-back" data-aw-letter="back">‹ 返回信件列表</button>' + pastArchiveHTML({ q: q, sender: sender, date: date, starredOnly: act === 'starred' });
      return;
    }
  };
  return true;
}
function openWriteLetter(hostLayer) {
  var host = hostLayer || document.querySelector('.gB-ov') || document.body;
  var layer = document.getElementById('aw-letter-write');
  if (!layer) { layer = document.createElement('div'); layer.id = 'aw-letter-write'; layer.style.cssText = 'position:absolute;inset:0;background:#f7f1e5;z-index:70;overflow-y:auto;padding:14px 14px 40px;box-sizing:border-box;font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#2b2620;'; host.appendChild(layer); }
  layer.innerHTML = '<button type="button" class="aw-news-back" data-aw-letter-write="back">‹ 返回</button>'
    + '<div class="aw-news-mast"><div class="aw-news-mastname">写信</div><div class="aw-news-mastsub">米白旧纸 · 深墨衬线 · 写完存入信箱</div></div>'
    + '<div class="aw-news-article"><label style="font-size:12px;color:#8a6a52">寄件人</label><input id="aw-wl-role" type="text" value="我" style="width:100%;box-sizing:border-box;border:1px solid #d9c48a;border-radius:4px;padding:8px;margin:6px 0 10px;background:#fffdf7">'
    + '<label style="font-size:12px;color:#8a6a52">信的内容</label><textarea id="aw-wl-text" rows="10" placeholder="写给 TA 的话……" style="width:100%;box-sizing:border-box;border:1px solid #d9c48a;border-radius:4px;padding:10px;margin:6px 0;font-family:inherit;font-size:14px;line-height:1.9;background:#fffdf7"></textarea>'
    + '<button type="button" class="aw-news-btn" data-aw-letter-write="save">存入信箱</button> <span id="aw-wl-out" style="font-size:12px;color:#8a6a52"></span></div>';
  layer.style.display = 'block';
  layer.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-letter-write]') : null; if (!b) return;
    var act = b.getAttribute('data-aw-letter-write');
    if (act === 'back') { layer.style.display = 'none'; return; }
    if (act === 'save') {
      try {
        var L = writeLetter((document.getElementById('aw-wl-text') || {}).value || '', (document.getElementById('aw-wl-role') || {}).value || '我');
        var out = document.getElementById('aw-wl-out'); if (out) out.textContent = '信已写好，在路上了——次日早上 8 点送达信箱，送达时会提醒你。';
        toast2('信已存入信箱');
      } catch (e) { toast2(e.message || '保存失败'); }
      return;
    }
  };
}
function ensureLetterRetro() {
  ensureRetroStyle();
  var gb = document.querySelector('.gB-ov');
  if (gb) {
    gb.classList.add('aw-retro-paper');
    var body = gb.querySelector('.gB-body');
    if (body && !body.querySelector('[data-aw-letterbar]')) {
      var bar = document.createElement('div'); bar.setAttribute('data-aw-letterbar', '1');
      bar.style.cssText = 'display:flex;gap:8px;padding:10px 14px 0;';
      bar.innerHTML = '<button type="button" class="aw-news-btn ghost" data-aw-letterbar-btn="archive" style="flex:1">📜 过往信件</button><button type="button" class="aw-news-btn ghost" data-aw-letterbar-btn="write" style="flex:1">✉️ 写信</button>';
      body.insertBefore(bar, body.firstChild);
      bar.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-letterbar-btn]') : null; if (!b) return;
        if (b.getAttribute('data-aw-letterbar-btn') === 'archive') openPastArchive(gb);
        else openWriteLetter(null);
      });
    }
    var stage = gb.querySelector('.gB-stage');
    if (stage && !gb.querySelector('[data-aw-letter-save]')) {
      var faces = gb.querySelectorAll('.gB-face');
      var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.setAttribute('data-aw-letter-save', '1');
      saveBtn.className = 'aw-news-btn ghost'; saveBtn.textContent = '💾 存成归巢记忆'; saveBtn.style.cssText = 'margin:10px 14px;';
      saveBtn.addEventListener('click', function () {
        var text = ''; faces.forEach(function (f) { text += (f.textContent || '') + '\n'; });
        text = text.trim(); if (!text) { toast2('这封信没有正文'); return; }
        var album = rd2(ALBUM_KEY, []);
        var idx = -1; album.forEach(function (L, i) { if (idx === -1 && String(L.text || '').trim() && text.indexOf(String(L.text).trim().slice(0, 12)) !== -1) idx = i; });
        if (idx === -1) idx = 0;
        var mem = saveLetterMemory(idx);
        if (mem) toast2('已存成归巢记忆'); else toast2('保存失败');
      });
      var tip = gb.querySelector('.gB-tear-tip');
      if (tip && tip.parentNode) tip.parentNode.insertBefore(saveBtn, tip.nextSibling);
      else gb.querySelector('.gB-body').appendChild(saveBtn);
    }
  }
  var album = document.getElementById('ck-album');
  if (album) album.classList.add('aw-retro-paper');
}

/* ════════════════ 三、刑侦人物档案（按用户 docx dvCaseArchiveV3 结构重写） ════════════════ */
var CA_CSS = [
  '.aw-ca-wrap{width:100%;overflow:hidden;background:transparent;}',
  '.aw-ca{position:relative;width:560px;height:682px;margin:0 auto;transform-origin:top left;transform:scale(var(--aw-ca-scale,1));font-family:"Songti SC","Noto Serif SC",STSong,serif;color:#303438;background:transparent;isolation:isolate;}',
  '.aw-ca *{box-sizing:border-box;}',
  '.aw-ca button{appearance:none;font-family:inherit;cursor:pointer;}',
  '.aw-ca-backA{position:absolute;left:143px;top:21px;width:391px;height:612px;background:#c6c8c7;transform:rotate(3deg);z-index:1;}',
  '.aw-ca-backB{position:absolute;left:124px;top:35px;width:401px;height:602px;background:#dadbd8;transform:rotate(-2.5deg);z-index:2;}',
  '.aw-ca-backA::after,.aw-ca-backB::after{content:"";position:absolute;inset:13px;border:1px solid rgba(78,85,86,.13);}',
  '.aw-ca-slip{position:absolute;left:37px;top:475px;width:200px;height:144px;background:linear-gradient(140deg,#e9eae7,#d7d9d6);border:1px solid #b9bdbb;transform:rotate(-8deg);z-index:3;padding:13px;color:#4a5153;}',
  '.aw-ca-slipHead{display:flex;justify-content:space-between;padding-bottom:9px;border-bottom:1px solid #b2b7b5;font-size:6px;font-weight:600;letter-spacing:.13em;color:#697173;}',
  '.aw-ca-slipDate{margin-top:12px;font-size:22px;font-style:italic;}',
  '.aw-ca-slipDate small{margin-left:5px;font-size:7px;font-style:normal;color:#818789;}',
  '.aw-ca-slipPlace{margin-top:5px;font-size:10px;letter-spacing:.06em;}',
  '.aw-ca-slipTime{margin-top:6px;font-size:7px;line-height:1.7;color:#7a8182;}',
  '.aw-ca-slipStamp{position:absolute;right:12px;bottom:10px;border:1px solid #a44b4f;color:#a44b4f;padding:3px 6px;font-size:8px;transform:rotate(-10deg);}',
  '.aw-ca-pass{position:absolute;left:22px;top:49px;width:137px;height:181px;z-index:6;transform:rotate(-9deg);background:linear-gradient(145deg,#e5e6e3,#cfd2d0);border:1px solid #aab0ae;color:#40484a;padding:10px;}',
  '.aw-ca-passHole{position:absolute;left:50%;top:5px;width:13px;height:5px;transform:translateX(-50%);border:1px solid #939a9b;border-radius:8px;}',
  '.aw-ca-passTop{margin-top:7px;display:flex;justify-content:space-between;font-size:6px;font-weight:600;letter-spacing:.1em;color:#71797b;}',
  '.aw-ca-passBody{display:flex;gap:8px;margin-top:11px;}',
  '.aw-ca-passPhoto{width:63px;height:82px;flex:none;overflow:hidden;background:#aeb4b4;border:1px solid #9fa5a5;}',
  '.aw-ca-passPhoto img{width:100%;height:100%;object-fit:cover;object-position:center top;filter:grayscale(.7) contrast(1.1);}',
  '.aw-ca-passPhoto .aw-ca-passInit{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;background:#8a7bb8;}',
  '.aw-ca-passInfo{flex:1;min-width:0;padding-top:3px;}',
  '.aw-ca-passInfo b{display:block;font-size:13px;font-weight:600;letter-spacing:.06em;}',
  '.aw-ca-passInfo small{display:block;margin-top:7px;font-size:6px;line-height:1.8;color:#7a8283;}',
  '.aw-ca-passLine{height:1px;background:#b0b5b4;margin-top:9px;}',
  '.aw-ca-passFoot{margin-top:7px;display:flex;align-items:flex-end;justify-content:space-between;}',
  '.aw-ca-passFoot span{font-size:6px;line-height:1.7;letter-spacing:.08em;color:#737b7c;}',
  '.aw-ca-passBarcode{width:48px;height:20px;background:repeating-linear-gradient(90deg,#525b5c 0,#525b5c 1px,transparent 1px,transparent 3px,#525b5c 3px,#525b5c 5px,transparent 5px,transparent 7px);opacity:.8;}',
  '.aw-ca-doc{position:absolute;left:146px;top:39px;width:385px;height:592px;z-index:7;transform:rotate(-.6deg);background:linear-gradient(115deg,#f1f1ee,#e7e8e5 48%,#e4e5e2);color:#33383a;overflow:hidden;}',
  '.aw-ca-doc::before{content:"";position:absolute;inset:14px;border:1px solid rgba(76,84,85,.18);pointer-events:none;}',
  '.aw-ca-docHead{position:absolute;left:25px;right:25px;top:25px;height:62px;border-bottom:1px solid #8e9594;}',
  '.aw-ca-docSmall{font-size:6px;font-weight:600;letter-spacing:.2em;color:#6d7576;}',
  '.aw-ca-docTitle{margin-top:8px;font-size:24px;font-weight:600;letter-spacing:.13em;}',
  '.aw-ca-docTitle i{margin-left:6px;font-size:18px;font-style:italic;color:#848a8b;}',
  '.aw-ca-docNumber{position:absolute;right:0;top:2px;text-align:right;font-size:6.5px;line-height:1.9;letter-spacing:.1em;color:#7c8383;}',
  '.aw-ca-conf{position:absolute;right:22px;top:100px;border:1px solid #a34a4e;color:#a34a4e;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:.14em;transform:rotate(6deg);}',
  '.aw-ca-photo{position:absolute;left:23px;top:112px;width:143px;height:169px;overflow:hidden;background:#aeb4b4;}',
  '.aw-ca-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top;filter:grayscale(.48) contrast(1.08);}',
  '.aw-ca-photo .aw-ca-photoInit{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:64px;color:#fff;background:#8a7bb8;}',
  '.aw-ca-photoFrame{position:absolute;left:19px;top:108px;width:151px;height:177px;border:1px solid #858e8e;pointer-events:none;}',
  '.aw-ca-photoFrame::before,.aw-ca-photoFrame::after{content:"";position:absolute;width:17px;height:17px;border-color:#646d6e;border-style:solid;}',
  '.aw-ca-photoFrame::before{left:-2px;top:-2px;border-width:2px 0 0 2px;}',
  '.aw-ca-photoFrame::after{right:-2px;bottom:-2px;border-width:0 2px 2px 0;}',
  '.aw-ca-photoId{position:absolute;left:27px;top:270px;color:#e6e9e7;font-size:6px;letter-spacing:.12em;}',
  '.aw-ca-mag{position:absolute;left:136px;top:246px;width:39px;height:39px;border:0;padding:0;background:transparent;z-index:12;}',
  '.aw-ca-mag svg{width:100%;height:100%;}',
  '.aw-ca-person{position:absolute;left:185px;top:136px;width:174px;}',
  '.aw-ca-personNo{font-size:6px;font-weight:600;letter-spacing:.17em;color:#7c8484;}',
  '.aw-ca-personName{margin-top:7px;font-size:24px;font-weight:600;letter-spacing:.12em;}',
  '.aw-ca-personRule{height:1px;background:#a9afae;margin:8px 0;}',
  '.aw-ca-personRow{display:flex;gap:6px;margin-top:7px;font-size:8.3px;color:#505758;}',
  '.aw-ca-personRow b{width:44px;flex:none;font-size:6.3px;font-weight:600;letter-spacing:.09em;color:#888f90;}',
  '.aw-ca-redCircle{position:absolute;left:184px;top:185px;width:137px;height:42px;transform:rotate(-8deg);pointer-events:none;}',
  '.aw-ca-redCircle svg{width:100%;height:100%;}',
  '.aw-ca-case{position:absolute;left:24px;right:24px;top:306px;padding-top:11px;border-top:1px solid #a9aeac;}',
  '.aw-ca-case::before{content:"";position:absolute;left:0;top:-2px;width:31px;height:3px;background:#a34a4c;}',
  '.aw-ca-caseLabel{font-size:6px;font-weight:600;letter-spacing:.16em;color:#767e7e;}',
  '.aw-ca-caseText{margin-top:8px;font-size:8px;line-height:1.85;color:#505859;}',
  '.aw-ca-caseText strong{color:#98474a;font-weight:600;}',
  '.aw-ca-evTitle{position:absolute;left:24px;top:378px;font-size:7px;font-weight:600;letter-spacing:.18em;color:#687172;}',
  '.aw-ca-evTabs{position:absolute;left:24px;right:24px;top:396px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;}',
  '.aw-ca-evTab{position:relative;height:29px;padding:0;border:1px solid #b3b9b6;background:rgba(255,255,255,.1);font-size:8px;color:#666f70;text-align:center;}',
  '.aw-ca-evTab span{margin-right:5px;font-size:7px;font-weight:600;color:#919797;}',
  '.aw-ca-evTab.active{color:#9d474a;border-color:#aa6062;}',
  '.aw-ca-evTab.active::after{content:"";position:absolute;left:12px;right:12px;bottom:-2px;height:2px;background:#a34a4c;}',
  '.aw-ca-record{position:absolute;left:24px;top:441px;width:235px;}',
  '.aw-ca-recordLabel{font-size:6px;font-weight:600;letter-spacing:.13em;color:#858c8c;}',
  '.aw-ca-recordText{margin-top:8px;font-size:8px;line-height:1.85;white-space:pre-line;color:#454d4e;}',
  '.aw-ca-recordEn{margin-top:8px;font-size:12px;font-style:italic;color:#a44c4e;}',
  '.aw-ca-fp{position:absolute;right:25px;top:447px;width:72px;height:85px;}',
  '.aw-ca-fp svg{width:100%;height:100%;}',
  '.aw-ca-docBottom{position:absolute;left:24px;right:24px;bottom:19px;border-top:1px solid #aeb3b1;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;}',
  '.aw-ca-sign{font-size:6px;line-height:1.8;letter-spacing:.1em;color:#757d7d;}',
  '.aw-ca-sign em{font-size:17px;font-style:italic;color:#a24e51;}',
  '.aw-ca-next{display:flex;align-items:center;gap:6px;border:0;padding:6px 0;background:transparent;color:#94464a;font-size:8px;}',
  '.aw-ca-stamp{position:absolute;right:18px;top:530px;width:92px;height:48px;transform:rotate(-9deg);opacity:.7;pointer-events:none;}',
  '.aw-ca-string{position:absolute;inset:0;z-index:12;pointer-events:none;}',
  '.aw-ca-string svg{display:block;width:100%;height:100%;}',
  '.aw-ca-env{position:absolute;left:13px;top:237px;width:155px;height:232px;transform:rotate(11deg);z-index:10;}',
  '.aw-ca-envBack{position:absolute;inset:0;background:#cbd0cd;border:1px solid #a6adab;}',
  '.aw-ca-envFront{position:absolute;left:0;right:0;bottom:0;height:176px;background:linear-gradient(145deg,#e3e5e1,#c9cdca);border:1px solid #b0b5b2;}',
  '.aw-ca-envFlap{position:absolute;left:0;top:0;width:100%;height:84px;background:#e6e8e4;clip-path:polygon(0 0,100% 0,50% 83%);}',
  '.aw-ca-envTitle{position:absolute;left:14px;top:126px;font-size:12px;font-weight:600;letter-spacing:.14em;color:#464d4d;}',
  '.aw-ca-envSub{position:absolute;left:14px;top:148px;font-size:6px;line-height:1.8;letter-spacing:.11em;color:#777e7e;}',
  '.aw-ca-envNo{position:absolute;left:14px;bottom:16px;font-size:8px;color:#697172;}',
  '.aw-ca-envSeal{position:absolute;right:10px;bottom:13px;width:34px;height:34px;transform:rotate(-11deg);opacity:.76;}',
  '.aw-ca-pageTwo{position:absolute;inset:0;padding:29px 27px;background:linear-gradient(115deg,#f0f0ed,#e1e3df);opacity:0;visibility:hidden;pointer-events:none;z-index:25;transition:opacity .55s,visibility .55s;}',
  '.aw-ca.page-two .aw-ca-pageTwo{opacity:1;visibility:visible;pointer-events:auto;}',
  '.aw-ca-p2Head{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid #aab0ad;}',
  '.aw-ca-p2Head b{font-size:19px;font-weight:600;letter-spacing:.15em;}',
  '.aw-ca-p2Head span{font-size:6px;font-weight:600;letter-spacing:.1em;color:#858d8d;}',
  '.aw-ca-p2Info{margin-top:20px;font-size:9px;line-height:2.05;color:#535b5b;}',
  '.aw-ca-statement{margin-top:22px;padding:14px;border-left:2px solid #a34a4c;background:rgba(255,255,255,.14);font-size:10px;line-height:2.1;white-space:pre-line;color:#42494a;}',
  '.aw-ca-p2Lines{margin-top:17px;height:130px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 25px,rgba(92,101,104,.23) 26px,transparent 27px);}',
  '.aw-ca-p2Foot{position:absolute;left:27px;right:27px;bottom:26px;padding-top:11px;border-top:1px solid #aab0ae;display:flex;justify-content:space-between;align-items:center;}',
  '.aw-ca-p2Foot span{font-size:6px;letter-spacing:.14em;color:#858b8c;}',
  '.aw-ca-return{border:0;background:transparent;color:#95474a;font-size:9px;}',
  '.aw-ca-zoom{position:absolute;left:173px;top:109px;width:262px;height:283px;z-index:30;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .45s,visibility .45s;}',
  '.aw-ca.zoom-open .aw-ca-zoom{opacity:1;visibility:visible;pointer-events:auto;}',
  '.aw-ca-zoomPhoto{position:absolute;inset:8px 9px 22px;overflow:hidden;background:#b9bfbd;clip-path:polygon(0 0,100% 0,100% 92%,91% 100%,0 100%);}',
  '.aw-ca-zoomPhoto img{width:100%;height:100%;object-fit:cover;object-position:center top;filter:grayscale(.35);transform:scale(1.35);}',
  '.aw-ca-zoomPhoto .aw-ca-photoInit{transform:scale(1.35);font-size:120px;}',
  '.aw-ca-zoomClose{position:absolute;right:14px;top:12px;width:24px;height:24px;border:1px solid #838b8a;background:rgba(233,234,230,.86);color:#3b4344;font-size:16px;z-index:2;}',
  '.aw-ca-zoomLabel{position:absolute;left:14px;bottom:3px;font-size:6px;font-weight:600;letter-spacing:.12em;color:#535d5e;}',
  '.aw-ca .aw-ca-backA,.aw-ca .aw-ca-backB,.aw-ca .aw-ca-pass,.aw-ca .aw-ca-doc,.aw-ca .aw-ca-env,.aw-ca .aw-ca-slip,.aw-ca .aw-ca-string{opacity:0;}',
  '.aw-ca .aw-ca-mag,.aw-ca .aw-ca-redCircle,.aw-ca .aw-ca-fp,.aw-ca .aw-ca-stamp,.aw-ca .aw-ca-conf{opacity:0;}',
  '.aw-ca.aw-ca-visible .aw-ca-backA{animation:awCaBackA 1.2s .05s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-backB{animation:awCaBackB 1.2s .15s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-slip{animation:awCaSlip 1.2s .3s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-pass{animation:awCaPass 1.2s .45s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-doc{animation:awCaDoc 1.2s .6s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-env{animation:awCaEnv 1.2s .75s cubic-bezier(.16,1,.3,1) both;}',
  '.aw-ca.aw-ca-visible .aw-ca-docHead,.aw-ca.aw-ca-visible .aw-ca-photo,.aw-ca.aw-ca-visible .aw-ca-person,.aw-ca.aw-ca-visible .aw-ca-case,.aw-ca.aw-ca-visible .aw-ca-evTabs,.aw-ca.aw-ca-visible .aw-ca-record,.aw-ca.aw-ca-visible .aw-ca-docBottom{animation:awCaInner 1s .9s ease both;}',
  '.aw-ca.aw-ca-visible .aw-ca-conf,.aw-ca.aw-ca-visible .aw-ca-mag,.aw-ca.aw-ca-visible .aw-ca-redCircle,.aw-ca.aw-ca-visible .aw-ca-fp,.aw-ca.aw-ca-visible .aw-ca-stamp,.aw-ca.aw-ca-visible .aw-ca-string{animation:awCaFade 1s 1.2s ease both;}',
  '@keyframes awCaBackA{from{opacity:0;transform:translateY(32px) rotate(7deg)}to{opacity:1;transform:translateY(0) rotate(3deg)}}',
  '@keyframes awCaBackB{from{opacity:0;transform:translate(-15px,30px) rotate(-7deg)}to{opacity:1;transform:translate(0,0) rotate(-2.5deg)}}',
  '@keyframes awCaSlip{from{opacity:0;transform:translate(-34px,35px) rotate(-16deg)}to{opacity:1;transform:translate(0,0) rotate(-8deg)}}',
  '@keyframes awCaPass{from{opacity:0;transform:translate(-25px,-30px) rotate(-19deg)}to{opacity:1;transform:translate(0,0) rotate(-9deg)}}',
  '@keyframes awCaDoc{from{opacity:0;transform:translate(26px,30px) rotate(5deg)}to{opacity:1;transform:translate(0,0) rotate(-.6deg)}}',
  '@keyframes awCaEnv{from{opacity:0;transform:translate(-35px,25px) rotate(0)}to{opacity:1;transform:translate(0,0) rotate(11deg)}}',
  '@keyframes awCaFade{from{opacity:0}to{opacity:1}}',
  '@keyframes awCaInner{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:blur(0)}}',
  '@media (prefers-reduced-motion: reduce){ .aw-ca *, .aw-ca *::before, .aw-ca *::after{animation:none !important;transition:none !important;} .aw-ca .aw-ca-backA,.aw-ca .aw-ca-backB,.aw-ca .aw-ca-pass,.aw-ca .aw-ca-doc,.aw-ca .aw-ca-env,.aw-ca .aw-ca-slip,.aw-ca .aw-ca-string,.aw-ca .aw-ca-mag,.aw-ca .aw-ca-redCircle,.aw-ca .aw-ca-fp,.aw-ca .aw-ca-stamp,.aw-ca .aw-ca-conf{opacity:1 !important;} }',
  '.aw-ca-ov{position:absolute;inset:0;background:#ececea;z-index:80;overflow-y:auto;padding:10px 10px 40px;box-sizing:border-box;}',
  '.aw-ca-ovbar{display:flex;gap:8px;align-items:center;margin-bottom:6px;}',
  '.aw-ca-ovbar button{border:1px solid #b08d3e;background:#fffdf7;color:#7a4a28;font-size:13px;font-weight:700;border-radius:4px;padding:7px 12px;cursor:pointer;}',
  '.aw-lib-row{display:flex;justify-content:space-between;align-items:center;background:#fffdf7;border:1px solid #e6dcc3;border-left:3px solid #b08d3e;border-radius:4px;padding:12px;margin-bottom:8px;}',
  '.aw-lib-row b{font-family:"Songti SC","Noto Serif SC",STSong,serif;font-size:15px;}'
].join('\n');
function ensureCaStyle() {
  if (document.getElementById('aw-ca-style')) return;
  var st = document.createElement('style'); st.id = 'aw-ca-style'; st.textContent = CA_CSS;
  document.head.appendChild(st);
}
var CA_FINGERPRINT = '<svg viewBox="0 0 72 85" aria-hidden="true"><rect x="3" y="4" width="66" height="73" fill="none" stroke="#a5adab" stroke-width=".55"/><g fill="none" stroke="#566061" stroke-width=".44" stroke-linecap="round"><path d="M13 59C10 46 12 32 18 24C25 14 38 11 49 16C60 21 65 33 62 46C60 58 57 66 55 73"/><path d="M16 60C13 47 15 33 21 26C27 17 39 15 48 19C58 23 62 34 59 47C57 59 54 67 52 74"/><path d="M19 61C17 48 18 34 24 28C30 21 39 18 47 22C55 26 59 36 56 48C54 59 51 68 49 74"/><path d="M22 62C20 49 22 36 27 30C32 24 40 22 46 25C53 29 56 37 53 49C51 60 48 68 46 75"/><path d="M25 63C24 50 25 37 30 33C34 27 40 25 45 29C51 32 52 39 50 50C48 60 45 69 43 75"/><path d="M28 64C27 51 29 39 33 35C36 31 41 29 45 33C49 36 50 41 47 51C45 61 42 70 40 75"/><path d="M31 65C31 52 32 41 36 38C39 35 42 34 45 37C47 40 46 45 44 53C42 62 40 70 37 76"/><path d="M34 66C35 54 35 43 39 41C41 39 44 41 43 45C42 51 40 58 38 66L35 76"/><path d="M11 48C10 35 15 23 24 17C32 11 44 10 53 17"/><path d="M9 39C11 27 17 19 27 14"/><path d="M55 19C63 25 67 36 65 47"/><path d="M22 18C29 12 38 10 46 12"/></g><g fill="none" stroke="#a34a4c" stroke-width=".38" opacity=".65"><path d="M39 30V36M39 44V50M29 40H35M43 40H49"/><circle cx="39" cy="40" r="3"/></g></svg>';
var CA_REDCIRCLE = '<svg viewBox="0 0 137 42" aria-hidden="true"><path d="M6 23C12 7 49 3 81 5C115 7 133 14 130 26C127 39 92 41 56 38C24 36 4 30 6 23Z" fill="none" stroke="#a64a4d" stroke-width="1.4" stroke-linecap="round"/><path d="M10 22C19 10 49 7 78 8C108 9 125 17 126 27" fill="none" stroke="#a64a4d" stroke-opacity=".48" stroke-width=".6"/><path d="M125 29L135 35" stroke="#a64a4d" stroke-width="1.1"/></svg>';
var CA_THREAD = '<svg viewBox="0 0 560 682" aria-hidden="true"><path d="M125 265L199 112L415 139L501 269" fill="none" stroke="#a64d51" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M126 263L200 110L416 137L502 267" fill="none" stroke="#dfaaa7" stroke-width=".35" opacity=".65"/><g fill="#a3474b" stroke="#793136" stroke-width=".65"><circle cx="125" cy="265" r="6"/><circle cx="199" cy="112" r="6"/><circle cx="415" cy="139" r="6"/><circle cx="501" cy="269" r="6"/></g></svg>';
var CA_MAGNIFY = '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="25" cy="24" r="19" fill="rgba(233,236,235,.17)" stroke="#90999c" stroke-width="5"/><circle cx="25" cy="24" r="15.5" fill="rgba(255,255,255,.08)" stroke="#525b5e" stroke-width=".9"/><path d="M37 38L43 44L46 41L40 35Z" fill="#687174" stroke="#d7dedd" stroke-width=".7"/><path d="M43 42L56 55Q58 58 55 59Q53 60 51 58L39 46Z" fill="#90999c" stroke="#535b5e" stroke-width=".8"/><g stroke="#a64b4d" stroke-width=".65" opacity=".85"><path d="M25 17V31M18 24H32"/></g><circle cx="25" cy="24" r="2.6" fill="none" stroke="#a64b4d" stroke-width=".7"/></svg>';
function mainCharObj() {
  var name = mainName2();
  var aff = 0; try { aff = AW.affectionValue ? AW.affectionValue() : 0; } catch (e) {}
  var tier = ''; try { tier = AW.tierOf ? AW.tierOf(aff).label : ''; } catch (e) {}
  return { id: 'main', name: name, nickname: '', gender: '', age: '', occupation: '', relationship: '与你的关系：好感「' + tier + '」', birthday: '', notes: '', traits: '', background: '', speechStyle: '', likes: '', dislikes: '', habits: '', rules: '', greeting: '', examples: [], avatar: '', avatarSvg: '', source: 'main', status: 'active', enabled: true, createdAt: Date.now(), isMain: true };
}
function allArchiveChars() { return [mainCharObj()].concat(AW.listChars()); }
function archiveNo(ch, list) {
  list = list || allArchiveChars();
  var idx = 0; list.forEach(function (x, i) { if (x.id === ch.id) idx = i; });
  var suf = String(ch.id || 'x').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'XXXX';
  return { no: String(idx + 1).padStart(2, '0'), file: 'AW-' + String(idx + 1).padStart(2, '0') + '-' + suf };
}
function charPhotoHTML(ch, cls) {
  if (ch.avatar) return '<img src="' + esc2(ch.avatar) + '" alt="' + esc2(ch.name) + '">';
  if (ch.avatarSvg) return ch.avatarSvg;
  return '<div class="' + cls + '">' + esc2((ch.name || '?').charAt(0)) + '</div>';
}
function charSessionInfo(ch) {
  try {
    var store = null;
    if (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) store = AppRegistry['wechat'].wxStore;
    if (!store) return null;
    var sess = null; (store.sessions || []).forEach(function (s) { if (!sess && s.name === ch.name && !s.isGroup) sess = s; });
    if (!sess) return null;
    var msgs = sess.messages || [];
    return { sessionId: sess.id, firstMsg: msgs.length ? (msgs[0].content || '') : '', lastTime: sess.lastTime || '', count: msgs.length };
  } catch (e) { return null; }
}
function archiveTabs(ch) {
  var bio = [ch.background || '', ch.traits ? '性格：' + ch.traits : ''].filter(function (s) { return !!s; }).join('\n');
  var rel = [ch.relationship ? '与你的关系：' + ch.relationship : '', ch.likes ? '喜欢：' + ch.likes : '', ch.dislikes ? '讨厌：' + ch.dislikes : '', ch.habits ? '习惯：' + ch.habits : ''].filter(function (s) { return !!s; }).join('\n');
  var si = charSessionInfo(ch);
  var evLines = [];
  if (si && si.firstMsg) evLines.push('初遇：' + si.firstMsg);
  (ch.examples || []).forEach(function (ex) { evLines.push('问：' + ex.q + ' 答：' + ex.a); });
  if (ch.greeting) evLines.push('开场白：' + ch.greeting);
  return [
    { label: '人物小传', en: 'BIOGRAPHY', text: bio || '暂无记录', note: '人设与背景，取自人物档案本身。' },
    { label: '关系', en: 'RELATIONS', text: rel || '暂无记录', note: '与你的关系、喜好与习惯。' },
    { label: '关键事件', en: 'KEY EVENTS', text: evLines.length ? evLines.join('\n') : '暂无记录', note: '初遇与示例对话，只取真实互动历史，没有就不写。' }
  ];
}
function archivePageTwo(ch) {
  var si = charSessionInfo(ch);
  var cur = null; try { cur = AW.currentActivity ? AW.currentActivity() : null; } catch (e) {}
  var place = ch.isMain && cur ? cur.place : '微信';
  var time = ch.isMain && cur ? cur.at : (si && si.lastTime ? si.lastTime : fmtTime2(ch.createdAt || Date.now()));
  var lines = [];
  if (si && si.firstMsg) lines.push('初遇记录：' + si.firstMsg);
  (ch.examples || []).slice(0, 3).forEach(function (ex) { lines.push('问：' + ex.q + '\n答：' + ex.a); });
  return {
    place: place, time: time, status: ch.status === 'pending' ? '待进一步核实' : '已建档',
    statement: lines.length ? lines.join('\n') : '暂无记录'
  };
}
function archiveHTML(ch) {
  var list = allArchiveChars();
  var an = archiveNo(ch, list);
  var tabs = archiveTabs(ch);
  var p2 = archivePageTwo(ch);
  var statusLabel = ch.status === 'pending' ? '待核查' : (ch.isMain ? '主角档案' : '已建档');
  var cur = null; try { cur = AW.currentActivity ? AW.currentActivity() : null; } catch (e) {}
  var slipPlace = ch.isMain && cur ? cur.place : '微信 · 聊天';
  var slipDate = fmtTime2(Date.now()).slice(5, 10);
  var slipTime = ch.isMain && cur ? (cur.at.slice(11) + ' 出现于' + cur.place + '<br>最近一次出现：' + cur.at) : ('最近出现：微信聊天<br>建档时间：' + fmtTime2(ch.createdAt || Date.now()));
  var rows = [
    ['AGE', ch.age ? ch.age + ' 岁' : '—'],
    ['OCCUP.', ch.occupation || '—'],
    ['STATUS', statusLabel],
    ['REL.', ch.relationship || '—'],
    ['FILE', an.file + ' / B']
  ];
  var caseText = ch.isMain
    ? '与你的关系：好感「' + (AW.tierOf ? AW.tierOf(AW.affectionValue ? AW.affectionValue() : 0).label : '') + '」。档案与模拟人生、剧本共用同一份数据。'
    : '与你的关系：' + (ch.relationship || '—') + '。' + (ch.traits ? '性格：' + ch.traits + '。' : '') + '档案与微信创建人物、剧本选人共用同一份数据，改一处两处都变。';
  return '<div class="aw-ca" data-aw-ca-id="' + esc2(ch.id) + '">'
    + '<div class="aw-ca-backA"></div><div class="aw-ca-backB"></div>'
    + '<div class="aw-ca-slip"><div class="aw-ca-slipHead"><span>LOCATION CHECK</span><span>04 / 07</span></div><div class="aw-ca-slipDate">' + esc2(slipDate) + ' <small>' + new Date().getFullYear() + '</small></div><div class="aw-ca-slipPlace">' + esc2(slipPlace) + '</div><div class="aw-ca-slipTime">' + slipTime + '</div><div class="aw-ca-slipStamp">待核实</div></div>'
    + '<div class="aw-ca-pass"><div class="aw-ca-passHole"></div><div class="aw-ca-passTop"><span>ACCESS / ' + esc2(an.no) + '</span><span>IDENTITY CARD</span></div><div class="aw-ca-passBody"><div class="aw-ca-passPhoto">' + charPhotoHTML(ch, 'aw-ca-passInit') + '</div><div class="aw-ca-passInfo"><b>' + esc2(ch.name) + '</b><small>ID / ' + esc2(an.file) + '<br>ARCHIVED</small></div></div><div class="aw-ca-passLine"></div><div class="aw-ca-passFoot"><span>RESTRICTED<br>DOCUMENT</span><div class="aw-ca-passBarcode"></div></div></div>'
    + '<div class="aw-ca-doc"><div class="aw-ca-docHead"><div class="aw-ca-docSmall">CRIMINAL INVESTIGATION / CASE RECORD</div><div class="aw-ca-docTitle">涉案人员档案 <i>No.' + esc2(an.no) + '</i></div><div class="aw-ca-docNumber">FILE / ' + esc2(an.file) + '<br>INTERNAL COPY</div></div>'
    + '<div class="aw-ca-conf">CONFIDENTIAL</div>'
    + '<div class="aw-ca-photo">' + charPhotoHTML(ch, 'aw-ca-photoInit') + '</div><div class="aw-ca-photoFrame"></div><div class="aw-ca-photoId">PHOTO / SUBJECT ' + esc2(an.no) + '</div>'
    + '<button class="aw-ca-mag" type="button" data-aw-ca="zoom" aria-label="放大观察人物照片">' + CA_MAGNIFY + '</button>'
    + '<div class="aw-ca-person"><div class="aw-ca-personNo">SUBJECT / ' + esc2(an.no) + ' · IDENTIFICATION</div><div class="aw-ca-personName">' + esc2(ch.name) + '</div><div class="aw-ca-personRule"></div>'
    + rows.map(function (r) { return '<div class="aw-ca-personRow"><b>' + r[0] + '</b>' + esc2(r[1]) + '</div>'; }).join('') + '</div>'
    + '<div class="aw-ca-redCircle">' + CA_REDCIRCLE + '</div>'
    + '<div class="aw-ca-case"><div class="aw-ca-caseLabel">CASE ASSOCIATION / 关联记录</div><div class="aw-ca-caseText">' + esc2(caseText) + '</div></div>'
    + '<div class="aw-ca-evTitle">EVIDENCE INDEX / 证据核查</div><div class="aw-ca-evTabs">'
    + tabs.map(function (t, i) { return '<button class="aw-ca-evTab' + (i === 0 ? ' active' : '') + '" type="button" data-aw-ca-tab="' + i + '"><span>0' + (i + 1) + '</span>' + esc2(t.label) + '</button>'; }).join('') + '</div>'
    + '<div class="aw-ca-record"><div class="aw-ca-recordLabel">INVESTIGATION NOTE / 01</div><div class="aw-ca-recordText">' + esc2(tabs[0].text) + '</div><div class="aw-ca-recordEn">“' + esc2(tabs[0].en) + '.”</div></div>'
    + '<div class="aw-ca-fp">' + CA_FINGERPRINT + '<div style="text-align:center;font-size:5px;letter-spacing:.08em;color:#858c8c">FINGERPRINT / SAMPLE 02</div></div>'
    + '<div class="aw-ca-docBottom"><div class="aw-ca-sign">REVIEWED BY / INVESTIGATION UNIT<br><em>Pending verification.</em></div><button class="aw-ca-next" type="button" data-aw-ca="next">翻阅记录 <svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 10H16M11 5L16 10L11 15" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button></div>'
    + '<div class="aw-ca-stamp"><svg viewBox="0 0 92 48" aria-hidden="true"><rect x="2" y="3" width="88" height="42" fill="none" stroke="#a44b4d" stroke-width="1.7"/><rect x="7" y="8" width="78" height="32" fill="none" stroke="#a44b4d" stroke-width=".65"/><text x="46" y="25" text-anchor="middle" font-family="serif" font-size="13" font-weight="bold" letter-spacing="2" fill="#a44b4d">' + (ch.status === 'pending' ? '待核查' : '已建档') + '</text><text x="46" y="35" text-anchor="middle" font-size="5.3" letter-spacing="1.4" fill="#a44b4d">UNDER REVIEW</text></svg></div>'
    + '<div class="aw-ca-pageTwo"><div class="aw-ca-p2Head"><b>询问笔录</b><span>CASE ' + esc2(an.file) + ' / PAGE 02</span></div><div class="aw-ca-p2Info">记录地点：' + esc2(p2.place) + '<br>记录时间：' + esc2(p2.time) + '<br>询问对象：' + esc2(ch.name) + '<br>记录状态：' + esc2(p2.status) + '</div><div class="aw-ca-statement">' + esc2(p2.statement) + '</div><div class="aw-ca-p2Lines"></div><div class="aw-ca-p2Foot"><span>INTERVIEW TRANSCRIPT / 02</span><button class="aw-ca-return" type="button" data-aw-ca="return">返回主档案</button></div></div>'
    + '<div class="aw-ca-zoom"><div class="aw-ca-zoomPhoto">' + charPhotoHTML(ch, 'aw-ca-photoInit') + '</div><button class="aw-ca-zoomClose" type="button" data-aw-ca="zoom-close" aria-label="关闭放大观察">×</button><div class="aw-ca-zoomLabel">SUBJECT OBSERVATION / ×1.35</div></div>'
    + '</div>'
    + '<div class="aw-ca-env"><div class="aw-ca-envBack"></div><div class="aw-ca-envFront"></div><div class="aw-ca-envFlap"></div><div class="aw-ca-envTitle">案件封存袋</div><div class="aw-ca-envSub">EVIDENCE STORAGE<br>RESTRICTED ACCESS</div><div class="aw-ca-envNo">FILE / ' + esc2(an.file) + '</div><div class="aw-ca-envSeal"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#9a494b" stroke-width="1"/><circle cx="20" cy="20" r="13" fill="none" stroke="#9a494b" stroke-width=".6" stroke-dasharray="2 2"/><text x="20" y="24" text-anchor="middle" font-size="11" fill="#9a494b" font-family="serif">封</text></svg></div></div>'
    + '<div class="aw-ca-string">' + CA_THREAD + '</div>'
    + '</div>';
}
function openArchive(charId, host) {
  ensureCaStyle();
  var ch = (charId === 'main') ? mainCharObj() : AW.findChar(charId);
  if (!ch) { toast2('找不到这个人物'); return false; }
  var root = host || document.querySelector('.gd-root[data-gd="script"]') || document.querySelector('#wx-app-root') || document.querySelector('.ck-root') || document.body;
  var ov = document.getElementById('aw-archive-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'aw-archive-ov'; ov.className = 'aw-ca-ov'; root.appendChild(ov); }
  ov.innerHTML = '<div class="aw-ca-ovbar"><button type="button" data-aw-ca-ov="back">‹ 返回</button><span style="font-size:13px;color:#8a6a52">人物档案 · ' + esc2(ch.name) + '</span>'
    + (ch.isMain ? '<span style="font-size:12px;color:#8a6a52">主角 TA 在角色设置里配</span>' : '<button type="button" data-aw-ca-ov="edit" data-id="' + esc2(ch.id) + '">编辑</button><button type="button" data-aw-ca-ov="export" data-id="' + esc2(ch.id) + '">导出角色卡</button><button type="button" data-aw-ca-ov="delete" data-id="' + esc2(ch.id) + '">删除</button>')
    + '</div><div class="aw-ca-wrap">' + archiveHTML(ch) + '</div>';
  ov.style.display = 'block';
  var ca = ov.querySelector('.aw-ca');
  var wrap = ov.querySelector('.aw-ca-wrap');
  var fit = function () { var w = wrap ? wrap.clientWidth : 360; var s = Math.min(1, w / 560); if (ca) ca.style.setProperty('--aw-ca-scale', s); if (wrap) wrap.style.height = Math.round(682 * s) + 'px'; };
  fit();
  setTimeout(function () { if (ca) ca.classList.add('aw-ca-visible'); }, 50);
  var tabs = archiveTabs(ch);
  ov.onclick = function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-aw-ca-tab]') : null;
    if (t) {
      var i = parseInt(t.getAttribute('data-aw-ca-tab'), 10);
      ov.querySelectorAll('.aw-ca-evTab').forEach(function (b, j) { b.classList.toggle('active', i === j); });
      var rt = ov.querySelector('.aw-ca-recordText'); if (rt) rt.textContent = tabs[i].text;
      var re = ov.querySelector('.aw-ca-recordEn'); if (re) re.textContent = '“' + tabs[i].en + '.”';
      var rl = ov.querySelector('.aw-ca-recordLabel'); if (rl) rl.textContent = 'INVESTIGATION NOTE / 0' + (i + 1);
      return;
    }
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-ca]') : null;
    if (b) {
      var act = b.getAttribute('data-aw-ca');
      if (act === 'zoom') { ca.classList.add('zoom-open'); return; }
      if (act === 'zoom-close') { ca.classList.remove('zoom-open'); return; }
      if (act === 'next') { ca.classList.add('page-two'); ca.classList.remove('zoom-open'); return; }
      if (act === 'return') { ca.classList.remove('page-two'); return; }
      return;
    }
    var o = ev.target && ev.target.closest ? ev.target.closest('[data-aw-ca-ov]') : null;
    if (o) {
      var oa = o.getAttribute('data-aw-ca-ov'); var id = o.getAttribute('data-id') || '';
      if (oa === 'back') { ov.style.display = 'none'; return; }
      if (oa === 'edit') { ov.style.display = 'none'; AW.openCreateChar(id); return; }
      if (oa === 'export') { try { var card = AW.exportCard(id); var blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (AW.findChar(id).name || 'char') + '.json'; a.click(); } catch (e) { toast2(e.message || '导出失败'); } return; }
      if (oa === 'delete') { try { if (window.confirm && !window.confirm('确定删除这个人物吗？ta 的会话也会一起删掉。')) return; AW.deleteChar(id); ov.style.display = 'none'; toast2('已删除'); } catch (e) { toast2(e.message || '删除失败'); } return; }
    }
  };
  return true;
}
function openCharLibrary(host) {
  var root = host || document.querySelector('.gd-root[data-gd="script"]') || document.querySelector('#wx-app-root') || document.body;
  var ov = document.getElementById('aw-lib-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'aw-lib-ov'; ov.className = 'aw-ca-ov'; root.appendChild(ov); }
  var chars = allArchiveChars();
  ov.innerHTML = '<div class="aw-ca-ovbar"><button type="button" data-aw-lib="back">‹ 返回</button><span style="font-size:13px;color:#8a6a52">角色库 · 与微信创建人物同一套数据</span><button type="button" data-aw-lib="new">＋ 创建人物</button></div>'
    + chars.map(function (ch) {
      return '<div class="aw-lib-row"><div><b>' + esc2(ch.name) + '</b> <span style="font-size:12px;color:#8a6a52">' + esc2(ch.isMain ? '主角 TA' : (ch.relationship || '联系人')) + (ch.status === 'pending' ? ' · 待审阅' : '') + '</span><br><span style="font-size:12px;color:#a08a7a">' + esc2(ch.occupation || '') + ' ' + esc2(ch.traits || '') + '</span></div><div><button type="button" class="aw-news-btn ghost" data-aw-lib="archive" data-id="' + esc2(ch.id) + '">📁 档案</button></div></div>';
    }).join('')
    + '<div style="font-size:12px;color:#a08a7a;line-height:1.8">剧本里选中的人物就是这里的人物，改一处两处都变。导入的卡默认禁用，审阅启用后才出现在这里。</div>';
  ov.style.display = 'block';
  ov.onclick = function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aw-lib]') : null; if (!b) return;
    var act = b.getAttribute('data-aw-lib'); var id = b.getAttribute('data-id') || '';
    if (act === 'back') { ov.style.display = 'none'; return; }
    if (act === 'new') { ov.style.display = 'none'; AW.openCreateChar(); return; }
    if (act === 'archive') { ov.style.display = 'none'; openArchive(id, root); return; }
  };
  return true;
}
function scriptCharId() { try { var s = AW.loadSim ? AW.loadSim() : {}; return s.scriptCharId || 'main'; } catch (e) { return 'main'; } }
function setScriptChar(id) { try { var s = AW.loadSim ? AW.loadSim() : {}; s.scriptCharId = id; if (AW.saveSim) AW.saveSim(s); } catch (e) {} return id; }
function ensureScriptArchive() {
  /* [GROUP-FIX9] 兼容桩：出演人物条已收进剧本 app 的 renderBody（oaCastHTML），
     不再以外挂节点插进 #gd-body-script（旧写法每次 _refresh 都会被洗掉、等 tick
     才回来）。boot2 的 tick 继续调本函数，只清掉可能残留的旧节点，不再新建。 */
  try { var old = document.getElementById('aw-script-cast'); if (old && old.parentNode) old.parentNode.removeChild(old); } catch (e) {}
  return true;
}
function ensureCreateCharArchiveBtns() {
  var page = document.getElementById('wx-view-aw-create-char'); if (!page) return false;
  page.querySelectorAll('.aw-cc-field').forEach(function (field) {
    field.querySelectorAll('[data-aw-cc="edit"]').forEach(function (editBtn) {
      var id = editBtn.getAttribute('data-id');
      if (id && !field.querySelector('[data-aw-ca-btn="' + id + '"]')) {
        var ab = document.createElement('button'); ab.type = 'button'; ab.className = 'aw-btn ghost'; ab.setAttribute('data-aw-ca-btn', id); ab.textContent = '📁 档案';
        ab.addEventListener('click', function (e) { e.stopPropagation(); openArchive(id); });
        editBtn.parentNode.insertBefore(ab, editBtn.nextSibling);
      }
    });
  });
  return true;
}

/* ════════════════ 四、智能体生成档案 ════════════════ */
function genSwitch() { var v = rd2(GEN_KEY, null); return !(v && v.enabled === false); }
function setGenSwitch(on) { wr2(GEN_KEY, { enabled: !!on }); return !!on; }
function buildTemplateDraft(input) {
  input = input || {};
  var name = String(input.name || '').trim() || '未命名';
  var kws = String(input.keywords || '').split(/[,，、\s]+/).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
  var kwStr = kws.join('、');
  var f = input.fields || {};
  var traits = f.traits || (kws.length ? kws.slice(0, 3).join('、') : '温和、细心');
  var background = f.background || ('「' + name + '」' + (kwStr ? '，关键词是' + kwStr + '。' : '。') + '关于 TA 的过去，还没有更多记录，等你慢慢了解。');
  return {
    traits: traits,
    background: background,
    speechStyle: f.speechStyle || '说话自然，不紧不慢',
    likes: f.likes || (kws[0] || '安静的午后'),
    dislikes: f.dislikes || '被催促',
    habits: f.habits || '想到什么就记下来',
    rules: f.rules || '说话简短真诚，不主动提工作',
    greeting: f.greeting || ('你好，我是' + name + '。'),
    examples: (f.examples && f.examples.length) ? f.examples : [{ q: '你好', a: '你好呀，我是' + name + '。' }, { q: '今天过得怎么样', a: '还不错，' + (kws[0] ? '刚' + (kws[0].indexOf('画') !== -1 ? '画完一张画' : '忙完一阵') : '刚忙完一阵') + '。' }]
  };
}
function generateCharDraft(input) {
  input = input || {};
  var name = String(input.name || '').trim();
  if (!name) return Promise.reject(new Error('先填名字（只填名字也可以）'));
  var kws = String(input.keywords || '').trim();
  var fields = input.fields || {};
  var modelName = '';
  try {
    if (genSwitch() && window.PhoneModel && window.PhoneModel.isEnabledFor && window.PhoneModel.isEnabledFor('charGen') && window.PhoneModel.chatComplete && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('charGen')) {
      var cfg = window.PhoneModel.apiCfgFor('charGen');
      modelName = (cfg && cfg.model) || '';
      var sys = '你是一名角色设定助手。只根据用户提供的信息（名字、关键词、已填字段）补全人物档案，不要编造与这些信息无关的具体事实（不要编人名、地名、事件、数字）。只返回 JSON，不要解释。字段：traits（性格特点）、background（背景故事）、speechStyle（说话风格）、likes（喜欢）、dislikes（讨厌）、habits（习惯）、rules（聊天行为规则）、greeting（开场白）、examples（示例对话数组，每项 {q,a}，最多 3 组）。';
      var user = '名字：' + name + (kws ? '\n关键词：' + kws : '') + (fields.occupation ? '\n职业：' + fields.occupation : '') + (fields.relationship ? '\n与我的关系：' + fields.relationship : '') + (fields.traits ? '\n已填性格：' + fields.traits : '') + (fields.background ? '\n已填背景：' + fields.background : '');
      return window.PhoneModel.chatComplete([{ role: 'system', content: sys }, { role: 'user', content: user }], { feature: 'charGen' }).then(function (text) {
        var raw = String(text || '');
        var m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('模型返回不是 JSON');
        var d = JSON.parse(m[0]);
        var draft = {};
        ['traits', 'background', 'speechStyle', 'likes', 'dislikes', 'habits', 'rules', 'greeting'].forEach(function (k) { if (typeof d[k] === 'string' && d[k].trim()) draft[k] = d[k].trim(); });
        if (Array.isArray(d.examples)) draft.examples = d.examples.filter(function (e) { return e && e.q && e.a; }).slice(0, 3);
        if (!draft.traits && !draft.background) throw new Error('模型返回缺少字段');
        var tpl = buildTemplateDraft(input);
        Object.keys(tpl).forEach(function (k) { if (draft[k] === undefined) draft[k] = tpl[k]; });
        return { draft: draft, via: 'model', model: modelName };
      }).catch(function () {
        return { draft: buildTemplateDraft(input), via: 'template', reason: '模型调用失败，已用模板生成' };
      });
    }
  } catch (e) {}
  return Promise.resolve({ draft: buildTemplateDraft(input), via: 'template', reason: genSwitch() ? '未接模型，用模板生成' : '角色/档案生成开关已关，用模板生成' });
}
function ensureCharGen() {
  var page = document.getElementById('wx-view-aw-create-char'); if (!page) return false;
  var anchor = page.querySelector('.aw-cc-field');
  if (!anchor || document.getElementById('aw-cc-gen')) return true;
  var block = document.createElement('div'); block.className = 'aw-cc-field'; block.id = 'aw-cc-gen';
  block.innerHTML = '<label>✨ 智能体生成档案</label>'
    + '<input id="aw-cc-keywords" type="text" placeholder="关键词（可选，如：冷静、爱猫、摄影师）">'
    + '<label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input id="aw-cc-gen-switch" type="checkbox" style="width:auto"' + (genSwitch() ? ' checked' : '') + '> 允许模型生成（分功能开关：角色/档案生成）</label>'
    + '<div style="font-size:11px;color:#888;line-height:1.7;margin-top:4px">只填名字也能生成；只传一张图也可以（头像不发给模型）。生成只把你为这个人物填的内容 + 生成提示发给模型，不发其他数据。生成结果先填入表单给你审阅，确认保存后才入库，不自动保存。</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="aw-btn" id="aw-cc-gen-btn" style="background:#07c160">智能体生成档案</button><span id="aw-cc-gen-out" style="font-size:12px;color:#8a6a52;align-self:center"></span></div>';
  anchor.parentNode.insertBefore(block, anchor.nextSibling);
  var sw = document.getElementById('aw-cc-gen-switch');
  if (sw) sw.addEventListener('change', function () { setGenSwitch(sw.checked); });
  var btn = document.getElementById('aw-cc-gen-btn');
  if (btn) btn.addEventListener('click', function () {
    var gv = function (x) { var el = document.getElementById(x); return el ? el.value : ''; };
    var out = document.getElementById('aw-cc-gen-out');
    if (out) out.textContent = '生成中…';
    generateCharDraft({ name: gv('aw-cc-name'), keywords: gv('aw-cc-keywords'), fields: { occupation: gv('aw-cc-occupation'), relationship: gv('aw-cc-relationship'), traits: gv('aw-cc-traits'), background: gv('aw-cc-background') } }).then(function (r) {
      var set = function (id, v) { var el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
      set('aw-cc-traits', r.draft.traits); set('aw-cc-background', r.draft.background); set('aw-cc-speech', r.draft.speechStyle);
      set('aw-cc-likes', r.draft.likes); set('aw-cc-dislikes', r.draft.dislikes); set('aw-cc-habits', r.draft.habits);
      set('aw-cc-rules', r.draft.rules); set('aw-cc-greeting', r.draft.greeting);
      if (r.draft.examples) set('aw-cc-examples', r.draft.examples.map(function (e) { return '问：' + e.q + ' 答：' + e.a; }).join('\n'));
      var det = document.querySelector('#wx-view-aw-create-char details'); if (det) det.open = true;
      if (out) out.textContent = r.via === 'model' ? ('模型生成' + (r.model ? '（' + r.model + '）' : '') + ' · 已填入表单，请审阅后点“保存人物”') : ('模板生成 · 已填入表单，请审阅后点“保存人物”' + (r.reason ? '（' + r.reason + '）' : ''));
    }).catch(function (e) { if (out) out.textContent = e.message || '生成失败'; });
  });
  return true;
}

/* ── 启动（第二块） ── */
function boot2() {
  try { ensureRetroStyle(); ensureCaStyle(); } catch (e) {}
  var tick = function () {
    try { ensureForumNews(); } catch (e) {}
    try { ensureLetterRetro(); } catch (e) {}
    try { ensureScriptArchive(); } catch (e) {}
    try { ensureCharGen(); } catch (e) {}
    try { ensureCreateCharArchiveBtns(); } catch (e) {}
    try { checkNewLetters(); } catch (e) {}
  };
  tick();
  setInterval(tick, 3000);
  if (typeof MutationObserver !== 'undefined') {
    try {
      var ob = new MutationObserver(function () { tick(); });
      ob.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot2); else boot2();

Object.assign(window.AWGroup, {
  NEWS_KEY: NEWS_KEY, GEN_KEY: GEN_KEY, LETTER_STATE_KEY: LETTER_STATE_KEY,
  loadNews: loadNews, collectNewsEvents: collectNewsEvents, generateNewspaperIssue: generateNewspaperIssue,
  publishPostToNews: publishPostToNews, listNewsIssues: listNewsIssues, getNewsIssue: getNewsIssue,
  getNewsArticle: getNewsArticle, readNewsArticle: readNewsArticle,
  listArticleComments: listArticleComments, commentNewsArticle: commentNewsArticle,
  toggleNewsFav: toggleNewsFav, isNewsFav: isNewsFav, polishNewsIssue: polishNewsIssue,
  openNewsOverlay: openNewsOverlay, ensureForumNews: ensureForumNews,
  listPastLetters: listPastLetters, filterPastLetters: filterPastLetters, pastLetterSenders: pastLetterSenders,
  markLetterRead: markLetterRead, toggleLetterStar: toggleLetterStar, saveLetterMemory: saveLetterMemory,
  writeLetter: writeLetter, checkNewLetters: checkNewLetters, openPastArchive: openPastArchive, openWriteLetter: openWriteLetter,
  ensureLetterRetro: ensureLetterRetro, ensureRetroStyle: ensureRetroStyle,
  mainCharObj: mainCharObj, allArchiveChars: allArchiveChars, archiveNo: archiveNo, archiveTabs: archiveTabs,
  archivePageTwo: archivePageTwo, archiveHTML: archiveHTML, openArchive: openArchive, openCharLibrary: openCharLibrary,
  scriptCharId: scriptCharId, setScriptChar: setScriptChar, ensureScriptArchive: ensureScriptArchive,
  genSwitch: genSwitch, setGenSwitch: setGenSwitch, buildTemplateDraft: buildTemplateDraft, generateCharDraft: generateCharDraft
});
})();
