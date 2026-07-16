// grid — a breathing lattice of glowing lines.
export default {
    name: 'grid',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = Math.round((p.scale ?? 1) * 10);
        const drift = t * s * 0.05;
        const gx = Math.abs(Math.sin((u + drift) * Math.PI * k));
        const gy = Math.abs(Math.sin((v - drift) * Math.PI * k));
        const line = Math.max(gx, gy);
        return Math.pow(line, 10) * (0.55 + 0.45 * Math.sin(t * s * 1.5));
    },
};
