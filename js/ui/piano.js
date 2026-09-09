// Virtual piano — play any synth with the mouse or the computer keyboard, then turn
// what you played into a player line.
//
// Two halves, and the second is the point. Playing is nice; what a live-coding tool
// actually wants is a way to FIND a phrase by ear and then have it as code you can
// pattern, transform and re-run. So the keyboard records what you play against the
// clock, and "to code" writes it into the buffer as a real line:
//
//     p1 >> pluck([0, 2, 4, (0, 4), _, 2], dur=[1/2, 1/4, ...], oct=5)
//
// Notes land as SCALE DEGREES in the current Scale/Root, because that is what the
// rest of crashDot speaks — a degree list transposes with the key, a MIDI number
// does not. Notes struck at the same quantised beat become a chord group, gaps
// become rests.
//
// Deliberately self-contained: it talks to the engine through one injected
// playNote(), and to the editor through one injected insert(). Nothing here knows
// about the desktop UI, so it works the same in the classic layout.
//
// One honest limitation: crashDot's synthdefs have no gate — every voice ends in an
// envelope with doneAction:2 and frees itself — so there is no note-off to send. The
// audible length is the `sus` control; how long you HOLD a key is recorded and used
// for the note's duration in the generated code, but it cannot shorten a voice that
// is already sounding.

import { makeKnob } from './knob.js';
import { draggable } from './dragpanel.js';

let _modal = null, _open = false;
let _ctx = {
    playNote: () => {},        // (synthName, midi, {sus, amp}) → fire a voice now
    insert:   () => {},        // (code, targetName) → put this line in that buffer
    targets:  () => [],        // [{ name, active }] — every buffer you could send to
    beat:     () => 0,         // clock.now()
    bpm:      () => 120,       // clock.bpm — for the un-booted fallback below
    synths:   () => ['pluck'], // available synth names
    scale:    () => ({ scale: [0, 2, 3, 5, 7, 8, 10], root: 0, name: 'minor' }),
    // name → { defaults, extraParams } for the chosen synth, so its own knobs can
    // be built from the same definition the engine plays it with.
    synthDef: () => null,
    // MIDI, supplied by index.html so this module stays free of engine imports.
    onMidiNote: () => {},      // (fn|null) → route note on/off here
    midiLearn:  () => null,    // (onValue) → arm learn, returns a handle
    midiUnlearn:() => {},      // (handle)  → drop that binding
    log:      () => {},
};

// ── Parameter ranges ────────────────────────────────────────────────────────
// A synth definition carries defaults but no ranges — the engine never needed
// them. Knobs do. Named parameters get a range chosen by ear; anything unknown is
// derived from its own default, which is a better guess than a fixed 0..1 and is
// never silently wrong in a way you cannot drag out of.
const RANGES = {
    cutoff: { min: 20, max: 20000, curve: 'exp' },
    lpf:    { min: 20, max: 20000, curve: 'exp' },
    hpf:    { min: 20, max: 20000, curve: 'exp' },
    freq:   { min: 20, max: 20000, curve: 'exp' },
    rq:     { min: 0.01, max: 2, curve: 'exp' },
    lpr:    { min: 0.01, max: 2, curve: 'exp' },
    attack: { min: 0.001, max: 4, curve: 'exp' },
    release:{ min: 0.001, max: 8, curve: 'exp' },
    decay:  { min: 0.001, max: 8, curve: 'exp' },
    pan:    { min: -1, max: 1 },
    dist:   { min: 0, max: 20 },
    drive:  { min: 0, max: 20 },
    crush:  { min: 0, max: 16 },
    squash: { min: 0, max: 20 },
    room:   { min: 0, max: 1 },
    reverb: { min: 0, max: 1 },
    mix:    { min: 0, max: 1 },
    spin:   { min: 0, max: 4 },
    sub:    { min: 0, max: 2 },
    phase:  { min: 0, max: 1 },
    harm:   { min: 0, max: 8 },
};
function rangeFor(name, def) {
    if (RANGES[name]) return { ...RANGES[name], default: def };
    const d = Number(def);
    if (!Number.isFinite(d)) return { default: def };            // unbounded → relative drag
    if (d === 0)            return { min: 0, max: 1, default: 0 };
    const mag = Math.abs(d);
    return { min: d < 0 ? -mag * 4 : 0, max: mag * 4, default: d };
}

// The parameters worth a knob: the synth's OWN ones, plus the shaping controls
// every voice has. oct / amp / dur / sus are already controls on the panel itself.
const SKIP = new Set(['oct', 'amp', 'dur', 'sus', 'degree', 'freq', 'bus', 'out']);
function paramsOf(def) {
    if (!def || !def.defaults) return [];
    const own = new Set(def.extraParams || []);
    const names = Object.keys(def.defaults).filter(n => !SKIP.has(n));
    // synth-specific first — they are the ones that make it sound like itself
    return names.sort((a, b) => (own.has(b) ? 1 : 0) - (own.has(a) ? 1 : 0) || a.localeCompare(b));
}

const OCT_MIN = 1, OCT_MAX = 8;
// Tracker/DAW keyboard layout: the home row is white keys, the row above is black.
const KEYMAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ';': 16,
};
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let _oct = 5, _synth = 'pluck', _sus = 0.5, _amp = 0.7, _snap = true, _octaves = 2;
// Live values for the current synth's own parameters, and the defaults they were
// read from — only what you have actually MOVED goes into the generated line.
let _params = {}, _paramDefs = {};
// Which buffer "to code" writes into. Chosen explicitly, because with several
// buffers open — some detached into their own panels — "the current editor" is
// whichever one you last clicked, and from the keyboard that looks like it picks
// one at random.
let _target = null;
let _midiOn = false;                 // is a MIDI keyboard playing this piano?
const _ccBind = new Map();           // param name → { handle, cc }
// The take. `armed` is whether new notes are being added; the notes themselves
// survive disarming, because pressing ● again to STOP and then asking for the code
// is the obvious order to do things in — throwing the take away there was just a
// trap.
let _rec = null;              // { armed, startBeat, startT, notes: [...] }
let _down = new Map();        // midi → { beat } while held
let _quant = 0.25;

/** ctx: { playNote, insert, beat, synths, scale, log } — supplied by index.html. */
export function initPiano(ctx) { _ctx = { ..._ctx, ...ctx }; }

export function isPianoOpen() { return _open; }
export function openPiano()  { if (!_modal) build(); _open = true; _modal.classList.remove('hidden'); render(); _modal.focus(); }
export function closePiano() { _open = false; if (_modal) _modal.classList.add('hidden'); }
export function togglePiano() { _open ? closePiano() : openPiano(); }

// ── scale helpers ───────────────────────────────────────────────────────────
// Inverse of engine/scale.js toMidi(): midi → the degree that would produce it at
// the given octave. Returns null when the note is not in the scale.
function midiToDegree(midi, oct, scale, root) {
    const n = scale.length;
    const delta = midi - root - oct * 12;
    const octShift = Math.floor(delta / 12);
    const pc = delta - octShift * 12;
    const idx = scale.indexOf(pc);
    return idx < 0 ? null : idx + octShift * n;
}

// Nearest degree when the played note is off-scale (chromatic play, snap off).
function nearestDegree(midi, oct, scale, root) {
    let best = null, bestD = 1e9;
    for (let d = -n2(scale) * 3; d <= n2(scale) * 3; d++) {
        const m = oct * 12 + scale[((d % scale.length) + scale.length) % scale.length]
                + Math.floor(d / scale.length) * 12 + root;
        const dist = Math.abs(m - midi);
        if (dist < bestD) { bestD = dist; best = d; }
    }
    return { degree: best, off: bestD };
}
function n2(scale) { return scale.length; }

// Is this MIDI note in the current scale?
function inScale(midi, scale, root) {
    return scale.includes((((midi - root) % 12) + 12) % 12);
}

// ── playing ─────────────────────────────────────────────────────────────────
function noteOn(midi, vel = 1) {
    if (_down.has(midi)) return;
    const { scale, root } = _ctx.scale();
    let m = midi;
    if (_snap && !inScale(m, scale, root)) {
        // walk to the nearest scale tone rather than refusing the key
        for (let k = 1; k <= 6; k++) {
            if (inScale(m - k, scale, root)) { m -= k; break; }
            if (inScale(m + k, scale, root)) { m += k; break; }
        }
    }
    // Wall time as well as the beat: the clock does not advance until audio is
    // booted, and a phrase played before then would otherwise land on one beat and
    // collapse into a single chord. See toCode().
    _down.set(midi, { beat: _ctx.beat(), t: performance.now(), midi: m });
    _ctx.playNote(_synth, m, { ..._params, sus: _sus, amp: _amp * vel });
    markKey(midi, true);
}

function noteOff(midi) {
    const held = _down.get(midi);
    _down.delete(midi);
    markKey(midi, false);
    if (!held || !_rec || !_rec.armed) return;
    _rec.notes.push({
        midi: held.midi, beat: held.beat, t: held.t,
        heldBeats: Math.max(0, _ctx.beat() - held.beat),
        heldMs:    Math.max(30, performance.now() - held.t),
    });
}

function markKey(midi, on) {
    const el = _modal?.querySelector(`.pk[data-midi="${midi}"]`);
    if (el) el.classList.toggle('on', on);
}

// ── record → code ───────────────────────────────────────────────────────────
function toCode() {
    // Still holding keys when you ask for the code? Take those notes too.
    if (_rec && _rec.armed) for (const m of [..._down.keys()]) noteOff(m);
    if (!_rec || !_rec.notes.length) { _ctx.log('piano: nothing recorded yet — arm ● rec and play something', 'warn'); return; }
    const { scale, root, name } = _ctx.scale();
    const q = _quant;

    // The clock only runs once audio is booted. If the beat never moved, fall back
    // to wall time converted at the current tempo — so the piano is usable (and
    // records a real rhythm) before you have booted, instead of stacking the whole
    // take onto beat zero.
    const spread = Math.max(..._rec.notes.map(x => x.beat)) - Math.min(..._rec.notes.map(x => x.beat));
    const useWall = spread < 1e-6;
    const bpm = Math.max(1, _ctx.bpm() || 120);
    const beatOf = (x) => useWall ? (x.t - _rec.startT) / 1000 * bpm / 60 : x.beat - _rec.startBeat;
    const heldOf = (x) => useWall ? x.heldMs / 1000 * bpm / 60 : x.heldBeats;
    if (useWall) _ctx.log('piano: the clock is not running — timing taken from wall time at '
        + Math.round(bpm) + ' bpm', 'info');

    const notes = [..._rec.notes].sort((a, b) => beatOf(a) - beatOf(b));
    const t0 = Math.round(beatOf(notes[0]) / q) * q;

    // Group by quantised onset → chords.
    const slots = new Map();
    let offScale = 0;
    for (const nt of notes) {
        const at = Math.round(beatOf(nt) / q) * q - t0;
        let deg = midiToDegree(nt.midi, _oct, scale, root);
        if (deg === null) { const nd = nearestDegree(nt.midi, _oct, scale, root); deg = nd.degree; offScale++; }
        if (!slots.has(at)) slots.set(at, { degs: [], held: heldOf(nt) });
        const s = slots.get(at);
        if (!s.degs.includes(deg)) s.degs.push(deg);
        s.held = Math.max(s.held, heldOf(nt));
    }

    // Walk the timeline, emitting rests for the gaps.
    const times = [...slots.keys()].sort((a, b) => a - b);
    const degs = [], durs = [];
    for (let i = 0; i < times.length; i++) {
        const at = times[i];
        const next = i + 1 < times.length ? times[i + 1] : at + Math.max(q, Math.round(slots.get(at).held / q) * q);
        const span = Math.max(q, next - at);
        const s = slots.get(at);
        degs.push(s.degs.length > 1 ? `(${s.degs.join(', ')})` : String(s.degs[0]));
        durs.push(fmtDur(span));
    }
    const allSame = durs.every(d => d === durs[0]);
    const durPart = allSame ? durs[0] : `[${durs.join(', ')}]`;
    // Only parameters you actually moved: a line restating every default would be
    // noise, and the defaults are what the synth does anyway.
    const moved = Object.entries(_params)
        .filter(([k, v]) => Number(v) !== Number(_paramDefs[k]))
        .map(([k, v]) => `, ${k}=${Math.round(v * 1000) / 1000}`).join('');
    const line = `p1 >> ${_synth}([${degs.join(', ')}], dur=${durPart}, oct=${_oct}, sus=${_sus}${moved})`;

    renderTargets();                       // in case the list changed since you last looked
    const where = _ctx.insert(line, _target);
    _ctx.log(`piano → ${where ? `"${where}"` : 'the editor'}: ${degs.length} step${degs.length === 1 ? '' : 's'} in ${name}`
        + (offScale ? ` · ${offScale} note${offScale === 1 ? '' : 's'} snapped to the scale` : ''), 'ok');
}

// Durations read better as the fractions people write than as decimals.
function fmtDur(v) {
    for (const d of [1, 2, 4, 8, 16]) {
        if (Math.abs(v - 1 / d) < 1e-6) return d === 1 ? '1' : `1/${d}`;
        if (Math.abs(v - 3 / d) < 1e-6) return `3/${d}`;
    }
    return String(Math.round(v * 1000) / 1000);
}

// ── UI ──────────────────────────────────────────────────────────────────────
function build() {
    _modal = document.createElement('div');
    _modal.id = 'piano-modal';
    _modal.className = 'hidden';
    _modal.tabIndex = 0;                // so the computer keyboard only plays when focused
    _modal.innerHTML = `
        <div class="piano-head">
            <span class="piano-title">piano</span>
            <select class="piano-synth" title="which synth the keys play"></select>
            <span class="piano-ctl">oct <button class="piano-oct-dn">−</button><b class="piano-oct">5</b><button class="piano-oct-up">+</button></span>
            <span class="piano-ctl">sus <input class="piano-sus" type="range" min="0.05" max="2" step="0.05" value="0.5"></span>
            <span class="piano-ctl">amp <input class="piano-amp" type="range" min="0.05" max="1.2" step="0.05" value="0.7"></span>
            <button class="piano-snap on" title="snap off-scale keys to the current scale — keeps what you record playable as degrees">snap</button>
            <button class="piano-midi" title="play this piano from a MIDI keyboard — same synth, same knobs, and it records like the on-screen keys">midi</button>
            <div class="piano-drag"></div>
            <button class="piano-close" title="close">×</button>
        </div>
        <div class="piano-keys"></div>
        <div class="piano-params"></div>
        <div class="piano-foot">
            <button class="piano-rec" title="record what you play against the clock">● rec</button>
            <button class="piano-code" title="write what you played into the editor as a player line">✎ to code</button>
            <span class="piano-ctl">grid
                <select class="piano-quant">
                    <option value="0.5">1/8</option>
                    <option value="0.25" selected>1/16</option>
                    <option value="0.125">1/32</option>
                    <option value="1">1/4</option>
                </select></span>
            <span class="piano-ctl">to <select class="piano-target" title="which buffer ✎ to code writes into"></select></span>
            <span class="piano-hint">keys: a s d f g h j k · w e t y u · z x octave</span>
        </div>`;
    document.body.appendChild(_modal);

    const q = (s) => _modal.querySelector(s);
    q('.piano-close').onclick = () => closePiano();
    q('.piano-oct-dn').onclick = () => { _oct = Math.max(OCT_MIN, _oct - 1); render(); };
    q('.piano-oct-up').onclick = () => { _oct = Math.min(OCT_MAX, _oct + 1); render(); };
    q('.piano-sus').oninput = (e) => { _sus = Number(e.target.value); };
    q('.piano-amp').oninput = (e) => { _amp = Number(e.target.value); };
    q('.piano-quant').onchange = (e) => { _quant = Number(e.target.value); };
    q('.piano-target').onchange = (e) => { _target = e.target.value; };
    // Buffers come and go while the panel sits open — a tab added, one detached,
    // one closed — and nothing about that redraws the piano. Rebuild the list at the
    // moment you go to use it, which is the only moment it has to be right.
    for (const ev of ['pointerdown', 'focus']) q('.piano-target').addEventListener(ev, renderTargets);
    q('.piano-snap').onclick = (e) => { _snap = !_snap; e.target.classList.toggle('on', _snap); };
    q('.piano-midi').onclick = (e) => setMidi(!_midiOn, e.target);
    q('.piano-synth').onchange = (e) => { _synth = e.target.value; buildParamKnobs(); };
    q('.piano-rec').onclick = () => {
        if (_rec && _rec.armed) {
            _rec.armed = false;
            q('.piano-rec').classList.remove('on');
            _ctx.log(`piano: stopped — ${_rec.notes.length} note${_rec.notes.length === 1 ? '' : 's'} held, press \u270e to code`, 'info');
        } else {
            _rec = { armed: true, startBeat: _ctx.beat(), startT: performance.now(), notes: [] };
            q('.piano-rec').classList.add('on');
            _ctx.log('piano: recording \u2014 play, then press \u270e to code', 'warn');
        }
    };
    q('.piano-code').onclick = toCode;

    // The computer keyboard plays ONLY while the panel has focus, so it can never
    // eat a keystroke meant for the code editor.
    _modal.addEventListener('keydown', (e) => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'z') { _oct = Math.max(OCT_MIN, _oct - 1); render(); return; }
        if (k === 'x') { _oct = Math.min(OCT_MAX, _oct + 1); render(); return; }
        if (!(k in KEYMAP)) return;
        e.preventDefault();
        noteOn(_oct * 12 + KEYMAP[k]);
    });
    _modal.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k in KEYMAP) noteOff(_oct * 12 + KEYMAP[k]);
    });
    _modal.addEventListener('blur', () => { for (const m of [..._down.keys()]) noteOff(m); });

    draggable(q('.piano-head'), _modal, 'button, input, select');
}

// ── MIDI ────────────────────────────────────────────────────────────────────
// A MIDI keyboard plays the piano itself, not a separate voice: same synth, same
// knob values, same scale snapping, and the notes are RECORDED, so you can play a
// phrase in on hardware and press ✎ to code exactly as with the mouse.
//
// It takes over the single note handler that midiin() also uses — there is one —
// so turning this on supersedes midiin(), and turning it off releases it.
function setMidi(on, btn) {
    _midiOn = !!on;
    if (btn) btn.classList.toggle('on', _midiOn);
    if (!_midiOn) {
        _ctx.onMidiNote(null);
        for (const m of [..._down.keys()]) noteOff(m);
        _ctx.log('piano: MIDI keyboard released', 'info');
        return;
    }
    _ctx.onMidiNote((note, vel, isOn) => {
        if (isOn) noteOn(note, Math.max(0.05, vel));
        else noteOff(note);
    });
    _ctx.log('piano: MIDI keyboard → this piano (it overrides midiin)', 'ok');
}

// Bind a hardware knob to a parameter. Arming waits for the next CC you move; the
// binding then drives the knob, the sounding voice and the generated line together,
// because they are all the same value.
function learnCC(name, cell) {
    const prev = _ccBind.get(name);
    if (prev) {                                  // already bound → let go
        _ctx.midiUnlearn(prev.handle);
        _ccBind.delete(name);
        cell.querySelector('.piano-cc')?.remove();
        _ctx.log(`piano: ${name} unbound from CC ${prev.cc}`, 'info');
        return;
    }
    const tag = document.createElement('span');
    tag.className = 'piano-cc learning';
    tag.textContent = 'learn…';
    cell.appendChild(tag);
    const spec = rangeFor(name, _paramDefs[name]);
    const handle = _ctx.midiLearn((v, cc) => {
        // v is 0..1 from the controller; map it through the knob's own range so a
        // hardware sweep feels like the on-screen one, curve included.
        const val = spec.min != null ? fromRange(v, spec) : v;
        _params[name] = val;
        const b = _ccBind.get(name);
        if (b && b.cc == null) { b.cc = cc; tag.textContent = `cc ${cc}`; tag.classList.remove('learning'); }
        const knob = cell.querySelector('.mod-knob-val');
        if (knob) knob.textContent = fmtVal(val);
        const arc = cell.querySelector('.mk-arc'), ptr = cell.querySelector('.mk-pointer');
        if (arc && ptr) paintDial(cell, val, spec);
    });
    if (!handle) { tag.remove(); _ctx.log('piano: MIDI is not available', 'warn'); return; }
    _ccBind.set(name, { handle, cc: null });
    _ctx.log(`piano: ${name} — move a control on your MIDI device to bind it`, 'warn');
}

// 0..1 → a value in the knob's range, honouring an exponential curve.
function fromRange(t, s) {
    const c = Math.min(1, Math.max(0, t));
    if (s.curve === 'exp' && s.min > 0 && s.max > 0) return s.min * Math.pow(s.max / s.min, c);
    return s.min + (s.max - s.min) * c;
}
function fmtVal(v) {
    const a = Math.abs(v);
    return a >= 100 ? String(Math.round(v)) : a >= 1 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 1000) / 1000);
}
// Repaint a dial from outside the knob component (a CC move, not a drag).
function paintDial(cell, v, s) {
    const arc = cell.querySelector('.mk-arc'), ptr = cell.querySelector('.mk-pointer');
    if (!arc || !ptr || s.min == null) return;
    const t = Math.min(1, Math.max(0, (s.curve === 'exp' && s.min > 0 && s.max > 0)
        ? Math.log(Math.max(s.min, v) / s.min) / Math.log(s.max / s.min)
        : (v - s.min) / (s.max - s.min)));
    const SWEEP = 270, START = 135, R = 15, CX = 18, CY = 18;
    const pol = (deg, r) => [CX + r * Math.cos((deg - 90) * Math.PI / 180), CY + r * Math.sin((deg - 90) * Math.PI / 180)];
    const a0 = START, a1 = START + t * SWEEP;
    const [x0, y0] = pol(a0, R), [x1, y1] = pol(a1, R);
    arc.setAttribute('d', t <= 0.001 ? '' : `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`);
    const [px, py] = pol(a1, R - 3), [ix, iy] = pol(a1, R - 9);
    ptr.setAttribute('x1', ix.toFixed(2)); ptr.setAttribute('y1', iy.toFixed(2));
    ptr.setAttribute('x2', px.toFixed(2)); ptr.setAttribute('y2', py.toFixed(2));
}

// The destination list, refreshed every time the panel draws — buffers come and go
// as you add tabs and detach them. Defaults to the one you are looking at, and holds
// your choice as long as that buffer still exists.
function renderTargets() {
    const sel = _modal?.querySelector('.piano-target');
    if (!sel) return;
    const list = _ctx.targets() || [];
    if (!list.length) { sel.innerHTML = '<option value="">editor</option>'; return; }
    if (!list.some(t => t.name === _target)) _target = (list.find(t => t.active) || list[0]).name;
    const want = list.map(t => t.name).join('\u0000');
    if (sel.dataset.names !== want) {
        sel.dataset.names = want;
        sel.innerHTML = list.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    }
    sel.value = _target;
}

// One knob per parameter the chosen synth actually has, rebuilt when the synth
// changes. They feed the sounding voice AND the generated line, so a sound you
// found by ear comes out as the code that makes it.
function buildParamKnobs() {
    if (!_modal) return;
    const host = _modal.querySelector('.piano-params');
    host.textContent = '';
    // The row is about to be replaced, so any hardware bindings pointing into it
    // have to go with it — otherwise a CC would keep writing to a parameter the
    // current synth does not have.
    for (const [, b] of _ccBind) _ctx.midiUnlearn(b.handle);
    _ccBind.clear();
    _params = {}; _paramDefs = {};

    const def = _ctx.synthDef(_synth);
    const names = paramsOf(def);
    if (!names.length) {
        const none = document.createElement('span');
        none.className = 'piano-hint';
        none.textContent = `${_synth} takes no extra parameters`;
        host.appendChild(none);
        return;
    }
    for (const name of names) {
        const d = def.defaults[name];
        _paramDefs[name] = d;
        _params[name] = d;
        const spec = rangeFor(name, d);

        const cell = document.createElement('div');
        cell.className = 'piano-param';
        const lab = document.createElement('span');
        lab.className = 'piano-param-name';
        lab.textContent = name;
        // Double-click the label to put a parameter back where the synth had it.
        lab.title = `${name} (default ${d}) — drag the value, Shift for fine · double-click to reset · right-click to bind a MIDI control`;
        lab.ondblclick = () => { _params[name] = d; buildParamKnobs(); };
        lab.oncontextmenu = (e) => { e.preventDefault(); learnCC(name, cell); };

        const knob = makeKnob({
            value: d, spec, rotary: true,
            title: `${name} — default ${d}`,
            onInput: (v) => { _params[name] = v; },
            onCommit: (v) => { _params[name] = v; },
        });
        cell.append(lab, knob);
        host.appendChild(cell);
    }
}

function render() {
    if (!_modal) return;
    const sel = _modal.querySelector('.piano-synth');
    const names = _ctx.synths();
    if (sel.options.length !== names.length) {
        sel.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    }
    if (!names.includes(_synth)) _synth = names[0] || 'pluck';
    sel.value = _synth;
    if (!Object.keys(_paramDefs).length) buildParamKnobs();
    _modal.querySelector('.piano-oct').textContent = _oct;

    renderTargets();

    const { scale, root } = _ctx.scale();
    const keys = _modal.querySelector('.piano-keys');
    keys.innerHTML = '';
    // White keys carry the layout; black keys are absolutely placed over them, so the
    // widths stay honest at any panel size.
    const whiteCount = WHITE.length * _octaves + 1;
    for (let i = 0; i < whiteCount; i++) {
        const oc = Math.floor(i / WHITE.length), semi = WHITE[i % WHITE.length];
        const midi = (_oct + oc) * 12 + semi;
        keys.appendChild(mkKey(midi, false, i / whiteCount, 1 / whiteCount, scale, root));
    }
    for (let i = 0; i < whiteCount - 1; i++) {
        const oc = Math.floor(i / WHITE.length), semi = WHITE[i % WHITE.length];
        if (!WHITE.includes(semi + 1)) {          // a black key sits above this white one
            const midi = (_oct + oc) * 12 + semi + 1;
            keys.appendChild(mkKey(midi, true, (i + 0.68) / whiteCount, 0.64 / whiteCount, scale, root));
        }
    }
}

function mkKey(midi, black, left, width, scale, root) {
    const el = document.createElement('div');
    el.className = 'pk' + (black ? ' pk-black' : '')
        + (inScale(midi, scale, root) ? ' pk-in' : '');
    el.dataset.midi = midi;
    el.style.left = (left * 100) + '%';
    el.style.width = (width * 100) + '%';
    const pc = ((midi % 12) + 12) % 12;
    if (!black) el.innerHTML = `<span>${NAMES[pc]}${Math.floor(midi / 12)}</span>`;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); noteOn(midi); });
    el.addEventListener('pointerup',   () => noteOff(midi));
    el.addEventListener('pointercancel', () => noteOff(midi));
    el.addEventListener('pointerleave', () => { if (_down.has(midi)) noteOff(midi); });
    return el;
}

