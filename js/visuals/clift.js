// clift — compact ASCII visualiser for the crashDot pop-out window.
//
// Runs in its OWN window (own event loop) so it never competes with crashDot's
// audio clock. Listens on a BroadcastChannel for audio bands + beat + code, renders
// an ASCII grid on a canvas. FPS-capped and auto-paused when hidden. Deliberately
// tiny — the low-res ASCII look is cheap by design.

const cv  = document.getElementById('vis');
const ctx = cv.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');

const RAMP = ' .,:;-=+*o#%@';          // brightness → glyph
const FPS  = 30;
const CELL = 13;                       // px per cell (≈ font size) — bigger = cheaper

// ── live state, smoothed ──────────────────────────────────────────────────────
const A = { bass: 0, mid: 0, treble: 0, level: 0, bpm: 120, beat: 0, bar: 0 };
let codeText = '';
let cols = 0, rows = 0, W = 0, H = 0;
let scene = 0, auto = true, lastBar = 0, flash = 0;

const SCENES = ['plasma', 'tunnel', 'spectrum', 'rain'];

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

// ── data in ───────────────────────────────────────────────────────────────────
const chan = new BroadcastChannel('crashdot-visuals');
const lerp = (a, b, k) => a + (b - a) * k;
chan.onmessage = (e) => {
    const m = e.data;
    if (m.t === 'audio') {
        A.bass   = lerp(A.bass,   m.bass,   0.5);
        A.mid    = lerp(A.mid,    m.mid,    0.5);
        A.treble = lerp(A.treble, m.treble, 0.5);
        A.level  = lerp(A.level,  m.level,  0.5);
        A.bpm = m.bpm; A.beat = m.beat;
        if (m.bar !== A.bar) { A.bar = m.bar; flash = 1; if (auto && (m.bar % 4 === 0)) scene = (scene + 1) % SCENES.length; }
    } else if (m.t === 'code') {
        codeText = m.text || '';
    }
};

// ── keys ──────────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
    if (e.key === ' ')      { scene = (scene + 1) % SCENES.length; auto = false; }
    else if (e.key === 'a') { auto = !auto; }
    else if (e.key === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
});

// ── palette ───────────────────────────────────────────────────────────────────
// hue drifts with the bar; brightness from the cell value + beat flash.
function color(v, hueShift) {
    const h = (200 + hueShift * 80 + v * 60) % 360;
    const l = Math.min(72, 18 + v * 64 + flash * 22);
    return `hsl(${h.toFixed(0)} 85% ${l.toFixed(0)}%)`;
}

// ── scene field functions → value 0..1 per (x,y) cell ──────────────────────────
function field(name, x, y, t) {
    const u = x / cols, w = y / rows;
    const cx = u - 0.5, cy = w - 0.5;
    const r = Math.hypot(cx, cy);
    const ang = Math.atan2(cy, cx);
    if (name === 'plasma') {
        const v = Math.sin(u * 8 + t * 1.2 + A.bass * 6)
                + Math.sin(w * 7 - t + A.mid * 5)
                + Math.sin((u + w) * 6 + t * 0.7)
                + Math.sin(r * 18 - t * 2 + A.treble * 8);
        return (v / 4 + 0.5) * (0.4 + A.level * 1.2);
    }
    if (name === 'tunnel') {
        const rings = Math.sin(r * 26 - t * 3 - A.bass * 10);
        const spokes = Math.sin(ang * (6 + Math.floor(A.treble * 10)) + t);
        return Math.max(0, (rings * 0.6 + spokes * 0.4)) * (0.5 + A.level * 1.5) * (1 - r);
    }
    if (name === 'spectrum') {
        // mirrored bars: column height from a band, beat ripples upward
        const band = u < 0.33 ? A.bass : u < 0.66 ? A.mid : A.treble;
        const top = 1 - band * (0.9 + Math.sin(t * 4 + u * 20) * 0.1);
        return w > top ? (0.5 + (w - top) * 1.5) : 0;
    }
    // rain — falling code glyphs, density from level
    const col = Math.sin(x * 12.9898) * 43758.5453;
    const seed = col - Math.floor(col);
    const head = (w + t * (0.2 + seed * 0.5 + A.level * 0.6)) % 1;
    return Math.max(0, 1 - Math.abs(w - ((seed + head) % 1)) * 8) * (0.4 + A.level);
}

// ── render loop ────────────────────────────────────────────────────────────────
let last = 0;
function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || ts - last < 1000 / FPS) return;
    last = ts;
    flash *= 0.8;
    const t = ts / 1000;
    const name = SCENES[scene];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const hueShift = (A.bar % 8) / 8;
    const useCode = name === 'rain' && codeText.length;
    const cw = W / cols, ch = H / rows;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const v = field(name, x, y, t);
            if (v <= 0.06) continue;
            const gi = Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)));
            let g = RAMP[gi];
            if (useCode && g !== ' ') g = codeText[(x + y * cols) % codeText.length] || g;
            if (g === ' ') continue;
            ctx.fillStyle = color(v, hueShift);
            ctx.fillText(g, x * cw, y * ch);
        }
    }
    hud.textContent = `${name}  ·  ${A.bpm|0} bpm  ·  bar ${A.bar}  ·  `
                    + `bass ${'▮'.repeat(Math.round(A.bass*8))}`;
}
requestAnimationFrame(frame);
