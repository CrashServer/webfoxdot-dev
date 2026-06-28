// Browser Ableton Link client — connects to the Link bridge (server/link-bridge.js)
// over WebSocket and disciplines the local clock to Ableton's tempo + bar phase.
// Follow-only: Ableton (or any Link peer) is the master. See Clock.syncTo.

let _clock   = null;
let _ws      = null;
let _enabled = false;
let _onState = null;
let _retry   = null;
const _state = { connected: false, peers: 0, bpm: null, playing: false, phase: 0, error: null };

export function initLink(clock) { _clock = clock; }
export function onLinkState(fn) { _onState = fn; }
export function linkState() { return { ..._state, enabled: _enabled }; }
function _emit() { if (_onState) _onState(linkState()); }

// Resolve the bridge WebSocket URL from config.json (same convention as collab).
async function _url() {
    let port = 4445;
    try { port = (await (await fetch('./config.json')).json()).link?.port ?? port; } catch { /* default */ }
    return `ws://${window.location.hostname}:${port}`;
}

export async function enableLink() {
    if (_enabled) return;
    _enabled = true;
    _state.error = null;
    _emit();
    _connect(await _url());
}

export function disableLink() {
    _enabled = false;
    if (_retry) { clearTimeout(_retry); _retry = null; }
    if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
    _state.connected = false;
    _emit();
}

function _connect(url) {
    if (!_enabled) return;
    try { _ws = new WebSocket(url); }
    catch (e) { _state.error = e.message; _emit(); _scheduleRetry(url); return; }

    _ws.onopen = () => { _state.connected = true; _state.error = null; _emit(); };
    _ws.onerror = () => { _state.error = 'bridge not reachable — is server/link-bridge.js running?'; };
    _ws.onclose = () => {
        _state.connected = false;
        _ws = null;
        _emit();
        _scheduleRetry(url);          // bridge may start later / restart
    };
    _ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type !== 'link') return;
        _state.bpm = m.bpm; _state.peers = m.peers; _state.playing = m.playing; _state.phase = m.phase;
        if (_enabled && _clock) _clock.syncTo(m);
        _emit();
    };
}

function _scheduleRetry(url) {
    if (!_enabled || _retry) return;
    _retry = setTimeout(() => { _retry = null; _connect(url); }, 2000);
}
