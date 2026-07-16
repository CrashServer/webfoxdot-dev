// swarm — a flock of glowing agents tracing looping orbits (density field of gaussians).
export default {
    name: 'swarm',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), n = Math.max(3, Math.round((p.scale ?? 1) * 6));
        let sum = 0;
        for (let i = 0; i < n; i++) {
            const ph = i * 2.399;                                  // golden-angle spread
            const px = 0.5 + Math.sin(t * s * 0.6 + ph) * 0.4 * Math.cos(ph * 3);
            const py = 0.5 + Math.cos(t * s * 0.5 + ph * 1.3) * 0.4 * Math.sin(ph * 2);
            const d2 = (u - px) * (u - px) + (v - py) * (v - py);
            sum += Math.exp(-d2 * 140);
        }
        return Math.min(1, sum);
    },
};
