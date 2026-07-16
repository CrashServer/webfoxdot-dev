// draw.js — turn the composited value+colour grid into pixels. Two paths:
//   • block/dark → a low-res ImageData blitted up (fast, smooth "video" look)
//   • glyph ramps (ascii/shade/blocks/dots/bars) → characters, coloured per cell
// This is the only backend-specific module besides the grid — swapping in WebGL later
// means replacing just this + the grid.

import { RENDER_MODES } from '../vdata.js';

let _off = null, _offCtx = null, _img = null, _imgN = 0;

function ensureImg(cols, rows) {
    const n = cols * rows;
    if (!_off) { _off = document.createElement('canvas'); _offCtx = _off.getContext('2d'); }
    if (_off.width !== cols || _off.height !== rows) { _off.width = cols; _off.height = rows; _img = _offCtx.createImageData(cols, rows); _imgN = n; }
    else if (_imgN !== n || !_img) { _img = _offCtx.createImageData(cols, rows); _imgN = n; }
    return _img;
}

export function draw(ctx, grid, modeName) {
    const { cols, rows, val, r, gch, b, W, H } = grid;
    const ramp = RENDER_MODES[modeName];             // a glyph ramp, or undefined → pixel mode

    if (!ramp) {                                      // ── pixel mode via ImageData ──
        const crisp = modeName === 'pixel' || modeName === 'dark';   // else smooth (interpolated)
        const img = ensureImg(cols, rows); const d = img.data;
        for (let k = 0; k < cols * rows; k++) {
            const v = val[k]; const p = k * 4;
            d[p] = r[k]; d[p + 1] = gch[k]; d[p + 2] = b[k]; d[p + 3] = v < 0.02 ? 0 : 255;
        }
        _offCtx.putImageData(img, 0, 0);
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = !crisp;
        ctx.drawImage(_off, 0, 0, cols, rows, 0, 0, W, H);
        ctx.imageSmoothingEnabled = prev;
        return;
    }

    // ── glyph ramp ──
    const cw = W / cols, ch = H / rows, L = ramp.length;
    ctx.font = `${Math.max(6, (ch * 0.95) | 0)}px monospace`;
    ctx.textBaseline = 'top';
    for (let j = 0; j < rows; j++) {
        const y = j * ch, row = j * cols;
        for (let i = 0; i < cols; i++) {
            const idx = row + i; const v = val[idx];
            if (v < 0.05) continue;
            const chr = ramp[Math.min(L - 1, (v * L) | 0)];
            if (chr === ' ') continue;
            ctx.fillStyle = `rgb(${r[idx]},${gch[idx]},${b[idx]})`;
            ctx.fillText(chr, i * cw, y);
        }
    }
}
