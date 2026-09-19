// cut — FoxDot's trimLength: sound for sus x cut, then chop in 10 ms.
//
// On synths it shortens the note AND the release, because a synth's own tail would
// otherwise follow and a pad with a two-second release is not "cut" by trimming its
// hold. On samples it drives fd_sampler's new envelope — which is also what finally
// makes play(..., sus=) do something: sus was on the known-params list and sent
// nowhere, so it evaluated cleanly and changed nothing.
import { sampleTrimSec } from '../../js/engine/player.js';
import { buildParams } from '../../js/synths/registry.js';

// buildParams returns { scName, params } with params a flat [name, value, …] list.
const get = (res, name) => { const p = res.params; const i = p.indexOf(name); return i < 0 ? undefined : p[i + 1]; };
const SPB = 0.5;   // 120 bpm

export default function ({ test, eq, ok }) {
    test('cut: synth note is sus x cut long', () => {
        const whole = buildParams('pluck', 60, { dur: 2, sus: 2 }, SPB);
        const half  = buildParams('pluck', 60, { dur: 2, sus: 2, cut: 0.5 }, SPB);
        eq(get(whole, 'sus'), 1);            // 2 beats at 0.5 s
        eq(get(half,  'sus'), 0.5);          // half of it
    });

    test('cut: the release becomes a 10 ms chop', () => {
        const long = buildParams('pads', 60, { dur: 4, sus: 4, release: 2 }, SPB);
        const cut  = buildParams('pads', 60, { dur: 4, sus: 4, release: 2, cut: 0.5 }, SPB);
        eq(get(long, 'release'), 2);
        ok(get(cut, 'release') <= 0.01, `release ${get(cut, 'release')} — the tail would follow the cut`);
    });

    test('cut: 1 or more, 0, or nonsense trims nothing', () => {
        const plain = get(buildParams('pluck', 60, { dur: 1, sus: 1 }, SPB), 'sus');
        for (const c of [1, 1.5, 0, -1, 'x', NaN])
            eq(get(buildParams('pluck', 60, { dur: 1, sus: 1, cut: c }, SPB), 'sus'), plain);
    });

    test('cut: composes with leg', () => {
        eq(get(buildParams('pluck', 60, { dur: 2, sus: 2, leg: 0.5, cut: 0.5 }, SPB), 'sus'), 0.25);
    });

    test('sample trim: nothing asked for plays the whole sample', () => {
        eq(sampleTrimSec({}, 1, 120), 0);
        eq(sampleTrimSec({ trimSus: null, trimCut: null }, 1, 120), 0);
    });

    test('sample trim: sus is a length in beats', () => {
        eq(sampleTrimSec({ trimSus: 1 }, 0.25, 120), 0.5);      // 1 beat at 120 bpm
    });

    test('sample trim: cut alone is a fraction of the SLOT', () => {
        // FoxDot's sus defaults to the note's duration; here that is the slot the
        // character occupies, so a subdivided hat is trimmed to its own half-slot.
        eq(sampleTrimSec({ trimCut: 0.5 }, 1, 120), 0.25);
        eq(sampleTrimSec({ trimCut: 0.5 }, 0.5, 120), 0.125);
    });

    test('sample trim: cut of a given sus', () => {
        eq(sampleTrimSec({ trimSus: 2, trimCut: 0.25 }, 1, 120), 0.25);
    });

    test('sample trim: cut of 1 or more trims nothing', () => {
        eq(sampleTrimSec({ trimCut: 1 }, 1, 120), 0);
        eq(sampleTrimSec({ trimCut: 2 }, 1, 120), 0);
    });
}
