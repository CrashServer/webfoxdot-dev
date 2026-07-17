// spiral — logarithmic arms winding out of the centre.
export default {
    name: 'spiral',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const arms = p.arms ?? 3;
        return Math.sin(ang * arms + r * sc * 22 - t * s * 2 - (a ? a.mid * 3 : 0)) * 0.5 + 0.5;
    },
};
