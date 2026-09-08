// ── Doom Corridor ─────────────────────────────────────────────────────────
// A DDA raycaster: one ray per screen column against a generated grid maze,
// walls drawn as vertical spans shaded by distance and face. This is the
// original 2.5D trick and it is a natural fit for Canvas2D — no per-pixel
// shader needed, just N vertical strips.
// Bass drives head-bob and pace, so the corridor lurches with the track.

const maps = new Map();          // seed -> Uint8Array grid

function makeMap(seed, N = 24) {
    const key = seed + "x" + N;
    if (maps.has(key)) return maps.get(key);
    let s = (seed | 0) * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const g = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        // Pillars on a lattice + scattered blocks: reads as rooms and corridors
        // rather than noise, and always leaves the odd cells walkable.
        const lattice = x % 4 === 0 && y % 4 === 0;
        g[y * N + x] = edge || lattice || rnd() < 0.13 ? 1 + ((rnd() * 3) | 0) : 0;
    }
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (x % 2 && y % 2) g[y * N + x] = 0;
    maps.set(key, { g, N });
    return maps.get(key);
}

export const doomCorridorParams = () => ({
    seed:      { base: 3,   min: 0,   max: 64, step: 1, mod: { source: "" } },
    speed:     { base: 1.6, min: -4,  max: 6,   mod: { source: "" } },
    turn:      { base: 0.25,min: -2,  max: 2,   mod: { source: "" } },
    fov:       { base: 1.05,min: 0.4, max: 2.2, mod: { source: "" } },
    columns:   { base: 220, min: 40,  max: 640, step: 1, mod: { source: "" } },
    fog:       { base: 0.55,min: 0,   max: 1,   mod: { source: "" } },
    hue:       { base: 12,  min: 0,   max: 360, mod: { source: "" } },
    hueSpread: { base: 60,  min: 0,   max: 180, mod: { source: "" } },
    bob:       { base: 0.5, min: 0,   max: 3,   mod: { source: "" } },
    bassToBob: { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
    ceiling:   { base: 1,   min: 0,   max: 1, step: 1, mod: { source: "" } },
    scanlines: { base: 0.25,min: 0,   max: 1,   mod: { source: "" } },
});

function bassLevel(s) {
    if (!s?.length) return 0;
    const n = Math.max(1, (s.length * 0.08) | 0);
    let v = 0; for (let i = 1; i <= n; i++) v += s[i];
    return Math.min(1, (v / n) * 2.5);
}

// Walking state is module-level so the camera keeps moving across frames.
let px = 3.5, py = 3.5, dir = 0, lastT = 0, lastSeed = -1;

export function drawDoomCorridor(ctx, w, h, p, t, extra) {
    const { g, N } = makeMap(Math.round(p.seed ?? 3));
    if (lastSeed !== Math.round(p.seed ?? 3)) { px = 3.5; py = 3.5; dir = 0; lastSeed = Math.round(p.seed ?? 3); }
    let dt = t - lastT; lastT = t;
    if (!(dt > 0) || dt > 0.5) dt = 0;

    const bass = bassLevel(extra?.spectrum);
    dir += (p.turn ?? 0) * dt;
    const spd = (p.speed ?? 1.6) * dt;
    // Step, but refuse to walk into a wall — slide along it instead.
    const nx = px + Math.cos(dir) * spd, ny = py + Math.sin(dir) * spd;
    const solid = (x, y) => { const i = ((y | 0) * N + (x | 0)); return x < 0 || y < 0 || x >= N || y >= N || g[i]; };
    if (!solid(nx, py)) px = nx; else dir += 1.1 * dt;
    if (!solid(px, ny)) py = ny; else dir += 1.1 * dt;

    const bobAmt = (p.bob ?? 0.5) * (1 + bass * (p.bassToBob ?? 1));
    const horizon = h * 0.5 + Math.sin(t * 6) * bobAmt * h * 0.012;

    const hue = p.hue ?? 12, spread = p.hueSpread ?? 60, fog = p.fog ?? 0.55;
    ctx.clearRect(0, 0, w, h);
    // floor / ceiling wash
    const gfl = ctx.createLinearGradient(0, horizon, 0, h);
    gfl.addColorStop(0, `hsl(${hue} 30% 4%)`); gfl.addColorStop(1, `hsl(${hue} 45% 14%)`);
    ctx.fillStyle = gfl; ctx.fillRect(0, horizon, w, h - horizon);
    if ((p.ceiling ?? 1) > 0.5) {
        const gc = ctx.createLinearGradient(0, 0, 0, horizon);
        gc.addColorStop(0, `hsl(${(hue + 200) % 360} 40% 10%)`); gc.addColorStop(1, `hsl(${hue} 20% 3%)`);
        ctx.fillStyle = gc; ctx.fillRect(0, 0, w, horizon);
    }

    const cols = Math.max(40, Math.round(p.columns ?? 220));
    const cw = w / cols, fov = p.fov ?? 1.05;
    const planeLen = Math.tan(fov * 0.5);

    for (let c = 0; c < cols; c++) {
        const camX = (2 * c) / cols - 1;
        const rdx = Math.cos(dir) - Math.sin(dir) * planeLen * camX;
        const rdy = Math.sin(dir) + Math.cos(dir) * planeLen * camX;
        let mx = px | 0, my = py | 0;
        const ddx = Math.abs(1 / (rdx || 1e-6)), ddy = Math.abs(1 / (rdy || 1e-6));
        const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
        let sdx = (rdx < 0 ? px - mx : mx + 1 - px) * ddx;
        let sdy = (rdy < 0 ? py - my : my + 1 - py) * ddy;
        let side = 0, hit = 0, guard = 0;
        while (!hit && guard++ < 96) {
            if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
            if (mx < 0 || my < 0 || mx >= N || my >= N) break;
            hit = g[my * N + mx];
        }
        if (!hit) continue;
        const dist = side === 0 ? sdx - ddx : sdy - ddy;
        if (dist <= 0.01) continue;
        const lineH = h / dist;
        const shade = Math.max(0, 1 - (dist / (N * 0.55)) ** 1.2 * fog) * (side ? 0.68 : 1);
        ctx.fillStyle = `hsl(${(hue + hit * spread * 0.33) % 360} ${55 + hit * 8}% ${Math.round(8 + shade * 52)}%)`;
        ctx.fillRect(c * cw, horizon - lineH / 2, cw + 1, lineH);
    }

    const sl = p.scanlines ?? 0.25;
    if (sl > 0.01) {
        ctx.save(); ctx.globalAlpha = sl * 0.5; ctx.fillStyle = "#000";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        ctx.restore();
    }
}
