// ── Post FX registry ──────────────────────────────────────────────────────
// Each effect is self-contained: a label, param defs, and an apply(src,
// outCtx, w, h, liveParams) that reads a source canvas and paints the
// processed result into outCtx. fxStack.js chains any number of these in
// order — this file only defines what each individual effect DOES, not how
// they stack (per-channel or on the master, same registry either way).

// One shared downscale buffer, GROWN rather than resized to each effect's
// exact block count: two Pixelate effects with different settings used to
// reallocate it back and forth every frame. Each draw uses only its own
// top-left corner, so sharing is safe (fxStack runs one effect at a time).
let pixelateBuf = null;
function pixelateCanvas(nw, nh) {
    if (!pixelateBuf) pixelateBuf = document.createElement("canvas");
    if (pixelateBuf.width < nw || pixelateBuf.height < nh) {
        pixelateBuf.width = Math.max(pixelateBuf.width, nw);
        pixelateBuf.height = Math.max(pixelateBuf.height, nh);
    }
    return pixelateBuf;
}

// Two ping-pong scratches for effects that fold a frame more than once. A
// second fold has to act on the FIRST fold's output, and drawing a canvas
// into itself through a transform has no defined result — so the passes
// alternate between these instead.
let foldA = null, foldB = null;
function foldPair(w, h) {
    if (!foldA) { foldA = document.createElement("canvas"); foldB = document.createElement("canvas"); }
    for (const c of [foldA, foldB]) {
        if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    }
    return [foldA, foldB];
}

let scanlineTile = null;
function scanlinePattern(ctx, spacing, intensity) {
    if (!scanlineTile) scanlineTile = document.createElement("canvas");
    const h = Math.max(2, Math.round(spacing));
    if (scanlineTile.height !== h) { scanlineTile.width = 1; scanlineTile.height = h; }
    const tctx = scanlineTile.getContext("2d");
    tctx.clearRect(0, 0, 1, h);
    tctx.fillStyle = `rgba(0,0,0,${intensity})`;
    tctx.fillRect(0, h - 1, 1, 1); // one dark line per tile, rest transparent
    return ctx.createPattern(scanlineTile, "repeat");
}

// Column mask for dot-matrix look: one dark vertical stripe per tile, same
// spacing as the horizontal scanlines so each cell becomes a square dot.
let colTile = null;
function colPattern(ctx, spacing, intensity) {
    if (!colTile) colTile = document.createElement("canvas");
    const w = Math.max(2, Math.round(spacing));
    if (colTile.width !== w) { colTile.width = w; colTile.height = 1; }
    const tctx = colTile.getContext("2d");
    tctx.clearRect(0, 0, w, 1);
    tctx.fillStyle = `rgba(0,0,0,${intensity})`;
    tctx.fillRect(w - 1, 0, 1, 1);
    return ctx.createPattern(colTile, "repeat");
}

// SVG feComponentTransfer needs its tableValues rewritten whenever the
// level count changes (SVG filters have no native way to take a dynamic
// param) — cached so it's a no-op most frames.
let lastPosterizeLevels = -1;
function updatePosterizeTable(levels) {
    const n = Math.max(2, Math.round(levels));
    if (n === lastPosterizeLevels) return;
    lastPosterizeLevels = n;
    const vals = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(" ");
    for (const id of ["posterizeR", "posterizeG", "posterizeB"]) {
        document.getElementById(id)?.setAttribute("tableValues", vals);
    }
}

// Classic partial tone-reversal: values below the threshold pass through
// unchanged, values above get inverted — sampled into a smooth table curve.
let lastSolarizeThreshold = -1;
function updateSolarizeTable(threshold, n = 17) {
    const th = Math.round(threshold * 100) / 100;
    if (th === lastSolarizeThreshold) return;
    lastSolarizeThreshold = th;
    const vals = Array.from({ length: n }, (_, i) => {
        const v = i / (n - 1);
        return (v < th ? v : 1 - v).toFixed(3);
    }).join(" ");
    for (const id of ["solarizeR", "solarizeG", "solarizeB"]) {
        document.getElementById(id)?.setAttribute("tableValues", vals);
    }
}

export const FX_KINDS = {
    invert: {
        label: "Invert",
        makeParams: () => ({
            amount: { base: 1, min: 0,   max: 1,   mod: { source: "" } },
            hue:    { base: 0, min: 0,   max: 360, mod: { source: "" } }, // post-invert rotation: 180° with full invert restores saturation on flipped luminance
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const hue  = Math.round(p.hue ?? 0);
            const hueF = hue > 0 ? ` hue-rotate(${hue}deg)` : "";
            ctx.filter = p.amount > 0.01 ? `invert(${Math.round(p.amount * 100)}%)${hueF}` : (hueF.trim() || "none");
            ctx.drawImage(src, 0, 0);
            ctx.filter = "none";
        },
    },
    bloom: {
        label: "Bloom",
        makeParams: () => ({
            amount:    { base: 0.4, min: 0,    max: 1,    mod: { source: "" } },
            blur:      { base: 12,  min: 0,    max: 40,   mod: { source: "" } },
            threshold: { base: 0,   min: 0,    max: 0.95, mod: { source: "" } }, // 0=everything glows, 0.9=hotspots only
            warmth:    { base: 0,   min: 0,    max: 1,    mod: { source: "" } }, // warm-amber tint on the bloom layer
            spread:    { base: 0,   min: 0,    max: 1,    mod: { source: "" } }, // wide ambient glow at 3× blur under the tight pass
        }),
        apply(src, ctx, w, h, p, entry) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0);
            if (p.amount <= 0.01) return;
            // brightness(0.5/T) maps threshold value T to 0.5 at the contrast midpoint,
            // so contrast(20) creates a steep step: pixels above T → white (bloom),
            // pixels below T → black (no bloom). Without threshold, classic diffuse bloom.
            const warmF = (p.warmth ?? 0) > 0.01 ? ` sepia(${(p.warmth).toFixed(2)}) saturate(2)` : "";
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = p.amount;
            if ((p.threshold ?? 0) > 0.03) {
                if (!entry._bb || entry._bb.width !== w || entry._bb.height !== h) {
                    entry._bb = document.createElement("canvas");
                    entry._bb.width = w; entry._bb.height = h;
                    entry._bx = entry._bb.getContext("2d");
                }
                const T = Math.min(0.95, p.threshold);
                entry._bx.clearRect(0, 0, w, h);
                entry._bx.filter = `brightness(${(0.5 / T).toFixed(3)}) contrast(20)${warmF}`;
                entry._bx.drawImage(src, 0, 0, w, h);
                entry._bx.filter = "none";
                ctx.filter = `blur(${p.blur}px)`;
                ctx.drawImage(entry._bb, 0, 0, w, h);
            } else {
                ctx.filter = `blur(${p.blur}px) brightness(1.6)${warmF}`;
                ctx.drawImage(src, 0, 0);
            }
            // Wide ambient pass at 3× blur radius, lower alpha — cinema-style
            // two-layer bloom: tight glow for hotspots, spread for overall haze.
            if ((p.spread ?? 0) > 0.01) {
                ctx.globalAlpha = p.amount * (p.spread) * 0.6;
                ctx.filter = `blur(${Math.min(80, p.blur * 3).toFixed(1)}px)${warmF}`;
                ctx.drawImage((p.threshold ?? 0) > 0.03 ? entry._bb : src, 0, 0, w, h);
            }
            ctx.filter = "none";
            ctx.restore();
        },
    },
    blur: {
        label: "Blur",
        makeParams: () => ({
            radius:  { base: 4, min: 0,   max: 40,  mod: { source: "" } }, // Gaussian softness
            motion:  { base: 0, min: 0,   max: 80,  mod: { source: "" } }, // directional smear (px)
            angle:   { base: 0, min: 0,   max: 360, mod: { source: "" } }, // smear direction (degrees)
            samples: { base: 7, min: 3,   max: 16,  mod: { source: "" } }, // motion/zoom quality
            zoom:    { base: 0, min: 0,   max: 1,   mod: { source: "" } }, // radial zoom burst from centre
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const hasGauss  = p.radius > 0.1;
            const hasMotion = (p.motion ?? 0) > 0.5;
            const hasZoom   = (p.zoom   ?? 0) > 0.005;
            if (!hasGauss && !hasMotion && !hasZoom) { ctx.drawImage(src, 0, 0, w, h); return; }
            const n = Math.max(3, Math.round(p.samples ?? 7));
            if (hasZoom) {
                // Radial zoom burst: n scaled copies at 1.0..1+zoom*0.35 — lighter blend
                // so the centre (all n overlap) stays at full brightness, edges trail off.
                // Gaussian can stack: each sample gets a half-strength blur per-pass.
                const zRange = (p.zoom ?? 0) * 0.35;
                const cx = w / 2, cy = h / 2;
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = 1 / n;
                ctx.filter = hasGauss ? `blur(${(p.radius * 0.5).toFixed(1)}px)` : "none";
                for (let i = 0; i < n; i++) {
                    const s = 1 + (i / (n - 1)) * zRange;
                    ctx.save();
                    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
                    ctx.drawImage(src, 0, 0, w, h);
                    ctx.restore();
                }
                ctx.filter = "none";
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = "source-over";
            } else if (hasMotion) {
                // N additive samples spaced symmetrically along `angle` — lighter blend
                // sums linearly, so each sample contributes 1/n of the total. Bright areas
                // may clip (they smear white), which is the correct motion-blur look.
                const a   = ((p.angle ?? 0) * Math.PI) / 180;
                const tdx = Math.cos(a) * (p.motion ?? 0);
                const tdy = Math.sin(a) * (p.motion ?? 0);
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = 1 / n;
                ctx.filter = hasGauss ? `blur(${p.radius}px)` : "none";
                for (let i = 0; i < n; i++) {
                    const t = i / (n - 1) - 0.5; // -0.5 .. +0.5
                    ctx.drawImage(src, 0, 0, w, h, t * tdx, t * tdy, w, h);
                }
                ctx.filter = "none";
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = "source-over";
            } else {
                ctx.filter = `blur(${p.radius}px)`;
                ctx.drawImage(src, 0, 0, w, h);
                ctx.filter = "none";
            }
        },
    },
    pixelate: {
        label: "Pixelate",
        makeParams: () => ({ blocks: { base: 32, min: 4, max: 200, mod: { source: "" } } }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            // Blocks are SQUARE now: the frame was previously squashed into an
            // n x n buffer and stretched back, so on a 16:9 output every
            // "pixel" came out 1.78x wider than it was tall.
            const nw = Math.max(2, Math.round(p.blocks));
            const nh = Math.max(1, Math.round((nw * h) / w));
            const buf = pixelateCanvas(nw, nh);
            const bctx = buf.getContext("2d");
            // Smoothing ON for the downscale: it averages each block, which is
            // what a pixelate should do — and with it off a 10:1 reduction
            // drew nothing at all. Crispness comes from the UPSCALE below.
            bctx.imageSmoothingEnabled = true;
            bctx.clearRect(0, 0, nw, nh);
            bctx.drawImage(src, 0, 0, nw, nh);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(buf, 0, 0, nw, nh, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
        },
    },
    vignette: {
        label: "Vignette",
        makeParams: () => ({
            amount:  { base: 0.6, min: 0,    max: 1,    mod: { source: "" } },
            radius:  { base: 70,  min: 10,   max: 150,  mod: { source: "" } },
            hue:     { base: 0,   min: 0,    max: 360,  mod: { source: "" } }, // 0=black, 1-360=colored edge
            soft:    { base: 0,   min: 0,    max: 0.95, mod: { source: "" } }, // inner clear zone — pushes gradient start toward the edge
            offsetX: { base: 0,   min: -0.5, max: 0.5,  mod: { source: "" } }, // move vignette centre (fraction of width)
            offsetY: { base: 0,   min: -0.5, max: 0.5,  mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0);
            if (p.amount > 0.01) {
                const cx = w / 2 + (p.offsetX ?? 0) * w;
                const cy = h / 2 + (p.offsetY ?? 0) * h;
                const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (p.radius / 100));
                const hue = Math.round(p.hue ?? 0);
                // hue=0 → classic black vignette; any other value → deep-saturated colored edge
                const edgeColor = hue < 1
                    ? `rgba(0,0,0,${p.amount})`
                    : `hsla(${hue},100%,8%,${p.amount})`;
                g.addColorStop(0, "rgba(0,0,0,0)");
                // soft extends the transparent zone inward — no gradient until this stop
                const softStop = Math.max(0, Math.min(0.99, p.soft ?? 0));
                if (softStop > 0.01) g.addColorStop(softStop, "rgba(0,0,0,0)");
                g.addColorStop(1, edgeColor);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
        },
    },
    feedback: {
        label: "Feedback / Trails",
        makeParams: () => ({
            decay:     { base: 0.92, min: 0,     max: 0.99,  mod: { source: "" } },
            mix:       { base: 1,    min: 0,     max: 1,     mod: { source: "" } },
            zoom:      { base: 1,    min: 0.9,   max: 1.1,   mod: { source: "" } },
            rotate:    { base: 0,    min: -10,   max: 10,    mod: { source: "" } },
            driftX:    { base: 0,    min: -0.02, max: 0.02,  mod: { source: "" } },
            driftY:    { base: 0,    min: -0.02, max: 0.02,  mod: { source: "" } },
            hueDrift:  { base: 0,    min: -15,   max: 15,    mod: { source: "" } },
            blurTrail: { base: 0,    min: 0,     max: 8,     mod: { source: "" } },
            // blendIn: how new content merges onto the trail.
            // 0=over (replaces — kills trails behind solid backgrounds)
            // 1=screen (default — dark pixels are transparent, bright adds to trail)
            // 2=overlay  3=multiply
            blendIn:   { base: 1,    min: 0,     max: 3,     mod: { source: "" } },
        }),
        // Stateful double-buffered accumulator. The key insight that makes
        // feedback actually work on solid-background layers: we draw the trail
        // fully opaque, then dim it with a dark fill (= decay), then blend new
        // content via screen. In screen mode dark pixels are transparent, so a
        // black/dark background layer contributes nothing and the trail persists.
        // The old globalAlpha approach left the trail as a semi-transparent
        // pixel, which source-over new content would immediately overwrite.
        apply(src, ctx, w, h, p, entry) {
            if (!entry._buf || entry._buf.width !== w || entry._buf.height !== h) {
                entry._buf = document.createElement("canvas");
                entry._buf.width = w; entry._buf.height = h;
                entry._bctx = entry._buf.getContext("2d");
                entry._alt = document.createElement("canvas");
                entry._alt.width = w; entry._alt.height = h;
                entry._actx = entry._alt.getContext("2d");
            }
            const a = entry._actx;
            const decay = Math.max(0, Math.min(1, p.decay ?? 0.92));
            const zoom  = Math.max(0.05, p.zoom ?? 1);
            const rot   = ((p.rotate ?? 0) * Math.PI) / 180;
            const dx    = (p.driftX ?? 0) * w;
            const dy    = (p.driftY ?? 0) * h;

            a.setTransform(1, 0, 0, 1, 0, 0);
            a.globalAlpha = 1;
            a.globalCompositeOperation = "source-over";

            // ── Step 1: black fill so the accumulator is always fully opaque. ──
            // Opaque pixels never get overwritten by new content in screen mode.
            a.fillStyle = "#000";
            a.fillRect(0, 0, w, h);

            // ── Step 2: draw previous accumulation fully opaque + transformed. ──
            const trailFilters = [];
            if (Math.abs(p.hueDrift ?? 0) > 0.05) trailFilters.push(`hue-rotate(${(p.hueDrift).toFixed(1)}deg)`);
            if ((p.blurTrail ?? 0) > 0.1)         trailFilters.push(`blur(${(p.blurTrail).toFixed(1)}px)`);
            if (trailFilters.length) a.filter = trailFilters.join(" ");
            a.save();
            a.translate(w / 2 + dx, h / 2 + dy);
            a.rotate(rot);
            a.scale(zoom, zoom);
            a.translate(-w / 2, -h / 2);
            a.drawImage(entry._buf, 0, 0);
            a.restore();
            a.filter = "none";

            // ── Step 3: fade the accumulation (dark overlay = multiply by decay). ──
            // rgba(0,0,0, 1-decay) atop an opaque pixel = pixel * decay. This keeps
            // all pixels fully opaque (no semi-transparency that source-over kills).
            a.fillStyle = `rgba(0,0,0,${(1 - decay).toFixed(4)})`;
            a.fillRect(0, 0, w, h);

            // ── Step 4: blend new frame onto the faded trail. ──
            // screen (default): dark bg pixels = transparent; bright content adds.
            // source-over: new content paints fully over (use for transparent layers).
            const blendModes = ["source-over", "screen", "overlay", "multiply"];
            a.globalCompositeOperation = blendModes[Math.round(Math.max(0, Math.min(3, p.blendIn ?? 1)))];
            a.globalAlpha = Math.max(0, Math.min(1, p.mix ?? 1));
            a.drawImage(src, 0, 0, w, h);
            a.globalAlpha = 1;
            a.globalCompositeOperation = "source-over";

            // Swap buffers: this frame's accumulation becomes next frame's history.
            const buf = entry._buf, bctx = entry._bctx;
            entry._buf = entry._alt; entry._bctx = entry._actx;
            entry._alt = buf;        entry._actx = bctx;

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(entry._buf, 0, 0);
        },
    },
    edge: {
        label: "Edge Detect",
        makeParams: () => ({
            amount: { base: 1, min: 0, max: 1,   mod: { source: "" } }, // 0=original, 1=pure edges
            hue:    { base: 0, min: 0, max: 360, mod: { source: "" } }, // 0=natural white/grey, else tint edges
            thick:  { base: 0, min: 0, max: 8,   mod: { source: "" } }, // pre-blur for thicker/softer edges
            invert: { base: 0, min: 0, max: 1,   mod: { source: "" } }, // >0.5: white BG line-art instead of dark BG neon
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            ctx.filter = "none";
            ctx.globalAlpha = Math.max(0, 1 - p.amount);
            if (p.amount < 0.999) ctx.drawImage(src, 0, 0, w, h);
            ctx.globalAlpha = p.amount;
            if (p.amount > 0.001) {
                // Pre-blur → edge detect → optional color tint.
                // sepia(1)+saturate(10) converts grey edges to saturated color so hue-rotate lands correctly.
                const thickF  = (p.thick  ?? 0) > 0.1   ? `blur(${(p.thick).toFixed(1)}px) ` : "";
                const hue     = Math.round(p.hue ?? 0);
                const colorF  = hue > 0 ? ` sepia(1) saturate(10) hue-rotate(${hue}deg)` : "";
                const invertF = (p.invert ?? 0) > 0.5 ? " invert(1)" : "";
                ctx.filter = `${thickF}url(#edgeDetect)${colorF}${invertF}`;
                ctx.drawImage(src, 0, 0, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.filter = "none";
        },
    },
    chromaticAberration: {
        label: "Chromatic Aberration",
        makeParams: () => ({
            amount: { base: 6,  min: 0,    max: 40,  mod: { source: "" } },
            angle:  { base: 0,  min: -180, max: 180, mod: { source: "" } },
            // radial > 0.5: R scaled up from centre, B scaled down — proper lens
            // barrel dispersion. Overrides angle when active.
            radial: { base: 0,  min: 0,    max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const amt = p.amount;
            if (amt < 0.01) { ctx.drawImage(src, 0, 0, w, h); return; }
            ctx.globalCompositeOperation = "lighter";
            if ((p.radial ?? 0) > 0.5) {
                // Radial: R zoomed out (expands toward edge), B zoomed in
                const sf = amt * 0.004;
                const cx = w / 2, cy = h / 2;
                ctx.filter = "url(#fxExtractR)";
                ctx.save();
                ctx.translate(cx, cy); ctx.scale(1 + sf, 1 + sf); ctx.translate(-cx, -cy);
                ctx.drawImage(src, 0, 0, w, h);
                ctx.restore();
                ctx.filter = "url(#fxExtractG)";
                ctx.drawImage(src, 0, 0, w, h);
                ctx.filter = "url(#fxExtractB)";
                ctx.save();
                ctx.translate(cx, cy); ctx.scale(1 - sf, 1 - sf); ctx.translate(-cx, -cy);
                ctx.drawImage(src, 0, 0, w, h);
                ctx.restore();
            } else {
                // Linear: shift R and B along `angle`
                const a = ((p.angle ?? 0) * Math.PI) / 180;
                const dx = Math.cos(a) * amt, dy = Math.sin(a) * amt;
                ctx.filter = "url(#fxExtractR)";
                ctx.drawImage(src, 0, 0, w, h,  dx,  dy, w, h);
                ctx.filter = "url(#fxExtractG)";
                ctx.drawImage(src, 0, 0, w, h,   0,   0, w, h);
                ctx.filter = "url(#fxExtractB)";
                ctx.drawImage(src, 0, 0, w, h, -dx, -dy, w, h);
            }
            ctx.globalCompositeOperation = "source-over";
            ctx.filter = "none";
        },
    },
    tint: {
        label: "Tint",
        makeParams: () => ({
            hue:    { base: 220, min: 0, max: 360, mod: { source: "" } },
            sat:    { base: 120, min: 0, max: 300, mod: { source: "" } },
            amount: { base: 1,   min: 0, max: 1,   mod: { source: "" } },
        }),
        // A true two-color duotone needs a per-pixel shadow→highlight LUT
        // (not available as a native filter); this is the honest cheap
        // version — grayscale → sepia → hue-rotate is the standard trick to
        // land an image on an arbitrary single hue via native CSS filters.
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            ctx.filter = "none";
            ctx.globalAlpha = Math.max(0, 1 - p.amount);
            if (p.amount < 0.999) ctx.drawImage(src, 0, 0, w, h);
            ctx.globalAlpha = p.amount;
            if (p.amount > 0.001) {
                ctx.filter = `grayscale(1) sepia(1) hue-rotate(${p.hue - 30}deg) saturate(${p.sat}%)`;
                ctx.drawImage(src, 0, 0, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.filter = "none";
        },
    },
    colorAdjust: {
        label: "Color Adjust",
        // Pure CSS filter chain — brightness/contrast/saturate/hue-rotate all run
        // GPU-side at zero extra cost. All params default to 0 = identity so the
        // effect is transparent unless you move a slider.
        makeParams: () => ({
            exposure:   { base: 0,    min: -1,   max: 1,   mod: { source: "" } }, // -1=dark  0=none  1=bright (2× range)
            contrast:   { base: 0,    min: -1,   max: 1,   mod: { source: "" } }, // -1=flat  0=none  1=punchy (mapped 0→2.5)
            saturation: { base: 0,    min: -1,   max: 1,   mod: { source: "" } }, // -1=grey  0=none  1=vivid  (mapped 0→2)
            hue:        { base: 0,    min: -180, max: 180, mod: { source: "" } }, // degrees to rotate all hues
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const bright = (1 + (p.exposure ?? 0)).toFixed(3);        // 0..2
            const cont   = (1 + (p.contrast   ?? 0) * 1.5).toFixed(3); // 0..2.5
            const sat    = (1 + (p.saturation ?? 0)).toFixed(3);       // 0..2
            const hue    = Math.round(p.hue ?? 0);
            ctx.filter = `brightness(${bright}) contrast(${cont}) saturate(${sat}) hue-rotate(${hue}deg)`;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.filter = "none";
        },
    },
    grain: {
        label: "Film Grain",
        // Grain rendered into a tiny downscaled ImageData buffer and GPU-upscaled
        // each frame. overlay blend: neutral grey (128) = no effect, bright grain
        // brightens, dark grain darkens — same math as photographic grain.
        // `scratch` adds slow-drifting vertical scratch marks (film damage).
        makeParams: () => ({
            amount:  { base: 0.3, min: 0, max: 1,  mod: { source: "" } }, // strength
            size:    { base: 3,   min: 1, max: 8,  mod: { source: "" } }, // grain pixel size — smaller=finer, more expensive
            color:   { base: 0,   min: 0, max: 1,  mod: { source: "" } }, // 0=monochrome, 1=chromatic grain
            scratch: { base: 0,   min: 0, max: 1,  mod: { source: "" } }, // film scratch marks
        }),
        apply(src, ctx, w, h, p, entry, t) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            if ((p.amount ?? 0) <= 0.005) return;

            const size    = Math.max(1, Math.round(p.size ?? 3));
            const NW      = Math.ceil(w / size);
            const NH      = Math.ceil(h / size);
            const isColor = (p.color ?? 0) > 0.5;

            if (!entry._gb) {
                entry._gb = document.createElement("canvas");
                entry._gx = entry._gb.getContext("2d");
            }
            if (entry._gb.width !== NW || entry._gb.height !== NH) {
                entry._gb.width = NW; entry._gb.height = NH;
                entry._gd = null;
            }
            if (!entry._gd) entry._gd = entry._gx.createImageData(NW, NH);

            const d   = entry._gd.data;
            const str = p.amount * 110; // max ±deviation from grey-128
            const sc  = str * 0.35;     // chroma spread is subtler than luma
            for (let i = 0; i < d.length; i += 4) {
                const luma = (Math.random() - 0.5) * 2 * str;
                d[i]     = 128 + luma + (isColor ? (Math.random() - 0.5) * 2 * sc : 0);
                d[i + 1] = 128 + luma + (isColor ? (Math.random() - 0.5) * 2 * sc : 0);
                d[i + 2] = 128 + luma + (isColor ? (Math.random() - 0.5) * 2 * sc : 0);
                d[i + 3] = 255;
            }
            entry._gx.putImageData(entry._gd, 0, 0);

            ctx.save();
            ctx.globalCompositeOperation = "overlay";
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(entry._gb, 0, 0, NW, NH, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.restore();

            // Vertical scratch marks: slow-drifting position, seeded from floor(t*1.5)
            // so they hold for ~0.67 s then jump — feels like real film damage.
            if ((p.scratch ?? 0) > 0.005) {
                const now = Number.isFinite(t) ? t : performance.now() / 1000;
                let s = (Math.floor(now * 1.5) ^ 0xc0de) | 1; // 0xc0de: separate RNG stream, avoids phase-lock with other grain effects
                const srng = () => {
                    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
                    return (s >>> 0) / 0x100000000;
                };
                const n = Math.max(1, Math.ceil(p.scratch * 6));
                ctx.save();
                for (let i = 0; i < n; i++) {
                    const x   = Math.round(srng() * w);
                    const wd  = srng() > 0.65 ? 2 : 1;
                    const alp = (0.25 + srng() * 0.45).toFixed(2);
                    ctx.fillStyle = srng() > 0.5
                        ? `rgba(255,255,255,${alp})`
                        : `rgba(0,0,0,${alp})`;
                    ctx.fillRect(x, 0, wd, h);
                }
                ctx.restore();
            }
        },
    },
    zoomPulse: {
        label: "Zoom Pulse",
        // Ported from web/shaders/fxl_zoompulse.wgsl — the original is a
        // per-pixel compute-shader sampler (bilinear zoom/rotate/pan/chroma-
        // split/edge-fade). The zoom+rotate+pan part of that is exactly what
        // a native Canvas2D transform already does, cheaply — no per-pixel
        // sampling needed. Chroma split is dropped here since it's identical
        // to the existing Chromatic Aberration effect (stack both instead of
        // duplicating it). `zoom` is the classic "assign Beat/Onset to this"
        // param for a pulse-on-the-beat blast.
        makeParams: () => ({
            zoom:     { base: 1,   min: 0.3,  max: 3,   mod: { source: "" } },
            rotation: { base: 0,   min: -180, max: 180, mod: { source: "" } },
            panX:     { base: 0,   min: -0.5, max: 0.5, mod: { source: "" } },
            panY:     { base: 0,   min: -0.5, max: 0.5, mod: { source: "" } },
            flipX:    { base: 0,   min: 0,    max: 1,   mod: { source: "" } }, // >0.5 = horizontal mirror
            flipY:    { base: 0,   min: 0,    max: 1,   mod: { source: "" } }, // >0.5 = vertical mirror
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;
            const fx = (p.flipX ?? 0) > 0.5 ? -1 : 1;
            const fy = (p.flipY ?? 0) > 0.5 ? -1 : 1;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.scale(Math.max(0.05, p.zoom) * fx, Math.max(0.05, p.zoom) * fy);
            ctx.translate(-cx + p.panX * w, -cy + p.panY * h);
            ctx.drawImage(src, 0, 0, w, h);
            ctx.restore();
        },
    },
    posterize: {
        label: "Posterize",
        // A real discrete color-level quantize via SVG feComponentTransfer
        // (see index.html's <filter id="posterize">) — not the fake-contrast
        // approximation some tools use. `hue`/`sat` chain sepia+hue-rotate
        // after the posterize step for coloured flat-graphic looks.
        makeParams: () => ({
            levels: { base: 6,   min: 2, max: 32,  mod: { source: "" } },
            hue:    { base: 0,   min: 0, max: 360, mod: { source: "" } },
            sat:    { base: 0,   min: 0, max: 1,   mod: { source: "" } }, // 0=greyscale bands, 1=full colour
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            updatePosterizeTable(p.levels);
            const hue = Math.round(p.hue ?? 0);
            const sat = p.sat ?? 0;
            const colorF = sat > 0.01 ? ` sepia(1) saturate(${(sat * 6).toFixed(2)}) hue-rotate(${hue}deg)` : "";
            ctx.filter = `url(#posterize)${colorF}`;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.filter = "none";
        },
    },
    solarize: {
        label: "Solarize",
        // Real piecewise tone curve via SVG feComponentTransfer (see
        // index.html's <filter id="solarize">) — the classic darkroom
        // solarize look (values above the threshold invert, below pass
        // through), not a contrast/invert approximation.
        makeParams: () => ({
            threshold: { base: 0.5, min: 0,   max: 1,   mod: { source: "" } },
            amount:    { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
            hue:       { base: 0,   min: 0,   max: 360, mod: { source: "" } }, // tint inverted tones
            sat:       { base: 0,   min: 0,   max: 1,   mod: { source: "" } }, // 0=monochrome 1=full colour tint
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            ctx.filter = "none";
            ctx.globalAlpha = Math.max(0, 1 - p.amount);
            if (p.amount < 0.999) ctx.drawImage(src, 0, 0, w, h);
            ctx.globalAlpha = p.amount;
            if (p.amount > 0.001) {
                updateSolarizeTable(p.threshold);
                const hue    = Math.round(p.hue ?? 0);
                const sat    = p.sat ?? 0;
                const colorF = sat > 0.01 ? ` sepia(1) saturate(${(sat * 6).toFixed(2)}) hue-rotate(${hue}deg)` : "";
                ctx.filter = `url(#solarize)${colorF}`;
                ctx.drawImage(src, 0, 0, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.filter = "none";
        },
    },
    scanlines: {
        label: "Scanlines / CRT",
        makeParams: () => ({
            spacing:   { base: 4,   min: 2, max: 16, mod: { source: "" } },
            intensity: { base: 0.4, min: 0, max: 1,  mod: { source: "" } }, // row mask darkness
            cols:      { base: 0,   min: 0, max: 1,  mod: { source: "" } }, // column mask → dot matrix
            glow:      { base: 0,   min: 0, max: 1,  mod: { source: "" } }, // phosphor bleed (lighter blur)
            color:     { base: 0,   min: 0, max: 1,  mod: { source: "" } }, // RGB phosphor triad intensity (multiply) — makes every 3 rows R/G/B
        }),
        apply(src, ctx, w, h, p, entry) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            // Horizontal scanline mask
            if (p.intensity > 0.01) {
                ctx.fillStyle = scanlinePattern(ctx, p.spacing, p.intensity);
                ctx.fillRect(0, 0, w, h);
            }
            // Vertical column mask — combined with scanlines → square pixel grid
            if ((p.cols ?? 0) > 0.01) {
                ctx.fillStyle = colPattern(ctx, p.spacing, p.cols);
                ctx.fillRect(0, 0, w, h);
            }
            // Phosphor glow: blurred source bleeds through the mask from behind.
            // Using lighter blend so the glow only ever adds light, matching how
            // real phosphors emit beyond the aperture mask.
            if ((p.glow ?? 0) > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = p.glow * 0.4;
                ctx.filter = `blur(${Math.max(1, p.spacing * 0.65).toFixed(1)}px)`;
                ctx.drawImage(src, 0, 0, w, h);
                ctx.filter = "none";
                ctx.restore();
            }
            // RGB phosphor triad: 3-row tile (R/G/B) via multiply — matches the
            // sub-pixel layout of real CRT and LED matrix panels. Tile rebuilt only
            // when spacing changes; createPattern is called each frame (cheap).
            if ((p.color ?? 0) > 0.01) {
                const ph = Math.max(1, Math.round(p.spacing));
                if (!entry._pt || entry._ph !== ph) {
                    entry._ph = ph;
                    entry._pt = document.createElement("canvas");
                    entry._pt.width = 1; entry._pt.height = ph * 3;
                    const ptx = entry._pt.getContext("2d");
                    ptx.fillStyle = "rgb(255,70,50)";  ptx.fillRect(0, 0,      1, ph);
                    ptx.fillStyle = "rgb(70,255,70)";  ptx.fillRect(0, ph,     1, ph);
                    ptx.fillStyle = "rgb(50,90,255)";  ptx.fillRect(0, ph * 2, 1, ph);
                }
                ctx.save();
                ctx.globalCompositeOperation = "multiply";
                ctx.globalAlpha = p.color;
                ctx.fillStyle = ctx.createPattern(entry._pt, "repeat");
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }
        },
    },
    mirror: {
        label: "Mirror / Kaleidoscope",
        // The label promised a kaleidoscope and only delivered axis-aligned
        // flips. Mode 3 is the real thing: N wedges around a centre, every
        // other one mirrored so the seams meet instead of pinwheeling.
        // Rotation/zoom/centre apply to every mode — a fold with no control
        // over WHERE it folds is a one-shot effect you use once.
        makeParams: () => ({
            mode:     { base: 0, min: 0, max: 3, mod: { source: "" } }, // 0=L-R 1=T-B 2=quad 3=kaleidoscope
            segments: { base: 6, min: 2, max: 16, mod: { source: "" } }, // kaleidoscope only
            rotation: { base: 0, min: -180, max: 180, mod: { source: "" } },
            zoom:     { base: 1, min: 0.2, max: 4, mod: { source: "" } },
            centerX:  { base: 0, min: -0.5, max: 0.5, mod: { source: "" } },
            centerY:  { base: 0, min: -0.5, max: 0.5, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const mode = Math.round(Math.max(0, Math.min(3, p.mode)));
            const zoom = Math.max(0.05, p.zoom ?? 1);
            const rot = ((p.rotation ?? 0) * Math.PI) / 180;
            const cx = w / 2 + (p.centerX ?? 0) * w;
            const cy = h / 2 + (p.centerY ?? 0) * h;

            // Source drawn through the shared placement transform, so zoom,
            // rotation and centre mean the same thing in every mode.
            const drawSource = (c) => {
                c.save();
                c.translate(cx, cy);
                c.rotate(rot);
                c.scale(zoom, zoom);
                c.translate(-w / 2, -h / 2);
                c.drawImage(src, 0, 0, w, h);
                c.restore();
            };

            if (mode === 3) {
                const segs = Math.max(2, Math.round(p.segments ?? 6));
                const step = (Math.PI * 2) / segs;
                // Radius must reach the far corner from an off-centre pivot,
                // or the wedges leave the frame's corners unpainted.
                const R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
                for (let i = 0; i < segs; i++) {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(rot + i * step);
                    if (i % 2) ctx.scale(1, -1);   // every other wedge mirrored
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, R, -step / 2, step / 2);
                    ctx.closePath();
                    ctx.clip();
                    // Inside the wedge the source is drawn un-rotated (the
                    // wedge itself carries the rotation), centred on the pivot.
                    ctx.scale(zoom, zoom);
                    ctx.translate(-cx, -cy);
                    ctx.drawImage(src, 0, 0, w, h);
                    ctx.restore();
                }
                return;
            }

            // Folds run through scratch buffers and alternate, because in
            // quad mode the vertical fold must act on the HORIZONTAL fold's
            // output. Re-drawing the source for the second fold overwrote the
            // first one's top half, so "quad" was never symmetric in both axes.
            const [bufA, bufB] = foldPair(w, h);
            const actx = bufA.getContext("2d"), bctx = bufB.getContext("2d");
            const reset = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, w, h); };
            reset(actx);
            drawSource(actx);
            let cur = bufA, curCtx = actx, other = bufB, otherCtx = bctx;
            // Half the frame is drawn back flipped. A source RECT rather than a
            // clip — measured identical, and it's the simpler of the two.
            // (The seam lands a single pixel off, which no projected content
            // will show; a sub-pixel-exact fold needs per-pixel sampling.)
            const fold = (horizontal) => {
                reset(otherCtx);
                otherCtx.drawImage(cur, 0, 0, w, h, 0, 0, w, h);
                otherCtx.save();
                if (horizontal) {
                    otherCtx.translate(w, 0); otherCtx.scale(-1, 1);
                    otherCtx.drawImage(cur, 0, 0, Math.ceil(w / 2), h, 0, 0, Math.ceil(w / 2), h);
                } else {
                    otherCtx.translate(0, h); otherCtx.scale(1, -1);
                    otherCtx.drawImage(cur, 0, 0, w, Math.ceil(h / 2), 0, 0, w, Math.ceil(h / 2));
                }
                otherCtx.restore();
                [cur, other] = [other, cur];
                [curCtx, otherCtx] = [otherCtx, curCtx];
            };
            if (mode === 0 || mode === 2) fold(true);
            if (mode === 1 || mode === 2) fold(false);
            ctx.drawImage(cur, 0, 0, w, h, 0, 0, w, h);
        },
    },
    strobe: {
        label: "Strobe",
        // Ported from web/shaders/fxl_strobe.wgsl — full-frame flash pulsing
        // at a rate, on/off duty cycle, in a chosen mode. Uses wall-clock
        // the shared room clock, so machines in a classroom flash together.
        makeParams: () => ({
            rate:      { base: 4,   min: 0.1, max: 20,  mod: { source: "" } }, // Hz — or assign Beat/Onset to `intensity` instead and set rate to 0
            duty:      { base: 0.15,min: 0.02,max: 1,   mod: { source: "" } },
            mode:      { base: 0,   min: 0,   max: 3,   mod: { source: "" } }, // 0=white flash 1=blackout 2=invert 3=colour
            intensity: { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
            hue:       { base: 0,   min: 0,   max: 360, mod: { source: "" } }, // mode 3: flash colour hue
        }),
        apply(src, ctx, w, h, p, entry, t) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            // Room time when it's available: on wall-clock time every machine
            // in a classroom strobed on its own phase, which is exactly the
            // effect you'd most want in step.
            const now = Number.isFinite(t) ? t : performance.now() / 1000;
            const phase = (now * Math.max(p.rate, 0)) % 1;
            const on = (p.rate < 0.01 || phase < Math.max(0, Math.min(1, p.duty))) ? p.intensity : 0;
            if (on < 0.01) return;
            const mode = Math.round(Math.max(0, Math.min(3, p.mode)));
            if (mode === 1) {
                ctx.fillStyle = `rgba(0,0,0,${on})`;
                ctx.fillRect(0, 0, w, h);
            } else if (mode === 2) {
                ctx.globalCompositeOperation = "difference";
                ctx.fillStyle = `rgba(255,255,255,${on})`;
                ctx.fillRect(0, 0, w, h);
                ctx.globalCompositeOperation = "source-over";
            } else if (mode === 3) {
                ctx.fillStyle = `hsla(${Math.round(p.hue ?? 0)},100%,60%,${on})`;
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.fillStyle = `rgba(255,255,255,${on})`;
                ctx.fillRect(0, 0, w, h);
            }
        },
    },
    glitch: {
        label: "Glitch / VHS",
        // Ten independently-driveable sub-effects. vhsBleed adds per-row
        // sinusoidal scanline wobble + chromatic bleed (processed at 320px wide).
        // All Canvas2D: drawImage copies + one tiny putImageData for noise.
        makeParams: () => ({
            intensity: { base: 0.5, min: 0, max: 1,    mod: { source: "" } },
            speed:     { base: 5,   min: 0.1, max: 20,  mod: { source: "" } },
            slices:    { base: 0.6, min: 0, max: 1,    mod: { source: "" } },
            blocks:    { base: 0.3, min: 0, max: 1,    mod: { source: "" } },
            chroma:    { base: 0.3, min: 0, max: 1,    mod: { source: "" } },
            noise:     { base: 0.1, min: 0, max: 1,    mod: { source: "" } },
            roll:      { base: 0,   min: 0, max: 1,    mod: { source: "" } },
            freeze:    { base: 0,   min: 0, max: 1,    mod: { source: "" } },
            vhsBleed:  { base: 0,   min: 0, max: 1,    mod: { source: "" } }, // VHS scanline wobble + chroma bleed
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const now = Number.isFinite(t) ? t : performance.now() / 1000;
            const intensity = Math.max(0, Math.min(1, p.intensity));
            if (intensity < 0.005) {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(src, 0, 0, w, h);
                return;
            }

            // xorshift32 seeded by time×speed — same seed = same glitch pattern,
            // so at low `speed` the frame is stable and only mutates occasionally.
            let s = (Math.floor(now * Math.max(0.1, p.speed) * 100) ^ 0x9e3779b9) | 1;
            const rng = () => {
                s ^= s << 13; s ^= s >> 17; s ^= s << 5;
                return (s >>> 0) / 0x100000000;
            };
            for (let i = 0; i < 6; i++) rng(); // discard first few (seed→state)

            let source = src;

            // ── Frame freeze / stutter ────────────────────────────────────
            const freeze = Math.max(0, p.freeze);
            if (freeze > 0.005) {
                if (!entry._fb || entry._fb.width !== w || entry._fb.height !== h) {
                    entry._fb = document.createElement("canvas");
                    entry._fb.width = w; entry._fb.height = h;
                    entry._fbx = entry._fb.getContext("2d");
                    entry._fbUntil = 0;
                }
                if (now > (entry._fbUntil || 0)) {
                    // Not currently frozen: refresh the held frame and maybe start a new freeze.
                    entry._fbx.clearRect(0, 0, w, h);
                    entry._fbx.drawImage(src, 0, 0, w, h);
                    if (rng() < freeze * intensity * 0.15) {
                        entry._fbUntil = now + 0.04 + rng() * 0.28;
                    }
                }
                source = entry._fb;
            }

            // ── VHS scanline bleed ────────────────────────────────────────
            // Per-row sinusoidal shift + 1px R/B chroma bleed, processed at
            // ≤320px wide (fast) then upscaled. Replaces the standalone VHS FX.
            const vhsBleed = Math.max(0, p.vhsBleed ?? 0);
            if (vhsBleed > 0.005) {
                const VW = Math.min(w, 320);
                if (!entry._vhsC || entry._vhsC.width !== VW || entry._vhsC.height !== h) {
                    entry._vhsC = document.createElement("canvas");
                    entry._vhsC.width = VW; entry._vhsC.height = h;
                    entry._vhsX = entry._vhsC.getContext("2d", { willReadFrequently: true });
                }
                if (!entry._vhsSrc || entry._vhsSrc.width !== w || entry._vhsSrc.height !== h) {
                    entry._vhsSrc = document.createElement("canvas");
                    entry._vhsSrc.width = w; entry._vhsSrc.height = h;
                    entry._vhsSrcX = entry._vhsSrc.getContext("2d");
                }
                entry._vhsX.clearRect(0, 0, VW, h);
                entry._vhsX.drawImage(source, 0, 0, VW, h);
                const vid = entry._vhsX.getImageData(0, 0, VW, h);
                const vu32 = new Uint32Array(vid.data.buffer);
                const maxOff = Math.max(0, Math.round(vhsBleed * 5 * intensity));
                const rowBuf = new Uint32Array(VW);
                // Pass 1: sinusoidal scanline shift
                if (maxOff > 0) {
                    for (let y = 0; y < h; y++) {
                        const rs = y * VW;
                        const off = Math.round(Math.sin(y * 0.05 + now * 7) * maxOff);
                        if (off !== 0) {
                            rowBuf.set(vu32.subarray(rs, rs + VW));
                            for (let x = 0; x < VW; x++) vu32[rs + x] = rowBuf[Math.max(0, Math.min(VW - 1, x - off))];
                        }
                    }
                }
                // Pass 2: chromatic bleed — R +1px, B -1px (scaled to full-res by drawImage)
                if (vhsBleed > 0.1) {
                    for (let y = 0; y < h; y++) {
                        const rs = y * VW;
                        rowBuf.set(vu32.subarray(rs, rs + VW));
                        for (let x = 0; x < VW; x++) {
                            const newR = rowBuf[Math.min(VW - 1, x + 1)] & 0xff;
                            const newG = (rowBuf[x] >> 8) & 0xff;
                            const newB = (rowBuf[Math.max(0, x - 1)] >> 16) & 0xff;
                            vu32[rs + x] = (0xff << 24) | (newB << 16) | (newG << 8) | newR;
                        }
                    }
                }
                entry._vhsX.putImageData(vid, 0, 0);
                entry._vhsSrcX.clearRect(0, 0, w, h);
                entry._vhsSrcX.drawImage(entry._vhsC, 0, 0, VW, h, 0, 0, w, h);
                source = entry._vhsSrc;
            }

            // ── VHS vertical roll ─────────────────────────────────────────
            const roll = Math.max(0, p.roll);
            if (roll > 0.005) {
                if (!entry._rb || entry._rb.width !== w || entry._rb.height !== h) {
                    entry._rb = document.createElement("canvas");
                    entry._rb.width = w; entry._rb.height = h;
                    entry._rx = entry._rb.getContext("2d");
                }
                // Jump every ~0.5 s (based on speed) rather than smooth scroll —
                // matches the discontinuous head-switch noise of real tape.
                const jumpSeed = (Math.floor(now * 2 * (roll + 0.1)) ^ 0x1234) | 1;
                let js = jumpSeed;
                js ^= js << 13; js ^= js >> 17; js ^= js << 5;
                const rollY = Math.round(((js >>> 0) / 0x100000000 * 0.2 + (now * 30 * roll * intensity % 0.2)) * h) % h;
                entry._rx.clearRect(0, 0, w, h);
                entry._rx.drawImage(source, 0, 0, w, h, 0, rollY, w, h);
                if (rollY > 0) entry._rx.drawImage(source, 0, 0, w, h, 0, rollY - h, w, h);
                source = entry._rb;
            }

            ctx.clearRect(0, 0, w, h);

            // ── Horizontal slice displacement ─────────────────────────────
            const slices = Math.max(0, p.slices) * intensity;
            if (slices > 0.005) {
                const numSlices = Math.max(4, Math.round(8 + 32 * slices));
                const sliceH = Math.ceil(h / numSlices);
                let y = 0;
                while (y < h) {
                    const sh = Math.min(sliceH, h - y);
                    // Displaced slices are NOT wrapped — the uncovered strip stays
                    // black (ctx was cleared), which is the authentic digital-glitch look.
                    const off = (rng() < slices * 0.75) ? Math.round((rng() - 0.5) * w * slices * 0.55) : 0;
                    ctx.drawImage(source, 0, y, w, sh, off, y, w, sh);
                    y += sh;
                }
            } else {
                ctx.drawImage(source, 0, 0, w, h);
            }

            // ── Block corruption ──────────────────────────────────────────
            const blocks = Math.max(0, p.blocks) * intensity;
            if (blocks > 0.005) {
                const n = Math.floor(rng() * 10 * blocks);
                for (let i = 0; i < n; i++) {
                    const bw = Math.max(4, Math.round(rng() * w * 0.4));
                    const bh = Math.max(2, Math.round(rng() * h * 0.18));
                    const sx = Math.floor(rng() * Math.max(1, w - bw));
                    const sy = Math.floor(rng() * Math.max(1, h - bh));
                    const dx = Math.floor(rng() * Math.max(1, w - bw));
                    const dy = Math.floor(rng() * Math.max(1, h - bh));
                    ctx.drawImage(source, sx, sy, bw, bh, dx, dy, bw, bh);
                }
            }

            // ── RGB channel split (jittery per-frame) ─────────────────────
            // Added ON TOP of the sliced output using `lighter` blend — the
            // R and B ghosts add a burned chromatic fringe to already-displaced
            // areas, which is characteristic of real codec/transmission glitch.
            const chroma = Math.max(0, p.chroma) * intensity;
            if (chroma > 0.005) {
                const cx = Math.round((rng() - 0.5) * w * chroma * 0.09);
                const cy = Math.round((rng() - 0.5) * h * chroma * 0.04);
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = Math.min(0.75, chroma * 0.85);
                ctx.filter = "url(#fxExtractR)";
                ctx.drawImage(source, 0, 0, w, h,  cx,  cy, w, h);
                ctx.filter = "url(#fxExtractB)";
                ctx.drawImage(source, 0, 0, w, h, -cx, -cy, w, h);
                ctx.filter = "none";
                ctx.restore();
            }

            // ── Digital noise overlay ─────────────────────────────────────
            // Runs on a tiny 96×NH buffer (putImageData ~5 k pixels max),
            // upscaled via drawImage — fast even at 60 fps.
            const noise = Math.max(0, p.noise) * intensity;
            if (noise > 0.005) {
                const NW = 96, NH = Math.max(1, Math.round(NW * h / w));
                if (!entry._nb) {
                    entry._nb = document.createElement("canvas");
                    entry._nx = entry._nb.getContext("2d");
                }
                if (entry._nb.width !== NW || entry._nb.height !== NH) {
                    entry._nb.width = NW; entry._nb.height = NH;
                    entry._nd = null;
                }
                if (!entry._nd) entry._nd = entry._nx.createImageData(NW, NH);
                const d = entry._nd.data;
                const thresh = noise * 0.45;
                for (let i = 0; i < d.length; i += 4) {
                    if (rng() < thresh) {
                        d[i]     = Math.floor(rng() * 256);
                        d[i + 1] = Math.floor(rng() * 256);
                        d[i + 2] = Math.floor(rng() * 256);
                        d[i + 3] = 140 + Math.floor(rng() * 115);
                    } else {
                        d[i + 3] = 0;
                    }
                }
                entry._nx.putImageData(entry._nd, 0, 0);
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.globalAlpha = Math.min(1, noise * 1.2);
                ctx.drawImage(entry._nb, 0, 0, NW, NH, 0, 0, w, h);
                ctx.restore();
            }
        },
    },
    ripple: {
        label: "Ripple / Warp",
        // Draws image in thin strips, each shifted by a sine wave offset.
        // strip height = ceil(amplitude/15) so sub-pixel jaggies stay invisible.
        // direction 0=horizontal rows  1=vertical columns  2=both (H→tmp→V)
        makeParams: () => ({
            amplitude:  { base: 8,  min: 0, max: 60,  mod: { source: "" } }, // pixels of max displacement
            frequency:  { base: 20, min: 2, max: 80,  mod: { source: "" } }, // pixels per sine cycle
            speed:      { base: 1,  min: 0, max: 5,   mod: { source: "" } }, // cycles per second
            direction:  { base: 0,  min: 0, max: 2,   mod: { source: "" } }, // 0=H  1=V  2=both
            complexity: { base: 0,  min: 0, max: 1,   mod: { source: "" } }, // second harmonic at ~2.3× freq — organic interference
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const amp   = p.amplitude  ?? 8;
            const freq  = Math.max(1, p.frequency ?? 20);
            const now   = Number.isFinite(t) ? t : 0;
            const spd   = (p.speed ?? 1) * now * Math.PI * 2;
            const dir   = Math.round(p.direction ?? 0);
            const step  = Math.max(1, Math.ceil(amp / 15));
            const cmplx = p.complexity ?? 0;

            ctx.clearRect(0, 0, w, h);
            if (amp < 0.5) { ctx.drawImage(src, 0, 0, w, h); return; }

            const drawH = (from, to, phase) => {
                for (let y = 0; y < h; y += step) {
                    const sh = Math.min(step, h - y);
                    const ox = Math.sin(y / freq + phase) * amp
                             + (cmplx > 0.01 ? Math.sin(y / (freq * 0.43) + phase * 1.3) * amp * cmplx * 0.35 : 0);
                    to.drawImage(from, ox,                       y, w, sh, 0, y, w, sh);
                    to.drawImage(from, ox + (ox > 0 ? -w : w),  y, w, sh, 0, y, w, sh);
                }
            };
            const drawV = (from, to, phase) => {
                for (let x = 0; x < w; x += step) {
                    const sw = Math.min(step, w - x);
                    const oy = Math.sin(x / freq + phase) * amp
                             + (cmplx > 0.01 ? Math.sin(x / (freq * 0.43) + phase * 1.3) * amp * cmplx * 0.35 : 0);
                    to.drawImage(from, x, oy,                       sw, h, x, 0, sw, h);
                    to.drawImage(from, x, oy + (oy > 0 ? -h : h),  sw, h, x, 0, sw, h);
                }
            };

            if (dir === 0) { drawH(src, ctx, spd); return; }
            if (dir === 1) { drawV(src, ctx, spd); return; }

            // Both: H pass into temp canvas, then V pass from temp into ctx
            if (!entry._rb) { entry._rb = document.createElement("canvas"); entry._rx = entry._rb.getContext("2d"); }
            if (entry._rb.width !== w || entry._rb.height !== h) { entry._rb.width = w; entry._rb.height = h; }
            entry._rx.clearRect(0, 0, w, h);
            drawH(src, entry._rx, spd);
            drawV(entry._rb, ctx, spd * 0.7);
        },
    },
    threshold: {
        label: "Threshold",
        // CSS-only: grayscale + brightness-shift + high contrast creates a hard step at `level`.
        // `soft` eases contrast from 20 (hard clip) toward 1 (original image).
        // `hue`+`sat` add a monochrome tint via sepia → saturate → hue-rotate.
        makeParams: () => ({
            level: { base: 0.5, min: 0,   max: 1,   mod: { source: "" } }, // luminance cutoff 0..1
            soft:  { base: 0,   min: 0,   max: 1,   mod: { source: "" } }, // 0=hard clip  1=gentle
            hue:   { base: 0,   min: 0,   max: 360, mod: { source: "" } }, // tint hue degrees
            sat:   { base: 0,   min: 0,   max: 1,   mod: { source: "" } }, // tint saturation
        }),
        apply(src, ctx, w, h, p) {
            const lvl   = Math.max(0.001, p.level ?? 0.5);
            const cont  = (1 + (1 - (p.soft ?? 0)) * 19).toFixed(1); // 20..1
            const brite = (0.5 / lvl).toFixed(3);
            const hue   = Math.round(p.hue ?? 0);
            const sat   = p.sat ?? 0;
            const colorF = sat > 0.01
                ? ` sepia(1) saturate(${(sat * 8).toFixed(2)}) hue-rotate(${hue}deg)`
                : "";
            ctx.clearRect(0, 0, w, h);
            ctx.filter = `grayscale(1) brightness(${brite}) contrast(${cont})${colorF}`;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.filter = "none";
        },
    },
    pixelSort: {
        label: "Pixel Sort",
        // Downscales src to (w/size × h/size), sorts each row (or column)
        // by key within above-threshold segments, then upscales back.
        // size trades resolution for speed; at size=4 even 1080p is fast.
        makeParams: () => ({
            threshold: { base: 0.45, min: 0,   max: 1,   mod: { source: "" } }, // luma gate — below = anchor
            maxLen:    { base: 0.4,  min: 0.02, max: 1,   mod: { source: "" } }, // max sorted segment (fraction of row)
            blend:     { base: 0.85, min: 0,   max: 1,   mod: { source: "" } }, // mix sorted vs original
            direction: { base: 0,   min: 0,    max: 1,   mod: { source: "" } }, // 0=rows  1=columns
            key:       { base: 0,   min: 0,    max: 2,   mod: { source: "" } }, // 0=luma  1=hue  2=sat
            size:      { base: 4,   min: 1,    max: 12,  mod: { source: "" } }, // pixel block size
        }),
        apply(src, ctx, w, h, p, entry) {
            const thresh  = p.threshold ?? 0.45;
            const maxLen  = p.maxLen    ?? 0.4;
            const blend   = p.blend     ?? 0.85;
            const dir     = Math.round(p.direction ?? 0);
            const key     = Math.round(p.key ?? 0);
            const size    = Math.max(1, Math.round(p.size ?? 4));
            const SW      = Math.ceil(w / size);
            const SH      = Math.ceil(h / size);
            const maxSegW = Math.max(1, (SW * maxLen) | 0);
            const maxSegH = Math.max(1, (SH * maxLen) | 0);

            if (!entry._psb) {
                entry._psb = document.createElement("canvas");
                entry._psx = entry._psb.getContext("2d", { willReadFrequently: true });
            }
            if (entry._psb.width !== SW || entry._psb.height !== SH) {
                entry._psb.width = SW; entry._psb.height = SH;
            }
            entry._psx.clearRect(0, 0, SW, SH);
            entry._psx.drawImage(src, 0, 0, w, h, 0, 0, SW, SH);
            const id = entry._psx.getImageData(0, 0, SW, SH);
            const d  = id.data;

            const lumaAt = (i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
            const keyOf  = (i) => {
                if (key === 0) return lumaAt(i);
                const r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
                const mx = Math.max(r,g,b), mn = Math.min(r,g,b), delta = mx - mn;
                if (key === 2) return mx < 0.001 ? 0 : delta / mx;
                if (delta < 0.001) return 0;
                let hv = mx === r ? (g-b)/delta : mx === g ? 2+(b-r)/delta : 4+(r-g)/delta;
                return ((hv * 60) + 360) % 360 / 360;
            };

            const flushSeg = (seg, x0, y0, horizontal) => {
                if (seg.length < 2) return;
                seg.sort((a, b) => a[0] - b[0]);
                for (let j = 0; j < seg.length; j++) {
                    const wi = horizontal ? (y0 * SW + x0 + j) * 4 : ((y0 + j) * SW + x0) * 4;
                    d[wi]=seg[j][1]; d[wi+1]=seg[j][2]; d[wi+2]=seg[j][3]; d[wi+3]=seg[j][4];
                }
            };

            // Sorts bright (above-threshold) pixel segments, capped at maxLen.
            // Iterates one past end so any open segment at the boundary gets flushed.
            if (dir === 0) {
                for (let y = 0; y < SH; y++) {
                    let seg = [], x0 = 0;
                    for (let x = 0; x <= SW; x++) {
                        const above = x < SW && lumaAt((y * SW + x) * 4) >= thresh;
                        if (above) {
                            if (!seg.length) x0 = x;
                            const i = (y * SW + x) * 4;
                            seg.push([keyOf(i), d[i], d[i+1], d[i+2], d[i+3]]);
                            if (seg.length >= maxSegW) { flushSeg(seg, x0, y, true); seg = []; }
                        }
                        if (!above && seg.length) { flushSeg(seg, x0, y, true); seg = []; }
                    }
                }
            } else {
                for (let x = 0; x < SW; x++) {
                    let seg = [], y0 = 0;
                    for (let y = 0; y <= SH; y++) {
                        const above = y < SH && lumaAt((y * SW + x) * 4) >= thresh;
                        if (above) {
                            if (!seg.length) y0 = y;
                            const i = (y * SW + x) * 4;
                            seg.push([keyOf(i), d[i], d[i+1], d[i+2], d[i+3]]);
                            if (seg.length >= maxSegH) { flushSeg(seg, x, y0, false); seg = []; }
                        }
                        if (!above && seg.length) { flushSeg(seg, x, y0, false); seg = []; }
                    }
                }
            }

            entry._psx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = size <= 2;
            if (blend >= 0.999) {
                ctx.drawImage(entry._psb, 0, 0, SW, SH, 0, 0, w, h);
            } else {
                // blend < 1: original underneath, sorted on top at `blend` alpha
                ctx.drawImage(src, 0, 0, w, h);
                ctx.globalAlpha = blend;
                ctx.drawImage(entry._psb, 0, 0, SW, SH, 0, 0, w, h);
                ctx.globalAlpha = 1;
            }
            ctx.imageSmoothingEnabled = true;
        },
    },
    chromaKey: {
        label: "Chroma / Luma Key",
        // Keys out a colour range or luminance range, setting matched pixels to
        // alpha=0 so layers beneath this channel show through. Operate at a
        // reduced resolution (size) to keep getImageData affordable each frame.
        makeParams: () => ({
            mode:  { base: 0,   min: 0, max: 1,   mod: { source: "" } }, // 0=luma  1=chroma
            hue:   { base: 120, min: 0, max: 360, mod: { source: "" } }, // chroma: key hue (120=green)
            range: { base: 0.3, min: 0, max: 1,   mod: { source: "" } }, // chroma tolerance (hue wrap-aware)
            level: { base: 0.5, min: 0, max: 1,   mod: { source: "" } }, // luma: key below this cutoff
            size:  { base: 2,   min: 1, max: 8,   mod: { source: "" } }, // downscale — lower=sharper, costlier
        }),
        apply(src, ctx, w, h, p, entry) {
            const mode  = Math.round(p.mode  ?? 0);
            const keyH  = (p.hue   ?? 120) / 360; // normalised 0..1
            const range = p.range  ?? 0.3;
            const level = p.level  ?? 0.5;
            const size  = Math.max(1, Math.round(p.size ?? 2));
            const SW    = Math.ceil(w / size);
            const SH    = Math.ceil(h / size);

            if (!entry._ckb) {
                entry._ckb = document.createElement("canvas");
                entry._ckx = entry._ckb.getContext("2d", { willReadFrequently: true });
            }
            if (entry._ckb.width !== SW || entry._ckb.height !== SH) {
                entry._ckb.width = SW; entry._ckb.height = SH;
            }
            entry._ckx.clearRect(0, 0, SW, SH);
            entry._ckx.drawImage(src, 0, 0, w, h, 0, 0, SW, SH);
            const id = entry._ckx.getImageData(0, 0, SW, SH);
            const d  = id.data;

            for (let i = 0; i < d.length; i += 4) {
                const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
                if (mode === 0) {
                    // Luma key: make dark pixels transparent
                    if ((0.299*r + 0.587*g + 0.114*b) < level) d[i+3] = 0;
                } else {
                    // Chroma key: skip near-grey and near-black (no defined hue)
                    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), delta = mx - mn;
                    if (delta > 0.08 && mx > 0.08) {
                        let hv = mx === r ? (g-b)/delta : mx === g ? 2+(b-r)/delta : 4+(r-g)/delta;
                        hv = ((hv / 6) + 1) % 1;
                        const hdist = Math.min(Math.abs(hv - keyH), 1 - Math.abs(hv - keyH));
                        if (hdist < range * 0.5) d[i+3] = 0;
                    }
                }
            }

            entry._ckx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(entry._ckb, 0, 0, SW, SH, 0, 0, w, h);
        },
    },
    duotone: {
        label: "Duotone",
        // Per-pixel gradient map: each pixel's luminance drives a lerp from
        // shadow colour to highlight colour. size=downscale for perf (still
        // smoothly upscaled via bilinear). Ported from web/shaders concept.
        makeParams: () => ({
            shadowHue:    { base: 220, min: 0, max: 360, mod: { source: "" } },
            highlightHue: { base: 60,  min: 0, max: 360, mod: { source: "" } },
            saturation:   { base: 1,   min: 0, max: 1,   mod: { source: "" } },
            amount:       { base: 1,   min: 0, max: 1,   mod: { source: "" } },
            size:         { base: 4,   min: 1, max: 8,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            const size = Math.max(1, Math.round(p.size ?? 4));
            const SW = Math.ceil(w / size), SH = Math.ceil(h / size);
            if (!entry._db) {
                entry._db = document.createElement("canvas");
                entry._dx = entry._db.getContext("2d", { willReadFrequently: true });
            }
            if (entry._db.width !== SW || entry._db.height !== SH) {
                entry._db.width = SW; entry._db.height = SH;
            }
            entry._dx.drawImage(src, 0, 0, w, h, 0, 0, SW, SH);
            const id = entry._dx.getImageData(0, 0, SW, SH);
            const d  = id.data;
            const sh = p.shadowHue ?? 220, hh = p.highlightHue ?? 60;
            const sat = Math.max(0, Math.min(1, p.saturation ?? 1));
            // HSL → RGB for the two poles
            const hslToRgb = (h, s, l) => {
                h /= 360;
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q;
                const hue2rgb = (p2, q2, t2) => {
                    t2 = ((t2 % 1) + 1) % 1;
                    return t2 < 1/6 ? p2+(q2-p2)*6*t2 : t2 < 0.5 ? q2 : t2 < 2/3 ? p2+(q2-p2)*(2/3-t2)*6 : p2;
                };
                return [hue2rgb(p2,q,h+1/3)*255, hue2rgb(p2,q,h)*255, hue2rgb(p2,q,h-1/3)*255];
            };
            const sr = hslToRgb(sh, sat, 0.12), hr = hslToRgb(hh, sat, 0.88);
            for (let i = 0; i < d.length; i += 4) {
                const luma = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) / 255;
                d[i]   = sr[0] + (hr[0] - sr[0]) * luma;
                d[i+1] = sr[1] + (hr[1] - sr[1]) * luma;
                d[i+2] = sr[2] + (hr[2] - sr[2]) * luma;
            }
            entry._dx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            const amt = Math.max(0, Math.min(1, p.amount ?? 1));
            if (amt < 0.999) { ctx.globalAlpha = 1 - amt; ctx.drawImage(src, 0, 0, w, h); }
            ctx.globalAlpha = amt;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(entry._db, 0, 0, SW, SH, 0, 0, w, h);
            ctx.globalAlpha = 1;
        },
    },
    ascii: {
        label: "ASCII Art",
        // Downscale the source to a character grid, pick a density character
        // per cell from luma, and draw it with fillText. Monospace font so
        // every cell is uniform. Performance: at cellSize=12, ~15k fillText
        // calls per frame — acceptable at 60fps.
        makeParams: () => ({
            cellSize:  { base: 12, min: 8,   max: 32, mod: { source: "" } },
            hue:       { base: 120, min: 0,  max: 360, mod: { source: "" } },
            colorMode: { base: 0,  min: 0,   max: 1,  mod: { source: "" } }, // 0=mono-hue  1=source color
            invert:    { base: 0,  min: 0,   max: 1,  mod: { source: "" } }, // >0.5 = light bg / dark chars
        }),
        apply(src, ctx, w, h, p, entry) {
            const cell = Math.max(6, Math.round(p.cellSize ?? 12));
            const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
            if (!entry._ab) {
                entry._ab = document.createElement("canvas");
                entry._ax = entry._ab.getContext("2d", { willReadFrequently: true });
            }
            if (entry._ab.width !== cols || entry._ab.height !== rows) {
                entry._ab.width = cols; entry._ab.height = rows;
            }
            entry._ax.drawImage(src, 0, 0, w, h, 0, 0, cols, rows);
            const id = entry._ax.getImageData(0, 0, cols, rows);
            const d  = id.data;

            const chars   = " .·:;+=xX$#█";
            const nc      = chars.length;
            const inv     = (p.invert ?? 0) > 0.5;
            const colorSrc = Math.round(p.colorMode ?? 0) > 0;
            const hue     = Math.round(p.hue ?? 120);

            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = inv ? "#eee" : "#000";
            ctx.fillRect(0, 0, w, h);
            ctx.font = `${cell}px monospace`;
            ctx.textBaseline = "top";

            for (let iy = 0; iy < rows; iy++) {
                for (let ix = 0; ix < cols; ix++) {
                    const idx = (iy * cols + ix) * 4;
                    const r = d[idx], g = d[idx+1], b = d[idx+2];
                    let luma = (0.299*r + 0.587*g + 0.114*b) / 255;
                    if (inv) luma = 1 - luma;
                    const ci = Math.min(nc - 1, Math.floor(luma * nc));
                    if (ci === 0) continue;
                    ctx.fillStyle = colorSrc
                        ? `rgb(${r},${g},${b})`
                        : `hsl(${hue},60%,${Math.round(20 + luma * 70)}%)`;
                    ctx.fillText(chars[ci], ix * cell, iy * cell);
                }
            }
        },
    },
    halftone: {
        label: "Halftone",
        // Classic print halftone: dot size scales with luma (or inverted).
        // Mono mode batches all circles into one path per frame (fast).
        // Color mode draws one circle per cell with source color (slower at small cell).
        makeParams: () => ({
            cellSize:  { base: 10, min: 4,  max: 40, mod: { source: "" } },
            mode:      { base: 0,  min: 0,  max: 1,  mod: { source: "" } }, // 0=circles  1=lines
            mono:      { base: 1,  min: 0,  max: 1,  mod: { source: "" } }, // >0.5 = white on black
            hue:       { base: 0,  min: 0,  max: 360, mod: { source: "" } }, // mono tint (0=white)
            invert:    { base: 0,  min: 0,  max: 1,  mod: { source: "" } }, // >0.5 = dark dots on white
        }),
        apply(src, ctx, w, h, p, entry) {
            const cell = Math.max(4, Math.round(p.cellSize ?? 10));
            const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
            const mode = Math.round(p.mode ?? 0);
            const mono = (p.mono ?? 1) > 0.5;
            const inv  = (p.invert ?? 0) > 0.5;
            const hue  = Math.round(p.hue ?? 0);
            const halfCell = cell / 2;

            if (!entry._hb) {
                entry._hb = document.createElement("canvas");
                entry._hx = entry._hb.getContext("2d", { willReadFrequently: true });
            }
            if (entry._hb.width !== cols || entry._hb.height !== rows) {
                entry._hb.width = cols; entry._hb.height = rows;
            }
            entry._hx.drawImage(src, 0, 0, w, h, 0, 0, cols, rows);
            const id = entry._hx.getImageData(0, 0, cols, rows);
            const d  = id.data;

            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = inv ? "#fff" : "#000";
            ctx.fillRect(0, 0, w, h);

            if (mode === 0) {
                // Circles
                if (mono) {
                    ctx.fillStyle = hue > 0 ? `hsl(${hue},70%,75%)` : (inv ? "#000" : "#fff");
                    ctx.beginPath();
                    for (let iy = 0; iy < rows; iy++) {
                        for (let ix = 0; ix < cols; ix++) {
                            const idx = (iy * cols + ix) * 4;
                            let luma = (0.299*d[idx] + 0.587*d[idx+1] + 0.114*d[idx+2]) / 255;
                            if (inv) luma = 1 - luma;
                            if (luma < 0.03) continue;
                            const cx = ix * cell + halfCell, cy = iy * cell + halfCell;
                            const r  = halfCell * 0.95 * Math.sqrt(luma);
                            ctx.moveTo(cx + r, cy);
                            ctx.arc(cx, cy, r, 0, 6.28);
                        }
                    }
                    ctx.fill();
                } else {
                    // Color per-cell: individual draw calls
                    for (let iy = 0; iy < rows; iy++) {
                        for (let ix = 0; ix < cols; ix++) {
                            const idx = (iy * cols + ix) * 4;
                            const r = d[idx], g = d[idx+1], b = d[idx+2];
                            let luma = (0.299*r + 0.587*g + 0.114*b) / 255;
                            if (inv) luma = 1 - luma;
                            if (luma < 0.03) continue;
                            const cx = ix * cell + halfCell, cy = iy * cell + halfCell;
                            const radius = halfCell * 0.95 * Math.sqrt(luma);
                            ctx.fillStyle = `rgb(${r},${g},${b})`;
                            ctx.beginPath();
                            ctx.arc(cx, cy, radius, 0, 6.28);
                            ctx.fill();
                        }
                    }
                }
            } else {
                // Lines: vertical bars, width = luma * cell
                for (let iy = 0; iy < rows; iy++) {
                    for (let ix = 0; ix < cols; ix++) {
                        const idx = (iy * cols + ix) * 4;
                        const r = d[idx], g = d[idx+1], b = d[idx+2];
                        let luma = (0.299*r + 0.587*g + 0.114*b) / 255;
                        if (inv) luma = 1 - luma;
                        if (luma < 0.03) continue;
                        const lw = Math.max(0.5, luma * cell * 0.9);
                        const cx = ix * cell + halfCell;
                        ctx.fillStyle = mono
                            ? (hue > 0 ? `hsl(${hue},70%,75%)` : "#fff")
                            : `rgb(${r},${g},${b})`;
                        ctx.fillRect(cx - lw / 2, iy * cell, lw, cell);
                    }
                }
            }
        },
    },
    hueRotate: {
        label: "Hue Rotate",
        // Time-driven hue rotation via CSS filter — zero CPU cost.
        // Wire speed to an audio band or LFO for colour-cycling sync.
        makeParams: () => ({
            speed:  { base: 30,  min: -360, max: 360, mod: { source: "" } }, // °/sec
            offset: { base: 0,   min: 0,    max: 360, mod: { source: "" } }, // static phase
            amount: { base: 1,   min: 0,    max: 1,   mod: { source: "" } }, // mix with original
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const now = Number.isFinite(t) ? t : performance.now() / 1000;
            const deg = ((now * (p.speed ?? 30)) + (p.offset ?? 0)) % 360;
            ctx.clearRect(0, 0, w, h);
            const amt = Math.max(0, Math.min(1, p.amount ?? 1));
            if (amt < 0.999) {
                ctx.globalAlpha = 1 - amt;
                ctx.drawImage(src, 0, 0, w, h);
            }
            ctx.globalAlpha = amt;
            ctx.filter = `hue-rotate(${deg.toFixed(1)}deg)`;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.filter = "none";
            ctx.globalAlpha = 1;
        },
    },
    // ── 5 new FX ──────────────────────────────────────────────────────────────
    datamosh: {
        label: "Datamosh",
        makeParams: () => ({
            blocks:   { base: 24,  min: 4,   max: 80,  mod: { source: "" } }, // number of scrambled blocks
            shift:    { base: 0.1, min: 0,   max: 0.5, mod: { source: "" } }, // max position offset (fraction of canvas)
            amount:   { base: 0.6, min: 0,   max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            if ((p.amount ?? 0.6) < 0.01) return;
            const n      = Math.round(p.blocks ?? 24);
            const maxSh  = (p.shift  ?? 0.1) * Math.min(w, h);
            ctx.globalAlpha = p.amount ?? 0.6;
            for (let i = 0; i < n; i++) {
                const bw = w * (0.05 + Math.random() * 0.25) | 0;
                const bh = h * (0.04 + Math.random() * 0.18) | 0;
                const sx = (Math.random() * (w - bw)) | 0;
                const sy = (Math.random() * (h - bh)) | 0;
                const dx = sx + (Math.random() - 0.5) * maxSh * 2 | 0;
                const dy = sy + (Math.random() - 0.5) * maxSh * 0.4 | 0;
                ctx.drawImage(src, sx, sy, bw, bh, dx, dy, bw, bh);
            }
            ctx.globalAlpha = 1;
        },
    },
    thermal: {
        label: "Thermal",
        makeParams: () => ({
            amount: { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
            range:  { base: 1,   min: 0.2, max: 2,   mod: { source: "" } }, // palette contrast
        }),
        apply(src, ctx, w, h, p, entry) {
            if ((p.amount ?? 1) < 0.01) { ctx.clearRect(0, 0, w, h); ctx.drawImage(src, 0, 0, w, h); return; }
            // Build/reuse a 64px-wide downscale buffer — cheap luma sampling
            const SW = 64, SH = Math.round(h / w * SW) || 48;
            if (!entry._tb || entry._tb.width !== SW) {
                entry._tb = document.createElement("canvas"); entry._tb.width = SW; entry._tb.height = SH;
                entry._tx = entry._tb.getContext("2d", { willReadFrequently: true });
            }
            entry._tx.drawImage(src, 0, 0, SW, SH);
            const id = entry._tx.getImageData(0, 0, SW, SH);
            const dd = id.data;
            // Thermal palette: black → purple → red → orange → yellow → white
            const TP = [[0,0,0],[60,0,100],[180,0,20],[255,60,0],[255,180,0],[255,255,100],[255,255,255]];
            const range = Math.max(0.2, p.range ?? 1);
            for (let i = 0; i < SW * SH; i++) {
                const luma = Math.min(1, (0.299*dd[i*4]+0.587*dd[i*4+1]+0.114*dd[i*4+2])/255 * range);
                const fi   = luma * (TP.length - 1);
                const lo   = Math.floor(fi), hi = Math.min(TP.length - 1, lo + 1);
                const ft   = fi - lo;
                dd[i*4]   = TP[lo][0] + (TP[hi][0]-TP[lo][0]) * ft | 0;
                dd[i*4+1] = TP[lo][1] + (TP[hi][1]-TP[lo][1]) * ft | 0;
                dd[i*4+2] = TP[lo][2] + (TP[hi][2]-TP[lo][2]) * ft | 0;
            }
            entry._tx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = p.amount ?? 1;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(entry._tb, 0, 0, w, h);
            ctx.globalAlpha = 1;
        },
    },
    sliceGlitch: {
        label: "Slice Glitch",
        makeParams: () => ({
            slices:  { base: 12,  min: 2,   max: 40,  mod: { source: "" } }, // number of horizontal bands
            shift:   { base: 0.08,min: 0,   max: 0.4, mod: { source: "" } }, // max x displacement (fraction)
            density: { base: 0.4, min: 0,   max: 1,   mod: { source: "" } }, // fraction of slices that glitch
            amount:  { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            if ((p.amount ?? 1) < 0.01) return;
            const n      = Math.max(2, Math.round(p.slices  ?? 12));
            const maxSh  = (p.shift   ?? 0.08) * w;
            const dens   = p.density ?? 0.4;
            const bandH  = h / n;
            const now    = Number.isFinite(t) ? t : performance.now() / 1000;
            ctx.globalAlpha = p.amount ?? 1;
            // Deterministic-ish per-slice shifts that change slowly over time
            for (let i = 0; i < n; i++) {
                if (Math.sin(i * 7.3 + now * 3) * 0.5 + 0.5 > dens) continue;
                const dx  = Math.sin(i * 3.7 + now * 5.1) * maxSh;
                const sy  = i * bandH, sh = Math.ceil(bandH);
                ctx.drawImage(src, 0, sy, w, sh, dx, sy, w, sh);
            }
            ctx.globalAlpha = 1;
        },
    },
    neonGlow: {
        label: "Neon Glow",
        makeParams: () => ({
            amount:  { base: 0.5, min: 0,   max: 1,   mod: { source: "" } },
            blur:    { base: 8,   min: 0,   max: 30,  mod: { source: "" } }, // edge glow radius
            sat:     { base: 1.8, min: 0.5, max: 4,   mod: { source: "" } }, // base saturation boost
            hueShift:{ base: 0,   min: -180,max: 180, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p) {
            ctx.clearRect(0, 0, w, h);
            const sat  = p.sat  ?? 1.8;
            const hShift = (p.hueShift ?? 0) | 0;
            const hueF   = hShift !== 0 ? ` hue-rotate(${hShift}deg)` : "";
            // Base: saturated original
            ctx.filter = `saturate(${sat.toFixed(2)})${hueF}`;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.filter = "none";
            // Additive glow layer
            const blur = p.blur ?? 8;
            if (blur > 0 && (p.amount ?? 0.5) > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = p.amount ?? 0.5;
                ctx.filter = `blur(${blur}px) saturate(${(sat * 2).toFixed(2)})${hueF}`;
                ctx.drawImage(src, 0, 0, w, h);
                ctx.filter = "none";
                ctx.restore();
            }
        },
    },
    echoZoom: {
        label: "Echo Zoom",
        // Temporal zoom accumulation: each frame the persistent echo buffer is
        // scaled slightly smaller (zoomed out toward centre), then the fresh frame
        // is blended in from behind — creating an infinite tunnel of past frames
        // that recedes into the current one.
        makeParams: () => ({
            zoom:        { base: 0.04,  min: 0.005, max: 0.2,  mod: { source: "" } }, // shrink per frame
            persistence: { base: 0.82,  min: 0.3,   max: 0.97, mod: { source: "" } }, // how long echoes last
            twist:       { base: 0,     min: -0.05, max: 0.05, mod: { source: "" } }, // rotation per frame (radians)
            blend:       { base: 1,     min: 0,     max: 1,    mod: { source: "" } }, // mix with clean original
        }),
        apply(src, ctx, w, h, p, entry) {
            const zoom  = p.zoom        ?? 0.04;
            const pers  = p.persistence ?? 0.82;
            const twist = p.twist       ?? 0;
            const blend = p.blend       ?? 1;

            if (!entry._ecA) {
                entry._ecA = document.createElement("canvas"); entry._ecA.width = w; entry._ecA.height = h;
                entry._ecB = document.createElement("canvas"); entry._ecB.width = w; entry._ecB.height = h;
                entry._ecAx = entry._ecA.getContext("2d"); entry._ecBx = entry._ecB.getContext("2d");
            }
            if (entry._ecA.width !== w || entry._ecA.height !== h) {
                entry._ecA.width = w; entry._ecA.height = h;
                entry._ecB.width = w; entry._ecB.height = h;
            }

            const bx = entry._ecBx;
            bx.clearRect(0, 0, w, h);
            // Draw fresh frame as background
            bx.drawImage(src, 0, 0, w, h);
            // Shrink + rotate the previous echo on top
            const scale = 1 - zoom;
            bx.save();
            bx.globalAlpha = pers;
            bx.translate(w / 2, h / 2);
            if (twist !== 0) bx.rotate(twist);
            bx.drawImage(entry._ecA, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
            bx.restore();

            // Swap A ← B
            entry._ecAx.clearRect(0, 0, w, h);
            entry._ecAx.drawImage(entry._ecB, 0, 0);

            ctx.clearRect(0, 0, w, h);
            if (blend >= 0.999) {
                ctx.drawImage(entry._ecA, 0, 0);
            } else {
                ctx.drawImage(src, 0, 0, w, h);
                ctx.globalAlpha = blend;
                ctx.drawImage(entry._ecA, 0, 0);
                ctx.globalAlpha = 1;
            }
        },
    },
    droste: {
        label: "Droste",
        // Recursive image-within-image: stamp progressively smaller centered
        // copies of the frame on top of itself. Each copy can be twisted slightly
        // so the regression spirals. The result is a self-similar tunnel that
        // feels like the image zooming into itself.
        makeParams: () => ({
            zoom:   { base: 2.2,  min: 1.3, max: 6,    mod: { source: "" } }, // scale ratio between copies
            steps:  { base: 10,   min: 3,   max: 20,   mod: { source: "" } }, // recursion depth
            twist:  { base: 0,    min: -0.3,max: 0.3,  mod: { source: "" } }, // rotation per step (radians)
            rotate: { base: 0,    min: -1,  max: 1,    mod: { source: "" } }, // animated spin speed
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const zoom   = Math.max(1.05, p.zoom   ?? 2.2);
            const steps  = Math.round(Math.max(3, Math.min(20, p.steps ?? 10)));
            const twist  = p.twist  ?? 0;
            const rotSpd = p.rotate ?? 0;
            const now    = Number.isFinite(t) ? t : 0;
            const rotOff = now * rotSpd;

            // Draw base frame
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);

            // Stamp recursively smaller copies, each optionally rotated
            for (let i = 1; i <= steps; i++) {
                const scale = Math.pow(1 / zoom, i);
                if (scale < 0.004) break;
                const dw = w * scale, dh = h * scale;
                const angle = i * twist + rotOff;

                ctx.save();
                ctx.translate(w / 2, h / 2);
                if (angle !== 0) ctx.rotate(angle);
                ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
                ctx.restore();
            }
        },
    },
    zoomBurst: {
        label: "Zoom Burst",
        // Draws N concentric copies of the frame at increasing zoom levels and
        // decreasing opacity — an instantaneous radial zoom explosion. Audio
        // drives the burst length; bass fires a full-brightness blast.
        makeParams: () => ({
            steps:  { base: 8,    min: 2,   max: 24,  mod: { source: "" } }, // concentric copy count
            zoom:   { base: 0.08, min: 0.01,max: 0.5, mod: { source: "" } }, // zoom increment per step
            alpha:  { base: 0.35, min: 0.05,max: 0.9, mod: { source: "" } }, // opacity of each copy
            inward: { base: 0,    min: 0,   max: 1,   mod: { source: "" } }, // 0=copies zoom out, 1=zoom in
        }),
        apply(src, ctx, w, h, p, entry, t, bands) {
            const steps  = Math.round(Math.max(2, Math.min(24, p.steps ?? 8)));
            const zoomSt = p.zoom   ?? 0.08;
            const alpha  = p.alpha  ?? 0.35;
            const inward = (p.inward ?? 0) > 0.5;

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            for (let i = 1; i <= steps; i++) {
                const scale  = inward ? 1 - i * zoomSt : 1 + i * zoomSt;
                if (scale <= 0) continue;
                const dw = w * scale, dh = h * scale;
                const dx = (w - dw) / 2, dy = (h - dh) / 2;
                const a  = alpha * (1 - i / steps);
                ctx.globalAlpha = a;
                ctx.drawImage(src, dx, dy, dw, dh);
            }
            ctx.globalAlpha = 1;
        },
    },
    seamlessScroll: {
        label: "Seamless Scroll",
        // Shifts the frame by an accumulated pixel offset and tiles it — the
        // right (or bottom) edge wraps seamlessly back to the left (or top).
        // No black borders ever appear, regardless of speed or canvas size.
        makeParams: () => ({
            speed: { base: 80,  min: -800, max: 800, mod: { source: "" } }, // px/sec; negative = opposite dir
            axis:  { base: 0,   min: 0,    max: 1,   mod: { source: "" } }, // 0 = horizontal  1 = vertical
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const speed = p.speed ?? 80;
            const axis  = Math.round(p.axis ?? 0);
            const now   = Number.isFinite(t) ? t : 0;

            if (entry._t == null) entry._t = now;
            const dt = Math.min(0.1, now - entry._t);
            entry._t = now;

            const dim = axis === 0 ? w : h;
            entry._off = (((entry._off ?? 0) + speed * dt) % dim + dim) % dim;
            const off = entry._off | 0;

            ctx.clearRect(0, 0, w, h);
            if (axis === 0) {
                ctx.drawImage(src, off,     0, w, h);
                ctx.drawImage(src, off - w, 0, w, h);
            } else {
                ctx.drawImage(src, 0, off,     w, h);
                ctx.drawImage(src, 0, off - h, w, h);
            }
        },
    },
    pixelDrift: {
        label: "Pixel Drift",
        makeParams: () => ({
            speed:   { base: 0.5, min: 0,   max: 3,   mod: { source: "" } }, // drift velocity
            amount:  { base: 0.4, min: 0,   max: 1,   mod: { source: "" } }, // blend with original
            columns: { base: 0.2, min: 0,   max: 1,   mod: { source: "" } }, // fraction of columns that drift
            range:   { base: 0.05,min: 0,   max: 0.3, mod: { source: "" } }, // max drift offset (fraction of H)
        }),
        apply(src, ctx, w, h, p, entry, t) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);
            if ((p.amount ?? 0.4) < 0.01) return;
            const now    = Number.isFinite(t) ? t : performance.now() / 1000;
            const cols   = p.columns ?? 0.2;
            const maxDy  = (p.range  ?? 0.05) * h;
            const spd    = p.speed   ?? 0.5;
            const stride = Math.max(2, (w * 0.02) | 0); // sample every ~2% of width
            ctx.globalAlpha = p.amount ?? 0.4;
            ctx.globalCompositeOperation = "source-over";
            for (let x = 0; x < w; x += stride) {
                if (Math.sin(x * 0.17 + 0.91) * 0.5 + 0.5 > cols) continue;
                const dy = Math.sin(x * 0.23 + now * spd * 2.1) * maxDy;
                if (Math.abs(dy) < 1) continue;
                ctx.drawImage(src, x, 0, stride, h, x, dy, stride, h);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
        },
    },
    vhs: {
        label: "VHS Tape",
        hidden: true, // merged into Glitch / VHS (vhsBleed param)
        makeParams: () => ({
            amount: { base: 0.6, min: 0, max: 1, mod: { source: "" } },
            speed:  { base: 1,   min: 0, max: 3, mod: { source: "" } },
            noise:  { base: 0.3, min: 0, max: 1, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const now = Number.isFinite(t) ? t : performance.now() / 1000;
            const amount = p.amount ?? 0.6;
            const speed  = p.speed  ?? 1;
            const noise  = p.noise  ?? 0.3;

            if (!entry._vb) {
                entry._vb = document.createElement("canvas");
                entry._vx = entry._vb.getContext("2d", { willReadFrequently: true });
            }
            if (entry._vb.width !== w || entry._vb.height !== h) {
                entry._vb.width = w; entry._vb.height = h;
            }
            entry._vx.clearRect(0, 0, w, h);
            entry._vx.drawImage(src, 0, 0, w, h);
            const id = entry._vx.getImageData(0, 0, w, h);
            const d = id.data;
            const u32 = new Uint32Array(d.buffer);

            const maxOffset = Math.round(amount * 12);

            // Process each row: scanline shift + chroma bleed + noise/dropout
            for (let y = 0; y < h; y++) {
                // Scanline horizontal offset
                const offset = Math.round(Math.sin(y * 0.03 + now * speed * 8) * maxOffset);

                // Random noise boost: ~5% of rows
                const isNoisyRow = Math.random() < noise * 0.05;
                // Dropout: ~1% of rows
                const isDropout = Math.random() < 0.01 * amount;

                if (isDropout) {
                    for (let x = 0; x < w; x++) {
                        u32[y * w + x] = 0xff050505 | 0;
                    }
                    continue;
                }

                if (offset !== 0 || isNoisyRow) {
                    // Shift the row by copying pixels with wrap/clamp
                    const rowStart = y * w;
                    const rowBuf = new Uint32Array(w);
                    for (let x = 0; x < w; x++) {
                        rowBuf[x] = u32[rowStart + x];
                    }
                    for (let x = 0; x < w; x++) {
                        const srcX = Math.max(0, Math.min(w - 1, x - offset));
                        let px = rowBuf[srcX];
                        if (isNoisyRow) {
                            // Boost brightness
                            let r = (px & 0xff);
                            let g = (px >> 8) & 0xff;
                            let b = (px >> 16) & 0xff;
                            const boost = Math.round(Math.random() * 60);
                            r = Math.min(255, r + boost);
                            g = Math.min(255, g + boost);
                            b = Math.min(255, b + boost);
                            px = (0xff << 24) | (b << 16) | (g << 8) | r;
                        }
                        u32[rowStart + x] = px;
                    }
                }

                // Red channel shift right by 2px, blue channel left by 2px (chromatic bleed)
                if (amount > 0.1 && y < h) {
                    const rowStart = y * w;
                    for (let x = 0; x < w; x++) {
                        const srcR = Math.min(w - 1, x + 2);
                        const srcB = Math.max(0, x - 2);
                        const pxR = u32[rowStart + srcR];
                        const pxB = u32[rowStart + srcB];
                        const pxC = u32[rowStart + x];
                        const newR = pxR & 0xff;
                        const newG = (pxC >> 8) & 0xff;
                        const newB = (pxB >> 16) & 0xff;
                        u32[rowStart + x] = (0xff << 24) | (newB << 16) | (newG << 8) | newR;
                    }
                }
            }

            entry._vx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(entry._vb, 0, 0, w, h);
        },
    },
    ledWall: {
        label: "LED Wall",
        makeParams: () => ({
            size:       { base: 14,  min: 4,   max: 40,  mod: { source: "" } },
            gap:        { base: 0.15,min: 0,   max: 0.6, mod: { source: "" } },
            brightness: { base: 1.2, min: 0.5, max: 2,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            const size       = p.size       ?? 14;
            const gap        = p.gap        ?? 0.15;
            const brightness = p.brightness ?? 1.2;

            // Cell size: use param, but cap grid at 40×40 max
            const cellSize = Math.max(size, Math.ceil(Math.min(w, h) / 40));
            const cols = Math.ceil(w / cellSize);
            const rows = Math.ceil(h / cellSize);

            if (!entry._lb) {
                entry._lb = document.createElement("canvas");
                entry._lx = entry._lb.getContext("2d", { willReadFrequently: true });
            }
            if (entry._lb.width !== cols || entry._lb.height !== rows) {
                entry._lb.width = cols; entry._lb.height = rows;
            }
            entry._lx.clearRect(0, 0, cols, rows);
            entry._lx.imageSmoothingEnabled = true;
            entry._lx.drawImage(src, 0, 0, w, h, 0, 0, cols, rows);
            const id = entry._lx.getImageData(0, 0, cols, rows);
            const d = id.data;

            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, w, h);

            const ledRadius = (cellSize / 2) * (1 - gap);

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const idx = (row * cols + col) * 4;
                    let r = d[idx];
                    let g = d[idx + 1];
                    let b = d[idx + 2];

                    // Apply brightness multiplier
                    r = Math.min(255, Math.round(r * brightness));
                    g = Math.min(255, Math.round(g * brightness));
                    b = Math.min(255, Math.round(b * brightness));

                    const cx = col * cellSize + cellSize / 2;
                    const cy = row * cellSize + cellSize / 2;

                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.beginPath();
                    ctx.arc(cx, cy, ledRadius, 0, 6.283185307);
                    ctx.fill();
                }
            }
        },
    },
    badSignal: {
        label: "Bad Signal",
        hidden: true, // use Glitch / VHS (roll + slices + vhsBleed) instead
        makeParams: () => ({
            amount: { base: 0.5, min: 0, max: 1, mod: { source: "" } },
            speed:  { base: 1,   min: 0, max: 3, mod: { source: "" } },
            tears:  { base: 0.4, min: 0, max: 1, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const now    = Number.isFinite(t) ? t : performance.now() / 1000;
            const amount = p.amount ?? 0.5;
            const speed  = p.speed  ?? 1;
            const tears  = p.tears  ?? 0.4;

            if (!entry._bsb) {
                entry._bsb = document.createElement("canvas");
                entry._bsx = entry._bsb.getContext("2d", { willReadFrequently: true });
                entry._bsTearOffsets = null;
                entry._bsTearTime = -999;
            }
            if (entry._bsb.width !== w || entry._bsb.height !== h) {
                entry._bsb.width = w; entry._bsb.height = h;
            }
            entry._bsx.clearRect(0, 0, w, h);
            entry._bsx.drawImage(src, 0, 0, w, h);
            const id = entry._bsx.getImageData(0, 0, w, h);
            const d = id.data;
            const u32 = new Uint32Array(d.buffer);

            // Update tear offsets periodically based on speed
            const tearInterval = Math.max(0.05, 1 / (speed * 4 + 0.1));
            if (now - entry._bsTearTime > tearInterval || !entry._bsTearOffsets) {
                const numTears = Math.round(tears * 20);
                entry._bsTearOffsets = new Float32Array(h);
                for (let i = 0; i < numTears; i++) {
                    const ry = Math.floor(Math.random() * h);
                    const span = Math.max(1, Math.floor(Math.random() * 12 + 2));
                    const dx = (Math.random() - 0.5) * amount * w * 0.3;
                    for (let dy = 0; dy < span && ry + dy < h; dy++) {
                        entry._bsTearOffsets[ry + dy] = dx;
                    }
                }
                entry._bsTearTime = now;
            }
            const tearOffsets = entry._bsTearOffsets;

            // Occasional full-frame desaturation flash
            const doDesatFlash = amount > 0.3 && Math.random() < amount * 0.02;

            for (let y = 0; y < h; y++) {
                const rowStart = y * w;
                const tearDx = tearOffsets[y] || 0;

                if (Math.abs(tearDx) > 1) {
                    // Displace the row: red stays, green+blue shift by different amounts
                    const rowBuf = new Uint32Array(w);
                    for (let x = 0; x < w; x++) rowBuf[x] = u32[rowStart + x];

                    const greenShift = Math.round(tearDx * 0.8);
                    const blueShift  = Math.round(tearDx * 1.2);

                    for (let x = 0; x < w; x++) {
                        const srcRed   = Math.max(0, Math.min(w - 1, x - Math.round(tearDx)));
                        const srcGreen = Math.max(0, Math.min(w - 1, x - greenShift));
                        const srcBlue  = Math.max(0, Math.min(w - 1, x - blueShift));
                        const newR = rowBuf[srcRed]   & 0xff;
                        const newG = (rowBuf[srcGreen] >> 8) & 0xff;
                        const newB = (rowBuf[srcBlue]  >> 16) & 0xff;
                        u32[rowStart + x] = (0xff << 24) | (newB << 16) | (newG << 8) | newR;
                    }
                }

                // Random noise: scramble some pixels
                const noiseProb = amount * 0.03;
                if (noiseProb > 0) {
                    for (let x = 0; x < w; x++) {
                        if (Math.random() < noiseProb) {
                            const v = Math.floor(Math.random() * 256);
                            u32[rowStart + x] = (0xff << 24) | (v << 16) | (v << 8) | v;
                        }
                    }
                }

                if (doDesatFlash) {
                    for (let x = 0; x < w; x++) {
                        const px = u32[rowStart + x];
                        const r = px & 0xff, g = (px >> 8) & 0xff, b = (px >> 16) & 0xff;
                        const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                        u32[rowStart + x] = (0xff << 24) | (grey << 16) | (grey << 8) | grey;
                    }
                }
            }

            entry._bsx.putImageData(id, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(entry._bsb, 0, 0, w, h);
        },
    },
    lensFlare: {
        label: "Lens Flare",
        makeParams: () => ({
            intensity: { base: 1,    min: 0,   max: 2,   mod: { source: "" } },
            x:         { base: 0.3,  min: 0,   max: 1,   mod: { source: "" } },
            y:         { base: 0.25, min: 0,   max: 1,   mod: { source: "" } },
            hue:       { base: 40,   min: 0,   max: 360, mod: { source: "" } },
            streak:    { base: 1.5,  min: 0,   max: 3,   mod: { source: "" } },
            audio:     { base: 0.7,  min: 0,   max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t, extra) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0, w, h);

            let audioScale = 1;
            if ((p.audio ?? 0.7) > 0 && extra && extra.spectrum) {
                let overall = 0;
                for (let i = 0; i < 64; i++) overall += extra.spectrum[i];
                overall /= 64;
                audioScale = 1 + overall * (p.audio ?? 0.7) * 2;
            }

            const intensity = (p.intensity ?? 1) * audioScale;
            if (intensity < 0.01) return;

            const fx = (p.x ?? 0.3) * w;
            const fy = (p.y ?? 0.25) * h;
            const hue = p.hue ?? 40;
            const streak = p.streak ?? 1.5;

            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            // Central glow
            const glowRadius = intensity * 80;
            const grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowRadius);
            grd.addColorStop(0, `hsla(${hue},100%,90%,${Math.min(1, intensity * 0.9)})`);
            grd.addColorStop(0.2, `hsla(${hue},90%,70%,${Math.min(1, intensity * 0.5)})`);
            grd.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(fx, fy, glowRadius, 0, 6.283185307);
            ctx.fill();

            // 6-point starburst
            ctx.save();
            ctx.translate(fx, fy);
            ctx.globalAlpha = Math.min(1, intensity * 0.4);
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI;
                const len = intensity * 120;
                const sg = ctx.createLinearGradient(
                    Math.cos(angle) * len, Math.sin(angle) * len,
                    Math.cos(angle + Math.PI) * len, Math.sin(angle + Math.PI) * len
                );
                sg.addColorStop(0, "rgba(0,0,0,0)");
                sg.addColorStop(0.5, `hsla(${hue},100%,95%,1)`);
                sg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.strokeStyle = sg;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * len, Math.sin(angle) * len);
                ctx.lineTo(Math.cos(angle + Math.PI) * len, Math.sin(angle + Math.PI) * len);
                ctx.stroke();
            }
            ctx.restore();

            // Anamorphic horizontal streak
            if (streak > 0.05) {
                const streakAlpha = Math.min(1, streak * intensity * 0.35);
                const sg = ctx.createLinearGradient(0, fy, w, fy);
                sg.addColorStop(0, "rgba(0,0,0,0)");
                sg.addColorStop(Math.max(0, fx / w - 0.2), "rgba(0,0,0,0)");
                sg.addColorStop(fx / w, `hsla(${hue},100%,90%,${streakAlpha})`);
                sg.addColorStop(Math.min(1, fx / w + 0.2), "rgba(0,0,0,0)");
                sg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = sg;
                ctx.fillRect(0, fy - 2, w, 4);
            }

            // Secondary flares along axis from flare to screen centre
            const scx = w / 2, scy = h / 2;
            const numSecondary = 4;
            for (let i = 0; i < numSecondary; i++) {
                const frac = (i + 1) / (numSecondary + 1);
                const sx = fx + (scx - fx) * frac;
                const sy = fy + (scy - fy) * frac;
                const sr = intensity * (15 + i * 10) * (1 - frac * 0.5);
                const secHue = (hue + i * 40) % 360;
                const secGrd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                secGrd.addColorStop(0, `hsla(${secHue},100%,80%,${Math.min(1, intensity * 0.4 * (1 - frac * 0.5))})`);
                secGrd.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = secGrd;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, 6.283185307);
                ctx.fill();
            }

            // Lens ring
            const ringRadius = intensity * 120;
            ctx.globalAlpha = Math.min(1, intensity * 0.25);
            ctx.strokeStyle = `hsla(${hue},80%,85%,1)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(fx, fy, ringRadius, 0, 6.283185307);
            ctx.stroke();

            ctx.restore();
        },
    },
    oilPaint: {
        label: "Oil Paint",
        makeParams: () => ({
            radius: { base: 6, min: 1, max: 20, mod: { source: "" } },
            detail: { base: 3, min: 1, max: 4,  mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            const radius = Math.max(1, Math.round(p.radius ?? 6));
            const detail = Math.max(1, Math.round(p.detail ?? 3));

            // Process at 1/detail resolution for performance
            const SW = Math.max(1, Math.ceil(w / detail));
            const SH = Math.max(1, Math.ceil(h / detail));

            if (!entry._ob) {
                entry._ob = document.createElement("canvas");
                entry._ox = entry._ob.getContext("2d", { willReadFrequently: true });
                entry._oo = document.createElement("canvas");
                entry._ooX = entry._oo.getContext("2d");
            }
            if (entry._ob.width !== SW || entry._ob.height !== SH) {
                entry._ob.width = SW; entry._ob.height = SH;
                entry._oo.width = SW; entry._oo.height = SH;
            }

            entry._ox.clearRect(0, 0, SW, SH);
            entry._ox.drawImage(src, 0, 0, w, h, 0, 0, SW, SH);
            const srcId = entry._ox.getImageData(0, 0, SW, SH);
            const sd = srcId.data;

            const outId = entry._ox.createImageData(SW, SH);
            const od = outId.data;

            // Downscale radius for the reduced-resolution pass
            const r = Math.max(1, Math.round(radius / detail));

            for (let y = 0; y < SH; y++) {
                for (let x = 0; x < SW; x++) {
                    // 4 quadrants: TL, TR, BL, BR
                    let bestVar = Infinity;
                    let bestR = 0, bestG = 0, bestB = 0;

                    for (let q = 0; q < 4; q++) {
                        const x0 = (q & 1) ? x : x - r;
                        const x1 = (q & 1) ? x + r : x;
                        const y0 = (q & 2) ? y : y - r;
                        const y1 = (q & 2) ? y + r : y;

                        let sumR = 0, sumG = 0, sumB = 0, count = 0;
                        let sumR2 = 0, sumG2 = 0, sumB2 = 0;

                        for (let py = Math.max(0, y0); py <= Math.min(SH - 1, y1); py++) {
                            for (let px = Math.max(0, x0); px <= Math.min(SW - 1, x1); px++) {
                                const i = (py * SW + px) * 4;
                                const cr = sd[i], cg = sd[i + 1], cb = sd[i + 2];
                                sumR += cr; sumG += cg; sumB += cb;
                                sumR2 += cr * cr; sumG2 += cg * cg; sumB2 += cb * cb;
                                count++;
                            }
                        }

                        if (count === 0) continue;
                        const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
                        // Variance of luminance
                        const lumVar = (sumR2 / count - meanR * meanR)
                                     + (sumG2 / count - meanG * meanG)
                                     + (sumB2 / count - meanB * meanB);

                        if (lumVar < bestVar) {
                            bestVar = lumVar;
                            bestR = meanR; bestG = meanG; bestB = meanB;
                        }
                    }

                    const oi = (y * SW + x) * 4;
                    od[oi]     = bestR;
                    od[oi + 1] = bestG;
                    od[oi + 2] = bestB;
                    od[oi + 3] = 255;
                }
            }

            entry._ooX.putImageData(outId, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(entry._oo, 0, 0, SW, SH, 0, 0, w, h);
        },
    },

    // ── 3D Displacement ──────────────────────────────────────────────────────
    // Reads the current frame, samples it at RES×RES, maps luminosity → vertex
    // height, then software-renders the displaced mesh back into the output.
    // Grid mode: flat plane viewed from above-front.
    // Sphere mode: equirectangular map displaced outward on a sphere.
    // Wire mode: efficient horizontal+vertical line passes instead of N² quads.
    displace3d: {
        label: "3D Displace",
        makeParams: () => ({
            res:    { base: 48,  min: 16,  max: 96,  step: 8,  mod: { source: "" } },
            height: { base: 0.5, min: 0,   max: 2,   mod: { source: "" } },
            tilt:   { base: 0.4, min: 0,   max: 1,   mod: { source: "" } },
            spin:   { base: 0.3, min: 0,   max: 2,   mod: { source: "" } },
            mode:   { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
            wire:   { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
            fov:    { base: 1.0, min: 0.3, max: 3,   mod: { source: "" } },
            hue:    { base: 180, min: 0,   max: 360, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            const RES     = Math.round(Math.max(16, Math.min(96, p.res ?? 48)) / 8) * 8;
            const isWire   = (p.wire   ?? 0) > 0.5;
            const isSphere = (p.mode   ?? 0) > 0.5;
            const H        = p.height ?? 0.5;
            const fov      = Math.max(0.3, p.fov ?? 1.0);
            const wHue     = p.hue ?? 180;

            // Lazy-init sample canvas and spin accumulator
            if (!entry._d3sc || entry._d3sc.width !== RES) {
                entry._d3sc  = document.createElement("canvas");
                entry._d3sc.width = entry._d3sc.height = RES;
                entry._d3cx  = entry._d3sc.getContext("2d", { willReadFrequently: true });
                entry._d3ang = 0;
            }
            entry._d3ang += (p.spin ?? 0.3) / 60;

            // Sample source at RES×RES
            const sc = entry._d3cx;
            sc.clearRect(0, 0, RES, RES);
            sc.drawImage(src, 0, 0, RES, RES);
            const id = sc.getImageData(0, 0, RES, RES);
            const d  = id.data;
            const N  = RES;

            // Camera / projection constants
            const tilt  = (p.tilt ?? 0.4) * Math.PI * 0.85 + 0.08;
            const angY  = entry._d3ang;
            const cosY  = Math.cos(angY), sinY = Math.sin(angY);
            const cosX  = Math.cos(tilt),  sinX = Math.sin(tilt);
            const camD  = 2.0;
            const scl   = Math.min(w, h) * fov / 2; // fov now multiplies (higher = bigger)
            const ox    = w * 0.5, oy = h * 0.5;

            // Project all N×N vertices into screen space
            const px  = new Float32Array(N * N);
            const py  = new Float32Array(N * N);
            const pz  = new Float32Array(N * N);

            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const idx = r * N + c;
                    const pi4 = idx * 4;
                    const li  = (d[pi4]*77 + d[pi4+1]*150 + d[pi4+2]*29) / 65280; // 0..1

                    let x, y, z;
                    if (!isSphere) {
                        x = (c / (N - 1) - 0.5) * 3;
                        y = li * H;
                        z = (r / (N - 1) - 0.5) * 3;
                    } else {
                        const theta = (c / (N - 1)) * Math.PI * 2;
                        const phi   = (r / (N - 1)) * Math.PI;
                        const rad   = 1.0 + li * H * 0.6;
                        x = Math.sin(phi) * Math.cos(theta) * rad;
                        y = Math.cos(phi) * rad;
                        z = Math.sin(phi) * Math.sin(theta) * rad;
                    }

                    // Y-axis rotation
                    const x1 =  x * cosY + z * sinY;
                    const z1 = -x * sinY + z * cosY;
                    // X-axis rotation
                    const y2 = y * cosX - z1 * sinX;
                    const z2 = y * sinX + z1 * cosX;

                    const zv  = z2 + camD;
                    const sp  = scl / Math.max(0.5, zv);
                    px[idx]   = ox + x1 * sp;
                    py[idx]   = oy - y2 * sp;
                    pz[idx]   = zv;
                }
            }

            ctx.clearRect(0, 0, w, h);

            if (isWire) {
                // Efficient wireframe: N horizontal + N vertical continuous paths.
                // Each segment colored by its first vertex's source pixel.
                ctx.lineWidth = 0.9;
                for (let r = 0; r < N; r++) {
                    ctx.beginPath();
                    for (let c = 0; c < N; c++) {
                        const idx = r * N + c;
                        if (c === 0) ctx.moveTo(px[idx], py[idx]);
                        else         ctx.lineTo(px[idx], py[idx]);
                    }
                    ctx.strokeStyle = `hsl(${wHue},90%,60%)`;
                    ctx.stroke();
                }
                for (let c = 0; c < N; c++) {
                    ctx.beginPath();
                    for (let r = 0; r < N; r++) {
                        const idx = r * N + c;
                        if (r === 0) ctx.moveTo(px[idx], py[idx]);
                        else         ctx.lineTo(px[idx], py[idx]);
                    }
                    ctx.strokeStyle = `hsl(${(wHue + 40) % 360},80%,50%)`;
                    ctx.stroke();
                }
            } else if (!isSphere) {
                // Grid filled quads — draw rows back-to-front.
                // Compare first-row vs last-row view-Z to pick direction.
                const rStart = pz[0] >= pz[(N - 1) * N] ? 0 : N - 1;
                const rStep  = rStart === 0 ? 1 : -1;
                const rEnd   = rStart === 0 ? N - 1 : 0;

                for (let ri = rStart; ri !== rEnd; ri += rStep) {
                    const ri2 = ri + rStep;
                    for (let ci = 0; ci < N - 1; ci++) {
                        const a  = ri  * N + ci;
                        const b  = ri  * N + ci + 1;
                        const cc = ri2 * N + ci + 1;
                        const dd = ri2 * N + ci;

                        const ai = a*4, bi = b*4, ci4 = cc*4, di = dd*4;
                        const R = (d[ai] + d[bi] + d[ci4] + d[di]) >> 2;
                        const G = (d[ai+1] + d[bi+1] + d[ci4+1] + d[di+1]) >> 2;
                        const B = (d[ai+2] + d[bi+2] + d[ci4+2] + d[di+2]) >> 2;

                        ctx.fillStyle = `rgb(${R},${G},${B})`;
                        ctx.beginPath();
                        ctx.moveTo(px[a],  py[a]);
                        ctx.lineTo(px[b],  py[b]);
                        ctx.lineTo(px[cc], py[cc]);
                        ctx.lineTo(px[dd], py[dd]);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            } else {
                // Sphere filled quads — painter's algorithm, back-face cull.
                // Build index list sorted by descending pz (draw far quads first).
                const nQ = (N - 1) * (N - 1);
                const qZ = new Float32Array(nQ);
                const qI = new Int32Array(nQ);
                let qi = 0;
                for (let r = 0; r < N - 1; r++) {
                    for (let c = 0; c < N - 1; c++) {
                        const a  = r * N + c;
                        const cc = (r + 1) * N + c + 1;
                        qZ[qi]   = (pz[a] + pz[a+1] + pz[cc] + pz[cc-1]) * 0.25;
                        qI[qi]   = r * (N - 1) + c;
                        qi++;
                    }
                }
                // Sort indices by depth (far first)
                const sortBuf = Array.from(qI.subarray(0, nQ));
                sortBuf.sort((ia, ib) => qZ[ib] - qZ[ia]);

                for (let si = 0; si < sortBuf.length; si++) {
                    const flat = sortBuf[si];
                    const r  = (flat / (N - 1)) | 0;
                    const c  = flat % (N - 1);
                    const a  = r * N + c;
                    const b  = a + 1;
                    const cc = (r + 1) * N + c + 1;
                    const dd = (r + 1) * N + c;

                    // Back-face cull: skip quads facing away from camera
                    // Approximate normal via cross product of two edges in screen space
                    const ex1 = px[b]  - px[a],  ey1 = py[b]  - py[a];
                    const ex2 = px[dd] - px[a],  ey2 = py[dd] - py[a];
                    if (ex1 * ey2 - ey1 * ex2 > 0) continue; // CW winding = back face

                    const ai = a*4, bi = b*4, ci4 = cc*4, di = dd*4;
                    const R = (d[ai] + d[bi] + d[ci4] + d[di]) >> 2;
                    const G = (d[ai+1] + d[bi+1] + d[ci4+1] + d[di+1]) >> 2;
                    const B = (d[ai+2] + d[bi+2] + d[ci4+2] + d[di+2]) >> 2;

                    ctx.fillStyle = `rgb(${R},${G},${B})`;
                    ctx.beginPath();
                    ctx.moveTo(px[a],  py[a]);
                    ctx.lineTo(px[b],  py[b]);
                    ctx.lineTo(px[cc], py[cc]);
                    ctx.lineTo(px[dd], py[dd]);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        },
    },

    // ── Kaleidoscope ─────────────────────────────────────────────────────────
    // Slice the canvas into N mirror-symmetric segments around the center.
    // One wedge is sampled from `src`; the rest are rotated reflections of it.
    kaleidoscope: {
        label: "Kaleidoscope",
        makeParams: () => ({
            segments: { base: 6,   min: 2,   max: 16,  step: 1, mod: { source: "" } },
            rotation: { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
            spin:     { base: 0.1, min: 0,   max: 2,   mod: { source: "" } },
            zoom:     { base: 1.0, min: 0.2, max: 3,   mod: { source: "" } },
            offset:   { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            if (!entry._kAngle) entry._kAngle = 0;
            entry._kAngle += (p.spin ?? 0.1) / 60;

            const N    = Math.max(2, Math.round(p.segments ?? 6));
            const rot  = (p.rotation ?? 0) * Math.PI * 2 + entry._kAngle;
            const zoom = Math.max(0.2, p.zoom ?? 1.0);
            const off  = (p.offset ?? 0) * Math.min(w, h) * 0.3;
            const cx   = w / 2, cy = h / 2;
            const wedge = Math.PI * 2 / N;

            ctx.clearRect(0, 0, w, h);

            for (let i = 0; i < N; i++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(i * wedge + rot);

                // Clip to wedge
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, Math.max(w, h), 0, wedge);
                ctx.closePath();
                ctx.clip();

                // Mirror every other segment
                if (i % 2 === 1) ctx.scale(1, -1);
                ctx.rotate(-rot);

                // Draw source, offset and zoomed
                const s = zoom;
                ctx.drawImage(src, -cx * s + off, -cy * s, w * s, h * s);
                ctx.restore();
            }
        },
    },

    // ── Contour Lines ────────────────────────────────────────────────────────
    // Extract iso-luminance contour lines from the source frame using Sobel
    // edge detection, rendering them at configurable intervals over a darkened
    // or cleared background.
    contourLines: {
        label: "Contour Lines",
        makeParams: () => ({
            levels:     { base: 8,   min: 2,  max: 24,  step: 1,  mod: { source: "" } },
            lineWidth:  { base: 1.0, min: 0.3,max: 4,             mod: { source: "" } },
            hue:        { base: 180, min: 0,  max: 360,           mod: { source: "" } },
            background: { base: 0.1, min: 0,  max: 1,             mod: { source: "" } },
            glow:       { base: 0,   min: 0,  max: 3,             mod: { source: "" } },
            res:        { base: 256, min: 64, max: 512, step: 64,  mod: { source: "" } }, // sample res; lower = faster
        }),
        apply(src, ctx, w, h, p, entry) {
            const levels  = Math.max(2, Math.round(p.levels ?? 8));
            const hue     = p.hue ?? 180;
            const lw      = p.lineWidth ?? 1.0;
            const bg      = p.background ?? 0.1;
            const glow    = p.glow ?? 0;

            // Sample at reduced resolution; res param trades quality for performance
            const resTarget = Math.max(64, Math.min(512, Math.round((p.res ?? 256) / 64) * 64));
            const SW = Math.min(w, resTarget), SH = Math.min(h, resTarget);
            if (!entry._cSc) {
                entry._cSc  = document.createElement("canvas");
                entry._cScX = entry._cSc.getContext("2d", { willReadFrequently: true });
            }
            if (entry._cSc.width !== SW || entry._cSc.height !== SH) {
                entry._cSc.width = SW; entry._cSc.height = SH;
            }
            entry._cScX.drawImage(src, 0, 0, SW, SH);
            const id = entry._cScX.getImageData(0, 0, SW, SH);
            const d  = id.data;

            // Build luminance array
            const lum = new Float32Array(SW * SH);
            for (let i = 0; i < SW * SH; i++) {
                lum[i] = (d[i*4]*77 + d[i*4+1]*150 + d[i*4+2]*29) / 65280;
            }

            // Draw darkened source as background
            ctx.clearRect(0, 0, w, h);
            if (bg > 0.005) {
                ctx.globalAlpha = bg;
                ctx.drawImage(src, 0, 0, w, h);
                ctx.globalAlpha = 1;
            }

            // Draw contour lines for each iso-level using marching squares (edges only)
            const scaleX = w / SW, scaleY = h / SH;
            if (glow > 0.05) { ctx.shadowBlur = glow * 6; }

            for (let lv = 0; lv < levels; lv++) {
                const iso = (lv + 0.5) / levels;
                const lvHue = (hue + lv / levels * 120) % 360;
                const light = 40 + (lv / levels) * 40;
                ctx.strokeStyle = `hsl(${lvHue},80%,${light}%)`;
                ctx.lineWidth   = lw;
                ctx.shadowColor = `hsl(${lvHue},100%,70%)`;
                ctx.beginPath();

                for (let y = 0; y < SH - 1; y++) {
                    for (let x = 0; x < SW - 1; x++) {
                        const v00 = lum[y * SW + x];
                        const v10 = lum[y * SW + x + 1];
                        const v01 = lum[(y+1) * SW + x];
                        const v11 = lum[(y+1) * SW + x + 1];

                        // Marching squares: find edges crossing iso
                        const c = ((v00 > iso) ? 8 : 0) | ((v10 > iso) ? 4 : 0)
                                | ((v11 > iso) ? 2 : 0) | ((v01 > iso) ? 1 : 0);
                        if (c === 0 || c === 15) continue;

                        // Linear interpolation for edge crossing positions
                        const lerp = (a, b, v) => (v - a) / (b - a);
                        const pts  = [];
                        if ((c & 12) !== 0 && (c & 12) !== 12)
                            pts.push([(x + lerp(v00, v10, iso)) * scaleX, y * scaleY]);
                        if ((c & 6) !== 0 && (c & 6) !== 6)
                            pts.push([(x + 1) * scaleX, (y + lerp(v10, v11, iso)) * scaleY]);
                        if ((c & 3) !== 0 && (c & 3) !== 3)
                            pts.push([(x + lerp(v01, v11, iso)) * scaleX, (y + 1) * scaleY]);
                        if ((c & 9) !== 0 && (c & 9) !== 9)
                            pts.push([x * scaleX, (y + lerp(v00, v01, iso)) * scaleY]);

                        if (pts.length >= 2) {
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            ctx.lineTo(pts[1][0], pts[1][1]);
                        }
                    }
                }
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        },
    },

    // ── Warhol Grid ──────────────────────────────────────────────────────────
    // Tile the frame in an N×N grid, each cell hue-rotated by a different
    // amount — the classic Andy Warhol screen-print aesthetic.
    warholGrid: {
        label: "Warhol Grid",
        makeParams: () => ({
            cols:       { base: 3,   min: 1,  max: 6,   step: 1, mod: { source: "" } },
            rows:       { base: 2,   min: 1,  max: 6,   step: 1, mod: { source: "" } },
            hueStep:    { base: 45,  min: 0,  max: 180, mod: { source: "" } },
            saturation: { base: 1.2, min: 0,  max: 3,   mod: { source: "" } },
            posterize:  { base: 0,   min: 0,  max: 1,   step: 1, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            const cols = Math.max(1, Math.round(p.cols ?? 3));
            const rows = Math.max(1, Math.round(p.rows ?? 2));
            const step = p.hueStep ?? 45;
            const sat  = p.saturation ?? 1.2;
            const post = (p.posterize ?? 0) > 0.5;

            ctx.clearRect(0, 0, w, h);
            const cw = w / cols, ch = h / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx  = r * cols + c;
                    const hRot = (idx * step) % 360;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(c * cw, r * ch, cw, ch);
                    ctx.clip();

                    let filterStr = `hue-rotate(${hRot}deg) saturate(${sat})`;
                    if (post) filterStr += " contrast(3) brightness(0.8)";
                    ctx.filter = filterStr;
                    ctx.drawImage(src, c * cw, r * ch, cw, ch, c * cw, r * ch, cw, ch);
                    ctx.filter = "none";
                    ctx.restore();
                }
            }
        },
    },

    // ── Pixel Warp ───────────────────────────────────────────────────────────
    // Per-pixel UV displacement using layered sine waves — produces a rippling
    // / melting distortion. Reads from source at displaced coordinates.
    pixelWarp: {
        label: "Pixel Warp",
        makeParams: () => ({
            strength:  { base: 0.04, min: 0,    max: 0.3,  mod: { source: "" } },
            freq:      { base: 4,    min: 0.5,  max: 12,   mod: { source: "" } },
            speed:     { base: 0.5,  min: 0,    max: 3,    mod: { source: "" } },
            angle:     { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
            layers:    { base: 2,    min: 1,    max: 4,    step: 1, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            if (!entry._pwT) entry._pwT = 0;
            entry._pwT += (p.speed ?? 0.5) / 60;

            const str  = p.strength ?? 0.04;
            const freq = p.freq ?? 4;
            const nL   = Math.round(p.layers ?? 2);
            const ang  = (p.angle ?? 0) * Math.PI;
            const t    = entry._pwT;

            // Downsample for warp computation
            const SW = Math.min(w, 512), SH = Math.min(h, 512);
            if (!entry._pwSc) {
                entry._pwSc  = document.createElement("canvas");
                entry._pwScX = entry._pwSc.getContext("2d", { willReadFrequently: true });
                entry._pwDst = document.createElement("canvas");
                entry._pwDstX = entry._pwDst.getContext("2d");
            }
            for (const c of [entry._pwSc, entry._pwDst]) {
                if (c.width !== SW || c.height !== SH) { c.width = SW; c.height = SH; }
            }

            entry._pwScX.drawImage(src, 0, 0, SW, SH);
            const srcId = entry._pwScX.getImageData(0, 0, SW, SH);
            const sd = srcId.data;
            const dstId = entry._pwScX.createImageData(SW, SH);
            const dd = dstId.data;

            for (let y = 0; y < SH; y++) {
                for (let x = 0; x < SW; x++) {
                    const ux = x / SW, uy = y / SH;
                    let dx = 0, dy = 0;

                    for (let l = 0; l < nL; l++) {
                        const f  = freq * Math.pow(2, l);
                        const ph = l * 1.7 + t;
                        const rot = ang + l * 0.5;
                        const rx = ux * Math.cos(rot) - uy * Math.sin(rot);
                        const ry = ux * Math.sin(rot) + uy * Math.cos(rot);
                        dx += Math.sin(ry * f * Math.PI * 2 + ph) * str / (l + 1);
                        dy += Math.cos(rx * f * Math.PI * 2 + ph) * str / (l + 1);
                    }

                    const sx = Math.max(0, Math.min(SW - 1, Math.round((ux + dx) * SW)));
                    const sy = Math.max(0, Math.min(SH - 1, Math.round((uy + dy) * SH)));
                    const si = (sy * SW + sx) * 4;
                    const di = (y  * SW + x)  * 4;
                    dd[di] = sd[si]; dd[di+1] = sd[si+1]; dd[di+2] = sd[si+2]; dd[di+3] = sd[si+3];
                }
            }

            entry._pwDstX.putImageData(dstId, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(entry._pwDst, 0, 0, SW, SH, 0, 0, w, h);
        },
    },

    // ── Frame Diff ───────────────────────────────────────────────────────────
    // Highlight pixels that changed significantly between frames — motion
    // detection aesthetic. Static areas go dark; movement glows with hue.
    frameDiff: {
        label: "Frame Diff",
        makeParams: () => ({
            threshold:  { base: 0.1,  min: 0,    max: 1,   mod: { source: "" } },
            glow:       { base: 1.5,  min: 0,    max: 4,   mod: { source: "" } },
            hue:        { base: 120,  min: 0,    max: 360, mod: { source: "" } },
            decay:      { base: 0.85, min: 0.5,  max: 1,   mod: { source: "" } },
            colorDiff:  { base: 1,    min: 0,    max: 1,   step: 1, mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry) {
            // 720p cap: pixel-loop cost grows with area, but 720→1080 is only 1.5×
            // upscale so artefacts stay invisible. Lower caps cause visible blockiness.
            const SW = Math.min(w, 1280), SH = Math.min(h, 720);

            if (!entry._fdSc) {
                entry._fdSc  = document.createElement("canvas");
                entry._fdSc.width = SW; entry._fdSc.height = SH;
                entry._fdScX = entry._fdSc.getContext("2d", { willReadFrequently: true });
                entry._fdPrev = null;
                entry._fdAcc  = new Float32Array(SW * SH * 3);
            }
            if (entry._fdSc.width !== SW || entry._fdSc.height !== SH) {
                entry._fdSc.width = SW; entry._fdSc.height = SH;
                entry._fdPrev = null;
                entry._fdAcc  = new Float32Array(SW * SH * 3);
            }

            entry._fdScX.drawImage(src, 0, 0, SW, SH);
            const cur  = entry._fdScX.getImageData(0, 0, SW, SH).data;
            const prev = entry._fdPrev;
            const acc  = entry._fdAcc;

            const thresh  = (p.threshold ?? 0.1) * 255;
            const hue     = p.hue ?? 120;
            const decay   = p.decay ?? 0.85;
            const useCol  = (p.colorDiff ?? 1) > 0.5;
            const glowR   = p.glow ?? 1.5;

            const outId = new ImageData(SW, SH);
            const od = outId.data;

            for (let i = 0; i < SW * SH; i++) {
                const j = i * 4;
                const dr = Math.abs(cur[j]   - (prev ? prev[j]   : cur[j]));
                const dg = Math.abs(cur[j+1] - (prev ? prev[j+1] : cur[j+1]));
                const db = Math.abs(cur[j+2] - (prev ? prev[j+2] : cur[j+2]));
                const diff = (dr + dg + db) / 3;

                if (diff > thresh) {
                    if (useCol) {
                        acc[i*3]   = Math.min(255, acc[i*3]   + dr * 2);
                        acc[i*3+1] = Math.min(255, acc[i*3+1] + dg * 2);
                        acc[i*3+2] = Math.min(255, acc[i*3+2] + db * 2);
                    } else {
                        const mag = Math.min(255, diff * 4);
                        // hue → RGB (fast path)
                        const h6  = hue / 60;
                        const hf  = h6 - Math.floor(h6);
                        const q   = mag * (1 - hf), t2 = mag * hf;
                        let r2, g2, b2;
                        switch (Math.floor(h6) % 6) {
                            case 0: r2=mag; g2=t2;  b2=0;   break;
                            case 1: r2=q;   g2=mag; b2=0;   break;
                            case 2: r2=0;   g2=mag; b2=t2;  break;
                            case 3: r2=0;   g2=q;   b2=mag; break;
                            case 4: r2=t2;  g2=0;   b2=mag; break;
                            default:r2=mag; g2=0;   b2=q;   break;
                        }
                        acc[i*3]   = Math.min(255, acc[i*3]   + r2);
                        acc[i*3+1] = Math.min(255, acc[i*3+1] + g2);
                        acc[i*3+2] = Math.min(255, acc[i*3+2] + b2);
                    }
                }
                acc[i*3]   *= decay;
                acc[i*3+1] *= decay;
                acc[i*3+2] *= decay;

                od[j]   = acc[i*3]   | 0;
                od[j+1] = acc[i*3+1] | 0;
                od[j+2] = acc[i*3+2] | 0;
                od[j+3] = 255;
            }

            entry._fdPrev = new Uint8ClampedArray(cur);

            // Render
            if (!entry._fdDst) {
                entry._fdDst  = document.createElement("canvas");
                entry._fdDstX = entry._fdDst.getContext("2d");
            }
            if (entry._fdDst.width !== SW) { entry._fdDst.width = SW; entry._fdDst.height = SH; }
            entry._fdDstX.putImageData(outId, 0, 0);

            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            if (glowR > 0.05) {
                ctx.filter = `blur(${(glowR * 3).toFixed(1)}px)`;
                ctx.drawImage(entry._fdDst, 0, 0, w, h);
                ctx.filter = "none";
                ctx.globalCompositeOperation = "lighter";
            }
            ctx.drawImage(entry._fdDst, 0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        },
    },

    motionBlur: {
        label: "Motion Blur",
        makeParams: () => ({
            strength: { base: 0.5, min: 0, max: 1,   mod: { source: "" } },
            angle:    { base: 0,   min: 0, max: 360,  mod: { source: "" } }, // direction degrees
            samples:  { base: 8,   min: 2, max: 24, step: 1, mod: { source: "" } },
            pulse:    { base: 0.4, min: 0, max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const strength = Math.max(0, Math.min(1, p.strength ?? 0.5));
            if (strength < 0.01) { ctx.clearRect(0,0,w,h); ctx.drawImage(src,0,0); return; }
            const samples = Math.round(Math.max(2, Math.min(24, p.samples ?? 8)));
            const angle = ((p.angle ?? 0) * Math.PI) / 180;
            const dist = strength * w * 0.03;
            const dx = Math.cos(angle) * dist / samples;
            const dy = Math.sin(angle) * dist / samples;

            if (!entry._mbOff) {
                const oc = document.createElement("canvas"); oc.width = w; oc.height = h;
                entry._mbOff = oc; entry._mbCtx = oc.getContext("2d");
            }
            const oc = entry._mbOff, oCtx = entry._mbCtx;
            if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
            oCtx.clearRect(0, 0, w, h);
            oCtx.globalAlpha = 1 / samples;
            for (let i = 0; i < samples; i++) {
                oCtx.drawImage(src, dx * (i - samples * 0.5), dy * (i - samples * 0.5));
            }
            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.drawImage(oc, 0, 0);
        },
    },

    crystalize: {
        label: "Crystalize",
        makeParams: () => ({
            cells:   { base: 30,  min: 5,  max: 120, step: 1, mod: { source: "" } },
            pulse:   { base: 0.3, min: 0,  max: 1,             mod: { source: "" } },
            outline: { base: 0.5, min: 0,  max: 1,             mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const nCells = Math.round(Math.max(5, Math.min(120, p.cells ?? 30)));
            const outline = p.outline ?? 0.5;

            if (!entry._crSeeds || entry._crN !== nCells) {
                entry._crN = nCells;
                entry._crSeeds = Array.from({ length: nCells }, () => [Math.random() * w, Math.random() * h]);
            }
            const seeds = entry._crSeeds;

            const sd = src.getContext("2d").getImageData(0, 0, w, h).data;
            const out = ctx.createImageData(w, h);
            const od = out.data;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let best = 0, bestD = Infinity, sec = Infinity;
                    for (let i = 0; i < seeds.length; i++) {
                        const d2 = (x - seeds[i][0]) ** 2 + (y - seeds[i][1]) ** 2;
                        if (d2 < bestD) { sec = bestD; bestD = d2; best = i; }
                        else if (d2 < sec) sec = d2;
                    }
                    const sx = Math.round(seeds[best][0]), sy = Math.round(seeds[best][1]);
                    const si = (Math.max(0, Math.min(h-1, sy)) * w + Math.max(0, Math.min(w-1, sx))) * 4;
                    const oi = (y * w + x) * 4;
                    const edge = (Math.sqrt(sec) - Math.sqrt(bestD)) < 1.5 && outline > 0.1 ? (1 - outline * 0.7) : 1;
                    od[oi]   = sd[si]   * edge;
                    od[oi+1] = sd[si+1] * edge;
                    od[oi+2] = sd[si+2] * edge;
                    od[oi+3] = sd[si+3];
                }
            }
            ctx.putImageData(out, 0, 0);
        },
    },

    rgbOffset: {
        label: "RGB Offset",
        makeParams: () => ({
            amount:  { base: 8,   min: 0,  max: 40,  mod: { source: "" } },
            angle:   { base: 30,  min: 0,  max: 360, mod: { source: "" } },
            speed:   { base: 0.5, min: 0,  max: 4,   mod: { source: "" } },
            pulse:   { base: 0.5, min: 0,  max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const amt = p.amount ?? 8;
            const angle = ((p.angle ?? 30) + t * (p.speed ?? 0.5) * 20) * Math.PI / 180;
            const rdx = Math.cos(angle) * amt, rdy = Math.sin(angle) * amt;
            const bdx = -Math.cos(angle) * amt, bdy = -Math.sin(angle) * amt;

            if (!entry._rgbOff) {
                const oc = document.createElement("canvas"); oc.width = w; oc.height = h;
                entry._rgbOff = oc; entry._rgbCtx = oc.getContext("2d");
            }
            const oc = entry._rgbOff, oCtx = entry._rgbCtx;
            if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }

            oCtx.clearRect(0, 0, w, h);
            oCtx.drawImage(src, rdx, rdy);
            const ri = oCtx.getImageData(0, 0, w, h);
            const gi = src.getContext("2d").getImageData(0, 0, w, h);
            oCtx.clearRect(0, 0, w, h);
            oCtx.drawImage(src, bdx, bdy);
            const bi = oCtx.getImageData(0, 0, w, h);

            const out = ctx.createImageData(w, h);
            const od = out.data, rd = ri.data, gd = gi.data, bd2 = bi.data;
            for (let i = 0; i < od.length; i += 4) {
                od[i]   = rd[i];
                od[i+1] = gd[i+1];
                od[i+2] = bd2[i+2];
                od[i+3] = Math.max(rd[i+3], gd[i+3], bd2[i+3]);
            }
            ctx.putImageData(out, 0, 0);
        },
    },

    dither: {
        label: "Dither",
        makeParams: () => ({
            levels:   { base: 4,   min: 2,  max: 16, step: 1, mod: { source: "" } },
            scale:    { base: 1,   min: 1,  max: 4,  step: 1, mod: { source: "" } }, // Bayer matrix scale
            color:    { base: 0,   min: 0,  max: 1,  step: 1, mod: { source: "" } }, // 0=mono, 1=color
            pulse:    { base: 0.3, min: 0,  max: 1,           mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const BAYER4 = [
                0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5
            ].map(v => v / 16);
            const levels = Math.round(Math.max(2, Math.min(16, p.levels ?? 4)));
            const scale = Math.round(Math.max(1, Math.min(4, p.scale ?? 1)));
            const doColor = (p.color ?? 0) > 0.5;
            const step = 1 / (levels - 1);

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(src, 0, 0);
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const bx = Math.floor(x / scale) % 4, by = Math.floor(y / scale) % 4;
                    const threshold = BAYER4[by * 4 + bx];
                    const i = (y * w + x) * 4;
                    if (doColor) {
                        d[i]   = Math.round((d[i]   / 255 + threshold * step - step * 0.5) / step) * step * 255;
                        d[i+1] = Math.round((d[i+1] / 255 + threshold * step - step * 0.5) / step) * step * 255;
                        d[i+2] = Math.round((d[i+2] / 255 + threshold * step - step * 0.5) / step) * step * 255;
                    } else {
                        const luma = (d[i] * 0.2126 + d[i+1] * 0.7152 + d[i+2] * 0.0722) / 255;
                        const q = Math.round((luma + threshold * step - step * 0.5) / step) * step * 255;
                        d[i] = d[i+1] = d[i+2] = Math.max(0, Math.min(255, q));
                    }
                }
            }
            ctx.putImageData(img, 0, 0);
        },
    },

    dropShadow: {
        label: "Drop Shadow",
        makeParams: () => ({
            offsetX:  { base: 8,   min: -60, max: 60, mod: { source: "" } },
            offsetY:  { base: 12,  min: -60, max: 60, mod: { source: "" } },
            blur:     { base: 10,  min: 0,   max: 60, mod: { source: "" } },
            opacity:  { base: 0.7, min: 0,   max: 1,  mod: { source: "" } },
            hue:      { base: 0,   min: 0,   max: 360, mod: { source: "" } }, // 0=black shadow, >0 coloured
            sat:      { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
        }),
        apply(src, ctx, w, h, p, entry, t) {
            if (!entry._sh) { entry._sh = document.createElement("canvas"); entry._shCtx = entry._sh.getContext("2d"); }
            const sh = entry._sh, sctx = entry._shCtx;
            if (sh.width !== w || sh.height !== h) { sh.width = w; sh.height = h; }

            const blur = Math.max(0, p.blur ?? 10);
            // Draw src shifted + blurred into shadow canvas
            sctx.clearRect(0, 0, w, h);
            sctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
            sctx.drawImage(src, p.offsetX ?? 8, p.offsetY ?? 12);
            sctx.filter = "none";
            // Tint shadow: black by default, or any hue
            sctx.globalCompositeOperation = "source-in";
            const hue = p.hue ?? 0;
            const sat = Math.round((p.sat ?? 0) * 100);
            sctx.fillStyle = `hsl(${hue},${sat}%,${sat > 0 ? 30 : 0}%)`;
            sctx.globalAlpha = p.opacity ?? 0.7;
            sctx.fillRect(0, 0, w, h);
            sctx.globalAlpha = 1;
            sctx.globalCompositeOperation = "source-over";

            // Composite: shadow first, original on top
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(sh, 0, 0);
            ctx.drawImage(src, 0, 0);
        },
    },

    tileGrid3d: {
        label: "Tile Grid 3D",
        makeParams: () => ({
            cols:    { base: 3,   min: 1,  max: 16, step: 1, mod: { source: "" } },
            rows:    { base: 3,   min: 1,  max: 16, step: 1, mod: { source: "" } },
            zoom:    { base: 1,   min: 0.1, max: 6,          mod: { source: "" } },
            angle:   { base: 0,   min: -180, max: 180,       mod: { source: "" } },
            scrollX: { base: 0,   min: -4,  max: 4,          mod: { source: "" } },
            scrollY: { base: 0,   min: -4,  max: 4,          mod: { source: "" } },
            tilt:    { base: 0,   min: 0,   max: 1,          mod: { source: "" } }, // 0=flat grid, 1=full perspective floor
            horizon: { base: 0.5, min: 0.05, max: 0.95,      mod: { source: "" } },
            ceil:    { base: 0,   min: 0,   max: 1, step: 1, mod: { source: "" } }, // mirror floor above horizon too
        }),
        apply(src, ctx, w, h, p, entry, t) {
            const cols    = Math.round(Math.max(1, Math.min(16, p.cols ?? 3)));
            const rows    = Math.round(Math.max(1, Math.min(16, p.rows ?? 3)));
            const zoom    = Math.max(0.05, p.zoom ?? 1);
            const angle   = ((p.angle ?? 0) * Math.PI) / 180;
            const scrollX = p.scrollX ?? 0;
            const scrollY = p.scrollY ?? 0;
            const tilt    = Math.max(0, Math.min(1, p.tilt ?? 0));
            const horizon = Math.max(0.05, Math.min(0.95, p.horizon ?? 0.5));
            const doCeil  = (p.ceil ?? 0) > 0.5;

            // ── Build tiled canvas ────────────────────────────────────────────
            // Extra padding tiles on each side give scroll & centering headroom.
            const padC = 2, padR = 2;
            const tc = cols + padC * 2, tr = rows + padR * 2;
            if (!entry._tc) { entry._tc = document.createElement("canvas"); entry._tctx = entry._tc.getContext("2d"); }
            const tiled = entry._tc, tctx = entry._tctx;
            const tilW = w / cols, tilH = h / rows;
            const tw = tilW * tc, th = tilH * tr;
            if (tiled.width !== Math.round(tw) || tiled.height !== Math.round(th)) {
                tiled.width = Math.round(tw); tiled.height = Math.round(th);
            }
            tctx.clearRect(0, 0, tiled.width, tiled.height);
            for (let r = 0; r < tr; r++) {
                for (let c = 0; c < tc; c++) {
                    tctx.drawImage(src, c * tilW, r * tilH, tilW, tilH);
                }
            }

            // ── Accumulated scroll ────────────────────────────────────────────
            if (!entry._lt) entry._lt = t;
            const dt = t - entry._lt; entry._lt = t;
            entry._ox = ((entry._ox ?? 0) + scrollX * dt * tilW);
            entry._oy = ((entry._oy ?? 0) + scrollY * dt * tilH);
            const ox = ((entry._ox % tiled.width)  + tiled.width)  % tiled.width;
            const oy = ((entry._oy % tiled.height) + tiled.height) % tiled.height;

            ctx.clearRect(0, 0, w, h);

            if (tilt < 0.02) {
                // ── Flat tiled mode ───────────────────────────────────────────
                ctx.save();
                ctx.translate(w / 2, h / 2);
                ctx.rotate(angle);
                ctx.scale(zoom, zoom);
                ctx.drawImage(tiled, ox - tiled.width / 2, oy - tiled.height / 2);
                // Extra copy shifted by one tiled-canvas width for seamless wrap
                ctx.drawImage(tiled, ox - tiled.width / 2 - tiled.width, oy - tiled.height / 2);
                ctx.drawImage(tiled, ox - tiled.width / 2 + tiled.width, oy - tiled.height / 2);
                ctx.drawImage(tiled, ox - tiled.width / 2, oy - tiled.height / 2 - tiled.height);
                ctx.drawImage(tiled, ox - tiled.width / 2, oy - tiled.height / 2 + tiled.height);
                ctx.restore();
                return;
            }

            // ── Perspective floor (and optional ceiling) ──────────────────────
            // Classic floor-raycasting: for each horizontal strip below the horizon,
            // sample a strip of the tiled canvas at the corresponding world depth.
            const hy = h * horizon;
            const STRIPS = 180; // strips for quality vs performance

            function drawFloor(flipY) {
                const floorTop  = flipY ? 0    : hy;
                const floorBot  = flipY ? hy   : h;
                const floorH    = Math.abs(floorBot - floorTop);

                for (let s = 0; s < STRIPS; s++) {
                    const frac = (s + 0.5) / STRIPS;
                    // depth: 0 at horizon edge, 1 at far edge (bottom/top)
                    const depth = (1 / Math.max(0.001, frac)) / zoom;

                    // Source rect width in tiled canvas: wider = farther zoomed out
                    const srcW = Math.min(tiled.width * 4, w * depth);
                    // Source rect Y: march from center outward as depth grows
                    const rawY = tiled.height / 2 + oy + (flipY ? 1 : -1) * depth * tilH;
                    const srcY = ((rawY % tiled.height) + tiled.height) % tiled.height;
                    const srcH = Math.max(0.5, tilH / STRIPS);

                    const y0 = flipY
                        ? hy   - floorH * (s + 1) / STRIPS
                        : hy   + floorH * s        / STRIPS;
                    const y1 = flipY
                        ? hy   - floorH * s        / STRIPS
                        : hy   + floorH * (s + 1)  / STRIPS;
                    if (y0 >= h || y1 <= 0) continue;

                    // Center the source X with horizontal scroll
                    const srcX0 = ((tiled.width / 2 + ox - srcW / 2) % tiled.width + tiled.width) % tiled.width;

                    // Draw strip — split at tiled canvas edge if it wraps
                    const over = srcX0 + srcW - tiled.width;
                    if (over <= 0) {
                        ctx.drawImage(tiled, srcX0, srcY, srcW, srcH, 0, y0, w, y1 - y0);
                    } else {
                        const w1 = tiled.width - srcX0;
                        const sw1 = w * (w1 / srcW);
                        ctx.drawImage(tiled, srcX0, srcY, w1,   srcH, 0,   y0, sw1,     y1 - y0);
                        ctx.drawImage(tiled, 0,     srcY, over, srcH, sw1, y0, w - sw1, y1 - y0);
                    }
                }
            }

            drawFloor(false);          // floor below horizon
            if (doCeil) drawFloor(true); // ceiling above horizon (mirrored)
        },
    },
};

export const FX_CATEGORIES = [
    { label: "Color",    bg: "#1a0d28", ids: ["tint","colorAdjust","hueRotate","duotone","thermal","invert","grain","chromaKey"] },
    { label: "Blur/Glow",bg: "#0d1a28", ids: ["blur","bloom","neonGlow","vignette","lensFlare","oilPaint","motionBlur"] },
    { label: "Distort",  bg: "#0d2818", ids: ["ripple","mirror","kaleidoscope","droste","displace3d","pixelWarp","seamlessScroll","pixelDrift","crystalize","rgbOffset","tileGrid3d"] },
    { label: "Glitch",   bg: "#280d0d", ids: ["glitch","sliceGlitch","datamosh","pixelSort","scanlines"] },
    { label: "Time",     bg: "#1a1a00", ids: ["feedback","strobe","echoZoom","zoomPulse","zoomBurst","frameDiff"] },
    { label: "Pattern",  bg: "#001a28", ids: ["halftone","ascii","ledWall","warholGrid","posterize","solarize","contourLines","pixelate","threshold","dither"] },
    { label: "Edge",     bg: "#280d1a", ids: ["edge","chromaticAberration","dropShadow"] },
];
