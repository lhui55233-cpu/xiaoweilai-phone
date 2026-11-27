/* ══════════ GROUP-MEMBACKUP · 记忆统一备份：导出核心 ══════════
 * window.MemBackup：把手机本地各来源的记忆收集成 JSONL（每行一个 JSON）。
 * 只读：只读 localStorage，不写任何键、不发任何请求、不碰 Supabase、不碰
 * service_role、不问密码。Supabase 侧已有同步覆盖（js/04 CloudDB，
 * app_memories 表只读 loadMemories 是按角色、限 30 条的异步读，不能直接
 * 复用为全集同步导出），导出以手机本地为准，去重规则不变。
 *
 * 行格式：{ id, source, created_at, content, meta }
 *   source：guichao / diary / worldbook / script / wechat / cike
 *   created_at：ISO 字符串；原数据没有可用日期时为 null（不编造）。
 *   meta：至少含 key（来源 localStorage 键），其余为来源自带信息。
 * 去重：以 (source, id) 为键；无 id 的按内容哈希去重（FNV-1a，见 hashContent）。
 * 只加不删：本函数返回当前全集；远端合并去重由推送层做。
 * 绝不进：待审阅候选（phone_an_candidates_v1，批准后已进 guichao.memories.v1）、
 *   私语（wb_whisper_v1）、已删功能残留键（phone_iftheatre_v1）、任何敏感键
 *   （见 EXCLUDE_KEYS；本函数用白名单逐键读，残留键本来就读不到）。
 *
 * 来源与形状（2026-11-27 只读核实，见各收集函数注释）：
 *   归巢 guichao.memories.v1：数组（兼容 {memories:[]} 与对象 map），
 *     条目 {id, content/text, category, date, createdAt, factKey, recall}；
 *     剧本保存的记忆 category 为 'relationship'（js/07:2010/2125），
 *     另以 phone_script_memories_v1 的引用为准，两者任一命中即 source 'script'。
 *   日记 ck_diary_meta_v1（对象 map，<角色>::beside / <角色>::nightly-<日期>）
 *     + cike_cache_v1（对象 map，<角色>::beside 文本 / <角色>::trip 笔记 /
 *     <角色>::nightly-<日期> 文本）；ck_diary_shelf_v1（手写数组）；
 *     guichao.diaries.v1（数组或 {diaries:[]}，仓库内无写入处，有则收）；
 *     yuanFlipDiary（独立文件「源与阿回的日记本」手机适配版的键，数组
 *     {id, date, title, mood, content, signature}；只有同源 localStorage
 *     里有这个键时才读得到，独立文件与主文件通常不同源）。
 *   世界书 worldbook_global_v1（主文件真实键，数组，postMessage 同步来的
 *     全量条目）+ wb_folders_v1 / wb_chars_v1 / wb_presets_v1（内嵌世界书
 *     文件 apps-embedded/worldbook.html 的键，见 split 版；单文件版里
 *     世界书 iframe 是 data: URL，自有存储，父页 localStorage 读不到这
 *     三个键，读不到即记 absent，不报错）。
 *   微信 wx_story_digest_v1（长聊梗概数组 {id, sid, name, text, createdAt}，
 *     记忆类摘要）；原始聊天记录 phone_wechat_store_v2 不逐条进 JSONL，
 *     它走整屋备份文件（js/00 doExport / js/12 安全中心）。
 *   此刻 cike_cache_v1 的 ::trip 笔记 + otome_affection_v1 的 impressions。
 *   IndexedDB（XWLDB.exportDump，6 张表 calendar_marks / calendar_notes /
 *     calendar_meta / widget_assets / audio_blobs / vrm_models）里没有
 *     归巢/日记/世界书/剧本记忆行，且 exportDump 是异步的，本同步函数
 *     不嵌它；整屋备份路径仍由它携带。
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ── 来源键 ── */
var MEM_KEY = 'guichao.memories.v1';
var SCRIPT_REFS_KEY = 'phone_script_memories_v1';
var CAND_KEY = 'phone_an_candidates_v1'; /* 只读不收：待审候选绝不进备份 */
var DIARIES_KEY = 'guichao.diaries.v1';
var META_KEY = 'ck_diary_meta_v1';
var CACHE_KEY = 'cike_cache_v1';
var SHELF_KEY = 'ck_diary_shelf_v1';
var YUAN_KEY = 'yuanFlipDiary';
var WB_KEY = 'worldbook_global_v1';
var WB_FOLDERS_KEY = 'wb_folders_v1';
var WB_CHARS_KEY = 'wb_chars_v1';
var WB_PRESETS_KEY = 'wb_presets_v1';
var DIGEST_KEY = 'wx_story_digest_v1';
var AFF_KEY = 'otome_affection_v1';

/* ── EXCLUDE_KEYS：全项目 canonical 排除清单 ──
 * 用途：任何备份导出（整屋备份、统一备份、推送层）在抄 localStorage 键之前
 * 必须先过这张表。js/12 的安全修复引用它；只排除导出，localStorage 里的
 * 数据本身不动。
 * 构成（均已核实含凭证/敏感内容）：
 *   模型 key：phone_model_key_v1 / phone_model_per_feature_v1 /
 *     phone_model_fallback_keys_v1（js/47:7，备用 key 表 id→key）。
 *   各功能 API 配置（含 key）：novel_api_key（小说批注 key，js/00:19891）、
 *     phone_minimax_cfg（{groupId, apiKey}，js/00:4476）、phone_vision_cfg
 *     （{baseUrl, apiKey, model}，js/00:4589）、phone_asr_cfg（{baseUrl,
 *     apiKey, model, language}，js/00:4652）、global_api_config_v1
 *     （微信 GlobalAPI 配置，js/00:30801/30923）、backend_api_cfg_v1
 *     （后端 API 配置，js/00:34178）、wb_api_cfg（世界书 {provider,
 *     baseUrl, key}，split 版 worldbook.html:741）。
 *   锁屏凭证与状态：phone_lock_pw_hash_v1 / phone_lock_salt_v1 /
 *     phone_lock_pw_kind_v1 / phone_lock_pw_v1（遗留明文）/
 *     phone_lock_passcode / phone_lock_disabled / phone_lock_fail_v1 /
 *     phone_lock_cool_v1 / phone_lock_attempts_v1 /
 *     phone_lock_last_verified_v1（口径与 js/00:5520 doExport 一致）。
 *   备份 token：phone_membackup_token_v1（统一备份 GitHub token）及
 *     phone_github_token_v1（防御性别名：推送块若用此键名，同样排除）。
 *   私语与已删功能残留：wb_whisper_v1（私语只存本机）、phone_iftheatre_v1。
 *   归档/撤销栈：phone_backups_v1 / phone_undo_v1（内含旧快照，可能含旧 key）。
 * 明确不排除（经核查不含凭证内容）：见 NOT_EXCLUDED_KEYS。 */
var EXCLUDE_KEYS = [
    'phone_model_key_v1',
    'phone_model_per_feature_v1',
    'phone_model_fallback_keys_v1',
    'novel_api_key',
    'phone_minimax_cfg',
    'phone_vision_cfg',
    'phone_asr_cfg',
    'global_api_config_v1',
    'backend_api_cfg_v1',
    'wb_api_cfg',
    'phone_lock_pw_hash_v1',
    'phone_lock_salt_v1',
    'phone_lock_pw_kind_v1',
    'phone_lock_pw_v1',
    'phone_lock_passcode',
    'phone_lock_disabled',
    'phone_lock_fail_v1',
    'phone_lock_cool_v1',
    'phone_lock_attempts_v1',
    'phone_lock_last_verified_v1',
    'phone_membackup_token_v1',
    'phone_github_token_v1',
    'wb_whisper_v1',
    'phone_iftheatre_v1',
    'phone_backups_v1',
    'phone_undo_v1'
];

/* 经核查不含凭证内容，不要排除（列出以防后人误加）：
 * phone_model_cfg_v1（模型配置，无 key）、phone_model_fallback_v1
 * （备用链配置，无 key）、phone_model_audit_v1（调用审计，无 key 明文）、
 * phone_lock_relock_v1 / phone_lock_scramble_v1 / phone_lock_decoy_v1
 * （锁屏行为开关，无凭证）。 */
var NOT_EXCLUDED_KEYS = [
    'phone_model_cfg_v1',
    'phone_model_fallback_v1',
    'phone_model_audit_v1',
    'phone_lock_relock_v1',
    'phone_lock_scramble_v1',
    'phone_lock_decoy_v1'
];

function isExcludedKey(k) { return EXCLUDE_KEYS.indexOf(String(k)) !== -1; }

/* ── 小同步哈希：FNV-1a 32 位，无外部依赖。只用于无 id 条目的去重。 ── */
function hashContent(s) {
    var h = 0x811c9dc5;
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
}

/* ── 读工具（只读，失败回退，不抛错） ── */
function readJSON(key, fallback) {
    try {
        var raw = window.localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
    } catch (e) { return fallback; }
}
function asArray(v) {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.memories)) return v.memories;
    if (v && Array.isArray(v.diaries)) return v.diaries;
    if (v && typeof v === 'object') {
        var out = [];
        Object.keys(v).forEach(function (k) { if (v[k] && typeof v[k] === 'object') out.push(v[k]); });
        return out;
    }
    return [];
}
function asObject(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function textOf(v) { return (v == null ? '' : String(v)); }

/* created_at 归一：毫秒时间戳 / 'YYYY-MM-DD' / Date 可解析串 → ISO；
 * 'M月D日'（无年份）等无法确定时间的 → null，不编造。 */
function toISO(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && isFinite(v) && v > 0) {
        try { var d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); } catch (e) { return null; }
    }
    var s = String(v).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
        try { var d2 = new Date(s); return isNaN(d2.getTime()) ? null : d2.toISOString(); } catch (e) { return null; }
    }
    return null;
}

/* ── 收集器：rows（对象数组）、seen（去重表）、sources（计数）由闭包共享 ── */
function buildExport() {
    var rows = [];
    var seen = {};
    var sources = {};
    var errors = [];

    function push(source, id, createdAt, content, meta) {
        content = textOf(content);
        if (!content.trim()) return false;
        id = textOf(id).trim();
        if (!id) id = 'h-' + hashContent(source + '\n' + content);
        var key = source + '\n' + id;
        if (seen[key]) return false;
        seen[key] = true;
        meta = meta || {};
        meta.key = meta.key || '';
        rows.push({
            id: id,
            source: source,
            created_at: toISO(createdAt),
            content: content,
            meta: meta
        });
        sources[source] = (sources[source] || 0) + 1;
        return true;
    }
    function guard(name, fn) {
        try { fn(); } catch (e) { errors.push({ source: name, error: String((e && e.message) || e) }); }
    }

    /* ── 1. 归巢 + 剧本 ──
     * 剧本判定（任一命中即 script）：id 在 phone_script_memories_v1 引用里，
     * 或 category 为 'relationship'（js/07 保存时写的英文分类）/ '关系记忆'。
     * 引用还在但归巢条目已被删的，用引用里的 90 字摘要补一条，meta.truncated 标明。 */
    guard('guichao', function () {
        var mems = asArray(readJSON(MEM_KEY, []));
        var refs = asArray(readJSON(SCRIPT_REFS_KEY, []));
        var refById = {};
        refs.forEach(function (r) { if (r && r.id != null) refById[String(r.id)] = r; });
        mems.forEach(function (m) {
            if (!m || typeof m !== 'object') return;
            var content = textOf(m.content || m.text);
            if (!content.trim()) return;
            var cat = textOf(m.category);
            var ref = (m.id != null) ? refById[String(m.id)] : null;
            var isScript = !!ref || cat === 'relationship' || cat === '关系记忆';
            var meta = {
                key: MEM_KEY,
                category: cat || undefined,
                title: textOf(m.title) || undefined,
                factKey: textOf(m.factKey || m.fact_key) || undefined,
                recall: textOf(m.recall) || undefined,
                archived: !!m.archived
            };
            if (ref) {
                meta.scriptTitle = textOf(ref.scriptTitle) || undefined;
                meta.ending = textOf(ref.ending) || undefined;
                meta.affection = (typeof ref.affection === 'number') ? ref.affection : undefined;
                meta.scriptDate = textOf(ref.date) || undefined;
            }
            push(isScript ? 'script' : 'guichao', m.id, m.createdAt || m.created || m.updated || m.date, content, meta);
        });
        refs.forEach(function (r) {
            if (!r || r.id == null) return;
            if (mems.some(function (m) { return m && String(m.id) === String(r.id); })) return;
            var summary = textOf(r.summary);
            if (!summary.trim()) return;
            push('script', r.id, r.date, summary, {
                key: SCRIPT_REFS_KEY,
                truncated: true,
                scriptTitle: textOf(r.scriptTitle) || undefined,
                ending: textOf(r.ending) || undefined,
                affection: (typeof r.affection === 'number') ? r.affection : undefined,
                scriptDate: textOf(r.date) || undefined,
                note: '归巢里找不到这条全文（可能已在归巢里删掉），仅留剧本档案里的摘要'
            });
        });
    });

    /* ── 2. 日记 + 此刻（ck_diary_meta_v1 + cike_cache_v1 合并） ──
     * 优先复用手机自己的读法 OtomeF.diaryEntries（::beside 日记 + ::trip
     * 笔记），没有它时用同规则的内联合并。nightly 键（<角色>::nightly-
     * <YYYY-MM-DD>）diaryEntries 不处理，这里单独收，日记进 diary、trip
     * 笔记进 cike。ck_diary_settings 是设置不是记忆，不收。 */
    guard('diary', function () {
        var meta = asObject(readJSON(META_KEY, {}));
        var cache = asObject(readJSON(CACHE_KEY, {}));
        var merged = null;
        try {
            if (window.OtomeF && typeof window.OtomeF.diaryEntries === 'function') {
                merged = window.OtomeF.diaryEntries(meta, cache);
            }
        } catch (e) { merged = null; }
        if (!merged) merged = mergeDiary(meta, cache);
        (merged.diary || []).forEach(function (d) {
            if (!d || !textOf(d.text).trim()) return;
            push('diary', 'm:' + textOf(d.role) + ':' + textOf(d.date), null, d.text, {
                key: META_KEY,
                role: textOf(d.role) || undefined,
                date: textOf(d.date) || undefined,
                weather: textOf(d.weather) || undefined
            });
        });
        (merged.notes || []).forEach(function (n) {
            if (!n || !textOf(n.text).trim()) return;
            push('cike', 'n:' + textOf(n.role) + ':' + textOf(n.kind || 'trip'), null, n.text, {
                key: CACHE_KEY,
                kind: textOf(n.kind || 'trip'),
                role: textOf(n.role) || undefined
            });
        });
        /* nightly：meta 与 cache 里 <角色>::nightly-<YYYY-MM-DD> 的文本 */
        var nightlyKeys = {};
        Object.keys(meta).forEach(function (k) { var m = k.match(/::nightly-(\d{4}-\d{2}-\d{2})$/); if (m) nightlyKeys[k] = m[1]; });
        Object.keys(cache).forEach(function (k) { var m = k.match(/::nightly-(\d{4}-\d{2}-\d{2})$/); if (m && !nightlyKeys[k]) nightlyKeys[k] = m[1]; });
        Object.keys(nightlyKeys).forEach(function (k) {
            var role = k.slice(0, k.indexOf('::nightly-'));
            var date = nightlyKeys[k];
            var text = textOf(cache[k]);
            if (!text.trim()) return;
            var m0 = meta[k] || {};
            push('diary', 'n:' + role + ':' + date, date, text, {
                key: META_KEY,
                kind: 'nightly',
                role: role || undefined,
                date: textOf(m0.date) || date,
                weather: textOf(m0.weather) || undefined
            });
        });
        /* 手写日记 ck_diary_shelf_v1：{id, content/text, date, mood, createdAt} */
        asArray(readJSON(SHELF_KEY, [])).forEach(function (h) {
            if (!h || typeof h !== 'object') return;
            push('diary', 'h:' + textOf(h.id), h.createdAt || h.date, h.content || h.text, {
                key: SHELF_KEY,
                kind: 'hand',
                mood: textOf(h.mood) || undefined,
                date: textOf(h.date) || undefined
            });
        });
        /* 归巢日记 guichao.diaries.v1：仓库内无写入处，有则收，无则记 absent */
        asArray(readJSON(DIARIES_KEY, [])).forEach(function (d) {
            if (!d || typeof d !== 'object') return;
            push('diary', 'gd:' + textOf(d.id), d.createdAt || d.created || d.date, d.content || d.text, {
                key: DIARIES_KEY,
                title: textOf(d.title) || undefined,
                date: textOf(d.date) || undefined
            });
        });
        /* yuanFlipDiary：独立日记文件键，同源 localStorage 有才读得到 */
        asArray(readJSON(YUAN_KEY, [])).forEach(function (e) {
            if (!e || typeof e !== 'object') return;
            push('diary', 'y:' + textOf(e.id), e.date, e.content, {
                key: YUAN_KEY,
                title: textOf(e.title) || undefined,
                mood: textOf(e.mood) || undefined,
                signature: textOf(e.signature) || undefined,
                date: textOf(e.date) || undefined
            });
        });
    });

    /* ── 3. 世界书 ──
     * worldbook_global_v1 是主文件真实键（postMessage 同步的全量条目）；
     * wb_* 三键只在内嵌世界书文件同源时才读得到，读不到即 absent。
     * wb_whisper_v1（私语）绝不读；wb_last_injection_v1 可再生，不收。 */
    guard('worldbook', function () {
        asArray(readJSON(WB_KEY, [])).forEach(function (e) {
            if (!e || typeof e !== 'object') return;
            push('worldbook', 'wb:' + textOf(e.id), e.createdAt || e.created, e.content, {
                key: WB_KEY,
                kind: 'entry',
                title: textOf(e.title) || undefined,
                scope: textOf(e.scope) || undefined,
                char: textOf(e.char) || undefined,
                enabled: e.enabled !== false
            });
        });
        asArray(readJSON(WB_FOLDERS_KEY, [])).forEach(function (f) {
            if (!f || typeof f !== 'object') return;
            push('worldbook', 'wbf:' + textOf(f.id), null, f.name, {
                key: WB_FOLDERS_KEY,
                kind: 'folder'
            });
        });
        asArray(readJSON(WB_CHARS_KEY, [])).forEach(function (c) {
            var name = textOf((c && typeof c === 'object') ? (c.name || c.value) : c);
            if (!name.trim()) return;
            push('worldbook', 'wbc:' + hashContent(name), null, name, {
                key: WB_CHARS_KEY,
                kind: 'char'
            });
        });
        asArray(readJSON(WB_PRESETS_KEY, [])).forEach(function (p) {
            if (!p || typeof p !== 'object') return;
            var name = textOf(p.name) || '未命名预设';
            var count = (p.count != null) ? p.count : ((p.entries || []).length || 0);
            push('worldbook', 'wbp:' + textOf(p.id), p.created, '预设：' + name + '（' + count + ' 条规则）', {
                key: WB_PRESETS_KEY,
                kind: 'preset',
                name: name,
                entries: Array.isArray(p.entries) ? p.entries : undefined,
                created: textOf(p.created) || undefined
            });
        });
    });

    /* ── 4. 微信：只收长聊梗概（记忆类摘要），不倒原始聊天记录 ──
     * phone_wechat_store_v2 的 sessions/messages 是聊天记录本身，不是记忆，
     * 按方案走整屋备份文件，不逐条进 JSONL。 */
    guard('wechat', function () {
        asArray(readJSON(DIGEST_KEY, [])).forEach(function (d) {
            if (!d || typeof d !== 'object') return;
            push('wechat', 'dg:' + textOf(d.id), d.createdAt, d.text, {
                key: DIGEST_KEY,
                kind: 'digest',
                sid: textOf(d.sid) || undefined,
                name: textOf(d.name) || undefined
            });
        });
    });

    /* ── 5. 此刻：otome 好感 impressions（看法短记） ──
     * otome_affection_v1：{角色名: {value, impressions: [{text, date}]}} */
    guard('cike', function () {
        var all = asObject(readJSON(AFF_KEY, {}));
        Object.keys(all).forEach(function (charName) {
            var rec = all[charName] || {};
            var value = rec.value;
            (rec.impressions || []).forEach(function (im) {
                if (!im || !textOf(im.text).trim()) return;
                push('cike', 'ci:' + charName + ':' + hashContent(textOf(im.text) + '\n' + textOf(im.date)), im.date, im.text, {
                    key: AFF_KEY,
                    kind: 'impression',
                    char: charName,
                    affection: (typeof value === 'number') ? value : undefined,
                    date: textOf(im.date) || undefined
                });
            });
        });
    });

    /* 按 created_at 升序排成一条时间线；无日期的放最后（不编造顺序）。 */
    rows.sort(function (a, b) {
        if (a.created_at && b.created_at) return a.created_at < b.created_at ? -1 : (a.created_at > b.created_at ? 1 : 0);
        if (a.created_at) return -1;
        if (b.created_at) return 1;
        return 0;
    });
    var lines = rows.map(function (r) { return JSON.stringify(r); });
    return { lines: lines, count: lines.length, sources: sources, errors: errors };
}

/* 与手机日记读法 OtomeF.diaryEntries 同规则的内联合并（仅当 OtomeF
 * 不可用时兜底）：meta ::beside → 日记（文本取 cache 同键），cache ::trip
 * → 笔记。nightly 键不在这里处理，由收集函数单独收。 */
function mergeDiary(meta, cache) {
    meta = meta || {};
    cache = cache || {};
    var diary = [];
    var notes = [];
    Object.keys(meta).forEach(function (k) {
        if (k.slice(-'::beside'.length) !== '::beside') return;
        var role = k.slice(0, -'::beside'.length);
        var m = meta[k] || {};
        diary.push({ role: role, kind: 'diary', date: m.date || '未标注日期', weather: m.weather || '', text: cache[k] || '' });
    });
    Object.keys(cache).forEach(function (k) {
        if (k.slice(-'::beside'.length) !== '::beside' || !cache[k]) return;
        var already = diary.some(function (e) { return e.role + '::beside' === k; });
        if (!already) diary.push({ role: k.slice(0, -'::beside'.length), kind: 'diary', date: '未标注日期', weather: '', text: cache[k] });
    });
    Object.keys(cache).forEach(function (k) {
        if (k.slice(-'::trip'.length) === '::trip' && cache[k]) {
            notes.push({ role: k.slice(0, -'::trip'.length), kind: 'trip', date: '—', weather: '', text: cache[k] });
        }
    });
    return { diary: diary, notes: notes };
}

window.MemBackup = {
    version: '1.0.0',
    EXCLUDE_KEYS: EXCLUDE_KEYS,
    NOT_EXCLUDED_KEYS: NOT_EXCLUDED_KEYS,
    isExcludedKey: isExcludedKey,
    hashContent: hashContent,
    buildExport: buildExport
};

})();
