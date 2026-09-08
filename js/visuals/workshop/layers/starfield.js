// ── Starfield ─────────────────────────────────────────────────────────────────
// Multi-layer parallax starfield with color temperature variation, nebula glow,
// and bass-triggered supernova flash. Three depth planes scroll at different rates.
// Stars are stateless: position is a pure function of index + time.

const h11 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const h21 = (i) => { const x = Math.sin(i * 269.5 + 183.3) * 43758.5453; return x - Math.floor(x); };
const h31 = (i) => { const x = Math.sin(i * 419.2 + 74.1)  * 43758.5453; return x - Math.floor(x); };

const _sfState = new WeakMap();

// Glow halo sprites for bright nearby stars keyed by (hue-bucket, radius-bucket)
const _sfGlowCache = new Map();
function _sfGlow(hue, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(4, Math.round(radius * 2) * 2);
    const key = `${hb}_${rb}`;
    if (_sfGlowCache.has(key)) return _sfGlowCache.get(key);
    const sz = rb;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},80%,90%)`);
    g.addColorStop(1, `hsla(${hb},60%,70%,0)`);
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _sfGlowCache.set(key, gc);
    return gc;
}

export const starfieldParams = () => ({
    count:      { base: 350,  min: 40,   max: 1200, mod: { source: "" } },
    speed:      { base: 0.8,  min: -4,   max: 4,    mod: { source: "" } },
    size:       { base: 2.0,  min: 0.3,  max: 6,    mod: { source: "" } },
    twinkle:    { base: 0.5,  min: 0,    max: 2,    mod: { source: "" } },
    hue:        { base: 200,  min: 0,    max: 360,  mod: { source: "" } },
    saturation: { base: 30,   min: 0,    max: 100,  mod: { source: "" } },
    parallax:   { base: 0.6,  min: 0,    max: 1,    mod: { source: "" } },
    nebulaAmt:  { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } },
    nebulaHue:  { base: 270,  min: 0,    max: 360,  mod: { source: "" } },
    colorTemp:  { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } }, // 0=cool blue, 1=warm orange
    layers:     { base: 3,    min: 1,    max: 3,    mod: { source: "" } },
    supernovaK: { base: 1.0,  min: 0,    max: 2,    mod: { source: "" } },
});

export function drawStarfield(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);

    let st = _sfState.get(ctx);
    if (!st) { st = { flash: 0, prevBass: 0, novaX: w/2, novaY: h/2, bgGrad: null, bgW: 0, bgH: 0, bgHue: -1, nebulaGrads: null, nebulaKey: '' }; _sfState.set(ctx, st); }

    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*2.5) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*2.5) : 0;

    // Supernova flash on bass hit
    if (bass > 0.7 && bass > st.prevBass + 0.15) {
        st.flash = 1.0 * (p.supernovaK);
        st.novaX = w * (0.3 + Math.random() * 0.4);
        st.novaY = h * (0.2 + Math.random() * 0.6);
    }
    st.prevBass = bass;
    st.flash *= 0.88;

    // Deep space background — cache gradient (only depends on w,h,nebulaHue)
    if (!st.bgGrad || st.bgW !== w || st.bgH !== h || st.bgHue !== p.nebulaHue) {
        st.bgGrad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
        st.bgGrad.addColorStop(0, `hsla(${p.nebulaHue},40%,8%,1)`);
        st.bgGrad.addColorStop(1, `hsl(220,20%,2%)`);
        st.bgW = w; st.bgH = h; st.bgHue = p.nebulaHue;
    }
    ctx.fillStyle = st.bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Nebula glow blobs — cache 4 gradients (depend on w,h,nebulaHue,nebulaAmt)
    if (p.nebulaAmt > 0.01) {
        const nebulaKey = `${w}_${h}_${Math.round(p.nebulaHue)}_${Math.round(p.nebulaAmt*100)}`;
        if (st.nebulaKey !== nebulaKey) {
            st.nebulaGrads = [];
            for (let ni = 0; ni < 4; ni++) {
                const nx = w * (0.2 + h11(ni*7)*0.6);
                const ny = h * (0.15 + h21(ni*7)*0.7);
                const nr = Math.min(w,h) * (0.15 + h31(ni*7)*0.25);
                const nh = (p.nebulaHue + ni * 55) % 360;
                const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
                ng.addColorStop(0,   `hsla(${nh},80%,35%,${p.nebulaAmt*0.18})`);
                ng.addColorStop(0.5, `hsla(${nh+20},70%,25%,${p.nebulaAmt*0.08})`);
                ng.addColorStop(1,   `hsla(${nh},60%,10%,0)`);
                st.nebulaGrads.push({ nx, ny, nr, g: ng });
            }
            st.nebulaKey = nebulaKey;
        }
        ctx.globalCompositeOperation = "lighter";
        for (const nb of st.nebulaGrads) {
            ctx.fillStyle = nb.g;
            ctx.beginPath(); ctx.arc(nb.nx, nb.ny, nb.nr, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
    }

    // Supernova flash
    if (st.flash > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        const nr = Math.min(w,h) * 0.5 * st.flash;
        const ng = ctx.createRadialGradient(st.novaX, st.novaY, 0, st.novaX, st.novaY, nr);
        ng.addColorStop(0,   `rgba(255,240,200,${st.flash*0.9})`);
        ng.addColorStop(0.1, `rgba(255,180,80,${st.flash*0.5})`);
        ng.addColorStop(0.4, `rgba(180,80,255,${st.flash*0.15})`);
        ng.addColorStop(1,   `rgba(0,0,0,0)`);
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(st.novaX, st.novaY, nr, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }

    const n      = Math.max(1, Math.round(p.count));
    const cx     = w / 2, cy = h / 2;
    const maxR   = Math.max(w, h) * 0.78;
    const nLayers = Math.max(1, Math.min(3, Math.round(p.layers)));
    const plx    = p.parallax;
    const hue    = p.hue;
    const sat    = p.saturation;
    const temp   = p.colorTemp; // 0=blue-white, 1=warm-orange

    ctx.globalCompositeOperation = "lighter";
    const perLayer = Math.ceil(n / nLayers);
    for (let layer = 0; layer < nLayers; layer++) {
        const depthScale  = (layer + 1) / nLayers;        // 0.33..1  — foreground is deeper
        const speedMul    = 1 - plx * (1 - depthScale);   // farther layers move slower
        const flightSpeed = maxR * p.speed * 0.35 * speedMul;
        const layerOff    = layer * 1337;

        for (let i = 0; i < perLayer; i++) {
            const idx   = i + layer * perLayer;
            const angle = h11(idx) * Math.PI * 2;
            const seedR = h21(idx) * maxR;
            const r     = ((seedR + t * flightSpeed) % maxR + maxR) % maxR;
            const x     = cx + Math.cos(angle) * r;
            const y     = cy + Math.sin(angle) * r;
            const depth = r / maxR;

            const twinkle = 1 + p.twinkle * Math.sin(t * (3 + h31(idx)*4) + idx * 12.9) * (0.5 + treble*0.5);
            const size    = Math.max(0.15, p.size * depthScale * depth * twinkle * (1 + bass*0.3));
            const alpha   = Math.min(1, depth * 1.8 * depthScale);

            // Color temperature: cool = blue tint, warm = orange tint
            const starHue  = h31(idx) < temp
                ? (hue + (1-temp)*40 + 180 + h11(idx+999)*30) % 360  // warm stars
                : (hue + h11(idx+500)*40) % 360;                       // cool stars
            const starSat  = sat + (1 - depth) * 20;

            ctx.fillStyle = `hsla(${starHue},${starSat}%,${85+depth*15}%,${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI*2);
            ctx.fill();

            // Glow halo for bright nearby stars — cached sprite avoids per-star gradient
            if (size > 1.5 && depth > 0.7) {
                const gs = _sfGlow(starHue, size * 4);
                ctx.globalAlpha = alpha * 0.4;
                ctx.drawImage(gs, x - gs.width/2, y - gs.height/2);
                ctx.globalAlpha = 1;
            }
        }
    }
    ctx.globalCompositeOperation = "source-over";
}
