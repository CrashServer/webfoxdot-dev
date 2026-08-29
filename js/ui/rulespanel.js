// Room rules panel — the visual face of js/collab/permissions.js.
//
// A grid of who-can-do-what, because a capability matrix is a table and reading one as
// console output is miserable when you are standing in front of a class. Same floating,
// draggable, non-modal shape as the mixer: you keep coding with it open.
//
// Everything here is a VIEW. It reads the permission model and calls its setters; every
// refusal (a non-host clicking a cell) is decided there, not here — so the panel cannot
// grant anything the model would not. Non-hosts get the same table, read-only, which is
// the point: everyone should be able to see the rules they are playing under.

import * as perms from '../collab/permissions.js';

let _modal = null, _open = false;
let _ctx = { peers: () => [], nameOf: () => '', inRoom: () => false };

/** ctx: { peers(), nameOf(userId), inRoom() } — supplied by index.html. */
export function initRulesPanel(ctx) { _ctx = { ..._ctx, ...ctx }; }

export function isRulesOpen() { return _open; }
export function openRules()  { if (!_modal) build(); _open = true; _modal.classList.remove('hidden'); render(); }
export function closeRules() { _open = false; if (_modal) _modal.classList.add('hidden'); }
export function toggleRules() { _open ? closeRules() : openRules(); }

function build() {
    _modal = document.createElement('div');
    _modal.id = 'rules-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="rules-head">
            <span class="rules-title">⚖ room rules</span>
            <div class="rules-drag"></div>
            <button class="rules-close" title="close">×</button>
        </div>
        <div class="rules-body"></div>`;
    document.body.appendChild(_modal);
    _modal.querySelector('.rules-close').onclick = () => closeRules();
    initDrag(_modal.querySelector('.rules-head'));
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function renderRulesPanel() { if (_open) render(); }

function render() {
    const body = _modal && _modal.querySelector('.rules-body');
    if (!body) return;
    if (!_ctx.inRoom()) {
        body.innerHTML = `<div class="rules-empty">Room rules apply to a multiplayer session.<br>
            Start one with <b>👥 go live</b>, or open a <code>?session=</code> link.</div>`;
        return;
    }

    const on     = perms.isEnabled();
    const host   = perms.isHost();
    const peers  = _ctx.peers();
    const claims = perms.claims();

    // The master switch. Everything below is inert while it is off, and the panel says
    // so rather than showing a table that looks like it is doing something.
    const master = `
        <div class="rules-master${on ? ' on' : ''}">
            <button class="rules-toggle" ${host ? '' : 'disabled'}
                    title="${host ? 'turn enforcement on or off for this room' : 'only the host can change this'}">
                ${on ? '● rules ON' : '○ rules off'}
            </button>
            <span class="rules-master-note">${on
                ? 'roles and track ownership are being enforced'
                : 'everyone can do everything — a normal jam'}</span>
        </div>`;

    // The matrix. Rows are roles, columns capabilities; the host clicks any cell.
    const cols = perms.CAPS.map(([k, label, desc]) =>
        `<th title="${esc(desc)}">${esc(label)}</th>`).join('');
    const rows = perms.ROLES.map(role => {
        const cells = perms.CAPS.map(([cap]) => {
            const yes = perms.roleCan(role, cap);
            const fixed = role === 'host';   // the host row is not editable — someone has to be able to fix a mistake
            return `<td><button class="rules-cell${yes ? ' yes' : ''}"
                        data-role="${role}" data-cap="${cap}"
                        ${host && !fixed ? '' : 'disabled'}
                        title="${esc(role)} · ${esc(cap)}">${yes ? '✓' : '·'}</button></td>`;
        }).join('');
        const n = peers.filter(p => perms.roleOf(p.id) === role).length;
        return `<tr><th class="rules-role">${role}<span class="rules-count">${n || ''}</span></th>${cells}</tr>`;
    }).join('');

    // Who is who. The host can reassign anyone but themselves.
    const people = peers.map(p => {
        const r = perms.roleOf(p.id);
        const isHostRow = perms.isHost(p.id);
        const sel = perms.ROLES.filter(x => x !== 'host' || isHostRow)
            .map(x => `<option value="${x}"${x === r ? ' selected' : ''}>${x}</option>`).join('');
        return `<div class="rules-person">
            <span class="rules-dot" style="background:${esc(p.color || '#888')}"></span>
            <span class="rules-name">${esc(p.name || 'anon')}${p.isSelf ? ' (you)' : ''}${isHostRow ? ' ★' : ''}</span>
            <select class="rules-rolesel" data-uid="${esc(p.id)}"
                    ${host && !isHostRow ? '' : 'disabled'}>${sel}</select>
        </div>`;
    }).join('') || '<div class="rules-empty-row">nobody else here yet</div>';

    // Track ownership. Release is offered for your own tracks, and for any of them if
    // you are the host — the model decides, this only hides buttons that would refuse.
    // Say plainly when ownership is not in force. "no tracks claimed" while rules are
    // off reads as "the feature is broken" rather than "the feature is switched off".
    const tracks = Object.keys(claims).sort();
    const owned = !on
        ? '<div class="rules-empty-row">track ownership applies only while rules are on'
          + (tracks.length ? ` — ${tracks.length} claim${tracks.length > 1 ? 's' : ''} remembered from earlier` : '')
          + '</div>'
        : tracks.map(t => {
            // canPlay() on a CLAIMED track is true only for its owner or the host —
            // exactly the people releaseTrack() will accept, so it doubles as the test
            // for whether to offer the button.
            const canRelease = perms.canPlay(t);
            return `<div class="rules-track">
                <span class="rules-tname">${esc(t)}</span>
                <span class="rules-towner">${esc(_ctx.nameOf(claims[t]))}</span>
                <button class="rules-release" data-track="${esc(t)}" ${canRelease ? '' : 'disabled'}
                        title="hand this track back">release</button>
            </div>`;
          }).join('') || '<div class="rules-empty-row">no tracks claimed yet — play one and it is yours</div>';

    body.innerHTML = `
        ${master}
        <table class="rules-grid"><thead><tr><th></th>${cols}</tr></thead><tbody>${rows}</tbody></table>
        ${host ? '' : '<div class="rules-note">read-only — ' + esc(_ctx.nameOf(perms.hostId()) || 'the host') + ' runs this room</div>'}
        <div class="rules-sub">people</div>${people}
        <div class="rules-sub">tracks</div>${owned}`;

    body.querySelector('.rules-toggle').onclick = () => { perms.setEnabled(!perms.isEnabled()); render(); };
    body.querySelectorAll('.rules-cell').forEach(b => {
        b.onclick = () => { perms.setRoleCap(b.dataset.role, b.dataset.cap, !b.classList.contains('yes')); render(); };
    });
    body.querySelectorAll('.rules-rolesel').forEach(s => {
        s.onchange = () => { perms.setRole(s.dataset.uid, s.value); render(); };
    });
    body.querySelectorAll('.rules-release').forEach(b => {
        b.onclick = () => { perms.releaseTrack(b.dataset.track); render(); };
    });
}

// Drag by the header — same as the mixer, so it can be moved off your code.
function initDrag(handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
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
