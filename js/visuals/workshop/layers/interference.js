// ── Interference layer ────────────────────────────────────────────────────
// Multi-source circular wave interference pattern rendered on a 200×200 buffer.
// 2–8 point sources orbit at different radii and speeds.
// At each pixel: sum sin(k·dist_i − ω·t + φ_i) for each source.
// Mid drives wave frequency; bass triggers a brief frequency spike.

const _state = new WeakMap();
const BUF_W = 200, BUF_H = 200;

class Interference {
    constructor(n) {
        this.n      = n;
        this.phases = new Float32Array(n);
        this.radii  = new Float32Array(n);
        this.speeds = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            this.phases[i] = (i / n) * Math.PI * 2;
            this.radii[i]  = 0.2 + (i / n) * 0.8;
            this.speeds[i] = 0.5 + Math.random() * 1.5;
        }
        this.oc     = new OffscreenCanvas(BUF_W, BUF_H);
        this.octx   = this.oc.getContext("2d");
        this.img    = this.octx.createImageData(BUF_W, BUF_H);
        this.freqBoost = 0;
        this.prevBass  = 0;
    }

    frame(ctx, w, h, p, t, audio, bass, mid, treble, spectrum) {
        const srcCount    = Math.max(2, Math.min(8, Math.round(p.sources ?? 4)));
        const orbitSpd    = p.orbitSpeed ?? 0.3;
        const orbitRad    = p.orbitRadius ?? 0.4;
        const hue         = p.hue ?? 200;
        const intensity   = p.intensity ?? 1.5;

        // Bass spike detection → brief freq boost
        if (bass > this.prevBass + 0.3) this.freqBoost = 8;
        this.freqBoost = Math.max(0, this.freqBoost - 0.5);
        this.prevBass  = bass;

        const baseFreq = (p.freq ?? 15) * (1 + mid * 1.5);
        const k        = (baseFreq + this.freqBoost) * (Math.PI / Math.min(BUF_W, BUF_H));

        // Source positions
        const sx = new Float32Array(srcCount);
        const sy = new Float32Array(srcCount);
        const cx = BUF_W * 0.5, cy = BUF_H * 0.5;
        for (let i = 0; i < srcCount; i++) {
            const angle = t * orbitSpd * this.speeds[i % this.speeds.length]
                        + this.phases[i % this.phases.length];
            const rad   = orbitRad * Math.min(BUF_W, BUF_H) * 0.5
                        * this.radii[i % this.radii.length];
            sx[i] = cx + Math.cos(angle) * rad;
            sy[i] = cy + Math.sin(angle) * rad;
        }

        const data = this.img.data;
        const h1 = (hue + 60) % 360;
        const h2 = (hue - 60 + 360) % 360;

        for (let py = 0; py < BUF_H; py++) {
            for (let px = 0; px < BUF_W; px++) {
                let sum = 0;
                for (let i = 0; i < srcCount; i++) {
                    const dx   = px - sx[i], dy = py - sy[i];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    sum += Math.sin(k * dist - t * 2.5 + this.phases[i % this.phases.length]);
                }
                const v = sum / srcCount; // −1..1
                const vn = (v * 0.5 + 0.5) * intensity; // 0..intensity

                // 3-stop color: trough=hue1, mid=white, peak=hue2
                let r, g, b2;
                if (v < 0) {
                    const fv = Math.min(1, -v);
                    // hue1 → dark
                    r  = Math.sin((h1 / 360) * Math.PI * 2) * 0.5 + 0.5;
                    g  = Math.sin((h1 / 360 + 0.33) * Math.PI * 2) * 0.5 + 0.5;
                    b2 = Math.sin((h1 / 360 + 0.66) * Math.PI * 2) * 0.5 + 0.5;
                    const brt = fv * 0.9;
                    r = r * brt; g = g * brt; b2 = b2 * brt;
                } else {
                    const fv = Math.min(1, v);
                    r  = Math.sin((h2 / 360) * Math.PI * 2) * 0.5 + 0.5;
                    g  = Math.sin((h2 / 360 + 0.33) * Math.PI * 2) * 0.5 + 0.5;
                    b2 = Math.sin((h2 / 360 + 0.66) * Math.PI * 2) * 0.5 + 0.5;
                    const brt = fv * 0.9;
                    r = r * brt; g = g * brt; b2 = b2 * brt;
                }

                const idx = (py * BUF_W + px) * 4;
                data[idx]   = Math.min(255, r  * 255 * intensity) | 0;
                data[idx+1] = Math.min(255, g  * 255 * intensity) | 0;
                data[idx+2] = Math.min(255, b2 * 255 * intensity) | 0;
                data[idx+3] = 255;
            }
        }

        this.octx.putImageData(this.img, 0, 0);
        ctx.drawImage(this.oc, 0, 0, w, h);
    }
}

function audioLevel(s) { if (!s?.length) return 0; let v=0; for(let i=0;i<s.length;i++) v+=s[i]; return Math.min(1, v/s.length*3); }
function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.18|0); let v=0; for(let i=0;i<n;i++) v+=s[i]; return Math.min(1, v/n*3); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.18|0, b=s.length*.5|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

export const interferenceParams = () => ({
    sources:      { base: 4,    min: 2,   max: 8,    mod: { source: "" } },
    freq:         { base: 15,   min: 2,   max: 50,   mod: { source: "" } },
    orbitSpeed:   { base: 0.3,  min: 0,   max: 2,    mod: { source: "" } },
    orbitRadius:  { base: 0.4,  min: 0.1, max: 0.9,  mod: { source: "" } },
    hue:          { base: 200,  min: 0,   max: 360,  mod: { source: "" } },
    intensity:    { base: 1.5,  min: 0.5, max: 4,    mod: { source: "" } },
});

export function drawInterference(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new Interference(Math.round(p.sources ?? 4)); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(s), bassLevel(s), midLevel(s), trebleLevel(s), s);
}
