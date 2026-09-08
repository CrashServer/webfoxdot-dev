// ── Ulam Spiral ───────────────────────────────────────────────────────────────
// Number spiral from 1 outward; prime positions are lit.  The diagonal
// structure of primes becomes clearly visible.  Bass pulses prime brightness;
// treble reveals composite numbers as dim dots.

const _st = new WeakMap();

// Sieve of Eratosthenes up to N
function sieve(N) {
    const isPrime = new Uint8Array(N + 1);
    isPrime.fill(1);
    isPrime[0] = isPrime[1] = 0;
    for (let i = 2; i * i <= N; i++) {
        if (isPrime[i]) {
            for (let j = i * i; j <= N; j += i) isPrime[j] = 0;
        }
    }
    return isPrime;
}

// Ulam spiral: map integer n → (col, row) starting at (0,0), spiralling outward
function spiralPos(n) {
    if (n === 1) return [0, 0];
    // Shell k: contains numbers from (2k-1)² + 1 to (2k+1)²
    const k = Math.ceil((Math.sqrt(n) - 1) / 2);
    const t = 2 * k;
    const p = (t - 1) * (t - 1) + 1; // start of this layer
    // Four sides of the layer
    const idx = n - p;
    const side = Math.floor(idx / t);
    const pos  = idx % t;
    if (side === 0) return [k - pos, -k];
    if (side === 1) return [-k, -k + pos];
    if (side === 2) return [-k + pos, k];
    return [k, k - pos];
}

export const ulamSpiralParams = () => ({
    size:     { base: 101,  min: 21,  max: 301, step: 20, mod: { source: "" } }, // grid size (odd)
    dotSize:  { base: 2.0,  min: 0.5, max: 6,             mod: { source: "" } },
    hue:      { base: 260,  min: 0,   max: 360,           mod: { source: "" } },
    hue2:     { base: 60,   min: 0,   max: 360,           mod: { source: "" } }, // composite hue
    glow:     { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
    showComp: { base: 0,    min: 0,   max: 1,  step: 1,   mod: { source: "" } }, // show composites
    compAlpha:{ base: 0.1,  min: 0,   max: 0.5,           mod: { source: "" } },
    bgAlpha:  { base: 0.9,  min: 0,   max: 1,             mod: { source: "" } },
    rotate:   { base: 0.0,  min: -1,  max: 1,             mod: { source: "" } }, // rotation speed
});

export function drawUlamSpiral(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    let sz = Math.round(Math.max(21, Math.min(301, p.size ?? 101)));
    if (sz % 2 === 0) sz += 1; // must be odd
    const N     = sz * sz;
    const dotSz = (p.dotSize ?? 2.0) * (1 + bass * (p.pulse ?? 0.4) * 0.3);
    const hue   = p.hue ?? 260;
    const hue2  = p.hue2 ?? 60;
    const glow  = p.glow ?? 0.6;
    const showC = (p.showComp ?? 0) > 0.5;
    const compA = p.compAlpha ?? 0.1;
    const bgAlpha = p.bgAlpha ?? 0.9;
    const rotSpeed = p.rotate ?? 0;

    let st = _st.get(ctx);
    if (!st || st.N !== N) {
        const isPrime = sieve(N);
        st = { N, isPrime, rot: 0, lastT: t };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rot += rotSpeed * dt * 0.3;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const cellSz = Math.min(w, h) / sz;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.rot);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * dotSz * 3 * (1 + treble * 0.4);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    for (let n = 1; n <= N; n++) {
        const [col, row] = spiralPos(n);
        if (Math.abs(col) > sz / 2 || Math.abs(row) > sz / 2) continue;

        const isPrime = st.isPrime[n];
        if (!isPrime && !showC) continue;

        const px = col * cellSz;
        const py = row * cellSz;
        const r  = isPrime ? dotSz * (1 + bass * 0.3) : dotSz * 0.3;
        const ch = isPrime ? hue : hue2;
        const alpha = isPrime ? 0.8 + treble * 0.2 : compA;

        ctx.fillStyle = `hsla(${ch},85%,${isPrime ? 65 + treble * 20 : 40}%,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}
