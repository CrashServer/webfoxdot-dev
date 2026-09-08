// ── Wave Interference ─────────────────────────────────────────────────────────
// 2D interference pattern from N point sources.  Each source emits a circular
// wave; the sum produces beautiful moiré / diffraction patterns.
// Bass moves sources; treble brightens peaks.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const waveInterferenceParams = () => ({
    sources:  { base: 4,    min: 1,  max: 8,   step: 1, mod: { source: "" } },
    freq:     { base: 8,    min: 1,  max: 30,            mod: { source: "" } }, // wave frequency
    speed:    { base: 1.0,  min: 0,  max: 5,             mod: { source: "" } }, // wave propagation speed
    radius:   { base: 0.35, min: 0.05,max:0.5,           mod: { source: "" } }, // source orbit radius
    orbitSpeed:{ base:0.2,  min:-2,  max: 2,             mod: { source: "" } },
    hue:      { base: 200,  min: 0,  max: 360,           mod: { source: "" } },
    hue2:     { base: 30,   min: 0,  max: 360,           mod: { source: "" } }, // negative lobe hue
    glow:     { base: 0.3,  min: 0,  max: 1,             mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,  max: 1,             mod: { source: "" } },
    res:      { base: 180,  min: 60, max: 400, step: 20, mod: { source: "" } },
    contrast: { base: 1.0,  min: 0.2,max: 3,             mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,  max: 1,             mod: { source: "" } },
});

export function drawWaveInterference(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nSrc   = Math.round(Math.max(1, Math.min(8, p.sources ?? 4)));
    const freq   = (p.freq ?? 8) * (1 + bass * (p.pulse ?? 0.4) * 0.3);
    const speed  = p.speed ?? 1.0;
    const orbR   = (p.radius ?? 0.35) * Math.min(w, h) * 0.5;
    const orbSpd = p.orbitSpeed ?? 0.2;
    const hue    = p.hue ?? 200;
    const hue2   = p.hue2 ?? 30;
    const glow   = p.glow ?? 0.3;
    const res    = Math.round(Math.max(60, Math.min(400, p.res ?? 180)));
    const contrast = p.contrast ?? 1.0;
    const bgAlpha  = p.bgAlpha ?? 1;

    const SW = res, SH = Math.round(res * h / w);

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d"), SW, SH };
        _st.set(ctx, st);
    }

    const cx = SW / 2, cy = SH / 2;

    // Source positions on orbit
    const sources = Array.from({ length: nSrc }, (_, i) => {
        const a = (i / nSrc) * TAU + t * orbSpd;
        return [cx + Math.cos(a) * orbR * SW / w, cy + Math.sin(a) * orbR * SH / h];
    });

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;
    const k  = freq * TAU / Math.min(SW, SH);
    const phase = t * speed;

    for (let y = 0; y < SH; y++) {
        for (let x = 0; x < SW; x++) {
            let sum = 0;
            for (let s = 0; s < nSrc; s++) {
                const dx = x - sources[s][0], dy = y - sources[s][1];
                const r = Math.sqrt(dx*dx + dy*dy);
                sum += Math.cos(k * r - phase * TAU);
            }
            const v = (sum / nSrc) * contrast; // -1..1
            const idx = (y * SW + x) * 4;
            if (v >= 0) {
                const bright = Math.round(v * (180 + treble * 60));
                // Parse hue to RGB (simple fixed palette for speed)
                d[idx]   = Math.min(255, bright * 0.5);
                d[idx+1] = Math.min(255, bright * 0.8);
                d[idx+2] = Math.min(255, bright);
            } else {
                const bright = Math.round(-v * 180);
                d[idx]   = Math.min(255, bright);
                d[idx+1] = Math.min(255, bright * 0.5);
                d[idx+2] = Math.min(255, bright * 0.2);
            }
            d[idx+3] = Math.round(bgAlpha * 255);
        }
    }
    st.bctx.putImageData(id, 0, 0);

    ctx.clearRect(0, 0, w, h);
    if (glow > 0.05) ctx.filter = `blur(${glow * 3}px)`;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
    ctx.filter = "none";

    // Source indicators
    const scaleX = w / SW, scaleY = h / SH;
    ctx.fillStyle = `hsla(${hue},100%,90%,0.7)`;
    for (const [sx, sy] of sources) {
        ctx.beginPath();
        ctx.arc(sx * scaleX, sy * scaleY, 3 + bass * 3, 0, TAU);
        ctx.fill();
    }
}
