// ── Pixel Sort ────────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION PixelSortScene.
// Pixel sorting on procedurally generated noise source. Multiple sort modes
// (brightness, hue, saturation). Bass = sort threshold spike. Mid = sort width.

const _st = new WeakMap();

function hsv(h, s, v) {
    // Returns [r, g, b] 0-255
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((h/60) % 2 - 1)), m = v - c;
    let r=0,g=0,b=0;
    if      (h<60)  { r=c;g=x;b=0; }
    else if (h<120) { r=x;g=c;b=0; }
    else if (h<180) { r=0;g=c;b=x; }
    else if (h<240) { r=0;g=x;b=c; }
    else if (h<300) { r=x;g=0;b=c; }
    else            { r=c;g=0;b=x; }
    return [(r+m)*255, (g+m)*255, (b+m)*255];
}

function brightness(r, g, b) { return 0.299*r + 0.587*g + 0.114*b; }
function hueOf(r, g, b) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    if (d===0) return 0;
    let h = max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
    return (h*60+360)%360;
}
function satOf(r, g, b) {
    const max=Math.max(r/255,g/255,b/255), min=Math.min(r/255,g/255,b/255);
    return max===0 ? 0 : (max-min)/max;
}

function noise2(x, y, t) {
    return 0.5 + 0.5 * Math.sin(x * 2.3 + t * 0.4) * Math.cos(y * 1.7 - t * 0.3)
               * Math.sin((x + y) * 1.1 + t * 0.5);
}

const W = 160, H = 90; // internal buffer resolution

export const pixelSortParams = () => ({
    hue:       { base: 200,  min: 0,   max: 360,          mod: { source: "" } },
    hue2:      { base: 300,  min: 0,   max: 360,          mod: { source: "" } },
    threshold: { base: 0.35, min: 0,   max: 1,            mod: { source: "" } }, // sort below this
    sortMode:  { base: 0,    min: 0,   max: 2,   step: 1, mod: { source: "" } }, // 0=brightness, 1=hue, 2=sat
    sortDir:   { base: 0,    min: 0,   max: 1,   step: 1, mod: { source: "" } }, // 0=horizontal, 1=vertical
    width:     { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } }, // max sort strip width
    pulse:     { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    speed:     { base: 0.5,  min: 0.1, max: 3,            mod: { source: "" } },
    layers:    { base: 2,    min: 1,   max: 4,   step: 1, mod: { source: "" } }, // noise layers stacked
    bgAlpha:   { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawPixelSort(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue       = p.hue ?? 200;
    const hue2      = p.hue2 ?? 300;
    const thresh    = Math.max(0.05, (p.threshold ?? 0.35) - bass * (p.pulse ?? 0.8) * 0.25);
    const sortMode  = Math.round(p.sortMode ?? 0);
    const sortDir   = Math.round(p.sortDir ?? 0);
    const maxWidth  = (p.width ?? 0.5) * (1 + mid * 0.4);
    const pulse     = p.pulse ?? 0.8;
    const speed     = p.speed ?? 0.5;
    const nLayers   = Math.round(Math.max(1, Math.min(4, p.layers ?? 2)));
    const bgAlpha   = p.bgAlpha ?? 0.5;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            buf: new Uint8ClampedArray(W * H * 4),
            tmp: new Uint8ClampedArray(W * H * 4),
            imgData: null,
            tmpCanvas: null,
            lastT: t,
        };
        // Pre-create temp canvas once
        st.tmpCanvas = document.createElement('canvas');
        st.tmpCanvas.width = W; st.tmpCanvas.height = H;
        st.imgData = st.tmpCanvas.getContext('2d').createImageData(W, H);
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // ── Generate procedural source image into buf
    const buf = st.buf;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const nx = x / W, ny = y / H;
            let v = 0, amp = 1, freq = 1;
            for (let l = 0; l < nLayers; l++) {
                v += noise2(nx * freq * 3 + l * 1.7, ny * freq * 2.3 + l * 0.9, t * speed + l * 0.5) * amp;
                amp *= 0.5; freq *= 2.1;
            }
            v = Math.max(0, Math.min(1, v));
            const lHue = hue + (hue2 - hue) * v + treble * 30;
            const sat  = 0.6 + v * 0.4;
            const val  = 0.2 + v * 0.75 + bass * pulse * 0.1;
            const [r, g, b] = hsv(lHue, sat, val);
            const idx = (y * W + x) * 4;
            buf[idx]   = r;
            buf[idx+1] = g;
            buf[idx+2] = b;
            buf[idx+3] = 255;
        }
    }

    // ── Sort strips
    const tmp = st.tmp;
    tmp.set(buf); // copy

    if (sortDir === 0) {
        // Horizontal sort: for each row, find runs below threshold, sort them
        for (let y = 0; y < H; y++) {
            const maxLen = Math.floor(maxWidth * W);
            let x = 0;
            while (x < W) {
                const idxBase = (y * W + x) * 4;
                const r=tmp[idxBase], g=tmp[idxBase+1], b=tmp[idxBase+2];
                const key = sortMode===0 ? brightness(r,g,b)/255 :
                            sortMode===1 ? hueOf(r,g,b)/360 : satOf(r,g,b);
                if (key < thresh) {
                    // Find run end
                    let end = x;
                    while (end < W && end - x < maxLen) {
                        const i2 = (y * W + end) * 4;
                        const r2=tmp[i2],g2=tmp[i2+1],b2=tmp[i2+2];
                        const k2 = sortMode===0 ? brightness(r2,g2,b2)/255 :
                                   sortMode===1 ? hueOf(r2,g2,b2)/360 : satOf(r2,g2,b2);
                        if (k2 >= thresh) break;
                        end++;
                    }
                    // Collect pixels in run
                    const run = [];
                    for (let xi = x; xi < end; xi++) {
                        const i2 = (y * W + xi) * 4;
                        run.push({ r:tmp[i2],g:tmp[i2+1],b:tmp[i2+2], k: 0 });
                    }
                    // Compute sort key per pixel
                    for (const px of run) {
                        px.k = sortMode===0 ? brightness(px.r,px.g,px.b) :
                               sortMode===1 ? hueOf(px.r,px.g,px.b) : satOf(px.r,px.g,px.b)*255;
                    }
                    run.sort((a,b2) => a.k - b2.k);
                    // Write back
                    for (let xi = x; xi < end; xi++) {
                        const i2 = (y * W + xi) * 4;
                        const px = run[xi - x];
                        buf[i2]=px.r; buf[i2+1]=px.g; buf[i2+2]=px.b;
                    }
                    x = end;
                } else {
                    x++;
                }
            }
        }
    } else {
        // Vertical sort
        for (let x = 0; x < W; x++) {
            const maxLen = Math.floor(maxWidth * H);
            let y = 0;
            while (y < H) {
                const idxBase = (y * W + x) * 4;
                const r=tmp[idxBase], g=tmp[idxBase+1], b=tmp[idxBase+2];
                const key = sortMode===0 ? brightness(r,g,b)/255 :
                            sortMode===1 ? hueOf(r,g,b)/360 : satOf(r,g,b);
                if (key < thresh) {
                    let end = y;
                    while (end < H && end - y < maxLen) {
                        const i2 = (end * W + x) * 4;
                        const r2=tmp[i2],g2=tmp[i2+1],b2=tmp[i2+2];
                        const k2 = sortMode===0 ? brightness(r2,g2,b2)/255 :
                                   sortMode===1 ? hueOf(r2,g2,b2)/360 : satOf(r2,g2,b2);
                        if (k2 >= thresh) break;
                        end++;
                    }
                    const run = [];
                    for (let yi = y; yi < end; yi++) {
                        const i2 = (yi * W + x) * 4;
                        run.push({ r:tmp[i2],g:tmp[i2+1],b:tmp[i2+2], k:0 });
                    }
                    for (const px of run) {
                        px.k = sortMode===0 ? brightness(px.r,px.g,px.b) :
                               sortMode===1 ? hueOf(px.r,px.g,px.b) : satOf(px.r,px.g,px.b)*255;
                    }
                    run.sort((a,b2) => a.k - b2.k);
                    for (let yi = y; yi < end; yi++) {
                        const i2 = (yi * W + x) * 4;
                        const px = run[yi - y];
                        buf[i2]=px.r; buf[i2+1]=px.g; buf[i2+2]=px.b;
                    }
                    y = end;
                } else {
                    y++;
                }
            }
        }
    }

    // ── Blit to canvas (upscaled, pixelated)
    st.imgData.data.set(buf);
    const tc = st.tmpCanvas.getContext('2d');
    tc.putImageData(st.imgData, 0, 0);

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.tmpCanvas, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;

    // Beat flash
    if (bass > 0.55) {
        ctx.fillStyle = `rgba(255,255,255,${bass * pulse * 0.06})`;
        ctx.fillRect(0, 0, w, h);
    }
}
