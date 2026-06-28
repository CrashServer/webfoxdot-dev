// Beat clock — drives all players. Runs at 10ms resolution.
//
// Timing model: the beat advances from performance.now() (a JS main-thread
// clock). But audio onsets are NOT fired from the main thread — each note is
// sent to scsynth as a *timestamped OSC bundle* whose NTP timetag marks its
// exact onset (see Player._trigger). scsynth's audio thread fires the bundle at
// that timetag sample-accurately, so a main-thread stall (GC, heavy re-eval,
// DOM work) no longer jitters the audio as long as the bundle was sent ahead of
// its onset. Note events are therefore *dispatched early* by LOOKAHEAD_S (their
// onset precision lives in the timetag); control events (solo, section, stop)
// still fire at-beat via setTimeout.
//
// osc.ntpNow() is derived from performance.now() — the SAME clock as the beat —
// so beat→timetag conversion is exact, with no audio-clock drift.

import { osc } from '../../lib/dist/supersonic.js';

// How far ahead audio events are dispatched. Must stay below SuperSonic's
// bypassLookaheadS (0.5s) so bundles route straight to scsynth's scheduler.
export const LOOKAHEAD_S = 0.12;

export class Clock {
    constructor() {
        this._bpm     = 120;
        this._beat    = 0;
        this._lastMs  = null;
        this._events  = [];   // { beat, fn }[]
        this._players = new Map();
        this._running = false;
        this._onBpm   = null; // callback when bpm changes
    }

    start() {
        this._running = true;
        this._lastMs  = performance.now();
        this._tick();
    }

    // Re-anchor the timing reference (call when the tab regains focus): the next
    // tick then measures a tiny dt instead of the whole hidden interval, so the
    // beat resumes cleanly rather than jumping.
    resync() { this._lastMs = performance.now(); }

    // Current beat interpolated to *this instant* (the stored _beat is up to one
    // tick — 10ms — stale). Used to convert a beat to a wall-clock timetag.
    _beatNow() {
        return this._beat + (performance.now() - this._lastMs) * this._bpm / 60000;
    }

    // NTP timetag (seconds since 1900) at which the given beat falls. ntpNow()
    // and _beatNow() are both read from performance.now() at the same instant,
    // so the conversion is exact.
    beatToNTP(beat) {
        return osc.ntpNow() + (beat - this._beatNow()) * 60 / this._bpm;
    }

    _tick() {
        if (!this._running) return;
        const now = performance.now();
        let dt    = (now - this._lastMs) / 1000;
        this._lastMs = now;
        // Clamp dt: a backgrounded tab or a main-thread stall makes this 10ms tick
        // fire seconds late. Without clamping, the beat lurches forward and dumps a
        // burst of overdue notes on resume. Capping keeps tempo steady and drains
        // the backlog in order over the next ticks (the beat just shifts later by
        // the stall — fine for a live instrument).
        if (dt > 0.1) dt = 0.1;
        this._beat += dt * this._bpm / 60;

        // ~80ms alignment window for at-beat (control) events.
        const horizon = this._beat + (80 / 1000) * this._bpm / 60;

        for (let i = this._events.length - 1; i >= 0; i--) {
            const evt = this._events[i];
            if (evt.lead) {
                // Audio event: dispatch once we're within its lead window, so the
                // timestamped bundle reaches scsynth ahead of its onset. The exact
                // onset is carried by the bundle's NTP timetag, not by when fn runs.
                const leadBeats = evt.lead * this._bpm / 60;
                if (evt.beat - leadBeats <= this._beat) {
                    this._events.splice(i, 1);
                    evt.fn();
                }
            } else if (evt.beat <= horizon) {
                this._events.splice(i, 1);
                const delayMs = Math.max(0, (evt.beat - this._beat) * 60000 / this._bpm);
                setTimeout(evt.fn, delayMs);
            }
        }
        setTimeout(() => this._tick(), 10);
    }

    // Discipline the beat to an external source (Ableton Link, follow-only):
    // match tempo and align the bar phase. A large error (first lock / tempo
    // jump) snaps so we catch up fast; small errors are nudged a fraction each
    // update so the correction is inaudible — no lurching notes.
    syncTo({ bpm, phase, quantum }) {
        if (bpm && Math.abs(bpm - this._bpm) > 0.01) this.bpm = bpm;   // setter → UI
        if (phase == null || !quantum) return;
        const cur = ((this._beat % quantum) + quantum) % quantum;
        let err = phase - cur;
        err -= quantum * Math.round(err / quantum);                   // nearest, (-q/2, q/2]
        this._beat += Math.abs(err) > quantum * 0.25 ? err : err * 0.08;
    }

    now()                      { return this._beat; }
    // lead (seconds): dispatch fn this far before `b`, for timestamped audio events.
    _schedule(b, fn, lead = 0) { this._events.push({ beat: b, fn, lead }); }

    get bpm()  { return this._bpm; }
    set bpm(v) {
        this._bpm = Number(v);
        if (this._onBpm) this._onBpm(this._bpm);
    }

    // Stop all players
    clear() {
        for (const p of this._players.values()) p.stop();
    }

    // Get or create a named player
    getPlayer(name, PlayerClass) {
        if (!this._players.has(name)) {
            this._players.set(name, new PlayerClass(name, this));
        }
        return this._players.get(name);
    }
}
