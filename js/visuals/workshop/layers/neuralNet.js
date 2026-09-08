// ── Neural Network ────────────────────────────────────────────────────────────
// Layered feed-forward network with signal pulse propagation. Nodes glow on
// activation; edges show positive/negative weights with hue coding. Bass fires
// the input layer; mid reshapes the network topology; treble speeds up pulses
// and brightens the connections. Idle animation keeps weights drifting.

const _state = new WeakMap();

const _nnGlowCache = new Map();
function _nnGlow(hue, radius) {
    const hb = Math.round(hue / 20) * 20;
    const rb = Math.max(4, Math.round(radius / 4) * 4);
    const key = `${hb}_${rb}`;
    if (_nnGlowCache.has(key)) return _nnGlowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0,   `hsl(${hb},90%,90%)`);
    g.addColorStop(0.3, `hsla(${hb},80%,60%,0.6)`);
    g.addColorStop(1,   'transparent');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _nnGlowCache.set(key, gc);
    return gc;
}

function hsl(h, s, l, a = 1) {
    return `hsla(${(h % 360 + 360) % 360},${s}%,${l}%,${a})`;
}

function buildNetwork(layers) {
    const nodes = [], edges = [];
    const L = layers.length;
    for (let l = 0; l < L; l++) {
        const n = layers[l];
        for (let i = 0; i < n; i++) nodes.push({ l, i, n, act: 0, ph: Math.random() * Math.PI * 2, bias: Math.random() * 0.4 - 0.2 });
    }
    for (let a = 0; a < nodes.length; a++) {
        for (let b = 0; b < nodes.length; b++) {
            if (nodes[b].l === nodes[a].l + 1) {
                edges.push({ a, b, w: Math.random() * 2 - 1, baseW: Math.random() * 2 - 1 });
            }
        }
    }
    return { nodes, edges };
}

class NeuralViz {
    constructor() {
        this.layers  = [4, 6, 8, 6, 4, 2];
        const { nodes, edges } = buildNetwork(this.layers);
        this.nodes   = nodes;
        this.edges   = edges;
        this.pulses  = [];
        this.t       = 0;
        this.prevBass  = 0;
        this.prevMid   = 0;
        this.pulse     = 0;
        this.midPulse  = 0;
        this.lastFire  = -1;
    }

    _fire(fraction = 0.7) {
        for (let i = 0; i < this.edges.length; i++) {
            const e = this.edges[i];
            if (this.nodes[e.a].l === 0 && Math.random() < fraction) {
                this.pulses.push({ e: i, frac: 0, speed: 0.8 + Math.random() * 0.4 });
            }
        }
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].l === 0) this.nodes[i].act = 0.8 + Math.random() * 0.2;
        }
    }

    _nodePos(node, w, h, jitter) {
        const L = this.layers.length;
        const x = w * (0.10 + 0.80 * node.l / (L - 1));
        const vSpacing = Math.min(0.14, 0.85 / node.n);
        const y = h * (0.5 + (node.i - (node.n - 1) / 2) * vSpacing);
        return [x + (jitter ? (Math.sin(node.ph + this.t * 0.5) * w * 0.004) : 0), y];
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const dt     = 1 / 60;
        this.t      += dt;
        const hue    = p.hue       ?? 200;
        const speed  = (p.speed    ?? 1.2) + treble * 1.5;
        const eGlow  = p.edgeGlow  ?? 1;
        const nGlow  = p.nodeGlow  ?? 1.5;
        const jitter = (p.jitter   ?? 0.5) > 0.3;
        const decay  = p.decay     ?? 0.93;
        const posHue = hue;
        const negHue = (hue + 150) % 360;

        // Bass fires input layer
        if (bass > 0.4 && bass > this.prevBass + 0.06) {
            this.pulse = 1;
            this._fire(0.5 + bass * 0.4);
        }
        this.prevBass = bass;

        // Mid shifts weight targets slightly — network "reconfigures"
        if (mid > 0.5 && mid > this.prevMid + 0.1) this.midPulse = mid;
        this.prevMid = mid;
        this.pulse    *= 0.82;
        this.midPulse *= 0.90;

        // Auto-fire idle pulses
        if (this.t - this.lastFire > 1.5) { this.lastFire = this.t; this._fire(0.25); }

        // Drift weights
        for (let i = 0; i < this.edges.length; i++) {
            const e = this.edges[i];
            e.w += Math.sin(this.t * 0.4 + i * 0.37) * 0.008;
            e.w += (e.baseW - e.w) * 0.002 * (1 + this.midPulse * 3);
            e.w  = Math.max(-1, Math.min(1, e.w));
        }

        ctx.fillStyle = `rgba(2,3,10,${p.bgFade ?? 0.3})`;
        ctx.fillRect(0, 0, w, h);
        const U = Math.min(w, h);

        // Edges
        for (let i = 0; i < this.edges.length; i++) {
            const e = this.edges[i];
            const na = this.nodes[e.a], nb = this.nodes[e.b];
            const [ax, ay] = this._nodePos(na, w, h, jitter);
            const [bx, by] = this._nodePos(nb, w, h, jitter);
            const wt = Math.abs(e.w);
            const actBoost = (na.act + nb.act) * 0.5;
            const alpha = (0.04 + wt * 0.18 + actBoost * 0.25) * eGlow;
            const edgeHue = e.w > 0 ? posHue : negHue;
            ctx.strokeStyle = hsl(edgeHue, 70, 55 + actBoost * 25, Math.min(1, alpha));
            ctx.lineWidth   = 0.4 + wt * 1.8 + actBoost * 2;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }

        // Advance pulses and draw them
        const nextPulses = [];
        const U4 = U * 0.005;
        ctx.globalCompositeOperation = 'lighter';
        for (let pi = 0; pi < this.pulses.length; pi++) {
            const pulse = this.pulses[pi];
            pulse.frac += dt * pulse.speed * speed;
            const e  = this.edges[pulse.e];
            const na = this.nodes[e.a], nb = this.nodes[e.b];
            const [ax, ay] = this._nodePos(na, w, h, jitter);
            const [bx, by] = this._nodePos(nb, w, h, jitter);
            const px = ax + (bx - ax) * pulse.frac;
            const py = ay + (by - ay) * pulse.frac;

            if (pulse.frac >= 1) {
                // Activate destination node and propagate
                nb.act = Math.min(1, nb.act + 0.6 * Math.abs(e.w));
                if (nb.l < this.layers.length - 1) {
                    for (let ei = 0; ei < this.edges.length; ei++) {
                        if (this.edges[ei].a === e.b && Math.random() < 0.45 + Math.abs(e.w) * 0.3) {
                            nextPulses.push({ e: ei, frac: 0, speed: 0.7 + Math.random() * 0.5 });
                        }
                    }
                }
                continue;
            }

            // Bright moving dot with radial glow — cached sprite per hue/size bucket
            const r = U4 * (1.5 + Math.abs(e.w));
            const gs = _nnGlow(posHue, r * 3);
            ctx.globalAlpha = 0.9;
            ctx.drawImage(gs, px - gs.width/2, py - gs.height/2);
            ctx.globalAlpha = 1;
            nextPulses.push(pulse);
        }
        ctx.globalCompositeOperation = 'source-over';
        this.pulses = nextPulses;
        if (this.pulses.length > 500) this.pulses.splice(0, this.pulses.length - 500);

        // Decay activations
        for (let i = 0; i < this.nodes.length; i++) this.nodes[i].act *= decay;

        // Draw dormant nodes
        ctx.shadowBlur = 0;
        for (let i = 0; i < this.nodes.length; i++) {
            const nd = this.nodes[i];
            if (nd.act >= 0.08) continue;
            const [nx, ny] = this._nodePos(nd, w, h, jitter);
            const idle = 0.5 + 0.5 * Math.sin(nd.ph + this.t * 0.6);
            ctx.fillStyle = hsl(hue + nd.l * 15, 50, 18 + idle * 8, 0.7);
            ctx.beginPath(); ctx.arc(nx, ny, U * 0.007, 0, Math.PI * 2); ctx.fill();
        }

        // Draw active nodes with glow
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < this.nodes.length; i++) {
            const nd = this.nodes[i];
            if (nd.act < 0.08) continue;
            const [nx, ny] = this._nodePos(nd, w, h, jitter);
            const v   = nd.act;
            const rad = U * (0.007 + v * 0.008);
            const glowR = rad * (3 + v * 2) * nGlow;
            const nh  = hue + nd.l * 20;
            const gs2 = _nnGlow(nh, glowR);
            ctx.globalAlpha = v;
            ctx.drawImage(gs2, nx - gs2.width/2, ny - gs2.height/2);
            ctx.globalAlpha = 1;
            ctx.fillStyle = hsl(nh, 100, 95, 0.9 * v);
            ctx.beginPath(); ctx.arc(nx, ny, rad, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
    }
}

export const neuralNetParams = () => ({
    hue:      { base: 200,  min: 0,    max: 360, mod: { source: "" } },
    speed:    { base: 1.2,  min: 0.2,  max: 6,   mod: { source: "" } },
    edgeGlow: { base: 1,    min: 0,    max: 3,   mod: { source: "" } },
    nodeGlow: { base: 1.5,  min: 0,    max: 4,   mod: { source: "" } },
    decay:    { base: 0.93, min: 0.7,  max: 0.99,mod: { source: "" } },
    bgFade:   { base: 0.3,  min: 0.05, max: 1,   mod: { source: "" } },
    jitter:   { base: 0.5,  min: 0,    max: 1,   mod: { source: "" } },
});

export function drawNeuralNet(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new NeuralViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
