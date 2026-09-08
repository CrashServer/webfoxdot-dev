// ── Kaliset Fractal Tunnel ────────────────────────────────────────────────────
// Adapted from native kali_tunnel.cu. Maps pixel → (angle, depth) then runs
// Kali iterations: p = |p|/dot(p,p) - c.  Orbit trap for coloring.
// Renders at w/3 × h/3 and upscales. Level scales brightness; bass shifts
// foldC; beat triggers speed burst.

const _state = new WeakMap();

function lerp(a, b, t) { return a + (b - a) * t; }

// Color palette A and B as [R,G,B] in [0,1]
function hue2rgb_pair(hue) {
    function hsl(h, s, l) {
        h = ((h % 360) + 360) % 360;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
        return [f(0), f(8), f(4)];
    }
    return { A: hsl(hue, 0.8, 0.2), B: hsl((hue + 120) % 360, 0.9, 0.6) };
}

export const kaliTunnelParams = () => ({
    hue:        { base: 220, min: 0,   max: 360, mod: { source: "" } },
    speed:      { base: 0.6, min: 0.1, max: 3,   mod: { source: "" } },
    iters:      { base: 6,   min: 3,   max: 10,  step: 1, mod: { source: "" } },
    foldC:      { base: 0.5, min: 0.1, max: 0.9, mod: { source: "" } },
    glow:       { base: 1.5, min: 0,   max: 3,   mod: { source: "" } },
    brightness: { base: 1.2, min: 0.5, max: 3,   mod: { source: "" } },
    spin:       { base: 0.15,min: 0,   max: 1,   mod: { source: "" } },
});

export function drawKaliTunnel(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, prevBass: 0, speedBoost: 0, offscreen: null, offCtx: null, ow: 0, oh: 0 }; _state.set(ctx, st); }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0, level = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
        for (let i = 0; i < 64; i++) level += sp[i]; level /= 64;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) st.speedBoost = 1;
    st.prevBass  = bass;
    st.speedBoost *= 0.9;

    const hue        = p.hue ?? 220;
    const speed      = (p.speed ?? 0.6) * (1 + st.speedBoost * 2);
    const iters      = Math.max(3, Math.min(10, Math.round(p.iters ?? 6)));
    const foldC      = Math.max(0.1, Math.min(0.9, (p.foldC ?? 0.5) + bass * 0.15));
    const glow       = p.glow ?? 1.5;
    const brightness = (p.brightness ?? 1.2) * (1 + level * 0.5);
    const spin       = p.spin ?? 0.15;

    const rw = Math.max(1, w / 3 | 0);
    const rh = Math.max(1, h / 3 | 0);

    if (!st.offscreen || st.ow !== rw || st.oh !== rh) {
        st.offscreen = new OffscreenCanvas(rw, rh);
        st.offCtx    = st.offscreen.getContext('2d');
        st.ow = rw; st.oh = rh;
    }

    const id   = st.offCtx.createImageData(rw, rh);
    const data = id.data;
    const { A, B } = hue2rgb_pair(hue);
    const time    = st.time * speed;
    const spinA   = st.time * spin * 0.3;
    const cosS    = Math.cos(spinA), sinS = Math.sin(spinA);
    const scale   = 1.5; // angle scale factor

    for (let py = 0; py < rh; py++) {
        const dy = (py / rh - 0.5) * 2 * (h / rh);
        for (let px = 0; px < rw; px++) {
            const dx = (px / rw - 0.5) * 2 * (w / rw);
            const r  = Math.sqrt(dx * dx + dy * dy);
            if (r < 0.5) {
                const off = (py * rw + px) << 2;
                data[off] = data[off+1] = data[off+2] = 0; data[off+3] = 255;
                continue;
            }
            const angle = Math.atan2(dy, dx) * scale;
            const depth = 1.4 / (r / Math.min(w, h)) + time;

            // Spin on angle/depth
            let kx = angle * cosS - depth * sinS * 0.05;
            let ky = angle * sinS + depth * cosS * 0.05;
            kx = angle; ky = depth;

            let trap = 1e9, amp = 1;
            let colR = 0, colG = 0, colB = 0;

            for (let k = 0; k < iters; k++) {
                const d2 = Math.max(kx * kx + ky * ky, 1e-4);
                kx = Math.abs(kx) / d2 - foldC;
                ky = Math.abs(ky) / d2 - foldC;
                trap = Math.min(trap, Math.abs(kx));

                const tf   = 0.5 + 0.5 * Math.sin(k * 1.3 + depth * 0.15 + time * 0.5);
                const fade = Math.exp(-Math.abs(ky) * 2.5) * amp;
                colR += lerp(A[0], B[0], tf) * fade;
                colG += lerp(A[1], B[1], tf) * fade;
                colB += lerp(A[2], B[2], tf) * fade;
                amp  *= 0.82;
            }

            // Orbit trap glow
            const tg = Math.exp(-trap * 7) * (1 + glow);
            colR += 0.5 * tg; colG += 0.3 * tg; colB += 0.8 * tg;

            const scl = brightness;
            const off = (py * rw + px) << 2;
            data[off]     = Math.min(255, colR * scl * 255 | 0);
            data[off + 1] = Math.min(255, colG * scl * 255 | 0);
            data[off + 2] = Math.min(255, colB * scl * 255 | 0);
            data[off + 3] = 255;
        }
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.offscreen, 0, 0, w, h);
}
