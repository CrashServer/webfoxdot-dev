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
import { SCENES, blendIndex } from './vdata.js';

const SCENE_SET = new Set(SCENES);

// ── Store ────────────────────────────────────────────────────────────────────
const layers = new Map();          // name → { scene, ch, params(raw), fx(raw), born }
let   mixer  = null;               // { owner, value(raw), dur, blend } — SINGLETON crossfader
const master = { palette: null, mode: null, res: null };   // res = GPU render-scale (null → default)
let   clearSeq = 0;                 // bumped by clear() → renderer wipes its feedback buffer
let   _openHook = null;            // () => ensure the visuals window is open (set by index.html)
export function setOpenHook(fn) { _openHook = fn; }
const _open = () => { try { _openHook && _openHook(); } catch (_) {} }
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
function resolveVisual(v, beat, dur) {
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    dur = dur || 1;
    if (v.isTimeVar) {
        const b = dur >= 1 ? Math.floor(beat) : Math.floor(beat / dur) * dur;
        try { return v.get(b); } catch (_) { return 0; }
    }
    if (typeof v.get === 'function' || Array.isArray(v)) {
        try { return patGet(v, Math.floor(beat / dur)); } catch (_) { return 0; }
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

const VFX = { scan: 0.5, trails: 0.7, vignette: 0.5, glitch: 1, invert: true, posterize: 3 };

export function visualBuilders() {
    const out = {};
    for (const s of SCENES) out[s] = sceneBuilder(s);
    for (const [k, d] of Object.entries(VFX)) out[k] = fxBuilder(k, d);
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
    return out;
}

// ── Visual player (vN) ───────────────────────────────────────────────────────
class VisualPlayer {
    constructor(name) { this.name = name; }
    __rshift__(spec, reset) {
        _open();
        if (spec && spec.isMix) {                       // become THE crossfader (singleton)
            mixer = { owner: this.name, value: spec.value, dur: Number(spec.dur) || 1, blend: spec.blend };
            layers.delete(this.name);                   // a name is a mixer OR a layer, not both
            return this;
        }
        const s = spec instanceof VSpec ? spec : new VSpec();
        const cur = (!reset && layers.get(this.name)) || null;
        const p = { ...(cur ? cur.params : {}), ...s.params };
        const ch = Math.max(0, Math.min(1, Math.round(Number(p.ch) || 0)));
        delete p.ch;
        layers.set(this.name, { scene: s.scene || (cur && cur.scene) || null, ch, params: p,
                                fx: { ...(cur ? cur.fx : {}), ...s.fx }, born: _now() });
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
// Stop one video player by name (its layer or the crossfader it owns) — used by Alt+X /
// .stop() so video stops like any other player.
export function stopVisual(name) { layers.delete(name); if (mixer && mixer.owner === name) mixer = null; }
export function hasContent() { return layers.size > 0 || !!mixer; }

// The resolved, serialisable state for the renderer (called on the clock tick).
export function snapshot(beat) {
    const out = { layers: [], mix: null, palette: master.palette, mode: master.mode, res: master.res, clearSeq };
    for (const [name, l] of layers) {
        if (!l.scene) continue;
        const dur = Number(resolveVisual(l.params.dur, beat, 1)) || 1;
        out.layers.push({ name, ch: l.ch, scene: l.scene, params: resolveMap(l.params, beat, dur), fx: resolveMap(l.fx, beat, dur) });
    }
    if (mixer) {
        let v = Number(resolveVisual(mixer.value, beat, mixer.dur)) || 0;
        v = Math.max(0, Math.min(1, v));
        // blend resolves on the clock too → blend=2 (index), "screen" (name), or a pattern all work
        out.mix = { value: v, blend: blendIndex(resolveVisual(mixer.blend, beat, mixer.dur)) };
    }
    return out;
}
