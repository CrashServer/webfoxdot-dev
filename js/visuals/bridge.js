// Visuals bridge — feeds the pop-out clift window from the main crashDot window.
//
// A pop-out window has its OWN event loop, so all rendering happens off crashDot's
// main thread — the audio clock is never starved. The only cost here is one
// AnalyserNode read + a small BroadcastChannel post ~30×/sec.
//
//   openVisuals()              → open (or focus) the visuals.html pop-up window
//   startVisualsAudio(sc,clock)→ tap scsynth output + start pushing audio/beat
//   postCode(text)             → push an evaluated line (code reactivity)
//
// It also pushes a per-tick snapshot of every ACTIVE player (name, synth, current
// degree/oct/amp, FX values, step) for the code-truthful visualisation mode.

import { patGet, isGroup } from '../patterns/sequences.js';
import { FX_KEYS }         from '../fx/registry.js';
import { snapshot as vSnapshot, hasContent as vHasContent, setOpenHook, setWsOpenHook } from './vlang.js';
import { workshopSend }    from '../net/workshop-bridge.js';

let _chan  = null;
let _win   = null;
let _sc      = null;
let _clock   = null;
let _getMeta = null;      // () => { section, autoplay }
let _an    = null;
let _freq  = null;
let _timer = null;
let _vTimer = null;

function chan() {
    if (!_chan) _chan = new BroadcastChannel('crashdot-visuals');
    return _chan;
}

export function openVisuals() {
    if (_win && !_win.closed) { _win.focus(); return _win; }
    return _openWin('visuals.html');
}

// Open the VJ Workshop popup (same origin via /workshop/ route in serve.py).
// BroadcastChannel works natively — no relay needed when both are on port 8765.
let _wsWin = null;
export function openWorkshop() {
    if (_wsWin && !_wsWin.closed) { _wsWin.focus(); return _wsWin; }
    _wsWin = window.open('/workshop/', 'crashdot-workshop',
                         'width=1280,height=800,menubar=no,toolbar=no,location=no');
    return _wsWin;
}

// Told once, the first time visual code runs with nowhere obvious to look.
let _hinted = false, _hintFn = null;
export function setVisualHint(fn) { _hintFn = fn; }
function hintOnce() {
    if (_hinted) return null;
    _hinted = true;
    try { _hintFn && _hintFn(); } catch (_) {}
    return null;
}

// Open without stealing focus — kept for the explicit VISUALS route, not for evals.
export function ensureVisualsOpen() {
    if (_win && !_win.closed) return _win;
    return _openWin('visuals.html');
}

// Auto-open workshop when a WS scene is assigned.
export function ensureWorkshopOpen() {
    if (_wsWin && !_wsWin.closed) return _wsWin;
    return openWorkshop();
}

function _openWin(url) {
    _win = window.open(url, 'crashdot-visuals',
                       'width=960,height=600,menubar=no,toolbar=no,location=no');
    chan();   // ensure the channel exists so posts reach the new window
    return _win;
}

// ── Visual language (vN >> scene / mix) ──────────────────────────────────────
// The authoritative layer/mixer state lives in vlang.js (main window). Every ~33ms
// we resolve it against the audio clock (so patterns/TimeVars in params & the mix
// crossfader animate) and stream the plain-number snapshot to the renderer. Running
// off a clock reference means visual code works even before audio boots (beat = 0).
export function initVisuals(clock) {
    if (clock) _clock = _clock || clock;
    // A video line no longer opens a window by itself. It did when the pop-out WAS
    // the only place visuals could go; now there is the SCREEN panel on the desktop
    // and an explicit output manager for projectors, and a set that spawns a browser
    // window every time you evaluate a scene is a set that fights you. Where the
    // picture goes is a decision you make once, with output(), not a side effect of
    // running a line. Said once, so the first time is not a mystery.
    setOpenHook(hintOnce);
    setWsOpenHook(ensureWorkshopOpen);        // the w*() commands still drive /workshop/
    // Start the workshop tick even without audio so patterns animate over WS
    if (!_timer) _timer = setInterval(_tick, 33);
    if (_vTimer) return;
    let wasContent = false;
    _vTimer = setInterval(() => {
        if (!_win || _win.closed) return;
        const has = vHasContent();
        if (!has && !wasContent) return;     // idle and already idle → stay quiet
        wasContent = has;
        const beat = _clock ? _clock.now() : 0;
        chan().postMessage({ t: 'vstate', ...vSnapshot(beat) });
    }, 33);
}

// Tap the scsynth worklet output with an analyser (sc.node → analyser; the worklet
// stays connected to the destination too, so this only *reads* the signal).
export function startVisualsAudio(sc, clock, getMeta) {
    _sc = sc; _clock = clock; _getMeta = getMeta || null;
    try {
        const ac = sc.audioContext;
        _an = ac.createAnalyser();
        _an.fftSize = 1024;                 // 512 bins
        _an.smoothingTimeConstant = 0.6;
        sc.node.connect(_an);
        _freq = new Uint8Array(_an.frequencyBinCount);
    } catch (e) {
        console.warn('visuals: analyser tap failed —', e?.message || e);
    }
    if (!_timer) _timer = setInterval(_tick, 33);   // ~30 Hz
}

// Current audio bands + 32-bin spectrum straight from the analyser — for the
// in-editor background renderer, which runs in THIS window (no BroadcastChannel).
// The room's ears, injected by index.html once a session exists. Kept as hooks so
// the visuals never import the collab layer — they work identically offline.
let _shareAudio = null, _roomAudio = null;
export function setAudioShareHooks({ share = null, room = null } = {}) { _shareAudio = share; _roomAudio = room; }

// The room's beat number, when there is a room. clock.now() starts at 0 when THIS
// machine boots, so it is the wrong thing to animate a shared picture from — see
// roomBeat() in js/collab/collab.js.
let _roomBeat = null;
export function setRoomBeatHook(fn) { _roomBeat = fn; }
/** The beat every peer agrees on; falls back to the local one when solo. */
export function sharedBeat(localBeat) {
    if (!_roomBeat) return localBeat;
    try { const b = _roomBeat(); return b == null ? localBeat : b; } catch (_) { return localBeat; }
}

// How loud counts as "this machine is making the sound". Below it we are a listener,
// or a visuals-only machine, and the room's analysis is the better answer.
const HEARD = 0.012;
let _lastShare = 0;

/**
 * What the visuals react to. Your own ears when you have them, the room's when you do
 * not — so a peer running visuals with no audio booted still pulses with the set,
 * and a peer making sound reacts to its own output with no network in the path.
 */
export function getVisualAudio() {
    const local = _bands();
    if (local.level > HEARD) {
        // Publish at ~15Hz rather than every tick: the consumer smooths anyway, and
        // awareness updates go to every peer in the room.
        const now = Date.now();
        if (_shareAudio && now - _lastShare > 66) { _lastShare = now; try { _shareAudio(local); } catch (_) {} }
        return local;
    }
    if (_roomAudio) { const r = _roomAudio(); if (r) return r; }
    return local;
}

// 64, because that is what the WORKSHOP LAYERS were written against. 80 of the 206
// index the spectrum at 38, 48 and 50 to get their treble; at 32 bins those reads are
// undefined, `undefined + undefined` is NaN, and the NaN lands in an hsla() — ten
// layers threw outright and the rest quietly drew nothing, or drew intermittently.
// (The workshop's own FX registry loops i < 64 over it, which settles the question.)
// crashDot's shader still wants 32 and re-bins on the way in — see renderer.js.
const SPEC_BINS = 64;
function _bands() {
    if (!_an) return { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Array(SPEC_BINS).fill(0) };
    _an.getByteFrequencyData(_freq);
    const n = _freq.length;
    const avg = (a, b) => {
        let s = 0; const lo = a | 0, hi = b | 0;
        for (let i = lo; i < hi; i++) s += _freq[i];
        return hi > lo ? s / ((hi - lo) * 255) : 0;
    };
    // 32-bin spectrum for the FFT scenes — perceptual (square-law) bin edges give the
    // lows more resolution, and we ride the useful lower ~85% of the range.
    const spectrum = new Array(SPEC_BINS);
    const top = Math.floor(n * 0.85);
    for (let i = 0; i < SPEC_BINS; i++) {
        const f0 = Math.floor(Math.pow(i / SPEC_BINS, 2) * top);
        const f1 = Math.max(f0 + 1, Math.floor(Math.pow((i + 1) / SPEC_BINS, 2) * top));
        spectrum[i] = avg(f0, f1);
    }
    return {
        bass:   avg(0,        n * 0.08),
        mid:    avg(n * 0.08, n * 0.40),
        treble: avg(n * 0.40, n),
        level:  avg(0,        n),
        spectrum,
    };
}

function _tick() {
    const now = _clock?.now?.() ?? 0;
    let meta = {};
    try { meta = _getMeta ? (_getMeta() || {}) : {}; } catch (_) {}
    const audioMsg = {
        t: 'audio',
        // Room-aware, so a popped-out visuals window on a silent machine still reacts.
        ...getVisualAudio(),
        bpm: _clock?.bpm ?? 120,
        beat: now,
        // The pop-out window has no clock of its own and no session of its own, so the
        // shared beat has to be computed here and sent.
        roomBeat: sharedBeat(now),
        bar: Math.floor(now / 4),
        section: meta.section || '',
        autoplay: !!meta.autoplay,
    };

    // Workshop always gets audio + player data (no _chan dependency)
    workshopSend(audioMsg);
    workshopSend({ t: 'players', list: _snapshotPlayers() });

    // Local visuals BC only when someone is listening
    if (_chan) {
        chan().postMessage(audioMsg);
        chan().postMessage({ t: 'players', list: _snapshotPlayers() });
    }

    // The resolved workshop-layer params used to be mirrored to an external workshop
    // every tick, from back when a `video1 >> mandelbulb()` line was FORWARDED there
    // rather than rendered here. Those layers live in this app now, so mirroring them
    // was 30 messages a second describing a picture crashDot is already drawing. The
    // w*() commands still reach an external workshop, because those are things you
    // asked for; this was not.
}

// A live descriptor of every active player — for the code-truthful mode.
function _snapshotPlayers() {
    const cl = _clock;
    if (!cl || !cl._players) return [];
    const out = [];
    for (const [name, p] of cl._players) {
        if (!p._active) continue;
        const a = p._mode === 'synth' ? p._args
                : p._mode === 'sample' ? p._playOpts
                : p._mode === 'loop'   ? p._loopOpts
                : p._midiOpts;
        if (!a) continue;
        const at = (v) => isGroup(v) ? patGet(v.__group[0], p._step) : patGet(v, p._step);
        let deg = null;
        if (p._mode === 'synth' || p._mode === 'midiout') { const d = at(a.degree); deg = typeof d === 'number' ? d : null; }
        const fx = {};
        for (const k of Object.keys(a)) if (FX_KEYS.has(k)) { const v = at(a[k]); if (typeof v === 'number') fx[k] = v; }
        // pattern strip: the degree sequence (synth) or the play pattern length (sample)
        let len = 1, seq = null;
        if (Array.isArray(a.degree)) {
            len = a.degree.length || 1;
            seq = a.degree.slice(0, 16).map(d => { const x = isGroup(d) ? d.__group[0] : (Array.isArray(d) ? d[0] : d); const v = patGet(x, p._step); return typeof v === 'number' ? v : 0; });
        } else if (p._mode === 'sample' && p._pattern) {
            len = p._pattern.length || 1;
        }
        const pos = ((p._step % len) + len) % len;
        out.push({
            name, synth: p._mode === 'synth' ? p._synth : p._mode, step: p._step,
            deg, oct: Number(at(a.oct)) || 5, amp: Number(at(a.amp)) || 0.7, dur: Number(at(a.dur)) || 1, fx, len, pos, seq,
        });
    }
    return out;
}

// Code reactivity — call when a line/block is evaluated. name/color identify the
// author (self or a session peer) so the visuals can colour per performer.
export function postCode(text, name = '', color = '') {
    if (text && _chan) chan().postMessage({ t: 'code', text: String(text).slice(0, 2000), name, color });
}

// Instant code — the line currently under the cursor, streamed as you type/move
// (throttled). Shows a live "now editing" line in the visuals before you evaluate.
let _lastInstant = 0;
export function postInstant(text, line, name = '', color = '') {
    if (!_chan) return;
    const now = performance.now();
    if (now - _lastInstant < 80) return;       // ~12/s
    _lastInstant = now;
    chan().postMessage({ t: 'instant', text: String(text || '').slice(0, 200), line, name, color });
}

// Per-note attack — call from the step listener. Throttled so dense 16th-note
// patterns can't flood the channel; the visuals only need pulse triggers.
let _lastStep = 0;
export function postStep(name, step) {
    if (!_chan) return;
    const now = performance.now();
    if (now - _lastStep < 35) return;          // ~28/s cap
    _lastStep = now;
    _chan.postMessage({ t: 'step', name, step });
}
