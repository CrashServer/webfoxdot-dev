// ── Magic Circle ─────────────────────────────────────────────────────────────
// Rotating concentric rings of glyphs — runic, astrological, alchemical, or
// geometric symbols. Center sigil pulses on bass. Each ring counter-rotates
// its neighbours for a mechanical orrery feel.

const SYMBOL_SETS = [
    [...'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'],              // Elder Futhark runes
    [...'☿♀♂♃♄♅♆♇☉☽♈♉♊♋♌♍♎♏♐♑♒♓⛎'],              // Astrological
    [...'△▽◇○□⬡⬢⬣◎⊕⊗⊙∞≡≈∆∇∴∵⊄⊃⊂⊆⊇'],             // Geometric/math
    [...'☯☸✡✦✧☮☩✠⊛⊜⊝☰☱☲☳☴☵☶☷⊞⋄⋆'],              // Esoteric mixed
];

export const magicCircleParams = () => ({
    rings:    { base: 4,   min: 2,   max: 7,   step: 1,  mod: { source: "" } },
    speed:    { base: 0.2, min: -3,  max: 3,             mod: { source: "" } },
    hue:      { base: 270, min: 0,   max: 360,           mod: { source: "" } },
    hueSpan:  { base: 80,  min: 0,   max: 180,           mod: { source: "" } },
    glow:     { base: 0.6, min: 0,   max: 1,             mod: { source: "" } },
    symset:   { base: 0,   min: 0,   max: 3,   step: 1,  mod: { source: "" } },
    size:     { base: 0.85,min: 0.2, max: 1.5,           mod: { source: "" } },
    pulse:    { base: 0.4, min: 0,   max: 1,             mod: { source: "" } },
    bgAlpha:  { base: 0.8, min: 0,   max: 1,             mod: { source: "" } },
});

export function drawMagicCircle(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[10]+spectrum[15]+spectrum[20])/3*3) : 0;

    const numRings = Math.round(Math.max(2, Math.min(7, p.rings ?? 4)));
    const speed    = p.speed ?? 0.2;
    const hue      = p.hue ?? 270;
    const hueSpan  = p.hueSpan ?? 80;
    const glow     = p.glow ?? 0.6;
    const syms     = SYMBOL_SETS[Math.max(0, Math.min(3, Math.round(p.symset ?? 0)))];
    const size     = p.size ?? 0.85;
    const pulse    = p.pulse ?? 0.4;
    const bgAlpha  = p.bgAlpha ?? 0.8;

    const cx = w / 2, cy = h / 2;
    const baseR = Math.min(cx, cy) * size;
    const pulseR = baseR * (1 + bass * pulse * 0.25);

    ctx.clearRect(0, 0, w, h);
    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    const glowPx = glow * 18 * (1 + bass * 0.4);

    // Rings — outer to inner
    for (let ri = 0; ri < numRings; ri++) {
        const frac  = (ri + 1) / (numRings + 1);
        const r     = pulseR * (1 - frac * 0.7);
        const dir   = ri % 2 === 0 ? 1 : -1;
        const rate  = speed * (1 + ri * 0.35) * dir;
        const angle = t * rate;
        const rHue  = (hue + (ri / Math.max(1, numRings - 1)) * hueSpan) % 360;
        const light = 35 + (1 - frac) * 35 + treble * 15;
        const symCount = 6 + ri * 3;

        // Ring outline
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${rHue},75%,${light}%,0.35)`;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = glowPx * 0.4;
        ctx.shadowColor = `hsl(${rHue},100%,70%)`;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Radial tick marks
        const tickCount = symCount;
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = `hsla(${rHue},60%,${light}%,0.2)`;
        for (let ti = 0; ti < tickCount; ti++) {
            const ta = angle + (ti / tickCount) * Math.PI * 2;
            const r0 = r * 0.93, r1 = r;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0);
            ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1);
            ctx.stroke();
        }

        // Symbols on the ring
        const fs = Math.max(7, Math.min(22, Math.round(r * 0.6 / Math.max(1, symCount / 7))));
        ctx.font = `${fs}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `hsl(${rHue},90%,${light + 10}%)`;
        ctx.shadowBlur = glowPx;
        ctx.shadowColor = `hsl(${rHue},100%,75%)`;

        for (let si = 0; si < symCount; si++) {
            const a  = angle + (si / symCount) * Math.PI * 2;
            const sx = cx + Math.cos(a) * r;
            const sy = cy + Math.sin(a) * r;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(a + Math.PI / 2); // keep symbols upright-ish relative to ring
            ctx.fillText(syms[si % syms.length], 0, 0);
            ctx.restore();
        }
        ctx.shadowBlur = 0;
    }

    // Center sigil: overlapping triangles forming a hexagram
    const sr = pulseR * 0.13 * (1 + mid * 0.3);
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = glowPx * 1.2;
    ctx.shadowColor = `hsl(${hue},100%,80%)`;
    ctx.strokeStyle = `hsl(${hue},90%,80%)`;
    for (let tr = 0; tr < 2; tr++) {
        const ta = t * speed * 1.5 + tr * Math.PI / 3;
        ctx.beginPath();
        for (let vi = 0; vi <= 3; vi++) {
            const a  = ta + (vi / 3) * Math.PI * 2;
            const sx = cx + Math.cos(a) * sr;
            const sy = cy + Math.sin(a) * sr;
            if (vi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, sr * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue},100%,90%)`;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
}
