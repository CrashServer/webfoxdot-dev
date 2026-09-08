// ── Holographic Wave ──────────────────────────────────────────────────────────
// Interference pattern from N orbiting coherent point sources. Rendered into
// a downsampled ImageData for performance. Bass shortens wavelength + snaps phases.
// Treble adds brightness flicker. Mid drives hue rotation. Chromatic offset splits
// R/G/B channels at different wavelengths for a holographic fringe look.

const _state = new WeakMap();

// Source point glow sprites keyed by (hue-bucket, radius-bucket)
const _hwGlowCache = new Map();
function _hwGlow(hue, radius) {
    const hb = Math.round(hue / 20) * 20;
    const rb = Math.max(8, Math.round(radius / 5) * 5);
    const key = `${hb}_${rb}`;
    if (_hwGlowCache.has(key)) return _hwGlowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},100%,90%)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _hwGlowCache.set(key, gc);
    return gc;
}

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h/30) % 12; return l - a * Math.max(-1, Math.min(k-3, Math.min(9-k, 1))); };
    return [f(0)*255|0, f(8)*255|0, f(4)*255|0];
}

function makeState(nSrc) {
    return {
        nSrc,
        phases:   Float32Array.from({length: nSrc}, () => Math.random()*Math.PI*2),
        phaseV:   Float32Array.from({length: nSrc}, () => (Math.random()-0.5)*0.05),
        orbRadii: Float32Array.from({length: nSrc}, (_, i) => 0.18 + (i/nSrc)*0.22),
        time: 0, prevBass: 0, pulse: 0,
        offscreen: null, offCtx: null,
    };
}

export const holographicWaveParams = () => ({
    hue:         { base: 200, min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 80,  min: 0,    max: 180, mod: { source: "" } },
    sources:     { base: 5,   min: 2,    max: 8,   mod: { source: "" } },
    wavelength:  { base: 28,  min: 6,    max: 90,  mod: { source: "" } },
    speed:       { base: 0.4, min: 0,    max: 2,   mod: { source: "" } },
    contrast:    { base: 1.8, min: 0.5,  max: 4,   mod: { source: "" } },
    chromaShift: { base: 0.4, min: 0,    max: 1.5, mod: { source: "" } },
    orbitSpeed:  { base: 0.3, min: 0,    max: 2,   mod: { source: "" } },
    orbitScale:  { base: 0.3, min: 0.05, max: 0.6, mod: { source: "" } },
    brightness:  { base: 0.8, min: 0.1,  max: 2,   mod: { source: "" } },
    resolution:  { base: 3,   min: 2,    max: 6,   mod: { source: "" } },
    midRotate:   { base: 30,  min: 0,    max: 120, mod: { source: "" } },
    usePalette:  { base: 0,  min: 0,    max: 1,   mod: { source: "" } },
});

export function drawHolographicWave(ctx, w, h, p, t, extra) {
    const nSrc = Math.max(2, Math.min(8, Math.round(p.sources)));
    let st = _state.get(ctx);
    if (!st || st.nSrc !== nSrc) { st = makeState(nSrc); _state.set(ctx, st); }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };

    const s      = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;

    if (bass > 0.6 && bass > st.prevBass + 0.1) {
        st.pulse = 1.0;
        for (let i = 0; i < nSrc; i++) st.phases[i] = Math.random()*Math.PI*2;
    }
    st.prevBass = bass;
    st.pulse *= 0.88;

    for (let i = 0; i < nSrc; i++) st.phases[i] += st.phaseV[i];

    const hue         = p.hue + mid * p.midRotate;
    const hueSpread   = p.hueSpread;
    const wavelength  = Math.max(4, p.wavelength * (1 - bass*0.45));
    const speed       = p.speed;
    const contrast    = p.contrast * (1 + treble*0.4 + st.pulse*0.3);
    const chromaShift = p.chromaShift;
    const orbitSpeed  = p.orbitSpeed;
    const orbitScale  = p.orbitScale;
    const bright      = p.brightness * (1 + treble*0.3);
    const downRes     = Math.max(2, Math.min(6, Math.round(p.resolution)));
    const k           = (Math.PI*2) / wavelength;
    const srcR        = Math.min(w, h) * orbitScale;

    const rw = Math.max(1, w/downRes|0);
    const rh = Math.max(1, h/downRes|0);
    if (!st.offscreen || st.offscreen.width !== rw || st.offscreen.height !== rh) {
        st.offscreen = new OffscreenCanvas(rw, rh);
        st.offCtx    = st.offscreen.getContext('2d');
    }

    // Source positions on orbits (each at different radius + angular offset)
    const srcX = new Float32Array(nSrc);
    const srcY = new Float32Array(nSrc);
    for (let i = 0; i < nSrc; i++) {
        const a  = (i/nSrc)*Math.PI*2 + st.time * orbitSpeed * 0.5;
        const r  = srcR * st.orbRadii[i] * (1/0.4);
        srcX[i]  = w/2 + Math.cos(a)*r;
        srcY[i]  = h/2 + Math.sin(a)*r;
    }

    const id   = st.offCtx.createImageData(rw, rh);
    const data = id.data;
    const sx   = w / rw;
    const sy   = h / rh;
    const time = st.time * speed;

    // Chroma wavelengths
    const kR = k;
    const kG = k * (1 + chromaShift * 0.08);
    const kB = k * (1 + chromaShift * 0.17);

    for (let py = 0; py < rh; py++) {
        const wy = py * sy;
        for (let px = 0; px < rw; px++) {
            const wx = px * sx;
            let sumR = 0, sumG = 0, sumB = 0;
            for (let si = 0; si < nSrc; si++) {
                const dx = wx - srcX[si], dy = wy - srcY[si];
                const r  = Math.sqrt(dx*dx + dy*dy);
                const ph = st.phases[si] + time;
                sumR += Math.cos(kR*r + ph);
                sumG += Math.cos(kG*r + ph + chromaShift*0.4);
                sumB += Math.cos(kB*r + ph + chromaShift*0.8);
            }
            const norm  = 1/nSrc;
            const vR    = Math.min(1, Math.max(0, (sumR*norm + 1)*0.5 * contrast));
            const vG    = Math.min(1, Math.max(0, (sumG*norm + 1)*0.5 * contrast));
            const vB    = Math.min(1, Math.max(0, (sumB*norm + 1)*0.5 * contrast));
            // Map through hue palette
            const avg   = (vR+vG+vB)/3;
            const hFrac = hue + avg*hueSpread;
            const rgb   = hsl2rgb(hFrac, 0.9, Math.min(1, avg*bright*0.6+0.04));
            // Apply chroma mixing on top
            const off   = (py*rw + px) << 2;
            data[off]   = Math.min(255, rgb[0] + vR*60*chromaShift) | 0;
            data[off+1] = Math.min(255, rgb[1] + vG*40*chromaShift) | 0;
            data[off+2] = Math.min(255, rgb[2] + vB*80*chromaShift) | 0;
            data[off+3] = 255;
        }
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.offscreen, 0, 0, w, h);

    // Overlay source point glows — palette colors each wave layer by source index
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < nSrc; i++) {
        const sh = (hue + i*(hueSpread/nSrc)) % 360;
        const glowR = 30 + bass * 20;
        const gAlpha = 0.4 + bass * 0.4;
        if (_pal) {
            // Palette mode: draw filled arc with palette color
            ctx.fillStyle = pC(i / nSrc);
            ctx.globalAlpha = gAlpha;
            ctx.beginPath(); ctx.arc(srcX[i], srcY[i], glowR, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            const sp = _hwGlow(sh, glowR);
            ctx.globalAlpha = gAlpha;
            ctx.drawImage(sp, srcX[i] - sp.width/2, srcY[i] - sp.height/2);
            ctx.globalAlpha = 1;
        }
    }
    ctx.restore();
}
