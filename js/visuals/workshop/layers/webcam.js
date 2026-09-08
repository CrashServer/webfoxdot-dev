// ── Webcam layer ──────────────────────────────────────────────────────────
// Sixth workshop layer: the student's own camera feed, mirrored/tinted/zoomed
// — a reliable "wow" moment, and pairs well with per-channel post FX
// (invert/bloom on your own face). Reads the shared cam via `extra.cam`.

export const webcamParams = () => ({
    mirror:   { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
    zoom:     { base: 1,   min: 0.5, max: 3,   mod: { source: "" } },
    rotation: { base: 0,   min: -180, max: 180, mod: { source: "" } },
    hueShift: { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    sat:      { base: 100, min: 0,   max: 300, mod: { source: "" } },
});

export function drawWebcam(ctx, w, h, p, t, extra) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const video = extra?.cam;
    if (!video || video.readyState < 2) { ctx.restore(); return; }

    ctx.translate(w / 2, h / 2);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.scale((p.mirror > 0.5 ? -1 : 1) * p.zoom, p.zoom);
    ctx.filter = `hue-rotate(${p.hueShift}deg) saturate(${p.sat}%)`;

    const vw = video.videoWidth || w, vh = video.videoHeight || h;
    const scale = Math.max(w / vw, h / vh); // cover-fit
    ctx.drawImage(video, -vw * scale / 2, -vh * scale / 2, vw * scale, vh * scale);
    ctx.filter = "none";
    ctx.restore();
}
