// editorbg.js — run the WebGL2 visuals as a live BACKGROUND behind the code editor.
//
// Reuses the exact renderer the pop-out window uses, but in the MAIN window: it reads
// the authoritative vlang snapshot + the audio analyser directly each frame (no
// BroadcastChannel, no pop-out needed). Toggle with vbg() / Shift+Alt+B; the on/off
// state persists. When no video layers are running it fades the canvas out.

import { createGLRenderer } from './render/gl/renderer.js';
import { snapshot }       from './vlang.js';
import { getVisualAudio } from './bridge.js';

let _r = null, _canvas = null, _clock = null, _on = false, _raf = 0;
const _aud = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: null };

// Post-FX bundle: the max of each FX key across all layers (mirrors render/main.js).
function fxBundle(layers) {
    const mx = (key, d = 0) => {
        let m = d;
        for (const l of layers) { const f = l.fx && l.fx[key]; if (typeof f === 'number' && f > m) m = f; else if (f === true && m < 1) m = 1; }
        return m;
    };
    return {
        trails: mx('trails'), feedback: mx('feedback'), glitch: mx('glitch'), scan: mx('scan'),
        vignette: mx('vignette'), invert: mx('invert') >= 1, blur: mx('blur'), bloom: mx('bloom'),
        posterize: mx('posterize'), droste: mx('droste'), fold: mx('fold'), hueshift: mx('hueshift'),
        dither: mx('dither'), pixelsort: mx('pixelsort'), mirror: mx('mirror'), edge: mx('edge'), pixelate: mx('pixelate'),
    };
}

function frame(ts) {
    if (!_on) return;
    _raf = requestAnimationFrame(frame);
    const t = ts / 1000;
    const beat = _clock ? _clock.now() : t;               // clock beat → resolves TimeVars/patterns
    const vst = snapshot(beat);
    if (!vst.layers.length) { _canvas.style.opacity = '0'; return; }   // nothing running → fade out
    _canvas.style.opacity = '';                           // CSS controls the dim level
    const a = getVisualAudio();
    _aud.bass += (a.bass - _aud.bass) * 0.35; _aud.mid += (a.mid - _aud.mid) * 0.35;
    _aud.treble += (a.treble - _aud.treble) * 0.35; _aud.level += (a.level - _aud.level) * 0.35;
    _aud.spectrum = a.spectrum;
    _r.render(vst, t, _aud, fxBundle(vst.layers));
}

export function initEditorBg(canvas, clock) {
    _canvas = canvas; _clock = clock;
    try { _r = createGLRenderer(canvas); }
    catch (e) { console.warn('editor-bg: WebGL2 unavailable —', e?.message || e); _r = null; }
    if (_r && localStorage.getItem('crashdot-vizbg') === '1') setEditorBg(true);
}

export function setEditorBg(on) {
    if (!_r) return false;
    _on = !!on;
    document.body.classList.toggle('viz-bg', _on);
    _canvas.style.display = _on ? 'block' : 'none';
    try { localStorage.setItem('crashdot-vizbg', _on ? '1' : '0'); } catch {}
    cancelAnimationFrame(_raf);
    if (_on) _raf = requestAnimationFrame(frame);
    return _on;
}

export function toggleEditorBg() { return setEditorBg(!_on); }
export function editorBgOn()     { return _on; }
