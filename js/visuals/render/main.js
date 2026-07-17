// main.js — the renderer entry (visuals.html loads this). Two stacked canvases:
//   #visgl (WebGL2)  → pixel / smooth modes, rendered per-pixel at native resolution
//   #vis   (2D)      → glyph ramps, the idle screen, and the CPU fallback (no WebGL2)
// The 2D canvas sits on top and is transparent when the GPU path is showing; it paints
// opaque only when it owns the frame (glyph/idle/fallback), covering the GL canvas.
//
// One rAF loop: smooth audio → decide mode → GPU render OR CPU composite → HUD. The GPU
// path folds trails (FBO feedback) and post-fx into its two shader passes; the CPU path
// keeps the original compositor/draw/postfx. clear() wipes the GPU feedback buffer.

import { makeGrid, resizeGrid } from './grid.js';
import { composite } from './compositor.js';
import { draw } from './draw.js';
import * as fx from './postfx.js';
import { RENDER_MODES } from '../vdata.js';
import { createGLRenderer } from './gl/renderer.js';
import { V, AUD, S } from './state.js';

const glCanvas = document.getElementById('visgl');
const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');            // alpha:true → clearRect reveals the GL canvas beneath
const hud = document.getElementById('hud');

const glr = createGLRenderer(glCanvas);         // null if WebGL2 unavailable → CPU everywhere
if (!glr) console.warn('visuals: WebGL2 unavailable — falling back to the CPU renderer');

let W = 0, H = 0;
const grid = makeGrid(9);                        // CPU grid (glyph + fallback only)
const aud = { bass: 0, mid: 0, treble: 0, level: 0 };
let beatPulse = 0;
let lastClearSeq = 0;
let lastRes;                                     // last applied vres() scale
let overlayOpaque = true;                        // is the 2D canvas currently covering GL?

function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = W; canvas.height = H;
    resizeGrid(grid, W, H);
    if (glr) glr.resize();
}
addEventListener('resize', resize); resize();

// The strongest value of an fx key across all live layers (fx are additive intents).
function maxFx(key, base = 0) {
    let m = base;
    for (const l of V.layers) { const f = l.fx && l.fx[key]; if (typeof f === 'number' && f > m) m = f; else if (f === true && m < 1) m = 1; }
    return m;
}
function fxBundle() {
    return {
        trails: maxFx('trails', 0), feedback: maxFx('feedback', 0), glitch: maxFx('glitch', 0),
        scan: maxFx('scan', 0), vignette: maxFx('vignette', 0), invert: maxFx('invert', 0) >= 1,
        blur: maxFx('blur', 0), bloom: maxFx('bloom', 0), posterize: maxFx('posterize', 0),
        droste: maxFx('droste', 0), fold: maxFx('fold', 0), hueshift: maxFx('hueshift', 0), dither: maxFx('dither', 0),
    };
}

function hudText() {
    const names = V.layers.map((l) => l.name + (l.ch ? ':B' : ':A')).join(' ');
    const mixTxt = V.mix ? `  ·  mix ${V.mix.value.toFixed(2)}` : '';
    const palTxt = V.palette ? `  ·  ${V.palette}` : '';
    const modeTxt = V.mode ? `  ·  ${V.mode}` : '';
    const eng = glr ? `gpu ${glr.size.W}×${glr.size.H}` : 'cpu';
    return `live · ${eng} · ${V.layers.length} layer${V.layers.length === 1 ? '' : 's'} · ${names || '—'}${mixTxt}${palTxt}${modeTxt} · ${AUD.bpm | 0} bpm`;
}

// keep the 2D overlay transparent when the GPU owns the frame (only touch it on change)
function setOverlay(opaque) {
    if (opaque === overlayOpaque) return;
    overlayOpaque = opaque;
    if (!opaque) ctx.clearRect(0, 0, W, H);      // reveal the GL canvas beneath
}

function idle(t) {
    setOverlay(true);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.7);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.12 + pulse * 0.10; ctx.fillStyle = '#63b982'; ctx.font = 'bold 30px monospace';
    ctx.fillText('▦ crashDot', W / 2, H / 2 - 12);
    ctx.globalAlpha = 0.09 + pulse * 0.06; ctx.fillStyle = '#8a97a0'; ctx.font = '13px monospace';
    ctx.fillText('run   video1 >> plasma()   ·   video2 >> tunnel(ch=1)   ·   video9 >> mix(0.5)', W / 2, H / 2 + 18);
    ctx.restore(); ctx.globalAlpha = 1;
    const waiting = performance.now() - S.lastMsg > 1500;
    ctx.beginPath(); ctx.arc(W - 16, 16, 5, 0, Math.PI * 2); ctx.fillStyle = waiting ? '#3a4750' : '#3fb950'; ctx.fill();
    hud.textContent = 'idle  ·  no visual code running  ·  run a  video1 >>  line in the editor';
}

// CPU path — glyph render modes, or the whole pipeline when WebGL2 is missing.
function cpuFrame(t, f) {
    setOverlay(true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${0.10 + (1 - f.trails) * 0.90})`; ctx.fillRect(0, 0, W, H);   // trails = feedback
    composite(grid, V, t, aud);
    draw(ctx, grid, V.mode || 'smooth');
    if (f.glitch > 0.05) fx.glitch(ctx, W, H, f.glitch);
    if (f.invert) fx.invert(ctx, W, H);
    if (f.scan > 0.02) fx.scan(ctx, W, H, f.scan);
    if (f.vignette > 0.02) fx.vignette(ctx, W, H, f.vignette);
}

function loop(ts) {
    const t = ts / 1000;
    aud.bass += (AUD.bass - aud.bass) * 0.35; aud.mid += (AUD.mid - aud.mid) * 0.35;
    aud.treble += (AUD.treble - aud.treble) * 0.35; aud.level += (AUD.level - aud.level) * 0.35;
    beatPulse *= 0.85; if (S.beatPulse) { beatPulse = 1; S.beatPulse = false; }

    if (V.res !== lastRes) { lastRes = V.res; if (glr) glr.setResolution(V.res); }
    if (V.clearSeq !== lastClearSeq) { lastClearSeq = V.clearSeq; if (glr) glr.clear(); ctx.clearRect(0, 0, W, H); overlayOpaque = false; }

    if (V.layers.length) {
        const f = fxBundle();
        const mode = V.mode || 'smooth';
        const isGlyph = !!RENDER_MODES[mode];        // glyph ramp → CPU; pixel/smooth → GPU
        if (glr && !isGlyph) { setOverlay(false); glr.render(V, t, aud, f); }
        else cpuFrame(t, f);
        hud.textContent = hudText();
    } else {
        idle(t);
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// keys the mixer keeps: [f]ullscreen, [c]lear the feedback buffer
addEventListener('keydown', (e) => {
    if (e.key === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); }
    else if (e.key === 'c') { if (glr) glr.clear(); ctx.clearRect(0, 0, W, H); overlayOpaque = false; }
});
