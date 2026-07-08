// Galaxy map (experimental) — a starfield of every live jam session. Each session
// is a glowing star; its size tracks the peer count and its brightness fades as the
// jam goes quiet (idle since the last eval). Click a star to join that session.
//
// Data comes from the collab server's PUBLIC /sessions endpoint (slugs + peer counts
// + idle time only — no eval code). Polled every couple of seconds; the fade is
// interpolated between polls so it looks continuous.

async function collabHttpBase() {
    // Mirrors js/collab/collab.js's WS-base logic, but for the HTTP endpoint.
    if (location.protocol === 'https:') {
        const basePath = location.pathname.replace(/\/?[^/]*$/, '');
        return `${location.origin}${basePath}/ws`;          // collab HTTP proxied alongside /ws
    }
    let port = 4444;
    try { port = (await (await fetch('./config.json')).json()).collab?.port ?? port; } catch { /* default */ }
    return `http://${location.hostname}:${port}`;
}

// Deterministic 0..1 pair from a slug, so a session keeps its spot across refreshes.
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function seedPos(slug) {
    const h = hash(slug);
    return { fx: (h % 997) / 997, fy: ((h >>> 11) % 991) / 991, phase: (h % 628) / 100 };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initGalaxy() {
    const overlay  = document.getElementById('galaxy-overlay');
    const canvas   = document.getElementById('galaxy-canvas');
    const btn      = document.getElementById('btn-galaxy');
    const closeBtn = document.getElementById('galaxy-close');
    const empty    = document.getElementById('galaxy-empty');
    if (!overlay || !canvas || !btn) return;
    const ctx = canvas.getContext('2d');

    let base = null;                         // resolved collab HTTP base
    let nodes = new Map();                   // slug → node state
    let stars = [];                          // static background starfield
    let raf = 0, pollTimer = 0, open = false;
    let W = 0, H = 0, DPR = 1;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = overlay.clientWidth; H = overlay.clientHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        // rebuild the ambient starfield to fit
        stars = Array.from({ length: Math.round(W * H / 9000) }, (_, i) => ({
            x: (hash('bg' + i) % 10000) / 10000 * W,
            y: (hash('by' + i) % 10000) / 10000 * H,
            r: 0.4 + (hash('br' + i) % 100) / 100 * 0.9,
            tw: (hash('bt' + i) % 628) / 100,
        }));
    }

    // Map a session's seed to on-screen coordinates (padded to avoid the edges/header).
    function place(node) {
        const padX = 70, padTop = 90, padBot = 60;
        node.bx = padX + node.seed.fx * (W - padX * 2);
        node.by = padTop + node.seed.fy * (H - padTop - padBot);
    }

    async function poll() {
        if (!base) base = await collabHttpBase();
        let data;
        try { data = await (await fetch(`${base}/sessions`, { cache: 'no-store' })).json(); }
        catch { data = null; }
        const t = performance.now();
        if (!data) return;                    // keep the last frame; fetch may recover
        const seen = new Set();
        for (const s of data.sessions) {
            seen.add(s.slug);
            let n = nodes.get(s.slug);
            if (!n) { n = { slug: s.slug, seed: seedPos(s.slug), alpha: 0 }; place(n); nodes.set(s.slug, n); }
            n.clients = s.clients;
            n.idleBase = s.idleMs; n.idleAt = t;   // interpolate idle between polls
            n.ageMs = s.ageMs; n.evals = s.evals;
            n.gone = false;
        }
        // Sessions that dropped off the list → let them fade out, then remove.
        for (const [slug, n] of nodes) {
            if (!seen.has(slug) && !n.gone) { n.gone = true; n.goneAt = t; }
        }
        if (empty) empty.style.display = data.sessions.length ? 'none' : '';
    }

    function liveIdle(n, t) { return (n.idleBase || 0) + (t - (n.idleAt || t)); }

    function draw(t) {
        ctx.clearRect(0, 0, W, H);
        // ambient starfield
        for (const s of stars) {
            const a = 0.25 + Math.sin(t * 0.001 + s.tw) * 0.15;
            ctx.globalAlpha = clamp(a, 0.08, 0.5);
            ctx.fillStyle = '#8b98b5';
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (const [slug, n] of nodes) {
            // fade in on appear; fade out when gone
            const idle = liveIdle(n, t);
            let target = clamp(1 - idle / 90000, 0.18, 1);      // dim over ~90s idle
            if (n.gone) target = clamp(1 - (t - n.goneAt) / 2000, 0, 1) * 0.18;
            n.alpha += (target - n.alpha) * 0.08;
            if (n.gone && n.alpha < 0.01) { nodes.delete(slug); continue; }

            const drift = 10;
            n.x = n.bx + Math.sin(t * 0.00025 + n.seed.phase) * drift;
            n.y = n.by + Math.cos(t * 0.0002 + n.seed.phase * 1.3) * drift;
            const r = 7 + Math.min(n.clients || 1, 10) * 2.6;
            const active = idle < 2500;
            const twinkle = 0.85 + Math.sin(t * 0.004 + n.seed.phase) * 0.15;
            const a = n.alpha * twinkle;

            // glow
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
            g.addColorStop(0, `rgba(63,185,80,${0.55 * a})`);
            g.addColorStop(0.4, `rgba(63,185,80,${0.18 * a})`);
            g.addColorStop(1, 'rgba(63,185,80,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.2, 0, 7); ctx.fill();

            // activity pulse ring
            if (active) {
                const pr = r + ((t * 0.05) % 22);
                ctx.globalAlpha = clamp((1 - (pr - r) / 22) * a, 0, 1);
                ctx.strokeStyle = '#7ee787'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(n.x, n.y, pr, 0, 7); ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // core
            ctx.globalAlpha = clamp(a, 0, 1);
            ctx.fillStyle = active ? '#b7f7c0' : '#4cc85f';
            ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.5, 0, 7); ctx.fill();
            n.hitR = r * 3.2;

            // label: slug + peer count
            ctx.globalAlpha = clamp(a + 0.1, 0, 1);
            ctx.fillStyle = '#c9d1d9';
            ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(slug, n.x, n.y + r + 16);
            ctx.fillStyle = '#8b949e'; ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`${n.clients || 1} ♪`, n.x, n.y + r + 29);
            ctx.globalAlpha = 1;
        }
        raf = requestAnimationFrame(draw);
    }

    function hitTest(px, py) {
        let best = null, bestD = Infinity;
        for (const n of nodes.values()) {
            if (n.gone) continue;
            const d = Math.hypot(px - n.x, py - n.y);
            if (d < (n.hitR || 24) && d < bestD) { bestD = d; best = n; }
        }
        return best;
    }

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const n = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (n) location.href = location.pathname + '?session=' + encodeURIComponent(n.slug);   // join
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        canvas.style.cursor = hitTest(e.clientX - rect.left, e.clientY - rect.top) ? 'pointer' : 'default';
    });

    function show() {
        overlay.hidden = false; open = true;
        resize();
        poll(); pollTimer = setInterval(poll, 2500);
        cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    }
    function hide() {
        overlay.hidden = true; open = false;
        clearInterval(pollTimer); cancelAnimationFrame(raf);
    }

    btn.onclick = () => (open ? hide() : show());
    if (closeBtn) closeBtn.onclick = hide;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
    window.addEventListener('resize', () => { if (open) resize(); });
}
