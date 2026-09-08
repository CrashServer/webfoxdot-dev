// ── Biomechanical Spine ───────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION BiomechanicalSpineScene (Three.js → Canvas2D).
// Multiple segmented spines with vertebrae joints, tendrils, and mechanical ribs.
// Bass = flex burst. Mid = tendril growth. Treble = glow brightness.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function makeSpine(index, nSpines, w, h, nSegs) {
    const offset = (index / nSpines - 0.5) * w * 0.7;
    const segs = [];
    for (let i = 0; i < nSegs; i++) {
        segs.push({
            x: w / 2 + offset,
            y: h * 0.1 + i * (h * 0.8 / nSegs),
            angle: 0,
            radius: 8 + Math.sin(i * 0.5) * 4,
        });
    }
    return { segs, offset, phase: index * 0.9, flexPhase: 0 };
}

export const bioSpineParams = () => ({
    spines:   { base: 3,    min: 1,   max: 7,   step: 1, mod: { source: "" } },
    segments: { base: 18,   min: 6,   max: 30,  step: 1, mod: { source: "" } },
    hue:      { base: 120,  min: 0,   max: 360,          mod: { source: "" } }, // main (green)
    hue2:     { base: 60,   min: 0,   max: 360,          mod: { source: "" } }, // accent (mechanical)
    speed:    { base: 0.5,  min: 0,   max: 2,            mod: { source: "" } },
    flex:     { base: 0.4,  min: 0,   max: 1,            mod: { source: "" } }, // spine sway amplitude
    ribs:     { base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } }, // mechanical ribs
    tendrils: { base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } },
    pulse:    { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    glow:     { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    thick:    { base: 0.7,  min: 0.1, max: 2,            mod: { source: "" } },
    bgAlpha:  { base: 0.88, min: 0,   max: 1,            mod: { source: "" } },
});

export function drawBioSpine(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nSpines = Math.round(Math.max(1, Math.min(7, p.spines ?? 3)));
    const nSegs   = Math.round(Math.max(6, Math.min(30, p.segments ?? 18)));
    const hue     = p.hue ?? 120;
    const hue2    = p.hue2 ?? 60;
    const speed   = p.speed ?? 0.5;
    const flex    = p.flex ?? 0.4;
    const showRibs = (p.ribs ?? 1) > 0.5;
    const showTend = (p.tendrils ?? 1) > 0.5;
    const pulse   = p.pulse ?? 0.7;
    const glow    = p.glow ?? 0.7;
    const thick   = p.thick ?? 0.7;
    const bgAlpha = p.bgAlpha ?? 0.88;

    let st = _st.get(ctx);
    if (!st || st.nSpines !== nSpines || st.nSegs !== nSegs) {
        st = {
            spines: Array.from({ length: nSpines }, (_, i) => makeSpine(i, nSpines, w, h, nSegs)),
            nSpines, nSegs, lastT: t, flexBurst: 0, prevBass: 0,
        };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    if (bass > 0.5 && bass > st.prevBass + 0.1) st.flexBurst = bass * pulse;
    st.prevBass = bass;
    st.flexBurst *= 0.88;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    for (let si = 0; si < st.spines.length; si++) {
        const spine = st.spines[si];
        const spineHue = (hue + si * 25) % 360;
        const spineOffset = spine.offset;

        // Update segment positions with organic sway
        const flexAmt = flex * (1 + st.flexBurst * 1.5 + bass * pulse * 0.6);
        for (let i = 0; i < spine.segs.length; i++) {
            const seg = spine.segs[i];
            const frac = i / (nSegs - 1);
            // Slow organic wave
            const wave = Math.sin(frac * Math.PI * 2 + t * speed + spine.phase)
                       + Math.sin(frac * Math.PI * 3.7 + t * speed * 0.7 + spine.phase * 1.3) * 0.4;
            seg.x = w / 2 + spineOffset + wave * w * 0.12 * flexAmt;
            seg.y = h * 0.08 + frac * h * 0.84;
            // Radius pulses with bass
            seg.radius = (8 + Math.sin(i * 0.6) * 3) * (1 + bass * pulse * 0.5);
        }

        // Draw spine cord (bezier through segs)
        if (glow > 0.05) {
            ctx.shadowBlur = glow * 20 * (1 + treble * 0.5);
            ctx.shadowColor = `hsl(${spineHue},100%,50%)`;
        }
        ctx.strokeStyle = `hsl(${spineHue},80%,${30 + treble * 25}%)`;
        ctx.lineWidth = thick * 2.5;
        ctx.beginPath();
        ctx.moveTo(spine.segs[0].x, spine.segs[0].y);
        for (let i = 1; i < spine.segs.length - 1; i++) {
            const cp = spine.segs[i];
            const np = spine.segs[i + 1];
            ctx.quadraticCurveTo(cp.x, cp.y, (cp.x + np.x) / 2, (cp.y + np.y) / 2);
        }
        const last = spine.segs[nSegs - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        // Vertebrae circles
        for (let i = 0; i < spine.segs.length; i++) {
            const seg = spine.segs[i];
            const r = seg.radius;
            const frac = i / (nSegs - 1);

            // Main vertebra
            const vLight = 25 + treble * 20 + bass * pulse * 15;
            ctx.fillStyle = `hsl(${spineHue},65%,${vLight}%)`;
            ctx.beginPath(); ctx.arc(seg.x, seg.y, r, 0, TAU); ctx.fill();

            // Inner glow ring
            ctx.strokeStyle = `hsl(${spineHue},90%,${40 + treble * 30}%)`;
            ctx.lineWidth = thick * 0.8;
            ctx.beginPath(); ctx.arc(seg.x, seg.y, r * 0.6, 0, TAU); ctx.stroke();

            // Mechanical ribs
            if (showRibs && i % 2 === 0) {
                const ribLen = r * (2.5 + frac * 1.5) * (1 + mid * 0.3);
                const baseAng = Math.PI / 2 + Math.sin(frac * Math.PI + t * speed * 0.3) * 0.15;
                for (const side of [-1, 1]) {
                    const ang = baseAng + side * Math.PI / 2;
                    const ex = seg.x + Math.cos(ang) * ribLen;
                    const ey = seg.y + Math.sin(ang) * ribLen;
                    // Rib beam
                    ctx.strokeStyle = `hsl(${hue2},60%,${30 + treble * 20}%)`;
                    ctx.lineWidth = thick * 0.5;
                    ctx.shadowBlur = 0;
                    ctx.beginPath(); ctx.moveTo(seg.x, seg.y); ctx.lineTo(ex, ey); ctx.stroke();
                    // Rib joint
                    ctx.fillStyle = `hsl(${hue2},70%,40%)`;
                    ctx.beginPath(); ctx.arc(ex, ey, r * 0.25, 0, TAU); ctx.fill();
                    // Connector strut
                    if (i + 2 < spine.segs.length) {
                        const nSeg = spine.segs[i + 2];
                        const ang2 = baseAng + side * Math.PI / 2;
                        const ex2 = nSeg.x + Math.cos(ang2) * ribLen * 0.8;
                        const ey2 = nSeg.y + Math.sin(ang2) * ribLen * 0.8;
                        ctx.strokeStyle = `hsla(${hue2},50%,20%,0.5)`;
                        ctx.lineWidth = thick * 0.3;
                        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex2, ey2); ctx.stroke();
                    }
                }
                // Reset shadow after ribs
                if (glow > 0.05) { ctx.shadowBlur = glow * 10; ctx.shadowColor = `hsl(${spineHue},100%,50%)`; }
            }
        }
        ctx.shadowBlur = 0;

        // Tendrils at spine tips and mid points
        if (showTend) {
            const tendrilPoints = [0, Math.floor(nSegs / 2), nSegs - 1];
            for (const ti of tendrilPoints) {
                const origin = spine.segs[ti];
                const nTendrils = 3 + Math.floor(mid * 2);
                for (let k = 0; k < nTendrils; k++) {
                    const ang0 = (k / nTendrils) * TAU + t * speed * 0.3 + spine.phase + ti * 0.2;
                    const tLen = origin.radius * (2 + mid * 3 + Math.sin(t * speed + k) * 0.5);
                    ctx.strokeStyle = `hsla(${spineHue},70%,${35 + treble * 20}%,0.4)`;
                    ctx.lineWidth = thick * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(origin.x, origin.y);
                    // Curvy tendril via quadratic
                    const cpx = origin.x + Math.cos(ang0 + 0.4) * tLen * 0.5;
                    const cpy = origin.y + Math.sin(ang0 + 0.4) * tLen * 0.5;
                    const ex2 = origin.x + Math.cos(ang0) * tLen;
                    const ey2 = origin.y + Math.sin(ang0) * tLen;
                    ctx.quadraticCurveTo(cpx, cpy, ex2, ey2);
                    ctx.stroke();
                    // Tip dot
                    ctx.fillStyle = `hsla(${spineHue},90%,60%,0.6)`;
                    ctx.beginPath(); ctx.arc(ex2, ey2, 1.5, 0, TAU); ctx.fill();
                }
            }
        }
    }
    ctx.shadowBlur = 0;
}
