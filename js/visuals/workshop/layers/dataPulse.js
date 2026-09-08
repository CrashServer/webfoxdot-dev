// ── Data Pulse ────────────────────────────────────────────────────────────────
// Concentric rectangles that expand outward from center on each beat.
// Each harmonic ring = a different audio band. Minimal, architectural, Ikeda.
// Bass = kick / large ring; mid = medium ring; treble = fast thin rings.

const _state = new WeakMap();

export const dataPulseParams = () => ({
    rings:   { base: 8,   min: 2,   max: 24,  step: 1, mod: { source: "" } },
    speed:   { base: 1,   min: 0.1, max: 4,   mod: { source: "" } },
    thick:   { base: 1,   min: 0.5, max: 4,   mod: { source: "" } },
    hue:     { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    mono:    { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    square:  { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    decay:   { base: 0.4, min: 0.1, max: 0.98, mod: { source: "" } },
});

export function drawDataPulse(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { pulses: [], prevBass: 0, prevMid: 0, lastT: 0 }; _state.set(ctx, st); }

    const sp     = extra?.spectrum ?? [];
    const bass   = sp.length ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2.8) : 0;
    const mid    = sp.length ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2.5) : 0;
    const treble = sp.length ? Math.min(1, (sp[28] + sp[35]) / 2 * 3) : 0;

    const dt = Math.min(0.05, t - (st.lastT || t));
    st.lastT = t;

    const speed = p.speed ?? 1;
    const hue   = p.hue ?? 0;
    const mono  = (p.mono ?? 1) > 0.5;
    const sq    = (p.square ?? 1) > 0.5;
    const thick = p.thick ?? 1;
    const decay = p.decay ?? 0.4;
    const nRings = Math.round(p.rings ?? 8);

    // Spawn pulses on transients
    if (bass > 0.5 && bass > st.prevBass + 0.08)
        st.pulses.push({ r: 0, amp: bass,   band: 0 });
    if (mid > 0.45 && mid > st.prevMid + 0.08)
        st.pulses.push({ r: 0, amp: mid * 0.7, band: 1 });
    if (treble > 0.5 && Math.random() < 0.15)
        st.pulses.push({ r: 0, amp: treble * 0.5, band: 2 });
    st.prevBass = bass; st.prevMid = mid;

    // Cap pulses
    if (st.pulses.length > 40) st.pulses = st.pulses.slice(-40);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.1;

    // Standing ring harmonics driven by continuous audio
    const ringStep = maxR / nRings;
    for (let i = 0; i < nRings; i++) {
        const binIdx = Math.floor(i / nRings * (sp.length || 1));
        const amp = sp[binIdx] ?? 0;
        const r = (i + 1) * ringStep;
        const alpha = amp * 0.6;
        if (alpha < 0.01) continue;

        if (mono) {
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        } else {
            const h2 = (hue + i * (360 / nRings)) % 360;
            ctx.strokeStyle = `hsla(${h2},80%,60%,${alpha})`;
        }
        ctx.lineWidth = thick * 0.8;

        if (sq) {
            const side = r * 2;
            ctx.strokeRect(cx - r, cy - r * (h / w), side, side * (h / w));
        } else {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
        }
    }

    // Travelling pulses
    for (let i = st.pulses.length - 1; i >= 0; i--) {
        const pu = st.pulses[i];
        pu.r += dt * maxR * speed * (1.2 + pu.band * 0.5);
        const alpha = pu.amp * (1 - pu.r / maxR);
        if (alpha < 0.01 || pu.r > maxR) { st.pulses.splice(i, 1); continue; }

        const bHue = pu.band === 0 ? hue : pu.band === 1 ? (hue + 120) % 360 : (hue + 240) % 360;
        if (mono) {
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        } else {
            ctx.strokeStyle = `hsla(${bHue},90%,65%,${alpha})`;
        }
        ctx.lineWidth = thick * (pu.amp * 2 + 0.5) * (1 - pu.r / maxR * 0.7);

        const r = pu.r;
        if (sq) {
            ctx.strokeRect(cx - r, cy - r * (h / w), r * 2, r * 2 * (h / w));
        } else {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
        }
    }
}
