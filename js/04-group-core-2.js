
// ════════════════════════════════════════════════════════════════════
// 「小未来」云端长期记忆 AI 架构 · CloudDB
// ════════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://djjgzhrzzofclllyhjwe.supabase.co'; /* GROUP-CORE: 新项目 guichao（旧项目 mslwzgvqlkyhjoqsfyfs 不用、不删、不碰） */
const SUPABASE_KEY = 'sb_publishable_zWeTMR3dMYlMidrlD3GOvg_EDzjbYOa'; /* GROUP-CORE: 新项目 guichao 的 publishable key（client-safe） */
// Supabase CDN 带 defer：内联脚本执行时 window.supabase 必然还是 undefined，
// 必须轮询等待它加载完成再初始化（修复前这里永远走 else 分支，云端永久离线）
window.mySupabase = null;
const waitSupabase = (timeoutMs) => new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
        if (window.supabase) return resolve(true);
        if (window._supabaseLoadFailed || Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tick, 100);
    };
    tick();
});
waitSupabase(10000).then((ok) => {
    if (ok) {
        try { window.mySupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
        catch(e) { console.warn('[CloudDB] Supabase 初始化失败，降级本地模式:', e); }
    } else {
        console.warn('[CloudDB] Supabase CDN 未加载，云端功能降级为本地模式');
    }
    CloudDB.initUser();
});

const CloudDB = (() => {
    const USER_KEY = 'phone_cloud_user_id_v1';
    const sb = () => window.mySupabase;
    // 降级检查：Supabase 不可用时直接返回空操作
    const isAvailable = () => !!window.mySupabase;

    let currentUserId = localStorage.getItem(USER_KEY) || null;
    let ready = false;
    let readyResolvers = [];
    const whenReady = () => ready ? Promise.resolve() : new Promise(r => readyResolvers.push(r));
    // 请求超时保护：挂起的请求不能让 whenReady 永远不 resolve
    const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' 超时')), ms))]);

    // ── 初始化用户：匿名登录（新项目 guichao，RLS 是 user_id = auth.uid()）──
    // 旧项目 mslwzgvqlkyhjoqsfyfs 不再用；本地 phone_cloud_user_id_v1 继续存匿名 uid。
    // 匿名登录失败（离线/网络）时保留本地 ID、标记 ready，手机离线照常跑，不抛错。
    const initUser = async () => {
        if (!isAvailable()) {
            // 离线模式：直接标记 ready，不做网络请求
            ready = true; readyResolvers.forEach(r => r()); readyResolvers = [];
            return null;
        }
        try {
            let uid = null;
            try {
                const { data: sessData } = await withTimeout(sb().auth.getSession(), 8000, '读取登录态');
                uid = sessData && sessData.session && sessData.session.user && sessData.session.user.id;
            } catch (e) { uid = null; }
            if (!uid) {
                const { data, error } = await withTimeout(sb().auth.signInAnonymously(), 8000, '匿名登录');
                if (error) throw error;
                uid = data && data.user && data.user.id;
            }
            if (uid) {
                currentUserId = uid;
                window.currentUserId = uid;
                try { localStorage.setItem(USER_KEY, uid); } catch (e) {}
                // users.id = auth.uid()：有则更新昵称，无则建行；失败不阻塞（RLS 拒绝时本地继续跑）
                try {
                    await withTimeout(sb().from('users').upsert([{ id: uid, nickname: '小未来' }], { onConflict: 'id' }).select(), 8000, '同步用户');
                } catch (e) { console.warn('[CloudDB] users 同步失败（本地继续用）:', e.message); }
                ready = true; readyResolvers.forEach(r => r()); readyResolvers = [];
                return uid;
            }
        } catch (e) {
            console.warn('[CloudDB] initUser 失败（离线模式）:', e.message);
            if (currentUserId) window.currentUserId = currentUserId;
        }
        ready = true; readyResolvers.forEach(r => r()); readyResolvers = [];
        return currentUserId;
    };
    // ── conversations + messages 表（新项目 guichao；旧 chats 表不用）──
    // 按 character_name 找/建 conversation，再追加 message；conversation.kind 固定 'chat'。
    const findOrCreateConversation = async (charName) => {
        const name = charName || '未知';
        try {
            const { data, error } = await withTimeout(sb().from('conversations')
                .select('*').eq('user_id', currentUserId).eq('character_name', name).eq('status', 'active')
                .order('updated_at', { ascending: false }).limit(1), 8000, '查找会话');
            if (!error && data && data.length) return data[0];
        } catch (e) {}
        const { data: ins, error: insErr } = await withTimeout(sb().from('conversations')
            .insert([{ user_id: currentUserId, character_name: name, kind: 'chat' }]).select(), 8000, '创建会话');
        if (!insErr && ins && ins.length) return ins[0];
        // 并发建了两条时再查一次
        try {
            const { data: again } = await withTimeout(sb().from('conversations')
                .select('*').eq('user_id', currentUserId).eq('character_name', name).eq('status', 'active')
                .order('updated_at', { ascending: false }).limit(1), 8000, '复查会话');
            if (again && again.length) return again[0];
        } catch (e) {}
        return null;
    };
    const findConversation = async (charName) => {
        try {
            const { data, error } = await withTimeout(sb().from('conversations')
                .select('*').eq('user_id', currentUserId).eq('character_name', charName || '未知').eq('status', 'active')
                .order('updated_at', { ascending: false }).limit(1), 8000, '查找会话');
            if (!error && data && data.length) return data[0];
        } catch (e) {}
        return null;
    };

    const saveChat = async (charName, role, content, extra) => {
        await whenReady();
        if (!isAvailable() || !currentUserId) return null;
        try {
            const conv = await findOrCreateConversation(charName);
            if (!conv) { console.warn('[CloudDB] saveChat 失败：建不出会话'); return null; }
            const payload = {
                user_id: currentUserId,
                conversation_id: conv.id,
                character_name: charName || '未知',
                role: role,
                content: content || '',
                content_type: 'text',
                extra: extra || null,
                message_timestamp: new Date().toISOString(),
            };
            const { data, error } = await sb().from('messages').insert([payload]).select();
            if (error) { console.warn('[CloudDB] saveChat 失败:', error.message); return null; }
            // 顺手更新会话的最后消息时间；失败不影响已存的消息
            try { await sb().from('conversations').update({ last_message_at: payload.message_timestamp }).eq('id', conv.id); } catch (e) {}
            return data && data[0];
        } catch(e) { console.warn('[CloudDB] saveChat 异常:', e.message); return null; }
    };

    // 拉取某角色的最近 N 条聊天（按时间正序返回；只读，不建会话）
    const loadChats = async (charName, limit) => {
        if (!isAvailable() || !currentUserId) return [];
        try {
            const conv = await findConversation(charName);
            if (!conv) return [];
            const { data, error } = await sb()
                .from('messages')
                .select('*')
                .eq('user_id', currentUserId)
                .eq('conversation_id', conv.id)
                .order('message_timestamp', { ascending: true })
                .limit(limit || 50);
            if (error) { console.warn('[CloudDB] loadChats 失败:', error.message); return []; }
            return data || [];
        } catch(e) { console.warn('[CloudDB] loadChats 异常:', e.message); return []; }
    };

    // ── app_memories 表（新项目 guichao，决议 A；旧 memories 表不用）──
    // 本轮已存记忆去重（同一角色 + 同一内容只存一次；修复前一句对话可产生多条重复记忆行）
    const _seenMemories = new Set();
    const saveMemory = async (charName, content, opts) => {
        await whenReady();
        if (!isAvailable() || !currentUserId) return null;
        opts = opts || {};
        const normKey = (charName || '未知') + '::' + String(content || '').trim().replace(/\s+/g, ' ');
        if (_seenMemories.has(normKey)) return null;
        _seenMemories.add(normKey);
        try {
            const payload = {
                user_id: currentUserId,
                character_name: charName || '未知',
                content: content,
                category: opts.category || '一般',
                importance: typeof opts.importance === 'number' ? opts.importance : 5,
                emotion: opts.emotion || 'neutral',
                tags: opts.tags || []
            };
            const { data, error } = await sb().from('app_memories').insert([payload]).select();
            if (error) { console.warn('[CloudDB] saveMemory 失败:', error.message); return null; }
            return data && data[0];
        } catch(e) { console.warn('[CloudDB] saveMemory 异常:', e.message); return null; }
    };

    const loadMemories = async (charName, limit) => {
        if (!isAvailable() || !currentUserId) return [];
        try {
            const { data, error } = await sb()
                .from('app_memories').select('*')
                .eq('user_id', currentUserId).eq('character_name', charName)
                .order('importance', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit || 30);
            if (error) { console.warn('[CloudDB] loadMemories 失败:', error.message); return []; }
            return data || [];
        } catch(e) { console.warn('[CloudDB] loadMemories 异常:', e.message); return []; }
    };

    const getRelationship = async (charName) => {
        if (!isAvailable() || !currentUserId) return null;
        try {
            const { data, error } = await sb()
                .from('characters').select('*')
                .eq('user_id', currentUserId).eq('name', charName).maybeSingle();
            if (error) { console.warn('[CloudDB] getRelationship:', error.message); return null; }
            return data;
        } catch(e) { return null; }
    };

    const upsertRelationship = async (charName, patch) => {
        await whenReady();
        if (!isAvailable() || !currentUserId) return null;
        try {
            const cur = await getRelationship(charName) || {
                user_id: currentUserId, name: charName,
                affection: 50, dependency: 0, stage: '陌生', mood: 'neutral', mood_intensity: 50
            };
            const next = Object.assign({}, cur, patch);
            // 只发变更字段，不回传整行（含 id）；用 upsert 原子写替代先查后写（修复前并发可产生重复行）
            // 注意：需要 characters 表在 (user_id, name) 上有唯一约束；没有时走回退分支
            const { id, user_id, name, ...changes } = next;
            const { data, error } = await sb().from('characters')
                .upsert([{ user_id: currentUserId, name: charName, ...changes }], { onConflict: 'user_id,name' })
                .select();
            if (!error) return data && data[0];
            console.warn('[CloudDB] upsert 失败，回退到查后写:', error.message);
            if (cur.id) {
                const { data: d2, error: e2 } = await sb().from('characters').update(changes).eq('id', cur.id).select();
                if (e2) console.warn('[CloudDB] update relationship:', e2.message);
                return d2 && d2[0];
            } else {
                const { data: d3, error: e3 } = await sb().from('characters').insert([{ user_id: currentUserId, name: charName, ...changes }]).select();
                if (e3) console.warn('[CloudDB] insert relationship:', e3.message);
                return d3 && d3[0];
            }
        } catch(e) { console.warn('[CloudDB] upsertRelationship 异常:', e.message); return null; }
    };

    // ── 从一段对话自动分析提取记忆（轻量规则版；可被 AI 提取替换）──
    // 返回 [{content, category, importance, emotion}, ...]
    const extractMemoryHints = (userText, aiText) => {
        const out = [];
        const u = String(userText || '').trim();
        const a = String(aiText || '').trim();
        if (!u && !a) return out;
        // 敏感话题先判定：情绪规则与敏感规则互斥，避免同一句话记两条
        const isSensitive = /(自杀|自残|抑郁|想死|焦虑症|双相|创伤)/.test(u);

        // 偏好/喜好
        const likeMatch = u.match(/我(?:很|超|特别|最)?(?:喜欢|爱|讨厌|不喜欢)([^，。,!?\.]{1,20})/);
        if (likeMatch) {
            const isNeg = /讨厌|不喜欢/.test(likeMatch[0]);
            out.push({
                content: `用户${isNeg ? '不喜欢' : '喜欢'}${likeMatch[1].trim()}`,
                category: '喜好', importance: 7, emotion: isNeg ? 'negative' : 'positive'
            });
        }
        // AI 复述的用户偏好（aiText 参数此前完全没用）
        if (!likeMatch) {
            const aiLike = a.match(/你(?:很|超|特别|最)?(?:喜欢|爱)([^，。,!?\.]{1,20})/);
            if (aiLike) {
                out.push({ content: `用户喜欢${aiLike[1].trim()}`, category: '喜好', importance: 7, emotion: 'positive' });
            }
        }
        // 习惯
        const habitMatch = u.match(/我(?:每天|经常|总是|习惯)([^，。,!?\.]{2,20})/);
        if (habitMatch) {
            out.push({ content: `用户的习惯：${habitMatch[1].trim()}`, category: '习惯', importance: 6, emotion: 'neutral' });
        }
        // 身份/职业/年龄/地点
        const idMatch = u.match(/我(?:是|叫|今年|在)([^，。,!?\.]{2,25})/);
        if (idMatch) {
            out.push({ content: `用户提到：我${idMatch[0].slice(1).trim()}`, category: '长期设定', importance: 8, emotion: 'neutral' });
        }
        // 重要关系
        const relMatch = u.match(/我(?:的)?(妈妈|爸爸|爸|妈|父亲|母亲|男朋友|女朋友|老公|老婆|姐姐|哥哥|妹妹|弟弟|朋友|同事|室友|宠物)/);
        if (relMatch) {
            out.push({ content: `用户提到自己的${relMatch[1]}`, category: '关系', importance: 7, emotion: 'neutral' });
        }
        // 情绪事件（强情绪词；敏感话题已单独记录时不再重复记一条）
        const emoMatch = u.match(/(难过|伤心|开心|高兴|生气|崩溃|抑郁|焦虑|想哭|想死|累|压力大|绝望)/);
        if (emoMatch && !isSensitive) {
            out.push({
                content: `用户情绪：${emoMatch[1]}`,
                category: '情绪事件', importance: 8,
                emotion: /开心|高兴/.test(emoMatch[1]) ? 'positive' : 'negative'
            });
        }
        // 敏感话题：只存风险标记，不存原文（修复前把自杀/自残等原文存进云端）
        if (isSensitive) {
            out.push({ content: '用户提及敏感话题（内容已脱敏，仅作风险提示，不保存原文）', category: '敏感话题', importance: 10, emotion: 'critical' });
        }
        // 特殊经历
        const eventMatch = u.match(/我(?:刚才|今天|昨天|刚刚)([^，。,!?\.]{4,30})/);
        if (eventMatch) {
            out.push({ content: `用户近期经历：${eventMatch[0].slice(1).trim()}`, category: '特殊经历', importance: 6, emotion: 'neutral' });
        }
        return out;
    };

    // ── 关系成长：基于本轮对话内容，更新好感度/依赖值/情绪 ──
    const updateRelationshipFromTurn = async (charName, userText, aiText) => {
        if (!charName || !currentUserId) return;
        const cur = (await getRelationship(charName)) || {};
        let aff = typeof cur.affection === 'number' ? cur.affection : 50;
        let dep = typeof cur.dependency === 'number' ? cur.dependency : 0;
        let mood = cur.mood || 'neutral';
        let intensity = typeof cur.mood_intensity === 'number' ? cur.mood_intensity : 50;

        // 用户表达爱意/依赖 → 好感+依赖↑
        if (/(喜欢你|爱你|想你|离不开|需要你|抱抱|亲亲)/.test(userText)) { aff += 2; dep += 2; mood = 'happy'; intensity = Math.min(100, intensity + 8); }
        // 用户表达难过 → 角色应该共情（情绪带过来）
        if (/(难过|伤心|想哭|压力大|累|崩溃)/.test(userText)) { dep += 1; mood = 'caring'; intensity = Math.min(100, intensity + 5); }
        // 用户冷淡/吵架 → 好感↓
        if (/(讨厌你|烦|滚|别理我|分手)/.test(userText)) { aff -= 5; mood = 'sad'; intensity = Math.min(100, intensity + 10); }
        // 单纯对话频次 → 依赖缓慢↑
        dep += 0.2;

        aff = Math.max(0, Math.min(100, aff));
        dep = Math.max(0, Math.min(100, dep));

        // 关系阶段：根据 affection + dependency 综合判定
        let stage = '陌生';
        if (aff >= 30) stage = '朋友';
        if (aff >= 55) stage = '亲近';
        if (aff >= 75 && dep >= 30) stage = '依恋';
        if (aff >= 90 && dep >= 60) stage = '深爱';

        await upsertRelationship(charName, {
            affection: aff, dependency: Math.round(dep), stage, mood, mood_intensity: Math.round(intensity),
            last_interaction_at: new Date().toISOString()
        });
    };

    // ── 为 AI 拼装上下文：长期记忆 + 关系状态 ──
    const buildAIContext = async (charName) => {
        await whenReady();
        if (!charName || !currentUserId) return '';
        try {
            const [mems, rel] = await Promise.all([
                loadMemories(charName, 20),
                getRelationship(charName)
            ]);
            let ctx = '';
            if (rel) {
                ctx += `\n【你与用户的关系状态（持久化记忆，必须延续）】`
                     + `\n- 好感度：${rel.affection}/100`
                     + `\n- 依赖值：${rel.dependency}/100`
                     + `\n- 关系阶段：${rel.stage}`
                     + `\n- 你当前情绪：${rel.mood}（强度 ${rel.mood_intensity}/100）`;
                if (rel.last_interaction_at) {
                    const last = new Date(rel.last_interaction_at);
                    const hours = (Date.now() - last.getTime()) / 3600000;
                    if (hours > 12) ctx += `\n- 距离上次和用户说话已过去 ${Math.round(hours)} 小时，请按真实情绪回应（想念/在意/淡然取决于你的人格）。`;
                }
            }
            if (mems.length) {
                ctx += `\n\n【你对用户的长期记忆（按重要度排序，必须延续这些信息，不能装作不知道）】`;
                mems.forEach((m, i) => {
                    ctx += `\n${i+1}. [${m.category}|重要度${m.importance}] ${m.content}`;
                });
            }
            return ctx;
        } catch(e) { console.warn('[CloudDB] buildAIContext 异常:', e.message); return ''; }
    };

    return {
        get userId(){ return currentUserId; },
        whenReady, initUser,
        saveChat, loadChats,
        saveMemory, loadMemories, extractMemoryHints,
        getRelationship, upsertRelationship, updateRelationshipFromTurn,
        buildAIContext,
        // 重置（重置全部数据时调用）
        resetUserId: () => { currentUserId = null; localStorage.removeItem(USER_KEY); }
    };
})();
window.CloudDB = CloudDB;

// 启动：initUser 由上方的 waitSupabase 回调在 CDN 就绪（或超时）后调用，
// 避免 defer 脚本未加载时就判定离线


const BeautifyIconPage = (() => {

    // 生成图标页内部 HTML（替换原 #b-page-icons 内容）
    const renderHTML = () => {
        const ids = IconSystem.allAppIds();
        // 预览网格：所有内置图标均可预览
        const grid = ids.map(id => {
            const r = IconSystem.RADIUS_MAP[IconSystem.cfg.radiusLevel];
            return `
            <div class="bi-cell" data-app="${id}">
                <div class="bi-icon" id="bi-prev-${id}" style="border-radius:${r*0.62}px;">
                    ${IconSystem.renderIconInner(id)}
                </div>
                <div class="bi-name" id="bi-name-${id}">${IconSystem.getName(id)}</div>
            </div>`;
        }).join('');

        return `
        <style>
            .bi-wrap { padding: 8px 4px 40px; }
            .bi-section-title { font-size:15px; font-weight:700; color:#1a1a1a;
                margin:20px 4px 12px; }
            /* 风格选项（支持 4 个紧凑卡片） */
            .bi-style-row { display:flex; gap:8px; }
            .bi-style-card {
                flex:1; background:#fff; border:2px solid #ECE8E2;
                border-radius:16px; padding:10px 4px 8px;
                display:flex; flex-direction:column; align-items:center; gap:6px;
                cursor:pointer; transition:border-color .2s; min-width:0;
            }
            .bi-style-card.sel { border-color:#3478F6; }
            .bi-style-preview { width:46px; height:46px; }
            .bi-style-label { font-size:11px; color:#3a3a3a; white-space:nowrap; }
            /* 图标配色 */
            .bi-color-row { display:flex; gap:14px; flex-wrap:wrap; padding:4px 2px; }
            .bi-color-dot { width:42px; height:42px; border-radius:50%;
                cursor:pointer; border:3px solid #fff; transition:transform .15s;
                box-shadow:0 2px 8px rgba(0,0,0,0.12); }
            .bi-color-dot:active { transform:scale(0.9); }
            .bi-color-dot.on { border-color:#3478F6; transform:scale(1.08); }
            /* 滑块卡片 */
            .bi-slider-card { background:#fff; border:1px solid #F0EDE8;
                border-radius:18px; padding:16px; margin-bottom:12px; }
            .bi-slider-head { display:flex; justify-content:space-between;
                font-size:14px; font-weight:600; color:#2a2a2a; margin-bottom:10px; }
            .bi-slider-head .v { color:#3478F6; font-weight:700; }
            .bi-range { width:100%; accent-color:#3478F6; height:4px; }
            /* 档位圆点滑条（圆角/名称用） */
            .bi-dots { display:flex; justify-content:space-between; align-items:center;
                background:#EEEDEA; border-radius:20px; padding:8px 14px; }
            .bi-dot { width:8px; height:8px; border-radius:50%;
                background:#C8C5BF; cursor:pointer; transition:all .2s; }
            .bi-dot.on { background:#3478F6; width:18px; height:18px;
                box-shadow:0 2px 6px rgba(52,120,246,.4); }
            /* 全图标预览网格 */
            .bi-preview-grid { display:grid; grid-template-columns:repeat(4,1fr);
                gap:16px 8px; padding:8px 4px; }
            .bi-cell { display:flex; flex-direction:column; align-items:center;
                gap:6px; cursor:pointer; }
            .bi-cell:active { transform:scale(.92); }
            .bi-icon { width:58px; height:58px; overflow:hidden; }
            .bi-name { font-size:11px; color:#5a5a5a; white-space:nowrap;
                max-width:64px; overflow:hidden; text-overflow:ellipsis; }
            /* 胶囊入口 */
            .bi-capsule { background:#fff; border:1px solid #F0EDE8;
                border-radius:18px; margin-top:8px; padding:15px 16px;
                display:flex; justify-content:space-between; align-items:center;
                cursor:pointer; }
            .bi-capsule:active { background:#F2F2F7; }
            .bi-capsule-left { display:flex; align-items:center; gap:10px;
                font-size:15px; font-weight:600; color:#1a1a1a; }
            .bi-capsule-arrow { font-size:22px; color:#C7C7CC; font-weight:600; }
            /* 全图标子页面 */
            /* 内置图标库子页：覆盖整个 APP 窗口，隐藏时不占空间 */
            .bi-iconsub { position:absolute; inset:0;
                background:#F2F2F7;
                z-index:9000;
                overflow-y:auto; overflow-x:hidden;
                padding-bottom:120px;
                visibility:hidden; pointer-events:none;
                opacity:0;
                transition:opacity .25s ease;
            }
            .bi-iconsub.show {
                visibility:visible; pointer-events:auto;
                opacity:1;
            }
            .bi-iconsub-bar { height:54px; display:flex; align-items:center;
                padding:0 8px; position:sticky; top:0;
                background:rgba(242,242,247,0.92); backdrop-filter:blur(12px); z-index:5; }
            .bi-iconsub-back { color:#3478F6; font-size:17px; display:flex;
                align-items:center; cursor:pointer; }
            .bi-iconsub-title { flex:1; text-align:center; font-size:17px;
                font-weight:600; margin-right:60px; }
            .bi-iconsub-tip { font-size:13px; color:#8E8E93; text-align:center;
                padding:4px 0 12px; }
        </style>

        <div class="bi-wrap">
            <!-- 图标风格 -->
            <div class="bi-section-title">图标风格</div>
            <div class="bi-style-row" id="bi-style-row">
                ${(() => {
                    const cur = IconSystem.cfg.colorId || 'mint';
                    const preset = IconSystem.COLOR_PRESETS.find(p => p.id === cur) || IconSystem.COLOR_PRESETS[0];
                    const c1 = preset.tint[0], c2 = preset.tint[1];
                    const curStyle = IconSystem.cfg.iconStyle || 'jelly';
                    return `
                    <div class="bi-style-card ${curStyle==='jelly'?'sel':''}" data-style="jelly">
                        <div class="bi-style-preview">
                            <div style="width:100%;height:100%;border-radius:14px;
                                background:linear-gradient(150deg, ${c1} 0%, ${c2} 100%);
                                box-shadow:inset 0 2px 5px rgba(255,255,255,.7),0 4px 9px rgba(0,0,0,.12);"></div>
                        </div>
                        <div class="bi-style-label">液态果冻</div>
                    </div>
                    <div class="bi-style-card ${curStyle==='frost'?'sel':''}" data-style="frost">
                        <div class="bi-style-preview">
                            <div style="width:100%;height:100%;border-radius:14px;
                                background:linear-gradient(150deg, ${c1}cc, ${c2}cc);
                                backdrop-filter:blur(4px);
                                border:1.5px solid rgba(255,255,255,.6);"></div>
                        </div>
                        <div class="bi-style-label">磨砂玻璃</div>
                    </div>
                    <div class="bi-style-card ${curStyle==='classic'?'sel':''}" data-style="classic">
                        <div class="bi-style-preview">
                            <div style="width:100%;height:100%;border-radius:12px;
                                background:${c2};"></div>
                        </div>
                        <div class="bi-style-label">经典纯色</div>
                    </div>
                    <div class="bi-style-card ${curStyle==='line'?'sel':''}" data-style="line">
                        <div class="bi-style-preview">
                            <div style="width:100%;height:100%;border-radius:13px;
                                background:#F2F2F7;display:flex;align-items:center;justify-content:center;
                                box-shadow:0 1px 3px rgba(0,0,0,.10);">
                                <svg width="58%" height="58%" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M19.1 13l2.2-1.7-2-3.4-2.5.85a7 7 0 0 0-1.7-1L14.5 4h-3l-.6 2.7a7 7 0 0 0-1.7 1l-2.5-.85-2 3.4L6.9 12a7 7 0 0 0 0 2l-2.2 1.7 2 3.4 2.5-.85a7 7 0 0 0 1.7 1l.6 2.7h3l.6-2.7a7 7 0 0 0 1.7-1l2.5.85 2-3.4L19.1 13z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="bi-style-label">极简线条</div>
                    </div>
                    <div class="bi-style-card ${curStyle==='ios'?'sel':''}" data-style="ios">
                        <div class="bi-style-preview">
                            <div style="width:100%;height:100%;border-radius:13px;
                                background:#34C759;display:flex;align-items:center;justify-content:center;
                                box-shadow:0 1px 3px rgba(0,0,0,.18);">
                                <svg width="58%" height="58%" viewBox="0 0 24 24" fill="#fff">
                                    <path d="M9 4C5.1 4 2 6.7 2 10c0 1.9 1 3.6 2.6 4.7L4 17.5l3-1.5c.6.2 1.3.3 2 .3 3.9 0 7-2.7 7-6S12.9 4 9 4z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="bi-style-label">iOS 原生</div>
                    </div>`;
                })()}
            </div>

            <!-- 图标配色 -->
            <div class="bi-section-title">图标配色</div>
            <div class="bi-color-row" id="bi-color-row">
                ${IconSystem.COLOR_PRESETS.map((c,i)=>
                    `<div class="bi-color-dot ${c.id===IconSystem.cfg.colorId?'on':''}" data-color="${c.id}"
                        style="background:linear-gradient(155deg,${c.tint[0]},${c.tint[1]});"></div>`).join('')}
            </div>

            <!-- 圆角大小（档位滑条）-->
            <div class="bi-section-title">圆角大小</div>
            <div class="bi-dots" id="bi-radius-dots">
                ${IconSystem.RADIUS_MAP.map((_,i)=>
                    `<div class="bi-dot ${i===IconSystem.cfg.radiusLevel?'on':''}" data-i="${i}"></div>`).join('')}
            </div>

            <!-- 内容大小 -->
            <div class="bi-section-title">内容大小</div>
            <div class="bi-slider-card">
                <div class="bi-slider-head"><span>图标内图形缩放</span>
                    <span class="v" id="bi-content-v">${IconSystem.cfg.contentSize}%</span></div>
                <input type="range" class="bi-range" id="bi-content-range"
                    min="30" max="100" value="${IconSystem.cfg.contentSize}">
            </div>

            <!-- 图标大小 -->
            <div class="bi-section-title">图标大小</div>
            <div class="bi-slider-card">
                <div class="bi-slider-head"><span>桌面图标尺寸</span>
                    <span class="v" id="bi-size-v">${IconSystem.cfg.iconSize}px</span></div>
                <input type="range" class="bi-range" id="bi-size-range"
                    min="52" max="92" value="${IconSystem.cfg.iconSize}">
            </div>

            <!-- 名称大小（档位滑条）-->
            <div class="bi-section-title">名称大小</div>
            <div class="bi-dots" id="bi-name-dots">
                ${IconSystem.NAME_MAP.map((_,i)=>
                    `<div class="bi-dot ${i===IconSystem.cfg.nameLevel?'on':''}" data-i="${i}"></div>`).join('')}
            </div>

            <!-- 全图标预览：胶囊入口 -->
            <div class="bi-capsule" id="bi-icons-capsule">
                <div class="bi-capsule-left">
                    <svg viewBox="0 0 24 24" width="20" fill="none" stroke="#3478F6" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
                    <span>全部内置图标</span>
                </div>
                <span class="bi-capsule-arrow">›</span>
            </div>
            <!-- 一键更换全部图标 -->
            <div class="bi-capsule" id="bi-icons-replace-all">
                <div class="bi-capsule-left">
                    <svg viewBox="0 0 24 24" width="20" fill="none" stroke="#3478F6" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3v6h-6M3 21v-6h6"/></svg>
                    <span>一键更换全部图标</span>
                </div>
                <span class="bi-capsule-arrow">›</span>
            </div>
            <div style="font-size:12px;color:#999;padding:8px 6px;">点击单个图标可单独更换；支持本地上传、图片链接、纯色。</div>
        </div>

        <!-- 全图标子页面（默认隐藏，点胶囊才出现） -->
        <div class="bi-iconsub" id="bi-iconsub">
            <div class="bi-iconsub-bar">
                <div class="bi-iconsub-back" id="bi-iconsub-back">
                    <svg viewBox="0 0 24 24" width="22" fill="none" stroke="#3478F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    返回
                </div>
                <div class="bi-iconsub-title">全部内置图标</div>
            </div>
            <div class="bi-iconsub-tip">点击任意图标即可预览或更换</div>
            <div class="bi-preview-grid" id="bi-preview-grid">${grid}</div>
        </div>`;
    };

    // 刷新预览网格内的所有图标
    const refreshPreview = (winDom) => {
        IconSystem.allAppIds().forEach(id => {
            const box = winDom.querySelector('#bi-prev-' + id);
            const nm  = winDom.querySelector('#bi-name-' + id);
            const r = IconSystem.RADIUS_MAP[IconSystem.cfg.radiusLevel];
            if (box) {
                box.innerHTML = IconSystem.renderIconInner(id);
                box.style.borderRadius = (r*0.62) + 'px';
            }
            if (nm) {
                nm.textContent = IconSystem.getName(id);
                nm.style.fontSize = IconSystem.NAME_MAP[IconSystem.cfg.nameLevel] + 'px';
            }
        });
    };

    // 整页重渲染（用于配色或风格切换时，让上方"风格卡片预览"也跟着变色）
    const rerenderAll = (winDom) => {
        const host = winDom.querySelector('#b-icons-dynamic-host');
        if (host) {
            host.innerHTML = renderHTML();
            bind(winDom);
        }
    };

    // 绑定图标页所有交互
    const bind = (winDom) => {
        // 风格切换：液态果冻 / 磨砂玻璃 / 经典纯色 / iOS 原生
        winDom.querySelectorAll('.bi-style-card').forEach(card => {
            card.onclick = () => {
                const style = card.getAttribute('data-style');
                winDom.querySelectorAll('.bi-style-card').forEach(c=>c.classList.remove('sel'));
                card.classList.add('sel');
                IconSystem.setCfg('iconStyle', style);
                refreshPreview(winDom);
            };
        });
        // 图标配色
        winDom.querySelectorAll('#bi-color-row .bi-color-dot').forEach(dot => {
            dot.onclick = () => {
                winDom.querySelectorAll('#bi-color-row .bi-color-dot').forEach(d=>d.classList.remove('on'));
                dot.classList.add('on');
                IconSystem.setCfg('colorId', dot.getAttribute('data-color'));
                // 配色变化时也要让上方风格卡片预览跟着变 → 整页重渲染
                rerenderAll(winDom);
            };
        });
        // 圆角档位
        winDom.querySelectorAll('#bi-radius-dots .bi-dot').forEach(dot => {
            dot.onclick = () => {
                const i = Number(dot.getAttribute('data-i'));
                winDom.querySelectorAll('#bi-radius-dots .bi-dot').forEach(d=>d.classList.remove('on'));
                dot.classList.add('on');
                IconSystem.setCfg('radiusLevel', i);
                refreshPreview(winDom);
            };
        });
        // 名称档位
        winDom.querySelectorAll('#bi-name-dots .bi-dot').forEach(dot => {
            dot.onclick = () => {
                const i = Number(dot.getAttribute('data-i'));
                winDom.querySelectorAll('#bi-name-dots .bi-dot').forEach(d=>d.classList.remove('on'));
                dot.classList.add('on');
                IconSystem.setCfg('nameLevel', i);
                refreshPreview(winDom);
            };
        });
        // 内容大小
        const cr = winDom.querySelector('#bi-content-range');
        if (cr) cr.oninput = () => {
            winDom.querySelector('#bi-content-v').textContent = cr.value + '%';
            IconSystem.setCfg('contentSize', cr.value);
            refreshPreview(winDom);
        };
        // 图标大小
        const sr = winDom.querySelector('#bi-size-range');
        if (sr) sr.oninput = () => {
            winDom.querySelector('#bi-size-v').textContent = sr.value + 'px';
            IconSystem.setCfg('iconSize', sr.value);
            refreshPreview(winDom);
        };
        // 点击预览图标 = 给该 app 换图标（走裁剪流程）
        winDom.querySelectorAll('.bi-cell').forEach(cell => {
            cell.onclick = () => {
                const appId = cell.getAttribute('data-app');
                if (window.IconInteract) IconInteract.openCropForApp(appId);
            };
        });
        // 胶囊 → 展开全图标子页面
        const capsule = winDom.querySelector('#bi-icons-capsule');
        const iconsub = winDom.querySelector('#bi-iconsub');
        const subback = winDom.querySelector('#bi-iconsub-back');
        if (capsule && iconsub) {
            capsule.onclick = () => {
                refreshPreview(winDom);
                iconsub.classList.add('show');
            };
        }
        if (subback && iconsub) {
            subback.onclick = () => iconsub.classList.remove('show');
        }
        // 一键更换全部图标
        const replaceAll = winDom.querySelector('#bi-icons-replace-all');
        if (replaceAll) {
            replaceAll.onclick = () => {
                if (window.IconInteract && IconInteract.openAllIconsMenu) {
                    IconInteract.openAllIconsMenu();
                }
            };
        }
    };

    return { renderHTML, bind, refreshPreview };
})();
window.BeautifyIconPage = BeautifyIconPage;


