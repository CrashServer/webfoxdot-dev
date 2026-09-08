// ── Quantum Wave Packet ───────────────────────────────────────────────────────
// 2D time-dependent Schrödinger equation via explicit finite difference.
// Renders |ψ|² as brightness, arg(ψ) as hue. Double-slit or harmonic potential.
// Bass modulates kx; beat reinitializes with random direction.
// Absorbing boundaries prevent reflections.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

function initWavePacket(N, kxBase, kyBase) {
    const re  = new Float32Array(N * N);
    const im  = new Float32Array(N * N);
    const x0  = N * 0.25, y0 = N * 0.5;
    const sig = N * 0.06;
    const A   = 1 / (sig * Math.sqrt(Math.PI));

    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const dx = i - x0, dy = j - y0;
            const env = A * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
            const ph  = kxBase * (i / N) * 2 * Math.PI + kyBase * (j / N) * 2 * Math.PI;
            re[j * N + i] = env * Math.cos(ph);
            im[j * N + i] = env * Math.sin(ph);
        }
    }
    return { re, im };
}

function makeV(N, potential) {
    const V = new Float32Array(N * N);
    if (potential === 1) {
        // Double slit: barrier at x=N/2, two gaps
        const bx    = N >> 1;
        const gapY1 = N * 0.38 | 0;
        const gapY2 = N * 0.62 | 0;
        const gapW  = Math.max(2, N * 0.06 | 0);
        const height = 5.0;
        for (let j = 0; j < N; j++) {
            const inGap1 = j >= gapY1 && j < gapY1 + gapW;
            const inGap2 = j >= gapY2 && j < gapY2 + gapW;
            if (!inGap1 && !inGap2) {
                V[j * N + bx]     = height;
                V[j * N + bx + 1] = height;
            }
        }
    } else if (potential === 2) {
        // Harmonic oscillator
        const cx = N / 2, cy = N / 2;
        const k  = 0.001;
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const dx = (i - cx), dy = (j - cy);
                V[j * N + i] = k * (dx * dx + dy * dy);
            }
        }
    }
    return V;
}

function makeAbsorber(N) {
    const ab = new Float32Array(N * N);
    const w2 = Math.max(1, N * 0.08 | 0);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const ex = Math.max(0, w2 - Math.min(i, N - 1 - i)) / w2;
            const ey = Math.max(0, w2 - Math.min(j, N - 1 - j)) / w2;
            ab[j * N + i] = 1 - 0.4 * Math.max(ex, ey);
        }
    }
    return ab;
}

function makeState(N, kx, potential) {
    const wp = initWavePacket(N, kx, 0);
    return {
        time: 0,
        N,
        re: wp.re,
        im: wp.im,
        reNew: new Float32Array(N * N), // pre-allocated scratch buffers
        imNew: new Float32Array(N * N),
        V: makeV(N, potential),
        ab: makeAbsorber(N),
        potential,
        kxBase: kx,
        offscreen: null,
        offCtx: null,
        prevBass: 0,
    };
}

export const quantumWaveParams = () => ({
    hue:       { base: 180, min: 0,   max: 360, mod: { source: "" } },
    kx:        { base: 8,   min: 0,   max: 20,  mod: { source: "" } },
    size:      { base: 128, min: 64,  max: 256,  step: 64, mod: { source: "" } },
    speed:     { base: 4,   min: 1,   max: 8,   step: 1, mod: { source: "" } },
    potential: { base: 1,   min: 0,   max: 2,   step: 1, mod: { source: "" } },
});

export function drawQuantumWave(ctx, w, h, p, t, extra) {
    const N   = Math.max(64, Math.min(256, Math.round((p.size ?? 128) / 64) * 64));
    const kxBase   = p.kx ?? 8;
    const potential = Math.max(0, Math.min(2, Math.round(p.potential ?? 1)));

    let st = _state.get(ctx);
    if (!st || st.N !== N || st.potential !== potential) {
        st = makeState(N, kxBase, potential);
        _state.set(ctx, st);
    }

    const sp = extra?.spectrum;
    let bass = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) {
        // Reinitialize with random direction
        const angle = Math.random() * Math.PI * 2;
        const spd   = kxBase * (0.5 + Math.random());
        const wp    = initWavePacket(N, spd * Math.cos(angle), spd * Math.sin(angle));
        st.re = wp.re; st.im = wp.im;
    }
    st.prevBass = bass;

    const kxEff = kxBase * (1 + bass * 0.4);
    const steps = Math.max(1, Math.round(p.speed ?? 4));
    const dt    = 0.025;
    const { re, im, V, ab } = st;

    // Finite difference steps — reuse pre-allocated scratch buffers on state
    const { reNew, imNew } = st;
    for (let step = 0; step < steps; step++) {
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const idx   = j * N + i;
                const reLap = re[idx-1] + re[idx+1] + re[idx-N] + re[idx+N] - 4*re[idx];
                const imLap = im[idx-1] + im[idx+1] + im[idx-N] + im[idx+N] - 4*im[idx];
                reNew[idx] = (re[idx] - dt * (imLap - V[idx] * im[idx])) * ab[idx];
                imNew[idx] = (im[idx] + dt * (reLap - V[idx] * re[idx])) * ab[idx];
            }
        }
        re.set(reNew);
        im.set(imNew);
    }

    // Check norm; reset if dispersed
    let norm = 0;
    for (let i = 0; i < N * N; i++) norm += re[i]*re[i] + im[i]*im[i];
    if (norm < 0.005) {
        const wp = initWavePacket(N, kxEff, 0);
        st.re.set(wp.re); st.im.set(wp.im);
    }

    // Render
    if (!st.offscreen || st.offscreen.width !== N) {
        st.offscreen = new OffscreenCanvas(N, N);
        st.offCtx    = st.offscreen.getContext('2d');
    }

    const id   = st.offCtx.createImageData(N, N);
    const data = id.data;
    const hue  = p.hue ?? 180;

    // Find max |ψ|² for normalization
    let maxProb = 1e-9;
    for (let i = 0; i < N * N; i++) {
        const prob = re[i]*re[i] + im[i]*im[i];
        if (prob > maxProb) maxProb = prob;
    }

    for (let i = 0; i < N * N; i++) {
        const prob  = (re[i]*re[i] + im[i]*im[i]) / maxProb;
        const phase = Math.atan2(im[i], re[i]); // -π to π
        const phaseH = ((phase / Math.PI + 1) / 2) * 360;
        const bright = Math.min(1, prob);
        const rgb   = hsl2rgb((hue + phaseH) % 360, 0.9, bright * 0.8);

        // Draw barrier as white for double slit
        const off = i << 2;
        if (V[i] > 1) {
            data[off] = 200; data[off+1] = 200; data[off+2] = 200; data[off+3] = 255;
        } else {
            data[off] = rgb[0]; data[off+1] = rgb[1]; data[off+2] = rgb[2]; data[off+3] = 255;
        }
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.offscreen, 0, 0, w, h);
}
