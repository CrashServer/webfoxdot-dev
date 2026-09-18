// compo_base — a skeleton arrangement. The names are the interesting part: they have
// to be DISTINCT (#@goto resolves to the first section with a name, so a duplicate is
// a set that jumps somewhere you did not mean) and they have to be legal section names.
import { partNames, compoBase, PART_WORDS, PART_FAMILIES } from '../../js/engine/partnames.js';
import { setSeed, beginEvalScope, randAt } from '../../js/patterns/rng.js';

const HEADER = /^#@[a-z][a-z0-9]*\(\d+\)$/;

export default function ({ test, eq, ok }) {
    test('partnames: every word is a legal section name', () => {
        for (const [family, words] of Object.entries(PART_WORDS))
            for (const w of words)
                ok(/^[a-z][a-z0-9]*$/.test(w), `${family}: "${w}" is not a bare lowercase word`);
    });

    test('partnames: no word appears in two families', () => {
        const seen = new Map();
        for (const [family, words] of Object.entries(PART_WORDS))
            for (const w of words) {
                ok(!seen.has(w), `"${w}" is in both ${seen.get(w)} and ${family}`);
                seen.set(w, family);
            }
    });

    test('partnames: names are distinct, even past the size of the pool', () => {
        for (const n of [4, 16, 64, 200]) eq(new Set(partNames(n)).size, n, `${n} requested`);
        // a family is small, so this is the numbered-overflow path
        eq(new Set(partNames(40, 'birds')).size, 40);
    });

    test('partnames: a family draws only from that family', () => {
        for (const f of PART_FAMILIES) {
            const pool = new Set(PART_WORDS[f]);
            for (const n of partNames(8, f)) ok(pool.has(n), `${n} is not in ${f}`);
        }
    });

    test('compoBase: the shape is #@name(beats) with a gap under each', () => {
        const out = compoBase(4, 8);
        const lines = out.split('\n');
        const headers = lines.filter(l => l.trim());
        eq(headers.length, 4);
        for (const h of headers) ok(HEADER.test(h), `not a section header: ${h}`);
        // a blank line between every pair, so there is somewhere to write
        for (let i = 0; i < headers.length - 1; i++) {
            const a = lines.indexOf(headers[i]), b = lines.indexOf(headers[i + 1]);
            ok(b - a >= 2, `no gap under ${headers[i]}`);
        }
    });

    test('compoBase: the beat count is the one you asked for', () => {
        for (const beats of [1, 4, 16, 64])
            for (const h of compoBase(3, beats).split('\n').filter(l => l.trim()))
                eq(h.match(/\((\d+)\)/)[1], String(beats));
    });

    test('compoBase: a seed makes the same skeleton twice', () => {
        const draw = () => { setSeed(42); beginEvalScope('compo'); return compoBase(6, 8, null, () => randAt(0, -1)); };
        eq(draw(), draw());
        setSeed(null);
    });
}
