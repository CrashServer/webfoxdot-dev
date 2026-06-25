// Player — one per named variable (p1, p2, ...).
// Handles note scheduling, FX chain management, and player methods.

import { buildParams, SynthCall, SYNTH_DEFS } from '../synths/registry.js';
import { FX_KEYS }               from '../fx/registry.js';
import { FXChain }               from '../fx/chain.js';
import { patGet, isGroup }        from '../patterns/sequences.js';
import { isEnv, evalEnv }         from '../patterns/timevars.js';

// ── Unknown-param safety warnings ─────────────────────────────────────────────
const COMMON_PARAMS = new Set(['degree', 'oct', 'amp', 'dur', 'sus', 'pan', 'attack', 'release', 'pshift', 'amplify', 'delay']);
const SAMPLE_PARAMS = new Set(['amp', 'pan', 'rate', 'sample', 'dur', 'sus', 'amplify', 'delay']);
let   _warn   = null;            // log hook, set from index.html
const _warned = new Set();       // dedupe: only warn once per synth.param
export function setWarn(fn) { _warn = fn; }

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
import { toMidi }                 from './scale.js';
import { PlayStringCall, parsePattern, charToBufId } from './sampler.js';

// SC group node IDs — use low IDs (below client allocator range ~1000)
export const PLAYER_GROUP = 2;
export const FX_GROUP     = 3;

// Private bus allocation (stereo, 2 channels each)
const FIRST_BUS = 64;
const STRIDE    = 2;
let   _nextSlot = 0;
function allocBus() { return FIRST_BUS + _nextSlot++ * STRIDE; }

// SuperSonic instance reference — set after boot
let _sc = null;
export function setSuperSonic(sc) { _sc = sc; }

// Per-step UI signal: (playerName, step). step < 0 means "stopped — clear".
// Wrapped so a UI error can never break audio scheduling (it fires mid-_fire).
let _onStep = null;
export function setStepListener(fn) { _onStep = fn; }
function emitStep(name, step) { if (_onStep) { try { _onStep(name, step); } catch (_) {} } }

// Resolve all pattern args at the current step
function resolveArgs(args, step) {
    const out = {};
    for (const [k, v] of Object.entries(args)) out[k] = patGet(v, step, v);
    return out;
}

// Split resolved args into synth params vs FX params
function splitArgs(r) {
    const synth = {}, fx = {};
    for (const [k, v] of Object.entries(r)) {
        (FX_KEYS.has(k) ? fx : synth)[k] = v;
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
        if (b === null || b === undefined) { out.push(null); continue; }
        out.push((b ?? 0) + (a ?? 0));
    }
    return out.length === 1 ? out[0] : { __group: out };
}

// FoxDot param shorthands → canonical names
const PARAM_ALIASES = { atk: 'attack', rel: 'release' };
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
    clock._players.forEach(p => {
        try { p._resetState(); } catch (_) {}
        try { p.stop(); } catch (_) {}
        p._fxChain = null;            // drop FX node ref — recreated on next eval
    });
    if (_sc) {
        try { _sc.send('/g_freeAll', PLAYER_GROUP); } catch (_) {}
        try { _sc.send('/g_freeAll', FX_GROUP); } catch (_) {}
    }
}

// Next beat that is a multiple of `mod` — for bar-aligned scheduling.
function nextMod(clock, mod) {
    return Math.ceil((clock.now() + 0.001) / mod) * mod;
}

// ── drop() — silence a random subset, restore, repeat — on the BAR grid ──────
// drop(clock, playTime=14, dropTime=2, nbloop=1). Aligned to the next bar so
// drops land musically (beat-scheduled, not wall-clock).
export function drop(clock, playTime = 14, dropTime = 2, nbloop = 1, log = null) {
    const total = playTime + dropTime;
    const start = nextMod(clock, 4);              // align to the next bar (4 beats)
    const runLoop = (loop, base) => {
        if (loop <= 0) return;
        const active = [...clock._players.values()].filter(p => p._active);
        if (active.length === 0) return;
        const size = loop === 1
            ? active.length                       // final loop drops everyone
            : Math.max(1, Math.floor(Math.random() * active.length));
        const subset = [...active].sort(() => Math.random() - 0.5).slice(0, size);
        const names = subset.map(p => p.name).join(' ');
        clock._schedule(base + playTime, () => {
            subset.forEach(p => p._amplify = 0);
            if (log) log(loop === 1 ? `drop: FINAL — ${names}` : `drop: ${names}  (${loop - 1} left)`);
        });
        clock._schedule(base + total, () => {
            subset.forEach(p => p._amplify = 1);
            runLoop(loop - 1, base + total);
        });
    };
    runLoop(nbloop, start);
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
        this._step     = 0;
        this._nextBeat = 0;
        this._synth    = null;
        this._args     = {};
        this._bus      = allocBus();
        this._fxChain  = null;
        this._every    = [];
        this._amplify  = 1;
        // sample-mode state
        this._mode     = 'synth';   // 'synth' | 'sample'
        this._pattern  = null;      // parsed steps array
        this._playOpts = {};
        // Axis-3 parameter-envelope scheduler
        this._envTimer = null;
        // probability modifiers (.sometimes/.often/…) — array of specs
        this._modifiers = null;
        this._stutterN = 0;   // one-shot: repeat the next fired step N times
        this._degreeAdds = null;  // player `+` transposition addends
    }

    // p1 >> dbass([0,2,4], ...) OR b1 >> play("X  o X  o", ...)
    // reset=true (from ~p1 >> …) starts the player fresh; otherwise an already-
    // active player INHERITS its previous params and only overrides what's given.
    __rshift__(synthCall, reset = false) {
        if (synthCall === null || synthCall === undefined) { this.stop(); return this; }

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
            this._scheduleAfter(synthCall._after);
            this._warnUnknownPlay(userOpts);
            if (!this._active) {
                this._active   = true;
                this._activeSince = Date.now();
                this._step     = 0;
                // play() routes through the FX chain too (samples → private bus → FX → out)
                this._fxChain  = this._fxChain ?? (_sc ? new FXChain(this._bus, FX_GROUP, _sc) : null);
                const now      = this._clock.now();
                this._nextBeat = Math.ceil(now + 0.001);
                this._clock._schedule(this._nextBeat, () => this._fire());
            }
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
        // fresh → synth defaults + user args; inherit → keep previous, override
        this._args       = fresh ? { ...(def?.defaults ?? {}), ...userArgs }
                                 : { ...this._args, ...userArgs };
        this._modifiers  = synthCall._modifiers ?? null;
        this._degreeAdds = synthCall._degreeAdds ?? null;
        this._scheduleAfter(synthCall._after);
        this._warnUnknown(userArgs);

        if (!wasActive) {
            this._active   = true;
            this._activeSince = Date.now();
            this._step     = 0;
            this._fxChain  = this._fxChain ?? (_sc ? new FXChain(this._bus, FX_GROUP, _sc) : null);
            const now      = this._clock.now();
            this._nextBeat = Math.ceil(now + 0.001);
            this._clock._schedule(this._nextBeat, () => this._fire());
        }
        this._applyEverys(synthCall);
        return this;
    }

    // Total reset of accumulated per-player state (used by ~player >> …).
    _resetState() {
        this._every      = [];
        this._amplify    = 1;
        this._degreeAdds = null;
        this._modifiers  = null;
        this._unison     = null;
        this._stutterN   = 0;
        if (this._fxChain && _sc) this._fxChain.reset(_sc);
    }

    // Register call-level .every() specs into the every-handler array.
    // Only resets when the call has specs (preserves imperative p1.every()).
    _applyEverys(call) {
        if (!call._everys) return;
        this._every = [];
        for (const e of call._everys) this.every(e.beats, e.method, ...e.args);
    }

    _fire() {
        if (!this._active) return;
        this._applyModifiers();
        if (this._mode === 'sample') { this._fireSample(); return; }

        const step = this._step;
        const r    = resolveArgs(this._args, step);

        // Player `+` transposition — add each addend to the degree.
        if (this._degreeAdds) {
            for (const a of this._degreeAdds) r.degree = addDegree(r.degree ?? 0, a, step);
        }

        // Extract Axis-3 envelopes: keys ending in "_" whose value is an envelope.
        // Only FX-chain params can be modulated mid-note (persistent node + n_set).
        const envs = {};
        for (const k of Object.keys(r)) {
            if (k.endsWith('_') && isEnv(r[k])) {
                const base = k.slice(0, -1);
                if (FX_KEYS.has(base)) envs[base] = r[k];
                delete r[k];
            }
        }

        // delay — per-note timing offset in beats (player-side, not a synth control)
        const delayBeats = Math.max(0, ungroup(r.delay, step) ?? 0);
        delete r.delay;

        const { synth: sArgs, fx: fxArgs } = splitArgs(r);
        const dur  = Math.max(0.0625, ungroup(r.dur, step) ?? 1);

        // Lazy FX chain init (if boot happened after first >> call)
        if (!this._fxChain && _sc) {
            this._fxChain = new FXChain(this._bus, FX_GROUP, _sc);
        }

        // Update FX params every step (groups collapse to their first value —
        // the FX chain is a single node and can't be layered)
        if (this._fxChain && Object.keys(fxArgs).length > 0) {
            const fxFlat = {};
            for (const [k, v] of Object.entries(fxArgs)) fxFlat[k] = ungroup(v, step);
            this._fxChain.update(fxFlat, _sc);
        }

        // Start Axis-3 envelopes (sub-beat modulation of FX params via n_set)
        if (Object.keys(envs).length > 0) {
            const susBeats = ungroup(r.sus, step) ?? ungroup(r.dur, step) ?? 1;
            this._startEnvelopes(envs, susBeats);
        }

        // Group/chord expansion — voices = longest group among synth params.
        // Each voice picks its element from any grouped param (zipped/cycled).
        let voices = 1;
        for (const v of Object.values(sArgs)) if (isGroup(v)) voices = Math.max(voices, v.__group.length);

        // stutter: fire this step `reps` times within its duration (roll)
        const reps    = Math.max(1, this._stutterN || 1);
        this._stutterN = 0;
        const repDur  = dur / reps;
        const fireVoices = () => {
            for (let vi = 0; vi < voices; vi++) {
                const va = {};
                for (const [k, v] of Object.entries(sArgs)) {
                    va[k] = isGroup(v) ? patGet(v.__group[vi % v.__group.length], step) : v;
                }
                const deg = va.degree ?? 0;
                if (deg === null) continue;
                const oct = va.oct ?? 5;
                let midi = toMidi(deg, oct);
                if (midi === null || midi < 0 || midi > 127) continue;
                midi += (va.pshift ?? 0);   // semitone detune (fractional MIDI → midicps)
                const { pshift: _ps, amplify: _amp, ...synthA } = va;   // player-side, not synth params
                const amp = (va.amp ?? 0.8) * (va.amplify ?? 1) * this._amplify;
                this._trigger(midi, { ...synthA, dur: repDur, amp });
            }
        };
        const msPerBeat = 60000 / this._clock.bpm;
        const delayMs   = delayBeats * msPerBeat;
        for (let i = 0; i < reps; i++) {
            const t = delayMs + i * repDur * msPerBeat;
            if (t <= 0) fireVoices();
            else setTimeout(fireVoices, t);
        }

        emitStep(this.name, step);   // editor degree highlight

        // Tick .every() handlers
        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) {
                h.fn(this);
                h.nextBeat += h.beats;
            }
        }

        this._step++;
        this._nextBeat += dur;
        this._clock._schedule(this._nextBeat, () => this._fire());
    }

    _fireSample() {
        if (!_sc || !this._pattern?.length) return;
        const opts     = this._playOpts;
        const step     = this._step;
        // In sample mode a group param varies per pattern step (it can't layer).
        const opt = (v, def) => {
            if (isGroup(v)) { const g = v.__group; return patGet(g[((step % g.length) + g.length) % g.length], step, def); }
            return patGet(v, step, def);
        };
        const baseDur  = Math.max(0.0625, opt(opts.dur, 1));
        const amp      = opt(opts.amp, 0.8) * opt(opts.amplify, 1) * this._amplify;
        const pan      = opt(opts.pan, 0);
        const rate     = opt(opts.rate, 1);
        const sampleIdx = Math.round(opt(opts.sample, 0));
        const delayBeats = Math.max(0, opt(opts.delay, 0));   // per-note timing offset (beats)

        // Lazy FX chain init (if boot happened after first >> call)
        if (!this._fxChain && _sc) this._fxChain = new FXChain(this._bus, FX_GROUP, _sc);

        // Apply FX params each step (samples flow through the chain via the bus)
        if (this._fxChain) {
            const fxFlat = {};
            for (const [k, v] of Object.entries(opts)) {
                if (FX_KEYS.has(k)) fxFlat[k] = opt(v, undefined);
            }
            if (Object.keys(fxFlat).length > 0) this._fxChain.update(fxFlat, _sc);
        }

        const pat   = this._pattern;
        const token = pat[((step % pat.length) + pat.length) % pat.length];

        // stutter: render this step `reps` times within its duration (roll)
        const reps   = Math.max(1, this._stutterN || 1);
        this._stutterN = 0;
        const repDur = baseDur / reps;
        // unison: layer the sample, detuned via playback rate (2^(pshift/12)) + pan spread
        const renderAt = (off, slot) => {
            if (this._unison) {
                const { pan: pans, pshift: shifts } = this._unison;
                const ampEach = amp / pans.length;
                for (let v = 0; v < pans.length; v++) {
                    this._renderToken(token, off, slot,
                        { sampleIdx, amp: ampEach, pan: pans[v], rate: rate * Math.pow(2, shifts[v] / 12) });
                }
            } else {
                this._renderToken(token, off, slot, { sampleIdx, amp, pan, rate });
            }
        };
        for (let i = 0; i < reps; i++) renderAt(delayBeats + i * repDur, repDur);

        emitStep(this.name, step);   // editor highlight (play strings)

        // Tick .every() handlers (play() mode — was previously synth-only)
        for (const h of this._every) {
            if (this._nextBeat >= h.nextBeat) {
                h.fn(this);
                h.nextBeat += h.beats;
            }
        }

        this._step++;
        this._nextBeat += baseDur;
        this._clock._schedule(this._nextBeat, () => this._fire());
    }

    // Recursively render one play() token over a beat slot [offset, offset+slot].
    // Brackets nest: (sim) layers · [sub] subdivides · {rand}/<alt> pick one child.
    _renderToken(token, beatOffset, slotBeats, p) {
        if (!token || token.rest) return;

        if (token.char !== undefined) {
            const bufId = charToBufId(token.char, p.sampleIdx);
            if (bufId === null) return;
            const ms = Math.max(0, beatOffset * 60000 / this._clock.bpm);
            setTimeout(() => this._triggerSample(bufId, p.amp, p.pan, p.rate), ms);
            return;
        }

        const kids = token.children;
        switch (token.type) {
            case 'sub': {                       // [..] subdivide the slot
                const subD = slotBeats / kids.length;
                kids.forEach((k, i) => this._renderToken(k, beatOffset + i * subD, subD, p));
                break;
            }
            case 'sim':                          // (..) all at once
                for (const k of kids) this._renderToken(k, beatOffset, slotBeats, p);
                break;
            case 'rand':                         // {..} pick one at random
                this._renderToken(kids[Math.floor(Math.random() * kids.length)], beatOffset, slotBeats, p);
                break;
            case 'alt':                          // <..> cycle on successive hits
                this._renderToken(kids[token._idx++ % kids.length], beatOffset, slotBeats, p);
                break;
        }
    }

    _triggerSample(bufId, amp, pan, rate) {
        if (!_sc) return;
        const id  = _sc.nextNodeId();
        // Route through the player's private bus → FX chain (falls back to main out)
        const out = this._fxChain ? this._bus : 0;
        _sc.send('/s_new', 'fd_sampler', id, 0, PLAYER_GROUP,
            'out', out, 'buf', bufId, 'amp', amp, 'pan', pan, 'rate', rate);
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
        const cycleLen = this._mode === 'sample'
            ? (this._pattern?.length || 1)
            : (Array.isArray(this._args.degree) ? this._args.degree.length : 1);
        if (this._step % cycleLen !== 0) return;     // only at a cycle boundary
        const target = this._mode === 'sample' ? this._playOpts : this._args;
        for (const m of this._modifiers) {
            if (Math.random() >= m.prob) continue;
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

    _trigger(midi, r) {
        if (!_sc) return;
        const secPerBeat = 60 / this._clock.bpm;
        const result     = buildParams(this._synth, midi, r, secPerBeat, this._bus);
        if (!result) { console.error(`Unknown synth: ${this._synth}`); return; }

        const id = _sc.nextNodeId();
        _sc.send('/s_new', result.scName, id, 0, PLAYER_GROUP, ...result.params);

        // Auto-free after envelope completes
        const sus  = r.sus ?? r.dur ?? 1;
        const relS = r.release ?? Math.min(0.5, sus * secPerBeat * 0.3);
        setTimeout(() => { try { _sc.send('/n_free', id); } catch (_) {} },
            (sus * secPerBeat + relS + 0.3) * 1000);
    }

    // ── Player methods ──────────────────────────────────────────────────────

    // stop() now, or stop(beats) after N beats (beat-aligned)
    stop(beats) {
        if (beats) { this._clock._schedule(this._clock.now() + beats, () => this.stop()); return this; }
        this._active = false;
        this._every  = [];
        emitStep(this.name, -1);   // clear the editor highlight
        if (this._envTimer) { clearInterval(this._envTimer); this._envTimer = null; }
        if (this._fxChain && _sc) {
            this._fxChain.free(_sc);
            this._fxChain = null;
        }
    }

    // solo() — mute all others indefinitely. solo(beats) — restore after N beats.
    solo(beats) {
        // Un-mute self, mute everyone else (self may already be muted from a
        // previous solo/drop — without this, soloing it would silence everything).
        this._clock._players.forEach((p, k) => { p._amplify = (k === this.name) ? 1 : 0; });
        if (beats) {
            this._clock._schedule(this._clock.now() + beats,
                () => this._clock._players.forEach(p => { p._amplify = 1; }));
        }
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
            const target = p._mode === 'sample' ? p._playOpts : p._args;
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
        this._every.push({ beats, nextBeat: this._nextBeat + beats, fn: method });
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
    reverse() {
        if (Array.isArray(this._args.degree)) {
            const orig = [...this._args.degree];
            this._args.degree = [...orig].reverse();
            const durMs = orig.length * (this._args.dur ?? 1) * (60000 / this._clock.bpm);
            setTimeout(() => { if (this._active) this._args.degree = orig; }, durMs + 50);
        }
        return this;
    }

    // Shuffle degree array for one cycle
    shuffle() {
        if (Array.isArray(this._args.degree)) {
            const orig = [...this._args.degree];
            const shuf = [...orig].sort(() => Math.random() - 0.5);
            this._args.degree = shuf;
            const durMs = orig.length * (this._args.dur ?? 1) * (60000 / this._clock.bpm);
            setTimeout(() => { if (this._active) this._args.degree = orig; }, durMs + 50);
        }
        return this;
    }
}
