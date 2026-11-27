
// ══════════════════════════════════════════════════════════════════════
// Y组 · 微信区（4项）+ 此刻区（5项）（GROUP-Y-WECHAT-CIKE）
// 思路出处见补丁头注释；全部为本组原创代码，未复制任何项目代码。
// P 组动作台已合入本版（window.GroupP.motion，动作 greet/wave/bow/laugh/sleep/hug），
// Y 优先调它：开心→wave、困→sleep、害羞→bow（P 无捂脸动作，bow 低头鞠躬最接近；
// P 不在、或此刻/乙游人物元素不在场调动失败时，用本组自备三个小动作兜底）。
// 情绪判定是关键词映射 + 模板，不是 AI 选择；语音是设备 speechSynthesis 调音，不是训练声。
// ══════════════════════════════════════════════════════════════════════
(function () {
'use strict';
/* D 批禁 emoji：聊天小图标改线稿 SVG（与 js/64-ui-vector-icons 的线稿风格一致，内联自带，不依赖加载顺序）。 */
var GY_CHAT_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M20 12a8 8 0 1 0-14.9 4L4 20l4.2-1.1A8 8 0 0 0 20 12Z"/></svg>';
var DAY_KEY = 'cike_char_day_v1';
var GOAL_KEY = 'char_goals_v1';
var PLAY_KEY = 'otome_play_v1';
var GARDEN_KEY = 'otome_garden_v1';
var SCHED_KEY = 'phone_schedule_v1';
var GC_KEY = 'guichao.memories.v1';
var CACHE_KEY = 'cike_cache_v1';
var DDZ_CHAT_KEY = 'groupy_ddz_chat_v1';
var MOOD_KEY = 'cike_mood_check_v1';
var AWAY_KEY = 'groupy_away_v1';
var REACT_KEY = 'groupy_reactions_v1';
var SAVED_KEY = 'groupy_saved_v1';
var _inited = false;
var _hookCalls = 0;
var _lastReaction = null;
var _lastEmotion = null;
var _lastVoice = null;
var _seenMids = {};
var _nightlyWrapped = false;

function _rd(k, fb) { try { var v = localStorage.getItem(k); if (v == null) return fb; return JSON.parse(v); } catch (e) { return fb; } }
function _wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _pad2(n) { return (n < 10 ? '0' : '') + n; }
function _todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + _pad2(d.getMonth() + 1) + '-' + _pad2(d.getDate()); }
function _dateKey(ms) { var d = new Date(ms || Date.now()); return '' + d.getFullYear() + _pad2(d.getMonth() + 1) + _pad2(d.getDate()); }
function _charName() {
  try { if (typeof SystemStore !== 'undefined' && SystemStore.get('character')) return SystemStore.get('character'); } catch (e) {}
  try { if (typeof MemoryCore !== 'undefined' && MemoryCore.world) return MemoryCore.world.get('activeChar') || '机'; } catch (e) {}
  return '机';
}
// ── 24h 日程（只读 K 组键；K 组在就用它的纯函数，否则按同一规则自己算）──
function loadDay() {
  try { if (typeof window !== 'undefined' && window.CharK && window.CharK.loadDay) return window.CharK.loadDay(); } catch (e) {}
  var d = _rd(DAY_KEY, null);
  if (d && Array.isArray(d.slots) && d.slots.length) return d;
  return null;
}
function slotForHour(day, hour) {
  if (!day || !Array.isArray(day.slots) || !day.slots.length) return null;
  try { if (typeof window !== 'undefined' && window.CharK && window.CharK.slotForHour) return window.CharK.slotForHour(day, hour); } catch (e) {}
  var idx = 0;
  day.slots.forEach(function (s, i) { if (hour >= s.hour) idx = i; });
  return day.slots[idx] || day.slots[0];
}
function slotLine(slot) {
  if (!slot) return '';
  return '在' + slot.place + '，' + slot.activity + '。';
}

// ══════════ W2 · 情绪关键词 → 动作 + 语音合成音调（关键词映射 + 模板） ══════════
var EMOTIONS = {
  happy: { label: '开心', action: 'wave', emoji: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd93b"/><circle cx="9" cy="10" r="1.5" fill="#1e2748"/><circle cx="15" cy="10" r="1.5" fill="#1e2748"/><path d="M8 14 Q12 18 16 14" stroke="#1e2748" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>', cls: 'gy-wave', voice: { pitch: 1.4, rate: 1.1, volume: 1 } },
  sleepy: { label: '困', action: 'yawn', emoji: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px" aria-hidden="true"><path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 0 1 15 3 Z" fill="#bfc8e0"/></svg>', cls: 'gy-yawn', voice: { pitch: 0.8, rate: 0.8, volume: 0.9 } },
  shy: { label: '害羞', action: 'cover', emoji: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffe3c4"/><circle cx="9" cy="10" r="1.4" fill="#1e2748"/><circle cx="15" cy="10" r="1.4" fill="#1e2748"/><circle cx="7.5" cy="14" r="2" fill="#e8a0a8"/><circle cx="16.5" cy="14" r="2" fill="#e8a0a8"/><path d="M10 16.5 Q12 17.5 14 16.5" stroke="#1e2748" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>', cls: 'gy-cover', voice: { pitch: 1.2, rate: 0.95, volume: 0.7 } }
};
function emotionFor(text) {
  var t = String(text || '');
  if (!t) return null;
  if (/害羞|脸红|不好意思|\/害羞|羞羞/.test(t)) return 'shy';
  if (/困|想睡|晚安|好累|熬夜|睡着|打哈欠/.test(t)) return 'sleepy';
  if (/开心|哈哈|好耶|太棒了|高兴|嘻嘻|\uD83D\uDE04|\uD83D\uDE06|\uD83C\uDF89|真好/.test(t)) return 'happy';
  return null;
}
function speakWithEmotion(text, emotion, opts) {
  var em = EMOTIONS[emotion] || EMOTIONS.happy;
  var voice = em.voice;
  _lastVoice = { emotion: emotion, pitch: voice.pitch, rate: voice.rate, volume: voice.volume, text: String(text || '').slice(0, 120) };
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return { ok: false, reason: 'no_tts', voice: voice };
    if (opts && opts.silent) return { ok: false, reason: 'silent', voice: voice };
    var u = new window.SpeechSynthesisUtterance(String(text || '').slice(0, 120));
    u.lang = 'zh-CN'; u.pitch = voice.pitch; u.rate = voice.rate; u.volume = voice.volume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return { ok: true, voice: voice };
  } catch (e) { return { ok: false, reason: 'tts_error', voice: voice }; }
}
function playEmotionAction(emotion, opts) {
  opts = opts || {};
  var em = EMOTIONS[emotion];
  if (!em) return { ok: false, reason: 'no_emotion' };
  _lastEmotion = { emotion: emotion, action: em.action, label: em.label, voice: em.voice, ts: Date.now() };
  // P 组动作台已合入时优先调它（动态探测，不依赖合入顺序；映射见文件头注释）
  // P 的 motion(act, where) 在人物元素不在场时返回 false，失败则落到 Y 自备动作兜底
  var P_ACT = { wave: 'wave', yawn: 'sleep', cover: 'bow' };
  try {
    if (typeof window !== 'undefined' && window.GroupP && typeof window.GroupP.motion === 'function') {
      var pAct = P_ACT[em.action] || 'wave';
      var pOk = false;
      try { pOk = window.GroupP.motion(pAct, 'cike') === true; } catch (e) {}
      if (!pOk) { try { pOk = window.GroupP.motion(pAct) === true; } catch (e) {} }
      if (pOk) {
        if (opts.speak) speakWithEmotion(opts.text || '', emotion, opts);
        return { ok: true, via: 'groupP', emotion: emotion, action: em.action, pAction: pAct, voice: em.voice };
      }
    }
  } catch (e) {}
  // 自备三个小动作：反应气泡里的小人 + CSS 动画
  try {
    var chip = document.getElementById('groupy-reaction');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'groupy-reaction';
      document.body.appendChild(chip);
    }
    chip.innerHTML = '<span id="groupy-char-stage" class="' + em.cls + '">' + em.emoji + '</span><span> ' + _esc(opts.text ? String(opts.text).slice(0, 40) : em.label) + '</span>';
    chip.classList.add('gy-show');
    var stage = document.getElementById('groupy-char-stage');
    if (stage) { void stage.offsetWidth; }
    if (chip._gyTimer) clearTimeout(chip._gyTimer);
    chip._gyTimer = setTimeout(function () { try { chip.classList.remove('gy-show'); } catch (e) {} }, 2600);
  } catch (e) {}
  if (opts.speak) speakWithEmotion(opts.text || '', emotion, opts);
  return { ok: true, via: 'groupY', emotion: emotion, action: em.action, voice: em.voice };
}
function reactToCharText(text) {
  var em = emotionFor(text);
  if (!em) return { ok: false, reason: 'no_emotion' };
  return playEmotionAction(em, { text: text, speak: false });
}

// ══════════ W1 · 斗地主桌边聊天：独立通道，不碰棋盘状态 ══════════
function ddzChatLoad() { var a = _rd(DDZ_CHAT_KEY, []); return Array.isArray(a) ? a : []; }
function ddzChatSave(a) { return _wr(DDZ_CHAT_KEY, a); }
var DDZ_CHAT_REPLIES = ['哈哈，这把我手气不错。', '嗯嗯，边打边聊。', '这手牌……让我想想。', '你出得真好，我管不上。'];
function ddzSendChat(text, who) {
  var t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  who = who === 'char' ? 'char' : 'me';
  var chat = ddzChatLoad();
  chat.push({ id: 'gyc_' + Date.now() + '_' + chat.length, who: who, text: t.slice(0, 140), ts: Date.now() });
  if (who === 'me') {
    // char 只在聊天通道里回一句，不调任何斗地主函数、不改棋盘状态。
    // 模板回复必须在界面上可见标注（见 ddzChatHtml 的“模板回复 · 未接模型”角标）；
    // 斗地主桌边聊天没有人物记录可接模型，暂不走模型。
    var reply = /哈哈|好笑|笑死/.test(t) ? DDZ_CHAT_REPLIES[0] : DDZ_CHAT_REPLIES[chat.length % DDZ_CHAT_REPLIES.length];
    chat.push({ id: 'gyc_' + (Date.now() + 1) + '_r', who: 'char', text: reply, via: 'template', ts: Date.now() + 1 });
  }
  if (chat.length > 50) chat = chat.slice(-50);
  ddzChatSave(chat);
  try { ddzRenderChat(); } catch (e) {}
  return { ok: true, count: chat.length, chat: chat };
}
function ddzChatHtml() {
  var chat = ddzChatLoad().slice(-6);
  var lines = chat.length ? chat.map(function (m) {
    return '<div>' + (m.who === 'me' ? '你：' : _esc(_charName()) + '：') + _esc(m.text) + (m.who === 'char' && m.via === 'template' ? ' <span class="gy-muted">模板回复 · 未接模型</span>' : '') + '</div>';
  }).join('') : '<div class="gy-muted">桌边聊天 · 还没人说话，先打个招呼吧。</div>';
  return '<div class="groupy-ddz-chat" id="groupy-ddz-chat"><div style="font-weight:700;">' + GY_CHAT_SVG + ' 桌边聊天 <span class="gy-muted">独立通道 · 只聊天，不改牌局 · 模板回复 · 未接模型</span></div>'
    + '<div class="gy-lines">' + lines + '</div>'
    + '<div style="display:flex;gap:6px;"><input id="groupy-ddz-input" placeholder="边打边聊…" style="flex:1;border:1px solid #e8d5c0;border-radius:10px;padding:6px 8px;font-size:12px;">'
    + '<button type="button" onclick="window.GroupY && window.GroupY.ddzSendChatFromInput()">发送</button></div></div>';
}
function ddzRenderChat() {
  var host = document.getElementById('groupy-ddz-chat');
  if (!host) return false;
  var tmp = document.createElement('div');
  tmp.innerHTML = ddzChatHtml();
  host.outerHTML = tmp.firstChild.outerHTML;
  return true;
}
function ddzSendChatFromInput() {
  var inp = document.getElementById('groupy-ddz-input');
  if (!inp || !inp.value.trim()) return { ok: false, reason: 'empty' };
  var v = inp.value;
  inp.value = '';
  return ddzSendChat(v, 'me');
}

// ══════════ W3 · 事件总线钩子：一个入口，监听已有的 app 切换与消息发送 ══════════
function todayMood() { var r = _rd(MOOD_KEY, null); if (r && r.date === _todayStr()) return r; return null; }
function tonePrefix() {
  var m = todayMood();
  if (!m) return '';
  if (m.mood === '低落' || m.mood === '烦躁') return '慢慢来，';
  if (m.mood === '困') return '小声说一句，';
  return '';
}
function reactionText(type, detail) {
  detail = detail || {};
  var pre = tonePrefix();
  if (type === 'wechat-sent') return pre + '收到，你发过去啦。';
  /* GROUP-FIX · 17：打开 / 离开 app 不再播报她的行为。app-open / app-leave
     不再产生反应文本——角色状态只在她自己的生活模拟里自然变化。
     reactionText 保留 wechat-sent 等其它类型；reactToEvent 对空文本
     本来就返回 { ok:false, reason:'no_reaction' }，不写日志、不出气泡。 */
  if (type === 'app-open' || type === 'app-leave') return '';
  return '';
}
function reactToEvent(type, detail) {
  _hookCalls++;
  var text = reactionText(type, detail || {});
  if (!text) return { ok: false, reason: 'no_reaction', calls: _hookCalls };
  var rec = { ts: Date.now(), event: type, appId: (detail && detail.appId) || '', text: text };
  _lastReaction = rec;
  var log = _rd(REACT_KEY, []);
  if (!Array.isArray(log)) log = [];
  log.push(rec);
  if (log.length > 30) log = log.slice(-30);
  _wr(REACT_KEY, log);
  try {
    var chip = document.getElementById('groupy-reaction');
    if (!chip) { chip = document.createElement('div'); chip.id = 'groupy-reaction'; document.body.appendChild(chip); }
    chip.innerHTML = '<span class="gy-emo">' + GY_CHAT_SVG + '</span><span>' + _esc(text) + '</span>';
    chip.classList.add('gy-show');
    if (chip._gyTimer) clearTimeout(chip._gyTimer);
    chip._gyTimer = setTimeout(function () { try { chip.classList.remove('gy-show'); } catch (e) {} }, 2600);
  } catch (e) {}
  try { if (typeof EventBus !== 'undefined' && EventBus && EventBus.emit) EventBus.emit('groupy:reaction', rec); } catch (e) {}
  return { ok: true, text: text, calls: _hookCalls };
}
/* GROUP-FIX · 17：打开 app 不再播报。保留导出名（window.GroupY 导出与
   外部调用点不变），函数本身不再做任何事、不写日志、不出气泡。 */
function onActiveAppChange(prevId, nextId) {
  return [];
}
function initObservers() {
  if (typeof MutationObserver === 'undefined' || !document.body) return { ok: false, reason: 'no_observer' };
  /* GROUP-FIX · 17：删掉盯住 #sys-app-host 的 app 切换观察器（appOb）——
     打开 app 不再触发任何播报。消息流观察器（msgOb，wechat-sent）与
     其它主动行为（主动消息、朋友圈等）一律不动。 */
  // 发微信 / char 回消息：盯住消息流；自己的消息走事件钩子，char 的消息走情绪映射
  try {
    var stream = document.getElementById('wx-msg-stream-container');
    if (stream) {
      var msgOb = new MutationObserver(function () {
        var rows = stream.querySelectorAll('.wx-msg-row');
        rows.forEach(function (row) {
          var mid = row.getAttribute('data-mid') || '';
          if (!mid || _seenMids[mid]) return;
          _seenMids[mid] = 1;
          var isSelf = row.className.indexOf('wx-self') >= 0;
          var txt = (row.textContent || '').trim();
          if (isSelf) { try { reactToEvent('wechat-sent', { text: txt.slice(0, 60) }); } catch (e) {} }
          else if (txt) { try { reactToCharText(txt); } catch (e) {} }
        });
      });
      msgOb.observe(stream, { childList: true, subtree: true });
    }
  } catch (e) {}
  // 此刻首页挂载：#groupy-cike-home 一出现就渲染 Y 面板并写开场问候
  try {
    var bodyOb = new MutationObserver(function () {
      try {
        var home = document.getElementById('groupy-cike-home');
        if (home && !home.getAttribute('data-gy-rendered')) renderCikeHome(home);
        var g = document.getElementById('ck-char-greet');
        if (g && !g.getAttribute('data-gy-greeted')) { g.textContent = greetingFor(new Date().getHours(), slotForHour(loadDay(), new Date().getHours())); g.setAttribute('data-gy-greeted', '1'); }
        appendAwayChip();
      } catch (e) {}
    });
    bodyOb.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
  return { ok: true };
}

// ══════════ W4 · 对话级“存为记忆”：只写真实消息摘要，不编造、不伪造好感 ══════════
function currentSession() {
  try {
    if (typeof AppRegistry !== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) {
      var store = AppRegistry.wechat.wxStore;
      var sess = (store.sessions || []).find(function (s) { return s.id === store.currentChatId; });
      return sess || null;
    }
  } catch (e) {}
  return null;
}
function categoryFor(text) {
  var t = String(text || '');
  if (/喜欢|想你|约会|见面|表白|爱你|想见|抱抱/.test(t)) return 'relationship';
  if (/学习|工作|读书|考试|进步|目标|跑步|健身|练琴/.test(t)) return 'growth';
  return 'daily';
}
function buildMemorySummary(sess) {
  var msgs = (sess.messages || []).filter(function (m) {
    return m && m.type !== 'time_gap' && m.type !== 'recall' && typeof m.content === 'string' && m.content.trim();
  }).slice(-8);
  var lines = msgs.map(function (m) {
    var who = m.sender === '我' ? '你' : (m.sender || sess.name || '他');
    return who + '：' + String(m.content).slice(0, 60);
  });
  var now = new Date();
  var dateLabel = (now.getMonth() + 1) + '月' + now.getDate() + '日';
  return {
    title: '微信对话 · ' + (sess.name || '他') + ' · ' + dateLabel,
    category: categoryFor(lines.join(' ')),
    content: '来源：微信对话（' + (sess.name || '') + '）\n时间：' + now.getFullYear() + '-' + _pad2(now.getMonth() + 1) + '-' + _pad2(now.getDate()) + ' ' + _pad2(now.getHours()) + ':' + _pad2(now.getMinutes()) + '\n---\n' + lines.join('\n'),
    count: msgs.length
  };
}
function saveChatToGuichao(sess) {
  sess = sess || currentSession();
  if (!sess) return { ok: false, reason: 'no_session' };
  var sum = buildMemorySummary(sess);
  if (sum.count < 2) return { ok: false, reason: 'too_short' };
  var refs = _rd(SAVED_KEY, []);
  if (!Array.isArray(refs)) refs = [];
  var dup = refs.find(function (r) { return r.sessionId === sess.id && r.msgCount === sum.count && r.date === _todayStr(); });
  if (dup) return { ok: false, reason: 'already_saved', id: dup.id };
  var gc = _rd(GC_KEY, []);
  if (!Array.isArray(gc)) return { ok: false, reason: 'guichao_shape' };
  var now = Date.now();
  var mem = { id: 'gy_' + now.toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36), title: sum.title, category: sum.category, content: sum.content, created: now, updated: now, source: '微信对话' };
  gc.push(mem);
  if (!_wr(GC_KEY, gc)) return { ok: false, reason: 'write_failed' };
  refs.unshift({ id: mem.id, sessionId: sess.id, date: _todayStr(), msgCount: sum.count, title: sum.title });
  _wr(SAVED_KEY, refs.slice(0, 20));
  try { if (typeof alert === 'function') alert('已存为记忆：' + sum.title); } catch (e) {}
  return { ok: true, id: mem.id, category: sum.category, title: sum.title, count: sum.count };
}

// ══════════ C4 · 开场问候：按当前小时 + 日程格 ══════════
function greetingFor(hour, slot) {
  var g = hour >= 5 && hour < 9 ? '早上好' : hour >= 9 && hour < 12 ? '上午好' : hour >= 12 && hour < 14 ? '中午好' : hour >= 14 && hour < 18 ? '下午好' : hour >= 18 && hour < 23 ? '晚上好' : '夜深了';
  var name = _charName();
  if (slot && slot.place) {
    if (slot.place === '家' || slot.place === '家里') return g + '，我刚回到家，' + slot.activity + '。';
    return g + '，我刚到' + slot.place + '，' + slot.activity + '。';
  }
  return g + '，我是' + name + '。';
}

// ══════════ C1 · 状态面板：日程格 / 小目标 / 背包·金币（一眼可见，注明来源） ══════════
function statusPanelData(nowMs) {
  var now = new Date(nowMs || Date.now());
  var day = loadDay();
  var slot = slotForHour(day, now.getHours());
  var goals = _rd(GOAL_KEY, []);
  var goal = null;
  if (Array.isArray(goals)) goal = goals.find(function (g) { return g && g.status === 'active'; }) || goals[0] || null;
  var play = _rd(PLAY_KEY, {});
  var garden = _rd(GARDEN_KEY, {});
  var fishCaught = (play && Array.isArray(play.caught)) ? play.caught.length : 0;
  var gardenPlanted = 0;
  try {
    if (garden && Array.isArray(garden.plots)) gardenPlanted = garden.plots.filter(function (p) { return p && p.crop; }).length;
    else if (garden && typeof garden === 'object') gardenPlanted = Object.keys(garden).length;
  } catch (e) {}
  var ddzScore = (play && typeof play.ddzScore === 'number') ? play.ddzScore : 0;
  // 番茄金币：W 组键在本版文件里不存在，查不到就如实记 0，不编数字
  var coins = (play && typeof play.coins === 'number') ? play.coins : 0;
  var coinsNote = (play && typeof play.coins === 'number') ? '来源：otome_play_v1' : '来源：番茄金币（W 组）未合入，暂记 0';
  return {
    slot: slot ? { hour: slot.hour, place: slot.place, activity: slot.activity } : null,
    slotSource: day ? 'cike_char_day_v1' : '未设置',
    goal: goal ? { title: goal.title, progress: goal.progress || 0, status: goal.status } : null,
    goalSource: 'char_goals_v1',
    backpack: { fishCaught: fishCaught, gardenPlanted: gardenPlanted, ddzScore: ddzScore },
    backpackSource: 'otome_play_v1 / otome_garden_v1',
    coins: coins, coinsNote: coinsNote
  };
}

// ══════════ C2 · “我们的一天”：用户日程与 char 日程在同一时间轴对照 ══════════
function dayViewData(nowMs) {
  var now = new Date(nowMs || Date.now());
  var today = _todayStr(now);
  var day = loadDay();
  var slots = (day && Array.isArray(day.slots)) ? day.slots.slice().sort(function (a, b) { return a.hour - b.hour; }) : [];
  var mine = _rd(SCHED_KEY, []);
  if (!Array.isArray(mine)) mine = [];
  var todays = mine.filter(function (it) { return it && it.date === today; }).map(function (it) {
    var hm = String(it.time || '00:00').split(':');
    return { hour: parseInt(hm[0], 10) || 0, minute: parseInt(hm[1], 10) || 0, time: it.time || '', title: it.title || '' };
  }).sort(function (a, b) { return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute); });
  var rows = slots.map(function (s, i) {
    var nextHour = (i + 1 < slots.length) ? slots[i + 1].hour : 24;
    var mineHere = todays.filter(function (t) { return t.hour >= s.hour && t.hour < nextHour; });
    return { hour: s.hour, charPlace: s.place, charActivity: s.activity, mine: mineHere };
  });
  return { date: today, rows: rows, mineCount: todays.length, charCount: slots.length };
}

// ══════════ C3 · 心情 / 能量打卡：存新键；进日记素材，也调主动消息语气 ══════════
var MOODS = ['开心', '平静', '低落', '烦躁', '困'];
function moodCheckin(mood, energy, dateStr) {
  if (MOODS.indexOf(mood) < 0) return { ok: false, reason: 'bad_mood' };
  energy = parseInt(energy, 10);
  if (!(energy >= 1 && energy <= 5)) return { ok: false, reason: 'bad_energy' };
  var rec = { date: dateStr || _todayStr(), mood: mood, energy: energy, ts: Date.now() };
  if (!_wr(MOOD_KEY, rec)) return { ok: false, reason: 'write_failed' };
  try { renderCikeHome(); } catch (e) {}
  return { ok: true, record: rec };
}
function moodDiaryLine(dateStr) {
  var r = _rd(MOOD_KEY, null);
  if (!r || r.date !== (dateStr || _todayStr())) return '';
  return '今天心情打卡：' + r.mood + '，能量 ' + r.energy + '/5。';
}
function proactiveTone() {
  var m = todayMood();
  if (!m) return { tone: 'normal', prefix: '' };
  if (m.mood === '低落' || m.mood === '烦躁') return { tone: 'gentle', prefix: '慢慢来，' };
  if (m.mood === '困') return { tone: 'soft', prefix: '小声说一句，' };
  if (m.mood === '开心') return { tone: 'bright', prefix: '' };
  return { tone: 'normal', prefix: '' };
}
function installNightlyHook() {
  if (_nightlyWrapped) return { ok: false, reason: 'already' };
  try {
    if (typeof window === 'undefined' || !window.CharInnerLife || typeof window.CharInnerLife.nightlyConsolidate !== 'function') return { ok: false, reason: 'no_innerlife' };
    var orig = window.CharInnerLife.nightlyConsolidate;
    window.CharInnerLife.nightlyConsolidate = function (now, opts) {
      var r = orig.apply(window.CharInnerLife, arguments);
      try {
        if (r && r.done && r.key) {
          var line = moodDiaryLine(_todayStr(now || new Date()));
          if (line) {
            var cache = _rd(CACHE_KEY, {});
            if (cache[r.key] && String(cache[r.key]).indexOf('心情打卡') < 0) {
              cache[r.key] = cache[r.key] + '\n' + line;
              _wr(CACHE_KEY, cache);
            }
          }
        }
      } catch (e) {}
      return r;
    };
    _nightlyWrapped = true;
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'hook_error' }; }
}

// ══════════ C5 · char 不在场时：NPC 下棋 + 宠物玩耍，确定性规则生成，回来摘要 ══════════
function _lcg(seed) { var s = (seed || 1) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function awayNow(nowMs) {
  var now = new Date(nowMs || Date.now());
  var slot = slotForHour(loadDay(), now.getHours());
  if (!slot) return { away: false, reason: 'no_day', slot: null };
  var away = !(slot.place === '家' || slot.place === '家里');
  return { away: away, slot: { hour: slot.hour, place: slot.place, activity: slot.activity } };
}
function simulateAway(nowMs, opts) {
  opts = opts || {};
  var now = new Date(nowMs || Date.now());
  var date = _todayStr(now);
  var existing = _rd(AWAY_KEY, null);
  if (existing && existing.date === date && !opts.force) return { ok: true, cached: true, summary: existing };
  var seedNum = parseInt(_dateKey(nowMs), 10) || 1;
  var rnd = _lcg(seedNum);
  var moves = 12 + Math.floor(rnd() * 20);
  var winner = rnd() < 0.5 ? '阿九' : '阿七';
  var petActions = ['在花园里追了蝴蝶', '在窗台上晒太阳打了个盹', '把毛线球推到了沙发底下', '围着花园跑了三圈'];
  var pet = petActions[Math.floor(rnd() * petActions.length)];
  var summary = {
    date: date,
    summary: '你不在时，阿九和阿七下了一盘棋，' + winner + '赢了（' + moves + '手）；猫' + pet + '。',
    chess: { white: '阿九', black: '阿七', winner: winner, moves: moves },
    pet: { action: pet },
    generatedTs: Date.now(),
    note: '小世界推演 · 确定性规则生成（按日期出固定结果），不编造 char 的行踪'
  };
  _wr(AWAY_KEY, summary);
  return { ok: true, cached: false, summary: summary };
}
function appendAwayChip() {
  try {
    var tl = document.getElementById('ck-timeline');
    if (!tl || tl.querySelector('.groupy-away-chip')) return false;
    var a = _rd(AWAY_KEY, null);
    if (!a || a.date !== _todayStr()) return false;
    var chip = document.createElement('div');
    chip.className = 'groupy-away-chip';
    chip.textContent = '你不在时 · ' + a.summary;
    tl.appendChild(chip);
    return true;
  } catch (e) { return false; }
}

// ══════════ 此刻首页 Y 面板渲染 ══════════
function statusPanelHtml(nowMs) {
  var d = statusPanelData(nowMs);
  var slotLine = d.slot ? ('现在 · ' + d.slot.hour + '点 · ' + d.slot.place + ' · ' + d.slot.activity) : '暂无日程';
  var goalLine = d.goal ? (d.goal.title + ' · ' + d.goal.progress + '%') : '暂无进行中的小目标';
  return '<div class="groupy-panel" id="groupy-status"><h4>他现在的状态</h4>'
    + '<div>' + _esc(slotLine) + ' <span class="gy-muted">（' + _esc(d.slotSource) + '）</span></div>'
    + '<div>小目标：' + _esc(goalLine) + ' <span class="gy-muted">（' + _esc(d.goalSource) + '）</span></div>'
    + '<div>背包：花园 ' + d.backpack.gardenPlanted + ' 株 · 钓到 ' + d.backpack.fishCaught + ' 条 · 斗地主 ' + d.backpack.ddzScore + ' 分 <span class="gy-muted">（' + _esc(d.backpackSource) + '）</span></div>'
    + '<div>金币：' + d.coins + ' <span class="gy-muted">（' + _esc(d.coinsNote) + '）</span></div></div>';
}
function dayViewHtml(nowMs) {
  var d = dayViewData(nowMs);
  var rows = d.rows.length ? d.rows.map(function (r) {
    var mine = r.mine.length ? r.mine.map(function (t) { return _esc(t.time + ' ' + t.title); }).join('；') : '—';
    return '<div class="gy-row"><div class="gy-time">' + r.hour + '点</div><div style="flex:1;">他：' + _esc(r.charPlace + ' · ' + r.charActivity) + '<br>我：' + mine + '</div></div>';
  }).join('') : '<div class="gy-muted">char 今天还没有日程（cike_char_day_v1 未设置）。</div>';
  return '<div class="groupy-panel" id="groupy-dayview"><h4>我们的一天</h4>'
    + '<div class="gy-muted">同一时间轴对照 · 上面是他，下面是你' + (d.mineCount ? '' : '（你今天还没有日程）') + '</div>' + rows + '</div>'; /* GROUP-FIX7：日程 app 已删，去掉指引 */
}
function moodHtml() {
  var r = todayMood();
  var line = moodDiaryLine();
  var btns = MOODS.map(function (m) {
    return '<button type="button" class="' + (r && r.mood === m ? 'gy-on' : '') + '" onclick="window.GroupY && window.GroupY.moodCheckin(\'' + m + '\', (window.GroupY && window.GroupY._todayEnergy()) || 3)">' + m + '</button>';
  }).join('');
  var energies = [1, 2, 3, 4, 5].map(function (n) {
    return '<button type="button" class="' + (r && r.energy === n ? 'gy-on' : '') + '" onclick="window.GroupY && window.GroupY.moodCheckin((window.GroupY && window.GroupY._todayMood()) || \'平静\', ' + n + ')">' + n + '</button>';
  }).join('');
  return '<div class="groupy-panel" id="groupy-mood"><h4>今天的心情打卡</h4>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + btns + '</div>'
    + '<div style="margin-top:6px;">能量：' + energies + ' <span class="gy-muted">（1 很累 ～ 5 满格）</span></div>'
    + (r ? '<div style="margin-top:6px;">今天已打卡：' + _esc(r.mood) + ' · 能量 ' + r.energy + '/5</div>' : '<div class="gy-muted" style="margin-top:6px;">每天点一次，打卡会进今晚日记的素材，也会让他的主动消息语气变温柔一点。</div>')
    + (line ? '<div class="gy-muted" style="margin-top:4px;">日记素材：' + _esc(line) + '</div>' : '') + '</div>';
}
function awayHtml(nowMs) {
  var a = _rd(AWAY_KEY, null);
  var st = awayNow(nowMs);
  var btn = '<button type="button" onclick="window.GroupY && window.GroupY.simulateAway(Date.now(), {force:true}) && window.GroupY.renderCikeHome()">看看他不在时发生了什么</button>';
  var body = (a && a.date === _todayStr(new Date(nowMs || Date.now())))
    ? '<div style="margin-top:6px;">' + _esc(a.summary) + '</div><div class="gy-muted">' + _esc(a.note) + '</div>'
    : '<div class="gy-muted" style="margin-top:6px;">他现在' + (st.slot ? ('在' + _esc(st.slot.place)) : '行踪未知') + '。点一下，推演一盘 NPC 棋 + 宠物玩耍，回来就能看到摘要。</div>';
  return '<div class="groupy-panel" id="groupy-away"><h4>你不在时的小世界</h4>' + body + '<div style="margin-top:8px;">' + btn + '</div></div>';
}
function renderCikeHome(root) {
  var host = root || document.getElementById('groupy-cike-home');
  if (!host) return false;
  var nowMs = Date.now();
  host.innerHTML = '<div style="font-size:14px;font-weight:800;color:#3a1e14;margin:2px;">' + _esc(greetingFor(new Date(nowMs).getHours(), slotForHour(loadDay(), new Date(nowMs).getHours()))) + '</div>'
    + statusPanelHtml(nowMs) + dayViewHtml(nowMs) + moodHtml() + awayHtml(nowMs);
  host.setAttribute('data-gy-rendered', '1');
  try {
    var g = document.getElementById('ck-char-greet');
    if (g) { g.textContent = greetingFor(new Date(nowMs).getHours(), slotForHour(loadDay(), new Date(nowMs).getHours())); g.setAttribute('data-gy-greeted', '1'); }
  } catch (e) {}
  try { appendAwayChip(); } catch (e) {}
  return true;
}

function init() {
  if (_inited) return { ok: false, reason: 'already' };
  _inited = true;
  try { installNightlyHook(); } catch (e) {}
  try { initObservers(); } catch (e) {}
  try { renderCikeHome(); } catch (e) {}
  return { ok: true };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

window.GroupY = {
  emotionFor: emotionFor, playEmotionAction: playEmotionAction, reactToCharText: reactToCharText,
  speakWithEmotion: speakWithEmotion, EMOTIONS: EMOTIONS,
  ddzChatLoad: ddzChatLoad, ddzSendChat: ddzSendChat, ddzChatHtml: ddzChatHtml,
  ddzRenderChat: ddzRenderChat, ddzSendChatFromInput: ddzSendChatFromInput,
  reactToEvent: reactToEvent, reactionText: reactionText, onActiveAppChange: onActiveAppChange,
  initObservers: initObservers, tonePrefix: tonePrefix,
  currentSession: currentSession, categoryFor: categoryFor, buildMemorySummary: buildMemorySummary,
  saveChatToGuichao: saveChatToGuichao,
  greetingFor: greetingFor, slotForHour: slotForHour, loadDay: loadDay,
  statusPanelData: statusPanelData, statusPanelHtml: statusPanelHtml,
  dayViewData: dayViewData, dayViewHtml: dayViewHtml,
  moodCheckin: moodCheckin, moodDiaryLine: moodDiaryLine, proactiveTone: proactiveTone,
  installNightlyHook: installNightlyHook,
  awayNow: awayNow, simulateAway: simulateAway, appendAwayChip: appendAwayChip,
  renderCikeHome: renderCikeHome, init: init,
  _todayMood: function () { var r = todayMood(); return r ? r.mood : null; },
  _todayEnergy: function () { var r = todayMood(); return r ? r.energy : 3; },
  _hookCalls: function () { return _hookCalls; },
  _lastReaction: function () { return _lastReaction; },
  _lastEmotion: function () { return _lastEmotion; },
  _lastVoice: function () { return _lastVoice; },
  _keys: { ddzChat: DDZ_CHAT_KEY, mood: MOOD_KEY, away: AWAY_KEY, reactions: REACT_KEY, saved: SAVED_KEY }
};
})();
