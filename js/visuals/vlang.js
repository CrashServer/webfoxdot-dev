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
import { SCENES, blendIndex, WS_SET, WS_SCENES, WS_FX_NAMES, PALETTE_NAMES } from './vdata.js';
import { defaults as wsDefaults } from './workshop/catalog.js';
import { setWorkshopRes, workshopRes } from './render/wsres.js';
import { startCamera, stopCamera, cameraState, cameraList, switchCamera } from './camera.js';
import { setVisualFps, visualFps, setVisualBudget, visualBudget, visualStats } from './render/vperf.js';
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
// The output manager is supplied from outside (index.html builds it once the renderer
// exists) so the language can offer output() without importing the renderer.
let _outputsApi = null;
export function setOutputs(api) { _outputsApi = api; }
let _vrecFn = null;
export function setVideoRec(fn) { _vrecFn = fn; }
const _outputs = () => _outputsApi;
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
function fxBuilder(key, dflt) {
    return (v) => {
        let x = v === undefined ? dflt : v;
        // lut() names a palette, the way palette() does, because "which colours" is a
        // question you answer with a word. It is stored as a 1-BASED index: the shader
        // needs 0 to mean off, and palette index 0 is a real palette.
        if (key === 'lut' && typeof x === 'string') {
            const i = PALETTE_NAMES.indexOf(x.toLowerCase());
            x = i < 0 ? 0 : i + 1;
        }
        return new VSpec(null, {}, { [key]: x });
    };
}

// Video FX chained with `+` (like synth FX). trails/feedback are frame-feedback; blur/
// bloom/scan/vignette/glitch/invert/posterize are post-process. Values are the default
// amount when called bare, e.g. video1 >> plasma() + bloom() + blur(0.3).
// Exported so a panel can offer them without re-deriving the list — and so the
// distinction stays in one place: these are crashDot's own, applied to the WHOLE
// frame as shader uniforms, as against the workshop's per-layer canvas effects.
export const VFX_DEFAULTS = () => ({ ...VFX });
const VFX = { trails: 0.7, feedback: 0.8, blur: 0.5, bloom: 0.6, scan: 0.5, vignette: 0.5, glitch: 1, invert: true,
              posterize: 3, droste: 0.6, fold: 0.6, hueshift: 0.5, dither: 0.7, pixelsort: 0.6, mirror: 0.8, edge: 0.8, pixelate: 0.5,
              // ── Deck-to-deck ──────────────────────────────────────────────
              // The mixer had two decks and could only ever crossfade them. These
              // three read deck B as DATA for deck A, which is what turns mix() from
              // a fader into a router. They cost almost nothing: both decks are
              // already being evaluated in the same fragment.
              displace: 0.5, lumakey: 0.5, matte: 1,
              // Hold the frame that is already on screen. The cheapest effect here —
              // the scene pass simply does not run — and the only way to look at one.
              freeze: 1,
              // Recolour the FINISHED frame through a palette. palette() steers field
              // scenes only, so until now 206 of the 255 scenes could not be recoloured
              // at all; this is the way in. lut("fire") or lut(2); lutmix fades it.
              lut: 1, lutmix: 1,
              // Master grade + limiter, ported from the workshop's lut.js / limiter.js.
              // NEUTRAL AT 1, unlike everything above it: sat(0) is greyscale, sat(2)
              // is lurid, sat() on its own is a small lift. ceiling(0.8) caps output
              // brightness — the answer to bloom stacking to solid white.
              sat: 1.4, exposure: 1.15, contrast: 1.2, ceiling: 0.85,
              // ── Colour maths, whole-frame ─────────────────────────────────
              // These exist per-layer in the workshop's 52. They are here as well
              // because a FIELD scene cannot take a per-layer effect at all — it is
              // one shader evaluating a scalar field, not a canvas to draw over — so
              // 49 of the 255 scenes were shut out of them entirely, and nothing
              // could apply them to the finished MIX at all.
              rgbshift: 0.5, grain: 0.4, solarize: 0.7, threshold: 0.5, tint: 0.08, halftone: 0.6 };

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
    // wres(px) — the longest edge the CPU-drawn WORKSHOP layers render at, before the
    // GPU stretches them over the frame. Separate from vres() because the costs are
    // different things: vres is GPU shader work, wres is main-thread canvas work, and
    // main-thread work is what makes the audio late. Default 1280; wres(0) = full size.
    out.wres    = (px) => {
        setWorkshopRes(px);
        _open();
        // wres caps the WORKSHOP layers' own canvases and nothing else — a field scene
        // is a shader and never touches one. Set it with only field scenes on screen
        // and it correctly does nothing at all, which is indistinguishable from broken
        // unless somebody says so.
        const anyWs = [...layers.values()].some((l) => l.scene && !isScene(l.scene) && WS_SET.has(l.scene));
        return `wres(${workshopRes() || 'full'})`
             + (anyWs ? '' : ' \u2014 workshop layers only; nothing on screen is one right now');
    };
    // vfps(n) — cap how often the picture is drawn. The biggest single lever there is:
    // 30fps is half the main-thread work of 60 for a picture most sets cannot tell
    // apart. vfps(0) / vfps() = every frame the browser offers.
    out.vfps    = (n) => `vfps(${setVisualFps(n) || 'uncapped'})`;
    // vbudget(ms) — how long the CPU-drawn workshop layers may take per frame before
    // they start redrawing every Nth frame instead. See wsdeck.js's per-layer budget.
    out.vbudget = (ms) => `vbudget(${setVisualBudget(ms)}ms)`;
    // vperf(mode) — the four knobs at once, as one decision about what matters.
    //
    // "Which gets CPU priority, audio or video" has a precise answer here and it is
    // worth stating rather than implying: the audio ENGINE is not on this thread at
    // all. scsynth is WASM in an AudioWorklet, on the browser's real-time audio
    // thread, so no amount of drawing can starve the DSP. What shares the main thread
    // with the picture is the CLOCK, and notes are dispatched 120ms early with a
    // timetag — so the main thread can stall for that long and nothing is late. Past
    // it, notes miss their timetag. These modes decide how much of that slack the
    // visuals are allowed to spend.
    out.vperf = (mode) => {
        const m = String(mode ?? '').toLowerCase();
        // No _open() here. Choosing how much of the machine the picture may have is
        // not the same as asking for a picture, and the panel restores this at boot —
        // announcing the visuals because a preference was remembered is the app
        // talking about itself.
        const set = (fps, res, ws, budget) => {
            setVisualFps(fps); master.res = res; setWorkshopRes(ws); setVisualBudget(budget);
        };
        if (m === 'audio' || m === 'music')  set(30, 0.75, 960,  2);
        else if (m === 'video' || m === 'visuals') set(0, 1, 1920, 8);
        else if (m === 'balanced' || m === 'default') set(0, null, 1280, 4);
        else if (m) return `vperf: "${mode}"? try audio · balanced · video`;
        const st = visualStats();
        return `vperf: ${visualFps() ? visualFps() + 'fps cap' : 'no fps cap'} \u00b7 vres ${master.res ?? 'auto'} \u00b7 `
             + `wres ${workshopRes() || 'full'} \u00b7 budget ${visualBudget()}ms`
             + (st.fps ? ` \u2014 drawing ${st.fps.toFixed(0)}fps at ${st.ms.toFixed(1)}ms/frame` : '');
    };
    // ── The camera ────────────────────────────────────────────────────────
    // camera() asks for it, camera(0) gives it back, camera() again says where it
    // stands. The layers that want it (webcam, media) have read extra.cam since they
    // were written; nothing ever filled it, so they drew nothing and no permission was
    // ever requested. Running the line is the gesture that asks.
    //
    // NOT called webcam(): that name belongs to the LAYER, built by sceneBuilder from
    // the scene list. Taking it for the device command overwrote the builder, so
    // `v1 >> webcam()` asked for the camera and created no layer — the camera came on
    // and the screen stayed black, which is exactly how it was reported.
    out.camera = async (which) => {
        const say = (m, k) => { if (_guard.log) _guard.log(m, k || 'info'); };
        // off is `false` or "off", never 0 \u2014 0 is the FIRST camera, the way it is in
        // theme(0) and panel(0). A toggle and a selector on one argument cannot both
        // own zero, and picking a camera is the thing you will do more often.
        if (which === false || String(which).toLowerCase() === 'off') {
            stopCamera(); say('camera off \u2014 the light goes out', 'ok'); return 'off';
        }

        const listed = async (mark) => {
            const list = await cameraList();
            if (list.length > 1) {
                say(`  ${list.length} cameras:`, 'info');
                list.forEach((c, i) => say(`    ${i}  ${c.label}${mark && c.id === mark ? '   \u2190' : ''}`, 'info'));
                say('    camera(1) or camera("logi") to switch', 'info');
            }
            return list;
        };

        // A bare camera() reports; anything else picks.
        if (which == null) {
            const st = cameraState();
            if (st.live) { say(`camera on \u00b7 ${st.detail}`, 'info'); await listed(st.deviceId); return 'on'; }
            say('camera: asking\u2026', 'info');
            const ok = await startCamera();
            const now = cameraState();
            if (!ok) {
                say(`camera ${now.state}: ${now.detail}`, 'warn');
                if (now.state === 'denied') say('  the browser remembers a refusal \u2014 clear it in the site settings (the icon in the address bar)', 'info');
                if (now.state === 'busy')   say('  close the other tab or app using it, then camera() again', 'info');
                return now.state;
            }
            say(`camera on \u00b7 ${now.detail} \u2014 v1 >> webcam() to see it`, 'ok');
            await listed(now.deviceId);
            return 'on';
        }

        const r = await switchCamera(typeof which === 'object' ? null : which);
        const now = cameraState();
        if (!r.ok) { say(`camera: ${r.why}`, 'warn'); return now.state; }
        say(`camera \u2192 ${r.label || now.detail}  (${r.why}) \u00b7 ${now.detail}`, 'ok');
        return 'on';
    };

    // ── Audio first: the loop closed ──────────────────────────────────────
    //
    // vperf() is the manual version of this: three points on one axis, chosen by
    // hand. The knobs were real and nothing ever drove them, so the picture went on
    // costing whatever it cost and the performer found out by ear.
    //
    // This drives the same axis from the measurement. It does NOT act on a slow
    // frame or a high budget — by design it acts only when the clock has actually
    // been later than the lookahead, which means notes were already late. Below that
    // line a stall is free, and degrading the picture to fix a problem nobody can
    // hear would be a worse trade than the one it is preventing.
    //
    // Down fast, up slow: one late tick steps down at once, and it takes ten clean
    // seconds to give a step back. A governor that restored as eagerly as it cut
    // would oscillate through the whole set.
    out.audiofirst = (on) => {
        if (on != null) {
            _guard.on = !!on;
            if (!_guard.on && _guard.level > 0) _guardApply(0);   // hands it back
            _guard.level = 0; _guard.clear = 0; _guard.seen = null;
        }
        const st = visualStats();
        const line = `audiofirst ${_guard.on ? 'on' : 'off'}`
             + (_guard.level ? ` \u00b7 stepped down ${_guard.level} (${_guard.acted} time${_guard.acted === 1 ? '' : 's'})` : ' \u00b7 not needed yet')
             + ` \u00b7 ${visualFps() ? visualFps() + 'fps cap' : 'no fps cap'} \u00b7 wres ${workshopRes() || 'full'}`
             + ` \u00b7 budget ${visualBudget()}ms`
             + (st.fps ? ` \u2014 drawing ${st.fps.toFixed(0)}fps` : '');
        // Say it. A visual command's return value is not logged, so a command that
        // only returned its state would look like it had done nothing at all.
        if (_guard.log) _guard.log(line, 'info');
        return line;
    };

    // ── Output windows ────────────────────────────────────────────────────
    // output()       open a projector window (one full-frame surface)
    // output(2)      …with 2 independently warped surfaces — one per face of the
    //                object you are mapping onto
    // output("reopen")  bring back a saved output with its mapping
    // outclose(i) · outlist()
    // In the window: [w] warp · [m] 4pt/edge/mesh · [ and ] grid · [r] reset · [f] full
    out.output  = (n = 1) => {
        _open();
        if (n === 'reopen') { _outputs()?.reopen(0); return 'output("reopen")'; }
        const api = _outputs();
        if (!api) return 'output: not available';
        const o = api.addOutput();
        for (let i = 1; i < (Number(n) || 1); i++) api.addSurface(o);
        return `output(${n})`;
    };
    out.outclose = (i = 0) => { _outputs()?.close(Number(i) || 0); return `outclose(${i})`; };
    out.outlist  = () => JSON.stringify(_outputs()?.list() || []);
    // vrec()  arm — every frame from here on is captured
    // vrec()  again — stop and download a .webm   ·   vrec("name") names the file
    // crashDot could already record the audio, the code and the MIDI. This is the
    // picture, from the same canvas you are looking at.
    out.vrec = (name) => _vrecFn ? _vrecFn(name) : 'vrec: not available';
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

// Layers that cannot draw without the camera. They ask for it themselves.
const CAM_LAYERS = new Set(['webcam', 'media']);

// ── The audio-first governor ─────────────────────────────────────────────────
// State for out.audiofirst(). Kept at module scope so a re-eval of the language
// does not reset a governor that is mid-intervention.
const _guard = {
    on: true,          // acts only when the clock has ALREADY been late, so on is safe
    level: 0,          // 0 = the performer's own settings
    clear: 0,          // consecutive clean seconds
    acted: 0,          // how many times it has stepped down this session
    seen: null,        // last cumulative late-tick count
    base: null,        // the settings to give back
    applied: null,     // what the governor itself last wrote, to spot a manual change
    late: null,        // () => cumulative count of ticks later than the lookahead
    log: null,
};

/** Where the late-tick count comes from. Injected so this file never imports the clock. */
export function setGuardSource(fn, logFn) { _guard.late = fn; _guard.log = logFn || null; }
export function guardState() { return { on: _guard.on, level: _guard.level, acted: _guard.acted }; }

// Down the same axis vperf() walks by hand.
const _GUARD_STEPS = [
    null,                                        // 0 — whatever the performer chose
    { fps: 30, ws: 1280, budget: 4,   res: null },
    { fps: 30, ws: 960,  budget: 2,   res: 0.75 },
    { fps: 24, ws: 720,  budget: 1.5, res: 0.6  },
];

function _guardRead() {
    return { fps: visualFps(), ws: workshopRes(), budget: visualBudget(), res: master.res };
}
function _guardWrite(v) {
    setVisualFps(v.fps); setWorkshopRes(v.ws); setVisualBudget(v.budget); master.res = v.res;
    _guard.applied = _guardRead();
}
function _guardApply(level) {
    if (level === 0) {
        if (_guard.base) _guardWrite(_guard.base);
        _guard.applied = null;
        return;
    }
    if (!_guard.base) _guard.base = _guardRead();
    _guardWrite(_GUARD_STEPS[level]);
}

/**
 * One second of governing. Call on an interval; costs two reads and a compare.
 * @returns {string|null} what it did, for the caller to log
 */
export function guardTick() {
    if (!_guard.on || !_guard.late) return null;
    let total = 0;
    try { total = _guard.late() || 0; } catch (_) { return null; }
    if (_guard.seen === null) { _guard.seen = total; return null; }

    // The performer's hand always wins: anything written to these knobs by hand
    // becomes the new baseline, and the governor starts again from there.
    if (_guard.applied) {
        const now = _guardRead();
        for (const k of ['fps', 'ws', 'budget', 'res']) {
            if (now[k] !== _guard.applied[k]) {
                _guard.base = now; _guard.applied = null; _guard.level = 0; _guard.clear = 0;
                break;
            }
        }
    }

    const late = total - _guard.seen;
    _guard.seen = total;

    if (late > 0) {
        _guard.clear = 0;
        if (_guard.level < _GUARD_STEPS.length - 1) {
            _guard.level++;
            _guard.acted++;
            _guardApply(_guard.level);
            const s = _GUARD_STEPS[_guard.level];
            return `audio first: ${late} note${late === 1 ? '' : 's'} went out late \u2014 `
                 + `picture stepped down to ${s.fps}fps / wres ${s.ws} / budget ${s.budget}ms`;
        }
        return null;                      // already as low as it goes; saying so every second helps nobody
    }

    if (_guard.level > 0 && ++_guard.clear >= 10) {
        _guard.clear = 0;
        _guard.level--;
        _guardApply(_guard.level);
        return _guard.level === 0
            ? 'audio first: clear for 10s \u2014 the picture has its settings back'
            : `audio first: clear for 10s \u2014 picture stepped back up to ${_GUARD_STEPS[_guard.level].fps}fps`;
    }
    return null;
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
        // A layer that needs the camera asks for it the moment it is used: running the
        // line IS the gesture, and being told to type a second command to make the
        // first one do anything is the sort of thing you discover on stage.
        if (_spec.scene && CAM_LAYERS.has(_spec.scene) && !cameraState().live) {
            startCamera().then((ok) => {
                if (_guard.log) _guard.log(ok ? `camera on \u00b7 ${cameraState().detail}`
                    : `camera ${cameraState().state}: ${cameraState().detail}`, ok ? 'ok' : 'warn');
            });
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
        _drainPending(this.name, layers.get(this.name));
        return this;
    }
    stop() {
        layers.delete(this.name);
        if (mixer && mixer.owner === this.name) mixer = null;
        return this;
    }
    /**
     * video1.hue = 200 — live-tweak ONE control of a running layer.
     *
     * This was a no-op that returned `this`, so the syntax that works on every audio
     * player (p1.lpf = 800) silently did nothing on a video layer, with no error to
     * say so. A key the FX table knows goes to the fx bucket, everything else to the
     * layer's params — the same split VSpec makes, so the result is what writing it
     * into the >> line would have produced.
     */
    setAttr(key, value) {
        if (key === 'ch') { setLayerChannel(this.name, value); return this; }
        // setLayerParam / setLayerFx already hold the value when the layer is not live
        // yet and apply it on arrival — the same path the panel's knobs go through, so
        // typing the change and dragging it land in exactly the same place.
        if (Object.prototype.hasOwnProperty.call(VFX, key)) setLayerFx(this.name, key, value);
        else setLayerParam(this.name, key, value);
        return this;
    }

    /**
     * .every(beats, action, …) — do something to the picture on the beat grid.
     *
     * Was a no-op too. The actions are the ones that mean something to a LAYER
     * rather than to a note: there is no "reverse" or "stutter" for a picture.
     */
    every(beats, action, ...args) {
        const n = Number(beats);
        if (!(n > 0) || !action) return this;
        const gen = (_everyGen.get(this.name) || 0) + 1;
        _everyGen.set(this.name, gen);
        const tick = () => {
            if (_everyGen.get(this.name) !== gen) return;      // superseded
            if (!layers.has(this.name)) return;                // layer stopped → stop
            this._do(String(action), args);
            _clock && _clock.mod(n, tick);
        };
        _clock && _clock.mod(n, tick);
        return this;
    }

    _do(action, args) {
        const L = layers.get(this.name);
        if (!L) return;
        switch (action) {
            case 'ch':      L.ch = L.ch ? 0 : 1; break;                       // hop decks
            case 'stop':    this.stop(); break;
            case 'scene':   if (args.length) L.scene = String(args[Math.floor(Math.random() * args.length)]); break;
            case 'reroll':  _rerollFn?.(this.name, 0); break;                 // one-shot re-eval
            default:
                // Anything else is read as "set this control", so .every(4, 'hue', 0, 180)
                // alternates a value on the grid without inventing a verb for it.
                if (args.length) {
                    const v = args[(_everyStep.get(this.name) || 0) % args.length];
                    _everyStep.set(this.name, (_everyStep.get(this.name) || 0) + 1);
                    this.setAttr(action, v);
                }
        }
    }

    /** .reroll(beats) — re-run this line every N beats so its random params re-roll. */
    reroll(beats = 8) { _rerollFn?.(this.name, beats); return this; }
}
const _everyGen = new Map();
const _everyStep = new Map();
// The clock, for .every()'s beat grid — set from index.html alongside the others.
let _clock = null;
export function setVisualClock(c) { _clock = c; }
// index.html owns re-evaluating a line (it has the source and the buffer it lives in).
let _rerollFn = null;
export function setVisualReroll(fn) { _rerollFn = fn; }

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
/** The GPU resolution multiplier vres() set, or null for the default. A getter so a
 *  panel can SHOW what the language was told, instead of keeping its own copy. */
export function visualRes() { return master.res; }
/**
 * Set it WITHOUT the "here is where the picture went" hint the vres() command emits.
 * Typing vres() means you want the picture; a panel restoring a saved preference at
 * boot, or a knob being dragged, does not — and announcing the visuals because the
 * app remembered a performance setting is the app talking about itself.
 */
export function setVisualRes(v) { master.res = (v == null) ? null : Number(v); }
export function isVisualName(name) { return /^video\d*$/i.test(name); }   // convention: video1, video2, …
export function isScene(name) { return SCENE_SET.has(name); }
// True if `name` is CURRENTLY a live video layer or the crossfader — any name can be
// video, so autocomplete uses this (not a naming convention) to float scenes first.
export function isVideoLayer(name) { return layers.has(name) || (!!mixer && mixer.owner === name); }

export function clearAll() { layers.clear(); mixer = null; }   // shutup()/panic

// ── Live layer inspection & tweaking ─────────────────────────────────────────
// What the LAYERS panel drives. Reading is easy — snapshot() already resolves
// everything — but setting needs care: a param the user is holding a knob on must
// become a plain number, replacing whatever pattern or TimeVar was there. That is
// the honest behaviour, because a knob cannot represent sinvar([0,1],8) and pretending
// it can would silently discard the movement on the next frame anyway. vsnap() then
// writes back what you actually have.
export function liveLayers() {
    const out = [];
    for (const [name, l] of layers) {
        if (!l.scene) continue;
        out.push({ name, scene: l.scene, ch: l.ch, params: { ...l.params }, fx: { ...l.fx },
                   ws: !isScene(l.scene) && WS_SET.has(l.scene) });
    }
    return out;
}
// Edits that arrived for a layer this machine has not run yet. A peer joining a room
// mid-set receives every knob position before it has evaluated the code that creates
// the layers, and dropping those would mean the picture agreed on the code but not on
// the performance. Held here and drained the moment the layer appears.
const pending = new Map();          // name -> { params:{}, fx:{}, ch }
const _pend = (name) => { let p = pending.get(name); if (!p) pending.set(name, p = { params: {}, fx: {} }); return p; };
function _drainPending(name, l) {
    const p = pending.get(name);
    if (!p) return;
    pending.delete(name);
    for (const [k, v] of Object.entries(p.params)) { if (v == null) delete l.params[k]; else l.params[k] = v; }
    for (const [k, v] of Object.entries(p.fx))     { if (v == null) delete l.fx[k];     else l.fx[k] = v; }
    if (p.ch != null) l.ch = p.ch;
}

export function setLayerParam(name, key, value) {
    const l = layers.get(name);
    if (!l) { _pend(name).params[key] = value; return false; }
    if (value == null) delete l.params[key]; else l.params[key] = value;
    return true;
}
/**
 * Add, change or remove one effect on a layer. Order is the chain order, and JS keeps
 * object keys in insertion order, so a newly added effect lands at the END of the
 * chain — which is what "+ vhs(0.6)" on the line would have done too.
 */
export function setLayerFx(name, key, value) {
    const l = layers.get(name);
    if (!l) { _pend(name).fx[key] = value; return false; }
    if (value == null) delete l.fx[key]; else l.fx[key] = value;
    return true;
}
export function setLayerChannel(name, ch) {
    const l = layers.get(name);
    if (!l) { _pend(name).ch = Math.max(0, Math.min(1, Math.round(Number(ch) || 0))); return false; }
    l.ch = Math.max(0, Math.min(1, Math.round(Number(ch) || 0)));
    return true;
}

// ── The live-coding feed ─────────────────────────────────────────────────────
//
// Five of the workshop's layers — codeFull · codeComic · codeConspiracy · liveCode ·
// evalSeismograph — are ABOUT live coding: they render the code being typed, flash on evaluation, and
// pull `player >> instrument()` pairs out of the text to give each instrument a colour.
// They read it from `extra.live`, which in the workshop arrives over a WebSocket from
// whatever machine is performing. Here the performer IS this window, so the feed is
// simply the editor — and your code becomes a texture you can put on a wall.
//
// Shape is the workshop's, so the layers need no changes: a per-user window of lines
// (it names two, `svdk` and the other performer), an eval counter the layers latch on,
// and the beat. In a session the peers' evals arrive through collab and go in the
// second slot, so a jam shows both people's code.
const live = { evalCount: 0, lastEvalUser: '', beat: 0, pulse: 0, cpu: 0,
               svdk: { lines: '' }, zbdm: { lines: '' }, otherUser: '', players: [] };

/**
 * Record an evaluation. `who` is null for you; a peer name in a session.
 * The text is what the layers render, so it is the code that RAN, not the buffer.
 */
export function noteEval(text, who = null) {
    live.evalCount++;
    live.lastEvalUser = who || 'svdk';
    const slot = who ? 'zbdm' : 'svdk';
    if (who) live.otherUser = who;
    // In troop mode the room owns both slots — your own evals would otherwise take
    // the wall back every time you ran a line.
    if (_codeSource === 'troop') return;
    live[slot] = { lines: String(text || '').split('\n').slice(0, 200).join('\n') };
}
/** The buffer on screen, so the code layers show what you are TYPING, not only evals. */
export function noteBuffer(text) { if (!live.evalCount) live.svdk = { lines: String(text || '') }; }
/** Names of the players currently sounding — some layers draw one shape per instrument. */
export function notedPlayers(names) { live.players = names || []; }

/**
 * A watched webTroop session's buffer, into the SECOND performer's slot.
 *
 * The slot is the whole point: the code layers were built for two performers, so
 * putting the troop in the second one means their code and yours appear together
 * rather than one replacing the other — which is what you want on a wall behind a
 * band, and what you get for free by not inventing a third channel.
 *
 * No eval counter here, deliberately. Their shared buffer changes on every
 * KEYSTROKE, not on every eval, and the counter is what the layers latch their
 * flash on — bumping it per character would strobe the wall.
 */
/**
 * What the code layers are currently being fed, read-only.
 *
 * The feed is two performer slots and a counter, and until now nothing outside this
 * module could see any of it — which made "is the troop's code actually getting
 * through?" a question you could only answer by looking at a wall. Copies, so a
 * caller cannot reach in and edit the live state by accident.
 */
export function liveFeed() {
    return {
        evalCount: live.evalCount, lastEvalUser: live.lastEvalUser, otherUser: live.otherUser,
        source: _codeSource,
        mine:  (live.svdk && live.svdk.lines) || '',
        other: (live.zbdm && live.zbdm.lines) || '',
        players: [...live.players],
    };
}

// Whose code the CODE LAYERS draw. The feed has always had two performer slots and
// no way to say which one you wanted on the wall.
//
//   'both'  — you in one slot, the troop in the other, which is what the layers that
//             show two columns were built for
//   'troop' — the room's code in BOTH slots, so every code layer shows them, including
//             the ones that draw a single stream
//   'me'    — the troop never reaches the visuals at all
let _codeSource = 'both';
export function codeSource(mode) {
    if (mode == null) return _codeSource;
    const m = String(mode).toLowerCase();
    _codeSource = ['both', 'troop', 'me'].includes(m) ? m : 'both';
    // Act on the code already in hand. Waiting for their next keystroke means the
    // switch appears to do nothing for as long as nobody at the other end is typing
    // — which, between two numbers in a set, can be the whole section.
    if (_codeSource === 'me') { live.zbdm = { lines: '' }; live.otherUser = ''; }
    if (_codeSource === 'troop') live.svdk = live.zbdm || { lines: '' };
    return _codeSource;
}

// Some code layers pick their stream from lastEvalUser and only redraw when the eval
// counter moves — codeFull and evalSeismograph among them. The troop's buffer changes
// on every keystroke and bumping the counter per character would strobe the wall, so
// it is pulsed on a timer instead: often enough to read as live typing, slow enough
// to be a scroll rather than a flicker.
const TROOP_PULSE_MS = 400;
let _lastPulse = 0;

export function noteTroop(text, user = 'troop') {
    if (_codeSource === 'me') return;
    // webTroop's pretext window arrives as an ARRAY of lines; their shared buffer
    // arrives as a string. String(array) would comma-join it into one long line,
    // which renders as a smear rather than as code.
    const t = Array.isArray(text) ? text.join('\n') : String(text || '');
    const win = { lines: t.split('\n').slice(0, 200).join('\n') };
    live.zbdm = win;
    live.otherUser = user;
    // In troop mode their code is the picture: put it in your slot too, so a layer
    // that draws one stream draws theirs rather than whatever you last evaluated.
    if (_codeSource === 'troop') live.svdk = win;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - _lastPulse >= TROOP_PULSE_MS) {
        _lastPulse = now;
        live.evalCount++;
        // Anything but 'svdk' selects the second slot in the layers that choose.
        live.lastEvalUser = _codeSource === 'troop' ? user : user;
    }
}

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
export function vsnap(all = false, only = null) {
    const beat = _lastBeat;
    const lines = [];
    for (const [name, l] of layers) {
        if (!l.scene) continue;
        if (only && name !== only) continue;
        const dur = Number(resolveVisual(l.params.dur, beat, 1)) || 1;
        const def = l._wsDefaults || null;
        // vsnap(true) writes the layer's own defaults too — the params you never typed,
        // which is how you find out a layer HAS them.
        const p = { ...(all && def ? def : {}), ...l.params };
        const args = [];
        for (const [k, rv] of Object.entries(p)) {
            if (rv == null) continue;
            // A LIVE CONTROL — midi(), mlearn(), aud() — writes itself back as the
            // control, not as the number it happens to read at this instant. Freezing
            // one is the single thing "write it back as code" must not do: the whole
            // point of the binding is that it moves, and a snapshot of it is a look you
            // cannot get back. Anything else is sampled, as it always was.
            if (rv && typeof rv.toCode === 'function') { args.push(`${k}=${rv.toCode()}`); continue; }
            const v = resolveVisual(rv, beat, dur);
            if (v == null) continue;
            if (!all && def && def[k] !== undefined && Number(def[k]) === Number(v)) continue;  // unchanged
            args.push(`${k}=${fmtVal(v)}`);
        }
        if (l.ch) args.push('ch=1');
        let line = `${name} >> ${l.scene}(${args.join(', ')})`;
        for (const [k, rv] of Object.entries(l.fx)) {
            if (rv && typeof rv.toCode === 'function') { line += ` + ${k}(${rv.toCode()})`; continue; }
            const v = resolveVisual(rv, beat, dur);
            if (v != null && v !== false) line += ` + ${k}(${fmtVal(v)})`;
        }
        lines.push(line);
    }
    if (mixer && !only) {
        const v = Number(resolveVisual(mixer.value, beat, mixer.dur)) || 0;
        const bl = resolveVisual(mixer.blend, beat, mixer.dur);
        lines.push(`${mixer.owner} >> mix(${fmtVal(v)}${bl ? `, blend=${fmtVal(bl)}` : ''})`);
    }
    if (master.palette && !only) lines.push(`palette(${JSON.stringify(master.palette)})`);
    if (master.mode && !only)    lines.push(`vmode(${JSON.stringify(master.mode)})`);
    if (master.res && !only)     lines.push(`vres(${fmtVal(master.res)})`);
    if (visualFps() && !only)    lines.push(`vfps(${fmtVal(visualFps())})`);
    if (visualBudget() !== 4 && !only) lines.push(`vbudget(${fmtVal(visualBudget())})`);
    if (workshopRes() !== 1280 && !only) lines.push(`wres(${fmtVal(workshopRes())})`);
    return lines.length ? lines.join('\n') : '# nothing on screen';
}

// Stop one video player by name (its layer or the crossfader it owns) — used by Alt+X /
// .stop() so video stops like any other player.
export function stopVisual(name) { layers.delete(name); if (mixer && mixer.owner === name) mixer = null; }
export function hasContent() { return layers.size > 0 || !!mixer; }

// The resolved, serialisable state for the renderer (called on the clock tick).
let _lastBeat = 0;
export function snapshot(beat) {
    _lastBeat = beat;
    live.beat = beat;
    live.pulse = beat - Math.floor(beat);
    const out = { layers: [], mix: null, palette: master.palette, mode: master.mode, res: master.res,
                  // The pop-out window has no language of its own, so the settings
                  // travel with the state — see state.js.
                  fps: visualFps(), budget: visualBudget(), clearSeq, live };
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
