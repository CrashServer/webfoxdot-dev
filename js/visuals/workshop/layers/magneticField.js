// ── Magnetic Field layer ───────────────────────────────────────────────────
// 2-4 magnetic poles with field lines and particles following field direction.
// Drawn with persistent trail fade for a long-exposure look.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.18|0); let v=0; for(let i=0;i<n;i++) v+=s[i]; return Math.min(1, v/n*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

function polePositions(count, w, h) {
    const poles = [];
    if (count === 2) {
        poles.push({ x: w*0.32, y: h*0.5, sign:  1 });
        poles.push({ x: w*0.68, y: h*0.5, sign: -1 });
    } else if (count === 3) {
        poles.push({ x: w*0.25, y: h*0.35, sign:  1 });
        poles.push({ x: w*0.75, y: h*0.35, sign: -1 });
        poles.push({ x: w*0.5,  y: h*0.72, sign:  1 });
    } else {
        poles.push({ x: w*0.28, y: h*0.28, sign:  1 });
        poles.push({ x: w*0.72, y: h*0.28, sign: -1 });
        poles.push({ x: w*0.28, y: h*0.72, sign: -1 });
        poles.push({ x: w*0.72, y: h*0.72, sign:  1 });
    }
    return poles;
}

function field(px, py, poles, strength) {
    let bx = 0, by = 0;
    for (let i = 0; i < poles.length; i++) {
        const dx = px - poles[i].x, dy = py - poles[i].y;
        const dist2 = dx*dx + dy*dy;
        if (dist2 < 1) continue;
        const inv = poles[i].sign * strength / dist2;
        // 2D "magnetic" field: perpendicular to radius vector
        bx += -dy * inv;
        by +=  dx * inv;
    }
    return { bx, by };
}

function spawnParticle(poles, w, h) {
    const pole = poles[Math.floor(Math.random() * poles.length)];
    const angle = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 30;
    return {
        x: pole.x + Math.cos(angle)*r,
        y: pole.y + Math.sin(angle)*r,
        vx: 0, vy: 0,
        age: 0,
        maxAge: 60 + Math.random() * 120,
        hue: pole.sign > 0 ? 0 : 180,
    };
}

export const magneticFieldParams = () => ({
    hue:           { base: 200, min: 0,   max: 360, mod: { source: "" } },
    poles:         { base: 2,   min: 2,   max: 4,   mod: { source: "" } },
    speed:         { base: 1,   min: 0.1, max: 3,   mod: { source: "" } },
    fieldStrength: { base: 1.5, min: 0.5, max: 3,   mod: { source: "" } },
});

export function drawMagneticField(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) {
        st = { time: 0, particles: [], poles: [], lastPoles: -1, lastW: 0, lastH: 0, lastT: 0 };
        _state.set(ctx, st);
    }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const spectrum  = extra?.spectrum;
    const bass      = bassLevel(spectrum);
    const treble    = trebleLevel(spectrum);
    const hue       = p.hue ?? 200;
    const poleCount = Math.max(2, Math.min(4, Math.round(p.poles ?? 2)));
    const speed     = (p.speed ?? 1) * (1 + bass * 0.4);
    const strength  = (p.fieldStrength ?? 1.5) * 2000;

    // Rebuild poles if count or canvas size changed
    if (poleCount !== st.lastPoles || w !== st.lastW || h !== st.lastH) {
        st.poles     = polePositions(poleCount, w, h);
        st.lastPoles = poleCount;
        st.lastW     = w;
        st.lastH     = h;
        st.particles = [];
    }

    const poles = st.poles;

    // Fade background
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);

    // Field lines from positive poles
    const positivePoles = poles.filter(pl => pl.sign > 0);
    const linesPerPole  = positivePoles.length > 0 ? Math.ceil(16 / positivePoles.length) : 0;
    const bright = 40 + treble * 30;

    for (let pi = 0; pi < positivePoles.length; pi++) {
        const pole = positivePoles[pi];
        for (let li = 0; li < linesPerPole; li++) {
            const startAngle = (li / linesPerPole) * Math.PI * 2;
            let lx = pole.x + Math.cos(startAngle) * 8;
            let ly = pole.y + Math.sin(startAngle) * 8;

            ctx.save();
            ctx.strokeStyle = `hsl(${hue},80%,${bright}%)`;
            ctx.lineWidth   = 0.8;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(lx, ly);

            for (let step = 0; step < 300; step++) {
                const { bx, by } = field(lx, ly, poles, strength);
                const mag = Math.sqrt(bx*bx + by*by);
                if (mag < 0.01) break;
                lx += (bx/mag) * 0.5;
                ly += (by/mag) * 0.5;
                if (lx < 0 || lx > w || ly < 0 || ly > h) break;
                ctx.lineTo(lx, ly);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    // Spawn particles
    const maxParticles = 80 + (bass > 0.5 ? 40 : 0);
    while (st.particles.length < maxParticles) {
        st.particles.push(spawnParticle(poles, w, h));
    }

    // Extra burst on bass
    if (bass > 0.65) {
        for (let i = 0; i < 15; i++) st.particles.push(spawnParticle(poles, w, h));
    }

    // Update and draw particles
    const keep = [];
    for (let i = 0; i < st.particles.length; i++) {
        const part = st.particles[i];
        const { bx, by } = field(part.x, part.y, poles, strength);
        const mag = Math.sqrt(bx*bx + by*by) + 1e-9;
        part.vx  = (bx / mag) * speed * 1.5;
        part.vy  = (by / mag) * speed * 1.5;
        part.x  += part.vx;
        part.y  += part.vy;
        part.age++;

        if (part.age < part.maxAge && part.x >= 0 && part.x <= w && part.y >= 0 && part.y <= h) {
            const alpha = (1 - part.age / part.maxAge) * 0.9;
            ctx.save();
            ctx.fillStyle   = `hsl(${(hue + part.hue) % 360},100%,70%)`;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(part.x, part.y, 1.5, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
            keep.push(part);
        }
    }
    st.particles = keep;

    // Draw pole indicators
    for (let i = 0; i < poles.length; i++) {
        const pl = poles[i];
        const ph = pl.sign > 0 ? hue : (hue + 180) % 360;
        ctx.save();
        ctx.fillStyle   = `hsl(${ph},100%,60%)`;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}
