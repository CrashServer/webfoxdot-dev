// ── Shapes ────────────────────────────────────────────────────────────────────
// Multi-ring polygon system: nested shapes, trail fade, bass size-reactivity,
// per-ring orbital & rotation speed, explode mode on beat, sides per ring.

const _state = new WeakMap();

// Radial gradient sprite cache for fillMode>1.5 polygon fills
const _shapeGradCache = new Map();
function _shapeGradSprite(hue, sat) {
    const hb = Math.round(hue / 15) * 15;
    const sb = Math.round(sat / 10) * 10;
    const key = `${hb}_${sb}`;
    if (_shapeGradCache.has(key)) return _shapeGradCache.get(key);
    const sz = 64;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${(hb+40)%360},100%,82%)`);
    g.addColorStop(1, `hsla(${hb},${sb}%,28%,0.2)`);
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _shapeGradCache.set(key, gc);
    return gc;
}

export const shapesParams = () => ({
    count:       { base: 8,   min: 1,    max: 36,  mod: { source: "" } },
    rings:       { base: 3,   min: 1,    max: 6,   mod: { source: "" } },
    sides:       { base: 6,   min: 3,    max: 20,  mod: { source: "" } },
    sidesStep:   { base: 1,   min: 0,    max: 4,   mod: { source: "" } },
    size:        { base: 45,  min: 4,    max: 200, mod: { source: "" } },
    radius:      { base: 180, min: 0,    max: 500, mod: { source: "" } },
    spinSpeed:   { base: 0.5, min: -5,   max: 5,   mod: { source: "" } },
    orbitSpeed:  { base: 0.3, min: -4,   max: 4,   mod: { source: "" } },
    hue:         { base: 40,  min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 200, min: 0,    max: 360, mod: { source: "" } },
    sat:         { base: 90,  min: 0,    max: 100, mod: { source: "" } },
    fillMode:    { base: 0.5, min: 0,    max: 2,   mod: { source: "" } },
    glow:        { base: 1.2, min: 0,    max: 5,   mod: { source: "" } },
    bassReact:   { base: 1.8, min: 0,    max: 5,   mod: { source: "" } },
    explode:     { base: 1,   min: 0,    max: 4,   mod: { source: "" } },
    fade:        { base: 0.1, min: 0.02, max: 0.8, mod: { source: "" } },
    usePalette:  { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
});

function polygonPath(ctx, cx, cy, r, sides, angle) {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
        const a = angle + (i / sides) * Math.PI * 2;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
}

export function drawShapes(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { spinAngle: 0, orbitAngle: 0, pulse: 0, prevBass: 0, explodeT: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const palette = extra?.palette;

    // Beat detection for explode
    if (bass > 0.6 && bass > st.prevBass + 0.1) { st.pulse = 1; st.explodeT = 1; }
    st.prevBass  = bass;
    st.pulse    *= 0.85;
    st.explodeT *= 0.88;

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.spinAngle  += dt * p.spinSpeed  * (1 + treble * 0.6);
    st.orbitAngle += dt * p.orbitSpeed * (1 + mid * 0.5);

    const cx = w / 2, cy = h / 2;
    const count    = Math.max(1, Math.round(p.count));
    const rings    = Math.max(1, Math.round(p.rings));
    const baseSides = Math.max(3, Math.round(p.sides + mid * 2));
    const nBins    = sp ? sp.length : 0;
    const fillMode = p.fillMode;

    for (let ring = 0; ring < rings; ring++) {
        const ringFrac     = rings > 1 ? ring / (rings - 1) : 0;
        const ringRadius   = p.radius * (0.3 + ringFrac * 0.7);
        const ringSize     = p.size * (1.1 - ringFrac * 0.4);
        const ringHueBase  = (p.hue + ringFrac * p.hueSpread) % 360;
        // Alternating orbit direction per ring
        const orbitDir     = ring % 2 === 0 ? 1 : -0.75;
        const orbitOff     = st.orbitAngle * orbitDir + ring * 0.22;
        // Inner rings spin faster
        const spinDir      = ring % 2 === 0 ? 1 : -1.2;
        const ringSpinBase = st.spinAngle * (1 + ring * 0.35) * spinDir;
        // Sides increase per ring
        const ringsSides   = Math.max(3, Math.round(baseSides + ring * p.sidesStep));

        for (let i = 0; i < count; i++) {
            const frac2  = i / count;
            const orbitA = (frac2) * Math.PI * 2 + orbitOff;

            // Explode: push shapes radially outward on beat
            const explodeR = ringRadius + st.explodeT * p.explode * Math.min(w, h) * 0.25;
            const sx = cx + explodeR * Math.cos(orbitA);
            const sy = cy + explodeR * Math.sin(orbitA);

            const binIdx = nBins ? Math.floor((frac2 * 0.6 + ringFrac * 0.25) * nBins) : 0;
            const binVal = nBins ? Math.min(1, (sp[binIdx] ?? 0) * 1.6) : 0;
            const shapeHue = (ringHueBase + frac2 * p.hueSpread * 0.5 + mid * 25) % 360;
            const spinA  = orbitA + ringSpinBase * (1 + ring * 0.2) + (i % 2 === 0 ? 0 : Math.PI);

            const sizeScaled = ringSize * (0.55 + binVal * 0.75 + bass * p.bassReact * 0.35 * (1 - ringFrac * 0.4));
            const bright = 45 + binVal * 38 + bass * 14 + st.pulse * 12;
            const alpha  = 0.65 + binVal * 0.35;
            let color;
            if (_pal) {
                color = pC(rings > 1 ? ring / (rings - 1) : 0);
            } else if (palette && palette.length > 0) {
                color = palette[(i + ring * Math.ceil(count / 2)) % palette.length];
            } else {
                color = `hsla(${shapeHue},${p.sat}%,${bright}%,${alpha})`;
            }

            // Draw outer shape
            drawPolygon(ctx, sx, sy, sizeScaled / 2, ringsSides, spinA, fillMode, color, shapeHue, p.sat, bright, alpha, binVal, bass, p.glow);

            // Nested inner shape (half size, complementary color)
            if (ring < 2 && sizeScaled > 14) {
                const innerHue = (shapeHue + 120) % 360;
                const innerColor = _pal
                    ? pC(rings > 1 ? ring / (rings - 1) : 0)
                    : palette && palette.length > 0
                    ? palette[(i + 1 + ring) % palette.length]
                    : `hsla(${innerHue},${p.sat}%,${bright - 10}%,${alpha * 0.7})`;
                drawPolygon(ctx, sx, sy, sizeScaled / 4, Math.max(3, ringsSides - 1), -spinA,
                            fillMode, innerColor, innerHue, p.sat, bright - 10, alpha * 0.7, binVal * 0.7, bass, p.glow * 0.6);
            }
        }
    }
}

function drawPolygon(ctx, sx, sy, r, sides, spinA, fillMode, color, hue, sat, bright, alpha, binVal, bass, glow) {
    if (r < 1) return;
    if (glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1 + binVal * 3 + bass * 2;
        ctx.strokeStyle = `hsla(${hue},100%,72%,${0.28 + binVal * 0.4})`;
        polygonPath(ctx, sx, sy, r * 1.06, sides, spinA);
        ctx.stroke();
        ctx.restore();
    }

    if (fillMode < 0.5) {
        // Stroke only
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 + binVal * 2.5;
        polygonPath(ctx, sx, sy, r, sides, spinA);
        ctx.stroke();
    } else if (fillMode > 1.5) {
        // Radial gradient fill — sprite cached per hue/sat bucket, clipped to polygon
        const sp = _shapeGradSprite(hue, sat);
        ctx.save();
        polygonPath(ctx, sx, sy, r, sides, spinA);
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.drawImage(sp, sx - r, sy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        polygonPath(ctx, sx, sy, r, sides, spinA);
        ctx.stroke();
    } else {
        // Stroke + translucent fill
        ctx.fillStyle = `hsla(${hue},${sat}%,${bright - 12}%,${alpha * 0.6})`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 + binVal * 2;
        polygonPath(ctx, sx, sy, r, sides, spinA);
        ctx.fill();
        ctx.stroke();
    }
}
