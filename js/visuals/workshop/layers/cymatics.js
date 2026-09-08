// ── Cymatics ──────────────────────────────────────────────────────────────────
// Chladni standing-wave patterns — the geometry of sound made visible.
// A 200×200 field evaluates sin(n·π·x)·sin(m·π·y) + cross-terms.
// Bass morphs n/m modes toward higher harmonics; mid adds a rotating overtone;
// treble introduces a spiral distortion. Anti-aliased nodal lines glow in HSL.

const _state = new WeakMap();
const RES = 200;

class Cymatics {
    constructor() {
        this.oc    = new OffscreenCanvas(RES, RES);
        this.octx  = this.oc.getContext("2d");
        this.img   = this.octx.createImageData(RES, RES);
        this.modeN = 3.0;
        this.modeM = 4.0;
        this.rotPhase = 0;
        this.spiralPhase = 0;
        this.pulse = 0;
        this.prevBass = 0;
    }

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum) {
        const targetN  = p.modeN;
        const targetM  = p.modeM;
        const speed    = p.speed * 0.04;
        // Bass pushes modes toward higher integers
        const pushN    = targetN + bass * 4 + this.pulse * 2;
        const pushM    = targetM + bass * 3 + this.pulse * 1.5;
        this.modeN    += (pushN - this.modeN) * speed;
        this.modeM    += (pushM - this.modeM) * speed;

        const n = this.modeN, m = this.modeM;
        const thick = p.thickness;
        const hue   = p.hue;
        const hueRange = p.hueRange;
        const glow  = p.glow;
        const sym   = Math.round(Math.max(1, Math.min(8, p.symmetry)));
        const spiral = p.spiral;

        // Beat detection
        if (bass > 0.55 && bass > this.prevBass + 0.08) this.pulse = 1;
        this.prevBass = bass;
        this.pulse *= 0.88;

        // Mid rotates an overtone phase — creates shifting figure-8 resonance
        this.rotPhase += mid * 0.08 + 0.01;
        this.spiralPhase += treble * 0.04;

        // Overtone modes from treble frequency content
        const tp = Math.round(n * 0.75 + 1);
        const tq = Math.round(m * 0.6 + 1);
        const tAmp = treble * 0.5 + this.pulse * 0.3;

        // Rotating cross-mode from mid
        const rp = Math.round(n * 1.3 + 0.5);
        const rq = Math.round(m * 1.1 + 0.5);
        const rAmp = mid * 0.35;
        const cosR = Math.cos(this.rotPhase), sinR = Math.sin(this.rotPhase);

        const PI = Math.PI;
        const data = this.img.data;

        for (let py = 0; py < RES; py++) {
            const fy = py / (RES - 1);
            for (let px = 0; px < RES; px++) {
                const fx = px / (RES - 1);

                // Optional spiral warp — treble distorts the field geometry
                let ux = fx, uy = fy;
                if (spiral > 0.01) {
                    const dx = fx - 0.5, dy = fy - 0.5;
                    const angle = Math.atan2(dy, dx);
                    const r2 = Math.sqrt(dx*dx + dy*dy);
                    const sAngle = angle + r2 * spiral * 8 + this.spiralPhase;
                    ux = 0.5 + Math.cos(sAngle) * r2;
                    uy = 0.5 + Math.sin(sAngle) * r2;
                }

                // Symmetry — fold coordinates
                let sx = ux, sy = uy;
                if (sym > 1) {
                    const angle2 = Math.atan2(sy - 0.5, sx - 0.5);
                    const r3     = Math.sqrt((sx-0.5)**2 + (sy-0.5)**2);
                    const segAng = PI * 2 / sym;
                    const foldedA = ((angle2 % segAng) + segAng) % segAng;
                    sx = 0.5 + Math.cos(foldedA) * r3;
                    sy = 0.5 + Math.sin(foldedA) * r3;
                }

                // Chladni equation + overtone + rotating cross-mode
                const f0 = Math.sin(n*PI*sx) * Math.sin(m*PI*sy)
                         + Math.sin(m*PI*sx) * Math.sin(n*PI*sy);
                const f1 = tAmp * Math.sin(tp*PI*sx) * Math.sin(tq*PI*sy);
                // Rotating cross-term: coordinates rotated by mid-phase
                const rx2 = cosR*(sx-0.5) - sinR*(sy-0.5) + 0.5;
                const ry2 = sinR*(sx-0.5) + cosR*(sy-0.5) + 0.5;
                const f2  = rAmp * Math.sin(rp*PI*rx2) * Math.sin(rq*PI*ry2);

                const f = f0 + f1 + f2;

                // Anti-aliased nodal line distance
                const dist = Math.abs(f);
                const thickAdj = thick * (1 + this.pulse * 0.6);
                const onLine   = dist < thickAdj;
                const aa       = onLine ? Math.pow(1 - dist / thickAdj, 1.5) : 0;

                const idx = (py * RES + px) * 4;
                if (aa > 0.01) {
                    // Color varies with position along the nodal line
                    const colorPhase = (fx + fy) * hueRange + hue + this.pulse * 60 + bass * 40;
                    const ch = ((colorPhase % 360) + 360) % 360;
                    const lum = 0.6 + 0.4 * aa;
                    const sat = 0.75 + mid * 0.25;
                    // HSL to RGB inline
                    const k = (n2) => (n2 + ch/30) % 12;
                    const a2 = sat * Math.min(lum, 1-lum);
                    const fc = (n2) => lum - a2 * Math.max(-1, Math.min(k(n2)-3, Math.min(9-k(n2),1)));
                    data[idx]   = Math.min(255, fc(0) * 255 * aa * (1 + this.pulse * 0.4)) | 0;
                    data[idx+1] = Math.min(255, fc(8) * 255 * aa * (1 + this.pulse * 0.4)) | 0;
                    data[idx+2] = Math.min(255, fc(4) * 255 * aa * (1 + this.pulse * 0.4)) | 0;
                    data[idx+3] = Math.min(255, aa * 255) | 0;
                } else {
                    data[idx] = data[idx+1] = data[idx+2] = 0;
                    data[idx+3] = 200;
                }
            }
        }

        this.octx.putImageData(this.img, 0, 0);

        ctx.save();
        if (glow > 0) {
            ctx.shadowBlur = 0;
        }
        // Slight scaling keeps the pattern centered and crisp
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(this.oc, 0, 0, w, h);
        ctx.restore();

        // Beat bloom pulse
        if (this.pulse > 0.15) {
            ctx.globalCompositeOperation = "lighter";
            const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w,h)*0.45);
            grad.addColorStop(0, `hsla(${hue},100%,70%,${this.pulse * 0.18})`);
            grad.addColorStop(1, `hsla(${hue},100%,50%,0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const cymaticsParams = () => ({
    hue:       { base: 55,   min: 0,    max: 360, mod: { source: "" } },
    hueRange:  { base: 120,  min: 0,    max: 360, mod: { source: "" } },
    modeN:     { base: 3.0,  min: 2,    max: 14,  mod: { source: "" } },
    modeM:     { base: 4.0,  min: 2,    max: 14,  mod: { source: "" } },
    thickness: { base: 0.1,  min: 0.01, max: 0.5, mod: { source: "" } },
    speed:     { base: 0.5,  min: 0.02, max: 3,   mod: { source: "" } },
    symmetry:  { base: 1,    min: 1,    max: 8,   mod: { source: "" } },
    spiral:    { base: 0,    min: 0,    max: 1.5, mod: { source: "" } },
    glow:      { base: 1.5,  min: 0,    max: 5,   mod: { source: "" } },
    brightness:{ base: 1,    min: 0.3,  max: 2,   mod: { source: "" } },
    contrast:  { base: 1,    min: 0.5,  max: 3,   mod: { source: "" } },
});

export function drawCymatics(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new Cymatics(); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble, s);
}
