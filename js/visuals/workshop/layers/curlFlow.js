// Curl Flow — curl-noise flow field with particle trails.
// Different from flowField (uses curl of a potential field rather than Perlin).
// Bass increases particle speed; hue rotates with mid.

const _state = new WeakMap();

function _noise2(x, y) {
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
    const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
    const h00=(ix*1664525+iy*1013904223+22695477)>>>0;
    const h10=((ix+1)*1664525+iy*1013904223+22695477)>>>0;
    const h01=(ix*1664525+(iy+1)*1013904223+22695477)>>>0;
    const h11=((ix+1)*1664525+(iy+1)*1013904223+22695477)>>>0;
    const g = h => (h&0xFF)/255*2-1;
    const g00=g(h00),g10=g(h10),g01=g(h01),g11=g(h11);
    return g00+(g10-g00)*u + (g01-g00)*v + (g11-g10+g00-g01)*u*v;
}

function _curl(x, y, t, eps=0.01) {
    const a = _noise2(x, y+eps) - _noise2(x, y-eps);
    const b = _noise2(x+eps, y) - _noise2(x-eps, y);
    return [a/(2*eps) + Math.cos(t*0.3+x*0.1), -b/(2*eps) + Math.sin(t*0.2+y*0.1)];
}

export const curlFlowParams = () => ({
    particles: { base: 800,  min: 100, max: 3000, mod: { source: "" } },
    speed:     { base: 1.2,  min: 0.1, max: 5,    mod: { source: "" } },
    scale:     { base: 0.004,min: 0.001,max:0.015, mod: { source: "" } },
    hue:       { base: 200,  min: 0,   max: 360,  mod: { source: "" } },
    hueRange:  { base: 120,  min: 0,   max: 360,  mod: { source: "" } },
    fade:      { base: 0.025,min: 0,   max: 0.1,  mod: { source: "" } },
    lineLen:   { base: 4,    min: 1,   max: 12,   mod: { source: "" } },
    glow:      { base: 0.5,  min: 0,   max: 2,    mod: { source: "" } },
});

export function drawCurlFlow(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1,(sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid  = sp ? Math.min(1,(sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const N    = Math.max(100, Math.round(p.particles));

    let st = _state.get(ctx);
    if (!st || st.N !== N) {
        st = { N, px: new Float32Array(N), py: new Float32Array(N), ph: new Float32Array(N) };
        for (let i=0; i<N; i++) { st.px[i]=Math.random()*w; st.py[i]=Math.random()*h; st.ph[i]=Math.random(); }
        _state.set(ctx, st);
    }

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`; ctx.fillRect(0,0,w,h);

    const sc   = p.scale;
    const spd  = p.speed * (1 + bass*1.5);
    const hue0 = p.hue + mid*p.hueRange;
    const dt   = 1/60;

    if (p.glow > 0) { ctx.shadowBlur = p.glow*4; }
    ctx.lineWidth = 1;

    for (let i=0; i<N; i++) {
        const x=st.px[i], y=st.py[i];
        const [cx,cy] = _curl(x*sc, y*sc, t*0.1);
        const nx = x + cx*spd*dt*60*p.lineLen;
        const ny = y + cy*spd*dt*60*p.lineLen;

        const hue = (hue0 + st.ph[i]*p.hueRange) % 360;
        const speed2 = Math.hypot(cx,cy);
        const alpha = Math.min(1, 0.15 + speed2*0.3 + bass*0.3);
        ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
        if (p.glow > 0) ctx.shadowColor = `hsla(${hue},100%,70%,0.4)`;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(nx,ny); ctx.stroke();

        // wrap or respawn
        if (nx < 0 || nx > w || ny < 0 || ny > h || Math.random() < 0.002) {
            st.px[i] = Math.random()*w; st.py[i] = Math.random()*h;
        } else { st.px[i]=nx; st.py[i]=ny; }
    }
    ctx.shadowBlur = 0;
}
