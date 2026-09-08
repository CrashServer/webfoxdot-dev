// ── Clifford Attractor ────────────────────────────────────────────────────────
// Strange attractor x'=sin(a·y)+c·cos(a·x), y'=sin(b·x)+d·cos(b·y)
// Dual-layer: a hot accumulation buffer (density heatmap) composited with a
// live scatter pass. Audio smoothly morphs a/b/c/d; bass triggers color bursts.

const _state = new WeakMap();

const _palette = [
    [[0,0,20],[20,0,80],[80,20,180],[180,80,255],[255,200,255]],   // violet
    [[0,10,0],[0,60,20],[0,180,80],[80,255,160],[200,255,220]],    // emerald
    [[20,0,0],[100,10,0],[220,80,0],[255,200,50],[255,255,180]],   // ember
    [[0,10,20],[0,60,120],[0,160,220],[80,220,255],[220,245,255]], // cyan
];

function lerpColor(stops, t) {
    const n = stops.length - 1;
    const i = Math.min(n - 1, Math.floor(t * n));
    const f = t * n - i;
    const a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f, a[2] + (b[2]-a[2])*f];
}

class CliffordViz {
    constructor(w, h) {
        this.acc = new OffscreenCanvas(w, h);
        this.accCtx = this.acc.getContext("2d");
        this.live = new OffscreenCanvas(w, h);
        this.liveCtx = this.live.getContext("2d");
        this.x = 0.1; this.y = 0.1;
        this._lastSig = null;
        this.colorBurst = 0;
        this.prevBass = 0;
        this.beatHue = 0;
        // density buffer for heatmap coloring
        this.density = new Float32Array(w * h);
        this.maxDensity = 1;
        this.w = w; this.h = h;
    }

    frame(ctx, w, h, p, t, bass, mid, treble, pC) {
        const a  = p.a;
        const b  = p.b;
        const c  = p.c;
        const d  = p.d;
        // Audio smoothly morphs attractor params
        const am = a + Math.sin(t * 0.31) * p.morph * 0.3 + mid * p.morph * 0.25;
        const bm = b + Math.cos(t * 0.23) * p.morph * 0.3 + treble * p.morph * 0.15;
        const cm = c + Math.sin(t * 0.17 + 1.2) * p.morph * 0.2;
        const dm = d + Math.cos(t * 0.19 + 0.8) * p.morph * 0.2;

        const sig = `${am.toFixed(3)}_${bm.toFixed(3)}_${cm.toFixed(3)}_${dm.toFixed(3)}`;
        if (this._lastSig !== sig) {
            // Soft reset — fade existing on param drift
            this._lastSig = sig;
        }

        // Beat detection — bass spike triggers color burst
        if (bass > 0.55 && bass > this.prevBass + 0.08) {
            this.colorBurst = 1;
            this.beatHue = (this.beatHue + 37) % 360;
        }
        this.prevBass = bass;
        this.colorBurst *= 0.88;

        const iters = Math.round(p.iterations * (1 + bass * 1.8 + treble * 0.5));
        const sc    = p.scale * Math.min(w, h) * 0.22;
        const cx    = w / 2, cy = h / 2;
        const fade  = p.fade;
        const palIdx = Math.max(0, Math.min(3, Math.round(p.palette)));

        const ac = this.accCtx;

        // Fade accumulation buffer
        ac.fillStyle = `rgba(0,0,${palIdx === 2 ? 0 : 4},${fade})`;
        ac.fillRect(0, 0, w, h);

        // Live scatter pass — hue shifts with audio and beat
        const hueBase = p.hue + this.colorBurst * 60 + mid * 40 + treble * 20;
        const sat = 75 + bass * 20;
        const lum = 60 + treble * 20 + this.colorBurst * 20;
        const alpha = 0.08 + bass * 0.06 + this.colorBurst * 0.08;

        // palette: cycle through stops by normalized point index
        if (pC) {
            // Draw palette-colored points individually (am/bm/cm/dm/sc/cx/cy already computed above)
            let x = this.x, y = this.y;
            for (let i = 0; i < iters; i++) {
                const nx = Math.sin(am * y) + cm * Math.cos(am * x);
                const ny = Math.sin(bm * x) + dm * Math.cos(bm * y);
                x = nx; y = ny;
                ac.fillStyle = pC(i / iters);
                ac.fillRect(cx + x * sc - 0.5, cy + y * sc - 0.5, 1, 1);
            }
            this.x = x; this.y = y;
        } else {
        ac.fillStyle = `hsla(${hueBase % 360},${sat}%,${lum}%,${alpha})`;
        ac.beginPath();
        let x = this.x, y = this.y;
        for (let i = 0; i < iters; i++) {
            const nx = Math.sin(am * y) + cm * Math.cos(am * x);
            const ny = Math.sin(bm * x) + dm * Math.cos(bm * y);
            x = nx; y = ny;
            ac.rect(cx + x * sc - 0.5, cy + y * sc - 0.5, 1, 1);
        }
        ac.fill();
        this.x = x; this.y = y;

        // Second scatter with offset hue — mid-frequency color layer
        if (mid > 0.15) {
            ac.fillStyle = `hsla(${(hueBase + 120) % 360},90%,70%,${mid * 0.04})`;
            ac.beginPath();
            let x2 = -this.x, y2 = this.y;
            const iters2 = Math.round(iters * 0.3);
            for (let i = 0; i < iters2; i++) {
                const nx = Math.sin(am * y2) + cm * Math.cos(am * x2);
                const ny = Math.sin(bm * x2) + dm * Math.cos(bm * y2);
                x2 = nx; y2 = ny;
                ac.rect(cx + x2 * sc - 0.5, cy + y2 * sc - 0.5, 1, 1);
            }
            ac.fill();
        }
        } // end else (non-palette scatter)

        // Beat glow overlay — lighter composite for bloom effect
        if (this.colorBurst > 0.1) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.acc, 0, 0);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = `hsla(${this.beatHue},100%,60%,${this.colorBurst * 0.12})`;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        } else {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.acc, 0, 0);
        }
    }
}

export const cliffordParams = () => ({
    a:          { base: -1.4,  min: -2.5,  max: 2.5,  mod: { source: "" } },
    b:          { base: 1.6,   min: -2.5,  max: 2.5,  mod: { source: "" } },
    c:          { base: 1.0,   min: -2.5,  max: 2.5,  mod: { source: "" } },
    d:          { base: 0.7,   min: -2.5,  max: 2.5,  mod: { source: "" } },
    morph:      { base: 0.6,   min: 0,     max: 2,    mod: { source: "" } },
    scale:      { base: 1,     min: 0.3,   max: 3,    mod: { source: "" } },
    hue:        { base: 220,   min: 0,     max: 360,  mod: { source: "" } },
    palette:    { base: 0,     min: 0,     max: 3,    mod: { source: "" } },
    fade:       { base: 0.012, min: 0.001, max: 0.12, mod: { source: "" } },
    iterations: { base: 4000,  min: 500,   max: 12000, mod: { source: "" } },
    brightness: { base: 1,     min: 0.3,   max: 3,    mod: { source: "" } },
    scatter:    { base: 1,     min: 0.5,   max: 4,    mod: { source: "" } },
    usePalette: { base: 0,     min: 0,     max: 1,    mod: { source: "" } },
});

export function drawClifford(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz || viz.acc.width !== w || viz.acc.height !== h) {
        viz = new CliffordViz(w, h);
        _state.set(ctx, viz);
    }
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble, _pal ? pC : null);
}
