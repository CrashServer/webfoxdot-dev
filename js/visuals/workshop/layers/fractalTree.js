// ── Fractal Tree ──────────────────────────────────────────────────────────────
// Recursively branching tree with per-depth wind sway, seasonal leaf coloring,
// and bioluminescent blossom tips. Segments batched by depth for O(depth) draw
// calls. Bass triggers gusts and thickens branches; mid shifts leaf hue;
// treble adds extra branching and brightens the tip glow.

const _state = new WeakMap();

class TreeViz {
    constructor() {
        this.t        = 0;
        this.gust     = 0;
        this.seed     = Math.random() * 100;
        this.spreadVar = Math.random() * 0.2;
        this._segs    = [];
        this._leaves  = [];
        this._blossoms = [];
        this.prevBass = 0;
        this.prevTreble = 0;
        this.pulse    = 0;
        this.treblePulse = 0;
        this.leafHueShift = 0;
    }

    branch(x, y, len, ang, depth, maxDepth, sway, branchAngle, extraBranch) {
        if (depth <= 0 || len < 1.5) {
            this._leaves.push(x, y, Math.max(1.2, len * 0.7));
            if (this.treblePulse > 0.3 && Math.random() < this.treblePulse * 0.4) {
                this._blossoms.push(x, y, Math.max(2, len * 0.9));
            }
            return;
        }
        // Wind: per-depth phase offset creates organic sway
        const windFreq = 1.2 + depth * 0.15;
        const s = Math.sin(this.t * windFreq + depth * 0.7 + this.seed) * sway * (1 - depth / (maxDepth + 2));
        const a = ang + s;
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;

        let bucket = this._segs[depth];
        if (!bucket) { bucket = []; this._segs[depth] = bucket; }
        bucket.push(x, y, ex, ey);

        const spread = branchAngle + this.spreadVar * Math.sin(this.seed + depth);
        const ratio  = 0.72 + 0.04 * Math.sin(this.seed * 2 + depth);
        this.branch(ex, ey, len * ratio, a - spread, depth - 1, maxDepth, sway, branchAngle, extraBranch);
        this.branch(ex, ey, len * ratio, a + spread, depth - 1, maxDepth, sway, branchAngle, extraBranch);
        // Extra mid-branch for denser canopy, boosted by treble
        if (depth % 3 === 0 || (extraBranch && depth % 2 === 0)) {
            this.branch(ex, ey, len * 0.48, a + (this.seed % 1 - 0.5) * 0.8, depth - 2, maxDepth, sway, branchAngle, extraBranch);
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        this.t += (1 / 60) * (p.windSpeed ?? 1);
        const depth       = Math.max(4, Math.min(12, p.depth | 0 || 9));
        const branchAngle = Math.max(0.1, Math.min(1.2, p.branchAngle ?? 0.38));
        const sway        = (p.sway ?? 0.15) + this.gust * 0.3 + mid * 0.08;
        const leafHue     = (p.leafHue ?? 110) + mid * 80 + this.leafHueShift;
        const trunkHue    = p.trunkHue ?? 22;
        const glowAmt     = (p.leafGlow ?? 1.2) + treble * 1.5 + this.treblePulse;
        const extraBranch = treble > 0.4;

        // Bass beat: gust + pulse
        if (bass > 0.5 && bass > this.prevBass + 0.07) {
            this.pulse = 1;
            this.gust  = Math.max(this.gust, 0.8 + bass * 0.6);
            this.spreadVar = Math.random() * 0.25;
        }
        this.prevBass = bass;

        // Treble: blossom burst
        if (treble > 0.55 && treble > this.prevTreble + 0.08) {
            this.treblePulse = treble;
            this.leafHueShift = (Math.random() - 0.5) * 60;
        }
        this.prevTreble = treble;
        this.pulse      *= 0.84;
        this.treblePulse *= 0.88;
        this.gust        *= 0.91;
        this.leafHueShift *= 0.96;

        ctx.fillStyle = `rgba(3,5,9,${p.bgFade ?? 0.45})`;
        ctx.fillRect(0, 0, w, h);

        for (let d = 0; d <= depth; d++) { if (this._segs[d]) this._segs[d].length = 0; }
        this._leaves.length = 0;
        this._blossoms.length = 0;

        // Trunk height scales with audio and canvas
        const baseLen = Math.min(w, h) * (0.11 + bass * 0.025 + this.pulse * 0.02);
        this.branch(w / 2, h * 0.97, baseLen, -Math.PI / 2, depth, depth, sway, branchAngle, extraBranch);

        ctx.lineCap = 'round';
        // Draw branches per depth: deeper = brighter, thinner, more colored
        for (let d = depth; d >= 1; d--) {
            const bucket = this._segs[d];
            if (!bucket || !bucket.length) continue;
            const depthFrac = d / depth;
            const hue   = trunkHue + d * 4;
            const sat   = 30 + d * 5;
            const lum   = 14 + d * 3.5 + this.pulse * 12 * (1 - depthFrac);
            const thick = Math.max(0.5, (d * 0.95) * (1 + bass * 0.5 * depthFrac + this.pulse * depthFrac * 0.6));
            ctx.strokeStyle = `hsl(${hue},${sat}%,${lum}%)`;
            ctx.lineWidth   = thick;
            ctx.beginPath();
            for (let i = 0; i < bucket.length; i += 4) {
                ctx.moveTo(bucket[i], bucket[i + 1]);
                ctx.lineTo(bucket[i + 2], bucket[i + 3]);
            }
            ctx.stroke();
        }

        // Leaves — glow pass
        const leafColor = `hsl(${leafHue},${78 + treble * 18}%,${50 + treble * 20}%)`;
        ctx.shadowBlur = 0;
        ctx.fillStyle   = leafColor;
        ctx.beginPath();
        for (let i = 0; i < this._leaves.length; i += 3) {
            const r = this._leaves[i + 2];
            ctx.moveTo(this._leaves[i] + r, this._leaves[i + 1]);
            ctx.arc(this._leaves[i], this._leaves[i + 1], r, 0, Math.PI * 2);
        }
        ctx.fill();

        // Blossoms — treble-triggered bright burst tips
        if (this._blossoms.length > 0) {
            const blossomColor = `hsl(${leafHue + 60},100%,85%)`;
            ctx.shadowBlur = 0;
            ctx.fillStyle   = blossomColor;
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            for (let i = 0; i < this._blossoms.length; i += 3) {
                const r = this._blossoms[i + 2];
                ctx.moveTo(this._blossoms[i] + r, this._blossoms[i + 1]);
                ctx.arc(this._blossoms[i], this._blossoms[i + 1], r, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.shadowBlur = 0;
    }
}

export const fractalTreeParams = () => ({
    depth:       { base: 9,    min: 4,   max: 12,  mod: { source: "" } },
    branchAngle: { base: 0.38, min: 0.1, max: 1.2, mod: { source: "" } },
    windSpeed:   { base: 1,    min: 0,   max: 5,   mod: { source: "" } },
    sway:        { base: 0.15, min: 0,   max: 0.8, mod: { source: "" } },
    leafHue:     { base: 110,  min: 0,   max: 360, mod: { source: "" } },
    trunkHue:    { base: 22,   min: 0,   max: 60,  mod: { source: "" } },
    leafGlow:    { base: 1.2,  min: 0,   max: 4,   mod: { source: "" } },
    bgFade:      { base: 0.45, min: 0.05,max: 1,   mod: { source: "" } },
});

export function drawFractalTree(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new TreeViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
