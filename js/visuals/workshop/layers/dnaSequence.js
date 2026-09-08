// ── DNA Sequence ──────────────────────────────────────────────────────────────
// Scrolling double-helix with labelled base pairs (A-T, G-C) and a sidebar
// hex / amino-acid readout.  Audio: bass twists the helix faster; treble
// brightens.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const BASES = ['A','T','G','C'];
const BASE_COLORS = { A: '#00ff88', T: '#ff4466', G: '#ffaa00', C: '#44aaff' };
const BASE_PAIRS  = { A: 'T', T: 'A', G: 'C', C: 'G' };
const AMINO_CODES = ["Met","Phe","Leu","Ser","Tyr","Cys","Trp","Pro","His","Gln","Arg","Ile","Thr","Asn","Lys","Val","Ala","Asp","Glu","Gly","---"];

export const dnaSequenceParams = () => ({
    scrollSpeed:{ base: 60,  min: 10, max: 300,           mod: { source: "" } }, // bp/sec
    helixTwist: { base: 2,   min: 0.5,max: 8,             mod: { source: "" } }, // twists per screen
    radius:     { base: 0.2, min: 0.05,max:0.4,           mod: { source: "" } },
    posX:       { base: 0.5, min: 0.1, max:0.9,           mod: { source: "" } }, // helix centre X
    fontSize:   { base: 11,  min: 6,  max: 18,  step: 1,  mod: { source: "" } },
    showLabels: { base: 1,   min: 0,  max: 1,   step: 1,  mod: { source: "" } },
    showSidebar:{ base: 1,   min: 0,  max: 1,   step: 1,  mod: { source: "" } },
    glow:       { base: 0.5, min: 0,  max: 1,             mod: { source: "" } },
    pulse:      { base: 0.4, min: 0,  max: 1,             mod: { source: "" } },
    bgAlpha:    { base: 0.85,min: 0,  max: 1,             mod: { source: "" } },
});

function makeSeq(n, seed) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        arr.push(BASES[seed % 4]);
    }
    return arr;
}

export function drawDnaSequence(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const scrollSpeed = (p.scrollSpeed ?? 60) * (1 + bass * (p.pulse ?? 0.4) * 0.5);
    const twist    = p.helixTwist ?? 2;
    const radius   = (p.radius ?? 0.2) * h;
    const posX     = (p.posX ?? 0.5) * w;
    const fsize    = Math.round(Math.max(6, Math.min(18, p.fontSize ?? 11)));
    const showLbl  = (p.showLabels ?? 1) > 0.5;
    const showSide = (p.showSidebar ?? 1) > 0.5;
    const glow     = p.glow ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.85;

    const spacing  = fsize * 1.6; // pixels per base pair

    let st = _st.get(ctx);
    if (!st) {
        const seqLen = 500;
        st = { seq: makeSeq(seqLen, 42), scroll: 0, lastT: t };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.scroll += scrollSpeed * dt;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 8 * (1 + treble * 0.4);
    }

    ctx.font = `${fsize}px "Courier New", monospace`;
    ctx.textBaseline = "middle";

    const nVisible = Math.ceil(h / spacing) + 2;
    const startBp  = Math.floor(st.scroll / spacing);
    const offsetY  = -(st.scroll % spacing);
    const seqLen   = st.seq.length;
    const twistPhase = (st.scroll / h) * twist * TAU;

    for (let i = 0; i < nVisible; i++) {
        const bpIdx = (startBp + i) % seqLen;
        const base  = st.seq[bpIdx];
        const pair  = BASE_PAIRS[base];
        const y     = offsetY + i * spacing;

        const angle = (i / nVisible) * twist * TAU - twistPhase;
        const x1 = posX + Math.cos(angle) * radius;
        const x2 = posX - Math.cos(angle) * radius;
        const dz  = Math.sin(angle); // -1..1 depth hint

        const c1 = BASE_COLORS[base];
        const c2 = BASE_COLORS[pair];

        // Backbone dots
        ctx.shadowColor = c1;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(x1, y, fsize * 0.4 * (0.7 + dz * 0.3), 0, TAU);
        ctx.fill();

        ctx.shadowColor = c2;
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(x2, y, fsize * 0.4 * (0.7 - dz * 0.3), 0, TAU);
        ctx.fill();

        // Rung (base pair bond)
        const alpha = 0.5 + treble * 0.4;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(180,180,180,${alpha * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Base labels
        if (showLbl && fsize >= 9) {
            ctx.shadowBlur = glow * 6;
            ctx.fillStyle = c1;
            ctx.shadowColor = c1;
            ctx.textAlign = Math.cos(angle) > 0 ? "left" : "right";
            ctx.fillText(base, x1 + (Math.cos(angle) > 0 ? fsize * 0.7 : -fsize * 0.7), y);
            ctx.fillStyle = c2;
            ctx.shadowColor = c2;
            ctx.textAlign = Math.cos(angle) > 0 ? "right" : "left";
            ctx.fillText(pair, x2 + (Math.cos(angle) > 0 ? -fsize * 0.7 : fsize * 0.7), y);
        }

        // Sidebar: amino acid every 3 bp
        if (showSide && bpIdx % 3 === 0) {
            const codonIdx = Math.floor(bpIdx / 3) % AMINO_CODES.length;
            const amino = AMINO_CODES[codonIdx];
            ctx.shadowBlur = glow * 4;
            ctx.fillStyle = `hsla(${(codonIdx * 17) % 360},70%,70%,0.8)`;
            ctx.shadowColor = ctx.fillStyle;
            ctx.textAlign = "left";
            ctx.font = `${fsize - 2}px "Courier New", monospace`;
            ctx.fillText(amino, w * 0.04, y);
            ctx.font = `${fsize}px "Courier New", monospace`;
        }
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
}
