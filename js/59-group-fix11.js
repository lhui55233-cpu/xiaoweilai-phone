
/* GROUP-FIX11: 银灰余音音乐播放器 —— 唯一播放实现（共享模块）。
   设计稿：用户 docx「银灰余音音乐播放器」（银灰冰蓝，拍立得 + 黑胶 + still here.）。
   音乐 app、桌面音乐小组件（FIX2 英雄区读 getState）、灵动岛（toggle/end 走
   GroupFIX11.toggle/stop）共用同一套状态：当前歌曲 / 播放 / 暂停 / 进度 / 循环 / 音量。
   播放走真实 <audio> + 网易云外链（需联网）；播不出来只报中文提示，不编假播放。
   旧的 WebAudio 合成播放已随音乐 app 旧实现一起删除（见音乐 app 的 FIX11 替换）。
   持久化键 phone_music_echo_v1（新键，与 phone_music_list_v1 不撞名）：
   { tracks: [{name, url} × 3], index, loop, volume }，改完重启还在。
   <audio> 是模块持有的单例：bind 时移进当前 .ins-echo，app _refresh 重建 DOM
   也不会断播；同一时间只会有一个 audio 元素在播。
   封面是外链，打不开时换成本机自画银灰封面（SVG data URI），不留破图。
   Google Fonts 走 CDN（见 FIX11 样式块首行 @import），离线时用字体栈兜底。 */
(function () {
'use strict';
var MARKER = 'GROUP-FIX11';
var KEY = 'phone_music_echo_v1';
var COVER_URL = 'https://img.0108071.xyz/file/aNxT1zQ8.jpg';
var DEFAULT_TRACKS = [
  { name: '春风秋雨', url: 'https://music.163.com/song/media/outer/url?id=1319703763.mp3' },
  { name: 'Loving Strangers', url: 'https://music.163.com/song/media/outer/url?id=2788529.mp3' },
  { name: '七友', url: 'https://music.163.com/song/media/outer/url?id=118261.mp3' }
];
var SIDES = ['A', 'B', 'C'];
/* 自画银灰封面（封面外链打不开时的本地兜底）：银灰渐变 + 黑胶圆 + still here. */
var COVER_FALLBACK = 'data:image/svg+xml;charset=utf-8,' +
  '%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27500%27 viewBox=%270 0 400 500%27%3E' +
  '%3Cdefs%3E%3ClinearGradient id=%27g%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E' +
  '%3Cstop offset=%270%27 stop-color=%27%23edf1f7%27/%3E%3Cstop offset=%271%27 stop-color=%27%23bac7d8%27/%3E%3C/linearGradient%3E%3C/defs%3E' +
  '%3Crect width=%27400%27 height=%27500%27 fill=%27url(%23g)%27/%3E' +
  '%3Ccircle cx=%27200%27 cy=%27210%27 r=%27130%27 fill=%27%23343a45%27/%3E' +
  '%3Ccircle cx=%27200%27 cy=%27210%27 r=%27128%27 fill=%27none%27 stroke=%27%23e6ebf4%27 stroke-width=%272%27/%3E' +
  '%3Ccircle cx=%27200%27 cy=%27210%27 r=%2790%27 fill=%27none%27 stroke=%27%23e6ebf4%27 stroke-opacity=%270.35%27/%3E' +
  '%3Ccircle cx=%27200%27 cy=%27210%27 r=%2730%27 fill=%27%23dfe6f0%27/%3E' +
  '%3Ccircle cx=%27200%27 cy=%27210%27 r=%278%27 fill=%27%238192ac%27/%3E' +
  '%3Ctext x=%27200%27 y=%27420%27 text-anchor=%27middle%27 font-family=%27Georgia,serif%27 font-style=%27italic%27 font-size=%2734%27 fill=%27%2365728b%27%3Estill here.%3C/text%3E' +
  '%3Ctext x=%27200%27 y=%27452%27 text-anchor=%27middle%27 font-family=%27Georgia,serif%27 font-size=%2713%27 letter-spacing=%274%27 fill=%27%239aa9be%27%3ESOME THINGS NEVER FADE%3C/text%3E' +
  '%3C/svg%3E';

var audio = document.createElement('audio');
audio.className = 'echo-audio';
audio.preload = 'none';
try { audio.setAttribute('playsinline', ''); } catch (e) {}
audio.hidden = true;

var root = null;
var serial = 0;
var noticeTimer = null;
var startedAt = 0;
var everPlayed = false;
var audioBound = false;
var mediaAttached = false;
var customNow = null; /* {name, artist, trackId}：播本地/一起听曲目时的临时今曲；选回银灰三首即清空 */

function readState() {
  var st = { tracks: DEFAULT_TRACKS.slice(), index: 0, loop: false, volume: 0.9 };
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.tracks)) {
      var ts = [];
      for (var i = 0; i < 3; i++) {
        var t = raw.tracks[i] || {};
        ts.push({
          name: (typeof t.name === 'string' && t.name.trim()) ? t.name.trim() : DEFAULT_TRACKS[i].name,
          url: (typeof t.url === 'string') ? t.url.trim() : DEFAULT_TRACKS[i].url
        });
      }
      st.tracks = ts;
    }
    if (raw && typeof raw.index === 'number' && raw.index >= 0 && raw.index < 3) st.index = raw.index;
    if (raw && typeof raw.loop === 'boolean') st.loop = raw.loop;
    if (raw && typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) st.volume = raw.volume;
  } catch (e) {}
  return st;
}
var state = readState();
function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
audio.volume = state.volume;
audio.loop = !!state.loop;

function q(sel) { try { return root ? root.querySelector(sel) : null; } catch (e) { return null; } }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function time(n) {
  if (!Number.isFinite(n)) return '--:--';
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(Math.floor(n % 60)).padStart(2, '0');
}
function hasSource(i) { return !!(state.tracks[i] && state.tracks[i].url && state.tracks[i].url.trim()); }
function displayName(i) {
  var t = state.tracks[i];
  return (t && t.name) ? t.name : ('曲目 ' + String(i + 1).padStart(2, '0'));
}
function curTitle() { return customNow ? customNow.name : displayName(state.index); }
function curArtist() { return customNow ? (customNow.artist || '') : ''; }
function curTrackId() { return customNow ? customNow.trackId : ('echo-' + state.index); }
function isPlaying() { try { return !audio.paused && !audio.ended; } catch (e) { return false; } }

function notice(message) {
  try {
    var el = q('.echo-status');
    if (!el) return;
    clearTimeout(noticeTimer);
    el.textContent = message || '';
    el.hidden = !message;
    if (message) noticeTimer = setTimeout(function () { try { el.hidden = true; } catch (e) {} }, 4500);
  } catch (e) {}
}
function refreshHero() {
  try { if (window.GroupFIX2 && GroupFIX2.renderHero) GroupFIX2.renderHero(); } catch (e) {}
}
function syncIsland() {
  try {
    if (!window.DynamicIsland || !DynamicIsland.showActivity) return;
    if (!everPlayed && !isPlaying()) return; /* 没放过就不在灵动岛占位 */
    var playing = isPlaying();
    DynamicIsland.showActivity({
      type: 'music', title: curTitle(), artist: curArtist(), trackId: curTrackId(),
      playing: playing, paused: !playing, startedAt: startedAt || Date.now()
    });
  } catch (e) {}
}
function applyDeck() {
  try {
    var title = q('.echo-title');
    if (title) title.textContent = curTitle();
    var side = q('.echo-side');
    if (side) side.textContent = customNow ? 'SIDE \u2013' : ('SIDE ' + SIDES[state.index]);
    var tabs = root ? root.querySelectorAll('[data-track]') : [];
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-pressed', String(!customNow && Number(tabs[i].getAttribute('data-track')) === state.index));
    }
  } catch (e) {}
}
function applyVolumeUI() {
  try {
    var vol = q('.fix11-vol-range');
    if (vol) {
      vol.value = String(Math.round(state.volume * 100));
      vol.style.setProperty('--fill', (state.volume * 100) + '%');
    }
    var val = q('.fix11-vol-val');
    if (val) val.textContent = Math.round(state.volume * 100) + '%';
  } catch (e) {}
}
function stateUI() {
  try {
    if (!root) return;
    var playing = isPlaying();
    root.classList.toggle('is-playing', playing);
    var play = q('.echo-play');
    if (play) play.setAttribute('aria-label', playing ? '暂停' : '播放');
  } catch (e) {}
  syncIsland();
  refreshHero();
}
function progress() {
  try {
    if (!root) return;
    var seek = q('.echo-seek:not(.fix11-vol-range)');
    var valid = Number.isFinite(audio.duration) && audio.duration > 0;
    var ratio = valid ? (audio.currentTime / audio.duration) : 0;
    if (seek) {
      seek.disabled = !valid;
      seek.value = String(Math.round(ratio * 1000));
      seek.style.setProperty('--fill', (ratio * 100) + '%');
      seek.setAttribute('aria-valuetext', time(audio.currentTime) + (valid ? ' / ' + time(audio.duration) : ''));
    }
    var cur = q('.echo-current');
    if (cur) cur.textContent = time(audio.currentTime);
    var dur = q('.echo-duration');
    if (dur) dur.textContent = valid ? time(audio.duration) : '--:--';
  } catch (e) {}
}
function safeLoad() { try { audio.load(); } catch (e) {} }

function select(next, autoplay) {
  serial++;
  customNow = null;
  try { audio.pause(); } catch (e) {}
  state.index = ((next % state.tracks.length) + state.tracks.length) % state.tracks.length;
  startedAt = Date.now();
  try { audio.removeAttribute('src'); } catch (e) {}
  safeLoad();
  notice('');
  applyDeck();
  var seek = q('.echo-seek:not(.fix11-vol-range)');
  if (seek) { seek.value = '0'; seek.disabled = true; seek.style.setProperty('--fill', '0%'); seek.setAttribute('aria-valuetext', '00:00'); }
  var cur = q('.echo-current'); if (cur) cur.textContent = '00:00';
  var dur = q('.echo-duration'); if (dur) dur.textContent = '--:--';
  if (hasSource(state.index)) { try { audio.src = state.tracks[state.index].url.trim(); } catch (e) {} }
  saveState();
  stateUI();
  if (autoplay) start();
}
/* 接 GroupP 的节拍指示：真实音频走 MediaElementSource + AnalyserNode；
   接不上（无 AudioContext / 已接过）也不影响播放，指示只是不跳。 */
function attachAnalyser() {
  if (mediaAttached) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    try { if (ctx.resume) { var rp = ctx.resume(); if (rp && rp.catch) rp.catch(function () {}); } } catch (e) {}
    var src = ctx.createMediaElementSource(audio);
    var an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    an.connect(ctx.destination);
    if (window.GroupP && GroupP.musicAttach) GroupP.musicAttach(ctx, an);
    mediaAttached = true;
  } catch (e) {}
}
function start() {
  if (!hasSource(state.index)) {
    notice('第 ' + (state.index + 1) + ' 首还没有填写音乐链接。');
    return Promise.resolve(false);
  }
  if (!audio.getAttribute('src')) { try { audio.src = state.tracks[state.index].url.trim(); } catch (e) {} }
  var token = serial;
  everPlayed = true;
  attachAnalyser();
  var p = null;
  try { p = audio.play(); } catch (err) {
    stateUI();
    notice('暂时无法播放，请检查这首歌的链接。');
    return Promise.resolve(false);
  }
  if (p && typeof p.then === 'function') {
    return p.then(function () {
      if (token !== serial) return false;
      notice('');
      stateUI();
      return true;
    }).catch(function (err) {
      if (token !== serial || (err && err.name === 'AbortError')) return false;
      stateUI();
      notice(err && err.name === 'NotAllowedError' ? '请再点一次播放。' : '暂时无法播放，请检查这首歌的链接。');
      return false;
    });
  }
  stateUI();
  return Promise.resolve(true);
}
function move(delta) {
  var wasPlaying = isPlaying();
  select(state.index + delta, wasPlaying);
}
function toggle() {
  if (audio.paused) { start(); } else { try { audio.pause(); } catch (e) {} }
  var playing = isPlaying();
  stateUI();
  return { playing: playing, title: curTitle(), artist: curArtist(), trackId: curTrackId() };
}
function stop() {
  try { audio.pause(); } catch (e) {}
  stateUI();
}
function playCustom(t) {
  t = t || {};
  var name = String(t.name || '').trim() || '曲目';
  if (!t.url || !String(t.url).trim()) {
    notice('\u300c' + name + '\u300d还没有可播放的链接。');
    return Promise.resolve(false);
  }
  serial++;
  customNow = { name: name, artist: String(t.artist || ''), trackId: String(t.trackId || ('custom-' + name)) };
  startedAt = Date.now();
  try { audio.pause(); } catch (e) {}
  try { audio.src = String(t.url).trim(); } catch (e) {}
  notice('');
  applyDeck();
  everPlayed = true;
  attachAnalyser();
  var token = serial;
  var p = null;
  try { p = audio.play(); } catch (err) {
    stateUI();
    notice('暂时无法播放，请检查这首歌的链接。');
    return Promise.resolve(false);
  }
  if (p && typeof p.then === 'function') {
    return p.then(function () {
      if (token !== serial) return false;
      notice('');
      stateUI();
      return true;
    }).catch(function (err) {
      if (token !== serial || (err && err.name === 'AbortError')) return false;
      stateUI();
      notice(err && err.name === 'NotAllowedError' ? '请再点一次播放。' : '暂时无法播放，请检查这首歌的链接。');
      return false;
    });
  }
  stateUI();
  return Promise.resolve(true);
}
function getTracks() {
  return state.tracks.map(function (t) { return { name: t.name, url: t.url }; });
}
function setTracks(list) {
  if (!Array.isArray(list)) return false;
  var wasPlaying = isPlaying();
  for (var i = 0; i < 3; i++) {
    var t = list[i] || {};
    state.tracks[i] = {
      name: (typeof t.name === 'string' && t.name.trim()) ? t.name.trim() : DEFAULT_TRACKS[i].name,
      url: (typeof t.url === 'string') ? t.url.trim() : ''
    };
  }
  saveState();
  select(state.index, wasPlaying);
  return true;
}
function resetTracks() {
  state.tracks = DEFAULT_TRACKS.map(function (t) { return { name: t.name, url: t.url }; });
  saveState();
  var wasPlaying = isPlaying();
  select(state.index, wasPlaying);
  return true;
}
function getState() {
  return {
    title: curTitle(), artist: curArtist(), trackId: curTrackId(),
    index: state.index, loop: !!state.loop, volume: state.volume,
    playing: isPlaying(),
    state: isPlaying() ? 'playing' : (everPlayed ? 'paused' : 'idle')
  };
}
function bindAudioEvents() {
  ['play', 'pause', 'ended'].forEach(function (ev) { audio.addEventListener(ev, stateUI); });
  ['timeupdate', 'loadedmetadata', 'durationchange'].forEach(function (ev) { audio.addEventListener(ev, progress); });
  audio.addEventListener('ended', function () {
    if (audio.loop) return;
    for (var step = 1; step <= state.tracks.length; step++) {
      var next = (state.index + step) % state.tracks.length;
      if (hasSource(next)) { select(next, true); return; }
    }
  });
  audio.addEventListener('error', function () {
    if (audio.error && hasSource(state.index) && !customNow) {
      stateUI();
      notice('暂时无法播放，请检查这首歌的链接。');
    }
  });
}
function bind(r) {
  if (!r || !r.classList || !r.classList.contains('ins-echo')) return false;
  root = r;
  if (audio.parentNode !== root) { try { root.appendChild(audio); } catch (e) {} }
  if (!audioBound) { bindAudioEvents(); audioBound = true; }
  /* 封面外链兜底：打不开就换成本机自画银灰封面 */
  try {
    var img = root.querySelector('.echo-photo img');
    if (img) {
      if (img.getAttribute('src') !== COVER_URL && img.dataset.fix11Cover !== 'fallback') img.setAttribute('src', COVER_URL);
      if (img.dataset.fix11Cover !== 'fallback') {
        img.addEventListener('error', function () {
          try { img.dataset.fix11Cover = 'fallback'; img.setAttribute('src', COVER_FALLBACK); } catch (e) {}
        });
        if (img.complete && img.naturalWidth === 0) {
          img.dataset.fix11Cover = 'fallback';
          img.setAttribute('src', COVER_FALLBACK);
        }
      }
    }
  } catch (e) {}
  try {
    var play = q('.echo-play');
    if (play) play.addEventListener('click', function () { if (audio.paused) start(); else { try { audio.pause(); } catch (e) {} } });
    var prev = q('.echo-prev');
    if (prev) prev.addEventListener('click', function () { move(-1); });
    var next = q('.echo-next');
    if (next) next.addEventListener('click', function () { move(1); });
    var tabs = root.querySelectorAll('[data-track]');
    for (var i = 0; i < tabs.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { select(Number(btn.getAttribute('data-track')), isPlaying()); });
      })(tabs[i]);
    }
    var rep = q('.echo-repeat');
    if (rep) rep.addEventListener('click', function (ev) {
      audio.loop = !audio.loop;
      state.loop = !!audio.loop;
      saveState();
      ev.currentTarget.setAttribute('aria-pressed', String(audio.loop));
      ev.currentTarget.setAttribute('aria-label', audio.loop ? '关闭单曲循环' : '开启单曲循环');
      ev.currentTarget.title = audio.loop ? '当前：单曲循环' : '当前：列表循环';
    });
    var seek = q('.echo-seek:not(.fix11-vol-range)');
    if (seek) seek.addEventListener('input', function () {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        try { audio.currentTime = Number(seek.value) / 1000 * audio.duration; } catch (e) {}
        progress();
      }
    });
    var vol = q('.fix11-vol-range');
    if (vol) vol.addEventListener('input', function () {
      var v = Math.max(0, Math.min(100, Number(vol.value) || 0)) / 100;
      state.volume = v;
      try { audio.volume = v; } catch (e) {}
      saveState();
      applyVolumeUI();
    });
  } catch (e) {}
  try {
    var rep0 = q('.echo-repeat');
    if (rep0) {
      rep0.setAttribute('aria-pressed', String(!!state.loop));
      rep0.setAttribute('aria-label', state.loop ? '关闭单曲循环' : '开启单曲循环');
      rep0.title = state.loop ? '当前：单曲循环' : '当前：列表循环';
    }
  } catch (e) {}
  applyDeck();
  applyVolumeUI();
  stateUI();
  progress();
  return true;
}
try {
  window.addEventListener('storage', function (e) {
    if (e && e.key === KEY) {
      state = readState();
      try { audio.volume = state.volume; audio.loop = !!state.loop; } catch (err) {}
      applyDeck();
      applyVolumeUI();
      stateUI();
      progress();
    }
  });
} catch (e) {}

window.GroupFIX11 = {
  MARKER: MARKER, version: 1, KEY: KEY, COVER_URL: COVER_URL,
  getState: getState, getTracks: getTracks, setTracks: setTracks, resetTracks: resetTracks,
  bind: bind, toggle: toggle, stop: stop, play: start, pause: function () { try { audio.pause(); } catch (e) {} stateUI(); },
  next: function () { move(1); }, prev: function () { move(-1); },
  select: select, playCustom: playCustom, _audio: function () { return audio; }
};
})();
