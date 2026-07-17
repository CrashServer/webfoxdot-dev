// moire — two rotating line gratings interfering into shifting fringes.
export default {
    name: 'moire',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1) * (p.lines ?? 40);
        const a1 = t * s * 0.2, a2 = -t * s * 0.13;
        const g1 = Math.sin((u * Math.cos(a1) + v * Math.sin(a1)) * k);
        const g2 = Math.sin((u * Math.cos(a2) + v * Math.sin(a2)) * k * 1.05);
        return g1 * g2 * 0.5 + 0.5;
    },
};
