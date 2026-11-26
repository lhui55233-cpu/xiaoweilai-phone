
/* GROUP-BR · 微信群聊端到端补齐
   统一成员字段 members（名字数组），groupMembers 只作兼容镜像；
   群回复：轮流回 / @ 指定人回 / 接模型走模型+世界书 / 未接走模板并标注；
   群头像拼图（有图用图，无图首字占位，不用假头像）；
   群资料页：改群名 / 群公告 / 成员列表 / 邀请 / 移除 / 退出·解散（备份说明）；
   退出/解散备份进 phone_wx_group_backup_v1（本组唯一新增键）；
   群对话进候选记忆审阅：只产候选（GroupAN），用户确认才入库。
   全部新写代码，未抄任何第三方代码。 */
window.GroupBR = (() => {
'use strict';
var MARK = 'GROUP-BR';
var BACKUP_KEY = 'phone_wx_group_backup_v1';
var CAND_KEY = 'phone_an_candidates_v1';
var activeGroupId = '';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function wxStore() {
  try {
    if (typeof AppRegistry !== 'undefined' && AppRegistry && AppRegistry['wechat']) return AppRegistry['wechat'].wxStore || null;
  } catch (e) {}
  return null;
}
function curSess() {
  var st = wxStore();
  if (!st) return null;
  return (st.sessions || []).find(function (s) { return s.id === st.currentChatId; }) || null;
}
function persist() {
  var st = wxStore();
  if (st && typeof st._persist === 'function') { try { st._persist(); } catch (e) {} }
}
function render() {
  try { if (window.WeChatAppEngine && window.WeChatAppEngine.renderUpdates) window.WeChatAppEngine.renderUpdates(); } catch (e) {}
}
function toast(t) {
  try { if (window.WeChatAppEngine && window.WeChatAppEngine.triggerToast) window.WeChatAppEngine.triggerToast(t); } catch (e) {}
}

/* ── 成员字段归一化：members 为准，groupMembers 镜像 ── */
function normalizeGroup(sess) {
  if (!sess || !sess.isGroup) return sess;
  var m = Array.isArray(sess.members) ? sess.members.slice() : [];
  if (!m.length && Array.isArray(sess.groupMembers)) m = sess.groupMembers.slice();
  m = m.filter(function (x, i) { return typeof x === 'string' && x && m.indexOf(x) === i; });
  sess.members = m;
  sess.groupMembers = m.slice();
  if (sess.groupNotice == null) sess.groupNotice = '';
  return sess;
}
function normalizeAll() {
  var st = wxStore();
  if (!st) return;
  (st.sessions || []).forEach(function (s) { if (s && s.isGroup) normalizeGroup(s); });
}
function groupMemberNames(sess) {
  if (!sess) return [];
  normalizeGroup(sess);
  return (sess.members || []).slice();
}

/* ── 群头像拼图：成员头像 2x2，有图用图，无图首字占位 ── */
function groupAvatarHTML(sess) {
  var names = groupMemberNames(sess).slice(0, 4);
  var st = wxStore();
  function tile(name) {
    var ms = null;
    if (st) ms = (st.sessions || []).find(function (s) { return !s.isGroup && s.name === name; }) || null;
    if (ms && ms.avatarImg) return '<img src="' + esc(ms.avatarImg) + '" style="width:100%;height:100%;object-fit:cover;display:block;">';
    var ch = esc((name || '?').charAt(0));
    var h = 0;
    for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return '<div style="width:100%;height:100%;background:hsl(' + h + ',42%,62%);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;">' + ch + '</div>';
  }
  var cells = names.map(function (n) { return '<div style="overflow:hidden;border-radius:2px;">' + tile(n) + '</div>'; });
  var target = names.length <= 2 ? 2 : 4;
  while (cells.length < target) cells.push('<div style="background:#e8e8e8;border-radius:2px;"></div>');
  var rows = names.length <= 2 ? '1fr' : '1fr 1fr';
  return '<div class="wx-br-group-avatar" data-br-group="' + esc(sess.id || '') + '" style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:' + rows + ';gap:1px;background:#ededed;border-radius:6px;overflow:hidden;">' + cells.join('') + '</div>';
}

/* ── 模板回复：按发言人的人设（wordBank）取风格，不写死台词 ── */
var POOLS = {
  greet: ['在呢，怎么了？', '来了来了，刚看到。', '嗯，我在听。'],
  question: ['这个问题我得想想，你先说说你的看法？', '我觉得可以，回头再细聊。', '问得好，我暂时没答案，不过可以一起琢磨。'],
  sleep: ['早点睡，别熬了。', '困了就睡，明天再说。', '晚安，明天见。'],
  food: ['听起来不错，下次一起去吃。', '我也饿了，说得我都馋了。', '这个我熟，好吃的。'],
  mood: ['我在呢，慢慢说。', '别一个人扛着，我们都在。', '听起来挺不容易的，抱抱。'],
  mission: ['辛苦了，回来好好休息。', '搞定了就好，厉害。', '注意安全，等你消息。'],
  image: ['这张拍得挺好。', '看到了，有意思。', '这张不错，留着。'],
  rich: ['收到了。', '看到了，谢谢。', '这个我收下了。'],
  def: ['嗯，我听到了。', '这样啊，继续说。', '有道理，再展开说说？']
};
function topicOf(t) {
  t = String(t || '');
  if (/\[图片\]/.test(t)) return 'image';
  if (/\[(转账|红包|投票|位置|文件)\]/.test(t)) return 'rich';
  if (/你好|在吗|在么|hi\b|hello/i.test(t)) return 'greet';
  if (/睡|困|熬夜|失眠|晚安/.test(t)) return 'sleep';
  if (/吃|饿|好吃|馋|点心|外卖/.test(t)) return 'food';
  if (/难受|烦|不开心|崩|累|压抑|郁闷/.test(t)) return 'mood';
  if (/任务|报告|完成|回来|出发|注意安全/.test(t)) return 'mission';
  if (/[？?]|吗|什么|怎么|为什么|哪/.test(t)) return 'question';
  return 'def';
}
function stylePrefix(style) {
  style = String(style || '');
  if (/温柔/.test(style)) return '嗯，';
  if (/直爽|爽快/.test(style)) return '行，';
  if (/活泼|开朗/.test(style)) return '哈哈，';
  if (/冷静|沉稳/.test(style)) return '嗯。';
  if (/毒舌|刻薄/.test(style)) return '啧，';
  return '';
}
function templateFor(talker, userText, sess) {
  var st = wxStore();
  var meta = (st && st.wordBank && st.wordBank.agents && st.wordBank.agents[talker]) || null;
  var phrases = (meta && meta.highFreqPhrases) || [];
  var topic = topicOf(userText);
  var pool = POOLS[topic] || POOLS.def;
  var key = talker + '|' + topic + '|' + String(userText || '').length;
  var h = 0;
  for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  var line;
  if (phrases.length && (h % 3 === 0)) line = phrases[h % phrases.length];
  else line = pool[h % pool.length];
  var pre = stylePrefix(meta && meta.characterCore && meta.characterCore.speechStyle);
  return pre + line;
}
function parseAt(text, names) {
  var best = null;
  (names || []).forEach(function (n) {
    if (n && String(text || '').indexOf('@' + n) !== -1) {
      if (!best || n.length > best.length) best = n;
    }
  });
  return best;
}

/* ── 模型开关与世界书：沿用单聊同一套取配置口子 ── */
function modelConfigured() {
  try {
    if (window.PhoneModel && window.PhoneModel.apiCfgFor && window.PhoneModel.apiCfgFor('chat')) return true;
  } catch (e) {}
  try {
    if (window.WeChatAppEngine && window.WeChatAppEngine.getActiveApiConfig && window.WeChatAppEngine.getActiveApiConfig()) return true;
  } catch (e) {}
  return false;
}
function modelReply(talker, sess, userText) {
  var E = window.WeChatAppEngine;
  if (!E) return Promise.resolve(null);
  var cfg = null;
  try { if (window.PhoneModel && window.PhoneModel.apiCfgFor) cfg = window.PhoneModel.apiCfgFor('chat'); } catch (e) {}
  if (!cfg) { try { cfg = E.getActiveApiConfig && E.getActiveApiConfig(); } catch (e) {} }
  if (!cfg) return Promise.resolve(null);
  var wb = '';
  try { if (window.WorldBook && window.WorldBook.buildContext) wb = window.WorldBook.buildContext('chat', talker, userText) || ''; } catch (e) {}
  var st = wxStore();
  var meta = (st && st.wordBank && st.wordBank.agents && st.wordBank.agents[talker]) || null;
  var sys = (wb ? '【世界设定已加载 · 你生活在这个世界中】' + wb + '\n\n' : '')
    + '你正在扮演「' + talker + '」在一个微信群聊里和用户聊天。群成员还有：' + groupMemberNames(sess).join('、')
    + '。只以' + talker + '的身份回一句话，6-20字左右，用微信聊天的语气，不写括号动作描写。';
  if (meta && meta.characterCore) sys += '你的说话风格：' + (meta.characterCore.speechStyle || '自然') + '；情绪基调：' + (meta.characterCore.emotionCore || '平和') + '。';
  return E.callRealAI(cfg, [{ role: 'system', content: sys }, { role: 'user', content: userText }], (cfg.maxTokens || 300))
    .then(function (t) { return (typeof t === 'string' && t.trim()) ? t.trim().slice(0, 300) : null; })
    .catch(function () { return null; });
}

/* ── 群回复主入口：轮流回 / @ 指定人回 ── */
function pushReply(sess, talker, content, mode) {
  if (!sess.messages) sess.messages = [];
  sess.messages.push({ id: 'gm_br_' + Date.now() + '_' + Math.floor(Math.random() * 1000), sender: talker, type: 'text', content: content, time: '刚刚', mode: mode });
  sess.preview = talker + '：' + content;
  sess.lastTime = '刚刚';
  if (!sess.memory) sess.memory = [];
  sess.memory.push({ role: talker, text: content, time: Date.now() });
  if (sess.memory.length > 24) sess.memory.shift();
  try { if (typeof MemoryCore !== 'undefined') MemoryCore.onCharReply(talker, content); } catch (e) {}
  persist();
  render();
}
function pushSys(sess, text) {
  if (!sess.messages) sess.messages = [];
  sess.messages.push({ id: 'sys_br_' + Date.now() + '_' + Math.floor(Math.random() * 1000), sender: '系统', type: 'time_gap', content: text, time: '刚刚' });
  sess.preview = text;
  sess.lastTime = '刚刚';
}
function groupReply(st, sess, userText) {
  if (!sess || !sess.isGroup) return false;
  normalizeGroup(sess);
  var names = groupMemberNames(sess);
  if (!names.length) return false;
  var at = parseAt(String(userText || ''), names);
  var talker;
  if (at) talker = at;
  else {
    var idx = (typeof sess._brNext === 'number' ? sess._brNext : 0);
    talker = names[idx % names.length];
    sess._brNext = idx + 1;
  }
  var label = String(userText || '');
  var configured = modelConfigured();
  var bar = document.getElementById('wx-chat-state-bar');
  if (bar) bar.classList.add('wx-typing');
  setTimeout(function () {
    modelReply(talker, sess, label).then(function (mt) {
      if (bar) bar.classList.remove('wx-typing');
      if (mt) pushReply(sess, talker, mt, 'model');
      else {
        if (configured) toast('模型调用失败，已回落模板模式');
        pushReply(sess, talker, templateFor(talker, label, sess), 'template');
      }
      maybeProposeCandidate(sess, label);
    });
  }, 700);
  return true;
}

/* ── 群对话进候选记忆审阅：只产候选，用户确认才入库 ── */
function maybeProposeCandidate(sess, text) {
  try {
    var AN = window.GroupAN;
    if (!AN || !AN.proposeMemoryCandidate) return null;
    var t = String(text || '').trim();
    if (!t) return null;
    var m = t.match(/^[记記]住[：:，,]?(.*)$/);
    var hit = m ? m[1].trim() : (/我喜欢|我最喜欢|我决定|从今天起|以后每天/.test(t) ? t : '');
    if (!hit) return null;
    var full = '【群聊 ' + sess.name + '】' + hit;
    var existing = [];
    try { existing = JSON.parse(localStorage.getItem(CAND_KEY) || '[]'); } catch (e) {}
    if (Array.isArray(existing) && existing.some(function (c) { return c && c.status === 'pending' && c.text === full; })) return null;
    return AN.proposeMemoryCandidate(full, 'wechat-group');
  } catch (e) { return null; }
}

/* ── 备份：退出/解散时整条群会话进本地备份，不彻底删除 ── */
function listBackups() {
  try {
    var list = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
function restoreBackup(id) {
  var list = listBackups();
  var b = null;
  list.forEach(function (x) { if (String(x.id) === String(id)) b = x; });
  if (!b) return false;
  var st = wxStore();
  if (!st) return false;
  if ((st.sessions || []).some(function (s) { return s.id === b.groupId; })) { toast('该群已在消息列表中'); return false; }
  st.sessions.unshift({
    id: b.groupId, name: b.name, avatar: '', isGroup: true, isPinned: false, unread: 0,
    members: (b.members || []).slice(), groupMembers: (b.members || []).slice(),
    groupNotice: b.groupNotice || '', heartsVoice: '', emotionState: '', chatBg: '',
    lastTime: '刚刚', preview: '已从备份恢复', memory: [], events: [],
    messages: (b.messages || []).slice()
  });
  persist();
  render();
  toast('已从备份恢复群聊');
  return true;
}

/* ── 群资料页 ── */
function groupSess() {
  var st = wxStore();
  if (!st) return null;
  if (activeGroupId) {
    var s = (st.sessions || []).find(function (x) { return x.id === activeGroupId; });
    if (s) return s;
  }
  return curSess();
}
function openGroupProfile(id) {
  var st = wxStore();
  if (!st) return false;
  var sess = null;
  if (id) sess = (st.sessions || []).find(function (s) { return s.id === id; });
  if (!sess) sess = (st.sessions || []).find(function (s) { return s.id === st.currentChatId; });
  if (!sess || !sess.isGroup) return false;
  normalizeGroup(sess);
  activeGroupId = sess.id;
  renderGroupProfile();
  var page = document.getElementById('wx-view-group-profile');
  if (page) page.classList.add('wx-active');
  return true;
}
function renderGroupProfile() {
  var body = document.getElementById('wx-gp-body');
  if (!body) return;
  var sess = groupSess();
  if (!sess || !sess.isGroup) { body.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999;font-size:14px;">没有打开的群聊</div>'; return; }
  normalizeGroup(sess);
  var names = groupMemberNames(sess);
  var total = names.length + 1;
  var E = window.WeChatAppEngine;
  function av(name) {
    try { if (E && E.resolveAvatar) return E.resolveAvatar(name); } catch (e) {}
    return '<div style="width:100%;height:100%;background:#ccc;color:#fff;display:flex;align-items:center;justify-content:center;">' + esc((name || '?').charAt(0)) + '</div>';
  }
  var backups = listBackups();
  var html = ''
    + '<div style="background:#fff;margin:12px;border-radius:10px;padding:16px;display:flex;gap:14px;align-items:center;">'
    + '<div style="width:56px;height:56px;flex-shrink:0;">' + groupAvatarHTML(sess) + '</div>'
    + '<div><div style="font-size:17px;font-weight:600;">' + esc(sess.name) + '</div>'
    + '<div style="font-size:12px;color:#888;margin-top:4px;">群成员 ' + total + ' 人（含我）</div></div></div>'
    + '<div style="background:#fff;margin:0 12px 12px;border-radius:10px;padding:14px 16px;">'
    + '<div style="font-size:13px;color:#888;">群公告</div>'
    + '<div style="font-size:15px;margin-top:6px;line-height:1.6;">' + (sess.groupNotice ? esc(sess.groupNotice) : '暂无公告') + '</div>'
    + '<div data-act="notice" style="color:#07c160;font-size:14px;margin-top:10px;cursor:pointer;">' + (sess.groupNotice ? '修改公告' : '发布公告') + ' ›</div></div>'
    + '<div style="background:#fff;margin:0 12px 12px;border-radius:10px;overflow:hidden;">'
    + '<div class="wx-gp-row" data-act="rename"><span>修改群名</span><span style="color:#888;">›</span></div>'
    + '<div class="wx-gp-row" data-act="invite" style="border-bottom:none;"><span>邀请新成员</span><span style="color:#888;">›</span></div></div>'
    + '<div style="font-size:12px;color:#888;padding:0 16px 6px;">群成员（点成员进 TA 的主页）</div>'
    + '<div style="background:#fff;margin:0 12px 12px;border-radius:10px;overflow:hidden;">'
    + '<div class="wx-gp-member"><div style="width:32px;height:32px;border-radius:4px;overflow:hidden;flex-shrink:0;">' + av('我') + '</div><div style="flex:1;font-size:15px;">我（群主）</div></div>'
    + names.map(function (n) {
        return '<div class="wx-gp-member" data-member="' + esc(n) + '"><div style="width:32px;height:32px;border-radius:4px;overflow:hidden;flex-shrink:0;cursor:pointer;">' + av(n) + '</div>'
          + '<div style="flex:1;font-size:15px;cursor:pointer;">' + esc(n) + '</div>'
          + '<button type="button" data-act="remove" data-name="' + esc(n) + '" style="border:1px solid #fa5151;color:#fa5151;background:#fff;border-radius:6px;padding:5px 10px;font-size:13px;">移除</button></div>';
      }).join('')
    + '</div>'
    + '<div style="background:#fff;margin:0 12px 12px;border-radius:10px;overflow:hidden;">'
    + '<div class="wx-gp-row wx-gp-danger" data-act="exit"><span style="flex:1;text-align:center;">退出群聊</span></div>'
    + '<div class="wx-gp-row wx-gp-danger" data-act="dissolve" style="border-bottom:none;"><span style="flex:1;text-align:center;">解散群聊</span></div></div>'
    + '<div style="font-size:12px;color:#888;line-height:1.7;padding:0 16px 8px;">退出或解散后，该群将从消息列表移除，聊天记录会备份到本地（' + BACKUP_KEY + '），不会彻底删除；可在下方恢复。</div>'
    + (backups.length
        ? '<div style="font-size:12px;color:#888;padding:0 16px 6px;">已备份的群聊（' + backups.length + '）</div>'
          + '<div style="background:#fff;margin:0 12px 20px;border-radius:10px;overflow:hidden;">'
          + backups.map(function (b) {
              return '<div class="wx-gp-row"><span>' + esc(b.name) + ' · ' + (b.members || []).length + ' 人</span>'
                + '<button type="button" data-act="restore" data-bid="' + esc(b.id) + '" style="border:1px solid #07c160;color:#07c160;background:#fff;border-radius:6px;padding:5px 10px;font-size:13px;">恢复</button></div>';
            }).join('') + '</div>'
        : '<div style="font-size:12px;color:#888;padding:0 16px 20px;">暂无已备份的群聊</div>');
  body.innerHTML = html;
  if (!body._brBound) {
    body._brBound = true;
    body.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (t) {
        var act = t.getAttribute('data-act');
        if (act === 'rename') { renameGroup(); return; }
        if (act === 'notice') { setAnnouncement(); return; }
        if (act === 'invite') { openInvitePicker(); return; }
        if (act === 'remove') { removeMember(t.getAttribute('data-name')); return; }
        if (act === 'exit') { exitGroup('exit'); return; }
        if (act === 'dissolve') { exitGroup('dissolve'); return; }
        if (act === 'restore') { restoreBackup(t.getAttribute('data-bid')); renderGroupProfile(); return; }
        return;
      }
      var row = e.target && e.target.closest ? e.target.closest('[data-member]') : null;
      if (row) {
        var name = row.getAttribute('data-member');
        var page = document.getElementById('wx-view-group-profile');
        if (page) page.classList.remove('wx-active');
        try { if (window.WeChatAppEngine) window.WeChatAppEngine.openProfile(name); } catch (err) {}
      }
    });
  }
}
function renameGroup() {
  var sess = groupSess();
  if (!sess) return;
  var E = window.WeChatAppEngine;
  if (!E || !E.showInputDialog) return;
  E.showInputDialog('修改群名', sess.name, function (v) {
    if (!v || !v.trim() || v.trim() === sess.name) return;
    var old = sess.name;
    sess.name = v.trim();
    pushSys(sess, '群名已由“' + old + '”改为“' + sess.name + '”');
    persist();
    render();
    renderGroupProfile();
  });
}
function setAnnouncement() {
  var sess = groupSess();
  if (!sess) return;
  var E = window.WeChatAppEngine;
  if (!E || !E.showInputDialog) return;
  E.showInputDialog('群公告', sess.groupNotice || '', function (v) {
    sess.groupNotice = (v || '').trim();
    pushSys(sess, sess.groupNotice ? '发布了群公告：' + sess.groupNotice : '清空了群公告');
    persist();
    render();
    renderGroupProfile();
  });
}
function inviteMembers(names) {
  var sess = groupSess();
  if (!sess || !sess.isGroup) return false;
  normalizeGroup(sess);
  var fresh = (names || []).filter(function (n) { return n && groupMemberNames(sess).indexOf(n) === -1; });
  if (!fresh.length) return false;
  fresh.forEach(function (n) { sess.members.push(n); });
  sess.groupMembers = sess.members.slice();
  pushSys(sess, '“我”邀请“' + fresh.join('、') + '”加入群聊');
  persist();
  render();
  renderGroupProfile();
  return true;
}
function closeInvitePicker() {
  var old = document.getElementById('wx-gp-invite-sheet');
  if (old) old.remove();
}
function openInvitePicker() {
  var st = wxStore();
  var cur = curSess();
  if (!cur || !cur.isGroup) return false;
  normalizeGroup(cur);
  closeInvitePicker();
  var cands = (st.sessions || []).filter(function (s) { return !s.isGroup && s.name && groupMemberNames(cur).indexOf(s.name) === -1; });
  var root = document.getElementById('wx-app-root') || document.body;
  var sheet = document.createElement('div');
  sheet.id = 'wx-gp-invite-sheet';
  sheet.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45);z-index:3500;display:flex;align-items:flex-end;justify-content:center;';
  sheet.innerHTML = '<div style="background:#fff;width:100%;max-height:75%;border-radius:14px 14px 0 0;overflow:hidden;display:flex;flex-direction:column;">'
    + '<div style="padding:14px 16px;font-size:16px;font-weight:600;border-bottom:1px solid #eee;">邀请新成员</div>'
    + '<div style="overflow-y:auto;padding:6px 0;">'
    + (cands.length ? cands.map(function (c) {
        return '<div class="wx-gp-invite-item" data-name="' + esc(c.name) + '" style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;"><span class="wx-gp-check" style="width:20px;height:20px;border-radius:50%;border:1.5px solid #ccc;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#fff;flex-shrink:0;"></span><span style="font-size:15px;">' + esc(c.name) + '</span></div>';
      }).join('') : '<div style="padding:24px;text-align:center;color:#999;font-size:14px;">没有可邀请的联系人</div>')
    + '</div>'
    + '<div style="display:flex;gap:10px;padding:12px 16px;border-top:1px solid #eee;"><button type="button" id="wx-gp-invite-cancel" style="flex:1;padding:11px;border-radius:8px;border:1px solid #ddd;background:#fff;font-size:15px;">取消</button><button type="button" id="wx-gp-invite-confirm" style="flex:1;padding:11px;border-radius:8px;border:none;background:#07c160;color:#fff;font-size:15px;">确定</button></div></div>';
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet) { closeInvitePicker(); return; }
    var item = (e.target && e.target.closest) ? e.target.closest('.wx-gp-invite-item') : null;
    if (item) {
      item.classList.toggle('checked');
      var ck = item.querySelector('.wx-gp-check');
      if (ck) {
        var on = item.classList.contains('checked');
        ck.style.background = on ? '#07c160' : '';
        ck.style.borderColor = on ? '#07c160' : '#ccc';
        ck.textContent = on ? '✓' : '';
      }
      return;
    }
    if (e.target && e.target.id === 'wx-gp-invite-cancel') { closeInvitePicker(); return; }
    if (e.target && e.target.id === 'wx-gp-invite-confirm') {
      var names = Array.prototype.slice.call(sheet.querySelectorAll('.wx-gp-invite-item.checked')).map(function (el) { return el.getAttribute('data-name'); });
      closeInvitePicker();
      if (names.length) inviteMembers(names);
      else toast('未选择联系人');
    }
  });
  root.appendChild(sheet);
  return true;
}
function removeMember(name) {
  var sess = groupSess();
  if (!sess || !sess.isGroup) return false;
  var names = groupMemberNames(sess);
  if (names.indexOf(name) === -1) return false;
  if (names.length <= 1) { toast('群里至少保留 1 位成员'); return false; }
  if (!window.confirm('确定将“' + name + '”移出群聊吗？')) return false;
  sess.members = names.filter(function (n) { return n !== name; });
  sess.groupMembers = sess.members.slice();
  pushSys(sess, '“' + name + '”被移出群聊');
  persist();
  render();
  renderGroupProfile();
  return true;
}
function exitGroup(mode) {
  var sess = groupSess();
  if (!sess || !sess.isGroup) return false;
  var isDissolve = mode === 'dissolve';
  var msg = isDissolve
    ? '解散群聊后，该群将从消息列表移除，所有成员的群记录都会结束；本机聊天记录会备份到本地（' + BACKUP_KEY + '），不会彻底删除。确定解散吗？'
    : '退出群聊后，该群将从消息列表移除，聊天记录会备份到本地（' + BACKUP_KEY + '），不会彻底删除，之后可从群资料页的备份里恢复。确定退出吗？';
  if (!window.confirm(msg)) return false;
  var backup = {
    id: 'gpb_' + Date.now(), groupId: sess.id, name: sess.name,
    members: groupMemberNames(sess), groupNotice: sess.groupNotice || '',
    messages: (sess.messages || []).slice(), backedUpAt: Date.now(), mode: mode
  };
  var list = listBackups();
  list.push(backup);
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); } catch (e) {}
  var st = wxStore();
  st.sessions = (st.sessions || []).filter(function (s) { return s.id !== sess.id; });
  if (st.currentChatId === sess.id) st.currentChatId = (st.sessions[0] && st.sessions[0].id) || '';
  var chatPage = document.getElementById('wx-view-chat-detail');
  if (chatPage) chatPage.classList.remove('wx-active');
  var gpPage = document.getElementById('wx-view-group-profile');
  if (gpPage) gpPage.classList.remove('wx-active');
  persist();
  render();
  toast(isDissolve ? '群聊已解散，记录已备份' : '已退出群聊，记录已备份');
  return true;
}

/* ── 渲染后同步：标题人数（含我）+ 公告横条 + 全群归一化 ── */
function syncAfterRender() {
  try { normalizeAll(); } catch (e) {}
  var st = wxStore();
  if (!st) return;
  var cur = (st.sessions || []).find(function (s) { return s.id === st.currentChatId; });
  var title = document.getElementById('wx-chat-title');
  if (cur && cur.isGroup && title) {
    var n = groupMemberNames(cur).length + 1;
    title.innerText = cur.name + ' (' + n + ')';
  }
  var bar = document.getElementById('wx-group-notice-bar');
  if (bar) {
    if (cur && cur.isGroup && cur.groupNotice) {
      bar.style.display = 'block';
      bar.textContent = '群公告：' + cur.groupNotice;
    } else bar.style.display = 'none';
  }
}

/* ── 包裹原函数（只包一层；单聊行为不动）── */
function wrapEngine() {
  var E = window.WeChatAppEngine;
  if (!E || E._brWrapped) return !!E;
  try {
    var origRender = E.renderUpdates;
    E.renderUpdates = function () {
      var r = origRender.apply(this, arguments);
      try { syncAfterRender(); } catch (e) {}
      return r;
    };
    var origProfile = E.openProfile;
    E.openProfile = function (name) {
      var st = wxStore();
      var t = null;
      if (st) t = (st.sessions || []).find(function (s) { return s.name === name || (name && s.name && s.name.indexOf(name) !== -1); });
      if (t && t.isGroup) { openGroupProfile(t.id); return; }
      return origProfile.apply(this, arguments);
    };
    var origOtomeProfile = E.openOtomeProfile;
    if (origOtomeProfile) {
      E.openOtomeProfile = function () {
        var cur = curSess();
        if (cur && cur.isGroup) { openGroupProfile(cur.id); return; }
        return origOtomeProfile.apply(this, arguments);
      };
    }
    var origRich = E.sendRichCard;
    if (origRich) {
      E.sendRichCard = function (type, amount) {
        var r = origRich.apply(this, arguments);
        try {
          var cur = curSess();
          if (cur && cur.isGroup && (type === 'transfer' || type === 'redpacket' || type === 'poll')) {
            groupReply(wxStore(), cur, type === 'transfer' ? '[转账]' : (type === 'redpacket' ? '[红包]' : '[投票]'));
          }
        } catch (e) {}
        return r;
      };
    }
    var origLoc = E._locPush;
    if (origLoc) {
      E._locPush = function (loc, sender) {
        var r = origLoc.apply(this, arguments);
        try {
          var cur = curSess();
          if (cur && cur.isGroup && r && (!sender || sender === '我')) groupReply(wxStore(), cur, '[位置]');
        } catch (e) {}
        return r;
      };
    }
    var origImg = E.handleImgUpload;
    if (origImg) {
      E.handleImgUpload = function (input) {
        var cur0 = curSess();
        var before = cur0 ? (cur0.messages || []).length : 0;
        var gid = cur0 ? cur0.id : '';
        var r = origImg.apply(this, arguments);
        try {
          if (cur0 && cur0.isGroup) {
            setTimeout(function () {
              try {
                var st1 = wxStore();
                var g = (st1.sessions || []).find(function (s) { return s.id === gid; });
                if (!g) return;
                // 只看“新增”的消息里有没有我发的图片：不取最后一条，
                // 因为 P 组 onPhotoSent 会在群里立刻插一条 ❤️ 回应。
                var msgs = g.messages || [];
                var hasNewImg = false;
                for (var i = before; i < msgs.length; i++) {
                  if (msgs[i] && msgs[i].type === 'image' && msgs[i].sender === '我') { hasNewImg = true; break; }
                }
                if (hasNewImg) groupReply(st1, g, '[图片]');
              } catch (e) {}
            }, 1500);
          }
        } catch (e) {}
        return r;
      };
    }
    E._brWrapped = true;
    return true;
  } catch (e) { return false; }
}
function ensureCSS() {
  if (document.getElementById('br-group-css')) return;
  var s = document.createElement('style');
  s.id = 'br-group-css';
  s.textContent = '.wx-gp-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#fff;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:15px;}'
    + '.wx-gp-member{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid #f0f0f0;}'
    + '.wx-gp-danger{color:#fa5151;text-align:center;}'
    + '#wx-group-notice-bar{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}';
  document.head.appendChild(s);
}
function init() {
  ensureCSS();
  if (wrapEngine()) { try { normalizeAll(); } catch (e) {} return; }
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (wrapEngine() || tries > 50) {
      clearInterval(timer);
      try { normalizeAll(); } catch (e) {}
    }
  }, 100);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

return {
  MARK: MARK, BACKUP_KEY: BACKUP_KEY,
  normalizeGroup: normalizeGroup, normalizeAll: normalizeAll,
  groupMemberNames: groupMemberNames, groupAvatarHTML: groupAvatarHTML,
  templateFor: templateFor, parseAt: parseAt, groupReply: groupReply,
  maybeProposeCandidate: maybeProposeCandidate,
  openGroupProfile: openGroupProfile, renderGroupProfile: renderGroupProfile,
  renameGroup: renameGroup, setAnnouncement: setAnnouncement,
  openInvitePicker: openInvitePicker, inviteMembers: inviteMembers,
  removeMember: removeMember, exitGroup: exitGroup,
  listBackups: listBackups, restoreBackup: restoreBackup,
  syncAfterRender: syncAfterRender, modelConfigured: modelConfigured
};
})();
