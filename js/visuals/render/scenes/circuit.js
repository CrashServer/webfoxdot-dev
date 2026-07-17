// circuit — Ikeda circuit traces, nodes and traveling pulses (adapted from stars).
export default {
    name: 'circuit',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0;
        const tt = t * s;
        const grid = Math.max(6, Math.round(12 * sc));
        const half = Math.max(2, Math.floor(grid / 2));
        const cellU = 1 / grid, cellV = 1 / half;
        const cx = Math.floor(u / cellU), cy = Math.floor(v / cellV);
        const localU = (u - cx * cellU) / cellU, localV = (v - cy * cellV) / cellV;
        const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); };
        const prob = 0.5;
        const hTrace = hash2(cx, cy) < 0.5 && hash2(cx + 7.3, cy + 7.3) < prob;
        const vTrace = hash2(cx + 3.1, cy + 3.1) < 0.5 && hash2(cx + 11.7, cy + 11.7) < prob;
        const traceWidth = 0.04;
        let val = 0;
        if (hTrace && Math.abs(localV - 0.5) < traceWidth) val = Math.max(val, (1 - Math.abs(localV - 0.5) / traceWidth) * 0.7);
        if (vTrace && Math.abs(localU - 0.5) < traceWidth) val = Math.max(val, (1 - Math.abs(localU - 0.5) / traceWidth) * 0.7);
        if (hTrace && vTrace) {
            const dr = Math.hypot(localU - 0.5, localV - 0.5);
            if (dr < 0.15) { let fall = 1 - dr / 0.15; fall *= fall; val = Math.max(val, fall * 0.9 * (1 + bass)); }
        }
        if (hTrace) {
            const raw = tt * 0.3 * (1 + bass) + cy * 0.17;
            const pulsePos = raw - Math.floor(raw);
            const dp = Math.abs(localU - pulsePos);
            if (dp < 0.08 && Math.abs(localV - 0.5) < traceWidth * 1.5) val = Math.max(val, Math.exp(-(dp * dp) * 600));
        }
        return Math.min(1, Math.max(0, val));
    },
};
