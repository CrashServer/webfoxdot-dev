// mosaic — the TEMPLATE video synth. A fully-parametric, DETERMINISTIC grid of colour
// cells that light up on the pattern you choose. Nothing is random beyond your control:
// the per-cell layout is a seedable hash (not Math.random), so identical params always
// give an identical picture. Cheap: no loops, a few compares + one mode branch per cell.
//   cells = columns · rows = rows (0 → square) · fill = fraction lit (0..1) · shift = slide
//   mode  = 0 scatter · 1 columns · 2 rows · 3 checker · 4 radial · 5 diagonal
//   seed  = deterministic layout offset · gap = cell inset (0..0.5) · react = audio pulse
// Colour per cell comes from the palette (hue()/pal() recolour the whole grid).
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const frac = (x) => x - Math.floor(x);

export default {
    name: 'mosaic',
    field(u, v, t, p, a) {
        const sp = p.speed ?? 1, sc = p.scale ?? 1;
        const nx = Math.max(1, Math.min(96, Math.round((p.cells ?? 8) * sc)));
        const ny = (p.rows ?? 0) < 1 ? nx : Math.max(1, Math.min(96, Math.round(p.rows * sc)));
        const cx = Math.floor(u * nx), cy = Math.floor(v * ny);
        const fx = u * nx - cx, fy = v * ny - cy;
        const r = hash(cx + (p.seed ?? 0) * 7.3 + 1.7, cy + (p.seed ?? 0) * 7.3 + 1.7);
        const fill = Math.max(0, Math.min(1, p.fill ?? 0.5));
        const drift = (p.shift ?? 0) + t * sp * 0.08;
        const mode = Math.round(p.mode ?? 0);
        let key;
        if      (mode === 1) key = frac(cx / nx + drift);
        else if (mode === 2) key = frac(cy / ny + drift);
        else if (mode === 3) key = (((cx + cy + Math.floor(drift * 2)) % 2) + 2) % 2 < 1 ? 0 : 1;
        else if (mode === 4) key = frac(Math.hypot((cx + 0.5) / nx - 0.5, (cy + 0.5) / ny - 0.5) * 2 - drift);
        else if (mode === 5) key = frac((cx + cy) / (nx + ny) + drift);
        else                 key = frac(r + drift);
        const on  = key <= fill ? 1 : 0;
        const g   = Math.max(0, Math.min(0.49, p.gap ?? 0.08));
        const ins = (fx > g && fx < 1 - g && fy > g && fy < 1 - g) ? 1 : 0;
        const au  = (a ? (a.level || 0) : 0) * Math.max(0, Math.min(1, p.react ?? 0.6));
        return on * ins * (0.15 + 0.8 * r) * (0.6 + 0.4 * au);
    },
};
