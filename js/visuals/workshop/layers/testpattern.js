// ── Test Pattern layer ────────────────────────────────────────────────────
// Calibration/mapping aid: grid + crosshair + color bars + corner/center
// markers + safe-area border. Put this up on a channel WHILE dragging an
// output's corner-pin handles so you can see exactly where the frame edges,
// thirds, and center land on the physical surface — every real mapping tool
// has something like this; procedural layers alone don't give you it.

export const testPatternParams = () => ({
    gridDiv:   { base: 8,  min: 2,  max: 32, mod: { source: "" } },
    barsOn:    { base: 1,  min: 0,  max: 1,  mod: { source: "" } },
    crossOn:   { base: 1,  min: 0,  max: 1,  mod: { source: "" } },
    safeArea:  { base: 10, min: 0,  max: 20, mod: { source: "" } }, // % margin
});

const BAR_HUES = [0, 60, 120, 180, 240, 300]; // red,yellow,green,cyan,blue,magenta

export function drawTestPattern(ctx, w, h, p) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (p.barsOn > 0.5) {
        const bw = w / BAR_HUES.length;
        BAR_HUES.forEach((hue, i) => {
            ctx.fillStyle = `hsl(${hue},80%,50%)`;
            ctx.fillRect(i * bw, 0, bw, h * 0.25);
        });
    }

    // Grid
    const cols = Math.max(2, Math.round(p.gridDiv)), rows = Math.max(2, Math.round(p.gridDiv * h / w));
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) { const x = (i / cols) * w; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let j = 0; j <= rows; j++) { const y = (j / rows) * h; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // Safe area border
    if (p.safeArea > 0) {
        const mx = w * (p.safeArea / 100), my = h * (p.safeArea / 100);
        ctx.strokeStyle = "#ff3b3b";
        ctx.lineWidth = 2;
        ctx.strokeRect(mx, my, w - mx * 2, h - my * 2);
    }

    // Crosshair + center circle
    if (p.crossOn > 0.5) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.05, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Corner markers (L-shapes) — the first thing you check when warping
    const cl = Math.min(w, h) * 0.05;
    ctx.strokeStyle = "#4fd1ff"; ctx.lineWidth = 3;
    const corners = [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + cl * sx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + cl * sy);
        ctx.stroke();
    }

    // Resolution label
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.round(h * 0.03)}px monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`${w}×${h}`, w / 2, h * 0.6);

    ctx.restore();
}
