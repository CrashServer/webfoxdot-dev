// interference — concentric moire fringes from several moving sources (adapted from stars).
export default {
    name: 'interference',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0;
        const px = (u - 0.5) * 2, py = (v - 0.5) * 2;
        const freq = 8 * sc, contrast = 1.5, audioReact = 1, ns = 4;
        const tt = t * s;
        let sum = 0;
        for (let i = 0; i < ns; i++) {
            const sx = Math.cos(tt * 0.5 + i * 2.1) * 0.6;
            const sy = Math.sin(tt * 0.4 + i * 1.7) * 0.6;
            sum += Math.sin(Math.hypot(px - sx, py - sy) * freq * (1 + bass * audioReact) - tt * 2);
        }
        let n = 0.5 + 0.5 * sum / ns;
        n = Math.pow(Math.min(1, Math.max(0, n)), contrast);
        return Math.min(1, Math.max(0, n));
    },
};
