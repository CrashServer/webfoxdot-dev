// ── Terminal Prompt ───────────────────────────────────────────────────────────
// Hacker-style terminal with scrolling shell commands and output lines.
// Bass hits cause screen glitch tears and cursor flash.
// Treble brightens the phosphor glow.

const _st = new WeakMap();

const PROMPTS = ["root@vj:~#", "user@STARS:/$", ">>> ", "$ ", "λ "];
const CMDS = [
    "ffplay -f rawvideo -pix_fmt yuv420p -s 1920x1080 /dev/video0",
    "arecord -D hw:1,0 -f cd | sox - -p | play -",
    "grep -r 'PANIC\\|ERROR\\|WARN' /var/log/syslog",
    "ps aux --sort=-%cpu | head -20",
    "netstat -an | grep ESTABLISHED | wc -l",
    "python3 -c 'import torch; print(torch.cuda.get_device_name(0))'",
    "curl -s localhost:8080/metrics | grep fps",
    "ffmpeg -i input.mp4 -vcodec h264_nvenc -cq 18 out.mp4",
    "cat /proc/cpuinfo | grep 'model name' | uniq",
    "dmesg | tail -20",
    "ls -la /dev/snd/",
    "amixer set Master 85%",
    "systemctl status pulseaudio",
    "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader",
    "lspci | grep -i 'VGA\\|3D'",
    "top -b -n 1 | head -5",
    "ping -c 1 8.8.8.8",
    "cat /proc/asound/cards",
];
const OUTPUTS = [
    "[  OK  ] Started Audio Service.",
    "CUDA 12.3 | RTX 3090 | 24576 MB",
    "Connection: ESTABLISHED (127.0.0.1:20000)",
    "FPS: 59.94 | CPU: 12% | GPU: 87%",
    "> 48kHz 32-bit stereo stream active",
    "WARNING: underrun on device hw:0,0",
    "Loaded scene: live_show_2024.json",
    "BPM detected: 134.2",
    "|████████████████████| 100% done",
    "error: buffer overflow at 0x7ffd3a20",
    "/dev/snd/controlC0  /dev/snd/pcmC0D0c",
    "encode: 2.3ms | decode: 0.8ms | net: 1.1ms",
    "kernel: [   23.4] usb 2-1: new device",
];
const GLITCH_CHARS = "░▒▓█▄▀▌▐■□▪▫◆◇○●";

export const terminalPromptParams = () => ({
    style:     { base: 0,    min: 0, max: 2,   step: 1, mod: { source: "" } }, // 0=green, 1=amber, 2=white
    speed:     { base: 0.5,  min: 0, max: 3,             mod: { source: "" } },
    fontSize:  { base: 13,   min: 8, max: 24,  step: 1,  mod: { source: "" } },
    glitch:    { base: 0.4,  min: 0, max: 1,             mod: { source: "" } },
    scanlines: { base: 0.3,  min: 0, max: 1,             mod: { source: "" } },
    glow:      { base: 0.5,  min: 0, max: 1,             mod: { source: "" } },
    bgAlpha:   { base: 0.9,  min: 0, max: 1,             mod: { source: "" } },
    density:   { base: 0.7,  min: 0, max: 1,             mod: { source: "" } }, // line density
});

const PALETTES = [
    { fg: "#00ff41", dim: "#006617", bg: "#000f00", glow: "rgba(0,255,65," },   // green phosphor
    { fg: "#ffb347", dim: "#7a4400", bg: "#0f0800", glow: "rgba(255,179,71," }, // amber
    { fg: "#e8e8e8", dim: "#606060", bg: "#050508", glow: "rgba(200,220,255," },// white/cool
];

export function drawTerminalPrompt(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const style    = Math.round(Math.max(0, Math.min(2, p.style ?? 0)));
    const speed    = p.speed ?? 0.5;
    const fsize    = Math.round(Math.max(8, Math.min(24, p.fontSize ?? 13)));
    const glitch   = p.glitch ?? 0.4;
    const scanAlpha= p.scanlines ?? 0.3;
    const glow     = p.glow ?? 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.9;
    const pal      = PALETTES[style];
    const lineH    = fsize + 3;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            lines: [],
            scroll: 0,
            nextLine: 0,
            cmdCooldown: 0,
            lcg: 12345,
            prevBass: 0,
            blinkT: 0, lastT: 0 };
        _st.set(ctx, st);
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, Math.max(0, t - st.lastT)); st.lastT = t;

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };

    // Add new lines over time
    st.cmdCooldown -= speed * dt;
    if (st.cmdCooldown <= 0) {
        const prompt = PROMPTS[Math.floor(rand() * PROMPTS.length)];
        const cmd = CMDS[Math.floor(rand() * CMDS.length)];
        st.lines.push({ type: "cmd", text: prompt + " " + cmd, t: t });
        // Sprinkle output lines after command
        const nOut = Math.floor(rand() * 4);
        for (let i = 0; i < nOut; i++) {
            st.lines.push({ type: "out", text: OUTPUTS[Math.floor(rand() * OUTPUTS.length)], t: t + i * 0.2 });
        }
        st.cmdCooldown = 0.8 + rand() * 2.0;
    }

    // Advance scroll
    st.scroll += speed * 1.5;
    const maxLines = Math.ceil(h / lineH) + 4;
    if (st.lines.length > maxLines * 2) st.lines.splice(0, st.lines.length - maxLines * 2);

    // Background
    ctx.fillStyle = pal.bg;
    ctx.globalAlpha = bgAlpha;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Bass hit: screen glitch tear
    const beatHit = bass > 0.6 && st.prevBass < 0.5;
    st.prevBass = bass;

    ctx.font = `${fsize}px "Courier New", monospace`;
    ctx.textBaseline = "top";

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12 * (1 + treble * 0.4);
        ctx.shadowColor = pal.fg;
    }

    // Draw visible lines
    const startY = h - st.scroll % lineH - lineH * maxLines;
    const visibleCount = Math.ceil(h / lineH) + 2;

    for (let i = 0; i < st.lines.length && i < visibleCount + Math.floor(st.scroll / lineH); i++) {
        const li = st.lines[st.lines.length - 1 - i];
        if (!li) continue;
        const y = h - (i + 1) * lineH + (st.scroll % lineH);
        if (y < -lineH || y > h) continue;

        let text = li.text;
        // Glitch: corrupt random chars on bass hits
        if (beatHit && rand() < glitch * 0.4 && li.type === "out") {
            let ga = [...text];
            const n = Math.floor(rand() * 4) + 1;
            for (let j = 0; j < n; j++) {
                const pos = Math.floor(rand() * ga.length);
                ga[pos] = GLITCH_CHARS[Math.floor(rand() * GLITCH_CHARS.length)];
            }
            text = ga.join("");
        }

        ctx.fillStyle = li.type === "cmd" ? pal.fg : pal.dim;
        ctx.fillText(text, 8, y);
    }

    // Blinking cursor
    st.blinkT += dt * (2 + bass);
    if (Math.sin(st.blinkT * Math.PI) > 0) {
        const cy = h - lineH + (st.scroll % lineH);
        const prompt = PROMPTS[0] + " ";
        ctx.fillStyle = pal.fg;
        const cx = 8 + ctx.measureText(prompt).width;
        ctx.fillRect(cx, cy + 2, fsize * 0.55, fsize - 2);
    }

    ctx.shadowBlur = 0;

    // Scanlines
    if (scanAlpha > 0.02) {
        for (let y = 0; y < h; y += 2) {
            ctx.fillStyle = `rgba(0,0,0,${scanAlpha * 0.7})`;
            ctx.fillRect(0, y, w, 1);
        }
    }

    // Bass glitch: horizontal tear
    if (beatHit && glitch > 0.1) {
        const tearY = Math.floor(rand() * h);
        const tearH2 = Math.floor(rand() * 40) + 4;
        const shift = (rand() - 0.5) * w * 0.08 * glitch;
        try {
            const id = ctx.getImageData(0, tearY, w, tearH2);
            ctx.putImageData(id, shift, tearY);
        } catch (_) {}
    }
}
