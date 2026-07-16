// checker — a warping checkerboard; the squares ripple as they scroll.
export default {
    name: 'checker',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = Math.max(2, Math.round((p.scale ?? 1) * 8));
        const wu = u + Math.sin(v * 4 + t * s) * 0.05;
        const wv = v + Math.cos(u * 4 - t * s) * 0.05;
        const c = (Math.floor(wu * k) + Math.floor(wv * k)) & 1;
        return c ? 1 : 0.06;
    },
};
