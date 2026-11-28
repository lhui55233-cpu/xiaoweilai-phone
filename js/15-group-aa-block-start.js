
/* GROUP-AA-BLOCK-START ══════════════════════════════════════════════════
   AA 组：阅读目标纯函数 + 专注热力图数据源 + 主题切换 + key 审计导出。
   只借思路、自己写代码，未复制任何项目代码；不连网、不引外链、不碰账号。
   ── 接口（供 W 组热力图小组件 / V 组主题 / T 组命名空间直接用）──
   window.NovelGoals  { PALETTE, RING_R, RING_C, colorFor(book), ensureMeta(book),
                        parsePct(progress), progress(book, totalPages), ringOffset(pct) }
   window.HeatmapData { keys:{readDaily:'read_daily_v1', focusLog:'focus_log_v1',
                        readStats:'read_stats_v1'},
                        dayKey(date), normDay('2026-11-6'->'2026-11-06'),
                        levelFor(mins), recordRead(mins, when),
                        readDays() -> {'YYYY-MM-DD': 分钟}（按日阅读，供小组件填 AC 的 read:null 缺口）,
                        build(n, endDate) -> {'YYYY-MM-DD':{read,focus,total,level}},
                        lastNDays(n, endDate) -> [{date,read,focus,total,level}] asc }
     数据源选择（二选一，已定）：直接读两份源汇总，不另存 heatmap_data_v1 缓存键。
     原因有二：(1) read_stats_v1 是 {bookId: 总分钟}、没有日期维度，无法按日汇总；
     (2) AC 组小组件已合入，其 window.heatmap_data_v1 是 ACWidgets.heatmapData
     函数的别名（非 localStorage 键），名字已被占、且 AC 的 heatmapData 明确写了
     “read_stats_v1 没有按日字段，不伪造按日阅读量”，按日 read 留 null。
     故新增 read_daily_v1 {days:{'YYYY-M-D': 分钟}} 记阅读的日维度（由 M 组
     _coreadRecordMinutes 记完 read_stats 后顺手记一笔，见 GROUP-AA 钩子），
     与 N 组 focus_log_v1 {days:{'YYYY-M-D': 分钟}} 直接汇总；历史阅读没有
     日维度、不回填、不伪造，从装上补丁起才有按日阅读数。read_stats_v1
     本身不动，只作总量交叉核对，不进按日汇总。
     对齐点：日期存储沿用 focus_log_v1 的非补零 'YYYY-M-D'；输出统一补零成
     AC 的 dayStr 格式 'YYYY-MM-DD'；level 阈值与 AC 的 heatmapData 完全一致
     （0=0 分钟，1=<15，2=<30，3=<60，4=>=60），两处热力图颜色可比。
     注意：AC 的 heatmapData 用补零 dayStr 直接查 focus.days（N 组写的是非补零
     键），会查不到既有专注记录——这是 AC 侧的待修项，AA 不动 AC 代码；
     本 HeatmapData 汇总时两侧都先 normDay 归一化，返回的是真实值。
     AC/ W 组热力图小组件用法：HeatmapData.lastNDays(28) 拿 28 天数组直接渲染，
     或用 readDays() 把 AC 的 read:null 填成真实按日阅读分钟。
   window.AppTheme    { PREFS_KEY:'phone_ui_prefs_v1', THEMES, current(), apply() }
     V 组主题写入点：phone_ui_prefs_v1（T 组 A22 已合入的形状：
     theme: 主题 id（如 'guichao' / 'bu-spring-pink'），themeCustom: {c1, c2}）；apply() 读它，
     把 :root 的 --app-* 改写成对应主题。深色模式已删除（2026-11-28）：
     旧深色 id（'dark' / 'guichao-dark' / 'gruvbox-dark' / 'bu-night-black' / 'bu-forest'）
     一律回落归巢默认 'guichao'，'auto' 按浅色处理，不再渲染深色；
     默认/未知回落浅色 :root 值并清掉行内覆盖）。themeCustom 做双形状兼容读：T 形的 {c1, c2} 作
     --app-bg/--app-accent，AC 形的 {hex} 作 --app-accent（T 与 AC 在
     themeCustom 子字段上的形状分歧见 AppKeyAudit.notes，AA 只兼容读、不修）。
     V 组未合入时 apply() 是空转安全的。另监听 storage 事件：设置页改了
     phone_ui_prefs_v1 即时生效。
   window.AppKeyAudit { domains:{域:[键…]}, namespaces:{charOwned:[…], systemPrefixes:[…]},
                        dynamic:['<role>::phone_cache'],
                        conflicts:[], total:124, notes:[…] }
     全文件 key 审计（2026-11-26，方法：localStorage 调用 + 字面量键全量 grep，
     逐键核对读写形状；chara_card_v2/v3 是角色卡 spec 版本号、不是键，已排除）：
     共 124 个固定键（既有 123 + 本组新增 read_daily_v1），按 15 个域分组，
     并按 T 组 A20 命名空间分 charOwned / system 两类；结论：顶层键无同名异构
     冲突（两个功能共用一键写不同结构的情况为 0），故无键迁移、无数据丢失风险。
     唯一发现是 phone_ui_prefs_v1.themeCustom 子字段分歧（见 notes），属两组
     约定待统一，AA 不修、只做兼容读。
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
/* ── 阅读目标纯函数（与 Controller._goalProgress / _goalRingSvg 同一套数）── */
window.NovelGoals = (function () {
    var PALETTE = ['#c96f4a', '#7a9e7e', '#5b7fa6', '#b98a2f', '#8e6fb8', '#4a7a7a', '#a65a6e', '#6b7f59'];
    var RING_R = 26, RING_C = 2 * Math.PI * 26;
    function colorFor(book) {
        var t = String((book && (book.title || book.id)) || '');
        var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
        return PALETTE[h % PALETTE.length];
    }
    function ensureMeta(book) {
        if (!book || typeof book !== 'object') return book;
        if (typeof book.color !== 'string' || !book.color) book.color = colorFor(book);
        if (!book.goal || typeof book.goal !== 'object') book.goal = { percent: 100, pages: null };
        if (typeof book.goal.percent !== 'number' || !(book.goal.percent > 0)) book.goal.percent = 100;
        if (book.goal.percent > 100) book.goal.percent = 100;
        if (typeof book.goal.pages !== 'number' || !(book.goal.pages > 0)) book.goal.pages = null;
        return book;
    }
    function parsePct(progress) { var m = /([\d.]+)\s*%/.exec(String(progress || '')); return m ? parseFloat(m[1]) : 0; }
    function progress(book, totalPages) {
        var b = ensureMeta({ title: book && book.title, id: book && book.id, goal: book && book.goal });
        var pct = parsePct(book && book.progress);
        var total = totalPages || 0;
        var readPages = total ? Math.round((pct / 100) * total) : 0;
        var p = Math.min(100, (pct / b.goal.percent) * 100);
        if (b.goal.pages && total) p = Math.min(100, (readPages / b.goal.pages) * 100);
        p = Math.round(p * 10) / 10;
        return { pct: pct, targetPct: b.goal.percent, targetPages: b.goal.pages, total: total, readPages: readPages, progress: p };
    }
    function ringOffset(pct) { return RING_C * (1 - Math.min(100, Math.max(0, pct || 0)) / 100); }
    return { PALETTE: PALETTE, RING_R: RING_R, RING_C: RING_C, colorFor: colorFor, ensureMeta: ensureMeta, parsePct: parsePct, progress: progress, ringOffset: ringOffset };
})();
/* ── 专注热力图数据源：直接读 read_daily_v1 + focus_log_v1 按日汇总 ──
   对齐 ACWidgets.heatmapData（已合入）：level 阈值完全一致；输出日期用 AC 的
   补零 dayStr 'YYYY-MM-DD'；存储沿用 focus_log_v1 的非补零 'YYYY-M-D'。 */
window.HeatmapData = (function () {
    var READ_DAILY_KEY = 'read_daily_v1';
    var FOCUS_KEY = 'focus_log_v1';
    var STATS_KEY = 'read_stats_v1';
    function ls(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function pad2(n) { return String(n).padStart(2, '0'); }
    function dayKey(d) { var t = d || new Date(); return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); }
    function normDay(s) { var p = String(s || '').split('-'); if (p.length !== 3) return ''; return p[0] + '-' + pad2(p[1]) + '-' + pad2(p[2]); }
    function levelFor(mins) { mins = +mins || 0; if (mins <= 0) return 0; if (mins < 15) return 1; if (mins < 30) return 2; if (mins < 60) return 3; return 4; }
    function normDaysMap(days) {
        var out = {};
        if (days && typeof days === 'object') Object.keys(days).forEach(function (k) { var n = normDay(k); if (n) out[n] = (+days[k] || 0); });
        return out;
    }
    function recordRead(mins, when) {
        if (!(mins > 0)) return null;
        var m = ls(READ_DAILY_KEY) || { days: {} };
        if (!m.days || typeof m.days !== 'object') m.days = {};
        var d = dayKey(when ? new Date(when) : new Date());
        m.days[d] = Math.round(((m.days[d] || 0) + mins) * 100) / 100;
        m.updatedAt = Date.now();
        save(READ_DAILY_KEY, m);
        return m.days[d];
    }
    function readDays() { return normDaysMap((ls(READ_DAILY_KEY) || {}).days); }
    function build(n, endDate) {
        var count = Math.max(1, Math.min(366, n || 28));
        var end = endDate ? new Date(endDate) : new Date();
        if (isNaN(end.getTime())) end = new Date();
        var readDaysMap = readDays();
        var focusDays = normDaysMap((ls(FOCUS_KEY) || {}).days);
        var out = {};
        for (var i = count - 1; i >= 0; i--) {
            var d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
            var key = normDay(dayKey(d));
            var read = readDaysMap[key] || 0, focus = focusDays[key] || 0, total = Math.round((read + focus) * 100) / 100;
            out[key] = { read: read, focus: focus, total: total, level: levelFor(total) };
        }
        return out;
    }
    function lastNDays(n, endDate) {
        var map = build(n, endDate);
        return Object.keys(map).sort().map(function (k) { return { date: k, read: map[k].read, focus: map[k].focus, total: map[k].total, level: map[k].level }; });
    }
    return { keys: { readDaily: READ_DAILY_KEY, focusLog: FOCUS_KEY, readStats: STATS_KEY },
        dayKey: dayKey, normDay: normDay, levelFor: levelFor, recordRead: recordRead, readDays: readDays,
        build: build, lastNDays: lastNDays,
        readDaily: function () { return ls(READ_DAILY_KEY) || { days: {} }; },
        readFocus: function () { return ls(FOCUS_KEY) || { total: 0, days: {} }; } };
})();
/* ── 主题切换：读 T 组 A22 写入点 phone_ui_prefs_v1，改写 --app-* ──
   theme 取值：主题 id（'light' / 'guichao' / 'warm' / 'mint' / 'dusk' / 'sea' / 'trianon' /
   'bu-*' 浅色款）。深色已删除（2026-11-28）：旧深色 id 在 current() 回落 'guichao'。
   themeCustom 双形状兼容读：T 形 {c1, c2} → --app-bg/--app-accent；AC 形 {hex} → --app-accent。 */
window.AppTheme = (function () {
    var PREFS_KEY = 'phone_ui_prefs_v1';
    var THEMES = { 'light': {}, 'guichao': { '--app-bg': '#ffffff', '--app-surface': '#f9f9f9', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': '#e5e5e5', '--app-accent': '#34363b', '--app-accent-soft': '#e5e5e5' }, 'warm': { '--app-bg': '#fdf6ec', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#c87a5a', '--app-accent-soft': '#f3ddd2' }, 'mint': { '--app-bg': '#eef7f2', '--app-surface': '#f7fbf9', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#2f9e7e', '--app-accent-soft': '#d2ece3' }, 'dusk': { '--app-bg': '#f4f0fa', '--app-surface': '#faf8fd', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#7a5fb5', '--app-accent-soft': '#e3dcf2' }, 'sea': { '--app-bg': '#eef4fb', '--app-surface': '#f7fafd', '--app-card': '#ffffff', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#3a7bd5', '--app-accent-soft': '#d8e6f7' }, 'trianon': { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5c6884', '--app-accent-soft': '#dce2f1' }, 'bu-spring-pink': { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#6f687e', '--app-accent-soft': '#e8c9d0' }, 'bu-autumn-red': { '--app-bg': '#fffdf8', '--app-surface': '#fbf9f4', '--app-card': '#fbf9f4', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5b5871', '--app-accent-soft': '#e8c9d0' }, 'bu-winter-blue': { '--app-bg': '#eef0f5', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#46536f', '--app-accent-soft': '#dce2f1' }, 'bu-mint': { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#6e7894', '--app-accent-soft': '#dce2f1' }, 'bu-lavender': { '--app-bg': '#fbf9f4', '--app-surface': '#fffdf8', '--app-card': '#fffdf8', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#5c6884', '--app-accent-soft': '#dce2f1' }, 'bu-cream': { '--app-bg': '#fffdf8', '--app-surface': '#fbf9f4', '--app-card': '#fbf9f4', '--app-text': '#171717', '--app-muted': '#6e6e6e', '--app-line': 'rgba(23,23,23,.14)', '--app-accent': '#46536f', '--app-accent-soft': '#eef0f5' } };
    /* 2026-11-28 批量 0020（项 1+4）：上面这张表与 js/19 GroupV.THEMES 的 vars 同值；
       浅色主题的墨色 token 对齐到 ChatGPT token（--app-text #1e2748→#171717、
       --app-muted #46536f/#5c6884→#6e6e6e、--app-line rgba(30,39,72,.16)→rgba(23,23,23,.14)），
       各主题自己的纸底色（--app-bg/--app-surface）与点缀色（--app-accent）保留。
       另补 6 个非 BU 主题（guichao/warm/mint/dusk/sea/trianon），与 js/19 同值，
       否则 AppTheme 认不出它们，data-app-theme 会回落成 light。 */
    var ALL_VARS = [];
    Object.keys(THEMES).forEach(function (t) { Object.keys(THEMES[t]).forEach(function (k) { if (ALL_VARS.indexOf(k) < 0) ALL_VARS.push(k); }); });
    /* GROUP-CORE: prefs 解析缓存——复用 GROUP-THROTTLE 的写版本号 + 500ms TTL（与 V/FIX2
       的 readPrefs 同款口径，不另起第二套缓存）。apply() 内原来每次调 prefs() 都重新
       JSON.parse（一次 apply 最多 4 次）；现在 500ms 内只读一次盘，写后由 bump 立即失效；
       同 tab 绕开 setUiPrefs/writePrefs 的直接 localStorage 写，最多 stale 500ms。 */
    var _corePrefsCache = null, _corePrefsAt = 0, _corePrefsRev = -1;
    function prefs() {
        var _rev = (typeof window !== 'undefined' && typeof window.__throttlePrefsRev === 'number') ? window.__throttlePrefsRev : 0;
        var _now = Date.now();
        if (_corePrefsCache !== null && _corePrefsRev === _rev && _now - _corePrefsAt < 500) {
            var _c = _corePrefsCache; var _o = {}; Object.keys(_c).forEach(function (k) { _o[k] = _c[k]; });
            if (_c.themeCustom && typeof _c.themeCustom === 'object') _o.themeCustom = Object.assign({}, _c.themeCustom);
            return _o;
        }
        var p = {};
        try { var _p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); if (_p && typeof _p === 'object') p = _p; } catch (e) { p = {}; }
        _corePrefsCache = p; _corePrefsAt = _now; _corePrefsRev = _rev;
        var _o2 = {}; Object.keys(p).forEach(function (k) { _o2[k] = p[k]; });
        if (p.themeCustom && typeof p.themeCustom === 'object') _o2.themeCustom = Object.assign({}, p.themeCustom);
        return _o2;
    }
    /* 深色模式已删除（2026-11-28）：旧深色 id 一律回落归巢默认 'guichao'，'auto' 按浅色处理；resolved() 永不返回 'dark'。 */
    var RETIRED_DARK = { 'dark': 1, 'guichao-dark': 1, 'gruvbox-dark': 1, 'bu-night-black': 1, 'bu-forest': 1 };
    function current() { var t = prefs().theme; if (RETIRED_DARK[t]) return 'guichao'; if (t === 'auto') return 'light'; return THEMES[t] ? t : 'light'; }
    function resolved() { return current(); }
    /* [R3-S8a] 主题应用后的 hook 列表：AppTheme.apply 是唯一应用器，应用完按注册顺序调 hook，
       hook 收到 (新主题 id, 旧主题 id)。波纹（js/27）、微信夜间（js/30）、BC 重应用（js/31）
       注册为 hook，不再替换 AppTheme.apply。 */
    var _appliedHooks = [];
    function apply() {
        var before = resolved();
        var t = resolved();
        /* GROUP-BU：主题 id 存在 phone_ui_prefs_v1.theme 里时优先用它（AC 组启动时会重写 themeCustom 两色，theme 字段不受影响，重启后主题靠它恢复）；否则跟随 V 组当前主题（两色 c1/c2 唯一标识）。 */
        try { var _pt = prefs().theme; if (typeof _pt === 'string' && THEMES[_pt]) t = _pt; else if (window.GroupV && window.GroupV.currentTheme) { var _gv = window.GroupV.currentTheme(); if (_gv && _gv.id && THEMES[_gv.id]) t = _gv.id; } } catch (e) {}
        var root = document.documentElement;
        if (!root) return t;
        root.setAttribute('data-app-theme', t);
        ALL_VARS.forEach(function (k) { root.style.removeProperty(k); });
        /* GROUP-BU：--al-* 内联值随主题一起清掉，切回默认才干净。 */
        ['--al-bg', '--al-fg', '--al-muted', '--al-border', '--al-subtle', '--al-focus'].forEach(function (k) { root.style.removeProperty(k); });
        var vars = THEMES[t] || {};
        /* GROUP-BU(0020)：V 组 js/19 的 THEMES 是唯一来源；它加载后以它的 vars 为准，
           上面静态表只作加载顺序兜底（js/15 在 js/19 之前加载，首轮 apply 时 GroupV 未就绪）。 */
        try { if (window.GroupV && window.GroupV.themeById) { var _gvt = window.GroupV.themeById(t); if (_gvt && _gvt.vars) vars = _gvt.vars; } } catch (e) {}
        /* GROUP-BU：--app-* 同步成 --al-*（浅色 token 同源）；深色已删除，data-theme-resolved 恒为 light。 */
        if (vars['--app-bg']) root.style.setProperty('--al-bg', vars['--app-bg']);
        if (vars['--app-text']) root.style.setProperty('--al-fg', vars['--app-text']);
        if (vars['--app-muted']) root.style.setProperty('--al-muted', vars['--app-muted']);
        if (vars['--app-line']) root.style.setProperty('--al-border', vars['--app-line']);
        if (vars['--app-surface']) root.style.setProperty('--al-subtle', vars['--app-surface']);
        if (vars['--app-accent']) root.style.setProperty('--al-focus', vars['--app-accent']);
        root.setAttribute('data-theme-resolved', 'light');
        Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
        var tc = prefs().themeCustom;
        /* GROUP-BU：BU 主题不吃 themeCustom 覆盖（AC 组启动时会把它重写成默认 HSL，覆盖会把点缀色改错）。 */
        if (!(t && t.indexOf('bu-') === 0) && tc && typeof tc === 'object') {
            if (typeof tc.c1 === 'string' && tc.c1) root.style.setProperty('--app-bg', tc.c1);
            if (typeof tc.c2 === 'string' && tc.c2) root.style.setProperty('--app-accent', tc.c2);
            else if (typeof tc.hex === 'string' && tc.hex) root.style.setProperty('--app-accent', tc.hex);
        }
        /* [R3-S8a] 应用完调已注册的 hook（顺序即注册顺序：波纹 js/27 → 微信夜间 js/30 → BC js/31）。 */
        for (var _hi = 0; _hi < _appliedHooks.length; _hi++) {
            try { _appliedHooks[_hi](t, before); } catch (e) {}
        }
        return t;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    try { window.addEventListener('storage', function (e) { if (e && e.key === PREFS_KEY) { try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (err) {} /* GROUP-THROTTLE: 跨 tab 改 prefs 也立即失效 */ apply(); } }); } catch (e) {}
    return { PREFS_KEY: PREFS_KEY, THEMES: THEMES, current: current, resolved: resolved, apply: apply, onApplied: _appliedHooks };
})();
/* ── key 审计导出（2026-11-26 全量 grep + 逐键核对读写形状；chara_card_v2/v3 是角色卡 spec 版本号、不是键，已排除）──
   域划分按 T 组 A20 命名空间对齐：charOwned（角色归属）vs 其余系统域。 */
window.AppKeyAudit = (function () {
    var domains = {
        wechat: ['phone_wechat_store_v2', 'phone_wechat_store_v1', 'phone_my_persona', 'phone_my_persona_data', 'phone_chatbg_v1', 'wx_moments_cover', 'wx_sticker_tags_v1', 'wx_pill_v1', 'phone_forum_posts_v1', 'phone_forum_replies_v1', 'phone_forum_favs', 'phone_banned_words_v1', 'wx_files_v1'],
        cike: ['cike_cache_v1', 'cike_album_v1', 'cike_welcome_v1', 'cike_char_day_v1', 'cike_char_look_v1', 'ck_diary_meta_v1', 'ck_diary_settings', 'ck_anec_bg', 'sealed_days_v1', 'wake_lottery_v1', 'char_special_dates_v1', 'char_proactive_state_v1', 'char_humanize_v1', 'char_drives_v1', 'char_dreams_v1', 'char_goals_v1', 'char_promises_v1', 'char_inner_log_v1', 'char_inner_state_v1', 'char_inner_switches_v1', 'char_card_import_v1', 'os_character'],
        otome: ['otome_affection_v1', 'otome_custom_char_v1', 'otome_fish_v1', 'otome_garden_v1', 'otome_home_v1', 'otome_play_v1', 'otome_cook_v1', 'otome_mochi_v1', 'otome_voice_v1', 'duet_history_v1', 'duet_playlist_v1', 'tarot_night_v1', 'tarot_history_v1'],
        focus: ['focus_log_v1', 'focus_state_v1'],
        novel: ['novel_store_v1', 'novel_annotations_v1', 'novel_theme_v1', 'novel_api_key', 'novel_base_url', 'coread_char_v1', 'read_stats_v1', 'read_words_v1', 'read_quotes_v1', 'read_daily_v1', 'novel_book_covers_v1'], /* GROUP-BU：换封面新键 */
        script: ['phone_script_custom_v1', 'phone_script_memories_v1', 'phone_script_session_v1'],
        guichao: ['guichao.memories.v1', 'guichao.diaries.v1', 'guichao_mem_index_v1'],
        schedule: ['phone_schedule_v1', 'phone_memo_v1', 'nobeidanci_stats_v1', 'habit_checkins_v1', 'habits_v1', 'phone_habit_v1'],
        pet: ['phone_catos_v1'],
        settings: ['phone_settings_v3', 'phone_prompts_v1', 'sys_layout_v1', 'iconsystem_v1', 'desktop_widgets_v2', 'phone_ui_prefs_v1', 'phone_widgets_v1', 'phone_weather_v1', 'phone_wallpaper_v1', 'phone_wallpaper_dim_dark', 'phone_lock_passcode', 'phone_lock_disabled', 'phone_lock_pw_hash_v1', 'phone_lock_salt_v1', 'phone_lock_pw_kind_v1', 'phone_lock_relock_v1', 'phone_lock_scramble_v1', 'phone_lock_decoy_v1', 'phone_lock_fail_v1', 'phone_lock_cool_v1', 'phone_lock_attempts_v1', 'phone_lock_last_verified_v1', 'phone_voice_ref_v1', 'phone_ambient_v1', 'phone_motion_reduce_v1', 'phone_ao_checkin_v1', 'phone_ao_call_seen_v1', 'phone_bi_call_cfg_v1', 'phone_bi_call_state_v1', 'phone_clock_widget_lunar', 'phone_token_stats_v1', 'syscenter_cc_v1', 'syscenter_notif_v1', 'phone_island_settings_v1', 'phone_battery_pct', 'phone_cloud_user_id_v1', 'phone_location_last_v1', 'phone_emergency_v1', 'phone_manual_contacts_v1', 'phone_call_log_v1', 'phone_sms_v1', 'phone_album_local_v1', 'phone_album_favs_v1', 'phone_weibo_posts_v1', 'phone_music_list_v1', 'phone_music_echo_v1', 'phone_voice_clones_v1', 'phone_ringtone_v1', 'phone_voicemail_v1', 'phone_favorites_v1'],
        memory: ['mc_long_v1', 'mc_world_v1', 'worldbook_global_v1', 'global_api_config_v1', 'global_api_presets_v1', 'backend_api_cfg_v1', 'phone_asr_cfg', 'phone_minimax_cfg', 'phone_vision_cfg'],
        backup: ['phone_backups_v1', 'phone_undo_v1', 'phone_ctx_notes_v1', 'char:imported_chats_v1'],
        cinema: ['cinema_progress_v1', 'cinema_notes_v1', 'cinema_chat_v1', 'cinema_tickets_v1', 'cinema_settings_v1'],
        shelf: ['groupp_shelf_v1', 'groupp_photo_saved_v1', 'groupp_vrm_v1', 'char_stage_v1', 'char_imported_v1'],
        misc: ['b_bubble_custom_css', 'b_bubble_scope', 'ahui_notebook_photo']
    };
    var namespaces = {
        charOwned: ['char:imported_chats_v1', 'char_inner_log_v1', 'char_chords_v1', 'char_daily_rules_v1', 'char_inner_switches_v1', 'char_goals_v1', 'char_promises_v1', 'char_inner_state_v1', 'char_drives_v1', 'char_dreams_v1', 'char_card_import_v1', 'char_special_dates_v1', 'char_proactive_state_v1', 'char_humanize_v1', 'char_imported_v1', 'char_stage_v1', 'phone_my_persona', 'phone_my_persona_data', 'os_character'],
        systemPrefixes: ['phone_', 'cike_', 'wx_', 'ck_', 'iconsystem', 'guichao.', 'guichao_', 'mc_', 'novel_', 'coread_', 'read_', 'sys', 'desktop_', 'nobeidanci_', 'duet_', 'tarot_', 'otome_', 'focus_', 'cinema_', 'groupp_', 'b_', 'ahui_', 'sealed_', 'wake_', 'worldbook_', 'backend_', 'global_']
    };
    var seen = {}, total = 0;
    Object.keys(domains).forEach(function (d) { domains[d].forEach(function (k) { if (!seen[k]) { seen[k] = 1; total++; } }); });
    return { domains: domains, namespaces: namespaces,
        dynamic: ['<role>::phone_cache'],
        conflicts: [],
        total: total,
        generated: '2026-11-26',
        notes: [
            'phone_wechat_store_v1 是已退役版本：启动时删掉、不再当数据读；现用 v2，属版本更替、非冲突。',
            'phone_my_persona（字符串）与 phone_my_persona_data（对象）是两个不同键，形状各一、非冲突。',
            'phone_settings_v3 是多写者共享对象（设置页 + 桌宠 deskPet 字段）：同形状合并写，非同名异构；若某写者整对象覆盖会丢字段，属既有风险、本组未动。',
            'phone_ui_prefs_v1.themeCustom 子字段分歧：T 组 A22 形状是 {c1, c2}，AC 组实际写入 {h, s, l, hex}；同一键的子字段两种形状，AA 不修、AppTheme 做双形状兼容读，待 T/AC 统一约定。',
            'AC 的 heatmapData 用补零 dayStr 直接查 focus.days，但 N 组写的是非补零键，会查不到既有专注记录；AA 的 HeatmapData 两侧先归一化、返回真实值，AC 侧待修、AA 不动 AC 代码。',
            '习惯三键并存未定 canonical：habits_v1 / habit_checkins_v1 / phone_habit_v1，AC 只读探测三者；AD 组未合入，AA 不定。',
            'phone_widgets_v1（AC 商店式组件）与 desktop_widgets_v2（旧桌面组件）是两个不同键、各自形状，非冲突。',
            'focus_log_v1/focus_state_v1 归 focus 域，乙游 3D 家专注面板只读 focus_log_v1，不另写键。',
            'T 组 A20/A21/A22 已合入：本清单域划分与 A20 命名空间（charOwned/system）对齐；guichao_mem_index_v1 为 A21 记忆索引，只读复用 guichao.memories.v1。'
        ] };
})();
/* GROUP-AA-BLOCK-END */
})();
