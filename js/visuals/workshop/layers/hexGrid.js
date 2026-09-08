// ── Hex Grid ──────────────────────────────────────────────────────────────────
// Hexagonal grid with audio-reactive cells. Bass pulses cell brightness and
// scale; mid drives a color wave that sweeps across the grid; treble adds
// inner triangle detail and edge highlights. Single blur-composite glow pass
// for performance. Optional palette-aware coloring and ripple animation.

const _state = new WeakMap();

// Flat-top unit hex (radius 1)
const UNIT_HEX = (() => {
    const p = new Path2D();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        i === 0 ? p.moveTo(Math.cos(a), Math.sin(a)) : p.lineTo(Math.cos(a), Math.sin(a));
    }
    p.closePath();
    return p;
})();

// Inner triangle for treble detail
const UNIT_TRI = (() => {
    const p = new Path2D();
    for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i * 2 + Math.PI / 6;
        i === 0 ? p.moveTo(Math.cos(a)*0.5, Math.sin(a)*0.5) : p.lineTo(Math.cos(a)*0.5, Math.sin(a)*0.5);
    }
    p.closePath();
    return p;
})();

export const hexGridParams = () => ({
    hue:       { base: 200, min: 0,    max: 360, mod: { source: "" } },
    size:      { base: 30,  min: 8,    max: 90,  mod: { source: "" } },
    hueRange:  { base: 140, min: 0,    max: 360, mod: { source: "" } },
    glow:      { base: 2,   min: 0,    max: 5,   mod: { source: "" } },
    gap:       { base: 0.06,min: 0,    max: 0.4, mod: { source: "" } },
    waveSpeed: { base: 30,  min: 0,    max: 120, mod: { source: "" } },
    brightness:{ base: 1,   min: 0.2,  max: 2,   mod: { source: "" } },
    innerTri:  { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    ripple:    { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    rotation:  { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
    saturation:{ base: 80,  min: 20,   max: 100, mod: { source: "" } },
    bgDark:    { base: 0.03,min: 0,    max: 0.3, mod: { source: "" } },
    usePalette:{ base: 0,   min: 0,    max: 1,   mod: { source: "" } },
});

export function drawHexGrid(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, gc: null, gCtx: null, bassAcc: 0, rippleT: 0, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };

    const sp       = extra?.spectrum;
    const bass     = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid      = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble   = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    // Smooth bass accumulator
    st.bassAcc += (bass - st.bassAcc) * 0.15;
    if (bass > 0.7) { st.rippleT = st.time; }

    const r          = Math.max(8, Math.min(90, p.size ?? 30));
    const hue        = p.hue       ?? 200;
    const hueRange   = p.hueRange  ?? 140;
    const glow       = p.glow      ?? 2;
    const gap        = p.gap       ?? 0.06;
    const waveSpeed  = p.waveSpeed ?? 30;
    const brightness = p.brightness ?? 1;
    const innerTri   = p.innerTri  ?? 0.5;
    const rippleAmt  = p.ripple    ?? 0.5;
    const rotation   = p.rotation  ?? 0;
    const sat        = p.saturation ?? 80;
    const bgDark     = p.bgDark    ?? 0.03;

    const drawR  = r * (1 - gap);
    const hexH   = r * Math.sqrt(3);
    const colW   = r * 1.5;
    const cols   = Math.ceil(w / colW) + 3;
    const rows   = Math.ceil(h / hexH) + 3;
    const hDrift = (st.time * waveSpeed) % 360;
    const pulsedR = drawR * (1 + st.bassAcc * 0.18);

    // Lazy glow canvas
    const needGlow = glow > 0.1;
    if (needGlow && (!st.gc || st.gc.width !== w || st.gc.height !== h)) {
        st.gc = document.createElement("canvas");
        st.gc.width = w; st.gc.height = h;
        st.gCtx = st.gc.getContext("2d");
    }
    const gc = st.gCtx;
    if (needGlow) gc.clearRect(0, 0, w, h);

    // Background
    const bgL = (bgDark * 100) | 0;
    ctx.fillStyle = `hsl(${hue},20%,${bgL}%)`; ctx.fillRect(0, 0, w, h);

    const rotAngle = rotation * st.time * 0.3;

    ctx.save();
    if (rotation > 0) {
        ctx.translate(w/2, h/2);
        ctx.rotate(rotAngle);
        ctx.translate(-w/2, -h/2);
    }
    ctx.shadowBlur = 0;

    for (let c = -2; c < cols; c++) {
        for (let row = -2; row < rows; row++) {
            const hcx = c * colW;
            const hcy = row * hexH + (c % 2 === 0 ? 0 : hexH * 0.5);

            // Map to spectrum
            const cellIdx = Math.abs((c * rows + row) * 3) % 256;
            const specBin = cellIdx % (sp?.length ?? 64);
            let bright = 0;
            if (sp && specBin < sp.length) bright = Math.min(1, sp[specBin] * 2.5 * brightness);

            // Ripple effect from bass hit
            let rippleFactor = 0;
            if (rippleAmt > 0) {
                const rippleAge = st.time - st.rippleT;
                const cellDist  = Math.hypot(hcx - w/2, hcy - h/2) / Math.min(w, h);
                const rippleR   = rippleAge * 0.8;
                const rippleDiff = Math.abs(cellDist - rippleR);
                rippleFactor = rippleAmt * Math.max(0, 1 - rippleDiff * 15) * Math.max(0, 1 - rippleAge * 2);
            }

            const totalBright = Math.min(1, bright + rippleFactor + mid * 0.12);
            const lightness   = Math.max(0, Math.min(95, 4 + totalBright * 80));
            const cellHue     = (hue + hDrift + (cellIdx / 256) * hueRange) % 360;

            ctx.setTransform(pulsedR, 0, 0, pulsedR, hcx, hcy);
            if (rotation > 0) ctx.setTransform(pulsedR * Math.cos(rotAngle), pulsedR * Math.sin(rotAngle), -pulsedR * Math.sin(rotAngle), pulsedR * Math.cos(rotAngle), hcx, hcy);

            ctx.fillStyle = _pal ? pC(totalBright) : `hsl(${cellHue},${sat}%,${lightness}%)`;
            ctx.fill(UNIT_HEX);

            // Inner triangle (treble detail)
            if (innerTri > 0.05 && treble > 0.1) {
                const triL = Math.min(95, lightness + treble * 25 * innerTri);
                ctx.fillStyle = `hsla(${(cellHue + 60) % 360},${sat}%,${triL}%,${treble * innerTri * 0.8})`;
                ctx.fill(UNIT_TRI);
            }

            // Collect glowing cells
            if (needGlow && totalBright > 0.3) {
                gc.setTransform(pulsedR, 0, 0, pulsedR, hcx, hcy);
                gc.fillStyle = _pal ? pC(totalBright) : `hsl(${cellHue},${Math.min(100,sat+10)}%,${Math.min(90, lightness + 18)}%)`;
                gc.fill(UNIT_HEX);
            }
        }
    }
    ctx.restore();
    ctx.setTransform(1,0,0,1,0,0);

    // Edge highlight pass for bright cells (mid driven)
    if (mid > 0.3) {
        ctx.save();
        ctx.globalAlpha = mid * 0.4;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `hsl(${(hue + hDrift) % 360},100%,80%)`;
        ctx.lineWidth = 0.8;
        for (let c = -2; c < cols; c++) {
            for (let row = -2; row < rows; row++) {
                const hcx = c * colW;
                const hcy = row * hexH + (c % 2 === 0 ? 0 : hexH * 0.5);
                const cellIdx = Math.abs((c * rows + row) * 3) % 256;
                const specBin = cellIdx % (sp?.length ?? 64);
                const bright  = sp && specBin < sp.length ? Math.min(1, sp[specBin] * 2.5) : 0;
                if (bright < 0.5) continue;
                ctx.setTransform(pulsedR * 0.95, 0, 0, pulsedR * 0.95, hcx, hcy);
                ctx.stroke(UNIT_HEX);
            }
        }
        ctx.restore();
        ctx.setTransform(1,0,0,1,0,0);
    }

    // Single blur-composite glow pass
    if (needGlow) {
        const blurPx = glow * 12 + st.bassAcc * 12 + treble * 5;
        ctx.save();
        ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(st.gc, 0, 0);
        ctx.filter = "none";
        ctx.restore();
    }
}
