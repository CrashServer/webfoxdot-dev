// Coral Branch — recursive coral/coral-reef growth via diffusion-limited
// aggregation + L-system branching. Bass triggers new growth bursts.

const _state = new WeakMap();

export const coralBranchParams = () => ({
    hue:       { base: 340, min: 0,   max: 360, mod: { source: "" } },
    hueRange:  { base: 60,  min: 0,   max: 180, mod: { source: "" } },
    thickness: { base: 2,   min: 0.5, max: 8,   mod: { source: "" } },
    depth:     { base: 7,   min: 2,   max: 12,  mod: { source: "" } },
    spread:    { base: 0.4, min: 0.1, max: 0.8, mod: { source: "" } },
    glow:      { base: 0.8, min: 0,   max: 3,   mod: { source: "" } },
    speed:     { base: 1,   min: 0.1, max: 5,   mod: { source: "" } },
    count:     { base: 3,   min: 1,   max: 8,   mod: { source: "" } },
});

function _branch(ctx, x, y, angle, len, thick, depth, spread, hue, hueRange, glow) {
    if (depth <= 0 || len < 1.5) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const frac = 1 - depth/(depth+1);
    const h2 = (hue + frac*hueRange) % 360;
    const sat = 70 + frac*20;
    const lit = 40 + frac*30;

    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(ex,ey);
    ctx.strokeStyle = `hsl(${h2},${sat}%,${lit}%)`;
    ctx.lineWidth   = thick;
    if (glow > 0.1) { ctx.shadowColor = `hsla(${h2},100%,70%,0.6)`; ctx.shadowBlur = glow*6; }
    ctx.stroke();

    if (depth <= 1) return;
    // two children
    const devL = (Math.random()*0.5-0.25) * spread;
    const devR = (Math.random()*0.5-0.25) * spread;
    _branch(ctx, ex, ey, angle - spread*(0.5+Math.random()*0.5) + devL, len*0.7, thick*0.72, depth-1, spread, hue, hueRange, glow);
    _branch(ctx, ex, ey, angle + spread*(0.5+Math.random()*0.5) + devR, len*0.7, thick*0.72, depth-1, spread, hue, hueRange, glow);
    // occasional third branch
    if (Math.random() < 0.3) _branch(ctx, ex, ey, angle + (Math.random()-0.5)*0.4, len*0.55, thick*0.55, depth-2, spread, hue, hueRange, glow);
}

export function drawCoralBranch(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1,(sp[1]+sp[2]+sp[3])/3*2.5) : 0;

    let st = _state.get(ctx);
    if (!st) { st = {seed:0, lastBass:0, frame:0}; _state.set(ctx,st); }

    // Slow fade so branches linger
    ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0,0,w,h);

    // On bass hit or periodic timer, draw a new colony
    st.frame++;
    if (bass > 0.45 && bass > st.lastBass + 0.15) { st.seed++; }
    st.lastBass = bass;
    // also redraw periodically so it evolves
    if (st.frame % Math.max(1, Math.round(60/p.speed)) !== 0) return;

    const count = Math.max(1, Math.round(p.count));
    const depth = Math.max(2, Math.round(p.depth + bass*2));
    const rng = { v: (st.seed * 1664525 + 1013904223) >>> 0 };
    const rand = () => { rng.v = (rng.v * 1664525 + 1013904223) >>> 0; return rng.v/4294967296; };

    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let ci = 0; ci < count; ci++) {
        const bx = (ci+1)/(count+1) * w + (rand()-0.5)*w*0.3;
        const by = h * (0.82 + (rand()-0.5)*0.1);
        const len = Math.min(w,h) * (0.12 + rand()*0.1);
        _branch(ctx, bx, by, -Math.PI/2 + (rand()-0.5)*0.4, len, p.thickness, depth, p.spread, p.hue + ci*(p.hueRange/count), p.hueRange, p.glow);
    }
    ctx.restore(); ctx.shadowBlur = 0;
}
