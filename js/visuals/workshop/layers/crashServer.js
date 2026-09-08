// ── Crash Server ─────────────────────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.FinalBattle Phase0_LogoBreach.
// "CRASH THE SERVER" ASCII block-art logo with progressive corruption, data
// packets flying in, explosion flashes, and glitch text. Bass = attack events.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const GLITCH = '!@#$%^&*[]{}|;:<>?/~`█▓▒░╔╗╚╝║═';

const LOGO = [
    '  ██████╗██████╗  █████╗ ███████╗██╗  ██╗',
    ' ██╔════╝██╔══██╗██╔══██╗██╔════╝██║  ██║',
    ' ██║     ██████╔╝███████║███████╗███████║',
    ' ██║     ██╔══██╗██╔══██║╚════██║██╔══██║',
    ' ╚██████╗██║  ██║██║  ██║███████║██║  ██║',
    '  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
    '',
    '████████╗██╗  ██╗███████╗',
    '╚══██╔══╝██║  ██║██╔════╝',
    '   ██║   ███████║█████╗  ',
    '   ██║   ██╔══██║██╔══╝  ',
    '   ██║   ██║  ██║███████╗',
    '   ╚═╝   ╚═╝  ╚═╝╚══════╝',
    '',
    ' ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗',
    ' ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗',
    ' ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝',
    ' ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗',
    ' ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║',
    ' ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝',
];

function lcg(s) { s = (s*1664525+1013904223)&0x7fffffff; return [s, s/0x7fffffff]; }

export const crashServerParams = () => ({
    corrupt:  { base: 0.0,  min: 0,   max: 1,            mod: { source: "" } }, // 0=clean, 1=fully corrupted
    autoCorrupt:{ base:0.5, min: 0,   max: 1,   step: 1, mod: { source: "" } }, // auto-advance corruption
    pulse:    { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    hue:      { base: 180,  min: 0,   max: 360,          mod: { source: "" } }, // logo hue (cyan)
    hue2:     { base: 0,    min: 0,   max: 360,          mod: { source: "" } }, // corrupt hue (red)
    fontSize: { base: 10,   min: 5,   max: 18,  step: 1, mod: { source: "" } },
    glow:     { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    packets:  { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    shake:    { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.92, min: 0,   max: 1,            mod: { source: "" } },
    speed:    { base: 1.0,  min: 0.1, max: 3,            mod: { source: "" } },
});

export function drawCrashServer(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const pulse    = p.pulse ?? 0.8;
    const hue      = p.hue ?? 180;
    const hue2     = p.hue2 ?? 0;
    const fSize    = Math.round(p.fontSize ?? 10);
    const glow     = p.glow ?? 0.8;
    const showPkts = (p.packets ?? 0.7) > 0.1;
    const shakeMx  = p.shake ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.92;
    const spd      = p.speed ?? 1.0;
    const autoCorr = (p.autoCorrupt ?? 0.5) > 0.5;

    let st = _st.get(ctx);
    if (!st) {
        // Build per-char corruption state
        let allChars = [];
        LOGO.forEach((line, li) => {
            for (let ci = 0; ci < line.length; ci++) {
                if (line[ci] !== ' ') allChars.push({ li, ci, corrupted: false, glitch: '', glitchTimer: 0 });
            }
        });
        st = { chars: allChars, corruptLevel: 0, seed: 1, prevBass: 0,
               packets: [], shake: 0, explosions: [], flashRed: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Advance corruption
    const targetCorrupt = autoCorr
        ? Math.min(1, st.corruptLevel + dt * spd * 0.03 * (1 + bass * pulse * 3))
        : (p.corrupt ?? 0);
    st.corruptLevel = targetCorrupt;
    if (st.corruptLevel >= 0.999) st.corruptLevel = 0; // loop back

    // Bass attack: corrupt more chars, add explosion, spawn packets
    if (bass > 0.45 && bass > st.prevBass + 0.08) {
        st.shake = bass * shakeMx * 14;
        st.flashRed = bass * pulse * 0.35;
        const nCorrupt = Math.ceil(bass * pulse * 8);
        let s = st.seed;
        for (let i = 0; i < nCorrupt; i++) {
            let r; [s, r] = lcg(s);
            const idx = Math.floor(r * st.chars.length);
            if (!st.chars[idx].corrupted) { st.chars[idx].corrupted = true; }
        }
        st.seed = s;
        if (st.explosions.length < 10)
            st.explosions.push({ x: w * 0.1 + Math.random() * w * 0.8, y: h * 0.1 + Math.random() * h * 0.8,
                                  r: 0, maxR: 60 + bass * 80, life: 1 });
        // Spawn data packet
        if (showPkts && st.packets.length < 40) {
            const side = Math.floor(Math.random() * 4);
            let px, py;
            if (side===0) { px=-10; py=Math.random()*h; }
            else if(side===1){ px=w+10; py=Math.random()*h; }
            else if(side===2){ px=Math.random()*w; py=-10; }
            else { px=Math.random()*w; py=h+10; }
            const tx = w*0.2 + Math.random()*w*0.6, ty = h*0.2 + Math.random()*h*0.6;
            const dd = Math.hypot(tx-px, ty-py)||1;
            const spd2 = 200 + Math.random() * 200;
            st.packets.push({ x:px,y:py,vx:(tx-px)/dd*spd2,vy:(ty-py)/dd*spd2,
                              life:1,color:Math.random()>0.5?`hsl(${hue},100%,70%)`:`hsl(${hue2},100%,70%)` });
        }
    }
    st.prevBass = bass;
    st.shake *= 0.88;
    st.flashRed *= 0.9;

    // Update glitch timers
    for (const ch of st.chars) {
        if (ch.corrupted) {
            ch.glitchTimer -= dt;
            if (ch.glitchTimer <= 0) {
                ch.glitchTimer = 0.04 + Math.random() * 0.12;
                ch.glitch = GLITCH[Math.floor(Math.random() * GLITCH.length)];
            }
        }
    }

    // Sync corruptLevel with chars
    const nToCorrupt = Math.floor(st.corruptLevel * st.chars.length);
    let corrupted = st.chars.filter(c => c.corrupted).length;
    let s2 = st.seed;
    while (corrupted < nToCorrupt && corrupted < st.chars.length) {
        let r; [s2, r] = lcg(s2);
        const idx = Math.floor(r * st.chars.length);
        if (!st.chars[idx].corrupted) { st.chars[idx].corrupted = true; corrupted++; }
    }
    st.seed = s2;

    // Camera shake
    const sx = st.shake * (Math.random()-0.5) * 2;
    const sy = st.shake * (Math.random()-0.5) * 2;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(sx, sy);

    // Data packets
    for (const pk of st.packets) {
        pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.life -= dt * 0.6;
        ctx.fillStyle = pk.color.replace(')', `,${pk.life})`).replace('hsl', 'hsla');
        ctx.beginPath(); ctx.arc(pk.x, pk.y, 3, 0, TAU); ctx.fill();
        // Tail
        ctx.strokeStyle = pk.color.replace(')', `,${pk.life*0.4})`).replace('hsl','hsla');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pk.x, pk.y);
        ctx.lineTo(pk.x - pk.vx*dt*4, pk.y - pk.vy*dt*4);
        ctx.stroke();
    }
    st.packets = st.packets.filter(pk => pk.life > 0.01);

    // Explosions
    for (const ex of st.explosions) {
        ex.r += dt * 300; ex.life -= dt * 2;
        if (ex.life > 0) {
            ctx.strokeStyle = `hsla(${hue2},90%,65%,${ex.life * 0.8})`;
            ctx.lineWidth = 2;
            if (glow>0.05) { ctx.shadowBlur = glow*20; ctx.shadowColor=`hsl(${hue2},100%,60%)`; }
            ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, TAU); ctx.stroke();
        }
    }
    st.explosions = st.explosions.filter(e => e.life > 0);
    ctx.shadowBlur = 0;

    // Render LOGO
    ctx.font = `bold ${fSize}px "Courier New", monospace`;
    ctx.textBaseline = 'top';
    const lineH = fSize * 1.2;
    const logoH = LOGO.length * lineH;
    const logoW = Math.max(...LOGO.map(l => ctx.measureText(l).width));
    const ox = (w - logoW) / 2;
    const oy = (h - logoH) / 2;

    // Build char map for fast lookup
    const corruptMap = new Map();
    for (const ch of st.chars) {
        const k = `${ch.li},${ch.ci}`;
        corruptMap.set(k, ch);
    }

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12 * (1 + bass * pulse * 0.5);
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
    }

    for (let li = 0; li < LOGO.length; li++) {
        const line = LOGO[li];
        const y = oy + li * lineH;
        let lineX = ox;
        for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci];
            const info = corruptMap.get(`${li},${ci}`);
            if (info && info.corrupted) {
                // Glitch char
                const cf = Math.random() < 0.08 ? 0.3 : 1; // occasional flicker
                ctx.fillStyle = `hsla(${hue2},90%,${50 + treble*25}%,${cf})`;
                ctx.shadowColor = `hsl(${hue2},100%,60%)`;
                ctx.fillText(info.glitch || ch, lineX, y);
            } else if (ch !== ' ') {
                ctx.fillStyle = `hsl(${hue},85%,${55 + treble*25}%)`;
                ctx.shadowColor = `hsl(${hue},100%,65%)`;
                ctx.fillText(ch, lineX, y);
            }
            lineX += ctx.measureText(ch).width;
        }
    }
    ctx.shadowBlur = 0;

    // Horizontal glitch scan lines
    if (st.corruptLevel > 0.1 && Math.random() < st.corruptLevel * 0.4) {
        const lineY = Math.random() * h;
        const lineW2 = w * 0.3 + Math.random() * w * 0.5;
        const lineX2 = Math.random() * (w - lineW2);
        ctx.fillStyle = `hsla(${hue2},80%,55%,${0.15 + Math.random() * 0.2})`;
        ctx.fillRect(lineX2, lineY, lineW2, fSize * 0.4);
    }

    // Red flash
    if (st.flashRed > 0.01) {
        ctx.fillStyle = `rgba(255,0,30,${st.flashRed})`;
        ctx.fillRect(-sx-2, -sy-2, w+4, h+4);
    }

    // Status bar
    const pct = Math.floor(st.corruptLevel * 100);
    ctx.fillStyle = `hsla(${hue},70%,50%,0.6)`;
    ctx.font = `${fSize * 0.8}px "Courier New", monospace`;
    ctx.fillText(`CORRUPTION: ${pct}%  ■`.padEnd(40, '─'), 10, h - fSize * 2);
    ctx.fillStyle = `hsla(${hue2},90%,60%,0.8)`;
    const barW = (w - 20) * st.corruptLevel;
    ctx.fillRect(10, h - fSize * 0.9, barW, fSize * 0.6);

    ctx.restore();
}
