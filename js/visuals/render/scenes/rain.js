// rain — matrix-style falling columns, each with its own speed + trailing tail.
export default {
    name: 'rain',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), cols = 40 * (p.scale ?? 1);
        const col = Math.floor(u * cols);
        const seed = Math.sin(col * 12.9898) * 43758.5453; const off = seed - Math.floor(seed);
        const speed = s * (0.4 + off * 1.2);
        const head = (t * speed * 0.3 + off) % 1;
        const d = (v - head + 1) % 1;         // distance below the head (wraps)
        return Math.max(0, 1 - d * 4);
    },
};
