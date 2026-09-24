// A block that defined a synth and played it failed "mylead is not defined" — the
// run's names are fixed before it starts. The definitions now run first.
import { splitDefsynths } from '../../js/editor/defsplit.js';

export default function ({ test, eq, ok }) {
    const block = [
        'defsynth("mylead", { cutoff: 2000 }, ({ out, note, amp }) => {',
        '  const f = note.midicps()   // a ) in a comment',
        '  Out.ar(out, SinOsc.ar(f).mul(amp))  # and ")" in a string',
        '})',
        '',
        'p1 >> mylead([0, 4, 7], dur=1)',
    ].join('\n');
    test('defsplit: the definition and the rest come apart', () => {
        const { defs, rest } = splitDefsynths(block);
        eq(defs.split('\n').length, 4);
        ok(defs.startsWith('defsynth(') && defs.trim().endsWith('})'));
        ok(!rest.includes('defsynth') && rest.includes('p1 >> mylead'));
    });
    test('defsplit: the rest keeps its line numbers', () => {
        const { rest } = splitDefsynths(block);
        eq(rest.split('\n').length, 6);
        eq(rest.split('\n')[5], 'p1 >> mylead([0, 4, 7], dur=1)');
    });
    test('defsplit: no defsynth, nothing moves', () => {
        eq(splitDefsynths('p1 >> pluck([0])'), { defs: '', rest: 'p1 >> pluck([0])' });
    });
    test('defsplit: an unclosed defsynth is left alone', () => {
        eq(splitDefsynths('defsynth("x", {}, () => {').defs, '');
    });
}
