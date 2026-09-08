// ── Aurora ────────────────────────────────────────────────────────────────────
// Curtain-like northern lights: multiple vertical-wave bands sweep across the sky.
// Bass brightens and expands curtains, treble adds shimmer and ripple detail,
// mid drives hue shift. Rays emanate from upper horizon with additive glow.

const _aState = new WeakMap();
const sn = (x) => Math.sin(x*1.7)*Math.cos(x*2.3+1.1)*Math.sin(x*0.9+2.7);
const sn2 = (x) => Math.sin(x*3.1)*Math.cos(x*1.7+0.5);

// Pre-rendered curtain band sprites (1px × 64px, alpha profile normalized to 1.0)
const _aBandCache = new Map();
function _aBandSprite(hue) {
    const hb = Math.round(hue / 15) * 15; // 15° buckets
    if (_aBandCache.has(hb)) return _aBandCache.get(hb);
    const gc = new OffscreenCanvas(1, 64);
    const gx = gc.getContext('2d');
    const g = gx.createLinearGradient(0, 0, 0, 64); // top→bottom
    g.addColorStop(0,    `hsla(${hb},90%,75%,0)`);
    g.addColorStop(0.15, `hsla(${hb},90%,65%,0.5)`);
    g.addColorStop(0.4,  `hsla(${hb+20},95%,75%,1)`);
    g.addColorStop(0.6,  `hsla(${hb},90%,70%,0.8)`);
    g.addColorStop(0.85, `hsla(${hb-10},85%,60%,0.4)`);
    g.addColorStop(1,    `hsla(${hb},80%,50%,0)`);
    gx.fillStyle = g; gx.fillRect(0, 0, 1, 64);
    _aBandCache.set(hb, gc);
    return gc;
}

// Pre-rendered ray sprites (1px × 64px, bottom opaque → top transparent)
const _aRayCache = new Map();
function _aRaySprite(hue) {
    const hb = Math.round(hue / 15) * 15;
    if (_aRayCache.has(hb)) return _aRayCache.get(hb);
    const gc = new OffscreenCanvas(1, 64);
    const gx = gc.getContext('2d');
    const g = gx.createLinearGradient(0, 64, 0, 0); // bottom→top (ray grows upward)
    g.addColorStop(0, `hsl(${hb},90%,70%)`);
    g.addColorStop(1, `hsla(${hb+30},80%,80%,0)`);
    gx.fillStyle = g; gx.fillRect(0, 0, 1, 64);
    _aRayCache.set(hb, gc);
    return gc;
}

class AuroraViz {
    constructor(nBands) {
        this.nBands = nBands;
        this.phases = Array.from({length: nBands}, () => Math.random()*Math.PI*2);
        this.speeds = Array.from({length: nBands}, () => 0.2 + Math.random()*0.5);
        this.bandY  = Array.from({length: nBands}, (_, i) => 0.1 + (i/nBands)*0.5);
        this.rayPhases = Array.from({length: 16}, () => Math.random()*Math.PI*2);
        this.flashEnv = 0;
        this.prevBass = 0;
    }
    resize(n) {
        while (this.phases.length < n) { this.phases.push(Math.random()*Math.PI*2); this.speeds.push(0.2+Math.random()*0.5); this.bandY.push(0.1+Math.random()*0.5); }
        this.nBands = n;
    }
}

export const auroraParams = () => ({
    hueA:     { base: 130, min: 0,   max: 360, mod: { source: "" } },
    hueB:     { base: 280, min: 0,   max: 360, mod: { source: "" } },
    hueC:     { base: 200, min: 0,   max: 360, mod: { source: "" } },
    bands:    { base: 5,   min: 2,   max: 10,  mod: { source: "" } },
    speed:    { base: 0.4, min: 0,   max: 3,   mod: { source: "" } },
    height:   { base: 0.5, min: 0.1, max: 1.2, mod: { source: "" } },
    shimmer:  { base: 1.5, min: 0,   max: 5,   mod: { source: "" } },
    rays:     { base: 0.6, min: 0,   max: 1,   mod: { source: "" } },
    rayCount: { base: 12,  min: 4,   max: 24,  mod: { source: "" } },
    yPos:     { base: 0.35,min: 0,   max: 0.9, mod: { source: "" } },
    glow:     { base: 0.7, min: 0,   max: 1,   mod: { source: "" } },
    midShift: { base: 40,  min: 0,   max: 120, mod: { source: "" } },
});

export function drawAurora(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);

    let st = _aState.get(ctx);
    const nBands = Math.max(2, Math.min(10, Math.round(p.bands)));
    if (!st) { st = new AuroraViz(nBands); _aState.set(ctx, st); }
    else if (st.nBands < nBands) st.resize(nBands);

    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*2.5) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[10]+spectrum[12])/3*2.5) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*2.5) : 0;

    if (bass > 0.6 && bass > st.prevBass + 0.12) st.flashEnv = 1.0;
    st.prevBass = bass;
    st.flashEnv *= 0.92;

    // Dark sky gradient — cached (colors are hardcoded, only rebuild on size change)
    if (!st._skyGrad || st._skyW !== w || st._skyH !== h) {
        st._skyW = w; st._skyH = h;
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0,   `hsl(230,60%,3%)`);
        sky.addColorStop(0.6, `hsl(220,50%,5%)`);
        sky.addColorStop(1,   `hsl(210,30%,8%)`);
        st._skyGrad = sky;
    }
    ctx.fillStyle = st._skyGrad;
    ctx.fillRect(0, 0, w, h);

    const slices  = 80;
    const sw      = w / slices;
    const bandH   = h * p.height;
    const yBase   = h * p.yPos;
    const bright  = 0.35 + bass * 0.55 + st.flashEnv * 0.3;
    const shimAmt = p.shimmer * (1 + treble * 1.5);

    ctx.globalCompositeOperation = "lighter";

    // Curtain bands
    for (let bi = 0; bi < nBands; bi++) {
        const frac = bi / Math.max(1, nBands - 1);
        const hue  = p.hueA + (p.hueB - p.hueA) * frac + mid * p.midShift;
        const bY   = yBase + (st.bandY[bi] - 0.35) * h * 0.3;
        const spd  = st.speeds[bi] * p.speed;
        const ph   = st.phases[bi];
        const bandAlpha = bright * (0.5 + 0.5 * Math.sin(t*0.3 + bi));

        for (let si = 0; si < slices; si++) {
            const nx = si / slices;
            const disp = sn(nx*2.5 + t*spd + ph)*h*0.07
                       + sn2(nx*5*(1+shimAmt*0.3) + t*spd*1.8 + ph+1)*h*0.03
                       + Math.sin(nx*8*shimAmt + t*3 + bi)*h*0.015*treble;
            const cy = bY + disp;
            const sliceAlpha = bandAlpha * (0.4 + 0.6*Math.pow(Math.sin(nx*Math.PI), 0.5));

            // Sprite-based curtain slice — avoids createLinearGradient per slice per band
            const sp = _aBandSprite(hue);
            ctx.globalAlpha = sliceAlpha;
            ctx.drawImage(sp, 0, 0, 1, 64, si * sw, cy - bandH*0.5, sw + 1, bandH);
            ctx.globalAlpha = 1;
        }
    }

    // Vertical rays from horizon
    if (p.rays > 0.01) {
        const rayCount = Math.max(4, Math.round(p.rayCount));
        for (let ri = 0; ri < rayCount; ri++) {
            const rx = w * ((ri + 0.5) / rayCount + Math.sin(t*0.2 + st.rayPhases[ri % 16])*0.06);
            const rayH = h * (0.3 + 0.5*p.rays) * (0.5 + treble*0.7 + bass*0.3);
            const hue  = p.hueC + ri*15 + t*5;
            const rAlpha = p.rays * (0.07 + treble*0.12 + st.flashEnv*0.1) * (0.5 + 0.5*Math.sin(t*1.2 + ri));
            const rSp = _aRaySprite(hue);
            const rw = w * (0.008 + 0.012*Math.sin(st.rayPhases[ri%16]));
            ctx.globalAlpha = rAlpha;
            ctx.drawImage(rSp, 0, 0, 1, 64, rx - rw/2, yBase - rayH, rw, rayH);
            ctx.globalAlpha = 1;
        }
    }

    // Flash bloom on beat
    if (st.flashEnv > 0.02 && p.glow > 0) {
        const fg = ctx.createRadialGradient(w/2, yBase, 0, w/2, yBase, w*0.7);
        fg.addColorStop(0, `hsla(${p.hueA},90%,80%,${st.flashEnv*p.glow*0.2})`);
        fg.addColorStop(1, `hsla(${p.hueB},70%,60%,0)`);
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);
    }

    ctx.globalCompositeOperation = "source-over";

    // Stars peeking through
    for (let si = 0; si < 80; si++) {
        const sx = w * (Math.sin(si*127.1)*0.5+0.5);
        const sy = h * (0.05 + (Math.sin(si*311.7)*0.5+0.5)*0.4);
        const sa = (0.3 + Math.sin(t*2+si)*0.2) * (1 - bright*0.8);
        if (sa < 0.05) continue;
        ctx.fillStyle = `rgba(220,230,255,${sa})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.7, 0, Math.PI*2);
        ctx.fill();
    }
}
