// starfield — sparse twinkling stars drifting downward.
export default {
    name: 'starfield',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), n = Math.max(6, Math.round(28 * (p.scale ?? 1)));
        const vv = (v + t * s * 0.06) % 1;            // gentle downward drift
        const cx = Math.floor(u * n), cy = Math.floor(vv * n);
        const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453; const hf = h - Math.floor(h);
        if (hf < 0.86) return 0;                      // most cells empty
        return (Math.sin(t * s * 2 + hf * 30) * 0.5 + 0.5) * ((hf - 0.86) / 0.14);
    },
};
