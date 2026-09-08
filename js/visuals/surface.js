// surface.js — run the visuals renderer on ANY canvas in the main window.
//
// The pop-out window (render/main.js) and the editor background (editorbg.js) were
// each carrying their own copy of the frame loop and of fxBundle(); the desktop's
// SCREEN panel would have made a third. This is the one copy: hand it a canvas and
// a clock and it drives the same GL renderer, reading the authoritative vlang
// snapshot and the live audio each frame.
//
// A surface also publishes each rendered frame to onFrame() subscribers, which is
// how panel backdrops work: ONE WebGL2 context renders, and every panel that wants
// the visuals behind it copies that canvas with drawImage. Browsers cap the number
// of live WebGL contexts, and a context per panel would be a lot of GPU for what is
// literally the same picture.

import { createGLRenderer } from './render/gl/renderer.js';
import { createWorkshopDeck } from './render/wsdeck.js';
import { snapshot }         from './vlang.js';
import { getVisualAudio }   from './bridge.js';
import { WORKSHOP_FX }     from './workshop/index.js';

// Post-FX bundle: the max of each FX key across all layers. The renderer takes one
// bundle for the whole frame, so two layers asking for different amounts of glitch
// resolve to the louder one.
export function fxBundle(layers) {
// A workshop layer's FX are applied per-layer, on its own canvas, by wsdeck.js. If
// they were counted here as well they would run TWICE — and for invert that means not
// at all, since inverting twice is the identity. So a key is skipped on a `ws` layer
// when the workshop implements it; anything the workshop does NOT have (trails, scan,
// fold, hueshift, pixelsort) still falls through to this global pass.
    const mx = (key, d = 0) => {
        let m = d;
        for (const l of layers) {
            if (l.ws && WORKSHOP_FX[key]) continue;
            const f = l.fx && l.fx[key];
            if (typeof f === 'number' && f > m) m = f;
            else if (f === true && m < 1) m = 1;
        }
        return m;
    };
    // The grade keys are neutral at 1 and the ceiling is a LIMIT, so neither follows
    // the "loudest intent wins from 0" rule the other keys use: a grade defaults to 1
    // and takes the furthest-from-neutral value, and two layers asking for different
    // ceilings resolve to the LOWER one, because a ceiling is a promise not to exceed.
    const grade = (key) => {
        let m = 1, best = 0;
        for (const l of layers) {
            const v = l.fx && l.fx[key];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            const d = Math.abs(v - 1);
            if (d > best) { best = d; m = v; }
        }
        return m;
    };
    const ceiling = () => {
        let m = 1;
        for (const l of layers) { const v = l.fx && l.fx.ceiling; if (typeof v === 'number' && v < m) m = v; }
        return m;
    };
    return {
        sat: grade('sat'), exposure: grade('exposure'), contrast: grade('contrast'), ceiling: ceiling(),
        trails: mx('trails'), feedback: mx('feedback'), glitch: mx('glitch'), scan: mx('scan'),
        vignette: mx('vignette'), invert: mx('invert') >= 1, blur: mx('blur'), bloom: mx('bloom'),
        posterize: mx('posterize'), droste: mx('droste'), fold: mx('fold'), hueshift: mx('hueshift'),
        dither: mx('dither'), pixelsort: mx('pixelsort'), mirror: mx('mirror'), edge: mx('edge'),
        pixelate: mx('pixelate'),
    };
}

// ── Room time ────────────────────────────────────────────────────────────────
// Workshop layers animate from `t`, and a machine-local `t` is the one thing that
// breaks visuals in a jam: two peers running the same line see the same scene at
// different PHASES, so a strobe flashes on different frames and a sweep is halfway
// round when yours is starting. The workshop hit this first and named it — its
// fxStack passes "room time, so every machine in a classroom flashes on the same
// frame instead of each running off its own wall clock".
//
// crashDot already has a shared clock: in a session the BEAT is synced. So workshop
// layers run on beats, converted to seconds at a 120bpm reference — monotonic (the
// beat is), identical on every peer (the beat is), and tempo-proportional, which for
// visuals driven by music is the behaviour you want anyway: take the set to 138 and
// the picture moves 15% faster with it.
//
// Field scenes keep wall time. They are pure functions of (u,v,t) evaluated in one
// shader, so their phase is already whatever `t` says and changing it would alter
// every existing set's look.
const BEAT_SECONDS = 60 / 120;

/**
 * @param {HTMLCanvasElement} canvas  where to render
 * @param {object} clock              the beat clock (resolves TimeVars/patterns)
 * @param {object} [opts]             fadeWhenIdle: hide the canvas when nothing runs
 */
export function createSurface(canvas, clock, { fadeWhenIdle = true } = {}) {
    let r = null, on = false, raf = 0;
    const aud = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: null };
    const subs = new Set();
    // Workshop layers draw on the CPU into a canvas per deck; the GL renderer takes
    // those as textures. Built lazily — a set with no workshop layers never makes one.
    let wsd = null;

    try { r = createGLRenderer(canvas); }
    catch (e) { console.warn('visual surface: WebGL2 unavailable —', e?.message || e); }

    function frame(ts) {
        if (!on) return;
        raf = requestAnimationFrame(frame);
        const t = ts / 1000;
        const beat = clock ? clock.now() : t;          // beat → resolves TimeVars/patterns
        const vst = snapshot(beat);
        if (!vst.layers.length) {
            if (fadeWhenIdle) canvas.style.opacity = '0';
            return;
        }
        canvas.style.opacity = '';                      // CSS owns the dim level
        const a = getVisualAudio();
        // Smooth the analyser a little so the picture breathes rather than flickers.
        aud.bass   += (a.bass   - aud.bass)   * 0.35;
        aud.mid    += (a.mid    - aud.mid)    * 0.35;
        aud.treble += (a.treble - aud.treble) * 0.35;
        aud.level  += (a.level  - aud.level)  * 0.35;
        aud.spectrum = a.spectrum;
        const ws = vst.layers.filter((l) => l.ws);
        if (ws.length) {
            if (!wsd) wsd = createWorkshopDeck();
            const { W, H } = r.size;
            const d = wsd.render(ws, W, H, beat * BEAT_SECONDS, aud);
            r.setWorkshop(d.a, d.b);
        } else if (wsd) { r.setWorkshop(null, null); }
        r.render(vst, t, aud, fxBundle(vst.layers));
        for (const cb of subs) { try { cb(canvas); } catch (_) {} }
    }

    return {
        ok:   () => !!r,
        isOn: () => on,
        canvas,
        start() {
            if (!r || on) return false;
            on = true;
            canvas.style.display = 'block';
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(frame);
            return true;
        },
        stop() {
            on = false;
            cancelAnimationFrame(raf);
            canvas.style.display = 'none';
        },
        toggle(v) { const next = v === undefined ? !on : !!v; next ? this.start() : this.stop(); return on; },
        // Called with the rendered canvas after every frame — see the note above.
        onFrame(cb) { subs.add(cb); return () => subs.delete(cb); },
        clear() { r?.clear?.(); },
        setResolution(s) { r?.setResolution?.(s); },
        // The renderer sizes itself from canvas.clientWidth, which is 0 while the
        // canvas is still detached — so a surface built before it is in the DOM
        // starts at the window's size. Call this once it is placed.
        resize() { r?.resize?.(); },
    };
}
