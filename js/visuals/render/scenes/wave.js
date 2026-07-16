// wave — a travelling sine ridge; the band glows where the wave crosses.
export default {
    name: 'wave',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1) * 10;
        const amp = 0.18 + (a ? a.level * 0.22 : 0.12);
        const y = 0.5 + Math.sin(u * k + t * s * 2) * amp + Math.sin(u * k * 0.5 - t * s) * amp * 0.5;
        return Math.max(0, 1 - Math.abs(v - y) * 9);
    },
};
