// ── Abelian Sandpile Automaton ────────────────────────────────────────────────
// Sandpile CA: cells hold 0-3 grains; ≥4 → topple (fire 1 to each neighbour).
// Repeated center drops produce fractal mandalas with self-organized criticality.
// Bass increases drop rate and triggers avalanche bursts; mid hue-rotates the
// palette; treble adds scatter mode randomizing drop positions.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

function makeState(N) {
    return {
        grid: new Int32Array(N * N),
        N, frameNo: 0,
        offscreen: null, offCtx: null,
        prevBass: 0, pulse: 0, totalDropped: 0,
    };
}

function ensureOff(st) {
    if (!st.offscreen || st.offscreen.width !== st.N) {
        st.offscreen = new OffscreenCanvas(st.N, st.N);
        st.offCtx    = st.offscreen.getContext('2d');
    }
}

export const sandpileParams = () => ({
    hue:       { base: 220, min: 0,   max: 360, mod: { source: "" } },
    hueRange:  { base: 200, min: 0,   max: 360, mod: { source: "" } },
    size:      { base: 256, min: 64,  max: 512, mod: { source: "" } },
    speed:     { base: 6,   min: 1,   max: 30,  mod: { source: "" } },
    scatter:   { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    saturation:{ base: 0.9, min: 0.2, max: 1,   mod: { source: "" } },
    brightness:{ base: 1,   min: 0.3, max: 2,   mod: { source: "" } },
    burstSize: { base: 300, min: 50,  max: 1000,mod: { source: "" } },
    symmetry:  { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    bgDark:    { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
    usePalette:{ base: 0,   min: 0,   max: 1,   mod: { source: "" } },
});

export function drawSandpile(ctx, w, h, p, t, extra) {
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const N = Math.max(64, Math.min(512, Math.round((p.size ?? 256) / 64) * 64));
    let st = _state.get(ctx);
    if (!st || st.N !== N) { st = makeState(N); _state.set(ctx, st); }

    const sp = extra?.spectrum;
    let bass = 0, mid = 0, treble = 0;
    if (sp) {
        bass   = Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2);
        mid    = Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2);
        treble = Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2);
    }

    if (bass > 0.55 && bass > st.prevBass + 0.08) st.pulse = 1;
    st.prevBass = bass;
    st.pulse *= 0.82;

    st.frameNo++;

    // Auto-reset when grid saturates
    const maxFill = N * N * 2.5;
    if (st.totalDropped > maxFill || st.frameNo > 5000) {
        st.grid.fill(0); st.frameNo = 0; st.totalDropped = 0;
    }

    const hue       = p.hue        ?? 220;
    const hueRange  = p.hueRange   ?? 200;
    const scatter   = (p.scatter   ?? 0) > 0.5 || treble > 0.6;
    const sat       = p.saturation ?? 0.9;
    const bright    = (p.brightness ?? 1) * (1 + mid * 0.4);
    const burstSize = p.burstSize  ?? 300;
    const sym       = (p.symmetry  ?? 0) > 0.5;
    const bgDark    = (p.bgDark    ?? 1) > 0.5;

    const drops = Math.round((p.speed ?? 6) * (1 + bass * 4));
    const burst = st.pulse > 0.5 ? Math.round(burstSize * st.pulse) : 0;
    const total = drops + burst;
    const grid  = st.grid;
    const half  = N >> 1;

    for (let d = 0; d < total; d++) {
        let cx = half, cy = half;
        if (scatter || d >= drops) {
            cx = Math.random() * N | 0;
            cy = Math.random() * N | 0;
        }
        grid[cy * N + cx] += 1;
        if (sym) {
            // Reflect across both axes
            grid[(N - 1 - cy) * N + cx] += 1;
            grid[cy * N + (N - 1 - cx)] += 1;
            grid[(N - 1 - cy) * N + (N - 1 - cx)] += 1;
        }
    }
    st.totalDropped += total;

    // Topple — capped iterations
    const maxTopples = Math.round(drops * 600);
    for (let step = 0; step < maxTopples; step++) {
        let anyToppled = false;
        for (let y = 1; y < N - 1; y++) {
            for (let x = 1; x < N - 1; x++) {
                const idx = y * N + x;
                if (grid[idx] >= 4) {
                    const t4 = (grid[idx] / 4) | 0;
                    grid[idx]     -= t4 * 4;
                    grid[idx - N] += t4;
                    grid[idx + N] += t4;
                    grid[idx - 1] += t4;
                    grid[idx + 1] += t4;
                    anyToppled = true;
                }
            }
        }
        if (!anyToppled) break;
    }

    // Render
    ensureOff(st);
    const id   = st.offCtx.createImageData(N, N);
    const data = id.data;
    const hShift = mid * 60;

    if (_pal) {
        // Palette mode: map grain count (0-3) to palette, 0 grains = dark bg
        for (let i = 0; i < N * N; i++) {
            const v   = Math.min(3, Math.max(0, grid[i]));
            const off = i << 2;
            if (v === 0) {
                data[off] = 8; data[off+1] = 10; data[off+2] = 18; data[off+3] = 255;
            } else {
                const hex = pC(v / 3).replace("#","");
                data[off]   = parseInt(hex.slice(0,2),16);
                data[off+1] = parseInt(hex.slice(2,4),16);
                data[off+2] = parseInt(hex.slice(4,6),16);
                data[off+3] = 255;
            }
        }
    } else {
    // Pre-compute 4 colors for grain states 0-3
    const c0 = bgDark ? [8, 10, 18] : hsl2rgb(hue + hShift,            sat * 0.3, bright * 0.08);
    const c1 = hsl2rgb(hue + hShift + hueRange * 0.25, sat, Math.min(1, bright * 0.38));
    const c2 = hsl2rgb(hue + hShift + hueRange * 0.55, sat, Math.min(1, bright * 0.60));
    const c3 = hsl2rgb(hue + hShift + hueRange * 0.85, sat, Math.min(1, bright * 0.80));
    const cols = [c0, c1, c2, c3];

    for (let i = 0; i < N * N; i++) {
        const v   = Math.min(3, Math.max(0, grid[i]));
        const c   = cols[v];
        const off = i << 2;
        data[off]     = c[0];
        data[off + 1] = c[1];
        data[off + 2] = c[2];
        data[off + 3] = 255;
    }
    }
    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.offscreen, 0, 0, w, h);
}
