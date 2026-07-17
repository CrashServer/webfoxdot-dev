// testpattern — Ryoji-Ikeda-style monochrome data test-card: fine sine gratings,
// flashing data blocks and a scanning bar. High-contrast, bass-reactive.
// (adapted from the stars WGSL renderer.)
export default {
    name: 'testpattern',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1), bass = a ? a.bass : 0;
        const grating = 0.5 + 0.5 * Math.sin(u * 40 * sc * 6.28318 + t * s * 2 + bass * 8);
        const blocks = Math.max(2, Math.round(12 * sc));
        const bx = Math.floor(u * blocks), by = Math.floor(v * blocks * 0.6), tick = Math.floor(t * s * 8);
        const h = Math.sin((bx + by * 0.13) * 127.1 + (tick + 0.5) * 311.7) * 43758.5453;
        const block = (h - Math.floor(h)) > (0.82 - bass * 0.3) ? 1 : 0;
        const scan = Math.max(0, 1 - Math.abs(((v - t * s * 0.3) % 1 + 1) % 1 - 0.02) / 0.03);
        return Math.min(1, Math.max(Math.pow(grating, 2) * block, block * 0.9, scan));
    },
};
