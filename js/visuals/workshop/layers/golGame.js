// ── Game of Life ──────────────────────────────────────────────────────────────
// Conway's B3/S23 cellular automaton on a toroidal grid. Cells age through a
// multi-stop color gradient revealing their lifetime. Multiple rulesets selectable.
// Bass seeds live cells in 3x3 blocks; mid shifts color hue; treble speeds evolution.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

// Rulesets encoded as [born-bitmask, survive-bitmask]
const RULESETS = [
    [0b000001000, 0b000001100], // B3/S23 Conway
    [0b000010000, 0b000001100], // B4/S23 HighLife
    [0b000001000, 0b001111000], // B3/S345 Maze
    [0b000001100, 0b000001100], // B34/S23
    [0b000001000, 0b000111100], // B3/S2345 Morley
    [0b000000110, 0b001111000], // B23/S345 2x2
];

class GoLViz {
    constructor(GW, GH) {
        this.GW = GW; this.GH = GH;
        const N = GW * GH;
        this._grid = new Uint8Array(N);
        this._next = new Uint8Array(N);
        this._age  = new Uint16Array(N); // cell lifetime in ticks
        this._off  = null; this._offCtx = null;
        this._ruleset = 0;
        this._seed();
    }

    _seed() {
        const { GW, GH, _grid, _age } = this;
        for (let i = 0; i < GW * GH; i++) {
            _grid[i] = Math.random() < 0.33 ? 1 : 0;
            _age[i]  = _grid[i] ? 1 : 0;
        }
    }

    _ensureOff() {
        if (!this._off || this._off.width !== this.GW) {
            this._off    = new OffscreenCanvas(this.GW, this.GH);
            this._offCtx = this._off.getContext('2d');
        }
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const GW = this.GW, GH = this.GH, N = GW * GH;
        const speed    = Math.max(1, Math.min(8, Math.round(p.speed + treble * 3 || 2)));
        const hue      = (p.hue ?? 140) + mid * 80;
        const decay    = p.decay ?? 0.03;
        const ruleIdx  = Math.max(0, Math.min(RULESETS.length - 1, p.ruleset | 0 || 0));
        const maxAge   = Math.max(10, p.maxAge | 0 || 60);
        const bgFade   = p.bgFade ?? 0.15;

        // Ruleset hot-swap
        if (ruleIdx !== this._ruleset) { this._ruleset = ruleIdx; }
        const [born, survive] = RULESETS[this._ruleset];

        this._ensureOff();
        ctx.clearRect(0, 0, w, h);

        // Bass: scatter live 3x3 blocks
        if (bass > 0.45) {
            const blocks = Math.ceil(bass * 4);
            for (let b = 0; b < blocks; b++) {
                const cx = (Math.random() * (GW - 4) + 1) | 0;
                const cy = (Math.random() * (GH - 4) + 1) | 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const i = ((cy + dy + GH) % GH) * GW + ((cx + dx + GW) % GW);
                    this._grid[i] = 1; this._age[i] = Math.max(this._age[i], 1);
                }
            }
        }

        const g = this._grid, nx = this._next, age = this._age;
        for (let step = 0; step < speed; step++) {
            for (let y = 0; y < GH; y++) {
                const yn = (y === 0 ? GH - 1 : y - 1) * GW;
                const yc = y * GW;
                const yp = (y === GH - 1 ? 0 : y + 1) * GW;
                for (let x = 0; x < GW; x++) {
                    const xn = x === 0 ? GW - 1 : x - 1;
                    const xp = x === GW - 1 ? 0 : x + 1;
                    const nb = g[yn+xn]+g[yn+x]+g[yn+xp]+g[yc+xn]+g[yc+xp]+g[yp+xn]+g[yp+x]+g[yp+xp];
                    const alive = g[yc + x];
                    const mask  = 1 << nb;
                    nx[yc + x] = alive ? ((survive & mask) ? 1 : 0) : ((born & mask) ? 1 : 0);
                }
            }
            g.set(nx);
            for (let i = 0; i < N; i++) {
                if (g[i]) age[i] = Math.min(maxAge, age[i] + 1);
                else age[i] = Math.max(0, age[i] - Math.ceil(decay * maxAge));
            }
        }

        // Render age as multi-stop color gradient
        const id = this._offCtx.createImageData(GW, GH);
        const d  = id.data;
        for (let i = 0; i < N; i++) {
            const a = age[i];
            if (a === 0) { d[i*4+3] = 255; continue; } // black bg
            const norm  = a / maxAge; // 0=just born, 1=ancient
            // Young: hot white-blue, mature: hue-colored, ancient: dim shifted
            let ch, cs, cl;
            if (norm < 0.15) {
                // Birth flash — white-hot
                const f = norm / 0.15;
                ch = hue + 60; cs = 30 + f * 50; cl = 60 + (1 - f) * 35;
            } else if (norm < 0.6) {
                const f = (norm - 0.15) / 0.45;
                ch = hue + 40 - f * 40; cs = 80; cl = 55 + f * 10;
            } else {
                const f = (norm - 0.6) / 0.4;
                ch = hue - f * 30; cs = 85; cl = 65 - f * 30;
            }
            const [r, g2, b] = hsl2rgb(ch, cs / 100, cl / 100);
            d[i*4] = r; d[i*4+1] = g2; d[i*4+2] = b; d[i*4+3] = 255;
        }
        this._offCtx.putImageData(id, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._off, 0, 0, w, h);
    }
}

export const golGameParams = () => ({
    speed:   { base: 2,    min: 1,   max: 8,   mod: { source: "" } },
    hue:     { base: 140,  min: 0,   max: 360, mod: { source: "" } },
    decay:   { base: 0.03, min: 0.005, max: 0.5, mod: { source: "" } },
    maxAge:  { base: 60,   min: 5,   max: 200, mod: { source: "" } },
    ruleset: { base: 0,    min: 0,   max: 5,   mod: { source: "" } },
    bgFade:  { base: 0.15, min: 0,   max: 1,   mod: { source: "" } },
    size:    { base: 128,  min: 64,  max: 256, mod: { source: "" } },
});

export function drawGolGame(ctx, w, h, p, t, extra) {
    const GW = Math.max(64, Math.min(256, Math.round((p.size ?? 128) / 64) * 64));
    let viz = _state.get(ctx);
    if (!viz || viz.GW !== GW) { viz = new GoLViz(GW, GW); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2) : 0;
    const mid    = sp ? Math.min(1, (sp[8] + sp[10] + sp[12]) / 3 * 2) : 0;
    const treble = sp ? Math.min(1, (sp[30] + sp[40] + sp[50]) / 3 * 2) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
