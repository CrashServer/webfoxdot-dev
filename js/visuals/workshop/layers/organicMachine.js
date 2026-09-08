// ── Organic Machine ───────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION OrganicMachineScene (Three.js → Canvas2D).
// Bio-mechanical fusion: pulsing dodecahedral core with organic tentacles + gear arms.
// Bass = core pulse + tentacle thrash. Mid = gear rotation speed. Treble = glow.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function noise2(x, y, t) {
    return Math.sin(x*2.1+t*0.5)*Math.cos(y*1.7-t*0.3);
}

function drawGear(ctx, x, y, r, teeth, rotation, strokeColor, fillColor, lw) {
    const innerR = r * 0.72, toothH = r * 0.28, toothW = (TAU / teeth) * 0.35;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
        const a0 = rotation + (i / teeth) * TAU;
        const a1 = a0 + toothW;
        const am = a0 + toothW / 2;
        ctx.lineTo(x + Math.cos(a0) * innerR, y + Math.sin(a0) * innerR);
        ctx.lineTo(x + Math.cos(a0) * (innerR + toothH), y + Math.sin(a0) * (innerR + toothH));
        ctx.lineTo(x + Math.cos(a1) * (innerR + toothH), y + Math.sin(a1) * (innerR + toothH));
        ctx.lineTo(x + Math.cos(a1) * innerR, y + Math.sin(a1) * innerR);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor; ctx.fill();
    ctx.strokeStyle = strokeColor; ctx.lineWidth = lw; ctx.stroke();
    // Hub
    ctx.beginPath(); ctx.arc(x, y, r*0.22, 0, TAU);
    ctx.fillStyle = strokeColor; ctx.fill();
}

export const organicMachineParams = () => ({
    hue:       { base: 280, min: 0,   max: 360,          mod: { source: "" } }, // organic (purple)
    hue2:      { base: 190, min: 0,   max: 360,          mod: { source: "" } }, // mechanical (cyan)
    tentacles: { base: 6,   min: 2,   max: 12,  step: 1, mod: { source: "" } },
    gears:     { base: 4,   min: 1,   max: 8,   step: 1, mod: { source: "" } },
    pulse:     { base: 0.8, min: 0,   max: 1,            mod: { source: "" } },
    flex:      { base: 0.5, min: 0,   max: 1,            mod: { source: "" } }, // tentacle flex
    gearSpeed: { base: 0.4, min: 0,   max: 2,            mod: { source: "" } },
    coreSize:  { base: 0.2, min: 0.05,max: 0.4,          mod: { source: "" } },
    glow:      { base: 0.7, min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:   { base: 0.88,min: 0,   max: 1,            mod: { source: "" } },
    segments:  { base: 8,   min: 4,   max: 16,  step: 1, mod: { source: "" } },
});

export function drawOrganicMachine(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue      = p.hue ?? 280;
    const hue2     = p.hue2 ?? 190;
    const nTent    = Math.round(Math.max(2, Math.min(12, p.tentacles ?? 6)));
    const nGears   = Math.round(Math.max(1, Math.min(8, p.gears ?? 4)));
    const pulse    = p.pulse ?? 0.8;
    const flex     = p.flex ?? 0.5;
    const gearSpd  = p.gearSpeed ?? 0.4;
    const coreSize = (p.coreSize ?? 0.2) * Math.min(w, h);
    const glow     = p.glow ?? 0.7;
    const bgAlpha  = p.bgAlpha ?? 0.88;
    const nSegs    = Math.round(Math.max(4, Math.min(16, p.segments ?? 8)));

    let st = _st.get(ctx);
    if (!st) {
        st = { gearAngles: Array.from({length:8},(_,i)=>i*0.5), corePulse: 0,
               prevBass: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    const cx = w/2, cy = h/2;

    // Bass → core pulse burst
    if (bass > 0.45 && bass > st.prevBass + 0.08) st.corePulse = bass * pulse;
    st.prevBass = bass;
    st.corePulse *= 0.88;

    // Gear rotation
    for (let i = 0; i < st.gearAngles.length; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        st.gearAngles[i] += dir * gearSpd * dt * (1 + mid * 0.8) * (Math.PI / 4);
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const coreR = coreSize * (1 + st.corePulse * 0.25 + bass * pulse * 0.1);

    // ── Tentacles (organic, behind core)
    for (let i = 0; i < nTent; i++) {
        const baseAng = (i / nTent) * TAU + t * 0.1;
        const tHue = (hue + i * (360/nTent) * 0.3) % 360;
        const flexAmt = flex * (1 + st.corePulse * 2 + bass * pulse * 0.5);

        ctx.strokeStyle = `hsl(${tHue},70%,${25+treble*20}%)`;
        ctx.lineWidth = 3 + coreR * 0.08;
        if (glow>0.05) { ctx.shadowBlur=glow*15; ctx.shadowColor=`hsl(${tHue},100%,50%)`; }
        ctx.beginPath();
        let px = cx + Math.cos(baseAng) * coreR;
        let py = cy + Math.sin(baseAng) * coreR;
        ctx.moveTo(px, py);

        const tLen = coreR * (2.2 + i * 0.2);
        for (let s = 1; s <= nSegs; s++) {
            const frac = s / nSegs;
            const ang = baseAng + Math.sin(frac * Math.PI * 2.5 + t * (1 + i * 0.3)) * flexAmt * 0.8
                      + noise2(i, frac, t * 0.4 + i * 0.7) * flexAmt * 0.4;
            const r = coreR + frac * tLen;
            px = cx + Math.cos(ang) * r;
            py = cy + Math.sin(ang) * r;
            const cpx = cx + Math.cos(ang - 0.2) * (r * 0.6);
            const cpy = cy + Math.sin(ang - 0.2) * (r * 0.6);
            ctx.quadraticCurveTo(cpx, cpy, px, py);
        }
        ctx.stroke();

        // Tip sucker/node
        ctx.shadowBlur = 0;
        ctx.fillStyle = `hsl(${tHue},80%,${35+treble*20}%)`;
        ctx.beginPath(); ctx.arc(px, py, 4+bass*pulse*3, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Gear arms (mechanical)
    const gearOrbit = coreR * 1.8;
    for (let i = 0; i < nGears; i++) {
        const gAng = (i / nGears) * TAU + t * gearSpd * 0.2;
        const gx   = cx + Math.cos(gAng) * gearOrbit;
        const gy   = cy + Math.sin(gAng) * gearOrbit;
        const gR   = coreR * 0.22 * (1 + mid * 0.2);

        // Connecting arm
        if (glow>0.05) { ctx.shadowBlur=glow*8; ctx.shadowColor=`hsl(${hue2},100%,50%)`; }
        ctx.strokeStyle = `hsl(${hue2},60%,${20+treble*15}%)`;
        ctx.lineWidth = gR * 0.18;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gx, gy); ctx.stroke();
        ctx.shadowBlur = 0;

        // Gear
        const gStroke = `hsl(${hue2},80%,${35+treble*25}%)`;
        const gFill   = `hsla(${hue2},50%,${10+treble*8}%,0.85)`;
        const gRot    = st.gearAngles[i % st.gearAngles.length];
        const teeth   = 8 + i * 2;
        if (glow>0.05) { ctx.shadowBlur=glow*12; ctx.shadowColor=`hsl(${hue2},100%,55%)`; }
        drawGear(ctx, gx, gy, gR, teeth, gRot, gStroke, gFill, 0.8);
        ctx.shadowBlur = 0;
    }

    // ── Core: dodecahedron approximation (polar polygon)
    const sides = 12;
    const coreLight = 30 + treble * 25 + st.corePulse * 20;
    if (glow>0.05) { ctx.shadowBlur=glow*30*(1+st.corePulse); ctx.shadowColor=`hsl(${hue},100%,60%)`; }
    // Outer polygon
    ctx.strokeStyle = `hsl(${hue},85%,${coreLight}%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
        const a = (i/sides)*TAU + t*0.15;
        const r = coreR * (0.9 + 0.1*Math.sin(a*3+t*2));
        i===0 ? ctx.moveTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r)
               : ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    }
    ctx.closePath(); ctx.stroke();
    // Fill
    const cGrad = ctx.createRadialGradient(cx,cy,0, cx,cy,coreR);
    cGrad.addColorStop(0, `hsla(${(hue+hue2)/2},70%,${coreLight+10}%,0.9)`);
    cGrad.addColorStop(0.5, `hsla(${hue},60%,${coreLight-10}%,0.7)`);
    cGrad.addColorStop(1, `hsla(${hue},50%,10%,0.4)`);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
        const a = (i/sides)*TAU + t*0.15;
        const r = coreR * (0.9 + 0.1*Math.sin(a*3+t*2));
        i===0 ? ctx.moveTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r)
               : ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fill();

    // Inner mechanical ring
    ctx.strokeStyle = `hsl(${hue2},70%,${25+mid*20}%)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, coreR*0.45, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Rotating inner symbol (star-like)
    ctx.strokeStyle = `hsla(${hue2},90%,${40+treble*30}%,0.7)`;
    ctx.lineWidth = 0.8;
    const starPts = 6;
    ctx.beginPath();
    for (let i = 0; i < starPts; i++) {
        const a0 = (i/starPts)*TAU + t * gearSpd * 1.5;
        const a1 = a0 + TAU/(starPts*2);
        ctx.moveTo(cx+Math.cos(a0)*coreR*0.4, cy+Math.sin(a0)*coreR*0.4);
        ctx.lineTo(cx+Math.cos(a1)*coreR*0.18, cy+Math.sin(a1)*coreR*0.18);
        ctx.lineTo(cx+Math.cos(a0+TAU/starPts)*coreR*0.4, cy+Math.sin(a0+TAU/starPts)*coreR*0.4);
    }
    ctx.stroke();
}
