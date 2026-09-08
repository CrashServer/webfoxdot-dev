// ── Rhizome ───────────────────────────────────────────────────────────────
// Drifting nodes self-wire when close, data pulses travel the edges.
// Audio drives: link distance, pulse rate, node size/glow, wander chaos,
// and a hue drift so the whole network shifts colour on loud transients.

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

function makeNode() {
    return { x: 0, y: 0, vx: rnd(-14, 14), vy: rnd(-14, 14), r: rnd(2, 6), ph: rnd(0, 6.28), hOff: rnd(-30, 30) };
}

class RhizomeViz {
    constructor() {
        this.nodes  = [];
        this.pulses = [];
        this._n     = 0;
        this._init  = false;
    }

    _syncCount(n, w, h) {
        while (this.nodes.length < n) {
            const nd = makeNode();
            nd.x = this._init ? rnd(0, w) : 0; nd.y = this._init ? rnd(0, h) : 0;
            this.nodes.push(nd);
        }
        if (this.nodes.length > n) this.nodes.length = n;
        this._n = n;
    }

    frame(ctx, w, h, p, t, audio, bass) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;

        const n           = Math.max(5, Math.min(80, Math.round(p.nodeCount  ?? 54)));
        const speed       = p.speed      ?? 1;
        const hue         = (p.hue       ?? 175) | 0;
        const linkMult    = p.linkDist   ?? 1;
        const nodeSize    = p.nodeSize   ?? 1;
        const glow        = p.glow       ?? 1;
        const pulseSpeed  = p.pulseSpeed ?? 1;
        const wander      = p.wander     ?? 1;
        const fade        = p.fade       ?? 0.22;
        const maxPulses   = Math.round((p.pulseCount ?? 1) * 60);

        this._syncCount(n, w, h);
        if (!this._init) {
            for (const nd of this.nodes) { nd.x = rnd(0, w); nd.y = rnd(0, h); }
            this._init = true;
        }

        // Audio drives link distance expansion + hue drift
        const linkR   = Math.min(w, h) * (0.14 + linkMult * 0.05) * (1 + audio * 0.45);
        const hueDrift = audio * 35; // whole network shifts hue on loud audio
        const pulseProb = 0.0005 + audio * 0.008 + bass * 0.012;

        ctx.fillStyle = `rgba(2,5,10,${fade})`;
        ctx.fillRect(0, 0, w, h);

        // ── Move nodes ───────────────────────────────────────────────────
        for (const nd of this.nodes) {
            // Bass injects a directional kick from each node's current heading
            const kick = bass * 28 * wander;
            nd.vx += (rnd(-4, 4) * wander + Math.cos(nd.ph * 2) * kick) * dt;
            nd.vy += (rnd(-4, 4) * wander + Math.sin(nd.ph * 2) * kick) * dt;
            const maxV = 22 * speed;
            nd.vx = Math.max(-maxV, Math.min(maxV, nd.vx));
            nd.vy = Math.max(-maxV, Math.min(maxV, nd.vy));
            nd.x += nd.vx * dt * speed; nd.y += nd.vy * dt * speed;
            if (nd.x < 0 || nd.x > w) nd.vx *= -1;
            if (nd.y < 0 || nd.y > h) nd.vy *= -1;
            nd.x = Math.max(0, Math.min(w, nd.x));
            nd.y = Math.max(0, Math.min(h, nd.y));
            nd.ph += dt * 2.5;
        }

        // ── Connections ──────────────────────────────────────────────────
        // Batch edges into 3 alpha buckets to reduce strokeStyle changes
        const BUCKETS = 3;
        const bucketPaths = [[], [], []];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = this.nodes[i], b = this.nodes[j];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d >= linkR) continue;
                const tf = 1 - d / linkR;
                bucketPaths[Math.min(BUCKETS - 1, (tf * BUCKETS) | 0)].push(a.x, a.y, b.x, b.y);
                if (Math.random() < pulseProb && this.pulses.length < maxPulses) {
                    this.pulses.push({ ai: i, bi: j, t: 0 });
                }
            }
        }
        const alphas = [0.18 + audio * 0.1, 0.32 + audio * 0.15, 0.55 + audio * 0.25];
        const lws    = [0.5, 1.0, 1.6 + audio * 0.6];
        const edgeHue = (hue + hueDrift) % 360;
        for (let b = 0; b < BUCKETS; b++) {
            const segs = bucketPaths[b];
            if (!segs.length) continue;
            ctx.strokeStyle = `hsla(${edgeHue},75%,62%,${alphas[b]})`;
            ctx.lineWidth   = lws[b];
            ctx.beginPath();
            for (let k = 0; k < segs.length; k += 4) {
                ctx.moveTo(segs[k], segs[k + 1]);
                ctx.lineTo(segs[k + 2], segs[k + 3]);
            }
            ctx.stroke();
        }

        // ── Data pulses ──────────────────────────────────────────────────
        const pr = (hue + hueDrift + 60) % 360;
        ctx.fillStyle = `hsla(${pr},100%,88%,0.92)`;
        ctx.beginPath();
        const pSize = 2 + audio * 1.5;
        for (const pl of this.pulses) {
            pl.t += dt * 1.6 * pulseSpeed * (1 + audio * 0.4);
            const a = this.nodes[pl.ai], b = this.nodes[pl.bi];
            const px = a.x + (b.x - a.x) * pl.t, py = a.y + (b.y - a.y) * pl.t;
            ctx.moveTo(px + pSize, py); ctx.arc(px, py, pSize, 0, 6.28);
        }
        ctx.fill();
        this.pulses = this.pulses.filter((pl) => pl.t < 1);
        if (this.pulses.length > maxPulses) this.pulses.splice(0, this.pulses.length - maxPulses);

        // ── Nodes ────────────────────────────────────────────────────────
        // Glow is set once; we only vary fill color + radius per node
        ctx.shadowBlur = 0;
        for (const nd of this.nodes) {
            const r  = nd.r * nodeSize * (1 + 0.25 * Math.sin(nd.ph) + audio * 0.6 + bass * 0.5);
            const nh = ((hue + nd.hOff + hueDrift) % 360 + 360) % 360;
            ctx.fillStyle  = `hsla(${nh},88%,66%,0.88)`;
            ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, 6.28); ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

function audioLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    let s = 0; for (let i = 0; i < spectrum.length; i++) s += spectrum[i];
    return Math.min(1, (s / spectrum.length) * 3);
}

function bassLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    const blen = Math.max(1, (spectrum.length * 0.18) | 0);
    let s = 0; for (let i = 0; i < blen; i++) s += spectrum[i];
    return Math.min(1, (s / blen) * 3);
}

export const rhizomeParams = () => ({
    hue:        { base: 175,  min: 0,    max: 360, mod: { source: "" } },
    nodeCount:  { base: 54,   min: 5,    max: 80,  mod: { source: "" } },
    nodeSize:   { base: 1,    min: 0.2,  max: 4,   mod: { source: "" } },
    speed:      { base: 1,    min: 0.1,  max: 4,   mod: { source: "" } },
    wander:     { base: 1,    min: 0,    max: 3,   mod: { source: "" } },
    linkDist:   { base: 1,    min: 0,    max: 4,   mod: { source: "" } },
    pulseSpeed: { base: 1,    min: 0.2,  max: 4,   mod: { source: "" } },
    pulseCount: { base: 1,    min: 0,    max: 3,   mod: { source: "" } },
    glow:       { base: 1,    min: 0,    max: 4,   mod: { source: "" } },
    fade:       { base: 0.22, min: 0.02, max: 0.8, mod: { source: "" } },
});

export function drawRhizome(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new RhizomeViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp));
}
