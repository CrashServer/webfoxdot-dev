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
import { fxBundle } from './fxbundle.js';
import { attachMapping } from './mapping.js';
import { V, AUD, S } from './state.js';
import { allowFrame, noteFrame } from './vperf.js';

const glCanvas = document.getElementById('visgl');
const canvas = document.getElementById('vis');
const ctx = canvas.getContext('2d');            // alpha:true → clearRect reveals the GL canvas beneath
const hud = document.getElementById('hud');

const glr = createGLRenderer(glCanvas);         // null if WebGL2 unavailable → CPU everywhere
if (!glr) console.warn('visuals: WebGL2 unavailable — falling back to the CPU renderer');

let W = 0, H = 0;
const grid = makeGrid(9);                        // CPU grid (glyph + fallback only)
const aud = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: AUD.spectrum };
let beatPulse = 0;
let lastClearSeq = 0;
let lastRes;                                     // last applied vres() scale
let overlayOpaque = true;                        // is the 2D canvas currently covering GL?
// The workshop deck — and with it 206 layer modules, 1.6MB — is imported the first
// time a workshop layer is used, so a set of field scenes never pays for it.
let wsd = null, wsdPending = false;
function wsDeck() {
    if (wsd || wsdPending) return wsd;
    wsdPending = true;
    import('./wsdeck.js')
        .then((m) => { wsd = m.createWorkshopDeck(); })
        .catch((e) => { console.warn('visuals: workshop layers failed to load —', e?.message || e); })
        .finally(() => { wsdPending = false; });
    return null;
}
// Workshop layers animate on the SHARED beat, not on this machine's clock — see
// surface.js. Same line on two peers means the same picture at the same phase.
const BEAT_SECONDS = 60 / 120;

function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = W; canvas.height = H;
    resizeGrid(grid, W, H);
    if (glr) glr.resize();
}
addEventListener('resize', resize); resize();

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
    setHud('idle  ·  no visual code running  ·  run a  video1 >>  line in the editor   ·   [f]ull  [c]lear  [w]arp');
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

// ── Projection mapping ───────────────────────────────────────────────────────
// Corner-pin warp + edge blending on this window — press [w], the same key an
// output window uses for the same gesture. Both canvases get the
// same transform: warp only #visgl and the glyph/idle overlay slides off the picture.
// It is machine-local by design (localStorage, never the vstate), because it describes
// where a projector sits in a room, not what the piece looks like.
// The frame loop rewrites the HUD every frame, so a message written from outside it
// is gone before it is read — which is what happened to the static [f]ull/[c]lear hint
// in visuals.html, and would have happened to this one. While mapping is open it OWNS
// the HUD; the loop stands off.
let mapMsg = null;
const mapping = attachMapping(document.body, [glCanvas, canvas], (msg) => {
    mapMsg = /off$/.test(msg) ? null : msg;
    // Writing "off" here would leave that word on screen until the next frame — and
    // "until the next frame" is not a promise this can make (a hidden tab, a throttled
    // rAF). Releasing the HUD is enough; the loop repaints it.
    if (mapMsg) hud.textContent = mapMsg;
});
const setHud = (txt) => { if (mapMsg == null) hud.textContent = txt; };

function loop(ts) {
    requestAnimationFrame(loop);
    if (!allowFrame(ts)) return;
    const t0 = performance.now();
    const t = ts / 1000;
    aud.bass += (AUD.bass - aud.bass) * 0.35; aud.mid += (AUD.mid - aud.mid) * 0.35;
    aud.treble += (AUD.treble - aud.treble) * 0.35; aud.level += (AUD.level - aud.level) * 0.35;
    aud.spectrum = AUD.spectrum;                          // FFT bins (unsmoothed) for the spectrum scenes
    beatPulse *= 0.85; if (S.beatPulse) { beatPulse = 1; S.beatPulse = false; }

    if (V.res !== lastRes) { lastRes = V.res; if (glr) glr.setResolution(V.res); }
    if (V.clearSeq !== lastClearSeq) { lastClearSeq = V.clearSeq; if (glr) glr.clear(); ctx.clearRect(0, 0, W, H); overlayOpaque = false; }

    if (V.layers.length) {
        const f = fxBundle(V.layers);
        const mode = V.mode || 'smooth';
        const isGlyph = !!RENDER_MODES[mode];        // glyph ramp → CPU; pixel/smooth → GPU
        if (glr && !isGlyph) {
            setOverlay(false);
            // Workshop layers are imperative RGBA draws — they render on the CPU into a
            // canvas per deck and reach the GPU as a texture. Nothing to do on the glyph
            // path: a glyph ramp is a function of a scalar field, which they are not.
            const ws = V.layers.filter((l) => l.ws);
            const dk = ws.length ? wsDeck() : null;
            if (dk) {
                const { W: gw, H: gh } = glr.size;
                // Room time — see surface.js. The pop-out window has no clock of its
                // own, but the bridge streams the beat, which is the shared one.
                const d = dk.render(ws, gw, gh, AUD.roomBeat * BEAT_SECONDS, aud, V.live);
                glr.setWorkshop(d.a, d.b);
            } else glr.setWorkshop(null, null);
            glr.render(V, t, aud, f);
        }
        else cpuFrame(t, f);
        setHud(hudText() + '   ·   [f]ull  [c]lear  [w]arp');
    } else {
        idle(t);
    }
    noteFrame(performance.now() - t0, ts);
}
requestAnimationFrame(loop);

// keys the mixer keeps: [f]ullscreen, [c]lear the feedback buffer
addEventListener('keydown', (e) => {
    if (e.key === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); }
    else if (e.key === 'c') { if (glr) glr.clear(); ctx.clearRect(0, 0, W, H); overlayOpaque = false; }
});
