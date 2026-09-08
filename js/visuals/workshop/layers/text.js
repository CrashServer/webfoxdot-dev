// ── Text layer ────────────────────────────────────────────────────────────
// Fifth workshop layer: a live-typed message (shout-outs, event name, beat
// count) — the message itself isn't a numeric param (nothing to drive it
// with), so it lives on the channel (`ch.message`) and is read via `extra`.

export const textParams = () => ({
    size:   { base: 80,  min: 10,  max: 300, mod: { source: "" } },
    // Where the message sits, as a fraction of the frame from centre:
    // -1 = hard left/top, 0 = centred, 1 = hard right/bottom. Driveable, so
    // the text can be thrown around by a fader or an audio band.
    posX:   { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
    posY:   { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
    scroll: { base: 0,   min: -6,  max: 6,   mod: { source: "" } }, // px/frame-ish horizontal drift
    rotation: { base: 0, min: -180, max: 180, mod: { source: "" } },
    hue:    { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    sat:    { base: 0,   min: 0,   max: 100, mod: { source: "" } }, // 0 = white by default
    light:  { base: 100, min: 0,   max: 100, mod: { source: "" } },
});

export function drawText(ctx, w, h, p, t, extra) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const message = extra?.message || "VJ WORKSHOP";
    // Position first, then rotate about that point, so the text spins where
    // you put it rather than orbiting the centre of the frame.
    ctx.translate(w / 2 + (p.posX ?? 0) * (w / 2), h / 2 + (p.posY ?? 0) * (h / 2));
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.translate((t * p.scroll * 40) % (w * 2), 0);
    ctx.font = `900 ${p.size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;
    ctx.fillText(message, 0, 0);
    ctx.restore();
}
