// ── News Ticker ───────────────────────────────────────────────────────────
// Broadcast lower-third: channel bug, LIVE badge, headline strip, crawl and
// clock. The channel's `message` field supplies headlines ("|" separates them);
// with no message it runs a built-in bank in the post-truth register the rest
// of this project speaks.

const BANK = [
    "SOURCES CONFIRM THE SOURCES",
    "MARKETS REACT TO A THING THAT HAS NOT HAPPENED YET",
    "OFFICIALS URGE CALM · OFFICIALS UNAVAILABLE FOR COMMENT",
    "ALGORITHM DENIES INVOLVEMENT",
    "STUDY FINDS STUDIES INCONCLUSIVE",
    "BREAKING: SITUATION DEVELOPING · DEVELOPMENT SITUATIONAL",
    "ANALYSTS DIVIDED ON WHETHER ANALYSTS ARE DIVIDED",
    "ENGAGEMENT UP · TRUST DOWN · NOBODY SURPRISED",
];

export const newsTickerParams = () => ({
    speed:     { base: 90,  min: -400, max: 400, mod: { source: "" } },   // px/sec
    barY:      { base: 0.82,min: 0,    max: 1,   mod: { source: "" } },
    barHeight: { base: 0.1, min: 0.02, max: 0.4, mod: { source: "" } },
    fontScale: { base: 1,   min: 0.3,  max: 3,   mod: { source: "" } },
    hue:       { base: 355, min: 0,    max: 360, mod: { source: "" } },
    bgAlpha:   { base: 0.85,min: 0,    max: 1,   mod: { source: "" } },
    showBug:   { base: 1,   min: 0,    max: 1, step: 1, mod: { source: "" } },
    showClock: { base: 1,   min: 0,    max: 1, step: 1, mod: { source: "" } },
    showLive:  { base: 1,   min: 0,    max: 1, step: 1, mod: { source: "" } },
    headline:  { base: 1,   min: 0,    max: 1, step: 1, mod: { source: "" } },  // second, static line above
    flicker:   { base: 0.1, min: 0,    max: 1,   mod: { source: "" } },
    glitch:    { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
});

export function drawNewsTicker(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    const msg = String(extra?.message ?? "").trim();
    const items = (msg ? msg.split("|") : BANK).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;

    const hue = p.hue ?? 355;
    const bh = Math.max(8, h * (p.barHeight ?? 0.1));
    const by = (p.barY ?? 0.82) * h;
    const fs = bh * 0.52 * (p.fontScale ?? 1);
    const flick = 1 - (p.flicker ?? 0) * 0.5 * (0.5 + 0.5 * Math.sin(t * 37.7));

    ctx.save();
    // strip
    ctx.globalAlpha = (p.bgAlpha ?? 0.85) * flick;
    ctx.fillStyle = "#08080c";
    ctx.fillRect(0, by, w, bh);
    ctx.fillStyle = `hsl(${hue} 85% 45%)`;
    ctx.fillRect(0, by, w, Math.max(1, bh * 0.06));
    ctx.globalAlpha = flick;

    // channel bug
    let x0 = 0;
    if ((p.showBug ?? 1) > 0.5) {
        const bw = bh * 1.6;
        ctx.fillStyle = `hsl(${hue} 85% 42%)`;
        ctx.fillRect(0, by, bw, bh);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${fs * 0.9}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("N24", bw / 2, by + bh / 2);
        x0 = bw;
    }
    if ((p.showLive ?? 1) > 0.5) {
        const lw = bh * 1.25;
        ctx.fillStyle = (Math.sin(t * 4) > -0.4) ? "#e11" : "#611";
        ctx.fillRect(x0 + bh * 0.12, by + bh * 0.2, lw, bh * 0.6);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${fs * 0.62}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("LIVE", x0 + bh * 0.12 + lw / 2, by + bh / 2);
        x0 += lw + bh * 0.3;
    }

    // clock on the right
    let x1 = w;
    if ((p.showClock ?? 1) > 0.5) {
        const cwid = bh * 2.2;
        x1 = w - cwid;
        ctx.fillStyle = "#111";
        ctx.fillRect(x1, by, cwid, bh);
        const d = new Date();
        ctx.fillStyle = `hsl(${hue} 60% 75%)`;
        ctx.font = `bold ${fs * 0.8}px monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, x1 + cwid / 2, by + bh / 2);
    }

    // crawl — clipped to the strip between bug and clock
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, by, Math.max(0, x1 - x0), bh); ctx.clip();
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#f2f2f4";
    const sep = "   ///   ";
    const line = items.join(sep) + sep;
    const lw = ctx.measureText(line).width || 1;
    let sx = x0 - ((t * (p.speed ?? 90)) % lw);
    while (sx < x1) { ctx.fillText(line, sx, by + bh / 2); sx += lw; }
    ctx.restore();

    // static headline above the strip
    if ((p.headline ?? 1) > 0.5) {
        const idx = Math.floor(t / 4) % items.length;
        const hy = by - bh * 0.62;
        ctx.font = `bold ${fs * 1.25}px system-ui, sans-serif`;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        const txt = items[idx].toUpperCase();
        const pad = bh * 0.25;
        const tw = ctx.measureText(txt).width;
        ctx.globalAlpha = (p.bgAlpha ?? 0.85) * flick;
        ctx.fillStyle = `hsl(${hue} 80% 30%)`;
        ctx.fillRect(0, hy - bh * 0.4, Math.min(w, tw + pad * 2), bh * 0.8);
        ctx.globalAlpha = flick;
        ctx.fillStyle = "#fff";
        ctx.fillText(txt, pad, hy);
    }

    // horizontal tear
    const gl = p.glitch ?? 0;
    if (gl > 0.01 && Math.sin(t * 13.3) > 1 - gl * 1.2) {
        const sy2 = by + Math.random() * bh, sh = Math.max(2, bh * 0.2);
        const off = (Math.random() - 0.5) * w * 0.3 * gl;
        try { ctx.drawImage(ctx.canvas, 0, sy2, w, sh, off, sy2, w, sh); } catch (_) {}
    }
    ctx.restore();
}
