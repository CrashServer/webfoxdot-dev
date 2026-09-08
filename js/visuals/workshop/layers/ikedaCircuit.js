// ── Ikeda Circuit ─────────────────────────────────────────────────────────
// Ryoji-Ikeda-style data/circuit field: grid of audio-reactive nodes, scanning
// data traces, beat-triggered RGB glitch artifacts, scanlines and telemetry.
// Ported from web/src/layers/ikedaCircuit.js (Canvas2D), adapted to the
// workshop draw-function pattern.

const _state = new WeakMap();

class IkedaViz {
    constructor() {
        this.cell = 0;
        this.els = [];
        this.hLines = [];
        this.vLines = [];
        this.beatT = -1;
        this.frame_ = 0;
        this.glitches = [];
        this.hex = [];
        this._lastOnset = 0;
    }

    build(w, h) {
        this.cell = Math.min(w, h) / 32;
        this.els = [];
        const cols = Math.ceil(w / this.cell), rows = Math.ceil(h / this.cell);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (Math.random() > 0.3) continue;
                this.els.push({ x: x * this.cell + this.cell / 2, y: y * this.cell + this.cell / 2, type: ["node","square","circle"][(Math.random() * 3) | 0], freq: (Math.random() * 4) | 0, val: 0, tgt: 0, phase: Math.random() * 6.28, blink: 0.05 + Math.random() * 0.1 });
            }
        }
        const mk = (horiz) => {
            const arr = [], cnt = 16;
            for (let i = 0; i < cnt; i++) {
                const segs = [];
                let pos = 0, L = horiz ? w : h;
                while (pos < L) {
                    const len = 10 + Math.random() * 40;
                    segs.push({ start: pos, len, freq: (Math.random() * 4) | 0, val: 0, tgt: 0 });
                    pos += len + 5 + Math.random() * 15;
                }
                arr.push({ pos: (i + 0.5) / cnt * (horiz ? h : w), speed: 0.5 + Math.random(), amp: 0.5 + Math.random() * 0.5, segs });
            }
            return arr;
        };
        this.hLines = mk(true);
        this.vLines = mk(false);
    }

    spawnGlitch(w, h, t) {
        if (Math.random() < 0.5) {
            this.glitches.push({ type: "bar", y: Math.random() * h, hh: 5 + Math.random() * 15, t, dur: 0.2 + Math.random() * 0.5 });
        } else {
            this.glitches.push({ type: "corrupt", x: Math.random() * w, y: Math.random() * h, ww: 50 + Math.random() * 200, hh: 50 + Math.random() * 200, t, dur: 0.1 + Math.random() * 0.3 });
        }
    }

    frame(ctx, w, h, p, t, bands, onset) {
        if (!this.cell) this.build(w, h);
        this.frame_++;

        // Beat/onset trigger
        if (onset && t - this._lastOnset > 0.1) {
            this._lastOnset = t;
            this.beatT = t;
            for (let k = 0, n = 2 + ((Math.random() * 3) | 0); k < n; k++) this.spawnGlitch(w, h, t);
        }
        const beatOn = this.beatT >= 0 && t - this.beatT < 0.3;
        if (this.beatT >= 0 && t - this.beatT >= 0.3) this.beatT = -1;

        const hue = (p.hue ?? 180) | 0;
        const bright = p.brightness ?? 1;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);

        // Grid underlay
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += this.cell) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y <= h; y += this.cell) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();

        // Elements
        for (const e of this.els) {
            e.tgt = bands[e.freq] * 0.8 + (beatOn ? 0.5 : 0);
            e.val = e.val * 0.7 + e.tgt * 0.3;
            e.phase += e.blink;
            const active = e.val > 0.1 || (Math.sin(e.phase) > 0.7 && Math.random() > 0.7);
            const sz = this.cell * 0.15 + this.cell * 0.3 * e.val;
            if (active) {
                const br = Math.min(255, (200 + 55 * e.val) * bright) | 0;
                ctx.fillStyle = `rgba(${br},${br},${br},${0.7 + 0.3 * e.val})`;
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = "rgba(30,30,30,0.3)";
                ctx.shadowBlur = 0;
            }
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.lineWidth = 1;
            if (e.type === "square") {
                ctx.fillRect(e.x - sz, e.y - sz, sz * 2, sz * 2);
                ctx.strokeRect(e.x - sz, e.y - sz, sz * 2, sz * 2);
            } else if (e.type === "circle") {
                ctx.beginPath(); ctx.arc(e.x, e.y, sz, 0, 6.28); ctx.fill(); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(e.x, e.y, sz, 0, 6.28); ctx.stroke();
                ctx.beginPath(); ctx.arc(e.x, e.y, sz * 0.4, 0, 6.28); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // Data lines
        const drawLines = (lines, horiz) => {
            for (const ln of lines) {
                for (const s of ln.segs) {
                    s.tgt = bands[s.freq] * ln.amp * 0.8 + 0.3 * Math.sin(s.start * 0.01 + t * ln.speed) + (beatOn ? 0.6 : 0);
                    s.val = s.val * 0.7 + s.tgt * 0.3;
                    const off = 5 * s.val * Math.sin(s.start * 0.1 + t * ln.speed);
                    const br = Math.min(255, (100 + 155 * Math.max(0, s.val)) * bright) | 0;
                    ctx.strokeStyle = `rgba(${br},${br},${br},${0.5 + 0.5 * Math.max(0, Math.min(1, s.val))})`;
                    ctx.lineWidth = 1 + 2 * Math.max(0, s.val);
                    ctx.beginPath();
                    if (horiz) { ctx.moveTo(s.start, ln.pos + off); ctx.lineTo(s.start + s.len, ln.pos + off); }
                    else        { ctx.moveTo(ln.pos + off, s.start); ctx.lineTo(ln.pos + off, s.start + s.len); }
                    ctx.stroke();
                }
            }
        };
        drawLines(this.hLines, true);
        drawLines(this.vLines, false);

        // Glitches
        this.glitches = this.glitches.filter((g) => t - g.t < g.dur);
        for (const g of this.glitches) {
            const pr = (t - g.t) / g.dur, op = Math.sin(Math.PI * pr);
            if (g.type === "bar") {
                ctx.fillStyle = `rgba(255,255,255,${op * 0.5})`;
                ctx.fillRect(0, g.y, w, g.hh);
            } else {
                ctx.save();
                ctx.globalCompositeOperation = "screen";
                ctx.fillStyle = `rgba(255,0,0,${op * 0.4})`; ctx.fillRect(g.x - 5, g.y, g.ww, g.hh);
                ctx.fillStyle = `rgba(0,0,255,${op * 0.4})`; ctx.fillRect(g.x + 5, g.y, g.ww, g.hh);
                ctx.restore();
            }
        }

        // Scanlines
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);

        // Rolling hex telemetry
        if (this.frame_ % 5 === 0) {
            this.hex = Array.from({ length: 5 }, () =>
                Array.from({ length: 8 }, () => "0123456789ABCDEF"[(Math.random() * 16) | 0]).join("")
            );
        }
        const fs = Math.max(8, Math.min(w, h) * 0.011) | 0;
        ctx.font = `${fs}px 'Courier New',monospace`;
        ctx.textAlign = "right";
        ctx.fillStyle = `hsla(${hue},80%,70%,0.6)`;
        for (let i = 0; i < this.hex.length; i++) {
            ctx.fillText(this.hex[i], w - fs * 0.5, h - fs * 0.5 - (4 - i) * fs * 1.3);
        }
    }
}

function audioBands(spectrum) {
    if (!spectrum || !spectrum.length) return [0, 0, 0, 0];
    const n = spectrum.length, q = n / 4;
    const seg = (i) => { let v = 0; for (let k = i * q | 0; k < ((i + 1) * q) | 0; k++) v += spectrum[k]; return Math.min(1, v / (q || 1)); };
    return [seg(0), seg(1), seg(2), seg(3)];
}

function detectOnset(spectrum) {
    if (!spectrum || !spectrum.length) return false;
    const hi = Math.max(...spectrum.slice(0, (spectrum.length * 0.25) | 0));
    return hi > 0.5;
}

export const ikedaCircuitParams = () => ({
    hue:        { base: 180, min: 0,   max: 360, mod: { source: "" } },
    brightness: { base: 1,   min: 0.3, max: 2,   mod: { source: "" } },
});

export function drawIkedaCircuit(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IkedaViz(); _state.set(ctx, viz); }
    const bands  = audioBands(extra?.spectrum);
    const onset  = detectOnset(extra?.spectrum);
    viz.frame(ctx, w, h, p, t, bands, onset);
}
