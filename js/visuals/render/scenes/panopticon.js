// panopticon — radial surveillance eyes with sweep lines and crosshair (adapted from stars).
export default {
    name: 'panopticon',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const bass = a ? a.bass : 0;
        const tt = t * s;
        const cu = u - 0.5, cv = v - 0.5;
        const r = Math.hypot(cu, cv) * 2;
        let theta = Math.atan2(cv, cu);
        if (theta < 0) theta += 2 * Math.PI;
        if (r > 1.05) return 0;
        const N = 6, eyeRadius = 0.12;
        let val = 0;
        for (let i = 0; i < N; i++) {
            const ang = 2 * Math.PI * i / N;
            const rr = 0.35;
            const ex = rr * Math.cos(ang), ey = rr * Math.sin(ang);
            const d = Math.hypot(cu - ex, cv - ey);
            if (d < eyeRadius) { let fall = 1 - d / eyeRadius; fall *= fall; val = Math.max(val, fall * (0.8 + bass * 0.2)); }
            let dAng = Math.abs(theta - ang);
            if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
            if (dAng < 0.015 && r < 0.6) val = Math.max(val, (1 - dAng / 0.015) * 0.3);
        }
        if (Math.abs(cu) < 0.003 && Math.abs(cv) < 0.15) val = Math.max(val, 0.6);
        if (Math.abs(cv) < 0.003 && Math.abs(cu) < 0.15) val = Math.max(val, 0.6);
        return Math.min(1, Math.max(0, val));
    },
};
