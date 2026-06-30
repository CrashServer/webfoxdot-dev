// Visuals bridge — feeds the pop-out clift window from the main crashDot window.
//
// A pop-out window has its OWN event loop, so all rendering happens off crashDot's
// main thread — the audio clock is never starved. The only cost here is one
// AnalyserNode read + a small BroadcastChannel post ~30×/sec.
//
//   openVisuals()              → open (or focus) the visuals.html pop-up window
//   startVisualsAudio(sc,clock)→ tap scsynth output + start pushing audio/beat
//   postCode(text)             → push an evaluated line (code reactivity)

let _chan  = null;
let _win   = null;
let _sc    = null;
let _clock = null;
let _an    = null;
let _freq  = null;
let _timer = null;

function chan() {
    if (!_chan) _chan = new BroadcastChannel('crashdot-visuals');
    return _chan;
}

export function openVisuals() {
    if (_win && !_win.closed) { _win.focus(); return _win; }
    _win = window.open('visuals.html', 'crashdot-visuals',
                       'width=960,height=600,menubar=no,toolbar=no,location=no');
    chan();   // ensure the channel exists so posts reach the new window
    return _win;
}

// Tap the scsynth worklet output with an analyser (sc.node → analyser; the worklet
// stays connected to the destination too, so this only *reads* the signal).
export function startVisualsAudio(sc, clock) {
    _sc = sc; _clock = clock;
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
    chan().postMessage({
        t: 'audio',
        ..._bands(),
        bpm: _clock?.bpm ?? 120,
        beat: now,
        bar: Math.floor(now / 4),
    });
}

// Code reactivity — call when a line/block is evaluated.
export function postCode(text) {
    if (text && _chan) chan().postMessage({ t: 'code', text: String(text).slice(0, 2000) });
}
