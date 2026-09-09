// Crashpanel — collapsible right sidebar: clock state, scale, players.

import { Scale, Root } from '../engine/scale.js';
import { toggleMute, toggleSolo, isMuted, isSoloed, forget as gateForget } from '../engine/gate.js';
import { share, shareState } from '../collab/actions.js';
import { levelOf, setLevel } from './mixer.js';
import { heldByUser } from './controls.js';

let _clock = null;
// The live video layers, injected so this panel never imports the visual language —
// see setVideoApi. Without it the list behaves exactly as it did.
let _video = null;
/** { list: () => [{name, scene, ch, ws}], stop: (name) => void } */
export function setVideoApi(api) { _video = api; }
let _timer  = null;
let _tapTimes = [];
let _tapTimer = null;

export function initCrashPanel(clock) {
    _clock = clock;
    _restoreSize();
    _initResize();
    _initWidthResize();
    _initTap();
    _initTheme();
    _initScaleRoot();
    _timer = setInterval(_update, 250);
    _update();
    requestAnimationFrame(_beatLoop);   // smooth beat/subdivision display (~25fps)
}

// The panel's stop: immediate, NOT bar-quantised like the mixer's ■ — that difference
// is deliberate, this is the "get it off me now" button. Exported so a peer's
// 'panelStop' replays through the identical path instead of a near-copy.
export function panelStop(name) {
    gateForget(name);                                   // clears mute/solo, locally + for the room
    if (_clock) _clock._players.get(name)?.stop();       // no grid — stop on the spot
}

// The beat sub-counter (▪◦) and phrase bars need a faster refresh than the 250ms
// _update — at that rate the subdivision aliases (flickers between 0 and 2). Run
// just the cheap beat readout on a throttled rAF loop instead.
let _lastBeatT = 0;
function _beatLoop(t) {
    requestAnimationFrame(_beatLoop);
    if (!_clock || t - _lastBeatT < 40) return;
    _lastBeatT = t;
    _updateBeat();
}

// ── Update loop ──────────────────────────────────────────────────────────────

function _update() {
    if (!_clock) return;
    _updateBpm();
    _updatePlayers();
    _reflectScaleRoot();
    // _updateBeat() runs on its own rAF loop (smoother subdivisions)
}

function _updateBpm() {
    // BPM now lives in the sidebar as an editable input — keep it in sync with the
    // clock, but don't clobber what the user is typing while the field is focused.
    const el = document.getElementById('bpm-input');
    if (el && !heldByUser(el)) el.value = _clock.bpm;
}

function _updateBeat() {
    const now = _clock.now();

    // Phrase counters — position within a 4/8/16/32/64-length phrase, stepping once
    // per BEAT (not per bar), so they move 4× faster and read as beat subdivisions.
    const idx = Math.floor(now);                // 0-indexed beat
    for (const len of [4, 8, 16, 32, 64]) {
        const d = document.getElementById('phrase-' + len);
        if (!d) continue;
        const pos = (idx % len) + 1;            // 1..len, jumps once per beat
        const pct = (pos / len) * 100;          // discrete fill, steps with the beat
        d.style.background = `linear-gradient(to right, var(--green-dim) ${pct}%, var(--bg-3) ${pct}%)`;
        d.textContent = `${pos}/${len}`;
    }
}

function _updatePlayers() {
    const container = document.getElementById('cp-players');
    if (!container || !_clock._players) return;
    const now = Date.now();

    // A video layer IS a player — same name space, same >>, stopped the same way —
    // and it was the one kind that never appeared here, so a set with three scenes
    // running looked like a set with nothing running. It gets a row of its own shape
    // rather than a copy of the audio one: there is no fader, solo or mute, because a
    // layer has no level to ride and muting a picture is not a thing. What it does
    // have is which DECK it is on, which is the thing you actually want to see.
    const vids = (_video && _video.list && _video.list()) || [];
    const vidNames = new Set(vids.map((v) => v.name));

    // Stopped/gone players drop out of the list entirely.
    for (const row of [...container.querySelectorAll('.cp-player-row')]) {
        const nm = row.dataset.name;
        if (row.classList.contains('is-video')) { if (!vidNames.has(nm)) row.remove(); continue; }
        const p = _clock._players.get(nm);
        if (!p || !p._active) row.remove();
    }

    for (const v of vids) {
        let row = container.querySelector(`[data-name="${v.name}"].is-video`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'cp-player-row active is-video';
            row.dataset.name = v.name;
            row.innerHTML = `
                <div class="cp-player-top">
                    <span class="cp-player-name" title="a video layer">${v.name}</span>
                    <span class="cp-player-synth"></span>
                    <span class="cp-player-deck" title="which deck — what mix() crossfades between"></span>
                    <button class="cp-player-stop" title="stop this layer">\u25a0</button>
                </div>`;
            row.querySelector('.cp-player-stop').onclick = () => { _video.stop?.(v.name); _update(); };
            container.appendChild(row);
        }
        const sc = row.querySelector('.cp-player-synth');
        if (sc) { sc.textContent = v.scene; sc.title = v.ws ? 'a workshop layer — brings its own colour' : 'a video synth — a field on the GPU, coloured by palette()'; }
        const dk = row.querySelector('.cp-player-deck');
        if (dk) dk.textContent = 'ch' + (v.ch || 0);
    }

    for (const [name, p] of _clock._players.entries()) {
        if (!p._active) continue;
        let row = container.querySelector(`[data-name="${name}"]`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'cp-player-row active';
            row.dataset.name = name;
            row.innerHTML = `
                <div class="cp-player-top">
                    <span class="cp-player-name" title="tap to mute / unmute">${name}</span>
                    <span class="cp-player-synth"></span>
                    <span class="cp-player-age"></span>
                    <button class="cp-player-solo" title="solo (mute the rest)">S</button>
                    <button class="cp-player-stop" title="stop">■</button>
                </div>
                <div class="cp-player-mix">
                    <input type="range" class="cp-player-fader" min="0" max="1.5" step="0.01" value="1"
                           title="mixer level — scales this track's volume (× amplify)">
                    <span class="cp-player-lvl">1.00</span>
                </div>`;
            // Tap the name → toggle a reversible mute (shared gate — agrees with the mixer).
            row.querySelector('.cp-player-name').onclick = () => { toggleMute(name); _update(); };
            // Solo → shared gate (multi-solo; agrees with the mixer + eval .solo()).
            row.querySelector('.cp-player-solo').onclick = () => { toggleSolo(name); _update(); };
            row.querySelector('.cp-player-stop').onclick = () => { panelStop(name); share('panelStop', { name }); };
            // Fader → the SHARED per-track level. This used to assign p._mixLevel
            // directly, which made this panel a second source of truth: the mixer keeps
            // its own _levels map (it has to — a level outlives the player it belongs
            // to), so the two desks disagreed, launching a track re-applied the mixer's
            // value over whatever was set here, and none of it reached the room.
            // setLevel() owns both, and shares.
            const fader = row.querySelector('.cp-player-fader');
            const lvlEl = row.querySelector('.cp-player-lvl');
            fader.oninput = () => { const v = parseFloat(fader.value); setLevel(name, v); lvlEl.textContent = v.toFixed(2); };
            container.appendChild(row);
        }
        // Reflect mute (amplify 0 — from a tap, a solo elsewhere, or a drop) and solo live.
        row.classList.toggle('muted', isMuted(name));
        row.classList.toggle('soloed', isSoloed(name));
        // Keep the fader in sync if _mixLevel changed elsewhere (e.g. ~reset) — but not
        // while the user is dragging it.
        const fader = row.querySelector('.cp-player-fader');
        if (fader && !heldByUser(fader)) {
            const lv = levelOf(name);   // same source the mixer reads, so they agree
            fader.value = lv;
            row.querySelector('.cp-player-lvl').textContent = lv.toFixed(2);
        }
        const synthEl = row.querySelector('.cp-player-synth');
        // Sample players (play()) have no synth name — label them "play".
        if (synthEl) synthEl.textContent = p._mode === 'loop' ? `loop:${p._loopName}`
                                          : p._synth ?? (p._mode === 'sample' ? 'play' : '');
        // Age: green when fresh → red the longer it has been playing (webTroop-style)
        const ageEl = row.querySelector('.cp-player-age');
        if (ageEl) {
            const secs = Math.max(0, (now - (p._activeSince || now)) / 1000);
            ageEl.textContent  = _fmtDuration(secs);
            ageEl.style.color  = _durationColor(secs / 60);
        }
    }
}

// MM:SS
function _fmtDuration(secs) {
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
// green (≤1 min) → red (≥5 min), interpolated in between
function _durationColor(totalMinutes) {
    const green = '#3fb950', red = '#f85149';
    if (totalMinutes <= 1) return green;
    if (totalMinutes >= 5) return red;
    return _lerpColor(green, red, (totalMinutes - 1) / 4);
}
function _lerpColor(c1, c2, f) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) + f * (((b >> 16) & 255) - ((a >> 16) & 255)));
    const g = Math.round(((a >> 8) & 255)  + f * (((b >> 8) & 255)  - ((a >> 8) & 255)));
    const bl = Math.round((a & 255)        + f * ((b & 255)         - (a & 255)));
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

// ── Tap tempo ────────────────────────────────────────────────────────────────

function _initTap() {
    const btn = document.getElementById('cp-tap');
    if (!btn) return;
    btn.onclick = () => {
        const now = performance.now();
        _tapTimes.push(now);
        // Keep only last 8 taps
        if (_tapTimes.length > 8) _tapTimes.shift();

        clearTimeout(_tapTimer);
        _tapTimer = setTimeout(() => { _tapTimes = []; btn.classList.remove('tapping'); }, 3000);

        if (_tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < _tapTimes.length; i++) intervals.push(_tapTimes[i] - _tapTimes[i - 1]);
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60000 / avg);
            if (bpm >= 20 && bpm <= 300) {
                if (_clock) _clock.bpm = bpm;
                const inp = document.getElementById('bpm-input');
                if (inp) inp.value = bpm;
                btn.textContent = `${bpm}`;
                shareState('bpm', bpm);   // tap the room into tempo, not just yourself
            }
        } else {
            btn.textContent = 'tap…';
        }
        btn.classList.add('tapping');
    };
}

// ── Scale / Root selects ─────────────────────────────────────────────────────

let _scaleEl = null, _rootEl = null;
function _initScaleRoot() {
    const scaleEl = _scaleEl = document.getElementById('cp-scale-sel');
    const rootEl  = _rootEl  = document.getElementById('cp-root-sel');

    if (scaleEl) {
        const scales = Scale.names;   // all of SCALE_MAP (auto-includes ported FoxDot scales)
        scales.forEach(s => {
            const o = document.createElement('option');
            o.value = o.textContent = s;
            if (s === 'minor') o.selected = true;
            scaleEl.appendChild(o);
        });
        // Only the DROPDOWN shares — not Scale.default itself, unlike gate.js's mute.
        // An eval that sets the scale already syncs as code, and a Scale.default =
        // var([...]) would get frozen on peers if we broadcast the sampled name.
        scaleEl.onchange = () => { Scale.default = scaleEl.value; shareState('scale', scaleEl.value); };
        // External changes (e.g. Scale.default="major" in the editor) reflected in
        // _update (folded in from a separate 500ms timer).
    }

    if (rootEl) {
        const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        notes.forEach((n, i) => {
            const o = document.createElement('option');
            o.value = i; o.textContent = n;
            rootEl.appendChild(o);
        });
        rootEl.onchange = () => { Root.default = Number(rootEl.value); shareState('root', Number(rootEl.value)); };
    }
}

// Reflect external Scale/Root changes back into the selects (called from _update).
function _reflectScaleRoot() {
    // Use the RESOLVED current name/semitone so the selects follow both code changes
    // (Scale.default = "major") and a var (Scale.default = var([...])) as it advances.
    if (_scaleEl) { const n = Scale.currentName; if (n !== '__custom' && _scaleEl.value !== n) _scaleEl.value = n; }
    if (_rootEl) { const r = String(Root.default ?? 0); if (_rootEl.value !== r) _rootEl.value = r; }
}

// ── Sidebar width resize ──────────────────────────────────────────────────────

function _initWidthResize() {
    const handle = document.getElementById('cp-resize');
    const panel  = document.getElementById('crash-panel');
    if (!handle || !panel) return;

    const saved = localStorage.getItem('cpWidth');
    if (saved) document.documentElement.style.setProperty('--cp-width', saved + 'px');

    let dragging = false;
    handle.addEventListener('mousedown', (e) => {
        dragging = true;
        panel.classList.add('resizing');
        document.body.classList.add('cp-resizing');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const w = Math.max(160, Math.min(window.innerWidth - e.clientX, 640));
        document.documentElement.style.setProperty('--cp-width', w + 'px');
    }, { passive: true });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove('resizing');
        document.body.classList.remove('cp-resizing');
        document.body.style.cursor = '';
        localStorage.setItem('cpWidth', parseInt(getComputedStyle(panel).width, 10));
    });
}

// ── Theme selector ───────────────────────────────────────────────────────────

function _initTheme() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    let stored = localStorage.getItem('theme') ?? 'cyberpunk';
    if (stored === 'terminal') { stored = 'hacker'; localStorage.setItem('theme', stored); }  // Terminal retired → Hacker
    document.documentElement.className = stored === 'dark' ? '' : stored;
    sel.value = stored;
    sel.onchange = () => {
        const t = sel.value;
        document.documentElement.className = t === 'dark' ? '' : t;
        localStorage.setItem('theme', t);
    };
}

// ── Resizable log panel ───────────────────────────────────────────────────────

function _initResize() {
    const handle    = document.getElementById('log-handle');
    const logPanel  = document.getElementById('log');
    const container = document.getElementById('editor-container');
    if (!handle || !logPanel || !container) return;

    let dragging = false, startY = 0, startH = 0;

    handle.addEventListener('mousedown', (e) => {
        dragging = true;
        startY = e.clientY;
        startH = logPanel.offsetHeight;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = startY - e.clientY;
        const newH  = Math.max(30, Math.min(startH + delta, container.offsetHeight - 100));
        logPanel.style.height = newH + 'px';
        localStorage.setItem('logHeight', newH);
    }, { passive: true });

    document.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; document.body.style.cursor = ''; }
    });
}

function _restoreSize() {
    const h = localStorage.getItem('logHeight');
    if (h) {
        const logPanel = document.getElementById('log');
        if (logPanel) logPanel.style.height = h + 'px';
    }
}
