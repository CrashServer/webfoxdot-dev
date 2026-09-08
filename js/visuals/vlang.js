// Visual language — the "visual synths" of crashDot, authored in the SAME editor as
// your audio in a FoxDot-close syntax and rendered in the pop-out window (▦ visuals):
//
//   video1 >> plasma(hue=.6, ch=0)      # a layer on channel 0  (video1, video2, … by convention)
//   video2 >> tunnel(pal="ice", ch=1)   # a layer on channel 1
//   video9 >> mix(linvar([0,1],32), dur=1/4, blend="screen")   # the A↔B crossfader
//   palette("fire")   vmode("shade")    # global palette / glyph mode
//   video2.stop()
//
// This module is the AUTHORITATIVE store (it runs in the main window). Because a layer
// param can be a live pattern/TimeVar (PWhite, linvar, …) — which can't cross a
// BroadcastChannel — the bridge ticks us on the audio clock: snapshot(beat) resolves
// every value to a plain number (reusing the same patGet engine the audio players use)
// and the resolved state is streamed to the renderer. So the whole FoxDot pattern
// vocabulary works in visuals identically to audio.

import { patGet } from '../patterns/sequences.js';
import { SCENES, blendIndex, WS_SET, WS_SCENES, WS_FX_NAMES } from './vdata.js';
import { defaults as wsDefaults } from './workshop/index.js';
import { workshopSend } from '../net/workshop-bridge.js';

const SCENE_SET = new Set(SCENES);

// ── Store ────────────────────────────────────────────────────────────────────
const layers = new Map();          // name → { scene, ch, params(raw), fx(raw), born }
let   mixer  = null;               // { owner, value(raw), dur, blend } — SINGLETON crossfader
const master = { palette: null, mode: null, res: null };   // res = GPU render-scale (null → default)
let   clearSeq = 0;                 // bumped by clear() → renderer wipes its feedback buffer
let   _openHook   = null;   // () => ensure visuals.html is open
let   _wsOpenHook = null;   // () => ensure /workshop/ is open
export function setOpenHook(fn)   { _openHook   = fn; }
export function setWsOpenHook(fn) { _wsOpenHook = fn; }
const _open   = () => { try { _openHook   && _openHook();   } catch (_) {} }
const _wsOpen = () => { try { _wsOpenHook && _wsOpenHook(); } catch (_) {} }
const _now  = () => { try { return performance.now(); } catch (_) { return 0; } };

// ── Spec objects ─────────────────────────────────────────────────────────────
// A scene layer: scene name + params (hue/speed/bright/dur/ch/pal…) + post-fx.
export class VSpec {
    constructor(scene = null, params = {}, fx = {}) { this.scene = scene; this.params = params; this.fx = fx; }
    __add__(other) {
        if (other && other.isMix) return other;                         // scene + mix → the mix wins
        if (!(other instanceof VSpec)) return this;
        return new VSpec(other.scene || this.scene, { ...this.params, ...other.params }, { ...this.fx, ...other.fx });
    }
}
// The crossfader spec. Singleton: assigning mix() to any vN retires the previous one.
class MixSpec {
    constructor(value = 0, opts = {}) { this.isMix = true; this.value = value; this.dur = opts.dur; this.blend = opts.blend; }
    __add__() { return this; }
}

// ── Value resolution — number | array | Pattern | TimeVar, on the beat ────────
// Patterns advance one step every `dur` beats; TimeVars (linvar/sinvar/var) are
// continuous and sampled at the (dur-quantised) beat — matching the audio engine.
// Cache the last-sampled value of each pattern object per step, so a NON-deterministic
// pattern (PRand/PWhite/PxRand …) whose .get() re-rolls every call is sampled ONCE per
// step — not every frame. Without this, mosaic(cells=PRand(8), dur=2) would re-roll at
// the frame rate instead of every 2 beats; with it, a video pattern advances one step
// per dur, like a player. Deterministic patterns/arrays/TimeVars are unaffected.
const _visMemo = new WeakMap();   // pattern object → { step, dur, value }
function resolveVisual(v, beat, dur) {
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    dur = dur || 1;
    if (v.isTimeVar) {
        const b = dur >= 1 ? Math.floor(beat) : Math.floor(beat / dur) * dur;
        try { return v.get(b); } catch (_) { return 0; }
    }
    if (typeof v.get === 'function' || Array.isArray(v)) {
        const step = Math.floor(beat / dur);
        if (typeof v === 'object') {                       // memoise per (object, step, dur)
            const m = _visMemo.get(v);
            if (m && m.step === step && m.dur === dur) return m.value;
            let value; try { value = patGet(v, step); } catch (_) { value = 0; }
            _visMemo.set(v, { step, dur, value });
            return value;
        }
        try { return patGet(v, step); } catch (_) { return 0; }
    }
    return v;
}
function resolveMap(obj, beat, dur) {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = resolveVisual(obj[k], beat, dur);
    return out;
}

// ── Builders (injected into the editor eval scope) ───────────────────────────
function sceneBuilder(name) {
    return (...args) => {
        const params = args.find(a => a && typeof a === 'object' && !Array.isArray(a) && !a.isTimeVar) || {};
        return new VSpec(name, params, {});
    };
}
function fxBuilder(key, dflt) { return (v) => new VSpec(null, {}, { [key]: v === undefined ? dflt : v }); }

// Video FX chained with `+` (like synth FX). trails/feedback are frame-feedback; blur/
// bloom/scan/vignette/glitch/invert/posterize are post-process. Values are the default
// amount when called bare, e.g. video1 >> plasma() + bloom() + blur(0.3).
const VFX = { trails: 0.7, feedback: 0.8, blur: 0.5, bloom: 0.6, scan: 0.5, vignette: 0.5, glitch: 1, invert: true,
              posterize: 3, droste: 0.6, fold: 0.6, hueshift: 0.5, dither: 0.7, pixelsort: 0.6, mirror: 0.8, edge: 0.8, pixelate: 0.5,
              // Master grade + limiter, ported from the workshop's lut.js / limiter.js.
              // NEUTRAL AT 1, unlike everything above it: sat(0) is greyscale, sat(2)
              // is lurid, sat() on its own is a small lift. ceiling(0.8) caps output
              // brightness — the answer to bloom stacking to solid white.
              sat: 1.4, exposure: 1.15, contrast: 1.2, ceiling: 0.85 };

export function visualBuilders() {
    const out = {};
    for (const s of SCENES) out[s] = sceneBuilder(s);
    for (const s of WS_SCENES) if (!out[s]) out[s] = sceneBuilder(s);
    for (const [k, d] of Object.entries(VFX)) out[k] = fxBuilder(k, d);
    // The workshop's 52 canvas effects. A name crashDot already has stays crashDot's —
    // those run on the GPU over the whole frame, which is cheaper and is what the
    // existing sets expect — so this adds the ~35 that are genuinely new, and they act
    // on ONE layer rather than on everything.
    for (const k of WS_FX_NAMES) if (!out[k]) out[k] = fxBuilder(k, 0.5);
    // mix(value, dur=, blend=) — the A↔B crossfader (value 0=chan0 … 1=chan1)
    out.mix = (value = 0, opts = {}) => new MixSpec(value, opts);
    // palette("fire" | 8 | "off") — global colour ramp (name OR integer index); vmode("shade")
    out.palette = (name) => { master.palette = (name == null || name === 'off') ? null : name; _open(); return name; };
    out.vmode   = (name) => { master.mode = (name == null) ? null : String(name); _open(); return name; };
    // vres(scale) — GPU render resolution as a multiplier of CSS pixels: 1 = native,
    // 0.5 = half (faster, audio stays smooth), 2 = supersampled. vres() / vres(null) → default.
    out.vres    = (s) => { master.res = (s == null) ? null : Number(s); _open(); return s; };
    // clear() — blank the video: stop every layer + the crossfader and wipe the feedback
    // buffer, a full reset ([c] in the visuals window does the same).
    out.clear   = () => { layers.clear(); mixer = null; clearSeq++; _open(); return 'clear'; };

    // ── Workshop control builders ─────────────────────────────────────────
    // These fire immediately (no video1 >> needed). Return a log string.
    const _ws = (msg) => { workshopSend({ t: 'workshop', ...msg }); };

    // Presets
    // wpreset("name") — recall by name/prefix · wpreset(2) — recall by index
    out.wspreset  = (name) => ({ _wsPreset: String(name ?? '') });   // video1 >> form
    out.wpreset   = (v) => {
        if (typeof v === 'number') _ws({ cmd: 'preset', index: Math.round(v) });
        else _ws({ cmd: 'preset', name: String(v ?? '') });
        return `wpreset(${v})`;
    };

    // Transport
    out.wblackout = (on = true) => ({ _wsCmd: { cmd: 'blackout', value: !!on } });  // video1 >> form
    out.wstutter  = (rate = 0, on = true) => ({ _wsCmd: { cmd: 'stutter', value: !!on, rate: Number(rate) } });
    out.wbpm      = (v) => { _ws({ cmd: 'bpm', value: Number(v) }); return `wbpm(${v})`; };
    out.wblackout = (on = true) => { _ws({ cmd: 'blackout', value: !!on }); return `wblackout(${on})`; };
    out.wstutter  = (rate = 0, on = true) => { _ws({ cmd: 'stutter', value: !!on, rate: Number(rate) }); return `wstutter(${rate})`; };

    // Per-channel
    // wop(ch, 0.5)              — opacity
    // wblend(ch, "add")         — blend mode: normal/add/screen/multiply/overlay/difference/lighten/darken
    // wmute(ch)                 — toggle mute · wmute(ch, true/false) — explicit
    // wsolo(ch)                 — solo this channel (mutes all others)
    // wfx(ch, "bloom", 0.4)     — add/set per-channel FX (sets primary param, e.g. amount)
    // wsnap(ch, "name")         — apply a named channel snapshot
    // wsave(ch, "name")         — save channel state as a named snapshot
    out.wop    = (ch, v)        => { _ws({ cmd: 'ch_opacity', ch: Number(ch), value: Number(v) }); return `wop(${ch},${v})`; };
    out.wblend = (ch, mode)     => { _ws({ cmd: 'ch_blend', ch: Number(ch), mode: String(mode) }); return `wblend(${ch},"${mode}")`; };
    out.wmute  = (ch, on)       => { _ws({ cmd: 'ch_mute', ch: Number(ch), value: on == null ? null : !!on }); return `wmute(${ch})`; };
    out.wsolo  = (ch)           => { _ws({ cmd: 'ch_solo', ch: Number(ch) }); return `wsolo(${ch})`; };
    out.wfx    = (ch, type, v)  => { _ws({ cmd: 'ch_fx', ch: Number(ch), type: String(type), value: Number(v ?? 0.5) }); return `wfx(${ch},"${type}",${v})`; };
    out.wsnap  = (ch, name)     => { _ws({ cmd: 'ch_snap', ch: Number(ch), name: String(name ?? '') }); return `wsnap(${ch},"${name}")`; };
    out.wsave  = (ch, name)     => { _ws({ cmd: 'ch_save', ch: Number(ch), name: String(name ?? `fd-ch${ch}`) }); return `wsave(${ch},"${name}")`; };

    // Channel management
    // wadd("starfield")  — add a new channel with this layer kind
    // wdel(2)            — remove channel at index 2
    out.wadd   = (kind = 'grid') => { _ws({ cmd: 'ch_add', kind: String(kind) }); return `wadd("${kind}")`; };
    out.wdel   = (ch)            => { _ws({ cmd: 'ch_remove', ch: Number(ch) }); return `wdel(${ch})`; };

    // Master FX
    // wmfx("bloom", 0.6)    — set/add a master FX by type + primary param value
    // wlimit(0.8)           — master limiter level
    out.wmfx   = (type, v)  => { _ws({ cmd: 'master_fx', type: String(type), value: Number(v ?? 0.5) }); return `wmfx("${type}",${v})`; };
    out.wlimit = (v)         => { _ws({ cmd: 'limiter', value: Number(v ?? 1) }); return `wlimit(${v})`; };

    // Sequencer
    // wseq(true/false)          — enable/disable
    // wstep(step, ch)           — toggle step · wstep(step, ch, true/false) — set explicit
    out.wseq   = (on)            => { _ws({ cmd: 'seq_enable', value: !!on }); return `wseq(${on})`; };
    out.wstep  = (step, ch, on)  => { _ws({ cmd: 'seq_step', step: Number(step), ch: Number(ch), on: on == null ? null : !!on }); return `wstep(${step},${ch})`; };

    return out;
}

// ── Visual player (vN) ───────────────────────────────────────────────────────
class VisualPlayer {
    constructor(name) { this.name = name; }
    __rshift__(spec, reset) {
        // ── Workshop preset command: video1 >> wspreset("name") ──────────
        if (spec && spec._wsPreset != null) {
            workshopSend({ t: 'workshop', cmd: 'preset', name: spec._wsPreset });
            return this;
        }
        // ── Workshop global commands ──────────────────────────────────────
        if (spec && spec._wsCmd) {
            workshopSend({ t: 'workshop', ...spec._wsCmd });
            return this;
        }

        // A workshop layer used to be forwarded to a separate app and skipped locally.
        // Its code lives here now, so it is an ordinary layer — same channel, same
        // universal knobs, same crossfader — and only the renderer cares that it draws
        // rather than fields. The w*() command builders still talk to an EXTERNAL
        // workshop over the bridge for anyone running one; a scene name no longer does.
        const _spec = spec instanceof VSpec ? spec : new VSpec();

        _open();
        if (spec && spec.isMix) {                       // become THE crossfader (singleton)
            mixer = { owner: this.name, value: spec.value, dur: Number(spec.dur) || 1, blend: spec.blend };
            layers.delete(this.name);                   // a name is a mixer OR a layer, not both
            return this;
        }
        const s = _spec;
        const cur = (!reset && layers.get(this.name)) || null;
        const p = { ...(cur ? cur.params : {}), ...s.params };
        const ch = Math.max(0, Math.min(1, Math.round(Number(p.ch) || 0)));
        delete p.ch;
        const scene = s.scene || (cur && cur.scene) || null;
        layers.set(this.name, { scene, ch, params: p,
                                fx: { ...(cur ? cur.fx : {}), ...s.fx }, born: _now(),
                                // vsnap() prints only what differs from the layer's own
                                // defaults, so it needs to know what those were.
                                _wsDefaults: (scene && WS_SET.has(scene) && !isScene(scene)) ? wsDefaults(scene) : null });
        if (mixer && mixer.owner === this.name) mixer = null;   // reused a mixer name as a layer
        return this;
    }
    stop() {
        layers.delete(this.name);
        if (mixer && mixer.owner === this.name) mixer = null;
        return this;
    }
    every() { return this; }
    setAttr() { return this; }
}

// Extract channel index from videoN name: video1→0, video2→1, video→0
function _wsChannel(name) {
    const m = String(name).match(/(\d+)$/);
    return m ? Math.max(0, parseInt(m[1]) - 1) : 0;
}

const _players = new Map();
export function getVisualPlayer(name) {
    let p = _players.get(name);
    if (!p) { p = new VisualPlayer(name); _players.set(name, p); }
    return p;
}
export function isVisualName(name) { return /^video\d*$/i.test(name); }   // convention: video1, video2, …
export function isScene(name) { return SCENE_SET.has(name); }
// True if `name` is CURRENTLY a live video layer or the crossfader — any name can be
// video, so autocomplete uses this (not a naming convention) to float scenes first.
export function isVideoLayer(name) { return layers.has(name) || (!!mixer && mixer.owner === name); }

export function clearAll() { layers.clear(); mixer = null; }   // shutup()/panic

// ── vsnap() — the visual state, as CODE ──────────────────────────────────────
//
// The workshop's answer to "save this look" is a preset: a blob of channel state in
// localStorage. crashDot's answer has to be different, because in crashDot the piece
// IS the text — and a look you can read, edit and paste into a set is worth more than
// one you can only recall. It is also the only form that survives a jam: code is in
// the shared buffer, so a look written as code arrives on every peer, while a preset
// in your localStorage arrives nowhere.
//
// So this writes the lines you would have typed to get what is on screen right now,
// including the params you did not type (they come out at their live values) — which
// makes it a way to LEARN a layer as much as to save one. Non-default params only, so
// the line stays readable; vsnap(true) writes every knob.
function fmtVal(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return '[' + v.map(fmtVal).join(', ') + ']';
    const n = Number(v);
    if (!isFinite(n)) return '0';
    return String(Math.round(n * 1000) / 1000);
}
export function vsnap(all = false) {
    const beat = _lastBeat;
    const lines = [];
    for (const [name, l] of layers) {
        if (!l.scene) continue;
        const dur = Number(resolveVisual(l.params.dur, beat, 1)) || 1;
        const def = l._wsDefaults || null;
        // vsnap(true) writes the layer's own defaults too — the params you never typed,
        // which is how you find out a layer HAS them.
        const p = { ...(all && def ? def : {}), ...resolveMap(l.params, beat, dur) };
        const args = [];
        for (const [k, v] of Object.entries(p)) {
            if (v == null) continue;
            if (!all && def && def[k] !== undefined && Number(def[k]) === Number(v)) continue;  // unchanged
            args.push(`${k}=${fmtVal(v)}`);
        }
        if (l.ch) args.push('ch=1');
        let line = `${name} >> ${l.scene}(${args.join(', ')})`;
        const fx = resolveMap(l.fx, beat, dur);
        for (const [k, v] of Object.entries(fx)) if (v != null && v !== false) line += ` + ${k}(${fmtVal(v)})`;
        lines.push(line);
    }
    if (mixer) {
        const v = Number(resolveVisual(mixer.value, beat, mixer.dur)) || 0;
        const bl = resolveVisual(mixer.blend, beat, mixer.dur);
        lines.push(`${mixer.owner} >> mix(${fmtVal(v)}${bl ? `, blend=${fmtVal(bl)}` : ''})`);
    }
    if (master.palette) lines.push(`palette(${JSON.stringify(master.palette)})`);
    if (master.mode)    lines.push(`vmode(${JSON.stringify(master.mode)})`);
    if (master.res)     lines.push(`vres(${fmtVal(master.res)})`);
    return lines.length ? lines.join('\n') : '# nothing on screen';
}

// Snapshot of all active workshop layers with resolved params (for bridge tick).
// Returns null when no WS layers are active.
export function wsSnapshot(beat) {
    const channels = [];
    for (const [name, entry] of layers) {
        if (!entry.scene || !WS_SET.has(entry.scene)) continue;
        const dur = entry.params?.dur ? resolveVisual(entry.params.dur, beat, 1) : 1;
        channels.push({ ch: _wsChannel(name), layer: entry.scene, params: resolveMap(entry.params, beat, dur) });
    }
    return channels.length ? { channels } : null;
}
// Stop one video player by name (its layer or the crossfader it owns) — used by Alt+X /
// .stop() so video stops like any other player.
export function stopVisual(name) { layers.delete(name); if (mixer && mixer.owner === name) mixer = null; }
export function hasContent() { return layers.size > 0 || !!mixer; }

// The resolved, serialisable state for the renderer (called on the clock tick).
let _lastBeat = 0;
export function snapshot(beat) {
    _lastBeat = beat;
    const out = { layers: [], mix: null, palette: master.palette, mode: master.mode, res: master.res, clearSeq };
    for (const [name, l] of layers) {
        if (!l.scene) continue;
        const dur = Number(resolveVisual(l.params.dur, beat, 1)) || 1;
        // `ws` tells the renderer which of the two scene models this is. It is decided
        // here rather than looked up downstream so the renderer, the surface and the
        // pop-out window all agree without importing the layer registry.
        out.layers.push({ name, ch: l.ch, scene: l.scene, ws: !isScene(l.scene) && WS_SET.has(l.scene),
                          params: resolveMap(l.params, beat, dur), fx: resolveMap(l.fx, beat, dur) });
    }
    if (mixer) {
        let v = Number(resolveVisual(mixer.value, beat, mixer.dur)) || 0;
        v = Math.max(0, Math.min(1, v));
        // blend resolves on the clock too → blend=2 (index), "screen" (name), or a pattern all work
        out.mix = { value: v, blend: blendIndex(resolveVisual(mixer.blend, beat, mixer.dur)) };
    }
    return out;
}
