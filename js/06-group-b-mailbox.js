
(function(){
'use strict';
/* B 组：发现页 → 信箱手撕信封。只读此刻现有 localStorage 键，不改、不删任何已有数据与键。 */
var LS = { album:'cike_album_v1', welcome:'cike_welcome_v1' };
var TEAR_SEED = 20261126, TEAR_N = 24;
function readJSON(k, fb){ try{ var v = (typeof localStorage!=='undefined') ? localStorage.getItem(k) : null; return v==null ? fb : JSON.parse(v); }catch(e){ return fb; } }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function mulberry32(seed){ var a = seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; var t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
/* 固定种子锯齿点：同一组点同时决定信封正面下沿与撕条上沿，保证严丝合缝。d 为 0..1 的深度。 */
function serration(seed, n){ var rnd = mulberry32(seed); var pts=[]; for(var i=0;i<=n;i++){ pts.push({ x:+(i/n*100).toFixed(2), d:+rnd().toFixed(3) }); } return pts; }
function frontClip(pts){ /* 信封正面：上直下锯齿，下沿 y=88+d*8（%） */
  var p = ['polygon(0% 0%, 100% 0%, 100% ' + (88+pts[pts.length-1].d*8).toFixed(2) + '%'];
  for(var i=pts.length-1;i>=0;i--){ p.push(', ' + pts[i].x + '% ' + (88+pts[i].d*8).toFixed(2) + '%'); }
  return p.join('') + ')';
}
function stripClip(pts){ /* 撕条：上沿锯齿（同一组点，y=d*30%），下沿直 */
  var p = ['polygon('];
  for(var i=0;i<pts.length;i++){ p.push((i?', ':'') + pts[i].x + '% ' + (pts[i].d*30).toFixed(2) + '%'); }
  return p.join('') + ', 100% 100%, 0% 100%)';
}
/* --p（%）：撕口位置。撕开比例 torn = 100 - p；不到三分之一弹回，超过三分之一顺势撕完。 */
function tearDecision(p){ var torn = 100 - (+p || 0); return torn < 100/3 ? 'rebound' : 'complete'; }
function sentencesOf(text){ var m = String(text||'').match(/[^。！？\n]+[。！？\n]?/g); return m || (text ? [String(text)] : []); }
function highlightSentence(text){ var ss = sentencesOf(text); if(!ss.length) return '';
  for(var i=0;i<ss.length;i++){ if(/[！？]/.test(ss[i])) return ss[i]; } return ss[0]; }
function letterPages(text, per){ per = per || 240; var ss = sentencesOf(text), pages = [], cur = '';
  function flush(){ if(cur){ pages.push(cur); cur=''; } }
  ss.forEach(function(s){
    while(s.length > per){ flush(); pages.push(s.slice(0, per)); s = s.slice(per); } /* 超长单句硬切，不让一页无限长 */
    if(cur && cur.length + s.length > per){ flush(); }
    cur += s;
  });
  flush();
  return pages.length ? pages : [''];
}
function letterTitle(text){ var line = String(text||'').split('\n').map(function(s){ return s.trim(); }).filter(Boolean)[0] || '';
  return line.length > 14 ? line.slice(0,14) + '…' : line; }
/* ---- 数据：只读此刻现有键 ---- */
function getLetters(){
  var album = readJSON(LS.album, []);
  if(!Array.isArray(album)) return [];
  return album.filter(function(it){ return it && String(it.text||'').trim(); }).map(function(it, i){
    return { index:i, role:it.role || '来信', time:it.time || '', text:String(it.text), isWelcome:!!it.isWelcome, special:!!it.special };
  });
}
/* ---- WebAudio 撕纸声：代码生成随机噪声过低通滤波，音量跟拖动速度；无声/不支持时静默跳过 ---- */
var TearSound = (function(){
  var ctx=null, src=null, gain=null, filt=null;
  function ensure(){
    if(ctx) return true;
    try{
      var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
      ctx = new AC();
      var len = Math.floor(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for(var i=0;i<len;i++){ d[i] = Math.random()*2 - 1; }
      src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1100; filt.Q.value = 0.8;
      gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination); src.start();
      return true;
    }catch(e){ ctx=null; return false; }
  }
  return {
    start:function(){ try{ if(ensure() && ctx.state==='suspended') ctx.resume(); }catch(e){} },
    level:function(v){ try{ if(gain && ctx) gain.gain.setTargetAtTime(Math.max(0, Math.min(0.4, v)), ctx.currentTime, 0.03); }catch(e){} },
    burst:function(){ try{ if(!ensure()) return; var g = ctx.createGain(), s = ctx.createBufferSource();
      var len = Math.floor(ctx.sampleRate*0.18), b = ctx.createBuffer(1, len, ctx.sampleRate), dd = b.getChannelData(0);
      for(var i=0;i<len;i++){ dd[i] = (Math.random()*2-1) * (1 - i/len); }
      s.buffer=b; var f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
      g.gain.value=0.35; s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(); }catch(e){} },
    stop:function(){ try{ if(gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02); }catch(e){} }
  };
})();
/* ---- WAAPI 编排：每步结束 commitStyles() 写进 style 再 cancel；减弱动效时直接落到终态 ---- */
function reducedMotion(){ try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
function play(el, kf, opts){
  if(!el) return Promise.resolve();
  var last = kf[kf.length-1];
  if(reducedMotion() || !el.animate){ try{ Object.keys(last).forEach(function(k){ el.style[k]=last[k]; }); }catch(e){} return Promise.resolve(); }
  var a; try{ a = el.animate(kf, opts||{}); }catch(e){ try{ Object.keys(last).forEach(function(k){ el.style[k]=last[k]; }); }catch(e2){} return Promise.resolve(); }
  return a.finished.then(function(){ try{ a.commitStyles(); }catch(e){} try{ a.cancel(); }catch(e){} }).catch(function(){});
}
function tweenP(el, from, to, dur){
  return new Promise(function(res){
    if(reducedMotion() || dur<=0){ el.style.setProperty('--p', to+'%'); return res(); }
    var t0 = null;
    function step(ts){ if(t0===null) t0=ts; var k=Math.min(1,(ts-t0)/dur), e=1-Math.pow(1-k,3);
      el.style.setProperty('--p', (from+(to-from)*e).toFixed(1)+'%'); if(k<1) requestAnimationFrame(step); else res(); }
    requestAnimationFrame(step);
  });
}
function overlayHost(anchor){ try{ var w = anchor && anchor.closest ? anchor.closest('.sys-app-window') : null; if(w) return w; }catch(e){} return document.body; }
function openOverlay(anchor, title, sub){
  var host = overlayHost(anchor);
  var ov = document.createElement('div');
  ov.className = 'gB-ov' + (host===document.body ? ' gB-fixed' : '');
  ov.innerHTML = '<div class="gB-head"><span class="gB-back" data-gb-close>‹</span><span class="gB-title">'+esc(title)+'</span><span class="gB-sub">'+esc(sub||'')+'</span></div><div class="gB-body"></div>';
  host.appendChild(ov);
  ov.querySelector('[data-gb-close]').addEventListener('click', function(){ closeOverlay(ov); });
  function onKey(e){ if(e.key==='Escape'){ closeOverlay(ov); } }
  document.addEventListener('keydown', onKey);
  ov._gbKey = onKey;
  return ov;
}
function closeOverlay(ov){ try{ TearSound.stop(); }catch(e){} try{ document.removeEventListener('keydown', ov._gbKey); }catch(e){} if(ov && ov.parentNode) ov.parentNode.removeChild(ov); }

/* ---- 信箱：列表 → 手撕信封 → 三折展开 → 卡片翻页 ---- */
function openLetterbox(anchor){
  var letters = getLetters();
  var ov = openOverlay(anchor, '信箱', letters.length ? letters.length + ' 封' : '');
  var body = ov.querySelector('.gB-body');
  function renderList(){
    body.innerHTML = letters.length ?
      letters.map(function(L){
        return '<div class="gB-letter-row" role="button" tabindex="0" aria-label="打开来自 '+esc(L.role)+' 的来信" data-gb-letter="'+L.index+'">' +
          '<div class="gB-letter-archive">' +
            '<div class="gB-envelope gB-envelope-back" aria-hidden="true"></div>' +
            '<div class="gB-envelope gB-envelope-mid" aria-hidden="true"></div>' +
            '<div class="gB-envelope gB-envelope-front">' +
              '<span class="gB-envelope-flap" aria-hidden="true"></span>' +
              '<span class="gB-envelope-mark" aria-hidden="true">✦</span>' +
              '<span class="gB-envelope-label">来信档案</span>' +
              '<span class="gB-envelope-copy">' +
                '<span class="gB-letter-top"><span class="gB-letter-from">'+esc(L.role)+(L.isWelcome?'<span class="gB-badge">欢迎信</span>':'')+'</span>' +
                '<span class="gB-letter-time">'+esc(L.time)+'</span></span>' +
                '<span class="gB-letter-title">'+esc(letterTitle(L.text))+'</span>' +
              '</span>' +
            '</div>' +
          '</div>' +
          '<span class="gB-archive-open">拆阅 <b>›</b></span>' +
        '</div>';
      }).join('') :
      '<div class="gB-empty">信箱还是空的。<br>此刻里的来信、存入的文字，<br>都会出现在这里。</div>';
    body.querySelectorAll('[data-gb-letter]').forEach(function(el){
      el.addEventListener('click', function(){ openLetter(letters[+el.getAttribute('data-gb-letter')]); });
    });
  }
  function openLetter(L){
    var pts = serration(TEAR_SEED, TEAR_N);
    var third = Math.ceil(L.text.length / 3);
    var slices = [L.text.slice(0, third), L.text.slice(third, third*2), L.text.slice(third*2)];
    body.innerHTML =
      '<div class="gB-letter-meta">'+esc(L.role)+'　·　'+esc(L.time)+'</div>' +
      '<div class="gB-stage-wrap"><div class="gB-stage" id="gB-stage">' +
        '<div class="gB-env-back"></div>' +
        '<div class="gB-letter" id="gB-letter">' +
          '<div class="gB-panel gB-panel-top" id="gB-p-top"><div class="gB-face">'+esc(slices[0])+'</div><div class="gB-face gB-face-back">✦</div></div>' +
          '<div class="gB-panel gB-panel-mid"><div class="gB-face">'+esc(slices[1])+'</div></div>' +
          '<div class="gB-panel gB-panel-bottom" id="gB-p-bot"><div class="gB-face">'+esc(slices[2])+'</div><div class="gB-face gB-face-back">✦</div></div>' +
        '</div>' +
        '<div class="gB-env-front" id="gB-front"></div>' +
        '<div class="gB-env-bottom"></div>' +
        '<div class="gB-strip" id="gB-strip"><div class="gB-strip-attached">✂ 沿此撕开</div></div>' +
        '<div class="gB-strip-arm" id="gB-arm">✂</div>' +
        '<div class="gB-strip-curl" id="gB-curl"></div>' +
        '<div class="gB-strip-hit" id="gB-hit"></div>' +
      '</div>' +
      '<div class="gB-tear-tip" id="gB-tip">按住撕条向左拖，撕开 <b>三分之一</b> 以上就会整条撕掉</div>' +
      '<button class="gB-btn gB-ghost" id="gB-back-list">‹ 返回信件列表</button></div>' +
      '<div id="gB-deck-wrap" style="display:none;"></div>';
    var stage = body.querySelector('#gB-stage');
    var front = body.querySelector('#gB-front'), strip = body.querySelector('#gB-strip');
    front.style.clipPath = frontClip(pts);
    strip.style.clipPath = stripClip(pts);
    body.querySelector('#gB-arm').style.clipPath = stripClip(pts);
    /* 初始折叠态：上片绕底边翻下、下片绕顶边翻上 */
    var pTop = body.querySelector('#gB-p-top'), pBot = body.querySelector('#gB-p-bot');
    pTop.style.transform = 'rotateX(180deg)'; pBot.style.transform = 'rotateX(-180deg)';
    body.querySelector('#gB-back-list').addEventListener('click', renderList);
    var hit = body.querySelector('#gB-hit'), tip = body.querySelector('#gB-tip');
    var dragging = false, startX = 0, startP = 100, curP = 100, lastX = 0, lastT = 0, torn = false;
    function setP(v){ curP = Math.max(0, Math.min(100, v)); stage.style.setProperty('--p', curP.toFixed(1)+'%'); }
    hit.addEventListener('pointerdown', function(e){
      if(torn) return;
      dragging = true; startX = e.clientX; startP = curP; lastX = e.clientX; lastT = performance.now();
      TearSound.start(); hit.setPointerCapture && hit.setPointerCapture(e.pointerId); e.preventDefault();
    });
    hit.addEventListener('pointermove', function(e){
      if(!dragging) return;
      setP(startP + (e.clientX - startX) / (hit.clientWidth || 300) * 100);
      var now = performance.now(), dt = Math.max(1, now - lastT);
      TearSound.level(Math.abs(e.clientX - lastX) / dt * 0.35);
      lastX = e.clientX; lastT = now;
    });
    function endDrag(){
      if(!dragging) return; dragging = false; TearSound.stop();
      var d = tearDecision(curP);
      if(d === 'rebound'){ tip.textContent = '还差一点，再往左撕一点就能打开'; tweenP(stage, curP, 100, 260).then(function(){ curP = 100; }); }
      else { torn = true; TearSound.burst(); tweenP(stage, curP, 0, 220).then(function(){ curP = 0; runOpenSequence(); }); }
    }
    hit.addEventListener('pointerup', endDrag);
    hit.addEventListener('pointercancel', endDrag);
    /* 动画编排（WAAPI + async/await）：撕条飞走 1670ms → 摆正+上滑 1000ms → 落下+放大+两片先后展开 1520ms → 散开成整页 840ms */
    async function runOpenSequence(){
      var letter = body.querySelector('#gB-letter');
      var stripEl = body.querySelector('#gB-strip'), arm = body.querySelector('#gB-arm'), curl = body.querySelector('#gB-curl');
      tip.textContent = '撕开了…';
      await play(stripEl, [{transform:'translate(0,0) rotate(0deg)',opacity:'1'},{transform:'translate(130px,-170px) rotate(46deg)',opacity:'0'}], {duration:1670, easing:'cubic-bezier(.3,.7,.3,1)'});
      await play(arm, [{transform:'scale(-1,-1) rotate(-7deg)',opacity:'1'},{transform:'translate(150px,-190px) scale(-1,-1) rotate(20deg)',opacity:'0'}], {duration:1670, easing:'cubic-bezier(.3,.7,.3,1)'});
      [stripEl, arm, curl, hit].forEach(function(el){ if(el) el.style.display='none'; });
      letter.classList.add('gB-out');
      await Promise.all([
        play(stage, [{transform:'rotate(-2.5deg)'},{transform:'rotate(0deg)'}], {duration:1000, easing:'ease-out'}),
        play(letter, [{transform:'translateY(0)'},{transform:'translateY(-64px)'}], {duration:1000, easing:'cubic-bezier(.2,.8,.3,1)'})
      ]);
      await Promise.all([
        play(front, [{transform:'translateY(0)',opacity:'1'},{transform:'translateY(150px)',opacity:'0'}], {duration:760, easing:'ease-in'}),
        play(body.querySelector('.gB-env-bottom'), [{transform:'translateY(0)',opacity:'1'},{transform:'translateY(150px)',opacity:'0'}], {duration:760, easing:'ease-in'}),
        play(body.querySelector('.gB-env-back'), [{transform:'translateY(0)',opacity:'1'},{transform:'translateY(150px)',opacity:'0'}], {duration:760, easing:'ease-in'}),
        play(letter, [{transform:'translateY(-64px) scale(1)'},{transform:'translateY(-64px) scale(1.07)'}], {duration:760, easing:'ease-out'})
      ]);
      await play(pTop, [{transform:'rotateX(180deg)'},{transform:'rotateX(0deg)'}], {duration:760, easing:'cubic-bezier(.3,.7,.3,1)'});
      await play(pBot, [{transform:'rotateX(-180deg)'},{transform:'rotateX(0deg)'}], {duration:760, easing:'cubic-bezier(.3,.7,.3,1)'});
      tip.textContent = '信展开了';
      await play(letter, [{transform:'translateY(-64px) scale(1.07)'},{transform:'translateY(0) scale(1)'}], {duration:840, easing:'cubic-bezier(.2,.8,.3,1)'});
      showDeck();
    }
    function showDeck(){
      var wrap = body.querySelector('#gB-deck-wrap');
      var pages = letterPages(L.text, 240);
      var hl = highlightSentence(L.text);
      body.querySelector('.gB-stage-wrap').style.display = 'none';
      wrap.style.display = 'block';
      function pageHtml(p, isTop, isLast){
        var lines = String(p).split('\n');
        var html = lines.map(function(line, li){
          var t = line.trim();
          if(!t) return '';
          var cls = (isTop && li === 0 && /[：:]$/.test(t)) ? 'gB-lp-sal' : (/^[✦✧❀❁✿♡♥♪]+$/.test(t) ? 'gB-lp-deco' : 'gB-lp');
          var h = esc(t);
          if(hl && t.indexOf(hl) !== -1){
            h = esc(t).split(esc(hl)).join('<span class="gB-hl'+(isTop?' gB-on':'')+'">'+esc(hl)+'</span>');
          }
          return '<p class="'+cls+'">'+h+'</p>';
        }).join('');
        if(isLast){
          html += '<div class="gB-letter-sign"><div class="gB-sign-name">'+esc(L.role)+'</div><div class="gB-sign-time">'+esc(L.time)+'</div></div>';
        }
        return '<div class="gB-lpage-text">'+html+'</div>';
      }
      wrap.innerHTML =
        '<div class="gB-deck" id="gB-deck">' +
          pages.map(function(p, i){ return '<div class="gB-lpage" data-gb-lpage="'+i+'">'+pageHtml(p, i===0, i===pages.length-1)+'</div>'; }).join('') +
        '</div>' +
        '<div class="gB-deck-foot">' +
          '<span class="gB-pager-btn" id="gB-lprev">‹</span>' +
          '<span class="gB-pager-info" id="gB-linfo">1 / '+pages.length+'</span>' +
          '<span class="gB-pager-btn" id="gB-lnext">›</span></div>' +
        '<div style="text-align:center;margin-top:16px;"><button class="gB-btn" id="gB-putback">放回信封</button> ' +
        '<button class="gB-btn gB-ghost" id="gB-close-letter">关闭</button></div>';
      var deck = wrap.querySelector('#gB-deck');
      var info = wrap.querySelector('#gB-linfo');
      var topIdx = 0;
      function layout(){
        var cards = deck.querySelectorAll('.gB-lpage');
        cards.forEach(function(c, i){
          c.style.zIndex = String(cards.length - i);
          c.style.transform = 'translate('+(i*4)+'px,'+(i*3)+'px) rotate('+(i*0.7)+'deg)';
          c.style.opacity = i > 2 ? '0' : '1';
        });
        info.textContent = (topIdx+1)+' / '+pages.length;
        var top = deck.querySelector('.gB-lpage');
        if(top){ var h = top.querySelector('.gB-hl'); if(h){ requestAnimationFrame(function(){ h.classList.add('gB-on'); }); } }
      }
      layout();
      wrap.querySelector('#gB-lnext').addEventListener('click', function(){
        var cards = deck.querySelectorAll('.gB-lpage'); if(cards.length < 2) return;
        var top = cards[0];
        play(top, [{transform:top.style.transform,opacity:'1'},{transform:'translate(130px,-10px) rotate(9deg)',opacity:'0'}], {duration:320, easing:'ease-in'}).then(function(){
          deck.appendChild(top); top.style.transform=''; topIdx = (topIdx+1) % pages.length; layout();
        });
      });
      wrap.querySelector('#gB-lprev').addEventListener('click', function(){
        var cards = deck.querySelectorAll('.gB-lpage'); if(cards.length < 2) return;
        var last = cards[cards.length-1];
        deck.insertBefore(last, deck.firstChild);
        topIdx = (topIdx - 1 + pages.length) % pages.length;
        last.style.transform = 'translate(-130px,-10px) rotate(-9deg)'; last.style.opacity = '0';
        layout();
        play(last, [{transform:'translate(-130px,-10px) rotate(-9deg)',opacity:'0'},{transform:'translate(0px,0px) rotate(0deg)',opacity:'1'}], {duration:320, easing:'ease-out'});
      });
      wrap.querySelector('#gB-putback').addEventListener('click', renderList);
      wrap.querySelector('#gB-close-letter').addEventListener('click', renderList);
    }
  }
  renderList();
}
/* ---- 挂载：A 组容器由发现页渲染后重建，用 MutationObserver 反复挂载 ---- */
function mountAll(){
  try{
    var mounts = (typeof window!=='undefined' && window.__wxDiscoverMounts) || {};
    var lC = mounts.letterbox || (typeof document!=='undefined' && document.getElementById('wx-discover-letterbox'));
    if(lC && !lC.querySelector('[data-gb-entry="letterbox"]')){
      var letters = getLetters();
      lC.innerHTML = '<div class="wx-cell-group" data-gb-entry="letterbox" style="margin-top:10px;"><div class="wx-cell" role="button" tabindex="0">' +
        '<div class="wx-cell-left"><div class="wx-cell-icon" style="background:#c9a06f;">✉️</div><span>信箱</span></div>' +
        '<div class="wx-cell-right"><span class="gB-count">'+(letters.length ? letters.length+' 封' : '暂无')+'</span><span class="wx-cell-arrow">›</span></div></div></div>';
      lC.querySelector('.wx-cell').addEventListener('click', function(){ openLetterbox(lC); });
    }
  }catch(e){ /* 挂载失败不影响微信主流程 */ }
}
function init(){
  mountAll();
  try{
    if(typeof MutationObserver !== 'undefined' && document.documentElement){
      var mo = new MutationObserver(function(){ mountAll(); });
      mo.observe(document.documentElement, { childList:true, subtree:true });
    }
  }catch(e){}
  [400, 1200, 3000].forEach(function(ms){ setTimeout(mountAll, ms); });
}
if(typeof window !== 'undefined'){
  window.__wxGroupB = { mountAll:mountAll, openLetterbox:openLetterbox };
  window.__wxGroupBTest = { serration:serration, frontClip:frontClip, stripClip:stripClip, tearDecision:tearDecision,
    letterPages:letterPages, letterTitle:letterTitle, highlightSentence:highlightSentence,
    getLetters:getLetters, TEAR_SEED:TEAR_SEED };
}
if(typeof document !== 'undefined' && document.addEventListener){
  if(document.body){ init(); }
  else { document.addEventListener('DOMContentLoaded', init); }
}
})();
