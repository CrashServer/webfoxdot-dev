// flow — a flow field: streamlines bend through a slowly-turning vector field.
export default {
    name: 'flow',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const ang = Math.sin(u * 5 * sc + t * s * 0.3) + Math.cos(v * 5 * sc - t * s * 0.2);
        const stream = Math.sin((u * Math.cos(ang) + v * Math.sin(ang)) * 22 - t * s * 2);
        return stream * 0.5 + 0.5;
    },
};
