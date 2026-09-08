// ── Droste Feedback ───────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION DrosteFeedbackScene (Three.js → Canvas2D).
// True Canvas2D Droste: each frame draws the previous frame scaled+rotated into
// itself, creating an infinite recursive tunnel. Bass = twist spike. Mid = zoom.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const drosteFeedbackParams = () => ({
    scale:    { base: 0.88, min: 0.6,  max: 0.99,         mod: { source: "" } }, // feedback shrink
    rotate:   { base: 0.008,min: -0.1, max: 0.1,           mod: { source: "" } }, // rotation per frame
    offsetX:  { base: 0,    min: -0.3, max: 0.3,           mod: { source: "" } }, // centre offset X
    offsetY:  { base: 0,    min: -0.3, max: 0.3,           mod: { source: "" } }, // centre offset Y
    pulse:    { base: 0.7,  min: 0,    max: 1,             mod: { source: "" } },
    hue:      { base: 200,  min: 0,    max: 360,           mod: { source: "" } }, // source colour
    hue2:     { base: 300,  min: 0,    max: 360,           mod: { source: "" } },
    source:   { base: 0,    min: 0,    max: 2,   step: 1,  mod: { source: "" } }, // 0=lissajous,1=spiral,2=noise
    decay:    { base: 0.04, min: 0,    max: 0.3,           mod: { source: "" } }, // fade per frame
    glow:     { base: 0.5,  min: 0,    max: 1,             mod: { source: "" } },
    twist:    { base: 0.5,  min: 0,    max: 1,             mod: { source: "" } }, // bass twist intensity
});

export function drawDrosteFeedback(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const sc      = (p.scale ?? 0.88) - mid * 0.05;
    const rot     = (p.rotate ?? 0.008) + bass * (p.twist ?? 0.5) * 0.06;
    const offX    = (p.offsetX ?? 0) * w;
    const offY    = (p.offsetY ?? 0) * h;
    const pulse   = p.pulse ?? 0.7;
    const hue     = p.hue ?? 200;
    const hue2    = p.hue2 ?? 300;
    const srcMode = Math.round(Math.max(0, Math.min(2, p.source ?? 0)));
    const decay   = p.decay ?? 0.04;
    const glow    = p.glow ?? 0.5;

    let st = _st.get(ctx);
    if (!st) {
        const buf = document.createElement('canvas');
        buf.width = w; buf.height = h;
        st = { buf, bufCtx: buf.getContext('2d'), lastT: t };
        _st.set(ctx, st);
    }
    // Resize buffer if canvas changed
    if (st.buf.width !== w || st.buf.height !== h) {
        st.buf.width = w; st.buf.height = h;
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    const bc = st.bufCtx;
    const cx = w/2 + offX, cy = h/2 + offY;

    // ── Step 1: Feedback — draw previous buffer scaled+rotated into itself
    bc.save();
    bc.globalAlpha = 1 - decay;
    bc.translate(cx, cy);
    bc.rotate(rot);
    bc.scale(sc + mid*0.02, sc + mid*0.02);
    bc.translate(-cx, -cy);
    bc.drawImage(st.buf, 0, 0);
    bc.restore();

    // ── Step 2: Fade to black slightly (prevents full saturation)
    bc.fillStyle = `rgba(0,0,0,${decay * 0.5})`;
    bc.fillRect(0, 0, w, h);

    // ── Step 3: Draw fresh source content into buffer
    const sourceSize = Math.min(w, h) * 0.25 * (1 + bass * pulse * 0.4);
    if (glow > 0.05) { bc.shadowBlur = glow * 20 * (1 + bass * pulse * 0.3); bc.shadowColor = `hsl(${hue},100%,65%)`; }

    if (srcMode === 0) {
        // Lissajous curve
        const a = 3, b = 2;
        bc.strokeStyle = `hsl(${(hue + t * 30) % 360},90%,${55+treble*25}%)`;
        bc.lineWidth = 1.5 + bass * pulse * 2;
        bc.beginPath();
        const steps = 200;
        for (let i = 0; i <= steps; i++) {
            const ang = (i / steps) * TAU;
            const lx = cx + Math.sin(a * ang + t * 0.7) * sourceSize;
            const ly = cy + Math.sin(b * ang) * sourceSize * 0.7;
            i === 0 ? bc.moveTo(lx, ly) : bc.lineTo(lx, ly);
        }
        bc.stroke();
    } else if (srcMode === 1) {
        // Expanding spiral
        bc.strokeStyle = `hsl(${(hue2 + t * 20) % 360},80%,${50+treble*30}%)`;
        bc.lineWidth = 1.5;
        bc.beginPath();
        const turns = 4 + mid * 2;
        const steps = 300;
        for (let i = 0; i <= steps; i++) {
            const ang = (i / steps) * TAU * turns + t * 0.5;
            const r2  = (i / steps) * sourceSize;
            const lx  = cx + Math.cos(ang) * r2;
            const ly  = cy + Math.sin(ang) * r2;
            i === 0 ? bc.moveTo(lx, ly) : bc.lineTo(lx, ly);
        }
        bc.stroke();
    } else {
        // Noise ring
        bc.strokeStyle = `hsl(${(hue + treble * 120) % 360},85%,${55+bass*30}%)`;
        bc.lineWidth = 2;
        bc.beginPath();
        const pts = 80;
        for (let i = 0; i <= pts; i++) {
            const ang = (i / pts) * TAU;
            const nr  = sourceSize * (0.6 + 0.4 * Math.sin(ang * 6 + t * 2) * Math.cos(ang * 4 - t * 1.3));
            const lx  = cx + Math.cos(ang) * nr;
            const ly  = cy + Math.sin(ang) * nr;
            i === 0 ? bc.moveTo(lx, ly) : bc.lineTo(lx, ly);
        }
        bc.closePath(); bc.stroke();
    }
    bc.shadowBlur = 0;

    // ── Audio reactive centre dot
    const dotR = 3 + bass * pulse * 12 + treble * 4;
    bc.fillStyle = `hsl(${(hue + hue2) / 2},100%,${70 + treble * 20}%)`;
    bc.beginPath(); bc.arc(cx, cy, dotR, 0, TAU); bc.fill();

    // ── Step 4: Blit buffer to main canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(st.buf, 0, 0);

    // ── Beat flash
    if (bass > 0.6) {
        ctx.fillStyle = `hsla(${hue},80%,60%,${(bass - 0.6) * pulse * 0.25})`;
        ctx.fillRect(0, 0, w, h);
    }
}
