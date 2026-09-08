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

let _modal = null, _open = false;
let _ctx = {
    playNote: () => {},        // (synthName, midi, {sus, amp}) → fire a voice now
    insert:   () => {},        // (code) → put this line in the editor
    beat:     () => 0,         // clock.now()
    bpm:      () => 120,       // clock.bpm — for the un-booted fallback below
    synths:   () => ['pluck'], // available synth names
    scale:    () => ({ scale: [0, 2, 3, 5, 7, 8, 10], root: 0, name: 'minor' }),
    log:      () => {},
};

const OCT_MIN = 1, OCT_MAX = 8;
// Tracker/DAW keyboard layout: the home row is white keys, the row above is black.
const KEYMAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ';': 16,
};
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let _oct = 5, _synth = 'pluck', _sus = 0.5, _amp = 0.7, _snap = true, _octaves = 2;
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
function noteOn(midi) {
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
    _ctx.playNote(_synth, m, { sus: _sus, amp: _amp });
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
    const line = `p1 >> ${_synth}([${degs.join(', ')}], dur=${durPart}, oct=${_oct}, sus=${_sus})`;

    _ctx.insert(line);
    _ctx.log(`piano → code: ${degs.length} step${degs.length === 1 ? '' : 's'} in ${name}`
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
            <div class="piano-drag"></div>
            <button class="piano-close" title="close">×</button>
        </div>
        <div class="piano-keys"></div>
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
    q('.piano-snap').onclick = (e) => { _snap = !_snap; e.target.classList.toggle('on', _snap); };
    q('.piano-synth').onchange = (e) => { _synth = e.target.value; };
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

    initDrag(q('.piano-head'));
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
    _modal.querySelector('.piano-oct').textContent = _oct;

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

function initDrag(handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, input, select')) return;
        on = true; const r = _modal.getBoundingClientRect();
        ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        _modal.style.left = ox + 'px'; _modal.style.top = oy + 'px';
        _modal.style.right = 'auto'; _modal.style.bottom = 'auto';
        e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => {
        if (!on) return;
        _modal.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
        _modal.style.top  = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('pointerup', () => { on = false; });
}
