// ── Impact Text ───────────────────────────────────────────────────────────
// Meme/statement text with chroma split, block corruption and phrase cycling.
// The channel's `message` holds the bank — "|" separates phrases, "\n" breaks
// lines — so the punk statement banks from the WebGPU build paste straight in.
// cycleMode 2 cuts on the beat, which is what makes it land with the track.

const BANK = [
    "NO FUTURE", "NO GODS\nNO MASTERS", "DIY\nOR DIE", "SMASH THE\nALGORITHM",
    "THIS IS\nA RIOT", "WE ARE\nTHE STATIC", "DO NOT\nCOMPLY",
];

export const impactTextParams = () => ({
    fontScale:   { base: 0.22, min: 0.03, max: 0.8, mod: { source: "" } },
    posX:        { base: 0,    min: -1,   max: 1,   mod: { source: "" } },
    posY:        { base: 0,    min: -1,   max: 1,   mod: { source: "" } },
    rotation:    { base: 0,    min: -180, max: 180, mod: { source: "" } },
    cycleMode:   { base: 2,    min: 0,    max: 2, step: 1, mod: { source: "" } },  // 0 manual 1 timer 2 beat
    cycleIndex:  { base: 0,    min: 0,    max: 32, step: 1, mod: { source: "" } },
    cycleTime:   { base: 2.5,  min: 0.2,  max: 20,  mod: { source: "" } },
    hue:         { base: 0,    min: 0,    max: 360, mod: { source: "" } },
    sat:         { base: 0,    min: 0,    max: 100, mod: { source: "" } },
    light:       { base: 100,  min: 0,    max: 100, mod: { source: "" } },
    chroma:      { base: 0.01, min: 0,    max: 0.08, mod: { source: "" } },
    corrupt:     { base: 0.2,  min: 0,    max: 1,   mod: { source: "" } },
    shadow:      { base: 1,    min: 0,    max: 1, step: 1, mod: { source: "" } },
    plate:       { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    bassToScale: { base: 0.25, min: 0,    max: 1.5, mod: { source: "" } },
});

function bassLevel(s) {
    if (!s?.length) return 0;
    const n = Math.max(1, (s.length * 0.08) | 0);
    let v = 0; for (let i = 1; i <= n; i++) v += s[i];
    return Math.min(1, (v / n) * 2.5);
}

let idx = 0, acc = 0, lastT = 0, prevBass = 0;

export function drawImpactText(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    const raw = String(extra?.message ?? "").trim();
    const phrases = (raw ? raw.split("|") : BANK).map((s) => s.replace(/\\n/g, "\n").trim()).filter(Boolean);
    if (!phrases.length) return;

    let dt = t - lastT; lastT = t;
    if (!(dt > 0) || dt > 1) dt = 0;
    const mode = Math.round(p.cycleMode ?? 2);
    const bass = bassLevel(extra?.spectrum);
    if (mode === 1) { acc += dt; if (acc >= (p.cycleTime ?? 2.5)) { acc = 0; idx++; } }
    else if (mode === 2) { if (bass > 0.55 && prevBass <= 0.55) idx++; }
    prevBass = bass;
    const which = mode === 0 ? Math.round(p.cycleIndex ?? 0) : idx;
    const lines = phrases[((which % phrases.length) + phrases.length) % phrases.length].split("\n");

    const scale = (p.fontScale ?? 0.22) * (1 + bass * (p.bassToScale ?? 0.25));
    const fs = Math.max(6, h * scale);
    const cx = w / 2 + (p.posX ?? 0) * w * 0.5;
    const cy = h / 2 + (p.posY ?? 0) * h * 0.5;
    const fill = `hsl(${p.hue ?? 0} ${p.sat ?? 0}% ${p.light ?? 100}%)`;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((p.rotation ?? 0) * Math.PI) / 180);
    ctx.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lh = fs * 1.05, y0 = -((lines.length - 1) * lh) / 2;

    if ((p.plate ?? 0) > 0.01) {
        let maxw = 0; for (const l of lines) maxw = Math.max(maxw, ctx.measureText(l).width);
        ctx.globalAlpha = p.plate;
        ctx.fillStyle = "#000";
        ctx.fillRect(-maxw / 2 - fs * 0.2, y0 - lh * 0.62, maxw + fs * 0.4, lh * lines.length + fs * 0.2);
        ctx.globalAlpha = 1;
    }
    const drawLines = (dx, dy, style) => {
        ctx.fillStyle = style;
        lines.forEach((l, i) => ctx.fillText(l, dx, y0 + i * lh + dy));
    };
    if ((p.shadow ?? 1) > 0.5) drawLines(fs * 0.05, fs * 0.05, "rgba(0,0,0,0.75)");
    const ch = (p.chroma ?? 0.01) * w;
    if (ch > 0.2) {
        ctx.globalCompositeOperation = "lighter";
        drawLines(-ch, 0, "rgba(255,0,64,0.85)");
        drawLines(ch, 0, "rgba(0,190,255,0.85)");
        ctx.globalCompositeOperation = "source-over";
    }
    drawLines(0, 0, fill);
    ctx.restore();

    // block corruption: shove random slabs of the text sideways
    const co = p.corrupt ?? 0;
    if (co > 0.01) {
        const n = Math.round(co * 9);
        for (let i = 0; i < n; i++) {
            const bh = Math.max(2, fs * (0.05 + Math.random() * 0.18));
            const sy = cy - fs * 0.7 + Math.random() * fs * 1.6;
            const off = (Math.random() - 0.5) * w * 0.25 * co;
            try { ctx.drawImage(ctx.canvas, 0, sy, w, bh, off, sy, w, bh); } catch (_) {}
        }
    }
}
