// ── Ice Cave ─────────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION IceCaveScene (Europa-inspired).
// Layered arc formations, bioluminescent crystal spires, alien drip geometry.
// Bass = shockwave pulse. Mid = crystal growth. Treble = particle spray.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const _iceCrystalCache = new Map();
function _iceCrystalSprite(hue, treble) {
    const hb = Math.round(hue / 20) * 20;
    const tb = Math.round(treble * 4); // 5 buckets
    const key = `${hb}_${tb}`;
    if (_iceCrystalCache.has(key)) return _iceCrystalCache.get(key);
    const lit = 65 + tb * 6.25; // maps tb 0-4 → 65-90
    const gc = new OffscreenCanvas(1, 64);
    const gx = gc.getContext('2d');
    const g = gx.createLinearGradient(0, 0, 0, 64); // top=tip → bottom=base
    g.addColorStop(0,   `hsla(${hb},90%,${lit}%,0.9)`);
    g.addColorStop(0.4, `hsla(${hb},70%,40%,0.4)`);
    g.addColorStop(1,   `hsla(${hb},50%,20%,0)`);
    gx.fillStyle = g; gx.fillRect(0, 0, 1, 64);
    _iceCrystalCache.set(key, gc);
    return gc;
}

function noise2(x, y, t) {
    return Math.sin(x * 1.9 + t * 0.4) * Math.cos(y * 2.1 - t * 0.3)
         * Math.sin((x + y) * 0.9 + t * 0.6);
}

export const iceCaveParams = () => ({
    hue:      { base: 185,  min: 0,   max: 360,          mod: { source: "" } }, // ice blue
    hue2:     { base: 270,  min: 0,   max: 360,          mod: { source: "" } }, // alien purple
    pulse:    { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    depth:    { base: 6,    min: 2,   max: 12, step: 1,  mod: { source: "" } }, // arc layers
    crystals: { base: 8,    min: 2,   max: 20, step: 1,  mod: { source: "" } },
    drift:    { base: 0.3,  min: 0,   max: 1,            mod: { source: "" } }, // parallax drift speed
    glow:     { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    drip:     { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } }, // stalactite drips
    particles:{ base: 0.6,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.92, min: 0,   max: 1,            mod: { source: "" } },
    fog:      { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawIceCave(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue       = p.hue ?? 185;
    const hue2      = p.hue2 ?? 270;
    const pulse     = p.pulse ?? 0.7;
    const nLayers   = Math.round(Math.max(2, Math.min(12, p.depth ?? 6)));
    const nCrystals = Math.round(Math.max(2, Math.min(20, p.crystals ?? 8)));
    const drift     = p.drift ?? 0.3;
    const glow      = p.glow ?? 0.8;
    const showDrip  = (p.drip ?? 0.5) > 0.1;
    const showPart  = (p.particles ?? 0.6) > 0.1;
    const bgAlpha   = p.bgAlpha ?? 0.92;
    const fog       = p.fog ?? 0.4;

    let st = _st.get(ctx);
    if (!st) {
        const particles = [];
        st = { particles, shockwave: 0, prevBass: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Bass hit → shockwave
    if (bass > 0.45 && bass > st.prevBass + 0.08) {
        st.shockwave = bass * pulse;
        if (showPart) {
            const spray = Math.ceil(bass * pulse * 20);
            for (let i = 0; i < spray; i++) {
                const ang = Math.random() * TAU;
                const spd = 60 + Math.random() * 200;
                st.particles.push({
                    x: w/2 + (Math.random()-0.5)*w*0.5,
                    y: h/2 + (Math.random()-0.5)*h*0.5,
                    vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
                    life: 0.8+Math.random()*0.4,
                    hue: Math.random()>0.5 ? hue : hue2
                });
            }
        }
    }
    st.prevBass = bass;
    st.shockwave *= 0.92;

    ctx.fillStyle = `rgba(0,0,4,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Background gradient (deep ice)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, `hsla(${hue},40%,${4+mid*6}%,1)`);
    bg.addColorStop(0.5, `hsla(${hue2},30%,${2+bass*4}%,1)`);
    bg.addColorStop(1, `hsla(${hue},50%,${3+mid*8}%,1)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Layered cave arc formations (ceiling + floor)
    for (let layer = 0; layer < nLayers; layer++) {
        const frac = layer / nLayers;
        const layerDrift = drift * frac * 0.15;
        const driftX = Math.sin(t * layerDrift + layer * 1.3) * w * 0.04 * frac;
        const driftY = Math.cos(t * layerDrift * 0.7 + layer * 0.9) * h * 0.02 * frac;

        const alpha = (0.12 + frac * 0.25) * (0.7 + mid * 0.3);
        const lHue  = hue + (hue2 - hue) * frac;
        const depth = 3 + Math.floor(frac * 5);

        if (glow > 0.05) {
            ctx.shadowBlur = glow * (6 + frac * 15);
            ctx.shadowColor = `hsl(${lHue},80%,60%)`;
        }
        ctx.strokeStyle = `hsla(${lHue},${60+frac*20}%,${30+frac*30}%,${alpha})`;
        ctx.lineWidth = 0.5 + frac * 1.5;

        // Ceiling arc
        const ceilY = h * (-0.1 + frac * 0.4);
        const rad   = w * (0.6 + frac * 0.5) * (1 + bass * pulse * 0.08);
        const noiseOff = noise2(layer * 0.5, frac, t * 0.1) * h * 0.06;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
            const ang = (x / w - 0.5) * Math.PI * 1.2;
            const ny = ceilY + noiseOff + Math.cos(ang) * rad * 0.35
                     + noise2(x * 0.01 + layer, frac + t*0.05, t*0.08) * h * 0.04;
            if (x === 0) ctx.moveTo(x + driftX, ny + driftY);
            else ctx.lineTo(x + driftX, ny + driftY);
        }
        ctx.stroke();

        // Floor arc (mirrored)
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
            const ang = (x / w - 0.5) * Math.PI * 1.2;
            const ny = h - (ceilY + noiseOff + Math.cos(ang) * rad * 0.3
                     + noise2(x * 0.01 + layer + 5, frac + t*0.05, t*0.06) * h * 0.03);
            if (x === 0) ctx.moveTo(x + driftX, ny - driftY);
            else ctx.lineTo(x + driftX, ny - driftY);
        }
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── Crystal spires (from floor and ceiling)
    for (let i = 0; i < nCrystals; i++) {
        const cx = (i / nCrystals + 0.5 / nCrystals) * w;
        const cHue = (hue + (i * 37 % 90)) % 360;
        const height = h * (0.12 + Math.sin(i * 1.7) * 0.08) * (0.7 + mid * 0.5 + i % 2 * 0.3);
        const width  = 6 + Math.sin(i * 2.3) * 4;
        const sway   = Math.sin(t * drift * 0.5 + i * 0.8) * 4 * drift;

        const glowAmt = glow * (0.5 + treble * 0.5 + bass * pulse * 0.3);
        if (glowAmt > 0.05) {
            ctx.shadowBlur = glowAmt * 25;
            ctx.shadowColor = `hsl(${cHue},90%,70%)`;
        }

        // Floor spire (pointing up)
        ctx.fillStyle = `hsla(${cHue},70%,${20+mid*20}%,0.7)`;
        ctx.beginPath();
        ctx.moveTo(cx + sway - width, h);
        ctx.lineTo(cx + sway, h - height);
        ctx.lineTo(cx + sway + width, h);
        ctx.closePath(); ctx.fill();
        // Crystal highlight edge
        ctx.strokeStyle = `hsla(${cHue},90%,${55+treble*30}%,0.8)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + sway, h - height);
        ctx.lineTo(cx + sway - width * 0.6, h);
        ctx.stroke();

        // Ceiling stalactite (every other)
        if (i % 2 === 0) {
            const ch2 = height * 0.7;
            const cw2 = width * 0.7;
            ctx.fillStyle = `hsla(${(cHue+40)%360},60%,${15+mid*15}%,0.6)`;
            ctx.beginPath();
            ctx.moveTo(cx - sway - cw2, 0);
            ctx.lineTo(cx - sway, ch2);
            ctx.lineTo(cx - sway + cw2, 0);
            ctx.closePath(); ctx.fill();

            if (showDrip) {
                const dripY = ch2 + Math.sin(t * 1.5 + i) * 8;
                ctx.fillStyle = `hsla(${cHue},80%,70%,${0.4+mid*0.4})`;
                ctx.beginPath(); ctx.arc(cx - sway, dripY, 2+mid*2, 0, TAU); ctx.fill();
            }
        }

        // Crystal glow core — sprite scales to crystal height
        const csp = _iceCrystalSprite(cHue, treble);
        ctx.drawImage(csp, 0, 0, 1, 64, cx - 1, h - height, 2, height);
    }
    ctx.shadowBlur = 0;

    // ── Particles
    for (const pk of st.particles) {
        pk.x += pk.vx * dt; pk.y += pk.vy * dt;
        pk.vy += 30 * dt; // slight gravity
        pk.life -= dt * 1.5;
        const a = Math.max(0, pk.life);
        ctx.fillStyle = `hsla(${pk.hue},90%,75%,${a})`;
        ctx.beginPath(); ctx.arc(pk.x, pk.y, 1.5, 0, TAU); ctx.fill();
    }
    st.particles = st.particles.filter(pk => pk.life > 0);

    // ── Shockwave ring
    if (st.shockwave > 0.05) {
        const r = (1 - st.shockwave) * Math.min(w, h) * 0.6;
        ctx.strokeStyle = `hsla(${hue},90%,70%,${st.shockwave * 0.5})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = glow * 20; ctx.shadowColor = `hsl(${hue},100%,70%)`;
        ctx.beginPath(); ctx.arc(w/2, h/2, r, 0, TAU); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ── Fog vignette
    if (fog > 0.05) {
        const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.15, w/2, h/2, Math.min(w,h)*0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `hsla(${hue},30%,${3+mid*5}%,${fog})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
    }
}
