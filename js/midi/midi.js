// Web MIDI input → live control values.
//
// A midi() value is a {get()} object — the same shape as a TimeVar — so the
// player's per-step resolveArgs (patGet) samples it every beat. Turning a knob
// therefore sweeps ANY synth or FX param live:
//
//     p1 >> compkick()
//     p1.lpf = midi(74, 100, 8000)     # CC74 knob → filter cutoff
//     p2 >> saw([0,4,7], amp=midi(7))  # CC7 fader → amp
//
// mlearn(lo, hi) binds to the NEXT control you touch (MIDI learn). One knob can
// drive several params at once (a macro) — every bound object on that CC updates.
//
// Only Control-Change (CC) messages are handled in v1. Channel is ignored for
// routing (keyed by CC number — most controllers send on one channel) but kept
// for display.

let _access  = null;
let _enabled = false;
let _err     = null;
const _inputs   = new Map();   // id → name
const _last     = new Map();   // cc → 0..1   last value seen (seeds new bindings)
const _monitor  = new Map();   // cc → { value, channel, t }  recent activity (discovery)
const _bindings = new Set();   // live midi value objects — routing targets
const _learnQ   = [];          // bindings armed for learn, awaiting the next CC
let _onChange   = null;        // panel refresh hook

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export function midiSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export function onMidiChange(fn) { _onChange = fn; }
function _changed() { if (_onChange) _onChange(); }

// Snapshot for the panel.
export function midiState() {
    // Dedupe bindings by CC for display (a CC can drive several params).
    const byCc = new Map();
    for (const b of _bindings) {
        if (b.cc == null) continue;
        byCc.set(b.cc, { cc: b.cc, lo: b.lo, hi: b.hi, curve: b.curve, value: b.get(), norm: b._norm });
    }
    return {
        supported: midiSupported(),
        enabled:   _enabled,
        error:     _err,
        inputs:    [..._inputs.values()],
        learning:  _learnQ.length,
        monitor:   [..._monitor.entries()]
                       .map(([cc, m]) => ({ cc, ...m }))
                       .sort((a, b) => b.t - a.t),
        bindings:  [...byCc.values()].sort((a, b) => a.cc - b.cc),
    };
}

export async function enableMidi() {
    if (_enabled) return true;
    if (!midiSupported()) { _err = 'Web MIDI not supported (try Chromium/Edge)'; _changed(); throw new Error(_err); }
    try {
        _access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (e) {
        _err = 'MIDI access denied'; _changed(); throw new Error(_err);
    }
    _err = null;
    _bindInputs();
    _access.onstatechange = _bindInputs;
    _enabled = true;
    _changed();
    return true;
}

function _bindInputs() {
    _inputs.clear();
    for (const input of _access.inputs.values()) {
        _inputs.set(input.id, input.name || 'MIDI input');
        input.onmidimessage = _onMessage;
    }
    _changed();
}

function _onMessage(ev) {
    const [status, d1, d2] = ev.data;
    if ((status & 0xf0) !== 0xb0) return;        // Control Change only (v1)
    const channel = (status & 0x0f) + 1;
    const cc = d1;
    const value = d2 / 127;                       // 0..1

    _last.set(cc, value);
    _monitor.set(cc, { value, channel, t: now() });
    if (_monitor.size > 16) {                     // keep the monitor recent + short
        let oldKey = null, oldT = Infinity;
        for (const [k, m] of _monitor) if (m.t < oldT) { oldT = m.t; oldKey = k; }
        _monitor.delete(oldKey);
    }

    // MIDI learn: any armed bindings latch onto this CC.
    if (_learnQ.length) for (const b of _learnQ.splice(0)) b.cc = cc;

    // Live-update every binding on this CC (one knob can be a macro).
    for (const b of _bindings) if (b.cc === cc) b._norm = value;

    _changed();
}

// lo/hi map; curve 'exp' (lo>0) is geometric — natural for filter cutoffs.
function shape(b) {
    const n = b._norm;
    if (b.curve === 'exp' && b.lo > 0 && b.hi > 0) return b.lo * Math.pow(b.hi / b.lo, n);
    return b.lo + (b.hi - b.lo) * n;
}

// Factory. cc == null arms MIDI learn (binds to the next control touched).
export function makeMidi(cc = null, lo = 0, hi = 1, curve = 'lin') {
    const b = {
        isMidi: true, isTimeVar: true,
        cc: (cc == null ? null : cc | 0),
        lo, hi, curve,
        _norm: 0.5,                              // start mid so a fresh patch isn't silent
        get() { return shape(this); },
    };
    if (b.cc != null && _last.has(b.cc)) b._norm = _last.get(b.cc);
    _bindings.add(b);
    if (b.cc == null) _learnQ.push(b);
    // Re-evals create fresh objects; cap the set so it can't grow unbounded.
    if (_bindings.size > 64) _bindings.delete(_bindings.values().next().value);
    _changed();
    return b;
}

export function clearMidiBindings() {
    _bindings.clear();
    _learnQ.length = 0;
    _changed();
}
