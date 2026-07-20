// mosaic — a cheap grid of colour cells that light up on the pattern you choose.
//   cells = grid resolution (how many across)    fill  = fraction of cells lit (0..1)
//   shift = slides which cells are lit — animate it with var/linvar/a pattern
//   react = audio pulse amount (0..1)
// Colour per cell comes from the palette (each cell a different hue); hue()/pal() tint it.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

export default {
    name: 'mosaic',
    field(u, v, t, p, a) {
        const sp = p.speed ?? 1, sc = p.scale ?? 1;
        const n  = Math.max(1, Math.min(64, Math.round((p.cells ?? 8) * sc)));
        const cx = Math.floor(u * n), cy = Math.floor(v * n);
        const fx = u * n - cx, fy = v * n - cy;
        const r  = hash(cx + 0.5, cy + 0.5);                       // stable per-cell 0..1
        const fill = Math.max(0, Math.min(1, p.fill ?? 0.5));
        let phase = (r + (p.shift ?? 0) + t * sp * 0.08) % 1; if (phase < 0) phase += 1;
        const on  = phase <= fill ? 1 : 0;                         // cell on/off
        const g   = 0.08;                                          // gap between cells
        const ins = (fx > g && fx < 1 - g && fy > g && fy < 1 - g) ? 1 : 0;
        const au  = (a ? (a.level || 0) : 0) * Math.max(0, Math.min(1, p.react ?? 0.6));
        return on * ins * (0.15 + 0.8 * r) * (0.6 + 0.4 * au);
    },
};
