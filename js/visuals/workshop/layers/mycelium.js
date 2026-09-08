// ── Mycelium ──────────────────────────────────────────────────────────────
// Growing fungal network: hyphal tips wander and branch on a persistent canvas.
// Bass triggers spore bursts, mid shifts hue, treble adds tip turbulence.
// Fruit bodies bloom at dead tips; spore particles drift upward.

const _state = new WeakMap();

const _mycelGlowCache = new Map();
function _mycelGlow(hue, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(4, Math.round(radius / 3) * 3);
    const key = `${hb}_${rb}`;
    if (_mycelGlowCache.has(key)) return _mycelGlowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},90%,80%)`);
    g.addColorStop(1, `hsla(${hb},80%,50%,0)`);
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _mycelGlowCache.set(key, gc);
    return gc;
}

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

class MyceliumViz {
    constructor(w, h) {
        this.U = Math.min(w, h);
        this.tips = [];
        this.fruits = [];
        this.spores = [];
        this.lastBass = 0;
        this.beatCooldown = 0;
        this._seedCluster(w/2, h/2, w, h, 5);
    }

    _seedCluster(x, y, w, h, n) {
        const hue = 60 + Math.random()*120;
        for (let k = 0; k < n; k++) {
            const ang = Math.random()*6.28;
            this.tips.push({ x, y, ang, hue, gen: 0, life: 2 + Math.random()*3, maxLife: 2+Math.random()*3 });
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        const U = this.U;
        const growth    = p.growth ?? 1;
        const branchProb = p.branch ?? 0.03;
        const fade      = p.fade ?? 0.01;
        const glowAmt   = p.glow ?? 1;
        const maxGen    = Math.round(p.maxGen ?? 5);
        const hueBase   = p.hue ?? 120;
        const spread    = p.spread ?? 1;

        // Trail fade
        ctx.fillStyle = `rgba(3,6,4,${Math.max(0.003, fade)})`;
        ctx.fillRect(0, 0, w, h);

        this.beatCooldown = Math.max(0, this.beatCooldown - dt);

        // Bass beat → spore burst
        if (bass > 0.55 && bass > this.lastBass + 0.08 && this.beatCooldown < 0.01) {
            this.beatCooldown = 0.25;
            const sx = w*0.15 + Math.random()*w*0.7;
            const sy = h*0.15 + Math.random()*h*0.7;
            this._seedCluster(sx, sy, w, h, 3 + (bass*6|0));
            // Spore particles
            for (let k = 0; k < 12; k++) {
                this.spores.push({ x: sx, y: sy, vx: (Math.random()-0.5)*3, vy: -(1+Math.random()*2), life: 1, hue: hueBase + mid*60 });
            }
        }
        this.lastBass = bass;

        // Mid shifts hue drift
        const hueShift = mid * 80;

        const grow = [];
        const buckets = [];

        for (let ti = 0; ti < this.tips.length; ti++) {
            const tp = this.tips[ti];
            tp.ang += (Math.random()-0.5) * 0.7 * (1 + treble * 2) * spread;
            const step = U * 0.0035 * growth * (1 + bass * 0.8);
            const nx = tp.x + Math.cos(tp.ang)*step;
            const ny = tp.y + Math.sin(tp.ang)*step;

            tp.life -= dt;
            if (tp.life <= 0) {
                this.fruits.push({ x: tp.x, y: tp.y, hue: tp.hue + hueShift, r: 0, maxR: U*0.006*(1+Math.random()*0.5), life: 3 });
                continue;
            }

            const gk = Math.min(maxGen, tp.gen);
            if (!buckets[gk]) buckets[gk] = { hue: tp.hue + hueShift, segs: [] };
            buckets[gk].segs.push(tp.x, tp.y, nx, ny);
            tp.x = nx; tp.y = ny;

            // Wrap
            if (tp.x < 0) tp.x = w; if (tp.x > w) tp.x = 0;
            if (tp.y < 0) tp.y = h; if (tp.y > h) tp.y = 0;

            // Branch
            if (Math.random() < branchProb * (1 + bass * 2) && tp.gen < maxGen) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                grow.push({ x: nx, y: ny, ang: tp.ang + dir*(0.3+Math.random()*0.5), hue: tp.hue, gen: tp.gen+1, life: 1+Math.random()*2, maxLife: 1+Math.random()*2 });
            }
            grow.push(tp);
        }

        // Draw hyphae
        if (glowAmt > 0.05) ctx.shadowBlur = 0;
        for (let gk = 0; gk <= maxGen; gk++) {
            const b = buckets[gk];
            if (!b || !b.segs.length) continue;
            const hue2 = (hueBase + b.hue * 0.3 + hueShift) % 360;
            ctx.strokeStyle = `hsla(${hue2},70%,${42+gk*5}%,0.75)`;
            ctx.lineWidth = Math.max(0.4, 1.8 - gk*0.28);
            if (glowAmt > 0.05)            ctx.beginPath();
            for (let i = 0; i < b.segs.length; i+=4) { ctx.moveTo(b.segs[i],b.segs[i+1]); ctx.lineTo(b.segs[i+2],b.segs[i+3]); }
            ctx.stroke();
        }
        if (glowAmt > 0.05) ctx.shadowBlur = 0;

        // Fruits bloom
        ctx.globalCompositeOperation = "lighter";
        for (let i = this.fruits.length-1; i >= 0; i--) {
            const f = this.fruits[i];
            f.r = Math.min(f.maxR, f.r + f.maxR*dt*0.5);
            f.life -= dt;
            if (f.life <= 0) { this.fruits.splice(i,1); continue; }
            const alpha = Math.min(1, f.life * 0.5);
            const gs = _mycelGlow(f.hue, f.r * 3);
            ctx.globalAlpha = alpha * 0.8;
            ctx.drawImage(gs, f.x - gs.width/2, f.y - gs.height/2);
            ctx.globalAlpha = 1;
        }

        // Spore particles
        for (let i = this.spores.length-1; i >= 0; i--) {
            const sp2 = this.spores[i];
            sp2.x += sp2.vx; sp2.y += sp2.vy; sp2.vy += 0.05; sp2.life -= dt*0.5;
            if (sp2.life <= 0) { this.spores.splice(i,1); continue; }
            ctx.fillStyle = `hsla(${sp2.hue},80%,80%,${sp2.life*0.7})`;
            ctx.beginPath(); ctx.arc(sp2.x, sp2.y, 1.5, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        this.tips = grow;
        if (this.tips.length > 800) this.tips.splice(0, this.tips.length - 800);
    }
}

export const myceliumParams = () => ({
    growth:      { base: 1,    min: 0.1,  max: 3,    mod: { source: "" } },
    branch:      { base: 0.03, min: 0,    max: 0.2,  mod: { source: "" } },
    maxGen:      { base: 5,    min: 1,    max: 8,    mod: { source: "" } },
    spread:      { base: 1,    min: 0.1,  max: 3,    mod: { source: "" } },
    glow:        { base: 1.2,  min: 0,    max: 4,    mod: { source: "" } },
    fade:        { base: 0.01, min: 0.001,max: 0.1,  mod: { source: "" } },
    hue:         { base: 120,  min: 0,    max: 360,  mod: { source: "" } },
    fruitScale:  { base: 1,    min: 0,    max: 3,    mod: { source: "" } },
    sporeCount:  { base: 12,   min: 0,    max: 40,   mod: { source: "" } },
    density:     { base: 800,  min: 100,  max: 2000, mod: { source: "" } },
});

export function drawMycelium(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz || viz.U !== Math.min(w, h)) { viz = new MyceliumViz(w, h); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, bassLevel(s), midLevel(s), trebleLevel(s));
}
