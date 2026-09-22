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
import { Lateness } from './perfstats.js';

// How far ahead audio events are dispatched. Must stay below SuperSonic's
// bypassLookaheadS (0.5s) so bundles route straight to scsynth's scheduler.
// `let`, not `const`, and deliberately: an ES module export is a LIVE binding, so
// changing it here changes it for player.js too without threading a setter through
// ten call sites.
export let LOOKAHEAD_S = 0.12;

/**
 * Trade responsiveness for stall immunity, at runtime.
 *
 * Bigger is NOT simply better, which is the thing worth knowing before reaching for
 * it. The lookahead is how early a note is handed to scsynth with its timetag, so it
 * is also the age of everything sampled at that moment:
 *
 *   TimeVars   unaffected — resolveArgsAt() already samples them at the note's OWN
 *              beat rather than at "now", so linvar and friends stay correct.
 *   midi()/aud()  read LIVE at dispatch. At 120ms a knob move is imperceptible; at
 *              500ms it is a beat behind at 120bpm, and aud() follows sound from
 *              before the note it is shaping.
 *   .stop()    a note already sent still lands. Today that window is 120ms and
 *              nobody notices; make it 500ms and stopping feels broken.
 *
 * So the ceiling here is 0.45s: past the transport's own 0.5s bypass window, bundles
 * would be held by the prescheduler worker instead of going straight to scsynth's
 * scheduler, which is where cancellation would become both possible and necessary —
 * and none of that is wired.
 *
 * @param {number} sec  seconds; 0.02 to 0.45
 * @returns {number} what it actually became
 */
export function setLookahead(sec) {
    const v = Number(sec);
    if (isFinite(v)) LOOKAHEAD_S = Math.max(0.02, Math.min(0.45, v));
    return LOOKAHEAD_S;
}

export class Clock {
    constructor() {
        this._bpm     = 120;
        this._bpmVar  = null;  // if set, a TimeVar sampled each tick (tempo automation)
        this._bpmShown = 120;  // last value pushed to the UI (avoids spamming _onBpm)
        this._meter   = 4;     // beats per bar
        this._beat    = 0;
        this._lastMs  = null;
        this._events  = [];   // { beat, fn }[]
        this._players = new Map();
        this._running = false;
        this._onBpm   = null; // callback when bpm changes
        // How late each 10ms tick actually fired. This is the number that decides
        // whether a main-thread stall cost anything: a tick later than LOOKAHEAD_S
        // means notes missed their timetag. See perfstats.js.
        this._late    = new Lateness();
        this._due     = null;   // when the pending tick was supposed to fire
        // A monotonic count of ticks later than the lookahead. Separate from the
        // histogram on purpose: perf("reset") clears that one to scope a passage,
        // and the governor diffs THIS, so a reset must not read to it as a sudden
        // drop to zero late ticks.
        this._lateTotal = 0;
    }

    /** Tick-lateness stats, for perf(). Reset to measure one passage. */
    lateStats() {
        const l = this._late;
        return {
            n: l.n, max: l.max, mean: l.mean, p95: l.pct(0.95), p99: l.pct(0.99),
            overLookahead: l.over(LOOKAHEAD_S * 1000),
            over40: l.over(40),
            histogram: l.histogram(),
            windowS: l.windowS,
        };
    }
    resetLateStats() { this._late.reset(); }
    /** Ticks later than the lookahead since boot — never reset. For the governor. */
    lateTotal() { return this._lateTotal; }

    start() {
        this._running = true;
        this._lastMs  = performance.now();
        this._due     = null;          // the first tick is not late, it is the first
        this._late.reset();
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

    // performance.now() timestamp (ms) at which `beat` falls — the time domain
    // Web MIDI's output.send(data, when) uses, so MIDI-out notes stay phase-locked
    // to the audio (which is scheduled from the same beat clock).
    beatToPerfMs(beat) {
        return performance.now() + (beat - this._beatNow()) * 60000 / this._bpm;
    }

    _tick() {
        if (!this._running) return;
        const now = performance.now();
        // Measured against when this tick was DUE, not against the last tick: the
        // difference is the whole point, since a run of on-time ticks after a stall
        // would otherwise hide it.
        if (this._due !== null) {
            const behind = now - this._due;
            this._late.add(behind);
            if (behind >= LOOKAHEAD_S * 1000) this._lateTotal++;
        }
        let dt    = (now - this._lastMs) / 1000;
        this._lastMs = now;
        // Clamp dt: a backgrounded tab or a main-thread stall makes this 10ms tick
        // fire seconds late. Without clamping, the beat lurches forward and dumps a
        // burst of overdue notes on resume. Capping keeps tempo steady and drains
        // the backlog in order over the next ticks (the beat just shifts later by
        // the stall — fine for a live instrument).
        if (dt > 0.1) dt = 0.1;
        // Tempo automation: Clock.bpm = linvar([120,140],[16]) — sample the TimeVar
        // each tick so the beat advances at the ramped tempo. UI is notified only
        // when the rounded value changes.
        if (this._bpmVar) {
            const v = Number(this._bpmVar.get(Math.floor(this._beat)));
            if (isFinite(v) && v > 0) {
                this._bpm = v;
                const r = Math.round(v);
                if (r !== this._bpmShown) { this._bpmShown = r; if (this._onBpm) this._onBpm(this._bpm); }
            }
        }
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
        this._due = performance.now() + 10;
        setTimeout(() => this._tick(), 10);
    }

    // Discipline the beat to an external source (Ableton Link, follow-only):
    // match tempo and align the bar phase. A large error (first lock / tempo
    // jump) snaps so we catch up fast; small errors are nudged a fraction each
    // update so the correction is inaudible — no lurching notes.
    /**
     * Lock the beat NUMBER to an external clock, not merely its phase.
     *
     * webTroop publishes FoxDot's Clock.beat, which is absolute — beat 2742 of their
     * session, ten times a second. Aligning only `beat % 4` matches the pulse but
     * leaves the numbering free, so their bar 686 can be your bar 12 and anything
     * counted in bars disagrees. Taking the number itself makes the two sessions
     * agree on where they ARE, not just on when the next beat falls.
     *
     * The correction is split, because the two halves mean different things:
     *
     *   whole beats  — a RENUMBERING. The clock moves and everything already
     *                  scheduled moves with it, so not one note changes when it
     *                  sounds. Without that shift a fresh lock jumps thousands of
     *                  beats forward, every pending event is suddenly overdue, and
     *                  the backlog empties into the room at once.
     *   the fraction — the part you can HEAR. Only the clock moves, so the audio
     *                  slides into place: snapped if it is far, eased at 8% an
     *                  update if it is close, which is inaudible at ten a second.
     *
     * @returns {number|null} the error in beats before correcting, for a readout.
     */
    lockTo({ bpm, beat }) {
        if (bpm && Math.abs(bpm - this._bpm) > 0.01) this.bpm = bpm;
        if (beat == null || !isFinite(beat)) return null;
        const err = beat - this._beatNow();
        const whole = Math.round(err);
        if (whole) {
            this._beat += whole;
            for (const e of this._events) e.beat += whole;
        }
        const frac = err - whole;                       // now within ±0.5
        this._beat += Math.abs(frac) > 0.25 ? frac : frac * 0.08;
        return err;
    }

    syncTo({ bpm, phase, quantum }) {
        if (bpm && Math.abs(bpm - this._bpm) > 0.01) this.bpm = bpm;   // setter → UI
        if (phase == null || !quantum) return;
        // _beatNow(), not _beat: the tick value is up to one 10ms tick stale, and
        // comparing a stale beat against a live external phase bakes that staleness
        // in as a permanent offset — measured at 0.011 beats, ~5ms, which is the
        // wrong side of audible to leave in a sync path. The correction still lands
        // on _beat; the drift between them is the same before and after.
        const cur = ((this._beatNow() % quantum) + quantum) % quantum;
        let err = phase - cur;
        err -= quantum * Math.round(err / quantum);                   // nearest, (-q/2, q/2]
        this._beat += Math.abs(err) > quantum * 0.25 ? err : err * 0.08;
    }

    now()                      { return this._beat; }
    // lead (seconds): dispatch fn this far before `b`, for timestamped audio events.
    //
    // A non-finite beat is refused rather than queued. `evt.beat <= horizon` is false
    // for NaN at every horizon there will ever be, so such an event never fires AND
    // never leaves — it just sits in _events being re-examined a hundred times a
    // second, forever, one more each time somebody calls future(NaN) again.
    _schedule(b, fn, lead = 0) {
        if (!isFinite(b)) return false;
        this._events.push({ beat: b, fn, lead });
        return true;
    }

    // ── User-facing scheduling ────────────────────────────────────────────────
    // Run fn `dur` beats from now (one-shot). Clock.future(8, () => p1.stop())
    future(dur, fn)     { if (typeof fn === 'function') this._schedule(this._beat + Math.max(0, Number(dur) || 0), fn); }
    // Run fn at an absolute beat.
    schedule(beat, fn)  { if (typeof fn === 'function') this._schedule(beat, fn); }
    // Run fn at the next beat that is a multiple of n (+ optional offset).
    mod(n, fn, offset = 0) {
        if (typeof fn !== 'function' || !(n > 0)) return;
        let nb = Math.ceil((this._beat - offset) / n) * n + offset;
        if (nb <= this._beat + 1e-6) nb += n;
        this._schedule(nb, fn);
    }
    // Run fn at the next bar boundary.
    nextBar(fn)         { this.mod(this._meter, fn); }
    // Current bar index and beats-per-bar.
    bar()               { return Math.floor(this._beat / this._meter); }
    get meter()         { return this._meter; }
    // Math.max(1, Math.round(NaN)) is NaN, not 1 — bar() would return NaN forever.
    set meter(n)        { const m = Math.round(Number(n)); if (isFinite(m)) this._meter = Math.max(1, m); }

    // The beat as of RIGHT NOW, interpolated between the 10ms ticks — the number
    // you want when comparing phase against another clock, where a tick of stale
    // reading is 0.02 beats of imaginary error.
    get beat() { return this._beatNow(); }

    get bpm()  { return this._bpm; }
    set bpm(v) {
        // A TimeVar/pattern → tempo automation (sampled each tick in _tick).
        if (v && typeof v === 'object' && (v.isTimeVar || typeof v.get === 'function')) {
            this._bpmVar = v;
            return;
        }
        this._bpmVar = null;
        // The TimeVar path below already validates (isFinite && > 0); this one did not,
        // and the two failure modes are both terminal. Clock.bpm = 0 makes beatToNTP
        // divide by zero, so every note gets an infinite timetag. Clock.bpm = NaN makes
        // `_beat += dt * NaN / 60` turn the beat itself into NaN, and the clock never
        // advances again — no error, no sound, nothing to do but reload.
        const n = Number(v);
        if (!isFinite(n) || n <= 0) return;
        this._bpm = n;
        this._bpmShown = Math.round(this._bpm);
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
