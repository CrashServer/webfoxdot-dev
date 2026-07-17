// hexdump — falling hex-digit columns (matrix-rain variant), per-column speed/phase (adapted from stars / CLIFT).
export default {
    name: 'hexdump',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const tt = t * s;
        const hdColumnDensity = 24, hdFallSpeed = 0.5, hdTrailLength = 0.4, hdCharChange = 8;
        const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); };
        const cols = Math.max(4, Math.round(hdColumnDensity * sc));
        const col = Math.floor(u * cols);
        // Per-column random phase, speed.
        const h = hash2(col, 17);
        const speed = hdFallSpeed * (0.5 + h);
        const phase = hash2(col + 5.7, 41);
        // Head v position (top → bottom falling).
        const raw = tt * speed + phase;
        const headV = 1 - (raw - Math.floor(raw));
        // Row discretisation.
        const rows = Math.max(4, Math.round(hdColumnDensity * 2 * sc));
        const row = Math.floor(v * rows);
        const rowV = row / rows;
        let dv = headV - rowV;
        if (dv < 0) dv += 1; // wrap
        const trail = hdTrailLength;
        if (dv > trail) return 0;
        const val = 1 - dv / trail;
        // Random digit flip per frame-ish (~87% on).
        const frame = Math.floor(tt * hdCharChange);
        const on = hash2(col + 3.3, row + frame * 7.919) > 0.125;
        if (!on) return 0;
        return Math.min(1, Math.max(0, val));
    },
};
