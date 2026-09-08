// ── Ikeda Oscilloscope ────────────────────────────────────────────────────────
// Clinical XY oscilloscope / Lissajous / phase-space display in the Ryoji Ikeda
// aesthetic. Three modes: XY Lissajous, waveform scroll, and Ikeda chaotic
// attractor path. Bass brightens phosphor trail; mid adds X2/Y2 harmonic;
// treble drives the decay rate. Graticule with precise tick marks.

const _state = new WeakMap();

class IkedaOscilloViz {
    constructor() {
        this.xBuf = new Float32Array(1024);
        this.yBuf = new Float32Array(1024);
        this.head = 0;
        // Ikeda attractor state
        this.ix = 0.1; this.iy = 0;
        this.t = 0; this.lastT = 0;}

    _stepIkeda(u) {
        const t2 = 0.4 - 6 / (1 + this.ix * this.ix + this.iy * this.iy);
        const nx = 1 + u * (this.ix * Math.cos(t2) - this.iy * Math.sin(t2));
        const ny =     u * (this.ix * Math.sin(t2) + this.iy * Math.cos(t2));
        this.ix = nx; this.iy = ny;
    }

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum) {

        const dt = Math.min(0.05, t - this.lastT); this.lastT = t;
        this.t += dt;
        const mode      = Math.round(Math.max(0, Math.min(2, p.mode ?? 0)));
        const hue       = (p.hue ?? 0) | 0;
        const mono      = (p.mono ?? 1) > 0.5;
        const glowV     = p.glow ?? 1;
        const fade      = Math.max(0.01, Math.min(0.95, p.fade ?? 0.12));
        const thick     = p.thickness ?? 1.2;
        const ikedaU    = Math.max(0.5, Math.min(0.99, p.ikedaU ?? 0.9));
        const harmonic  = p.harmonic ?? 0;
        const zoom      = p.zoom ?? 1;
        const afterglow = p.afterglow ?? 0.5;

        // Fade trail
        ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const sz = Math.min(cx, cy) * 0.84 * zoom;

        // Graticule
        const divs = 10;
        ctx.strokeStyle = mono ? "rgba(255,255,255,0.07)" : `hsla(${hue},50%,40%,0.09)`;
        ctx.lineWidth = 0.5;
        for (let i = -divs/2; i <= divs/2; i++) {
            const dx = cx + i * sz / (divs/2);
            const dy = cy + i * sz / (divs/2);
            ctx.beginPath(); ctx.moveTo(dx, cy-sz); ctx.lineTo(dx, cy+sz); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx-sz, dy); ctx.lineTo(cx+sz, dy); ctx.stroke();
        }
        // Axis crosshair ticks
        ctx.strokeStyle = mono ? "rgba(255,255,255,0.18)" : `hsla(${hue},70%,60%,0.2)`;
        for (let i = -divs*2; i <= divs*2; i++) {
            const d = i * sz / divs;
            ctx.beginPath(); ctx.moveTo(cx+d, cy-5); ctx.lineTo(cx+d, cy+5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx-5, cy+d); ctx.lineTo(cx+5, cy+d); ctx.stroke();
        }
        // Outer border
        ctx.strokeStyle = mono ? "rgba(255,255,255,0.25)" : `hsla(${hue},70%,60%,0.3)`;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(cx - sz, cy - sz, sz * 2, sz * 2);

        // Generate new sample point
        let xVal = 0, yVal = 0;
        if (mode === 2) {
            // Ikeda chaotic attractor
            for (let k = 0; k < 3; k++) this._stepIkeda(ikedaU + bass * 0.04);
            xVal = this.ix / 6;
            yVal = this.iy / 6;
        } else if (spectrum && spectrum.length > 0) {
            const bins = spectrum.length;
            const bassN = Math.max(1, (bins * 0.15) | 0);
            for (let i = 0; i < bassN; i++) xVal += spectrum[i] / bassN;
            const hiStart = (bins * 0.5) | 0;
            for (let i = hiStart; i < bins; i++) yVal += spectrum[i] / (bins - hiStart);
            xVal = (xVal * 2 - 1 + Math.sin(this.t * 0.9) * 0.06);
            yVal = (yVal * 2 - 1 + Math.sin(this.t * 1.4 + 1) * 0.06);
            // Harmonic second component (mid driven)
            if (harmonic > 0.1) {
                xVal += Math.sin(this.t * 2.1 + mid * Math.PI) * harmonic * 0.4;
                yVal += Math.sin(this.t * 3.3 + mid * Math.PI * 1.5) * harmonic * 0.4;
            }
        } else {
            xVal = Math.sin(this.t * 1.1 + mid * Math.PI);
            yVal = Math.sin(this.t * 1.7 + 0.5 + mid * Math.PI * 0.7);
        }

        this.xBuf[this.head] = xVal;
        this.yBuf[this.head] = yVal;
        this.head = (this.head + 1) % this.xBuf.length;

        const len = this.xBuf.length;
        const baseCol = mono ? [255, 255, 255] : [
            Math.round(128 + 127 * Math.cos(hue * Math.PI / 180)),
            Math.round(128 + 127 * Math.cos((hue + 120) * Math.PI / 180)),
            Math.round(128 + 127 * Math.cos((hue + 240) * Math.PI / 180))
        ];

        ctx.lineWidth = thick + bass * 1.5;
        ctx.lineCap = "round";

        // Draw path segments with age-based alpha for phosphor glow
        for (let seg = 0; seg < 4; seg++) {
            const segStart = (seg / 4) * len | 0;
            const segEnd   = ((seg + 1) / 4) * len | 0;
            const ageFrac  = (seg + 0.5) / 4;
            const alpha    = (afterglow * (1 - ageFrac) + (1 - afterglow) * (seg === 3 ? 1 : 0.1)) * (0.7 + bass * 0.3);
            ctx.strokeStyle = `rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${Math.min(1, alpha)})`;
            if (seg === 3 && glowV > 0.1) {ctx.shadowBlur = 0; }
            ctx.beginPath();
            for (let k = segStart; k < segEnd; k++) {
                const i = (this.head + k) % len;
                let px, py;
                if (mode === 0 || mode === 2) {
                    px = cx + this.xBuf[i] * sz;
                    py = cy - this.yBuf[i] * sz;
                } else {
                    px = cx - sz + (k / len) * sz * 2;
                    py = cy - this.xBuf[i] * sz;
                }
                k === segStart ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Phosphor dot at current position
        const curI = (this.head - 1 + len) % len;
        let dotX, dotY;
        if (mode === 0 || mode === 2) { dotX = cx + this.xBuf[curI] * sz; dotY = cy - this.yBuf[curI] * sz; }
        else { dotX = cx + sz; dotY = cy - this.xBuf[curI] * sz; }
        ctx.fillStyle = mono ? `rgba(255,255,255,${0.9 + bass * 0.1})` : `hsla(${hue},100%,90%,0.95)`;
ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(dotX, dotY, thick + 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Labels
        ctx.fillStyle = mono ? "rgba(255,255,255,0.25)" : `hsla(${hue},60%,60%,0.3)`;
        ctx.font = "10px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
        ctx.fillText(["XY LISSAJOUS","WAVEFORM","IKEDA ATTRACTOR"][mode], cx - sz + 4, cy + sz - 2);
        ctx.textAlign = "right";
        ctx.fillText(`U=${ikedaU.toFixed(2)}`, cx + sz - 4, cy + sz - 2);
    }
}

export const ikedaOscilloParams = () => ({
    mode:      { base: 0,    min: 0,    max: 2,   mod: { source: "" } },
    thickness: { base: 1.2,  min: 0.5,  max: 5,   mod: { source: "" } },
    glow:      { base: 1,    min: 0,    max: 3,   mod: { source: "" } },
    fade:      { base: 0.12, min: 0.01, max: 0.9, mod: { source: "" } },
    afterglow: { base: 0.5,  min: 0,    max: 1,   mod: { source: "" } },
    mono:      { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    hue:       { base: 0,    min: 0,    max: 360, mod: { source: "" } },
    ikedaU:    { base: 0.9,  min: 0.5,  max: 0.99,mod: { source: "" } },
    harmonic:  { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    zoom:      { base: 1,    min: 0.3,  max: 2.5, mod: { source: "" } },
});

export function drawIkedaOscillo(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IkedaOscilloViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble, sp);
}
