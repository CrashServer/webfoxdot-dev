// ── Tron Tunnel ───────────────────────────────────────────────────────────────
// Wireframe hexagonal/polygonal flythrough tunnel with light-cycle aesthetics.
// Bass brightens grid walls and adds speed burst; mid shifts hue along tunnel;
// treble fires energy pulses that race down the corridor. Longitudinal edge
// lines connect rings; optional cross-braces; animated energy particles.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.18|0); let v=0; for(let i=0;i<n;i++) v+=s[i]; return Math.min(1, v/n*3); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.2|0,b=s.length*.5|0; let v=0,n=Math.max(1,b-a); for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/n*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

function project(x3, y3, z3, fov, cx, cy, side) {
    if (z3 <= 0.01) return null;
    const scale = fov / z3;
    return { sx: cx + x3 * scale * side * 0.5, sy: cy + y3 * scale * side * 0.5, scale };
}

export const tronTunnelParams = () => ({
    hue:        { base: 180, min: 0,   max: 360, mod: { source: "" } },
    speed:      { base: 2.5, min: 0.2, max: 8,   mod: { source: "" } },
    sides:      { base: 6,   min: 3,   max: 12,  mod: { source: "" } },
    glow:       { base: 2,   min: 0,   max: 4,   mod: { source: "" } },
    fov:        { base: 0.8, min: 0.3, max: 1.5, mod: { source: "" } },
    braceEvery: { base: 3,   min: 1,   max: 10,  mod: { source: "" } },
    hueShift:   { base: 20,  min: 0,   max: 120, mod: { source: "" } },
    pulseCount: { base: 3,   min: 0,   max: 8,   mod: { source: "" } },
    tunnelTwist:{ base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    edgeLines:  { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
});

export function drawTronTunnel(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { cameraZ: 0, pulses: [], speedBurst: 0 }; _state.set(ctx, st); }

    const spectrum    = extra?.spectrum;
    const bass        = bassLevel(spectrum);
    const mid2        = midLevel(spectrum);
    const treble      = trebleLevel(spectrum);

    const hue         = p.hue        ?? 180;
    const hueShift    = p.hueShift   ?? 20;
    const baseSpeed   = p.speed      ?? 2.5;
    const sides       = Math.max(3, Math.min(12, Math.round(p.sides ?? 6)));
    const glowVal     = (p.glow      ?? 2) + bass * 1.8;
    const fov         = p.fov        ?? 0.8;
    const braceEvery  = Math.max(1, Math.min(10, Math.round(p.braceEvery ?? 3)));
    const hueShiftAmt = p.hueShift   ?? 20;
    const pulseCount  = Math.round(p.pulseCount ?? 3);
    const tunnelTwist = p.tunnelTwist ?? 0;
    const showEdges   = (p.edgeLines ?? 1) > 0.5;

    // Speed burst on bass hit
    if (bass > 0.6) st.speedBurst = Math.min(1, st.speedBurst + bass * 0.5);
    st.speedBurst *= 0.92;
    const speed = baseSpeed * (1 + st.speedBurst * 1.5 + bass * 0.4);
    st.cameraZ += speed / 60;

    const ringSpacing = 2.0;
    const FAR_Z       = 50;
    const NEAR_Z      = 1.5;
    const tunnelRadius= 1.0;
    const cx = w / 2, cy = h / 2;
    const side = Math.min(w, h);

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

    // Precompute angles with optional twist
    const numRings = Math.ceil(FAR_Z / ringSpacing) + 3;
    const angles = new Array(sides);
    for (let s = 0; s < sides; s++) angles[s] = (s / sides) * Math.PI * 2 - Math.PI / sides;

    // Energy pulses: spawn on treble burst
    if (treble > 0.5 && Math.random() < treble * 0.3 && st.pulses.length < pulseCount) {
        st.pulses.push({ z: FAR_Z, hue: (hue + Math.random() * 60 - 30 + 360) % 360, width: 2 + treble * 3 });
    }
    // Move pulses toward camera
    for (let i = st.pulses.length - 1; i >= 0; i--) {
        st.pulses[i].z -= speed / 60 * 1.8;
        if (st.pulses[i].z < NEAR_Z) st.pulses.splice(i, 1);
    }

    // Draw rings back to front
    for (let riOrd = numRings - 1; riOrd >= 0; riOrd--) {
        const worldZ = ringSpacing * riOrd;
        let camZ = worldZ - (st.cameraZ % (ringSpacing * numRings));
        if (camZ < NEAR_Z) camZ += ringSpacing * numRings;
        if (camZ > FAR_Z)  continue;

        const t01    = 1 - (camZ - NEAR_Z) / (FAR_Z - NEAR_Z);
        const isBrace= (riOrd % braceEvery === 0);
        const twist  = tunnelTwist * camZ * 0.1;

        // Ring hue shifts with depth (mid driven)
        const ringHue = (hue + t01 * hueShiftAmt + mid2 * 30) % 360;
        const bright  = 15 + t01 * 65 + bass * 20;
        const alpha   = 0.12 + t01 * 0.88;
        const lineW   = 0.4 + t01 * 2.2 + bass * 0.8;
        const glowN   = glowVal * t01 * 14;

        // Check if a pulse is at this ring position
        let pulseBoost = 0;
        for (const pulse of st.pulses) {
            const pz = pulse.z;
            const dist2 = Math.abs(camZ - pz);
            if (dist2 < ringSpacing * 0.8) pulseBoost = Math.max(pulseBoost, 1 - dist2 / (ringSpacing * 0.8));
        }

        const projVerts = new Array(sides);
        let allValid = true;
        for (let s = 0; s < sides; s++) {
            const ang = angles[s] + twist;
            const vx  = Math.cos(ang) * tunnelRadius;
            const vy  = Math.sin(ang) * tunnelRadius;
            const pr  = project(vx, vy, camZ, fov, cx, cy, side);
            if (!pr) { allValid = false; break; }
            projVerts[s] = pr;
        }
        if (!allValid) continue;

        ctx.save();
        const finalBright = Math.min(95, bright + pulseBoost * 40);
        const finalAlpha  = Math.min(1, alpha + pulseBoost * 0.5);
        const finalGlow   = glowN + pulseBoost * 20;
        ctx.strokeStyle   = `hsl(${ringHue},90%,${finalBright}%)`;
        ctx.lineWidth     = lineW + pulseBoost * 3;
        ctx.globalAlpha   = finalAlpha;
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(projVerts[0].sx, projVerts[0].sy);
        for (let s = 1; s < sides; s++) ctx.lineTo(projVerts[s].sx, projVerts[s].sy);
        ctx.closePath();
        ctx.stroke();

        // Braces
        if (isBrace) {
            ctx.lineWidth = lineW * 0.5;
            ctx.shadowBlur = 0;
            for (let s = 0; s < sides; s++) {
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(projVerts[s].sx, projVerts[s].sy); ctx.stroke();
            }
        }
        ctx.restore();
    }

    // Longitudinal edge lines
    if (showEdges) {
        const edgeCount = sides;
        for (let e = 0; e < edgeCount; e++) {
            const ang = angles[e];
            const vx = Math.cos(ang) * tunnelRadius;
            const vy = Math.sin(ang) * tunnelRadius;
            const edgeHue = (hue + e * (hueShiftAmt / edgeCount)) % 360;
            ctx.save();
            ctx.strokeStyle = `hsl(${edgeHue},85%,55%)`;
            ctx.lineWidth   = 0.7 + bass * 0.8;
            ctx.globalAlpha = 0.35 + bass * 0.25;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            let first = true;
            for (let ri = numRings - 1; ri >= 0; ri--) {
                let camZ = ringSpacing * ri - (st.cameraZ % (ringSpacing * numRings));
                if (camZ < NEAR_Z) camZ += ringSpacing * numRings;
                if (camZ > FAR_Z)  continue;
                const twist = tunnelTwist * camZ * 0.1;
                const pr = project(Math.cos(ang + twist) * tunnelRadius, Math.sin(ang + twist) * tunnelRadius, camZ, fov, cx, cy, side);
                if (!pr) continue;
                if (first) { ctx.moveTo(pr.sx, pr.sy); first = false; }
                else        ctx.lineTo(pr.sx, pr.sy);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    // Energy pulse rings (drawn on top, additive)
    ctx.globalCompositeOperation = "lighter";
    for (const pulse of st.pulses) {
        let camZ = pulse.z - (st.cameraZ % (ringSpacing * numRings));
        if (camZ < NEAR_Z || camZ > FAR_Z) continue;
        const t01 = 1 - (camZ - NEAR_Z) / (FAR_Z - NEAR_Z);
        const projVerts = new Array(sides);
        let allValid = true;
        for (let s = 0; s < sides; s++) {
            const pr = project(Math.cos(angles[s])*tunnelRadius, Math.sin(angles[s])*tunnelRadius, camZ, fov, cx, cy, side);
            if (!pr) { allValid = false; break; }
            projVerts[s] = pr;
        }
        if (!allValid) continue;
        ctx.strokeStyle = `hsla(${pulse.hue},100%,80%,${t01 * 0.9})`;
        ctx.lineWidth   = pulse.width * t01;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(projVerts[0].sx, projVerts[0].sy);
        for (let s = 1; s < sides; s++) ctx.lineTo(projVerts[s].sx, projVerts[s].sy);
        ctx.closePath();
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
}
