// ── Maze City ─────────────────────────────────────────────────────────────────
// DDA raycaster over a procedurally generated maze. The camera wanders the
// corridors autonomously; buildings vary in colour and height by position hash.
// Audio boosts brightness; bass triggers a wall-colour pulse.

const _state = new WeakMap();

const GRID = 21; // must be odd; gives (GRID-1)/2 = 10 rooms per axis

// ── Maze generation (recursive backtracker) ───────────────────────────────────
function buildMaze(rng) {
    const g = Array.from({ length: GRID }, () => new Uint8Array(GRID).fill(1));
    const RW = (GRID - 1) >> 1, RH = (GRID - 1) >> 1;
    const vis = Array.from({ length: RH }, () => new Uint8Array(RW));
    function carve(cx, cy) {
        vis[cy][cx] = 1;
        g[cy * 2 + 1][cx * 2 + 1] = 0;
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
        for (let i = 3; i > 0; i--) { const j = (rng() * (i+1)) | 0; const t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t; }
        for (const [dx, dy] of dirs) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < RW && ny >= 0 && ny < RH && !vis[ny][nx]) {
                g[cy*2+1 + dy][cx*2+1 + dx] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(0, 0);
    return g;
}

// Wall colour palette: hash cell position to a "building type"
function cellHue(gx, gy) {
    const h = (gx * 73 + gy * 137 + gx * gy * 31) & 0xff;
    const types = [200, 260, 180, 30, 0, 290]; // cyan, purple, teal, amber, red, magenta
    return types[h % types.length];
}
function cellHeight(gx, gy) {
    return 0.7 + ((gx * 57 + gy * 89) & 0x1f) / 0x1f * 1.8;
}

// ── Camera navigator ──────────────────────────────────────────────────────────
class CameraNav {
    constructor(grid) {
        this.grid = grid;
        this.px = 1.5; this.py = 1.5;
        this.angle = 0;
        this.targetAngle = 0;
        this._junctionCooldown = 0;
    }

    isOpen(x, y) {
        const gx = x | 0, gy = y | 0;
        if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return false;
        return this.grid[gy][gx] === 0;
    }

    _chooseDir() {
        const PI2 = Math.PI * 2;
        const card = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
        // Bias toward forward-ish directions to avoid U-turns
        const forward = ((this.targetAngle % PI2) + PI2) % PI2;
        const open = card.filter(d => {
            const nx = this.px + Math.cos(d) * 1.5;
            const ny = this.py + Math.sin(d) * 1.5;
            return this.isOpen(nx, ny);
        });
        if (!open.length) return forward + Math.PI; // dead end: turn around
        // Weight forward direction
        const fwd = open.filter(d => Math.abs(d - forward) < 0.1 || Math.abs(d - forward - PI2) < 0.1 || Math.abs(d - forward + PI2) < 0.1);
        const pool = fwd.length > 0 && Math.random() < 0.65 ? fwd : open;
        return pool[(Math.random() * pool.length) | 0];
    }

    step(dt, speed) {
        this._junctionCooldown -= dt;
        // Smoothly rotate toward target
        let da = this.targetAngle - this.angle;
        while (da > Math.PI)  da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        this.angle += da * Math.min(1, dt * 4);

        // Move forward with simple wall sliding
        const spd = speed * dt;
        const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
        const margin = 0.28;
        const nx = this.px + cos * spd, ny = this.py + sin * spd;
        if (this.isOpen(nx + Math.sign(cos) * margin, this.py)) this.px = nx;
        else if (this._junctionCooldown < 0) { this.targetAngle = this._chooseDir(); this._junctionCooldown = 0.4; }
        if (this.isOpen(this.px, ny + Math.sign(sin) * margin)) this.py = ny;
        else if (this._junctionCooldown < 0) { this.targetAngle = this._chooseDir(); this._junctionCooldown = 0.4; }

        // At cell centre → junction decision
        const fracX = this.px - Math.floor(this.px), fracY = this.py - Math.floor(this.py);
        if (Math.abs(fracX - 0.5) < 0.07 && Math.abs(fracY - 0.5) < 0.07 && this._junctionCooldown < 0) {
            this.targetAngle = this._chooseDir();
            this._junctionCooldown = 0.6;
        }
    }
}

// ── Raycaster ────────────────────────────────────────────────────────────────
function castRay(grid, px, py, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let mapX = px | 0, mapY = py | 0;
    const absCos = Math.abs(cos), absSin = Math.abs(sin);
    const deltaX = absCos < 1e-9 ? 1e9 : 1 / absCos;
    const deltaY = absSin < 1e-9 ? 1e9 : 1 / absSin;
    const stepX = cos < 0 ? -1 : 1, stepY = sin < 0 ? -1 : 1;
    let sideDistX = cos < 0 ? (px - mapX) * deltaX : (mapX + 1 - px) * deltaX;
    let sideDistY = sin < 0 ? (py - mapY) * deltaY : (mapY + 1 - py) * deltaY;
    let side = 0;
    for (let i = 0; i < 40; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
        else                        { sideDistY += deltaY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapX >= GRID || mapY < 0 || mapY >= GRID || grid[mapY][mapX] !== 0) break;
    }
    const dist = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
    return { dist: Math.max(0.05, dist), mapX, mapY, side };
}

class MazeCityViz {
    constructor() {
        this.maze = null;
        this.cam  = null;
        this.t    = 0;
        this.pulse = 0;
        this.prevBass = 0;
        this._rngState = 12345;
    }

    _rng() { this._rngState ^= this._rngState << 13; this._rngState ^= this._rngState >> 17; this._rngState ^= this._rngState << 5; return ((this._rngState >>> 0) / 0xffffffff); }

    _init() {
        this.maze = buildMaze(() => this._rng());
        this.cam  = new CameraNav(this.maze);
    }

    frame(ctx, w, h, p, t, audio, bass) {
        if (!this.maze) this._init();
        const dt    = Math.min(0.05, 1 / 60);
        this.t     += dt;
        const speed   = (p.speed   ?? 2) * (1 + audio * 1.5);
        const fov     = (p.fov     ?? 0.9) * Math.PI; // field of view
        const hue     = (p.hue    ?? 200) | 0;
        const glow    = p.glow    ?? 1;
        const ambient = p.ambient ?? 0.15;

        // Beat detection with prevBass for sharper trigger
        if (bass > 0.6 && bass > this.prevBass + 0.1) this.pulse = 1;
        this.prevBass = bass;
        this.pulse *= 0.85;

        this.cam.step(dt, speed);

        // Strip width — fewer strips = faster
        const strip = Math.max(2, (w / 320) | 0);
        const cols  = Math.ceil(w / strip);

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        skyGrad.addColorStop(0, `hsl(${hue},40%,4%)`);
        skyGrad.addColorStop(1, `hsl(${hue},30%,12%)`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.5);

        // Floor
        const floorGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        floorGrad.addColorStop(0, `hsl(${hue},15%,9%)`);
        floorGrad.addColorStop(1, `hsl(${hue},10%,3%)`);
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        for (let col = 0; col < cols; col++) {
            const rayAngle = this.cam.angle + (col / cols - 0.5) * fov;
            const { dist, mapX, mapY, side } = castRay(this.maze, this.cam.px, this.cam.py, rayAngle);

            // Correct fish-eye with cosine of angle offset
            const corrDist = dist * Math.cos(rayAngle - this.cam.angle);
            const wallH    = Math.min(h * 2, h / corrDist) * cellHeight(mapX, mapY);
            const top      = ((h - wallH) * 0.5) | 0;

            const wHue  = (hue + cellHue(mapX, mapY)) % 360;
            // Beat pulse boosts building brightness like a strobe
            const shade = Math.max(ambient, 1 / (1 + corrDist * corrDist * 0.12)) * (side ? 0.55 : 1) * (1 + audio * 0.3 + this.pulse * 0.7);
            const lum   = Math.min(80, 15 + shade * 55);

            // Windows: beat-reactive — on pulse, more windows light up brighter
            const winThresh = Math.sin(col * 0.15);
            const winRow    = ((top + wallH * 0.15) | 0) % Math.max(8, (wallH * 0.18) | 0);
            const winActive = winThresh > (0.3 - this.pulse * 0.25) && winRow < (4 + this.pulse * 6);
            // Window color: treble drives warm/cool shift; pulse gives a hot flash
            const winHue    = (wHue + this.pulse * 40) % 360;
            const winBright = winActive ? (1.3 + this.pulse * 0.6 + audio * 0.3) : 1;

            ctx.fillStyle = `hsl(${winHue},${55 + audio * 20 + this.pulse * 25}%,${lum * winBright}%)`;
            if (glow > 0.1) {ctx.shadowBlur = 0; }
            ctx.fillRect(col * strip, top, strip, wallH);
        }
        ctx.shadowBlur = 0;
    }
}

function audioLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    let s = 0; for (let i = 0; i < spectrum.length; i++) s += spectrum[i];
    return Math.min(1, (s / spectrum.length) * 3);
}
function bassLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    const n = Math.max(1, (spectrum.length * 0.18) | 0);
    let s = 0; for (let i = 0; i < n; i++) s += spectrum[i];
    return Math.min(1, (s / n) * 3);
}

export const mazeCityParams = () => ({
    speed:   { base: 2,    min: 0.2,  max: 8,   mod: { source: "" } },
    fov:     { base: 0.9,  min: 0.3,  max: 1.5, mod: { source: "" } },
    ambient: { base: 0.15, min: 0,    max: 1,   mod: { source: "" } },
    hue:     { base: 200,  min: 0,    max: 360, mod: { source: "" } },
    glow:    { base: 1,    min: 0,    max: 3,   mod: { source: "" } },
});

export function drawMazeCity(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new MazeCityViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(sp), bassLevel(sp));
}
