// ── Orbital System ────────────────────────────────────────────────────────────
// Central body + orbiting bodies drawn with Keplerian motion, isometric tilt.
// 4 presets: solar system, binary star+planets, Jovian moons, random stable.
// Bass pulses central body; treble brightens trails; beat highlights resonances.

const _state = new WeakMap();

// Each body: { a, e, inc, phase0, period, radius, hue, trail }
function makePreset(preset) {
    if (preset === 0) {
        // Compressed solar system
        return {
            centralColor: 'hsl(50,100%,80%)',
            centralR: 18,
            bodies: [
                { a: 0.12, e: 0.21, inc: 0.02, phase0: 0.3,  period: 0.24, radius: 3,  hue: 180 },
                { a: 0.19, e: 0.01, inc: 0.06, phase0: 1.2,  period: 0.62, radius: 5,  hue: 40  },
                { a: 0.26, e: 0.02, inc: 0.00, phase0: 2.0,  period: 1.00, radius: 5,  hue: 210 },
                { a: 0.34, e: 0.09, inc: 0.03, phase0: 0.7,  period: 1.88, radius: 4,  hue: 20  },
                { a: 0.45, e: 0.05, inc: 0.02, phase0: 4.0,  period: 11.9, radius: 9,  hue: 30  },
                { a: 0.55, e: 0.06, inc: 0.04, phase0: 5.3,  period: 29.5, radius: 8,  hue: 50  },
                { a: 0.64, e: 0.05, inc: 0.01, phase0: 1.8,  period: 84.0, radius: 6,  hue: 180 },
                { a: 0.72, e: 0.01, inc: 0.03, phase0: 3.1,  period: 165,  radius: 6,  hue: 220 },
            ],
        };
    } else if (preset === 1) {
        // Binary star + planets
        return {
            centralColor: 'hsl(40,100%,85%)',
            centralR: 14,
            bodies: [
                { a: 0.08, e: 0.0,  inc: 0.0,  phase0: 0.0,  period: 0.5,  radius: 12, hue: 200, isStar2: true },
                { a: 0.30, e: 0.05, inc: 0.02, phase0: 1.0,  period: 3.0,  radius: 4,  hue: 120 },
                { a: 0.50, e: 0.1,  inc: 0.04, phase0: 3.0,  period: 7.0,  radius: 5,  hue: 40  },
                { a: 0.68, e: 0.02, inc: 0.01, phase0: 5.0,  period: 15.0, radius: 3,  hue: 280 },
            ],
        };
    } else if (preset === 2) {
        // Jovian moons
        return {
            centralColor: 'hsl(35,80%,55%)',
            centralR: 24,
            bodies: [
                { a: 0.15, e: 0.004, inc: 0.0, phase0: 0.0, period: 1.77,  radius: 4, hue: 50  },
                { a: 0.24, e: 0.009, inc: 0.0, phase0: 2.1, period: 3.55,  radius: 5, hue: 220 },
                { a: 0.38, e: 0.001, inc: 0.0, phase0: 4.0, period: 7.16,  radius: 5, hue: 100 },
                { a: 0.55, e: 0.007, inc: 0.0, phase0: 1.0, period: 16.69, radius: 4, hue: 170 },
            ],
        };
    } else {
        // Random stable
        const bodies = [];
        for (let i = 0; i < 6; i++) {
            bodies.push({
                a:      0.1 + i * 0.12,
                e:      Math.random() * 0.12,
                inc:    (Math.random() - 0.5) * 0.15,
                phase0: Math.random() * Math.PI * 2,
                period: Math.pow(0.1 + i * 0.12, 1.5) * 5,
                radius: 3 + Math.random() * 5 | 0,
                hue:    Math.random() * 360 | 0,
            });
        }
        return { centralColor: 'hsl(60,100%,85%)', centralR: 16, bodies };
    }
}

function makeState(preset) {
    const system = makePreset(preset);
    system.bodies.forEach(b => { b.trail = []; });
    return { time: 0, preset, system, prevBass: 0, pulse: 0, resonant: [] };
}

export const orbitSystemParams = () => ({
    hue:    { base: 200, min: 0,   max: 360, mod: { source: "" } },
    preset: { base: 0,   min: 0,   max: 3,   step: 1, mod: { source: "" } },
    speed:  { base: 1,   min: 0.1, max: 5,   mod: { source: "" } },
    tilt:   { base: 0.2, min: 0,   max: 0.5, mod: { source: "" } },
    scale:  { base: 0.8, min: 0.3, max: 2,   mod: { source: "" } },
    glow:   { base: 2,   min: 0,   max: 3,   mod: { source: "" } },
});

export function drawOrbitSystem(ctx, w, h, p, t, extra) {
    const preset = Math.max(0, Math.min(3, Math.round(p.preset ?? 0)));

    let st = _state.get(ctx);
    if (!st || st.preset !== preset) {
        st = makeState(preset);
        _state.set(ctx, st);
    }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0, treble = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
        for (let i = 44; i < 64; i++) treble += sp[i]; treble /= 20;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) {
        st.pulse = 1;
        // Highlight resonant pairs briefly
        st.resonant = [0, 1];
    }
    st.prevBass = bass;
    st.pulse *= 0.85;
    if (st.resonant.length && st.pulse < 0.05) st.resonant = [];

    const hue    = p.hue ?? 200;
    const speed  = (p.speed ?? 1);
    const tilt   = p.tilt ?? 0.2;
    const scale  = p.scale ?? 0.8;
    const glow   = p.glow ?? 2;
    const tScale = Math.min(w, h) * scale;
    const cx = w / 2, cy = h / 2;

    // Project (x, y) in orbit-plane to screen (isometric-like tilt)
    function project(ox, oy) {
        return { sx: cx + ox * tScale, sy: cy + oy * tScale * (1 - tilt) };
    }

    const { system } = st;
    const bodies     = system.bodies;

    // Clear with fade
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, w, h);

    // Draw orbital ellipses
    ctx.save();
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const N = 80;
        ctx.beginPath();
        for (let j = 0; j <= N; j++) {
            const theta = (j / N) * Math.PI * 2;
            const r     = b.a * (1 - b.e * b.e) / (1 + b.e * Math.cos(theta));
            const ox    = Math.cos(theta + b.phase0) * r + b.e * b.a * Math.cos(b.inc);
            const oy    = Math.sin(theta + b.phase0) * r;
            const q     = project(ox, oy);
            j === 0 ? ctx.moveTo(q.sx, q.sy) : ctx.lineTo(q.sx, q.sy);
        }
        ctx.strokeStyle = `hsla(${(hue + b.hue) % 360},60%,40%,0.2)`;
        ctx.lineWidth   = 0.5;
        ctx.stroke();
    }
    ctx.restore();

    // Advance bodies & update trails
    const now = st.time * speed;
    for (let i = 0; i < bodies.length; i++) {
        const b     = bodies[i];
        const theta = (now / b.period) * Math.PI * 2 + b.phase0;
        const r     = b.a * (1 - b.e * b.e) / (1 + b.e * Math.cos(theta - b.phase0));
        const ox    = Math.cos(theta) * r;
        const oy    = Math.sin(theta) * r;
        b._ox = ox; b._oy = oy;
        const q = project(ox, oy);
        b._sx = q.sx; b._sy = q.sy;

        b.trail.push({ x: q.sx, y: q.sy });
        if (b.trail.length > 100) b.trail.shift();
    }

    // Draw trails
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.trail.length < 2) continue;
        const bright = 0.4 + treble * 0.3;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let j = 1; j < b.trail.length; j++) ctx.lineTo(b.trail[j].x, b.trail[j].y);
        ctx.strokeStyle = `hsla(${(hue + b.hue) % 360},80%,${bright * 100 | 0}%,0.5)`;
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    // Central body
    ctx.shadowBlur = 0;
    ctx.fillStyle   = system.centralColor;
    ctx.beginPath();
    ctx.arc(cx, cy, system.centralR * scale, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting bodies
    for (let i = 0; i < bodies.length; i++) {
        const b       = bodies[i];
        const isRes   = st.resonant.includes(i);
        const ph      = (hue + b.hue) % 360;
        const bright  = isRes ? 95 : 65;
        ctx.shadowBlur = 0;
        ctx.fillStyle   = `hsl(${ph},80%,${bright}%)`;
        ctx.beginPath();
        ctx.arc(b._sx, b._sy, b.radius * scale, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}
