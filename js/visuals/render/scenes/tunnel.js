// tunnel — a receding radial tunnel: rings rush inward, sectors spin.
export default {
    name: 'tunnel',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy) + 1e-4, ang = Math.atan2(dy, dx);
        const depth = Math.sin(1 / r * (1.5 * sc) - t * s * 2) * 0.5 + 0.5;
        const sectors = Math.sin(ang * 6 + t * s) * 0.5 + 0.5;
        return depth * 0.7 + sectors * 0.3 * (a ? 0.5 + a.bass : 1);
    },
};
