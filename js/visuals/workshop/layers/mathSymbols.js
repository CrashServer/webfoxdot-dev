// ── Math Symbols ──────────────────────────────────────────────────────────────
// Floating particles of mathematical / Greek / physics notation.
// Bass spawns new symbols; treble brightens and spins them.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const POOLS = [
    // 0 — Greek / math
    "αβγδεζηθικλμνξπρσστυφχψωΓΔΘΛΞΠΣΦΨΩ∞∫∑∏∂∇√±≈≠≡∈∅",
    // 1 — Physics / QM
    "ℏħℓℵ∇²ψ|ket⟩⟨bra|Â†Ĥρ̂⟨ψ|Ĥ|ψ⟩ΔxΔpℏE=mc²F=maS=kBln(Ω)",
    // 2 — Numbers / binary / hex
    "0123456789ABCDEFπeφγ½⅓¼⅛∛∜₀₁₂₃⁰¹²³⁴⁵",
    // 3 — Set theory / logic
    "∀∃∄∈∉⊂⊃⊆⊇∩∪∅⊕⊗¬∧∨→↔↦⊢⊨⊥⊤",
    // 4 — Arrows / operators
    "→←↑↓↔↕⇒⇐⇔⊕⊗×÷∘∙⊙⊠⋅∧∨∫∮∯∰∱",
];

export const mathSymbolsParams = () => ({
    pool:      { base: 0,    min: 0,  max: 4,   step: 1, mod: { source: "" } },
    maxParts:  { base: 80,   min: 10, max: 200, step:10, mod: { source: "" } },
    fontSize:  { base: 28,   min: 10, max: 72,  step: 2, mod: { source: "" } },
    fontRange: { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } }, // size variation
    drift:     { base: 0.3,  min: 0,  max: 2,            mod: { source: "" } }, // drift speed
    spin:      { base: 0.3,  min: 0,  max: 3,            mod: { source: "" } },
    hue:       { base: 60,   min: 0,  max: 360,          mod: { source: "" } },
    hueRange:  { base: 200,  min: 0,  max: 360,          mod: { source: "" } },
    glow:      { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    pulse:     { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:   { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } },
    lifetime:  { base: 5,    min: 1,  max: 20,           mod: { source: "" } },
});

export function drawMathSymbols(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const poolIdx = Math.round(Math.max(0, Math.min(4, p.pool ?? 0)));
    const maxParts= Math.round(Math.max(10, Math.min(200, p.maxParts ?? 80)));
    const fsize   = Math.round(Math.max(10, Math.min(72, p.fontSize ?? 28)));
    const fRange  = p.fontRange ?? 0.6;
    const drift   = p.drift ?? 0.3;
    const spin    = p.spin ?? 0.3;
    const hue     = ((p.hue ?? 60) + treble * 60) % 360;
    const hueR    = p.hueRange ?? 200;
    const glow    = p.glow ?? 0.6;
    const pulse   = p.pulse ?? 0.5;
    const bgAlpha = p.bgAlpha ?? 0;
    const lifetime= p.lifetime ?? 5;

    const pool = [...POOLS[poolIdx]];

    let st = _st.get(ctx);
    if (!st) { st = { parts: [], prevBass: 0, lcg: 11111, lastT: t }; _st.set(ctx, st); }

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    const beatHit = bass > 0.45 && st.prevBass < 0.4;
    st.prevBass = bass;

    // Spawn
    const spawnRate = (drift + bass * pulse) * 2;
    const n = Math.ceil(spawnRate * dt * 4 + (beatHit ? 5 : 0));
    for (let i = 0; i < n && st.parts.length < maxParts; i++) {
        const sz = fsize * (1 - fRange * 0.5 + rand() * fRange);
        st.parts.push({
            x: rand() * w,
            y: rand() * h,
            vx: (rand() - 0.5) * 30 * drift,
            vy: (rand() - 0.5) * 30 * drift - 20 * drift,
            ch: pool[Math.floor(rand() * pool.length)],
            rot: rand() * TAU,
            rotV: (rand() - 0.5) * spin * 2,
            hOff: rand() * hueR,
            life: lifetime * (0.5 + rand()),
            maxLife: lifetime,
            sz,
        });
    }

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 14 * (1 + treble * 0.4);
    }

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let i = st.parts.length - 1; i >= 0; i--) {
        const q = st.parts[i];
        q.life -= dt;
        if (q.life <= 0) { st.parts.splice(i, 1); continue; }
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.rotV * dt;

        const frac = q.life / q.maxLife;
        const alpha = Math.min(1, frac * 3) * (0.5 + treble * 0.4);
        const ch2 = (hue + q.hOff) % 360;

        ctx.globalAlpha = alpha;
        ctx.shadowColor = `hsl(${ch2},100%,70%)`;
        ctx.fillStyle = `hsl(${ch2},85%,${55 + treble * 25}%)`;
        ctx.font = `${q.sz}px "Times New Roman", serif`;

        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillText(q.ch, 0, 0);
        ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}
