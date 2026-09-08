// ── Scrolling Text ────────────────────────────────────────────────────────────
// Configurable marquee ticker — single line or multi-row, horizontal or vertical.
// Bass triggers a flash/pulse; treble brightens. Great for lyrics, labels, quotes.

const _st = new WeakMap();

const DEFAULT_MSG = "LIVE • VIBE • BASS • STARS • NOW PLAYING •";

export const scrollingTextParams = () => ({
    // 0..4 map to 5 preset strings; custom text not possible via param number,
    // so we ship 5 presets selectable by index.
    preset:   { base: 0,    min: 0,  max: 4,   step: 1, mod: { source: "" } },
    rows:     { base: 1,    min: 1,  max: 4,   step: 1, mod: { source: "" } },
    speed:    { base: 80,   min: 5,  max: 400,          mod: { source: "" } }, // px/sec
    fontSize: { base: 48,   min: 12, max: 160, step: 2, mod: { source: "" } },
    hue:      { base: 40,   min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    bold:     { base: 1,    min: 0,  max: 1,   step: 1, mod: { source: "" } },
    italic:   { base: 0,    min: 0,  max: 1,   step: 1, mod: { source: "" } },
    spacing:  { base: 2.0,  min: 0.5,max: 6,            mod: { source: "" } }, // letter spacing multiplier
    bgAlpha:  { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } },
    vertical: { base: 0,    min: 0,  max: 1,   step: 1, mod: { source: "" } }, // scroll direction
});

const PRESETS = [
    "LIVE • VIBE • BASS • STARS • NOW PLAYING •",
    "⚡ AUDIO REACTIVE • DOME PROJECTION • VJ SET ⚡",
    "0101 SYSTEM ONLINE • FREQUENCY LOCKED • SIGNAL CLEAR 0101",
    "∞ MUSIC IS THE ANSWER • LOSE YOURSELF • FEEL THE BASS ∞",
    "NOW LIVE • BEAT DROP INCOMING • STAY WITH US • NOW LIVE •",
];

export function drawScrollingText(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const preset  = Math.round(Math.max(0, Math.min(4, p.preset ?? 0)));
    const rows    = Math.round(Math.max(1, Math.min(4, p.rows ?? 1)));
    const speed   = (p.speed ?? 80) * (1 + bass * (p.pulse ?? 0.5) * 0.4);
    const fsize   = Math.round(Math.max(12, Math.min(160, p.fontSize ?? 48)));
    const hue     = ((p.hue ?? 40) + treble * 40) % 360;
    const glow    = p.glow ?? 0.5;
    const bold    = (p.bold ?? 1) > 0.5 ? "bold " : "";
    const italic  = (p.italic ?? 0) > 0.5 ? "italic " : "";
    const bgAlpha = p.bgAlpha ?? 0;
    const vertical= (p.vertical ?? 0) > 0.5;
    const customMsg = extra?.message && extra.message !== "VJ WORKSHOP" ? extra.message : "";
    const msg     = (customMsg || PRESETS[preset]) + " ";

    let st = _st.get(ctx);
    if (!st) { st = { scrolls: Array(4).fill(0), lastT: t }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    ctx.font = `${italic}${bold}${fsize}px Arial, sans-serif`;
    ctx.textBaseline = "middle";

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 20 * (1 + bass * 0.4);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    const bright = 60 + treble * 30;
    ctx.fillStyle = `hsl(${hue},90%,${bright}%)`;

    const msgW = ctx.measureText(msg).width;

    for (let r = 0; r < rows; r++) {
        const rowDir = r % 2 === 0 ? 1 : -1;
        st.scrolls[r] = (st.scrolls[r] + speed * dt * rowDir + msgW * 10) % msgW;

        if (!vertical) {
            const y = (r + 0.5) * (h / rows);
            let x = -st.scrolls[r];
            while (x < w + msgW) {
                ctx.fillText(msg, x, y);
                x += msgW;
            }
        } else {
            const x = (r + 0.5) * (w / rows);
            ctx.save();
            ctx.translate(x, h / 2);
            ctx.rotate(-Math.PI / 2);
            let y = -st.scrolls[r] - h / 2;
            while (y < h / 2 + msgW) {
                ctx.fillText(msg, y, 0);
                y += msgW;
            }
            ctx.restore();
        }
    }

    // Bass flash
    if (bass > 0.6) {
        ctx.fillStyle = `hsla(${hue},100%,80%,${(bass - 0.6) * 0.4})`;
        ctx.fillRect(0, 0, w, h);
    }
    ctx.shadowBlur = 0;
}
