// ── System Monitor ────────────────────────────────────────────────────────────
// htop / nvtop-style CPU, GPU & memory visualisation. Audio-reactive: each
// spectrum band drives an individual CPU core; bass spikes memory; treble
// pushes GPU utilisation. Two styles — bar meters (htop) and rolling history
// graphs (system profiler).

const _st = new WeakMap();
const HIST = 80; // history samples for graph mode

// Fake process table — cycling real-looking but VJ-themed names
const PROC_NAMES = [
    "jackd -R -d alsa -r 48000",
    "workshop --live --gpu",
    "ffmpeg -i input.mkv -c:v h264_nvenc",
    "python3 onset_detect.py",
    "/usr/bin/Xwayland :1 -rootless",
    "pulseaudio --start -v",
    "weston-compositor --backend=drm",
    "glslangValidator --target-env vulkan1.2",
    "node server.js --port 3000",
    "nvidia-smi dmon -s ucvmet -l 1",
    "synthesizer~.pd -batch",
    "alsa_in -j loop -d hw:0,0",
    "osc_router --in 9000 --out 9001",
    "chromium --enable-features=WebGPU",
    "/usr/bin/ruby $(which jekyll) serve",
    "ssh -L 8080:localhost:8080 studio",
    "cargo run --release --bin render",
    "blender --background --python bake.py",
    "sox input.wav output.wav rate 48000",
    "avahi-daemon --daemonize",
];

function lerp(a, b, t) { return a + (b - a) * t; }

function bar(ctx, x, y, bw, bh, fill, emptyColor, fillColor, glowColor, glow) {
    // Empty track
    ctx.fillStyle = emptyColor;
    ctx.fillRect(x, y, bw, bh);
    // Filled portion
    const fw = Math.round(bw * Math.max(0, Math.min(1, fill)));
    if (fw > 0) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, fw, bh);
        if (glow > 0.1 && glowColor) {
            ctx.save();
            ctx.shadowBlur = glow * 8;
            ctx.shadowColor = glowColor;
            ctx.fillStyle = fillColor;
            ctx.fillRect(x + fw - 2, y, 2, bh);
            ctx.restore();
        }
    }
}

export const sysMonitorParams = () => ({
    cores:    { base: 8,    min: 1,   max: 16,  step: 1,  mod: { source: "" } },
    style:    { base: 0,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // 0=bars, 1=graph
    hue:      { base: 120,  min: 0,   max: 360,           mod: { source: "" } }, // primary colour
    energy:   { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } }, // idle load floor
    pulse:    { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } }, // audio reactivity
    glow:     { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } },
    showGpu:  { base: 1,    min: 0,   max: 1,   step: 1,  mod: { source: "" } },
    showProcs:{ base: 1,    min: 0,   max: 1,   step: 1,  mod: { source: "" } },
    fontSize: { base: 11,   min: 8,   max: 16,  step: 1,  mod: { source: "" } },
});

export function drawSysMonitor(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[10]+spectrum[14]+spectrum[18])/3*3) : 0;

    const N        = Math.round(Math.max(1, Math.min(16, p.cores ?? 8)));
    const style    = Math.round(Math.max(0, Math.min(1, p.style ?? 0)));
    const hue      = p.hue ?? 120;
    const energy   = p.energy ?? 0.3;
    const pulse    = p.pulse ?? 0.6;
    const glow     = p.glow ?? 0.5;
    const showGpu  = (p.showGpu ?? 1) > 0.5;
    const showProcs= (p.showProcs ?? 1) > 0.5;
    const fs       = Math.max(8, Math.round(p.fontSize ?? 11));
    const lineH    = Math.round(fs * 1.6);

    let st = _st.get(ctx);
    if (!st || st.N !== N) {
        st = {
            N,
            cores:   Array.from({ length: N }, (_, i) => ({
                load: energy,
                history: new Float32Array(HIST),
                proc: PROC_NAMES[i % PROC_NAMES.length],
            })),
            mem:     { used: 0.45, history: new Float32Array(HIST) },
            gpu:     { util: 0.4,  temp: 62, fan: 0.45, memUsed: 0.3, history: new Float32Array(HIST) },
            histIdx: 0,
            procIdx: 0,
            lastT:   t,
            procTimer: 0,
        };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT);
    st.lastT = t;

    // ── Update core loads from spectrum ───────────────────────────────────────
    const binPerCore = spectrum ? Math.floor(64 / N) : 0;
    for (let i = 0; i < N; i++) {
        const c = st.cores[i];
        let target = energy;
        if (spectrum && binPerCore > 0) {
            let s = 0;
            const lo = i * binPerCore, hi = lo + binPerCore;
            for (let b = lo; b < hi; b++) s += spectrum[b];
            target = energy + (s / binPerCore) * pulse * 2;
        }
        // Add bass spike to all cores
        target += bass * pulse * 0.4;
        target = Math.max(0, Math.min(1, target));
        c.load = lerp(c.load, target, 0.2);
    }

    // ── Update memory (bass-reactive) ─────────────────────────────────────────
    const memTarget = 0.38 + energy * 0.3 + bass * pulse * 0.35;
    st.mem.used = lerp(st.mem.used, Math.min(1, memTarget), 0.08);

    // ── Update GPU (treble/mid-reactive) ──────────────────────────────────────
    const gpuTarget = energy * 0.5 + treble * pulse * 0.7 + mid * pulse * 0.3;
    st.gpu.util = lerp(st.gpu.util, Math.min(1, gpuTarget), 0.12);
    st.gpu.temp = 52 + Math.round(st.gpu.util * 35 + bass * 8);
    st.gpu.fan  = lerp(st.gpu.fan, 0.3 + st.gpu.util * 0.55, 0.05);
    st.gpu.memUsed = lerp(st.gpu.memUsed, 0.2 + mid * pulse * 0.6, 0.08);

    // ── Record history ─────────────────────────────────────────────────────────
    if (dt > 0.016) {
        const hi = st.histIdx % HIST;
        for (let i = 0; i < N; i++) st.cores[i].history[hi] = st.cores[i].load;
        st.mem.history[hi]     = st.mem.used;
        st.gpu.history[hi]     = st.gpu.util;
        st.histIdx++;
    }

    // ── Process list scroll ────────────────────────────────────────────────────
    st.procTimer += dt;
    if (st.procTimer > 2.5) {
        st.procTimer = 0;
        st.procIdx = (st.procIdx + Math.floor(Math.random() * 3) + 1) % PROC_NAMES.length;
    }

    // ── Draw ──────────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${fs}px "Courier New", Courier, monospace`;
    ctx.textBaseline = "top";

    const fg      = `hsl(${hue},80%,75%)`;
    const fgDim   = `hsl(${hue},50%,45%)`;
    const fgBright= `hsl(${hue},90%,88%)`;
    const bg0     = `hsl(${hue},40%,8%)`;
    const bgBar   = `hsl(${hue},25%,15%)`;
    const barFill = `hsl(${hue},80%,55%)`;
    const barGlow = `hsl(${hue},100%,70%)`;
    const red     = `hsl(0,80%,65%)`;
    const redFill = `hsl(0,80%,50%)`;

    const pw = Math.round(fs * 0.6); // approx char pixel width

    // ── Header ───────────────────────────────────────────────────────────────
    ctx.fillStyle = bg0;
    ctx.fillRect(0, 0, w, lineH + 2);
    ctx.fillStyle = fgBright;
    const now = new Date(t * 1000);
    const hhmm = `${String(Math.floor(t/3600)%24).padStart(2,"0")}:${String(Math.floor(t/60)%60).padStart(2,"0")}:${String(Math.floor(t)%60).padStart(2,"0")}`;
    ctx.fillText(`  workshop@vj-station  uptime: ${hhmm}  load: ${(st.cores.reduce((a,c)=>a+c.load,0)/N).toFixed(2)}`, 4, 2);
    ctx.fillStyle = fgDim;
    ctx.fillText("q:Quit  F2:Setup  F3:SearchPid  F4:Filter  F5:Tree  F6:SortBy  F7:<  F8:>  F9:Kill  F10:Quit", w - pw * 95, 2);

    let y = lineH + 4;

    if (style === 0) {
        // ── Style 0: htop bars ───────────────────────────────────────────────
        const labelW = pw * 7;
        const barW   = Math.round((w * 0.6 - labelW - 32) / 2);
        const col2x  = Math.round(w * 0.5) + 8;

        for (let i = 0; i < N; i++) {
            const c    = st.cores[i];
            const col  = i < N / 2 ? 0 : 1;
            const row  = col === 0 ? i : i - Math.floor(N / 2);
            const bx   = col === 0 ? labelW + 4 : col2x + labelW + 4;
            const by   = y + row * lineH;

            ctx.fillStyle = fgDim;
            ctx.fillText(`CPU${String(i).padStart(2," ")}`, col === 0 ? 4 : col2x, by);
            ctx.fillStyle = fgDim; ctx.fillText("[", bx - pw - 2, by);

            const pct = Math.round(c.load * 100);
            const barColor = pct > 80 ? redFill : barFill;
            const glowColor = pct > 80 ? `hsl(0,100%,60%)` : barGlow;
            bar(ctx, bx, by + 2, barW, lineH - 4, c.load, bgBar, barColor, glowColor, glow);

            ctx.fillStyle = fgDim; ctx.fillText("]", bx + barW + 2, by);
            ctx.fillStyle = pct > 80 ? red : fg;
            ctx.fillText(`${String(pct).padStart(3," ")}%`, bx + barW + pw + 4, by);
        }

        const halfRows = Math.ceil(N / 2);
        y += halfRows * lineH + 4;

        // Memory + Swap
        const memW = Math.round(w * 0.55 - labelW - 32);
        const memUsedMB = Math.round(st.mem.used * 32768);
        const totalMB   = 32768;
        ctx.fillStyle = fgDim;
        ctx.fillText(`Mem  [`, 4, y);
        bar(ctx, labelW + pw*2, y + 2, memW, lineH - 4, st.mem.used, bgBar, barFill, barGlow, glow);
        ctx.fillStyle = fgDim; ctx.fillText("]", labelW + pw*2 + memW + 2, y);
        ctx.fillStyle = fg;
        ctx.fillText(`${memUsedMB}M/${totalMB}M`, labelW + pw*2 + memW + pw*2, y);
        y += lineH;

        const swpUsed = 0.02 + bass * 0.05;
        ctx.fillStyle = fgDim;
        ctx.fillText(`Swp  [`, 4, y);
        bar(ctx, labelW + pw*2, y + 2, memW, lineH - 4, swpUsed, bgBar, `hsl(40,80%,55%)`, `hsl(40,100%,70%)`, glow * 0.5);
        ctx.fillStyle = fgDim; ctx.fillText("]", labelW + pw*2 + memW + 2, y);
        ctx.fillStyle = fgDim;
        ctx.fillText(`${Math.round(swpUsed*4096)}M/4096M`, labelW + pw*2 + memW + pw*2, y);
        y += lineH;

        if (showGpu) {
            y += 4;
            ctx.fillStyle = bg0; ctx.fillRect(0, y - 2, w, lineH + 2);
            ctx.fillStyle = fgBright;
            ctx.fillText(`  GPU: NVIDIA RTX 4090   ${st.gpu.temp}°C   Fan: ${Math.round(st.gpu.fan*100)}%`, 4, y);
            y += lineH + 2;

            ctx.fillStyle = fgDim;
            ctx.fillText(`GPU% [`, 4, y);
            const gpuColor = st.gpu.util > 0.85 ? redFill : `hsl(${hue+60},80%,55%)`;
            bar(ctx, labelW + pw*2, y + 2, memW, lineH-4, st.gpu.util, bgBar, gpuColor, `hsl(${hue+60},100%,65%)`, glow);
            ctx.fillStyle = fgDim; ctx.fillText("]", labelW + pw*2 + memW + 2, y);
            ctx.fillStyle = st.gpu.util > 0.85 ? red : fg;
            ctx.fillText(`${Math.round(st.gpu.util*100)}%`, labelW + pw*2 + memW + pw*2, y);
            y += lineH;

            ctx.fillStyle = fgDim;
            ctx.fillText(`VRam [`, 4, y);
            bar(ctx, labelW + pw*2, y + 2, memW, lineH-4, st.gpu.memUsed, bgBar, `hsl(${hue+120},70%,50%)`, `hsl(${hue+120},100%,65%)`, glow*0.7);
            ctx.fillStyle = fgDim; ctx.fillText("]", labelW + pw*2 + memW + 2, y);
            ctx.fillStyle = fg;
            ctx.fillText(`${Math.round(st.gpu.memUsed*24)}G/24G`, labelW + pw*2 + memW + pw*2, y);
            y += lineH;
        }

    } else {
        // ── Style 1: rolling history graphs ─────────────────────────────────
        const graphH = Math.max(20, Math.round((h * 0.55) / N));
        const graphW = Math.round(w * 0.58);
        const labelW = pw * 7;

        for (let i = 0; i < N; i++) {
            const c    = st.cores[i];
            const gy   = y + i * graphH;
            const hi   = st.histIdx;

            ctx.fillStyle = fgDim;
            ctx.fillText(`C${i}`, 4, gy + 2);

            // Graph background
            ctx.fillStyle = bgBar;
            ctx.fillRect(labelW, gy, graphW, graphH - 2);

            // Draw history line
            ctx.beginPath();
            const pct = Math.round(c.load * 100);
            ctx.strokeStyle = pct > 80 ? red : barFill;
            ctx.lineWidth = 1.5;
            if (glow > 0.1) { ctx.shadowBlur = glow * 6; ctx.shadowColor = barGlow; }
            for (let s = 0; s < HIST; s++) {
                const idx = (hi - HIST + s + HIST * 2) % HIST;
                const gx  = labelW + Math.round((s / HIST) * graphW);
                const gh  = Math.round(c.history[idx] * (graphH - 4));
                if (s === 0) ctx.moveTo(gx, gy + graphH - 2 - gh);
                else         ctx.lineTo(gx, gy + graphH - 2 - gh);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Live value label
            ctx.fillStyle = fg;
            ctx.fillText(`${String(pct).padStart(3," ")}%`, labelW + graphW + 4, gy + 2);
        }

        y += N * graphH + 6;

        // Compact mem + GPU row
        const rowW = Math.round((w - 16) / 3);
        const labels = ["MEM", "GPU", "VRAM"];
        const fills  = [st.mem.used, st.gpu.util, st.gpu.memUsed];
        const hues   = [hue, hue+60, hue+120];
        const units  = [`${Math.round(st.mem.used*32768)}M`, `${Math.round(st.gpu.util*100)}%`, `${Math.round(st.gpu.memUsed*24)}G`];
        for (let c = 0; c < 3; c++) {
            const rx = 8 + c * (rowW + 4);
            ctx.fillStyle = `hsl(${hues[c]},80%,60%)`;
            ctx.fillText(labels[c], rx, y);
            bar(ctx, rx, y + lineH, rowW, lineH - 2, fills[c], bgBar, `hsl(${hues[c]},75%,50%)`, `hsl(${hues[c]},100%,65%)`, glow * 0.7);
            ctx.fillStyle = fg;
            ctx.fillText(units[c], rx, y + lineH * 2 + 2);
        }
        y += lineH * 3 + 6;
    }

    // ── Process table ─────────────────────────────────────────────────────────
    if (showProcs && y < h - lineH * 3) {
        y += 4;
        ctx.fillStyle = bg0; ctx.fillRect(0, y - 2, w, lineH + 2);
        ctx.fillStyle = fgBright;
        ctx.fillText("  PID  USER      PRI   NI    VIRT   RES S  CPU%  MEM%  TIME+    COMMAND", 4, y);
        y += lineH + 2;

        const maxRows = Math.floor((h - y - 4) / lineH);
        for (let r = 0; r < Math.min(maxRows, PROC_NAMES.length); r++) {
            const pi   = (st.procIdx + r) % PROC_NAMES.length;
            const name = PROC_NAMES[pi];
            const ci   = r % N;
            const cpuPct = (st.cores[ci].load * 100).toFixed(1);
            const memPct = (0.5 + r * 0.3 + bass * 2).toFixed(1);
            const pid  = String(1000 + pi * 37 + 117).padStart(5, " ");
            const user = (r < 2 ? "root   " : "vj     ");
            const pri  = (r < 2 ? "  0" : " 20");
            const nice = (r < 2 ? "  0" : "  0");
            const virt = `${String(Math.round(120 + pi * 33)).padStart(6," ")}m`;
            const res  = `${String(Math.round(40 + pi * 11)).padStart(5," ")}m`;
            const state= r === 0 ? "R" : "S";
            ctx.fillStyle = parseFloat(cpuPct) > 50 ? red : r === 0 ? fgBright : fg;
            ctx.fillText(
                `${pid}  ${user}${pri}  ${nice}  ${virt}  ${res} ${state}  ${String(cpuPct).padStart(5," ")}  ${String(memPct).padStart(5," ")}  00:${String(Math.floor(t/60)%60).padStart(2,"0")}.${String(Math.floor(t)%60).padStart(2,"0")}  ${name}`,
                4, y
            );
            y += lineH;
            if (y > h - 2) break;
        }
    }
}
