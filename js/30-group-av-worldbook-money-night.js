
/* GROUP-AV-WORLDBOOK-MONEY-NIGHT · AV 组：微信转账/红包全流程 + 微信夜间模式（自写）。
   钱包是手机内模拟钱包（wxStore.accountMeta.balance，修复版已是真的余额与交易记录）：
   发转账/发红包扣余额并记账；收转账/拆红包入账并记账；同一条红包只入账一次；
   转账详情页区分我发出的 / 收到的 / 已收款 / 已过期（24 小时未领，过期退回）。
   sendRichCard('transfer') 金额缺失 fallback 1314 是原有行为，本组不动。
   夜间模式：真深色变量样式，跟随 phone_ui_prefs_v1.theme（经 AppTheme.resolved()
   解析，认 light|dark|auto|gruvbox-dark|guichao-dark）与微信 nightVibeMode；
   夜间时摘掉旧的 invert(0.92) 滤镜（wx-dark-mode），不再反色图片。 */
(function () {
'use strict';
if (window.AVGroup) return;
var LS = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
var G = function (name) {
  try { if (typeof window !== 'undefined' && window[name] !== undefined) return window[name]; } catch (e) {}
  try { return (0, eval)(name); } catch (e) { return undefined; }
};
var fmt = function (n) { return (Math.round(n * 100) / 100).toFixed(2); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var $ = function (id) { return document.getElementById(id); };
function wxStore() { try { var R = G('AppRegistry'); return R && R.wechat ? R.wechat.wxStore : null; } catch (e) { return null; } }
function engine() { return G('WeChatAppEngine'); }
function curSess() { var s = wxStore(); if (!s) return null; return (s.sessions || []).find(function (x) { return x.id === s.currentChatId; }) || null; }
function balance() { var s = wxStore(); return s ? parseFloat(s.accountMeta.balance || '0') || 0 : 0; }
function setBalance(v, totalDelta) { var s = wxStore(); if (!s) return; s.accountMeta.balance = fmt(v); var t = parseFloat(s.accountMeta.totalAssets || '0') || 0; s.accountMeta.totalAssets = fmt(t + (totalDelta || 0)); }
function addTx(tx) { var s = wxStore(); if (!s) return; if (!s.accountMeta.transactions) s.accountMeta.transactions = []; s.accountMeta.transactions.unshift(tx); }
function nowStr() { try { return new Date().toLocaleString('zh-CN', { hour12: false }).slice(5); } catch (e) { return ''; } }
function persist() { var s = wxStore(); if (s && typeof s._persist === 'function') { try { s._persist(); } catch (e) {} } }
function toast(t) { var E = engine(); if (E && E.triggerToast) E.triggerToast(t); }
function findMsg(mid) {
  var s = wxStore(); if (!s || !mid) return null;
  var found = null;
  (s.sessions || []).forEach(function (sess) { (sess.messages || []).forEach(function (m) { if (m.id === mid) found = m; }); });
  return found;
}

/* ══ 夜间模式 ══ */
var DARK_THEMES = { 'dark': 1, 'guichao-dark': 1, 'gruvbox-dark': 1 };
function avPhoneDark() {
  try {
    if (window.AppTheme && typeof window.AppTheme.resolved === 'function') {
      var r = window.AppTheme.resolved();
      if (r === 'auto') { try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }
      return !!DARK_THEMES[r];
    }
  } catch (e) {}
  try {
    var p = {}; try { if (typeof window.getUiPrefs === 'function') p = window.getUiPrefs() || {}; else p = JSON.parse(LS.get('phone_ui_prefs_v1') || '{}') || {}; } catch (e) { p = {}; } /* GROUP-CORE: 走带缓存的 getUiPrefs，不再每次直读解析 */
    var t = p.theme || 'light';
    if (t === 'auto') { try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }
    return !!DARK_THEMES[t];
  } catch (e) { return false; }
}
function avApplyWxNight() {
  var root = $('wx-app-root');
  if (!root) return false;
  var s = wxStore();
  var night = avPhoneDark() || !!(s && s.config && s.config.nightVibeMode);
  root.classList.toggle('av-wx-night', night);
  if (night) root.classList.remove('wx-dark-mode');
  else if (s && s.config && s.config.nightVibeMode) root.classList.add('wx-dark-mode');
  return night;
}
/* [R3-S8a] 微信夜间改为 AppTheme.onApplied hook：注册在 avBoot() 里，不再替换 AppTheme.apply（旧 avHookTheme 已删）。 */

/* ══ 转账详情页修补：区分方向 / 收款入账 / 过期退回 ══ */
function avTransferExpired(msg) {
  if (!msg || msg.state === 'accepted') return false;
  var m = String(msg.time || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return false;
  var t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return (Date.now() - t) > 24 * 3600 * 1000;
}
function avRowVal(page, label) {
  var spans = page.querySelectorAll('span');
  for (var i = 0; i < spans.length; i++) {
    if (spans[i].textContent.trim() === label) {
      var row = spans[i].parentElement;
      if (row) { var cells = row.querySelectorAll('span'); if (cells.length > 1) return cells[1]; }
    }
  }
  return null;
}
function avFixTransferDetail(sid, mid) {
  var setTxt = function (el, t) { if (el) { try { el.innerText = t; } catch (e) {} el.textContent = t; } };
  var s = wxStore();
  if (!s) return;
  var sess = (s.sessions || []).find(function (x) { return x.id === sid; });
  if (!sess) return;
  var msg = (sess.messages || []).find(function (m) { return m.id === mid; });
  if (!msg) return;
  var page = $('wx-page-transfer-detail');
  if (!page) return;
  var statusTxt = $('wx-td-status-txt');
  var acceptBtn = $('wx-td-accept-btn');
  var returnBtn = $('wx-td-return-btn'); // GROUP-WECHAT · 第 22 项 §4：退回按钮
  var amountDom = $('wx-td-amount');
  if (amountDom) setTxt(amountDom, '¥' + msg.amount);
  var remarkCell = avRowVal(page, '转账说明');
  if (remarkCell) remarkCell.textContent = msg.remark || '转账';
  var peerCell = avRowVal(page, '收款人');
  var amt = parseFloat(msg.amount) || 0;
  var incoming = msg.sender !== '我';
  var expired = avTransferExpired(msg);
  if (expired) {
    if (acceptBtn) acceptBtn.style.display = 'none';
    if (returnBtn) returnBtn.style.display = 'none';
    if (msg.state !== 'accepted' && msg.state !== 'returned') { msg.state = 'returned'; persist(); } // GROUP-WECHAT · 第 22 项：过期退回补完 state
    if (statusTxt) {
      if (incoming) { setTxt(statusTxt, '已过期 · 对方未领取'); statusTxt.style.color = '#999999'; }
      else {
        setTxt(statusTxt, '已过期 · 已退回零钱'); statusTxt.style.color = '#999999';
        if (!msg._avRefunded && amt > 0) {
          msg._avRefunded = true;
          setBalance(balance() + amt, amt);
          addTx({ id: 'tx_tfback_' + Date.now(), type: '收入', title: '转账退回', time: nowStr(), amount: '+' + fmt(amt), remark: '24小时未领取退回', category: 'transfer' });
          persist();
        }
      }
    }
  } else if (msg.state === 'accepted') {
    if (acceptBtn) acceptBtn.style.display = 'none';
    if (returnBtn) returnBtn.style.display = 'none';
    if (statusTxt) { setTxt(statusTxt, '已收款'); statusTxt.style.color = '#34363b'; }
  } else if (incoming) {
    if (statusTxt) { setTxt(statusTxt, '待收款'); statusTxt.style.color = '#f39b13'; }
    if (peerCell) peerCell.textContent = s.accountMeta.nickname || '我';
    if (acceptBtn) {
      acceptBtn.style.display = 'block';
      acceptBtn.onclick = function () {
        msg.state = 'accepted';
        acceptBtn.style.display = 'none';
        if (statusTxt) { setTxt(statusTxt, '已成功收款 ¥' + msg.amount); statusTxt.style.color = '#34363b'; }
        setBalance(balance() + amt, amt);
        addTx({ id: 'tx_tf_' + Date.now(), type: '收入', title: '转账收款-' + (sess.name || ''), time: nowStr(), amount: '+' + fmt(amt), remark: msg.remark || '微信转账', category: 'transfer' });
        persist();
        var E = engine();
        if (E && E.renderUpdates) E.renderUpdates();
      };
    }
    if (returnBtn) {
      returnBtn.style.display = 'block';
      returnBtn.onclick = function () {
        msg.state = 'returned';
        returnBtn.style.display = 'none';
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (statusTxt) { setTxt(statusTxt, '已退还'); statusTxt.style.color = '#999999'; }
        persist();
        var E2 = engine();
        if (E2 && E2.renderUpdates) E2.renderUpdates();
      };
    }
  } else {
    if (acceptBtn) acceptBtn.style.display = 'none';
    if (returnBtn) returnBtn.style.display = 'none';
    if (statusTxt) { setTxt(statusTxt, '已发出 · 等待对方收款'); statusTxt.style.color = '#f39b13'; }
    var labelCell = null;
    var spans = page.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) { if (spans[i].textContent.trim() === '收款人') labelCell = spans[i]; }
    if (labelCell) labelCell.textContent = '收款方';
    if (peerCell) peerCell.textContent = sess.name || '';
  }
}

/* ══ 引擎方法挂接 ══ */
function avInitEngine() {
  var E = engine();
  if (!E) return false;
  if (E._avWrapped) return true;
  E._avWrapped = true;
  if (typeof E.toggleStoreConfig === 'function' && !E._avToggleWrapped) {
    E._avToggleWrapped = true;
    var origToggle = E.toggleStoreConfig;
    E.toggleStoreConfig = function (k, el) { var r = origToggle.call(E, k, el); try { avApplyWxNight(); } catch (e) {} return r; };
  }
  if (typeof E.renderUpdates === 'function') {
    var origRU = E.renderUpdates;
    E.renderUpdates = function () { var r = origRU.apply(E, arguments); try { avApplyWxNight(); } catch (e) {} return r; };
  }
  if (typeof E.openTransferDetail === 'function') {
    var origTD = E.openTransferDetail;
    E.openTransferDetail = function (sid, mid) { var r = origTD.call(E, sid, mid); try { avFixTransferDetail(sid, mid); } catch (e) {} return r; };
  }
  if (typeof E.openRedPacket === 'function') {
    var origRP = E.openRedPacket;
    E.openRedPacket = function (greeting, amount, mid) {
      var msg = mid ? findMsg(mid) : null;
      // F1b1 · WX-03 闭合：无金额不编随机金额（原 Math.random()*82+6.66 回落已删）；
      // amt 为 0 时沿用 js/00 侧 openRedPacket 口径：没有金额，无法拆开。
      var amt = msg && msg.amount ? (parseFloat(msg.amount) || 0) : (parseFloat(amount) || 0);
      E._avRp = { mid: mid || null, amount: amt, greeting: greeting, credited: false };
      if (msg && msg.sender === '我') {
        var amtDom = $('wx-rp-result-amount');
        if (amtDom) amtDom.innerText = fmt(amt);
        var gDom = $('wx-rp-detail-greeting');
        if (gDom) gDom.innerText = greeting || msg.greeting || '大吉大利';
        $('wx-rp-result-page') && $('wx-rp-result-page').classList.add('wx-active');
        return;
      }
      return origRP.call(E, greeting, String(amt));
    };
  }
  if (typeof E.executeOpenRedPacket === 'function') {
    E.executeOpenRedPacket = function (btn) {
      var rp = E._avRp || {};
      var msg = rp.mid ? findMsg(rp.mid) : null;
      if (msg && msg.state === 'opened') {
        $('wx-redpacket-overlay') && $('wx-redpacket-overlay').classList.remove('wx-active');
        $('wx-rp-result-page') && $('wx-rp-result-page').classList.add('wx-active');
        return;
      }
      if (msg && msg.sender === '我') {
        $('wx-redpacket-overlay') && $('wx-redpacket-overlay').classList.remove('wx-active');
        $('wx-rp-result-page') && $('wx-rp-result-page').classList.add('wx-active');
        return;
      }
      if (btn) btn.style.transform = 'rotateY(720deg)';
      setTimeout(function () {
        if (btn) btn.style.transform = 'rotateY(0deg)';
        $('wx-redpacket-overlay') && $('wx-redpacket-overlay').classList.remove('wx-active');
        $('wx-rp-result-page') && $('wx-rp-result-page').classList.add('wx-active');
        var amt = rp.amount || 0;
        if (amt > 0 && !rp.credited) {
          rp.credited = true;
          if (msg) msg.state = 'opened';
          setBalance(balance() + amt, amt);
          addTx({ id: 'tx_rp_' + Date.now(), type: '收入', title: '红包入账', time: nowStr(), amount: '+' + fmt(amt), remark: '微信红包', category: 'redpacket' });
          persist();
          if (E.renderUpdates) E.renderUpdates();
        }
      }, 600);
    };
  }
  /* + 面板“转账”原来弹简易输入框，改走 AV 发送页；“红包”已在 HTML 里改走 AV 发送页 */
  E.showTransferModal = function () { E.avOpenSendTransfer(); };
  E.avQuickAmt = function (which, v) { var el = $(which === 'tf' ? 'av-tf-amount' : 'av-rp-amount'); if (el) el.value = v; };
  E.avOpenSendTransfer = function () {
    var sess = curSess();
    if (!sess) { toast('请先打开一个聊天'); return; }
    var to = $('av-tf-to'); if (to) to.textContent = sess.isGroup ? ('群聊 · ' + sess.name) : sess.name;
    var bal = $('av-tf-balance'); if (bal) bal.textContent = '可用余额 ¥' + fmt(balance());
    var amt = $('av-tf-amount'); if (amt) amt.value = '';
    var rem = $('av-tf-remark'); if (rem) rem.value = '';
    E.openSubPage('av-transfer');
  };
  E.avConfirmSendTransfer = function () {
    var sess = curSess();
    if (!sess) return;
    var amt = parseFloat(($('av-tf-amount') || {}).value || '');
    if (!amt || amt <= 0) { toast('请输入有效金额'); return; }
    if (amt > balance()) { toast('余额不足'); return; }
    var remark = (($('av-tf-remark') || {}).value || '').trim();
    setBalance(balance() - amt, -amt);
    addTx({ id: 'tx_tf_' + Date.now(), type: '支出', title: '向' + (sess.name || '') + '转账', time: nowStr(), amount: '-' + fmt(amt), remark: remark || '微信转账', category: 'transfer' });
    E.sendRichCard('transfer', amt);
    var msgs = sess.messages || [];
    for (var i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type === 'transfer' && msgs[i].sender === '我' && msgs[i].amount === fmt(amt)) {
        msgs[i].remark = remark || '微信转账';
        msgs[i]._avTs = Date.now();
        break;
      }
    }
    persist();
    E.closeSubPage('av-transfer');
    toast('已转账 ¥' + fmt(amt));
  };
  E.avOpenSendRedPacket = function () {
    var sess = curSess();
    if (!sess) { toast('请先打开一个聊天'); return; }
    var to = $('av-rp-to'); if (to) to.textContent = sess.isGroup ? ('群聊 · ' + sess.name) : sess.name;
    var bal = $('av-rp-balance'); if (bal) bal.textContent = '可用余额 ¥' + fmt(balance());
    var amt = $('av-rp-amount'); if (amt) amt.value = '';
    var greet = $('av-rp-greet'); if (greet) greet.value = '大吉大利';
    var cnt = $('av-rp-count'); if (cnt) cnt.value = '1';
    var cr = $('av-rp-count-row'); if (cr) cr.style.display = sess.isGroup ? 'flex' : 'none';
    var sr = $('av-rp-split-row'); if (sr) sr.style.display = sess.isGroup ? 'block' : 'none';
    E.openSubPage('av-redpacket');
  };
  E.avConfirmSendRedPacket = function () {
    var sess = curSess();
    if (!sess) return;
    var total = parseFloat(($('av-rp-amount') || {}).value || '');
    var greet = (($('av-rp-greet') || {}).value || '').trim() || '大吉大利';
    var count = 1, split = 'fixed';
    if (sess.isGroup) {
      count = parseInt(($('av-rp-count') || {}).value || '1', 10) || 1;
      count = Math.max(1, Math.min(20, count));
      var sel = document.querySelector('input[name="av-rp-split"]:checked');
      split = sel ? sel.value : 'fixed';
    }
    if (!total || total <= 0) { toast('请输入有效金额'); return; }
    if (total > balance()) { toast('余额不足'); return; }
    setBalance(balance() - total, -total);
    addTx({ id: 'tx_rp_send_' + Date.now(), type: '支出', title: '发出红包', time: nowStr(), amount: '-' + fmt(total), remark: greet, category: 'redpacket' });
    E.sendRichCard('redpacket');
    var msgs = sess.messages || [];
    for (var i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type === 'red_packet' && msgs[i].sender === '我') {
        msgs[i].amount = fmt(total);
        msgs[i].greeting = sess.isGroup ? (greet + '（共' + count + '个，' + (split === 'random' ? '拼手气' : '普通红包') + '）') : greet;
        msgs[i].count = count;
        msgs[i].split = split;
        msgs[i].state = 'unopened';
        msgs[i]._avSent = true;
        break;
      }
    }
    persist();
    E.closeSubPage('av-redpacket');
    toast('红包已发出');
  };
  return true;
}

function avBoot() {
  /* [R3-S8a] 微信夜间注册为 AppTheme.onApplied hook：主题应用完即同步夜间态，不再包 apply。 */
  try { if (window.AppTheme && window.AppTheme.onApplied) window.AppTheme.onApplied.push(function () { try { avApplyWxNight(); } catch (e) {} }); } catch (e) {}
  if (!avInitEngine()) {
    var n = 0;
    var t = setInterval(function () { n++; if (avInitEngine() || n > 20) clearInterval(t); }, 250);
  }
  avApplyWxNight();
}
try { window.addEventListener('storage', function (e) { if (e && e.key === 'phone_ui_prefs_v1') avApplyWxNight(); }); } catch (e) {}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avBoot);
else avBoot();

window.AVGroup = {
  applyNight: avApplyWxNight,
  phoneDark: avPhoneDark,
  transferExpired: avTransferExpired,
  fixTransferDetail: avFixTransferDetail,
  initEngine: avInitEngine
};
})();
