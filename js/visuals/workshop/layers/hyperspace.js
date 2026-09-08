// ── Hyperspace ────────────────────────────────────────────────────────────────
// Warp tunnel: stars fly toward the viewer in perspective, leaving color-fringed
// streaks. Bass triggers warp boost. Treble adds chromatic aberration on streaks.
// Mid controls tunnel color temperature. Includes a subtle warp vignette ring.

const _state = new WeakMap();
const MAX_STARS = 2500;

class Hyperspace {
    constructor(n) {
        this.n    = 0;
        this.x    = new Float32Array(MAX_STARS);
        this.y    = new Float32Array(MAX_STARS);
        this.z    = new Float32Array(MAX_STARS);
        this.px   = new Float32Array(MAX_STARS);
        this.py   = new Float32Array(MAX_STARS);
        this.col  = new Float32Array(MAX_STARS); // 0..1 color variant per star
        this.hasPrev = new Uint8Array(MAX_STARS);
        this.boost  = 0;
        this.boostDecay = 0;
        this.prevBass = 0;
        this.prevMid  = 0;
        this.warpRing = 0;
        this.lastT  = 0;
        this._initStars(n);
    }

    _initStars(n) {
        this.n = Math.min(n, MAX_STARS);
        for (let i = 0; i < this.n; i++) { this._reset(i, true); this.col[i] = Math.random(); }
    }

    _reset(i, init) {
        this.x[i] = (Math.random() - 0.5) * 2;
        this.y[i] = (Math.random() - 0.5) * 2;
        this.z[i] = init ? Math.random() : 1.0;
        this.hasPrev[i] = 0;
    }

    resize(n) {
        const newN = Math.min(n, MAX_STARS);
        for (let i = this.n; i < newN; i++) { this._reset(i, false); this.col[i] = Math.random(); }
        this.n = newN;
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const desiredN = Math.max(100, Math.min(MAX_STARS, Math.round(p.count)));
        if (desiredN !== this.n) this.resize(desiredN);

        const dt = Math.min(0.1, t - this.lastT);
        this.lastT = t;

        // Bass → warp boost
        if (bass > 0.65 && bass > this.prevBass + 0.12) {
            this.boost = 4.0 + bass * 5;
            this.warpRing = 1.0;
        }
        this.boost = Math.max(0, this.boost - dt * 6);
        this.warpRing = Math.max(0, this.warpRing - dt * 3);
        this.prevBass = bass;

        const speed   = p.speed * (1 + this.boost);
        const hue     = p.hue + mid * p.midShift;
        const fov     = p.fov;
        const trailMul = p.trail;
        const fringe  = p.fringe * treble;
        const focalLen = Math.min(w, h) * fov;
        const cx = w * 0.5, cy = h * 0.5;
        const dz = speed * dt;

        // Trail fade — shorter with more trail
        const fadeAmt = 0.12 + (1 - trailMul) * 0.75;
        ctx.fillStyle = `rgba(0,0,8,${fadeAmt})`;
        ctx.fillRect(0, 0, w, h);

        // Warp vignette ring on boost
        if (this.warpRing > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const rr = Math.min(w, h) * (0.3 + this.warpRing * 0.2);
            const vg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, rr * 1.2);
            vg.addColorStop(0, `rgba(0,0,0,0)`);
            vg.addColorStop(0.5, `hsla(${hue+30},100%,70%,${this.warpRing*0.15})`);
            vg.addColorStop(1, `rgba(0,0,0,0)`);
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < this.n; i++) {
            this.z[i] -= dz;
            if (this.z[i] <= 0.001) { this._reset(i, false); continue; }

            const zi = this.z[i];
            const sx = cx + this.x[i] / zi * focalLen;
            const sy = cy + this.y[i] / zi * focalLen;

            if (sx < -w || sx > w*2 || sy < -h || sy > h*2) { this.hasPrev[i] = 0; continue; }

            if (this.hasPrev[i]) {
                const px = this.px[i], py = this.py[i];
                const closeness = 1 - zi;
                const size      = Math.max(0.2, closeness * (p.streakWidth) * (1 + this.boost * 0.3));
                const starSat   = 30 + (1 - closeness) * 60;
                const starHue   = (hue + this.col[i] * p.colorSpread) % 360;
                const alpha     = Math.min(1, closeness * 1.8 + 0.1);

                // Chromatic fringe — draw offset red/blue strokes
                if (fringe > 0.01) {
                    const fx = (sx - px) * fringe * 0.08;
                    const fy = (sy - py) * fringe * 0.08;
                    ctx.strokeStyle = `rgba(255,80,80,${alpha*fringe*0.5})`;
                    ctx.lineWidth   = size * 0.6;
                    ctx.beginPath(); ctx.moveTo(px+fx, py+fy); ctx.lineTo(sx+fx, sy+fy); ctx.stroke();
                    ctx.strokeStyle = `rgba(80,160,255,${alpha*fringe*0.5})`;
                    ctx.beginPath(); ctx.moveTo(px-fx, py-fy); ctx.lineTo(sx-fx, sy-fy); ctx.stroke();
                }

                ctx.strokeStyle = `hsla(${starHue},${starSat}%,${70+closeness*30}%,${alpha})`;
                ctx.lineWidth   = size;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            }

            this.px[i] = sx; this.py[i] = sy; this.hasPrev[i] = 1;
        }

        ctx.restore();
    }
}

export const hyperspaceParams = () => ({
    count:       { base: 1500, min: 100,  max: 2500,  mod: { source: "" } },
    speed:       { base: 0.5,  min: 0.05, max: 4,     mod: { source: "" } },
    hue:         { base: 210,  min: 0,    max: 360,   mod: { source: "" } },
    colorSpread: { base: 60,   min: 0,    max: 180,   mod: { source: "" } },
    midShift:    { base: 30,   min: 0,    max: 120,   mod: { source: "" } },
    fov:         { base: 0.65, min: 0.2,  max: 1.8,   mod: { source: "" } },
    trail:       { base: 0.85, min: 0,    max: 1,     mod: { source: "" } },
    streakWidth: { base: 2.0,  min: 0.3,  max: 5,     mod: { source: "" } },
    fringe:      { base: 0.6,  min: 0,    max: 2,     mod: { source: "" } },
});

export function drawHyperspace(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new Hyperspace(Math.round(p.count ?? 1500)); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
