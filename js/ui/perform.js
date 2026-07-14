// perform.js — a full-screen, keyboard-free PERFORMANCE surface (built for phones,
// works anywhere). The phone becomes a live instrument for a set authored elsewhere
// (desktop, a shared link, an example): tap a player TILE to launch/stop it (bar-
// quantised), DRAG a tile up/down for its volume, tap a SECTION button to jump the
// arrangement, and sweep the MASTER / FILTER / SPACE macros over everything.
//
// It drives the SAME engine as the mixer (shared launch/stop/level) and the sections
// sequencer — no duplicate state, so it always agrees with the code + the desk.

import { tracks, parts, launchPlayer, stopPlayer, levelOf, setLevel } from './mixer.js';
import { getSections, runSection } from '../engine/sections.js';
import { setMasterMix } from '../engine/player.js';

let _clock = null, _modal = null, _open = false, _timer = null;
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
    const fill = el.querySelector('.perf-tile-fill');
    if (fill) fill.style.height = Math.min(100, (lvl / 1.5) * 100) + '%';
}

function makeTile(name) {
    const el = document.createElement('div');
    el.className = 'perf-tile';
    el.dataset.name = name;
    el.innerHTML = `<span class="perf-tile-fill"></span><span class="perf-tile-name">${name}</span>`;
    let dragging = false, moved = false, startY = 0, startLvl = 1;
    el.addEventListener('pointerdown', (e) => {
        dragging = true; moved = false; startY = e.clientY; startLvl = levelOf(name);
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dy = startY - e.clientY;
        if (Math.abs(dy) > 6) moved = true;
        if (moved) { setLevel(name, Math.max(0, Math.min(1.5, startLvl + dy / 140))); fillTile(el, name); }
    });
    const end = () => {
        if (!dragging) return;
        dragging = false;
        if (!moved) { isPlaying(name) ? stopPlayer(name) : launchPlayer(name); refresh(); }  // TAP = launch/stop
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return el;
}

function build() {
    _modal = document.createElement('div');
    _modal.id = 'perform-overlay';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="perf-head">
            <span class="perf-title">▶ PERFORM</span>
            <button class="perf-close" title="exit perform mode">×</button>
        </div>
        <div class="perf-tiles" title="tap a tile = launch/stop (quantised) · drag up/down = its volume"></div>
        <div class="perf-secs-wrap"><div class="perf-secs" title="jump the arrangement to a section"></div></div>
        <div class="perf-macros">
            <label class="perf-macro perf-macro-master">MASTER<input type="range" class="perf-mac perf-master" min="0" max="1.5" step="0.01" value="1"></label>
            <div class="perf-xy" title="X = filter (right = open) · Y = space / reverb (up = wetter)">
                <span class="perf-xy-lx">FILTER →</span>
                <span class="perf-xy-ly">SPACE ↑</span>
                <span class="perf-xy-dot"></span>
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

export function openPerform() {
    if (!_modal) build();
    _open = true; _lastTiles = ''; _lastSecs = '';
    _modal.classList.remove('hidden');
    document.body.classList.add('performing');
    refresh();
    if (!_timer) _timer = setInterval(refresh, 400);
}
export function closePerform() {
    _open = false;
    if (_modal) _modal.classList.add('hidden');
    document.body.classList.remove('performing');
    if (_timer) { clearInterval(_timer); _timer = null; }
}
export function togglePerform() { _open ? closePerform() : openPerform(); }
export function isPerformOpen() { return _open; }
