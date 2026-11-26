/* 小未来 · 塔罗首页星际时钟盘
 * 只替换 .tarot-astrolabe-container 内部的中央盘面；不带入 DOCX 中的标题、诗句、HUD、粒子、资料切换或按钮。
 */
(function () {
  'use strict';
  if (window.__tarotYgClockInstalled) return;
  window.__tarotYgClockInstalled = true;

  var STYLE_ID = 'tarot-yg-star-clock-style';
  var DIAL_HTML = `
    <div class="yg-stage-wrap" aria-label="星际时钟盘">
      <div class="yg-astrolabe">
        <div class="yg-ring-layer yg-orbit-outer" aria-hidden="true">
          <svg viewBox="0 0 300 300">
            <ellipse cx="150" cy="150" rx="142" ry="126" fill="none" stroke="rgba(87,103,126,0.42)" stroke-width="0.8" stroke-dasharray="48 12 6 8 110 18"/>
            <circle cx="150" cy="150" r="136" fill="none" stroke="rgba(156,123,70,0.48)" stroke-width="0.6" stroke-dasharray="2 10"/>
            <circle cx="150" cy="14" r="3" fill="#9c7b46"/>
            <circle cx="150" cy="14" r="7" fill="none" stroke="rgba(156,123,70,0.62)" stroke-width="0.8"/>
            <path d="M 286 150 L 296 150 M 4 150 L 14 150" stroke="rgba(156,123,70,0.68)" stroke-width="1"/>
          </svg>
        </div>
        <div class="yg-ring-layer yg-orbit-mid" aria-hidden="true">
          <svg viewBox="0 0 300 300">
            <ellipse cx="150" cy="150" rx="124" ry="138" fill="none" stroke="rgba(86,102,125,0.34)" stroke-width="0.9" stroke-dasharray="80 24 12 18"/>
            <circle cx="150" cy="150" r="112" fill="none" stroke="rgba(156,123,70,0.42)" stroke-width="0.6" stroke-dasharray="1 6 18 6"/>
            <polygon points="150,28 147,35 153,35" fill="#9c7b46" opacity="0.8"/>
            <circle cx="262" cy="150" r="2.2" fill="#52647d"/>
          </svg>
        </div>
        <div class="yg-ring-layer yg-orbit-inner" aria-hidden="true">
          <svg viewBox="0 0 300 300">
            <circle cx="150" cy="150" r="96" fill="none" stroke="rgba(156,123,70,0.52)" stroke-width="0.75" stroke-dasharray="32 14 4 14"/>
            <circle cx="150" cy="54" r="2" fill="#9c7b46"/>
            <circle cx="150" cy="246" r="2" fill="#63738b"/>
          </svg>
        </div>
        <div class="yg-ring-layer yg-dial-main" aria-hidden="true">
          <svg viewBox="0 0 300 300">
            <defs>
              <radialGradient id="tarot-yg-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(156,123,70,0.22)"/>
                <stop offset="100%" stop-color="rgba(165,180,200,0)"/>
              </radialGradient>
            </defs>
            <circle cx="150" cy="150" r="92" fill="url(#tarot-yg-glow)"/>
            <line x1="150" y1="18" x2="150" y2="282" stroke="rgba(87,103,126,0.26)" stroke-width="0.6" stroke-dasharray="3 6"/>
            <line x1="18" y1="150" x2="282" y2="150" stroke="rgba(87,103,126,0.26)" stroke-width="0.6" stroke-dasharray="3 6"/>
            <line x1="58" y1="58" x2="242" y2="242" stroke="rgba(156,123,70,0.24)" stroke-width="0.5"/>
            <line x1="242" y1="58" x2="58" y2="242" stroke="rgba(156,123,70,0.24)" stroke-width="0.5"/>
            <circle cx="150" cy="150" r="118" fill="none" stroke="rgba(87,103,126,0.48)" stroke-width="0.8" stroke-dasharray="140 16 40 12 8 16"/>
            <circle cx="150" cy="150" r="84" fill="none" stroke="rgba(156,123,70,0.42)" stroke-width="0.6" stroke-dasharray="60 18 12 18"/>
            <circle cx="150" cy="150" r="52" fill="none" stroke="rgba(87,103,126,0.40)" stroke-width="0.6" stroke-dasharray="4 8"/>
            <g class="yg-dial-rotator" font-family="Cinzel, serif" font-size="9.5" fill="rgba(53,65,82,0.86)" text-anchor="middle" dominant-baseline="central" letter-spacing="1">
              <text x="150" y="46" fill="#9c7b46">XII</text>
              <text x="202" y="60">I</text>
              <text x="240" y="98">II</text>
              <text x="254" y="150" fill="#9c7b46">III</text>
              <text x="240" y="202">IV</text>
              <text x="202" y="240">V</text>
              <text x="150" y="254" fill="#9c7b46">VI</text>
              <text x="98" y="240">VII</text>
              <text x="60" y="202">VIII</text>
              <text x="46" y="150" fill="#9c7b46">IX</text>
              <text x="60" y="98">X</text>
              <text x="98" y="60">XI</text>
            </g>
            <g class="yg-hand yg-hand-hour">
              <line x1="150" y1="166" x2="150" y2="86" stroke="#9c7b46" stroke-width="1.4"/>
              <polygon points="150,76 146,92 150,88 154,92" fill="#9c7b46"/>
              <circle cx="150" cy="108" r="3" fill="none" stroke="#9c7b46" stroke-width="1"/>
            </g>
            <g class="yg-hand yg-hand-min">
              <line x1="150" y1="174" x2="150" y2="54" stroke="rgba(63,76,96,0.92)" stroke-width="1"/>
              <polygon points="150,44 147.5,58 152.5,58" fill="rgba(63,76,96,0.94)"/>
            </g>
            <g class="yg-hand-sec">
              <line x1="150" y1="188" x2="150" y2="34" stroke="rgba(87,103,126,0.82)" stroke-width="0.7" stroke-dasharray="42 4 12 4"/>
              <circle cx="150" cy="34" r="2" fill="#9c7b46"/>
            </g>
          </svg>
        </div>
      </div>
    </div>`;

  var STYLE_TEXT = `
    .tarot-wrapper .tarot-astrolabe-container{position:relative;}
    .tarot-wrapper .tarot-astrolabe-container .yg-stage-wrap::before{content:'';position:absolute;width:76%;height:76%;border-radius:50%;background:radial-gradient(circle,rgba(156,123,70,.10),rgba(99,115,139,.06) 54%,transparent 76%);pointer-events:none;}
    .tarot-wrapper .tarot-astrolabe-container .yg-stage-wrap{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;perspective:900px;overflow:visible;pointer-events:none;}
    .tarot-wrapper .yg-astrolabe{position:relative;width:88%;height:88%;transform-style:preserve-3d;display:flex;align-items:center;justify-content:center;}
    .tarot-wrapper .yg-ring-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform-style:preserve-3d;}
    .tarot-wrapper .yg-ring-layer svg{display:block;width:100%;height:100%;overflow:visible;}
    .tarot-wrapper .yg-orbit-outer{transform:rotateX(58deg) rotateY(-18deg) translateZ(-12px);}
    .tarot-wrapper .yg-orbit-outer svg{animation:tarotYgSpinCw 48s linear infinite;}
    .tarot-wrapper .yg-orbit-mid{transform:rotateX(-52deg) rotateY(28deg) translateZ(8px);}
    .tarot-wrapper .yg-orbit-mid svg{animation:tarotYgSpinCcw 34s linear infinite;}
    .tarot-wrapper .yg-orbit-inner{transform:rotateX(22deg) rotateY(64deg) translateZ(18px);}
    .tarot-wrapper .yg-orbit-inner svg{animation:tarotYgSpinCw 26s linear infinite;}
    .tarot-wrapper .yg-dial-main{transform:translateZ(4px);}
    .tarot-wrapper .yg-dial-rotator{transform-box:view-box;transform-origin:150px 150px;animation:tarotYgSpinCcw 120s linear infinite;}
    .tarot-wrapper .yg-hand{transform-box:view-box;transform-origin:150px 150px;transition:transform .4s cubic-bezier(.22,1,.36,1);}
    .tarot-wrapper .yg-hand-sec{transition:none;}
    @keyframes tarotYgSpinCw{to{transform:rotate(360deg);}}
    @keyframes tarotYgSpinCcw{to{transform:rotate(-360deg);}}
    @media(prefers-reduced-motion:reduce){.tarot-wrapper .yg-orbit-outer svg,.tarot-wrapper .yg-orbit-mid svg,.tarot-wrapper .yg-orbit-inner svg,.tarot-wrapper .yg-dial-rotator{animation:none!important;}}
  `;

  var clockTimer = 0;
  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    (document.head || document.documentElement).appendChild(style);
  }

  function bindClock(host) {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
    var hour = host.querySelector('.yg-hand-hour');
    var minute = host.querySelector('.yg-hand-min');
    var second = host.querySelector('.yg-hand-sec');
    function tick() {
      if (!host.isConnected) {
        if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
        return;
      }
      var now = new Date();
      var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
      if (hour) hour.style.transform = 'rotate(' + (((h % 12) + m / 60) * 30) + 'deg)';
      if (minute) minute.style.transform = 'rotate(' + ((m + s / 60) * 6) + 'deg)';
      if (second) second.style.transform = 'rotate(' + ((s + ms / 1000) * 6) + 'deg)';
    }
    tick();
    clockTimer = setInterval(tick, 250);
  }

  function mount() {
    installStyle();
    var host = document.querySelector('.tarot-wrapper .tarot-screen .tarot-astrolabe-container');
    if (!host || host.getAttribute('data-tarot-yg-dial') === '1') return;
    host.setAttribute('data-tarot-yg-dial', '1');
    host.replaceChildren();
    host.insertAdjacentHTML('afterbegin', DIAL_HTML);
    bindClock(host);
  }

  function start() {
    installStyle();
    var root = document.getElementById('sys-app-host') || document.body || document.documentElement;
    if (!root || typeof MutationObserver === 'undefined') { mount(); return; }
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; mount(); });
    });
    observer.observe(root, { childList: true, subtree: true });
    window.__tarotYgClockObserver = observer;
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
