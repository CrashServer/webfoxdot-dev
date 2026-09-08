// ── Ikeda Coords ──────────────────────────────────────────────────────────────
// Scrolling columns of floating-point numbers — lat/lon coordinates, spectral
// values, raw decimals. Ikeda "datamatics" / "data.path" aesthetic.
// Bass bursts scroll speed; treble flashes column headers; beat = white pulse.

const _state = new WeakMap();

const FMT = [
    (r) => (r * 180 - 90).toFixed(6) + (r > 0.5 ? "°N" : "°S"),
    (r) => ((r * 360) - 180).toFixed(6) + (r > 0.5 ? "°E" : "°W"),
    (r) => (r * 8848).toFixed(2) + "m",
    (r) => (r * 1e6 | 0).toString().padStart(8, "0"),
    (r) => "0x" + (r * 0xFFFFFF | 0).toString(16).toUpperCase().padStart(6, "0"),
    (r) => (r * 9999.999).toFixed(3),
];

function newCol(fmtIdx) {
    return { y: 0, spd: 0.4 + Math.random() * 0.8, fmt: fmtIdx ?? (Math.random() * FMT.length | 0), pulse: 0 };
}

export const ikedaCoordsParams = () => ({
    cols:   { base: 6,   min: 2,   max: 16,  step: 1, mod: { source: "" } },
    speed:  { base: 1,   min: 0.1, max: 5,   mod: { source: "" } },
    size:   { base: 11,  min: 7,   max: 20,  mod: { source: "" } },
    hue:    { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    mono:   { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    glow:   { base: 0.5, min: 0,   max: 1,   step: 1, mod: { source: "" } },
});

export function drawIkedaCoords(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { cols: [], prevBass: 0, pulse: 0, dt: 0, lastT: 0 }; _state.set(ctx, st); }

    const sp   = extra?.spectrum ?? [];
    const bass = sp.length ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2.8) : 0;
    const treble = sp.length ? Math.min(1, (sp[30] + sp[40]) / 2 * 3) : 0;

    const dt = Math.min(0.05, t - (st.lastT || t));
    st.lastT = t;

    if (bass > 0.55 && bass > st.prevBass + 0.06) st.pulse = 1;
    st.prevBass = bass;
    st.pulse *= 0.88;

    const nCols = Math.max(2, Math.round(p.cols ?? 6));
    while (st.cols.length < nCols) st.cols.push(newCol());
    st.cols.length = nCols;

    const speed  = p.speed ?? 1;
    const fsize  = Math.max(7, p.size ?? 11);
    const mono   = (p.mono ?? 1) > 0.5;
    const hue    = p.hue ?? 0;
    const glow   = (p.glow ?? 0.5) > 0.5;
    const colW   = w / nCols;
    const rowH   = fsize * 1.55;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${fsize}px 'Courier New',monospace`;
    ctx.textBaseline = "top";

    for (let c = 0; c < nCols; c++) {
        const col = st.cols[c];
        const binIdx = Math.floor(c / nCols * (sp.length || 1));
        const amp = sp[binIdx] ?? 0;

        col.y += dt * rowH * speed * (col.spd + bass * 1.5 + st.pulse * 2);
        if (col.y > rowH) { col.y -= rowH; }

        const cx = c * colW;
        const nRows = Math.ceil(h / rowH) + 2;

        for (let r = -1; r < nRows; r++) {
            const py = r * rowH - col.y;
            const seed = (c * 9973 + r * 3571 + (col.y / rowH | 0)) % 1000;
            const rnd  = (seed * 16807 % 2147483647) / 2147483647;
            const val  = col.fmt < FMT.length ? FMT[col.fmt](rnd) : rnd.toFixed(8);

            const isHead = r === 0;
            const bright = isHead ? 1 : Math.max(0, 1 - r / nRows);
            const a = bright * (0.5 + amp * 0.5 + (isHead ? st.pulse * 0.5 : 0));

            if (mono) {
                const v = (Math.min(1, a + st.pulse * 0.3) * 255) | 0;
                ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
            } else {
                const h2 = (hue + r * 5 + t * 10) % 360;
                ctx.fillStyle = `hsla(${h2},70%,${40 + bright * 40}%,${a})`;
            }

            ctx.fillText(val, cx + 4, py);
        }

        // Column header separator
        if (glow && treble > 0.1) {
            ctx.fillStyle = `rgba(255,255,255,${treble * 0.4})`;
            ctx.fillRect(cx, 0, colW - 1, 1);
        }
    }
}
