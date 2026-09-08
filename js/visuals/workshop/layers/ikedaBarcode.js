// ── Ikeda Barcode ─────────────────────────────────────────────────────────────
// Scrolling spectrogram in the style of Ryoji Ikeda's "test pattern" series.
// Each frame draws a new vertical slice from the audio spectrum and scrolls left.
// Bass drives scroll burst speed; mid adds column glitch artifacts; treble
// introduces Lissajous scan traces overlaid on the barcode field.

const _state = new WeakMap();

class IkedaBarcodeViz {
    constructor() {
        this.off = null; this.offCtx = null;
        this.pulse = 0; this.prevBass = 0;
        this.scanY = 0;
        this.glitchBars = [];
        this.hexRows = [];
        this.tick = 0;
    }

    _ensureOff(w, h) {
        if (!this.off || this.off.width !== w || this.off.height !== h) {
            this.off = new OffscreenCanvas(w, h);
            this.offCtx = this.off.getContext("2d");
            this.offCtx.fillStyle = "#000"; this.offCtx.fillRect(0, 0, w, h);
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum) {
        const speed   = Math.max(1, Math.round(p.speed));
        const binary  = p.binary > 0.5;
        const hue     = p.hue;
        const mono    = p.mono > 0.5;
        const gamma   = Math.max(0.2, p.gamma);
        const scanLines = p.scanLines > 0.5;
        const lissajous = p.lissajous;
        const glitch  = p.glitch;
        const zoomBeat = p.zoomBeat > 0.5;

        this.tick++;

        // Beat detection
        if (bass > 0.58 && bass > this.prevBass + 0.08) {
            this.pulse = 1;
            // Spawn glitch bars on kick
            const nGlitch = 1 + Math.floor(glitch * 4);
            for (let g = 0; g < nGlitch; g++) {
                this.glitchBars.push({
                    y: Math.random() * h,
                    height: 3 + Math.random() * 15,
                    life: 1,
                    decay: 0.12 + Math.random() * 0.15,
                    dx: (Math.random() - 0.5) * 12 * glitch,
                });
            }
        }
        this.prevBass = bass;
        this.pulse *= 0.87;

        // Mid triggers column corruption — copy a column to a random offset
        const midGlitch = mid > 0.45 && Math.random() < mid * 0.3;

        this._ensureOff(w, h);
        const oc = this.offCtx;

        // Scroll left by speed (burst-speed on beat)
        const effectiveSpeed = speed + ((this.pulse * speed * 2.5) | 0);
        const es = Math.max(1, effectiveSpeed);

        if (zoomBeat && this.pulse > 0.3) {
            // Beat: zoom the whole buffer slightly instead of just shifting
            const zf = 1 + this.pulse * 0.04;
            const sw = w / zf, sh2 = h / zf;
            const ox = (w - sw) / 2, oy2 = (h - sh2) / 2;
            oc.drawImage(this.off, 0, 0, w, h, ox, oy2, sw, sh2);
            oc.drawImage(this.off, ox, oy2, sw, sh2, 0, 0, w, h);
        }

        oc.drawImage(this.off, -es, 0, w, h);
        oc.fillStyle = "#000"; oc.fillRect(w - es, 0, es + 1, h);

        // Draw new spectrum slice on the right edge
        if (spectrum && spectrum.length) {
            const bins    = spectrum.length;
            const sliceH  = h / bins;
            const bassEnd = Math.max(1, (bins * 0.15) | 0);
            const midEnd  = Math.max(1, (bins * 0.5) | 0);

            for (let i = 0; i < bins; i++) {
                let v = Math.min(1, Math.pow(Math.max(0, spectrum[i]), 1 / gamma));
                if (binary && v < (0.3 - this.pulse * 0.2)) continue;
                if (v < 0.004) continue;

                const py = i * sliceH;
                const ph = Math.ceil(sliceH) + 1;

                if (mono) {
                    const g = Math.min(255, (v + this.pulse * 0.25) * 255) | 0;
                    // Intensity modulation: beats flash white
                    const beat255 = Math.min(255, g + (this.pulse * 80) | 0);
                    oc.fillStyle = `rgb(${beat255},${beat255},${beat255})`;
                } else {
                    // Band-colored: bass=warm, mid=neutral, treble=cool
                    let bandHue;
                    if (i < bassEnd)       bandHue = (hue + 20 + this.pulse * 50) % 360;
                    else if (i < midEnd)   bandHue = (hue + this.pulse * 30) % 360;
                    else                   bandHue = (hue - 40 + this.pulse * 30 + 360) % 360;
                    const sat  = 65 + v * 35 + this.pulse * 20;
                    const lum  = v * 60 + this.pulse * 20;
                    oc.fillStyle = `hsl(${bandHue},${sat}%,${lum}%)`;
                }
                oc.fillRect(w - es, py, es, ph);
            }
        }

        // Mid: corrupt a random column (copy a column from elsewhere)
        if (midGlitch) {
            const srcX = Math.floor(Math.random() * (w - es));
            const dstX = w - es - Math.floor(Math.random() * 40 * mid);
            if (dstX > 0 && dstX < w) {
                oc.drawImage(this.off, srcX, 0, es, h, dstX, 0, es, h);
            }
        }

        // Horizontal sync ticks every 64 rows
        oc.fillStyle = `rgba(255,255,255,${0.1 + this.pulse * 0.35})`;
        for (let y = 0; y < h; y += 64) oc.fillRect(w - es, y, es, 1);

        // Draw glitch overlay bars
        this.glitchBars = this.glitchBars.filter(g => g.life > 0.05);
        for (const g of this.glitchBars) {
            const alpha = g.life * 0.6;
            oc.globalCompositeOperation = "screen";
            oc.fillStyle = `rgba(255,255,255,${alpha})`;
            oc.fillRect(0, g.y, w, g.height);
            oc.globalCompositeOperation = "source-over";
            g.life -= g.decay;
        }

        ctx.drawImage(this.off, 0, 0);

        // Scanlines overlay
        if (scanLines) {
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
        }

        // Lissajous trace — treble draws a sinusoidal scan line
        if (lissajous > 0 && treble > 0.05) {
            ctx.strokeStyle = `hsla(${hue},90%,70%,${treble * lissajous * 0.7})`;
            ctx.lineWidth   = 1 + lissajous;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            const freqX = 3 + treble * 4, freqY = 2 + bass * 3;
            for (let px = 0; px <= w; px += 2) {
                const py = h/2 + Math.sin(px / w * Math.PI * 2 * freqX + t * 3) * h * 0.3 * lissajous
                         + Math.sin(px / w * Math.PI * 2 * freqY + t * 1.7 + 1) * h * 0.1;
                px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Telemetry overlay
        if (p.telemetry > 0.5) {
            const fs = Math.max(9, Math.min(w, h) * 0.011) | 0;
            ctx.font = `${fs}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(255,255,255,0.75)`;
            ctx.textAlign = "left";
            ctx.fillText(`BASS ${bass.toFixed(3)}  MID ${mid.toFixed(3)}  HI ${treble.toFixed(3)}`, fs, fs * 1.4);
            ctx.textAlign = "right";
            if (this.tick % 6 === 0) {
                this.hexRows = Array.from({length:4}, () =>
                    Array.from({length:10}, () => "0123456789ABCDEF"[(Math.random()*16)|0]).join(""));
            }
            this.hexRows.forEach((row, i) => ctx.fillText(row, w - fs, h - fs*(4.2 - i*1.3)));
        }
    }
}

export const ikedaBarcodeParams = () => ({
    speed:     { base: 2,    min: 1,    max: 12,  mod: { source: "" } },
    gamma:     { base: 1.3,  min: 0.2,  max: 5,   mod: { source: "" } },
    binary:    { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    mono:      { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    hue:       { base: 0,    min: 0,    max: 360, mod: { source: "" } },
    glitch:    { base: 0.5,  min: 0,    max: 2,   mod: { source: "" } },
    lissajous: { base: 0,    min: 0,    max: 2,   mod: { source: "" } },
    scanLines: { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    zoomBeat:  { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    telemetry: { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    brightness:{ base: 1,    min: 0.3,  max: 2,   mod: { source: "" } },
});

export function drawIkedaBarcode(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IkedaBarcodeViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble, sp);
}
