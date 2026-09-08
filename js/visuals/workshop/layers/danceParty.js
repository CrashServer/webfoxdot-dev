// ── Dance Party ───────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION DancePartyScene.
// Disco floor with light-up tiles, stick-figure dancers, mirror-ball spotlight
// shafts, party confetti particles. Bass = beat drop lights + dancer jump.

const _st = new WeakMap();

const _dpGlowCache = new Map();
function _dpGlow(hue, sat, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(6, Math.round(radius / 5) * 5);
    const key = `${hb}_${sat}_${rb}`;
    if (_dpGlowCache.has(key)) return _dpGlowCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},${sat}%,70%)`);
    g.addColorStop(1, 'transparent');
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _dpGlowCache.set(key, gc);
    return gc;
}

const FLOOR_COLS = ['#ff0040','#ff8800','#ffff00','#00ff88','#00aaff','#cc00ff','#ff0088'];
const DANCE_MOVES = [
    (ctx,x,y,sz,t) => { // arms up
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.6); ctx.lineTo(x, y+sz*0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.3); ctx.lineTo(x-sz*0.6, y-sz*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.3); ctx.lineTo(x+sz*0.6, y-sz*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x-sz*0.4, y+sz*0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x+sz*0.4, y+sz*0.8); ctx.stroke();
    },
    (ctx,x,y,sz,t) => { // one arm raise
        const side = Math.sin(t * 3) > 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.6); ctx.lineTo(x, y+sz*0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.3); ctx.lineTo(x-sz*0.5*side, y-sz*0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.3); ctx.lineTo(x+sz*0.3*side, y-sz*0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x-sz*0.4, y+sz*0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x+sz*0.4, y+sz*0.8); ctx.stroke();
    },
    (ctx,x,y,sz,t) => { // t-pose spin
        const angle = t * 2;
        ctx.beginPath(); ctx.moveTo(x, y-sz*0.6); ctx.lineTo(x, y+sz*0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-sz*0.7, y-sz*0.3); ctx.lineTo(x+sz*0.7, y-sz*0.3); ctx.stroke();
        const kx = Math.cos(angle) * sz * 0.45;
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x-kx, y+sz*0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y+sz*0.3); ctx.lineTo(x+kx, y+sz*0.8); ctx.stroke();
    },
];

function mkDancer(w, h) {
    return {
        x: 0.1 + Math.random() * 0.8,
        yBase: 0.6 + Math.random() * 0.25,
        moveIdx: Math.floor(Math.random() * DANCE_MOVES.length),
        hue: Math.random() * 360,
        sz: 16 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        jumpVel: 0,
        jumpY: 0,
    };
}

function mkParticle(w) {
    return {
        x: Math.random() * w,
        y: 0,
        vx: (Math.random()-0.5)*3,
        vy: 1+Math.random()*3,
        hue: Math.random()*360,
        size: 3+Math.random()*5,
        life: 1,
        decay: 0.008 + Math.random()*0.012,
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
    };
}

export const dancePartyParams = () => ({
    dancers:   { base: 0.5, min: 0, max: 1,   mod: { source: "" } },
    floorSize: { base: 8,   min: 4, max: 16, step:1, mod: { source: "" } },
    spotlight: { base: 0.7, min: 0, max: 1,   mod: { source: "" } },
    confetti:  { base: 0.6, min: 0, max: 1,   mod: { source: "" } },
    pulse:     { base: 0.8, min: 0, max: 1,   mod: { source: "" } },
    speed:     { base: 0.5, min: 0, max: 2,   mod: { source: "" } },
    bgAlpha:   { base: 1,   min: 0, max: 1,   mod: { source: "" } },
});

export function drawDanceParty(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nDancers  = Math.max(1, Math.round((p.dancers ?? 0.5) * 8));
    const floorSize = Math.round(p.floorSize ?? 8);
    const spotlight = p.spotlight ?? 0.7;
    const confetti  = p.confetti ?? 0.6;
    const pulse     = p.pulse ?? 0.8;
    const speed     = p.speed ?? 0.5;
    const bgAlpha   = p.bgAlpha ?? 1;

    let st = _st.get(ctx);
    if (!st) {
        st = { dancers: Array.from({length: nDancers}, () => mkDancer(w,h)), particles: [], mirrorAngle: 0, prevBass: 0 };
        _st.set(ctx, st);
    }
    while (st.dancers.length < nDancers) st.dancers.push(mkDancer(w,h));
    if (st.dancers.length > nDancers) st.dancers.splice(nDancers);
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.mirrorAngle += 0.4 * speed * (1 + bass * 0.5) * (dt * 60);

    // ── Background
    ctx.fillStyle = `rgba(4,0,12,${bgAlpha})`;
    ctx.fillRect(0,0,w,h);

    // ── Disco floor (bottom 35%)
    const floorTop = h * 0.65;
    const tileW = w / floorSize, tileH = (h - floorTop) / (floorSize * 0.5);
    for (let fy = 0; fy < Math.ceil((h - floorTop) / tileH); fy++) {
        for (let fx = 0; fx < floorSize; fx++) {
            const beatPhase = (fx + fy + Math.floor(t * speed * 4)) % FLOOR_COLS.length;
            const litUp = bass > 0.3 ? Math.random() < (bass * pulse) : false;
            const baseCol = FLOOR_COLS[beatPhase];
            const x = fx * tileW, y = floorTop + fy * tileH;
            ctx.fillStyle = litUp ? baseCol : `rgba(20,20,30,0.8)`;
            ctx.fillRect(x+1, y+1, tileW-2, tileH-2);
            if (litUp) {
                ctx.strokeStyle = `rgba(255,255,255,0.4)`;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x+1, y+1, tileW-2, tileH-2);
            }
        }
    }

    // ── Mirror ball spotlights
    if (spotlight > 0.1) {
        const nSpots = Math.round(4 + spotlight * 6);
        const ballX = w * 0.5, ballY = h * 0.08;
        for (let s = 0; s < nSpots; s++) {
            const ang = (s / nSpots) * Math.PI * 2 + st.mirrorAngle * 0.05;
            const tx = ballX + Math.cos(ang) * w * 0.4;
            const ty = floorTop + Math.sin(ang * 0.7) * h * 0.2;
            const sHue = (s * 60 + st.mirrorAngle * 5) % 360;
            const spotR = 60 + spotlight * 80;
            const sg = _dpGlow(sHue, 100, spotR);
            ctx.globalAlpha = spotlight * 0.25;
            ctx.drawImage(sg, tx - sg.width/2, ty - sg.height/2);

            // Shaft from ball to floor
            ctx.globalAlpha = spotlight * 0.08;
            ctx.fillStyle = `hsl(${sHue},100%,70%)`;
            ctx.beginPath();
            ctx.moveTo(ballX, ballY);
            ctx.lineTo(tx-8, ty); ctx.lineTo(tx+8, ty);
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1;
        }
        // Mirror ball itself
        ctx.fillStyle = `rgba(220,220,255,0.9)`;
        ctx.beginPath(); ctx.arc(ballX, ballY, 8, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        for (let l = 0; l < 4; l++) {
            const la = l * Math.PI / 2 + st.mirrorAngle * 0.1;
            ctx.beginPath(); ctx.arc(ballX, ballY, 8, la, la + Math.PI/4); ctx.stroke();
        }
    }

    // ── Dancers
    ctx.lineWidth = 2;
    for (const d of st.dancers) {
        // Bass jump
        if (bass > 0.5 && st.prevBass < 0.5) d.jumpVel = -(h * 0.04 * pulse);
        d.jumpVel = d.jumpVel * 0.85 + h * 0.001; // gravity
        d.jumpY = Math.min(0, d.jumpY + d.jumpVel * dt);

        const x = d.x * w;
        const y = d.yBase * h + d.jumpY;
        const move = DANCE_MOVES[d.moveIdx];

        // Glow — cached sprite per hue/size
        const dgs = _dpGlow(d.hue, 100, d.sz * 1.5);
        ctx.globalAlpha = 0.25;
        ctx.drawImage(dgs, x - dgs.width/2, y - dgs.height/2);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = `hsl(${d.hue},90%,70%)`;
        ctx.fillStyle = `hsl(${d.hue},90%,70%)`;
        ctx.beginPath(); ctx.arc(x, y - d.sz * 0.8, d.sz * 0.22, 0, Math.PI*2); ctx.fill();
        move(ctx, x, y, d.sz, t * speed + d.phase);
    }
    st.prevBass = bass;

    // ── Confetti particles
    if (confetti > 0 && (bass > 0.4 || mid > 0.3)) {
        const n = Math.floor((bass * 10 + mid * 4) * confetti);
        for (let i = 0; i < n; i++) st.particles.push(mkParticle(w));
    }
    for (let i = st.particles.length - 1; i >= 0; i--) {
        const pk = st.particles[i];
        pk.x += pk.vx; pk.y += pk.vy; pk.life -= pk.decay;
        if (pk.life <= 0 || pk.y > h) { st.particles.splice(i, 1); continue; }
        ctx.fillStyle = `hsla(${pk.hue},100%,65%,${pk.life})`;
        if (pk.shape === 'rect') ctx.fillRect(pk.x, pk.y, pk.size, pk.size * 0.5);
        else { ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.size * 0.5, 0, Math.PI*2); ctx.fill(); }
    }

    // Treble sparkle
    if (treble > 0.4) {
        const sCtx = ctx;
        for (let s = 0; s < Math.floor(treble * 12); s++) {
            const sx = Math.random() * w, sy = Math.random() * floorTop;
            sCtx.fillStyle = `rgba(255,255,255,${treble * 0.6})`;
            sCtx.fillRect(sx, sy, 1, 1);
        }
    }
}
