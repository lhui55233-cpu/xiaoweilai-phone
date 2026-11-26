(function (window, document) {
  'use strict';
  if (!window || !document || !window.GroupW || typeof AppManager === 'undefined') return;

  var GW = window.GroupW;
  var phaseNames = { focus: '专注', short: '短休息', long: '长休息' };
  var soundNames = { off: '关闭', rain: '雨声', waves: '海浪', forest: '林间', lofi: '柔噪', jazz: '暖噪' };
  var soundGlyphs = {
    off: '<path d="M5 5l14 14M9.5 9.5a4 4 0 0 0 5 5M4 9a8 8 0 0 0 13.8 5.5M8 5.4A8 8 0 0 1 20 12"/>',
    rain: '<path d="M7.2 14.2h9.9a3.1 3.1 0 0 0 .4-6.2 5.2 5.2 0 0 0-9.8-.6 3.5 3.5 0 0 0-.5 6.8Z"/><path d="m8.5 17-.8 2m5-2-.8 2m5-2-.8 2"/>',
    waves: '<path d="M3.5 9.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0M3.5 14c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0M3.5 18.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0"/>',
    forest: '<path d="m12 3 5.5 8h-3l4.1 6h-4.4v4H9.8v-4H5.4l4.1-6h-3L12 3Z"/><path d="M12 17v4"/>',
    lofi: '<path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1M4.5 13v4.5a2 2 0 0 0 2 2h1.3v-7H6.5a2 2 0 0 0-2 2Zm15 0v4.5a2 2 0 0 1-2 2h-1.3v-7h1.3a2 2 0 0 1 2 2Z"/>',
    jazz: '<path d="M7 5.5h5.5a3 3 0 0 1 0 6H9.8v2.8h4a3 3 0 0 1 0 6H7v-3h6.5M7 5.5v14.8M17.8 6.5v1.8m0 3.1v1.8m0 3.1v1.8"/>'
  };
  function svg(paths, cls, viewBox) {
    return '<svg class="' + (cls || '') + '" viewBox="' + (viewBox || '0 0 24 24') + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }
  function tomato(on, className) {
    var body = '<path d="M12 5.3c-5.2-2.4-8.6 1.5-8.6 6.8 0 5.6 3.5 9.2 8.6 9.2s8.6-3.6 8.6-9.2c0-5.3-3.4-9.2-8.6-6.8Z"/><path d="M12 5.7c-.5-2.1-1.9-3.4-3.9-3.5.7 2.2 2 3.3 3.9 3.5Zm0 0c1.1-2 2.7-2.9 4.6-2.6-.7 2-2.3 2.8-4.6 2.6Z"/><path d="M12 5.8v2.1"/>';
    return '<svg class="' + (className || '') + (on ? ' is-on' : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  function fmt(ms) {
    var total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function clamp(n, min, max, fallback) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }
  function snapshot() {
    var tick = GW.pomoTick(Date.now()) || {};
    var pomo = GW.pomoLoad();
    var durations = GW.pomoDurations();
    var session = pomo.session && typeof pomo.session === 'object' ? pomo.session : null;
    var phase = (tick.active && phaseNames[tick.phase]) ? tick.phase : ((session && phaseNames[session.phase]) ? session.phase : (phaseNames[pomo.phase] ? pomo.phase : 'focus'));
    var round = Math.min(4, Math.max(1, Number((tick.active && tick.round) || (session && session.round) || pomo.round || 1)));
    var paused = !tick.active && !!(session && Number(session.remainingMs) > 0);
    var remaining = tick.active ? tick.remainingMs : (paused ? session.remainingMs : durations[phase] * 60000);
    return { tick: tick, pomo: pomo, durations: durations, phase: phase, round: round, active: !!tick.active, paused: paused, remaining: remaining };
  }
  function iconButtonSvg(kind) {
    if (kind === 'pause') return svg('<path d="M8.5 5.5h2.8v13H8.5zM14.7 5.5h2.8v13h-2.8z"/>');
    if (kind === 'play') return svg('<path d="M8 5.5v13l10-6.5-10-6.5Z"/>');
    return svg('<path d="m8 5 8 7-8 7"/>');
  }
  function render(root) {
    if (!root || !GW) return;
    var s = snapshot();
    var stats = GW.focusStats(Date.now());
    var goal = Math.max(1, Number(stats.goal) || 4);
    var progress = Math.min(100, Math.round((Number(stats.todaySessions || 0) / goal) * 100));
    var week = Array.isArray(stats.week) ? stats.week : [];
    var weekMax = Math.max(25, ...week.map(function (x) { return Number(x.minutes) || 0; }));
    var weekTotal = week.reduce(function (n, x) { return n + (Number(x.minutes) || 0); }, 0);
    var phaseText = phaseNames[s.phase] || '专注';
    var modeText = s.active ? (s.phase === 'focus' ? '正在专注' : '正在休息') : (s.paused ? '已暂停' : '准备开始');
    var toggleText = s.active ? '暂停' : (s.paused ? '继续' : (s.phase === 'focus' ? '开始专注' : '开始' + phaseText));
    var toggleGlyph = iconButtonSvg(s.active ? 'pause' : 'play');
    var roundDots = [1, 2, 3, 4].map(function (i) {
      return '<span class="xwl-pomo-round-dot' + (i < s.round || (i === s.round && s.phase === 'focus') ? ' done' : '') + '" aria-hidden="true">' + tomato(i < s.round || (i === s.round && s.phase === 'focus'), '') + '</span>';
    }).join('');
    var bars = week.map(function (day, i) {
      var minutes = Math.max(0, Number(day.minutes) || 0);
      var height = minutes ? Math.max(10, Math.round(minutes / weekMax * 100)) : 4;
      return '<div class="xwl-pomo-day" aria-label="' + day.label + '，' + minutes + ' 分钟"><div class="xwl-pomo-bar-track"><i class="' + (i === week.length - 1 ? 'today' : '') + '" style="height:' + height + '%"></i></div><span>' + day.label + '</span></div>';
    }).join('');
    var sounds = ['off', 'rain', 'waves', 'forest', 'lofi', 'jazz'].map(function (id) {
      var active = (s.pomo.ambient || 'off') === id;
      return '<button class="xwl-pomo-sound' + (active ? ' selected' : '') + '" type="button" data-pomo-action="ambient" data-value="' + id + '" aria-pressed="' + active + '">' +
        svg(soundGlyphs[id], 'xwl-pomo-sound-icon') + '<span>' + soundNames[id] + '</span></button>';
    }).join('');

    root.innerHTML = '<main class="xwl-pomo-app">' +
      '<header class="xwl-pomo-header">' +
        '<button class="sys-app-backbtn xwl-pomo-back" type="button" data-pomo-action="back" aria-label="返回桌面">' + svg('<path d="m15 18-6-6 6-6"/>') + '</button>' +
        '<div class="xwl-pomo-brand">' + tomato(true, 'xwl-pomo-brand-icon') + '<div><strong>番茄专注</strong><small>把注意力放回此刻</small></div></div>' +
        '<button class="xwl-pomo-fullscreen-btn" type="button" data-pomo-action="fullscreen" aria-label="切换全屏">' + svg('<path d="M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m12-4v3a1 1 0 0 1-1 1h-3"/>') + '<span>全屏</span></button>' +
      '</header>' +
      '<section class="xwl-pomo-hero" aria-label="计时器">' +
        '<div class="xwl-pomo-phase"><span class="xwl-pomo-phase-mark"></span>' + phaseText + ' · ' + modeText + '</div>' +
        '<div class="xwl-pomo-clock" id="xwl-pomo-clock" role="timer" aria-live="off">' + fmt(s.remaining) + '</div>' +
        '<div class="xwl-pomo-round-label">第 ' + s.round + ' 轮 <span>·</span> 每四轮后长休息</div>' +
        '<div class="xwl-pomo-rounds" aria-label="轮次进度">' + roundDots + '</div>' +
        '<div class="xwl-pomo-controls">' +
          '<button class="xwl-pomo-primary" type="button" data-pomo-action="toggle">' + toggleGlyph + '<span>' + toggleText + '</span></button>' +
          '<button class="xwl-pomo-skip" type="button" data-pomo-action="skip">' + iconButtonSvg('skip') + '<span>跳过这段</span></button>' +
        '</div>' +
      '</section>' +
      '<section class="xwl-pomo-card xwl-pomo-durations" aria-label="时长设置">' +
        '<div class="xwl-pomo-section-heading"><h2>时长设置</h2><span>分钟</span></div>' +
        '<div class="xwl-pomo-duration-grid">' +
          durationField('focus', '专注', s.durations.focus, 120) +
          durationField('short', '短休息', s.durations.short, 30) +
          durationField('long', '长休息', s.durations.long, 60) +
        '</div>' +
      '</section>' +
      '<section class="xwl-pomo-card xwl-pomo-stats" aria-label="目标与统计">' +
        '<div class="xwl-pomo-section-heading"><h2>每日目标</h2><label class="xwl-pomo-goal"><input type="number" inputmode="numeric" min="1" max="20" step="1" value="' + goal + '" data-pomo-goal aria-label="每日专注轮数目标"><span>轮</span></label></div>' +
        '<div class="xwl-pomo-goal-row"><strong>' + (Number(stats.todaySessions) || 0) + '<small> / ' + goal + ' 轮</small></strong><span>连续 ' + (Number(stats.streak) || 0) + ' 天</span></div>' +
        '<div class="xwl-pomo-progress"><i style="width:' + progress + '%"></i></div>' +
        '<div class="xwl-pomo-week-head"><h3>最近 7 天</h3><span>共 ' + weekTotal + ' 分钟</span></div>' +
        '<div class="xwl-pomo-week-chart">' + (bars || '<div class="xwl-pomo-empty">完成一轮专注后，这里会显示记录。</div>') + '</div>' +
      '</section>' +
      '<section class="xwl-pomo-card xwl-pomo-ambience" aria-label="环境音">' +
        '<div class="xwl-pomo-section-heading"><h2>环境音</h2><span>轻柔陪伴</span></div>' +
        '<div class="xwl-pomo-sounds">' + sounds + '</div>' +
        '<p class="xwl-pomo-note">由浏览器实时合成的轻环境声，不会播放外部音频。</p>' +
      '</section>' +
      '<footer class="xwl-pomo-footer">专注不是赶路，是温柔地回到眼前。</footer>' +
    '</main>';
  }
  function durationField(key, label, value, max) {
    return '<label class="xwl-pomo-duration"><span>' + label + '</span><input type="number" inputmode="numeric" min="1" max="' + max + '" step="1" value="' + value + '" data-pomo-duration="' + key + '" aria-label="' + label + '时长（分钟）"></label>';
  }
  function updateTimer(root, result) {
    if (!root) return;
    var clock = root.querySelector('#xwl-pomo-clock');
    if (!clock) return;
    var r = result || snapshot().tick;
    if (r && r.active) clock.textContent = fmt(r.remainingMs);
  }
  function bind(root) {
    if (root._xwlPomoBound) return;
    root._xwlPomoBound = true;
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-pomo-action]');
      if (!button || !root.contains(button)) return;
      var action = button.getAttribute('data-pomo-action');
      if (action === 'back') { AppManager.minimize(); return; }
      if (action === 'toggle') {
        var s = snapshot();
        if (s.active) GW.pomoPause(Date.now());
        else if (s.paused) GW.pomoResume(Date.now());
        else GW.pomoStart(s.phase, Date.now());
        render(root);
      } else if (action === 'skip') {
        GW.pomoSkip(Date.now());
        render(root);
      } else if (action === 'ambient') {
        var kind = button.getAttribute('data-value') || 'off';
        var current = GW.pomoLoad().ambient || 'off';
        GW.ambientStart(current === kind && kind !== 'off' ? 'off' : kind);
        render(root);
      } else if (action === 'fullscreen') {
        if (document.fullscreenElement === root && document.exitFullscreen) {
          try { document.exitFullscreen().catch(function () {}); } catch (e) {}
        } else if (root.requestFullscreen && !document.fullscreenElement) {
          try { root.requestFullscreen().catch(function () {}); } catch (e) {}
        }
      }
    });
    root.addEventListener('change', function (event) {
      var input = event.target;
      if (input.matches('[data-pomo-duration]')) {
        var key = input.getAttribute('data-pomo-duration');
        var limits = { focus: [1, 120], short: [1, 30], long: [1, 60] };
        if (!limits[key]) return;
        var s = GW.pomoLoad();
        var durations = Object.assign({}, s.durations || {});
        durations[key] = clamp(input.value, limits[key][0], limits[key][1], GW.pomoDurations()[key]);
        GW.pomoSave(Object.assign({}, s, { durations: durations }));
        render(root);
      } else if (input.matches('[data-pomo-goal]')) {
        var pomo = GW.pomoLoad();
        var goal = clamp(input.value, 1, 20, 4);
        GW.pomoSave(Object.assign({}, pomo, { dailyGoal: goal }));
        render(root);
      }
    });
  }
  function createApp(root) {
    bind(root);
    render(root);
    root._xwlPomoRefresh = function () { render(root); };
    root._xwlPomoTick = function (result) { updateTimer(root, result); };
  }

  AppManager.register('pomodoro', {
    createApp: createApp,
    show: function (root) { if (root && root._xwlPomoRefresh) root._xwlPomoRefresh(); },
    resume: function (root) { if (root && root._xwlPomoRefresh) root._xwlPomoRefresh(); }
  });
})(window, document);
