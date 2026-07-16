// truchet — tiles of quarter-arcs, randomly flipped, that reshuffle over time into
// endless winding paths.
export default {
    name: 'truchet',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), k = Math.max(2, Math.round((p.scale ?? 1) * 6));
        const cx = Math.floor(u * k), cy = Math.floor(v * k);
        const h = Math.sin(cx * 127.1 + cy * 311.7 + Math.floor(t * s)) * 43758.5453;
        const flip = (h - Math.floor(h)) > 0.5;
        const fx = u * k - cx, fy = v * k - cy;
        const d = flip ? Math.abs(Math.hypot(fx, fy) - 0.5) : Math.abs(Math.hypot(1 - fx, fy) - 0.5);
        return Math.max(0, 1 - d * 8);
    },
};
