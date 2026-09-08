// ── Waveform / Oscilloscope ───────────────────────────────────────────────────
// Rich oscilloscope with multiple traces synthesized from spectrum, glow passes,
// mirror mode, and XY Lissajous mode. Bass drives amplitude, treble adds jitter,
// mid shifts hue across layers. Beat-flash brightens the central trace.

const _state = new WeakMap();

function synth(spectrum, phase, pts, harmonics) {
    const out  = new Float32Array(pts);
    const bins = spectrum ? spectrum.length : 0;
    const cnt  = Math.min(bins, harmonics);
    for (let xi = 0; xi < pts; xi++) {
        const x = (xi / (pts-1)) * Math.PI * 2;
        let y = 0;
        for (let i = 1; i <= cnt; i++) {
            y += Math.sin(i*x + phase) * (spectrum ? spectrum[i-1] : 0.3/i);
        }
        out[xi] = y;
    }
    return out;
}

function normMax(arr) {
    let m = 1e-6;
    for (let i = 0; i < arr.length; i++) if (Math.abs(arr[i]) > m) m = Math.abs(arr[i]);
    return m;
}

export const waveformParams = () => ({
    hue:       { base: 160,  min: 0,    max: 360,  mod: { source: "" } },
    hueSpread: { base: 80,   min: 0,    max: 180,  mod: { source: "" } },
    speed:     { base: 1.0,  min: 0.1,  max: 4,    mod: { source: "" } },
    glow:      { base: 2.5,  min: 0,    max: 5,    mod: { source: "" } },
    layers:    { base: 3,    min: 1,    max: 5,    mod: { source: "" } },
    mode:      { base: 0,    min: 0,    max: 2,    mod: { source: "" } }, // 0=stacked, 1=overlay, 2=XY
    harmonics: { base: 24,   min: 2,    max: 48,   mod: { source: "" } },
    amplitude: { base: 1.0,  min: 0.1,  max: 3,    mod: { source: "" } },
    thickness: { base: 1.5,  min: 0.5,  max: 5,    mod: { source: "" } },
    jitter:    { base: 0.3,  min: 0,    max: 2,    mod: { source: "" } },
    mirror:    { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
    bgDark:    { base: 0.95, min: 0,    max: 1,    mod: { source: "" } },
    usePalette: { base: 0,  min: 0,    max: 1,    mod: { source: "" } },
});

export function drawWaveform(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { phase: 0, flash: 0, prevBass: 0, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, Math.max(0, t - st.lastT)); st.lastT = t;
    st.phase += dt * (p.speed ?? 1);

    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };

    const s      = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;
    const level  = (bass*0.5 + mid*0.3 + treble*0.2);

    if (bass > 0.65 && bass > st.prevBass + 0.12) st.flash = 1.0;
    st.prevBass = bass;
    st.flash *= 0.88;

    const hue        = p.hue + mid * (p.hueSpread * 0.5);
    const nLayers    = Math.max(1, Math.min(5, Math.round(p.layers)));
    const mode       = Math.round(p.mode) % 3;
    const harmonics  = Math.max(2, Math.min(48, Math.round(p.harmonics)));
    const ampMul     = p.amplitude * (1 + bass*0.6);
    const thickness  = p.thickness;
    const jitter     = p.jitter * treble;
    const mirrored   = p.mirror > 0.5;
    const PTS        = 300;

    // Background
    ctx.fillStyle = `hsla(${hue},25%,${4 - p.bgDark*3}%,${p.bgDark})`;
    ctx.fillRect(0, 0, w, h);

    if (mode === 2) {
        // XY / Lissajous
        const w0 = synth(s, st.phase, PTS, harmonics);
        const w1 = synth(s, st.phase + Math.PI/2, PTS, harmonics);
        const n0 = normMax(w0), n1 = normMax(w1);
        const scale = Math.min(w, h) * 0.38 * ampMul;
        const cx = w/2, cy = h/2;

        for (let pass = 0; pass < 3; pass++) {
            const isGlow = pass < 2;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const ph = (hue + pass*20) % 360;
            ctx.strokeStyle = `hsl(${ph},90%,${pass===2?80:65}%)`;
            ctx.lineWidth   = pass===2 ? thickness : thickness*(3-pass*0.5);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = pass===2 ? 1 : (0.15 + pass*0.1);
            ctx.beginPath();
            for (let i = 0; i < PTS; i++) {
                const jx = jitter ? (Math.random()-0.5)*jitter*3 : 0;
                const jy = jitter ? (Math.random()-0.5)*jitter*3 : 0;
                const x  = cx + (w0[i]/n0)*scale + jx;
                const y  = cy + (w1[i]/n1)*scale + jy;
                i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            }
            ctx.stroke();
            ctx.restore();
        }
        return;
    }

    // Stacked or overlay waveform modes
    for (let k = 0; k < nLayers; k++) {
        const phaseOff = k * Math.PI / Math.max(1, nLayers);
        const wave     = synth(s, phaseOff + st.phase * 0.18, PTS, harmonics);
        const norm     = normMax(wave);
        const lh       = (hue + (k/nLayers)*p.hueSpread) % 360;

        let cy, layerH;
        if (mode === 0) {
            // Stacked
            layerH = h * 0.72 / nLayers;
            cy     = (h/nLayers) * (k + 0.5);
        } else {
            // Overlay — all centered
            layerH = h * 0.7;
            cy     = h * 0.5;
        }

        const bright  = 50 + level*30 + (k===0 ? st.flash*30 : 0);
        const lineW   = thickness * (1 + bass*0.5) * (k===0 ? 1.4 : 1);
        // Palette: color layer by its horizontal position (applied as a gradient) or fallback
        const palLayerCol = _pal ? pC(k / Math.max(1, nLayers)) : null;

        for (let pass = 0; pass < 2; pass++) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            if (palLayerCol) {
                ctx.strokeStyle = palLayerCol;
            } else {
                ctx.strokeStyle = `hsl(${lh},85%,${bright}%)`;
            }
            ctx.lineWidth   = pass===0 ? lineW*4 : lineW;
            ctx.shadowBlur = 0;
            ctx.globalAlpha = pass===0 ? 0.2 + st.flash*0.1 : 0.92;
            // Palette horizontal gradient: build a canvas gradient across the wave width
            if (_pal && _pal.length > 0 && pass === 1) {
                const hGrad = ctx.createLinearGradient(0, 0, w, 0);
                const steps = Math.min(_pal.length, 16);
                for (let si = 0; si <= steps; si++) {
                    hGrad.addColorStop(si / steps, _pal[Math.min(_pal.length - 1, Math.floor((si / steps) * _pal.length))]);
                }
                ctx.strokeStyle = hGrad;
            }

            ctx.beginPath();

            for (let i = 0; i < PTS; i++) {
                const jx   = jitter ? (Math.random()-0.5)*jitter*2 : 0;
                const frac = i/(PTS-1);
                const x    = frac * w + jx;
                const amp  = (wave[i]/norm) * layerH * 0.42 * ampMul;
                const y    = cy - amp;
                i===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Mirror below center
            if (mirrored && pass===1) {
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                for (let i = 0; i < PTS; i++) {
                    const x   = (i/(PTS-1)) * w;
                    const amp = (wave[i]/norm) * layerH * 0.42 * ampMul;
                    const y   = cy + amp;
                    i===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // Beat flash center line
    if (st.flash > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `hsla(${hue},100%,90%,${st.flash*0.4})`;
        ctx.lineWidth   = st.flash * 3;
        ctx.beginPath();
        ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
        ctx.stroke();
        ctx.restore();
    }
}
