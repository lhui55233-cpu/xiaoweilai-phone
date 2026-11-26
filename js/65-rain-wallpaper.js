/* GROUP-WALLPAPER-RAIN · 只在雨景壁纸上绘制细雨；锁屏/桌面可见、前台、无 app 时运行。 */
(function (w, d) {
  'use strict';
  var PREFS_KEY='phone_ui_prefs_v1', RAIN_ID='rain-letters', canvas=d.getElementById('xwl-rain-canvas');
  if(!canvas){var shell=d.getElementById('sys-shell'); if(!shell)return; canvas=d.createElement('canvas'); canvas.id='xwl-rain-canvas'; canvas.setAttribute('aria-hidden','true'); shell.insertBefore(canvas,shell.children[1]||null);}
  var ctx=canvas.getContext('2d'), raf=0, timer=0, drops=[], last=0, width=0, height=0, battery=null, media=null;
  function prefs(){try{return JSON.parse(w.localStorage.getItem(PREFS_KEY)||'{}')||{};}catch(_){return{};}}
  function lowPower(){
    try{if(battery && !battery.charging && battery.level<=0.18)return true;}catch(_){}
    try{if(w.matchMedia && w.matchMedia('(prefers-reduced-data: reduce)').matches)return true;}catch(_){}
    try{for(var i=0;i<w.localStorage.length;i++){var k=w.localStorage.key(i)||'';if(/low.?power|power.?save|battery.?saver/i.test(k)&&/^(1|true|on)$/i.test(w.localStorage.getItem(k)||''))return true;}}catch(_){}
    return false;
  }
  function activeWallpaper(){
    var shell=d.getElementById('sys-shell'), lock=d.getElementById('sys-lockscreen-layer'); if(!shell)return false;
    var locked=shell.classList.contains('sys-locked');
    try{locked=locked||(typeof SystemStore!=='undefined'&&SystemStore.get('isLocked'));}catch(_){}
    var lockId=lock&&lock.getAttribute('data-xwl-wallpaper-id');
    if(locked){
      if(lockId)return lockId===RAIN_ID;
      try{if(typeof SystemStore!=='undefined'&&SystemStore.get('lockscreen_wp'))return false;}catch(_){}
    }
    return (shell.getAttribute('data-gw-wallpaper')||'')===RAIN_ID;
  }
  function appOpen(){
    var host=d.getElementById('sys-app-host'); if(!host)return false;
    var nodes=host.querySelectorAll('.sys-app-window,[data-app-sandbox],.gB-ov');
    for(var i=0;i<nodes.length;i++){var n=nodes[i],cs=w.getComputedStyle(n),r=n.getBoundingClientRect();if(cs.display!=='none'&&cs.visibility!=='hidden'&&Number(cs.opacity||1)>.03&&r.width>0&&r.height>0)return true;}
    return false;
  }
  function reduced(){
    try{if(d.documentElement.classList.contains('sys-reduce-motion'))return true;}catch(_){}
    try{if(media&&media.matches)return true;}catch(_){}
    return lowPower();
  }
  function resize(){
    var shell=d.getElementById('sys-shell');if(!shell)return;
    var r=shell.getBoundingClientRect(),dpr=Math.min(1.5,Math.max(1,w.devicePixelRatio||1));
    width=Math.max(1,Math.round(r.width*dpr));height=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';
      var count=Math.max(34,Math.min(78,Math.round(r.height/12)));drops=[];
      for(var i=0;i<count;i++)drops.push({x:Math.random()*width,y:Math.random()*height,len:(13+Math.random()*24)*dpr,speed:(100+Math.random()*190)*dpr,drift:(-12-Math.random()*12)*dpr,a:.08+Math.random()*.18,w:(.55+Math.random()*.55)*dpr});
    }
  }
  function draw(){
    if(!ctx)return;ctx.clearRect(0,0,width,height);
    ctx.lineCap='round';
    for(var i=0;i<drops.length;i++){var p=drops[i];ctx.strokeStyle='rgba(218,232,239,'+p.a+')';ctx.lineWidth=p.w;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.drift*.12,p.y+p.len);ctx.stroke();}
  }
  function step(ts){raf=0;if(!canvas.isConnected)return; if(ts-last<42){raf=w.requestAnimationFrame(step);return;}var dt=Math.min(.06,(ts-last||40)/1000);last=ts;var scale=Math.min(1.5,Math.max(1,w.devicePixelRatio||1));
    for(var i=0;i<drops.length;i++){var p=drops[i];p.x+=p.drift*dt;p.y+=p.speed*dt;if(p.y>height+p.len||p.x<-20*scale){p.x=Math.random()*width+30*scale;p.y=-p.len-Math.random()*height*.18;}}
    draw();raf=w.requestAnimationFrame(step);
  }
  function sync(){
    var shell=d.getElementById('sys-shell');if(!shell||!canvas)return;
    var rain=activeWallpaper(),on=prefs().rainEnabled!==false;
    shell.classList.toggle('rain-wallpaper-on',!!(rain&&on));
    if(!rain||!on){if(raf)w.cancelAnimationFrame(raf);raf=0;canvas.style.display='none';return;}
    canvas.style.display='block';resize();
    var visible=d.visibilityState!=='hidden';
    var safe=visible&&!appOpen()&&!reduced();
    if(!safe){if(raf)w.cancelAnimationFrame(raf);raf=0;draw();return;}
    if(!raf){last=0;raf=w.requestAnimationFrame(step);}
  }
  function schedule(){if(timer)w.clearTimeout(timer);timer=w.setTimeout(function(){timer=0;sync();},80);}
  try{media=w.matchMedia('(prefers-reduced-motion: reduce)');if(media.addEventListener)media.addEventListener('change',schedule);else if(media.addListener)media.addListener(schedule);}catch(_){}
  w.addEventListener('resize',schedule,{passive:true});d.addEventListener('visibilitychange',schedule);
  w.addEventListener('storage',function(e){if(!e||e.key===PREFS_KEY)schedule();});
  try{var shell=d.getElementById('sys-shell');if(shell&&w.MutationObserver){new MutationObserver(schedule).observe(shell,{attributes:true,attributeFilter:['data-gw-wallpaper','class']});}}catch(_){}
  try{var host=d.getElementById('sys-app-host');if(host&&w.MutationObserver)new MutationObserver(schedule).observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}catch(_){}
  try{if(w.navigator&&navigator.getBattery)navigator.getBattery().then(function(b){battery=b;['chargingchange','levelchange'].forEach(function(ev){b.addEventListener(ev,schedule);});schedule();}).catch(function(){});}catch(_){}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
  w.XwlRainWallpaper={sync:sync,version:'1.0.0'};
  w.setInterval(sync,1800);
})(window,document);
