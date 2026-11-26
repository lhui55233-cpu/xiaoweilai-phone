
// ══════════════════════════════════════════════════════════════════════
// AJ组 · 锁屏密码默认不要（GROUP-AJ-LOCK）
// 键：phone_lock_pw_v1（锁屏密码本身，只存本地，备份/导出排除）、
// phone_lock_fail_v1（输错计数）、phone_char_named_v1（用户是否亲手给
// char 起过名字）。不改任何已有键。
// 默认无锁屏密码；忘记密码可清除重进；输错 5 次不锁死。
// 2026-11-26：首次设置向导已整段删除，首次打开直接进锁屏；
// 向导收集的名字/头像/壁纸/角色名/密码在设置 App 里本来就有入口（见交付报告）。
// ══════════════════════════════════════════════════════════════════════
window.GroupAJ = (() => {
const PW_KEY = 'phone_lock_pw_v1';
const FAIL_KEY = 'phone_lock_fail_v1';
const NAMED_KEY = 'phone_char_named_v1';
const lsGet = (k) => { try { return localStorage.getItem(k);} catch (e) { return null;}};
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true;} catch (e) { return false;}};
const lsDel = (k) => { try { localStorage.removeItem(k);} catch (e) {}};
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
}
return {
getPw: getPw, hasPw: hasPw, setPw: setPw, clearPw: clearPw, verifyPw: verifyPw,
noteLockFail: noteLockFail, resetLockFail: resetLockFail, failCount: failCount,
forgotPw: forgotPw, showLockHint: showLockHint, syncPasscodeBox: syncPasscodeBox,
charDisplayName: charDisplayName, setCharName: setCharName,
boot: boot,
_keys: { pw: PW_KEY, fail: FAIL_KEY, named: NAMED_KEY}
};
})();
