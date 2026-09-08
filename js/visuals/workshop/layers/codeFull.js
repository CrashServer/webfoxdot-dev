// ── Code Full Width ──────────────────────────────────────────────────────────
// Ported from web/src/layers/codeFull.js. Scrolling code fills the whole
// canvas; font size is measured each frame so the longest visible line never
// clips. Live FoxDot/webTroop code (extra.live) is injected on each eval.
// Nothing is shown until the first eval. Semi-transparent bg keeps light trails.

const _st = new WeakMap();

export const codeFullParams = () => ({
    scroll:    { base: 1,   min: 0,   max: 5,           label: "scroll speed", mod: { source: "" } },
    hue:       { base: 140, min: 0,   max: 360, step: 1, label: "text hue", mod: { source: "" } },
    audioReact:{ base: 1,   min: 0,   max: 3,           label: "audio reactivity", mod: { source: "" } },
});

// hue (deg) → [r,g,b] in 0..1 at full sat, mid-high lightness (matches the
// web layer's green-ish tint by default at hue 140).
function hueRGB(hDeg) {
    const hN = (((hDeg % 360) + 360) % 360) / 60;
    const C = 0.85, X = C * (1 - Math.abs(hN % 2 - 1)), m = 0.15;
    let r = 0, g = 0, b = 0;
    if (hN < 1) { r = C; g = X; }
    else if (hN < 2) { r = X; g = C; }
    else if (hN < 3) { g = C; b = X; }
    else if (hN < 4) { g = X; b = C; }
    else if (hN < 5) { r = X; b = C; }
    else { r = C; b = X; }
    return [r + m, g + m, b + m];
}

export function drawCodeFull(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { lines: [], lastEval: -1, lastBeat: -1, flash: 0, scrollY: 0, lastT: null }; _st.set(ctx, s); }

    const dt = s.lastT == null ? 1 / 60 : Math.max(0, Math.min(0.1, t - s.lastT));
    s.lastT = t;

    const lv = extra?.live || {};
    const spectrum = extra?.spectrum;
    const bass = spectrum ? Math.min(1, (spectrum[1] + spectrum[2] + spectrum[3]) / 3 * 3) : 0;
    const audio = bass * (params.audioReact ?? 1);

    const tint = hueRGB(params.hue ?? 140);
    const speed = params.scroll ?? 1;
    const ec = lv.evalCount ?? 0;
    const beat = Math.floor(lv.beat ?? t * 2);

    if (ec !== s.lastEval && ec > 0) {
        s.lastEval = ec;
        const user = lv.lastEvalUser || "svdk";
        const win = (user === "svdk" ? lv.svdk : lv.zbdm) || {};
        const rawL = win.lines;
        const raw = rawL ? (Array.isArray(rawL) ? rawL.join("\n") : rawL) : "";
        if (raw) {
            const fresh = raw.split("\n");
            s.lines = [...fresh, `-- ↑ eval ${ec} [${user}]`, "", ...s.lines].slice(0, 120);
        }
        s.flash = 1;
    }
    if (beat !== s.lastBeat) { s.lastBeat = beat; s.flash = Math.max(s.flash, 0.4); }
    s.flash = Math.max(0, s.flash - dt * 3);

    const [tr, tg, tb] = tint;

    if (s.lines.length === 0) {
        ctx.fillStyle = "rgba(1,3,2,0.85)"; ctx.fillRect(0, 0, w, h);
        ctx.font = `${h * 0.03 | 0}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(${tr * 80 | 0},${tg * 80 | 0},${tb * 80 | 0},0.5)`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("[ awaiting eval ]", w / 2, h / 2);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        return;
    }

    // measure font size to fit longest visible line without clipping
    const sample = s.lines.slice(0, 40);
    const longest = sample.reduce((a, l) => l.length > a.length ? l : a, "");
    let fs = Math.min(h * 0.045, 48);
    ctx.font = `${fs | 0}px 'Courier New',monospace`;
    while (fs > 8 && ctx.measureText(longest).width > w * 0.97) {
        fs -= 1; ctx.font = `${fs | 0}px 'Courier New',monospace`;
    }
    const lh = fs * 1.35;
    const maxVis = Math.ceil(h / lh) + 2;

    s.scrollY += dt * speed * lh * 0.3 * (1 + audio * 2);
    if (s.scrollY > lh) { s.scrollY -= lh; s.lines.push(s.lines.shift()); }

    ctx.fillStyle = "rgba(1,3,2,0.85)"; ctx.fillRect(0, 0, w, h);

    ctx.textAlign = "left"; ctx.textBaseline = "top";
    for (let i = 0; i < Math.min(maxVis, s.lines.length); i++) {
        const line = s.lines[i];
        const y = i * lh - s.scrollY;
        const isComment = line.trimStart().startsWith("--") || line.trimStart().startsWith("#");
        const isBeat = i === 0 && s.flash > 0.3;
        const alpha = isComment ? 0.45 : 0.88;
        const glow = isBeat ? s.flash * 0.8 + audio * 0.4 : audio * 0.15;
        ctx.shadowColor = `rgb(${tr * 255 | 0},${tg * 255 | 0},${tb * 255 | 0})`;
        ctx.shadowBlur = (isComment ? 2 : 6) + glow * 16;
        ctx.fillStyle = isComment
            ? `rgba(${tr * 140 | 0},${tg * 140 | 0},${tb * 140 | 0},${alpha})`
            : `rgba(${tr * 255 | 0},${tg * 255 | 0},${tb * 255 | 0},${alpha})`;
        ctx.fillText(line, w * 0.01, y);
    }
    ctx.shadowBlur = 0;

    if (s.flash > 0.1) {
        ctx.fillStyle = `rgba(${tr * 255 | 0},${tg * 255 | 0},${tb * 255 | 0},${s.flash * 0.9})`;
        ctx.fillRect(w * 0.01, -s.scrollY + fs * 0.1, fs * 0.55, fs * 0.85);
    }
    ctx.fillStyle = "rgba(0,0,0,0.1)"; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.textBaseline = "alphabetic";
}
