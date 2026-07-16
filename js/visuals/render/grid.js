// grid.js — the sampling grid. The ONLY module that knows about pixels: it maps the
// canvas to a cols×rows lattice of cells, and holds the per-cell buffers the
// compositor fills (value + colour). Everything upstream works in normalised u,v.

export function makeGrid(cellPx = 10) {
    const g = {
        cellPx,                       // target cell size in px (glyph/block granularity)
        cols: 0, rows: 0, W: 0, H: 0, // set by resize()
        val: null,                    // Float32Array(cols*rows) — mixed field 0..1 (drives glyphs)
        r: null, gch: null, b: null,  // Uint8ClampedArray(cols*rows) — mixed colour (drives paint)
    };
    return g;
}

// Fit the grid to the canvas. Keeps cells ~square and near cellPx; reallocates buffers
// only when the count actually changes (resize is rare, alloc is not on the hot path).
export function resizeGrid(g, W, H) {
    g.W = W; g.H = H;
    const cols = Math.max(2, Math.round(W / g.cellPx));
    const rows = Math.max(2, Math.round(H / g.cellPx));
    if (cols === g.cols && rows === g.rows && g.val) return g;
    g.cols = cols; g.rows = rows;
    const n = cols * rows;
    g.val = new Float32Array(n);
    g.r = new Uint8ClampedArray(n);
    g.gch = new Uint8ClampedArray(n);
    g.b = new Uint8ClampedArray(n);
    return g;
}

// Pixel geometry for cell (i,j) — used by the draw modes. Cells tile the canvas edge
// to edge (no gaps) so block mode looks continuous.
export function cellRect(g, i, j) {
    const cw = g.W / g.cols, ch = g.H / g.rows;
    return { x: i * cw, y: j * ch, w: Math.ceil(cw) + 1, h: Math.ceil(ch) + 1 };
}
