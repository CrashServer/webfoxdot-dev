// ── Circuit Scanner ───────────────────────────────────────────────────────────
// PCB with Manhattan-routed neon traces, pads, vias, chip packages, and bus
// ribbons. A scan line sweeps the board; mid brightens component glows;
// treble flickers data LEDs; bass triggers a board-wide surge flash.

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

const COMPONENT_LABELS = ["MCU","DSP","FPGA","ADC","DAC","RAM","ROM","PLL","OSC","PWR","USB","ETH","SPI","I2C","DMA","IRQ"];

class CircuitViz {
    constructor() { this.built = false; this.surge = 0; this.t = 0; this.lastT = 0;}

    build(w, h) {
        this.built = true; this._w = w; this._h = h;
        const U = Math.min(w, h);
        this.traces = []; this.pads = []; this.chips = []; this.buses = []; this.leds = [];

        // Manhattan traces
        for (let i = 0; i < 110; i++) {
            let x = rnd(0, w), y = rnd(0, h);
            const pts = [[x, y]];
            const n = 2 + (Math.random() * 5 | 0);
            for (let s = 0; s < n; s++) {
                if (Math.random() < 0.5) x = Math.max(0, Math.min(w, x + rnd(-1, 1) * U * 0.2));
                else y = Math.max(0, Math.min(h, y + rnd(-1, 1) * U * 0.2));
                pts.push([x, y]);
            }
            // Color layers: green signal, yellow power, cyan data
            const layer = Math.random();
            const col = layer < 0.5 ? [0.2, 1, 0.6] : layer < 0.75 ? [1, 0.9, 0.2] : [0.2, 0.9, 1];
            this.traces.push({ pts, col, width: rnd(0.5, 1.5) });
        }

        // Pads and vias
        for (let i = 0; i < 80; i++)
            this.pads.push({ x: rnd(0, w), y: rnd(0, h), r: U * rnd(0.003, 0.009), via: Math.random() < 0.45 });

        // Chip packages
        for (let i = 0; i < 12; i++) {
            const cw = U * rnd(0.045, 0.14), ch = U * rnd(0.04, 0.1);
            this.chips.push({ x: rnd(U*0.05, w - cw - U*0.05), y: rnd(U*0.05, h - ch - U*0.05), w: cw, h: ch, pins: 4 + (Math.random() * 12 | 0), label: COMPONENT_LABELS[(i * 7) % COMPONENT_LABELS.length], active: false });
        }

        // Bus ribbons (parallel trace groups)
        for (let i = 0; i < 6; i++) {
            const horiz = Math.random() < 0.5;
            const y0 = rnd(h * 0.1, h * 0.9);
            const x0 = rnd(w * 0.1, w * 0.9);
            const lanes = 4 + (Math.random() * 8 | 0);
            this.buses.push({ horiz, y0, x0, lanes, phase: Math.random() * Math.PI * 2, col: Math.random() < 0.5 ? [0.2,1,0.6] : [0.2,0.9,1] });
        }

        // Status LEDs
        for (let i = 0; i < 20; i++)
            this.leds.push({ x: rnd(0, w), y: rnd(0, h), r: U * 0.006, hue: [120, 60, 0, 200][i % 4], phase: Math.random() * Math.PI * 2 });
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        if (!this.built || this._w !== w || this._h !== h) this.build(w, h);
        const U = Math.min(w, h);
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        this.t += dt;

        const speed     = p.speed    ?? 0.35;
        const glow      = p.glow     ?? 1.5;
        const scanDir   = (p.direction ?? 0) >= 0.5 ? 1 : 0;
        const colorMode = p.colorMode ?? 0; // 0=pcb green 1=neon purple 2=amber
        const traceCount = Math.round(p.density ?? 0.7 * 110);
        const showBus   = (p.showBus ?? 1) > 0.5;
        const scanWidth = p.scanWidth ?? 0.12;
        const bgBright  = p.bgBright ?? 0.04;

        if (bass > 0.55) this.surge = Math.min(1, this.surge + bass * 0.7);
        this.surge *= 0.88;

        // Color mode tint
        let baseR, baseG, baseB;
        if (colorMode < 0.33)      { baseR = 0.2; baseG = 1; baseB = 0.6; }  // PCB green
        else if (colorMode < 0.67) { baseR = 0.8; baseG = 0.2; baseB = 1;  }  // neon purple
        else                        { baseR = 1;   baseG = 0.7; baseB = 0.1; } // amber

        // Board background
        const bgL = (bgBright * 30) | 0;
        ctx.fillStyle = colorMode < 0.33 ? `rgb(4,${bgL},10)` : colorMode < 0.67 ? `rgb(8,4,${bgL})` : `rgb(${bgL},10,4)`;
        ctx.fillRect(0, 0, w, h);

        // Subtle grid
        ctx.strokeStyle = colorMode < 0.33 ? "rgba(0,60,20,0.3)" : colorMode < 0.67 ? "rgba(40,0,60,0.3)" : "rgba(60,30,0,0.3)";
        ctx.lineWidth = 0.5;
        const gspacing = U * 0.05;
        for (let gx = 0; gx < w; gx += gspacing) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
        for (let gy = 0; gy < h; gy += gspacing) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

        // Scan position
        if (!this._scan) this._scan = 0;
        this._scan += dt * speed;
        if (this._scan > 1) this._scan -= 1;
        const scanPos = scanDir === 1 ? this._scan * h : this._scan * w;
        const scanZone = U * scanWidth;
        const nearScan = (x2, y2) => Math.max(0, 1 - Math.abs((scanDir === 1 ? y2 : x2) - scanPos) / scanZone);

        ctx.lineCap = "round"; ctx.lineJoin = "round";

        // Bus ribbons
        if (showBus) {
            for (const bus of this.buses) {
                const spacing = U * 0.012;
                for (let l = 0; l < bus.lanes; l++) {
                    const offset = (l - bus.lanes / 2) * spacing;
                    const litness = nearScan(bus.x0, bus.y0 + offset);
                    const [r, g, b] = bus.col;
                    const dataVal = (Math.sin(this.t * 4 + bus.phase + l * 0.8) > (0 + treble * 0.5)) ? 1 : 0;
                    const alpha = (0.08 + litness * 0.6 + this.surge * 0.3) * (0.3 + dataVal * 0.7);
                    ctx.strokeStyle = `rgba(${r*255|0},${g*255|0},${b*255|0},${alpha})`;
                    ctx.lineWidth = 1.2;
ctx.shadowBlur = 0;
                    ctx.beginPath();
                    if (bus.horiz) { ctx.moveTo(0, bus.y0 + offset); ctx.lineTo(w, bus.y0 + offset); }
                    else           { ctx.moveTo(bus.x0 + offset, 0); ctx.lineTo(bus.x0 + offset, h); }
                    ctx.stroke();
                }
            }
            ctx.shadowBlur = 0;
        }

        // Traces
        const drawN = Math.min(this.traces.length, Math.max(20, (p.density ?? 0.7) * this.traces.length) | 0);
        for (let ti = 0; ti < drawN; ti++) {
            const tr = this.traces[ti];
            const mid2 = tr.pts[tr.pts.length >> 1];
            const lit = nearScan(mid2[0], mid2[1]);
            const [r, g, b] = tr.col;
            // Tint by color mode
            const tr_r = r * baseR * 255 | 0, tr_g = g * baseG * 255 | 0, tr_b = b * baseB * 255 | 0;
            const alpha = Math.min(1, 0.1 + lit * 0.85 + this.surge * 0.25 + mid * 0.1);
            ctx.strokeStyle = `rgba(${tr_r},${tr_g},${tr_b},${alpha})`;
            ctx.lineWidth = (tr.width * U * 0.003) * (1 + lit * 0.5);
            ctx.shadowBlur = 0;
            ctx.beginPath();
            for (let k = 0; k < tr.pts.length; k++)
                k ? ctx.lineTo(tr.pts[k][0], tr.pts[k][1]) : ctx.moveTo(tr.pts[k][0], tr.pts[k][1]);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Pads and vias
        for (const pad of this.pads) {
            const lit = nearScan(pad.x, pad.y);
            const r_pad = baseR * 255 | 0, g_pad = baseG * 200 | 0, b_pad = baseB * 150 | 0;
            ctx.fillStyle = pad.via
                ? `rgba(${(baseR*200)|0},${(baseG*220)|0},${(baseB*120)|0},${0.25 + lit * 0.85})`
                : `rgba(${(baseR*180)|0},${(baseG*255)|0},${(baseB*200)|0},${0.2 + lit * 0.9})`;
            if (lit > 0.2 && glow > 0.1) {ctx.shadowBlur = 0; }
            ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r * (1 + lit * 0.3), 0, 6.28); ctx.fill();
            if (pad.via) {
                ctx.fillStyle = colorMode < 0.33 ? `rgb(4,${bgL},10)` : colorMode < 0.67 ? `rgb(8,4,${bgL})` : `rgb(${bgL},10,4)`;
                ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r * 0.38, 0, 6.28); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // Chips
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const c of this.chips) {
            const lit = nearScan(c.x + c.w/2, c.y + c.h/2);
            const activity = lit > 0.3 || this.surge > 0.3;
            ctx.fillStyle = colorMode < 0.33 ? "rgba(6,16,10,0.92)" : colorMode < 0.67 ? "rgba(8,6,16,0.92)" : "rgba(16,10,6,0.92)";
            ctx.fillRect(c.x, c.y, c.w, c.h);
            const strokeAlpha = 0.35 + lit * 0.65 + this.surge * 0.3;
            ctx.strokeStyle = `rgba(${baseR*120|0},${baseG*180|0},${baseB*140|0},${strokeAlpha})`;
            ctx.lineWidth = 1.2 + lit;
            if (lit > 0.3 && glow > 0.1) {ctx.shadowBlur = 0; }
            ctx.strokeRect(c.x, c.y, c.w, c.h);
            ctx.shadowBlur = 0;
            // Pins
            ctx.fillStyle = `rgba(${baseR*200|0},${baseG*255|0},${baseB*210|0},${0.3 + lit * 0.7})`;
            const pinLen = U * 0.007;
            for (let i = 0; i < c.pins; i++) {
                const px = c.x + (i + 0.5) / c.pins * c.w;
                ctx.fillRect(px - 1.2, c.y - pinLen, 2.4, pinLen);
                ctx.fillRect(px - 1.2, c.y + c.h, 2.4, pinLen);
            }
            // Label
            ctx.font = `bold ${Math.max(7, U * 0.013)}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(${baseR*180|0},${baseG*230|0},${baseB*190|0},${0.5 + lit * 0.5})`;
            ctx.fillText(c.label, c.x + c.w/2, c.y + c.h/2 - 4);
            ctx.font = `${Math.max(5, U * 0.009)}px monospace`;
            ctx.fillStyle = `rgba(${baseR*100|0},${baseG*160|0},${baseB*130|0},${0.4 + lit * 0.4})`;
            ctx.fillText(`${c.pins}p`, c.x + c.w/2, c.y + c.h/2 + 6);
        }

        // Status LEDs
        for (const led of this.leds) {
            const lit = nearScan(led.x, led.y);
            const blink = Math.sin(this.t * (3 + treble * 5) + led.phase) > (0.2 - treble * 0.4);
            const brightness = blink ? (0.5 + lit * 0.5 + this.surge * 0.5) : 0.05;
            ctx.fillStyle = `hsla(${led.hue},100%,60%,${brightness})`;
            if (brightness > 0.3 && glow > 0.1) {ctx.shadowBlur = 0; }
            ctx.beginPath(); ctx.arc(led.x, led.y, led.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Scan bar
        const scanAlpha = 0.12 + mid * 0.18 + this.surge * 0.15;
        ctx.fillStyle = `rgba(${baseR*120|0},${baseG*255|0},${baseB*180|0},${scanAlpha})`;
        if (scanDir === 1) ctx.fillRect(0, scanPos - scanZone * 0.5, w, scanZone);
        else               ctx.fillRect(scanPos - scanZone * 0.5, 0, scanZone, h);
        // Scan center line
        ctx.strokeStyle = `rgba(${baseR*200|0},${baseG*255|0},${baseB*220|0},${0.5 + mid * 0.5})`;
        ctx.lineWidth = 1;
ctx.shadowBlur = 0;
        ctx.beginPath();
        if (scanDir === 1) { ctx.moveTo(0, scanPos); ctx.lineTo(w, scanPos); }
        else               { ctx.moveTo(scanPos, 0); ctx.lineTo(scanPos, h); }
        ctx.stroke(); ctx.shadowBlur = 0;

        // Surge overlay
        if (this.surge > 0.1) {
            ctx.fillStyle = `rgba(${baseR*60|0},${baseG*200|0},${baseB*100|0},${this.surge * 0.06})`;
            ctx.fillRect(0, 0, w, h);
        }
    }
}

export const circuitScannerParams = () => ({
    speed:      { base: 0.35, min: 0.05, max: 3,   mod: { source: "" } },
    glow:       { base: 1.5,  min: 0,    max: 3,   mod: { source: "" } },
    direction:  { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    colorMode:  { base: 0,    min: 0,    max: 1,   mod: { source: "" } },
    density:    { base: 0.7,  min: 0.1,  max: 1,   mod: { source: "" } },
    scanWidth:  { base: 0.12, min: 0.02, max: 0.4, mod: { source: "" } },
    showBus:    { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    bgBright:   { base: 0.04, min: 0,    max: 0.3, mod: { source: "" } },
    traceThick: { base: 1,    min: 0.3,  max: 3,   mod: { source: "" } },
    ledSpeed:   { base: 1,    min: 0.1,  max: 5,   mod: { source: "" } },
});

export function drawCircuitScanner(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new CircuitViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    ctx.clearRect(0, 0, w, h);
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
