// warp — domain-warped sines: the field is sampled through a wobbling coordinate
// distortion, giving liquid, marbled folds.
export default {
    name: 'warp',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const n1 = Math.sin(u * 10 * sc + t * s) + Math.cos(v * 10 * sc - t * s);
        const n2 = Math.sin((u + n1 * 0.12) * 10 * sc + t * s * 0.5) + Math.cos((v - n1 * 0.12) * 10 * sc);
        return n2 * 0.25 + 0.5;
    },
};
