// editorbg.js — run the visuals as a live BACKGROUND behind the code editor.
//
// Toggle with vbg() / Shift+Alt+B; off every session, never automatic. The frame
// loop, the audio smoothing and the FX bundle all live in surface.js now — this is
// just the one surface that happens to sit behind the editor, plus the body class
// that dims the code over it.

import { createSurface } from './surface.js';

let _s = null, _canvas = null;

export function initEditorBg(canvas, clock) {
    _canvas = canvas;
    _s = createSurface(canvas, clock);
    if (!_s.ok()) console.warn('editor-bg: no WebGL2 — vbg() will be a no-op');
}

export function setEditorBg(on) {
    if (!_s?.ok()) return false;
    const now = _s.toggle(!!on);
    document.body.classList.toggle('viz-bg', now);
    if (!now && _canvas) _canvas.style.display = 'none';
    return now;
}

export function toggleEditorBg() { return setEditorBg(!editorBgOn()); }
export function editorBgOn()     { return !!_s?.isOn(); }

// The surface itself, so other UI (the desktop's panel backdrops) can mirror its
// frames instead of standing up a second WebGL context for the same picture.
export function editorBgSurface() { return _s; }
