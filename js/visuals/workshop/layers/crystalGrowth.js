// ── Crystal Growth ─────────────────────────────────────────────────────────────
// Dendritic crystalline arms grow from seeded nucleation points with temperature-
// dependent branching. Faceted lattice segments freeze in place as a persistent
// trail. Bass triggers new nucleation bursts; mid shifts crystal color temperature;
// treble boosts the glow corona around growing tips.

const _state = new WeakMap();

function hsl(h, s, l, a = 1) {
    return `hsla(${(h % 360 + 360) % 360},${s}%,${l}%,${a})`;
}

class CrystalViz {
    constructor(w, h) {
        this.U = Math.min(w, h);
        this.tips = [];
        this.lastBeatIdx = -1;
        this.idleT = 0;
        this.pulse = 0;
        this.prevBass = 0;
        this.prevMid = 0;
        this.hueShift = 0;
        this.temperature = 1;
    }

    seed(w, h, sym, hueBase, temperature) {
        // nucleation point — scatter within inner 60% of canvas
        const cx = w * 0.2 + Math.random() * w * 0.6;
        const cy = h * 0.2 + Math.random() * h * 0.6;
        const hue = hueBase + Math.random() * 40 - 20;
        const numArms = sym | 0;
        for (let k = 0; k < numArms; k++) {
            const baseAng = (k / numArms) * Math.PI * 2;
            // temperature affects initial angle jitter — hotter = messier
            const jitter = temperature * 0.15;
            this.tips.push({
                x: cx, y: cy,
                ang: baseAng + (Math.random() - 0.5) * jitter,
                len: 0, gen: 0, hue, w: this.U * 0.007,
                facetPhase: Math.random() * Math.PI * 2,
                growthRate: 0.8 + Math.random() * 0.4,
            });
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const U = this.U;
        const growth      = p.growth      ?? 1;
        const branch      = p.branch      ?? 0.025;
        const glow        = p.glow        ?? 1.5;
        const fade        = p.fade        ?? 0.008;
        const sym         = Math.max(2, Math.min(16, p.symmetry | 0 || 6));
        const hueBase     = p.hue         ?? 195;
        const hueRange    = p.hueRange    ?? 80;
        const maxTips     = Math.max(40, p.maxCrystals | 0 || 160);
        const temperature = Math.max(0.1, Math.min(3, p.temperature ?? 1));
        const interval    = Math.max(0.3, p.interval ?? 3);
        const facets      = p.facets > 0.5;

        // Bass beat: nucleate new crystal
        if (bass > 0.55 && bass > this.prevBass + 0.08) {
            this.pulse = 1;
            if (this.tips.length < maxTips) this.seed(w, h, sym, hueBase, temperature);
        }
        this.prevBass = bass;
        // Mid pulse: color temperature shift
        if (mid > 0.5 && mid > this.prevMid + 0.1) this.hueShift = mid * 50;
        this.prevMid = mid;
        this.hueShift *= 0.93;
        this.pulse *= 0.82;
        this.temperature += (temperature - this.temperature) * 0.05;

        // Periodic seeding
        const beatIdx = Math.floor(t / interval);
        if (beatIdx !== this.lastBeatIdx) {
            this.lastBeatIdx = beatIdx;
            if (this.tips.length < maxTips) this.seed(w, h, sym, hueBase, temperature);
        }
        this.idleT += 1 / 60;
        if (this.idleT > 2.5 && this.tips.length === 0) { this.idleT = 0; this.seed(w, h, sym, hueBase, temperature); }

        // Persistent trail fade
        ctx.fillStyle = `rgba(2,4,14,${fade})`;
        ctx.fillRect(0, 0, w, h);

        const buckets = [];
        const nextGen = [];

        for (let ti = 0; ti < this.tips.length; ti++) {
            const tp = this.tips[ti];
            // Temperature modulates step size — hotter crystals grow faster but branch more
            const tempBoost = 1 + (this.temperature - 1) * 0.4;
            const step = U * 0.0038 * growth * tp.growthRate * tempBoost
                * (1 + bass * 0.9 + this.pulse * 1.4);

            // Faceted growth: quantize angle to crystal lattice if enabled
            let ang = tp.ang;
            if (facets) {
                const snap = Math.PI / (sym * 2);
                const snapped = Math.round(ang / snap) * snap;
                ang = ang + (snapped - ang) * 0.3;
                tp.ang = ang;
            }

            const nx = tp.x + Math.cos(ang) * step;
            const ny = tp.y + Math.sin(ang) * step;
            tp.x = nx; tp.y = ny; tp.len += step;

            const progress = Math.min(1, tp.len / (U * 0.18));
            const alpha = 0.4 + 0.6 * progress;
            const gk = Math.min(4, tp.gen);

            if (!buckets[gk]) {
                buckets[gk] = {
                    hue: tp.hue + this.hueShift,
                    lw: Math.max(0.4, tp.w * (1 - gk * 0.16)),
                    segs: [], tips: [], aSum: 0, n: 0,
                };
            }
            buckets[gk].segs.push(tp.x - Math.cos(ang) * step, tp.y - Math.sin(ang) * step, nx, ny);
            buckets[gk].tips.push(nx, ny, tp.w * (0.7 - gk * 0.12));
            buckets[gk].aSum += alpha;
            buckets[gk].n++;

            // Terminate: out of bounds or max length
            const maxLen = U * (0.20 - tp.gen * 0.025);
            if (nx < 0 || nx > w || ny < 0 || ny > h || tp.len > maxLen) continue;

            // Branching: temperature increases branch probability
            const branchProb = branch * (1 + (this.temperature - 1) * 0.5);
            if (Math.random() < branchProb && tp.gen < 4) {
                // Crystal lattice angles: ±60° for hexagonal, ±45° for square, etc.
                const branchAngle = (Math.PI / sym) * (0.8 + Math.random() * 0.5);
                nextGen.push(
                    { x: nx, y: ny, ang: ang + branchAngle,  len: 0, gen: tp.gen + 1, hue: tp.hue + hueRange * 0.3, w: tp.w * 0.75, facetPhase: tp.facetPhase, growthRate: tp.growthRate * 0.85 },
                    { x: nx, y: ny, ang: ang - branchAngle, len: 0, gen: tp.gen + 1, hue: tp.hue - hueRange * 0.15, w: tp.w * 0.75, facetPhase: tp.facetPhase, growthRate: tp.growthRate * 0.85 }
                );
            }
            nextGen.push(tp);
        }

        // Render batched by generation
        const glowAmt = glow + treble * 2.5 + this.pulse * 1.2;
        if (glowAmt > 0.05) ctx.shadowBlur = 0;

        for (let gk = 0; gk < 5; gk++) {
            const b = buckets[gk];
            if (!b || !b.segs.length) continue;
            const avgA = b.aSum / b.n;
            const lum = 55 - gk * 5 + this.pulse * 18;
            const sat = 75 + this.pulse * 15;
            ctx.strokeStyle = hsl(b.hue, sat, lum, avgA);
            ctx.lineWidth = b.lw;
            ctx.beginPath();
            for (let i = 0; i < b.segs.length; i += 4) {
                ctx.moveTo(b.segs[i], b.segs[i + 1]);
                ctx.lineTo(b.segs[i + 2], b.segs[i + 3]);
            }
            ctx.stroke();
            // Bright tip dots
            ctx.fillStyle = hsl(b.hue, 100, 88, avgA * 0.9);
            ctx.beginPath();
            for (let i = 0; i < b.tips.length; i += 3) {
                const r = Math.max(0.4, b.tips[i + 2]);
                ctx.moveTo(b.tips[i] + r, b.tips[i + 1]);
                ctx.arc(b.tips[i], b.tips[i + 1], r, 0, Math.PI * 2);
            }
            ctx.fill();
        }
        if (glowAmt > 0.05) ctx.shadowBlur = 0;

        this.tips = nextGen;
        if (this.tips.length > maxTips * 1.5) this.tips.splice(0, this.tips.length - maxTips);
    }
}

export const crystalGrowthParams = () => ({
    growth:      { base: 1,     min: 0.1, max: 4,    mod: { source: "" } },
    branch:      { base: 0.025, min: 0,   max: 0.2,  mod: { source: "" } },
    temperature: { base: 1,     min: 0.1, max: 3,    mod: { source: "" } },
    symmetry:    { base: 6,     min: 2,   max: 16,   mod: { source: "" } },
    hue:         { base: 195,   min: 0,   max: 360,  mod: { source: "" } },
    hueRange:    { base: 80,    min: 0,   max: 200,  mod: { source: "" } },
    glow:        { base: 1.5,   min: 0,   max: 4,    mod: { source: "" } },
    fade:        { base: 0.008, min: 0.001, max: 0.12, mod: { source: "" } },
    interval:    { base: 3,     min: 0.3, max: 10,   mod: { source: "" } },
    maxCrystals: { base: 160,   min: 20,  max: 400,  mod: { source: "" } },
    facets:      { base: 0,     min: 0,   max: 1,    mod: { source: "" } },
});

export function drawCrystalGrowth(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz || Math.abs(viz.U - Math.min(w, h)) > 10) {
        viz = new CrystalViz(w, h);
        _state.set(ctx, viz);
    }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
