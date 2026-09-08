// ── Circuit Board ─────────────────────────────────────────────────────────────
// PCB-style trace pattern with vias, pads, and IC chips.  Pulse signals travel
// along traces synced to audio.  Bass triggers random trace bursts.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function lcg(s) { return (s * 1664525 + 1013904223) & 0x7fffffff; }

export const circuitBoardParams = () => ({
    density:  { base: 0.5,  min: 0.1, max: 1,            mod: { source: "" } },
    hue:      { base: 120,  min: 0,   max: 360,          mod: { source: "" } }, // trace hue
    hue2:     { base: 60,   min: 0,   max: 360,          mod: { source: "" } }, // signal pulse hue
    glow:     { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    speed:    { base: 0.5,  min: 0,   max: 4,            mod: { source: "" } }, // signal travel speed
    pulse:    { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.9,  min: 0,   max: 1,            mod: { source: "" } },
    grid:     { base: 30,   min: 10,  max: 60,  step: 5, mod: { source: "" } }, // cell size px
    showChips:{ base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } },
    traceW:   { base: 2,    min: 0.5, max: 5,            mod: { source: "" } },
});

export function drawCircuitBoard(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const density  = p.density ?? 0.5;
    const hue      = p.hue ?? 120;
    const hue2     = p.hue2 ?? 60;
    const glow     = p.glow ?? 0.7;
    const speed    = p.speed ?? 0.5;
    const pulse    = p.pulse ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.9;
    const cellSize = Math.round(Math.max(10, Math.min(60, p.grid ?? 30)));
    const showChips= (p.showChips ?? 1) > 0.5;
    const traceW   = (p.traceW ?? 2) * (1 + bass * pulse * 0.3);

    const cols = Math.ceil(w / cellSize) + 1;
    const rows = Math.ceil(h / cellSize) + 1;

    let st = _st.get(ctx);
    if (!st || st.cols !== cols || st.rows !== rows) {
        // Generate random trace network
        let seed = 1337;
        const rand = () => { seed = lcg(seed); return seed / 0x7fffffff; };

        const traces = [];
        const vias   = [];
        const chips  = [];

        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols - 1; c++) {
                if (rand() < density) {
                    // Horizontal trace
                    const x1 = c * cellSize, y1 = r * cellSize;
                    if (rand() < 0.6) traces.push({ x1, y1, x2: x1 + cellSize, y2: y1 });
                    if (rand() < 0.6) traces.push({ x1, y1, x2: x1, y2: y1 + cellSize });
                    if (rand() < 0.15) vias.push({ x: x1, y: y1 });
                }
            }
        }
        // Chips (rectangular blocks)
        if (showChips) {
            for (let i = 0; i < Math.round(density * 8); i++) {
                chips.push({
                    x: Math.round(rand() * (cols - 3)) * cellSize,
                    y: Math.round(rand() * (rows - 3)) * cellSize,
                    cw: (2 + Math.round(rand() * 3)) * cellSize,
                    ch: (1 + Math.round(rand() * 2)) * cellSize,
                    hOff: rand() * 60 - 30,
                });
            }
        }

        // Signals: animated pulses along traces
        const signals = traces
            .filter(() => rand() < 0.15)
            .map(tr => ({ tr, pos: rand(), speed: 0.3 + rand() * 0.7 }));

        st = { cols, rows, traces, vias, chips, signals, seed, lastT: t };
        _st.set(ctx, st);
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 8;
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
    }

    // PCB green base tint
    ctx.fillStyle = `rgba(0,30,10,0.12)`;
    ctx.fillRect(0, 0, w, h);

    // Traces
    ctx.lineCap = "round";
    ctx.strokeStyle = `hsla(${hue},70%,${30 + treble * 15}%,0.8)`;
    ctx.lineWidth = traceW;
    for (const tr of st.traces) {
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();
    }

    // Vias
    ctx.shadowBlur = glow * 6;
    for (const via of st.vias) {
        ctx.fillStyle = `hsl(${hue},60%,45%)`;
        ctx.strokeStyle = `hsl(${hue},90%,70%)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(via.x, via.y, traceW * 2, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(via.x, via.y, traceW * 0.7, 0, TAU); ctx.fill();
    }

    // Chips
    if (showChips) {
        ctx.shadowBlur = glow * 10;
        for (const ch of st.chips) {
            const chHue = (hue + ch.hOff) % 360;
            ctx.fillStyle = `hsl(${chHue},40%,12%)`;
            ctx.strokeStyle = `hsl(${chHue},70%,40%)`;
            ctx.lineWidth = 1.5;
            ctx.fillRect(ch.x + 2, ch.y + 2, ch.cw - 4, ch.ch - 4);
            ctx.strokeRect(ch.x + 2, ch.y + 2, ch.cw - 4, ch.ch - 4);
        }
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    // Animated signal pulses
    ctx.shadowBlur = glow * 20 * (1 + bass * pulse);
    ctx.shadowColor = `hsl(${hue2},100%,80%)`;
    for (const sig of st.signals) {
        sig.pos = (sig.pos + sig.speed * speed * dt * (1 + bass * 0.5)) % 1;
        const tr = sig.tr;
        const px = tr.x1 + (tr.x2 - tr.x1) * sig.pos;
        const py = tr.y1 + (tr.y2 - tr.y1) * sig.pos;
        ctx.fillStyle = `hsl(${hue2},100%,80%)`;
        ctx.beginPath(); ctx.arc(px, py, traceW * 1.5 + bass * 2, 0, TAU); ctx.fill();
    }

    // Bass: flash a few random traces bright
    if (bass > 0.5) {
        const nFlash = Math.ceil(bass * 5);
        ctx.strokeStyle = `hsla(${hue2},100%,80%,${bass * 0.6})`;
        ctx.lineWidth = traceW * 2;
        for (let i = 0; i < nFlash && i < st.traces.length; i++) {
            const ti = Math.floor(Math.random() * st.traces.length);
            const tr = st.traces[ti];
            ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
        }
    }

    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
}
