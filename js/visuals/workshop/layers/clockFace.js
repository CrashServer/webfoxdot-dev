// ── Clock Face ────────────────────────────────────────────────────────────────
// Artistic analog clock with neon hands, tick marks, and optional digital
// readout.  Bass pulses the second hand; treble brightens the face.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const clockFaceParams = () => ({
    style:    { base: 0,    min: 0,   max: 2,   step: 1, mod: { source: "" } }, // 0=minimal 1=full 2=art
    hue:      { base: 180,  min: 0,   max: 360,          mod: { source: "" } },
    hue2:     { base: 300,  min: 0,   max: 360,          mod: { source: "" } }, // seconds hand
    scale:    { base: 0.85, min: 0.2, max: 1.0,          mod: { source: "" } },
    glow:     { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.9,  min: 0,   max: 1,            mod: { source: "" } },
    smoothSec:{ base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } }, // sweep vs tick
    showDate: { base: 0,    min: 0,   max: 1,   step: 1, mod: { source: "" } },
    offset:   { base: 0,    min: -12, max: 12,  step: 1, mod: { source: "" } }, // timezone offset hours
});

export function drawClockFace(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const style  = Math.round(Math.max(0, Math.min(2, p.style ?? 0)));
    const hue    = p.hue ?? 180;
    const hue2   = p.hue2 ?? 300;
    const scale  = (p.scale ?? 0.85) * (1 + bass * (p.pulse ?? 0.4) * 0.04);
    const glow   = p.glow ?? 0.7;
    const bgAlpha= p.bgAlpha ?? 0.9;
    const smooth = (p.smoothSec ?? 1) > 0.5;
    const offset = (p.offset ?? 0) * 3600;

    const now  = new Date(Date.now() + offset * 1000);
    const hr   = now.getHours() % 12 + now.getMinutes() / 60;
    const min  = now.getMinutes() + now.getSeconds() / 60;
    const sec  = smooth ? (now.getSeconds() + now.getMilliseconds() / 1000) : now.getSeconds();

    const cx = w / 2, cy = h / 2;
    const R  = Math.min(w, h) * 0.45 * scale;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12 * (1 + treble * 0.3);
        ctx.shadowColor = `hsl(${hue},100%,65%)`;
    }

    // Outer ring
    ctx.strokeStyle = `hsl(${hue},80%,${30 + treble * 20}%)`;
    ctx.lineWidth = style === 2 ? R * 0.04 : 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // Tick marks
    const nTicks = style === 0 ? 4 : 12;
    for (let i = 0; i < nTicks; i++) {
        const a = (i / nTicks) * TAU - Math.PI / 2;
        const isMajor = i % (nTicks / 4) === 0;
        const len = isMajor ? R * 0.12 : R * 0.06;
        const r1  = R, r2 = R - len;
        ctx.shadowBlur = glow * (isMajor ? 10 : 4);
        ctx.strokeStyle = `hsl(${hue},75%,${isMajor ? 70 : 45}%)`;
        ctx.lineWidth   = isMajor ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();

        // Hour numerals on full style
        if (style >= 1 && isMajor) {
            ctx.shadowBlur = glow * 8;
            ctx.fillStyle = `hsl(${hue},70%,65%)`;
            ctx.font = `bold ${Math.round(R * 0.12)}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const num = i === 0 ? 12 : i;
            ctx.fillText(num, cx + Math.cos(a) * (R - R * 0.2), cy + Math.sin(a) * (R - R * 0.2));
        }
    }

    // Draw hand helper
    const drawHand = (angle, length, width, colour, extraGlow = 0) => {
        ctx.shadowBlur = glow * (15 + extraGlow) + extraGlow * 5;
        ctx.shadowColor = colour;
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - Math.PI/2) * length, cy + Math.sin(angle - Math.PI/2) * length);
        ctx.stroke();
        // Counterweight tail
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle + Math.PI/2) * length * 0.2, cy + Math.sin(angle + Math.PI/2) * length * 0.2);
        ctx.stroke();
        ctx.lineCap = "butt";
    };

    const hrAngle  = (hr / 12) * TAU;
    const minAngle = (min / 60) * TAU;
    const secAngle = (sec / 60) * TAU;

    drawHand(hrAngle,  R * 0.55, style === 2 ? 5 : 4,  `hsl(${hue},80%,70%)`);
    drawHand(minAngle, R * 0.78, style === 2 ? 3 : 2.5, `hsl(${hue},85%,80%)`);
    drawHand(secAngle, R * 0.88, 1.5, `hsl(${hue2},100%,75%)`, bass * 10);

    // Centre dot
    ctx.shadowBlur = glow * 12;
    ctx.shadowColor = `hsl(${hue},100%,80%)`;
    ctx.fillStyle = `hsl(${hue},80%,85%)`;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.025, 0, TAU); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.012, 0, TAU); ctx.fill();

    // Digital readout
    if ((p.showDate ?? 0) > 0.5) {
        const dateStr = now.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
        ctx.shadowBlur = glow * 6;
        ctx.fillStyle = `hsla(${hue},70%,60%,0.8)`;
        ctx.font = `${Math.round(R * 0.09)}px "Courier New", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dateStr, cx, cy + R * 0.45);
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
