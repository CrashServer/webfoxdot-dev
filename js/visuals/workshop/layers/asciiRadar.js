// ASCII Radar — phosphor radar sweep: range rings, bearing lines, fading blips.
// Beats spawn new contacts; audio speeds the sweep.

const _state = new WeakMap();

export const asciiRadarParams = () => ({
    speed:  { base: 1,   min: 0.1, max: 5,   mod: { source: "" } },
    rings:  { base: 4,   min: 2,   max: 8,   mod: { source: "" } },
    hue:    { base: 120, min: 0,   max: 360, mod: { source: "" } },
    glow:   { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
});

export function drawAsciiRadar(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const lv = extra?.live;
    const beat = lv?.beat ?? t*2;

    let st = _state.get(ctx);
    if (!st) {
        st = { ang: 0, blips: [], lastBeat: -1 };
        for (let i = 0; i < 6; i++) st.blips.push({ a: Math.random()*6.28, r: 0.15+Math.random()*0.8, lit: 0 });
        _state.set(ctx, st);
    }
    const dt = 1/60;
    st.ang += dt * p.speed * 1.6 * (1 + bass*0.4);
    if (st.ang > 6.2832) st.ang -= 6.2832;
    const bi = Math.floor(beat);
    if (bi !== st.lastBeat) { st.lastBeat = bi; if (st.blips.length < 20) st.blips.push({ a: Math.random()*6.28, r: 0.15+Math.random()*0.8, lit: 0 }); }

    const hue = p.hue;
    const tr = Math.sin((hue-0)*Math.PI/180+Math.PI)*0.5+0.5;
    const tg = Math.sin((hue-120)*Math.PI/180+Math.PI)*0.5+0.5;
    const tb = Math.sin((hue-240)*Math.PI/180+Math.PI)*0.5+0.5;
    const rr = tr*255|0, rg = tg*255|0, rb = tb*255|0;

    const U = Math.min(w, h), cx = w/2, cy = h/2, R = U*0.46;
    const rings = Math.max(2, Math.round(p.rings));

    ctx.fillStyle = `rgba(0,6,2,0.35)`; ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = `rgba(${rr},${rg},${rb},0.25)`; ctx.lineWidth = 1;
    for (let i = 1; i <= rings; i++) { ctx.beginPath(); ctx.arc(cx,cy,R*i/rings,0,6.2832); ctx.stroke(); }
    for (let a = 0; a < 8; a++) { const th = a/8*6.2832; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(th)*R,cy+Math.sin(th)*R); ctx.stroke(); }

    for (let k = 0; k < 24; k++) {
        const a = st.ang - k*0.03, al = (1-k/24)*0.4;
        ctx.strokeStyle = `rgba(${rr},${rg},${rb},${al})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R); ctx.stroke();
    }

    ctx.font = `${U*0.016|0}px 'Courier New',monospace`; ctx.textAlign = "left";
    for (const b of st.blips) {
        let da = Math.abs(((st.ang - b.a + Math.PI) % 6.2832) - Math.PI);
        if (da < 0.08) b.lit = 1; b.lit = Math.max(0, b.lit - dt*0.6);
        const x = cx + Math.cos(b.a)*b.r*R, y = cy + Math.sin(b.a)*b.r*R;
        ctx.fillStyle = `rgba(${rr},${rg},${rb},${0.2+b.lit*0.8})`;
        ctx.shadowColor = `rgba(${rr},${rg},${rb},${b.lit*p.glow})`; ctx.shadowBlur = U*0.02*b.lit*p.glow;
        ctx.beginPath(); ctx.arc(x,y,U*0.008*(0.6+b.lit),0,6.28); ctx.fill(); ctx.shadowBlur = 0;
        if (b.lit > 0.3) ctx.fillText(`${(b.r*999)|0}m`, x+U*0.012, y);
    }
    ctx.fillStyle = `rgba(${rr},${rg},${rb},0.9)`; ctx.font = `${U*0.018|0}px 'Courier New',monospace`;
    ctx.fillText(`◉ SCAN  BRG ${((st.ang/6.2832*360)|0)}°  CONTACTS ${st.blips.length}`, U*0.03, U*0.05);
}
