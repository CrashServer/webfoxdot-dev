// lightning — fbm storm sky + a zig-zag bolt that strikes on a schedule (adapted from stars).
function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); }
function vnoise(px, py) {
    const ix = Math.floor(px), iy = Math.floor(py);
    let fx = px - ix, fy = py - iy;
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(px, py) {
    let val = 0, amp = 0.5, f = 1;
    for (let i = 0; i < 5; i++) { val += amp * vnoise(px * f, py * f); f *= 2.07; amp *= 0.5; }
    return val;
}
export default {
    name: 'lightning',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const sky = fbm(u * 3.0 + t * s * 0.1, v * 3.0) * 0.15;
        const rate = 0.7 * s, ep = Math.floor(t * rate), age = t * rate - Math.floor(t * rate);
        const seed = ep * 13.1;
        let boltI = 0, env = 0;
        if (age < 0.32) {
            env = Math.max(Math.exp(-age * 7.0) * (0.55 + 0.45 * Math.sin(age * 85.0)), 0.0);
            const xs = u, ys = 1.0 - v;
            for (let branch = 0; branch < 2; branch++) {
                const zigSeed = seed + branch * 7.3;
                const drift = (branch === 0) ? (hash2(seed, 0.37) - 0.5) * 0.35 : (hash2(seed, branch * 2.1) - 0.5) * 1.4;
                const jit = (branch === 0) ? 0.06 : 0.10;
                let px = 0.5, py = 1.0, minDsq = 1e9;
                for (let k = 1; k <= 20; k++) {
                    const ny = 1 - k / 20;
                    const bend = (hash2(zigSeed, k) - 0.5) * jit;
                    const nx = px + bend + drift / 20;
                    // point-to-segment distance² from (xs,ys) to (px,py)->(nx,ny)
                    const ex = nx - px, ey = ny - py;
                    const l2 = ex * ex + ey * ey;
                    let tp = l2 > 1e-8 ? ((xs - px) * ex + (ys - py) * ey) / l2 : 0;
                    tp = Math.min(1, Math.max(0, tp));
                    const qx = px + ex * tp, qy = py + ey * tp;
                    const dSq = (xs - qx) * (xs - qx) + (ys - qy) * (ys - qy);
                    if (dSq < minDsq) minDsq = dSq;
                    px = nx; py = ny;
                }
                boltI += Math.exp(-minDsq * 55000.0) + Math.exp(-minDsq * 1500.0) * 0.5;
            }
            boltI *= env;
        }
        const skyFlash = (age < 0.32) ? env * 0.3 : 0.0;
        return Math.min(1, Math.max(0, sky + boltI + skyFlash));
    },
};
