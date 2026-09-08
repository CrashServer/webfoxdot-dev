// ── Sand Dune ─────────────────────────────────────────────────────────────────
// Procedural wind-sculpted sand dunes with a sunset/night sky backdrop.
// Audio: bass pushes dune waves; treble shifts the sky hue toward aurora.

const _st = new WeakMap();

function noise1(x) {
    const xi = Math.floor(x) & 0xff;
    const xf = x - Math.floor(x);
    const u  = xf * xf * (3 - 2 * xf);
    const a  = Math.sin(xi * 127.1) * 43758.5453;
    const b  = Math.sin((xi + 1) * 127.1) * 43758.5453;
    return (a - Math.floor(a)) * (1 - u) + (b - Math.floor(b)) * u;
}

function fbm(x, oct) {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < oct; i++) { v += noise1(x * freq) * amp; amp *= 0.5; freq *= 2.1; }
    return v;
}

export const sandDuneParams = () => ({
    layers:   { base: 5,    min: 2,   max: 8,  step: 1, mod: { source: "" } }, // dune layers
    hue:      { base: 30,   min: 0,   max: 360,          mod: { source: "" } }, // sand hue
    skyHue:   { base: 200,  min: 0,   max: 360,          mod: { source: "" } },
    windSpeed:{ base: 0.15, min: 0,   max: 1,            mod: { source: "" } },
    amplitude:{ base: 0.12, min: 0,   max: 0.35,         mod: { source: "" } }, // dune height fraction
    octaves:  { base: 4,    min: 1,   max: 6,   step: 1, mod: { source: "" } },
    stars:    { base: 100,  min: 0,   max: 400, step:10, mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawSandDune(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nLayers = Math.round(Math.max(2, Math.min(8, p.layers ?? 5)));
    const hue      = p.hue ?? 30;
    const skyHue   = ((p.skyHue ?? 200) + treble * 30) % 360;
    const windSpd  = p.windSpeed ?? 0.15;
    const amp      = (p.amplitude ?? 0.12) * (1 + bass * (p.pulse ?? 0.4) * 0.4);
    const octaves  = Math.round(Math.max(1, Math.min(6, p.octaves ?? 4)));
    const nStars   = Math.round(p.stars ?? 100);
    const bgAlpha  = p.bgAlpha ?? 1;

    let st = _st.get(ctx);
    if (!st) {
        const starArr = Array.from({ length: 400 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h * 0.6,
            r: Math.random() * 1.2 + 0.2,
            br: Math.random(),
        }));
        st = { stars: starArr };
        _st.set(ctx, st);
    }

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,   `hsla(${skyHue},70%,8%,${bgAlpha})`);
    sky.addColorStop(0.5, `hsla(${(skyHue+20)%360},60%,20%,${bgAlpha})`);
    sky.addColorStop(1,   `hsla(${hue},50%,35%,${bgAlpha})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars (only in top 60%)
    if (nStars > 0) {
        for (let i = 0; i < Math.min(nStars, 400); i++) {
            const s = st.stars[i];
            const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (2 + s.br * 4) + s.x));
            ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.8})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Dune layers from back to front
    for (let L = nLayers - 1; L >= 0; L--) {
        const frac  = (L + 1) / nLayers;
        const yBase = h * (0.35 + frac * 0.55);
        const lightL= 15 + frac * 35 + treble * 5;
        const sat   = 55 + frac * 25;

        // Shadow/highlight: lighter = top edge, darker = trough
        const topColor = `hsl(${hue},${sat}%,${lightL + 18}%)`;
        const botColor = `hsl(${hue},${sat}%,${lightL - 8}%)`;

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2) {
            const fx = x / w;
            const scroll = t * windSpd * (0.5 + frac * 0.5);
            const y = yBase - h * amp * (0.4 + 0.6 * frac)
                    * fbm(fx * (2 + frac * 3) + scroll, octaves);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();

        const grad = ctx.createLinearGradient(0, yBase - h * amp, 0, h);
        grad.addColorStop(0, topColor);
        grad.addColorStop(0.3, botColor);
        grad.addColorStop(1, botColor);
        ctx.fillStyle = grad;
        ctx.fill();
    }
}
