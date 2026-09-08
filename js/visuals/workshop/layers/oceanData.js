// ── Ocean Data ────────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION OceanScene.
// A living data-ocean with layered sinusoidal waves, code creatures drifting
// through the depth, binary coral at the bottom, foam on crests.
// Bass = wave surge. Mid = creature density. Treble = bioluminescent glow.

const _st = new WeakMap();

const CREATURES = ['><(((>', '<)))(><', '~*~', '><>', '((><', '»»»', '°o°', '∞'];
const CODE_STRINGS = ['01100110','0x1F4BB','SELECT *','PUSH 0x40','MOV AX','NOP','0b1010','0xFF'];
const FOAM_CHARS = ['~','≈','∿','〰','⌇','∼'];

function mkCreature(w) {
    return {
        x: Math.random() * w,
        y: 0.3 + Math.random() * 0.5,   // fraction of height
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.08,
        glyph: CREATURES[Math.floor(Math.random() * CREATURES.length)],
        code:  CODE_STRINGS[Math.floor(Math.random() * CODE_STRINGS.length)],
        hue:   Math.random() * 60 + 140, // cyan-green range
        size:  10 + Math.random() * 8,
        blink: Math.random() * Math.PI * 2,
    };
}

export const oceanDataParams = () => ({
    creatures: { base: 0.5, min: 0, max: 1,   mod: { source: "" } }, // density
    waveAmp:   { base: 0.7, min: 0, max: 1,   mod: { source: "" } },
    waveSpeed: { base: 0.4, min: 0, max: 2,   mod: { source: "" } },
    depth:     { base: 0.6, min: 0, max: 1,   mod: { source: "" } }, // how deep ocean goes
    glow:      { base: 0.5, min: 0, max: 1,   mod: { source: "" } }, // biolum intensity
    coral:     { base: 0.7, min: 0, max: 1,   mod: { source: "" } }, // bottom coral density
    pulse:     { base: 0.8, min: 0, max: 1,   mod: { source: "" } },
    bgAlpha:   { base: 1,   min: 0, max: 1,   mod: { source: "" } },
});

export function drawOceanData(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const creatureDensity = p.creatures ?? 0.5;
    const waveAmp   = p.waveAmp ?? 0.7;
    const waveSpeed = p.waveSpeed ?? 0.4;
    const depth     = p.depth ?? 0.6;
    const glow      = p.glow ?? 0.5;
    const coral     = p.coral ?? 0.7;
    const pulse     = p.pulse ?? 0.8;
    const bgAlpha   = p.bgAlpha ?? 1;

    let st = _st.get(ctx);
    if (!st) {
        const nC = Math.max(3, Math.floor(creatureDensity * 20));
        st = { creatures: Array.from({length: nC}, () => mkCreature(w)), prevBass: 0 };
        _st.set(ctx, st);
    }

    // Adjust creature count
    const targetN = Math.max(3, Math.floor(creatureDensity * 20 + mid * 10));
    while (st.creatures.length < targetN) st.creatures.push(mkCreature(w));
    if (st.creatures.length > targetN + 5) st.creatures.splice(targetN);

    // ── Background gradient (sky → ocean)
    const oceanTop = h * (1 - depth);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,        `rgba(0,0,12,${bgAlpha})`);
    grad.addColorStop(oceanTop/h, `rgba(0,8,28,${bgAlpha})`);
    grad.addColorStop(1,        `rgba(0,18,48,${bgAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ── Wave layers (3 overlapping)
    const ampPx = waveAmp * h * 0.06 * (1 + bass * pulse * 2);
    for (let layer = 0; layer < 3; layer++) {
        const freq   = 0.008 + layer * 0.003;
        const speed  = waveSpeed * (1 + layer * 0.3);
        const yBase  = oceanTop + layer * h * 0.04;
        const alpha  = 0.15 + layer * 0.07;
        const lhue   = 200 + layer * 10;

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2) {
            const y = yBase + Math.sin(x * freq + t * speed) * ampPx
                            + Math.sin(x * freq * 1.7 - t * speed * 0.6) * ampPx * 0.4;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = `hsla(${lhue},70%,30%,${alpha})`;
        ctx.fill();

        // Foam on crest
        ctx.font = '8px monospace';
        for (let x = 0; x < w; x += 20 + layer * 12) {
            const y = yBase + Math.sin(x * freq + t * speed) * ampPx;
            if (y > oceanTop - 10) {
                ctx.fillStyle = `rgba(180,240,255,${0.3 + Math.random() * 0.3})`;
                ctx.fillText(FOAM_CHARS[Math.floor(Math.random() * FOAM_CHARS.length)], x, y - 2);
            }
        }
    }

    // ── Binary coral at bottom
    if (coral > 0.1) {
        const cBase = h * (1 - coral * 0.18);
        ctx.font = '8px monospace';
        for (let x = 8; x < w; x += 18) {
            const ht = h * 0.05 + Math.sin(x * 0.05 + t * 0.2) * h * 0.04 + coral * h * 0.06;
            for (let y = cBase; y < h; y += 9) {
                const bit = Math.random() < 0.5 ? '0' : '1';
                const coralHue = 140 + Math.sin(x * 0.1 + t * 0.3) * 30;
                ctx.fillStyle = `hsla(${coralHue},60%,${25 + Math.random()*12}%,${0.5+treble*0.3})`;
                ctx.fillText(bit, x + Math.sin(y * 0.2) * 3, y);
            }
        }
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    // ── Creatures
    for (const c of st.creatures) {
        c.blink += 0.05;
        c.x += c.vx * (1 + bass * pulse);
        c.y += c.vy * dt;
        if (c.x < -60) c.x = w + 30;
        if (c.x > w + 60) c.x = -30;
        c.y = Math.max(0.1, Math.min(0.85, c.y + Math.sin(t * 0.3 + c.blink) * 0.001));

        const px = c.x, py = c.y * h;
        const glowAlpha = glow * (0.5 + 0.5 * Math.sin(c.blink + treble * 3));

        // Bioluminescent glow
        if (glow > 0.1) {
            const g2 = ctx.createRadialGradient(px, py, 0, px, py, c.size * 2.5);
            g2.addColorStop(0, `hsla(${c.hue},100%,70%,${glowAlpha * 0.4})`);
            g2.addColorStop(1, `hsla(${c.hue},80%,40%,0)`);
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(px, py, c.size * 2.5, 0, Math.PI*2); ctx.fill();
        }

        ctx.font = `${c.size}px monospace`;
        ctx.fillStyle = `hsla(${c.hue},80%,65%,${0.7 + glowAlpha * 0.3})`;
        ctx.fillText(c.glyph, px, py);

        // Code string trailing the creature
        if (mid > 0.1) {
            ctx.font = '8px monospace';
            ctx.fillStyle = `hsla(${c.hue},60%,50%,${0.3 + mid * 0.3})`;
            ctx.fillText(c.code, px + (c.vx > 0 ? -c.code.length * 5.5 : c.size + 2), py + 10);
        }
    }

    // ── Treble scan line (ocean depth data)
    if (treble > 0.2) {
        const scanY = oceanTop + (h - oceanTop) * ((t * 0.2) % 1);
        ctx.strokeStyle = `rgba(0,255,180,${treble * 0.5})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke();
        ctx.setLineDash([]);
    }

    // Bass surge overlay
    if (bass > 0.55) {
        ctx.fillStyle = `rgba(0,40,80,${(bass-0.55)*0.3*pulse})`;
        ctx.fillRect(0, 0, w, h);
    }
}
