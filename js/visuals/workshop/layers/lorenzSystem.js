// ── Lorenz System ─────────────────────────────────────────────────────────────
// Lorenz butterfly attractor — hundreds of independent trajectories rendered as
// glowing trails on a persistent offscreen buffer. Bass shifts rho (chaos level),
// mid rotates the projection plane, treble increases trail speed + brightness.

const _state = new WeakMap();

const SIGMA = 10, BETA = 8 / 3;

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0)*255, f(8)*255, f(4)*255];
}

class LorenzViz {
    constructor() {
        this.pts = [];
        this.trails = [];
        this.off = null; this.offCtx = null;
        this.projAngle = 0;
        this._count = 0;
    }

    _ensureOff(w, h) {
        if (!this.off || this.off.width !== w || this.off.height !== h) {
            this.off = new OffscreenCanvas(w, h);
            this.offCtx = this.off.getContext("2d");
            this.offCtx.fillStyle = "#000";
            this.offCtx.fillRect(0, 0, w, h);
        }
    }

    _initParticles(n) {
        while (this.pts.length < n) {
            this.pts.push({
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
                z: 20 + Math.random() * 15,
                trail: [],
                hueOffset: Math.random() * 360,
            });
        }
        if (this.pts.length > n) this.pts.length = n;
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const count  = Math.round(Math.max(10, Math.min(400, p.count)));
        const speed  = p.speed * (1 + treble * 1.2);
        const hue    = p.hue;
        const glow   = p.glow;
        const fade   = p.fade;
        const trailLen = Math.round(p.trailLength);
        const spread = p.spread;
        // Bass pushes rho — near 24.74 is periodic, >28 is chaotic
        const rho    = p.rho + bass * 18;
        // Mid rotates the 3D projection plane
        this.projAngle += (mid * 0.04 + p.rotateSpeed * 0.005);
        const ca = Math.cos(this.projAngle), sa = Math.sin(this.projAngle);
        const tiltAng = p.tilt * 0.5;
        const ct = Math.cos(tiltAng), st = Math.sin(tiltAng);

        this._ensureOff(w, h);
        this._initParticles(count);

        const oc = this.offCtx;
        oc.fillStyle = `rgba(0,0,0,${fade})`; oc.fillRect(0, 0, w, h);

        const dt   = 0.005 * speed;
        const scale = Math.min(w, h) * 0.011 * p.zoom;
        const cx   = w * 0.5, cy = h * 0.52;

        // Draw trails
        for (let i = 0; i < this.pts.length; i++) {
            const pt = this.pts[i];
            // Integrate Lorenz ODE
            const steps = Math.max(1, Math.round(1 + treble * 2));
            for (let s = 0; s < steps; s++) {
                const dx = SIGMA * (pt.y - pt.x);
                const dy = pt.x * (rho - pt.z) - pt.y;
                const dz = pt.x * pt.y - BETA * pt.z;
                pt.x += dx * dt; pt.y += dy * dt; pt.z += dz * dt;
                if (!isFinite(pt.x) || Math.abs(pt.x) > 200) {
                    pt.x = (Math.random()-0.5)*2; pt.y = (Math.random()-0.5)*2; pt.z = 20+Math.random()*15;
                    pt.trail = [];
                }
            }

            // Project: Y-axis rotation, then X-axis tilt
            const rx = pt.x * ca - pt.z * sa;
            const rz = pt.x * sa + pt.z * ca;
            const ry = pt.y * ct - rz * st;

            const sx = cx + rx * scale;
            const sy = cy - (ry - 0) * scale;

            pt.trail.push([sx, sy, pt.z]);
            if (pt.trail.length > trailLen) pt.trail.shift();

            if (pt.trail.length < 2) continue;

            // Draw trail as gradient stroke
            const speedMag = Math.sqrt(
                (SIGMA*(pt.y-pt.x))**2 + (pt.x*(rho-pt.z)-pt.y)**2
            );
            const speedFrac = Math.min(1, speedMag / 30);
            const hueShift  = (hue + pt.hueOffset * spread + speedFrac * 80 + bass * 50) % 360;

            oc.beginPath();
            oc.moveTo(pt.trail[0][0], pt.trail[0][1]);
            for (let k = 1; k < pt.trail.length; k++) oc.lineTo(pt.trail[k][0], pt.trail[k][1]);

            if (glow > 0) {oc.shadowBlur = 0; }
            const alpha = 0.4 + speedFrac * 0.4 + bass * 0.2;
            oc.strokeStyle = `hsla(${hueShift},85%,${55 + treble * 25}%,${alpha})`;
            oc.lineWidth = 0.8 + bass * 1.2 + treble * 0.5;
            oc.stroke();
        }
        oc.shadowBlur = 0;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.off, 0, 0);

        // Additive glow bloom on beats
        if (bass > 0.5) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = `hsla(${hue},90%,40%,${bass * 0.06})`;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const lorenzSystemParams = () => ({
    count:       { base: 120,  min: 10,   max: 400,  mod: { source: "" } },
    speed:       { base: 1,    min: 0.1,  max: 5,    mod: { source: "" } },
    rho:         { base: 28,   min: 10,   max: 60,   mod: { source: "" } },
    zoom:        { base: 1,    min: 0.3,  max: 3,    mod: { source: "" } },
    tilt:        { base: 0.4,  min: 0,    max: 3.14, mod: { source: "" } },
    rotateSpeed: { base: 0.5,  min: -4,   max: 4,    mod: { source: "" } },
    trailLength: { base: 30,   min: 2,    max: 120,  mod: { source: "" } },
    hue:         { base: 200,  min: 0,    max: 360,  mod: { source: "" } },
    spread:      { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } },
    glow:        { base: 1.5,  min: 0,    max: 4,    mod: { source: "" } },
    fade:        { base: 0.03, min: 0.003, max: 0.3, mod: { source: "" } },
    brightness:  { base: 1,    min: 0.3,  max: 2,    mod: { source: "" } },
});

export function drawLorenzSystem(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new LorenzViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
