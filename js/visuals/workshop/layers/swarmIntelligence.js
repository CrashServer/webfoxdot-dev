// ── Swarm Intelligence ────────────────────────────────────────────────────────
// Boids flocking: separation, alignment, cohesion. Boids chase drifting food;
// red predators scatter the flock. Audio boosts speed and spawns predators.
// Ported from web/src/layers/swarmIntelligence.js (Canvas2D).

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

class SwarmViz {
    constructor(w, h) {
        this.boids = [];
        this.food  = [];
        this.preds = [];
        this._lastBeat = -1;
        this._w = w; this._h = h;
        this._syncBoids(160, w, h);
        for (let i = 0; i < 3; i++) this.food.push({ x: rnd(0, w), y: rnd(0, h) });
    }

    _syncBoids(n, w, h) {
        while (this.boids.length < n)
            this.boids.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-30, 30), vy: rnd(-30, 30), hue: rnd(160, 220) });
        if (this.boids.length > n) this.boids.length = n;
    }

    frame(ctx, w, h, p, t, audio, bass) {
        const dt = 1 / 60, U = Math.min(w, h);
        const speed    = p.speed    ?? 1;
        const cohesion = p.cohesion ?? 1;
        const trail    = p.trail    ?? 1;
        const glow     = p.glow     ?? 1;
        const hue      = p.hue      ?? 190;
        const n        = Math.max(20, Math.min(200, Math.round(p.boidCount ?? 160)));

        this._syncBoids(n, w, h);

        const beat = Math.floor(t * 0.5);
        if (beat !== this._lastBeat) {
            this._lastBeat = beat;
            if (this.food.length < 8) this.food.push({ x: rnd(0, w), y: rnd(0, h) });
        }
        if (bass > 0.55 && Math.random() < 0.06 && this.preds.length < 4)
            this.preds.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-40, 40), vy: rnd(-40, 40), life: rnd(4, 9) });

        ctx.fillStyle = `rgba(2,6,10,${0.5 / Math.max(0.1, trail)})`;
        ctx.fillRect(0, 0, w, h);

        const sepR = U * 0.03, viewR = U * 0.09, maxV = U * 0.25 * speed;

        for (let pi = 0; pi < this.preds.length; pi++) {
            const pr = this.preds[pi];
            pr.life -= dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
            if (pr.x < 0 || pr.x > w) pr.vx *= -1;
            if (pr.y < 0 || pr.y > h) pr.vy *= -1;
            ctx.fillStyle   = "rgba(255,60,70,0.9)";
            ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, U * 0.012, 0, 6.28); ctx.fill();
            ctx.shadowBlur = 0;
        }
        this.preds = this.preds.filter((pr) => pr.life > 0);

        for (let fi = 0; fi < this.food.length; fi++) {
            const f = this.food[fi];
            ctx.fillStyle = `hsla(${(hue + 60) % 360},80%,65%,0.9)`;
            ctx.beginPath(); ctx.arc(f.x, f.y, U * 0.007, 0, 6.28); ctx.fill();
        }

        const B = this.boids;
        for (let bi = 0; bi < B.length; bi++) {
            const b = B[bi];
            let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, nc = 0;
            for (let oi = 0; oi < B.length; oi++) {
                if (oi === bi) continue;
                const o = B[oi];
                const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy);
                if (d > viewR || d === 0) continue;
                if (d < sepR) { sx += dx / d; sy += dy / d; }
                ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; nc++;
            }
            if (nc) {
                b.vx += (sx * 40 + (ax / nc - b.vx) * 0.05 + (cx / nc - b.x) * 0.0008 * cohesion) * dt * 60;
                b.vy += (sy * 40 + (ay / nc - b.vy) * 0.05 + (cy / nc - b.y) * 0.0008 * cohesion) * dt * 60;
            }

            let fn = -1, fd = 1e9;
            for (let fi = 0; fi < this.food.length; fi++) {
                const f = this.food[fi], d = Math.hypot(b.x - f.x, b.y - f.y);
                if (d < fd) { fd = d; fn = fi; }
            }
            if (fn >= 0) {
                const f = this.food[fn];
                b.vx += (f.x - b.x) * 0.0015 * dt * 60;
                b.vy += (f.y - b.y) * 0.0015 * dt * 60;
                if (fd < U * 0.015) { f.x = rnd(0, w); f.y = rnd(0, h); }
            }

            for (let pi = 0; pi < this.preds.length; pi++) {
                const pr = this.preds[pi];
                const dx = b.x - pr.x, dy = b.y - pr.y, d = Math.hypot(dx, dy);
                if (d < U * 0.12 && d > 0) { b.vx += dx / d * 60 * dt * 60; b.vy += dy / d * 60 * dt * 60; }
            }

            const sp = Math.hypot(b.vx, b.vy) || 1;
            const cl = Math.min(maxV, sp) * (1 + audio * 0.3);
            b.vx = b.vx / sp * cl; b.vy = b.vy / sp * cl;
            b.x += b.vx * dt; b.y += b.vy * dt;
            const m = U * 0.02;
            if (b.x < -m) b.x = w + m; if (b.x > w + m) b.x = -m;
            if (b.y < -m) b.y = h + m; if (b.y > h + m) b.y = -m;

            const ang = Math.atan2(b.vy, b.vx), r = U * 0.006;
            ctx.fillStyle = `hsla(${b.hue},80%,65%,0.9)`;
            ctx.beginPath();
            ctx.moveTo(b.x + Math.cos(ang) * r * 2,       b.y + Math.sin(ang) * r * 2);
            ctx.lineTo(b.x + Math.cos(ang + 2.5) * r,     b.y + Math.sin(ang + 2.5) * r);
            ctx.lineTo(b.x + Math.cos(ang - 2.5) * r,     b.y + Math.sin(ang - 2.5) * r);
            ctx.closePath(); ctx.fill();
        }
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

export const swarmIntelligenceParams = () => ({
    speed:     { base: 1,   min: 0.2, max: 3,   mod: { source: "" } },
    cohesion:  { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
    trail:     { base: 1,   min: 0.1, max: 3,   mod: { source: "" } },
    glow:      { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    boidCount: { base: 160, min: 20,  max: 200, mod: { source: "" } },
    hue:       { base: 190, min: 0,   max: 360, mod: { source: "" } },
});

export function drawSwarmIntelligence(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new SwarmViz(w, h); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp));
}
