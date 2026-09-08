// ── XY Oscilloscope ───────────────────────────────────────────────────────────
// Lissajous / XY oscilloscope mode driven by two frequency-derived audio bands
// or by parametric sine sweep in no-audio mode.  Phosphor-green (or coloured)
// persistence trail with glow bloom.  Bass brightens; treble adds harmonics.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const xyOscopeParams = () => ({
    freqX:    { base: 3,    min: 1,   max: 16,  step: 1,  mod: { source: "" } }, // X frequency multiplier
    freqY:    { base: 2,    min: 1,   max: 16,  step: 1,  mod: { source: "" } }, // Y frequency multiplier
    phase:    { base: 90,   min: 0,   max: 360,           mod: { source: "" } }, // phase offset degrees
    speed:    { base: 0.5,  min: 0,   max: 4,             mod: { source: "" } }, // sweep speed
    pts:      { base: 800,  min: 100, max: 2000,step: 100,mod: { source: "" } },
    hue:      { base: 120,  min: 0,   max: 360,           mod: { source: "" } },
    glow:     { base: 0.8,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 1.5,  min: 0.3, max: 5,             mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } },
    trail:    { base: 0.15, min: 0,   max: 0.9,           mod: { source: "" } }, // ghost persistence
    audioMod: { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } }, // audio distortion depth
    scale:    { base: 0.42, min: 0.1, max: 0.5,           mod: { source: "" } },
});

export function drawXyOscope(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[10]+spectrum[14]+spectrum[18])/3*3) : 0;

    const fX    = Math.round(Math.max(1, Math.min(16, p.freqX ?? 3)));
    const fY    = Math.round(Math.max(1, Math.min(16, p.freqY ?? 2)));
    const phase = ((p.phase ?? 90) + mid * 30) * Math.PI / 180;
    const speed = p.speed ?? 0.5;
    const nPts  = Math.round(Math.max(100, Math.min(2000, p.pts ?? 800)));
    const hue   = p.hue ?? 120;
    const glow  = p.glow ?? 0.8;
    const thick = p.thick ?? 1.5;
    const pulse = p.pulse ?? 0.5;
    const trail = p.trail ?? 0.15;
    const audioMod = p.audioMod ?? 0.6;
    const scale = (p.scale ?? 0.42) * Math.min(w, h) * (1 + bass * pulse * 0.1);

    const cx = w / 2, cy = h / 2;

    // Trail / persistence: dim previous frame
    ctx.fillStyle = `rgba(0,0,0,${1 - trail})`;
    ctx.fillRect(0, 0, w, h);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 15 * (1 + bass * 0.4);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    const sweep = t * speed;
    ctx.strokeStyle = `hsl(${hue},90%,${60 + treble * 30}%)`;
    ctx.lineWidth = thick * (1 + bass * 0.3);
    ctx.lineCap = "round";
    ctx.beginPath();

    for (let i = 0; i <= nPts; i++) {
        const u = i / nPts;
        const angle = u * TAU + sweep;

        // Base Lissajous
        let x = Math.sin(fX * angle + phase);
        let y = Math.sin(fY * angle);

        // Audio modulation — spectrum bends the curve
        if (audioMod > 0.01 && spectrum) {
            const bin = Math.min(63, Math.floor(u * 64));
            const mod = spectrum[bin] * audioMod;
            x += Math.cos(fX * 2 * angle) * mod * 0.4;
            y += Math.sin(fY * 3 * angle + sweep) * mod * 0.4;
        }
        // Treble adds higher harmonics
        if (treble > 0.1) {
            x += Math.sin(fX * 5 * angle) * treble * 0.15;
            y += Math.cos(fY * 4 * angle) * treble * 0.15;
        }

        const px = cx + x * scale;
        const py = cy + y * scale;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Centre dot
    if (bass > 0.3) {
        ctx.shadowBlur = glow * 20 * bass;
        ctx.shadowColor = `hsl(${hue},100%,90%)`;
        ctx.fillStyle = `hsl(${hue},90%,90%)`;
        ctx.beginPath();
        ctx.arc(cx, cy, thick * bass * 2, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
