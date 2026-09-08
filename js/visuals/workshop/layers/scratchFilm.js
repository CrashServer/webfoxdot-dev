// ── Scratch Film ──────────────────────────────────────────────────────────────
// Len Lye ("Free Radicals") / Norman McLaren direct-on-film animation: marks
// scratched and drawn straight onto black leader. Jittering vertical scratches,
// dust, dashes and hand-drawn scars that "boil" every few frames at a chosen
// film rate. Audio transients trigger bursts of extra marks + brief flashes.
// Reads extra.spectrum for level; regenerates its mark list at `fps`.

const _st = new WeakMap();

export const scratchFilmParams = () => ({
    scratches:  { base: 14,  min: 0, max: 60,  step: 1, label: "scratch lines", mod: { source: "" } },
    marks:      { base: 24,  min: 0, max: 160, step: 1, label: "dust / dashes", mod: { source: "" } },
    thickness:  { base: 1.5, min: 0.5, max: 6, label: "line thickness", mod: { source: "" } },
    jitter:     { base: 0.4, min: 0, max: 1,   label: "wiggle", mod: { source: "" } },
    colorChance:{ base: 0.15, min: 0, max: 1,  label: "colour chance", mod: { source: "" } },
    fps:        { base: 16,  min: 2, max: 60,  label: "film fps (boil)", mod: { source: "" } },
    bright:     { base: 100, min: 10, max: 100, label: "brightness", mod: { source: "" } },
    audioReact: { base: 0.6, min: 0, max: 1,   label: "audio → density", mod: { source: "" } },
});

function _regen(s, w, h, p, level) {
    const rnd = Math.random;
    const dens = 1 + level * (p.audioReact ?? 0.6) * 2.5;
    const nS = Math.round((p.scratches | 0) * dens);
    const nM = Math.round((p.marks | 0) * dens);
    const lines = s.lines; lines.length = 0;
    const dots  = s.dots;  dots.length = 0;

    for (let i = 0; i < nS; i++) {
        const x0 = rnd() * w;
        lines.push({
            x: x0,
            drift: (rnd() - 0.5) * w * 0.06 * (p.jitter ?? 0.4),
            wig: rnd() * 6.28,
            amp: rnd() * w * 0.02 * (p.jitter ?? 0.4),
            top: rnd() < 0.3 ? rnd() * h * 0.5 : 0,
            bot: rnd() < 0.3 ? h - rnd() * h * 0.5 : h,
            col: rnd() < (p.colorChance ?? 0.15),
            hue: rnd() * 360,
        });
    }
    for (let i = 0; i < nM; i++) {
        dots.push({
            x: rnd() * w, y: rnd() * h,
            len: rnd() < 0.4 ? rnd() * h * 0.05 : 0,        // dash vs dot
            r: 0.5 + rnd() * 2.5,
            col: rnd() < (p.colorChance ?? 0.15),
            hue: rnd() * 360,
        });
    }
}

export function drawScratchFilm(ctx, w, h, p, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { lastT: -1e9, lines: [], dots: [] }; _st.set(ctx, s); }
    const sp = extra?.spectrum;
    const level = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 3) : 0;

    const fps = Math.max(1, p.fps | 0);
    if (t - s.lastT >= 1 / fps) { s.lastT = t; _regen(s, w, h, p, level); }

    // Black leader; brief milky flash on a strong transient.
    ctx.fillStyle = level > 0.75 ? `rgba(30,30,30,1)` : "#000000";
    ctx.fillRect(0, 0, w, h);

    const bright = (p.bright ?? 100) / 100;
    const white = `rgba(255,255,255,${bright})`;
    ctx.lineWidth = Math.max(0.5, p.thickness ?? 1.5);
    ctx.lineCap = "round";

    // Scratches: near-vertical wiggling strokes running down the strip.
    for (const l of s.lines) {
        ctx.strokeStyle = l.col ? `hsla(${l.hue | 0},90%,60%,${bright})` : white;
        ctx.beginPath();
        const steps = 8;
        for (let k = 0; k <= steps; k++) {
            const f = k / steps;
            const y = l.top + (l.bot - l.top) * f;
            const x = l.x + l.drift * f + Math.sin(l.wig + f * 9) * l.amp;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Dust and dashes.
    for (const d of s.dots) {
        ctx.strokeStyle = ctx.fillStyle = d.col ? `hsla(${d.hue | 0},90%,60%,${bright})` : white;
        if (d.len > 0) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.len);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, 6.2832);
            ctx.fill();
        }
    }
}
