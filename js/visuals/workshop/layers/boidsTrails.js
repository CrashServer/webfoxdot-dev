// ── Boids Trails ─────────────────────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.BoidsTrails.
// Full flocking simulation (separation, alignment, cohesion) with dual-color
// persistent trails. Left/right halves get different hues. Bass = burst spawn.
// Attraction point follows mid-frequency centroid.

const _st = new WeakMap();
const TAU = Math.PI * 2;

class Boid {
    constructor(x, y, side) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = (Math.random() - 0.5) * 80;
        this.life = 0.8 + Math.random() * 0.2;
        this.age = 0; this.side = side;
        this.pulsePhase = Math.random() * TAU;
    }
}

function limit(vx, vy, max) {
    const spd = Math.sqrt(vx*vx + vy*vy);
    if (spd > max) { return [vx/spd*max, vy/spd*max]; }
    return [vx, vy];
}

export const boidsTrailsParams = () => ({
    count:      { base: 200,  min: 20,  max: 600, step: 10, mod: { source: "" } },
    speed:      { base: 120,  min: 20,  max: 400,           mod: { source: "" } },
    sep:        { base: 25,   min: 5,   max: 80,            mod: { source: "" } }, // separation radius
    sepForce:   { base: 0.5,  min: 0,   max: 2,             mod: { source: "" } },
    align:      { base: 60,   min: 10,  max: 200,           mod: { source: "" } },
    alignForce: { base: 0.3,  min: 0,   max: 2,             mod: { source: "" } },
    cohesion:   { base: 80,   min: 10,  max: 200,           mod: { source: "" } },
    cohForce:   { base: 0.15, min: 0,   max: 1,             mod: { source: "" } },
    attract:    { base: 0.08, min: 0,   max: 0.5,           mod: { source: "" } }, // attraction to centre/audio
    hue:        { base: 195,  min: 0,   max: 360,           mod: { source: "" } }, // left half
    hue2:       { base: 320,  min: 0,   max: 360,           mod: { source: "" } }, // right half
    size:       { base: 2.5,  min: 0.5, max: 8,             mod: { source: "" } },
    glow:       { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:      { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    trail:      { base: 0.04, min: 0,   max: 0.3,           mod: { source: "" } }, // fade per frame
    bgAlpha:    { base: 0.92, min: 0,   max: 1,             mod: { source: "" } },
});

export function drawBoidsTrails(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const maxN    = Math.round(Math.max(20, Math.min(600, p.count ?? 200)));
    const spd     = (p.speed ?? 120) * (1 + bass * (p.pulse ?? 0.6) * 0.5);
    const sepR    = p.sep ?? 25;
    const sepF    = p.sepForce ?? 0.5;
    const aliR    = p.align ?? 60;
    const aliF    = p.alignForce ?? 0.3;
    const cohR    = p.cohesion ?? 80;
    const cohF    = p.cohForce ?? 0.15;
    const attF    = p.attract ?? 0.08;
    const hue     = p.hue ?? 195;
    const hue2    = p.hue2 ?? 320;
    const sz      = (p.size ?? 2.5) * (1 + bass * (p.pulse ?? 0.6) * 0.3);
    const glow    = p.glow ?? 0.6;
    const trail   = p.trail ?? 0.04;
    const bgAlpha = p.bgAlpha ?? 0.92;

    let st = _st.get(ctx);
    if (!st) {
        const boids = [];
        for (let i = 0; i < maxN; i++) {
            const x = Math.random() * w, y = Math.random() * h;
            boids.push(new Boid(x, y, x < w/2 ? 0 : 1));
        }
        st = { boids, prevBass: 0, attX: w/2, attY: h/2, maxN };
        _st.set(ctx, st);
    }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, Math.max(0, t - st.lastT)); st.lastT = t;

    // Grow/shrink population
    while (st.boids.length < maxN) {
        const x = Math.random() * w, y = Math.random() * h;
        st.boids.push(new Boid(x, y, x < w/2 ? 0 : 1));
    }
    if (st.boids.length > maxN) st.boids.length = maxN;

    // Attraction point tracks spectrum centroid (mid)
    let centX = 0, centW = 0;
    if (spectrum) {
        for (let i = 4; i < 20; i++) { centX += i * spectrum[i]; centW += spectrum[i]; }
        if (centW > 0) st.attX = w * (centX / centW / 20);
    }
    st.attY = h/2 + Math.sin(t * 0.3) * h * 0.25 * mid;

    // Bass burst: spawn boids at random position
    if (bass > 0.55 && bass > st.prevBass + 0.1) {
        const burst = Math.ceil(bass * 20);
        for (let i = 0; i < burst; i++) {
            const x = w * 0.2 + Math.random() * w * 0.6;
            const y = h * 0.2 + Math.random() * h * 0.6;
            if (st.boids.length < maxN) st.boids.push(new Boid(x, y, x < w/2 ? 0 : 1));
        }
    }
    st.prevBass = bass;

    // Trail fade
    ctx.fillStyle = `rgba(0,0,0,${trail + bgAlpha * 0.001})`;
    ctx.fillRect(0, 0, w, h);

    // Flocking
    const boids = st.boids;
    const n = boids.length;
    const sepR2 = sepR * sepR, aliR2 = aliR * aliR, cohR2 = cohR * cohR;

    for (let i = 0; i < n; i++) {
        const b = boids[i];
        let sx=0,sy=0,sn=0, ax=0,ay=0,an=0, cx=0,cy=0,cn=0;
        for (let j = 0; j < n; j++) {
            if (i===j) continue;
            const o = boids[j];
            const dx = b.x-o.x, dy = b.y-o.y;
            const d2 = dx*dx+dy*dy;
            if (d2 < sepR2 && d2>0) { const d=Math.sqrt(d2); sx+=dx/d; sy+=dy/d; sn++; }
            if (d2 < aliR2) { ax+=o.vx; ay+=o.vy; an++; }
            if (d2 < cohR2) { cx+=o.x; cy+=o.y; cn++; }
        }
        if (sn) { sx/=sn; sy/=sn; }
        if (an) { ax/=an; ay/=an; }
        if (cn) { cx=cx/cn-b.x; cy=cy/cn-b.y; }
        // Attraction to attractor
        const dax=st.attX-b.x, day=st.attY-b.y;
        const dad=Math.sqrt(dax*dax+day*day)||1;
        b.vx += sx*sepF + ax*aliF + cx*cohF + dax/dad*attF*(1+mid)*spd*0.02;
        b.vy += sy*sepF + ay*aliF + cy*cohF + day/dad*attF*(1+mid)*spd*0.02;
        [b.vx,b.vy] = limit(b.vx,b.vy,spd);
        b.x = (b.x + b.vx*dt + w) % w;
        b.y = (b.y + b.vy*dt + h) % h;
        b.side = b.x < w/2 ? 0 : 1;
        b.pulsePhase += dt * 3;
    }

    // Draw boids
    for (const b of boids) {
        const bHue = b.side === 0 ? hue : hue2;
        const bright = 55 + treble * 30 + bass * (p.pulse??0.6) * 20;
        if (glow > 0.05) { ctx.shadowBlur = glow * 10; ctx.shadowColor = `hsl(${bHue},100%,65%)`; }
        ctx.fillStyle = `hsl(${bHue},90%,${bright}%)`;
        const r = sz * (0.8 + 0.2 * Math.sin(b.pulsePhase));
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw attractor point subtly
    ctx.strokeStyle = `hsla(${(hue+hue2)/2},60%,60%,0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(st.attX, st.attY, 8, 0, TAU); ctx.stroke();
}
