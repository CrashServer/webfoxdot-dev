// ── FPV Drone ─────────────────────────────────────────────────────────────
// First-person racing drone: procedural terrain (wireframe or filled), neon
// gate course, particle stars, full OSD HUD. Bass-triggered banking rolls.

const _state = new WeakMap();

const rnd = (a, b) => a + Math.random() * (b - a);
const NEAR = 0.4;

// ── Terrain noise — 2 sin calls only, fast enough for 60fps ──────────────
const GW = 14, GD = 12, CELL = 16;

function terrainH(wx, wz) {
    return Math.sin(wx * 0.09 + wz * 0.07) * 5
         + Math.sin(wx * 0.21 - wz * 0.15) * 3;
}

class FpvViz {
    constructor() {
        this.camZ  = 0; this.camX = 0; // world position
        this.roll  = 0; this.yaw  = 0; this.yawRate = rnd(-0.2, 0.2);
        this._rollImp = 0;
        this._gateFlash = 0;
        this.bat = 94;
        this.stars = [];
        this.gates = [];
        // pre-allocated row buffer: (GW+1) projected pts per row, (GD+1) rows
        this._rows = Array.from({ length: GD + 1 }, () => new Array(GW + 1).fill(null));
        this._hGrad = null; this._hGradW = 0; this._hGradH = 0;
    }

    _spawnStar(spread) {
        return { x: rnd(-80, 80), y: rnd(-40, 40), z: spread ? rnd(1, 200) : rnd(130, 200) };
    }
    _spawnGate(spread) {
        return {
            x: rnd(-24, 24), y: rnd(-6, 2),
            z: spread ? rnd(30, 200) : rnd(120, 200),
            w: rnd(14, 26), h: rnd(10, 20),
            hue: (rnd(0, 360)) | 0,
        };
    }

    _proj(px, py, pz, cr, sr, fov, sw, sh) {
        if (pz < NEAR) return null;
        const rx = px * cr - py * sr, ry = px * sr + py * cr;
        const sc = fov / pz;
        return [sw / 2 + rx * sc, sh / 2 + ry * sc];
    }

    frame(ctx, w, h, p, t, audio, bass) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        const speed        = (p.speed        ?? 1) * (32 + audio * 68);
        const fov          = (p.fov          ?? 1) * Math.min(w, h) * 0.55;
        const terrMode     = Math.round(p.terrain      ?? 1); // 0=off 1=wire 2=filled
        const tScale       = (p.terrainScale ?? 1) * 8;
        const tHue         = (p.terrainHue   ?? 120) | 0;
        const altY         = (p.altitude     ?? 1) * 16; // camera height above mean ground
        const rollInt      = p.rollIntensity ?? 1;
        const gateCount    = Math.max(0, Math.round((p.gates ?? 1) * 6));
        const hudAlpha     = p.hudOpacity    ?? 0.85;
        const hudHue       = (p.hudHue       ?? 45) | 0;
        const hudColor     = `hsla(${hudHue},100%,85%,${hudAlpha})`;

        // Sync gate pool size to param
        while (this.gates.length < gateCount) this.gates.push(this._spawnGate(true));
        if (this.stars.length === 0) for (let i = 0; i < 300; i++) this.stars.push(this._spawnStar(true));

        // ── Physics ──────────────────────────────────────────────────────
        this._rollImp *= 0.93;
        this._rollImp += bass * 0.06 * rollInt * (Math.random() > 0.5 ? 1 : -1);
        this.roll += (this._rollImp - this.roll * 0.04) * dt * 60;
        this.roll *= 0.97;

        this.yaw += this.yawRate * dt;
        if (Math.abs(this.yaw) > 0.55) this.yawRate *= -1;
        this.camX += Math.sin(this.yaw) * speed * dt * 0.25;
        this.camZ += Math.cos(this.yaw) * speed * dt;

        const cr = Math.cos(this.roll), sr = Math.sin(this.roll);

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);

        // ── Terrain ──────────────────────────────────────────────────────
        if (terrMode > 0) {
            // Build projected grid: rows[j][i] at camera-relative z = START_Z + j*CELL
            const START_Z = 3;
            const rows = this._rows;
            for (let j = 0; j <= GD; j++) {
                const camRelZ = START_Z + j * CELL;
                const worldZ  = this.camZ + camRelZ;
                for (let i = 0; i <= GW; i++) {
                    const camRelX = (i - GW / 2) * CELL;
                    const worldX  = this.camX + camRelX;
                    const hy = terrainH(worldX, worldZ) * tScale;
                    // camRelY: positive = below camera (terrain is below = positive Y on screen)
                    rows[j][i] = this._proj(camRelX, altY + hy, camRelZ, cr, sr, fov, w, h);
                }
            }

            if (terrMode === 2) {
                // Filled bands, painter's order (far to near)
                for (let j = GD - 1; j >= 0; j--) {
                    const farRow  = rows[j + 1];
                    const nearRow = rows[j];
                    const depth = (j + 1) / GD; // 1 = farthest, 0 = nearest
                    const lum = (10 + depth * 20) | 0;
                    const sat = (40 + depth * 30) | 0;
                    ctx.fillStyle   = `hsl(${tHue},${sat}%,${lum}%)`;
                    ctx.strokeStyle = `hsla(${tHue},70%,${lum + 18}%,0.35)`;
                    ctx.lineWidth   = 0.5;
                    ctx.beginPath();
                    let started = false;
                    for (let i = 0; i <= GW; i++) {
                        const pt = farRow[i];
                        if (!pt) { started = false; continue; }
                        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
                        else ctx.lineTo(pt[0], pt[1]);
                    }
                    for (let i = GW; i >= 0; i--) {
                        const pt = nearRow[i];
                        if (pt) ctx.lineTo(pt[0], pt[1]);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                // Wireframe — batch rows into 3 depth groups (6 stroke calls total)
                const BANDS = 3;
                for (let band = 0; band < BANDS; band++) {
                    const jStart = Math.round(band * GD / BANDS);
                    const jEnd   = Math.round((band + 1) * GD / BANDS);
                    const depth  = (band + 0.5) / BANDS;
                    ctx.strokeStyle = `hsla(${tHue},80%,${(25 + depth * 45) | 0}%,${0.18 + depth * 0.55})`;
                    ctx.lineWidth   = 0.5 + depth * 1.2;
                    ctx.beginPath();
                    for (let j = jStart; j <= jEnd; j++) {
                        const row = rows[j]; let started = false;
                        for (let i = 0; i <= GW; i++) {
                            const pt = row[i];
                            if (!pt) { started = false; continue; }
                            if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
                            else ctx.lineTo(pt[0], pt[1]);
                        }
                    }
                    ctx.stroke();
                }
                // All vertical lines in one pass
                ctx.strokeStyle = `hsla(${tHue},55%,35%,0.2)`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                for (let i = 0; i <= GW; i++) {
                    let started = false;
                    for (let j = 0; j <= GD; j++) {
                        const pt = rows[j][i];
                        if (!pt) { started = false; continue; }
                        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
                        else ctx.lineTo(pt[0], pt[1]);
                    }
                }
                ctx.stroke();
            }

            // Horizon glow — cached gradient, recreated only on resize
            if (this._hGradW !== w || this._hGradH !== h || this._tHue !== tHue) {
                this._hGradW = w; this._hGradH = h; this._tHue = tHue;
                const gy = h * 0.45;
                this._hGrad = ctx.createLinearGradient(0, gy - 28, 0, gy + 28);
                this._hGrad.addColorStop(0, "rgba(0,0,0,0)");
                this._hGrad.addColorStop(0.5, `hsla(${tHue},55%,18%,0.28)`);
                this._hGrad.addColorStop(1, "rgba(0,0,0,0)");
            }
            ctx.fillStyle = this._hGrad;
            ctx.fillRect(0, h * 0.45 - 28, w, 56);
        }

        // ── Stars ────────────────────────────────────────────────────────
        ctx.fillStyle = "rgba(210,225,255,0.8)";
        ctx.beginPath();
        for (const s of this.stars) {
            s.z -= speed * dt;
            if (s.z < NEAR) Object.assign(s, this._spawnStar(false));
            const pt = this._proj(s.x, s.y, s.z, cr, sr, fov, w, h);
            if (!pt) continue;
            const r = Math.max(0.5, Math.min(3, fov / s.z * 0.3));
            ctx.moveTo(pt[0] + r, pt[1]); ctx.arc(pt[0], pt[1], r, 0, 6.28);
        }
        ctx.fill();

        // ── Gates ────────────────────────────────────────────────────────
        const sortedGates = this.gates.slice().sort((a, b) => b.z - a.z);
        for (const g of sortedGates) {
            g.z -= speed * dt;
            if (g.z < NEAR) {
                if (Math.abs(this.camX - g.x) < g.w / 2) this._gateFlash = 0.5;
                Object.assign(g, this._spawnGate(false));
                continue;
            }
            const hw = g.w / 2, hh_ = g.h / 2;
            const corners = [[-hw, -hh_], [hw, -hh_], [hw, hh_], [-hw, hh_]];
            const pts = corners.map(([cx, cy]) => this._proj(g.x + cx, g.y + cy, g.z, cr, sr, fov, w, h));
            if (pts.some((pt) => !pt)) continue;
            const alpha = Math.min(1, 3 / g.z + 0.15);
            ctx.strokeStyle = `hsla(${g.hue},100%,70%,${alpha})`;
            ctx.lineWidth   = Math.max(1, 4 - g.z * 0.018);
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(pts[3][0], pts[3][1]);
            for (const pt of pts) ctx.lineTo(pt[0], pt[1]);
            ctx.closePath(); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (this._gateFlash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this._gateFlash * 0.35})`;
            ctx.fillRect(0, 0, w, h);
            this._gateFlash -= dt * 3;
        }

        // ── HUD ──────────────────────────────────────────────────────────
        const U = Math.min(w, h);
        const fs = Math.max(9, U * 0.022) | 0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.shadowBlur = 0;

        // Scanline tint — single overlay, no per-row loop
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, 0, w, h);

        // Speed (top-left)
        ctx.fillStyle = hudColor;
        ctx.textAlign = "left";
        const spd = Math.round(80 + (p.speed ?? 1) * 120 + audio * 180);
        ctx.fillText(`${spd} km/h`, U * 0.02, U * 0.04 + fs);

        // Throttle bar (below speed)
        const throttleW = U * 0.1, throttleH = 4;
        const tx = U * 0.02, ty2 = U * 0.04 + fs + 6;
        ctx.fillStyle = `hsla(${hudHue},60%,30%,${hudAlpha})`;
        ctx.fillRect(tx, ty2, throttleW, throttleH);
        ctx.fillStyle = hudColor;
        ctx.fillRect(tx, ty2, throttleW * Math.min(1, 0.4 + audio * 0.6), throttleH);

        // REC dot (top-center)
        ctx.textAlign = "center";
        if (Math.sin(t * 1.5) > 0) {
            ctx.fillStyle = `rgba(255,60,60,${hudAlpha})`;
            ctx.fillText("● REC", w / 2, U * 0.04 + fs);
        }

        // Battery + voltage (top-right)
        ctx.fillStyle = hudColor;
        ctx.textAlign = "right";
        const batV = (3.4 + (this.bat / 100) * 0.8).toFixed(1);
        ctx.fillText(`${this.bat}% ${batV}V`, w - U * 0.02, U * 0.04 + fs);

        // Altitude tape (right side, vertical)
        const altVal = Math.round(altY * 4 + Math.sin(t * 0.4) * 3 + audio * 12);
        ctx.textAlign = "right";
        ctx.fillStyle = hudColor;
        ctx.fillText(`${altVal}m`, w - U * 0.02, h / 2 - fs);
        ctx.font = `${Math.max(7, fs * 0.8) | 0}px 'Courier New',monospace`;
        ctx.fillText("ALT", w - U * 0.02, h / 2 - fs * 2.2);
        ctx.font = `bold ${fs}px 'Courier New',monospace`;

        // Heading (top-center below REC)
        const heading = ((this.yaw * 57.3 + 360) % 360) | 0;
        ctx.textAlign = "center";
        ctx.fillStyle = `hsla(${hudHue},80%,80%,${hudAlpha * 0.7})`;
        ctx.fillText(`${heading}°`, w / 2, U * 0.04 + fs * 2.4);

        // RSSI (bottom-left)
        ctx.fillStyle = hudColor;
        ctx.textAlign = "left";
        const rssi = Math.min(5, (3 + audio * 2) | 0);
        ctx.fillText(`RSSI ${"▐".repeat(rssi)}${"░".repeat(5 - rssi)}`, U * 0.02, h - U * 0.04);

        // GPS (bottom-left, above RSSI)
        ctx.fillStyle = `hsla(${hudHue},70%,70%,${hudAlpha * 0.6})`;
        ctx.font = `${Math.max(7, fs * 0.8) | 0}px 'Courier New',monospace`;
        ctx.fillText(`GPS ${(this.camX * 0.001 + 48.8566).toFixed(4)}N`, U * 0.02, h - U * 0.04 - fs * 1.4);
        ctx.font = `bold ${fs}px 'Courier New',monospace`;

        // Artificial horizon (center)
        const hx = w / 2, hy = h / 2;
        const horizW = U * 0.32;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(this.roll);
        ctx.strokeStyle = hudColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 7]);
        ctx.beginPath(); ctx.moveTo(-horizW, 0); ctx.lineTo(-horizW * 0.28, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( horizW * 0.28, 0); ctx.lineTo( horizW, 0); ctx.stroke();
        // Wing tips
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-horizW, 0); ctx.lineTo(-horizW, -U * 0.02);
        ctx.moveTo( horizW, 0); ctx.lineTo( horizW, -U * 0.02);
        ctx.stroke();
        // Pitch ladder (±5° marks)
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        for (const deg of [-5, 5]) {
            const py = (deg / 90) * fov * 0.4;
            const lw = U * 0.06;
            ctx.beginPath(); ctx.moveTo(-lw, py); ctx.lineTo(lw, py); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Center crosshair
        const cs = U * 0.017;
        ctx.strokeStyle = hudColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx - cs, hy); ctx.lineTo(hx - cs * 0.3, hy);
        ctx.moveTo(hx + cs * 0.3, hy); ctx.lineTo(hx + cs, hy);
        ctx.moveTo(hx, hy - cs); ctx.lineTo(hx, hy - cs * 0.3);
        ctx.moveTo(hx, hy + cs * 0.3); ctx.lineTo(hx, hy + cs);
        ctx.stroke();
        ctx.fillStyle = hudColor;
        ctx.beginPath(); ctx.arc(hx, hy, 1.8, 0, 6.28); ctx.fill();
    }
}

export const fpvDroneParams = () => ({
    speed:         { base: 1,   min: 0.1, max: 4,   mod: { source: "" } },
    fov:           { base: 1,   min: 0.4, max: 2,   mod: { source: "" } },
    terrain:       { base: 1,   min: 0,   max: 2,   mod: { source: "" } }, // 0=off 1=wire 2=filled
    terrainScale:  { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    terrainHue:    { base: 120, min: 0,   max: 360, mod: { source: "" } },
    altitude:      { base: 1,   min: 0.2, max: 3,   mod: { source: "" } },
    rollIntensity: { base: 1,   min: 0,   max: 3,   mod: { source: "" } },
    gates:         { base: 1,   min: 0,   max: 3,   mod: { source: "" } }, // gate count multiplier
    hudOpacity:    { base: 0.85,min: 0,   max: 1,   mod: { source: "" } },
    hudHue:        { base: 45,  min: 0,   max: 360, mod: { source: "" } },
});

export function drawFpvDrone(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new FpvViz(); _state.set(ctx, viz); }

    const sp = extra?.spectrum;
    let audio = 0, bass = 0;
    if (sp && sp.length) {
        let s = 0; for (let i = 0; i < sp.length; i++) s += sp[i];
        audio = Math.min(1, (s / sp.length) * 3);
        let bs = 0; const blen = Math.max(1, (sp.length * 0.15) | 0);
        for (let i = 0; i < blen; i++) bs += sp[i];
        bass = Math.min(1, (bs / blen) * 3);
    }
    viz.frame(ctx, w, h, p, t, audio, bass);
}
