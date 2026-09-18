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
        // 206 of them, reachable before this only if you already knew the word. The
        // scene itself comes first; a changelog entry that happens to mention it may
        // follow, which is the point of indexing the changelog too.
        eq(names('gyroid')[0], 'gyroidslice');
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

    test('docsearch: the changelog is searchable by its MIDDLE, not just its headline', () => {
        // The changelog is the most detailed writing in the project and none of it was
        // reachable except by scrolling 233KB. What you remember about an entry is
        // usually a word from inside it, not its opening clause.
        const hits = searchDocs('recycled', IDX);
        ok(hits.length > 0, 'nothing found for a word that is definitely in there');
        ok(hits.every(h => h.tab), 'a hit with no tab to go to');
    });

    test('docsearch: a changelog match never outranks the thing itself', () => {
        // Many entries say "reverb"; exactly one row IS reverb.
        eq(searchDocs('reverb', IDX)[0].kind, 'fx');
        eq(searchDocs('PGauss', IDX)[0].kind, 'pattern');
    });

    test('docsearch: a hit that can be used carries the call to insert', () => {
        const scene = searchDocs('gyroidslice', IDX)[0];
        eq(scene.insert, 'video1 >> gyroidslice()');
        const fx = searchDocs('lpf', IDX).find(e => e.kind === 'fx');
        eq(fx.insert, 'lpf=800');
    });
}
