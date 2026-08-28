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
let _setState = null;
let _applying = false;

/** index.html installs its broadcastAction here. */
export function setActionSender(fn) { _send = fn; }

/** index.html installs the room's shared-state writer here (a Yjs map setter). */
export function setStateWriter(fn) { _setState = fn; }

/** Tell the room about a local performance action (no-op solo / while replaying). */
export function share(action, data = {}) { if (_send && !_applying) _send(action, data); }

/** Run fn as a replay of a peer's action — anything it triggers won't echo back. */
export function applying(fn) {
    _applying = true;
    try { return fn(); } finally { _applying = false; }
}

/** True while replaying a peer's action. */
export function isApplying() { return _applying; }

// ── Sticky state vs. momentary actions ────────────────────────────────────────
//
// share() above is fire-and-forget: the server relays it live and stores nothing, so
// it's right for things that HAPPEN (a stop, a held FX) and wrong for things that ARE
// (the mix, the tempo, the key). State sent that way leaves a late joiner with the
// text of the set but everyone's default mix — they never saw the messages.
//
// shareState() writes into a Yjs map on the shared doc instead. Yjs gives us live
// propagation AND the join snapshot from one mechanism: a peer arriving mid-set gets
// every key replayed at sync, in whatever order, which is safe because these are all
// ABSOLUTE values applied idempotently. Keys are flat strings ('bpm', 'level:d1') so
// per-track state stays independently mergeable — two people riding different faders
// never collide.
export function shareState(key, value) { if (_setState && !_applying) _setState(key, value); }

// Continuous controls (a fader drag, a perform-mode swipe) fire ~60×/s. Coalesce to
// ~20Hz per key, always with a trailing send so the value everyone lands on is the
// one you released on, not whatever the last tick happened to catch.
const _pending = new Map();

function throttle(k, send, value, ms) {
    // Bail BEFORE queueing: a trailing send fires after applying() has already
    // returned, so a queued replay of a peer's fader would echo straight back at them.
    if (_applying) return;
    const e = _pending.get(k);
    if (e) { e.value = value; return; }                     // a flush is already queued
    send(value);
    _pending.set(k, { value: null, t: setTimeout(() => {
        const p = _pending.get(k); _pending.delete(k);
        if (p && p.value !== null) send(p.value);           // trailing edge
    }, ms) });
}

export function shareThrottled(action, key, data, ms = 50) {
    if (!_send) return;
    throttle('a:' + action + ':' + key, (d) => share(action, d), data, ms);
}

export function shareStateThrottled(key, value, ms = 50) {
    if (!_setState) return;
    throttle('s:' + key, (v) => shareState(key, v), value, ms);
}
