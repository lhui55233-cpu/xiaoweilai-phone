
/* ══════════ GROUP-FIX12 · 世界书子页数据桥 + 胖猫跑酷 ══════════
   只读汇总父页 localStorage 回传给世界书 iframe（requestWbPages → wbPages）。
   胖猫跑酷用 3D 家那只猫（otome_home_v1.pet），不另起猫；记分只写新键 fatcat_run_v1。 */
(function () {
  var rd = function (k, def) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? def : v; } catch (e) { return def; } };
  var hasKey = function (k) { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } };
  /* D 批禁 emoji：猫/爪印/关闭改线稿 SVG（猫、爪印取 js/64-ui-vector-icons 的线稿）。 */
  var FC_X_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var FC_CAT_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><path d="M4.5 10 4 4l5 2.5a9 9 0 0 1 6 0L20 4l-.5 6a8 8 0 1 1-15 0Z"/><path d="M8.5 12h.1m6.8 0h.1M10 15.5c1.4 1.1 2.6 1.1 4 0m-4-2.4-4-1m8 0 4-1"/></svg>';
  var FC_PAW_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="vertical-align:-2px" aria-hidden="true"><ellipse cx="12" cy="16.4" rx="5.5" ry="4.2"/><ellipse cx="5.8" cy="9.2" rx="1.8" ry="2.5"/><ellipse cx="10.1" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="14.4" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="18.6" cy="9.2" rx="1.8" ry="2.5"/></svg>';

  // ── 世界书子页数据：全部只读；没有就是没有（null/[]），iframe 给空状态，绝不编 ──
  window.fix12CollectWbPages = function () {
    var pages = { diary: [], dreams: [], daily: null, coread: null, health: null };
    try {
      // 日记：ck_diary_meta_v1 + cike_cache_v1（OtomeF.diaryEntries 的口径，复用，不另写一份）
      var meta = rd('ck_diary_meta_v1', {}), cache = rd('cike_cache_v1', {});
      if (window.OtomeF && OtomeF.diaryEntries) {
        var r = OtomeF.diaryEntries(meta || {}, cache || {}) || {};
        pages.diary = (r.diary || []).filter(function (d) { return d && d.text; });
      }
    } catch (e) {}
    try {
      // 梦境：char_dreams_v1
      var dr = rd('char_dreams_v1', []);
      if (Array.isArray(dr)) pages.dreams = dr.filter(function (d) { return d && (d.text || d.scene); })
        .map(function (d) { return { date: d.date || '', text: d.scene || d.text || '' }; })
        .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 30);
    } catch (e) {}
    try {
      // 起居注日常卡：cike_char_day_v1。键不存在时不拿系统默认 9 格日程充数，直接 null。
      if (hasKey('cike_char_day_v1')) {
        var day = rd('cike_char_day_v1', null);
        if (day && Array.isArray(day.slots) && day.slots.length
          && day.slots.every(function (s) { return typeof s.hour === 'number' && typeof s.place === 'string' && typeof s.activity === 'string'; })) {
          pages.daily = { city: day.city || '', weather: day.weather || '', slots: day.slots };
        }
      }
    } catch (e) {}
    try {
      // 共书时：coread_char_v1（char 进度 pct）+ read_stats_v1（分钟）+ 摘抄 + 生词本
      var charMap = rd('coread_char_v1', {}) || {};
      var stats = rd('read_stats_v1', {}) || {};
      var quotes = rd('read_quotes_v1', []);
      var words = rd('read_words_v1', null);
      var titles = {};
      try {
        var ns = rd('novel_store_v1', null);
        var arr = (ns && Array.isArray(ns.books)) ? ns.books : (Array.isArray(ns) ? ns : []);
        arr.forEach(function (b) { if (b && b.id && b.title) titles[b.id] = b.title; });
      } catch (e2) {}
      var ids = {};
      Object.keys(charMap).forEach(function (k) { ids[k] = 1; });
      Object.keys(stats).forEach(function (k) { ids[k] = 1; });
      var books = Object.keys(ids).map(function (id) {
        var e = charMap[id] || {};
        return { id: id, title: titles[id] || id, charPct: (typeof e.pct === 'number') ? e.pct : 0, minutes: (typeof stats[id] === 'number') ? stats[id] : null };
      });
      pages.coread = {
        books: books,
        quotes: Array.isArray(quotes) ? quotes.slice(0, 20) : [],
        wordsCount: Array.isArray(words) ? words.length : (words && typeof words === 'object' ? Object.keys(words).length : null)
      };
    } catch (e) {}
    try {
      // 健康卡接口：只读 vigilia_health_v1（真实数据接入后才有；现在不存在 → null → 空状态）。
      // 期望形状：{updatedAt, cycleDay, cycleLabel, recovery, sleepMin|sleepText, hrvMs, steps, wristTempC,
      //           series:[{label, recovery}]}
      var h = rd('vigilia_health_v1', null);
      pages.health = (h && typeof h === 'object') ? h : null;
    } catch (e) {}
    return pages;
  };

  // ── 胖猫跑酷（4452 むちねこ概念）：跑 / 跳 / 落 / 吃干粮与猫罐头 / 体重条 ──
  var KEY = 'fatcat_run_v1';
  var load = function () { var v = rd(KEY, null); return (v && typeof v === 'object') ? v : { best: 0, runs: 0, lastWeight: 0, lastScore: 0 }; };
  var save = function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  var petOf = function () {
    try { if (window.OtomeF && OtomeF.loadHome) { var h = OtomeF.loadHome(); return (h && h.pet) ? h.pet : null; } } catch (e) {}
    return null;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  // 物理引擎（与渲染分离，供测试直接驱动；dt 单位秒）
  var Engine = {
    create: function (opts) {
      opts = opts || {};
      var H = opts.H || 260;
      return {
        W: opts.W || 360, H: H, groundY: H - 46,
        cat: { x: 56, y: H - 46 - 26, vy: 0, onGround: true, w: 34, h: 26 },
        weight: Math.max(0, Math.min(1, opts.weight || 0)),
        score: 0, dist: 0, speed: 150, over: false, overReason: '', t: 0,
        platforms: opts.platforms || null, foods: opts.foods || null
      };
    },
    jumpVelocity: function (st) { return Math.max(170, 640 * (1 - 0.55 * st.weight)); },
    jump: function (st) {
      if (!st || st.over || !st.cat.onGround) return false;
      st.cat.vy = -Engine.jumpVelocity(st); st.cat.onGround = false; return true;
    },
    eat: function (st, kind) {
      if (!st || st.over) return;
      if (kind === 'kibble') { st.weight = Math.min(1, st.weight + 0.06); st.score += 10; }
      else if (kind === 'can') { st.weight = Math.min(1, st.weight + 0.18); st.score += 30; }
    },
    step: function (st, dt) {
      if (!st || st.over || !(dt > 0)) return st;
      st.t += dt; st.dist += st.speed * dt; st.score += st.speed * dt * 0.05;
      st.cat.vy += 1750 * dt; st.cat.y += st.cat.vy * dt;
      var dx = st.speed * dt;
      (st.platforms || []).forEach(function (p) { p.x -= dx; });
      st.platforms = (st.platforms || []).filter(function (p) { return p.x + p.w > -40; });
      (st.foods || []).forEach(function (f) { f.x -= dx; });
      // 落地：下落中、脚底越过平台顶、横向重叠 → 站上去
      if (st.cat.vy >= 0) {
        var feet = st.cat.y + st.cat.h, landed = false;
        (st.platforms || []).forEach(function (p) {
          if (landed) return;
          if (st.cat.x + st.cat.w - 6 > p.x && st.cat.x + 6 < p.x + p.w
            && feet >= p.y && feet - st.cat.vy * dt <= p.y + 14) {
            st.cat.y = p.y - st.cat.h; st.cat.vy = 0; st.cat.onGround = true; landed = true;
          }
        });
        if (!landed && st.cat.vy > 0) st.cat.onGround = false;
      }
      // 吃：横向 <26 且纵向 <34 即吃到
      st.foods = (st.foods || []).filter(function (f) {
        if (f.x < -30) return false;
        if (Math.abs((f.x + 8) - (st.cat.x + st.cat.w / 2)) < 26
          && Math.abs((f.y + 8) - (st.cat.y + st.cat.h / 2)) < 34) { Engine.eat(st, f.kind); return false; }
        return true;
      });
      if (st.cat.y > st.H + 30) { st.over = true; st.overReason = 'fell'; }
      return st;
    }
  };

  var overlay = null, raf = null, state = null, ctx = null, canvas = null, running = false, paused = false;
  var lastTs = 0;
  function genPlatforms(st) {
    // 保证前方始终有平台：按上一平台尾端续接，随机留 55–115px 的沟（越重越跳不过）
    var ps = st.platforms || [];
    var lastX = ps.length ? ps[ps.length - 1].x + ps[ps.length - 1].w : st.W;
    while (lastX < st.W + 320) {
      var gap = 55 + Math.random() * 60;
      var w = 120 + Math.random() * 160;
      var y = st.groundY - Math.floor(Math.random() * 3) * 34;
      ps.push({ x: lastX + gap, y: y, w: w });
      lastX += gap + w;
      if (Math.random() < 0.55) {
        var kind = Math.random() < 0.6 ? 'kibble' : 'can';
        st.foods.push({ x: lastX - w / 2, y: y - 26, kind: kind });
      }
    }
    st.platforms = ps;
  }
  function draw(st) {
    if (!ctx || !canvas) return;
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F6F4EE'; ctx.fillRect(0, 0, W, H);
    // 包豪斯楼群剪影（视差两层）
    var off = st.dist % 90;
    ctx.fillStyle = '#E4E1D7';
    for (var i = -1; i < W / 90 + 1; i++) { var bx = i * 90 - off * 0.4; ctx.fillRect(bx + 8, H - 150, 54, 150); }
    ctx.fillStyle = '#BEB8AD';
    for (var j = -1; j < W / 130 + 1; j++) { var bx2 = j * 130 - (st.dist % 130) * 0.7; ctx.fillRect(bx2 + 20, H - 110, 70, 110); }
    // 平台
    (st.platforms || []).forEach(function (p) {
      ctx.fillStyle = '#111111'; ctx.fillRect(p.x, p.y, p.w, 12);
      ctx.fillStyle = '#333333'; ctx.fillRect(p.x, p.y + 12, p.w, H - p.y - 12);
    });
    // 食物：干粮（圆点）/ 猫罐头（方罐）
    (st.foods || []).forEach(function (f) {
      if (f.kind === 'kibble') { ctx.fillStyle = '#333333'; ctx.beginPath(); ctx.arc(f.x + 8, f.y + 8, 5, 0, 6.29); ctx.fill(); ctx.beginPath(); ctx.arc(f.x + 16, f.y + 12, 4, 0, 6.29); ctx.fill(); }
      else { ctx.fillStyle = '#777777'; ctx.fillRect(f.x, f.y, 22, 16); ctx.fillStyle = '#F6F4EE'; ctx.fillRect(f.x + 3, f.y + 3, 16, 4); }
    });
    // 猫：身体随体重变宽，米白身 + 墨线
    var cw = 30 + st.weight * 30, ch = 24, cx = st.cat.x, cy = st.cat.y;
    ctx.fillStyle = '#F6F4EE'; ctx.strokeStyle = '#111111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx + cw / 2, cy + ch / 2 + 4, cw / 2, ch / 2, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + cw - 6, cy + 4, 11, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + cw - 16, cy - 2); ctx.lineTo(cx + cw - 12, cy - 12); ctx.lineTo(cx + cw - 6, cy - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + cw - 2, cy - 2); ctx.lineTo(cx + cw + 2, cy - 12); ctx.lineTo(cx + cw + 8, cy - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.arc(cx + cw - 10, cy + 3, 1.8, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 2, cy + 12); ctx.quadraticCurveTo(cx - 12, cy + 2, cx - 8, cy - 12); ctx.stroke();
  }
  function hud() {
    if (!overlay || !state) return;
    var s = overlay.querySelector('.fc-score'); if (s) s.textContent = '得分 ' + Math.floor(state.score);
    var w = overlay.querySelector('.fc-fill'); if (w) w.style.width = Math.round(state.weight * 100) + '%';
    var wt = overlay.querySelector('.fc-weight'); if (wt) wt.textContent = '体重 ' + Math.round(state.weight * 100) + '%';
    var b = overlay.querySelector('.fc-best'); if (b) b.textContent = '最高 ' + (load().best || 0);
  }
  function loop(ts) {
    if (!running || paused || !state) return;
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
    genPlatforms(state);
    Engine.step(state, dt);
    draw(state); hud();
    if (state.over) { endRun(); return; }
    raf = requestAnimationFrame(loop);
  }
  function endRun() {
    running = false;
    try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
    var v = load();
    v.runs = (v.runs || 0) + 1;
    v.lastScore = Math.floor(state.score); v.lastWeight = Math.round(state.weight * 100) / 100;
    if (v.lastScore > (v.best || 0)) v.best = v.lastScore;
    save(v);
    var m = overlay && overlay.querySelector('.fc-msg');
    if (m) m.textContent = '掉下去了！' + (v.lastScore >= v.best && v.lastScore > 0 ? '新纪录 ' + v.best + ' 分。' : '得分 ' + v.lastScore + ' 分，最高 ' + v.best + ' 分。') + '体重 ' + Math.round(state.weight * 100) + '%——吃太多真的跳不起来。';
    var st = overlay && overlay.querySelector('[data-fc="start"]'); if (st) st.textContent = '再来一局';
  }
  function onKey(e) {
    if (!overlay) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (state && running && !paused) Engine.jump(state); }
  }
  function startRun() {
    var pet = petOf();
    state = Engine.create({ W: (canvas && canvas.clientWidth) || 360, H: 260, weight: 0 });
    state.platforms = [{ x: -40, y: state.groundY, w: 420 }];
    state.foods = [{ x: 240, y: state.groundY - 26, kind: 'kibble' }];
    running = true; paused = false; lastTs = 0;
    var m = overlay.querySelector('.fc-msg');
    if (m) m.textContent = (pet ? esc(pet.name || '猫') + ' 开跑！' : '开跑！') + '点屏幕或按空格跳，吃干粮 +10 分、猫罐头 +30 分，越吃越重、越重跳得越低。';
    var st = overlay.querySelector('[data-fc="start"]'); if (st) st.textContent = '重开';
    try { raf = requestAnimationFrame(function (ts) { lastTs = ts; raf = requestAnimationFrame(loop); }); } catch (e) {}
  }
  function close() {
    running = false; paused = false;
    try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
    try { window.removeEventListener('keydown', onKey); } catch (e) {}
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; canvas = null; ctx = null; state = null;
    try { if (window.WeChatAppEngine && WeChatAppEngine._otomePanelPlay) WeChatAppEngine._otomePanelPlay(); } catch (e) {}
  }
  function open() {
    if (overlay) return;
    var pet = petOf();
    if (!pet || pet.kind !== 'cat') {
      try { if (window.WeChatAppEngine && WeChatAppEngine.otomeShowPanel) WeChatAppEngine.otomeShowPanel('pet'); } catch (e) {}
      return;
    }
    var v = load();
    overlay = document.createElement('div');
    overlay.id = 'fix12-fatcat-overlay';
    overlay.innerHTML = '<div class="fc-head"><div><div class="fc-title">胖猫跑酷</div><div class="fc-sub">' + esc(pet.name || '猫') + ' · 和 3D 家里同一只猫</div></div>'
      + '<button type="button" class="fc-close" data-fc="close">' + FC_X_SVG + ' 返回一起玩</button></div>'
      + '<div class="fc-hud"><span class="fc-score">得分 0</span><span class="fc-weight">体重 0%</span><span class="fc-best">最高 ' + (v.best || 0) + '</span></div>'
      + '<div class="fc-hud"><span style="font-size:11px;color:#777777;">体重</span><span class="fc-bar"><i class="fc-fill" style="width:0%;"></i></span></div>'
      + '<canvas id="fix12-fatcat-canvas" height="260"></canvas>'
      + '<div class="fc-msg">点「开始」开跑。</div>'
      + '<div class="fc-ctl"><button type="button" data-fc="start">开始</button><button type="button" class="fc-ghost" data-fc="jump">跳</button><button type="button" class="fc-ghost" data-fc="pause">暂停</button></div>';
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('#fix12-fatcat-canvas');
    try { canvas.width = canvas.clientWidth || 360; ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    state = Engine.create({ W: (canvas && canvas.clientWidth) || 360, H: 260, weight: 0 });
    state.platforms = [{ x: -40, y: state.groundY, w: 420 }];
    state.foods = [{ x: 240, y: state.groundY - 26, kind: 'kibble' }];
    draw(state);
    overlay.querySelector('[data-fc="close"]').onclick = function () { close(); };
    overlay.querySelector('[data-fc="start"]').onclick = function () { startRun(); };
    overlay.querySelector('[data-fc="jump"]').onclick = function () { if (state && running && !paused) Engine.jump(state); };
    overlay.querySelector('[data-fc="pause"]').onclick = function () {
      if (!running) return;
      paused = !paused; this.textContent = paused ? '继续' : '暂停';
      if (!paused) { lastTs = 0; try { raf = requestAnimationFrame(function (ts) { lastTs = ts; raf = requestAnimationFrame(loop); }); } catch (e) {} }
    };
    canvas.addEventListener('pointerdown', function () { if (state && running && !paused) Engine.jump(state); });
    window.addEventListener('keydown', onKey);
  }
  function playSectionHTML() {
    var pet = petOf();
    var v = load();
    var h = '<div style="font-weight:700;margin:14px 0 6px;">' + FC_CAT_SVG + ' 胖猫跑酷</div>';
    if (!pet || pet.kind !== 'cat') {
      h += '<div class="ot-muted">跑酷的主角就是 3D 家里那只猫。先去「养宠」领养一只猫，再回来开跑。</div>'
        + '<div style="margin-top:8px;"><button class="ot-btn" onclick="WeChatAppEngine.otomeShowPanel(\'pet\')">' + FC_PAW_SVG + ' 去领养一只猫</button></div>';
      return h;
    }
    h += '<div class="ot-muted">' + esc(pet.name || '猫') + ' 开跑：跳过楼顶的沟，吃干粮和猫罐头。越吃越重、越重跳得越低，太重就掉下去。'
      + '最高分 ' + (v.best || 0) + ' 分' + (v.runs ? ' · 已跑 ' + v.runs + ' 局' : '') + '。</div>'
      + '<div style="margin-top:8px;"><button class="ot-btn" onclick="WeChatAppEngine.otomePlay(\'fatcat\')">' + FC_CAT_SVG + ' 开始跑酷</button></div>';
    return h;
  }
  window.FatCatRun = {
    MARKER: 'GROUP-FIX12', KEY: KEY, open: open, close: close, playSectionHTML: playSectionHTML,
    _engine: Engine, _load: load, _save: save, _petOf: petOf,
    _state: function () { return state; }, _running: function () { return running; }
  };
})();
