// ── CRIC Bombing (Top-View) ───────────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.BombingTopView.
// Top-down aerial view: bombs fall, explode with shockwave rings, smoke, debris.
// Bass drops new bombs. Craters persist, smoke and fire fade.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function lcg(s) { return (s * 1664525 + 1013904223) & 0x7fffffff; }

class Shockwave {
    constructor(x, y, intensity) {
        this.x = x; this.y = y; this.intensity = intensity;
        this.radius = 0; this.life = 1; this.age = 0;
    }
}
class Crater {
    constructor(x, y, r) { this.x = x; this.y = y; this.r = r; this.life = 1; }
}
class Particle {
    constructor(x, y, vx, vy, life, kind) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.kind = kind; // 'fire'|'smoke'|'debris'
        this.r = kind === 'smoke' ? 6 + Math.random()*8 : 2 + Math.random()*3;
    }
}
class Bomb {
    constructor(x, y, intensity) {
        this.x = x; this.y = y; this.intensity = intensity;
        this.vy = 80 + Math.random() * 80; this.life = 1; this.exploded = false;
    }
}

function explode(st, x, y, intensity, w, h) {
    if (st.shockwaves.length < 50) st.shockwaves.push(new Shockwave(x, y, intensity));
    if (st.craters.length < 80) st.craters.push(new Crater(x, y, 8 + 18 * intensity));
    const n = Math.floor(30 * intensity);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = 60 + Math.random() * 160;
        if (st.particles.length < 1500)
            st.particles.push(new Particle(x, y, Math.cos(a)*sp, Math.sin(a)*sp, 0.6 + Math.random()*0.4, 'fire'));
    }
    for (let i = 0; i < Math.floor(n * 0.6); i++) {
        const a = Math.random() * TAU, sp = 20 + Math.random() * 60;
        if (st.particles.length < 1500)
            st.particles.push(new Particle(x, y, Math.cos(a)*sp, Math.sin(a)*sp - 30, 1 + Math.random(), 'smoke'));
    }
    for (let i = 0; i < Math.floor(n * 0.4); i++) {
        const a = Math.random() * TAU, sp = 100 + Math.random() * 200;
        if (st.particles.length < 1500)
            st.particles.push(new Particle(x, y, Math.cos(a)*sp, Math.sin(a)*sp, 0.3 + Math.random()*0.3, 'debris'));
    }
}

export const cricBombingParams = () => ({
    rate:      { base: 0.3,  min: 0,   max: 1,           mod: { source: "" } }, // bombs per second (passive)
    intensity: { base: 0.7,  min: 0.1, max: 1,           mod: { source: "" } },
    pulse:     { base: 0.8,  min: 0,   max: 1,           mod: { source: "" } }, // bass reactivity
    hue:       { base: 30,   min: 0,   max: 360,         mod: { source: "" } }, // fire hue
    mapHue:    { base: 200,  min: 0,   max: 360,         mod: { source: "" } }, // map/ground tint
    glow:      { base: 0.6,  min: 0,   max: 1,           mod: { source: "" } },
    smoke:     { base: 0.7,  min: 0,   max: 1,           mod: { source: "" } },
    bgAlpha:   { base: 0.92, min: 0,   max: 1,           mod: { source: "" } },
    grid:      { base: 1,    min: 0,   max: 1,  step: 1, mod: { source: "" } }, // show map grid
    zoom:      { base: 1.0,  min: 0.5, max: 3,           mod: { source: "" } },
});

export function drawCricBombing(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const rate     = p.rate ?? 0.3;
    const intens   = p.intensity ?? 0.7;
    const pulse    = p.pulse ?? 0.8;
    const hue      = p.hue ?? 30;
    const mapHue   = p.mapHue ?? 200;
    const glow     = p.glow ?? 0.6;
    const smokeAmt = p.smoke ?? 0.7;
    const bgAlpha  = p.bgAlpha ?? 0.92;
    const showGrid = (p.grid ?? 1) > 0.5;
    const zoom     = p.zoom ?? 1.0;

    let st = _st.get(ctx);
    if (!st) {
        st = { bombs: [], shockwaves: [], craters: [], particles: [], lastT: t,
               seed: 1, bombTimer: 0, prevBass: 0, cameraShake: 0 };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Camera shake on bass hit
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        st.cameraShake = bass * pulse * 12;
        // Drop bomb on bass hit
        const bx = w * (0.1 + Math.random() * 0.8);
        const by = h * (0.1 + Math.random() * 0.8);
        if (st.bombs.length < 20) st.bombs.push(new Bomb(bx, by, intens * (0.6 + bass * 0.4)));
    }
    st.prevBass = bass;
    st.cameraShake *= 0.85;

    // Passive bomb drops
    st.bombTimer += dt;
    const bombInterval = rate > 0.01 ? 1 / (rate * (2 + bass * pulse * 3)) : Infinity;
    if (st.bombTimer > bombInterval) {
        st.bombTimer = 0;
        const bx = w * (0.05 + Math.random() * 0.9);
        const by = -10;
        if (st.bombs.length < 20) st.bombs.push(new Bomb(bx, by, intens * (0.4 + Math.random() * 0.6)));
    }

    ctx.save();
    const sx = st.cameraShake * (Math.random() - 0.5) * 2;
    const sy = st.cameraShake * (Math.random() - 0.5) * 2;
    ctx.translate(sx, sy);

    // Background — dark tactical map
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(-sx-2, -sy-2, w+4, h+4);

    // Map grid
    if (showGrid) {
        const gs = Math.floor(Math.min(w, h) / 12 * zoom);
        ctx.strokeStyle = `hsla(${mapHue},40%,15%,0.4)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
    }

    // Craters
    for (const c of st.craters) {
        ctx.fillStyle = `hsla(${mapHue},20%,8%,${c.life * 0.8})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
        // Crater ring
        ctx.strokeStyle = `hsla(${mapHue},30%,20%,${c.life * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.2, 0, TAU); ctx.stroke();
        c.life -= dt * 0.02; // craters persist a long time
    }

    // Shockwaves
    for (const sw of st.shockwaves) {
        sw.age += dt;
        sw.radius += dt * 180 * sw.intensity;
        sw.life = Math.max(0, 1 - sw.age / 2);

        // Multiple rings
        for (let ring = 0; ring < 3; ring++) {
            const r = sw.radius - ring * 15;
            if (r <= 0) continue;
            const ringLife = sw.life * (1 - ring * 0.25);
            ctx.strokeStyle = `hsla(${hue + ring*20},90%,${70 - ring*15}%,${ringLife * 0.8})`;
            ctx.lineWidth = (3 - ring * 0.8) * sw.intensity;
            if (glow > 0.05) {
                ctx.shadowBlur = glow * 20 * ringLife;
                ctx.shadowColor = `hsl(${hue},100%,70%)`;
            }
            ctx.beginPath(); ctx.arc(sw.x, sw.y, r, 0, TAU); ctx.stroke();
        }
        ctx.shadowBlur = 0;
    }

    // Particles (fire, smoke, debris)
    for (const par of st.particles) {
        par.x += par.vx * dt;
        par.y += par.vy * dt;
        if (par.kind !== 'smoke') par.vy += 40 * dt; // gravity for fire/debris
        par.life -= dt / par.maxLife;

        const a = Math.max(0, par.life);
        if (par.kind === 'fire') {
            const fhue = hue - a * 30;
            const r = par.r * a;
            if (glow > 0.05) { ctx.shadowBlur = glow * 10; ctx.shadowColor = `hsl(${fhue},100%,65%)`; }
            ctx.fillStyle = `hsla(${fhue},95%,${40 + a * 40}%,${a * 0.9})`;
            ctx.beginPath(); ctx.arc(par.x, par.y, r, 0, TAU); ctx.fill();
        } else if (par.kind === 'smoke' && smokeAmt > 0.05) {
            par.r += dt * 4;
            ctx.fillStyle = `rgba(60,55,50,${a * smokeAmt * 0.25})`;
            ctx.beginPath(); ctx.arc(par.x, par.y, par.r, 0, TAU); ctx.fill();
        } else if (par.kind === 'debris') {
            ctx.fillStyle = `rgba(180,140,90,${a * 0.8})`;
            ctx.fillRect(par.x - 1, par.y - 1, 3, 3);
        }
    }
    ctx.shadowBlur = 0;

    // Falling bombs
    for (const b of st.bombs) {
        b.y += b.vy * dt;
        if (b.y >= 0 && b.y < h && !b.exploded) {
            // White streak
            ctx.strokeStyle = `rgba(255,240,200,0.6)`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(b.x, b.y - 20); ctx.lineTo(b.x, b.y); ctx.stroke();
            // Bomb dot
            ctx.fillStyle = `rgba(255,200,100,0.9)`;
            ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill();
        }
        if (!b.exploded && b.y > -50 && b.y < h * 1.1 && b.x > -50 && b.x < w * 1.1) {
            const cx = w / 2, cy = h / 2;
            const dx = b.x - cx, dy = b.y - cy;
            if (Math.sqrt(dx*dx + dy*dy) < Math.min(w, h) * 0.55) {
                // In-bounds: explode when it hits "ground level"
                if (b.y > h * 0.1) {
                    b.exploded = true;
                    explode(st, b.x, b.y, b.intensity, w, h);
                    // Flash
                    ctx.fillStyle = `rgba(255,200,100,${b.intensity * 0.6})`;
                    ctx.fillRect(-sx-2, -sy-2, w+4, h+4);
                }
            }
        }
    }

    // Flash overlay on very high bass
    if (bass > 0.8) {
        ctx.fillStyle = `rgba(255,140,0,${(bass - 0.8) * pulse * 0.3})`;
        ctx.fillRect(-sx-2, -sy-2, w+4, h+4);
    }

    ctx.restore();

    // Cleanup dead objects
    st.shockwaves = st.shockwaves.filter(s => s.life > 0.01);
    st.craters    = st.craters.filter(c => c.life > 0.01);
    st.particles  = st.particles.filter(p => p.life > 0.01);
    st.bombs      = st.bombs.filter(b => !b.exploded && b.y < h + 50);
}
