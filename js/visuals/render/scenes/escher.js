// escher — impossible rotating stairs (adapted from stars).
export default {
    name: 'escher',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0, beat = bass;
        const tt = t * s;
        const cx = (u - 0.5) * 1.8, cy = (v - 0.5) * 1.8;
        const angle = 0.25 + tt * 0.2 + bass * 0.3;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const rx = ca * cx - sa * cy, ry = sa * cx + ca * cy;
        const stepsPerCycle = 10 * Math.max(sc, 0.3);
        const stepIdx = rx * stepsPerCycle * 0.5 + ry * stepsPerCycle * 0.25;
        const stepFrac = stepIdx - Math.floor(stepIdx);
        const cycleIdx = Math.floor(stepIdx + tt * 0.5);
        let val = 0;
        const topEdge = Math.abs(stepFrac - 0.5);
        if (topEdge < 0.06) val = Math.max(val, 1 - topEdge / 0.06);
        const r = Math.hypot(cx, cy);
        val *= Math.max(0, 1 - r * 1.2);
        val *= 0.6 + 0.4 * bass;
        if (beat > 0.3) {
            const hh = Math.sin(cycleIdx * 127.1 + Math.floor(tt * 2) * 311.7) * 43758.5453123;
            const h = hh - Math.floor(hh);
            if (h < 0.125) val = Math.max(val, beat * 0.9);
        }
        return Math.min(1, Math.max(0, val));
    },
};
