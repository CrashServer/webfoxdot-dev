// ── Reaction Diffusion ────────────────────────────────────────────────────
// Gray-Scott model (120×120). Bass seeds droplets + shifts feed rate.
// Mid shifts the color palette hue. Treble increases diffusion speed.
// 6 presets (worms/spots/coral/bubbles/mitosis/fingerprints).
// Two-color gradient mapped from V concentration.

const _state = new WeakMap();
const GW = 120, GH = 120;
const N = GW * GH;
const Du = 0.2097, Dv = 0.1050;

const PRESETS = [
    { f: 0.037, k: 0.060, name: "worms"       },
    { f: 0.014, k: 0.054, name: "spots"       },
    { f: 0.062, k: 0.061, name: "coral"       },
    { f: 0.025, k: 0.055, name: "bubbles"     },
    { f: 0.036, k: 0.063, name: "mitosis"     },
    { f: 0.012, k: 0.050, name: "fingerprints"},
];

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

// Fast inline HSL→packed ARGB
function hsl2u32(h, s, l) {
    h = ((h%360)+360)%360;
    const a2 = s * Math.min(l, 1-l);
    const f = (n) => { const k=(n+h/30)%12; return l - a2*Math.max(-1, Math.min(k-3, Math.min(9-k, 1))); };
    const r = f(0)*255|0, g = f(8)*255|0, b = f(4)*255|0;
    return (255<<24)|((b&0xff)<<16)|((g&0xff)<<8)|(r&0xff);
}

class RDViz {
    constructor() {
        this.U   = new Float32Array(N).fill(1);
        this.V   = new Float32Array(N).fill(0);
        this.U2  = new Float32Array(N);
        this.V2  = new Float32Array(N);
        this.off = new OffscreenCanvas(GW, GH);
        this.offCtx = this.off.getContext("2d");
        this.img = new ImageData(GW, GH);
        this.img32 = new Uint32Array(this.img.data.buffer);
        this.preset = -1;
        this.beatCooldown = 0;
        this._seed(); this.lastT = 0;}

    _seed() {
        this.U.fill(1); this.V.fill(0);
        for (let k = 0; k < 12; k++) {
            const cx = (Math.random()*GW)|0, cy = (Math.random()*GH)|0;
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                const i = ((cy+dy+GH)%GH)*GW+((cx+dx+GW)%GW);
                this.V[i] = 1; this.U[i] = 0.5;
            }
        }
    }

    _droplet(n) {
        for (let k = 0; k < n; k++) {
            const cx = (Math.random()*GW)|0, cy = (Math.random()*GH)|0;
            const r = 1 + Math.random()*2 | 0;
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                const i = ((cy+dy+GH)%GH)*GW+((cx+dx+GW)%GW);
                this.V[i] = 1; this.U[i] = 0.5;
            }
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble, pC) {
        const dt = Math.min(0.1, t - (this.lastT ?? t));
        this.lastT = t;

        const preset  = Math.round(Math.max(0, Math.min(5, p.preset ?? 0)));
        const hue1    = (p.hue1 ?? 200);
        const hue2    = (p.hue2 ?? 60);
        const speed   = Math.max(1, Math.min(8, Math.round(p.speed ?? 4)));
        const fMod    = p.feedMod ?? 0.5;
        const kMod    = p.killMod ?? 0;
        const invert  = p.invert > 0.5;

        if (preset !== this.preset) { this._seed(); this.preset = preset; }

        this.beatCooldown = Math.max(0, this.beatCooldown - dt);
        if (bass > 0.55 && this.beatCooldown < 0.01) {
            this._droplet(1 + (bass*4|0));
            this.beatCooldown = 0.2;
        }

        const { f, k } = PRESETS[preset];
        const fRate = f + bass * 0.008 * fMod;
        const kRate = k + treble * 0.004 * kMod;
        const duScale = 1 + treble*0.3;
        const dvScale = 1 + treble*0.3;

        const U = this.U, V = this.V, U2 = this.U2, V2 = this.V2;

        for (let step = 0; step < speed; step++) {
            for (let y = 0; y < GH; y++) {
                const yn = (y===0?GH-1:y-1)*GW, yc = y*GW, yp = (y===GH-1?0:y+1)*GW;
                for (let x = 0; x < GW; x++) {
                    const xn = x===0?GW-1:x-1, xp = x===GW-1?0:x+1;
                    const i = yc+x;
                    const lu = U[yn+x]+U[yp+x]+U[yc+xn]+U[yc+xp]-4*U[i];
                    const lv = V[yn+x]+V[yp+x]+V[yc+xn]+V[yc+xp]-4*V[i];
                    const uvv = U[i]*V[i]*V[i];
                    U2[i] = Math.max(0,Math.min(1, U[i]+Du*duScale*lu-uvv+fRate*(1-U[i])));
                    V2[i] = Math.max(0,Math.min(1, V[i]+Dv*dvScale*lv+uvv-(fRate+kRate)*V[i]));
                }
            }
            U.set(U2); V.set(V2);
        }

        const img32 = this.img32;
        const hueRange = ((hue2-hue1+540)%360);
        if (pC) {
            // Palette mode: map V concentration to palette color
            const data8 = this.img.data;
            for (let i = 0; i < N; i++) {
                const v = invert ? (1-V[i]) : V[i];
                const norm = Math.max(0, Math.min(1, v));
                const hex = pC(norm).replace("#","");
                const o = i * 4;
                data8[o]   = parseInt(hex.slice(0,2),16);
                data8[o+1] = parseInt(hex.slice(2,4),16);
                data8[o+2] = parseInt(hex.slice(4,6),16);
                data8[o+3] = 255;
            }
        } else {
        for (let i = 0; i < N; i++) {
            const v = invert ? (1-V[i]) : V[i];
            const norm = Math.max(0, Math.min(1, v));
            const hue3 = hue1 + norm*hueRange + mid*40;
            const light = 0.08 + norm*0.72;
            img32[i] = hsl2u32(hue3, 0.9, light);
        }
        }
        this.offCtx.putImageData(this.img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.off, 0, 0, w, h);
    }
}

export const reactionDiffusionParams = () => ({
    preset:   { base: 0,   min: 0,   max: 5,   mod: { source: "" } },
    speed:    { base: 4,   min: 1,   max: 8,   mod: { source: "" } },
    hue1:     { base: 220, min: 0,   max: 360, mod: { source: "" } },
    hue2:     { base: 60,  min: 0,   max: 360, mod: { source: "" } },
    feedMod:  { base: 0.5, min: 0,   max: 2,   mod: { source: "" } },
    killMod:  { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
    invert:   { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    dropRate: { base: 1,   min: 0,   max: 5,   mod: { source: "" } },
    brightness:{ base: 1,  min: 0.2, max: 3,   mod: { source: "" } },
    contrast: { base: 1,   min: 0.5, max: 3,   mod: { source: "" } },
    usePalette: { base: 0, min: 0,   max: 1,   mod: { source: "" } },
});

export function drawReactionDiffusion(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new RDViz(); _state.set(ctx, viz); }
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue1 ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, bassLevel(sp), midLevel(sp), trebleLevel(sp), _pal ? pC : null);
}
