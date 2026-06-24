// Player — one per named variable (p1, p2, ...).
// Handles note scheduling, FX chain management, and player methods.

import { buildParams, SynthCall, SYNTH_DEFS } from '../synths/registry.js';
import { FX_KEYS }               from '../fx/registry.js';
import { FXChain }               from '../fx/chain.js';
import { patGet, isGroup }        from '../patterns/sequences.js';
import { isEnv, evalEnv }         from '../patterns/timevars.js';

// ── Unknown-param safety warnings ─────────────────────────────────────────────
const COMMON_PARAMS = new Set(['degree', 'oct', 'amp', 'dur', 'sus', 'pan', 'attack', 'release']);
const SAMPLE_PARAMS = new Set(['amp', 'pan', 'rate', 'sample', 'dur', 'sus']);
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

// Restore all players' amplitude (undo a solo)
export function unsolo(clock) {
    clock._players.forEach(p => { p._amplify = 1; });
}

// ── drop() — silence a random subset of players, restore after playTime beats
// drop(clock, playTime=14, dropTime=2, nbloop=1)
export function drop(clock, playTime = 14, dropTime = 2, nbloop = 1) {
    const allPlayers = [...clock._players.values()].filter(p => p._active);
    const n = allPlayers.length;
    if (n === 0) return;

    for (let loop = 0; loop < nbloop; loop++) {
        const loopOffset = loop * (playTime + dropTime);
        // Pick a random non-empty subset to silence
        const subsetSize = nbloop === 1
            ? Math.floor(Math.random() * n) + 1
            : Math.max(1, Math.floor(Math.random() * n));
        const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
        const toSilence = shuffled.slice(0, subsetSize);

        const secPerBeat = 60 / clock.bpm;

        setTimeout(() => {
            for (const p of toSilence) p._amplify = 0;
        }, loopOffset * secPerBeat * 1000);

        setTimeout(() => {
            for (const p of toSilence) p._amplify = 1;
        }, (loopOffset + playTime) * secPerBeat * 1000);
    }
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
        // .sometimes() probabilistic modifier spec
        this._sometimes = null;
    }

    // p1 >> dbass([0,2,4], ...) OR b1 >> play("X  o X  o", ...)
    __rshift__(synthCall) {
        if (synthCall === null || synthCall === undefined) { this.stop(); return this; }

        if (synthCall instanceof PlayStringCall) {
            this._mode      = 'sample';
            this._pattern   = parsePattern(synthCall.pattern);
            this._playOpts  = { ...synthCall.opts };
            this._sometimes = synthCall._sometimes ?? null;
            this._warnUnknownPlay();
            if (!this._active) {
                this._active   = true;
                this._step     = 0;
                // play() routes through the FX chain too (samples → private bus → FX → out)
                this._fxChain  = this._fxChain ?? (_sc ? new FXChain(this._bus, FX_GROUP, _sc) : null);
                const now      = this._clock.now();
                this._nextBeat = Math.ceil(now + 0.001);
                this._clock._schedule(this._nextBeat, () => this._fire());
            }
            return this;
        }

        if (!(synthCall instanceof SynthCall)) {
            console.error(`${this.name} >>: expected synth call or play(), got`, synthCall);
            return this;
        }
        const wasActive = this._active;
        this._mode      = 'synth';
        this._synth     = synthCall.name;
        this._args      = { ...synthCall.args };
        this._sometimes = synthCall._sometimes ?? null;
        this._warnUnknown();

        if (!wasActive) {
            this._active   = true;
            this._step     = 0;
            this._fxChain  = this._fxChain ?? (_sc ? new FXChain(this._bus, FX_GROUP, _sc) : null);
            const now      = this._clock.now();
            this._nextBeat = Math.ceil(now + 0.001);
            this._clock._schedule(this._nextBeat, () => this._fire());
        }
        return this;
    }

    _fire() {
        if (!this._active) return;
        this._applySometimes();
        if (this._mode === 'sample') { this._fireSample(); return; }

        const step = this._step;
        const r    = resolveArgs(this._args, step);

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
        for (let vi = 0; vi < voices; vi++) {
            const va = {};
            for (const [k, v] of Object.entries(sArgs)) {
                va[k] = isGroup(v) ? patGet(v.__group[vi % v.__group.length], step) : v;
            }
            const deg = va.degree ?? 0;
            if (deg === null) continue;
            const oct = va.oct ?? 5;
            const midi = toMidi(deg, oct);
            if (midi === null || midi < 0 || midi > 127) continue;
            this._trigger(midi, { ...va, amp: (va.amp ?? 0.8) * this._amplify });
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
        const amp      = opt(opts.amp, 0.8) * this._amplify;
        const pan      = opt(opts.pan, 0);
        const rate     = opt(opts.rate, 1);
        const sampleIdx = Math.round(opt(opts.sample, 0));

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
        this._renderToken(token, 0, baseDur, { sampleIdx, amp, pan, rate });

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

    // .sometimes(prob, method, ...args) — roll each step, maybe apply a method
    _applySometimes() {
        const s = this._sometimes;
        if (!s || !s.method || Math.random() >= s.prob) return;
        const args = s.args.map(a => patGet(a, this._step, a));
        try { this[s.method]?.(...args); } catch (_) {}
    }

    // Warn (once) when a declared param isn't recognised by this synth or the FX set
    _warnUnknown() {
        const known = knownParams(this._synth);
        for (const k of Object.keys(this._args)) {
            const base = k.endsWith('_') ? k.slice(0, -1) : k;   // lpf_ envelope → lpf
            if (known.has(k) || known.has(base)) continue;
            const id = `${this._synth}.${k}`;
            if (_warned.has(id)) continue;
            _warned.add(id);
            if (_warn) _warn(`${this._synth}: unknown param "${k}" — ignored`);
        }
    }

    // Same, for play() — known = sample params + FX keys
    _warnUnknownPlay() {
        for (const k of Object.keys(this._playOpts)) {
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

    stop() {
        this._active = false;
        this._every  = [];
        if (this._envTimer) { clearInterval(this._envTimer); this._envTimer = null; }
        if (this._fxChain && _sc) {
            this._fxChain.free(_sc);
            this._fxChain = null;
        }
    }

    // Mute all other players (keeps them running so unsolo can restore them)
    solo() {
        this._clock._players.forEach((p, k) => {
            if (k !== this.name) p._amplify = 0;
        });
        return this;
    }

    // Solo for N beats then restore all
    soloDrop(beats = 8) {
        this.solo();
        const ms = beats * (60000 / this._clock.bpm);
        setTimeout(() => {
            this._clock._players.forEach(p => { p._amplify = 1; });
        }, ms);
        return this;
    }

    // every(beats, fn) — call fn(player) every n beats
    // fn can be a string method name: 'stutter', 'reverse', 'shuffle'
    every(beats, fn, ...args) {
        const method = typeof fn === 'string' ? (p) => p[fn]?.(...args) : fn;
        this._every.push({ beats, nextBeat: this._nextBeat + beats, fn: method });
        return this;
    }

    // Stutter: temporarily shorten dur to repeat current notes rapidly
    stutter(n = 2) {
        const origDur = this._args.dur ?? 1;
        this._args.dur = origDur / n;
        setTimeout(() => { if (this._active) this._args.dur = origDur; },
            n * (origDur / n) * (60000 / this._clock.bpm) + 50);
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
