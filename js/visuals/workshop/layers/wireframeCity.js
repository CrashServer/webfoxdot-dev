// ── Wireframe City ────────────────────────────────────────────────────────────
// Neon wireframe city: depth-sorted buildings with window lights, fog,
// setback tiers, blinking antennas, and three camera modes.
// Audio: bass pulses glow + beat flash; mid brightens windows; treble = edge.

const _state = new WeakMap();

function hash(x, z) {
    let n = (x * 73856093) ^ (z * 19349663);
    n = ((n >> 13) ^ n) * 0x45d9f3b | 0;
    return ((n >> 16) ^ n) & 0x7fffffff;
}

const GRID  = 9;
const GAP   = 1.1;
const BSIZE = 2.6;

function buildCity(hueBase) {
    const buildings = [];
    const half = Math.floor(GRID / 2);
    for (let gx = -half; gx <= half; gx++) {
        for (let gz = -half; gz <= half; gz++) {
            const h  = hash(gx, gz);
            if ((h & 0xf) < 2) continue;
            const bh  = 1.2 + (h & 0x1f) / 0x1f * 7.0;
            const bw  = BSIZE * (0.50 + (h >> 5  & 0xf) / 0xf * 0.50);
            const bd  = BSIZE * (0.50 + (h >> 9  & 0xf) / 0xf * 0.50);
            const cx  = gx * (BSIZE + GAP);
            const cz  = gz * (BSIZE + GAP);
            const hue = (hueBase + (h >> 13 & 0xff) % 140 - 70 + 360) % 360;
            const hasSetback = bh > 4.5 && (h >> 21 & 0x3) < 2;
            const setbackH   = hasSetback ? bh * (0.35 + (h >> 24 & 0xf) / 0xf * 0.2) : 0;
            const hasAntenna = bh > 5.0  && (h >> 17 & 0x3) === 0;
            const antennaH   = hasAntenna ? bh + 0.8 + (h >> 20 & 0x7) * 0.15 : 0;
            const winCols    = 2 + (h >> 6  & 0x3);
            const winRows    = 2 + Math.floor(bh * 0.9);
            buildings.push({ cx, cz, bw, bd, bh, hue, hasSetback, setbackH, hasAntenna, antennaH, winCols, winRows, h });
        }
    }
    return buildings;
}

function project(wx, wy, wz, cam, w, h) {
    const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
    const cos = Math.cos(-cam.yaw), sin = Math.sin(-cam.yaw);
    const rx =  dx * cos + dz * sin;
    const rz = -dx * sin + dz * cos;
    const ry = dy - Math.tan(cam.pitch) * rz;
    if (rz < 0.15) return null;
    const f = cam.fov * Math.min(w, h);
    return { sx: w * 0.5 + rx / rz * f, sy: h * 0.5 - ry / rz * f, depth: rz };
}

function sortByDepth(buildings, cam) {
    return buildings.slice().sort((a, b) => {
        const da = (a.cx - cam.x) ** 2 + (a.cz - cam.z) ** 2;
        const db = (b.cx - cam.x) ** 2 + (b.cz - cam.z) ** 2;
        return db - da;
    });
}

function cornersOf(cx, cz, hw, hd, y0, y1) {
    return [
        [cx - hw, y0, cz + hd], [cx + hw, y0, cz + hd],
        [cx + hw, y0, cz - hd], [cx - hw, y0, cz - hd],
        [cx - hw, y1, cz + hd], [cx + hw, y1, cz + hd],
        [cx + hw, y1, cz - hd], [cx - hw, y1, cz - hd],
    ];
}

function drawEdges(ctx, pts) {
    const edges = [
        [0,1],[1,2],[2,3],[3,0],
        [4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7],
    ];
    for (let i = 0; i < edges.length; i++) {
        const pa = pts[edges[i][0]], pb = pts[edges[i][1]];
        if (!pa || !pb) continue;
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
    }
}

function projectCorners(corners, cam, w, h) {
    const out = new Array(corners.length);
    for (let i = 0; i < corners.length; i++) {
        const c = corners[i];
        out[i] = project(c[0], c[1], c[2], cam, w, h);
    }
    return out;
}

class WireframeCityViz {
    constructor() {
        this.t = 0;
        this.buildings = null;
        this.pulse = 0;
        this.beatFlash = 0;
        this._hueBase = -999;
    }

    frame(ctx, w, h, p, spec) {
        this.t += 1 / 60;

        const hue    = (p.hue    ?? 180) | 0;
        const speed  = p.speed   ?? 0.15;
        const glow   = p.glow    ?? 1.5;
        const height = p.height  ?? 1.0;
        const fovP   = p.fov     ?? 0.6;
        const mode   = Math.round(p.mode ?? 0); // 0=orbit 1=flythrough 2=crane

        // Audio bands
        const n = spec?.length ?? 0;
        let bass = 0, mid = 0, treble = 0;
        if (n > 0) {
            const bN = Math.max(1, n * 0.10 | 0);
            const mN = Math.max(1, n * 0.30 | 0);
            for (let i = 0;       i < bN;       i++) bass   += spec[i];
            for (let i = bN;      i < bN + mN;  i++) mid    += spec[i];
            for (let i = bN + mN; i < n;        i++) treble += spec[i];
            bass   = Math.min(1, bass   / bN                 * 3);
            mid    = Math.min(1, mid    / mN                 * 3);
            treble = Math.min(1, treble / (n - bN - mN || 1) * 3);
        }

        if (Math.abs(hue - this._hueBase) > 15) {
            this._hueBase = hue;
            this.buildings = buildCity(hue);
        }

        if (bass > 0.50) this.pulse     = Math.min(1, this.pulse     + (bass - 0.50) * 1.8);
        if (bass > 0.72) this.beatFlash = Math.min(1, this.beatFlash + (bass - 0.72) * 3.0);
        this.pulse     *= 0.85;
        this.beatFlash *= 0.78;

        // ── Camera ────────────────────────────────────────────────────────
        const orbitR = GRID * 1.35;
        let cam;
        if (mode === 1) {
            // Flythrough: cruise down main street with a gentle weave
            const streetLen = GRID * (BSIZE + GAP);
            const zPos = ((this.t * speed * 4) % (streetLen * 2)) - streetLen;
            cam = {
                x:     Math.sin(this.t * speed * 0.35) * (BSIZE + GAP) * 0.45,
                y:     1.2 + height * 0.8,
                z:     zPos,
                yaw:   Math.sin(this.t * speed * 0.35) * 0.18,
                pitch: -0.06 - height * 0.03,
                fov:   fovP * 1.2,
            };
        } else if (mode === 2) {
            // Crane: slow upward spiral with increasing tilt
            const angle = this.t * speed;
            const rise  = (this.t * speed * 0.15) % 1;
            const r = orbitR * (1 - rise * 0.45);
            cam = {
                x:     Math.cos(angle * 0.65) * r,
                y:     3 + rise * 20 * height,
                z:     Math.sin(angle * 0.65) * r,
                yaw:   angle * 0.65 + Math.PI,
                pitch: -0.08 - rise * 0.38,
                fov:   fovP * (0.85 + rise * 0.35),
            };
        } else {
            // Orbit: slow circle with gentle bob
            const angle = this.t * speed;
            cam = {
                x:     Math.cos(angle) * orbitR,
                y:     (7 + height * 3.5) + Math.sin(this.t * 0.28) * 0.5,
                z:     Math.sin(angle) * orbitR,
                yaw:   angle + Math.PI,
                pitch: -0.22 - height * 0.05 + Math.sin(this.t * 0.18) * 0.03,
                fov:   fovP * (1 - this.pulse * 0.04),
            };
        }

        // ── Background + beat flash ────────────────────────────────────────
        ctx.fillStyle = `hsl(${hue},25%,2%)`;
        ctx.fillRect(0, 0, w, h);

        if (this.beatFlash > 0.01) {
            ctx.fillStyle = `hsla(${hue},90%,65%,${this.beatFlash * 0.07})`;
            ctx.fillRect(0, 0, w, h);
        }

        // ── Ground grid ───────────────────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.14 + mid * 0.10;
        ctx.strokeStyle = `hsl(${hue},60%,26%)`;
        ctx.lineWidth   = 0.5;
        const ext  = GRID * (BSIZE + GAP) * 0.5 + GAP;
        const step = BSIZE + GAP;
        ctx.beginPath();
        for (let gi = -GRID; gi <= GRID; gi++) {
            const wx = gi * step * 0.5;
            const g0 = project(wx, 0, -ext, cam, w, h);
            const g1 = project(wx, 0,  ext, cam, w, h);
            if (g0 && g1) { ctx.moveTo(g0.sx, g0.sy); ctx.lineTo(g1.sx, g1.sy); }
            const wz = gi * step * 0.5;
            const g2 = project(-ext, 0, wz, cam, w, h);
            const g3 = project( ext, 0, wz, cam, w, h);
            if (g2 && g3) { ctx.moveTo(g2.sx, g2.sy); ctx.lineTo(g3.sx, g3.sy); }
        }
        ctx.stroke();
        ctx.restore();

        // ── Buildings ─────────────────────────────────────────────────────
        const sorted   = sortByDepth(this.buildings, cam);
        const fogStart = orbitR * 0.75;

        for (let bi = 0; bi < sorted.length; bi++) {
            const b = sorted[bi];
            const { cx, cz, bw, bd, bh: bhr, hue: bHue,
                    hasSetback, setbackH, hasAntenna, antennaH,
                    winCols, winRows, h: bhash } = b;
            const bh = bhr * height;
            const hw = bw * 0.5, hd = bd * 0.5;

            const centerPt = project(cx, bh * 0.5, cz, cam, w, h);
            if (!centerPt) continue;
            const depth = centerPt.depth;
            if (depth > fogStart * 3.5) continue;

            const fogF     = Math.max(0, Math.min(1, (depth - fogStart) / (fogStart * 1.4)));
            const distFade = Math.max(0.07, Math.min(1, 10 / (depth + 1)));
            const bright   = (42 + treble * 28 + this.pulse * 22) * (1 - fogF * 0.65);
            const alpha    = distFade * (0.52 + treble * 0.22 + this.pulse * 0.22) * (1 - fogF * 0.55);
            const glowA    = distFade * (0.28 + this.pulse * 0.45) * (1 - fogF * 0.65);

            // Main box
            const pts = projectCorners(cornersOf(cx, cz, hw, hd, 0, bh), cam, w, h);
            let anyVisible = false;
            for (let ci = 0; ci < 8; ci++) if (pts[ci]) { anyVisible = true; break; }
            if (!anyVisible) continue;

            if (glow > 0.05) {
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = `hsla(${bHue},90%,${bright}%,${glowA})`;
                ctx.lineWidth   = 1.9 * distFade;
                ctx.beginPath();
                drawEdges(ctx, pts);
                ctx.stroke();
                ctx.restore();
            }

            ctx.strokeStyle = `hsla(${bHue},75%,${bright + 18}%,${alpha})`;
            ctx.lineWidth   = Math.max(0.3, 1.35 * distFade);
            ctx.beginPath();
            drawEdges(ctx, pts);
            ctx.stroke();

            // Setback upper tier
            if (hasSetback && setbackH > 0) {
                const sbh  = setbackH * height;
                const sPts = projectCorners(cornersOf(cx, cz, hw * 0.58, hd * 0.58, bh, bh + sbh), cam, w, h);
                ctx.strokeStyle = `hsla(${bHue},80%,${bright + 10}%,${alpha * 0.88})`;
                ctx.lineWidth   = Math.max(0.25, distFade * 0.95);
                ctx.beginPath();
                drawEdges(ctx, sPts);
                ctx.stroke();
            }

            // Antenna
            if (hasAntenna && antennaH > 0) {
                const aBase = project(cx, bh,                cz, cam, w, h);
                const aTip  = project(cx, antennaH * height, cz, cam, w, h);
                if (aBase && aTip) {
                    ctx.strokeStyle = `hsla(${bHue},95%,80%,${alpha * 0.9})`;
                    ctx.lineWidth   = Math.max(0.35, distFade * 0.75);
                    ctx.beginPath();
                    ctx.moveTo(aBase.sx, aBase.sy);
                    ctx.lineTo(aTip.sx, aTip.sy);
                    ctx.stroke();
                    if (Math.sin(this.t * 2.4 + bhash * 0.001) > 0.55) {
                        ctx.fillStyle = `hsla(0,100%,72%,${alpha * 0.95})`;
                        ctx.beginPath();
                        ctx.arc(aTip.sx, aTip.sy, Math.max(1, 2.5 * distFade), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Window lights — project 3D window positions on visible faces
            if (depth < fogStart * 2.2 && distFade > 0.12) {
                const winAlpha = (0.28 + mid * 0.55) * distFade * (1 - fogF * 0.8);
                if (winAlpha > 0.04) {
                    const wHue = (bHue + 40) % 360;
                    const ws   = Math.max(1, 3.2 * distFade);
                    for (let wj = 0; wj < winRows; wj++) {
                        const wy = 0.35 + (wj + 0.5) * (bh - 0.45) / winRows;
                        // Front face (+Z)
                        if (cam.z > cz + hd - 0.5) {
                            ctx.fillStyle = `hsla(${wHue},90%,85%,${winAlpha})`;
                            for (let wi = 0; wi < winCols; wi++) {
                                const wxp = cx - hw + (wi + 0.5) * bw / winCols;
                                const wp  = project(wxp, wy, cz + hd + 0.04, cam, w, h);
                                if (wp) ctx.fillRect(wp.sx - ws, wp.sy - ws * 0.55, ws * 2, ws * 1.1);
                            }
                        }
                        // Back face (-Z)
                        if (cam.z < cz - hd + 0.5) {
                            ctx.fillStyle = `hsla(${wHue},90%,85%,${winAlpha})`;
                            for (let wi = 0; wi < winCols; wi++) {
                                const wxp = cx - hw + (wi + 0.5) * bw / winCols;
                                const wp  = project(wxp, wy, cz - hd - 0.04, cam, w, h);
                                if (wp) ctx.fillRect(wp.sx - ws, wp.sy - ws * 0.55, ws * 2, ws * 1.1);
                            }
                        }
                        // Right face (+X)
                        if (cam.x > cx + hw - 0.5) {
                            ctx.fillStyle = `hsla(${(wHue + 20) % 360},90%,85%,${winAlpha})`;
                            for (let wi = 0; wi < winCols; wi++) {
                                const wzp = cz - hd + (wi + 0.5) * bd / winCols;
                                const wp  = project(cx + hw + 0.04, wy, wzp, cam, w, h);
                                if (wp) ctx.fillRect(wp.sx - ws, wp.sy - ws * 0.55, ws * 2, ws * 1.1);
                            }
                        }
                        // Left face (-X)
                        if (cam.x < cx - hw + 0.5) {
                            ctx.fillStyle = `hsla(${(wHue + 20) % 360},90%,85%,${winAlpha})`;
                            for (let wi = 0; wi < winCols; wi++) {
                                const wzp = cz - hd + (wi + 0.5) * bd / winCols;
                                const wp  = project(cx - hw - 0.04, wy, wzp, cam, w, h);
                                if (wp) ctx.fillRect(wp.sx - ws, wp.sy - ws * 0.55, ws * 2, ws * 1.1);
                            }
                        }
                    }
                }
            }
        }

        // Subtle scanline overlay
        ctx.fillStyle = `rgba(0,0,0,0.055)`;
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    }
}

export const wireframeCityParams = () => ({
    hue:    { base: 180, min: 0,   max: 360, mod: { source: "" } },
    speed:  { base: 0.15,min: 0,   max: 1.5, mod: { source: "" } },
    glow:   { base: 1.5, min: 0,   max: 4,   mod: { source: "" } },
    height: { base: 1,   min: 0.2, max: 3,   mod: { source: "" } },
    fov:    { base: 0.6, min: 0.2, max: 1.2, mod: { source: "" } },
    mode:   { base: 0,   min: 0,   max: 2,   step: 1, mod: { source: "" } },
});

export function drawWireframeCity(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new WireframeCityViz(); _state.set(ctx, viz); }
    viz.frame(ctx, w, h, p, extra?.spectrum);
}
