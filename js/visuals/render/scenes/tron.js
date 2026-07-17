// tron — receding neon perspective tunnel: grid lines + floor/ceiling glow (adapted from stars).
export default {
    name: 'tron',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0;
        const cx = (u - 0.5) * 2, cy = (0.5 - v) * 2;      // cy points up
        const r = Math.max(Math.hypot(cx, cy), 0.001);
        const ang = Math.atan2(cy, cx);
        const radial = 1 / r;
        const density = sc, zFreq = 1.5 + density * 6, aFreq = 8 + density * 16;
        const thick = 0.06, scroll = t * s;
        const aTwisted = ang + radial * 0.5;
        const fr = (x) => x - Math.floor(x);
        const ss = (e0, e1, x) => { const tt = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return tt * tt * (3 - 2 * tt); };
        const zEdge = ss(thick, 0, Math.abs(fr(radial * zFreq + scroll) - 0.5));
        const aEdge = ss(thick, 0, Math.abs(fr(aTwisted * aFreq * 0.159155 + 0.5) - 0.5));
        const fade = ss(4, 1, radial);
        const grid = (zEdge + aEdge) * fade;
        const vMax = Math.max(Math.abs(cx), Math.abs(cy));
        const vert = cy / Math.max(vMax, 1e-4);
        const floorMask = ss(-0.4, -1.0, vert), ceilMask = ss(0.4, 1.0, vert);
        const dropoff = ss(1.4, 0, r);
        const glow = (floorMask * 0.5 + ceilMask * 0.3) * dropoff;
        return Math.min(1, Math.max(0, grid + glow * (1.0 + bass)));
    },
};
