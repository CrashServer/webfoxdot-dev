// ── Nuclear Blast ─────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION NuclearExplosionScene (Three.js → Canvas2D).
// Staged explosion: buildup → flash → fireball → mushroom cloud → shockwave rings → fallout.
// Bass = detonate / advance stage. Self-cycles at configurable loop speed.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const STAGES = ['BUILDUP','DETONATION','FIREBALL','MUSHROOM','SHOCKWAVE','FALLOUT'];

function lcg(s) { s=(s*1664525+1013904223)&0x7fffffff; return [s,s/0x7fffffff]; }

export const nuclearBlastParams = () => ({
    hue:       { base: 20,  min: 0,   max: 360,          mod: { source: "" } }, // explosion hue (orange)
    hue2:      { base: 60,  min: 0,   max: 360,          mod: { source: "" } }, // secondary (yellow)
    pulse:     { base: 0.9, min: 0,   max: 1,            mod: { source: "" } },
    scale:     { base: 0.8, min: 0.2, max: 1,            mod: { source: "" } }, // blast radius
    debris:    { base: 0.7, min: 0,   max: 1,            mod: { source: "" } },
    speed:     { base: 1.0, min: 0.2, max: 3,            mod: { source: "" } }, // stage progression
    glow:      { base: 0.9, min: 0,   max: 1,            mod: { source: "" } },
    autoLoop:  { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    bgAlpha:   { base: 0.7, min: 0,   max: 1,            mod: { source: "" } },
    rings:     { base: 5,   min: 2,   max: 10,  step: 1, mod: { source: "" } },
});

export function drawNuclearBlast(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue      = p.hue ?? 20;
    const hue2     = p.hue2 ?? 60;
    const pulse    = p.pulse ?? 0.9;
    const scale    = p.scale ?? 0.8;
    const debris   = p.debris ?? 0.7;
    const speed    = p.speed ?? 1.0;
    const glow     = p.glow ?? 0.9;
    const autoLoop = (p.autoLoop ?? 1) > 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.7;
    const nRings   = Math.round(Math.max(2, Math.min(10, p.rings ?? 5)));

    let st = _st.get(ctx);
    if (!st) {
        st = { stage: 0, stageTime: 0, totalTime: 0, prevBass: 0,
               particles: [], rings: [], clouds: [],
               flashAlpha: 0, fireballR: 0, stemH: 0, capR: 0, seed: 1,
               lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    const cx = w/2, groundY = h * 0.78;
    const maxR = Math.min(w,h) * 0.42 * scale;

    // Bass → trigger detonation or advance stage
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        if (st.stage === 0) {
            st.stage = 1; st.stageTime = 0; // detonate!
        } else if (st.stage >= 2) {
            st.flashAlpha = Math.max(st.flashAlpha, bass * pulse * 0.7);
        }
    }
    st.prevBass = bass;

    // Stage timer
    const stageDur = [999, 0.25, 1.2, 2.5, 3.0, 4.0];
    st.stageTime += dt * speed;
    st.totalTime += dt;

    if (st.stage > 0 && st.stage < STAGES.length - 1 && st.stageTime > stageDur[st.stage]) {
        st.stage++;
        st.stageTime = 0;
        if (st.stage === 2) {
            // Fireball: spawn debris
            if (debris > 0.1) {
                let s = st.seed;
                const nD = Math.floor(debris * 60);
                for (let i = 0; i < nD; i++) {
                    let r1,r2,r3;
                    [s,r1]=lcg(s);[s,r2]=lcg(s);[s,r3]=lcg(s);
                    const ang = r1*TAU;
                    const spd = 80 + r2*200;
                    st.particles.push({x:cx,y:groundY,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-150,
                                       life:1+r3,size:2+r2*4,hue:hue+r3*60});
                }
                st.seed = s;
            }
        }
        if (st.stage === 4) {
            // Shockwave rings
            st.rings = [];
            for (let i = 0; i < nRings; i++) {
                st.rings.push({ r: 5, speed: 60 + i * 20, life: 1, delay: i * 0.12 });
            }
        }
        if (st.stage === 5) {
            // Fallout clouds
            st.clouds = [];
            for (let i = 0; i < 12; i++) {
                st.clouds.push({
                    x: cx + (Math.random()-0.5)*maxR*1.5,
                    y: groundY - Math.random()*h*0.5,
                    r: 15+Math.random()*35,
                    vx: (Math.random()-0.5)*20,
                    vy: -10-Math.random()*20,
                    life: 1, alpha: 0,
                });
            }
        }
    }

    // Auto-loop back to buildup
    if (autoLoop && st.stage === 5 && st.stageTime > stageDur[5]) {
        st.stage = 0; st.stageTime = 0;
        st.particles = []; st.rings = []; st.clouds = [];
        st.fireballR = 0; st.stemH = 0; st.capR = 0;
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Ground line
    ctx.strokeStyle = `hsla(${hue},30%,20%,0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

    // ── STAGE 0: Buildup — pulsing energy orb on ground
    if (st.stage === 0) {
        const r = 8 + Math.sin(t*4)*4 + bass*pulse*20;
        if (glow>0.05){ctx.shadowBlur=glow*25;ctx.shadowColor=`hsl(${hue2},100%,70%)`;}
        ctx.fillStyle = `hsl(${hue2},90%,${40+treble*30}%)`;
        ctx.beginPath(); ctx.arc(cx, groundY, r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── STAGE 1: Flash
    if (st.stage === 1) {
        st.flashAlpha = Math.max(st.flashAlpha, 1 - st.stageTime * 4);
    }

    // ── STAGE 2+: Fireball
    if (st.stage >= 2) {
        const targetR = maxR * Math.min(1, (st.stage >= 3 ? 1 : st.stageTime / stageDur[2]) * (1 + bass*pulse*0.15));
        st.fireballR += (targetR - st.fireballR) * dt * 3;
        if (glow>0.05){ctx.shadowBlur=glow*40;ctx.shadowColor=`hsl(${hue},100%,60%)`;}
        const fbGrad = ctx.createRadialGradient(cx,groundY-st.fireballR*0.3,0, cx,groundY-st.fireballR*0.3,st.fireballR);
        fbGrad.addColorStop(0, `hsla(${hue2},100%,${80+treble*20}%,1)`);
        fbGrad.addColorStop(0.4, `hsla(${hue},90%,55%,0.9)`);
        fbGrad.addColorStop(0.75, `hsla(${hue-10},70%,30%,0.6)`);
        fbGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fbGrad;
        ctx.beginPath(); ctx.arc(cx, groundY - st.fireballR*0.3, st.fireballR, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── STAGE 3+: Mushroom stem + cap
    if (st.stage >= 3) {
        const stemTarget = h * 0.55 * Math.min(1, st.stageTime / stageDur[3]);
        st.stemH += (stemTarget - st.stemH) * dt * 2;
        const stemW = maxR * 0.12 + mid * maxR * 0.05;
        const capTarget = maxR * 0.7 * Math.min(1, st.stageTime / stageDur[3]);
        st.capR += (capTarget - st.capR) * dt * 2;

        // Stem
        const stemGrad = ctx.createLinearGradient(cx-stemW,0, cx+stemW,0);
        stemGrad.addColorStop(0,'rgba(0,0,0,0)');
        stemGrad.addColorStop(0.5,`hsla(${hue},70%,35%,0.7)`);
        stemGrad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = stemGrad;
        ctx.fillRect(cx-stemW, groundY-st.stemH, stemW*2, st.stemH);

        // Cap
        if (st.capR > 5 && glow>0.05) { ctx.shadowBlur=glow*30; ctx.shadowColor=`hsl(${hue},100%,60%)`; }
        const capGrad = ctx.createRadialGradient(cx,groundY-st.stemH,0, cx,groundY-st.stemH,st.capR);
        capGrad.addColorStop(0,`hsla(${hue2},90%,${60+treble*25}%,0.95)`);
        capGrad.addColorStop(0.5,`hsla(${hue},80%,40%,0.8)`);
        capGrad.addColorStop(0.85,`hsla(${hue-15},60%,25%,0.5)`);
        capGrad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = capGrad;
        ctx.beginPath();
        ctx.ellipse(cx, groundY-st.stemH, st.capR, st.capR*0.55, 0, Math.PI, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── STAGE 4+: Shockwave rings
    for (const ring of st.rings) {
        ring.delay -= dt;
        if (ring.delay > 0) continue;
        ring.r += ring.speed * dt * (1 + bass*0.3);
        ring.life -= dt * 0.5;
        if (ring.life <= 0) continue;
        if (glow>0.05){ctx.shadowBlur=glow*12;ctx.shadowColor=`hsl(${hue2},100%,60%)`;}
        ctx.strokeStyle = `hsla(${hue2},90%,65%,${ring.life*0.6})`;
        ctx.lineWidth = 3 * ring.life;
        ctx.beginPath(); ctx.ellipse(cx, groundY, ring.r, ring.r*0.3, 0, 0, TAU); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── Debris particles
    for (const pk of st.particles) {
        pk.x += pk.vx*dt; pk.y += pk.vy*dt;
        pk.vy += 120*dt; // gravity
        pk.life -= dt;
        if (pk.y > groundY) { pk.vy *= -0.4; pk.y = groundY; }
        ctx.fillStyle = `hsla(${pk.hue},80%,55%,${Math.max(0,pk.life)})`;
        ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.size, 0, TAU); ctx.fill();
    }
    st.particles = st.particles.filter(pk => pk.life > 0);

    // ── STAGE 5: Fallout clouds
    for (const cl of st.clouds) {
        cl.x += cl.vx*dt; cl.y += cl.vy*dt;
        cl.vy *= 0.98;
        cl.alpha = Math.min(0.5, cl.alpha + dt*0.4);
        cl.life -= dt * 0.15;
        if (cl.life <= 0) continue;
        ctx.fillStyle = `hsla(${hue-10},30%,20%,${cl.alpha*cl.life})`;
        ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, 0, TAU); ctx.fill();
    }

    // ── Flash overlay
    st.flashAlpha *= 0.9;
    if (st.flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(255,220,180,${st.flashAlpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    // ── Stage label
    ctx.font = '9px monospace';
    ctx.fillStyle = `hsla(${hue},80%,60%,0.5)`;
    ctx.fillText(`STAGE: ${STAGES[st.stage]}`, 8, h-10);
}
