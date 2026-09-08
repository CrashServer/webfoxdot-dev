// ── Glitch Word ───────────────────────────────────────────────────────────────
// A single word that morphs, scrambles and re-forms in sync with audio.
// Bass triggers a full scramble burst; treble shifts the palette.

const _st = new WeakMap();

const WORDS = ["BASS","LIVE","VIBE","SYNC","BEAT","VOID","FLUX","ECHO","RAVE","DEEP",
               "PULSE","NOISE","WAVE","GRID","NEON","DARK","HYPR","CODE","HACK","FREQ"];
const GLITCH = "!@#$%^&*<>[]{}|~±×÷∞≈∑∏∂∇αβγδ01";

export const glitchWordParams = () => ({
    word:      { base: 0,    min: 0,  max: 19,  step: 1, mod: { source: "" } },
    hue:       { base: 300,  min: 0,  max: 360,          mod: { source: "" } },
    hue2:      { base: 60,   min: 0,  max: 360,          mod: { source: "" } }, // glitch char color
    scale:     { base: 1.0,  min: 0.2,max: 2,            mod: { source: "" } },
    glitchRate:{ base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    glitchAmt: { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } }, // fraction of chars that glitch
    pulse:     { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    glow:      { base: 0.8,  min: 0,  max: 1,            mod: { source: "" } },
    splitH:    { base: 0.3,  min: 0,  max: 1,            mod: { source: "" } }, // horizontal RGB split on glitch
    bgAlpha:   { base: 0.85, min: 0,  max: 1,            mod: { source: "" } },
    speed:     { base: 1.0,  min: 0,  max: 4,            mod: { source: "" } }, // morph speed
});

export function drawGlitchWord(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const wordIdx  = Math.round(Math.max(0, Math.min(19, p.word ?? 0)));
    const word     = WORDS[wordIdx];
    const hue      = ((p.hue ?? 300) + treble * 60) % 360;
    const hue2     = p.hue2 ?? 60;
    const scale    = (p.scale ?? 1.0) * (1 + bass * (p.pulse ?? 0.6) * 0.15);
    const gRate    = (p.glitchRate ?? 0.4) + bass * 0.3;
    const gAmt     = (p.glitchAmt ?? 0.5) + bass * (p.pulse ?? 0.6) * 0.3;
    const glow     = p.glow ?? 0.8;
    const splitH   = (p.splitH ?? 0.3) + bass * 0.2;
    const bgAlpha  = p.bgAlpha ?? 0.85;
    const speed    = p.speed ?? 1.0;

    let st = _st.get(ctx);
    if (!st) { st = { chars: [...word], nextGlitch: 0, lcg: 9876, prevBass: 0 }; _st.set(ctx, st); }

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };

    // Update chars
    const beatHit = bass > 0.55 && st.prevBass < 0.5;
    st.prevBass = bass;

    if (t > st.nextGlitch || beatHit) {
        const n = beatHit
            ? Math.ceil(word.length * gAmt)
            : Math.ceil(rand() < gRate ? rand() * word.length * gAmt + 1 : 0);
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(rand() * word.length);
            if (rand() < 0.3) {
                // Recover to original
                st.chars[idx] = word[idx];
            } else {
                st.chars[idx] = GLITCH[Math.floor(rand() * GLITCH.length)];
            }
        }
        st.nextGlitch = t + 0.03 + rand() * 0.1 / speed;
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const fsize = Math.min(w / word.length * 1.1, h * 0.65) * scale;
    ctx.font = `bold ${fsize}px "Arial Black", Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const cx = w / 2, cy = h / 2;

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 25 * (1 + bass * 0.4);
    }

    // RGB split: draw R, G, B channels shifted
    if (splitH > 0.05 && bass > 0.2) {
        const shift = splitH * 12 * bass;
        ['rgba(255,0,0,0.6)', 'rgba(0,255,0,0.4)', 'rgba(0,100,255,0.6)'].forEach((col, ci) => {
            const dx = (ci - 1) * shift;
            ctx.fillStyle = col;
            ctx.shadowColor = col;
            ctx.shadowBlur = glow * 15;
            st.chars.forEach((ch, i) => {
                const x = cx + (i - word.length / 2 + 0.5) * fsize * 0.72;
                ctx.fillText(ch, x + dx, cy);
            });
        });
    } else {
        // Normal render
        st.chars.forEach((ch, i) => {
            const isOrig = ch === word[i];
            const chHue = isOrig ? hue : hue2;
            const bright = isOrig ? 70 + treble * 20 : 80 + bass * 20;
            ctx.fillStyle = `hsl(${chHue},90%,${bright}%)`;
            ctx.shadowColor = `hsl(${chHue},100%,70%)`;
            ctx.shadowBlur = glow * (isOrig ? 20 : 30) * (1 + bass * 0.3);
            const x = cx + (i - word.length / 2 + 0.5) * fsize * 0.72;
            ctx.fillText(ch, x, cy);
        });
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
