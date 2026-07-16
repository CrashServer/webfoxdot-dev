// marble — turbulence-veined marble: an fbm field perturbs a sine grain into swirls.
export default {
    name: 'marble',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        let turb = 0, amp = 0.5, f = 4 * sc;
        for (let i = 0; i < 4; i++) { turb += amp * Math.abs(Math.sin(u * f + t * s * 0.2) * Math.cos(v * f - t * s * 0.15)); f *= 2; amp *= 0.5; }
        return Math.sin((u + v) * 8 * sc + turb * 6) * 0.5 + 0.5;
    },
};
