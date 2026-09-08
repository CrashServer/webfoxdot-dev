// ── Prism Light ───────────────────────────────────────────────────────────────
// White light enters a glass prism and disperses into spectral rainbow beams.
// Bass pulses the beam intensity; treble rotates the incident angle.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Snell's law: refraction at glass→air interface
// n₁·sin(θ₁) = n₂·sin(θ₂)
function refract(sinI, n1, n2) {
    const sinT = n1 * sinI / n2;
    if (Math.abs(sinT) > 1) return null; // TIR
    return Math.asin(sinT);
}

export const prismLightParams = () => ({
    prismAngle: { base: 60,  min: 30, max: 90, step: 1, mod: { source: "" } }, // apex angle (deg)
    incidence:  { base: 45,  min: 10, max: 80,          mod: { source: "" } }, // incident angle (deg)
    rays:       { base: 7,   min: 3,  max: 14, step: 1, mod: { source: "" } }, // spectral rays
    length:     { base: 0.7, min: 0.2,max: 1.5,         mod: { source: "" } }, // output ray length
    glow:       { base: 0.7, min: 0,  max: 1,           mod: { source: "" } },
    thick:      { base: 2,   min: 0.5,max: 6,           mod: { source: "" } },
    pulse:      { base: 0.4, min: 0,  max: 1,           mod: { source: "" } },
    speed:      { base: 0.1, min: 0,  max: 1,           mod: { source: "" } }, // incidence oscillation
    bgAlpha:    { base: 0.9, min: 0,  max: 1,           mod: { source: "" } },
    scale:      { base: 1.0, min: 0.3,max: 2,           mod: { source: "" } },
});

export function drawPrismLight(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const apexDeg   = p.prismAngle ?? 60;
    const incDeg    = (p.incidence ?? 45) + Math.sin(t * (p.speed ?? 0.1) * TAU) * 15 + treble * 10;
    const nRays     = Math.round(Math.max(3, Math.min(14, p.rays ?? 7)));
    const length    = (p.length ?? 0.7) * Math.min(w, h) * (1 + bass * (p.pulse ?? 0.4) * 0.2);
    const glow      = p.glow ?? 0.7;
    const thick     = (p.thick ?? 2) * (1 + bass * 0.3);
    const bgAlpha   = p.bgAlpha ?? 0.9;
    const scale     = p.scale ?? 1.0;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const prismH = Math.min(w, h) * 0.3 * scale;

    // Draw equilateral triangle prism
    const apex  = apexDeg * Math.PI / 180;
    const halfBase = prismH * Math.tan(apex / 2);
    const p1 = [cx, cy - prismH * 0.5];     // top
    const p2 = [cx - halfBase, cy + prismH * 0.5]; // bottom-left
    const p3 = [cx + halfBase, cy + prismH * 0.5]; // bottom-right

    ctx.strokeStyle = "rgba(160,200,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(100,160,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Entry point on left face, exit on right face
    const entryFrac = 0.5;
    const entryX = p2[0] + (p1[0] - p2[0]) * entryFrac;
    const entryY = p2[1] + (p1[1] - p2[1]) * entryFrac;

    // Left face normal (pointing inward)
    const lfDX = p1[0] - p2[0], lfDY = p1[1] - p2[1];
    const lfL  = Math.sqrt(lfDX*lfDX + lfDY*lfDY);
    const lfNx = lfDY / lfL, lfNy = -lfDX / lfL; // rotated 90° inward

    const incRad = incDeg * Math.PI / 180;

    // Incoming white beam
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = thick * 1.5;
    if (glow > 0.05) { ctx.shadowBlur = glow * 15; ctx.shadowColor = "white"; }
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(entryX - Math.cos(incRad) * length * 0.5, entryY - Math.sin(incRad) * length * 0.5);
    ctx.lineTo(entryX, entryY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dispersed rays: each wavelength has different refractive index (Cauchy dispersion)
    const nBase = 1.515; // crown glass
    for (let i = 0; i < nRays; i++) {
        const frac  = i / (nRays - 1); // 0=red, 1=violet
        const hue   = (1 - frac) * 0   + frac * 280; // red→violet
        const n     = nBase + frac * 0.03; // dispersion: violet bends more

        // Refract at entry face
        const thetaI = incRad - Math.atan2(lfNy, lfNx);
        const sinI = Math.sin(thetaI);
        const thetaT = refract(sinI, 1, n);
        if (thetaT === null) continue;

        // Internal ray direction (simplified: assume horizontal right face exit)
        const internalAngle = thetaT + Math.atan2(lfNy, lfNx);
        const dirX = Math.cos(internalAngle), dirY = Math.sin(internalAngle);

        // Find exit point on right face (p3→p1)
        // Simple: project from entry along internal direction until right face
        const rfDX = p1[0] - p3[0], rfDY = p1[1] - p3[1];
        // Parametric intersection
        const denom = dirX * rfDY - dirY * rfDX;
        if (Math.abs(denom) < 0.001) continue;
        const tParam = ((p3[0] - entryX) * rfDY - (p3[1] - entryY) * rfDX) / denom;
        if (tParam < 0) continue;
        const exitX = entryX + dirX * tParam;
        const exitY = entryY + dirY * tParam;

        // Refract at exit face (right face)
        const rfNx = -rfDY / Math.sqrt(rfDX*rfDX+rfDY*rfDY);
        const rfNy =  rfDX / Math.sqrt(rfDX*rfDX+rfDY*rfDY);
        const thetaI2 = internalAngle - Math.atan2(rfNy, rfNx);
        const thetaT2 = refract(Math.sin(thetaI2), n, 1);
        if (thetaT2 === null) continue;
        const exitAngle = thetaT2 + Math.atan2(rfNy, rfNx);

        // Draw internal ray
        ctx.strokeStyle = `hsla(${hue},90%,60%,0.3)`;
        ctx.lineWidth = thick * 0.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY); ctx.lineTo(exitX, exitY); ctx.stroke();

        // Draw exit ray
        const exitDirX = Math.cos(exitAngle), exitDirY = Math.sin(exitAngle);
        const alpha = 0.7 + bass * 0.3;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * (10 + bass * 10);
            ctx.shadowColor = `hsl(${hue},100%,70%)`;
        }
        ctx.strokeStyle = `hsla(${hue},95%,65%,${alpha})`;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(exitX, exitY);
        ctx.lineTo(exitX + exitDirX * length, exitY + exitDirY * length);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
}
