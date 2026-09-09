// surface.js — run the visuals renderer on ANY canvas in the main window.
//
// The pop-out window (render/main.js) and the editor background (editorbg.js) were
// each carrying their own copy of the frame loop; the desktop's SCREEN panel would
// have made a third. This is the one copy: hand it a canvas and
// a clock and it drives the same GL renderer, reading the authoritative vlang
// snapshot and the live audio each frame.
//
// A surface also publishes each rendered frame to onFrame() subscribers, which is
// how panel backdrops work: ONE WebGL2 context renders, and every panel that wants
// the visuals behind it copies that canvas with drawImage. Browsers cap the number
// of live WebGL contexts, and a context per panel would be a lot of GPU for what is
// literally the same picture.

import { createGLRenderer } from './render/gl/renderer.js';
import { snapshot }         from './vlang.js';
import { getVisualAudio, sharedBeat } from './bridge.js';
import { allowFrame, noteFrame } from './render/vperf.js';
import { fxBundle } from './render/fxbundle.js';

// fxBundle moved to render/fxbundle.js — the pop-out window (render/main.js) is a
// separate document that needs it too, and importing THIS module to get it would
// drag vlang and the bridge along with it. Re-exported because callers already
// import it from here.
export { fxBundle } from './render/fxbundle.js';

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
//
// One correction to the story above: the beat was NOT in fact shared. clock.now() is a
// local counter started at boot, and beat_sync only ever repaired the tempo — so two
// peers ran the same layer on unrelated phases, which is precisely what this was meant
// to prevent. collab.js derives the room's beat properly now, and sharedBeat() is what
// that arrives through.
const BEAT_SECONDS = 60 / 120;

/**
 * @param {HTMLCanvasElement} canvas  where to render
 * @param {object} clock              the beat clock (resolves TimeVars/patterns)
 * @param {object} [opts]             fadeWhenIdle: hide the canvas when nothing runs
 */
// Anything that needs EVERY rendered frame — the output windows, chiefly — subscribes
// here rather than to one surface, because which surface is live depends on the UI mode
// (the SCREEN panel, the editor backdrop, the pop-out). Subscribers are called inside
// the render callback, which is the only place the GL canvas can be read: it is created
// with preserveDrawingBuffer:false, so after compositing it reads black.
const _frameSubs = new Set();
export function eachFrame(cb) { _frameSubs.add(cb); return () => _frameSubs.delete(cb); }

// The workshop deck of whichever surface last drew, or null if none is running. For
// readouts: the deck owns the per-layer cost numbers and nothing else can see them.
let _lastDeck = null;
export function liveDeck() { return _lastDeck; }

// Where the deck's one-shot notes go. Held here rather than set from index.html
// directly, because reaching wsdeck from there means IMPORTING wsdeck from there, and
// that pulls the 1.6MB layer registry into every audio-only session. This module
// already loads the deck on demand; the logger goes along for the ride.
let _deckLog = null;
export function setDeckLog(fn) { _deckLog = fn; }

// The canvas that most recently rendered a frame. Which surface is live depends on
// the UI mode, and a recorder has to point at the one actually drawing — asking here
// is more honest than making the caller guess between the SCREEN panel, the editor
// backdrop and the pop-out.
let _lastCanvas = null;
export function liveCanvas() { return _lastCanvas; }

export function createSurface(canvas, clock, { fadeWhenIdle = true } = {}) {
    let r = null, on = false, raf = 0;
    const aud = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: null };
    const subs = new Set();
    // Workshop layers draw on the CPU into a canvas per deck; the GL renderer takes
    // those as textures. The deck — and through it all 206 layer modules, 1.6MB — is
    // imported the first time one is actually used, so an audio-only session never
    // pays for it. The frame or two before it arrives simply has no workshop pixels.
    let wsd = null, wsdPending = false;
    function deck() {
        if (wsd || wsdPending) return wsd;
        wsdPending = true;
        import('./render/wsdeck.js')
            .then((m) => { if (_deckLog) m.setWorkshopLog(_deckLog); wsd = m.createWorkshopDeck(); })
            .catch((e) => { console.warn('visuals: workshop layers failed to load —', e?.message || e); })
            .finally(() => { wsdPending = false; });
        return null;
    }

    let lastRes;                                        // undefined ≠ null → applies once
    try { r = createGLRenderer(canvas); }
    catch (e) { console.warn('visual surface: WebGL2 unavailable —', e?.message || e); }

    function frame(ts) {
        if (!on) return;
        raf = requestAnimationFrame(frame);
        // The gate goes AFTER re-arming: a capped loop still rides real frame
        // boundaries, it just skips most of them. See vperf.js.
        if (!allowFrame(ts)) return;
        const t0 = performance.now();
        const t = ts / 1000;
        const beat = clock ? clock.now() : t;          // beat → resolves TimeVars/patterns
        const vst = snapshot(beat);
        if (!vst.layers.length) {
            if (fadeWhenIdle) canvas.style.opacity = '0';
            return;
        }
        canvas.style.opacity = '';                      // CSS owns the dim level
        // vres() had NO EFFECT here. setResolution existed on this surface and nothing
        // ever called it: the pop-out window applied V.res in its own loop, and the
        // in-page renderer — the SCREEN panel and the editor background, which is where
        // most people are looking — never did. The snapshot has carried `res` all
        // along; this is the line that reads it.
        if (vst.res !== lastRes) { lastRes = vst.res; r?.setResolution?.(vst.res); }
        const a = getVisualAudio();
        // Smooth the analyser a little so the picture breathes rather than flickers.
        aud.bass   += (a.bass   - aud.bass)   * 0.35;
        aud.mid    += (a.mid    - aud.mid)    * 0.35;
        aud.treble += (a.treble - aud.treble) * 0.35;
        aud.level  += (a.level  - aud.level)  * 0.35;
        aud.spectrum = a.spectrum;
        const ws = vst.layers.filter((l) => l.ws);
        const dk = ws.length ? deck() : null;
        if (dk) {
            const { W, H } = r.size;
            const d = dk.render(ws, W, H, sharedBeat(beat) * BEAT_SECONDS, aud, vst.live);
            r.setWorkshop(d.a, d.b);
        } else r.setWorkshop(null, null);
        r.render(vst, t, aud, fxBundle(vst.layers));
        for (const cb of subs) { try { cb(canvas); } catch (_) {} }
        _lastCanvas = canvas;
        for (const cb of _frameSubs) { try { cb(canvas, wsd); } catch (_) {} }
        _lastDeck = wsd;
        noteFrame(performance.now() - t0, ts);
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
