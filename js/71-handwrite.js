/* GROUP-HANDWRITE: pet-name handwriting animation (single entry: GroupHandwrite.write).
   ── How it works ──
   · Each character is drawn stroke by stroke, in writing order, as single-line
     SVG paths: joined Latin letters first, then i-dots / t-crosses; Chinese in
     standard stroke order (medians from the vendored dataset).
   · Each stroke is hidden behind a dash exactly as long as itself; the dash
     slides away at ONE steady pen speed (longer strokes take longer), with a
     short pause where the pen lifts. A small pen rides the stroke tip
     (getPointAtLength) when showPen is on.
   · Screen readers get the word as text (visually-hidden span + aria-label).
   · prefers-reduced-motion → the finished word fades in instead of writing.
   ── Stroke data ──
   · Chinese: window.__HANDWRITE_STROKES (js/71-handwrite-data.js) — 840 common
     characters vendored from hanzi-writer-data 2.0.1 (Make Me a Hanzi, ARPHIC
     Public License), centerlines only, 1024x1024 space, stroke order kept.
     Characters outside the subset fall back to fade-in, never block.
   · Latin a-z / A-Z / 0-9: simple hand-authored print letterforms below
     (0–100 grid, scaled to the same 1024 space). Not a font — plain strokes.
   ── Defaults (per spec) ──
   ink BLUE (#2563eb), pen size MEDIUM, pen shown, speed NORMAL. No frameworks. */
(function () {
'use strict';
var DEFAULTS = { ink: '#2563eb', size: 'medium', showPen: true, speed: 'normal' };
var SPEEDS = { slow: 700, normal: 1400, fast: 2800 }; /* 1024-space units per second —
   calibrated on the vendored data (median stroke ≈ 360 units, p90 ≈ 760):
   Normal ≈ 250 ms per median stroke, longest strokes capped at 900 ms. */
var SIZES = { small: 34, medium: 54, large: 78 }; /* stroke-width in 1024 units */
var LIFT_PAUSE_MS = 90; /* pause where the pen lifts between strokes */
var CHAR_GAP_MS = 160; /* pause between characters */
var MAX_CHARS = 12;

/* Latin print letterforms, 0–100 grid (cap top 18, x-height top 32–44,
   baseline 78, descender 94). Each letter = array of strokes; each stroke =
   array of [x, y] points in stroke order (i-dots / t-crosses last). */
var LATIN = {
  'a': [[[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]], [[60,44],[60,78]]],
  'b': [[[30,18],[30,78]], [[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]]],
  'c': [[[58,48],[48,42],[36,44],[30,54],[30,68],[36,76],[48,78],[58,72]]],
  'd': [[[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]], [[60,78],[60,18]]],
  'e': [[[56,64],[34,64],[30,54],[38,44],[52,44],[60,54],[58,66],[50,74],[38,74]]],
  'f': [[[58,78],[58,30],[52,20],[42,20],[36,26]], [[30,40],[58,40]]],
  'g': [[[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]], [[60,52],[60,80],[52,94],[40,94],[34,88]]],
  'h': [[[30,18],[30,78]], [[30,52],[38,44],[52,44],[60,52],[60,78]]],
  'i': [[[45,44],[45,78]], [[45,30],[45,32]]],
  'j': [[[55,44],[55,80],[48,94],[38,94]], [[55,30],[55,32]]],
  'k': [[[30,18],[30,78]], [[58,44],[32,62],[58,78]]],
  'l': [[[45,18],[45,78]]],
  'm': [[[30,78],[30,44],[38,44],[46,52],[46,78]], [[46,44],[56,44],[62,52],[62,78]]],
  'n': [[[30,78],[30,44],[40,44],[48,52],[48,78]]],
  'o': [[[45,44],[58,52],[58,68],[45,78],[32,68],[32,52],[45,44]]],
  'p': [[[30,44],[30,94]], [[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]]],
  'q': [[[30,52],[38,44],[52,44],[60,52],[60,70],[52,78],[38,78],[30,70],[30,52]], [[60,52],[60,94]]],
  'r': [[[30,78],[30,44],[40,44],[48,50]]],
  's': [[[56,50],[46,44],[36,48],[34,56],[40,62],[52,66],[58,72],[52,78],[40,78],[32,72]]],
  't': [[[48,22],[48,78]], [[32,52],[62,52]]],
  'u': [[[30,44],[30,70],[38,78],[52,78],[60,70],[60,44]]],
  'v': [[[28,44],[45,78],[62,44]]],
  'w': [[[28,44],[38,78],[48,52],[58,78],[68,44]]],
  'x': [[[30,44],[60,78]], [[60,44],[30,78]]],
  'y': [[[28,44],[45,70],[62,44]], [[45,70],[45,92],[36,94]]],
  'z': [[[30,44],[60,44],[30,78],[60,78]]],
  'A': [[[20,78],[45,18],[70,78]], [[32,56],[58,56]]],
  'B': [[[30,18],[30,78]], [[30,18],[55,18],[66,28],[66,42],[52,48],[66,54],[66,68],[55,78],[30,78]]],
  'C': [[[62,28],[50,18],[36,22],[30,36],[30,62],[38,74],[54,78],[64,70]]],
  'D': [[[30,18],[30,78]], [[30,18],[52,18],[68,34],[68,62],[52,78],[30,78]]],
  'E': [[[62,18],[30,18],[30,78],[62,78]], [[30,48],[52,48]]],
  'F': [[[62,18],[30,18],[30,78]], [[30,48],[52,48]]],
  'G': [[[62,28],[50,18],[36,22],[30,36],[30,62],[38,74],[54,78],[66,68],[66,52],[52,52]]],
  'H': [[[30,18],[30,78]], [[62,18],[62,78]], [[30,48],[62,48]]],
  'I': [[[30,18],[62,18]], [[46,18],[46,78]], [[30,78],[62,78]]],
  'J': [[[28,30],[60,30]], [[50,30],[50,70],[44,78],[34,78]]],
  'K': [[[30,18],[30,78]], [[60,18],[32,52],[62,78]]],
  'L': [[[30,18],[30,78],[62,78]]],
  'M': [[[30,78],[30,18],[46,52],[62,18],[62,78]]],
  'N': [[[30,78],[30,18],[62,78],[62,18]]],
  'O': [[[46,18],[62,30],[62,66],[46,78],[30,66],[30,30],[46,18]]],
  'P': [[[30,18],[30,78]], [[30,18],[56,18],[66,28],[66,42],[56,50],[30,50]]],
  'Q': [[[46,18],[62,30],[62,66],[46,78],[30,66],[30,30],[46,18]], [[58,66],[74,80]]],
  'R': [[[30,18],[30,78]], [[30,18],[56,18],[66,28],[66,42],[56,50],[30,50]], [[54,50],[70,78]]],
  'S': [[[62,26],[50,18],[36,20],[30,30],[36,40],[52,46],[62,52],[62,66],[52,78],[36,78],[28,70]]],
  'T': [[[24,18],[68,18]], [[46,18],[46,78]]],
  'U': [[[30,18],[30,64],[38,78],[54,78],[62,64],[62,18]]],
  'V': [[[28,18],[46,78],[64,18]]],
  'W': [[[24,18],[34,78],[46,40],[58,78],[68,18]]],
  'X': [[[30,18],[62,78]], [[62,18],[30,78]]],
  'Y': [[[30,18],[46,48],[62,18]], [[46,48],[46,78]]],
  'Z': [[[30,18],[62,18],[30,78],[62,78]]],
  '0': [[[46,18],[62,30],[62,66],[46,78],[30,66],[30,30],[46,18]]],
  '1': [[[38,30],[48,18],[48,78]], [[32,78],[62,78]]],
  '2': [[[30,28],[36,18],[54,18],[62,28],[62,40],[30,78],[62,78]]],
  '3': [[[30,26],[38,18],[54,18],[62,26],[58,40],[48,44],[58,48],[62,56],[56,78],[40,78],[30,70]]],
  '4': [[[56,18],[34,52],[58,52]], [[52,18],[52,78]]],
  '5': [[[62,18],[32,18],[32,48],[54,48],[64,56],[64,68],[54,78],[36,78],[30,70]]],
  '6': [[[60,24],[48,18],[34,30],[30,48],[30,66],[38,78],[54,78],[62,66],[62,54],[52,48],[38,50]]],
  '7': [[[30,18],[62,18],[44,78]]],
  '8': [[[46,18],[58,26],[58,40],[46,48],[34,40],[34,26],[46,18]], [[46,48],[62,56],[62,68],[46,78],[30,68],[30,56],[46,48]]],
  '9': [[[46,18],[60,26],[60,44],[52,54],[38,54],[30,44],[30,30],[46,18]], [[60,44],[60,78]]]
};

function strokesFor(ch) {
  var data = window.__HANDWRITE_STROKES || null;
  if (data && data[ch]) return { kind: 'path', strokes: data[ch] };
  if (LATIN[ch]) {
    var paths = LATIN[ch].map(function (pts) {
      return 'M' + pts.map(function (p) {
        return Math.round(p[0] * 10.24) + ' ' + Math.round(p[1] * 10.24);
      }).join('L');
    });
    return { kind: 'path', strokes: paths };
  }
  return null;
}
function reducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function renderFinished(el, text, opts) {
  /* Finished word, no animation: plain text, faded in. Used for
     prefers-reduced-motion and for characters with no stroke data. */
  el.innerHTML = '<span class="hw-word" style="opacity:0;transition:opacity 300ms ease;">' + esc(text) + '</span>'
    + '<span class="hw-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;">' + esc(text) + '</span>';
  el.setAttribute('aria-label', text);
  el.setAttribute('data-hw-text', text);
  requestAnimationFrame(function () {
    try { var w = el.querySelector('.hw-word'); if (w) w.style.opacity = '1'; } catch (e) {}
  });
  return { ok: true, mode: 'fade', chars: String(text).length, missing: [] };
}

function write(el, text, opts) {
  if (!el || typeof text !== 'string') return { ok: false, reason: 'bad-args' };
  text = text.replace(/^\s+|\s+$/g, '');
  if (!text) { try { el.innerHTML = ''; } catch (e) {} return { ok: false, reason: 'empty' }; }
  var chars = Array.from ? Array.from(text) : text.split('');
  if (chars.length > MAX_CHARS) chars = chars.slice(0, MAX_CHARS);
  text = chars.join('');
  opts = opts || {};
  var ink = opts.ink || DEFAULTS.ink;
  var size = SIZES[opts.size] || SIZES[DEFAULTS.size];
  var showPen = (opts.showPen === undefined) ? DEFAULTS.showPen : !!opts.showPen;
  var speed = SPEEDS[opts.speed] || SPEEDS[DEFAULTS.speed];

  /* Cancel any animation still running on this element. */
  try { if (el._hwToken) { el._hwToken.cancelled = true; if (el._hwToken.raf) cancelAnimationFrame(el._hwToken.raf); } } catch (e) {}
  var token = { cancelled: false, raf: 0 };
  el._hwToken = token;

  /* Screen readers get the word as text, not the strokes. */
  if (reducedMotion()) return renderFinished(el, text, opts);

  var missing = [];
  var html = '';
  var charHasStrokes = [];
  chars.forEach(function (ch) {
    if (ch === ' ') { html += '<span class="hw-space" style="display:inline-block;width:.5em;" aria-hidden="true"></span>'; charHasStrokes.push(false); return; }
    var found = strokesFor(ch);
    if (!found) {
      missing.push(ch);
      html += '<span class="hw-fade" style="display:inline-block;opacity:0;transition:opacity 300ms ease;" aria-hidden="true">' + esc(ch) + '</span>';
      charHasStrokes.push(false);
      return;
    }
    var paths = found.strokes.map(function (d) {
      return '<path d="' + esc(d) + '" fill="none" stroke="' + esc(ink) + '" stroke-width="' + size + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    html += '<svg class="hw-char" viewBox="0 0 1024 1024" style="width:1em;height:1em;vertical-align:-.12em;overflow:visible;" aria-hidden="true">' + paths + '</svg>';
    charHasStrokes.push(true);
  });
  html += '<span class="hw-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;">' + esc(text) + '</span>';
  el.innerHTML = html;
  el.setAttribute('aria-label', text);
  el.setAttribute('data-hw-text', text);
  try { if (!el.style.position || el.style.position === 'static') el.style.position = 'relative'; } catch (e) {}

  /* If nothing has stroke data, just fade the whole word in. */
  var anyStrokes = charHasStrokes.indexOf(true) >= 0;
  if (!anyStrokes) {
    requestAnimationFrame(function () {
      if (token.cancelled) return;
      try { var f = el.querySelectorAll('.hw-fade'); for (var i = 0; i < f.length; i++) f[i].style.opacity = '1'; } catch (e) {}
    });
    return { ok: true, mode: 'fade', chars: chars.length, missing: missing };
  }

  var pen = null;
  if (showPen) {
    pen = document.createElement('div');
    pen.className = 'hw-pen';
    pen.setAttribute('aria-hidden', 'true');
    pen.style.cssText = 'position:absolute;left:0;top:0;width:18px;height:18px;pointer-events:none;z-index:2;display:none;';
    pen.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 21 L6.5 14.5 L15 6 L18 3 L21 6 L12.5 15.5 Z" fill="#1e3a8a"/><path d="M3 21 L6.5 14.5 L12.5 15.5 Z" fill="#2563eb"/></svg>';
    el.appendChild(pen);
  }

  /* Build the stroke timeline: each stroke gets start/duration from its own
     length at one steady pen speed; lift pauses between strokes, char gaps
     between characters; no-stroke chars fade in when their turn comes. */
  var svgs = el.querySelectorAll('svg.hw-char');
  var fades = el.querySelectorAll('.hw-fade');
  var plan = [];
  var t = 0;
  var svgIdx = 0, fadeIdx = 0;
  chars.forEach(function (ch) {
    if (ch === ' ') { t += CHAR_GAP_MS; return; }
    var found = strokesFor(ch);
    if (!found) {
      plan.push({ type: 'fade', el: fades[fadeIdx++], at: t });
      t += CHAR_GAP_MS;
      return;
    }
    var svg = svgs[svgIdx++];
    var paths = svg.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      var len = 0;
      try { len = paths[i].getTotalLength(); } catch (e) { len = 0; }
      if (!len) continue;
      var dur = Math.max(110, Math.min(900, len / speed * 1000));
      plan.push({ type: 'stroke', el: paths[i], len: len, at: t, dur: dur, svg: svg });
      t += dur + LIFT_PAUSE_MS;
    }
    t += CHAR_GAP_MS;
  });
  plan.forEach(function (p) {
    if (p.type !== 'stroke') return;
    try { p.el.style.strokeDasharray = String(p.len); p.el.style.strokeDashoffset = String(p.len); } catch (e) {}
  });

  var doneResolve;
  var finished = new Promise(function (resolve) { doneResolve = resolve; });
  var total = t;
  var startAt = null;
  var penAt = function (now) {
    if (!pen) return;
    var active = null;
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p.type !== 'stroke') continue;
      if (now >= p.at && now < p.at + p.dur) { active = p; break; }
      if (now < p.at) break;
    }
    if (!active) { pen.style.display = 'none'; return; }
    var prog = Math.max(0, Math.min(1, (now - active.at) / active.dur));
    var pt = null;
    try { pt = active.el.getPointAtLength(active.len * prog); } catch (e) { pt = null; }
    if (!pt) { pen.style.display = 'none'; return; }
    var r = null, er = null;
    try { r = active.svg.getBoundingClientRect(); er = el.getBoundingClientRect(); } catch (e) {}
    if (!r || !er) { pen.style.display = 'none'; return; }
    var x = (r.left - er.left) + pt.x / 1024 * r.width;
    var y = (r.top - er.top) + pt.y / 1024 * r.height;
    pen.style.display = 'block';
    pen.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 15) + 'px)';
  };
  var tick = function (now) {
    if (token.cancelled) return;
    if (startAt === null) startAt = now;
    var rel = now - startAt;
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p.type === 'stroke') {
        var prog = Math.max(0, Math.min(1, (rel - p.at) / p.dur));
        try { p.el.style.strokeDashoffset = String(p.len * (1 - prog)); } catch (e) {}
      } else if (p.type === 'fade' && rel >= p.at) {
        try { p.el.style.opacity = '1'; } catch (e) {}
      }
    }
    penAt(rel);
    if (rel < total) { token.raf = requestAnimationFrame(tick); return; }
    if (pen) pen.style.display = 'none';
    if (doneResolve) doneResolve({ ok: true, mode: 'write', chars: chars.length, missing: missing });
  };
  token.raf = requestAnimationFrame(tick);
  return { ok: true, mode: 'write', chars: chars.length, missing: missing, finished: finished, cancel: function () { token.cancelled = true; try { if (token.raf) cancelAnimationFrame(token.raf); } catch (e) {} } };
}

window.GroupHandwrite = {
  version: 'GroupHandwrite-v1',
  defaults: DEFAULTS,
  write: write,
  hasData: function (ch) { return !!strokesFor(ch); },
  strokesFor: strokesFor
};
})();
