// ── Spline Weave ──────────────────────────────────────────────────────────────
// Catmull-Rom spline bundles with animated data pulses. Control points drift on
// independent oscillators. Audio brightens pulses; bass spawns a burst of them.
// Reimplemented in Canvas2D from native spline_weave.cu.

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

// Catmull-Rom segment: returns point at t ∈ [0,1] given 4 control pts
function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
        0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
    ];
}

class SplineViz {
    constructor(w, h) {
        this.t = 0;
        this.splines = [];
        this.pulses  = [];
        this._buildSplines(w, h);
        this.pulse    = 0;
        this.prevBass = 0;
    }

    _buildSplines(w, h) {
        const N = 10;
        this.splines = [];
        for (let i = 0; i < N; i++) {
            const pts = [];
            const nPts = 4 + (Math.random() * 3 | 0);
            for (let k = 0; k < nPts; k++) pts.push([rnd(0, w), rnd(0, h), rnd(0.3, 1.5), rnd(0, Math.PI * 2)]);
            this.splines.push({ pts, hue: rnd(0, 360), phase: rnd(0, Math.PI * 2) });
        }
    }

    frame(ctx, w, h, p, t, audio, bass, spectrum) {
        const dt     = 1 / 60;
        this.t      += dt;
        const speed  = p.speed  ?? 1;
        const hue    = (p.hue   ?? 220) | 0;
        const glow   = p.glow   ?? 1;
        const drift  = p.drift  ?? 0.5;
        const fade   = p.fade   ?? 0.1;
        const pCount = Math.round(p.pulseCount ?? 1);

        // Beat detection
        if (bass > 0.6 && bass > this.prevBass + 0.1) this.pulse = 1;
        this.prevBass = bass;
        this.pulse *= 0.85;

        ctx.fillStyle = `rgba(0,0,8,${fade})`; ctx.fillRect(0, 0, w, h);

        const nBands = spectrum ? spectrum.length : 0;

        // Drift control points — each spline's amplitude driven by its spectrum band
        for (let si = 0; si < this.splines.length; si++) {
            const sp = this.splines[si];
            // Map each spline to a frequency band
            const bandVal = nBands ? spectrum[Math.floor((si / this.splines.length) * nBands)] : audio;
            const driftAmp = drift * (1 + bandVal * 2 + this.pulse * 0.8);
            for (let k = 0; k < sp.pts.length; k++) {
                const pt = sp.pts[k];
                pt[0] += Math.sin(this.t * pt[2] * 0.6 + pt[3]) * driftAmp * dt * 25;
                pt[1] += Math.cos(this.t * pt[2] * 0.5 + pt[3] + 1.2) * driftAmp * dt * 25;
                if (pt[0] < 0) pt[0] = w; if (pt[0] > w) pt[0] = 0;
                if (pt[1] < 0) pt[1] = h; if (pt[1] > h) pt[1] = 0;
            }
        }

        // Spawn pulses on beat / audio — beat causes burst
        const maxPulses = Math.min(120, pCount * 40);
        const spawnProb = 0.005 + audio * 0.02 + bass * 0.04 + this.pulse * 0.15;
        if (this.pulses.length < maxPulses && Math.random() < spawnProb) {
            const si = (Math.random() * this.splines.length) | 0;
            this.pulses.push({ si, t: 0, speed: rnd(0.8, 2) * speed });
        }

        // Draw splines — each spline's brightness driven by its frequency band
        const STEPS = 40;
        for (let si = 0; si < this.splines.length; si++) {
            const sp  = this.splines[si];
            const pts = sp.pts;
            const n   = pts.length;
            if (n < 2) continue;
            const bandVal = nBands ? spectrum[Math.floor((si / this.splines.length) * nBands)] : audio;
            const trHue = (hue + sp.hue * 0.2 + this.pulse * 30) % 360;
            const spAlpha = 0.25 + bandVal * 0.6 + this.pulse * 0.2;
            ctx.strokeStyle = `hsla(${trHue},${75 + bandVal * 20}%,${45 + bandVal * 20}%,${Math.min(1, spAlpha)})`;
            ctx.lineWidth   = 1.2 + bandVal * 1.5;
            ctx.beginPath();
            for (let seg = 0; seg < n - 1; seg++) {
                const p0 = pts[Math.max(0, seg - 1)], p1 = pts[seg];
                const p2 = pts[seg + 1], p3 = pts[Math.min(n - 1, seg + 2)];
                for (let i = 0; i <= STEPS; i++) {
                    const [x, y] = catmullRom(p0, p1, p2, p3, i / STEPS);
                    i === 0 && seg === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Draw pulses
        for (const pulse of this.pulses) {
            pulse.t += dt * pulse.speed;
            const sp  = this.splines[pulse.si];
            const pts = sp.pts;
            const n   = pts.length - 1;
            const pos = pulse.t * n;
            const seg = Math.min(n - 1, pos | 0);
            const frac = pos - seg;
            const p0 = pts[Math.max(0, seg - 1)], p1 = pts[seg];
            const p2 = pts[seg + 1], p3 = pts[Math.min(pts.length - 1, seg + 2)];
            const [px, py] = catmullRom(p0, p1, p2, p3, frac);
            const ph = (hue + sp.hue * 0.2 + 60) % 360;
            ctx.fillStyle   = `hsla(${ph},100%,88%,0.9)`;
ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(px, py, 3 + audio * 3, 0, 6.28); ctx.fill();
            ctx.shadowBlur = 0;
        }
        this.pulses = this.pulses.filter((pl) => pl.t < 1);
    }
}

function audioLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    let s = 0; for (let i = 0; i < spectrum.length; i++) s += spectrum[i];
    return Math.min(1, (s / spectrum.length) * 3);
}
function bassLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    const n = Math.max(1, (spectrum.length * 0.18) | 0);
    let s = 0; for (let i = 0; i < n; i++) s += spectrum[i];
    return Math.min(1, (s / n) * 3);
}

export const splineWeaveParams = () => ({
    speed:      { base: 1,   min: 0.1, max: 4,   mod: { source: "" } },
    drift:      { base: 0.5, min: 0,   max: 3,   mod: { source: "" } },
    pulseCount: { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    hue:        { base: 220, min: 0,   max: 360, mod: { source: "" } },
    glow:       { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    fade:       { base: 0.1, min: 0.02,max: 0.6, mod: { source: "" } },
});

export function drawSplineWeave(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new SplineViz(w, h); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp), sp);
}
