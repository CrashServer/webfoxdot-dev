// Crashpanel — collapsible right sidebar: clock state, scale, players.

import { Scale, Root } from '../engine/scale.js';

let _clock = null;
let _timer  = null;
let _tapTimes = [];
let _tapTimer = null;

export function initCrashPanel(clock) {
    _clock = clock;
    _restoreSize();
    _initResize();
    _initToggle();
    _initTap();
    _initTheme();
    _initScaleRoot();
    _timer = setInterval(_update, 250);
    _update();
}

// ── Update loop ──────────────────────────────────────────────────────────────

function _update() {
    if (!_clock) return;
    _updateBpm();
    _updateBeat();
    _updatePlayers();
}

function _updateBpm() {
    const el = document.getElementById('cp-bpm-val');
    if (el) el.textContent = _clock.bpm;
}

function _updateBeat() {
    const el = document.getElementById('cp-beat');
    if (!el) return;
    const now = _clock.now();
    if (now <= 0) { el.textContent = '—'; return; }
    const bar  = Math.floor(now / 4) + 1;
    const beat = Math.floor(now % 4) + 1;
    const sub  = Math.floor((now % 1) * 4);
    el.textContent = `${bar} . ${beat}`;
    const sub2 = document.getElementById('cp-beat-sub');
    if (sub2) sub2.textContent = '▪'.repeat(sub) + '◦'.repeat(4 - sub);
}

function _updatePlayers() {
    const container = document.getElementById('cp-players');
    if (!container || !_clock._players) return;
    const now = Date.now();

    // Stopped/gone players drop out of the list entirely.
    for (const row of [...container.querySelectorAll('.cp-player-row')]) {
        const p = _clock._players.get(row.dataset.name);
        if (!p || !p._active) row.remove();
    }

    for (const [name, p] of _clock._players.entries()) {
        if (!p._active) continue;
        let row = container.querySelector(`[data-name="${name}"]`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'cp-player-row active';
            row.dataset.name = name;
            row.innerHTML = `
                <span class="cp-player-name">${name}</span>
                <span class="cp-player-synth"></span>
                <span class="cp-player-age"></span>
                <button class="cp-player-stop" title="stop">■</button>`;
            row.querySelector('.cp-player-stop').onclick = () => p.stop();
            container.appendChild(row);
        }
        const synthEl = row.querySelector('.cp-player-synth');
        if (synthEl) synthEl.textContent = p._synth ?? '';
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
                btn.textContent = `tap  ${bpm} BPM`;
            }
        } else {
            btn.textContent = 'tap…';
        }
        btn.classList.add('tapping');
    };
}

// ── Scale / Root selects ─────────────────────────────────────────────────────

function _initScaleRoot() {
    const scaleEl = document.getElementById('cp-scale-sel');
    const rootEl  = document.getElementById('cp-root-sel');

    if (scaleEl) {
        const scales = ['major','minor','dorian','phrygian','lydian','mixolydian',
                        'pentatonic','minPentatonic','chromatic','diminished','bhairav'];
        scales.forEach(s => {
            const o = document.createElement('option');
            o.value = o.textContent = s;
            if (s === 'minor') o.selected = true;
            scaleEl.appendChild(o);
        });
        scaleEl.onchange = () => { Scale.default = scaleEl.value; };
        // Reflect external changes (e.g. Scale.default = "major" in editor) back to select
        setInterval(() => {
            if (scaleEl.value !== Scale._name) scaleEl.value = Scale._name;
        }, 500);
    }

    if (rootEl) {
        const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        notes.forEach((n, i) => {
            const o = document.createElement('option');
            o.value = i; o.textContent = n;
            rootEl.appendChild(o);
        });
        rootEl.onchange = () => { Root.default = Number(rootEl.value); };
        setInterval(() => {
            if (rootEl.value !== String(Root.default ?? 0)) rootEl.value = Root.default ?? 0;
        }, 500);
    }
}

// ── Panel toggle ─────────────────────────────────────────────────────────────

function _initToggle() {
    const btn   = document.getElementById('panel-toggle-btn');
    const panel = document.getElementById('crash-panel');
    if (!btn || !panel) return;

    const stored = localStorage.getItem('cpHidden');
    if (stored === 'true') panel.classList.add('hidden');

    btn.onclick = () => {
        panel.classList.toggle('hidden');
        localStorage.setItem('cpHidden', panel.classList.contains('hidden'));
    };
}

// ── Theme selector ───────────────────────────────────────────────────────────

function _initTheme() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    const stored = localStorage.getItem('theme') ?? 'cyberpunk';
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
