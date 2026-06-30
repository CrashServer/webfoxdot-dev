// clift — compact ASCII visualiser for the crashDot pop-out window.
//
// Own window → own event loop, so it never competes with crashDot's audio clock.
// Listens on a BroadcastChannel for audio bands + beat + evaluated code + note
// attacks. Renders an ASCII grid + a stylised code overlay; the code you run picks,
// colours and triggers the scene. FPS-capped, auto-paused when hidden.

const cv  = document.getElementById('vis');
const ctx = cv.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');

const RAMP = ' .,:;-=+*o#%@';
const FPS  = 30;
const CELL = 13;
const SCENES = ['plasma', 'tunnel', 'spectrum', 'wave', 'grid', 'rain'];

// ── state ──────────────────────────────────────────────────────────────────────
const A = { bass: 0, mid: 0, treble: 0, level: 0, bpm: 120, beat: 0, bar: 0 };
const live = { player: '', synth: '', hue: 0.5, speed: 1, bright: 1 };
const codeLines = [];                  // {runs, born, len}  newest last
let cols = 0, rows = 0, W = 0, H = 0;
let scene = 0, auto = true;
let flash = 0, pulse = 0, beatPulse = 0;   // bar / attack / beat transients
let glitch = 0, bigFlash = 0, calm = 0;    // structural triggers
let lastBeat = -1;

function resize() {
    W = cv.width  = Math.floor(window.innerWidth);
    H = cv.height = Math.floor(window.innerHeight);
    cols = Math.max(8, Math.floor(W / (CELL * 0.62)));
    rows = Math.max(6, Math.floor(H / CELL));
    ctx.font = `${CELL}px monospace`;
    ctx.textBaseline = 'top';
}
window.addEventListener('resize', resize);
resize();

// ── code parsing ────────────────────────────────────────────────────────────────
const BASS = /bass|sub|303|tb|gesa|daft|pump|donk|moog|reese|wob/i;
const LEAD = /saw|blip|pluck|pad|key|prophet|cs80|piano|bell|choir|brass|organ|guit|fm|plaits|lead|sine|pulse|arp|karp|lapin/i;

function sceneFor(synth) {
    if (synth === 'play') return 'spectrum';
    if (!synth) return null;
    if (BASS.test(synth)) return 'tunnel';
    if (LEAD.test(synth)) return 'plasma';
    return 'rain';
}
// stable hue per player name → each player keeps a recognisable colour
function playerHue(n) {
    let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return (h % 360) / 360;
}

function tokenise(text) {
    const runs = []; const re = /(~?\s*[a-zA-Z_]\w*\s*>>)|([a-zA-Z_]\w*)|(-?\d+\.?\d*)|("[^"]*")|(\S)/g;
    let m;
    while ((m = re.exec(text))) {
        let cls = 'dim';
        if (m[1]) cls = 'player';
        else if (m[2]) cls = /^(play|loop|var|linvar|sinvar|expvar|pbuild|melody)$/.test(m[2]) ? 'fn'
                       : (LEAD.test(m[2]) || BASS.test(m[2])) ? 'synth' : 'word';
        else if (m[3]) cls = 'num';
        else if (m[4]) cls = 'str';
        runs.push({ s: m[0], cls });
    }
    return runs;
}
const TOKCOL = { player: '#39d8ff', synth: '#ffd23f', fn: '#7ee787', num: '#ff5fae', str: '#c08bff', word: '#a8b4be', dim: '#5a6a74' };

function onCode(text) {
    text = text.trim().split('\n').pop();
    if (!text || text.startsWith('#')) return;
    // structural triggers
    if (/\bchaos\s*\(/.test(text))                     glitch = 1.3;
    if (/\bdrop\s*\(/.test(text))                      { bigFlash = 1; if (auto) scene = (scene + 1) % SCENES.length; }
    if (/\.stop\s*\(|\bstopAll\b|\bunsolo\b/.test(text)) calm = 1;
    const pm = text.match(/^\s*~?\s*([a-zA-Z_]\w*)\s*>>\s*([a-zA-Z_]\w*)/);
    if (pm) { live.player = pm[1]; live.synth = pm[2]; }
    const p = {};
    for (const mm of text.matchAll(/([a-zA-Z_]\w*)\s*=\s*(-?\d+\.?\d*)/g)) p[mm[1]] = parseFloat(mm[2]);
    // hue: player identity, nudged by cutoff / oct
    live.hue = live.player ? playerHue(live.player) : (live.hue + 0.13) % 1;
    if (p.cutoff != null) live.hue = (live.hue + Math.min(0.5, p.cutoff / 18000)) % 1;
    else if (p.oct != null) live.hue = (live.hue + (p.oct % 8) / 16) % 1;
    if (p.amp != null) live.bright = 0.4 + Math.min(1.4, p.amp);
    if (p.dur != null) live.speed = 0.5 + (1 / Math.max(0.1, p.dur)) * 0.12;
    const s = sceneFor(live.synth);
    if (auto && s) scene = SCENES.indexOf(s);
    flash = 1; calm = Math.max(0, calm - 0.6);
    codeLines.push({ runs: tokenise(text), born: performance.now(), len: text.length });
    if (codeLines.length > 9) codeLines.shift();
}

// ── data in ───────────────────────────────────────────────────────────────────
const chan = new BroadcastChannel('crashdot-visuals');
const lerp = (a, b, k) => a + (b - a) * k;
chan.onmessage = (e) => {
    const m = e.data;
    if (m.t === 'audio') {
        A.bass = lerp(A.bass, m.bass, 0.5); A.mid = lerp(A.mid, m.mid, 0.5);
        A.treble = lerp(A.treble, m.treble, 0.5); A.level = lerp(A.level, m.level, 0.5);
        A.bpm = m.bpm; A.beat = m.beat;
        const fb = Math.floor(m.beat);
        if (fb !== lastBeat) { lastBeat = fb; beatPulse = 1; if (m.bar !== A.bar) { A.bar = m.bar; flash = 1; } }
    } else if (m.t === 'code') { onCode(m.text); }
    else if (m.t === 'step')   { pulse = 1; }
};

// ── keys ──────────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
    if (e.key === ' ')      { scene = (scene + 1) % SCENES.length; auto = false; }
    else if (e.key === 'a') { auto = !auto; }
    else if (e.key === 'g') { glitch = 1.3; }
    else if (e.key === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); }
});

function color(v) {
    const h = ((live.hue * 300) + 40 + v * 50) % 360;
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
        const curve = 0.5 + Math.sin(u * 12 + t * 3) * (0.12 + A.bass * 0.3)
                          + Math.sin(u * 30 - t * 5) * A.treble * 0.18;
        return Math.max(0, 1 - Math.abs(w - curve) * (9 - A.level * 4)) * (0.6 + A.level);
    }
    if (name === 'grid') {
        const on = (x % 3 === 0 && y % 3 === 0) ? 1 : 0;
        const ripple = Math.sin(r * 22 * z - t * 4 - A.bass * 8) * 0.5 + 0.5;
        return on * ripple * (0.5 + A.level * 1.6);
    }
    const col = Math.sin(x * 12.9898) * 43758.5453, seed = col - Math.floor(col);
    const head = (w + t * (0.2 + seed * 0.5 + A.level * 0.6)) % 1;
    return Math.max(0, 1 - Math.abs(w - ((seed + head) % 1)) * 8) * (0.4 + A.level);
}

// ── stylised code overlay ────────────────────────────────────────────────────────
function drawCode(ts) {
    if (!codeLines.length) return;
    const fs = Math.max(13, Math.round(H / 34));
    ctx.font = `bold ${fs}px monospace`; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
    const x0 = Math.round(W * 0.06), baseY = Math.round(H * 0.9);
    for (let i = codeLines.length - 1; i >= 0; i--) {
        const cl = codeLines[i], fromBottom = codeLines.length - 1 - i, age = (ts - cl.born) / 1000;
        const y = baseY - fromBottom * (fs * 1.5) - Math.min(age * 4, 8);
        const alpha = Math.max(0, 1 - fromBottom * 0.16 - Math.max(0, age - 8) * 0.25);
        if (alpha <= 0.02 || y < 0) continue;
        const reveal = fromBottom === 0 ? Math.min(cl.len, Math.ceil(age / 0.35 * cl.len)) : cl.len;
        ctx.globalAlpha = alpha;
        let cx = x0, shown = 0;
        for (const run of cl.runs) {
            let s = run.s;
            if (shown + s.length > reveal) s = s.slice(0, Math.max(0, reveal - shown));
            if (s) { ctx.fillStyle = TOKCOL[run.cls] || '#a8b4be'; ctx.fillText(s, cx, y); cx += ctx.measureText(run.s).width; }
            shown += run.s.length;
            if (shown >= reveal) break;
        }
        if (fromBottom === 0 && reveal < cl.len) {
            ctx.fillStyle = '#39d8ff'; ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(ts / 120)));
            ctx.fillText('▌', cx, y);
        }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.font = `${CELL}px monospace`; ctx.textBaseline = 'top';
}

// chaos → horizontal slice glitch (cheap self-blits)
function applyGlitch() {
    const slices = 3 + Math.floor(glitch * 4);
    for (let i = 0; i < slices; i++) {
        const sy = Math.random() * H, sh = 4 + Math.random() * (H * 0.08);
        const dx = (Math.random() - 0.5) * 80 * glitch;
        ctx.drawImage(cv, 0, sy, W, sh, dx, sy, W, sh);
    }
}

// ── render loop ──────────────────────────────────────────────────────────────────
let last = 0;
function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || ts - last < 1000 / FPS) return;
    last = ts;
    flash *= 0.82; pulse *= 0.8; beatPulse *= 0.78; glitch *= 0.9; bigFlash *= 0.86; calm *= 0.98;
    live.speed = lerp(live.speed, 1, 0.02);
    const t = ts / 1000 * live.speed;
    const name = SCENES[scene];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const useCode = name === 'rain' && codeLines.length;
    const flat = useCode ? codeLines[codeLines.length - 1].runs.map(r => r.s).join('') : '';
    const cw = W / cols, ch = H / rows;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const v = fieldVal(name, x, y, t);
            if (v <= 0.06) continue;
            let g = RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)))];
            if (useCode && g !== ' ' && flat.length) g = flat[(x + y * cols) % flat.length];
            if (g === ' ') continue;
            ctx.fillStyle = color(v);
            ctx.fillText(g, x * cw, y * ch);
        }
    }
    if (glitch > 0.05) applyGlitch();
    drawCode(ts);
    if (bigFlash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${bigFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    hud.textContent = `${name}  ·  ${A.bpm | 0} bpm  ·  ${live.player || '—'} ▸ ${live.synth || '—'}`
                    + `  ·  ${'▮'.repeat(Math.round(A.level * 10))}${auto ? '  · auto' : ''}`;
}
requestAnimationFrame(frame);
