// ── Eval Seismograph ─────────────────────────────────────────────────────────
// Ported from web/src/layers/evalSeismograph.js. Two-channel seismograph on
// cream paper: CH-A (svdk, navy) and CH-B (zbdm, dark red) each spike on their
// user's eval events (extra.live). Bass swells the trace; live cpu (or the
// noiseFloor knob when cpu is absent) sets the background noise level.

const _st = new WeakMap();

export const evalSeismographParams = () => ({
    amp:        { base: 1,   min: 0.2, max: 3,           label: "trace amplitude", mod: { source: "" } },
    noiseFloor: { base: 0.3, min: 0,   max: 1,           label: "noise floor (cpu sim)", mod: { source: "" } },
    bassReact:  { base: 1,   min: 0,   max: 3,           label: "bass reactivity", mod: { source: "" } },
});

function _init(w, h) {
    return {
        W: w, H: h, U: Math.min(w, h),
        bufA: new Float32Array(w), bufB: new Float32Array(w),
        head: 0, lastT: null,
        lastEval: -1, lastBeat: -1,
        spikeA: 0, spikeTA: 0, spikeB: 0, spikeTB: 0,
        eventsA: [], eventsB: [],
    };
}

export function drawEvalSeismograph(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s || s.W !== w || s.H !== h) { s = _init(w, h); _st.set(ctx, s); }

    const lv = extra?.live || {};
    const spectrum = extra?.spectrum;
    const bass = spectrum ? Math.min(1, (spectrum[1] + spectrum[2] + spectrum[3]) / 3 * 3) : 0;
    const audio = bass * (params.bassReact ?? 1);

    const dt = s.lastT == null ? 1 / 60 : Math.max(0, Math.min(0.1, t - s.lastT));
    s.lastT = t;

    const U = s.U, ampK = params.amp ?? 1;
    const bpm = lv.bpm || 120;
    const cpu = lv.cpu != null ? lv.cpu / 100 : (params.noiseFloor ?? 0.3);
    const ec = lv.evalCount ?? 0;
    const beat = Math.floor(lv.beat ?? (t * bpm / 60));

    const winFor = (u) => (u === "svdk" ? lv.svdk : lv.zbdm) || {};

    if (ec !== s.lastEval) {
        s.lastEval = ec;
        const user = lv.lastEvalUser || "svdk";
        const win = winFor(user);
        const rawLines = (win.lines ? (Array.isArray(win.lines) ? win.lines.join("\n") : win.lines) : "").split("\n");
        const codeLine = rawLines.find((l) => l.trim()) || "";
        const snippet = codeLine.trim().slice(0, 36);
        if (user === "svdk") {
            s.spikeA = 1; s.spikeTA = 0;
            s.eventsA.push({ x: s.head, amp: 1, age: 0, code: snippet });
            if (s.eventsA.length > 8) s.eventsA.shift();
        } else {
            s.spikeB = 1; s.spikeTB = 0;
            s.eventsB.push({ x: s.head, amp: 1, age: 0, code: snippet });
            if (s.eventsB.length > 8) s.eventsB.shift();
        }
    }
    s.spikeTA += dt; s.spikeTB += dt;

    let beatPulse = 0;
    if (beat !== s.lastBeat) { s.lastBeat = beat; beatPulse = 0.09; }

    const noise = (Math.random() - 0.5) * (0.02 + cpu * 0.18);
    const sA = s.spikeA * Math.sin(s.spikeTA * 28) * Math.exp(-s.spikeTA * 3);
    const sB = s.spikeB * Math.sin(s.spikeTB * 28) * Math.exp(-s.spikeTB * 3);
    s.bufA[s.head] = noise + sA + beatPulse + audio * 0.08;
    s.bufB[s.head] = noise + sB + beatPulse + audio * 0.08;
    s.head = (s.head + 1) % w;
    s.spikeA = Math.max(0, s.spikeA - dt * 0.5);
    s.spikeB = Math.max(0, s.spikeB - dt * 0.5);
    for (const ev of s.eventsA) ev.age += dt;
    for (const ev of s.eventsB) ev.age += dt;

    // cream paper
    ctx.fillStyle = "#f3eedd"; ctx.fillRect(0, 0, w, h);

    // header band
    const hH = h * 0.11;
    ctx.fillStyle = "#ede5ce"; ctx.fillRect(0, 0, w, hH);
    ctx.strokeStyle = "#ccc4aa"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, hH); ctx.lineTo(w, hH); ctx.stroke();

    ctx.fillStyle = "#1a1230"; ctx.font = `bold ${U * 0.022 | 0}px 'Courier New',monospace`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("SEISMIC STATION  CRIC-01", U * 0.02, hH * 0.42);
    ctx.font = `${U * 0.014 | 0}px 'Courier New',monospace`; ctx.fillStyle = "#554433";
    ctx.fillText(`BPM ${bpm | 0}   CPU ${(cpu * 100) | 0}%   EVALS ${ec}`, U * 0.02, hH * 0.78);

    const drawChannel = (buf, midY, colTrace, colLabel, label, spikeAmp, events) => {
        const lH = (h - hH) * 0.42;
        const amp = lH * 0.36 * ampK;
        const top = midY - lH / 2, bot = midY + lH / 2;

        ctx.strokeStyle = "#d8d0b4"; ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) { const gy = top + lH * i / 4; ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
        ctx.stroke();
        ctx.strokeStyle = "#e0d8c2";
        ctx.beginPath();
        for (let i = 1; i < 10; i++) { ctx.moveTo(w * i / 10, top); ctx.lineTo(w * i / 10, bot); }
        ctx.stroke();

        ctx.strokeStyle = `${colTrace}55`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

        ctx.strokeStyle = colTrace; ctx.lineWidth = Math.max(1, U * 0.002);
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
            const y = midY - buf[(s.head + i) % w] * amp;
            if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(160,25,25,0.45)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.head, top); ctx.lineTo(s.head, bot); ctx.stroke();

        const annotFontSz = Math.max(9, U * 0.013) | 0;
        for (const ev of events) {
            const fa = Math.max(0, 1 - ev.age * 0.4);
            if (fa < 0.05) continue;
            const ex = (ev.x - s.head + w) % w;
            const hexA = Math.floor(fa * 255).toString(16).padStart(2, "0");
            ctx.fillStyle = `${colLabel}${hexA}`;
            ctx.beginPath(); ctx.moveTo(ex, top - U * 0.006); ctx.lineTo(ex - 4, top + U * 0.002); ctx.lineTo(ex + 4, top + U * 0.002); ctx.closePath(); ctx.fill();
            if (ev.code) {
                ctx.save();
                ctx.translate(ex + annotFontSz * 0.6, top + U * 0.004);
                ctx.rotate(-Math.PI / 2);
                ctx.font = `${annotFontSz}px 'Courier New',monospace`;
                ctx.textAlign = "left"; ctx.textBaseline = "middle";
                ctx.fillStyle = `${colLabel}${hexA}`;
                ctx.fillText(ev.code, 0, 0);
                ctx.restore();
            }
        }

        ctx.font = `bold ${U * 0.017 | 0}px 'Courier New',monospace`;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillStyle = colLabel; ctx.fillText(label, U * 0.015, top + U * 0.006);

        if (spikeAmp > 0.06) {
            const sa = Math.min(1, spikeAmp * 2.2);
            ctx.textAlign = "right";
            ctx.fillStyle = `rgba(170,20,20,${sa})`;
            ctx.font = `bold ${U * 0.022 | 0}px 'Courier New',monospace`;
            ctx.fillText(`▲ M${(spikeAmp * 8.8).toFixed(1)}`, w - U * 0.015, top + U * 0.006);
        }
    };

    const midA = hH + (h - hH) * 0.27;
    const midB = hH + (h - hH) * 0.73;

    ctx.strokeStyle = "#ccc4aa"; ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, (midA + midB) / 2); ctx.lineTo(w, (midA + midB) / 2); ctx.stroke();
    ctx.setLineDash([]);

    drawChannel(s.bufA, midA, "#18104a", "#1a1260", "CH-A  SVDK", s.spikeA, s.eventsA);
    drawChannel(s.bufB, midB, "#4a100a", "#601a1a", "CH-B  ZBDM", s.spikeB, s.eventsB);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
