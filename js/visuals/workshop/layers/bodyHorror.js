// ── Body Horror ───────────────────────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.CS2025_texture_BodyHorror.
// Pulsating organic flesh blob with veins and moist highlights.
// Uses CSS-filter metaball trick (blur+contrast) for organic merging shapes.
// Bass = pulsate outward. Treble = twitchy spasms.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Blob circle sprites — radial gradient from flesh core to dark edge, keyed by (hue, hue2, radius-bucket)
const _blobCache = new Map();
function _blobSprite(hue, hue2, radius) {
    const hb  = Math.round(hue  / 10) * 10;
    const h2b = Math.round(hue2 / 10) * 10;
    const rb  = Math.max(8, Math.round(radius / 6) * 6);
    const key = `${hb}_${h2b}_${rb}`;
    if (_blobCache.has(key)) return _blobCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0,    `hsl(${hb},65%,72%)`);
    g.addColorStop(0.5,  `hsl(${hb+5},60%,58%)`);
    g.addColorStop(0.85, `hsl(${h2b},55%,35%)`);
    g.addColorStop(1,    `rgba(0,0,0,0)`);
    gx.fillStyle = g;
    gx.beginPath(); gx.arc(sz/2, sz/2, sz/2, 0, TAU); gx.fill();
    _blobCache.set(key, gc);
    return gc;
}

function noise2(x, y, t) {
    return Math.sin(x * 1.7 + t * 0.5) * Math.cos(y * 2.3 - t * 0.3)
         * Math.sin((x + y) * 1.1 + t * 0.7);
}

function fbm2(x, y, t, oct) {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < oct; i++) {
        v += noise2(x * freq, y * freq, t) * amp;
        amp *= 0.5; freq *= 2.1;
    }
    return v;
}

export const bodyHorrorParams = () => ({
    blobs:    { base: 6,    min: 2,   max: 12,  step: 1, mod: { source: "" } },
    size:     { base: 0.25, min: 0.05,max: 0.5,          mod: { source: "" } }, // blob radius fraction
    pulse:    { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } }, // bass reactivity
    speed:    { base: 0.4,  min: 0,   max: 2,            mod: { source: "" } }, // movement speed
    veins:    { base: 0.6,  min: 0,   max: 1,            mod: { source: "" } },
    moisture: { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
    hue:      { base: 355,  min: 0,   max: 360,          mod: { source: "" } }, // skin hue (355=flesh)
    hue2:     { base: 10,   min: 0,   max: 360,          mod: { source: "" } }, // vein hue
    blur:     { base: 20,   min: 5,   max: 60,  step: 1, mod: { source: "" } }, // metaball blur px
    contrast: { base: 18,   min: 5,   max: 40,  step: 1, mod: { source: "" } }, // metaball edge sharpness
    spasm:    { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } }, // treble twitch
    bgAlpha:  { base: 0.95, min: 0,   max: 1,            mod: { source: "" } },
});

export function drawBodyHorror(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nBlobs   = Math.round(Math.max(2, Math.min(12, p.blobs ?? 6)));
    const blobSz   = (p.size ?? 0.25) * Math.min(w, h) * (1 + bass * (p.pulse ?? 0.8) * 0.4);
    const speed    = p.speed ?? 0.4;
    const veins    = p.veins ?? 0.6;
    const moisture = p.moisture ?? 0.5;
    const hue      = p.hue ?? 355;
    const hue2     = p.hue2 ?? 10;
    const blurPx   = Math.round(p.blur ?? 20);
    const contrast = Math.round(p.contrast ?? 18);
    const spasm    = p.spasm ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.95;

    // Treble spasm: random offset
    const spasmX = treble > 0.5 ? (Math.random() - 0.5) * treble * spasm * 20 : 0;
    const spasmY = treble > 0.5 ? (Math.random() - 0.5) * treble * spasm * 8  : 0;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Metaball pass: draw blobs into a temp canvas with blur+contrast
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tc = tmp.getContext('2d');

    tc.fillStyle = '#000';
    tc.fillRect(0, 0, w, h);

    // Draw blob circles
    for (let i = 0; i < nBlobs; i++) {
        const phase = i * 2.39996; // golden angle offset
        const rx = fbm2(Math.cos(phase) * 0.8, Math.sin(phase) * 0.8 + i * 0.3, t * speed, 3) * 0.5;
        const ry = fbm2(Math.cos(phase + 1) * 0.8, Math.sin(phase - 1) * 0.8 + i * 0.4, t * speed, 3) * 0.5;

        const bx = w/2 + (Math.cos(phase + t * speed * (0.3 + i * 0.07)) * 0.35 + rx * 0.3) * w + spasmX;
        const by = h/2 + (Math.sin(phase * 1.3 + t * speed * (0.2 + i * 0.05)) * 0.35 + ry * 0.3) * h + spasmY;
        const br = blobSz * (0.5 + (i % 3) * 0.15 + bass * (p.pulse ?? 0.8) * 0.2);

        // Pre-rendered blob sprite (avoids createRadialGradient per blob per frame)
        const bs = _blobSprite(hue, hue2, br);
        tc.drawImage(bs, bx - bs.width/2, by - bs.height/2);
    }

    // Apply CSS filter metaball trick
    ctx.filter = `blur(${blurPx}px) contrast(${contrast})`;
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = 'none';

    // Veins — drawn over the blurred blobs
    if (veins > 0.05) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.lineWidth = 1;
        ctx.strokeStyle = `hsla(${hue2},70%,${25 + mid * 15}%,${veins * 0.6})`;
        for (let v = 0; v < 8; v++) {
            const vphase = v * 0.8 + t * speed * 0.1;
            ctx.beginPath();
            let x0 = w/2 + Math.cos(vphase) * w * 0.25;
            let y0 = h/2 + Math.sin(vphase * 0.7) * h * 0.2;
            ctx.moveTo(x0, y0);
            for (let s = 1; s <= 10; s++) {
                const ang = vphase + s * 0.3 + noise2(v, s, t * speed * 0.3) * 0.8;
                x0 += Math.cos(ang) * 30;
                y0 += Math.sin(ang) * 20;
                ctx.lineTo(x0, y0);
            }
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // Moisture droplets (specular highlights)
    if (moisture > 0.05) {
        for (let i = 0; i < 12; i++) {
            const dx = w * 0.1 + (Math.sin(i * 4.3 + t * speed * 0.2) * 0.5 + 0.5) * w * 0.8;
            const dy = h * 0.1 + (Math.cos(i * 3.7 + t * speed * 0.15) * 0.5 + 0.5) * h * 0.8;
            const sz = 2 + Math.sin(i + t * 2) * 1.5;
            ctx.fillStyle = `rgba(255,235,220,${moisture * 0.45 * (0.5 + Math.sin(i + t) * 0.5)})`;
            ctx.beginPath(); ctx.ellipse(dx, dy, sz, sz * 0.6, 0.5, 0, TAU); ctx.fill();
        }
    }

    // Audio pulse glow
    if (bass > 0.3) {
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w,h)*0.6);
        g.addColorStop(0, `hsla(${hue2},80%,40%,${bass * (p.pulse ?? 0.8) * 0.25})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    // Vignette
    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.3, w/2, h/2, Math.min(w,h)*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(3,0,2,0.6)`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
}
