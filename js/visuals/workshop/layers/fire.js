// ── Fire layer ────────────────────────────────────────────────────────────
// Heat-grid fire sim: seed bottom rows, propagate upward with cooling.
// Three palette modes (classic/acid/plasma), ember particles, wind drift.

const _state = new WeakMap();
const GW = 160, GH = 120;

const PALETTES = [
    // classic: black → red → orange → yellow → white
    (i) => {
        if (i < 64)  { const f = i/64;  return [f*200|0, 0, 0, 255]; }
        if (i < 128) { const f = (i-64)/64;  return [200+f*55|0, f*100|0, 0, 255]; }
        if (i < 200) { const f = (i-128)/72; return [255, 100+f*155|0, f*30|0, 255]; }
        const f = (i-200)/55; return [255, 255, f*255|0, 255];
    },
    // acid: dark green → lime → yellow-green → white
    (i) => {
        if (i < 64)  { const f = i/64;  return [0, f*120|0, 0, 255]; }
        if (i < 128) { const f = (i-64)/64;  return [f*80|0, 120+f*135|0, 0, 255]; }
        if (i < 200) { const f = (i-128)/72; return [80+f*175|0, 255, f*80|0, 255]; }
        const f = (i-200)/55; return [255, 255, 80+f*175|0, 255];
    },
    // plasma: black → purple → magenta → cyan → white
    (i) => {
        if (i < 64)  { const f = i/64;  return [f*100|0, 0, f*180|0, 255]; }
        if (i < 128) { const f = (i-64)/64;  return [100+f*155|0, 0, 180-f*80|0, 255]; }
        if (i < 200) { const f = (i-128)/72; return [255, f*200|0, 100+f*155|0, 255]; }
        const f = (i-200)/55; return [255, 200+f*55|0, 255, 255];
    },
];

function buildLUT(paletteIdx, hueShift) {
    const lut = new Uint32Array(256);
    const fn = PALETTES[paletteIdx % 3];
    for (let i = 0; i < 256; i++) {
        let [r, g, b] = fn(i);
        if (Math.abs(hueShift) > 1) {
            const h = hueShift * Math.PI / 180;
            const cos = Math.cos(h), sin = Math.sin(h);
            const nr = r*(0.213+cos*0.787-sin*0.213)+g*(0.213-cos*0.213+sin*0.143)+b*(0.213-cos*0.213-sin*0.787);
            const ng = r*(0.715-cos*0.715-sin*0.715)+g*(0.715+cos*0.285+sin*0.140)+b*(0.715-cos*0.715+sin*0.715);
            const nb = r*(0.072-cos*0.072+sin*0.928)+g*(0.072-cos*0.072-sin*0.283)+b*(0.072+cos*0.928);
            r = Math.max(0,Math.min(255,nr))|0;
            g = Math.max(0,Math.min(255,ng))|0;
            b = Math.max(0,Math.min(255,nb))|0;
        }
        lut[i] = (255<<24)|((b&0xff)<<16)|((g&0xff)<<8)|(r&0xff);
    }
    return lut;
}

class Fire {
    constructor() {
        this.grid   = new Uint8Array(GW * GH);
        this.oc     = new OffscreenCanvas(GW, GH);
        this.octx   = this.oc.getContext("2d");
        this.img    = this.octx.createImageData(GW, GH);
        this.img32  = new Uint32Array(this.img.data.buffer);
        this.lut    = buildLUT(0, 0);
        this.lastPal = -1; this.lastHue = -999;
        this.embers = [];
        this.wind   = 0;
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const palette   = Math.round(p.palette ?? 0) % 3;
        const hueShift  = p.hueShift ?? 0;
        const intensity = p.intensity ?? 0.8;
        const cooling   = p.cooling ?? 0.96;
        const turbulence = p.turbulence ?? 1;
        const emberCount = p.embers ?? 0.5;
        const windStrength = p.wind ?? 0;
        const height    = p.height ?? 1;

        if (palette !== this.lastPal || Math.abs(hueShift - this.lastHue) > 1) {
            this.lut = buildLUT(palette, hueShift);
            this.lastPal = palette; this.lastHue = hueShift;
        }

        // Wind drifts slowly, bass gusts it
        this.wind += (windStrength * 0.3 - this.wind) * 0.05;
        this.wind += bass * 0.5 * Math.sign(windStrength || 1);

        const G = this.grid;
        // Seed bottom rows — bass boosts heat, height controls column distribution
        const heatBase = (intensity * 0.5 + bass * intensity) * 255;
        const flameH   = Math.max(0.2, Math.min(1, height));
        for (let x = 0; x < GW; x++) {
            // Multi-column heat: hotter in center, height param widens the base
            const cx = x / GW - 0.5;
            const profile = Math.max(0, 1 - Math.abs(cx) / flameH * 1.2);
            const noise = (Math.random() * 90 + treble * 40) * turbulence;
            const heat  = Math.min(255, heatBase * profile + noise) | 0;
            G[(GH-1)*GW + x] = heat;
            G[(GH-2)*GW + x] = Math.min(255, heat + (Math.random()*30|0));
        }

        // Propagate with cooling + wind drift
        const cool = Math.max(0.88, cooling - mid * 0.03);
        const windPx = (this.wind * 0.5) | 0;
        for (let y = 0; y < GH - 2; y++) {
            for (let x = 0; x < GW; x++) {
                const xm = (x - 1 + GW) % GW;
                const xp = (x + 1) % GW;
                const xw = Math.max(0, Math.min(GW-1, x + windPx + ((Math.random()*turbulence*2-turbulence)|0)));
                const v = (G[(y+1)*GW + xm] + G[(y+1)*GW + xw] + G[(y+1)*GW + xp] + G[(y+2)*GW + x]) * 0.25 * cool;
                G[y*GW + x] = v | 0;
            }
        }

        // LUT render
        const lut = this.lut, img32 = this.img32;
        for (let i = 0; i < GW * GH; i++) img32[i] = lut[G[i]];
        this.octx.putImageData(this.img, 0, 0);
        ctx.drawImage(this.oc, 0, 0, w, h);

        // Embers — rising sparks born at the flame tip
        const maxEmbers = Math.round(emberCount * 80);
        if (this.embers.length < maxEmbers && Math.random() < 0.4 + bass * 0.6) {
            const ex = (Math.random() * 0.8 + 0.1) * w;
            const ey = h * 0.6;
            this.embers.push({ x: ex, y: ey, vx: (Math.random()-0.5)*1.5 + this.wind*0.3, vy: -(1 + Math.random()*2 + bass), life: 1 });
        }
        for (let i = this.embers.length - 1; i >= 0; i--) {
            const e = this.embers[i];
            e.x += e.vx; e.y += e.vy; e.vy += 0.03; e.vx += this.wind * 0.02;
            e.life -= 0.015 + treble * 0.01;
            if (e.life <= 0 || e.y < -10) { this.embers.splice(i, 1); continue; }
            const r = 1.5 + e.life * 2;
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = e.life * 0.8;
            ctx.fillStyle = palette === 1 ? `hsl(90,100%,70%)` : palette === 2 ? `hsl(290,100%,80%)` : `hsl(40,100%,80%)`;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 6.2832); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
        }
    }
}

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

export const fireParams = () => ({
    intensity:   { base: 0.85, min: 0.1,  max: 1.5,  mod: { source: "" } },
    cooling:     { base: 0.96, min: 0.88, max: 0.999, mod: { source: "" } },
    height:      { base: 0.8,  min: 0.1,  max: 1.5,  mod: { source: "" } },
    turbulence:  { base: 1.0,  min: 0,    max: 4,    mod: { source: "" } },
    wind:        { base: 0,    min: -5,   max: 5,    mod: { source: "" } },
    palette:     { base: 0,    min: 0,    max: 2,    mod: { source: "" } },
    hueShift:    { base: 0,    min: -180, max: 180,  mod: { source: "" } },
    embers:      { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } },
    speed:       { base: 1,    min: 0.2,  max: 3,    mod: { source: "" } },
    glow:        { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } },
});

export function drawFire(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new Fire(); _state.set(ctx, viz); }
    ctx.clearRect(0, 0, w, h);
    const s = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, bassLevel(s), midLevel(s), trebleLevel(s));
}
