// contour — topographic lines tracing the level sets of a drifting height field.
export default {
    name: 'contour',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const h = Math.sin(u * 6 * sc + t * s * 0.3)
                + Math.cos(v * 6 * sc - t * s * 0.2)
                + Math.sin((u + v) * 4 * sc);
        const lines = Math.abs(Math.sin(h * Math.PI * 2.5));
        return Math.pow(lines, 6);
    },
};
