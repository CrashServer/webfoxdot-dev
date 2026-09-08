// ── Neon Sign ─────────────────────────────────────────────────────────────────
// Big neon tube letters with realistic flickering, glow blooms and buzz.
// Bass pulses the brightness; treble brightens the secondary color.
// Five preset words + custom (set via text param encoded as char codes).

const _st = new WeakMap();
const TAU = Math.PI * 2;

const PRESETS = ["LIVE", "VIBE", "BASS", "STARS", "OPEN"];

export const neonSignParams = () => ({
    word:     { base: 0,    min: 0,   max: 4,   step: 1,  mod: { source: "" } }, // preset index
    hue:      { base: 320,  min: 0,   max: 360,           mod: { source: "" } },
    hue2:     { base: 180,  min: 0,   max: 360,           mod: { source: "" } }, // accent / secondary tube
    scale:    { base: 1.0,  min: 0.2, max: 2,             mod: { source: "" } },
    flicker:  { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 8,    min: 2,   max: 24,  step: 1,  mod: { source: "" } },
    glow:     { base: 0.8,  min: 0,   max: 1,             mod: { source: "" } },
    outline:  { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } }, // dark backing tube
    bgAlpha:  { base: 0.85, min: 0,   max: 1,             mod: { source: "" } },
    speed:    { base: 0.3,  min: 0,   max: 3,             mod: { source: "" } }, // flicker rate
});

export function drawNeonSign(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const wordIdx = Math.round(Math.max(0, Math.min(PRESETS.length - 1, p.word ?? 0)));
    const customWord = extra?.message && extra.message !== "VJ WORKSHOP" ? extra.message.toUpperCase() : "";
    const word    = customWord || PRESETS[wordIdx];
    const hue     = p.hue ?? 320;
    const hue2    = p.hue2 ?? 180;
    const scale   = p.scale ?? 1.0;
    const flicker = p.flicker ?? 0.3;
    const pulse   = p.pulse ?? 0.5;
    const thick   = p.thick ?? 8;
    const glow    = p.glow ?? 0.8;
    const outline = p.outline ?? 0.4;
    const bgAlpha = p.bgAlpha ?? 0.85;
    const speed   = p.speed ?? 0.3;

    let st = _st.get(ctx);
    if (!st) { st = { flickerVal: 1, lcg: 9999, charFlicker: [] }; _st.set(ctx, st); }

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };

    // Per-character flicker (slow random)
    if (!st.charFlicker.length || st.charFlicker.length !== word.length) {
        st.charFlicker = Array.from({ length: word.length }, () => ({ v: 1, next: 0 }));
    }
    for (let i = 0; i < word.length; i++) {
        const cf = st.charFlicker[i];
        if (t > cf.next) {
            cf.v = rand() < flicker * 0.4 ? 0.05 + rand() * 0.3 : 0.85 + rand() * 0.15;
            cf.next = t + 0.05 + rand() * 0.3 / speed;
        }
    }

    // Global flicker driven by noise
    const flk = 1 - flicker * 0.15 * (0.5 + 0.5 * Math.sin(t * speed * 23.1));

    const beatBright = 1 + bass * pulse * 0.4;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Font size from scale
    const fontSize = Math.round(Math.min(w / word.length * 1.2, h * 0.55) * scale);
    ctx.font = `bold ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const totalW = ctx.measureText(word).width;
    const charWidths = Array.from(word).map(c => ctx.measureText(c).width);
    let cx = (w - totalW) / 2;
    const cy = h / 2;

    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        const cw = charWidths[i];
        const x  = cx + cw / 2;
        cx += cw;
        const cf = st.charFlicker[i].v * flk * beatBright;
        const useHue = (i % 2 === 0) ? hue : hue2;
        const a2 = Math.min(1, cf);

        // Dark backing outline tube
        if (outline > 0.05) {
            ctx.strokeStyle = `rgba(20,5,30,${outline})`;
            ctx.lineWidth = thick + 6;
            ctx.lineJoin = "round";
            ctx.strokeText(ch, x, cy);
        }

        // Outer glow bloom
        if (glow > 0.05) {
            const glowSz = glow * thick * 4 * (1 + treble * 0.3) * cf;
            ctx.shadowBlur = glowSz;
            ctx.shadowColor = `hsl(${useHue},100%,60%)`;
            ctx.strokeStyle = `hsla(${useHue},100%,75%,${a2 * 0.4})`;
            ctx.lineWidth = thick * 2;
            ctx.strokeText(ch, x, cy);
        }

        // Inner tube — bright core
        ctx.shadowBlur = glow * 8 * cf;
        ctx.shadowColor = `hsl(${useHue},100%,90%)`;
        ctx.strokeStyle = `hsla(${useHue},100%,85%,${a2})`;
        ctx.lineWidth = thick * 0.6;
        ctx.strokeText(ch, x, cy);

        // White hotspot centre
        ctx.shadowBlur = glow * 4 * cf;
        ctx.strokeStyle = `rgba(255,255,255,${a2 * 0.7 * cf})`;
        ctx.lineWidth = thick * 0.15;
        ctx.strokeText(ch, x, cy);
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
