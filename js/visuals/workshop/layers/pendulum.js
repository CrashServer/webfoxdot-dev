// ── Double Pendulum ───────────────────────────────────────────────────────────
// Chaotic double pendulum with a long coloured trail. RK4 integration of the
// exact Lagrangian equations (equal masses / equal arm lengths). Bass kicks
// perturb the angular velocity for chaotic re-seeding without a hard reset.
// Trail colour cycles along hue, encoding elapsed time visually.

const _st = new WeakMap();

function deriv(th1, th2, w1, w2, g, L) {
    const del = th1 - th2;
    const sd = Math.sin(del), cd = Math.cos(del);
    const den = 3 - Math.cos(2 * del);
    const a1 = (-g * (3 * Math.sin(th1) + Math.sin(th1 - 2*th2))
                - 2 * sd * (w2*w2*L + w1*w1*L*cd)) / (L * den);
    const a2 = (2 * sd * (w1*w1*L*2 + 2*g*Math.cos(th1) + w2*w2*L*cd)) / (L * den);
    return [a1, a2];
}

function rk4(th1, th2, w1, w2, g, L, dt) {
    const [a1k1, a2k1] = deriv(th1, th2, w1, w2, g, L);
    const [a1k2, a2k2] = deriv(th1+w1*dt/2, th2+w2*dt/2, w1+a1k1*dt/2, w2+a2k1*dt/2, g, L);
    const [a1k3, a2k3] = deriv(th1+w1*dt/2, th2+w2*dt/2, w1+a1k2*dt/2, w2+a2k2*dt/2, g, L);
    const [a1k4, a2k4] = deriv(th1+w1*dt,   th2+w2*dt,   w1+a1k3*dt,   w2+a2k3*dt,   g, L);
    return [
        th1 + (w1 + (a1k1+2*a1k2+2*a1k3+a1k4)*dt/6) * dt,
        th2 + (w2 + (a2k1+2*a2k2+2*a2k3+a2k4)*dt/6) * dt,
        w1 + (a1k1+2*a1k2+2*a1k3+a1k4) * dt / 6,
        w2 + (a2k1+2*a2k2+2*a2k3+a2k4) * dt / 6,
    ];
}

export const pendulumParams = () => ({
    length:   { base: 0.65,min: 0.15,max: 1.2,           mod: { source: "" } },
    gravity:  { base: 9.8, min: 1,   max: 30,            mod: { source: "" } },
    damping:  { base: 0.0, min: 0,   max: 0.04,          mod: { source: "" } },
    hue:      { base: 180, min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 200, min: 0,   max: 360,           mod: { source: "" } },
    trailLen: { base: 1200,min: 100, max: 3000,step: 100,mod: { source: "" } },
    trailW:   { base: 1.5, min: 0.5, max: 4,             mod: { source: "" } },
    energy:   { base: 0.4, min: 0,   max: 1,             mod: { source: "" } },
    speed:    { base: 3,   min: 0.5, max: 8,             mod: { source: "" } },
    bgFade:   { base: 0.02,min: 0,   max: 0.2,           mod: { source: "" } },
});

export function drawPendulum(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const prevBass = extra?._prevBass ?? 0;
    if (extra) extra._prevBass = bass;

    const L   = p.length  ?? 0.65;
    const g   = p.gravity ?? 9.8;
    const dmp = p.damping ?? 0;
    const hue = p.hue     ?? 180;
    const hueR = p.hueRange ?? 200;
    const maxTrail = Math.round(Math.max(100, p.trailLen ?? 1200));
    const trailW   = p.trailW ?? 1.5;
    const energy   = p.energy ?? 0.4;
    const spd      = p.speed  ?? 3;
    const bgFade   = p.bgFade ?? 0.02;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            th1: Math.PI * 0.9 + Math.random() * 0.2,
            th2: Math.PI * 0.7 + Math.random() * 0.4,
            w1: 0, w2: 0,
            trail: [], // {x,y,age}
            hueOffset: 0,
        };
        _st.set(ctx, st);
    }

    // Bass kick: perturb angular velocity for chaotic re-injection
    if (bass > 0.65 && bass > prevBass + 0.1) {
        st.w1 += (Math.random() - 0.5) * energy * 8;
        st.w2 += (Math.random() - 0.5) * energy * 12;
    }

    // Physics sub-steps
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT) / spd; st.lastT = t;
    const steps = Math.round(spd);
    const armL = Math.min(w, h) * 0.22 * L;
    const pivX = w * 0.5, pivY = h * 0.38;

    for (let s = 0; s < steps; s++) {
        const [nth1, nth2, nw1, nw2] = rk4(st.th1, st.th2, st.w1, st.w2, g, armL / (Math.min(w,h)*0.22), dt);
        st.th1 = nth1;
        st.th2 = nth2;
        st.w1  = nw1  * (1 - dmp);
        st.w2  = nw2  * (1 - dmp);
    }

    // Tip position
    const x1 = pivX + Math.sin(st.th1) * armL;
    const y1 = pivY + Math.cos(st.th1) * armL;
    const x2 = x1   + Math.sin(st.th2) * armL;
    const y2 = y1   + Math.cos(st.th2) * armL;

    st.hueOffset = (st.hueOffset + 0.4) % 360;
    st.trail.push({ x: x2, y: y2, h: st.hueOffset });
    if (st.trail.length > maxTrail) st.trail.splice(0, st.trail.length - maxTrail);

    // Draw
    if (bgFade > 0.001) {
        ctx.fillStyle = `rgba(0,0,0,${bgFade})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    // Trail
    ctx.lineWidth = trailW;
    for (let i = 1; i < st.trail.length; i++) {
        const age  = i / st.trail.length;
        const trHue = (hue + st.trail[i].h / 360 * hueR) % 360;
        ctx.strokeStyle = `hsla(${trHue},90%,${30 + age * 55}%,${age * 0.9})`;
        ctx.beginPath();
        ctx.moveTo(st.trail[i-1].x, st.trail[i-1].y);
        ctx.lineTo(st.trail[i].x,   st.trail[i].y);
        ctx.stroke();
    }

    // Arms (dim)
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);   ctx.lineTo(x2, y2); ctx.stroke();

    // Bob dots
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y2, 4, 0, Math.PI*2); ctx.fill();
}
