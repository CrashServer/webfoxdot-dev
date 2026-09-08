// ── Rune Circle ───────────────────────────────────────────────────────────────
// Concentric rings of Elder Futhark / occult sigil characters rotating at
// different speeds.  Bass pulses the outer ring; treble brightens the glow.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Unicode Elder Futhark + misc occult symbols
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ☽☾✦✧⊕⊗∞⍟⎔△▽◇◯⬡☆✺⌘⊛⋆❋☸⚡☯⚕✦";
const RUNE_ARR = [...RUNES];

function ringRunes(n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(RUNE_ARR[Math.floor(Math.random() * RUNE_ARR.length)]);
    return arr;
}

export const runeCircleParams = () => ({
    rings:     { base: 4,    min: 1,  max: 7,   step: 1,  mod: { source: "" } },
    hue:       { base: 270,  min: 0,  max: 360,           mod: { source: "" } },
    hueRange:  { base: 90,   min: 0,  max: 180,           mod: { source: "" } },
    speed:     { base: 0.1,  min: -2, max: 2,             mod: { source: "" } },
    fontSize:  { base: 20,   min: 8,  max: 48,  step: 1,  mod: { source: "" } },
    glow:      { base: 0.7,  min: 0,  max: 1,             mod: { source: "" } },
    pulse:     { base: 0.4,  min: 0,  max: 1,             mod: { source: "" } },
    outerR:    { base: 0.42, min: 0.1,max: 0.5,           mod: { source: "" } },
    bgAlpha:   { base: 0.0,  min: 0,  max: 1,             mod: { source: "" } },
    sat:       { base: 80,   min: 0,  max: 100,           mod: { source: "" } },
});

export function drawRuneCircle(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const rings   = Math.round(Math.max(1, Math.min(7, p.rings ?? 4)));
    const hue     = p.hue ?? 270;
    const hueR    = p.hueRange ?? 90;
    const speed   = p.speed ?? 0.1;
    const fsize   = Math.round(Math.max(8, Math.min(48, p.fontSize ?? 20)));
    const glow    = p.glow ?? 0.7;
    const pulse   = p.pulse ?? 0.4;
    const outerR  = (p.outerR ?? 0.42) * Math.min(w, h);
    const bgAlpha = p.bgAlpha ?? 0;
    const sat     = p.sat ?? 80;

    let st = _st.get(ctx);
    if (!st) {
        st = { rot: [], runeRings: [], lastRings: -1, lastT: t };
        _st.set(ctx, st);
    }

    if (st.lastRings !== rings) {
        st.lastRings = rings;
        st.rot = Array.from({ length: rings }, () => 0);
        st.runeRings = Array.from({ length: rings }, (_, i) => {
            const n = 8 + i * 4;
            return ringRunes(n);
        });
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    for (let r = 0; r < rings; r++) {
        const dir = r % 2 === 0 ? 1 : -1;
        st.rot[r] += dir * speed * dt * (0.5 + r * 0.15) * (1 + bass * pulse * 0.5);
    }

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.font = `${fsize}px serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let r = 0; r < rings; r++) {
        const frac = (r + 1) / rings;
        const radius = outerR * frac * (r === rings - 1 ? 1 + bass * pulse * 0.1 : 1);
        const runes = st.runeRings[r];
        const n = runes.length;
        const rHue = (hue + r * hueR / rings) % 360;
        const bright = 55 + treble * 25;

        if (glow > 0.05) {
            ctx.shadowBlur = glow * 15 * (1 + (r === rings - 1 ? bass * 0.5 : 0));
            ctx.shadowColor = `hsl(${rHue},100%,70%)`;
        }
        ctx.fillStyle = `hsl(${rHue},${sat}%,${bright}%)`;

        for (let i = 0; i < n; i++) {
            const angle = st.rot[r] + i * TAU / n;
            ctx.save();
            ctx.rotate(angle);
            ctx.translate(0, -radius);
            ctx.rotate(-angle); // keep upright
            ctx.fillText(runes[i], 0, 0);
            ctx.restore();
        }

        // Ring circle
        ctx.shadowBlur = glow * 8;
        ctx.strokeStyle = `hsla(${rHue},${sat}%,40%,0.3)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TAU);
        ctx.stroke();
    }

    // Centre symbol
    ctx.shadowBlur = glow * 25 * (1 + bass * 0.5);
    ctx.shadowColor = `hsl(${hue},100%,80%)`;
    ctx.fillStyle = `hsl(${hue},90%,80%)`;
    const csz = fsize * 2;
    ctx.font = `${csz}px serif`;
    ctx.fillText("⊕", 0, 0);

    ctx.shadowBlur = 0;
    ctx.restore();
}
