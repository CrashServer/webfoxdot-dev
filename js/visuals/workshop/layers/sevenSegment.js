// ── Seven Segment Display ─────────────────────────────────────────────────────
// Large LCD/LED seven-segment display showing clock, BPM counter, or beat count.
// Bass pulses the brightness; treble shifts the colour.

const _st = new WeakMap();

// Segments: a(top) b(tr) c(br) d(bot) e(bl) f(tl) g(mid)
// Each char: which of [a,b,c,d,e,f,g] are ON
const SEG_MAP = {
    '0':[1,1,1,1,1,1,0], '1':[0,1,1,0,0,0,0], '2':[1,1,0,1,1,0,1],
    '3':[1,1,1,1,0,0,1], '4':[0,1,1,0,0,1,1], '5':[1,0,1,1,0,1,1],
    '6':[1,0,1,1,1,1,1], '7':[1,1,1,0,0,0,0], '8':[1,1,1,1,1,1,1],
    '9':[1,1,1,1,0,1,1], ' ':[0,0,0,0,0,0,0], '-':[0,0,0,0,0,0,1],
    ':':[0,0,0,0,0,0,0], // colon drawn separately
    'A':[1,1,1,0,1,1,1], 'B':[0,0,1,1,1,1,1], 'C':[1,0,0,1,1,1,0],
    'E':[1,0,0,1,1,1,1], 'F':[1,0,0,0,1,1,1], 'H':[0,1,1,0,1,1,1],
    'L':[0,0,0,1,1,1,0], 'P':[1,1,0,0,1,1,1], 'U':[0,1,1,1,1,1,0],
};

function drawDigit(ctx, x, y, dw, dh, char, onC, offC, thick) {
    const segs = SEG_MAP[char?.toUpperCase()] ?? [0,0,0,0,0,0,0];
    const p = thick;
    const hw = dw * 0.42, hh = dh * 0.46;
    const cx = x + dw / 2, cy = y + dh / 2;

    const SEGS = [
        // a top horizontal
        [[cx - hw + p, cy - hh],     [cx + hw - p, cy - hh],     [cx + hw - p*1.5, cy - hh + p], [cx - hw + p*1.5, cy - hh + p]],
        // b top-right vertical
        [[cx + hw,     cy - hh + p], [cx + hw,     cy - p],       [cx + hw - p, cy - p*1.5],     [cx + hw - p, cy - hh + p*1.5]],
        // c bottom-right vertical
        [[cx + hw,     cy + p],      [cx + hw,     cy + hh - p],  [cx + hw - p, cy + hh - p*1.5],[cx + hw - p, cy + p*1.5]],
        // d bottom horizontal
        [[cx - hw + p, cy + hh],     [cx + hw - p, cy + hh],     [cx + hw - p*1.5, cy + hh - p],[cx - hw + p*1.5, cy + hh - p]],
        // e bottom-left vertical
        [[cx - hw,     cy + p],      [cx - hw,     cy + hh - p],  [cx - hw + p, cy + hh - p*1.5],[cx - hw + p, cy + p*1.5]],
        // f top-left vertical
        [[cx - hw,     cy - hh + p], [cx - hw,     cy - p],       [cx - hw + p, cy - p*1.5],    [cx - hw + p, cy - hh + p*1.5]],
        // g middle horizontal
        [[cx - hw + p, cy],          [cx + hw - p, cy],           [cx + hw - p*1.5, cy + p*0.5],[cx - hw + p*1.5, cy + p*0.5]],
    ];

    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = segs[i] ? onC : offC;
        ctx.beginPath();
        const pts = SEGS[i];
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.closePath();
        ctx.fill();
    }

    // Colon dots
    if (char === ':') {
        ctx.fillStyle = onC;
        ctx.beginPath(); ctx.arc(cx, cy - hh * 0.35, p * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy + hh * 0.35, p * 0.8, 0, Math.PI * 2); ctx.fill();
    }
}

export const sevenSegmentParams = () => ({
    mode:     { base: 0,    min: 0, max: 2,   step: 1, mod: { source: "" } }, // 0=clock, 1=BPM, 2=beat count
    hue:      { base: 120,  min: 0, max: 360,           mod: { source: "" } },
    scale:    { base: 1.0,  min: 0.2, max: 2,           mod: { source: "" } },
    thick:    { base: 0.07, min: 0.02, max: 0.18,       mod: { source: "" } }, // relative to digit height
    pulse:    { base: 0.35, min: 0, max: 1,             mod: { source: "" } },
    glow:     { base: 0.7,  min: 0, max: 1,             mod: { source: "" } },
    dimAlpha: { base: 0.08, min: 0, max: 0.3,           mod: { source: "" } },
    bgAlpha:  { base: 0.9,  min: 0, max: 1,             mod: { source: "" } },
});

export function drawSevenSegment(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const mode    = Math.round(Math.max(0, Math.min(2, p.mode ?? 0)));
    const hue     = ((p.hue ?? 120) + treble * 30) % 360;
    const scale   = p.scale ?? 1.0;
    const glow    = p.glow ?? 0.7;
    const pulse   = p.pulse ?? 0.35;
    const dimA    = p.dimAlpha ?? 0.08;
    const bgAlpha = p.bgAlpha ?? 0.9;

    let st = _st.get(ctx);
    if (!st) { st = { beatCount: 0, prevBass: 0 }; _st.set(ctx, st); }

    // Beat count on bass hit
    const beat = bass > 0.6 && st.prevBass < 0.5;
    if (beat) st.beatCount++;
    st.prevBass = bass;

    // Build display string
    let str;
    if (mode === 0) {
        // Clock: MM:SS
        const secs = Math.floor(t);
        const m = String(Math.floor(secs / 60) % 60).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        str = m + ':' + s;
    } else if (mode === 1) {
        // BPM from beat timing (simplified: count bass hits over 4s)
        const bpm = Math.round(60 + bass * 80);
        str = String(bpm).padStart(3, ' ') + '-';
    } else {
        // Beat count
        str = String(st.beatCount % 10000).padStart(4, '0');
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const bright = 1 + bass * pulse * 0.4;
    const onC  = `hsl(${hue},90%,${Math.min(100, 60 + treble * 25 + bass * pulse * 15)}%)`;
    const offC = `hsla(${hue},40%,25%,${dimA})`;

    const nChars = str.length;
    const dh = Math.min(h * 0.7, (w * 0.85 / nChars) * 1.8) * scale;
    const dw = dh / 1.8;
    const totalW = dw * nChars + dw * 0.1 * (nChars - 1);
    const startX = (w - totalW) / 2;
    const startY = (h - dh) / 2;
    const thick = dh * (p.thick ?? 0.07);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 20 * bright * (1 + treble * 0.3);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    for (let i = 0; i < nChars; i++) {
        drawDigit(ctx, startX + i * (dw * 1.1), startY, dw, dh, str[i], onC, offC, thick);
    }
    ctx.shadowBlur = 0;
}
