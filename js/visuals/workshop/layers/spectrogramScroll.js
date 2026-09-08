// ── Spectrogram Scroll ────────────────────────────────────────────────────────
// Real-time scrolling spectrogram (time on X, frequency on Y, intensity = colour).
// Classic time-frequency representation.  Horizontal scroll with history buffer.

const _st = new WeakMap();

export const spectrogramScrollParams = () => ({
    hue:      { base: 200,  min: 0,   max: 360,          mod: { source: "" } }, // cool colour
    hue2:     { base: 30,   min: 0,   max: 360,          mod: { source: "" } }, // hot colour
    speed:    { base: 1.0,  min: 0.1, max: 4,            mod: { source: "" } }, // scroll speed multiplier
    logScale: { base: 1,    min: 0,   max: 1,  step: 1,  mod: { source: "" } }, // logarithmic freq axis
    bins:     { base: 64,   min: 8,   max: 64, step: 8,  mod: { source: "" } }, // freq bins to show
    gain:     { base: 2.0,  min: 0.5, max: 8,            mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,   max: 1,            mod: { source: "" } },
    glow:     { base: 0.3,  min: 0,   max: 1,            mod: { source: "" } },
    pulse:    { base: 0.3,  min: 0,   max: 1,            mod: { source: "" } },
    smooth:   { base: 0.7,  min: 0,   max: 0.95,         mod: { source: "" } }, // temporal smoothing
});

// HSL→RGB for pixel loop
function hsl2rgb255(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2*l-1)) * s;
    const x = c * (1 - Math.abs(h*6%2 - 1));
    const m = l - c/2;
    let r=0, g=0, b=0;
    if (h<1/6) {r=c;g=x;} else if (h<2/6) {r=x;g=c;}
    else if (h<3/6) {g=c;b=x;} else if (h<4/6) {g=x;b=c;}
    else if (h<5/6) {r=x;b=c;} else {r=c;b=x;}
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

export function drawSpectrogramScroll(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;

    const hue    = p.hue ?? 200;
    const hue2   = p.hue2 ?? 30;
    const speed  = p.speed ?? 1.0;
    const logSc  = (p.logScale ?? 1) > 0.5;
    const nBins  = Math.round(Math.max(8, Math.min(64, p.bins ?? 64)));
    const gain   = (p.gain ?? 2.0) * (1 + bass * (p.pulse ?? 0.3));
    const bgAlpha= p.bgAlpha ?? 1.0;
    const smooth = p.smooth ?? 0.7;

    let st = _st.get(ctx);
    if (!st || st.w !== w || st.h !== h) {
        const buf = document.createElement("canvas");
        buf.width = w; buf.height = h;
        st = { buf, bctx: buf.getContext("2d"), w, h, smoothed: new Float32Array(64), col: 0, accum: 0, lastT: t };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.accum += speed * dt * 30; // columns to advance

    if (!spectrum) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
        return;
    }

    // Smooth spectrum
    for (let i = 0; i < 64; i++) {
        st.smoothed[i] = st.smoothed[i] * smooth + spectrum[i] * (1 - smooth);
    }

    // Add columns when accumulated
    while (st.accum >= 1) {
        st.accum -= 1;
        // Scroll: copy current canvas shifted left by 1px
        const imgData = st.bctx.getImageData(1, 0, w - 1, h);
        st.bctx.putImageData(imgData, 0, 0);

        // Draw new column at right edge
        const colData = st.bctx.createImageData(1, h);
        const d = colData.data;
        for (let row = 0; row < h; row++) {
            // Map row → frequency bin
            let bin;
            const frac = 1 - row / h;
            if (logSc) {
                bin = Math.floor(Math.pow(nBins, frac) - 1);
            } else {
                bin = Math.floor(frac * nBins);
            }
            bin = Math.max(0, Math.min(63, bin));
            const val = Math.min(1, st.smoothed[bin] * gain);
            // Colour: cool (hue) → hot (hue2) by intensity
            const ch = hue + val * ((hue2 - hue + 360) % 360 > 180 ? -(360 - (hue2 - hue + 360) % 360) : (hue2 - hue + 360) % 360);
            const l  = 0.1 + val * 0.7;
            const [r, g, b] = hsl2rgb255((ch + 360) % 360, 90, l * 100);
            const i2 = row * 4;
            d[i2] = r; d[i2+1] = g; d[i2+2] = b;
            d[i2+3] = Math.round(bgAlpha * 255);
        }
        st.bctx.putImageData(colData, w - 1, 0);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(st.buf, 0, 0);

    // Frequency axis labels
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(200,200,200,0.5)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    const freqLabels = ["20","100","500","2k","8k","20k"];
    freqLabels.forEach((lbl, i) => {
        const y = h * (1 - i / (freqLabels.length - 1));
        ctx.fillText(lbl, 30, y);
    });
    ctx.textAlign = "left";
}
