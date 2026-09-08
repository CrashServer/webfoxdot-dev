// ── Phyllotaxis ───────────────────────────────────────────────────────────────
// Golden-angle sunflower spiral — the geometry of seeds, shells, and galaxies.
// Bass blooms dots outward; mid sweeps a luminous wave; treble spins and adds
// chromatic shimmer. Palette-aware coloring ripples through the spiral arms.

const _state = new WeakMap();
const PHI = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 137.508°

class PhyllotaxisViz {
    constructor() {
        this.wave = 0;
        this.waveActive = false;
        this.bloomPulse = 0;
        this.prevBass = 0;
        this.spiralPhase = 0;
        this.chromaShift = 0;
        this.rings = [];
    }

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum, pC) {
        const cx = w / 2, cy = h / 2;
        const count   = Math.round(Math.max(50, Math.min(1200, p.count)));
        const spread  = p.spread;
        const hue     = p.hue;
        const hueRange = p.hueRange;
        const glow    = p.glow;
        const rotate  = p.rotate;
        const dotSize = p.dotSize;
        const fade    = p.fade;
        const arms    = Math.max(1, Math.round(p.arms));
        const twist   = p.twist;

        // Beat detection
        if (bass > 0.55 && bass > this.prevBass + 0.08) {
            this.bloomPulse = 1;
            if (!this.waveActive) { this.wave = 0; this.waveActive = true; }
        }
        if (bass > 0.35 && !this.waveActive) { this.wave = 0; this.waveActive = true; }
        this.prevBass = bass;
        this.bloomPulse *= 0.86;
        if (this.waveActive) { this.wave += 0.025 + mid * 0.02; if (this.wave > 1.6) this.waveActive = false; }

        // Mid drives a rolling spiral phase for arm shimmer
        this.spiralPhase += mid * 0.06 + 0.003;
        // Treble drives chromatic aberration offset
        this.chromaShift += treble * 0.04;

        ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, w, h);

        const maxR   = Math.min(cx, cy) * 0.93;
        const rotOff = t * rotate * 0.25;
        // Bass jitters the golden angle — spiral breathes and restructures
        const angleJitter = bass * 0.12 + this.bloomPulse * 0.06;
        const bloomScale  = 1 + this.bloomPulse * p.bloomStrength;

        for (let i = 0; i < count; i++) {
            const frac  = i / count;
            const angle = i * (PHI + angleJitter * (1 - frac * 0.7)) + rotOff + twist * frac * Math.PI * 2;
            const r     = Math.sqrt(frac) * maxR * bloomScale;
            // Arm modulation — spread into N arms on beat
            const armPhase = arms > 1 ? Math.round(angle / (Math.PI * 2 / arms)) * (Math.PI * 2 / arms) : 0;
            const ax = cx + Math.cos(angle + armPhase * 0.05) * r;
            const ay = cy + Math.sin(angle + armPhase * 0.05) * r;

            // Wave front passing through
            const waveFront = this.waveActive ? Math.max(0, 1 - Math.abs(frac - this.wave) * 8) : 0;
            // Treble shimmer on outer dots
            const shimmer = treble * 0.4 * (frac > 0.6 ? (frac - 0.6) / 0.4 : 0);
            // Spectrum bin drives per-dot brightness (maps dot index to bin)
            const binVal  = spectrum ? (spectrum[Math.floor(frac * 80)] ?? 0) : 0;

            const sz = dotSize * (0.4 + bass * 0.8 + waveFront * 2.5 + shimmer + this.bloomPulse * 0.6 + binVal * 0.4) * (1 - frac * 0.35);

            // Color: palette-aware or hue sweep
            let dotHue;
            if (pC) {
                // Map dot radial position (frac = sqrt(i/count)) to palette
                ctx.fillStyle = pC(frac);
            } else {
                dotHue = (hue + frac * hueRange + waveFront * 130 + this.spiralPhase * 20 + this.bloomPulse * 50 + i * 0.1) % 360;
                const lum = 50 + waveFront * 35 + bass * 15 + this.bloomPulse * 20 + shimmer * 20;
                ctx.fillStyle = `hsla(${dotHue},${80 + bass * 15}%,${lum}%,${0.75 + waveFront * 0.25})`;
            }

            if (glow > 0.1 && (waveFront > 0.1 || this.bloomPulse > 0.1 || bass > 0.3)) {
                ctx.shadowBlur = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            const r2 = Math.max(0.4, sz * 0.55);
            ctx.beginPath(); ctx.arc(ax, ay, r2, 0, 6.2832); ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Central bloom glow on beat
        if (this.bloomPulse > 0.2) {
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.4 * this.bloomPulse);
            const bh = (hue + 30) % 360;
            grad.addColorStop(0, `hsla(${bh},100%,80%,${this.bloomPulse * 0.25})`);
            grad.addColorStop(1, `hsla(${bh},100%,50%,0)`);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const phyllotaxisParams = () => ({
    count:        { base: 400,  min: 50,   max: 1200, mod: { source: "" } },
    spread:       { base: 1,    min: 0.3,  max: 3,    mod: { source: "" } },
    dotSize:      { base: 6,    min: 1,    max: 20,   mod: { source: "" } },
    rotate:       { base: 0.3,  min: -4,   max: 4,    mod: { source: "" } },
    twist:        { base: 0,    min: -3,   max: 3,    mod: { source: "" } },
    arms:         { base: 1,    min: 1,    max: 8,    mod: { source: "" } },
    hue:          { base: 140,  min: 0,    max: 360,  mod: { source: "" } },
    hueRange:     { base: 80,   min: 0,    max: 360,  mod: { source: "" } },
    bloomStrength:{ base: 0.3,  min: 0,    max: 1.5,  mod: { source: "" } },
    glow:         { base: 1.2,  min: 0,    max: 4,    mod: { source: "" } },
    fade:         { base: 0.12, min: 0.02, max: 0.7,  mod: { source: "" } },
    usePalette:   { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
});

export function drawPhyllotaxis(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new PhyllotaxisViz(); _state.set(ctx, viz); }
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    const sp  = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble, sp, _pal ? pC : null);
}
