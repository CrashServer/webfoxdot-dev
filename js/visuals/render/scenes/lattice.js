// lattice — a slowly-rotating mesh of glowing lines.
export default {
    name: 'lattice',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1) * 11;
        const rot = t * s * 0.2, c = Math.cos(rot), si = Math.sin(rot);
        const x = (u - 0.5) * c - (v - 0.5) * si, y = (u - 0.5) * si + (v - 0.5) * c;
        const gx = Math.abs(Math.sin(x * k * Math.PI)), gy = Math.abs(Math.sin(y * k * Math.PI));
        return Math.pow(Math.max(gx, gy), 8);
    },
};
