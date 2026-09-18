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

let _modal = null, _open = false, _watch = null, _log = null;
let _codeEl = null, _statsEl = null, _peersEl = null, _dotEl = null, _hostEl = null;
let _toVisuals = true;

export function initTroopPanel({ log } = {}) { _log = log || (() => {}); }

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
    draggable(_modal.querySelector('.troop-head'), _modal, 'button, input, label');
}

// Their telemetry, in their own words. bpm and cpu first because those are the two
// you glance at; the rest reads left to right in the order it stops changing.
const ORDER = ['bpm', 'cpu', 'beat', 'scale', 'root', 'players', 'serverState'];
function paintStats(stats) {
    const cell = (k) => {
        let v = stats[k];
        if (v === undefined) return '';
        if (Array.isArray(v)) v = v.length ? v.join(' ') : '—';
        const warm = k === 'cpu' && Number(v) > 70 ? ' hot' : '';
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

/** Start watching. Host is an IP or a name — whatever webTroop's HOST_IP is. */
export async function startTroop(host) {
    if (!_modal) build();
    if (_watch) _watch.close();
    _hostEl.textContent = host;
    _modal.classList.remove('hidden');
    _open = true;
    let peers = [], code = '';
    _watch = await watchTroop({ host }, {
        onCode: (t) => { code = t; paintCode(code, peers); },
        onPeers: (ps) => { peers = ps; paintPeers(ps); paintCode(code, peers); },
        onStat: () => paintStats(_watch ? _watch.state().stats : {}),
        onStatus: paintStatus,
        onPretext: (x) => {
            // Straight into the visual code layers. postInstant is throttled and is
            // exactly this shape already — the line, who wrote it, where they are —
            // so a troop rehearsal becomes the picture with nothing in between.
            if (!_toVisuals) return;
            try { postInstant(x.code || '', x.line || 0, x.user || 'troop', ''); } catch (_) {}
        },
    });
    paintStats({});
    paintPeers([]);
    _log(`⇄ watching webTroop at ${host} — read only`, 'ok');
    return true;
}

export function stopTroop() {
    if (_watch) { _watch.close(); _watch = null; }
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
