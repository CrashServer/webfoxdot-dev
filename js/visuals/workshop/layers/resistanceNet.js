// ── Resistance Network ────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION ResistanceNetScene.
// Green resistance nodes vs red surveillance probes. Infection spreads on beats.
// Data packets hop between allies. Bass = probe attack. Mid = data transfer.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const LABELS = ['NODE_A','NODE_B','RELAY','BRIDGE','CELL_1','CELL_2','HUB','LEAF',
                 'PROXY','VPN','TOR','ONION','CRYPT','ANON','GHOST','ZERO'];
const PROBE_NAMES = ['PRISM','TEMPEST','GORGON','ARGUS','CARNIVORE','ECHELON'];

export const resistanceNetParams = () => ({
    nodes:    { base: 12,  min: 4,   max: 24, step: 1,  mod: { source: "" } },
    probes:   { base: 3,   min: 1,   max: 8,  step: 1,  mod: { source: "" } },
    speed:    { base: 0.8, min: 0.1, max: 3,             mod: { source: "" } },
    pulse:    { base: 0.8, min: 0,   max: 1,             mod: { source: "" } },
    hue:      { base: 120, min: 0,   max: 360,           mod: { source: "" } }, // resistance (green)
    hue2:     { base: 0,   min: 0,   max: 360,           mod: { source: "" } }, // probes (red)
    glow:     { base: 0.7, min: 0,   max: 1,             mod: { source: "" } },
    showText: { base: 1,   min: 0,   max: 1,   step: 1,  mod: { source: "" } },
    bgAlpha:  { base: 0.9, min: 0,   max: 1,             mod: { source: "" } },
    encrypt:  { base: 0.5, min: 0,   max: 1,             mod: { source: "" } }, // encryption streams density
});

export function drawResistanceNet(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nNodes   = Math.round(Math.max(4, Math.min(24, p.nodes ?? 12)));
    const nProbes  = Math.round(Math.max(1, Math.min(8, p.probes ?? 3)));
    const speed    = p.speed ?? 0.8;
    const pulse    = p.pulse ?? 0.8;
    const hue      = p.hue ?? 120;
    const hue2     = p.hue2 ?? 0;
    const glow     = p.glow ?? 0.7;
    const showText = (p.showText ?? 1) > 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.9;
    const encrypt  = p.encrypt ?? 0.5;

    let st = _st.get(ctx);
    if (!st || st.nNodes !== nNodes || st.nProbes !== nProbes) {
        const nodes = [];
        for (let i = 0; i < nNodes; i++) {
            nodes.push({
                x: w * 0.1 + Math.random() * w * 0.8,
                y: h * 0.1 + Math.random() * h * 0.8,
                vx: (Math.random()-0.5) * 20,
                vy: (Math.random()-0.5) * 20,
                label: LABELS[i % LABELS.length],
                compromised: false, comprTimer: 0,
                pulsePhase: Math.random() * TAU,
            });
        }
        const probes = [];
        for (let i = 0; i < nProbes; i++) {
            const targetIdx = Math.floor(Math.random() * nNodes);
            probes.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: 0, vy: 0, target: targetIdx,
                name: PROBE_NAMES[i % PROBE_NAMES.length],
                attack: 0, // attack progress 0-1
                detected: false,
            });
        }
        // Build edges: connect each node to 2-3 nearest
        const edges = [];
        for (let i = 0; i < nNodes; i++) {
            const dists = [];
            for (let j = 0; j < nNodes; j++) {
                if (i===j) continue;
                const d = Math.hypot(nodes[i].x-nodes[j].x, nodes[i].y-nodes[j].y);
                dists.push({j, d});
            }
            dists.sort((a,b) => a.d-b.d);
            const k = 2 + Math.floor(Math.random()*2);
            for (let m = 0; m < Math.min(k, dists.length); m++) {
                const e = [Math.min(i, dists[m].j), Math.max(i, dists[m].j)];
                if (!edges.find(ex => ex[0]===e[0] && ex[1]===e[1])) edges.push(e);
            }
        }
        st = { nodes, probes, edges, nNodes, nProbes,
               packets: [], prevBass: 0, prevMid: 0, lastT: t,
               attacks: 0, compromised: 0 };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    const { nodes, probes, edges } = st;

    // Bass → probe attacks
    if (bass > 0.4 && bass > st.prevBass + 0.1) {
        const pi = Math.floor(Math.random() * probes.length);
        probes[pi].target = Math.floor(Math.random() * nNodes);
        probes[pi].attack = Math.min(1, probes[pi].attack + bass * pulse * 0.4);
        probes[pi].detected = false;
        st.attacks++;
    }
    st.prevBass = bass;

    // Mid → data packet transfer
    if (mid > 0.35 && mid > st.prevMid + 0.08 && st.packets.length < 30) {
        const src = Math.floor(Math.random() * nNodes);
        const dst = Math.floor(Math.random() * nNodes);
        if (src !== dst && !nodes[src].compromised) {
            st.packets.push({ src, dst, t: 0 });
        }
    }
    st.prevMid = mid;

    // Node drift
    for (const nd of nodes) {
        nd.vx += (Math.random()-0.5)*0.5*speed;
        nd.vy += (Math.random()-0.5)*0.5*speed;
        nd.vx *= 0.97; nd.vy *= 0.97;
        nd.x = Math.max(30, Math.min(w-30, nd.x + nd.vx * dt));
        nd.y = Math.max(30, Math.min(h-30, nd.y + nd.vy * dt));
        nd.pulsePhase += dt * 2.5;
        if (nd.comprTimer > 0) nd.comprTimer -= dt;
    }

    // Probe movement toward target
    for (const pr of probes) {
        const tgt = nodes[pr.target];
        const dx = tgt.x - pr.x, dy = tgt.y - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd2 = 60 * speed * (1 + bass * pulse * 0.5);
        pr.vx += dx/d * spd2 * dt;
        pr.vy += dy/d * spd2 * dt;
        pr.vx *= 0.92; pr.vy *= 0.92;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        // When close to target, compromise
        if (d < 30) {
            pr.attack += dt * 0.3 * speed;
            if (pr.attack >= 1 && !tgt.compromised) {
                tgt.compromised = true;
                tgt.comprTimer = 8;
                st.compromised++;
                pr.attack = 0;
                pr.target = Math.floor(Math.random() * nNodes);
            }
        }
        // Recover compromised after timer
        for (const nd of nodes) {
            if (nd.compromised && nd.comprTimer <= 0) {
                nd.compromised = false;
                st.compromised = Math.max(0, st.compromised - 1);
            }
        }
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Edges
    if (glow > 0.05) { ctx.shadowBlur = glow * 8; ctx.shadowColor = `hsl(${hue},100%,50%)`; }
    for (const [a, b] of edges) {
        const na = nodes[a], nb = nodes[b];
        const bothComp = na.compromised && nb.compromised;
        const eitherComp = na.compromised || nb.compromised;
        const eHue = bothComp ? hue2 : eitherComp ? (hue + hue2) / 2 : hue;
        ctx.strokeStyle = `hsla(${eHue},70%,30%,0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.stroke();

        // Encryption stream along edge
        if (encrypt > 0.05 && !eitherComp) {
            const nStreams = Math.floor(encrypt * 3);
            for (let s = 0; s < nStreams; s++) {
                const frac = ((t * speed * 0.4 + s / nStreams + a * 0.1) % 1);
                const sx = na.x + (nb.x - na.x) * frac;
                const sy = na.y + (nb.y - na.y) * frac;
                ctx.fillStyle = `hsla(${hue},100%,65%,${encrypt * 0.5})`;
                ctx.beginPath(); ctx.arc(sx, sy, 2, 0, TAU); ctx.fill();
            }
        }
    }
    ctx.shadowBlur = 0;

    // ── Data packets
    for (const pk of st.packets) {
        pk.t += dt * speed * 0.8;
        if (pk.t >= 1) continue;
        const na = nodes[pk.src], nb = nodes[pk.dst];
        const px = na.x + (nb.x - na.x) * pk.t;
        const py = na.y + (nb.y - na.y) * pk.t;
        ctx.fillStyle = `hsla(${hue},90%,70%,${1-pk.t})`;
        ctx.shadowBlur = glow * 10; ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
    }
    st.packets = st.packets.filter(pk => pk.t < 1);

    // ── Nodes
    for (const nd of nodes) {
        const r = 8 + Math.sin(nd.pulsePhase) * 2 * (1 + bass * pulse * 0.4);
        const nHue = nd.compromised ? hue2 : hue;
        const light = nd.compromised ? 45 + treble * 15 : 40 + treble * 20;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * (nd.compromised ? 20 : 12) * (1 + bass * pulse * 0.3);
            ctx.shadowColor = `hsl(${nHue},100%,60%)`;
        }
        // Outer ring
        ctx.strokeStyle = `hsl(${nHue},80%,${light}%)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, TAU); ctx.stroke();
        // Inner fill
        ctx.fillStyle = `hsla(${nHue},60%,${light-15}%,0.8)`;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, r * 0.5, 0, TAU); ctx.fill();

        if (showText) {
            ctx.shadowBlur = 0;
            ctx.font = `8px monospace`;
            ctx.fillStyle = `hsla(${nHue},70%,65%,0.8)`;
            ctx.fillText(nd.label, nd.x - 18, nd.y + r + 10);
        }
    }

    // ── Probes
    for (const pr of probes) {
        const pR = 6 + bass * pulse * 3;
        ctx.shadowBlur = glow * 15 * (1 + bass * pulse * 0.5);
        ctx.shadowColor = `hsl(${hue2},100%,50%)`;
        ctx.strokeStyle = `hsl(${hue2},90%,55%)`;
        ctx.lineWidth = 1.5;
        // Scanning ring
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pR * (1 + pr.attack), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = `hsl(${hue2},80%,40%)`;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pR * 0.4, 0, TAU); ctx.fill();
        // Rotating scan arm
        const scanAng = t * speed * 2 + probes.indexOf(pr);
        ctx.strokeStyle = `hsla(${hue2},100%,65%,0.8)`;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x + Math.cos(scanAng) * pR * 1.5, pr.y + Math.sin(scanAng) * pR * 1.5);
        ctx.stroke();
        if (showText) {
            ctx.shadowBlur = 0;
            ctx.font = `7px monospace`;
            ctx.fillStyle = `hsla(${hue2},80%,65%,0.7)`;
            ctx.fillText(pr.name, pr.x - 18, pr.y + pR + 10);
        }
    }
    ctx.shadowBlur = 0;

    // ── HUD
    if (showText) {
        ctx.font = `9px monospace`;
        ctx.fillStyle = `hsla(${hue},70%,50%,0.6)`;
        ctx.fillText(`NODES: ${nNodes}  SECURED: ${nNodes - st.compromised}  ATTACKS: ${st.attacks}`, 8, h - 10);
    }
}
