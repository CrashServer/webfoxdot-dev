// ── Surveillance ──────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION SurveillanceScene (Three.js → Canvas2D).
// Panopticon tower eye in centre, rotating sweep beams, citizen silhouettes,
// data-feed HUD bars. Bass = alert spike. Mid = scan acceleration.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const ALERT_MSGS = ['ANOMALY DETECTED','FACE MATCH 97.3%','TRACKING SUBJECT','THREAT LEVEL: HIGH',
                    'CROSS-REF FLAGGED','BEHAVIOUR SCORE: 12','DENY ACCESS','UNDER SURVEILLANCE'];

function noise1(x, t) { return Math.sin(x * 2.1 + t) * Math.cos(x * 0.7 - t * 0.4); }

export const surveillanceParams = () => ({
    hue:       { base: 0,    min: 0,   max: 360,          mod: { source: "" } }, // red
    hue2:      { base: 120,  min: 0,   max: 360,          mod: { source: "" } }, // scan (green)
    beams:     { base: 3,    min: 1,   max: 8,   step: 1, mod: { source: "" } },
    scanSpeed: { base: 0.4,  min: 0.05,max: 2,            mod: { source: "" } },
    citizens:  { base: 6,    min: 0,   max: 16,  step: 1, mod: { source: "" } },
    pulse:     { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    glow:      { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    showHud:   { base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } },
    bgAlpha:   { base: 0.88, min: 0,   max: 1,            mod: { source: "" } },
    alertRate: { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
});

function drawSilhouette(ctx, x, y, scale, alpha, hue) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue},60%,25%)`;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // head
    ctx.beginPath(); ctx.arc(0, -22, 8, 0, TAU); ctx.fill();
    // body
    ctx.fillRect(-7, -14, 14, 20);
    // legs
    ctx.fillRect(-7, 6, 5, 14); ctx.fillRect(2, 6, 5, 14);
    ctx.restore();
}

export function drawSurveillance(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue       = p.hue ?? 0;
    const hue2      = p.hue2 ?? 120;
    const nBeams    = Math.round(Math.max(1, p.beams ?? 3));
    const scanSpd   = (p.scanSpeed ?? 0.4) * (1 + mid * (p.pulse ?? 0.8) * 1.5);
    const nCit      = Math.round(Math.max(0, p.citizens ?? 6));
    const pulse     = p.pulse ?? 0.8;
    const glow      = p.glow ?? 0.7;
    const showHud   = (p.showHud ?? 1) > 0.5;
    const bgAlpha   = p.bgAlpha ?? 0.88;
    const alertRate = p.alertRate ?? 0.5;

    let st = _st.get(ctx);
    if (!st || st.nCit !== nCit) {
        const citizens = [];
        for (let i = 0; i < nCit; i++) {
            citizens.push({
                x: w * 0.1 + Math.random() * w * 0.8,
                y: h * 0.55 + Math.random() * h * 0.35,
                scale: 0.5 + Math.random() * 0.8,
                phase: Math.random() * TAU,
                speed: (Math.random() - 0.5) * 30,
                flagged: false, flagTimer: 0,
            });
        }
        st = { citizens, beamAngles: Array.from({length:8},(_,i)=>i*TAU/8),
               alertMsg: '', alertTimer: 0, alertFlash: 0,
               prevBass: 0, lastT: t, nCit };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Advance beam angles
    for (let i = 0; i < nBeams; i++) {
        st.beamAngles[i] = (st.beamAngles[i] + scanSpd * dt) % TAU;
    }

    // Bass → alert
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        st.alertFlash = bass * pulse;
        if (alertRate > 0.1 && Math.random() < alertRate) {
            st.alertMsg = ALERT_MSGS[Math.floor(Math.random() * ALERT_MSGS.length)];
            st.alertTimer = 2;
            // Flag a random citizen
            if (nCit > 0) {
                const ci = Math.floor(Math.random() * st.citizens.length);
                st.citizens[ci].flagged = true;
                st.citizens[ci].flagTimer = 3;
            }
        }
    }
    st.prevBass = bass;
    st.alertFlash *= 0.9;
    st.alertTimer -= dt;
    for (const c of st.citizens) { if (c.flagTimer > 0) c.flagTimer -= dt; else c.flagged = false; }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Vignette: red edges
    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.min(w,h)*0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `hsla(${hue},70%,12%,0.6)`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    const cx = w/2, cy = h * 0.38;
    const scanR = Math.min(w, h) * 0.45;

    // ── Scan sweep beams (conical gradient simulation)
    for (let i = 0; i < nBeams; i++) {
        const ang = st.beamAngles[i];
        // Check if any citizen is in beam
        for (const c of st.citizens) {
            const ca = Math.atan2(c.y - cy, c.x - cx);
            const da = ((ca - ang) % TAU + TAU) % TAU;
            if (da < 0.15 && Math.hypot(c.x-cx, c.y-cy) < scanR * 1.1) {
                c.flagged = true; c.flagTimer = 1.5;
            }
        }
        const grad = ctx.createConicalGradient?.(cx, cy, ang, ang + 0.35)
            ?? null;
        if (grad) {
            grad.addColorStop(0, `hsla(${hue2},90%,55%,0.0)`);
            grad.addColorStop(0.5, `hsla(${hue2},90%,55%,${0.12+mid*0.08})`);
            grad.addColorStop(1, `hsla(${hue2},90%,55%,0.0)`);
            ctx.fillStyle = grad;
        } else {
            // Fallback: line + sector polygon
            ctx.fillStyle = `hsla(${hue2},90%,55%,${0.08+mid*0.05})`;
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const steps = 20;
        for (let s = 0; s <= steps; s++) {
            const a = ang + (s / steps) * 0.4;
            ctx.lineTo(cx + Math.cos(a) * scanR * 1.1, cy + Math.sin(a) * scanR * 1.1);
        }
        ctx.closePath(); ctx.fill();

        // Beam edge line
        if (glow > 0.05) { ctx.shadowBlur = glow * 18; ctx.shadowColor = `hsl(${hue2},100%,60%)`; }
        ctx.strokeStyle = `hsla(${hue2},90%,65%,0.7)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * scanR, cy + Math.sin(ang) * scanR);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ── Concentric scan rings
    for (let r = 1; r <= 4; r++) {
        const rr = (scanR / 4) * r;
        const pulse2 = 0.3 + treble * 0.2 + bass * pulse * 0.1 * (r === 1 ? 1 : 0);
        ctx.strokeStyle = `hsla(${hue},60%,35%,${pulse2})`;
        ctx.lineWidth = r === 1 ? 1.5 : 0.7;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
    }

    // ── Panopticon eye (centre)
    const eyeR = 18 + bass * pulse * 8;
    if (glow > 0.05) { ctx.shadowBlur = glow * 30 * (1 + bass * pulse * 0.5); ctx.shadowColor = `hsl(${hue},100%,50%)`; }
    // Outer ring
    ctx.strokeStyle = `hsl(${hue},90%,${40+treble*25}%)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, eyeR, 0, TAU); ctx.stroke();
    // Iris
    ctx.fillStyle = `hsl(${hue},80%,${20+bass*pulse*15}%)`;
    ctx.beginPath(); ctx.arc(cx, cy, eyeR * 0.6, 0, TAU); ctx.fill();
    // Pupil
    ctx.fillStyle = `hsl(${hue},70%,${8+bass*pulse*10}%)`;
    ctx.beginPath(); ctx.arc(cx, cy, eyeR * 0.25, 0, TAU); ctx.fill();
    // Specular
    ctx.fillStyle = `rgba(255,200,200,${0.4+treble*0.3})`;
    ctx.beginPath(); ctx.arc(cx - eyeR*0.15, cy - eyeR*0.15, eyeR*0.08, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // ── Citizens
    for (const c of st.citizens) {
        c.x = Math.max(20, Math.min(w-20, c.x + c.speed * dt * (1 + bass*0.3)));
        if (c.x <= 20 || c.x >= w-20) c.speed *= -1;
        const cHue = c.flagged ? hue : hue2 - 60;
        const cAlpha = c.flagged ? (0.4 + Math.sin(t * 8) * 0.3) : 0.25;
        drawSilhouette(ctx, c.x, c.y, c.scale, cAlpha, cHue);
        if (c.flagged) {
            // Target reticle
            if (glow > 0.05) { ctx.shadowBlur = glow * 12; ctx.shadowColor = `hsl(${hue},100%,50%)`; }
            ctx.strokeStyle = `hsla(${hue},100%,55%,0.8)`;
            ctx.lineWidth = 1;
            const ty = c.y - c.scale * 28;
            ctx.beginPath(); ctx.arc(c.x, ty, 14, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c.x-18,ty); ctx.lineTo(c.x-10,ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c.x+10,ty); ctx.lineTo(c.x+18,ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c.x,ty-18); ctx.lineTo(c.x,ty-10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c.x,ty+10); ctx.lineTo(c.x,ty+18); ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // ── Alert overlay
    if (st.alertTimer > 0 && st.alertMsg) {
        const af = Math.min(1, st.alertTimer);
        ctx.fillStyle = `hsla(${hue},90%,55%,${af * 0.85})`;
        ctx.font = `bold ${Math.round(12 + treble*4)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`[ ${st.alertMsg} ]`, w/2, h * 0.12);
        ctx.textAlign = 'left';
    }

    // ── Red flash
    if (st.alertFlash > 0.01) {
        ctx.fillStyle = `hsla(${hue},90%,45%,${st.alertFlash * 0.2})`;
        ctx.fillRect(0, 0, w, h);
    }

    // ── HUD
    if (showHud) {
        ctx.font = '8px monospace';
        ctx.fillStyle = `hsla(${hue},70%,50%,0.55)`;
        const threat = Math.floor((bass * pulse * 100 + mid * 30));
        ctx.fillText(`THREAT: ${threat}%  SCAN: ${(scanSpd*60).toFixed(1)}°/s  TARGETS: ${st.citizens.filter(c=>c.flagged).length}`, 8, h-10);
        // Spectrum bars at bottom
        if (spectrum) {
            for (let i = 0; i < 32; i++) {
                const bh2 = spectrum[i] * 20;
                ctx.fillStyle = `hsla(${hue},80%,${40+i}%,0.4)`;
                ctx.fillRect(8 + i * (w-16)/32, h-10-bh2, (w-16)/32-1, bh2);
            }
        }
    }
}
