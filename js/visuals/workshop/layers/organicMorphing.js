// ── Organic Morphing ──────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION OrganicMorphingScene.
// Entities morph between sphere / tentacle / tree / crystal forms over time.
// Bass = morph snap. Mid = tentacle sway. Treble = crystal spike.

const _st = new WeakMap();

// Module-level gradient sprite caches — avoid createRadialGradient per entity per frame
const _omSphereCache = new Map();
function _omSphereSprite(hue, radius) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(8, Math.round(radius / 4) * 4);
    const key = `${hb}_${rb}`;
    if (_omSphereCache.has(key)) return _omSphereCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    // Offset highlight: inner at (sz*0.35, sz*0.35) matching original x-r*0.3, y-r*0.3
    const g = gx.createRadialGradient(sz*0.35, sz*0.35, sz*0.025, sz/2, sz/2, sz/2);
    g.addColorStop(0,   `hsl(${hb},60%,90%)`);
    g.addColorStop(0.4, `hsl(${hb},80%,55%)`);
    g.addColorStop(1,   `hsla(${hb},90%,25%,0.5)`);
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _omSphereCache.set(key, gc);
    return gc;
}
const _omCoreCache = new Map();
function _omCoreSprite(hue, radius, lit1, lit2) {
    const hb = Math.round(hue / 30) * 30;
    const rb = Math.max(4, Math.round(radius / 3) * 3);
    const key = `${hb}_${rb}_${lit1}_${lit2}`;
    if (_omCoreCache.has(key)) return _omCoreCache.get(key);
    const sz = rb * 2;
    const gc = new OffscreenCanvas(sz, sz);
    const gx = gc.getContext('2d');
    const g = gx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0, `hsl(${hb},90%,${lit1}%)`);
    g.addColorStop(1, `hsla(${hb},70%,${lit2}%,0.3)`);
    gx.fillStyle = g; gx.fillRect(0, 0, sz, sz);
    _omCoreCache.set(key, gc);
    return gc;
}

const FORMS = ['SPHERE','TENTACLE','TREE','CRYSTAL'];

function drawSphere(ctx, x, y, r, hue, alpha, t, treble) {
    const spikes = Math.floor(treble * 8);
    const ss = _omSphereSprite(hue, r);
    ctx.globalAlpha = alpha;
    ctx.drawImage(ss, x - ss.width/2, y - ss.height/2);
    ctx.globalAlpha = 1;
    if (spikes > 0) {
        ctx.strokeStyle = `hsla(${hue+60},100%,80%,${alpha*0.6})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < spikes; i++) {
            const a = (i/spikes) * Math.PI * 2 + t * 0.3;
            const r2 = r + treble * r * 0.6;
            ctx.moveTo(x+Math.cos(a)*r, y+Math.sin(a)*r);
            ctx.lineTo(x+Math.cos(a)*r2, y+Math.sin(a)*r2);
        }
        ctx.stroke();
    }
}

function drawTentacle(ctx, x, y, r, hue, alpha, t, mid, idx) {
    const n = 6 + Math.round(mid * 4);
    ctx.lineWidth = 2 + r * 0.05;
    for (let i = 0; i < n; i++) {
        const baseAngle = (i / n) * Math.PI * 2;
        const sway = Math.sin(t * 1.2 + i * 0.8 + idx * 0.5) * mid * 0.5;
        ctx.strokeStyle = `hsla(${hue + i*12},80%,55%,${alpha * 0.8})`;
        ctx.beginPath();
        let px = x + Math.cos(baseAngle) * r * 0.3;
        let py = y + Math.sin(baseAngle) * r * 0.3;
        ctx.moveTo(px, py);
        const len = r * 1.4;
        for (let s = 1; s <= 6; s++) {
            const frac = s / 6;
            const a = baseAngle + Math.sin(t + s * 0.5 + sway) * 0.5;
            px += Math.cos(a) * len / 6;
            py += Math.sin(a) * len / 6;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    // Core
    const cs = _omCoreSprite(hue, r * 0.35, 75, 35);
    ctx.globalAlpha = alpha;
    ctx.drawImage(cs, x - cs.width/2, y - cs.height/2);
    ctx.globalAlpha = 1;
}

function drawTree(ctx, x, y, r, hue, alpha, t, bass, depth) {
    function branch(bx, by, angle, len, d) {
        if (d <= 0 || len < 1.5) return;
        const sway = Math.sin(t * 0.8 + d * 0.4) * 0.15;
        const ex = bx + Math.cos(angle + sway) * len;
        const ey = by + Math.sin(angle + sway) * len;
        const lw = Math.max(0.5, d * 0.8);
        ctx.strokeStyle = `hsla(${hue + (depth-d)*20},70%,${40+d*6}%,${alpha*(0.4+d*0.1)})`;
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        const spread = 0.4 + bass * 0.2;
        branch(ex, ey, angle - spread, len * 0.68, d-1);
        branch(ex, ey, angle + spread, len * 0.68, d-1);
        if (d <= 2) { // leaves
            ctx.fillStyle = `hsla(${hue+30},80%,55%,${alpha*0.6})`;
            ctx.beginPath(); ctx.arc(ex, ey, lw*1.2+1, 0, Math.PI*2); ctx.fill();
        }
    }
    branch(x, y + r*0.2, -Math.PI/2, r*0.7, depth);
}

function drawCrystal(ctx, x, y, r, hue, alpha, t, treble) {
    const n = 6 + Math.round(treble * 6);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.1;
        const spike = r * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.3)) * (1 + treble * 0.6);
        const w2 = r * 0.1;
        ctx.fillStyle = `hsla(${hue + i * 20},90%,${55 + treble * 20}%,${alpha * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - 0.15) * w2, y + Math.sin(a - 0.15) * w2);
        ctx.lineTo(x + Math.cos(a) * spike, y + Math.sin(a) * spike);
        ctx.lineTo(x + Math.cos(a + 0.15) * w2, y + Math.sin(a + 0.15) * w2);
        ctx.closePath(); ctx.fill();
    }
    // Core gem
    const cs = _omCoreSprite(hue, r * 0.3, 90, 40);
    ctx.globalAlpha = alpha;
    ctx.drawImage(cs, x - cs.width/2, y - cs.height/2);
    ctx.globalAlpha = 1;
}

export const organicMorphingParams = () => ({
    entities:   { base: 3,   min: 1,   max: 8,  step: 1, mod: { source: "" } },
    form:       { base: 0,   min: 0,   max: 3,  step: 1, mod: { source: "" } }, // 0=auto cycle, 1-3 fixed
    morphSpeed: { base: 0.4, min: 0,   max: 2,           mod: { source: "" } },
    size:       { base: 0.7, min: 0.2, max: 2,           mod: { source: "" } },
    pulse:      { base: 0.8, min: 0,   max: 1,           mod: { source: "" } },
    orbitSpeed: { base: 0.2, min: 0,   max: 1,           mod: { source: "" } },
    treeDepth:  { base: 4,   min: 2,   max: 7,  step: 1, mod: { source: "" } },
    bgAlpha:    { base: 0.9, min: 0,   max: 1,           mod: { source: "" } },
});

export function drawOrganicMorphing(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nEntities  = Math.round(p.entities ?? 3);
    const formParam  = Math.round(p.form ?? 0);
    const morphSpeed = p.morphSpeed ?? 0.4;
    const sizeScale  = p.size ?? 0.7;
    const pulse      = p.pulse ?? 0.8;
    const orbitSpeed = p.orbitSpeed ?? 0.2;
    const treeDepth  = Math.round(p.treeDepth ?? 4);
    const bgAlpha    = p.bgAlpha ?? 0.9;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            entities: Array.from({length: nEntities}, (_, i) => ({
                hue:      (i / nEntities) * 360,
                formFrac: i / FORMS.length,
                orbitAng: (i / nEntities) * Math.PI * 2,
                orbitR:   0.2 + (i % 3) * 0.08,
                pulse2:   Math.random() * Math.PI * 2,
            })),
            prevBass: 0,
        };
        _st.set(ctx, st);
    }

    while (st.entities.length < nEntities)
        st.entities.push({ hue: Math.random()*360, formFrac: Math.random(), orbitAng: Math.random()*Math.PI*2, orbitR: 0.15+Math.random()*0.15, pulse2: Math.random()*Math.PI*2 });
    if (st.entities.length > nEntities) st.entities.splice(nEntities);

    ctx.fillStyle = `rgba(2,0,8,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Bass snap: jump form
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        for (const e of st.entities) e.formFrac = Math.floor(e.formFrac * FORMS.length) / FORMS.length;
    }
    st.prevBass = bass;

    const cx = w * 0.5, cy = h * 0.5;
    const baseR = Math.min(w, h) * 0.12 * sizeScale;

    for (let ei = 0; ei < st.entities.length; ei++) {
        const e = st.entities[ei];
        e.orbitAng += orbitSpeed * 0.008 * (1 + bass * pulse * 0.5);
        e.formFrac  = (e.formFrac + morphSpeed * 0.003) % 1;
        e.pulse2    += 0.04;
        e.hue       = (e.hue + 0.2) % 360;

        const ex = cx + Math.cos(e.orbitAng) * w * e.orbitR;
        const ey = cy + Math.sin(e.orbitAng) * h * e.orbitR * 0.6;
        const r  = baseR * (1 + bass * pulse * 0.3 + Math.sin(e.pulse2) * 0.08);
        const alpha = 0.7 + bass * 0.2;

        // Determine active form
        const fi = formParam > 0 ? (formParam - 1) : Math.floor(e.formFrac * FORMS.length);
        const form = FORMS[fi % FORMS.length];

        switch (form) {
            case 'SPHERE':   drawSphere(ctx, ex, ey, r, e.hue, alpha, t, treble); break;
            case 'TENTACLE': drawTentacle(ctx, ex, ey, r, e.hue, alpha, t, mid, ei); break;
            case 'TREE':     drawTree(ctx, ex, ey, r, e.hue, alpha, t, bass, treeDepth); break;
            case 'CRYSTAL':  drawCrystal(ctx, ex, ey, r, e.hue, alpha, t, treble); break;
        }

        // Form label
        ctx.font = '7px monospace';
        ctx.fillStyle = `hsla(${e.hue},60%,70%,0.4)`;
        ctx.textAlign = 'center';
        ctx.fillText(form, ex, ey + r + 10);
        ctx.textAlign = 'left';
    }
}
