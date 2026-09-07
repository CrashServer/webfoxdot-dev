// MIDI capture & export — record what actually PLAYS, then write a Standard MIDI
// File you can drop into a DAW and edit as notes.
//
//     midi_rec()                 # arm — every note from here on is captured
//     …play your set…
//     midi_rec()                 # disarm + save   (or: midi_save("myset"))
//
// Why capture rather than render the patterns offline: half of what makes a set is
// non-deterministic (PRand, {a b} picks, .degrade, chaos, a live nudge on a knob) and
// the other half only exists once you have run it. So this records the note stream the
// scheduler actually produces — what you HEARD is what lands in the file.
//
// One MIDI track per player, named after it. play() players are drums: their chars
// map to General MIDI percussion on channel 10. Everything else — synths and
// midiout() players alike — gets its own melodic channel.
//
// Timing is kept in BEATS and written as ticks, so notes land on the musical grid
// however loose the performance was. The file carries ONE tempo (the clock's bpm at
// export); a set that ramps its tempo still has every note on the right beat, it just
// plays back at a constant speed until you draw the ramp in the DAW.

const PPQ = 480;              // ticks per quarter note — 1/128th-note resolution

// ── char → General MIDI percussion ──────────────────────────────────────────
// The chars whose drum role is defined by play() (see js/engine/drumpatterns.js:
// X/x kick · o/O/*/u/H snare/clap · -/=/: hats · t/s/+/:/~/r/K perc) get their real
// GM note. Every other char is hashed into the GM percussion range, so a kit built
// from arbitrary sample chars still arrives as distinct, editable drum lanes
// instead of collapsing onto one note. Override with midi_map(char, note).
const GM_DRUM = {
    x: 36, X: 35,                        // bass drum (x punchy · X acoustic)
    o: 38, O: 40, u: 37, H: 40, '*': 39, // snare · electric snare · side stick · clap
    '-': 42, '=': 46, ':': 44,           // hi-hat closed · open · pedal
    '~': 51, '#': 49, '@': 55,           // ride · crash · splash
    t: 45, T: 47,                        // toms
    s: 70, S: 69,                        // shaker · cabasa
    '+': 75, r: 58, K: 62, k: 63,        // claves · vibraslap · congas
};
const _userDrum = {};        // midi_map() overrides

// Deterministic fallback: spread unknown chars over the GM percussion range
// (27–87) so two different chars almost never share a note.
function drumNote(char) {
    if (_userDrum[char] != null) return _userDrum[char];
    if (GM_DRUM[char] != null) return GM_DRUM[char];
    return 27 + (char.charCodeAt(0) * 7) % 61;
}

export function setDrumNote(char, note) {
    const c = String(char)[0];
    if (note == null) { delete _userDrum[c]; return null; }
    return (_userDrum[c] = Math.max(0, Math.min(127, Math.round(note))));
}

// The map actually in force, for the log line on export.
export function drumMapFor(chars) {
    return [...new Set(chars)].sort().map(c => `${c}→${drumNote(c)}`).join(' ');
}

// ── capture ─────────────────────────────────────────────────────────────────
// A mutable module object rather than a getter: player.js reads `.on` on every
// note, and a plain property read costs nothing when recording is off.
export const midiCapture = {
    on: false,
    _events: [],
    _startBeat: 0,
    _bpm: 120,

    // A pitched note. `beat` is absolute clock beats; dur is in beats.
    note(track, beat, dur, midi, vel) {
        if (!this.on) return;
        this._events.push({
            track, drum: false,
            beat: beat - this._startBeat,
            dur:  Math.max(1 / 32, dur),
            midi: Math.max(0, Math.min(127, Math.round(midi))),
            vel:  Math.max(1, Math.min(127, Math.round(vel))),
        });
    },

    // One play() hit. Drums get a short fixed length — a DAW draws a percussion
    // note as a marker, and a hat holding for its whole step reads as a mess.
    drum(track, beat, slot, char, vel) {
        if (!this.on) return;
        this._events.push({
            track, drum: true, char,
            beat: beat - this._startBeat,
            dur:  Math.min(0.25, Math.max(1 / 32, slot)),
            midi: drumNote(char),
            vel:  Math.max(1, Math.min(127, Math.round(vel))),
        });
    },
};

export function armMidiCapture(bpm, startBeat) {
    midiCapture._events = [];
    midiCapture._startBeat = startBeat;
    midiCapture._bpm = bpm;
    midiCapture.on = true;
}

export function midiCaptureArmed() { return midiCapture.on; }

// ── Standard MIDI File writer ───────────────────────────────────────────────
const str   = s => [...s].map(c => c.charCodeAt(0));
const u32   = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16   = n => [(n >>> 8) & 255, n & 255];

// Variable-length quantity — MIDI's 7-bits-per-byte delta-time encoding.
function vlq(n) {
    n = Math.max(0, Math.round(n));
    const out = [n & 0x7f];
    n >>>= 7;
    while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>>= 7; }
    return out;
}

function chunk(id, data) { return [...str(id), ...u32(data.length), ...data]; }

// Meta text event (FF type len text) — used for track names.
function metaText(type, text) {
    const t = str(String(text).slice(0, 127));
    return [0x00, 0xff, type, ...vlq(t.length), ...t];
}

// One pitch can only sound once at a time on one channel, so a note that is still
// held when the same pitch restarts has to be CLIPPED to the new onset — otherwise
// the first note-off silences the retrigger and the second is orphaned (a hung note
// in some DAWs). Quantising can also stack two hits on one tick; the louder wins.
function resolveOverlaps(notes) {
    const byPitch = new Map();
    for (const n of notes) {
        const prev = byPitch.get(n.midi);
        if (prev) {
            if (prev.tick === n.tick) {          // same tick, same pitch → one note
                prev.vel   = Math.max(prev.vel, n.vel);
                prev.ticks = Math.max(prev.ticks, n.ticks);
                n.drop = true;
                continue;
            }
            prev.ticks = Math.min(prev.ticks, n.tick - prev.tick);
        }
        byPitch.set(n.midi, n);
    }
    return notes.filter(n => !n.drop);
}

// Build one MTrk from note events already sorted and expressed in ticks.
function noteTrack(name, chan, notes) {
    const data = [...metaText(0x03, name)];
    // Explode into on/off points, then order by tick with note-OFF first: at a tick
    // where a note ends and the same pitch restarts, the off must land before the on
    // or the DAW eats the retrigger.
    const pts = [];
    for (const n of resolveOverlaps(notes)) {
        pts.push({ tick: n.tick, off: 0, midi: n.midi, vel: n.vel });
        pts.push({ tick: n.tick + Math.max(1, n.ticks), off: 1, midi: n.midi, vel: 0 });
    }
    pts.sort((a, b) => a.tick - b.tick || b.off - a.off || a.midi - b.midi);
    let last = 0;
    for (const p of pts) {
        data.push(...vlq(p.tick - last), (p.off ? 0x80 : 0x90) | (chan & 0x0f), p.midi, p.vel);
        last = p.tick;
    }
    data.push(0x00, 0xff, 0x2f, 0x00);   // end of track
    return chunk('MTrk', data);
}

// Track 0 (conductor): tempo + 4/4 time signature. A Type-1 file keeps the tempo
// map in its own track, which is what a DAW reads to place the grid.
function tempoTrack(bpm, name) {
    const uspq = Math.round(60000000 / bpm);
    const data = [
        ...metaText(0x03, name),
        0x00, 0xff, 0x51, 0x03, (uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255,
        0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8,          // 4/4, 24 clocks/click
        0x00, 0xff, 0x2f, 0x00,
    ];
    return chunk('MTrk', data);
}

/**
 * Render captured events to a Standard MIDI File (format 1).
 * @param {object} opts
 *   events   – [{track, drum, beat, dur, midi, vel}]
 *   bpm      – tempo written into the file
 *   name     – conductor-track name
 *   quantize – snap onsets to this grid in beats (0.25 = 16ths); 0/undefined = off
 * @returns {{ bytes: Uint8Array, tracks: string[] }}
 */
export function buildMidiFile({ events, bpm = 120, name = 'crashDot', quantize = 0 } = {}) {
    if (!events || !events.length) return null;

    // Group by player, keeping the order each player first appears in.
    const byTrack = new Map();
    for (const e of events) {
        if (!byTrack.has(e.track)) byTrack.set(e.track, { drum: e.drum, notes: [] });
        const t = byTrack.get(e.track);
        t.drum = t.drum && e.drum;          // one pitched note makes the track melodic
        t.notes.push(e);
    }

    // Channels: drums own 10 (index 9); melodic players take the rest in order.
    let nextChan = 0;
    const chanFor = (isDrum) => {
        if (isDrum) return 9;
        if (nextChan === 9) nextChan++;      // 10 is reserved for percussion
        return Math.min(15, nextChan++);
    };

    const snap = quantize > 0 ? quantize : 0;
    const tracks = [tempoTrack(bpm, name)];
    const names  = [];
    for (const [track, t] of byTrack) {
        const chan = chanFor(t.drum);
        const notes = t.notes.map(e => {
            const beat = snap ? Math.round(e.beat / snap) * snap : e.beat;
            return { tick: Math.round(beat * PPQ), ticks: Math.round(e.dur * PPQ), midi: e.midi, vel: e.vel };
        }).sort((a, b) => a.tick - b.tick);
        tracks.push(noteTrack(track, chan, notes));
        names.push(`${track} (ch ${chan + 1}${t.drum ? ', drums' : ''}, ${notes.length})`);
    }

    const header = chunk('MThd', [...u16(1), ...u16(tracks.length), ...u16(PPQ)]);
    const out = [...header];
    for (const t of tracks) out.push(...t);
    return { bytes: new Uint8Array(out), tracks: names };
}

// Hand the file to the browser as a download.
export function downloadMidi(bytes, filename) {
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Stop capturing and hand the file to the browser.
 * @param {object} opts  name (file + conductor track) · quantize (beats, 0 = off)
 * @returns a summary for the log, or null when nothing was captured.
 */
export function saveMidiCapture({ name = 'crashDot', quantize = 0 } = {}) {
    midiCapture.on = false;
    const events = midiCapture._events;
    const bpm    = midiCapture._bpm;
    const res    = buildMidiFile({ events, bpm, name, quantize });
    if (!res) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file  = `${name}-${stamp}.mid`;
    downloadMidi(res.bytes, file);
    return {
        file, bpm, notes: events.length, tracks: res.tracks,
        drums: drumMapFor(events.filter(e => e.drum).map(e => e.char)),
    };
}
