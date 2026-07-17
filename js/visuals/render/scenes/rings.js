// rings — thin bright rings racing inward; the bass fires a shock ring.
export default {
    name: 'rings',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
        let ph = r * sc * (p.count ?? 10) - t * s * 1.5 - (a ? a.bass * 2 : 0);
        ph = ph - Math.floor(ph);                          // 0..1
        return ph < 0.16 ? 1 - ph / 0.16 * 0.5 : 0;
    },
};
