
/* GROUP-STEP0: 共享 IndexedDB 助手 window.XWLDB —— 全机唯一底座。
   日历（第 3 项）、unfold 小组件（第 5 项）、音频（第 1 项）、VRM 模型（第 21 项）
   共用这一份，不许各组各写一套。
   无 indexedDB 时（jsdom / SWEEP）全部方法解析为安全空值，加载与调用全程不抛错。 */
(function () {
    'use strict';
    var DB_NAME = 'xiaoweilai';
    var DB_VERSION = 1;
    /* GROUP-STEP0: 表定义。onupgradeneeded 里只创建缺失的表（幂等）。 */
    var STORES = {
        calendar_marks: { keyPath: 'id', indexes: [{ name: 'by_date', keyPath: 'date' }] },
        calendar_notes: { keyPath: 'date', indexes: [] },
        calendar_meta: { keyPath: 'key', indexes: [] },
        widget_assets: { keyPath: 'id', indexes: [] },
        audio_blobs: { keyPath: 'id', indexes: [{ name: 'by_work', keyPath: 'workId' }] },
        vrm_models: { keyPath: 'id', indexes: [] }
    };
    var STORE_NAMES = Object.keys(STORES);
    var AUDIO_BUDGET_DEFAULT = 10 * 1024 * 1024; /* GROUP-STEP0: 音频随备份导出的默认上限 10MB */

    function warn(msg, err) {
        try { if (typeof console !== 'undefined' && console.warn) console.warn(msg, err); } catch (e) {}
    }

    function hasIDB() {
        try { return typeof indexedDB !== 'undefined' && !!indexedDB && typeof indexedDB.open === 'function'; }
        catch (e) { return false; }
    }

    /* GROUP-STEP0: open() 返回缓存的 Promise，复用同一连接；打不开时解析为 null（不 reject），各方法按“无库”降级。 */
    var _openPromise = null;
    function open() {
        if (_openPromise) return _openPromise;
        _openPromise = new Promise(function (resolve) {
            if (!hasIDB()) { resolve(null); return; }
            var req;
            try { req = indexedDB.open(DB_NAME, DB_VERSION); }
            catch (e) { warn('[XWLDB] indexedDB.open 抛错，已降级为空操作', e); resolve(null); return; }
            req.onupgradeneeded = function (ev) {
                var db = ev.target.result;
                STORE_NAMES.forEach(function (name) {
                    if (db.objectStoreNames.contains(name)) return;
                    var def = STORES[name];
                    var store = db.createObjectStore(name, { keyPath: def.keyPath });
                    def.indexes.forEach(function (ix) { store.createIndex(ix.name, ix.keyPath, { unique: false }); });
                });
            };
            req.onsuccess = function (ev) { resolve(ev.target.result); };
            req.onerror = function (ev) { warn('[XWLDB] 打开数据库失败，已降级为空操作', ev.target && ev.target.error); resolve(null); };
            req.onblocked = function () { warn('[XWLDB] 打开数据库被阻塞（旧连接未关），已降级为空操作'); resolve(null); };
        });
        return _openPromise;
    }

    /* GROUP-STEP0: 在一张表上跑一个 IDBRequest。失败时 reject（公开方法会再映射为安全空值；exportDump/importDump 用它做严格计数）。 */
    function withStore(storeName, mode, fn) {
        return open().then(function (db) {
            if (!db) return undefined;
            return new Promise(function (resolve, reject) {
                var tx;
                try { tx = db.transaction(storeName, mode); }
                catch (e) { reject(e); return; }
                var req;
                try { req = fn(tx.objectStore(storeName)); }
                catch (e) { reject(e); return; }
                req.onsuccess = function (ev) { resolve(ev.target.result); };
                req.onerror = function (ev) { reject(ev.target.error || new Error('IndexedDB request failed')); };
                tx.onabort = function () { reject((tx && tx.error) || new Error('IndexedDB transaction aborted')); };
                tx.onerror = function (ev) { reject(ev.target.error || new Error('IndexedDB transaction failed')); };
            });
        });
    }

    function put(store, value) {
        if (!hasIDB()) return Promise.resolve(undefined);
        return withStore(store, 'readwrite', function (s) { return s.put(value); }).then(function (k) { return k; }, function () { return undefined; });
    }

    function get(store, key) {
        if (!hasIDB()) return Promise.resolve(undefined);
        return withStore(store, 'readonly', function (s) { return s.get(key); }).then(function (v) { return v; }, function () { return undefined; });
    }

    function getAll(store) {
        if (!hasIDB()) return Promise.resolve([]);
        return withStore(store, 'readonly', function (s) { return s.getAll(); }).then(function (v) { return v || []; }, function () { return []; });
    }

    function getAllByIndex(store, indexName, key) {
        if (!hasIDB()) return Promise.resolve([]);
        return withStore(store, 'readonly', function (s) {
            var ix = s.index(indexName);
            return (key === undefined) ? ix.getAll() : ix.getAll(key);
        }).then(function (v) { return v || []; }, function () { return []; });
    }

    function del(store, key) {
        if (!hasIDB()) return Promise.resolve(undefined);
        return withStore(store, 'readwrite', function (s) { return s.delete(key); }).then(function () { return undefined; }, function () { return undefined; });
    }

    function isBlob(v) {
        try { return typeof Blob !== 'undefined' && v instanceof Blob; } catch (e) { return false; }
    }

    /* GROUP-STEP0: Blob 转 base64。优先 arrayBuffer（任何 Blob 实现都可用），老环境回落 FileReader。 */
    function blobToBase64(blob) {
        if (blob && typeof blob.arrayBuffer === 'function') {
            return blob.arrayBuffer().then(function (ab) {
                var bytes = new Uint8Array(ab);
                var bin = '';
                var CHUNK = 8192;
                for (var i = 0; i < bytes.length; i += CHUNK) {
                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
                }
                return btoa(bin);
            });
        }
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var dataUrl = String(reader.result || '');
                var comma = dataUrl.indexOf(',');
                resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
            };
            reader.onerror = function () { reject(new Error('read blob failed')); };
            try { reader.readAsDataURL(blob); } catch (e) { reject(e); }
        });
    }

    function base64ToBlob(b64, mime) {
        var bin = atob(String(b64 || ''));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime || '' });
    }

    /* GROUP-STEP0: 记录顶层字段里的 Blob 转 {__xwl_blob, mime, size, base64}，其余字段原样。 */
    function encodeRecord(rec) {
        var out = {};
        var jobs = [];
        Object.keys(rec).forEach(function (k) {
            var v = rec[k];
            if (isBlob(v)) {
                jobs.push(blobToBase64(v).then(function (b64) {
                    out[k] = { __xwl_blob: true, mime: v.type || '', size: v.size || 0, base64: b64 };
                }));
            } else { out[k] = v; }
        });
        return Promise.all(jobs).then(function () { return out; });
    }

    function decodeRecord(rec) {
        var out = {};
        Object.keys(rec).forEach(function (k) {
            var v = rec[k];
            if (v && typeof v === 'object' && v.__xwl_blob === true && typeof v.base64 === 'string') {
                out[k] = base64ToBlob(v.base64, v.mime);
            } else { out[k] = v; }
        });
        return out;
    }

    /* GROUP-STEP0: 导出全部 6 张表。audio_blobs 超预算整表排除；vrm_models 只导元数据，blob 一律排除。 */
    function exportDump(opts) {
        opts = opts || {};
        var budget = (typeof opts.audioBudgetBytes === 'number' && opts.audioBudgetBytes >= 0) ? opts.audioBudgetBytes : AUDIO_BUDGET_DEFAULT;
        if (!hasIDB()) return Promise.resolve({ version: 1, stores: {}, excluded: [{ store: '*', reason: 'indexedDB 不可用' }] });
        return open().then(function (db) {
            if (!db) return { version: 1, stores: {}, excluded: [{ store: '*', reason: 'indexedDB 不可用' }] };
            var stores = {};
            var excluded = [];
            var chain = Promise.resolve();
            STORE_NAMES.forEach(function (name) {
                chain = chain.then(function () {
                    return withStore(name, 'readonly', function (s) { return s.getAll(); }).then(function (rows) {
                        rows = rows || [];
                        if (name === 'vrm_models') {
                            var hadBlob = false;
                            stores[name] = rows.map(function (r) {
                                if (r && isBlob(r.blob)) hadBlob = true;
                                return { id: r ? r.id : undefined, name: r ? r.name : undefined, source: r ? r.source : undefined, createdAt: r ? r.createdAt : undefined };
                            });
                            if (hadBlob) excluded.push({ store: 'vrm_models', reason: '模型文件（.vrm）体积大，不随备份导出，恢复后请重新导入模型文件' });
                            return;
                        }
                        if (name === 'audio_blobs') {
                            var total = 0;
                            rows.forEach(function (r) {
                                if (!r) return;
                                Object.keys(r).forEach(function (k) { if (isBlob(r[k])) total += (r[k].size || 0); });
                            });
                            if (total > budget) {
                                excluded.push({ store: 'audio_blobs', reason: '音频总计约 ' + (total / 1048576).toFixed(1) + ' MB，超过备份上限 ' + (budget / 1048576).toFixed(1) + ' MB，已整表排除' });
                                return;
                            }
                        }
                        return Promise.all(rows.map(function (r) { return encodeRecord(r || {}); })).then(function (encoded) { stores[name] = encoded; });
                    }).then(null, function (err) {
                        warn('[XWLDB] 导出表失败：' + name, err);
                        excluded.push({ store: name, reason: '读取失败，未导出' });
                    });
                });
            });
            return chain.then(function () { return { version: 1, stores: stores, excluded: excluded }; });
        });
    }

    /* GROUP-STEP0: 恢复备份块。base64 解回 Blob 后 put；未知表整表跳过记 skipped；单条失败记 errors，不抛错。 */
    function importDump(dump) {
        var result = { ok: 0, skipped: 0, errors: 0 };
        if (!dump || typeof dump !== 'object' || !dump.stores || typeof dump.stores !== 'object') return Promise.resolve(result);
        if (!hasIDB()) return Promise.resolve(result);
        var stores = dump.stores;
        var names = Object.keys(stores);
        if (dump.version !== undefined && dump.version !== 1) {
            names.forEach(function (n) {
                var rows = stores[n];
                result.skipped += (rows && rows.length) || 0;
            });
            return Promise.resolve(result);
        }
        return open().then(function (db) {
            if (!db) return result;
            var chain = Promise.resolve();
            names.forEach(function (name) {
                var rows = stores[name];
                if (!Array.isArray(rows)) { result.errors++; return; }
                if (!STORES.hasOwnProperty(name)) { result.skipped += rows.length; return; }
                rows.forEach(function (row) {
                    chain = chain.then(function () {
                        if (!row || typeof row !== 'object') { result.errors++; return; }
                        var decoded;
                        try { decoded = decodeRecord(row); }
                        catch (e) { result.errors++; return; }
                        return withStore(name, 'readwrite', function (s) { return s.put(decoded); }).then(function () { result.ok++; }, function () { result.errors++; });
                    });
                });
            });
            return chain.then(function () { return result; });
        });
    }

    window.XWLDB = {
        open: open,
        put: put,
        get: get,
        getAll: getAll,
        getAllByIndex: getAllByIndex,
        delete: del,
        exportDump: exportDump,
        importDump: importDump,
        DB_NAME: DB_NAME,
        DB_VERSION: DB_VERSION,
        STORES: STORE_NAMES.slice(),
        AUDIO_BUDGET_BYTES_DEFAULT: AUDIO_BUDGET_DEFAULT
    };
})();
