// ── Boids Trails layer ────────────────────────────────────────────────────
// Full Reynolds flocking: separation, alignment, cohesion + optional predator.
// Two hue cohorts. Trails persist via alpha fade. Bass = size pulse,
// mid = cohesion strength, treble = scatter/flee speed.

const _state = new WeakMap();

// Pre-rendered glow sprites keyed by (hue-bucket, radius-bucket) — avoids
// createRadialGradient per boid every frame (300 allocations → ~4 drawImage calls).
const _glowCache = new Map();
function _glowSprite(hue, sat, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(4, Math.round(radius / 3) * 3);
    const key = `${hb}_${Math.round(sat)}_${rb}`;
    if (_glowCache.has(key)) return _glowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},${Math.round(sat)}%,70%)`);
    g.addColorStop(1, 'transparent');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _glowCache.set(key, gc);
    return gc;
}

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

class Swarm {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.boids = [];
        this.predX = w * 0.5; this.predY = h * 0.5;
        this.predVx = 0; this.predVy = 0;
        this.tick = 0;
    }

    _spawn(w, h, p) {
        const edge = Math.random() * 4 | 0;
        let x, y;
        if (edge === 0) { x = 0; y = Math.random()*h; }
        else if (edge === 1) { x = w; y = Math.random()*h; }
        else if (edge === 2) { x = Math.random()*w; y = 0; }
        else { x = Math.random()*w; y = h; }
        const spd = Math.min(w,h) * 0.003 * p.speed;
        const ang = Math.atan2(h/2 - y, w/2 - x) + (Math.random()-0.5)*1.2;
        this.boids.push({
            x, y,
            vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
            cohort: Math.random() < 0.5 ? 0 : 1,
            age: 0,
            ph: Math.random()*6.28,
        });
    }

    update(ctx, w, h, p, bass, mid, treble, _pal, pC, t = 0) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        const maxCount   = Math.max(10, Math.round(p.count));
        const maxSpd     = Math.min(w,h) * 0.004 * p.speed * (1 + treble * 1.5);
        const minSpd     = maxSpd * 0.3;
        const sepR       = Math.min(w,h) * 0.018 * p.separation;
        const aliR       = Math.min(w,h) * 0.06 * p.alignment;
        const cohR       = Math.min(w,h) * 0.12;
        const cohFactor  = 0.0004 * p.cohesion * (1 + mid * 2);
        const predMode   = p.predator > 0.5;
        const predR      = Math.min(w,h) * 0.12;
        const fleeStr    = p.predator * 2;
        const lifetime   = p.lifetime;

        // Trail fade
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(0,0,0,${p.trailFade})`;
        ctx.fillRect(0, 0, w, h);

        // Spawn
        const spawnAcc = p.spawnRate * dt + bass * 3 * dt;
        const toSpawn = Math.min(5, spawnAcc * 30 | 0);
        for (let k = 0; k < toSpawn && this.boids.length < maxCount; k++) this._spawn(w, h, p);

        // Move predator (wanders with sin/cos lissajous)
        if (predMode) {
            this.tick += dt;
            const tx = w * (0.5 + 0.35 * Math.sin(this.tick * 0.4));
            const ty = h * (0.5 + 0.35 * Math.sin(this.tick * 0.31 + 1));
            this.predVx += (tx - this.predX) * 0.002;
            this.predVy += (ty - this.predY) * 0.002;
            this.predVx *= 0.95; this.predVy *= 0.95;
            this.predX += this.predVx; this.predY += this.predVy;
        }

        for (let bi = 0; bi < this.boids.length; bi++) {
            const b = this.boids[bi];
            let sx=0,sy=0, ax=0,ay=0, cx2=0,cy2=0, na=0;

            for (let oi = 0; oi < this.boids.length; oi++) {
                if (oi === bi) continue;
                const o = this.boids[oi];
                const dx = b.x-o.x, dy = b.y-o.y;
                const d2 = dx*dx + dy*dy;
                if (d2 < sepR*sepR && d2 > 0.01) { const d=Math.sqrt(d2); sx+=dx/d; sy+=dy/d; }
                if (d2 < aliR*aliR) { ax+=o.vx; ay+=o.vy; na++; }
                if (d2 < cohR*cohR) { cx2+=o.x; cy2+=o.y; }
            }

            b.vx += sx * 0.6;
            b.vy += sy * 0.6;
            if (na > 0) {
                b.vx += (ax/na - b.vx) * 0.025;
                b.vy += (ay/na - b.vy) * 0.025;
                b.vx += (cx2/na - b.x) * cohFactor;
                b.vy += (cy2/na - b.y) * cohFactor;
            }

            // Center attraction
            b.vx += (w/2 - b.x) * 0.0003 * p.attract;
            b.vy += (h/2 - b.y) * 0.0003 * p.attract;

            // Predator flee
            if (predMode) {
                const pdx = b.x - this.predX, pdy = b.y - this.predY;
                const pd2 = pdx*pdx + pdy*pdy;
                if (pd2 < predR*predR && pd2 > 0.01) {
                    const pd = Math.sqrt(pd2);
                    b.vx += (pdx/pd) * fleeStr * (1-pd/predR) * 3;
                    b.vy += (pdy/pd) * fleeStr * (1-pd/predR) * 3;
                }
            }

            // Speed clamp
            const sp = Math.hypot(b.vx, b.vy) || 1;
            const cl = Math.max(minSpd, Math.min(maxSpd, sp));
            b.vx = b.vx/sp*cl; b.vy = b.vy/sp*cl;
            b.x += b.vx; b.y += b.vy;
            b.age += dt; b.ph += dt * 4;

            // Wrap
            const m = Math.min(w,h)*0.04;
            if (b.x < -m) b.x=w+m; if (b.x > w+m) b.x=-m;
            if (b.y < -m) b.y=h+m; if (b.y > h+m) b.y=-m;
        }
        this.boids = this.boids.filter(b => b.age < lifetime);

        // Draw boids
        const hueA = p.hueA, hueB = p.hueB;
        const sizeMul = 1 + bass * p.bassPulse;
        const totalBoids = this.boids.length;

        for (let bi = 0; bi < totalBoids; bi++) {
            const b = this.boids[bi];
            const life = Math.min(1, 1 - b.age/lifetime);
            const pulse = 0.75 + 0.25*Math.sin(b.ph);
            const r = Math.min(w,h) * 0.0028 * p.size * sizeMul * pulse;
            const hue = b.cohort === 0 ? hueA : hueB;
            const sat = 70 + mid * 20;
            // Palette: color by boid index position in swarm
            const boidCol = _pal ? pC(bi / Math.max(1, totalBoids)) : null;

            // Glow — pre-rendered sprite avoids per-boid createRadialGradient
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.25 * life;
            if (boidCol) {
                // Palette mode: fall back to simple arc at low alpha (palettes change per frame)
                ctx.fillStyle = boidCol;
                ctx.beginPath(); ctx.arc(b.x, b.y, r*5, 0, 6.2832); ctx.fill();
            } else {
                const gs = _glowSprite(hue, sat, r * 5);
                ctx.drawImage(gs, b.x - gs.width/2, b.y - gs.height/2);
            }
            ctx.globalAlpha = 1;

            // Core
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = boidCol ?? `hsla(${hue},${sat}%,75%,${life})`;
            ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(0.8, r), 0, 6.2832); ctx.fill();

            // Direction tick
            const ang = Math.atan2(b.vy, b.vx);
            ctx.strokeStyle = boidCol ?? `hsla(${hue},${sat}%,90%,${life*0.6})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x + Math.cos(ang)*r*3, b.y + Math.sin(ang)*r*3);
            ctx.stroke();
        }

        // Draw predator
        if (predMode) {
            ctx.globalCompositeOperation = "lighter";
            const pg = ctx.createRadialGradient(this.predX, this.predY, 0, this.predX, this.predY, 20);
            pg.addColorStop(0, `rgba(255,60,60,0.6)`);
            pg.addColorStop(1, `rgba(255,0,0,0)`);
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(this.predX, this.predY, 20, 0, 6.2832); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const boidsParams = () => ({
    count:      { base: 300,  min: 20,   max: 800,  mod: { source: "" } },
    speed:      { base: 1.2,  min: 0.2,  max: 4,    mod: { source: "" } },
    size:       { base: 1.2,  min: 0.2,  max: 5,    mod: { source: "" } },
    attract:    { base: 1,    min: 0,    max: 4,    mod: { source: "" } },
    separation: { base: 1.2,  min: 0.1,  max: 5,    mod: { source: "" } },
    alignment:  { base: 1,    min: 0.1,  max: 4,    mod: { source: "" } },
    cohesion:   { base: 1,    min: 0,    max: 4,    mod: { source: "" } },
    spawnRate:  { base: 8,    min: 0.5,  max: 40,   mod: { source: "" } },
    lifetime:   { base: 12,   min: 2,    max: 40,   mod: { source: "" } },
    trailFade:  { base: 0.06, min: 0.005,max: 0.5,  mod: { source: "" } },
    hueA:       { base: 200,  min: 0,    max: 360,  mod: { source: "" } },
    hueB:       { base: 340,  min: 0,    max: 360,  mod: { source: "" } },
    bassPulse:  { base: 1.5,  min: 0,    max: 4,    mod: { source: "" } },
    predator:   { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
    usePalette: { base: 0,   min: 0,    max: 1,    mod: { source: "" } },
});

export function drawBoids(ctx, w, h, p, t, extra) {
    let swarm = _state.get(ctx);
    if (!swarm || swarm.w !== w || swarm.h !== h) {
        swarm = new Swarm(w, h);
        _state.set(ctx, swarm);
    }
    const s = extra?.spectrum;
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    swarm.update(ctx, w, h, p, bassLevel(s), midLevel(s), trebleLevel(s), _pal, pC, t);
}
