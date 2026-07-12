// Mixer — a pop-out console of volume faders over a composition's tracks, plus the
// per-SECTION level model. Faders drive each player's persistent `_mixLevel` (read
// every note in the engine), kept separate from `_amplify` (mute/solo/drop).
//
// The model (answers the "how does it know the parts" questions):
//  • TRACKS = every player that appears in the composition — the union of `name >>`
//    lines parsed from the #@ sections (commented lines included) and the currently
//    ACTIVE players. So a track shows up even before it has played.
//  • SAME PLAYER IN DIFFERENT PARTS = still ONE track (one player object, one
//    `_mixLevel`). To let it be a different volume per part, levels are stored per
//    scope: LEVELS['*'] is the global level for a track everywhere; LEVELS[sectionName]
//    is an override for that part only.
//        effective(player, section) = LEVELS[section]?.[p] ?? LEVELS['*']?.[p] ?? 1
//  • ON SECTION ENTRY (auto-advance, tap-to-jump, OR manually evaluating a #@ line —
//    all go through runSection → onActive) we apply effective(p, section) to every
//    active player. So evaluating `#@drop` in code applies the drop's mix; the same
//    d1 can be quiet in the build and loud in the drop, resolved live.
//  • MASTER scales everything (setMasterMix).

import { setMasterMix, getMasterMix } from '../engine/player.js';

let _clock = null, _editor = null;
const LEVELS = { '*': {} };     // scope → { player → level }.  '*' = global default.
let _scope = '*';               // which scope the console faders currently edit
let _activeSection = null;      // the section playing now (from onSectionActive)
let _open = false;
let _lastTracks = '';           // to rebuild channels only when the track set changes

export function initMixer(clock, editor) { _clock = clock; _editor = editor; }

const eff = (player, section) =>
    (LEVELS[section] && LEVELS[section][player] != null) ? LEVELS[section][player]
    : (LEVELS['*'][player] != null) ? LEVELS['*'][player] : 1;

// Apply a section's effective levels to every active player. Called on section entry.
export function onSectionActive(sectionName) {
    _activeSection = sectionName || null;
    if (_clock) for (const [name, p] of _clock._players) p._mixLevel = eff(name, _activeSection);
    if (_open) updateConsole();
}

// The composition's tracks: players in #@ lines (incl. `# p1 >>` stops) ∪ active players.
function tracks() {
    const set = new Set(_clock ? _clock._players.keys() : []);
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#?\s*([a-zA-Z_]\w*)\s*>>/gm)) set.add(m[1]);
    }
    return [...set].sort();
}

// The composition's PARTS: named #@ sections in document order (not #@#@ tracks, not
// the control nodes goto/end/clear). These become the part-picker chips.
function parts() {
    const out = [];
    if (_editor && _editor.getValue) {
        for (const m of _editor.getValue().matchAll(/^\s*#@([a-zA-Z_]\w*)\s*(?:\(|$)/gm)) {
            const name = m[1];
            if (!/^(goto|end|endfade|clear)$/i.test(name)) out.push(name);
        }
    }
    return [...new Set(out)];
}

// Level for a track in the CURRENT edit scope (what the console fader shows).
function levelForScope(player) {
    if (LEVELS[_scope] && LEVELS[_scope][player] != null) return LEVELS[_scope][player];
    return _scope === '*' ? 1 : (LEVELS['*'][player] != null ? LEVELS['*'][player] : 1);
}
// Write a level into the current scope, and apply it live if it affects what's playing.
function setLevel(player, level) {
    (LEVELS[_scope] || (LEVELS[_scope] = {}))[player] = level;
    const p = _clock && _clock._players.get(player);
    if (p) p._mixLevel = eff(player, _activeSection);
}

// ── Console UI ──────────────────────────────────────────────────────────────
let _modal = null, _chansEl = null, _partsEl = null, _hintEl = null, _masterFader = null, _masterLvl = null;
let _partsKey = '';

function build() {
    _modal = document.createElement('div');
    _modal.id = 'mixer-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="mixer-box">
            <div class="mixer-head">
                <span class="mixer-title">🎚 mixer</span>
                <div style="flex:1"></div>
                <button class="mixer-close" title="close">×</button>
            </div>
            <div class="mixer-parts" title="pick which part's levels the faders edit · ● = the part playing now"></div>
            <div class="mixer-chan mixer-master">
                <span class="mixer-chan-name">MASTER</span>
                <input type="range" class="mixer-chan-fader" min="0" max="1.5" step="0.01" value="1">
                <span class="mixer-chan-lvl">1.00</span>
            </div>
            <div class="mixer-chans"></div>
            <div class="mixer-hint"></div>
        </div>`;
    document.body.appendChild(_modal);
    _chansEl     = _modal.querySelector('.mixer-chans');
    _partsEl     = _modal.querySelector('.mixer-parts');
    _hintEl      = _modal.querySelector('.mixer-hint');
    _masterFader = _modal.querySelector('.mixer-master .mixer-chan-fader');
    _masterLvl   = _modal.querySelector('.mixer-master .mixer-chan-lvl');
    _modal.querySelector('.mixer-close').onclick = closeMixer;
    _modal.addEventListener('click', (e) => { if (e.target === _modal) closeMixer(); });   // backdrop
    _masterFader.oninput = () => { setMasterMix(parseFloat(_masterFader.value)); _masterLvl.textContent = parseFloat(_masterFader.value).toFixed(2); };
}

// The part-picker chips: ★Global + one per named part. Selected = editing; ● = playing.
function renderParts() {
    const ps = parts();
    if (_scope !== '*' && !ps.includes(_scope)) _scope = '*';   // scope's part was removed
    const key = ['*', ...ps].join(',');
    if (key !== _partsKey) {
        _partsEl.innerHTML = '';
        for (const name of ['*', ...ps]) {
            const chip = document.createElement('button');
            chip.className = 'mixer-part-chip';
            chip.dataset.part = name;
            chip.textContent = name === '*' ? '★ Global' : name;
            chip.onclick = () => { _scope = name; updateConsole(); };
            _partsEl.appendChild(chip);
        }
        _partsKey = key;
    }
    for (const chip of _partsEl.children) {
        const name = chip.dataset.part;
        chip.classList.toggle('selected', _scope === name);
        chip.classList.toggle('playing', name !== '*' && name === _activeSection);
    }
}

function rebuildChannels(names) {
    _chansEl.innerHTML = '';
    for (const name of names) {
        const row = document.createElement('div');
        row.className = 'mixer-chan';
        row.dataset.name = name;
        row.innerHTML = `
            <span class="mixer-chan-name">${name}</span>
            <span class="mixer-chan-ovr" title="this part overrides the global level">•</span>
            <button class="mixer-chan-mute" title="mute">M</button>
            <input type="range" class="mixer-chan-fader" min="0" max="1.5" step="0.01" value="1">
            <span class="mixer-chan-lvl">1.00</span>`;
        row.querySelector('.mixer-chan-fader').oninput = (e) => {
            setLevel(name, parseFloat(e.target.value));
            row.querySelector('.mixer-chan-lvl').textContent = parseFloat(e.target.value).toFixed(2);
            row.classList.add('has-ovr');   // moving a fader in a part-scope creates an override
        };
        row.querySelector('.mixer-chan-mute').onclick = () => {
            const p = _clock && _clock._players.get(name);
            if (p) { p._amplify = p._amplify === 0 ? 1 : 0; updateConsole(); }
        };
        _chansEl.appendChild(row);
    }
}

function updateConsole() {
    if (!_open) return;
    renderParts();
    const names = tracks();
    const key = names.join(',');
    if (key !== _lastTracks) { rebuildChannels(names); _lastTracks = key; }
    // hint: what the faders currently edit
    _hintEl.textContent = _scope === '*'
        ? 'editing: Global — the base level for every part'
        : `editing: ${_scope}` + (_scope === _activeSection ? ' — the part playing now' : ' — not playing (authoring its level)');
    // master
    if (document.activeElement !== _masterFader) { const m = getMasterMix(); _masterFader.value = m; _masterLvl.textContent = m.toFixed(2); }
    // channels
    for (const row of _chansEl.children) {
        const name = row.dataset.name;
        const p = _clock && _clock._players.get(name);
        const fader = row.querySelector('.mixer-chan-fader');
        if (document.activeElement !== fader) {
            const lv = levelForScope(name);
            fader.value = lv;
            row.querySelector('.mixer-chan-lvl').textContent = lv.toFixed(2);
        }
        row.classList.toggle('inactive', !p || !p._active);     // dim tracks not currently playing
        row.querySelector('.mixer-chan-mute').classList.toggle('on', !!(p && p._amplify === 0));
        // override dot: this track has a level set for the picked part (not Global)
        row.classList.toggle('has-ovr', _scope !== '*' && LEVELS[_scope] && LEVELS[_scope][name] != null);
    }
}

export function openMixer() {
    if (!_modal) build();
    _open = true; _lastTracks = '';
    _modal.classList.remove('hidden');
    updateConsole();
    if (!openMixer._timer) openMixer._timer = setInterval(() => { if (_open) updateConsole(); }, 400);
}
export function closeMixer() { _open = false; if (_modal) _modal.classList.add('hidden'); }
export function toggleMixer() { _open ? closeMixer() : openMixer(); }
export function isMixerOpen() { return _open; }
