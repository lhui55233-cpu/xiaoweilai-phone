/* [GROUP-INTRO] 开场动画 XWIntro（2026-11-26，替换旧版开机动画）
 * 来源：用户提供的接入包 ~/workspace/user/files/xiaoweilai-intro_2_f2px.html。
 * 下面的 XWIntro 本体（样式见 css/02-group-intro.css）是接入包原样接入：三幕
 * （字母雨 love / 信封“因为爱，所以相遇”/ FUTURE）、PACE=.5、文案、时间线均未改动；
 * 预览页 intro-preview__2__3_8y5l.html 不接入。接线见本文件末尾的 GROUP-INTRO 段：
 * 读开关（沿用 phone_boot_anim_v1，旧 style 字段忽略）、冷启动自动播、
 * onDone 进锁屏、onEvent('exit') 同步锁屏淡入、设置页开关/预览、点按跳过。
 */

/* ============================================================
 * XWIntro — 小未来手机开场动画(独立预览版)
 * 接入约定:
 *   XWIntro.play({ onDone(reason){ 进入锁屏 } })
 *   XWIntro.skip()      // 淡出并结束
 *   reason: 'done' | 'skip' | 'error' | 'timeout'
 * 只依赖 #intro > #scene 两个节点,不接触其他模块。
 * ============================================================ */
(() => {
'use strict';

const W = 320, H = 640;
const PACE = .5;   // 整体节奏系数(越小越快)

/* 时间线(ms,从 play 开始计) */
const T = {
  loveOut:5600, envIn:5800, flap:7000, rise:7900, unfold:8600,
  text:9300, scatter:13000, exit:17600, end:18700
};

/* ---------- 工具 ---------- */
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const eOut=t=>1-Math.pow(1-t,3);
const eOut2=t=>1-Math.pow(1-t,2);
const eIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const ALPH=[...'love'];   // 雨与水花里的字母,只取 l o v e
const MAP_FUTURE=[0,1,2,4,5,6];   // FUTURE 六个字母分别从「因为爱 所以相」起飞

const introEl=document.getElementById('xwIntro');
const scene=document.getElementById('xwScene');

/* ---------- 场景模板 ---------- */
const chHTML=(c,i,p)=>`<span class="ch${p?' punct':''}" style="--i:${i}"><i>${c}</i></span>`;
const SCENE_HTML=`
<div class="puddle"></div>
<div class="layer rain"></div>
<div class="layer ripples"></div>
<div class="layer sparks"></div>
<div class="love" aria-hidden="true">${[...'love'].map(c=>`<span>${c}</span>`).join('')}</div>
<div class="env" aria-hidden="true">
  <div class="e-shadow"></div>
  <div class="e-back"></div>
  <div class="flap">
    <div class="f-out"><svg viewBox="0 0 224 92" preserveAspectRatio="none"><defs><linearGradient id="fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf7ee"/><stop offset="1" stop-color="#f3eedf"/></linearGradient></defs><polygon points="0,0 224,0 112,92" fill="url(#fo)" stroke="rgba(140,124,96,.3)" stroke-width="1" stroke-linejoin="round"/></svg></div>
    <div class="f-in"><svg viewBox="0 0 224 92" preserveAspectRatio="none"><defs><linearGradient id="fi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ddd3bd"/><stop offset="1" stop-color="#e8e0cd"/></linearGradient></defs><polygon points="0,0 224,0 112,92" fill="url(#fi)" stroke="rgba(140,124,96,.3)" stroke-width="1" stroke-linejoin="round"/></svg></div>
  </div>
  <div class="paper">
    <div class="crease c1"></div><div class="crease c2"></div>
    <div class="zh" aria-hidden="true">
      <div class="ln">${chHTML('因',0)}${chHTML('为',1)}${chHTML('爱',2)}${chHTML('，',3,1)}</div>
      <div class="ln">${chHTML('所',4)}${chHTML('以',5)}${chHTML('相',6)}${chHTML('遇',7)}</div>
    </div>
  </div>
  <svg class="pocket" viewBox="0 0 224 150" preserveAspectRatio="none">
    <polygon points="0,0 0,150 112,86" fill="#f1ebdc"/>
    <polygon points="224,0 224,150 112,86" fill="#eee7d8"/>
    <polygon points="0,150 224,150 112,86" fill="#f8f4ea"/>
    <path d="M0 0 L112 86 L224 0 M0 150 L112 86 L224 150" fill="none" stroke="rgba(140,124,96,.24)" stroke-width="1"/>
    <rect x=".5" y=".5" width="223" height="149" rx="2.5" fill="none" stroke="rgba(140,124,96,.24)"/>
  </svg>
</div>
<div class="future" aria-hidden="true">${[...'FUTURE'].map(c=>`<span>${c}</span>`).join('')}</div>
<div class="layer dusts"></div>`;

/* ---------- 会话状态 ---------- */
let S=null;          // 当前会话
let R=null;          // 节点引用
let lovePos=[], futPos=[];

function fit(){
  const r=introEl.getBoundingClientRect();
  if(!r.width||!r.height) return;
  scene.style.setProperty('--s',Math.min(r.width/W,r.height/H).toFixed(4));
}
if('ResizeObserver' in window) new ResizeObserver(fit).observe(introEl);
window.addEventListener('resize',fit);

function emit(name,detail){
  try{ S&&S.onEvent&&S.onEvent(name,detail); }catch(_){}
  try{ document.dispatchEvent(new CustomEvent('xwintro:'+name,{detail})); }catch(_){}
}
const at=(t,fn)=>{            // 绝对时间(从会话开始)
  const me=S, d=Math.max(0,t*me.K-(performance.now()-me.t0));
  me.timers.push(setTimeout(()=>{ if(S!==me||me.done) return; try{fn();}catch(e){fail(e);} },d));
};
const after=(d,fn)=>{         // 相对当前
  const me=S;
  me.timers.push(setTimeout(()=>{ if(S!==me||me.done) return; try{fn();}catch(e){fail(e);} },d*me.K));
};
function anim(el,frames,o={}){
  const a=el.animate(frames,Object.assign({fill:'both'},o,{duration:o.duration*S.K,delay:(o.delay||0)*S.K}));
  S.anims.push(a); return a;
}
function frames(fn,n=28){
  const out=[];
  for(let i=0;i<=n;i++){
    const u=i/n,f=fn(u);
    out.push({offset:u,
      transform:`translate(${f.x.toFixed(2)}px,${f.y.toFixed(2)}px) rotate(${(f.r||0).toFixed(1)}deg) scale(${(f.s==null?1:f.s).toFixed(3)})`,
      opacity:f.o==null?1:+f.o.toFixed(3)});
  }
  return out;
}
function mk(tag,cls,parent,html){
  const el=document.createElement(tag); el.className=cls; if(html!=null) el.innerHTML=html; parent.appendChild(el); return el;
}
function collect(){
  const q=s=>scene.querySelector(s), qa=s=>[...scene.querySelectorAll(s)];
  const r={puddle:q('.puddle'),rain:q('.rain'),ripples:q('.ripples'),sparks:q('.sparks'),
    love:q('.love'),loveL:qa('.love>span'),env:q('.env'),flap:q('.flap'),paper:q('.paper'),
    creases:qa('.crease'),chars:qa('.zh .ch'),future:q('.future'),futureL:qa('.future>span'),dusts:q('.dusts')};
  r.envParts=[...r.env.children].filter(c=>c!==r.paper);
  return r;
}
function measure(c,list){
  return list.map(el=>({x:c.offsetLeft+el.offsetLeft+el.offsetWidth/2,y:c.offsetTop+el.offsetTop+el.offsetHeight/2}));
}
function sceneCenter(el){
  const sr=scene.getBoundingClientRect(), s=sr.width/W, r=el.getBoundingClientRect();
  return {x:(r.left+r.width/2-sr.left)/s,y:(r.top+r.height/2-sr.top)/s};
}

/* ---------- 第一幕:雨 · 涟漪 · 字符水花 ---------- */
const dropDur=y=>(520+(y+40)*.3)*1.4;
/* 一颗字母雨:落进水里,溅起更小的字母 */
function rainLetter(tLaunch,x,y,ch,fixed){
  at(tLaunch,()=>{
    const el=mk('span','fl',R.rain); el.textContent=ch||pick(ALPH);
    const dur=dropDur(y), r0=fixed?rand(-4,4):rand(-25,25), sc=fixed?1.25:rand(.85,1.25), dr=fixed?0:rand(-8,8);
    anim(el,[
      {transform:`translate(${x}px,-40px) rotate(${r0}deg) scale(${sc})`,opacity:0,offset:0},
      {opacity:.85,offset:.1},
      {transform:`translate(${x+dr}px,${y}px) rotate(${r0*.3}deg) scale(${sc})`,opacity:.85,offset:.96},
      {transform:`translate(${x+dr}px,${y}px) rotate(${r0*.3}deg) scale(${sc*.6})`,opacity:0,offset:1}
    ],{duration:dur,easing:'cubic-bezier(.4,0,.85,.6)',fill:'forwards'});
    after(dur,()=>{ el.remove(); splash(x,y,1); });
  });
}
function ripple(x,y,r,delay,o){
  const el=mk('div','rp',R.ripples,'<svg width="60" height="60" viewBox="-30 -30 60 60"><circle r="29" fill="none" stroke="rgba(104,136,164,1)" stroke-width="1.1" vector-effect="non-scaling-stroke"/></svg>');
  const a=anim(el,[
    {transform:`translate(${x}px,${y}px) scale(.08,.024)`,opacity:0,offset:0},
    {opacity:o,offset:.16},
    {transform:`translate(${x}px,${y}px) scale(${(r/29).toFixed(3)},${(r/29*.3).toFixed(3)})`,opacity:0,offset:1}
  ],{duration:1700+r*10,delay,easing:'cubic-bezier(.2,.6,.3,1)'});
  a.onfinish=()=>el.remove();
}
function sparks(x,y,n){
  for(let k=0;k<n;k++){
    const el=mk('span','sp',R.sparks); el.textContent=pick(ALPH);
    const side=Math.random()<.5?-1:1, dx=side*rand(14,58), hgt=rand(22,56), dur=rand(850,1250), rot=rand(-50,50), fs=rand(.85,1.35);
    const fr=frames(u=>({
      x:x+dx*(1-Math.pow(1-u,1.7)),
      y:y-4*hgt*u*(1-u)+6*u,
      r:rot*u,
      s:fs*(.7+.5*Math.sin(Math.min(1,u*1.6)*Math.PI/2)),
      o:u<.12?u/.12*.85:.85*Math.pow(1-(u-.12)/.88,1.2)
    }),22);
    const a=anim(el,fr,{duration:dur,delay:rand(0,60),easing:'linear'});
    a.onfinish=()=>el.remove();
  }
}
function splash(x,y,k){
  ripple(x,y,36*k,0,.6);
  ripple(x,y,22*k,170,.4);
  sparks(x,y-2,k>1?5:Math.round(rand(3,5)));
}
/* 细小的字屑从信封口飘出,沿斜线汇向纸面(参考视频第一条的字效) */
function microText(){
  const src='因为爱所以相遇';
  for(let k=0;k<20;k++){
    const el=mk('span','mt',R.dusts); el.textContent=src[Math.floor(Math.random()*src.length)];
    const x0=160+rand(-20,20), y0=300, cx=160+rand(30,100), cy=rand(215,265);
    const x1=160+rand(-55,55), y1=rand(300,345), rot=rand(-40,40);
    const fr=frames(u=>{
      const a=(1-u)*(1-u), b=2*(1-u)*u, c=u*u;
      return {x:a*x0+b*cx+c*x1, y:a*y0+b*cy+c*y1, r:rot*u, s:.7+.5*Math.sin(u*Math.PI),
        o:u<.15?u/.15*.75:.75*Math.pow(1-(u-.15)/.85,1.4)};
    },24);
    const an=anim(el,fr,{duration:rand(1000,1500),delay:k*55,easing:'linear'});
    an.onfinish=()=>el.remove();
  }
}

/* ---------- 主流程 ---------- */
function runFull(){
  R=collect();
  futPos=measure(R.future,R.futureL);

  /* —— 第一幕 —— */
  emit('act',{n:1,name:'第一幕 · 雨落成字'});
  anim(R.puddle,[{opacity:0},{opacity:1}],{duration:1500,easing:'ease-out'});

  let t=100, n=0;
  while(t<4400){                                   // 字母雨:l o v e 依次落下
    rainLetter(t,rand(30,290),rand(430,505),ALPH[n++%4]);
    t+=rand(100,200)*(1+t/6000);
  }
  [[1400,90],[2800,215],[4000,150]].forEach(([tw,cx])=>{   // 三串 l-o-v-e 一起落下
    const x=cx+rand(-15,15), y=rand(455,495);
    for(let k=0;k<4;k++) rainLetter(tw+k*40,x+(k-1.5)*13,y,'love'[k],true);
  });

  /* —— 第二幕 —— */
  at(T.loveOut,()=>{
    emit('act',{n:2,name:'第二幕 · 因为爱，所以相遇'});
    anim(R.puddle,[{opacity:1},{opacity:0}],{duration:1800,easing:'ease-in-out'});
  });
  at(T.envIn,()=>{                                  // 信封浮现,停留片刻
    anim(R.env,[{opacity:0,transform:'translateY(22px) rotate(8deg) scale(.97)'},{opacity:1,transform:'translateY(0) rotate(14deg) scale(1)'}],
      {duration:1300,easing:'cubic-bezier(.2,.7,.2,1)'});
  });
  at(T.flap,()=>{                                   // 封口掀开
    anim(R.flap,[{transform:'perspective(600px) rotateX(0deg)'},{transform:'perspective(600px) rotateX(180deg)'}],
      {duration:1200,easing:'cubic-bezier(.5,.05,.3,1)'});
    after(1200,()=>{ R.flap.style.zIndex=1; });     // 翻到背后,让位给信纸
  });
  at(T.rise,()=>{                                   // 信纸从信封里升起
    anim(R.paper,[{transform:'translateY(0px) scaleY(.42)'},{transform:'translateY(-59px) scaleY(.42)'}],
      {duration:1100,easing:'cubic-bezier(.3,.1,.2,1)'});
  });
  at(T.unfold,()=>{                                 // 信纸展开,信封向下退场
    R.paper.style.zIndex=6;
    anim(R.paper,[{transform:'translateY(-59px) scaleY(.42)'},{transform:'translateY(-67px) scaleY(1)'}],
      {duration:1300,easing:'cubic-bezier(.4,0,.2,1)'});
    R.creases.forEach(c=>anim(c,[{opacity:1},{opacity:.12}],{duration:1300}));
    R.envParts.forEach(p=>{
      if(p===R.flap){
        anim(p,[{transform:'translateY(0) perspective(600px) rotateX(180deg)'},{transform:'translateY(28px) perspective(600px) rotateX(180deg)'}],{duration:1200,easing:'ease-in'});
        [...p.children].forEach(c=>anim(c,[{opacity:1},{opacity:0}],{duration:1200,easing:'ease-in'}));
      }else{
        anim(p,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(28px)'}],{duration:1200,easing:'ease-in'});
      }
    });
  });
  at(T.text,()=>{                                   // 文字被风托起,从纸面浮出
    microText();
    R.chars.forEach((c,i)=>{
      const fr=frames(u=>{
        const e=eOut(u), k=1-e;
        return {
          x:k*(-5+(i%3)*3)+Math.sin(u*Math.PI*2)*1.2*(1-u),
          y:k*9-Math.sin(u*Math.PI)*3*(1-u*.5),
          r:k*(-6+i*1.6), s:.75+.25*e, o:clamp(u*2.4)
        };
      },30);
      anim(c,fr,{duration:1300,delay:i*90,easing:'linear'});
    });
    after(1500,()=>scene.classList.add('sway'));
  });

  /* —— 第三幕 —— */
  at(T.scatter,()=>{
    emit('act',{n:3,name:'第三幕 · FUTURE'});
    scene.classList.remove('sway');
    const cp=R.chars.map(sceneCenter);
    // 纸张轻轻抬起、隐去
    after(600,()=>anim(R.paper,
      [{transform:'translateY(-67px) scaleY(1)',opacity:1},{transform:'translateY(-74px) scaleY(1)',opacity:0}],
      {duration:1400,easing:'ease-in-out'}));
    // 文字被风吹散
    R.chars.forEach((c,i)=>{
      const a=(-28+rand(-14,14))*Math.PI/180, D=rand(120,200), side=i%2?1:-1, ph=i;
      const fr=frames(u=>{
        const e=Math.pow(u,1.6), wob=Math.sin(u*Math.PI*1.6+ph)*14*u;
        return {
          x:D*Math.cos(a)*e-Math.sin(a)*wob, y:D*Math.sin(a)*e+Math.cos(a)*wob,
          r:side*70*e, s:1-.35*e, o:u<.22?1:Math.max(0,1-(u-.22)/.5)
        };
      },30);
      anim(c,fr,{duration:1900,delay:i*60,easing:'linear'});
    });
    // FUTURE 的六个字母,从文字散开的位置汇聚
    R.futureL.forEach((el,j)=>{
      const c=cp[MAP_FUTURE[j]], p=futPos[j], sx=c.x-p.x, sy=c.y-p.y;
      const a=(-30+rand(-18,18))*Math.PI/180, D=rand(70,120);
      const wx=sx+D*Math.cos(a), wy=sy+D*Math.sin(a), r0=rand(-40,40), amp=rand(-34,34), Q=.5;
      const fr=frames(u=>{
        if(u<=Q){
          const v=u/Q, e=eOut2(v);
          return {x:lerp(sx,wx,e),y:lerp(sy,wy,e),r:r0*e,s:.32+.1*e,o:clamp(v*2.2)*.8};
        }
        const w=(u-Q)/(1-Q), e=eIO(w);
        return {x:lerp(wx,0,e),y:lerp(wy,0,e)+Math.sin(w*Math.PI)*amp*(1-w),r:r0*(1-e),s:.42+.58*Math.pow(e,1.2),o:.8+.2*e};
      },44);
      anim(el,fr,{duration:2300,delay:250+j*110,easing:'linear'});
    });
    // 细小的笔画碎屑,随风汇入
    for(let k=0;k<16;k++){
      const c=cp[Math.floor(Math.random()*cp.length)];
      const tx=160+rand(-105,105), ty=futPos[0].y+rand(-14,14);
      const a=(-30+rand(-20,20))*Math.PI/180, D=rand(60,130), rot=rand(-80,80), Q=.45;
      const wx=c.x+D*Math.cos(a), wy=c.y+D*Math.sin(a);
      const el=mk('div','dust',R.dusts);
      const fr=frames(u=>{
        let x,y;
        if(u<=Q){ const e=eOut2(u/Q); x=lerp(c.x,wx,e); y=lerp(c.y,wy,e); }
        else{ const e=eIO((u-Q)/(1-Q)); x=lerp(wx,tx,e); y=lerp(wy,ty,e)-Math.sin(e*Math.PI)*14; }
        return {x,y,r:rot*u,s:1,o:u<.12?u/.12*.6:.6*(1-Math.pow(u,3))};
      },30);
      const an=anim(el,fr,{duration:rand(1900,2400),delay:rand(0,900),easing:'linear'});
      an.onfinish=()=>el.remove();
    }
  });
  at(T.exit,()=>{
    emit('exit');
    anim(R.future,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}],{duration:1000,easing:'ease-in-out'});
    anim(introEl,[{opacity:1},{opacity:0}],{duration:1200,easing:'ease-in-out',fill:'forwards'});
  });
  at(T.end,()=>finish('done'));
}

/* ---------- 减少动态:三幕文字完整呈现,仅用淡入淡出 ---------- */
function runReduced(){
  R=collect();
  R.love.classList.add('show');
  R.loveL.forEach(e=>e.style.opacity=1);
  R.futureL.forEach(e=>e.style.opacity=1);
  R.chars.forEach(e=>e.style.opacity=1);
  R.puddle.style.display='none';
  R.envParts.forEach(e=>e.style.display='none');
  R.paper.style.transform='translateY(-67px)';
  R.creases.forEach(c=>c.style.display='none');
  const fade=(el,a,b,delay,dur)=>anim(el,[{opacity:a},{opacity:b}],{duration:dur,delay,easing:'ease-in-out'});
  emit('act',{n:1,name:'减少动态 · love'});
  fade(R.love,0,1,300,700);  fade(R.love,1,0,2300,500);
  after(2400,()=>emit('act',{n:2,name:'减少动态 · 因为爱，所以相遇'}));
  fade(R.env,0,1,2800,700);  fade(R.env,1,0,5800,500);
  after(6000,()=>emit('act',{n:3,name:'减少动态 · FUTURE'}));
  fade(R.future,0,1,6300,700);
  at(8600,()=>{ emit('exit'); anim(introEl,[{opacity:1},{opacity:0}],{duration:800,easing:'ease-in-out',fill:'forwards'}); });
  at(9500,()=>finish('done'));
}

/* ---------- 结束 / 回退 ---------- */
function teardown(){
  const s=S; if(!s) return;
  s.done=true; s.timers.forEach(clearTimeout);
  introEl.style.display='none';
  s.anims.forEach(a=>{ try{a.cancel();}catch(_){} });
  scene.innerHTML=''; R=null;
}
function finish(reason){
  const s=S; if(!s||s.done) return;
  teardown();
  emit('done',{reason});
  try{ s.onDone&&s.onDone(reason); }catch(e){ console.error(e); }
  s.resolve&&s.resolve(reason);
}
function fail(e){
  console.error('[XWIntro]',e);
  finish('error');   // 任何异常都直接放行进入锁屏
}
function destroy(){        // 重播前静默清理,不触发 onDone
  const s=S; if(!s||s.done) return;
  teardown(); s.resolve&&s.resolve('restart');
}

function play(opts={}){
  if(S&&!S.done){ if(!opts.force) return S.promise; destroy(); }       // 防重复播放
  const reduced=opts.reduced!=null?opts.reduced:matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s=S={done:false,timers:[],anims:[],K:(reduced?1:PACE)*(opts.speed||1),t0:0,onDone:opts.onDone,onEvent:opts.onEvent};
  s.promise=new Promise(r=>s.resolve=r);
  introEl.getAnimations&&introEl.getAnimations().forEach(a=>a.cancel());
  introEl.style.display=''; introEl.style.opacity='';
  scene.classList.remove('sway');
  scene.innerHTML=SCENE_HTML;
  fit();
  const ready=document.fonts&&document.fonts.ready
    ? Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,800))]) : Promise.resolve();
  ready.then(()=>requestAnimationFrame(()=>{
    if(S!==s||s.done) return;
    s.t0=performance.now();
    s.timers.push(setTimeout(()=>{ if(S===s&&!s.done) finish('timeout'); },(reduced?9500:T.end)*s.K+4000)); // 兜底
    try{ reduced?runReduced():runFull(); }catch(e){ fail(e); }
  }));
  return s.promise;
}
function skip(){
  const s=S; if(!s||s.done) return;
  s.timers.forEach(clearTimeout);
  emit('exit');
  const a=introEl.animate([{opacity:getComputedStyle(introEl).opacity},{opacity:0}],{duration:320,fill:'forwards'});
  s.anims.push(a);
  setTimeout(()=>{ if(S===s) finish('skip'); },340);
}
window.XWIntro={play,skip};
})();

/* ============================================================
 * GROUP-INTRO · 开场动画接线（替换旧版开机动画，2026-11-26）
 * 只做接线，不动 XWIntro 本体：
 *  ① 开关：沿用 phone_boot_anim_v1（{enabled}；旧的 style 字段直接忽略，
 *     以前关过开机动画的用户仍保持关闭，不会被重置为开）。
 *  ② 冷启动自动播：XWIntro.play({ onDone, onEvent })；任何 reason
 *     （done/skip/error/timeout）都进锁屏；onEvent('exit') 时同步启动锁屏淡入。
 *     播放期间给灵动岛加 xw-intro-hide（见 css/02-group-intro.css），
 *     onDone 时摘掉；动画被关掉（boot 不播放）时不隐藏。
 *     减动效时不跳过——播包里自带的淡入淡出版（runReduced）。
 *  ③ 点按跳过：XWIntro 本身不绑点击，这里补 pointerdown/click → skip()。
 *  ④ 设置页：桌面与外观 → 开机动画只剩一个开关 + 预览（无样式二选一）。
 * 进入锁屏：冷启动本来就在锁屏（isLocked 默认 true，锁屏层自带 sys-active），
 * enterLockscreen 只做兜底确认 + 淡入，不改 isLocked 以外的任何状态。
 * ============================================================ */
(function () {
  'use strict';
  if (window.GroupIntro) return;
  var KEY = 'phone_boot_anim_v1';
  var _fadeTimer = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { enabled: true };
      var o = JSON.parse(raw) || {};
      return { enabled: o.enabled !== false };
    } catch (e) { return { enabled: true }; }
  }
  function save(patch) {
    var cur = load();
    if (patch && typeof patch.enabled === 'boolean') cur.enabled = patch.enabled;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }
  /* 锁屏淡入：挂一次性动画类，动画结束即摘掉；层本身已有 .sys-active（opacity 1），
     淡入只是从 0 到 1 的过场。animationend 没触发时用 900ms 兜底摘除。 */
  function lockFadeIn() {
    try {
      var layer = document.getElementById('sys-lockscreen-layer');
      if (!layer || layer.classList.contains('xw-lock-fadein')) return;
      layer.classList.add('xw-lock-fadein');
      var done = function () { try { layer.classList.remove('xw-lock-fadein'); } catch (e) {} };
      layer.addEventListener('animationend', done, { once: true });
      clearTimeout(_fadeTimer);
      _fadeTimer = setTimeout(done, 900);
    } catch (e) {}
  }
  function enterLockscreen() {
    try {
      var layer = document.getElementById('sys-lockscreen-layer');
      if (layer && !layer.classList.contains('sys-active')) layer.classList.add('sys-active');
    } catch (e) {}
    lockFadeIn();
  }
  /* 灵动岛只在开场动画播放期间隐藏：加类即藏，摘类即恢复原状，不动
     IslandManager 的设置值（phone_island_settings_v1）与 DynamicIsland 的活动状态。 */
  function hideIsland() {
    try { var isl = document.getElementById('sys-dynamic-island'); if (isl) isl.classList.add('xw-intro-hide'); } catch (e) {}
  }
  function showIsland() {
    try { var isl = document.getElementById('sys-dynamic-island'); if (isl) isl.classList.remove('xw-intro-hide'); } catch (e) {}
  }
  function play(opts) {
    opts = opts || {};
    if (!window.XWIntro || typeof window.XWIntro.play !== 'function') { enterLockscreen(); return null; }
    hideIsland();
    try {
      return window.XWIntro.play({
        force: !!opts.force,
        onDone: function (reason) {
          showIsland();
          try { console.log('[GroupIntro] done:', reason); } catch (e) {}
          if (!opts.preserveScreen) enterLockscreen();
        },
        onEvent: function (name) { if (name === 'exit' && !opts.preserveScreen) lockFadeIn(); }
      });
    } catch (e) { showIsland(); enterLockscreen(); return null; }
  }
  function skip() {
    try { if (window.XWIntro) window.XWIntro.skip(); } catch (e) { enterLockscreen(); }
  }
  function boot() {
    var cfg = load();
    if (!cfg.enabled) {
      var intro = document.getElementById('xwIntro');
      if (intro) intro.style.display = 'none';
      return false;
    }
    play({});
    return true;
  }
  /* 设置页接线：桌面与外观里的开关 / 预览（事件委托，不碰 GroupW 的键） */
  function rerenderDeskBody() {
    try {
      var body = document.querySelector('#gw-desk-body');
      if (body && window.GroupW && typeof window.GroupW.renderDesktopSettingsHTML === 'function') {
        body.innerHTML = window.GroupW.renderDesktopSettingsHTML();
      }
    } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-intro-boot-toggle],[data-intro-boot-preview]') : null;
    if (!t) return;
    if (t.hasAttribute('data-intro-boot-toggle')) {
      var cur = load();
      save({ enabled: !cur.enabled });
      rerenderDeskBody();
      return;
    }
    if (t.hasAttribute('data-intro-boot-preview')) {
      play({ force: true });
    }
  });
  /* 点按跳过：XWIntro 本身不绑点击，这里补上（旧 BV 也是点按即跳过）。 */
  try {
    var introEl = document.getElementById('xwIntro');
    if (introEl) {
      introEl.addEventListener('pointerdown', function () { skip(); });
      introEl.addEventListener('click', function () { skip(); });
    }
  } catch (e) {}

  window.GroupIntro = { KEY: KEY, load: load, save: save, play: play, skip: skip, boot: boot, enterLockscreen: enterLockscreen, lockFadeIn: lockFadeIn, hideIsland: hideIsland, showIsland: showIsland };
  boot();
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && load().enabled) play({ force: true, preserveScreen: true });
  });
})();
