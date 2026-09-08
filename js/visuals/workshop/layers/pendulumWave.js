// ── Pendulum Wave ─────────────────────────────────────────────────────────────
// N pendulums of different lengths create a travelling wave effect.
// Classic physics demo: period Tₙ = 2π√(Lₙ/g), lengths tuned so pendulums
// complete 51..51+N full swings in the loop period.  Bass adds energy; treble
// brightens the trails.

const _st = new WeakMap();
const TAU = Math.PI * 2;
const G = 9.81;

export const pendulumWaveParams = () => ({
    n:        { base: 15,   min: 3,  max: 30,  step: 1, mod: { source: "" } },
    period:   { base: 60,   min: 10, max: 120,          mod: { source: "" } }, // loop period (s)
    swing:    { base: 0.25, min: 0.05,max:0.5,          mod: { source: "" } }, // amplitude (radians)
    hue:      { base: 200,  min: 0,  max: 360,          mod: { source: "" } },
    hueRange: { base: 200,  min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    bobSize:  { base: 6,    min: 2,  max: 20,  step: 1, mod: { source: "" } },
    trail:    { base: 0.12, min: 0,  max: 0.5,          mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    showRope: { base: 1,    min: 0,  max: 1,   step: 1, mod: { source: "" } },
    bgAlpha:  { base: 0.85, min: 0,  max: 1,            mod: { source: "" } },
    pivotY:   { base: 0.08, min: 0,  max: 0.4,          mod: { source: "" } }, // pivot Y fraction
});

export function drawPendulumWave(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const n      = Math.round(Math.max(3, Math.min(30, p.n ?? 15)));
    const period = p.period ?? 60;
    const swing  = (p.swing ?? 0.25) * (1 + bass * (p.pulse ?? 0.4) * 0.4);
    const hue    = p.hue ?? 200;
    const hueR   = p.hueRange ?? 200;
    const glow   = p.glow ?? 0.6;
    const bobSz  = (p.bobSize ?? 6) * (1 + bass * 0.3);
    const trail  = p.trail ?? 0.12;
    const bgAlpha= p.bgAlpha ?? 0.85;
    const showRope = (p.showRope ?? 1) > 0.5;
    const pivotYFrac = p.pivotY ?? 0.08;

    // Pendulum lengths tuned: n-th completes (51+i) swings in `period` seconds
    // Tᵢ = period / (51 + i)  =>  Lᵢ = g * (Tᵢ/(2π))²
    const lengths = Array.from({ length: n }, (_, i) => {
        const Ti = period / (51 + i);
        return G * (Ti / TAU) ** 2;
    });
    const maxL = lengths[0]; // longest (slowest) pendulum

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const pivotX = w / 2;
    const pivotY = h * pivotYFrac;
    const scaleL = (h * 0.85) / maxL;

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 10 * (1 + treble * 0.3);
    }

    for (let i = 0; i < n; i++) {
        const L  = lengths[i];
        const T  = TAU * Math.sqrt(L / G);
        const th = swing * Math.sin(TAU * t / T);

        const x = pivotX + Math.sin(th) * L * scaleL;
        const y = pivotY + Math.cos(th) * L * scaleL;

        const ch = (hue + (i / (n - 1)) * hueR) % 360;
        const alpha = 0.5 + (i / n) * 0.5;

        if (showRope) {
            ctx.strokeStyle = `hsla(${ch},60%,40%,${alpha * 0.6})`;
            ctx.lineWidth = 0.7;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(pivotX, pivotY);
            ctx.lineTo(x, y);
            ctx.stroke();
            if (glow > 0.05) ctx.shadowBlur = glow * 10 * (1 + treble * 0.3);
        }

        ctx.shadowColor = `hsl(${ch},100%,70%)`;
        ctx.fillStyle = `hsl(${ch},90%,${65 + treble * 25}%)`;
        ctx.beginPath();
        ctx.arc(x, y, bobSz, 0, TAU);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}
