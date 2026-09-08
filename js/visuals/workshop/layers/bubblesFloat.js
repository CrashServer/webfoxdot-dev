// ── Bubbles Float ─────────────────────────────────────────────────────────────
// Iridescent soap bubbles drifting upward.  Bass spawns new bubbles; treble
// shifts the rainbow sheen phase.  Each bubble has a specular highlight ring.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Cached specular highlight sprites (white → transparent, position-offset).
// The body iridescent gradient must remain per-bubble (continuously shifting hue),
// but the specular is always the same white highlight — just scales with radius.
const _hiCache = new Map();
function _hiSprite(radius) {
    const rb = Math.max(8, Math.round(radius / 5) * 5);
    if (_hiCache.has(rb)) return _hiCache.get(rb);
    const sz = rb * 2;
    const off = sz * 0.35;  // matches original cx - r*0.35 offset within sprite
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2 - off, sz/2 - off, 0, sz/2 - off, sz/2 - off, sz * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _hiCache.set(rb, gc);
    return gc;
}

function lcg(s) { return (s * 1664525 + 1013904223) & 0x7fffffff; }

export const bubblesFloatParams = () => ({
    count:    { base: 30,   min: 5,   max: 80,  step: 5, mod: { source: "" } },
    minR:     { base: 15,   min: 5,   max: 60,           mod: { source: "" } },
    maxR:     { base: 60,   min: 10,  max: 150,          mod: { source: "" } },
    speed:    { base: 0.5,  min: 0.1, max: 3,            mod: { source: "" } },
    wobble:   { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } },
    hueShift: { base: 0,    min: 0,   max: 360,          mod: { source: "" } },
    opacity:  { base: 0.25, min: 0.05,max: 0.8,          mod: { source: "" } },
    glow:     { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.1,  min: 0,   max: 1,            mod: { source: "" } },
});

function makeBubble(w, h, minR, maxR, seed) {
    seed = lcg(seed);
    const r = minR + (seed / 0x7fffffff) * (maxR - minR);
    seed = lcg(seed);
    const x = r + (seed / 0x7fffffff) * (w - 2 * r);
    seed = lcg(seed);
    const y = h + r + (seed / 0x7fffffff) * h * 0.5;
    seed = lcg(seed);
    const vx = (seed / 0x7fffffff - 0.5) * 0.4;
    seed = lcg(seed);
    const hOff = (seed / 0x7fffffff) * 360;
    seed = lcg(seed);
    const wPhase = seed / 0x7fffffff * TAU;
    return { x, y, r, vx, hOff, wPhase, seed };
}

export function drawBubblesFloat(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const maxCount= Math.round(Math.max(5, Math.min(80, p.count ?? 30)));
    const minR    = Math.max(5, p.minR ?? 15);
    const maxR    = Math.max(minR + 1, p.maxR ?? 60);
    const speed   = (p.speed ?? 0.5) * (1 + treble * 0.2);
    const wobble  = p.wobble ?? 0.4;
    const hShift  = p.hueShift ?? 0;
    const opacity = p.opacity ?? 0.25;
    const glow    = p.glow ?? 0.4;
    const pulse   = p.pulse ?? 0.5;
    const bgAlpha = p.bgAlpha ?? 0.1;

    let st = _st.get(ctx);
    if (!st) {
        let seed = 42;
        const bubbles = [];
        for (let i = 0; i < maxCount; i++) {
            seed = lcg(seed);
            // scatter initial Y across entire canvas height
            const b = makeBubble(w, h, minR, maxR, seed);
            b.y = (seed / 0x7fffffff) * h;
            bubbles.push(b);
            seed = b.seed;
        }
        st = { bubbles, seed, lastBass: 0 };
        _st.set(ctx, st);
    }

    // Spawn extra on bass hit
    if (bass > 0.6 && bass > st.lastBass + 0.1 && st.bubbles.length < maxCount + 10) {
        st.seed = lcg(st.seed);
        st.bubbles.push(makeBubble(w, h, minR, maxR * (1 + bass * pulse), st.seed));
    }
    st.lastBass = bass;

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    for (let i = st.bubbles.length - 1; i >= 0; i--) {
        const b = st.bubbles[i];
        b.y -= speed * 40 * dt * (1 + bass * pulse * 0.4);
        b.x += b.vx * wobble * 30 * dt + Math.sin(t * 0.7 + b.wPhase) * wobble * 0.4;

        // Remove if off top
        if (b.y < -b.r * 2) {
            st.seed = lcg(st.seed);
            st.bubbles[i] = makeBubble(w, h, minR, maxR, st.seed);
            st.bubbles[i].y = h + b.r;
            st.seed = st.bubbles[i].seed;
            continue;
        }

        const cx = b.x, cy = b.y, r = b.r;
        const hue = (b.hOff + hShift + t * 20 + treble * 40) % 360;

        if (glow > 0.05) {
            ctx.shadowBlur = glow * 10;
            ctx.shadowColor = `hsl(${hue},100%,70%)`;
        }

        // Rainbow iridescent fill
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
        grad.addColorStop(0,   `hsla(${hue},80%,95%,${opacity * 0.6})`);
        grad.addColorStop(0.4, `hsla(${(hue+60)%360},90%,60%,${opacity * 0.4})`);
        grad.addColorStop(0.75,`hsla(${(hue+180)%360},90%,50%,${opacity * 0.5})`);
        grad.addColorStop(1,   `hsla(${(hue+270)%360},80%,40%,${opacity * 0.7})`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

        // Rim
        ctx.strokeStyle = `hsla(${hue},85%,80%,0.6)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

        // Specular highlight — cached white sprite, avoids per-bubble gradient
        ctx.shadowBlur = 0;
        const hs = _hiSprite(r);
        ctx.drawImage(hs, cx - r, cy - r, hs.width, hs.height);
    }

    ctx.shadowBlur = 0;
}
