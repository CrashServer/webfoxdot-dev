// ── Langton's Ant (multi-ant, multi-state) ────────────────────────────────────
// Multi-ant system on a toroidal grid. Each ant reads cell state, turns per
// rule string, advances, increments cell state. Multiple selectable rule presets
// produce wildly different emergent patterns. Bass respawns ants at new positions;
// mid shifts the color palette; treble increases step rate.

const _state = new WeakMap();

const RULE_PRESETS = [
    'LR',         // Classic — highway
    'LRRL',       // Spiral web
    'LLRR',       // Diamond
    'LRRLRLLR',   // Chaotic then structure
    'RLLR',       // Symmetric spirals
    'LRLRRL',     // Dense maze
];

const TURN_L = [3, 0, 1, 2];
const TURN_R = [1, 2, 3, 0];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

function spawnAnt(N) {
    const half = N >> 1;
    return {
        x:   half + ((Math.random() - 0.5) * N * 0.4 | 0),
        y:   half + ((Math.random() - 0.5) * N * 0.4 | 0),
        dir: Math.random() * 4 | 0,
    };
}

function makeState(N, numAnts) {
    const ants = [];
    for (let i = 0; i < numAnts; i++) ants.push(spawnAnt(N));
    return {
        grid: new Uint8Array(N * N),
        N, ants,
        frameNo: 0,
        prevBass: 0, pulse: 0,
        offscreen: null, offCtx: null,
        trail: new Float32Array(N * N), // fade value 0-1 for trail brightness
    };
}

function ensureOff(st) {
    if (!st.offscreen || st.offscreen.width !== st.N) {
        st.offscreen = new OffscreenCanvas(st.N, st.N);
        st.offCtx    = st.offscreen.getContext('2d');
    }
}

export const langtonsAntParams = () => ({
    hue:       { base: 140, min: 0,   max: 360,  mod: { source: "" } },
    hueRange:  { base: 260, min: 60,  max: 360,  mod: { source: "" } },
    numAnts:   { base: 3,   min: 1,   max: 12,   mod: { source: "" } },
    preset:    { base: 0,   min: 0,   max: 5,    mod: { source: "" } },
    speed:     { base: 400, min: 50,  max: 3000, mod: { source: "" } },
    size:      { base: 256, min: 64,  max: 512,  mod: { source: "" } },
    trailFade: { base: 0.02, min: 0,  max: 0.3,  mod: { source: "" } },
    antGlow:   { base: 1,   min: 0,   max: 3,    mod: { source: "" } },
    saturation:{ base: 0.85,min: 0.3, max: 1,    mod: { source: "" } },
    bgBright:  { base: 0.04,min: 0,   max: 0.2,  mod: { source: "" } },
    resetFull: { base: 0,   min: 0,   max: 1,    mod: { source: "" } },
    usePalette:{ base: 0,   min: 0,   max: 1,    mod: { source: "" } },
});

export function drawLangtonsAnt(ctx, w, h, p, t, extra) {
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const N       = Math.max(64, Math.min(512, Math.round((p.size ?? 256) / 64) * 64));
    const numAnts = Math.max(1, Math.min(12, Math.round(p.numAnts ?? 3)));

    let st = _state.get(ctx);
    if (!st || st.N !== N) { st = makeState(N, numAnts); _state.set(ctx, st); }

    // Adjust live ant count
    while (st.ants.length < numAnts) st.ants.push(spawnAnt(N));
    if (st.ants.length > numAnts) st.ants.length = numAnts;

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;

    if (bass > 0.55 && bass > st.prevBass + 0.08) {
        st.pulse = 1;
        // Bass respawns ants at new positions (preserves pattern)
        for (let i = 0; i < st.ants.length; i++) st.ants[i] = spawnAnt(N);
        if ((p.resetFull ?? 0) > 0.5) st.grid.fill(0);
    }
    st.prevBass = bass;
    st.pulse *= 0.8;

    const hue       = p.hue       ?? 140;
    const hueRange  = p.hueRange  ?? 260;
    const sat       = p.saturation ?? 0.85;
    const trailFade = p.trailFade ?? 0.02;
    const bgBright  = p.bgBright  ?? 0.04;
    const presetIdx = Math.max(0, Math.min(RULE_PRESETS.length - 1, p.preset | 0 || 0));
    const rule      = RULE_PRESETS[presetIdx];
    const numSt     = rule.length;
    const steps     = Math.round((p.speed ?? 400) * (1 + bass * 2.5 + treble * 1.5));
    const grid      = st.grid;
    const trail     = st.trail;

    // Step ants
    for (let s = 0; s < steps; s++) {
        for (let ai = 0; ai < st.ants.length; ai++) {
            const ant = st.ants[ai];
            let x = ((ant.x % N) + N) % N;
            let y = ((ant.y % N) + N) % N;
            const idx   = y * N + x;
            const state = grid[idx];
            const ch    = rule[state % numSt];
            if (ch === 'L') ant.dir = TURN_L[ant.dir];
            else if (ch === 'R') ant.dir = TURN_R[ant.dir];
            else if (ch === 'U') ant.dir = (ant.dir + 2) % 4;
            grid[idx]  = (state + 1) % numSt;
            trail[idx] = 1.0; // mark as freshly visited
            ant.x = x + DX[ant.dir];
            ant.y = y + DY[ant.dir];
        }
    }

    // Decay trail
    if (trailFade > 0) {
        for (let i = 0; i < N * N; i++) trail[i] = Math.max(0, trail[i] - trailFade);
    }

    st.frameNo++;

    ensureOff(st);
    const id   = st.offCtx.createImageData(N, N);
    const data = id.data;
    const hShift = mid * 70;

    for (let i = 0; i < N * N; i++) {
        const s    = grid[i];
        const fade = trail[i];
        const frac = numSt > 1 ? s / (numSt - 1) : 0;
        const off  = i << 2;
        if (_pal && s !== 0) {
            // Palette heatmap: color by trail visit intensity
            const hex = pC(Math.max(frac, fade)).replace("#","");
            data[off]   = parseInt(hex.slice(0,2),16);
            data[off+1] = parseInt(hex.slice(2,4),16);
            data[off+2] = parseInt(hex.slice(4,6),16);
            data[off+3] = 255;
        } else if (_pal && s === 0) {
            // Unvisited cells: dark background
            const lum8 = Math.round(bgBright * 255);
            data[off] = lum8; data[off+1] = lum8; data[off+2] = lum8; data[off+3] = 255;
        } else {
        const lum  = s === 0 ? bgBright : 0.28 + frac * 0.55 + fade * 0.15;
        const rgb  = hsl2rgb(hue + hShift + frac * hueRange, sat, Math.min(0.95, lum));
        data[off]     = rgb[0];
        data[off + 1] = rgb[1];
        data[off + 2] = rgb[2];
        data[off + 3] = 255;
        }
    }

    // Mark ant positions as bright white dots
    for (let ai = 0; ai < st.ants.length; ai++) {
        const ax  = ((st.ants[ai].x % N) + N) % N;
        const ay  = ((st.ants[ai].y % N) + N) % N;
        const off = (ay * N + ax) << 2;
        data[off] = 255; data[off+1] = 240; data[off+2] = 200; data[off+3] = 255;
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.offscreen, 0, 0, w, h);

    // Optional additive glow overlay on ant positions
    const antGlow = (p.antGlow ?? 1) + st.pulse * 1.5;
    if (antGlow > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        const glowR = Math.max(2, (w / N) * 3 * antGlow);
        for (let ai = 0; ai < st.ants.length; ai++) {
            const ax = ((st.ants[ai].x % N) + N) % N;
            const ay = ((st.ants[ai].y % N) + N) % N;
            const sx = (ax / N) * w;
            const sy = (ay / N) * h;
            const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
            g2.addColorStop(0, `hsla(${hue + hShift},90%,90%,${0.7 * antGlow})`);
            g2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}
