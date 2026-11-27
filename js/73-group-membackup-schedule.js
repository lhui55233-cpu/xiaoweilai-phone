/* ══════════ GROUP-MEMBACKUP-SCHEDULE · 记忆统一备份：夜间调度 ══════════
 * window.MemBackupSchedule：页面打开时检查一次 + 每 5 分钟检查一次，
 * 到点就调 window.MemBackupPush.pushNow({ manual:false }) 推一次。
 *
 * 诚实边界（与设置页文案一致）：没有后台机制——页面关掉、浏览器退出后
 * 什么都不会跑；只有页面开着时才会检查、才会推。不要写“后台自动备份”。
 *
 * 触发规则（每次检查都现读 phone_membackup_settings_v1）：
 *   enabled 为真 且 有 token 且 lastRun 的日期不是今天 且
 *   （当前时间 ≥23:00，或 lastRun 已是 2 天前——补推；从没备过也算补推）
 *   时推一次。推完把 lastRun / lastStatus / lastError / lastCount 写回。
 *   lastRun 记的是“上次尝试时间”（成功或失败都记）：失败也记当天，
 *   这样失败后当天不再反复重试，第二天 23 点再试；手动“立即备份”
 *   的失败不经过这里，不影响夜间调度。
 *   到期但没 token 时记 lastStatus:'failed' + lastError:'未填 token，
 *   自动备份未推送'，并把 lastRun 写成现在——下次检查看到 lastRun
 *   已是今天就不再重复写（只记一次，不每 5 分钟刷写）。
 * 开关关掉：每次检查先读 enabled，关了就什么都不做、不发任何请求。
 *   （定时器本身仍在，只是每次检查读到关就直接返回；打开开关后
 *   5 分钟内就会生效，不用重新加载页面。）
 *
 * lastStatus 只用 'success' / 'failed' 两种（与设置页显示对口），
 * 失败原因放 lastError 文本里。本模块不改 js/00，只读设置键。
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SETTINGS_KEY = 'phone_membackup_settings_v1';
var TOKEN_KEY = 'phone_membackup_token_v1';
var DEFAULT_REPO = 'guichao-memory-backup';
var CHECK_MS = 5 * 60 * 1000; /* 每 5 分钟检查一次 */
var DUE_HOUR = 23; /* 23:00 后推 */

var timer = null;
var running = false;

/* ── 只读工具 ── */
function loadSettings() {
    var d = { enabled: false, repo: DEFAULT_REPO, lastRun: '', lastStatus: '', lastError: '', lastCount: null };
    try {
        var raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') Object.assign(d, o); }
    } catch (e) {}
    if (typeof d.repo !== 'string' || !d.repo.trim()) d.repo = DEFAULT_REPO;
    return d;
}
function saveSettings(s) {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}
function hasToken() {
    try { var t = window.localStorage.getItem(TOKEN_KEY); return !!(t && typeof t === 'string' && t.trim()); } catch (e) { return false; }
}
function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function parseDate(s) {
    if (!s) return null;
    try { var d = new Date(s); return isNaN(d.getTime()) ? null : d; } catch (e) { return null; }
}
/* 整天数差（按本地日期算）：last 到 now 差几天。 */
function dayDiff(last, now) {
    var a = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
    var b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((b - a) / 86400000);
}

/* 到期判断：只读设置与时间，不发请求、不写键。 */
function dueReason(now, s) {
    if (!s.enabled) return 'disabled';
    var last = parseDate(s.lastRun);
    if (last && dayKey(last) === dayKey(now)) return 'already-today';
    if (!last) return 'never';
    if (now.getHours() >= DUE_HOUR) return 'nightly';
    if (dayDiff(last, now) >= 2) return 'catchup';
    return 'too-early';
}

/* 检查一次（now 可传，用于测试；不传用当前时间）。
 * 返回 Promise：推了 → pushNow 的原样结果；没推 → { skipped:<原因> }，
 * 原因：disabled / already-today / too-early / no-token / running / push-unavailable。 */
function checkNow(now) {
    /* 鸭子类型判 Date（不用 instanceof，避免跨 realm 失效） */
    now = (now && typeof now.getTime === 'function' && !isNaN(now.getTime())) ? now : new Date();
    var s = loadSettings();
    var reason = dueReason(now, s);
    if (reason !== 'never' && reason !== 'nightly' && reason !== 'catchup') {
        return Promise.resolve({ skipped: reason });
    }
    if (running) return Promise.resolve({ skipped: 'running' });
    if (!hasToken()) {
        /* 到期但没 token：诚实记一次失败，并把 lastRun 写成现在，
         * 下次检查看到 lastRun 已是今天就不再重复写。 */
        s.lastRun = now.toISOString();
        s.lastStatus = 'failed';
        s.lastError = '未填 token，自动备份未推送';
        saveSettings(s);
        return Promise.resolve({ skipped: 'no-token' });
    }
    if (!window.MemBackupPush || typeof window.MemBackupPush.pushNow !== 'function') {
        return Promise.resolve({ skipped: 'push-unavailable' });
    }
    running = true;
    var result;
    try {
        result = window.MemBackupPush.pushNow({ manual: false });
    } catch (err) {
        running = false;
        var s0 = loadSettings();
        s0.lastRun = now.toISOString();
        s0.lastStatus = 'failed';
        s0.lastError = String((err && err.message) || '推送出错');
        saveSettings(s0);
        return Promise.resolve({ ok: false, pushed: 0, count: 0, error: 'push-threw', reason: s0.lastError });
    }
    return Promise.resolve(result).then(function (r) {
        running = false;
        var s2 = loadSettings(); /* 重新读一次，别覆盖推送期间用户改的设置 */
        s2.lastRun = now.toISOString();
        if (r && r.ok) {
            s2.lastStatus = 'success';
            s2.lastError = '';
            if (typeof r.count === 'number') s2.lastCount = r.count;
        } else {
            s2.lastStatus = 'failed';
            s2.lastError = String((r && (r.reason || r.error)) || '推送失败');
        }
        saveSettings(s2);
        return r;
    }).catch(function (err) {
        running = false;
        var s3 = loadSettings();
        s3.lastRun = now.toISOString();
        s3.lastStatus = 'failed';
        s3.lastError = String((err && err.message) || '推送出错');
        saveSettings(s3);
        return { ok: false, pushed: 0, count: 0, error: 'push-threw', reason: s3.lastError };
    });
}

function start() {
    if (timer !== null) return false;
    timer = setInterval(function () { checkNow(new Date()); }, CHECK_MS);
    checkNow(new Date()); /* 页面打开时检查一次 */
    return true;
}
function stop() {
    if (timer === null) return false;
    clearInterval(timer);
    timer = null;
    return true;
}

window.MemBackupSchedule = {
    version: '1.0.0',
    CHECK_MS: CHECK_MS,
    DUE_HOUR: DUE_HOUR,
    start: start,
    stop: stop,
    checkNow: checkNow,
    isRunning: function () { return timer !== null; }
};

/* 页面打开即启动调度（只读设置，到期才推；开关关着时每次检查直接返回）。 */
try { start(); } catch (e) {}

})();
