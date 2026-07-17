// lissajous — parametric Lissajous curve traced by closest sample; a/b freqs from mid/treble (adapted from stars / CLIFT).
export default {
    name: 'lissajous',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const bass = a ? a.bass : 0, mid = a ? a.mid : 0, treble = a ? a.treble : 0;
        const tt = t * s;
        const liA = 3, liB = 2, liThickness = 0.02, liSampleCount = 80;
        const av = liA + mid * 4;
        const bv = liB + treble * 5;
        const delta = tt * 0.5 + bass * 3.14;
        const cu = (u - 0.5) * 1.6, cy = (v - 0.5) * 1.6;
        const N = liSampleCount; // capped constant
        let closest = 1e9;
        for (let i = 0; i < N; i++) {
            const th = i / N * 2 * Math.PI;
            const px = Math.sin(av * th + delta) * 0.6;
            const py = Math.sin(bv * th) * 0.6;
            const d2 = (px - cu) * (px - cu) + (py - cy) * (py - cy);
            if (d2 < closest) closest = d2;
        }
        const thickness = liThickness + bass * 0.008;
        const d = Math.sqrt(closest);
        let val = 1 - Math.min(d / thickness, 1);
        val = val * val * (3 - 2 * val);
        return Math.min(1, Math.max(0, val));
    },
};
