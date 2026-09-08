// ── Evolution Playground ──────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION EvolutionPlaygroundScene.
// Creatures with genes (size, speed, hue, aggression) eat food, reproduce,
// mutate, and die. Predators hunt prey. Bass = food burst. Mid = hazard event.

const _st = new WeakMap();

// Pre-rendered glow sprites avoid createRadialGradient per food/creature every frame
const _evoGlowCache = new Map();
function _evoGlow(hue, sat, lit, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(4, Math.round(radius / 3) * 3);
    const key = `${hb}_${sat}_${lit}_${rb}`;
    if (_evoGlowCache.has(key)) return _evoGlowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},${sat}%,${lit}%)`);
    g.addColorStop(1, 'transparent');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _evoGlowCache.set(key, gc);
    return gc;
}

const PRED_SHAPES = ['▲','◆','★','✦'];
const PREY_SHAPES = ['●','○','◉','◦'];

function randGene() {
    return {
        size:       6 + Math.random() * 14,
        speed:      0.3 + Math.random() * 1.4,
        hue:        Math.random() * 360,
        aggression: Math.random(),     // >0.6 → predator behaviour
        energy:     60 + Math.random() * 40,
        age:        0,
        x:          0, y: 0,
        vx:         0, vy: 0,
        target:     null,
        glyph:      '',
        id:         Math.random(),
    };
}

function spawnCreature(w, h, isPred) {
    const g = randGene();
    g.x = Math.random() * w; g.y = Math.random() * h;
    g.vx = (Math.random()-0.5) * g.speed * 20;
    g.vy = (Math.random()-0.5) * g.speed * 20;
    if (isPred != null) g.aggression = isPred ? 0.8 + Math.random()*0.2 : Math.random()*0.55;
    g.glyph = g.aggression > 0.6
        ? PRED_SHAPES[Math.floor(Math.random()*PRED_SHAPES.length)]
        : PREY_SHAPES[Math.floor(Math.random()*PREY_SHAPES.length)];
    return g;
}

function spawnFood(w, h) {
    return { x: Math.random()*w, y: Math.random()*h, hue: 80+Math.random()*60, size: 3+Math.random()*3 };
}

export const evolutionPlaygroundParams = () => ({
    population:  { base: 0.4, min: 0, max: 1,   mod: { source: "" } },
    mutationRate:{ base: 0.3, min: 0, max: 1,   mod: { source: "" } },
    foodRate:    { base: 0.5, min: 0, max: 1,   mod: { source: "" } },
    predators:   { base: 0.3, min: 0, max: 1,   mod: { source: "" } }, // fraction that are predators
    speed:       { base: 0.6, min: 0, max: 2,   mod: { source: "" } },
    trails:      { base: 0.5, min: 0, max: 1,   mod: { source: "" } }, // trail alpha on bg fade
    pulse:       { base: 0.8, min: 0, max: 1,   mod: { source: "" } },
    bgAlpha:     { base: 0.85,min: 0, max: 1,   mod: { source: "" } },
});

export function drawEvolutionPlayground(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const popParam   = p.population ?? 0.4;
    const mutRate    = p.mutationRate ?? 0.3;
    const foodRate   = p.foodRate ?? 0.5;
    const predFrac   = p.predators ?? 0.3;
    const speed      = p.speed ?? 0.6;
    const trails     = p.trails ?? 0.5;
    const pulse      = p.pulse ?? 0.8;
    const bgAlpha    = p.bgAlpha ?? 0.85;

    const maxPop  = Math.max(4, Math.round(popParam * 50));
    const maxFood = Math.max(5, Math.round(foodRate * 40));

    let st = _st.get(ctx);
    if (!st) {
        const n = Math.max(4, Math.round(popParam * 20));
        const creatures = [];
        for (let i = 0; i < n; i++) creatures.push(spawnCreature(w, h, i < n * predFrac));
        st = { creatures, food: Array.from({length:8}, ()=>spawnFood(w,h)), prevBass: 0, prevMid: 0, gen: 1 };
        _st.set(ctx, st);
    }

    // ── Background fade (trails)
    ctx.fillStyle = `rgba(0,2,8,${bgAlpha * (0.5 + trails * 0.5)})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT) * speed; st.lastT = t;

    // ── Spawn food
    const wantFood = Math.floor(maxFood * (1 + bass * 0.5));
    if (st.food.length < wantFood) st.food.push(spawnFood(w, h));
    // Bass burst
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        const n = Math.floor(bass * pulse * 8);
        for (let i = 0; i < n; i++) st.food.push(spawnFood(w, h));
    }
    // Mid hazard: kill some food
    if (mid > 0.6 && mid > st.prevMid + 0.1) {
        st.food.splice(0, Math.floor(mid * 5));
    }
    st.prevBass = bass; st.prevMid = mid;

    // ── Draw food
    ctx.font = '10px monospace';
    for (const f of st.food) {
        const gs = _evoGlow(f.hue, 90, 70, f.size * 2);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(gs, f.x - gs.width/2, f.y - gs.height/2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `hsl(${f.hue},90%,70%)`;
        ctx.fillText('✦', f.x - 4, f.y + 4);
    }

    // ── Update + draw creatures
    const newCreatures = [];
    for (let ci = 0; ci < st.creatures.length; ci++) {
        const c = st.creatures[ci];
        const isPred = c.aggression > 0.6;
        c.age += dt * 0.5;
        c.energy -= dt * (1 + c.size * 0.05 + c.speed * 0.1);

        // Target: predator → nearest prey, prey → nearest food
        if (!isPred) {
            let best = null, bd = Infinity;
            for (const f of st.food) {
                const d = Math.hypot(f.x-c.x, f.y-c.y);
                if (d < bd) { bd = d; best = f; }
            }
            c.target = best;
        } else {
            let best = null, bd = Infinity;
            for (const other of st.creatures) {
                if (other === c || other.aggression > 0.6) continue;
                const d = Math.hypot(other.x-c.x, other.y-c.y);
                if (d < bd) { bd = d; best = other; }
            }
            c.target = best;
        }

        // Steer toward target
        if (c.target) {
            const tx = c.target.x - c.x, ty = c.target.y - c.y;
            const d = Math.hypot(tx, ty) + 0.01;
            c.vx += (tx/d) * c.speed * 4 * dt;
            c.vy += (ty/d) * c.speed * 4 * dt;
        } else {
            // Wander
            c.vx += (Math.random()-0.5) * 2 * dt;
            c.vy += (Math.random()-0.5) * 2 * dt;
        }

        // Speed limit
        const spd2 = Math.hypot(c.vx, c.vy);
        const maxSpd = c.speed * 60;
        if (spd2 > maxSpd) { c.vx *= maxSpd/spd2; c.vy *= maxSpd/spd2; }

        c.x = (c.x + c.vx * dt + w) % w;
        c.y = (c.y + c.vy * dt + h) % h;

        // Eat food
        for (let fi = st.food.length-1; fi >= 0; fi--) {
            const f = st.food[fi];
            if (Math.hypot(f.x-c.x, f.y-c.y) < c.size + f.size) {
                c.energy = Math.min(100, c.energy + 25);
                st.food.splice(fi, 1);
                break;
            }
        }

        // Predation
        if (isPred) {
            for (let oi = st.creatures.length-1; oi >= 0; oi--) {
                const other = st.creatures[oi];
                if (other === c || other.aggression > 0.6) continue;
                if (Math.hypot(other.x-c.x, other.y-c.y) < c.size * 0.8) {
                    c.energy = Math.min(100, c.energy + 30);
                    st.creatures.splice(oi, 1);
                    break;
                }
            }
        }

        // Reproduction
        if (c.energy > 80 && st.creatures.length < maxPop && newCreatures.length < 3) {
            c.energy -= 40;
            const child = { ...c, id: Math.random(), age: 0, energy: 40 };
            if (Math.random() < mutRate) {
                child.hue       = (child.hue + (Math.random()-0.5)*60 + 360) % 360;
                child.speed     = Math.max(0.2, child.speed + (Math.random()-0.5)*0.3);
                child.size      = Math.max(4, child.size + (Math.random()-0.5)*4);
                child.aggression= Math.max(0, Math.min(1, child.aggression + (Math.random()-0.5)*0.3));
                child.glyph = child.aggression > 0.6
                    ? PRED_SHAPES[Math.floor(Math.random()*PRED_SHAPES.length)]
                    : PREY_SHAPES[Math.floor(Math.random()*PREY_SHAPES.length)];
                st.gen++;
            }
            child.x = c.x + (Math.random()-0.5)*20;
            child.y = c.y + (Math.random()-0.5)*20;
            newCreatures.push(child);
        }

        // Die
        if (c.energy <= 0 || c.age > 30) continue;
        newCreatures.push(c);
    }
    st.creatures = newCreatures;

    // Spawn if extinct
    if (st.creatures.length === 0) {
        for (let i = 0; i < 6; i++) st.creatures.push(spawnCreature(w, h, i < 2));
    }

    // ── Draw creatures
    ctx.textBaseline = 'middle';
    for (const c of st.creatures) {
        const isPred = c.aggression > 0.6;
        const energyFrac = c.energy / 100;
        const alpha = 0.5 + energyFrac * 0.5;
        const gHue = isPred ? (c.hue + 180) % 360 : c.hue;

        const gs2 = _evoGlow(gHue, 100, 70, c.size * 1.5);
        ctx.globalAlpha = alpha * (isPred ? 0.4 : 0.2);
        ctx.drawImage(gs2, c.x - gs2.width/2, c.y - gs2.height/2);
        ctx.globalAlpha = 1;

        ctx.font = `${c.size}px monospace`;
        ctx.fillStyle = `hsla(${gHue},90%,${isPred ? 70 : 60}%,${alpha})`;
        ctx.fillText(c.glyph, c.x - c.size*0.4, c.y);
    }

    // HUD
    const preds = st.creatures.filter(c=>c.aggression>0.6).length;
    const preys = st.creatures.length - preds;
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(0,255,100,0.4)';
    ctx.fillText(`GEN:${st.gen}  PRED:${preds}  PREY:${preys}  FOOD:${st.food.length}`, 6, h-8);
}
