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
const _controls   = new Set(); // control bindings — call onValue(0..1, cc) on each CC move
const _learnCtrlQ = [];        // control bindings armed for learn
let _onChange   = null;        // panel refresh hook

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export function midiSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

// Shared MIDIAccess so the output side (midiout.js) reuses one request/permission.
export function midiAccess() { return _access; }

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

// Note-input handler — set by onMidiNote(). fn(note, velocity0to1, isOn).
let _noteHandler = null;
export function onMidiNote(fn) { _noteHandler = fn; }

function _onMessage(ev) {
    const [status, d1, d2] = ev.data;
    const type = status & 0xf0;
    // Note on/off → the note-input handler (midiin). A note-on with velocity 0 is
    // the common "note off" encoding.
    if (type === 0x90 && d2 > 0) { _noteHandler?.(d1, d2 / 127, true);  return; }
    if (type === 0x80 || (type === 0x90 && d2 === 0)) { _noteHandler?.(d1, 0, false); return; }
    if (type !== 0xb0) return;                   // Control Change only (v1)
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
    if (_learnCtrlQ.length) for (const c of _learnCtrlQ.splice(0)) c.cc = cc;

    // Live-update every binding on this CC (one knob can be a macro).
    for (const b of _bindings) if (b.cc === cc) b._norm = value;
    // Control bindings fire their callback with the raw 0..1 value (e.g. mixer faders).
    for (const c of _controls) if (c.cc === cc) { try { c.onValue(value, cc); } catch (_) {} }

    _changed();
}

// A CONTROL binding — calls onValue(0..1, cc) each time its CC moves, for UI that
// reacts live (the mixer faders). cc == null arms MIDI learn (the next control touched).
export function midiControl(onValue, cc = null) {
    const c = { onValue, cc: cc == null ? null : cc | 0, isControl: true };
    _controls.add(c);
    if (c.cc == null) _learnCtrlQ.push(c);
    else if (_last.has(c.cc)) { try { onValue(_last.get(c.cc), c.cc); } catch (_) {} }
    return c;
}
export function clearMidiControl(c) {
    _controls.delete(c);
    const i = _learnCtrlQ.indexOf(c); if (i >= 0) _learnCtrlQ.splice(i, 1);
}

// Round for source output — a binding's bounds are typed numbers, not measurements.
const num = (v) => String(Math.round(Number(v) * 1000) / 1000);

// Response curves (4th arg to midi()/mlearn()): lin (default), exp (geometric,
// needs lo,hi>0), log, quad, cubic, sqrt, s (smoothstep). See curvePos below.
// Shape the normalized 0..1 position (linear mapping to [lo,hi] happens in shape()).
function curvePos(curve, n) {
    switch (curve) {
        case 'log':   return Math.log1p(n * (Math.E - 1));   // 0→0, 1→1, concave
        case 'quad':  return n * n;
        case 'cubic': return n * n * n;
        case 'sqrt':  return Math.sqrt(n);
        case 's':     return n * n * (3 - 2 * n);            // smoothstep
        default:      return n;                              // 'lin'
    }
}

// lo/hi map. 'exp' is geometric (multiplicative) — natural for filter cutoffs and
// frequency, but only valid when both ends are >0; on a 0-based range it falls back
// to 'quad' (ease-in), the closest single-curve approximation. Other curves shape
// the 0..1 position via curvePos, then map linearly into [lo,hi].
function shape(b) { return shapeValue(b.lo, b.hi, b.curve, b._norm); }

/**
 * Map a 0..1 position into [lo,hi] through a response curve. Exported because a
 * knob-shaped value is not a MIDI idea — an audio follower wants the same seven
 * curves for the same reason, and two copies of a curve table drift.
 */
export function shapeValue(lo, hi, curve, n) {
    if (curve === 'exp') {
        if (lo > 0 && hi > 0) return lo * Math.pow(hi / lo, n);
        return lo + (hi - lo) * (n * n);                    // ease-in fallback
    }
    return lo + (hi - lo) * curvePos(curve, n);
}

// Factory. cc == null arms MIDI learn (binds to the next control touched).
export function makeMidi(cc = null, lo = 0, hi = 1, curve = 'lin') {
    const b = {
        isMidi: true, isTimeVar: true,
        cc: (cc == null ? null : cc | 0),
        lo, hi, curve,
        _norm: 0.5,                              // start mid so a fresh patch isn't silent
        get() { return shape(this); },
        // What this binding would be if you had typed it. vsnap() and the panels write
        // this instead of the number it happens to read right now — freezing a live
        // control into a constant is the one thing "write it back as code" must not do.
        toCode() {
            const tail = (this.lo === 0 && this.hi === 1 && this.curve === 'lin') ? ''
                       : `${this.cc == null ? '' : ', '}${num(this.lo)}, ${num(this.hi)}`
                         + (this.curve === 'lin' ? '' : `, ${JSON.stringify(this.curve)}`);
            return this.cc == null ? `mlearn(${tail.replace(/^, /, '')})` : `midi(${this.cc}${tail})`;
        },
        /** Short label for a panel row — "midi cc7", or "learn…" while unbound. */
        label() { return this.cc == null ? 'learn\u2026' : 'midi cc' + this.cc; },
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
