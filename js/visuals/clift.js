// clift — automatic, reactive ASCII visualiser for the crashDot pop-out window.
//
// Runs in its own window (own event loop) so it never competes with the audio clock.
// It is an AUTOPILOT: it tracks musical energy + momentum (buildup/breakdown), picks
// pertinent scenes on musical moments, CROSSFADES between them, and evolves the FX,
// hue and speed smoothly — no keys needed. Keys are optional overrides.

const cv  = document.getElementById('vis');
const ctx = cv.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');

const RAMP = ' .,:;-=+*o#%@';
const FPS  = 30;
const CELL = 13;
const SCENES = ['plasma', 'tunnel', 'spectrum', 'wave', 'grid', 'rain',
                'aurora', 'cells', 'starfield', 'fire', 'ripple', 'interference',
                'helix', 'spiral', 'nebula', 'flow', 'lissajous', 'attractor'];
const POINT = new Set(['lissajous', 'attractor']);
const SCENE_HUE = { fire: 0.04, aurora: 0.42, nebula: 0.62 };
// energy-grouped pools — the director draws calm scenes when quiet, intense when loud
const CALM = ['nebula', 'aurora', 'flow', 'cells', 'wave', 'ripple', 'plasma'];
const HOT  = ['tunnel', 'spectrum', 'starfield', 'attractor', 'interference', 'spiral', 'fire', 'grid', 'lissajous'];

const lerp  = (a, b, k) => a + (b - a) * k;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// ── state ──────────────────────────────────────────────────────────────────────
const A = { bass: 0, mid: 0, treble: 0, level: 0, bpm: 120, beat: 0, bar: 0 };
const live = { player: '', synth: '', pool: null, bright: 1, speed: 1 };
let energy = 0, energyLong = 0, momentum = 0;     // musical structure
let scene = 0, nextScene = 0, mix = 1;            // mix<1 → crossfading scene→nextScene
let sceneStart = 0, auto = true;
let curHue = 0.5, hueTarget = 0.5;
let flash = 0, pulse = 0, beatPulse = 0, glitch = 0, bigFlash = 0, calm = 0, bpmFlash = 0;
let lastBeat = -1, editing = null;
const codeLines = [];
// Default is 'idle': no visual until you run visual code (vN layers). The audio
// autopilot ('scenes') and per-player 'code' view are opt-in via [a] / [m].
let mode = 'idle';                                // 'idle' | 'live' (vN layers) | 'scenes' (autopilot) | 'code' (per-player)
const vlayers = new Map();                        // name → { scene, params, fx, born } — authored vN >> layers
let lastMsgTs = 0;                                 // when the bridge last sent anything (connection status)
const meta = { section: '', autoplay: false };    // active #@ section + autoplay
let players = [];                                 // live snapshot from the bridge
const pmap = {};                                  // name → { step, pulse } for step flashes
let cols = 0, rows = 0, W = 0, H = 0, vgrad = null;
// post-FX as smoothed intensities (0..1), driven by the director (or keys when manual)
const fx  = { trails: 0, scan: 0, vignette: 0.2, invert: false, posterize: 0 };
const fxT = { trails: 0, scan: 0, vignette: 0.2 };

function resize() {
    W = cv.width  = Math.floor(window.innerWidth);
    H = cv.height = Math.floor(window.innerHeight);
    cols = Math.max(8, Math.floor(W / (CELL * 0.62)));
    rows = Math.max(6, Math.floor(H / CELL));
    ctx.font = `${CELL}px monospace`; ctx.textBaseline = 'top';
    vgrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)'); vgrad.addColorStop(1, 'rgba(0,0,0,1)');
}
window.addEventListener('resize', resize); resize();

// ── code parsing ────────────────────────────────────────────────────────────────
const BASS = /bass|sub|303|tb|gesa|daft|pump|donk|moog|reese|wob/i;
const LEAD = /saw|blip|pluck|pad|key|prophet|cs80|piano|basic|bell|choir|brass|organ|guit|fm|plaits|lead|sine|pulse|arp|karp|lapin/i;
function poolFor(synth) {
    if (!synth) return null;
    if (synth === 'play') return ['spectrum', 'grid', 'starfield', 'fire', 'rain'];
    if (BASS.test(synth)) return ['tunnel', 'spiral', 'helix', 'ripple', 'attractor'];
    if (LEAD.test(synth)) return ['plasma', 'interference', 'wave', 'aurora', 'cells', 'nebula', 'flow', 'lissajous'];
    return ['spectrum', 'grid', 'starfield', 'fire', 'rain'];
}
function playerHue(n) { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return (h % 360) / 360; }
function hexHue(hex) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return null;
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d === 0) return null;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (((h * 60) + 360) % 360) / 360;
}
const TOKCOL = { player: '#39d8ff', synth: '#ffd23f', fn: '#7ee787', num: '#ff5fae', str: '#c08bff', word: '#a8b4be', dim: '#5a6a74' };
function tokenise(text) {
    const runs = []; const re = /(~?\s*[a-zA-Z_]\w*\s*>>)|([a-zA-Z_]\w*)|(-?\d+\.?\d*)|("[^"]*")|(\S)/g; let m;
    while ((m = re.exec(text))) {
        let cls = 'dim';
        if (m[1]) cls = 'player';
        else if (m[2]) cls = /^(play|loop|var|linvar|sinvar|expvar|pbuild|melody)$/.test(m[2]) ? 'fn' : (LEAD.test(m[2]) || BASS.test(m[2])) ? 'synth' : 'word';
        else if (m[3]) cls = 'num'; else if (m[4]) cls = 'str';
        runs.push({ s: m[0], cls });
    }
    return runs;
}

function onCode(m) {
    let text = (m.text || '').trim().split('\n').pop();
    if (!text || text.startsWith('#')) return;
    // structural triggers (musical moments → visible events, smoothly resolved)
    if (/\bchaos\s*\(/.test(text))                       glitch = 1.3;
    if (/\bdrop\s*\(/.test(text))                        { bigFlash = 1; startTransition(pickScene(true)); }
    if (/\.stop\s*\(|\bstopAll\b|\bunsolo\b/.test(text)) calm = 1;
    const pm = text.match(/^\s*~?\s*([a-zA-Z_]\w*)\s*>>\s*([a-zA-Z_]\w*)/);
    if (pm) { live.player = pm[1]; live.synth = pm[2]; live.pool = poolFor(pm[2]); }
    const p = {};
    for (const mm of text.matchAll(/([a-zA-Z_]\w*)\s*=\s*(-?\d+\.?\d*)/g)) p[mm[1]] = parseFloat(mm[2]);
    const ah = hexHue(m.color);                       // author colour → scene hue
    hueTarget = ah != null ? ah : (live.player ? playerHue(live.player) : (hueTarget + 0.1) % 1);
    if (p.cutoff != null) hueTarget = (hueTarget + Math.min(0.4, p.cutoff / 18000)) % 1;
    else if (p.oct != null) hueTarget = (hueTarget + (p.oct % 8) / 16) % 1;
    if (p.amp != null) live.bright = 0.4 + Math.min(1.4, p.amp);
    if (p.dur != null) live.speed = 0.6 + (1 / Math.max(0.1, p.dur)) * 0.1;
    flash = 1; calm = Math.max(0, calm - 0.6);
    codeLines.push({ runs: tokenise(text), born: performance.now(), len: text.length, name: m.name || '', color: m.color || '' });
    if (codeLines.length > 9) codeLines.shift();
    // the code BIASES the director; the director still decides WHEN to switch (smooth)
}

// ── director ──────────────────────────────────────────────────────────────────────
function pickScene(force) {
    let names = energy > 0.45 ? HOT : energy > 0.18 ? HOT.concat(CALM) : CALM;
    if (live.pool) names = names.concat(live.pool, live.pool);   // weight the live synth's pool
    let idx, guard = 0;
    do { idx = SCENES.indexOf(names[Math.floor(Math.random() * names.length)]); }
    while (idx === scene && !force && ++guard < 8);
    return idx < 0 ? scene : idx;
}
function startTransition(idx) {
    if (idx === scene && mix >= 1) return;
    nextScene = idx; mix = 0;
}
function maybeSwitch(nowMs) {              // called on each new bar
    if (!auto || mix < 1) return;
    const dwell = nowMs - sceneStart;
    if (dwell < 3500) return;             // min dwell so it doesn't strobe
    const bigChange = Math.abs(momentum) > 0.13;
    if (bigChange || dwell > 13000 || Math.random() < 0.2) startTransition(pickScene(false));
}

// ── data in ───────────────────────────────────────────────────────────────────
const chan = new BroadcastChannel('crashdot-visuals');
chan.onmessage = (e) => {
    lastMsgTs = performance.now();
    const m = e.data;
    if (m.t === 'audio') {
        A.bass = lerp(A.bass, m.bass, 0.5); A.mid = lerp(A.mid, m.mid, 0.5);
        A.treble = lerp(A.treble, m.treble, 0.5); A.level = lerp(A.level, m.level, 0.5);
        energy = lerp(energy, m.level, 0.12); energyLong = lerp(energyLong, m.level, 0.012);
        momentum = energy - energyLong;
        if (Math.abs(m.bpm - A.bpm) >= 1) bpmFlash = 1;
        A.bpm = m.bpm; A.beat = m.beat;
        meta.section = m.section || ''; meta.autoplay = !!m.autoplay;
        const fb = Math.floor(m.beat);
        if (fb !== lastBeat) {
            lastBeat = fb; beatPulse = 1;
            if (m.bar !== A.bar) { A.bar = m.bar; flash = 1; maybeSwitch(performance.now()); }
        }
    } else if (m.t === 'code') { onCode(m); }
    else if (m.t === 'instant') { const x = (m.text || '').trim(); editing = x ? { runs: tokenise(x), name: m.name || '', color: m.color || '' } : null; }
    else if (m.t === 'step') { pulse = 1; }
    else if (m.t === 'vplayer') {      // authored visual layer — vN >> scene(...) + fx(...)
        const cur = vlayers.get(m.name) || { params: {}, fx: {} };
        vlayers.set(m.name, {
            scene:  m.scene || cur.scene || null,
            params: m.reset ? (m.params || {}) : { ...cur.params, ...(m.params || {}) },   // attrs inherit across evals (FoxDot-style); ~vN resets
            fx:     m.reset ? (m.fx || {})     : { ...cur.fx, ...(m.fx || {}) },
            born:   performance.now(),
        });
        mode = 'live';
    }
    else if (m.t === 'vstop')  { vlayers.delete(m.name); if (!vlayers.size && mode === 'live') mode = 'idle'; }
    else if (m.t === 'vclear') { vlayers.clear(); if (mode === 'live') mode = 'idle'; }
    else if (m.t === 'players') {
        players = m.list || [];
        for (const pl of players) { const s = pmap[pl.name] || (pmap[pl.name] = { step: -1, pulse: 0 }); if (pl.step !== s.step) { s.step = pl.step; s.pulse = 1; } }
    }
};

// ── keys (optional overrides; touching one drops out of auto) ────────────────────
addEventListener('keydown', (e) => {
    if (e.key === 'm') { const seq = ['idle', 'live', 'scenes', 'code']; mode = seq[(seq.indexOf(mode) + 1) % seq.length]; return; }
    if (e.key === 'a') { mode = 'scenes'; auto = true; return; }               // opt in to the audio autopilot
    if (e.key === ' ') { mode = 'scenes'; auto = false; startTransition((scene + 1) % SCENES.length); }
    else if (e.key === 'g') { glitch = 1.3; }
    else if (e.key === 't') { auto = false; fxT.trails = fxT.trails > 0.3 ? 0 : 0.85; }
    else if (e.key === 's') { auto = false; fxT.scan = fxT.scan > 0.3 ? 0 : 0.6; }
    else if (e.key === 'v') { auto = false; fxT.vignette = fxT.vignette > 0.3 ? 0 : 0.5; }
    else if (e.key === 'i') { fx.invert = !fx.invert; }
    else if (e.key === 'p') { fx.posterize = (fx.posterize + 1) % 4; }
    else if (e.key === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); }
});

function color(v) {
    const h = ((curHue * 300) + 40 + v * 50) % 360;
    const l = Math.min(80, 14 + v * 60 * live.bright * (1 - calm * 0.5) + flash * 14 + beatPulse * 12 + pulse * 10);
    return `hsl(${h.toFixed(0)} 88% ${l.toFixed(0)}%)`;
}

// ── scene fields → 0..1 per cell ────────────────────────────────────────────────
function fieldVal(name, x, y, t) {
    const u = x / cols, w = y / rows, cx = u - 0.5, cy = w - 0.5;
    const r = Math.hypot(cx, cy), ang = Math.atan2(cy, cx);
    const z = 1 + beatPulse * 0.35 + pulse * 0.3;
    if (name === 'plasma') {
        const v = Math.sin(u * 8 + t + A.bass * 6) + Math.sin(w * 7 - t + A.mid * 5)
                + Math.sin((u + w) * 6 + t * 0.7) + Math.sin(r * 18 - t * 2 + A.treble * 8);
        return (v / 4 + 0.5) * (0.4 + A.level * 1.2) * z;
    }
    if (name === 'tunnel') {
        const rings = Math.sin(r * 26 * z - t * 3 - A.bass * 10);
        const spokes = Math.sin(ang * (6 + Math.floor(A.treble * 10)) + t);
        return Math.max(0, rings * 0.6 + spokes * 0.4) * (0.5 + A.level * 1.5) * (1 - r);
    }
    if (name === 'spectrum') {
        const band = u < 0.33 ? A.bass : u < 0.66 ? A.mid : A.treble;
        const top = 1 - band * (0.9 + Math.sin(t * 4 + u * 20) * 0.1);
        return w > top ? 0.5 + (w - top) * 1.5 : 0;
    }
    if (name === 'wave') {
        const curve = 0.5 + Math.sin(u * 12 + t * 3) * (0.12 + A.bass * 0.3) + Math.sin(u * 30 - t * 5) * A.treble * 0.18;
        return Math.max(0, 1 - Math.abs(w - curve) * (9 - A.level * 4)) * (0.6 + A.level);
    }
    if (name === 'grid') {
        const on = (x % 3 === 0 && y % 3 === 0) ? 1 : 0;
        const ripple = Math.sin(r * 22 * z - t * 4 - A.bass * 8) * 0.5 + 0.5;
        return on * ripple * (0.5 + A.level * 1.6);
    }
    if (name === 'aurora') {
        const sway = Math.sin(w * 4 - t * 1.5 + u * 8) * 0.3;
        const v = Math.sin((u + sway) * 9 + t * 2 + A.treble * 5);
        return Math.max(0, v) * (1 - w * 0.5) * (0.45 + A.level) * (0.4 + A.mid);
    }
    if (name === 'cells') {
        let m1 = 9, m2 = 9;
        for (let i = 0; i < 5; i++) {
            const px = 0.5 + 0.42 * Math.sin(t * 0.5 + i * 1.3 + A.bass * 2);
            const py = 0.5 + 0.42 * Math.cos(t * 0.4 + i * 2.1 + A.mid * 2);
            const d = Math.hypot(u - px, w - py);
            if (d < m1) { m2 = m1; m1 = d; } else if (d < m2) m2 = d;
        }
        return Math.max(0, 1 - (m2 - m1) * 11) * (0.5 + A.level * 1.3);
    }
    if (name === 'starfield') {
        const a2 = Math.floor(ang / (Math.PI * 2) * 48);
        const seed = Math.sin(a2 * 127.1) * 43758.5, fr = seed - Math.floor(seed);
        const sr = (fr + t * (0.12 + A.level * 0.5)) % 1;
        return Math.max(0, 1 - Math.abs(r - sr) * 9) * (0.5 + A.bass * 1.5);
    }
    if (name === 'fire') {
        const flick = Math.sin(u * 22 + t * 6) * 0.18 + Math.sin(u * 7 - t * 9 + A.treble * 10) * 0.3;
        return Math.max(0, (1 - w) * (0.6 + A.level * 1.3) + flick - w * 0.35);
    }
    if (name === 'ripple') {
        const v = Math.sin(r * 30 - t * 5 - A.bass * 12) * 0.5 + 0.5;
        const ring = Math.max(0, 1 - Math.abs(r - (beatPulse * 0.6)) * 5) * beatPulse;
        return v * (0.3 + A.level) + ring * 0.5;
    }
    if (name === 'interference') {
        const d1 = Math.hypot(u - 0.3, w - 0.5), d2 = Math.hypot(u - 0.7, w - 0.5);
        const v = Math.sin(d1 * 40 - t * 4 + A.bass * 8) + Math.sin(d2 * 40 - t * 4 + A.mid * 8);
        return (v / 2 * 0.5 + 0.5) * (0.4 + A.level * 1.3);
    }
    if (name === 'helix') {
        const ph = w * 11 + t * 2;
        const s1 = 0.5 + Math.sin(ph) * 0.3 * (0.6 + A.bass), s2 = 0.5 + Math.sin(ph + Math.PI) * 0.3 * (0.6 + A.bass);
        const strand = Math.max(0, 1 - Math.min(Math.abs(u - s1), Math.abs(u - s2)) * 12);
        const rung = (Math.sin(ph) > 0.85 ? 1 : 0) * Math.max(0, 1 - Math.abs(u - 0.5) * 2.2);
        return (strand + rung * 0.5) * (0.6 + A.level);
    }
    if (name === 'spiral') {
        const arms = 3 + Math.floor(A.treble * 3);
        return Math.max(0, Math.sin(ang * arms + r * 18 * z - t * 2 + A.bass * 6)) * (0.4 + A.level * 1.4) * (1 - r * 0.4);
    }
    if (name === 'nebula') {
        const v = Math.sin(u * 5 + t * 0.3) * 0.5 + Math.sin((u * 11 - w * 9) + t * 0.5 + A.bass * 4) * 0.3
                + Math.sin((u * 23 + w * 19) - t * 0.8 + A.treble * 5) * 0.2;
        return Math.max(0, v * 0.5 + 0.5 - r * 0.3) * (0.4 + A.level * 1.3);
    }
    if (name === 'flow') {
        const fxw = u + 0.22 * Math.sin(w * 5 + t), fyw = w + 0.22 * Math.sin(u * 5 - t * 0.8);
        return Math.max(0, Math.sin(fxw * 11 + t) * Math.sin(fyw * 11 - t * 1.3 + A.mid * 5)) * (0.45 + A.level * 1.3);
    }
    const col = Math.sin(x * 12.9898) * 43758.5453, seed = col - Math.floor(col);
    const head = (w + t * (0.2 + seed * 0.5 + A.level * 0.6)) % 1;
    return Math.max(0, 1 - Math.abs(w - ((seed + head) % 1)) * 8) * (0.4 + A.level);
}

// ── render one scene (grid or plotted) at an alpha — used for crossfades ─────────
function renderScene(name, t, alpha) {
    ctx.globalAlpha = alpha;
    if (POINT.has(name)) {
        if (name === 'lissajous') {
            const a = 2 + Math.floor(A.bass * 5), b = 3 + Math.floor(A.treble * 5), N = 900;
            for (let i = 0; i < N; i++) {
                const th = i / N * Math.PI * 2;
                ctx.fillStyle = color(0.5 + 0.5 * Math.sin(th * 3 + t));
                ctx.fillText('•', (Math.sin(a * th + t) * 0.45 + 0.5) * W, (Math.sin(b * th) * 0.45 + 0.5) * H);
            }
        } else {
            const a = -2.1 + Math.sin(t * 0.3) + A.bass, b = -2.0 + Math.cos(t * 0.21), c = -1.2 + A.mid, d = 2.0 - A.treble;
            let xx = 0.1, yy = 0.1; const N = 1700;
            for (let i = 0; i < N; i++) {
                const nx = Math.sin(a * yy) - Math.cos(b * xx); yy = Math.sin(c * xx) - Math.cos(d * yy); xx = nx;
                ctx.fillStyle = color(0.35 + 0.65 * (i / N));
                ctx.fillText('·', (xx * 0.22 + 0.5) * W, (yy * 0.22 + 0.5) * H);
            }
        }
    } else {
        const useCode = name === 'rain' && codeLines.length;
        const flat = useCode ? codeLines[codeLines.length - 1].runs.map(r => r.s).join('') : '';
        const post = [0, 6, 4, 2][fx.posterize], cw = W / cols, ch = H / rows;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            let v = fieldVal(name, x, y, t); if (v <= 0.06) continue;
            if (post) v = Math.round(v * post) / post;
            let g = RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)))];
            if (useCode && g !== ' ' && flat.length) g = flat[(x + y * cols) % flat.length];
            if (g === ' ') continue;
            ctx.fillStyle = color(v); ctx.fillText(g, x * cw, y * ch);
        }
    }
    ctx.globalAlpha = 1;
}
function applyGlitch() {
    const slices = 3 + Math.floor(glitch * 4);
    for (let i = 0; i < slices; i++) {
        const sy = Math.random() * H, sh = 4 + Math.random() * (H * 0.08);
        ctx.drawImage(cv, 0, sy, W, sh, (Math.random() - 0.5) * 80 * glitch, sy, W, sh);
    }
}
function drawScanlines() { ctx.fillStyle = `rgba(0,0,0,${fx.scan * 0.45})`; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1); }

// ── stylised code overlay ────────────────────────────────────────────────────────
function drawCode(ts) {
    if (!codeLines.length && !editing) return;
    const fs = Math.max(13, Math.round(H / 34));
    ctx.font = `bold ${fs}px monospace`; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
    const x0 = Math.round(W * 0.06), editY = Math.round(H * 0.93), baseY = editing ? editY - fs * 1.6 : editY;
    for (let i = codeLines.length - 1; i >= 0; i--) {
        const cl = codeLines[i], fromBottom = codeLines.length - 1 - i, age = (ts - cl.born) / 1000;
        const y = baseY - fromBottom * (fs * 1.5) - Math.min(age * 4, 8);
        const alpha = Math.max(0, 1 - fromBottom * 0.16 - Math.max(0, age - 8) * 0.25);
        if (alpha <= 0.02 || y < 0) continue;
        const reveal = fromBottom === 0 ? Math.min(cl.len, Math.ceil(age / 0.35 * cl.len)) : cl.len;
        ctx.globalAlpha = alpha; let cx = x0;
        if (cl.name) { ctx.fillStyle = cl.color || '#39d8ff'; ctx.fillText(cl.name + ' ', cx, y); cx += ctx.measureText(cl.name + ' ').width; }
        let shown = 0;
        for (const run of cl.runs) {
            let s = run.s; if (shown + s.length > reveal) s = s.slice(0, Math.max(0, reveal - shown));
            if (s) { ctx.fillStyle = TOKCOL[run.cls] || '#a8b4be'; ctx.fillText(s, cx, y); cx += ctx.measureText(run.s).width; }
            shown += run.s.length; if (shown >= reveal) break;
        }
        if (fromBottom === 0 && reveal < cl.len) { ctx.fillStyle = '#39d8ff'; ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(ts / 120))); ctx.fillText('▌', cx, y); }
    }
    if (editing) {
        ctx.globalAlpha = 0.65; let cx = x0;
        ctx.fillStyle = editing.color || '#5a6a74'; ctx.fillText('› ', cx, editY); cx += ctx.measureText('› ').width;
        for (const run of editing.runs) { ctx.fillStyle = TOKCOL[run.cls] || '#a8b4be'; ctx.fillText(run.s, cx, editY); cx += ctx.measureText(run.s).width; }
        ctx.fillStyle = '#39d8ff'; ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(ts / 110)); ctx.fillText('▌', cx, editY);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.font = `${CELL}px monospace`; ctx.textBaseline = 'top';
}

// ── code-truthful mode: one panel per active player, reactive to its own code ────
function drawCodeMode(t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!players.length) {
        ctx.fillStyle = '#5a6a74'; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('code mode — run some players', W / 2, H / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `${CELL}px monospace`;
        return;
    }
    const n = players.length, gc = Math.ceil(Math.sqrt(n)), gr = Math.ceil(n / gc), cw = W / gc, ch = H / gr;
    for (let i = 0; i < n; i++) drawPlayerCell(players[i], (i % gc) * cw, Math.floor(i / gc) * ch, cw, ch, t);
}
function drawPlayerCell(pl, x, y, w, h, t) {
    const idHue = playerHue(pl.name);                 // player identity
    const octHue = (pl.oct * 0.08 + 0.55) % 1;        // octave → colour
    const pz = (pmap[pl.name] || {}).pulse || 0;      // step flash
    ctx.fillStyle = `hsl(${idHue * 360} 55% ${7 + pz * 10}%)`; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.lineWidth = 1.5 + pz * 4; ctx.strokeStyle = `hsl(${idHue * 360} 85% ${45 + pz * 30}%)`; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    // reactive wave: degree → frequency + vertical position, oct → hue/speed, amp → amplitude, step → pulse
    const freq = Math.abs(pl.deg || 0) + 1;
    const degOff = pl.deg == null ? 0 : -(pl.deg / 14);
    const midY = y + h * (0.55 + degOff * 0.3);
    const amp = h * 0.26 * (0.35 + pl.amp) * (1 + pz * 0.7);
    ctx.beginPath();
    for (let px = 3; px < w - 3; px += 3) {
        const yy = midY + Math.sin((px / w) * freq * 3.2 + t * (2 + pl.oct * 0.25)) * amp;
        px === 3 ? ctx.moveTo(x + px, yy) : ctx.lineTo(x + px, yy);
    }
    ctx.strokeStyle = `hsl(${octHue * 360} 90% ${58 + pz * 22}%)`; ctx.lineWidth = 2; ctx.stroke();
    // labels — the actual code state
    ctx.textBaseline = 'top';
    ctx.fillStyle = `hsl(${idHue * 360} 90% 72%)`; ctx.font = 'bold 14px monospace';
    ctx.fillText(`${pl.name} ▸ ${pl.synth}`, x + 8, y + 7);
    ctx.fillStyle = '#cdd6dd'; ctx.font = '12px monospace';
    ctx.fillText(`deg ${pl.deg == null ? '·' : Math.round(pl.deg)}   oct ${pl.oct}   amp ${pl.amp.toFixed(2)}`, x + 8, y + 25);
    // pattern strip — the sequence with the current step lit (synth: height = degree)
    if (h > 78 && pl.len > 0) {
        const len = Math.min(pl.len, 16), pos = pl.pos % len;
        const sw = (w - 16) / len, sy = y + h - 40;
        for (let i = 0; i < len; i++) {
            const on = i === pos;
            let ch = 6;
            if (pl.seq && pl.seq.length) ch = 4 + Math.min(15, Math.abs(pl.seq[i % pl.seq.length]) * 1.3);
            ctx.fillStyle = on ? `hsl(${octHue * 360} 90% ${66 + pz * 20}%)` : `hsl(${octHue * 360} 45% 26%)`;
            ctx.fillRect(x + 8 + i * sw, sy - ch, Math.max(2, sw - 2), ch);
        }
    }
    // fx tags — which effects are on this player
    const keys = Object.keys(pl.fx || {}); let fxx = x + 8; ctx.font = '11px monospace';
    for (const k of keys) {
        const tag = k + ' '; if (fxx + ctx.measureText(tag).width > x + w - 8) break;
        ctx.fillStyle = `hsl(${octHue * 360} 70% 62%)`; ctx.fillText(k, fxx, y + h - 20); fxx += ctx.measureText(tag).width;
    }
    ctx.font = `${CELL}px monospace`;
}

// ── live mode: authored vN >> layers, resolved against the beat & blended ────────
function sceneHue(n) { let h = 0; for (let i = 0; i < (n || '').length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return (h % 360) / 360; }
// A patterned param [a,b,c] advances one step every `dur` beats (like a FoxDot pattern).
function resolveParam(v, beat, dur) {
    if (Array.isArray(v)) { const d = dur || 1, i = Math.floor(beat / d), el = v[((i % v.length) + v.length) % v.length]; return Array.isArray(el) ? el[0] : el; }
    return v;
}
function layerColor(v, hue, bright) {
    const h = ((hue * 360) + v * 50) % 360;
    const l = Math.min(82, 12 + v * 62 * bright + beatPulse * 10 + pulse * 8 + flash * 8);
    return `hsl(${h.toFixed(0)} 88% ${l.toFixed(0)}%)`;
}
function renderLiveLayer(layer, tsSec, beat) {
    const name = layer.scene; if (!name) return;
    const p = layer.params || {}, f = layer.fx || {};
    const dur = Number(p.dur) || 1;
    let hue = resolveParam(p.hue, beat, dur);
    if (hue == null) hue = SCENE_HUE[name] != null ? SCENE_HUE[name] : sceneHue(name);
    hue = Number(hue); hue = hue > 1 ? (hue / 360) % 1 : ((hue % 1) + 1) % 1;
    const speed  = Number(resolveParam(p.speed,  beat, dur)) || 1;
    const bright = Number(resolveParam(p.bright, beat, dur)) || 1;
    const t = tsSec * speed * ((A.bpm || 120) / 120) * (0.6 + energy * 0.7);
    if (POINT.has(name)) {
        if (name === 'lissajous') {
            const a = 2 + Math.floor(A.bass * 5), b = 3 + Math.floor(A.treble * 5), N = 900;
            for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2; ctx.fillStyle = layerColor(0.5 + 0.5 * Math.sin(th * 3 + t), hue, bright); ctx.fillText('•', (Math.sin(a * th + t) * 0.45 + 0.5) * W, (Math.sin(b * th) * 0.45 + 0.5) * H); }
        } else {
            const a = -2.1 + Math.sin(t * 0.3) + A.bass, b = -2.0 + Math.cos(t * 0.21), c = -1.2 + A.mid, d = 2.0 - A.treble;
            let xx = 0.1, yy = 0.1; const N = 1700;
            for (let i = 0; i < N; i++) { const nx = Math.sin(a * yy) - Math.cos(b * xx); yy = Math.sin(c * xx) - Math.cos(d * yy); xx = nx; ctx.fillStyle = layerColor(0.35 + 0.65 * (i / N), hue, bright); ctx.fillText('·', (xx * 0.22 + 0.5) * W, (yy * 0.22 + 0.5) * H); }
        }
        return;
    }
    const post = Number(f.posterize) || 0, cw = W / cols, ch = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let v = fieldVal(name, x, y, t); if (v <= 0.06) continue;
        if (post) v = Math.round(v * post) / post;
        const g = RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)))];
        if (g === ' ') continue;
        ctx.fillStyle = layerColor(v, hue, bright); ctx.fillText(g, x * cw, y * ch);
    }
}
function renderLive(ts) {
    const tsSec = ts / 1000, beat = A.beat || 0;
    // post-FX are screen-wide: take the strongest value each frame across all layers
    let pTrails = 0, pScan = 0, pVig = 0.15, pInvert = false;
    for (const l of vlayers.values()) {
        const f = l.fx || {};
        if (f.trails > pTrails) pTrails = f.trails;
        if (f.scan > pScan) pScan = f.scan;
        if (f.vignette != null && f.vignette > pVig) pVig = f.vignette;
        if (f.glitch) glitch = Math.max(glitch, f.glitch);
        if (f.invert) pInvert = true;
    }
    ctx.fillStyle = `rgba(0,0,0,${0.06 + (1 - pTrails) * 0.94})`; ctx.fillRect(0, 0, W, H);   // trails → feedback
    if (!vlayers.size) {
        ctx.fillStyle = '#5a6a74'; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('live mode — write  v1 >> plasma()  in the editor', W / 2, H / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `${CELL}px monospace`;
    } else {
        ctx.globalCompositeOperation = 'lighter';                 // layers stack additively (glow)
        for (const l of vlayers.values()) renderLiveLayer(l, tsSec, beat);
        ctx.globalCompositeOperation = 'source-over';
    }
    if (glitch > 0.05) applyGlitch();
    if (pInvert) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (pScan > 0.02) { fx.scan = pScan; drawScanlines(); }
    if (pVig > 0.02 && vgrad) { ctx.globalAlpha = pVig; ctx.fillStyle = vgrad; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawCode(ts);
    drawTransport();
    drawStatus(ts);
    hud.textContent = `live  ·  ${vlayers.size} layer${vlayers.size === 1 ? '' : 's'}  ·  ${[...vlayers.keys()].join(' ') || '—'}  ·  ${A.bpm | 0} bpm  ·  [m] mode`;
}

// idle: no visual code running → (near-)black screen with a faint wordmark.
// "Without running code, there is no visual." A logo can replace this later.
function renderIdle(ts) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pulse = 0.5 + 0.5 * Math.sin(ts / 1500);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.11 + pulse * 0.10;
    ctx.fillStyle = '#63b982'; ctx.font = 'bold 30px monospace';
    ctx.fillText('▦ crashDot', W / 2, H / 2 - 12);
    ctx.globalAlpha = 0.09 + pulse * 0.06;
    ctx.fillStyle = '#8a97a0'; ctx.font = '13px monospace';
    ctx.fillText('run  v1 >> plasma()  in the editor to begin   ·   [a] autopilot', W / 2, H / 2 + 18);
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `${CELL}px monospace`;
    // just the connection dot (no "waiting" overlay — the blank screen is intentional)
    const waiting = ts - lastMsgTs > 1500;
    ctx.beginPath(); ctx.arc(W - 16, 16, 5, 0, Math.PI * 2);
    ctx.fillStyle = waiting ? '#3a4750' : '#3fb950'; ctx.fill();
    hud.textContent = 'idle  ·  no visual code running  ·  [m] mode  [a] autopilot';
}

// transport: active #@ section + a beat grid (bar phase) at the top — for performers
function drawTransport() {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    let y = 9;
    if (meta.section) {
        ctx.font = 'bold 13px monospace'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4;
        ctx.fillStyle = '#39d8ff'; ctx.fillText(`◈ ${meta.section}${meta.autoplay ? '  ▶ auto' : ''}`, W / 2, y);
        ctx.shadowBlur = 0; y += 19;
    }
    const bpb = 4, gap = 16, x0 = W / 2 - (bpb - 1) * gap / 2;
    const bib = ((Math.floor(A.beat) % bpb) + bpb) % bpb;
    for (let i = 0; i < bpb; i++) {
        ctx.beginPath(); ctx.arc(x0 + i * gap, y + 6, i === bib ? 4 + beatPulse * 2 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = i === bib ? `hsl(200 90% ${62 + beatPulse * 22}%)` : '#26323b'; ctx.fill();
    }
    ctx.fillStyle = '#5a6a74'; ctx.font = '10px monospace'; ctx.fillText(`bar ${A.bar}`, W / 2, y + 14);
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `${CELL}px monospace`;
}

// connection status: a corner dot, plus a centred hint while no data is arriving
function drawStatus(ts) {
    const waiting = ts - lastMsgTs > 1500;
    ctx.save();
    ctx.beginPath(); ctx.arc(W - 16, 16, 5, 0, Math.PI * 2);
    ctx.fillStyle = waiting ? '#e0a030' : '#3fb950';
    if (!waiting) { ctx.shadowColor = '#3fb950'; ctx.shadowBlur = 8; }
    ctx.fill(); ctx.shadowBlur = 0;
    if (waiting) {
        ctx.globalAlpha = 0.85; ctx.fillStyle = '#000'; ctx.fillRect(0, H / 2 - 34, W, 68);
        ctx.fillStyle = '#e0a030'; ctx.font = '18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('◌  waiting for crashDot', W / 2, H / 2 - 10);
        ctx.fillStyle = '#8a97a0'; ctx.font = '13px monospace';
        ctx.fillText('boot audio + run code in the main window', W / 2, H / 2 + 14);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `${CELL}px monospace`;
    }
    ctx.restore();
}

// ── render loop ──────────────────────────────────────────────────────────────────
let last = 0;
function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || ts - last < 1000 / FPS) return;
    const dt = Math.min(60, ts - last); last = ts;
    flash *= 0.82; pulse *= 0.8; beatPulse *= 0.78; glitch *= 0.9; bigFlash *= 0.86; calm *= 0.98; bpmFlash *= 0.9;
    for (const k in pmap) pmap[k].pulse *= 0.85;
    flash = Math.max(flash, bpmFlash);
    if (sceneStart === 0) sceneStart = ts;

    // idle: nothing running → blank (no autopilot unless opted in)
    if (mode === 'idle') { renderIdle(ts); return; }
    // live mode: authored vN >> visual layers, resolved & blended
    if (mode === 'live') { renderLive(ts); return; }
    // code-truthful mode: a panel per active player, driven by its own degree/oct/fx
    if (mode === 'code') {
        const tt = ts / 1000 * ((A.bpm || 120) / 120);
        drawCodeMode(tt);
        drawTransport();
        drawStatus(ts);
        hud.textContent = `code mode  ·  ${players.length} player${players.length === 1 ? '' : 's'}  ·  ${A.bpm | 0} bpm  ·  [m] scenes`;
        return;
    }
    // smooth hue toward target (or a scene's fixed hue)
    const sceneName = SCENES[mix < 1 ? nextScene : scene];
    const hTo = SCENE_HUE[sceneName] != null ? SCENE_HUE[sceneName] : hueTarget;
    curHue = curHue + (((hTo - curHue + 1.5) % 1) - 0.5) * 0.04;   // shortest-path hue lerp
    curHue = (curHue + 1) % 1;
    // auto FX targets from energy / momentum (calm → trails; loud → scanlines)
    if (auto) {
        fxT.trails   = clamp(0.1 + (1 - energy) * 0.45 + Math.max(0, -momentum) * 2.5);
        fxT.scan     = clamp(energy * 0.55);
        fxT.vignette = clamp(0.18 + (1 - energy) * 0.22);
    }
    fx.trails = lerp(fx.trails, fxT.trails, 0.03); fx.scan = lerp(fx.scan, fxT.scan, 0.04); fx.vignette = lerp(fx.vignette, fxT.vignette, 0.04);
    live.speed = lerp(live.speed, 1, 0.02);
    const t = ts / 1000 * live.speed * ((A.bpm || 120) / 120) * (0.6 + energy * 0.7);

    // clear (translucent when trails are up → smooth feedback)
    ctx.fillStyle = `rgba(0,0,0,${0.06 + (1 - fx.trails) * 0.94})`; ctx.fillRect(0, 0, W, H);

    if (mix < 1) {                                    // crossfade scene → nextScene
        mix = Math.min(1, mix + dt / 1100);
        renderScene(SCENES[scene], t, 1 - mix);
        renderScene(SCENES[nextScene], t, mix);
        if (mix >= 1) { scene = nextScene; sceneStart = ts; }
    } else {
        renderScene(SCENES[scene], t, 1);
    }

    if (glitch > 0.05) applyGlitch();
    if (fx.invert) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (fx.scan > 0.02) drawScanlines();
    if (fx.vignette > 0.02 && vgrad) { ctx.globalAlpha = fx.vignette; ctx.fillStyle = vgrad; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawCode(ts);
    if (bigFlash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${bigFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    drawTransport();
    drawStatus(ts);

    hud.textContent = `${SCENES[scene]}${mix < 1 ? '→' + SCENES[nextScene] : ''}  ·  ${A.bpm | 0} bpm  ·  `
                    + `${live.player || '—'} ▸ ${live.synth || '—'}  ·  e${(energy * 99) | 0} ${momentum > 0.03 ? '↑' : momentum < -0.03 ? '↓' : '·'}`
                    + `  ${auto ? 'auto' : 'manual'}`;
}
requestAnimationFrame(frame);
