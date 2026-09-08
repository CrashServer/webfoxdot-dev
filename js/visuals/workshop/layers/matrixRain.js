// ── Matrix Rain ───────────────────────────────────────────────────────────────
// Falling columns of characters: katakana, binary, hex, or ASCII symbols.
// Audio-reactive: bass boosts fall speed, treble drives character mutation rate.

const CHARSETS = [
    [...'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'],
    [...'01'],
    [...'0123456789ABCDEF'],
    [...'!@#$%^&*()_+{}[]|;<>?/~`abcdefghijklmnopqrstuvwxyz0123456789'],
];

const _st = new WeakMap();

export const matrixRainParams = () => ({
    fontSize:  { base: 16,  min: 8,   max: 32,  step: 2,  mod: { source: "" } },
    speed:     { base: 0.5, min: 0.05,max: 3,            mod: { source: "" } },
    hue:       { base: 120, min: 0,   max: 360,           mod: { source: "" } },
    density:   { base: 0.7, min: 0.1, max: 1,             mod: { source: "" } },
    fade:      { base: 0.06,min: 0.01,max: 0.4,           mod: { source: "" } },
    charset:   { base: 0,   min: 0,   max: 3,   step: 1,  mod: { source: "" } },
    glow:      { base: 0.5, min: 0,   max: 1,             mod: { source: "" } },
    trailLen:  { base: 6,   min: 1,   max: 20,  step: 1,  mod: { source: "" } },
});

export function drawMatrixRain(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*3) : 0;

    const fs      = Math.max(8, Math.round(p.fontSize ?? 16));
    const speed   = (p.speed ?? 0.5) * (1 + bass * 1.5);
    const hue     = p.hue ?? 120;
    const density = p.density ?? 0.7;
    const fade    = p.fade ?? 0.06;
    const charset = CHARSETS[Math.max(0, Math.min(3, Math.round(p.charset ?? 0)))];
    const glow    = p.glow ?? 0.5;
    const trail   = Math.max(1, Math.round(p.trailLen ?? 6));
    const cols    = Math.ceil(w / fs);

    let st = _st.get(ctx);
    if (!st || st.cols !== cols || st.fs !== fs) {
        st = {
            cols, fs,
            y:      new Float32Array(cols).map(() => -(Math.random() * h * 1.5)),
            chars:  Array.from({ length: cols }, () => Array.from({ length: trail + 2 }, () => charset[Math.floor(Math.random() * charset.length)])),
            active: Array.from({ length: cols }, () => Math.random() < density),
        };
        _st.set(ctx, st);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = `rgba(0,0,0,${fade + treble * 0.05})`;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let c = 0; c < cols; c++) {
        if (!st.active[c]) {
            if (Math.random() < 0.003 * density) { st.active[c] = true; st.y[c] = -fs; }
            continue;
        }

        const x = c * fs + fs * 0.5;
        const yHead = st.y[c];

        // Mutate chars occasionally (treble boosts mutation)
        if (Math.random() < 0.08 + treble * 0.25) {
            st.chars[c][0] = charset[Math.floor(Math.random() * charset.length)];
        }

        // Draw trail: dimmer characters above the head
        for (let tr = trail; tr >= 1; tr--) {
            const ty = yHead - tr * fs;
            if (ty < -fs || ty > h) continue;
            const alpha = (1 - tr / trail) * 0.7;
            const light = 25 + (1 - tr / trail) * 30;
            ctx.fillStyle = `hsla(${hue},85%,${light}%,${alpha})`;
            if (Math.random() < 0.04 + treble * 0.08) {
                st.chars[c][tr] = charset[Math.floor(Math.random() * charset.length)];
            }
            ctx.fillText(st.chars[c][tr % st.chars[c].length], x, ty);
        }

        // Lead character: bright white/near-white with glow
        if (yHead >= -fs && yHead <= h) {
            if (glow > 0.01) { ctx.shadowBlur = glow * 14; ctx.shadowColor = `hsl(${hue},100%,80%)`; }
            ctx.fillStyle = `hsl(${hue},60%,96%)`;
            ctx.fillText(st.chars[c][0], x, yHead);
            ctx.shadowBlur = 0;
        }

        st.y[c] += fs * speed / 8;

        if (st.y[c] > h + fs * (trail + 2)) {
            st.active[c] = Math.random() < density;
            st.y[c] = -fs * (1 + Math.random() * 4);
        }
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
}
