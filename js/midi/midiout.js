// Web MIDI output — drive an external/virtual MIDI port from a player.
//
//     m1 >> midiout([0, 2, 4], channel=1, oct=5, dur=1)   # send notes out
//     m1 >> midiout([0, (0,4,7)], amp=0.9)                 # chords (groups)
//
// A midiout player schedules note-on/note-off with output.send(data, when),
// where `when` is a performance.now() timestamp — the SAME time domain the clock
// and beatToNTP() derive from — so MIDI notes line up sub-beat-accurate with the
// internal synths. Use a virtual port (IAC / loopMIDI / ALSA-JACK) to reach a DAW.
//
// Shares the single MIDIAccess obtained by midi.js (input side), so enabling
// either lights up both. Channel/velocity follow amp; sus/leg set note length.

import { enableMidi, midiAccess } from './midi.js';
import { attachModifiers, isGroup } from '../patterns/sequences.js';

const NOTE_ON = 0x90, NOTE_OFF = 0x80, CC = 0xb0;
const CC_ALL_SOUND_OFF = 120, CC_ALL_NOTES_OFF = 123;

let _outId = null;          // chosen output id (null → first available port)

export function midiOutSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

// Reuse midi.js's access request (also enables inputs — harmless, often wanted).
export async function enableMidiOut() { await enableMidi(); return true; }

function outputs() {
    const acc = midiAccess();
    return acc ? [...acc.outputs.values()] : [];
}

// Active output port: the selected one if still present, else the first.
function port() {
    const outs = outputs();
    if (!outs.length) return null;
    if (_outId) { const m = outs.find(o => o.id === _outId); if (m) return m; }
    return outs[0];
}

export function selectMidiOut(id) { _outId = id || null; }

// Snapshot for the panel.
export function midiOutState() {
    const outs = outputs();
    const active = port();
    return {
        supported: midiOutSupported(),
        outputs: outs.map(o => ({ id: o.id, name: o.name || 'MIDI output', active: o === active })),
        selected: _outId,
    };
}

const clampNote = n => Math.max(0, Math.min(127, Math.round(n)));
const clampVel  = v => Math.max(1, Math.min(127, Math.round(v)));
const chanNibble = c => (Math.max(1, Math.min(16, Math.round(c))) - 1) & 0x0f;

// Schedule one note: on at whenMs, off at whenMs+durMs (both performance.now()
// ms). The device buffers the timed messages, so timing is immune to JS jitter.
export function scheduleNote(note, vel, chan, whenMs, durMs) {
    const p = port();
    if (!p) return;
    const c = chanNibble(chan), n = clampNote(note), v = clampVel(vel);
    try {
        p.send([NOTE_ON  | c, n, v], whenMs);
        p.send([NOTE_OFF | c, n, 0], whenMs + Math.max(10, durMs));
    } catch (_) {}
}

// All-notes-off (+ all-sound-off) on the given channels (1..16), or all 16 when
// null. Used on stop so a held note whose scheduled note-off is far out is cut.
export function allNotesOff(channels = null) {
    const p = port();
    if (!p) return;
    const chans = channels ? [...channels] : Array.from({ length: 16 }, (_, i) => i + 1);
    for (const ch of chans) {
        const c = chanNibble(ch);
        try {
            p.send([CC | c, CC_ALL_NOTES_OFF, 0]);
            p.send([CC | c, CC_ALL_SOUND_OFF, 0]);
        } catch (_) {}
    }
}

// Hard panic: drop any queued (future-timestamped) messages, then silence every
// channel on every output. Wired into the soft-reload panic.
export function panicMidiOut() {
    for (const p of outputs()) {
        try { p.clear?.(); } catch (_) {}
        for (let c = 0; c < 16; c++) {
            try {
                p.send([CC | c, CC_ALL_NOTES_OFF, 0]);
                p.send([CC | c, CC_ALL_SOUND_OFF, 0]);
            } catch (_) {}
        }
    }
}

// ── MidiOutCall — returned by midiout(), detected in Player.__rshift__ ────────
// Mirrors SynthCall: a degree (or opts dict) plus chainable modifiers. Channel,
// velocity (amp), and note length (sus/leg) come from opts; groups make chords.
export class MidiOutCall {
    constructor(args) {
        this.args = args;
        this._modifiers = null; this._after = null; this._degreeAdds = null;
    }
    after(beats, method, ...args) { this._after = { beats, method, args }; return this; }
    every(beats, method, ...args) { (this._everys ??= []).push({ beats, method, args }); return this; }
    __add__(x) { (this._degreeAdds ??= []).push(x); return this; }
    degrade(prob = 0.5) { this._degrade = prob; return this; }
    solo(beats) { (this._calls ??= []).push(['solo', beats]); return this; }
    only(beats) { (this._calls ??= []).push(['only', beats]); return this; }
    stop(beats) { (this._calls ??= []).push(['stop', beats]); return this; }
}
attachModifiers(MidiOutCall);

// Factory for the `midiout` global. First arg is a degree (number/array/group/
// pattern) or, if a plain object, the opts dict.
export function makeMidiOut() {
    return function (degreeArg, opts = {}) {
        const isOptsObj = degreeArg !== null && typeof degreeArg === 'object'
            && !Array.isArray(degreeArg) && !isGroup(degreeArg)
            && typeof degreeArg.get !== 'function';
        const userArgs = isOptsObj ? { ...degreeArg } : { ...opts };
        if (!isOptsObj && degreeArg !== undefined) userArgs.degree = degreeArg;
        return new MidiOutCall(userArgs);
    };
}
