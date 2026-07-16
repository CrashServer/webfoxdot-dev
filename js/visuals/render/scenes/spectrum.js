// spectrum — a radial equaliser: bass fills the centre, treble the rim, spokes give it
// structure. No audio → a gentle animated fallback.
export default {
    name: 'spectrum',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy) * 2, ang = Math.atan2(dy, dx);
        const lvl = a && (a.bass || a.mid || a.treble)
            ? (r < 0.34 ? a.bass : r < 0.67 ? a.mid : a.treble)
            : (Math.sin(r * 8 + t * s) * 0.4 + 0.5);
        const spokes = Math.abs(Math.sin(ang * 12));
        return (r < lvl * 1.1 ? 1 : 0) * (0.4 + 0.6 * spokes);
    },
};
