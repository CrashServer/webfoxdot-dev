// nebula — layered (fbm-ish) drifting sine noise; soft clouds.
export default {
    name: 'nebula',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1);
        let val = 0, amp = 0.5, f = 3 * k;
        for (let i = 0; i < 4; i++) {
            val += amp * Math.sin(u * f + t * s * 0.3 + i) * Math.cos(v * f - t * s * 0.2 - i);
            f *= 2; amp *= 0.5;
        }
        return val * 0.6 + 0.5;
    },
};
