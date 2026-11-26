/* GROUP-UI-VECTORS · 全站可见界面 emoji 转为线稿 SVG，不改动聊天/帖子/剧本原文。 */
(function (w, d) {
  'use strict';
  if (w.XwlUIVectors) return;

  var cp = {
    phone: [0x1F4DE, 0x1F4F1, 0x1F57F], mic: [0x1F399, 0x1F3A4], music: [0x1F3B5, 0x1F3B6],
    chat: [0x1F4AC, 0x1F4AD, 0x1F5E8, 0x1F4E2], mute: [0x1F507, 0x1F515], volume: [0x1F50A, 0x1F509],
    cat: [0x1F431, 0x1F63A, 0x1F638, 0x1F639, 0x1F63B, 0x1F63C, 0x1F63D, 0x1F640, 0x1F981],
    dog: [0x1F415, 0x1F436, 0x1F429], paw: [0x1F43E], person: [0x1F464, 0x1F465, 0x1F9D1, 0x1F9D2],
    book: [0x1F4D6, 0x1F4D7, 0x1F4D8, 0x1F4DA, 0x1F4D5, 0x1F4D9, 0x1F4D2, 0x1F4D1],
    file: [0x1F4C4, 0x1F4C3, 0x1F5CE, 0x1F4DD], folder: [0x1F4C1, 0x1F4C2], database: [0x1F5C4, 0x1F5C3],
    cloud: [0x2601, 0x1F4A8, 0x1F4E5], rain: [0x1F327, 0x1F326, 0x1F4A7, 0x1F30A],
    sun: [0x2600, 0x1F31E, 0x1F31D], moon: [0x1F319, 0x1F31B, 0x1F31C], flower: [0x1F338, 0x1F33C, 0x1F339, 0x1F33A],
    heart: [0x2764, 0x1F495, 0x1F49B, 0x1F49C, 0x1F49A], star: [0x2B50, 0x2605, 0x1F31F, 0x2728],
    bolt: [0x26A1, 0x1F50B], warning: [0x26A0], check: [0x2705, 0x2714, 0x2611], cross: [0x274C, 0x2716, 0x2718],
    mail: [0x2709, 0x1F48C, 0x1F4E8, 0x1F4E9, 0x1F4EC, 0x1F4EB, 0x1F4EA], lock: [0x1F512, 0x1F513],
    camera: [0x1F4F7, 0x1F4F8], image: [0x1F5BC, 0x1F3A8], game: [0x1F3AE, 0x1F579], pill: [0x1F48A],
    plug: [0x1F50C], tag: [0x1F3F7], card: [0x1F4C7, 0x1F4C6], cup: [0x2615, 0x1F375], tomato: [0x1F345],
    idea: [0x1F4A1], clock: [0x23F0, 0x1F552, 0x1F553], sparkle: [0x2728, 0x1F389, 0x1F38A],
    shield: [0x1F6E1], bell: [0x1F514], car: [0x1F697, 0x1F695], pin: [0x1F4CD], gift: [0x1F381],
    arrow: [0x1F4E4], suitcase: [0x1F4BC], printer: [0x1F5A8], box: [0x1F4E6],
    medal: [0x1F3C5, 0x1F947, 0x1F948, 0x1F949], crown: [0x1F451], diamond: [0x1F48E],
    face: [0x1F600, 0x1F601, 0x1F602, 0x1F603, 0x1F604, 0x1F605, 0x1F606, 0x1F609, 0x1F60A, 0x1F60B, 0x1F60C, 0x1F60D, 0x1F610, 0x1F611, 0x1F612, 0x1F614, 0x1F615, 0x1F616, 0x1F617, 0x1F618, 0x1F61A, 0x1F61C, 0x1F61D, 0x1F61E, 0x1F61F, 0x1F620, 0x1F621, 0x1F622, 0x1F623, 0x1F624, 0x1F625, 0x1F628, 0x1F629, 0x1F62A, 0x1F62B, 0x1F62D, 0x1F630, 0x1F631, 0x1F633, 0x1F634, 0x1F635, 0x1F636, 0x1F637, 0x1F641, 0x1F642, 0x1F643, 0x1F644, 0x1F910, 0x1F914, 0x1F917, 0x1F92D, 0x1F970],
    generic: []
  };
  var byCode = {};
  Object.keys(cp).forEach(function (name) { cp[name].forEach(function (n) { byCode[n.toString(16)] = name; }); });
  var paths = {
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-3.6 2.7-5.4 6.5-5.4s6 1.8 6.5 5.4"/>',
    face: '<circle cx="12" cy="12" r="9"/><path d="M8.5 10h.1m6.8 0h.1M8.5 15c1.1 1.5 2.3 2.2 3.5 2.2s2.4-.7 3.5-2.2"/>',
    cat: '<path d="M4.5 10 4 4l5 2.5a9 9 0 0 1 6 0L20 4l-.5 6a8 8 0 1 1-15 0Z"/><path d="M8.5 12h.1m6.8 0h.1M10 15.5c1.4 1.1 2.6 1.1 4 0m-4-2.4-4-1m8 0 4-1"/>',
    dog: '<path d="M5 9 3.8 5.5c-.3-1 1-1.7 1.8-1l3.2 2.3a10 10 0 0 1 6.4 0l3.2-2.3c.8-.7 2.1 0 1.8 1L19 9a7.5 7.5 0 0 1 1 3.8c0 4.6-3.3 7.4-8 7.4s-8-2.8-8-7.4A7.5 7.5 0 0 1 5 9Z"/><path d="M8.5 12h.1m6.8 0h.1M10 15.5c1.3 1 2.7 1 4 0"/>',
    paw: '<ellipse cx="12" cy="16.4" rx="5.5" ry="4.2"/><ellipse cx="5.8" cy="9.2" rx="1.8" ry="2.5"/><ellipse cx="10.1" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="14.4" cy="6.7" rx="1.8" ry="2.5"/><ellipse cx="18.6" cy="9.2" rx="1.8" ry="2.5"/>',
    phone: '<path d="M7.2 3.8h9.6a2 2 0 0 1 2 2v12.4a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z"/><path d="M9 6.5h6m-6 10h6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4m-3 0h6"/>',
    music: '<path d="M15 4v11.5a3.5 3.5 0 1 1-2-3.2V7l8-2v8.5a3.5 3.5 0 1 1-2-3.2V3.5Z"/>',
    book: '<path d="M4 5.5c3.2-.9 5.9-.3 8 1.5 2.1-1.8 4.8-2.4 8-1.5v14c-3.2-.8-5.9-.2-8 1.5-2.1-1.7-4.8-2.3-8-1.5Z"/><path d="M12 7v14m-5-12h2m6 0h2"/>',
    file: '<path d="M6 3.5h8l4 4V20H6Z"/><path d="M14 3.5v4h4M9 12h6m-6 3h6"/>',
    folder: '<path d="M3.5 6.5h6l2 2h9v10.8H3.5Z"/><path d="M3.5 9h17"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-12M4.5 11.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
    cloud: '<path d="M6.2 18.5h11.2a4 4 0 0 0 .2-8 6 6 0 0 0-11.6.9 3.6 3.6 0 0 0 .2 7.1Z"/>',
    rain: '<path d="M6 14.5h11a3.8 3.8 0 0 0 .2-7.6 5.8 5.8 0 0 0-11.2.8 3.4 3.4 0 0 0 0 6.8Z"/><path d="m8 17-1 3m6-3-1 3m6-3-1 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3m0 13v3m9.5-9.5h-3m-13 0h-3m16.2-6.7-2.1 2.1M6.4 17.6l-2.1 2.1m15.2 0-2.1-2.1M6.4 6.4 4.3 4.3"/>',
    moon: '<path d="M19.5 15.4A8.5 8.5 0 0 1 8.6 4.5 8.7 8.7 0 1 0 19.5 15.4Z"/>',
    flower: '<path d="M12 12c-4.5-1-5.3-4.2-3.2-5.3 1.5-.8 3.1.4 3.2 3.3.1-2.9 1.7-4.1 3.2-3.3 2.1 1.1 1.3 4.3-3.2 5.3 4.5-1 6.2 1.8 4.3 3.5-1.3 1.2-3.2.4-4.3-2.4 1.1 2.8.2 4.6-1.6 4.4-2.4-.2-3-3.4 1.6-6.2-4.6 2.8-7.1.7-5.8-1.5 1-1.6 3-.9 5.8 1.5Z"/><circle cx="12" cy="12" r="2"/>',
    heart: '<path d="M20.5 8.8c0 5-8.5 10.2-8.5 10.2S3.5 13.8 3.5 8.8c0-3.6 4.5-4.9 8.5-.8 4-4.1 8.5-2.8 8.5.8Z"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    bolt: '<path d="m13.5 2.5-8 11h6l-1 8 8-11h-6Z"/>',
    warning: '<path d="M12 3 2.7 20h18.6Z"/><path d="M12 9v5m0 3h.01"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>', cross: '<path d="m6 6 12 12M18 6 6 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    camera: '<path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9H2v-9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.2"/>',
    game: '<path d="M7 8h10a4 4 0 0 1 3.8 5.3l-1.4 4.2a2.5 2.5 0 0 1-4.2 1l-2-2h-2l-2 2a2.5 2.5 0 0 1-4.2-1l-1.4-4.2A4 4 0 0 1 7 8Z"/><path d="M8 11v4m-2-2h4m7-.5h.1m2 2h.1"/>',
    pill: '<path d="M7.2 18.8a5 5 0 0 1 0-7.1l4.5-4.5a5 5 0 1 1 7.1 7.1l-4.5 4.5a5 5 0 0 1-7.1 0Z"/><path d="m9 9 6 6"/>',
    plug: '<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v4m-3-10h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    tomato: '<path d="M12 5.6c-5-2.3-8.4 1.4-8.4 6.6 0 5.6 3.4 9 8.4 9s8.4-3.4 8.4-9c0-5.2-3.4-8.9-8.4-6.6Z"/><path d="M12 5.9c-.5-2.1-2-3.3-4-3.3.8 2.1 2.1 3.1 4 3.3Zm0 0c1.1-2 2.8-2.8 4.7-2.5-.8 1.9-2.3 2.7-4.7 2.5ZM12 6v2"/>',
    cup: '<path d="M4.5 8.5h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-6Zm12 1h1.5a3 3 0 0 1 0 6h-1.8M7 4.5c0 1 .8 1.3.8 2.3m3-2.3c0 1 .8 1.3.8 2.3M4 21h14"/>',
    idea: '<path d="M8 16c0-2-3-3.2-3-7a7 7 0 0 1 14 0c0 3.8-3 5-3 7Zm1 2h6m-5 3h4"/>',
    shield: '<path d="M12 3 20 6v5.5c0 4.6-3.3 7.7-8 9.5-4.7-1.8-8-4.9-8-9.5V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/>',
    tag: '<path d="M3 12V4h8l10 10-7 7Z"/><circle cx="8" cy="8" r="1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 3-4 5 6"/>',
    box: '<path d="m12 3 9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 5 9-5M12 12.5V21"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M2.5 6h19v3h-19Zm9.5 0v15m0-15c-5 0-6-4-3-4s3 4 3 4Zm0 0c5 0 6-4 3-4s-3 4-3 4Z"/>',
    crown: '<path d="m3 8 4.5 4 4.5-7 4.5 7L21 8l-2 11H5Z"/><path d="M5.5 21h13"/>',
    diamond: '<path d="m4 8 3-4h10l3 4-8 12Z"/><path d="m4 8 8 12 8-12M7 4l5 16 5-16M4 8h16"/>',
    generic: '<path d="M12 3.5 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'
  };

  var emojiRe;
  try {
    emojiRe = new RegExp('(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:[\\u{1F3FB}-\\u{1F3FF}])?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:[\\u{1F3FB}-\\u{1F3FF}])?)*)|(?:[\\u{1F1E6}-\\u{1F1FF}]{2})|(?:[0-9#*]\\uFE0F?\\u20E3)', 'gu');
  } catch (_) {
    emojiRe = /(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]))?/g;
  }
  var protectedSelector = 'script,style,noscript,template,input,textarea,select,[contenteditable="true"],[data-user-content],[data-message-content],[data-emoji],[data-sticker],.wx-ctx-item,.wx-ctx-menu,.wx-sticker,.wx-chat-bubble,.wx-message-content,.wx-msg-text,.wx-msg-stream,.wx-msg-row,.quoted-message,.chat-message,.chat-bubble,.vn-stage,.vn-dialogue,.vn-narration,.vnca-face-wrap,.aw-vn-stage,.aw-vn-dialogue,.sys-signature,.wx-moments-nick,#wx-moments-container .wx-feed-main,#wx-moments-container .wx-feed-likes-comments,.ot-mom,#novel-reader-body,.fm-post-title,.fm-post-body,.fm-post-meta,.fm-d-title,.fm-d-content,.fm-d-info,.fm-reply-content,.gd-bubble,.gB-face,.gB-letter-row,.ck-letter-paper,.aw-news-body,.aw-ca';
  function blocked(el) { return !!(el && el.closest && el.closest(protectedSelector)); }
  function hasEmoji(text) { try { return new RegExp(emojiRe.source, emojiRe.flags).test(String(text || '')); } catch (_) { return false; } }
  function iconName(token) {
    var chars = Array.from(token).filter(function (c) {
      var n = c.codePointAt(0);
      return n !== 0xFE0F && n !== 0xFE0E && n !== 0x200D && !(n >= 0x1F3FB && n <= 0x1F3FF);
    });
    var first = chars.length ? chars[0].codePointAt(0) : 0;
    if (byCode[first.toString(16)]) return byCode[first.toString(16)];
    if (first >= 0x1F600 && first <= 0x1F64F) return 'face';
    if ((first >= 0x1F466 && first <= 0x1F9DD) || (first >= 0x1F3C2 && first <= 0x1F3FF)) return 'person';
    if (first >= 0x1F400 && first <= 0x1F43F) return 'paw';
    if (first >= 0x1F330 && first <= 0x1F37F) return 'cup';
    if (first >= 0x1F680 && first <= 0x1F6FF) return 'car';
    if (first >= 0x1F1E6 && first <= 0x1F1FF) return 'generic';
    return byCode[first.toString(16)] || 'generic';
  }
  function svg(token) {
    var name = iconName(token), el = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('class', 'xwl-ui-vector');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    el.setAttribute('data-vector-for', name);
    el.innerHTML = paths[name] || paths.generic;
    return el;
  }
  function replaceNode(node) {
    if (!node || !node.parentNode || !node.nodeValue || blocked(node.parentElement)) return false;
    var text = node.nodeValue, tokens = [], re = new RegExp(emojiRe.source, emojiRe.flags), m;
    while ((m = re.exec(text))) tokens.push({ value: m[0], start: m.index, end: re.lastIndex });
    if (!tokens.length) return false;
    var frag = d.createDocumentFragment(), at = 0;
    tokens.forEach(function (t) {
      if (t.start > at) frag.appendChild(d.createTextNode(text.slice(at, t.start)));
      frag.appendChild(svg(t.value));
      at = t.end;
    });
    if (at < text.length) frag.appendChild(d.createTextNode(text.slice(at)));
    node.parentNode.replaceChild(frag, node);
    return true;
  }
  function process(root) {
    if (!root) return 0;
    var nodes = [], walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, changed = 0;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) { if (replaceNode(t)) changed++; });
    return changed;
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    w.setTimeout(function () { queued = false; if (d.body) process(d.body); }, 120);
  }
  function install() {
    if (!d.body) return;
    process(d.body);
    if (w.MutationObserver) {
      var mo = new MutationObserver(function (muts) {
        if (muts.some(function (m) { return m.addedNodes.length || m.type === 'characterData'; })) schedule();
      });
      mo.observe(d.body, { childList: true, subtree: true, characterData: true });
      w.XwlUIVectors._observer = mo;
    }
  }
  w.XwlUIVectors = { version: '2.0.0', process: process, iconFor: iconName, hasEmoji: hasEmoji };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
