// Galaxy map (experimental) — a zoomable, pannable starfield of every live jam
// session. Each session is a glowing star placed on a stable phyllotaxis SPIRAL from
// the centre (so they never overlap and the map scales cleanly as more people join);
// its size tracks the peer count and its brightness fades as the jam goes quiet. The
// example library orbits as coloured nebulae. Scroll to zoom, drag to pan, click a
// star to join.
//
// Data comes from the collab server's PUBLIC /sessions endpoint (slugs + peer counts
// + idle time only — no eval code). Polled every couple of seconds.

import { collabHttpBase } from '../net/serverUrls.js';
import { exampleList }    from '../ui/docs.js';

function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
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
function starColor(n) {
    if (!n.dormant) return [63, 185, 80];
    const f = clamp(n.decayFrac || 0, 0, 1);
    return [Math.round(lerp(70, 116, f)), Math.round(lerp(170, 128, f)), Math.round(lerp(96, 156, f))];
}

// ── Layout constants (WORLD units — the camera scales them to screen) ──────────
const GOLDEN  = Math.PI * (3 - Math.sqrt(5));   // ~137.5° — the sunflower angle
const SP_JAM  = 46;                             // spiral spacing between adjacent jams
let   R_EX    = 360;                            // radius of the example-nebula ring (grows with cluster count)

export function initGalaxy(onPickExample) {
    const overlay  = document.getElementById('galaxy-overlay');
    const canvas   = document.getElementById('galaxy-canvas');
    const btn      = document.getElementById('btn-galaxy');
    const closeBtn = document.getElementById('galaxy-close');
    const empty    = document.getElementById('galaxy-empty');
    const tip      = document.getElementById('galaxy-tip');
    if (!overlay || !canvas || !btn) return;
    const ctx = canvas.getContext('2d');

    const _qs = new URLSearchParams(location.search);
    const currentSlug = _qs.get('session') || _qs.get('s') || _qs.get('') || null;

    let base = null;
    let nodes = new Map();                   // slug → jam node state
    let stars = [];                          // static background starfield (screen-space)
    let clusters = [];                       // example category clusters (world-space)
    let exNodes = [];                        // example stars (world-space)
    let raf = 0, pollTimer = 0, open = false;
    let W = 0, H = 0, DPR = 1;
    let _pollFails = 0, _pollErr = null;
    const _emptyDefault = empty ? empty.textContent : '';

    // ── Camera (world → screen) ────────────────────────────────────────────────
    const cam = { zoom: 1, x: 0, y: 0 };     // (x,y) is the world point at screen centre
    const w2sX = (wx) => W / 2 + (wx - cam.x) * cam.zoom;
    const w2sY = (wy) => H / 2 + (wy - cam.y) * cam.zoom;
    function fit() {
        let maxSlot = 0;
        for (const n of nodes.values()) if ((n.slot || 0) > maxSlot) maxSlot = n.slot;
        const jamR = SP_JAM * Math.sqrt(maxSlot + 1) + 40;
        const content = Math.max(R_EX + 80, jamR);
        cam.x = 0; cam.y = 0;
        cam.zoom = clamp((Math.min(W, H) / 2 * 0.92) / content, 0.12, 2);
    }
    function zoomBy(f) { cam.zoom = clamp(cam.zoom * f, 0.12, 4); }   // centre-anchored

    // ── Stable spiral slots — each live jam holds a unique slot for its lifetime, so
    //    existing jams never move when others join/leave, and none overlap. ───────
    const usedSlots = new Set();
    function allocSlot() { let s = 0; while (usedSlots.has(s)) s++; usedSlots.add(s); return s; }
    function freeSlot(s) { usedSlots.delete(s); }
    function place(n) {
        const th = n.slot * GOLDEN, r = SP_JAM * Math.sqrt(n.slot);
        n.wx = Math.cos(th) * r; n.wy = Math.sin(th) * r;
    }

    // ── Example clusters — a browsable nebula PER category, from exampleList(). ──
    function buildExamples() {
        const list = (() => { try { return exampleList() || []; } catch { return []; } })();
        const cats = [...new Set(list.map(e => e.cat || 'misc'))];
        clusters = cats.map((cat) => {
            const h = hash('cat:' + cat);
            return { cat, fx: (h % 1000) / 1000, fy: ((h >>> 10) % 1000) / 1000, hue: 188 + (h % 130) };
        });
        const byCat = new Map(clusters.map(c => [c.cat, c]));
        exNodes = list.map((e) => {
            const c = byCat.get(e.cat || 'misc');
            const h = hash('ex:' + e.id);
            return { isExample: true, exId: e.id, title: e.title, cat: e.cat, cl: c, hue: c.hue,
                h, phase: ((h >>> 9) % 628) / 100 };
        });
        placeExamples();
    }
    function placeExamples() {
        const n = clusters.length || 1;
        // Grow the ring with the cluster count so the ARC between neighbours stays
        // roughly constant — then nebulae don't overlap and stars stay in their cluster.
        R_EX = Math.max(360, 46 * n);
        const gap = (Math.PI * 2 / n) * R_EX;      // arc between adjacent cluster centres
        clusters.forEach((c, i) => {
            const ang = (i / n) * Math.PI * 2 + (c.fx - 0.5) * 0.18;   // even ring + slight jitter
            const rad = 0.97 + c.fy * 0.06;
            c.wx = Math.cos(ang) * R_EX * rad; c.wy = Math.sin(ang) * R_EX * rad;
        });
        for (const nd of exNodes) {
            const offAng = (nd.h % 628) / 100;
            const offRad = gap * (0.07 + (nd.h % 100) / 100 * 0.11);   // ≤18% of the gap → hugs its cluster
            nd.wx = nd.cl.wx + Math.cos(offAng) * offRad;
            nd.wy = nd.cl.wy + Math.sin(offAng) * offRad;
        }
        buildSprites();
    }

    // Per-cluster glow sprites (built once) — drawImage'd, scaled by zoom, per frame.
    function buildSprites() {
        for (const c of clusters) {
            const live = c.cat === 'Live sets';
            const NR = live ? 110 : 88;                // nebula sprite radius (world px) — sized to stay within its ring slot
            const ns = document.createElement('canvas'); ns.width = ns.height = NR * 2;
            const nc = ns.getContext('2d');
            const g = nc.createRadialGradient(NR, NR, 0, NR, NR, NR);
            g.addColorStop(0, `hsla(${c.hue},${live ? 78 : 60}%,${live ? 60 : 55}%,${live ? 0.14 : 0.08})`);
            g.addColorStop(1, `hsla(${c.hue},60%,55%,0)`);
            nc.fillStyle = g; nc.beginPath(); nc.arc(NR, NR, NR, 0, 7); nc.fill();
            c.nebSprite = ns; c.nebR = NR;
            const gr = live ? 15 : 9;
            const gs = document.createElement('canvas'); gs.width = gs.height = gr * 2;
            const gc = gs.getContext('2d');
            const g2 = gc.createRadialGradient(gr, gr, 0, gr, gr, gr);
            g2.addColorStop(0, `hsla(${c.hue},${live ? 88 : 75}%,${live ? 76 : 72}%,${live ? 0.68 : 0.5})`);
            g2.addColorStop(1, `hsla(${c.hue},75%,72%,0)`);
            gc.fillStyle = g2; gc.beginPath(); gc.arc(gr, gr, gr, 0, 7); gc.fill();
            c.glowSprite = gs; c.glowR = gr;
        }
    }

    // Drifting comets/asteroids — screen-space ambience.
    let comets = [], lastFrameT = 0;
    function makeComet(offscreen) {
        const ang = Math.random() * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
        const asteroid = Math.random() < 0.4;
        return { asteroid, dx, dy, spd: asteroid ? 0.004 + Math.random() * 0.004 : 0.010 + Math.random() * 0.012,
            x: offscreen ? (dx > 0 ? -50 : W + 50) : Math.random() * W, y: Math.random() * H,
            len: 26 + Math.random() * 46, size: asteroid ? 1.3 + Math.random() * 1.5 : 0.9 + Math.random() * 1.1 };
    }
    function initComets() { comets = Array.from({ length: 4 }, () => makeComet(false)); }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = overlay.clientWidth; H = overlay.clientHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        stars = Array.from({ length: Math.round(W * H / 9000) }, (_, i) => ({
            x: (hash('bg' + i) % 10000) / 10000 * W, y: (hash('by' + i) % 10000) / 10000 * H,
            r: 0.4 + (hash('br' + i) % 100) / 100 * 0.9, tw: (hash('bt' + i) % 628) / 100 }));
        initComets();
    }

    async function poll() {
        if (!base) base = await collabHttpBase();
        let data = null;
        try {
            const r = await fetch(`${base}/sessions`, { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            data = await r.json();
            if (!data || !Array.isArray(data.sessions)) throw new Error('bad payload');
        } catch (e) { data = null; _pollErr = e && e.message; }
        const t = performance.now();
        if (!data) {
            if (++_pollFails >= 2 && empty) {
                empty.textContent = "can't reach the jam server" + (_pollErr ? ` (${_pollErr})` : '') + ' — is the collab server running & proxied?';
                empty.style.display = '';
            }
            return;
        }
        _pollFails = 0;
        const seen = new Set();
        for (const s of data.sessions) {
            seen.add(s.slug);
            let n = nodes.get(s.slug);
            if (!n) { n = { slug: s.slug, phase: (hash(s.slug) % 628) / 100, alpha: 0, slot: allocSlot() }; place(n); nodes.set(s.slug, n); }
            n.clients = s.clients; n.dormant = !!s.dormant;
            n.idleBase = s.idleMs; n.idleAt = t;
            n.decayBase = s.decayMs || 0; n.decayAt = t; n.ttlMs = s.ttlMs || 600000;
            n.ageMs = s.ageMs; n.evals = s.evals; n.gone = false;
        }
        for (const [slug, n] of nodes) if (!seen.has(slug) && !n.gone) { n.gone = true; n.goneAt = t; }
        if (empty) { empty.textContent = _emptyDefault; empty.style.display = data.sessions.length ? 'none' : ''; }
    }

    function liveIdle(n, t) { return (n.idleBase || 0) + (t - (n.idleAt || t)); }

    let lastRender = 0, hovered = null;
    function draw(t) {
        raf = requestAnimationFrame(draw);
        if (t - lastRender < 32) return;      // ~30fps
        lastRender = t;
        ctx.clearRect(0, 0, W, H);

        // ambient starfield (screen-space backdrop)
        for (const s of stars) {
            ctx.globalAlpha = clamp(0.25 + Math.sin(t * 0.001 + s.tw) * 0.15, 0.08, 0.5);
            ctx.fillStyle = '#8b98b5'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // comets
        const dt = Math.min(64, lastFrameT ? t - lastFrameT : 16); lastFrameT = t;
        for (const c of comets) {
            c.x += c.dx * c.spd * dt; c.y += c.dy * c.spd * dt;
            if (c.x < -70 || c.x > W + 70 || c.y < -70 || c.y > H + 70) Object.assign(c, makeComet(true));
            if (c.asteroid) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#9aa6bf'; ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, 7); ctx.fill(); }
            else {
                const ex = c.x - c.dx * c.len, ey = c.y - c.dy * c.len;
                const g = ctx.createLinearGradient(c.x, c.y, ex, ey);
                g.addColorStop(0, 'rgba(200,220,255,0.5)'); g.addColorStop(1, 'rgba(200,220,255,0)');
                ctx.strokeStyle = g; ctx.lineWidth = c.size; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
                ctx.globalAlpha = 0.85; ctx.fillStyle = '#dce8ff'; ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, 7); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        const Z = cam.zoom;
        ctx.textAlign = 'center';
        // ── Example nebulae + labels (world → screen, culled) ──
        for (const c of clusters) {
            const sx = w2sX(c.wx), sy = w2sY(c.wy), nr = c.nebR * Z;
            if (sx + nr < 0 || sx - nr > W || sy + nr < 0 || sy - nr > H) continue;
            if (c.nebSprite) ctx.drawImage(c.nebSprite, sx - nr, sy - nr, nr * 2, nr * 2);
            if (Z >= 0.45) {
                const live = c.cat === 'Live sets';
                ctx.globalAlpha = clamp((Z - 0.4) * 1.4, 0, live ? 0.8 : 0.55);
                ctx.fillStyle = `hsl(${c.hue},${live ? 65 : 45}%,${live ? 78 : 72}%)`;
                ctx.font = `${live ? 'bold ' : ''}${Math.round(10 * clamp(Z, 0.7, 1.4))}px ui-monospace, monospace`;
                ctx.fillText((c.cat || '').toUpperCase(), sx, sy - nr * 0.62);
                ctx.globalAlpha = 1;
            }
        }
        // ── Example stars ──
        for (const n of exNodes) {
            const wx = n.wx + Math.sin(t * 0.0002 + n.phase) * 3, wy = n.wy + Math.cos(t * 0.00018 + n.phase) * 3;
            const sx = w2sX(wx), sy = w2sY(wy);
            n.x = sx; n.y = sy;
            if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) { n.hitR = 0; continue; }
            const c = n.cl, live = n.cat === 'Live sets';
            const pulse = live ? 1 + Math.sin(t * 0.004 + n.phase) * 0.3 : 1;
            const tw = (live ? 0.72 : 0.5) + Math.sin(t * 0.003 + n.phase) * 0.22;
            ctx.globalAlpha = clamp(tw, 0, live ? 0.95 : 0.72);
            const gr = c.glowR * Z;
            if (c.glowSprite) ctx.drawImage(c.glowSprite, sx - gr, sy - gr, gr * 2, gr * 2);
            ctx.fillStyle = `hsl(${n.hue},${live ? 92 : 82}%,${live ? 86 : 82}%)`;
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.3, (live ? 3.4 : 2.3) * Z) * pulse, 0, 7); ctx.fill();
            if (live) {
                const rl = (6 + Math.sin(t * 0.005 + n.phase) * 2) * clamp(Z, 0.5, 1.4);
                ctx.globalAlpha = clamp(tw * 0.6, 0, 0.7); ctx.strokeStyle = `hsl(${n.hue},92%,86%)`; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(sx - rl, sy); ctx.lineTo(sx + rl, sy); ctx.moveTo(sx, sy - rl); ctx.lineTo(sx, sy + rl); ctx.stroke();
            }
            n.hitR = Math.max(8, (live ? 14 : 12) * Z);
            ctx.globalAlpha = 1;
        }

        // ── Live jams (spiral, foreground highlight) ──
        // Label LOD: slugs appear at the fit view; the second detail line only when
        // zoomed in (or for your own / the hovered jam) — keeps dense views readable.
        const showLabels = Z >= 0.8 || nodes.size <= 14;
        const showDetail = Z >= 1.15;
        for (const [slug, n] of nodes) {
            const idle = liveIdle(n, t);
            let target;
            if (n.dormant) { const dm = (n.decayBase || 0) + (t - (n.decayAt || t)); target = clamp(1 - dm / (n.ttlMs || 600000), 0.05, 0.7); }
            else target = clamp(1 - idle / 90000, 0.18, 1);
            if (n.gone) target = clamp(1 - (t - n.goneAt) / 2000, 0, 1) * 0.1;
            n.alpha += (target - n.alpha) * 0.08;
            if (n.gone && n.alpha < 0.01) { freeSlot(n.slot); nodes.delete(slug); continue; }

            const drift = n.dormant ? 2 : 4;
            const wx = n.wx + Math.sin(t * 0.00025 + n.phase) * drift, wy = n.wy + Math.cos(t * 0.0002 + n.phase * 1.3) * drift;
            const sx = w2sX(wx), sy = w2sY(wy);
            n.x = sx; n.y = sy;
            const rW = 6 + Math.min(n.clients || 1, 10) * 2.0;
            const r = Math.max(2.5, rW * Z);
            if (sx + r * 3.2 < 0 || sx - r * 3.2 > W || sy + r * 3.2 < 0 || sy - r * 3.2 > H) { n.hitR = 0; continue; }

            const active = !n.dormant && idle < 2500;
            const twinkle = n.dormant ? 1 : 0.85 + Math.sin(t * 0.004 + n.phase) * 0.15;
            const a = n.alpha * twinkle;
            const isMine = n.slug === currentSlug;
            n.decayFrac = n.dormant ? clamp(((n.decayBase || 0) + (t - (n.decayAt || t))) / (n.ttlMs || 1), 0, 1) : 0;
            const gc = isMine ? [245, 200, 70] : starColor(n);
            if (isMine) n.alpha = Math.max(n.alpha, 0.9);

            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
            g.addColorStop(0, `rgba(${gc[0]},${gc[1]},${gc[2]},${0.55 * a})`);
            g.addColorStop(0.4, `rgba(${gc[0]},${gc[1]},${gc[2]},${0.18 * a})`);
            g.addColorStop(1, `rgba(${gc[0]},${gc[1]},${gc[2]},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 3.2, 0, 7); ctx.fill();

            if (isMine) {
                ctx.globalAlpha = clamp(0.55 * a, 0, 1); ctx.strokeStyle = '#f5c846'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(sx, sy, r + 6 + Math.sin(t * 0.003) * 2, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (active) {
                const pr = r + ((t * 0.05) % 22);
                ctx.globalAlpha = clamp((1 - (pr - r) / 22) * a, 0, 1);
                ctx.strokeStyle = isMine ? '#f5c846' : '#7ee787'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(sx, sy, pr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
            }
            ctx.globalAlpha = clamp(a, 0, 1);
            ctx.fillStyle = isMine ? '#ffe9a0' : (active ? '#b7f7c0' : `rgb(${gc[0]},${gc[1]},${gc[2]})`);
            ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, 7); ctx.fill();
            n.hitR = r * 3.2;

            if (showLabels || isMine || n === hovered) {
                ctx.globalAlpha = clamp(a + 0.15, 0, 1);
                ctx.fillStyle = isMine ? '#f5c846' : (n.dormant ? '#9aa5a5' : '#c9d1d9');
                ctx.font = `${isMine ? 'bold ' : ''}12px ui-monospace, Menlo, Consolas, monospace`;
                ctx.fillText(slug, sx, sy + r + 16);
                if (showDetail || isMine || n === hovered) {
                    ctx.fillStyle = isMine ? '#f5c846' : '#8b949e'; ctx.font = '10px ui-monospace, monospace';
                    ctx.fillText(isMine ? "you're here · click to close" : (n.dormant ? 'resting · click to revive' : `${n.clients || 1} ♪`), sx, sy + r + 29);
                }
            }
            ctx.globalAlpha = 1;
        }
    }

    function hitTest(px, py) {
        let best = null, bestD = Infinity;
        for (const n of nodes.values()) {
            if (n.gone || !n.hitR) continue;
            const d = Math.hypot(px - n.x, py - n.y);
            if (d < n.hitR && d < bestD) { bestD = d; best = n; }
        }
        if (best) return best;
        for (const n of exNodes) {
            if (!n.hitR) continue;
            const d = Math.hypot(px - n.x, py - n.y);
            if (d < n.hitR && d < bestD) { bestD = d; best = n; }
        }
        return best;
    }

    // ── Pan / zoom / click ──────────────────────────────────────────────────────
    let dragging = false, moved = false, lastX = 0, lastY = 0;
    canvas.addEventListener('mousedown', (e) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom;
        canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'default'; });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const wx = (mx - W / 2) / cam.zoom + cam.x, wy = (my - H / 2) / cam.zoom + cam.y;
        cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.12, 4);
        cam.x = wx - (mx - W / 2) / cam.zoom; cam.y = wy - (my - H / 2) / cam.zoom;
    }, { passive: false });

    canvas.addEventListener('click', (e) => {
        if (moved) { moved = false; return; }              // was a drag, not a click
        const rect = canvas.getBoundingClientRect();
        const n = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (!n) return;
        if (n.isExample) { onPickExample?.(n.exId); hide(); return; }
        if (n.slug === currentSlug) { hide(); return; }
        location.href = location.pathname + '?session=' + encodeURIComponent(n.slug);
    });
    canvas.addEventListener('mousemove', (e) => {
        if (dragging) { if (tip) tip.hidden = true; return; }
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const n = hitTest(mx, my);
        hovered = (n && !n.isExample) ? n : null;
        canvas.style.cursor = n ? 'pointer' : 'grab';
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
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.min(mx + 16, overlay.clientWidth - tw - 8) + 'px';
        tip.style.top  = Math.min(my + 16, overlay.clientHeight - th - 8) + 'px';
    });
    canvas.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; hovered = null; });

    // Zoom controls (created once, appended to the overlay — no HTML edits needed).
    let ctrls = null;
    function makeCtrls() {
        if (ctrls) return;
        ctrls = document.createElement('div');
        ctrls.style.cssText = 'position:absolute;right:14px;bottom:52px;display:flex;flex-direction:column;gap:6px;z-index:4;';
        for (const [z, label, title] of [['in', '+', 'zoom in'], ['out', '−', 'zoom out'], ['fit', '⌂', 'reset view']]) {
            const b = document.createElement('button');
            b.textContent = label; b.title = title; b.dataset.z = z;
            b.style.cssText = 'width:30px;height:30px;font:16px/1 ui-monospace,monospace;cursor:pointer;background:rgba(10,15,11,0.82);color:#c8f5d4;border:1px solid #1f4d2b;border-radius:6px;';
            ctrls.appendChild(b);
        }
        ctrls.addEventListener('click', (e) => {
            const z = e.target && e.target.dataset && e.target.dataset.z; if (!z) return;
            if (z === 'in') zoomBy(1.35); else if (z === 'out') zoomBy(1 / 1.35); else fit();
        });
        overlay.appendChild(ctrls);
    }

    function show() {
        overlay.hidden = false; open = true;
        buildExamples();
        resize();
        makeCtrls();
        fit();
        poll().then(fit);                     // refit once real jams arrive
        pollTimer = setInterval(poll, 2500);
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
