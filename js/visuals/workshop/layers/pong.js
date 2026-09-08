// Pong — BPM-reactive pong. Ball speed from BPM + bass. AI paddles.
// Left paddle = host name, right = challenger. Glow from live-eval flashes.

const SPARKS = 14;
const _state = new WeakMap();

export const pongParams = () => ({
    speed:      { base: 1,    min: 0.2, max: 3,   mod: { source: "" } },
    paddleSize: { base: 0.14, min: 0.05,max: 0.4, mod: { source: "" } },
    ai:         { base: 0.85, min: 0,   max: 1,   mod: { source: "" } },
    hue:        { base: 140,  min: 0,   max: 360, mod: { source: "" } },
    glow:       { base: 1,    min: 0,   max: 3,   mod: { source: "" } },
});

function _reset(st) {
    st.bx = 0.5; st.by = 0.5;
    const ang = (Math.random()*0.4+0.3)*Math.PI*(Math.random()<0.5?1:-1);
    st.vx = Math.cos(ang)*0.5; st.vy = Math.sin(ang)*0.5;
    if (Math.abs(st.vx) < 0.2) st.vx = 0.2*Math.sign(st.vx||1);
    st.ly = 0.5; st.ry = 0.5;
}

export function drawPong(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1,(sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const lv   = extra?.live;
    const bpm  = lv?.bpm ?? 120;

    let st = _state.get(ctx);
    if (!st) {
        st = { bx:0.5, by:0.5, vx:0.5, vy:0.3, ly:0.5, ry:0.5, score:{L:0,R:0}, sparks:[], lastBeat:-1, flashL:0, flashR:0 };
        _reset(st);
        _state.set(ctx, st);
    }

    const hue = p.hue;
    const rL=(Math.sin(hue*Math.PI/180)*0.5+0.5)*255|0;
    const gL=(Math.sin((hue+120)*Math.PI/180)*0.5+0.5)*255|0;
    const bL=(Math.sin((hue+240)*Math.PI/180)*0.5+0.5)*255|0;
    const rR=(Math.sin((hue+180)*Math.PI/180)*0.5+0.5)*255|0;
    const gR=(Math.sin((hue+60)*Math.PI/180)*0.5+0.5)*255|0;
    const bR=(Math.sin((hue+300)*Math.PI/180)*0.5+0.5)*255|0;

    const dt = 1/60;
    const bpmF = Math.max(0.5, Math.min(2.5, bpm/120));
    const spd  = bpmF * (0.45 + bass*0.55) * p.speed;
    const ph2  = p.paddleSize/2;
    const lag  = Math.max(0.01, 1-p.ai);

    st.flashL = Math.max(0, st.flashL - dt*3);
    st.flashR = Math.max(0, st.flashR - dt*3);

    // AI paddles
    const lTarget = st.vx < 0 ? st.by : 0.5;
    const rTarget = st.vx > 0 ? st.by : 0.5;
    st.ly += (lTarget-st.ly)*(1-lag)*spd*4*dt;
    st.ry += (rTarget-st.ry)*(1-lag)*spd*4*dt;
    st.ly = Math.max(ph2, Math.min(1-ph2, st.ly));
    st.ry = Math.max(ph2, Math.min(1-ph2, st.ry));

    // ball
    st.bx += st.vx*dt*spd; st.by += st.vy*dt*spd;
    if (st.by < 0.02 || st.by > 0.98) { st.vy *= -1; st.by = Math.max(0.02,Math.min(0.98,st.by)); }
    const pw = 0.018;
    if (st.bx < 0.06 && Math.abs(st.by-st.ly)<ph2 && st.vx<0) {
        st.vx = Math.abs(st.vx)*(1+bass*0.3); st.vy += (st.by-st.ly)*1.5; st.flashL = 1;
        for (let i=0;i<SPARKS;i++){const a=Math.random()*6.28;st.sparks.push({x:st.bx,y:st.by,vx:Math.cos(a)*0.007,vy:Math.sin(a)*0.007,life:1,r:rL,g:gL,b:bL});}
    }
    if (st.bx > 0.94 && Math.abs(st.by-st.ry)<ph2 && st.vx>0) {
        st.vx = -Math.abs(st.vx)*(1+bass*0.3); st.vy += (st.by-st.ry)*1.5; st.flashR = 1;
        for (let i=0;i<SPARKS;i++){const a=Math.random()*6.28;st.sparks.push({x:st.bx,y:st.by,vx:Math.cos(a)*0.007,vy:Math.sin(a)*0.007,life:1,r:rR,g:gR,b:bR});}
    }
    st.vx = Math.max(-2.8, Math.min(2.8, st.vx));
    st.vy = Math.max(-1.8, Math.min(1.8, st.vy));
    if (st.bx < 0) { st.score.R++; _reset(st); }
    if (st.bx > 1) { st.score.L++; _reset(st); }

    ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = `rgba(${rL},${gL},${bL},0.1)`; ctx.setLineDash([h*0.02,h*0.02]); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke(); ctx.setLineDash([]);

    const gl = p.glow;
    ctx.shadowBlur = (16+st.flashL*44+bass*20)*gl;
    ctx.shadowColor = `rgba(${rL},${gL},${bL},${0.6+st.flashL*0.4})`;
    ctx.fillStyle   = `rgba(${rL},${gL},${bL},${0.7+st.flashL*0.3})`;
    ctx.fillRect(w*0.04,(st.ly-ph2)*h,w*pw,p.paddleSize*h);
    ctx.shadowBlur = (16+st.flashR*44+bass*20)*gl;
    ctx.shadowColor = `rgba(${rR},${gR},${bR},${0.6+st.flashR*0.4})`;
    ctx.fillStyle   = `rgba(${rR},${gR},${bR},${0.7+st.flashR*0.3})`;
    ctx.fillRect(w*(1-0.04-pw),(st.ry-ph2)*h,w*pw,p.paddleSize*h);

    const br = w*0.016*(1+bass*0.3);
    ctx.shadowColor = `rgb(${rL},${gL},${bL})`; ctx.shadowBlur = (22+bass*22)*gl;
    ctx.fillStyle   = `rgb(${rL},${gL},${bL})`;
    ctx.beginPath(); ctx.arc(st.bx*w,st.by*h,br,0,6.28); ctx.fill(); ctx.shadowBlur = 0;

    for (const s of st.sparks) {
        s.x += s.vx; s.y += s.vy; s.life -= dt*2.5;
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${s.life})`; ctx.fillRect(s.x*w,s.y*h,3,3);
    }
    st.sparks = st.sparks.filter(s => s.life > 0);

    ctx.textAlign = "center";
    ctx.font = `bold ${h*0.1|0}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(${rL},${gL},${bL},0.9)`; ctx.fillText(st.score.L, w*0.3, h*0.1);
    ctx.fillStyle = `rgba(${rR},${gR},${bR},0.9)`; ctx.fillText(st.score.R, w*0.7, h*0.1);
    ctx.font = `${h*0.024|0}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(${rL},${gL},${bL},0.2)`; ctx.fillText(`${bpm|0} BPM`, w/2, h*0.95);
    ctx.fillStyle = "rgba(0,0,0,0.1)"; for (let y=0;y<h;y+=3) ctx.fillRect(0,y,w,1);
}
