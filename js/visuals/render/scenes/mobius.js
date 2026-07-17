// mobius — Möbius ribbon sampled as a closed curve, closest-point per pixel (adapted from stars / CLIFT).
export default {
    name: 'mobius',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const tt = t * s;
        const emRotSpeed = 0.2, emTwists = 1.0, emThickness = 0.03;
        const cu = (u - 0.5) * 1.6, cv = (v - 0.5) * 1.6;
        const rotT = tt * emRotSpeed;
        const ca = Math.cos(rotT), sa = Math.sin(rotT);
        // Inverse rotate ray onto strip plane.
        const rx = ca * cu + sa * cv, ry = -sa * cu + ca * cv;
        const N = 48, INNER = 3;
        let closestD = 1e9;
        for (let i = 0; i < N; i++) {
            const th = i / N * 2 * Math.PI;
            for (let j = 0; j < INNER; j++) {
                const w = (j / (INNER - 1) - 0.5) * 0.15; // ribbon width
                const twist = emTwists * th * 0.5;
                const rad = 0.5 + w * Math.cos(twist);
                const yOff = w * Math.sin(twist);
                const px = Math.cos(th) * rad;
                const py = Math.sin(th) * rad + yOff * 0.5;
                const d2 = (rx - px) * (rx - px) + (ry - py) * (ry - py);
                if (d2 < closestD) closestD = d2;
            }
        }
        const d = Math.sqrt(closestD);
        if (d > emThickness) return 0;
        let val = 1 - d / emThickness;
        val = val * val * (3 - 2 * val);
        return Math.min(1, Math.max(0, val));
    },
};
