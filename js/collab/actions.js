// Performance-action bus — the one hop between "a control changed" and "tell the room".
//
// Mute, solo, volume and stop aren't code, so they don't ride the eval broadcast the
// way a `p1 >> …` line does: without this, a peer would watch you pull a fader down
// and still hear the track at full level. UI modules call share() at the point the
// change ACTUALLY happens (gate.js's toggles, mixer.js's setLevel/stopPlayer), not in
// their click handlers — so every entry path syncs identically: a mixer click, a bound
// MIDI control, a perform-mode tile drag, the crash panel's M/S, Alt+X.
//
// index.html owns the wire: it installs the sender once a ?session= room is joined and
// wraps its replay of a peer's action in applying(), which suppresses the echo back out.
// Outside a room the sender is null and share() is a no-op.

let _send = null;
let _applying = false;

/** index.html installs its broadcastAction here. */
export function setActionSender(fn) { _send = fn; }

/** Tell the room about a local performance action (no-op solo / while replaying). */
export function share(action, data = {}) { if (_send && !_applying) _send(action, data); }

/** Run fn as a replay of a peer's action — anything it triggers won't echo back. */
export function applying(fn) {
    _applying = true;
    try { return fn(); } finally { _applying = false; }
}

/** True while replaying a peer's action. */
export function isApplying() { return _applying; }

// Continuous controls (a fader drag, a perform-mode swipe) fire ~60×/s. Coalesce to
// ~20Hz per key, always with a trailing send so the value everyone lands on is the
// one you released on, not whatever the last tick happened to catch.
const _pending = new Map();
export function shareThrottled(action, key, data, ms = 50) {
    // Bail BEFORE queueing: a trailing send fires after applying() has already
    // returned, so a queued replay of a peer's fader would echo straight back at them.
    if (!_send || _applying) return;
    const k = action + ':' + key;
    const e = _pending.get(k);
    if (e) { e.data = data; return; }                       // a flush is already queued
    share(action, data);
    _pending.set(k, { data: null, t: setTimeout(() => {
        const p = _pending.get(k); _pending.delete(k);
        if (p && p.data) share(action, p.data);             // trailing edge
    }, ms) });
}
