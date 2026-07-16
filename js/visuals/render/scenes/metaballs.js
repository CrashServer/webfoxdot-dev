// metaballs — smooth blobs that merge and split as their centres orbit.
export default {
    name: 'metaballs',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), k = Math.max(2, Math.round((p.scale ?? 1) * 3));
        let sum = 0;
        for (let i = 0; i < k; i++) {
            const px = 0.5 + Math.sin(t * s * 0.7 + i * 2.1) * 0.35;
            const py = 0.5 + Math.cos(t * s * 0.5 + i * 1.7) * 0.35;
            const d = (u - px) * (u - px) + (v - py) * (v - py);
            sum += 0.02 / (d + 0.002);
        }
        return Math.min(1, sum * (0.7 + (a ? a.bass * 0.5 : 0.2)));
    },
};
