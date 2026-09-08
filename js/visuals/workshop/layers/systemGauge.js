// ── System Gauge ─────────────────────────────────────────────────────────────
// Ported from web/src/layers/systemGauge.js (WGSL → Canvas2D). A beat-pulsing
// reactor orb ringed by a CPU-load gauge (green→red, flickers when it
// redlines), with BPM + CPU readouts. Plays with the FoxDot cpu/bpm/beat feed
// (extra.live). When no live cpu is reported, audio volume drives the gauge.

const _st = new WeakMap();

export const systemGaugeParams = () => ({
    posX:    { base: 0,   min: -0.5, max: 0.5, label: "pos X", mod: { source: "" } },
    posY:    { base: 0,   min: -0.5, max: 0.5, label: "pos Y", mod: { source: "" } },
    scale:   { base: 0.6, min: 0.2,  max: 1,   label: "scale", mod: { source: "" } },
    showText:{ base: 1,   min: 0, max: 1, step: 1, label: "show text (0/1)", mod: { source: "" } },
    cpuBar:  { base: 1,   min: 0, max: 1, step: 1, label: "CPU label prefix (0/1)", mod: { source: "" } },
});

export function drawSystemGauge(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { flick: 0 }; _st.set(ctx, s); }
    const lv = extra?.live || {};
    const spectrum = extra?.spectrum;
    const bass = spectrum ? Math.min(1, (spectrum[1] + spectrum[2] + spectrum[3]) / 3 * 3) : 0;
    const mid = spectrum ? Math.min(1, (spectrum[8] + spectrum[12] + spectrum[16]) / 3 * 3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28] + spectrum[38] + spectrum[48]) / 3 * 3) : 0;
    const vol = (bass + mid + treble) / 3;

    const cpu = Math.max(0, Math.min(100, lv.cpu != null ? lv.cpu : vol * 100));
    const bpm = lv.bpm ?? 120;
    const pulse = Math.max(0, Math.min(1, lv.pulse ?? 0));
    const beat = ((Math.floor(lv.beat ?? 0) % 4) + 4) % 4 + 1;

    const cx = w * (0.5 + params.posX), cy = h * (0.5 - params.posY);
    const R = Math.min(w, h) * 0.5 * (params.scale ?? 0.6);
    const cpuF = cpu / 100;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);

    // ── gauge ring: 270° sweep from 135° to 405° ───────────────────────────
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ringR = R * 0.82, ringW = R * 0.14;
    // track
    ctx.lineCap = "round";
    ctx.lineWidth = ringW;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.arc(0, 0, ringR, a0, a1); ctx.stroke();
    // tick marks
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = Math.max(1, R * 0.01);
    for (let i = 0; i <= 10; i++) {
        const a = a0 + (a1 - a0) * i / 10;
        const c = Math.cos(a), sn = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(c * (ringR + ringW * 0.6), sn * (ringR + ringW * 0.6));
        ctx.lineTo(c * (ringR + ringW * 0.9), sn * (ringR + ringW * 0.9));
        ctx.stroke();
    }
    // filled load arc, green→red
    const redline = cpuF > 0.85;
    if (redline) s.flick = 1; else s.flick = Math.max(0, s.flick - 0.15);
    const flicker = redline ? 0.6 + 0.4 * (Math.sin(t * 40) * 0.5 + 0.5) : 1;
    const hue = 120 * (1 - cpuF);   // 120 green → 0 red
    ctx.strokeStyle = `hsla(${hue},85%,${50 + s.flick * 15}%,${flicker})`;
    ctx.lineWidth = ringW;
    ctx.beginPath(); ctx.arc(0, 0, ringR, a0, a0 + (a1 - a0) * cpuF); ctx.stroke();

    // ── reactor orb ────────────────────────────────────────────────────────
    const orbR = R * 0.55 * (1 + pulse * 0.14);
    const grad = ctx.createRadialGradient(0, -orbR * 0.2, orbR * 0.1, 0, 0, orbR);
    const glow = 0.4 + pulse * 0.6;
    grad.addColorStop(0, `rgba(180,230,255,${0.5 + glow * 0.4})`);
    grad.addColorStop(0.5, `rgba(60,150,230,${0.4 + glow * 0.3})`);
    grad.addColorStop(1, "rgba(20,40,90,0.05)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, orbR, 0, Math.PI * 2); ctx.fill();
    // core
    ctx.fillStyle = `rgba(230,245,255,${0.6 + pulse * 0.4})`;
    ctx.beginPath(); ctx.arc(0, 0, orbR * 0.28 * (1 + pulse * 0.3), 0, Math.PI * 2); ctx.fill();
    // orb outline
    ctx.strokeStyle = "rgba(140,200,255,0.5)"; ctx.lineWidth = Math.max(1, R * 0.015);
    ctx.beginPath(); ctx.arc(0, 0, orbR, 0, Math.PI * 2); ctx.stroke();

    // ── text ─────────────────────────────────────────────────────────────
    if (params.showText | 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const fs = Math.max(9, R * 0.16) | 0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.fillStyle = "rgba(200,230,255,0.9)";
        ctx.fillText(`${bpm.toFixed(0)} BPM ${beat}/4`, 0, -ringR - ringW * 1.6);
        ctx.fillStyle = redline ? `hsla(0,90%,${55 + s.flick * 20}%,${flicker})` : "rgba(200,255,210,0.9)";
        const cpuTxt = (params.cpuBar | 0) ? `CPU ${cpu.toFixed(0)}%` : `${cpu.toFixed(0)}%`;
        ctx.fillText(cpuTxt, 0, ringR + ringW * 1.6);
    }
    ctx.restore();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
