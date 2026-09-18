// One search field across ten tabs and ~900 entries.
import { docIndex, searchDocs } from '../../js/ui/docs/search.js';

const IDX = docIndex({
    synths: { pluck: { defaults: { amp: 0.8, cutoff: 8000 } }, dbass: { defaults: { amp: 1 } } },
    fx:     { reverb: { desc: 'A room around the sound', default: 0.4 },
              lpf:    { desc: 'Low-pass filter', default: 800 } },
    scenes: ['plasma', 'gyroidslice', 'truchettiles'],
    examples: [{ id: 'dubplate', title: 'Dubplate', cat: 'Sets' }],
});
const names = (q) => searchDocs(q, IDX).map(e => e.name);

export default function ({ test, eq, ok }) {
    test('docsearch: the index covers every kind of thing', () => {
        const kinds = new Set(IDX.map(e => e.kind));
        for (const k of ['pattern', 'function', 'synth', 'fx', 'scene', 'shortcut', 'example'])
            ok(kinds.has(k), `no ${k} entries indexed`);
    });

    test('docsearch: an exact name wins, signature and all', () => {
        // PGauss is listed as "PGauss(mean, deviation)" — typing the bare name has to
        // count as an exact match on the DEFINITION, not only on a section named after it.
        eq(names('PGauss')[0], 'PGauss(mean, deviation)');
    });

    test('docsearch: a workshop layer is findable by name', () => {
        // 206 of them, reachable before this only if you already knew the word.
        eq(names('gyroid'), ['gyroidslice']);
        ok(names('truchet').includes('truchettiles'));
    });

    test('docsearch: a name beats a description that merely mentions it', () => {
        const r = names('reverb');
        eq(r[0], 'reverb');
    });

    test('docsearch: one letter is not a search', () => {
        eq(searchDocs('p', IDX), []);
        eq(searchDocs('', IDX), []);
        eq(searchDocs('   ', IDX), []);
    });

    test('docsearch: nothing matching returns nothing, rather than everything', () => {
        eq(searchDocs('zzzznotathing', IDX), []);
    });

    test('docsearch: every hit carries the tab it lives in', () => {
        for (const e of searchDocs('rand', IDX)) ok(e.tab, `${e.name} has no tab`);
    });

    test('docsearch: a hit that can be used carries the call to insert', () => {
        const scene = searchDocs('gyroidslice', IDX)[0];
        eq(scene.insert, 'video1 >> gyroidslice()');
        const fx = searchDocs('lpf', IDX).find(e => e.kind === 'fx');
        eq(fx.insert, 'lpf=800');
    });
}
