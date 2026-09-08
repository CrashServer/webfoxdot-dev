// ── Lava Lamp layer ────────────────────────────────────────────────────────
// Metaball lava lamp rendered on a 100×100 scalar field.
// 5–8 blobs with positions, velocities, and upward/downward drift.
// At each pixel: sum r²/(dist²+ε) for each blob; threshold at 1.0.
// Vertical gradient colors the interior. Bass pulses blob size.

const _state = new WeakMap();
const BUF_W = 100, BUF_H = 100;

class Blob {
    constructor(w, h) {
        this.x    = 0.2 + Math.random() * 0.6;
        this.y    = 0.3 + Math.random() * 0.4;
        this.vx   = (Math.random() - 0.5) * 0.003;
        this.vy   = (Math.random() - 0.5) * 0.002;
        this.r    = 0.12 + Math.random() * 0.08;
        this.phase = Math.random() * Math.PI * 2;
        this.driftDir = Math.random() < 0.5 ? 1 : -1;
    }
}

class LavaLamp {
    constructor(n) {
        this.blobs  = [];
        for (let i = 0; i < n; i++) this.blobs.push(new Blob());
        this.oc     = new OffscreenCanvas(BUF_W, BUF_H);
        this.octx   = this.oc.getContext("2d");
        this.img    = this.octx.createImageData(BUF_W, BUF_H);
        this.prevN  = n;
    }

    _ensureCount(n) {
        while (this.blobs.length < n) this.blobs.push(new Blob());
        if (this.blobs.length > n) this.blobs.length = n;
    }

    frame(ctx, w, h, p, t, audio, bass, mid, treble, spectrum) {
        const count  = Math.max(2, Math.min(8, Math.round(p.count ?? 6)));
        this._ensureCount(count);
        const speed  = p.speed ?? 0.4;
        const hue    = p.hue ?? 20;
        const glow   = p.glow ?? 1.5;
        const dt     = 1 / 60;
        const bSize  = 1 + bass * 0.5;

        // Update blob positions
        for (let i = 0; i < this.blobs.length; i++) {
            const b = this.blobs[i];
            // Slow drift + drift reversal at edges
            const drift = Math.sin(t * speed * 0.4 + b.phase) * 0.001 * b.driftDir;
            b.vy += drift;
            b.vy *= 0.995;
            b.vx *= 0.995;
            b.x += b.vx * speed;
            b.y += b.vy * speed;
            // Bounce off walls
            if (b.x < 0.08) { b.x = 0.08; b.vx = Math.abs(b.vx); }
            if (b.x > 0.92) { b.x = 0.92; b.vx = -Math.abs(b.vx); }
            if (b.y < 0.05) { b.y = 0.05; b.vy = Math.abs(b.vy); }
            if (b.y > 0.95) { b.y = 0.95; b.vy = -Math.abs(b.vy); }
        }

        const data = this.img.data;
        for (let py = 0; py < BUF_H; py++) {
            const fy = py / BUF_H;
            for (let px = 0; px < BUF_W; px++) {
                const fx = px / BUF_W;
                let field = 0;
                for (let i = 0; i < this.blobs.length; i++) {
                    const b  = this.blobs[i];
                    const dx = fx - b.x, dy = fy - b.y;
                    const r2 = (b.r * bSize) * (b.r * bSize);
                    field += r2 / (dx * dx + dy * dy + 1e-4);
                }

                const idx = (py * BUF_W + px) * 4;
                if (field > 1.0) {
                    // Inside blob: vertical gradient cool (top) → warm (bottom)
                    const warmness = fy; // 0=top/cool, 1=bottom/warm
                    const blobHue  = (hue + (1 - warmness) * 60) % 360;
                    const blobLit  = 50 + warmness * 20;
                    // Convert HSL to approximate RGB inline
                    const H = blobHue / 360, S = 0.85, L = blobLit / 100;
                    const C = (1 - Math.abs(2 * L - 1)) * S;
                    const X = C * (1 - Math.abs(((H * 6) % 2) - 1));
                    const m = L - C / 2;
                    let rr = 0, gg = 0, bb = 0;
                    const h6 = H * 6 | 0;
                    if (h6 === 0) { rr=C; gg=X; } else if (h6 === 1) { rr=X; gg=C; }
                    else if (h6 === 2) { gg=C; bb=X; } else if (h6 === 3) { gg=X; bb=C; }
                    else if (h6 === 4) { rr=X; bb=C; } else { rr=C; bb=X; }
                    const glow2 = Math.min(1, (field - 1) * 0.5);
                    data[idx]   = Math.min(255, (rr + m + glow2 * 0.3) * 255) | 0;
                    data[idx+1] = Math.min(255, (gg + m + glow2 * 0.1) * 255) | 0;
                    data[idx+2] = Math.min(255, (bb + m + glow2 * 0.05) * 255) | 0;
                    data[idx+3] = 255;
                } else {
                    // Background: near-black with faint glow near blobs
                    const near = Math.min(1, field * field * 2);
                    data[idx]   = (near * 20) | 0;
                    data[idx+1] = (near * 10) | 0;
                    data[idx+2] = (near * 5) | 0;
                    data[idx+3] = 220;
                }
            }
        }

        this.octx.putImageData(this.img, 0, 0);
        ctx.save();
        if (glow > 0) {
            ctx.shadowBlur = 0;
        }
        ctx.drawImage(this.oc, 0, 0, w, h);
        ctx.restore();
    }
}

function audioLevel(s) { if (!s?.length) return 0; let v=0; for(let i=0;i<s.length;i++) v+=s[i]; return Math.min(1, v/s.length*3); }
function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.18|0); let v=0; for(let i=0;i<n;i++) v+=s[i]; return Math.min(1, v/n*3); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.18|0, b=s.length*.5|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

export const lavaLampParams = () => ({
    hue:   { base: 20,  min: 0,   max: 360, mod: { source: "" } },
    count: { base: 6,   min: 2,   max: 8,   mod: { source: "" } },
    speed: { base: 0.4, min: 0.1, max: 2,   mod: { source: "" } },
    glow:  { base: 1.5, min: 0,   max: 5,   mod: { source: "" } },
});

export function drawLavaLamp(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new LavaLamp(Math.round(p.count ?? 6)); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    viz.frame(ctx, w, h, p, t, audioLevel(s), bassLevel(s), midLevel(s), trebleLevel(s), s);
}
