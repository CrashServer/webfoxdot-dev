// Galaxy map (experimental) — a starfield of every live jam session. Each session
// is a glowing star; its size tracks the peer count and its brightness fades as the
// jam goes quiet (idle since the last eval). Click a star to join that session.
//
// Data comes from the collab server's PUBLIC /sessions endpoint (slugs + peer counts
// + idle time only — no eval code). Polled every couple of seconds; the fade is
// interpolated between polls so it looks continuous.

import { collabHttpBase } from '../net/serverUrls.js';
import { exampleList }    from '../ui/docs.js';

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
const lerp = (a, b, f) => a + (b - a) * f;
function fmtAge(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d) return `${d}d ${h % 24}h`;
    if (h) return `${h}h ${m % 60}m`;
    if (m) return `${m}m`;
    return `${s}s`;
}
// Star colour by recency: bright green when fresh, cooling to a faded blue-grey as a
// dormant jam decays over its whole TTL (so the colour, not just the alpha, ages).
function starColor(n) {
    if (!n.dormant) return [63, 185, 80];
    const f = clamp(n.decayFrac || 0, 0, 1);
    return [Math.round(lerp(70, 116, f)), Math.round(lerp(170, 128, f)), Math.round(lerp(96, 156, f))];
}

export function initGalaxy(onPickExample) {
    const overlay  = document.getElementById('galaxy-overlay');
    const canvas   = document.getElementById('galaxy-canvas');
    const btn      = document.getElementById('btn-galaxy');
    const closeBtn = document.getElementById('galaxy-close');
    const empty    = document.getElementById('galaxy-empty');
    const tip      = document.getElementById('galaxy-tip');
    if (!overlay || !canvas || !btn) return;
    const ctx = canvas.getContext('2d');

    // The session we're currently IN (if any) — its star is highlighted and clicking
    // it just closes the map (no reload/rejoin). Mirrors index.html's slug parsing.
    const _qs = new URLSearchParams(location.search);
    const currentSlug = _qs.get('session') || _qs.get('s') || _qs.get('') || null;

    let base = null;                         // resolved collab HTTP base
    let nodes = new Map();                   // slug → jam node state
    let stars = [];                          // static background starfield
    let clusters = [];                       // example category clusters (nebulae)
    let exNodes = [];                        // example stars (built from exampleList())
    let raf = 0, pollTimer = 0, open = false;
    let W = 0, H = 0, DPR = 1;

    // Example clusters — a browsable nebula PER category, derived live from
    // exampleList() (rebuilt each open, so it tracks example changes). Jams stay the
    // bright foreground; examples are dim, cool, grouped background stars.
    function buildExamples() {
        const list = (() => { try { return exampleList() || []; } catch { return []; } })();
        const cats = [...new Set(list.map(e => e.cat || 'misc'))];
        clusters = cats.map((cat) => {
            const h = hash('cat:' + cat);
            return {
                cat,
                fx: 0.12 + (h % 1000) / 1000 * 0.76,
                fy: 0.18 + ((h >>> 10) % 1000) / 1000 * 0.62,
                hue: 188 + (h % 130),   // cyan..magenta — clear of jam green/amber
            };
        });
        const byCat = new Map(clusters.map(c => [c.cat, c]));
        exNodes = list.map((e) => {
            const c = byCat.get(e.cat || 'misc');
            const h = hash('ex:' + e.id);
            return {
                isExample: true, exId: e.id, title: e.title, cat: e.cat, cl: c, hue: c.hue,
                offAng: (h % 628) / 100, offRad: 22 + (h % 46), phase: ((h >>> 9) % 628) / 100,
            };
        });
        placeExamples();
    }
    function placeExamples() {
        const padX = 60, padTop = 84, padBot = 50;
        for (const c of clusters) { c.cx = padX + c.fx * (W - padX * 2); c.cy = padTop + c.fy * (H - padTop - padBot); }
        for (const n of exNodes) { n.bx = n.cl.cx + Math.cos(n.offAng) * n.offRad; n.by = n.cl.cy + Math.sin(n.offAng) * n.offRad; }
    }

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
        placeExamples();   // reposition example clusters for the new size
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
            n.dormant = !!s.dormant;
            n.idleBase = s.idleMs; n.idleAt = t;    // interpolate idle between polls
            n.decayBase = s.decayMs || 0; n.decayAt = t; n.ttlMs = s.ttlMs || 600000;
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

        // ── Example clusters (background nebulae + dim stars) — drawn first & faint so
        //    the live jams below pop as the foreground highlight. ──────────────────
        ctx.textAlign = 'center';
        for (const c of clusters) {
            const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, 130);
            g.addColorStop(0, `hsla(${c.hue},60%,55%,0.07)`);
            g.addColorStop(1, `hsla(${c.hue},60%,55%,0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.cx, c.cy, 130, 0, 7); ctx.fill();
            ctx.globalAlpha = 0.45; ctx.fillStyle = `hsl(${c.hue},45%,72%)`;
            ctx.font = '9px ui-monospace, monospace';
            ctx.fillText((c.cat || '').toUpperCase(), c.cx, c.cy - 104);
            ctx.globalAlpha = 1;
        }
        for (const n of exNodes) {
            n.x = n.bx + Math.sin(t * 0.0002 + n.phase) * 3;
            n.y = n.by + Math.cos(t * 0.00018 + n.phase) * 3;
            const tw = 0.5 + Math.sin(t * 0.003 + n.phase) * 0.22;
            ctx.globalAlpha = clamp(tw, 0, 0.72);
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 9);
            g.addColorStop(0, `hsla(${n.hue},75%,72%,0.5)`);
            g.addColorStop(1, `hsla(${n.hue},75%,72%,0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 9, 0, 7); ctx.fill();
            ctx.fillStyle = `hsl(${n.hue},82%,82%)`;
            ctx.beginPath(); ctx.arc(n.x, n.y, 2.3, 0, 7); ctx.fill();
            n.hitR = 12;
            ctx.globalAlpha = 1;
        }

        for (const [slug, n] of nodes) {
            // Active jams fade with idle; DORMANT (emptied) jams decay over the full
            // TTL — a slow dim-out from ~0.7 to 0 — but stay clickable so you can revive
            // them (their code is still on the server).
            const idle = liveIdle(n, t);
            let target;
            if (n.dormant) {
                const dm = (n.decayBase || 0) + (t - (n.decayAt || t));
                target = clamp(1 - dm / (n.ttlMs || 600000), 0.05, 0.7);
            } else {
                target = clamp(1 - idle / 90000, 0.18, 1);
            }
            if (n.gone) target = clamp(1 - (t - n.goneAt) / 2000, 0, 1) * 0.1;
            n.alpha += (target - n.alpha) * 0.08;
            if (n.gone && n.alpha < 0.01) { nodes.delete(slug); continue; }

            const drift = n.dormant ? 4 : 10;
            n.x = n.bx + Math.sin(t * 0.00025 + n.seed.phase) * drift;
            n.y = n.by + Math.cos(t * 0.0002 + n.seed.phase * 1.3) * drift;
            const r = 7 + Math.min(n.clients || 1, 10) * 2.6;
            const active = !n.dormant && idle < 2500;
            const twinkle = n.dormant ? 1 : 0.85 + Math.sin(t * 0.004 + n.seed.phase) * 0.15;
            const a = n.alpha * twinkle;
            // colour ages with the jam: green when fresh → cool blue-grey as it decays.
            // The session YOU'RE in glows a distinct amber and never dims fully.
            const isMine = n.slug === currentSlug;
            n.decayFrac = n.dormant ? clamp(((n.decayBase || 0) + (t - (n.decayAt || t))) / (n.ttlMs || 1), 0, 1) : 0;
            const gc = isMine ? [245, 200, 70] : starColor(n);
            if (isMine) n.alpha = Math.max(n.alpha, 0.9);

            // glow
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
            g.addColorStop(0,   `rgba(${gc[0]},${gc[1]},${gc[2]},${0.55 * a})`);
            g.addColorStop(0.4, `rgba(${gc[0]},${gc[1]},${gc[2]},${0.18 * a})`);
            g.addColorStop(1,   `rgba(${gc[0]},${gc[1]},${gc[2]},0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.2, 0, 7); ctx.fill();

            // steady halo ring on your own session so it stands out at a glance
            if (isMine) {
                ctx.globalAlpha = clamp(0.55 * a, 0, 1);
                ctx.strokeStyle = '#f5c846'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(n.x, n.y, r + 6 + Math.sin(t * 0.003) * 2, 0, 7); ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // activity pulse ring (only while someone's actually playing)
            if (active) {
                const pr = r + ((t * 0.05) % 22);
                ctx.globalAlpha = clamp((1 - (pr - r) / 22) * a, 0, 1);
                ctx.strokeStyle = isMine ? '#f5c846' : '#7ee787'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(n.x, n.y, pr, 0, 7); ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // core
            ctx.globalAlpha = clamp(a, 0, 1);
            ctx.fillStyle = isMine ? '#ffe9a0' : (active ? '#b7f7c0' : `rgb(${gc[0]},${gc[1]},${gc[2]})`);
            ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.5, 0, 7); ctx.fill();
            n.hitR = r * 3.2;

            // label: slug + status
            ctx.globalAlpha = clamp(a + 0.15, 0, 1);
            ctx.fillStyle = isMine ? '#f5c846' : (n.dormant ? '#9aa5a5' : '#c9d1d9');
            ctx.font = `${isMine ? 'bold ' : ''}12px ui-monospace, Menlo, Consolas, monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(slug, n.x, n.y + r + 16);
            ctx.fillStyle = isMine ? '#f5c846' : '#8b949e'; ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(isMine ? "you're here · click to close" : (n.dormant ? 'resting · click to revive' : `${n.clients || 1} ♪`), n.x, n.y + r + 29);
            ctx.globalAlpha = 1;
        }
        raf = requestAnimationFrame(draw);
    }

    function hitTest(px, py) {
        // Live jams (foreground) win over example stars on overlap.
        let best = null, bestD = Infinity;
        for (const n of nodes.values()) {
            if (n.gone) continue;
            const d = Math.hypot(px - n.x, py - n.y);
            if (d < (n.hitR || 24) && d < bestD) { bestD = d; best = n; }
        }
        if (best) return best;
        for (const n of exNodes) {
            const d = Math.hypot(px - n.x, py - n.y);
            if (d < (n.hitR || 12) && d < bestD) { bestD = d; best = n; }
        }
        return best;
    }

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const n = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (!n) return;
        if (n.isExample) { onPickExample?.(n.exId); hide(); return; }   // load example → close
        if (n.slug === currentSlug) { hide(); return; }   // already here → just close the map
        location.href = location.pathname + '?session=' + encodeURIComponent(n.slug);   // join another
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const n = hitTest(mx, my);
        canvas.style.cursor = n ? 'pointer' : 'default';
        if (!n || !tip) { if (tip) tip.hidden = true; return; }
        tip.textContent = '';
        if (n.isExample) {
            const t1 = document.createElement('div'); t1.className = 'tip-slug'; t1.textContent = n.title;
            const t2 = document.createElement('div'); t2.className = 'tip-dim'; t2.textContent = `${n.cat} · click to load`;
            tip.append(t1, t2);
        } else {
            const now = performance.now();
            const slugEl = document.createElement('div'); slugEl.className = 'tip-slug'; slugEl.textContent = n.slug;
            const who = document.createElement('div');
            who.textContent = n.slug === currentSlug ? "you're in this jam" : (n.dormant ? 'resting — nobody here' : `${n.clients || 1} playing`);
            const act = document.createElement('div'); act.className = 'tip-dim';
            act.textContent = `last active ${fmtAge(liveIdle(n, now))} ago`;
            const started = document.createElement('div'); started.className = 'tip-dim';
            started.textContent = `started ${fmtAge(n.ageMs || 0)} ago · ${n.evals || 0} evals`;
            tip.append(slugEl, who, act, started);
        }
        tip.hidden = false;
        // keep the tip on-screen
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.min(mx + 16, overlay.clientWidth - tw - 8) + 'px';
        tip.style.top  = Math.min(my + 16, overlay.clientHeight - th - 8) + 'px';
    });
    canvas.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });

    function show() {
        overlay.hidden = false; open = true;
        buildExamples();        // rebuild from the live example list each open (dynamic)
        resize();
        poll(); pollTimer = setInterval(poll, 2500);
        cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    }
    function hide() {
        overlay.hidden = true; open = false;
        if (tip) tip.hidden = true;
        clearInterval(pollTimer); cancelAnimationFrame(raf);
    }

    btn.onclick = () => (open ? hide() : show());
    if (closeBtn) closeBtn.onclick = hide;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
    window.addEventListener('resize', () => { if (open) resize(); });
}
