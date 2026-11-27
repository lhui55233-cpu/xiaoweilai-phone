
/* GROUP-BS · 借鉴 Tidal_Echo 四项落地（只借思路，全部代码自写；AGPL 代码一行未碰；
   不引入 relay 后端；不做假按键；详见 patch_groupBS.py 头注释） */
(function () {
'use strict';
var CHAIN_KEY = 'phone_model_fallback_v1';
var FBKEYS_KEY = 'phone_model_fallback_keys_v1';
var MAX_FB = 3;
var REACT_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDC4D', '\uD83D\uDD25'];
/* D 批禁 emoji：回应仍按 emoji 字符串存（已存聊天记录里的回应键不能改），显示一律画 SVG；
   源码里用转义写键值，界面上不再出现 emoji 字形。自定义回应输入框见“需用户定夺”。 */
var REACT_LABELS = {};
REACT_LABELS['\u2764\uFE0F'] = '喜欢'; REACT_LABELS['\uD83D\uDE02'] = '大笑'; REACT_LABELS['\uD83D\uDE2E'] = '惊讶';
REACT_LABELS['\uD83D\uDE22'] = '难过'; REACT_LABELS['\uD83D\uDC4D'] = '点赞'; REACT_LABELS['\uD83D\uDD25'] = '火热';
var REACT_PATHS = {};
REACT_PATHS['\u2764\uFE0F'] = '<path d="M12 20.5S3.5 15 3.5 9.3C3.5 6.6 5.6 5 7.8 5c1.8 0 3.2 1 4.2 2.4C13 6 14.4 5 16.2 5c2.2 0 4.3 1.6 4.3 4.3 0 5.7-8.5 11.2-8.5 11.2Z" fill="#e5484d"/>';
REACT_PATHS['\uD83D\uDE02'] = '<circle cx="12" cy="12" r="9" fill="#ffd93b"/><path d="M7 10.5Q9 8 11 10.5M13 10.5Q15 8 17 10.5" stroke="#1e2748" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M7.5 13.5Q12 19.5 16.5 13.5Z" fill="#1e2748"/><path d="M18.5 7.5c.8.6 1 1.6.5 2.6" stroke="#7db8e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
REACT_PATHS['\uD83D\uDE2E'] = '<circle cx="12" cy="12" r="9" fill="#ffd93b"/><circle cx="9" cy="10" r="1.3" fill="#1e2748"/><circle cx="15" cy="10" r="1.3" fill="#1e2748"/><ellipse cx="12" cy="15.5" rx="2.2" ry="2.8" fill="#1e2748"/>';
REACT_PATHS['\uD83D\uDE22'] = '<circle cx="12" cy="12" r="9" fill="#ffd93b"/><path d="M7 9.5Q9 7.5 11 9.5M13 9.5Q15 7.5 17 9.5" stroke="#1e2748" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M8.5 16.5Q12 13.5 15.5 16.5" stroke="#1e2748" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M17.5 12.5c.9.8 1.2 2 .6 3.2" stroke="#7db8e8" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
REACT_PATHS['\uD83D\uDC4D'] = '<path d="M6.5 20.5v-8h11l-1.2 5.6a2 2 0 0 1-2 1.4H6.5Z" fill="#ffd93b" stroke="#1e2748" stroke-width="1.3" stroke-linejoin="round"/><path d="M9.5 12.5V5.8a1.6 1.6 0 0 1 3.2-.4l.5 3.4h2" fill="#ffd93b" stroke="#1e2748" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>';
REACT_PATHS['\uD83D\uDD25'] = '<path d="M12 2.8c1 2.6-1.6 4-1.6 6.4a3.4 3.4 0 0 0 6.8.5c0-.5-.1-1-.3-1.4.9 1.2 1.6 2.6 1.6 4.2a6.5 6.5 0 1 1-13 0c0-3.6 2.6-5.4 4-7 .5 1 1.3 1.7 2.5 1.7-.6-1.8-.5-3.3 0-4.4Z" fill="#f76b15"/>';
function reactIcon(em, size) { var p = REACT_PATHS[em]; if (!p) return ''; var s = size || 16; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" style="vertical-align:-3px" aria-hidden="true">' + p + '</svg>'; }
/* act 小卡状态图标：进行中时钟 / 完成对勾 / 失败叉号 + 展开三角。 */
var BS_CLOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
var BS_CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>';
var BS_X_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var BS_CHEV_RIGHT = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align:-2px" aria-hidden="true"><path d="M9 5l7 7-7 7Z"/></svg>';
var BS_CHEV_DOWN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align:-2px;transform:rotate(90deg)" aria-hidden="true"><path d="M9 5l7 7-7 7Z"/></svg>';
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

/* ── 1. 模型回退链（已删：备用模型与备用 key 已随「接模型」并进 API 设置而删除）──
 * 主模型不可用时不再自动切备用，只走主模型；旧的备用链/备用 key 数据还留在
 * localStorage 里也不会再被读取，导出时整条排除。 */
function getFallbackChain() { return []; }
function setFallbackChain(list) { return []; }
function getFallbackKey(id) { return ''; }
function setFallbackKey(id, key) {
    try { var m = lsGet(FBKEYS_KEY, {}); if (m && typeof m === 'object') { delete m[String(id)]; lsSet(FBKEYS_KEY, m); } } catch (e) {}
}
function fallbackKeysNote() { return ''; }

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
/* D 批禁 emoji：chip/选择器里不再出现 emoji 字形——内置 6 个回应只传下标查表，
   onclick 与 data 属性里都不再嵌 emoji 字符串；存量键仍是 emoji 字符串，不动数据。 */
function toggleReactionByIndex(sid, mid, idx) {
    var em = REACT_EMOJIS[idx];
    if (!em) return { ok: false, reason: 'not_found' };
    return toggleReaction(sid, mid, em, '我');
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
        var shown = reactIcon(em, 15) || esc(em);
        var label = bys.length > 1 ? (shown + ' ' + bys.length) : shown;
        var title = (REACT_LABELS[em] ? REACT_LABELS[em] + ' · ' : '') + bys.join('、');
        var ri = REACT_EMOJIS.indexOf(em);
        var call = ri >= 0
            ? 'WeChatAppEngine.toggleReactionByIndex(\'' + esc(sid) + '\',\'' + esc(m.id) + '\',' + ri + ')'
            : 'WeChatAppEngine.toggleReaction(\'' + esc(sid) + '\',\'' + esc(m.id) + '\',\'' + esc(em) + '\')';
        return '<button type="button" class="bs-react-chip' + (mine ? ' bs-react-mine' : '') + '" title="' + esc(title) + '" onclick="event.stopPropagation();' + call + '">' + label + '</button>';
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
    p.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:2px;">' + REACT_EMOJIS.map(function (em, i) {
        return '<button type="button" class="bs-rp-emo" data-ri="' + i + '" title="' + esc(REACT_LABELS[em] || '') + '">' + reactIcon(em, 24) + '</button>';
    }).join('') + '</div>'
        + '<div class="bs-rp-custom"><input id="bs-rp-custom" type="text" placeholder="自定义一个 emoji" maxlength="4"><button type="button" id="bs-rp-custom-btn">贴</button></div>'
        + '<button type="button" class="bs-rp-close" id="bs-rp-close">取消</button>';
    p.addEventListener('click', function (ev) {
        var t = ev.target;
        var emoBtn = (t && t.closest) ? t.closest('[data-ri]') : null;
        if (emoBtn) {
            if (_pickerTarget) toggleReactionByIndex(_pickerTarget.sid, _pickerTarget.mid, Number(emoBtn.getAttribute('data-ri')));
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
    var icon = st === 'running' ? BS_CLOCK_SVG : (st === 'done' ? BS_CHECK_SVG : BS_X_SVG);
    var title = m.title || ('正在查' + (ACT_LABELS[m.actKind] || '东西') + '…');
    return '<div class="bs-act-card bs-act-' + esc(st) + '" data-mid="' + esc(m.id) + '" onclick="WeChatAppEngine.toggleActCard(\'' + esc(m.id) + '\')">'
        + '<div class="bs-act-head"><span>' + icon + '</span><span>' + esc(title) + '</span><span class="bs-act-chev">' + (m._expanded ? BS_CHEV_DOWN : BS_CHEV_RIGHT) + '</span></div>'
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

/* ── 接线：挂到 WeChatAppEngine / PhoneModel / sendMsg 上 ── */
function wireUp() {
    try {
        if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine) {
            WeChatAppEngine.bsModelReply = bsModelReply;
            WeChatAppEngine.bsStreamAttempt = streamAttempt;
            WeChatAppEngine.toggleReaction = toggleReaction;
            WeChatAppEngine.toggleReactionByIndex = toggleReactionByIndex;
            WeChatAppEngine.charAddReaction = charAddReaction;
            WeChatAppEngine.bsReactionsHTML = reactionsHTML;
            WeChatAppEngine.openReactionPicker = openReactionPicker;
            WeChatAppEngine.closeReactionPicker = closeReactionPicker;
            WeChatAppEngine.bsActCardHTML = actCardHTML;
            WeChatAppEngine.toggleActCard = toggleActCard;
        }
    } catch (e) {}
    /* 备用 key 的导出包装已删：PhoneModel.sanitizeExportData 现直接处理统一配置的 key，旧备用 key 由 doExport 的排除清单兜底。 */
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
    toggleReaction: toggleReaction, toggleReactionByIndex: toggleReactionByIndex, charAddReaction: charAddReaction,
    reactionsHTML: reactionsHTML,
    openReactionPicker: openReactionPicker, closeReactionPicker: closeReactionPicker,
    customReaction: customReaction,
    actCardHTML: actCardHTML, toggleActCard: toggleActCard,
    runAct: runAct, runScheduleAct: runScheduleAct,
    readScheduleToday: readScheduleToday, readDiary: readDiary, readPhotos: readPhotos,
    scheduleIntent: scheduleIntent,
};
try { wireUp(); } catch (e) {}
})();
