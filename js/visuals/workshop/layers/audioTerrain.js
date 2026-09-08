// ── Audio-Reactive Terrain Flythrough ────────────────────────────────────────
// Software raymarched 3D heightfield: H(x,z) = spectrum * amplitude + ridgedFbm.
// Renders to 160×90 ImageData, upscaled. Spectrum bins drive terrain height.
// Bass increases amplitude; treble increases detail; beat heaves ground.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

// Ridge FBM: sum of (1 - |sin(x * 2^k * f + z * g + t)|) / 2^k
function ridgeFBM(x, z, f, g, t) {
    let sum = 0, amp = 1, scale = 1;
    for (let k = 0; k < 4; k++) {
        sum  += (1 - Math.abs(Math.sin(x * scale * f + z * scale * g + t + k * 1.7))) * amp;
        amp  *= 0.5;
        scale *= 2;
    }
    return sum;
}

function makeState() {
    return {
        time: 0,
        prevBass: 0,
        heave: 0,
        offscreen: null, offCtx: null, ow: 0, oh: 0,
    };
}

export const audioTerrainParams = () => ({
    hue:         { base: 200, min: 0,   max: 360, mod: { source: "" } },
    camHeight:   { base: 3,   min: 1,   max: 8,   mod: { source: "" } },
    amplitude:   { base: 1.2, min: 0.3, max: 2,   mod: { source: "" } },
    speed:       { base: 2,   min: 0.5, max: 5,   mod: { source: "" } },
    detailScale: { base: 0.4, min: 0.1, max: 1,   mod: { source: "" } },
    glow:        { base: 1.5, min: 0,   max: 3,   mod: { source: "" } },
});

export function drawAudioTerrain(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = makeState(); _state.set(ctx, st); }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0, treble = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
        for (let i = 44; i < 64; i++) treble += sp[i]; treble /= 20;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) st.heave = 1;
    st.prevBass = bass;
    st.heave   *= 0.9;

    const hue        = p.hue ?? 200;
    const camHeight  = (p.camHeight ?? 3) + st.heave * 2;
    const amplitude  = (p.amplitude ?? 1.2) * (1 + bass * 0.6);
    const flySpeed   = (p.speed ?? 2);
    const detScale   = (p.detailScale ?? 0.4) * (1 + treble * 0.5);
    const T          = st.time * flySpeed;

    const RW = 160, RH = 90;

    if (!st.offscreen || st.ow !== RW || st.oh !== RH) {
        st.offscreen = new OffscreenCanvas(RW, RH);
        st.offCtx    = st.offscreen.getContext('2d');
        st.ow = RW; st.oh = RH;
    }

    const id   = st.offCtx.createImageData(RW, RH);
    const data = id.data;

    // Sky gradient indices
    const skyH1 = (hue + 40) % 360;
    const skyH2 = hue;

    // Camera position
    const camX = 0;
    const camZ = -T * 5;
    const camY = camHeight;
    const far  = 60;

    // Heightfield: H(x, z) = spectrum * amplitude + ridgeFBM * detailWeight
    function getH(wx, wz) {
        // Spectrum: map x → spectrum band
        const xNorm = ((wx % 32 + 32) % 32) / 32; // normalise x to [0,1]
        let specH = 0;
        if (sp) {
            const band = Math.min(63, xNorm * 64 | 0);
            // Interpolate neighbouring bands
            const b0 = sp[band], b1 = sp[Math.min(63, band + 1)];
            const frac = xNorm * 64 - band;
            specH = (b0 + (b1 - b0) * frac) * amplitude;
        }
        const fbm = ridgeFBM(wx * detScale, wz * detScale, 0.8, 0.8, T * 0.1) * amplitude * 0.4;
        return specH + fbm;
    }

    for (let py = 0; py < RH; py++) {
        for (let px = 0; px < RW; px++) {
            const ux = (px / RW - 0.5) * 2;
            const uy = (py / RH - 0.5) * 2; // +1 = bottom, -1 = top

            // Ray direction (perspective, forward = +Z)
            const rayDX = ux * 0.8;
            const rayDY = -0.4 - uy * 0.4; // looking slightly down
            const rayDZ = 1.0;
            const rayLen = Math.sqrt(rayDX*rayDX + rayDY*rayDY + rayDZ*rayDZ);
            const rdx = rayDX / rayLen, rdy = rayDY / rayLen, rdz = rayDZ / rayLen;

            let hit = false;
            let hitH = 0, hitDist = 0, hitX = 0, hitZ = 0;

            // March
            let dist = 0.5;
            for (let step = 0; step < 60; step++) {
                const rx = camX + rdx * dist;
                const ry = camY + rdy * dist;
                const rz = camZ + rdz * dist;
                if (dist > far) break;
                const terrain = getH(rx, rz);
                if (ry < terrain) {
                    hit = true; hitH = terrain; hitDist = dist; hitX = rx; hitZ = rz;
                    break;
                }
                dist += Math.max(0.3, (ry - terrain) * 0.5);
            }

            const off = (py * RW + px) << 2;
            if (!hit) {
                // Sky
                const skyFrac = Math.min(1, Math.max(0, (uy + 0.2) / 1.2));
                const sH = hsl2rgb(skyH1 + (skyH2 - skyH1) * skyFrac, 0.6, 0.05 + skyFrac * 0.08);
                data[off] = sH[0]; data[off+1] = sH[1]; data[off+2] = sH[2]; data[off+3] = 255;
            } else {
                // Terrain color
                const fogFrac = Math.min(1, hitDist / far);
                const hNorm   = Math.min(1, hitH / (amplitude * 1.5));
                const slope   = Math.max(0, 1 - fogFrac);
                const terrH   = hsl2rgb(hue, 0.7, 0.05 + hNorm * 0.45 * slope);
                // Crest glow
                const crest   = Math.max(0, hNorm - 0.6) * 3;
                data[off]     = Math.min(255, terrH[0] + crest * 80 | 0);
                data[off + 1] = Math.min(255, terrH[1] + crest * 60 | 0);
                data[off + 2] = Math.min(255, terrH[2] + crest * 40 | 0);
                data[off + 3] = 255;
            }
        }
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.offscreen, 0, 0, w, h);
}
