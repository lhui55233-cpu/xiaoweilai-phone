
var BQ_CSS_TEXT = "\n/* BQ typeset: reading-app typesetting editor, offline, no external assets */\n#bq-typeset-root{position:fixed;inset:0;z-index:9999;background:#f7f7f8;color:#25262a;\n  font-family:-apple-system,\"PingFang SC\",\"Microsoft YaHei\",sans-serif;display:none;\n  flex-direction:column;overflow:hidden}\n#bq-typeset-root.bq-open{display:flex}\n.bq-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;\n  border-bottom:1px solid #ececef;flex:none}\n.bq-back{border:1px solid #ececef;background:#fff;border-radius:16px;padding:6px 12px;\n  font-size:13px;font-weight:700;color:#25262a;cursor:pointer}\n.bq-bar-title{font-size:15px;font-weight:800;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.bq-saved{font-size:11px;color:#8a8f98;white-space:nowrap}\n.bq-body{flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}\n.bq-btn{border:1px solid #d8d8de;background:#fff;border-radius:10px;padding:8px 12px;\n  font-size:13px;font-weight:700;color:#25262a;cursor:pointer}\n.bq-btn-primary{background:#34363b;color:#fff;border-color:#34363b}\n.bq-btn-danger{color:#c0392b;border-color:#e5b8b0}\n.bq-empty{margin:48px 16px;text-align:center;color:#8a8f98;font-size:14px;line-height:2}\n.bq-doc-row{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #ececef;\n  border-radius:12px;padding:12px;margin-bottom:8px}\n.bq-doc-row .bq-doc-meta{flex:1;min-width:0}\n.bq-doc-row .bq-doc-name{font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.bq-doc-row .bq-doc-sub{font-size:11px;color:#8a8f98;margin-top:2px}\n.bq-mini-btn{border:1px solid #ececef;background:#fff;border-radius:8px;padding:5px 8px;\n  font-size:12px;cursor:pointer;color:#25262a}\n.bq-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}\n.bq-panel{background:#fff;border:1px solid #ececef;border-radius:12px;padding:12px;margin-bottom:10px}\n.bq-panel summary{font-size:13px;font-weight:800;cursor:pointer}\n.bq-ctl-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0;font-size:12px}\n.bq-ctl-row label{font-weight:700;color:#555}\n.bq-ctl-row input[type=number]{width:56px;padding:4px 6px;border:1px solid #d8d8de;border-radius:8px;font-size:12px}\n.bq-ctl-row input[type=range]{flex:1;min-width:120px}\n.bq-ctl-row select{padding:4px 6px;border:1px solid #d8d8de;border-radius:8px;font-size:12px}\n.bq-seg{display:inline-flex;border:1px solid #d8d8de;border-radius:9px;overflow:hidden}\n.bq-seg button{border:0;background:#fff;padding:6px 10px;font-size:12px;cursor:pointer;color:#25262a}\n.bq-seg button.bq-on{background:#34363b;color:#fff}\n.bq-page{margin:0 auto;background:#fff;border:1px solid #ececef;border-radius:4px;\n  box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden}\n.bq-page-inner{overflow-wrap:break-word}\n.bq-page-inner.bq-vertical{writing-mode:vertical-rl;direction:ltr;height:62vh;overflow-x:auto;overflow-y:hidden}\n.bq-block{position:relative;border:1px dashed transparent;border-radius:6px;padding:2px 4px}\n.bq-block:hover{border-color:#d8d8de}\n.bq-block-bar{display:flex;align-items:center;gap:4px;font-size:11px;color:#8a8f98;\n  background:#f7f7f8;border-radius:6px;padding:2px 4px;margin-bottom:2px}\n.bq-block-bar .bq-handle{cursor:grab;touch-action:none}\n.bq-block-bar input[type=number]{width:44px;padding:2px 4px;border:1px solid #d8d8de;border-radius:6px;font-size:11px}\n.bq-block-text{outline:none;min-height:1em}\n.bq-block-text:focus{background:#fffbe6}\n.bq-quote{border-left:3px solid #9a9aa2;padding-left:10px;font-style:italic;color:#555}\n.bq-note{font-size:.82em;color:#8a8f98}\n.bq-note::before{content:\"注：\";font-weight:700}\n.bq-hr{border:0;border-top:1px solid #c9c9cf;margin:10px 0}\n.bq-ornament{text-align:center;color:#8a8f98;font-size:18px;margin:8px 0}\n.bq-imgwrap{text-align:center}\n.bq-imgwrap img{max-width:100%;height:auto;display:inline-block}\n.bq-imgwrap.bq-float-left{float:left;margin:0 12px 8px 0}\n.bq-imgwrap.bq-float-right{float:right;margin:0 0 8px 12px}\n.bq-imgwrap.bq-vertical-fix{writing-mode:horizontal-tb}\n.bq-caption{font-size:12px;color:#8a8f98;text-align:center;margin-top:4px}\n.bq-img-ph{border:1px dashed #c9c9cf;border-radius:8px;padding:18px 10px;color:#8a8f98;\n  font-size:12px;text-align:center;background:#fafafa}\n.bq-paper-cream{background-color:#f7f2e7!important}\n.bq-paper-kraft{background-color:#e8d9b8!important;\n  background-image:repeating-linear-gradient(0deg,rgba(120,90,40,.05) 0 1px,transparent 1px 5px)!important}\n.bq-paper-dark{background-color:#1e1e24!important;color:#e8e8ea!important}\n.bq-paper-dark .bq-quote{border-color:#888;color:#cfcfd6}\n.bq-paper-dark .bq-note{color:#a9a9b2}\n.bq-paper-grid{background-color:#fff!important;\n  background-image:linear-gradient(rgba(90,120,200,.12) 1px,transparent 1px),\n  linear-gradient(90deg,rgba(90,120,200,.12) 1px,transparent 1px)!important;\n  background-size:24px 24px!important}\n.bq-paper-dots{background-color:#fff!important;\n  background-image:radial-gradient(rgba(90,90,120,.28) 1.2px,transparent 1.3px)!important;\n  background-size:18px 18px!important}\n.bq-style-photo .bq-imgwrap{width:100%!important;margin-left:0!important;margin-right:0!important;float:none!important}\n.bq-import-item{border:1px solid #ececef;border-radius:8px;padding:8px 10px;margin-bottom:6px;\n  font-size:13px;background:#fff}\n.bq-import-item .bq-kind{font-size:11px;color:#8a8f98;margin-right:6px}\n.bq-warn{color:#9a6a00;background:#fff8e1;border:1px solid #f0d9a0;border-radius:8px;\n  padding:8px 10px;font-size:12px;line-height:1.7;margin-bottom:8px}\n.bq-title-input{flex:1;min-width:0;border:1px solid #ececef;border-radius:8px;padding:6px 8px;font-size:14px;font-weight:700}\n";

/* GROUP-BQ · 阅读 app 文字排版器（本地离线；新键 reader_typeset_v1；与书架的书分开） */
(function () {
  'use strict';
  var MARK = 'GROUP-BQ';
  var KEY = 'reader_typeset_v1';
  var MAX_IMG = 2 * 1024 * 1024;          /* 单图建议 2MB 以内 */
  var MAX_PNG_H = 10000;                  /* 长图单张输出高度上限（px，含缩放） */
  var SAVE_DELAY = 500;                   /* 自动保存：最后一次编辑后约 500ms 落盘 */
  var FONT_STACKS = {
    serif: "Georgia,'Songti SC','STSong','SimSun',serif",
    sans: "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif",
    mono: "ui-monospace,Menlo,Consolas,monospace",
    round: "'Yuanti SC','PingFang SC','Microsoft YaHei',sans-serif"
  };
  var PAPER_SIZES = { A4: [210, 297], A5: [148, 210], B5: [176, 250], Letter: [216, 279] };
  var BLOCK_LABELS = { h1: '标题一', h2: '标题二', h3: '标题三', p: '正文', quote: '引用', note: '注释', hr: '分隔线', img: '图片' };
  var PRESETS = {
    magazine: { font: 'sans', paper: 'white', pageWidth: 600, margins: { t: 32, b: 32, l: 24, r: 24 },
      defaults: { h1: { size: 34, lh: 1.2, ls: 1 }, h2: { size: 26, lh: 1.3, ls: 0 }, h3: { size: 20, lh: 1.4, ls: 0 },
        p: { size: 17, lh: 1.8, ls: 0 }, quote: { size: 19, lh: 1.6, ls: 0 }, note: { size: 13, lh: 1.6, ls: 0 } } },
    minimal: { font: 'sans', paper: 'white', pageWidth: 520, margins: { t: 48, b: 48, l: 32, r: 32 },
      defaults: { h1: { size: 24, lh: 1.4, ls: 2 }, h2: { size: 20, lh: 1.4, ls: 1 }, h3: { size: 17, lh: 1.5, ls: 1 },
        p: { size: 15, lh: 2.0, ls: 1 }, quote: { size: 15, lh: 1.9, ls: 0 }, note: { size: 12, lh: 1.7, ls: 0 } } },
    literary: { font: 'serif', paper: 'cream', pageWidth: 560, margins: { t: 36, b: 36, l: 28, r: 28 },
      defaults: { h1: { size: 30, lh: 1.5, ls: 2 }, h2: { size: 24, lh: 1.5, ls: 1 }, h3: { size: 19, lh: 1.6, ls: 1 },
        p: { size: 17, lh: 2.1, ls: 0.5 }, quote: { size: 16, lh: 2.0, ls: 0 }, note: { size: 13, lh: 1.8, ls: 0 } } },
    photo: { font: 'sans', paper: 'white', pageWidth: 640, margins: { t: 24, b: 24, l: 12, r: 12 },
      defaults: { h1: { size: 26, lh: 1.3, ls: 1 }, h2: { size: 21, lh: 1.35, ls: 0 }, h3: { size: 18, lh: 1.4, ls: 0 },
        p: { size: 16, lh: 1.7, ls: 0 }, quote: { size: 16, lh: 1.7, ls: 0 }, note: { size: 12, lh: 1.6, ls: 0 } } }
  };

  function uid() { return 'bq' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowHHMM() { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return p(d.getHours()) + ':' + p(d.getMinutes()); }
  function num(v, dflt, lo, hi) { var n = parseFloat(v); if (isNaN(n)) return dflt; return Math.max(lo, Math.min(hi, n)); }

  function defaultSettings() {
    return { font: 'sans', style: 'minimal', direction: 'h', paper: 'white', pageWidth: 560,
      margins: { t: 24, b: 24, l: 20, r: 20 }, paperSize: 'A4', scale: 2,
      defaults: { h1: { size: 28, lh: 1.3, ls: 0 }, h2: { size: 24, lh: 1.35, ls: 0 }, h3: { size: 20, lh: 1.4, ls: 0 },
        p: { size: 17, lh: 1.8, ls: 0 }, quote: { size: 16, lh: 1.7, ls: 0 }, note: { size: 13, lh: 1.6, ls: 0 } } };
  }
  function newDoc(title) {
    var t = Date.now();
    return { id: uid(), title: title || '未命名文档', createdAt: t, updatedAt: t,
      settings: defaultSettings(), blocks: [] };
  }
  function defaultBlock(type) {
    var b = { id: uid(), type: type, text: '', ov: {} };
    if (type === 'h1') b.text = '标题';
    if (type === 'h2') b.text = '小标题';
    if (type === 'h3') b.text = '小节标题';
    if (type === 'p') b.text = '在这里写正文…';
    if (type === 'quote') b.text = '引用的文字…';
    if (type === 'note') b.text = '注释写在这里。';
    if (type === 'img') { b.src = ''; b.caption = ''; b.width = 100; b.radius = 8; b.align = 'center'; b.float = 'none'; b.ratio = 0.66; }
    return b;
  }

  /* ── 存储（只读写 reader_typeset_v1；相册两键只读）── */
  var _store = null;
  function load() {
    if (_store) return _store;
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) {}
    if (raw) { try { var d = JSON.parse(raw); if (d && Array.isArray(d.docs)) { _store = d; return _store; } } catch (e) {} }
    _store = { docs: [] };
    return _store;
  }
  function _reloadFromStorage() { _store = null; return load(); }
  function saveNow() {
    load();
    try { window.localStorage.setItem(KEY, JSON.stringify(_store)); } catch (e) {
      try { alert('保存失败：本地存储空间不足，请删掉一些大图再试。'); } catch (e2) {}
      return false;
    }
    _lastSavedAt = nowHHMM();
    var lab = document.getElementById('bq-saved-label');
    if (lab) lab.textContent = '已保存 ' + _lastSavedAt;
    return true;
  }
  var _saveTimer = null, _lastSavedAt = '';
  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () { _saveTimer = null; saveNow(); }, SAVE_DELAY);
  }
  function getDoc(id) { var ds = load().docs; for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return ds[i]; return null; }
  function listDocs() { return load().docs.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }); }
  function touch(doc) { doc.updatedAt = Date.now(); }
  function createDoc(title) { var d = newDoc(title); load().docs.push(d); saveNow(); return d; }
  function renameDoc(id, title) {
    var d = getDoc(id); if (!d) return false;
    d.title = String(title || '').trim() || '未命名文档'; touch(d); saveNow(); return true;
  }
  function duplicateDoc(id) {
    var d = getDoc(id); if (!d) return null;
    var c = clone(d); c.id = uid(); c.title = d.title + '（副本）'; c.createdAt = Date.now(); touch(c);
    c.blocks.forEach(function (b) { b.id = uid(); });
    load().docs.push(c); saveNow(); return c;
  }
  function deleteDoc(id) {
    var st = load(); var before = st.docs.length;
    st.docs = st.docs.filter(function (d) { return d.id !== id; });
    if (st.docs.length === before) return false;
    saveNow(); return true;
  }

  /* ── 块操作 ── */
  function addBlock(docId, type) {
    var d = getDoc(docId); if (!d) return null;
    var b = defaultBlock(type); d.blocks.push(b); touch(d); scheduleSave(); return b;
  }
  function addImageBlock(docId, src, caption) {
    var d = getDoc(docId); if (!d || !src) return null;
    var b = defaultBlock('img'); b.src = src; b.caption = caption || '';
    d.blocks.push(b); touch(d); scheduleSave(); return b;
  }
  function getBlock(doc, bid) { for (var i = 0; i < doc.blocks.length; i++) if (doc.blocks[i].id === bid) return doc.blocks[i]; return null; }
  function setBlockText(docId, bid, text) {
    var d = getDoc(docId); if (!d) return false; var b = getBlock(d, bid); if (!b) return false;
    b.text = String(text == null ? '' : text); touch(d); scheduleSave(); return true;
  }
  function setBlockField(docId, bid, field, value) {
    var d = getDoc(docId); if (!d) return false; var b = getBlock(d, bid); if (!b) return false;
    if (field === 'caption') b.caption = String(value || '');
    else if (field === 'width') b.width = num(value, 100, 40, 100);
    else if (field === 'radius') b.radius = num(value, 8, 0, 24);
    else if (field === 'align') b.align = ['left', 'center', 'right'].indexOf(value) >= 0 ? value : 'center';
    else if (field === 'float') b.float = ['none', 'left', 'right'].indexOf(value) >= 0 ? value : 'none';
    else if (field === 'ratio') b.ratio = num(value, 0.66, 0.1, 3);
    else if (field === 'size' || field === 'lh' || field === 'ls') {
      if (value === '' || value == null) delete b.ov[field];
      else b.ov[field] = num(value, 0, 0, 100);
    } else return false;
    touch(d); scheduleSave(); return true;
  }
  function moveBlock(docId, bid, dir) {
    var d = getDoc(docId); if (!d) return false;
    var i = -1; for (var k = 0; k < d.blocks.length; k++) if (d.blocks[k].id === bid) i = k;
    if (i < 0) return false;
    var j = i + dir; if (j < 0 || j >= d.blocks.length) return false;
    var tmp = d.blocks[i]; d.blocks[i] = d.blocks[j]; d.blocks[j] = tmp;
    touch(d); scheduleSave(); return true;
  }
  function removeBlock(docId, bid) {
    var d = getDoc(docId); if (!d) return false; var before = d.blocks.length;
    d.blocks = d.blocks.filter(function (b) { return b.id !== bid; });
    if (d.blocks.length === before) return false;
    touch(d); scheduleSave(); return true;
  }
  function duplicateBlock(docId, bid) {
    var d = getDoc(docId); if (!d) return null;
    for (var i = 0; i < d.blocks.length; i++) if (d.blocks[i].id === bid) {
      var c = clone(d.blocks[i]); c.id = uid(); d.blocks.splice(i + 1, 0, c);
      touch(d); scheduleSave(); return c;
    }
    return null;
  }

  /* ── 文档级设置 ── */
  function applyStyle(docId, name) {
    var d = getDoc(docId); if (!d || !PRESETS[name]) return false;
    var p = clone(PRESETS[name]);
    d.settings.font = p.font; d.settings.paper = p.paper; d.settings.pageWidth = p.pageWidth;
    d.settings.margins = p.margins; d.settings.defaults = p.defaults; d.settings.style = name;
    touch(d); scheduleSave(); return true;
  }
  function setDocSetting(docId, path, value) {
    var d = getDoc(docId); if (!d) return false; var s = d.settings;
    if (path === 'font') s.font = ['serif', 'sans', 'mono', 'round'].indexOf(value) >= 0 ? value : 'sans';
    else if (path === 'direction') s.direction = value === 'v' ? 'v' : 'h';
    else if (path === 'paper') s.paper = ['white', 'cream', 'kraft', 'dark', 'grid', 'dots'].indexOf(value) >= 0 ? value : 'white';
    else if (path === 'pageWidth') s.pageWidth = num(value, 560, 320, 800);
    else if (path === 'paperSize') s.paperSize = PAPER_SIZES[value] ? value : 'A4';
    else if (path === 'scale') s.scale = [1, 2, 3].indexOf(Number(value)) >= 0 ? Number(value) : 2;
    else if (path.indexOf('margin.') === 0) s.margins[path.slice(7)] = num(value, 20, 0, 120);
    else if (path.indexOf('default.') === 0) {
      var parts = path.split('.'); /* default.<type>.<field> */
      if (s.defaults[parts[1]]) s.defaults[parts[1]][parts[2]] = num(value, 0, 0, 100);
      else return false;
    } else return false;
    touch(d); scheduleSave(); return true;
  }
  function setDocTitle(docId, title) {
    var d = getDoc(docId); if (!d) return false;
    d.title = String(title || '').trim() || '未命名文档'; touch(d); scheduleSave(); return true;
  }

  /* ── Markdown / TXT 导入（纯函数；外链图不热链，留占位块并计数）── */
  function parseMarkdown(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var blocks = [], external = 0, para = [];
    function isCJK(ch) { return ch && /[\u3400-\u9fff]/.test(ch); }
    function flushPara() {
      if (!para.length) return;
      var joined = para[0];
      for (var i = 1; i < para.length; i++) {
        var prev = joined.slice(-1), next = para[i].charAt(0);
        joined += (isCJK(prev) || isCJK(next)) ? para[i] : ' ' + para[i];
      }
      blocks.push({ id: uid(), type: 'p', text: joined, ov: {} });
      para = [];
    }
    function flushQuote(q) { if (q.length) blocks.push({ id: uid(), type: 'quote', text: q.join(' '), ov: {} }); }
    var quoteBuf = [];
    lines.forEach(function (line) {
      var m;
      if ((m = line.match(/^#{1,3}\s+(.*)$/))) { flushPara(); flushQuote(quoteBuf); quoteBuf = []; blocks.push({ id: uid(), type: m[0].indexOf('###') === 0 ? 'h3' : (m[0].indexOf('##') === 0 ? 'h2' : 'h1'), text: m[1].trim(), ov: {} }); return; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); quoteBuf.push(m[1].trim()); return; }
      if (/^\s*---+\s*$/.test(line)) { flushPara(); flushQuote(quoteBuf); quoteBuf = []; blocks.push({ id: uid(), type: 'hr', text: '', ov: {} }); return; }
      if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) {
        flushPara(); flushQuote(quoteBuf); quoteBuf = [];
        var alt = m[1] || '图片', src = m[2].trim();
        if (src.indexOf('data:') === 0) { var b = defaultBlock('img'); b.src = src; b.caption = alt; blocks.push(b); }
        else { external++; var ph = defaultBlock('img'); ph.src = ''; ph.caption = alt; ph.placeholder = true; ph.extSrc = src; blocks.push(ph); }
        return;
      }
      if (/^\s*$/.test(line)) { flushPara(); flushQuote(quoteBuf); quoteBuf = []; return; }
      flushQuote(quoteBuf); quoteBuf = [];
      para.push(line.trim());
    });
    flushPara(); flushQuote(quoteBuf);
    return { blocks: blocks, external: external, dropped: [] };
  }

  /* ── 导出（纯函数；返回字符串；不静默丢内容）── */
  function blockStyle(doc, b) {
    var def = doc.settings.defaults[b.type] || doc.settings.defaults.p || { size: 17, lh: 1.8, ls: 0 };
    var size = (b.ov && b.ov.size) || def.size, lh = (b.ov && b.ov.lh) || def.lh, ls = (b.ov && b.ov.ls) || def.ls;
    return 'font-size:' + size + 'px;line-height:' + lh + ';letter-spacing:' + ls + 'px;';
  }
  function blockInnerHTML(doc, b) {
    var st = blockStyle(doc, b);
    if (b.type === 'h1') return '<h1 style="' + st + 'margin:.4em 0;font-weight:800;">' + esc(b.text) + '</h1>';
    if (b.type === 'h2') return '<h2 style="' + st + 'margin:.5em 0;font-weight:700;">' + esc(b.text) + '</h2>';
    if (b.type === 'h3') return '<h3 style="' + st + 'margin:.5em 0;font-weight:700;">' + esc(b.text) + '</h3>';
    if (b.type === 'quote') return '<blockquote style="' + st + 'border-left:3px solid #9a9aa2;padding-left:12px;font-style:italic;color:#555;margin:.8em 0;">' + esc(b.text) + '</blockquote>';
    if (b.type === 'note') return '<p style="' + st + 'color:#8a8f98;margin:.5em 0;">注：' + esc(b.text) + '</p>';
    if (b.type === 'hr') {
      if (doc.settings.style === 'literary') return '<p style="text-align:center;color:#8a8f98;font-size:18px;margin:10px 0;">❦</p>';
      return '<hr style="border:0;border-top:1px solid #c9c9cf;margin:14px 0;" />';
    }
    if (b.type === 'img') {
      var wrap = 'text-align:' + (b.align || 'center') + ';margin:10px 0;';
      if (b.float === 'left') wrap = 'float:left;margin:0 12px 8px 0;width:' + (b.width || 100) + '%;';
      if (b.float === 'right') wrap = 'float:right;margin:0 0 8px 12px;width:' + (b.width || 100) + '%;';
      var inner;
      if (b.src) inner = '<img src="' + b.src + '" alt="' + esc(b.caption || '') + '" style="width:' + (b.float === 'none' ? (b.width || 100) : 100) + '%;border-radius:' + (b.radius || 0) + 'px;display:block;" />';
      else inner = '<div style="border:1px dashed #c9c9cf;border-radius:8px;padding:18px 10px;color:#8a8f98;font-size:12px;text-align:center;">图片占位：' + esc(b.caption || '图片') + '（外链图片未导入，请重新上传）</div>';
      var cap = b.caption ? '<div style="font-size:12px;color:#8a8f98;text-align:center;margin-top:4px;">' + esc(b.caption) + '</div>' : '';
      return '<div style="' + wrap + '">' + inner + cap + '</div>';
    }
    return '<p style="' + st + 'margin:.6em 0;">' + esc(b.text) + '</p>';
  }
  function pageBgStyle(doc) {
    var s = doc.settings;
    if (s.paper === 'cream') return 'background:#f7f2e7;';
    if (s.paper === 'kraft') return 'background:#e8d9b8;';
    if (s.paper === 'dark') return 'background:#1e1e24;color:#e8e8ea;';
    if (s.paper === 'grid') return 'background:#fff;background-image:linear-gradient(rgba(90,120,200,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(90,120,200,.12) 1px,transparent 1px);background-size:24px 24px;';
    if (s.paper === 'dots') return 'background:#fff;background-image:radial-gradient(rgba(90,90,120,.28) 1.2px,transparent 1.3px);background-size:18px 18px;';
    return 'background:#fff;';
  }
  function buildExportHTML(doc) {
    var s = doc.settings;
    var ps = PAPER_SIZES[s.paperSize] || PAPER_SIZES.A4;
    var body = doc.blocks.map(function (b) { return blockInnerHTML(doc, b); }).join('\n');
    var dir = s.direction === 'v' ? 'writing-mode:vertical-rl;height:90vh;' : '';
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1" />\n<title>' + esc(doc.title) + '</title>\n' +
      '<style>body{margin:0;font-family:' + FONT_STACKS[s.font] + ';' + pageBgStyle(doc) + '}article{max-width:' + s.pageWidth + 'px;margin:0 auto;padding:' + s.margins.t + 'px ' + s.margins.r + 'px ' + s.margins.b + 'px ' + s.margins.l + 'px;' + dir + '}img{max-width:100%}</style>\n' +
      '</head>\n<body>\n<!-- 由“小未来的手机”文字排版器导出；纸张 ' + s.paperSize + ' ' + ps[0] + '×' + ps[1] + 'mm；离线可打开 -->\n<article>\n' + body + '\n</article>\n</body>\n</html>';
  }
  function blocksToMarkdown(doc) {
    return doc.blocks.map(function (b) {
      if (b.type === 'h1') return '# ' + b.text;
      if (b.type === 'h2') return '## ' + b.text;
      if (b.type === 'h3') return '### ' + b.text;
      if (b.type === 'quote') return '> ' + b.text;
      if (b.type === 'note') return '> 注：' + b.text;
      if (b.type === 'hr') return '---';
      if (b.type === 'img') return b.src ? '![' + (b.caption || '图片') + '](本地图片）' : '![' + (b.caption || '图片') + '](' + (b.extSrc || '外链图片，需重新上传') + ')';
      return b.text;
    }).join('\n\n');
  }
  function blocksToText(doc) {
    return doc.blocks.map(function (b) {
      if (b.type === 'hr') return '———';
      if (b.type === 'img') return '[图片：' + (b.caption || '图片') + ']';
      if (b.type === 'note') return '注：' + b.text;
      return b.text;
    }).join('\n\n');
  }

  /* ── 长图 PNG：估算高度 → 分段 → SVG foreignObject ── */
  function estimateBlockH(doc, b) {
    var s = doc.settings, def = s.defaults[b.type] || s.defaults.p;
    var cw = Math.max(120, s.pageWidth - s.margins.l - s.margins.r);
    var size = (b.ov && b.ov.size) || def.size, lh = (b.ov && b.ov.lh) || def.lh;
    var cpl = Math.max(8, Math.floor(cw / (size * 0.95)));
    var lines = Math.max(1, Math.ceil(String(b.text || '').length / cpl));
    if (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') return Math.ceil(size * lh) + 18;
    if (b.type === 'hr') return 28;
    if (b.type === 'img') return Math.ceil(cw * ((b.width || 100) / 100) * (b.ratio || 0.66)) + (b.caption ? 24 : 0) + 16;
    return Math.ceil(lines * size * lh) + 12;
  }
  function buildPngSegments(doc, scale) {
    var s = doc.settings, sc = scale || s.scale || 2;
    var maxH = Math.floor(MAX_PNG_H / sc);
    var segs = [], cur = [], curH = s.margins.t + s.margins.b;
    doc.blocks.forEach(function (b) {
      var h = estimateBlockH(doc, b);
      if (cur.length && curH + h > maxH) { segs.push(cur); cur = []; curH = s.margins.t + s.margins.b; }
      cur.push(b); curH += h;
    });
    if (cur.length) segs.push(cur);
    if (!segs.length) segs.push([]);
    return { segments: segs, scale: sc, maxH: maxH };
  }
  function buildLongImageSVG(doc, scale, segBlocks) {
    var s = doc.settings, sc = scale || s.scale || 2;
    var w = s.pageWidth, h = s.margins.t + s.margins.b;
    segBlocks.forEach(function (b) { h += estimateBlockH(doc, b); });
    var inner = segBlocks.map(function (b) { return blockInnerHTML(doc, b); }).join('');
    var dir = s.direction === 'v' ? 'writing-mode:vertical-rl;' : '';
    var html = '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;' + pageBgStyle(doc) +
      'font-family:' + FONT_STACKS[s.font] + ';color:' + (s.paper === 'dark' ? '#e8e8ea' : '#25262a') +
      ';padding:' + s.margins.t + 'px ' + s.margins.r + 'px ' + s.margins.b + 'px ' + s.margins.l + 'px;' + dir +
      'box-sizing:border-box;">' + inner + '</div>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w * sc) + '" height="' + (h * sc) + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' + html + '</foreignObject></svg>';
    return { svg: svg, width: w * sc, height: h * sc, segHeight: h, scale: sc };
  }
  function exportLongPng(docId, opts) {
    var d = getDoc(docId); if (!d) return Promise.resolve({ ok: false, reason: 'no_doc' });
    var sc = (opts && opts.scale) || d.settings.scale || 2;
    var plan = buildPngSegments(d, sc);
    var first = buildLongImageSVG(d, sc, plan.segments[0] || []);
    var canvasOk = false;
    try { var cv = document.createElement('canvas'); canvasOk = !!(cv && cv.getContext && cv.getContext('2d')); } catch (e) {}
    if (!canvasOk) {
      /* jsdom / 无 canvas 环境：不伪造成功，如实返回 SVG 与分段计划 */
      return Promise.resolve({ ok: false, reason: 'canvas_unavailable', segments: plan.segments.length, scale: sc, svg: first.svg, width: first.width, height: first.height });
    }
    var jobs = plan.segments.map(function (seg, idx) {
      var one = buildLongImageSVG(d, sc, seg);
      return new Promise(function (resolve) {
        var img = new Image();
        var url = null;
        try { url = URL.createObjectURL(new Blob([one.svg], { type: 'image/svg+xml;charset=utf-8' })); } catch (e) { resolve({ ok: false, reason: 'blob_unavailable' }); return; }
        img.onload = function () {
          try {
            var c = document.createElement('canvas'); c.width = one.width; c.height = one.height;
            var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, one.width, one.height);
            if (URL.revokeObjectURL) URL.revokeObjectURL(url);
            c.toBlob(function (blob) {
              if (!blob) { resolve({ ok: false, reason: 'toBlob_failed' }); return; }
              downloadBlob(d.title + (plan.segments.length > 1 ? '_长图' + (idx + 1) : '_长图') + '.png', blob);
              resolve({ ok: true, width: one.width, height: one.height });
            }, 'image/png');
          } catch (e) { resolve({ ok: false, reason: 'render_failed' }); }
        };
        img.onerror = function () { resolve({ ok: false, reason: 'svg_load_failed' }); };
        img.src = url;
      });
    });
    return Promise.all(jobs).then(function (rs) {
      var okN = rs.filter(function (r) { return r.ok; }).length;
      return { ok: okN === rs.length, segments: plan.segments.length, scale: sc, results: rs };
    });
  }

  /* ── 下载（无 Blob/URL 环境时把内容留在 _lastExport 供检查，不谎报已下载）── */
  var _lastExport = null;
  function downloadBlob(filename, blob) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
      return true;
    } catch (e) { return false; }
  }
  function downloadText(filename, content, mime) {
    _lastExport = { filename: filename, content: content, mime: mime || 'text/plain' };
    try {
      var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      return downloadBlob(filename, blob);
    } catch (e) { return false; }
  }
  function exportDoc(docId, kind) {
    var d = getDoc(docId); if (!d) return null;
    var base = (d.title || '未命名文档').replace(/[\\/:*?"<>|]/g, '_');
    if (kind === 'html') { var h = buildExportHTML(d); downloadText(base + '.html', h, 'text/html;charset=utf-8'); return { filename: base + '.html', content: h }; }
    if (kind === 'md') { var m = blocksToMarkdown(d); downloadText(base + '.md', m, 'text/markdown;charset=utf-8'); return { filename: base + '.md', content: m }; }
    var t = blocksToText(d); downloadText(base + '.txt', t, 'text/plain;charset=utf-8');
    return { filename: base + '.txt', content: t };
  }

  /* ── 图片：上传压缩 / 从相册选 ── */
  function compressImage(dataUrl) {
    if (!dataUrl) return Promise.resolve({ ok: false, reason: 'empty' });
    if (dataUrl.length <= MAX_IMG) return Promise.resolve({ ok: true, src: dataUrl, compressed: false });
    return new Promise(function (resolve) {
      var done = false;
      function fin(r) { if (!done) { done = true; resolve(r); } }
      setTimeout(function () { fin({ ok: false, reason: 'compress_unavailable' }); }, 1500);
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var maxSide = 1200, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            if (!w || !h) { fin({ ok: false, reason: 'compress_unavailable' }); return; }
            var k = Math.min(1, maxSide / Math.max(w, h));
            var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
            var ctx = cv.getContext('2d'); if (!ctx) { fin({ ok: false, reason: 'compress_unavailable' }); return; }
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            var out = cv.toDataURL('image/jpeg', 0.85);
            if (out.length > MAX_IMG) fin({ ok: false, reason: 'too_large', size: out.length });
            else fin({ ok: true, src: out, compressed: true, ratio: (w && h) ? h / w : 0.66 });
          } catch (e) { fin({ ok: false, reason: 'compress_unavailable' }); }
        };
        img.onerror = function () { fin({ ok: false, reason: 'compress_unavailable' }); };
        img.src = dataUrl;
      } catch (e) { fin({ ok: false, reason: 'compress_unavailable' }); }
    });
  }
  function albumImages() {
    var out = [];
    ['phone_album_local_v1', 'cike_album_v1'].forEach(function (k) {
      try {
        var arr = JSON.parse(window.localStorage.getItem(k) || 'null');
        if (!Array.isArray(arr)) return;
        arr.forEach(function (it, i) {
          var src = null;
          if (typeof it === 'string') src = it;
          else if (it && typeof it === 'object') src = it.src || it.url || it.img || it.data || it.thumb || null;
          if (src && String(src).indexOf('data:image') === 0) out.push({ src: String(src), label: (it && it.title) || (it && it.name) || ('相册图片 ' + (i + 1)) });
        });
      } catch (e) {}
    });
    return out;
  }

  /* ── 界面 ── */
  var _curId = null, _view = 'list', _importPreview = null, _dragId = null;
  function root() { return document.getElementById('bq-typeset-root'); }
  function ensureRoot() {
    var r = root();
    if (r) return r;
    r = document.createElement('div');
    r.id = 'bq-typeset-root';
    r.innerHTML =
      '<div class="bq-bar"><button type="button" class="bq-back" id="bq-back-btn" onclick="window.GroupBQ.back()">‹ 返回阅读</button>' +
      '<span class="bq-bar-title" id="bq-bar-title">文字排版器</span>' +
      '<span class="bq-saved" id="bq-saved-label"></span></div>' +
      '<div class="bq-body" id="bq-list-view"></div>' +
      '<div class="bq-body" id="bq-editor-view" style="display:none;"></div>' +
      '<div class="bq-body" id="bq-import-view" style="display:none;"></div>' +
      '<input type="file" id="bq-import-file" accept=".md,.markdown,.txt" style="display:none;" />' +
      '<input type="file" id="bq-img-file" accept="image/*" style="display:none;" />';
    document.body.appendChild(r);
    var fi = document.getElementById('bq-import-file');
    if (fi) fi.addEventListener('change', function () { onImportFile(fi.files && fi.files[0]); fi.value = ''; });
    var im = document.getElementById('bq-img-file');
    if (im) im.addEventListener('change', function () { onImageFile(im.files && im.files[0]); im.value = ''; });
    return r;
  }
  function back() {
    if (_view === 'import') { _importPreview = null; if (_curId) showEditor(_curId); else showList(); return; }
    if (_view === 'editor') { showList(); return; }
    close();
  }
  function open() { ensureRoot(); root().classList.add('bq-open'); showList(); }
  function close() { var r = root(); if (r) r.classList.remove('bq-open'); }
  function setBar(title, savedText) {
    var t = document.getElementById('bq-bar-title'); if (t) t.textContent = title;
    var b = document.getElementById('bq-back-btn');
    if (b) b.textContent = _view === 'list' ? '‹ 返回阅读' : (_view === 'editor' ? '‹ 文档列表' : '‹ 取消导入');
    var lab = document.getElementById('bq-saved-label');
    if (lab) lab.textContent = savedText || '';
  }
  function showList() {
    _view = 'list'; _curId = null; ensureRoot();
    document.getElementById('bq-list-view').style.display = '';
    document.getElementById('bq-editor-view').style.display = 'none';
    document.getElementById('bq-import-view').style.display = 'none';
    setBar('文字排版器', '');
    var docs = listDocs();
    var html = '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<button type="button" class="bq-btn bq-btn-primary" onclick="window.GroupBQ.createAndOpen()">＋ 新建文档</button>' +
      '<button type="button" class="bq-btn" onclick="document.getElementById(\'bq-import-file\').click()">导入 Markdown / TXT</button></div>';
    if (!docs.length) {
      html += '<div class="bq-empty">还没有文档，点新建或导入一篇<br /><span style="font-size:12px;">文档只存在这台手机里，和书架上的书分开保存。</span></div>';
    } else {
      html += docs.map(function (d) {
        return '<div class="bq-doc-row"><div class="bq-doc-meta" onclick="window.GroupBQ.openDoc(\'' + d.id + '\')" style="cursor:pointer;">' +
          '<div class="bq-doc-name">' + esc(d.title) + '</div>' +
          '<div class="bq-doc-sub">' + d.blocks.length + ' 块 · 更新于 ' + new Date(d.updatedAt).toLocaleString('zh-CN') + '</div></div>' +
          '<button type="button" class="bq-mini-btn" onclick="window.GroupBQ.renameDocPrompt(\'' + d.id + '\')">重命名</button>' +
          '<button type="button" class="bq-mini-btn" onclick="window.GroupBQ.duplicateAndShow(\'' + d.id + '\')">复制</button>' +
          '<button type="button" class="bq-mini-btn" style="color:#c0392b;" onclick="window.GroupBQ.deleteDocPrompt(\'' + d.id + '\')">删除</button></div>';
      }).join('');
    }
    document.getElementById('bq-list-view').innerHTML = html;
  }
  function createAndOpen() { var d = createDoc(''); showEditor(d.id); }
  function openDoc(id) { if (getDoc(id)) showEditor(id); }
  function renameDocPrompt(id) {
    var d = getDoc(id); if (!d) return;
    try { var v = window.prompt('重命名文档', d.title); if (v != null) { renameDoc(id, v); showList(); } } catch (e) {}
  }
  function duplicateAndShow(id) { var c = duplicateDoc(id); if (c) showList(); }
  function deleteDocPrompt(id) {
    var d = getDoc(id); if (!d) return;
    var ok = true;
    try { ok = window.confirm('确定删除「' + d.title + '」吗？删除后无法恢复。'); } catch (e) {}
    if (ok) { deleteDoc(id); showList(); }
  }

  function settingsPanelHTML(d) {
    var s = d.settings;
    function seg(name, opts, cur) {
      return '<span class="bq-seg">' + opts.map(function (o) {
        return '<button type="button" class="' + (cur === o[0] ? 'bq-on' : '') + '" onclick="window.GroupBQ.uiSet(\'' + name + '\',\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('') + '</span>';
    }
    var types = [['h1', '标题一'], ['h2', '标题二'], ['h3', '标题三'], ['p', '正文'], ['quote', '引用'], ['note', '注释']];
    var defRows = types.map(function (t) {
      var df = s.defaults[t[0]];
      return '<div class="bq-ctl-row"><label style="width:44px;">' + t[1] + '</label>' +
        '字号 <input type="number" min="10" max="48" value="' + df.size + '" onchange="window.GroupBQ.uiDefault(\'' + t[0] + '\',\'size\',this.value)" />' +
        '行距 <input type="number" min="1" max="3" step="0.1" value="' + df.lh + '" onchange="window.GroupBQ.uiDefault(\'' + t[0] + '\',\'lh\',this.value)" />' +
        '字距 <input type="number" min="0" max="8" step="0.5" value="' + df.ls + '" onchange="window.GroupBQ.uiDefault(\'' + t[0] + '\',\'ls\',this.value)" /></div>';
    }).join('');
    return '<details class="bq-panel"><summary>排版设置 · ' + ({ magazine: '杂志风', minimal: '极简', literary: '文学', photo: '摄影' }[s.style] || s.style) + ' / ' + (s.direction === 'v' ? '竖排' : '横排') + ' / ' + s.paperSize + '</summary>' +
      '<div class="bq-ctl-row"><label>风格</label>' + seg('style', [['magazine', '杂志风'], ['minimal', '极简'], ['literary', '文学'], ['photo', '摄影']], s.style) + '</div>' +
      '<div class="bq-ctl-row"><label>字体</label>' + seg('font', [['serif', '衬线'], ['sans', '无衬线'], ['mono', '等宽'], ['round', '圆体']], s.font) + '</div>' +
      '<div class="bq-ctl-row"><label>方向</label>' + seg('direction', [['h', '横排'], ['v', '竖排']], s.direction) + '</div>' +
      '<div class="bq-ctl-row"><label>纸张</label>' + seg('paper', [['white', '白'], ['cream', '米白'], ['kraft', '牛皮纸'], ['dark', '深色'], ['grid', '网格'], ['dots', '圆点']], s.paper) + '</div>' +
      '<div class="bq-ctl-row"><label>纸张尺寸</label>' + seg('paperSize', [['A4', 'A4'], ['A5', 'A5'], ['B5', 'B5'], ['Letter', 'Letter']], s.paperSize) +
      '<span style="color:#8a8f98;">' + s.paperSize + ' ' + (PAPER_SIZES[s.paperSize] || PAPER_SIZES.A4).join('×') + 'mm，屏上按比例缩放显示；导出长图按此比例。</span></div>' +
      '<div class="bq-ctl-row"><label>页面宽度</label><input type="range" min="320" max="800" step="10" value="' + s.pageWidth + '" oninput="window.GroupBQ.uiSet(\'pageWidth\',this.value)" /><span>' + s.pageWidth + 'px</span></div>' +
      '<div class="bq-ctl-row"><label>边距</label>' +
      '上 <input type="number" min="0" max="120" value="' + s.margins.t + '" onchange="window.GroupBQ.uiSet(\'margin.t\',this.value)" />' +
      '下 <input type="number" min="0" max="120" value="' + s.margins.b + '" onchange="window.GroupBQ.uiSet(\'margin.b\',this.value)" />' +
      '左 <input type="number" min="0" max="120" value="' + s.margins.l + '" onchange="window.GroupBQ.uiSet(\'margin.l\',this.value)" />' +
      '右 <input type="number" min="0" max="120" value="' + s.margins.r + '" onchange="window.GroupBQ.uiSet(\'margin.r\',this.value)" /></div>' +
      '<div class="bq-ctl-row"><label>长图清晰度</label>' + seg('scale', [['1', '1x'], ['2', '2x'], ['3', '3x']], String(s.scale)) + '<span style="color:#8a8f98;">单张输出高度上限 ' + MAX_PNG_H + 'px，超了自动分段。</span></div>' +
      '<div style="font-size:12px;font-weight:700;margin-top:8px;">文档级默认值（标题 / 正文 / 引用 / 注释各一套）</div>' + defRows +
      '</details>';
  }
  function blockHTML(doc, b) {
    var s = doc.settings;
    var bar = '<div class="bq-block-bar"><span class="bq-handle" title="拖动排序">⋮⋮</span><span>' + BLOCK_LABELS[b.type] + '</span>' +
      '<button type="button" class="bq-mini-btn" onclick="window.GroupBQ.uiMove(\'' + b.id + '\',-1)">↑</button>' +
      '<button type="button" class="bq-mini-btn" onclick="window.GroupBQ.uiMove(\'' + b.id + '\',1)">↓</button>' +
      '<button type="button" class="bq-mini-btn" onclick="window.GroupBQ.uiDupBlock(\'' + b.id + '\')">复制</button>' +
      '<button type="button" class="bq-mini-btn" style="color:#c0392b;" onclick="window.GroupBQ.uiDelBlock(\'' + b.id + '\')">删除</button>';
    if (b.type !== 'hr' && b.type !== 'img') {
      bar += '<span style="margin-left:auto;">字号 <input type="number" min="10" max="48" placeholder="默认" value="' + (b.ov.size || '') + '" onchange="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'size\',this.value)" />' +
        '行距 <input type="number" min="1" max="3" step="0.1" placeholder="默认" value="' + (b.ov.lh || '') + '" onchange="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'lh\',this.value)" />' +
        '字距 <input type="number" min="0" max="8" step="0.5" placeholder="默认" value="' + (b.ov.ls || '') + '" onchange="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'ls\',this.value)" /></span>';
    }
    bar += '</div>';
    if (b.type === 'hr') {
      return '<div class="bq-block" draggable="true" data-bid="' + b.id + '" ondragstart="window.GroupBQ.dragStart(event,\'' + b.id + '\')" ondragover="window.GroupBQ.dragOver(event)" ondrop="window.GroupBQ.dropBlock(event,\'' + b.id + '\')">' + bar +
        (s.style === 'literary' ? '<div class="bq-ornament">❦</div>' : '<hr class="bq-hr" />') + '</div>';
    }
    if (b.type === 'img') {
      var cls = 'bq-imgwrap' + (b.float === 'left' ? ' bq-float-left' : b.float === 'right' ? ' bq-float-right' : '') + (s.direction === 'v' ? ' bq-vertical-fix' : '');
      var body;
      if (b.src) body = '<img src="' + b.src + '" alt="' + esc(b.caption || '') + '" style="width:' + (b.float === 'none' ? (b.width || 100) : 100) + '%;border-radius:' + (b.radius || 0) + 'px;" />';
      else body = '<div class="bq-img-ph">图片占位：' + esc(b.caption || '图片') + '（外链图片未导入，请重新上传）</div>';
      var ctl = '<div class="bq-ctl-row"><label>宽度</label><input type="range" min="40" max="100" value="' + (b.width || 100) + '" oninput="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'width\',this.value)" /><span>' + (b.width || 100) + '%</span>' +
        '圆角 <input type="range" min="0" max="24" value="' + (b.radius || 0) + '" oninput="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'radius\',this.value)" /><span>' + (b.radius || 0) + 'px</span></div>' +
        '<div class="bq-ctl-row"><label>位置</label><select onchange="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'align\',this.value)">' +
        ['left', 'center', 'right'].map(function (a) { return '<option value="' + a + '"' + ((b.align || 'center') === a ? ' selected' : '') + '>' + ({ left: '左', center: '中', right: '右' })[a] + '</option>'; }).join('') + '</select>' +
        '<label>环绕</label><select onchange="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'float\',this.value)">' +
        ['none', 'left', 'right'].map(function (a) { return '<option value="' + a + '"' + ((b.float || 'none') === a ? ' selected' : '') + '>' + ({ none: '不浮动', left: '左浮', right: '右浮' })[a] + '</option>'; }).join('') + '</select></div>' +
        '<div class="bq-ctl-row"><label>图注</label><input type="text" value="' + esc(b.caption || '') + '" placeholder="给图片写一句说明…" style="flex:1;padding:5px 8px;border:1px solid #d8d8de;border-radius:8px;font-size:12px;" oninput="window.GroupBQ.uiBlockField(\'' + b.id + '\',\'caption\',this.value)" /></div>';
      return '<div class="bq-block" draggable="true" data-bid="' + b.id + '" ondragstart="window.GroupBQ.dragStart(event,\'' + b.id + '\')" ondragover="window.GroupBQ.dragOver(event)" ondrop="window.GroupBQ.dropBlock(event,\'' + b.id + '\')">' + bar +
        '<div class="' + cls + '" style="text-align:' + (b.align || 'center') + ';">' + body + '</div>' +
        (b.caption ? '<div class="bq-caption">' + esc(b.caption) + '</div>' : '') + ctl + '</div>';
    }
    var cls = 'bq-block-text' + (b.type === 'quote' ? ' bq-quote' : b.type === 'note' ? ' bq-note' : '');
    var extra = (b.type === 'quote') ? 'border-left:3px solid #9a9aa2;padding-left:10px;' : '';
    return '<div class="bq-block" draggable="true" data-bid="' + b.id + '" ondragstart="window.GroupBQ.dragStart(event,\'' + b.id + '\')" ondragover="window.GroupBQ.dragOver(event)" ondrop="window.GroupBQ.dropBlock(event,\'' + b.id + '\')">' + bar +
      '<div class="' + cls + '" contenteditable="true" data-bid="' + b.id + '" style="' + blockStyle(doc, b) + extra + (b.type === 'h1' || b.type === 'h2' || b.type === 'h3' ? 'font-weight:700;' : '') + '" oninput="window.GroupBQ.onBlockInput(this,\'' + b.id + '\')">' + esc(b.text) + '</div></div>';
  }
  function showEditor(id) {
    var d = getDoc(id); if (!d) return;
    _view = 'editor'; _curId = id; ensureRoot();
    document.getElementById('bq-list-view').style.display = 'none';
    document.getElementById('bq-editor-view').style.display = '';
    document.getElementById('bq-import-view').style.display = 'none';
    setBar(d.title, _lastSavedAt ? '已保存 ' + _lastSavedAt : '未保存');
    renderEditor();
  }
  function renderEditor() {
    var d = getDoc(_curId); if (!d) { showList(); return; }
    var s = d.settings;
    var addBtns = ['h1', 'h2', 'h3', 'p', 'quote', 'note', 'hr', 'img'].map(function (t) {
      return '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiAddBlock(\'' + t + '\')">＋ ' + BLOCK_LABELS[t] + '</button>';
    }).join('');
    var blocksHtml = d.blocks.length ? d.blocks.map(function (b) { return blockHTML(d, b); }).join('') :
      '<div class="bq-empty">这篇文档还是空的，点上面加一块内容吧。</div>';
    var paperCls = 'bq-paper-' + s.paper;
    document.getElementById('bq-editor-view').innerHTML =
      '<div style="display:flex;gap:8px;margin-bottom:10px;"><input id="bq-doc-title" class="bq-title-input" value="' + esc(d.title) + '" oninput="window.GroupBQ.uiTitle(this.value)" />' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiExport(\'html\')">导出 HTML</button></div>' +
      '<div class="bq-toolbar">' + addBtns +
      '<button type="button" class="bq-btn" onclick="document.getElementById(\'bq-img-file\').click()">上传图片</button>' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiPickAlbum()">从相册选</button></div>' +
      settingsPanelHTML(d) +
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiExport(\'md\')">导出 Markdown</button>' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiExport(\'txt\')">导出 TXT</button>' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.uiExportPng()">导出长图 PNG（' + s.scale + 'x）</button></div>' +
      '<div class="bq-page ' + paperCls + ' bq-style-' + s.style + '" id="bq-page" style="max-width:' + s.pageWidth + 'px;">' +
      '<div class="bq-page-inner' + (s.direction === 'v' ? ' bq-vertical' : '') + '" id="bq-page-inner" style="font-family:' + FONT_STACKS[s.font] + ';padding:' + s.margins.t + 'px ' + s.margins.r + 'px ' + s.margins.b + 'px ' + s.margins.l + 'px;">' +
      blocksHtml + '<div style="clear:both;"></div></div></div>';
    var t = document.getElementById('bq-bar-title'); if (t) t.textContent = d.title;
  }
  function rerender() { if (_view === 'editor' && _curId) renderEditor(); else if (_view === 'list') showList(); }

  /* ── 界面回调（UI 层只做转调 + 重渲染；逻辑在纯函数里）── */
  function uiAddBlock(type) {
    if (type === 'img') { var f = document.getElementById('bq-img-file'); if (f) f.click(); return; }
    addBlock(_curId, type); renderEditor();
  }
  function uiMove(bid, dir) { moveBlock(_curId, bid, dir); renderEditor(); }
  function uiDelBlock(bid) { removeBlock(_curId, bid); renderEditor(); }
  function uiDupBlock(bid) { duplicateBlock(_curId, bid); renderEditor(); }
  function uiBlockField(bid, field, value) { setBlockField(_curId, bid, field, value); if (field === 'width' || field === 'radius' || field === 'align' || field === 'float') renderEditor(); }
  function onBlockInput(el, bid) { setBlockText(_curId, bid, el.innerText); }
  function uiTitle(v) { setDocTitle(_curId, v); var t = document.getElementById('bq-bar-title'); if (t) t.textContent = getDoc(_curId).title; }
  function uiSet(path, value) {
    if (path === 'style') { applyStyle(_curId, value); renderEditor(); return; }
    setDocSetting(_curId, path, value); renderEditor();
  }
  function uiDefault(type, field, value) { setDocSetting(_curId, 'default.' + type + '.' + field, value); renderEditor(); }
  function uiExport(kind) { var r = exportDoc(_curId, kind); if (r && !r.downloaded) { try { alert('已生成 ' + r.filename + '（当前环境无法自动下载，内容已备好）。'); } catch (e) {} } }
  function uiExportPng() {
    exportLongPng(_curId, {}).then(function (r) {
      if (r.ok) { try { alert('长图已导出 ' + r.segments + ' 张（' + r.scale + 'x）。'); } catch (e) {} }
      else if (r.reason === 'canvas_unavailable') { try { alert('当前环境画不出长图（无 canvas），已备好 SVG，换真机浏览器再导出。'); } catch (e) {} }
      else { try { alert('长图导出失败：' + r.reason + '。'); } catch (e) {} }
    });
  }
  function dragStart(ev, bid) { _dragId = bid; try { if (ev.dataTransfer) ev.dataTransfer.setData('text/plain', bid); } catch (e) {} }
  function dragOver(ev) { try { ev.preventDefault(); } catch (e) {} }
  function dropBlock(ev, targetBid) {
    try { ev.preventDefault(); } catch (e) {}
    var d = getDoc(_curId); if (!d || !_dragId || _dragId === targetBid) return;
    var from = -1, to = -1;
    d.blocks.forEach(function (b, i) { if (b.id === _dragId) from = i; if (b.id === targetBid) to = i; });
    if (from < 0 || to < 0) return;
    var item = d.blocks.splice(from, 1)[0];
    d.blocks.splice(to, 0, item);
    _dragId = null; touch(d); scheduleSave(); renderEditor();
  }
  function uiPickAlbum() {
    var imgs = albumImages();
    if (!imgs.length) { try { alert('相册里暂无图片，请先上传一张，或在相册 app 里添加。'); } catch (e) {} return; }
    var list = imgs.map(function (im, i) { return (i + 1) + '. ' + im.label; }).join('\n');
    var pick = null;
    try { pick = window.prompt('从相册选一张图（输入序号 1–' + imgs.length + '）：\n' + list, '1'); } catch (e) {}
    if (pick == null) return;
    var idx = parseInt(pick, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= imgs.length) { try { alert('序号不对，没有插入图片。'); } catch (e) {} return; }
    addImageBlock(_curId, imgs[idx].src, imgs[idx].label); renderEditor();
  }
  function onImageFile(file) {
    if (!file || !_curId) return;
    var rd = new FileReader();
    rd.onload = function () {
      var dataUrl = String(rd.result || '');
      compressImage(dataUrl).then(function (r) {
        if (r.ok) {
          var b = addImageBlock(_curId, r.src, file.name || '');
          if (b && r.ratio) setBlockField(_curId, b.id, 'ratio', r.ratio);
          if (r.compressed) { try { alert('图片已压缩后插入（原图超过 2MB）。'); } catch (e) {} }
          renderEditor();
        } else if (r.reason === 'too_large') {
          try { alert('这张图压缩后仍然超过 2MB，没有插入。请换一张小一点的图片。'); } catch (e) {}
        } else {
          try { alert('图片处理失败，没有插入（当前环境无法压缩大图）。小图可直接插入。'); } catch (e) {}
        }
      });
    };
    try { rd.readAsDataURL(file); } catch (e) {}
  }
  function onImportFile(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var text = String(rd.result || '');
      var parsed = parseMarkdown(text);
      _importPreview = { name: file.name || '导入的文档', blocks: parsed.blocks, external: parsed.external };
      showImportPreview();
    };
    try { rd.readAsText(file); } catch (e) {}
  }
  function showImportPreview() {
    _view = 'import'; ensureRoot();
    document.getElementById('bq-list-view').style.display = 'none';
    document.getElementById('bq-editor-view').style.display = 'none';
    document.getElementById('bq-import-view').style.display = '';
    setBar('导入预览', '');
    var pv = _importPreview;
    var warn = pv.external ? '<div class="bq-warn">注意：有 ' + pv.external + ' 张外链图片没有导入（不热链外链图），已留占位块，请在文档里重新上传图片。没有内容被丢弃。</div>' : '';
    var items = pv.blocks.length ? pv.blocks.map(function (b) {
      var label = b.type === 'img' ? (b.src ? '图片（本地）' : '图片占位（外链未导入）') : BLOCK_LABELS[b.type];
      var txt = b.type === 'hr' ? '———' : b.type === 'img' ? (b.caption || '图片') : b.text;
      return '<div class="bq-import-item"><span class="bq-kind">' + label + '</span>' + esc(txt) + '</div>';
    }).join('') : '<div class="bq-empty">这个文件里没有识别出内容，不会新建空文档。</div>';
    document.getElementById('bq-import-view').innerHTML =
      '<div style="font-size:14px;font-weight:800;margin-bottom:8px;">导入预览 · ' + esc(pv.name) + '</div>' + warn +
      '<div style="font-size:12px;color:#8a8f98;margin-bottom:8px;">共识别出 ' + pv.blocks.length + ' 块，确认后才会保存为新文档。</div>' +
      items +
      '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button type="button" class="bq-btn bq-btn-primary" onclick="window.GroupBQ.confirmImport()" ' + (pv.blocks.length ? '' : 'disabled') + '>确认保存为新文档</button>' +
      '<button type="button" class="bq-btn" onclick="window.GroupBQ.back()">取消</button></div>';
  }
  function confirmImport() {
    if (!_importPreview || !_importPreview.blocks.length) return null;
    var d = createDoc(_importPreview.name.replace(/\.(md|markdown|txt)$/i, ''));
    d.blocks = _importPreview.blocks;
    touch(d); saveNow();
    _importPreview = null;
    showEditor(d.id);
    return d;
  }

  /* ── 样式注入 + 入口挂接 ── */
  function injectStyle() {
    if (document.getElementById('bq-style')) return;
    var st = document.createElement('style');
    st.id = 'bq-style';
    st.textContent = BQ_CSS_TEXT;
    document.head.appendChild(st);
  }
  function bindEntry() {
    var btn = document.getElementById('bq-typeset-entry');
    if (btn) btn.addEventListener('click', function () { open(); });
  }
  injectStyle();
  bindEntry();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEntry);
  }

  window.GroupBQ = {
    MARK: MARK, KEY: KEY,
    newDoc: newDoc, defaultSettings: defaultSettings, defaultBlock: defaultBlock,
    parseMarkdown: parseMarkdown, blocksToMarkdown: blocksToMarkdown, blocksToText: blocksToText,
    buildExportHTML: buildExportHTML, buildLongImageSVG: buildLongImageSVG,
    buildPngSegments: buildPngSegments, estimateBlockH: estimateBlockH,
    load: load, saveNow: saveNow, scheduleSave: scheduleSave, _reloadFromStorage: _reloadFromStorage,
    listDocs: listDocs, getDoc: getDoc, createDoc: createDoc, renameDoc: renameDoc,
    duplicateDoc: duplicateDoc, deleteDoc: deleteDoc,
    addBlock: addBlock, addImageBlock: addImageBlock, setBlockText: setBlockText,
    setBlockField: setBlockField, moveBlock: moveBlock, removeBlock: removeBlock,
    duplicateBlock: duplicateBlock, applyStyle: applyStyle, setDocSetting: setDocSetting,
    setDocTitle: setDocTitle, exportDoc: exportDoc, exportLongPng: exportLongPng,
    compressImage: compressImage, albumImages: albumImages,
    open: open, close: close, back: back, showList: showList, openDoc: openDoc,
    createAndOpen: createAndOpen, renameDocPrompt: renameDocPrompt,
    duplicateAndShow: duplicateAndShow, deleteDocPrompt: deleteDocPrompt,
    uiAddBlock: uiAddBlock, uiMove: uiMove, uiDelBlock: uiDelBlock, uiDupBlock: uiDupBlock,
    uiBlockField: uiBlockField, onBlockInput: onBlockInput, uiTitle: uiTitle,
    uiSet: uiSet, uiDefault: uiDefault, uiExport: uiExport, uiExportPng: uiExportPng,
    dragStart: dragStart, dragOver: dragOver, dropBlock: dropBlock,
    uiPickAlbum: uiPickAlbum, confirmImport: confirmImport,
    _lastExport: function () { return _lastExport; },
    _lastSavedAt: function () { return _lastSavedAt; },
    _curId: function () { return _curId; },
    _view: function () { return _view; }
  };
})();

