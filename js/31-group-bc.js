
/* GROUP-BC · 微信美化器（自写）。
   入口只在“我”页设置项（不进聊天页 ••• 菜单）。主题以 [data-wx-theme="…"] /
   --wx-* 变量组为标记：启动时扫注册表 + 扫全部 <style> 块，自动列出可用样式。
   深色夜间与 AV 组 av-wx-night 同一套；美化器优先于手机深色跟随。
   自定义 CSS 安全校验：禁 @import / 外部 url() / javascript: / expression() /
   :root-html-body 选择器与 * 通配；选择器强制加 #wx-app-root 前缀；失败按行提示。
   新键：wx_theme_v1 / wx_bubble_v1 / wx_custom_themes_v1 / wx_beautifier_prefs_v1。 */
(function () {
'use strict';
if (window.WxBeautifier) return;
var THEME_KEY = 'wx_theme_v1', BUBBLE_KEY = 'wx_bubble_v1';
var CUSTOM_KEY = 'wx_custom_themes_v1', PREF_KEY = 'wx_beautifier_prefs_v1';
var THEME_VARS = ['--wx-accent', '--wx-theme-color', '--wx-bg', '--wx-bg-page', '--wx-bg-card', '--wx-text', '--wx-dim', '--wx-line', '--wx-chat-bg', '--wx-bg-self', '--wx-bg-friend'];
var BUBBLE_VARS = ['--wx-bubble-self-bg', '--wx-bubble-self-color', '--wx-bubble-friend-bg', '--wx-bubble-friend-color', '--wx-bubble-radius'];
var THEMES = [
  { id: 'wechat-green', name: '默认微信绿', desc: '经典 #07C160 + 白底 + 绿气泡', scope: '微信全部页面', vars: { '--wx-accent': '#07c160', '--wx-theme-color': '#07c160', '--wx-bg': '#ededed', '--wx-bg-page': '#ffffff', '--wx-bg-card': '#ffffff', '--wx-text': '#111111', '--wx-dim': '#888888', '--wx-line': '#e5e5e5', '--wx-chat-bg': '#ededed', '--wx-bg-self': '#95ec69', '--wx-bg-friend': '#ffffff' } },
  { id: 'guichao-white', name: '归巢白', desc: '极简白灰，与手机归巢风格一致', scope: '微信全部页面', vars: { '--wx-accent': '#34363b', '--wx-theme-color': '#34363b', '--wx-bg': '#f7f7f8', '--wx-bg-page': '#ffffff', '--wx-bg-card': '#ffffff', '--wx-text': '#25262a', '--wx-dim': '#8a8b90', '--wx-line': '#ececef', '--wx-chat-bg': '#f7f7f8', '--wx-bg-self': '#34363b', '--wx-bg-friend': '#f7f7f8' } },
  { id: 'dark-night', name: '深色夜间', desc: '与微信夜间模式同一套（AV 组）', scope: '微信全部页面', vars: { '--wx-accent': '#07c160', '--wx-theme-color': '#07c160', '--wx-bg': '#111111', '--wx-bg-page': '#1c1c1e', '--wx-bg-card': '#2c2c2e', '--wx-text': '#f2f2f0', '--wx-dim': '#8e8e93', '--wx-line': '#2c2c2e', '--wx-chat-bg': '#111111', '--wx-bg-self': '#3eb575', '--wx-bg-friend': '#2c2c2c' } },
  { id: 'cream-retro', name: '奶油复古', desc: '米白底 + 暖金点缀，与信件复古风呼应', scope: '微信全部页面', vars: { '--wx-accent': '#b08d3e', '--wx-theme-color': '#b08d3e', '--wx-bg': '#f3ead6', '--wx-bg-page': '#fdf9f0', '--wx-bg-card': '#fffdf6', '--wx-text': '#3d3325', '--wx-dim': '#9a8f7a', '--wx-line': '#e8ddc8', '--wx-chat-bg': '#f3ead6', '--wx-bg-self': '#e8c97a', '--wx-bg-friend': '#fffdf6' } },
  { id: 'morandi-mist', name: '莫兰迪柔雾', desc: '低饱和灰粉 / 灰绿', scope: '微信全部页面', vars: { '--wx-accent': '#7d8b7a', '--wx-theme-color': '#7d8b7a', '--wx-bg': '#e9e7e4', '--wx-bg-page': '#f4f2f0', '--wx-bg-card': '#fbf9f8', '--wx-text': '#4a4a48', '--wx-dim': '#8f8b88', '--wx-line': '#ddd8d3', '--wx-chat-bg': '#e9e7e4', '--wx-bg-self': '#a8b5a0', '--wx-bg-friend': '#fbf9f8' } },
  { id: 'trianon', name: '特里亚农 · 洛可可', desc: '雾蓝银蓝奶白，信笺纸气泡', scope: '微信全部页面', vars: { '--wx-accent': '#5c6884', '--wx-theme-color': '#5c6884', '--wx-bg': '#fbf9f4', '--wx-bg-page': '#fffdf8', '--wx-bg-card': '#fffdf8', '--wx-text': '#1e2748', '--wx-dim': '#46536f', '--wx-line': 'rgba(30,39,72,.16)', '--wx-chat-bg': '#fbf9f4', '--wx-bg-self': '#dce2f1', '--wx-bg-friend': '#fffdf8', '--wx-bubble-self-bg': '#dce2f1', '--wx-bubble-friend-bg': '#fffdf8', '--wx-bubble-self-color': '#1e2748', '--wx-bubble-friend-color': '#1e2748', '--wx-bubble-radius': '14px' } },
];
var BUBBLES = [
  { id: 'classic-green', name: '经典绿', selfBg: '#07c160', selfColor: '#ffffff', friendBg: '#ffffff', friendColor: '#1a1a1a', radius: 5, tail: true },
  { id: 'guichao-grey', name: '归巢白灰', selfBg: '#34363b', selfColor: '#ffffff', friendBg: '#f7f7f8', friendColor: '#25262a', radius: 12, tail: false },
  { id: 'cream-yellow', name: '奶油黄', selfBg: '#f5c542', selfColor: '#4a3600', friendBg: '#fff8e7', friendColor: '#3d3325', radius: 14, tail: true },
  { id: 'morandi', name: '莫兰迪', selfBg: '#9aa88f', selfColor: '#ffffff', friendBg: '#e5d3d6', friendColor: '#4a4a48', radius: 12, tail: false },
  { id: 'midnight-blue', name: '深夜蓝', selfBg: '#24478f', selfColor: '#ffffff', friendBg: '#3a3a3e', friendColor: '#f2f2f0', radius: 8, tail: true },
  { id: 'sakura-pink', name: '樱花粉', selfBg: '#f6a8bb', selfColor: '#5a2a33', friendBg: '#fffaf0', friendColor: '#4a4a48', radius: 16, tail: false },
  { id: 'mint-green', name: '薄荷绿', selfBg: '#6fcf9f', selfColor: '#123524', friendBg: '#eef7f0', friendColor: '#2c4636', radius: 10, tail: true },
  { id: 'ink-black', name: '墨黑', selfBg: '#111111', selfColor: '#ffffff', friendBg: '#555555', friendColor: '#ffffff', radius: 4, tail: false }
];
var ALLOW_PROPS = { 'color': 1, 'background': 1, 'background-color': 1, 'border': 1, 'border-color': 1, 'border-width': 1, 'border-style': 1, 'border-radius': 1, 'border-top': 1, 'border-bottom': 1, 'border-left': 1, 'border-right': 1, 'font-size': 1, 'font-weight': 1, 'line-height': 1, 'padding': 1, 'margin': 1, 'opacity': 1, 'box-shadow': 1, 'text-align': 1, 'letter-spacing': 1, 'outline': 1, 'outline-color': 1 };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function root() { return document.getElementById('wx-app-root'); }
function uid(p) { return (p || 'c') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36); }
function loadCustoms() { try { var a = JSON.parse(lsGet(CUSTOM_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveCustoms(a) { lsSet(CUSTOM_KEY, JSON.stringify(a)); }
function getPrefs() { try { var p = JSON.parse(lsGet(PREF_KEY) || '{}') || {}; } catch (e) { var p = {}; } return { fontSize: (typeof p.fontSize === 'number' ? p.fontSize : 16), radius: (typeof p.radius === 'number' ? p.radius : 0), chatBg: (typeof p.chatBg === 'string' ? p.chatBg : '#ededed') }; }
function setPrefs(p) { lsSet(PREF_KEY, JSON.stringify(p)); }
function currentThemeId() { return lsGet(THEME_KEY) || 'wechat-green'; }
function currentBubbleId() { return lsGet(BUBBLE_KEY) || 'classic-green'; }
function findTheme(id) {
  for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return { id: THEMES[i].id, name: THEMES[i].name, desc: THEMES[i].desc, scope: THEMES[i].scope, vars: THEMES[i].vars, source: 'builtin' };
  if (id && id.indexOf('custom:') === 0) { var cs = loadCustoms(); for (var j = 0; j < cs.length; j++) if (cs[j].id === id.slice(7)) return { id: id, name: cs[j].name, desc: '自定义 CSS', scope: '微信全部页面', vars: {}, source: 'custom', customId: cs[j].id }; return null; }
  var scanned = scanThemes(); for (var k = 0; k < scanned.length; k++) if (scanned[k].id === id) return scanned[k];
  return null;
}
function findBubble(id) { for (var i = 0; i < BUBBLES.length; i++) if (BUBBLES[i].id === id) return BUBBLES[i]; return BUBBLES[0]; }
function parseVars(block) { var out = {}; (block || '').split(';').forEach(function (d) { var p = d.split(':'); if (p.length >= 2) { var k = p[0].trim(); if (k.indexOf('--wx-') === 0) out[k] = p.slice(1).join(':').trim(); } }); return out; }
/* 自动识别：扫注册表 + 扫全部 <style> 块里带 [data-wx-theme="…"] 的规则 + 自定义样式 */
function scanThemes() {
  var found = {};
  THEMES.forEach(function (t) { found[t.id] = { id: t.id, name: t.name, desc: t.desc, scope: t.scope, vars: t.vars, source: 'builtin' }; });
  var styles = document.querySelectorAll('style');
  for (var i = 0; i < styles.length; i++) {
    var txt = (styles[i].textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
    var re = /\[data-wx-theme="([^"]+)"\][^{]*\{([^}]*)\}/g, m;
    while ((m = re.exec(txt)) !== null) {
      var id = m[1], vars = parseVars(m[2]);
      if (!found[id]) found[id] = { id: id, name: id, desc: '样式表中发现的主题', scope: '微信全部页面', vars: vars, source: 'style' };
    }
  }
  loadCustoms().forEach(function (c) { found['custom:' + c.id] = { id: 'custom:' + c.id, name: c.name, desc: '自定义 CSS', scope: '微信全部页面', vars: {}, source: 'custom', customId: c.id }; });
  return Object.keys(found).map(function (k) { return found[k]; });
}
/* 自定义 CSS 安全校验：返回 {ok, clean, errors:[{line,msg}]}；失败时 clean 为空 */
function sanitize(css) {
  var errors = [];
  var src = String(css || '');
  var lines = src.split('\n');
  function lineOf(sub) { var idx = src.indexOf(sub); if (idx < 0) return 1; return src.slice(0, idx).split('\n').length; }
  function err(ln, msg) { errors.push({ line: ln, msg: msg }); }
  lines.forEach(function (line, i) {
    var ln = i + 1;
    if (/@import/i.test(line)) err(ln, '禁止 @import');
    if (/@\w/.test(line)) err(ln, '禁止 @ 规则（@import / @media 等）');
    if (/javascript\s*:/i.test(line)) err(ln, '禁止 javascript:');
    if (/vbscript\s*:/i.test(line)) err(ln, '禁止 vbscript:');
    if (/expression\s*\(/i.test(line)) err(ln, '禁止 expression()');
    if (/url\s*\(\s*(['"]?)(https?:|\/\/)/i.test(line)) err(ln, '禁止外部 url()，只允许 data: 本地图片');
    if (/(^|[^a-zA-Z0-9_-])(:root|html|body)\b/.test(line)) err(ln, '禁止 :root / html / body 选择器（只能作用于微信窗口内）');
  });
  var noComment = src.replace(/\/\*[\s\S]*?\*\//g, '');
  var out = [];
  noComment.split('}').forEach(function (rule) {
    if (!rule || !rule.trim()) return;
    var parts = rule.split('{');
    if (parts.length < 2) { err(lineOf(rule), '无法解析的规则（缺少 { ）'); return; }
    var selPart = parts[0], body = parts.slice(1).join('{');
    var sels = selPart.split(',');
    var cleanSels = [];
    sels.forEach(function (sel) {
      sel = sel.trim();
      if (!sel) return;
      if (/\*/.test(sel)) { err(lineOf(sel), '禁止 * 通配选择器：' + sel); return; }
      if (/(^|[^a-zA-Z0-9_-])(:root|html|body)\b/.test(sel)) { err(lineOf(sel), '禁止 :root / html / body 选择器：' + sel); return; }
      if (sel.indexOf('#wx-app-root') === 0) cleanSels.push(sel);
      else if (sel.indexOf('.wx-app-root') === 0) cleanSels.push('#wx-app-root' + sel.slice('.wx-app-root'.length));
      else cleanSels.push('#wx-app-root ' + sel);
    });
    var decls = body.split(';');
    decls.forEach(function (d) {
      var dm = d.match(/^\s*([a-zA-Z-]+)\s*:/);
      if (dm && !ALLOW_PROPS[dm[1].toLowerCase()]) err(lineOf(d), '不允许的属性：' + dm[1]);
    });
    if (cleanSels.length) out.push(cleanSels.join(', ') + ' {' + body + '}');
  });
  if (errors.length) return { ok: false, clean: '', errors: errors };
  return { ok: true, clean: out.join('\n'), errors: [] };
}
function setCustomStyle(cssText) {
  var old = document.getElementById('wx-bc-custom-style');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  if (!cssText) return;
  var st = document.createElement('style');
  st.id = 'wx-bc-custom-style';
  st.textContent = cssText;
  var r = root();
  if (r) r.appendChild(st); else document.head.appendChild(st);
}
function showErrors(errors) {
  var el = document.getElementById('wx-bc-custom-errors');
  if (el) el.textContent = errors.map(function (e) { return '第 ' + e.line + ' 行：' + e.msg; }).join('\n');
}
function flash(r) {
  if (!r) return;
  r.classList.add('wx-bc-switching');
  setTimeout(function () { r.classList.remove('wx-bc-switching'); }, 320);
}
function syncNightVibe(isDark) {
  try {
    var s = null;
    if (window.AppRegistry && window.AppRegistry.wechat) s = window.AppRegistry.wechat.wxStore;
    if (s && s.config) { s.config.nightVibeMode = !!isDark; if (typeof s._persist === 'function') { try { s._persist(); } catch (e) {} } }
  } catch (e) {}
}
function applyBubbleVars(b) {
  var r = root(); if (!r) return;
  r.style.setProperty('--wx-bubble-self-bg', b.selfBg);
  r.style.setProperty('--wx-bubble-self-color', b.selfColor);
  r.style.setProperty('--wx-bubble-friend-bg', b.friendBg);
  r.style.setProperty('--wx-bubble-friend-color', b.friendColor);
  var prefs = getPrefs();
  r.style.setProperty('--wx-bubble-radius', (prefs.radius > 0 ? prefs.radius : b.radius) + 'px');
  r.setAttribute('data-wx-bubble-tail', b.tail ? '1' : '0');
}
function applyPrefs(silent) {
  var r = root(); if (!r) return;
  var p = getPrefs();
  r.style.setProperty('--wx-bubble-font', p.fontSize + 'px');
  r.style.setProperty('--wx-chat-bg', p.chatBg);
  var b = findBubble(currentBubbleId());
  r.style.setProperty('--wx-bubble-radius', (p.radius > 0 ? p.radius : b.radius) + 'px');
  if (!silent) setPrefs(p);
}
function applyTheme(id, opts) {
  opts = opts || {};
  var theme = findTheme(id);
  if (!theme) return false;
  var r = root(); if (!r) return false;
  if (theme.source === 'custom') {
    var cs = loadCustoms(), target = null;
    for (var i = 0; i < cs.length; i++) if (cs[i].id === theme.customId) target = cs[i];
    if (!target) return false;
    var s = sanitize(target.css);
    if (!s.ok) { showErrors(s.errors); return false; }
    setCustomStyle(s.clean);
  } else {
    setCustomStyle('');
  }
  THEME_VARS.forEach(function (k) { r.style.removeProperty(k); });
  if (theme.vars) Object.keys(theme.vars).forEach(function (k) { r.style.setProperty(k, theme.vars[k]); });
  r.setAttribute('data-wx-theme', id);
  var isDark = (id === 'dark-night');
  r.classList.toggle('av-wx-night', isDark);
  if (isDark) r.classList.remove('wx-dark-mode');
  syncNightVibe(isDark);
  applyBubbleVars(findBubble(currentBubbleId()));
  applyPrefs(true);
  if (!opts.silent) { lsSet(THEME_KEY, id); flash(r); render(); }
  return true;
}
function applyBubble(id, opts) {
  opts = opts || {};
  var b = findBubble(id);
  var r = root(); if (!r) return false;
  r.setAttribute('data-wx-bubble', id);
  applyBubbleVars(b);
  applyPrefs(true);
  if (!opts.silent) { lsSet(BUBBLE_KEY, id); flash(r); render(); }
  return true;
}
function applyCustomCss(css) {
  var s = sanitize(css);
  if (!s.ok) { showErrors(s.errors); return { ok: false, errors: s.errors }; }
  setCustomStyle(s.clean);
  return { ok: true, errors: [], clean: s.clean };
}
function saveCustom(name, css) {
  var s = sanitize(css);
  if (!s.ok) { showErrors(s.errors); return { ok: false, errors: s.errors }; }
  var cs = loadCustoms();
  var item = { id: uid('wxc'), name: (name || '自定义样式').trim() || '自定义样式', css: css, createdAt: Date.now() };
  cs.push(item); saveCustoms(cs);
  return { ok: true, id: item.id, errors: [] };
}
function deleteCustom(id) {
  var cs = loadCustoms().filter(function (c) { return c.id !== id; });
  saveCustoms(cs);
  if (currentThemeId() === 'custom:' + id) applyTheme('wechat-green');
  render();
  return true;
}
function exportCustom(id) {
  var cs = loadCustoms();
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i].css;
  return '';
}
function resetDefaults() {
  var p = { fontSize: 16, radius: 0, chatBg: '#ededed' };
  setPrefs(p);
  setCustomStyle('');
  applyTheme('wechat-green', { silent: true });
  applyBubble('classic-green', { silent: true });
  lsSet(THEME_KEY, 'wechat-green'); lsSet(BUBBLE_KEY, 'classic-green');
  var r = root(); if (r) flash(r);
  render();
  return true;
}
function setPref(key, value) {
  var p = getPrefs();
  if (key === 'fontSize') p.fontSize = Math.max(14, Math.min(18, +value || 16));
  else if (key === 'radius') p.radius = Math.max(0, Math.min(20, +value || 0));
  else if (key === 'chatBg') p.chatBg = String(value || '#ededed');
  else return false;
  setPrefs(p); applyPrefs(true);
  var b = findBubble(currentBubbleId()); applyBubbleVars(b);
  render();
  return true;
}
function render() {
  var cur = currentThemeId(), curB = currentBubbleId();
  var themeList = document.getElementById('wx-bc-theme-list');
  if (themeList) {
    var themes = scanThemes();
    themeList.innerHTML = themes.map(function (t) {
      var v = t.vars || {};
      var sw = ['--wx-bg-page', '--wx-accent', '--wx-bg-self', '--wx-bg-friend'].map(function (k) { return '<span style="background:' + esc(v[k] || '#cccccc') + '"></span>'; }).join('');
      return '<div class="wx-bc-card' + (t.id === cur ? ' wx-bc-active' : '') + '" data-wx-bc-theme="' + esc(t.id) + '" onclick="window.WxBeautifier.applyTheme(' + JSON.stringify(t.id) + ')"><div class="wx-bc-card-name">' + esc(t.name) + (t.id === cur ? ' <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</div><div class="wx-bc-card-desc">' + esc(t.desc || '') + ' · ' + esc(t.scope || '微信全部页面') + '</div><div class="wx-bc-swatches">' + sw + '</div></div>';
    }).join('');
  }
  var bubbleList = document.getElementById('wx-bc-bubble-list');
  if (bubbleList) {
    bubbleList.innerHTML = BUBBLES.map(function (b) {
      return '<div class="wx-bc-card' + (b.id === curB ? ' wx-bc-active' : '') + '" data-wx-bc-bubble="' + esc(b.id) + '" onclick="window.WxBeautifier.applyBubble(' + JSON.stringify(b.id) + ')"><div class="wx-bc-card-name">' + esc(b.name) + (b.id === curB ? ' <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</div><div class="wx-bc-card-desc">圆角 ' + b.radius + 'px · ' + (b.tail ? '有尾巴' : '无尾巴') + '</div><div class="wx-bc-swatches"><span style="background:' + esc(b.selfBg) + '"></span><span style="background:' + esc(b.friendBg) + '"></span></div></div>';
    }).join('');
  }
  var customList = document.getElementById('wx-bc-custom-list');
  if (customList) {
    var cs = loadCustoms();
    customList.innerHTML = cs.map(function (c) {
      return '<div class="wx-bc-custom-item"><span style="flex:1;">' + esc(c.name) + (('custom:' + c.id) === cur ? ' <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 当前' : '') + '</span><button type="button" onclick="window.WxBeautifier.applyTheme(' + JSON.stringify('custom:' + c.id) + ')">应用</button><button type="button" onclick="window.WxBeautifier.exportCustomToBox(' + JSON.stringify(c.id) + ')">导出</button><button type="button" onclick="window.WxBeautifier.deleteCustom(' + JSON.stringify(c.id) + ')">删除</button></div>';
    }).join('');
  }
  var p = getPrefs();
  var fs = document.getElementById('wx-bc-fontsize'); if (fs) fs.value = String(p.fontSize);
  var fsv = document.getElementById('wx-bc-fontsize-val'); if (fsv) fsv.textContent = String(p.fontSize);
  var rd = document.getElementById('wx-bc-radius'); if (rd) rd.value = String(p.radius);
  var rdv = document.getElementById('wx-bc-radius-val'); if (rdv) rdv.textContent = p.radius > 0 ? (p.radius + 'px') : '跟随气泡';
  var cb = document.getElementById('wx-bc-chatbg'); if (cb) cb.value = p.chatBg;
  var sum = document.getElementById('wx-bc-me-summary');
  if (sum) { var t = findTheme(cur), b = findBubble(curB); sum.textContent = (t ? t.name : cur) + ' · ' + b.name; }
}
function exportCustomToBox(id) {
  var css = exportCustom(id);
  var box = document.getElementById('wx-bc-custom-input');
  if (box) box.value = css;
  try {
    var blob = new Blob([css], { type: 'text/css' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'wechat-custom-theme.css';
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) {}
  return css;
}
function bindControls() {
  var fs = document.getElementById('wx-bc-fontsize');
  if (fs && !fs._bcBound) { fs._bcBound = true; fs.addEventListener('input', function () { setPref('fontSize', +fs.value); }); }
  var rd = document.getElementById('wx-bc-radius');
  if (rd && !rd._bcBound) { rd._bcBound = true; rd.addEventListener('input', function () { setPref('radius', +rd.value); }); }
  var cb = document.getElementById('wx-bc-chatbg');
  if (cb && !cb._bcBound) { cb._bcBound = true; cb.addEventListener('change', function () { setPref('chatBg', cb.value); }); }
  var ap = document.getElementById('wx-bc-custom-apply');
  if (ap && !ap._bcBound) { ap._bcBound = true; ap.addEventListener('click', function () { var box = document.getElementById('wx-bc-custom-input'); var r = applyCustomCss(box ? box.value : ''); if (r.ok) { var e = document.getElementById('wx-bc-custom-errors'); if (e) e.textContent = '校验通过，已应用到微信窗口。'; } }); }
  var sv = document.getElementById('wx-bc-custom-save');
  if (sv && !sv._bcBound) { sv._bcBound = true; sv.addEventListener('click', function () { var box = document.getElementById('wx-bc-custom-input'); var nm = document.getElementById('wx-bc-custom-name'); var r = saveCustom(nm ? nm.value : '', box ? box.value : ''); if (r.ok) render(); }); }
  var im = document.getElementById('wx-bc-custom-import');
  var fi = document.getElementById('wx-bc-custom-file');
  if (im && !im._bcBound) { im._bcBound = true; im.addEventListener('click', function () { if (fi) fi.click(); }); }
  if (fi && !fi._bcBound) { fi._bcBound = true; fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (!f) return; var rd2 = new FileReader(); rd2.onload = function () { var box = document.getElementById('wx-bc-custom-input'); if (box) box.value = String(rd2.result || ''); var r = applyCustomCss(String(rd2.result || '')); if (!r.ok) showErrors(r.errors); }; rd2.readAsText(f); }); }
  var rs = document.getElementById('wx-bc-reset');
  if (rs && !rs._bcBound) { rs._bcBound = true; rs.addEventListener('click', function () { resetDefaults(); }); }
}
function hookEngine() {
  var n = 0;
  var t = setInterval(function () {
    n++;
    try {
      var E = window.WeChatAppEngine;
      if (E && !E._bcWrapped) {
        E._bcWrapped = true;
        if (typeof E.renderUpdates === 'function') { var o = E.renderUpdates; E.renderUpdates = function () { var r = o.apply(E, arguments); try { applyTheme(currentThemeId(), { silent: true }); applyBubble(currentBubbleId(), { silent: true }); } catch (e) {} return r; }; }
        if (typeof E.openSubPage === 'function') { var o2 = E.openSubPage; E.openSubPage = function (pid) { var r = o2.apply(E, arguments); try { if (pid === 'beautifier') { render(); bindControls(); } } catch (e) {} return r; }; }
      }
      if (window.AppTheme && window.AppTheme.apply && !window.AppTheme._bcHooked) {
        window.AppTheme._bcHooked = true;
        var o3 = window.AppTheme.apply;
        window.AppTheme.apply = function () { var r = o3.apply(window.AppTheme, arguments); try { setTimeout(function () { applyTheme(currentThemeId(), { silent: true }); }, 0); } catch (e) {} return r; };
      }
      if (window.AFTheme && window.AFTheme.set && !window.AFTheme._bcHooked) {
        window.AFTheme._bcHooked = true;
        var o4 = window.AFTheme.set;
        window.AFTheme.set = function (id) { var r = o4.call(window.AFTheme, id); try { setTimeout(function () { applyTheme(currentThemeId(), { silent: true }); }, 0); } catch (e) {} return r; };
      }
    } catch (e) {}
    if (n > 20) clearInterval(t);
  }, 250);
}
function bcBoot() {
  try { applyTheme(currentThemeId(), { silent: true }); } catch (e) {}
  try { applyBubble(currentBubbleId(), { silent: true }); } catch (e) {}
  try { render(); bindControls(); } catch (e) {}
  try { hookEngine(); } catch (e) {}
  try { window.addEventListener('storage', function (e) { if (e && e.key === 'phone_ui_prefs_v1') setTimeout(function () { applyTheme(currentThemeId(), { silent: true }); }, 0); }); } catch (e) {}
}
window.WxThemes = {
  list: THEMES, bubbles: BUBBLES, scan: scanThemes,
  register: function (t) { if (!t || !t.id) return false; for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === t.id) return false; THEMES.push(t); return true; }
};
window.WxBeautifier = {
  THEMES: THEMES, BUBBLES: BUBBLES, scanThemes: scanThemes, sanitize: sanitize,
  applyTheme: applyTheme, applyBubble: applyBubble, applyCustomCss: applyCustomCss,
  saveCustom: saveCustom, deleteCustom: deleteCustom, exportCustom: exportCustom,
  exportCustomToBox: exportCustomToBox, getCustoms: loadCustoms,
  resetDefaults: resetDefaults, render: render, setPref: setPref, getPrefs: getPrefs,
  currentTheme: currentThemeId, currentBubble: currentBubbleId
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bcBoot);
else bcBoot();
})();
