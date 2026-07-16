// main.js — the renderer entry (visuals.html loads this). Sets up the canvas, runs one
// rAF loop, and wires the pieces: trails clear → composite (the 2-channel mixer) → draw
// (glyph|block) → post-fx. Idle screen when no visual code is running. Everything it
// touches is a small module; this file just orchestrates.

import { makeGrid, resizeGrid } from './grid.js';
import { composite } from './compositor.js';
import { draw } from './draw.js';
import * as fx from './postfx.js';
import { V, AUD, S } from './state.js';

const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');

let W = 0, H = 0;
const grid = makeGrid(9);                     // ~9px cells → fine enough for smooth, legible for glyphs
const aud = { bass: 0, mid: 0, treble: 0, level: 0 };   // smoothed copy for the scenes
let beatPulse = 0;

function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = W; canvas.height = H;      // 1:1 (no dpr) — keeps the glitch self-copy honest + fast
    resizeGrid(grid, W, H);
}
addEventListener('resize', resize); resize();

// The strongest value of an fx key across all live layers (fx are additive intents).
function maxFx(key, base = 0) {
    let m = base;
    for (const l of V.layers) { const f = l.fx && l.fx[key]; if (typeof f === 'number' && f > m) m = f; else if (f === true && m < 1) m = 1; }
    return m;
}

function hudText() {
    const names = V.layers.map((l) => l.name + (l.ch ? ':B' : ':A')).join(' ');
    const mixTxt = V.mix ? `  ·  mix ${V.mix.value.toFixed(2)}` : '';
    const palTxt = V.palette ? `  ·  ${V.palette}` : '';
    const modeTxt = V.mode ? `  ·  ${V.mode}` : '';
    return `live  ·  ${V.layers.length} layer${V.layers.length === 1 ? '' : 's'}  ·  ${names || '—'}${mixTxt}${palTxt}${modeTxt}  ·  ${AUD.bpm | 0} bpm`;
}

function idle(t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.7);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.12 + pulse * 0.10; ctx.fillStyle = '#63b982'; ctx.font = 'bold 30px monospace';
    ctx.fillText('▦ crashDot', W / 2, H / 2 - 12);
    ctx.globalAlpha = 0.09 + pulse * 0.06; ctx.fillStyle = '#8a97a0'; ctx.font = '13px monospace';
    ctx.fillText('run   v1 >> plasma()   ·   v2 >> tunnel(ch=1)   ·   v9 >> mix(0.5)', W / 2, H / 2 + 18);
    ctx.restore(); ctx.globalAlpha = 1;
    const waiting = performance.now() - S.lastMsg > 1500;
    ctx.beginPath(); ctx.arc(W - 16, 16, 5, 0, Math.PI * 2); ctx.fillStyle = waiting ? '#3a4750' : '#3fb950'; ctx.fill();
    hud.textContent = 'idle  ·  no visual code running  ·  run a  vN >>  line in the editor';
}

function loop(ts) {
    const t = ts / 1000;
    aud.bass += (AUD.bass - aud.bass) * 0.35; aud.mid += (AUD.mid - aud.mid) * 0.35;
    aud.treble += (AUD.treble - aud.treble) * 0.35; aud.level += (AUD.level - aud.level) * 0.35;
    beatPulse *= 0.85; if (S.beatPulse) { beatPulse = 1; S.beatPulse = false; }

    if (V.layers.length) {
        const trails = maxFx('trails', 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0,0,0,${0.10 + (1 - trails) * 0.90})`; ctx.fillRect(0, 0, W, H);   // trails = feedback
        composite(grid, V, t, aud);
        draw(ctx, grid, V.mode || 'smooth');   // default is the smooth (non-ASCII) look
        const g = maxFx('glitch', 0); if (g > 0.05) fx.glitch(ctx, W, H, g);
        if (maxFx('invert', 0) >= 1) fx.invert(ctx, W, H);
        const sc = maxFx('scan', 0); if (sc > 0.02) fx.scan(ctx, W, H, sc);
        const vg = maxFx('vignette', 0); if (vg > 0.02) fx.vignette(ctx, W, H, vg);
        hud.textContent = hudText();
    } else {
        idle(t);
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// fullscreen toggle — the one key the mixer keeps
addEventListener('keydown', (e) => {
    if (e.key === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); }
});
