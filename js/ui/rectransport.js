// rectransport.js — one transport for the four recorders.
//
// crashDot can record four different things, and until now each was its own button
// with its own start, its own stop and its own filename:
//
//   code    the evals you ran, rebuilt as a #@ composition
//   audio   the sounding output, through getDisplayMedia
//   midi    every note that played, as a .mid
//   video   the rendered picture, as a .webm
//
// Four separate gestures for one performance. You cannot start them together, so the
// files never line up, and they land with four unrelated names, so a week later
// nothing says they were the same take.
//
// This does not reimplement any of them — each still owns its own machinery. It just
// drives them together and hands them a SHARED take name, so the four files that come
// out of one performance say so.

const _recorders = new Map();   // name → { available, isOn, start, stop }

/**
 * @param {string} name   'code' | 'audio' | 'midi' | 'video'
 * @param {object} api    { available(), isOn(), start(take), stop() }
 *                        start() may be async (audio has to ask for a tab).
 */
export function registerRecorder(name, api) { _recorders.set(name, api); }

export function recorderNames() { return [...(_recorders.keys())]; }

/** Which are running right now. */
export function running() {
    return [...(_recorders.entries())].filter(([, a]) => { try { return a.isOn(); } catch (_) { return false; } })
                                      .map(([n]) => n);
}

/** A name for this take: crashdot-20260918-2043. The four files share it. */
export function takeName(prefix = 'crashdot') {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

let _take = null;
export function currentTake() { return _take; }

/**
 * Start the named recorders (default: every one that says it is available), or stop
 * everything that is running. Returns { started, stopped, unavailable, take }.
 *
 * Deliberately a toggle over the WHOLE set rather than per recorder: the point is one
 * gesture for one performance. Anything already running is left alone rather than
 * restarted, so record() after arming one by hand adopts it into the take.
 */
export async function record(which = null) {
    const want = which && which.length ? which.map(String) : recorderNames();
    const live = running();

    if (live.length) {                       // second press → stop the take
        const stopped = [];
        for (const n of live) { try { await _recorders.get(n).stop(); stopped.push(n); } catch (_) {} }
        _take = null;
        return { started: [], stopped, unavailable: [], take: null };
    }

    _take = takeName();
    const started = [], unavailable = [];
    for (const n of want) {
        const a = _recorders.get(n);
        if (!a) { unavailable.push(n); continue; }
        let ok = true;
        try { ok = a.available ? await a.available() : true; } catch (_) { ok = false; }
        if (!ok) { unavailable.push(n); continue; }
        // One failing recorder must not take the others down with it — audio needs a
        // tab-share dialog that can simply be dismissed, and that is not a reason for
        // the take to have no video in it.
        try { await a.start(_take); started.push(n); } catch (_) { unavailable.push(n); }
    }
    if (!started.length) _take = null;
    return { started, stopped: [], unavailable, take: _take };
}
