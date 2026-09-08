// ── Film Leader ───────────────────────────────────────────────────────────────
// Academy countdown leader: a wiping "clock hand" sweeps a full circle once per
// number, a big numeral counts down in the centre, over a crosshair, framing
// circle and registration ticks. The universal pre-roll of every film print.
// Sweep + numeral advance on a fixed period or lock to the beat.
// Reads extra.live (beat). Pure-ish function of t; minimal per-ctx state.

const _st = new WeakMap();

export const filmLeaderParams = () => ({
    startNum:  { base: 8,  min: 2, max: 12, step: 1, label: "start number", mod: { source: "" } },
    period:    { base: 1.0, min: 0.1, max: 4, label: "sec / number", mod: { source: "" } },
    beatSync:  { base: 0,  min: 0, max: 1, step: 1, label: "sync to beat (0/1)", mod: { source: "" } },
    hue:       { base: 40, min: 0, max: 360, label: "tint hue", mod: { source: "" } },
    sweep:     { base: 1,  min: 0, max: 1, step: 1, label: "sweep hand (0/1)", mod: { source: "" } },
    marks:     { base: 1,  min: 0, max: 1, step: 1, label: "registration marks (0/1)", mod: { source: "" } },
    grain:     { base: 0.15, min: 0, max: 1, label: "film grain", mod: { source: "" } },
});

export function drawFilmLeader(ctx, w, h, p, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { prevBeat: -1, num: p.startNum | 0, phase: 0, lastT: t }; _st.set(ctx, s); }
    const lv = extra?.live || {};

    const start = Math.max(2, p.startNum | 0);
    let phase;   // 0..1 within the current number
    if (p.beatSync | 0) {
        const beat = Math.floor(lv.beat ?? 0);
        if (beat !== s.prevBeat) { s.prevBeat = beat; s.num = s.num <= 1 ? start : s.num - 1; }
        phase = (lv.beat ?? 0) - Math.floor(lv.beat ?? 0);
    } else {
        const period = Math.max(0.05, p.period ?? 1);
        const total = t / period;
        const idx = Math.floor(total) % start;
        s.num = start - idx;
        phase = total - Math.floor(total);
    }

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.46;
    const hue = p.hue ?? 40;

    // Background: dark tinted leader.
    ctx.fillStyle = `hsl(${hue | 0},30%,8%)`;
    ctx.fillRect(0, 0, w, h);

    // Framing circle.
    ctx.strokeStyle = `hsl(${hue | 0},40%,55%)`;
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

    // Sweeping wedge (the "hand"): fills clockwise over the number's phase.
    if (p.sweep | 0) {
        const a0 = -Math.PI / 2;
        const a1 = a0 + phase * 6.2832;
        ctx.fillStyle = `hsla(${hue | 0},50%,60%,0.18)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1);
        ctx.closePath();
        ctx.fill();
        // leading edge line
        ctx.strokeStyle = `hsla(${hue | 0},60%,70%,0.9)`;
        ctx.lineWidth = Math.max(1, R * 0.01);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        ctx.stroke();
    }

    // Crosshair spanning the frame.
    ctx.strokeStyle = `hsla(${hue | 0},40%,60%,0.7)`;
    ctx.lineWidth = Math.max(1, R * 0.008);
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();

    // Registration marks: ticks around the circle + corner brackets.
    if (p.marks | 0) {
        ctx.strokeStyle = `hsla(${hue | 0},40%,65%,0.8)`;
        ctx.lineWidth = Math.max(1, R * 0.01);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * 6.2832;
            const c = Math.cos(a), sn = Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(cx + c * R, cy + sn * R);
            ctx.lineTo(cx + c * R * 0.92, cy + sn * R * 0.92);
            ctx.stroke();
        }
        const m = Math.min(w, h) * 0.05, pad = m;
        ctx.beginPath();
        // corner brackets
        for (const [ox, oy, sx, sy] of [[pad, pad, 1, 1], [w - pad, pad, -1, 1], [pad, h - pad, 1, -1], [w - pad, h - pad, -1, -1]]) {
            ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * m, oy);
            ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + sy * m);
        }
        ctx.stroke();
    }

    // The numeral.
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, R * 0.03);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${(R * 1.1) | 0}px Arial, sans-serif`;
    const label = String(Math.max(1, s.num));
    ctx.strokeText(label, cx, cy + R * 0.02);
    ctx.fillText(label, cx, cy + R * 0.02);

    // Film grain flecks.
    const g = p.grain ?? 0.15;
    if (g > 0) {
        const n = (g * 120) | 0;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < n; i++) {
            ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
    }
}
