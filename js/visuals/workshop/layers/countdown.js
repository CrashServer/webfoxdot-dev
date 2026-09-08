// ── Countdown ─────────────────────────────────────────────────────────────────
// Dramatic countdown timer with tension-building effects.  Counts from a set
// duration to zero, then loops or holds.  Bass pulses the display; near zero
// the screen flashes red.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const countdownParams = () => ({
    duration: { base: 30,   min: 1,   max: 3600, step: 1, mod: { source: "" } }, // seconds
    style:    { base: 0,    min: 0,   max: 2,    step: 1, mod: { source: "" } }, // 0=digital 1=ring 2=both
    loop:     { base: 1,    min: 0,   max: 1,    step: 1, mod: { source: "" } },
    hue:      { base: 200,  min: 0,   max: 360,           mod: { source: "" } },
    warnHue:  { base: 0,    min: 0,   max: 360,           mod: { source: "" } }, // < 10s hue
    glow:     { base: 0.7,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
    scale:    { base: 1.0,  min: 0.2, max: 2,             mod: { source: "" } },
    bgAlpha:  { base: 0.85, min: 0,   max: 1,             mod: { source: "" } },
    fontSize: { base: 120,  min: 20,  max: 300,  step: 4, mod: { source: "" } },
});

export function drawCountdown(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const dur    = Math.max(1, Math.round(p.duration ?? 30));
    const style  = Math.round(Math.max(0, Math.min(2, p.style ?? 0)));
    const loop   = (p.loop ?? 1) > 0.5;
    const glow   = p.glow ?? 0.7;
    const pulse  = p.pulse ?? 0.4;
    const scale  = p.scale ?? 1.0;
    const bgAlpha= p.bgAlpha ?? 0.85;
    const fsize  = Math.round(Math.max(20, Math.min(300, p.fontSize ?? 120))) * scale;

    let st = _st.get(ctx);
    if (!st) { st = { start: t, lastT: t }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    let elapsed = t - st.start;
    if (elapsed > dur) {
        if (loop) { st.start = t; elapsed = 0; }
        else elapsed = dur;
    }
    const remaining = Math.max(0, dur - elapsed);
    const frac = remaining / dur; // 1→0

    const warn = remaining < 10;
    const hue = warn ? (p.warnHue ?? 0) : (p.hue ?? 200);
    const beatBright = 1 + bass * pulse * 0.3;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Warning flash when < 10s
    if (warn && Math.sin(t * (11 - remaining) * 0.8) > 0.7) {
        ctx.fillStyle = `rgba(180,0,0,${(1 - frac) * 0.12})`;
        ctx.fillRect(0, 0, w, h);
    }

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 30 * beatBright * (warn ? 1.5 : 1);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const ms   = Math.floor((remaining % 1) * 100);

    const timeStr = dur >= 60
        ? `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
        : `${String(secs).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;

    // Ring style
    if (style === 1 || style === 2) {
        const R = Math.min(w, h) * 0.38 * scale;
        ctx.strokeStyle = `hsla(${hue},50%,25%,0.4)`;
        ctx.lineWidth = R * 0.12;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

        ctx.strokeStyle = `hsl(${hue},90%,${60 + treble * 25}%)`;
        ctx.lineWidth = R * 0.12;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
        ctx.stroke();
        ctx.lineCap = "butt";
    }

    // Digital display
    if (style === 0 || style === 2) {
        ctx.font = `bold ${fsize}px "Courier New", monospace`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = `hsl(${hue},85%,${65 + treble * 25}%)`;
        ctx.fillText(timeStr, cx, cy);
    }

    // "GO!" when reaching zero
    if (remaining < 0.5) {
        const alpha = 1 - remaining * 2;
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${fsize * 1.2}px Arial Black, sans-serif`;
        ctx.fillStyle = `hsl(${hue},100%,80%)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GO!", cx, cy);
        ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
