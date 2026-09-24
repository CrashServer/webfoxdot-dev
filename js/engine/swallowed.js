// swallowed.js — for the try/catch that protects a caller from someone else's code.
//
// A listener that throws must not take down the clock tick or the render frame that
// called it, so those calls are wrapped. But `catch (_) {}` also hides the throw
// forever: the live "playing" highlight threw a ReferenceError on every step for as
// long as it existed, inside emitStep's catch, and nothing anywhere said so.
//
// This keeps the protection and ends the silence. Each distinct error is reported
// ONCE (a listener failing every step would otherwise flood the console at 60Hz),
// as a console warning — which the browser test suite already fails on.

const _seen = new Set();
const _log = [];

/** Report an error a caller chose to survive. Returns nothing; never throws. */
export function swallowed(where, err) {
    try {
        const msg = (err && err.message) || String(err);
        const key = where + '|' + msg;
        if (_seen.has(key)) return;
        _seen.add(key);
        _log.push({ where, message: msg });
        if (_log.length > 50) _log.shift();
        console.warn(`crashDot: ${where} threw (shown once, then ignored) —`, err);
    } catch (_) { /* reporting must not become the next failure */ }
}

/** What has been swallowed so far, for tests and a readout. */
export function swallowedErrors() { return _log.slice(); }
