// aurora — waving vertical curtains of light with a fine shimmer.
export default {
    name: 'aurora',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const wave = Math.sin(u * 6 * sc + t * s) + Math.sin(u * 11 * sc - t * s * 0.7) * 0.5;
        const band = 0.42 + wave * 0.14;
        const curtain = Math.max(0, 1 - Math.abs(v - band) * 3.5);
        const shimmer = 0.6 + 0.4 * Math.sin(u * 44 + t * s * 3);
        return curtain * shimmer * (0.7 + (a ? a.mid * 0.5 : 0.2));
    },
};
