// ── Video/Image layer ─────────────────────────────────────────────────────
// Real footage / stills mixed alongside procedural layers.
// The file lives on ch.mediaEl (set via loadMedia()) and arrives here via
// extra.media. All numeric controls (speed, scrub, zoom…) are driver-assignable.

export const mediaParams = () => ({
    zoom:     { base: 1,   min: 0.1, max: 4,    mod: { source: "" } },
    offsetX:  { base: 0,   min: -1,  max: 1,    mod: { source: "" } },
    offsetY:  { base: 0,   min: -1,  max: 1,    mod: { source: "" } },
    rotation: { base: 0,   min: -180, max: 180, mod: { source: "" } },
    mirror:   { base: 0,   min: 0,   max: 1,    step: 1, mod: { source: "" } },
    flipV:    { base: 0,   min: 0,   max: 1,    step: 1, mod: { source: "" } },
    fit:      { base: 0,   min: 0,   max: 2,    step: 1, mod: { source: "" } }, // 0=cover 1=contain 2=stretch
    speed:    { base: 1,   min: -3,  max: 4,    mod: { source: "" } }, // 0=freeze, <0=reverse
    scrub:    { base: 0,   min: 0,   max: 1,    mod: { source: "" } }, // used when speed=0
    hueShift: { base: 0,   min: 0,   max: 360,  mod: { source: "" } },
    sat:      { base: 100, min: 0,   max: 300,  mod: { source: "" } },
    bright:   { base: 100, min: 0,   max: 300,  mod: { source: "" } },
    contrast: { base: 100, min: 0,   max: 300,  mod: { source: "" } },
});

export function drawMedia(ctx, w, h, p, t, extra) {
    const el = extra?.media;
    const isVideo = el?.tagName === "VIDEO";
    const ready = el && (isVideo ? el.readyState >= 2 : el.complete && el.naturalWidth > 0);

    if (isVideo && ready) {
        const speed = p.speed ?? 1;
        // Always loop — matches the web Media layer. A clip that stops on its
        // last frame is a dead channel mid-set, so the toggle only ever hurt.
        el.loop = true;

        if (Math.abs(speed) < 0.01) {
            // Freeze mode: pause and let scrub param set position
            if (!el.paused) el.pause();
            const dur = el.duration;
            if (dur > 0) el.currentTime = Math.max(0, Math.min(dur, (p.scrub ?? 0) * dur));
        } else if (speed < 0) {
            // Reverse: step backwards each frame using last-t tracking
            if (!el.paused) el.pause();
            const dt = el._revLastT != null ? t - el._revLastT : 0;
            el._revLastT = t;
            const dur = el.duration;
            if (dur > 0) {
                let next = el.currentTime - Math.abs(speed) * dt;
                if (next < 0) next = dur + next;          // reverse wraps too
                el.currentTime = Math.max(0, next);
            }
        } else {
            // Normal / fast-forward
            el._revLastT = null;
            el.playbackRate = Math.max(0.0625, Math.min(16, speed));
            if (el.paused) el.play().catch(() => {});
        }
    }

    ctx.clearRect(0, 0, w, h);
    if (!ready) return;

    const ew = el.videoWidth || el.naturalWidth || w;
    const eh = el.videoHeight || el.naturalHeight || h;
    const fit = Math.round(p.fit ?? 0);
    let drawW, drawH;
    if (fit === 2) {          // stretch — fill canvas ignoring aspect ratio
        drawW = w; drawH = h;
    } else if (fit === 1) {   // contain — letterbox
        const s = Math.min(w / ew, h / eh);
        drawW = ew * s; drawH = eh * s;
    } else {                  // cover (default) — crop to fill
        const s = Math.max(w / ew, h / eh);
        drawW = ew * s; drawH = eh * s;
    }

    ctx.save();
    ctx.translate(w / 2 + (p.offsetX ?? 0) * w, h / 2 + (p.offsetY ?? 0) * h);
    ctx.rotate(((p.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(
        ((p.mirror ?? 0) > 0.5 ? -1 : 1) * (p.zoom ?? 1),
        ((p.flipV  ?? 0) > 0.5 ? -1 : 1) * (p.zoom ?? 1),
    );
    ctx.filter = `hue-rotate(${p.hueShift ?? 0}deg) saturate(${p.sat ?? 100}%) brightness(${p.bright ?? 100}%) contrast(${p.contrast ?? 100}%)`;
    ctx.drawImage(el, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.filter = "none";
    ctx.restore();
}
