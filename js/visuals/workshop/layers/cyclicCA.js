// ── Cyclic CA ─────────────────────────────────────────────────────────────────
// Greenberg-Hastings cyclic cellular automaton: cells advance to the next state
// when enough Moore neighbours already hold that next state. Self-organises into
// rotating spiral waves. Bass triggers random noise injections; mid hue-shifts
// the palette; treble accelerates evolution and brightens the outer cycle states.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

class CyclicCAViz {
    constructor(GW, GH) {
        this.GW = GW; this.GH = GH;
        this._a = new Uint8Array(GW * GH);
        this._b = new Uint8Array(GW * GH);
        this._off = null; this._offCtx = null;
        this._K = 0; this._thr = 0; this._parity = 0;
        this.prevBass = 0; this.pulse = 0;
    }

    _seed(K) {
        const { GW, GH, _a } = this;
        for (let i = 0; i < GW * GH; i++) _a[i] = Math.random() * K | 0;
        this._K = K; this._parity = 0;
    }

    _ensureOff() {
        if (!this._off || this._off.width !== this.GW) {
            this._off    = new OffscreenCanvas(this.GW, this.GH);
            this._offCtx = this._off.getContext('2d');
        }
    }

    frame(ctx, w, h, p, bass, mid, treble, pC) {
        const { GW, GH } = this;
        const K    = Math.max(2, Math.min(20, Math.round(p.states    ?? 8)));
        const thr  = Math.max(1, Math.min(4,  Math.round(p.threshold ?? 1)));
        const spf  = Math.max(1, Math.min(10, Math.round((p.speed ?? 2) + treble * 4)));
        const hue  = (p.hue ?? 200) + mid * 80;
        const hueSpan = p.hueSpan ?? 300;
        const sat  = p.saturation ?? 0.9;
        const glow = p.glow ?? 0;

        if (K !== this._K || thr !== this._thr) { this._seed(K); this._thr = thr; }
        this._ensureOff();

        // Bass: scatter noise
        if (bass > 0.5 && bass > this.prevBass + 0.08) {
            this.pulse = 1;
            const src = this._parity % 2 === 0 ? this._a : this._b;
            const count = Math.round(GW * GH * 0.05 * bass);
            for (let c = 0; c < count; c++) {
                const i = (Math.random() * GW * GH) | 0;
                src[i] = Math.random() * K | 0;
            }
        }
        this.prevBass = bass;
        this.pulse *= 0.8;

        for (let step = 0; step < spf; step++) {
            const src = this._parity % 2 === 0 ? this._a : this._b;
            const dst = this._parity % 2 === 0 ? this._b : this._a;
            this._parity++;
            for (let y = 0; y < GH; y++) {
                const yn = (y === 0 ? GH - 1 : y - 1) * GW;
                const yc = y * GW;
                const yp = (y === GH - 1 ? 0 : y + 1) * GW;
                for (let x = 0; x < GW; x++) {
                    const xn = x === 0 ? GW - 1 : x - 1;
                    const xp = x === GW - 1 ? 0 : x + 1;
                    const cur  = src[yc + x];
                    const next = (cur + 1) % K;
                    let count = 0;
                    if (src[yn + xn] === next) count++;
                    if (src[yn + x ] === next) count++;
                    if (src[yn + xp] === next) count++;
                    if (src[yc + xn] === next) count++;
                    if (src[yc + xp] === next) count++;
                    if (src[yp + xn] === next) count++;
                    if (src[yp + x ] === next) count++;
                    if (src[yp + xp] === next) count++;
                    dst[yc + x] = count >= thr ? next : cur;
                }
            }
        }
        const grid = this._parity % 2 === 0 ? this._b : this._a;

        const id = this._offCtx.createImageData(GW, GH);
        const d  = id.data;
        const invK = 1 / Math.max(1, K - 1);
        for (let i = 0; i < GW * GH; i++) {
            const norm = grid[i] * invK;
            let r, g, b;
            if (pC) {
                // Map cell state normalized (0..1) to palette stop
                const hex = pC(norm).replace("#","");
                r = parseInt(hex.slice(0,2),16);
                g = parseInt(hex.slice(2,4),16);
                b = parseInt(hex.slice(4,6),16);
            } else {
                // Dual-band coloring: lower half one hue arc, upper half another
                const h2 = (hue + norm * hueSpan) % 360;
                const l  = 0.12 + norm * 0.60 + this.pulse * norm * 0.15;
                [r, g, b] = hsl2rgb(h2, sat, Math.min(0.92, l));
            }
            d[i*4] = r; d[i*4+1] = g; d[i*4+2] = b; d[i*4+3] = 255;
        }
        this._offCtx.putImageData(id, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._off, 0, 0, w, h);

        // Optional glow overlay using lighter compositing
        if (glow > 0.05) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = glow * 0.08 + this.pulse * 0.06;
            ctx.drawImage(this._off, 0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

export const cyclicCAParams = () => ({
    states:     { base: 8,   min: 2,   max: 20,  mod: { source: "" } },
    threshold:  { base: 1,   min: 1,   max: 4,   mod: { source: "" } },
    speed:      { base: 2,   min: 1,   max: 8,   mod: { source: "" } },
    hue:        { base: 200, min: 0,   max: 360, mod: { source: "" } },
    hueSpan:    { base: 300, min: 60,  max: 360, mod: { source: "" } },
    saturation: { base: 0.9, min: 0.3, max: 1,   mod: { source: "" } },
    glow:       { base: 0.5, min: 0,   max: 2,   mod: { source: "" } },
    size:       { base: 128, min: 64,  max: 256, mod: { source: "" } },
    usePalette: { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
});

export function drawCyclicCA(ctx, w, h, p, t, extra) {
    const GW = Math.max(64, Math.min(256, Math.round((p.size ?? 128) / 64) * 64));
    let viz = _state.get(ctx);
    if (!viz || viz.GW !== GW) { viz = new CyclicCAViz(GW, GW); _state.set(ctx, viz); }
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;
    viz.frame(ctx, w, h, p, bass, mid, treble, _pal ? pC : null);
}
