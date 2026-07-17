// voronoi — the borders between drifting cells glow (edge-highlighted, the inverse of
// the `cells` scene which lights the centres).
export default {
    name: 'voronoi',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), n = Math.max(2, Math.round((p.scale ?? 1) * (p.cells ?? 4)));
        let d1 = 9, d2 = 9;
        for (let gy = 0; gy < n; gy++) {
            for (let gx = 0; gx < n; gx++) {
                const px = (gx + 0.5) / n + Math.sin(t * s + gx * 2.1) * 0.11;
                const py = (gy + 0.5) / n + Math.cos(t * s + gy * 3.3) * 0.11;
                const d = Math.hypot(u - px, v - py);
                if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
            }
        }
        return Math.max(0, 1 - (d2 - d1) * n * 2.5);   // bright where two cells meet
    },
};
