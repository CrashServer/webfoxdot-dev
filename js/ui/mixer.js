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

let _clock = null, _editor = null, _runCode = null;
const _levels = {};            // player name → volume (persists even before it's launched)
let _source = null;            // which part a launch pulls from (null = the part playing, else first)
let _activeSection = null;     // the part playing now (for the ● marker)
let _open = false;
let _lastTracks = '';
let _partsKey = '';

export function initMixer(clock, editor, runCode) { _clock = clock; _editor = editor; _runCode = runCode; }

// The part playing now — only drives the ● marker. Volumes are shared per name, so a
// section change never touches them.
export function onSectionActive(sectionName) {
    _activeSection = sectionName || null;
    if (_open) updateConsole();
}

function levelOf(name) {
    if (_levels[name] != null) return _levels[name];
    const p = _clock && _clock._players.get(name);
    return p ? (p._mixLevel ?? 1) : 1;
}
function setLevel(name, v) {
    _levels[name] = v;
    const p = _clock && _clock._players.get(name);
    if (p) p._mixLevel = v;
}

// Players a part (re)defines — the names on its uncommented `name >>` lines. Used to
// colour the channels a launch from the selected part would actually (re)start.
function playersInPart(part) {
    const set = new Set();
    if (!part || !_editor || !_editor.getValue) return set;
    let cur = null;
    for (const raw of _editor.getValue().split('\n')) {
        const t = raw.trim();
        const sec = t.match(/^#@([a-zA-Z_]\w*)/);
        if (sec && !t.startsWith('#@#@')) { cur = sec[1]; continue; }
        const pm = t.match(/^\s*([a-zA-Z_]\w*)\s*>>/);
        if (pm && cur === part) set.add(pm[1]);
    }
    return set;
}

// ── MIDI: map a hardware CC to a channel's volume (0..1 → 0..1.5) ───────────────
const _midi = {};   // name (or '__master__') → { ctrl, cc, armed }
function midiApply(name, v) {
    const lvl = Math.round(v * 150) / 100;              // 0..1 CC → 0..1.5 fader
    if (name === '__master__') {
        setMasterMix(lvl);
        if (_masterFader && document.activeElement !== _masterFader) { _masterFader.value = lvl; _masterLvl.textContent = lvl.toFixed(2); }
    } else {
        setLevel(name, lvl);
        const row = _chansEl && _chansEl.querySelector(`.mixer-chan[data-name="${name}"]`);
        const f = row && row.querySelector('.mixer-chan-fader');
        if (f && document.activeElement !== f) { f.value = lvl; row.querySelector('.mixer-chan-lvl').textContent = lvl.toFixed(2); }
    }
}
async function midiLearn(name) {
    if (_midi[name]) { clearMidiControl(_midi[name].ctrl); delete _midi[name]; updateConsole(); return; }  // toggle off
    if (!midiSupported()) return;
    try { await enableMidi(); } catch (_) { return; }
    const ctrl = midiControl((v, cc) => { const e = _midi[name]; if (!e) return; e.cc = cc; e.armed = false; midiApply(name, v); updateMidiBtn(name); });
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

// The composition's tracks: players in #@ lines (incl. `# p1 >>` stops) ∪ active players.
function tracks() {
    const set = new Set(_clock ? _clock._players.keys() : []);
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#?\s*([a-zA-Z_]\w*)\s*>>/gm)) set.add(m[1]);
    }
    return [...set].sort();
}

// The composition's named parts (not #@#@ tracks, not goto/end/clear).
function parts() {
    const out = [];
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#@([a-zA-Z_]\w*)\s*(?:\(|$)/gm)) {
            if (!/^(goto|end|endfade|clear)$/i.test(m[1])) out.push(m[1]);
        }
    }
    return [...new Set(out)];
}

// Launch a track: evaluate its `name >>` line from the SOURCE part (else the part
// playing, else the first occurrence). Volume is the shared per-name level, re-applied.
function launchPlayer(name) {
    if (!_runCode || !_editor || !_editor.getValue) return;
    const want = _source ?? _activeSection;
    let part = null, pick = null, first = null;
    for (const raw of _editor.getValue().split('\n')) {
        const t = raw.trim();
        const sec = t.match(/^#@([a-zA-Z_]\w*)/);
        if (sec && !t.startsWith('#@#@')) { part = sec[1]; continue; }
        const pm = t.match(/^\s*([a-zA-Z_]\w*)\s*>>/);        // a real (uncommented) definition
        if (pm && pm[1] === name) { if (first == null) first = raw; if (want == null || part === want) { pick = raw; break; } }
    }
    const code = pick ?? first;
    if (!code) return;
    _runCode(code);
    const p = _clock && _clock._players.get(name);
    if (p && _levels[name] != null) p._mixLevel = _levels[name];
    if (_open) updateConsole();
}

// Stop a track, quantised to the next bar.
function stopPlayer(name) {
    const p = _clock && _clock._players.get(name);
    if (p && p._active) p.stop((_clock && _clock.meter) || 4);
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
    initDrag(_modal.querySelector('.mixer-head'));
}

// Drag the panel by its header (non-modal — move it off your code).
function initDrag(handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.mixer-close')) return;
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

// Source-part picker: 'auto' + one chip per part. Selected = launch source; ● = playing.
function renderParts() {
    const ps = parts();
    if (_source != null && !ps.includes(_source)) _source = null;
    const key = ['auto', ...ps].join(',');
    if (key !== _partsKey) {
        _partsEl.innerHTML = '';
        for (const name of ['auto', ...ps]) {
            const chip = document.createElement('button');
            chip.className = 'mixer-part-chip';
            chip.dataset.part = name;
            chip.textContent = name;
            chip.onclick = () => { _source = name === 'auto' ? null : name; updateConsole(); };
            _partsEl.appendChild(chip);
        }
        _partsKey = key;
    }
    for (const chip of _partsEl.children) {
        const name = chip.dataset.part;
        chip.classList.toggle('selected', (name === 'auto' && _source == null) || name === _source);
        chip.classList.toggle('playing', name !== 'auto' && name === _activeSection);
    }
}

function rebuildChannels(names) {
    _chansEl.innerHTML = '';
    for (const name of names) {
        const row = document.createElement('div');
        row.className = 'mixer-chan';
        row.dataset.name = name;
        row.innerHTML = `
            <span class="mixer-chan-name" title="tap to launch this track's selected-part version">${name}</span>
            <input type="range" class="mixer-chan-fader" min="0" max="1.5" step="0.01" value="1">
            <span class="mixer-chan-lvl">1.00</span>
            <button class="mixer-chan-mute" title="mute">M</button>
            <button class="mixer-chan-stop" title="stop (quantised to the bar)">■</button>
            <button class="mixer-chan-midi" title="MIDI-learn: click, then move a hardware fader">m</button>`;
        row.querySelector('.mixer-chan-name').onclick = () => launchPlayer(name);
        row.querySelector('.mixer-chan-midi').onclick = () => midiLearn(name);
        row.querySelector('.mixer-chan-fader').oninput = (e) => {
            setLevel(name, parseFloat(e.target.value));
            row.querySelector('.mixer-chan-lvl').textContent = parseFloat(e.target.value).toFixed(2);
        };
        row.querySelector('.mixer-chan-mute').onclick = () => {
            const p = _clock && _clock._players.get(name);
            if (p) { p._amplify = p._amplify === 0 ? 1 : 0; updateConsole(); }
        };
        row.querySelector('.mixer-chan-stop').onclick = () => stopPlayer(name);
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
    if (document.activeElement !== _masterFader) { const m = getMasterMix(); _masterFader.value = m; _masterLvl.textContent = m.toFixed(2); }
    updateMidiBtn('__master__');
    // Tracks the SELECTED source part (re)defines get highlighted — so you see which
    // channels a launch from that part would actually fire.
    const src = _source ?? _activeSection;
    const defined = src ? playersInPart(src) : null;
    for (const row of _chansEl.children) {
        const name = row.dataset.name;
        const p = _clock && _clock._players.get(name);
        const fader = row.querySelector('.mixer-chan-fader');
        if (document.activeElement !== fader) {
            const lv = levelOf(name);
            fader.value = lv;
            row.querySelector('.mixer-chan-lvl').textContent = lv.toFixed(2);
        }
        row.classList.toggle('inactive', !p || !p._active);
        row.classList.toggle('in-source', !!(defined && defined.has(name)));   // defined by the source part
        row.classList.toggle('not-source', !!(defined && !defined.has(name))); // not in the source part
        row.querySelector('.mixer-chan-mute').classList.toggle('on', !!(p && p._amplify === 0));
        updateMidiBtn(name);
    }
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
