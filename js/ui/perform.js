// perform.js — a full-screen, keyboard-free PERFORMANCE surface (built for phones,
// works anywhere). The phone becomes a live instrument for a set authored elsewhere
// (desktop, a shared link, an example): tap a player TILE to launch/stop it (bar-
// quantised), DRAG a tile left/right for its volume (swipe up/down to scroll the grid),
// tap a SECTION button to jump the arrangement, hold a momentary FX (DROP / STUTTER /
// GATE / ECHO), and sweep the MASTER + XY (FILTER / SPACE) over everything. A beat dot
// pulses the tempo.
//
// It drives the SAME engine as the mixer (shared launch/stop/level) and the sections
// sequencer — no duplicate state, so it always agrees with the code + the desk.

import { tracks, parts, launchPlayer, stopPlayer, levelOf, setLevel } from './mixer.js';
import { getSections, runSection } from '../engine/sections.js';
import { setMasterMix } from '../engine/player.js';
import { toggleSolo, isSoloed } from '../engine/gate.js';

let _clock = null, _modal = null, _open = false, _timer = null, _beatRAF = null;
let _tilesEl = null, _secsEl = null;
let _lastTiles = '', _lastSecs = '';

export function initPerform(clock) { _clock = clock; }

function isPlaying(name) { const p = _clock && _clock._players.get(name); return !!(p && p._active); }

// Player tiles that are part of the composition (∪ anything currently live).
function tileNames() { return tracks(); }
// Named parts of the arrangement, with line + active flag (for the jump buttons).
function sectionList() {
    return getSections().filter(s => s.type !== 'track' && !/^(goto|end|endfade|clear)$/i.test(s.name));
}

function fillTile(el, name) {
    const lvl = levelOf(name);
    el.classList.toggle('on', isPlaying(name));
    el.classList.toggle('soloed', isSoloed(name));
    const fill = el.querySelector('.perf-tile-fill');
    if (fill) fill.style.width = Math.min(100, (lvl / 1.5) * 100) + '%';   // left→right volume fill
}
// short haptic tick on a launch/stop tap (phones only; no-op elsewhere)
function buzz(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }

function makeTile(name) {
    const el = document.createElement('div');
    el.className = 'perf-tile';
    el.dataset.name = name;
    el.innerHTML = `<span class="perf-tile-fill"></span><span class="perf-tile-solo">S</span><span class="perf-tile-name">${name}</span>`;
    // Gesture split so the tile grid can still SCROLL:
    //   tap             → launch / stop (quantised)
    //   long-press      → solo / unsolo (shared with the mixer + Players panel)
    //   horizontal drag → volume (this tile)
    //   vertical drag   → yields to the native pan-y scroll of the grid
    // We don't capture the pointer until the move is confirmed horizontal, and a
    // pointercancel (the browser taking the gesture for scrolling) is NOT a tap.
    let sx = 0, sy = 0, startLvl = 1, mode = null, held = false, lpT = null;   // mode: null | 'vol' | 'scroll'
    el.addEventListener('pointerdown', (e) => {
        sx = e.clientX; sy = e.clientY; startLvl = levelOf(name); mode = null; held = false;
        lpT = setTimeout(() => { if (mode === null) { held = true; toggleSolo(name); buzz(28); refresh(); } }, 450);
    });
    el.addEventListener('pointermove', (e) => {
        if (mode === 'scroll') return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (mode === null) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            clearTimeout(lpT);   // moved → not a long-press
            if (Math.abs(dx) > Math.abs(dy)) { mode = 'vol'; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
            else { mode = 'scroll'; return; }   // let the grid scroll
        }
        if (mode === 'vol') { setLevel(name, Math.max(0, Math.min(1.5, startLvl + dx / 130))); fillTile(el, name); }
    });
    el.addEventListener('pointerup', () => {
        clearTimeout(lpT);
        if (mode === null && !held) { isPlaying(name) ? stopPlayer(name) : launchPlayer(name); buzz(); refresh(); }   // TAP
        mode = null;
    });
    el.addEventListener('pointercancel', () => { clearTimeout(lpT); mode = null; });   // scroll takeover — not a tap
    return el;
}

function build() {
    _modal = document.createElement('div');
    _modal.id = 'perform-overlay';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="perf-head">
            <span class="perf-beat" title="beat"></span>
            <span class="perf-title">▶ PERFORM</span>
            <button class="perf-close" title="exit perform mode">×</button>
        </div>
        <div class="perf-tiles" title="tap = launch / stop · hold = solo · drag ◄ ► = volume · swipe ↕ to scroll"></div>
        <div class="perf-rail">
        <div class="perf-secs-wrap"><div class="perf-secs" title="jump the arrangement to a section"></div></div>
        <div class="perf-fx" title="hold to fire, release to return">
            <button class="perf-fxbtn" data-fx="drop">DROP</button>
            <button class="perf-fxbtn" data-fx="stutter">STUTTER</button>
            <button class="perf-fxbtn" data-fx="gate">GATE</button>
            <button class="perf-fxbtn" data-fx="echo">ECHO</button>
        </div>
        <div class="perf-macros">
            <label class="perf-macro perf-macro-master">MASTER<input type="range" class="perf-mac perf-master" min="0" max="1.5" step="0.01" value="1"></label>
            <div class="perf-xy" title="X = filter (right = open) · Y = space / reverb (up = wetter)">
                <span class="perf-xy-lx">FILTER →</span>
                <span class="perf-xy-ly">SPACE ↑</span>
                <span class="perf-xy-dot"></span>
            </div>
        </div>
        </div>`;
    document.body.appendChild(_modal);
    _tilesEl = _modal.querySelector('.perf-tiles');
    _secsEl  = _modal.querySelector('.perf-secs');
    _modal.querySelector('.perf-close').onclick = () => closePerform();

    // MASTER → module master gain.
    _modal.querySelector('.perf-master').oninput = (e) => setMasterMix(parseFloat(e.target.value));

    // XY pad: X = filter cutoff (right = open), Y = space / reverb (up = wetter). One
    // two-axis control replaces the old FILTER + SPACE sliders. Cheap: it applies on
    // pointer move (input rate) via the same setAttr the sliders used — no timers.
    const xy = _modal.querySelector('.perf-xy');
    const dot = xy.querySelector('.perf-xy-dot');
    let xyOn = false;
    const applyXY = (e) => {
        const r = xy.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));   // 0 left … 1 right
        const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));   // 0 top … 1 bottom
        dot.style.left = (x * 100) + '%';
        dot.style.top  = (y * 100) + '%';
        const lpf   = x >= 0.98 ? 0 : Math.round(200 + x * 8000);             // right edge = filter off (open)
        const space = 1 - y;                                                  // up = more reverb
        if (_clock) _clock._players.forEach((p) => {
            p.setAttr('lpf', lpf);
            p.setAttr('reverb', space);
            if (space > 0.001) p.setAttr('room', 0.85);
        });
    };
    xy.addEventListener('pointerdown', (e) => { xyOn = true; try { xy.setPointerCapture(e.pointerId); } catch (_) {} applyXY(e); });
    xy.addEventListener('pointermove', (e) => { if (xyOn) applyXY(e); });
    const xyEnd = () => { xyOn = false; };
    xy.addEventListener('pointerup', xyEnd);
    xy.addEventListener('pointercancel', xyEnd);
    // start dot at the neutral corner (filter open, no reverb)
    dot.style.left = '100%'; dot.style.top = '100%';

    // Momentary FX — hold to engage, release to return. Set-while-held (no timers):
    // DROP slams the filter shut on every player; STUTTER rolls every player (beat-
    // repeat) by bumping _multiply. Cheap and self-restoring on release.
    let stutSaved = null;
    const fxEngage = (fx) => {
        if (!_clock) return;
        buzz(18);
        if (fx === 'drop') _clock._players.forEach((p) => { p.setAttr('lpf', 180); p.setAttr('lpr', 0.2); });
        else if (fx === 'stutter') { stutSaved = new Map(); _clock._players.forEach((p, n) => { stutSaved.set(n, p._multiply ?? 1); p._multiply = 4; }); }
        else if (fx === 'gate') _clock._players.forEach((p) => { p.setAttr('rgate', 0.85); p.setAttr('rgaterate', 8); });
        else if (fx === 'echo') _clock._players.forEach((p) => p.setAttr('echo', 0.6));
    };
    const fxRelease = (fx) => {
        if (!_clock) return;
        if (fx === 'drop') _clock._players.forEach((p) => p.setAttr('lpf', 0));   // slam open
        else if (fx === 'stutter') { _clock._players.forEach((p, n) => { p._multiply = (stutSaved && stutSaved.get(n)) || 1; }); stutSaved = null; }
        else if (fx === 'gate') _clock._players.forEach((p) => p.setAttr('rgate', 0));
        else if (fx === 'echo') _clock._players.forEach((p) => p.setAttr('echo', 0));
    };
    _modal.querySelectorAll('.perf-fxbtn').forEach((btn) => {
        const fx = btn.dataset.fx;
        btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch (_) {} btn.classList.add('on'); fxEngage(fx); });
        const rel = () => { if (!btn.classList.contains('on')) return; btn.classList.remove('on'); fxRelease(fx); };
        btn.addEventListener('pointerup', rel);
        btn.addEventListener('pointercancel', rel);
    });
}

// Rebuild tiles / sections only when the set of names changes (cheap on the timer).
function rebuild() {
    const names = tileNames();
    const key = names.join(',');
    if (key !== _lastTiles) {
        _lastTiles = key;
        _tilesEl.innerHTML = '';
        names.forEach((n) => _tilesEl.appendChild(makeTile(n)));
    }
    const secs = sectionList();
    const skey = secs.map((s) => s.name + s.line).join(',');
    if (skey !== _lastSecs) {
        _lastSecs = skey;
        _secsEl.innerHTML = '';
        if (!secs.length) {
            _secsEl.innerHTML = '<span class="perf-nosecs">no #@ sections</span>';
        } else secs.forEach((s) => {
            const b = document.createElement('button');
            b.className = 'perf-sec'; b.dataset.line = s.line; b.textContent = s.name;
            b.onclick = () => { runSection(s.line); refresh(); };
            _secsEl.appendChild(b);
        });
    }
}

// Live state — playing highlight + level fills + active section, on a timer.
function refresh() {
    if (!_open) return;
    rebuild();
    _tilesEl.querySelectorAll('.perf-tile').forEach((el) => fillTile(el, el.dataset.name));
    const active = sectionList().find((s) => s.active);
    _secsEl.querySelectorAll('.perf-sec').forEach((b) => {
        b.classList.toggle('on', active && String(active.line) === b.dataset.line);
    });
}

// Beat dot — pulses on the clock so the performer feels the tempo (accented downbeat).
function beatLoop() {
    if (!_open) { _beatRAF = null; return; }
    const dot = _modal && _modal.querySelector('.perf-beat');
    if (dot && _clock) {
        const beat  = _clock.now ? _clock.now() : 0;
        const pulse = 1 - (beat - Math.floor(beat));          // bright at the beat, fades to next
        const down  = (Math.floor(beat) % (_clock.meter || 4)) === 0;
        dot.style.opacity   = (0.25 + pulse * 0.75).toFixed(3);
        dot.style.transform = `scale(${(0.75 + pulse * 0.55).toFixed(3)})`;
        dot.style.background = down ? 'var(--yellow)' : 'var(--green)';
    }
    _beatRAF = requestAnimationFrame(beatLoop);
}

export function openPerform() {
    if (!_modal) build();
    _open = true; _lastTiles = ''; _lastSecs = '';
    _modal.classList.remove('hidden');
    document.body.classList.add('performing');
    refresh();
    if (!_timer) _timer = setInterval(refresh, 400);
    if (!_beatRAF) _beatRAF = requestAnimationFrame(beatLoop);
}
export function closePerform() {
    _open = false;
    if (_modal) _modal.classList.add('hidden');
    document.body.classList.remove('performing');
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_beatRAF) { cancelAnimationFrame(_beatRAF); _beatRAF = null; }
}
export function togglePerform() { _open ? closePerform() : openPerform(); }
export function isPerformOpen() { return _open; }
