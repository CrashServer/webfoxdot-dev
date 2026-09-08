// ── Code Comic ───────────────────────────────────────────────────────────────
// Ported from web/src/layers/codeComic.js (WGSL → Canvas2D). One rounded,
// thick-outlined speech balloon per performer showing the current code line
// (dark ink) with a pointer tail; wobbles / pops on eval. A cartoon take on the
// live-coding feed. Reads extra.live (svdk + zbdm windows).

import { collectInstruments, instrumentColor, parseInstruments, wrapCode } from "./_livecodeParse.js";

const MAXBAL = 2, MR = 6, MC = 30;

export const codeComicParams = () => ({
    textSize: { base: 0.032, min: 0.015, max: 0.06, label: "text size", mod: { source: "" } },
    outline:  { base: 0.12,  min: 0, max: 0.3,  label: "outline weight", mod: { source: "" } },
    tint:     { base: 0.85,  min: 0, max: 1,    label: "fill tint (→white)", mod: { source: "" } },
    upper:    { base: 1,     min: 0, max: 1, step: 1, label: "uppercase (0/1)", mod: { source: "" } },
    offsetX:  { base: 0,     min: -0.4, max: 0.4, label: "offset X", mod: { source: "" } },
    offsetY:  { base: 0,     min: -0.4, max: 0.4, label: "offset Y", mod: { source: "" } },
    showDemo: { base: 1,     min: 0, max: 1, step: 1, label: "demo when idle (0/1)", mod: { source: "" } },
});

const _linesStr = (w) => {
    const l = w && w.lines;
    return l ? (Array.isArray(l) ? l.join("\n") : String(l)) : "";
};

function currentLine(win) {
    const str = _linesStr(win);
    if (!str) return "";
    const rows = str.split("\n");
    const r = (win && win.cursorRow) ?? 0;
    if (r >= 0 && r < rows.length && rows[r].trim()) return rows[r];
    for (const ln of rows) if (ln.trim()) return ln;
    return rows[0] || "";
}

// rounded-rect path
function rr(ctx, x, y, w, h, rad) {
    rad = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

export function drawCodeComic(ctx, w, h, params, t, extra) {
    const lv = extra?.live || {};
    const outline = Math.max(1, (params.outline ?? 0.12) * Math.min(w, h) * 0.05);
    const fontPx = Math.max(6, (params.textSize ?? 0.032) * h);
    const pad = fontPx * 0.5;
    const tintK = params.tint ?? 0.85;

    const demo = [
        { win: { lines: "d1 >> play('x-o-')", cursorRow: 0, evalFlashAge: -1 }, cfg: 0 },
        { win: { lines: "p1 >> pads([0,2,4])", cursorRow: 0, evalFlashAge: -1 }, cfg: 1 },
    ];
    const perfs = [
        { win: lv.svdk, cfg: 0 }, { win: lv.zbdm, cfg: 1 },
    ].filter((x) => _linesStr(x.win));
    const list = perfs.length ? perfs : ((params.showDemo | 0) ? demo : []);

    ctx.clearRect(0, 0, w, h);
    if (!list.length) return;

    let bi = 0;
    for (const item of list) {
        if (bi >= MAXBAL) break;
        let line = currentLine(item.win);
        if (params.upper | 0) line = line.toUpperCase();
        if (!line.trim()) continue;
        const maxCols = Math.max(8, Math.min(MC, Math.floor((w * 0.82 - 2 * pad) / (fontPx * 0.62))));
        const lines = wrapCode(line, maxCols, MR);
        if (!lines.length) continue;
        const cols = Math.max(1, ...lines.map((l) => l.length));
        const rows = lines.length;

        const inst = parseInstruments(_linesStr(item.win))[0]?.inst;
        const tint = inst ? instrumentColor(inst) : (item.cfg === 0 ? [0.3, 1, 0.5] : [0.4, 0.7, 1]);
        const fill = [
            1 - (1 - tint[0]) * tintK, 1 - (1 - tint[1]) * tintK, 1 - (1 - tint[2]) * tintK,
        ];

        const cw = fontPx * 0.62;
        const boxW = cols * cw + 2 * pad, boxH = rows * fontPx * 1.15 + 2 * pad;
        const evalAge = (item.win && item.win.evalFlashAge >= 0) ? item.win.evalFlashAge : 999;
        const pop = Math.max(0, evalAge < 0.5 ? 1 - evalAge / 0.5 : 0);
        const wob = 1 + pop * 0.12 + 0.02 * Math.sin(t * 3 + bi);

        const cx = w * (0.5 + params.offsetX);
        const cy = h * (item.cfg === 0 ? 0.30 : 0.62) + h * params.offsetY;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(wob, wob);
        ctx.rotate(0.02 * Math.sin(t * 2 + bi * 2));

        const x0 = -boxW / 2, y0 = -boxH / 2;
        // tail (points down-outward)
        const tipDir = item.cfg === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(tipDir * boxW * 0.12, boxH / 2 - 2);
        ctx.lineTo(tipDir * boxW * 0.30, boxH / 2 + boxH * 0.22);
        ctx.lineTo(tipDir * boxW * 0.30, boxH / 2 - 2);
        ctx.closePath();
        ctx.fillStyle = `rgb(${fill[0] * 255 | 0},${fill[1] * 255 | 0},${fill[2] * 255 | 0})`;
        ctx.fill();
        ctx.lineWidth = outline; ctx.strokeStyle = "#0a0a12"; ctx.lineJoin = "round"; ctx.stroke();

        // balloon
        rr(ctx, x0, y0, boxW, boxH, pad * 1.4);
        ctx.fillStyle = `rgb(${fill[0] * 255 | 0},${fill[1] * 255 | 0},${fill[2] * 255 | 0})`;
        ctx.fill();
        if (pop > 0.02) {
            ctx.save(); ctx.clip();
            ctx.fillStyle = `rgba(255,255,255,${pop * 0.4})`;
            ctx.fillRect(x0, y0, boxW, boxH);
            ctx.restore();
        }
        rr(ctx, x0, y0, boxW, boxH, pad * 1.4);
        ctx.lineWidth = outline; ctx.strokeStyle = "#0a0a12"; ctx.stroke();

        // text (dark ink)
        ctx.font = `bold ${fontPx | 0}px 'Courier New',monospace`;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillStyle = "#0a0a14";
        for (let r = 0; r < rows; r++) {
            ctx.fillText(lines[r], x0 + pad, y0 + pad + r * fontPx * 1.15);
        }
        ctx.restore();
        bi++;
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
