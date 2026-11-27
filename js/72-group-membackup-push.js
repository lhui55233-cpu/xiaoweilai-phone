/* ══════════ GROUP-MEMBACKUP-PUSH · 记忆统一备份：GitHub 推送 ══════════
 * window.MemBackupPush.pushNow({ manual }) → Promise<{ ok, pushed, count, error, reason, path }>
 *   manual：true = 设置页“立即备份”点的；false = 夜间调度调的。行为相同，
 *   只是调用方不同（设置页与调度各自写回 lastRun/lastStatus，本函数不写
 *   任何 localStorage 键——只读设置与 token，写 settings 的事归调用方）。
 *
 * 流程：读 token（调用时现读，用完即丢）→ buildExport() 取当月全集
 *   → GET /repos/{owner}/{repo} 校验仓库在（404 即 repo-not-found）
 *   → GET /repos/{owner}/{repo}/contents/data/YYYY-MM.jsonl
 *     （404 = 当月文件还没建过；200 = 解码后与新行合并去重）
 *   → 有新增行才 PUT（无新增不发请求、不产生空提交），更新须带 sha。
 *
 * 合并规则（只加不删）：以 (source, id) 为键去重，旧行原样保留，新行追加；
 * 合并后按 created_at 升序排成一条时间线（无日期的放最后，不编造顺序）。
 * 诚实失败：没 token / 没网 / 401 / 仓库 404 / 403 限流 / 其他 HTTP 错误
 *   都返回 { ok:false, error:<码>, reason:<中文原因> }，绝不假装成功。
 * 脱敏：token 只出现在 Authorization 请求头里，绝不写日志、绝不进导出、
 *   绝不在 reason / error 里贴响应体或 token；失败只报分类与状态码。
 *
 * 约定（与 js/00 设置页、js/71 导出核心一字不差）：
 *   owner 固定 lhui55233-cpu；repo 读 phone_membackup_settings_v1，
 *   缺省 guichao-memory-backup；token 读 phone_membackup_token_v1；
 *   文件 data/YYYY-MM.jsonl（按本地月份）；分支 main。
 *   buildExport() 来自 js/71（window.MemBackup），返回 { lines, count, sources, errors }。
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var OWNER = 'lhui55233-cpu';
var SETTINGS_KEY = 'phone_membackup_settings_v1';
var TOKEN_KEY = 'phone_membackup_token_v1';
var DEFAULT_REPO = 'guichao-memory-backup';
var BRANCH = 'main';
var API_BASE = 'https://api.github.com';

/* ── 只读工具 ── */
function loadSettings() {
    var d = { enabled: false, repo: DEFAULT_REPO, lastRun: '', lastStatus: '', lastError: '', lastCount: null };
    try {
        var raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') { if (typeof o.repo === 'string' && o.repo.trim()) d.repo = o.repo.trim(); } }
    } catch (e) {}
    return d;
}
/* 调用时现读，用完即丢：返回后调用方不得保存、不得记录。 */
function readToken() {
    try {
        var t = window.localStorage.getItem(TOKEN_KEY);
        return (t && typeof t === 'string' && t.trim()) ? t.trim() : '';
    } catch (e) { return ''; }
}
function monthPath(now) {
    var y = now.getFullYear();
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    return 'data/' + y + '-' + m + '.jsonl';
}
function stamp(now) {
    function p(n) { return ('0' + n).slice(-2); }
    return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes());
}

/* ── base64（中文安全）── */
function toBase64(str) {
    try {
        if (typeof TextEncoder !== 'undefined') {
            var bytes = new TextEncoder().encode(str);
            var bin = '';
            var CHUNK = 8192;
            for (var i = 0; i < bytes.length; i += CHUNK) {
                bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
            }
            return btoa(bin);
        }
    } catch (e) {}
    return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64) {
    var clean = String(b64 || '').replace(/\s/g, '');
    try {
        if (typeof TextDecoder !== 'undefined') {
            var bin = atob(clean);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        }
    } catch (e) {}
    try { return decodeURIComponent(escape(atob(clean))); } catch (e2) { return ''; }
}

/* ── 错误分类（只报分类与状态码，不贴响应体）── */
function fail(error, reason) { return { ok: false, pushed: 0, count: 0, error: error, reason: reason }; }
function httpFail(status) {
    if (status === 401) return fail('unauthorized', 'GitHub token 不对，请检查设置里填的 token 是否正确（仅推这一个私有仓库的 token）。');
    if (status === 403) return fail('rate-limited', 'GitHub 限流或权限不足，请稍后再试，或检查 token 有没有推这个仓库的权限。');
    if (status === 404) return fail('repo-not-found', '仓库不存在，请先在 GitHub 建好私有仓库，设置里的仓库名要和建好的名字一致。');
    return fail('http-' + status, 'GitHub 返回 HTTP ' + status + '，请稍后再试。');
}
function offlineFail() { return fail('offline', '网络不通，备份没推上去，请联网后再试。'); }

/* ── 行解析：取 (source, id) 去重键与 created_at（解析失败的行原样保留）── */
function parseLine(line) {
    try {
        var o = JSON.parse(line);
        if (!o || typeof o !== 'object') return { key: null, created_at: null };
        var id = (o.id == null ? '' : String(o.id));
        var source = (o.source == null ? '' : String(o.source));
        return { key: source + '\n' + id, created_at: (typeof o.created_at === 'string' && o.created_at) ? o.created_at : null };
    } catch (e) { return { key: null, created_at: null }; }
}

function pushNow(opts) {
    opts = opts || {};
    var now = new Date();
    var token = readToken();
    if (!token) return Promise.resolve(fail('no-token', '未填 GitHub token，请先在设置 → 记忆备份里填写 token。'));
    if (!window.MemBackup || typeof window.MemBackup.buildExport !== 'function') {
        return Promise.resolve(fail('export-unavailable', '导出模块未就绪（js/71 还没加载），现在推不了，稍后再试。'));
    }
    if (typeof window.fetch !== 'function') return Promise.resolve(offlineFail());

    var repo = loadSettings().repo;
    var path = monthPath(now);
    var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
    var contentsUrl = API_BASE + '/repos/' + OWNER + '/' + encodeURIComponent(repo) + '/contents/' + path;
    var repoUrl = API_BASE + '/repos/' + OWNER + '/' + encodeURIComponent(repo);

    var exp;
    try { exp = window.MemBackup.buildExport(); } catch (e) {
        return Promise.resolve(fail('export-failed', '本地导出失败，备份没推上去，稍后再试。'));
    }
    var newLines = (exp && Array.isArray(exp.lines)) ? exp.lines : [];

    /* 1. 先看当月文件在不在。404 有两种可能（文件没建过 / 仓库不存在），
     * 再 GET 一次仓库本身来区分：仓库 404 才是 repo-not-found。 */
    return window.fetch(contentsUrl, { method: 'GET', headers: headers }).then(function (res) {
        if (res.status === 404) {
            return window.fetch(repoUrl, { method: 'GET', headers: headers }).then(function (r2) {
                if (r2.status === 404) throw httpFail(404);
                if (!r2.ok) throw httpFail(r2.status);
                return { exists: false, sha: null, oldLines: [] };
            }, function () { throw offlineFail(); });
        }
        if (!res.ok) throw httpFail(res.status);
        return res.json().then(function (data) {
            var text = (data && typeof data.content === 'string') ? fromBase64(data.content) : '';
            var oldLines = text ? text.split('\n').filter(function (l) { return l.trim() !== ''; }) : [];
            return { exists: true, sha: (data && data.sha) || null, oldLines: oldLines };
        }, function () { throw fail('unexpected', 'GitHub 返回的数据无法识别，备份没推上去，稍后再试。'); });
    }, function () { throw offlineFail(); }).then(function (cur) {
        /* 2. 合并去重：只加不删。旧行原样保留（解析失败的行也保留，不丢数据）；
         * 新行里 (source, id) 已在旧文件里的跳过。 */
        var seen = {};
        cur.oldLines.forEach(function (l) { var p = parseLine(l); if (p.key) seen[p.key] = true; });
        var added = [];
        newLines.forEach(function (l) {
            if (typeof l !== 'string' || !l.trim()) return;
            var p = parseLine(l);
            if (p.key && seen[p.key]) return;
            if (p.key) seen[p.key] = true;
            added.push(l);
        });
        if (added.length === 0) {
            return { ok: true, pushed: 0, count: cur.oldLines.length, path: path };
        }
        /* 3. 合并后按 created_at 升序排成一条时间线，无日期的放最后。 */
        var merged = cur.oldLines.concat(added).map(function (l) {
            return { line: l, created_at: parseLine(l).created_at };
        });
        merged.sort(function (a, b) {
            if (a.created_at && b.created_at) return a.created_at < b.created_at ? -1 : (a.created_at > b.created_at ? 1 : 0);
            if (a.created_at) return -1;
            if (b.created_at) return 1;
            return 0;
        });
        var bodyText = merged.map(function (m) { return m.line; }).join('\n') + '\n';
        var body = {
            message: 'backup ' + stamp(now) + ' (新增 ' + added.length + ' 条）',
            content: toBase64(bodyText),
            branch: BRANCH
        };
        if (cur.sha) body.sha = cur.sha;
        return window.fetch(contentsUrl, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (res2) {
            if (!res2.ok) throw httpFail(res2.status);
            return { ok: true, pushed: added.length, count: merged.length, path: path };
        }, function () { throw offlineFail(); });
    }).catch(function (err) {
        /* 失败只返回分类结果：err 是我们上面抛出的 fail 对象时原样返回，
         * 其他意外一律按 offline/通用失败收，不贴任何响应体与 token。 */
        if (err && typeof err === 'object' && err.ok === false && typeof err.error === 'string') return err;
        return offlineFail();
    });
}

window.MemBackupPush = {
    version: '1.0.0',
    OWNER: OWNER,
    DEFAULT_REPO: DEFAULT_REPO,
    pushNow: pushNow
};

})();
