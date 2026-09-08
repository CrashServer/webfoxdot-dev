// ── VU Meter ──────────────────────────────────────────────────────────────────
// Classic analog VU meter with ballistic needle or modern LED bar.
// Multi-channel (L/R and sub-bands).  Bass drives the needle deflection.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const vuMeterParams = () => ({
    channels:  { base: 2,    min: 1,  max: 8,   step: 1, mod: { source: "" } },
    style:     { base: 0,    min: 0,  max: 2,   step: 1, mod: { source: "" } }, // 0=needle 1=LED bars 2=both
    hue:       { base: 120,  min: 0,  max: 360,          mod: { source: "" } },
    attack:    { base: 0.08, min: 0.01,max:0.5,          mod: { source: "" } }, // needle attack
    decay:     { base: 0.95, min: 0.5, max: 0.999,       mod: { source: "" } }, // needle decay per frame
    peakHold:  { base: 1,    min: 0,  max: 1,  step: 1,  mod: { source: "" } },
    peakHue:   { base: 0,    min: 0,  max: 360,          mod: { source: "" } }, // peak indicator hue
    glow:      { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:   { base: 0.9,  min: 0,  max: 1,            mod: { source: "" } },
    segments:  { base: 20,   min: 5,  max: 40, step: 1,  mod: { source: "" } }, // LED segments
});

export function drawVuMeter(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;

    const nCh    = Math.round(Math.max(1, Math.min(8, p.channels ?? 2)));
    const style  = Math.round(Math.max(0, Math.min(2, p.style ?? 0)));
    const hue    = p.hue ?? 120;
    const attack = p.attack ?? 0.08;
    const decayF = p.decay ?? 0.95;
    const peakHold = (p.peakHold ?? 1) > 0.5;
    const peakHue  = p.peakHue ?? 0;
    const glow   = p.glow ?? 0.5;
    const bgAlpha= p.bgAlpha ?? 0.9;
    const nSegs  = Math.round(Math.max(5, Math.min(40, p.segments ?? 20)));

    let st = _st.get(ctx);
    if (!st || st.nCh !== nCh) {
        st = {
            nCh,
            levels: new Float32Array(nCh),
            peaks:  new Float32Array(nCh),
            peakT:  new Float32Array(nCh),
        };
        _st.set(ctx, st);
    }

    // Build per-channel level from spectrum bands
    const getLevel = (ch) => {
        if (!spectrum) return 0;
        if (nCh === 1) return Math.min(1, (spectrum[1]+spectrum[5]+spectrum[10])/3*2);
        // Map channels to spectrum bands
        const lo = Math.floor(ch * 64 / nCh);
        const hi = Math.ceil((ch + 1) * 64 / nCh);
        let sum = 0;
        for (let b = lo; b < hi; b++) sum += spectrum[b];
        return Math.min(1, sum / (hi - lo) * 3);
    };

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const chW = w / nCh;
    const pad = chW * 0.08;

    for (let ch = 0; ch < nCh; ch++) {
        const raw = getLevel(ch);
        // Ballistic: fast attack, slow decay
        if (raw > st.levels[ch]) {
            st.levels[ch] += (raw - st.levels[ch]) * attack * 5;
        } else {
            st.levels[ch] *= decayF;
        }
        const lev = st.levels[ch];

        // Peak hold
        if (lev > st.peaks[ch]) { st.peaks[ch] = lev; st.peakT[ch] = t + 1.5; }
        if (t > st.peakT[ch]) st.peaks[ch] *= 0.98;

        const x = ch * chW + pad;
        const bw = chW - pad * 2;
        const cy = h / 2;

        if (style === 0 || style === 2) {
            // Analog needle style
            const arcR = Math.min(bw * 0.9, h * 0.45);
            const pivX = x + bw / 2;
            const pivY = h * 0.85;
            const maxAngle = 0.65; // radians each side
            const needleAngle = -maxAngle + lev * maxAngle * 2;

            // Background arc
            ctx.strokeStyle = `rgba(60,60,60,0.8)`;
            ctx.lineWidth = arcR * 0.15;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(pivX, pivY, arcR, Math.PI - maxAngle - 0.05, Math.PI + 0.05, true);
            // Actually draw from -maxAngle to +maxAngle below pivot
            ctx.beginPath();
            const startA = Math.PI + maxAngle;
            const endA   = Math.PI - maxAngle;
            ctx.arc(pivX, pivY, arcR * 0.75, startA, endA, true);
            ctx.stroke();

            // Green/yellow/red scale
            ['#00ff55','#ffdd00','#ff3300'].forEach((col, si) => {
                ctx.strokeStyle = col;
                ctx.lineWidth = 2;
                ctx.beginPath();
                const sa = Math.PI + maxAngle - si * 2 * maxAngle / 3;
                const ea = sa - 2 * maxAngle / 3;
                ctx.arc(pivX, pivY, arcR * 0.75, sa, ea, true);
                ctx.stroke();
            });

            // Needle
            if (glow > 0.05) {
                ctx.shadowBlur = glow * 8;
                ctx.shadowColor = `hsl(${hue},100%,70%)`;
            }
            ctx.strokeStyle = `hsl(${hue},80%,75%)`;
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(pivX, pivY);
            const nAngle = Math.PI + maxAngle + needleAngle;
            ctx.lineTo(pivX + Math.cos(nAngle) * arcR * 0.78, pivY + Math.sin(nAngle) * arcR * 0.78);
            ctx.stroke();

            // Pivot dot
            ctx.fillStyle = `hsl(${hue},70%,60%)`;
            ctx.beginPath(); ctx.arc(pivX, pivY, 4, 0, TAU); ctx.fill();
            ctx.shadowBlur = 0;
        }

        if (style === 1 || style === 2) {
            // LED bar
            const segH = (h * (style === 2 ? 0.35 : 0.85)) / nSegs;
            const segGap = segH * 0.15;
            const barX = style === 2 ? x + bw * 0.3 : x;
            const barW = style === 2 ? bw * 0.7 : bw;
            const barTop = style === 2 ? h * 0.05 : h * 0.05;

            const lit = Math.floor(lev * nSegs);
            for (let s = 0; s < nSegs; s++) {
                const frac = s / nSegs;
                const sy = barTop + (nSegs - 1 - s) * segH;
                const isLit = s < lit;
                const segHue = frac < 0.6 ? hue : frac < 0.85 ? 60 : 0;
                const alpha = isLit ? 1 : 0.1;
                if (glow > 0.05 && isLit) {
                    ctx.shadowBlur = glow * 6;
                    ctx.shadowColor = `hsl(${segHue},100%,65%)`;
                }
                ctx.fillStyle = `hsla(${segHue},90%,55%,${alpha})`;
                ctx.fillRect(barX, sy, barW, segH - segGap);
            }

            // Peak segment
            if (peakHold && st.peaks[ch] > 0) {
                const ps = Math.min(nSegs - 1, Math.floor(st.peaks[ch] * nSegs));
                const py2 = barTop + (nSegs - 1 - ps) * segH;
                ctx.shadowBlur = glow * 10;
                ctx.shadowColor = `hsl(${peakHue},100%,70%)`;
                ctx.fillStyle = `hsl(${peakHue},100%,70%)`;
                ctx.fillRect(barX, py2, barW, segH - segGap);
            }
            ctx.shadowBlur = 0;
        }

        // Channel label
        ctx.fillStyle = "rgba(150,150,150,0.6)";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(nCh === 2 ? (ch === 0 ? "L" : "R") : `${ch+1}`, x + bw/2, h - 2);
    }
    ctx.textAlign = "left";
}
