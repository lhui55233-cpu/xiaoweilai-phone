
/* GROUP-BS · 借鉴 Tidal_Echo 四项落地（只借思路，全部代码自写；AGPL 代码一行未碰；
   不引入 relay 后端；不做假按键；详见 patch_groupBS.py 头注释） */
(function () {
'use strict';
var CHAIN_KEY = 'phone_model_fallback_v1';
var FBKEYS_KEY = 'phone_model_fallback_keys_v1';
var MAX_FB = 3;
var REACT_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
var STREAM_INPUT_PLACEHOLDER = '正在输入…';
var STREAM_INPUT_DEFAULT = '输入内容...';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function lsGet(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function lsRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function wxStore() { try { return (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) ? AppRegistry['wechat'].wxStore : null; } catch (e) { return null; } }
function persistWx() { try { var st = wxStore(); if (st && typeof st._persist === 'function') st._persist(); } catch (e) {} }
function renderWx() { try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates(); } catch (e) {} }
function findSession(sid) { var st = wxStore(); if (!st) return null; return (st.sessions || []).find(function (s) { return String(s.id) === String(sid); }) || null; }
function findMsg(sid, mid) { var s = findSession(sid); if (!s) return null; var m = (s.messages || []).find(function (x) { return String(x.id) === String(mid); }); return m ? { sess: s, msg: m } : null; }
function uid(p) { return (p || 'bs') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }

/* ── 1. 模型回退链 ── */
function cleanChain(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (e) {
        if (!e || typeof e !== 'object') return;
        var name = String(e.name || '').trim().slice(0, 40);
        var baseUrl = String(e.baseUrl || '').trim().slice(0, 200);
        var model = String(e.model || '').trim().slice(0, 80);
        if (!name && !baseUrl && !model) return;
        out.push({ id: String(e.id || uid('fb')), name: name, baseUrl: baseUrl, model: model });
    });
    return out.slice(0, MAX_FB);
}
function getFallbackChain() { return cleanChain(lsGet(CHAIN_KEY, [])); }
function setFallbackChain(list) { var c = cleanChain(list); lsSet(CHAIN_KEY, c); return c; }
function getFallbackKey(id) { var m = lsGet(FBKEYS_KEY, {}); return (m && typeof m === 'object') ? (m[String(id)] || '') : ''; }
function setFallbackKey(id, key) {
    var m = lsGet(FBKEYS_KEY, {});
    if (!m || typeof m !== 'object') m = {};
    if (key) m[String(id)] = String(key); else delete m[String(id)];
    lsSet(FBKEYS_KEY, m);
}
function fallbackKeysNote() {
    return getFallbackChain().length ? '备用模型 key 未导出，需重填（请到设置 → 接模型 → 备用模型重填）' : '';
}
function statusOf(err) {
    var m = String((err && err.message) || err || '');
    var mm = m.match(/HTTP\s(\d{3})/) || m.match(/\b(401|403|404|429|5\d\d)\b/);
    return mm ? parseInt(mm[1], 10) : 0;
}
function isRetryableStatus(st) { return st === 401 || st === 403 || st === 429 || (st >= 500 && st <= 599); }
function effTempMax() {
    try { var c = window.PhoneModel.loadCfg(); return { temperature: c.temperature, maxTokens: c.maxTokens }; } catch (e) {}
    return { temperature: 0.9, maxTokens: 500 };
}
function pushSysNote(sess, text) {
    if (!sess || !text) return null;
    var m = { id: uid('m_bsnote'), sender: '系统', type: 'time_gap', content: text, time: '刚刚' };
    sess.messages.push(m);
    persistWx(); renderWx();
    return m;
}
function pushSwitchNote(sess, fbName) {
    return pushSysNote(sess, '主模型不可用，已切换到备用模型（' + fbName + '）');
}

/* ── 2. 流式回复（SSE 解析，帧形自拟：{stream_id, type:'delta', text} / {type:'done', final_text}）── */
var _streamLog = [];
var _streamIdSeq = 0;
function parseSSELine(line, streamId) {
    var t = String(line || '').trim();
    if (t.indexOf('data:') !== 0) return null;
    var payload = t.slice(5).trim();
    if (payload === '[DONE]') return { stream_id: streamId, type: 'done', final_text: '' };
    var d = null;
    try { d = JSON.parse(payload); } catch (e) { return null; }
    var delta = (d && d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content)
        || (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    if (!delta) return null;
    return { stream_id: streamId, type: 'delta', text: String(delta) };
}
/* 整段 SSE 文本的纯解析（可测，不碰网络）：返回 {frames, done, finalText} */
function parseSSEText(text, streamId) {
    var sid = streamId || ('bs_stream_test');
    var frames = [], finalText = '', done = false;
    String(text || '').split('\n').forEach(function (line) {
        var f = parseSSELine(line, sid);
        if (!f) return;
        if (f.type === 'delta') { frames.push(f); finalText += f.text; }
        else if (f.type === 'done') { done = true; frames.push({ stream_id: sid, type: 'done', final_text: finalText }); }
    });
    return { frames: frames, done: done, finalText: finalText };
}
function streamEndpoint(baseUrl) {
    var url = String(baseUrl || '').replace(/\/+$/, '');
    if (/api\.anthropic\.com/.test(url)) throw new Error('该节点是 Anthropic 原生协议，暂不支持；请使用 OpenAI 兼容中转');
    if (/generativelanguage\.googleapis\.com/.test(url) && url.indexOf('/openai') === -1) url = url.replace(/\/v1beta.*$/, '') + '/v1beta/openai';
    if (!/\/v\d+$/.test(url) && url.indexOf('/chat/completions') === -1) url += '/v1';
    return url.indexOf('/chat/completions') !== -1 ? url : url + '/chat/completions';
}
function setInputStreaming(on) {
    try { var inp = document.getElementById('wx-msg-input'); if (inp) inp.placeholder = on ? STREAM_INPUT_PLACEHOLDER : STREAM_INPUT_DEFAULT; } catch (e) {}
}
async function streamAttempt(cfg, messages, maxTokens, sess, charName) {
    var streamId = 'bs_stream_' + Date.now().toString(36) + '_' + (++_streamIdSeq);
    _streamLog = [];
    var ph = { id: uid('m_bs_stream'), sender: charName, type: 'text', content: '', time: '刚刚', _bsStreaming: true };
    sess.messages.push(ph);
    renderWx();
    setInputStreaming(true);
    var cleanup = function () {
        var idx = sess.messages.indexOf(ph);
        if (idx >= 0) sess.messages.splice(idx, 1);
        setInputStreaming(false);
        renderWx();
    };
    var acc = '', hadPartial = false, sawDone = false;
    var decoder = (typeof TextDecoder !== 'undefined') ? new TextDecoder() : null;
    var lastRender = 0;
    try {
        if (typeof fetch === 'undefined') { cleanup(); var e0 = new Error('STREAM_UNSUPPORTED'); throw e0; }
        var body = { model: cfg.model, messages: messages, temperature: (cfg.temperature !== undefined ? cfg.temperature : 0.9), stream: true };
        if (maxTokens) body.max_tokens = Number(maxTokens);
        var resp = await fetch(streamEndpoint(cfg.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key }, body: JSON.stringify(body) });
        if (!resp.ok) { cleanup(); throw new Error('HTTP ' + resp.status); }
        var reader = (resp.body && typeof resp.body.getReader === 'function') ? resp.body.getReader() : null;
        if (!reader) { cleanup(); throw new Error('STREAM_UNSUPPORTED'); }
        var buf = '';
        var feedLine = function (line) {
            var f = parseSSELine(line, streamId);
            if (!f) return;
            if (f.type === 'delta') {
                acc += f.text; hadPartial = true; _streamLog.push(f);
                ph.content = acc;
                var now = Date.now();
                if (now - lastRender > 120) { lastRender = now; renderWx(); }
            } else if (f.type === 'done') {
                sawDone = true;
                _streamLog.push({ stream_id: streamId, type: 'done', final_text: acc });
            }
        };
        for (;;) {
            var r = await reader.read();
            if (r.done) break;
            var chunk = (typeof r.value === 'string') ? r.value : (decoder ? decoder.decode(r.value, { stream: true }) : '');
            buf += chunk;
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(feedLine);
            if (sawDone) break;
        }
        if (buf.trim()) feedLine(buf);
        if (!acc) { cleanup(); var e1 = new Error('STREAM_EMPTY'); e1._bsHadPartial = hadPartial; throw e1; }
        var finalText = acc;
        cleanup();
        try { if (typeof window.reportTokenUsage === 'function') window.reportTokenUsage('微信', Math.round((JSON.stringify(messages).length + finalText.length) / 1.5), 1); } catch (e) {}
        return finalText;
    } catch (e) {
        try { cleanup(); } catch (e2) {}
        if (e && e._bsHadPartial === undefined) e._bsHadPartial = hadPartial;
        throw e;
    }
}
/* 回退链 + 流式：主模型先流式；流式失败按状态决定整条重试还是切备用；成功切备用后留小字 */
async function bsModelReply(apiCfg, messages, maxTokens, sess) {
    var charName = (sess && sess.name) || '';
    var tm = effTempMax();
    var candidates = [];
    if (apiCfg && apiCfg.baseUrl && apiCfg.model) {
        candidates.push({ name: (apiCfg.model || '主模型'), primary: true, cfg: { baseUrl: apiCfg.baseUrl, key: apiCfg.key || '', model: apiCfg.model, temperature: (apiCfg.temperature !== undefined ? apiCfg.temperature : tm.temperature), maxTokens: maxTokens || apiCfg.maxTokens || tm.maxTokens } });
    }
    getFallbackChain().forEach(function (e) {
        if (!e.baseUrl || !e.model) return;
        var k = getFallbackKey(e.id);
        candidates.push({ name: (e.name || e.model), primary: false, noKey: !k, cfg: { baseUrl: e.baseUrl, key: k, model: e.model, temperature: tm.temperature, maxTokens: maxTokens || tm.maxTokens } });
    });
    var lastErr = null;
    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (c.noKey) continue; /* 无 key 的备用位跳过：调了也只会 401 */
        var streamErr = null;
        try {
            var text = await streamAttempt(c.cfg, messages, c.cfg.maxTokens, sess, charName);
            if (!c.primary) pushSwitchNote(sess, c.name);
            return text;
        } catch (e) { streamErr = e; }
        var st = statusOf(streamErr);
        if (st && !isRetryableStatus(st)) throw streamErr; /* 404 等配置错：不换备用 */
        if (st && isRetryableStatus(st)) { lastErr = streamErr; continue; } /* 可重试状态：直接切下一个 */
        /* 无状态码的流式失败（不支持流式/中途断开/空流）：同一模型改整条再试一次 */
        try {
            var whole = await window.WeChatAppEngine.callRealAI(c.cfg, messages, c.cfg.maxTokens);
            if (streamErr && streamErr._bsHadPartial) pushSysNote(sess, '流式回复中断，已用整条回复补全');
            if (!c.primary) pushSwitchNote(sess, c.name);
            return whole;
        } catch (e2) {
            lastErr = e2;
            var st2 = statusOf(e2);
            if (st2 && isRetryableStatus(st2)) continue;
            throw e2;
        }
    }
    throw lastErr || new Error('无可用模型');
}

/* ── 3. 消息回应（reactions）── */
function reactionsOf(m) { if (!Array.isArray(m.reactions)) m.reactions = []; return m.reactions; }
function toggleReaction(sid, mid, emoji, by) {
    var found = findMsg(sid, mid);
    if (!found || !emoji) return { ok: false, reason: 'not_found' };
    var who = by || '我';
    var list = reactionsOf(found.msg);
    var idx = -1;
    list.forEach(function (r, i) { if (r.emoji === emoji && r.by === who) idx = i; });
    var reacted;
    if (idx >= 0) { list.splice(idx, 1); reacted = false; }
    else { list.push({ emoji: String(emoji), by: who, ts: Date.now() }); reacted = true; }
    persistWx(); renderWx();
    return { ok: true, reacted: reacted, count: list.length };
}
function charAddReaction(sid, mid, emoji) {
    var s = findSession(sid);
    if (!s) return { ok: false, reason: 'not_found' };
    return toggleReaction(sid, mid, emoji, s.name);
}
function reactionsHTML(m, sid) {
    var list = Array.isArray(m.reactions) ? m.reactions : [];
    if (!list.length) return '';
    var groups = {};
    var order = [];
    list.forEach(function (r) {
        if (!groups[r.emoji]) { groups[r.emoji] = []; order.push(r.emoji); }
        groups[r.emoji].push(r.by);
    });
    var chips = order.map(function (em) {
        var bys = groups[em];
        var mine = bys.indexOf('我') >= 0;
        var label = bys.length > 1 ? (em + ' ' + bys.length) : em;
        var title = bys.join('、');
        return '<button type="button" class="bs-react-chip' + (mine ? ' bs-react-mine' : '') + '" title="' + esc(title) + '" onclick="event.stopPropagation();WeChatAppEngine.toggleReaction(\'' + esc(sid) + '\',\'' + esc(m.id) + '\',\'' + esc(em) + '\')">' + esc(label) + '</button>';
    }).join('');
    return '<div class="bs-reactions" data-mid="' + esc(m.id) + '">' + chips
        + '<button type="button" class="bs-react-add" onclick="event.stopPropagation();WeChatAppEngine.openReactionPicker(\'' + esc(sid) + '\',\'' + esc(m.id) + '\')">＋</button></div>';
}
var _pickerTarget = null;
function ensurePicker() {
    var p = document.getElementById('bs-reaction-picker');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'bs-reaction-picker';
    p.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:2px;">' + REACT_EMOJIS.map(function (em) {
        return '<button type="button" class="bs-rp-emo" data-emo="' + esc(em) + '">' + esc(em) + '</button>';
    }).join('') + '</div>'
        + '<div class="bs-rp-custom"><input id="bs-rp-custom" type="text" placeholder="自定义一个 emoji" maxlength="4"><button type="button" id="bs-rp-custom-btn">贴</button></div>'
        + '<button type="button" class="bs-rp-close" id="bs-rp-close">取消</button>';
    p.addEventListener('click', function (ev) {
        var t = ev.target;
        if (t && t.getAttribute && t.getAttribute('data-emo')) {
            if (_pickerTarget) toggleReaction(_pickerTarget.sid, _pickerTarget.mid, t.getAttribute('data-emo'), '我');
            closeReactionPicker();
        } else if (t && t.id === 'bs-rp-custom-btn') { customReaction(); }
        else if (t && t.id === 'bs-rp-close') { closeReactionPicker(); }
    });
    (document.getElementById('wx-app-root') || document.body).appendChild(p);
    return p;
}
function openReactionPicker(sid, mid) {
    if (!findMsg(sid, mid)) return false;
    _pickerTarget = { sid: sid, mid: mid };
    var p = ensurePicker();
    var inp = document.getElementById('bs-rp-custom');
    if (inp) inp.value = '';
    p.classList.add('bs-show');
    return true;
}
function closeReactionPicker() {
    _pickerTarget = null;
    var p = document.getElementById('bs-reaction-picker');
    if (p) p.classList.remove('bs-show');
}
function customReaction() {
    var inp = document.getElementById('bs-rp-custom');
    var v = inp ? String(inp.value || '').trim().slice(0, 4) : '';
    if (!v || !_pickerTarget) return false;
    toggleReaction(_pickerTarget.sid, _pickerTarget.mid, v, '我');
    closeReactionPicker();
    return true;
}

/* ── 4. act 小卡 ── */
var ACT_LABELS = { schedule: '日程', diary: '日记', photo: '照片', file: '文件' };
function actCardHTML(m) {
    var st = m.status || 'running';
    var icon = st === 'running' ? '⏳' : (st === 'done' ? '✓' : '✗');
    var title = m.title || ('正在查' + (ACT_LABELS[m.actKind] || '东西') + '…');
    return '<div class="bs-act-card bs-act-' + esc(st) + '" data-mid="' + esc(m.id) + '" onclick="WeChatAppEngine.toggleActCard(\'' + esc(m.id) + '\')">'
        + '<div class="bs-act-head"><span>' + icon + '</span><span>' + esc(title) + '</span><span class="bs-act-chev">' + (m._expanded ? '▾' : '▸') + '</span></div>'
        + '<div class="bs-act-summary">' + esc(m.summary || '') + '</div>'
        + (m._expanded ? '<div class="bs-act-detail">' + esc(m.detail || '') + '</div>' : '')
        + '</div>';
}
function toggleActCard(mid) {
    var st = wxStore();
    if (!st) return false;
    var found = null;
    (st.sessions || []).forEach(function (s) { (s.messages || []).forEach(function (m) { if (String(m.id) === String(mid)) found = m; }); });
    if (!found || found.type !== 'act') return false;
    found._expanded = !found._expanded;
    persistWx(); renderWx();
    return true;
}
function readScheduleToday() {
    var raw = lsRaw('phone_schedule_v1');
    if (raw == null) return { ok: false, reason: '日程数据不存在（还没有建过日程）' };
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { return { ok: false, reason: '日程数据读不到（格式损坏）' }; }
    if (!Array.isArray(arr)) return { ok: false, reason: '日程数据读不到（格式不对）' };
    var ds = todayStr();
    var items = arr.filter(function (x) { return x && x.date === ds && !x.done; });
    if (!items.length) return { ok: false, reason: '今天没有未完成的日程' };
    var detail = items.map(function (x, i) { return (i + 1) + '. ' + (x.title || '未命名') + (x.time ? ' ' + x.time : '') + (x.note ? ' — ' + x.note : ''); }).join('\n');
    return { ok: true, summary: '今天还有 ' + items.length + ' 件事：' + (items[0].title || '') + (items[0].time ? '（' + items[0].time + '）' : ''), detail: detail };
}
function readDiary() {
    var raw = lsRaw('guichao.diaries.v1');
    if (raw == null) return { ok: false, reason: '没有找到日记' };
    var v;
    try { v = JSON.parse(raw); } catch (e) { return { ok: false, reason: '日记数据读不到（格式损坏）' }; }
    var arr = Array.isArray(v) ? v : (v && Array.isArray(v.diaries) ? v.diaries : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []));
    if (!arr.length) return { ok: false, reason: '没有找到日记' };
    var last = arr[arr.length - 1] || {};
    var when = last.date || last.time || last.createdAt || '';
    var what = last.title || last.content || last.text || '';
    return { ok: true, summary: '找到 ' + arr.length + ' 篇日记' + (when ? '，最近一篇是 ' + String(when).slice(0, 10) : ''), detail: String(what).slice(0, 200) || '（最近一篇没有正文）' };
}
function readPhotos() {
    var raw = lsRaw('phone_album_local_v1');
    if (raw == null) return { ok: false, reason: '相册里还没有照片' };
    var v;
    try { v = JSON.parse(raw); } catch (e) { return { ok: false, reason: '照片数据读不到（格式损坏）' }; }
    var arr = Array.isArray(v) ? v : (v && Array.isArray(v.photos) ? v.photos : (v && Array.isArray(v.images) ? v.images : []));
    if (!arr.length) return { ok: false, reason: '相册里还没有照片' };
    return { ok: true, summary: '相册里有 ' + arr.length + ' 张照片', detail: '最近一张：' + String((arr[arr.length - 1] && (arr[arr.length - 1].name || arr[arr.length - 1].title)) || '（无名字）') };
}
function readFileMsg(sess, params) {
    var name = String((params && params.name) || '').trim();
    if (!name) return { ok: false, reason: '没有指定要读的文件' };
    var hit = null;
    (sess.messages || []).forEach(function (m) {
        if (hit) return;
        var fn = m.fileName || m.name || '';
        if ((m.type === 'file' || fn) && (String(fn).indexOf(name) >= 0 || String(m.content || '').indexOf(name) >= 0)) hit = m;
    });
    if (!hit) return { ok: false, reason: '聊天里没找到这个文件' };
    return { ok: true, summary: '找到文件「' + name + '」', detail: '类型：' + (hit.type || '文件') + (hit.size ? '，大小：' + hit.size : '') };
}
function runAct(sessId, kind, params) {
    var sess = findSession(sessId);
    if (!sess) return Promise.resolve({ ok: false, reason: 'not_found' });
    var label = ACT_LABELS[kind] || '东西';
    var act = { id: uid('m_act'), sender: sess.name, type: 'act', actKind: kind, status: 'running', title: '正在查' + label + '…', summary: '正在翻' + label + '，稍等…', detail: '', time: '刚刚' };
    sess.messages.push(act);
    persistWx(); renderWx();
    return new Promise(function (resolve) {
        setTimeout(function () {
            var r;
            try {
                if (kind === 'schedule') r = readScheduleToday();
                else if (kind === 'diary') r = readDiary();
                else if (kind === 'photo') r = readPhotos();
                else if (kind === 'file') r = readFileMsg(sess, params);
                else r = { ok: false, reason: '不支持的动作' };
            } catch (e) { r = { ok: false, reason: '查的时候出错了：' + String((e && e.message) || e).slice(0, 40) }; }
            if (r.ok) { act.status = 'done'; act.title = '已查到' + label; act.summary = r.summary; act.detail = r.detail || ''; }
            else { act.status = 'failed'; act.title = '没查到' + label; act.summary = '没查到（' + r.reason + '）'; act.detail = '原因：' + r.reason; }
            persistWx(); renderWx();
            resolve(act);
        }, 350);
    });
}
function runScheduleAct(sessId) { return runAct(sessId, 'schedule'); }
function scheduleIntent(text) {
    var t = String(text || '');
    return /(今天|明天).{0,8}(日程|安排)/.test(t) || /查(一下)?(今天|明天)?日程/.test(t);
}

/* ── 设置页：备用模型区 ── */
function fallbackSectionHTML() {
    var chain = getFallbackChain();
    var rows = '';
    for (var i = 0; i < MAX_FB; i++) {
        var e = chain[i] || { id: '', name: '', baseUrl: '', model: '' };
        var hasKey = e.id ? !!getFallbackKey(e.id) : false;
        rows += '<div style="background:var(--st-paper,#fffdf8);border-radius:10px;overflow:hidden;margin-bottom:12px;" data-bs-fb="' + i + '">'
            + '<div style="padding:13px 16px;border-bottom:0.5px solid var(--st-silver-light,#dce2f1);font-size:17px;color:var(--st-ink,#1e2748);">备用模型 ' + (i + 1) + '</div>'
            + '<div style="padding:4px 16px 0;">'
            + '<div style="padding:8px 0;border-bottom:0.5px solid var(--st-silver-light,#dce2f1);"><div style="font-size:17px;color:var(--st-ink,#1e2748);">名字</div><input id="bs-fb-name-' + i + '" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="例如 备用 DeepSeek" value="' + esc(e.name || '') + '" style="width:100%;border:none;outline:none;font-size:17px;color:var(--st-ink,#1e2748);margin-top:6px;padding:0;"></div>'
            + '<div style="padding:8px 0;border-bottom:0.5px solid var(--st-silver-light,#dce2f1);"><div style="font-size:17px;color:var(--st-ink,#1e2748);">接口地址（base URL）</div><input id="bs-fb-base-' + i + '" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="留空表示不用这个备用位" value="' + esc(e.baseUrl || '') + '" style="width:100%;border:none;outline:none;font-size:17px;color:var(--st-ink,#1e2748);margin-top:6px;padding:0;"></div>'
            + '<div style="padding:8px 0;border-bottom:0.5px solid var(--st-silver-light,#dce2f1);"><div style="font-size:17px;color:var(--st-ink,#1e2748);">API key</div><input id="bs-fb-key-' + i + '" type="password" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="' + (hasKey ? '已保存（留空表示不改）' : '只存在本机，不进备份与导出') + '" style="width:100%;border:none;outline:none;font-size:17px;color:var(--st-ink,#1e2748);margin-top:6px;padding:0;"></div>'
            + '<div style="padding:8px 0;"><div style="font-size:17px;color:var(--st-ink,#1e2748);">模型名</div><input id="bs-fb-model-' + i + '" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="例如 deepseek-chat" value="' + esc(e.model || '') + '" style="width:100%;border:none;outline:none;font-size:17px;color:var(--st-ink,#1e2748);margin-top:6px;padding:0;"></div>'
            + '<div style="display:flex;gap:6px;padding:10px 0 4px;"><button onclick="window.GroupBS.saveFallbackFromForm(' + i + ')" style="flex:1;background:var(--st-ink,#1e2748);color:var(--st-paper,#fffdf8);border:none;border-radius:10px;padding:11px 0;font-size:17px;">保存备用 ' + (i + 1) + '</button><button onclick="window.GroupBS.clearFallbackFromForm(' + i + ')" style="flex:1;background:var(--st-paper,#fffdf8);color:var(--st-danger,#7c2d2d);border:1px solid var(--st-silver,#bfc8e0);border-radius:10px;padding:11px 0;font-size:17px;">清除</button></div>'
            + '<div id="bs-fb-result-' + i + '" style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));padding:0 0 12px;line-height:1.7;white-space:pre-wrap;"></div>'
            + '</div></div>';
    }
    return '<div style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6));margin:4px 2px 8px;line-height:1.6;">备用模型（回退链）：主模型返回 401 / 403 / 429 / 5xx 时，按顺序自动切到下一个，并在聊天里写一行小字说明。备用模型的 key 只存在本机，导出时删掉并写明“key 未导出，需重填”。留空的备用位会被跳过。</div>' + rows;
}
function fbFormVal(i, kind) { var el = document.getElementById('bs-fb-' + kind + '-' + i); return el ? String(el.value || '') : ''; }
function fbShowResult(i, text, ok) {
    var el = document.getElementById('bs-fb-result-' + i);
    if (el) { el.textContent = text; el.style.color = ok === true ? 'var(--st-ink,#1e2748)' : (ok === false ? 'var(--st-danger,#7c2d2d)' : 'var(--st-ink-60,rgba(30,39,72,.6))'); }
}
function saveFallbackFromForm(i) {
    var chain = getFallbackChain();
    var name = fbFormVal(i, 'name').trim();
    var base = fbFormVal(i, 'base').trim();
    var model = fbFormVal(i, 'model').trim();
    var keyIn = fbFormVal(i, 'key').trim();
    if (!name && !base && !model && !keyIn) { clearFallbackFromForm(i); return true; }
    if (base && !/^https?:\/\//i.test(base)) { fbShowResult(i, '地址要以 http:// 或 https:// 开头', false); return false; }
    var id = (chain[i] && chain[i].id) ? chain[i].id : uid('fb');
    var next = chain.slice();
    while (next.length <= i) next.push({ id: uid('fb'), name: '', baseUrl: '', model: '' });
    next[i] = { id: id, name: name, baseUrl: base, model: model };
    setFallbackChain(next.filter(function (e) { return e.name || e.baseUrl || e.model; }));
    if (keyIn) setFallbackKey(id, keyIn);
    var keyEl = document.getElementById('bs-fb-key-' + i);
    if (keyEl) { keyEl.value = ''; keyEl.placeholder = (keyIn || getFallbackKey(id)) ? '已保存（留空表示不改）' : '只存在本机，不进备份与导出'; }
    fbShowResult(i, '备用模型 ' + (i + 1) + ' 已保存（key 只存在本机）', true);
    return true;
}
function clearFallbackFromForm(i) {
    var chain = getFallbackChain();
    var old = chain[i];
    if (old && old.id) setFallbackKey(old.id, '');
    var next = chain.slice();
    next.splice(i, 1);
    setFallbackChain(next);
    ['name', 'base', 'model', 'key'].forEach(function (kind) { var el = document.getElementById('bs-fb-' + kind + '-' + i); if (el) el.value = ''; });
    fbShowResult(i, '备用模型 ' + (i + 1) + ' 已清除', true);
    return true;
}

/* ── 接线：挂到 WeChatAppEngine / PhoneModel / sendMsg 上 ── */
function wireUp() {
    try {
        if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine) {
            WeChatAppEngine.bsModelReply = bsModelReply;
            WeChatAppEngine.bsStreamAttempt = streamAttempt;
            WeChatAppEngine.toggleReaction = toggleReaction;
            WeChatAppEngine.charAddReaction = charAddReaction;
            WeChatAppEngine.bsReactionsHTML = reactionsHTML;
            WeChatAppEngine.openReactionPicker = openReactionPicker;
            WeChatAppEngine.closeReactionPicker = closeReactionPicker;
            WeChatAppEngine.bsActCardHTML = actCardHTML;
            WeChatAppEngine.toggleActCard = toggleActCard;
        }
    } catch (e) {}
    try {
        if (window.PhoneModel && window.PhoneModel.renderSettingsSub && !window.PhoneModel.renderSettingsSub._bsWrapped) {
            var _origRSS = window.PhoneModel.renderSettingsSub;
            var _wrapped = function () {
                var h = _origRSS();
                var sec = fallbackSectionHTML();
                var idx = h.indexOf('id="pm-test-result"');
                if (idx === -1) return h + sec;
                var divStart = h.lastIndexOf('<div', idx);
                if (divStart === -1) return h + sec;
                return h.slice(0, divStart) + sec + h.slice(divStart);
            };
            _wrapped._bsWrapped = true;
            window.PhoneModel.renderSettingsSub = _wrapped;
        }
    } catch (e) {}
    try {
        if (window.PhoneModel && window.PhoneModel.sanitizeExportData && !window.PhoneModel.sanitizeExportData._bsWrapped) {
            var _origSan = window.PhoneModel.sanitizeExportData;
            var _wrappedSan = function (data, scope) {
                var out = _origSan(data, scope) || {};
                try { delete out[FBKEYS_KEY]; } catch (e) {}
                var keys = [];
                try { var m = lsGet(FBKEYS_KEY, {}); Object.keys(m || {}).forEach(function (k) { if (m[k]) keys.push(m[k]); }); } catch (e) {}
                keys.forEach(function (key) {
                    Object.keys(out).forEach(function (k) {
                        try { if (typeof out[k] === 'string' && out[k].indexOf(key) !== -1) delete out[k]; } catch (e) {}
                    });
                });
                if (scope === 'all') out['__phone_model_fallback_keys_note__'] = '备用模型 key 未导出，需重填（请到设置 → 接模型 → 备用模型重填）';
                return out;
            };
            _wrappedSan._bsWrapped = true;
            window.PhoneModel.sanitizeExportData = _wrappedSan;
        }
    } catch (e) {}
    try {
        if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine && WeChatAppEngine.sendMsg && !WeChatAppEngine.sendMsg._bsWrapped) {
            var _origSend = WeChatAppEngine.sendMsg;
            var _wrappedSend = function () {
                var inp = document.getElementById('wx-msg-input');
                var txt = inp ? String(inp.value || '') : '';
                var r = _origSend.apply(this, arguments);
                try {
                    if (txt && scheduleIntent(txt)) {
                        var st = wxStore();
                        var cur = st && (st.sessions || []).find(function (s) { return String(s.id) === String(st.currentChatId); });
                        if (cur) runScheduleAct(cur.id);
                    }
                } catch (e) {}
                return r;
            };
            _wrappedSend._bsWrapped = true;
            WeChatAppEngine.sendMsg = _wrappedSend;
        }
    } catch (e) {}
}

window.GroupBS = {
    CHAIN_KEY: CHAIN_KEY, FBKEYS_KEY: FBKEYS_KEY, MAX_FALLBACK: MAX_FB,
    REACT_EMOJIS: REACT_EMOJIS,
    getFallbackChain: getFallbackChain, setFallbackChain: setFallbackChain,
    getFallbackKey: getFallbackKey, setFallbackKey: setFallbackKey,
    fallbackKeysNote: fallbackKeysNote,
    isRetryableStatus: isRetryableStatus, statusOf: statusOf,
    parseSSELine: parseSSELine, parseSSEText: parseSSEText,
    streamAttempt: streamAttempt, modelReplyWithFallback: bsModelReply,
    streamLog: function () { return _streamLog.slice(); },
    toggleReaction: toggleReaction, charAddReaction: charAddReaction,
    reactionsHTML: reactionsHTML,
    openReactionPicker: openReactionPicker, closeReactionPicker: closeReactionPicker,
    customReaction: customReaction,
    actCardHTML: actCardHTML, toggleActCard: toggleActCard,
    runAct: runAct, runScheduleAct: runScheduleAct,
    readScheduleToday: readScheduleToday, readDiary: readDiary, readPhotos: readPhotos,
    scheduleIntent: scheduleIntent,
    fallbackSectionHTML: fallbackSectionHTML,
    saveFallbackFromForm: saveFallbackFromForm, clearFallbackFromForm: clearFallbackFromForm
};
try { wireUp(); } catch (e) {}
})();
