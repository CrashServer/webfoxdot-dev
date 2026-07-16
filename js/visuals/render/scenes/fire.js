// fire — flames licking up from the bottom; the bass feeds the blaze.
export default {
    name: 'fire',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const y = v - t * s * 0.5;                 // scroll the turbulence upward
        let n = 0, amp = 0.5, f = 6 * sc;
        for (let i = 0; i < 3; i++) { n += amp * Math.sin(u * f + i) * Math.cos(y * f * 1.3 - t * s * 2 + i); f *= 2; amp *= 0.5; }
        n = n * 0.6 + 0.5;
        const heat = Math.pow(v, 1.4);             // hottest at the base (v → 1)
        return Math.max(0, n * heat * (1.1 + (a ? a.bass * 0.6 : 0)) - (1 - v) * 0.25);
    },
};
