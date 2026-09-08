// ── Propaganda Poster ─────────────────────────────────────────────────────
// Constructivist poster: sunburst rays, a hard diagonal band, a stencil slogan
// and print grain. Slogan comes from the channel `message` ("|" cycles), else a
// built-in bank. Rays rotate with the beat.

const BANK = ["OBEY", "CONSUME", "COMPLY", "PRODUCE", "REPEAT", "BUY NOTHING", "REFUSE", "NO FUTURE"];

export const propagandaPosterParams = () => ({
    rays:      { base: 16,  min: 0,   max: 64, step: 1, mod: { source: "" } },
    spin:      { base: 0.08,min: -2,  max: 2,  mod: { source: "" } },
    hue:       { base: 8,   min: 0,   max: 360, mod: { source: "" } },
    inkHue:    { base: 45,  min: 0,   max: 360, mod: { source: "" } },
    bandAngle: { base: -18, min: -90, max: 90, mod: { source: "" } },
    bandWidth: { base: 0.34,min: 0,   max: 1,  mod: { source: "" } },
    fontScale: { base: 0.2, min: 0.04,max: 0.6,mod: { source: "" } },
    cycleTime: { base: 3,   min: 0.2, max: 20, mod: { source: "" } },
    grain:     { base: 0.18,min: 0,   max: 1,  mod: { source: "" } },
    vignette:  { base: 0.5, min: 0,   max: 1,  mod: { source: "" } },
    star:      { base: 1,   min: 0,   max: 1, step: 1, mod: { source: "" } },
    bassToRays:{ base: 0.5, min: 0,   max: 3,  mod: { source: "" } },
});

function bassLevel(s) {
    if (!s?.length) return 0;
    const n = Math.max(1, (s.length * 0.08) | 0);
    let v = 0; for (let i = 1; i <= n; i++) v += s[i];
    return Math.min(1, (v / n) * 2.5);
}

export function drawPropagandaPoster(ctx, w, h, p, t, extra) {
    const bass = bassLevel(extra?.spectrum);
    const hue = p.hue ?? 8, ink = p.inkHue ?? 45;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.fillStyle = `hsl(${hue} 70% 34%)`;
    ctx.fillRect(0, 0, w, h);

    // sunburst
    const rays = Math.round(p.rays ?? 16);
    if (rays > 0) {
        const cx = w / 2, cy = h * 0.42, R = Math.hypot(w, h);
        ctx.save(); ctx.translate(cx, cy);
        ctx.rotate(t * (p.spin ?? 0.08) + bass * (p.bassToRays ?? 0.5) * 0.3);
        ctx.fillStyle = `hsl(${hue} 75% 44%)`;
        for (let i = 0; i < rays; i++) {
            const a0 = (i / rays) * Math.PI * 2, a1 = a0 + Math.PI / rays;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
            ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    // diagonal band
    const bw = (p.bandWidth ?? 0.34) * h;
    if (bw > 1) {
        ctx.save();
        ctx.translate(w / 2, h * 0.55);
        ctx.rotate(((p.bandAngle ?? -18) * Math.PI) / 180);
        ctx.fillStyle = `hsl(${ink} 90% 55%)`;
        ctx.fillRect(-w, -bw / 2, w * 2, bw);
        ctx.restore();
    }

    if ((p.star ?? 1) > 0.5) {
        const R = Math.min(w, h) * 0.12, cx = w * 0.5, cy = h * 0.24;
        ctx.fillStyle = `hsl(${ink} 95% 60%)`;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const r = i % 2 ? R * 0.42 : R, a = -Math.PI / 2 + (i * Math.PI) / 5;
            i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
    }

    // slogan
    const raw = String(extra?.message ?? "").trim();
    const bank = (raw ? raw.split("|") : BANK).map((s) => s.trim()).filter(Boolean);
    if (bank.length) {
        const word = bank[Math.floor(t / Math.max(0.2, p.cycleTime ?? 3)) % bank.length].toUpperCase();
        const fs = h * (p.fontScale ?? 0.2);
        ctx.save();
        ctx.translate(w / 2, h * 0.56);
        ctx.rotate(((p.bandAngle ?? -18) * Math.PI) / 180);
        ctx.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(1, fs * 0.05); ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(word, 0, 0);
        ctx.fillStyle = "#111";
        ctx.fillText(word, 0, 0);
        ctx.restore();
    }

    const vg = p.vignette ?? 0.5;
    if (vg > 0.01) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${vg})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const gr = p.grain ?? 0.18;
    if (gr > 0.01) {
        ctx.globalAlpha = gr * 0.5; ctx.fillStyle = "#000";
        for (let i = 0, n = (w * h) / 900; i < n; i++) ctx.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1);
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}
