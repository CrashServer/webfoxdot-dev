// aud() — the sound, as a value you can put anywhere a number goes.
//
// The twin of midi() in js/midi/midi.js, and deliberately the same shape: a
// {get()} object flagged isTimeVar, so the player's per-step resolveArgs and the
// visual resolver both sample it without knowing what it is. That means it works on
// EVERY param in the language, audio and visual alike, with no new plumbing:
//
//     video1 >> plasma(speed=aud('bass', 0.2, 3))
//     video1 >> mandelbulb(power=aud('level', 2, 9, 'exp'))
//     video2 >> freqtower(scale=aud(4))        # FFT bin 4 — one "EQ channel"
//     p1 >> pluck(lpf=aud('treble', 400, 6000))
//
// It reads the SAME analyser audiviz() and the visuals read (bridge.js taps scsynth's
// output), so a meter, a picture and a bound param can never disagree, and nothing
// extra is connected to the audio graph. In a session that analyser falls back to the
// room's shared one, so a machine doing visuals with no audio booted still follows the
// set — see getVisualAudio().
//
// Four named bands plus the 32 spectrum bins. The bands are what you reach for; a bin
// is for when you want one narrow slice — a kick, a hat — rather than a third of the
// spectrum.
import { getVisualAudio } from './bridge.js';
import { shapeValue }     from '../midi/midi.js';

export const AUD_BANDS = ['level', 'bass', 'mid', 'treble'];
export const AUD_BINS   = 32;

/** Normalise the first argument into either a band name or a bin index. */
export function audBand(band) {
    if (typeof band === 'number' || (typeof band === 'string' && /^\d+$/.test(band))) {
        return Math.max(0, Math.min(AUD_BINS - 1, Math.round(Number(band))));
    }
    const s = String(band ?? 'level').toLowerCase();
    return AUD_BANDS.includes(s) ? s : 'level';
}

function read(band) {
    const a = getVisualAudio();
    if (typeof band === 'number') {
        const s = a.spectrum || [];
        return Math.max(0, Math.min(1, Number(s[band]) || 0));
    }
    return Math.max(0, Math.min(1, Number(a[band]) || 0));
}

/**
 * @param {string|number} band   'level' | 'bass' | 'mid' | 'treble', or a bin 0–31
 * @param {number} lo,hi         the range to map into (default 0–1, like midi())
 * @param {string} curve         lin · exp · log · quad · cubic · sqrt · s
 * @param {number} smooth        follower time constant in SECONDS. 0 is the raw
 *                               analyser, which flickers; the default takes the
 *                               twitch off without making it feel late.
 */
export function makeAud(band = 'level', lo = 0, hi = 1, curve = 'lin', smooth = 0.06) {
    return {
        isAud: true, isTimeVar: true,
        band: audBand(band), lo: Number(lo), hi: Number(hi),
        curve: String(curve || 'lin'), smooth: Math.max(0, Number(smooth) || 0),
        _v: 0, _t: 0,
        get() {
            // Smoothed against WALL TIME rather than per call: the same object is read
            // once per frame by the renderer and again by whatever panel is showing it,
            // and a per-call follower would run at whatever rate that happens to be.
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const dt  = this._t ? Math.min(0.25, (now - this._t) / 1000) : 0;
            this._t = now;
            const raw = read(this.band);
            if (this.smooth > 0 && dt > 0) this._v += (raw - this._v) * (1 - Math.exp(-dt / this.smooth));
            else if (this.smooth <= 0)     this._v = raw;
            else if (!dt)                  this._v = this._v || raw;
            return shapeValue(this.lo, this.hi, this.curve, Math.max(0, Math.min(1, this._v)));
        },
        // What you would have typed. vsnap() and the panels write this rather than the
        // number it reads at that instant — see makeMidi's toCode().
        toCode() {
            const n = (v) => String(Math.round(Number(v) * 1000) / 1000);
            const b = typeof this.band === 'number' ? String(this.band) : JSON.stringify(this.band);
            const parts = [b];
            const dfltRange = this.lo === 0 && this.hi === 1;
            if (!dfltRange || this.curve !== 'lin' || this.smooth !== 0.06) parts.push(n(this.lo), n(this.hi));
            if (this.curve !== 'lin' || this.smooth !== 0.06) parts.push(JSON.stringify(this.curve));
            if (this.smooth !== 0.06) parts.push(n(this.smooth));
            return `aud(${parts.join(', ')})`;
        },
        /** Short label for a panel row — "aud bass", "aud bin4". */
        label() { return 'aud ' + (typeof this.band === 'number' ? 'bin' + this.band : this.band); },
    };
}
