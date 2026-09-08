// ── Virus Spread ──────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION VirusScene (Three.js → Canvas2D).
// Network infection spreading between nodes. Spore particles on bass hits.
// Philosophical Baudrillard/Deleuze quotes fade in/out. Treble = mutations.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const QUOTES = [
    "Le simulacre n'est jamais ce qui cache la vérité",
    "L'hyperréalité est la condition de notre temps",
    "Les rhizomes connectent sans hiérarchie",
    "La carte précède le territoire",
    "Accélérer jusqu'à la transformation",
    "We are all nodes in the network now",
    "Information wants to be free and fatal",
    "The virus has no memory, only propagation",
];

function noise2(x, y, t) {
    return Math.sin(x*2.1+t*0.5)*Math.cos(y*1.7-t*0.3)*0.5+0.5;
}

export const virusSpreadParams = () => ({
    nodes:     { base: 20,  min: 5,   max: 40,  step: 1, mod: { source: "" } },
    hue:       { base: 290, min: 0,   max: 360,          mod: { source: "" } }, // infected (magenta)
    hue2:      { base: 120, min: 0,   max: 360,          mod: { source: "" } }, // healthy (green)
    spread:    { base: 0.6, min: 0,   max: 1,            mod: { source: "" } }, // infection rate
    pulse:     { base: 0.8, min: 0,   max: 1,            mod: { source: "" } },
    speed:     { base: 0.8, min: 0.1, max: 3,            mod: { source: "" } },
    mutate:    { base: 0.5, min: 0,   max: 1,            mod: { source: "" } }, // treble mutation bursts
    quotes:    { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    glow:      { base: 0.7, min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:   { base: 0.9, min: 0,   max: 1,            mod: { source: "" } },
    recovery:  { base: 0.3, min: 0,   max: 1,            mod: { source: "" } }, // recovery probability
});

export function drawVirusSpread(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nNodes   = Math.round(Math.max(5, Math.min(40, p.nodes ?? 20)));
    const hue      = p.hue ?? 290;
    const hue2     = p.hue2 ?? 120;
    const spread   = p.spread ?? 0.6;
    const pulse    = p.pulse ?? 0.8;
    const speed    = p.speed ?? 0.8;
    const mutate   = p.mutate ?? 0.5;
    const showQ    = (p.quotes ?? 1) > 0.5;
    const glow     = p.glow ?? 0.7;
    const bgAlpha  = p.bgAlpha ?? 0.9;
    const recovery = p.recovery ?? 0.3;

    let st = _st.get(ctx);
    if (!st || st.nNodes !== nNodes) {
        const nodes = [];
        for (let i = 0; i < nNodes; i++) {
            nodes.push({
                x: w*0.08 + Math.random()*w*0.84, y: h*0.08 + Math.random()*h*0.84,
                vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                infected: i < 2, infectedTime: 0,
                size: 5 + Math.random()*8, pulsePhase: Math.random()*TAU,
                mutated: false, mutateTimer: 0, recovering: false,
            });
        }
        // Build edges
        const edges = [];
        for (let i = 0; i < nNodes; i++) {
            const dists = [];
            for (let j = 0; j < nNodes; j++) {
                if (i===j) continue;
                dists.push({j, d: Math.hypot(nodes[i].x-nodes[j].x, nodes[i].y-nodes[j].y)});
            }
            dists.sort((a,b) => a.d-b.d);
            for (let k = 0; k < Math.min(3, dists.length); k++) {
                const e = [Math.min(i,dists[k].j), Math.max(i,dists[k].j)];
                if (!edges.find(ex => ex[0]===e[0] && ex[1]===e[1])) edges.push(e);
            }
        }
        st = { nodes, edges, nNodes, spores: [], quote: '', quoteAlpha: 0, quoteTimer: 0,
               prevBass: 0, prevTreble: 0, infectTimer: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    const { nodes, edges } = st;

    // Bass → spore burst + spread acceleration
    if (bass > 0.4 && bass > st.prevBass + 0.08) {
        const nSpores = Math.ceil(bass * pulse * 15);
        for (const nd of nodes) {
            if (!nd.infected) continue;
            for (let i = 0; i < nSpores; i++) {
                const ang = Math.random() * TAU;
                const spd = 50 + Math.random() * 150;
                st.spores.push({ x: nd.x, y: nd.y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
                                  life: 0.6+Math.random()*0.4, hue: hue });
            }
        }
    }
    st.prevBass = bass;

    // Treble → mutation burst
    if (treble > 0.6 && treble > st.prevTreble + 0.1 && mutate > 0.1) {
        for (const nd of nodes) {
            if (nd.infected && Math.random() < mutate * 0.3) {
                nd.mutated = true; nd.mutateTimer = 1 + Math.random();
            }
        }
        if (showQ && st.quoteTimer <= 0 && Math.random() < 0.5) {
            st.quote = QUOTES[Math.floor(Math.random()*QUOTES.length)];
            st.quoteTimer = 4; st.quoteAlpha = 0;
        }
    }
    st.prevTreble = treble;

    // Infection spreading
    st.infectTimer -= dt;
    if (st.infectTimer <= 0) {
        st.infectTimer = Math.max(0.05, 0.3 / speed);
        const spreadChance = spread * (1 + bass * pulse * 0.5);
        for (const [a, b] of edges) {
            const na = nodes[a], nb = nodes[b];
            if (na.infected && !nb.infected && Math.random() < spreadChance * 0.15) {
                nb.infected = true; nb.infectedTime = 0;
            }
            if (nb.infected && !na.infected && Math.random() < spreadChance * 0.15) {
                na.infected = true; na.infectedTime = 0;
            }
            // Recovery
            if (na.infected && Math.random() < recovery * 0.003) na.infected = false;
            if (nb.infected && Math.random() < recovery * 0.003) nb.infected = false;
        }
    }

    // Node movement
    for (const nd of nodes) {
        nd.vx += (Math.random()-0.5)*1.5*speed; nd.vy += (Math.random()-0.5)*1.5*speed;
        nd.vx *= 0.97; nd.vy *= 0.97;
        nd.x = Math.max(20, Math.min(w-20, nd.x + nd.vx*dt));
        nd.y = Math.max(20, Math.min(h-20, nd.y + nd.vy*dt));
        if (nd.infected) nd.infectedTime += dt;
        nd.pulsePhase += dt * 3;
        if (nd.mutateTimer > 0) nd.mutateTimer -= dt; else nd.mutated = false;
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Edges
    for (const [a, b] of edges) {
        const na = nodes[a], nb = nodes[b];
        const bothInf = na.infected && nb.infected;
        const eitherInf = na.infected || nb.infected;
        const eHue = bothInf ? hue : eitherInf ? (hue+hue2)/2 : hue2;
        const eAlpha = bothInf ? 0.45 + mid*0.2 : eitherInf ? 0.2 : 0.1;
        ctx.strokeStyle = `hsla(${eHue},80%,40%,${eAlpha})`;
        ctx.lineWidth = bothInf ? 1.5 : 0.7;
        if (bothInf && glow > 0.05) { ctx.shadowBlur = glow*8; ctx.shadowColor=`hsl(${hue},100%,50%)`; }
        ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
        ctx.shadowBlur = 0;

        // Infection particle travelling along edge
        if (eitherInf) {
            const frac = (t * speed * 0.3 + a * 0.17 + b * 0.11) % 1;
            const px = na.x + (nb.x-na.x)*frac, py = na.y + (nb.y-na.y)*frac;
            ctx.fillStyle = `hsla(${hue},90%,65%,${eAlpha*1.5})`;
            ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
        }
    }

    // ── Nodes
    for (const nd of nodes) {
        const nHue = nd.infected ? (nd.mutated ? (hue+60)%360 : hue) : hue2;
        const r    = nd.size * (1 + Math.sin(nd.pulsePhase)*0.15) * (1 + (nd.infected ? bass*pulse*0.4 : 0));
        const light = nd.infected ? 40+treble*20 : 25+treble*10;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * (nd.infected ? 18 : 8);
            ctx.shadowColor = `hsl(${nHue},100%,60%)`;
        }
        ctx.strokeStyle = `hsl(${nHue},80%,${light}%)`;
        ctx.lineWidth = nd.infected ? 1.5 : 0.8;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = `hsla(${nHue},60%,${light-15}%,0.7)`;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, r*0.55, 0, TAU); ctx.fill();
        // Mutation spikes
        if (nd.mutated) {
            const nSpikes = 6;
            ctx.strokeStyle = `hsla(${(hue+60)%360},90%,65%,0.7)`;
            ctx.lineWidth = 0.8;
            for (let s = 0; s < nSpikes; s++) {
                const ang = (s/nSpikes)*TAU + t*2;
                ctx.beginPath();
                ctx.moveTo(nd.x + Math.cos(ang)*r, nd.y + Math.sin(ang)*r);
                ctx.lineTo(nd.x + Math.cos(ang)*r*1.7, nd.y + Math.sin(ang)*r*1.7);
                ctx.stroke();
            }
        }
    }
    ctx.shadowBlur = 0;

    // ── Spores
    for (const sp of st.spores) {
        sp.x += sp.vx*dt; sp.y += sp.vy*dt;
        sp.vx *= 0.95; sp.vy *= 0.95;
        sp.life -= dt * 1.5;
        ctx.fillStyle = `hsla(${sp.hue},90%,65%,${Math.max(0,sp.life)})`;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5, 0, TAU); ctx.fill();
    }
    st.spores = st.spores.filter(s => s.life > 0);

    // ── Quote overlay
    if (showQ && st.quoteTimer > 0) {
        st.quoteTimer -= dt;
        st.quoteAlpha = Math.min(1, st.quoteAlpha + dt*1.5);
        if (st.quoteTimer < 1) st.quoteAlpha = st.quoteTimer;
        ctx.font = `italic ${Math.round(11+treble*4)}px "Georgia", serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `hsla(${hue},60%,65%,${st.quoteAlpha * 0.8})`;
        ctx.fillText(`"${st.quote}"`, w/2, h*0.08);
        ctx.textAlign = 'left';
    }

    // ── HUD
    const nInf = nodes.filter(n=>n.infected).length;
    ctx.font = '8px monospace';
    ctx.fillStyle = `hsla(${hue},70%,55%,0.5)`;
    ctx.fillText(`INFECTED: ${nInf}/${nNodes}  VIRAL LOAD: ${Math.floor(bass*100)}%`, 8, h-10);
}
