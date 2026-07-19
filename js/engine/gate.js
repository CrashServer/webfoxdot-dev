// Shared mute + solo — ONE source of truth for the Players panel and the mixer, so
// their M / S buttons always agree. It owns each active player's transient gain
// (_amplify): a player sounds unless it's MUTED, or a SOLO is active and it isn't one
// of the soloed. (Volume is the separate persistent _mixLevel.) drop() and the eval
// .solo()/unsolo() route through here too, so a drop can't silently un-mute a track
// and an eval-time solo shows up in both UIs.

let _clock = null;
const _muted  = new Set();   // player names the user muted
const _soloed = new Set();   // player names the user soloed

export function initGate(clock) { _clock = clock; }

export function isMuted(n)  { return _muted.has(n); }
export function isSoloed(n) { return _soloed.has(n); }

export function toggleMute(n) { _muted.has(n) ? _muted.delete(n) : _muted.add(n); apply(); }
export function toggleSolo(n) { _soloed.has(n) ? _soloed.delete(n) : _soloed.add(n); apply(); }
export function soloOnly(n)   { _soloed.clear(); if (n) _soloed.add(n); apply(); }   // eval `.solo()`
export function clearSolo()   { _soloed.clear(); apply(); }
export function forget(n)     { _muted.delete(n); _soloed.delete(n); }               // on stop

// Recompute every active player's _amplify from mute + solo. Also serves as drop()'s
// "restore" so a breakdown returns to the CURRENT mute/solo state, not blanket unity.
export function apply() {
    if (!_clock) return;
    const solo = _soloed.size > 0;
    _clock._players.forEach((p, n) => {
        p._amplify = ((!_muted.has(n)) && (!solo || _soloed.has(n))) ? 1 : 0;
    });
}
