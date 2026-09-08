// ── Quantum ASCII ─────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION QuantumASCIIScene.
// ASCII grid showing quantum states: superposition, wavefunction, particles,
// entanglement, probability clouds. Bass = measurement collapse. Mid = wave.

const _st = new WeakMap();

const SUPER  = ['|0⟩','|1⟩','|ψ⟩','α|0⟩','β|1⟩','⊗','⊕','±','∓'];
const WAVE   = ['∿','∼','≈','≋','〰','⌇','⌒','⌓','∫','∂'];
const PART   = ['·','•','○','◉','◦','⊙','⊚','⊛','✦','✧'];
const FIELD  = ['░','▒','▓','▪','▫','▬','▭','▮','▯'];
const SPIN   = ['↑','↓','⇑','⇓','↕','⇕','↺','↻','⥮','⥯'];
const ENTGL  = ['⟨ψ|','|ψ⟩','⟨φ|φ⟩','Bell','EPR','⊗|00⟩','⊗|11⟩'];
const PROB   = ['P(0)','P(1)','|α|²','|β|²','⟨x⟩','⟨p⟩','ΔxΔp'];

const SETS = [SUPER, WAVE, PART, FIELD, SPIN, ENTGL, PROB];

const COLS = ['#00ffff','#88ffcc','#ff00ff','#ffff00','#ffffff','#00ff88','#ff4488'];

const GCW=58, GCH=32;

export const quantumAsciiParams = () => ({
    mode:      { base: 0,   min: 0,   max: 6,   step: 1, mod: { source: "" } }, // which char set
    waveSpeed: { base: 0.4, min: 0,   max: 2,            mod: { source: "" } },
    collapse:  { base: 0.5, min: 0,   max: 1,            mod: { source: "" } }, // collapse intensity on bass
    entangle:  { base: 0.3, min: 0,   max: 1,            mod: { source: "" } }, // entangled pair density
    chromaRot: { base: 0.2, min: 0,   max: 1,            mod: { source: "" } },
    fontSize:  { base: 12,  min: 8,   max: 20,           mod: { source: "" } },
    bgAlpha:   { base: 0.85,min: 0,   max: 1,            mod: { source: "" } },
});

export function drawQuantumAscii(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const mode      = Math.round(p.mode ?? 0);
    const waveSpeed = p.waveSpeed ?? 0.4;
    const collapse  = p.collapse ?? 0.5;
    const entangle  = p.entangle ?? 0.3;
    const fontSize  = Math.round(p.fontSize ?? 12);
    const bgAlpha   = p.bgAlpha ?? 0.85;

    const cset  = SETS[Math.min(mode, SETS.length-1)];
    const color = COLS[Math.min(mode, COLS.length-1)];

    let st = _st.get(ctx);
    if (!st) {
        st = {
            cells: Array.from({ length: GCW*GCH }, (_,i) => ({
                charIdx: i % cset.length,
                phase:   Math.random() * Math.PI * 2,
                entWith: Math.random() < 0.12 ? Math.floor(Math.random() * GCW*GCH) : -1,
                collapsed: false,
                collapseTimer: 0,
            })),
            prevBass: 0,
            lastT: t,
        };
        _st.set(ctx, st);
    }

    // Bass → collapse event
    if (bass > 0.5 && bass > st.prevBass + 0.08) {
        const n = Math.floor(collapse * 40);
        for (let k = 0; k < n; k++) {
            const ci = Math.floor(Math.random() * st.cells.length);
            st.cells[ci].collapsed = true;
            st.cells[ci].collapseTimer = 0.6 + Math.random() * 0.8;
        }
    }
    st.prevBass = bass;

    ctx.fillStyle = `rgba(0,4,12,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const cw = w / GCW, ch = h / GCH;
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    const wfreq = waveSpeed * 2;

    for (let ci = 0; ci < st.cells.length; ci++) {
        const cx = ci % GCW, cy = Math.floor(ci / GCW);
        const cell = st.cells[ci];
        cell.phase += 0.02 * waveSpeed;

        // Collapse decay
        if (cell.collapseTimer > 0) {
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
            cell.collapseTimer -= dt;
            if (cell.collapseTimer <= 0) cell.collapsed = false;
        }

        // Wave packet: amplitude modulates char selection
        const wave = Math.sin(cx * 0.3 + t * wfreq + cell.phase) *
                     Math.cos(cy * 0.4 - t * wfreq * 0.7 + cell.phase * 0.5);
        const amp  = 0.5 + 0.5 * wave + mid * 0.3;
        const charIdx = cell.collapsed
            ? (Math.random() < 0.5 ? 0 : 1)
            : Math.floor(Math.abs(amp * cset.length + treble * 2)) % cset.length;
        const ch2 = cset[charIdx];

        // Color: entangled pair shares hue
        let hue = (mode * 50 + cx * 2.5 + t * 20 * (p.chromaRot ?? 0.2)) % 360;
        if (cell.entWith >= 0 && cell.entWith < st.cells.length && entangle > 0.1) {
            const ent = st.cells[cell.entWith];
            hue = (hue + Math.sin(ent.phase) * 60) % 360;
        }
        const alpha = cell.collapsed ? (0.4 + Math.random() * 0.6) : (0.3 + amp * 0.7 + bass * 0.2);
        ctx.fillStyle = `hsla(${hue},90%,70%,${Math.min(1, alpha)})`;

        // Probability cloud: draw bright ring for entangled pairs
        if (cell.entWith >= 0 && entangle > 0.2 && Math.random() < 0.005) {
            const ox = cell.entWith % GCW, oy = Math.floor(cell.entWith / GCW);
            ctx.strokeStyle = `rgba(255,0,255,0.15)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo((cx+0.5)*cw, (cy+0.5)*ch);
            ctx.lineTo((ox+0.5)*cw, (oy+0.5)*ch);
            ctx.stroke();
        }

        ctx.fillText(ch2, cx * cw, cy * ch);
    }

    // Bass flash overlay
    if (bass > 0.6) {
        ctx.fillStyle = `rgba(0,255,255,${(bass-0.6)*0.2*collapse})`;
        ctx.fillRect(0, 0, w, h);
    }

    // Wavefunction header
    ctx.font = '8px monospace';
    ctx.fillStyle = `rgba(0,255,200,0.5)`;
    const SET_NAMES = ['SUPERPOSITION','WAVEFUNCTION','PARTICLES','FIELD','SPIN','ENTANGLEMENT','PROBABILITY'];
    ctx.fillText(`Ψ = ${SET_NAMES[mode]}  |ψ⟩`, 8, 4);
}
