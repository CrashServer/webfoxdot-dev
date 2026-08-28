// heldByUser() — "is someone touching this control right now?"
//
// The mixer, the players panel and the BPM field all refresh on a timer, and all of
// them have to avoid yanking a control out from under the person using it. They tested
// `document.activeElement !== el` for that, which is subtly wrong: an <input type=range>
// KEEPS focus after you let go of it. So the first time you touch a fader it stops
// refreshing — forever, until you happen to click something else. Locally that only
// looked like a slightly stale number after a ~reset; in a multiplayer room it reads as
// "the faders don't sync", because the one fader you're watching is the one you last
// touched, and it's frozen. The audio was following the room the whole time.
//
// Touching is not focus. It's the pointer being down on the control, or a keystroke a
// moment ago — so this tracks that instead, with a short grace window after release so
// a fader doesn't visibly jump on the trailing edge of your own drag.

const GRACE_MS = 1200;

let _down = null;                    // control currently under a held pointer
const _touched = new WeakMap();      // control → timestamp of the last real interaction

if (typeof window !== 'undefined') {
    // Capture phase: these must see the event even if the control stops propagation.
    window.addEventListener('pointerdown', (e) => { _down = e.target; }, true);
    const release = () => { if (_down) { _touched.set(_down, performance.now()); _down = null; } };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    // Arrow keys on a focused fader, typing in the BPM field.
    window.addEventListener('keydown', (e) => { if (e.target) _touched.set(e.target, performance.now()); }, true);
}

export function heldByUser(el) {
    if (!el) return false;
    if (_down === el) return true;                       // pointer is down on it
    if (typeof document === 'undefined' || document.activeElement !== el) return false;
    const t = _touched.get(el);                          // focused AND just used
    return t != null && (performance.now() - t) < GRACE_MS;
}
