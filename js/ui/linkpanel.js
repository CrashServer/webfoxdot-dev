// Link panel — connect to the Ableton Link bridge and show sync status.
// Follow-only: tempo + bar phase come from Ableton (or any Link peer).

import { enableLink, disableLink, linkState, onLinkState } from '../sync/link.js';

let _wired = false;

export function initLinkPanel() {
    const btn = document.getElementById('cp-link-toggle');
    if (btn) btn.onclick = () => {
        if (linkState().enabled) disableLink(); else enableLink();
        _render();
    };
    onLinkState(_render);
    _wired = true;
    _render();
}

function _render() {
    if (!_wired) return;
    const s = linkState();

    const btn = document.getElementById('cp-link-toggle');
    if (btn) btn.textContent = s.enabled ? 'disconnect' : 'connect';

    const statusEl = document.getElementById('cp-link-status');
    if (!statusEl) return;
    if (!s.enabled) {
        statusEl.innerHTML = '<span class="link-off">off</span>';
        return;
    }
    if (!s.connected) {
        statusEl.innerHTML = `<span class="link-wait">connecting…</span>` +
            (s.error ? `<div class="midi-hint">${s.error}</div>` : '');
        return;
    }
    const transport = s.playing ? '<span class="link-ok">▶ playing</span>' : '<span class="link-off">■ stopped</span>';
    statusEl.innerHTML =
        `<div class="link-row"><span class="link-ok">●</span> ${s.peers} peer${s.peers === 1 ? '' : 's'}` +
        ` &nbsp; <b>${s.bpm != null ? s.bpm.toFixed(1) : '—'}</b> bpm</div>` +
        `<div class="link-row">${transport}` +
        (s.peers === 0 ? ' &nbsp;<span class="midi-hint">no Link peers — enable Link in Ableton</span>' : '') +
        `</div>`;
}
