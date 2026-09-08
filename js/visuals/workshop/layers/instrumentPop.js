// ── Instrument Pop ───────────────────────────────────────────────────────────
// Ported from web/src/layers/instrumentPop.js (WGSL → Canvas2D). Detects each
// `player >> instrument(…)` in the live code windows and draws a bouncing,
// cell-shaded cartoon bubble labelled with the instrument name. Bubbles bounce
// on the beat (extra.live.pulse) and pop on evaluation. Silhouette varies by
// instrument family: circle · hexagon · diamond · star.

import { collectInstruments, DEMO_INSTRUMENTS, instrumentColor } from "./_livecodeParse.js";

const MAXB = 12;

export const instrumentPopParams = () => ({
    bubbleSize: { base: 0.13, min: 0.05, max: 0.3,  label: "bubble size", mod: { source: "" } },
    ringRadius: { base: 0.55, min: 0,    max: 0.8,  label: "ring radius", mod: { source: "" } },
    outline:    { base: 0.12, min: 0,    max: 0.3,  label: "outline weight", mod: { source: "" } },
    rotate:     { base: 0,    min: 0,    max: 6.28, label: "ring rotation", mod: { source: "" } },
    brightness: { base: 1,    min: 0.3,  max: 2,    label: "brightness", mod: { source: "" } },
    showLabel:  { base: 1,    min: 0,    max: 1, step: 1, label: "show label (0/1)", mod: { source: "" } },
    labelPlayer:{ base: 0,    min: 0,    max: 1, step: 1, label: "label player not inst (0/1)", mod: { source: "" } },
    shapes:     { base: 1,    min: 0,    max: 1, step: 1, label: "vary shapes (0/1)", mod: { source: "" } },
    showDemo:   { base: 1,    min: 0,    max: 1, step: 1, label: "demo when idle (0/1)", mod: { source: "" } },
    demoCount:  { base: 5,    min: 1,    max: 12, step: 1, label: "demo count", mod: { source: "" } },
});

function shapeFor(inst) {
    const s = inst.toLowerCase();
    if (/bass|kick|sub|bd|boom|donk|drum/.test(s)) return 1;
    if (/hat|hh|hi|shak|perc|snare|clap|cym|ride|tick|noise/.test(s)) return 3;
    if (/pluck|arp|stab|blip/.test(s)) return 2;
    return 0;
}

function shapePath(ctx, shape, r, phase) {
    ctx.beginPath();
    if (shape === 0) { ctx.arc(0, 0, r, 0, Math.PI * 2); return; }
    const sides = shape === 1 ? 6 : shape === 2 ? 4 : 10;    // hexagon · diamond · star(10)
    for (let i = 0; i < sides; i++) {
        const a = phase + i / sides * Math.PI * 2;
        let rr = r;
        if (shape === 3) rr = i % 2 === 0 ? r : r * 0.45;     // star spikes
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k * 255) | 0},${Math.min(255, c[1] * k * 255) | 0},${Math.min(255, c[2] * k * 255) | 0})`;

export function drawInstrumentPop(ctx, w, h, params, t, extra) {
    const lv = extra?.live || {};
    const p = params;

    let items = collectInstruments(lv, MAXB);
    if (!items.length && (p.showDemo | 0)) items = DEMO_INSTRUMENTS.slice(0, Math.max(1, p.demoCount | 0));
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

    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.5;
    const pulse = Math.max(0, Math.min(1, lv.pulse ?? 0));
    const ringR = R * (p.ringRadius ?? 0.55);
    const baseR = R * (p.bubbleSize ?? 0.13);
    const outline = Math.max(1, (p.outline ?? 0.12) * Math.min(w, h) * 0.06);
    const bright = p.brightness ?? 1;

    for (let i = 0; i < n; i++) {
        const it = items[i];
        const ang = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2 + (p.rotate ?? 0);
        const bx = n === 1 ? cx : cx + Math.cos(ang) * ringR;
        const by = n === 1 ? cy : cy + Math.sin(ang) * ringR;
        const bounce = 1 + pulse * 0.16 * (0.6 + 0.4 * Math.sin(i * 1.7));
        const pop = Math.max(0, Math.min(1, it.flash ?? 0));
        const rad = baseR * bounce * (1 + pop * 0.35);
        const col = instrumentColor(it.inst);
        const shape = (p.shapes | 0) ? shapeFor(it.inst) : 0;

        ctx.save();
        ctx.translate(bx, by);
        const spin = shape === 3 ? t * 0.4 : shape === 2 ? Math.PI / 4 : 0;

        // fill
        shapePath(ctx, shape, rad, spin);
        ctx.fillStyle = rgb(col, bright);
        ctx.fill();
        // cell-shade band (darker lower half via gradient-ish overlay)
        shapePath(ctx, shape, rad, spin);
        ctx.save(); ctx.clip();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(-rad, rad * 0.15, rad * 2, rad);
        ctx.restore();
        // outline
        shapePath(ctx, shape, rad, spin);
        ctx.lineWidth = outline; ctx.strokeStyle = "#0a0a12"; ctx.lineJoin = "round";
        ctx.stroke();
        // highlight
        ctx.beginPath();
        ctx.arc(-rad * 0.32, -rad * 0.34, rad * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.55 + pop * 0.3})`;
        ctx.fill();
        // eval pop ring
        if (pop > 0.02) {
            ctx.beginPath();
            ctx.arc(0, 0, rad * (1 + pop * 0.4), 0, Math.PI * 2);
            ctx.lineWidth = outline * 0.5;
            ctx.strokeStyle = `rgba(255,255,255,${pop * 0.8})`;
            ctx.stroke();
        }

        // label
        if (p.showLabel | 0) {
            const label = String((p.labelPlayer | 0) ? it.player : it.inst).toUpperCase().slice(0, 8);
            const fs = Math.max(8, rad * 0.5) | 0;
            ctx.font = `bold ${fs}px 'Courier New',monospace`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(2, fs * 0.18); ctx.strokeStyle = "#0a0a12";
            ctx.strokeText(label, 0, 0);
            ctx.fillStyle = "#fff";
            ctx.fillText(label, 0, 0);
        }
        ctx.restore();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
