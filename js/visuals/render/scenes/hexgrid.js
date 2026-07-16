// hexgrid — a honeycomb lattice from three interfering 60° gratings, pulsing.
export default {
    name: 'hexgrid',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1) * 7;
        const x = u * k, y = v * k * 1.1547;
        const h = Math.cos(x * Math.PI * 2)
                + Math.cos((x * 0.5 + y * 0.866) * Math.PI * 2)
                + Math.cos((x * 0.5 - y * 0.866) * Math.PI * 2);
        const cell = h / 3 * 0.5 + 0.5;
        return Math.pow(cell, 3) * (0.7 + 0.3 * Math.sin(t * s));
    },
};
