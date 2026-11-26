
/* ══════════════════════════════════════════════════════════════
   D组 · 未上线功能上线 / 壁纸改白接线 / 控制中心同步 / 紧急呼叫
   只新增 AppManager 注册与全局 GroupD，不改 A/B/C 组区域。
   新增 localStorage 键（见各应用头部注释）。
   所有“机内模拟”均在界面上明确标注，不假装连接真实服务。
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ── 通用工具 ── */
var GD = {};
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var uid = function () { return 'gd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
var store = {
    get: function (k, def) { try { var r = localStorage.getItem(k); if (r == null) return def; return JSON.parse(r); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
var pad2 = function (n) { return String(n).padStart(2, '0'); };
var fmtDT = function (ts) { try { var d = new Date(ts); return (d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } catch (e) { return ''; } };
var fmtDur = function (sec) { sec = Math.max(0, Math.round(sec || 0)); if (sec < 60) return sec + '秒'; return Math.floor(sec / 60) + '分' + pad2(sec % 60) + '秒'; };
var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/* ── 微信真实数据（只读，不改原有结构）── */
function wxStore() {
    try { if (typeof AppRegistry !== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) return AppRegistry.wechat.wxStore; } catch (e) {}
    try { var r = localStorage.getItem('phone_wechat_store_v2'); if (r) return JSON.parse(r); } catch (e) {}
    return null;
}
function wxContacts() {
    var wx = wxStore(); var out = [];
    try {
        var ss = (wx && Array.isArray(wx.sessions)) ? wx.sessions : [];
        ss.forEach(function (s) {
            if (!s || s.isGroup || !s.name) return;
            out.push({ id: s.id || s.name, name: s.remark || s.name, remark: s.remark || '', avatar: s.avatar || (s.name || '?')[0], avatarImg: s.avatarImg || '', preview: s.preview || '', lastTime: s.lastTime || '' });
        });
    } catch (e) {}
    return out;
}
function manualContacts() { return store.get('phone_manual_contacts_v1', []); }
function allContacts() {
    var list = wxContacts().slice();
    manualContacts().forEach(function (c) { list.push({ id: c.id, name: c.name, remark: '', avatar: (c.name || '?')[0], avatarImg: '', preview: '手动添加', lastTime: '', number: c.number || '', manual: true }); });
    return list;
}
function curChar() {
    try { if (typeof SystemStore !== 'undefined') { var c = SystemStore.get('character'); if (c) return c; } } catch (e) {}
    var cs = wxContacts(); return cs.length ? cs[0].name : '他';
}
function worldBits() {
    // GROUP-BK: 没有角色上下文时只取全局条目（专属条目绝不漏到别人身上）；先查世界书再取。
    try {
        if (typeof WorldBook !== 'undefined' && WorldBook.firstGlobal) {
            const r = WorldBook.firstGlobal('weibo', '');
            return (r.entries || []).map(function (e) { return { title: e.title || '', content: String(e.content || '').slice(0, 60) }; }).slice(0, 3);
        }
        if (typeof WorldBook !== 'undefined' && WorldBook.getAll) {
            const out = [];
            WorldBook.getAll().forEach(function (e) {
                if (e && e.enabled !== false && (e.scope === 'global' || !e.scope) && (e.title || e.content)) out.push({ title: e.title || '', content: String(e.content || '').slice(0, 60) });
            });
            return out.slice(0, 3);
        }
    } catch (e) {}
    return [];
}
function worldCtxFor(charName) {
    try { if (typeof WorldBook !== 'undefined' && WorldBook.buildContext) { return WorldBook.buildContext('cike', charName, '') || ''; } } catch (e) {}
    return '';
}

/* ── 共享应用样式（每个应用 render 时内联一份，与设置/论坛做法一致）── */
var GD_CSS = '<style>'
+ '.gd-root{position:absolute;inset:0;background:#fffdfb;color:#2b2a28;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:40px;}'
+ '.gd-head{position:sticky;top:0;z-index:5;background:rgba(255,253,251,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:14px 18px 10px;border-bottom:1px solid #f0edea;}'
+ '.gd-back{font-size:15px;color:#8a8580;cursor:pointer;display:inline-flex;align-items:center;gap:2px;font-weight:500;}'
+ '.gd-title{font-size:26px;font-weight:600;letter-spacing:.5px;margin:6px 0 2px;color:#2b2a28;}'
+ '.gd-sub{font-size:12px;color:#9a958f;line-height:1.5;}'
+ '.gd-note{margin:12px 16px 0;padding:10px 12px;background:#fdf6ec;border:1px solid #f3e3c8;border-radius:14px;font-size:12px;line-height:1.7;color:#8a6d3b;}'
+ '.gd-body{padding:12px 16px 30px;}'
+ '.gd-card{background:#fff;border:1px solid #f0edea;border-radius:18px;padding:14px 16px;margin-bottom:10px;box-shadow:0 4px 16px rgba(90,75,60,.06);}'
+ '.gd-row{display:flex;align-items:center;gap:12px;cursor:pointer;}'
+ '.gd-av{width:44px;height:44px;border-radius:50%;background:#f3e9e2;color:#8a6d5a;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;flex-shrink:0;overflow:hidden;}'
+ '.gd-av img{width:100%;height:100%;object-fit:cover;}'
+ '.gd-btn{display:inline-block;background:#33363b;color:#fff;border:none;border-radius:16px;padding:11px 18px;font-size:15px;font-weight:500;cursor:pointer;text-align:center;}'
+ '.gd-btn:active{transform:scale(.97);}'
+ '.gd-btn-ghost{display:inline-block;background:#f4f1ee;color:#55524e;border:1px solid #ece7e2;border-radius:16px;padding:10px 16px;font-size:14px;font-weight:500;cursor:pointer;text-align:center;}'
+ '.gd-btn-danger{display:inline-block;background:#fff;color:#d33;border:1px solid #f3c8c8;border-radius:16px;padding:10px 16px;font-size:14px;font-weight:500;cursor:pointer;}'
+ '.gd-input{width:100%;box-sizing:border-box;border:1px solid #e9e4df;border-radius:14px;padding:11px 13px;font-size:15px;background:#fff;color:#2b2a28;outline:none;}'
+ '.gd-input:focus{border-color:#c9b8a3;}'
+ '.gd-label{font-size:12px;color:#9a958f;margin:14px 2px 6px;font-weight:500;letter-spacing:.5px;}'
+ '.gd-empty{text-align:center;color:#a8a29c;font-size:13px;line-height:2;padding:38px 20px;}'
+ '.gd-chip{display:inline-block;background:#f4f1ee;border:1px solid #ece7e2;border-radius:999px;padding:6px 12px;font-size:12px;color:#6d6862;margin:0 6px 6px 0;cursor:pointer;}'
+ '.gd-badge{display:inline-block;background:#fdf0e4;color:#b06a2a;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;}'
+ '.gd-tabbar{display:flex;gap:8px;margin:12px 16px 0;}'
+ '.gd-tab{flex:1;text-align:center;padding:10px 0;border-radius:14px;background:#f4f1ee;color:#6d6862;font-size:14px;font-weight:500;cursor:pointer;}'
+ '.gd-tab.on{background:#33363b;color:#fff;}'
+ '.gd-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:300px;margin:18px auto 0;}'
+ '.gd-key{height:64px;border-radius:50%;background:#f6f2ee;border:1px solid #ece7e2;font-size:26px;font-weight:400;color:#2b2a28;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
+ '.gd-key small{font-size:10px;color:#a8a29c;letter-spacing:2px;}'
+ '.gd-key:active{background:#ece5de;}'
+ '.gd-bubble{max-width:76%;padding:10px 13px;border-radius:18px;font-size:15px;line-height:1.6;margin-bottom:8px;word-break:break-word;}'
+ '.gd-bubble.me{margin-left:auto;background:#8fce9b;color:#fff;border-bottom-right-radius:6px;}'
+ '.gd-bubble.them{background:#fff;border:1px solid #efe9e4;border-bottom-left-radius:6px;}'
+ '.gd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;}'
+ '.gd-tile{aspect-ratio:1;background:#f3ede7;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;}'
+ '.gd-tile img{width:100%;height:100%;object-fit:cover;display:block;}'
+ '.gd-tile .gd-tile-cap{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.55));color:#fff;font-size:10px;padding:12px 6px 5px;}'
+ '.gd-bar{height:8px;border-radius:4px;background:#f0ebe6;overflow:hidden;}'
+ '.gd-bar>i{display:block;height:100%;border-radius:4px;background:#d9a05b;}'
+ '.gd-pager{display:flex;align-items:center;justify-content:space-between;margin-top:14px;}'
+ '.gd-story p{font-size:15px;line-height:2;color:#3d3a36;margin:0 0 12px;text-indent:2em;}'
+ '.gd-story h4{font-size:17px;margin:4px 0 10px;color:#2b2a28;}'
+ '/* GROUP-BA · BA-5/BA-9 信息 app 发送页 iOS 样式（仅 [data-gd="sms"] 作用域，不碰微信与其他应用；深色跟随手机主题） */'
+ '.gd-root[data-gd="sms"].ba-sms-thread .gd-head{display:none;}'
+ '.gd-root[data-gd="sms"].ba-sms-thread .gd-note{display:none;}'
+ '.gd-root[data-gd="sms"].ba-sms-thread .gd-body{padding:0;}'
+ '.gd-root[data-gd="sms"] .ba-sms-top{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:8px;padding:10px 12px 8px;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #e5e5ea;}'
+ '.gd-root[data-gd="sms"] .ba-sms-back{border:0;background:none;font-size:28px;line-height:1;color:#007AFF;cursor:pointer;padding:2px 8px 2px 0;flex-shrink:0;}'
+ '.gd-root[data-gd="sms"] .ba-sms-who{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-av{width:36px;height:36px;border-radius:50%;background:#e9e9eb;color:#555;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;flex-shrink:0;overflow:hidden;}'
+ '.gd-root[data-gd="sms"] .ba-sms-av-lg{width:64px;height:64px;font-size:28px;margin:0 auto;}'
+ '.gd-root[data-gd="sms"] .ba-sms-name{font-size:15px;font-weight:600;color:#000;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
+ '.gd-root[data-gd="sms"] .ba-sms-acts{display:flex;gap:0;flex-shrink:0;}'
+ '.gd-root[data-gd="sms"] .ba-sms-acts button{border:0;background:none;font-size:20px;line-height:1;color:#007AFF;cursor:pointer;padding:6px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-cap{text-align:center;font-size:11px;color:#8e8e93;padding:8px 0 2px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-stream{padding:6px 14px 10px;display:flex;flex-direction:column;}'
+ '.gd-root[data-gd="sms"] .ba-sms-row{display:flex;margin-bottom:2px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-row.me{justify-content:flex-end;}'
+ '.gd-root[data-gd="sms"] .ba-sms-row.them{justify-content:flex-start;}'
+ '.gd-root[data-gd="sms"] .gd-bubble.me{background:#007AFF;color:#fff;border:0;border-bottom-right-radius:4px;margin-left:auto;}'
+ '.gd-root[data-gd="sms"] .gd-bubble.them{background:#E9E9EB;color:#000;border:0;border-bottom-left-radius:4px;margin-right:auto;}'
+ '.gd-root[data-gd="sms"] .ba-sms-img{max-width:100%;border-radius:12px;display:block;}'
+ '.gd-root[data-gd="sms"] .ba-sms-time{text-align:center;font-size:11px;color:#8e8e93;margin:10px 0 6px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-date{text-align:center;font-size:11px;font-weight:600;color:#8e8e93;margin:12px 0 8px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-inputbar{position:sticky;bottom:0;z-index:6;display:flex;align-items:flex-end;gap:8px;padding:8px 10px 32px;background:#fff;border-top:1px solid #e5e5ea;} /* GROUP-BM BM-2：底垫 10px→32px，避开 Home 条 */'
+ '.gd-root[data-gd="sms"] .ba-sms-plus{width:32px;height:32px;border-radius:50%;border:0;background:#e9e9eb;color:#555;font-size:20px;line-height:1;cursor:pointer;flex-shrink:0;}'
+ '.gd-root[data-gd="sms"] .ba-sms-cam{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;padding:5px;flex-shrink:0;}'
+ '.gd-root[data-gd="sms"] .ba-sms-input{flex:1;min-width:0;box-sizing:border-box;border:1px solid #d1d1d6;border-radius:18px;padding:8px 12px;font-size:15px;line-height:1.4;background:#fff;color:#000;outline:none;resize:none;max-height:80px;overflow-y:auto;font-family:inherit;}'
+ '.gd-root[data-gd="sms"] .ba-sms-send{width:32px;height:32px;border-radius:50%;border:0;background:#c7c7cc;color:#fff;font-size:18px;line-height:1;cursor:default;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0 0 2px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-send.on{background:#007AFF;cursor:pointer;}'
+ '.gd-root[data-gd="sms"] .ba-sms-drawer{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#f2f2f7;border-top:1px solid #e5e5ea;}'
+ '.gd-root[data-gd="sms"] .ba-sms-drawer button{border:1px solid #e5e5ea;background:#fff;border-radius:14px;padding:9px 12px;font-size:13px;cursor:pointer;color:#111;}'
+ '.gd-root[data-gd="sms"] .ba-sms-emoji{display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;background:#f2f2f7;}'
+ '.gd-root[data-gd="sms"] .ba-sms-emoji button{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;padding:4px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-ctx{display:flex;gap:6px;justify-content:flex-end;margin:2px 0 8px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-row.them + .ba-sms-ctx{justify-content:flex-start;}'
+ '.gd-root[data-gd="sms"] .ba-sms-ctx button{border:1px solid #d1d1d6;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;color:#007AFF;}'
+ '.gd-root[data-gd="sms"] .ba-sms-meta{font-size:11px;color:#8e8e93;text-align:right;margin:0 4px 8px;}'
+ '.gd-root[data-gd="sms"] .ba-sms-toast{position:sticky;bottom:64px;z-index:7;margin:8px auto 0;width:max-content;max-width:80%;background:rgba(0,0,0,.78);color:#fff;font-size:12px;border-radius:999px;padding:6px 12px;text-align:center;}'
+ '.gd-root[data-gd="sms"] .ba-sms-ov{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}'
+ '.gd-root[data-gd="sms"] .ba-sms-card{background:#fff;border-radius:18px;padding:20px;width:100%;max-width:280px;text-align:center;box-sizing:border-box;}'
+ '.gd-root[data-gd="sms"] .ba-sms-bigimg{max-width:100%;max-height:60vh;border-radius:12px;display:block;margin:0 auto;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"].ba-sms-thread,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"].ba-sms-thread{background:#000;color:#f2f2f0;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-top,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-top{background:rgba(28,28,30,.94);border-color:#38383a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-name,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-name{color:#f2f2f0;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .gd-bubble.me,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .gd-bubble.me{background:#0A84FF;color:#fff;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .gd-bubble.them,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .gd-bubble.them{background:#26262b;color:#f2f2f0;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-inputbar,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-inputbar{background:#1c1c1e;border-color:#38383a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-input,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-input{background:#2c2c2e;color:#f2f2f0;border-color:#48484a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-plus,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-plus{background:#38383a;color:#f2f2f0;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-drawer,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-drawer,html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-emoji,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-emoji{background:#1c1c1e;border-color:#38383a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-drawer button,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-drawer button{background:#2c2c2e;color:#f2f2f0;border-color:#48484a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-ctx button,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-ctx button{background:#2c2c2e;color:#0A84FF;border-color:#48484a;}'
+ 'html[data-theme="dark"] .gd-root[data-gd="sms"] .ba-sms-card,html[data-theme-resolved="dark"] .gd-root[data-gd="sms"] .ba-sms-card{background:#1c1c1e;color:#f2f2f0;}'
+ '</style>';

/* ── 应用壳工厂：render/mount/resume 与设置/论坛同构 ── */
function gdApp(id, title, sub, note, renderBody, bindBody) {
    var state = { win: null };
    var refresh = function () {
        if (!state.win) return;
        var body = state.win.querySelector('#gd-body-' + id);
        if (!body) return;
        body.innerHTML = renderBody();
        try { bindBody(state.win); } catch (e) { console.warn('[GroupD] bind 失败', id, e); }
    };
    return {
        init: function () {},
        render: function () {
            return GD_CSS
                + '<div class="gd-root" data-gd="' + id + '">'
                + '<div class="gd-head"><span class="gd-back" data-gd-back>‹ 返回桌面</span>'
                + '<div class="gd-title">' + esc(title) + '</div>'
                + (sub ? '<div class="gd-sub">' + esc(sub) + '</div>' : '')
                + '</div>'
                + (note ? '<div class="gd-note">' + note + '</div>' : '')
                + '<div class="gd-body" id="gd-body-' + id + '"></div>'
                + '</div>';
        },
        mount: function (win) {
            state.win = win;
            var back = win.querySelector('[data-gd-back]');
            if (back) back.addEventListener('click', function () {
                try { if (typeof NavigationManager !== 'undefined') { NavigationManager.back(); return; } } catch (e) {}
                try { if (typeof AppManager !== 'undefined' && AppManager.minimize) AppManager.minimize(); } catch (e) {}
            });
            refresh();
        },
        resume: function (win) { state.win = win; refresh(); },
        show: function (win) { state.win = win; refresh(); },
        _refresh: refresh
    };
}
GD._gdApp = gdApp;

/* ══════════ 1. 习惯 · phone_habits_v1（GROUP-FIX7：日程 app 已删） ══════════
   GROUP-FIX7：独立的日程 app 整个删除（桌面入口、注册、增删改页面，
   原 IIFE 含 phone_schedule_v1 的增删改 UI 与保存提醒已整段移除）。
   习惯（GROUP-AD-HABITS，phone_habits_v1）原来寄生在日程页里当第二个
   标签，没有自己的 AppManager 注册；为不连带杀掉习惯，这里把它独立
   挂载为 'habits' app（GROUP-FIX7-HABITS），无桌面入口，只供习惯提醒
   点按进入。习惯代码本身一字未改。phone_schedule_v1 数据键不动，
   读它的提醒/来电/主动消息/导出等消费者也不动。 */
(function () {
    var app;
    var renderBody = function () {
        try { if (GD.habits) return GD.habits.renderPage(); } catch (e) {}
        return '<div class="gd-empty">习惯加载中…</div>';
    };
    var bindBody = function (win) {
        try { if (GD.habits) GD.habits.bind(win, app); } catch (e) {}
    };
    app = gdApp('habits', '习惯', '本机习惯 · 存在手机里，重启还在', '本地习惯打卡：只保存在这台手机里，不会同步到任何服务器。', renderBody, bindBody);
    GD.habitsApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('habits', app); } catch (e) {}
})();

/* ══════════ 2. 备忘录 · phone_memo_v1 ══════════
   [{id,content,updatedAt}] */
(function () {
    var KEY = 'phone_memo_v1';
    var load = function () { var a = store.get(KEY, []); return Array.isArray(a) ? a : []; };
    var save = function (a) { store.set(KEY, a); };
    var editingId = null; var q = '';
    var memoSaveTimer = null; /* [AD组] 备忘录自动保存 debounce 计时器 */
    var renderBody = function () {
        var items = load().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
        if (q) items = items.filter(function (x) { return (x.content || '').includes(q); });
        var html = '<div style="display:flex;gap:8px;"><input class="gd-input" id="gd-memo-q" placeholder="搜索备忘录…" value="' + esc(q) + '" style="flex:1;">'
            + '<button class="gd-btn" data-act="new">＋ 新建</button>'
            + '<button class="gd-btn-ghost" data-act="voice-memo">🎙 语音备忘</button></div>';
        if (editingId !== null) {
            var ed = load().find(function (x) { return x.id === editingId; });
            var content = ed ? ed.content : '';
            html += '<div class="gd-card" style="margin-top:12px;"><textarea class="gd-input" id="gd-memo-text" rows="10" placeholder="写点什么……" style="line-height:1.8;">' + esc(content) + '</textarea>'
                + (window.GroupAM ? window.GroupAM.memoStyleRow(ed) : '') + '<div style="display:flex;gap:8px;margin-top:10px;align-items:center;"><span id="gd-memo-autosave" style="flex:1;font-size:12px;color:#8a8580;">✓ 已自动保存</span>'
                + (ed ? '<button class="gd-btn-danger" data-act="del">删除</button>' : '')
                + '<button class="gd-btn-ghost" data-act="back">返回列表</button></div></div>';
            return html;
        }
        if (!items.length) { html += '<div class="gd-empty">还没有备忘录<br><span style="font-size:12px;">点「新建」写下第一条，存在本机。</span></div>'; return html; }
        items.forEach(function (it) {
            var lines = String(it.content || '').split('\n').filter(function (x) { return x.trim(); });
            html += '<div class="gd-card gd-row" data-act="open" data-id="' + it.id + '"' + (window.GroupAM ? window.GroupAM.memoCardAttr(it) : '') + '>'
                + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + esc(lines[0] || '（空备忘）') + '</div>'
                + '<div style="font-size:13px;color:#8a8580;margin-top:3px;line-height:1.5;">' + esc(String(it.content || '').slice(0, 60)) + '</div>'
                + '<div style="font-size:11px;color:#b5b0aa;margin-top:4px;">' + fmtDT(it.updatedAt) + '</div></div><span style="color:#c9c2bb;">›</span></div>';
        });
        return html;
    };
    var app;
    var bindBody = function (win) {
        if (!win._amMemoBound) {
            win._amMemoBound = true;
            win.addEventListener('change', function (ev) {
                try {
                    var t = ev.target; if (!t || !t.getAttribute) return;
                    var f = t.getAttribute('data-am-memo-field'); if (!f) return;
                    var v = (f === 'fontSize') ? (Number(t.value) || 15) : t.value;
                    if (editingId === 'new') { if (window.GroupAM) window.GroupAM._memoPending[f] = v; }
                    else {
                        var items = load(); var it = items.find(function (x) { return x.id === editingId; });
                        if (it) { it[f] = v; it.updatedAt = Date.now(); save(items); }
                    }
                    var ta = win.querySelector('#gd-memo-text');
                    if (ta) { if (f === 'fontSize') ta.style.fontSize = v + 'px'; if (f === 'font') ta.style.fontFamily = (window.GroupAM ? window.GroupAM.memoFontFamily(v) : 'inherit'); }
                } catch (e) {}
            });
        }
        var qi = win.querySelector('#gd-memo-q');
        if (qi) qi.addEventListener('input', function () { q = qi.value; var pos = qi.selectionStart; app._refresh(); var nq = win.querySelector('#gd-memo-q'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } });
        /* [AD组] 备忘录自动保存：输入后 debounce 600ms 写盘，不用点保存按钮；键与格式不变。 */
        var _adTa = win.querySelector('#gd-memo-text');
        if (_adTa) _adTa.addEventListener('input', function () {
            var _txt = _adTa.value; var _rid = _adTa.dataset.adMemoId || editingId;
            var _st = win.querySelector('#gd-memo-autosave'); if (_st) _st.textContent = '正在保存…';
            if (memoSaveTimer) clearTimeout(memoSaveTimer);
            memoSaveTimer = setTimeout(function () {
                var _items = load();
                if (_rid === 'new') {
                    if (_txt.trim()) { var _nm = Object.assign({ id: uid(), content: _txt, updatedAt: Date.now() }, (window.GroupAM ? window.GroupAM.memoDefaults() : {})); _items.unshift(_nm); save(_items); _adTa.dataset.adMemoId = _nm.id; }
                } else {
                    var _it = _items.find(function (x) { return x.id === _rid; });
                    if (_it) { _it.content = _txt; _it.updatedAt = Date.now(); save(_items); }
                }
                var _st2 = win.querySelector('#gd-memo-autosave'); if (_st2) _st2.textContent = '✓ 已自动保存 ' + fmtDT(Date.now());
            }, 600);
        });
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-act'); var id = btn.getAttribute('data-id');
                var items = load();
                if (act === 'voice-memo') { if (window.GroupBG) window.GroupBG.openVoiceMemos(); }
                else if (act === 'new') { editingId = 'new'; app._refresh(); var t = win.querySelector('#gd-memo-text'); if (t) t.focus(); }
                else if (act === 'open') { editingId = id; app._refresh(); }
                else if (act === 'back') { editingId = null; app._refresh(); }
                else if (act === 'save') {
                    var text = (win.querySelector('#gd-memo-text') || {}).value || '';
                    if (!text.trim()) { alert('内容是空的'); return; }
                    if (editingId === 'new') items.unshift(Object.assign({ id: uid(), content: text, updatedAt: Date.now() }, (window.GroupAM ? window.GroupAM.memoDefaults() : {})));
                    else { var it = items.find(function (x) { return x.id === editingId; }); if (it) { it.content = text; it.updatedAt = Date.now(); } }
                    save(items); editingId = null; app._refresh();
                }
                else if (act === 'del') { save(items.filter(function (x) { return x.id !== editingId; })); editingId = null; app._refresh(); }
            };
        });
    };
    app = gdApp('memo', '备忘录', '本机记事 · 写完就存', '本地备忘录：只保存在这台手机里。', renderBody, bindBody);
    GD.memoApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('memo', app); } catch (e) {}
})();

/* ══════════ 3. 电话 · phone_call_log_v1 + phone_manual_contacts_v1 ══════════
   通话记录 [{id,name,number,type:'outgoing',time,duration}]；
   联系人读微信 wxStore 会话（只读），手动联系人存 phone_manual_contacts_v1。 */
(function () {
    var LOG_KEY = 'phone_call_log_v1';
    var loadLog = function () { var a = store.get(LOG_KEY, []); return Array.isArray(a) ? a : []; };
    var saveLog = function (a) { store.set(LOG_KEY, a); };
    var tab = 'keypad'; var dial = ''; var callState = null; var callTimer = null;
    var bhMuted = false; var bhSpeaker = false; var bhInKeypad = false; var bhInCallDial = '';
    var endCall = function (win) {
        if (callTimer) { clearInterval(callTimer); callTimer = null; }
        if (callState) {
            var sec = Math.round((Date.now() - callState.startedAt) / 1000);
            var logs = loadLog();
            logs.unshift({ id: uid(), name: callState.name, number: callState.number, type: 'outgoing', time: Date.now(), duration: fmtDur(sec) });
            try { if (window.GroupAH) window.GroupAH.onCallEnd(callState, sec); } catch (e) {}
            saveLog(logs.slice(0, 100));
        }
        callState = null;
        try { if (window.DynamicIsland) window.DynamicIsland.endActivity('call'); } catch (e) {}
        if (win) app._refresh();
    };
    var startCall = function (win, name, number) {
        callState = { name: name, number: number, startedAt: Date.now(), sec: 0 };
        try { if (window.DynamicIsland) window.DynamicIsland.showActivity({ type: 'call', source: 'phone', name: name, number: number, startedAt: Date.now(), phase: 'calling' }); } catch (e) {}
        bhMuted = false; bhSpeaker = false; bhInKeypad = false; bhInCallDial = '';
        try { if (window.GroupAH) window.GroupAH.onCallStart(name, number); } catch (e) {}
        // [AO] 回拨 char：慢回答——先响 5 秒，期间可点“改发文字”转消息
        try {
            if (window.GroupAO && window.GroupAO.isCharName(name)) {
                callState.ringing = true;
                setTimeout(function () { if (callState) { callState.ringing = false; app._refresh(); } }, 5000);
            }
        } catch (e) {}
        app._refresh();
        callTimer = setInterval(function () {
            if (!callState) return;
            callState.sec = Math.round((Date.now() - callState.startedAt) / 1000);
            var el = win.querySelector('#gd-call-timer');
            if (el) el.textContent = fmtDur(callState.sec);
        }, 1000);
    };
    var renderBody = function () {
        var html = '';
        var tabbar = '<div class="bh-tabbar">'
            + '<div class="bh-tab' + (tab === 'favorites' ? ' on' : '') + '" data-tab="favorites"><span class="bh-tab-ic">★</span>个人收藏</div>'
            + '<div class="bh-tab' + (tab === 'recents' ? ' on' : '') + '" data-tab="recents"><span class="bh-tab-ic">◷</span>最近通话</div>'
            + '<div class="bh-tab' + (tab === 'contacts' ? ' on' : '') + '" data-tab="contacts"><span class="bh-tab-ic">👤</span>通讯录</div>'
            + '<div class="bh-tab' + (tab === 'keypad' ? ' on' : '') + '" data-tab="keypad"><span class="bh-tab-ic">▦</span>拨号键盘</div>'
            + '<div class="bh-tab' + (tab === 'voicemail' ? ' on' : '') + '" data-tab="voicemail"><span class="bh-tab-ic">◉</span>语音留言</div></div>';
        if (callState) {
            html += '<div class="bh-incall">'
                + '<div class="bh-incall-av">' + esc((callState.name || '?')[0]) + '</div>'
                + '<div class="bh-incall-name">' + esc(callState.name) + '</div>'
                + '<div class="bh-incall-num">' + esc(callState.number) + '</div>'
                + (callState.ringing ? '<div class="bh-incall-status">正在呼叫 TA…约 5 秒后接通</div><button class="gd-btn-ghost" data-act="ao-text-instead" style="margin-top:12px;">改发文字</button>' : '<div class="bh-incall-status" id="gd-call-timer">0秒</div>')
                + '<div class="bh-incall-sim">' + (function(){ try { return window.GroupAH ? window.GroupAH.callModeLabel() : '机内模拟通话 · 没有真的拨出去，对方是机内模拟。'; } catch (e) { return '机内模拟通话 · 没有真的拨出去，对方是机内模拟。'; } })() + '</div>'
                + '<div class="bh-call-note" id="bh-call-note">' + (bhMuted ? '已静音（模拟通话）' : (bhSpeaker ? '免提已开（模拟通话）' : '')) + '</div>'
                + (bhInKeypad ? '<div class="bh-inkeypad-display" id="bh-inkeypad-display">' + (bhInCallDial ? '已拨：' + esc(bhInCallDial) : '拨号键盘（模拟）') + '</div><div class="bh-mini-keys">' + [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].map(function (k) { return '<div class="bh-mini-key" data-key2="' + k[0] + '">' + k[0] + '</div>'; }).join('') + '</div>' : '')
                + '<div class="bh-grid">'
                + '<button type="button" class="bh-grid-btn' + (bhMuted ? ' on' : '') + '" data-act="bh-mute"><span class="bh-grid-ic">🔇</span>静音</button>'
                + '<button type="button" class="bh-grid-btn' + (bhSpeaker ? ' on' : '') + '" data-act="bh-speaker"><span class="bh-grid-ic">🔊</span>免提</button>'
                + '<button type="button" class="bh-grid-btn' + (bhInKeypad ? ' on' : '') + '" data-act="bh-inkeypad"><span class="bh-grid-ic">▦</span>拨号键盘</button>'
                + '<button type="button" class="bh-grid-btn" data-act="bh-addcall"><span class="bh-grid-ic">＋</span>添加通话</button>'
                + '<button type="button" class="bh-grid-btn" data-act="bh-facetime"><span class="bh-grid-ic">📹</span>FaceTime</button>'
                + '<button type="button" class="bh-grid-btn" data-act="bh-incontacts"><span class="bh-grid-ic">👤</span>通讯录</button>'
                + '</div>'
                + '<button class="bh-end" data-act="hangup" aria-label="结束通话"><span class="bh-end-ic">☎</span></button></div>';
            return html;
        }
        if (tab === 'favorites') {
            var favNames = (window.GroupBH && window.GroupBH.listFavorites) ? window.GroupBH.listFavorites() : [];
            var favList = allContacts().filter(function (c) { return favNames.indexOf(c.name) !== -1; });
            if (!favList.length) { html += '<div class="gd-empty">还没有个人收藏<br><span style="font-size:12px;">去通讯录点 ☆ 收藏一个人，这里会置顶显示。</span></div>'; }
            favList.forEach(function (c) {
                html += '<div class="gd-card gd-row" data-act="call-contact" data-name="' + esc(c.name) + '" data-num="' + esc(c.number || c.name) + '">'
                    + '<div class="gd-av">' + (c.avatarImg ? '<img src="' + esc(c.avatarImg) + '">' : esc(c.avatar)) + '</div>'
                    + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + esc(c.name) + '</div>'
                    + '<div style="font-size:12px;color:#9a958f;">个人收藏 · ' + esc(c.manual ? '手动添加' : (c.preview || '微信联系人')) + '</div></div>'
                    + '<span style="font-size:20px;color:#FF9500;">★</span></div>';
            });
        } else if (tab === 'keypad') {
            var keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
            html += '<div style="text-align:center;font-size:30px;font-weight:300;letter-spacing:3px;min-height:40px;margin-top:18px;">' + esc(dial || ' ') + '</div>'
                + '<div class="gd-keypad">' + keys.map(function (k) { return '<div class="gd-key" data-key="' + k[0] + '">' + k[0] + (k[1] ? '<small>' + k[1] + '</small>' : '') + '</div>'; }).join('') + '</div>'
                + '<div class="bh-dial-actions"><button class="bh-call-btn" data-act="call" aria-label="拨打">☎</button>'
                + '<button class="bh-del-btn" data-act="backspace" aria-label="删除">⌫</button></div>'
                + '<div style="text-align:center;margin-top:18px;"><button class="gd-btn-ghost" data-act="emergency">🚨 紧急呼叫</button></div>'
                + '<div style="text-align:center;margin-top:12px;"><button class="gd-btn-ghost" data-act="bh-ringtone" style="font-size:13px;">🔔 电话铃声设置</button></div>'
                + '<div class="gd-note">拨号为机内模拟通话：接通后显示通话界面、计时，挂断后记入通话记录，不会真的拨出。</div>';
        } else if (tab === 'contacts') {
            var list = allContacts();
            html += '<div style="display:flex;gap:8px;"><input class="gd-input" id="gd-man-name" placeholder="手动添加联系人姓名" style="flex:1;"><input class="gd-input" id="gd-man-num" placeholder="号码" style="width:120px;"><button class="gd-btn" data-act="add-contact">添加</button></div>';
            if (!list.length) { html += '<div class="gd-empty">还没有联系人<br><span style="font-size:12px;">去微信添加好友后会出现在这里，也可以上面手动添加。</span></div>'; }
            list.forEach(function (c) {
                html += '<div class="gd-card gd-row" data-act="call-contact" data-name="' + esc(c.name) + '" data-num="' + esc(c.number || c.name) + '">'
                    + '<div class="gd-av">' + (c.avatarImg ? '<img src="' + esc(c.avatarImg) + '">' : esc(c.avatar)) + '</div>'
                    + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + esc(c.name) + '</div>'
                    + '<div style="font-size:12px;color:#9a958f;">' + esc(c.manual ? '手动添加' : (c.preview || '微信联系人')) + '</div></div>'
                    + '<span style="font-size:20px;color:#FF9500;cursor:pointer;" data-act="fav-toggle" data-name="' + esc(c.name) + '">' + ((window.GroupBH && window.GroupBH.isFavorite(c.name)) ? '★' : '☆') + '</span><span style="font-size:20px;color:#34a853;">📞</span></div>';
            });
        } else if (tab === 'voicemail') {
            var vms = (window.GroupBH && window.GroupBH.listVoicemail) ? window.GroupBH.listVoicemail() : [];
            html += '<div class="gd-label" style="margin-top:6px;">语音留言</div>';
            html += '<button class="gd-btn-ghost" data-act="vm-record" style="width:100%;">' + ((window.GroupBH && window.GroupBH.isRecording && window.GroupBH.isRecording()) ? '■ 停止并保存' : '● 录一段留言') + '</button>';
            html += '<div class="gd-note">来电未接时，对方没有留下语音，这里只会显示“未接来电 · 未留语音”。你也可以录一段自己的留言，存在本机，可播放、可删除。</div>';
            if (!vms.length) { html += '<div class="gd-empty">还没有语音留言<br><span style="font-size:12px;">点上面录一段，或等一通未接来电。</span></div>'; }
            vms.forEach(function (v) {
                html += '<div class="gd-card gd-row"><div class="gd-av">' + esc((v.from || '?')[0]) + '</div>'
                    + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + esc(v.from) + '</div>'
                    + '<div style="font-size:12px;color:#9a958f;">' + esc(v.label) + ' · ' + fmtDT(v.time) + (v.dur ? ' · ' + esc(v.dur) : '') + '</div></div>'
                    + (v.audio ? '<button class="gd-btn-ghost" data-act="vm-play" data-id="' + esc(v.id) + '" style="padding:8px 12px;font-size:13px;">▶ 播放</button>' : '')
                    + (v.kind === 'rec' ? '<button class="gd-btn-ghost" data-act="vm-del" data-id="' + esc(v.id) + '" style="padding:8px 12px;font-size:13px;">删除</button>' : '') + '</div>';
            });
            html += '<div class="gd-note">录音存在本机（phone_voicemail_v1），随整屋备份走；单个录音超过 2MB 不保存。</div>';
        } else {
            var logs = loadLog();
            if (!logs.length) { html += '<div class="gd-empty">还没有通话记录<br><span style="font-size:12px;">拨打一次机内模拟电话后，这里会出现记录。</span></div>'; }
            logs.forEach(function (l) {
                html += '<div class="gd-card gd-row" data-act="redial" data-name="' + esc(l.name) + '" data-num="' + esc(l.number) + '"><div class="gd-av">' + esc((l.name || '?')[0]) + '</div>'
                    + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;' + (l.type === 'missed' ? 'color:#FF3B30;' : '') + '">' + esc(l.name) + '</div>'
                    + '<div style="font-size:12px;color:' + (l.type === 'missed' ? '#FF3B30' : '#9a958f') + ';">' + (l.type === 'incoming' ? '↙ 接入' : (l.type === 'missed' ? '↙ 未接来电' : '↗ 拨出')) + ' · ' + fmtDT(l.time) + (l.duration ? ' · ' + esc(l.duration) : '') + '</div>' + (l.summary ? '<div style="font-size:12px;color:#8a8580;margin-top:2px;">' + esc(l.summary) + '</div>' : '') + '</div>'
                    + '<button class="gd-btn-ghost" data-act="sms-recents" data-name="' + esc(l.name) + '" data-num="' + esc(l.number) + '" style="padding:8px 12px;font-size:13px;">短信</button><button class="gd-btn-ghost" data-act="redial" data-name="' + esc(l.name) + '" data-num="' + esc(l.number) + '" style="padding:8px 12px;font-size:13px;">回拨</button></div>';
            });
            if (logs.length) html += '<button class="gd-btn-ghost" data-act="clear-log" style="width:100%;">清空通话记录</button>';
            html += '<button class="gd-btn-ghost" data-act="ao-test-call" style="width:100%;margin-top:8px;">📞 让 TA 打来（模拟来电）</button>';
        }
        return html + tabbar;
    };
    var app;
    var bindBody = function (win) {
        win.querySelectorAll('[data-tab]').forEach(function (t) { t.onclick = function () { tab = t.getAttribute('data-tab'); app._refresh(); }; });
        win.querySelectorAll('[data-key]').forEach(function (k) { k.onclick = function () { dial += k.getAttribute('data-key'); app._refresh(); }; });
        win.querySelectorAll('[data-key2]').forEach(function (k) { k.onclick = function () { bhInCallDial += k.getAttribute('data-key2'); try { if (window.GroupBH) window.GroupBH.dtmf(k.getAttribute('data-key2')); } catch (e) {} var d = win.querySelector('#bh-inkeypad-display'); if (d) d.textContent = '已拨：' + bhInCallDial; }; });
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function (ev) {
                var act = btn.getAttribute('data-act');
                if (act === 'call') { if (!dial.trim()) { alert('请先输入号码'); return; } startCall(win, dial, dial); }
                else if (act === 'backspace') { dial = dial.slice(0, -1); app._refresh(); }
                else if (act === 'hangup') { endCall(win); }
                else if (act === 'ao-text-instead') { if (callTimer) { clearInterval(callTimer); callTimer = null; } callState = null; try { if (window.DynamicIsland) window.DynamicIsland.endActivity('call'); } catch (e) {} if (window.GroupAO) window.GroupAO.callToText(); app._refresh(); }
                else if (act === 'emergency') { if (window.GroupD) GroupD.openEmergency(); }
                else if (act === 'call-contact' || act === 'redial') { if (ev) ev.stopPropagation(); startCall(win, btn.getAttribute('data-name'), btn.getAttribute('data-num')); }
                else if (act === 'add-contact') {
                    var nm = (win.querySelector('#gd-man-name') || {}).value || '';
                    var nb = (win.querySelector('#gd-man-num') || {}).value || '';
                    if (!nm.trim()) { alert('请先写姓名'); return; }
                    var arr = manualContacts(); arr.push({ id: uid(), name: nm.trim(), number: nb.trim() || nm.trim() }); store.set('phone_manual_contacts_v1', arr); app._refresh();
                }
                else if (act === 'clear-log') { saveLog([]); app._refresh(); }
                else if (act === 'fav-toggle') { if (ev) ev.stopPropagation(); if (window.GroupBH) window.GroupBH.toggleFavorite(btn.getAttribute('data-name')); app._refresh(); }
                else if (act === 'sms-recents') { if (ev) ev.stopPropagation(); var _nm = btn.getAttribute('data-name'), _nb = btn.getAttribute('data-num'); var _ths = []; try { _ths = store.get('phone_sms_v1', []); } catch (e) {} if (!Array.isArray(_ths)) _ths = []; if (!_ths.some(function (x) { return x.name === _nm; })) { _ths.unshift({ id: uid(), name: _nm, number: _nb, messages: [] }); try { store.set('phone_sms_v1', _ths); } catch (e) {} } try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('sms'); } catch (e) {} }
                else if (act === 'bh-ringtone') { try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('settings'); } catch (e) {} alert('已打开设置 app，请点“电话铃声”'); }
                else if (act === 'bh-mute') { bhMuted = !bhMuted; var _n = win.querySelector('#bh-call-note'); if (_n) _n.textContent = bhMuted ? '已静音（模拟通话）' : ''; app._refresh(); }
                else if (act === 'bh-speaker') { bhSpeaker = !bhSpeaker; var _n2 = win.querySelector('#bh-call-note'); if (_n2) _n2.textContent = bhSpeaker ? '免提已开（模拟通话）' : ''; app._refresh(); }
                else if (act === 'bh-inkeypad') { bhInKeypad = !bhInKeypad; app._refresh(); }
                else if (act === 'bh-addcall') { var _n3 = win.querySelector('#bh-call-note'); if (_n3) _n3.textContent = '模拟通话不支持添加通话'; }
                else if (act === 'bh-facetime') { var _n4 = win.querySelector('#bh-call-note'); if (_n4) _n4.textContent = '模拟通话不支持 FaceTime'; }
                else if (act === 'bh-incontacts') { var _n5 = win.querySelector('#bh-call-note'); if (_n5) _n5.textContent = '通话中查看通讯录暂不支持（模拟通话）'; }
                else if (act === 'vm-play') { if (window.GroupBH) window.GroupBH.playVoicemail(btn.getAttribute('data-id')); }
                else if (act === 'vm-del') { if (window.GroupBH) { var _r = window.GroupBH.deleteVoicemail(btn.getAttribute('data-id')); if (!_r.ok) alert('未接来电记录请去“最近通话”里清空'); app._refresh(); } }
                else if (act === 'vm-record') { if (window.GroupBH) { if (window.GroupBH.isRecording()) { window.GroupBH.stopRecording(); } else { window.GroupBH.startRecording(function (st) { if (st && st.started) { app._refresh(); return; } if (st && st.ok) { alert('录音已保存到语音留言'); } else { alert('录音失败：' + (st && st.reason === 'no-recorder' ? '本机不支持录音' : (st && st.reason === 'too-big' ? '录音超过 2MB，未保存' : '未获得麦克风权限'))); } app._refresh(); }); setTimeout(function () { app._refresh(); }, 800); } } }
                else if (act === 'ao-test-call') { if (window.GroupAO) window.GroupAO.testIncomingCall('checkin'); }
            };
        });
    };
    app = gdApp('phone', '电话', '个人收藏 · 最近通话 · 通讯录 · 拨号键盘 · 语音留言', '联系人来自微信会话（只读）；拨号为机内模拟通话，不会真的拨出。', renderBody, bindBody);
    GD.phoneApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('phone', app); } catch (e) {}
})();

/* ══════════ 4. 信息 · phone_sms_v1 ══════════
   threads [{id,name,number,messages:[{from:'me'|'them',text,time}]}] */
(function () {
    var KEY = 'phone_sms_v1';
    var load = function () { var a = store.get(KEY, []); return Array.isArray(a) ? a : []; };
    var save = function (a) { store.set(KEY, a); };
    var threadId = null;
    // GROUP-BA · BA-7 信息发送页 UI 状态（只存内存，不落 localStorage、不新增键）
    var smsDrawerOpen = false, smsEmojiOpen = false, smsMenuIdx = -1, smsMoreIdx = -1;
    var smsToast = '', smsVideoOpen = false, smsDetailOpen = false, smsBigImg = '', smsDraft = '';
    var REPLIES = [
        { k: ['你好', '在吗', '在么', 'hi', 'hello'], r: ['在呢，怎么啦？', '在的，刚看到消息。'] },
        { k: ['吃饭', '吃了吗', '饿'], r: ['还没吃呢，你吃了没？', '正想问你吃什么，要不要一起？'] },
        { k: ['天气'], r: ['今天天气还行，出门记得看时间。', '我这边看着还不错，你那边呢？'] },
        { k: ['晚安', '睡了', '睡觉'], r: ['晚安，好梦。', '早点睡，别熬夜啦。'] },
        { k: ['谢谢', '谢啦'], r: ['不客气呀。', '小事～'] },
        { k: ['想你', '想你了'], r: ['我也想你。', '突然这么说……我也想你。'] }
    ];
    var autoReply = function (text) {
        for (var i = 0; i < REPLIES.length; i++) {
            var hit = REPLIES[i].k.some(function (k) { return text.indexOf(k) !== -1; });
            if (hit) return REPLIES[i].r[Math.floor(Math.random() * REPLIES[i].r.length)];
        }
        return ['收到啦，我晚点回你。', '嗯嗯，我知道了。', '好呀，那就这么说定了。', '哈哈，这个有意思。'][Math.floor(Math.random() * 4)];
    };
    var renderBody = function () {
        var threads = load().slice().sort(function (a, b) {
            var la = a.messages.length ? a.messages[a.messages.length - 1].time : 0;
            var lb = b.messages.length ? b.messages[b.messages.length - 1].time : 0;
            return lb - la;
        });
        if (threadId) {
            var th = load().find(function (x) { return x.id === threadId; });
            if (!th) { threadId = null; return renderBody(); }
            // GROUP-BA · BA-6 信息发送页按 iOS 重做（只改 UI：收发与存储逻辑不动）
            var dayKey = function (ts) { var d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
            var dayLabel = function (ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_CN[d.getDay()]; };
            var streamHtml = '';
            var prevTs = 0, prevDay = '';
            th.messages.forEach(function (m, i) {
                var dk = dayKey(m.time);
                if (dk !== prevDay) { streamHtml += '<div class="ba-sms-date">' + dayLabel(m.time) + '</div>'; prevDay = dk; prevTs = 0; }
                else if (!prevTs || (m.time - prevTs) > 10 * 60 * 1000) { streamHtml += '<div class="ba-sms-time">' + fmtDT(m.time) + '</div>'; }
                prevTs = m.time;
                var inner = '';
                if (m.img) inner += '<img class="ba-sms-img" src="' + esc(m.img) + '" alt="图片">';
                if (m.text) inner += esc(m.text);
                if (!inner) inner = '[图片]';
                streamHtml += '<div class="ba-sms-row ' + (m.from === 'me' ? 'me' : 'them') + '"><div class="gd-bubble ba-sms-bubble ' + (m.from === 'me' ? 'me' : 'them') + '" data-ba-idx="' + i + '">' + inner + '</div></div>';
                if (smsMenuIdx === i) {
                    streamHtml += '<div class="ba-sms-ctx"><button data-act="copy" data-idx="' + i + '">复制</button><button data-act="reply" data-idx="' + i + '">回复</button><button data-act="more" data-idx="' + i + '">更多</button><button data-act="ctx-done">完成</button></div>';
                    if (smsMoreIdx === i) streamHtml += '<div class="ba-sms-meta">' + fmtDT(m.time) + ' · 来自' + (m.from === 'me' ? '我' : '对方') + ' · 仅存于本机</div>';
                }
            });
            if (!th.messages.length) streamHtml = '<div class="gd-empty">还没有短信<br><span style="font-size:12px;">在下面输入第一条消息吧，只存在本机。</span></div>';
            var drawerHtml = '';
            if (smsDrawerOpen) {
                drawerHtml = '<div class="ba-sms-drawer"><button data-act="camera">📷 相机</button><button data-act="photo">🖼️ 照片</button><button data-act="drawer-emoji">😀 表情包</button><button data-act="loc">📍 位置</button></div>'
                    + (smsEmojiOpen ? '<div class="ba-sms-emoji">' + ['😀','😂','🥰','😭','😡','👍','❤️','🎉','😴','🤔'].map(function (e) { return '<button data-act="emoji-pick" data-emoji="' + e + '">' + e + '</button>'; }).join('') + '</div>' : '');
            }
            var ovHtml = '';
            if (smsVideoOpen) ovHtml = '<div class="ba-sms-ov"><div class="ba-sms-card"><div class="ba-sms-av ba-sms-av-lg">' + esc((th.name || '?')[0]) + '</div><div style="font-size:17px;font-weight:600;margin:10px 0 4px;">' + esc(th.name) + '</div><div style="font-size:12px;color:#8e8e93;line-height:1.7;">模拟视频通话<br>不会真的拨出 · 仅本机模拟</div><button class="gd-btn-danger" style="margin-top:14px;width:100%;" data-act="video-end">挂断</button></div></div>';
            if (smsDetailOpen) ovHtml = '<div class="ba-sms-ov"><div class="ba-sms-card"><div class="ba-sms-av ba-sms-av-lg">' + esc((th.name || '?')[0]) + '</div><div style="font-size:17px;font-weight:600;margin:10px 0 4px;">' + esc(th.name) + '</div><div style="font-size:13px;color:#666;line-height:1.9;text-align:left;">号码：' + esc(th.number || '暂无') + '<br>短信：机内短信，仅存于本机<br>对方回复为机内模拟回复</div><button class="gd-btn-ghost" style="margin-top:14px;width:100%;" data-act="detail-close">关闭</button></div></div>';
            if (smsBigImg) ovHtml = '<div class="ba-sms-ov"><div class="ba-sms-card"><img class="ba-sms-bigimg" src="' + esc(smsBigImg) + '" alt="大图"><button class="gd-btn-ghost" style="margin-top:14px;width:100%;" data-act="bigimg-close">关闭</button></div></div>';
            var html = '<div class="ba-sms-top"><button class="ba-sms-back" data-act="back" aria-label="返回会话列表">‹</button>'
                + '<div class="ba-sms-who"><div class="ba-sms-av">' + esc((th.name || '?')[0]) + '</div><div class="ba-sms-name">' + esc(th.name) + '</div></div>'
                + '<div class="ba-sms-acts"><button data-act="video" aria-label="视频通话（模拟）" title="视频通话（模拟）">📹</button><button data-act="detail" aria-label="详情" title="详情">ⓘ</button></div></div>'
                + '<div class="ba-sms-cap">机内短信 · 仅存于本机</div>'
                + '<div id="gd-sms-stream" class="ba-sms-stream">' + streamHtml + '</div>'
                + (smsToast ? '<div class="ba-sms-toast">' + esc(smsToast) + '</div>' : '')
                + drawerHtml
                + '<div class="ba-sms-inputbar"><button class="ba-sms-plus" data-act="plus" aria-label="更多">＋</button><button class="ba-sms-cam" data-act="photo" aria-label="照片">📷</button><textarea class="ba-sms-input" id="gd-sms-input" rows="1" placeholder="iMessage">' + esc(smsDraft) + '</textarea><button class="ba-sms-send" data-act="send" disabled aria-label="发送">↑</button></div>'
                + '<input type="file" id="ba-sms-file" accept="image/*" hidden><input type="file" id="ba-sms-file-cam" accept="image/*" capture="environment" hidden>'
                + ovHtml;
            return html;
        }
        var html = '<div class="gd-label" style="margin-top:0;">新建会话</div><div style="display:flex;gap:8px;flex-wrap:wrap;">'
            + allContacts().slice(0, 8).map(function (c) { return '<span class="gd-chip" data-act="new-thread" data-name="' + esc(c.name) + '">' + esc(c.name) + '</span>'; }).join('')
            + '</div><div style="display:flex;gap:8px;margin-top:6px;"><input class="gd-input" id="gd-sms-newname" placeholder="或输入对方名字…" style="flex:1;"><button class="gd-btn" data-act="new-custom">新建</button></div>';
        if (!threads.length) { html += '<div class="gd-empty">还没有短信会话<br><span style="font-size:12px;">点上面的人名新建一条，消息只存在本机。</span></div>'; return html; }
        threads.forEach(function (th) {
            var last = th.messages[th.messages.length - 1];
            html += '<div class="gd-card gd-row" data-act="open" data-id="' + th.id + '"><div class="gd-av">' + esc((th.name || '?')[0]) + '</div>'
                + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + esc(th.name) + '</div>'
                + '<div style="font-size:13px;color:#8a8580;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(last ? last.text : '') + '</div></div>'
                + '<span style="font-size:11px;color:#b5b0aa;">' + (last ? fmtDT(last.time) : '') + '</span></div>';
        });
        return html;
    };
    var app;
    var bindBody = function (win) {
        // GROUP-BA · BA-8 发送页 thread 态只留 iOS 顶栏一个返回（.gd-head 隐藏，见 BA-5）
        try { var _root = win.querySelector('.gd-root'); if (_root) _root.classList.toggle('ba-sms-thread', !!threadId); } catch (e) {}
        var scrollStream = function () { try { var r = win.querySelector('.gd-root'); if (r) r.scrollTop = r.scrollHeight; } catch (e) {} };
        var currentThreadMsg = function (idx) { var ts = load(); var t = ts.find(function (x) { return x.id === threadId; }); return (t && t.messages) ? t.messages[idx] : null; };
        var syncSendState = function (inpEl) {
            var b = win.querySelector('[data-act="send"]'); var has = !!((inpEl && inpEl.value) || '').trim();
            if (b) { b.disabled = !has; b.classList.toggle('on', has); }
            if (inpEl) { inpEl.style.height = 'auto'; inpEl.style.height = Math.min(inpEl.scrollHeight || 0, 80) + 'px'; }
        };
        var copyText = function (t) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(function () {}); }
                else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
                smsToast = '已复制';
            } catch (e) { smsToast = '复制失败'; }
            app._refresh();
            setTimeout(function () { smsToast = ''; if (threadId) app._refresh(); }, 1200);
        };
        var sendImageFile = function (file) {
            var reader = new FileReader();
            reader.onload = function (ev) {
                var threads = load(); var th = threads.find(function (x) { return x.id === threadId; }); if (!th) return;
                th.messages.push({ from: 'me', text: '', img: ev.target.result, time: Date.now() }); save(threads);
                app._refresh(); scrollStream();
                var tid = threadId;
                setTimeout(function () {
                    var ts = load(); var t2 = ts.find(function (x) { return x.id === tid; }); if (!t2) return;
                    t2.messages.push({ from: 'them', text: autoReply(''), time: Date.now() }); save(ts);
                    if (threadId === tid) { app._refresh(); scrollStream(); }
                }, 1200 + Math.random() * 800);
            };
            try { reader.readAsDataURL(file); } catch (e) {}
        };
        var send = function () {
            var inp = win.querySelector('#gd-sms-input'); if (!inp) return;
            var text = inp.value.trim(); if (!text) return;
            var threads = load(); var th = threads.find(function (x) { return x.id === threadId; }); if (!th) return;
            th.messages.push({ from: 'me', text: text, time: Date.now() }); save(threads); inp.value = ''; smsDraft = '';
            app._refresh(); scrollStream();
            var replyText = autoReply(text); var tid = threadId;
            setTimeout(function () {
                var ts = load(); var t2 = ts.find(function (x) { return x.id === tid; }); if (!t2) return;
                t2.messages.push({ from: 'them', text: replyText, time: Date.now() }); save(ts);
                if (threadId === tid) { app._refresh(); scrollStream(); }
            }, 1200 + Math.random() * 800);
        };
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-act');
                if (act === 'open') { threadId = btn.getAttribute('data-id'); smsDrawerOpen = false; smsEmojiOpen = false; smsMenuIdx = -1; smsMoreIdx = -1; smsVideoOpen = false; smsDetailOpen = false; smsBigImg = ''; smsDraft = ''; app._refresh(); }
                else if (act === 'back') { threadId = null; smsDrawerOpen = false; smsEmojiOpen = false; smsMenuIdx = -1; smsMoreIdx = -1; smsVideoOpen = false; smsDetailOpen = false; smsBigImg = ''; smsDraft = ''; app._refresh(); }
                else if (act === 'send') { send(); }
                else if (act === 'plus') { smsDrawerOpen = !smsDrawerOpen; if (smsDrawerOpen) smsEmojiOpen = false; app._refresh(); }
                else if (act === 'photo') { var f = win.querySelector('#ba-sms-file'); if (f) f.click(); }
                else if (act === 'camera') { var fc = win.querySelector('#ba-sms-file-cam'); if (fc) fc.click(); }
                else if (act === 'drawer-emoji') { smsEmojiOpen = !smsEmojiOpen; app._refresh(); }
                else if (act === 'emoji-pick') { var em = btn.getAttribute('data-emoji') || ''; var ip = win.querySelector('#gd-sms-input'); if (ip) { ip.value = (ip.value || '') + em; smsDraft = ip.value; syncSendState(ip); ip.focus(); } }
                else if (act === 'loc') {
                    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) {
                        var ip2 = win.querySelector('#gd-sms-input'); var txt = '我的位置：' + p.coords.latitude.toFixed(4) + ', ' + p.coords.longitude.toFixed(4);
                        if (ip2) { ip2.value = (ip2.value ? ip2.value + ' ' : '') + txt; smsDraft = ip2.value; syncSendState(ip2); }
                    }, function () { smsToast = '未能获取位置'; app._refresh(); setTimeout(function () { smsToast = ''; if (threadId) app._refresh(); }, 1200); }, { timeout: 5000 });
                    else { smsToast = '当前环境不支持定位'; app._refresh(); setTimeout(function () { smsToast = ''; if (threadId) app._refresh(); }, 1200); }
                }
                else if (act === 'video') { smsVideoOpen = true; app._refresh(); }
                else if (act === 'video-end') { smsVideoOpen = false; app._refresh(); }
                else if (act === 'detail') { smsDetailOpen = true; app._refresh(); }
                else if (act === 'detail-close') { smsDetailOpen = false; app._refresh(); }
                else if (act === 'bigimg-close') { smsBigImg = ''; app._refresh(); }
                else if (act === 'copy') { var ci = +btn.getAttribute('data-idx'); var cm = currentThreadMsg(ci); smsMenuIdx = -1; smsMoreIdx = -1; if (cm) copyText(cm.text || '[图片]'); }
                else if (act === 'reply') { var ri = +btn.getAttribute('data-idx'); var rm = currentThreadMsg(ri); if (rm) { smsDraft = '「' + String(rm.text || '[图片]').slice(0, 20) + '」'; smsMenuIdx = -1; smsMoreIdx = -1; app._refresh(); var ip3 = win.querySelector('#gd-sms-input'); if (ip3) ip3.focus(); } }
                else if (act === 'more') { var mi = +btn.getAttribute('data-idx'); smsMoreIdx = (smsMoreIdx === mi ? -1 : mi); app._refresh(); }
                else if (act === 'ctx-done') { smsMenuIdx = -1; smsMoreIdx = -1; app._refresh(); }
                else if (act === 'new-thread') {
                    var name = btn.getAttribute('data-name'); var threads = load();
                    var ex = threads.find(function (x) { return x.name === name; });
                    if (ex) { threadId = ex.id; } else { var nt = { id: uid(), name: name, number: name, messages: [] }; threads.unshift(nt); save(threads); threadId = nt.id; }
                    app._refresh();
                }
                else if (act === 'new-custom') {
                    var nm = ((win.querySelector('#gd-sms-newname') || {}).value || '').trim(); if (!nm) { alert('请先写对方名字'); return; }
                    var ts2 = load(); var ex2 = ts2.find(function (x) { return x.name === nm; });
                    if (ex2) threadId = ex2.id; else { var nt2 = { id: uid(), name: nm, number: nm, messages: [] }; ts2.unshift(nt2); save(ts2); threadId = nt2.id; }
                    app._refresh();
                }
            };
        });
        var inp = win.querySelector('#gd-sms-input');
        if (inp) {
            inp.addEventListener('input', function () { smsDraft = inp.value; syncSendState(inp); });
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
            inp.addEventListener('focus', function () { try { scrollStream(); inp.scrollIntoView({ block: 'nearest' }); } catch (e) {} });
            syncSendState(inp);
        }
        // GROUP-BA · BA-8 点按气泡：文字=复制，图片=看大图；长按=菜单（复制/回复/更多）
        win.querySelectorAll('.ba-sms-bubble').forEach(function (bub) {
            var bi = +bub.getAttribute('data-ba-idx');
            bub.addEventListener('click', function () {
                if (smsMenuIdx >= 0) { smsMenuIdx = -1; smsMoreIdx = -1; app._refresh(); return; }
                var m = currentThreadMsg(bi); if (!m) return;
                if (m.img) { smsBigImg = m.img; app._refresh(); return; }
                copyText(m.text || '');
            });
            bub.addEventListener('contextmenu', function (e) { e.preventDefault(); smsMenuIdx = bi; smsMoreIdx = -1; app._refresh(); });
            var lpTimer = null;
            bub.addEventListener('touchstart', function () { lpTimer = setTimeout(function () { smsMenuIdx = bi; smsMoreIdx = -1; app._refresh(); }, 500); }, { passive: true });
            bub.addEventListener('touchend', function () { if (lpTimer) clearTimeout(lpTimer); });
            bub.addEventListener('touchmove', function () { if (lpTimer) clearTimeout(lpTimer); });
        });
        var st0 = win.querySelector('#gd-sms-stream');
        if (st0) {
            st0.addEventListener('click', function (e) { if (e.target === st0 && smsMenuIdx >= 0) { smsMenuIdx = -1; smsMoreIdx = -1; app._refresh(); } });
            try { scrollStream(); } catch (e) {}
        }
        var f1 = win.querySelector('#ba-sms-file');
        if (f1) f1.addEventListener('change', function () { var file = f1.files && f1.files[0]; if (file) sendImageFile(file); f1.value = ''; });
        var f2 = win.querySelector('#ba-sms-file-cam');
        if (f2) f2.addEventListener('change', function () { var file = f2.files && f2.files[0]; if (file) sendImageFile(file); f2.value = ''; });
    };
    app = gdApp('sms', '信息', '本机短信会话', '机内短信：消息只存在这台手机里，不会发送给真人；对方回复为机内模拟回复。', renderBody, bindBody);
    GD.smsApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('sms', app); } catch (e) {}
})();

/* ══════════ 5. 相册 · phone_album_local_v1（用户自添照片）+ phone_album_favs_v1（收藏） ══════════
   图片来源全部取自手机已有真实数据：当前壁纸、微信头像、朋友圈图片、聊天图片、自添照片。 */
(function () {
    var LOCAL_KEY = 'phone_album_local_v1';
    var FAV_KEY = 'phone_album_favs_v1';
    var loadLocal = function () { var a = store.get(LOCAL_KEY, []); return Array.isArray(a) ? a : []; };
    var loadFavs = function () { var a = store.get(FAV_KEY, []); return Array.isArray(a) ? a : []; };
    var lightbox = -1;
    function collectPhotos() {
        var out = [];
        var push = function (src, label, title) { if (src && typeof src === 'string' && (src.indexOf('http') === 0 || src.indexOf('data:') === 0)) out.push({ src: src, label: label, title: title }); };
        try { if (typeof SystemStore !== 'undefined') push(SystemStore.get('wallpaper'), '壁纸', '当前壁纸'); } catch (e) {}
        var wx = wxStore();
        try {
            (wx && Array.isArray(wx.sessions) ? wx.sessions : []).forEach(function (s) {
                if (s && s.avatarImg) push(s.avatarImg, '微信头像', s.remark || s.name || '头像');
                (s.messages || []).forEach(function (m) { if (m && m.type === 'image' && m.url) push(m.url, '聊天图片', (s.remark || s.name || '') + ' 的聊天图片'); if (m && m.type === 'image' && Array.isArray(m.photos)) m.photos.forEach(function (u) { push(u, '聊天图片', (s.remark || s.name || '') + ' 的聊天图片'); }); });
            });
            (wx && Array.isArray(wx.moments) ? wx.moments : []).forEach(function (m) {
                if (!m) return;
                if (m.img) push(m.img, '朋友圈', String(m.content || m.text || '朋友圈').slice(0, 14));
                (m.images || []).forEach(function (im) { push(im, '朋友圈', String(m.content || m.text || '朋友圈').slice(0, 14)); });
            });
        } catch (e) {}
        loadLocal().forEach(function (p) { out.push({ src: p.src, label: '我的照片', title: p.title || '本地照片', localId: p.id }); });
        var seen = {}; return out.filter(function (p) { if (seen[p.src]) return false; seen[p.src] = 1; return true; });
    }
    GD.collectPhotos = collectPhotos;
    var renderBody = function () {
        var photos = collectPhotos();
        var favs = loadFavs();
        var html = '<div style="display:flex;gap:8px;align-items:center;"><span style="font-size:13px;color:#6d6862;">共 ' + photos.length + ' 张 · 均来自本机已有内容</span>'
            + '<button class="gd-btn-ghost" data-act="add" style="margin-left:auto;">＋ 添加照片</button>'
            + '<button class="gd-btn-ghost" data-act="add-photo">📷 拍照</button></div>'
            + '<input type="file" id="gd-album-file" accept="image/*" style="display:none;">';
        if (!photos.length) {
            html += '<div class="gd-empty">相册还是空的<br><span style="font-size:12px;">这里会汇总：当前壁纸、微信头像、朋友圈图片、聊天图片。<br>现在微信里还没有图片，也可以点「添加照片」从本机选一张。</span></div>';
            return html;
        }
        html += '<div class="gd-grid" style="margin-top:12px;">' + photos.map(function (p, i) {
            var fav = favs.indexOf(p.src) !== -1;
            return '<div class="gd-tile" data-act="open" data-i="' + i + '"><img src="' + esc(p.src) + '" loading="lazy"><div class="gd-tile-cap">' + (fav ? '♥ ' : '') + esc(p.label) + ' · ' + esc(p.title) + '</div></div>';
        }).join('') + '</div>';
        if (lightbox >= 0 && photos[lightbox]) {
            var p = photos[lightbox]; var fav2 = favs.indexOf(p.src) !== -1;
            html += '<div style="position:fixed;inset:0;z-index:60;background:rgba(20,18,16,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;" id="gd-lightbox">'
                + '<img src="' + esc(p.src) + '" style="max-width:100%;max-height:68%;object-fit:contain;border-radius:14px;">'
                + '<div style="color:#fff;font-size:14px;margin-top:14px;text-align:center;">' + esc(p.title) + ' · ' + esc(p.label) + '（' + (lightbox + 1) + ' / ' + photos.length + '）</div>'
                + '<div style="display:flex;gap:10px;margin-top:16px;">'
                + '<button class="gd-btn-ghost" data-act="prev" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent;">‹ 上一张</button>'
                + '<button class="gd-btn-ghost" data-act="fav" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent;">' + (fav2 ? '♥ 已收藏' : '♡ 收藏') + '</button>'
                + '<button class="gd-btn-ghost" data-act="next" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent;">下一张 ›</button>'
                + '<button class="gd-btn-ghost" data-act="close" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent;">关闭</button>'
                + '</div><div style="color:rgba(255,255,255,.55);font-size:11px;margin-top:10px;">左右滑动也可切换</div></div>';
        }
        return html;
    };
    var app;
    var bindBody = function (win) {
        var photos = collectPhotos();
        var nav = function (d) { lightbox = (lightbox + d + photos.length) % photos.length; app._refresh(); };
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function (e) {
                if (e) e.stopPropagation();
                var act = btn.getAttribute('data-act');
                if (act === 'open') { lightbox = Number(btn.getAttribute('data-i')); app._refresh(); }
                else if (act === 'close') { lightbox = -1; app._refresh(); }
                else if (act === 'prev') { nav(-1); }
                else if (act === 'next') { nav(1); }
                else if (act === 'fav') {
                    var favs = loadFavs(); var src = photos[lightbox].src;
                    var ix = favs.indexOf(src); if (ix === -1) favs.push(src); else favs.splice(ix, 1);
                    store.set(FAV_KEY, favs); app._refresh();
                }
                else if (act === 'add-photo') { if (window.GroupBG) window.GroupBG.fillInputFromCamera('gd-album-file'); }
                else if (act === 'add') { var f = win.querySelector('#gd-album-file'); if (f) f.click(); }
            };
        });
        var fileInp = win.querySelector('#gd-album-file');
        if (fileInp) fileInp.onchange = function () {
            var f = fileInp.files && fileInp.files[0]; if (!f) return;
            if (f.size > 2 * 1024 * 1024) { alert('图片超过 2MB，请选小一点的'); fileInp.value = ''; return; }
            var r = new FileReader();
            r.onload = function (ev) {
                var arr = loadLocal();
                if (arr.length >= 20) { alert('本地照片已满 20 张，先删旧的再加'); return; }
                arr.unshift({ id: uid(), src: ev.target.result, title: f.name.slice(0, 16), addedAt: Date.now() });
                store.set(LOCAL_KEY, arr); fileInp.value = ''; app._refresh();
            };
            r.readAsDataURL(f);
        };
        var lb = win.querySelector('#gd-lightbox');
        if (lb) {
            var sx = 0;
            lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
            lb.addEventListener('touchend', function (e) {
                var dx = e.changedTouches[0].clientX - sx;
                if (dx < -40) nav(1); else if (dx > 40) nav(-1);
            }, { passive: true });
            lb.addEventListener('click', function (e) { if (e.target === lb) { lightbox = -1; app._refresh(); } });
        }
    };
    app = gdApp('album', '相册', '本机已有图片汇总', '相册不联网：图片全部取自这台手机里已有的内容（壁纸 / 微信头像 / 朋友圈 / 聊天图片 / 你添加的照片）。', renderBody, bindBody);
    GD.albumApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('album', app); } catch (e) {}
})();

/* ══════════ 6. 天气（AF 组：Open-Meteo 实时 + 本地回退；新增键 weather_city_v1 / af_weather_cache_v1） ══════════ */
(function () {
    var PERIODS = [
        { h0: 0, h1: 5, name: '深夜', feel: '夜深了，体感偏凉', tip: '夜里风凉，早点休息。' },
        { h0: 5, h1: 8, name: '清晨', feel: '清晨微凉', tip: '早上出门可以带件薄外套。' },
        { h0: 8, h1: 11, name: '上午', feel: '上午温和', tip: '适合出门走走。' },
        { h0: 11, h1: 14, name: '正午', feel: '午间偏暖', tip: '中午阳光足，记得补水。' },
        { h0: 14, h1: 17, name: '午后', feel: '午后温和', tip: '适合喝杯茶、慢慢做事。' },
        { h0: 17, h1: 19, name: '傍晚', feel: '傍晚转凉', tip: '天色渐暗，适合散步。' },
        { h0: 19, h1: 22, name: '夜晚', feel: '夜里渐凉', tip: '晚上适合待在家里。' },
        { h0: 22, h1: 24, name: '深夜', feel: '夜深了，体感偏凉', tip: '夜里风凉，早点休息。' }
    ];
    var renderBody = function () {
        var now = new Date();
        var h = now.getHours();
        var p = PERIODS.find(function (x) { return h >= x.h0 && h < x.h1; }) || PERIODS[2];
        var isNight = h < 6 || h >= 18;
        var sched = store.get('phone_schedule_v1', []);
        var todayCount = sched.filter(function (x) { return x.date === todayStr() && !x.done; }).length;
        var memoCount = (store.get('phone_memo_v1', []) || []).length;
        var html = '<div class="gd-card" style="text-align:center;padding:22px 16px;">'
            + '<div style="font-size:52px;line-height:1;">' + (isNight ? '🌙' : '☀️') + '</div>'
            + '<div style="font-size:40px;font-weight:300;margin-top:8px;letter-spacing:2px;">' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + '</div>'
            + '<div style="font-size:14px;color:#6d6862;margin-top:4px;">' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEK_CN[now.getDay()] + ' · ' + p.name + '</div>'
            + '<div style="font-size:15px;font-weight:600;margin-top:12px;">' + p.feel + '</div>'
            + '<div style="font-size:13px;color:#8a8580;margin-top:4px;line-height:1.7;">' + p.tip + '</div></div>'
            + '<div class="gd-card"><div style="font-size:14px;font-weight:600;">今天的手机</div>'
            + '<div style="font-size:13px;color:#6d6862;line-height:2;margin-top:6px;">📅 今日待办日程：' + todayCount + ' 项<br>📝 备忘录：' + memoCount + ' 条<br>🕐 本机时间 ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds()) + '（每分钟自动更新）</div></div>'
            + '<div id="af-weather-live"></div>'
            + '<button class="gd-btn" data-act="refresh" style="width:100%;">↻ 刷新（按当前时间重新推算）</button>';
        return html;
    };
    var app; var timer = null;
    var bindBody = function (win) {
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () { if (btn.getAttribute('data-act') === 'refresh') app._refresh(); };
        });
        try { if (window.AFWeather) window.AFWeather.refresh(win, false); } catch (e) {}
        if (timer) clearInterval(timer);
        timer = setInterval(function () { if (win.isConnected) app._refresh(); }, 60000);
    };
    app = gdApp('weather', '天气', 'Open-Meteo 实时天气 · 无网回退本地', '实时天气来自 Open-Meteo（免费、无需 key）；定位走 J2 组 LocationGateway，城市可保存（weather_city_v1）。没网或取数失败时回退本地数据并标注来源与时间，不编造天气。时段与体感文案仍由本机时间推算。', renderBody, bindBody);
    GD.weatherApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('weather', app); } catch (e) {}
})();

/* ══════════ 7. 微博 · phone_weibo_posts_v1 ══════════
   posts [{id,author,text,time,likes,liked,comments:[{author,text,time}],local}] */
(function () {
    var KEY = 'phone_weibo_posts_v1';
    var load = function () { var a = store.get(KEY, null); return a; };
    var save = function (a) { store.set(KEY, a); };
    var seed = function () {
        var posts = [];
        var wx = wxStore();
        try {
            (wx && Array.isArray(wx.moments) ? wx.moments : []).slice(0, 2).forEach(function (m) {
                if (m && (m.content || m.text)) posts.push({ id: uid(), author: m.authorName || m.author || '机主', text: String(m.content || m.text), time: m.timestamp || Date.now(), likes: 0, liked: false, comments: [], local: true, from: '朋友圈' });
            });
        } catch (e) {}
        if (!posts.length) {
            var bits = worldBits();
            if (bits.length) posts.push({ id: uid(), author: '世界书', text: '今日设定：' + bits[0].title + '——' + bits[0].content, time: Date.now(), likes: 0, liked: false, comments: [], local: true, from: '世界书' });
        }
        // [AJ] 不再放两条写死的示例动态：没有内容就是空列表（朋友圈/世界书派生的分支保留，那是用户自己的内容）
        save(posts); return posts;
    };
    var getPosts = function () { var p = load(); if (!Array.isArray(p)) p = seed(); return p; };
    var commentOpen = null;
    var renderBody = function () {
        var posts = getPosts().slice().sort(function (a, b) { return b.time - a.time; });
        var html = '<div class="gd-card"><textarea class="gd-input" id="gd-wb-text" rows="3" placeholder="分享新鲜事…（只发在本机）"></textarea>'
            + '<div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="gd-btn" data-act="post">发布</button></div></div>'
            + (posts.length ? '' : '<div class="gd-empty">还没有动态<br><span style="font-size:12px;">写下第一条，只存在本机。</span></div>');
        posts.forEach(function (p) {
            html += '<div class="gd-card"><div class="gd-row"><div class="gd-av">' + esc((p.author || '?')[0]) + '</div>'
                + '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(p.author) + ' <span class="gd-badge">本地动态</span></div>'
                + '<div style="font-size:11px;color:#b5b0aa;">' + fmtDT(p.time) + (p.from ? ' · 来自' + esc(p.from) : '') + '</div></div></div>'
                + '<div style="font-size:14px;line-height:1.8;margin-top:10px;">' + esc(p.text) + '</div>'
                + '<div style="display:flex;gap:16px;margin-top:10px;font-size:13px;color:#8a8580;">'
                + '<span data-act="like" data-id="' + p.id + '" style="cursor:pointer;">' + (p.liked ? '♥ ' : '♡ ') + (p.likes || 0) + ' 点赞</span>'
                + '<span data-act="comment" data-id="' + p.id + '" style="cursor:pointer;">💬 ' + (p.comments || []).length + ' 评论</span>'
                + '<span data-act="del" data-id="' + p.id + '" style="cursor:pointer;color:#c9a0a0;">删除</span></div>'
                + (p.comments || []).map(function (c) { return '<div style="background:#faf8f6;border-radius:12px;padding:8px 10px;margin-top:8px;font-size:13px;line-height:1.6;"><b>' + esc(c.author) + '：</b>' + esc(c.text) + '</div>'; }).join('')
                + (commentOpen === p.id ? '<div style="display:flex;gap:8px;margin-top:8px;"><input class="gd-input" id="gd-wb-comment" placeholder="写评论…" style="flex:1;"><button class="gd-btn" data-act="send-comment" data-id="' + p.id + '">发送</button></div>' : '')
                + '</div>';
        });
        return html;
    };
    var app;
    var bindBody = function (win) {
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-act'); var id = btn.getAttribute('data-id');
                var posts = getPosts();
                if (act === 'post') {
                    var text = ((win.querySelector('#gd-wb-text') || {}).value || '').trim();
                    if (!text) { alert('先写点内容'); return; }
                    posts.unshift({ id: uid(), author: '机主', text: text, time: Date.now(), likes: 0, liked: false, comments: [], local: true, from: '本地动态' });
                    save(posts); app._refresh();
                }
                else if (act === 'like') { var p = posts.find(function (x) { return x.id === id; }); if (p) { p.liked = !p.liked; p.likes = (p.likes || 0) + (p.liked ? 1 : -1); save(posts); } app._refresh(); }
                else if (act === 'comment') { commentOpen = commentOpen === id ? null : id; app._refresh(); var ci = win.querySelector('#gd-wb-comment'); if (ci) ci.focus(); }
                else if (act === 'send-comment') {
                    var ct = ((win.querySelector('#gd-wb-comment') || {}).value || '').trim(); if (!ct) return;
                    var p2 = posts.find(function (x) { return x.id === id; }); if (p2) { p2.comments = p2.comments || []; p2.comments.push({ author: '机主', text: ct, time: Date.now() }); save(posts); }
                    commentOpen = null; app._refresh();
                }
                else if (act === 'del') { save(posts.filter(function (x) { return x.id !== id; })); app._refresh(); }
            };
        });
    };
    app = gdApp('weibo', '微博', '本机动态流 · 发帖点赞评论都在本机', '本地微博：未连接微博服务器，所有动态、点赞、评论只保存在这台手机里；初始动态来自手机已有内容，均标为「本地动态」。', renderBody, bindBody);
    GD.weiboApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('weibo', app); } catch (e) {}
})();



/* ══════════ 9. 音乐 · phone_music_list_v1（自添曲目）+ 银灰余音播放器 ══════════
   GROUP-FIX11：docx「银灰余音音乐播放器」原样合入，替代旧的 WebAudio 合成播放。
   唯一播放实现是 window.GroupFIX11（文件末尾追加的共享模块）：音乐 app、
   桌面音乐小组件（FIX2 英雄区读 GroupFIX11.getState）、灵动岛（toggle/end 走
   GroupFIX11.toggle/stop）共用同一套状态（当前歌曲/播放/暂停/进度/循环/音量）。
   播放走真实 <audio> + 网易云外链（需联网）；播不出来只报中文提示，不编假播放。
   本地曲目（微信音乐分享 + 本机自添）只有曲名、没有音频链接，保留列表展示，
   点播放会明说播不了；GD.localTracks 保留，供 GD.phoneFallback（sim_music）复用。
   一起听（GroupN duet）：加歌改成加当前银灰曲目（旧的曲名输入框已随合成播放器
   一起删掉）；点「一起听」走 GroupFIX11.playCustom，没有链接就明说、且不记
   duet_history，只有真播起来才记一条。GroupN 自己的 duetPlayMini 合成迷你播放
   不动（那是 3D 家/此刻里的小浮层，与音乐 app 无关，不属本次边界）。 */
(function () {
    var KEY = 'phone_music_list_v1';
    var loadCustom = function () { var a = store.get(KEY, []); return Array.isArray(a) ? a : []; };
    var localTracks = function () {
        var out = [];
        var wx = wxStore();
        try {
            (wx && Array.isArray(wx.sessions) ? wx.sessions : []).forEach(function (s) {
                (s.messages || []).forEach(function (m) {
                    if (m && m.type === 'music' && m.title) out.push({ id: 'wx-' + m.title, title: m.title, artist: m.artist || '', source: '微信音乐分享', base: 392 });
                });
            });
        } catch (e) {}
        loadCustom().forEach(function (t) { out.push({ id: t.id, title: t.title, artist: t.artist || '', source: '本地曲目', base: t.base || 392 }); });
        var seen = {}; return out.filter(function (t) { var k = t.title + '|' + t.artist; if (seen[k]) return false; seen[k] = 1; return true; });
    };
    GD.localTracks = localTracks;
    var ECHO_SHELL = '<section class="ins-echo" aria-label="银灰余音音乐播放器">  <div class="echo-top"><span>PRIVATE FREQUENCY</span><span class="echo-rule"></span><em>vol. 01</em></div>  <div class="echo-scene">    <div class="echo-ghost" aria-hidden="true"></div>    <div class="echo-record-wrap" aria-hidden="true"><div class="echo-record"><span class="echo-disc-label">SILENCE ON REPEAT</span></div></div>    <div class="echo-arm" aria-hidden="true"></div>    <figure class="echo-photo">      <img src="https://img.0108071.xyz/file/aNxT1zQ8.jpg" alt="银白色人物写真封面" decoding="async">      <figcaption><span>A MEMORY</span><span>— 001</span></figcaption>    </figure>    <div class="echo-clip" aria-hidden="true"></div>    <div class="echo-heading"><span>still</span><strong>here.</strong><small>AFTER THE LAST LIGHT</small></div>    <span class="echo-spark one" aria-hidden="true"><svg viewBox="0 0 30 44" fill="none"><path d="M15 1C14 18 11 20 1 22c10 2 13 4 14 21 1-17 4-19 14-21C19 20 16 18 15 1Z" fill="currentColor"/><path d="M5 5v8M1 9h8" stroke="currentColor" stroke-width=".8"/></svg></span>    <span class="echo-spark two" aria-hidden="true"><svg viewBox="0 0 30 44" fill="none"><path d="m15 2 3 16 10 4-10 4-3 16-3-16-10-4 10-4Z" stroke="currentColor" stroke-width="1.2"/></svg></span>    <span class="echo-spark three" aria-hidden="true"><svg viewBox="0 0 30 44"><path d="M15 1C14 18 11 20 1 22c10 2 13 4 14 21 1-17 4-19 14-21C19 20 16 18 15 1Z" fill="currentColor"/></svg></span>    <svg class="echo-dangle" viewBox="0 0 37 66" fill="none" aria-hidden="true"><path d="M22 1C7 13 30 28 17 41" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><ellipse cx="16" cy="47" rx="7" ry="9" transform="rotate(25 16 47)" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="55" rx="6" ry="8" transform="rotate(25 12 55)" stroke="currentColor" stroke-width="1.5"/></svg>  </div>  <p class="echo-note">没说完的话，留在歌里。</p>  <div class="echo-deck">    <div class="echo-info">      <div class="echo-meta"><span class="echo-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><div style="min-width:0"><p class="echo-title">曲目 01</p><div class="echo-caption">A LITTLE LONGER</div></div></div>      <div class="echo-tabs" role="group" aria-label="选择歌曲"><button type="button" data-track="0" aria-label="选择第一首" aria-pressed="true">01</button><button type="button" data-track="1" aria-label="选择第二首" aria-pressed="false">02</button><button type="button" data-track="2" aria-label="选择第三首" aria-pressed="false">03</button></div>    </div>    <div class="echo-seek-row"><time class="echo-current">00:00</time><input class="echo-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="播放进度" aria-valuetext="00:00" disabled><time class="echo-duration">--:--</time></div>    <div class="echo-controls">      <button class="echo-repeat" type="button" aria-label="开启单曲循环" aria-pressed="false" title="当前：列表循环"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg></button>      <button type="button" class="echo-prev" aria-label="上一首"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h2v16H6zm12 1.5v13L9 12Z"/></svg></button>      <button type="button" class="echo-play" aria-label="播放"><svg class="echo-play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5Z"/></svg><svg class="echo-pause-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4Z"/></svg></button>      <button type="button" class="echo-next" aria-label="下一首"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 4h2v16h-2zM6 5.5v13l9-6.5Z"/></svg></button>      <span class="echo-side">SIDE A</span>    </div>  </div>  <div class="fix11-vol"><span>音量</span><input class="echo-seek fix11-vol-range" type="range" min="0" max="100" step="1" value="90" aria-label="音量"><span class="fix11-vol-val">90%</span></div><div class="echo-footer"><span>STEREO / 33⅓</span><em>some things never fade.</em><span>01 — 03</span></div>  <p class="echo-status" role="status" aria-live="polite" hidden></p></section>';
    var renderBody = function () {
        if (!window.GroupFIX11) return '<div class="gd-empty">音乐播放器模块未加载，请重启手机再试。</div>';
        var echo = window.GroupFIX11;
        var st = echo.getState();
        var tracks = echo.getTracks();
        var shell = ECHO_SHELL;
        shell = shell.replace('>曲目 01<', '>' + esc(st.title || '曲目 01') + '<');
        shell = shell.replace('<span class="echo-side">SIDE A</span>', '<span class="echo-side">' + (st.trackId && st.trackId.indexOf('echo-') === 0 ? 'SIDE ' + ['A', 'B', 'C'][st.index] : 'SIDE \u2013') + '</span>');
        for (var ti = 0; ti < 3; ti++) {
            shell = shell.replace('data-track="' + ti + '" aria-label="选择第' + ['一', '二', '三'][ti] + '首" aria-pressed="' + (ti === 0 ? 'true' : 'false') + '"',
                'data-track="' + ti + '" aria-label="选择第' + ['一', '二', '三'][ti] + '首" aria-pressed="' + String(ti === st.index) + '"');
        }
        shell = shell.replace('class="echo-seek fix11-vol-range" type="range" min="0" max="100" step="1" value="90"',
            'class="echo-seek fix11-vol-range" type="range" min="0" max="100" step="1" value="' + Math.round(st.volume * 100) + '"');
        shell = shell.replace('<span class="fix11-vol-val">90%</span>', '<span class="fix11-vol-val">' + Math.round(st.volume * 100) + '%</span>');
        var html = shell;
        html += '<details class="fix11-edit"><summary>编辑歌单 · 歌名与链接存在本机</summary><div class="fix11-edit-rows">';
        for (var ei = 0; ei < 3; ei++) {
            html += '<label class="fix11-edit-row"><span>0' + (ei + 1) + '</span><input data-fix11-name="' + ei + '" value="' + esc(tracks[ei] ? tracks[ei].name : '') + '" placeholder="歌名" aria-label="第' + (ei + 1) + '首歌名">'
                + '<input data-fix11-url="' + ei + '" value="' + esc(tracks[ei] ? tracks[ei].url : '') + '" placeholder="音乐直链（mp3 / m4a），留空表示暂无可播放链接" aria-label="第' + (ei + 1) + '首链接"></label>';
        }
        html += '</div><div class="fix11-edit-btns"><button type="button" class="fix11-btn" data-fix11-act="save-tracks">保存歌单</button>'
            + '<button type="button" class="fix11-btn fix11-btn-ghost" data-fix11-act="reset-tracks">恢复默认三首</button></div>'
            + '<div class="fix11-edit-hint">改完立即生效，重启手机还在。链接填音乐直链；留空的那首点播放时会直接告诉你还没有链接。</div></details>';
        html += (window.GroupN ? window.GroupN.duetSectionHTML() : '');
        var locals = localTracks();
        html += '<div class="fix11-local"><div class="fix11-local-title">本地曲目</div>';
        if (!locals.length) {
            html += '<div class="fix11-local-empty">还没有本地曲目。微信聊天里分享过的音乐会出现在这里。</div>';
        } else {
            html += '<div class="fix11-local-note">这些只有曲名、没有音频链接，点播放会直接告诉你播不了，不会假装在放。</div>';
            locals.forEach(function (t) {
                html += '<div class="fix11-local-row"><div style="width:34px;height:34px;border-radius:9px;background:#fbe4e8;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🎵</div>'
                    + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(t.title) + '</div>'
                    + '<div style="font-size:12px;color:#9a958f;">' + esc(t.artist || '未知歌手') + ' · ' + esc(t.source) + '</div></div>'
                    + '<button type="button" class="gd-btn" data-fix11-act="play-local" data-id="' + esc(t.id) + '" style="padding:8px 12px;font-size:13px;">▶ 播放</button></div>';
            });
        }
        html += '</div>';
        html += '<div id="groupp-music-beat" class="groupp-beat" title="char 跟着节拍动：音量驱动（AnalyserNode 读实时音量）。"><span class="groupp-beat-char"><svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="74" rx="14" ry="3" fill="rgba(0,0,0,0.18)"/><rect x="23" y="56" width="5" height="14" rx="2" fill="#4a4a4a"/><rect x="32" y="56" width="5" height="14" rx="2" fill="#4a4a4a"/><path d="M16 44 Q30 38 44 44 L46 60 Q30 64 14 60 Z" fill="#5b8def"/><circle cx="30" cy="28" r="17" fill="#ffe3c4"/><path d="M14 30 Q12 10 30 9 Q48 10 46 30 Q42 18 30 17 Q18 18 14 30 Z" fill="#5b3a1e"/><circle cx="24" cy="29" r="2.6" fill="#2b2b2b"/><circle cx="36" cy="29" r="2.6" fill="#2b2b2b"/><path d="M26 37 Q30 40 34 37" stroke="#c87a5a" stroke-width="2" fill="none" stroke-linecap="round"/></svg></span><span class="groupp-beat-meter"><i id="groupp-beat-fill"></i></span><span class="groupp-beat-txt">char 跟着节拍动</span></div>';
        html += '<div class="gd-note">在线播放：三首歌走网易云外链，需要联网。封面是在线图片，打不开时显示本机银灰封面。</div>';
        return html;
    };
    var app;
    var bindBody = function (win) {
        var root = win.querySelector('.ins-echo');
        if (root && window.GroupFIX11) { try { window.GroupFIX11.bind(root, win); } catch (e) {} }
        win.querySelectorAll('[data-fix11-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-fix11-act');
                var echo = window.GroupFIX11;
                if (act === 'save-tracks') {
                    if (!echo) return;
                    var list = [0, 1, 2].map(function (i) {
                        var n = win.querySelector('[data-fix11-name="' + i + '"]');
                        var u = win.querySelector('[data-fix11-url="' + i + '"]');
                        return { name: (n ? n.value : '').trim(), url: (u ? u.value : '').trim() };
                    });
                    echo.setTracks(list);
                    app._refresh();
                } else if (act === 'reset-tracks') {
                    if (echo) echo.resetTracks();
                    app._refresh();
                } else if (act === 'play-local') {
                    var id = btn.getAttribute('data-id');
                    var t = localTracks().find(function (x) { return x.id === id; });
                    if (t && echo) echo.playCustom({ name: t.title, artist: t.artist || '', url: '', trackId: 'local-' + t.id });
                    /* 不 _refresh：playCustom 的诚实提示要留在界面上 */
                }
            };
        });
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-act'); var id = btn.getAttribute('data-id');
                var echo = window.GroupFIX11;
                if (act === 'duet-add') {
                    if (window.GroupN && echo) { var st = echo.getState(); if (st.title) window.GroupN.duetAdd(st.title, st.artist || '', '我'); }
                    app._refresh();
                } else if (act === 'duet-play') {
                    var dt = (window.GroupN ? window.GroupN.duetLoad() : []).find(function (x) { return x.title === id; });
                    if (dt && echo) {
                        echo.playCustom({ name: dt.title, artist: dt.artist || '', url: '', trackId: 'duet-' + dt.title }).then(function (ok) {
                            if (ok && window.GroupN) { window.GroupN.duetRecord(dt.title); app._refresh(); }
                        });
                    }
                    /* 播不起来（无链接）时不刷新，保留提示；真播起来才记一条并刷新 */
                } else if (act === 'duet-del') { if (window.GroupN) window.GroupN.duetRemove(id); app._refresh(); }
            };
        });
    };
    app = gdApp('music', '音乐', '银灰余音 · 在线播放', '在线播放：三首歌走网易云外链，需要联网；播不出来时会直接告诉你，不会假装在放。', renderBody, bindBody);
    GD.musicApp = app;
    try { if (typeof AppManager !== 'undefined') AppManager.register('music', app); } catch (e) {}
})();


/* ══════════ 10. 桌宠市场 catos · phone_catos_v1 ══════════
   GROUP-DESKPET（建在 FIX-2 之上）：猫窝这只猫就是 3D 家 / 番茄钟 / 桌宠
   的同一只猫，不再是第二只。状态只存在共享宠物 otome_home_v1.pet 里，
   经 GroupW.catLoad/catTick/catSave 读写（3D 家那只猫的同一份数据）；
   phone_catos_v1 只作迁移备份：首次打开把旧数值并过去一次，之后不再写它。
   脸是 desksprite 像素猫（FIX-2 的 GroupFIX2.SKINS.cat，帧逐字照录；
   调色板由本组改成橘色，见 FIX2 CAT_PALETTE），画在 canvas 上；
   GroupFIX2 不在时退回原来的 emoji 脸。
   数值口径与旧猫窝一致：摸摸 心情+8/亲密度+3，喂食 饱食+25/亲密度+2，
   玩耍 心情+12/饱食-5/亲密度+2，全部免费（番茄钟的喂食/玩耍收金币是另一套，
   不动）；改名最多 8 字。衰减走共享猫的 catTick（饱食 -3/h、心情 -1/h、
   亲密度 -1/h，离线最多算 8 小时）；旧猫窝的 -4/-2 不封顶已不用。
   调试口径：GD.catosShared = { load, save, migrateOnce }（仅供测试/排障）。 */
(function () {
    var KEY = 'phone_catos_v1';
    var MERGED_FLAG = '_sharedMerged';
    var bubble = '';
    /* 共享猫读/写：优先走 GroupW（与 3D 家/番茄钟同一份 otome_home_v1.pet） */
    var sharedLoad = function () {
        try { if (window.GroupW && GroupW.catLoad) return GroupW.catLoad(); } catch (e) {}
        return null;
    };
    var sharedSave = function (cat) {
        try { if (window.GroupW && GroupW.catSave) return GroupW.catSave(cat); } catch (e) {}
        return false;
    };
    /* 旧猫窝数据一次性并入共享猫：共享猫已存在时只取亲密度最大值（其余数值以
       共享猫为准）；没有共享猫时按旧数值收养一只。phone_catos_v1 原样保留作备份。 */
    var migrateOnce = function () {
        try {
            var legacy = store.get(KEY, null);
            if (!legacy || typeof legacy !== 'object' || legacy[MERGED_FLAG]) return;
            var shared = sharedLoad();
            if (shared) {
                var b = Math.max(shared.bond || 0, legacy.affection || 0);
                if (b !== (shared.bond || 0)) { shared.bond = b; sharedSave(shared); }
            } else if (window.GroupW && GroupW.catSave && GroupW.catTick) {
                var now = Date.now();
                var fresh = { name: (legacy.name || '阿橘'), satiety: (legacy.satiety == null ? 70 : legacy.satiety), mood: (legacy.mood == null ? 70 : legacy.mood), bond: (legacy.affection || 0), energy: 60, coins: 0, xp: 0, level: 1, owned: [], equipped: {}, sleeping: false, adoptedAt: now, lastTick: (legacy.lastSeen || now) };
                try { var ticked = GroupW.catTick(fresh, now); if (ticked) fresh = ticked; } catch (e) {}
                GroupW.catSave(fresh);
            }
            legacy[MERGED_FLAG] = true;
            try { store.set(KEY, legacy); } catch (e) {}
        } catch (e) {}
    };
    /* 读猫：共享猫优先（读时跑一次共享衰减）；GroupW 不在时退回旧的本机逻辑 */
    var load = function () {
        migrateOnce();
        var c = sharedLoad();
        if (c) {
            try { var t = GroupW.catTick(c, Date.now()); if (t) { c = t; sharedSave(c); } } catch (e) {}
            return { name: (c.name || '阿橘'), satiety: (c.satiety == null ? 70 : c.satiety), mood: (c.mood == null ? 70 : c.mood), affection: (c.bond || 0) };
        }
        var d = store.get(KEY, null);
        if (!d || typeof d !== 'object') d = { name: '阿橘', satiety: 70, mood: 70, affection: 0, lastSeen: Date.now() };
        var hours = Math.max(0, (Date.now() - (d.lastSeen || Date.now())) / 3600e3);
        d.satiety = Math.max(0, Math.round((d.satiety == null ? 70 : d.satiety) - hours * 4));
        d.mood = Math.max(0, Math.round((d.mood == null ? 70 : d.mood) - hours * 2));
        d.lastSeen = Date.now();
        return d;
    };
    var save = function (d) {
        var c = sharedLoad();
        if (c) {
            c.name = d.name; c.satiety = d.satiety; c.mood = d.mood; c.bond = d.affection;
            c.lastTick = Date.now();
            sharedSave(c);
            return;
        }
        d.lastSeen = Date.now(); store.set(KEY, d);
    };
    var hasPixel = function () {
        try { return !!(window.GroupFIX2 && GroupFIX2.SKINS && GroupFIX2.SKINS.cat); } catch (e) { return false; }
    };
    var drawFace = function (win) {
        try {
            var cv = win.querySelector('#gd-cat-canvas');
            if (!cv) return;
            var ok = false;
            try { ok = !!(window.GroupW && GroupW.drawPixelCat && GroupW.drawPixelCat(cv, 'idle')); } catch (e) {}
            if (ok) { var em = win.querySelector('#gd-cat-face'); if (em) em.style.display = 'none'; }
        } catch (e) {}
    };
    var renderBody = function () {
        var d = load();
        var face = d.mood >= 60 ? '😸' : (d.mood >= 30 ? '😺' : '😿');
        var status = d.satiety < 25 ? '饿了，快喂我！' : (d.mood < 30 ? '有点不开心，陪我玩玩吧。' : (d.affection > 30 ? '最喜欢你了～' : '今天也要好好相处哦。'));
        var pixel = hasPixel();
        var html = '<div class="gd-card" style="text-align:center;padding:24px 16px 18px;">'
            + (pixel ? '<canvas id="gd-cat-canvas" width="13" height="13" style="width:104px;height:104px;image-rendering:pixelated;margin:0 auto;display:block;" aria-label="橘猫"></canvas>' : '')
            + '<div style="font-size:92px;line-height:1;" id="gd-cat-face">' + face + '</div>'
            + '<div style="font-size:20px;font-weight:600;margin-top:10px;">' + esc(d.name) + '</div>'
            + '<div style="font-size:13px;color:#8a8580;margin-top:4px;">' + status + '</div>'
            + (bubble ? '<div style="display:inline-block;background:#fff;border:1px solid #f0e6dc;border-radius:14px;padding:8px 14px;font-size:13px;margin-top:12px;box-shadow:0 4px 14px rgba(90,75,60,.08);">' + esc(bubble) + '</div>' : '')
            + '<div style="text-align:left;margin-top:18px;">'
            + '<div style="font-size:12px;color:#9a958f;margin-bottom:4px;">饱腹 ' + d.satiety + '%</div><div class="gd-bar"><i style="width:' + d.satiety + '%;background:#e8a04c;"></i></div>'
            + '<div style="font-size:12px;color:#9a958f;margin:10px 0 4px;">心情 ' + d.mood + '%</div><div class="gd-bar"><i style="width:' + d.mood + '%;background:#e78fb3;"></i></div>'
            + '<div style="font-size:12px;color:#9a958f;margin:10px 0 4px;">亲密度 ' + d.affection + '</div><div class="gd-bar"><i style="width:' + Math.min(100, d.affection) + '%;background:#9db98a;"></i></div>'
            + '</div></div>'
            + '<div style="display:flex;gap:8px;"><button class="gd-btn" data-act="pet" style="flex:1;">🤲 摸摸</button>'
            + '<button class="gd-btn" data-act="feed" style="flex:1;">🍗 喂食</button>'
            + '<button class="gd-btn" data-act="play" style="flex:1;">🧶 玩耍</button></div>'
            + '<div class="gd-card" style="margin-top:12px;"><div class="gd-label" style="margin-top:0;">给猫改名</div>'
            + '<div style="display:flex;gap:8px;"><input class="gd-input" id="gd-cat-name" value="' + esc(d.name) + '" style="flex:1;"><button class="gd-btn-ghost" data-act="rename">改名</button></div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.7;margin-top:10px;">桌宠市场是本机桌宠：状态只存在这台手机里，饱腹、心情和亲密度会随时间慢慢下降，记得回来看看它。</div></div>';
        return html + marketHTML();
    };
    /* GROUP-PET：桌宠市场——4 款像素桌宠，全部免费领养/切换；领养后桌面宠、3D 家宠、番茄钟猫
       仍是同一只（otome_home_v1.pet），只换皮肤不换猫。Claude / ChatGPT / Muse 三款是
       desksprite BOY 14x14 帧的换色（desksprite 只发了 blue-boy.json 和 cat.json，没有这三款的
       原生皮肤；调色板见 GroupPET.MARKET_PALETTES，画布仍由 FIX2 画），不是手画新帧；
       小猫就是 FIX2 的 desksprite 真实像素猫。 */
    var _homeHandle = null;
    var _shelfHandle = null;
    var marketHTML = function () {
        if (!window.GroupPET || !GroupPET.MARKET) return '';
        var cur = '';
        try { cur = String((JSON.parse(localStorage.getItem('phone_ui_prefs_v1') || '{}') || {}).petSkin || ''); } catch (e) {}
        var cards = GroupPET.MARKET.map(function (m) {
            var lic = m.id === 'cat' ? 'desksprite cat.json · MIT' : 'desksprite blue-boy.json 换色 · MIT';
            return '<div class="gd-card" style="margin-top:12px;" data-pet-market="' + m.id + '">'
                + '<div style="display:flex;gap:12px;align-items:center;">'
                + '<canvas class="gd-market-preview" data-preview="' + m.id + '" width="14" height="14" style="width:56px;height:56px;image-rendering:pixelated;flex:none;" aria-label="' + m.name + '"></canvas>'
                + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + m.name + '</div>'
                + '<div style="font-size:12px;color:#9a958f;line-height:1.6;margin-top:2px;">' + m.note + '</div>'
                + '<div style="font-size:12px;color:#9a958f;">' + lic + '</div></div>'
                + '<button class="gd-btn-ghost" data-adopt="' + m.id + '"' + (cur === m.id ? ' disabled' : '') + '>' + (cur === m.id ? '使用中' : '领养') + '</button>'
                + '</div></div>';
        }).join('');
        return '<div style="margin-top:16px;"><div style="font-size:15px;font-weight:600;">桌宠市场</div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.6;margin-top:2px;">换皮肤只换样子，不换猫：饱腹、心情、亲密度和名字都还在，桌面宠、3D 家宠、番茄钟猫共用同一只。全部免费领养。</div>'
            + cards
            + market3DHTML()
            + '</div>';
    };
    var market3DHTML = function () {
        if (!window.GroupPET) return '';
        var rooms = (GroupPET.ROOMS || []).filter(function (r) { return r.selectable; });
        var roomOpts = rooms.map(function (r) { return '<option value="' + r.id + '">' + r.title + ' · ' + r.author + '（约 ' + Math.round(r.size / 1024 / 1024) + ' MB）</option>'; }).join('');
        return '<div class="gd-card" style="margin-top:12px;"><div style="font-size:15px;font-weight:600;">3D 桌宠</div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.6;margin-top:2px;">VRM 角色（three.js + @pixiv/three-vrm，走现有 CDN 0.128.0 / 0.6.7）。离线时诚实回落像素猫，不假装 3D。</div>'
            + '<div id="gd-3d-status" style="font-size:12px;color:#8a8580;line-height:1.6;margin-top:6px;">还没开 3D 桌宠，现在是像素猫。</div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">'
            + '<button class="gd-btn-ghost" data-3d="download-seed">下载 Seed-san（约 10.4 MB）</button>'
            + '<button class="gd-btn-ghost" data-3d="import-vrm">导入自己的 .vrm</button>'
            + '<button class="gd-btn-ghost" data-3d="toggle-3d">开 / 关 3D 桌宠</button>'
            + '</div>'
            + '<input type="file" id="gd-3d-vrm-file" accept=".vrm" style="display:none">'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">'
            + '<button class="gd-btn-ghost" data-3d="wave">挥手</button>'
            + '<button class="gd-btn-ghost" data-3d="bow">鞠躬</button>'
            + '<button class="gd-btn-ghost" data-3d="jump">跳一下</button>'
            + '<button class="gd-btn-ghost" data-3d="greet">打招呼</button>'
            + '<button class="gd-btn-ghost" data-3d="speak">说话试试</button>'
            + '</div>'
            + '<div id="gd-3d-models" style="font-size:12px;color:#8a8580;line-height:1.7;margin-top:8px;">本机模型：还没下载过。</div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.7;margin-top:6px;">Seed-san.vrm：VRM Public License 1.0，署名 VirtualCast, Inc.；首次联网下载一次存本机，离线复用。其他 VRoid Hub / Booth 模型只许用、不许再分发，手机不内置，请自己导入。</div>'
            + '</div>'
            + '<div class="gd-card" style="margin-top:12px;"><div style="font-size:15px;font-weight:600;">3D 世界</div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.6;margin-top:2px;">乙游 3D 家按 unfold 的折叠数学重做（three.js 在线跑，离线回落原来的 CSS 3D）。点一下家换房间，拖动转视角。</div>'
            + '<div id="gd-3d-home" style="height:220px;border-radius:12px;background:#f4f1ea;margin-top:8px;overflow:hidden;"></div>'
            + '<div style="display:flex;gap:8px;margin-top:8px;"><select id="gd-3d-room" class="gd-input" style="flex:1;">' + roomOpts + '</select><button class="gd-btn-ghost" data-3d="room-load">换 .glb 房间</button><button class="gd-btn-ghost" data-3d="home-preview">预览 3D 家</button></div>'
            + '<div id="gd-3d-home-status" style="font-size:12px;color:#8a8580;line-height:1.6;margin-top:6px;"></div>'
            + '<div style="font-size:12px;color:#9a958f;line-height:1.7;margin-top:6px;">.glb 房间：CC BY 4.0，逐间署名；超过 25 MB 不加载，超过 10 MB 会提示加载慢。其余 3 间（small-cafe / cute-isometric-room / rustic-bedroom）署名与大小还没核实完，暂不提供。</div>'
            + '<div id="gd-3d-shelf" style="height:200px;border-radius:12px;background:#f4f1ea;margin-top:8px;overflow:hidden;"></div>'
            + '<div style="display:flex;gap:8px;margin-top:8px;"><button class="gd-btn-ghost" data-3d="shelf-preview">预览 3D 书架</button></div>'
            + '<div id="gd-3d-shelf-status" style="font-size:12px;color:#8a8580;line-height:1.6;margin-top:6px;"></div>'
            + '</div>';
    };
    var set3DStatus = function (win, msg) {
        var st = win.querySelector('#gd-3d-status');
        if (st) st.textContent = msg;
    };
    var paintMarket = function (win) {
        if (!window.GroupPET || !GroupPET.previewInto) return;
        win.querySelectorAll('[data-preview]').forEach(function (cv) {
            GroupPET.previewInto(cv, cv.getAttribute('data-preview'));
        });
        paintMarket3D(win);
        /* GROUP-PET：状态行只在打开市场时同步一次（3D 开/关）；各按钮动作的提示由动作自己写，
           paintMarket3D 不再碰状态行——否则下载/开关的提示会被立刻盖回默认文案。 */
        var st = win.querySelector('#gd-3d-status');
        if (st) {
            try {
                st.textContent = GroupPET.isDesktopVRMOn() ? '3D 桌宠已开（桌面上是 VRM 角色）。' : '还没开 3D 桌宠，现在是像素猫。';
            } catch (e) {}
        }
    };
    var paintMarket3D = function (win) {
        if (!window.GroupPET) return;
        var box = win.querySelector('#gd-3d-models');
        if (box) {
            GroupPET.listStoredModels().then(function (list) {
                if (!list.length) { box.textContent = '本机模型：还没下载过。'; return; }
                box.textContent = '本机模型：' + list.map(function (m) { return m.name + '（' + Math.round((m.size || 0) / 1024 / 1024 * 10) / 10 + ' MB）'; }).join('、');
            });
        }
    };
    var wireMarket = function (win) {
        win.querySelectorAll('[data-adopt]').forEach(function (btn) {
            btn.onclick = function () {
                var id = btn.getAttribute('data-adopt');
                if (window.GroupPET && GroupPET.adopt) {
                    var r = GroupPET.adopt(id);
                    if (r && r.ok) { try { app._refresh(); } catch (e) {} }
                }
            };
        });
        wireMarket3D(win);
    };
    var wireMarket3D = function (win) {
        win.querySelectorAll('[data-3d]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-3d');
                if (!window.GroupPET) return;
                if (act === 'download-seed') {
                    set3DStatus(win, '正在下载 Seed-san（约 10.4 MB）…');
                    GroupPET.downloadSeedSan().then(function (r) {
                        set3DStatus(win, r.ok ? ('Seed-san 下载好了（' + r.sizeMB + ' MB），已存本机，离线也能用。') : (r.message || '下载失败，已回落像素猫。'));
                        paintMarket3D(win);
                    });
                } else if (act === 'import-vrm') {
                    var inp = win.querySelector('#gd-3d-vrm-file');
                    if (inp) inp.click();
                } else if (act === 'toggle-3d') {
                    var on = !GroupPET.isDesktopVRMOn();
                    GroupPET.setDesktopVRM(on).then(function (r) {
                        set3DStatus(win, r.ok ? (on ? '3D 桌宠已开（桌面上是 VRM 角色）。' : '已切回像素猫。') : ((r.message || '开不了 3D 桌宠，已回落像素猫。')));
                        paintMarket3D(win);
                    });
                } else if (act === 'wave' || act === 'bow' || act === 'jump' || act === 'greet') {
                    var g = GroupPET.gesture(act);
                    set3DStatus(win, g.ok ? '正在做动作：' + act + '。' : (g.message || '先开 3D 桌宠再做手势（现在是像素猫）。'));
                } else if (act === 'speak') {
                    var s = GroupPET.speakTest('你好呀，我是桌宠，今天也要一起加油。');
                    set3DStatus(win, s.ok ? '正在说话（口型按 TTS 词边界驱动）。' : '这台设备没有语音合成功能。');
                } else if (act === 'home-preview') {
                    var host = win.querySelector('#gd-3d-home');
                    var hst = win.querySelector('#gd-3d-home-status');
                    var home = {};
                    try { if (window.OtomeF && OtomeF.loadHome) home = OtomeF.loadHome() || {}; } catch (e) {}
                    GroupPET.renderOtomeHome3D(host, home, {}).then(function (r) {
                        if (r && r.ok) { _homeHandle = r; if (hst) hst.textContent = '3D 家已打开（点一下换房间，拖动转视角）。'; }
                        else if (hst) hst.textContent = (r && r.message) || '3D 家打不开，仍用原来的 CSS 3D。';
                    });
                } else if (act === 'room-load') {
                    var sel = win.querySelector('#gd-3d-room');
                    var hst2 = win.querySelector('#gd-3d-home-status');
                    if (!_homeHandle || !sel) { if (hst2) hst2.textContent = '先点「预览 3D 家」，再换 .glb 房间。'; return; }
                    _homeHandle.loadGLB(sel.value).then(function (r) {
                        if (hst2) hst2.textContent = r.ok ? ('已换成「' + r.title + '」（' + r.author + '，CC BY 4.0）' + (r.warn || '') + '。') : (r.message || '换房间失败，已保留原来的程序化房间。');
                    });
                } else if (act === 'shelf-preview') {
                    var shost = win.querySelector('#gd-3d-shelf');
                    var sst = win.querySelector('#gd-3d-shelf-status');
                    var books = [];
                    try { if (window.NovelStore && NovelStore.books) books = NovelStore.books; } catch (e) {}
                    GroupPET.renderNovelShelf3D(shost, books, { onOpen: function (b) { if (sst) sst.textContent = '选了《' + (b.title || '未命名') + '》。'; } }).then(function (r) {
                        if (r && r.ok) { _shelfHandle = r; if (sst) sst.textContent = '3D 书架已打开（拖动滚动，点一下打开书）。'; }
                        else if (sst) sst.textContent = (r && r.message) || '3D 书架打不开，仍用原来的 CSS 3D 书架。';
                    });
                }
            };
        });
        var inp = win.querySelector('#gd-3d-vrm-file');
        if (inp) {
            inp.onchange = function () {
                GroupPET.importVRMFile(inp);
                set3DStatus(win, '已导入你自己的 .vrm（存在本机，不上传）；再点「开 / 关 3D 桌宠」就能看到它。');
                paintMarket3D(win);
            };
        }
    };
    var app;
    var bindBody = function (win) {
        drawFace(win);
        paintMarket(win);
        wireMarket(win);
        win.querySelectorAll('[data-act]').forEach(function (btn) {
            btn.onclick = function () {
                var act = btn.getAttribute('data-act');
                var d = load();
                if (act === 'pet') {
                    /* 摸摸走共享接口（GroupW.catPat：心情+8/亲密度+3，免费）；GroupW 不在时本地算 */
                    var done = false;
                    try { if (window.GroupW && GroupW.catPat) { var r = GroupW.catPat(Date.now()); if (r && r.ok) { d = load(); done = true; } } } catch (e) {}
                    if (!done) { d.affection = Math.min(100, d.affection + 3); d.mood = Math.min(100, d.mood + 8); save(d); }
                    bubble = ['呼噜呼噜～', '再摸摸嘛～', '喵～'][Math.floor(Math.random() * 3)];
                }
                else if (act === 'feed') { d.satiety = Math.min(100, d.satiety + 25); d.affection = Math.min(100, d.affection + 2); bubble = '好吃！喵呜～'; }
                else if (act === 'play') { d.mood = Math.min(100, d.mood + 12); d.satiety = Math.max(0, d.satiety - 5); d.affection = Math.min(100, d.affection + 2); bubble = '毛线球最好玩了！'; }
                else if (act === 'rename') { var nm = ((win.querySelector('#gd-cat-name') || {}).value || '').trim(); if (nm) { d.name = nm.slice(0, 8); bubble = '我有新名字啦：' + d.name; } }
                if (act !== 'pet') save(d);
                app._refresh();
            };
        });
    };
    app = gdApp('catos', '桌宠市场', '本机桌宠 · 摸摸 / 喂食 / 玩耍', '桌宠市场：代码里只剩一个名字的桌宠应用，现在是真的能养的猫，状态存在本机。', renderBody, bindBody);
    GD.catosApp = app;
    GD.catosShared = { load: load, save: save, migrateOnce: migrateOnce };
    try { if (typeof AppManager !== 'undefined') AppManager.register('catos', app); } catch (e) {}
})();

/* ══════════ 11. 锁屏紧急呼叫 · phone_emergency_v1 ══════════
   contacts [{id,name,number}]；拨打均为机内模拟，界面明确标注。 */
(function () {
    var KEY = 'phone_emergency_v1';
    var load = function () { var a = store.get(KEY, []); return Array.isArray(a) ? a : []; };
    var save = function (a) { store.set(KEY, a); };
    var simCall = null; var simTimer = null;
    function openEmergency() {
        closeEmergency();
        var shell = document.getElementById('sys-shell') || document.body;
        var ov = document.createElement('div');
        ov.id = 'gd-emergency';
        ov.style.cssText = 'position:absolute;inset:0;z-index:20000;background:#fffdfb;color:#2b2a28;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;';
        var render = function () {
            var list = load();
            var html = '<div style="padding:18px 18px 40px;">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:22px;font-weight:700;">🚨 紧急呼叫</span>'
                + '<button id="gd-em-close" style="border:1px solid #ece7e2;background:#f4f1ee;border-radius:999px;padding:8px 14px;font-size:14px;">关闭</button></div>'
                + '<div style="margin-top:10px;padding:10px 12px;background:#fdf6ec;border:1px solid #f3e3c8;border-radius:14px;font-size:12px;line-height:1.7;color:#8a6d3b;">机内模拟呼叫：这里的拨打不会接通真实电话或报警电话，仅在本机内模拟通话流程。如遇真实紧急情况，请用真机拨打 110 / 120 / 119。</div>';
            if (simCall) {
                html += '<div style="margin-top:16px;background:#fff;border:1px solid #f0edea;border-radius:18px;padding:22px;text-align:center;box-shadow:0 4px 16px rgba(90,75,60,.06);">'
                    + '<div style="font-size:18px;font-weight:600;">正在模拟呼叫</div>'
                    + '<div style="font-size:22px;font-weight:700;margin-top:10px;">' + esc(simCall.name) + '</div>'
                    + '<div style="font-size:13px;color:#9a958f;margin-top:4px;">' + esc(simCall.number) + '</div>'
                    + '<div style="font-size:15px;margin-top:8px;"><span id="gd-em-timer">0秒</span> · 机内模拟</div>'
                    + '<button id="gd-em-hangup" style="margin-top:18px;padding:12px 32px;border-radius:999px;border:none;background:#e5484d;color:#fff;font-size:16px;">挂断</button></div>';
            }
            html += '<div style="font-size:12px;color:#9a958f;margin:18px 0 8px;font-weight:600;">紧急联系人</div>';
            if (!list.length) html += '<div style="text-align:center;color:#a8a29c;font-size:13px;line-height:2;padding:16px;">还没有紧急联系人<br><span style="font-size:12px;">在下面添加一位家人或朋友，紧急时可一键模拟拨打。</span></div>';
            list.forEach(function (c) {
                html += '<div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #f0edea;border-radius:18px;padding:13px 14px;margin-bottom:8px;">'
                    + '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">' + esc(c.name) + '</div><div style="font-size:12px;color:#9a958f;">' + esc(c.number) + '</div></div>'
                    + '<button data-em-call="' + esc(c.name) + '|' + esc(c.number) + '" style="padding:9px 16px;border-radius:999px;border:none;background:#34a853;color:#fff;font-size:14px;">模拟拨打</button>'
                    + '<button data-em-del="' + c.id + '" style="padding:9px 10px;border-radius:12px;border:1px solid #f3c8c8;background:#fff;color:#d33;font-size:13px;">删除</button></div>';
            });
            html += '<div style="font-size:12px;color:#9a958f;margin:16px 0 8px;font-weight:600;">添加紧急联系人</div>'
                + '<div style="display:flex;gap:8px;"><input id="gd-em-name" placeholder="姓名" style="flex:1;box-sizing:border-box;border:1px solid #e9e4df;border-radius:14px;padding:11px 13px;font-size:15px;">'
                + '<input id="gd-em-num" placeholder="号码" style="width:130px;box-sizing:border-box;border:1px solid #e9e4df;border-radius:14px;padding:11px 13px;font-size:15px;">'
                + '<button id="gd-em-add" style="padding:11px 16px;border-radius:16px;border:none;background:#33363b;color:#fff;font-size:14px;">添加</button></div>'
                + '<div style="font-size:12px;color:#9a958f;margin:18px 0 8px;font-weight:600;">公共紧急号码（同样为机内模拟）</div>'
                + '<div style="display:flex;gap:8px;">'
                + '<button data-em-call="报警|110" style="flex:1;padding:13px 0;border-radius:16px;border:1px solid #ece7e2;background:#fff;font-size:15px;font-weight:600;">110 报警</button>'
                + '<button data-em-call="急救|120" style="flex:1;padding:13px 0;border-radius:16px;border:1px solid #ece7e2;background:#fff;font-size:15px;font-weight:600;">120 急救</button>'
                + '<button data-em-call="火警|119" style="flex:1;padding:13px 0;border-radius:16px;border:1px solid #ece7e2;background:#fff;font-size:15px;font-weight:600;">119 火警</button>'
                + '</div></div>';
            ov.innerHTML = html;
            var closeBtn = ov.querySelector('#gd-em-close');
            if (closeBtn) closeBtn.onclick = closeEmergency;
            var addBtn = ov.querySelector('#gd-em-add');
            if (addBtn) addBtn.onclick = function () {
                var nm = (ov.querySelector('#gd-em-name') || {}).value || '';
                var nb = (ov.querySelector('#gd-em-num') || {}).value || '';
                if (!nm.trim() || !nb.trim()) { alert('请填写姓名和号码'); return; }
                var arr = load(); arr.push({ id: uid(), name: nm.trim(), number: nb.trim() }); save(arr); render();
            };
            ov.querySelectorAll('[data-em-call]').forEach(function (b) {
                b.onclick = function () {
                    var parts = (b.getAttribute('data-em-call') || '').split('|');
                    simCall = { name: parts[0], number: parts[1] || '', startedAt: Date.now() };
                    render();
                    if (simTimer) clearInterval(simTimer);
                    simTimer = setInterval(function () {
                        var el = document.getElementById('gd-em-timer');
                        if (el && simCall) el.textContent = fmtDur(Math.round((Date.now() - simCall.startedAt) / 1000));
                    }, 1000);
                };
            });
            ov.querySelectorAll('[data-em-del]').forEach(function (b) {
                b.onclick = function () { save(load().filter(function (x) { return x.id !== b.getAttribute('data-em-del'); })); render(); };
            });
            var hang = ov.querySelector('#gd-em-hangup');
            if (hang) hang.onclick = function () { if (simTimer) { clearInterval(simTimer); simTimer = null; } simCall = null; render(); };
        };
        render();
        shell.appendChild(ov);
    }
    function closeEmergency() {
        if (simTimer) { clearInterval(simTimer); simTimer = null; }
        simCall = null;
        var old = document.getElementById('gd-emergency');
        if (old) old.remove();
    }
    GD.openEmergency = openEmergency;
    GD.closeEmergency = closeEmergency;
})();

/* ══════════ 12. 查手机内嵌浏览器 / 音乐：本地真实记录汇总 ══════════
   供此刻 buildPhoneFallback 的 default 分支调用（见补丁锚点）。
   浏览器：扫描微信会话与朋友圈里出现过的真实链接；没有则返回 null（空态指引）。
   音乐：微信音乐分享 + 本机自添曲目；没有则返回空歌单（空态指引）。 */
(function () {
    function phoneFallback(appId) {
        var wx = wxStore();
        if (appId === 'browser') {
            var found = []; var seen = {};
            var scanText = function (text, time) {
                if (!text) return;
                var re = /https?:\/\/[^\s"'<>）】]+/g; var m;
                while ((m = re.exec(String(text))) !== null) {
                    var url = m[0].replace(/[.,;!?]+$/, '');
                    if (seen[url]) continue; seen[url] = 1;
                    var host = ''; try { host = new URL(url).host; } catch (e) { host = url; }
                    found.push({ title: host, url: url, summary: String(text).slice(0, 60), time: time || '' });
                }
            };
            try {
                (wx && Array.isArray(wx.sessions) ? wx.sessions : []).forEach(function (s) {
                    (s.messages || []).forEach(function (mm) { scanText(mm.text || mm.content || '', s.lastTime || ''); });
                });
                (wx && Array.isArray(wx.moments) ? wx.moments : []).forEach(function (mo) { scanText(mo.content || mo.text || '', mo.time || ''); });
            } catch (e) {}
            if (!found.length) return null;
            return { _local: true, history: found.slice(0, 10) };
        }
        if (appId === 'sim_music') {
            var songs = (GD.localTracks ? GD.localTracks() : []).map(function (t) {
                return { title: t.title, artist: t.artist || '', reason: t.source === '微信音乐分享' ? '来自微信聊天中的音乐分享' : '本地曲目（本机自添）' };
            });
            return { _local: true, songs: songs };
        }
        return null;
    }
    GD.phoneFallback = phoneFallback;
})();

/* ══════════ 13. 旧控制中心 ↔ 新 SystemCenter 双向同步 ══════════
   底层同一键 syscenter_cc_v1；新版读写走 SystemCenter.getCC/setCC（补丁锚点新增），
   蜂窝数据在新版里没有对应开关，以 cellular 字段存在同一键里。 */
(function () {
    var CC_KEY = 'syscenter_cc_v1';
    var MAP = { 'cc-btn-wifi': 'wifi', 'cc-btn-bt': 'bluetooth', 'cc-btn-cell': 'cellular', 'cc-btn-air': 'airplane' };
    var readState = function () {
        try { if (typeof SystemCenter !== 'undefined' && SystemCenter.getCC) return SystemCenter.getCC(); } catch (e) {}
        try { var r = localStorage.getItem(CC_KEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; }
    };
    var writeState = function (key, val) {
        try { if (typeof SystemCenter !== 'undefined' && SystemCenter.setCC) { SystemCenter.setCC(key, val); return; } } catch (e) {}
        try { var cur = readState(); cur[key] = val; localStorage.setItem(CC_KEY, JSON.stringify(cur)); } catch (e) {}
    };
    var paint = function () {
        var ccEl = document.getElementById('sys-control-center'); if (!ccEl) return;
        var st = readState();
        Object.keys(MAP).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('active', !!st[MAP[id]]);
        });
        var boxes = ccEl.querySelectorAll('.sys-cc-slider-box');
        if (boxes[0]) { var f0 = boxes[0].querySelector('.sys-cc-slider-fill'); if (f0 && st.brightness != null) f0.style.height = st.brightness + '%'; }
        if (boxes[1]) { var f1 = boxes[1].querySelector('.sys-cc-slider-fill'); if (f1 && st.volume != null) f1.style.height = st.volume + '%'; }
    };
    var syncOldCC = function () {
        var ccEl = document.getElementById('sys-control-center'); if (!ccEl) return;
        /* 捕获阶段拦截：先于 ControlCenterEngine 的本地切换处理，避免双重取反 */
        ccEl.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.sys-cc-icon') : null;
            if (!btn || !btn.id || !MAP[btn.id]) return;
            e.stopPropagation();
            var key = MAP[btn.id];
            var st = readState(); var nv = !st[key];
            if (btn.id === 'cc-btn-air') {
                writeState('airplane', nv);
                if (nv) { writeState('wifi', false); writeState('bluetooth', false); writeState('cellular', false); }
                else { writeState('wifi', true); writeState('bluetooth', true); writeState('cellular', true); }
            } else {
                writeState(key, nv);
            }
            paint();
        }, true);
        /* 滑块松手后把亮度/音量写回同一键 */
        var persistSliders = function () {
            var boxes = ccEl.querySelectorAll('.sys-cc-slider-box');
            var readPct = function (box) { var f = box && box.querySelector('.sys-cc-slider-fill'); if (!f) return null; var v = parseFloat(String(f.style.height || '').replace('%', '')); return isNaN(v) ? null : Math.round(v); };
            var b = boxes[0] ? readPct(boxes[0]) : null;
            var v = boxes[1] ? readPct(boxes[1]) : null;
            if (b != null) writeState('brightness', b);
            if (v != null) writeState('volume', v);
            paint();
        };
        ccEl.addEventListener('mouseup', function () { setTimeout(persistSliders, 60); });
        ccEl.addEventListener('touchend', function () { setTimeout(persistSliders, 60); }, { passive: true });
        /* 打开旧控制中心时按新版状态重绘；新版变化时也重绘 */
        try {
            new MutationObserver(function () { if (ccEl.classList.contains('sys-active')) paint(); })
                .observe(ccEl, { attributes: true, attributeFilter: ['class'] });
        } catch (e) {}
        window.addEventListener('syscenter-cc-changed', paint);
        paint();
    };
    GD.syncOldCC = syncOldCC;
    GD._readCC = readState;
    GD._paintCC = paint;
    setTimeout(syncOldCC, 800);
})();

/* ══════════ Group I · 剧本 · Optical Archive 风格胶片阅读机 ══════════
   灵感/出处：Optical Archive（MIT）—— github.com/codedog2/undergrounder_template
   一台复古胶片阅读机：电脑上是可交互 3D 场景（three.js），手机和不支持 3D 的
   浏览器自动进入同风格 2D 简洁版；内容全在 content.json 里，改内容不用碰代码；
   机器（屏幕、悬挂机械臂、转轮、导轮闸、旋钮面板、吊灯）全部用代码生成。
   [GROUP-FIX9] 重做：人物选择器 + 视觉小说区收进本 app 的 renderBody（之前是
   AW 组以外挂注入 #aw-script-cast / #aw-script-vn 塞进来的，每次 _refresh
   都会被洗掉、要等 3 秒 tick 才回来；见 OA_HELPERS 前的注释）；3D 阅读机场景
   只在大屏上用 three.js（CDN 动态加载，与 VRM 组同一做法）作环境点缀，
   加载不到或手机上仍是 2D 基线；顶部屏幕框放映剧情、下面胶片条显示放映
   进度、转轮推进剧情、旋钮切换胶片、暖光吊灯；剧本就是一卷胶片，演完归
   档进记忆（档案架 = 一排胶片盒）。
   剧本数据结构（content.json 思路，改剧本不用碰代码）：
     script = { id, title, desc, setting, scenes, endings }
     scenes[i] = { id, title, bg, lines:[{who, text}], choice:{prompt, options:[{text, affection, reply}]} | null }
       who: 'char'（主角）/ 'you'（你）/ 'narr'（旁白）；bg 是场景底色 key
       choice 可为空（纯剧情场景）；options 的 affection 是好感变化（可正可负）
     endings[i] = { min, label, text }（按 min 从大到小，取第一个 affection >= min 的）
   新 localStorage 键：
     phone_script_custom_v1（自定义剧本数组，同上结构）
     phone_script_memories_v1（已保存记忆引用：归巢记忆 id + 剧本名/日期/结局摘要）
     phone_script_session_v1（进行中的演绎状态；放弃记忆时删掉它）
   AE 组新增键：phone_script_plays_v1（游玩记录）/ phone_script_achievements_v1
   （结局投票 + 成就计数）/ phone_event_log_v1（统一事件流）；回合制放映、暗线、
   char 小目标、每日一句、本地题库、玻璃拟态见 GROUP-AE-SCRIPT-ROUNDS 注释块。
   归巢记忆键 guichao.memories.v1 只按原形状追加/删除单条（分类 relationship），
   绝不改动用户已有的任何记忆。主角名字尽量从此刻数据取（SystemStore character），
   取不到用“机”；发色瞳色读 cike_char_look_v1，没有用默认深棕发 + 深色瞳。 */
(function () {
    var CUSTOM_KEY = 'phone_script_custom_v1';
    var SAVED_KEY = 'phone_script_memories_v1';
    var SESSION_KEY = 'phone_script_session_v1';
    var GC_KEY = 'guichao.memories.v1';
    var LOOK_KEY = 'cike_char_look_v1';
    var loadArr = function (k) { var a = store.get(k, []); return Array.isArray(a) ? a : []; };
    var saveArr = function (k, a) { store.set(k, a); };
    var todayStr2 = function () { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
    var getCharName = function () {
        try { var c = (typeof SystemStore !== 'undefined' && SystemStore.get('character')) || ''; if (c) return c; } catch (e) {}
        return '机';
    };
    var getLook = function () {
        try { var v = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null'); if (v && v.hair && v.eye) return { hair: v.hair, eye: v.eye }; } catch (e) {}
        return { hair: '#3a2a1e', eye: '#2b2b2b' };
    };
    var SCENE_BG = {
        rain: 'linear-gradient(170deg,#5a6b7d 0%,#3c4a5c 55%,#2c3846 100%)',
        cafe: 'linear-gradient(170deg,#8a6a4b 0%,#6b4c30 55%,#4a3421 100%)',
        festival: 'linear-gradient(170deg,#c96a5a 0%,#a34a6e 55%,#5e3a5e 100%)',
        fireworks: 'linear-gradient(170deg,#2c2c54 0%,#4a2c6e 55%,#1e1e3a 100%)',
        snow: 'linear-gradient(170deg,#8fa3b8 0%,#6b7f96 55%,#46586e 100%)',
        station: 'linear-gradient(170deg,#5e6b7a 0%,#42506a 55%,#2e3a4e 100%)',
        bookstore: 'linear-gradient(170deg,#7a6a4e 0%,#5e4e34 55%,#40342a 100%)',
        dusk: 'linear-gradient(170deg,#d08a5a 0%,#a35e4a 55%,#6e3a44 100%)'
    };
    var L = function (who, text) { return { who: who, text: text }; };
    var O = function (text, affection, reply) { return { text: text, affection: affection, reply: reply }; };
    var SCRIPT_BUILTINS = []; // [AJ] 4 卷内置剧本（雨夜咖啡馆/夏日祭/雪夜车站/旧书店重逢）已清空，只剩自定义剧本入口

/* ══════════ Group AE · 剧本回合制 / 暗线 / 游玩记录 / 统一事件流 ══════════
15 链接批量调研的“剧本 app / 归巢区”分组（只借玩法与结构层面的思路，
自己写代码，不复制任何项目代码）：
- DM 回合结构、暗线、本地剧本存取、JSONL 导出 + 复盘、摘要压缩、
统一事件流、结局投票、本地题库、每日一句：借鉴该批调研里“剧本/归巢”
分组归纳的做法（DM round structure, hidden plot threads, localStorage
scripts, JSONL export + recap, summary compression, unified event
stream, ending votes, local prompt decks, daily quote）。
- 随机事件触发：借鉴同批“桌宠”分组的两层状态机（persistent mood +
one-shot actions）与“otome 3D home”分组的隐藏概率规则（hidden
probability rules）——只借“按概率触发一次性事件”的思路，概率与文案自写。
- 未借：tux-pet-js（GPL-3.0）的任何代码与 Tux/GNU/Gopher/Ferris 形象；
chatbot-showdown / mini-games / notion-aesthetic-pomodoro 三个无许可证
项目的代码（只借了玩法结构）；Calender 演示站打不开，未验证，未用；
C 档（服务器/部署、真实大模型调用、多人联机、桌面端形态与输入、
外部依赖与联网内容）一项未做。DM 仍为本地模板，界面处处标注
“本地模板生成，非 AI 生成”；AG 组接模型已合入
（window.PhoneModel.dmLineForScript，仅在选项后追加一句 DM 旁白，不改
好感/结局，AE 的 choose 保留了该钩子），AE 本身不读任何 API Key。
许可红线：本批无 AGPL；GPL-3.0 代码与形象一行未搬；无许可证项目代码
一行未抄；未引入任何外链。
新增 localStorage 键（只新增这三个）：
phone_script_plays_v1（游玩记录数组）
phone_script_achievements_v1（结局投票 + 成就计数）
phone_event_log_v1（统一事件流数组）
只读/复用旧键：phone_script_custom_v1 / phone_script_memories_v1 /
phone_script_session_v1 / guichao.memories.v1（只按原形状追加/删除单条，
不改已有记忆）；otome_affection_v1 仅作 Z 组对接口说明，不读写
（剧本内好感只用 session.affection，评判 ±5 只改本场好感）。
Z 组对接口：window.ScriptAE.zInterface()；Z 组已合入本文件
（window.GroupZ，GROUP-Z-OTOME-HOME，otome_vote_v1 / otome_rewards_v1）：
AE 投票时同时调 GroupZ.voteEnding 写进 otome_vote_v1.endingVotes，
成就口径以 Z 为准（首票「结局之选」，累计 3 票「三部曲之选」）；
phone_script_achievements_v1 只是剧本 app 内的镜像（每部剧本首次投票
计 1 分，供游玩记录页展示），不与 Z 重复计分。
标记：GROUP-AE-SCRIPT-ROUNDS
══════════ */
var AE_MARK = 'GROUP-AE-SCRIPT-ROUNDS';
var PLAYS_KEY = 'phone_script_plays_v1';
var ACH_KEY = 'phone_script_achievements_v1';
var EVENT_KEY = 'phone_event_log_v1';
var AE_TEMPLATE_NOTE = '本地模板生成，非 AI 生成';
var AE_PHASE_NAMES = { dm: 'DM开场', char: 'char行动', you: '你行动', summary: '回合汇总'};
var aeClamp = function (v) { v = +v || 0; return v < 0? 0: (v > 100? 100: Math.round(v));};
/* 每日一句：全部为本组新写的中文文案，按日期轮换，不抄任何现成句子。 */
var AE_DAILY_QUOTES = [
'今天的雨下得正好，适合把想说的话慢慢说完。',
'路灯一盏一盏亮起来的时候，记得抬头看一眼天。',
'热牛奶要趁热喝，想见的人也要趁早去见。',
'旧书店的角落里，总有一本书在等一个对的人。',
'烟花散场之后，夏天还没有结束，别急着回家。',
'雪夜的站台很冷，但有人等你，就不算太冷。',
'把今天过成值得写进日记的一天，哪怕只是一件小事。',
'祭典的金鱼属于夏天，而你属于每一个正在发生的今天。',
'末班车开走了也没关系，首班车的光总会从远处来。',
'先把围巾围好，再慢慢想接下来要去哪里。'
];
var AE_QUIZ_QUESTIONS = [
'怪问题：如果今天必须用一种味道形容心情，你选哪种？为什么是它？',
'怪问题：如果可以把此刻的场景存进一只玻璃罐，你会往罐子里再塞点什么？',
'怪问题：假如这条街上的灯只能亮一盏，你希望是哪一盏？',
'怪问题：如果猫会说话，它刚才那一眼到底想说什么？',
'怪问题：用三样随身小东西，拼出你今天的心情。',
'怪问题：如果雨停的那一秒会定格，你想把那一秒留给谁？',
'怪问题：这家店里只能带走一样东西，你拿什么？',
'怪问题：假如今晚的月亮会回你的消息，你第一句发什么？'
];
var AE_SCENE_CARDS = [
'场景卡：深夜的便利店——只剩最后一罐热牛奶，你们一人一半。',
'场景卡：天台的风很大——他把外套脱下来，先给你披上。',
'场景卡：旧书店打烊前十分钟——你们同时伸手去够同一本书。',
'场景卡：雨停的站台——水洼里映着两盏路灯，和两个人的影子。',
'场景卡：祭典散场的人潮——他忽然牵住你的手，说别走散了。',
'场景卡：雪夜的电话亭——电话那头的人说，我在你楼下。',
'场景卡：清晨的菜市场——他认真地挑了一颗最圆的橘子给你。',
'场景卡：午后的阁楼——一箱旧信里，夹着一张写着你名字的车票。'
];
var AE_RANDOM_EVENTS = [
'路过的猫跳上窗台，看了你们一眼，又慢悠悠地走了。',
'一阵风吹过，桌上的纸杯垫翻了个面，像在替你们做决定。',
'远处传来一声烟花似的闷响，其实只是有人在放鞭炮。',
'店里的收音机忽然切到一首很老的歌，你们都没说话。',
'雨点敲在窗上，忽然密了一阵，又忽然停了。',
'一只纸飞机从楼上飘下来，落在你们桌边，上面什么都没写。'
];
var aeDailyQuote = function (d) {
d = d || new Date();
var start = new Date(d.getFullYear(), 0, 0);
var day = Math.floor((d - start) / 86400000);
return AE_DAILY_QUOTES[day % AE_DAILY_QUOTES.length];
};
var aePick = function (list, rand) {
var r = (typeof rand === 'function')? rand(): Math.random();
return list[Math.floor(r * list.length) % list.length];
};
var aeQuizDraw = function (kind, rand) {
if (kind === 'scene') return { kind: 'scene', text: aePick(AE_SCENE_CARDS, rand), note: '预置题库，非 AI 生成'};
return { kind: 'question', text: aePick(AE_QUIZ_QUESTIONS, rand), note: '预置题库，非 AI 生成'};
};
var aeMaybeRandomEvent = function (rand) {
var r = (typeof rand === 'function')? rand: Math.random;
if (r() >= 0.3) return null;
return AE_RANDOM_EVENTS[Math.floor(r() * AE_RANDOM_EVENTS.length) % AE_RANDOM_EVENTS.length];
};
var aeRoundDm = function (script, scene, round, charName) {
// GROUP-BK: 剧本 DM 先查世界书再生成（模板 DM 只记注入条目，不改台词；模型旁白走 PhoneModel.dmLineForScript，同样先查）。
try { if (window.WorldBook && window.WorldBook.first) window.WorldBook.first('script', charName, scene.title); } catch (e) {}
return '第' + round + '轮 · ' + scene.title + '。DM（' + (charName || '机') + '）说：' + (script.setting || script.desc || '') + '这一幕里，先看他怎么做，再轮到你。';
};
var aeCharAction = function (scene) {
var lines = (scene && scene.lines) || [];
for (var i = 0; i < lines.length; i++) if (lines[i].who === 'char') return lines[i].text;
return lines.length? lines[0].text: '他看着你，等你开口。';
};
var aeRoundSummary = function (script, scene, charAct, youAct, charName) {
var narr = ((scene && scene.lines) || []).filter(function (l) { return l.who === 'narr';}).map(function (l) { return l.text;}).slice(0, 1).join('');
var s = '这一轮，' + (charName || '机') + '先动了：' + charAct + '而你选择了：' + youAct + '。';
if (narr) s += narr;
s += '（本地模板汇总，非 AI 生成）';
return s;
};
var aeKeyFacts = function (script, ending, affection, charName, moments) {
var facts = [];
facts.push('主角：' + (charName || '机'));
facts.push('地点：' + String(script.setting || script.desc || '未注明').slice(0, 30));
facts.push('结局：' + ending.label + '（好感 ' + affection + '/100）');
var keys = (moments || []).filter(function (x) { return x;}).slice(0, 3);
if (keys.length) facts.push('关键情节：' + keys.join('；'));
var lines = [];
lines.push('' + script.title);
lines.push('关键事实：');
facts.forEach(function (f) { lines.push('· ' + f);});
lines.push('结局：' + (ending.text || ''));
lines.push('（本段只保留关键事实，其余情节折叠在剧本档案的摘要里。）');
return { facts: facts, content: lines.join('\n')};
};
var aeArchiveSummary = function (script, ending, affection, log, roundLog) {
var lines = [];
lines.push('');
lines.push('背景：' + (script.setting || script.desc || ''));
(roundLog || []).forEach(function (r) { lines.push('第' + r.round + '轮 · ' + (r.sceneTitle || '') + '：' + (r.summary || ''));});
var quotes = (log || []).filter(function (l) { return l.who === 'char';}).slice(-3);
if (quotes.length) { lines.push('他说：'); quotes.forEach(function (q) { lines.push('「' + String(q.text).replace(/[「」]/g, '') + '」');});}
lines.push('（本地模板汇总的折叠摘要，不进归巢。）');
return lines.join('\n');
};
var aePlaysToJsonl = function (plays) {
return (plays || []).map(function (p) { return JSON.stringify(p);}).join('\n') + ((plays && plays.length)? '\n': '');
};
var aeSearchPlays = function (plays, q) {
q = String(q || '').trim();
if (!q) return (plays || []).slice();
return (plays || []).filter(function (p) {
var hay = [p.scriptTitle, p.ending, (p.choices || []).join(' '), (p.hiddenThreads || []).map(function (x) { return x.text;}).join(' '), (p.randomEvents || []).map(function (x) { return x.text;}).join(' ')].join(' ');
return hay.indexOf(q) >= 0;
});
};

/* ── 统一事件流 + 游玩记录 + 成就（纯读写，可单测）── */
var logEvent = function (type, actor, summary, ref) {
var rows = readEvents();
var row = { id: uid(), ts: Date.now(), type: type, actor: actor || '你', summary: summary || '', ref: ref || {} };
rows.push(row);
if (rows.length > 500) rows = rows.slice(-500);
saveArr(EVENT_KEY, rows);
return row;
};
var readEvents = function () { return loadArr(EVENT_KEY); };
var loadPlays = function () { return loadArr(PLAYS_KEY); };
var savePlays = function (a) { saveArr(PLAYS_KEY, a); };
var loadAch = function () {
try { var r = localStorage.getItem(ACH_KEY); if (r) { var v = JSON.parse(r); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } } catch (e) {}
return { votes: {}, votedEndings: [], counts: { plays: 0, votes: 0, goalsMet: 0, hiddenFound: 0 }, badges: [] };
};
var saveAch = function (a) { try { localStorage.setItem(ACH_KEY, JSON.stringify(a)); } catch (e) {} };
var recordPlay = function (play) {
var plays = loadPlays();
plays.unshift(play);
if (plays.length > 200) plays = plays.slice(0, 200);
savePlays(plays);
var ach = loadAch();
ach.counts = ach.counts || { plays: 0, votes: 0, goalsMet: 0, hiddenFound: 0 };
ach.counts.plays = (ach.counts.plays || 0) + 1;
ach.counts.hiddenFound = (ach.counts.hiddenFound || 0) + ((play.hiddenThreads || []).length);
if (play.goalMet) ach.counts.goalsMet = (ach.counts.goalsMet || 0) + 1;
saveAch(ach);
return play;
};
var recordVote = function (scriptId, scriptTitle, endingLabel) {
var ach = loadAch();
ach.votes = ach.votes || {};
var first = !ach.votes[scriptId];
ach.votes[scriptId] = { ending: endingLabel, votedAt: Date.now(), scriptTitle: scriptTitle };
ach.votedEndings = [];
Object.keys(ach.votes).forEach(function (sid) {
var v = ach.votes[sid];
ach.votedEndings.push({ scriptId: sid, scriptTitle: v.scriptTitle || sid, ending: v.ending, votedAt: v.votedAt });
});
ach.counts = ach.counts || { plays: 0, votes: 0, goalsMet: 0, hiddenFound: 0 };
ach.counts.votes = Object.keys(ach.votes).length;
saveAch(ach);
return { firstTime: first, points: ach.counts.votes };
};
var aeSummarizeEvents = function (events) {
var evs = events || [];
var byType = {};
var diaryLines = [];
var memoryTree = {};
var ach = { plays: 0, votes: 0, goalsMet: 0, hiddenFound: 0, randomEvents: 0 };
evs.forEach(function (e) {
byType[e.type] = (byType[e.type] || 0) + 1;
var d = new Date(e.ts || Date.now());
var ds = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
if (!memoryTree[ds]) memoryTree[ds] = { count: 0, types: {} };
memoryTree[ds].count++;
memoryTree[ds].types[e.type] = (memoryTree[ds].types[e.type] || 0) + 1;
if (e.type === 'script_save') ach.plays++;
if (e.type === 'script_vote') ach.votes++;
if (e.type === 'script_goal' && e.ref && e.ref.met) ach.goalsMet++;
if (e.type === 'script_hidden') ach.hiddenFound++;
if (e.type === 'script_random') ach.randomEvents++;
});
evs.slice(-5).forEach(function (e) { diaryLines.push({ date: new Date(e.ts || Date.now()).toISOString().slice(0, 10), text: e.summary || '' }); });
return { total: evs.length, byType: byType, recent: evs.slice(-10), diaryLines: diaryLines, memoryTree: memoryTree, achievements: ach };
};
var aeZInterface = function () {
return { status: 'Z 组已合入（window.GroupZ，otome_vote_v1 / otome_rewards_v1）；AE 投票同时调 GroupZ.voteEnding 写进 otome_vote_v1，成就口径以 Z 为准', achievementKey: 'otome_vote_v1', achievementMirrorKey: ACH_KEY, eventKey: EVENT_KEY, playsKey: PLAYS_KEY, voteShape: { votes: '{scriptId: {ending, votedAt, scriptTitle}}', votedEndings: '[{scriptId, scriptTitle, ending, votedAt}]' }, pointsRule: 'Z 口径：每次投票记一票进 otome_vote_v1.endingVotes（上限 20 条），首票得「结局之选」徽章，累计 3 票得「三部曲之选」；AE 镜像按每部剧本首次投票计 1 分展示，不与 Z 重复计分；小目标达成不另计成就分，只影响本场好感 ±5', eventTypes: ['script_round', 'script_hidden', 'script_random', 'script_goal', 'script_end', 'script_vote', 'script_save', 'game_match', 'gift', 'explore', 'pomodoro_done'], externalWrites: { game_match: '斗地主 _ddzScore（已接）', gift: '赠礼 giveGift（已接）', explore: '探险 applyExploreChoice（已接）', pomodoro_done: '番茄专注 focusEnd（已接）' }, readInterface: 'window.ScriptAE.summarizeEvents(window.ScriptAE.readEvents()) 供日记 / 记忆树 / 成就汇总读取；写接口 window.ScriptAE.logEvent(type, actor, summary, ref)' };
};
/* ── 回合制会话字段（老会话缺字段时补默认值，不丢已有进度）── */
var ensureRoundFields = function () {
if (!session) return;
if (session.roundPhase == null) session.roundPhase = 'dm';
if (session.round == null) session.round = 1;
if (!Array.isArray(session.roundLog)) session.roundLog = [];
if (!Array.isArray(session.hiddenThreads)) session.hiddenThreads = [];
if (!Array.isArray(session.randomEvents)) session.randomEvents = [];
if (!('goalMet' in session)) session.goalMet = null;
if (!('goalJudged' in session)) session.goalJudged = false;
if (!('vote' in session)) session.vote = null;
if (!session.playId) session.playId = uid();
if (!('youAction' in session)) session.youAction = null;
if (!('deckDraw' in session)) session.deckDraw = null;
};
var maybeTriggerHidden = function (sc) {
if (!session || !sc || !sc.hiddenThread) return null;
ensureRoundFields();
var node = sc.hiddenThread.node || 0;
if (session.sceneIdx !== node) return null;
var found = null;
(session.hiddenThreads || []).forEach(function (x) { if (x.node === node) found = x; });
if (found) return found;
var rec = { node: node, text: sc.hiddenThread.text || '', triggeredAt: Date.now() };
session.hiddenThreads.push(rec);
logEvent('script_hidden', getCharName(), '暗线提示出现（' + sc.title + ' 第 ' + (node + 1) + ' 幕）', { kind: 'hidden', scriptId: sc.id, node: node });
persistSession(session);
return rec;
};
var finishRoundSummary = function (sc, scene) {
ensureRoundFields();
var charAct = aeCharAction(scene);
var youAct = session.youAction || '静观其变，继续向前';
var summary = aeRoundSummary(sc, scene, charAct, youAct, getCharName());
session.roundLog.push({ round: session.round || 1, sceneId: scene.id, sceneTitle: scene.title, charAction: charAct, youAction: youAct, summary: summary });
session.log.push({ who: 'narr', text: summary });
var ev = aeMaybeRandomEvent(Math.random);
if (ev) {
session.randomEvents.push({ round: session.round || 1, text: ev, at: Date.now() });
logEvent('script_random', getCharName(), '随机事件：' + ev, { kind: 'random', scriptId: sc.id, round: session.round || 1 });
}
logEvent('script_round', getCharName(), '第 ' + (session.round || 1) + ' 轮完成：' + scene.title + '——' + youAct, { kind: 'round', scriptId: sc.id, round: session.round || 1 });
session.roundPhase = 'summary';
persistSession(session);
};
var saveKeyFactsRecord = function (script, ending, affection, keyFacts, archiveSummary, dateStr, finished) {
var now = Date.now();
var mem = { id: uid(), title: '' + script.title + ' · ' + ending.label, category: 'relationship', content: keyFacts.content, created: now, updated: now };
var gc = loadArr(GC_KEY); gc.push(mem); saveArr(GC_KEY, gc);
var refs = loadArr(SAVED_KEY);
refs.unshift({ id: mem.id, scriptId: script.id, scriptTitle: script.title, date: dateStr, ending: ending.label, affection: affection, summary: keyFacts.content.slice(0, 90), keyFacts: keyFacts.facts, archiveSummary: archiveSummary });
saveArr(SAVED_KEY, refs);
return mem;
};
var aePhaseCards = function (sc, scene) {
ensureRoundFields();
var phase = session.roundPhase || 'dm';
var h = '';
if (phase === 'dm') {
h += '<div class="sc-glass"><div class="sc-glass-tag">🎬 DM 开场 · 第' + (session.round || 1) + '轮</div><div style="font-size:13.5px;line-height:1.7;color:#2b2a28;margin-top:4px;">' + esc(aeRoundDm(sc, scene, session.round || 1, getCharName())) + '</div><div style="font-size:11px;color:#8a6d3b;margin-top:4px;">' + AE_TEMPLATE_NOTE + ' · 转轮进入 char 的行动</div></div>';
} else if (phase === 'char') {
h += '<div class="sc-glass"><div class="sc-glass-tag">🎭 char 的行动</div><div style="font-size:13.5px;line-height:1.7;color:#2b2a28;margin-top:4px;">' + esc(aeCharAction(scene)) + '</div><div style="font-size:11px;color:#8a6d3b;margin-top:4px;">' + AE_TEMPLATE_NOTE + ' · 转轮进入你的行动</div></div>';
} else if (phase === 'summary') {
var last = session.roundLog[session.roundLog.length - 1];
if (last) h += '<div class="sc-glass"><div class="sc-glass-tag">📖 回合汇总 · 第' + last.round + '轮</div><div style="font-size:13.5px;line-height:1.7;color:#2b2a28;margin-top:4px;">' + esc(last.summary) + '</div><div style="font-size:11px;color:#8a6d3b;margin-top:4px;">' + AE_TEMPLATE_NOTE + '</div></div>';
var re = (session.randomEvents || []).filter(function (x) { return x.round === (session.round || 1); });
re.forEach(function (x) { h += '<div class="sc-glass" style="margin-top:10px;"><div class="sc-glass-tag">🎲 随机事件（本地预置）</div><div style="font-size:13px;line-height:1.65;color:#2b2a28;margin-top:4px;">' + esc(x.text) + '</div></div>'; });
}
var ht = null;
(session.hiddenThreads || []).forEach(function (x) { if (x.node === session.sceneIdx) ht = x; });
if (ht) h += '<div class="sc-glass" style="margin-top:10px;"><div class="sc-glass-tag">🔦 暗线提示（只出现一次）</div><div style="font-size:13px;line-height:1.65;color:#2b2a28;margin-top:4px;">' + esc(ht.text) + '</div></div>';
return h;
};
var aeEndingExtra = function (sc, ending) {
if (!sc) return '<div class="sc-card"><p>剧本找不到了，复盘不可用。</p></div>';
ensureRoundFields();
var h = '';
h += '<div class="sc-glass" style="margin-top:10px;"><div style="font-size:13px;font-weight:700;color:#3d2c17;margin-bottom:6px;">📜 复盘（本场）</div>';
var ht = session.hiddenThreads || [];
var re = session.randomEvents || [];
if (ht.length) { h += '<div style="font-size:12.5px;line-height:1.7;color:#2b2a28;">🔦 触发的暗线：</div>'; ht.forEach(function (x) { h += '<div style="font-size:12.5px;line-height:1.7;color:#2b2a28;">· 第' + (x.node + 1) + '幕：' + esc(x.text) + '</div>'; }); }
else h += '<div style="font-size:12.5px;line-height:1.7;color:#6b6560;">本场没有触发暗线。</div>';
if (re.length) { h += '<div style="font-size:12.5px;line-height:1.7;color:#2b2a28;margin-top:4px;">🎲 随机事件：</div>'; re.forEach(function (x) { h += '<div style="font-size:12.5px;line-height:1.7;color:#2b2a28;">· 第' + x.round + '轮：' + esc(x.text) + '</div>'; }); }
else h += '<div style="font-size:12.5px;line-height:1.7;color:#6b6560;">本场没有随机事件。</div>';
h += '<div style="font-size:11px;color:#8a6d3b;margin-top:4px;">暗线只在指定节点出现一次；随机事件为本地预置，按概率触发。</div></div>';
h += '<div class="sc-card" style="margin-top:10px;"><h3>🗳 选一个最喜欢的结局</h3><p>多个结局都在下面，选一个最喜欢的，计入成就（同步记进 Z 组 otome_vote_v1；AE 镜像按每部剧本首次投票计 1 分）。</p><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">';
(sc.endings || []).forEach(function (e, i) { h += '<button class="sc-btn' + (session.vote === e.label ? ' warm' : ' ghost') + '" data-act="vote-ending" data-i="' + i + '">' + esc(e.label) + '</button>'; });
h += '</div>' + (session.vote ? '<p style="margin-top:8px;">你最喜欢的结局：' + esc(session.vote) + '（已计入成就）</p>' : '') + '</div>';
if (sc.charGoal && sc.charGoal.goal) {
h += '<div class="sc-card" style="margin-top:10px;"><h3>🎯 char 的小目标</h3><p>这段支线里，' + esc(getCharName()) + ' 的小目标是：' + esc(sc.charGoal.goal) + '。你来评判达成与否——达成好感 +5，未达成好感 −5。</p>';
if (session.goalJudged) { h += '<p style="margin-top:8px;">你的评判：' + (session.goalMet ? '达成 ✓（好感 +5）' : '未达成（好感 −5）') + '。' + esc(session.goalMet ? (sc.charGoal.doneBranch || '') : (sc.charGoal.failBranch || '')) + ' 当前好感 ' + session.affection + ' / 100。</p>'; }
else h += '<div style="display:flex;gap:8px;margin-top:10px;"><button class="sc-btn warm" data-act="goal-yes">✓ 达成了</button><button class="sc-btn ghost" data-act="goal-no">✗ 没达成</button></div>';
h += '</div>';
} else {
h += '<div class="sc-card" style="margin-top:10px;"><h3>🎯 char 的小目标</h3><p>这本剧本没有给 char 设小目标（老剧本或自定义剧本可能没有这一项）。</p></div>';
}
h += '<div style="font-size:11px;color:#8a6d3b;margin-top:8px;">保存记忆时：关键事实（主角、地点、结局、好感）写进归巢，其余情节折叠成摘要存在档案架里，不全塞进归巢。' + AE_TEMPLATE_NOTE + '。</div>';
return h;
};

/* ── 纯函数（可抽出做 Node 冒烟测试；不碰 DOM）── */
var allScripts = function () { return SCRIPT_BUILTINS.concat(loadArr(CUSTOM_KEY));};
var findScript = function (id) { var a = allScripts(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null;};
var computeEnding = function (script, affection) {
var ends = (script.endings || []).slice().sort(function (a, b) { return b.min - a.min;});
for (var i = 0; i < ends.length; i++) if (affection >= ends[i].min) return ends[i];
return ends.length? ends[ends.length - 1]: { min: 0, label: '结局', text: ''};
};
var validateScript = function (sc) {
var errs = [];
if (!sc ||!String(sc.title || '').trim()) errs.push('标题不能为空');
if (!sc ||!Array.isArray(sc.scenes) ||!sc.scenes.length) errs.push('至少要有一个场景');
(sc.scenes || []).forEach(function (s, i) {
if (!Array.isArray(s.lines) ||!s.lines.length) errs.push('第' + (i + 1) + '幕没有台词');
(s.lines || []).forEach(function (ln) { if (!String(ln.text || '').trim()) errs.push('第' + (i + 1) + '幕有一句空台词');});
if (s.choice) {
if (!String(s.choice.prompt || '').trim()) errs.push('第' + (i + 1) + '幕的选项没有问题');
if (!Array.isArray(s.choice.options) ||!s.choice.options.length || s.choice.options.length > 3) errs.push('第' + (i + 1) + '幕的选项要 1–3 个');
(s.choice.options || []).forEach(function (o) { if (!String(o.text || '').trim()) errs.push('第' + (i + 1) + '幕有一个空选项');});
}
});
if (!Array.isArray(sc.endings) || sc.endings.length < 2) errs.push('至少要有两个结局（好结局 / 普通结局）');
return errs;
};
var parseLines = function (text) {
var out = [];
String(text || '').split('\n').forEach(function (raw) {
var line = String(raw || '').trim(); if (!line) return;
var m = line.match(/^(.{1,6})[：:]\s*(.+)$/);
if (m) {
var who = (m[1] === '你')? 'you': ((m[1] === '旁白' || m[1] === '叙述')? 'narr': 'char');
out.push({ who: who, text: m[2]});
} else out.push({ who: 'narr', text: line});
});
return out;
};
var parseOptions = function (text) {
var out = [];
String(text || '').split('\n').forEach(function (raw) {
var line = String(raw || '').trim(); if (!line) return;
var parts = line.split('|').map(function (x) { return String(x || '').trim();});
var aff = 0; var mm = (parts[1] || '').match(/([+-]?\d+)/); if (mm) aff = parseInt(mm[1], 10);
out.push({ text: parts[0] || '', affection: aff, reply: parts[2] || ''});
});
return out;
};
var buildMemoryContent = function (script, ending, affection, log, moments, dateStr, finished) {
var lines = [];
lines.push('' + script.title);
lines.push('日期：' + dateStr + (finished? '': '（未演完，中途保存）'));
lines.push('背景：' + (script.setting || script.desc || ''));
var keys = (moments || []).filter(function (x) { return x;});
if (keys.length) { lines.push('关键情节：'); keys.forEach(function (k) { lines.push('· ' + k);});}
var quotes = (log || []).filter(function (l) { return l.who === 'char';}).slice(-2);
if (quotes.length) { lines.push('他说：'); quotes.forEach(function (q) { lines.push('「' + q.text.replace(/[「」]/g, '') + '」');});}
lines.push('结局：' + ending.label + '（好感 ' + affection + '/100）');
lines.push(ending.text || '');
return lines.join('\n');
};
var saveMemoryRecord = function (script, ending, affection, log, moments, dateStr, finished) {
var content = buildMemoryContent(script, ending, affection, log, moments, dateStr, finished);
var now = Date.now();
var mem = { id: uid(), title: '' + script.title + ' · ' + ending.label, category: 'relationship', content: content, created: now, updated: now};
var gc = loadArr(GC_KEY); gc.push(mem); saveArr(GC_KEY, gc);
var refs = loadArr(SAVED_KEY);
refs.unshift({ id: mem.id, scriptId: script.id, scriptTitle: script.title, date: dateStr, ending: ending.label, affection: affection, summary: content.slice(0, 90)});
saveArr(SAVED_KEY, refs);
return mem;
};
var deleteSavedRecord = function (refId) {
saveArr(SAVED_KEY, loadArr(SAVED_KEY).filter(function (r) { return r.id!== refId;}));
saveArr(GC_KEY, loadArr(GC_KEY).filter(function (m) { return m.id!== refId;}));
};
var clearSession = function () { try { localStorage.removeItem(SESSION_KEY);} catch (e) {}};
var loadSession = function () { try { var v = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return v && v.scriptId? v: null;} catch (e) { return null;}};
var persistSession = function (s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s));} catch (e) {}};

/* ── 此刻 QQ 小人设计语言的 Live2D 风格立绘（圆头、刘海、大眼睛）── */
var charSvg = function (look, affection) {
var hair = (look && look.hair) || '#3a2a1e'; var eye = (look && look.eye) || '#2b2b2b';
var blush = (affection || 0) >= 50? '0.85': '0.4';
var heart = (affection || 0) >= 60? '<text x="102" y="26" font-size="16" fill="#d96a6a">♥</text>': '';
return '<svg viewBox="0 0 120 150" style="width:100%;height:100%;display:block;" aria-label="主角立绘">'
+ '<path d="M22 150 C22 122 36 108 60 108 C84 108 98 122 98 150 Z" fill="#e8c9a8"/>'
+ '<path d="M52 108 L60 122 L68 108 Z" fill="#fff7ee"/>'
+ '<circle cx="60" cy="56" r="36" fill="' + esc(hair) + '"/>'
+ '<circle cx="60" cy="64" r="30" fill="#ffe9d6"/>'
+ '<path d="M30 62 Q32 30 60 28 Q88 30 90 62 Q84 46 74 52 Q70 38 60 40 Q50 38 46 52 Q36 46 30 62 Z" fill="' + esc(hair) + '"/>'
+ '<path d="M60 26 Q63 14 70 12 Q64 20 62 26 Z" fill="' + esc(hair) + '"/>'
+ '<ellipse cx="48" cy="66" rx="5.5" ry="7.5" fill="' + esc(eye) + '"/>'
+ '<ellipse cx="72" cy="66" rx="5.5" ry="7.5" fill="' + esc(eye) + '"/>'
+ '<circle cx="50" cy="63.5" r="2" fill="#fff"/><circle cx="74" cy="63.5" r="2" fill="#fff"/>'
+ '<path d="M42 56 Q48 53 54 56" stroke="' + esc(hair) + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
+ '<path d="M66 56 Q72 53 78 56" stroke="' + esc(hair) + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
+ '<ellipse cx="40" cy="78" rx="6" ry="3.6" fill="#f2a0a0" opacity="' + blush + '"/>'
+ '<ellipse cx="80" cy="78" rx="6" ry="3.6" fill="#f2a0a0" opacity="' + blush + '"/>'
+ '<path d="M54 84 Q60 89.5 66 84" stroke="#c97a5e" stroke-width="1.8" fill="none" stroke-linecap="round"/>' + heart + '</svg>';
};

/* ── 2D 阅读机样式：暖光吊灯 + 屏幕框 + 胶片条 + 转轮 + 旋钮 ── */
var SC_CSS = '<style>'
+ '.sc-wrap{background:radial-gradient(ellipse 200px 90px at 50% 0%,rgba(255,214,140,.5),transparent 70%),linear-gradient(180deg,#f7ead2 0%,#f3e2c6 100%);border-radius:18px;padding:14px 12px 16px;position:relative;}'
+ '.sc-lamprow{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin-bottom:6px;min-height:34px;}'
+ '.sc-machine{background:linear-gradient(180deg,#4a3a28,#33261a);border-radius:20px;padding:12px;box-shadow:0 10px 26px rgba(60,40,20,.35),inset 0 1px 0 rgba(255,255,255,.18);position:relative;z-index:1;}'
+ '.sc-screen{border:5px solid #1e1a16;border-radius:14px;overflow:hidden;background:#222;min-height:300px;position:relative;}'
+ '.sc-stage{height:300px;position:relative;display:flex;flex-direction:column;}'
+ '.sc-scene{flex:1;position:relative;overflow:hidden;}'
+ '.sc-standee{position:absolute;right:8px;bottom:0;width:118px;height:148px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));}'
+ '.sc-scene-tag{position:absolute;left:10px;top:10px;background:rgba(0,0,0,.45);color:#ffe9c4;font-size:11px;padding:3px 9px;border-radius:20px;letter-spacing:1px;}'
+ '.sc-dialog{position:absolute;left:0;right:0;bottom:0;background:rgba(255,253,248,.96);border-top:1px solid #e8ddc8;padding:10px 12px 32px;min-height:86px;} /* GROUP-BM BM-2：底垫 10px→32px，避开 Home 条 */'
+ '.sc-who{font-size:12px;font-weight:700;color:#8a6d3b;margin-bottom:3px;}'
+ '.sc-line{font-size:14.5px;line-height:1.65;color:#2b2a28;margin:0;}'
+ '.sc-aff{position:absolute;right:10px;top:10px;background:rgba(0,0,0,.45);color:#ffd9a0;font-size:11px;padding:3px 9px;border-radius:20px;}'
+ '.sc-film{display:flex;gap:6px;overflow-x:auto;padding:10px 2px 4px;}'
+ '.sc-frame{flex:0 0 auto;width:52px;border:2px solid #6b543a;border-radius:6px;background:#241a12;color:#e8cf9f;font-size:10px;text-align:center;padding:6px 2px;cursor:pointer;}'
+ '.sc-frame.on{border-color:#ffb84d;background:#3d2c17;color:#ffe1a0;}'
+ '.sc-frame.done{border-color:#8a6d3b;}'
+ '.sc-frame.holes{display:block;letter-spacing:2px;color:#8a6d3b;font-size:8px;}'
+ '.sc-controls{display:flex;align-items:center;gap:10px;margin-top:10px;}'
+ '.sc-wheel{width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8a6d4a,#4a3a28 70%);border:3px solid #2c2115;color:#ffe1a0;font-size:22px;cursor:pointer;flex-shrink:0;box-shadow:0 4px 10px rgba(0,0,0,.4);}'
+ '.sc-wheel:disabled{opacity:.45;cursor:default;}'
+ '.sc-knob{width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c9a86a,#7a5e34 70%);border:3px solid #2c2115;color:#fff3d6;font-size:17px;cursor:pointer;flex-shrink:0;}'
+ '.sc-ctl-note{flex:1;font-size:11.5px;color:#e8d9b8;line-height:1.6;}'
+ '.sc-opt{display:block;width:100%;text-align:left;background:#fffdf6;border:1px solid #e3d3ac;border-radius:12px;padding:11px 12px;margin-top:8px;font-size:14px;line-height:1.5;color:#2b2a28;cursor:pointer;}'
+ '.sc-opt:hover{border-color:#c9a86a;background:#fff8e6;}'
+ '.sc-opt.aff{float:right;color:#b07830;font-size:12px;}'
+ '.sc-tabrow{display:flex;gap:8px;margin:12px 0;}'
+ '.sc-tab{flex:1;text-align:center;padding:9px 4px;border-radius:12px;background:#fff;border:1px solid #eadfc6;font-size:13px;color:#6b5b3e;cursor:pointer;}'
+ '.sc-tab.on{background:#3d2c17;color:#ffe1a0;border-color:#3d2c17;}'
+ '.sc-card{background:#fff;border:1px solid #f0e6cf;border-radius:16px;padding:13px 14px;margin-bottom:10px;box-shadow:0 3px 12px rgba(90,75,60,.06);}'
+ '.sc-card h3{margin:0 0 4px;font-size:16px;}'
+ '.sc-card p{margin:0;font-size:13px;line-height:1.65;color:#6b6560;}'
+ '.sc-card.meta{font-size:11px;color:#a39a8d;margin-top:6px;}'
+ '.sc-btn{display:inline-block;background:rgba(255,255,255,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#2b2a28;border:1px solid rgba(255,255,255,.7);border-radius:14px;padding:9px 14px;font-size:13.5px;cursor:pointer;box-shadow:0 4px 14px rgba(90,75,60,.10);}'
+ '.sc-btn.ghost{background:rgba(255,255,255,.38);color:#2b2a28;border:1px solid rgba(255,255,255,.65);}'
+ '.sc-btn.warm{background:rgba(138,109,59,.62);color:#fff;border:1px solid rgba(255,255,255,.5);}'
+ '.sc-btn.danger{background:rgba(255,255,255,.45);color:#a33;border:1px solid rgba(224,176,176,.8);}'
 + '.sc-2dnote{font-size:11px;color:#a39a8d;text-align:center;margin-top:6px;}'
+ '.sc-can{background:linear-gradient(180deg,#5e4a30,#46341f);border-radius:12px;padding:11px 13px;margin-bottom:9px;color:#ffe9c4;cursor:pointer;}'
+ '.sc-can.t{font-size:14px;font-weight:600;}'
+ '.sc-can.m{font-size:11.5px;color:#d8bf96;margin-top:3px;line-height:1.5;}'
+ '.sc-field{display:grid;gap:5px;margin-bottom:11px;}'
+ '.sc-field label{font-size:12px;color:#686a71;}'
+ '.sc-field input,.sc-field textarea{border:1px solid #e2e3e6;border-radius:10px;padding:9px 11px;background:#fff;color:#292a2e;width:100%;box-sizing:border-box;}'
+ '.sc-field textarea{min-height:74px;resize:vertical;line-height:1.6;}'
+ '.sc-notice{margin:0 0 10px;padding:9px 12px;background:#fdf6ec;border:1px solid #f3e3c8;border-radius:12px;font-size:12.5px;line-height:1.6;color:#8a6d3b;}'
+ '.sc-screen-title{color:#ffe9c4;text-align:center;padding:74px 18px 0;}'
+ '.sc-screen-title h2{margin:0 0 8px;font-size:22px;letter-spacing:2px;}'
+ '.sc-screen-title p{margin:0;font-size:13px;line-height:1.7;color:#e8cf9f;}'
+ '.sc-cover-emoji{font-size:40px;margin-bottom:8px;}'
 + '.sc-glass{background:rgba(255,255,255,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.65);border-radius:16px;padding:13px 14px;box-shadow:0 4px 16px rgba(90,75,60,.08);}'
 + '.sc-3d{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:18px;}'
 + '.sc-3d canvas{width:100%;height:100%;display:block;}'
 + '.sc-reel{width:34px;height:34px;border-radius:50%;background:repeating-conic-gradient(#6b543a 0 18deg,#3d2c17 18deg 36deg);border:3px solid #2c2115;box-shadow:0 2px 6px rgba(0,0,0,.35);flex-shrink:0;position:relative;}'
 + '.sc-reel:after{content:"";position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#c9a86a;border:2px solid #2c2115;}'
 + '.sc-console{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.25);color:#e8d9b8;font-size:11px;letter-spacing:2px;}'
 + '.sc-console .sc-knobdot{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c9a86a,#7a5e34 70%);border:2px solid #2c2115;flex-shrink:0;}'
 + '.sc-console .sc-3d-toggle{margin-left:auto;letter-spacing:0;}'
 + '.sc-cast{margin-top:12px;}'
 + '.sc-cast-head{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}'
 + '.sc-cast-head b{font-size:14px;color:#2b2a28;}'
 + '.sc-cast-head span{font-size:12px;color:#8a6d3b;}'
 + '.sc-cast-strip{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:thin;}'
 + '.sc-cast-card{flex:0 0 108px;scroll-snap-align:center;background:rgba(255,255,255,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);border-radius:16px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 3px 10px rgba(90,75,60,.08);}'
 + '.sc-cast-card.on{border-color:#b08d3e;background:rgba(255,248,230,.85);box-shadow:0 4px 16px rgba(176,141,62,.25);}'
 + '.sc-cast-av{width:52px;height:52px;margin:0 auto 6px;border-radius:50%;background:linear-gradient(155deg,#8a7bb8,#5e4e8a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;}'
 + '.sc-cast-av img{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;}'
 + '.sc-cast-name{font-size:13px;font-weight:700;color:#2b2a28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
 + '.sc-cast-sub{font-size:11px;color:#8a6d3b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
 + '.sc-cast-arrow{flex:0 0 auto;align-self:center;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.55);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);color:#6b5b3e;font-size:16px;cursor:pointer;}'
 + '.sc-mode-row{display:flex;gap:8px;margin-top:10px;}'
 + '.sc-mode-row .sc-btn{flex:1;padding:12px 10px;font-size:14px;}'
 + '.sc-cast-empty{background:rgba(255,255,255,.55);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.65);border-radius:16px;padding:16px 14px;text-align:center;color:#6b5b3e;font-size:13px;line-height:1.8;}'
 + '.sc-vnrow{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #f0e6cf;border-radius:16px;padding:12px 14px;margin-bottom:10px;}'
 + '.sc-glass .sc-glass-tag{font-size:11px;color:#8a6d3b;letter-spacing:2px;}'
 + '.gd-root[data-gd="script"]{background:#f4f2ee;color:#292822;padding-bottom:calc(18px + env(safe-area-inset-bottom));}'
 + '.gd-root[data-gd="script"] .gd-body{padding:6px 12px 24px;}'
 + '.gd-root[data-gd="script"] .gd-note{margin:7px 12px 0;padding:7px 9px;font-size:10px;line-height:1.45;}'
 + '.sys-app-window .gd-root[data-gd="script"] .sc-btn.ghost{color:#2b2a28;}'
 + '.gd-root[data-gd="script"] .sc-tabrow{display:flex;gap:6px;overflow-x:auto;margin:10px 0;padding-bottom:2px;}'
 + '.gd-root[data-gd="script"] .sc-tab{flex:0 0 auto;padding:8px 12px;border-radius:999px;font-size:12px;}'
 + '.gd-root[data-gd="script"] .sc-wrap{padding:8px;border-radius:18px;background:#fff;box-shadow:0 5px 20px rgba(60,48,30,.08);}'
 + '.gd-root[data-gd="script"] .sc-lamprow{min-height:18px;margin-bottom:4px;}'
 + '.gd-root[data-gd="script"] .oa-home-machine{background:radial-gradient(ellipse at 50% 10%,rgba(160,112,57,.34),transparent 62%),linear-gradient(150deg,#211a18,#34261f 70%,#171311);box-shadow:0 5px 20px rgba(45,29,17,.24);}'
 + '.gd-root[data-gd="script"] .oa-home-machine .sc-lamprow{justify-content:space-around;}'
 + '.gd-root[data-gd="script"] .oa-home-machine .sc-machine{background:linear-gradient(180deg,#76552d,#352719);box-shadow:0 6px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,226,165,.3);}'
 + '.gd-root[data-gd="script"] .oa-home-machine .sc-screen{height:170px;min-height:0;border-width:4px;border-radius:13px;}'
 + '.gd-root[data-gd="script"] .oa-home-machine .sc-stage{height:170px;}'
 + '.gd-root[data-gd="script"] .sc-console,.gd-root[data-gd="script"] .sc-2dnote,.gd-root[data-gd="script"] .sc-3d-toggle{display:none!important;}'
 + '.oa-cast-hero{display:flex;align-items:center;gap:11px;padding:10px 12px;background:#fff;border:1px solid #ebe7e0;border-radius:17px;box-shadow:0 3px 12px rgba(60,48,30,.05);cursor:pointer;}'
 + '.oa-cast-portrait{width:48px;height:48px;border-radius:15px;flex:none;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#e7d8c5,#b79b76);color:#fff;font-size:22px;font-weight:700;}'
 + '.oa-cast-portrait img{width:100%;height:100%;object-fit:cover;}'
 + '.oa-cast-meta{flex:1;min-width:0;}'
 + '.oa-cast-meta small{display:block;color:#9b927f;font-size:10px;letter-spacing:1.5px;}'
 + '.oa-cast-meta b{display:block;margin-top:3px;color:#302a21;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
 + '.oa-cast-actions{display:flex;flex-direction:column;gap:5px;}'
 + '.oa-cast-actions button{border:1px solid #e8dfd0;background:#faf8f3;color:#68563b;border-radius:10px;padding:6px 8px;font-size:11px;white-space:nowrap;}'
 + '.oa-reel-shelf{display:flex;gap:9px;overflow-x:auto;padding:8px 1px 7px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}'
 + '.oa-reel-card{flex:0 0 82px;scroll-snap-align:center;border:1px solid #d6c9b3;border-radius:10px;padding:5px 5px 7px;background:#2f291f;color:#f5ead3;cursor:pointer;position:relative;box-shadow:0 3px 8px rgba(40,30,20,.14);}'
 + '.oa-reel-card:before,.oa-reel-card:after{content:"●　●　●";display:block;color:#a99470;font-size:6px;letter-spacing:1px;white-space:nowrap;overflow:hidden;height:8px;line-height:8px;}'
 + '.oa-reel-card.on{outline:2px solid #c8a35c;outline-offset:1px;background:#42341f;}'
 + '.oa-reel-art{height:57px;border-radius:5px;background:linear-gradient(145deg,#d9c7a6,#8c6d4c);display:flex;align-items:flex-end;justify-content:center;color:#fff;font-size:10px;font-weight:700;text-align:center;overflow:hidden;text-shadow:0 1px 4px #000;padding:4px;box-sizing:border-box;}'
 + '.oa-reel-label{font-size:10px;line-height:1.25;text-align:center;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
 + '.oa-home-caption{display:flex;justify-content:space-between;align-items:center;margin:8px 2px 4px;color:#7b6b52;font-size:11px;}'
 + '.oa-home-actions{display:flex;gap:7px;align-items:stretch;margin-top:8px;}'
 + '.oa-home-actions .sc-btn{flex:1;min-width:0;padding:10px 7px;font-size:12px;}'
 + '.oa-home-modes{display:flex;gap:8px;margin-top:8px;}'
 + '.oa-home-modes .sc-btn{flex:1;text-align:center;padding:9px 6px;font-size:12px;}'
 + '.oa-import-note{font-size:10.5px;color:#989080;line-height:1.55;margin:7px 2px 0;}'
 + '.oa-stage-cover{position:absolute;inset:0;background-position:center;background-size:cover;display:flex;align-items:center;justify-content:center;cursor:pointer;}'
 + '.oa-stage-cover:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,17,13,.08),rgba(20,17,13,.64));}'
 + '.oa-stage-cover-info{position:relative;z-index:1;text-align:center;color:#fff;padding:16px 20px;width:100%;box-sizing:border-box;text-shadow:0 2px 8px rgba(0,0,0,.55);}'
 + '.oa-stage-cover-info h2{font-size:21px;letter-spacing:1px;margin:0 0 6px;}'
 + '.oa-stage-cover-info p{font-size:11px;line-height:1.55;margin:0;color:rgba(255,255,255,.9);}'
 + '.oa-cover-change{position:absolute;z-index:2;top:9px;right:9px;border:1px solid rgba(255,255,255,.65);background:rgba(20,17,13,.36);color:#fff;border-radius:999px;padding:6px 9px;font-size:10px;}'
 + '.oa-home-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#f7ead3;padding:18px;box-sizing:border-box;}'
 + '.oa-home-empty b{font-size:18px;margin-bottom:5px;}'
 + '.oa-home-empty span{font-size:11px;line-height:1.6;color:#e3d2b6;}'
 + '.oa-play-castline{display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:8px;background:#fff;border:1px solid #ebe7e0;border-radius:12px;color:#55472f;font-size:12px;}'
 + '.oa-play-castline img{width:28px;height:28px;border-radius:9px;object-fit:cover;}'
 + '.sc-standee img.oa-character-sprite{width:100%;height:100%;object-fit:contain;object-position:center bottom;}'
 + '@media(max-width:360px){.gd-root[data-gd="script"] .gd-body{padding-left:8px;padding-right:8px;}.oa-home-actions .sc-btn{font-size:11px;padding-left:4px;padding-right:4px;}.oa-cast-actions button{font-size:10px;padding:6px;}}'
 + '</style>';

/* ── 界面状态 ── */
var view = 'reels';
var selId = (SCRIPT_BUILTINS[0] && SCRIPT_BUILTINS[0].id) || ''; // [AJ] 内置剧本已清空，无默认卷
var session = loadSession();
var detailId = null;
var playSearch = '';
var homeDeckDraw = null;
var detailPlayId = null;
var editId = null;
var editDraft = null;
var notice = '';
var charName = getCharName();
var look = getLook();
var homeWorkSel = '';

var filmStrip = function (frames, current) {
var h = '<div class="sc-film">';
frames.forEach(function (f, i) {
var cls = 'sc-frame' + (i === current? ' on': '') + (i < current? ' done': '');
h += '<div class="' + cls + '" data-act="frame" data-i="' + i + '"><span class="holes">● ● ● ●</span>' + esc(f) + '<span class="holes">● ● ● ●</span></div>';
});
return h + '</div>';
};
var machineTop = function (inner, extraClass) {
/* [GROUP-FIX9] 机器外壳：顶部是吊灯（SVG）+ 两侧转轮（CSS 辐条圆盘），底部是旋钮面板
   （三个装饰旋钮 + 机名 + 3D 开关）；[data-oa-3d] 是 3D 场景挂载点，大屏才有内容，
   画布盖在暖底上、机器面板之下，只露机器周围的环境（悬挂臂、转轮、灯晕、台面）。 */
return '<div class="sc-wrap' + (extraClass ? ' ' + extraClass : '') + '"><div class="sc-3d" data-oa-3d></div>'
+ '<div class="sc-lamprow"><span class="sc-reel" aria-hidden="true"></span><svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><path d="M17 0V6" stroke="#a07d4a" stroke-width="2"/><path d="M4 24 L17 6 L30 24 Z" fill="#c9a86a" stroke="#7a5e34" stroke-width="1"/><circle cx="17" cy="24" r="3" fill="#ffe1a0"/></svg><span class="sc-reel" aria-hidden="true"></span></div>'
+ '<div class="sc-machine"><div class="sc-screen">' + inner + '</div>'
+ '<div class="sc-console"><span class="sc-knobdot"></span><span class="sc-knobdot"></span><span class="sc-knobdot"></span><span>胶片阅读机 · FILM READER</span><button type="button" class="sc-btn ghost sc-3d-toggle" data-act="3d-toggle">' + esc(oa3dLabel()) + '</button></div></div><div class="sc-2dnote">' + esc(oa3dNote()) + '</div></div>';
};
var tabsHtml = function () {
return '<div class="sc-tabrow">'
+ '<div class="sc-tab' + (view === 'reels'? ' on': '') + '" data-act="tab" data-v="reels">胶片架</div>'
+ '<div class="sc-tab' + ((view === 'editorList' || view === 'editorForm')? ' on': '') + '" data-act="tab" data-v="editorList">自定义剧本</div>'
+ '<div class="sc-tab' + ((view === 'archive' || view === 'savedDetail')? ' on': '') + '" data-act="tab" data-v="archive">档案架</div>'
 + '<div class="sc-tab' + ((view === 'plays' || view === 'playDetail')? ' on': '') + '" data-act="tab" data-v="plays">游玩记录</div></div>';
};


/* ══════════ [GROUP-FIX9] Optical Archive 重做 · 人物选择器 / VN 入口 / 3D 场景 ══════════
   出处：Optical Archive（codedog2/undergrounder_template，MIT）——只借视觉语言
   （复古胶片阅读机：屏幕、悬挂机械臂、转轮、导轮闸、旋钮面板、吊灯全部用代码生成；
   内容数据驱动；大屏 3D、手机同风格 2D），本实现全部自写，不抄原项目内容与占位名。
   结构说明：人物选择器与视觉小说区以前是 AW 组以外挂注入 #aw-script-cast /
   #aw-script-vn 塞进 #gd-body-script 的，每次 app._refresh()（renderBody 重写
   body.innerHTML）都会把它们洗掉，要等 3 秒 tick / observer 才回来、顺序也不稳。
   本次把两者收进 renderBody 的单一渲染路径；AW 侧的两个注入函数改为只清残留
   旧节点的兼容桩（见 F9-H），boot2/boot3 的 tick 继续调它们也不会再造出第二套。
   人物只取真实角色库（AW.allArchiveChars：主角 + 微信创建人物），不预填示例人物；
   闻砚不是预设——她只能由用户自己在角色库里创建/导入，这里绝不写死任何人名。
   档案直接复用已有的 AW.openArchive（刑侦档案样式），不另造一套档案 UI。
   文游接已有入口 AppManager.launch('wenyou')；视觉小说接已有 AW.openVNPlayer /
   AW.listVNs / AW.deleteVN / AW.handleVNFile，不另起播放器。
   3D 只在大屏（min-width:900px）上用 three.js（CDN 动态加载，与 VRM 组同一做法）
   作机器周围的环境点缀，DOM 机器仍是可交互的本体；加载不到、窄屏、减动效时是 2D 基线。 */
var OA_THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
var OA_3D_KEY = 'phone_script_3d_v1';
var oaAW = function () { try { return window.AWGroup || null; } catch (e) { return null; } };
var oaRoster = function () { var AW = oaAW(); if (!AW || !AW.allArchiveChars) return []; try { var l = AW.allArchiveChars() || []; return l.filter(function (ch) { return ch && ch.name; }); } catch (e) { return []; } };
var oaIsPlaceholderMain = function (ch) { return !!(ch && ch.isMain && (!ch.name || ch.name === '机')); };
var oaRealChars = function () { return oaRoster().filter(function (ch) { return !oaIsPlaceholderMain(ch); }); };
var oaSelCharId = function (real) {
  real = real || oaRealChars();
  try { var AW = oaAW(); if (AW && AW.scriptCharId) { var id = AW.scriptCharId(); if (id) { var ok = false; real.forEach(function (ch) { if (ch.id === id) ok = true; }); if (ok) return id; } } } catch (e) {}
  return (real[0] && real[0].id) || '';
};
var OA_PORTRAIT_KEY = 'phone_script_portraits_v1';
var oaPortraitMap = function () { try { var x = JSON.parse(localStorage.getItem(OA_PORTRAIT_KEY) || '{}'); return x && typeof x === 'object' ? x : {}; } catch (e) { return {}; } };
var oaPortraitData = function (id) { if (!id) return ''; var d = oaPortraitMap()[String(id)] || ''; return /^data:image\/(png|jpeg|webp);base64,/i.test(d) ? d : ''; };
var oaSetPortrait = function (id, data) { if (!id || !/^data:image\/png;base64,/i.test(data || '')) return false; var m = oaPortraitMap(); m[String(id)] = data; try { localStorage.setItem(OA_PORTRAIT_KEY, JSON.stringify(m)); return true; } catch (e) { return false; } };
var oaCharById = function (id) { var out = null; oaRealChars().forEach(function (ch) { if (ch.id === id) out = ch; }); return out; };
var oaCastAvatarHTML = function (ch, cls) { var src = oaPortraitData(ch && ch.id); if (!src && ch && /^data:image\//i.test(ch.avatar || '')) src = ch.avatar; return '<div class="' + (cls || 'sc-cast-av') + '">' + (src ? '<img src="' + esc(src) + '" alt="' + esc(ch.name || '人物立绘') + '">' : esc((ch && ch.name || '?').charAt(0))) + '</div>'; };
var oaHomeCastHTML = function () {
  var real = oaRealChars();
  if (!real.length) return '<div class="oa-cast-hero"><div class="oa-cast-portrait">＋</div><div class="oa-cast-meta"><small>出演人物</small><b>还没有角色</b><small style="letter-spacing:0">先去角色库创建人物，再上传 PNG 立绘</small></div><div class="oa-cast-actions"><button type="button" data-act="cast-library">角色库</button><button type="button" data-act="cast-new">创建</button></div></div>';
  var id = oaSelCharId(real), ch = oaCharById(id) || real[0], src = oaPortraitData(ch.id);
  var portrait = src ? '<img src="' + esc(src) + '" alt="' + esc(ch.name) + '立绘">' : esc((ch.name || '?').charAt(0));
  var sub = ch.occupation || ch.relationship || (ch.isMain ? '主角' : '已加入角色库');
  return '<div class="oa-cast-hero" data-act="cast-dossier" data-id="' + esc(ch.id) + '" role="button" tabindex="0"><div class="oa-cast-portrait">' + portrait + '</div><div class="oa-cast-meta"><small>本卷出演 · 点击查看档案</small><b>' + esc(ch.name) + '</b><small style="letter-spacing:0">' + esc(sub) + '</small></div><div class="oa-cast-actions"><button type="button" data-act="portrait-pick">上传 PNG</button><button type="button" data-act="cast-library">角色库</button></div></div>';
};
var oaPlayCastLine = function () {
  var real = oaRealChars(), id = oaSelCharId(real), ch = oaCharById(id); if (!ch) return '';
  var src = oaPortraitData(ch.id);
  return '<div class="oa-play-castline">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<span class="oa-cast-portrait" style="width:28px;height:28px;border-radius:9px;font-size:13px">' + esc((ch.name || '?').charAt(0)) + '</span>') + '<span style="flex:1">出演：<b>' + esc(ch.name) + '</b></span><button type="button" class="sc-btn ghost" data-act="cast-dossier" style="padding:5px 9px;font-size:11px">查看档案</button></div>';
};
var oaScriptCoverKey = function (id) { return 'script:' + String(id || ''); };
var oaWorkCoverKey = function (work) { return work && work.kind === 'vn' ? String(work.id) : oaScriptCoverKey(work && work.id); };
var oaCoverBackground = function (bookId, title) { try { var B = window.BuCovers; if (B && B.frontBg) { var c = B.frontBg({ id: bookId, title: title || '' }, '#8b7655'); if (c && c.bg) return c.bg; } } catch (e) {} return 'linear-gradient(145deg,#9c7651,#433b36)'; };
var oaHomeWorks = function () {
  var out = allScripts().map(function (s) { return { key: 'script:' + s.id, kind: 'script', id: s.id, title: s.title, desc: s.desc || s.setting || '', count: (s.scenes || []).length, original: s }; });
  try { var AW = oaAW(), vns = AW && AW.listVNs ? AW.listVNs() || [] : []; vns.forEach(function (v) { out.push({ key: 'vn:' + v.id, kind: 'vn', id: v.id, title: v.title, desc: '视觉小说 · ' + ((v.scenes || []).length) + ' 个场景', count: (v.scenes || []).length, original: v }); }); } catch (e) {}
  return out;
};
var oaGetHomeWork = function (key) { var works = oaHomeWorks(), found = null; works.forEach(function (w) { if (w.key === key) found = w; }); return found; };
var oaFilmShelfHTML = function (list, selectedKey) {
  if (!list.length) return '<div class="oa-home-empty"><b>还没有剧本胶片</b><span>导入 TXT / EPUB，或新建一卷。导入的小说正文会自动整理成视觉小说草稿，并先让你审阅。</span></div>';
  return '<div class="oa-reel-shelf">' + list.map(function (s, i) {
    var cov = oaCoverBackground(oaWorkCoverKey(s), s.title), active = s.key === selectedKey;
    return '<button type="button" class="oa-reel-card' + (active ? ' on' : '') + '" data-act="sel-home-work" data-key="' + esc(s.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '"><span class="oa-reel-art" style="background:' + esc(cov) + '">' + esc(s.title || '未命名') + '</span><span class="oa-reel-label">' + (s.kind === 'vn' ? '◉ ' : '▣ ') + esc(s.title || '未命名') + '</span></button>';
  }).join('') + '</div>';
};
var oaCastHTML = function () {
  var AW = oaAW();
  if (!AW || !AW.allArchiveChars) return '<div class="sc-cast-empty">人物选择器需要角色库（微信创建人物），现在读不到角色库。</div>';
  var real = oaRealChars();
  if (!real.length) {
    return '<div class="sc-cast"><div class="sc-cast-head"><b>出演人物</b><span>还没有人物</span></div>'
      + '<div class="sc-cast-empty">还没有可以出演的人物。<br>去微信加好友创建人物，或在角色库里新建一个，ta 就会出现在这里。</div>'
      + '<div class="sc-mode-row"><button type="button" class="sc-btn warm" data-act="cast-library">打开角色库</button><button type="button" class="sc-btn ghost" data-act="cast-new">＋ 创建人物</button></div></div>';
  }
  var cur = oaSelCharId(real);
  var curCh = null; real.forEach(function (ch) { if (ch.id === cur) curCh = ch; });
  var cards = real.map(function (ch) {
    var sub = ch.isMain ? '主角' : (ch.occupation || ch.relationship || '联系人');
    return '<div class="sc-cast-card' + (ch.id === cur ? ' on' : '') + '" data-act="cast-sel" data-id="' + esc(ch.id) + '" role="button" tabindex="0">' + oaCastAvatarHTML(ch, 'sc-cast-av') + '<div class="sc-cast-name">' + esc(ch.name) + '</div><div class="sc-cast-sub">' + esc(sub) + '</div></div>';
  }).join('');
  return '<div class="sc-cast"><div class="sc-cast-head"><b>切换出演角色</b><span>横向滑动选择</span></div>'
    + '<div style="display:flex;gap:6px;align-items:stretch;"><button type="button" class="sc-cast-arrow" data-act="cast-prev" aria-label="上一个人物">‹</button><div class="sc-cast-strip">' + cards
    + '<div class="sc-cast-card" data-act="cast-new" role="button" tabindex="0"><div class="sc-cast-av" style="background:linear-gradient(155deg,#c9a86a,#8a6d3b);">＋</div><div class="sc-cast-name">创建人物</div><div class="sc-cast-sub">去角色库新建</div></div></div><button type="button" class="sc-cast-arrow" data-act="cast-next" aria-label="下一个人">›</button></div>'
    + '<div style="font-size:11px;color:#a39a8d;margin-top:3px;">点击顶部人物卡查看档案；PNG 立绘只保存在本机。</div></div>';
};
var oaVNHTML = function () {
  var AW = oaAW();
  var vns = [];
  try { if (AW && AW.listVNs) vns = AW.listVNs() || []; } catch (e) {}
  var h = '<div class="sc-card"><h3>视觉小说</h3></div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;"><button type="button" class="sc-btn warm" data-act="import-vn-open" aria-label="导入视觉小说" title="导入">＋</button><input type="file" accept=".sks,.txt,.json,.epub" style="display:none" data-oa-vn-upload></div>';
  if (!vns.length) h += '<div class="sc-card"><p>还没有视觉小说，上传一份 .txt 或 .json 剧本试试。</p></div>';
  vns.forEach(function (v) {
    h += '<div class="sc-vnrow"><div style="flex:1;min-width:0;"><b>《' + esc(v.title) + '》</b><small style="display:block;font-size:11.5px;color:#a39a8d;margin-top:2px;">' + (v.scenes || []).length + ' 个场景 · ' + (v.source === 'structured' ? '模型整理' : (v.source === 'template' ? '模板规则整理' : (v.source === 'sks' ? 'SKS 导入' : '上传'))) + ' · ' + esc(((v.characters || []).join('、')) || '无说话人') + '</small></div><button type="button" class="sc-btn warm" data-act="vn-play" data-id="' + esc(v.id) + '">▶ 玩</button><button type="button" class="sc-btn ghost" data-act="vn-audio" data-id="' + esc(v.id) + '">♪ 音频</button><button type="button" class="sc-btn ghost" data-act="vn-del" data-id="' + esc(v.id) + '">✕</button></div>';
  });
  h += '<button type="button" class="sc-btn ghost" data-act="tab" data-v="reels">‹ 返回胶片架</button>';
  return h;
};
var oa3dWide = function () { try { return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 900px)').matches; } catch (e) { return false; } };
var oa3dPref = function () { try { return window.localStorage.getItem(OA_3D_KEY) || ''; } catch (e) { return ''; } };
var oa3dSetPref = function (v) { try { window.localStorage.setItem(OA_3D_KEY, v); } catch (e) {} };
var oa3dEnabled = function () { var p = oa3dPref(); if (p === 'off') return false; return oa3dWide(); };
var oa3dLabel = function () { if (window.__oa3dFailed) return '3D 加载失败 · 2D 版'; if (!oa3dWide()) return '3D 场景（仅大屏）'; return oa3dEnabled() ? '3D 场景：开' : '3D 场景：关'; };
var oa3dNote = function () { if (window.__oa3dFailed) return '3D 加载失败，已用 2D 版（离线可用）。'; if (!oa3dWide()) return '手机 2D 简洁版 · 与桌面 3D 同风格（离线可用）。'; return oa3dEnabled() ? '桌面 3D 场景 · three.js 在线加载。' : '3D 场景已关 · 2D 版。'; };
var oaEnsure3D = function (win) {
  var host = null; try { host = (win || document).querySelector('[data-oa-3d]'); } catch (e) {}
  if (!host) return false;
  if (host.getAttribute('data-oa-3d-done')) return true;
  if (!oa3dEnabled()) return false;
  if (typeof window.THREE !== 'undefined' && window.THREE) { try { oaBuild3D(host); return true; } catch (e) { return false; } }
  if (window.__oa3dLoading) return false;
  window.__oa3dLoading = true;
  try {
    var s = document.createElement('script'); s.src = OA_THREE_URL;
    s.onload = function () { window.__oa3dLoading = false; try { var h = document.querySelector('[data-oa-3d]'); if (h) oaBuild3D(h); } catch (e) {} };
    s.onerror = function () { window.__oa3dLoading = false; window.__oa3dFailed = true; try { var h2 = document.querySelector('[data-oa-3d]'); if (h2) h2.setAttribute('data-oa-3d-done', 'fail'); } catch (e) {} try { if (window.GD && GD.scriptApp && GD.scriptApp._refresh) GD.scriptApp._refresh(); } catch (e2) {} };
    document.head.appendChild(s);
  } catch (e) { window.__oa3dLoading = false; }
  return false;
};
var oaBuild3D = function (host) {
  if (!host || host.getAttribute('data-oa-3d-done') || !window.THREE) return false;
  var T = window.THREE;
  var w = host.clientWidth || 0, hgt = host.clientHeight || 0;
  if (!w || !hgt) return false;
  var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(w, hgt); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  host.setAttribute('data-oa-3d-done', '1');
  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(42, w / hgt, 0.1, 100); cam.position.set(0, 0.4, 7.2); cam.lookAt(0, 0, 0);
  scene.add(new T.AmbientLight(0xfff2dd, 0.75));
  var lamp = new T.PointLight(0xffd9a0, 0.9, 12); lamp.position.set(0, 2.6, 2.2); scene.add(lamp);
  var wood = new T.MeshLambertMaterial({ color: 0x4a3a28 });
  var brass = new T.MeshLambertMaterial({ color: 0xc9a86a });
  var dark = new T.MeshLambertMaterial({ color: 0x2c2115 });
  var beam = new T.Mesh(new T.BoxGeometry(4.6, 0.14, 0.14), dark); beam.position.set(0, 2.5, 0); scene.add(beam);
  var rod = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.1, 10), brass); rod.position.set(0, 1.95, 0); scene.add(rod);
  var joint = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), brass); joint.position.set(0, 1.4, 0); scene.add(joint);
  var reels = [];
  [-2.6, 2.6].forEach(function (x) {
    var g = new T.Group();
    g.add(new T.Mesh(new T.TorusGeometry(0.62, 0.09, 10, 28), wood));
    for (var i = 0; i < 4; i++) { var sp = new T.Mesh(new T.BoxGeometry(1.16, 0.07, 0.07), brass); sp.rotation.z = i * Math.PI / 4; g.add(sp); }
    var hub = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.18, 12), dark); hub.rotation.x = Math.PI / 2; g.add(hub);
    g.position.set(x, 0.9, -0.4); scene.add(g); reels.push(g);
  });
  var desk = new T.Mesh(new T.BoxGeometry(7.5, 0.16, 1.2), wood); desk.position.set(0, -2.1, -0.6); scene.add(desk);
  var cone = new T.Mesh(new T.ConeGeometry(1.1, 1.6, 24, 1, true), new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.10, side: T.DoubleSide, depthWrite: false })); cone.position.set(0, 1.1, 0.3); scene.add(cone);
  var reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var tick = function () {
    if (!host.isConnected) return;
    reels.forEach(function (g) { g.rotation.z += 0.004; });
    renderer.render(scene, cam);
    if (!reduce) host._oaRaf = requestAnimationFrame(tick);
  };
  renderer.render(scene, cam);
  if (!reduce) host._oaRaf = requestAnimationFrame(tick);
  return true;
};

var coverEmoji = function (id) {
return '🎞'; // [AJ] 内置剧本已清空，封面统一用胶片图标
};
var pushLog = function (line) { if (session && line) session.log.push({ who: line.who, text: line.text});};
var startPlay = function (script) {
session = { scriptId: script.id, title: script.title, sceneIdx: 0, lineIdx: 0, affection: 20, log: [], moments: [], startedAt: Date.now(), ended: null, showingReply: null, exitConfirm: false, round: 1, roundPhase: 'dm', roundLog: [], hiddenThreads: [], randomEvents: [], goalMet: null, goalJudged: false, vote: null, youAction: null, deckDraw: null, playId: uid() };
pushLog({ who: 'narr', text: aeRoundDm(script, script.scenes[0], 1, getCharName()) });
persistSession(session); view = 'play'; notice = '';
maybeTriggerHidden(script);
persistSession(session);
};
var nextScene = function () {
var sc = findScript(session.scriptId); if (!sc) return;
ensureRoundFields();
if (session.sceneIdx < sc.scenes.length - 1) {
session.sceneIdx++; session.lineIdx = 0; session.showingReply = null;
session.round = (session.round || 1) + 1; session.roundPhase = 'dm'; session.youAction = null; session.deckDraw = null;
pushLog(sc.scenes[session.sceneIdx].lines[0]);
maybeTriggerHidden(sc);
} else {
session.ended = computeEnding(sc, session.affection);
view = 'ending';
}
persistSession(session);
};
var advance = function () {
if (!session || session.ended) return;
ensureRoundFields();
var sc = findScript(session.scriptId); if (!sc) return;
var scene = sc.scenes[session.sceneIdx];
if (session.roundPhase === 'dm') { session.roundPhase = 'char'; session.log.push({ who: 'char', text: aeCharAction(scene) }); }
else if (session.roundPhase === 'char') { session.roundPhase = 'you'; }
else if (session.roundPhase === 'you') {
if (scene.choice) return;
session.youAction = '静观其变，继续向前';
session.log.push({ who: 'you', text: session.youAction });
finishRoundSummary(sc, scene);
return;
}
else if (session.roundPhase === 'summary') { nextScene(); return; }
persistSession(session);
};
var choose = function (idx) {
if (!session || session.ended) return;
ensureRoundFields();
if (session.roundPhase !== 'you') return;
var sc = findScript(session.scriptId); if (!sc) return;
var scene = sc.scenes[session.sceneIdx];
if (!scene.choice) return;
var opt = scene.choice.options[idx]; if (!opt) return;
session.affection = aeClamp(session.affection + (opt.affection || 0));
session.log.push({ who: 'you', text: opt.text});
session.youAction = opt.text;
if (opt.affection > 0) session.moments.push('在「' + scene.title + '」选择了' + opt.text);
if (opt.reply) { session.log.push({ who: 'char', text: opt.reply});}
finishRoundSummary(sc, scene);
                // [AG组] 接模型 · 剧本 DM：选项的剧本台词不变；配好并打开时，模型再补一句 DM 旁白（不改好感、不改结局）；失败则只记回落，剧本照常放映
                try { if (window.PhoneModel && window.PhoneModel.dmLineForScript) window.PhoneModel.dmLineForScript({ title: sc.title, setting: sc.setting, scene: scene.title, choice: opt.text, reply: opt.reply, charName: charName }, function (line) { if (!session) return; if (line) { session.log.push({ who: 'narr', text: line }); try { persistSession(session); } catch (e) {} } try { if (typeof app !== 'undefined' && app._refresh) app._refresh(); } catch (e) {} }); } catch (e) {}
persistSession(session);
};
var saveCurrent = function (finished) {
if (!session) return;
var sc = findScript(session.scriptId); if (!sc) return;
ensureRoundFields();
var ending = session.ended || computeEnding(sc, session.affection);
var keyFacts = aeKeyFacts(sc, ending, session.affection, getCharName(), session.moments);
var archiveSummary = aeArchiveSummary(sc, ending, session.affection, session.log, session.roundLog);
var mem = saveKeyFactsRecord(sc, ending, session.affection, keyFacts, archiveSummary, todayStr2(), !!finished);
logEvent('script_end', getCharName(), '演完《' + sc.title + '》：' + ending.label + '（好感 ' + session.affection + '/100）', { kind: 'end', scriptId: sc.id, ending: ending.label });
recordPlay({ id: session.playId || uid(), scriptId: sc.id, scriptTitle: sc.title, date: todayStr2(), startedAt: session.startedAt || Date.now(), endedAt: Date.now(), finished: !!finished, choices: (session.log || []).filter(function (l) { return l.who === 'you'; }).map(function (l) { return l.text; }), hiddenThreads: session.hiddenThreads || [], randomEvents: session.randomEvents || [], ending: ending.label, affection: session.affection, goalMet: session.goalMet, goalJudged: !!session.goalJudged, vote: session.vote || null, rounds: (session.roundLog || []).length, roundLog: session.roundLog || [] });
logEvent('script_save', getCharName(), '保存记忆《' + sc.title + ' · ' + ending.label + '》：关键事实进归巢，其余折叠为档案摘要', { kind: 'save', scriptId: sc.id, memoryId: mem.id });
clearSession(); session = null; view = 'archive';
notice = '已归档 ✓ 关键事实（主角、地点、结局、好感）写进了归巢的「关系记忆」；其余情节折叠成摘要，存在档案架里；这场游玩也记进了「游玩记录」。';
};
var discardCurrent = function () {
clearSession(); session = null; view = 'reels';
notice = '胶片已作废，没有留下任何记录。归巢和档案架里都没有这段。';
};
var readDraftFromForm = function (win) {
if (!editDraft) return;
var v = function (id) { var el = win.querySelector('#' + id); return el? el.value: '';};
editDraft.title = v('sc-ed-title'); editDraft.desc = v('sc-ed-desc'); editDraft.setting = v('sc-ed-setting');
editDraft.hiddenThreadText = v('sc-ed-hidden-text'); editDraft.hiddenThreadNode = v('sc-ed-hidden-node'); editDraft.charGoal = v('sc-ed-goal'); editDraft.charGoalDone = v('sc-ed-goal-done'); editDraft.charGoalFail = v('sc-ed-goal-fail');
editDraft.endGood = v('sc-ed-end-good'); editDraft.endNormal = v('sc-ed-end-normal');
editDraft.scenes.forEach(function (s, i) {
s.title = v('sc-ed-sc-title-' + i); s.linesText = v('sc-ed-sc-lines-' + i);
s.choicePrompt = v('sc-ed-sc-prompt-' + i); s.optionsText = v('sc-ed-sc-opts-' + i);
});
};
var draftToScript = function (d) {
var bgs = ['cafe', 'dusk', 'rain', 'bookstore', 'festival', 'snow'];
return {
id: d.id, title: String(d.title || '').trim(), desc: String(d.desc || '').trim(), setting: String(d.setting || '').trim(),
hiddenThread: (String(d.hiddenThreadText || '').trim() ? { node: Math.max(0, Math.min(9, (parseInt(d.hiddenThreadNode || '1', 10) || 1) - 1)), text: String(d.hiddenThreadText).trim() } : null),
charGoal: (String(d.charGoal || '').trim() ? { goal: String(d.charGoal).trim(), doneBranch: String(d.charGoalDone || '').trim(), failBranch: String(d.charGoalFail || '').trim() } : null),
scenes: d.scenes.map(function (s, i) {
var opts = parseOptions(s.optionsText);
return { id: 'c' + i, title: String(s.title || '').trim() || ('第' + (i + 1) + '幕'), bg: bgs[i % bgs.length],
lines: parseLines(s.linesText),
choice: (String(s.choicePrompt || '').trim() && opts.length)? { prompt: String(s.choicePrompt).trim(), options: opts.slice(0, 3)}: null};
}),
endings: [
{ min: 60, label: '好结局', text: String(d.endGood || '').trim() || '你们走到了最好的结局。'},
{ min: 35, label: '普通结局', text: String(d.endNormal || '').trim() || '这段支线平静地结束了。'},
{ min: 0, label: '遗憾结局', text: '这段支线没有走到最好的结局。'}
]
};
};
var blankDraft = function () {
return { id: uid(), title: '', desc: '', setting: '', endGood: '', endNormal: '', hiddenThreadText: '', hiddenThreadNode: '', charGoal: '', charGoalDone: '', charGoalFail: '',
scenes: [
{ title: '第一幕', linesText: '旁白：故事从这里开始。\n' + charName + '：你好。', choicePrompt: '', optionsText: ''},
{ title: '第二幕', linesText: '旁白：然后……', choicePrompt: '你想……', optionsText: '答应他 | 好感+15 | 「太好了。」\n再想想 | 好感+0 | 「没关系，慢慢来。」'}
]};
};
var scriptToDraft = function (sc) {
var whoName = function (w) { return w === 'you'? '你': (w === 'narr'? '旁白': charName);};
return { id: sc.id, title: sc.title, desc: sc.desc || '', setting: sc.setting || '', hiddenThreadText: (sc.hiddenThread && sc.hiddenThread.text) || '', hiddenThreadNode: String(((sc.hiddenThread && sc.hiddenThread.node) || 0) + 1), charGoal: (sc.charGoal && sc.charGoal.goal) || '', charGoalDone: (sc.charGoal && sc.charGoal.doneBranch) || '', charGoalFail: (sc.charGoal && sc.charGoal.failBranch) || '',
endGood: (sc.endings[0] && sc.endings[0].text) || '', endNormal: (sc.endings[1] && sc.endings[1].text) || '',
scenes: sc.scenes.map(function (s) {
return { title: s.title,
linesText: s.lines.map(function (l) { return whoName(l.who) + '：' + l.text;}).join('\n'),
choicePrompt: s.choice? s.choice.prompt: '',
optionsText: s.choice? s.choice.options.map(function (o) { return o.text + ' | 好感' + (o.affection >= 0? '+': '') + o.affection + ' | ' + (o.reply || '');}).join('\n'): ''};
})};
};

var renderBody = function () {
charName = getCharName(); look = getLook();
if (!session) session = loadSession();
var h = SC_CSS;
if (notice) h += '<div class="sc-notice">' + esc(notice) + '</div>';
if (view === 'play' && session) {
var sc = findScript(session.scriptId);
if (!sc) { session = null; view = 'reels'; return renderBody();}
var scene = sc.scenes[session.sceneIdx];
var atEnd = session.lineIdx >= scene.lines.length;
ensureRoundFields();
maybeTriggerHidden(sc);
var phase = session.roundPhase || 'dm';
var dmText = aeRoundDm(sc, scene, session.round || 1, charName);
var charAct = aeCharAction(scene);
var cur = null;
if (phase === 'dm') cur = { who: 'narr', text: dmText };
else if (phase === 'char') cur = { who: 'char', text: charAct };
else if (phase === 'you') cur = scene.choice ? { who: 'narr', text: scene.choice.prompt } : { who: 'narr', text: '这一轮没有选项——由你决定怎么继续，转动转轮默认“静观其变”。' };
else cur = { who: 'narr', text: ((session.roundLog[session.roundLog.length - 1] || {}).summary || '本轮汇总生成中……') };
var whoLabel =!cur? '旁白': (cur.who === 'char'? charName: (cur.who === 'you'? '你': '旁白'));
var _oaSpriteSrc = oaPortraitData(oaSelCharId(oaRealChars()));
var stageInner = '<div class="sc-stage" style="background:' + (SCENE_BG[scene.bg] || SCENE_BG.cafe) + ';">'
+ '<div class="sc-scene-tag">' + esc(scene.title) + ' · 第' + (session.round || 1) + '轮 · ' + (AE_PHASE_NAMES[phase] || '') + '</div>'
+ '<div class="sc-aff">♥ 好感 ' + session.affection + '</div>'
+ '<div class="sc-standee">' + (_oaSpriteSrc ? '<img class="oa-character-sprite" src="' + esc(_oaSpriteSrc) + '" alt="' + esc(charName) + '立绘">' : charSvg(look, session.affection)) + '</div>'
+ '<div class="sc-dialog"><div class="sc-who">' + esc(whoLabel) + '</div>'
+ '<p class="sc-line">' + (cur? esc(cur.text): (atEnd && scene.choice? esc(scene.choice.prompt): '（本幕结束，转动转轮到下一幕）')) + '</p></div></div>';
h += oaPlayCastLine();
h += machineTop(stageInner);
h += (window.PhoneModel ? window.PhoneModel.statusLineHTML('scriptDm') : '');
h += filmStrip(sc.scenes.map(function (s) { return s.title;}), session.sceneIdx);
h += aePhaseCards(sc, scene);
if (session.exitConfirm) {
h += '<div class="sc-card"><h3>退出放映？</h3><p>这卷胶片还没放完。可以先把它归档成记忆，也可以直接作废。</p>'
+ '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn warm" data-act="exit-save">保存这段记忆</button>'
+ '<button class="sc-btn danger" data-act="exit-discard">放弃并作废</button>'
+ '<button class="sc-btn ghost" data-act="exit-cancel">继续放映</button></div></div>';
} else if (phase === 'you' && scene.choice) {
scene.choice.options.forEach(function (o, i) {
h += '<button class="sc-opt" data-act="choose" data-i="' + i + '">' + esc(o.text) + '<span class="aff">好感 ' + (o.affection >= 0? '+': '') + o.affection + '</span></button>';
});
h += '<div class="sc-controls"><button class="sc-wheel" disabled>⟳</button><div class="sc-ctl-note">转轮暂停——先选一句回答（你的行动），再汇总成叙述。</div>'
 + '<button class="sc-btn ghost" data-act="exit-play">退出放映</button></div>';
} else {
var _phNote = phase === 'dm' ? 'DM开场：先看设定，再转轮进入 char 的行动' : (phase === 'char' ? 'char 的行动：转轮进入你的行动' : (phase === 'summary' ? '回合汇总已生成：转轮进入下一轮' : '转轮推进：没有选项时默认“静观其变”'));
h += '<div class="sc-controls"><button class="sc-wheel" data-act="next" title="转动转轮，推进回合">⟳</button>'
 + '<div class="sc-ctl-note">' + _phNote + '<br>好感实时显示在屏幕右上角</div>'
 + '<button class="sc-btn ghost" data-act="exit-play">退出放映</button></div>';
}
h += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn ghost" data-act="deck-draw" data-kind="question">🎲 抽个怪问题</button><button class="sc-btn ghost" data-act="deck-draw" data-kind="scene">🃏 抽张场景卡</button></div>';
if (session.deckDraw) h += '<div class="sc-glass" style="margin-top:10px;"><div style="font-size:13px;line-height:1.65;color:#2b2a28;">' + esc(session.deckDraw.text) + '</div><div style="font-size:11px;color:#8a6d3b;margin-top:4px;">预置题库，非 AI 生成 · 抽到什么就聊什么，不强制演进剧情</div></div>';
return h;
}
if (view === 'ending' && session) {
var sc2 = findScript(session.scriptId);
var ending = session.ended || (sc2? computeEnding(sc2, session.affection): { label: '结局', text: ''});
var endInner = '<div class="sc-stage" style="background:' + SCENE_BG.dusk + ';">'
+ '<div class="sc-screen-title"><div class="sc-cover-emoji">🎞</div><h2>' + esc(ending.label) + '</h2>'
+ '<p>' + esc(ending.text || '') + '</p><p style="margin-top:10px;">♥ 好感 ' + session.affection + ' / 100 · ' + esc(session.title || '') + '</p></div></div>';
h += machineTop(endInner);
h += '<div class="sc-card"><h3>这卷胶片放完了</h3><p>选「保存记忆」，这段支线就归档进记忆：关键事实写进归巢的「关系记忆」，其余情节折叠成摘要存在档案架里，档案架上也会多一盒胶片。选「放弃记忆」，胶片直接作废，不留任何记录。</p>'
 + aeEndingExtra(sc2, ending)
+ '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn warm" data-act="save-memory">📥 保存记忆</button>'
+ '<button class="sc-btn danger" data-act="discard-memory">🗑 放弃记忆</button></div></div>';
return h;
}
if (view !== 'reels') h += tabsHtml();
if (view === 'vn') {
h += oaVNHTML(); /* [GROUP-FIX9] 视觉小说视图：接已有 AW.openVNPlayer，不另起播放器 */
return h;
}
if (view === 'editorList') {
var customs = loadArr(CUSTOM_KEY);
h += '<button class="sc-btn" data-act="new-custom" style="width:100%;margin-bottom:12px;">＋ 新建自定义剧本</button>';
h += '<div class="sc-notice">自定义剧本存在本机（标题 / 背景设定 / 场景 / 台词 / 选项 / 结局），改剧本不用碰代码。</div>';
if (!customs.length) h += '<div class="sc-card"><p>还没有自定义剧本。点上面「新建」，写一卷属于你自己的胶片。</p></div>';
customs.forEach(function (c) {
h += '<div class="sc-card"><h3>🎞 ' + esc(c.title) + '</h3><p>' + esc(c.desc || c.setting || '') + '</p>'
+ '<div class="meta">' + c.scenes.length + ' 幕 · ' + (c.endings || []).length + ' 个结局</div>'
+ '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn warm" data-act="play-custom" data-id="' + esc(c.id) + '">▶ 放映</button>'
+ '<button class="sc-btn ghost" data-act="edit-custom" data-id="' + esc(c.id) + '">编辑</button>'
+ '<button class="sc-btn danger" data-act="del-custom" data-id="' + esc(c.id) + '">删除</button></div></div>';
});
return h;
}
if (view === 'editorForm' && editDraft) {
h += '<div class="sc-card"><h3>' + (loadArr(CUSTOM_KEY).some(function (c) { return c.id === editDraft.id;})? '编辑自定义剧本': '新建自定义剧本') + '</h3>'
+ '<p>台词每行一句，格式「' + esc(charName) + '：台词」「你：台词」「旁白：台词」。选项每行一个，格式「选项文本 | 好感+10 | 对方回复」。好感 60+ 是好结局，35+ 是普通结局，其余是遗憾结局。</p></div>';
h += '<div class="sc-field"><label>标题</label><input id="sc-ed-title" value="' + esc(editDraft.title) + '" placeholder="例如：雨夜便利店"></div>';
h += '<div class="sc-field"><label>一句话简介</label><input id="sc-ed-desc" value="' + esc(editDraft.desc) + '" placeholder="这卷胶片讲什么？"></div>';
h += '<div class="sc-field"><label>背景设定</label><textarea id="sc-ed-setting" placeholder="时间、地点、人物关系……">' + esc(editDraft.setting) + '</textarea></div>';
h += '<div class="sc-field"><label>暗线提示（可选：在指定幕出现一次的隐藏线索）</label><input id="sc-ed-hidden-text" value="' + esc(editDraft.hiddenThreadText || '') + '" placeholder="例如：吧台的老板娘多看了他一眼……"></div>';
h += '<div class="sc-field"><label>暗线触发幕（第几幕，数字）</label><input id="sc-ed-hidden-node" value="' + esc(editDraft.hiddenThreadNode || '') + '" placeholder="例如：2"></div>';
h += '<div class="sc-field"><label>char 的小目标（可选）</label><input id="sc-ed-goal" value="' + esc(editDraft.charGoal || '') + '" placeholder="例如：哄好闹别扭的猫"></div>';
h += '<div class="sc-field"><label>小目标达成时他会说（可选）</label><input id="sc-ed-goal-done" value="' + esc(editDraft.charGoalDone || '') + '" placeholder="留空用默认文案"></div>';
h += '<div class="sc-field"><label>小目标没达成时他会说（可选）</label><input id="sc-ed-goal-fail" value="' + esc(editDraft.charGoalFail || '') + '" placeholder="留空用默认文案"></div>';
editDraft.scenes.forEach(function (s, i) {
h += '<div class="sc-card"><h3>第' + (i + 1) + '幕</h3>'
+ '<div class="sc-field"><label>幕名</label><input id="sc-ed-sc-title-' + i + '" value="' + esc(s.title) + '"></div>'
+ '<div class="sc-field"><label>台词（每行一句）</label><textarea id="sc-ed-sc-lines-' + i + '" style="min-height:110px;">' + esc(s.linesText) + '</textarea></div>'
+ '<div class="sc-field"><label>本幕选项的问题（留空 = 纯剧情，无选项）</label><input id="sc-ed-sc-prompt-' + i + '" value="' + esc(s.choicePrompt) + '" placeholder="例如：你想说什么？"></div>'
+ '<div class="sc-field"><label>选项（每行一个：文本 | 好感变化 | 对方回复）</label><textarea id="sc-ed-sc-opts-' + i + '">' + esc(s.optionsText) + '</textarea></div>'
+ (editDraft.scenes.length > 1? '<button class="sc-btn danger" data-act="ed-del-scene" data-i="' + i + '">删掉这一幕</button>': '') + '</div>';
});
h += '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="sc-btn ghost" data-act="ed-add-scene">＋ 加一幕</button></div>';
h += '<div class="sc-field" style="margin-top:12px;"><label>好结局文本（好感 60+）</label><textarea id="sc-ed-end-good">' + esc(editDraft.endGood) + '</textarea></div>';
h += '<div class="sc-field"><label>普通结局文本（好感 35+）</label><textarea id="sc-ed-end-normal">' + esc(editDraft.endNormal) + '</textarea></div>';
h += '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="sc-btn warm" data-act="ed-save">保存剧本</button>'
+ '<button class="sc-btn ghost" data-act="ed-cancel">取消</button></div>';
return h;
}
if (view === 'plays') {
var _plays = aeSearchPlays(loadPlays(), playSearch);
var _ach = loadAch();
var _zTxt = '';
try { if (typeof window !== 'undefined' && window.GroupZ && window.GroupZ.voteLoad) { var _zd = window.GroupZ.voteLoad(); var _za = (_zd.achievements || []).map(function (a) { return a.label; }).join('、'); _zTxt = ' · Z 组投票 ' + ((_zd.endingVotes || []).length) + ' 票' + (_za ? '（徽章：' + _za + '）' : '') + '，成就口径以 Z 组 otome_vote_v1 为准'; } } catch (e) {}
h += '<div class="sc-card"><h3>🏆 成就（剧本）</h3><p>演完 ' + (_ach.counts.plays || 0) + ' 场 · 投票 ' + (_ach.counts.votes || 0) + ' 部剧本（AE 镜像，每部首次投票计 1 分） · 小目标达成 ' + (_ach.counts.goalsMet || 0) + ' 次 · 发现暗线 ' + (_ach.counts.hiddenFound || 0) + ' 条' + _zTxt + '。</p></div>';
h += '<div class="sc-field"><label>搜索游玩记录（剧本名 / 结局 / 选择 / 暗线 / 随机事件）</label><input id="sc-plays-q" value="' + esc(playSearch) + '" placeholder="例如：雨夜咖啡馆 / 好结局 / 金鱼"></div>';
h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"><button class="sc-btn" data-act="plays-search">🔍 搜索</button><button class="sc-btn ghost" data-act="plays-export">⬇ 导出 JSONL</button></div>';
if (!_plays.length) h += '<div class="sc-card"><p>' + (playSearch ? '没有找到包含「' + esc(playSearch) + '」的游玩记录。' : '还没有游玩记录。演完一卷胶片并选「保存记忆」，记录就会出现在这里。') + '</p></div>';
_plays.forEach(function (p) {
h += '<div class="sc-can" data-act="open-play" data-id="' + esc(p.id) + '"><div class="t">🎞 ' + esc(p.scriptTitle) + ' · ' + esc(p.ending || '') + '</div><div class="m">' + esc(p.date || '') + ' · 好感 ' + (p.affection == null ? '—' : p.affection) + ' / 100 · ' + (p.rounds || 0) + ' 轮' + (p.finished ? '' : ' · 未演完') + '<br>' + esc((p.choices || []).slice(0, 2).join(' / ') || '没有留下选择记录') + '</div></div>';
});
return h;
}
if (view === 'playDetail' && detailPlayId) {
var _pl = null; loadPlays().forEach(function (p) { if (p.id === detailPlayId) _pl = p; });
if (!_pl) { view = 'plays'; return renderBody(); }
h += '<div class="sc-card"><h3>🎞 ' + esc(_pl.scriptTitle) + ' · ' + esc(_pl.ending || '') + '</h3><p>' + esc(_pl.date || '') + ' · 好感 ' + (_pl.affection == null ? '—' : _pl.affection) + ' / 100 · ' + (_pl.rounds || 0) + ' 轮' + (_pl.finished ? ' · 已演完' : ' · 未演完') + '</p>';
if (_pl.vote) h += '<p>🗳 最喜欢的结局：' + esc(_pl.vote) + '（已计入成就）</p>';
if (_pl.goalJudged) h += '<p>🎯 小目标评判：' + (_pl.goalMet ? '达成 ✓' : '未达成') + '</p>';
h += '<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#8a6d3b;">你的选择</div>' + ((_pl.choices || []).length ? _pl.choices.map(function (c) { return '<p>· ' + esc(c) + '</p>'; }).join('') : '<p>没有留下选择记录。</p>') + '</div>';
h += '<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#8a6d3b;">暗线与随机事件（复盘）</div>' + ((_pl.hiddenThreads || []).map(function (x) { return '<p>🔦 第' + (x.node + 1) + '幕：' + esc(x.text) + '</p>'; }).join('') || '<p>本场没有触发暗线。</p>') + ((_pl.randomEvents || []).map(function (x) { return '<p>🎲 第' + x.round + '轮：' + esc(x.text) + '</p>'; }).join('') || '<p>本场没有随机事件。</p>') + '</div>';
if ((_pl.roundLog || []).length) { h += '<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#8a6d3b;">回合叙述</div>' + _pl.roundLog.map(function (r) { return '<p>第' + r.round + '轮 · ' + esc(r.sceneTitle || '') + '：' + esc(r.summary || '') + '</p>'; }).join('') + '</div>'; }
h += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn ghost" data-act="tab" data-v="plays">返回游玩记录</button><button class="sc-btn danger" data-act="del-play" data-id="' + esc(_pl.id) + '">删除这场记录</button></div></div>';
return h;
}
if (view === 'archive' || view === 'savedDetail') {
var refs = loadArr(SAVED_KEY);
if (view === 'savedDetail' && detailId) {
var ref = null; refs.forEach(function (r) { if (r.id === detailId) ref = r;});
var mem = null; loadArr(GC_KEY).forEach(function (m) { if (m.id === detailId) mem = m;});
if (!ref &&!mem) { view = 'archive'; return renderBody();}
h += '<div class="sc-card"><h3>' + esc((mem && mem.title) || (ref && ('' + ref.scriptTitle + ' · ' + ref.ending)) || '已保存的记忆') + '</h3>'
+ '<p style="white-space:pre-wrap;">' + esc((mem && mem.content) || (ref && ref.summary) || '') + '</p>'
+ '<div class="meta">' + (ref? esc(ref.date) + ' · 好感 ' + ref.affection + ' / 100': '') + (mem? '': '（归巢里找不到这条全文，可能已在归巢里删掉）') + '</div>'
 + ((ref && ref.archiveSummary) ? '<div class="sc-glass" style="margin-top:10px;"><div style="font-size:12px;font-weight:700;color:#8a6d3b;margin-bottom:4px;">📜 折叠摘要（只存在剧本档案里，不进归巢）</div><p style="white-space:pre-wrap;">' + esc(ref.archiveSummary) + '</p></div>' : '')
 + ((ref && ref.keyFacts && ref.keyFacts.length) ? '<div style="font-size:12px;color:#8a6d3b;margin-top:8px;">关键事实：' + esc(ref.keyFacts.join('；')) + '</div>' : '')
+ '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="sc-btn ghost" data-act="tab" data-v="archive">返回档案架</button>'
+ '<button class="sc-btn danger" data-act="del-saved" data-id="' + esc(detailId) + '">删除这条记忆</button></div></div>';
return h;
}
h += '<div class="sc-notice">档案架就是记忆库：每一盒胶片，都是演完后你选择「保存记忆」的那段支线。点一盒看全文；删除时，归巢里对应的那条记忆也会一起删掉，只删这一条。</div>';
if (!refs.length) h += '<div class="sc-card"><p>档案架还是空的。去放映一卷胶片，演完选「保存记忆」，它就会出现在这里。</p></div>';
refs.forEach(function (r) {
h += '<div class="sc-can" data-act="open-saved" data-id="' + esc(r.id) + '"><div class="t">🎞 ' + esc(r.scriptTitle) + ' · ' + esc(r.ending) + '</div>'
+ '<div class="m">' + esc(r.date) + ' · 好感 ' + r.affection + ' / 100<br>' + esc(r.summary || '') + '</div></div>';
});
return h;
}
/* 默认：胶片架（阅读机主界面） */
var works = oaHomeWorks();
var selected = null;
works.forEach(function (w) { if (w.key === homeWorkSel) selected = w; });
if (!selected) { works.forEach(function (w) { if (!selected && w.kind === 'script' && w.id === selId) selected = w; }); }
if (!selected && works.length) selected = works[0];
homeWorkSel = selected ? selected.key : '';
if (selected && selected.kind === 'script') selId = selected.id;
h += oaHomeCastHTML();
/* 首页主角卡已经能打开档案；仅在有多位人物时显示横向切换条，避免重复占用首屏。 */
if (oaRealChars().length > 1) h += oaCastHTML();
h += tabsHtml();
var coverMeta = selected ? (selected.kind === 'vn' ? '视觉小说 · ' + selected.count + ' 个场景' : selected.count + ' 幕 · ' + ((selected.original.endings || []).length) + ' 个结局') : '';
var coverInner = selected
  ? '<div class="sc-stage"><div class="oa-stage-cover" data-act="cover-change-home" role="button" tabindex="0" aria-label="更换封面" style="background:' + esc(oaCoverBackground(oaWorkCoverKey(selected), selected.title)) + '"><div class="oa-stage-cover-info"><h2>' + esc(selected.title) + '</h2><p>' + esc(selected.desc || '把故事放进胶片，开始一场互动演绎。') + '</p><p style="margin-top:6px">' + esc(coverMeta) + ' · 出演 ' + esc(charName) + '</p></div></div></div>'
  : '<div class="sc-stage"><div class="oa-home-empty"><b>胶片架还空着</b><span>导入 TXT / EPUB，或新建一卷故事。没有可用模型时会用模板整理，并明确标注。</span></div></div>';
h += machineTop(coverInner, 'oa-home-machine');
h += '<div class="oa-home-caption"><span>胶片架</span><span>' + (selected ? (selected.kind === 'vn' ? '视觉小说' : '互动剧本') + ' · ' + (works.indexOf(selected) + 1) + ' / ' + works.length : '导入或新建你的第一卷') + '</span></div>';
h += oaFilmShelfHTML(works, homeWorkSel);
h += '<div class="oa-home-actions"><button class="sc-btn warm" data-act="play-home-sel"' + (selected ? '' : ' disabled') + '>▶ 开始放映</button>'
+ '<button class="sc-btn ghost" data-act="import-vn-open" aria-label="导入" title="导入">＋</button></div>';
h += '<input type="file" accept=".sks,.txt,.json,.epub" style="display:none" data-oa-vn-upload>';
h += '<input type="file" accept="image/png" style="display:none" data-oa-portrait-input>';
h += '<div class="oa-home-modes"><button class="sc-btn warm" data-act="mode-wenyou">文游</button><button class="sc-btn ghost" data-act="mode-vn">视觉小说</button></div>';
if (!works.length) h += '<button class="sc-btn ghost" data-act="new-custom" style="width:100%;margin-top:8px;">✎ 新建自定义互动剧本</button>';
if (session &&!session.ended) {
h += '<div class="sc-card"><h3>放映进行中</h3><p>《' + esc(session.title) + '》第 ' + (session.sceneIdx + 1) + ' 幕 · 好感 ' + session.affection + '</p>'
+ '<div style="display:flex;gap:8px;margin-top:10px;"><button class="sc-btn warm" data-act="resume-play">继续放映</button>'
+ '<button class="sc-btn danger" data-act="discard-memory">放弃这卷</button></div></div>';
}
return h;
};
var bindBody = function (win) {
var cycleReel = function (dir) {
var all = allScripts(); if (!all.length) return;
var i = all.indexOf(findScript(selId)); if (i < 0) i = 0;
i = (i + dir + all.length) % all.length; selId = all[i].id; notice = ''; app._refresh();
};
var openHomeCoverChooser = function (work) {
if (!work) return;
try { var _caw = oaAW(); if (_caw && _caw.openScriptCoverChooser) _caw.openScriptCoverChooser(oaWorkCoverKey(work), work.title, function () { app._refresh(); }); }
catch (e) { notice = '封面组件暂不可用，请稍后再试。'; app._refresh(); }
};
win.querySelectorAll('[data-act]').forEach(function (btn) {
btn.onclick = function (ev) {
if (ev) ev.stopPropagation();
var act = btn.getAttribute('data-act');
var id = btn.getAttribute('data-id');
var idx = parseInt(btn.getAttribute('data-i') || '0', 10);
if (act === 'tab') { view = btn.getAttribute('data-v'); detailId = null; notice = ''; app._refresh();}
else if (act === 'sel-home-work') { var _key = btn.getAttribute('data-key') || ''; var _hw = oaGetHomeWork(_key); if (_key === homeWorkSel) openHomeCoverChooser(_hw); else { homeWorkSel = _key; if (_hw && _hw.kind === 'script') selId = _hw.id; notice = ''; app._refresh(); } }
else if (act === 'play-home-sel') { var _pw = oaGetHomeWork(homeWorkSel); if (_pw && _pw.kind === 'vn') { try { var _paw = oaAW(); if (_paw && _paw.openVNPlayer) _paw.openVNPlayer(_pw.id); } catch (e) {} } else if (_pw) { var _psc = findScript(_pw.id); if (_psc) startPlay(_psc); app._refresh(); } }
else if (act === 'cover-change-home') { openHomeCoverChooser(oaGetHomeWork(homeWorkSel)); }
else if (act === 'import-vn-open') { try { var _fi = win.querySelector('[data-oa-vn-upload]'); if (_fi) _fi.click(); } catch (e) {} }
else if (act === 'cast-sel') { try { var AW9a = oaAW(); if (AW9a && AW9a.setScriptChar) AW9a.setScriptChar(id); } catch (e) {} notice = ''; app._refresh();}
else if (act === 'cast-prev' || act === 'cast-next') { try { var AW9b = oaAW(); var _real = oaRealChars(); if (_real.length) { var _cur = oaSelCharId(_real); var _i = 0; _real.forEach(function (ch, j) { if (ch.id === _cur) _i = j; }); _i = (_i + (act === 'cast-next' ? 1 : -1) + _real.length) % _real.length; if (AW9b && AW9b.setScriptChar) AW9b.setScriptChar(_real[_i].id); } } catch (e) {} app._refresh(); try { var _card = win.querySelector('.sc-cast-card.on'); if (_card && _card.scrollIntoView) _card.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}}
else if (act === 'cast-dossier') { try { var AW9c = oaAW(); var _rid = id || oaSelCharId(oaRealChars()); if (AW9c && AW9c.openArchive && _rid) AW9c.openArchive(_rid, null, { scope: 'script' }); } catch (e) {}}
else if (act === 'portrait-pick') { try { var _hero = btn.closest('.oa-cast-hero'); var _pid = _hero && _hero.getAttribute('data-id') || oaSelCharId(oaRealChars()); var _pi = win.querySelector('[data-oa-portrait-input]'); if (_pi && _pid) { _pi.dataset.charId = _pid; _pi.click(); } } catch (e) {}}
else if (act === 'cast-library') { try { var AW9d = oaAW(); if (AW9d && AW9d.openCharLibrary) AW9d.openCharLibrary(); } catch (e) {}}
else if (act === 'cast-new') { try { var AW9e = oaAW(); if (AW9e && AW9e.openCreateChar) AW9e.openCreateChar(); else if (AW9e && AW9e.openCharLibrary) AW9e.openCharLibrary(); } catch (e) {}}
else if (act === 'mode-wenyou') { try { if (typeof AppManager !== 'undefined' && AppManager.launch) AppManager.launch('wenyou'); } catch (e) {}}
else if (act === 'mode-vn') { view = 'vn'; notice = ''; app._refresh();}
else if (act === 'vn-play') { try { var AW9f = oaAW(); if (AW9f && AW9f.openVNPlayer) AW9f.openVNPlayer(id); } catch (e) {}}
else if (act === 'vn-del') { try { var AW9g = oaAW(); if (AW9g && AW9g.deleteVN) AW9g.deleteVN(id); } catch (e) {} notice = '已删除这部视觉小说。'; app._refresh();}
else if (act === 'vn-audio') { try { var _vn = null; try { var AW9a2 = oaAW(); if (AW9a2 && AW9a2.getVN) _vn = AW9a2.getVN(id); } catch (e) {} if (window.XWLAudio) window.XWLAudio.openPanel(id, _vn ? '《' + _vn.title + '》的音频' : '作品音频'); } catch (e) {}}
else if (act === '3d-toggle') { try { if (!oa3dWide()) { notice = '3D 场景只在大屏（宽屏）上开启，手机用 2D 版。'; } else { oa3dSetPref(oa3dPref() === 'on' ? 'off' : 'on'); notice = ''; } } catch (e) {} app._refresh();}
else if (act === 'prev-reel') cycleReel(-1);
else if (act === 'next-reel') cycleReel(1);
else if (act === 'sel-reel') { var all = allScripts(); if (all[idx]) { selId = all[idx].id; notice = ''; app._refresh();}}
else if (act === 'frame') { /* 放映中胶片条只做进度展示，不跳转 */}
else if (act === 'play-sel') { var s = findScript(selId); if (s) startPlay(s); app._refresh();}
else if (act === 'play-sel-id') { var s2 = findScript(id); if (s2) startPlay(s2); app._refresh();}
else if (act === 'play-custom') { var s3 = findScript(id); if (s3) startPlay(s3); app._refresh();}
else if (act === 'resume-play') { view = 'play'; notice = ''; app._refresh();}
else if (act === 'next') { advance(); app._refresh();}
else if (act === 'choose') { choose(idx); app._refresh();}
else if (act === 'exit-play') { if (session) session.exitConfirm = true; persistSession(session); app._refresh();}
else if (act === 'exit-cancel') { if (session) { session.exitConfirm = false; persistSession(session);} app._refresh();}
else if (act === 'exit-save') { if (session) session.exitConfirm = false; saveCurrent(false); app._refresh();}
else if (act === 'exit-discard') { discardCurrent(); app._refresh();}
else if (act === 'save-memory') { saveCurrent(true); app._refresh();}
else if (act === 'discard-memory') { discardCurrent(); app._refresh();}
else if (act === 'goal-yes' || act === 'goal-no') { if (session && !session.goalJudged) { var scg = findScript(session.scriptId); if (scg && scg.charGoal && scg.charGoal.goal) { session.goalMet = (act === 'goal-yes'); session.goalJudged = true; session.affection = aeClamp(session.affection + (session.goalMet ? 5 : -5)); session.ended = computeEnding(scg, session.affection); logEvent('script_goal', getCharName(), '小目标评判：' + scg.charGoal.goal + '——' + (session.goalMet ? '达成（好感+5）' : '未达成（好感-5）'), { kind: 'goal', scriptId: scg.id, met: session.goalMet }); persistSession(session); } } app._refresh();}
else if (act === 'vote-ending') { if (session) { var scv = findScript(session.scriptId); if (scv && scv.endings && scv.endings[idx]) { session.vote = scv.endings[idx].label; var vr = recordVote(scv.id, scv.title, session.vote); try { if (typeof window !== 'undefined' && window.GroupZ && window.GroupZ.voteEnding) window.GroupZ.voteEnding(scv.id, session.vote); } catch (e) {} logEvent('script_vote', getCharName(), '投票最喜欢的结局：' + session.vote + '（《' + scv.title + '》' + (vr.firstTime ? '，首次投票：AE 镜像+1，已同步 Z 组（结局之选）' : '，更新选择：Z 组记一票，AE 镜像不重复计分') + '）', { kind: 'vote', scriptId: scv.id, ending: session.vote }); persistSession(session); } } app._refresh();}
else if (act === 'deck-draw') { var dk = aeQuizDraw(btn.getAttribute('data-kind') || 'question'); if (session && (view === 'play' || view === 'ending')) { session.deckDraw = dk; persistSession(session); } else { homeDeckDraw = dk; } app._refresh();}
else if (act === 'plays-search') { var q = win.querySelector('#sc-plays-q'); playSearch = q ? q.value : ''; app._refresh();}
else if (act === 'plays-export') { try { var jl = aePlaysToJsonl(loadPlays()); var doc = win.ownerDocument || document; var blob = new Blob([jl], { type: 'application/jsonl' }); var url = URL.createObjectURL(blob); var a = doc.createElement('a'); a.href = url; a.download = 'script-plays.jsonl'; doc.body.appendChild(a); a.click(); setTimeout(function () { try { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); } catch (e) {} }, 800); notice = '游玩记录已导出 JSONL（' + loadPlays().length + ' 场）。'; } catch (e) { notice = '导出失败：' + (e && e.message); } app._refresh();}
else if (act === 'open-play') { detailPlayId = id; view = 'playDetail'; notice = ''; app._refresh();}
else if (act === 'del-play') { try { if (!window.confirm('确定删除这场游玩记录吗？归巢记忆不受影响。')) return; } catch (e) {} saveArr(PLAYS_KEY, loadPlays().filter(function (p) { return p.id !== id; })); if (detailPlayId === id) { detailPlayId = null; view = 'plays'; } notice = '已删除这场游玩记录（不影响归巢记忆）。'; app._refresh();}
else if (act === 'open-saved') { detailId = id; view = 'savedDetail'; notice = ''; app._refresh();}
else if (act === 'del-saved') { try { if (!window.confirm('确定删除这条记忆吗？归巢里对应的那条记忆也会一起删掉，不可恢复。')) return; } catch (e) {} deleteSavedRecord(id); detailId = null; view = 'archive'; notice = '已删除，归巢里对应的那条记忆也一起删了。'; app._refresh();}
else if (act === 'new-custom') { editDraft = blankDraft(); editId = null; view = 'editorForm'; notice = ''; app._refresh();}
else if (act === 'edit-custom') { var c = findScript(id); if (c) { editDraft = scriptToDraft(c); editId = id; view = 'editorForm'; notice = ''; app._refresh();}}
else if (act === 'del-custom') {
var cf = null; try { cf = window.confirm('确定删除这个自定义剧本吗？已保存的记忆不受影响。');} catch (e) { cf = null;}
if (cf === false) return;
saveArr(CUSTOM_KEY, loadArr(CUSTOM_KEY).filter(function (x) { return x.id!== id;}));
notice = '自定义剧本已删除。'; app._refresh();
}
else if (act === 'ed-add-scene') { readDraftFromForm(win); editDraft.scenes.push({ title: '第' + (editDraft.scenes.length + 1) + '幕', linesText: '旁白：', choicePrompt: '', optionsText: ''}); app._refresh();}
else if (act === 'ed-del-scene') { try { if (!window.confirm('确定删掉这一幕吗？这一幕的台词和选项都会丢掉。')) return; } catch (e) {} readDraftFromForm(win); editDraft.scenes.splice(idx, 1); app._refresh();}
else if (act === 'ed-cancel') { editDraft = null; view = 'editorList'; notice = ''; app._refresh();}
else if (act === 'ed-save') {
readDraftFromForm(win);
var sc = draftToScript(editDraft);
var errs = validateScript(sc);
if (errs.length) { notice = '还不能保存：' + errs.join('；'); app._refresh(); return;}
var arr = loadArr(CUSTOM_KEY);
var k = -1; arr.forEach(function (x, i) { if (x.id === sc.id) k = i;});
if (k >= 0) arr[k] = sc; else arr.push(sc);
saveArr(CUSTOM_KEY, arr);
editDraft = null; view = 'editorList'; notice = '剧本「' + sc.title + '」已保存，可以放映了。'; app._refresh();
}
};
});
/* [GROUP-FIX9] VN 上传接线 + 人物条滑动选中 + 3D 初始化（每次 renderBody 重绘后
   bindBody 都会跑，节点是新造的，不会重复绑；滑动选中只在真有横向溢出时才生效）。 */
try { var _oaUp = win.querySelector('[data-oa-vn-upload]'); if (_oaUp) _oaUp.addEventListener('change', function (ev) { var f = ev.target && ev.target.files && ev.target.files[0]; if (!f) return; try { var AW9u = oaAW(); if (AW9u && AW9u.handleVNFile) AW9u.handleVNFile(f); } catch (e) {} }); } catch (e) {}
try {
  var _oaPortraitInput = win.querySelector('[data-oa-portrait-input]');
  if (_oaPortraitInput) _oaPortraitInput.addEventListener('change', function (ev) {
    var f = ev.target && ev.target.files && ev.target.files[0], cid = _oaPortraitInput.dataset.charId || oaSelCharId(oaRealChars());
    if (!f || !cid) return;
    if (!(f.type === 'image/png' || /\.png$/i.test(f.name)) || f.size > 8 * 1024 * 1024) { window.alert('请选择 8MB 以内的 PNG 图片。'); _oaPortraitInput.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        try {
          var scale = Math.min(1, 520 / (im.naturalWidth || im.width), 720 / (im.naturalHeight || im.height));
          var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round((im.naturalWidth || im.width) * scale)); cv.height = Math.max(1, Math.round((im.naturalHeight || im.height) * scale));
          var cx = cv.getContext('2d'); cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
          var data = cv.toDataURL('image/png');
          if (data.length > 2100000) { window.alert('这张 PNG 仍然太大，请换一张较小的透明立绘。'); return; }
          if (!oaSetPortrait(cid, data)) { window.alert('保存失败：本机存储空间不足，请先移除较大的本地图片。'); return; }
          app._refresh();
        } catch (e) { window.alert('PNG 处理失败，请尝试另一张图片。'); }
        finally { _oaPortraitInput.value = ''; }
      };
      im.onerror = function () { window.alert('无法读取这张 PNG 图片。'); _oaPortraitInput.value = ''; };
      im.src = String(rd.result || '');
    };
    rd.onerror = function () { window.alert('读取图片失败。'); _oaPortraitInput.value = ''; };
    rd.readAsDataURL(f);
  });
} catch (e) {}
try { var _oaStrip = win.querySelector('.sc-cast-strip'); if (_oaStrip) _oaStrip.addEventListener('scroll', function () { try { if (_oaStrip.scrollWidth <= _oaStrip.clientWidth + 4) return; if (_oaStrip._oaT) clearTimeout(_oaStrip._oaT); _oaStrip._oaT = setTimeout(function () { var cards = _oaStrip.querySelectorAll('.sc-cast-card[data-id]'); if (!cards.length) return; var mid = _oaStrip.scrollLeft + _oaStrip.clientWidth / 2; var best = null, bestD = 1e9; for (var i = 0; i < cards.length; i++) { var c = cards[i]; var cc = c.offsetLeft + c.offsetWidth / 2; var d = Math.abs(cc - mid); if (d < bestD) { bestD = d; best = c; } } if (!best) return; var bid = best.getAttribute('data-id'); var AW9h = oaAW(); var cur = ''; try { cur = AW9h.scriptCharId(); } catch (e) {} if (bid && bid !== cur) { try { AW9h.setScriptChar(bid); } catch (e) {} var all = _oaStrip.querySelectorAll('.sc-cast-card'); for (var j = 0; j < all.length; j++) all[j].classList.toggle('on', all[j] === best); var lab = win.querySelector('[data-oa-curcast]'); if (lab) lab.textContent = best.querySelector('.sc-cast-name').textContent; } }, 140); } catch (e) {} }, { passive: true }); } catch (e) {}
try { oaEnsure3D(win); } catch (e) {}
};
var app = gdApp('script', '剧本', '胶片阅读机 · 支线恋爱', '本地放映：胶片只存在这台手机里。演完选「保存记忆」才会写进归巢。', renderBody, bindBody);
GD.scriptApp = app;
GD.scriptCore = { BUILTINS: SCRIPT_BUILTINS, CUSTOM_KEY: CUSTOM_KEY, SAVED_KEY: SAVED_KEY, SESSION_KEY: SESSION_KEY, GC_KEY: GC_KEY,
allScripts: allScripts, findScript: findScript, computeEnding: computeEnding, validateScript: validateScript,
parseLines: parseLines, parseOptions: parseOptions, buildMemoryContent: buildMemoryContent,
saveMemoryRecord: saveMemoryRecord, deleteSavedRecord: deleteSavedRecord, clearSession: clearSession,
loadSession: loadSession, getCharName: getCharName, getLook: getLook, charSvg: charSvg,
AE_MARK: AE_MARK, PLAYS_KEY: PLAYS_KEY, ACH_KEY: ACH_KEY, EVENT_KEY: EVENT_KEY,
logEvent: logEvent, readEvents: readEvents, loadPlays: loadPlays, savePlays: savePlays, loadAch: loadAch, recordVote: recordVote, recordPlay: recordPlay,
dailyQuote: aeDailyQuote, quizDraw: aeQuizDraw, maybeRandomEvent: aeMaybeRandomEvent, roundDm: aeRoundDm, charAction: aeCharAction, roundSummary: aeRoundSummary,
keyFacts: aeKeyFacts, archiveSummary: aeArchiveSummary, playsToJsonl: aePlaysToJsonl, searchPlays: aeSearchPlays, summarizeEvents: aeSummarizeEvents, zInterface: aeZInterface,
saveKeyFactsRecord: saveKeyFactsRecord, ensureRoundFields: ensureRoundFields, finishRoundSummary: finishRoundSummary, maybeTriggerHidden: maybeTriggerHidden};
window.ScriptAE = { MARK: AE_MARK, PLAYS_KEY: PLAYS_KEY, ACH_KEY: ACH_KEY, EVENT_KEY: EVENT_KEY, TEMPLATE_NOTE: AE_TEMPLATE_NOTE,
DAILY_QUOTES: AE_DAILY_QUOTES, QUIZ_QUESTIONS: AE_QUIZ_QUESTIONS, SCENE_CARDS: AE_SCENE_CARDS, RANDOM_EVENTS: AE_RANDOM_EVENTS,
dailyQuote: aeDailyQuote, pick: aePick, quizDraw: aeQuizDraw, maybeRandomEvent: aeMaybeRandomEvent, roundDm: aeRoundDm, charAction: aeCharAction, roundSummary: aeRoundSummary,
keyFacts: aeKeyFacts, archiveSummary: aeArchiveSummary, playsToJsonl: aePlaysToJsonl, searchPlays: aeSearchPlays,
logEvent: logEvent, readEvents: readEvents, summarizeEvents: aeSummarizeEvents,
loadPlays: loadPlays, savePlays: savePlays, recordPlay: recordPlay, loadAch: loadAch, saveAch: saveAch, recordVote: recordVote,
zInterface: aeZInterface, core: GD.scriptCore };
GD.scriptAE = window.ScriptAE;
try { if (typeof AppManager!== 'undefined') AppManager.register('script', app);} catch (e) {}
})();

/* ══════════ AD组 · 习惯 · phone_habits_v1 ══════════
   GROUP-AD-HABITS：日程习惯区 8 项，原接 D 组日程 app；GROUP-FIX7 起日程 app 已删，习惯独立挂载（见第 1 节）
   与备忘录（phone_memo_v1），不另起 app。
   做法出处（只借思路，未复制代码）：
   - habit-tracker（批量调研）：习惯数组 + habitId:date 扁平映射、
     今日/周/月三视图、91 天热力图、只数计划日的 streak、
     待办 + 自动保存速记、专注/闲逛/睡眠 + 话痨滑杆。
   - notion-aesthetic-pomodoro（批量调研）：今日完成率进度环、
     最长连续展示；其循环/打卡是 Future Improvements，未借实现。
   - 小组件：数据接口供 W/AC 组件系统挂接（本文件尚未合入该系统，
     见 widgetData/renderWidgetHTML 注释）。
   - 报喜：走微信主动消息通道（与 M 组 wxPush / O 组 _dispatch 同款
     做法），受 phone_settings_v3 proactiveMsg 与 CharInnerLife
     节流门约束。
   新增键：phone_habits_v1（见补丁头注释）。只读复用：
   phone_schedule_v1、phone_memo_v1、phone_settings_v3、
   phone_wechat_store_v2。无外链，不连真实账号。 */
(function () {
var KEY = 'phone_habits_v1';
var MILESTONES = [7, 14, 30, 60, 100];
var CATEGORIES = ['运动', '健康', '学习', '生活', '其他'];
var EMOJIS = ['🌱', '🏃', '📚', '💧', '🧘', '🎵', '✍️', '🥗', '😴', '🧹', '💰', '🌙'];
var COLORS = ['#5b8c5a', '#e07856', '#5a7ba6', '#b08968', '#8a7ca8', '#c25e7a'];
var HEAT_COLORS = ['#f0ebe6', '#d3e8c2', '#a9d18e', '#6faf5e', '#3d7a37'];
var MODES = { focus: '专注', roam: '闲逛', sleep: '睡眠' };

function p2(n) { return String(n).padStart(2, '0'); }
function dstr(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function parseD(s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
function dow(s) { return parseD(s).getDay(); }
function clampN(v, lo, hi) { v = +v || 0; return v < lo ? lo : (v > hi ? hi : v); }

function defaultData() {
    return { habits: [], checks: {}, todos: [], quickNote: '', settings: { mode: 'roam', chattiness: 50, celebrated: {} } };
}
function load() {
    var d = store.get(KEY, null);
    if (!d || typeof d !== 'object') { d = defaultData(); store.set(KEY, d); return d; }
    if (!Array.isArray(d.habits)) d.habits = [];
    if (!d.checks || typeof d.checks !== 'object') d.checks = {};
    if (!Array.isArray(d.todos)) d.todos = [];
    if (typeof d.quickNote !== 'string') d.quickNote = '';
    if (!d.settings || typeof d.settings !== 'object') d.settings = {};
    if (MODES[d.settings.mode] === undefined) d.settings.mode = 'roam';
    if (typeof d.settings.chattiness !== 'number') d.settings.chattiness = 50;
    if (!d.settings.celebrated || typeof d.settings.celebrated !== 'object') d.settings.celebrated = {};
    d.habits.forEach(function (h, i) {
        if (!h.freq || typeof h.freq !== 'object') h.freq = { type: 'daily', days: [] };
        if (['daily', 'weekdays', 'weekends', 'custom'].indexOf(h.freq.type) < 0) h.freq.type = 'daily';
        if (!Array.isArray(h.freq.days)) h.freq.days = [];
        if (typeof h.archived !== 'boolean') h.archived = false;
        if (!h.color) h.color = COLORS[i % COLORS.length];
    });
    return d;
}
function save(d) { store.set(KEY, d); return d; }

/* ── 频率：某天是不是计划日（纯函数）── */
function isPlanned(h, dateStr) {
    var t = (h && h.freq && h.freq.type) || 'daily';
    var w = dow(dateStr);
    if (t === 'daily') return true;
    if (t === 'weekdays') return w >= 1 && w <= 5;
    if (t === 'weekends') return w === 0 || w === 6;
    if (t === 'custom') return (h.freq.days || []).indexOf(w) >= 0;
    return true;
}
function isChecked(d, hid, dateStr) { return d.checks[hid + ':' + dateStr] === true; }

/* ── 连续打卡：只数计划日，跳过非计划日；今天未打卡时从昨天起算（纯函数）── */
function streakFor(h, d, refDate) {
    refDate = refDate || todayStr();
    var cur = refDate;
    if (isPlanned(h, cur) && !isChecked(d, h.id, cur)) cur = addDays(cur, -1);
    var n = 0;
    for (var i = 0; i < 370; i++) {
        if (!isPlanned(h, cur)) { cur = addDays(cur, -1); continue; }
        if (isChecked(d, h.id, cur)) { n++; cur = addDays(cur, -1); }
        else break;
    }
    return n;
}
function longestStreak(h, d, refDate) {
    refDate = refDate || todayStr();
    var best = 0, run = 0;
    var cur = refDate;
    for (var i = 0; i < 370; i++) {
        if (!isPlanned(h, cur)) { cur = addDays(cur, -1); continue; }
        if (isChecked(d, h.id, cur)) { run++; if (run > best) best = run; }
        else run = 0;
        cur = addDays(cur, -1);
    }
    return best;
}
function completionRate(h, d, days, refDate) {
    days = days || 28; refDate = refDate || todayStr();
    var planned = 0, done = 0;
    for (var i = 0; i < days; i++) {
        var ds = addDays(refDate, -i);
        if (!isPlanned(h, ds)) continue;
        planned++;
        if (isChecked(d, h.id, ds)) done++;
    }
    return { planned: planned, done: done, pct: planned ? Math.round(done * 100 / planned) : 0 };
}
function weekCounts(h, d, refDate) {
    refDate = refDate || todayStr();
    var w = dow(refDate);
    var thisMon = addDays(refDate, -(w === 0 ? 6 : w - 1));
    var lastMon = addDays(thisMon, -7);
    var count = function (mon) {
        var n = 0;
        for (var i = 0; i < 7; i++) { var ds = addDays(mon, i); if (isPlanned(h, ds) && isChecked(d, h.id, ds)) n++; }
        return n;
    };
    return { thisWeek: count(thisMon), lastWeek: count(lastMon), weekStart: thisMon };
}
function weeklyInsight(h, d, refDate) {
    var c = weekCounts(h, d, refDate);
    var delta = c.thisWeek - c.lastWeek;
    var cmp = delta > 0 ? '比上周多 ' + delta + ' 次' : (delta < 0 ? '比上周少 ' + (-delta) + ' 次' : '和上周一样');
    return { text: '本周' + h.name + ' ' + c.thisWeek + ' 次，' + cmp, thisWeek: c.thisWeek, lastWeek: c.lastWeek, delta: delta };
}
function weekBuckets(h, d, refDate) {
    refDate = refDate || todayStr();
    var w = dow(refDate);
    var thisMon = addDays(refDate, -(w === 0 ? 6 : w - 1));
    var out = [];
    for (var k = 3; k >= 0; k--) {
        var mon = addDays(thisMon, -7 * k);
        var planned = 0, done = 0;
        for (var i = 0; i < 7; i++) { var ds = addDays(mon, i); if (isPlanned(h, ds)) { planned++; if (isChecked(d, h.id, ds)) done++; } }
        out.push({ weekStart: mon, planned: planned, done: done });
    }
    return out;
}
/* 91 天热力图：按当天打卡总数分 5 档（0 / 1 / 2 / 3 / 4+），纯函数 */
function heatmap(d, refDate) {
    refDate = refDate || todayStr();
    var out = [];
    for (var i = 90; i >= 0; i--) {
        var ds = addDays(refDate, -i);
        var n = 0;
        d.habits.forEach(function (h) { if (!h.archived && isChecked(d, h.id, ds)) n++; });
        out.push({ date: ds, count: n, level: n >= 4 ? 4 : n });
    }
    return out;
}
function activeHabits(d) { return d.habits.filter(function (h) { return !h.archived; }); }
function todayStats(d, refDate) {
    refDate = refDate || todayStr();
    var hs = activeHabits(d).filter(function (h) { return isPlanned(h, refDate); });
    var done = hs.filter(function (h) { return isChecked(d, h.id, refDate); }).length;
    var best = 0;
    activeHabits(d).forEach(function (h) { var l = longestStreak(h, d, refDate); if (l > best) best = l; });
    return { total: hs.length, done: done, pct: hs.length ? Math.round(done * 100 / hs.length) : 0, longest: best };
}

/* ── 习惯增删改 / 归档 / 拖拽排序 ── */
function addHabit(input) {
    var d = load();
    var name = String((input && input.name) || '').trim();
    if (!name) return null;
    var h = {
        id: uid('hb'), name: name.slice(0, 20),
        emoji: (input && input.emoji) || '🌱',
        category: (input && input.category) || '生活',
        color: COLORS[d.habits.length % COLORS.length],
        freq: { type: ((input && input.freq && input.freq.type) || 'daily'), days: ((input && input.freq && input.freq.days) || []).slice() },
        archived: false, createdAt: Date.now()
    };
    d.habits.push(h); save(d); return h;
}
function findHabit(d, id) { return d.habits.find(function (h) { return h.id === id; }) || null; }
function updateHabit(id, patch) {
    var d = load(); var h = findHabit(d, id); if (!h) return null;
    if (patch.name !== undefined) h.name = String(patch.name).trim().slice(0, 20) || h.name;
    if (patch.emoji !== undefined) h.emoji = patch.emoji;
    if (patch.category !== undefined) h.category = patch.category;
    if (patch.freq !== undefined) h.freq = { type: patch.freq.type || 'daily', days: (patch.freq.days || []).slice() };
    save(d); return h;
}
function deleteHabit(id) {
    var d = load();
    d.habits = d.habits.filter(function (h) { return h.id !== id; });
    Object.keys(d.checks).forEach(function (k) { if (k.indexOf(id + ':') === 0) delete d.checks[k]; });
    save(d); return true;
}
function archiveHabit(id, archived) {
    var d = load(); var h = findHabit(d, id); if (!h) return null;
    h.archived = !!archived; save(d); return h;
}
function moveHabit(id, toIndex) {
    var d = load();
    var from = -1;
    d.habits.forEach(function (h, i) { if (h.id === id) from = i; });
    if (from < 0) return false;
    toIndex = clampN(toIndex, 0, d.habits.length - 1);
    var h = d.habits.splice(from, 1)[0];
    d.habits.splice(toIndex, 0, h);
    save(d); return true;
}
function setCheck(id, dateStr, done) {
    var d = load();
    if (done) d.checks[id + ':' + dateStr] = true; else delete d.checks[id + ':' + dateStr];
    save(d); return done;
}
function toggleCheck(id, dateStr, opts) {
    var d = load(); var h = findHabit(d, id);
    if (!h) return null;
    dateStr = dateStr || todayStr();
    var before = streakFor(h, d, dateStr);
    var done = !isChecked(d, id, dateStr);
    if (done) d.checks[id + ':' + dateStr] = true; else delete d.checks[id + ':' + dateStr];
    save(d);
    var after = streakFor(h, load(), dateStr);
    var res = { done: done, streak: after, longest: longestStreak(h, load(), dateStr), celebrates: [] };
    if (done) {
        MILESTONES.forEach(function (m) {
            if (before < m && after >= m) res.celebrates.push(celebrate(h, m, opts));
        });
    }
    return res;
}

/* ── 待办 + 速记（待办即时写盘；速记由 UI debounce 后调 setQuickNote）── */
function addTodo(text) {
    var d = load(); text = String(text || '').trim(); if (!text) return null;
    var t = { id: uid('td'), text: text.slice(0, 80), done: false, createdAt: Date.now() };
    d.todos.push(t); save(d); return t;
}
function toggleTodo(id) { var d = load(); var t = d.todos.find(function (x) { return x.id === id; }); if (!t) return null; t.done = !t.done; save(d); return t; }
function delTodo(id) { var d = load(); d.todos = d.todos.filter(function (x) { return x.id !== id; }); save(d); return true; }
function setQuickNote(text) { var d = load(); d.quickNote = String(text || ''); save(d); return d.quickNote; }

/* ── 模式 + 话痨程度 ── */
function getMode() { return load().settings.mode; }
function setMode(m) { if (MODES[m] === undefined) return null; var d = load(); d.settings.mode = m; save(d); return m; }
function getChattiness() { return load().settings.chattiness; }
function setChattiness(v) { var d = load(); d.settings.chattiness = clampN(Math.round(v), 0, 100); save(d); return d.settings.chattiness; }

/* ── 报喜：走微信主动消息通道 ── */
function charName() {
    try {
        if (typeof AppRegistry !== 'undefined' && AppRegistry.wechat && AppRegistry.wechat.wxStore) {
            var ss = AppRegistry.wechat.wxStore.sessions || [];
            var s0 = ss.find(function (x) { return x && !x.isGroup && x.name; });
            if (s0) return s0.name;
        }
    } catch (e) {}
    try {
        var raw = localStorage.getItem('phone_wechat_store_v2');
        if (raw) { var ss2 = (JSON.parse(raw).sessions || []).filter(function (x) { return x && !x.isGroup && x.name; }); if (ss2.length) return ss2[0].name; }
    } catch (e) {}
    return '他';
}
function proactiveAllowed() {
    try { var s = store.get('phone_settings_v3', null); return !!(s && s.proactiveMsg === true); } catch (e) { return false; }
}
function deliverToWeChat(name, text) {
    var delivered = false;
    try {
        var st = (typeof AppRegistry !== 'undefined' && AppRegistry.wechat) ? AppRegistry.wechat.wxStore : null;
        var sess = st && (st.sessions || []).find(function (x) { return x.name === name && !x.isGroup; });
        if (sess) {
            sess.messages = sess.messages || [];
            sess.messages.push({ id: 'ad_' + Date.now(), sender: name, type: 'text', content: text, time: '刚刚' });
            sess.preview = text; sess.unread = (sess.unread || 0) + 1; delivered = true;
            try { if (typeof WeChatAppEngine !== 'undefined' && WeChatAppEngine.renderUpdates) WeChatAppEngine.renderUpdates(); } catch (e) {}
        }
    } catch (e) {}
    if (!delivered) {
        try {
            var raw = localStorage.getItem('phone_wechat_store_v2');
            if (raw) {
                var data = JSON.parse(raw);
                var s2 = (data.sessions || []).find(function (x) { return x.name === name && !x.isGroup; });
                if (s2) {
                    s2.messages = s2.messages || [];
                    s2.messages.push({ id: 'ad_' + Date.now(), sender: name, type: 'text', content: text, time: '刚刚' });
                    s2.preview = text; s2.unread = (s2.unread || 0) + 1;
                    localStorage.setItem('phone_wechat_store_v2', JSON.stringify(data));
                    delivered = true;
                }
            }
        } catch (e) {}
    }
    return delivered;
}
function celebrateText(h, milestone, chattiness) {
    var base = '你已经连续' + h.name + ' ' + milestone + ' 天了，好厉害！';
    if (chattiness < 30) return base;
    if (chattiness >= 70) return base + '我都看在眼里呢，今天也要一起加油呀。';
    return base + '继续保持呀。';
}
function celebrate(h, milestone, opts) {
    opts = opts || {};
    var d = load();
    var key = h.id + ':' + milestone;
    if (d.settings.celebrated[key] && !opts.force) return { sent: false, reason: 'already_celebrated', milestone: milestone };
    if (d.settings.mode === 'focus' && !opts.force) return { sent: false, reason: 'focus_mode', milestone: milestone };
    if (!proactiveAllowed() && !opts.force) return { sent: false, reason: 'proactive_off', milestone: milestone };
    if (!opts.force) {
        try {
            if (window.CharInnerLife && window.CharInnerLife.canSendProactive) {
                var g = window.CharInnerLife.canSendProactive(new Date());
                if (!g.ok) { try { window.CharInnerLife.noteSuppressed('habit_celebrate:' + g.reason); } catch (e) {} return { sent: false, reason: 'inner_gate:' + g.reason, milestone: milestone }; }
            }
        } catch (e) {}
    }
    var text = celebrateText(h, milestone, d.settings.chattiness);
    var ok = deliverToWeChat(charName(), text);
    if (ok) {
        var d2 = load(); d2.settings.celebrated[key] = Date.now(); save(d2);
        try { if (window.CharInnerLife && window.CharInnerLife.noteSent) window.CharInnerLife.noteSent('habit_celebrate', text, charName()); } catch (e) {}
        return { sent: true, reason: 'ok', milestone: milestone, text: text };
    }
    return { sent: false, reason: 'no_session', milestone: milestone, text: text };
}

/* ── 小组件数据接口 ──
   W/AC 组的小组件系统在本文件里尚未合入：没有组件仓库 /
   widgetRegistry，只有 desktop_widgets_v2 的硬编码渲染
   （clock/token/diary/ahui*）。所以这里不硬接桌面，只提供
   同一份数据的只读接口 + 可直接放进渲染映射的 HTML 字符串，
   等 W/AC 合入后把 renderWidgetHTML('todos'|'habits') 的返回值
   挂进它的组件仓库即可；习惯页底部也有这两个组件的入口。 */
function widgetData(refDate) {
    refDate = refDate || todayStr();
    var d = load();
    return {
        date: refDate,
        todos: d.todos.filter(function (t) { return !t.done; }).slice(0, 5),
        todosDone: d.todos.filter(function (t) { return t.done; }).length,
        habitsToday: activeHabits(d).filter(function (h) { return isPlanned(h, refDate); }).map(function (h) {
            return { id: h.id, name: h.name, emoji: h.emoji, color: h.color, done: isChecked(d, h.id, refDate), streak: streakFor(h, d, refDate) };
        }),
        todayPct: todayStats(d, refDate).pct
    };
}
function renderWidgetHTML(kind, refDate) {
    var w = widgetData(refDate);
    if (kind === 'todos') {
        var items = w.todos.map(function (t) { return '<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #f0edea;">○ ' + esc(t.text) + '</div>'; }).join('');
        return '<div class="sys-widget" data-hb-widget="todos"><div style="font-size:13px;font-weight:600;">今日待办 · ' + w.todos.length + ' 件待做</div>'
            + (items || '<div style="font-size:13px;color:#a8a29c;padding:6px 0;">今天没有待办，享受空闲吧。</div>') + '</div>';
    }
    var rows = w.habitsToday.map(function (h) { return '<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #f0edea;">' + (h.done ? '✓ ' : '○ ') + esc(h.emoji + ' ' + h.name) + ' · ' + h.streak + ' 天</div>'; }).join('');
    return '<div class="sys-widget" data-hb-widget="habits"><div style="font-size:13px;font-weight:600;">习惯打卡 · 今日 ' + w.todayPct + '%</div>'
        + (rows || '<div style="font-size:13px;color:#a8a29c;padding:6px 0;">今天没有计划中的习惯。</div>') + '</div>';
}

/* ── 习惯页 UI 状态（只活在内存里，不另开 localStorage 键）── */
var ui = {
    page: 'habits', view: 'today', detailId: null, monthSel: null, /* GROUP-FIX7：日程页已删，默认即习惯页 */
    weekOffset: 0, monthCursor: null, showForm: false,
    formEmoji: '🌱', formFreq: 'daily', formDays: [1, 2, 3, 4, 5],
    newName: '', dragId: null, qnTimer: null
};
function tabBar(page) { /* GROUP-FIX7：日程 app 已删，只剩习惯一个标签 */
    return '<div class="gd-tabbar" style="margin:12px 16px 0;">'
        + '<div class="gd-tab' + (page === 'habits' ? ' on' : '') + '" data-act="page-habits">习惯</div></div>';
}
function freqLabel(h) {
    var t = (h.freq && h.freq.type) || 'daily';
    if (t === 'daily') return '每天';
    if (t === 'weekdays') return '工作日';
    if (t === 'weekends') return '周末';
    return '每周' + (h.freq.days || []).map(function (d) { return '日一二三四五六'[d]; }).join('、');
}
function ring(pct) {
    var c = 188.5;
    return '<svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="30" fill="none" stroke="#f0ebe6" stroke-width="7"/>'
        + '<circle cx="38" cy="38" r="30" fill="none" stroke="#5b8c5a" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (pct / 100 * c).toFixed(1) + ' ' + c + '" transform="rotate(-90 38 38)"/>'
        + '<text x="38" y="43" text-anchor="middle" font-size="15" font-weight="700" fill="#2b2a28">' + pct + '%</text></svg>';
}
function renderToday(d) {
    var today = todayStr();
    var st = todayStats(d, today);
    var hs = activeHabits(d);
    var html = '<div class="gd-card" style="display:flex;gap:16px;align-items:center;">' + ring(st.pct)
        + '<div style="flex:1;"><div style="font-size:15px;font-weight:600;">今日完成率 ' + st.done + ' / ' + st.total + '</div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:4px;">最长连续打卡 ' + st.longest + ' 天 · ' + today + ' ' + WEEK_CN[new Date().getDay()] + '</div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:2px;">点圆圈打卡，习惯只在计划日出现。</div></div></div>';
    if (!hs.length) {
        html += '<div class="gd-empty">还没有习惯<br><span style="font-size:12px;">点下面「新建习惯」，从每天一件小事开始。</span></div>';
    }
    hs.forEach(function (h, idx) {
        var planned = isPlanned(h, today);
        var done = isChecked(d, h.id, today);
        var sk = streakFor(h, d, today);
        var ins = weeklyInsight(h, d, today);
        html += '<div class="gd-card" data-hb-drag="' + h.id + '" data-hb-index="' + idx + '" draggable="true" style="cursor:grab;">'
            + '<div class="gd-row"><div style="font-size:26px;">' + esc(h.emoji) + '</div>'
            + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;" data-hb-act="detail-open" data-id="' + h.id + '">' + esc(h.name) + ' <span style="font-size:11px;color:#a8a29c;font-weight:400;">' + esc(h.category) + ' · ' + esc(freqLabel(h)) + '</span></div>'
            + '<div style="font-size:12px;color:#9a958f;margin-top:3px;">连续 ' + sk + ' 天 · ' + esc(ins.text) + '</div></div>'
            + '<button class="gd-btn-ghost" data-hb-act="toggle" data-id="' + h.id + '" data-date="' + today + '" style="min-width:52px;' + (done ? 'background:#5b8c5a;color:#fff;border-color:#5b8c5a;' : '') + '" ' + (planned ? '' : 'disabled') + '>' + (done ? '✓ 已打卡' : (planned ? '打卡' : '非计划日')) + '</button>'
            + '<button class="gd-btn-ghost" data-hb-act="archive" data-id="' + h.id + '" style="padding:7px 9px;font-size:12px;">归档</button>'
            + '</div><div style="font-size:11px;color:#b5b0aa;margin-top:6px;">长按拖动可调整顺序 · 点名字看详情、曲线与编辑</div></div>';
    });
    var archived = d.habits.filter(function (h) { return h.archived; });
    if (archived.length) {
        html += '<div class="gd-label">已归档（数据保留，不计入今日）</div>';
        archived.forEach(function (h) {
            html += '<div class="gd-card gd-row" style="opacity:.65;"><div style="font-size:22px;">' + esc(h.emoji) + '</div><div style="flex:1;"><div style="font-size:14px;">' + esc(h.name) + '</div><div style="font-size:12px;color:#9a958f;">最长 ' + longestStreak(h, d, today) + ' 天</div></div>'
                + '<button class="gd-btn-ghost" data-hb-act="restore" data-id="' + h.id + '" style="padding:7px 10px;font-size:12px;">恢复</button></div>';
        });
    }
    html += renderTodos(d) + renderHeatmap(d, today) + renderNewForm(d) + renderSettings(d);
    return html;
}
function renderTodos(d) {
    var html = '<div class="gd-label">待办清单 · 输入即保存</div>';
    html += '<div class="gd-card"><div style="display:flex;gap:8px;"><input class="gd-input" id="hb-todo-input" placeholder="写一件待办，回车或点添加…" style="flex:1;"><button class="gd-btn" data-hb-act="todo-add">添加</button></div>';
    if (!d.todos.length) html += '<div style="font-size:13px;color:#a8a29c;padding:10px 2px 2px;">还没有待办。</div>';
    d.todos.forEach(function (t) {
        html += '<div class="gd-row" style="padding:8px 2px;border-bottom:1px solid #f6f1ec;"><span data-hb-act="todo-toggle" data-id="' + t.id + '" style="cursor:pointer;font-size:16px;">' + (t.done ? '☑' : '☐') + '</span>'
            + '<span style="flex:1;font-size:14px;' + (t.done ? 'text-decoration:line-through;color:#a8a29c;' : '') + '">' + esc(t.text) + '</span>'
            + '<span data-hb-act="todo-del" data-id="' + t.id + '" style="cursor:pointer;color:#c9c2bb;">×</span></div>';
    });
    html += '<div class="gd-label">速记 · 输入后自动保存，不用点按钮</div>'
        + '<textarea class="gd-input" id="hb-qn" rows="3" placeholder="随手记一句……" style="line-height:1.7;">' + esc(d.quickNote) + '</textarea>'
        + '<div id="hb-qn-status" style="font-size:12px;color:#8a8580;margin-top:5px;">✓ 已自动保存</div></div>';
    return html;
}
function renderHeatmap(d, refDate) {
    var hm = heatmap(d, refDate);
    var cells = hm.map(function (c) {
        return '<div title="' + c.date + ' · 打卡 ' + c.count + ' 次" data-hb-heat="' + c.date + '" data-hb-count="' + c.count + '" style="width:12px;height:12px;border-radius:3px;background:' + HEAT_COLORS[c.level] + ';"></div>';
    }).join('');
    return '<div class="gd-label">最近 91 天 · 热力图（颜色越深，当天打卡越多；悬停看日期与次数）</div>'
        + '<div class="gd-card"><div style="display:grid;grid-template-rows:repeat(7,12px);grid-auto-flow:column;gap:3px;overflow-x:auto;">' + cells + '</div>'
        + '<div style="display:flex;gap:4px;align-items:center;margin-top:8px;font-size:11px;color:#9a958f;"><span>少</span>'
        + HEAT_COLORS.map(function (c) { return '<span style="width:12px;height:12px;border-radius:3px;background:' + c + ';display:inline-block;"></span>'; }).join('')
        + '<span>多 · 0 / 1 / 2 / 3 / 4+ 次</span></div></div>';
}
function renderWeek(d) {
    var today = todayStr();
    var w = dow(today);
    var mon = addDays(today, -(w === 0 ? 6 : w - 1) + ui.weekOffset * 7);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(mon, i));
    var html = '<div class="gd-card"><div style="display:flex;align-items:center;justify-content:space-between;"><button class="gd-btn-ghost" data-hb-act="week-prev">‹ 上周</button>'
        + '<div style="font-size:14px;font-weight:600;">' + mon + ' 起的一周</div>'
        + '<button class="gd-btn-ghost" data-hb-act="week-next">下周 ›</button></div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:6px;">点格子可以补打卡：点过去某天的格子就能补上（只补计划日）。</div></div>';
    var hs = activeHabits(d);
    if (!hs.length) { html += '<div class="gd-empty">还没有习惯，先去今日页新建一个。</div>'; return html; }
    hs.forEach(function (h) {
        var weekDone = 0;
        var cells = days.map(function (ds) {
            var planned = isPlanned(h, ds);
            var done = isChecked(d, h.id, ds);
            if (done) weekDone++;
            var bg = done ? '#5b8c5a' : (planned ? '#f4f1ee' : '#faf8f6');
            var ch = done ? '✓' : (planned ? '' : '·');
            var col = done ? '#fff' : '#b5b0aa';
            return '<div data-hb-act="week-cell" data-id="' + h.id + '" data-date="' + ds + '" title="' + ds + ' ' + WEEK_CN[dow(ds)] + (planned ? (done ? ' · 已打卡' : ' · 计划日，未打卡') : ' · 非计划日') + '" style="flex:1;aspect-ratio:1;border-radius:8px;background:' + bg + ';color:' + col + ';display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;">' + ch + '</div>';
        }).join('');
        html += '<div class="gd-card"><div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;"><span>' + esc(h.emoji + ' ' + h.name) + '</span><span style="font-size:12px;color:#9a958f;font-weight:400;">本周 ' + weekDone + ' 次</span></div>'
            + '<div style="display:flex;gap:5px;margin-top:10px;">' + cells + '</div>'
            + '<div style="display:flex;gap:5px;margin-top:4px;">' + days.map(function (ds) { return '<div style="flex:1;text-align:center;font-size:10px;color:#b5b0aa;">' + ds.slice(5) + '<br>' + WEEK_CN[dow(ds)].slice(1) + '</div>'; }).join('') + '</div></div>';
    });
    return html;
}
function renderMonth(d) {
    var today = todayStr();
    var cursor = ui.monthCursor || today.slice(0, 7);
    var y = +cursor.slice(0, 4), m = +cursor.slice(5, 7);
    var first = new Date(y, m - 1, 1);
    var startW = first.getDay();
    var daysInMonth = new Date(y, m, 0).getDate();
    var cells = '';
    for (var i = 0; i < startW; i++) cells += '<div></div>';
    for (var dd = 1; dd <= daysInMonth; dd++) {
        var ds = y + '-' + p2(m) + '-' + p2(dd);
        var dots = '';
        activeHabits(d).forEach(function (h) { if (isChecked(d, h.id, ds)) dots += '<span style="width:7px;height:7px;border-radius:50%;background:' + h.color + ';display:inline-block;margin:0 1px;"></span>'; });
        var sel = ui.monthSel === ds;
        cells += '<div data-hb-act="month-day" data-date="' + ds + '" style="aspect-ratio:1;border-radius:10px;border:1px solid ' + (sel ? '#5b8c5a' : '#f0edea') + ';background:' + (ds === today ? '#fdf0e4' : '#fff') + ';padding:4px 2px;cursor:pointer;text-align:center;"><div style="font-size:12px;' + (ds === today ? 'font-weight:700;' : '') + '">' + dd + '</div><div style="margin-top:3px;line-height:7px;">' + dots + '</div></div>';
    }
    var html = '<div class="gd-card"><div style="display:flex;align-items:center;justify-content:space-between;"><button class="gd-btn-ghost" data-hb-act="month-prev">‹</button>'
        + '<div style="font-size:15px;font-weight:600;">' + y + '年' + m + '月</div>'
        + '<button class="gd-btn-ghost" data-hb-act="month-next">›</button></div>'
        + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:10px;text-align:center;font-size:11px;color:#9a958f;"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:5px;">' + cells + '</div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:8px;">彩色圆点 = 当天打卡的习惯（一点一个习惯）；点日期格看当天打了哪些卡。</div></div>';
    var selDate = ui.monthSel || today;
    var doneList = activeHabits(d).filter(function (h) { return isChecked(d, h.id, selDate); });
    html += '<div class="gd-card"><div style="font-size:14px;font-weight:600;">' + selDate + ' ' + WEEK_CN[dow(selDate)] + '</div>'
        + (doneList.length ? doneList.map(function (h) { return '<div style="font-size:14px;padding:6px 0;">✓ ' + esc(h.emoji + ' ' + h.name) + '</div>'; }).join('') : '<div style="font-size:13px;color:#a8a29c;padding:8px 0;">这天没有打卡记录。</div>') + '</div>';
    return html;
}

function renderDetail(d, h) {
    var today = todayStr();
    var sk = streakFor(h, d, today);
    var lg = longestStreak(h, d, today);
    var cr = completionRate(h, d, 28, today);
    var ins = weeklyInsight(h, d, today);
    var buckets = weekBuckets(h, d, today);
    var maxPlanned = 1;
    buckets.forEach(function (b) { if (b.planned > maxPlanned) maxPlanned = b.planned; });
    var bars = buckets.map(function (b) {
        var pct = b.planned ? Math.round(b.done * 100 / b.planned) : 0;
        var ht = b.planned ? Math.max(6, Math.round(b.done / maxPlanned * 56)) : 6;
        return '<div style="flex:1;text-align:center;"><div style="height:64px;display:flex;align-items:flex-end;justify-content:center;"><div style="width:22px;height:' + ht + 'px;background:#5b8c5a;border-radius:5px 5px 0 0;"></div></div>'
            + '<div style="font-size:11px;margin-top:4px;">' + b.done + '/' + b.planned + '</div><div style="font-size:10px;color:#b5b0aa;">' + b.weekStart.slice(5) + '</div></div>';
    }).join('');
    var dayBoxes = [0, 1, 2, 3, 4, 5, 6].map(function (wd) {
        var on = (h.freq.days || []).indexOf(wd) >= 0;
        return '<label style="font-size:13px;margin-right:8px;"><input type="checkbox" class="hb-ed-day" value="' + wd + '" ' + (on ? 'checked' : '') + '> ' + '日一二三四五六'[wd] + '</label>';
    }).join('');
    var html = '<button class="gd-btn-ghost" data-hb-act="detail-back">‹ 返回习惯</button>'
        + '<div class="gd-card" style="margin-top:12px;"><div style="font-size:22px;">' + esc(h.emoji) + ' <span style="font-size:18px;font-weight:600;">' + esc(h.name) + '</span></div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:4px;">' + esc(h.category) + ' · ' + esc(freqLabel(h)) + (h.archived ? ' · 已归档' : '') + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px;">'
        + '<div style="flex:1;background:#f6f2ee;border-radius:12px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:700;">' + sk + ' 天</div><div style="font-size:11px;color:#9a958f;">当前连续</div></div>'
        + '<div style="flex:1;background:#f6f2ee;border-radius:12px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:700;">' + lg + ' 天</div><div style="font-size:11px;color:#9a958f;">最长纪录</div></div>'
        + '<div style="flex:1;background:#f6f2ee;border-radius:12px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:700;">' + cr.pct + '%</div><div style="font-size:11px;color:#9a958f;">近 28 天完成率</div></div></div>'
        + '<div style="font-size:13px;margin-top:12px;">' + esc(ins.text) + '</div></div>'
        + '<div class="gd-label">完成曲线 · 近 4 周（每周 打卡 / 计划）</div>'
        + '<div class="gd-card"><div style="display:flex;gap:6px;">' + bars + '</div></div>'
        + '<div class="gd-label">编辑习惯</div>'
        + '<div class="gd-card"><input class="gd-input" id="hb-ed-name" value="' + esc(h.name) + '">'
        + '<div style="display:flex;gap:8px;margin-top:8px;"><select class="gd-input" id="hb-ed-emoji" style="flex:1;">' + EMOJIS.map(function (e) { return '<option ' + (e === h.emoji ? 'selected' : '') + '>' + e + '</option>'; }).join('') + '</select>'
        + '<select class="gd-input" id="hb-ed-cat" style="flex:1;">' + CATEGORIES.map(function (c) { return '<option ' + (c === h.category ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;"><select class="gd-input" id="hb-ed-freq" style="flex:1;">'
        + '<option value="daily"' + (h.freq.type === 'daily' ? ' selected' : '') + '>每天</option>'
        + '<option value="weekdays"' + (h.freq.type === 'weekdays' ? ' selected' : '') + '>工作日</option>'
        + '<option value="weekends"' + (h.freq.type === 'weekends' ? ' selected' : '') + '>周末</option>'
        + '<option value="custom"' + (h.freq.type === 'custom' ? ' selected' : '') + '>自定义星期几</option></select></div>'
        + '<div id="hb-ed-days" style="margin-top:8px;' + (h.freq.type === 'custom' ? '' : 'display:none;') + '">' + dayBoxes + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px;"><button class="gd-btn" data-hb-act="detail-save" data-id="' + h.id + '" style="flex:1;">保存修改</button>'
        + '<button class="gd-btn-ghost" data-hb-act="' + (h.archived ? 'restore' : 'archive') + '" data-id="' + h.id + '">' + (h.archived ? '恢复' : '归档') + '</button>'
        + '<button class="gd-btn-danger" data-hb-act="delete" data-id="' + h.id + '">删除</button></div></div>';
    return html;
}
function renderNewForm(d) {
    if (!ui.showForm) return '<button class="gd-btn" data-hb-act="form-toggle" style="width:100%;">＋ 新建习惯</button>';
    var dayBoxes = [0, 1, 2, 3, 4, 5, 6].map(function (wd) {
        var on = ui.formDays.indexOf(wd) >= 0;
        return '<label style="font-size:13px;margin-right:8px;"><input type="checkbox" class="hb-new-day" value="' + wd + '" ' + (on ? 'checked' : '') + '> ' + '日一二三四五六'[wd] + '</label>';
    }).join('');
    return '<div class="gd-card"><div class="gd-label" style="margin-top:0;">新建习惯</div>'
        + '<input class="gd-input" id="hb-new-name" placeholder="习惯名字，例如：跑步" value="' + esc(ui.newName) + '">'
        + '<div style="margin-top:8px;">' + EMOJIS.map(function (e) { return '<span data-hb-act="form-emoji" data-emoji="' + e + '" style="font-size:22px;cursor:pointer;padding:3px;border-radius:8px;' + (ui.formEmoji === e ? 'background:#fdf0e4;' : '') + '">' + e + '</span>'; }).join('') + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;"><select class="gd-input" id="hb-new-cat" style="flex:1;">' + CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>'
        + '<select class="gd-input" id="hb-new-freq" style="flex:1;">'
        + '<option value="daily"' + (ui.formFreq === 'daily' ? ' selected' : '') + '>每天</option>'
        + '<option value="weekdays"' + (ui.formFreq === 'weekdays' ? ' selected' : '') + '>工作日</option>'
        + '<option value="weekends"' + (ui.formFreq === 'weekends' ? ' selected' : '') + '>周末</option>'
        + '<option value="custom"' + (ui.formFreq === 'custom' ? ' selected' : '') + '>自定义星期几</option></select></div>'
        + '<div id="hb-new-days" style="margin-top:8px;' + (ui.formFreq === 'custom' ? '' : 'display:none;') + '">' + dayBoxes + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px;"><button class="gd-btn" data-hb-act="habit-add" style="flex:1;">保存习惯</button>'
        + '<button class="gd-btn-ghost" data-hb-act="form-toggle">取消</button></div></div>';
}
function renderSettings(d) {
    var s = d.settings;
    var modeBtns = Object.keys(MODES).map(function (k) {
        return '<button class="gd-btn-ghost" data-hb-act="mode" data-mode="' + k + '" style="flex:1;' + (s.mode === k ? 'background:#33363b;color:#fff;border-color:#33363b;' : '') + '">' + MODES[k] + '模式</button>';
    }).join('');
    return '<div class="gd-label">模式与话痨程度</div>'
        + '<div class="gd-card"><div style="display:flex;gap:8px;">' + modeBtns + '</div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:8px;line-height:1.7;">专注：主动消息暂停，少打扰；闲逛：正常；睡眠：只发重要提醒（连续打卡 7 天以上的报喜算重要提醒）。</div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;"><span style="font-size:13px;white-space:nowrap;">话痨程度</span>'
        + '<input type="range" id="hb-chatty" min="0" max="100" value="' + s.chattiness + '" style="flex:1;">'
        + '<span id="hb-chatty-val" style="font-size:13px;width:34px;text-align:right;">' + s.chattiness + '</span></div>'
        + '<div style="font-size:12px;color:#9a958f;margin-top:4px;">0 安静、100 话痨：报喜的话会变长变短。</div></div>'
        + '<div class="gd-label">桌面小组件 · 今日待办 / 习惯打卡</div>'
        + '<div class="gd-card"><div style="font-size:13px;line-height:1.7;">桌面小组件系统（W/AC 组）尚未合入本文件，这里先把数据接口准备好：两个组件读同一份 phone_habits_v1 数据。</div>'
        + '<div style="margin-top:10px;">' + renderWidgetHTML('todos') + '</div>'
        + '<div style="margin-top:10px;">' + renderWidgetHTML('habits') + '</div>'
        + '<button class="gd-btn-ghost" data-hb-act="widget-info" style="width:100%;margin-top:10px;">小组件数据接口说明</button></div>';
}
function renderPage() {
    var d = load();
    var html = tabBar('habits');
    if (ui.detailId) {
        var h = findHabit(d, ui.detailId);
        if (!h) { ui.detailId = null; }
        else return html + renderDetail(d, h);
    }
    html += '<div class="gd-tabbar" style="margin:12px 16px 0;">'
        + '<div class="gd-tab' + (ui.view === 'today' ? ' on' : '') + '" data-hb-act="view" data-view="today">今日</div>'
        + '<div class="gd-tab' + (ui.view === 'week' ? ' on' : '') + '" data-hb-act="view" data-view="week">周</div>'
        + '<div class="gd-tab' + (ui.view === 'month' ? ' on' : '') + '" data-hb-act="view" data-view="month">月</div></div>';
    if (ui.view === 'week') return html + renderWeek(d);
    if (ui.view === 'month') return html + renderMonth(d);
    return html + renderToday(d);
}
function monthShift(delta) {
    var cursor = ui.monthCursor || todayStr().slice(0, 7);
    var y = +cursor.slice(0, 4), m = +cursor.slice(5, 7) + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    ui.monthCursor = y + '-' + p2(m);
}
function bind(win, app) {
    win.querySelectorAll('[data-hb-act]').forEach(function (el) {
        el.addEventListener('click', function () {
            var act = el.getAttribute('data-hb-act');
            var id = el.getAttribute('data-id');
            var refresh = function () { try { app._refresh(); } catch (e) {} };
            if (act === 'view') { ui.view = el.getAttribute('data-view') || 'today'; ui.detailId = null; refresh(); }
            else if (act === 'toggle') {
                var r = toggleCheck(id, el.getAttribute('data-date'));
                if (r && r.celebrates) r.celebrates.forEach(function (c) { if (c.sent) { try { alert(c.text); } catch (e) {} } });
                refresh();
            }
            else if (act === 'week-cell') { toggleCheck(id, el.getAttribute('data-date')); refresh(); }
            else if (act === 'month-day') { ui.monthSel = el.getAttribute('data-date'); refresh(); }
            else if (act === 'month-prev') { monthShift(-1); refresh(); }
            else if (act === 'month-next') { monthShift(1); refresh(); }
            else if (act === 'week-prev') { ui.weekOffset--; refresh(); }
            else if (act === 'week-next') { ui.weekOffset++; refresh(); }
            else if (act === 'detail-open') { ui.detailId = id; refresh(); }
            else if (act === 'detail-back') { ui.detailId = null; refresh(); }
            else if (act === 'archive') { archiveHabit(id, true); refresh(); }
            else if (act === 'restore') { archiveHabit(id, false); refresh(); }
            else if (act === 'delete') { try { if (confirm('确定删除这个习惯吗？它的打卡记录也会一起删掉。')) { deleteHabit(id); ui.detailId = null; refresh(); } } catch (e) { deleteHabit(id); ui.detailId = null; refresh(); } }
            else if (act === 'form-toggle') { ui.showForm = !ui.showForm; refresh(); }
            else if (act === 'form-emoji') { ui.formEmoji = el.getAttribute('data-emoji') || '🌱'; refresh(); }
            else if (act === 'habit-add') {
                var nameEl = win.querySelector('#hb-new-name');
                var catEl = win.querySelector('#hb-new-cat');
                var freqEl = win.querySelector('#hb-new-freq');
                var days = [];
                win.querySelectorAll('.hb-new-day:checked').forEach(function (c) { days.push(+c.value); });
                var h = addHabit({ name: nameEl ? nameEl.value : ui.newName, emoji: ui.formEmoji, category: catEl ? catEl.value : '生活', freq: { type: freqEl ? freqEl.value : ui.formFreq, days: days } });
                if (!h) { try { alert('请先写习惯名字'); } catch (e) {} return; }
                ui.showForm = false; ui.newName = ''; ui.formFreq = 'daily'; ui.formDays = [1, 2, 3, 4, 5]; ui.view = 'today'; refresh();
            }
            else if (act === 'detail-save') {
                var days2 = [];
                win.querySelectorAll('.hb-ed-day:checked').forEach(function (c) { days2.push(+c.value); });
                var freqEl2 = win.querySelector('#hb-ed-freq');
                var nameEl2 = win.querySelector('#hb-ed-name');
                var emEl2 = win.querySelector('#hb-ed-emoji');
                var catEl2 = win.querySelector('#hb-ed-cat');
                updateHabit(id, { name: nameEl2 ? nameEl2.value : '', emoji: emEl2 ? emEl2.value : undefined, category: catEl2 ? catEl2.value : undefined, freq: { type: freqEl2 ? freqEl2.value : 'daily', days: days2 } });
                refresh();
            }
            else if (act === 'todo-add') {
                var inp = win.querySelector('#hb-todo-input');
                if (inp && inp.value.trim()) { addTodo(inp.value); refresh(); }
            }
            else if (act === 'todo-toggle') { toggleTodo(id); refresh(); }
            else if (act === 'todo-del') { delTodo(id); refresh(); }
            else if (act === 'mode') { setMode(el.getAttribute('data-mode')); refresh(); }
            else if (act === 'widget-info') {
                try { alert('小组件数据接口已就绪：HabitCore.widgetData() 读今日待办与今日习惯打卡，renderWidgetHTML("todos" / "habits") 返回可直接挂进组件仓库的 HTML。桌面小组件系统（W/AC 组）尚未合入本文件，等它合入后挂接，不硬改桌面渲染。'); } catch (e) {}
            }
        });
    });
    win.querySelectorAll('[data-hb-drag]').forEach(function (row) {
        row.addEventListener('dragstart', function (ev) { ui.dragId = row.getAttribute('data-hb-drag'); try { ev.dataTransfer.setData('text/plain', ui.dragId); } catch (e) {} });
        row.addEventListener('dragover', function (ev) { ev.preventDefault(); });
        row.addEventListener('drop', function (ev) {
            ev.preventDefault();
            var target = row.getAttribute('data-hb-index');
            if (ui.dragId) { moveHabit(ui.dragId, +target); ui.dragId = null; try { app._refresh(); } catch (e) {} }
        });
    });
    var freqSel = win.querySelector('#hb-new-freq');
    if (freqSel) freqSel.addEventListener('change', function () { ui.formFreq = freqSel.value; try { app._refresh(); } catch (e) {} });
    var nameInp = win.querySelector('#hb-new-name');
    if (nameInp) nameInp.addEventListener('input', function () { ui.newName = nameInp.value; });
    var edFreq = win.querySelector('#hb-ed-freq');
    if (edFreq) edFreq.addEventListener('change', function () {
        var box = win.querySelector('#hb-ed-days');
        if (box) box.style.display = edFreq.value === 'custom' ? '' : 'none';
    });
    var chatty = win.querySelector('#hb-chatty');
    if (chatty) chatty.addEventListener('input', function () {
        var v = setChattiness(chatty.value);
        var lab = win.querySelector('#hb-chatty-val'); if (lab) lab.textContent = String(v);
    });
    var qn = win.querySelector('#hb-qn');
    if (qn) qn.addEventListener('input', function () {
        var txt = qn.value;
        var st = win.querySelector('#hb-qn-status'); if (st) st.textContent = '正在保存…';
        if (ui.qnTimer) clearTimeout(ui.qnTimer);
        ui.qnTimer = setTimeout(function () {
            setQuickNote(txt);
            var st2 = win.querySelector('#hb-qn-status'); if (st2) st2.textContent = '✓ 已自动保存 ' + fmtDT(Date.now());
        }, 600);
    });
    var todoInp = win.querySelector('#hb-todo-input');
    if (todoInp) todoInp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { if (todoInp.value.trim()) { addTodo(todoInp.value); try { app._refresh(); } catch (e) {} } }
    });
}

var HabitCore = {
    KEY: KEY, MILESTONES: MILESTONES, CATEGORIES: CATEGORIES, EMOJIS: EMOJIS,
    ui: ui, load: load, save: save,
    isPlanned: isPlanned, isChecked: isChecked,
    streakFor: streakFor, longestStreak: longestStreak,
    completionRate: completionRate, weekCounts: weekCounts,
    weeklyInsight: weeklyInsight, weekBuckets: weekBuckets,
    heatmap: heatmap, todayStats: todayStats,
    addHabit: addHabit, updateHabit: updateHabit, deleteHabit: deleteHabit,
    archiveHabit: archiveHabit, moveHabit: moveHabit,
    setCheck: setCheck, toggleCheck: toggleCheck,
    addTodo: addTodo, toggleTodo: toggleTodo, delTodo: delTodo,
    setQuickNote: setQuickNote,
    getMode: getMode, setMode: setMode,
    getChattiness: getChattiness, setChattiness: setChattiness,
    celebrate: celebrate, celebrateText: celebrateText,
    deliverToWeChat: deliverToWeChat, charName: charName,
    widgetData: widgetData, renderWidgetHTML: renderWidgetHTML,
    tabBar: tabBar, renderPage: renderPage, bind: bind
};
GD.habits = HabitCore;
window.HabitCore = HabitCore;
})();


/* ── 对外出口 ── */
window.GroupD = GD;
})();
