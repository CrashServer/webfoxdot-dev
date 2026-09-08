// ── Arc Discharge ─────────────────────────────────────────────────────────────
// Fractal lightning tendrils emanating from a configurable anchor (default
// centre). Each bolt uses recursive midpoint displacement to produce natural
// branching. Regenerates periodically and on bass transients. A secondary
// "ground" attractor pulls tips toward the nearest edge for a Tesla-coil look.

const _st = new WeakMap();

function bolt(pts, x1, y1, x2, y2, depth, roughness, rng, maxPts) {
    if (pts.length >= maxPts) return;
    if (depth === 0) { pts.push(x1, y1, x2, y2); return; }
    const mx  = (x1 + x2) / 2;
    const my  = (y1 + y2) / 2;
    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const jit = (rng() - 0.5) * len * roughness;
    const nx  = -(y2 - y1) / len * jit;
    const ny  =  (x2 - x1) / len * jit;
    bolt(pts, x1, y1, mx+nx, my+ny, depth-1, roughness * 0.72, rng, maxPts);
    bolt(pts, mx+nx, my+ny, x2, y2, depth-1, roughness * 0.72, rng, maxPts);
    if (depth >= 2 && rng() < 0.22 && pts.length < maxPts) {
        const bx = mx + nx + (rng()-0.5)*len*roughness*2;
        const by = my + ny + (rng()-0.5)*len*roughness*2;
        bolt(pts, mx+nx, my+ny, bx, by, depth-2, roughness*0.6, rng, maxPts);
    }
}

// lcg RNG seeded for deterministic animation
function makeRng(seed) {
    let s = (seed | 0) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

export const arcDischargeParams = () => ({
    bolts:     { base: 6,   min: 1,   max: 20,  step: 1,  mod: { source: "" } },
    depth:     { base: 6,   min: 3,   max: 9,   step: 1,  mod: { source: "" } },
    roughness: { base: 0.55,min: 0.1, max: 1.2,           mod: { source: "" } },
    hue:       { base: 195, min: 0,   max: 360,           mod: { source: "" } },
    hueSpread: { base: 60,  min: 0,   max: 180,           mod: { source: "" } },
    glow:      { base: 0.7, min: 0,   max: 1,             mod: { source: "" } },
    anchorX:   { base: 0.5, min: 0,   max: 1,             mod: { source: "" } },
    anchorY:   { base: 0.5, min: 0,   max: 1,             mod: { source: "" } },
    rateHz:    { base: 12,  min: 0.5, max: 60,            mod: { source: "" } },
    energy:    { base: 0.5, min: 0,   max: 1,             mod: { source: "" } },
    bgFade:    { base: 0.15,min: 0,   max: 1,             mod: { source: "" } },
});

export function drawArcDischarge(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const prevB  = extra?._prevB ?? 0;
    if (extra) extra._prevB = bass;

    const nBolts  = Math.round(Math.max(1, p.bolts ?? 6));
    const depth   = Math.round(Math.max(3, Math.min(10, p.depth ?? 7)));
    const rough   = p.roughness ?? 0.55;
    const hue     = p.hue ?? 195;
    const hueSpd  = p.hueSpread ?? 60;
    const glow    = p.glow ?? 0.7;
    const ax      = (p.anchorX ?? 0.5) * w;
    const ay      = (p.anchorY ?? 0.5) * h;
    const rateHz  = p.rateHz ?? 12;
    const energy  = p.energy ?? 0.5;
    const bgFade  = p.bgFade ?? 0.15;

    let st = _st.get(ctx);
    if (!st) { st = { seed: 0, nextRegen: 0, cache: [] }; _st.set(ctx, st); }

    const bassHit = bass > 0.6 && bass > prevB + 0.1;
    if (t >= st.nextRegen || bassHit) {
        st.seed = (st.seed + 7) ^ (Date.now() & 0xffff);
        st.nextRegen = t + (bassHit ? 0.04 : 1 / rateHz);

        const rng = makeRng(st.seed);
        st.cache = [];
        const diag = Math.sqrt(w*w + h*h);
        const extraBolts = bassHit ? Math.round(nBolts * energy) : 0;
        const total = nBolts + extraBolts;

        for (let b = 0; b < total; b++) {
            // Random endpoint on screen boundary
            const side = Math.floor(rng() * 4);
            let tx, ty;
            if (side === 0)      { tx = rng()*w;  ty = 0; }
            else if (side === 1) { tx = w;          ty = rng()*h; }
            else if (side === 2) { tx = rng()*w;  ty = h; }
            else                  { tx = 0;          ty = rng()*h; }

            const pts = [];
            bolt(pts, ax, ay, tx, ty, depth, rough * (0.7 + rng()*0.6), rng, 512);
            const bHue = (hue + b / total * hueSpd - hueSpd/2 + 360) % 360;
            st.cache.push({ pts, hue: bHue, alpha: 0.6 + rng()*0.4 });
        }
    }

    // Draw background fade
    if (bgFade > 0.005) {
        ctx.fillStyle = `rgba(0,0,0,${bgFade})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    // Batch all bolts into a small number of stroke calls grouped by hue bucket.
    // Avoids per-bolt shadowBlur recomputation (the main perf cost).
    const glowPx = glow * 16 * (1 + bass * 0.5);
    const N_GROUPS = Math.min(3, st.cache.length);
    const groupSize = Math.ceil(st.cache.length / Math.max(1, N_GROUPS));
    ctx.lineWidth = 0.8 + glow;
    for (let g = 0; g < N_GROUPS; g++) {
        const mid = st.cache[Math.min(g * groupSize + (groupSize >> 1), st.cache.length - 1)];
        ctx.shadowBlur = glowPx;
        ctx.shadowColor = `hsl(${mid.hue},100%,75%)`;
        ctx.strokeStyle = `hsla(${mid.hue},90%,82%,${mid.alpha})`;
        ctx.beginPath();
        const end = Math.min((g + 1) * groupSize, st.cache.length);
        for (let b = g * groupSize; b < end; b++) {
            const { pts } = st.cache[b];
            for (let i = 0; i < pts.length; i += 4) {
                ctx.moveTo(pts[i], pts[i+1]);
                ctx.lineTo(pts[i+2], pts[i+3]);
            }
        }
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
}
