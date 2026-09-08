// ── Starburst ─────────────────────────────────────────────────────────────────
// Radiating spokes: per-spoke length from spectrum bins, tapered gradient,
// secondary offset burst, inner star polygon, glow, spectrum-mapped colors.

const _state = new WeakMap();

export const starburstParams = () => ({
    rays:         { base: 32,  min: 3,    max: 128, mod: { source: "" } },
    length:       { base: 0.85, min: 0.1, max: 2.2, mod: { source: "" } },
    rotSpeed:     { base: 0.3, min: -6,   max: 6,   mod: { source: "" } },
    hue:          { base: 35,  min: 0,    max: 360, mod: { source: "" } },
    hueSpread:    { base: 120, min: 0,    max: 360, mod: { source: "" } },
    sat:          { base: 95,  min: 0,    max: 100, mod: { source: "" } },
    glow:         { base: 1.8, min: 0,    max: 5,   mod: { source: "" } },
    thickness:    { base: 1.5, min: 0.2,  max: 10,  mod: { source: "" } },
    innerR:       { base: 0.05, min: 0,   max: 0.35, mod: { source: "" } },
    beatFlare:    { base: 2.5, min: 0,    max: 6,   mod: { source: "" } },
    secondBurst:  { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    secondOffset: { base: 22,  min: 0,    max: 90,  mod: { source: "" } },
    taperPow:     { base: 2,   min: 0.3,  max: 6,   mod: { source: "" } },
    innerStar:    { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    fade:         { base: 0.12, min: 0.01, max: 0.8, mod: { source: "" } },
    trebleFreq:   { base: 1,   min: 0,    max: 3,   mod: { source: "" } },
    usePalette:   { base: 0,  min: 0,    max: 1,   mod: { source: "" } },
});

function drawSpokeSet(ctx, rays, U, innerR, length, thickness, hue, hueSpread,
                       sat, glow, taperPow, angle, bass, mid, treble, pulse,
                       beatFlare, sp, nBins, alphaScale, _pal, pC, palShift) {
    // Glow pass
    if (glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < rays; i++) {
            const a      = angle + (i / rays) * Math.PI * 2;
            const binIdx = nBins ? Math.floor((i / rays) * nBins) : 0;
            const binVal = nBins ? Math.min(1, (sp[binIdx] ?? 0) * 1.8) : mid;
            const outer  = U * length * (0.12 + binVal * 0.82 + bass * 0.28 + pulse * beatFlare * 0.22);
            const inner  = U * innerR;
            const rayHue = (hue + (i / rays) * hueSpread) % 360;
            const palF   = ((i / rays) + (palShift ?? 0)) % 1;
            ctx.strokeStyle = _pal
                ? pC(palF)
                : `hsla(${rayHue},${sat}%,72%,${(0.22 + binVal * 0.3) * alphaScale})`;
            ctx.lineWidth = thickness * (1 + binVal * 1.8) * glow * 5;
            ctx.lineCap   = "round";
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
            ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Core spokes with tapered gradient
    for (let i = 0; i < rays; i++) {
        const a      = angle + (i / rays) * Math.PI * 2;
        const binIdx = nBins ? Math.floor((i / rays) * nBins) : 0;
        const binVal = nBins ? Math.min(1, (sp[binIdx] ?? 0) * 1.8) : mid;

        // Treble modulates each spoke by mapping its index to treble bins
        const trebleIdx = nBins ? Math.floor((i / rays) * nBins * 0.4 + nBins * 0.5) : 0;
        const trebleVal = nBins ? Math.min(1, (sp[trebleIdx] ?? 0) * 2) : treble;
        const spokeBoost = 1 + trebleVal * 0.5;

        const outer  = U * length * (0.12 + binVal * 0.82 + bass * 0.28 + pulse * beatFlare * 0.22) * spokeBoost;
        const inner  = U * innerR;
        if (outer <= inner) continue;

        const rayHue = (hue + (i / rays) * hueSpread) % 360;
        const bright = 50 + binVal * 38 + bass * 10;

        const gx0 = Math.cos(a) * inner, gy0 = Math.sin(a) * inner;
        const gx1 = Math.cos(a) * outer, gy1 = Math.sin(a) * outer;
        const ba = (0.75 + binVal * 0.25) * alphaScale;
        const palF = ((i / rays) + (palShift ?? 0)) % 1;

        if (_pal) {
            // Palette mode: solid color per spoke from palette, shifted for secondary burst
            ctx.strokeStyle = pC(palF);
        } else {
            // Solid midpoint color — avoids per-ray createLinearGradient; glow pass provides outer fade
            ctx.strokeStyle = `hsla(${rayHue},${sat}%,${bright}%,${ba})`;
        }
        ctx.lineWidth   = thickness * (0.4 + binVal * 1.6 + bass * 0.8);
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(gx0, gy0);
        ctx.lineTo(gx1, gy1);
        ctx.stroke();
    }
}

export function drawStarburst(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { angle: 0, pulse: 0, prevBass: 0, lastT: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    if (bass > 0.55 && bass > st.prevBass + 0.12) st.pulse = 1;
    st.prevBass  = bass;
    st.pulse    *= 0.87;

    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.angle += dt * p.rotSpeed * (1 + treble * p.trebleFreq);

    const cx = w / 2, cy = h / 2;
    const U  = Math.min(w, h) / 2;
    const rays  = Math.max(3, Math.round(p.rays));
    const nBins = sp ? sp.length : 0;

    ctx.save();
    ctx.translate(cx, cy);

    // Primary burst — palette index by spoke position (i / rays)
    drawSpokeSet(ctx, rays, U, p.innerR, p.length, p.thickness, p.hue, p.hueSpread,
                 p.sat, p.glow, p.taperPow, st.angle, bass, mid, treble,
                 st.pulse, p.beatFlare, sp, nBins, 1, _pal, pC, 0);

    // Secondary burst — palette shifted by 0.5 (i / rays + 0.5)
    if (p.secondBurst > 0.05) {
        const off2 = (p.secondOffset * Math.PI) / 180;
        const hue2 = (p.hue + p.hueSpread * 0.5) % 360;
        drawSpokeSet(ctx, rays, U, p.innerR * 0.7, p.length * 0.7, p.thickness * 0.6,
                     hue2, p.hueSpread * 0.7, p.sat, p.glow * 0.7, p.taperPow,
                     st.angle * -0.8 + off2, bass * 0.8, mid, treble,
                     st.pulse * 0.7, p.beatFlare * 0.7, sp, nBins, p.secondBurst * 0.75,
                     _pal, pC, 0.5);
    }

    // Inner star polygon
    if (p.innerStar > 0.05) {
        const starR = U * p.innerR * (3 + bass * 4 + st.pulse * p.beatFlare * 1.5);
        const starPoints = Math.max(4, Math.round(rays / 6));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `hsla(${p.hue},100%,90%,${p.innerStar * (0.6 + bass * 0.4)})`;
        ctx.lineWidth = p.thickness * 2;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let i = 0; i <= starPoints * 2; i++) {
            const a = st.angle + (i / (starPoints * 2)) * Math.PI * 2;
            const r = i % 2 === 0 ? starR : starR * 0.4;
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
                    : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    // Core orb
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const orbR = U * 0.04 * (1 + bass * 0.9 + st.pulse * p.beatFlare * 0.9 + mid * 0.4);
    const orbGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, orbR);
    orbGrad.addColorStop(0, `hsla(${p.hue},50%,100%,${0.85 + st.pulse * 0.15})`);
    orbGrad.addColorStop(0.4, `hsla(${p.hue},100%,82%,${0.55 + bass * 0.3})`);
    orbGrad.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
    ctx.fillStyle = orbGrad;
    ctx.beginPath(); ctx.arc(0, 0, orbR * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
}
