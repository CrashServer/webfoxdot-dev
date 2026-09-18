// buildParams is the single funnel every synth note passes through, which makes it
// the one place a non-finite value can be stopped. Downstream there is no recovery:
// a NaN amp is zeroed by the master limiter and the whole mix goes quiet.
import { buildParams, SYNTH_DEFS, setNaNWarn } from '../../js/synths/registry.js';

const nonFinite = (r) => r ? r.params.filter(v => typeof v === 'number' && !isFinite(v)).length : 'REJECTED';

export default function ({ test, eq, ok }) {
    setNaNWarn(() => {});   // quiet — the warning itself is checked below

    test('params: nothing non-finite ever leaves the builder', () => {
        const CASES = [
            ['NaN amp',        ['pluck', 60, { amp: NaN }, 0.5, 0]],
            ['NaN sus',        ['pluck', 60, { sus: NaN }, 0.5, 0]],
            ['NaN pan',        ['pluck', 60, { pan: NaN }, 0.5, 0]],
            ['NaN extraParam', ['pluck', 60, { cutoff: NaN }, 0.5, 0]],
            ['Infinity sus',   ['pluck', 60, { sus: Infinity }, 0.5, 0]],
            ['NaN leg',        ['pluck', 60, { leg: NaN }, 0.5, 0]],
            ['NaN secPerBeat', ['pluck', 60, {}, NaN, 0]],
            ['string amp',     ['pluck', 60, { amp: '0.5' }, 0.5, 0]],
            ['rawSus synth',   ['donk', 60, { amp: NaN, sus: NaN }, 0.5, 0]],
        ];
        for (const [label, args] of CASES) eq(nonFinite(buildParams(...args)), 0, label);
    });

    test('params: a non-finite PITCH drops the note rather than sounding a low C', () => {
        eq(buildParams('pluck', NaN, { amp: 0.5 }, 0.5, 0), null);
        eq(buildParams('pluck', Infinity, {}, 0.5, 0), null);
    });

    test('params: it says which synth and which param, once', () => {
        // The dedupe is per synth.param and lives for the session, so this has to use
        // a pair no earlier check has already spent.
        const synth = Object.keys(SYNTH_DEFS).find(n => n !== 'pluck' && n !== 'donk');
        const seen = [];
        setNaNWarn((m) => seen.push(m));
        buildParams(synth, 60, { pan: NaN }, 0.5, 0);
        buildParams(synth, 60, { pan: NaN }, 0.5, 0);   // same again → still one line
        ok(seen.length === 1, `expected one warning, got ${seen.length}`);
        ok(seen[0].includes(synth) && /pan/.test(seen[0]), seen[0]);
        setNaNWarn(() => {});
    });

    test('params: ordinary notes are untouched across every synth', () => {
        // The guard must be invisible. Anything else is a change to how things sound.
        const ARGS = [{}, { amp: 0.7, dur: 1 }, { sus: 2, leg: 0.5 }, { attack: 0.05, release: 0.4 }, { pan: -0.3 }];
        let checked = 0;
        for (const name of Object.keys(SYNTH_DEFS)) {
            for (const r of ARGS) for (const spb of [0.5, 0.25]) {
                const out = buildParams(name, 60, r, spb, 0);
                ok(out && out.params.every(v => typeof v !== 'number' || isFinite(v)), `${name} ${JSON.stringify(r)}`);
                checked++;
            }
        }
        ok(checked > 500, `only ${checked} combinations checked`);
    });
}
