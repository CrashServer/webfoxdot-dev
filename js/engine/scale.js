// Scale and root — mirrors FoxDot's Scale/Root system

export const SCALE_MAP = {
    major:        [0, 2, 4, 5, 7, 9, 11],
    minor:        [0, 2, 3, 5, 7, 8, 10],
    dorian:       [0, 2, 3, 5, 7, 9, 10],
    phrygian:     [0, 1, 3, 5, 7, 8, 10],
    lydian:       [0, 2, 4, 6, 7, 9, 11],
    mixolydian:   [0, 2, 4, 5, 7, 9, 10],
    locrian:      [0, 1, 3, 5, 6, 8, 10],
    pentatonic:   [0, 2, 4, 7, 9],
    minPentatonic:[0, 3, 5, 7, 10],
    chromatic:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    diminished:   [0, 2, 3, 5, 6, 8, 9, 11],
    bhairav:      [0, 1, 4, 5, 7, 8, 11],
};

export const Scale = {
    _name: 'minor',
    get default() { return SCALE_MAP[this._name] ?? SCALE_MAP.minor; },
    set default(v) {
        if (typeof v === 'string')   { this._name = v; }
        else if (Array.isArray(v))   { SCALE_MAP.__custom = v; this._name = '__custom'; }
    },
    get names() { return Object.keys(SCALE_MAP); },
};

// Note name → semitone (C=0 … B=11), with optional #/b accidental.
const NOTE_SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export function noteToSemitone(v) {
    const m = String(v).trim().toLowerCase().match(/^([a-g])(#|s|b|♯|♭)?$/);
    if (!m) return null;
    const acc = (m[2] === '#' || m[2] === 's' || m[2] === '♯') ? 1
              : (m[2] === 'b' || m[2] === '♭') ? -1 : 0;
    return ((NOTE_SEMI[m[1]] + acc) % 12 + 12) % 12;
}

export const Root = {
    _v: 0,
    get default() { return this._v; },
    // Accepts a number (0–11 semitone) OR a note name: Root.default = "E"
    set default(v) {
        if (typeof v === 'string') {
            const s = noteToSemitone(v);
            this._v = s !== null ? s : (Number(v) || 0);
        } else { this._v = Number(v) || 0; }
    },
};

// scaleOverride: optional per-player scale array (e.g. from .penta()).
export function toMidi(degree, oct, scaleOverride) {
    if (degree === null || degree === undefined) return null;
    const scale = scaleOverride || Scale.default;
    const n     = scale.length;
    const d     = Math.round(degree);
    const scaleDeg  = ((d % n) + n) % n;
    const octShift  = Math.floor(d / n);
    return oct * 12 + scale[scaleDeg] + octShift * 12 + Root.default;
}
