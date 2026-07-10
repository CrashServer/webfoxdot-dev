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

let _chan  = null;
let _win   = null;
let _sc      = null;
let _clock   = null;
let _getMeta = null;      // () => { section, autoplay }
let _an    = null;
let _freq  = null;
let _timer = null;

function chan() {
    if (!_chan) _chan = new BroadcastChannel('crashdot-visuals');
    return _chan;
}

export function openVisuals() {
    if (_win && !_win.closed) { _win.focus(); return _win; }
    return _openWin();
}

// Open without stealing focus — used when a `vN >>` line auto-launches the window.
function ensureVisualsOpen() {
    if (_win && !_win.closed) return _win;
    return _openWin();
}
function _openWin() {
    _win = window.open('visuals.html', 'crashdot-visuals',
                       'width=960,height=600,menubar=no,toolbar=no,location=no');
    chan();   // ensure the channel exists so posts reach the new window
    return _win;
}

// ── Visual-language layers (vN >> scene(...)) ────────────────────────────────
// Post/update a visual layer. Auto-opens the window on the first layer (works
// because eval runs inside the Ctrl+Enter user gesture; blocked posts are silently
// dropped for remote/autoplay evals, and the user can open it with the ▦ button).
export function postVLayer(name, layer) {
    ensureVisualsOpen();
    chan().postMessage({ t: 'vplayer', name, ...layer });
}
export function postVStop(name)  { if (_chan) chan().postMessage({ t: 'vstop', name }); }
export function postVClear()     { if (_chan) chan().postMessage({ t: 'vclear' }); }

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

function _bands() {
    if (!_an) return { bass: 0, mid: 0, treble: 0, level: 0 };
    _an.getByteFrequencyData(_freq);
    const n = _freq.length;
    const avg = (a, b) => {
        let s = 0; const lo = a | 0, hi = b | 0;
        for (let i = lo; i < hi; i++) s += _freq[i];
        return hi > lo ? s / ((hi - lo) * 255) : 0;
    };
    return {
        bass:   avg(0,        n * 0.08),
        mid:    avg(n * 0.08, n * 0.40),
        treble: avg(n * 0.40, n),
        level:  avg(0,        n),
    };
}

function _tick() {
    if (!_chan) return;                     // nobody listening yet
    const now = _clock?.now?.() ?? 0;
    let meta = {};
    try { meta = _getMeta ? (_getMeta() || {}) : {}; } catch (_) {}
    chan().postMessage({
        t: 'audio',
        ..._bands(),
        bpm: _clock?.bpm ?? 120,
        beat: now,
        bar: Math.floor(now / 4),
        section: meta.section || '',
        autoplay: !!meta.autoplay,
    });
    chan().postMessage({ t: 'players', list: _snapshotPlayers() });
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
