// ── Clift Scene ───────────────────────────────────────────────────────────────
// 5 CLIFT/Ikeda aesthetic modes in one layer:
//   0 = IkedaPhase  — sine interference pixel field
//   1 = RadarSweep  — rotating radar beam + fading blips
//   2 = HexDump     — falling columns of hex characters
//   3 = Panopticon  — radial surveillance grid with sweep
//   4 = Plasma      — additive sine colour field
// Reimplemented in Canvas2D from native clift_scene.cu (21 modes).

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

function hsl2rgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

class CliftViz {
    constructor() {
        this.t           = 0;
        this.radarAngle  = 0;
        this.sweepAngle  = 0;
        this.blips       = [];
        this.targets     = [];
        this.cols        = [];
        this._phaseOff   = null;
        this._plasmaOff  = null;
    }

    _offscreen(key, w, h) {
        if (!this[key] || this[key].canvas.width !== w || this[key].canvas.height !== h) {
            const off = new OffscreenCanvas(w, h);
            this[key] = off.getContext("2d");
        }
        return this[key];
    }

    frame(ctx, w, h, p, t, audio, bass) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        this.t += dt;
        const mode    = Math.round(Math.max(0, Math.min(4, p.mode    ?? 0)));
        const hue     = ((p.hue   ?? 120) | 0 + 360) % 360;
        const speed   = p.speed   ?? 1;
        const glow    = p.glow    ?? 1;
        const density = p.density ?? 1;
        const cx = w / 2, cy = h / 2, U = Math.min(w, h);

        switch (mode) {
            case 0: this._ikedaPhase(ctx, w, h, cx, cy, U, hue, speed, glow, audio, bass); break;
            case 1: this._radarSweep(ctx, w, h, cx, cy, U, hue, speed, glow, density, audio, bass, dt); break;
            case 2: this._hexDump  (ctx, w, h,         U, hue, speed, glow, density, audio, bass, dt); break;
            case 3: this._panopticon(ctx, w, h, cx, cy, U, hue, speed, glow, density, audio, bass, dt); break;
            case 4: this._plasma   (ctx, w, h,             hue, speed, glow, audio); break;
        }
    }

    _ikedaPhase(ctx, w, h, cx, cy, U, hue, speed, glow, audio, bass) {
        const GW = 96, GH = 96;
        const oCtx = this._offscreen('_phaseOff', GW, GH);
        const id = oCtx.createImageData(GW, GH);
        const d  = id.data;
        const tv = this.t * speed;
        const freq = 0.4 + audio * 0.35;
        for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
                const nx = (x / GW) * 2 - 1, ny = (y / GH) * 2 - 1;
                const v  = Math.sin(Math.sqrt(nx * nx + ny * ny) * 8 * freq - tv * 2)
                         + Math.sin(nx * 6 * freq + tv * 1.3)
                         + Math.sin(ny * 6 * freq + tv * 0.9)
                         + Math.sin((nx + ny) * 5 * freq - tv);
                const norm = (v + 4) / 8;
                const [r, g, b] = hsl2rgb((hue + norm * 90) % 360, 0.9, 0.2 + norm * 0.45);
                const i = (y * GW + x) * 4;
                d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
            }
        }
        oCtx.putImageData(id, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(oCtx.canvas, 0, 0, w, h);

        if (glow > 0.1 && (audio > 0.25 || bass > 0.3)) {
            ctx.strokeStyle = `hsla(${hue},100%,80%,${(audio + bass * 0.5) * 0.35 * glow})`;
            ctx.lineWidth   = 1.5;
ctx.shadowBlur = 0;
            for (let i = 1; i <= 5; i++) {
                const r = U * (0.05 + i * 0.09 + audio * 0.04);
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }
    }

    _radarSweep(ctx, w, h, cx, cy, U, hue, speed, glow, density, audio, bass, dt) {
        ctx.fillStyle = "rgba(0,8,4,0.25)"; ctx.fillRect(0, 0, w, h);
        this.radarAngle += dt * speed * 1.5;

        ctx.strokeStyle = `hsla(${hue},75%,40%,0.5)`; ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, U * 0.12 * i, 0, 6.28); ctx.stroke(); }

        ctx.strokeStyle = `hsla(${hue},55%,35%,0.25)`; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - U * 0.52, cy); ctx.lineTo(cx + U * 0.52, cy);
        ctx.moveTo(cx, cy - U * 0.52); ctx.lineTo(cx, cy + U * 0.52);
        ctx.stroke();

        // Sweep sector trail
        ctx.save(); ctx.translate(cx, cy);
        const sweepLen = Math.PI * 0.65;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.arc(0, 0, U * 0.52, this.radarAngle - sweepLen, this.radarAngle); ctx.closePath();
        ctx.fillStyle = `hsla(${hue},90%,55%,0.07)`; ctx.fill();
        // Beam
        ctx.strokeStyle = `hsla(${hue},100%,72%,0.85)`;
        ctx.lineWidth   = 2;ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(U * 0.52, 0); ctx.rotate(-this.radarAngle + this.radarAngle);
        // Actually rotate was already applied via translate, just draw at radarAngle
        ctx.restore();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.radarAngle);
        ctx.strokeStyle = `hsla(${hue},100%,72%,0.85)`; ctx.lineWidth = 2;
ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(U * 0.52, 0); ctx.stroke();
        ctx.shadowBlur = 0; ctx.restore();

        if (bass > 0.3 && Math.random() < 0.45 && this.blips.length < Math.round(density * 14)) {
            const ang = rnd(0, Math.PI * 2), dist = rnd(0.04, 0.48) * U;
            this.blips.push({ x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, life: 1, span: rnd(2, 6) });
        }
        for (let i = 0; i < this.blips.length; i++) {
            const b  = this.blips[i];
            b.life  -= dt / b.span;
            const a  = Math.max(0, b.life);
            ctx.fillStyle = `hsla(${hue},100%,80%,${a})`;ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(b.x, b.y, 2.5 + (1 - b.life) * 2, 0, 6.28); ctx.fill();
        }
        ctx.shadowBlur = 0;
        this.blips = this.blips.filter((b) => b.life > 0);
    }

    _hexDump(ctx, w, h, U, hue, speed, glow, density, audio, bass, dt) {
        const COL_W = Math.max(12, U * 0.028);
        const ROW_H = COL_W * 1.3;
        const nCols = Math.ceil(w / COL_W);
        const nRows = Math.ceil(h / ROW_H) + 1;

        while (this.cols.length < nCols) this.cols.push({ y: rnd(-nRows, 0) * ROW_H, spd: rnd(0.4, 1.2) });
        if (this.cols.length > nCols) this.cols.length = nCols;

        ctx.fillStyle = "rgba(0,2,6,0.45)"; ctx.fillRect(0, 0, w, h);

        const fz = Math.max(8, COL_W * 0.7);
        ctx.font = `bold ${fz | 0}px 'Courier New',monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";

        const fall      = speed * (1 + audio * 0.8 + bass * 1.2);
        const trailLen  = Math.round(8 + density * 6);

        for (let c = 0; c < this.cols.length; c++) {
            const col = this.cols[c];
            col.y += dt * ROW_H * fall * col.spd * 8;
            if (col.y > h) { col.y = -rnd(2, 8) * ROW_H; col.spd = rnd(0.4, 1.2); }
            const cx2   = (c + 0.5) * COL_W;
            const headR = Math.ceil(col.y / ROW_H);
            for (let r = headR; r >= headR - trailLen; r--) {
                const ry  = r * ROW_H - col.y;
                if (ry < -ROW_H || ry > h) continue;
                const age    = headR - r;
                const isHead = age === 0;
                const a      = isHead ? 1 : Math.max(0, 1 - age / trailLen);
                ctx.fillStyle   = `hsla(${hue},${isHead ? 55 : 80}%,${isHead ? 95 : 35 + a * 35}%,${a * 0.9})`;
                ctx.shadowBlur = 0;
                ctx.fillText((Math.random() * 256 | 0).toString(16).toUpperCase().padStart(2, "0"), cx2, ry);
            }
        }
        ctx.shadowBlur = 0;
    }

    _panopticon(ctx, w, h, cx, cy, U, hue, speed, glow, density, audio, bass, dt) {
        ctx.fillStyle = "rgba(2,3,8,0.28)"; ctx.fillRect(0, 0, w, h);
        this.sweepAngle += dt * speed * 0.75;
        const maxR = U * 0.48, nSpokes = 24, nRings = 6;

        ctx.strokeStyle = `hsla(${hue},55%,38%,0.32)`; ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < nSpokes; i++) {
            const a = (i / nSpokes) * Math.PI * 2;
            ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        }
        ctx.stroke();

        for (let i = 1; i <= nRings; i++) {
            const r = maxR * i / nRings, a = 0.2 + (i / nRings) * 0.3;
            ctx.strokeStyle = `hsla(${hue},70%,45%,${a})`; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke();
        }

        ctx.strokeStyle = `hsla(${hue},90%,65%,0.85)`;
        ctx.lineWidth   = 2;ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(cx, cy, U * 0.024, 0, 6.28); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(cx, cy, U * 0.009, 0, 6.28); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.sweepAngle);
        ctx.strokeStyle = `hsla(${hue},100%,68%,0.65)`; ctx.lineWidth = 1.5;
ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(maxR, 0); ctx.stroke();
        ctx.shadowBlur = 0; ctx.restore();

        if (bass > 0.35 && Math.random() < 0.3 && this.targets.length < Math.round(density * 18)) {
            const ang = rnd(0, Math.PI * 2), dist = rnd(0.06, 0.9) * maxR;
            this.targets.push({ x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, life: 1, sz: rnd(3, 8) });
        }
        const th = (hue + 120) % 360;
        for (let i = 0; i < this.targets.length; i++) {
            const tg = this.targets[i]; tg.life -= dt * 0.18;
            const a = Math.max(0, tg.life); const s = tg.sz;
            ctx.strokeStyle = `hsla(${th},100%,70%,${a * 0.8})`; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tg.x - s, tg.y); ctx.lineTo(tg.x + s, tg.y);
            ctx.moveTo(tg.x, tg.y - s); ctx.lineTo(tg.x, tg.y + s);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(tg.x, tg.y, s * 0.8, 0, 6.28); ctx.stroke();
        }
        this.targets = this.targets.filter((tg) => tg.life > 0);
    }

    _plasma(ctx, w, h, hue, speed, glow, audio) {
        const GW = 80, GH = 80;
        const oCtx = this._offscreen('_plasmaOff', GW, GH);
        const id = oCtx.createImageData(GW, GH);
        const d  = id.data;
        const tv = this.t * speed;
        for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
                const nx = x / GW, ny = y / GH;
                const v  = Math.sin(nx * 8 + tv)
                         + Math.sin(ny * 8 + tv * 1.1)
                         + Math.sin((nx + ny) * 6 + tv * 0.8)
                         + Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 14 - tv * 1.4)
                         + audio * Math.sin(nx * 12 + ny * 10 + tv * 2);
                const norm = (v + 4.5 + audio) / (9 + audio * 2);
                const [r, g, b] = hsl2rgb((hue + norm * 180) % 360, 0.9, 0.35 + norm * 0.3);
                const i = (y * GW + x) * 4;
                d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
            }
        }
        oCtx.putImageData(id, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(oCtx.canvas, 0, 0, w, h);
    }
}

function audioLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    let s = 0; for (let i = 0; i < spectrum.length; i++) s += spectrum[i];
    return Math.min(1, (s / spectrum.length) * 3);
}

function bassLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    const blen = Math.max(1, (spectrum.length * 0.18) | 0);
    let s = 0; for (let i = 0; i < blen; i++) s += spectrum[i];
    return Math.min(1, (s / blen) * 3);
}

export const cliftSceneParams = () => ({
    mode:    { base: 0,   min: 0,   max: 4,   step: 1, mod: { source: "" } },
    hue:     { base: 120, min: 0,   max: 360, mod: { source: "" } },
    speed:   { base: 1,   min: 0.1, max: 4,   mod: { source: "" } },
    glow:    { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    density: { base: 1,   min: 0.1, max: 3,   mod: { source: "" } },
});

export function drawCliftScene(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new CliftViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp));
}
