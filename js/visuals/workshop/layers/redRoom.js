// ── Red Room (Twin Peaks / Lynch) ─────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.CS2025_texture_noise_twinPeaks.
// 4 pattern modes: Red Room zigzag, Black Lodge, White Lodge, Dreamscape.
// Bass = scale/intensity pulse. Treble = hue drift.

const _st = new WeakMap();

function noise1(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const s = (n) => (Math.sin(n * 127.1) * 43758.5453) % 1;
    const a = s(xi + yi * 311.7);
    const b = s(xi+1 + yi * 311.7);
    const c = s(xi + (yi+1) * 311.7);
    const d = s(xi+1 + (yi+1) * 311.7);
    return (a*(1-u)+b*u)*(1-v) + (c*(1-u)+d*u)*v;
}

function fbm(x, y, oct) {
    let v = 0, amp = 0.5, fx = 1;
    // rotation matrix for variety
    for (let i = 0; i < oct; i++) {
        v += noise1(x * fx, y * fx) * amp;
        const nx = 0.8*x*fx - 0.6*y*fx, ny = 0.6*x*fx + 0.8*y*fx;
        x = nx / fx; y = ny / fx;
        amp *= 0.5; fx *= 2.02;
    }
    return v;
}

function zigzag(px, py, size) {
    return ((Math.floor((px + py) * size)) & 1) === 0 ? 1 : 0;
}

export const redRoomParams = () => ({
    mode:     { base: 0,    min: 0,   max: 3,   step: 1, mod: { source: "" } }, // 0=RedRoom 1=BlackLodge 2=WhiteLodge 3=Dreamscape
    scale:    { base: 8,    min: 1,   max: 30,           mod: { source: "" } },
    scrollX:  { base: 0.05, min: -1,  max: 1,            mod: { source: "" } },
    scrollY:  { base: 0.02, min: -1,  max: 1,            mod: { source: "" } },
    hue:      { base: 0,    min: 0,   max: 360,          mod: { source: "" } }, // primary (red=0)
    hue2:     { base: 30,   min: 0,   max: 360,          mod: { source: "" } }, // secondary
    distort:  { base: 0.3,  min: 0,   max: 1,            mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
    glow:     { base: 0.3,  min: 0,   max: 1,            mod: { source: "" } },
    octaves:  { base: 4,    min: 1,   max: 6,   step: 1, mod: { source: "" } },
    contrast: { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawRedRoom(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const mode    = Math.round(Math.max(0, Math.min(3, p.mode ?? 0)));
    const scale   = (p.scale ?? 8) * (1 + bass * (p.pulse ?? 0.5) * 0.35);
    const sx      = (p.scrollX ?? 0.05) * t;
    const sy      = (p.scrollY ?? 0.02) * t;
    const hue     = ((p.hue ?? 0) + treble * 30) % 360;
    const hue2    = ((p.hue2 ?? 30) + treble * 20) % 360;
    const distort = (p.distort ?? 0.3) * (1 + bass * (p.pulse ?? 0.5) * 0.5);
    const oct     = Math.round(Math.max(1, Math.min(6, p.octaves ?? 4)));
    const contrast= p.contrast ?? 0.7;

    const iw = 128, ih = 72; // internal resolution
    let st = _st.get(ctx);
    if (!st) { st = { imgData: null }; _st.set(ctx, st); }

    // Render at low resolution, then scale up for performance
    const offscreen = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(iw, ih)
        : { width: iw, height: ih, getContext: () => null };

    // Use ImageData directly for performance
    const imgData = ctx.createImageData(iw, ih);
    const data = imgData.data;

    for (let py = 0; py < ih; py++) {
        for (let px = 0; px < iw; px++) {
            const uvx = px / iw + sx;
            const uvy = py / ih + sy;

            let patVal = 0;
            let r = 0, g = 0, b = 0;

            if (mode === 0) {
                // Red Room: zigzag with fbm warp
                const wx = fbm(uvx * 2 + 0.3, uvy * 2 + 0.2, oct) * distort * 0.15;
                const wy = fbm(uvx * 2 + 1.7, uvy * 2 + 3.1, oct) * distort * 0.15;
                patVal = zigzag((uvx + wx) * scale / iw, (uvy + wy) * scale / iw, 1);
                // Red/dark red color mix
                const c1 = [180, 0, 0], c2 = [30, 0, 0];
                const mix = patVal > 0.5 ? 1 : 0;
                r = c1[0] * mix + c2[0] * (1 - mix);
                g = c1[1] * mix + c2[1] * (1 - mix);
                b = c1[2] * mix + c2[2] * (1 - mix);
                // Sheen on lighter chevrons
                if (mix > 0.5) { r += Math.random() * 15 - 7; g += 2; }
            } else if (mode === 1) {
                // Black Lodge: fbm noise warp
                const qx = fbm(uvx + 0.3, uvy + 0.2, oct);
                const qy = fbm(uvx + 3.1, uvy + 1.3, oct);
                patVal = fbm((uvx + 4 * qx + 0.03*t) * scale / 8,
                             (uvy + 4 * qy + 0.02*t) * scale / 8, oct);
                // Dark violet/black
                const v = patVal * contrast;
                r = 30 + v * 60;
                g = 0 + v * 15;
                b = 40 + v * 80;
            } else if (mode === 2) {
                // White Lodge: rings + rays
                const dpx = uvx - 0.5, dpy = uvy - 0.5;
                const dist = Math.sqrt(dpx*dpx + dpy*dpy);
                const rings = Math.sin(dist * scale * 3 - t * 1.5) * 0.5 + 0.5;
                const rays  = Math.sin(Math.atan2(dpy, dpx) * 8 + t) * 0.5 + 0.5;
                patVal = rings * 0.6 + rays * 0.4;
                // White/gold
                const lum = patVal * contrast;
                r = 200 + lum * 55;
                g = 180 + lum * 60;
                b = 120 + lum * 100;
            } else {
                // Dreamscape: curtain waves + fbm
                const twisty = uvx + Math.sin(uvy * 5 + t * 0.3) * distort * 0.2;
                const curtain = ((Math.floor(twisty * scale / 5)) & 1) === 0 ? 1 : 0;
                const waves = fbm(uvx * scale / 8, uvy * scale / 8 + t * 0.05, oct);
                patVal = curtain * 0.5 + waves * 0.5;
                const v = patVal * contrast;
                r = 20 + v * 120;
                g = 5 + v * 50;
                b = 60 + v * 140;
            }

            const idx = (py * iw + px) * 4;
            data[idx]   = Math.max(0, Math.min(255, r | 0));
            data[idx+1] = Math.max(0, Math.min(255, g | 0));
            data[idx+2] = Math.max(0, Math.min(255, b | 0));
            data[idx+3] = 255;
        }
    }

    // Draw at low res, scale up with imageSmoothingEnabled = false
    const tmp = document.createElement('canvas');
    tmp.width = iw; tmp.height = ih;
    tmp.getContext('2d').putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;

    // Bass flash overlay
    if (bass > 0.6) {
        const flashHue = mode === 0 ? hue : (mode === 1 ? 270 : (mode === 2 ? 60 : hue));
        ctx.fillStyle = `hsla(${flashHue},80%,50%,${(bass - 0.6) * (p.pulse ?? 0.5) * 0.3})`;
        ctx.fillRect(0, 0, w, h);
    }
    // Glow vignette
    if (p.glow > 0.05) {
        const vg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.6);
        vg.addColorStop(0, `hsla(${hue},60%,30%,0)`);
        vg.addColorStop(1, `hsla(${hue},60%,0%,${p.glow * 0.5})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
    }
}
