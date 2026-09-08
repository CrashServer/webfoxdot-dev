// ── CRIC WiFi Attack Simulator ────────────────────────────────────────────────
// Adapted from CRIC/CABLES Ops.Local.WiFiAttackSimulator.
// Network nodes representing WiFi/network devices; animated attack beams,
// port scans, and compromise states. Bass triggers new attacks.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const ATTACK_TYPES = [
    { name: "DEAUTH FLOOD",       color: "#ff0044", dur: 3 },
    { name: "HANDSHAKE CAPTURE",  color: "#00ff88", dur: 5 },
    { name: "BRUTE FORCE",        color: "#ffaa00", dur: 8 },
    { name: "EVIL TWIN",          color: "#ff00ff", dur: 4 },
    { name: "PORT SCAN",          color: "#00ffff", dur: 2 },
    { name: "ARP POISON",         color: "#ff6600", dur: 3.5 },
];

const DEVICE_NAMES = [
    "TOPLAP", "SVDK-HOST", "ZBDM-NODE", "SNCF-WIFI",
    "iPhone-7E", "ROUTER-GW", "PIX-CAM-01", "PIXEL-3570",
    "CLARA-AP", "LIVE-CTRL", "SRV-LOCAL", "DARKNET-01",
];

function initNodes(w, h, count) {
    const nodes = [];
    for (let i = 0; i < count; i++) {
        nodes.push({
            x: 60 + Math.random() * (w - 120),
            y: 60 + Math.random() * (h - 120),
            label: DEVICE_NAMES[i % DEVICE_NAMES.length],
            signal: 20 + Math.random() * 80 | 0,
            compromised: false,
            pulsePhase: Math.random() * TAU,
            r: 6 + Math.random() * 4,
            hue: 140 + Math.floor(Math.random() * 2) * 180, // cyan or magenta
        });
    }
    return nodes;
}

export const cricWifiAttackParams = () => ({
    nodes:    { base: 10,  min: 4,   max: 20,  step: 1, mod: { source: "" } },
    speed:    { base: 1.0, min: 0.2, max: 4,            mod: { source: "" } },
    hue:      { base: 180, min: 0,   max: 360,          mod: { source: "" } }, // node hue
    pulse:    { base: 0.7, min: 0,   max: 1,            mod: { source: "" } },
    glow:     { base: 0.8, min: 0,   max: 1,            mod: { source: "" } },
    scanRing: { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } }, // scanner animation
    labels:   { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    bgAlpha:  { base: 0.88,min: 0,   max: 1,            mod: { source: "" } },
});

export function drawCricWifiAttack(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nNodes  = Math.round(Math.max(4, Math.min(20, p.nodes ?? 10)));
    const speed   = p.speed ?? 1.0;
    const hue     = p.hue ?? 180;
    const pulse   = p.pulse ?? 0.7;
    const glow    = p.glow ?? 0.8;
    const showScan= (p.scanRing ?? 1) > 0.5;
    const showLabels = (p.labels ?? 1) > 0.5;
    const bgAlpha = p.bgAlpha ?? 0.88;

    let st = _st.get(ctx);
    if (!st || st.nNodes !== nNodes) {
        const nodes = initNodes(w, h, nNodes);
        st = { nodes, attacks: [], scanAngle: 0, prevBass: 0, scanPulse: 0 };
        st.nNodes = nNodes;
        _st.set(ctx, st);
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Bass triggers new attack
    if (bass > 0.45 && bass > st.prevBass + 0.08) {
        const from = Math.floor(Math.random() * st.nodes.length);
        let to = Math.floor(Math.random() * st.nodes.length);
        if (to === from) to = (to + 1) % st.nodes.length;
        const att = ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)];
        if (st.attacks.length < 12) {
            st.attacks.push({ from, to, type: att, progress: 0,
                              dur: att.dur / speed * (0.5 + bass * 0.5), done: false });
        }
        st.scanPulse = 1;
    }
    st.prevBass = bass;
    st.scanPulse *= 0.92;
    st.scanAngle += dt * speed * (0.8 + bass * pulse * 1.5);

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Background grid
    const gs = 40;
    ctx.strokeStyle = `hsla(${hue},60%,10%,0.3)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // Draw static connections (weakly)
    ctx.lineWidth = 0.4;
    for (let i = 0; i < st.nodes.length; i++) {
        for (let j = i+1; j < st.nodes.length; j++) {
            const a = st.nodes[i], b = st.nodes[j];
            const d = Math.hypot(a.x-b.x, a.y-b.y);
            if (d < w * 0.28) {
                const strength = 1 - d / (w * 0.28);
                ctx.strokeStyle = `hsla(${hue},50%,20%,${strength * 0.4})`;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
        }
    }

    // Scanner ring
    if (showScan) {
        const sr = (w + h) * 0.25 * (1 + st.scanPulse * 0.15);
        const cx = w * 0.5 + Math.cos(st.scanAngle * 0.5) * w * 0.1;
        const cy = h * 0.5 + Math.sin(st.scanAngle * 0.3) * h * 0.1;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
        grad.addColorStop(0, `hsla(${hue},80%,20%,0)`);
        grad.addColorStop(0.85, `hsla(${hue},80%,20%,0)`);
        grad.addColorStop(0.97, `hsla(${hue},90%,55%,${0.12 + treble * 0.1})`);
        grad.addColorStop(1,    `hsla(${hue},90%,55%,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill();

        // Scan sweep line
        const sa = st.scanAngle;
        ctx.strokeStyle = `hsla(${hue},90%,60%,${0.3 + bass * 0.3})`;
        ctx.lineWidth = 1.5;
        if (glow > 0.05) { ctx.shadowBlur = glow * 20; ctx.shadowColor = `hsl(${hue},100%,60%)`; }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Sweep gradient fill
        const sweepGrad = ctx.createConicalGradient
            ? null : null; // not available; simulate with arcs
        // Arc sweep
        ctx.fillStyle = `hsla(${hue},80%,40%,0.06)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, sr * 0.95, sa - 0.5, sa);
        ctx.closePath();
        ctx.fill();
    }

    // Active attack beams
    for (const att of st.attacks) {
        if (att.done) continue;
        att.progress = Math.min(1, att.progress + dt / att.dur);
        if (att.progress >= 1) {
            // Compromise target on completion
            st.nodes[att.to].compromised = true;
            att.done = true;
        }

        const a = st.nodes[att.from], b = st.nodes[att.to];
        const prog = att.progress;

        // Beam midpoint bulge
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const beamX = a.x + (b.x - a.x) * prog;
        const beamY = a.y + (b.y - a.y) * prog;

        // Draw trail
        ctx.lineWidth = 1.5 + bass * pulse;
        if (glow > 0.05) { ctx.shadowBlur = glow * 16; ctx.shadowColor = att.type.color; }
        ctx.strokeStyle = att.type.color + "aa";
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t * speed * 40;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(beamX, beamY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Packet dot
        ctx.fillStyle = att.type.color;
        if (glow > 0.05) { ctx.shadowBlur = glow * 12; ctx.shadowColor = att.type.color; }
        ctx.beginPath(); ctx.arc(beamX, beamY, 5, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;

        // Attack label near midpoint
        ctx.fillStyle = att.type.color;
        ctx.font = `bold 9px "Courier New", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(att.type.name, mx, my - 8);
    }
    ctx.textAlign = "left";

    // Nodes
    for (const node of st.nodes) {
        node.pulsePhase += dt * (1.5 + bass * pulse);
        const pls = 0.7 + 0.3 * Math.sin(node.pulsePhase);
        const nodeHue = node.compromised ? 0 : hue;
        const r = node.r * pls * (1 + bass * pulse * 0.4);

        // Outer pulse ring
        if (glow > 0.05) { ctx.shadowBlur = glow * 15; ctx.shadowColor = `hsl(${nodeHue},100%,60%)`; }
        ctx.strokeStyle = `hsla(${nodeHue},90%,60%,${pls * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(node.x, node.y, r * 2, 0, TAU); ctx.stroke();

        // Node body
        ctx.fillStyle = node.compromised
            ? `hsla(0,90%,${40 + pls * 20}%,0.9)`
            : `hsla(${nodeHue},80%,${30 + pls * 25}%,0.9)`;
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        if (showLabels) {
            ctx.fillStyle = node.compromised ? `#ff4444` : `hsl(${nodeHue},80%,75%)`;
            ctx.font = `9px "Courier New", monospace`;
            ctx.textAlign = "center";
            ctx.fillText(node.label, node.x, node.y + r + 12);
            ctx.fillText(`-${node.signal}dBm`, node.x, node.y + r + 22);
        }
    }
    ctx.textAlign = "left";

    // Stats header
    const compromised = st.nodes.filter(n => n.compromised).length;
    ctx.fillStyle = `hsla(${hue},80%,65%,0.7)`;
    ctx.font = `bold 11px "Courier New", monospace`;
    ctx.fillText(`NETWORKS: ${st.nodes.length}  COMPROMISED: ${compromised}  ATTACKS: ${st.attacks.filter(a=>!a.done).length}`, 10, 20);

    // Cleanup done attacks
    st.attacks = st.attacks.filter(a => !a.done || (t - (a.doneTime ?? (a.doneTime=t))) < 0.5);
}
