// ── DNA Helix ─────────────────────────────────────────────────────────────────
// Rotating double helix: two phosphate backbones as counter-phase sine strands,
// coloured base-pair rungs (A-T / G-C), depth shading for 3D feel.
// Bass widens radius; mid shifts base-pair colors; treble accelerates twist rate.
// Multiple helices tile vertically or stack in perspective (layers param).

const _state = new WeakMap();

const BASE_COLORS = [
    [["#ff3a5e","#3aff9e"],["#3a7aff","#ffcc3a"]], // classic: A-T red/green, G-C blue/gold
    [["#ff6aff","#6affff"],["#ffaa6a","#6aaaff"]], // neon: magenta/cyan, orange/blue
    [["#ffffff","#aaaaaa"],["#888888","#dddddd"]], // mono
    [["#ff2200","#ffaa00"],["#ff6600","#ffdd00"]], // fire
];

class DNAViz {
    constructor() {
        this.seq = Array.from({ length: 200 }, () => (Math.random() * 2) | 0);
        this.mutTimer = 0;
    }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const speed      = p.speed * (1 + treble * 1.5);
        const twist      = p.twist * (1 + treble * 0.4);
        const thickness  = p.thickness;
        const segments   = Math.round(Math.max(20, Math.min(120, p.segments)));
        const layers     = Math.round(Math.max(1, Math.min(4, p.layers)));
        const colorSet   = Math.max(0, Math.min(3, Math.round(p.colorSet)));
        const perspective = p.perspective;
        // Bass widens the helix radius dramatically
        const radius     = p.radius * Math.min(w, h) * 0.14 * (1 + bass * 0.7);
        const separation = p.separation;
        const glowStr    = p.glow;
        const tVal       = t * speed;

        ctx.fillStyle = "#03050f";
        ctx.fillRect(0, 0, w, h);

        const PAIRS = BASE_COLORS[colorSet];
        // Mid shifts color set hue by interpolation
        const midHueShift = mid * 60;

        // Mutation — mid triggers random base-pair flips
        this.mutTimer += mid * 0.15;
        while (this.mutTimer > 1) {
            this.seq[Math.floor(Math.random() * this.seq.length)] = Math.random() > 0.5 ? 1 : 0;
            this.mutTimer -= 1;
        }

        for (let L = 0; L < layers; L++) {
            const lFrac    = layers > 1 ? L / (layers - 1) : 0.5;
            const colOffset = L * separation;
            const cx = (w / (layers + 1)) * (L + 1);
            const span = h * 1.15;
            const y0   = (h - span) / 2;
            const phaseOff = L * Math.PI * 0.5;

            // Build items list
            const items = [];
            for (let i = 0; i < segments; i++) {
                const f    = i / (segments - 1);
                const y    = y0 + f * span;
                // Perspective scale — closer items at bottom appear larger
                const pscale = perspective > 0 ? 1 + perspective * (1 - f) * 0.8 : 1;
                const pr   = radius * pscale;
                const ph   = f * Math.PI * 2 * twist * 3 + tVal * 2 + phaseOff;
                const x1   = cx + Math.cos(ph) * pr;
                const z1   = Math.sin(ph);
                const x2   = cx + Math.cos(ph + Math.PI) * pr;
                const z2   = Math.sin(ph + Math.PI);
                items.push({ y, x1, z1, x2, z2, f, pscale, base: this.seq[i % this.seq.length] });
            }

            // Sort rungs back to front
            const rungs = items.slice().sort((a, b) => (a.z1 + a.z2) - (b.z1 + b.z2));
            for (const it of rungs) {
                const zc   = (it.z1 + it.z2) / 2;
                const depthA = 0.3 + 0.6 * (zc * 0.5 + 0.5);
                const [ca, cb] = PAIRS[it.base];

                // Two-segment rung: ca for first half, cb for second half
                // Avoids createLinearGradient per rung (was up to 480/frame)
                const midX = (it.x1 + it.x2) / 2;
                const lw   = thickness * 2 * it.pscale * (0.5 + (zc * 0.5 + 0.5) * 0.5);
                ctx.globalAlpha = depthA;
                ctx.lineWidth   = lw;
                ctx.strokeStyle = ca;
                ctx.beginPath(); ctx.moveTo(it.x1, it.y); ctx.lineTo(midX, it.y); ctx.stroke();
                ctx.strokeStyle = cb;
                ctx.beginPath(); ctx.moveTo(midX, it.y); ctx.lineTo(it.x2, it.y); ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // Backbone nodes sorted back to front
            const nodes = [];
            for (const it of items) {
                nodes.push({ x: it.x1, y: it.y, z: it.z1, c: "#3fd8ff", pscale: it.pscale });
                nodes.push({ x: it.x2, y: it.y, z: it.z2, c: "#ff6edd", pscale: it.pscale });
            }
            nodes.sort((a, b) => a.z - b.z);

            for (const n of nodes) {
                const d  = n.z * 0.5 + 0.5;
                const r  = Math.min(w, h) * (0.005 + 0.005 * d) * thickness * n.pscale * (1 + bass * 0.5);
                const gAlpha = 0.35 + 0.65 * d;

                ctx.fillStyle   = n.c;
                ctx.globalAlpha = gAlpha;
                if (glowStr > 0) {
                    ctx.shadowBlur = 0;
                }
                ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.5, r), 0, 6.2832); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        // Bass bloom — radial glow pulse on kick
        if (bass > 0.4) {
            ctx.globalCompositeOperation = "lighter";
            const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w,h)*0.5);
            grad.addColorStop(0, `rgba(60,200,255,${bass * 0.12})`);
            grad.addColorStop(1, "rgba(60,200,255,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }
    }
}

export const dnaHelixParams = () => ({
    speed:      { base: 1,   min: 0.1,  max: 5,   mod: { source: "" } },
    twist:      { base: 1,   min: 0.3,  max: 4,   mod: { source: "" } },
    radius:     { base: 1,   min: 0.2,  max: 3,   mod: { source: "" } },
    thickness:  { base: 1,   min: 0.3,  max: 3,   mod: { source: "" } },
    segments:   { base: 60,  min: 20,   max: 120, mod: { source: "" } },
    layers:     { base: 1,   min: 1,    max: 4,   mod: { source: "" } },
    separation: { base: 0.2, min: 0,    max: 1,   mod: { source: "" } },
    perspective:{ base: 0.3, min: 0,    max: 1.5, mod: { source: "" } },
    colorSet:   { base: 0,   min: 0,    max: 3,   mod: { source: "" } },
    glow:       { base: 1.2, min: 0,    max: 4,   mod: { source: "" } },
    brightness: { base: 1,   min: 0.3,  max: 2,   mod: { source: "" } },
});

export function drawDNAHelix(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new DNAViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
