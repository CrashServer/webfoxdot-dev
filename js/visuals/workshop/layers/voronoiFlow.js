// ── Voronoi Flow ──────────────────────────────────────────────────────────────
// Animated Voronoi diagram with moving seeds.  Each cell is filled by the
// colour of its seed; seeds drift on a smooth noise path.  Bass pulses cell
// brightness; treble shifts the palette.  Rendered at reduced resolution.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const voronoiFlowParams = () => ({
    seeds:    { base: 20,   min: 3,  max: 60,  step: 1, mod: { source: "" } },
    res:      { base: 160,  min: 60, max: 320, step:20, mod: { source: "" } },
    speed:    { base: 0.08, min: 0,  max: 0.5,          mod: { source: "" } },
    hue:      { base: 200,  min: 0,  max: 360,          mod: { source: "" } },
    hueRange: { base: 280,  min: 0,  max: 360,          mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    border:   { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } }, // edge darkness
    fill:     { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } }, // cell fill alpha
    glow:     { base: 0.3,  min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,  max: 1,            mod: { source: "" } },
    mode:     { base: 0,    min: 0,  max: 1,  step: 1,  mod: { source: "" } }, // 0=colour 1=distance
});

function sn(x, y, t) {
    return Math.sin(x * 2.3 + t * 0.7) * Math.cos(y * 1.7 - t * 0.5) * 0.5
         + Math.cos(x * 3.1 - t * 0.3) * Math.sin(y * 2.9 + t * 0.4) * 0.5;
}

export function drawVoronoiFlow(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nSeeds = Math.round(Math.max(3, Math.min(60, p.seeds ?? 20)));
    const res    = Math.round(Math.max(60, Math.min(320, p.res ?? 160)));
    const speed  = p.speed ?? 0.08;
    const hue    = ((p.hue ?? 200) + treble * 40) % 360;
    const hueR   = p.hueRange ?? 280;
    const pulse  = p.pulse ?? 0.5;
    const border = p.border ?? 0.6;
    const fill   = p.fill ?? 0.5;
    const bgAlpha= p.bgAlpha ?? 1.0;
    const mode   = Math.round(p.mode ?? 0);

    const SW = res, SH = Math.round(res * h / w);

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH || st.nSeeds !== nSeeds) {
        const seeds = Array.from({ length: nSeeds }, (_, i) => ({
            x: Math.random(),
            y: Math.random(),
            hOff: (i / nSeeds) * hueR,
            phX: Math.random() * TAU,
            phY: Math.random() * TAU,
        }));
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d"), SW, SH, nSeeds, seeds };
        _st.set(ctx, st);
    }

    const seeds = st.seeds;
    const T = t * speed;

    // Update seed positions via smooth noise paths
    for (let i = 0; i < nSeeds; i++) {
        const s = seeds[i];
        const nx = sn(s.x + s.phX, s.y, T);
        const ny = sn(s.x, s.y + s.phY, T);
        s.x = (s.x + nx * 0.002 + 1) % 1;
        s.y = (s.y + ny * 0.002 + 1) % 1;
    }

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;

    for (let py = 0; py < SH; py++) {
        const fy = py / SH;
        for (let px = 0; px < SW; px++) {
            const fx = px / SW;
            let best = 0, bestD = Infinity, sec = Infinity;
            for (let i = 0; i < nSeeds; i++) {
                const dx = fx - seeds[i].x, dy = fy - seeds[i].y;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestD) { sec = bestD; bestD = d2; best = i; }
                else if (d2 < sec) sec = d2;
            }

            const isEdge = (Math.sqrt(sec) - Math.sqrt(bestD)) < 0.008;
            const idx = (py * SW + px) * 4;
            const ch  = (hue + seeds[best].hOff) % 360;

            if (mode === 1) {
                // Distance field mode
                const dist = Math.sqrt(bestD) * 5;
                const v = Math.floor(dist * 255);
                const edgeV = isEdge ? 0 : v;
                d[idx] = edgeV; d[idx+1] = edgeV; d[idx+2] = edgeV;
            } else {
                if (isEdge && border > 0.1) {
                    const eb = Math.round(border * 30);
                    d[idx] = eb; d[idx+1] = eb; d[idx+2] = eb;
                } else {
                    const bright = 0.3 + fill * 0.4 + bass * pulse * 0.2;
                    const l = bright * (1 + treble * 0.2);
                    const hN = (ch / 60) % 6;
                    const c  = (1 - Math.abs(2*l-1)) * 0.8;
                    const xC = c * (1 - Math.abs(hN % 2 - 1));
                    const m  = l - c/2;
                    let r=0, g=0, b=0;
                    if (hN<1){r=c;g=xC;}else if(hN<2){r=xC;g=c;}
                    else if(hN<3){g=c;b=xC;}else if(hN<4){g=xC;b=c;}
                    else if(hN<5){r=xC;b=c;}else{r=c;b=xC;}
                    d[idx]   = Math.min(255, Math.round((r+m)*255));
                    d[idx+1] = Math.min(255, Math.round((g+m)*255));
                    d[idx+2] = Math.min(255, Math.round((b+m)*255));
                }
            }
            d[idx+3] = Math.round(bgAlpha * 255);
        }
    }
    st.bctx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.buf, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
}
