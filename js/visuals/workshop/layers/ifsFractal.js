// ── IFS Fractal ───────────────────────────────────────────────────────────────
// Iterated Function System chaos game: repeatedly apply randomly-chosen affine
// transforms to trace the fractal attractor. Pixels accumulate over many frames
// and slowly fade, giving a glowing flame-fractal look. Colours by transform.
// Presets: 0=Fern, 1=Sierpinski, 2=Dragon, 3=Spiral, 4=Tree.
// Reimplemented in Canvas2D from native ifs_fractal.cu.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

const PRESETS = [
    {   // 0: Barnsley Fern
        xmin: -2.5, xmax: 2.7, ymin: 0, ymax: 10,
        tforms: [
            { a: 0,     b: 0,     c: 0,     d: 0.16,  e: 0,    f: 0,    p: 0.01 },
            { a: 0.85,  b: 0.04,  c: -0.04, d: 0.85,  e: 0,    f: 1.6,  p: 0.85 },
            { a: 0.2,   b: -0.26, c: 0.23,  d: 0.22,  e: 0,    f: 1.6,  p: 0.07 },
            { a: -0.15, b: 0.28,  c: 0.26,  d: 0.24,  e: 0,    f: 0.44, p: 0.07 },
        ],
    },
    {   // 1: Sierpinski Triangle
        xmin: 0, xmax: 1, ymin: 0, ymax: 1,
        tforms: [
            { a: 0.5, b: 0, c: 0, d: 0.5, e: 0,    f: 0,   p: 0.333 },
            { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5,  f: 0,   p: 0.333 },
            { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.25, f: 0.5, p: 0.334 },
        ],
    },
    {   // 2: Dragon Curve
        xmin: -1.5, xmax: 1.5, ymin: -1.0, ymax: 1.5,
        tforms: [
            { a: 0.5,  b: -0.5, c: 0.5, d: 0.5,  e: 0, f: 0, p: 0.5 },
            { a: -0.5, b: -0.5, c: 0.5, d: -0.5, e: 1, f: 0, p: 0.5 },
        ],
    },
    {   // 3: Spiral
        xmin: -7, xmax: 7, ymin: -1, ymax: 4,
        tforms: [
            { a: 0.788,  b: -0.424, c: 0.242,  d: 0.860,  e: 1.759,  f: 1.408,  p: 0.90 },
            { a: -0.121, b: 0.258,  c: -0.136, d: -0.148, e: -6.722, f: 1.377,  p: 0.05 },
            { a: 0.182,  b: -0.136, c: 0.091,  d: 0.182,  e: 6.086,  f: 1.568,  p: 0.05 },
        ],
    },
    {   // 4: Symmetric Tree
        xmin: -0.7, xmax: 0.7, ymin: 0, ymax: 1.7,
        tforms: [
            { a: 0,    b: 0,     c: 0,    d: 0.5,  e: 0, f: 0,   p: 0.05 },
            { a: 0.42, b: -0.42, c: 0.42, d: 0.42, e: 0, f: 0.2, p: 0.40 },
            { a: 0.42, b: 0.42,  c:-0.42, d: 0.42, e: 0, f: 0.2, p: 0.40 },
            { a: 0.1,  b: 0,     c: 0,    d: 0.1,  e: 0, f: 0.2, p: 0.15 },
        ],
    },
];

const GW = 256, GH = 256;

class IFSViz {
    constructor() {
        this._px      = null; // Uint8ClampedArray RGBA
        this._id      = null; // ImageData
        this._offCtx  = null;
        this._preset  = -1;
        this._x       = 0; this._y = 0;
        this._cumProb = null;
    }

    _init() {
        this._px     = new Uint8ClampedArray(GW * GH * 4);
        this._id     = new ImageData(this._px, GW, GH);
        const off    = new OffscreenCanvas(GW, GH);
        this._offCtx = off.getContext("2d");
    }

    _loadPreset(idx) {
        if (this._px) this._px.fill(0);
        this._x = 0; this._y = 0;
        this._preset  = idx;
        const tforms  = PRESETS[idx].tforms;
        let sum       = 0;
        this._cumProb = tforms.map((tf) => { sum += tf.p; return sum; });
    }

    frame(ctx, w, h, p, t, audio, bass) {
        if (!this._px) this._init();

        const preset = Math.round(Math.max(0, Math.min(PRESETS.length - 1, p.preset ?? 0)));
        const hue    = (p.hue   ?? 120) | 0;
        const zoom   = Math.max(0.1, p.zoom  ?? 1);
        const decay  = Math.max(0.005, Math.min(0.4, p.decay ?? 0.02));
        const iters  = Math.round(6000 * (1 + audio * 0.6 + bass * 0.4));

        if (preset !== this._preset) this._loadPreset(preset);

        const { xmin, xmax, ymin, ymax, tforms } = PRESETS[preset];
        const midX = (xmin + xmax) / 2, midY = (ymin + ymax) / 2;
        const rangeX = (xmax - xmin) / zoom, rangeY = (ymax - ymin) / zoom;
        const oX = midX - rangeX / 2, oY = midY - rangeY / 2;

        // Fade existing pixels toward black
        const px = this._px;
        const fadeAmt = Math.max(1, decay * 255 * 0.25 | 0);
        for (let i = 0; i < px.length; i += 4) {
            if (px[i] > 0)   px[i]   = Math.max(0, px[i]   - fadeAmt);
            if (px[i+1] > 0) px[i+1] = Math.max(0, px[i+1] - fadeAmt);
            if (px[i+2] > 0) px[i+2] = Math.max(0, px[i+2] - fadeAmt);
        }

        // Chaos game
        let x = this._x, y = this._y;
        const cumProb = this._cumProb;
        const nTf     = tforms.length;
        const hueStep = 360 / nTf;

        for (let iter = 0; iter < iters; iter++) {
            const r = Math.random();
            let ti = 0;
            for (let k = 0; k < cumProb.length; k++) { if (r < cumProb[k]) { ti = k; break; } }
            const tf = tforms[ti];
            const nx = tf.a * x + tf.b * y + tf.e;
            const ny = tf.c * x + tf.d * y + tf.f;
            x = nx; y = ny;

            if (iter < 20) continue; // skip transient

            const gx = ((x - oX) / rangeX * GW) | 0;
            const gy = ((oY + rangeY - y) / rangeY * GH) | 0; // flip Y
            if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;

            const tfHue = (hue + ti * hueStep) % 360;
            const [r2, g2, b2] = hsl2rgb(tfHue, 0.85, 0.6);
            const idx = (gy * GW + gx) * 4;
            px[idx]   = Math.min(255, px[idx]   + (r2 * 0.08 | 0) + 12);
            px[idx+1] = Math.min(255, px[idx+1] + (g2 * 0.08 | 0) + 12);
            px[idx+2] = Math.min(255, px[idx+2] + (b2 * 0.08 | 0) + 12);
            px[idx+3] = 255;
        }

        this._x = x; this._y = y;
        this._offCtx.putImageData(this._id, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this._offCtx.canvas, 0, 0, w, h);
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

export const ifsFractalParams = () => ({
    preset: { base: 0,   min: 0,    max: 4,   step: 1, mod: { source: "" } },
    hue:    { base: 120, min: 0,    max: 360, mod: { source: "" } },
    zoom:   { base: 1,   min: 0.2,  max: 5,   mod: { source: "" } },
    decay:  { base: 0.02,min: 0.005,max: 0.4, mod: { source: "" } },
});

export function drawIfsFractal(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IFSViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp));
}
