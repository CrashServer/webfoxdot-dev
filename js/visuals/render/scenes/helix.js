// helix — a twin-strand double helix winding up the frame.
export default {
    name: 'helix',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const phase = v * 8 * sc - t * s * 2;
        const x1 = 0.5 + Math.sin(phase) * 0.3;
        const x2 = 0.5 + Math.sin(phase + Math.PI) * 0.3;
        const d = Math.min(Math.abs(u - x1), Math.abs(u - x2));
        return Math.max(0, 1 - d * 12) * (0.6 + 0.4 * Math.cos(phase));   // front strand brighter
    },
};
