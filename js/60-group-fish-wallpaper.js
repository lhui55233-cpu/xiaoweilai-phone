/* [GROUP-FISH] 游鱼动态壁纸 — 2026-11-26
 * 直接复用 + 改编（非重写）：
 *   - jiezi1234/character-ocean（MIT，前端 + 引擎）：src/math.ts、species.ts、world.ts、
 *     renderer.ts、engine.ts 由 TypeScript 转译为本文件内的 JS（tsc 5.9 机械转译，
 *     仅去掉 import/export 与类型标注），另有 app.ts 的默认鱼群、七种风格文案。
 *   - stackedlol/ascii-sharks（MIT，动画原型；2026-11-26 在 GitHub 核实有 LICENSE 文件，
 *     character-ocean 的 LICENSE.md 称其“无许可证”的说法已过时）。
 * 按手机改编之处（见代码内 [GROUP-FISH] 标注）：
 *   1. 调色板：原站用 CSS filter:invert 实现浅色主题，本机改为按用户底色在代码里
 *      算调色板（浅底深鱼、深底浅鱼，按真实对比度选边），任意底色都看得清。
 *   2. 无指针输入：壁纸 Canvas 为 pointer-events:none，删掉了引擎的指针涟漪。
 *   3. 字体：ASCII 模式固定等宽栈（不用手机 UI 字体）；汉字模式补了中文字体回退。
 *   4. 省电门：只在桌面/锁屏可见、前台、无 app 打开、未开“减少动态效果”时跑；
 *      减动效时引擎留一帧静态画面；DPR 上限 2（引擎原有）。
 *   5. 集成：FishWallpaper（window.FishWallpaper）接壁纸设置（风格/底色/跟随主题）、
 *      SystemStore 壁纸（用户图片优先）、EventBus（app 开关）、锁屏/桌面可见性。
 * 引擎代码包在 IIFE 里，不污染全局（js/00 已有 clamp/rand/TAU/SPECIES 同名定义）。
 */
(function () {
'use strict';

/* ===== math.ts — ported from jiezi1234/character-ocean (MIT) ===== */
/** Adapted from stackedlol/ascii-sharks. See LICENSE.md and THIRD_PARTY_NOTICES.md. */
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
}
/** Shortest signed angle from a to b, in (-PI, PI]. */
function angleDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI)
        d -= TAU;
    if (d < -Math.PI)
        d += TAU;
    return d;
}
/** Cheap integer hash → [0, 1). Deterministic, so textures stay stable. */
function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^
        Math.imul(y | 0, 668265263) ^
        Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
const K1 = 1 / 260;
const K2 = 1 / 310;
const K3 = 1 / 190;
const CURRENT_SCALE = 3400;
/**
 * Divergence-free ocean current: the curl of a slowly drifting stream
 * function ψ(x, y, t). Because it has no sources or sinks, it moves the
 * schools around without bunching them up in one corner.
 */
function current(x, y, t, out) {
    const a = x * K1 + t * 0.07;
    const b = y * K2 - t * 0.05;
    const c = (x + y) * K3 + t * 0.11;
    // u = ∂ψ/∂y, v = -∂ψ/∂x with ψ = sin(a)cos(b) + 0.5 sin(c)
    out.x = (-K2 * Math.sin(a) * Math.sin(b) + 0.5 * K3 * Math.cos(c)) * CURRENT_SCALE;
    out.y = (-K1 * Math.cos(a) * Math.cos(b) - 0.5 * K3 * Math.cos(c)) * CURRENT_SCALE;
    return out;
}


/* ===== species.ts — ported from jiezi1234/character-ocean (MIT) ===== */
const SPECIES = [
    {
        name: "sardine",
        cruise: 36, maxSpeed: 64, minSpeed: 18, weight: 3,
        schoolSize: [18, 28], spacing: [1.8, 1.1],
        align: 1.6, cohesion: 1.6, jitter: 40, mill: 70, verticalDrag: 0.5,
    },
    {
        name: "anchovy",
        cruise: 46, maxSpeed: 78, minSpeed: 22, weight: 3,
        schoolSize: [20, 32], spacing: [1.5, 1],
        align: 3.2, cohesion: 0.45, jitter: 30, mill: 0, verticalDrag: 1.4,
    },
    {
        name: "silverside",
        cruise: 40, maxSpeed: 70, minSpeed: 20, weight: 3,
        schoolSize: [12, 20], spacing: [2, 1.1],
        align: 2.4, cohesion: 1.1, jitter: 35, mill: 0, verticalDrag: 1.6,
    },
    {
        name: "mackerel",
        cruise: 32, maxSpeed: 60, minSpeed: 16, weight: 2,
        schoolSize: [5, 9], spacing: [2.6, 1.3],
        align: 2, cohesion: 0.9, jitter: 25, mill: 0, verticalDrag: 2,
    },
    {
        name: "goby",
        cruise: 26, maxSpeed: 56, minSpeed: 10, weight: 1,
        schoolSize: [8, 12], spacing: [1.4, 1.1],
        align: 0.35, cohesion: 1.4, jitter: 110, mill: 0, verticalDrag: 0.3,
    },
];
const TOTAL_WEIGHT = SPECIES.reduce((sum, s) => sum + s.weight, 0);
function pickSpecies() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (let i = 0; i < SPECIES.length; i++) {
        r -= SPECIES[i].weight;
        if (r <= 0)
            return i;
    }
    return 0;
}


/* ===== world.ts — ported from jiezi1234/character-ocean (MIT) ===== */
/** Adapted from stackedlol/ascii-sharks. See LICENSE.md and THIRD_PARTY_NOTICES.md. */
/**
 * Artificial-life sim for the hero: tiny fish schools and the sharks that hunt them.
 *
 * Fish: Reynolds boids (separation / alignment / cohesion) in Couzin-style
 * zones, with a blind spot behind each fish. Alarm spreads from fish to fish
 * through the school (a "wave of agitation"), so a whole school bolts even
 * when only its edge can see the shark. Fleeing fish break sideways around the
 * shark's path, which gives the fountain effect seen in real bait balls.
 *
 * Sharks: Reynolds steering (wander + pursuit + separation) on a
 * follow-the-leader spine. Hunger builds over time and drops when they eat.
 * They prefer fish in sparse spots, since dense schools confuse predators,
 * so stragglers get picked off. Eaten fish come back later as new schools
 * swimming in from the edges, which keeps the population steady.
 */
const SHARK_NODES = 20;
// The landing hero: four of the same shark at different depths.
const DEFAULT_SHARKS = [
    { kind: "classic", size: 1 },
    { kind: "classic", size: 0.7 },
    { kind: "classic", size: 0.84 },
    { kind: "classic", size: 0.77 },
];
const FISH_SEPARATION_K = 420;
const FISH_ALIGN_K = 1.4;
const FISH_COHESION_K = 1;
const FISH_FLEE_K = 1100;
const BLIND_COS = -0.6; // ~127° either side of the heading is visible
class World {
    /** fishCount overrides the area-based population (the sidebar wants a single small school). */
    constructor(sharkSpecs = DEFAULT_SHARKS, fishCount) {
        this.sharkSpecs = sharkSpecs;
        this.fishCount = fishCount;
        this.width = 0;
        this.height = 0;
        this.time = 0;
        this.fish = [];
        this.sharks = [];
        this.events = [];
        this.pointer = { x: 0, y: 0, active: false };
        /** Fish neighbourhood radius; the spatial hash bucket size matches it. */
        this.perception = 60;
        /** Per-species personal space in px (x, y). */
        this.sepX = [];
        this.sepY = [];
        this.foreignSep = 40;
        this.bucketCols = 0;
        this.bucketRows = 0;
        this.bucketHead = new Int32Array(0);
        this.bucketCount = new Uint16Array(0);
        this.bucketNext = new Int32Array(0);
        this.lastSpawn = 0;
        this.tmp = { x: 0, y: 0 };
    }
    resize(width, height, cellW, cellH) {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        // Spacing is set in grid cells so every fish lands in its own cell.
        this.sepX = SPECIES.map((sp) => sp.spacing[0] * cellW);
        this.sepY = SPECIES.map((sp) => sp.spacing[1] * cellH);
        this.perception = Math.max(cellH * 3, cellW * 5.5);
        this.foreignSep = cellW * 3;
        if (first || this.fish.length === 0) {
            this.seed();
            return;
        }
        for (const f of this.fish) {
            f.x = clamp(f.x, 0, width);
            f.y = clamp(f.y, 0, height);
        }
    }
    seed() {
        const { width: W, height: H } = this;
        const minSide = Math.min(W, H);
        // Phone-sized sharks. The original's baseLength formula
        // (clamp(minSide * 0.44, 170, 430) * 1.2) gives ~206px on a 390px
        // phone; the earlier halving to * 0.26 (~101px, ~26% of screen width)
        // is still too big, so shrink again to ~66px (~17% of the width).
        // The body is still ~2 cells thick at that size, so the silhouette
        // (snout taper, fins, tail) stays readable.
        const baseLength = clamp(minSide * 0.17, 55, 100);
        const sharkCount = this.sharkSpecs.length;
        this.sharks = [];
        for (let i = 0; i < sharkCount; i++) {
            const { kind, size } = this.sharkSpecs[i];
            const length = baseLength * size;
            const orbitRadius = minSide * rand(0.28, 0.4);
            const a = (i / sharkCount) * TAU + rand(-0.4, 0.4);
            const orbitDir = i % 2 === 0 ? 1 : -1;
            const x = W / 2 + Math.cos(a) * orbitRadius * (W / minSide) * 0.9;
            const y = H / 2 + Math.sin(a) * orbitRadius;
            const heading = a + (orbitDir * Math.PI) / 2;
            const nodes = new Float32Array(SHARK_NODES * 2);
            const seg = length / (SHARK_NODES - 1);
            for (let n = 0; n < SHARK_NODES; n++) {
                nodes[n * 2] = x - Math.cos(heading) * seg * n;
                nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
            }
            this.sharks.push({
                id: i + 1,
                kind,
                length,
                nodes,
                heading,
                speed: 30,
                phase: rand(0, TAU),
                turn: 0,
                hunger: rand(0.25, 0.75),
                wander: 0,
                orbitDir,
                orbitRadius,
                target: null,
                retargetAt: 0,
                depth: size,
            });
        }
        // Smaller (farther) sharks draw first so the big one swims over them.
        this.sharks.sort((a, b) => a.length - b.length);
        const total = this.fishCount ?? clamp(Math.round((W * H) / 4400), 85, 340);
        this.fish = [];
        while (this.fish.length < total) {
            const species = pickSpecies();
            const sp = SPECIES[species];
            const size = Math.min(randInt(sp.schoolSize[0], sp.schoolSize[1]), total - this.fish.length);
            const millDir = Math.random() < 0.5 ? 1 : -1;
            const cx = rand(W * 0.06, W * 0.94);
            const cy = rand(H * 0.08, H * 0.92);
            // Mostly level headings: fish cruise sideways far more than up or down.
            const dir = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.5, 0.5);
            for (let k = 0; k < size; k++) {
                this.fish.push({
                    x: cx + rand(-1, 1) * this.sepX[species] * Math.sqrt(size),
                    y: cy + rand(-1, 1) * this.sepY[species] * Math.sqrt(size) * 0.6,
                    vx: Math.cos(dir) * sp.cruise,
                    vy: Math.sin(dir) * sp.cruise,
                    species,
                    alarm: 0,
                    alive: true,
                    respawnAt: 0,
                    phase: rand(0, TAU),
                    turn: 0,
                    depth: rand(0.55, 1),
                    millDir,
                });
            }
        }
        this.bucketNext = new Int32Array(this.fish.length);
    }
    splash(x, y) {
        this.events.push({ kind: "splash", x, y });
        const r = 240;
        for (const f of this.fish) {
            if (!f.alive)
                continue;
            const dx = f.x - x;
            const dy = f.y - y;
            const d = Math.hypot(dx, dy);
            if (d > r || d < 1e-3)
                continue;
            // Flash expansion: everybody nearby bolts straight out.
            const k = (1 - d / r) * 260;
            f.vx += (dx / d) * k;
            f.vy += (dy / d) * k;
            f.alarm = 1;
        }
    }
    step(dt) {
        this.time += dt;
        this.rebuildHash();
        this.stepFish(dt);
        this.stepSharks(dt);
        this.respawn();
    }
    rebuildHash() {
        const size = this.perception;
        const pad = 2;
        this.bucketCols = Math.ceil(this.width / size) + pad * 2;
        this.bucketRows = Math.ceil(this.height / size) + pad * 2;
        const n = this.bucketCols * this.bucketRows;
        if (this.bucketHead.length !== n) {
            this.bucketHead = new Int32Array(n);
            this.bucketCount = new Uint16Array(n);
        }
        this.bucketHead.fill(-1);
        this.bucketCount.fill(0);
        if (this.bucketNext.length !== this.fish.length) {
            this.bucketNext = new Int32Array(this.fish.length);
        }
        for (let i = 0; i < this.fish.length; i++) {
            const f = this.fish[i];
            if (!f.alive)
                continue;
            const b = this.bucketOf(f.x, f.y);
            this.bucketNext[i] = this.bucketHead[b];
            this.bucketHead[b] = i;
            this.bucketCount[b]++;
        }
    }
    bucketOf(x, y) {
        const size = this.perception;
        const c = clamp(Math.floor(x / size) + 2, 0, this.bucketCols - 1);
        const r = clamp(Math.floor(y / size) + 2, 0, this.bucketRows - 1);
        return r * this.bucketCols + c;
    }
    stepFish(dt) {
        const { fish, sharks, pointer, width: W, height: H, time } = this;
        const R = this.perception;
        const R2 = R * R;
        const foreignSep = this.foreignSep;
        const size = this.perception;
        const cols = this.bucketCols;
        const rows = this.bucketRows;
        const head = this.bucketHead;
        const next = this.bucketNext;
        const cur = this.tmp;
        const calmDecay = Math.exp(-dt * 0.7);
        const contagion = Math.min(1, dt * 6);
        for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            if (!f.alive)
                continue;
            const sp = SPECIES[f.species];
            // Alarmed fish want more room: the school flashes apart around a
            // shark and closes back up once the threat fades.
            const spread = 1 + 1.8 * f.alarm;
            const sepX = this.sepX[f.species] * spread;
            const sepY = this.sepY[f.species] * spread;
            const speed = Math.hypot(f.vx, f.vy) || 1;
            const hx = f.vx / speed;
            const hy = f.vy / speed;
            let ax = 0;
            let ay = 0;
            let sx = 0;
            let sy = 0;
            let avx = 0;
            let avy = 0;
            let cx = 0;
            let cy = 0;
            let n = 0;
            let neighbourAlarm = 0;
            const bc = clamp(Math.floor(f.x / size) + 2, 0, cols - 1);
            const br = clamp(Math.floor(f.y / size) + 2, 0, rows - 1);
            for (let r = Math.max(0, br - 1); r <= Math.min(rows - 1, br + 1); r++) {
                for (let c = Math.max(0, bc - 1); c <= Math.min(cols - 1, bc + 1); c++) {
                    let j = head[r * cols + c];
                    while (j !== -1) {
                        if (j !== i) {
                            const o = fish[j];
                            const dx = o.x - f.x;
                            const dy = o.y - f.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < R2 && d2 > 1e-6) {
                                const d = Math.sqrt(d2);
                                // Blind zone directly behind the fish.
                                if ((dx * hx + dy * hy) / d > BLIND_COS) {
                                    // Elliptical personal space: wide along x, tight along y.
                                    const qx = dx / sepX;
                                    const qy = dy / sepY;
                                    const q2 = qx * qx + qy * qy;
                                    if (q2 < 1) {
                                        const q = Math.sqrt(q2) || 1e-3;
                                        const k = (1 - q) / q;
                                        sx -= qx * k;
                                        sy -= qy * k;
                                    }
                                    if (o.species === f.species) {
                                        avx += o.vx;
                                        avy += o.vy;
                                        cx += dx;
                                        cy += dy;
                                        n++;
                                    }
                                    else if (d < foreignSep) {
                                        // Different species keep their own schools.
                                        const k = ((1 - d / foreignSep) / d) * 0.6;
                                        sx -= dx * k;
                                        sy -= dy * k;
                                    }
                                    if (o.alarm > neighbourAlarm)
                                        neighbourAlarm = o.alarm;
                                }
                            }
                        }
                        j = next[j];
                    }
                }
            }
            ax += sx * FISH_SEPARATION_K;
            ay += sy * FISH_SEPARATION_K;
            if (n > 0) {
                const alignK = FISH_ALIGN_K * sp.align;
                const cohesionK = FISH_COHESION_K * sp.cohesion * (1 - 0.8 * f.alarm);
                ax += (avx / n - f.vx) * alignK + (cx / n) * cohesionK;
                ay += (avy / n - f.vy) * alignK + (cy / n) * cohesionK;
                if (sp.mill > 0) {
                    // Circle the local centre: the school spins into a bait ball.
                    const cl = Math.hypot(cx, cy) || 1;
                    ax += (-cy / cl) * f.millDir * sp.mill * (1 - f.alarm);
                    ay += (cx / cl) * f.millDir * sp.mill * (1 - f.alarm);
                }
            }
            // Predators. Distance is measured to the nearest point along the front
            // half of the shark, so fish also give the flanks a wide berth.
            let fear = 0;
            for (const sh of sharks) {
                const fearR = sh.length * 0.6 + 60;
                let best = Infinity;
                let bx = 0;
                let by = 0;
                for (let k = 0; k <= 12; k += 3) {
                    const nx = sh.nodes[k * 2];
                    const ny = sh.nodes[k * 2 + 1];
                    const d2 = (f.x - nx) ** 2 + (f.y - ny) ** 2;
                    if (d2 < best) {
                        best = d2;
                        bx = nx;
                        by = ny;
                    }
                }
                const d = Math.sqrt(best);
                if (d >= fearR || d < 1e-3)
                    continue;
                let w = 1 - d / fearR;
                w *= w;
                const awayX = (f.x - bx) / d;
                const awayY = (f.y - by) / d;
                // Fountain effect: break to whichever side of the shark's path you're on.
                const shx = Math.cos(sh.heading);
                const shy = Math.sin(sh.heading);
                const side = shx * (f.y - sh.nodes[1]) - shy * (f.x - sh.nodes[0]) >= 0 ? 1 : -1;
                ax += (awayX * 0.7 - shy * side * 0.9) * FISH_FLEE_K * w;
                ay += (awayY * 0.7 + shx * side * 0.9) * FISH_FLEE_K * w;
                fear = Math.max(fear, Math.sqrt(w));
            }
            if (pointer.active) {
                const pr = 130;
                const dx = f.x - pointer.x;
                const dy = f.y - pointer.y;
                const d = Math.hypot(dx, dy);
                if (d < pr && d > 1e-3) {
                    const w = (1 - d / pr) ** 2;
                    ax += (dx / d) * FISH_FLEE_K * w;
                    ay += (dy / d) * FISH_FLEE_K * w;
                    fear = Math.max(fear, Math.sqrt(w) * 0.8);
                }
            }
            // Alarm: direct threat sets it, neighbours pass it along (slightly
            // weaker each hop), and it fades on its own.
            let alarm = Math.max(f.alarm * calmDecay, fear);
            const relayed = neighbourAlarm * 0.86;
            if (relayed > alarm)
                alarm += (relayed - alarm) * contagion;
            f.alarm = alarm;
            // Soft walls.
            const m = 36;
            if (f.x < m)
                ax += (m - f.x) * 7;
            else if (f.x > W - m)
                ax -= (f.x - (W - m)) * 7;
            if (f.y < m)
                ay += (m - f.y) * 7;
            else if (f.y > H - m)
                ay -= (f.y - (H - m)) * 7;
            // Ambient current and a little individual restlessness.
            current(f.x, f.y, time, cur);
            ax += cur.x * 0.5 + (Math.random() - 0.5) * sp.jitter;
            ay += cur.y * 0.5 + (Math.random() - 0.5) * sp.jitter;
            // Swim level, except when bolting from danger.
            ay -= f.vy * sp.verticalDrag * (1 - 0.7 * f.alarm);
            // Relax toward a preferred speed that rises with panic.
            const preferred = sp.cruise * (1 + 1.3 * f.alarm);
            ax += (preferred - speed) * hx * 1.6;
            ay += (preferred - speed) * hy * 1.6;
            const before = Math.atan2(f.vy, f.vx);
            f.vx += ax * dt;
            f.vy += ay * dt;
            const maxSpeed = sp.maxSpeed * (1 + 1.8 * f.alarm);
            const s = Math.hypot(f.vx, f.vy);
            if (s > maxSpeed) {
                f.vx *= maxSpeed / s;
                f.vy *= maxSpeed / s;
            }
            else if (s < sp.minSpeed && s > 1e-3) {
                f.vx *= sp.minSpeed / s;
                f.vy *= sp.minSpeed / s;
            }
            f.turn += (angleDiff(before, Math.atan2(f.vy, f.vx)) / dt - f.turn) * Math.min(1, dt * 8);
            f.phase += dt * (7 + Math.hypot(f.vx, f.vy) * 0.12);
            f.x = clamp(f.x + f.vx * dt, -60, W + 60);
            f.y = clamp(f.y + f.vy * dt, -60, H + 60);
        }
    }
    stepSharks(dt) {
        const { sharks, width: W, height: H, time } = this;
        const minSide = Math.min(W, H);
        const cxW = W / 2;
        const cyW = H / 2;
        for (const sh of sharks) {
            const L = sh.length;
            const nodes = sh.nodes;
            const hx = nodes[0];
            const hy = nodes[1];
            const gentle = sh.kind === "manta" || sh.kind === "whaleshark" || sh.kind === "sunfish";
            sh.hunger = gentle ? 0 : Math.min(1, sh.hunger + dt * 0.03);
            // Momentum.
            let dx = Math.cos(sh.heading);
            let dy = Math.sin(sh.heading);
            // Wander: a slowly drifting offset on a circle ahead of the snout.
            sh.wander = clamp(sh.wander + (Math.random() - 0.5) * dt * 3.2, -1.1, 1.1);
            dx += Math.cos(sh.heading + sh.wander) * 0.45;
            dy += Math.sin(sh.heading + sh.wander) * 0.45;
            // Hunt.
            if (time >= sh.retargetAt) {
                sh.target = gentle ? null : this.findPrey(sh);
                sh.retargetAt = time + 0.45;
            }
            const t = sh.target;
            let hunting = false;
            let closing = 0;
            if (t && t.alive && sh.hunger > 0.3) {
                // Pursuit: aim at where the fish is about to be.
                const tx = t.x + t.vx * 0.35 - hx;
                const ty = t.y + t.vy * 0.35 - hy;
                const d = Math.hypot(tx, ty) || 1;
                const w = 1.4 + 2.6 * sh.hunger;
                dx += (tx / d) * w;
                dy += (ty / d) * w;
                hunting = true;
                closing = clamp(1 - d / (L * 0.9), 0, 1);
            }
            else {
                // Patrol: a lazy circuit around the headline.
                const rx = (hx - cxW) / (W / minSide);
                const ry = hy - cyW;
                const r = Math.hypot(rx, ry) || 1;
                const radius = sh.orbitRadius * (1 + 0.15 * Math.sin(time * 0.05 + sh.id));
                const radial = clamp((radius - r) / radius, -1, 1);
                dx += ((-ry / r) * sh.orbitDir + (rx / r) * radial * 0.9) * 0.55;
                dy += ((rx / r) * sh.orbitDir + (ry / r) * radial * 0.9) * 0.55;
            }
            // Give other sharks room.
            for (const other of sharks) {
                if (other === sh)
                    continue;
                for (let k = 0; k < SHARK_NODES; k += 4) {
                    const ox = hx - other.nodes[k * 2];
                    const oy = hy - other.nodes[k * 2 + 1];
                    const d = Math.hypot(ox, oy);
                    const range = (L + other.length) * 0.45;
                    if (d < range && d > 1e-3) {
                        const w = (1 - d / range) * 3;
                        dx += (ox / d) * w;
                        dy += (oy / d) * w;
                    }
                }
            }
            // Keep the headline mostly clear: a soft elliptical no-swim zone.
            const ex = (hx - cxW) / (W * 0.3);
            const ey = (hy - cyW) / (H * 0.16);
            const e2 = ex * ex + ey * ey;
            if (e2 < 1) {
                const e = Math.sqrt(e2) || 1e-3;
                const w = (1 - e) * (hunting ? 1 : 2.5);
                dx += (ex / e) * w;
                dy += (ey / e) * w;
            }
            // Turn back once the snout leaves the frame, so bodies dip off-screen
            // now and then but the sharks never wander away for good.
            const over = Math.max(-hx, hx - W, -hy, hy - H);
            if (over > -L * 0.05) {
                const w = clamp((over + L * 0.05) / (L * 0.35), 0, 1) * 3.5;
                const toX = cxW - hx;
                const toY = cyW - hy;
                const d = Math.hypot(toX, toY) || 1;
                dx += (toX / d) * w;
                dy += (toY / d) * w;
            }
            const desired = Math.atan2(dy, dx);
            // Sharks can't pivot on the spot: the turning circle grows with speed.
            const agility = Math.min(hunting ? 1.7 + closing : 0.8, sh.speed / (L * 0.22));
            const maxTurn = agility * dt;
            const turned = clamp(angleDiff(sh.heading, desired), -maxTurn, maxTurn);
            sh.heading += turned;
            sh.turn += (turned / dt - sh.turn) * Math.min(1, dt * 3);
            const pace = sh.kind === "sunfish" ? 0.63 : gentle ? 0.8 : 1;
            const cruise = (30 + L * 0.04) * pace;
            const targetSpeed = hunting ? cruise * (1.45 + closing * 1.5) : cruise;
            sh.speed += (targetSpeed - sh.speed) * Math.min(1, dt * 1.1);
            sh.phase += dt * (2 + sh.speed / 24);
            nodes[0] += Math.cos(sh.heading) * sh.speed * dt;
            nodes[1] += Math.sin(sh.heading) * sh.speed * dt;
            // Follow-the-leader spine, with a stiffness limit per joint so the
            // body bends into a C at most and never folds back on itself.
            const seg = L / (SHARK_NODES - 1);
            const maxBend = 0.16;
            let prevAngle = sh.heading + Math.PI;
            for (let k = 1; k < SHARK_NODES; k++) {
                const px = nodes[(k - 1) * 2];
                const py = nodes[(k - 1) * 2 + 1];
                let angle = Math.atan2(nodes[k * 2 + 1] - py, nodes[k * 2] - px);
                angle = prevAngle + clamp(angleDiff(prevAngle, angle), -maxBend, maxBend);
                nodes[k * 2] = px + Math.cos(angle) * seg;
                nodes[k * 2 + 1] = py + Math.sin(angle) * seg;
                prevAngle = angle;
            }
            // Feed.
            if (sh.hunger > 0.15) {
                const mouthR = L * 0.05 + 8;
                const mx = nodes[0];
                const my = nodes[1];
                for (const f of this.fish) {
                    if (!f.alive)
                        continue;
                    if ((f.x - mx) ** 2 + (f.y - my) ** 2 < mouthR * mouthR) {
                        f.alive = false;
                        f.respawnAt = time + rand(3, 8);
                        sh.hunger = Math.max(0, sh.hunger - 0.16);
                        this.events.push({ kind: "eat", x: f.x, y: f.y });
                    }
                }
            }
        }
    }
    /**
     * Pick prey in the shark's forward cone, preferring close fish in sparse
     * buckets (stragglers) over fish buried in a dense school.
     */
    findPrey(sh) {
        const range = sh.length * 0.9 + 160;
        const hx = sh.nodes[0];
        const hy = sh.nodes[1];
        const fx = Math.cos(sh.heading);
        const fy = Math.sin(sh.heading);
        let best = null;
        let bestScore = Infinity;
        let currentScore = Infinity;
        for (const f of this.fish) {
            if (!f.alive)
                continue;
            const dx = f.x - hx;
            const dy = f.y - hy;
            const d = Math.hypot(dx, dy);
            if (d > range || d < 1e-3)
                continue;
            const cos = (dx * fx + dy * fy) / d;
            if (cos < 0.2)
                continue;
            const crowd = this.bucketCount[this.bucketOf(f.x, f.y)];
            const score = d * (1 + (1 - cos) * 0.8) * (1 + crowd * 0.07);
            if (score < bestScore) {
                bestScore = score;
                best = f;
            }
            if (f === sh.target)
                currentScore = score;
        }
        // Stick with the current target unless something is clearly better.
        if (sh.target && currentScore < bestScore * 1.3)
            return sh.target;
        return best;
    }
    respawn() {
        const { time, width: W, height: H } = this;
        const due = [];
        for (const f of this.fish)
            if (!f.alive && f.respawnAt <= time)
                due.push(f);
        if (due.length === 0)
            return;
        if (due.length < 6 && time - this.lastSpawn < 9)
            return;
        this.lastSpawn = time;
        // A new school swims in from a random edge.
        const side = randInt(0, 3);
        const along = rand(0.15, 0.85);
        const x = side === 0 ? -20 : side === 1 ? W + 20 : along * W;
        const y = side === 2 ? -20 : side === 3 ? H + 20 : along * H;
        const inward = Math.atan2(H / 2 - y, W / 2 - x) + rand(-0.5, 0.5);
        const species = pickSpecies();
        const sp = SPECIES[species];
        const millDir = Math.random() < 0.5 ? 1 : -1;
        for (const f of due.slice(0, sp.schoolSize[1])) {
            f.alive = true;
            f.species = species;
            f.alarm = 0;
            f.turn = 0;
            f.millDir = millDir;
            f.x = x + rand(-1, 1) * this.perception;
            f.y = y + rand(-1, 1) * this.perception;
            f.vx = Math.cos(inward) * sp.cruise * 1.4;
            f.vy = Math.sin(inward) * sp.cruise * 1.4;
        }
    }
}


/* ===== renderer.ts — ported from jiezi1234/character-ocean (MIT) ===== */
/** Adapted from stackedlol/ascii-sharks. See LICENSE.md and THIRD_PARTY_NOTICES.md. */
/**
 * Draws the World as a grid of ASCII cells:
 *   1. a pure black cell grid
 *   2. a wake field that diffuses where things swim, lighting the dots cyan
 *   3. fish as minimal ASCII dashes, one per cell, glinting on hard turns
 *   4. sharks rasterised cell-by-cell with supersampled edges: grey blocks
 *      shaded by the light, dense glyphs, and shimmering accent colours
 */
// Unicode Braille: left column bits 1,2,3,7; right column bits 4,5,6,8.
const BRAILLE_DOTS = [
    [0.27, 0.13, 1], [0.27, 0.37, 2], [0.27, 0.63, 4], [0.27, 0.87, 64],
    [0.73, 0.13, 8], [0.73, 0.37, 16], [0.73, 0.63, 32], [0.73, 0.87, 128],
];
const DOT_THRESHOLDS = [0.06, 0.55, 0.31, 0.8, 0.68, 0.18, 0.93, 0.43];
const ALPHA_LEVELS = 6;
const FISH_ALPHAS = [0.28, 0.42, 0.58, 0.74, 0.9];
// Dot colour classes: blue, green, red, pale; the last entry is the cyan wake.
const DOT_RGB = [
    [48, 52, 235],
    [52, 205, 60],
    [228, 50, 44],
    [190, 212, 255],
    [110, 230, 255],
];
const DOT_BASE_ALPHA = [1, 1, 1, 1, 1];
const WAKE = DOT_RGB.length - 1;
const ACCENTS = ["#e0892c", "#e03a32", "#b44ae0", "#33c8cc", "#3cb54a", "#3150e8", "#d9c14a"];
const NIGHT_ACCENTS = ["#b2bfa9", "#c2b2ac", "#a79fbd", "#79bec5", "#8db3a8", "#8aabd0", "#bfba99"];
/**
 * The original's light theme is not a real light palette: it renders the
 * dark scene, then the whole canvas goes through CSS
 * filter: invert(1) hue-rotate(180deg) saturate(.48), at opacity .78 over a
 * white page. This phone canvas has no such filter layer, so light-mode
 * shark colours are computed here by running the original's pre-filter RGB
 * through that exact filter chain, returning the colour the original
 * actually shows on screen. (A plain 255 - v inversion only reproduces the
 * first step and leaves every layer too dark — that was the old behaviour.)
 */
function presentLight(r, g, b) {
    r = 255 - r; g = 255 - g; b = 255 - b; // invert(1)
    var r2 = -0.574 * r + 1.430 * g + 0.144 * b; // hue-rotate(180deg), CSS matrix
    var g2 = 0.426 * r + 0.430 * g + 0.144 * b;
    var b2 = 0.426 * r + 1.430 * g - 0.856 * b;
    var r3 = 0.59076 * r2 + 0.3718 * g2 + 0.03744 * b2; // saturate(.48)
    var g3 = 0.11076 * r2 + 0.8518 * g2 + 0.03744 * b2;
    var b3 = 0.11076 * r2 + 0.3718 * g2 + 0.51744 * b2;
    return "rgb(" + Math.round(clamp(r3 * 0.78 + 255 * 0.22, 0, 255)) + "," // opacity .78 over white
        + Math.round(clamp(g3 * 0.78 + 255 * 0.22, 0, 255)) + ","
        + Math.round(clamp(b3 * 0.78 + 255 * 0.22, 0, 255)) + ")";
}
// Sparse glyphs on bright skin, dense glyphs in shadow, so the texture
// reinforces the shading instead of fighting it.
const SKIN_RAMP = ":;t%SX8#@";
const FIN_GLYPHS = "%;tS:";
const RIDGE_GLYPHS = "@8%";
const EDGE_HEAVY = ":;";
const EDGE_LIGHT = ".',`";
const FLAG_BODY = 1;
const FLAG_EDGE = 2;
const FLAG_FIN = 3;
const FLAG_RIDGE = 4;
const FLAG_EYE = 5;
/** Dark skin markings: tiger bars, zebra-shark spots. */
const FLAG_MARK = 6;
const FLAG_TAIL = 7;
const MARK_GLYPHS = "#%@";
// Increasing ink density, using the reference's uppercase letters and punctuation.
const TYPE_GLYPHS = [".", ":", "-=", "+*", "TA", "ER", "%", "#@"];
// Sub-cell sample offsets for anti-aliased silhouettes.
const SUBSAMPLES = [0.25, 0.3, 0.75, 0.3, 0.25, 0.72, 0.75, 0.72];
/** Classic top-down half-width at s ∈ [0, 1] (snout → tail), as a fraction of length. */
function classicHalfWidth(s) {
    if (s < 0.13)
        return 0.09 * Math.pow(Math.sin(((s / 0.13) * Math.PI) / 2), 0.95);
    if (s < 0.3)
        return 0.09 + 0.016 * smoothstep(0.13, 0.3, s);
    if (s < 0.84)
        return 0.019 + 0.087 * Math.pow(1 - (s - 0.3) / 0.54, 1.25);
    const k = (s - 0.84) / 0.16;
    return 0.019 * (1 - k) + 0.012 * Math.sin(k * Math.PI);
}
const SHAPES = {
    classic: {
        halfWidth: classicHalfWidth,
        pectoral: [0.15, 0.43, 0.55, 0.26],
        falcate: true,
        pelvic: [0.57, 0.65, 0.69, 0.085],
        caudal: 0.085,
        dorsal: [0.33, 0.47],
        secondDorsal: [0.71, 0.76],
        eye: [0.1, 0.14],
        gills: [0.19, 0.29],
        tint: [0.92, 0.97, 1.05],
    },
    // Slim neck under a wide, swept-back cephalofoil (drawn in sampleShark),
    // tall first dorsal, long upper tail lobe. Bronze-olive grey.
    hammerhead: {
        halfWidth: (s) => {
            if (s < 0.06)
                return 0.045;
            if (s < 0.3)
                return 0.045 + 0.061 * smoothstep(0.06, 0.3, s);
            return classicHalfWidth(s) * 0.92;
        },
        head: { span: 0.17, sweep: 0.035, depth: 0.09, notch: 0 },
        pectoral: [0.17, 0.4, 0.5, 0.22],
        falcate: true,
        pelvic: [0.56, 0.63, 0.67, 0.075],
        caudal: 0.11,
        dorsal: [0.28, 0.44],
        secondDorsal: [0.7, 0.74],
        eye: null,
        gills: [0.16, 0.26],
        tint: [0.96, 0.98, 0.9],
    },
    // Blunt, square snout on a heavy body; barred back. Warm grey-brown.
    tiger: {
        halfWidth: (s) => {
            if (s < 0.13)
                return 0.1 * Math.pow(Math.sin(((s / 0.13) * Math.PI) / 2), 0.45);
            if (s < 0.3)
                return 0.1 + 0.014 * smoothstep(0.13, 0.3, s);
            if (s < 0.84)
                return 0.019 + 0.095 * Math.pow(1 - (s - 0.3) / 0.54, 1.2);
            const k = (s - 0.84) / 0.16;
            return 0.019 * (1 - k) + 0.012 * Math.sin(k * Math.PI);
        },
        pectoral: [0.15, 0.42, 0.53, 0.25],
        falcate: true,
        pelvic: [0.57, 0.65, 0.69, 0.085],
        caudal: 0.095,
        dorsal: [0.33, 0.46],
        secondDorsal: [0.71, 0.75],
        eye: [0.08, 0.12],
        gills: [0.19, 0.28],
        tint: [1.02, 0.95, 0.84],
    },
    // Short rounded head, body done by half-length, then a long ribbon of a
    // tail fin. Broad rounded pectorals, spotted sandy skin.
    zebra: {
        halfWidth: (s) => {
            if (s < 0.1)
                return 0.075 * Math.pow(Math.sin(((s / 0.1) * Math.PI) / 2), 0.7);
            if (s < 0.28)
                return 0.075 + 0.025 * smoothstep(0.1, 0.28, s);
            if (s < 0.55)
                return 0.022 + 0.078 * Math.pow(1 - (s - 0.28) / 0.27, 1.1);
            const k = (s - 0.55) / 0.45;
            return 0.022 * (1 - k * k) + 0.012 * Math.sin(k * Math.PI);
        },
        pectoral: [0.12, 0.3, 0.36, 0.19],
        falcate: false,
        pelvic: [0.42, 0.48, 0.51, 0.065],
        caudal: 0,
        dorsal: [0.36, 0.44],
        secondDorsal: [0.49, 0.53],
        eye: [0.06, 0.09],
        gills: [0.13, 0.2],
        tint: [1.08, 0.97, 0.74],
    },
    // Great hammerhead: a broader, nearly straight-edged cephalofoil with a notch at the centre,
    // a towering sickle first dorsal (drawn long and bright from above), and a cooler slate skin.
    greathammer: {
        halfWidth: (s) => {
            if (s < 0.05)
                return 0.04;
            if (s < 0.3)
                return 0.04 + 0.07 * smoothstep(0.05, 0.3, s);
            return classicHalfWidth(s) * 0.95;
        },
        head: { span: 0.21, sweep: 0.006, depth: 0.085, notch: 0.014 },
        pectoral: [0.16, 0.38, 0.49, 0.24],
        falcate: true,
        pelvic: [0.55, 0.62, 0.67, 0.085],
        caudal: 0.13,
        dorsal: [0.24, 0.45],
        secondDorsal: [0.68, 0.74],
        eye: null,
        gills: [0.15, 0.25],
        tint: [0.86, 0.93, 1.02],
    },
    // Shortfin mako: a long conical snout, a torpedo body that narrows hard to the tail stalk,
    // and a tall crescent tail. Metallic indigo back.
    mako: {
        halfWidth: (s) => {
            if (s < 0.17)
                return 0.088 * Math.pow(Math.sin(((s / 0.17) * Math.PI) / 2), 1.5);
            if (s < 0.32)
                return 0.088 + 0.012 * smoothstep(0.17, 0.32, s);
            if (s < 0.86)
                return 0.014 + 0.086 * Math.pow(1 - (s - 0.32) / 0.54, 1.45);
            const k = (s - 0.86) / 0.14;
            return 0.014 * (1 - k) + 0.01 * Math.sin(k * Math.PI);
        },
        pectoral: [0.18, 0.4, 0.5, 0.21],
        falcate: true,
        pelvic: [0.58, 0.64, 0.68, 0.06],
        caudal: 0.13,
        dorsal: [0.34, 0.45],
        secondDorsal: [0.76, 0.79],
        eye: [0.11, 0.15],
        gills: [0.2, 0.3],
        tint: [0.78, 0.9, 1.2],
    },
    // Thresher: a compact body over the front half, then the upper tail lobe as a long whip
    // that's as long as the shark itself. Big eyes, long sickle pectorals, bronze-violet skin.
    thresher: {
        halfWidth: (s) => {
            if (s < 0.08)
                return 0.07 * Math.pow(Math.sin(((s / 0.08) * Math.PI) / 2), 0.75);
            if (s < 0.2)
                return 0.07 + 0.02 * smoothstep(0.08, 0.2, s);
            if (s < 0.48)
                return 0.012 + 0.078 * Math.pow(1 - (s - 0.2) / 0.28, 1.3);
            // The whip: thin, with a slight sickle swell before it tapers out.
            const k = (s - 0.48) / 0.52;
            return 0.012 * (1 - k) + 0.006 * Math.sin(k * Math.PI * 0.9) + 0.002;
        },
        pectoral: [0.12, 0.27, 0.36, 0.2],
        falcate: true,
        pelvic: [0.37, 0.41, 0.44, 0.045],
        caudal: 0,
        dorsal: [0.24, 0.32],
        secondDorsal: [0.45, 0.47],
        eye: [0.05, 0.1],
        gills: [0.11, 0.18],
        tint: [1.0, 0.9, 1.08],
    },
    // Nurse shark: a blunt, broad head, a heavy flattened body with both dorsals set far back,
    // rounded paddle pectorals, and a long low tail with no lower lobe. Tawny brown.
    nurse: {
        halfWidth: (s) => {
            if (s < 0.08)
                return 0.085 * Math.pow(Math.sin(((s / 0.08) * Math.PI) / 2), 0.4);
            if (s < 0.3)
                return 0.085 + 0.02 * smoothstep(0.08, 0.3, s);
            if (s < 0.72)
                return 0.022 + 0.083 * Math.pow(1 - (s - 0.3) / 0.42, 1.1);
            const k = (s - 0.72) / 0.28;
            return 0.022 * (1 - k * k) + 0.014 * Math.sin(k * Math.PI);
        },
        pectoral: [0.16, 0.34, 0.4, 0.17],
        falcate: false,
        pelvic: [0.45, 0.52, 0.55, 0.075],
        caudal: 0,
        dorsal: [0.5, 0.58],
        secondDorsal: [0.63, 0.69],
        eye: [0.05, 0.075],
        gills: [0.14, 0.22],
        tint: [1.1, 0.96, 0.76],
    },
    // A manta's curved disc, cephalic lobes and pale dorsal patches are sampled separately.
    manta: {
        halfWidth: (s) => {
            if (s < 0.08)
                return 0.06 + 0.025 * smoothstep(0, 0.08, s);
            if (s < 0.48)
                return 0.018 + 0.075 * Math.sin(((s - 0.08) / 0.4) * Math.PI);
            return 0.008 * (1 - (s - 0.48) / 0.52) + 0.002;
        },
        pectoral: [0.045, 0.56, 0.3, 0.6],
        falcate: false,
        pelvic: [0.4, 0.5, 0.52, 0.055],
        caudal: 0,
        dorsal: [2, 2], secondDorsal: [2, 2],
        eye: [0.065, 0.14], gills: [2, 2],
        tint: [0.85, 0.96, 1.04],
    },
    // A broad, blunt head, a heavy torso and regularly spaced skin spots.
    whaleshark: {
        halfWidth: (s) => {
            if (s < 0.08)
                return 0.105 + 0.027 * smoothstep(0, 0.08, s);
            if (s < 0.32)
                return 0.132;
            if (s < 0.86)
                return 0.018 + 0.114 * Math.pow(1 - (s - 0.32) / 0.54, 1.1);
            return 0.018 * (1 - (s - 0.86) / 0.14) + 0.003;
        },
        pectoral: [0.18, 0.45, 0.56, 0.24], falcate: false,
        pelvic: [0.61, 0.7, 0.75, 0.09], caudal: 0.12,
        dorsal: [0.39, 0.48], secondDorsal: [0.73, 0.77],
        eye: [0.025, 0.09], gills: [0.16, 0.29],
        tint: [0.72, 0.94, 1.16],
    },
    // A rounded, short body with opposing tall fins and a small scalloped tail.
    sunfish: {
        halfWidth: (s) => {
            if (s < 0.12)
                return 0.06 + 0.095 * smoothstep(0, 0.12, s);
            if (s < 0.76)
                return 0.075 + 0.14 * Math.pow(Math.sin(((s - 0.12) / 0.64) * Math.PI), 0.8);
            return 0.065 * (1 - (s - 0.76) / 0.24) + 0.018;
        },
        pectoral: [0.15, 0.28, 0.33, 0.18], falcate: false,
        pelvic: [0.4, 0.78, 0.66, 0.34], caudal: 0.045,
        dorsal: [0.42, 0.7], secondDorsal: [2, 2],
        eye: [0.055, 0.14], gills: [0.16, 0.21],
        tint: [0.99, 1.02, 0.88],
    },
};
const KINDS = Object.keys(SHAPES);
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
}
/** Visible dark-grey cell grid, snapped to device pixels. Shared with the sidebar backdrop. */
function paintGrid(g, W, H, cw, ch, dpr, light = true) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = light ? "rgba(30,39,72,0.045)" : "rgba(133,183,202,0.035)";
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= Math.ceil(W / cw); c++) {
        const x = Math.round(c * cw * dpr) + 0.5;
        g.moveTo(x, 0);
        g.lineTo(x, H * dpr);
    }
    for (let r = 0; r <= Math.ceil(H / ch); r++) {
        const y = Math.round(r * ch * dpr) + 0.5;
        g.moveTo(0, y);
        g.lineTo(W * dpr, y);
    }
    g.stroke();
}
class AsciiRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.dpr = 1;
        this.width = 0;
        this.height = 0;
        this.cw = 12;
        this.ch = 18;
        this.cols = 0;
        this.rows = 0;
        this.fontFamily = "ui-monospace, Menlo, monospace";
        this.mode = "ascii";
        this.pal = { bg: "#ffffff", light: true, fish: "67,65,73", fishScale: 1 };
        this.dotKind = new Uint8Array(0); // 0 none, 1 blue, 2 green, 3 red, 4 pale
        this.dotPhase = new Float32Array(0);
        this.dotFreq = new Float32Array(0);
        this.energy = new Float32Array(0);
        this.energyTmp = new Float32Array(0);
        this.heat = new Float32Array(0);
        this.bucketOf = new Uint8Array(0);
        this.bucketOrder = new Int32Array(0);
        this.bucketCounts = new Int32Array(DOT_RGB.length * ALPHA_LEVELS + 1);
        this.dotStyles = [];
        this.sharkFlag = new Uint8Array(0);
        this.sharkShade = new Float32Array(0);
        this.sharkKey = new Uint32Array(0);
        this.sharkDepth = new Float32Array(0);
        this.sharkKind = new Uint8Array(0);
        this.sharkDots = new Uint8Array(0);
        this.sharkAngle = new Float32Array(0);
        /** Cells darkened by a shark's shadow on the seabed. */
        this.sharkShadow = new Uint8Array(0);
        this.spine = new Float32Array(SHARK_NODES * 2);
        this.arc = new Float32Array(SHARK_NODES);
        this.arcTotal = 1;
        this.shape = SHAPES.classic;
        this.sharkId = 0;
        this.finTipLeft = 0;
        this.finTipRight = 0;
        // Scratch outputs of sampleShark(), to avoid allocating per sample.
        this.hitFlag = 0;
        this.hitShade = 0;
        this.hitS = 0;
        this.hitV = 0;
        this.hitDist = 0;
        this.hitAngle = 0;
        /** Cells holding a fish this frame (frame stamp); dots skip them. */
        this.fishStamp = new Uint32Array(0);
        this.frameId = 0;
        /** Fish cells bucketed by brightness, so each bucket is one fillStyle. */
        this.fishBuckets = FISH_ALPHAS.map(() => []);
        this.fishStyles = FISH_ALPHAS.map((a) => `rgba(67,65,73,${a})`);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx)
            throw new Error("2D canvas unavailable");
        this.ctx = ctx;
        this.bg = document.createElement("canvas");
        for (let c = 0; c < DOT_RGB.length; c++) {
            const [r, g, b] = DOT_RGB[c];
            for (let l = 0; l < ALPHA_LEVELS; l++) {
                const a = (DOT_BASE_ALPHA[c] * (l + 1)) / ALPHA_LEVELS;
                this.dotStyles.push(`rgba(${r},${g},${b},${a.toFixed(3)})`);
            }
        }
    }
    get cellWidth() {
        return this.cw;
    }
    get cellHeight() {
        return this.ch;
    }
    setFontFamily(family) {
        if (family)
            this.fontFamily = family;
    }
    setMode(mode) {
        if (this.mode === mode)
            return;
        this.mode = mode;
        this.paintBackground();
    }
    setPalette(pal) {
        this.pal = pal;
        this.fishStyles = FISH_ALPHAS.map(a => `rgba(${pal.fish},${(a * pal.fishScale).toFixed(3)})`);
        this.paintBackground();
    }
    resize(width, height, dpr) {
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        // A slightly finer character grid keeps the smaller silhouettes legible.
        this.cw = clamp(Math.round(width / 100), 5, 10);
        this.ch = Math.round(this.cw * 1.45);
        this.cols = Math.ceil(width / this.cw);
        this.rows = Math.ceil(height / this.ch);
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.bg.width = this.canvas.width;
        this.bg.height = this.canvas.height;
        const n = this.cols * this.rows;
        this.dotKind = new Uint8Array(n);
        this.dotPhase = new Float32Array(n);
        this.dotFreq = new Float32Array(n);
        this.energy = new Float32Array(n);
        this.energyTmp = new Float32Array(n);
        this.heat = new Float32Array(n);
        this.bucketOf = new Uint8Array(n);
        this.bucketOrder = new Int32Array(n);
        this.sharkFlag = new Uint8Array(n);
        this.sharkShade = new Float32Array(n);
        this.sharkKey = new Uint32Array(n);
        this.sharkDepth = new Float32Array(n);
        this.sharkKind = new Uint8Array(n);
        this.sharkDots = new Uint8Array(n);
        this.sharkAngle = new Float32Array(n);
        this.sharkShadow = new Uint8Array(n);
        this.fishStamp = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
            const col = i % this.cols;
            const row = (i / this.cols) | 0;
            // No ambient dots: the grid stays black. Only the cyan wake lights cells.
            this.dotKind[i] = 0;
            this.dotPhase[i] = hash3(col, row, 23) * Math.PI * 2;
            this.dotFreq[i] = 0.3 + hash3(col, row, 37) * 1.1;
        }
        this.paintBackground();
    }
    paintBackground() {
        const g = this.bg.getContext("2d");
        if (!g)
            return;
        const { width: W, height: H, dpr, cw, ch } = this;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Only the untouched white preset gets our soft ocean treatment. Other
        // chosen colours remain exactly as selected in the wallpaper settings.
        const bg = (this.pal && this.pal.bg) || "#ffffff";
        const isDefaultWhite = bg.toLowerCase() === "#ffffff";
        if (isDefaultWhite) {
            const water = g.createLinearGradient(0, 0, W * 0.7, H);
            water.addColorStop(0, "#f8fcfc");
            water.addColorStop(0.42, "#e9f3f5");
            water.addColorStop(0.75, "#d8e9ec");
            water.addColorStop(1, "#edf4f3");
            g.fillStyle = water;
        } else g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        if (isDefaultWhite) {
            // Quiet, hand-drawn caustics: they sit behind the animated fish.
            g.save();
            g.strokeStyle = "rgba(255,255,255,.38)";
            g.lineWidth = 1;
            for (let i = 0; i < 9; i++) {
                const y = H * (0.09 + i * 0.105);
                g.beginPath();
                g.moveTo(-W * .1, y);
                g.bezierCurveTo(W * .22, y - 30, W * .38, y + 27, W * .68, y - 7);
                g.bezierCurveTo(W * .83, y - 25, W * 1.02, y + 10, W * 1.1, y - 5);
                g.stroke();
            }
            g.restore();
        }
        if (this.mode !== "type")
            paintGrid(g, W, H, cw, ch, dpr, !!(this.pal && this.pal.light));
    }
    render(world, dt) {
        const { ctx, dpr, cols, ch } = this;
        if (cols === 0)
            return;
        const t = world.time;
        this.consumeEvents(world);
        this.rasterizeSharks(world.sharks, t);
        this.depositWake(world);
        this.diffuse(dt);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.bg, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = `600 ${Math.round(ch * 0.74)}px ${this.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        this.markFish(world);
        this.drawDots(t);
        this.drawHeat();
        this.drawFish();
        this.drawSharks(t);
    }
    // ── simulation → field ──────────────────────────────────────────────
    cellIndex(x, y) {
        const c = Math.floor(x / this.cw);
        const r = Math.floor(y / this.ch);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows)
            return -1;
        return r * this.cols + c;
    }
    stamp(field, x, y, radius, amount) {
        const c0 = Math.floor(x / this.cw);
        const r0 = Math.floor(y / this.ch);
        for (let r = r0 - radius; r <= r0 + radius; r++) {
            for (let c = c0 - radius; c <= c0 + radius; c++) {
                if (c < 0 || r < 0 || c >= this.cols || r >= this.rows)
                    continue;
                const d = Math.hypot(c - c0, (r - r0) * 1.4);
                if (d > radius + 0.5)
                    continue;
                const i = r * this.cols + c;
                field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
            }
        }
    }
    consumeEvents(world) {
        for (const e of world.events) {
            if (e.kind === "eat") {
                this.stamp(this.heat, e.x, e.y, 2, 1);
                this.stamp(this.energy, e.x, e.y, 3, 0.9);
            }
            else {
                this.stamp(this.energy, e.x, e.y, 6, 1.4);
            }
        }
        world.events.length = 0;
    }
    depositWake(world) {
        const { energy } = this;
        for (const f of world.fish) {
            if (!f.alive)
                continue;
            const i = this.cellIndex(f.x, f.y);
            if (i >= 0)
                energy[i] = Math.min(1.6, energy[i] + 0.012 + f.alarm * 0.03);
        }
        for (const sh of world.sharks) {
            // The tail sweeps the most water.
            for (let k = SHARK_NODES - 6; k < SHARK_NODES; k++) {
                const i = this.cellIndex(sh.nodes[k * 2], sh.nodes[k * 2 + 1]);
                if (i >= 0)
                    energy[i] = Math.min(1.6, energy[i] + 0.05 + sh.speed * 0.0012);
            }
        }
        if (world.pointer.active) {
            this.stamp(energy, world.pointer.x, world.pointer.y, 1, 0.08);
        }
    }
    /** Blur + decay so wakes spread out like ripples and fade. */
    diffuse(dt) {
        const { cols, rows, energy, energyTmp: tmp, heat } = this;
        const decay = Math.exp(-dt * 1.5);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                const l = c > 0 ? energy[i - 1] : energy[i];
                const rt = c < cols - 1 ? energy[i + 1] : energy[i];
                const u = r > 0 ? energy[i - cols] : energy[i];
                const d = r < rows - 1 ? energy[i + cols] : energy[i];
                tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
            }
        }
        this.energy = tmp;
        this.energyTmp = energy;
        const heatDecay = Math.exp(-dt * 2.2);
        for (let i = 0; i < heat.length; i++)
            heat[i] *= heatDecay;
    }
    // ── sharks ──────────────────────────────────────────────────────────
    /**
     * Classify one point against the current shark (spine/arc already built).
     * Body coordinates: s along the spine (0 snout → 1 tail), v across it.
     * Writes hit* fields and returns whether the point is on the shark.
     */
    sampleShark(px, py, L) {
        if (this.shape === SHAPES.manta)
            return this.sampleManta(px, py, L);
        const { spine, arc } = this;
        const N = SHARK_NODES;
        let best = Infinity;
        let bestS = 0;
        let bestSign = 1;
        let bestNx = 0;
        let bestNy = 0;
        for (let k = 0; k < N - 1; k++) {
            const ax = spine[k * 2];
            const ay = spine[k * 2 + 1];
            const sx = spine[(k + 1) * 2] - ax;
            const sy = spine[(k + 1) * 2 + 1] - ay;
            const len2 = sx * sx + sy * sy || 1;
            const u = clamp(((px - ax) * sx + (py - ay) * sy) / len2, 0, 1);
            const qx = ax + sx * u;
            const qy = ay + sy * u;
            const d2 = (px - qx) ** 2 + (py - qy) ** 2;
            if (d2 < best) {
                best = d2;
                const len = Math.sqrt(len2);
                bestS = (arc[k] + u * len) / this.arcTotal;
                bestSign = sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1;
                bestNx = (-sy / len) * bestSign;
                bestNy = (sx / len) * bestSign;
                this.hitAngle = Math.atan2(sy, sx);
            }
        }
        const a = Math.sqrt(best);
        const s = bestS;
        const u = s * L;
        const shape = this.shape;
        const w = shape.halfWidth(s) * L;
        this.hitDist = a;
        this.hitS = s;
        this.hitV = a * bestSign;
        const head = this.shape.head;
        if (head && u < L * (head.sweep + head.depth + head.notch)) {
            // Cephalofoil: a wide wing across the snout, its tips swept back toward the eyes,
            // and on a great hammerhead a shallow notch in the middle of the front edge.
            const span = L * head.span;
            const r = a / span;
            const front = L * head.sweep * r * r + L * head.notch * Math.max(0, 1 - r / 0.14);
            // Full depth almost to the tips, so the wing reads as a solid bar rather than a thin line.
            const depth = L * head.depth * (1 - 0.2 * r * r * r * r);
            if (r <= 1 && u >= front && u <= front + depth) {
                this.hitFlag = r > 0.84 ? FLAG_EYE : FLAG_BODY;
                this.hitShade = r > 0.84 ? 0 : 0.62 - 0.2 * r + (u < front + L * 0.012 ? 0.1 : 0);
                return true;
            }
        }
        if (a <= w) {
            const across = a / (w || 1);
            // Rounded back lit from the top-left; flanks fall off into shadow.
            const facing = (bestNx * -0.6 + bestNy * -0.8) * across;
            let shade = 0.58 - across * across * 0.42 + facing * 0.26;
            let flag = FLAG_BODY;
            if (s > shape.dorsal[0] && s < shape.dorsal[1] && across < 0.3) {
                // First dorsal fin, catching the light.
                flag = FLAG_RIDGE;
                shade = 1;
            }
            else if (s > shape.secondDorsal[0] && s < shape.secondDorsal[1] && across < 0.4) {
                shade = Math.max(shade, 0.82);
            }
            else if (shape.eye && s > shape.eye[0] && s < shape.eye[1] && across > 0.6) {
                flag = FLAG_EYE;
                shade = 0;
            }
            else if (s > shape.gills[0] && s < shape.gills[1] && across > 0.58) {
                // Five gill slits.
                if (Math.floor(((s - shape.gills[0]) / (shape.gills[1] - shape.gills[0])) * 5) % 2 === 0)
                    shade *= 0.45;
            }
            else if (s < 0.05) {
                // Pale snout tip.
                shade = Math.max(shade, 0.7);
            }
            else if (shape === SHAPES.zebra && s > 0.08 && s < 0.55 && (across < 0.1 || Math.abs(across - 0.6) < 0.08)) {
                // Zebra sharks carry pale ridges down the back.
                shade = Math.max(shade, 0.8);
            }
            else if (this.marked(s, a * bestSign, L, across)) {
                flag = FLAG_MARK;
            }
            this.hitFlag = flag;
            this.hitShade = shade;
            return true;
        }
        const tip = bestSign > 0 ? this.finTipRight : this.finTipLeft;
        const [p0, p1, p2] = shape.pectoral;
        if (inTriangle(u, a, L * p0, 0, L * p1, 0, L * p2, tip) &&
            // Falcate (sickle) fins get a concave trailing edge.
            !(shape.falcate && inTriangle(u, a, L * p1, 0, L * (p1 + (p2 - p1) * 0.33), tip * 0.55, L * p2, tip))) {
            this.hitFlag = this.marked(s, a * bestSign, L, 0) ? FLAG_MARK : FLAG_FIN;
            this.hitShade = 0.38 + 0.22 * (1 - clamp(a / tip, 0, 1));
            return true;
        }
        const [v0, v1, v2, vr] = shape.pelvic;
        if (inTriangle(u, a, L * v0, 0, L * v1, 0, L * v2, L * vr) ||
            // Forked caudal fin.
            (shape.caudal > 0 && inTriangle(u, a, L * 0.86, 0, L * 0.95, 0, L, L * shape.caudal))) {
            this.hitFlag = FLAG_FIN;
            this.hitShade = 0.36;
            return true;
        }
        return false;
    }
    /** Broad, curved manta disc in a stable frame; the whip follows the flexible spine. */
    sampleManta(px, py, L) {
        const { spine } = this;
        const dx = spine[20] - spine[0];
        const dy = spine[21] - spine[1];
        const axisLength = Math.hypot(dx, dy) || 1;
        const tx = dx / axisLength;
        const ty = dy / axisLength;
        const localLength = axisLength * (SHARK_NODES - 1) / 10;
        const x = px - spine[0];
        const y = py - spine[1];
        const s = (x * tx + y * ty) / localLength;
        const v = -x * ty + y * tx;
        const a = Math.abs(v) / localLength;
        const reach = (v > 0 ? this.finTipRight : this.finTipLeft) / L;
        const q = a / reach;
        this.hitS = s;
        this.hitV = v;
        this.hitDist = Math.abs(v);
        this.hitAngle = Math.atan2(ty, tx);
        this.hitFlag = FLAG_BODY;
        this.hitShade = 0.2;
        // Rolled cephalic fins extend ahead of the shallow, concave mouth.
        const lobeCentre = 0.075 + 0.12 * Math.max(0, s);
        if (s >= -0.045 && s <= 0.065) {
            const lobeWidth = 0.009 + 0.009 * smoothstep(-0.045, 0.05, s);
            if (Math.abs(a - lobeCentre) < lobeWidth * Math.sqrt(Math.max(0, 1 - ((s - 0.01) / 0.055) ** 2))) {
                this.hitFlag = s < 0 ? FLAG_RIDGE : FLAG_BODY;
                this.hitShade = s < 0 ? 0.95 : 0.36;
                return true;
            }
        }
        // Swept leading margins meet concave trailing margins at tapered wing tips.
        const front = 0.022 + 0.278 * Math.pow(q, 1.45) + 0.016 * Math.exp(-q * q / 0.012);
        const back = 0.56 - 0.25 * Math.pow(q, 0.7);
        if (q <= 1 && s >= front && s <= back) {
            const shoulder = ((a - 0.112) / 0.05) ** 2 + ((s - 0.092 - (a - 0.112) * 0.7) / 0.025) ** 2;
            const wingBand = front + 0.025 + 0.025 * Math.sin(q * Math.PI);
            const paleWing = q > 0.42 && Math.abs(s - wingBand) < 0.009 + 0.013 * smoothstep(0.65, 1, q);
            const rearRidge = Math.abs(a - (0.56 - s) * 0.25) < 0.008 && s > 0.29;
            const mouthRim = a < 0.08 && s - front < 0.008;
            this.hitShade = 0.16 + 0.15 * (1 - q) + 0.08 * Math.sin((s - front) / (back - front) * Math.PI);
            if (shoulder < 1 || paleWing || rearRidge || mouthRim) {
                this.hitFlag = FLAG_RIDGE;
                this.hitShade = 0.9 + 0.1 * (1 - Math.min(1, shoulder));
            }
            else if (s > 0.05 && s < 0.09 && a > 0.09 && a < 0.115) {
                this.hitFlag = FLAG_EYE;
                this.hitShade = 0;
            }
            return true;
        }
        // A continuous narrow whip, rather than the previous broad ribbon tail.
        if (s > 0.48) {
            for (let k = 10; k < SHARK_NODES - 1; k++) {
                const ax = spine[k * 2];
                const ay = spine[k * 2 + 1];
                const sx = spine[k * 2 + 2] - ax;
                const sy = spine[k * 2 + 3] - ay;
                const len2 = sx * sx + sy * sy || 1;
                const along = ((px - ax) * sx + (py - ay) * sy) / len2;
                if (along < 0 || along > 1)
                    continue;
                const distance = Math.hypot(px - ax - sx * along, py - ay - sy * along);
                const tailS = (k + along) / (SHARK_NODES - 1);
                const width = Math.max(this.cw * 0.22, L * (0.0045 - tailS * 0.0025));
                if (distance <= width) {
                    this.hitS = tailS;
                    this.hitV = distance;
                    this.hitFlag = FLAG_TAIL;
                    this.hitShade = 0.76;
                    this.hitAngle = Math.atan2(sy, sx);
                    return true;
                }
            }
        }
        return false;
    }
    /** Whether a body point (s along, v across) falls on a dark marking. */
    marked(s, v, L, across) {
        if (this.shape === SHAPES.whaleshark) {
            if (s < 0.1 || s > 0.81)
                return false;
            const u = s / 0.052;
            const w = v / (L * 0.043);
            const x = u - Math.floor(u) - 0.5;
            const y = w - Math.floor(w) - 0.5;
            return x * x + y * y < 0.075;
        }
        if (this.shape === SHAPES.tiger) {
            // Wavy vertical bars over the back half, fading out toward the head.
            if (s < 0.2 || s > 0.9 || across > 0.85)
                return false;
            const wobble = 0.35 * Math.sin((v / L) * 25 + s * 5);
            const bar = Math.sin(s * Math.PI * 2 * 9 + wobble);
            return bar > 0.65 - 0.5 * smoothstep(0.2, 0.42, s) + 0.4 * smoothstep(0.8, 0.9, s);
        }
        if (this.shape === SHAPES.zebra) {
            // Leopard spots on a jittered grid, so they ride along with the skin.
            if (s < 0.07)
                return false;
            const gu = (s * L) / (L * 0.06);
            const gv = v / (L * 0.045);
            const cu = Math.floor(gu);
            const cv = Math.floor(gv);
            const jx = hash3(cu, cv, this.sharkId) * 0.5 + 0.25;
            const jy = hash3(cu, cv, this.sharkId + 11) * 0.5 + 0.25;
            return (gu - cu - jx) ** 2 + (gv - cv - jy) ** 2 < 0.08;
        }
        return false;
    }
    /**
     * Build a smooth, undulating render spine from the sim spine, then
     * supersample every cell in the shark's bounding box against the shape.
     * Fully covered cells become solid skin; partial cells become edge glyphs.
     */
    rasterizeSharks(sharks, t) {
        const { sharkFlag, sharkShade, sharkKey, sharkDepth, sharkKind, sharkShadow, spine, arc, cw, ch, cols, rows } = this;
        sharkFlag.fill(0);
        sharkShadow.fill(0);
        this.sharkDots.fill(0);
        for (const sh of sharks) {
            const L = sh.length;
            const N = SHARK_NODES;
            const n = sh.nodes;
            const swim = clamp(sh.speed / 60, 0.4, 1.4);
            this.shape = SHAPES[sh.kind];
            this.sharkId = sh.id;
            const kindIndex = KINDS.indexOf(sh.kind);
            // Travelling body wave, growing toward the tail.
            for (let k = 0; k < N; k++) {
                const s = k / (N - 1);
                if (sh.kind === "manta") {
                    // The disc glides as a single surface; only the whip bends, gently.
                    const hx = n[0] - n[2];
                    const hy = n[1] - n[3];
                    const hl = Math.hypot(hx, hy) || 1;
                    const tail = smoothstep(0.45, 1, s);
                    const bend = L * tail * tail * (0.018 * Math.sin(sh.phase * 0.65 - s * 2.4) + 0.07 * clamp(sh.turn, -1, 1));
                    spine[k * 2] = n[0] - hx / hl * L * s - hy / hl * bend;
                    spine[k * 2 + 1] = n[1] - hy / hl * L * s + hx / hl * bend;
                    continue;
                }
                const a = Math.max(0, k - 1);
                const b = Math.min(N - 1, k + 1);
                let tx = n[a * 2] - n[b * 2];
                let ty = n[a * 2 + 1] - n[b * 2 + 1];
                const tl = Math.hypot(tx, ty) || 1;
                tx /= tl;
                ty /= tl;
                const flexScale = sh.kind === "sunfish" ? 0.12 : sh.kind === "whaleshark" ? 0.65 : 1;
                const amp = L * 0.05 * flexScale * (0.1 + 0.9 * Math.pow(s, 1.8)) * swim;
                const off = amp * Math.sin(sh.phase - s * 5.2);
                spine[k * 2] = n[k * 2] - ty * off;
                spine[k * 2 + 1] = n[k * 2 + 1] + tx * off;
            }
            arc[0] = 0;
            for (let k = 1; k < N; k++) {
                arc[k] =
                    arc[k - 1] +
                        Math.hypot(spine[k * 2] - spine[(k - 1) * 2], spine[k * 2 + 1] - spine[(k - 1) * 2 + 1]);
            }
            this.arcTotal = arc[N - 1] || 1;
            // Bank into turns: the inside fin foreshortens, the outside one spreads.
            const bank = clamp(sh.turn * 0.45, -0.35, 0.35);
            const flex = sh.kind === "manta"
                ? 0.84 + 0.16 * Math.sin(sh.phase * 0.65)
                : 1 + 0.06 * Math.sin(sh.phase * 0.5);
            const reachFin = this.shape.pectoral[3];
            this.finTipRight = L * reachFin * flex * (1 - bank);
            this.finTipLeft = L * reachFin * flex * (1 + bank);
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (let k = 0; k < N; k++) {
                minX = Math.min(minX, spine[k * 2]);
                maxX = Math.max(maxX, spine[k * 2]);
                minY = Math.min(minY, spine[k * 2 + 1]);
                maxY = Math.max(maxY, spine[k * 2 + 1]);
            }
            const reach = sh.kind === "manta"
                ? Math.max(this.finTipRight, this.finTipLeft) + L * 0.06
                : L * 0.36;
            const c0 = Math.max(0, Math.floor((minX - reach) / cw));
            const c1 = Math.min(cols - 1, Math.floor((maxX + reach) / cw));
            const r0 = Math.max(0, Math.floor((minY - reach) / ch));
            const r1 = Math.min(rows - 1, Math.floor((maxY + reach) / ch));
            if (c0 > c1 || r0 > r1)
                continue;
            const skipBeyond = reach + Math.hypot(cw, ch);
            const shadowDc = Math.round((L * 0.035) / cw) + 1;
            const shadowDr = Math.round((L * 0.02) / ch) + 1;
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    const x = c * cw;
                    const y = r * ch;
                    const centerHit = this.sampleShark(x + cw / 2, y + ch / 2, L);
                    if (!centerHit && this.hitDist > skipBeyond)
                        continue;
                    const flag = this.hitFlag;
                    const shade = this.hitShade;
                    const s = this.hitS;
                    const v = this.hitV;
                    const angle = this.hitAngle;
                    let hits = centerHit ? 1 : 0;
                    let tailHit = centerHit && flag === FLAG_TAIL;
                    let tailAngle = angle;
                    for (let k = 0; k < SUBSAMPLES.length; k += 2) {
                        if (this.sampleShark(x + SUBSAMPLES[k] * cw, y + SUBSAMPLES[k + 1] * ch, L)) {
                            hits++;
                            if (this.hitFlag === FLAG_TAIL) {
                                tailHit = true;
                                tailAngle = this.hitAngle;
                            }
                        }
                    }
                    let dots = 0;
                    if (this.mode === "braille") {
                        for (let d = 0; d < BRAILLE_DOTS.length; d++) {
                            const [ox, oy, bit] = BRAILLE_DOTS[d];
                            if (!this.sampleShark(x + ox * cw, y + oy * ch, L))
                                continue;
                            const density = this.hitFlag === FLAG_EYE ? 1
                                : this.hitFlag === FLAG_MARK ? 0.3 : 0.36 + this.hitShade * 0.6;
                            if (density >= DOT_THRESHOLDS[(d + (c + r) % 4) % 8])
                                dots |= bit;
                        }
                    }
                    if (hits === 0 && dots === 0)
                        continue;
                    const coverage = hits / 5;
                    const i = r * cols + c;
                    // Body-anchored key so each glyph rides along with the skin.
                    const key = (hash3(Math.round(s * 52), Math.round(v / (cw * 0.9)), sh.id) * 4294967295) >>> 0;
                    sharkKey[i] = key;
                    sharkDepth[i] = sh.depth;
                    sharkKind[i] = kindIndex;
                    this.sharkDots[i] = dots;
                    this.sharkAngle[i] = angle;
                    if (tailHit && (!centerHit || flag === FLAG_TAIL)) {
                        sharkFlag[i] = FLAG_TAIL;
                        sharkShade[i] = 0.76;
                        this.sharkAngle[i] = tailAngle;
                    }
                    else if (centerHit && coverage >= 0.6) {
                        sharkFlag[i] = flag;
                        const flicker = (hash3(c, r, Math.floor(t * 6)) - 0.5) * 0.06;
                        sharkShade[i] = clamp(shade + flicker, 0, 1);
                        const sc = c + shadowDc;
                        const sr = r + shadowDr;
                        if (sc < cols && sr < rows)
                            sharkShadow[sr * cols + sc] = 1;
                    }
                    else {
                        sharkFlag[i] = FLAG_EDGE;
                        sharkShade[i] = coverage;
                    }
                }
            }
            if (sh.kind === "manta" && this.mode !== "braille") {
                // Trace every crossed cell so a sub-cell whip cannot fall between AA samples.
                for (let k = 11; k < N - 1; k++) {
                    const ax = spine[k * 2], ay = spine[k * 2 + 1];
                    const dx = spine[k * 2 + 2] - ax, dy = spine[k * 2 + 3] - ay;
                    const steps = Math.ceil(Math.hypot(dx, dy) / (cw * 0.25));
                    for (let j = 0; j <= steps; j++) {
                        const i = this.cellIndex(ax + dx * j / steps, ay + dy * j / steps);
                        if (i < 0 || (sharkFlag[i] && sharkFlag[i] !== FLAG_EDGE && sharkFlag[i] !== FLAG_TAIL))
                            continue;
                        sharkFlag[i] = FLAG_TAIL;
                        sharkShade[i] = 0.76;
                        sharkKind[i] = kindIndex;
                        sharkDepth[i] = sh.depth;
                        this.sharkAngle[i] = Math.atan2(dy, dx);
                    }
                }
            }
        }
    }
    drawSharks(t) {
        if (this.mode === "type") {
            this.drawTypeSharks();
            return;
        }
        if (this.mode !== "ascii") {
            this.drawSymbolSharks(t);
            return;
        }
        const { ctx, cols, rows, cw, ch, sharkFlag, sharkShade, sharkKey, sharkDepth, sharkKind } = this;
        const accents = this.pal.light ? ACCENTS : NIGHT_ACCENTS;
        const n = cols * rows;
        for (let i = 0; i < n; i++) {
            const flag = sharkFlag[i];
            if (!flag)
                continue;
            const col = i % cols;
            const row = (i / cols) | 0;
            const x = col * cw;
            const y = row * ch;
            const key = sharkKey[i];
            const shade = sharkShade[i];
            const dim = 0.7 + 0.3 * sharkDepth[i];
            if (flag === FLAG_TAIL) {
                this.drawWhipCell(i, x, y, dim);
                continue;
            }
            const [tr, tg, tb] = SHAPES[KINDS[sharkKind[i]]].tint;
            // Colours re-roll on a staggered clock so the hide shimmers.
            const tick = Math.floor(t * 2.4 + (key % 997) / 97);
            const roll = hash3(key, tick, 7);
            if (flag === FLAG_EDGE) {
                // Soft, anti-aliased silhouette: no block, just a light glyph.
                const set = shade >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT;
                const g = (this.pal.light ? 70 + shade * 80 : 92 + shade * 73) * dim;
                ctx.fillStyle =
                    roll < 0.07
                        ? accents[key % accents.length]
                        : this.pal.light
                            ? presentLight(Math.round(g * tr), Math.round(g * tg), Math.min(255, Math.round(g * tb + 6)))
                            : `rgb(${Math.round(g * tr)},${Math.round(g * tg)},${Math.min(255, Math.round(g * tb + 6))})`;
                ctx.fillText(set[(key >>> 8) % set.length], x + cw / 2, y + ch / 2 + 1);
                continue;
            }
            let level;
            let glyph;
            if (flag === FLAG_RIDGE) {
                level = 226;
                glyph = RIDGE_GLYPHS[(key >>> 8) % RIDGE_GLYPHS.length];
            }
            else if (flag === FLAG_EYE) {
                level = 12;
                glyph = "o";
            }
            else if (flag === FLAG_MARK) {
                level = 24 + shade * 22;
                glyph = MARK_GLYPHS[(key >>> 8) % MARK_GLYPHS.length];
            }
            else if (flag === FLAG_FIN) {
                level = 40 + shade * 120;
                glyph = FIN_GLYPHS[(key >>> 8) % FIN_GLYPHS.length];
            }
            else {
                level = 46 + shade * 160;
                const jitter = ((key >>> 4) % 3) - 1;
                glyph = SKIN_RAMP[clamp(Math.floor((1 - shade) * 8.99) + jitter, 0, SKIN_RAMP.length - 1)];
            }
            level *= dim * (this.pal.light ? 1 : 0.8);
            // Tinted per species; the classic tint is a cool blue-grey, like a back seen through deep water.
            // Light: the pre-filter colour through presentLight() (the
            // original's light filter chain), not a plain 255 - level.
            ctx.fillStyle = this.pal.light
                ? presentLight(Math.min(255, Math.round(level * tr)), Math.min(255, Math.round(level * tg)), Math.min(255, Math.round(level * tb + 4)))
                : `rgb(${Math.round(level * tr * 0.78)},${Math.min(255, Math.round(level * tg * 0.99 + 8))},${Math.min(255, Math.round(level * tb * 1.08 + 15))})`;
            ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
            let color;
            if (flag === FLAG_EYE)
                color = this.pal.light ? presentLight(154, 160, 173) : "#a9d1d5";
            else if (flag === FLAG_MARK)
                color = this.pal.light
                    ? presentLight(Math.round(70 * tr), Math.round(70 * tg), Math.round(70 * tb))
                    : `rgb(${Math.round(70 * tr)},${Math.round(70 * tg)},${Math.round(70 * tb)})`;
            else if (roll < 0.09)
                color = accents[key % accents.length];
            else if (roll < 0.13)
                color = this.pal.light ? presentLight(255, 255, 255) : "#bfd5df";
            else if (!this.pal.light && KINDS[sharkKind[i]] === "manta")
                color = shade > 0.7 ? "#20313a" : "#43606e";
            else
                color = this.pal.light
                    ? (shade > 0.55 ? presentLight(14, 15, 19) : presentLight(27, 29, 36))
                    : (shade > 0.55 ? "#0e202b" : "#a2bac6");
            ctx.fillStyle = color;
            ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
        }
    }
    /** Monochrome type art: the glyphs alone carry silhouette, shading and skin markings. */
    drawTypeSharks() {
        const { ctx, cw, ch, cols, sharkFlag, sharkShade, sharkDepth, sharkKey } = this;
        ctx.save();
        ctx.font = `600 ${Math.round(ch * 0.86)}px ${this.fontFamily}`;
        ctx.fillStyle = this.pal.light ? presentLight(216, 222, 228) : "#dce9ee";
        for (let i = 0; i < sharkFlag.length; i++) {
            const flag = sharkFlag[i];
            if (!flag)
                continue;
            const shade = sharkShade[i];
            const key = sharkKey[i];
            const edge = flag === FLAG_EDGE;
            const depth = 0.78 + 0.22 * sharkDepth[i];
            let tone = 0.25 + shade * 0.65;
            if (flag === FLAG_RIDGE)
                tone = 0.96;
            else if (flag === FLAG_MARK || flag === FLAG_EYE)
                tone = 0.16;
            else if (flag === FLAG_FIN)
                tone = 0.2 + shade * 0.55;
            else if (edge)
                tone = 0.08 + shade * 0.22;
            // Body-anchored variation keeps letters attached to the fish as it swims.
            const jitter = ((key >>> 5) % 3) - 1;
            const family = TYPE_GLYPHS[clamp(Math.round(tone * 7) + jitter, 0, 7)];
            let glyph = family[(key >>> 10) % family.length];
            if (flag === FLAG_EYE)
                glyph = ":";
            if (flag === FLAG_TAIL) {
                const direction = ((Math.round(this.sharkAngle[i] / (Math.PI / 4)) % 4) + 4) % 4;
                glyph = ["-", "\\", "|", "/"][direction];
            }
            ctx.globalAlpha = depth * (edge ? 0.35 + shade * 0.4 : 0.72 + tone * 0.26);
            ctx.fillText(glyph, (i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch / 2 + 1, cw * 0.9);
        }
        ctx.restore();
    }
    /** Draw the same body grid using distinct symbol vocabularies, without resetting the world. */
    drawSymbolSharks(t) {
        const { ctx, cw, ch, cols, sharkFlag, sharkShade, sharkDepth, sharkKey, sharkKind } = this;
        const accents = this.pal.light ? ACCENTS : NIGHT_ACCENTS;
        ctx.save();
        ctx.font = this.mode === "hanzi"
            ? `500 ${Math.round(cw * 0.98)}px OceanHanzi, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
            : `600 ${Math.round(ch * 0.9)}px ${this.fontFamily}`;
        for (let i = 0; i < sharkFlag.length; i++) {
            const flag = sharkFlag[i];
            if (!flag)
                continue;
            const x = (i % cols) * cw;
            const y = Math.floor(i / cols) * ch;
            const shade = sharkShade[i];
            const key = sharkKey[i];
            const edge = flag === FLAG_EDGE;
            const dim = 0.7 + sharkDepth[i] * 0.3;
            if (flag === FLAG_TAIL && this.mode !== "braille") {
                this.drawWhipCell(i, x, y, dim);
                continue;
            }
            const [tr, tg, tb] = SHAPES[KINDS[sharkKind[i]]].tint;
            let level = (flag === FLAG_MARK ? 90 : (120 + shade * 115) * dim) * (this.pal.light ? 1 : 0.82);
            const accent = hash3(key, Math.floor(t * 1.7), 17) < 0.035;
            ctx.fillStyle = accent ? accents[key % accents.length]
                : this.pal.light
                    ? presentLight(Math.min(255, Math.round(level * tr)), Math.min(255, Math.round(level * tg)), Math.min(255, Math.round(level * tb)))
                    : `rgb(${Math.round(level * tr * 0.84)},${Math.min(255, Math.round(level * tg + 8))},${Math.min(255, Math.round(level * tb * 1.06 + 12))})`;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.globalAlpha = edge ? 0.45 + shade * 0.4 : 1;
            if (this.mode === "braille") {
                // Draw the eight Unicode point positions directly so font fallback cannot produce tofu.
                const mask = this.sharkDots[i];
                const radius = Math.max(0.65, cw * 0.105);
                ctx.beginPath();
                for (const [ox, oy, bit] of BRAILLE_DOTS) {
                    if (!(mask & bit))
                        continue;
                    ctx.moveTo(x + ox * cw + radius, y + oy * ch);
                    ctx.arc(x + ox * cw, y + oy * ch, radius, 0, Math.PI * 2);
                }
                ctx.fill();
                continue;
            }
            if (flag === FLAG_EYE) {
                ctx.beginPath();
                ctx.arc(x + cw / 2, y + ch / 2, Math.max(1.2, cw * 0.18), 0, Math.PI * 2);
                ctx.fill();
                continue;
            }
            if (this.mode === "geometry") {
                const cx = x + cw / 2, cy = y + ch / 2;
                const radius = cw * (edge ? 0.13 : 0.27 + shade * 0.15);
                const shape = (key >>> 4) % 4;
                ctx.lineWidth = Math.max(0.7, cw * 0.075);
                ctx.beginPath();
                if (edge || shape < 2) {
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                }
                else if (shape === 2) {
                    ctx.moveTo(cx, cy - radius * 1.25);
                    ctx.lineTo(cx + radius, cy);
                    ctx.lineTo(cx, cy + radius * 1.25);
                    ctx.lineTo(cx - radius, cy);
                    ctx.closePath();
                }
                else {
                    ctx.rect(cx - radius * 0.85, cy - radius * 0.85, radius * 1.7, radius * 1.7);
                }
                if (edge || shade > 0.6 || flag === FLAG_RIDGE)
                    ctx.fill();
                else
                    ctx.stroke();
                continue;
            }
            let glyph = "";
            if (this.mode === "blocks") {
                const ramp = "░▒▓█";
                glyph = edge ? "░" : ramp[clamp(Math.floor(shade * 3.99), 0, 3)];
                if (!edge && flag === FLAG_FIN)
                    glyph = (key & 1) ? "▄" : "▀";
            }
            else if (this.mode === "lines") {
                const direction = ((Math.round(this.sharkAngle[i] / (Math.PI / 4)) % 4) + 4) % 4;
                glyph = ["─", "╲", "│", "╱"][direction];
                if (!edge && (flag === FLAG_RIDGE || shade > 0.85))
                    glyph = "┼";
                ctx.globalAlpha *= edge ? 0.8 : 0.65 + shade * 0.35;
            }
            else {
                const ramp = "一十川山水海浪魚鯊";
                glyph = edge ? ((key & 1) ? "一" : "十")
                    : ramp[clamp(Math.floor(shade * (ramp.length - 1)) + ((key >>> 3) % 3) - 1, 0, ramp.length - 1)];
                // A small aligned field of actual CJK characters, with no per-cell solid background.
                ctx.globalAlpha *= edge ? 0.55 : 1;
            }
            ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1, cw * 0.98);
        }
        ctx.restore();
    }
    /** Fine aligned strokes keep the manta whip legible without solid tail blocks. */
    drawWhipCell(i, x, y, dim) {
        const { ctx, cw, ch } = this;
        const direction = ((Math.round(this.sharkAngle[i] / (Math.PI / 4)) % 4) + 4) % 4;
        ctx.save();
        ctx.globalAlpha = 0.75 * dim;
        ctx.fillStyle = this.pal.light ? presentLight(169, 187, 195) : "#b0d2df";
        ctx.font = `400 ${Math.round(ch)}px ${this.fontFamily}`;
        ctx.fillText(["─", "╲", "│", "╱"][direction], x + cw / 2, y + ch / 2 + 1, cw * 1.1);
        ctx.restore();
    }
    // ── fish, dots, heat ────────────────────────────────────────────────
    /**
     * Snap each fish to a cell and bucket it by brightness: far fish are dim,
     * near fish brighter, and turning or panicking fish glint. Nearer fish
     * claim a cell first when two land in the same one.
     */
    markFish(world) {
        const { fishStamp, fishBuckets, sharkFlag } = this;
        const frame = ++this.frameId;
        for (const bucket of fishBuckets)
            bucket.length = 0;
        for (let pass = 0; pass < 2; pass++) {
            for (const f of world.fish) {
                if (!f.alive || (f.depth > 0.78 ? 0 : 1) !== pass)
                    continue;
                const i = this.cellIndex(f.x, f.y);
                if (i < 0 || fishStamp[i] === frame || sharkFlag[i])
                    continue;
                fishStamp[i] = frame;
                const glint = clamp(Math.abs(f.turn) / 3.5, 0, 1);
                const v = 0.3 + (0.4 * (f.depth - 0.55)) / 0.45 + 0.3 * Math.max(glint, f.alarm);
                fishBuckets[clamp(Math.floor(v * FISH_ALPHAS.length), 0, FISH_ALPHAS.length - 1)].push(i);
            }
        }
    }
    drawFish() {
        const { ctx, cw, ch, cols, fishBuckets } = this;
        for (let b = 0; b < fishBuckets.length; b++) {
            const bucket = fishBuckets[b];
            if (!bucket.length)
                continue;
            ctx.fillStyle = this.fishStyles[b];
            for (const i of bucket) {
                ctx.fillText("-", (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2 + 1);
            }
        }
    }
    drawHeat() {
        const { ctx, heat, cols, cw, ch } = this;
        for (let i = 0; i < heat.length; i++) {
            const h = heat[i];
            if (h < 0.08)
                continue;
            const col = i % cols;
            const row = (i / cols) | 0;
            ctx.fillStyle = this.mode === "type" ? (this.pal.light ? `rgba(67,65,73,${Math.min(1, h).toFixed(2)})` : `rgba(210,231,239,${Math.min(1, h).toFixed(2)})`)
                : h > 0.5 ? `rgba(255,120,60,${h.toFixed(2)})` : `rgba(220,40,40,${(h * 1.6).toFixed(2)})`;
            ctx.fillText(h > 0.6 ? "*" : "·", col * cw + cw / 2, row * ch + ch / 2 + 1);
        }
    }
    /**
     * Every cell's dot twinkles on its own clock, is modulated by slow
     * caustic light bands, and flares cyan where the wake field is strong.
     * Dots are bucketed by colour/alpha so each bucket is one fillStyle.
     */
    drawDots(t) {
        const { ctx, cols, rows, cw, ch, dotKind, dotPhase, dotFreq, energy, sharkFlag, sharkShadow, fishStamp, frameId } = this;
        ctx.save();
        if (!this.pal.light)
            ctx.globalAlpha = 0.55;
        const { bucketOf, bucketOrder, bucketCounts } = this;
        const n = cols * rows;
        const SKIP = bucketCounts.length - 1;
        bucketCounts.fill(0);
        for (let i = 0; i < n; i++) {
            const e = energy[i];
            const kind = dotKind[i];
            if (sharkFlag[i] || fishStamp[i] === frameId || (kind === 0 && e < 0.45)) {
                bucketOf[i] = SKIP;
                continue;
            }
            let bucket;
            if (e > 0.45) {
                const level = clamp(Math.floor((e - 0.45) * 5), 0, ALPHA_LEVELS - 1);
                bucket = WAKE * ALPHA_LEVELS + level;
            }
            else {
                const col = i % cols;
                const row = (i / cols) | 0;
                // Dots stay bright and crisp; the twinkle is a gentle breathe, not a fade.
                const twinkle = 0.5 + 0.5 * Math.sin(t * dotFreq[i] + dotPhase[i]);
                const caustic = 0.85 + 0.15 * Math.sin(col * 0.11 + t * 0.35) * Math.sin(row * 0.17 - t * 0.27);
                let v = clamp((0.55 + 0.45 * twinkle) * caustic + e * 2, 0, 1);
                if (sharkShadow[i])
                    v *= 0.2;
                bucket = (kind - 1) * ALPHA_LEVELS + clamp(Math.floor(v * ALPHA_LEVELS), 0, ALPHA_LEVELS - 1);
            }
            bucketOf[i] = bucket;
            bucketCounts[bucket]++;
        }
        // Counting sort cells by bucket.
        const starts = new Int32Array(bucketCounts.length);
        for (let b = 1; b < bucketCounts.length; b++)
            starts[b] = starts[b - 1] + bucketCounts[b - 1];
        const cursor = starts.slice();
        for (let i = 0; i < n; i++) {
            const b = bucketOf[i];
            if (b !== SKIP)
                bucketOrder[cursor[b]++] = i;
        }
        const small = Math.max(2, Math.round(cw * 0.19));
        const large = small + 1;
        for (let b = 0; b < SKIP; b++) {
            const count = bucketCounts[b];
            if (!count)
                continue;
            ctx.fillStyle = this.dotStyles[b];
            const size = b >= WAKE * ALPHA_LEVELS ? large : small;
            const start = starts[b];
            for (let k = start; k < start + count; k++) {
                const i = bucketOrder[k];
                const col = i % cols;
                const row = (i / cols) | 0;
                // Sit the dot low-right in its cell, as in the reference.
                if (this.mode === "type") {
                    ctx.fillStyle = this.pal.light ? "rgba(91,60,46,0.3)" : "rgba(164,195,209,0.3)";
                    ctx.fillText(".", col * cw + cw / 2, row * ch + ch / 2 + 1);
                }
                else {
                    ctx.fillRect(Math.round(col * cw + cw * 0.66 - size / 2), Math.round(row * ch + ch * 0.64 - size / 2), size, size);
                }
            }
        }
        ctx.restore();
    }
}


/* ===== engine.ts — ported from jiezi1234/character-ocean (MIT) ===== */
/** Adapted from stackedlol/ascii-sharks. See LICENSE.md and THIRD_PARTY_NOTICES.md. */
const STEP = 1 / 60;
const MAX_STEPS = 4;
/**
 * Wires World + AsciiRenderer to a canvas: fixed-timestep loop, resize,
 * pointer input, pausing off-screen, and prefers-reduced-motion.
 */
class OceanEngine {
    constructor(canvas, sharks) {
        this.canvas = canvas;
        this.raf = 0;
        this.last = 0;
        this.acc = 0;
        this.visible = true;
        this.disposed = false;
        this.paused = false;
        this.speed = 0.65;
        this.frame = (now) => {
            const dt = Math.min(0.1, (now - this.last) / 1000);
            this.last = now;
            this.acc += dt * this.speed;
            let steps = 0;
            while (this.acc >= STEP && steps < MAX_STEPS) {
                this.world.step(STEP);
                this.acc -= STEP;
                steps++;
            }
            if (steps === MAX_STEPS)
                this.acc = 0;
            this.renderer.render(this.world, dt);
            this.raf = requestAnimationFrame(this.frame);
        };
        this.onMotionPreference = () => {
            if (this.reducedMotion.matches) {
                cancelAnimationFrame(this.raf);
                this.drawStill();
            }
            else {
                this.schedule();
            }
        };
        // [GROUP-FISH] No pointer input: the wallpaper canvas is pointer-events:none,
        // so there is no ripple / touch interaction on the phone (perf first).
        this.world = new World(sharks);
        this.renderer = new AsciiRenderer(canvas);
        this.renderer.setFontFamily("ui-monospace, 'SF Mono', Menlo, Consolas, monospace");
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas);
        this.intersectionObserver = new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
            this.schedule();
        });
        this.intersectionObserver.observe(canvas);
        this.reducedMotion.addEventListener("change", this.onMotionPreference);
        this.resize();
        // Canvas text can't trigger a webfont load; once the mono face is in, redraw.
        document.fonts?.load("600 16px ui-monospace, Menlo, monospace").then(() => {
            if (!this.disposed && this.reducedMotion.matches)
                this.drawStill();
        });
        this.schedule();
    }
    setPaused(paused) {
        this.paused = paused;
        cancelAnimationFrame(this.raf);
        if (!paused)
            this.schedule();
    }
    setSpeed(speed) {
        this.speed = speed;
    }
    setRenderMode(mode) {
        this.renderer.setMode(mode);
        this.renderer.render(this.world, 0);
        if (mode === "hanzi") {
            document.fonts?.load("500 16px OceanHanzi").then(() => {
                if (!this.disposed)
                    this.renderer.render(this.world, 0);
            });
        }
    }
    setPalette(pal) {
        this.renderer.setPalette(pal);
        this.renderer.render(this.world, 0);
    }
    setSharks(sharks) {
        this.world = new World(sharks);
        this.acc = 0;
        this.resize();
        for (let i = 0; i < 150; i++)
            this.world.step(STEP);
        this.renderer.render(this.world, STEP);
    }
    destroy() {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1)
            return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.resize(rect.width, rect.height, dpr);
        this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
        if (this.reducedMotion.matches)
            this.drawStill();
    }
    schedule() {
        cancelAnimationFrame(this.raf);
        if (this.disposed || this.paused || !this.visible || this.reducedMotion.matches)
            return;
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
    }
    /** Reduced motion: let the ecosystem settle, then show a single frame. */
    drawStill() {
        if (this.world.time < 4) {
            for (let i = 0; i < 240; i++)
                this.world.step(STEP);
        }
        this.renderer.render(this.world, STEP);
    }
}

/* ===== FishWallpaper integration — phone-specific code written for this project ===== */
/* Mode labels / names / descriptions: wording reused from character-ocean src/app.ts (MIT). */
var FISH_MODES = [
    { id: "ascii", label: "ASCII", name: "ASCII 原始字符", desc: "等宽字符与灰色小格，保留最初的质感。" },
    { id: "type", label: "TYPE", name: "纯字符", desc: "用 @ # % R E A T 与标点的疏密，勾勒鱼身与光影。" },
    { id: "braille", label: "DOTS", name: "盲文点阵", desc: "用细密的点勾勒身体，轻盈、通透。" },
    { id: "blocks", label: "BLOCK", name: "方块阴影", desc: "用方块和阴影表达明暗，更厚实的像素感。" },
    { id: "geometry", label: "GEO", name: "几何符号", desc: "圆点、圆环、菱形与方块，组成几何鱼群。" },
    { id: "lines", label: "LINES", name: "线条编织", desc: "线条沿鱼身方向排列，像游动的编织线稿。" },
    { id: "hanzi", label: "HANZI", name: "汉字艺术", desc: "一、十、川、水、魚、鯊，以笔画疏密表现层次。" }
];
/* A quieter phone-scale roster: three different silhouettes rather than five giants. */
var FISH_ROSTER = [
    { kind: "whaleshark", size: 1 }, { kind: "manta", size: 0.76 },
    { kind: "sunfish", size: 0.66 }
];
var FISH_BG_PRESETS = [
    { id: "#ffffff", name: "白" },
    { id: "#faf6ef", name: "纸米" },
    { id: "#eef4fb", name: "浅蓝" },
    { id: "#eef7f2", name: "浅薄荷" },
    { id: "#f3eef7", name: "浅紫" },
    { id: "#0b3d5c", name: "深海蓝" }
];
/* Small-fish colours. Light bg: the original's light-theme presented colour —
   dark fish rgba(230,238,255,α) over the dark gradient, run through the
   light filter chain (invert + hue-rotate 180° + saturate .48, opacity .78
   over white), then solved back to one base RGB that reproduces those
   presented values over this phone's light gradient with the original
   alpha ramp [0.28, 0.42, 0.58, 0.74, 0.9]: α .28 → rgb(186,191,195),
   .42 → (163,167,172), .58 → (137,141,146), .74 → (110,114,119),
   .90 → (84,87,93). Dark bg: the original's dark value, unchanged. */
var FISH_INK = { r: 67, g: 65, b: 73 };
var FISH_FOAM = { r: 139, g: 182, b: 196 };

function fishHexRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 255, g: 255, b: 255 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function fishRelLum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function fishContrast(l1, l2) {
    var a = Math.max(l1, l2), b = Math.min(l1, l2);
    return (a + 0.05) / (b + 0.05);
}
/* Palette for one bg colour: light/dark is whichever fish colour contrasts better. */
function fishPaletteFor(bg) {
    var lum = fishRelLum(fishHexRgb(bg));
    var cInk = fishContrast(lum, fishRelLum(FISH_INK));
    var cFoam = fishContrast(lum, fishRelLum(FISH_FOAM));
    var light = cInk >= cFoam;
    return { bg: bg, light: light, fish: light ? "67,65,73" : "139,182,196", fishScale: light ? 1 : 0.85 };
}
function fishEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fishPrefs() {
    /* The phone's public prefs API (js/12, on window). js/00's loadPrefs/setPref
       are not global, so they are only a fallback here. */
    try { if (typeof window !== "undefined" && typeof window.getUiPrefs === "function") return window.getUiPrefs(); } catch (e) {}
    try { if (typeof loadPrefs === "function") return loadPrefs(); } catch (e) {}
    try { var raw = localStorage.getItem("phone_ui_prefs_v1"); if (raw) return JSON.parse(raw); } catch (e) {}
    return { wallpaper: "fish", fishStyle: "ascii", fishBg: "#ffffff", fishFollowTheme: false };
}
function fishSetPref(key, val) {
    try { if (typeof window !== "undefined" && typeof window.setUiPrefs === "function") { var patch = {}; patch[key] = val; window.setUiPrefs(patch); return; } } catch (e) {}
    try { if (typeof setPref === "function") { setPref(key, val); return; } } catch (e) {}
    try { var p = fishPrefs(); p[key] = val; localStorage.setItem("phone_ui_prefs_v1", JSON.stringify(p)); } catch (e) {}
}
/* Effective bg: follow-theme reads the current theme's shell colour (BuThemes),
   otherwise the user's chosen colour. Invalid values fall back to Guichao white. */
function fishEffectiveBg(p) {
    if (p && p.fishFollowTheme) {
        try {
            if (window.BuThemes && typeof window.BuThemes.shellBg === "function") {
                var c = window.BuThemes.shellBg();
                if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
            }
        } catch (e) {}
        return "#ffffff";
    }
    var bg = (p && p.fishBg) || "#ffffff";
    return /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : "#ffffff";
}
function fishModeById(id) {
    for (var i = 0; i < FISH_MODES.length; i++) if (FISH_MODES[i].id === id) return FISH_MODES[i];
    return FISH_MODES[0];
}

var FishWallpaper = {
    engine: null,
    canvas: null,
    shell: null,
    available: false,
    inited: false,
    lastStyle: null,
    lastBg: null,
    lastRunning: null,

    init: function () {
        if (this.inited) return;
        this.inited = true;
        this.canvas = document.getElementById("xwl-fish-canvas");
        this.shell = document.getElementById("sys-shell");
        if (!this.canvas || !this.shell) return;
        try {
            this.engine = new OceanEngine(this.canvas, FISH_ROSTER.map(function (s) { return { kind: s.kind, size: s.size }; }));
            this.available = true;
        } catch (e) {
            this.engine = null;
            this.available = false;
        }
        var self = this;
        try { document.addEventListener("visibilitychange", function () { self.sync(); }); } catch (e) {}
        try {
            if (typeof EventBus !== "undefined" && EventBus && typeof EventBus.on === "function") {
                EventBus.on("store:activeApp", function () { self.sync(); });
                EventBus.on("store:wallpaper", function (v) { self.onWallpaperStore(v); });
            }
        } catch (e) {}
        try {
            var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
            if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", function () { self.sync(); });
        } catch (e) {}
        this.sync();
    },

    /* A user image applied elsewhere (BeautifyEngine / camera "设为壁纸") writes a URL
       into SystemStore 'wallpaper'. The image wins over the fish: persist it as the
       prefs wallpaper so it survives applyPrefs, then re-sync. */
    onWallpaperStore: function (v) {
        if (typeof v === "string" && (v.indexOf("data:") === 0 || v.indexOf("http") === 0)) {
            var p = fishPrefs();
            if (p.wallpaper !== v) fishSetPref("wallpaper", v);
        }
        this.sync();
    },

    /* Central gate: canvas visibility, palette, style, and the run/pause decision.
       Idempotent — safe to call from every event (prefs, app open/close, tab
       visibility, reduced-motion, wallpaper store). */
    sync: function () {
        var p = fishPrefs();
        var active = !!(p && p.wallpaper === "fish");
        var imgOverride = false;
        try {
            if (typeof SystemStore !== "undefined" && SystemStore && typeof SystemStore.get === "function") {
                var w = SystemStore.get("wallpaper");
                imgOverride = typeof w === "string" && (w.indexOf("data:") === 0 || w.indexOf("http") === 0);
            }
        } catch (e) {}
        var show = active && !imgOverride;
        // Prefs are the source of truth: if the user (re)selected fish, a stale
        // image URL left in SystemStore by a path that bypassed applyPrefs (e.g.
        // a backup restore via setUiPrefs) must not keep the canvas hidden.
        // A real image is always in prefs first (loadPrefs migration +
        // onWallpaperStore persist it there), so this never discards one.
        if (active && imgOverride) {
            try { if (typeof SystemStore !== "undefined" && SystemStore && typeof SystemStore.set === "function") SystemStore.set("wallpaper", ""); } catch (e) {}
            imgOverride = false;
            show = true;
        }
        if (this.shell) this.shell.classList.toggle("fish-on", show);
        if (this.shell) this.shell.classList.toggle("fish-ocean-default", show && fishEffectiveBg(p).toLowerCase() === "#ffffff");
        if (show) {
            var bg = fishEffectiveBg(p);
            if (bg !== this.lastBg) {
                this.lastBg = bg;
                if (this.engine) { try { this.engine.setPalette(fishPaletteFor(bg)); } catch (e) {} }
            }
            /* Keep the shell background (the canvas's underlay / fallback) on the
               same colour. applyPrefs does this too when it runs; sync() covers
               the paths that change prefs without applyPrefs (setUiPrefs). */
            if (this.shell) { try { this.shell.style.backgroundColor = bg; } catch (e) {} }
            var style = (p && p.fishStyle) || "ascii";
            if (style !== this.lastStyle) {
                this.lastStyle = style;
                if (this.engine) { try { this.engine.setRenderMode(fishModeById(style).id); } catch (e) {} }
            }
        }
        var appOpen = false;
        try {
            if (typeof AppManager !== "undefined" && AppManager && typeof AppManager.getActiveId === "function") {
                appOpen = !!AppManager.getActiveId();
            } else if (typeof SystemStore !== "undefined" && SystemStore && typeof SystemStore.get === "function") {
                appOpen = !!SystemStore.get("activeApp");
            }
        } catch (e) {}
        var reduced = false;
        try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
        var hidden = false;
        try { hidden = !!document.hidden; } catch (e) {}
        /* Run only on desktop/lockscreen, foreground, no app open, motion allowed.
           Reduced motion: the engine itself paints one settled frame (drawStill). */
        var shouldRun = show && !hidden && !appOpen && !reduced;
        if (this.engine && shouldRun !== this.lastRunning) {
            this.lastRunning = shouldRun;
            try { this.engine.setPaused(!shouldRun); } catch (e) {}
        }
    },

    setOpt: function (key, val) {
        if (key === "style") {
            if (!fishModeById(val) || fishModeById(val).id !== val) return;
            fishSetPref("fishStyle", val);
        } else if (key === "bg") {
            this.setBg(val);
            return;
        }
        this.sync();
    },
    toggleOpt: function (key) {
        if (key === "followTheme") {
            var p = fishPrefs();
            fishSetPref("fishFollowTheme", !(p && p.fishFollowTheme));
        }
        this.sync();
    },
    /* A manual colour always wins over follow-theme. */
    setBg: function (color) {
        if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
        fishSetPref("fishBg", color);
        fishSetPref("fishFollowTheme", false);
        this.sync();
    },

    currentBg: function () { return fishEffectiveBg(fishPrefs()); },
    paletteFor: fishPaletteFor,
    isActive: function () { var p = fishPrefs(); return !!(p && p.wallpaper === "fish"); },

    /* Settings block, shown under the wallpaper picker while 游鱼 is selected.
       Reuses the existing .gw-seg / .gw-swatch / .gw-set-row / .gw-switch styles. */
    settingsHTML: function (p) {
        var style = (p && p.fishStyle) || "ascii";
        var follow = !!(p && p.fishFollowTheme);
        var cur = (p && p.fishBg) || "#ffffff";
        if (!/^#[0-9a-fA-F]{6}$/.test(cur)) cur = "#ffffff";
        var h = "";
        h += '<div class="gw-set-h">游鱼</div>';
        h += '<div class="gw-set-row"><div class="lb">字符风格<div class="sub">' + fishEsc(fishModeById(style).name + "：" + fishModeById(style).desc) + '</div></div></div>';
        h += '<div class="gw-seg">' + FISH_MODES.map(function (m) {
            return '<button data-fish-set="style" data-v="' + m.id + '" class="' + (style === m.id ? "on" : "") + '">' + m.label + '</button>';
        }).join("") + '</div>';
        h += '<div class="gw-set-row"><div class="lb">底色<div class="sub">浅底深鱼、深底浅鱼，任何底色都看得清。' + (follow ? '当前跟随主题。' : '点色块换底色，右边取色器可自定。') + '</div></div></div>';
        h += '<div class="gw-seg">' + FISH_BG_PRESETS.map(function (b) {
            return '<button class="gw-swatch' + ((!follow && cur === b.id) ? " on" : "") + '" data-fish-set="bg" data-v="' + b.id + '" style="background:' + b.id + '" title="' + fishEsc(b.name) + '" aria-label="底色' + fishEsc(b.name) + '"></button>';
        }).join("") + '<input type="color" id="gw-fish-color" value="' + fishEsc(cur) + '" aria-label="自定义底色" title="自定义底色">' + '</div>';
        h += '<div class="gw-set-row"><div class="lb">跟随主题<div class="sub">开：底色跟当前主题走；关：用上面选的底色。</div></div><button class="gw-switch' + (follow ? " on" : "") + '" data-fish-toggle="followTheme" aria-label="跟随主题"></button></div>';
        h += '<div class="gw-set-row"><div class="lb">关于游鱼<div class="sub">直接复用 jiezi1234/character-ocean 与 stackedlol/ascii-sharks（均为 MIT），按手机改写；底色不跟随主题时以此处为准。</div></div></div>';
        return h;
    }
};
window.FishWallpaper = FishWallpaper;
/* Start now: the script loads after js/00, so prefs / SystemStore / EventBus exist. */
try { FishWallpaper.init(); } catch (e) {}
})();
