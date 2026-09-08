// ── Neon City ─────────────────────────────────────────────────────────────────
// Cyberpunk cityscape: parallax building layers, neon signs, rain, wet-ground
// reflections, car streaks, lightning flashes. Bass pulses city lights and
// triggers lightning; mid drives sign flicker; treble animates rain intensity.

const _state = new WeakMap();

const SIGN_WORDS = ["CYBER","HOTEL","BAR","NEON","CLUB","RAMEN","DATA","24HR","TAXI","MOTEL","AI","VJ","NET","VOID","FLUX","NOVA","ZONE","GRID","HACK","BYTE"];
const NEON_HUES  = [320,180,60,280,30,160,210,340,90,250];

function hash32(n) {
    n = ((n >> 16) ^ n) * 0x45d9f3b | 0;
    n = ((n >> 16) ^ n) * 0x45d9f3b | 0;
    return ((n >> 16) ^ n) >>> 0;
}
function h(n, max) { return (hash32(n) % max + max) % max; }

class NeonCityViz {
    constructor() {
        this.layers = null; this.rain = []; this.cars = []; this.puddles = [];
        this.flash = 0; this.flashHue = 0; this.signPhase = 0;
        this._w = 0; this._h = 0;
        this.lastT = 0;
        this._skyGrad = null; this._skyKey = '';
        this._groundGrad = null;
        this._fogGrads = null; this._fogKey = '';
    }

    _build(w, ht) {
        this._w = w; this._h = ht;
        const ground = ht * 0.70;
        this.ground = ground;
        this.layers = [0, 1, 2].map(li => {
            const scale = 0.28 + li * 0.36;
            const yBase = ground - ht * 0.02 * li;
            const buildings = [];
            let x = -w * 0.12, seed = li * 3137 + 7;
            while (x < w * 1.18) {
                const bw = (h(seed++, 70) + 28) * scale;
                const bh = (h(seed++, 260) + 55) * scale;
                const winRows = Math.max(2, (bh / (14 * scale)) | 0);
                const winCols = Math.max(1, (bw / (16 * scale)) | 0);
                const hasSign = h(seed++, 10) < (li === 2 ? 6 : li === 1 ? 2 : 0);
                const signWord = SIGN_WORDS[h(seed++, SIGN_WORDS.length)];
                const signHue  = NEON_HUES[h(seed++, NEON_HUES.length)];
                const signHue2 = NEON_HUES[h(seed++, NEON_HUES.length)];
                const roofType = h(seed++, 3); // 0=flat 1=antenna 2=stepped
                const winLitMap = new Uint8Array(winRows * winCols);
                for (let i = 0; i < winLitMap.length; i++) winLitMap[i] = h(seed++, 3) > 0 ? 1 : 0;
                buildings.push({ x, w: bw, h: bh, y: yBase, winRows, winCols, hasSign, signWord, signHue, signHue2, roofType, winLitMap, seed: seed++, li });
                x += bw + h(seed++, 10) * scale + 1;
            }
            return { buildings, scale };
        });
        this.rain = [];
        for (let i = 0; i < 300; i++)
            this.rain.push({ x: Math.random() * w, y: Math.random() * ht, len: 7 + Math.random() * 16, speed: 14 + Math.random() * 18, drift: (Math.random() - 0.5) * 0.4 });
        this.puddles = [];
        for (let i = 0; i < 12; i++)
            this.puddles.push({ x: Math.random() * w, r: 15 + Math.random() * 40 });
    }

    frame(ctx, w, ht, p, t, bass, mid, treble) {
        if (!this.layers || this._w !== w || this._h !== ht) this._build(w, ht);
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, t - this.lastT); this.lastT = t;
        const hue       = (p.hue    ?? 280) | 0;
        const glow      = p.glow    ?? 1.5;
        const rainAmt   = p.rain    ?? 0.6;
        const speed     = p.speed   ?? 1;
        const fogDensity= p.fog     ?? 0.5;
        const signDensity = p.signs ?? 1;
        const reflectAmt  = p.reflect ?? 0.5;
        const carAmt      = p.cars  ?? 0.5;
        const winBright   = p.windowBright ?? 1;
        const palette     = p.palette ?? 0; // 0=purple, 1=teal, 2=red

        const paletteHue = palette < 0.33 ? 280 : palette < 0.67 ? 180 : 340;
        const skyHue = hue;

        if (bass > 0.5) { this.flash = Math.min(1, this.flash + bass * 0.8); this.flashHue = h(Math.random() * 1000 | 0, 360); }
        this.flash *= 0.86;
        this.signPhase += dt;

        // Sky gradient — cached until params or dims change
        const skyKey = `${skyHue}_${w}_${ht}`;
        if (skyKey !== this._skyKey) {
            this._skyKey = skyKey;
            const sky = ctx.createLinearGradient(0, 0, 0, this.ground);
            sky.addColorStop(0, `hsl(${skyHue},35%,2%)`);
            sky.addColorStop(0.6, `hsl(${skyHue+15},45%,5%)`);
            sky.addColorStop(1, `hsl(${skyHue+30},55%,10%)`);
            this._skyGrad = sky;
            const groundGrad = ctx.createLinearGradient(0, this.ground, 0, ht);
            groundGrad.addColorStop(0, `hsl(${skyHue},20%,7%)`);
            groundGrad.addColorStop(1, `hsl(${skyHue},15%,4%)`);
            this._groundGrad = groundGrad;
            this._pudGradKey = -1; // invalidate puddle cache
        }
        ctx.fillStyle = this._skyGrad; ctx.fillRect(0, 0, w, ht);

        // Fog layers — cached until skyHue or fogDensity changes
        if (fogDensity > 0.05) {
            const fogKey = `${skyHue}_${fogDensity.toFixed(2)}_${w}_${ht}`;
            if (fogKey !== this._fogKey) {
                this._fogKey = fogKey;
                this._fogGrads = [0, 1, 2].map(f => {
                    const fy = this.ground * (0.55 + f * 0.12);
                    const fh = this.ground * 0.18;
                    const fog = ctx.createLinearGradient(0, fy, 0, fy + fh);
                    fog.addColorStop(0, `hsla(${skyHue+40},50%,20%,0)`);
                    fog.addColorStop(0.4, `hsla(${skyHue+40},55%,15%,${fogDensity * 0.18})`);
                    fog.addColorStop(1, `hsla(${skyHue+40},50%,20%,0)`);
                    return { fog, fy, fh };
                });
            }
            for (const { fog, fy, fh } of this._fogGrads) {
                ctx.fillStyle = fog; ctx.fillRect(0, fy, w, fh);
            }
        }

        // Stars
        for (let s = 0; s < 60; s++) {
            const sx = h(s * 17, w), sy = h(s * 31, this.ground * 0.7 | 0);
            const sa = 0.2 + 0.5 * Math.sin(t * 0.7 + s);
            ctx.fillStyle = `rgba(200,210,255,${sa * 0.5})`;
            ctx.fillRect(sx, sy, 1, 1);
        }

        const drawBuildings = (forReflection) => {
            for (let li = 0; li < 3; li++) {
                const { buildings, scale } = this.layers[li];
                const depthAlpha = 0.5 + li * 0.25;
                for (const b of buildings) {
                    const bx = b.x;
                    const flipY = forReflection ? this.ground + (this.ground - b.y) : b.y;
                    const sign2 = forReflection ? 1 : -1;
                    const darkL = 4 + li * 4 + (forReflection ? 2 : 0);

                    // Building body — flat fill (gradient was imperceptibly subtle)
                    ctx.fillStyle = `hsl(${skyHue},13%,${darkL + 1}%)`;
                    ctx.fillRect(bx, flipY, b.w, sign2 * b.h);

                    // Roof details
                    if (!forReflection && li === 2) {
                        ctx.fillStyle = `hsl(${skyHue},10%,${darkL + 4}%)`;
                        if (b.roofType === 1) { // antenna
                            ctx.fillRect(bx + b.w * 0.45, flipY - b.h - 20, 3, 20);
                            ctx.fillStyle = `rgba(255,50,50,${0.6 + 0.4 * Math.sin(t * 1.5 + b.seed)})`;
                            ctx.beginPath(); ctx.arc(bx + b.w * 0.45 + 1.5, flipY - b.h - 22, 3, 0, Math.PI * 2); ctx.fill();
                        } else if (b.roofType === 2) { // stepped
                            ctx.fillStyle = `hsl(${skyHue},10%,${darkL + 3}%)`;
                            ctx.fillRect(bx + b.w * 0.1, flipY - b.h - 8, b.w * 0.8, 8);
                            ctx.fillRect(bx + b.w * 0.2, flipY - b.h - 14, b.w * 0.6, 6);
                        }
                    }

                    // Windows
                    if (!forReflection || li === 2) {
                        const wp = b.w / (b.winCols + 1), hp2 = b.h / (b.winRows + 1);
                        const ww = Math.max(3, wp * 0.45), wh = Math.max(2, hp2 * 0.4);
                        ctx.globalCompositeOperation = "lighter";
                        for (let row = 0; row < b.winRows; row++) {
                            for (let col = 0; col < b.winCols; col++) {
                                if (!b.winLitMap[row * b.winCols + col]) continue;
                                const wx = bx + wp * (col + 1) - ww * 0.5;
                                const wy = flipY + sign2 * (hp2 * (row + 1) - wh * 0.5);
                                const winHue = skyHue + h(b.seed + row * 7 + col, 80) - 40;
                                const wLum = (40 + bass * 35 + this.flash * 20) * winBright * depthAlpha;
                                const wAlpha = (0.15 + bass * 0.2 + this.flash * 0.15) * depthAlpha;
                                ctx.fillStyle = `hsla(${winHue},60%,${wLum}%,${wAlpha})`;
                                ctx.fillRect(wx, wy, ww, sign2 * wh);
                            }
                        }
                        ctx.globalCompositeOperation = "source-over";
                    }

                    // Neon signs
                    if (b.hasSign && li === 2 && !forReflection && signDensity > 0.1) {
                        const flicker = Math.sin(this.signPhase * (5 + b.seed % 8) + b.seed) > (0.9 - mid * 0.3) ? 0.25 : 1;
                        const sx2 = bx + b.w * 0.08;
                        const sy2 = flipY - b.h * 0.18;
                        const fontSize = Math.max(9, b.w * 0.17);
                        ctx.globalCompositeOperation = "lighter";
                        // Sign backglow
                        if (glow > 0.1) {
                            ctx.shadowBlur = 0;
                        }
                        ctx.fillStyle = `hsla(${b.signHue},100%,75%,${0.85 * flicker * signDensity})`;
                        ctx.font = `bold ${fontSize}px monospace`;
                        ctx.fillText(b.signWord, sx2 + 3, sy2);
                        ctx.shadowBlur = 0;
                        // Second line sign (sometimes)
                        if (b.w > 50 && h(b.seed + 99, 3) === 0) {
                            ctx.fillStyle = `hsla(${b.signHue2},100%,70%,${0.6 * flicker * signDensity})`;
                            ctx.font = `${fontSize * 0.65}px monospace`;
                            ctx.fillText("24HR OPEN", sx2 + 3, sy2 + fontSize * 1.1);
                        }
                        ctx.globalCompositeOperation = "source-over";
                    }
                }
            }
        };

        // Ground — cached gradient
        ctx.fillStyle = this._groundGrad; ctx.fillRect(0, this.ground, w, ht - this.ground);

        // Ground puddle reflections
        if (reflectAmt > 0.05) {
            ctx.save();
            ctx.globalAlpha = (0.12 + bass * 0.1) * reflectAmt;
            ctx.scale(1, -1);
            ctx.translate(0, -(this.ground * 2));
            drawBuildings(false);
            ctx.restore();
            // Puddle shimmer — cache gradient per puddle (invalidated with sky key)
            if (this._pudGradKey !== skyHue) {
                this._pudGradKey = skyHue;
                for (const pu of this.puddles) {
                    const py = this.ground + h(pu.x | 0, ht - this.ground | 0);
                    pu._py = py;
                    const pg = ctx.createRadialGradient(pu.x, py, 0, pu.x, py, pu.r);
                    pg.addColorStop(0, `hsla(${skyHue+20},70%,25%,0.15)`);
                    pg.addColorStop(1, `hsla(${skyHue},50%,10%,0)`);
                    pu._grad = pg;
                }
            }
            for (const pu of this.puddles) {
                ctx.globalAlpha = reflectAmt * 0.8;
                ctx.fillStyle = pu._grad;
                ctx.beginPath(); ctx.ellipse(pu.x, pu._py, pu.r, pu.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        // Buildings
        drawBuildings(false);

        // Ground glow line
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `hsla(${skyHue+30},80%,25%,0.1)`; ctx.fillRect(0, this.ground - 2, w, 4);
        // Ground lane markings
        ctx.strokeStyle = `hsla(${skyHue},40%,20%,0.3)`; ctx.lineWidth = 1;
        ctx.setLineDash([20, 30]);
        ctx.beginPath(); ctx.moveTo(0, this.ground + (ht - this.ground) * 0.45); ctx.lineTo(w, this.ground + (ht - this.ground) * 0.45); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = "source-over";

        // Rain
        const rainCount = (rainAmt * 280) | 0;
        while (this.rain.length < rainCount) this.rain.push({ x: Math.random() * w, y: 0, len: 7 + Math.random() * 16, speed: 14 + Math.random() * 18, drift: (Math.random() - 0.5) * 0.4 });
        ctx.strokeStyle = `rgba(160,200,255,${0.12 + treble * 0.12})`; ctx.lineWidth = 0.5;
        const rainSpeed = 1 + treble * 1.5;
        for (let i = 0; i < Math.min(rainCount, this.rain.length); i++) {
            const r = this.rain[i];
            r.y += r.speed * rainSpeed * dt * 60;
            r.x += r.drift;
            if (r.y > ht) { r.y = -r.len; r.x = Math.random() * w; }
            ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.drift * r.len * 1.5, r.y + r.len); ctx.stroke();
        }

        // Car streaks
        if (carAmt > 0.05) {
            if (Math.random() < (0.015 + bass * 0.04) * carAmt)
                this.cars.push({ x: -100, y: this.ground + (ht - this.ground) * (0.2 + Math.random() * 0.5), s: 3 + Math.random() * 7, hue: Math.random() < 0.5 ? 30 : Math.random() < 0.5 ? 200 : 0, tail: 30 + Math.random() * 50, dir: 1 });
            if (Math.random() < 0.008 * carAmt)
                this.cars.push({ x: w + 80, y: this.ground + (ht - this.ground) * (0.2 + Math.random() * 0.5), s: -(3 + Math.random() * 5), hue: 0, tail: 20 + Math.random() * 40, dir: -1 });
            ctx.save(); ctx.globalCompositeOperation = "lighter";
            this.cars = this.cars.filter(c => {
                c.x += c.s * dt * 60;
                const tailX = c.x - c.dir * c.tail;
                const g = ctx.createLinearGradient(tailX, 0, c.x + c.dir * 20, 0);
                g.addColorStop(0, `hsla(${c.hue},90%,60%,0)`);
                g.addColorStop(1, `hsla(${c.hue},100%,85%,0.8)`);
                ctx.fillStyle = g; ctx.fillRect(Math.min(c.x, tailX), c.y - 2, c.tail + 20, 4);
                // Headlights
                ctx.fillStyle = `hsla(${c.hue + 20},100%,95%,0.7)`; ctx.fillRect(c.x + c.dir * 8, c.y - 3, 8, 6);
                return c.dir === 1 ? c.x < w + 120 : c.x > -120;
            });
            ctx.restore();
        }

        // Lightning flash
        if (this.flash > 0.08) {
            ctx.fillStyle = `rgba(200,215,255,${this.flash * 0.07})`; ctx.fillRect(0, 0, w, ht);
            if (this.flash > 0.5) {
                // Lightning bolt
                ctx.strokeStyle = `rgba(220,230,255,${this.flash * 0.6})`; ctx.lineWidth = 1.5;
ctx.shadowBlur = 0;
                ctx.beginPath();
                let lx = w * 0.3 + Math.random() * w * 0.4, ly = 0;
                ctx.moveTo(lx, ly);
                while (ly < this.ground * 0.8) { lx += (Math.random() - 0.5) * 40; ly += 20 + Math.random() * 30; ctx.lineTo(lx, ly); }
                ctx.stroke(); ctx.shadowBlur = 0;
            }
        }
    }
}

export const neonCityParams = () => ({
    hue:         { base: 280,  min: 0,   max: 360, mod: { source: "" } },
    glow:        { base: 1.5,  min: 0,   max: 3,   mod: { source: "" } },
    rain:        { base: 0.6,  min: 0,   max: 1,   mod: { source: "" } },
    speed:       { base: 1,    min: 0,   max: 3,   mod: { source: "" } },
    fog:         { base: 0.5,  min: 0,   max: 1,   mod: { source: "" } },
    reflect:     { base: 0.5,  min: 0,   max: 1,   mod: { source: "" } },
    signs:       { base: 1,    min: 0,   max: 1,   mod: { source: "" } },
    cars:        { base: 0.5,  min: 0,   max: 1,   mod: { source: "" } },
    windowBright:{ base: 1,    min: 0,   max: 2,   mod: { source: "" } },
    palette:     { base: 0,    min: 0,   max: 1,   mod: { source: "" } },
});

export function drawNeonCity(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new NeonCityViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    ctx.clearRect(0, 0, w, h);
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
