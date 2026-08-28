// Mixer — a non-modal, draggable floating console. It's a clip-launcher + volume desk
// for performing a composition by hand:
//
//  • VOLUME is shared per player NAME (one _mixLevel per name, read every note). One
//    vertical fader per track — the same d1 has ONE volume wherever it plays.
//  • LAUNCH: tap a track's name → evaluate its `name >>` line and start it on its own
//    (no auto-advance needed). The SOURCE part picker chooses which part's version a
//    launch pulls from, so you can play v1 from part 1, v3 from part 2, v1 from part 4…
//  • STOP: ■ stops the track, quantised to the next bar.
//  • MASTER scales everything.
//
// It's non-modal (no backdrop) so you can keep coding while it's open; drag its header
// to move it out of the way.

import { setMasterMix, getMasterMix } from '../engine/player.js';
import { midiControl, clearMidiControl, enableMidi, midiSupported } from '../midi/midi.js';
import { toggleMute, toggleSolo, isMuted, isSoloed } from '../engine/gate.js';
import { getSections, runSection } from '../engine/sections.js';
import { share, shareStateThrottled } from '../collab/actions.js';
import { heldByUser } from './controls.js';

let _clock = null, _editor = null, _runCode = null;
const _levels = {};            // player name → volume (persists even before it's launched)
let _source = null;            // LINE of the part a launch pulls from (null = the part playing, else first)
let _activeSection = null;     // LINE of the part playing now (for the ● marker)
let _open = false;
let _lastTracks = '';
let _partsKey = '';

export function initMixer(clock, editor, runCode) { _clock = clock; _editor = editor; _runCode = runCode; restoreMidi(); }

// The part playing now — only drives the ● marker. Volumes are shared per name, so a
// section change never touches them.
export function onSectionActive(sectionName, sectionLine) {
    _activeSection = (sectionLine != null && sectionLine >= 0) ? sectionLine : null;
    if (_open) updateConsole();
}

export function levelOf(name) {
    if (_levels[name] != null) return _levels[name];
    const p = _clock && _clock._players.get(name);
    return p ? (p._mixLevel ?? 1) : 1;
}
export function setLevel(name, v) {
    _levels[name] = v;
    const p = _clock && _clock._players.get(name);
    if (p) p._mixLevel = v;
    // Multiplayer: the mix is part of the performance, so peers follow the fader.
    // Throttled — a drag (mixer fader, perform-mode swipe, a MIDI fader) fires far
    // faster than the room needs, and the trailing send lands the released value.
    shareStateThrottled('level:' + name, v);
}

// Players a part (re)defines — the names on the uncommented `[~]name >>` lines of the
// section that STARTS at `secLine`. Used to colour the channels a launch from the
// selected part would (re)start. Keyed by LINE so duplicate part names stay distinct,
// and it allows a leading ~ (reset-player prefix).
function playersInPart(secLine) {
    const set = new Set();
    if (secLine == null || !_editor || !_editor.getValue) return set;
    let cur = -1, i = -1;
    for (const raw of _editor.getValue().split('\n')) {
        i++;
        const t = raw.trim();
        const sec = t.match(/^#@\s*([a-zA-Z_]\w*)/);
        if (sec && !t.startsWith('#@#@')) { cur = i; continue; }
        const pm = t.match(/^\s*~?\s*([a-zA-Z_]\w*)\s*>>/);
        if (pm && cur === secLine) set.add(pm[1]);
    }
    return set;
}

// ── MIDI: map a hardware CC to a channel's volume (0..1 → 0..1.5) ───────────────
const _midi = {};   // name (or '__master__') → { ctrl, cc, armed }
function midiApply(name, v) {
    const lvl = Math.round(v * 150) / 100;              // 0..1 CC → 0..1.5 fader
    if (name === '__master__') {
        setMasterMix(lvl);
        if (_masterFader && !heldByUser(_masterFader)) { _masterFader.value = lvl; _masterLvl.textContent = lvl.toFixed(2); }
    } else {
        setLevel(name, lvl);
        const row = _chansEl && _chansEl.querySelector(`.mixer-chan[data-name="${name}"]`);
        const f = row && row.querySelector('.mixer-chan-fader');
        if (f && !heldByUser(f)) { f.value = lvl; row.querySelector('.mixer-chan-lvl').textContent = lvl.toFixed(2); }
    }
}
async function midiLearn(name) {
    if (_midi[name]) { clearMidiControl(_midi[name].ctrl); delete _midi[name]; saveMidi(); updateConsole(); return; }  // toggle off
    if (!midiSupported()) return;
    try { await enableMidi(); } catch (_) { return; }
    const ctrl = midiControl((v, cc) => { const e = _midi[name]; if (!e) return; const fresh = e.cc == null; e.cc = cc; e.armed = false; midiApply(name, v); updateMidiBtn(name); if (fresh) saveMidi(); });
    _midi[name] = { ctrl, cc: null, armed: true };
    updateConsole();
}
function updateMidiBtn(name) {
    const btn = name === '__master__'
        ? (_modal && _modal.querySelector('.mixer-master .mixer-chan-midi'))
        : (_chansEl && _chansEl.querySelector(`.mixer-chan[data-name="${name}"] .mixer-chan-midi`));
    if (!btn) return;
    const e = _midi[name];
    btn.textContent = e ? (e.armed ? '…' : 'c' + e.cc) : 'm';
    btn.classList.toggle('armed', !!(e && e.armed));
    btn.classList.toggle('mapped', !!(e && !e.armed));
}

// ── MIDI: assign hardware controls to ACTIONS (launch/solo/mute/stop, prev/next part).
// A "press" = a CC value crossing above the midpoint (works with pads in CC mode and
// with a momentary button or fader). Learn-mode (header ⇄MIDI button): click a control
// to arm it, then move a hardware control to bind. Coexists with the fader bindings.
const _act = {};        // id ('solo:p1' | 'launch:p1' | 'next' | …) → { ctrl, cc, armed, fn, last }
let _learnMode = false; // when on, clicking a control arms it instead of firing
let _armed = null;      // id currently waiting for a MIDI control

// Jump the arrangement to the next/prev named part (dir = +1 / −1).
function nextPart(dir) {
    const secs = getSections().filter(s => s.type !== 'track' && !/^(goto|end|endfade|clear)$/i.test(s.name));
    if (!secs.length) return;
    const i = secs.findIndex(s => s.active);
    const j = i < 0 ? (dir > 0 ? 0 : secs.length - 1) : (i + dir + secs.length) % secs.length;
    runSection(secs[j].line);
}

// Perform the action now, or — in learn mode — arm it for MIDI binding.
function actOrArm(id, fn) { if (_learnMode) armAction(id, fn); else fn(); }

function armAction(id, fn) {
    if (_armed === id) { if (_act[id]) { clearMidiControl(_act[id].ctrl); delete _act[id]; } _armed = null; saveMidi(); updateConsole(); return; } // click armed again = clear
    if (_armed && _act[_armed] && _act[_armed].armed) { clearMidiControl(_act[_armed].ctrl); delete _act[_armed]; }  // only one armed at a time
    if (_act[id]) { clearMidiControl(_act[id].ctrl); delete _act[id]; }   // already bound → rebind
    if (!midiSupported()) return;
    enableMidi().then(() => {
        const b = { cc: null, armed: true, fn, last: 0 };
        b.ctrl = midiControl((v, cc) => {
            if (b.armed) { b.cc = cc; b.armed = false; b.last = v; if (_armed === id) _armed = null; saveMidi(); updateConsole(); return; }
            if (b.last < 0.5 && v >= 0.5) { try { b.fn(); } catch (_) {} }   // rising-edge = press
            b.last = v;
        });
        _act[id] = b; _armed = id;
        updateConsole();
    }).catch(() => {});
}

// The DOM control a binding id points at (for the armed/mapped markers).
function elForId(id) {
    if (!_modal) return null;
    if (id === 'next') return _modal.querySelector('.mixer-next');
    if (id === 'prev') return _modal.querySelector('.mixer-prev');
    const [kind, name] = id.split(':');
    const row = _chansEl && _chansEl.querySelector(`.mixer-chan[data-name="${name}"]`);
    if (!row) return null;
    return row.querySelector(kind === 'launch' ? '.mixer-chan-name'
                           : kind === 'solo'   ? '.mixer-chan-solo'
                           : kind === 'mute'   ? '.mixer-chan-mute'
                           : kind === 'stop'   ? '.mixer-chan-stop' : ':scope > .none');
}

// Paint armed (waiting) / mapped (bound + CC#) markers on the action controls.
function applyMidiMarks() {
    if (!_modal) return;
    _modal.querySelectorAll('.midi-armed, .midi-mapped').forEach(el => el.classList.remove('midi-armed', 'midi-mapped'));
    for (const [id, b] of Object.entries(_act)) {
        const el = elForId(id); if (!el) continue;
        if (b.armed) el.classList.add('midi-armed');
        else { el.classList.add('midi-mapped'); el.title = el.title.split(' · CC')[0] + ' · CC' + b.cc; }
    }
}

// ── MIDI persistence — remember the mixer's fader + action mappings across refreshes.
// We save only { name/id → cc } to localStorage; on load we re-enable MIDI (the browser
// remembers the permission grant) and rebind, so your controller keeps working. ─────
const MIDI_KEY = 'wfd-midi';
function saveMidi() {
    try {
        const faders = {}, actions = {};
        for (const n in _midi) if (_midi[n] && _midi[n].cc != null) faders[n] = _midi[n].cc;
        for (const id in _act) if (_act[id] && _act[id].cc != null) actions[id] = _act[id].cc;
        localStorage.setItem(MIDI_KEY, JSON.stringify({ faders, actions }));
    } catch (_) {}
}
// Rebuild the action a saved id fires — ids: launch:NAME · solo:NAME · mute:NAME ·
// stop:NAME · next · prev — so a restored binding does exactly what it did before.
function actionFn(id) {
    if (id === 'next') return () => nextPart(1);
    if (id === 'prev') return () => nextPart(-1);
    const [kind, name] = id.split(':');
    if (kind === 'launch') return () => launchPlayer(name);
    if (kind === 'solo')   return () => { toggleSolo(name); updateConsole(); };
    if (kind === 'mute')   return () => { toggleMute(name); updateConsole(); };
    if (kind === 'stop')   return () => stopPlayer(name);
    return null;
}
// Re-establish a fader binding on a KNOWN cc (no learn step). Works before the mixer
// UI is built (updateMidiBtn is null-guarded), so the controller drives volume even
// with the mixer closed.
function restoreFader(name, cc) {
    const ctrl = midiControl((v, cc2) => { const e = _midi[name]; if (!e) return; e.cc = cc2; e.armed = false; midiApply(name, v); updateMidiBtn(name); }, cc);
    _midi[name] = { ctrl, cc, armed: false };
    updateMidiBtn(name);
}
// Re-establish an action binding on a KNOWN cc (rising-edge = press).
function restoreAction(id, cc) {
    const fn = actionFn(id); if (!fn) return;
    const b = { cc, armed: false, fn, last: 0 };
    b.ctrl = midiControl((v) => { if (b.last < 0.5 && v >= 0.5) { try { b.fn(); } catch (_) {} } b.last = v; }, cc);
    _act[id] = b;
}
// On load: if there are saved mappings, silently re-enable MIDI and rebind them.
// No-op if MIDI is unavailable or the permission was revoked (the .catch swallows it).
function restoreMidi() {
    let saved; try { saved = JSON.parse(localStorage.getItem(MIDI_KEY) || 'null'); } catch (_) { saved = null; }
    const faders = (saved && saved.faders) || {}, actions = (saved && saved.actions) || {};
    if (!Object.keys(faders).length && !Object.keys(actions).length) return;
    if (!midiSupported()) return;
    enableMidi().then(() => {
        for (const [name, cc] of Object.entries(faders))  restoreFader(name, +cc);
        for (const [id, cc]   of Object.entries(actions)) restoreAction(id, +cc);
        if (_open) updateConsole();
    }).catch(() => {});
}

// The composition's tracks, in the order they appear in the CODE (top-to-bottom, so
// they group naturally under their #@ parts) — each player at its FIRST occurrence.
// Includes `# p1 >>` stops and `~p1 >>` reset-players. Any currently-live players not
// written in the buffer (chaos / the jam bot) are appended in creation order.
export function tracks() {
    const seen = [];
    const add = (n) => { if (n && !seen.includes(n)) seen.push(n); };
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#?\s*~?\s*([a-zA-Z_]\w*)\s*>>/gm)) add(m[1]);
    }
    if (_clock) for (const n of _clock._players.keys()) add(n);
    return seen;
}

// The composition's named parts WITH their line, in document order — duplicates kept
// (two #@intro parts are distinct rows, keyed by line). Excludes #@#@ + control parts.
function partList() {
    const out = [];
    if (_editor && _editor.getValue) {
        const ls = _editor.getValue().split('\n');
        for (let i = 0; i < ls.length; i++) {
            if (ls[i].trim().startsWith('#@#@')) continue;
            const m = ls[i].match(/^\s*#@\s*([a-zA-Z_]\w*)\s*(?:\(|$)/);
            if (m && !/^(goto|end|endfade|clear)$/i.test(m[1])) out.push({ name: m[1], line: i });
        }
    }
    return out;
}

// The composition's named part NAMES (deduped) — kept for external consumers (perform).
export function parts() {
    const out = [];
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#@\s*([a-zA-Z_]\w*)\s*(?:\(|$)/gm)) {
            if (!/^(goto|end|endfade|clear)$/i.test(m[1])) out.push(m[1]);
        }
    }
    return [...new Set(out)];
}

// Launch a track: evaluate its `[~]name >>` line from the SOURCE part (a section start
// LINE — else the part playing, else the first occurrence). Duplicate part names stay
// distinct because the source is a line, not a name. Volume is re-applied per name.
export function launchPlayer(name) {
    if (!_runCode || !_editor || !_editor.getValue) return;
    const wantLine = _source ?? _activeSection;   // a section start line, or null
    let curSec = -1, pick = null, first = null, i = -1;
    for (const raw of _editor.getValue().split('\n')) {
        i++;
        const t = raw.trim();
        const sec = t.match(/^#@\s*([a-zA-Z_]\w*)/);
        if (sec && !t.startsWith('#@#@')) { curSec = i; continue; }
        const pm = t.match(/^\s*~?\s*([a-zA-Z_]\w*)\s*>>/);   // a real (uncommented) definition, ~ allowed
        if (pm && pm[1] === name) { if (first == null) first = raw; if (wantLine == null || curSec === wantLine) { pick = raw; break; } }
    }
    const code = pick ?? first;
    if (!code) return;
    _runCode(code);
    const p = _clock && _clock._players.get(name);
    if (p && _levels[name] != null) p._mixLevel = _levels[name];
    if (_open) updateConsole();
}

// Stop a track, quantised to the next bar.
export function stopPlayer(name) {
    const p = _clock && _clock._players.get(name);
    if (p && p._active) p.stop((_clock && _clock.meter) || 4);
    share('mixStop', { name });
}

// ── Console UI (non-modal, vertical strips) ────────────────────────────────────
let _modal = null, _chansEl = null, _partsEl = null, _hintEl = null, _masterFader = null, _masterLvl = null;

function build() {
    _modal = document.createElement('div');
    _modal.id = 'mixer-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="mixer-head">
            <span class="mixer-title">🎚 mixer</span>
            <button class="mixer-prev" title="previous part">◄</button>
            <button class="mixer-next" title="next part">►</button>
            <button class="mixer-learn" title="MIDI-learn mode — click a launch / solo / mute / stop / part button, then move a hardware control to bind it">⇄MIDI</button>
            <div class="mixer-drag"></div>
            <button class="mixer-close" title="close">×</button>
        </div>
        <div class="mixer-parts" title="which part a launch pulls from · ● = the part playing now"></div>
        <div class="mixer-body">
            <div class="mixer-chan mixer-master">
                <span class="mixer-chan-name">MAS</span>
                <input type="range" class="mixer-chan-fader" min="0" max="1.5" step="0.01" value="1">
                <span class="mixer-chan-lvl">1.00</span>
                <button class="mixer-chan-midi" title="MIDI-learn: click, then move a hardware fader">m</button>
            </div>
            <div class="mixer-chans"></div>
        </div>
        <div class="mixer-hint"></div>`;
    document.body.appendChild(_modal);
    _chansEl     = _modal.querySelector('.mixer-chans');
    _partsEl     = _modal.querySelector('.mixer-parts');
    _hintEl      = _modal.querySelector('.mixer-hint');
    _masterFader = _modal.querySelector('.mixer-master .mixer-chan-fader');
    _masterLvl   = _modal.querySelector('.mixer-master .mixer-chan-lvl');
    _modal.querySelector('.mixer-close').onclick = closeMixer;
    _masterFader.oninput = () => { setMasterMix(parseFloat(_masterFader.value)); _masterLvl.textContent = parseFloat(_masterFader.value).toFixed(2); };
    _modal.querySelector('.mixer-master .mixer-chan-midi').onclick = () => midiLearn('__master__');
    _modal.querySelector('.mixer-learn').onclick = () => {
        _learnMode = !_learnMode; _armed = null;
        _modal.classList.toggle('learn', _learnMode);
        _modal.querySelector('.mixer-learn').classList.toggle('on', _learnMode);
        updateConsole();
    };
    _modal.querySelector('.mixer-prev').onclick = () => actOrArm('prev', () => nextPart(-1));
    _modal.querySelector('.mixer-next').onclick = () => actOrArm('next', () => nextPart(1));
    initDrag(_modal.querySelector('.mixer-head'));
}

// Drag the panel by its header (non-modal — move it off your code).
function initDrag(handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;   // let head buttons (close/prev/next/learn) click
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

// Source-part picker: 'auto' + one chip per part OCCURRENCE (keyed by line, so two
// #@intro parts each get their own chip). Selected = launch source; ● = playing now.
function renderParts() {
    const ps = partList();
    if (_source != null && !ps.some(p => p.line === _source)) _source = null;   // source part was deleted
    const key = 'auto|' + ps.map(p => p.line + ':' + p.name).join(',');
    if (key !== _partsKey) {
        _partsEl.innerHTML = '';
        const auto = document.createElement('button');
        auto.className = 'mixer-part-chip'; auto.dataset.line = ''; auto.textContent = 'auto';
        auto.title = 'launch from the part playing now (or the first if none)';
        auto.onclick = () => { _source = null; updateConsole(); };
        _partsEl.appendChild(auto);
        for (const p of ps) {
            const chip = document.createElement('button');
            chip.className = 'mixer-part-chip';
            chip.dataset.line = p.line;
            chip.textContent = p.name;
            chip.onclick = () => { _source = p.line; updateConsole(); };
            _partsEl.appendChild(chip);
        }
        _partsKey = key;
    }
    for (const chip of _partsEl.children) {
        const ln = chip.dataset.line === '' ? null : +chip.dataset.line;
        chip.classList.toggle('selected', ln === _source);                       // auto: null === null
        chip.classList.toggle('playing', ln != null && ln === _activeSection);
    }
}

function rebuildChannels(names) {
    _chansEl.innerHTML = '';
    for (const name of names) {
        const row = document.createElement('div');
        row.className = 'mixer-chan';
        row.dataset.name = name;
        row.innerHTML = `
            <span class="mixer-chan-live" title="lit = playing now"></span>
            <span class="mixer-chan-name" title="tap to launch this track's selected-part version">${name}</span>
            <input type="range" class="mixer-chan-fader" min="0" max="1.5" step="0.01" value="1">
            <span class="mixer-chan-lvl">1.00</span>
            <div class="mixer-chan-btns">
                <button class="mixer-chan-solo" title="solo (shared with the panel)">S</button>
                <button class="mixer-chan-mute" title="mute (shared with the panel)">M</button>
            </div>
            <button class="mixer-chan-stop" title="stop (quantised to the bar)">■</button>
            <button class="mixer-chan-midi" title="MIDI-learn: click, then move a hardware fader">m</button>`;
        row.querySelector('.mixer-chan-name').onclick = () => actOrArm('launch:' + name, () => launchPlayer(name));
        row.querySelector('.mixer-chan-midi').onclick = () => midiLearn(name);
        row.querySelector('.mixer-chan-solo').onclick = () => actOrArm('solo:' + name, () => { toggleSolo(name); updateConsole(); });
        row.querySelector('.mixer-chan-fader').oninput = (e) => {
            setLevel(name, parseFloat(e.target.value));
            row.querySelector('.mixer-chan-lvl').textContent = parseFloat(e.target.value).toFixed(2);
        };
        row.querySelector('.mixer-chan-mute').onclick = () => actOrArm('mute:' + name, () => { toggleMute(name); updateConsole(); });
        row.querySelector('.mixer-chan-stop').onclick = () => actOrArm('stop:' + name, () => stopPlayer(name));
        _chansEl.appendChild(row);
    }
}

function updateConsole() {
    if (!_open) return;
    renderParts();
    const names = tracks();
    const key = names.join(',');
    if (key !== _lastTracks) { rebuildChannels(names); _lastTracks = key; }
    _hintEl.textContent = 'tap a name ▸ to launch · source: ' + (_source ?? 'the part playing (or first)');
    if (!heldByUser(_masterFader)) { const m = getMasterMix(); _masterFader.value = m; _masterLvl.textContent = m.toFixed(2); }
    updateMidiBtn('__master__');
    // Tracks the SELECTED source part (re)defines get highlighted — so you see which
    // channels a launch from that part would actually fire.
    const src = _source ?? _activeSection;      // a section start line (0 is valid), or null
    const defined = src != null ? playersInPart(src) : null;
    for (const row of _chansEl.children) {
        const name = row.dataset.name;
        const p = _clock && _clock._players.get(name);
        const fader = row.querySelector('.mixer-chan-fader');
        if (!heldByUser(fader)) {
            const lv = levelOf(name);
            fader.value = lv;
            row.querySelector('.mixer-chan-lvl').textContent = lv.toFixed(2);
        }
        row.classList.toggle('inactive', !p || !p._active);
        row.classList.toggle('in-source', !!(defined && defined.has(name)));   // defined by the source part
        row.classList.toggle('not-source', !!(defined && !defined.has(name))); // not in the source part
        row.querySelector('.mixer-chan-mute').classList.toggle('on', isMuted(name));
        row.querySelector('.mixer-chan-solo').classList.toggle('on', isSoloed(name));
        updateMidiBtn(name);
    }
    applyMidiMarks();   // armed (waiting) / mapped (CC#) markers on the action controls
}

export function openMixer() {
    if (!_modal) build();
    _open = true; _lastTracks = ''; _partsKey = '';
    _modal.classList.remove('hidden');
    updateConsole();
    if (!openMixer._timer) openMixer._timer = setInterval(() => { if (_open) updateConsole(); }, 400);
}
export function closeMixer() { _open = false; if (_modal) _modal.classList.add('hidden'); }
export function toggleMixer() { _open ? closeMixer() : openMixer(); }
export function isMixerOpen() { return _open; }
