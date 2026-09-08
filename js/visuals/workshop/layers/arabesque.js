// Arabesque — Islamic geometric star tiling.
// Rotates and scales to bass; hue cycles with mid.

export const arabesqueParams = () => ({
    hue:      { base: 30,   min: 0,   max: 360, mod: { source: "" } },
    hueRange: { base: 60,   min: 0,   max: 180, mod: { source: "" } },
    scale:    { base: 1,    min: 0.2, max: 4,   mod: { source: "" } },
    points:   { base: 8,    min: 5,   max: 16,  mod: { source: "" } },
    layers:   { base: 3,    min: 1,   max: 6,   mod: { source: "" } },
    speed:    { base: 0.2,  min: 0,   max: 2,   mod: { source: "" } },
    lineWidth:{ base: 1.5,  min: 0.5, max: 6,   mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,   max: 2,   mod: { source: "" } },
});

function _starPoly(ctx, cx, cy, r, pts, innerR, rot) {
    const step = Math.PI / pts;
    ctx.beginPath();
    for (let i = 0; i <= pts*2; i++) {
        const a = i * step + rot;
        const rr = i % 2 === 0 ? r : innerR;
        i === 0 ? ctx.moveTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr)
                : ctx.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr);
    }
    ctx.closePath();
}

function _hexGrid(n) {
    const pts = [];
    for (let qr = -n; qr <= n; qr++) for (let rr = -n; rr <= n; rr++) {
        if (Math.abs(qr+rr) <= n) pts.push([qr,rr]);
    }
    return pts;
}

export function drawArabesque(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1,(sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid  = sp ? Math.min(1,(sp[8]+sp[10]+sp[12])/3*2.5) : 0;

    ctx.fillStyle = "#050508"; ctx.fillRect(0,0,w,h);

    const U    = Math.min(w,h);
    const pts  = Math.max(5, Math.round(p.points));
    const lvls = Math.max(1, Math.round(p.layers));
    const hue0 = p.hue + mid * p.hueRange + t*10*p.speed;
    const scl  = p.scale * (1 + bass*0.25);

    for (let lvl = 0; lvl < lvls; lvl++) {
        const cellR = U * 0.18 * scl / (lvl*0.6+1);
        const innerFrac = 0.38 + lvl*0.04;
        const rot  = t * p.speed * (lvl%2===0?1:-1) * 0.5 + Math.PI/pts;
        const hue  = (hue0 + lvl * p.hueRange/lvls) % 360;
        const grid = _hexGrid(Math.ceil(U / cellR / 2) + 1);

        ctx.save();
        ctx.translate(w/2, h/2);
        const hex_w = cellR * Math.sqrt(3);
        const hex_h = cellR * 2 * 0.75;

        for (const [q,r] of grid) {
            const gx = q * hex_w + r * hex_w/2;
            const gy = r * hex_h;

            ctx.strokeStyle = `hsla(${hue},80%,${55+lvl*8}%,${0.7-lvl*0.1})`;
            ctx.lineWidth = p.lineWidth;
            if (p.glow > 0) { ctx.shadowColor = `hsla(${hue},100%,70%,0.8)`; ctx.shadowBlur = p.glow * 8; }
            _starPoly(ctx, gx, gy, cellR*0.85, pts, cellR*innerFrac, rot);
            ctx.stroke();

            // inner connector ring
            ctx.beginPath(); ctx.arc(gx, gy, cellR*0.18, 0, Math.PI*2);
            ctx.strokeStyle = `hsla(${hue+30},70%,65%,0.5)`; ctx.lineWidth = p.lineWidth*0.6;
            ctx.stroke();
        }
        ctx.restore(); ctx.shadowBlur = 0;
    }
}
