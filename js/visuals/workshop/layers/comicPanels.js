// ── Comic Panels ─────────────────────────────────────────────────────────────
// Ported from web/src/layers/comicPanels.js (WGSL → Canvas2D). The canvas
// becomes a comic page: a grid of panels (one per performer/instrument) with
// Ben-Day halftone dots, thick black gutters, and a caption of the current code
// line (from extra.live). Panels flash on their performer's eval.

import { collectInstruments, DEMO_INSTRUMENTS, instrumentColor, wrapCode } from "./_livecodeParse.js";

const MAXP = 4, MR = 3, MC = 28;
const GRID = { 1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 2] };

export const comicPanelsParams = () => ({
    panels:     { base: 4, min: 1, max: 4,  step: 1, label: "panels", mod: { source: "" } },
    dotScale:   { base: 9, min: 4, max: 24,          label: "halftone dot scale", mod: { source: "" } },
    gutter:     { base: 0.25, min: 0, max: 1,        label: "gutter width", mod: { source: "" } },
    brightness: { base: 1, min: 0.3, max: 2,         label: "brightness", mod: { source: "" } },
    upper:      { base: 1, min: 0, max: 1, step: 1,  label: "uppercase caption (0/1)", mod: { source: "" } },
    showDemo:   { base: 1, min: 0, max: 1, step: 1,  label: "demo when idle (0/1)", mod: { source: "" } },
});

const _linesArr = (w) => {
    const l = w && w.lines;
    if (!l) return [];
    return Array.isArray(l) ? l : String(l).split("\n");
};

function captionFor(lv, src, inst, player) {
    const win = src === 0 ? lv.svdk : lv.zbdm;
    const rows = _linesArr(win);
    if (rows.length) {
        const own = rows.find((l) => new RegExp(`^\\s*${player}\\s*>>`).test(l));
        if (own) return own;
        const r = (win && win.cursorRow) ?? 0;
        if (rows[r] && rows[r].trim()) return rows[r];
        for (const ln of rows) if (ln.trim()) return ln;
    }
    return `${player} >> ${inst}`;
}

const rgb255 = (c, k) => [Math.min(255, c[0] * k * 255) | 0, Math.min(255, c[1] * k * 255) | 0, Math.min(255, c[2] * k * 255) | 0];

// Ben-Day halftone: dots sized by an implicit shade, tinted with the panel hue.
function halftone(ctx, x0, y0, pw, ph, col, dotScale, flash) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    // base wash
    ctx.fillStyle = `rgb(${col[0] * 0.35 | 0},${col[1] * 0.35 | 0},${col[2] * 0.35 | 0})`;
    ctx.fillRect(x0, y0, pw, ph);
    const step = Math.max(4, dotScale);
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    for (let y = y0 + step * 0.5; y < y0 + ph; y += step) {
        for (let x = x0 + step * 0.5; x < x0 + pw; x += step) {
            // radial shading — brighter toward centre, pulses on eval
            const dx = (x - (x0 + pw / 2)) / pw, dy = (y - (y0 + ph / 2)) / ph;
            const shade = Math.max(0.12, 1 - Math.sqrt(dx * dx + dy * dy) * 1.3) * (0.7 + flash * 0.5);
            const r = step * 0.5 * Math.min(1, shade);
            if (r < 0.4) continue;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
}

export function drawComicPanels(ctx, w, h, params, t, extra) {
    const lv = extra?.live || {};
    const p = params;

    let items = collectInstruments(lv, MAXP);
    const panels = Math.max(1, Math.min(MAXP, p.panels | 0 || 4));
    if (!items.length && (p.showDemo | 0)) items = DEMO_INSTRUMENTS.slice(0, panels);
    items = items.slice(0, panels);
    const n = Math.max(1, Math.min(items.length || panels, MAXP));

    const gutter = Math.max(2, (p.gutter ?? 0.25) * Math.min(w, h) * 0.03);
    const dotScale = Math.max(4, p.dotScale ?? 9);
    const bright = p.brightness ?? 1;

    // page background (black gutters)
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, w, h);

    const [cols, rows] = GRID[n] || [2, 2];
    const cw = w / cols, ch = h / rows;

    for (let i = 0; i < n; i++) {
        const it = items[i] || { inst: "loop", player: `p${i}`, src: 0, flash: 0 };
        const cxi = i % cols, cyi = Math.floor(i / cols);
        const x0 = cxi * cw + gutter, y0 = cyi * ch + gutter;
        const pw = cw - gutter * 2, ph = ch - gutter * 2;
        const flash = Math.max(0, Math.min(1, it.flash ?? 0));
        const col = rgb255(instrumentColor(it.inst), bright);

        halftone(ctx, x0, y0, pw, ph, col, dotScale, flash);

        // thick panel border
        ctx.lineWidth = Math.max(2, gutter * 0.6);
        ctx.strokeStyle = flash > 0.05 ? `rgba(255,255,255,${0.4 + flash * 0.6})` : "#000";
        ctx.strokeRect(x0, y0, pw, ph);

        // caption box (speech-rectangle at the bottom)
        let cap = captionFor(lv, it.src, it.inst, it.player);
        if (p.upper | 0) cap = cap.toUpperCase();
        const capMaxCols = Math.max(8, Math.min(MC, Math.floor(pw / (ph * 0.11) * 1.6)));
        const capLines = wrapCode(cap, capMaxCols, MR);
        const fs = Math.max(9, ph * 0.075) | 0;
        const lh = fs * 1.25;
        const boxH = lh * capLines.length + fs * 0.7;
        const boxY = y0 + ph - boxH - gutter * 0.5;
        const boxX = x0 + gutter * 0.5, boxW = pw - gutter;
        ctx.fillStyle = "rgba(250,250,240,0.92)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.lineWidth = Math.max(1.5, gutter * 0.3); ctx.strokeStyle = "#000";
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.fillStyle = "#0a0a14"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        for (let r = 0; r < capLines.length; r++) {
            ctx.fillText(capLines[r], boxX + fs * 0.4, boxY + fs * 0.35 + r * lh);
        }
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
