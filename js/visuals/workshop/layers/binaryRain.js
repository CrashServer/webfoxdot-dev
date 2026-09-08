// ── Binary Rain ───────────────────────────────────────────────────────────────
// Columns of falling 0s and 1s (or hex digits).  Different from matrixrain:
// configurable char set, variable column speeds, wider typography options.
// Bass = spawn burst; treble = brightness surge.

const _st = new WeakMap();

function lcg(s) { return (s * 1664525 + 1013904223) & 0x7fffffff; }

const CHARSETS = [
    "01",                          // 0 = pure binary
    "0123456789ABCDEF",            // 1 = hex
    "!@#$%^&*()01binary01",       // 2 = symbol mix
    "αβγδεζηθικλμνξοπρστυφχψω",   // 3 = greek
    "⓪①②③④⑤⑥⑦⑧⑨",              // 4 = circled digits
];

export const binaryRainParams = () => ({
    cols:     { base: 40,   min: 10, max: 100, step: 5, mod: { source: "" } },
    fontSize: { base: 14,   min: 8,  max: 30,  step: 2, mod: { source: "" } },
    speed:    { base: 1.0,  min: 0.1,max: 4,            mod: { source: "" } },
    hue:      { base: 120,  min: 0,  max: 360,          mod: { source: "" } },
    hue2:     { base: 140,  min: 0,  max: 360,          mod: { source: "" } }, // tail hue
    glow:     { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    density:  { base: 0.7,  min: 0.1,max: 1,            mod: { source: "" } },
    charSet:  { base: 0,    min: 0,  max: 4,   step: 1, mod: { source: "" } },
    tailLen:  { base: 20,   min: 4,  max: 60,  step: 2, mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.92, min: 0,  max: 1,            mod: { source: "" } },
});

export function drawBinaryRain(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nCols   = Math.round(Math.max(10, Math.min(100, p.cols ?? 40)));
    const fSize   = Math.round(Math.max(8, Math.min(30, p.fontSize ?? 14)));
    const speed   = (p.speed ?? 1.0) * (1 + bass * (p.pulse ?? 0.4) * 0.5);
    const hue     = p.hue ?? 120;
    const hue2    = p.hue2 ?? 140;
    const glow    = p.glow ?? 0.6;
    const density = p.density ?? 0.7;
    const csIdx   = Math.round(Math.max(0, Math.min(4, p.charSet ?? 0)));
    const tailLen = Math.round(Math.max(4, Math.min(60, p.tailLen ?? 20)));
    const bgAlpha = p.bgAlpha ?? 0.92;
    const charset = CHARSETS[csIdx];

    const colW = w / nCols;

    let st = _st.get(ctx);
    if (!st || st.nCols !== nCols) {
        let seed = 99;
        const cols = [];
        for (let c = 0; c < nCols; c++) {
            seed = lcg(seed);
            const active = (seed / 0x7fffffff) < density;
            seed = lcg(seed);
            cols.push({
                y: active ? -(seed / 0x7fffffff) * h : h + 10,
                seed,
                active,
                spd: 0.7 + (seed / 0x7fffffff) * 0.6,
                chars: Array.from({ length: tailLen + 2 }, () => {
                    seed = lcg(seed);
                    return charset[(seed / 0x7fffffff * charset.length | 0) % charset.length];
                }),
                mutTimer: 0,
            });
        }
        st = { nCols, cols, seed };
        _st.set(ctx, st);
    }

    // Adjust col count on change
    while (st.cols.length < nCols) {
        st.seed = lcg(st.seed);
        st.cols.push({ y: -(st.seed / 0x7fffffff) * h * 0.5, seed: st.seed, active: true, spd: 0.7 + (st.seed / 0x7fffffff) * 0.6, chars: Array.from({length: tailLen+2}, () => charset[0]), mutTimer: 0 });
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${fSize}px "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let c = 0; c < Math.min(nCols, st.cols.length); c++) {
        const col = st.cols[c];
        col.y += speed * fSize * col.spd * dt * 60;
        col.mutTimer += dt;
        if (col.mutTimer > 0.05) {
            col.mutTimer = 0;
            const idx = Math.floor(Math.random() * col.chars.length);
            col.chars[idx] = charset[Math.floor(Math.random() * charset.length)];
        }

        if (col.y > h + tailLen * fSize) {
            if (Math.random() < density) {
                col.y = -fSize;
                col.spd = 0.7 + Math.random() * 0.6;
                col.active = true;
            } else {
                col.y = h + 10;
                col.active = false;
            }
        }

        if (!col.active) continue;

        const cx = (c + 0.5) * colW;
        for (let row = 0; row < tailLen; row++) {
            const gy = col.y - row * fSize;
            if (gy < -fSize || gy > h + fSize) continue;

            const frac = 1 - row / tailLen;
            if (row === 0) {
                // Head: white-hot
                ctx.shadowBlur = glow * 15 * (1 + treble * 0.4);
                ctx.shadowColor = `hsl(${hue},100%,90%)`;
                ctx.fillStyle   = `hsl(${hue},30%,${85 + treble * 15}%)`;
            } else if (row < 3) {
                ctx.shadowBlur = glow * 10;
                ctx.shadowColor = `hsl(${hue},100%,70%)`;
                ctx.fillStyle   = `hsl(${hue},90%,${65 + treble * 20}%)`;
            } else {
                ctx.shadowBlur = glow * 3;
                ctx.shadowColor = `hsl(${hue2},80%,50%)`;
                ctx.fillStyle   = `hsla(${hue2},80%,${35 + frac * 25}%,${frac * 0.9})`;
            }
            const ci = row % col.chars.length;
            ctx.fillText(col.chars[ci], cx, gy);
        }
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
