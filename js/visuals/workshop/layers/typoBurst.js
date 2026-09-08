// ── Typo Burst ────────────────────────────────────────────────────────────────
// Characters / words orbit outward from the centre and fade, creating an
// expanding typographic explosion.  Bass triggers bursts of new particles;
// treble shifts the colour palette.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const CHAR_POOLS = [
    // 0 — alphanumeric
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    // 1 — symbols / math
    "∞∑∏∫√∂∇∆≈≠≡±×÷∈∉∅⊂⊃⊆⊇∩∪⊕⊗⊥∥",
    // 2 — runes / occult
    "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ☽☾✦☆",
    // 3 — code / binary
    "01{}[]<>/\\;:=|&#@!?%$^~`",
    // 4 — katakana
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
];

export const typoBurstParams = () => ({
    pool:      { base: 0,    min: 0,  max: 4,   step: 1,  mod: { source: "" } }, // char pool
    maxParts:  { base: 120,  min: 20, max: 400, step: 10, mod: { source: "" } },
    burstSize: { base: 12,   min: 1,  max: 40,  step: 1,  mod: { source: "" } }, // chars per bass hit
    fontSize:  { base: 24,   min: 8,  max: 72,  step: 2,  mod: { source: "" } },
    speed:     { base: 0.6,  min: 0.1,max: 4,             mod: { source: "" } }, // radial velocity
    spin:      { base: 0.5,  min: -4, max: 4,             mod: { source: "" } }, // char rotation speed
    hue:       { base: 280,  min: 0,  max: 360,           mod: { source: "" } },
    hueRange:  { base: 120,  min: 0,  max: 360,           mod: { source: "" } },
    glow:      { base: 0.5,  min: 0,  max: 1,             mod: { source: "" } },
    pulse:     { base: 0.6,  min: 0,  max: 1,             mod: { source: "" } },
    bgAlpha:   { base: 0.0,  min: 0,  max: 1,             mod: { source: "" } },
    decay:     { base: 1.5,  min: 0.2,max: 5,             mod: { source: "" } }, // lifetime seconds
});

export function drawTypoBurst(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const poolIdx  = Math.round(Math.max(0, Math.min(4, p.pool ?? 0)));
    const maxParts = Math.round(Math.max(20, Math.min(400, p.maxParts ?? 120)));
    const burstN   = Math.round(Math.max(1, Math.min(40, p.burstSize ?? 12)));
    const fsize    = Math.round(Math.max(8, Math.min(72, p.fontSize ?? 24)));
    const speed    = (p.speed ?? 0.6) * (1 + bass * (p.pulse ?? 0.6) * 0.5);
    const spin     = p.spin ?? 0.5;
    const hue      = ((p.hue ?? 280) + treble * 60) % 360;
    const hueR     = p.hueRange ?? 120;
    const glow     = p.glow ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0;
    const decay    = p.decay ?? 1.5;

    const pool = CHAR_POOLS[poolIdx];

    let st = _st.get(ctx);
    if (!st) { st = { parts: [], prevBass: 0, lcg: 54321, lastT: t }; _st.set(ctx, st); }

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    const cx = w / 2, cy = h / 2;

    // Spawn on bass hit
    const beatHit = bass > 0.4 && st.prevBass < 0.35;
    st.prevBass = bass;
    if (beatHit || (bass > 0.7 && st.parts.length < maxParts * 0.5)) {
        const n = Math.ceil(burstN * (beatHit ? 1 : 0.3));
        for (let i = 0; i < n && st.parts.length < maxParts; i++) {
            const angle = rand() * TAU;
            const ch = pool[Math.floor(rand() * pool.length)];
            st.parts.push({
                x: cx + (rand() - 0.5) * fsize * 2,
                y: cy + (rand() - 0.5) * fsize * 2,
                vx: Math.cos(angle) * (60 + rand() * 120) * speed,
                vy: Math.sin(angle) * (60 + rand() * 120) * speed,
                ch,
                rot: rand() * TAU,
                rotV: (rand() - 0.5) * spin * 3,
                hOff: rand() * hueR,
                life: decay,
                maxLife: decay,
                sz: fsize * (0.5 + rand() * 1.0),
            });
        }
    }

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12;
    }

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let i = st.parts.length - 1; i >= 0; i--) {
        const q = st.parts[i];
        q.life -= dt;
        if (q.life <= 0) { st.parts.splice(i, 1); continue; }

        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 20 * dt; // slight gravity
        q.rot += q.rotV * dt;

        const frac = q.life / q.maxLife;
        const alpha = frac * (0.5 + treble * 0.4);
        const ch2 = (hue + q.hOff) % 360;
        const bright = 60 + (1 - frac) * 30;

        ctx.globalAlpha = alpha;
        ctx.shadowColor = `hsl(${ch2},100%,70%)`;
        ctx.fillStyle = `hsl(${ch2},80%,${bright}%)`;
        ctx.font = `bold ${q.sz}px monospace`;

        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillText(q.ch, 0, 0);
        ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}
