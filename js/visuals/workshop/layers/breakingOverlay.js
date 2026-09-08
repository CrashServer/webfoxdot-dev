// ── Breaking Overlay ─────────────────────────────────────────────────────────
// Broadcast emergency aesthetic: BREAKING / LIVE / ALERT banners,
// lower thirds, ticker bars, flash cuts. Beat-triggers flicker & swap.

const TAGS = ["BREAKING", "LIVE", "ALERT", "URGENT", "SPECIAL REPORT",
               "WARNING", "INTERRUPTED", "CENSORED", "SIGNAL LOST", "ERROR"];

const _st = new WeakMap();

export const breakingOverlayParams = () => ({
    tags:     { base: 1,    min: 0, max: 1,   step: 1, mod: { source: "" } },
    bars:     { base: 1,    min: 0, max: 1,   step: 1, mod: { source: "" } },
    ticker:   { base: 1,    min: 0, max: 1,   step: 1, mod: { source: "" } },
    intensity:{ base: 0.7,  min: 0, max: 1,   mod: { source: "" } },
    hue:      { base: 0,    min: 0, max: 360, mod: { source: "" } },
    size:     { base: 0.5,  min: 0.2, max: 1, mod: { source: "" } },
    speed:    { base: 1,    min: 0, max: 4,   mod: { source: "" } },
});

const TICKER_WORDS = ["SYSTEM FAILURE", "SIGNAL INTERCEPTED", "BROADCAST OVERRIDE",
    "ALL UNITS RESPOND", "EMERGENCY PROTOCOL", "TRANSMISSION INTERRUPTED",
    "UNAUTHORIZED ACCESS", "CONTAINMENT BREACH", "CRITICAL ERROR", "PANIC MODE"];

export function drawBreakingOverlay(ctx, w, h, p, t, extra) {
    const sp   = extra?.spectrum ?? [];
    const bass = sp.length > 3 ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 3) : 0;
    const mid  = sp.length > 20 ? Math.min(1, (sp[10] + sp[15]) / 2 * 3) : 0;

    const intensity = (p.intensity ?? 0.7) + bass * 0.3;
    const hue       = p.hue ?? 0;
    const sz        = p.size ?? 0.5;
    const speed     = p.speed ?? 1;
    const doTags    = (p.tags ?? 1) > 0.5;
    const doBars    = (p.bars ?? 1) > 0.5;
    const doTicker  = (p.ticker ?? 1) > 0.5;

    let st = _st.get(ctx);
    if (!st) {
        st = { tagIdx: 0, tickerX: w, lastBeat: -1, lastT: t, tickWords: TICKER_WORDS.slice() };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    // Beat → cycle to next tag, reset ticker
    if (bass > 0.7 && t - st.lastBeat > 0.3) {
        st.tagIdx = (st.tagIdx + 1) % TAGS.length;
        st.lastBeat = t;
    }

    ctx.clearRect(0, 0, w, h);

    const fs = Math.floor(h * sz * 0.12);
    const accent = `hsl(${hue},90%,55%)`;
    const accentDark = `hsl(${hue},90%,20%)`;
    const white = "#fff";
    const flash = bass > 0.6 ? Math.min(1, (bass - 0.6) / 0.4) : 0;

    // Bottom bar with BREAKING tag
    if (doBars) {
        const barH = Math.floor(h * 0.065);
        const barY = h - barH * 2 - 6;
        ctx.fillStyle = accentDark;
        ctx.fillRect(0, barY, w, barH);
        ctx.fillStyle = accent;
        ctx.fillRect(0, barY + barH, w, Math.max(2, barH * 0.15));
        if (doTags) {
            ctx.font = `900 ${barH * 0.7}px 'Arial Black', 'Impact', sans-serif`;
            ctx.fillStyle = white;
            ctx.textBaseline = "middle";
            ctx.fillText(TAGS[st.tagIdx], 12, barY + barH / 2);
        }
    }

    // Scrolling ticker
    if (doTicker) {
        const tickH = Math.floor(h * 0.04);
        const tickY = h - tickH - 2;
        ctx.fillStyle = accent;
        ctx.fillRect(0, tickY, w, tickH);
        ctx.font = `700 ${tickH * 0.7}px monospace`;
        ctx.fillStyle = "#000";
        ctx.textBaseline = "middle";
        const tickStr = TICKER_WORDS.join("  //  ") + "  //  ";
        const tickPx = ctx.measureText(tickStr).width;
        st.tickerX -= speed * dt * w * 0.12;
        if (st.tickerX < -tickPx) st.tickerX = 0;
        ctx.fillText(tickStr + tickStr, st.tickerX, tickY + tickH / 2);
    }

    // Flashing side label: LIVE ●
    if (doTags) {
        const labelH = Math.floor(h * 0.06);
        const labelY = 10;
        const blink = (Math.floor(t * speed * 1.5) % 2 === 0) ? 1 : 0.3;
        ctx.fillStyle = `rgba(${accent.startsWith("hsl") ? "200,0,0" : "200,0,0"},${blink})`;
        const tag = "● LIVE";
        ctx.font = `900 ${labelH}px 'Arial Black', 'Impact', sans-serif`;
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = accentDark;
        ctx.fillRect(w - tw - 20, labelY, tw + 16, labelH + 8);
        ctx.fillStyle = `hsl(${(hue + 180) % 360},90%,70%)`;
        ctx.fillStyle = "#ff2222";
        ctx.globalAlpha = blink;
        ctx.fillText(tag, w - tw - 12, labelY + 4 + labelH * 0.8);
        ctx.globalAlpha = 1;
    }

    // Beat flash overlay
    if (flash > 0.05) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.25})`;
        ctx.fillRect(0, 0, w, h);
    }
}
