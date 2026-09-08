// ── Ransom Eval ──────────────────────────────────────────────────────────────
// Ported from web/src/layers/ransomEval.js (WGSL → Canvas2D). When a performer
// evaluates code, the eval'd line slams onto the canvas as ransom-note
// lettering (per-character colour boxes, jittered), popping in and fading out.
// The line is latched at eval time (extra.live.evalCount) so it stays put.

import { wrapCode } from "./_livecodeParse.js";

const MR = 4, MC = 24;
const _st = new WeakMap();

export const ransomEvalParams = () => ({
    posX:     { base: 0,    min: -0.5, max: 0.5,  label: "pos X", mod: { source: "" } },
    posY:     { base: 0,    min: -0.5, max: 0.5,  label: "pos Y", mod: { source: "" } },
    size:     { base: 0.09, min: 0.04, max: 0.18, label: "letter size", mod: { source: "" } },
    upper:    { base: 1,    min: 0, max: 1, step: 1, label: "uppercase (0/1)", mod: { source: "" } },
    showDemo: { base: 1,    min: 0, max: 1, step: 1, label: "demo when idle (0/1)", mod: { source: "" } },
});

const _linesStr = (w) => {
    const l = w && w.lines;
    return l ? (Array.isArray(l) ? l.join("\n") : String(l)) : "";
};

// deterministic per-cell jitter from a seed + row/col
function rand2(seed, r, c) {
    let h = (seed * 374761393 + r * 668265263 + c * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h >>> 8) / 16777216;
}

const RANSOM_HUES = [8, 45, 200, 320, 120, 0, 270];

export function drawRansomEval(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { shownLine: "", shownAt: -1, lastEval: -1, seed: 1 }; _st.set(ctx, s); }
    const lv = extra?.live || {};

    const ec = lv.evalCount ?? 0;
    if (ec !== s.lastEval) {
        s.lastEval = ec;
        const who = lv.lastEvalUser;
        const win = who === "svdk" ? lv.svdk : lv.zbdm;
        let line = "";
        const str = _linesStr(win);
        if (str) {
            const rows = str.split("\n"); const r = (win && win.cursorRow) ?? 0;
            line = (rows[r] && rows[r].trim()) ? rows[r] : (rows.find((x) => x.trim()) || "");
        }
        if (!line && (params.showDemo | 0)) line = "d1 >> play('x-o-')";
        if (line) { s.shownLine = line.replace(/\t/g, " ").trim(); s.shownAt = t; s.seed = (s.seed * 1664525 + 1013904223) % 100000; }
    }
    if (s.shownAt < 0 && (params.showDemo | 0)) { s.shownLine = "d1 >> play('x-o-')"; s.shownAt = t - (t % 3); }

    ctx.clearRect(0, 0, w, h);
    const age = s.shownAt >= 0 ? t - s.shownAt : 999;
    if (!(age >= 0 && age < 1.6 && s.shownLine)) { return; }

    const cell = Math.max(6, (params.size ?? 0.09) * h);
    const maxCols = Math.max(6, Math.min(MC, Math.floor((w * 0.9) / cell)));
    const src = (params.upper | 0) ? s.shownLine.toUpperCase() : s.shownLine;
    const lines = wrapCode(src, maxCols, MR);
    const rows = lines.length;
    if (!rows) return;
    const cols = Math.max(1, ...lines.map((l) => l.length));

    // pop-in over 0..0.35, fade over 1.2..1.6
    const pop = Math.min(1, age / 0.35);
    const fade = age > 1.2 ? Math.max(0, 1 - (age - 1.2) / 0.4) : 1;
    const alpha = pop * fade;

    const cx = w * (0.5 + params.posX), cy = h * (0.5 - params.posY);
    const blockW = cols * cell, blockH = rows * cell;
    const x0 = cx - blockW / 2, y0 = cy - blockH / 2;

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let r = 0; r < rows; r++) {
        const ln = lines[r] || "";
        for (let c = 0; c < ln.length; c++) {
            const ch = ln[c];
            if (ch === " ") continue;
            const jr = rand2(s.seed, r, c);
            const jr2 = rand2(s.seed + 7, r, c);
            const jitterX = (jr - 0.5) * cell * 0.25;
            const jitterY = (jr2 - 0.5) * cell * 0.25;
            const rot = (jr - 0.5) * 0.45;
            const scale = 0.7 + jr2 * 0.35;
            const px = x0 + c * cell + cell / 2 + jitterX;
            const py = y0 + r * cell + cell / 2 + jitterY;
            const hue = RANSOM_HUES[(s.seed + r * 31 + c * 7) % RANSOM_HUES.length];
            const boxS = cell * 0.86 * scale * (0.5 + pop * 0.5);

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(rot);
            // paper box
            ctx.fillStyle = `hsla(${hue},${20 + jr * 40 | 0}%,${80 + jr2 * 15 | 0}%,${alpha})`;
            ctx.fillRect(-boxS / 2, -boxS / 2, boxS, boxS);
            ctx.lineWidth = Math.max(1, cell * 0.05);
            ctx.strokeStyle = `rgba(20,20,25,${alpha * 0.6})`;
            ctx.strokeRect(-boxS / 2, -boxS / 2, boxS, boxS);
            // letter
            ctx.font = `bold ${boxS * 0.7 | 0}px 'Courier New',monospace`;
            ctx.fillStyle = `hsla(${(hue + 180) % 360},70%,20%,${alpha})`;
            ctx.fillText(ch, 0, boxS * 0.03);
            ctx.restore();
        }
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
