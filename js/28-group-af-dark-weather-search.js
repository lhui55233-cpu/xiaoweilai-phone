
/* GROUP-AF-DARK-WEATHER-SEARCH · AF 组：深色主题 / Open-Meteo 天气 / 桌面搜索 /
   长按菜单 / 滚动反应 / 圆体字体 / 一起听在线源 —— 思路自写，未复制任何项目代码。
   出处说明：Open-Meteo（https://open-meteo.com，免费、无需 key）；
   ZCOOL KuaiLe（Google Fonts，https://fonts.google.com/specimen/ZCOOL+KuaiLe）；
   YouTube 嵌套播放（https://www.youtube.com/embed，无需 key）。
   新增键：phone_ui_prefs_v1.theme、weather_city_v1、af_weather_cache_v1、
   af_round_font_v1、af_duet_source_v1。只读复用旧键，不改任何旧键。 */
(function () {
'use strict';
if (window.AFGroup) return;
var LS = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
/* 全局对象读取：AppRegistry / AppManager 是顶层 const，不在 window 上，
   须用间接 eval 读全局词法绑定；window 上有的（如 IconSystem）优先走 window。 */
var G = function (name) {
  try { if (typeof window !== 'undefined' && window[name] !== undefined) return window[name]; } catch (e) {}
  try { return (0, eval)(name); } catch (e) { return undefined; }
};
var REG = G('AppRegistry'), MGR = G('AppManager');
var $ = function (s, r) { return (r || document).querySelector(s); };
var sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };

/* ══ 1. 深色主题：V 组主题表里没有这两套深色，按 T 组 phone_ui_prefs_v1.theme 加两个取值 ══ */
var AFTheme = {
  KEY: 'phone_ui_prefs_v1',
  THEMES: {
    'guichao-light': { name: '归巢白（默认）', dark: false },
    'gruvbox-dark': { name: 'Gruvbox 深色', dark: true },
    'guichao-dark': { name: '归巢深色', dark: true }
  },
  get: function () {
    try { var p = JSON.parse(LS.get(this.KEY) || '{}') || {}; return this.THEMES[p.theme] ? p.theme : 'guichao-light'; }
    catch (e) { return 'guichao-light'; }
  },
  set: function (id) {
    if (!this.THEMES[id]) return false;
    var p = {};
    try { p = JSON.parse(LS.get(this.KEY) || '{}') || {}; } catch (e) {}
    p.theme = id;
    LS.set(this.KEY, JSON.stringify(p));
    this.apply(); this.syncRow();
    return true;
  },
  apply: function () {
    var t = this.get();
    if (this.THEMES[t].dark) document.documentElement.setAttribute('data-af-theme', t);
    else document.documentElement.removeAttribute('data-af-theme');
  },
  label: function () { return this.THEMES[this.get()].name; },
  syncRow: function () {
    var row = document.querySelector('[data-act="af_theme"] .st-val');
    if (row) row.textContent = this.label();
  },
  openChooser: function () {
    var old = document.getElementById('af-theme-chooser');
    if (old) old.remove();
    var cur = this.get();
    var ov = document.createElement('div');
    ov.id = 'af-theme-chooser';
    ov.innerHTML = '<div class="af-theme-sheet">'
      + Object.keys(this.THEMES).map(function (id) {
          return '<button type="button" class="af-theme-opt' + (id === cur ? ' af-cur' : '') + '" data-af-theme-opt="' + id + '">'
            + esc(AFTheme.THEMES[id].name) + (id === cur ? ' <svg class="af-cur-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' : '') + '</button>';
        }).join('')
      + '<button type="button" class="af-theme-opt" data-af-theme-opt="__cancel" style="text-align:center;color:var(--st-ink,#1e2748);font-weight:600;">取消</button>'
      + '<div class="af-theme-note">深色随时可切回白色；壁纸白色默认不变。<br>这里只管两套深色（Gruvbox / 归巢深色）；14 套浅色主题 + 自定义两色在设置 → 主题里。</div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { ov.remove(); return; }
      var b = e.target.closest ? e.target.closest('[data-af-theme-opt]') : null;
      if (!b) return;
      var id = b.getAttribute('data-af-theme-opt');
      ov.remove();
      if (id && id !== '__cancel') AFTheme.set(id);
    });
    document.body.appendChild(ov);
  }
};

/* ══ 2. 天气：Open-Meteo 实时取数，没网/失败回退本地并标注来源时间 ══ */
var AFWeather = {
  CITY_KEY: 'weather_city_v1',
  CACHE_KEY: 'af_weather_cache_v1',
  WMO: { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨', 61: '小雨', 63: '雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '暴雨', 85: '阵雪', 86: '阵雪', 95: '雷阵雨', 96: '冰雹雷雨', 99: '冰雹雷雨' },
  _lastAttempt: 0, _lastPaintSig: '', _fetching: false,
  wmoText: function (c) { return this.WMO[c] || '未知天气'; },
  timeStr: function (ts) { var d = new Date(ts); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); },
  city: function () { return LS.get(this.CITY_KEY) || ''; },
  loadCache: function () { try { return JSON.parse(LS.get(this.CACHE_KEY) || 'null'); } catch (e) { return null; } },
  saveCache: function (rec) { LS.set(this.CACHE_KEY, JSON.stringify(rec)); },
  _resetForTest: function () { this._lastAttempt = 0; this._lastPaintSig = ''; this._fetching = false; },
  _coords: function () {
    var self = this;
    var cached = this.loadCache();
    var fromGeo = null;
    if (typeof LocationGateway !== 'undefined' && LocationGateway.getCurrent) {
      fromGeo = Promise.race([
        LocationGateway.getCurrent(),
        sleep(6000).then(function () { throw new Error('geo-timeout'); })
      ]).then(function (p) {
        var place = null;
        try { var known = LocationGateway.nearestKnownPlace && LocationGateway.nearestKnownPlace(p.lat, p.lng); if (known) place = known.placeName; } catch (e) {}
        return { lat: p.lat, lng: p.lng, city: place || '', from: '定位' };
      }).catch(function () { return null; });
    } else { fromGeo = Promise.resolve(null); }
    return fromGeo.then(function (g) {
      if (g) return g;
      var city = self.city();
      if (city) {
        return fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=zh&format=json')
          .then(function (r) { if (!r.ok) throw new Error('geo-http'); return r.json(); })
          .then(function (j) {
            var first = j && j.results && j.results[0];
            if (!first) throw new Error('city-not-found');
            return { lat: first.latitude, lng: first.longitude, city: first.name || city, from: '城市 ' + city };
          });
      }
      if (cached && isFinite(cached.lat) && isFinite(cached.lng)) return { lat: cached.lat, lng: cached.lng, city: cached.city || '', from: '上次位置' };
      throw new Error('no-coords');
    });
  },
  paint: function (box, st) {
    if (!box) return;
    var sig = st.kind + '|' + (st.temp == null ? '' : st.temp) + '|' + (st.code == null ? '' : st.code) + '|' + (st.fetchedAt || '') + '|' + (st.note || '');
    if (sig === this._lastPaintSig && box.querySelector('#af-wx-city')) return;
    this._lastPaintSig = sig;
    var prevCity = '';
    var inp = box.querySelector('#af-wx-city');
    if (inp) prevCity = inp.value;
    var cityVal = prevCity || st.city || this.city() || '';
    var head = '';
    if (st.kind === 'live' || st.kind === 'cached' || st.kind === 'offline-cached' || st.kind === 'error-cached') {
      head = '<div style="font-size:34px;font-weight:300;">' + esc(String(st.temp)) + '°C</div>'
        + '<div style="font-size:15px;font-weight:600;margin-top:4px;">' + esc(this.wmoText(st.code)) + '</div>'
        + '<div style="font-size:13px;color:#8a8580;margin-top:2px;">湿度 ' + esc(String(st.humidity)) + '% · 风速 ' + esc(String(st.wind)) + ' m/s</div>';
    } else {
      head = '<div style="font-size:15px;font-weight:600;">暂无实时天气</div>';
    }
    var src = '';
    if (st.kind === 'live') src = '来源：Open-Meteo 实测 · ' + this.timeStr(st.fetchedAt) + ' 更新' + (st.city ? ' · ' + esc(st.city) : '');
    else if (st.kind === 'cached') src = '来源：Open-Meteo（上次成功数据）· ' + this.timeStr(st.fetchedAt) + ' 更新';
    else if (st.kind === 'offline-cached') src = '离线：未联网，显示上次成功数据 · ' + this.timeStr(st.fetchedAt) + ' 更新';
    else if (st.kind === 'error-cached') src = '取数失败（网络或服务异常），显示上次成功数据 · ' + this.timeStr(st.fetchedAt) + ' 更新，未编造天气。';
    else if (st.kind === 'offline') src = '离线：未联网，以下是本地数据 · ' + this.timeStr(Date.now());
    else if (st.kind === 'error-local') src = '取数失败：未能取得实时天气，以下是本地数据 · ' + this.timeStr(Date.now()) + '（不是实测，未编造）。';
    else if (st.kind === 'loading') src = '正在取实时天气…';
    else src = '本地数据 · ' + this.timeStr(Date.now());
    box.innerHTML = '<div class="gd-card" style="text-align:center;padding:18px 16px;margin-bottom:0;">' + head
      + '<div class="af-wx-src">' + src + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:12px;"><input id="af-wx-city" placeholder="城市，如 上海" value="' + esc(cityVal) + '">'
      + '<button type="button" id="af-wx-save-city">保存城市</button></div>'
      + '<div style="display:flex;gap:6px;margin-top:8px;"><button type="button" id="af-wx-refetch" style="flex:1;">重新取数</button>'
      + '<button type="button" id="af-wx-locate" style="flex:1;">用定位取数</button></div>'
      + '<div class="af-wx-note">实时天气来自 Open-Meteo（免费、无需 key）。定位走 J2 组 LocationGateway；没网或取数失败时回退本地数据并标注来源与时间。</div>'
      + '</div>';
    var self = this;
    var saveBtn = box.querySelector('#af-wx-save-city');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var v = (box.querySelector('#af-wx-city') || {}).value || '';
      v = v.trim();
      if (!v) { alert('请先输入城市名'); return; }
      LS.set(self.CITY_KEY, v);
      self._lastAttempt = 0; self._lastPaintSig = '';
      self.refresh(box, true);
    });
    var reBtn = box.querySelector('#af-wx-refetch');
    if (reBtn) reBtn.addEventListener('click', function () { self._lastAttempt = 0; self._lastPaintSig = ''; self.refresh(box, true); });
    var locBtn = box.querySelector('#af-wx-locate');
    if (locBtn) locBtn.addEventListener('click', function () { self._lastAttempt = 0; self._lastPaintSig = ''; self.refresh(box, true); });
  },
  refresh: function (win, force) {
    var box = null;
    try { box = win && win.querySelector ? win.querySelector('#af-weather-live') : document.getElementById('af-weather-live'); } catch (e) {}
    if (!box) return Promise.resolve(false);
    var self = this;
    var cached = this.loadCache();
    var fresh = cached && cached.fetchedAt && (Date.now() - cached.fetchedAt < 10 * 60 * 1000);
    if (!force && fresh) { this.paint(box, { kind: 'cached', temp: cached.temp, code: cached.code, humidity: cached.humidity, wind: cached.wind, city: cached.city, fetchedAt: cached.fetchedAt }); return Promise.resolve(true); }
    if (navigator.onLine === false) {
      if (cached) this.paint(box, { kind: 'offline-cached', temp: cached.temp, code: cached.code, humidity: cached.humidity, wind: cached.wind, city: cached.city, fetchedAt: cached.fetchedAt });
      else this.paint(box, { kind: 'offline' });
      return Promise.resolve(false);
    }
    if (!force && this._fetching) return Promise.resolve(false);
    if (!force && Date.now() - this._lastAttempt < 10 * 60 * 1000 && cached) { this.paint(box, { kind: 'cached', temp: cached.temp, code: cached.code, humidity: cached.humidity, wind: cached.wind, city: cached.city, fetchedAt: cached.fetchedAt }); return Promise.resolve(true); }
    this._lastAttempt = Date.now();
    this._fetching = true;
    if (cached) this.paint(box, { kind: 'cached', temp: cached.temp, code: cached.code, humidity: cached.humidity, wind: cached.wind, city: cached.city, fetchedAt: cached.fetchedAt });
    else this.paint(box, { kind: 'loading' });
    return this._coords().then(function (co) {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + co.lat + '&longitude=' + co.lng + '&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto';
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('wx-http-' + r.status); return r.json(); }).then(function (j) {
        var c = j && j.current;
        if (!c || c.temperature_2m == null) throw new Error('wx-empty');
        var rec = { lat: co.lat, lng: co.lng, city: co.city || self.city() || '', temp: c.temperature_2m, code: c.weather_code, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, fetchedAt: Date.now() };
        self.saveCache(rec);
        self._fetching = false;
        self.paint(box, { kind: 'live', temp: rec.temp, code: rec.code, humidity: rec.humidity, wind: rec.wind, city: rec.city, fetchedAt: rec.fetchedAt });
        return true;
      });
    }).catch(function () {
      self._fetching = false;
      var c2 = self.loadCache();
      if (c2) self.paint(box, { kind: 'error-cached', temp: c2.temp, code: c2.code, humidity: c2.humidity, wind: c2.wind, city: c2.city, fetchedAt: c2.fetchedAt });
      else self.paint(box, { kind: 'error-local' });
      return false;
    });
  }
};

/* ══ 3. 桌面搜索：触屏版 Ctrl+K 命令面板 ══ */
var AFSearch = {
  _sessions: function () {
    try { if (REG && REG.wechat && REG.wechat.wxStore) return REG.wechat.wxStore.sessions || []; } catch (e) {}
    try { var ws = G('wxStore'); if (typeof ws === 'function') return ws().sessions || []; } catch (e) {}
    return [];
  },
  searchAll: function (q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    var ids = [];
    try {
      if (window.IconSystem && IconSystem.layout) {
        ['grid1', 'grid2', 'dock'].forEach(function (z) { (IconSystem.layout[z] || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      }
    } catch (e) {}
    if (!ids.length) { try { ids = Object.keys(REG || {}); } catch (e) {} }
    ids.forEach(function (id) {
      /* 只列已注册可启动的应用：未在 AppRegistry 里注册的 id 不进搜索结果，
         点按不再走到“尚未上线，敬请期待”。 */
      try { if (!REG || !REG[id]) return; } catch (e) { return; }
      var name = id;
      try { name = (window.IconSystem && IconSystem.getName(id)) || id; } catch (e) {}
      if (name.toLowerCase().indexOf(q) >= 0 || id.toLowerCase().indexOf(q) >= 0) out.push({ type: 'app', id: id, title: name, sub: '应用' });
    });
    var mems = [];
    try { mems = JSON.parse(LS.get('guichao.memories.v1') || '[]') || []; } catch (e) {}
    mems.forEach(function (m) {
      var hay = ((m.title || '') + ' ' + (m.content || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ type: 'memory', id: m.id, title: m.title || '(无标题)', sub: '归巢记忆 · ' + (m.category || '') });
    });
    this._sessions().forEach(function (s) {
      var msgs = s.messages || [];
      var hay = ((s.name || '') + ' ' + msgs.map(function (m) { return m.content || m.text || ''; }).join(' ')).toLowerCase();
      if (hay.indexOf(q) >= 0) {
        var hit = null;
        for (var i = msgs.length - 1; i >= 0; i--) { if ((msgs[i].content || '').toLowerCase().indexOf(q) >= 0) { hit = msgs[i]; break; } }
        out.push({ type: 'chat', id: s.id, title: s.name || '聊天', sub: '微信 · ' + (hit ? String(hit.content || '').slice(0, 20) : ((s.preview || '').slice(0, 20))) });
      }
    });
    var meta = {};
    try { meta = JSON.parse(LS.get('ck_diary_meta_v1') || '{}') || {}; } catch (e) {}
    var cache = {};
    try { cache = JSON.parse(LS.get('cike_cache_v1') || '{}') || {}; } catch (e) {}
    Object.keys(meta).forEach(function (k) {
      var d = meta[k] || {};
      var text = cache[k] || '';
      var hay = (k + ' ' + (d.date || '') + ' ' + text).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ type: 'diary', id: k, title: (k.split('::')[0] || '日记') + ' · ' + (d.date || ''), sub: '此刻日记 · ' + String(text).slice(0, 20) });
    });
    return out.slice(0, 20);
  },
  _launch: function (appId) {
    try {
      if (REG && REG[appId] && MGR && MGR.launch) { MGR.launch(appId); return true; }
    } catch (e) {}
    /* 未注册的应用不弹“尚未上线，敬请期待”——搜索结果已提前过滤，
       这里只静默失败，不留死按钮。 */
    return false;
  },
  open: function (r) {
    if (!r) return false;
    if (r.type === 'app') return this._launch(r.id);
    if (r.type === 'memory') return this._launch('guichao');
    if (r.type === 'diary') return this._launch('cike');
    if (r.type === 'chat') {
      this._launch('wechat');
      setTimeout(function () { try { if (window.WeChatAppEngine) WeChatAppEngine.openChatDetail(r.id); } catch (e) {} }, 300);
      return true;
    }
    return false;
  },
  _render: function (q) {
    var box = document.getElementById('af-search-results');
    var input = document.getElementById('af-search-input');
    if (!box) return;
    var res = this.searchAll(q);
    if (!q || !q.trim()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var TYPE = { app: '应用', memory: '记忆', chat: '聊天', diary: '日记' };
    box.innerHTML = res.length
      ? res.map(function (r, i) { return '<button type="button" class="af-sr-item" data-af-sr="' + i + '"><span class="af-sr-type">' + TYPE[r.type] + '</span>' + esc(r.title) + '<div class="af-sr-sub">' + esc(r.sub || '') + '</div></button>'; }).join('')
      : '<div class="af-sr-empty">没有找到「' + esc(q) + '」相关内容。</div>';
    box._results = res;
  },
  init: function () {
    var self = this;
    var input = document.getElementById('af-search-input');
    if (input) {
      input.addEventListener('input', function () { self._render(input.value); });
      input.addEventListener('focus', function () { if (input.value) self._render(input.value); });
    }
    var box = document.getElementById('af-search-results');
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-af-sr]') : null;
      if (!b) return;
      var r = (box._results || [])[parseInt(b.getAttribute('data-af-sr'), 10)];
      box.hidden = true; box.innerHTML = '';
      if (input) input.value = '';
      self.open(r);
    });
    document.addEventListener('click', function (e) {
      var b2 = document.getElementById('af-search-results');
      if (b2 && !b2.hidden && e.target && !e.target.closest('#af-search')) { b2.hidden = true; }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        var inp = document.getElementById('af-search-input');
        if (inp) { inp.focus(); inp.scrollIntoView && inp.scrollIntoView({ block: 'nearest' }); }
      }
      if (e.key === 'Escape') { var b3 = document.getElementById('af-search-results'); if (b3) b3.hidden = true; }
    });
  }
};

/* ══ 4. 长按菜单：Pointer Events 按住 500ms 弹出同一菜单，右键仍可触发 ══ */
var AFLongPress = {
  _suppressUntil: 0,
  init: function () {
    var timer = null, target = null, sx = 0, sy = 0, fired = false;
    var self = this;
    document.addEventListener('pointerdown', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-af-lp]') : null;
      if (!el) return;
      target = el; sx = e.clientX || 0; sy = e.clientY || 0; fired = false;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fired = true;
        self._suppressUntil = Date.now() + 800;
        AFLongPress.fire(el, sx, sy);
      }, 500);
    }, true);
    var cancel = function (e) {
      if (!fired) {
        if (e && e.type === 'pointermove' && target) {
          var x = e.clientX || 0, y = e.clientY || 0;
          if (Math.hypot(x - sx, y - sy) > 12) clearTimeout(timer);
        } else if (e && e.type !== 'pointermove') clearTimeout(timer);
      }
    };
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('pointermove', cancel, true);
    document.addEventListener('click', function (e) {
      if (Date.now() < self._suppressUntil && e.target && e.target.closest && e.target.closest('[data-af-lp]')) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  },
  fire: function (el, x, y) {
    var spec = el.getAttribute('data-af-lp') || '';
    var fake = { clientX: x, clientY: y, preventDefault: function () {} };
    try {
      if (spec.indexOf('session:') === 0) {
        if (window.WeChatAppEngine) WeChatAppEngine.showSessionMenu(fake, spec.slice(8));
      } else if (spec.indexOf('msg:') === 0) {
        var parts = spec.slice(4).split(':');
        if (window.WeChatAppEngine) WeChatAppEngine.showContextMenu(fake, parts[0], parts.slice(1).join(':'));
      }
    } catch (e) {}
  }
};

/* ══ 5. 滚动反应：Y/AB 组未合入，自接轻量滚动监听，10 秒节流 ══ */
var AFScroll = {
  lastFire: 0, lastText: '', _idx: 0,
  LINES: ['你在翻什么呀，让我也看看。', '翻得好快……是有什么新鲜东西吗？', '这里我也想看看，等等我。'],
  _lastTop: new Map(),
  _resetForTest: function () { this.lastFire = 0; },
  init: function () {
    var self = this;
    document.addEventListener('scroll', function (e) { self._onScroll(e.target); }, true);
    window.addEventListener('scroll', function () { self._onScroll(document.scrollingElement || document.documentElement); }, true);
  },
  _onScroll: function (t) {
    if (!t || t === document || typeof t.scrollTop !== 'number') return;
    var top = t.scrollTop;
    var prev = this._lastTop.get(t);
    this._lastTop.set(t, top);
    if (prev == null) return;
    if (Math.abs(top - prev) < 80) return;
    var now = Date.now();
    if (now - this.lastFire < 10000) return;
    this.lastFire = now;
    this._react();
  },
  _react: function () {
    var text = this.LINES[this._idx++ % this.LINES.length];
    this.lastText = text;
    try {
      var b = document.getElementById('ot-char-bubble');
      if (b && window.WeChatAppEngine && WeChatAppEngine.otomeCharBubble) { WeChatAppEngine.otomeCharBubble(text); return; }
    } catch (e) {}
    var el = document.getElementById('af-scroll-bubble');
    if (!el) { el = document.createElement('div'); el.id = 'af-scroll-bubble'; document.body.appendChild(el); }
    /* GROUP-FIX3 · FIX3-4(b) 文本 + × 关闭结构；点 × 立即收起；缩成小圆点时点按收起 */
    el.innerHTML = '';
    var txt = document.createElement('span');
    txt.className = 'af-scroll-bubble-txt';
    txt.textContent = text;
    el.appendChild(txt);
    var x = document.createElement('span');
    x.className = 'af-scroll-bubble-x';
    x.textContent = '×';
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', '关闭');
    x.onclick = function (ev) { if (ev) ev.stopPropagation(); el.classList.remove('show'); clearTimeout(el._t); };
    el.appendChild(x);
    el.onclick = function () { if (el.classList.contains('af-scroll-bubble-min')) { el.classList.remove('show'); clearTimeout(el._t); } };
    el.classList.remove('af-scroll-bubble-min');
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2500);
    /* 碰撞避让：气泡矩形与可见输入框/按钮相交时，缩成右上角小圆点，不盖表单 */
    try { AFScroll._avoidOverlap(el); } catch (e) {}
  },
  /* GROUP-FIX3 · FIX3-4(b) 碰撞避让：与任一可见 input/select/textarea/button 相交即缩成小圆点 */
  _avoidOverlap: function (el) {
    if (!el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) return;
    var nodes = document.querySelectorAll('.sys-app-window input, .sys-app-window select, .sys-app-window textarea, .sys-app-window button');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.disabled) continue;
      var q = n.getBoundingClientRect();
      if (!q || q.width === 0 || q.height === 0) continue;
      var cs = null;
      try { cs = window.getComputedStyle ? window.getComputedStyle(n) : null; } catch (e) {}
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      if (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) {
        el.classList.add('af-scroll-bubble-min');
        return;
      }
    }
  }
};

/* ══ 6. 可选圆体字体：默认关闭，在线加载 ZCOOL KuaiLe，失败回落 ══ */
var AFFont = {
  KEY: 'af_round_font_v1',
  FONT_URL: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap',
  _status: '',
  enabled: function () { return LS.get(this.KEY) === '1'; },
  status: function () { return this._status || (this.enabled() ? '已开启' : '关闭'); },
  setEnabled: function (on) {
    LS.set(this.KEY, on ? '1' : '0');
    this.apply(); this.syncRow();
  },
  apply: function () {
    if (!this.enabled()) {
      document.documentElement.classList.remove('af-round-font');
      var l0 = document.getElementById('af-round-font-link');
      if (l0) l0.remove();
      this._status = '关闭';
      return;
    }
    if (navigator.onLine === false) {
      document.documentElement.classList.remove('af-round-font');
      this._status = '离线，已回落系统字体';
      return;
    }
    var link = document.getElementById('af-round-font-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'af-round-font-link';
      link.rel = 'stylesheet';
      link.href = this.FONT_URL;
      link.onload = function () { document.documentElement.classList.add('af-round-font'); AFFont._status = '已开启'; AFFont.syncRow(); };
      link.onerror = function () { document.documentElement.classList.remove('af-round-font'); AFFont._status = '加载失败，已回落系统字体'; AFFont.syncRow(); };
      document.head.appendChild(link);
      this._status = '正在加载…';
    } else {
      document.documentElement.classList.add('af-round-font');
      this._status = '已开启';
    }
  },
  syncRow: function () {
    var row = document.querySelector('[data-act="af_roundfont"] .st-val');
    if (row) row.textContent = this.status();
  }
};

/* ══ 7. 一起听在线源：本地/在线切换，默认本地，离线只显示本地 ══ */
var AFDuet = {
  KEY: 'af_duet_source_v1',
  _ytTitle: '',
  get: function () { return LS.get(this.KEY) === 'online' ? 'online' : 'local'; },
  set: function (s) { LS.set(this.KEY, s === 'online' ? 'online' : 'local'); if (this.get() === 'local') this._clearYT(); this.refreshAll(); },
  barHTML: function () {
    var on = this.get() === 'online';
    var off = navigator.onLine === false;
    return '<div class="af-duet-bar"><span class="af-duet-label">音源</span>'
      + '<button type="button" data-af-duet-src-btn="local" class="' + (on ? '' : 'af-on') + '">本地合成</button>'
      + '<button type="button" data-af-duet-src-btn="online" class="' + (on ? 'af-on' : '') + '"' + (off ? ' disabled' : '') + '>在线 YouTube</button>'
      + '<span class="af-duet-note">' + (off ? '离线，仅显示本地内容（在线源需联网）' : (on ? '在线源，需联网（YouTube 嵌套）' : '本地：本机 WebAudio 合成旋律，不是原曲')) + '</span></div>'
      + '<div class="af-duet-yt" data-af-duet-yt hidden></div>';
  },
  refreshAll: function () {
    var self = this;
    document.querySelectorAll('[data-af-duet-src]').forEach(function (el) {
      if (!el.getAttribute('data-af-filled')) { el.innerHTML = self.barHTML(); el.setAttribute('data-af-filled', '1'); }
      else { var bar = el.querySelector('.af-duet-bar'); if (bar) { var tmp = document.createElement('div'); tmp.innerHTML = self.barHTML(); bar.replaceWith(tmp.firstElementChild); } }
    });
    var wrap = document.getElementById('af-duet-bar-wrap');
    if (wrap) { var t2 = document.createElement('div'); t2.innerHTML = this.barHTML(); wrap.innerHTML = ''; while (t2.firstChild) wrap.appendChild(t2.firstChild); if (this.get() === 'online' && this._ytTitle) this.playOnline(this._ytTitle); }
  },
  _clearYT: function () { document.querySelectorAll('[data-af-duet-yt]').forEach(function (c) { c.innerHTML = ''; c.hidden = true; }); },
  playOnline: function (title) {
    this._ytTitle = title || '';
    if (this.get() !== 'online' || navigator.onLine === false) { this._clearYT(); return false; }
    var url = 'https://www.youtube.com/embed?listType=search&list=' + encodeURIComponent(title || '轻音乐') + '&autoplay=1';
    document.querySelectorAll('[data-af-duet-yt]').forEach(function (c) {
      c.hidden = false;
      c.innerHTML = '<iframe src="' + url + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="在线源 · YouTube 嵌套播放"></iframe>';
    });
    return true;
  },
  init: function () {
    var self = this;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-af-duet-src-btn]') : null;
      if (!b || b.disabled) return;
      self.set(b.getAttribute('data-af-duet-src-btn'));
      if (self.get() === 'online' && self._ytTitle) self.playOnline(self._ytTitle);
    });
    window.addEventListener('online', function () { self.refreshAll(); });
    window.addEventListener('offline', function () { self._clearYT(); self.refreshAll(); });
    if (window.GroupN && GroupN.showDuetMini) {
      var origMini = GroupN.showDuetMini;
      GroupN.showDuetMini = function (where) {
        var ov = origMini(where);
        try {
          var sheet = ov && ov.querySelector ? ov.querySelector('.gn-sheet') : document.querySelector('#gn-duet-overlay .gn-sheet');
          if (sheet && !document.getElementById('af-duet-bar-wrap')) {
            var wrap = document.createElement('div');
            wrap.id = 'af-duet-bar-wrap';
            wrap.innerHTML = self.barHTML();
            sheet.insertBefore(wrap, sheet.firstChild);
          }
        } catch (e) {}
        return ov;
      };
      if (GroupN._duetMiniPlay) {
        var origPlay = GroupN._duetMiniPlay;
        GroupN._duetMiniPlay = function (i) {
          var r = origPlay(i);
          try {
            var list = (window.GroupN && GroupN.duetLoad) ? GroupN.duetLoad() : [];
            var t = list[i];
            if (t) self.playOnline(t.title);
          } catch (e) {}
          return r;
        };
      }
    }
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        document.querySelectorAll('[data-af-duet-src]:not([data-af-filled])').forEach(function (el) { el.innerHTML = self.barHTML(); el.setAttribute('data-af-filled', '1'); });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }
};

/* ══ 初始化 + 设置行点击委托（设置 handleAction 无 af_* 分支，会自然落空） ══ */
AFTheme.apply();
AFFont.apply();
AFSearch.init();
AFLongPress.init();
AFScroll.init();
AFDuet.init();
document.addEventListener('click', function (e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-act="af_theme"],[data-act="af_roundfont"]') : null;
  if (!t) return;
  var act = t.getAttribute('data-act');
  if (act === 'af_theme') AFTheme.openChooser();
  else if (act === 'af_roundfont') AFFont.setEnabled(!AFFont.enabled());
});

window.AFGroup = { AFTheme: AFTheme, AFWeather: AFWeather, AFSearch: AFSearch, AFLongPress: AFLongPress, AFScroll: AFScroll, AFFont: AFFont, AFDuet: AFDuet };
window.AFTheme = AFTheme; window.AFWeather = AFWeather; window.AFSearch = AFSearch;
window.AFScroll = AFScroll; window.AFFont = AFFont; window.AFDuet = AFDuet;
})();
