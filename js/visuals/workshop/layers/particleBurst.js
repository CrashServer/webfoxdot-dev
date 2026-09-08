// ── Particle Burst ────────────────────────────────────────────────────────────
// Fountain / explosion system with physics, trails, lifetime color gradients,
// and bass-triggered burst events. Multiple emitter modes. Mid drives color shift.
// Treble controls drag and size. Trail persisted on offscreen canvas.

const _state = new WeakMap();
const MAX_P  = 2000;

function makeP(cx, cy, speed, spread, hue, treble, gravity, mode) {
    let vx, vy;
    if (mode === 0) {
        // Fountain upward
        const a = -Math.PI/2 + (Math.random()-0.5)*spread*Math.PI;
        const spd = (0.8 + Math.random()*2.2) * speed;
        vx = Math.cos(a)*spd; vy = Math.sin(a)*spd;
    } else if (mode === 1) {
        // Omnidirectional burst
        const a = Math.random()*Math.PI*2;
        const spd = (0.4 + Math.random()*2.6) * speed;
        vx = Math.cos(a)*spd; vy = Math.sin(a)*spd;
    } else {
        // Ring burst
        const a = Math.random()*Math.PI*2;
        const spd = speed * (1.5 + Math.random()*0.5);
        vx = Math.cos(a)*spd; vy = Math.sin(a)*spd;
    }
    return {
        x: cx + (Math.random()-0.5)*8,
        y: cy + (Math.random()-0.5)*8,
        vx, vy,
        life: 0,
        maxLife: 50 + Math.random()*130 | 0,
        hue: (hue + (Math.random()-0.5)*70 + 360) % 360,
        size: 1 + Math.random()*2.5,
        drag: 0.97 - treble*0.03,
    };
}

function ensureTrail(st, w, h) {
    if (!st.trail || st.trail.width !== w || st.trail.height !== h) {
        st.trail    = new OffscreenCanvas(w, h);
        st.trailCtx = st.trail.getContext('2d');
        st.trailCtx.fillStyle = '#000';
        st.trailCtx.fillRect(0, 0, w, h);
    }
}

export const particleBurstParams = () => ({
    hue:       { base: 30,   min: 0,    max: 360,  mod: { source: "" } },
    hueRange:  { base: 60,   min: 0,    max: 180,  mod: { source: "" } },
    gravity:   { base: 0.06, min: -0.3, max: 0.5,  mod: { source: "" } },
    speed:     { base: 2.0,  min: 0.5,  max: 6,    mod: { source: "" } },
    size:      { base: 3.0,  min: 0.5,  max: 8,    mod: { source: "" } },
    spread:    { base: 0.7,  min: 0.1,  max: 1,    mod: { source: "" } },
    emitX:     { base: 0.5,  min: 0,    max: 1,    mod: { source: "" } },
    emitY:     { base: 0.65, min: 0,    max: 1,    mod: { source: "" } },
    mode:      { base: 0,    min: 0,    max: 2,    mod: { source: "" } },
    trailFade: { base: 0.07, min: 0.01, max: 0.5,  mod: { source: "" } },
    spawnRate: { base: 8,    min: 0,    max: 30,   mod: { source: "" } },
    midShift:  { base: 60,   min: 0,    max: 180,  mod: { source: "" } },
});

export function drawParticleBurst(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { particles: [], prevBass: 0, prevMid: 0 }; _state.set(ctx, st); }
    ensureTrail(st, w, h);

    const s      = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;
    const level  = s ? (bass*0.5+mid*0.3+treble*0.2) : 0;

    const hue    = (p.hue + mid * p.midShift) % 360;
    const grav   = p.gravity;
    const speed  = p.speed * (1 + bass*0.5);
    const pSize  = p.size;
    const spread = p.spread;
    const ex     = p.emitX * w;
    const ey     = p.emitY * h;
    const mode   = Math.round(p.mode) % 3;

    // Bass beat — burst
    const beatFired = bass > 0.6 && bass > st.prevBass + 0.14;
    st.prevBass = bass;

    // Continuous spawn
    const cont = Math.round(p.spawnRate + level * 12);
    for (let i = 0; i < cont && st.particles.length < MAX_P; i++) {
        st.particles.push(makeP(ex, ey, speed, spread, hue, treble, grav, mode));
    }

    // Burst
    if (beatFired) {
        const bCount = 50 + Math.round(bass * 60);
        for (let i = 0; i < bCount && st.particles.length < MAX_P; i++) {
            st.particles.push(makeP(ex, ey, speed * 2.5, 1, hue, treble, grav, 1));
        }
    }

    // Fade trail
    const tc = st.trailCtx;
    tc.globalCompositeOperation = 'source-over';
    tc.globalAlpha = 1;
    tc.fillStyle = `rgba(0,0,0,${p.trailFade})`;
    tc.fillRect(0, 0, w, h);

    // Update + draw onto trail
    tc.globalCompositeOperation = 'lighter';
    const keep = [];
    for (let i = 0; i < st.particles.length; i++) {
        const pt = st.particles[i];
        pt.x   += pt.vx;  pt.y   += pt.vy;
        pt.vx  *= pt.drag; pt.vy *= pt.drag;
        pt.vy  += grav;
        pt.life++;
        if (pt.life > pt.maxLife) continue;

        const lifeF = pt.life / pt.maxLife;           // 0→1 over lifetime
        const alpha = (1 - lifeF) * (0.7 + bass*0.3);
        // Color gradient over lifetime: young=bright, old=dark ember
        const ptHue = (pt.hue + lifeF * p.hueRange) % 360;
        const ptLit = 80 - lifeF * 50;
        const ptSize = pSize * pt.size * (1 - lifeF*0.6) * (1 + bass*0.2);

        tc.globalAlpha  = alpha;
        tc.fillStyle    = `hsl(${ptHue},90%,${ptLit}%)`;
        tc.beginPath();
        tc.arc(pt.x, pt.y, Math.max(0.3, ptSize), 0, Math.PI*2);
        tc.fill();

        // Inner bright core
        if (lifeF < 0.3) {
            tc.globalAlpha = (1-lifeF/0.3)*0.7;
            tc.fillStyle   = `hsl(${ptHue+20},100%,95%)`;
            tc.beginPath();
            tc.arc(pt.x, pt.y, Math.max(0.2, ptSize*0.3), 0, Math.PI*2);
            tc.fill();
        }

        keep.push(pt);
    }
    st.particles = keep;
    tc.globalAlpha = 1;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(st.trail, 0, 0);

    // Beat flash on emit point
    if (beatFired || bass > 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const fg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 60+bass*80);
        fg.addColorStop(0, `hsla(${hue},100%,90%,${bass*0.6})`);
        fg.addColorStop(0.4, `hsla(${hue+30},80%,60%,${bass*0.15})`);
        fg.addColorStop(1, `rgba(0,0,0,0)`);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(ex, ey, 60+bass*80, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}
