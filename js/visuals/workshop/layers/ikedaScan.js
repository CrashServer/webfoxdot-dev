// ── Ikeda Scan ────────────────────────────────────────────────────────────────
// Ryoji Ikeda "test pattern" horizontal band system. Each band has its own
// signal type: sine wave, binary noise, spectrum bars, scrolling data dots,
// and a new barcode strip. Ruler ticks on both margins; channel labels.
// Bass flashes the entire board; treble drives the binary noise rate;
// mid modulates waveform amplitude.

const _state = new WeakMap();

class IkedaScanViz {
    constructor() {
        this.noise = new Uint8Array(512);
        this.noiseTick = 0;
        this.flashVal = 0;
        this.scrollOffset = 0;
        this.t = 0; this.lastT = 0;}

    _refreshNoise(rate) {
        this.noiseTick++;
        if (this.noiseTick % 2 !== 0) return;
        for (let i = 0; i < this.noise.length; i++)
            this.noise[i] = Math.random() < rate ? 1 : 0;
    }

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum) {

        const dt = Math.min(0.05, t - this.lastT); this.lastT = t;
        this.t += dt;
        const bands    = Math.round(Math.max(2, Math.min(10, p.bands ?? 5)));
        const hue      = (p.hue   ?? 0) | 0;
        const mono     = (p.mono  ?? 1) > 0.5;
        const speed    = p.speed  ?? 1;
        const glow     = p.glow   ?? 0.5;
        const signalMix= p.signalMix ?? 0; // cycles through signal types differently
        const rulerW   = Math.round(p.rulerWidth ?? 20);
        const showCH   = (p.showLabels ?? 1) > 0.5;
        const contrast = p.contrast ?? 1;

        if (bass > 0.5) this.flashVal = Math.min(1, this.flashVal + bass * 0.7);
        this.flashVal *= 0.87;
        this.scrollOffset += speed / 60;
        this._refreshNoise(0.25 + treble * 0.55);

        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);

        const bh     = h / bands;
        const innerX = rulerW;
        const innerW = w - rulerW * 2;

        const SIGNAL_TYPES = ["sine", "binary", "spectrum", "dots", "barcode"];
        const numTypes = SIGNAL_TYPES.length;

        for (let b = 0; b < bands; b++) {
            const y0 = b * bh, y1 = (b + 1) * bh;
            const midY = y0 + bh / 2;
            const sType = SIGNAL_TYPES[(b + Math.round(signalMix * numTypes)) % numTypes];

            const bandHue = mono ? hue : (hue + b * (360 / bands)) % 360;
            const col = mono ? `rgba(255,255,255,` : `hsla(${bandHue},90%,65%,`;

            // Band separator
            ctx.fillStyle = mono ? "rgba(255,255,255,0.12)" : `hsla(${bandHue},60%,40%,0.15)`;
            ctx.fillRect(0, y0, w, 0.8);

            // Ruler ticks
            const ticks = 10;
            ctx.strokeStyle = mono ? "rgba(255,255,255,0.55)" : `hsla(${bandHue},70%,65%,0.55)`;
            ctx.lineWidth = 0.8;
            for (let ti = 0; ti <= ticks; ti++) {
                const ty = y0 + (ti / ticks) * bh;
                const tl = ti % 5 === 0 ? rulerW : rulerW * 0.45;
                ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(tl, ty); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(w, ty); ctx.lineTo(w - tl, ty); ctx.stroke();
            }
            // Vertical ruler line
            ctx.strokeStyle = mono ? "rgba(255,255,255,0.2)" : `hsla(${bandHue},60%,50%,0.2)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(rulerW, y0); ctx.lineTo(rulerW, y1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w - rulerW, y0); ctx.lineTo(w - rulerW, y1); ctx.stroke();

            if (sType === "sine") {
                const freq = 0.5 + b * 0.6;
                const amp  = bh * 0.36 * (0.35 + mid * 0.65) * contrast;
                if (glow > 0) {ctx.shadowBlur = 0; }
                ctx.strokeStyle = col + `${0.75 + bass * 0.25})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let x = 0; x <= innerW; x++) {
                    const nx = x / innerW;
                    const py = midY + Math.sin(nx * Math.PI * 2 * freq + this.t * speed * 2.5) * amp;
                    x === 0 ? ctx.moveTo(innerX + x, py) : ctx.lineTo(innerX + x, py);
                }
                ctx.stroke(); ctx.shadowBlur = 0;

            } else if (sType === "binary") {
                const pixW = Math.max(2, (innerW / 256) | 0);
                const count = Math.min(256, (innerW / pixW) | 0);
                for (let x = 0; x < count; x++) {
                    if (this.noise[x % this.noise.length]) {
                        const lum = (0.5 + treble * 0.5) * contrast;
                        ctx.fillStyle = col + `${lum})`;
                        ctx.fillRect(innerX + x * pixW, y0 + bh * 0.12, pixW - 1, bh * 0.76);
                    }
                }

            } else if (sType === "spectrum") {
                if (spectrum && spectrum.length > 0) {
                    const n = Math.min(spectrum.length, 96);
                    const bw2 = innerW / n;
                    for (let i = 0; i < n; i++) {
                        const v   = Math.pow(Math.min(1, spectrum[i]), 1 / 1.4) * contrast;
                        const barH = bh * 0.82 * v;
                        if (mono) ctx.fillStyle = `rgba(255,255,255,${0.25 + v * 0.75})`;
                        else      ctx.fillStyle = `hsla(${hue + i * 2},90%,${35 + v * 45}%,0.95)`;
                        ctx.fillRect(innerX + i * bw2, y1 - barH - bh * 0.09, bw2 - 1, barH);
                    }
                }

            } else if (sType === "dots") {
                const scroll = this.scrollOffset % 1;
                const dotCount = Math.round(innerW / 7);
                for (let d = 0; d < dotCount; d++) {
                    const nx = ((d / dotCount) + scroll) % 1;
                    const px = innerX + nx * innerW;
                    const bin = (d / dotCount * (spectrum?.length ?? 1)) | 0;
                    const sv  = spectrum ? spectrum[bin] : 0.3;
                    const py2 = midY + (sv - 0.5) * bh * 0.75 * contrast;
                    const sz  = 1.5 + sv * 4;
                    ctx.fillStyle = col + `${0.6 + sv * 0.4})`;
                    ctx.beginPath(); ctx.arc(px, py2, sz, 0, Math.PI * 2); ctx.fill();
                }

            } else { // barcode
                const barW = Math.max(1, (innerW / 160) | 0);
                for (let x = 0; x < 160; x++) {
                    const bin = (x / 160 * (spectrum?.length ?? 1)) | 0;
                    const v   = spectrum ? Math.min(1, spectrum[bin] * 1.5) : Math.random() * 0.5;
                    const on  = v > (0.3 + (1 - contrast) * 0.3);
                    if (on) {
                        const barH = bh * (0.3 + v * 0.65);
                        ctx.fillStyle = col + `${0.7 + v * 0.3})`;
                        ctx.fillRect(innerX + x * barW, midY - barH/2, barW - 0.5, barH);
                    }
                }
            }

            // Channel label
            if (showCH) {
                ctx.fillStyle = mono ? "rgba(255,255,255,0.28)" : `hsla(${bandHue},60%,60%,0.32)`;
                ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
                ctx.fillText(`CH${b.toString().padStart(2,"0")} ${sType.toUpperCase().substring(0,4)}`, 2, y0 + 3);
                ctx.textAlign = "right";
                ctx.fillText(`${((b+1)/bands*100)|0}%`, w - 2, y0 + 3);
            }
        }

        // Bass flash
        if (this.flashVal > 0.08) {
            ctx.fillStyle = `rgba(255,255,255,${this.flashVal * 0.12})`;
            ctx.fillRect(0, 0, w, h);
        }
    }
}

export const ikedaScanParams = () => ({
    bands:       { base: 5,    min: 2,   max: 10,  mod: { source: "" } },
    speed:       { base: 1,    min: 0.1, max: 5,   mod: { source: "" } },
    glow:        { base: 0.5,  min: 0,   max: 2,   mod: { source: "" } },
    mono:        { base: 1,    min: 0,   max: 1,   mod: { source: "" } },
    hue:         { base: 0,    min: 0,   max: 360, mod: { source: "" } },
    signalMix:   { base: 0,    min: 0,   max: 1,   mod: { source: "" } },
    rulerWidth:  { base: 20,   min: 8,   max: 50,  mod: { source: "" } },
    showLabels:  { base: 1,    min: 0,   max: 1,   mod: { source: "" } },
    contrast:    { base: 1,    min: 0.2, max: 2,   mod: { source: "" } },
    noiseRate:   { base: 0.5,  min: 0,   max: 1,   mod: { source: "" } },
});

export function drawIkedaScan(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IkedaScanViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    ctx.clearRect(0, 0, w, h);
    viz.frame(ctx, w, h, p, t, bass, mid, treble, sp);
}
