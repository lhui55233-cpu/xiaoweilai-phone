
// 开屏独立兜底（与主脚本启动链无关）：5 秒后强制移除开屏，防止启动抛错导致永久黑屏
setTimeout(function(){
    try {
        var s = document.getElementById('sys-splash-screen');
        if (s && s.parentNode) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; setTimeout(function(){ try { s.remove(); } catch(e){} }, 300); }
    } catch(e){}
}, 5000);
window.addEventListener('error', function(e){ try { console.error('[全局错误]', e.message); } catch(_){} try { var _l = (window.__xwlCoreErrors = window.__xwlCoreErrors || []); _l.push({ at: new Date().toISOString(), message: String((e && e.message) || '未知错误').slice(0, 200), file: String((e && e.filename) || '').slice(0, 120), line: (e && e.lineno) || 0, col: (e && e.colno) || 0 }); while (_l.length > 30) _l.shift(); } catch(_2){} }); /* GROUP-CORE: 报错收集——只记最近 30 条，只记错误信息与位置，不记记忆正文与密钥；不联网、不自动上报、不落盘 */
