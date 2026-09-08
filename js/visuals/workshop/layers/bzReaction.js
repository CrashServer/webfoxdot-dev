// ── Belousov-Zhabotinsky Reaction ─────────────────────────────────────────
// Greenberg-Hastings 3-state cellular automaton: quiescent → excited → refractory.
// Bass lowers excitation threshold (faster wave propagation).
// Mid shifts the chromatic palette, treble increases grid resolution.
// Multiple color themes, optional glow pass, spontaneous ignition.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

const K = 5; // excitation states
const TOTAL = 2*K + 1;

// Color themes: fn(state, K, hue, mid) → [r,g,b]
const THEMES = [
    // 0: chemical – cyan excited, magenta refractory
    (s, K2, h, mid2) => {
        if (s === 0) return [4,6,12];
        if (s <= K2) {
            const f = s/K2;
            const hue2 = (h + f*80 + mid2*60) % 360;
            return hsl2rgb(hue2, 0.9, 0.15+f*0.65);
        }
        const f = (s-K2)/K2;
        return hsl2rgb((h+180+f*40)%360, 0.7, 0.05+f*0.18);
    },
    // 1: neon – bright saturated
    (s, K2, h, mid2) => {
        if (s === 0) return [2,2,5];
        if (s <= K2) {
            const f = s/K2;
            return hsl2rgb((h+f*120+mid2*80)%360, 1.0, 0.2+f*0.6);
        }
        const f = (s-K2)/K2;
        return hsl2rgb((h+240)%360, 0.5, 0.03+f*0.1);
    },
    // 2: lava – fire tones
    (s, K2, h, mid2) => {
        if (s === 0) return [3,1,1];
        if (s <= K2) {
            const f = s/K2;
            return hsl2rgb((h+f*60+mid2*30)%360, 0.95, 0.1+f*0.7);
        }
        const f = (s-K2)/K2;
        return hsl2rgb((h+30)%360, 0.4, 0.04+f*0.12);
    },
];

function hsl2rgb(h, s, l) {
    const a = s*Math.min(l, 1-l);
    const f = (n) => { const k=(n+h/30)%12; return l-a*Math.max(-1, Math.min(k-3, Math.min(9-k, 1))); };
    return [f(0)*255|0, f(8)*255|0, f(4)*255|0];
}

class BZViz {
    constructor(gs) {
        this.gs = gs;
        this.a = new Uint8Array(gs*gs);
        this.b = new Uint8Array(gs*gs);
        this.off = null; this.offCtx = null;
        this.img = null; this.img32 = null;
        this.flip = 0;
        this.beatCooldown = 0;
        this._seed(gs);
        this._mkOff(gs);
    }

    _seed(gs) {
        for (let i = 0; i < gs*gs; i++) this.a[i] = Math.random()<0.08 ? (1+Math.random()*K*2|0) : 0;
    }

    _mkOff(gs) {
        this.off = new OffscreenCanvas(gs, gs);
        this.offCtx = this.off.getContext("2d");
        this.img = new ImageData(gs, gs);
        this.img32 = new Uint32Array(this.img.data.buffer);
    }

    _resize(gs) {
        if (gs === this.gs) return;
        this.gs = gs;
        this.a = new Uint8Array(gs*gs);
        this.b = new Uint8Array(gs*gs);
        this._seed(gs); this._mkOff(gs);
        this.flip = 0;
    }

    frame(ctx, w, h, p, bass, mid, treble) {
        const _now = performance.now() / 1000;
        if (!this.lastT) this.lastT = _now;
        const dt = Math.min(0.05, Math.max(0, _now - this.lastT)); this.lastT = _now;
        const gs   = Math.max(80, Math.min(300, Math.round(p.size ?? 180)));
        const spd  = Math.max(1, Math.min(10, Math.round(p.speed ?? 2)));
        const thr  = Math.max(1, Math.min(K, Math.round(p.threshold ?? 2)));
        const hue  = p.hue ?? 180;
        const themeIdx = Math.round(p.theme ?? 0) % 3;
        const ignite = p.ignite ?? 0.001;
        const smooth = p.smooth > 0.5;

        this._resize(gs);

        this.beatCooldown = Math.max(0, this.beatCooldown - dt);
        // Bass lowers threshold + can ignite new spirals
        const effThr = Math.max(1, thr - (bass > 0.6 ? 1 : 0) - (bass > 0.85 ? 1 : 0));
        if (bass > 0.5 && this.beatCooldown < 0.01) {
            // Spark a cluster
            const cx = (Math.random()*gs)|0, cy = (Math.random()*gs)|0;
            const i = cy*gs+cx; this.a[i] = 1;
            this.beatCooldown = 0.15;
        }

        const themeFn = THEMES[themeIdx];

        for (let step = 0; step < spd; step++) {
            const src = this.flip%2===0 ? this.a : this.b;
            const dst = this.flip%2===0 ? this.b : this.a;
            this.flip++;

            for (let y = 0; y < gs; y++) {
                const yn = (y===0?gs-1:y-1)*gs;
                const yc = y*gs;
                const yp = (y===gs-1?0:y+1)*gs;
                for (let x = 0; x < gs; x++) {
                    const xn = x===0?gs-1:x-1, xp = x===gs-1?0:x+1;
                    const cur = src[yc+x];
                    if (cur === 0) {
                        // Count excited (1..K) neighbours
                        let exc = 0;
                        const nb = [src[yn+xn],src[yn+x],src[yn+xp],src[yc+xn],src[yc+xp],src[yp+xn],src[yp+x],src[yp+xp]];
                        for (let ni = 0; ni < 8; ni++) if (nb[ni]>=1 && nb[ni]<=K) exc++;
                        // Treble adds spontaneous ignition sensitivity
                        const spont = ignite + treble*0.003;
                        dst[yc+x] = (exc >= effThr || Math.random() < spont*0.001) ? 1 : 0;
                    } else {
                        dst[yc+x] = (cur+1) % TOTAL;
                    }
                }
            }
        }
        const grid = this.flip%2===0 ? this.a : this.b;

        const img32 = this.img32;
        for (let i = 0; i < gs*gs; i++) {
            const [r,g,b] = themeFn(grid[i], K, hue + mid*60, mid);
            img32[i] = (255<<24)|((b&0xff)<<16)|((g&0xff)<<8)|(r&0xff);
        }
        this.offCtx.putImageData(this.img, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = smooth;
        ctx.drawImage(this.off, 0, 0, w, h);

        // Optional glow pass via lighter composite
        if (p.glow > 0.05) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = p.glow * 0.15;
            ctx.drawImage(this.off, -2, -2, w+4, h+4);
            ctx.drawImage(this.off, 2, 2, w+4, h+4);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
        }
    }
}

export const bzReactionParams = () => ({
    hue:       { base: 180,  min: 0,   max: 360, mod: { source: "" } },
    speed:     { base: 2,    min: 1,   max: 10,  mod: { source: "" } },
    threshold: { base: 2,    min: 1,   max: 5,   mod: { source: "" } },
    size:      { base: 180,  min: 60,  max: 300, mod: { source: "" } },
    theme:     { base: 0,    min: 0,   max: 2,   mod: { source: "" } },
    glow:      { base: 0.4,  min: 0,   max: 2,   mod: { source: "" } },
    ignite:    { base: 0.001,min: 0,   max: 0.1, mod: { source: "" } },
    smooth:    { base: 0,    min: 0,   max: 1,   mod: { source: "" } },
    saturation:{ base: 1,    min: 0,   max: 2,   mod: { source: "" } },
    contrast:  { base: 1,    min: 0.5, max: 3,   mod: { source: "" } },
});

export function drawBzReaction(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = new BZViz(Math.round(p.size ?? 180)); _state.set(ctx, st); }
    const sp = extra?.spectrum;
    st.frame(ctx, w, h, p, bassLevel(sp), midLevel(sp), trebleLevel(sp));
}
