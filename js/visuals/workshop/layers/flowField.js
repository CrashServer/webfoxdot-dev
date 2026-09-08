// ── Flow Field layer ──────────────────────────────────────────────────────
// Curl-noise particle flow field with long fading trails.
// Bass = field strength, mid = color/hue rotation, treble = turbulence layer.
// Multiple field modes (curl/radial/spiral/chaos). Typed-array particle state.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

// Smooth noise basis
function noise2(x, y) { return Math.sin(x*1.71+Math.cos(y*2.37))*Math.cos(y*1.43+Math.sin(x*1.13)); }
function noise3(x, y, t) { return noise2(x+t*0.03, y)*0.6 + noise2(x*2.1-t*0.05, y*2.1+t*0.04)*0.4; }

// Curl field: ddx of noise gives divergence-free field (no sinks)
function curlField(x, y, t, turb, bass, mode) {
    const eps = 1.5;
    let ang;
    if (mode < 1) {
        // Curl noise
        const n1 = noise3(x, y+eps, t);
        const n2 = noise3(x, y-eps, t);
        const n3 = noise3(x+eps, y, t);
        const n4 = noise3(x-eps, y, t);
        const cx = (n1-n2)/(2*eps);
        const cy = -(n3-n4)/(2*eps);
        ang = Math.atan2(cy, cx);
    } else if (mode < 2) {
        // Radial spiral
        const cx2 = x - 0.5, cy2 = y - 0.5;
        ang = Math.atan2(cy2, cx2) + noise3(x, y, t)*1.5 + t*0.1;
    } else if (mode < 3) {
        // Lissajous flow
        ang = Math.sin(x*4+t*0.5)*Math.cos(y*3-t*0.4)*Math.PI + noise3(x,y,t)*turb*0.8;
    } else {
        // Chaos: multiple interfering fields
        const a1 = noise3(x*1.5, y, t)*Math.PI*2;
        const a2 = noise3(x, y*1.5, t+10)*Math.PI*2;
        ang = (a1+a2)*0.5;
    }
    // Treble adds high-freq turbulence layer
    ang += noise2(x*6+t*0.15, y*6)*turb*0.6;
    // Bass stretches field
    ang += bass * 0.4 * Math.sin(x*2+y*2+t);
    return ang;
}

class FlowField {
    constructor(n, w, h) {
        this.n = n;
        this.px = new Float32Array(n);
        this.py = new Float32Array(n);
        this.age = new Float32Array(n);
        this.hueDelta = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            this.px[i] = Math.random()*w;
            this.py[i] = Math.random()*h;
            this.age[i] = Math.random()*60;
            this.hueDelta[i] = (Math.random()-0.5)*60;
        }
        this.w = w; this.h = h;
    }

    resize(n, w, h) {
        const old = { px: this.px, py: this.py, n: this.n };
        this.n = n; this.w = w; this.h = h;
        this.px = new Float32Array(n); this.py = new Float32Array(n);
        this.age = new Float32Array(n); this.hueDelta = new Float32Array(n);
        const cp = Math.min(old.n, n);
        this.px.set(old.px.subarray(0,cp));
        this.py.set(old.py.subarray(0,cp));
        for (let i = cp; i < n; i++) {
            this.px[i] = Math.random()*w; this.py[i] = Math.random()*h;
            this.age[i] = Math.random()*60; this.hueDelta[i] = (Math.random()-0.5)*60;
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble, _pal, pC) {
        const n = Math.max(200, Math.min(4000, Math.round(p.density)));
        if (n !== this.n || w !== this.w || h !== this.h) this.resize(n, w, h);

        ctx.fillStyle = `rgba(0,0,0,${Math.max(0.005, p.fadeRate)})`;
        ctx.fillRect(0, 0, w, h);

        const speed   = p.speed * (1 + bass*2.5);
        const turb    = p.turbulence * (1 + treble*2.5);
        const hue     = p.hue + mid * 60;
        const step    = Math.min(w,h)*0.0045*speed;
        const mode    = p.mode ?? 0;
        const lineW   = p.lineWidth ?? 1;
        const maxAge  = p.maxAge ?? 120;
        const palette = p.palette ?? 0;
        // Normalised coords for field
        const iw = 1/w, ih = 1/h;

        ctx.lineWidth = lineW;
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < this.n; i++) {
            let x = this.px[i], y = this.py[i];
            const ang = curlField(x*iw, y*ih, t, turb, bass, mode);
            const nx = x + Math.cos(ang)*step;
            const ny = y + Math.sin(ang)*step;
            const wx = ((nx%w)+w)%w, wy = ((ny%h)+h)%h;

            this.age[i]++;
            if (this.age[i] > maxAge || (Math.abs(nx-wx)>4||Math.abs(ny-wy)>4)) {
                this.px[i] = Math.random()*w; this.py[i] = Math.random()*h;
                this.age[i] = 0; this.hueDelta[i] = (Math.random()-0.5)*80;
                continue;
            }

            const life = Math.sin(Math.PI * this.age[i]/maxAge);
            const h2 = (hue + this.hueDelta[i] + treble*30) % 360;
            const brt = 45 + bass*25;
            let col;
            if (_pal) {
                // Color by normalized particle age
                col = pC(this.age[i] / maxAge);
            } else if (palette < 1) col = `hsla(${h2},80%,${brt}%,${life*0.6})`;
            else if (palette < 2) col = `hsla(${(h2+180)%360},60%,${brt+10}%,${life*0.5})`;
            else col = `hsla(${h2},100%,${brt+15}%,${life*0.4})`;

            ctx.strokeStyle = col;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(wx,wy); ctx.stroke();
            this.px[i] = wx; this.py[i] = wy;
        }
        ctx.globalCompositeOperation = "source-over";
    }
}

export const flowFieldParams = () => ({
    hue:        { base: 200,  min: 0,    max: 360,  mod: { source: "" } },
    speed:      { base: 0.6,  min: 0.05, max: 4,    mod: { source: "" } },
    density:    { base: 2500, min: 200,  max: 4000, mod: { source: "" } },
    turbulence: { base: 1.0,  min: 0,    max: 5,    mod: { source: "" } },
    fadeRate:   { base: 0.03, min: 0.003,max: 0.5,  mod: { source: "" } },
    lineWidth:  { base: 1,    min: 0.3,  max: 4,    mod: { source: "" } },
    maxAge:     { base: 120,  min: 20,   max: 400,  mod: { source: "" } },
    mode:       { base: 0,    min: 0,    max: 3,    mod: { source: "" } },
    palette:    { base: 0,    min: 0,    max: 2,    mod: { source: "" } },
    brightness: { base: 1,    min: 0.1,  max: 3,    mod: { source: "" } },
    usePalette: { base: 0,   min: 0,    max: 1,    mod: { source: "" } },
});

export function drawFlowField(ctx, w, h, p, t, extra) {
    let ff = _state.get(ctx);
    const n = Math.round(p.density ?? 2500);
    if (!ff) { ff = new FlowField(n, w, h); _state.set(ctx, ff); }
    const s = extra?.spectrum;
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    ff.frame(ctx, w, h, p, t, bassLevel(s), midLevel(s), trebleLevel(s), _pal, pC);
}
