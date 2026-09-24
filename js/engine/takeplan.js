// takeplan.js — the rules of a live-sampling take, with no audio engine attached.
//
// Kept apart from livesample.js so they can be tested in node: that module imports
// SuperSonic, and every interesting case here is arithmetic — which bar a take starts
// on, how long it is, where it listens.

/**
 * Where does `src` mean to record from?
 *
 *   nothing, "master", "mix", "out"         the finished mix, after the limiter
 *   "in", "input", "mic", "line"            the live input — audioin()
 *   a player (p1, or "p1" if findPlayer knows it)   that player alone, post-FX
 *
 * @returns {{kind: 'master'|'in'|'player', player?: object}|{kind: null, why: string}}
 */
export function resolveSource(src, findPlayer = () => null) {
    if (src == null || src === '') return { kind: 'master' };
    if (typeof src === 'object' && typeof src.recBus === 'function') return { kind: 'player', player: src };
    const s = String(src).trim().toLowerCase();
    if (['master', 'mix', 'out', 'main'].includes(s)) return { kind: 'master' };
    if (['in', 'input', 'mic', 'line', 'live'].includes(s)) return { kind: 'in' };
    const p = findPlayer(String(src).trim());
    if (p && typeof p.recBus === 'function') return { kind: 'player', player: p };
    return { kind: null, why: `no source called "${src}" — use "master", "in", or a player like p1` };
}

/**
 * When a take starts and how long it is.
 *
 * A take starts on the next multiple of `quant` beats (the bar, by default) that is
 * at least `leadSec` away — the buffer has to be allocated and the recorder sent
 * ahead of time like any note, and a bar that is 40ms off cannot be made. `quant` 0
 * means as soon as that lead allows, off the grid.
 *
 * Its length is fixed in SECONDS at the tempo when it was asked for: that is the
 * buffer scsynth gets. loop("name", dur=N) stretches it back to N beats anyway, so
 * a tempo change later still loops cleanly.
 *
 * `latencySec` delays the recorder, not the grid: sound from the live input reaches
 * scsynth that long after it was played, so a note played on the downbeat is only
 * in the input that much later — starting the recorder later puts it at position 0.
 */
export function planTake({ nowBeat, bpm, beats = 4, quant = 4, sampleRate = 48000,
                           leadSec = 0.3, latencySec = 0 }) {
    const b = Number(beats);
    if (!(b > 0) || !isFinite(b)) return { ok: false, why: `a take needs a length in beats, got ${beats}` };
    const bp = Number(bpm) > 0 ? Number(bpm) : 120;
    const leadBeats = leadSec * bp / 60;
    const earliest = nowBeat + leadBeats;
    const q = Number(quant);
    let startBeat;
    if (!(q > 0)) startBeat = earliest;
    else {
        startBeat = Math.ceil(earliest / q) * q;
        if (startBeat < earliest - 1e-9) startBeat += q;
    }
    const seconds = b * 60 / bp;
    const frames = Math.max(1, Math.round(seconds * sampleRate));
    return { ok: true, startBeat, endBeat: startBeat + b, seconds, frames,
             latencySec: Math.max(0, Number(latencySec) || 0),
             bytes: frames * 2 * 4 };           // stereo float32 in the buffer pool
}
