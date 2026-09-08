// ── Toon EQ ──────────────────────────────────────────────────────────────────
// Ported from web/src/layers/toonEQ.js (WGSL → Canvas2D). Each detected
// instrument gets a chunky horizontal bar whose level follows the audio band
// that instrument type sits in (bass/kick → bass, hats → treble, …), plus a
// beat kick. Labelled, thick outline, optional LED segments + peak-hold.

import { collectInstruments, DEMO_INSTRUMENTS, instrumentColor } from "./_livecodeParse.js";

const MAXB = 10, ML = 8;
const _st = new WeakMap();

export const toonEQParams = () => ({
    width:      { base: 0.7, min: 0.2, max: 0.95, label: "bar width", mod: { source: "" } },
    area:       { base: 0.7, min: 0.3, max: 0.95, label: "stack area", mod: { source: "" } },
    reactivity: { base: 1.5, min: 0,   max: 3,    label: "reactivity", mod: { source: "" } },
    outline:    { base: 0.1, min: 0,   max: 0.3,  label: "outline weight", mod: { source: "" } },
    brightness: { base: 1,   min: 0.3, max: 2,    label: "brightness", mod: { source: "" } },
    labelPlayer:{ base: 0,   min: 0, max: 1, step: 1, label: "label player (0/1)", mod: { source: "" } },
    segments:   { base: 0,   min: 0, max: 24, step: 1, label: "LED segments (0=smooth)", mod: { source: "" } },
    peakHold:   { base: 1,   min: 0, max: 1, step: 1, label: "peak hold (0/1)", mod: { source: "" } },
    peakFall:   { base: 0.6, min: 0.1, max: 3,   label: "peak fall speed", mod: { source: "" } },
    showDemo:   { base: 1,   min: 0, max: 1, step: 1, label: "demo when idle (0/1)", mod: { source: "" } },
});

function bandFor(inst) {
    const s = inst.toLowerCase();
    if (/bass|kick|sub|bd|boom|drum|donk/.test(s)) return 0;
    if (/hat|hh|hi|shak|perc|snare|clap|noise|cym|ride|tick/.test(s)) return 2;
    return 1;
}

const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k * 255) | 0},${Math.min(255, c[1] * k * 255) | 0},${Math.min(255, c[2] * k * 255) | 0})`;

export function drawToonEQ(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { peaks: [], lastT: null }; _st.set(ctx, s); }
    const dt0 = s.lastT == null ? 0.016 : t - s.lastT; s.lastT = t;
    const dt = dt0 < 0 || dt0 > 0.2 ? 0.016 : dt0;

    const lv = extra?.live || {};
    const spectrum = extra?.spectrum;
    const bands = [
        spectrum ? Math.min(1, (spectrum[1] + spectrum[2] + spectrum[3]) / 3 * 3) : 0,
        spectrum ? Math.min(1, (spectrum[8] + spectrum[12] + spectrum[16]) / 3 * 3) : 0,
        spectrum ? Math.min(1, (spectrum[28] + spectrum[38] + spectrum[48]) / 3 * 3) : 0,
    ];
    const pulse = Math.max(0, Math.min(1, lv.pulse ?? 0));

    let items = collectInstruments(lv, MAXB);
    if (!items.length && (params.showDemo | 0)) items = DEMO_INSTRUMENTS.slice(0, 5);
    const n = Math.min(items.length, MAXB);

    ctx.clearRect(0, 0, w, h);
    if (!n) {
        ctx.fillStyle = "rgba(150,150,160,0.35)";
        ctx.font = `${Math.min(w, h) * 0.03 | 0}px 'Courier New',monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("no live code", w / 2, h / 2);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        return;
    }

    const outline = Math.max(1, (params.outline ?? 0.1) * Math.min(w, h) * 0.05);
    const segments = params.segments | 0;
    const marginX = w * (0.5 - (params.width ?? 0.7) * 0.5);
    const barW = w * (params.width ?? 0.7);
    const area = params.area ?? 0.7;
    const gap = h * 0.02;
    const barH = (h * area) / n - gap;
    const y0 = h * (0.5 - area * 0.5) + gap * 0.5;

    for (let i = 0; i < n; i++) {
        const it = items[i];
        const band = bandFor(it.inst);
        const react = Math.max(0, Math.min(1, bands[band] * (params.reactivity ?? 1.5)));
        const level = Math.max(0.04, Math.min(1, react + pulse * 0.25 + (it.flash ?? 0) * 0.5));
        s.peaks[i] = Math.max(level, (s.peaks[i] ?? 0) - dt * (params.peakFall ?? 0.6));
        const col = instrumentColor(it.inst);
        const y = y0 + i * (barH + gap);

        // track
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(marginX, y, barW, barH);

        const fillW = barW * level;
        if (segments > 0) {
            const segW = barW / segments;
            const lit = Math.round(level * segments);
            for (let sIdx = 0; sIdx < segments; sIdx++) {
                if (sIdx >= lit) break;
                const frac = sIdx / segments;
                // green→amber→red gradient across the bar
                const segCol = frac < 0.6 ? col : (frac < 0.85 ? [1, 0.75, 0.15] : [1, 0.2, 0.15]);
                ctx.fillStyle = rgb(segCol, params.brightness ?? 1);
                ctx.fillRect(marginX + sIdx * segW + segW * 0.08, y + barH * 0.1, segW * 0.84, barH * 0.8);
            }
        } else {
            ctx.fillStyle = rgb(col, params.brightness ?? 1);
            ctx.fillRect(marginX, y, fillW, barH);
            // cell-shade
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.fillRect(marginX, y + barH * 0.55, fillW, barH * 0.45);
        }

        // peak marker
        if (params.peakHold | 0) {
            const px = marginX + barW * s.peaks[i];
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillRect(px - outline * 0.4, y, outline * 0.8, barH);
        }

        // outline
        ctx.lineWidth = outline; ctx.strokeStyle = "#0a0a12"; ctx.lineJoin = "round";
        ctx.strokeRect(marginX, y, barW, barH);

        // label
        const label = String((params.labelPlayer | 0) ? it.player : it.inst).toUpperCase().slice(0, ML);
        const fs = Math.max(9, barH * 0.5) | 0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(2, fs * 0.18); ctx.strokeStyle = "#0a0a12";
        ctx.strokeText(label, marginX + fs * 0.4, y + barH / 2);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, marginX + fs * 0.4, y + barH / 2);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
