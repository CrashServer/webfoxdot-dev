// ── Morph Shape ───────────────────────────────────────────────────────────────
// Smooth morphing between N-pointed geometric shapes (circle, triangle, square,
// star, hexagon, …).  Audio: bass pulses the scale; treble shifts the hue.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Shape definitions: array of radii at equal angle increments
// Parameterised as function(theta) → radius (normalised 0..1)
function shapeR(type, th) {
    switch (type) {
        case 0: return 1; // circle
        case 1: { // triangle
            const a = ((th % (TAU/3)) - TAU/6);
            return Math.cos(TAU/6) / Math.cos(a);
        }
        case 2: { // square
            const a = ((th % (TAU/4)) - TAU/8);
            return Math.cos(TAU/8) / Math.cos(a);
        }
        case 3: { // pentagon
            const a = ((th % (TAU/5)) - TAU/10);
            return Math.cos(TAU/10) / Math.cos(a);
        }
        case 4: { // hexagon
            const a = ((th % (TAU/6)) - TAU/12);
            return Math.cos(TAU/12) / Math.cos(a);
        }
        case 5: { // 4-point star
            return 0.5 + 0.5 * Math.abs(Math.cos(th * 2));
        }
        case 6: { // 6-point star
            return 0.5 + 0.5 * Math.abs(Math.cos(th * 3));
        }
        case 7: { // 3-lobe rose
            return Math.abs(Math.cos(th * 1.5));
        }
        default: return 1;
    }
}

const SHAPE_NAMES = ["Circle","Triangle","Square","Pentagon","Hexagon","4★ Star","6★ Star","Rose"];

export const morphShapeParams = () => ({
    shapeA:   { base: 0,    min: 0,  max: 7,   step: 1, mod: { source: "" } },
    shapeB:   { base: 2,    min: 0,  max: 7,   step: 1, mod: { source: "" } },
    morph:    { base: 0,    min: 0,  max: 1,            mod: { source: "" } }, // 0=A, 1=B, auto-cycles
    autoMorph:{ base: 1,    min: 0,  max: 1,  step: 1,  mod: { source: "" } },
    speed:    { base: 0.2,  min: 0,  max: 2,            mod: { source: "" } }, // morph cycle speed
    rotSpeed: { base: 0.15, min: -2, max: 2,            mod: { source: "" } },
    scale:    { base: 0.4,  min: 0.1,max: 0.5,          mod: { source: "" } },
    pts:      { base: 200,  min: 20, max: 600,step: 20, mod: { source: "" } },
    hue:      { base: 180,  min: 0,  max: 360,          mod: { source: "" } },
    hue2:     { base: 300,  min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    thick:    { base: 2,    min: 0.3,max: 8,            mod: { source: "" } },
    fill:     { base: 0.15, min: 0,  max: 1,            mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } },
});

export function drawMorphShape(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const sA      = Math.round(Math.max(0, Math.min(7, p.shapeA ?? 0)));
    const sB      = Math.round(Math.max(0, Math.min(7, p.shapeB ?? 2)));
    const auto    = (p.autoMorph ?? 1) > 0.5;
    const speed   = p.speed ?? 0.2;
    const rotSpd  = p.rotSpeed ?? 0.15;
    const scale   = (p.scale ?? 0.4) * Math.min(w, h) * (1 + bass * (p.pulse ?? 0.4) * 0.15);
    const nPts    = Math.round(Math.max(20, Math.min(600, p.pts ?? 200)));
    const hue     = ((p.hue ?? 180) + treble * 40) % 360;
    const hue2    = p.hue2 ?? 300;
    const glow    = p.glow ?? 0.6;
    const thick   = p.thick ?? 2;
    const fill    = p.fill ?? 0.15;
    const bgAlpha = p.bgAlpha ?? 0;

    const morphT  = auto
        ? (Math.sin(t * speed * TAU) * 0.5 + 0.5)
        : Math.max(0, Math.min(1, p.morph ?? 0));

    const blendHue = hue + morphT * ((hue2 - hue + 360) % 360);

    let st = _st.get(ctx);
    if (!st) { st = { rot: 0, lastT: t }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rot += rotSpd * dt;

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    const cx = w / 2, cy = h / 2;

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 18 * (1 + treble * 0.3);
        ctx.shadowColor = `hsl(${blendHue},100%,70%)`;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.rot);

    ctx.beginPath();
    for (let i = 0; i <= nPts; i++) {
        const th = (i / nPts) * TAU;
        const rA = shapeR(sA, th);
        const rB = shapeR(sB, th);
        const r  = (rA * (1 - morphT) + rB * morphT) * scale;
        const x  = Math.cos(th) * r, y = Math.sin(th) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (fill > 0.01) {
        ctx.fillStyle = `hsla(${blendHue},75%,45%,${fill})`;
        ctx.fill();
    }

    ctx.strokeStyle = `hsl(${blendHue},90%,${65 + treble * 25}%)`;
    ctx.lineWidth = thick;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
}
