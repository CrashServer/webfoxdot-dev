// ── Hypnoscope ────────────────────────────────────────────────────────────────
// Spinning optical illusion: concentric rings zoom inward creating an infinite
// tunnel. Each ring has a distinct frequency, color, and rotation rate.
// Bass inverts zoom direction (punch-out); mid creates interference moiré between
// ring frequencies; treble adds radial spokes and chromatic separation.

const _state = new WeakMap();

class HypnoscopeViz {
    constructor() {
        this.zoomPhase = 0;
        this.invertTimer = 0;
        this.pulse = 0;
        this.prevBass = 0;
        this.midPhase = 0;
        this.spokePhase = 0;
        this.rotAccum = 0; this.lastT = 0;}

    frame(ctx, w, h, p, t, bass, mid, treble) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        const cx    = w / 2, cy = h / 2;
        const rings = Math.round(Math.max(4, Math.min(48, p.rings)));
        const hue   = p.hue;
        const hueRange = p.hueRange;
        const speed = p.speed;
        const twist = p.twist;
        const glow  = p.glow;
        const fade  = p.fade;
        const spokes = Math.round(Math.max(0, Math.min(24, p.spokes)));
        const moireFreq = p.moireFreq;
        const chromSep = p.chromSep;

        // Beat detection — invert on kick
        if (bass > 0.55 && bass > this.prevBass + 0.08) {
            this.pulse = 1;
            this.invertTimer = 0.6;
        }
        this.prevBass = bass;
        this.pulse *= 0.86;
        if (this.invertTimer > 0) this.invertTimer -= dt;
        const invert = this.invertTimer > 0 ? -1 : 1;

        // Mid drives interference phase between alternating rings
        this.midPhase += mid * 0.05 + 0.005;
        // Treble spins the spoke wheel faster
        this.spokePhase += treble * 0.12 + speed * 0.015;

        this.zoomPhase = (this.zoomPhase + speed * 0.007 * invert * (1 + treble * 0.6)) % 1;
        this.rotAccum  += speed * 0.004;

        ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, w, h);

        const maxR = Math.sqrt(cx*cx + cy*cy) * 1.08;
        const tightness = 1 + bass * 0.5;

        // Draw radial spokes — treble activates
        if (spokes > 0 && treble > 0.05) {
            const spokeAlpha = treble * 0.35 + this.pulse * 0.15;
            for (let s = 0; s < spokes; s++) {
                const angle = (s / spokes) * Math.PI * 2 + this.spokePhase;
                const sh    = (hue + s * (360/spokes) + bass * 60) % 360;
                ctx.strokeStyle = `hsla(${sh},80%,60%,${spokeAlpha})`;
                ctx.lineWidth   = 1 + treble * 2;
                if (glow > 0.1) {ctx.shadowBlur = 0; }
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        // Main rings
        for (let i = 0; i < rings; i++) {
            const frac  = ((i / rings) + this.zoomPhase) % 1;
            const r     = Math.pow(frac, tightness) * maxR;

            // Moiré interference: alternating rings beat against each other
            const moireOffset = Math.sin(frac * Math.PI * 2 * moireFreq + this.midPhase) * mid * 0.08;
            const rM = r * (1 + moireOffset);

            const rot = this.rotAccum * (0.3 + i * 0.015 * Math.abs(twist)) * invert;
            const ringHue = (hue + frac * hueRange + bass * 60 + this.pulse * 50) % 360;
            const alpha   = 0.4 + Math.sin(frac * Math.PI) * 0.45 + this.pulse * 0.15;
            const lw      = Math.max(1, (maxR / rings) * 0.65 * (0.35 + bass * 0.65 + this.pulse * 0.3));

            const ovalRatio = 1 + Math.sin(rot * 2 + t * 0.3) * 0.05 * Math.abs(twist);

            if (glow > 0.1) {
                ctx.shadowBlur = 0;
            }

            // Chromatic separation: draw R, G, B offset rings for treble
            if (chromSep > 0.01 && treble > 0.1) {
                const cOff = chromSep * treble * rM * 0.03;
                ctx.globalAlpha = alpha * 0.5;
                // Red channel shifted right
                ctx.strokeStyle = `rgba(255,0,0,0.6)`;
                ctx.lineWidth   = lw * 0.7;
                ctx.beginPath();
                ctx.ellipse(cx + cOff, cy, Math.max(0.5, rM * ovalRatio), Math.max(0.5, rM / ovalRatio), rot * 0.06, 0, Math.PI * 2);
                ctx.stroke();
                // Cyan (G+B) shifted left
                ctx.strokeStyle = `rgba(0,255,255,0.6)`;
                ctx.beginPath();
                ctx.ellipse(cx - cOff, cy, Math.max(0.5, rM * ovalRatio), Math.max(0.5, rM / ovalRatio), rot * 0.06, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            ctx.strokeStyle = `hsla(${ringHue},85%,58%,${alpha})`;
            ctx.lineWidth   = lw;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(0.5, rM * ovalRatio), Math.max(0.5, rM / ovalRatio), rot * 0.06, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Central pulse on beat
        if (this.pulse > 0.15) {
            ctx.globalCompositeOperation = "lighter";
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.3 * this.pulse);
            grad.addColorStop(0, `hsla(${hue},100%,80%,${this.pulse * 0.35})`);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const hypnoscopeParams = () => ({
    rings:     { base: 20,   min: 4,    max: 48,  mod: { source: "" } },
    speed:     { base: 1,    min: -5,   max: 5,   mod: { source: "" } },
    twist:     { base: 1,    min: -4,   max: 4,   mod: { source: "" } },
    hue:       { base: 0,    min: 0,    max: 360, mod: { source: "" } },
    hueRange:  { base: 180,  min: 0,    max: 360, mod: { source: "" } },
    spokes:    { base: 0,    min: 0,    max: 24,  mod: { source: "" } },
    moireFreq: { base: 2,    min: 0.5,  max: 8,   mod: { source: "" } },
    chromSep:  { base: 0.5,  min: 0,    max: 3,   mod: { source: "" } },
    glow:      { base: 1,    min: 0,    max: 4,   mod: { source: "" } },
    fade:      { base: 0.2,  min: 0.02, max: 0.9, mod: { source: "" } },
    brightness:{ base: 1,    min: 0.3,  max: 2,   mod: { source: "" } },
});

export function drawHypnoscope(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new HypnoscopeViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
