// trooppanel.js — the troop's session, on your canvas.
//
// What webTroop is playing, while you play alongside it: their shared buffer, the
// telemetry from their SuperCollider, and — in pretext mode — who is typing what,
// live, as they type it.
//
// It is a WINDOW, not a workspace. You cannot edit their code from here and the
// bridge underneath cannot write to it either (js/net/webtroop.js). Nothing you do
// in this panel can reach a concert in progress, which is the property that makes it
// safe to open during one.

import { watchTroop } from '../net/webtroop.js';
import { draggable } from './dragpanel.js';
import { postCode, postInstant } from '../visuals/bridge.js';
import { noteTroop } from '../visuals/vlang.js';

let _modal = null, _open = false, _watch = null, _log = null, _clock = null;
// Follow their clock. Off by default: joining a room should not re-time your set
// without being asked.
let _sync = false, _quantum = 4, _lastBeat = null, _lastErr = null, _mode = 'beat';
let _codeEl = null, _statsEl = null, _peersEl = null, _dotEl = null, _hostEl = null;
let _toVisuals = true;

export function initTroopPanel({ log, clock } = {}) { _log = log || (() => {}); _clock = clock || null; }

/**
 * Follow webTroop's clock — tempo and bar phase, follow-only.
 *
 * Their FoxDot publishes a FRACTIONAL beat on the telemetry socket, which is the
 * one number this needs; the rest is the mechanism crashDot already has for Ableton
 * Link. syncTo() matches tempo, then corrects the bar phase: a large error snaps so
 * a fresh join catches up at once, a small one is nudged 8% per update so the
 * correction is inaudible rather than lurching the notes.
 *
 * Follow-only in both directions of the word: it never sends anything to them, and
 * it moves OUR clock rather than asking theirs to move. webTroop is the master
 * because webTroop is the thing the room is dancing to.
 *
 * Two modes, because there are two questions. By default it locks the BEAT NUMBER:
 * their beat 2742 is your beat 2742, so bars and counts agree and anything reckoned
 * in bars lines up across the room. troopclock(1, 4) instead aligns only the phase
 * within a 4-beat bar, which keeps your own numbering — useful if you are counting
 * your set from your own bar one and only want the pulse to match.
 *
 * @param {boolean} on
 * @param {number} [quantum]  give a bar size to align PHASE only; omit to lock the beat
 */
export function troopClock(on, quantum) {
    _sync = !!on;
    if (Number(quantum) > 0) { _quantum = Math.round(Number(quantum)); _mode = 'phase'; }
    else if (quantum != null) _mode = 'beat';
    _lastBeat = null;
    const box = _modal && _modal.querySelector('.troop-clk');
    if (box) box.checked = _sync;
    _lastErr = null;
    if (!_sync) { _log('⇄ clock: free — your own tempo again', 'info'); return false; }
    if (!_watch) { _log('⇄ clock: not watching a troop yet — troop("192.168.1.38") first', 'warn'); _sync = false; return false; }
    _log(_mode === 'beat'
        ? '⇄ clock: following webTroop — their beat number is now yours, so bars agree'
        : `⇄ clock: following webTroop, phase aligned every ${_quantum} beats`, 'ok');
    return true;
}
export function troopClockOn() { return _sync; }
/** 'beat' (the number itself) or 'phase' (only the position in the bar). */
export function troopClockMode() { return _mode; }
/** How far our bar phase sits from theirs, in beats, or null if not following yet. */
export function troopClockError() { return _lastErr; }

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function build() {
    _modal = document.createElement('div');
    _modal.id = 'troop-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="troop-head">
            <span class="troop-title">⇄ troop</span>
            <span class="troop-dot" title="code · telemetry · logs">···</span>
            <span class="troop-host"></span>
            <label class="troop-vis" title="send their typing to the visual code layers (livecode, codefull, codeconspiracy) — so a rehearsal can BE the picture">
                <input type="checkbox" checked> → visuals</label>
            <label class="troop-vis" title="follow their beat: match tempo and bar phase from the telemetry feed, follow-only — nothing is sent back">
                <input type="checkbox" class="troop-clk"> ⇄ clock</label>
            <button class="troop-close" title="stop watching">✕</button>
        </div>
        <div class="troop-stats"></div>
        <div class="troop-body">
            <pre class="troop-code"></pre>
            <div class="troop-peers"></div>
        </div>`;
    document.body.appendChild(_modal);
    _codeEl  = _modal.querySelector('.troop-code');
    _statsEl = _modal.querySelector('.troop-stats');
    _peersEl = _modal.querySelector('.troop-peers');
    _dotEl   = _modal.querySelector('.troop-dot');
    _hostEl  = _modal.querySelector('.troop-host');
    _modal.querySelector('.troop-close').onclick = () => stopTroop();
    _modal.querySelector('.troop-vis input').onchange = (e) => { _toVisuals = e.target.checked; };
    _modal.querySelector('.troop-clk').onchange = (e) => { e.target.checked = troopClock(e.target.checked); };
    draggable(_modal.querySelector('.troop-head'), _modal, 'button, input, label');
}

// Their telemetry, in their own words. bpm and cpu first because those are the two
// you glance at; the rest reads left to right in the order it stops changing.
const ORDER = ['bpm', 'cpu', 'beat', 'scale', 'root', 'players', 'serverState', 'chrono'];
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Their telemetry arrives in the shapes their code happens to hold, not the shapes
// a readout wants: beat is a full-precision float, root is the STRING "0", and
// serverState is a boolean that JSON flattened to 0. Printed raw that is a panel of
// "2304.5135531425476" and "0", which is data rather than information. Formatting
// here and not in the bridge, because the bridge's job is to report what they said.
function fmtStat(k, v) {
    if (Array.isArray(v)) {
        if (!v.length) return '—';
        // A player list comes over as an array of JSON STRINGS, each one an object.
        return v.map((p) => {
            if (p && typeof p === 'object') return p.name || p.id || '?';
            const t = String(p);
            if (!/^\s*[[{]/.test(t)) return t;
            try { const o = JSON.parse(t); return (o && (o.name || o.id)) || t; } catch (_) { return t; }
        }).join(' ');
    }
    if (v && typeof v === 'object') {
        const n = Object.keys(v).length;
        return n ? Object.keys(v).join(' ') : '—';
    }
    switch (k) {
        case 'beat':   return isFinite(Number(v)) ? String(Math.floor(Number(v))) : String(v);
        // A bare "0" reads as nothing at all until you know it is a semitone.
        case 'root':   { const n = Number(v); return isFinite(n) ? NOTE[((n % 12) + 12) % 12] : String(v); }
        case 'cpu':    return isFinite(Number(v)) ? Number(v).toFixed(0) + '%' : String(v);
        case 'chrono': { const t = Number(v); if (!isFinite(t)) return String(v);
                         const m = Math.floor(t / 60); return m + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
        // Their FoxDot server, up or down — the thing you actually want to know
        // when their bpm is ticking along and nothing is making any sound.
        case 'serverState': return (v === true || v === 1 || v === '1' || v === 'true') ? 'up' : 'down';
        default: return String(v);
    }
}

function paintStats(stats) {
    const cell = (k) => {
        const raw = stats[k];
        if (raw === undefined) return '';
        const v = fmtStat(k, raw);
        const warm = (k === 'cpu' && Number(raw) > 70) || (k === 'serverState' && v === 'down') ? ' hot' : '';
        return `<span class="troop-stat${warm}"><b>${esc(k)}</b>${esc(v)}</span>`;
    };
    _statsEl.innerHTML = ORDER.map(cell).join('') ||
        '<span class="troop-stat">waiting for the rig…</span>';
}

function paintCode(text, peers) {
    // Their cursors, drawn on their code: the line each person is on, in their colour.
    // Which line somebody is editing is most of what you want to know at a glance —
    // more than the text itself, which you can read at leisure.
    const onLine = new Map();
    for (const p of peers) if (p.line) onLine.set(p.line, p);
    const lines = text.split('\n');
    const start = Math.max(0, lines.length - 400);      // a long session is a long buffer
    _codeEl.innerHTML = lines.slice(start).map((l, i) => {
        const n = start + i + 1;
        const who = onLine.get(n);
        const mark = who ? ` style="border-left-color:${esc(who.color || '#8cf')}"` : '';
        return `<span class="troop-line${who ? ' here' : ''}"${mark}>` +
               `<i>${n}</i>${esc(l) || '&nbsp;'}` +
               (who ? `<em>${esc(who.name)}</em>` : '') + `</span>`;
    }).join('');
    _codeEl.scrollTop = _codeEl.scrollHeight;
}

function paintPeers(peers) {
    if (!peers.length) { _peersEl.innerHTML = '<div class="troop-none">nobody else in the room</div>'; return; }
    _peersEl.innerHTML = peers.map(p => `
        <div class="troop-peer">
            <span class="troop-peer-name" style="color:${esc(p.color || '#8cf')}">${esc(p.name)}</span>
            <span class="troop-peer-line">${p.line ? 'line ' + p.line : ''}</span>
            <code>${esc((p.code || '').slice(0, 90))}</code>
        </div>`).join('');
}

function paintStatus(s) {
    const d = (on) => on ? '●' : '○';
    _dotEl.textContent = `${d(s.code)}${d(s.telemetry)}${d(s.logs)}`;
    _dotEl.className = 'troop-dot' + (s.code ? ' up' : '');
}

/**
 * Start watching.
 * @param {string} host  an IP or a name — whatever webTroop's HOST_IP is
 * @param {number} [yPort=4444]  its sync port. A parameter because crashDot's own
 *        collab server wants 4444 too, so on a shared machine one of them has moved.
 */
export async function startTroop(host, yPort) {
    if (!_modal) build();
    if (_watch) _watch.close();
    _hostEl.textContent = host + (yPort && yPort !== 4444 ? ':' + yPort : '');
    _modal.classList.remove('hidden');
    _open = true;
    let peers = [], code = '';
    _watch = await watchTroop({ host, ...(yPort ? { yPort } : {}) }, {
        onCode: (t) => {
            code = t;
            paintCode(code, peers);
            // postCode/postInstant only cross the BroadcastChannel to a SEPARATE
            // visuals window. When the canvas is in this window — which is the normal
            // way to run it — the code layers read vlang's own feed, so without this
            // line codefull and its siblings showed your code and never theirs.
            if (_toVisuals) { try { noteTroop(code.split('\n').slice(-60).join('\n')); } catch (_) {} }
        },
        onPeers: (ps) => { peers = ps; paintPeers(ps); paintCode(code, peers); },
        onStat: (k, v) => {
            paintStats(_watch ? _watch.state().stats : {});
            if (!_sync || !_clock) return;
            const st = _watch ? _watch.state().stats : {};
            // Both numbers, or neither: a tempo without a phase drifts and a phase
            // without a tempo fights.
            const bpm = Number(st.bpm), beat = Number(st.beat);
            if (!isFinite(bpm) || bpm <= 0 || !isFinite(beat)) return;
            if (beat === _lastBeat) return;            // the same reading twice is not news
            _lastBeat = beat;
            try {
                if (_mode === 'beat') {
                    // lockTo reports the error it found, so there is nothing to
                    // recompute and no chance of the readout and the correction
                    // disagreeing about what "off" means.
                    _lastErr = _clock.lockTo({ bpm, beat });
                } else {
                    const phase = ((beat % _quantum) + _quantum) % _quantum;
                    const ours = ((_clock.beat % _quantum) + _quantum) % _quantum;
                    let err = phase - ours;
                    err -= _quantum * Math.round(err / _quantum);
                    _lastErr = err;
                    _clock.syncTo({ bpm, phase, quantum: _quantum });
                }
            } catch (_) {}
        },
        onStatus: paintStatus,
        onEmpty: (e) => {
            // Connected and nothing there. Name the likeliest cause rather than
            // leaving an empty panel to be interpreted.
            _log(`⇄ connected to ${e.host}:${e.port} but the room "${e.room}" is empty` +
                 (e.telemetry ? ' — is the troop just not typing yet?'
                              : ` — and their telemetry is down too. Is ${e.port} webTroop's sync server,` +
                                ` or crashDot's own collab server on the same port? troop("host", 4445) picks another.`),
                 'warn');
        },
        onPretext: (x) => {
            // Straight into the visual code layers. postInstant is throttled and is
            // exactly this shape already — the line, who wrote it, where they are —
            // so a troop rehearsal becomes the picture with nothing in between.
            if (!_toVisuals) return;
            try { postInstant(x.code || '', x.line || 0, x.user || 'troop', ''); } catch (_) {}
            // And the same window of lines into the in-window feed, under the name of
            // whoever is typing it, so the layers that colour per performer can.
            try { noteTroop(x.windowLines || x.code || '', x.user || 'troop'); } catch (_) {}
        },
    });
    paintStats({});
    paintPeers([]);
    _log(`⇄ watching webTroop at ${host} — read only`, 'ok');
    return true;
}

export function stopTroop() {
    if (_watch) { _watch.close(); _watch = null; }
    // Stop following a clock that is no longer arriving, or the last reading stands
    // as a tempo you never chose.
    if (_sync) {
        _sync = false;
        const box = _modal && _modal.querySelector('.troop-clk');
        if (box) box.checked = false;
        _log('⇄ clock: free again — the troop feed closed', 'info');
    }
    _open = false;
    if (_modal) _modal.classList.add('hidden');
    _log('⇄ stopped watching webTroop', 'info');
}

export function troopState() { return _watch ? _watch.state() : null; }
export function isTroopOpen() { return _open; }
/** Push their whole buffer into the visual code layers, once. */
export function troopToVisuals() {
    const st = troopState();
    if (st && st.code) { postCode(st.code.split('\n').slice(-40).join('\n'), 'troop', ''); return true; }
    return false;
}
