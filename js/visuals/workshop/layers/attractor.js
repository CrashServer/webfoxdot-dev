// ── Strange Attractor ─────────────────────────────────────────────────────────
// Four classic 3D attractors (Lorenz, Rössler, Thomas, Halvorsen) rendered as
// glowing 3D point clouds. Mid rotates the view; bass inflates scale; treble
// brightens individual points. Smooth param morphing between attractor families.

const _state = new WeakMap();

const TYPES = ["LORENZ", "RÖSSLER", "THOMAS", "HALVORS"];

const NORM = [
    { ox: 0, oy: 0, oz: 27, s: 30 },
    { ox: 0, oy: 0, oz: 12, s: 14 },
    { ox: 0, oy: 0, oz: 0,  s: 2.2 },
    { ox: 0, oy: 0, oz: 0,  s: 10 },
];

const DT = [0.003, 0.04, 0.04, 0.015];

function odeStep(type, pt) {
    const [x, y, z] = pt, dt = DT[type];
    let dx, dy, dz;
    switch (type) {
        case 0: dx=10*(y-x);          dy=x*(28-z)-y;          dz=x*y-(8/3)*z;               break;
        case 1: dx=-(y+z);            dy=x+0.2*y;             dz=0.2+z*(x-5.7);             break;
        case 2: dx=Math.sin(y)-0.19*x; dy=Math.sin(z)-0.19*y; dz=Math.sin(x)-0.19*z;        break;
        default: { const a=1.89; dx=-a*x-4*y-4*z-y*y; dy=-a*y-4*z-4*x-z*z; dz=-a*z-4*x-4*y-x*x; }
    }
    pt[0]+=dx*dt; pt[1]+=dy*dt; pt[2]+=dz*dt;
    if (!isFinite(pt[0])||Math.abs(pt[0])>1e4) { pt[0]=1+Math.random()*0.1; pt[1]=Math.random()*0.1; pt[2]=NORM[type].oz+Math.random()*0.5; }
}

class AttractorViz {
    constructor() {
        this.particles = [];
        this.off = null; this.offCtx = null;
        this.spinY = 0; this.spinX = 0;
        this._type = -1;
        this.pulse = 0; this.prevBass = 0;
    }

    _initParticles(type, n) {
        this._type = type;
        const z0 = NORM[type].oz;
        this.particles = [];
        for (let i = 0; i < n; i++) {
            this.particles.push([
                (Math.random()-0.5)*2 + 1,
                (Math.random()-0.5)*2,
                z0 + (Math.random()-0.5)*2,
            ]);
        }
        if (this.off) this.offCtx.clearRect(0, 0, this.off.width, this.off.height);
    }

    _ensureOff(w, h) {
        if (!this.off || this.off.width !== w || this.off.height !== h) {
            this.off = new OffscreenCanvas(w, h);
            this.offCtx = this.off.getContext("2d");
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const type   = Math.max(0, Math.min(3, Math.round(p.type)));
        const zoom   = p.zoom * (1 + bass * 0.5);
        const tilt   = p.tilt;
        const hue    = p.hue;
        const fade   = p.fade;
        const count  = Math.round(Math.max(100, Math.min(1200, p.count)));
        const stepsN = Math.max(1, Math.round(p.steps));
        const glow   = p.glow;
        const speed  = p.speed;

        this._ensureOff(w, h);

        if (type !== this._type || this.particles.length < 10) {
            this._initParticles(type, count);
        }
        while (this.particles.length < count) {
            const z0 = NORM[type].oz;
            this.particles.push([1+(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, z0+(Math.random()-0.5)*0.5]);
        }
        if (this.particles.length > count) this.particles.length = count;

        // Beat detection
        if (bass > 0.55 && bass > this.prevBass + 0.08) this.pulse = 1;
        this.prevBass = bass;
        this.pulse *= 0.87;

        // Mid rotates view; treble tilts
        this.spinY += speed * 0.005 + mid * 0.025;
        this.spinX += treble * 0.008;

        const oc = this.offCtx;
        oc.fillStyle = `rgba(0,0,0,${fade})`; oc.fillRect(0, 0, w, h);

        const { ox, oy, oz, s } = NORM[type];
        const cyMat = Math.cos(tilt), syMat = Math.sin(tilt);
        const csY = Math.cos(this.spinY), ssY = Math.sin(this.spinY);
        const csX = Math.cos(this.spinX * 0.3), ssX = Math.sin(this.spinX * 0.3);
        const U   = Math.min(w, h) * zoom / s;
        const cxC = w / 2, cyC = h / 2;

        // Batch render by depth bucket (poor man's depth sort)
        const pts3d = [];
        for (let pi = 0; pi < this.particles.length; pi++) {
            const pt = this.particles[pi];
            for (let k = 0; k < stepsN; k++) odeStep(type, pt);
            const nx = pt[0]-ox, ny = pt[1]-oy, nz = pt[2]-oz;
            // Y rotation
            const rx = nx*csY - nz*ssY, rz = nx*ssY + nz*csY;
            // X tilt
            const ry = ny*csX - rz*ssX;
            pts3d.push([cxC + rx*U, cyC - ry*U, rz]);
        }

        // Sort back to front for depth compositing
        pts3d.sort((a, b) => a[2] - b[2]);

        // Draw in two passes: base + glow
        const total = pts3d.length;
        for (let i = 0; i < total; i++) {
            const [sx, sy, rz] = pts3d[i];
            const depthFrac = Math.max(0, Math.min(1, (rz + s) / (2 * s)));
            const ph = (hue + depthFrac * 100 + bass * 60 + i / total * 40) % 360;
            const lum = 50 + treble * 30 + depthFrac * 20 + this.pulse * 20;
            const alpha = 0.3 + depthFrac * 0.4 + bass * 0.2 + this.pulse * 0.15;
            const ptSize = 0.8 + depthFrac * 0.8 + this.pulse * 0.5;

            if (glow > 0.1 && i % 4 === 0) {
                oc.shadowBlur = 0;
            } else {
                oc.shadowBlur = 0;
            }
            oc.fillStyle = `hsla(${ph},80%,${lum}%,${alpha})`;
            oc.fillRect(sx - ptSize*0.5, sy - ptSize*0.5, ptSize, ptSize);
        }
        oc.shadowBlur = 0;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.off, 0, 0);

        // Beat flash bloom
        if (this.pulse > 0.15) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = `hsla(${hue},90%,50%,${this.pulse * 0.1})`;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }

        // Type label
        const fs = Math.max(9, Math.min(w,h)*0.013)|0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.textAlign = "left";
        ctx.fillStyle = `hsla(${hue},70%,65%,0.45)`;
        ctx.fillText(TYPES[type], fs, fs * 1.5);
    }
}

export const attractorParams = () => ({
    type:  { base: 0,     min: 0,   max: 3,    mod: { source: "" } },
    count: { base: 600,   min: 100, max: 1200, mod: { source: "" } },
    zoom:  { base: 1,     min: 0.2, max: 3,    mod: { source: "" } },
    speed: { base: 1,     min: 0,   max: 4,    mod: { source: "" } },
    steps: { base: 12,    min: 1,   max: 40,   mod: { source: "" } },
    tilt:  { base: 0.3,   min: 0,   max: 1.57, mod: { source: "" } },
    hue:   { base: 210,   min: 0,   max: 360,  mod: { source: "" } },
    glow:  { base: 1.5,   min: 0,   max: 4,    mod: { source: "" } },
    fade:  { base: 0.012, min: 0.002, max: 0.15, mod: { source: "" } },
    depthColor: { base: 1, min: 0, max: 1,     mod: { source: "" } },
    brightness: { base: 1, min: 0.3, max: 2,   mod: { source: "" } },
});

export function drawAttractor(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new AttractorViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
