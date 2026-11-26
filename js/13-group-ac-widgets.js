
/* ══════════ Group AC · 小组件区（GROUP-AC-WIDGETS）══════════
   商店式挑选 + 长按移动/改大小 + 铅笔就地编辑 + 底部栏四格
   + HSL 色轮主题 + CSS 动画壁纸 + 专注热力图 + 数据一致性。
   只新增 phone_widgets_v1；其余键只读。做法借鉴 15 链接批量调研中小组件
   组的做法，未复制任何项目代码（本批无 AGPL；tux-pet-js GPL-3.0 代码与
   形象未搬；未注明许可证的三家只借玩法结构；Calender 未验证跳过）。
   不碰 DesktopWidgets / desktop_widgets_v2（W 组主干）。 */
const ACWidgets = (() => {
  const KEY = 'phone_widgets_v1';
  const PREFS_KEY = 'phone_ui_prefs_v1';   /* T 组约定键名/形状：{ themeCustom:{h,s,l,hex,updatedAt} }；T 组未合入，先按此写 */
  const FOCUS_KEY = 'focus_log_v1';        /* N 组已合入：{ total, lastMinutes, lastDate, days:{ 'YYYY-MM-DD': 分钟 } } */
  const READ_KEY = 'read_stats_v1';         /* M 组已合入：{ bookId: 分钟 }，无按日字段 */
  const PLAY_KEY = 'otome_play_v1';
  const FISH_KEY = 'otome_fish_v1';
  const HOME_KEY = 'otome_home_v1';
  const WEATHER_KEY = 'phone_weather_v1';   /* 若别的组已写入天气才读，没有不造假 */
  const HABIT_KEYS = ['habit_checkins_v1', 'habits_v1', 'phone_habit_v1']; /* AD 组未合入：按 habitId:date 扁平映射探测，找不到为 0 */
  const CATALOG = [
    { id: 'heatmap', ico: '🗓️', name: '专注热力图', desc: '最近 28 天专注与习惯强度，一眼看到坚持。' },
    { id: 'focus', ico: '🍅', name: '番茄统计', desc: '今天专注了多久、累计多久，打开就看到。' },
    { id: 'pet', ico: '🐱', name: '宠物状态', desc: '家里那只小动物的饱腹、心情和摸头次数。' },
    { id: 'game', ico: '🎮', name: '游戏最高分', desc: '斗地主积分和钓鱼的最大收获。' },
    { id: 'read', ico: '📖', name: '共读统计', desc: '和他一起读了多少分钟、读了几本书。' },
    { id: 'quote', ico: '💬', name: '今日一句话', desc: '每天一句，点一下换一句。' }
  ];
  const QUOTE_KEYS = { quotes: 'read_quotes_v1', diary: 'cike_cache_v1', memories: 'guichao.memories.v1' };
  const firstSentence = (t) => {
    const s = String(t || '').replace(/^\s+/, '');
    if (!s) return '';
    const m = s.split(/[。！？\n]/).map((x) => x.trim()).filter(Boolean)[0] || '';
    return m;
  };
  /* 今日一句话只读她的真实内容，不再写死文案。来源按稳妥程度排序：
     ① 共读摘抄 read_quotes_v1（她自己存的句子，按书汇总）；
     ② 日记 cike_cache_v1（::beside 日记的首句）；
     ③ 归巢记忆 guichao.memories.v1（最新记忆的首行）。
     三处都没有 → 空数组，界面显示空态“还没有一句话，写一句吧”。 */
  const quoteList = () => {
    const out = [];
    const push = (text, source) => {
      const t = String(text || '').trim();
      if (!t || out.some((q) => q.text === t || q.text === t.slice(0, 60))) return;
      out.push({ text: t.length > 60 ? t.slice(0, 60) + '…' : t, source: source });
    };
    try {
      const qm = readJSON(QUOTE_KEYS.quotes, null);
      if (qm && typeof qm === 'object') {
        const arrs = Array.isArray(qm) ? qm : Object.keys(qm).map((k) => qm[k]);
        arrs.forEach((a) => { (Array.isArray(a) ? a : []).forEach((q) => { if (q) push(q.text || q.quote || q, '摘抄'); }); });
      }
    } catch (e) {}
    try {
      const cache = readJSON(QUOTE_KEYS.diary, null) || {};
      Object.keys(cache).forEach((k) => { if (k.indexOf('::beside') >= 0) push(firstSentence(cache[k]), '日记'); });
    } catch (e) {}
    try {
      const mems = readJSON(QUOTE_KEYS.memories, null) || [];
      (Array.isArray(mems) ? mems.slice() : []).sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0)).slice(0, 10).forEach((m) => { if (m) push(firstSentence(m.content || m.title || ''), '记忆'); });
    } catch (e) {}
    return out;
  };
  const quoteOfDayInfo = (d) => {
    const list = quoteList();
    if (!list.length) return { text: '', source: '' };
    const t = d || new Date();
    const idx = (t.getDate() + t.getMonth() + quoteOffset) % list.length;
    return list[idx];
  };
  const quoteOfDay = (d) => quoteOfDayInfo(d).text;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayStr = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const readJSON = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const defaultState = () => ({ v: 1, placed: [], dock: { weather: true, time: true, quote: true, music: true }, theme: { h: 210, s: 45, l: 55, hex: '#5b8fc9' }, wallpaperAnim: false });
  let state = defaultState();
  let moving = false;      /* 移动模式（内存态，不持久化） */
  let editingUid = null;   /* 正在就地编辑的组件 uid（内存态） */
  let quoteOffset = 0;     /* 一句话点按换句的偏移（内存态） */
  let uidSeq = 0;
  const load = () => { const d = readJSON(KEY, null); if (d && typeof d === 'object') { state = Object.assign(defaultState(), d); state.dock = Object.assign({ weather: true, time: true, quote: true, music: true }, d.dock || {}); state.theme = Object.assign({ h: 210, s: 45, l: 55, hex: '#5b8fc9' }, d.theme || {}); if (!Array.isArray(state.placed)) state.placed = []; } return state; };
  const save = () => writeJSON(KEY, state);
  const catalogById = (id) => CATALOG.find((c) => c.id === id) || null;
  const placedByUid = (uid) => state.placed.find((p) => p.uid === uid) || null;

  /* ── 6. 数据一致性：每次都重读同一份本地存档，不另存 ── */
  const readSources = () => {
    const focusRaw = readJSON(FOCUS_KEY, null);
    const focus = (focusRaw && typeof focusRaw === 'object') ? Object.assign({ total: 0, lastMinutes: 0, lastDate: '', days: {} }, focusRaw) : { total: 0, lastMinutes: 0, lastDate: '', days: {} };
    if (!focus.days || typeof focus.days !== 'object') focus.days = {};
    const readRaw = readJSON(READ_KEY, null) || {};
    let readTotal = 0, readBooks = 0;
    Object.keys(readRaw).forEach((k) => { const v = Number(readRaw[k]) || 0; readTotal += v; if (v > 0 || readRaw[k] !== undefined) readBooks += 1; });
    let pet = null;
    try {
      if (typeof window !== 'undefined' && window.OtomeF && window.OtomeF.loadHome) {
        const home = window.OtomeF.loadHome();
        if (home && home.pet) pet = (window.OtomeF.petTick) ? (window.OtomeF.petTick(home.pet, Date.now()) || home.pet) : home.pet;
      } else { const home = readJSON(HOME_KEY, null); if (home && home.pet) pet = home.pet; }
    } catch (e) { try { const home = readJSON(HOME_KEY, null); if (home && home.pet) pet = home.pet; } catch (e2) {} }
    const playRaw = readJSON(PLAY_KEY, null) || {};
    const fishRaw = readJSON(FISH_KEY, null) || {};
    let bestFish = null;
    (Array.isArray(fishRaw.caught) ? fishRaw.caught : []).forEach((c) => { if (c && Number(c.size) >= 0 && (!bestFish || Number(c.size) > Number(bestFish.size))) bestFish = c; });
    const game = { ddzScore: Number(playRaw.ddzScore) || 0, ddzWins: Number(playRaw.ddzWins) || 0, ddzLosses: Number(playRaw.ddzLosses) || 0, fishCasts: Number(fishRaw.casts) || 0, fishCaught: Array.isArray(fishRaw.caught) ? fishRaw.caught.length : 0, bestFish: bestFish };
    return { focus: focus, readTotal: readTotal, readBooks: readBooks, pet: pet, game: game, habitDays: habitDays() };
  };
  /* 习惯打卡：AD 组未合入。按调研里的 habitId:date 扁平映射探测三种可能键名
     与两种形状（{date:1} / {habitId:{date:1}} / {'habitId:date':1}），找不到为 0。 */
  const habitDays = () => {
    const out = {};
    const dateRe = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const absorbDate = (key) => { const m = String(key).match(dateRe); if (!m) return; const d = m[1] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[3])); out[d] = (out[d] || 0) + 1; };
    HABIT_KEYS.forEach((k) => {
      const raw = readJSON(k, null); if (!raw || typeof raw !== 'object') return;
      Object.keys(raw).forEach((key) => {
        if (dateRe.test(key)) { absorbDate(key); return; }
        const v = raw[key];
        if (v && typeof v === 'object') Object.keys(v).forEach((dk) => { if (dateRe.test(dk)) absorbDate(dk); });
      });
    });
    return out;
  };
  /* ── 5. 热力图：最近 28 天；强度 = 专注分钟 + 习惯打卡×20 分钟当量 ──
     read_stats_v1 没有按日字段，不伪造按日阅读量；阅读累计只进 readTotal。 */
  const heatmapData = (endDate) => {
    const src = readSources();
    const end = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : new Date();
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const ds = dayStr(d);
      const focus = Number((src.focus.days || {})[ds]) || 0;
      const habit = Number((src.habitDays || {})[ds]) || 0;
      const intensity = focus + habit * 20;
      const level = intensity <= 0 ? 0 : intensity < 15 ? 1 : intensity < 30 ? 2 : intensity < 60 ? 3 : 4;
      days.push({ date: ds, focus: focus, habit: habit, read: null, level: level });
    }
    return { days: days, readTotal: src.readTotal, habitTotal: Object.keys(src.habitDays || {}).length };
  };
  const hslToHex = (h, s, l) => {
    h = ((Number(h) || 0) % 360 + 360) % 360; s = Math.max(0, Math.min(100, Number(s) || 0)) / 100; l = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  };
  /* quoteOfDay / quoteOfDayInfo 见上（QUOTES 已删，读真实内容）。 */

  /* ── 4. 主题：HSL 色轮选色 → --ac-accent 实时预览 + 写 phone_ui_prefs_v1.themeCustom ── */
  const applyTheme = () => {
    const t = state.theme || { h: 210, s: 45, l: 55 };
    const hex = hslToHex(t.h, t.s, t.l);
    state.theme.hex = hex;
    try { document.documentElement.style.setProperty('--ac-accent', 'hsl(' + t.h + ' ' + t.s + '% ' + t.l + '%)'); } catch (e) {}
    try { document.documentElement.style.setProperty('--ac-accent-soft', 'hsl(' + t.h + ' ' + t.s + '% ' + Math.min(96, Number(t.l) + 38) + '%)'); } catch (e) {}
    const shell = document.getElementById('sys-shell');
    if (shell) shell.classList.toggle('ac-wall-anim', !!state.wallpaperAnim);
    try {
      const prefs = readJSON(PREFS_KEY, null);
      const merged = (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) ? prefs : {};
      merged.themeCustom = { h: Number(t.h), s: Number(t.s), l: Number(t.l), hex: hex, updatedAt: Date.now() };
      writeJSON(PREFS_KEY, merged); try { if (window.__throttlePrefsBump) window.__throttlePrefsBump(); } catch (e) {} /* GROUP-THROTTLE: 写后立即失效主题解析缓存（AC 启动即直写 themeCustom，不走 setUiPrefs） */
    } catch (e) {}
    const prev = document.getElementById('ac-theme-preview');
    if (prev) { prev.style.background = hex; prev.textContent = '预览：主题色 ' + hex + ' · H' + t.h + ' S' + t.s + '% L' + t.l + '%'; }
    const dot = document.getElementById('ac-wheel-dot');
    if (dot) { const ang = (Number(t.h) - 90) * Math.PI / 180; dot.style.left = (50 + 42 * Math.cos(ang)) + '%'; dot.style.top = (50 + 42 * Math.sin(ang)) + '%'; }
  };
  const setTheme = (h, s, l) => {
    state.theme = { h: Math.max(0, Math.min(360, Math.round(Number(h) || 0))), s: Math.max(0, Math.min(100, Math.round((s === undefined || s === null) ? state.theme.s : Number(s)))), l: Math.max(0, Math.min(100, Math.round((l === undefined || l === null) ? state.theme.l : Number(l)))) };
    state.theme.hex = hslToHex(state.theme.h, state.theme.s, state.theme.l);
    save(); applyTheme(); render();
    return state.theme;
  };
  const setWallpaperAnim = (on) => { state.wallpaperAnim = !!on; save(); applyTheme(); return state.wallpaperAnim; };
  const setDock = (cell, on) => { state.dock[cell] = !!on; save(); renderDock(); return state.dock; };

  /* ── 1. 商店式挑选 / 移动 / 改大小 ── */
  const addWidget = (id, size) => {
    const cat = catalogById(id); if (!cat) return null;
    const sz = (size === 'S' || size === 'M' || size === 'L') ? size : 'M';
    const existing = state.placed.find((p) => p.id === id);
    if (existing) { existing.size = sz; save(); render(); return existing; }
    uidSeq += 1;
    const item = { uid: 'ac-' + Date.now().toString(36) + '-' + uidSeq, id: id, size: sz, title: '', color: '', showDetail: true };
    state.placed.push(item); save(); render(); return item;
  };
  const removeWidget = (uid) => { state.placed = state.placed.filter((p) => p.uid !== uid); if (editingUid === uid) editingUid = null; save(); render(); return state.placed.length; };
  const moveWidget = (uid, dir) => {
    const i = state.placed.findIndex((p) => p.uid === uid); if (i < 0) return false;
    const j = i + dir; if (j < 0 || j >= state.placed.length) return false;
    const t = state.placed[i]; state.placed[i] = state.placed[j]; state.placed[j] = t; save(); render(); return true;
  };
  const resizeWidget = (uid, size) => {
    const p = placedByUid(uid); if (!p) return null;
    if (size !== 'S' && size !== 'M' && size !== 'L') return p;
    p.size = size; save(); render(); return p;
  };
  const updateWidget = (uid, patch) => {
    const p = placedByUid(uid); if (!p || !patch) return null;
    if (patch.title !== undefined) p.title = String(patch.title).slice(0, 20);
    if (patch.color !== undefined) p.color = String(patch.color).slice(0, 20);
    if (patch.showDetail !== undefined) p.showDetail = !!patch.showDetail;
    if (patch.size) p.size = patch.size;
    save(); render(); return p;
  };
  const enterMoveMode = () => { moving = true; render(); return true; };
  const exitMoveMode = () => { moving = false; render(); return true; };
  const isMoving = () => moving;

  /* ── 各组件正文（每次 render 重读同一份存档） ── */
  const bodyFor = (p, src) => {
    const today = dayStr(new Date());
    if (p.id === 'heatmap') {
      const hm = heatmapData();
      const shown = p.size === 'S' ? hm.days.slice(-14) : hm.days;
      const cells = shown.map((d) => '<div class="ac-hm-cell ac-hm-l' + d.level + '" title="' + d.date + ' · 专注 ' + d.focus + ' 分钟' + (d.habit ? ' · 习惯打卡 ' + d.habit + ' 次' : '') + '"></div>').join('');
      return '<div class="ac-hm-grid">' + cells + '</div>'
        + (p.showDetail ? '<div class="ac-w-foot">最近 28 天 · 共读累计 ' + src.readTotal + ' 分钟 · 习惯打卡 ' + hm.habitTotal + ' 天</div>' : '');
    }
    if (p.id === 'focus') {
      const f = src.focus;
      return '<div>今日 <b>' + (Number((f.days || {})[today]) || 0) + '</b> 分钟 · 累计 <b>' + (Number(f.total) || 0) + '</b> 分钟</div>'
        + (p.showDetail ? '<div class="ac-w-foot">上次专注 ' + (Number(f.lastMinutes) || 0) + ' 分钟' + (f.lastDate ? '（' + esc(f.lastDate) + '）' : '') + '</div>' : '');
    }
    if (p.id === 'pet') {
      const pet = src.pet;
      if (!pet) return '<div>还没有领养宠物，去乙游 3D 家领养一只吧。</div>';
      const ico = pet.kind === 'dog' ? '🐶' : pet.kind === 'rabbit' ? '🐰' : '🐱';
      return '<div>' + ico + ' <b>' + esc(pet.name || '小动物') + '</b> · 饱腹 ' + (pet.satiety == null ? '—' : pet.satiety) + ' · 心情 ' + (pet.mood == null ? '—' : pet.mood) + '</div>'
        + (p.showDetail ? '<div class="ac-w-foot">摸了 ' + (Number(pet.pats) || 0) + ' 次 · 喂了 ' + (Number(pet.feeds) || 0) + ' 次</div>' : '');
    }
    if (p.id === 'game') {
      const g = src.game;
      const best = g.bestFish ? ('最大 ' + esc(g.bestFish.species || '') + ' ' + g.bestFish.size + '斤') : '还没钓到鱼';
      return '<div>斗地主积分 <b>' + g.ddzScore + '</b> · 胜 ' + g.ddzWins + ' 负 ' + g.ddzLosses + '</div>'
        + (p.showDetail ? '<div class="ac-w-foot">钓鱼 ' + g.fishCasts + ' 次 · ' + best + '</div>' : '');
    }
    if (p.id === 'read') {
      return '<div>共读累计 <b>' + src.readTotal + '</b> 分钟 · ' + src.readBooks + ' 本书</div>'
        + (p.showDetail ? '<div class="ac-w-foot">和他一起读的进度，打开阅读 app 能看到同一份记录。</div>' : '');
    }
    const qi = quoteOfDayInfo();
    if (!qi.text) return '<div>还没有一句话，写一句吧。</div>';
    return '<div>“' + esc(qi.text) + '”</div><div class="ac-w-foot">来自' + esc(qi.source) + '</div>';
  };
  const render = () => {
    const zone = document.getElementById('ac-widget-zone');
    if (!zone) return;
    const src = readSources();
    let html = '';
    state.placed.forEach((p) => {
      const cat = catalogById(p.id); if (!cat) return;
      const title = (p.title && p.title.trim()) ? p.title.trim() : cat.name;
      const accent = p.color ? ' style="border-top: 3px solid ' + esc(p.color) + ';"' : '';
      html += '<div class="ac-widget ac-size-' + p.size + (moving ? ' ac-moving' : '') + '" data-ac-uid="' + esc(p.uid) + '" data-ac-id="' + esc(p.id) + '"' + accent + '>'
        + '<button type="button" class="ac-w-pencil" data-ac-edit="' + esc(p.uid) + '" title="就地编辑">✎</button>'
        + '<div class="ac-w-title">' + esc(title) + '</div>'
        + '<div class="ac-w-body">' + bodyFor(p, src) + '</div>';
      if (editingUid === p.uid) {
        html += '<div class="ac-w-edit" data-ac-editing="' + esc(p.uid) + '">'
          + '<label>标题 <input type="text" class="ac-edit-title" data-ac-field="title" value="' + esc(title) + '" maxlength="20"></label>'
          + '<label>配色 <input type="color" class="ac-edit-color" data-ac-field="color" value="' + esc(p.color || '#7a9cc6') + '"> <span>' + esc(p.color || '默认') + '</span></label>'
          + '<label><input type="checkbox" class="ac-edit-detail" data-ac-field="showDetail"' + (p.showDetail ? ' checked' : '') + '> 显示详情行</label>'
          + '<div class="ac-w-edit-btns"><button type="button" data-ac-save="' + esc(p.uid) + '">完成保存</button>'
          + '<button type="button" data-ac-cancel-edit="' + esc(p.uid) + '">取消</button>'
          + '<button type="button" data-ac-remove="' + esc(p.uid) + '">从桌面移除</button></div></div>';
      }
      if (moving) {
        html += '<div class="ac-w-move">'
          + '<button type="button" data-ac-move="' + esc(p.uid) + ':-1">← 左移</button>'
          + '<button type="button" data-ac-move="' + esc(p.uid) + ':1">右移 →</button>'
          + ['S', 'M', 'L'].map((s) => '<button type="button" data-ac-size="' + esc(p.uid) + ':' + s + '"' + (p.size === s ? ' class="ac-on"' : '') + '>' + s + '</button>').join('')
          + '<button type="button" data-ac-remove="' + esc(p.uid) + '">移除</button>'
          + '<button type="button" data-ac-done-move="1">完成</button></div>'
          + '<div class="ac-w-resize" data-ac-resize="' + esc(p.uid) + '" title="拖动改大小">⤢</div>';
      }
      html += '</div>';
    });
    if (!state.placed.length) { /* GROUP-FIX2: 通用空卡片已删（与 GW 空卡片说法矛盾）；桌面默认小组件见 FIX2 英雄区 */ }
    zone.innerHTML = html;
    renderDock();
  };
  /* ── 3. 底部栏：天气 / 时间 / 一句话 / 音乐 ── */
  const renderDock = () => {
    const bar = document.getElementById('ac-dock-bar');
    if (!bar) return;
    const now = new Date();
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weatherRaw = readJSON(WEATHER_KEY, null);
    const weatherText = (weatherRaw && (weatherRaw.text || weatherRaw.desc || weatherRaw.city)) ? String(weatherRaw.text || weatherRaw.desc || weatherRaw.city) : '点开查看';
    let html = '';
    if (state.dock.weather) html += '<div class="ac-dock-cell" data-ac-dock-cell="weather" data-ac-open-app="weather"><div class="ac-dock-k">天气</div><div class="ac-dock-v">☀️ ' + esc(weatherText) + '</div></div>';
    if (state.dock.time) html += '<div class="ac-dock-cell" data-ac-dock-cell="time"><div class="ac-dock-k">' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + days[now.getDay()] + '</div><div class="ac-dock-v">' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + '</div></div>';
    if (state.dock.quote) { const qi = quoteOfDayInfo(); html += '<div class="ac-dock-cell" data-ac-dock-cell="quote" data-ac-next-quote="1"><div class="ac-dock-k">今日一句话</div><div class="ac-dock-v">' + esc(qi.text ? '“' + qi.text + '”' : '还没有一句话，写一句吧') + '</div></div>'; }
    if (state.dock.music) html += '<div class="ac-dock-cell" data-ac-dock-cell="music" data-ac-open-app="music"><div class="ac-dock-k">音乐</div><div class="ac-dock-v">🎵 一起听</div></div>';
    bar.innerHTML = html;
  };
  const launchApp = (id) => { try { if (window.AppManager && window.AppManager.launch) { window.AppManager.launch(id); return true; } } catch (e) {} return false; };

  /* ── 1+4. 商店浮层：目录卡片 + HSL 色轮 + 底栏开关 + 动画壁纸 ── */
  const openStore = () => {
    closeStore();
    const t = state.theme;
    const ov = document.createElement('div');
    ov.id = 'ac-store-modal';
    let cards = '';
    CATALOG.forEach((c) => {
      const placed = state.placed.find((p) => p.id === c.id);
      cards += '<div class="ac-store-item" data-ac-catalog="' + c.id + '"><div class="ac-si-ico">' + c.ico + '</div>'
        + '<div class="ac-si-name">' + c.name + '</div><div class="ac-si-desc">' + c.desc + '</div>'
        + '<div class="ac-si-sizes">' + ['S', 'M', 'L'].map((s) => '<button type="button" data-ac-add="' + c.id + ':' + s + '"' + (placed && placed.size === s ? ' class="ac-on"' : '') + '>' + (s === 'S' ? '小' : s === 'M' ? '中' : '大') + '</button>').join('') + '</div>'
        + '<div class="ac-si-state">' + (placed ? '已在桌面 · ' + placed.size + ' 尺寸，点尺寸可改大小' : '未放到桌面') + '</div></div>';
    });
    ov.innerHTML = '<div class="ac-store-card">'
      + '<div class="ac-store-title">小组件商店</div>'
      + '<div class="ac-store-sub">每个组件一张卡片，点尺寸放到桌面；桌面上长按组件可移动、改大小；点右上角 ✎ 就地编辑。</div>' + (window.GroupAM ? window.GroupAM.configTableHtml() : '')
      + '<div class="ac-store-grid">' + cards + '</div>'
      + '<div class="ac-store-sec">主题色 · HSL 色轮</div>'
      + '<div class="ac-wheel" id="ac-wheel" title="点色轮选色相"><div class="ac-wheel-dot" id="ac-wheel-dot"></div></div>'
      + '<div class="ac-hsl-row"><span>色相 H</span><input type="range" min="0" max="360" step="1" value="' + t.h + '" data-ac-hsl="h"><span id="ac-hsl-h">' + t.h + '°</span></div>'
      + '<div class="ac-hsl-row"><span>饱和 S</span><input type="range" min="0" max="100" step="1" value="' + t.s + '" data-ac-hsl="s"><span>' + t.s + '%</span></div>'
      + '<div class="ac-hsl-row"><span>明度 L</span><input type="range" min="0" max="100" step="1" value="' + t.l + '" data-ac-hsl="l"><span>' + t.l + '%</span></div>'
      + '<div class="ac-preview" id="ac-theme-preview"></div>'
      + '<div class="ac-store-sec">壁纸与底部栏</div>'
      + '<div class="ac-store-checks">'
      + '<label>CSS 动画壁纸（纯渐变流动，不用外链图片）<input type="checkbox" data-ac-wall="' + (state.wallpaperAnim ? '1' : '0') + '"' + (state.wallpaperAnim ? ' checked' : '') + '></label>'
      + ['weather', 'time', 'quote', 'music'].map((k) => '<label>底部栏 · ' + ({ weather: '天气', time: '时间', quote: '一句话', music: '音乐' })[k] + '<input type="checkbox" data-ac-dock-toggle="' + k + '"' + (state.dock[k] ? ' checked' : '') + '></label>').join('')
      + '</div>'
      + '<div class="ac-store-sub">主题色同时写进 phone_ui_prefs_v1.themeCustom（T 组约定形状，T 组未合入，先按此键名与形状写，待 T 组确认后以 T 组为准）。</div>'
      + '<button type="button" class="ac-store-close" data-ac-close-store="1">完成</button></div>';
    document.body.appendChild(ov);
    applyTheme();
    ov.addEventListener('click', (e) => {
      const add = e.target.closest('[data-ac-add]');
      if (add) { const parts = add.getAttribute('data-ac-add').split(':'); addWidget(parts[0], parts[1]); openStore(); return; }
      if (e.target.closest('[data-ac-close-store]')) { closeStore(); return; }
      if (e.target.id === 'ac-store-modal') { closeStore(); return; }
      const wall = e.target.closest('[data-ac-wall]');
      if (wall) { setWallpaperAnim(wall.checked); return; }
      const dt = e.target.closest('[data-ac-dock-toggle]');
      if (dt) { setDock(dt.getAttribute('data-ac-dock-toggle'), dt.checked); return; }
    });
    ov.addEventListener('input', (e) => {
      const hsl = e.target.closest('[data-ac-hsl]');
      if (hsl) {
        const k = hsl.getAttribute('data-ac-hsl');
        const v = Number(hsl.value);
        if (k === 'h') { const lab = document.getElementById('ac-hsl-h'); if (lab) lab.textContent = v + '°'; }
        const nt = { h: state.theme.h, s: state.theme.s, l: state.theme.l };
        nt[k] = v; setTheme(nt.h, nt.s, nt.l);
        const span = hsl.parentElement.querySelector('span:last-child');
        if (span && k !== 'h') span.textContent = v + '%';
        return;
      }
    });
    const wheel = ov.querySelector('#ac-wheel');
    const wheelPick = (ev) => {
      try {
        const r = wheel.getBoundingClientRect();
        if (!r || !r.width) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
        const hue = Math.round(((ang + 90) % 360 + 360) % 360);
        setTheme(hue, state.theme.s, state.theme.l);
        const hInput = ov.querySelector('[data-ac-hsl="h"]'); if (hInput) hInput.value = hue;
        const lab = document.getElementById('ac-hsl-h'); if (lab) lab.textContent = hue + '°';
      } catch (e) {}
    };
    if (wheel) {
      wheel.addEventListener('pointerdown', (ev) => { wheelPick(ev); });
      wheel.addEventListener('click', (ev) => { wheelPick(ev); });
    }
  };
  const closeStore = () => { const m = document.getElementById('ac-store-modal'); if (m) m.remove(); };

  /* ── 桌面区事件委托：铅笔就地编辑 / 移动 / 改大小 / 长按 ── */
  let lpTimer = null;
  const bindZone = () => {
    const zone = document.getElementById('ac-widget-zone');
    if (!zone || zone.__acBound) return;
    zone.__acBound = true;
    zone.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-ac-edit]');
      if (edit) { editingUid = edit.getAttribute('data-ac-edit'); render(); return; }
      const saveBtn = e.target.closest('[data-ac-save]');
      if (saveBtn) {
        const uid = saveBtn.getAttribute('data-ac-save');
        const card = zone.querySelector('[data-ac-editing="' + uid + '"]');
        if (card) {
          const titleEl = card.querySelector('[data-ac-field="title"]');
          const colorEl = card.querySelector('[data-ac-field="color"]');
          const detEl = card.querySelector('[data-ac-field="showDetail"]');
          updateWidget(uid, { title: titleEl ? titleEl.value : '', color: colorEl ? colorEl.value : '', showDetail: detEl ? detEl.checked : true });
        }
        editingUid = null; render(); return;
      }
      const cancel = e.target.closest('[data-ac-cancel-edit]');
      if (cancel) { editingUid = null; render(); return; }
      const rem = e.target.closest('[data-ac-remove]');
      if (rem) { removeWidget(rem.getAttribute('data-ac-remove')); return; }
      const mv = e.target.closest('[data-ac-move]');
      if (mv) { const parts = mv.getAttribute('data-ac-move').split(':'); moveWidget(parts[0], Number(parts[1])); return; }
      const sz = e.target.closest('[data-ac-size]');
      if (sz) { const parts = sz.getAttribute('data-ac-size').split(':'); resizeWidget(parts[0], parts[1]); return; }
      if (e.target.closest('[data-ac-done-move]')) { exitMoveMode(); return; }
      const openApp = e.target.closest('[data-ac-open-app]');
      if (openApp) { launchApp(openApp.getAttribute('data-ac-open-app')); return; }
      const nq = e.target.closest('[data-ac-next-quote]');
      if (nq) { const nqLen = quoteList().length; if (nqLen) quoteOffset = (quoteOffset + 1) % nqLen; renderDock(); return; }
    });
    zone.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.ac-widget');
      if (!card || moving || editingUid) return;
      if (e.target.closest('button') || e.target.closest('input')) return;
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => { enterMoveMode(); }, 550);
    });
    zone.addEventListener('pointerup', () => { clearTimeout(lpTimer); });
    zone.addEventListener('pointercancel', () => { clearTimeout(lpTimer); });
    /* 角拖拽改大小：横向拖过 40px 升/降一档（S↔M↔L） */
    zone.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('[data-ac-resize]');
      if (!h) return;
      const uid = h.getAttribute('data-ac-resize');
      const p = placedByUid(uid); if (!p) return;
      const order = ['S', 'M', 'L'];
      let idx = order.indexOf(p.size); const startX = e.clientX; let moved = false;
      const onMove = (ev) => {
        const d = ev.clientX - startX;
        if (Math.abs(d) > 40 && !moved) { moved = true; idx = Math.max(0, Math.min(2, idx + (d > 0 ? 1 : -1))); resizeWidget(uid, order[idx]); }
      };
      const onUp = () => { try { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); } catch (err) {} };
      try { document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp); } catch (err) {}
    });
    const bar = document.getElementById('ac-dock-bar');
    if (bar && !bar.__acBound) {
      bar.__acBound = true;
      bar.addEventListener('click', (e) => {
        const openApp = e.target.closest('[data-ac-open-app]');
        if (openApp) { launchApp(openApp.getAttribute('data-ac-open-app')); return; }
        const nq = e.target.closest('[data-ac-next-quote]');
        if (nq) { const nqLen = quoteList().length; if (nqLen) quoteOffset = (quoteOffset + 1) % nqLen; renderDock(); return; }
      });
    }
  };
  let inited = false;
  const init = () => {
    if (inited) return; inited = true;
    load(); applyTheme(); render(); bindZone();
    try { window.addEventListener('storage', (ev) => { if (!ev.key || [KEY, FOCUS_KEY, READ_KEY, PLAY_KEY, FISH_KEY, HOME_KEY].indexOf(ev.key) >= 0) render(); }); } catch (e) {}
    try { setInterval(() => { renderDock(); }, 30000); } catch (e) {}
  };
  return {
    init: init, render: render, renderDock: renderDock, openStore: openStore, closeStore: closeStore,
    addWidget: addWidget, removeWidget: removeWidget, moveWidget: moveWidget, resizeWidget: resizeWidget,
    updateWidget: updateWidget, enterMoveMode: enterMoveMode, exitMoveMode: exitMoveMode, isMoving: isMoving,
    setTheme: setTheme, hslToHex: hslToHex, setWallpaperAnim: setWallpaperAnim, setDock: setDock,
    heatmapData: heatmapData, readSources: readSources, quoteOfDay: quoteOfDay, quoteOfDayInfo: quoteOfDayInfo, quoteList: quoteList, applyTheme: applyTheme,
    catalog: () => CATALOG.slice(), load: load,
    _state: () => state, _keys: { widgets: KEY, prefs: PREFS_KEY, focus: FOCUS_KEY, read: READ_KEY, play: PLAY_KEY, fish: FISH_KEY, home: HOME_KEY, weather: WEATHER_KEY, habits: HABIT_KEYS }
  };
})();
window.ACWidgets = ACWidgets;
if (typeof window.heatmap_data_v1 === 'undefined') window.heatmap_data_v1 = ACWidgets.heatmapData;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { try { ACWidgets.init(); } catch (e) {} });
else { try { ACWidgets.init(); } catch (e) {} }
