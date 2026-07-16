// noise — animated hash static (TV snow); great through a palette or as a mask.
export default {
    name: 'noise',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = Math.max(4, Math.round((p.scale ?? 1) * 60));
        const cx = Math.floor(u * k), cy = Math.floor(v * k), frame = Math.floor(t * s * 12);
        const h = Math.sin(cx * 127.1 + cy * 311.7 + frame * 13.73) * 43758.5453;
        return h - Math.floor(h);
    },
};
