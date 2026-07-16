// ripple — concentric rings pulsing out of the centre; the bass kicks a shock ring.
export default {
    name: 'ripple',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy);
        const kick = a ? a.bass * 5 : 0;
        const rings = Math.sin(r * sc * 44 - t * s * 3 - kick) * 0.5 + 0.5;
        return rings * (1 - r * 1.2);          // fade toward the edges
    },
};
