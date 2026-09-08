// ── Black: solid colour background with HSV controls ──────────────────────
// Default layer for a clean-slate channel — starts as pure black, but the
// hue/sat/val sliders make it a quick solid-colour wash too.

export const blackParams = () => ({
    hue: { base: 0,   min: 0, max: 360, mod: { source: "" } },
    sat: { base: 0,   min: 0, max: 1,   mod: { source: "" } },
    val: { base: 0,   min: 0, max: 1,   mod: { source: "" } },
});

function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if      (h < 60)  { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    return [(r + m) * 255 | 0, (g + m) * 255 | 0, (b + m) * 255 | 0];
}

export function drawBlack(ctx, w, h, p) {
    const [r, g, b] = hsvToRgb(p.hue % 360, p.sat, p.val);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
}
