// Player — one per named variable (p1, p2, ...).
// Handles note scheduling, FX chain management, and player methods.

import { buildParams, SynthCall, SYNTH_DEFS } from '../synths/registry.js';
import { FX_KEYS }               from '../fx/registry.js';
import { FXChain }               from '../fx/chain.js';
import { patGet, isGroup }        from '../patterns/sequences.js';
import { isEnv, evalEnv, envValue } from '../patterns/timevars.js';
import { LOOKAHEAD_S }            from './clock.js';
import { osc }                    from '../../lib/dist/supersonic.js';

// Rest sentinel — a degree of REST fires no note (true silence). Emitted by the
// transpiler for a standalone `_` or bare `rest` in a degree list, and returned by
// the rest() global. (Distinct from `.` → null, which still plays degree 0.) Lives in
// a shared leaf module so the pattern layer can emit it too; re-exported here so every
// existing `import { REST } from './player.js'` keeps working.
import { REST } from '../patterns/rest.js';
export { REST };

// ── Unknown-param safety warnings ─────────────────────────────────────────────
const COMMON_PARAMS = new Set(['degree', 'oct', 'amp', 'dur', 'sus', 'pan', 'attack', 'release', 'pshift', 'amplify', 'delay', 'leg']);
const SAMPLE_PARAMS = new Set(['amp', 'pan', 'rate', 'sample', 'dur', 'sus', 'amplify', 'delay']);
let   _warn   = null;            // log hook, set from index.html
const _warned = new Set();       // dedupe: only warn once per synth.param
export function setWarn(fn) { _warn = fn; }

// Auto-reroll hook — index.html supplies (name, beats) => schedule a re-eval of
// the player's line every `beats` beats (so frozen random generators reroll).
let _rerollHandler = null;
export function setRerollHandler(fn) { _rerollHandler = fn; }

function knownParams(synthName) {
    const s   = new Set(COMMON_PARAMS);
    const def = SYNTH_DEFS[synthName];
    if (def) {
        Object.keys(def.defaults ?? {}).forEach(k => s.add(k));
        (def.extraParams ?? []).forEach(k => s.add(k));
    }
    FX_KEYS.forEach(k => s.add(k));
    return s;
}

// Every param recognised by SOME synth — a param valid elsewhere (e.g. `rate`
// on dbass, which only saw/sine/blip use) is a deliberate cross-synth value,
// not a typo, so it's accepted silently. Genuine typos (cuttoff) still warn.
const ALL_SYNTH_PARAMS = new Set();
for (const def of Object.values(SYNTH_DEFS)) {
    Object.keys(def.defaults ?? {}).forEach(k => ALL_SYNTH_PARAMS.add(k));
    (def.extraParams ?? []).forEach(k => ALL_SYNTH_PARAMS.add(k));
}
import { toMidi, SCALE_MAP }      from './scale.js';
import { PlayStringCall, LoopCall, parsePattern, charToBufId } from './sampler.js';
import { randomGroove, randomFill } from './drummer.js';

// .gtr(string) guitar-string → root semitone offset (FoxDot/CrashServer submap).
const GTR_STRINGS = { 0: -10, 1: -8, 2: -3, 3: 2, 4: 7, 5: 11, 6: 16 };
import { MidiOutCall, scheduleNote, allNotesOff, panicMidiOut } from '../midi/midiout.js';

// SC group node IDs — use low IDs (below client allocator range ~1000)
export const PLAYER_GROUP = 2;
export const FX_GROUP     = 3;

// Private bus allocation (stereo, 2 channels each). Freed buses are recycled, so
// a long session that spawns many player names can't exhaust the bus pool.
const FIRST_BUS = 64;
const STRIDE    = 2;
let   _nextSlot = 0;
const _freeBuses = [];
function allocBus() { return _freeBuses.length ? _freeBuses.pop() : (FIRST_BUS + _nextSlot++ * STRIDE); }
function freeBus(b) { if (b != null) _freeBuses.push(b); }
// Live bus usage for the toolbar monitor: { used, peak }
export function busStats() { return { used: _nextSlot - _freeBuses.length, peak: _nextSlot }; }

// SuperSonic instance reference — set after boot
let _sc = null;
export function setSuperSonic(sc) { _sc = sc; }

// One-shot synth note for MIDI note-input — fires `synthName` at MIDI note `midi`
// immediately to the main output (no per-player FX/bus; a simple keyboard voice).
// sus is in seconds; amp 0..~1.5. Returns the node id.
export function playSynthNote(synthName, midi, opts = {}) {
    if (!_sc) return;
    // secPerBeat=1 so buildParams treats sus (default 0.5) as seconds directly.
    const result = buildParams(synthName, midi, { sus: opts.sus ?? 0.5, amp: opts.amp ?? 0.7 }, 1, 0);
    if (!result) return;
    const id = _sc.nextNodeId();
    try { _sc.sendOSC(osc.encodeSingleBundle(osc.ntpNow(), '/s_new', [result.scName, id, 0, PLAYER_GROUP, ...result.params])); } catch (_) {}
    return id;
}

// Per-step UI signal: (playerName, step). step < 0 means "stopped — clear".
// Wrapped so a UI error can never break audio scheduling (it fires mid-_fire).
let _onStep = null;
export function setStepListener(fn) { _onStep = fn; }
function emitStep(name, step) { if (_onStep) { try { _onStep(name, step); } catch (_) {} } }

// Fired when a .sometimes/.every/.rarely… modifier actually triggers on a player,
// so the editor can briefly flash that line.
let _onTrigger = null;
export function setTriggerListener(fn) { _onTrigger = fn; }
// label = which chained call fired (an alias like "sometimes"/"every") so the
// editor can flash just that .call(…) part of the line, not the whole line.
function emitTrigger(name, label) { if (_onTrigger) { try { _onTrigger(name, label); } catch (_) {} } }

// Resolve all pattern args at the current step
function resolveArgs(args, step) {
    const out = {};
    for (const [k, v] of Object.entries(args)) out[k] = patGet(v, step, v);
    return out;
}

// A synth's OWN parameter names (defaults + extraParams), NOT the shared FX keys.
function synthOwnParams(synthName) {
    const def = SYNTH_DEFS[synthName];
    const s = new Set();
    if (def) {
        Object.keys(def.defaults ?? {}).forEach(k => s.add(k));
        (def.extraParams ?? []).forEach(k => s.add(k));
    }
    return s;
}

// Split resolved args into synth params vs FX params. A param a synth declares as
// its OWN (ownKeys) wins over a same-named FX key — so darkpad's `drive`/compkick's
// `comp` reach the synth, while `drive` on a synth without one still hits the FX.
function splitArgs(r, ownKeys) {
    const synth = {}, fx = {};
    for (const [k, v] of Object.entries(r)) {
        if (ownKeys && ownKeys.has(k)) synth[k] = v;
        else (FX_KEYS.has(k) ? fx : synth)[k] = v;
    }
    return { synth, fx };
}

// Collapse a group to its first element (for contexts that can't layer)
function ungroup(v, step) {
    return isGroup(v) ? patGet(v.__group[0], step) : v;
}

// degree + addend (player `+` transposition). Scalars sum; a group addend makes
// a chord; group+group broadcasts. Pattern elements are resolved at `step`.
function addDegree(base, add, step) {
    const r = (x) => patGet(x, step, x);
    const baseArr = isGroup(base) ? base.__group : [base];
    const addArr  = isGroup(add)  ? add.__group  : [add];
    const n = Math.max(baseArr.length, addArr.length);
    const out = [];
    for (let i = 0; i < n; i++) {
        const b = r(baseArr[i % baseArr.length]);
        const a = r(addArr[i % addArr.length]);
        if (b === REST) { out.push(REST); continue; }              // a rest stays a rest
        if (b === null || b === undefined) { out.push(null); continue; }
        out.push((b ?? 0) + (a ?? 0));
    }
    return out.length === 1 ? out[0] : { __group: out };
}

// Quantised first beat: a player's first note lands on the next beat that is a
// multiple of its dur — so dur=4 waits for a multiple of 4 (bar-locked), dur=1/4
// starts almost immediately. Mirrors FoxDot's dur-grid alignment; keeps players
// in sync. Only used on first activation (re-evals keep the running grid).
// Returns { beat, step } for a fresh player:
//   beat = the next point on the dur grid (so it starts on a musical boundary),
//   step = a PHASE-LOCKED step index (beat/dur) so two players started at different
//          times stay in sync on the global beat grid — like FoxDot, where a step is
//          derived from the clock, not from when you pressed play. e.g. two dur=1
//          play()s launched a beat apart still hit step 0,1,2,3 together.
function alignedStart(clock, durVal) {
    let d = patGet(durVal, 0, durVal);
    if (isGroup(d)) d = patGet(d.__group[0], 0);
    d = Math.max(0.0625, Number(d) || 1);
    const now  = clock.now();
    const beat = Math.ceil((now + 0.001) / d) * d;
    return { beat, step: Math.round(beat / d) };
}

// FoxDot param shorthands → canonical names
const PARAM_ALIASES = { atk: 'attack', rel: 'release', dec: 'decay' };
function applyAliases(obj) {
    for (const [a, canon] of Object.entries(PARAM_ALIASES)) {
        if (a in obj && !(canon in obj)) { obj[canon] = obj[a]; delete obj[a]; }
    }
    return obj;
}

// Restore all players' amplitude (undo a solo)
export function unsolo(clock) {
    clock._players.forEach(p => { p._amplify = 1; });
}

// Soft reload / panic — recover from a stuck engine WITHOUT a page refresh:
// stop & fully reset every player, then free any orphaned server nodes (stuck
// synths / FX) while keeping the groups intact. Re-run code to restart.
export function panic(clock) {
    try { clock.clear(); } catch (_) {}
    try { panicMidiOut(); } catch (_) {}   // silence external MIDI gear too
    clock._players.forEach(p => {
        try { p._resetState(); } catch (_) {}
        try { p.stop(); } catch (_) {}
        p._fxChain = null;            // drop FX node ref — recreated on next eval
    });
    if (_sc) {
        // Flush both schedulers first — notes are now sent up to LOOKAHEAD_S ahead
        // as timestamped bundles, so without this a short tail of already-queued
        // notes would still fire after the freeAll. purge() clears the JS
        // prescheduler and the WASM scheduler (the build remaps /clearSched to it).
        try { _sc.purge(); } catch (_) {}
        try { _sc.send('/g_freeAll', PLAYER_GROUP); } catch (_) {}
        try { _sc.send('/g_freeAll', FX_GROUP); } catch (_) {}
    }
}

// Next beat that is a multiple of `mod` — for bar-aligned scheduling.
function nextMod(clock, mod) {
    return Math.ceil((clock.now() + 0.001) / mod) * mod;
}

// ── drop() — silence a random subset, restore, repeat — on the BAR grid ──────
// drop(clock, playTime=14, dropTime=2, nbloop=1). Fully bar-quantized: begins on
// the next bar, and BOTH the drop and the restore snap to whole bars (4 beats) so
// the breakdown always lands on a downbeat (beat-scheduled, not wall-clock).
export function drop(clock, playTime = 14, dropTime = 2, nbloop = 1, log = null) {
    const BAR = 4;
    const snap = (b) => Math.round(b / BAR) * BAR;              // nearest whole bar
    const playBars = Math.max(BAR, snap(playTime));            // drop after ≥1 bar
    const dropBars = Math.max(BAR, snap(dropTime));            // stay dropped ≥1 bar
    const start = nextMod(clock, BAR);                          // begin on the next bar
    // Un-mute EVERY player. The original FoxDot relies on this blanket reset (at each
    // loop and at the end) so a drop can NEVER leave something silent — a single lost
    // "restore this subset" callback, a re-eval mid-drop, or an overlapping drop() used
    // to strand a player at _amplify=0 (which a plain re-eval doesn't clear).
    const restoreAll = () => clock._players.forEach(p => { p._amplify = 1; });
    const runLoop = (loop, base) => {
        clock._schedule(base, restoreAll);                     // clean slate at the loop start
        if (loop <= 0) return;
        const active = [...clock._players.values()].filter(p => p._active);
        if (active.length === 0) return;
        const size = loop === 1
            ? active.length                       // final loop drops everyone
            : Math.max(1, Math.floor(Math.random() * active.length));
        const subset = [...active].sort(() => Math.random() - 0.5).slice(0, size);
        const names = subset.map(p => p.name).join(' ');
        const dropAt    = base + playBars;                     // on a bar
        const restoreAt = dropAt + dropBars;                   // on a bar
        clock._schedule(dropAt, () => {
            subset.forEach(p => { if (p._active) p._amplify = 0; });
            if (log) log(loop === 1 ? `drop: FINAL — ${names}` : `drop: ${names}  (${loop - 1} left)`);
        });
        clock._schedule(restoreAt, () => {
            restoreAll();                                      // restore EVERYONE, not just the subset
            runLoop(loop - 1, restoreAt);
        });
    };
    runLoop(nbloop, start);
    // Belt-and-braces: whatever happened, un-mute everyone a bar after the sequence
    // should have ended — so sound always comes back.
    clock._schedule(start + nbloop * (playBars + dropBars) + BAR, restoreAll);
}

// ── soloRnd(time=8) — solo a random active player on the next `time` boundary,
// unsolo `time` beats later (beat-aligned). ──────────────────────────────────
export function soloRnd(clock, time = 8, log = null) {
    const active = [...clock._players.values()].filter(p => p._active);
    if (active.length === 0) return;
    const pick = active[Math.floor(Math.random() * active.length)];
    const startBeat = nextMod(clock, time);
    clock._schedule(startBeat, () => {
        clock._players.forEach((q) => { if (q !== pick) q._amplify = 0; });
        if (log) log(`soloRnd: ${pick.name} for ${time} beats`);
    });
    clock._schedule(startBeat + time, () => clock._players.forEach(q => { q._amplify = 1; }));
}

export class Player {
    constructor(name, clock) {
        this.name      = name;
        this._clock    = clock;
        this._active   = false;
        this._gen      = 0;   // fire-chain generation; a stale _fire (older gen) bails
        this._step     = 0;
        this._nextBeat = 0;
        this._synth    = null;
        this._args     = {};
        this._bus      = allocBus();
        this._fxChain  = null;
        this._every    = [];
        this._amplify  = 1;   // transient gain: mute / solo / drop write this
        this._mixLevel = 1;   // persistent mixer fader (0..~1.5) — set from the mixer UI
        // sample-mode state
        this._mode     = 'synth';   // 'synth' | 'sample' | 'loop' | 'midiout'
        this._pattern  = null;      // parsed steps array
        this._playOpts = {};
        this._loopName = null;      // loop-mode: named loop buffer
        this._loopOpts = {};
        this._midiOpts = {};        // midiout-mode opts (degree/channel/amp/…)
        this._midiChans = new Set();// channels this player has sent on (for note-off)
        // Axis-3 parameter-envelope scheduler
        this._envTimer = null;
        // probability modifiers (.sometimes/.often/…) — array of specs
        this._modifiers = null;
        this._stutterN = 0;   // one-shot: repeat the next fired step N times
        this._degreeAdds = null;  // player `+` transposition addends
        this._degrade  = 0;       // .degrade(prob): chance to silence a step
        this._scale    = null;    // per-player scale override (.penta()/.gtr())
        this._root     = null;    // per-player root semitone override (.gtr())
        // .drummer() auto-drummer state
        this._drumming     = false;
        this._drummerEvery = false;
        this._drummerArgs  = null;
        this._drummerFillT = null;
    }

    // p1 >> dbass([0,2,4], ...) OR b1 >> play("X  o X  o", ...)
    // reset=true (from ~p1 >> …) starts the player fresh; otherwise an already-
    // active player INHERITS its previous params and only overrides what's given.
    __rshift__(synthCall, reset = false) {
        if (synthCall === null || synthCall === undefined) { this.stop(); return this; }
        if (this._bus == null) this._bus = allocBus();   // re-acquire after a stop

        // ~player >> … — clear accumulated state so the reset is total, not just
        // the args: drop every() handlers, solo/drop gain, transposition, and
        // bypass the FX chain (so a stale lpf/reverb from before is cleared).
        if (reset) this._resetState();

        if (synthCall instanceof PlayStringCall) {
            const fresh     = reset || !this._active;
            this._mode      = 'sample';
            this._pattern   = parsePattern(synthCall.pattern);
            const userOpts  = applyAliases({ ...synthCall.opts });
            this._playOpts  = fresh ? userOpts : { ...this._playOpts, ...userOpts };
            this._modifiers = synthCall._modifiers ?? null;
            this._unison    = synthCall._unison ?? null;
            this._degrade   = synthCall._degrade ?? 0;
            this._scheduleAfter(synthCall._after);
            this._warnUnknownPlay(userOpts);
            if (!this._active) {
                this._active   = true;
                this._activeSince = Date.now();
                // FX chain is created lazily in _fireSample, only if an FX is used.
                { const a = alignedStart(this._clock, this._playOpts.dur);
                  this._step = a.step; this._nextBeat = a.beat; }
                const gen = ++this._gen; this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
            }
            // Re-evaluating a play() without .drummer() stops any prior auto-drummer.
            if (!synthCall._calls?.some(c => c[0] === 'drummer')) this._stopDrummer();
            this._applyCalls(synthCall);
            this._applyEverys(synthCall);
            return this;
        }

        if (synthCall instanceof LoopCall) {
            const fresh     = reset || !this._active;
            this._mode      = 'loop';
            this._loopName  = synthCall.name;
            const userOpts  = applyAliases({ ...synthCall.opts });
            this._loopOpts  = fresh ? userOpts : { ...this._loopOpts, ...userOpts };
            this._modifiers = synthCall._modifiers ?? null;
            this._degrade   = synthCall._degrade ?? 0;
            this._scheduleAfter(synthCall._after);
            if (!this._active) {
                this._active   = true;
                this._activeSince = Date.now();
                // FX chain is created lazily in _fireLoop, only if an FX is used.
                { const a = alignedStart(this._clock, this._loopOpts.dur);
                  this._step = a.step; this._nextBeat = a.beat; }
                const gen = ++this._gen; this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
            }
            this._applyCalls(synthCall);
            this._applyEverys(synthCall);
            return this;
        }

        if (synthCall instanceof MidiOutCall) {
            const fresh     = reset || !this._active;
            this._mode      = 'midiout';
            const userOpts  = applyAliases({ ...synthCall.args });
            this._midiOpts  = fresh ? userOpts : { ...this._midiOpts, ...userOpts };
            this._modifiers  = synthCall._modifiers ?? null;
            this._degreeAdds = synthCall._degreeAdds ?? null;
            this._degrade    = synthCall._degrade ?? 0;
            this._scheduleAfter(synthCall._after);
            if (!this._active) {
                this._active   = true;
                this._activeSince = Date.now();
                { const a = alignedStart(this._clock, this._midiOpts.dur);
                  this._step = a.step; this._nextBeat = a.beat; }
                const gen = ++this._gen; this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
            }
            this._applyCalls(synthCall);
            this._applyEverys(synthCall);
            return this;
        }

        if (!(synthCall instanceof SynthCall)) {
            console.error(`${this.name} >>: expected synth call or play(), got`, synthCall);
            return this;
        }
        const wasActive = this._active;
        const fresh     = reset || !wasActive;
        const userArgs  = applyAliases({ ...synthCall.args });
        const def       = SYNTH_DEFS[synthCall.name];
        this._mode      = 'synth';
        this._synth     = synthCall.name;
        this._synthOwnKeys = synthOwnParams(synthCall.name);   // own params win over FX keys
        // fresh → synth defaults + user args; inherit → keep previous, override
        this._args       = fresh ? { ...(def?.defaults ?? {}), ...userArgs }
                                 : { ...this._args, ...userArgs };
        this._modifiers  = synthCall._modifiers ?? null;
        this._degreeAdds = synthCall._degreeAdds ?? null;
        this._degrade    = synthCall._degrade ?? 0;
        this._scale      = synthCall._penta ? SCALE_MAP.minPentatonic : null;
        this._root       = null;   // cleared each eval; .gtr() in the chain re-sets it
        this._scheduleAfter(synthCall._after);
        this._warnUnknown(userArgs);

        if (!wasActive) {
            this._active   = true;
            this._activeSince = Date.now();
            // FX chain is created lazily in _fire, only if the player uses an FX.
            { const a = alignedStart(this._clock, this._args.dur);
              this._step = a.step; this._nextBeat = a.beat; }
            const gen = ++this._gen; this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
        }
        this._applyCalls(synthCall);
        this._applyEverys(synthCall);
        return this;
    }

    // Live-tweak one attribute of a running player: p1.lpf = linvar(...).
    // Applies on the next step (synth or sample mode), like a re-eval of one arg.
    setAttr(attr, value) {
        const aliased = PARAM_ALIASES[attr] ?? attr;
        const target  = this._mode === 'sample'  ? this._playOpts
                      : this._mode === 'loop'    ? this._loopOpts
                      : this._mode === 'midiout' ? this._midiOpts
                      : this._args;
        target[aliased] = value;
        return this;
    }

    // Total reset of accumulated per-player state (used by ~player >> …).
    _resetState() {
        this._every      = [];
        this._drummerEvery = false;
        this._stopDrummer();
        this._amplify    = 1;
        this._mixLevel   = 1;   // ~player resets the mixer fader too (a plain re-eval keeps it)
        this._degreeAdds = null;
        this._modifiers  = null;
        this._unison     = null;
        this._stutterN   = 0;
        this._strum      = 0;
        this._multiply   = 1;
        // Free the FX chain entirely (not just bypass): a reset player with no FX
        // routes straight to output again; _fire rebuilds the chain if FX reappear.
        if (this._fxChain && _sc) { this._fxChain.free(_sc); this._fxChain = null; }
    }

    // Register call-level .every() specs into the every-handler array.
    // Only resets when the call has specs (preserves imperative p1.every()).
    _applyEverys(call) {
        if (!call._everys) return;
        this._every = [];
        for (const e of call._everys) this.every(e.beats, e.method, ...e.args);
    }

    // Apply call-chained player methods on activation — p1 >> saw(...).solo(4).
    _applyCalls(call) {
        if (!call?._calls) return;
        for (const [m, ...a] of call._calls) { try { this[m]?.(...a); } catch (_) {} }
    }

    _fire(gen = this._gen) {
        // Bail if stopped OR if this is a STALE fire chain — a stop()+re-eval within
        // a step window leaves the old chain's _fire queued; without this it would
        // reactivate and run alongside the new chain at 2× density.
        if (!this._active || gen !== this._gen) return;
        this._applyModifiers();
        if (this._mode === 'sample')  { this._fireSample(gen);  return; }
        if (this._mode === 'loop')    { this._fireLoop(gen);    return; }
        if (this._mode === 'midiout') { this._fireMidiOut(gen); return; }

        const step = this._step;
        const r    = resolveArgs(this._args, step);

        // Player `+` transposition — add each addend to the degree.
        if (this._degreeAdds) {
            for (const a of this._degreeAdds) r.degree = addDegree(r.degree ?? 0, a, step);
        }

        // Extract Axis-3 envelopes: keys ending in "_" whose value is an envelope.
        // Only FX-chain params can be modulated mid-note (persistent node + n_set).
        const envs = {};
        let hasEnvs = false;
        for (const k of Object.keys(r)) {
            if (k.endsWith('_') && isEnv(r[k])) {
                const base = k.slice(0, -1);
                if (FX_KEYS.has(base)) { envs[base] = r[k]; hasEnvs = true; }
                delete r[k];
            }
        }
        // fb/fi/fo used directly on a param (lpf=fb(...), no "_") → clock-synced value
        for (const k of Object.keys(r)) if (isEnv(r[k])) r[k] = envValue(r[k]);

        // delay — per-note timing offset in beats (player-side, not a synth control)
        const delayBeats = Math.max(0, ungroup(r.delay, step) ?? 0);
        delete r.delay;

        const { synth: sArgs, fx: fxArgs } = splitArgs(r, this._synthOwnKeys);
        const hasFx = Object.keys(fxArgs).length > 0;
        const dur  = Math.max(0.0625, ungroup(r.dur, step) ?? 1);
        const secPerBeat = 60 / this._clock.bpm;

        // FX chain is created lazily — ONLY when the player actually uses an FX
        // param (or an FX envelope). A player with none routes straight to the
        // output, so a bare `d1 >> dbass()` skips the whole 37-stage FX graph.
        // Once created it persists, and FX args are inherited across re-evals, so
        // `dbass(mverb=0.5)` then `dbass(decimate=1)` keeps the reverb too.
        const needsFx = hasFx || hasEnvs;
        if (needsFx && !this._fxChain && _sc) {
            this._fxChain = new FXChain(this._bus, FX_GROUP, _sc);
        }
        const outBus = this._fxChain ? this._bus : 0;

        // Update FX params every step (groups collapse to their first value —
        // the FX chain is a single node and can't be layered)
        if (this._fxChain && hasFx) {
            const fxFlat = {};
            for (const [k, v] of Object.entries(fxArgs)) fxFlat[k] = ungroup(v, step);
            // Tempo-lock beat-relative FX (rgate/chop/fbdelay) unless set explicitly.
            if (fxFlat.beat_dur === undefined) fxFlat.beat_dur = 60 / this._clock.bpm;
            this._fxChain.update(fxFlat, _sc);
        }

        // Start Axis-3 envelopes (sub-beat modulation of FX params via n_set)
        if (hasEnvs) {
            const susBeats = ungroup(r.sus, step) ?? ungroup(r.dur, step) ?? 1;
            this._startEnvelopes(envs, susBeats);
        }

        // Group/chord expansion — voices = longest group among synth params.
        // Each voice picks its element from any grouped param (zipped/cycled).
        let voices = 1;
        for (const v of Object.values(sArgs)) if (isGroup(v)) voices = Math.max(voices, v.__group.length);

        // stutter/multiply: fire this step `reps` times within its duration (roll).
        // stutter is one-shot; multiply is persistent (.multiply(n)).
        const reps    = Math.max(1, this._stutterN || 1, this._multiply || 1);
        this._stutterN = 0;
        const repDur  = dur / reps;
        // strum: spread a chord's voices over `_strum` beats (arpeggiated onset).
        const strumSec = (this._strum || 0) * secPerBeat;
        const fireVoices = (whenNTP) => {
            for (let vi = 0; vi < voices; vi++) {
                const va = {};
                for (const [k, v] of Object.entries(sArgs)) {
                    va[k] = isGroup(v) ? patGet(v.__group[vi % v.__group.length], step) : v;
                }
                if (va.degree === REST) continue;   // `_` / rest → silence (no note)
                const deg = va.degree ?? 0;         // `.` → null → 0 (still plays)
                const oct = va.oct ?? 5;
                let midi = toMidi(deg, oct, this._scale, this._root);
                if (midi === null || !Number.isFinite(midi) || midi < 0 || midi > 127) continue;
                midi += (va.pshift ?? 0);   // semitone detune (fractional MIDI → midicps)
                const { pshift: _ps, amplify: _amp, ...synthA } = va;   // player-side, not synth params
                const amp = (va.amp ?? 0.8) * (va.amplify ?? 1) * this._amplify * this._mixLevel;
                // Silent (amp≤0 — e.g. muted by a drop/solo, _amplify=0) → spawn NO
                // server node. Firing amp-0 synths every step would pile up nodes on
                // scsynth until it hits its node cap and stops sounding entirely (a
                // "stuck engine" only a reboot clears). The step/reschedule below still
                // run, so the player resumes the instant amp comes back.
                if (!(amp > 0)) continue;
                this._trigger(midi, { ...synthA, dur: repDur, amp }, whenNTP + vi * strumSec, outBus, secPerBeat);
            }
        };
        // Each rep/strum onset is an NTP timetag offset from the step's beat — the
        // bundle, not a setTimeout, carries the precise sub-beat timing to scsynth.
        // .degrade(prob): randomly drop this step's note (bookkeeping still advances)
        const degraded = this._degrade > 0 && Math.random() < this._degrade;
        const onsetNTP = this._clock.beatToNTP(this._nextBeat);
        if (!degraded) {
            for (let i = 0; i < reps; i++) {
                fireVoices(onsetNTP + (delayBeats + i * repDur) * secPerBeat);
            }
            emitStep(this.name, step);   // editor degree highlight
        }

        // Tick .every() handlers
        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) {
                h.fn(this);
                h.nextBeat += h.beats;
            }
        }

        this._step++;
        this._nextBeat += dur;
        this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
    }

    _fireSample(gen = this._gen) {
        if (!_sc || !this._pattern?.length || this._bus == null) return;
        const opts     = this._playOpts;
        const step     = this._step;
        // In sample mode a group param varies per pattern step (it can't layer).
        const opt = (v, def) => {
            const out = isGroup(v)
                ? patGet(v.__group[((step % v.__group.length) + v.__group.length) % v.__group.length], step, def)
                : patGet(v, step, def);
            return isEnv(out) ? envValue(out) : out;   // lpf=fb(...) etc. on samples
        };
        const baseDur  = Math.max(0.0625, opt(opts.dur, 1));
        const amp      = opt(opts.amp, 0.8) * opt(opts.amplify, 1) * this._amplify * this._mixLevel;
        const pan      = opt(opts.pan, 0);
        const rate     = opt(opts.rate, 1);
        const sampleIdx = Math.round(opt(opts.sample, 0));
        const delayBeats = Math.max(0, opt(opts.delay, 0));   // per-note timing offset (beats)

        // FX chain only when this play() uses an FX (else samples go straight out).
        const fxFlat = {};
        for (const [k, v] of Object.entries(opts)) {
            if (FX_KEYS.has(k)) fxFlat[k] = opt(v, undefined);
        }
        if (Object.keys(fxFlat).length > 0) {
            // Tempo-lock beat-relative FX (rgate/chop/fbdelay) unless set explicitly.
            if (fxFlat.beat_dur === undefined) fxFlat.beat_dur = 60 / this._clock.bpm;
            if (!this._fxChain && _sc) this._fxChain = new FXChain(this._bus, FX_GROUP, _sc);
            if (this._fxChain) this._fxChain.update(fxFlat, _sc);
        }

        const pat   = this._pattern;
        const token = pat[((step % pat.length) + pat.length) % pat.length];

        // stutter: render this step `reps` times within its duration (roll)
        const reps   = Math.max(1, this._stutterN || 1);
        this._stutterN = 0;
        const repDur = baseDur / reps;
        // unison: layer the sample, detuned via playback rate (2^(pshift/12)) + pan spread
        const onsetNTP = this._clock.beatToNTP(this._nextBeat);
        const renderAt = (off, slot) => {
            if (this._unison) {
                const { pan: pans, pshift: shifts } = this._unison;
                const ampEach = amp / pans.length;
                for (let v = 0; v < pans.length; v++) {
                    this._renderToken(token, off, slot,
                        { sampleIdx, amp: ampEach, pan: pans[v], rate: rate * Math.pow(2, shifts[v] / 12) }, onsetNTP);
                }
            } else {
                this._renderToken(token, off, slot, { sampleIdx, amp, pan, rate }, onsetNTP);
            }
        };
        // .degrade(prob): randomly drop this step (bookkeeping still advances below)
        if (!(this._degrade > 0 && Math.random() < this._degrade)) {
            // amp≤0 (muted by drop/solo) → render NO sample: silent play() steps would
            // otherwise pile up nodes on scsynth until it wedges. Step still advances.
            if (amp > 0) for (let i = 0; i < reps; i++) renderAt(delayBeats + i * repDur, repDur);
            emitStep(this.name, step);   // editor highlight (play strings)
        }

        // Tick .every() handlers (play() mode — was previously synth-only)
        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) {
                h.fn(this);
                h.nextBeat += h.beats;
            }
        }

        this._step++;
        this._nextBeat += baseDur;
        this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
    }

    // Recursively render one play() token over a beat slot [offset, offset+slot].
    // Brackets nest: (sim) layers · [sub] subdivides · {rand}/<alt> pick one child.
    _renderToken(token, beatOffset, slotBeats, p, onsetNTP) {
        if (!token || token.rest) return;

        if (token.char !== undefined) {
            const bufId = charToBufId(token.char, p.sampleIdx);
            if (bufId === null) return;
            const whenNTP = onsetNTP + beatOffset * 60 / this._clock.bpm;
            this._triggerSample(bufId, p.amp, p.pan, p.rate, whenNTP);
            return;
        }

        const kids = token.children;
        switch (token.type) {
            case 'sub': {                       // [..] subdivide the slot
                const subD = slotBeats / kids.length;
                kids.forEach((k, i) => this._renderToken(k, beatOffset + i * subD, subD, p, onsetNTP));
                break;
            }
            case 'sim':                          // (..) all at once
                for (const k of kids) this._renderToken(k, beatOffset, slotBeats, p, onsetNTP);
                break;
            case 'rand':                         // {..} pick one at random
                this._renderToken(kids[Math.floor(Math.random() * kids.length)], beatOffset, slotBeats, p, onsetNTP);
                break;
            case 'alt':                          // <..> cycle on successive hits
                this._renderToken(kids[token._idx++ % kids.length], beatOffset, slotBeats, p, onsetNTP);
                break;
        }
    }

    _triggerSample(bufId, amp, pan, rate, whenNTP) {
        if (!_sc) return;
        const id  = _sc.nextNodeId();
        // Route through the player's private bus → FX chain (falls back to main out)
        const out = this._fxChain ? this._bus : 0;
        try {
            _sc.sendOSC(osc.encodeSingleBundle(whenNTP, '/s_new',
                ['fd_sampler', id, 0, PLAYER_GROUP,
                 'out', out, 'buf', bufId, 'amp', amp, 'pan', pan, 'rate', rate]));
        } catch (_) {}
    }

    // loop() mode — one fd_loop voice per step, beat-stretched to `dur` beats so
    // the buffer locks to the tempo. Mirrors _fireSample but plays a whole named
    // loop buffer (no token tree) and passes sus (seconds) + beat_stretch.
    _fireLoop(gen = this._gen) {
        if (!_sc || this._bus == null) return;
        const opts = this._loopOpts;
        const step = this._step;
        const opt = (v, def) => {
            const out = isGroup(v)
                ? patGet(v.__group[((step % v.__group.length) + v.__group.length) % v.__group.length], step, def)
                : patGet(v, step, def);
            return isEnv(out) ? envValue(out) : out;
        };
        const baseDur    = Math.max(0.0625, opt(opts.dur, 1));
        const amp        = opt(opts.amp, 0.8) * opt(opts.amplify, 1) * this._amplify * this._mixLevel;
        const pan        = opt(opts.pan, 0);
        const rate       = opt(opts.rate, 1);
        const sampleIdx  = Math.round(opt(opts.sample, 0));
        const stretch    = opt(opts.stretch, 1) > 0 ? 1 : 0;   // beat_stretch on/off
        const looping    = opt(opts.looping, 0) > 0 ? 1 : 0;
        const pos        = Math.max(0, opt(opts.pos, 0));
        const delayBeats = Math.max(0, opt(opts.delay, 0));

        // FX chain only when this loop() uses an FX (else it goes straight out).
        const fxFlat = {};
        for (const [k, v] of Object.entries(opts)) if (FX_KEYS.has(k)) fxFlat[k] = opt(v, undefined);
        if (Object.keys(fxFlat).length > 0) {
            // Tempo-lock beat-relative FX (rgate/chop/fbdelay) unless set explicitly.
            if (fxFlat.beat_dur === undefined) fxFlat.beat_dur = 60 / this._clock.bpm;
            if (!this._fxChain && _sc) this._fxChain = new FXChain(this._bus, FX_GROUP, _sc);
            if (this._fxChain) this._fxChain.update(fxFlat, _sc);
        }

        const bufId = charToBufId(this._loopName, sampleIdx);
        if (bufId !== null && !(this._degrade > 0 && Math.random() < this._degrade)) {
            const susSec  = baseDur * 60 / this._clock.bpm;   // step length in seconds
            const whenNTP = this._clock.beatToNTP(this._nextBeat + delayBeats);
            this._triggerLoop(bufId, { amp, pan, rate, sus: susSec, stretch, looping, pos }, whenNTP);
            emitStep(this.name, step);
        }

        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) { h.fn(this); h.nextBeat += h.beats; }
        }
        this._step++;
        this._nextBeat += baseDur;
        this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
    }

    _triggerLoop(bufId, p, whenNTP) {
        if (!_sc) return;
        const id  = _sc.nextNodeId();
        const out = this._fxChain ? this._bus : 0;
        try {
            _sc.sendOSC(osc.encodeSingleBundle(whenNTP, '/s_new',
                ['fd_loop', id, 0, PLAYER_GROUP,
                 'out', out, 'buf', bufId, 'amp', p.amp, 'pan', p.pan, 'rate', p.rate,
                 'sus', p.sus, 'beat_stretch', p.stretch, 'looping', p.looping, 'pos', p.pos]));
        } catch (_) {}
    }

    // midiout() mode — emit MIDI note-on/off to an external port instead of audio.
    // Mirrors the synth path (degree→MIDI, group→chord, stutter, delay) but sends
    // scheduled MIDI messages (performance.now() timestamps) rather than /s_new.
    _fireMidiOut(gen = this._gen) {
        const step = this._step;
        const r    = resolveArgs(this._midiOpts, step);

        if (this._degreeAdds) {
            for (const a of this._degreeAdds) r.degree = addDegree(r.degree ?? 0, a, step);
        }
        // fb/fi/fo used directly on a param (e.g. amp=fb(...)) → clock-synced value
        for (const k of Object.keys(r)) if (isEnv(r[k])) r[k] = envValue(r[k]);

        const delayBeats = Math.max(0, ungroup(r.delay, step) ?? 0);
        const dur        = Math.max(0.0625, ungroup(r.dur, step) ?? 1);
        const noteLen    = (ungroup(r.sus, step) ?? dur) * (ungroup(r.leg, step) ?? 1);
        const chan       = Math.round(ungroup(r.channel, step) ?? 1);

        // Group/chord expansion — voices = longest group among the params.
        let voices = 1;
        for (const v of Object.values(r)) if (isGroup(v)) voices = Math.max(voices, v.__group.length);

        const reps   = Math.max(1, this._stutterN || 1);
        this._stutterN = 0;
        const repDur = dur / reps;
        // Each note lasts sus*leg beats; when stuttering, cap to the rep slot so the
        // roll's notes don't overlap into one another.
        const lenBeats   = reps > 1 ? repDur : noteLen;
        const secPerBeat = 60 / this._clock.bpm;
        const onsetMs    = this._clock.beatToPerfMs(this._nextBeat);

        const degraded = this._degrade > 0 && Math.random() < this._degrade;
        if (!degraded && this._amplify > 0) {
            for (let rep = 0; rep < reps; rep++) {
                const whenMs = onsetMs + (delayBeats + rep * repDur) * secPerBeat * 1000;
                for (let vi = 0; vi < voices; vi++) {
                    const va = {};
                    for (const [k, v] of Object.entries(r)) {
                        va[k] = isGroup(v) ? patGet(v.__group[vi % v.__group.length], step) : v;
                    }
                    const deg = va.degree ?? 0;
                    if (deg === null) continue;
                    let note = toMidi(deg, va.oct ?? 5, this._scale, this._root);
                    if (note === null) continue;
                    note += (va.pshift ?? 0);
                    if (!Number.isFinite(note) || note < 0 || note > 127) continue;
                    const amp = (va.amp ?? 0.8) * (va.amplify ?? 1) * this._amplify * this._mixLevel;
                    const vel = amp * 127;
                    const vch = Math.round(va.channel ?? chan);
                    this._midiChans.add(vch);
                    scheduleNote(note, vel, vch, whenMs, lenBeats * secPerBeat * 1000);
                }
            }
            emitStep(this.name, step);
        }

        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) { h.fn(this); h.nextBeat += h.beats; }
        }
        this._step++;
        this._nextBeat += dur;
        this._clock._schedule(this._nextBeat, () => this._fire(gen), LOOKAHEAD_S);
    }

    // .after(beats, method, ...args) — one-shot delayed player method call
    _scheduleAfter(spec) {
        if (!spec || !spec.method) return;
        const ms = Math.max(0, spec.beats) * 60000 / this._clock.bpm;
        setTimeout(() => {
            if (this._active) { try { this[spec.method]?.(...spec.args); } catch (_) {} }
        }, ms);
    }

    // Probability modifiers (.sometimes/.often/…): roll once per cycle (a full
    // pass of the pattern / degree array), not every step — otherwise a 50%
    // chance on a 4-step pattern fires on ~half of all steps and feels constant.
    _applyModifiers() {
        if (!this._modifiers?.length) return;
        const degArr   = this._mode === 'midiout' ? this._midiOpts.degree : this._args.degree;
        const cycleLen = this._mode === 'sample'
            ? (this._pattern?.length || 1)
            : (Array.isArray(degArr) ? degArr.length : 1);
        if (this._step % cycleLen !== 0) return;     // only at a cycle boundary
        const target = this._mode === 'sample'  ? this._playOpts
                     : this._mode === 'loop'    ? this._loopOpts
                     : this._mode === 'midiout' ? this._midiOpts
                     : this._args;
        for (const m of this._modifiers) {
            if (Math.random() >= m.prob) continue;
            emitTrigger(this.name, m.alias);   // flash just the .sometimes(…) call
            const args = m.args.map(a => patGet(a, this._step, a));

            if (m.kwargs) {
                // temporarily override params for this trigger, restore after a step
                const saved = {};
                for (const k of Object.keys(m.kwargs)) {
                    saved[k] = Object.prototype.hasOwnProperty.call(target, k) ? target[k] : undefined;
                    target[k] = m.kwargs[k];
                }
                if (m.method) { try { this[m.method]?.(...args); } catch (_) {} }
                const ms = (target.dur ?? this._args.dur ?? 1) * 60000 / this._clock.bpm;
                setTimeout(() => {
                    for (const k of Object.keys(saved)) {
                        if (saved[k] === undefined) delete target[k];
                        else target[k] = saved[k];
                    }
                }, ms);
            } else if (m.method) {
                try { this[m.method]?.(...args); } catch (_) {}
            }
        }
    }

    // Warn (once) when an EXPLICITLY-written param isn't recognised by this synth
    // or the FX set. Only the args the user typed on this call are checked —
    // params inherited from a previously-assigned synth (e.g. saw's `rate` when
    // the slot is reused as prophet) are silently ignored, like FoxDot.
    _warnUnknown(userArgs) {
        const known = knownParams(this._synth);
        for (const k of Object.keys(userArgs)) {
            const base = k.endsWith('_') ? k.slice(0, -1) : k;   // lpf_ envelope → lpf
            if (known.has(k) || known.has(base)) continue;
            if (ALL_SYNTH_PARAMS.has(base)) continue;            // valid on another synth → not a typo
            const id = `${this._synth}.${k}`;
            if (_warned.has(id)) continue;
            _warned.add(id);
            if (_warn) _warn(`${this._synth}: unknown param "${k}" — ignored`);
        }
    }

    // Same, for play() — known = sample params + FX keys. Checks explicit opts only.
    _warnUnknownPlay(userOpts) {
        for (const k of Object.keys(userOpts)) {
            const base = k.endsWith('_') ? k.slice(0, -1) : k;
            if (SAMPLE_PARAMS.has(k) || SAMPLE_PARAMS.has(base) || FX_KEYS.has(base)) continue;
            const id = `play.${k}`;
            if (_warned.has(id)) continue;
            _warned.add(id);
            if (_warn) _warn(`play: unknown param "${k}" — ignored`);
        }
    }

    // Run parameter envelopes on the FX chain via n_set at ~60fps.
    // Restarts on each note trigger; runs until `susBeats` elapse.
    _startEnvelopes(envs, susBeats) {
        if (this._envTimer) { clearInterval(this._envTimer); this._envTimer = null; }
        if (!this._fxChain || !_sc) return;
        const bases = Object.keys(envs);
        if (bases.length === 0) return;

        const startBeat = this._clock.now();
        const tick = () => {
            if (!this._active || !this._fxChain) {
                clearInterval(this._envTimer); this._envTimer = null; return;
            }
            const elapsed = this._clock.now() - startBeat;
            const upd = {};
            for (const base of bases) upd[base] = evalEnv(envs[base], elapsed);
            this._fxChain.update(upd, _sc);
            if (elapsed >= susBeats) { clearInterval(this._envTimer); this._envTimer = null; }
        };
        tick();
        this._envTimer = setInterval(tick, 16);
    }

    // whenNTP: NTP timetag for the note's onset. /s_new goes as a timestamped
    // bundle so scsynth fires it on its audio thread at the exact time, immune to
    // main-thread jitter once dispatched. The node frees itself via doneAction:2 in
    // the synthdef envelope (every synthdef has it), so no client /n_free is needed —
    // matching the sample/loop paths.
    _trigger(midi, r, whenNTP, outBus = this._bus, secPerBeat = 60 / this._clock.bpm) {
        if (!_sc || this._bus == null) return;   // bus freed (player stopped)
        const result     = buildParams(this._synth, midi, r, secPerBeat, outBus);
        if (!result) { console.error(`Unknown synth: ${this._synth}`); return; }

        const id = _sc.nextNodeId();
        try {
            _sc.sendOSC(osc.encodeSingleBundle(whenNTP, '/s_new',
                [result.scName, id, 0, PLAYER_GROUP, ...result.params]));
        } catch (_) {}
    }

    // ── Player methods ──────────────────────────────────────────────────────

    // stop() now, or stop(beats) at the next beat that's a multiple of `beats`
    // (grid-aligned, like FoxDot's mod scheduling — so .stop(4) lands on a bar).
    // .reroll(beats) — auto-re-evaluate this player's line every N beats, so a
    // frozen random generator (motif, PShuf, chaos, a PRand degree) rerolls on
    // its own. .reroll(0) stops. Delegates to the handler set from index.html.
    reroll(beats = 8) { _rerollHandler?.(this.name, beats); return this; }

    stop(beats) {
        if (beats) { this._clock._schedule(nextMod(this._clock, beats), () => this.stop()); return this; }
        this._active = false;
        this._every  = [];
        emitStep(this.name, -1);   // clear the editor highlight
        // midiout: cut any note whose scheduled note-off is still pending (long sus)
        if (this._mode === 'midiout' && this._midiChans.size) {
            allNotesOff(this._midiChans);
            this._midiChans.clear();
        }
        if (this._envTimer) { clearInterval(this._envTimer); this._envTimer = null; }
        if (this._fxChain && _sc) {
            this._fxChain.free(_sc);
            this._fxChain = null;
        }
        freeBus(this._bus);   // recycle the private bus for the next player
        this._bus = null;
    }

    // solo() — mute all others indefinitely. solo(beats) — restore at the next
    // beat that's a multiple of `beats` (grid-aligned, like FoxDot).
    solo(beats) {
        // Un-mute self, mute everyone else (self may already be muted from a
        // previous solo/drop — without this, soloing it would silence everything).
        this._clock._players.forEach((p, k) => { p._amplify = (k === this.name) ? 1 : 0; });
        if (beats) {
            this._clock._schedule(nextMod(this._clock, beats),
                () => this._clock._players.forEach(p => { p._amplify = 1; }));
        }
        return this;
    }

    // only() — stop every OTHER player now; only(beats) waits for the next beat
    // that's a multiple of `beats` (grid-aligned), then stops the others.
    only(beats) {
        const act = () => this._clock._players.forEach((p, k) => { if (k !== this.name) p.stop(); });
        if (beats) this._clock._schedule(nextMod(this._clock, beats), act);
        else act();
        return this;
    }

    // Solo for N beats then restore (alias of solo(beats))
    soloDrop(beats = 8) { return this.solo(beats); }

    // every(beats, fn, ...args [, {kwargs}]) — call fn(player) every n beats.
    // fn can be a string method name ('stutter', 'reverse', 'shuffle'). A trailing
    // plain-object is treated as kwargs: those params are applied for the trigger
    // and restored a step later (e.g. .every(4, "stutter", mverb=0.5)).
    every(beats, fn, ...args) {
        let kwargs = null;
        const last = args[args.length - 1];
        if (last && typeof last === 'object' && !Array.isArray(last)
            && typeof last.get !== 'function' && !isGroup(last)) {
            kwargs = args.pop();
        }
        const method = typeof fn !== 'string' ? fn : (p) => {
            const target = p._mode === 'sample'  ? p._playOpts
                         : p._mode === 'loop'    ? p._loopOpts
                         : p._mode === 'midiout' ? p._midiOpts
                         : p._args;
            let saved = null;
            if (kwargs) {
                saved = {};
                for (const k of Object.keys(kwargs)) { saved[k] = target[k]; target[k] = kwargs[k]; }
                const ms = (target.dur ?? 1) * 60000 / p._clock.bpm;
                setTimeout(() => {
                    for (const k of Object.keys(saved)) {
                        if (saved[k] === undefined) delete target[k]; else target[k] = saved[k];
                    }
                }, ms + 50);
            }
            try { p[fn]?.(...args); } catch (_) {}
        };
        this._every.push({ beats, nextBeat: this._nextBeat + beats, fn: (p) => { method(p); emitTrigger(p.name, 'every'); } });
        return this;
    }

    // Stutter: play the next fired step n times within its own duration
    // (a one-shot roll). n = number of rapid repeats. Does NOT change the
    // player's dur — the sequence carries on normally. Consumed by _fire.
    stutter(n = 2) {
        this._stutterN = Math.max(1, Math.floor(n) || 2);
        return this;
    }

    // Reverse degree array for one cycle
    // The player's ordered sequence — the degree array for synths, the parsed
    // token pattern for play() drums — so reverse/rotate/shuffle/mirror all work
    // on both. Returns the live array (or null if the pattern isn't a plain list).
    _seq() {
        const s = this._mode === 'sample' ? this._pattern : this._args?.degree;
        return Array.isArray(s) && s.length ? s : null;
    }
    _setSeq(v) {
        if (this._mode === 'sample') this._pattern = v; else this._args.degree = v;
    }
    _seqDurMs(len) {
        const dur = this._mode === 'sample' ? (this._playOpts?.dur ?? 1) : (this._args?.dur ?? 1);
        return len * (typeof dur === 'number' ? dur : 1) * (60000 / this._clock.bpm);
    }

    reverse() {
        const seq = this._seq();
        if (seq) {
            const orig = [...seq];
            this._setSeq([...orig].reverse());
            setTimeout(() => { if (this._active) this._setSeq(orig); }, this._seqDurMs(orig.length) + 50);
        }
        return this;
    }

    // Shuffle the sequence for one cycle
    shuffle() {
        const seq = this._seq();
        if (seq) {
            const orig = [...seq];
            this._setSeq([...orig].sort(() => Math.random() - 0.5));
            setTimeout(() => { if (this._active) this._setSeq(orig); }, this._seqDurMs(orig.length) + 50);
        }
        return this;
    }

    // .jump(n) — nudge the playhead forward n steps once (live glitch/fill).
    jump(n = 1) { this._step += Math.round(n); return this; }

    // .rotate(n) — cyclically rotate the sequence live (n>0 left, n<0 right).
    // Permanent, so it's audible when triggered repeatedly: .every(4, "rotate").
    rotate(n = 1) {
        const d = this._seq();
        if (d) {
            const k = ((Math.round(n) % d.length) + d.length) % d.length;
            this._setSeq([...d.slice(k), ...d.slice(0, k)]);
        }
        return this;
    }

    // .mirror() — reverse the sequence in place (a permanent flip, so it toggles
    // back and forth when triggered): .every(8, "mirror") or .sometimes("mirror").
    // (Unlike .reverse(), which flips for one cycle only.)
    mirror() {
        const d = this._seq();
        if (d) this._setSeq([...d].reverse());
        return this;
    }

    // .strum(spread) — spread a chord/group's notes over `spread` beats (arpeggiated
    // strum) instead of firing them all at once. e.g. p1 >> keys((0,4,7)).strum(0.05)
    strum(spread = 0.04) { this._strum = spread; return this; }

    // .offbeat(amt) — push every note late by `amt` beats (0.5 = land on the offbeat).
    offbeat(amt = 0.5) { this.setAttr('delay', amt); return this; }

    // .multiply(n) — persistently repeat each step n times within its duration (roll).
    multiply(n = 2) { this._multiply = Math.max(1, Math.round(n)); return this; }

    // .drummer(durloop, durPlyr) — turn a play() player into a self-evolving rock
    // drummer (FoxDot/CrashServer port). Picks a random groove + fill, swaps the
    // fill in for the tail of each loop, and re-randomises every durloop beats.
    //   b1 >> play("x").drummer()          ← defaults: durloop=16, step dur=0.5
    //   b1 >> play("x").drummer(8, 0.25)
    drummer(durloop = 16, durPlyr = 0.5) {
        if (this._mode !== 'sample') return this;     // play() players only
        this._drummerArgs = { durloop, durPlyr };
        this._drumming = true;
        this._applyDrummer();
        if (!this._drummerEvery) {                     // register the cycle once
            this._drummerEvery = true;
            this.every(durloop, () => { if (this._drumming) this._applyDrummer(); });
        }
        return this;
    }
    _applyDrummer() {
        const { durloop, durPlyr } = this._drummerArgs;
        this._pattern = randomGroove();
        this._playOpts.dur = durPlyr;
        // Swap a fill in for the tail of the loop (durloop/[4,8,16] beats), then the
        // every() cycle re-randomises the groove at the next durloop boundary.
        const fill     = randomFill();
        const fillDur  = durloop / [4, 8, 16][Math.floor(Math.random() * 3)];
        const ms       = Math.max(0, (durloop - fillDur)) * 60000 / this._clock.bpm;
        clearTimeout(this._drummerFillT);
        this._drummerFillT = setTimeout(() => {
            if (this._active && this._drumming) this._pattern = fill;
        }, ms);
    }
    _stopDrummer() {
        this._drumming = false;
        clearTimeout(this._drummerFillT);
    }

    // .degrade(prob) — randomly silence prob (0–1) of steps. degrade(0) clears it.
    degrade(prob = 0.5) { this._degrade = prob; return this; }

    // .once() — play a single event (one step), then stop. Great for one-shot
    // stabs/hits: p1 >> stab([0,4,7]).once()
    once() {
        const dur = Number(this._args?.dur ?? this._playOpts?.dur ?? this._loopOpts?.dur ?? 1) || 1;
        const at  = (this._nextBeat ?? this._clock.now()) + dur * 0.9;
        this._clock.schedule(at, () => this.stop());
        return this;
    }

    // .penta() — constrain degrees to the minor pentatonic scale for this player.
    penta() { this._scale = SCALE_MAP.minPentatonic; return this; }

    // .chroma() — use the chromatic scale for this player (degrees = semitones).
    chroma() { this._scale = SCALE_MAP.chromatic; return this; }

    // .gtr(string) — tune the player like a guitar string (FoxDot/CrashServer port):
    // chromatic scale + a per-player root at the string's open-pitch offset, so
    // degrees act like frets. string 0–6 → E A D G B e (low→high). e.g. .gtr(5)
    gtr(string = 1) {
        const s = Array.isArray(string) ? string[0] : string;
        this._root  = GTR_STRINGS[s] ?? 0;
        this._scale = SCALE_MAP.chromatic;
        return this;
    }

    // ── Cross-player modulation (take a player NAME as a string) ──────────────
    // .follow("p1") — track another player's degree each step.
    follow(name) {
        const other = this._clock._players.get(String(name));
        if (other) this.setAttr('degree', other.getAttr('degree'));
        return this;
    }

    // .accompany("p1", [0,2,4]) — harmonise around another player's degree,
    // cycling the given scale-degree intervals. e.g. p2 >> pluck([0]).accompany("p1")
    accompany(name, intervals = [0, 2, 4]) {
        const other = this._clock._players.get(String(name));
        if (!other) return this;
        const base = other.getAttr('degree');
        const iv = Array.isArray(intervals) ? intervals : [intervals];
        this.setAttr('degree', { get: (step) => {
            const d = patGet(base, step);
            return (Number(d) || 0) + iv[(((step % iv.length) + iv.length) % iv.length)];
        } });
        return this;
    }

    // .map("p1", {0:5, 4:7}, "degree") — drive one of THIS player's attrs from
    // another player's degree through a lookup table (missing keys pass through).
    map(name, mapping = {}, attr = 'degree') {
        const other = this._clock._players.get(String(name));
        if (!other) return this;
        const src = other.getAttr('degree');
        this.setAttr(attr, { get: (step) => {
            const k = patGet(src, step);
            if (mapping[k] !== undefined) return mapping[k];
            const r = Math.round(k);
            return mapping[r] !== undefined ? mapping[r] : k;
        } });
        return this;
    }

    // Read another player's current value of an attr as a live pattern:
    //   i9 >> faim(b1.degree, …)   reads b1's degree each step.
    getAttr(attr) {
        const target = () => (this._mode === 'sample' ? this._playOpts : this._args)[attr];
        return { get: (step) => patGet(target(), step) };
    }
}
