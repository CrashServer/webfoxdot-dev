// cells — a drifting Voronoi field: bright at the seed points, dark at the edges.
export default {
    name: 'cells',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), n = Math.max(2, Math.round(4 * (p.scale ?? 1)));
        let best = 9;
        for (let gy = 0; gy < n; gy++) {
            for (let gx = 0; gx < n; gx++) {
                const px = (gx + 0.5) / n + Math.sin(t * s + gx * 2.1) * 0.11;
                const py = (gy + 0.5) / n + Math.cos(t * s + gy * 3.3) * 0.11;
                const d = Math.hypot(u - px, v - py);
                if (d < best) best = d;
            }
        }
        return Math.max(0, 1 - best * n * 0.9);
    },
};
