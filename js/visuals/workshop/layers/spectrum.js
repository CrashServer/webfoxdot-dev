// ── Spectrum ──────────────────────────────────────────────────────────────────
// Frequency analyzer with bloom, peak hold, gradient coloring by frequency,
// multiple display modes (bars/curve/circle), and per-bin glow. Bass drives
// bar width pulse, treble brightens highs, mid shifts palette rotation.

const _state = new WeakMap();

// Vertical bar gradient sprites keyed by hue bucket (10°) — avoids n createLinearGradient per frame
const _barSpriteCache = new Map();
function _barSprite(hue) {
    const hb = Math.round(hue / 10) * 10;
    if (_barSpriteCache.has(hb)) return _barSpriteCache.get(hb);
    const gc = new OffscreenCanvas(1, 64);
    const gx = gc.getContext('2d');
    const g = gx.createLinearGradient(0, 64, 0, 0); // bottom → top
    g.addColorStop(0,   `hsl(${hb},90%,40%)`);
    g.addColorStop(0.5, `hsl(${hb+10},90%,55%)`);
    g.addColorStop(1,   `hsl(${hb+25},100%,80%)`);
    gx.fillStyle = g; gx.fillRect(0, 0, 1, 64);
    _barSpriteCache.set(hb, gc);
    return gc;
}

// Circle mode radial bar: gradient goes along the radius at varying angles — approximate with solid color
function _circleBarColor(hue) {
    const hb = Math.round(hue / 10) * 10;
    return `hsl(${hb + 15},95%,65%)`;
}

export const spectrumParams = () => ({
    bars:      { base: 48,   min: 4,    max: 128,  mod: { source: "" } },
    gap:       { base: 1.5,  min: 0,    max: 10,   mod: { source: "" } },
    heightK:   { base: 1.2,  min: 0.1,  max: 4,    mod: { source: "" } },
    hueBase:   { base: 200,  min: 0,    max: 360,  mod: { source: "" } },
    hueRange:  { base: 120,  min: 0,    max: 360,  mod: { source: "" } },
    mode:      { base: 0,    min: 0,    max: 2,    mod: { source: "" } }, // 0=bottom, 1=mirror, 2=circle
    glow:      { base: 1.5,  min: 0,    max: 4,    mod: { source: "" } },
    peakHold:  { base: 0.7,  min: 0,    max: 1,    mod: { source: "" } },
    peakDecay: { base: 0.015,min: 0.001,max: 0.1,  mod: { source: "" } },
    smooth:    { base: 0.75, min: 0,    max: 0.98, mod: { source: "" } },
    midShift:  { base: 40,   min: 0,    max: 180,  mod: { source: "" } },
    bloom:     { base: 0.6,  min: 0,    max: 1,    mod: { source: "" } },
    usePalette: { base: 0,   min: 0,    max: 1,    mod: { source: "" } },
});

export function drawSpectrum(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { smoothed: null, peaks: null, peakTimer: null }; _state.set(ctx, st); }

    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hueBase ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };

    const spectrum = extra?.spectrum;
    const n = Math.max(4, Math.min(128, Math.round(p.bars)));

    // Init / resize state
    if (!st.smoothed || st.smoothed.length !== n) {
        st.smoothed  = new Float32Array(n);
        st.peaks     = new Float32Array(n);
        st.peakTimer = new Float32Array(n);
    }

    const s      = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;

    const smooth    = p.smooth;
    const heightK   = p.heightK * (1 + bass*0.3);
    const hueBase   = p.hueBase + mid * p.midShift;
    const hueRange  = p.hueRange;
    const mode      = Math.round(p.mode) % 3;
    const glow      = p.glow;
    const peakHold  = p.peakHold > 0.5;
    const peakDecay = p.peakDecay;
    const bloom     = p.bloom;
    const gap       = p.gap;

    // Accumulate smoothed values
    for (let i = 0; i < n; i++) {
        const srcIdx = Math.min(spectrum ? spectrum.length-1 : 0, Math.round((i/n)*63));
        const raw    = spectrum ? (spectrum[srcIdx] ?? 0) : 0;
        // Treble boost for high bins
        const trebleBoost = 1 + (i/n)*treble*0.8;
        const target = Math.min(1, raw * heightK * trebleBoost);
        st.smoothed[i] = st.smoothed[i]*smooth + target*(1-smooth);

        // Peak hold
        if (st.smoothed[i] >= st.peaks[i]) {
            st.peaks[i]     = st.smoothed[i];
            st.peakTimer[i] = 0;
        } else {
            st.peakTimer[i]++;
            if (st.peakTimer[i] > 20) st.peaks[i] -= peakDecay;
            if (st.peaks[i] < 0) st.peaks[i] = 0;
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(220,30%,3%)';
    ctx.fillRect(0, 0, w, h);

    if (mode === 2) {
        // Circle mode
        const cx = w/2, cy = h/2;
        const rBase = Math.min(w,h) * 0.22;
        const rMax  = Math.min(w,h) * 0.44;

        // Bloom ring
        if (bloom > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const bg = ctx.createRadialGradient(cx, cy, rBase*0.8, cx, cy, rMax*1.3);
            bg.addColorStop(0, `hsla(${hueBase},80%,30%,${bloom*bass*0.3})`);
            bg.addColorStop(1, `rgba(0,0,0,0)`);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < n; i++) {
            const angle  = (i/n)*Math.PI*2 - Math.PI/2;
            const val    = st.smoothed[i];
            const barLen = (rMax - rBase) * val;
            const bh     = (hueBase + (i/n)*hueRange) % 360;
            const alpha  = 0.7 + val*0.3;
            const barCol = _pal ? pC(i/n) : null;

            const x0 = cx + Math.cos(angle)*rBase;
            const y0 = cy + Math.sin(angle)*rBase;
            const x1 = cx + Math.cos(angle)*(rBase+barLen);
            const y1 = cy + Math.sin(angle)*(rBase+barLen);

            if (glow > 0) { ctx.shadowBlur = 0;}
            ctx.strokeStyle = barCol ?? _circleBarColor(bh);
            ctx.globalAlpha = alpha;
            ctx.lineWidth   = Math.max(1, (Math.PI*2*rBase/n) - gap*0.5);
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            ctx.globalAlpha = 1;

            // Peak dot
            if (peakHold && st.peaks[i] > 0.02) {
                const px = cx + Math.cos(angle)*(rBase + (rMax-rBase)*st.peaks[i]);
                const py = cy + Math.sin(angle)*(rBase + (rMax-rBase)*st.peaks[i]);
                ctx.fillStyle = barCol ?? `hsla(${bh},100%,90%,0.9)`;
                ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
        return;
    }

    // Bar modes (bottom / mirror)
    const barW   = w / n;
    const mirrored = mode === 1;

    // Bloom pass
    if (bloom > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.filter = `blur(${Math.round(bloom*14)}px)`;
        for (let i = 0; i < n; i++) {
            const val   = st.smoothed[i];
            if (val < 0.01) continue;
            const barH  = val * (mirrored ? h : h);
            const bh    = (hueBase + (i/n)*hueRange) % 360;
            const x     = i*barW + gap/2;
            const bw    = Math.max(0, barW - gap);
            ctx.fillStyle = _pal ? pC(i/n) : `hsla(${bh},90%,60%,${bloom*val*0.5})`;
            if (mirrored) ctx.fillRect(x, (h-barH)/2, bw, barH);
            else          ctx.fillRect(x, h-barH, bw, barH);
        }
        ctx.filter = 'none';
        ctx.restore();
    }

    // Main bars
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
        const val    = st.smoothed[i];
        const barH   = val * h * (mirrored ? 0.95 : 1);
        const bh     = (hueBase + (i/n)*hueRange) % 360;
        const alpha  = 0.7 + val*0.3;
        const x      = i*barW + gap/2;
        const bw     = Math.max(0.5, barW - gap);

        let y0, yh;
        if (mirrored) { y0 = (h-barH)/2; yh = barH; }
        else           { y0 = h-barH;    yh = barH; }

        if (glow > 0 && val > 0.05) { ctx.shadowBlur = 0;}

        if (_pal) {
            // Palette mode: solid color by frequency (height variation is minor)
            ctx.fillStyle = pC(i/n);
            ctx.globalAlpha = alpha;
            ctx.fillRect(x, y0, bw, Math.max(1, yh));
            ctx.globalAlpha = 1;
        } else {
            // Sprite drawImage — scales cached 1×64 gradient to bar dimensions
            const sp = _barSprite(bh);
            ctx.globalAlpha = alpha;
            ctx.drawImage(sp, 0, 0, 1, 64, x, y0, bw, Math.max(1, yh));
            ctx.globalAlpha = 1;
        }

        // Peak hold tick
        if (peakHold && st.peaks[i] > 0.02) {
            const pY = mirrored ? (h - st.peaks[i]*h*0.95)/2 : h - st.peaks[i]*h;
            ctx.shadowBlur = 0;
            ctx.fillStyle   = _pal ? pC(i/n) : `hsla(${bh+20},100%,92%,0.9)`;
            ctx.fillRect(x, pY, bw, 2);
        }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}
