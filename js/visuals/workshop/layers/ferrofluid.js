// ── Ferrofluid layer ───────────────────────────────────────────────────────
// N spikes along an edge driven by spectrum bands. Filled fluid shape with
// gradient, glow, spike tips, and detaching droplets.

const _state = new WeakMap();

function audioLevel(s) { if (!s?.length) return 0; let v=0; for(let i=0;i<s.length;i++) v+=s[i]; return Math.min(1, v/s.length*3); }
function bassLevel(s)  { if (!s?.length) return 0; const n=Math.max(1,s.length*.18|0); let v=0; for(let i=0;i<n;i++) v+=s[i]; return Math.min(1, v/n*3); }
function trebleLevel(s){ if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

// Cubic interpolation between four points (Catmull-Rom)
function cubicInterp(p0, p1, p2, p3, t2) {
    return 0.5 * (
        2*p1 +
        (-p0+p2)*t2 +
        (2*p0 - 5*p1 + 4*p2 - p3) * t2*t2 +
        (-p0 + 3*p1 - 3*p2 + p3) * t2*t2*t2
    );
}

function getSpikeHeights(spectrum, numSpikes, maxH, heightScale, bass, treble, time, speed) {
    const heights = new Float32Array(numSpikes);
    const bands   = spectrum ? spectrum.length : 0;
    const bassBoost = bass * 0.3;
    const trebleRipple = treble * 0.12;

    for (let i = 0; i < numSpikes; i++) {
        const band  = Math.min(bands - 1, Math.floor(i / numSpikes * bands)) | 0;
        const sv    = spectrum ? spectrum[band] : 0;
        // Add treble ripple across surface
        const ripple = trebleRipple * Math.sin(i * 0.7 + time * speed * 3);
        heights[i]  = (sv + bassBoost + ripple) * maxH * heightScale;
    }
    return heights;
}

function interpSurface(heights, numSpikes, x, w) {
    // Get height at fractional x position (0..w) using Catmull-Rom between spike nodes
    const t2    = x / w * (numSpikes - 1);
    const i     = Math.floor(t2);
    const frac  = t2 - i;
    const p0 = heights[Math.max(0, i-1)];
    const p1 = heights[i];
    const p2 = heights[Math.min(numSpikes-1, i+1)];
    const p3 = heights[Math.min(numSpikes-1, i+2)];
    return Math.max(0, cubicInterp(p0, p1, p2, p3, frac));
}

export const ferrofluidParams = () => ({
    hue:      { base: 180, min: 0,    max: 360, mod: { source: "" } },
    spikes:   { base: 24,  min: 8,    max: 48,  mod: { source: "" } },
    height:   { base: 0.6, min: 0.1,  max: 1,   mod: { source: "" } },
    speed:    { base: 1,   min: 0,    max: 3,   mod: { source: "" } },
    glow:     { base: 2,   min: 0,    max: 4,   mod: { source: "" } },
    position: { base: 1,   min: 0,    max: 1,   mod: { source: "" } },
});

export function drawFerrofluid(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, droplets: [], lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const spectrum   = extra?.spectrum;
    const level      = audioLevel(spectrum);
    const bass       = bassLevel(spectrum);
    const treble     = trebleLevel(spectrum);
    const hue        = p.hue      ?? 180;
    const numSpikes  = Math.max(8, Math.min(48, Math.round(p.spikes ?? 24)));
    const heightPct  = p.height   ?? 0.6;
    const speed      = p.speed    ?? 1;
    const glowVal    = p.glow     ?? 2;
    const position   = p.position ?? 1;  // 0=top, 1=bottom

    const isBottom   = position >= 0.5;
    const baseH      = h * 0.1;          // min fluid thickness
    const maxSpike   = h * 0.85 - baseH; // max spike amplitude

    // Background
    ctx.fillStyle = `hsl(${hue},15%,4%)`;
    ctx.fillRect(0, 0, w, h);

    // Spike heights
    const spikeH = getSpikeHeights(spectrum, numSpikes, maxSpike, heightPct, bass, treble, st.time, speed);

    // Sample 256 x-positions across canvas
    const SAMPLES = 256;
    const xs   = new Float32Array(SAMPLES);
    const ys   = new Float32Array(SAMPLES);

    for (let xi = 0; xi < SAMPLES; xi++) {
        xs[xi] = (xi / (SAMPLES-1)) * w;
        ys[xi] = interpSurface(spikeH, numSpikes, xs[xi], w);
    }

    // Build fluid path
    ctx.save();

    // Gradient from edge (bright) to body (dark)
    const gradY0 = isBottom ? h - baseH - maxSpike : baseH + maxSpike;
    const gradY1 = isBottom ? h                    : 0;
    const grad   = ctx.createLinearGradient(0, gradY0, 0, gradY1);
    grad.addColorStop(0, `hsl(${hue},90%,60%)`);
    grad.addColorStop(0.3, `hsl(${hue},70%,25%)`);
    grad.addColorStop(1, `hsl(${hue},70%,10%)`);

    ctx.shadowBlur = 0;
    ctx.fillStyle   = grad;

    ctx.beginPath();
    if (isBottom) {
        ctx.moveTo(0, h);
        ctx.lineTo(0, h - baseH - ys[0]);
        for (let xi = 1; xi < SAMPLES; xi++) {
            ctx.lineTo(xs[xi], h - baseH - ys[xi]);
        }
        ctx.lineTo(w, h);
    } else {
        ctx.moveTo(0, 0);
        ctx.lineTo(0, baseH + ys[0]);
        for (let xi = 1; xi < SAMPLES; xi++) {
            ctx.lineTo(xs[xi], baseH + ys[xi]);
        }
        ctx.lineTo(w, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Spike tips (circles at each spike peak)
    ctx.save();
    ctx.fillStyle   = `hsl(${hue},100%,75%)`;
    ctx.shadowBlur = 0;
    for (let i = 0; i < numSpikes; i++) {
        const sx = (i + 0.5) / numSpikes * w;
        const sy = isBottom ? h - baseH - spikeH[i] : baseH + spikeH[i];
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + spikeH[i] / maxSpike * 3, 0, Math.PI*2);
        ctx.fill();

        // Spawn droplet when spike exceeds 80%
        if (spikeH[i] > maxSpike * 0.8 && Math.random() < 0.04) {
            st.droplets.push({
                x: sx + (Math.random()-0.5)*8,
                y: sy,
                vy: isBottom ? -(1 + Math.random()*2) : (1 + Math.random()*2),
                r:  2 + Math.random()*3,
                life: 0,
                maxLife: 40 + Math.random()*40 | 0,
            });
        }
    }
    ctx.restore();

    // Droplets
    const keepDrops = [];
    ctx.save();
    ctx.fillStyle   = `hsl(${hue},90%,70%)`;
    ctx.shadowBlur = 0;
    for (let i = 0; i < st.droplets.length; i++) {
        const d = st.droplets[i];
        d.y    += d.vy;
        d.vy   += isBottom ? -0.05 : 0.05; // gravity pulling back
        d.life++;
        if (d.life < d.maxLife && d.r > 0.3) {
            ctx.globalAlpha = 1 - d.life / d.maxLife;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
            ctx.fill();
            keepDrops.push(d);
        }
    }
    ctx.restore();
    st.droplets = keepDrops;
}
