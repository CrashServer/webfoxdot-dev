// ── L-System ──────────────────────────────────────────────────────────────────
// Lindenmayer system with turtle graphics.  Six built-in presets (tree, dragon
// curve, Sierpinski triangle, Koch snowflake, bush, fractal fern).  Audio:
// bass makes branches thicker and the glow brighter; treble speeds up growth.

const _st = new WeakMap();
const DEG = Math.PI / 180;

// Each preset: { axiom, rules: {char→string}, angle (deg) }
const PRESETS = [
    // 0 — Fractal Tree
    {
        axiom: "F", angle: 25,
        rules: { F: "F[+F]F[-F]F" },
        segLen: 0.018,
    },
    // 1 — Dragon Curve
    {
        axiom: "FX", angle: 90,
        rules: { X: "X+YF+", Y: "-FX-Y" },
        segLen: 0.06,
    },
    // 2 — Sierpinski Triangle
    {
        axiom: "F-G-G", angle: 120,
        rules: { F: "F-G+F+G-F", G: "GG" },
        segLen: 0.035,
    },
    // 3 — Koch Snowflake
    {
        axiom: "F++F++F", angle: 60,
        rules: { F: "F-F++F-F" },
        segLen: 0.018,
    },
    // 4 — Bush
    {
        axiom: "F", angle: 20,
        rules: { F: "FF+[+F-F-F]-[-F+F+F]" },
        segLen: 0.016,
    },
    // 5 — Fern-like
    {
        axiom: "X", angle: 25,
        rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" },
        segLen: 0.022,
    },
];

function expand(axiom, rules, iters) {
    let s = axiom;
    for (let i = 0; i < iters; i++) {
        let next = "";
        for (const c of s) next += rules[c] ?? c;
        s = next;
        if (s.length > 200000) break; // safety cap
    }
    return s;
}

export const lSystemParams = () => ({
    preset:  { base: 0,    min: 0,   max: 5,   step: 1,  mod: { source: "" } },
    iters:   { base: 5,    min: 1,   max: 8,   step: 1,  mod: { source: "" } },
    angle:   { base: 0,    min: -45, max: 45,            mod: { source: "" } }, // extra angle offset
    lenMult: { base: 1.0,  min: 0.2, max: 3,             mod: { source: "" } },
    posX:    { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } }, // root X (0..1)
    posY:    { base: 0.85, min: 0,   max: 1,             mod: { source: "" } }, // root Y (0..1)
    hue:     { base: 100,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange:{ base: 80,   min: 0,   max: 360,           mod: { source: "" } },
    thick:   { base: 1.0,  min: 0.1, max: 5,             mod: { source: "" } },
    glow:    { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:   { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
    speed:   { base: 0.3,  min: 0,   max: 5,             mod: { source: "" } }, // sway animation
});

export function drawLSystem(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const preset = Math.round(Math.max(0, Math.min(5, p.preset ?? 0)));
    const iters  = Math.round(Math.max(1, Math.min(8, p.iters ?? 5)));
    const pr     = PRESETS[preset];
    const angle  = (pr.angle + (p.angle ?? 0)) * DEG;
    const lenPx  = pr.segLen * Math.min(w, h) * (p.lenMult ?? 1.0) * (1 + bass * (p.pulse ?? 0.4) * 0.3);
    const hue    = p.hue ?? 100;
    const hueR   = p.hueRange ?? 80;
    const thick  = (p.thick ?? 1.0) * (1 + bass * 0.3);
    const glow   = p.glow ?? 0.3;
    const speed  = p.speed ?? 0.3;
    const rootX  = (p.posX ?? 0.5) * w;
    const rootY  = (p.posY ?? 0.85) * h;

    // Sway: slight sinusoidal angle variation over time (like wind)
    const sway = Math.sin(t * speed) * 0.03;

    let st = _st.get(ctx);
    if (!st || st.preset !== preset || st.iters !== iters) {
        st = { preset, iters, str: expand(pr.axiom, pr.rules, iters) };
        _st.set(ctx, st);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    // Turtle state
    const stack = [];
    let x = rootX, y = rootY;
    let dir = -Math.PI / 2; // pointing up
    let depth = 0;

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 10 * (1 + bass * 0.5);
        ctx.shadowColor = `hsl(${hue},80%,65%)`;
    }

    for (const c of st.str) {
        switch (c) {
            case 'F': case 'G': {
                const sw = depth > 0 ? sway * (1 - depth * 0.15) : 0;
                const nx = x + Math.cos(dir + sw) * lenPx;
                const ny = y + Math.sin(dir + sw) * lenPx;
                const h2 = (hue + depth * (hueR / 8)) % 360;
                const lw = Math.max(0.3, thick * (1 - depth * 0.07));
                ctx.strokeStyle = `hsl(${h2},75%,${50 + (1-depth*0.05)*20}%)`;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(nx, ny);
                ctx.stroke();
                x = nx; y = ny;
                break;
            }
            case '+': dir -= angle; break;
            case '-': dir += angle; break;
            case '[': stack.push({ x, y, dir, depth }); depth++; break;
            case ']': { const s2 = stack.pop(); if (s2) { x=s2.x; y=s2.y; dir=s2.dir; depth=s2.depth; } break; }
        }
    }
    ctx.shadowBlur = 0;
}
