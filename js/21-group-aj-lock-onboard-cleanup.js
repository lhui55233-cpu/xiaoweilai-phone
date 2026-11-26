
// ══════════════════════════════════════════════════════════════════════
// AJ组 · 锁屏密码默认不要 + 首次设置页（GROUP-AJ-LOCK-ONBOARD-CLEANUP）
// 新键：phone_lock_pw_v1（锁屏密码本身，只存本地，备份/导出排除）、
// phone_onboarded_v1（'done'/'skipped'）、phone_lock_fail_v1（输错计数）、
// phone_char_named_v1（用户是否亲手给 char 起过名字）。不改任何已有键。
// 默认无锁屏密码；忘记密码可清除重进；输错 5 次不锁死。
// ══════════════════════════════════════════════════════════════════════
window.GroupAJ = (() => {
const PW_KEY = 'phone_lock_pw_v1';
const ONB_KEY = 'phone_onboarded_v1';
const FAIL_KEY = 'phone_lock_fail_v1';
const NAMED_KEY = 'phone_char_named_v1';
const TOKEN_KEY = 'phone_token_stats_v1';
const lsGet = (k) => { try { return localStorage.getItem(k);} catch (e) { return null;}};
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true;} catch (e) { return false;}};
const lsDel = (k) => { try { localStorage.removeItem(k);} catch (e) {}};
const esc = (s) => String(s == null? '': s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// ── 旧键迁移（只做一次）：用户自己改过的非默认旧密码接过来；默认 1314 是预设，清掉 ──
function migrateLegacy() {
try {
if (lsGet(PW_KEY)!= null) return;
const legacy = lsGet('phone_lock_passcode');
if (legacy && legacy!== '1314') lsSet(PW_KEY, legacy);
lsDel('phone_lock_passcode');
lsDel('phone_lock_disabled');
} catch (e) {}
}
function getPw() { try { if (window.GroupAO) window.GroupAO.migrateLegacy(); } catch(e){} return null; /* [AO] 明文密码已迁移为加盐哈希（phone_lock_pw_hash_v1）：getPw 不再返回密码本身。是否设置请用 hasPw()，种类请用 GroupAO.pwKind()。 */ }
function hasPw() { try { if (window.GroupAO) window.GroupAO.migrateLegacy(); } catch(e){} try { return !!lsGet('phone_lock_pw_hash_v1'); } catch(e){ return false; } }
function validPw(p) { return typeof p === 'string' && p.trim().length >= 1 && p.trim().length <= 20;}
function setPw(p) {
if (!validPw(p)) return { ok: false, error: '密码 1–20 字，4 位数字或文字都可以'};
try { if (window.GroupAO) { window.GroupAO.setPin(p.trim()); resetLockFail(); return { ok: true}; } } catch(e){}
return { ok: false, error: '锁屏模块未加载，请重试（密码未保存，绝不存明文）'};
}
function clearPw() { try { if (window.GroupAO) window.GroupAO.clearPin(); } catch(e){} lsDel(PW_KEY); resetLockFail(); return true;}
function verifyPw(p) { try { if (window.GroupAO) return window.GroupAO.verifyPin(p); } catch(e){} return Promise.resolve(false); /* [AO] verifyPw 改为返回 Promise<boolean>（PBKDF2 异步校验）；同步调用处已全部改掉。 */ }
function failCount() { const n = parseInt(lsGet(FAIL_KEY) || '0', 10); return isNaN(n)? 0: n;}
function noteLockFail() { const n = failCount() + 1; lsSet(FAIL_KEY, String(n)); return n;}
function resetLockFail() { lsDel(FAIL_KEY);}
function forgotPw() { clearPw(); return true;}
function showLockHint(msg) {
const el = document.getElementById('aj-lock-hint');
if (el) { el.style.display = 'block'; el.textContent = msg;}
}
// 密码框形态：4 位数字走数字键盘，文字密码走文字输入框；忘记密码常驻
function syncPasscodeBox() {
const box = document.getElementById('sys-passcode-box');
if (!box) return;
const pw = getPw();
const keypad = document.getElementById('sys-keypad');
const dots = document.getElementById('sys-passcode-dots');
const textRow = document.getElementById('aj-pw-text');
const hint = document.getElementById('aj-lock-hint');
const isText = (function(){ try { if (window.GroupAO) return window.GroupAO.pwKind() === 'text'; } catch(e){} return !!(pw && !/^\d{4}$/.test(pw)); })();
if (keypad) keypad.style.display = isText? 'none': '';
if (dots) dots.style.display = isText? 'none': '';
if (textRow) textRow.style.display = isText? 'flex': 'none';
if (hint && failCount() < 5) hint.style.display = 'none';
}
function unlockNow() {
try { if (typeof SystemStore!== 'undefined') SystemStore.set('isLocked', false);} catch (e) {}
try { document.getElementById('sys-lockscreen-layer')?.classList.remove('sys-active');} catch (e) {}
try { document.getElementById('sys-passcode-box')?.classList.remove('sys-active');} catch (e) {}
const tb = document.querySelector('.sys-lock-time-box'); if (tb) tb.style.opacity = '';
const ft = document.querySelector('.sys-lock-footer'); if (ft) ft.style.opacity = '';
}
function askForgot() {
let ok = false;
try { ok = window.confirm('忘记锁屏密码了？\n点“确定”会清除锁屏密码，直接进入手机（不会锁死）。');} catch (e) { ok = true;}
if (!ok) return;
forgotPw();
unlockNow();
}
async function submitTextPw() {
const inp = document.getElementById('aj-pw-text-input');
if (!inp) return;
const v = inp.value || '';
try { if (window.GroupAO) { var _left = window.GroupAO.cooldownLeftMs(); if (_left > 0) { showLockHint('输错太多次了，请等 ' + Math.ceil(_left/1000) + ' 秒再试，或点“忘记密码”清除后直接进入。'); inp.value = ''; return; } } } catch(e){}
var ok = false;
try { ok = window.GroupAO ? await window.GroupAO.verifyPin(v) : false; } catch(e){ ok = false; }
if (ok) { try { if (window.GroupAO) window.GroupAO.recordOk(); } catch(e){} resetLockFail(); inp.value = ''; unlockNow();}
else {
var n = 0; try { n = window.GroupAO ? window.GroupAO.noteFail() : noteLockFail(); } catch(e){ n = noteLockFail(); }
var leftMs = 0; try { leftMs = window.GroupAO ? window.GroupAO.cooldownLeftMs() : 0; } catch(e){}
showLockHint(leftMs > 0 ? ('输错太多次了，请等 ' + Math.ceil(leftMs/1000) + ' 秒再试；也可以点“忘记密码”清除后直接进入，不会锁死。') : (n >= 5 ? '已经输错 5 次了，点下面的“忘记密码”可以清除密码后直接进入，不会锁死。' : '密码不对，再试一次（输错 5 次会提示用“忘记密码”找回）。'));
inp.value = '';
try { inp.focus();} catch (e) {}
}
}
// ── char 名字：显示层 fallback 用 'TA'；只有用户亲手起过名才显示真名 ──
function charDisplayName() {
try { if (typeof SystemStore!== 'undefined' && SystemStore.get) { const c = SystemStore.get('character'); if (c) return c;}} catch (e) {}
try {
if (lsGet(NAMED_KEY) === '1' && typeof MemoryCore!== 'undefined' && MemoryCore.world) {
const a = MemoryCore.world.get('activeChar');
if (a) return a;
}
} catch (e) {}
return 'TA';
}
function setCharName(name) {
const n = String(name || '').trim();
try { if (typeof SystemStore!== 'undefined') SystemStore.set('character', n || '');} catch (e) {}
try { if (n && typeof MemoryCore!== 'undefined' && MemoryCore.world) MemoryCore.world.set('activeChar', n);} catch (e) {}
if (n) lsSet(NAMED_KEY, '1'); else lsDel(NAMED_KEY);
return n || 'TA';
}
// ── 首次设置 ──
function isOnboarded() { return lsGet(ONB_KEY)!= null;}
function markOnboarded(mode) { lsSet(ONB_KEY, mode === 'done'? 'done': 'skipped');}
function readToken() { try { return JSON.parse(lsGet(TOKEN_KEY) || '{}') || {};} catch (e) { return {};}}
function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); return true;} catch (e) { return false;}}
function setUserName(name) { const t = readToken(); t.userName = String(name || '').trim(); saveToken(t); return t.userName;}
function setUserAvatar(dataUrl) { const t = readToken(); t.avatar = dataUrl || ''; saveToken(t); return true;}
function setWallpaper(v) {
try { if (typeof SystemStore!== 'undefined') SystemStore.set('wallpaper', v || '');} catch (e) {}
try {
const sh = document.getElementById('sys-shell');
if (sh) sh.style.backgroundImage = v? ('url("' + v + '"), linear-gradient(160deg,#ffffff,#f7f3ec)'): 'linear-gradient(160deg, #ffffff 0%, #fdfcf9 55%, #f7f3ec 100%)';
} catch (e) {}
return true;
}
let _obWp = '';
let _obAvatar = '';
function showOnboarding() {
if (document.getElementById('aj-onboard')) return;
_obWp = '';
_obAvatar = '';
const ov = document.createElement('div');
ov.id = 'aj-onboard';
ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(255,255,255,0.97);overflow-y:auto;padding:64px 24px 40px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#25262a;';
ov.innerHTML =
'<div style="max-width:340px;margin:0 auto;">'
+ '<div style="font-size:24px;font-weight:700;">欢迎使用小未来的手机</div>'
+ '<div style="font-size:13px;color:#8a8580;line-height:1.7;margin:8px 0 20px;">首次设置，一次设好；也可以跳过，以后随时在设置里改。壁纸默认纯白，锁屏默认没有密码。</div>'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">你的名字</div>'
+ '<input id="aj-ob-name" type="text" maxlength="20" placeholder="可留空" style="width:100%;box-sizing:border-box;padding:11px 14px;border:1px solid #ddd;border-radius:12px;font-size:15px;outline:none;margin-bottom:16px;">'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">你的头像</div>'
+ '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;"><div id="aj-ob-av" style="width:56px;height:56px;border-radius:50%;background:#f0f0f2;display:flex;align-items:center;justify-content:center;font-size:22px;color:#999;overflow:hidden;flex-shrink:0;">?</div>'
+ '<label style="padding:9px 16px;border:1px solid #ddd;border-radius:20px;font-size:13px;background:#fff;cursor:pointer;">上传头像<input id="aj-ob-avatar" type="file" accept="image/*" style="display:none;"></label>'
+ '<span style="font-size:12px;color:#999;">不传就是空白占位</span></div>'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">壁纸</div>'
+ '<div id="aj-ob-wps" style="display:flex;gap:10px;margin-bottom:8px;">'
+ ['#ffffff', '#f7f3ec', '#e8e6e1', '#dce5dc'].map((c, i) => '<span data-aj-wp="' + c + '" style="width:44px;height:44px;border-radius:12px;background:' + c + ';border:2px solid ' + (i === 0? '#25262a': '#ddd') + ';cursor:pointer;display:block;"></span>').join('')
+ '</div>'
+ '<label style="display:inline-block;padding:9px 16px;border:1px solid #ddd;border-radius:20px;font-size:13px;background:#fff;cursor:pointer;margin-bottom:16px;">上传自己的壁纸<input id="aj-ob-wpfile" type="file" accept="image/*" style="display:none;"></label>'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">他的名字（可选）</div>'
+ '<input id="aj-ob-char" type="text" maxlength="20" placeholder="不填就叫 TA" style="width:100%;box-sizing:border-box;padding:11px 14px;border:1px solid #ddd;border-radius:12px;font-size:15px;outline:none;margin-bottom:16px;">'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">锁屏密码（可选）</div>'
+ '<input id="aj-ob-pw" type="text" maxlength="20" autocomplete="off" placeholder="4 位数字或文字密码，不填就没有密码" style="width:100%;box-sizing:border-box;padding:11px 14px;border:1px solid #ddd;border-radius:12px;font-size:15px;outline:none;">'
+ '<div style="font-size:12px;color:#999;line-height:1.6;margin:6px 0 20px;">设了之后锁屏才要密码；忘记密码可以在锁屏点“忘记密码”清除重进。</div>'
+ '<button id="aj-ob-done" style="width:100%;padding:13px;border:none;border-radius:14px;background:#25262a;color:#fff;font-size:16px;font-weight:600;">完成设置</button>'
+ '<button id="aj-ob-skip" style="width:100%;padding:13px;margin-top:10px;border:none;border-radius:14px;background:#f0f0f2;color:#555;font-size:15px;">跳过，以后再说</button>'
+ '</div>';
document.body.appendChild(ov);
const readFile = (inp, cb) => {
const f = inp && inp.files && inp.files[0];
if (!f) return;
const r = new FileReader();
r.onload = (ev) => cb(String(ev.target.result || ''));
r.readAsDataURL(f);
};
ov.querySelector('#aj-ob-avatar').addEventListener('change', (e) => {
readFile(e.target, (url) => {
_obAvatar = url;
const pv = ov.querySelector('#aj-ob-av');
if (pv) pv.innerHTML = '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;">';
});
});
ov.querySelector('#aj-ob-wpfile').addEventListener('change', (e) => { readFile(e.target, (url) => { _obWp = url;});});
ov.querySelectorAll('#aj-ob-wps [data-aj-wp]').forEach((sw) => {
sw.addEventListener('click', () => {
_obWp = sw.getAttribute('data-aj-wp') === '#ffffff'? '': sw.getAttribute('data-aj-wp');
ov.querySelectorAll('#aj-ob-wps [data-aj-wp]').forEach((x) => { x.style.borderColor = '#ddd';});
sw.style.borderColor = '#25262a';
});
});
ov.querySelector('#aj-ob-done').addEventListener('click', () => {
const name = (ov.querySelector('#aj-ob-name').value || '').trim();
const charName = (ov.querySelector('#aj-ob-char').value || '').trim();
const pw = (ov.querySelector('#aj-ob-pw').value || '').trim();
if (name) setUserName(name);
if (_obAvatar) setUserAvatar(_obAvatar);
setWallpaper(_obWp);
if (charName) setCharName(charName);
if (pw) {
const r = setPw(pw);
if (!r.ok) { try { alert(r.error);} catch (e) {} return;}
}
markOnboarded('done');
ov.remove();
});
ov.querySelector('#aj-ob-skip').addEventListener('click', () => { markOnboarded('skipped'); ov.remove();});
}
function bindLockBox() {
document.addEventListener('click', (ev) => {
const t = ev.target;
if (!t ||!t.closest) return;
if (t.closest('#aj-forgot-pw')) { ev.preventDefault(); ev.stopPropagation(); askForgot(); return;}
if (t.closest('#aj-pw-text-go')) { ev.preventDefault(); ev.stopPropagation(); submitTextPw(); return;}
});
document.addEventListener('keydown', (ev) => {
if (ev.key!== 'Enter') return;
const row = document.getElementById('aj-pw-text');
if (!row || row.style.display === 'none') return;
const inp = document.getElementById('aj-pw-text-input');
if (inp && document.activeElement === inp) submitTextPw();
});
}
function boot() {
try { bindLockBox();} catch (e) {}
try { if (!isOnboarded()) showOnboarding();} catch (e) {}
}
return {
getPw: getPw, hasPw: hasPw, setPw: setPw, clearPw: clearPw, verifyPw: verifyPw,
noteLockFail: noteLockFail, resetLockFail: resetLockFail, failCount: failCount,
forgotPw: forgotPw, showLockHint: showLockHint, syncPasscodeBox: syncPasscodeBox,
charDisplayName: charDisplayName, setCharName: setCharName,
isOnboarded: isOnboarded, markOnboarded: markOnboarded, showOnboarding: showOnboarding,
setUserName: setUserName, setUserAvatar: setUserAvatar, setWallpaper: setWallpaper,
boot: boot,
_keys: { pw: PW_KEY, onb: ONB_KEY, fail: FAIL_KEY, named: NAMED_KEY}
};
})();
