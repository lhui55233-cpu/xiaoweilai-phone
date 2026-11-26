
/* ══════════════════════════════════════════════════════════════
   J组 · LocationGateway：微信“发送地址/位置”的本地网关
   只管设备位置与此刻地点提取，不碰其它功能；新增 localStorage 键
   只有一个：phone_location_last_v1（{lat,lng,accuracy,placeName,ts,source:'gps'}）。
   ── 关于 OpenClaw ──
   OpenClaw（github.com/openclaw/openclaw，MIT）是自托管 AI 助手框架
   （本地 Gateway + 聊天渠道 + companion 应用），不是地图服务，不提供
   定位/地图功能，且是 Node.js 网关程序，装不进单文件手机。
   这里只借鉴它的架构思路——“本地网关统一管设备动作”：所有定位动作
   都收敛到 LocationGateway 这一个入口，不直接散落在各处调用
   navigator.geolocation。没有运行 OpenClaw，也没有复制它的源码。
   ── 关于此刻地点提取 ──
   此刻的 ckExtractRealPlaces / ckBuildTimeline / ckSamplePlaces 活在
   AppManager.register('cike', …) 闭包内，全局 typeof 为 undefined，
   网关直接调不到，所以按同一份数据源（cike_cache_v1 + ck_diary_meta_v1，
   角色取 SystemStore.get('character')）和同一套规则（地点词正则、日记
   日期算 daysAgo、不足 4 条用示例补齐）在这里移植一份提取逻辑；
   地点词提取复用全局的 OtomeF.realPlaces（它是全局的，可直接调）。
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var LAST_KEY = 'phone_location_last_v1';
var GEO_TIMEOUT = 8000;                  // getCurrentPosition 超时：8 秒
var MANUAL_ATTACH_MS = 30 * 60 * 1000;   // 手动地点附上次坐标的有效期：30 分钟
var MATCH_KM = 2;                        // 最近已知地点匹配半径：2 公里

function readJSON(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmtCoord(n) { var v = Number(n); return isFinite(v) ? v.toFixed(5) : ''; }
function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
var ERR_TEXT = { denied: '未获得定位权限', timeout: '定位超时', unavailable: '定位失败，请稍后重试', unsupported: '设备不支持定位' };
function classify(err) {
  if (!err) return 'unavailable';
  if (err.code === 1) return 'denied';
  if (err.code === 2) return 'unavailable';
  if (err.code === 3) return 'timeout';
  var m = String(err.message || '').toLowerCase();
  if (/denied|permission/.test(m)) return 'denied';
  if (/timeout|timed out/.test(m)) return 'timeout';
  return 'unavailable';
}
function saveLast(p) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ lat: p.lat, lng: p.lng, accuracy: (p.accuracy != null ? p.accuracy : null), placeName: p.placeName || null, ts: Date.now(), source: 'gps' })); } catch (e) {}
  return true;
}
function getLast() {
  var v = readJSON(LAST_KEY, null);
  if (!v || !isFinite(v.lat) || !isFinite(v.lng)) return null;
  return v;
}

/* ── 此刻地点提取（移植版，见文件头注释）── */
var PLACE_RE = /(咖啡馆|咖啡店|书店|花店|公园|车站|电影院|餐厅|图书馆|海边|学校|面包房|便利店|商场|美术馆)/;
function placeFromText(text) { var m = String(text || '').match(PLACE_RE); return m ? m[1] : ''; }
function realPlaceWord(text) {
  try { if (typeof OtomeF !== 'undefined' && OtomeF.realPlaces) { var r = OtomeF.realPlaces({ '__loc__': text }); if (r && r.length) return r[0].place; } } catch (e) {}
  return placeFromText(text);
}
function fmtMD(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function daysAgoDate(daysAgo, nowMs) { var d = new Date(nowMs || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d; }
function samplePlaces(nowMs) { return []; // [AJ] 示例地点已清空
}
function roleName() { try { if (typeof SystemStore !== 'undefined' && SystemStore.get) return SystemStore.get('character') || ''; } catch (e) {} return ''; }
function extractRealPlaces(nowMs) {
  var out = [];
  try {
    var cache = readJSON('cike_cache_v1', {});
    var meta = readJSON('ck_diary_meta_v1', {});
    var role = roleName();
    var dm = meta[role + '::beside'];
    var diaryText = cache[role + '::beside'] || '';
    if (dm && dm.date) {
      var mm = String(dm.date).match(/(\d+)月(\d+)日/), daysAgo = null;
      if (mm) { var now = new Date(nowMs || Date.now()); now.setHours(0, 0, 0, 0); var d = new Date(now.getFullYear(), parseInt(mm[1], 10) - 1, parseInt(mm[2], 10)); daysAgo = Math.max(0, Math.round((now - d) / 86400000)); }
      out.push({ id: 'r-diary', place: placeFromText(diaryText) || '日记里的一天', dateLabel: dm.date, daysAgo: daysAgo, isSample: false, source: '日记', note: '日记里记下了这一天。' });
    }
    var tripText = cache[role + '::trip'] || '';
    if (tripText) out.push({ id: 'r-trip', place: realPlaceWord(tripText) || '相遇的地方', dateLabel: '最近', daysAgo: null, isSample: false, source: '相遇', note: '相遇的故事发生在这里。' });
  } catch (e) {}
  return out;
}
function buildTimeline(nowMs) {
  var list = extractRealPlaces(nowMs).slice(0, 4);
  // [AJ] 不再用示例地点补齐：只有真实记录才进时间线
  return list;
}

var LocationGateway = {
  LAST_KEY: LAST_KEY,
  ERR_TEXT: ERR_TEXT,
  classify: classify,
  getCurrent: function () {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject({ kind: 'unsupported', message: ERR_TEXT.unsupported }); return; }
      var done = false;
      var fail = function (kind) { if (done) return; done = true; reject({ kind: kind, message: ERR_TEXT[kind] || '定位失败' }); };
      var ok = function (pos) { if (done) return; done = true; var p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: (pos.coords.accuracy != null ? pos.coords.accuracy : null) }; try { saveLast(p); } catch (e) {} resolve(p); };
      var timer = setTimeout(function () { fail('timeout'); }, GEO_TIMEOUT + 500); // 超时兜底：系统回调一直不回也结算
      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) { clearTimeout(timer); ok(pos); },
          // 注意：错误回调里直接调 fail()，不要先置 done = true 再调 fail()——
          // fail() 内部以 done 守门，先置 true 会让 fail() 直接返回，Promise 永远不 settle（J组修过的 bug）。
          function (err) { clearTimeout(timer); fail(classify(err)); },
          { timeout: GEO_TIMEOUT, enableHighAccuracy: false, maximumAge: 0 });
      } catch (e) { clearTimeout(timer); fail('unavailable'); }
    });
  },
  getLast: getLast,
  saveLast: saveLast,
  nearestKnownPlace: function (lat, lng) {
    // 只认带真实经纬度 + 地点名的记录（上次定位、以前发过的位置消息）；
    // 此刻地点没有经纬度，不参与匹配。
    var cands = [];
    var last = getLast();
    if (last && last.placeName) cands.push({ placeName: last.placeName, lat: last.lat, lng: last.lng, from: 'last' });
    try {
      var store = (typeof AppRegistry !== 'undefined' && AppRegistry['wechat']) ? AppRegistry['wechat'].wxStore : null;
      (store && store.sessions || []).forEach(function (s) {
        (s.messages || []).forEach(function (m) {
          if (m && m.type === 'location' && isFinite(m.lat) && isFinite(m.lng) && (m.placeName || m.title)) cands.push({ placeName: m.placeName || m.title, lat: m.lat, lng: m.lng, from: 'message' });
        });
      });
    } catch (e) {}
    var best = null, bestD = MATCH_KM;
    cands.forEach(function (c) {
      var d = haversineKm(lat, lng, c.lat, c.lng);
      if (d <= bestD) { bestD = d; best = { placeName: c.placeName, distanceKm: +d.toFixed(2), from: c.from }; }
    });
    return best;
  },
  manualPlaces: function (nowMs) { return buildTimeline(nowMs); },
  charCurrentPlace: function (nowMs) {
    // 立体书首页“最后一次出现于××·N 天前”的同一数据：时间线第一条。
    // [AJ] 无真实记录时不再取示例首条，返回空状态。
    var tl = buildTimeline(nowMs);
    var first = tl[0] || null;
    if (!first) return { place: '', daysAgo: null, dateLabel: '', isSample: false, source: '', note: '还没有行踪记录', label: '还没有行踪记录，去相遇 / 写日记后，这里会出现他真实去过的地方。' };
    var label = '最后一次出现于' + first.place + '·' + (first.daysAgo == null ? '最近' : first.daysAgo + ' 天前');
    return { place: first.place, daysAgo: first.daysAgo, dateLabel: first.dateLabel, isSample: !!first.isSample, source: first.source || '', note: label, label: label };
  }
};
window.LocationGateway = LocationGateway;

/* ── 本地手绘地图卡片：内联 SVG，街道网格 + 绿图钉 + 地点名 + 坐标，零外链瓦片，离线可看 ── */
window.WxLocMap = {
  svgFor: function (m, opts) {
    opts = opts || {};
    var w = opts.large ? 320 : 220, h = opts.large ? 120 : 76;
    var title = (m && (m.title || m.placeName)) || '位置';
    var hasCoord = m && m.lat != null && m.lng != null && isFinite(m.lat) && isFinite(m.lng);
    var coordText = hasCoord ? (fmtCoord(m.lat) + ', ' + fmtCoord(m.lng)) : '坐标未提供';
    var cx = Math.round(w / 2), pinTop = Math.round(h * 0.30), i, j, grid = '';
    for (i = 1; i < 7; i++) grid += '<line x1="' + (i * Math.round(w / 7)) + '" y1="0" x2="' + (i * Math.round(w / 7)) + '" y2="' + h + '" stroke="#dfe9df" stroke-width="1"/>';
    for (j = 1; j < 3; j++) grid += '<line x1="0" y1="' + (j * Math.round(h / 3)) + '" x2="' + w + '" y2="' + (j * Math.round(h / 3)) + '" stroke="#dfe9df" stroke-width="1"/>';
    grid += '<line x1="0" y1="' + Math.round(h * 0.66) + '" x2="' + w + '" y2="' + Math.round(h * 0.66) + '" stroke="#ffffff" stroke-width="8"/>';
    grid += '<line x1="' + Math.round(w * 0.70) + '" y1="0" x2="' + Math.round(w * 0.70) + '" y2="' + h + '" stroke="#ffffff" stroke-width="8"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" style="display:block;background:#eef5ee;">'
      + grid
      + '<path d="M ' + cx + ' ' + (pinTop + 26) + ' C ' + (cx - 12) + ' ' + (pinTop + 12) + ' ' + (cx - 12) + ' ' + (pinTop - 8) + ' ' + cx + ' ' + (pinTop - 8) + ' C ' + (cx + 12) + ' ' + (pinTop - 8) + ' ' + (cx + 12) + ' ' + (pinTop + 12) + ' ' + cx + ' ' + (pinTop + 26) + ' Z" fill="#07C160"/>'
      + '<circle cx="' + cx + '" cy="' + (pinTop + 2) + '" r="5" fill="#ffffff"/>'
      + '<text x="' + cx + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="#2e7d32">' + esc(title) + '</text>'
      + '<text x="6" y="12" font-size="9" fill="#7a9a7a">' + esc(coordText) + '</text>'
      + '</svg>';
  }
};
})();
