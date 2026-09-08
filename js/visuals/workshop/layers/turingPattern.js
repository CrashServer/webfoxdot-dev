// ── Multi-Scale Turing Pattern ────────────────────────────────────────────────
// Reaction-diffusion Turing spots via multi-scale activator/inhibitor vote.
// Bass injects noise bursts shifting pattern structure; mid hue-rotates and
// adjusts saturation; treble increases speed and sharpens contrast. The result
// produces organic spotted, striped, and labyrinthine patterns.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

function makeState(N) {
    const grid = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) grid[i] = Math.random() * 2 - 1;
    return { grid, N, offscreen: null, offCtx: null, prevBass: 0, pulse: 0 };
}

function boxBlurH(src, dst, N, r) {
    for (let y = 0; y < N; y++) {
        const row = y * N;
        let sum = 0;
        for (let x = -r; x <= r; x++) sum += src[row + ((x + N) % N)];
        dst[row] = sum;
        for (let x = 1; x < N; x++) {
            sum -= src[row + ((x - r - 1 + N) % N)];
            sum += src[row + ((x + r) % N)];
            dst[row + x] = sum;
        }
    }
}

function boxBlurV(src, dst, N, r) {
    for (let x = 0; x < N; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++) sum += src[((y + N) % N) * N + x];
        dst[x] = sum;
        for (let y = 1; y < N; y++) {
            sum -= src[((y - r - 1 + N) % N) * N + x];
            sum += src[((y + r) % N) * N + x];
            dst[y * N + x] = sum;
        }
    }
}

function blur2D(src, N, r, tmp1, tmp2) {
    boxBlurH(src, tmp1, N, r);
    boxBlurV(tmp1, tmp2, N, r);
    const scale = 1 / ((2 * r + 1) * (2 * r + 1));
    for (let i = 0; i < N * N; i++) tmp2[i] *= scale;
    return tmp2;
}

export const turingPatternParams = () => ({
    hue:        { base: 220, min: 0,   max: 360, mod: { source: "" } },
    hueRange:   { base: 80,  min: 0,   max: 200, mod: { source: "" } },
    saturation: { base: 0.8, min: 0.2, max: 1,   mod: { source: "" } },
    scales:     { base: 4,   min: 2,   max: 5,   mod: { source: "" } },
    size:       { base: 128, min: 64,  max: 256, mod: { source: "" } },
    speed:      { base: 1,   min: 1,   max: 5,   mod: { source: "" } },
    baseRadius: { base: 2,   min: 1,   max: 10,  mod: { source: "" } },
    stepSize:   { base: 0.02,min: 0.005,max: 0.1,mod: { source: "" } },
    contrast:   { base: 1,   min: 0.3, max: 3,   mod: { source: "" } },
    noiseInject:{ base: 0.1, min: 0,   max: 1,   mod: { source: "" } },
    smoothing:  { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
});

export function drawTuringPattern(ctx, w, h, p, t, extra) {
    const N = Math.max(64, Math.min(256, Math.round((p.size ?? 128) / 64) * 64));
    let st = _state.get(ctx);
    if (!st || st.N !== N) { st = makeState(N); _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;

    if (bass > 0.55 && bass > st.prevBass + 0.08) st.pulse = 1;
    st.prevBass = bass;
    st.pulse *= 0.8;

    const K          = Math.max(2, Math.min(5, Math.round(p.scales ?? 4)));
    const spd        = Math.max(1, Math.min(5, Math.round((p.speed ?? 1) + treble * 3)));
    const baseRadius = p.baseRadius ?? 2;
    const stepSize   = (p.stepSize ?? 0.02) * (1 + bass * 3 + st.pulse * 2);
    const noiseInj   = p.noiseInject ?? 0.1;

    const tmp1 = new Float32Array(N * N);
    const tmp2 = new Float32Array(N * N);
    const grid = st.grid;

    // Bass: inject noise burst
    if (st.pulse > 0.5) {
        const amount = noiseInj * st.pulse;
        for (let i = 0; i < N * N; i++) {
            if (Math.random() < 0.04) grid[i] += (Math.random() - 0.5) * amount * 2;
        }
    }

    for (let step = 0; step < spd; step++) {
        const variation = new Float32Array(N * N);
        for (let k = 0; k < K; k++) {
            const aR = Math.max(1, Math.round(baseRadius * Math.pow(2, k)));
            const iR = Math.max(2, aR * 3);
            const act = blur2D(grid, N, aR, tmp1, tmp2.slice());
            const inh = blur2D(grid, N, iR, tmp2, tmp1.slice());
            const wk  = 1 / (k + 1);
            for (let i = 0; i < N * N; i++) variation[i] += (act[i] > inh[i] ? 1 : -1) * wk;
        }
        for (let i = 0; i < N * N; i++) grid[i] += (variation[i] > 0 ? 1 : -1) * stepSize;

        // Normalize to [-1, 1]
        let minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < N * N; i++) { if (grid[i] < minV) minV = grid[i]; if (grid[i] > maxV) maxV = grid[i]; }
        const range = maxV - minV || 1;
        for (let i = 0; i < N * N; i++) grid[i] = (grid[i] - minV) / range * 2 - 1;
    }

    // Render
    if (!st.offscreen || st.offscreen.width !== N) {
        st.offscreen = new OffscreenCanvas(N, N);
        st.offCtx    = st.offscreen.getContext('2d');
    }
    const id   = st.offCtx.createImageData(N, N);
    const data = id.data;
    const hue       = p.hue       ?? 220;
    const hueRange  = p.hueRange  ?? 80;
    const sat       = (p.saturation ?? 0.8) + mid * 0.15;
    const contrast  = (p.contrast ?? 1) + treble * 0.5;
    const hShift    = mid * 60;

    for (let i = 0; i < N * N; i++) {
        // Apply contrast curve
        let val = (grid[i] + 1) / 2; // [0, 1]
        val = Math.max(0, Math.min(1, (val - 0.5) * contrast + 0.5));
        const h2  = hue + hShift + val * hueRange;
        const lum = 0.08 + val * 0.60;
        const rgb = hsl2rgb(h2, sat, lum);
        const off = i << 2;
        data[off] = rgb[0]; data[off+1] = rgb[1]; data[off+2] = rgb[2]; data[off+3] = 255;
    }
    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = (p.smoothing ?? 1) > 0.5;
    ctx.drawImage(st.offscreen, 0, 0, w, h);
}
